import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationCueDiagnosticEvidenceProjectionContract,
  projectWorldSimulationCueDiagnosticEvidence,
  worldSimulationCueDiagnosticEvidenceProjectionVersion,
} from "../../server/src/world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";

function memory({
  id,
  cues = [],
}) {
  return {
    memory_id: id,
    memory_type: "episodic_direct_perception",
    content: {
      label: id,
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    retrieval_cue_links:
      cues,
    retrieval_eligible: true,
    suppressed: false,
  };
}

function nativeQuery({
  memories,
  activeCues = [],
}) {
  return queryWorldSimulationMemoryAccessibility({
    character:
      "phase64a-r4a-observer",
    memory_records:
      memories,
    memory_retrieval_profile: {
      enabled: true,
      model_mode:
        "cue_dependent_v2",
    },
    simulation_time:
      "2026-08-28T20:00:00+08:00",
    scene_id:
      null,
    perception: {},
    context_cues: {},
    retrieval_context: {
      active_cues:
        activeCues,
    },
  });
}

const contract =
  buildWorldSimulationCueDiagnosticEvidenceProjectionContract();

assert.equal(
  contract.version,
  worldSimulationCueDiagnosticEvidenceProjectionVersion,
);
assert.equal(
  contract.phase,
  "Phase64A-R4A",
);
assert.equal(
  contract.source_phase63b_result_hash_verified,
  true,
);
assert.equal(
  contract.source_phase63b_candidate_membership_preserved,
  true,
);
assert.equal(
  contract.source_phase63b_candidate_order_preserved,
  true,
);
assert.equal(
  contract.query_relative_selectivity_transform,
  "1 / candidate_fan_out",
);
assert.equal(
  contract.whole_frontier_size_normalization_used,
  false,
);
assert.equal(
  contract.cue_diagnosticity_aggregation_used,
  false,
);
assert.equal(
  contract.attention_weight_inferred,
  false,
);
assert.equal(
  contract.association_strength_aggregate_inferred,
  false,
);
assert.equal(
  contract.scalar_cue_activation_modeled,
  false,
);
assert.equal(
  contract.retrieval_probability_modeled,
  false,
);
assert.equal(
  contract.dynamic_frontier_recomputation_required,
  true,
);
assert.equal(
  contract.character_brain_evidence_exposure_installed,
  false,
);
assert.equal(
  contract.retrieval_resolver_selectivity_scalar_exposure_installed,
  false,
);

const sharedCueMemories = [
  memory({
    id:
      "memory-unique-and-shared",
    cues: [
      {
        kind: "semantic",
        value: "unique",
        source: "fixture_unique",
      },
      {
        kind: "semantic",
        value: "shared",
        source: "fixture_shared_a",
      },
    ],
  }),
  memory({
    id:
      "memory-shared-b",
    cues: [
      {
        kind: "semantic",
        value: "shared",
        source: "fixture_shared_b",
      },
    ],
  }),
  memory({
    id:
      "memory-other",
    cues: [
      {
        kind: "semantic",
        value: "other",
        source: "fixture_other",
      },
    ],
  }),
];

const sharedQuery =
  nativeQuery({
    memories:
      sharedCueMemories,
    activeCues: [
      {
        kind: "semantic",
        value: "unique",
        source: "explicit_unique",
      },
      {
        kind: "semantic",
        value: "shared",
        source: "explicit_shared",
      },
    ],
  });

const sharedProjection =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      sharedQuery,
  });

assert.equal(
  sharedProjection.applicable,
  true,
);
assert.deepEqual(
  sharedProjection
    .candidate_memory_ids,
  [
    "memory-unique-and-shared",
    "memory-shared-b",
  ],
);
assert.equal(
  sharedProjection
    .boundaries
    .candidate_membership_changed,
  false,
);
assert.equal(
  sharedProjection
    .boundaries
    .candidate_order_changed,
  false,
);
assert.equal(
  sharedProjection
    .boundaries
    .retrieval_probability_claimed,
  false,
);

const byMemory =
  new Map(
    sharedProjection
      .candidate_evidence
      .map(
        (entry) => [
          entry.memory_id,
          entry,
        ],
      ),
  );

const firstEvidence =
  byMemory.get(
    "memory-unique-and-shared",
  );

const uniqueEvidence =
  firstEvidence
    .cue_evidence
    .find(
      (entry) =>
        entry.value === "unique",
    );

const sharedEvidence =
  firstEvidence
    .cue_evidence
    .find(
      (entry) =>
        entry.value === "shared",
    );

assert.equal(
  uniqueEvidence
    .candidate_fan_out,
  1,
);
assert.equal(
  uniqueEvidence
    .query_relative_selectivity_share,
  1,
);
assert.equal(
  uniqueEvidence
    .diagnosticity,
  "unique_within_current_query",
);

assert.equal(
  sharedEvidence
    .candidate_fan_out,
  2,
);
assert.equal(
  sharedEvidence
    .competing_candidate_count,
  1,
);
assert.deepEqual(
  sharedEvidence
    .competing_memory_ids,
  [
    "memory-shared-b",
  ],
);
assert.equal(
  sharedEvidence
    .query_relative_selectivity_share,
  0.5,
);
assert.equal(
  sharedEvidence
    .diagnosticity,
  "shared_within_current_query",
);
assert.equal(
  sharedEvidence
    .association_strength_aggregate,
  null,
);
assert.equal(
  sharedEvidence
    .attention_weight,
  null,
);
assert.equal(
  sharedEvidence
    .compound_group,
  null,
);
assert.equal(
  sharedEvidence
    .scalar_cue_activation,
  null,
);
assert.equal(
  firstEvidence
    .candidate_scalar_cue_activation,
  null,
);
assert.equal(
  firstEvidence
    .cue_diagnosticity_aggregate,
  null,
);

const strengthMemory =
  memory({
    id:
      "memory-explicit-strengths",
    cues: [
      {
        kind: "entity",
        value: "elias_noll",
        source: "explicit_link_a",
        association_evidence: {
          kind: "fixture",
          source: "a",
        },
        association_strength: 0.4,
      },
      {
        kind: "entity",
        value: "elias_noll",
        source: "explicit_link_b",
        association_evidence: {
          kind: "fixture",
          source: "b",
        },
        association_strength: 0.8,
      },
      {
        kind: "goal",
        value: "find_elias",
        source: "explicit_goal_link",
      },
    ],
  });

const strengthQuery =
  nativeQuery({
    memories: [
      strengthMemory,
    ],
    activeCues: [
      {
        kind: "entity",
        value: "elias_noll",
        source: "explicit_retrieval_context",
      },
      {
        kind: "goal",
        value: "find_elias",
        source: "explicit_retrieval_goal",
      },
    ],
  });

const strengthProjection =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      strengthQuery,
  });

const strengthCandidate =
  strengthProjection
    .candidate_evidence[0];

const entityEvidence =
  strengthCandidate
    .cue_evidence
    .find(
      (entry) =>
        entry.kind === "entity",
    );

const goalEvidence =
  strengthCandidate
    .cue_evidence
    .find(
      (entry) =>
        entry.kind === "goal",
    );

assert.deepEqual(
  entityEvidence
    .explicit_association_strength_values,
  [
    0.4,
    0.8,
  ],
);
assert.equal(
  entityEvidence
    .association_strength_aggregate,
  null,
);
assert.deepEqual(
  entityEvidence
    .memory_association_records
    .map(
      (entry) =>
        entry.association_strength,
    ),
  [
    0.4,
    0.8,
  ],
);
assert.equal(
  goalEvidence
    .active_sources
    .includes(
      "explicit_retrieval_goal",
    ),
  true,
);
assert.equal(
  goalEvidence
    .attention_weight,
  null,
);
assert.deepEqual(
  goalEvidence
    .explicit_association_strength_values,
  [],
  "missing association strength must not default to one",
);

const noCueQuery =
  nativeQuery({
    memories: [
      memory({
        id: "memory-no-cue-a",
      }),
      memory({
        id: "memory-no-cue-b",
      }),
    ],
    activeCues: [],
  });

const noCueProjection =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      noCueQuery,
  });

assert.equal(
  noCueProjection.applicable,
  true,
);
assert.deepEqual(
  noCueProjection
    .candidate_memory_ids,
  [
    "memory-no-cue-a",
    "memory-no-cue-b",
  ],
);
assert.equal(
  noCueProjection
    .candidate_evidence
    .every(
      (entry) =>
        entry.cue_evidence_count === 0
        && entry.cue_evidence.length === 0,
    ),
  true,
);

const legacyQuery =
  queryWorldSimulationMemoryAccessibility({
    character:
      "phase64a-r4a-observer",
    memory_records: [
      memory({
        id:
          "memory-legacy-a",
      }),
    ],
    simulation_time:
      "2026-08-28T20:00:00+08:00",
    perception: {},
  });

const legacyProjection =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      legacyQuery,
  });

assert.equal(
  legacyProjection.applicable,
  false,
);
assert.equal(
  legacyProjection
    .not_applicable_reason,
  "phase63b_model_mode_not_cue_dependent_v2",
);
assert.deepEqual(
  legacyProjection
    .candidate_evidence,
  [],
);
assert.deepEqual(
  legacyProjection
    .candidate_memory_ids,
  [
    "memory-legacy-a",
  ],
);

const tamperedHash =
  structuredClone(
    sharedQuery,
  );

tamperedHash
  .result
  .candidate_memory_count += 1;

assert.throws(
  () =>
    projectWorldSimulationCueDiagnosticEvidence({
      memory_accessibility_query:
        tamperedHash,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_CUE_DIAGNOSTIC_PHASE63B_RESULT_HASH_MISMATCH",
);

const tamperedCompetition =
  structuredClone(
    sharedQuery,
  );

const tamperedEval =
  tamperedCompetition
    .result
    .candidate_evaluations
    .find(
      (entry) =>
        entry.memory_id
        === "memory-unique-and-shared",
    );

const tamperedSharedCompetition =
  tamperedEval
    .cue_competition
    .find(
      (entry) =>
        entry.value === "shared",
    );

tamperedSharedCompetition
  .candidate_fan_out = 3;

tamperedCompetition
  .audit
  .result_hash =
    hashAgentRunValue(
      tamperedCompetition
        .result,
    );

assert.throws(
  () =>
    projectWorldSimulationCueDiagnosticEvidence({
      memory_accessibility_query:
        tamperedCompetition,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_COUNT_MISMATCH",
);

const selfCompetitor =
  structuredClone(
    sharedQuery,
  );

const selfEval =
  selfCompetitor
    .result
    .candidate_evaluations
    .find(
      (entry) =>
        entry.memory_id
        === "memory-unique-and-shared",
    );

const selfSharedCompetition =
  selfEval
    .cue_competition
    .find(
      (entry) =>
        entry.value === "shared",
    );

selfSharedCompetition
  .competing_memory_ids = [
    "memory-unique-and-shared",
  ];

selfCompetitor
  .audit
  .result_hash =
    hashAgentRunValue(
      selfCompetitor
        .result,
    );

assert.throws(
  () =>
    projectWorldSimulationCueDiagnosticEvidence({
      memory_accessibility_query:
        selfCompetitor,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_CUE_DIAGNOSTIC_SELF_COMPETITOR",
);

// Dynamic-frontier integration: a recovered cue changes the Phase63B query,
// therefore R4A must be recomputed and bound to the new frontier.
const dynamicMemories = [
  memory({
    id:
      "dynamic-seed",
    cues: [
      {
        kind: "semantic",
        value: "seed",
        source: "dynamic_seed",
      },
      {
        kind: "semantic",
        value: "bridge",
        source: "dynamic_bridge_seed",
      },
    ],
  }),
  memory({
    id:
      "dynamic-target",
    cues: [
      {
        kind: "semantic",
        value: "bridge",
        source: "dynamic_bridge_target",
      },
    ],
  }),
];

const dynamicAccessibilityBase = {
  character:
    "phase64a-r4a-observer",
  memory_records:
    dynamicMemories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode:
      "cue_dependent_v2",
  },
  simulation_time:
    "2026-08-28T20:00:00+08:00",
  scene_id:
    null,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "seed",
        source: "dynamic_initial",
      },
    ],
  },
};

const dynamicInitialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    dynamicAccessibilityBase,
  );

const dynamicInitialR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      dynamicInitialAccessibility,
  });

const dynamicQuery =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character:
      "phase64a-r4a-observer",
    turn_id:
      "phase64a-r4a-dynamic",
    phase63b_version:
      dynamicInitialAccessibility
        .memory_accessibility_version,
    memory_records:
      dynamicMemories,
    accessibility_base_input:
      dynamicAccessibilityBase,
    initial_accessibility_query:
      dynamicInitialAccessibility,
    initial_cue_diagnostic_projection:
      dynamicInitialR4A,
    retrieval_goal:
      null,
  });

assert.equal(
  dynamicQuery
    .initial_frontier
    .cue_diagnostic_projection
    .projection_id,
  dynamicInitialR4A
    .projection_id,
);
assert.equal(
  dynamicQuery
    .initial_frontier
    .cue_diagnostic_projection
    .evidence_hash,
  dynamicInitialR4A
    .evidence_hash,
);

let bridgeOptionId =
  null;

const dynamicResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query:
      dynamicQuery,
    memory_records:
      dynamicMemories,
    accessibility_base_input:
      dynamicAccessibilityBase,
    initial_accessibility_query:
      dynamicInitialAccessibility,
    initial_cue_diagnostic_projection:
      dynamicInitialR4A,
    technical_step_budget:
      3,
    perception: {},
    character_state: {},
    resolver:
      async (input) => {
        assert.equal(
          JSON.stringify(input)
            .includes(
              "query_relative_selectivity_share",
            ),
          false,
          "R4A selectivity scalar must remain hidden from retrieval resolver",
        );

        if (
          input.stage
          === "initiation"
        ) {
          return {
            process_occurred: true,
            initiation: {
              mode: "spontaneous",
              trigger_origin:
                "environmental_cue",
            },
            retrieval_task: {
              mode:
                "associative_recall",
            },
            target: null,
          };
        }

        if (
          input.stage
          === "recovery"
          && input.process
            .step_index === 0
        ) {
          assert.deepEqual(
            input
              .current_frontier
              .candidate_memory_records
              .map(
                (entry) =>
                  entry.memory_id,
              ),
            [
              "dynamic-seed",
            ],
          );

          return {
            contacted_candidate_refs: [
              "dynamic-seed",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "dynamic-seed",
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

        if (
          input.stage
          === "continuation"
          && input.process
            .step_index === 0
        ) {
          const bridge =
            input
              .available_reinstatement_cues
              .find(
                (option) =>
                  option.cue.kind
                    === "semantic"
                  && option.cue.value
                    === "bridge",
              );

          assert.ok(
            bridge,
          );

          bridgeOptionId =
            bridge
              .cue_option_id;

          return {
            control_action:
              "continue",
            control_reason:
              "reinstantiate bridge cue",
            selected_reinstatement_cue_refs: [
              bridgeOptionId,
            ],
          };
        }

        if (
          input.stage
          === "recovery"
          && input.process
            .step_index === 1
        ) {
          assert.equal(
            input
              .current_frontier
              .candidate_memory_records
              .some(
                (entry) =>
                  entry.memory_id
                  === "dynamic-target",
              ),
            true,
          );

          return {
            contacted_candidate_refs: [
              "dynamic-target",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "dynamic-target",
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

        if (
          input.stage
          === "continuation"
          && input.process
            .step_index === 1
        ) {
          return {
            control_action:
              "stop",
            control_reason:
              "dynamic evidence verified",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected resolver stage ${input.stage}/${input.process?.step_index}`,
        );
      },
  });

assert.equal(
  dynamicResult
    .retrieval_process
    .steps
    .length,
  2,
);
assert.equal(
  dynamicResult
    .retrieval_process
    .steps[0]
    .selected_reinstatement_cue_refs[0],
  bridgeOptionId,
);

const step0Diagnostic =
  dynamicResult
    .retrieval_process
    .steps[0]
    .frontier
    .cue_diagnostic_projection;

const step1Diagnostic =
  dynamicResult
    .retrieval_process
    .steps[1]
    .frontier
    .cue_diagnostic_projection;

assert.equal(
  step0Diagnostic
    .evidence_hash,
  dynamicInitialR4A
    .evidence_hash,
);
assert.notEqual(
  step1Diagnostic
    .evidence_hash,
  step0Diagnostic
    .evidence_hash,
  "dynamic frontier must receive freshly recomputed R4A evidence",
);
assert.equal(
  step1Diagnostic
    .applicable,
  true,
);
assert.equal(
  dynamicResult
    .engine_audit
    .cue_diagnostic_frontier_evidence_bound,
  true,
);
assert.equal(
  dynamicResult
    .engine_audit
    .cue_diagnostic_dynamic_frontier_recomputation_enabled,
  true,
);

const loopSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "server/src/world-simulation-loop-service.mjs",
      ),
      "utf8",
    )
  )
    .replace(
      /\r\n/g,
      "\n",
    );

const multistepSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "server/src/world-simulation-memory-retrieval-multistep-service.mjs",
      ),
      "utf8",
    )
  )
    .replace(
      /\r\n/g,
      "\n",
    );

const runAllSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "tests/run-all.mjs",
      ),
      "utf8",
    )
  )
    .replace(
      /\r\n/g,
      "\n",
    );

assert.equal(
  loopSource.includes(
    'from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";',
  ),
  true,
);
assert.equal(
  loopSource.includes(
    "initial_cue_diagnostic_projection:\n            cueDiagnosticEvidenceProjection,",
  ),
  true,
);
assert.equal(
  multistepSource.includes(
    "projectWorldSimulationCueDiagnosticEvidence",
  ),
  true,
);
assert.equal(
  multistepSource.includes(
    "initial_cue_diagnostic_projection",
  ),
  true,
);
assert.equal(
  multistepSource.includes(
    "cue_diagnostic_dynamic_frontier_recomputation_enabled",
  ),
  true,
);
assert.equal(
  runAllSource.includes(
    '["Phase 64A-R4A query-relative cue diagnostic evidence projection", ["tests/phase64/phase64a-query-relative-cue-diagnostic-evidence-projection.test.mjs"]]',
  ),
  true,
);

console.log(
  JSON.stringify({
    ok: true,
    phase:
      "Phase64A-R4A Query-Relative Cue Diagnostic Evidence Projection",
    query_relative_selectivity_projected:
      true,
    candidate_membership_preserved:
      true,
    candidate_order_preserved:
      true,
    explicit_association_strengths_preserved_without_aggregation:
      true,
    attention_weight_invented:
      false,
    scalar_cue_activation_invented:
      false,
    dynamic_frontier_recomputation_verified:
      true,
    resolver_selectivity_scalar_exposed:
      false,
    character_brain_evidence_exposed:
      false,
    persistent_memory_mutation_applied:
      false,
  }),
);

console.log(
  "Phase64A-R4A query-relative cue diagnostic evidence projection: PASS",
);
