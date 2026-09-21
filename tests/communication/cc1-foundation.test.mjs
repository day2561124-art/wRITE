import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCharacterCommunicationActionCandidate,
  planCharacterCommunication,
} from "../../server/src/character-communication-foundation-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";

const basis = "B 正在看的書尚未看完";
const goal = (mode, overrides = {}) => ({
  character: "A",
  purpose: "希望 B 留下",
  addressee: "B",
  mode,
  private_content: "我很依戀 B",
  withhold_private_content: true,
  basis_claim: basis,
  ...overrides,
});
const packet = (g, known = [basis], uncertain = []) => ({
  character: "A",
  cognition: { known, uncertain, communication_goal: g },
  candidate_action_intents: [],
});

test("indirect retention has same-character known grounding without exposing private motive as speech", () => {
  const value = planCharacterCommunication(packet(goal("indirect")));
  assert.equal(value.external_action, "speech");
  assert.equal(value.message.speech_act, "indirect_query");
  assert.equal(value.message.source, "cognition.known[0]");
  assert.equal(value.message.epistemic_status, "character_known");
  assert.notEqual(value.message.semantic_content, value.withheld_private_content);
  assert.equal(value.message.world_truth_claimed, false);
});

test("direct expression follows character's distinct disclosure decision", () => {
  const value = planCharacterCommunication(packet(goal("direct", {
    withhold_private_content: false,
    express_private_content: true,
  })));
  assert.equal(value.message.semantic_content, "我很依戀 B");
  assert.equal(value.mode, "direct");
});

test("CC-3 withholding blocks exact private text embedded in public expressions", () => {
  const secret = "我很依戀 B";
  const cases = [
    goal("direct", { public_content: `其實${secret}，別走。` }),
    goal("indirect", { basis_claim: `大家說${secret}` }),
    goal("nonverbal", { nonverbal_signal: `比手勢傳達：${secret}` }),
  ];
  for (const g of cases) {
    const input = packet(g, [basis, `大家說${secret}`]);
    assert.throws(() => planCharacterCommunication(input), {
      code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID",
    });
    assert.throws(() => buildCharacterCommunicationActionCandidate(input), {
      code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID",
    });
  }
});

test("CC-3 a speaker may deliberately imply withheld content without saying its literal text", () => {
  const input = packet(goal("indirect", {
    communication_context: { allowed_implications: ["我很依戀 B"] },
  }));
  const plan = planCharacterCommunication(input);
  assert.equal(plan.message.semantic_content, basis);
  assert.deepEqual(plan.ir_context.allowed_implications, ["我很依戀 B"]);
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(JSON.stringify(candidate).includes("我很依戀 B"), false);
  assert.equal(candidate.communication.ir.boundaries.listener_private_state_inferred, false);
});

test("CC-3 disclosure constraint belongs to this character goal and addressee", () => {
  const direct = goal("direct", {
    withhold_private_content: false,
    public_content: "其實我很依戀 B，別走。",
  });
  const plan = planCharacterCommunication(packet(direct));
  assert.equal(plan.message.semantic_content, direct.public_content);
  assert.equal(plan.withheld_private_content, null);
  assert.equal(plan.addressee, "B");
});

test("CC-2 sincere assertion retains bounded same-character provenance only in private plan", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "sincere_assertion",
  }));
  const planned = planCharacterCommunication(input);
  assert.equal(planned.message.speech_act, "assert");
  assert.equal(planned.message.epistemic_status, "character_known");
  assert.equal(planned.message.source, "cognition.known[0]");
  assert.deepEqual(planned.message.claim_provenance, {
    schema_version: "cc2-speaker-claim-provenance-v1",
    claim_kind: "sincere_assertion",
    source_kind: "same_character_accessible_cognition",
    source_ref: "cognition.known[0]",
    epistemic_status: "character_known",
    world_truth_claimed: false,
  });
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.speech_act, "assert");
  assert.equal(candidate.communication.message.epistemic_status, "character_known");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
  const publicText = JSON.stringify(candidate);
  assert.equal(publicText.includes("cognition.known"), false);
  assert.equal(publicText.includes("cc2-speaker-claim-provenance-v1"), false);
  assert.equal(publicText.includes("希望 B 留下"), false);
  assert.equal(publicText.includes("我很依戀 B"), false);
});

test("CC-2 unsupported sincere assertion is blocked rather than generated from goal alone", () => {
  const input = packet(goal("direct", {
    public_content: "B 已經看完那本書",
    claim_kind: "sincere_assertion",
  }));
  const planned = planCharacterCommunication(input);
  assert.equal(planned.external_action, "none");
  assert.equal(planned.message, null);
  assert.equal(planned.blocked_reason, "claim_not_in_same_character_accessible_cognition");
  assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  const uncertainOnly = packet(goal("direct", {
    public_content: basis, claim_kind: "sincere_assertion",
  }), [], [basis]);
  assert.equal(planCharacterCommunication(uncertainOnly).external_action, "none");
});

test("CC-2 explicitly uncertain hypothesis keeps its uncertainty and does not claim world truth", () => {
  const input = packet(goal("direct", {
    public_content: basis, claim_kind: "uncertain_hypothesis",
  }), [], [basis]);
  const planned = planCharacterCommunication(input);
  assert.equal(planned.message.epistemic_status, "character_uncertain");
  assert.equal(planned.message.claim_provenance.source_ref, "cognition.uncertain[0]");
  assert.equal(planned.message.claim_provenance.world_truth_claimed, false);
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.epistemic_status, "character_uncertain");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(JSON.stringify(candidate).includes("cognition.uncertain"), false);
});

test("CC-2 deceptive or unknown claims cannot bypass a character-side provenance gate", () => {
  for (const claim_kind of ["deliberate_deception", "generator_hallucination", "unknown"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: basis, claim_kind,
    }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
});

test("CC-2 deliberate deception requires actor-authored intention and contrary known evidence", () => {
  const misleading = "B 已經看完那本書";
  const deception = {
    addressee: "B",
    target_belief: misleading,
    contrary_known_content: basis,
    intends_addressee_to_believe: true,
    speaker_regards_claim_as_contrary: true,
  };
  const input = packet(goal("direct", {
    public_content: misleading,
    claim_kind: "deliberate_deception",
    deception_intent: deception,
  }), [basis], []);
  const privatePlan = planCharacterCommunication(input);
  assert.equal(privatePlan.external_action, "speech");
  assert.equal(privatePlan.message.semantic_content, misleading);
  assert.equal(privatePlan.message.speech_act, "assert");
  assert.equal(privatePlan.message.epistemic_status, "speaker_asserted");
  assert.equal(privatePlan.message.source, "cognition.known[0]");
  assert.deepEqual(privatePlan.message.claim_provenance, {
    schema_version: "cc2-speaker-claim-provenance-v1",
    claim_kind: "deliberate_deception",
    source_kind: "same_character_contrary_known_basis",
    source_ref: "cognition.known[0]",
    epistemic_status: "speaker_asserted",
    intended_addressee: "B",
    intended_target_belief: misleading,
    contrary_known_content: basis,
    actor_authored_contrary_belief: true,
    speaker_intends_to_mislead: true,
    semantic_contradiction_verified: false,
    world_truth_claimed: false,
  });
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.epistemic_status, "speaker_asserted");
  assert.equal(candidate.communication.message.speech_act, "assert");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
  assert.equal(candidate.communication.message.world_truth_claimed, false);
  const publicText = JSON.stringify(candidate);
  for (const secret of [
    "deliberate_deception", "same_character_contrary_known_basis", "cognition.known",
    "speaker_intends_to_mislead", "semantic_contradiction_verified", basis,
    "我很依戀 B", "希望 B 留下",
  ]) assert.equal(publicText.includes(secret), false,
    `Private deceptive intent or evidence leaked: ${secret}`);
});

test("CC-2 deceptive content cannot be generated solely from goal or unrelated known facts", () => {
  const misleading = "B 已經看完那本書";
  const intent = {
    addressee: "B", target_belief: misleading, contrary_known_content: basis,
    intends_addressee_to_believe: true, speaker_regards_claim_as_contrary: true,
  };
  for (const known of [[], [misleading], ["與該主張無關的事實"]]) {
    const input = packet(goal("direct", {
      public_content: misleading, claim_kind: "deliberate_deception",
      deception_intent: intent,
    }), known, [basis]);
    input.world_state = { hidden_fact: basis };
    input.recovered_memories = [{ content: basis }];
    const plan = planCharacterCommunication(input);
    assert.equal(plan.external_action, "none");
    assert.equal(plan.blocked_reason, "deception_contrary_basis_not_in_same_character_known");
    assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  }
});

test("CC-2 deception requires exact target and addressee, not a generator-supplied label", () => {
  const misleading = "B 已經看完那本書";
  const intent = {
    addressee: "B", target_belief: misleading, contrary_known_content: basis,
    intends_addressee_to_believe: true, speaker_regards_claim_as_contrary: true,
  };
  for (const invalid of [
    { intends_addressee_to_believe: false },
    { speaker_regards_claim_as_contrary: false },
    { addressee: "C" },
    { target_belief: "別的主張" },
    { contrary_known_content: misleading },
    { contrary_known_content: "" },
  ]) {
    const input = packet(goal("direct", {
      public_content: misleading, claim_kind: "deliberate_deception",
      deception_intent: { ...intent, ...invalid },
    }), [basis], []);
    assert.throws(() => planCharacterCommunication(input),
      { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  assert.throws(() => planCharacterCommunication(packet(goal("direct", {
    public_content: misleading, claim_kind: "deliberate_deception",
    claim_source_kind: "retrieved_memory", deception_intent: intent,
  }), [basis], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
});

test("CC-2 recalled hypothesis requires actually admitted Current Mind content", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "retrieved_memory",
  }), [], []);
  input.cognition.working_context = {
    focus: {
      context_origin: "recovered_memory",
      content: basis,
      possibly_incorrect: true,
      source_confused: true,
    },
    active_context: [],
  };
  const privatePlan = planCharacterCommunication(input);
  assert.equal(privatePlan.external_action, "speech");
  assert.equal(privatePlan.message.source, "cognition.working_context.focus");
  assert.deepEqual(privatePlan.message.claim_provenance, {
    schema_version: "cc2-speaker-claim-provenance-v1",
    claim_kind: "uncertain_hypothesis",
    source_kind: "admitted_recollection_current_mind",
    source_ref: "cognition.working_context.focus",
    epistemic_status: "character_uncertain",
    possibly_incorrect: true,
    source_confused: true,
    recollection_certainty_not_inferred: true,
    world_truth_claimed: false,
  });
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.epistemic_status, "character_uncertain");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
  const publicText = JSON.stringify(candidate);
  for (const secret of ["cognition.working_context", "admitted_recollection_current_mind",
    "possibly_incorrect", "source_confused", "我很依戀 B"])
    assert.equal(publicText.includes(secret), false, `Leaked private recollection provenance ${secret}`);
});

test("CC-2 Current Mind can source an active recalled item without elevating it to known fact", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "retrieved_memory",
  }), [], []);
  input.cognition.working_context = {
    focus: { content: "unrelated current focus" },
    active_context: [{
      context_origin: "recovered_memory",
      content: basis,
      possibly_incorrect: false,
    }],
  };
  const planned = planCharacterCommunication(input);
  assert.equal(planned.message.source, "cognition.working_context.active_context[0]");
  assert.equal(planned.message.epistemic_status, "character_uncertain");
  assert.equal(planned.message.claim_provenance.possibly_incorrect, false);
  assert.equal(planned.message.claim_provenance.recollection_certainty_not_inferred, true);
});

test("CC-2 raw Memory aliases, nonadmitted attention and foreign recollection cannot invent sources", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "retrieved_memory",
  }), [], []);
  input.recovered_memories = [{ content: basis, memory_id: "engine-private" }];
  input.retrieved_memories = [{ content: basis }];
  input.cognition.recovered_memories = [{ content: basis }];
  input.cognition.attention = { focus: {
    context_origin: "recovered_memory", content: basis,
  } };
  for (const working_context of [
    undefined,
    { focus: { content: basis } },
    { focus: { context_origin: "recovered_memory", content: basis, character: "B" } },
    { focus: { context_origin: "recovered_memory", content: "different memory" } },
  ]) {
    input.cognition.working_context = working_context;
    const planned = planCharacterCommunication(input);
    assert.equal(planned.external_action, "none");
    assert.equal(planned.blocked_reason, "recollection_not_admitted_to_current_mind");
    assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  }
});

test("CC-2 recollection cannot silently certify facts or bypass explicit source-kind contract", () => {
  for (const claim_kind of [null, "sincere_assertion"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: basis,
      claim_kind,
      claim_source_kind: "retrieved_memory",
    }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  assert.throws(() => planCharacterCommunication(packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "raw_world_memory_database",
  }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
});

test("CC-2 current perception supports only bounded uncertain same-character reports", () => {
  for (const channel of ["observed", "audible", "other_senses"]) {
    const input = packet(goal("direct", {
      public_content: basis,
      claim_kind: "uncertain_hypothesis",
      claim_source_kind: "current_perception",
    }), [], []);
    input.perception = { observed: [], audible: [], other_senses: [] };
    input.perception[channel] = [basis];
    const plan = planCharacterCommunication(input);
    assert.equal(plan.external_action, "speech");
    assert.equal(plan.message.source, `perception.${channel}[0]`);
    assert.equal(plan.message.epistemic_status, "character_uncertain");
    assert.deepEqual(plan.message.claim_provenance, {
      schema_version: "cc2-speaker-claim-provenance-v1",
      claim_kind: "uncertain_hypothesis",
      source_kind: "same_character_current_perception",
      source_ref: `perception.${channel}[0]`,
      epistemic_status: "character_uncertain",
      sensory_channel: channel,
      perception_does_not_establish_world_truth: true,
      world_truth_claimed: false,
    });
    const candidate = buildCharacterCommunicationActionCandidate(input);
    assert.equal(candidate.communication.message.epistemic_status, "character_uncertain");
    assert.equal(candidate.communication.ir.content.epistemic.source, null);
    assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
    const serialized = JSON.stringify(candidate);
    for (const privatePart of [
      "same_character_current_perception", `perception.${channel}`,
      "perception_does_not_establish_world_truth", "我很依戀 B",
    ]) assert.equal(serialized.includes(privatePart), false,
      `private perception provenance leaked: ${privatePart}`);
  }
});

test("CC-2 a requested perception report cannot mine raw world or memory or fallback to known", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "current_perception",
  }), [basis], [basis]);
  input.world_state = { hidden_fact: basis };
  input.recovered_memories = [{ content: basis }];
  input.cognition.working_context = { focus: {
    context_origin: "recovered_memory", content: basis,
  } };
  input.cognition.attention = { focus: { content: basis } };
  for (const perception of [
    undefined,
    { observed: [], audible: [], other_senses: [] },
    { observed: ["unrelated"], audible: [], other_senses: [] },
    { observed: [{ content: basis }], audible: [], other_senses: [] },
  ]) {
    input.perception = perception;
    const plan = planCharacterCommunication(input);
    assert.equal(plan.external_action, "none");
    assert.equal(plan.blocked_reason, "claim_not_in_same_character_current_perception");
    assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  }
});

test("CC-2 a sensory observation alone does not authorize sincere certainty or unknown source kinds", () => {
  for (const claim_kind of [null, "sincere_assertion"]) {
    const input = packet(goal("direct", {
      public_content: basis, claim_kind, claim_source_kind: "current_perception",
    }), [], []);
    input.perception = { observed: [basis] };
    assert.throws(() => planCharacterCommunication(input),
      { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "unobserved_world_truth",
  }), [], []);
  input.perception = { observed: [basis] };
  assert.throws(() => planCharacterCommunication(input),
    { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
});

test("CC-2 native action proposer reads observer-bounded cognition perception", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "current_perception",
  }), [], []);
  // world_character_cognition embeds the character-scoped perception in
  // cognition; world_action_proposer passes cognition, not packet.perception.
  input.cognition.perception = { observed: [basis], audible: [], other_senses: [] };
  const planned = planCharacterCommunication(input);
  assert.equal(planned.external_action, "speech");
  assert.equal(planned.message.source, "perception.observed[0]");
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.ok(candidate, "native cognition-only action proposal must be available");
  assert.equal(candidate.communication.message.epistemic_status, "character_uncertain");
  const brainInput = buildWorldSimulationCharacterBrainInput(input);
  assert.equal(brainInput.communication_foundation.message.source, "perception.observed[0]");
  assert.equal(brainInput.boundaries.communication_foundation_world_truth_authority, false);
});

test("CC-2 explicit current perception does not merge stale cognition perception", () => {
  const input = packet(goal("direct", {
    public_content: basis,
    claim_kind: "uncertain_hypothesis",
    claim_source_kind: "current_perception",
  }), [], []);
  input.cognition.perception = { observed: [basis] };
  input.perception = { observed: [], audible: [], other_senses: [] };
  assert.equal(planCharacterCommunication(input).blocked_reason,
    "claim_not_in_same_character_current_perception");
  assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  assert.equal(buildWorldSimulationCharacterBrainInput(input)
    .communication_foundation.blocked_reason,
    "claim_not_in_same_character_current_perception");
  delete input.perception;
  assert.equal(planCharacterCommunication(input).external_action, "speech");
  assert.equal(buildWorldSimulationCharacterBrainInput(input)
    .communication_foundation.external_action, "speech");
});

test("CC-2 attributed testimony requires an understood same-listener public utterance", () => {
  const statement = "門已經上鎖";
  const action = `communication_${"a".repeat(24)}`;
  const intent = { speaker: "C", reported_content: statement, source_action_id: action };
  const input = packet(goal("direct", {
    public_content: statement, claim_kind: "attributed_testimony",
    claim_source_kind: "understood_testimony", testimony_intent: intent,
  }), [], []);
  input.perception = {
    character: "A",
    information_boundary: { listener_receipt_verified: true },
    audible: [{
      schema_version: "cc2-listener-understood-utterance-v1",
      kind: "understood_utterance", observer: "A", channel: "speech",
      speaker: "C", semantic_content: statement, source_action_id: action,
      speech_content_intelligible: true, speaker_identity_recognized: true,
      public_event_committed: true,
    }],
  };
  const plan = planCharacterCommunication(input);
  assert.equal(plan.external_action, "speech");
  assert.equal(plan.message.speech_act, "report_testimony");
  assert.equal(plan.message.epistemic_status, "speaker_attributed_report");
  assert.equal(plan.message.reported_speaker, "C");
  assert.equal(plan.message.source, "perception.audible[0]");
  assert.deepEqual(plan.message.claim_provenance, {
    schema_version: "cc2-speaker-claim-provenance-v1",
    claim_kind: "attributed_testimony",
    source_kind: "same_character_understood_testimony_receipt",
    source_ref: "perception.audible[0]",
    epistemic_status: "speaker_attributed_report",
    reported_speaker: "C", reported_content: statement,
    receipt_action_id: action, listener_understanding_attested: true,
    reported_content_truth_inferred: false,
    speaker_private_belief_inferred: false,
    world_truth_claimed: false,
  });
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.reported_speaker, "C");
  assert.equal(candidate.communication.message.speech_act, "report_testimony");
  assert.equal(candidate.communication.ir.content.reported_speaker, "C");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
  const publicText = JSON.stringify(candidate);
  for (const privatePart of [
    action, "perception.audible", "same_character_understood_testimony_receipt",
    "listener_understanding_attested", "我很依戀 B", "希望 B 留下",
  ]) assert.equal(publicText.includes(privatePart), false,
    `Private testimony evidence leaked: ${privatePart}`);
});

test("CC-2 raw world speech or audible sound never creates understood testimony", () => {
  const statement = "門已經上鎖";
  const action = `communication_${"a".repeat(24)}`;
  const intent = { speaker: "C", reported_content: statement, source_action_id: action };
  const g = goal("direct", {
    public_content: statement, claim_kind: "attributed_testimony",
    claim_source_kind: "understood_testimony", testimony_intent: intent,
  });
  const expected = {
    schema_version: "cc2-listener-understood-utterance-v1",
    kind: "understood_utterance", observer: "A", channel: "speech",
    speaker: "C", semantic_content: statement, source_action_id: action,
    speech_content_intelligible: true, speaker_identity_recognized: true,
    public_event_committed: true,
  };
  const input = packet(g, [statement], [statement]);
  input.world_state = { communication_event: {
    actor: "C", semantic_content: statement, source_action_id: action,
  } };
  input.other_character_cognition = { known: [statement] };
  input.recovered_memories = [{ content: statement }];
  const cases = [
    { perception: { audible: [statement] } },
    { perception: { audible: [{ kind: "audible_sound",
      perceptual_label: "聽見有人說話" }] } },
    { perception: { audible: [expected] } },
    { perception: { character: "B",
      information_boundary: { listener_receipt_verified: true },
      audible: [expected] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, observer: "B" }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, speech_content_intelligible: false }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, speaker_identity_recognized: false }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, public_event_committed: false }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, speaker: "D" }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, semantic_content: "錯誤內容" }] } },
    { perception: { information_boundary: { listener_receipt_verified: true },
      audible: [{ ...expected, source_action_id: `communication_${"b".repeat(24)}` }] } },
  ];
  for (const value of cases) {
    input.perception = value.perception;
    const plan = planCharacterCommunication(input);
    assert.equal(plan.external_action, "none");
    assert.equal(plan.blocked_reason,
      "testimony_not_in_same_character_verified_listener_receipt");
    assert.equal(buildCharacterCommunicationActionCandidate(input), null);
  }
});

test("CC-2 testimony requires explicit source and cannot be used as factual certainty", () => {
  const statement = "門已經上鎖";
  const action = `communication_${"a".repeat(24)}`;
  const intent = { speaker: "C", reported_content: statement, source_action_id: action };
  for (const claim_kind of [null, "sincere_assertion", "uncertain_hypothesis",
    "deliberate_deception", "explicit_assumption"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: statement, claim_kind, claim_source_kind: "understood_testimony",
      testimony_intent: intent,
    }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  for (const bad of [
    { speaker: "A" }, { speaker: "" },
    { reported_content: "別的內容" }, { source_action_id: "not_committed" },
  ]) assert.throws(() => planCharacterCommunication(packet(goal("direct", {
    public_content: statement, claim_kind: "attributed_testimony",
    claim_source_kind: "understood_testimony",
    testimony_intent: { ...intent, ...bad },
  }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  assert.throws(() => planCharacterCommunication(packet(goal("direct", {
    public_content: statement, claim_kind: "attributed_testimony",
    testimony_intent: intent,
  }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
});

test("CC-2 explicit assumption emits a visibly hypothetical speech act without factual evidence", () => {
  const hypothetical = "如果 B 已經看完那本書";
  const input = packet(goal("direct", {
    public_content: hypothetical,
    claim_kind: "explicit_assumption",
    assumption_intent: {
      addressee: "B",
      hypothetical_content: hypothetical,
      speaker_intends_hypothetical_frame: true,
      not_asserted_as_fact: true,
    },
  }), [], []);
  input.world_state = { hidden_fact: hypothetical };
  input.other_character_cognition = { known: [hypothetical] };
  const plan = planCharacterCommunication(input);
  assert.equal(plan.external_action, "speech");
  assert.equal(plan.message.speech_act, "suppose");
  assert.equal(plan.message.semantic_content, hypothetical);
  assert.equal(plan.message.epistemic_status, "speaker_hypothetical");
  assert.equal(plan.message.source, "cognition.communication_goal");
  assert.deepEqual(plan.message.claim_provenance, {
    schema_version: "cc2-speaker-claim-provenance-v1",
    claim_kind: "explicit_assumption",
    source_kind: "same_character_explicit_hypothetical_goal",
    source_ref: "cognition.communication_goal",
    epistemic_status: "speaker_hypothetical",
    hypothetical_content: hypothetical,
    speaker_authored_hypothetical_frame: true,
    proposition_accepted_as_fact: false,
    inference_or_evidence_claimed: false,
    world_truth_claimed: false,
  });
  const candidate = buildCharacterCommunicationActionCandidate(input);
  assert.equal(candidate.communication.message.speech_act, "suppose");
  assert.equal(candidate.communication.message.epistemic_status, "speaker_hypothetical");
  assert.equal(candidate.communication.ir.content.speech_act, "suppose");
  assert.equal(candidate.communication.ir.content.epistemic.status, "speaker_hypothetical");
  assert.equal(candidate.communication.ir.content.epistemic.source, null);
  assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
  assert.equal(candidate.communication.surface_realization_complete, false);
  const publicText = JSON.stringify(candidate);
  for (const privatePart of ["same_character_explicit_hypothetical_goal",
    "cognition.communication_goal", "speaker_authored_hypothetical_frame",
    "proposition_accepted_as_fact", "我很依戀 B", "希望 B 留下"])
    assert.equal(publicText.includes(privatePart), false,
      `Private assumption provenance leaked: ${privatePart}`);
});

test("CC-2 assumption cannot turn missing or mismatched intention into factual assertion", () => {
  const hypothetical = "如果 B 已經看完那本書";
  const intent = {
    addressee: "B",
    hypothetical_content: hypothetical,
    speaker_intends_hypothetical_frame: true,
    not_asserted_as_fact: true,
  };
  for (const invalid of [
    { addressee: "C" },
    { hypothetical_content: "不同假設" },
    { hypothetical_content: "" },
    { speaker_intends_hypothetical_frame: false },
    { not_asserted_as_fact: false },
  ]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: hypothetical, claim_kind: "explicit_assumption",
      assumption_intent: { ...intent, ...invalid },
    }), [], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  for (const claim_kind of [undefined, "sincere_assertion",
    "uncertain_hypothesis", "deliberate_deception"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: hypothetical, claim_kind,
      assumption_intent: intent,
    }), [], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  for (const claim_source_kind of ["current_perception", "retrieved_memory",
    "subjective_inference"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: hypothetical, claim_kind: "explicit_assumption",
      claim_source_kind, assumption_intent: intent,
    }), [], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
});

test("CC-2 subjective inference retains a same-character premise without claiming entailment", () => {
  const conclusion = "B 可能還想繼續看書";
  for (const premise_epistemic_status of ["known", "uncertain"]) {
    const input = packet(goal("direct", {
      public_content: conclusion,
      claim_kind: "uncertain_hypothesis",
      claim_source_kind: "subjective_inference",
      inference_intent: {
        conclusion, premise_content: basis,
        premise_epistemic_status, premise_relation: "supports",
      },
    }), premise_epistemic_status === "known" ? [basis] : [],
    premise_epistemic_status === "uncertain" ? [basis] : []);
    const plan = planCharacterCommunication(input);
    assert.equal(plan.external_action, "speech");
    assert.equal(plan.message.semantic_content, conclusion);
    assert.equal(plan.message.epistemic_status, "character_uncertain");
    assert.equal(plan.message.source, `cognition.${premise_epistemic_status}[0]`);
    assert.deepEqual(plan.message.claim_provenance, {
      schema_version: "cc2-speaker-claim-provenance-v1",
      claim_kind: "uncertain_hypothesis",
      source_kind: "same_character_subjective_inference",
      source_ref: `cognition.${premise_epistemic_status}[0]`,
      epistemic_status: "character_uncertain",
      premise_content: basis,
      premise_epistemic_status,
      premise_relation: "speaker_authored_supports",
      conclusion,
      semantic_entailment_verified: false,
      inference_confidence_inferred: false,
      world_truth_claimed: false,
    });
    const candidate = buildCharacterCommunicationActionCandidate(input);
    assert.equal(candidate.communication.message.epistemic_status, "character_uncertain");
    assert.equal(candidate.communication.ir.content.epistemic.source, null);
    assert.equal(candidate.communication.ir.content.epistemic.world_truth_claimed, false);
    const serialized = JSON.stringify(candidate);
    for (const secret of [basis, "same_character_subjective_inference",
      "speaker_authored_supports", "cognition.known", "cognition.uncertain",
      "semantic_entailment_verified", "我很依戀 B"])
      assert.equal(serialized.includes(secret), false, `Private inference provenance leaked: ${secret}`);
  }
});

test("CC-2 inference cannot obtain premise from raw world, hidden memory or another character", () => {
  const conclusion = "B 可能還想繼續看書";
  const input = packet(goal("direct", {
    public_content: conclusion, claim_kind: "uncertain_hypothesis",
    claim_source_kind: "subjective_inference",
    inference_intent: {
      conclusion, premise_content: basis,
      premise_epistemic_status: "known", premise_relation: "supports",
    },
  }), [], [basis]);
  input.world_state = { hidden_fact: basis };
  input.recovered_memories = [{ content: basis }];
  input.cognition.working_context = { focus: { content: basis,
    context_origin: "recovered_memory" } };
  input.perception = { audible: [basis] };
  input.other_character_cognition = { known: [basis] };
  const plan = planCharacterCommunication(input);
  assert.equal(plan.external_action, "none");
  assert.equal(plan.blocked_reason, "inference_premise_not_in_same_character_accessible_cognition");
  assert.equal(buildCharacterCommunicationActionCandidate(input), null);
});

test("CC-2 inferred claims require authored matching conclusion, premise and source contract", () => {
  const conclusion = "B 可能還想繼續看書";
  const intent = {
    conclusion, premise_content: basis,
    premise_epistemic_status: "known", premise_relation: "supports",
  };
  for (const invalid of [
    { conclusion: "不同結論" }, { premise_content: "" },
    { premise_epistemic_status: "retrieved_memory" },
    { premise_relation: "entails" },
  ]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: conclusion, claim_kind: "uncertain_hypothesis",
      claim_source_kind: "subjective_inference",
      inference_intent: { ...intent, ...invalid },
    }), [basis], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
  for (const claim_kind of [null, "sincere_assertion", "deliberate_deception"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: conclusion, claim_kind, claim_source_kind: "subjective_inference",
      inference_intent: intent,
    }), [basis], [])), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
});

test("silence emits no message even with a compatible known basis", () => {
  const value = planCharacterCommunication(packet(goal("silence")));
  assert.equal(value.external_action, "none");
  assert.equal(value.message, null);
});

test("unknown pretext cannot be fabricated", () => {
  const value = planCharacterCommunication(packet(goal("indirect"), []));
  assert.equal(value.external_action, "none");
  assert.equal(value.blocked_reason, "basis_not_in_same_character_accessible_cognition");
});

test("speaker uncertainty is preserved rather than promoted to fact", () => {
  const value = planCharacterCommunication(packet(goal("indirect"), [], [basis]));
  assert.equal(value.message.epistemic_status, "character_uncertain");
  assert.equal(value.message.source, "cognition.uncertain[0]");
});

test("same shared planner works for other identities, cannot read A's goal as B", () => {
  assert.throws(() => planCharacterCommunication({
    character: "B",
    cognition: { known: [basis], communication_goal: goal("indirect") },
  }), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  const b = planCharacterCommunication({
    character: "B",
    cognition: {
      known: ["A 的畫還沒畫完"],
      communication_goal: {
        character: "B", addressee: "A", purpose: "希望 A 留下",
        mode: "indirect", basis_claim: "A 的畫還沒畫完",
      },
    },
  });
  assert.equal(b.message.source, "cognition.known[0]");
  assert.equal(b.character, "B");
});

test("communication action candidate exposes only public message semantics", () => {
  const candidate = buildCharacterCommunicationActionCandidate(packet(goal("indirect")));
  assert.ok(candidate.action_id.startsWith("communication_"));
  assert.equal(candidate.communication.channel, "speech");
  assert.equal(candidate.communication.addressee, "B");
  assert.equal(candidate.communication.message.semantic_content, basis);
  assert.equal(candidate.communication.message.epistemic_status, "character_known");
  assert.equal(Object.hasOwn(candidate.communication.message, "source"), false);
  assert.equal(Object.hasOwn(candidate.communication.message, "intended_pragmatic_effect"), false);
  const serialized = JSON.stringify(candidate);
  assert.equal(serialized.includes("我很依戀 B"), false);
  assert.equal(serialized.includes("希望 B 留下"), false);
});

test("native Character Brain input carries only non-binding communication projection", () => {
  const p = buildWorldSimulationCharacterBrainInput(packet(goal("indirect")));
  assert.equal(p.communication_foundation.message.semantic_content, basis);
  assert.equal(p.boundaries.communication_foundation_action_authority, false);
  assert.equal(p.boundaries.communication_foundation_world_truth_authority, false);
  assert.equal(p.candidate_action_intents.length, 0);
});
