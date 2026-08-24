import assert from "node:assert/strict";

import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";

import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";

import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
  memoryRetrievalEventSchemaVersion,
  memoryRetrievalHistoryReferenceSchemaVersion,
  memoryRetrievalLegacyBaselineSchemaVersion,
  worldSimulationMemoryRetrievalPersistenceVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";

const contract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();

assert.equal(
  contract.version,
  "phase63c-retrieval-event-persistence-v1",
);
assert.equal(
  contract.version,
  worldSimulationMemoryRetrievalPersistenceVersion,
);
assert.equal(contract.retrieval_event_persistence_installed, true);
assert.equal(contract.per_memory_recovery_records_installed, true);
assert.equal(contract.failed_target_attempt_history_installed, true);
assert.equal(contract.search_steps_persist_actual_path_only, true);
assert.equal(contract.counterfactual_cue_options_persisted, false);
assert.equal(contract.retrieval_event_write_once_required, true);
assert.equal(contract.retrieval_history_append_only_required, true);
assert.equal(contract.legacy_baseline_immutable_required, true);
assert.equal(contract.recovery_occurrence_count_is_recall_count, false);
assert.equal(contract.same_cycle_phase63b_history_feedback_allowed, false);
assert.equal(contract.retrieval_reinforcement_modeled, false);
assert.equal(contract.retrieval_induced_forgetting_modeled, false);
assert.equal(contract.reconsolidation_modeled, false);

const character = "phase63c-step5-observer";

const initialWorldState = {
  simulation_time: "2026-08-25T04:10:00+08:00",
  retrieval_events: {},
  memories: {
    [character]: [
      {
        memory_id: "memory_target",
        content: {
          actor: "伊萊亞斯",
          action: "站在橋邊",
        },
        recall_count: 8,
        last_recalled_at: "2026-08-20T12:00:00+08:00",
        accessible: true,
        suppressed: false,
      },
      {
        memory_id: "memory_non_target",
        content: {
          sound: "遠處金屬聲",
        },
        accessible: true,
        suppressed: false,
      },
      {
        memory_id: "memory_legacy_history",
        content: {
          detail: "舊歷史",
        },
        retrieval_history: [
          {
            success: true,
            occurred_at: "2026-08-19T10:00:00+08:00",
          },
          {
            outcome: "successful_retrieval",
            occurred_at: "2026-08-21T11:00:00+08:00",
          },
          {
            outcome: "failed",
            occurred_at: "2026-08-22T11:00:00+08:00",
          },
        ],
        accessible: true,
        suppressed: false,
      },
    ],
  },
};

const failedTargetWithNonTargetRecovery = {
  observer: character,
  version: "phase63c-memory-retrieval-process-v3",
  result: {
    version: "phase63c-memory-retrieval-process-v3",
    process_occurred: true,
    retrieval_process: {
      retrieval_process_id: "process_failed_target",
      character,
      turn_id: "turn_step5",
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      retrieval_task: {
        mode: "cued_recall",
      },
      target: {
        kind: "memory_content",
        memory_id: "memory_target",
        requested_selectors: [
          {
            kind: "json_pointer",
            path: "/action",
          },
        ],
      },
      steps: [
        {
          step_index: 0,
          frontier: {
            frontier_id: "frontier_failed",
            active_cue_hash: "cue_hash_failed",
            candidate_set_hash: "candidate_hash_failed",
            candidate_count: 1,
            candidate_refs: [
              {
                memory_id: "memory_non_target",
                candidate_index: 0,
              },
            ],
          },
          contacted_candidate_refs: [
            {
              memory_id: "memory_non_target",
              candidate_index: 0,
            },
          ],
          recovered_fragments: [
            {
              fragment_id: "fragment_non_target",
              source_memory_ref: "memory_non_target",
              content: "遠處金屬聲",
              content_kind: "detail",
              target_relation: "non_target",
              content_grounding: {
                selector: {
                  kind: "json_pointer",
                  path: "/sound",
                },
                materialized_by_kernel: true,
              },
            },
          ],
          recovery_occurrences: [
            {
              recovery_occurrence_id: "occurrence_non_target",
              fragment_id: "fragment_non_target",
              source_memory_ref: "memory_non_target",
            },
          ],
          new_reinstatement_cue_options: [
            {
              cue_option_id: "counterfactual_option_must_not_persist",
              cue: {
                kind: "semantic",
                value: "never-selected",
              },
              grounding: {
                source_memory_ref: "memory_non_target",
              },
            },
          ],
          selected_reinstatement_cue_refs: [],
          reinstated_cues: [],
          step_target_relation: "non_target",
          cumulative_target_outcome_after_step: "failed",
          continuation: {
            control_action: "stop",
            control_reason: "fixture stop annotation",
            next_step_created: false,
          },
          termination_after_step: true,
        },
      ],
      termination: {
        reason: "fixture_stop",
        step_index: 0,
        cognitive_control_stop: true,
        technical_step_limit_reached: false,
      },
    },
    recovered_fragments: [
      {
        fragment_id: "fragment_non_target",
        source_memory_ref: "memory_non_target",
        content: "遠處金屬聲",
        content_kind: "detail",
        target_relation: "non_target",
        content_grounding: {
          selector: {
            kind: "json_pointer",
            path: "/sound",
          },
          materialized_by_kernel: true,
        },
      },
    ],
    recovery_occurrences: [
      {
        recovery_occurrence_id: "occurrence_non_target",
        fragment_id: "fragment_non_target",
        source_memory_ref: "memory_non_target",
      },
    ],
    recovered_memories: [
      {
        content: "遠處金屬聲",
      },
    ],
    target_outcome: "failed",
    recovered_any_content: true,
    resolver_audit: [],
  },
};

const partialTargetRecovery = {
  observer: character,
  version: "phase63c-memory-retrieval-process-v3",
  result: {
    version: "phase63c-memory-retrieval-process-v3",
    process_occurred: true,
    retrieval_process: {
      retrieval_process_id: "process_partial_target",
      character,
      turn_id: "turn_step5",
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      retrieval_task: {
        mode: "cued_recall",
      },
      target: {
        kind: "memory_content",
        memory_id: "memory_target",
        requested_selectors: [
          {
            kind: "json_pointer",
            path: "/actor",
          },
          {
            kind: "json_pointer",
            path: "/action",
          },
        ],
      },
      steps: [
        {
          step_index: 0,
          frontier: {
            frontier_id: "frontier_partial",
            active_cue_hash: "cue_hash_partial",
            candidate_set_hash: "candidate_hash_partial",
            candidate_count: 1,
            candidate_refs: [
              {
                memory_id: "memory_target",
                candidate_index: 0,
              },
            ],
          },
          contacted_candidate_refs: [
            "memory_target",
          ],
          recovered_fragments: [
            {
              fragment_id: "fragment_target_actor",
              source_memory_ref: "memory_target",
              content: "伊萊亞斯",
              content_kind: "identity_fragment",
              target_relation: "target_related",
              content_grounding: {
                selector: {
                  kind: "json_pointer",
                  path: "/actor",
                },
                materialized_by_kernel: true,
              },
            },
          ],
          recovery_occurrences: [
            {
              recovery_occurrence_id: "occurrence_target_actor",
              fragment_id: "fragment_target_actor",
              source_memory_ref: "memory_target",
            },
          ],
          new_reinstatement_cue_options: [],
          selected_reinstatement_cue_refs: [],
          reinstated_cues: [],
          step_target_relation: "target_related",
          cumulative_target_outcome_after_step: "partially_satisfied",
          continuation: {
            control_action: "stop",
            control_reason: "fixture partial stop",
            next_step_created: false,
          },
          termination_after_step: true,
        },
      ],
      termination: {
        reason: "fixture_partial_stop",
        step_index: 0,
        cognitive_control_stop: true,
        technical_step_limit_reached: false,
      },
    },
    recovered_fragments: [
      {
        fragment_id: "fragment_target_actor",
        source_memory_ref: "memory_target",
        content: "伊萊亞斯",
        content_kind: "identity_fragment",
        target_relation: "target_related",
        content_grounding: {
          selector: {
            kind: "json_pointer",
            path: "/actor",
          },
          materialized_by_kernel: true,
        },
      },
    ],
    recovery_occurrences: [
      {
        recovery_occurrence_id: "occurrence_target_actor",
        fragment_id: "fragment_target_actor",
        source_memory_ref: "memory_target",
      },
      {
        recovery_occurrence_id: "occurrence_target_actor_repeat",
        fragment_id: "fragment_target_actor",
        source_memory_ref: "memory_target",
      },
    ],
    recovered_memories: [
      {
        content: "伊萊亞斯",
      },
    ],
    target_outcome: "partially_satisfied",
    recovered_any_content: true,
    resolver_audit: [],
  },
};

const legacyHistoryRecovery = {
  observer: character,
  version: "phase63c-memory-retrieval-process-v2",
  result: {
    version: "phase63c-memory-retrieval-process-v2",
    process_occurred: true,
    retrieval_process: {
      retrieval_process_id: "process_legacy_history",
      character,
      turn_id: "turn_step5",
      initiation: {
        mode: "spontaneous",
        trigger_origin: "environmental_cue",
      },
      retrieval_task: {
        mode: "associative_recall",
      },
      target: null,
      initial_cues: [],
      frozen_candidate_set: {
        phase63b_version: "phase63b-cue-dependent-memory-accessibility-v2",
        candidate_set_hash: "legacy_candidate_hash",
        candidate_count: 1,
      },
      steps: [
        {
          step_index: 0,
          active_cues: [],
          contacted_candidate_refs: [
            {
              memory_id: "memory_legacy_history",
              candidate_index: 0,
            },
          ],
          recovered_fragments: [
            {
              fragment_id: "fragment_legacy_history",
              source_memory_ref: "memory_legacy_history",
              content: {
                detail: "舊歷史",
              },
              content_kind: "detail",
              target_relation: "unresolved",
              content_grounding: {
                selector: {
                  kind: "whole_content",
                },
                materialized_by_kernel: true,
              },
            },
          ],
          reinstated_cues: [],
          target_relation: "unresolved",
          termination_after_step: true,
        },
      ],
      termination: {
        reason: "single_step_completed",
        step_limit_reached: true,
      },
    },
    recovered_fragments: [
      {
        fragment_id: "fragment_legacy_history",
        source_memory_ref: "memory_legacy_history",
        content: {
          detail: "舊歷史",
        },
        content_kind: "detail",
        target_relation: "unresolved",
        content_grounding: {
          selector: {
            kind: "whole_content",
          },
          materialized_by_kernel: true,
        },
      },
    ],
    recovered_memories: [
      {
        content: {
          detail: "舊歷史",
        },
      },
    ],
    target_outcome: "not_applicable",
    recovered_any_content: true,
  },
};

const persistence =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state: initialWorldState,
    turn_id: "turn_step5",
    occurred_at: "2026-08-25T04:10:00+08:00",
    retrieval_processes: [
      failedTargetWithNonTargetRecovery,
      partialTargetRecovery,
      legacyHistoryRecovery,
    ],
  });

assert.equal(
  persistence.version,
  worldSimulationMemoryRetrievalPersistenceVersion,
);
assert.equal(
  persistence.result.retrieval_events_created.length,
  3,
);
assert.equal(
  persistence.result.state_transitions.length >= 4,
  true,
);

for (
  const event
  of persistence.result.retrieval_events_created
) {
  assert.equal(event.schema_version, memoryRetrievalEventSchemaVersion);
  assert.equal(event.immutable, true);
  assert.equal(typeof event.retrieval_event_hash, "string");
  assert.equal(event.engine_audit.same_cycle_phase63b_feedback_used, false);
  assert.equal(event.engine_audit.strengthening_applied, false);
  assert.equal(event.engine_audit.competitor_weakening_applied, false);
  assert.equal(event.engine_audit.reconsolidation_applied, false);
  assert.equal(
    JSON.stringify(event.search_steps)
      .includes("counterfactual_option_must_not_persist"),
    false,
  );
  assert.equal(
    JSON.stringify(event.search_steps)
      .includes("candidate_refs"),
    false,
  );
}

const queue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: "turn_step5:retrieval_history",
    world_state_hash: "fixture-state-hash",
    state_transitions:
      persistence.result.state_transitions,
    elapsed_ms: 0,
  });

const executed =
  executeWorldSimulationChronologicalMutationQueue({
    world_state: initialWorldState,
    preview_world_state:
      persistence.result.preview_world_state,
    queue,
  });

const persisted =
  executed.next_world_state;

assert.equal(
  Object.keys(persisted.retrieval_events).length,
  3,
);

const targetRecord =
  persisted.memories[character]
    .find(
      (record) =>
        record.memory_id === "memory_target",
    );

const nonTargetRecord =
  persisted.memories[character]
    .find(
      (record) =>
        record.memory_id === "memory_non_target",
    );

const legacyHistoryRecord =
  persisted.memories[character]
    .find(
      (record) =>
        record.memory_id === "memory_legacy_history",
    );

assert.equal(
  targetRecord
    .retrieval_history_legacy_baseline
    .schema_version,
  memoryRetrievalLegacyBaselineSchemaVersion,
);
assert.equal(
  targetRecord
    .retrieval_history_legacy_baseline
    .source,
  "legacy_summary_fallback",
);
assert.equal(
  targetRecord
    .retrieval_history_legacy_baseline
    .successful_recall_count,
  8,
);
assert.equal(targetRecord.recall_count, 9);
assert.equal(
  targetRecord.retrieval_history.some(
    (entry) =>
      entry.schema_version
        === memoryRetrievalHistoryReferenceSchemaVersion
      && entry.role === "target_attempt_failed",
  ),
  true,
);
assert.equal(
  targetRecord.retrieval_history.some(
    (entry) =>
      entry.schema_version
        === memoryRetrievalHistoryReferenceSchemaVersion
      && entry.role === "partially_recovered",
  ),
  true,
);

assert.equal(nonTargetRecord.recall_count, 1);
assert.equal(
  nonTargetRecord.retrieval_history.some(
    (entry) =>
      entry.role === "non_target_recovered",
  ),
  true,
);

assert.equal(
  legacyHistoryRecord
    .retrieval_history_legacy_baseline
    .source,
  "legacy_inline_history",
);
assert.equal(
  legacyHistoryRecord
    .retrieval_history_legacy_baseline
    .successful_recall_count,
  2,
);
assert.equal(legacyHistoryRecord.recall_count, 3);
assert.equal(
  legacyHistoryRecord.retrieval_history.length,
  4,
  "legacy inline history must remain intact and receive one canonical appended ref",
);

const partialEvent =
  persistence.result.retrieval_events_created
    .find(
      (event) =>
        event.retrieval_process_id
        === "process_partial_target",
    );

assert.ok(partialEvent);
assert.equal(
  partialEvent.memory_recoveries[0]
    .recovery_occurrence_ids.length,
  2,
  "two recovery occurrences belong to one per-memory recovery episode",
);
assert.equal(
  targetRecord.recall_count,
  9,
  "two recovery occurrences in one RetrievalEvent must increase compatibility recall_count only once",
);

const replay =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state: persisted,
    turn_id: "turn_step5",
    occurred_at: "2026-08-25T04:10:00+08:00",
    retrieval_processes: [
      failedTargetWithNonTargetRecovery,
      partialTargetRecovery,
      legacyHistoryRecovery,
    ],
  });

assert.equal(
  replay.result.retrieval_events_created.length,
  0,
);
assert.equal(
  replay.result.already_persisted_retrieval_event_ids.length,
  3,
);
assert.equal(
  replay.result.state_transitions.length,
  0,
  "deterministic replay of already-persisted identical events must be a no-op",
);

const eventToOverwrite =
  persistence.result.retrieval_events_created[0];

const modifiedEvent = {
  ...structuredClone(eventToOverwrite),
  target_outcome: "satisfied",
};

const overwriteQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: "turn_step5:illegal_event_overwrite",
    world_state_hash: "fixture-state-hash-2",
    state_transitions: [
      {
        entity: "world",
        field:
          `retrieval_events.${eventToOverwrite.retrieval_event_id}`,
        from: eventToOverwrite,
        to: modifiedEvent,
        cause: "illegal overwrite fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: persisted,
      preview_world_state: {
        ...structuredClone(persisted),
        retrieval_events: {
          ...structuredClone(persisted.retrieval_events),
          [eventToOverwrite.retrieval_event_id]:
            modifiedEvent,
        },
      },
      queue: overwriteQueue,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_EVENT_IMMUTABILITY_VIOLATION",
);

const illegalHistoryState =
  structuredClone(persisted);

illegalHistoryState.memories[character][0]
  .retrieval_history
  .shift();

const historyRemovalQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: "turn_step5:illegal_history_removal",
    world_state_hash: "fixture-state-hash-3",
    state_transitions: [
      {
        entity: "world",
        field: `memories.${character}`,
        from: persisted.memories[character],
        to: illegalHistoryState.memories[character],
        cause: "illegal history removal fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: persisted,
      preview_world_state: illegalHistoryState,
      queue: historyRemovalQueue,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_HISTORY_APPEND_ONLY_VIOLATION",
);

const directNestedQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: "turn_step5:illegal_nested_history",
    world_state_hash: "fixture-state-hash-4",
    state_transitions: [
      {
        entity: "world",
        field:
          `memories.${character}.0.retrieval_history`,
        from:
          targetRecord.retrieval_history,
        to: [],
        cause: "illegal direct nested history mutation fixture",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: persisted,
      preview_world_state: persisted,
      queue: directNestedQueue,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_HISTORY_DIRECT_MUTATION_FORBIDDEN",
);

const noRetrievalWorldState = {
  simulation_time: "2026-08-25T04:11:00+08:00",
  memories: {},
};

const noRetrievalPersistence =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state:
      noRetrievalWorldState,
    turn_id:
      "turn_step5_no_retrieval",
    occurred_at:
      "2026-08-25T04:11:00+08:00",
    retrieval_processes: [],
  });

assert.equal(
  noRetrievalPersistence.result.state_transitions.length,
  0,
);
assert.deepEqual(
  noRetrievalPersistence.result.preview_world_state,
  noRetrievalWorldState,
  "zero retrieval processes must produce a value-equivalent no-op preview without synthesizing empty containers",
);
assert.equal(
  Object.hasOwn(
    noRetrievalPersistence.result.preview_world_state,
    "retrieval_events",
  ),
  false,
  "no-op persistence must not synthesize retrieval_events = {}",
);

const loopContract =
  buildWorldSimulationLoopContract();

assert.equal(
  loopContract
    .subjective_memory_retrieval_persistence
    .retrieval_event_persistence_installed,
  true,
);
assert.equal(
  loopContract
    .memory_context_projection
    .same_cycle_retrieval_history_feedback_allowed,
  false,
);

const report = {
  ok: true,
  phase: "Phase63C Step 5",
  retrieval_persistence_version:
    worldSimulationMemoryRetrievalPersistenceVersion,
  immutable_retrieval_event_verified: true,
  actual_search_path_only_verified: true,
  per_memory_recovery_verified: true,
  failed_target_attempt_history_verified: true,
  legacy_summary_baseline_verified: true,
  legacy_inline_history_baseline_verified: true,
  recovery_occurrence_not_recall_count_verified: true,
  deterministic_replay_noop_verified: true,
  zero_process_preview_noop_verified: true,
  phase62k_retrieval_event_write_once_verified: true,
  phase62k_retrieval_history_append_only_verified: true,
  direct_nested_history_mutation_rejected: true,
  same_cycle_phase63b_feedback_allowed: false,
  retrieval_reinforcement_modeled: false,
  retrieval_induced_forgetting_modeled: false,
  reconsolidation_modeled: false,
};

console.log(
  JSON.stringify(
    report,
    null,
    2,
  ),
);
