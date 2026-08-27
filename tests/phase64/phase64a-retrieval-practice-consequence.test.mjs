import assert from "node:assert/strict";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";

import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";

import {
  memoryRetrievalEventSchemaVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";

import {
  buildWorldSimulationMemoryPlasticity,
  buildWorldSimulationMemoryPlasticityContract,
  memoryPlasticityEventSchemaVersion,
  memoryPlasticityHistoryReferenceSchemaVersion,
  memoryPlasticityModelProfileHash,
  worldSimulationMemoryPlasticityVersion,
} from "../../server/src/world-simulation-memory-plasticity-service.mjs";

function canonicalRetrievalEvent({
  id,
  targetOutcome,
  memoryRecoveries,
  contactedMemoryRefs = [],
  character = "phase64a-r1-observer",
}) {
  const body = {
    schema_version:
      memoryRetrievalEventSchemaVersion,
    retrieval_event_id:
      id,
    retrieval_process_id:
      `process_${id}`,
    retrieval_process_version:
      "phase63c-memory-retrieval-process-v3",
    retrieval_process_hash:
      hashAgentRunValue({ id, kind: "fixture_process" }),
    character,
    turn_id:
      `turn_${id}`,
    occurred_at:
      "2026-08-27T15:30:00+08:00",
    occurred_at_precision:
      "turn_context",
    initiation: {
      mode: "deliberate",
      trigger_origin: "self_generated",
    },
    retrieval_task: {
      mode: "cued_recall",
    },
    target: {
      kind: "memory_ref",
      memory_id: "memory_target",
    },
    search_steps: [
      {
        step_index: 0,
        frontier_evidence: {
          frontier_id: `frontier_${id}`,
          active_cue_hash: `cue_hash_${id}`,
          candidate_set_hash: `candidate_hash_${id}`,
          candidate_count: contactedMemoryRefs.length,
        },
        contacted_memory_refs:
          contactedMemoryRefs,
        recovered_fragment_ids:
          memoryRecoveries.flatMap(
            (recovery) => recovery.recovered_fragment_ids,
          ),
        recovery_occurrence_ids:
          memoryRecoveries.flatMap(
            (recovery) => recovery.recovery_occurrence_ids,
          ),
        selected_reinstated_cues: [],
        step_target_relation: "unresolved",
        cumulative_target_outcome_after_step:
          targetOutcome,
        continuation: {
          control_action: "stop",
        },
        termination_after_step: true,
      },
    ],
    recovered_content: [],
    recovery_occurrences: [],
    memory_recoveries:
      memoryRecoveries,
    target_outcome:
      targetOutcome,
    recovered_any_content:
      memoryRecoveries.length > 0,
    termination: {
      reason: "fixture_stop",
    },
    engine_audit: {
      same_cycle_phase63b_feedback_used: false,
      strengthening_applied: false,
      competitor_weakening_applied: false,
      confidence_rewritten: false,
      memory_content_rewritten: false,
      reconsolidation_applied: false,
    },
    immutable: true,
  };

  return {
    ...body,
    retrieval_event_hash:
      hashAgentRunValue(body),
  };
}

const character =
  "phase64a-r1-observer";

const wholeRecoveryEvent =
  canonicalRetrievalEvent({
    id: "retrieval_whole",
    targetOutcome: "satisfied",
    contactedMemoryRefs: [
      "memory_target",
      "memory_contacted_only",
    ],
    memoryRecoveries: [
      {
        memory_recovery_id:
          "recovery_whole",
        source_memory_ref:
          "memory_target",
        recovered_fragment_ids: [
          "fragment_whole",
        ],
        recovery_occurrence_ids: [
          "occurrence_whole",
        ],
        recovery_extent:
          "whole_content",
        target_relation:
          "target",
      },
    ],
  });

const partialRecoveryEvent =
  canonicalRetrievalEvent({
    id: "retrieval_partial",
    targetOutcome: "partially_satisfied",
    contactedMemoryRefs: [
      "memory_partial",
    ],
    memoryRecoveries: [
      {
        memory_recovery_id:
          "recovery_partial",
        source_memory_ref:
          "memory_partial",
        recovered_fragment_ids: [
          "fragment_partial_a",
          "fragment_partial_b",
        ],
        recovery_occurrence_ids: [
          "occurrence_partial_a",
          "occurrence_partial_b",
        ],
        recovery_extent:
          "partial_content",
        target_relation:
          "target",
      },
    ],
  });

const nonTargetRecoveryEvent =
  canonicalRetrievalEvent({
    id: "retrieval_non_target",
    targetOutcome: "failed",
    contactedMemoryRefs: [
      "memory_target",
      "memory_non_target",
    ],
    memoryRecoveries: [
      {
        memory_recovery_id:
          "recovery_non_target",
        source_memory_ref:
          "memory_non_target",
        recovered_fragment_ids: [
          "fragment_non_target",
        ],
        recovery_occurrence_ids: [
          "occurrence_non_target",
        ],
        recovery_extent:
          "partial_content",
        target_relation:
          "non_target",
      },
    ],
  });

const failedOnlyEvent =
  canonicalRetrievalEvent({
    id: "retrieval_failed_only",
    targetOutcome: "failed",
    contactedMemoryRefs: [
      "memory_target",
      "memory_contacted_only",
    ],
    memoryRecoveries: [],
  });

const initialWorldState = {
  simulation_time:
    "2026-08-27T15:30:00+08:00",
  retrieval_events: {
    [wholeRecoveryEvent.retrieval_event_id]:
      wholeRecoveryEvent,
    [partialRecoveryEvent.retrieval_event_id]:
      partialRecoveryEvent,
    [nonTargetRecoveryEvent.retrieval_event_id]:
      nonTargetRecoveryEvent,
    [failedOnlyEvent.retrieval_event_id]:
      failedOnlyEvent,
  },
  memories: {
    [character]: [
      {
        memory_id: "memory_target",
        content: {
          original: "target content must remain unchanged",
        },
        formation_stage: "encoded_unconsolidated",
        perceptual_certainty_at_encoding: 0.75,
        perceptual_clarity_at_encoding: 0.65,
        source: {
          kind: "direct_perception",
          sense: "visual",
        },
      },
      {
        memory_id: "memory_partial",
        content: {
          original: "partial content must remain unchanged",
        },
      },
      {
        memory_id: "memory_non_target",
        content: {
          original: "non-target content must remain unchanged",
        },
      },
      {
        memory_id: "memory_contacted_only",
        content: {
          original: "contacted-only must not be reinforced",
        },
      },
    ],
  },
};

const contract =
  buildWorldSimulationMemoryPlasticityContract();

assert.equal(
  contract.version,
  "phase64a-retrieval-practice-consequence-v1",
);
assert.equal(
  contract.version,
  worldSimulationMemoryPlasticityVersion,
);
assert.equal(
  contract.model_profile_hash,
  memoryPlasticityModelProfileHash,
);
assert.equal(
  contract.source_retrieval_event_hash_verified,
  true,
);
assert.equal(
  contract.one_plasticity_event_per_retrieval_event,
  true,
);
assert.equal(
  contract.zero_effect_event_persisted_for_processed_retrieval_event,
  true,
);
assert.equal(
  contract.per_memory_recovery_is_single_practice_effect,
  true,
);
assert.equal(
  contract.retrieval_event_batch_order,
  "occurred_at_then_turn_id_then_retrieval_event_id",
);
assert.equal(
  contract.deterministic_batch_order_is_not_same_timestamp_causal_precedence,
  true,
);
assert.equal(
  contract.recovery_occurrence_count_is_practice_count,
  false,
);
assert.equal(
  contract.partial_recovery_scope_preserved,
  true,
);
assert.equal(
  contract.non_target_recovery_registers_practice,
  true,
);
assert.equal(
  contract.contacted_only_candidate_registers_practice,
  false,
);
assert.equal(
  contract.failed_target_attempt_registers_successful_practice,
  false,
);
assert.equal(
  contract.same_source_turn_feedback_allowed,
  false,
);
assert.equal(
  contract.future_accessibility_projection_installed,
  false,
);
assert.equal(
  contract.retrieval_difficulty_modeled,
  false,
);
assert.equal(
  contract.storage_strength_delta_modeled,
  false,
);
assert.equal(
  contract.memory_content_rewrite_allowed,
  false,
);
assert.equal(
  contract.consolidation_modeled,
  false,
);
assert.equal(
  contract.reconsolidation_modeled,
  false,
);
assert.equal(
  contract.native_world_loop_adoption_installed,
  false,
);

const sourceMemorySnapshot =
  structuredClone(
    initialWorldState.memories,
  );

const built =
  buildWorldSimulationMemoryPlasticity({
    world_state:
      initialWorldState,
    retrieval_event_ids: [
      wholeRecoveryEvent.retrieval_event_id,
      partialRecoveryEvent.retrieval_event_id,
      nonTargetRecoveryEvent.retrieval_event_id,
      failedOnlyEvent.retrieval_event_id,
    ],
  });

assert.equal(
  built.version,
  worldSimulationMemoryPlasticityVersion,
);
assert.equal(
  built.result.plasticity_events_created.length,
  4,
);
assert.equal(
  built.result.history_references_appended.length,
  3,
  "whole, partial, and non-target recovery each register one practice reference; failed-only does not",
);
assert.equal(
  built.result.state_transitions.length,
  5,
  "four write-once plasticity events plus one append-only history transition are expected",
);
assert.deepEqual(
  built.result.preview_world_state.memories,
  sourceMemorySnapshot,
  "Phase64A-R1 must not rewrite subjective memory records",
);

const reorderedBuild =
  buildWorldSimulationMemoryPlasticity({
    world_state:
      initialWorldState,
    retrieval_event_ids: [
      failedOnlyEvent.retrieval_event_id,
      nonTargetRecoveryEvent.retrieval_event_id,
      partialRecoveryEvent.retrieval_event_id,
      wholeRecoveryEvent.retrieval_event_id,
    ],
  });

assert.deepEqual(
  reorderedBuild.result.preview_world_state,
  built.result.preview_world_state,
  "the same RetrievalEvent set must produce deterministic Phase64A event/history order regardless of caller array order",
);

for (
  const event
  of built.result.plasticity_events_created
) {
  assert.equal(
    event.schema_version,
    memoryPlasticityEventSchemaVersion,
  );
  assert.equal(event.immutable, true);
  assert.equal(
    typeof event.plasticity_event_hash,
    "string",
  );
  assert.equal(
    event.engine_audit.source_retrieval_event_hash_verified,
    true,
  );
  assert.equal(
    event.engine_audit.same_source_turn_feedback_allowed,
    false,
  );
  assert.equal(
    event.engine_audit.future_accessibility_projection_applied,
    false,
  );
  assert.equal(
    event.engine_audit.retrieval_difficulty_inferred,
    false,
  );
  assert.equal(
    event.engine_audit.storage_strength_delta_modeled,
    false,
  );
  assert.equal(
    event.engine_audit.retrieval_strength_delta_modeled,
    false,
  );
  assert.equal(
    event.engine_audit.memory_content_rewritten,
    false,
  );
  assert.equal(
    event.engine_audit.consolidation_applied,
    false,
  );
  assert.equal(
    event.engine_audit.reconsolidation_applied,
    false,
  );
}

const wholePlasticityEvent =
  built.result.plasticity_events_created
    .find(
      (event) =>
        event.source_retrieval_event_id
        === wholeRecoveryEvent.retrieval_event_id,
    );

assert.ok(wholePlasticityEvent);
assert.equal(
  wholePlasticityEvent.effects.length,
  1,
);
assert.equal(
  wholePlasticityEvent.effects[0]
    .source_memory_ref,
  "memory_target",
);
assert.equal(
  wholePlasticityEvent.effects[0]
    .whole_content_recovered,
  true,
);
assert.equal(
  wholePlasticityEvent.effects[0]
    .partial_content_recovered,
  false,
);
assert.equal(
  wholePlasticityEvent.effects[0]
    .retrieval_practice_registered,
  true,
);

const partialPlasticityEvent =
  built.result.plasticity_events_created
    .find(
      (event) =>
        event.source_retrieval_event_id
        === partialRecoveryEvent.retrieval_event_id,
    );

assert.ok(partialPlasticityEvent);
assert.equal(
  partialPlasticityEvent.effects.length,
  1,
  "multiple recovered fragments from one per-memory recovery remain one practice effect",
);
assert.deepEqual(
  partialPlasticityEvent.effects[0]
    .recovered_fragment_ids,
  [
    "fragment_partial_a",
    "fragment_partial_b",
  ],
);
assert.deepEqual(
  partialPlasticityEvent.effects[0]
    .recovery_occurrence_ids,
  [
    "occurrence_partial_a",
    "occurrence_partial_b",
  ],
);
assert.equal(
  partialPlasticityEvent.effects[0]
    .partial_content_recovered,
  true,
);
assert.equal(
  partialPlasticityEvent.effects[0]
    .recovery_occurrence_count_used_as_practice_count,
  false,
);
assert.equal(
  partialPlasticityEvent.effects[0]
    .quantitative_strength_delta,
  null,
  "R1 registers canonical history but must not invent a quantitative learning gain",
);

const nonTargetPlasticityEvent =
  built.result.plasticity_events_created
    .find(
      (event) =>
        event.source_retrieval_event_id
        === nonTargetRecoveryEvent.retrieval_event_id,
    );

assert.ok(nonTargetPlasticityEvent);
assert.equal(
  nonTargetPlasticityEvent.effects.length,
  1,
);
assert.equal(
  nonTargetPlasticityEvent.effects[0]
    .target_relation,
  "non_target",
);
assert.equal(
  nonTargetPlasticityEvent.effects[0]
    .retrieval_practice_registered,
  true,
  "actually recovered non-target content is still a real retrieval-practice event",
);

const failedPlasticityEvent =
  built.result.plasticity_events_created
    .find(
      (event) =>
        event.source_retrieval_event_id
        === failedOnlyEvent.retrieval_event_id,
    );

assert.ok(failedPlasticityEvent);
assert.equal(
  failedPlasticityEvent.effects.length,
  0,
  "failed target with no recovered memory must not be treated as successful retrieval practice",
);
assert.equal(
  failedPlasticityEvent.outcome_summary
    .processed_with_zero_effects,
  true,
  "zero-effect canonical event distinguishes an intentionally processed failure from a missing Phase64A run",
);

const reinforcedMemoryIds =
  new Set(
    built.result.history_references_appended
      .map(
        (reference) =>
          reference.source_memory_ref,
      ),
  );

assert.equal(
  reinforcedMemoryIds.has(
    "memory_contacted_only",
  ),
  false,
  "contacted-only candidates must not receive retrieval-practice consequences",
);

for (
  const reference
  of built.result.history_references_appended
) {
  assert.equal(
    reference.schema_version,
    memoryPlasticityHistoryReferenceSchemaVersion,
  );
  assert.equal(
    reference.role,
    "retrieval_practice_registered",
  );
  assert.equal(
    reference.derived_index,
    true,
  );
}

const queue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      "turn_phase64a_r1:memory_plasticity",
    world_state_hash:
      hashAgentRunValue(initialWorldState),
    state_transitions:
      built.result.state_transitions,
    elapsed_ms: 0,
  });

const executed =
  executeWorldSimulationChronologicalMutationQueue({
    world_state:
      initialWorldState,
    preview_world_state:
      built.result.preview_world_state,
    queue,
  });

const persisted =
  executed.next_world_state;

assert.equal(
  Object.keys(
    persisted.memory_plasticity_events,
  ).length,
  4,
);
assert.equal(
  persisted.memory_plasticity_history.length,
  3,
);
assert.deepEqual(
  persisted.memories,
  sourceMemorySnapshot,
  "authoritative Phase64A persistence must leave source memory records byte-equivalent by value",
);

const replay =
  buildWorldSimulationMemoryPlasticity({
    world_state:
      persisted,
    retrieval_event_ids: [
      wholeRecoveryEvent.retrieval_event_id,
      partialRecoveryEvent.retrieval_event_id,
      nonTargetRecoveryEvent.retrieval_event_id,
      failedOnlyEvent.retrieval_event_id,
    ],
  });

assert.equal(
  replay.result.plasticity_events_created.length,
  0,
);
assert.equal(
  replay.result.already_persisted_plasticity_event_ids.length,
  4,
);
assert.equal(
  replay.result.history_references_appended.length,
  0,
);
assert.equal(
  replay.result.state_transitions.length,
  0,
  "deterministic replay of already-persisted Phase64A events must be a no-op",
);

const corruptedHistoryState =
  structuredClone(persisted);
corruptedHistoryState.memory_plasticity_history
  .push(
    structuredClone(
      corruptedHistoryState
        .memory_plasticity_history[0],
    ),
  );

assert.throws(
  () =>
    buildWorldSimulationMemoryPlasticity({
      world_state:
        corruptedHistoryState,
      retrieval_event_ids: [
        wholeRecoveryEvent.retrieval_event_id,
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DUPLICATE_REFERENCE",
  "R1 replay must fail closed on a corrupted duplicate history index instead of silently treating it as already processed",
);

const eventToOverwrite =
  built.result.plasticity_events_created[0];

const modifiedPlasticityEvent = {
  ...structuredClone(eventToOverwrite),
  outcome_summary: {
    ...structuredClone(
      eventToOverwrite.outcome_summary,
    ),
    retrieval_practice_effect_count: 999,
  },
};

const overwriteQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      "turn_phase64a_r1:illegal_event_overwrite",
    world_state_hash:
      hashAgentRunValue(persisted),
    state_transitions: [
      {
        entity: "world",
        field:
          `memory_plasticity_events.${eventToOverwrite.plasticity_event_id}`,
        from:
          eventToOverwrite,
        to:
          modifiedPlasticityEvent,
        cause:
          "illegal Phase64A event overwrite fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        persisted,
      preview_world_state: {
        ...structuredClone(persisted),
        memory_plasticity_events: {
          ...structuredClone(
            persisted.memory_plasticity_events,
          ),
          [eventToOverwrite.plasticity_event_id]:
            modifiedPlasticityEvent,
        },
      },
      queue:
        overwriteQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_IMMUTABILITY_VIOLATION",
);

const illegalHistoryState =
  structuredClone(persisted);
illegalHistoryState.memory_plasticity_history
  .shift();

const historyRemovalQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      "turn_phase64a_r1:illegal_history_removal",
    world_state_hash:
      hashAgentRunValue(persisted),
    state_transitions: [
      {
        entity: "world",
        field:
          "memory_plasticity_history",
        from:
          persisted.memory_plasticity_history,
        to:
          illegalHistoryState.memory_plasticity_history,
        cause:
          "illegal Phase64A history removal fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        persisted,
      preview_world_state:
        illegalHistoryState,
      queue:
        historyRemovalQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_APPEND_ONLY_VIOLATION",
);

const duplicateHistoryState =
  structuredClone(persisted);
duplicateHistoryState.memory_plasticity_history
  .push(
    structuredClone(
      duplicateHistoryState
        .memory_plasticity_history[0],
    ),
  );

const duplicateHistoryQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      "turn_phase64a_r1:illegal_duplicate_history_ref",
    world_state_hash:
      hashAgentRunValue(persisted),
    state_transitions: [
      {
        entity: "world",
        field:
          "memory_plasticity_history",
        from:
          persisted.memory_plasticity_history,
        to:
          duplicateHistoryState.memory_plasticity_history,
        cause:
          "illegal duplicate Phase64A history reference fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        persisted,
      preview_world_state:
        duplicateHistoryState,
      queue:
        duplicateHistoryQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DUPLICATE_REFERENCE",
);

const directNestedHistoryQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      "turn_phase64a_r1:illegal_nested_history",
    world_state_hash:
      hashAgentRunValue(persisted),
    state_transitions: [
      {
        entity: "world",
        field:
          "memory_plasticity_history.0",
        from:
          persisted.memory_plasticity_history[0],
        to:
          null,
        cause:
          "illegal direct nested Phase64A history mutation fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        persisted,
      preview_world_state:
        persisted,
      queue:
        directNestedHistoryQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DIRECT_MUTATION_FORBIDDEN",
);

const tamperedSourceState =
  structuredClone(initialWorldState);

tamperedSourceState
  .retrieval_events
  .retrieval_whole
  .target_outcome =
    "failed";

assert.throws(
  () =>
    buildWorldSimulationMemoryPlasticity({
      world_state:
        tamperedSourceState,
      retrieval_event_ids: [
        wholeRecoveryEvent.retrieval_event_id,
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_HASH_MISMATCH",
);

assert.throws(
  () =>
    buildWorldSimulationMemoryPlasticity({
      world_state:
        initialWorldState,
      retrieval_event_ids: [
        "missing_retrieval_event",
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_UNRESOLVED",
);

const noOp =
  buildWorldSimulationMemoryPlasticity({
    world_state:
      initialWorldState,
    retrieval_event_ids: [],
  });

assert.equal(
  noOp.result.state_transitions.length,
  0,
);
assert.deepEqual(
  noOp.result.preview_world_state,
  initialWorldState,
);
assert.equal(
  Object.hasOwn(
    noOp.result.preview_world_state,
    "memory_plasticity_events",
  ),
  false,
  "no-op Phase64A build must not synthesize empty plasticity containers",
);

console.log(JSON.stringify({
  ok: true,
  phase:
    "Phase64A-R1 retrieval practice consequence",
  plasticity_event_count:
    built.result.plasticity_events_created.length,
  practice_reference_count:
    built.result.history_references_appended.length,
  source_memory_rewrite_count:
    0,
  future_accessibility_projection_applied:
    false,
}));
console.log(
  "Phase64A-R1 retrieval practice consequence test passed.",
);
