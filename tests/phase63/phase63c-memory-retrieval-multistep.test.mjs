import assert from "node:assert/strict";
import {
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationLoopContract,
  prepareWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  buildWorldSimulationMemoryCueLinks,
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
  worldSimulationMemoryRetrievalProcessV3Version,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";

const contract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();

assert.equal(
  contract.version,
  "phase63c-memory-retrieval-process-v3",
);
assert.equal(
  contract.version,
  worldSimulationMemoryRetrievalProcessV3Version,
);
assert.equal(contract.multi_step_retrieval_execution_installed, true);
assert.equal(contract.dynamic_candidate_frontier_installed, true);
assert.equal(contract.frozen_subjective_memory_snapshot_installed, true);
assert.equal(contract.candidate_frontier_is_process_wide_frozen_set, false);
assert.equal(contract.phase63b_is_cue_canonicalization_authority, true);
assert.equal(contract.internally_reinstated_is_cue_provenance_not_semantic_kind, true);
assert.equal(contract.resolver_authored_reinstated_cue_content_allowed, false);
assert.equal(contract.target_may_be_outside_initial_frontier, true);
assert.equal(contract.future_frontier_content_visible_to_earlier_step_resolver, false);
assert.equal(contract.technical_step_budget_is_cognitive_stopping_rule, false);
assert.equal(contract.technical_step_budget_exhaustion_fails_closed, true);
assert.equal(contract.retrieval_event_persistence_installed, false);

const memories = [
  {
    memory_id: "memory_seed",
    memory_type: "episodic_direct_perception",
    content: {
      clue: "橋邊的燈",
      unretrieved_detail: "SEED_UNRETRIEVED_DETAIL",
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "seed",
        source: "fixture_seed_association",
      },
      {
        kind: "semantic",
        value: "bridge",
        source: "fixture_bridge_association",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id: "memory_target",
    memory_type: "episodic_direct_perception",
    content: {
      answer: "伊萊亞斯在橋邊停下",
      hidden_detail: "TARGET_HIDDEN_DETAIL",
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "bridge",
        source: "fixture_bridge_association",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id: "memory_noise",
    content: {
      detail: "無關內容",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "other",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
];

const seedCueLinks =
  buildWorldSimulationMemoryCueLinks(
    memories[0],
  );

assert.equal(
  seedCueLinks.some(
    (cue) =>
      cue.kind === "semantic"
      && cue.value === "bridge",
  ),
  true,
);
assert.equal(Object.isFrozen(seedCueLinks), true);

const accessibilityBaseInput = {
  character: "伊萊亞斯・諾爾",
  memory_records: memories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode: "cue_dependent_v2",
  },
  simulation_time: "2026-08-25T03:00:00+08:00",
  scene_id: null,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "seed",
        source: "fixture_initial_cue",
      },
    ],
  },
};

const initialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    accessibilityBaseInput,
  );

assert.deepEqual(
  initialAccessibility.result.candidate_memory_records
    .map((record) => record.memory_id),
  ["memory_seed"],
);

const target = {
  kind: "memory_content",
  memory_id: "memory_target",
  requested_selectors: [
    {
      kind: "json_pointer",
      path: "/answer",
    },
  ],
};

const query =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character: "伊萊亞斯・諾爾",
    turn_id: "phase63c-step4-direct",
    phase63b_version:
      initialAccessibility.memory_accessibility_version,
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
    retrieval_goal: target,
  });

assert.equal(query.memory_snapshot.memory_count, 3);
assert.equal(query.memory_snapshot.content_embedded, false);
assert.equal(query.memory_snapshot.refs_embedded, false);
assert.deepEqual(
  query.initial_frontier.candidate_refs
    .map((ref) => ref.memory_id),
  ["memory_seed"],
);
assert.equal(
  JSON.stringify(query).includes("TARGET_HIDDEN_DETAIL"),
  false,
);
assert.equal(
  JSON.stringify(query).includes("memory_noise"),
  false,
  "non-frontier memory refs must not leak through the v3 query",
);

const resolverStages = [];
let selectedBridgeCueOption = null;

const resolver =
  async (input) => {
    resolverStages.push(
      `${input.stage}:${input.process?.step_index ?? "init"}`,
    );

    if (input.stage === "initiation") {
      assert.equal(
        JSON.stringify(input).includes("TARGET_HIDDEN_DETAIL"),
        false,
      );
      assert.equal(
        Object.hasOwn(
          input.initial_frontier,
          "candidate_memory_records",
        ),
        false,
      );
      return {
        process_occurred: true,
        initiation: {
          mode: "deliberate",
          trigger_origin: "self_generated",
        },
        retrieval_task: {
          mode: "cued_recall",
        },
        target,
      };
    }

    if (
      input.stage === "recovery"
      && input.process.step_index === 0
    ) {
      assert.deepEqual(
        input.current_frontier.candidate_memory_records
          .map((record) => record.memory_id),
        ["memory_seed"],
      );
      assert.equal(
        JSON.stringify(input).includes("TARGET_HIDDEN_DETAIL"),
        false,
      );
      assert.equal(
        JSON.stringify(input).includes("memory_target"),
        true,
        "the explicit target identity may be known while target content remains hidden",
      );
      return {
        contacted_candidate_refs: ["memory_seed"],
        recovered_selections: [
          {
            source_memory_ref: "memory_seed",
            selector: {
              kind: "json_pointer",
              path: "/clue",
            },
            content_kind: "detail",
          },
        ],
      };
    }

    if (
      input.stage === "continuation"
      && input.process.step_index === 0
    ) {
      const bridge =
        input.available_reinstatement_cues.find(
          (option) =>
            option.cue.kind === "semantic"
            && option.cue.value === "bridge",
        );
      assert.ok(bridge);
      selectedBridgeCueOption = bridge.cue_option_id;
      return {
        control_action: "continue",
        control_reason: "use recovered bridge context",
        selected_reinstatement_cue_refs: [
          bridge.cue_option_id,
        ],
      };
    }

    if (
      input.stage === "recovery"
      && input.process.step_index === 1
    ) {
      assert.equal(
        input.current_frontier.candidate_memory_records
          .some((record) => record.memory_id === "memory_target"),
        true,
      );
      assert.equal(
        JSON.stringify(input).includes("TARGET_HIDDEN_DETAIL"),
        true,
        "target content may become visible only after the target enters the current frontier",
      );
      assert.equal(
        input.current_frontier.active_cues.some(
          (cue) =>
            cue.kind === "semantic"
            && cue.value === "bridge"
            && arrayIncludesSource(
              cue,
              "phase63c_internal_reinstatement",
            ),
        ),
        true,
      );
      return {
        contacted_candidate_refs: ["memory_target"],
        recovered_selections: [
          {
            source_memory_ref: "memory_target",
            selector: {
              kind: "json_pointer",
              path: "/answer",
            },
            content_kind: "detail",
          },
        ],
      };
    }

    if (
      input.stage === "continuation"
      && input.process.step_index === 1
    ) {
      assert.equal(
        input.process.target_outcome_so_far,
        "satisfied",
      );
      return {
        control_action: "stop",
        control_reason: "target sufficiently recovered",
        selected_reinstatement_cue_refs: [],
      };
    }

    throw new Error(
      `Unexpected resolver stage ${input.stage} / ${input.process?.step_index}`,
    );
  };

function arrayIncludesSource(cue, source) {
  return cue?.source === source
    || Array.isArray(cue?.sources)
      && cue.sources.includes(source);
}

const result =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
    resolver,
    technical_step_budget: 4,
    perception: {},
    character_state: {},
  });

assert.equal(result.process_occurred, true);
assert.equal(result.version, worldSimulationMemoryRetrievalProcessV3Version);
assert.equal(result.retrieval_process.steps.length, 2);
assert.equal(result.target_outcome, "satisfied");
assert.equal(result.recovered_fragments.length, 2);
assert.equal(result.recovery_occurrences.length, 2);
assert.equal(
  result.retrieval_process.steps[0]
    .selected_reinstatement_cue_refs[0],
  selectedBridgeCueOption,
);
assert.deepEqual(
  result.retrieval_process.steps[0].reinstated_cues,
  [
    {
      kind: "semantic",
      value: "bridge",
      source: "phase63c_internal_reinstatement",
    },
  ],
);
assert.equal(
  result.retrieval_process.steps[1]
    .frontier.candidate_refs
    .some((ref) => ref.memory_id === "memory_target"),
  true,
);
assert.equal(
  result.retrieval_process.steps[0]
    .cumulative_target_outcome_after_step,
  "failed",
);
assert.equal(
  result.retrieval_process.steps[1]
    .cumulative_target_outcome_after_step,
  "satisfied",
);
assert.equal(
  result.engine_audit.selected_internal_cue_count,
  1,
);
assert.equal(
  result.engine_audit.future_frontier_content_exposed_to_earlier_resolver,
  false,
);
assert.equal(
  result.engine_audit.same_cycle_retrieval_history_feedback_used,
  false,
);
assert.deepEqual(
  resolverStages,
  [
    "initiation:init",
    "recovery:0",
    "continuation:0",
    "recovery:1",
    "continuation:1",
  ],
);
assert.deepEqual(
  result.retrieval_experience,
  {
    process_occurred: true,
    initiation_mode: "deliberate",
    target_outcome: "satisfied",
    recovered_any_content: true,
  },
);
assert.equal(
  JSON.stringify(result.recovered_memories)
    .includes("TARGET_HIDDEN_DETAIL"),
  false,
);
assert.equal(
  JSON.stringify(result.recovered_memories)
    .includes("伊萊亞斯在橋邊停下"),
  true,
);

const noProcess =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
  });
assert.equal(noProcess.process_occurred, false);
assert.deepEqual(noProcess.recovered_memories, []);

let repeatRecoveryStep = 0;
const repeatResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query:
      buildWorldSimulationMemoryRetrievalQueryV3({
        character: "伊萊亞斯・諾爾",
        turn_id: "phase63c-step4-repeat",
        phase63b_version:
          initialAccessibility.memory_accessibility_version,
        memory_records: memories,
        accessibility_base_input: accessibilityBaseInput,
        initial_accessibility_query: initialAccessibility,
        retrieval_goal: null,
      }),
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
    technical_step_budget: 3,
    resolver:
      async (input) => {
        if (input.stage === "initiation") {
          return {
            process_occurred: true,
            initiation: {
              mode: "spontaneous",
              trigger_origin: "environmental_cue",
            },
            retrieval_task: {
              mode: "associative_recall",
            },
            target: null,
          };
        }
        if (input.stage === "recovery") {
          repeatRecoveryStep = input.process.step_index;
          return {
            contacted_candidate_refs: ["memory_seed"],
            recovered_selections: [
              {
                source_memory_ref: "memory_seed",
                selector: {
                  kind: "json_pointer",
                  path: "/clue",
                },
                content_kind: "detail",
              },
            ],
          };
        }
        if (input.stage === "continuation") {
          return {
            control_action:
              input.process.step_index === 0
                ? "continue"
                : "stop",
            control_reason:
              input.process.step_index === 0
                ? "same cue search continues"
                : "stop after repeated recovery",
            selected_reinstatement_cue_refs: [],
          };
        }
        throw new Error("unexpected repeat resolver stage");
      },
  });

assert.equal(repeatRecoveryStep, 1);
assert.equal(
  repeatResult.recovery_occurrences.length,
  2,
  "cross-step recovery occurrences must remain observable",
);
assert.equal(
  repeatResult.recovered_fragments.length,
  1,
  "final recovered content projection should remain unique",
);

await assert.rejects(
  () =>
    executeWorldSimulationMemoryRetrievalProcessV3({
      query:
        buildWorldSimulationMemoryRetrievalQueryV3({
          character: "伊萊亞斯・諾爾",
          turn_id: "phase63c-step4-authored-cue",
          phase63b_version:
            initialAccessibility.memory_accessibility_version,
          memory_records: memories,
          accessibility_base_input: accessibilityBaseInput,
          initial_accessibility_query: initialAccessibility,
          retrieval_goal: null,
        }),
      memory_records: memories,
      accessibility_base_input: accessibilityBaseInput,
      initial_accessibility_query: initialAccessibility,
      technical_step_budget: 2,
      resolver:
        async (input) => {
          if (input.stage === "initiation") {
            return {
              process_occurred: true,
              initiation: {
                mode: "spontaneous",
              },
            };
          }
          if (input.stage === "recovery") {
            return {
              contacted_candidate_refs: ["memory_seed"],
              recovered_selections: [
                {
                  source_memory_ref: "memory_seed",
                  selector: {
                    kind: "json_pointer",
                    path: "/clue",
                  },
                },
              ],
            };
          }
          return {
            control_action: "continue",
            reinstated_cues: [
              {
                kind: "semantic",
                value: "resolver-authored-cue",
              },
            ],
            selected_reinstatement_cue_refs: [],
          };
        },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_AUTHORED_REINSTATED_CUE_FORBIDDEN",
);

await assert.rejects(
  () =>
    executeWorldSimulationMemoryRetrievalProcessV3({
      query:
        buildWorldSimulationMemoryRetrievalQueryV3({
          character: "伊萊亞斯・諾爾",
          turn_id: "phase63c-step4-budget",
          phase63b_version:
            initialAccessibility.memory_accessibility_version,
          memory_records: memories,
          accessibility_base_input: accessibilityBaseInput,
          initial_accessibility_query: initialAccessibility,
          retrieval_goal: null,
        }),
      memory_records: memories,
      accessibility_base_input: accessibilityBaseInput,
      initial_accessibility_query: initialAccessibility,
      technical_step_budget: 1,
      resolver:
        async (input) => {
          if (input.stage === "initiation") {
            return {
              process_occurred: true,
              initiation: {
                mode: "spontaneous",
              },
            };
          }
          if (input.stage === "recovery") {
            return {
              contacted_candidate_refs: [],
              recovered_selections: [],
            };
          }
          return {
            control_action: "continue",
            control_reason: "cognitive search still ongoing",
            selected_reinstatement_cue_refs: [],
          };
        },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_STEP_BUDGET_EXHAUSTED",
);

const loopContract =
  buildWorldSimulationLoopContract();
assert.equal(
  loopContract
    .subjective_memory_retrieval_process
    .version,
  worldSimulationMemoryRetrievalProcessV3Version,
);
assert.equal(
  loopContract
    .subjective_memory_retrieval_stage_resolution_hook
    .staged_lifecycle,
  true,
);
assert.equal(
  loopContract
    .subjective_memory_retrieval_stage_resolution_hook
    .legacy_single_step_hook_preserved,
  true,
);

const fixtureRoot =
  path.join(
    projectRoot,
    "tests",
    ".tmp",
    `phase63c-step4-loop-${process.pid}-${Date.now()}`,
  );

await rm(
  fixtureRoot,
  {
    recursive: true,
    force: true,
  },
);

let nativeLoopVerified = false;

try {
  const character = "phase63c-step4-observer";
  const sceneId = "phase63c-step4-room";
  const eventId = "phase63c-step4-event";
  const loopTargetAnswer = "橋邊真正發生的動作";
  const loopHiddenDetail = "STEP4_LOOP_HIDDEN_DETAIL";

  const session =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase63C Step4 multi-step retrieval fixture",
        seed:
          "phase63c-step4",
        rules: {
          event_driven: true,
          persistent_causality: true,
        },
        initial_world_state: {
          simulation_time:
            "2026-08-25T03:10:00+08:00",
          event_queue: [
            {
              event_id: eventId,
              type: "phase63c_step4_retrieval",
              scene_id: sceneId,
              participants: [character],
              memory_retrieval_context: {
                active_cues: [
                  {
                    kind: "semantic",
                    value: "seed",
                    source: "fixture_initial_cue",
                  },
                ],
              },
            },
          ],
          scenes: {
            [sceneId]: {
              scene_id: sceneId,
              dimensions: {
                width_m: 8,
                depth_m: 8,
              },
              entity_positions: {
                [character]: {
                  x: 2,
                  y: 2,
                },
              },
              obstacles: [],
              structures: [],
              doors: [],
            },
          },
          characters: {
            [character]: {
              known: ["自己正在測試場景中"],
              current_goal: "回想橋邊發生的事",
              current_action: "思考",
              memory_retrieval_profile: {
                enabled: true,
                model_mode: "cue_dependent_v2",
              },
            },
          },
          memories: {
            [character]: [
              {
                memory_id: "loop-memory-seed",
                content: {
                  clue: "橋",
                },
                retrieval_cue_links: [
                  {
                    kind: "semantic",
                    value: "seed",
                  },
                  {
                    kind: "semantic",
                    value: "bridge",
                  },
                ],
                retrieval_eligible: true,
                suppressed: false,
              },
              {
                memory_id: "loop-memory-target",
                content: {
                  answer: loopTargetAnswer,
                  hidden_detail: loopHiddenDetail,
                },
                retrieval_cue_links: [
                  {
                    kind: "semantic",
                    value: "bridge",
                  },
                ],
                retrieval_eligible: true,
                suppressed: false,
              },
            ],
          },
          objects: {},
          available_actions: {
            [character]: [
              {
                action_id: "remain-still",
                intent: "留在原地",
              },
            ],
          },
        },
      },
      {
        fixtureRoot,
      },
    );

  const loopStageCalls = [];

  const prepared =
    await prepareWorldSimulationTurn(
      {
        world_simulation_session_id:
          session.world_simulation_session_id,
        event_id: eventId,
      },
      {
        fixtureRoot,
        memoryRetrievalTechnicalStepBudget: 4,
        memoryRetrievalStageResolver:
          async (input) => {
            loopStageCalls.push(
              `${input.stage}:${input.process?.step_index ?? "init"}`,
            );

            if (input.stage === "initiation") {
              return {
                process_occurred: true,
                initiation: {
                  mode: "deliberate",
                },
                retrieval_task: {
                  mode: "cued_recall",
                },
                target: {
                  kind: "memory_content",
                  memory_id: "loop-memory-target",
                  requested_selectors: [
                    {
                      kind: "json_pointer",
                      path: "/answer",
                    },
                  ],
                },
              };
            }

            if (
              input.stage === "recovery"
              && input.process.step_index === 0
            ) {
              assert.equal(
                JSON.stringify(input).includes(loopHiddenDetail),
                false,
              );
              return {
                contacted_candidate_refs: ["loop-memory-seed"],
                recovered_selections: [
                  {
                    source_memory_ref: "loop-memory-seed",
                    selector: {
                      kind: "json_pointer",
                      path: "/clue",
                    },
                  },
                ],
              };
            }

            if (
              input.stage === "continuation"
              && input.process.step_index === 0
            ) {
              const bridge =
                input.available_reinstatement_cues.find(
                  (option) =>
                    option.cue.kind === "semantic"
                    && option.cue.value === "bridge",
                );
              assert.ok(bridge);
              return {
                control_action: "continue",
                selected_reinstatement_cue_refs: [
                  bridge.cue_option_id,
                ],
              };
            }

            if (
              input.stage === "recovery"
              && input.process.step_index === 1
            ) {
              assert.equal(
                JSON.stringify(input).includes(loopHiddenDetail),
                true,
              );
              return {
                contacted_candidate_refs: ["loop-memory-target"],
                recovered_selections: [
                  {
                    source_memory_ref: "loop-memory-target",
                    selector: {
                      kind: "json_pointer",
                      path: "/answer",
                    },
                  },
                ],
              };
            }

            if (
              input.stage === "continuation"
              && input.process.step_index === 1
            ) {
              return {
                control_action: "stop",
                control_reason: "target recovered",
                selected_reinstatement_cue_refs: [],
              };
            }

            throw new Error("unexpected native loop stage");
          },
      },
    );

  assert.equal(
    prepared.memory_retrieval_processes[0]
      .result.version,
    worldSimulationMemoryRetrievalProcessV3Version,
  );
  assert.equal(
    prepared.memory_retrieval_processes[0]
      .result.retrieval_process.steps.length,
    2,
  );
  assert.equal(
    prepared.memory_retrieval_processes[0]
      .result.target_outcome,
    "satisfied",
  );
  assert.equal(
    JSON.stringify(prepared.decision_packets)
      .includes(loopTargetAnswer),
    true,
  );
  assert.equal(
    JSON.stringify(prepared.decision_packets)
      .includes(loopHiddenDetail),
    false,
  );
  assert.deepEqual(
    loopStageCalls,
    [
      "initiation:init",
      "recovery:0",
      "continuation:0",
      "recovery:1",
      "continuation:1",
    ],
  );

  nativeLoopVerified = true;
} finally {
  await rm(
    fixtureRoot,
    {
      recursive: true,
      force: true,
    },
  );
}

const report = {
  ok: true,
  phase: "Phase63C Step 4",
  retrieval_process_version:
    worldSimulationMemoryRetrievalProcessV3Version,
  kernel: "multi_step_grounded_dynamic_frontier",
  staged_resolver_lifecycle_verified: true,
  frozen_memory_snapshot_verified: true,
  dynamic_candidate_frontier_verified: true,
  target_outside_initial_frontier_verified: true,
  grounded_internal_cue_reinstatement_verified: true,
  internally_reinstated_is_provenance_verified: true,
  future_frontier_information_barrier_verified: true,
  cumulative_target_outcome_verified: true,
  cross_step_repeat_occurrences_verified: true,
  technical_budget_fail_closed_verified: true,
  native_loop_verified: nativeLoopVerified,
  retrieval_event_persistence_installed: false,
};

console.log(JSON.stringify(report, null, 2));
