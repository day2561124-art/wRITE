import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQueryV3,
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationRetrievalGlobalTerminationDecisionEvidenceContract,
  projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence,
  validateWorldSimulationRetrievalGlobalTerminationDecisionEvidence,
} from "../../server/src/world-simulation-retrieval-global-termination-decision-evidence-service.mjs";

const contract =
  buildWorldSimulationRetrievalGlobalTerminationDecisionEvidenceContract();

assert.equal(contract.phase, "Phase64A-R4F1");
assert.equal(
  contract.global_termination_semantics_separated_from_local_cue_transition,
  true,
);
assert.equal(contract.existing_phase63c_continuation_resolver_reused, true);
assert.equal(contract.separate_resolver_stage_added, false);
assert.equal(contract.target_outcome_is_automatic_stopping_rule, false);
assert.equal(contract.same_target_outcome_may_continue_or_stop, true);
assert.equal(contract.stopping_rule_modeled, false);
assert.equal(contract.exit_latency_modeled, false);
assert.equal(contract.feeling_of_knowing_modeled, false);
assert.equal(contract.retrieval_cost_benefit_modeled, false);
assert.equal(contract.technical_step_budget_is_cognitive_stopping_rule, false);
assert.equal(contract.r4d_consumed_online, false);
assert.equal(contract.r4d_remains_post_hoc, true);
assert.equal(contract.persistent_memory_mutation_authority, false);

const common = {
  query_id: "phase64a-r4f1-unit",
  character: "伊萊亞斯・諾爾",
  turn_id: "phase64a-r4f1-unit-turn",
  step_index: 0,
  source_episode_context: {
    episode_id: "episode-a",
    episode_index: 0,
    cue_set_hash: "cue-hash-a",
  },
  source_frontier: {
    frontier_id: "frontier-a",
    active_cue_hash: "cue-hash-a",
  },
  cumulative_target_outcome_after_step: "failed",
  available_reinstatement_cue_option_ids: [
    "cue-option-1",
  ],
};

const continueEvidence =
  projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence({
    ...common,
    continuation_control: {
      control_action: "continue",
      control_reason: "keep searching",
      selected_reinstatement_cue_refs: [],
    },
  });

const stopEvidence =
  projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence({
    ...common,
    continuation_control: {
      control_action: "stop",
      control_reason: "give up for now",
      selected_reinstatement_cue_refs: [],
    },
  });

assert.equal(
  continueEvidence.global_termination_decision.action,
  "continue_search",
);
assert.equal(
  continueEvidence.observation.continue_without_cue_shift,
  true,
);
assert.equal(
  stopEvidence.global_termination_decision.action,
  "terminate_search",
);
assert.equal(
  continueEvidence.cumulative_target_outcome_after_step,
  stopEvidence.cumulative_target_outcome_after_step,
  "the same target outcome must remain compatible with either continue or stop",
);
assert.equal(
  stopEvidence.global_termination_decision.resolver_control_reason_truth_verified,
  false,
);
assert.equal(stopEvidence.boundaries.r4d_consumed_online, false);
assert.ok(Object.isFrozen(stopEvidence));

assert.deepEqual(
  validateWorldSimulationRetrievalGlobalTerminationDecisionEvidence(
    stopEvidence,
  ),
  stopEvidence,
);

const tampered =
  structuredClone(
    stopEvidence,
  );

tampered.global_termination_decision.action =
  "continue_search";

assert.throws(
  () =>
    validateWorldSimulationRetrievalGlobalTerminationDecisionEvidence(
      tampered,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_EVIDENCE_HASH_MISMATCH",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence({
      ...common,
      continuation_control: {
        control_action: "stop",
        selected_reinstatement_cue_refs: [
          "cue-option-1",
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_TERMINAL_LOCAL_TRANSITION_INVALID",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence({
      ...common,
      continuation_control: {
        control_action: "continue",
        selected_reinstatement_cue_refs: [
          "not-available",
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_CUE_SELECTION_UNAVAILABLE",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence({
      ...common,
      continuation_control: {
        control_action: "stop",
        selected_reinstatement_cue_refs: [],
      },
      feeling_of_knowing_model: {
        threshold: 0.5,
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_OVERRIDE_FORBIDDEN",
);

const memories = [
  {
    memory_id: "memory-seed",
    memory_type: "episodic_direct_perception",
    content: {
      clue: "橋邊的燈",
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "seed",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
];

const accessibilityBaseInput = {
  character: "伊萊亞斯・諾爾",
  memory_records: memories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode: "cue_dependent_v2",
  },
  simulation_time: "2026-08-30T18:30:00+08:00",
  scene_id: null,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "seed",
        source: "fixture",
      },
    ],
  },
};

const initialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    accessibilityBaseInput,
  );

const query =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character: "伊萊亞斯・諾爾",
    turn_id: "phase64a-r4f1-integration",
    phase63b_version:
      initialAccessibility.memory_accessibility_version,
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
    retrieval_goal: null,
  });

const stages = [];

const result =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records: memories,
    accessibility_base_input: accessibilityBaseInput,
    initial_accessibility_query: initialAccessibility,
    technical_step_budget: 3,
    perception: {},
    character_state: {},
    resolver:
      async (input) => {
        stages.push(
          `${input.stage}:${input.process?.step_index ?? "init"}`,
        );

        if (input.stage === "initiation") {
          return {
            process_occurred: true,
            initiation: {
              mode: "deliberate",
              trigger_origin: "self_generated",
            },
            retrieval_task: {
              mode: "cued_recall",
            },
            target: null,
          };
        }

        if (input.stage === "recovery") {
          return {
            contacted_candidate_refs: [],
            recovered_selections: [],
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
                ? "keep trying"
                : "end this retrieval process",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected resolver stage ${input.stage}`,
        );
      },
  });

assert.deepEqual(
  stages,
  [
    "initiation:init",
    "recovery:0",
    "continuation:0",
    "recovery:1",
    "continuation:1",
  ],
  "R4F1 must not add a new resolver stage",
);

assert.equal(
  result.retrieval_global_termination_decision_evidence.length,
  2,
);
assert.deepEqual(
  result.retrieval_global_termination_decision_evidence.map(
    (evidence) =>
      evidence.global_termination_decision.action,
  ),
  [
    "continue_search",
    "terminate_search",
  ],
);
assert.equal(
  result.retrieval_process.steps[0]
    .global_termination_decision_evidence_hash,
  result.retrieval_global_termination_decision_evidence[0].evidence_hash,
);
assert.equal(
  result.retrieval_process.steps[1]
    .global_termination_decision_evidence_hash,
  result.retrieval_global_termination_decision_evidence[1].evidence_hash,
);
assert.equal(
  result.retrieval_process
    .global_termination_decision_evidence_hashes
    .length,
  2,
);
assert.equal(
  result.engine_audit
    .retrieval_global_termination_decision_sequence_verified,
  true,
);
assert.equal(
  result.engine_audit
    .retrieval_global_termination_stopping_rule_modeled,
  false,
);
assert.equal(
  result.engine_audit
    .retrieval_global_termination_r4d_consumed_online,
  false,
);


const cueShiftMemories = [
  {
    memory_id:
      "r4f1-shift-seed",
    memory_type:
      "episodic_direct_perception",
    content: {
      clue:
        "橋邊的燈",
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
      "r4f1-shift-target",
    memory_type:
      "episodic_direct_perception",
    content: {
      answer:
        "橋的另一端",
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
          "bridge",
      },
    ],
    retrieval_eligible:
      true,
    suppressed:
      false,
  },
];

const cueShiftAccessibilityBaseInput = {
  character:
    "伊萊亞斯・諾爾",
  memory_records:
    cueShiftMemories,
  memory_retrieval_profile: {
    enabled:
      true,
    model_mode:
      "cue_dependent_v2",
  },
  simulation_time:
    "2026-08-30T18:31:00+08:00",
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
          "fixture",
      },
    ],
  },
};

const cueShiftInitialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    cueShiftAccessibilityBaseInput,
  );

const cueShiftQuery =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character:
      "伊萊亞斯・諾爾",
    turn_id:
      "phase64a-r4f1-cue-shift-without-r4e3",
    phase63b_version:
      cueShiftInitialAccessibility
        .memory_accessibility_version,
    memory_records:
      cueShiftMemories,
    accessibility_base_input:
      cueShiftAccessibilityBaseInput,
    initial_accessibility_query:
      cueShiftInitialAccessibility,
    retrieval_goal:
      null,
  });

let selectedBridgeRef =
  null;

const cueShiftResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query:
      cueShiftQuery,
    memory_records:
      cueShiftMemories,
    accessibility_base_input:
      cueShiftAccessibilityBaseInput,
    initial_accessibility_query:
      cueShiftInitialAccessibility,
    technical_step_budget:
      3,
    perception: {},
    character_state: {},
    resolver:
      async (input) => {
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
            target:
              null,
          };
        }

        if (
          input.stage
          === "recovery"
          && input.process.step_index === 0
        ) {
          return {
            contacted_candidate_refs: [
              "r4f1-shift-seed",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "r4f1-shift-seed",
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
          };
        }

        if (
          input.stage
          === "continuation"
          && input.process.step_index === 0
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
            "legacy Phase63C cue construction should expose the recovered bridge cue",
          );

          selectedBridgeRef =
            bridge.cue_option_id;

          return {
            control_action:
              "continue",
            control_reason:
              "shift to grounded bridge cue",
            selected_reinstatement_cue_refs: [
              bridge.cue_option_id,
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
                  === "r4f1-shift-target",
              ),
            true,
          );

          return {
            contacted_candidate_refs: [],
            recovered_selections: [],
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
              "end after cue-conditioned second episode",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected R4F1 cue-shift stage ${input.stage}:${input.process?.step_index}`,
        );
      },
  });

assert.ok(
  selectedBridgeRef,
);

assert.equal(
  cueShiftResult
    .engine_audit
    .retrieval_episode_local_reprojection_enabled,
  false,
  "the regression must exercise a cue transition without the optional R4E3 evidence chain",
);

assert.equal(
  cueShiftResult
    .retrieval_global_termination_decision_evidence
    .length,
  2,
);

assert.equal(
  cueShiftResult
    .retrieval_global_termination_decision_evidence[1]
    .source_episode_context
    .episode_index,
  1,
  "R4F1 current episode semantics must advance even when R4E3 evidence reprojection is disabled",
);

assert.equal(
  cueShiftResult
    .retrieval_global_termination_decision_evidence[1]
    .source_episode_context
    .cue_set_hash,
  cueShiftResult
    .retrieval_process
    .steps[1]
    .frontier
    .active_cue_hash,
);

assert.notEqual(
  cueShiftResult
    .retrieval_process
    .steps[0]
    .frontier
    .active_cue_hash,
  cueShiftResult
    .retrieval_process
    .steps[1]
    .frontier
    .active_cue_hash,
);

const multistepContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();

assert.equal(
  multistepContract.phase64a_r4f1_global_termination_decision?.phase,
  "Phase64A-R4F1",
);
assert.equal(
  multistepContract.phase64a_r4f1_new_resolver_stage_added,
  false,
);
assert.equal(
  multistepContract.phase64a_r4f1_stopping_rule_modeled,
  false,
);
assert.equal(
  multistepContract.phase64a_r4f1_r4d_consumed_online,
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
  /const control =[\s\S]*normalizeControl\([\s\S]*projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence/,
);
assert.match(
  multistepSource,
  /retrievalGlobalTerminationDecisionSequence[\s\S]*projectWorldSimulationRetrievalCueConditionedEpisodeEvidence/,
);
assert.match(
  multistepSource,
  /projectWorldSimulationRetrievalCueConditionedEpisodeEvidence[\s\S]*projectWorldSimulationRetrievalSearchControlReadinessEvidence/,
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
  /global_termination_decision_semantics_engine_side:[\s\S]*true/,
);
assert.match(
  worldLoopSource,
  /global_termination_new_resolver_stage_added:[\s\S]*false/,
);
assert.match(
  worldLoopSource,
  /retrieval_global_termination_decision_evidence_exposed_to_resolver:[\s\S]*false/,
);
assert.match(
  worldLoopSource,
  /global_termination_r4d_consumed_online:[\s\S]*false/,
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
    /tests\/phase64\/phase64a-retrieval-global-termination-decision-evidence\.test\.mjs/g,
  )
  ?? [];

assert.equal(
  registrationMatches.length,
  1,
);

console.log(JSON.stringify({
  ok: true,
  phase:
    "Phase64A-R4F1 Global Termination Decision Semantics & Provenance",
  global_vs_local_control_separated: true,
  existing_continuation_resolver_reused: true,
  new_resolver_stage_added: false,
  same_target_outcome_can_continue_or_stop: true,
  stopping_rule_modeled: false,
  exit_latency_modeled: false,
  feeling_of_knowing_modeled: false,
  cost_benefit_modeled: false,
  r4d_consumed_online: false,
  cue_transition_without_r4e3_context_advance_verified: true,
  persistent_memory_mutation: false,
}));
console.log(
  "Phase64A-R4F1 global termination decision semantics and provenance passed.",
);
