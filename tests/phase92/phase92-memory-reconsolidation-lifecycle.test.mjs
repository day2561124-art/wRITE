import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { fixture } from "../phase85/phase85-memory-interpretation-fixture.mjs";
import {
  buildWorldSimulationAdaptiveMemoryConsolidation,
} from "../../server/src/world-simulation-adaptive-memory-consolidation-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationLifecycle,
  buildWorldSimulationMemoryReconsolidationLifecycleContract,
  projectWorldSimulationEffectiveMemoryReconsolidationStates,
} from "../../server/src/world-simulation-memory-reconsolidation-lifecycle-service.mjs";
import {
  projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry,
} from "../../server/src/world-simulation-retrieval-conditioned-memory-interpretation-reentry-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeConsolidatedPhase85World() {
  const world = fixture();
  const memory = world.memories.Alice.find((item) => item.memory_id === "Aliceold");
  memory.relevance = true;
  memory.encoded_at = "2026-09-14T08:00:00.000Z";

  const pass1 = buildWorldSimulationAdaptiveMemoryConsolidation({
    world_state: world,
    world_history: { turns: [] },
    current_turn_id: "phase92-consolidation-1",
    current_time: "2026-09-14T09:00:00.000Z",
  });
  const pass2 = buildWorldSimulationAdaptiveMemoryConsolidation({
    world_state: pass1.result.preview_world_state,
    world_history: { turns: [] },
    current_turn_id: "phase92-consolidation-2",
    current_time: "2026-09-14T10:00:00.000Z",
  });
  return pass2.result.preview_world_state;
}

function retrievalEvent({ id, turnId, memoryId }) {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: id,
    retrieval_process_id: `${id}-process`,
    retrieval_process_version: "phase64a-memory-retrieval-process-v3",
    retrieval_process_hash: hashAgentRunValue({ id, turnId, memoryId }),
    character: "Alice",
    turn_id: turnId,
    occurred_at: null,
    occurred_at_precision: "turn_context",
    initiation: null,
    retrieval_task: null,
    target: { memory_id: memoryId },
    search_orientation: null,
    search_steps: [],
    recovered_content: [{ fragment_id: `${id}-fragment`, source_memory_ref: memoryId }],
    recovery_occurrences: [],
    memory_recoveries: [{
      memory_recovery_id: `${id}-recovery`,
      source_memory_ref: memoryId,
      recovered_fragment_ids: [`${id}-fragment`],
      recovery_occurrence_ids: [],
      recovery_extent: "partial_content",
      target_relation: "target",
    }],
    target_outcome: "recovered",
    recovered_any_content: true,
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

function withRetrieval(world, event) {
  const next = clone(world);
  next.retrieval_events = { ...(next.retrieval_events ?? {}), [event.retrieval_event_id]: clone(event) };
  return next;
}

const contract = buildWorldSimulationMemoryReconsolidationLifecycleContract();
assert.equal(contract.phase, "Phase92");
assert.deepEqual(contract.lifecycle_states, [
  "consolidated_stable",
  "destabilized_for_update",
  "restabilized_with_update",
]);
assert.equal(contract.effective_phase91_consolidated_memory_required, true);
assert.equal(contract.canonical_phase85c_update_evidence_required, true);
assert.equal(contract.retrieval_alone_can_destabilize, false);
assert.equal(contract.same_turn_destabilize_and_restabilize_allowed, false);
assert.equal(contract.fixed_elapsed_duration_threshold_modeled, false);
assert.equal(contract.original_memory_trace_preserved, true);
assert.equal(contract.canonical_memory_content_rewrite_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);

// A Phase85C interpretation on an unconsolidated memory must not start Phase92.
const unconsolidated = fixture();
const unconsolidatedPass = buildWorldSimulationMemoryReconsolidationLifecycle({
  world_state: unconsolidated,
  current_turn_id: "phase92-unconsolidated",
});
assert.equal(unconsolidatedPass.result.lifecycle_events_created.length, 0);

const consolidated = makeConsolidatedPhase85World();
const originalMemory = clone(consolidated.memories.Alice.find((item) => item.memory_id === "Aliceold"));

// First eligible turn destabilizes only.
const destabilized = buildWorldSimulationMemoryReconsolidationLifecycle({
  world_state: consolidated,
  current_turn_id: "phase92-update-turn",
});
assert.equal(destabilized.result.lifecycle_events_created.length, 1);
assert.equal(destabilized.result.lifecycle_events_created[0].from_state, "consolidated_stable");
assert.equal(destabilized.result.lifecycle_events_created[0].to_state, "destabilized_for_update");
assert.equal(destabilized.result.audit.same_turn_destabilize_and_restabilize_count, 0);
assert.equal(destabilized.result.lifecycle_events_created[0].boundaries.future_retrieval_effect_available, false);
const firstHistoryTransition = destabilized.result.state_transitions.find(
  (transition) => transition.field === "memory_reconsolidation_lifecycle_history",
);
assert.ok(firstHistoryTransition);
assert.equal(firstHistoryTransition.from, null);
assert.deepEqual(
  destabilized.result.preview_world_state.memories.Alice.find((item) => item.memory_id === "Aliceold").content,
  originalMemory.content,
);
assert.equal(
  destabilized.result.preview_world_state.memories.Alice.find((item) => item.memory_id === "Aliceold").formation_stage,
  originalMemory.formation_stage,
);

// Re-running the same committed turn cannot restabilize the cycle.
const sameTurn = buildWorldSimulationMemoryReconsolidationLifecycle({
  world_state: destabilized.result.preview_world_state,
  current_turn_id: "phase92-update-turn",
});
assert.equal(sameTurn.result.lifecycle_events_created.length, 0);

// A later turn closes the lifecycle and enables future retrieval effect.
const restabilized = buildWorldSimulationMemoryReconsolidationLifecycle({
  world_state: destabilized.result.preview_world_state,
  current_turn_id: "phase92-restabilize-turn",
});
assert.equal(restabilized.result.lifecycle_events_created.length, 1);
assert.equal(restabilized.result.lifecycle_events_created[0].from_state, "destabilized_for_update");
assert.equal(restabilized.result.lifecycle_events_created[0].to_state, "restabilized_with_update");
assert.equal(restabilized.result.lifecycle_events_created[0].boundaries.future_retrieval_effect_available, true);

const effective = projectWorldSimulationEffectiveMemoryReconsolidationStates({
  world_state: restabilized.result.preview_world_state,
});
const tracked = effective.interpretation_update_states.find((entry) => entry.memory_id === "Aliceold");
assert.equal(tracked.lifecycle_state, "restabilized_with_update");
assert.equal(tracked.future_retrieval_effect_available, true);

// A hash-valid lifecycle event cannot forge which Phase91 consolidation evidence authorized it.
const forgedPhase91Lineage = clone(restabilized.result.preview_world_state);
const forgedLifecycleRef = forgedPhase91Lineage.memory_reconsolidation_lifecycle_history[0];
const forgedLifecycleEvent = forgedPhase91Lineage.memory_reconsolidation_lifecycle_events[
  forgedLifecycleRef.lifecycle_event_id
];
forgedLifecycleEvent.source_consolidation_reference = {
  ...forgedLifecycleEvent.source_consolidation_reference,
  current_turn_id: "forged-phase91-turn",
};
delete forgedLifecycleEvent.lifecycle_event_hash;
const forgedLifecycleBody = clone(forgedLifecycleEvent);
delete forgedLifecycleBody.lifecycle_event_id;
forgedLifecycleEvent.lifecycle_event_hash = hashAgentRunValue(forgedLifecycleBody);
forgedLifecycleRef.lifecycle_event_hash = forgedLifecycleEvent.lifecycle_event_hash;
assert.throws(
  () => projectWorldSimulationEffectiveMemoryReconsolidationStates({
    world_state: forgedPhase91Lineage,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_PHASE91_LINEAGE_INVALID",
);

// Phase87 must block the interpretation while destabilized and allow it after restabilization.
const blockedRetrieval = retrievalEvent({
  id: "phase92-blocked-retrieval",
  turnId: "phase92-retrieval-blocked",
  memoryId: "Aliceold",
});
const blockedWorld = withRetrieval(destabilized.result.preview_world_state, blockedRetrieval);
const blockedProjection = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: blockedWorld,
  character: "Alice",
  current_turn_id: blockedRetrieval.turn_id,
  retrieval_event: blockedRetrieval,
});
assert.deepEqual(blockedProjection.interpretations, []);

const allowedRetrieval = retrievalEvent({
  id: "phase92-allowed-retrieval",
  turnId: "phase92-retrieval-allowed",
  memoryId: "Aliceold",
});
const allowedWorld = withRetrieval(restabilized.result.preview_world_state, allowedRetrieval);
const allowedProjection = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: allowedWorld,
  character: "Alice",
  current_turn_id: allowedRetrieval.turn_id,
  retrieval_event: allowedRetrieval,
});
assert.equal(allowedProjection.interpretations.length, 1);
assert.equal(allowedProjection.interpretations[0].later_interpretation, "Alice now suspects access is restricted 0");

// Legacy Phase85C worlds without Phase92 lifecycle retain sealed Phase87 behavior.
const legacy = fixture();
const legacyRetrieval = retrievalEvent({
  id: "phase92-legacy-retrieval",
  turnId: "phase92-legacy-turn",
  memoryId: "Aliceold",
});
const legacyProjection = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
  world_state: withRetrieval(legacy, legacyRetrieval),
  character: "Alice",
  current_turn_id: legacyRetrieval.turn_id,
  retrieval_event: legacyRetrieval,
});
assert.equal(legacyProjection.interpretations.length, 1);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const interpretationIndex = loopSource.indexOf("const memoryInterpretationMutationExecution");
const lifecycleIndex = loopSource.indexOf("const memoryReconsolidationLifecycle =");
const beliefIndex = loopSource.indexOf("const subjectiveBeliefResolution");
assert.ok(interpretationIndex >= 0 && lifecycleIndex > interpretationIndex && beliefIndex > lifecycleIndex);
assert.match(loopSource, /memory_reconsolidation_lifecycle_mutation_execution/);
assert.match(loopSource, /memoryReconsolidationLifecycleMutationExecution\.next_world_state/);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(stateSource, /memory_reconsolidation_lifecycle:/);
assert.match(stateSource, /memory_reconsolidation_lifecycle_mutation_queue:/);
assert.match(stateSource, /memory_reconsolidation_lifecycle_mutation_execution:/);

console.log("Phase92 memory reconsolidation lifecycle closure: PASS");
