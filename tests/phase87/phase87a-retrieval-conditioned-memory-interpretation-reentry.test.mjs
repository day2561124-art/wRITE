import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryContract,
  projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry,
  worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries,
} from "../../server/src/world-simulation-retrieval-conditioned-memory-interpretation-reentry-service.mjs";
import { fixture } from "../phase85/phase85-memory-interpretation-fixture.mjs";

function retrievalEvent({ id, character = "Alice", turnId, memoryId, recovered = true }) {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: id,
    retrieval_process_id: `${id}-process`,
    retrieval_process_version: "phase64a-memory-retrieval-process-v3",
    retrieval_process_hash: hashAgentRunValue({ id, character, turnId, memoryId }),
    character,
    turn_id: turnId,
    occurred_at: null,
    occurred_at_precision: "turn_context",
    initiation: null,
    retrieval_task: null,
    target: recovered ? { memory_id: memoryId } : null,
    search_orientation: null,
    search_steps: [],
    recovered_content: recovered ? [{ fragment_id: `${id}-fragment`, source_memory_ref: memoryId }] : [],
    recovery_occurrences: [],
    memory_recoveries: recovered ? [{
      memory_recovery_id: `${id}-recovery`,
      source_memory_ref: memoryId,
      recovered_fragment_ids: [`${id}-fragment`],
      recovery_occurrence_ids: [],
      recovery_extent: "partial_content",
      target_relation: "target",
    }] : [],
    target_outcome: recovered ? "recovered" : "failed",
    recovered_any_content: recovered,
    termination: null,
    engine_audit: {
      control_annotations: [],
      control_reason_is_subjective_character_thought: false,
      counterfactual_reinstatement_options_persisted: false,
      same_cycle_phase63b_feedback_used: false,
      strengthening_applied: false,
      competitor_weakening_applied: false,
      confidence_rewritten: false,
      memory_content_rewritten: false,
      reconsolidation_applied: false,
    },
    immutable: true,
  };
  return { ...body, retrieval_event_hash: hashAgentRunValue(body) };
}

function withCurrentRetrieval(world, event) {
  const next = structuredClone(world);
  next.retrieval_events = { ...(next.retrieval_events ?? {}), [event.retrieval_event_id]: structuredClone(event) };
  return next;
}

const base = fixture();
const current = retrievalEvent({ id: "phase87a-current", turnId: "later", memoryId: "Aliceold" });
const world = withCurrentRetrieval(base, current);
const input = { world_state: world, character: "Alice", current_turn_id: "later", retrieval_event: current };
const before = hashAgentRunValue(input);
const result = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry(input);
assert.equal(hashAgentRunValue(input), before, "Phase87A must not mutate caller input.");
assert.equal(result.phase, "Phase87A");
assert.deepEqual(result.interpretations, [{
  prior_interpretation: "Alice believed the door was usually open.",
  later_interpretation: "Alice now suspects access is restricted 0",
  relation: "challenges",
  retrieval_conditioned: true,
  subjective_not_world_truth: true,
  original_memory_preserved: true,
  belief_adoption_implied: false,
}]);
assert.equal(result.audit.current_retrieval_event_canonical, true);
assert.equal(result.audit.recovered_memory_identity_matched_engine_side, true);
assert.equal(result.audit.canonical_memory_content_rewritten, false);
assert.equal(result.audit.storage_strength_mutated, false);
assert.equal(result.audit.retrieval_strength_mutated, false);
assert.equal(result.audit.retrieval_success_forced, false);
assert.equal(Object.isFrozen(result.interpretations[0]), true);
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry(JSON.parse(JSON.stringify(input))), result);

for (const forbidden of [
  "memory_id", "source_memory_ref", "retrieval_event_id", "retrieval_event_hash",
  "claim_event_id", "relation_event_id", "projection_hash", "confidence", "probability",
]) {
  assert.equal(JSON.stringify(result.interpretations).includes(forbidden), false, `${forbidden} must stay engine-side.`);
}

const unrelated = retrievalEvent({ id: "phase87a-unrelated", turnId: "later-2", memoryId: "Alicenew0" });
const unrelatedWorld = withCurrentRetrieval(base, unrelated);
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: unrelatedWorld, character: "Alice", current_turn_id: "later-2", retrieval_event: unrelated,
}).interpretations, [], "Only the exact successfully recovered memory may re-enter an interpretation.");

const failed = retrievalEvent({ id: "phase87a-failed", turnId: "later-3", memoryId: "Aliceold", recovered: false });
const failedWorld = withCurrentRetrieval(base, failed);
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: failedWorld, character: "Alice", current_turn_id: "later-3", retrieval_event: failed,
}).interpretations, [], "Failed retrieval must not re-enter an interpretation.");

const sameTurn = retrievalEvent({ id: "phase87a-same-turn", turnId: "update", memoryId: "Aliceold" });
const sameTurnWorld = withCurrentRetrieval(base, sameTurn);
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: sameTurnWorld, character: "Alice", current_turn_id: "update", retrieval_event: sameTurn,
}).interpretations, [], "Same-turn interpretation feedback must remain blocked.");

const bob = retrievalEvent({ id: "phase87a-bob", character: "Bob", turnId: "later", memoryId: "Aliceold" });
const bobWorld = withCurrentRetrieval(base, bob);
assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: bobWorld, character: "Alice", current_turn_id: "later", retrieval_event: bob,
}), error => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_INVALID");

const tampered = structuredClone(current);
tampered.memory_recoveries[0].source_memory_ref = "forged";
assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: world, character: "Alice", current_turn_id: "later", retrieval_event: tampered,
}), error => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_HASH_MISMATCH");

const notCanonical = structuredClone(world);
notCanonical.retrieval_events[current.retrieval_event_id] = structuredClone(current);
notCanonical.retrieval_events[current.retrieval_event_id].target_outcome = "forged";
assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: notCanonical, character: "Alice", current_turn_id: "later", retrieval_event: current,
}), error => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_NOT_CANONICAL");

const corruptedHistory = structuredClone(world);
corruptedHistory.memory_reconsolidation_interpretation_update_history[0].memory_id = "forged";
assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: corruptedHistory, character: "Alice", current_turn_id: "later", retrieval_event: current,
}), error => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_REFERENCE_MISMATCH");

const manyBase = fixture("Alice", 10);
const manyEvent = retrievalEvent({ id: "phase87a-many", turnId: "later", memoryId: "Aliceold" });
const manyWorld = withCurrentRetrieval(manyBase, manyEvent);
const many = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: manyWorld, character: "Alice", current_turn_id: "later", retrieval_event: manyEvent,
});
assert.equal(many.interpretations.length, worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries);
assert.equal(many.truncated, true);
// Phase85B canonicalizes relation IDs; fixture insertion order is not event order.
const canonicalRelations = manyBase.memory_reconsolidation_interpretation_update_events[
  manyBase.memory_reconsolidation_interpretation_update_history.at(-1).interpretation_update_event_id
].conflict_relation_event_ids;
assert.deepEqual(
  many.interpretations.map((item) => item.later_interpretation),
  canonicalRelations.slice(-worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries)
    .map((id) => manyBase.subjective_claim_events[
      manyBase.subjective_claim_relation_events[id].source_claim_event_id
    ].proposition),
);

function rehashRetrieval(event) {
  delete event.retrieval_event_hash;
  event.retrieval_event_hash = hashAgentRunValue(event);
  return event;
}

for (const mutate of [
  (event) => { event.recovered_content = []; },
  (event) => { event.recovered_content[0].source_memory_ref = "Alicenew0"; },
  (event) => { event.memory_recoveries[0].recovered_fragment_ids = ["missing-fragment"]; },
  (event) => { event.memory_recoveries[0].recovered_fragment_ids = []; },
]) {
  const detached = structuredClone(current);
  mutate(detached);
  rehashRetrieval(detached);
  assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
    world_state: withCurrentRetrieval(base, detached),
    character: "Alice", current_turn_id: "later", retrieval_event: detached,
  }), error => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_MEMORY_RECOVERY_INVALID",
  "Successful recovery must resolve real fragments of the exact memory, even with a valid event hash.");
}

// A failed target can still recover another memory: only actual recovery matters.
const nonTarget = rehashRetrieval({
  ...structuredClone(current),
  target: { memory_id: "Alicenew0" },
  target_outcome: "failed",
});
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  ...input, world_state: withCurrentRetrieval(base, nonTarget), retrieval_event: nonTarget,
}).interpretations, result.interpretations);

assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: bobWorld, character: "Bob", current_turn_id: "later", retrieval_event: bob,
}).interpretations, [], "Another character's interpretation must not enter Bob's cognition.");

const uncommitted = structuredClone(world);
uncommitted.memory_reconsolidation_interpretation_update_history = [];
assert.throws(() => projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  ...input, world_state: uncommitted,
}), error => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_INCOMPLETE");

const repeated = structuredClone(current);
repeated.memory_recoveries.push(structuredClone(repeated.memory_recoveries[0]));
rehashRetrieval(repeated);
assert.deepEqual(projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  ...input, world_state: withCurrentRetrieval(base, repeated), retrieval_event: repeated,
}).interpretations, result.interpretations, "Repeated recovery cannot add interpretation credibility.");

const contract = buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryContract();
assert.equal(contract.phase, "Phase87A");
assert.equal(contract.canonical_current_retrieval_event_required, true);
assert.equal(contract.current_successful_recovery_required, true);
assert.equal(contract.exact_recovered_memory_identity_required, true);
assert.equal(contract.prior_committed_phase85c_interpretation_required, true);
assert.equal(contract.same_turn_reentry_allowed, false);
assert.equal(contract.character_scope_isolated, true);
assert.equal(contract.character_view_sanitized, true);
assert.equal(contract.engine_event_identity_exposed_to_character, false);
assert.equal(contract.memory_identity_exposed_to_character, false);
assert.equal(contract.canonical_memory_content_rewritten, false);
assert.equal(contract.storage_strength_mutation_allowed, false);
assert.equal(contract.retrieval_strength_mutation_allowed, false);
assert.equal(contract.retrieval_success_forced, false);
assert.equal(contract.biological_reconsolidation_claimed, false);
assert.equal(contract.native_loop_adoption_installed, false);

console.log("Phase87A retrieval-conditioned memory interpretation re-entry: PASS");
