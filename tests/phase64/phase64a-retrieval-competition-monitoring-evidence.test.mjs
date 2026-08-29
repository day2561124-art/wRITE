import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  baseLevelActivationProjectionModelProfileHash,
  worldSimulationBaseLevelActivationProjectionVersion,
} from "../../server/src/world-simulation-base-level-activation-projection-service.mjs";
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
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
} from "../../server/src/world-simulation-associative-activation-composition-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalCompetitionMonitoringEvidenceContract,
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence,
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence,
  worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-competition-monitoring-evidence-service.mjs";

function r4b3EvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    character:
      evidence.character,
    turn_id:
      evidence.turn_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r3_projection_id:
      evidence.source_r3_projection_id,
    source_r3_projection_hash:
      evidence.source_r3_projection_hash,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    source_r4b2_topology_evidence_id:
      evidence.source_r4b2_topology_evidence_id,
    source_r4b2_evidence_hash:
      evidence.source_r4b2_evidence_hash,
    candidate_memory_ids:
      evidence.candidate_memory_ids,
    selected_cue_profiles:
      evidence.selected_cue_profiles,
    candidate_evidence:
      evidence.candidate_evidence,
    dominance:
      evidence.dominance,
    boundaries:
      evidence.boundaries,
    immutable:
      evidence.immutable,
  };
}

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

function rehashMonitor(evidence) {
  const hash =
    hashAgentRunValue(
      monitorEvidenceBody(evidence),
    );

  evidence.evidence_hash = hash;
  evidence.competition_monitor_evidence_id =
    `memory_retrieval_competition_monitor_${hash.slice(0, 24)}`;

  return evidence;
}

function buildR4B3Fixture({
  queryId,
  candidateSpecs,
}) {
  const candidateIds =
    candidateSpecs.map(
      (spec) => spec.memory_id,
    );

  const body = {
    schema_version:
      "phase64a-r4b3-associative-activation-composition-evidence-v1",
    version:
      worldSimulationAssociativeActivationCompositionEvidenceVersion,
    query_id:
      queryId,
    character:
      "phase64a-r4c-fixture-observer",
    turn_id:
      "phase64a-r4c-fixture-turn",
    source_initial_frontier_id:
      "phase64a-r4c-fixture-frontier",
    source_r3_projection_id:
      "phase64a-r4c-fixture-r3",
    source_r3_projection_hash:
      "phase64a-r4c-fixture-r3-hash",
    source_r4a_projection_id:
      "phase64a-r4c-fixture-r4a",
    source_r4a_evidence_hash:
      "phase64a-r4c-fixture-r4a-hash",
    source_r4b2_topology_evidence_id:
      "phase64a-r4c-fixture-r4b2",
    source_r4b2_evidence_hash:
      "phase64a-r4c-fixture-r4b2-hash",
    candidate_memory_ids:
      candidateIds,
    selected_cue_profiles: {
      trigger: [
        {
          cue_identity:
            "fixture-trigger",
        },
      ],
      orientation: [
        {
          cue_identity:
            "fixture-orientation",
        },
      ],
    },
    candidate_evidence:
      candidateSpecs.map(
        (spec, index) => ({
          memory_id:
            spec.memory_id,
          candidate_index:
            index,
          base_level: {
            base_level_activation_score:
              spec.score,
            complete_base_level_evidence:
              spec.complete !== false,
            encoding_time_status:
              spec.complete === false
                ? "legacy_encoding_time_unavailable"
                : "authoritative_encoded_at",
            legacy_r2_slot_pinned:
              spec.complete === false,
            score_is_literal_human_recall_probability:
              false,
          },
          cue_support: {
            trigger: [
              {
                supported:
                  spec.bits?.[0] === 1,
              },
            ],
            orientation: [
              {
                supported:
                  spec.bits?.[1] === 1,
              },
            ],
          },
          composition: {
            attention_weights_available:
              false,
            calibrated_association_scale_available:
              false,
            cue_dependency_model_available:
              false,
            scalar_associative_activation:
              null,
            composed_activation_score:
              null,
            status:
              "evidence_only_uncalibrated",
          },
        }),
      ),
    dominance: {
      mode:
        "lazy_pairwise_evidence_component_comparison_v1",
      exhaustive_pairwise_matrix_materialized:
        false,
      modeled_dimensions: [
        "complete_r3_base_level_score",
        "actual_selected_cue_support_bits",
      ],
      excluded_dimensions: [],
    },
    boundaries: {
      evidence_is_query_conditioned:
        true,
      evidence_is_initial_frontier_bound:
        true,
      candidate_membership_changed:
        false,
      candidate_order_changed:
        false,
      retrieval_probability_modeled:
        false,
      retrieval_contact_changed:
        false,
      retrieval_recovery_changed:
        false,
      resolver_exposure_allowed:
        false,
      full_evidence_persistence_allowed:
        false,
      dynamic_frontier_recomputation_used:
        false,
      phase63c_reinstated_cues_included:
        false,
    },
    immutable:
      true,
  };

  const evidenceHash =
    hashAgentRunValue(
      r4b3EvidenceBody(body),
    );

  return {
    ...body,
    composition_evidence_id:
      `memory_associative_activation_composition_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  };
}

const contract =
  buildWorldSimulationRetrievalCompetitionMonitoringEvidenceContract();

assert.equal(
  contract.phase,
  "Phase64A-R4C",
);
assert.equal(
  contract.source_phase64a_r4b3_required,
  true,
);
assert.equal(
  contract.monitoring_mode,
  "lazy_candidate_dominance_probe_v1",
);
assert.equal(
  contract.exhaustive_pairwise_matrix_materialized,
  false,
);
assert.equal(
  contract.candidate_membership_authority,
  false,
);
assert.equal(
  contract.candidate_order_authority,
  false,
);
assert.equal(
  contract.activation_rank_authority,
  false,
);
assert.equal(
  contract.competition_winner_modeled,
  false,
);
assert.equal(
  contract.retrieval_probability_modeled,
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
  contract.search_control_authority,
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
assert.equal(
  contract.dynamic_frontier_recomputation_used,
  false,
);
assert.equal(
  contract.phase63c_reinstated_cues_included,
  false,
);

const completeR4B3 =
  buildR4B3Fixture({
    queryId:
      "phase64a-r4c-query-complete",
    candidateSpecs: [
      {
        memory_id: "candidate-a",
        score: 1,
        bits: [0, 0],
      },
      {
        memory_id: "candidate-b",
        score: 2,
        bits: [1, 0],
      },
      {
        memory_id: "candidate-c",
        score: 3,
        bits: [0, 1],
      },
    ],
  });

const completeMonitor =
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id:
      completeR4B3.query_id,
    associative_activation_composition_evidence:
      completeR4B3,
  });

assert.equal(
  completeMonitor.version,
  worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
);
assert.equal(
  completeMonitor.source_r4b3_evidence_hash,
  completeR4B3.evidence_hash,
);
assert.equal(
  completeMonitor.source_r4b3_composition_evidence_id,
  completeR4B3.composition_evidence_id,
);
assert.deepEqual(
  completeMonitor.candidate_memory_ids,
  completeR4B3.candidate_memory_ids,
);
assert.equal(
  completeMonitor.monitoring.candidate_probe_reports_materialized,
  false,
);
assert.equal(
  completeMonitor.monitoring.exhaustive_pairwise_matrix_materialized,
  false,
);
assert.equal(
  completeMonitor.monitoring.competition_winner_modeled,
  false,
);
assert.equal(
  completeMonitor.monitoring.retrieval_probability_modeled,
  false,
);
assert.equal(
  completeMonitor.monitoring.search_control_authority,
  false,
);
assert.equal(
  completeMonitor.boundaries.dynamic_frontier_recomputation_used,
  false,
);
assert.equal(
  completeMonitor.boundaries.phase63c_reinstated_cues_included,
  false,
);
assert.equal(
  JSON.stringify(completeMonitor).includes(
    "base_level_activation_score",
  ),
  false,
  "R4C monitor metadata must bind R4B3 without copying full candidate evidence",
);
assert.equal(
  JSON.stringify(completeMonitor).includes(
    '"pairwise_matrix":',
  ),
  false,
  "R4C must not materialize a pairwise_matrix field; the explicit exhaustive_pairwise_matrix_materialized=false boundary flag is allowed",
);
assert.ok(
  Object.isFrozen(completeMonitor),
);
assert.ok(
  Object.isFrozen(completeMonitor.monitoring),
);
assert.ok(
  Object.isFrozen(completeMonitor.candidate_memory_ids),
);

const dominatedProbe =
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
    completeMonitor,
    completeR4B3,
    "candidate-a",
  );
assert.deepEqual(
  dominatedProbe,
  {
    candidate_memory_id:
      "candidate-a",
    peer_candidate_count: 2,
    evaluated_peer_count: 1,
    complete_peer_scan: false,
    competition_status:
      "known_dominated_on_modeled_dimensions",
    dominator_witness_memory_id:
      "candidate-b",
    source_r4b3_evidence_hash:
      completeR4B3.evidence_hash,
  },
);
assert.ok(
  Object.isFrozen(dominatedProbe),
);

const undominatedProbe =
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
    completeMonitor,
    completeR4B3,
    "candidate-c",
  );
assert.equal(
  undominatedProbe.competition_status,
  "undominated_on_modeled_dimensions",
);
assert.equal(
  undominatedProbe.complete_peer_scan,
  true,
);
assert.equal(
  undominatedProbe.evaluated_peer_count,
  2,
);
assert.equal(
  Object.hasOwn(
    undominatedProbe,
    "dominator_witness_memory_id",
  ),
  false,
);

const incompleteOnlyR4B3 =
  buildR4B3Fixture({
    queryId:
      "phase64a-r4c-query-incomplete",
    candidateSpecs: [
      {
        memory_id: "candidate-incomplete",
        score: null,
        complete: false,
        bits: [1, 1],
      },
      {
        memory_id: "candidate-probe",
        score: 3,
        bits: [1, 1],
      },
    ],
  });
const incompleteOnlyMonitor =
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id:
      incompleteOnlyR4B3.query_id,
    associative_activation_composition_evidence:
      incompleteOnlyR4B3,
  });
const incompleteOnlyProbe =
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
    incompleteOnlyMonitor,
    incompleteOnlyR4B3,
    "candidate-probe",
  );
assert.equal(
  incompleteOnlyProbe.competition_status,
  "not_certifiable_due_to_incomplete_evidence",
);
assert.equal(
  incompleteOnlyProbe.complete_peer_scan,
  true,
);
assert.equal(
  Object.hasOwn(
    incompleteOnlyProbe,
    "dominator_witness_memory_id",
  ),
  false,
);

const incompleteThenDominatorR4B3 =
  buildR4B3Fixture({
    queryId:
      "phase64a-r4c-query-incomplete-then-dominator",
    candidateSpecs: [
      {
        memory_id: "candidate-incomplete-first",
        score: null,
        complete: false,
        bits: [1, 1],
      },
      {
        memory_id: "candidate-middle",
        score: 1,
        bits: [0, 0],
      },
      {
        memory_id: "candidate-later-dominator",
        score: 2,
        bits: [1, 1],
      },
    ],
  });
const incompleteThenDominatorMonitor =
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id:
      incompleteThenDominatorR4B3.query_id,
    associative_activation_composition_evidence:
      incompleteThenDominatorR4B3,
  });
const incompleteThenDominatorProbe =
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
    incompleteThenDominatorMonitor,
    incompleteThenDominatorR4B3,
    "candidate-middle",
  );
assert.equal(
  incompleteThenDominatorProbe.competition_status,
  "known_dominated_on_modeled_dimensions",
  "a later definite dominator must remain sufficient even after an earlier incomplete comparison",
);
assert.equal(
  incompleteThenDominatorProbe.evaluated_peer_count,
  2,
);
assert.equal(
  incompleteThenDominatorProbe.complete_peer_scan,
  true,
);
assert.equal(
  incompleteThenDominatorProbe.dominator_witness_memory_id,
  "candidate-later-dominator",
);

const singletonR4B3 =
  buildR4B3Fixture({
    queryId:
      "phase64a-r4c-query-singleton",
    candidateSpecs: [
      {
        memory_id: "candidate-singleton",
        score: 1,
        bits: [0, 0],
      },
    ],
  });
const singletonMonitor =
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id:
      singletonR4B3.query_id,
    associative_activation_composition_evidence:
      singletonR4B3,
  });
const singletonProbe =
  probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
    singletonMonitor,
    singletonR4B3,
    "candidate-singleton",
  );
assert.equal(
  singletonProbe.competition_status,
  "undominated_on_modeled_dimensions",
);
assert.equal(
  singletonProbe.peer_candidate_count,
  0,
);
assert.equal(
  singletonProbe.evaluated_peer_count,
  0,
);
assert.equal(
  singletonProbe.complete_peer_scan,
  true,
);

const emptyR4B3 =
  buildR4B3Fixture({
    queryId:
      "phase64a-r4c-query-empty",
    candidateSpecs: [],
  });
const emptyMonitor =
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id:
      emptyR4B3.query_id,
    associative_activation_composition_evidence:
      emptyR4B3,
  });
assert.deepEqual(
  emptyMonitor.candidate_memory_ids,
  [],
);
assert.throws(
  () =>
    probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
      emptyMonitor,
      emptyR4B3,
      "not-present",
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_CANDIDATE_UNKNOWN",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
      query_id:
        "wrong-query",
      associative_activation_composition_evidence:
        completeR4B3,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_QUERY_MISMATCH",
);

const tamperedR4B3 =
  structuredClone(completeR4B3);
tamperedR4B3
  .candidate_evidence[0]
  .base_level
  .base_level_activation_score =
    999;
assert.throws(
  () =>
    projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
      query_id:
        tamperedR4B3.query_id,
      associative_activation_composition_evidence:
        tamperedR4B3,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_HASH_MISMATCH",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
      query_id:
        completeR4B3.query_id,
      associative_activation_composition_evidence:
        completeR4B3,
      winner_selector:
        "candidate-b",
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_OVERRIDE_FORBIDDEN",
);

const tamperedMonitor =
  structuredClone(completeMonitor);
tamperedMonitor.monitoring.competition_winner_modeled = true;
assert.throws(
  () =>
    probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
      tamperedMonitor,
      completeR4B3,
      "candidate-a",
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_HASH_MISMATCH",
);

const reboundMonitor =
  structuredClone(completeMonitor);
reboundMonitor.candidate_memory_ids = [
  "candidate-b",
  "candidate-a",
  "candidate-c",
];
rehashMonitor(reboundMonitor);
assert.throws(
  () =>
    probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
      reboundMonitor,
      completeR4B3,
      "candidate-a",
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_SOURCE_BINDING_MISMATCH",
);

function r3ProjectionIdBody(projection) {
  return {
    version:
      worldSimulationBaseLevelActivationProjectionVersion,
    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,
    source_r2_projection_id:
      projection.source_retrieval_practice_projection_id
      ?? null,
    character:
      projection.character
      ?? null,
    current_turn_id:
      projection.current_turn_id
      ?? null,
    as_of:
      projection.as_of,
    input_memory_ids:
      projection.input_memory_ids,
    r2_projected_memory_ids:
      projection.r2_projected_memory_ids,
    projected_memory_ids:
      projection.projected_memory_ids,
    evidence:
      projection.base_level_activation_evidence.map(
        (entry) => ({
          memory_id:
            entry.memory_id,
          encoded_at:
            entry.encoded_at,
          encoding_age_seconds:
            entry.encoding_age_seconds,
          encoding_activation_contribution:
            entry.encoding_activation_contribution,
          retrieval_practice_activation_mass:
            entry.retrieval_practice_activation_mass,
          base_level_activation_mass:
            entry.base_level_activation_mass,
          base_level_activation_score:
            entry.base_level_activation_score,
          complete_base_level_evidence:
            entry.complete_base_level_evidence,
          legacy_r2_slot_pinned:
            entry.legacy_r2_slot_pinned,
        }),
      ),
  };
}

const integrationCharacter =
  "phase64a-r4c-integration-observer";
const integrationTurn =
  "phase64a-r4c-integration-turn";
const integrationScene =
  "phase64a-r4c-integration-scene";
const integrationMemories = [
  {
    memory_id:
      "r4c-integration-memory-a",
    encoded_at:
      "2026-08-29T15:00:00+08:00",
    content: {
      detail:
        "Someone stopped beside the bridge.",
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
          "r4c-integration-shared-bridge",
        association_strength: 0.4,
      },
      {
        kind: "entity",
        value: "elias",
        source:
          "r4c-integration-unique-entity",
        association_strength: 0.9,
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id:
      "r4c-integration-memory-b",
    encoded_at:
      "2026-08-29T15:30:00+08:00",
    content: {
      detail:
        "Another unrelated memory beside the bridge.",
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
          "r4c-integration-shared-bridge",
        association_strength: 0.8,
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
];

function buildIntegrationR3Projection() {
  const projectedIds = [
    "r4c-integration-memory-b",
    "r4c-integration-memory-a",
  ];
  const scoreById = new Map([
    ["r4c-integration-memory-a", 2],
    ["r4c-integration-memory-b", 1],
  ]);

  const evidence =
    projectedIds.map(
      (memoryId, index) => ({
        memory_id:
          memoryId,
        original_index:
          memoryId === "r4c-integration-memory-a"
            ? 0
            : 1,
        r2_projected_index:
          memoryId === "r4c-integration-memory-a"
            ? 0
            : 1,
        projected_index:
          index,
        projected_rank:
          index + 1,
        encoded_at:
          integrationMemories.find(
            (memory) =>
              memory.memory_id === memoryId,
          ).encoded_at,
        encoding_time_status:
          "authoritative_encoded_at",
        encoding_age_seconds:
          3600 + index,
        encoding_activation_contribution:
          0.25,
        retrieval_practice_activation_mass:
          0.5,
        base_level_activation_mass:
          Math.exp(
            scoreById.get(memoryId),
          ),
        base_level_activation_score:
          scoreById.get(memoryId),
        base_level_constant:
          0,
        complete_base_level_evidence:
          true,
        legacy_r2_slot_pinned:
          false,
        scalar_activation_is_literal_human_probability:
          false,
      }),
    );

  const projection = {
    version:
      worldSimulationBaseLevelActivationProjectionVersion,
    projection_id:
      null,
    character:
      integrationCharacter,
    current_turn_id:
      integrationTurn,
    as_of:
      "2026-08-29T16:50:00+08:00",
    model_profile_schema_version:
      "phase64a-base-level-activation-model-profile-v1",
    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,
    source_retrieval_practice_activation_version:
      "fixture-r2",
    source_retrieval_practice_model_profile_hash:
      "fixture-r2-profile",
    source_retrieval_practice_projection_id:
      "fixture-r2-projection-r4c-integration",
    input_memory_ids: [
      "r4c-integration-memory-a",
      "r4c-integration-memory-b",
    ],
    r2_projected_memory_ids: [
      "r4c-integration-memory-a",
      "r4c-integration-memory-b",
    ],
    projected_memory_ids:
      projectedIds,
    projected_memory_records:
      projectedIds.map(
        (memoryId) => ({
          memory_id:
            memoryId,
        }),
      ),
    base_level_activation_evidence:
      evidence,
    audit: {
      source_r2_projection_verified:
        true,
    },
  };

  projection.projection_id =
    `base_level_activation_projection_${hashAgentRunValue(
      r3ProjectionIdBody(projection),
    ).slice(0, 24)}`;

  return projection;
}

const integrationR3 =
  buildIntegrationR3Projection();
const integrationAccessibilityBase = {
  character:
    integrationCharacter,
  memory_records:
    integrationMemories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode:
      "cue_dependent_v2",
  },
  simulation_time:
    "2026-08-29T16:50:00+08:00",
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
const integrationInitialR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      integrationInitialAccessibility,
  });
const integrationQuery =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character:
      integrationCharacter,
    turn_id:
      integrationTurn,
    phase63b_version:
      integrationInitialAccessibility
        .memory_accessibility_version,
    memory_records:
      integrationMemories,
    accessibility_base_input:
      integrationAccessibilityBase,
    initial_accessibility_query:
      integrationInitialAccessibility,
    initial_cue_diagnostic_projection:
      integrationInitialR4A,
    retrieval_goal:
      null,
  });

const integrationResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query:
      integrationQuery,
    memory_records:
      integrationMemories,
    accessibility_base_input:
      integrationAccessibilityBase,
    initial_accessibility_query:
      integrationInitialAccessibility,
    initial_base_level_activation_projection:
      integrationR3,
    initial_cue_diagnostic_projection:
      integrationInitialR4A,
    technical_step_budget: 1,
    perception: {
      current_activity:
        "remembering",
    },
    character_state: {
      mood: "neutral",
    },
    resolver:
      async (resolverInput) => {
        const serialized =
          JSON.stringify(resolverInput);

        assert.equal(
          serialized.includes(
            "retrieval_competition_monitor",
          ),
          false,
          "R4C monitoring evidence must remain engine-side",
        );
        assert.equal(
          serialized.includes(
            "competition_monitor_evidence_id",
          ),
          false,
          "R4C monitoring evidence identifiers must not enter resolver payloads",
        );
        assert.equal(
          serialized.includes(
            "competition_status",
          ),
          false,
          "R4C probe reports must not enter resolver payloads",
        );

        if (resolverInput.stage === "initiation") {
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

          assert.ok(bridge);
          assert.ok(surroundings);

          return {
            process_occurred: true,
            initiation: {
              mode: "deliberate",
              trigger_origin:
                "external_prompt",
            },
            retrieval_task: {
              mode: "cued_recall",
            },
            target: null,
            cue_orientation_resolution: {
              trigger: {
                grounding_status:
                  "grounded",
                selected_cue_option_refs: [
                  surroundings.cue_option_id,
                ],
              },
              orientation: {
                status: "selected",
                selected_cue_option_refs: [
                  bridge.cue_option_id,
                  surroundings.cue_option_id,
                ],
              },
            },
          };
        }

        if (resolverInput.stage === "recovery") {
          return {
            contacted_candidate_refs: [
              "r4c-integration-memory-a",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "r4c-integration-memory-a",
                selector: {
                  kind:
                    "whole_content",
                },
                content_kind:
                  "detail",
              },
            ],
          };
        }

        if (resolverInput.stage === "continuation") {
          return {
            control_action:
              "stop",
            control_reason:
              "r4c integration fixture complete",
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
const integrationR4B3 =
  integrationResult
    .initial_associative_activation_composition_evidence;
const integrationR4C =
  integrationResult
    .initial_retrieval_competition_monitoring_evidence;
assert.ok(integrationR4B3);
assert.ok(integrationR4C);
assert.equal(
  integrationR4C.version,
  worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
);
assert.equal(
  integrationR4C.source_r4b3_evidence_hash,
  integrationR4B3.evidence_hash,
);
assert.deepEqual(
  integrationR4C.candidate_memory_ids,
  integrationR4B3.candidate_memory_ids,
);
assert.equal(
  integrationResult
    .retrieval_process
    .initial_retrieval_competition_monitoring_evidence_hash,
  integrationR4C.evidence_hash,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_evidence_materialized,
  true,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_evidence_exposed_to_resolver,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_candidate_probe_reports_materialized,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_exhaustive_pairwise_matrix_materialized,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_dynamic_recomputation_used,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_reinstated_cues_included,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_competition_monitoring_search_control_authority,
  false,
);

const processContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();
assert.equal(
  processContract
    .phase64a_r4c_new_resolver_stage_added,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_initial_frontier_bound,
  true,
);
assert.equal(
  processContract
    .phase64a_r4c_dynamic_recomputation,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_phase63c_reinstated_cues_included,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_retrieval_resolver_evidence_exposed,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_competition_winner_modeled,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_retrieval_contact_authority,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_retrieval_recovery_authority,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_search_control_authority,
  false,
);
assert.equal(
  processContract
    .phase64a_r4c_full_probe_reports_persisted,
  false,
);

const persistenceContract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();
assert.equal(
  persistenceContract
    .retrieval_competition_monitor_full_evidence_persisted,
  false,
);
assert.equal(
  persistenceContract
    .retrieval_competition_probe_reports_persisted,
  false,
);
assert.equal(
  persistenceContract
    .non_contacted_competition_witness_persisted,
  false,
);
assert.equal(
  persistenceContract
    .retrieval_competition_monitor_hash_committed_via_retrieval_process_hash,
  true,
);

const integrationPersistence =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state: {
      simulation_time:
        "2026-08-29T16:50:00+08:00",
      retrieval_events: {},
      memories: {
        [integrationCharacter]:
          integrationMemories,
      },
    },
    turn_id:
      integrationTurn,
    occurred_at:
      "2026-08-29T16:50:00+08:00",
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
  integrationPersistence
    .result
    .retrieval_events_created
    .length,
  1,
);
const persistedEvent =
  integrationPersistence
    .result
    .retrieval_events_created[0];
assert.equal(
  persistedEvent.retrieval_process_hash,
  hashAgentRunValue(
    integrationResult.retrieval_process,
  ),
);
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_competition_monitor_full_evidence_persisted,
  false,
);
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_competition_probe_reports_persisted,
  false,
);
assert.equal(
  persistedEvent
    .engine_audit
    .non_contacted_competition_witness_persisted,
  false,
);
assert.equal(
  persistedEvent
    .engine_audit
    .retrieval_competition_monitor_hash_committed_via_retrieval_process_hash,
  true,
);
const persistedSerialized =
  JSON.stringify(persistedEvent);
assert.equal(
  persistedSerialized.includes(
    "initial_retrieval_competition_monitoring_evidence",
  ),
  false,
  "full R4C monitor evidence must remain ephemeral and absent from RetrievalEvent persistence",
);
assert.equal(
  persistedSerialized.includes(
    "dominator_witness_memory_id",
  ),
  false,
  "R4C candidate competition witnesses must not leak into RetrievalEvent persistence",
);
assert.equal(
  persistedSerialized.includes(
    "r4c-integration-memory-b",
  ),
  false,
  "a non-contacted competition candidate must not leak into RetrievalEvent history",
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
  /retrieval_competition_monitoring_evidence_exposed_to_resolver:\s*false/,
  "world-loop audit must preserve R4C resolver invisibility",
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
    "tests/phase64/phase64a-retrieval-competition-monitoring-evidence.test.mjs",
  ),
  true,
  "R4C test must be formally registered in tests/run-all.mjs",
);

console.log(
  JSON.stringify({
    ok: true,
    phase:
      "Phase64A-R4C Retrieval Competition Monitoring Evidence",
    source_r4b3_only:
      true,
    known_dominated_witness_verified:
      true,
    undominated_requires_complete_peer_scan:
      true,
    incomplete_evidence_blocks_false_undominated_certification:
      true,
    later_dominator_overrides_earlier_incomplete_comparison:
      true,
    exhaustive_pairwise_matrix_materialized:
      false,
    competition_winner_modeled:
      false,
    retrieval_probability_modeled:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    search_control_authority:
      false,
    phase63c_reinstated_cues_included:
      false,
  }),
);
console.log(
  "Phase64A-R4C retrieval competition monitoring evidence: PASS",
);
