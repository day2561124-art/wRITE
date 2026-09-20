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

test("CC-2 unknown or deceptive claim kinds cannot bypass a character-side provenance gate", () => {
  for (const claim_kind of ["deliberate_deception", "generator_hallucination", "unknown"]) {
    assert.throws(() => planCharacterCommunication(packet(goal("direct", {
      public_content: basis, claim_kind,
    }))), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  }
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
