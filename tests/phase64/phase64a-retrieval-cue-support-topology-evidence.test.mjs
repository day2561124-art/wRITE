import assert from "node:assert/strict";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  projectWorldSimulationCueDiagnosticEvidence,
} from "../../server/src/world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQueryV3,
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  buildWorldSimulationRetrievalCueSupportTopologyContract,
  projectWorldSimulationRetrievalCueSupportTopologyEvidence,
  worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-cue-support-topology-evidence-service.mjs";

const R4A_VERSION =
  "phase64a-query-relative-cue-diagnostic-evidence-projection-v1";
const R4B1_VERSION =
  "phase64a-r4b1-retrieval-cue-orientation-evidence-v1";

const cue = (name) =>
  JSON.stringify([
    "semantic",
    name,
  ]);

const A = cue("a");
const B = cue("b");
const C = cue("c");
const D = cue("d");
const E = cue("e");
const F = cue("f");

const candidateIds = [
  "memory_1",
  "memory_2",
  "memory_3",
  "memory_4",
  "memory_5",
];

function cueEvidence(cueIdentity) {
  return {
    cue_identity:
      cueIdentity,
  };
}

const candidateEvidence = [
  {
    memory_id: "memory_1",
    candidate_index: 0,
    cue_evidence: [
      cueEvidence(A),
      cueEvidence(B),
      cueEvidence(F),
    ],
  },
  {
    memory_id: "memory_2",
    candidate_index: 1,
    cue_evidence: [
      cueEvidence(A),
      cueEvidence(B),
      cueEvidence(C),
      cueEvidence(F),
    ],
  },
  {
    memory_id: "memory_3",
    candidate_index: 2,
    cue_evidence: [
      cueEvidence(A),
      cueEvidence(C),
      cueEvidence(F),
    ],
  },
  {
    memory_id: "memory_4",
    candidate_index: 3,
    cue_evidence: [
      cueEvidence(C),
    ],
  },
  {
    memory_id: "memory_5",
    candidate_index: 4,
    cue_evidence: [
      cueEvidence(D),
    ],
  },
];

function buildR4AProjection() {
  const evidenceHash =
    hashAgentRunValue(
      candidateEvidence,
    );

  return {
    version:
      R4A_VERSION,
    projection_id:
      "cue_diagnostic_evidence_projection_fixture",
    applicable:
      true,
    candidate_memory_ids:
      structuredClone(
        candidateIds,
      ),
    candidate_evidence:
      structuredClone(
        candidateEvidence,
      ),
    evidence_hash:
      evidenceHash,
    audit: {
      evidence_hash:
        evidenceHash,
    },
  };
}

function selectedCue(
  optionId,
  identity,
) {
  return {
    cue_option_id:
      optionId,
    canonical_cue_identity:
      identity,
    canonical_cue: {
      kind: "semantic",
      value:
        JSON.parse(identity)[1],
    },
    character_surface: {
      kind: "semantic",
      representation:
        JSON.parse(identity)[1],
    },
    provenance_class:
      "explicit_retrieval_context",
  };
}

function buildR4B1Evidence({
  triggerSelections = [],
  triggerStatus = "grounded",
  orientationSelections = [],
  orientationStatus = "selected",
  orientationApplicable = true,
  initiationMode = "deliberate",
} = {}) {
  const body = {
    schema_version:
      R4B1_VERSION,
    version:
      R4B1_VERSION,
    query_id:
      "query_r4b2_fixture",
    source_initial_frontier_id:
      "frontier_r4b2_fixture",
    option_set_hash:
      "orientation_option_set_fixture",
    initiation_mode:
      initiationMode,
    trigger: {
      trigger_origin:
        initiationMode === "spontaneous"
          ? "environmental_cue"
          : "self_generated",
      grounding_status:
        triggerStatus,
      grounded_cue_refs:
        structuredClone(
          triggerSelections,
        ),
    },
    orientation: {
      applicable:
        orientationApplicable,
      status:
        orientationStatus,
      grounded_cue_refs:
        structuredClone(
          orientationSelections,
        ),
      maintenance_mode:
        orientationApplicable
          ? "process_goal_stable_v1"
          : "not_applicable",
    },
    boundaries: {
      grounded_option_refs_only: true,
      attention_weight_modeled: false,
      phase64a_r4a_diagnosticity_used_for_selection: false,
      candidate_membership_changed: false,
      candidate_order_changed: false,
      retrieval_contact_changed: false,
      retrieval_recovery_changed: false,
      retrieval_probability_modeled: false,
      persistent_memory_mutated: false,
      character_brain_exposure_allowed: false,
    },
    immutable:
      true,
  };

  const evidenceHash =
    hashAgentRunValue(
      body,
    );

  return {
    ...body,
    orientation_evidence_id:
      `memory_retrieval_orientation_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  };
}

function buildFrontier(
  r4a,
) {
  return {
    frontier_id:
      "frontier_r4b2_fixture",
    candidate_refs:
      candidateIds.map(
        (memoryId) => ({
          memory_id:
            memoryId,
        }),
      ),
    cue_diagnostic_projection: {
      version:
        R4A_VERSION,
      projection_id:
        r4a.projection_id,
      evidence_hash:
        r4a.evidence_hash,
      applicable:
        true,
    },
  };
}

function project({
  r4a = buildR4AProjection(),
  r4b1,
  frontier = null,
} = {}) {
  const effectiveR4B1 =
    r4b1
    ?? buildR4B1Evidence({
      triggerSelections: [
        selectedCue("cue_d", D),
      ],
      orientationSelections: [
        selectedCue("cue_a", A),
        selectedCue("cue_b", B),
        selectedCue("cue_c", C),
      ],
    });

  return projectWorldSimulationRetrievalCueSupportTopologyEvidence({
    query_id:
      "query_r4b2_fixture",
    source_initial_frontier:
      frontier
      ?? buildFrontier(r4a),
    cue_diagnostic_projection:
      r4a,
    cue_orientation_evidence:
      effectiveR4B1,
  });
}

const contract =
  buildWorldSimulationRetrievalCueSupportTopologyContract();

assert.equal(
  contract.version,
  worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
);
assert.equal(contract.phase, "Phase64A-R4B2");
assert.equal(contract.support_topology_is_initial_frontier_bound, true);
assert.equal(contract.trigger_and_orientation_topologies_distinguished, true);
assert.equal(contract.trigger_orientation_topologies_merged, false);
assert.equal(contract.individual_support_modeled, true);
assert.equal(contract.pairwise_joint_support_modeled, true);
assert.equal(contract.full_selected_set_support_modeled, true);
assert.equal(contract.all_subset_enumeration_used, false);
assert.equal(contract.statistical_dependency_inferred, false);
assert.equal(contract.encoded_compound_binding_inferred, false);
assert.equal(contract.scalar_activation_modeled, false);
assert.equal(contract.retrieval_probability_modeled, false);
assert.equal(contract.candidate_membership_authority, false);
assert.equal(contract.candidate_order_authority, false);
assert.equal(contract.retrieval_contact_authority, false);
assert.equal(contract.retrieval_recovery_authority, false);
assert.equal(contract.dynamic_support_topology_recomputation, false);
assert.equal(contract.phase63c_reinstated_cues_included, false);
assert.equal(contract.retrieval_resolver_support_topology_exposed, false);
assert.equal(contract.full_support_topology_persisted, false);

const inputR4A =
  buildR4AProjection();
const inputR4B1 =
  buildR4B1Evidence({
    triggerSelections: [
      selectedCue("cue_d", D),
    ],
    orientationSelections: [
      selectedCue("cue_a", A),
      selectedCue("cue_b", B),
      selectedCue("cue_c", C),
    ],
  });
const inputFrontier =
  buildFrontier(
    inputR4A,
  );
const inputSnapshot =
  structuredClone({
    inputR4A,
    inputR4B1,
    inputFrontier,
  });

const topology =
  projectWorldSimulationRetrievalCueSupportTopologyEvidence({
    query_id:
      "query_r4b2_fixture",
    source_initial_frontier:
      inputFrontier,
    cue_diagnostic_projection:
      inputR4A,
    cue_orientation_evidence:
      inputR4B1,
  });

assert.deepEqual(
  {
    inputR4A,
    inputR4B1,
    inputFrontier,
  },
  inputSnapshot,
  "R4B2 projection must not mutate its inputs",
);
assert.equal(Object.isFrozen(topology), true);
assert.equal(Object.isFrozen(topology.channels), true);
assert.equal(Object.isFrozen(topology.channels.orientation.individual_support), true);
assert.equal(topology.source_initial_frontier_id, "frontier_r4b2_fixture");
assert.equal(topology.source_r4a_projection_id, inputR4A.projection_id);
assert.equal(topology.source_r4b1_orientation_evidence_id, inputR4B1.orientation_evidence_id);

assert.deepEqual(
  topology.channels.trigger.individual_support[0].support_candidate_ids,
  ["memory_5"],
);
assert.deepEqual(
  topology.channels.orientation.individual_support[0].support_candidate_ids,
  ["memory_1", "memory_2", "memory_3"],
);
assert.deepEqual(
  topology.channels.orientation.individual_support[1].support_candidate_ids,
  ["memory_1", "memory_2"],
);
assert.deepEqual(
  topology.channels.orientation.individual_support[2].support_candidate_ids,
  ["memory_2", "memory_3", "memory_4"],
);

assert.equal(
  topology.channels.orientation.pairwise_joint_support[0].relation,
  "right_proper_subset",
);
assert.deepEqual(
  topology.channels.orientation.pairwise_joint_support[0].joint_support_candidate_ids,
  ["memory_1", "memory_2"],
);
assert.equal(
  topology.channels.orientation.pairwise_joint_support[1].relation,
  "partial_overlap",
);
assert.deepEqual(
  topology.channels.orientation.pairwise_joint_support[1].joint_support_candidate_ids,
  ["memory_2", "memory_3"],
);
assert.equal(
  topology.channels.orientation.pairwise_joint_support[2].relation,
  "partial_overlap",
);
assert.deepEqual(
  topology.channels.orientation.pairwise_joint_support[2].joint_support_candidate_ids,
  ["memory_2"],
);
assert.deepEqual(
  topology.channels.orientation.full_selected_set_support,
  {
    status: "present",
    cue_refs: ["cue_a", "cue_b", "cue_c"],
    joint_support_candidate_ids: ["memory_2"],
    joint_support_candidate_count: 1,
  },
);

const oneCue =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_a", A),
        ],
      }),
  });
assert.equal(oneCue.channels.orientation.pairwise_joint_support.length, 0);
assert.deepEqual(
  oneCue.channels.orientation.full_selected_set_support.joint_support_candidate_ids,
  ["memory_1", "memory_2", "memory_3"],
);

const identical =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_a", A),
          selectedCue("cue_f", F),
        ],
      }),
  });
assert.equal(
  identical.channels.orientation.pairwise_joint_support[0].relation,
  "identical_nonempty",
);

const disjoint =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_a", A),
          selectedCue("cue_d", D),
        ],
      }),
  });
assert.equal(
  disjoint.channels.orientation.pairwise_joint_support[0].relation,
  "disjoint_nonempty",
);
assert.equal(
  disjoint.channels.orientation.full_selected_set_support.status,
  "empty",
);

const zeroSupport =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_e", E),
        ],
      }),
  });
assert.equal(
  zeroSupport.channels.orientation.individual_support[0].support_candidate_count,
  0,
);
assert.equal(
  zeroSupport.channels.orientation.full_selected_set_support.status,
  "empty",
);

const rightEmpty =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_d", D),
          selectedCue("cue_e", E),
        ],
      }),
  });
assert.equal(
  rightEmpty.channels.orientation.pairwise_joint_support[0].relation,
  "right_empty",
);

const emptyFullButPairwiseSupport =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unspecified",
        orientationSelections: [
          selectedCue("cue_a", A),
          selectedCue("cue_c", C),
          selectedCue("cue_d", D),
        ],
      }),
  });
assert.ok(
  emptyFullButPairwiseSupport.channels.orientation.pairwise_joint_support
    .some((entry) => entry.joint_support_candidate_count > 0),
);
assert.equal(
  emptyFullButPairwiseSupport.channels.orientation.full_selected_set_support.status,
  "empty",
);

const deliberateNoOrientation =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [
          selectedCue("cue_a", A),
        ],
        orientationSelections: [],
        orientationStatus: "no_explicit_orientation",
      }),
  });
assert.equal(deliberateNoOrientation.channels.orientation.applicable, true);
assert.equal(deliberateNoOrientation.channels.orientation.selected_cue_count, 0);
assert.equal(
  deliberateNoOrientation.channels.orientation.full_selected_set_support.status,
  "not_applicable",
);
assert.equal(deliberateNoOrientation.channels.trigger.selected_cue_count, 1);

const spontaneousGrounded =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [
          selectedCue("cue_c", C),
        ],
        triggerStatus: "grounded",
        orientationSelections: [],
        orientationStatus: "not_applicable",
        orientationApplicable: false,
        initiationMode: "spontaneous",
      }),
  });
assert.equal(spontaneousGrounded.channels.trigger.selected_cue_count, 1);
assert.equal(spontaneousGrounded.channels.orientation.applicable, false);
assert.equal(
  spontaneousGrounded.channels.orientation.full_selected_set_support.status,
  "not_applicable",
);

const spontaneousUnresolved =
  project({
    r4b1:
      buildR4B1Evidence({
        triggerSelections: [],
        triggerStatus: "unresolved",
        orientationSelections: [],
        orientationStatus: "not_applicable",
        orientationApplicable: false,
        initiationMode: "spontaneous",
      }),
  });
assert.equal(spontaneousUnresolved.channels.trigger.basis_status, "unresolved");
assert.equal(spontaneousUnresolved.channels.trigger.selected_cue_count, 0);

assert.equal(topology.boundaries.statistical_dependency_inferred, false);
assert.equal(topology.boundaries.encoded_compound_binding_inferred, false);
assert.equal(topology.boundaries.configural_binding_inferred, false);
assert.equal(topology.boundaries.attention_weight_modeled, false);
assert.equal(topology.boundaries.association_strength_aggregate_inferred, false);
assert.equal(topology.boundaries.scalar_activation_modeled, false);
assert.equal(topology.boundaries.retrieval_probability_modeled, false);
assert.equal(topology.boundaries.candidate_membership_changed, false);
assert.equal(topology.boundaries.candidate_order_changed, false);
assert.equal(topology.boundaries.retrieval_contact_changed, false);
assert.equal(topology.boundaries.retrieval_recovery_changed, false);
assert.equal(topology.boundaries.dynamic_frontier_recomputation_used, false);
assert.equal(topology.boundaries.phase63c_reinstated_cues_included, false);
assert.equal(topology.boundaries.resolver_exposure_allowed, false);
assert.equal(topology.boundaries.full_topology_persistence_allowed, false);

{
  const tampered =
    buildR4AProjection();
  tampered.candidate_evidence[0].cue_evidence.push(
    cueEvidence(C),
  );

  assert.throws(
    () =>
      project({
        r4a:
          tampered,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_EVIDENCE_HASH_MISMATCH",
  );
}

{
  const tampered =
    buildR4B1Evidence({
      triggerSelections: [],
      triggerStatus: "unspecified",
      orientationSelections: [
        selectedCue("cue_a", A),
      ],
    });
  tampered.orientation.status =
    "no_explicit_orientation";

  assert.throws(
    () =>
      project({
        r4b1:
          tampered,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_EVIDENCE_HASH_MISMATCH",
  );
}

{
  const r4a =
    buildR4AProjection();
  const frontier =
    buildFrontier(r4a);
  frontier.candidate_refs = [
    frontier.candidate_refs[1],
    frontier.candidate_refs[0],
    ...frontier.candidate_refs.slice(2),
  ];

  assert.throws(
    () =>
      project({
        r4a,
        frontier,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_CANDIDATE_ORDER_MISMATCH",
  );
}

{
  const r4a =
    buildR4AProjection();
  r4a.applicable =
    false;

  assert.throws(
    () =>
      project({
        r4a,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_NOT_APPLICABLE",
  );
}


const integrationCharacter =
  "phase64a-r4b2-integration-observer";
const integrationScene =
  "ENGINE_PRIVATE_SCENE_R4B2_913";

const integrationMemories = [
  {
    memory_id: "r4b2-integration-memory-a",
    content: {
      detail: "橋邊有人停下來。",
    },
    retrieval_cues: {
      scene_id: integrationScene,
      memory_type: "episodic_direct_perception",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "bridge",
        source: "r4b2-integration-shared-bridge",
      },
      {
        kind: "entity",
        value: "elias",
        source: "r4b2-integration-unique-entity",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id: "r4b2-integration-memory-b",
    content: {
      detail: "橋邊另一段無關的記憶。",
    },
    retrieval_cues: {
      scene_id: integrationScene,
      memory_type: "episodic_direct_perception",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "bridge",
        source: "r4b2-integration-shared-bridge",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
];

const integrationAccessibilityBase = {
  character:
    integrationCharacter,
  memory_records:
    integrationMemories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode: "cue_dependent_v2",
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
        source: "explicit_retrieval_context",
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
      "r4b2-integration-turn",
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
    initial_cue_diagnostic_projection:
      integrationInitialR4A,
    technical_step_budget: 2,
    perception: {
      current_activity: "remembering",
    },
    character_state: {
      mood: "neutral",
    },
    resolver:
      async (input) => {
        const serialized =
          JSON.stringify(input);

        assert.equal(
          serialized.includes("cue_support_topology"),
          false,
          "R4B2 engine topology must never be exposed to the resolver",
        );
        assert.equal(
          serialized.includes("topology_evidence"),
          false,
          "R4B2 topology evidence identifiers must remain engine-side",
        );

        if (input.stage === "initiation") {
          const bridge =
            input.available_cue_orientation_options
              .find(
                (option) =>
                  option.character_surface
                    ?.representation
                  === "bridge",
              );
          const surroundings =
            input.available_cue_orientation_options
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
              trigger_origin: "external_prompt",
            },
            retrieval_task: {
              mode: "cued_recall",
            },
            target: null,
            cue_orientation_resolution: {
              trigger: {
                grounding_status: "grounded",
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

        if (input.stage === "recovery") {
          integrationRecoveryCount += 1;

          if (input.process.step_index === 0) {
            initialRuntimeFrontierId =
              input.current_frontier.frontier_id;

            return {
              contacted_candidate_refs: [
                "r4b2-integration-memory-a",
              ],
              recovered_selections: [
                {
                  source_memory_ref:
                    "r4b2-integration-memory-a",
                  selector: {
                    kind: "whole_content",
                  },
                  content_kind: "detail",
                },
              ],
            };
          }

          reinstatedRuntimeFrontierId =
            input.current_frontier.frontier_id;

          return {
            contacted_candidate_refs: [],
            recovered_selections: [],
          };
        }

        if (input.stage === "continuation") {
          if (input.process.step_index === 0) {
            const entityCue =
              input.available_reinstatement_cues
                .find(
                  (option) =>
                    option.cue?.kind === "entity"
                    && option.cue?.value === "elias",
                );

            assert.ok(
              entityCue,
              "the recovered memory must expose a grounded unique reinstatement cue",
            );

            return {
              control_action: "continue",
              control_reason:
                "r4b2 dynamic-frontier isolation probe",
              selected_reinstatement_cue_refs: [
                entityCue.cue_option_id,
              ],
            };
          }

          return {
            control_action: "stop",
            control_reason:
              "r4b2 integration fixture complete",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected resolver stage: ${input.stage}`,
        );
      },
  });

assert.equal(integrationResult.process_occurred, true);
assert.equal(integrationRecoveryCount, 2);
assert.ok(initialRuntimeFrontierId);
assert.ok(reinstatedRuntimeFrontierId);
assert.notEqual(
  reinstatedRuntimeFrontierId,
  initialRuntimeFrontierId,
  "internal cue reinstatement must create a new runtime frontier without rewriting initial R4B2 evidence",
);

const integrationTopology =
  integrationResult
    .initial_cue_support_topology_evidence;
assert.equal(
  integrationTopology.version,
  worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
);
assert.equal(
  integrationTopology.source_initial_frontier_id,
  initialRuntimeFrontierId,
);
assert.equal(
  integrationResult
    .retrieval_process
    .initial_cue_support_topology_evidence_hash,
  integrationTopology.evidence_hash,
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
  integrationTopology
    .boundaries
    .dynamic_frontier_recomputation_used,
  false,
);
assert.equal(
  integrationTopology
    .boundaries
    .phase63c_reinstated_cues_included,
  false,
);
assert.equal(
  integrationTopology
    .channels
    .orientation
    .selected_cue_count,
  2,
);
assert.equal(
  integrationTopology
    .channels
    .orientation
    .pairwise_joint_support
    .length,
  1,
);
assert.deepEqual(
  integrationTopology
    .channels
    .orientation
    .pairwise_joint_support[0]
    .joint_support_candidate_ids,
  [
    "r4b2-integration-memory-a",
    "r4b2-integration-memory-b",
  ],
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_cue_support_topology_evidence_materialized,
  true,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_cue_support_topology_exposed_to_resolver,
  false,
);
assert.equal(
  integrationResult
    .engine_audit
    .retrieval_cue_support_topology_dynamic_recomputation_used,
  false,
);

const integrationProcessContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();
assert.equal(
  integrationProcessContract
    .phase64a_r4b2_new_resolver_stage_added,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b2_initial_frontier_bound,
  true,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b2_dynamic_support_topology_recomputation,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b2_retrieval_resolver_support_topology_exposed,
  false,
);
assert.equal(
  integrationProcessContract
    .phase64a_r4b2_full_support_topology_persisted,
  false,
);

const integrationPersistenceContract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();
assert.equal(
  integrationPersistenceContract
    .retrieval_cue_support_topology_full_evidence_persisted,
  false,
);
assert.equal(
  integrationPersistenceContract
    .retrieval_cue_support_topology_hash_committed_via_retrieval_process_hash,
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
      "r4b2-integration-turn",
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
  integrationPersistedEvent.retrieval_process_hash,
  hashAgentRunValue(
    integrationResult.retrieval_process,
  ),
);
assert.equal(
  integrationPersistedEvent
    .engine_audit
    .retrieval_cue_support_topology_full_evidence_persisted,
  false,
);
assert.equal(
  integrationPersistedEvent
    .engine_audit
    .retrieval_cue_support_topology_hash_committed_via_retrieval_process_hash,
  true,
);
assert.equal(
  JSON.stringify(integrationPersistedEvent)
    .includes("initial_cue_support_topology_evidence"),
  false,
  "full R4B2 topology evidence must remain ephemeral and absent from RetrievalEvent persistence",
);
assert.equal(
  JSON.stringify(integrationPersistedEvent)
    .includes("r4b2-integration-memory-b"),
  false,
  "a support-only non-contacted candidate must not leak into RetrievalEvent history",
);

console.log(
  "Phase64A R4B2 retrieval cue support topology evidence tests passed.",
);
