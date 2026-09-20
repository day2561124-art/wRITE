import test from "node:test";
import assert from "node:assert/strict";

import { buildCharacterCommunicationIr } from "../../server/src/character-communication-ir-service.mjs";
import { buildCharacterCommunicationActionCandidate, planCharacterCommunication } from "../../server/src/character-communication-foundation-service.mjs";

const basis = "B 正在看的書尚未看完";
const privateContent = "我很依戀 B";
const indirectInput = {
  character: "A",
  cognition: {
    known: [basis],
    communication_goal: {
      character: "A",
      purpose: "希望 B 留下",
      addressee: "B",
      mode: "indirect",
      private_content: privateContent,
      withhold_private_content: true,
      basis_claim: basis,
    },
  },
};

test("shared IR separates speaker intention from observable and listener-authored meaning", () => {
  const candidate = buildCharacterCommunicationActionCandidate(indirectInput);
  const ir = candidate.communication.ir;
  assert.equal(ir.schema_version, "character-communication-ir-v1");
  assert.equal(ir.participants.speaker, "A");
  assert.deepEqual(ir.participants.intended_addressees, ["B"]);
  assert.equal(ir.communicative_goal.purpose, null);
  assert.equal(ir.content.semantic_content, basis);
  assert.equal(ir.content.epistemic.status, "character_known");
  assert.equal(ir.content.epistemic.source, null);
  assert.equal(ir.content.epistemic.world_truth_claimed, false);
  assert.equal(ir.pragmatics.indirect, true);
  assert.equal(ir.pragmatics.listener_inference_required, true);
  assert.equal(ir.modalities.speech.intended_meaning, basis);
  assert.equal(ir.modalities.speech.surface_realization_complete, false);
  assert.equal(ir.interaction.grounding_status, "not_yet_observed");
  assert.equal(ir.boundaries.observable_signal_authored, false);
  assert.equal(ir.boundaries.listener_inferred_meaning_authored, false);
  assert.equal(ir.boundaries.listener_private_state_inferred, false);
});

test("native planner carries speaker-authored pragmatic context privately without claiming listener uptake", () => {
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      known: [basis],
      communication_goal: {
        character: "A", purpose: "希望 B 留下", addressee: "B", mode: "indirect",
        basis_claim: basis,
        communication_context: {
          communicative_functions: ["hint", "request"],
          allowed_implications: ["可以再待一下"],
          stance: "tentative",
          social_presentation_concern: "不直接暴露依賴",
          intentional_display: { intended_meaning: "試探是否願意留下", modality: "gaze", target: "B" },
        },
      },
    },
  });
  const privatePlan = candidate.communication.ir;
  // Action candidates intentionally carry only the public IR projection.
  assert.deepEqual(privatePlan.pragmatics.communicative_functions, []);
  assert.deepEqual(privatePlan.disclosure.allowed_implications, []);
  assert.equal(privatePlan.pragmatics.stance, null);
  assert.deepEqual(privatePlan.meaning_layers.listener_inferred_meanings, []);
  assert.equal(privatePlan.boundaries.listener_private_state_inferred, false);

  // The planner itself retains the same-character context for downstream
  // private planning/inspection without treating intended implication as uptake.
  const plan = planCharacterCommunication({
    character: "A",
    cognition: {
      known: [basis],
      communication_goal: {
        character: "A", purpose: "希望 B 留下", addressee: "B", mode: "indirect",
        basis_claim: basis,
        communication_context: {
          communicative_functions: ["hint", "request"],
          allowed_implications: ["可以再待一下"], stance: "tentative",
        },
      },
    },
  });
  const ir = buildCharacterCommunicationIr(plan);
  assert.deepEqual(ir.pragmatics.communicative_functions, ["hint", "request"]);
  assert.deepEqual(ir.disclosure.allowed_implications, ["可以再待一下"]);
  assert.equal(ir.pragmatics.stance, "tentative");
  assert.equal(ir.pragmatics.listener_inference_required, true);
  assert.deepEqual(ir.meaning_layers.listener_inferred_meanings, []);
  assert.equal(ir.interaction.grounding_status, "not_yet_observed");
});

test("shared IR keeps withheld content private while retaining disclosure provenance", () => {
  const candidate = buildCharacterCommunicationActionCandidate(indirectInput);
  const ir = candidate.communication.ir;
  assert.equal(ir.disclosure.withheld_private_content, null);
  assert.equal(ir.disclosure.withheld_content_exposed, false);
  assert.equal(ir.disclosure.private_purpose_exposed, false);
  assert.equal(JSON.stringify(candidate.communication.message).includes(privateContent), false);
});

test("nonverbal semantic intent uses the same IR without pretending realization occurred", () => {
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "示意 B 先停下",
        addressee: "B",
        mode: "nonverbal",
        nonverbal_signal: "以視線示意 B 暫停",
      },
    },
  });
  assert.equal(candidate.communication.ir.modalities.speech, null);
  assert.equal(candidate.communication.ir.modalities.nonverbal.intended_meaning, "以視線示意 B 暫停");
  assert.equal(candidate.communication.ir.modalities.nonverbal.surface_realization_complete, false);
});

test("IR constructor rejects self-addressed or identity-incomplete plans", () => {
  assert.throws(() => buildCharacterCommunicationIr({
    character: "A", addressee: "A", purpose: "測試", mode: "direct",
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
});

test("optional speaker-authored context preserves reference, audience, pragmatics and multiple modalities", () => {
  const ir = buildCharacterCommunicationIr({
    character: "A", addressee: "B", purpose: "請 B 留下", mode: "indirect",
    external_action: "speech",
    message: { semantic_content: basis, speech_act: "indirect_query" },
    ir_context: {
      possible_overhearers: ["C"],
      reference_targets: ["book-B"],
      topic: "書", focus: "還沒看完", contrast_set: ["已經看完"],
      communicative_functions: ["request", "turn_management"],
      stance: "uncertain", social_presentation_concern: "不願承認依賴",
      modality_meanings: { gaze: "看向書", gesture: "指向書", prosody: "保留試探語氣" },
      interaction_id: "talk-1", thread_id: "thread-1",
    },
  });
  assert.deepEqual(ir.participants.possible_overhearers, ["C"]);
  assert.equal(ir.participants.primary_addressee, "B");
  assert.deepEqual(ir.content.reference_targets, ["book-B"]);
  assert.equal(ir.content.information_structure.focus, "還沒看完");
  assert.deepEqual(ir.pragmatics.communicative_functions, ["request", "turn_management"]);
  assert.equal(ir.modalities.gaze, "看向書");
  assert.equal(ir.modalities.gesture, "指向書");
  assert.equal(ir.modalities.prosody, "保留試探語氣");
  assert.equal(ir.meaning_layers.observable_signal, null);
  assert.deepEqual(ir.meaning_layers.listener_inferred_meanings, []);
  assert.equal(ir.interaction.thread_id, "thread-1");
});

test("public projection strips private audience, reference, interaction and display plan", () => {
  const input = {
    character: "A", addressee: "B", purpose: "我不想 B 離開", mode: "indirect",
    external_action: "speech", withheld_private_content: "我很依戀 B",
    message: { semantic_content: basis, speech_act: "indirect_query", source: "cognition.known[0]" },
    ir_context: {
      possible_overhearers: ["C"], reference_targets: ["private-book"],
      topic: "secret-topic", stance: "secret-stance",
      modality_meanings: { gaze: "秘密手勢" },
      interaction_id: "secret-interaction",
    },
  };
  const ir = buildCharacterCommunicationIr(input, { publicOnly: true });
  const serialized = JSON.stringify(ir);
  for (const secret of ["我不想 B 離開", "我很依戀 B", "cognition.known", "private-book", "secret-topic", "secret-stance", "秘密手勢", "secret-interaction"])
    assert.equal(serialized.includes(secret), false, `Leaked ${secret}`);
  assert.deepEqual(ir.participants.possible_overhearers, []);
  assert.equal(ir.modalities.gaze, null);
  assert.equal(ir.meaning_layers.observable_signal, null);
  assert.equal(ir.boundaries.listener_inferred_meaning_authored, false);
});

test("speaker audience context rejects duplicate and unbounded overhearers", () => {
  const base = { character: "A", addressee: "B", purpose: "告知", mode: "direct" };
  assert.throws(() => buildCharacterCommunicationIr({
    ...base, ir_context: { possible_overhearers: ["B"] },
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
  assert.throws(() => buildCharacterCommunicationIr({
    ...base, ir_context: { possible_overhearers: Array.from({ length: 17 }, (_, i) => `C${i}`) },
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
});

test("speaker-authored IR retains subjective/event content, permitted implication and repair lineage", () => {
  const ir = buildCharacterCommunicationIr({
    character: "A", addressee: "B", purpose: "挽留", mode: "indirect",
    external_action: "speech",
    message: { semantic_content: basis, speech_act: "indirect_query", epistemic_status: "character_uncertain" },
    ir_context: {
      event_content: "B 尚未結束閱讀",
      subjective_status: "speaker_hypothesis", certainty: "uncertain",
      allowed_implications: ["可以再待一下"],
      intentional_display: { intended_meaning: "試探 B", modality: "gaze", target: "B" },
      state_dependent_modulation: {
        speaker_state_basis: "內心緊張", expression_constraint: "語氣保留",
        intended_effect: "避免直接暴露依賴",
      },
      response_to: "event-B-1", repair_of: "event-A-0",
    },
  });
  assert.equal(ir.content.event_content, "B 尚未結束閱讀");
  assert.equal(ir.content.epistemic.subjective_status, "speaker_hypothesis");
  assert.equal(ir.content.epistemic.certainty, "uncertain");
  assert.equal(ir.content.epistemic.world_truth_claimed, false);
  assert.deepEqual(ir.disclosure.allowed_implications, ["可以再待一下"]);
  assert.equal(ir.expression_planning.intentional_display.intended_meaning, "試探 B");
  assert.equal(ir.expression_planning.intentional_display.realized, false);
  assert.equal(ir.expression_planning.state_dependent_modulation.expression_constraint, "語氣保留");
  assert.equal(ir.expression_planning.state_dependent_modulation.realized, false);
  assert.equal(ir.interaction.response_to, "event-B-1");
  assert.equal(ir.interaction.repair_of, "event-A-0");
  assert.equal(ir.interaction.grounding_status, "not_yet_observed");
  assert.equal(ir.meaning_layers.observable_signal, null);
  assert.deepEqual(ir.meaning_layers.listener_inferred_meanings, []);
});

test("public IR never exports private implication, display, state or repair provenance", () => {
  const ir = buildCharacterCommunicationIr({
    character: "A", addressee: "B", purpose: "secret-purpose", mode: "indirect",
    external_action: "speech", message: { semantic_content: basis },
    ir_context: {
      event_content: "secret-event", subjective_status: "secret-subjective",
      certainty: "secret-certainty", allowed_implications: ["secret-implication"],
      intentional_display: { intended_meaning: "secret-display", modality: "gaze", target: "secret-target" },
      state_dependent_modulation: {
        speaker_state_basis: "secret-state", expression_constraint: "secret-constraint",
        intended_effect: "secret-effect",
      },
      response_to: "secret-response", repair_of: "secret-repair",
    },
  }, { publicOnly: true });
  const output = JSON.stringify(ir);
  for (const secret of ["secret-purpose", "secret-event", "secret-subjective", "secret-certainty",
    "secret-implication", "secret-display", "secret-target", "secret-state",
    "secret-constraint", "secret-effect", "secret-response", "secret-repair"])
    assert.equal(output.includes(secret), false, `Leaked ${secret}`);
  assert.deepEqual(ir.disclosure.allowed_implications, []);
  assert.equal(ir.expression_planning.intentional_display.realized, false);
  assert.equal(ir.expression_planning.state_dependent_modulation.realized, false);
  assert.equal(ir.interaction.repair_of, null);
  assert.equal(ir.boundaries.listener_private_state_inferred, false);
});

test("silence IR does not fake an observable utterance or grounding", () => {
  const ir = buildCharacterCommunicationIr({
    character: "A", addressee: "B", purpose: "不透露", mode: "silence",
    external_action: "none", message: null,
  });
  assert.equal(ir.modalities.speech, null);
  assert.equal(ir.modalities.nonverbal, null);
  assert.equal(ir.meaning_layers.observable_signal, null);
  assert.equal(ir.interaction.grounding_status, "not_yet_observed");
});

test("allowed implications reject duplicate and unbounded lists", () => {
  const base = { character: "A", addressee: "B", purpose: "試探", mode: "indirect" };
  assert.throws(() => buildCharacterCommunicationIr({
    ...base, ir_context: { allowed_implications: ["X", "X"] },
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
  assert.throws(() => buildCharacterCommunicationIr({
    ...base, ir_context: { allowed_implications: Array.from({ length: 17 }, (_, i) => `implication-${i}`) },
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
});
