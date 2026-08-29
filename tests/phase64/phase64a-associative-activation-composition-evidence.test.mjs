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
  worldSimulationCueDiagnosticEvidenceProjectionVersion,
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
  worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-cue-support-topology-evidence-service.mjs";
import {
  buildWorldSimulationAssociativeActivationCompositionEvidenceContract,
  compareWorldSimulationAssociativeCompositionEvidence,
  projectWorldSimulationAssociativeActivationCompositionEvidence,
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
} from "../../server/src/world-simulation-associative-activation-composition-evidence-service.mjs";

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

function buildR3Projection() {
  const projectedIds = [
    "memory-three",
    "memory-one",
    "memory-five",
    "memory-two",
    "memory-four",
  ];

  const scores = new Map([
    ["memory-one", 2],
    ["memory-two", 1],
    ["memory-three", 3],
    ["memory-four", 1],
    ["memory-five", null],
  ]);

  const evidence =
    projectedIds.map(
      (memoryId, index) => {
        const score = scores.get(memoryId);
        const complete = score !== null;

        return {
          memory_id:
            memoryId,
          original_index:
            index,
          r2_projected_index:
            index,
          projected_index:
            index,
          projected_rank:
            index + 1,
          encoded_at:
            complete
              ? "2026-08-29T08:00:00+08:00"
              : null,
          encoding_time_status:
            complete
              ? "authoritative_encoded_at"
              : "legacy_encoding_time_unavailable",
          encoding_age_seconds:
            complete
              ? 3600 + index
              : null,
          encoding_activation_contribution:
            complete
              ? 0.25
              : null,
          retrieval_practice_activation_mass:
            0.5,
          base_level_activation_mass:
            complete
              ? Math.exp(score)
              : null,
          base_level_activation_score:
            score,
          base_level_constant:
            0,
          complete_base_level_evidence:
            complete,
          legacy_r2_slot_pinned:
            !complete,
          scalar_activation_is_literal_human_probability:
            false,
        };
      },
    );

  const projection = {
    version:
      worldSimulationBaseLevelActivationProjectionVersion,
    projection_id:
      null,
    character:
      "phase64a-r4b3-observer",
    current_turn_id:
      "phase64a-r4b3-turn",
    as_of:
      "2026-08-29T09:00:00+08:00",
    model_profile_schema_version:
      "phase64a-base-level-activation-model-profile-v1",
    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,
    source_retrieval_practice_activation_version:
      "fixture-r2",
    source_retrieval_practice_model_profile_hash:
      "fixture-r2-profile",
    source_retrieval_practice_projection_id:
      "fixture-r2-projection",
    input_memory_ids: [
      "memory-one",
      "memory-two",
      "memory-three",
      "memory-four",
      "memory-five",
    ],
    r2_projected_memory_ids: [
      "memory-one",
      "memory-two",
      "memory-three",
      "memory-four",
      "memory-five",
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

function cueEvidence({
  identity,
  kind,
  value,
  fan,
  strengths = [],
}) {
  return {
    cue_identity:
      identity,
    kind,
    value,
    active_sources: [
      "fixture",
    ],
    candidate_fan_out:
      fan,
    competing_candidate_count:
      fan - 1,
    competing_memory_ids: [],
    query_relative_selectivity_share:
      1 / fan,
    diagnosticity:
      fan === 1
        ? "unique_within_current_query"
        : "shared_within_current_query",
    memory_association_records:
      strengths.map(
        (associationStrength) => ({
          source:
            "fixture",
          association_evidence: {
            kind:
              "fixture",
          },
          association_strength:
            associationStrength,
        }),
      ),
    explicit_association_strength_values:
      strengths,
    association_strength_aggregate:
      null,
    attention_weight:
      null,
    compound_group:
      null,
    scalar_cue_activation:
      null,
  };
}

const cueA = "[\"entity\",\"elias_noll\"]";
const cueB = "[\"spatial_context\",\"third_workshop\"]";
const cueC = "[\"goal\",\"representative_selection\"]";
const cueD = "[\"semantic\",\"zero_support\"]";

function buildR4AProjection() {
  const candidateIds = [
    "memory-one",
    "memory-two",
    "memory-three",
    "memory-four",
    "memory-five",
  ];

  const candidateEvidence = [
    {
      memory_id: "memory-one",
      cue_evidence_count: 3,
      cue_evidence: [
        cueEvidence({
          identity: cueA,
          kind: "entity",
          value: "elias_noll",
          fan: 3,
          strengths: [0.2, 0.9],
        }),
        cueEvidence({
          identity: cueB,
          kind: "spatial_context",
          value: "third_workshop",
          fan: 2,
        }),
        cueEvidence({
          identity: cueC,
          kind: "goal",
          value: "representative_selection",
          fan: 1,
        }),
      ],
      cue_diagnosticity_aggregate: null,
      candidate_scalar_cue_activation: null,
    },
    {
      memory_id: "memory-two",
      cue_evidence_count: 1,
      cue_evidence: [
        cueEvidence({
          identity: cueA,
          kind: "entity",
          value: "elias_noll",
          fan: 3,
          strengths: [0.99],
        }),
      ],
      cue_diagnosticity_aggregate: null,
      candidate_scalar_cue_activation: null,
    },
    {
      memory_id: "memory-three",
      cue_evidence_count: 1,
      cue_evidence: [
        cueEvidence({
          identity: cueB,
          kind: "spatial_context",
          value: "third_workshop",
          fan: 2,
        }),
      ],
      cue_diagnosticity_aggregate: null,
      candidate_scalar_cue_activation: null,
    },
    {
      memory_id: "memory-four",
      cue_evidence_count: 1,
      cue_evidence: [
        cueEvidence({
          identity: cueA,
          kind: "entity",
          value: "elias_noll",
          fan: 3,
          strengths: [0.01],
        }),
      ],
      cue_diagnosticity_aggregate: null,
      candidate_scalar_cue_activation: null,
    },
    {
      memory_id: "memory-five",
      cue_evidence_count: 0,
      cue_evidence: [],
      cue_diagnosticity_aggregate: null,
      candidate_scalar_cue_activation: null,
    },
  ];

  const evidenceHash =
    hashAgentRunValue(
      candidateEvidence,
    );

  return {
    version:
      worldSimulationCueDiagnosticEvidenceProjectionVersion,
    projection_id:
      "cue_diagnostic_projection_r4b3_fixture",
    applicable:
      true,
    candidate_memory_ids:
      candidateIds,
    candidate_evidence:
      candidateEvidence,
    evidence_hash:
      evidenceHash,
    audit: {
      evidence_hash:
        evidenceHash,
    },
  };
}

function buildChannel({
  applicable = true,
  basisStatus = "grounded",
  selections = [],
}) {
  return {
    applicable,
    basis_status:
      basisStatus,
    selected_cue_count:
      selections.length,
    individual_support:
      selections.map(
        (selection) => ({
          cue_option_id:
            selection.cue_option_id,
          canonical_cue_identity:
            selection.canonical_cue_identity,
          support_candidate_ids:
            selection.support_candidate_ids,
          support_candidate_count:
            selection.support_candidate_ids.length,
        }),
      ),
    pairwise_joint_support: [],
    full_selected_set_support: {
      status:
        selections.length
          ? "present"
          : "not_applicable",
      cue_refs:
        selections.map(
          (entry) =>
            entry.cue_option_id,
        ),
      joint_support_candidate_ids: [],
      joint_support_candidate_count:
        0,
    },
  };
}

function rehashR4B2(evidence) {
  const body = {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    source_r4b1_orientation_evidence_id:
      evidence.source_r4b1_orientation_evidence_id,
    source_r4b1_evidence_hash:
      evidence.source_r4b1_evidence_hash,
    channels:
      evidence.channels,
    boundaries:
      evidence.boundaries,
    immutable:
      evidence.immutable,
  };

  const hash =
    hashAgentRunValue(body);

  evidence.evidence_hash =
    hash;
  evidence.topology_evidence_id =
    `memory_retrieval_cue_support_topology_${hash.slice(0, 24)}`;

  return evidence;
}

function buildR4B2Evidence(r4a) {
  return rehashR4B2({
    schema_version:
      "phase64a-r4b2-retrieval-cue-support-topology-evidence-v1",
    version:
      worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
    query_id:
      "phase64a-r4b3-query",
    source_initial_frontier_id:
      "phase64a-r4b3-frontier",
    source_r4a_projection_id:
      r4a.projection_id,
    source_r4a_evidence_hash:
      r4a.evidence_hash,
    source_r4b1_orientation_evidence_id:
      "fixture-r4b1-orientation",
    source_r4b1_evidence_hash:
      "fixture-r4b1-hash",
    channels: {
      trigger:
        buildChannel({
          selections: [
            {
              cue_option_id:
                "cue-a",
              canonical_cue_identity:
                cueA,
              support_candidate_ids: [
                "memory-one",
                "memory-two",
                "memory-four",
              ],
            },
            {
              cue_option_id:
                "cue-d",
              canonical_cue_identity:
                cueD,
              support_candidate_ids: [],
            },
          ],
        }),
      orientation:
        buildChannel({
          selections: [
            {
              cue_option_id:
                "cue-b",
              canonical_cue_identity:
                cueB,
              support_candidate_ids: [
                "memory-one",
                "memory-three",
              ],
            },
            {
              cue_option_id:
                "cue-c",
              canonical_cue_identity:
                cueC,
              support_candidate_ids: [
                "memory-one",
              ],
            },
          ],
        }),
    },
    boundaries: {
      evidence_is_query_conditioned:
        true,
      scalar_activation_modeled:
        false,
    },
    immutable:
      true,
    topology_evidence_id:
      null,
    evidence_hash:
      null,
  });
}

function fixtureInput() {
  const r4a =
    buildR4AProjection();

  return {
    query_id:
      "phase64a-r4b3-query",
    character:
      "phase64a-r4b3-observer",
    turn_id:
      "phase64a-r4b3-turn",
    base_level_activation_projection:
      buildR3Projection(),
    cue_diagnostic_projection:
      r4a,
    cue_support_topology_evidence:
      buildR4B2Evidence(r4a),
  };
}

const contract =
  buildWorldSimulationAssociativeActivationCompositionEvidenceContract();

assert.equal(
  contract.version,
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
);
assert.equal(contract.phase, "Phase64A-R4B3");
assert.equal(contract.candidate_membership_authority, false);
assert.equal(contract.candidate_order_authority, false);
assert.equal(contract.candidate_order_source, "phase64a_r4a_initial_frontier_order");
assert.equal(contract.query_local_log_diagnostic_term_modeled, true);
assert.equal(contract.r4a_selectivity_used_as_activation, false);
assert.equal(contract.attention_weight_inferred, false);
assert.equal(contract.maximum_associative_strength_inferred, false);
assert.equal(contract.cue_independence_assumed, false);
assert.equal(contract.scalar_associative_activation_modeled, false);
assert.equal(contract.composed_activation_score_modeled, false);
assert.equal(contract.caller_supplied_activation_profile_allowed, false);
assert.equal(contract.exhaustive_pairwise_matrix_materialized, false);
assert.equal(contract.retrieval_contact_authority, false);
assert.equal(contract.retrieval_recovery_authority, false);

const input =
  fixtureInput();
const inputBefore =
  structuredClone(input);
const projection =
  projectWorldSimulationAssociativeActivationCompositionEvidence(
    input,
  );

assert.deepEqual(
  input,
  inputBefore,
  "R4B3 must not mutate source evidence",
);
assert.ok(Object.isFrozen(projection));
assert.ok(Object.isFrozen(projection.candidate_evidence));
assert.ok(Object.isFrozen(projection.candidate_evidence[0].cue_support.trigger));

assert.deepEqual(
  projection.candidate_memory_ids,
  [
    "memory-one",
    "memory-two",
    "memory-three",
    "memory-four",
    "memory-five",
  ],
  "R4B3 must preserve the Phase63B/R4A initial-frontier order rather than R3 projected rank",
);

const byMemory =
  new Map(
    projection.candidate_evidence.map(
      (entry) => [
        entry.memory_id,
        entry,
      ]),
  );

assert.equal(
  byMemory.get("memory-one")
    .base_level
    .base_level_activation_score,
  2,
);
assert.equal(
  byMemory.get("memory-five")
    .base_level
    .base_level_activation_score,
  null,
);
assert.equal(
  byMemory.get("memory-five")
    .base_level
    .complete_base_level_evidence,
  false,
);

const triggerProfiles =
  projection.selected_cue_profiles.trigger.cues;
const cueAProfile =
  triggerProfiles.find(
    (entry) =>
      entry.cue_option_id === "cue-a",
  );
const cueDProfile =
  triggerProfiles.find(
    (entry) =>
      entry.cue_option_id === "cue-d",
  );

assert.equal(cueAProfile.support_candidate_count, 3);
assert.equal(cueAProfile.candidate_fan_out, 3);
assert.equal(cueAProfile.query_relative_selectivity_share, 1 / 3);
assert.equal(
  cueAProfile.log_query_relative_selectivity_term,
  Math.log(1 / 3),
);
assert.equal(
  cueAProfile.log_query_relative_selectivity_is_activation_contribution,
  false,
);
assert.equal(cueDProfile.support_candidate_count, 0);
assert.equal(cueDProfile.candidate_fan_out, null);
assert.equal(cueDProfile.query_relative_selectivity_share, null);
assert.equal(cueDProfile.log_query_relative_selectivity_term, null);

const memoryOneCueA =
  byMemory.get("memory-one")
    .cue_support
    .trigger
    .find(
      (entry) =>
        entry.cue_option_id === "cue-a",
    );
const memoryTwoCueA =
  byMemory.get("memory-two")
    .cue_support
    .trigger
    .find(
      (entry) =>
        entry.cue_option_id === "cue-a",
    );

assert.deepEqual(
  memoryOneCueA.explicit_association_strength_values,
  [0.2, 0.9],
);
assert.deepEqual(
  memoryTwoCueA.explicit_association_strength_values,
  [0.99],
);
assert.equal(memoryOneCueA.association_strength_aggregate, null);
assert.equal(memoryOneCueA.attention_weight, null);
assert.equal(memoryOneCueA.scalar_associative_activation, null);

for (const candidate of projection.candidate_evidence) {
  assert.equal(candidate.composition.attention_weights_available, false);
  assert.equal(candidate.composition.calibrated_association_scale_available, false);
  assert.equal(candidate.composition.cue_dependency_model_available, false);
  assert.equal(candidate.composition.scalar_associative_activation, null);
  assert.equal(candidate.composition.composed_activation_score, null);
  assert.equal(candidate.composition.status, "evidence_only_uncalibrated");
}

assert.equal(projection.boundaries.r4a_selectivity_used_as_activation, false);
assert.equal(projection.boundaries.attention_weight_inferred, false);
assert.equal(projection.boundaries.maximum_associative_strength_inferred, false);
assert.equal(projection.boundaries.cue_independence_assumed, false);
assert.equal(projection.boundaries.scalar_associative_activation_modeled, false);
assert.equal(projection.dominance.exhaustive_pairwise_matrix_materialized, false);
assert.equal(
  Object.hasOwn(projection, "evidence_dominance"),
  false,
  "R4B3 must not materialize an exhaustive pairwise dominance matrix",
);

assert.equal(
  compareWorldSimulationAssociativeCompositionEvidence(
    projection,
    "memory-one",
    "memory-two",
  ).relation,
  "left_evidence_dominates",
);
assert.equal(
  compareWorldSimulationAssociativeCompositionEvidence(
    projection,
    "memory-two",
    "memory-one",
  ).relation,
  "right_evidence_dominates",
);
assert.equal(
  compareWorldSimulationAssociativeCompositionEvidence(
    projection,
    "memory-one",
    "memory-three",
  ).relation,
  "incomparable",
  "base-level advantage must not be allowed to erase a selected-cue support tradeoff",
);
assert.equal(
  compareWorldSimulationAssociativeCompositionEvidence(
    projection,
    "memory-two",
    "memory-four",
  ).relation,
  "equivalent_on_modeled_dimensions",
  "explicit association-strength values are preserved but are not an authorized dominance dimension",
);
assert.equal(
  compareWorldSimulationAssociativeCompositionEvidence(
    projection,
    "memory-five",
    "memory-one",
  ).relation,
  "not_comparable_due_to_incomplete_evidence",
);

assert.throws(
  () =>
    projectWorldSimulationAssociativeActivationCompositionEvidence({
      ...fixtureInput(),
      attention_weights: {
        "cue-a": 1,
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_OVERRIDE_FORBIDDEN",
);

const tamperedR3 =
  fixtureInput();
tamperedR3
  .base_level_activation_projection
  .projection_id =
    "tampered";
assert.throws(
  () =>
    projectWorldSimulationAssociativeActivationCompositionEvidence(
      tamperedR3,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_PROJECTION_ID_MISMATCH",
);

const tamperedR4A =
  fixtureInput();
tamperedR4A
  .cue_diagnostic_projection
  .candidate_evidence[0]
  .cue_evidence[0]
  .candidate_fan_out =
    99;
assert.throws(
  () =>
    projectWorldSimulationAssociativeActivationCompositionEvidence(
      tamperedR4A,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_EVIDENCE_HASH_MISMATCH",
);

const tamperedR4B2Hash =
  fixtureInput();
tamperedR4B2Hash
  .cue_support_topology_evidence
  .channels
  .trigger
  .basis_status =
    "tampered";
assert.throws(
  () =>
    projectWorldSimulationAssociativeActivationCompositionEvidence(
      tamperedR4B2Hash,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_EVIDENCE_HASH_MISMATCH",
);

const r4b2SemanticMismatch =
  fixtureInput();
const mismatchedTopology =
  r4b2SemanticMismatch
    .cue_support_topology_evidence;
mismatchedTopology
  .channels
  .trigger
  .individual_support[0]
  .support_candidate_ids = [
    "memory-one",
    "memory-two",
  ];
mismatchedTopology
  .channels
  .trigger
  .individual_support[0]
  .support_candidate_count =
    2;
rehashR4B2(
  mismatchedTopology,
);
assert.throws(
  () =>
    projectWorldSimulationAssociativeActivationCompositionEvidence(
      r4b2SemanticMismatch,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_R4B2_SUPPORT_MISMATCH",
);

const projectionTamper =
  structuredClone(projection);
projectionTamper
  .candidate_evidence[0]
  .base_level
  .base_level_activation_score =
    999;
assert.throws(
  () =>
    compareWorldSimulationAssociativeCompositionEvidence(
      projectionTamper,
      "memory-one",
      "memory-two",
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_HASH_MISMATCH",
);

// R4B3-INTEGRATION-RUNTIME
const integrationCharacter =
  "phase64a-r4b3-integration-observer";
const integrationTurn =
  "phase64a-r4b3-integration-turn";
const integrationScene =
  "phase64a-r4b3-integration-scene";

const integrationMemories = [
  {
    memory_id:
      "r4b3-integration-memory-a",
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
          "r4b3-integration-shared-bridge",
        association_strength: 0.4,
      },
      {
        kind: "entity",
        value: "elias",
        source:
          "r4b3-integration-unique-entity",
        association_strength: 0.9,
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id:
      "r4b3-integration-memory-b",
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
          "r4b3-integration-shared-bridge",
        association_strength: 0.8,
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
];

function buildIntegrationR3Projection() {
  const projectedIds = [
    "r4b3-integration-memory-b",
    "r4b3-integration-memory-a",
  ];

  const scoreById = new Map([
    ["r4b3-integration-memory-a", 2],
    ["r4b3-integration-memory-b", 1],
  ]);

  const evidence =
    projectedIds.map(
      (memoryId, index) => ({
        memory_id:
          memoryId,
        original_index:
          memoryId === "r4b3-integration-memory-a"
            ? 0
            : 1,
        r2_projected_index:
          memoryId === "r4b3-integration-memory-a"
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

  const result = {
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
      "fixture-r2-projection-r4b3-integration",
    input_memory_ids: [
      "r4b3-integration-memory-a",
      "r4b3-integration-memory-b",
    ],
    r2_projected_memory_ids: [
      "r4b3-integration-memory-a",
      "r4b3-integration-memory-b",
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

  result.projection_id =
    `base_level_activation_projection_${hashAgentRunValue(
      r3ProjectionIdBody(result),
    ).slice(0, 24)}`;

  return result;
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

let integrationRecoveryCount = 0;
let initialRuntimeFrontierId = null;
let reinstatedRuntimeFrontierId = null;

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
    technical_step_budget: 2,
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
          JSON.stringify(
            resolverInput,
          );

        assert.equal(
          serialized.includes(
            "associative_activation_composition",
          ),
          false,
          "R4B3 evidence must never be exposed to the resolver",
        );
        assert.equal(
          serialized.includes(
            "composition_evidence_id",
          ),
          false,
          "R4B3 evidence identifiers must remain engine-side",
        );
        assert.equal(
          serialized.includes(
            "base_level_activation_score",
          ),
          false,
          "R3/R4B3 activation evidence must remain engine-side",
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
          integrationRecoveryCount += 1;

          if (
            resolverInput
              .process
              .step_index
            === 0
          ) {
            initialRuntimeFrontierId =
              resolverInput
                .current_frontier
                .frontier_id;

            return {
              contacted_candidate_refs: [
                "r4b3-integration-memory-a",
              ],
              recovered_selections: [
                {
                  source_memory_ref:
                    "r4b3-integration-memory-a",
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

          reinstatedRuntimeFrontierId =
            resolverInput
              .current_frontier
              .frontier_id;

          return {
            contacted_candidate_refs: [],
            recovered_selections: [],
          };
        }

        if (resolverInput.stage === "continuation") {
          if (
            resolverInput
              .process
              .step_index
            === 0
          ) {
            const entityCue =
              resolverInput
                .available_reinstatement_cues
                .find(
                  (option) =>
                    option.cue?.kind
                      === "entity"
                    && option.cue?.value
                      === "elias",
                );

            assert.ok(
              entityCue,
              "recovered memory must expose a grounded unique reinstatement cue",
            );

            return {
              control_action:
                "continue",
              control_reason:
                "r4b3 dynamic-frontier isolation probe",
              selected_reinstatement_cue_refs: [
                entityCue.cue_option_id,
              ],
            };
          }

          return {
            control_action:
              "stop",
            control_reason:
              "r4b3 integration fixture complete",
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
assert.equal(
  integrationRecoveryCount,
  2,
);
assert.ok(initialRuntimeFrontierId);
assert.ok(reinstatedRuntimeFrontierId);
assert.notEqual(
  reinstatedRuntimeFrontierId,
  initialRuntimeFrontierId,
  "internal cue reinstatement must alter the runtime frontier without rewriting initial R4B3 evidence",
);

const integrationComposition =
  integrationResult
    .initial_associative_activation_composition_evidence;

assert.ok(integrationComposition);
assert.equal(
  integrationComposition.version,
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
);
assert.equal(
  integrationComposition.source_initial_frontier_id,
  initialRuntimeFrontierId,
);
assert.deepEqual(
  integrationComposition.candidate_memory_ids,
  integrationInitialR4A.candidate_memory_ids,
);
assert.equal(
  integrationResult
    .retrieval_process
    .initial_associative_activation_composition_evidence_hash,
  integrationComposition.evidence_hash,
);
assert.equal(
  integrationComposition
    .boundaries
    .dynamic_frontier_recomputation_used,
  false,
);
assert.equal(
  integrationComposition
    .boundaries
    .phase63c_reinstated_cues_included,
  false,
);
assert.equal(
  integrationComposition
    .candidate_evidence[0]
    .composition
    .scalar_associative_activation,
  null,
);
assert.equal(
  integrationComposition
    .candidate_evidence[0]
    .composition
    .composed_activation_score,
  null,
);
assert.equal(
  integrationResult
    .retrieval_process
    .steps[1]
    .frontier
    .frontier_id,
  reinstatedRuntimeFrontierId,
);
assert.equal(
  integrationResult
    .engine_audit
    .associative_activation_composition_evidence_materialized,
  true,
);
assert.equal(
  integrationResult
    .engine_audit
    .associative_activation_composition_exposed_to_resolver,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .associative_activation_composition_dynamic_recomputation_used,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .associative_activation_composition_scalar_activation_modeled,
  false,
);

const integrationProcessContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_new_resolver_stage_added,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_requires_explicit_r3_projection_input,
  true,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_initial_frontier_bound,
  true,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_dynamic_recomputation,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_retrieval_resolver_evidence_exposed,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_scalar_associative_activation_modeled,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b3_full_evidence_persisted,
  false,
);

const integrationPersistenceContract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();
assert.equal(
  integrationPersistenceContract
    .associative_activation_composition_full_evidence_persisted,
  false,
);
assert.equal(
  integrationPersistenceContract
    .associative_activation_composition_hash_committed_via_retrieval_process_hash,
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
const integrationPersistedEvent =
  integrationPersistence
    .result
    .retrieval_events_created[0];
assert.equal(
  integrationPersistedEvent
    .retrieval_process_hash,
  hashAgentRunValue(
    integrationResult.retrieval_process,
  ),
);
assert.equal(
  integrationPersistedEvent
    .engine_audit
    .associative_activation_composition_full_evidence_persisted,
  false,
);
assert.equal(
  integrationPersistedEvent
    .engine_audit
    .associative_activation_composition_hash_committed_via_retrieval_process_hash,
  true,
);
assert.equal(
  JSON.stringify(
    integrationPersistedEvent,
  ).includes(
    "initial_associative_activation_composition_evidence",
  ),
  false,
  "full R4B3 candidate evidence must remain ephemeral and absent from RetrievalEvent persistence",
);
assert.equal(
  JSON.stringify(
    integrationPersistedEvent,
  ).includes(
    "r4b3-integration-memory-b",
  ),
  false,
  "an R4B3 support-only non-contacted candidate must not leak into RetrievalEvent history",
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
  /initial_base_level_activation_projection:\s*baseLevelActivationProjection/,
  "native world loop must hand R3 evidence to Phase63C engine-side execution",
);
assert.match(
  worldLoopSource,
  /associative_activation_composition_evidence_exposed_to_resolver:\s*false/,
  "world-loop audit must preserve R4B3 resolver invisibility",
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
    "tests/phase64/phase64a-associative-activation-composition-evidence.test.mjs",
  ),
  true,
  "R4B3 test must be formally registered in tests/run-all.mjs",
);
console.log(
  JSON.stringify({
    ok: true,
    phase:
      "Phase64A-R4B3 Associative Activation Composition Evidence",
    candidate_frontier_order_preserved:
      true,
    r3_projected_rank_reused_as_candidate_authority:
      false,
    query_local_log_diagnostic_term_projected:
      true,
    log_diagnostic_term_used_as_activation:
      false,
    explicit_association_strengths_preserved:
      true,
    attention_weight_invented:
      false,
    maximum_associative_strength_invented:
      false,
    cue_independence_assumed:
      false,
    scalar_associative_activation_invented:
      false,
    lazy_evidence_component_dominance_verified:
      true,
    exhaustive_pairwise_matrix_materialized:
      false,
  }),
);
console.log(
  "Phase64A-R4B3 associative activation composition evidence: PASS",
);
