import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationCueDiagnosticEvidence,
} from "../../server/src/world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-competition-monitoring-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalSearchControlReadinessEvidenceContract,
  projectWorldSimulationRetrievalSearchControlReadinessEvidence,
  validateWorldSimulationRetrievalSearchControlReadinessEvidence,
  worldSimulationRetrievalSearchControlReadinessEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-search-control-readiness-evidence-service.mjs";

function monitorEvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r4b3_composition_evidence_id:
      evidence.source_r4b3_composition_evidence_id,
    source_r4b3_evidence_hash:
      evidence.source_r4b3_evidence_hash,
    candidate_memory_ids:
      evidence.candidate_memory_ids,
    monitoring:
      evidence.monitoring,
    boundaries:
      evidence.boundaries,
    immutable:
      evidence.immutable,
  };
}

function buildR4CFixture(
  queryId,
  initialFrontierId,
) {
  const body = {
    schema_version:
      worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
    version:
      worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      initialFrontierId,
    source_r4b3_composition_evidence_id:
      "fixture-r4b3-composition",
    source_r4b3_evidence_hash:
      "fixture-r4b3-hash",
    candidate_memory_ids: [
      "memory-a",
      "memory-b",
      "memory-never-contacted",
    ],
    monitoring: {
      mode:
        "lazy_candidate_dominance_probe_v1",
      candidate_probe_reports_materialized:
        false,
      exhaustive_pairwise_matrix_materialized:
        false,
      competition_winner_modeled:
        false,
      retrieval_probability_modeled:
        false,
      search_control_authority:
        false,
    },
    boundaries: {
      resolver_exposure_allowed:
        false,
      dynamic_frontier_recomputation_used:
        false,
      phase63c_reinstated_cues_included:
        false,
    },
    immutable:
      true,
  };

  const hash =
    hashAgentRunValue(
      monitorEvidenceBody(body),
    );

  return {
    ...body,
    competition_monitor_evidence_id:
      `memory_retrieval_competition_monitor_${hash.slice(0, 24)}`,
    evidence_hash:
      hash,
  };
}

const contract =
  buildWorldSimulationRetrievalSearchControlReadinessEvidenceContract();

assert.equal(
  contract.phase,
  "Phase64A-R4D",
);
assert.equal(
  contract.source_phase63c_completed_search_path_required,
  true,
);
assert.equal(
  contract.source_phase64a_r4c_optional,
  true,
);
assert.equal(
  contract.evidence_materialization_timing,
  "post_hoc_after_explicit_phase63c_termination",
);
assert.equal(
  contract.cue_epoch_basis,
  "contiguous_active_cue_hash",
);
assert.equal(
  contract.same_cue_hash_after_intervening_epoch_opens_new_epoch,
  true,
);
assert.equal(
  contract.sam_failure_semantics_claimed,
  false,
);
assert.equal(
  contract.technical_step_budget_used_as_cognitive_evidence,
  false,
);
assert.equal(
  contract.cognitive_failure_threshold_modeled,
  false,
);
assert.equal(
  contract.retrieval_cost_modeled,
  false,
);
assert.equal(
  contract.utility_rate_modeled,
  false,
);
assert.equal(
  contract.retrieval_latency_modeled,
  false,
);
assert.equal(
  contract.feeling_of_knowing_modeled,
  false,
);
assert.equal(
  contract.competitor_inhibition_modeled,
  false,
);
assert.equal(
  contract.continuation_decision_authority,
  false,
);
assert.equal(
  contract.cue_shift_selection_authority,
  false,
);
assert.equal(
  contract.stop_decision_authority,
  false,
);
assert.equal(
  contract.new_attempt_creation_authority,
  false,
);
assert.equal(
  contract.retrieval_contact_authority,
  false,
);
assert.equal(
  contract.retrieval_recovery_authority,
  false,
);
assert.equal(
  contract.character_subjective_awareness_modeled,
  false,
);
assert.equal(
  contract.new_resolver_stage_added,
  false,
);
assert.equal(
  contract.resolver_exposure_allowed,
  false,
);

const queryId =
  "phase64a-r4d-synthetic-query";
const initialFrontier = {
  frontier_id:
    "r4d-frontier-a0",
  active_cue_hash:
    "cue-hash-a",
  candidate_set_hash:
    "candidate-set-a0",
  candidate_count: 3,
};
const r4c =
  buildR4CFixture(
    queryId,
    initialFrontier.frontier_id,
  );

const syntheticSteps = [
  {
    step_index: 0,
    frontier: {
      ...initialFrontier,
    },
    contacted_candidate_refs: [
      "memory-a",
    ],
    recovered_fragments: [
      {
        fragment_id:
          "fragment-a",
        source_memory_ref:
          "memory-a",
      },
    ],
    new_reinstatement_cue_options: [
      {
        cue_option_id:
          "cue-option-1",
      },
    ],
    selected_reinstatement_cue_refs: [
      "cue-option-1",
    ],
    continuation: {
      control_action:
        "continue",
    },
    termination_after_step:
      false,
  },
  {
    step_index: 1,
    frontier: {
      frontier_id:
        "r4d-frontier-b1",
      active_cue_hash:
        "cue-hash-b",
      candidate_set_hash:
        "candidate-set-b1",
      candidate_count: 2,
    },
    contacted_candidate_refs: [
      "memory-a",
    ],
    recovered_fragments: [],
    new_reinstatement_cue_options: [
      {
        cue_option_id:
          "cue-option-2",
      },
    ],
    selected_reinstatement_cue_refs: [
      "cue-option-2",
    ],
    continuation: {
      control_action:
        "continue",
    },
    termination_after_step:
      false,
  },
  {
    step_index: 2,
    frontier: {
      frontier_id:
        "r4d-frontier-a2",
      active_cue_hash:
        "cue-hash-a",
      candidate_set_hash:
        "candidate-set-a2",
      candidate_count: 2,
    },
    contacted_candidate_refs: [
      "memory-a",
      "memory-b",
    ],
    recovered_fragments: [
      {
        fragment_id:
          "fragment-a",
        source_memory_ref:
          "memory-a",
      },
    ],
    new_reinstatement_cue_options: [],
    selected_reinstatement_cue_refs: [],
    continuation: {
      control_action:
        "stop",
    },
    termination_after_step:
      true,
  },
];

const syntheticTermination = {
  reason:
    "synthetic explicit stop",
  step_index: 2,
  cognitive_control_stop:
    true,
  technical_step_limit_reached:
    false,
};

const syntheticEvidence =
  projectWorldSimulationRetrievalSearchControlReadinessEvidence({
    query_id:
      queryId,
    source_initial_frontier:
      initialFrontier,
    search_steps:
      syntheticSteps,
    termination:
      syntheticTermination,
    initial_retrieval_competition_monitoring_evidence:
      r4c,
  });

assert.equal(
  syntheticEvidence.version,
  worldSimulationRetrievalSearchControlReadinessEvidenceVersion,
);
assert.equal(
  syntheticEvidence.source_r4c_evidence_hash,
  r4c.evidence_hash,
);
assert.equal(
  syntheticEvidence.cue_epochs.length,
  3,
  "A→B→A must be three contiguous cue epochs, not two cue identities",
);
assert.deepEqual(
  syntheticEvidence.cue_epochs.map(
    (epoch) => epoch.cue_set_hash,
  ),
  [
    "cue-hash-a",
    "cue-hash-b",
    "cue-hash-a",
  ],
);
assert.deepEqual(
  syntheticEvidence.cue_epochs.map(
    (epoch) =>
      epoch.cue_set_changed_from_previous_epoch,
  ),
  [
    false,
    true,
    true,
  ],
);
assert.equal(
  syntheticEvidence.cue_epochs[0]
    .initial_r4c_baseline_relation,
  "initial_epoch_baseline",
);
assert.equal(
  syntheticEvidence.cue_epochs[1]
    .initial_r4c_baseline_relation,
  "historical_after_cue_transition",
);
assert.equal(
  syntheticEvidence.cue_epochs[2]
    .initial_r4c_baseline_relation,
  "historical_after_cue_transition",
);
assert.equal(
  syntheticEvidence.cue_epochs[0]
    .new_unique_recovered_fragment_count,
  1,
);
assert.equal(
  syntheticEvidence.cue_epochs[1]
    .empty_recovery_step_count,
  1,
);
assert.equal(
  syntheticEvidence.cue_epochs[1]
    .trailing_no_new_unique_recovery_step_count,
  1,
);
assert.equal(
  syntheticEvidence.cue_epochs[2]
    .recovery_fragment_occurrence_count,
  1,
  "repeated recovery content remains an observed occurrence",
);
assert.equal(
  syntheticEvidence.cue_epochs[2]
    .new_unique_recovered_fragment_count,
  0,
  "repeated recovery content must not be invented as new progress",
);
assert.equal(
  syntheticEvidence.cue_epochs[2]
    .no_new_unique_recovery_step_count,
  1,
);

const observation =
  syntheticEvidence.observation;
assert.equal(
  observation.source_step_count,
  3,
);
assert.equal(
  observation.cue_epoch_count,
  3,
);
assert.equal(
  observation.cue_transition_count,
  2,
);
assert.equal(
  observation.contact_occurrence_count,
  4,
);
assert.equal(
  observation.unique_contacted_candidate_count,
  2,
);
assert.equal(
  observation.repeated_contact_occurrence_count,
  2,
);
assert.equal(
  observation.recovery_fragment_occurrence_count,
  2,
);
assert.equal(
  observation.unique_recovered_fragment_count,
  1,
);
assert.equal(
  observation.unique_recovered_memory_count,
  1,
);
assert.equal(
  observation.empty_recovery_step_count,
  1,
);
assert.equal(
  observation.no_new_unique_recovery_step_count,
  2,
);
assert.equal(
  observation.trailing_empty_recovery_step_count,
  0,
);
assert.equal(
  observation.trailing_no_new_unique_recovery_step_count,
  2,
);
assert.equal(
  observation.grounded_reinstatement_cue_option_count,
  2,
);
assert.equal(
  observation.selected_reinstatement_cue_count,
  2,
);
assert.equal(
  observation.actual_cue_transition_observed,
  true,
);

assert.equal(
  syntheticEvidence.readiness.evidence_only,
  true,
);
assert.equal(
  syntheticEvidence.readiness
    .latest_cue_epoch_index,
  2,
);
assert.equal(
  syntheticEvidence.readiness
    .latest_cue_epoch_trailing_no_new_unique_recovery_step_count,
  1,
);
assert.equal(
  syntheticEvidence.readiness
    .grounded_reinstatement_cue_option_available_at_termination,
  true,
);
assert.equal(
  syntheticEvidence.readiness
    .initial_r4c_baseline_relation_to_latest_epoch,
  "historical_after_cue_transition",
);
assert.equal(
  syntheticEvidence.readiness
    .recommended_control_action,
  null,
);
assert.equal(
  syntheticEvidence.readiness
    .recommended_reinstatement_cue_refs,
  null,
);
assert.equal(
  syntheticEvidence.readiness
    .new_attempt_readiness_decision,
  null,
);
assert.equal(
  syntheticEvidence.boundaries
    .sam_failure_semantics_claimed,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .technical_step_budget_used_as_cognitive_evidence,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .continuation_decision_authority,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .cue_shift_selection_authority,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .stop_decision_authority,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .new_attempt_creation_authority,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .non_contacted_r4c_candidate_ids_copied,
  false,
);
assert.equal(
  JSON.stringify(syntheticEvidence)
    .includes("memory-never-contacted"),
  false,
  "R4D may bind R4C by hash/id but must not copy R4C candidate identities",
);
assert.ok(
  Object.isFrozen(
    syntheticEvidence,
  ),
);
assert.ok(
  Object.isFrozen(
    syntheticEvidence.cue_epochs,
  ),
);
assert.ok(
  Object.isFrozen(
    syntheticEvidence.cue_epochs[0],
  ),
);

const validated =
  validateWorldSimulationRetrievalSearchControlReadinessEvidence(
    syntheticEvidence,
  );
assert.deepEqual(
  validated,
  syntheticEvidence,
);
assert.ok(
  Object.isFrozen(
    validated,
  ),
);

const tampered =
  structuredClone(
    syntheticEvidence,
  );
tampered.observation.cue_epoch_count = 99;
assert.throws(
  () =>
    validateWorldSimulationRetrievalSearchControlReadinessEvidence(
      tampered,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EVIDENCE_HASH_MISMATCH",
);

const badR4C =
  structuredClone(
    r4c,
  );
badR4C.monitoring.search_control_authority = true;
assert.throws(
  () =>
    projectWorldSimulationRetrievalSearchControlReadinessEvidence({
      query_id:
        queryId,
      source_initial_frontier:
        initialFrontier,
      search_steps:
        syntheticSteps,
      termination:
        syntheticTermination,
      initial_retrieval_competition_monitoring_evidence:
        badR4C,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_HASH_MISMATCH",
);

const ungroundedSelectionSteps =
  structuredClone(
    syntheticSteps,
  );
ungroundedSelectionSteps[0]
  .selected_reinstatement_cue_refs = [
    "not-grounded",
  ];
assert.throws(
  () =>
    projectWorldSimulationRetrievalSearchControlReadinessEvidence({
      query_id:
        queryId,
      source_initial_frontier:
        initialFrontier,
      search_steps:
        ungroundedSelectionSteps,
      termination:
        syntheticTermination,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_CUE_SELECTION_UNGROUNDED",
);

const badOrderSteps =
  structuredClone(
    syntheticSteps,
  );
badOrderSteps[1].step_index = 9;
assert.throws(
  () =>
    projectWorldSimulationRetrievalSearchControlReadinessEvidence({
      query_id:
        queryId,
      source_initial_frontier:
        initialFrontier,
      search_steps:
        badOrderSteps,
      termination:
        syntheticTermination,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_STEP_ORDER_MISMATCH",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalSearchControlReadinessEvidence({
      query_id:
        queryId,
      source_initial_frontier:
        initialFrontier,
      search_steps:
        syntheticSteps,
      termination:
        syntheticTermination,
      failure_threshold: 3,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_OVERRIDE_FORBIDDEN",
);

const withoutR4C =
  projectWorldSimulationRetrievalSearchControlReadinessEvidence({
    query_id:
      queryId,
    source_initial_frontier:
      initialFrontier,
    search_steps:
      syntheticSteps,
    termination:
      syntheticTermination,
  });
assert.equal(
  withoutR4C.source_r4c_evidence_hash,
  null,
);
assert.equal(
  withoutR4C.readiness
    .initial_r4c_baseline_relation_to_latest_epoch,
  "not_available",
);

const integrationCharacter =
  "phase64a-r4d-integration-observer";
const integrationScene =
  "phase64a-r4d-integration-scene";
const integrationMemory = {
  memory_id:
    "r4d-integration-memory",
  content: {
    detail:
      "The bridge lamp was still on.",
  },
  retrieval_cues: {
    scene_id:
      integrationScene,
    memory_type:
      "episodic_direct_perception",
  },
  retrieval_cue_links: [
    {
      kind: "semantic",
      value: "bridge",
      source:
        "r4d-integration-bridge",
    },
  ],
  retrieval_eligible:
    true,
  suppressed:
    false,
};

const integrationAccessibilityBase = {
  character:
    integrationCharacter,
  memory_records: [
    integrationMemory,
  ],
  memory_retrieval_profile: {
    enabled:
      true,
    model_mode:
      "cue_dependent_v2",
  },
  simulation_time:
    "2026-08-29T23:20:00+08:00",
  scene_id:
    integrationScene,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "bridge",
        source:
          "explicit_retrieval_context",
      },
    ],
  },
};

const integrationInitialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    integrationAccessibilityBase,
  );
const integrationR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      integrationInitialAccessibility,
  });
const integrationQuery =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character:
      integrationCharacter,
    turn_id:
      "phase64a-r4d-integration-turn",
    phase63b_version:
      integrationInitialAccessibility
        .memory_accessibility_version,
    memory_records: [
      integrationMemory,
    ],
    accessibility_base_input:
      integrationAccessibilityBase,
    initial_accessibility_query:
      integrationInitialAccessibility,
    initial_cue_diagnostic_projection:
      integrationR4A,
    retrieval_goal:
      null,
  });

const integrationResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query:
      integrationQuery,
    memory_records: [
      integrationMemory,
    ],
    accessibility_base_input:
      integrationAccessibilityBase,
    initial_accessibility_query:
      integrationInitialAccessibility,
    initial_cue_diagnostic_projection:
      integrationR4A,
    technical_step_budget:
      1,
    resolver:
      async (resolverInput) => {
        const serialized =
          JSON.stringify(
            resolverInput,
          );

        assert.equal(
          serialized.includes(
            "retrieval_search_control_readiness",
          ),
          false,
          "R4D evidence must not enter any resolver payload",
        );
        assert.equal(
          serialized.includes(
            "cue_epoch",
          ),
          false,
          "R4D cue-epoch evidence is post-hoc engine evidence",
        );

        if (
          resolverInput.stage
          === "initiation"
        ) {
          const bridge =
            resolverInput
              .available_cue_orientation_options
              .find(
                (option) =>
                  option.character_surface
                    ?.representation
                  === "bridge",
              );
          const surroundings =
            resolverInput
              .available_cue_orientation_options
              .find(
                (option) =>
                  option.character_surface
                    ?.representation
                  === "current_surroundings",
              );

          assert.ok(
            bridge,
          );
          assert.ok(
            surroundings,
          );

          return {
            process_occurred:
              true,
            initiation: {
              mode:
                "deliberate",
              trigger_origin:
                "external_prompt",
            },
            retrieval_task: {
              mode:
                "cued_recall",
            },
            target:
              null,
            cue_orientation_resolution: {
              trigger: {
                grounding_status:
                  "grounded",
                selected_cue_option_refs: [
                  surroundings.cue_option_id,
                ],
              },
              orientation: {
                status:
                  "selected",
                selected_cue_option_refs: [
                  bridge.cue_option_id,
                ],
              },
            },
          };
        }

        if (
          resolverInput.stage
          === "recovery"
        ) {
          return {
            contacted_candidate_refs: [
              integrationMemory.memory_id,
            ],
            recovered_selections: [],
          };
        }

        if (
          resolverInput.stage
          === "continuation"
        ) {
          return {
            control_action:
              "stop",
            control_reason:
              "r4d integration explicit stop",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected resolver stage: ${resolverInput.stage}`,
        );
      },
  });

assert.equal(
  integrationResult.process_occurred,
  true,
);
const integrationR4D =
  integrationResult
    .retrieval_search_control_readiness_evidence;
assert.ok(
  integrationR4D,
);
assert.equal(
  integrationR4D.version,
  worldSimulationRetrievalSearchControlReadinessEvidenceVersion,
);
assert.equal(
  integrationR4D.observation.source_step_count,
  1,
);
assert.equal(
  integrationR4D.observation.cue_epoch_count,
  1,
);
assert.equal(
  integrationR4D.observation.empty_recovery_step_count,
  1,
);
assert.equal(
  integrationR4D.observation.no_new_unique_recovery_step_count,
  1,
);
assert.equal(
  integrationR4D.source_r4c_evidence_hash,
  null,
);
assert.equal(
  integrationResult
    .retrieval_process
    .retrieval_search_control_readiness_evidence_hash,
  integrationR4D.evidence_hash,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_evidence_materialized,
  true,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_post_hoc_after_termination,
  true,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_evidence_exposed_to_resolver,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_technical_budget_used_as_cognitive_evidence,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_search_control_authority,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_search_control_readiness_new_attempt_creation_authority,
  false,
);

const processContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();
assert.equal(
  processContract
    .phase64a_r4d_retrieval_search_control_readiness_evidence
    .phase,
  "Phase64A-R4D",
);
assert.equal(
  processContract
    .phase64a_r4d_post_hoc_after_termination,
  true,
);
assert.equal(
  processContract
    .phase64a_r4d_new_resolver_stage_added,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_retrieval_resolver_evidence_exposed,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_technical_step_budget_used_as_cognitive_evidence,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_cognitive_failure_threshold_modeled,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_search_control_authority,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_new_attempt_creation_authority,
  false,
);
assert.equal(
  processContract
    .phase64a_r4d_character_metacognition_modeled,
  false,
);

const persistenceContract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();
assert.equal(
  persistenceContract
    .retrieval_search_control_readiness_full_evidence_persisted,
  false,
);
assert.equal(
  persistenceContract
    .retrieval_search_control_readiness_recommendations_persisted,
  false,
);
assert.equal(
  persistenceContract
    .retrieval_search_control_readiness_hash_committed_via_retrieval_process_hash,
  true,
);

const persistence =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state: {
      simulation_time:
        "2026-08-29T23:20:00+08:00",
      retrieval_events: {},
      memories: {
        [integrationCharacter]: [
          integrationMemory,
        ],
      },
    },
    turn_id:
      "phase64a-r4d-integration-turn",
    occurred_at:
      "2026-08-29T23:20:00+08:00",
    retrieval_processes: [
      {
        observer:
          integrationCharacter,
        version:
          integrationResult.version,
        result:
          integrationResult,
      },
    ],
  });

assert.equal(
  persistence
    .result
    .retrieval_events_created
    .length,
  1,
);
const persistedEvent =
  persistence
    .result
    .retrieval_events_created[0];
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_search_control_readiness_full_evidence_persisted,
  false,
);
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_search_control_readiness_recommendations_persisted,
  false,
);
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_search_control_readiness_hash_committed_via_retrieval_process_hash,
  true,
);
const persistedSerialized =
  JSON.stringify(
    persistedEvent,
  );
assert.equal(
  persistedSerialized.includes(
    "retrieval_search_control_readiness_evidence",
  ),
  false,
  "full R4D evidence must remain ephemeral and absent from RetrievalEvent",
);
assert.equal(
  persistedSerialized.includes(
    "recommended_control_action",
  ),
  false,
  "R4D does not persist hypothetical control recommendations",
);

const worldLoopSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-loop-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );
assert.match(
  worldLoopSource,
  /retrieval_search_control_readiness_evidence_exposed_to_resolver:\s*false/,
  "world-loop audit must preserve R4D resolver invisibility",
);

const multistepSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );
assert.match(
  multistepSource,
  /projectWorldSimulationRetrievalSearchControlReadinessEvidence\(\{[\s\S]*search_steps:\s*steps,[\s\S]*termination,[\s\S]*initial_retrieval_competition_monitoring_evidence:\s*retrievalCompetitionMonitoringEvidence/,
  "R4D must be derived from the completed actual Phase63C path plus optional initial R4C binding",
);
assert.match(
  multistepSource,
  /retrieval_search_control_readiness_evidence_hash:[\s\S]*retrievalSearchControlReadinessEvidence[\s\S]*\.evidence_hash/,
  "retrieval process identity must commit the R4D evidence hash",
);

const runAllSource =
  await readFile(
    new URL(
      "../run-all.mjs",
      import.meta.url,
    ),
    "utf8",
  );
assert.equal(
  runAllSource.includes(
    "tests/phase64/phase64a-retrieval-search-control-readiness-evidence.test.mjs",
  ),
  true,
  "R4D formal test must be registered in tests/run-all.mjs",
);

console.log(
  JSON.stringify({
    ok: true,
    phase:
      "Phase64A-R4D Retrieval Search-Control Readiness Evidence",
    post_hoc_actual_path_only:
      true,
    cue_epoch_basis:
      "contiguous_active_cue_hash",
    same_hash_after_intervening_epoch_opens_new_epoch:
      true,
    repeated_recovery_not_invented_as_new_progress:
      true,
    sam_failure_semantics_claimed:
      false,
    technical_step_budget_used_as_cognitive_evidence:
      false,
    cognitive_failure_threshold_modeled:
      false,
    retrieval_cost_benefit_modeled:
      false,
    retrieval_latency_modeled:
      false,
    feeling_of_knowing_modeled:
      false,
    competitor_inhibition_modeled:
      false,
    search_control_authority:
      false,
    new_attempt_creation_authority:
      false,
    resolver_exposure:
      false,
  }),
);
console.log(
  "Phase64A-R4D retrieval search-control readiness evidence: PASS",
);
