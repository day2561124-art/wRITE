import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationAdaptiveMemoryConsolidation,
  buildWorldSimulationAdaptiveMemoryConsolidationContract,
  projectWorldSimulationEffectiveMemoryConsolidationStates,
  worldSimulationAdaptiveMemoryConsolidationVersion,
} from "../../server/src/world-simulation-adaptive-memory-consolidation-service.mjs";

const character = "千夜";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function memoryRecord({
  memoryId,
  sourceTurn = "phase91-source-turn",
  encodedAt = "2026-09-14T08:00:00.000Z",
  relevance = false,
  sourcePerceptionRef = null,
} = {}) {
  return {
    memory_id: memoryId,
    memory_type: "episodic",
    content: { kind: "phase91-test-memory", memory_id: memoryId },
    source: { kind: "direct_perception", sense: "visual" },
    internal_provenance: {
      turn_id: sourceTurn,
      observation_hash: `observation-${memoryId}`,
      ...(sourcePerceptionRef
        ? { post_outcome_subjective_perception_ref: sourcePerceptionRef }
        : {}),
    },
    encoded_at: encodedAt,
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    relevance,
    subjective_memory_not_world_truth: true,
  };
}

function worldStateWith(memory) {
  return {
    simulation_time: "2026-09-14T09:00:00.000Z",
    memories: { [character]: [clone(memory)] },
  };
}

function affectiveRecord({
  sourceTurn = "phase91-source-turn",
  sourcePerceptionRef = "phase91-subjective-perception",
  goalCongruence,
}) {
  const goal = "protect-self";
  const concern = {
    concern_ref: `concern_${hashAgentRunValue({
      turn: sourceTurn,
      character,
      goal,
      index: 0,
    }).slice(0, 24)}`,
    goal,
  };
  const contextBody = {
    character,
    turn_id: sourceTurn,
    source_perception_ref: sourcePerceptionRef,
    source_perception_projection_hash: "phase91-source-projection-hash",
    subjective_experience: {
      performed: null,
      perceived_result: "remembered experience",
      perceived_status: null,
    },
    concerns: [concern],
  };
  const contextHash = hashAgentRunValue(contextBody);
  const context = {
    ...contextBody,
    context_hash: contextHash,
    context_ref: `affective_context_${contextHash.slice(0, 24)}`,
  };
  const bundleBody = {
    version: "phase86a-goal-relative-affective-appraisal-v1",
    turn_id: sourceTurn,
    contexts: [context],
  };
  const contextBundle = {
    ...bundleBody,
    bundle_hash: hashAgentRunValue(bundleBody),
  };
  const appraisal = {
    character,
    source_perception_ref: sourcePerceptionRef,
    appraisal_hash: hashAgentRunValue({
      sourceTurn,
      sourcePerceptionRef,
      goal,
      goalCongruence,
    }),
    goal,
    goal_congruence: goalCongruence,
    expectedness: "unexpected",
    coping_potential: "uncertain",
  };
  const projectionBody = {
    turn_id: sourceTurn,
    source_bundle_hash: contextBundle.bundle_hash,
    appraisals: [appraisal],
  };
  return {
    context_bundle: contextBundle,
    projection: {
      ...projectionBody,
      projection_hash: hashAgentRunValue(projectionBody),
    },
  };
}

const contract = buildWorldSimulationAdaptiveMemoryConsolidationContract();
assert.equal(contract.phase, "Phase91");
assert.equal(contract.version, worldSimulationAdaptiveMemoryConsolidationVersion);
assert.deepEqual(contract.stages, [
  "encoded_unconsolidated",
  "stabilizing",
  "consolidated",
]);
assert.equal(contract.same_turn_new_memory_transition_allowed, false);
assert.equal(contract.one_stage_transition_per_memory_per_turn, true);
assert.equal(contract.time_alone_can_establish_consolidated, false);
assert.equal(contract.retrieval_practice_can_support_consolidation, true);
assert.equal(contract.bounded_affective_significance_can_support_consolidation, true);
assert.equal(contract.unrelated_or_uncertain_appraisal_is_consolidation_evidence, false);
assert.equal(contract.sleep_required, false);
assert.equal(contract.numeric_consolidation_strength_modeled, false);
assert.equal(contract.consolidated_means_world_truth, false);
assert.equal(contract.consolidated_guarantees_recall, false);
assert.equal(contract.reconsolidation_performed, false);

// Temporal separation starts stabilization, but elapsed time alone cannot finish consolidation.
const timeOnlyMemory = memoryRecord({ memoryId: "memory-phase91-time-only" });
const timeOnlyInitial = worldStateWith(timeOnlyMemory);
const firstTimeOnlyPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: timeOnlyInitial,
  world_history: { turns: [] },
  current_turn_id: "phase91-turn-2",
  current_time: "2026-09-14T09:00:00.000Z",
});
assert.equal(firstTimeOnlyPass.result.consolidation_events_created.length, 1);
assert.equal(firstTimeOnlyPass.result.consolidation_events_created[0].from_stage, "encoded_unconsolidated");
assert.equal(firstTimeOnlyPass.result.consolidation_events_created[0].to_stage, "stabilizing");
assert.equal(firstTimeOnlyPass.result.consolidation_events_created[0].evidence.length, 1);
assert.equal(firstTimeOnlyPass.result.consolidation_events_created[0].evidence[0].kind, "prior_committed_temporal_separation");
const firstHistoryTransition = firstTimeOnlyPass.result.state_transitions.find(
  (transition) => transition.field === "memory_consolidation_history",
);
assert.ok(firstHistoryTransition);
assert.equal(
  firstHistoryTransition.from,
  null,
  "legacy world states without memory_consolidation_history must preserve null as the authoritative precondition",
);
assert.deepEqual(
  firstTimeOnlyPass.result.preview_world_state.memories[character][0].content,
  timeOnlyMemory.content,
  "consolidation must not rewrite remembered content",
);

const secondTimeOnlyPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: firstTimeOnlyPass.result.preview_world_state,
  world_history: { turns: [] },
  current_turn_id: "phase91-turn-3",
  current_time: "2026-09-14T10:00:00.000Z",
});
assert.equal(secondTimeOnlyPass.result.consolidation_events_created.length, 0);
assert.equal(
  secondTimeOnlyPass.result.effective_states[0].effective_consolidation_stage,
  "stabilizing",
  "time alone must not promote a stabilizing memory to consolidated",
);

// Explicit relevance supports later consolidation, but one turn may advance only one stage.
const relevantMemory = memoryRecord({
  memoryId: "memory-phase91-relevant",
  relevance: true,
});
const relevantFirstPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: worldStateWith(relevantMemory),
  world_history: { turns: [] },
  current_turn_id: "phase91-relevant-turn-2",
  current_time: "2026-09-14T09:00:00.000Z",
});
assert.equal(relevantFirstPass.result.consolidation_events_created.length, 1);
assert.equal(relevantFirstPass.result.consolidation_events_created[0].to_stage, "stabilizing");
assert.ok(
  relevantFirstPass.result.consolidation_events_created[0].evidence
    .some((entry) => entry.kind === "explicit_memory_relevance"),
);
const relevantSecondPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: relevantFirstPass.result.preview_world_state,
  world_history: { turns: [] },
  current_turn_id: "phase91-relevant-turn-3",
  current_time: "2026-09-14T10:00:00.000Z",
});
assert.equal(relevantSecondPass.result.consolidation_events_created.length, 1);
assert.equal(relevantSecondPass.result.consolidation_events_created[0].from_stage, "stabilizing");
assert.equal(relevantSecondPass.result.consolidation_events_created[0].to_stage, "consolidated");

// Same-turn newly encoded traces cannot enter the consolidation lifecycle immediately.
const sameTurnMemory = memoryRecord({
  memoryId: "memory-phase91-same-turn",
  sourceTurn: "phase91-same-turn",
  encodedAt: "2026-09-14T09:00:00.000Z",
  relevance: true,
});
const sameTurnPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: worldStateWith(sameTurnMemory),
  world_history: { turns: [] },
  current_turn_id: "phase91-same-turn",
  current_time: "2026-09-14T09:00:00.000Z",
});
assert.equal(sameTurnPass.result.consolidation_events_created.length, 0);
assert.equal(
  sameTurnPass.result.effective_states[0].effective_consolidation_stage,
  "encoded_unconsolidated",
);

// An appraisal must carry bounded goal significance; unrelated appraisal alone is insufficient.
const affectiveSourceRef = "phase91-subjective-perception";
const affectiveMemory = memoryRecord({
  memoryId: "memory-phase91-affective",
  sourceTurn: "phase91-source-turn",
  sourcePerceptionRef: affectiveSourceRef,
});
const affectiveFirstPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: worldStateWith(affectiveMemory),
  world_history: {
    turns: [{
      turn_id: "phase91-source-turn",
      affective_appraisal_record: affectiveRecord({
        sourcePerceptionRef: affectiveSourceRef,
        goalCongruence: "unrelated",
      }),
    }],
  },
  current_turn_id: "phase91-affective-turn-2",
  current_time: "2026-09-14T09:00:00.000Z",
});
assert.equal(affectiveFirstPass.result.consolidation_events_created[0].to_stage, "stabilizing");
assert.equal(
  affectiveFirstPass.result.consolidation_events_created[0].evidence
    .some((entry) => entry.kind === "bounded_affective_significance"),
  false,
);
const unrelatedSecondPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: affectiveFirstPass.result.preview_world_state,
  world_history: {
    turns: [{
      turn_id: "phase91-source-turn",
      affective_appraisal_record: affectiveRecord({
        sourcePerceptionRef: affectiveSourceRef,
        goalCongruence: "unrelated",
      }),
    }],
  },
  current_turn_id: "phase91-affective-turn-3-unrelated",
  current_time: "2026-09-14T10:00:00.000Z",
});
assert.equal(unrelatedSecondPass.result.consolidation_events_created.length, 0);

const significantSecondPass = buildWorldSimulationAdaptiveMemoryConsolidation({
  world_state: affectiveFirstPass.result.preview_world_state,
  world_history: {
    turns: [{
      turn_id: "phase91-source-turn",
      affective_appraisal_record: affectiveRecord({
        sourcePerceptionRef: affectiveSourceRef,
        goalCongruence: "hinders",
      }),
    }],
  },
  current_turn_id: "phase91-affective-turn-3-significant",
  current_time: "2026-09-14T10:00:00.000Z",
});
assert.equal(significantSecondPass.result.consolidation_events_created.length, 1);
assert.equal(significantSecondPass.result.consolidation_events_created[0].to_stage, "consolidated");
assert.ok(
  significantSecondPass.result.consolidation_events_created[0].evidence
    .some((entry) => entry.kind === "bounded_affective_significance"
      && entry.goal_congruence === "hinders"),
);

const projected = projectWorldSimulationEffectiveMemoryConsolidationStates({
  world_state: relevantSecondPass.result.preview_world_state,
});
assert.equal(projected.states[0].effective_consolidation_stage, "consolidated");
assert.equal(projected.boundaries.memory_content_rewritten, false);
assert.equal(projected.boundaries.world_truth_authority, false);

// Native-loop adoption must occur after retrieval plasticity and before current-turn formation.
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const plasticityIndex = loopSource.indexOf("const plasticityPersistedWorldState");
const consolidationIndex = loopSource.indexOf("const adaptiveMemoryConsolidation =");
const formationIndex = loopSource.indexOf("const subjectiveMemoryFormation =");
assert.ok(plasticityIndex >= 0 && consolidationIndex > plasticityIndex);
assert.ok(formationIndex > consolidationIndex);
assert.match(loopSource, /world_state:\s*\r?\n\s*consolidationPersistedWorldState/);
assert.match(loopSource, /adaptive_memory_consolidation_mutation_execution/);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(stateSource, /adaptive_memory_consolidation:/);
assert.match(stateSource, /adaptive_memory_consolidation_mutation_queue:/);
assert.match(stateSource, /adaptive_memory_consolidation_mutation_execution:/);

console.log("Phase91 adaptive memory consolidation lifecycle: PASS");
