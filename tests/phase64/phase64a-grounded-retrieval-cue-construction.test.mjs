import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationGroundedRetrievalCueConstructionContract,
  buildWorldSimulationGroundedRetrievalCueConstructionResolverView,
  buildWorldSimulationGroundedRetrievalCueConstructionSourceSet,
  materializeWorldSimulationGroundedRetrievalCueConstructionEvidence,
  validateWorldSimulationGroundedRetrievalCueConstructionEvidence,
  worldSimulationGroundedRetrievalCueConstructionCueSource,
} from "../../server/src/world-simulation-grounded-retrieval-cue-construction-service.mjs";

const contract =
  buildWorldSimulationGroundedRetrievalCueConstructionContract();

assert.equal(
  contract.phase,
  "Phase64A-R4E2",
);
assert.equal(
  contract.source_material_requires_current_character_access,
  true,
);
assert.equal(
  contract.whole_character_knowledge_snapshot_exposed,
  false,
);
assert.equal(
  contract.full_memory_record_exposed,
  false,
);
assert.equal(
  contract.unrecovered_memory_content_exposed,
  false,
);
assert.equal(
  contract.engine_world_knowledge_exposed,
  false,
);
assert.equal(
  contract.future_event_queue_exposed,
  false,
);
assert.equal(
  contract.character_state_exposed_to_cue_construction,
  false,
);
assert.equal(
  contract.hidden_semantic_graph_traversal_allowed,
  false,
);
assert.equal(
  contract.free_semantic_association_without_materialized_semantic_access,
  false,
);
assert.equal(
  contract.fixed_derivation_depth,
  false,
);
assert.equal(
  contract.immediate_parent_provenance_required,
  true,
);
assert.equal(
  contract.cue_proposition_is_recovered_fact,
  false,
);
assert.equal(
  contract.cue_proposition_truth_verified,
  false,
);
assert.equal(
  contract.resolver_may_author_cue_proposition,
  true,
);
assert.equal(
  contract.resolver_may_select_active_cue,
  false,
);
assert.equal(
  contract.stop_decision_authority,
  false,
);
assert.equal(
  contract.continuation_decision_authority,
  false,
);
assert.equal(
  contract.persistent_memory_mutation_authority,
  false,
);

const syntheticSourceSet =
  buildWorldSimulationGroundedRetrievalCueConstructionSourceSet({
    query_id:
      "phase64a-r4e2-source-fixture",
    step_index:
      0,
    recovered_fragments: [
      {
        fragment_id:
          "fragment-clue",
        source_memory_ref:
          "memory-seed",
        content: {
          clue:
            "橋邊的燈",
        },
      },
    ],
    perception: {
      observed: [
        "雨聲",
      ],
    },
    retrieval_goal: {
      kind:
        "memory_content",
      memory_id:
        "memory-target",
    },
    prior_selected_cue_propositions: [],
  });

assert.equal(
  syntheticSourceSet.sources.some(
    (source) =>
      source.source_kind === "recovered_content"
      && source.value === "橋邊的燈",
  ),
  true,
);
assert.equal(
  syntheticSourceSet.sources.some(
    (source) =>
      source.source_kind === "bounded_perception"
      && source.value === "雨聲",
  ),
  true,
);
assert.equal(
  JSON.stringify(syntheticSourceSet)
    .includes("SEED_UNRETRIEVED_DETAIL"),
  false,
);

const resolverView =
  buildWorldSimulationGroundedRetrievalCueConstructionResolverView(
    syntheticSourceSet,
  );

const clueSource =
  resolverView.source_material.find(
    (source) =>
      source.source_kind === "recovered_content"
      && source.value === "橋邊的燈",
  );

assert.ok(clueSource);
assert.equal(
  Object.hasOwn(
    resolverView,
    "character_state",
  ),
  false,
);
assert.equal(
  Object.hasOwn(
    resolverView,
    "memory_records",
  ),
  false,
);

const syntheticEvidence =
  materializeWorldSimulationGroundedRetrievalCueConstructionEvidence({
    source_set:
      syntheticSourceSet,
    resolution: {
      cue_proposals: [
        {
          proposal_ref:
            "bridge-abstraction",
          transformation:
            "abstraction",
          parent_refs: [
            clueSource.source_ref,
          ],
          cue: {
            kind:
              "semantic",
            value:
              "bridge",
          },
        },
      ],
    },
  });

assert.equal(
  syntheticEvidence.cue_options.length,
  1,
);
assert.equal(
  syntheticEvidence.cue_options[0]
    .construction
    .controlled_cue_construction,
  true,
);
assert.equal(
  syntheticEvidence.cue_options[0]
    .construction
    .proposition_truth_verified,
  false,
);
assert.equal(
  syntheticEvidence.cue_options[0]
    .construction
    .recovered_fact_asserted,
  false,
);
assert.equal(
  syntheticEvidence.cue_options[0]
    .construction
    .semantic_knowledge_asserted,
  false,
);
assert.deepEqual(
  syntheticEvidence.cue_options[0]
    .construction
    .parent_refs,
  [
    clueSource.source_ref,
  ],
);
assert.equal(
  syntheticEvidence.boundaries
    .cue_selection_authority,
  false,
);
assert.equal(
  syntheticEvidence.boundaries
    .stop_decision_authority,
  false,
);
assert.ok(
  Object.isFrozen(
    syntheticEvidence,
  ),
);

assert.deepEqual(
  validateWorldSimulationGroundedRetrievalCueConstructionEvidence(
    syntheticEvidence,
  ),
  syntheticEvidence,
);

const tampered =
  structuredClone(
    syntheticEvidence,
  );

tampered.cue_options[0]
  .cue.value =
  "tampered";

assert.throws(
  () =>
    validateWorldSimulationGroundedRetrievalCueConstructionEvidence(
      tampered,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_EVIDENCE_HASH_MISMATCH",
);

assert.throws(
  () =>
    buildWorldSimulationGroundedRetrievalCueConstructionSourceSet({
      query_id:
        "hidden-input",
      step_index:
        0,
      recovered_fragments: [],
      world_state: {
        hidden:
          true,
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_HIDDEN_INPUT_FORBIDDEN",
);

assert.throws(
  () =>
    materializeWorldSimulationGroundedRetrievalCueConstructionEvidence({
      source_set:
        syntheticSourceSet,
      resolution: {
        cue_proposals: [
          {
            proposal_ref:
              "unknown-parent",
            transformation:
              "abstraction",
            parent_refs: [
              "not-materialized",
            ],
            cue: {
              kind:
                "semantic",
              value:
                "bridge",
            },
          },
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PARENT_OUTSIDE_SOURCE_SET",
);

assert.throws(
  () =>
    materializeWorldSimulationGroundedRetrievalCueConstructionEvidence({
      source_set:
        syntheticSourceSet,
      resolution: {
        control_action:
          "continue",
        cue_proposals: [],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CONTROL_AUTHORITY_FORBIDDEN",
);

assert.throws(
  () =>
    materializeWorldSimulationGroundedRetrievalCueConstructionEvidence({
      source_set:
        syntheticSourceSet,
      resolution: {
        cue_proposals: [
          {
            proposal_ref:
              "semantic-without-access",
            transformation:
              "semantic_association",
            parent_refs: [
              clueSource.source_ref,
            ],
            cue: {
              kind:
                "semantic",
              value:
                "river",
            },
          },
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_SEMANTIC_ACCESS_NOT_MATERIALIZED",
);

const memories = [
  {
    memory_id:
      "memory_seed",
    memory_type:
      "episodic_direct_perception",
    content: {
      clue:
        "橋邊的燈",
      unretrieved_detail:
        "SEED_UNRETRIEVED_DETAIL",
    },
    source: {
      kind:
        "direct_perception",
      sense:
        "visual",
    },
    retrieval_cue_links: [
      {
        kind:
          "semantic",
        value:
          "seed",
      },
      {
        kind:
          "semantic",
        value:
          "bridge",
      },
    ],
    retrieval_eligible:
      true,
    suppressed:
      false,
  },
  {
    memory_id:
      "memory_target",
    memory_type:
      "episodic_direct_perception",
    content: {
      answer:
        "伊萊亞斯在橋邊停下",
      hidden_detail:
        "TARGET_HIDDEN_DETAIL",
    },
    retrieval_cue_links: [
      {
        kind:
          "semantic",
        value:
          "bridge",
      },
    ],
    retrieval_eligible:
      true,
    suppressed:
      false,
  },
];

const accessibilityBaseInput = {
  character:
    "伊萊亞斯・諾爾",
  memory_records:
    memories,
  memory_retrieval_profile: {
    enabled:
      true,
    model_mode:
      "cue_dependent_v2",
  },
  simulation_time:
    "2026-08-30T05:00:00+08:00",
  scene_id:
    null,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind:
          "semantic",
        value:
          "seed",
        source:
          "fixture_initial_cue",
      },
    ],
  },
};

const initialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    accessibilityBaseInput,
  );

assert.deepEqual(
  initialAccessibility
    .result
    .candidate_memory_records
    .map(
      (record) =>
        record.memory_id,
    ),
  [
    "memory_seed",
  ],
);

const target = {
  kind:
    "memory_content",
  memory_id:
    "memory_target",
  requested_selectors: [
    {
      kind:
        "json_pointer",
      path:
        "/answer",
    },
  ],
};

const query =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character:
      "伊萊亞斯・諾爾",
    turn_id:
      "phase64a-r4e2-integration",
    phase63b_version:
      initialAccessibility
        .memory_accessibility_version,
    memory_records:
      memories,
    accessibility_base_input:
      accessibilityBaseInput,
    initial_accessibility_query:
      initialAccessibility,
    retrieval_goal:
      target,
  });

const stages = [];
let selectedConstructedCueRef = null;

const result =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records:
      memories,
    accessibility_base_input:
      accessibilityBaseInput,
    initial_accessibility_query:
      initialAccessibility,
    technical_step_budget:
      4,
    perception: {
      observed: [
        "角色現在只看得到橋邊燈光",
      ],
    },
    character_state: {
      hidden_stored_knowledge:
        "CHARACTER_STATE_MUST_NOT_REACH_R4E2",
    },
    resolver:
      async (input) => {
        stages.push(
          `${input.stage}:${input.process?.step_index ?? "init"}`,
        );

        if (
          input.stage
          === "initiation"
        ) {
          return {
            process_occurred:
              true,
            initiation: {
              mode:
                "deliberate",
              trigger_origin:
                "self_generated",
            },
            retrieval_task: {
              mode:
                "cued_recall",
            },
            target,
          };
        }

        if (
          input.stage
          === "recovery"
          && input.process.step_index === 0
        ) {
          return {
            contacted_candidate_refs: [
              "memory_seed",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "memory_seed",
                selector: {
                  kind:
                    "json_pointer",
                  path:
                    "/clue",
                },
                content_kind:
                  "detail",
              },
            ],
            cue_construction_requested:
              true,
          };
        }

        if (
          input.stage
          === "cue_construction"
          && input.process.step_index === 0
        ) {
          assert.equal(
            JSON.stringify(input)
              .includes(
                "SEED_UNRETRIEVED_DETAIL",
              ),
            false,
          );
          assert.equal(
            JSON.stringify(input)
              .includes(
                "TARGET_HIDDEN_DETAIL",
              ),
            false,
          );
          assert.equal(
            JSON.stringify(input)
              .includes(
                "CHARACTER_STATE_MUST_NOT_REACH_R4E2",
              ),
            false,
          );
          assert.equal(
            Object.hasOwn(
              input,
              "character_state",
            ),
            false,
          );
          assert.equal(
            Object.hasOwn(
              input,
              "memory_records",
            ),
            false,
          );

          const source =
            input
              .source_material
              .find(
                (entry) =>
                  entry.source_kind
                    === "recovered_content"
                  && entry.value
                    === "橋邊的燈",
              );

          assert.ok(source);

          return {
            cue_proposals: [
              {
                proposal_ref:
                  "bridge-from-materialized-clue",
                transformation:
                  "abstraction",
                parent_refs: [
                  source.source_ref,
                ],
                cue: {
                  kind:
                    "semantic",
                  value:
                    "bridge",
                },
              },
            ],
          };
        }

        if (
          input.stage
          === "continuation"
          && input.process.step_index === 0
        ) {
          const option =
            input
              .available_reinstatement_cues
              .find(
                (entry) =>
                  entry.cue.kind
                    === "semantic"
                  && entry.cue.value
                    === "bridge"
                  && entry
                    .construction
                    ?.controlled_cue_construction
                    === true,
              );

          assert.ok(option);

          selectedConstructedCueRef =
            option.cue_option_id;

          return {
            control_action:
              "continue",
            control_reason:
              "follow constructed bridge cue",
            selected_reinstatement_cue_refs: [
              option.cue_option_id,
            ],
          };
        }

        if (
          input.stage
          === "recovery"
          && input.process.step_index === 1
        ) {
          assert.equal(
            input
              .current_frontier
              .candidate_memory_records
              .some(
                (record) =>
                  record.memory_id
                  === "memory_target",
              ),
            true,
          );

          assert.equal(
            input
              .current_frontier
              .active_cues
              .some(
                (cue) =>
                  cue.kind
                    === "semantic"
                  && cue.value
                    === "bridge"
                  && (
                    cue.source
                    === worldSimulationGroundedRetrievalCueConstructionCueSource
                    || Array.isArray(
                      cue.sources,
                    )
                    && cue.sources.includes(
                      worldSimulationGroundedRetrievalCueConstructionCueSource,
                    )
                  ),
              ),
            true,
          );

          return {
            contacted_candidate_refs: [
              "memory_target",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "memory_target",
                selector: {
                  kind:
                    "json_pointer",
                  path:
                    "/answer",
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
          && input.process.step_index === 1
        ) {
          return {
            control_action:
              "stop",
            control_reason:
              "target recovered",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected stage ${input.stage}`,
        );
      },
  });

assert.deepEqual(
  stages,
  [
    "initiation:init",
    "recovery:0",
    "cue_construction:0",
    "continuation:0",
    "recovery:1",
    "continuation:1",
  ],
);
assert.equal(
  result.target_outcome,
  "satisfied",
);
assert.equal(
  result
    .grounded_retrieval_cue_construction_evidence
    .length,
  1,
);
assert.equal(
  result
    .retrieval_process
    .steps[0]
    .cue_option_generation_mode,
  "phase64a_r4e2_grounded_construction",
);
assert.equal(
  result
    .retrieval_process
    .steps[0]
    .selected_reinstatement_cue_refs[0],
  selectedConstructedCueRef,
);
assert.equal(
  result
    .retrieval_process
    .steps[0]
    .reinstated_cues[0]
    .source,
  worldSimulationGroundedRetrievalCueConstructionCueSource,
);
assert.equal(
  result
    .retrieval_process
    .grounded_retrieval_cue_construction_evidence_hashes
    .length,
  1,
);
assert.equal(
  result
    .engine_audit
    .grounded_retrieval_cue_construction_stage_count,
  1,
);
assert.equal(
  result
    .engine_audit
    .grounded_retrieval_cue_construction_character_state_exposed,
  false,
);
assert.equal(
  result
    .engine_audit
    .grounded_retrieval_cue_construction_unrecovered_memory_content_exposed,
  false,
);
assert.equal(
  JSON.stringify(
    result
      .grounded_retrieval_cue_construction_evidence,
  ).includes(
    "SEED_UNRETRIEVED_DETAIL",
  ),
  false,
);

const multistepContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();

assert.equal(
  multistepContract
    .phase64a_r4e2_grounded_retrieval_cue_construction
    ?.phase,
  "Phase64A-R4E2",
);
assert.equal(
  multistepContract
    .phase64a_r4e2_new_resolver_stage_added,
  true,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_cue_construction_stage_conditionally_invoked,
  true,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_character_state_exposed_to_cue_construction,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_full_memory_record_exposed_to_cue_construction,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_unrecovered_memory_content_exposed_to_cue_construction,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_continuation_decision_authority,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_stop_decision_authority,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e2_persistent_memory_mutation_authority,
  false,
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
  /cue_construction_requested[\s\S]*callResolver\([\s\S]*"cue_construction"/,
  "R4E2 must remain explicitly requested from an actual completed recovery step",
);
assert.match(
  multistepSource,
  /buildWorldSimulationGroundedRetrievalCueConstructionSourceSet\(\{[\s\S]*recovered_fragments:[\s\S]*cumulativeRecovered[\s\S]*perception:[\s\S]*input\.perception[\s\S]*prior_selected_cue_propositions:[\s\S]*priorSelectedCuePropositions/,
  "R4E2 source set must be built from actual materialized history and bounded current access",
);
assert.match(
  multistepSource,
  /cueConstructionRequested[\s\S]*\?[\s\S]*phase64a_r4e2_grounded_construction[\s\S]*phase63c_legacy_recovered_memory_cue_links/,
  "R4E2-enabled steps must not use legacy full-memory cue-link option generation",
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
  /conditional_stages:[\s\S]*"cue_construction"/,
  "world-loop contract must surface the conditional R4E2 construction stage",
);
assert.match(
  worldLoopSource,
  /cue_construction_character_state_exposed:[\s\S]*false/,
  "world-loop audit must preserve R4E2 character-state isolation",
);

const runAllSource =
  await readFile(
    new URL(
      "../run-all.mjs",
      import.meta.url,
    ),
    "utf8",
  );

const registrationMatches =
  runAllSource.match(
    /tests\/phase64\/phase64a-grounded-retrieval-cue-construction\.test\.mjs/g,
  )
  ?? [];

assert.equal(
  registrationMatches.length,
  1,
  "R4E2 formal test must be registered exactly once in tests/run-all.mjs",
);

console.log(JSON.stringify({
  ok:
    true,
  phase:
    "Phase64A-R4E2 Grounded Retrieval Cue Construction & Controlled Transition",
  actual_materialized_sources_only:
    true,
  partial_recovery_hidden_detail_leak_blocked:
    true,
  bounded_perception_source_supported:
    true,
  prior_selected_cue_proposition_lineage_supported:
    true,
  fixed_derivation_depth:
    false,
  free_semantic_association_without_materialized_semantic_access:
    false,
  cue_proposition_truth_verified:
    false,
  cue_selection_authority:
    false,
  continuation_authority:
    false,
  stop_authority:
    false,
  persistent_memory_mutation:
    false,
}));
console.log(
  "Phase64A-R4E2 grounded retrieval cue construction and controlled transition passed.",
);
