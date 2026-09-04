import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationLoopContract,
  createWorldSimulationCharacterRuntimeManager,
  prepareWorldSimulationTurn,
  projectWorldSimulationCharacterCurrentMindTransitions,
  projectWorldSimulationCharacterExperienceEvidence,
  replayWorldSimulationCommittedCharacterExperiences,
  resolveWorldSimulationFormalCharacterIdentity,
  resolveWorldSimulationTurn,
  runWorldSimulationTurn,
  worldSimulationCharacterAttentionReducerVersion,
  worldSimulationCharacterCurrentMindContractVersion,
  worldSimulationCharacterCurrentMindProjectionVersion,
  worldSimulationCharacterExperienceContractVersion,
  worldSimulationCharacterExperienceProjectionVersion,
  worldSimulationCharacterRuntimeVersion,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62c-world-loop-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

await rm(fixtureRoot, { recursive: true, force: true });

const initialWorldState = {
  simulation_time: "2026-08-24T08:10:00+08:00",
  event_queue: [
    {
      event_id: "evt-001",
      type: "training_room_observation",
      scene_id: "training-room-a",
      participants: ["伊萊亞斯・諾爾", "夜"],
      summary: "複測開始前的站位確認",
    },
  ],
  scenes: {
    "training-room-a": {
      scene_id: "training-room-a",
      simulation_time: "2026-08-24T08:10:00+08:00",
      dimensions: { width_m: 8, depth_m: 12 },
      exits: [{ id: "north-door", side: "north", open: true }],
      entity_positions: {
        "伊萊亞斯・諾爾": { x: 2, y: 4 },
        "夜": { x: 5, y: 4 },
      },
      public_visual: ["北側門開著", "地面有白色站位線"],
      observable_by: {
        "伊萊亞斯・諾爾": {
          visual: ["夜站在約三公尺外"],
          audible: ["空調低鳴"],
        },
        "夜": {
          visual: ["伊萊亞斯站在左側白線附近"],
          audible: ["空調低鳴"],
        },
      },
      hidden_scene_fields: {
        evaluator_private_note: "不得進入角色感知封包",
      },
    },
  },
  characters: {
    "伊萊亞斯・諾爾": {
      known: ["自己正在等待複測"],
      guessed: ["下一項可能是移動測試"],
      current_goal: "完成複測",
      emotion: "專注",
      current_action: "等待指示",
    },
    "夜": {
      known: ["自己正在旁觀複測"],
      current_goal: "確認現場狀況",
      emotion: "平靜",
      current_action: "觀察",
    },
  },
  memories: {
    "伊萊亞斯・諾爾": [
      {
        memory_id: "mem-e-1",
        content: "上一次測試要求先站到白線",
        source_kind: "direct_observation",
        confidence: 0.9,
        clarity: 0.8,
        accessible: true,
      },
      {
        memory_id: "mem-e-hidden",
        content: "不應被取出的壓抑記憶",
        accessible: false,
      },
    ],
    "夜": [
      {
        memory_id: "mem-y-1",
        content: "伊萊亞斯剛才完成恢復確認",
        source_kind: "direct_observation",
        confidence: 0.95,
        clarity: 0.9,
        accessible: true,
      },
    ],
  },
  available_actions: {
    "伊萊亞斯・諾爾": [
      {
        action_id: "elias-step-line",
        intent: "走到前方白線",
        duration_estimate: "2s",
        movement: { dx: 0, dy: 1 },
      },
      {
        action_id: "elias-wait",
        intent: "留在原地等待",
      },
    ],
    "夜": [
      {
        action_id: "yoru-watch",
        intent: "留在原地觀察",
      },
    ],
  },
};

const initialStateHash = hashAgentRunValue(initialWorldState);

try {
  const contract = buildWorldSimulationLoopContract();
  assert.equal(contract.scheduling, "event_driven");
  assert.equal(contract.world_state_owner, "programmatic_world_simulator");
  assert.equal(contract.character_choice_owner, "chatgpt_character_brain");
  assert.equal(contract.character_runtime.version, worldSimulationCharacterRuntimeVersion);
  assert.equal(
    contract.character_runtime.identity,
    "world_lineage_plus_formal_character_entity_id",
  );
  assert.equal(contract.character_runtime.current_world_lineage_carrier, "world_simulation_session_id");
  assert.equal(
    contract.character_runtime.current_world_lineage_carrier_is_permanent_world_philosophy,
    false,
  );
  assert.equal(contract.character_runtime.same_runtime_reentrant, false);
  assert.equal(contract.character_runtime.same_runtime_turns_serialized, true);
  assert.equal(contract.character_runtime.different_runtimes_share_turn_lock, false);
  assert.equal(contract.character_runtime.storage_scope, "process_local_ephemeral_memory");
  assert.equal(contract.character_runtime.lifecycle_release_requires_idle, true);
  assert.equal(contract.character_runtime.delegates_existing_character_brain_backend, true);
  assert.equal(contract.character_runtime.durable_mind_persistence, false);
  assert.equal(contract.character_runtime.durable_mind_mutation_before_world_commit, false);
  assert.equal(
    contract.character_runtime.committed_experience_delivery,
    "at_least_once_with_idempotent_runtime_consumption",
  );
  assert.equal(
    contract.character_runtime.committed_experience_ordering_mechanism,
    "contiguous_per_character_experience_sequence_plus_committed_revision",
  );
  assert.equal(
    contract.character_runtime.committed_experience_sequence_source,
    "immutable_committed_world_history",
  );
  assert.equal(contract.character_runtime.committed_experience_global_delivery_lock, false);
  assert.equal(contract.character_runtime.durable_experience_cursor_installed, false);
  assert.equal(contract.character_runtime.current_mind_owner, "character_runtime");
  assert.equal(
    contract.character_runtime.post_commit_cognitive_delivery_order,
    "current_mind_transition_before_experience_receipt",
  );
  assert.equal(
    contract.character_runtime.experience_delivery_deferred_when_current_mind_replay_required,
    true,
  );
  assert.equal(contract.character_runtime.current_mind_global_attention_lock, false);
  assert.equal(contract.character_runtime.persistent_mind_learning_installed, false);
  assert.equal(
    contract.character_current_mind.current_mind_contract_version,
    worldSimulationCharacterCurrentMindContractVersion,
  );
  assert.equal(
    contract.character_current_mind.attention_reducer_version,
    worldSimulationCharacterAttentionReducerVersion,
  );
  assert.equal(
    contract.character_current_mind.projection_version,
    worldSimulationCharacterCurrentMindProjectionVersion,
  );
  assert.equal(contract.character_current_mind.owner, "character_runtime");
  assert.equal(contract.character_current_mind.legacy_attention_seed_bootstrap_only, true);
  assert.equal(contract.character_current_mind.legacy_expectation_seed_bootstrap_only, true);
  assert.equal(contract.character_current_mind.speculative_before_world_commit, true);
  assert.equal(contract.character_current_mind.committed_only_after_successful_world_commit, true);
  assert.equal(contract.character_current_mind.common_deterministic_priority_resolver, true);
  assert.equal(contract.character_current_mind.asynchronous_codelet_race_used, false);
  assert.equal(contract.character_current_mind.random_tie_break_used, false);
  assert.equal(contract.character_current_mind.focus_inertia_hysteresis_installed, true);
  assert.equal(contract.character_current_mind.interrupted_focus_erased_immediately, false);
  assert.equal(
    contract.character_current_mind.decay_basis,
    "simulation_time_plus_committed_cognitive_sequence",
  );
  assert.equal(contract.character_current_mind.wall_clock_decay_used, false);
  assert.equal(contract.character_current_mind.fixed_four_item_working_memory_assumed, false);
  assert.equal(contract.character_current_mind.attention_internal_state_exposed_to_character_brain, false);
  assert.equal(contract.character_current_mind.focus_directly_equals_encode, false);
  assert.equal(contract.character_current_mind.non_focus_encoding_evidence_allowed, true);
  assert.equal(contract.character_current_mind.historical_replay_runs_current_attention_algorithm, false);
  assert.equal(contract.character_current_mind.historical_replay_reruns_phase63c_retrieval, false);
  assert.equal(contract.character_current_mind.experience_receipt_same_turn_retroactive_attention_allowed, false);
  assert.equal(
    contract.committed_character_experience.experience_contract_version,
    worldSimulationCharacterExperienceContractVersion,
  );
  assert.equal(
    contract.committed_character_experience.projection_version,
    worldSimulationCharacterExperienceProjectionVersion,
  );
  assert.equal(contract.committed_character_experience.established_only_after_successful_world_commit, true);
  assert.equal(contract.committed_character_experience.world_truth_is_character_experience, false);
  assert.equal(contract.committed_character_experience.character_experience_is_memory, false);
  assert.equal(contract.committed_character_experience.hidden_world_truth_allowed, false);
  assert.equal(contract.committed_character_experience.participant_intent_is_successful_outcome, false);
  assert.equal(contract.committed_character_experience.objective_action_result_auto_exposed, false);
  assert.equal(
    contract.committed_character_experience
      .explicit_bounded_actor_experience_evidence_required_for_post_outcome_experience,
    true,
  );
  assert.equal(contract.committed_character_experience.replay_uses_historical_projection_semantics, true);
  assert.equal(contract.committed_character_experience.replay_reinterprets_history_with_current_perception_engine, false);
  assert.equal(contract.committed_character_experience.projector_metadata_exposed_to_character_brain, false);
  assert.equal(contract.committed_character_experience.phase63_subjective_memory_contract_replaced, false);
  assert.equal(contract.causal_outcome_owner, "programmatic_causal_adjudicator");
  assert.equal(contract.character_brain_receives_world_truth, false);
  assert.equal(contract.stale_state_commit_rejected, true);

  const syntheticRuntimeIdentitiesForSequence = (experienceSequence) => [
    {
      character: "Alpha",
      world_lineage: "experience-lineage",
      character_entity_id: "character_alpha",
      canonical_name: "Alpha",
      identity_source: "phase62c_synthetic_experience_identity",
      formal_identity: true,
      experience_sequence: experienceSequence,
    },
    {
      character: "Beta",
      world_lineage: "experience-lineage",
      character_entity_id: "character_beta",
      canonical_name: "Beta",
      identity_source: "phase62c_synthetic_experience_identity",
      formal_identity: true,
      experience_sequence: experienceSequence,
    },
  ];

  const syntheticExperienceProjection =
    projectWorldSimulationCharacterExperienceEvidence({
      runtime_identities: syntheticRuntimeIdentitiesForSequence(1),
      prepared_turn: {
        turn_id: "synthetic-experience-turn",
        decision_packets: [
          {
            character: "Alpha",
            perception: {
              observed: [
                {
                  perceptual_label: "視野突然變暗",
                  entity_id: "hidden-button-actor-engine-id",
                  exact_source_position: { x: 9, y: 9 },
                },
              ],
              audible: [],
              other_senses: [],
              information_boundary: { hidden_world_truth_exposed: false },
            },
          },
          {
            character: "Beta",
            perception: {
              observed: [{ perceptual_label: "燈熄了" }],
              audible: [],
              other_senses: [],
              information_boundary: {},
            },
          },
        ],
      },
      selected_action_intents: [
        {
          character: "Alpha",
          selection: "candidate_action_intent",
          action_id: "alpha-strike-shoulder",
          intent: "刺中對方肩膀",
        },
        {
          character: "Beta",
          selection: "reject_all",
          action_id: null,
          intent: null,
        },
      ],
      action_outcomes: [
        {
          actor: "Alpha",
          result: "objective_internal_result_should_not_surface",
          causal_evidence: "A 在背後按下按鈕導致燈熄滅",
          source_entity_id: "hidden-button-actor-engine-id",
          character_experience: {
            performed: true,
            perceived_result: "attack_missed",
          },
        },
      ],
    });
  const repeatedSyntheticExperienceProjection =
    projectWorldSimulationCharacterExperienceEvidence({
      runtime_identities: syntheticRuntimeIdentitiesForSequence(1),
      prepared_turn: {
        turn_id: "synthetic-experience-turn",
        decision_packets: [
          {
            character: "Alpha",
            perception: {
              observed: [
                {
                  perceptual_label: "視野突然變暗",
                  entity_id: "hidden-button-actor-engine-id",
                  exact_source_position: { x: 9, y: 9 },
                },
              ],
              audible: [],
              other_senses: [],
              information_boundary: { hidden_world_truth_exposed: false },
            },
          },
          {
            character: "Beta",
            perception: {
              observed: [{ perceptual_label: "燈熄了" }],
              audible: [],
              other_senses: [],
              information_boundary: {},
            },
          },
        ],
      },
      selected_action_intents: [
        {
          character: "Alpha",
          selection: "candidate_action_intent",
          action_id: "alpha-strike-shoulder",
          intent: "刺中對方肩膀",
        },
        {
          character: "Beta",
          selection: "reject_all",
          action_id: null,
          intent: null,
        },
      ],
      action_outcomes: [
        {
          actor: "Alpha",
          result: "objective_internal_result_should_not_surface",
          causal_evidence: "A 在背後按下按鈕導致燈熄滅",
          source_entity_id: "hidden-button-actor-engine-id",
          character_experience: {
            performed: true,
            perceived_result: "attack_missed",
          },
        },
      ],
    });
  assert.deepEqual(
    repeatedSyntheticExperienceProjection,
    syntheticExperienceProjection,
    "same committed-turn evidence under the same historical semantics must project deterministically",
  );
  assert.equal(
    syntheticExperienceProjection.projection_version,
    worldSimulationCharacterExperienceProjectionVersion,
  );
  const alphaSyntheticExperience = syntheticExperienceProjection.character_projections[0];
  const betaSyntheticExperience = syntheticExperienceProjection.character_projections[1];
  assert.equal(alphaSyntheticExperience.experience.roles.participant, true);
  assert.equal(alphaSyntheticExperience.experience.roles.observer, true);
  assert.equal(
    alphaSyntheticExperience.experience.participation.selected_intent.intent,
    "刺中對方肩膀",
  );
  assert.equal(
    alphaSyntheticExperience.experience.participation.experienced_action_outcomes[0].performed,
    true,
  );
  assert.equal(
    alphaSyntheticExperience.experience.participation.experienced_action_outcomes[0].perceived_result,
    "attack_missed",
  );
  assert.equal(
    alphaSyntheticExperience.experience.participation.selected_intent_is_not_outcome,
    true,
  );
  assert.equal(betaSyntheticExperience.experience.roles.participant, false);
  assert.equal(betaSyntheticExperience.experience.roles.observer, true);
  const syntheticExperienceText = JSON.stringify(syntheticExperienceProjection);
  assert.equal(syntheticExperienceText.includes("視野突然變暗"), true);
  assert.equal(syntheticExperienceText.includes("A 在背後按下按鈕導致燈熄滅"), false);
  assert.equal(
    syntheticExperienceText.includes("objective_internal_result_should_not_surface"),
    false,
  );
  assert.equal(syntheticExperienceText.includes("hidden-button-actor-engine-id"), false);
  assert.equal(syntheticExperienceText.includes("exact_source_position"), false);
  assert.equal(syntheticExperienceText.includes("causal_evidence"), false);
  assert.equal(Object.hasOwn(alphaSyntheticExperience.experience, "world_state"), false);
  assert.equal(Object.hasOwn(betaSyntheticExperience.experience, "world_state"), false);

  const formalIdentity = await resolveWorldSimulationFormalCharacterIdentity(
    "Runtime別名",
    {
      characterIdentityRegistryOptions: {
        formalCanonSources: [
          {
            source_file: "data/canon_db/sources/entity_character_runtime_v0_test.md",
            source_hash: "runtime-v0-test-source",
            source_modified_at: "2026-09-01T00:00:00.000Z",
            content: [
              "## character｜Runtime測試角色｜character_runtime_v0_fixture",
              "",
              "| 欄位 | 正式 Canon |",
              "| --- | --- |",
              "| 中文名 | Runtime測試角色 |",
              "| 搜尋別名 | Runtime別名 |",
              "| 性別 | 男 |",
              "| 固有能力 | 未確認 |",
            ].join("\n"),
          },
        ],
      },
    },
  );
  assert.equal(formalIdentity.entity_id, "character_runtime_v0_fixture");
  assert.equal(formalIdentity.canonical_name, "Runtime測試角色");
  assert.equal(formalIdentity.formal, true);
  assert.equal(formalIdentity.identity_source, "structured_canon_entity_registry");
  const formalIdentityById = await resolveWorldSimulationFormalCharacterIdentity(
    "character_runtime_v0_fixture",
    {
      characterIdentityRegistryOptions: {
        formalCanonSources: [
          {
            source_file: "data/canon_db/sources/entity_character_runtime_v0_test.md",
            source_hash: "runtime-v0-test-source",
            source_modified_at: "2026-09-01T00:00:00.000Z",
            content: [
              "## character｜Runtime測試角色｜character_runtime_v0_fixture",
              "",
              "| 欄位 | 正式 Canon |",
              "| --- | --- |",
              "| 中文名 | Runtime測試角色 |",
              "| 搜尋別名 | Runtime別名 |",
              "| 性別 | 男 |",
              "| 固有能力 | 未確認 |",
            ].join("\n"),
          },
        ],
      },
    },
  );
  assert.equal(formalIdentityById.entity_id, formalIdentity.entity_id);

  const identityByCharacter = new Map([
    ["Alpha", "character_alpha"],
    ["AlphaAlias", "character_alpha"],
    ["Beta", "character_beta"],
  ]);
  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: identityByCharacter.get(character),
      canonical_name: character === "AlphaAlias" ? "Alpha" : character,
      identity_source: "phase62c_runtime_test_identity_resolver",
      formal: true,
    }),
  });

  const alphaLineageA = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
  });
  const alphaAliasLineageA = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "AlphaAlias",
  });
  const betaLineageA = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Beta",
  });
  const alphaLineageB = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-b",
    character: "Alpha",
  });
  assert.equal(alphaLineageA.runtime_id, alphaAliasLineageA.runtime_id);
  assert.notEqual(alphaLineageA.runtime_id, betaLineageA.runtime_id);
  assert.notEqual(alphaLineageA.runtime_id, alphaLineageB.runtime_id);
  assert.equal(alphaLineageA.character_entity_id, "character_alpha");
  assert.equal(alphaLineageA.durable_mind_persistence, false);
  assert.equal(alphaLineageA.durable_mind_mutation_count, 0);
  assert.equal(alphaLineageB.lifecycle.turns_started, 0);

  const runtimeOrder = [];
  let releaseAlphaFirst;
  const alphaFirstGate = new Promise((resolve) => {
    releaseAlphaFirst = resolve;
  });
  const alphaFirstTurn = runtimeManager.runCharacterTurn(
    {
      world_simulation_session_id: "lineage-a",
      character: "Alpha",
      brain_input: {
        character: "Alpha",
        candidate_action_intents: [{ action_id: "alpha-a", intent: "wait" }],
      },
      characterBrain: async (brainInput) => {
        runtimeOrder.push("alpha-1-start");
        assert.equal(Object.hasOwn(brainInput, "runtime_id"), false);
        assert.equal(Object.hasOwn(brainInput, "world_lineage"), false);
        assert.equal(Object.hasOwn(brainInput, "character_entity_id"), false);
        await alphaFirstGate;
        runtimeOrder.push("alpha-1-end");
        return { action_id: "alpha-a" };
      },
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  const alphaBusyRuntime = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
  });
  assert.equal(alphaBusyRuntime.active_turns, 1);
  assert.equal(alphaBusyRuntime.pending_turns, 1);
  await assert.rejects(
    () => runtimeManager.releaseWorldLineage("lineage-a"),
    (error) => error?.code === "WORLD_SIMULATION_CHARACTER_RUNTIME_LINEAGE_BUSY",
  );
  const alphaSecondTurn = runtimeManager.runCharacterTurn(
    {
      world_simulation_session_id: "lineage-a",
      character: "AlphaAlias",
      brain_input: {
        character: "Alpha",
        candidate_action_intents: [{ action_id: "alpha-b", intent: "observe" }],
      },
      characterBrain: async () => {
        runtimeOrder.push("alpha-2-start");
        runtimeOrder.push("alpha-2-end");
        return { action_id: "alpha-b" };
      },
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(runtimeOrder, ["alpha-1-start"]);
  const alphaQueuedRuntime = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
  });
  assert.equal(alphaQueuedRuntime.active_turns, 1);
  assert.equal(alphaQueuedRuntime.pending_turns, 2);

  const betaTurn = runtimeManager.runCharacterTurn(
    {
      world_simulation_session_id: "lineage-a",
      character: "Beta",
      brain_input: {
        character: "Beta",
        candidate_action_intents: [{ action_id: "beta-a", intent: "move" }],
      },
      characterBrain: async () => {
        runtimeOrder.push("beta-start");
        runtimeOrder.push("beta-end");
        return { action_id: "beta-a" };
      },
    },
  );
  await betaTurn;
  assert.deepEqual(runtimeOrder, ["alpha-1-start", "beta-start", "beta-end"]);

  releaseAlphaFirst();
  await Promise.all([alphaFirstTurn, alphaSecondTurn]);
  assert.deepEqual(runtimeOrder, [
    "alpha-1-start",
    "beta-start",
    "beta-end",
    "alpha-1-end",
    "alpha-2-start",
    "alpha-2-end",
  ]);
  const alphaRuntimeAfterTurns = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
  });
  assert.equal(alphaRuntimeAfterTurns.lifecycle.turns_started, 2);
  assert.equal(alphaRuntimeAfterTurns.lifecycle.turns_completed, 2);
  assert.equal(alphaRuntimeAfterTurns.lifecycle.max_concurrent_turns, 1);
  assert.equal(alphaRuntimeAfterTurns.durable_mind_mutation_count, 0);

  await assert.rejects(
    () => runtimeManager.runCharacterTurn(
      {
        world_simulation_session_id: "lineage-a",
        character: "Alpha",
        brain_input: { character: "Alpha", candidate_action_intents: [] },
        characterBrain: async () => {
          throw new Error("synthetic backend failure");
        },
      },
    ),
    /synthetic backend failure/u,
  );
  const alphaRuntimeAfterFailure = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
  });
  assert.equal(alphaRuntimeAfterFailure.lifecycle.turns_failed, 1);
  assert.equal(alphaRuntimeAfterFailure.durable_mind_mutation_count, 0);

  const firstMindSpeculationInput = {
    world_simulation_session_id: "mind-lineage",
    turn_id: "mind-turn-1",
    character: "Alpha",
    simulation_time: "2026-09-01T10:00:00+08:00",
    perception: {
      observed: [
        {
          perceptual_label: "正在閱讀的操作手冊",
          goal_relevance: "high",
          salience: "medium",
          entity_id: "engine-private-book-id",
          exact_source_position: { x: 1, y: 2 },
        },
      ],
      audible: [
        {
          perceptual_label: "遠處風聲",
          salience: "low",
        },
      ],
      other_senses: [],
    },
    recovered_memories: [
      {
        memory_id: "engine-private-memory-id",
        content: "手冊上一頁提到先確認鎖扣",
        relevance: "medium",
        retrieval_process_id: "engine-private-retrieval-id",
      },
    ],
    current_action: "閱讀操作手冊",
    compatibility_state: {
      attention: "閱讀操作手冊",
      goals: ["閱讀操作手冊"],
    },
  };
  const firstMindSpeculation = await runtimeManager.prepareSpeculativeCurrentMind(
    firstMindSpeculationInput,
  );
  const repeatedFirstMindSpeculation = await runtimeManager.prepareSpeculativeCurrentMind(
    firstMindSpeculationInput,
  );
  assert.deepEqual(
    repeatedFirstMindSpeculation,
    firstMindSpeculation,
    "same committed Current Mind plus same bounded evidence must resolve deterministically",
  );
  assert.equal(
    firstMindSpeculation.projection.current_mind_contract_version,
    worldSimulationCharacterCurrentMindContractVersion,
  );
  assert.equal(
    firstMindSpeculation.projection.attention_reducer_version,
    worldSimulationCharacterAttentionReducerVersion,
  );
  assert.equal(
    firstMindSpeculation.projection.projection_version,
    worldSimulationCharacterCurrentMindProjectionVersion,
  );
  assert.equal(firstMindSpeculation.projection.boundaries.owner, "character_runtime");
  assert.equal(firstMindSpeculation.projection.boundaries.speculative_until_world_commit, true);
  assert.equal(firstMindSpeculation.projection.boundaries.character_brain_authors_projection, false);
  assert.equal(firstMindSpeculation.projection.boundaries.gpt_hidden_reasoning_included, false);
  assert.equal(
    firstMindSpeculation.projection.resolver_audit.simple_sort_score_focus_selection_used,
    false,
  );
  assert.equal(firstMindSpeculation.projection.resolver_audit.asynchronous_codelet_race_used, false);
  assert.equal(firstMindSpeculation.projection.resolver_audit.random_tie_break_used, false);
  assert.equal(firstMindSpeculation.projection.resolver_audit.wall_clock_decay_used, false);
  assert.equal(
    firstMindSpeculation.projection.resolver_audit.focus_resolution_evidence
      .selected_candidate_source_kind,
    "perception",
  );
  assert.equal(
    firstMindSpeculation.projection.resolver_audit.focus_resolution_evidence
      .support_processes.includes("perceptual_salience_process"),
    true,
  );
  assert.equal(
    firstMindSpeculation.projection.focus_transition.to.content.perceptual_label,
    "正在閱讀的操作手冊",
  );
  assert.equal(
    firstMindSpeculation.internal_attention_state.bids.some(
      (bid) => bid.sources.includes("perceptual_salience_process"),
    ),
    true,
  );
  assert.equal(
    firstMindSpeculation.internal_attention_state.bids.some(
      (bid) => bid.sources.includes("goal_intention_relevance_process"),
    ),
    true,
  );
  assert.equal(
    firstMindSpeculation.attention_encoding_evidence,
    undefined,
    "internal helper field name must not accidentally drift into the public speculative result",
  );
  assert.equal(firstMindSpeculation.encoding_evidence.length, 2);
  assert.equal(
    firstMindSpeculation.encoding_evidence.some(
      (evidence) => evidence.processing_level === "focus"
        && evidence.memory_encoding_decision === "unspecified",
    ),
    true,
  );
  assert.equal(
    firstMindSpeculation.encoding_evidence.some(
      (evidence) => evidence.processing_level !== "focus"
        && evidence.memory_encoding_decision === "unspecified",
    ),
    true,
    "non-focus observations must still carry encoding evidence without becoming do_not_encode",
  );
  const characterFacingMindText = JSON.stringify({
    attention: firstMindSpeculation.character_facing_attention,
    working_context: firstMindSpeculation.working_context,
  });
  for (const forbidden of [
    "candidate_id",
    "attention_bids",
    "priority_evidence",
    "internal_priority_strength",
    "world_lineage",
    "character_entity_id",
    "projection_hash",
    "transition_hash",
    "engine-private-book-id",
    "engine-private-memory-id",
    "engine-private-retrieval-id",
    "exact_source_position",
    "source_kind",
    "salience",
    "goal_relevance",
    "urgency",
    "expectation_violation",
    "awareness_boundary",
  ]) {
    assert.equal(
      characterFacingMindText.includes(forbidden),
      false,
      `character-facing Current Mind must exclude ${forbidden}`,
    );
  }

  const firstMindEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "mind-turn-1",
      decision_packets: [
        {
          character: "Alpha",
          current_mind_transition_projection: firstMindSpeculation.projection,
        },
      ],
    },
  });
  const firstMindDelivery = await runtimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "mind-lineage",
    history_entry: {
      turn_id: "mind-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_current_mind_projection: firstMindEnvelope,
    },
  });
  assert.equal(firstMindDelivery.consumed_count, 1);
  assert.equal(firstMindDelivery.duplicate_count, 0);
  const duplicateFirstMindDelivery = await runtimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "mind-lineage",
    history_entry: {
      turn_id: "mind-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_current_mind_projection: firstMindEnvelope,
    },
  });
  assert.equal(duplicateFirstMindDelivery.consumed_count, 0);
  assert.equal(duplicateFirstMindDelivery.duplicate_count, 1);
  const mindAfterFirstCommit = await runtimeManager.inspectRuntime({
    world_simulation_session_id: "mind-lineage",
    character: "Alpha",
  });
  assert.equal(mindAfterFirstCommit.current_mind.owner, "character_runtime");
  assert.equal(mindAfterFirstCommit.current_mind.committed_sequence, 1);
  assert.equal(mindAfterFirstCommit.current_mind.committed_transition_effect_count, 1);
  assert.equal(mindAfterFirstCommit.current_mind.duplicate_delivery_attempts, 1);
  assert.equal(mindAfterFirstCommit.current_mind.persistent_mind_learning_installed, false);
  assert.equal(mindAfterFirstCommit.durable_mind_mutation_count, 0);

  const weakChallengerSpeculation = await runtimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "mind-lineage",
    turn_id: "mind-turn-2",
    character: "Alpha",
    simulation_time: "2026-09-01T10:01:00+08:00",
    perception: {
      observed: [
        {
          perceptual_label: "正在閱讀的操作手冊",
          goal_relevance: "high",
          salience: "low",
        },
      ],
      audible: [
        {
          perceptual_label: "牆上時鐘滴答",
          salience: "low",
        },
      ],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "閱讀操作手冊",
    compatibility_state: {
      attention: "過時的 world-side attention 不應重新注入",
      goals: ["閱讀操作手冊"],
    },
  });
  assert.equal(
    weakChallengerSpeculation.projection.source_refs.some(
      (ref) => ref.kind === "legacy_attention_seed",
    ),
    false,
    "legacy world-side attention may bootstrap Current Mind only before the first committed sequence",
  );
  assert.equal(
    weakChallengerSpeculation.projection.reducer_state_after.focus.candidate_id,
    firstMindSpeculation.projection.reducer_state_after.focus.candidate_id,
    "attention metadata changes must not change the stable identity of the same perceived content",
  );
  assert.equal(
    weakChallengerSpeculation.projection.resolver_audit.focus_resolution_evidence
      .support_processes.includes("perceptual_salience_process"),
    true,
    "a refreshed prior focus must merge fresh perceptual evidence instead of surviving only as stale continuity",
  );
  assert.equal(weakChallengerSpeculation.projection.focus_transition.interrupted, false);
  assert.equal(
    weakChallengerSpeculation.projection.focus_transition.to.content.perceptual_label,
    "正在閱讀的操作手冊",
    "a weak challenger must not oscillate focus away from a refreshed current focus",
  );
  const secondMindEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "mind-turn-2",
      decision_packets: [
        {
          character: "Alpha",
          current_mind_transition_projection: weakChallengerSpeculation.projection,
        },
      ],
    },
  });
  await runtimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "mind-lineage",
    history_entry: {
      turn_id: "mind-turn-2",
      revision_from: 1,
      revision_to: 2,
      committed_character_current_mind_projection: secondMindEnvelope,
    },
  });

  const strongInterruptSpeculation = await runtimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "mind-lineage",
    turn_id: "mind-turn-3",
    character: "Alpha",
    simulation_time: "2026-09-01T10:02:00+08:00",
    perception: {
      observed: [
        {
          perceptual_label: "火警警報燈突然亮起",
          urgency: "critical",
          expectation_violation: true,
          salience: "high",
        },
      ],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "閱讀操作手冊",
    compatibility_state: {
      goals: ["閱讀操作手冊"],
    },
  });
  assert.equal(strongInterruptSpeculation.projection.focus_transition.interrupted, true);
  assert.equal(
    strongInterruptSpeculation.projection.focus_transition.to.content.perceptual_label,
    "火警警報燈突然亮起",
  );
  assert.equal(
    strongInterruptSpeculation.character_facing_attention.suspended_context.some(
      (item) => item.content?.perceptual_label === "正在閱讀的操作手冊",
    ),
    true,
    "interrupted work must move to suspended context instead of being erased",
  );
  assert.equal(
    strongInterruptSpeculation.character_facing_attention.fading_context.some(
      (item) => item.content?.perceptual_label === "正在閱讀的操作手冊",
    ),
    false,
    "one interrupted focus must not be duplicated into both suspended and fading context",
  );
  const strongBid = strongInterruptSpeculation.internal_attention_state.bids.find(
    (bid) => bid.sources.includes("expectation_violation_process"),
  );
  assert.ok(strongBid);
  assert.equal(strongBid.sources.includes("immediate_constraint_urgency_process"), true);
  const thirdMindEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "mind-turn-3",
      decision_packets: [
        {
          character: "Alpha",
          current_mind_transition_projection: strongInterruptSpeculation.projection,
        },
      ],
    },
  });
  await runtimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "mind-lineage",
    history_entry: {
      turn_id: "mind-turn-3",
      revision_from: 2,
      revision_to: 3,
      committed_character_current_mind_projection: thirdMindEnvelope,
    },
  });

  const resumedSuspendedSpeculation = await runtimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "mind-lineage",
    turn_id: "mind-turn-4-reactivation",
    character: "Alpha",
    simulation_time: "2026-09-01T10:03:00+08:00",
    perception: {
      observed: [{
        perceptual_label: "正在閱讀的操作手冊",
        goal_relevance: "high",
        salience: "medium",
      }],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "閱讀操作手冊",
    compatibility_state: { goals: ["閱讀操作手冊"] },
  });
  assert.equal(
    resumedSuspendedSpeculation.character_facing_attention.focus.content.perceptual_label,
    "正在閱讀的操作手冊",
    "fresh evidence must be allowed to reactivate a previously suspended focus",
  );
  assert.equal(
    resumedSuspendedSpeculation.character_facing_attention.suspended_context.some(
      (item) => item.content?.perceptual_label === "正在閱讀的操作手冊",
    ),
    false,
    "a reactivated item must not remain duplicated in suspended context",
  );

  const deterministicDecayInput = {
    world_simulation_session_id: "mind-lineage",
    turn_id: "mind-turn-4",
    character: "Alpha",
    simulation_time: "2026-09-01T11:00:00+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: null,
    compatibility_state: {},
  };
  const decayedSpeculation = await runtimeManager.prepareSpeculativeCurrentMind(
    deterministicDecayInput,
  );
  const repeatedDecayedSpeculation = await runtimeManager.prepareSpeculativeCurrentMind(
    deterministicDecayInput,
  );
  assert.deepEqual(decayedSpeculation, repeatedDecayedSpeculation);
  assert.equal(decayedSpeculation.character_facing_attention.focus, null);
  assert.equal(decayedSpeculation.projection.resolver_audit.wall_clock_decay_used, false);
  assert.equal(
    decayedSpeculation.projection.resolver_audit.decay_basis,
    "committed_cognitive_sequence_plus_simulation_time",
  );

  const expectationRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `expectation_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "phase62c_current_mind_expectation_fixture",
      formal: true,
    }),
  });
  const expectationTurnOne = await expectationRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "expectation-lineage",
    turn_id: "expectation-world-turn-1",
    character: "Alpha",
    simulation_time: "2026-09-01T11:10:00+08:00",
    perception: {
      observed: [{ perceptual_label: "手已經壓��門把上", goal_relevance: "high" }],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "推門",
    compatibility_state: {
      goals: ["推門"],
      temporary_expectation: {
        action: "推門",
        expected_result: "door_opened",
      },
    },
  });
  assert.equal(
    expectationTurnOne.character_facing_attention.temporary_expectation.expected_result,
    "door_opened",
  );
  const expectationMindEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "expectation-world-turn-1",
      decision_packets: [{
        character: "Alpha",
        current_mind_transition_projection: expectationTurnOne.projection,
      }],
    },
  });
  await expectationRuntimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "expectation-lineage",
    history_entry: {
      turn_id: "expectation-world-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_current_mind_projection: expectationMindEnvelope,
    },
  });
  const expectationExperienceProjection = projectWorldSimulationCharacterExperienceEvidence({
    runtime_identities: [{
      character: "Alpha",
      world_lineage: "expectation-lineage",
      character_entity_id: "expectation_alpha",
      canonical_name: "Alpha",
      identity_source: "phase62c_current_mind_expectation_fixture",
      formal_identity: true,
      experience_sequence: 1,
    }],
    prepared_turn: {
      turn_id: "expectation-world-turn-1",
      decision_packets: [{
        character: "Alpha",
        perception: { observed: [], audible: [], other_senses: [] },
      }],
    },
    selected_action_intents: [{
      character: "Alpha",
      selection: "candidate_action_intent",
      action_id: "push-door",
      intent: "推門",
    }],
    action_outcomes: [{
      actor: "Alpha",
      causal_evidence: "門鎖阻止門扇移動",
      character_experience: {
        performed: true,
        perceived_result: "door_stayed_closed",
      },
    }],
  });
  await expectationRuntimeManager.deliverCommittedExperienceProjection({
    world_simulation_session_id: "expectation-lineage",
    history_entry: {
      turn_id: "expectation-world-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_experience_projection: expectationExperienceProjection,
    },
  });
  const expectationTurnTwo = await expectationRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "expectation-lineage",
    turn_id: "expectation-world-turn-2",
    character: "Alpha",
    simulation_time: "2026-09-01T11:10:01+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: "推門",
    compatibility_state: { goals: ["推門"] },
  });
  const automaticExpectationMismatchBid =
    expectationTurnTwo.internal_attention_state.bids.find(
      (bid) => bid.sources.includes("expectation_violation_process"),
    );
  assert.ok(
    automaticExpectationMismatchBid,
    "a committed perceived result that contradicts a prior temporary expectation must create expectation-violation attention evidence on the next cycle",
  );
  assert.equal(
    expectationTurnTwo.character_facing_attention.temporary_expectation,
    null,
    "a temporary expectation with an explicit perceived result must resolve after the committed Experience is integrated",
  );
  assert.equal(
    expectationTurnTwo.projection.reducer_state_after.last_experience_sequence_integrated,
    1,
  );
  assert.equal(
    expectationTurnTwo.projection.source_refs.some(
      (ref) => ref.kind === "committed_action_experience" && ref.experience_sequence === 1,
    ),
    true,
  );
  const expectationTurnTwoEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "expectation-world-turn-2",
      decision_packets: [{
        character: "Alpha",
        current_mind_transition_projection: expectationTurnTwo.projection,
      }],
    },
  });
  await expectationRuntimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "expectation-lineage",
    history_entry: {
      turn_id: "expectation-world-turn-2",
      revision_from: 1,
      revision_to: 2,
      committed_character_current_mind_projection: expectationTurnTwoEnvelope,
    },
  });
  const expectationTurnThree = await expectationRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "expectation-lineage",
    turn_id: "expectation-world-turn-3",
    character: "Alpha",
    simulation_time: "2026-09-01T11:10:02+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: null,
    compatibility_state: {
      temporary_expectation: {
        action: "推門",
        expected_result: "door_opened",
      },
    },
  });
  assert.equal(
    expectationTurnThree.character_facing_attention.temporary_expectation,
    null,
    "a resolved expectation must not be resurrected by stale world-side compatibility state after bootstrap",
  );
  assert.equal(
    expectationTurnThree.projection.source_snapshot_hash
      === expectationTurnTwo.projection.source_snapshot_hash,
    false,
    "the next Current Mind cycle must have its own deterministic source snapshot",
  );

  const tieRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `tie_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "phase62c_current_mind_tie_fixture",
      formal: true,
    }),
  });
  const tieInput = {
    world_simulation_session_id: "tie-lineage",
    turn_id: "tie-turn-1",
    character: "Alpha",
    simulation_time: "2026-09-01T12:00:00+08:00",
    perception: {
      observed: [
        { perceptual_label: "同優先候選 A", salience: "medium" },
        { perceptual_label: "同優先候選 B", salience: "medium" },
      ],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: null,
    compatibility_state: {},
  };
  const tieResult = await tieRuntimeManager.prepareSpeculativeCurrentMind(tieInput);
  const repeatedTieResult = await tieRuntimeManager.prepareSpeculativeCurrentMind(tieInput);
  assert.deepEqual(tieResult, repeatedTieResult);
  assert.equal(
    tieResult.projection.focus_transition.to.content.perceptual_label,
    "同優先候選 A",
    "stable activation ordering must deterministically break otherwise equal attention evidence",
  );

  const gatingRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `gating_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "phase62c_v4_working_memory_gating_fixture",
      formal: true,
    }),
  });
  const gatingTurnOneInput = {
    world_simulation_session_id: "gating-lineage",
    turn_id: "gating-turn-1",
    character: "Alpha",
    simulation_time: "2026-09-01T12:05:00+08:00",
    perception: {
      observed: [{
        perceptual_label: "正在閱讀的操作手冊",
        goal_relevance: "high",
        salience: "medium",
      }],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "閱讀操作手冊",
    compatibility_state: { goals: ["閱讀操作手冊"] },
  };
  const gatingTurnOne = await gatingRuntimeManager.prepareSpeculativeCurrentMind(gatingTurnOneInput);
  const repeatedGatingTurnOne = await gatingRuntimeManager.prepareSpeculativeCurrentMind(gatingTurnOneInput);
  assert.deepEqual(
    gatingTurnOne.projection.admission_decisions,
    repeatedGatingTurnOne.projection.admission_decisions,
    "same prior state and same inputs must yield identical v4 admission decisions",
  );
  assert.equal(gatingTurnOne.projection.resolver_audit.selective_input_gating_installed, true);
  assert.equal(gatingTurnOne.projection.resolver_audit.input_gate_closed_by_default, true);
  assert.equal(gatingTurnOne.projection.resolver_audit.output_gating_installed, false);
  assert.equal(
    gatingTurnOne.projection.admission_decisions.some(
      (decision) => decision.source_kind === "perception" && decision.gate_outcome === "admit",
    ),
    true,
    "goal-relevant fresh perception must be admitted",
  );
  const gatingTurnOneEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "gating-turn-1",
      decision_packets: [{
        character: "Alpha",
        current_mind_transition_projection: gatingTurnOne.projection,
      }],
    },
  });
  assert.deepEqual(
    gatingTurnOneEnvelope.character_projections[0].admission_decisions,
    gatingTurnOne.projection.admission_decisions,
    "committed projection must preserve historical v4 gate decisions",
  );
  await gatingRuntimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "gating-lineage",
    history_entry: {
      turn_id: "gating-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_current_mind_projection: gatingTurnOneEnvelope,
    },
  });

  const gatingTurnTwo = await gatingRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "gating-lineage",
    turn_id: "gating-turn-2",
    character: "Alpha",
    simulation_time: "2026-09-01T12:06:00+08:00",
    perception: {
      observed: [{ perceptual_label: "牆上時鐘滴答", salience: "low" }],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [],
    current_action: "閱讀操作手冊",
    compatibility_state: { goals: ["閱讀操作手冊"] },
  });
  assert.equal(
    gatingTurnTwo.projection.admission_decisions.some(
      (decision) => decision.source_kind === "perception"
        && decision.gate_outcome === "reject"
        && decision.reason_codes.includes("insufficient_current_mind_support"),
    ),
    true,
    "low-salience irrelevant fresh perception must be rejectable even with free peripheral capacity",
  );
  assert.equal(
    gatingTurnTwo.projection.admission_decisions.some(
      (decision) => decision.source_kind === "perception"
        && decision.gate_outcome === "maintain"
        && decision.reason_codes.includes("goal_or_intention_support"),
    ),
    true,
    "prior goal-relevant perception must be maintainable without fresh perceptual refresh",
  );
  const gatingTurnTwoWorkingText = JSON.stringify(gatingTurnTwo.working_context);
  assert.equal(gatingTurnTwoWorkingText.includes("正在閱讀的操作手冊"), true);
  assert.equal(gatingTurnTwoWorkingText.includes("牆上時鐘滴答"), false);
  assert.equal(gatingTurnTwoWorkingText.includes("gate_outcome"), false);
  assert.equal(gatingTurnTwoWorkingText.includes("reason_codes"), false);
  assert.equal(gatingTurnTwoWorkingText.includes("maintenance_evidence"), false);
  assert.equal(
    gatingTurnTwo.encoding_evidence.some(
      (evidence) => evidence.current_mind_gate_outcome === "reject"
        && evidence.processing_level === "not_admitted",
    ),
    true,
    "rejected perception must remain distinct from peripheral Current Mind placement",
  );

  const weakRecollectionInput = {
    world_simulation_session_id: "gating-lineage",
    turn_id: "gating-weak-recollection",
    character: "Alpha",
    simulation_time: "2026-09-01T12:06:30+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [{ content: "小時候看過一只藍色杯子" }],
    current_action: "閱讀操作手冊",
    compatibility_state: { goals: ["閱讀操作手冊"] },
  };
  const weakRecollection = await gatingRuntimeManager.prepareSpeculativeCurrentMind(weakRecollectionInput);
  assert.equal(
    weakRecollection.projection.admission_decisions.some(
      (decision) => decision.source_kind === "recovered_memory" && decision.gate_outcome === "reject",
    ),
    true,
    "Phase63C recovery success must not guarantee Current Mind admission",
  );
  assert.equal(JSON.stringify(weakRecollection.working_context).includes("小時候看過一只藍色杯子"), false);

  const targetRelatedRecollectionInput = {
    ...weakRecollectionInput,
    turn_id: "gating-target-related-recollection",
    recovered_memories: [{
      content: "阿灰撞過活動擋板",
      target_relation: "target_related",
      content_kind: "detail",
    }],
  };
  const targetRelatedRecollection = await gatingRuntimeManager
    .prepareSpeculativeCurrentMind(targetRelatedRecollectionInput);
  assert.equal(
    targetRelatedRecollection.projection.admission_decisions.some(
      (decision) => decision.source_kind === "recovered_memory"
        && decision.gate_outcome === "admit"
        && decision.reason_codes.includes("goal_or_intention_support"),
    ),
    true,
    "Phase63C target-related recovered content must provide bounded admission support",
  );
  assert.equal(
    JSON.stringify(targetRelatedRecollection.working_context).includes("阿灰撞過活動擋板"),
    true,
  );

  const relevantRecollectionInput = {
    ...weakRecollectionInput,
    turn_id: "gating-relevant-recollection",
    recovered_memories: [{
      content: "閱讀操作手冊前要先確認總電源",
      goal_relevance: "high",
      content_kind: "detail",
    }],
  };
  const relevantRecollection = await gatingRuntimeManager.prepareSpeculativeCurrentMind(relevantRecollectionInput);
  const repeatedRelevantRecollection = await gatingRuntimeManager.prepareSpeculativeCurrentMind(relevantRecollectionInput);
  assert.deepEqual(
    relevantRecollection.projection.admission_decisions,
    repeatedRelevantRecollection.projection.admission_decisions,
  );
  assert.equal(
    relevantRecollection.projection.admission_decisions.some(
      (decision) => decision.source_kind === "recovered_memory" && decision.gate_outcome === "admit",
    ),
    true,
    "goal-relevant recollection may be admitted",
  );
  assert.equal(
    JSON.stringify(relevantRecollection.working_context).includes("閱讀操作手冊前要先確認總電源"),
    true,
  );
  const relevantRecollectionAdmissionDecision =
    relevantRecollection.projection.admission_decisions.find(
      (decision) => decision.source_kind === "recovered_memory",
    );
  assert.equal(
    Object.hasOwn(relevantRecollectionAdmissionDecision ?? {}, "focus"),
    false,
    "admission decision must not directly assign focus",
  );
  assert.equal(
    Object.hasOwn(relevantRecollectionAdmissionDecision ?? {}, "placement"),
    false,
    "admission decision must not directly assign Current Mind placement",
  );
  assert.equal(
    relevantRecollection.projection.resolver_audit.deterministic_pairwise_resolver,
    true,
  );
  if (
    relevantRecollection.working_context.focus?.content
    === "閱讀操作手冊前要先確認總電源"
  ) {
    assert.equal(
      relevantRecollection.projection.resolver_audit.focus_resolution_evidence
        ?.selected_candidate_source_kind,
      "recovered_memory",
      "an admitted recollection may become focus only through the normal attention resolver",
    );
  }

  const clearRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `clear_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "phase62c_v4_clear_fixture",
      formal: true,
    }),
  });
  const clearTurnOne = await clearRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "clear-lineage",
    turn_id: "clear-turn-1",
    character: "Alpha",
    simulation_time: "2026-09-01T12:07:00+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: "推門",
    compatibility_state: { goals: ["推門"] },
  });
  const clearTurnOneEnvelope = projectWorldSimulationCharacterCurrentMindTransitions({
    prepared_turn: {
      turn_id: "clear-turn-1",
      decision_packets: [{
        character: "Alpha",
        current_mind_transition_projection: clearTurnOne.projection,
      }],
    },
  });
  await clearRuntimeManager.deliverCommittedCurrentMindProjection({
    world_simulation_session_id: "clear-lineage",
    history_entry: {
      turn_id: "clear-turn-1",
      revision_from: 0,
      revision_to: 1,
      committed_character_current_mind_projection: clearTurnOneEnvelope,
    },
  });
  const clearTurnTwo = await clearRuntimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "clear-lineage",
    turn_id: "clear-turn-2",
    character: "Alpha",
    simulation_time: "2026-09-01T12:07:30+08:00",
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: "離開房間",
    compatibility_state: { goals: ["離開房間"] },
  });
  assert.equal(
    clearTurnTwo.projection.admission_decisions.some(
      (decision) => decision.source_kind === "current_action"
        && decision.gate_outcome === "clear"
        && decision.reason_codes.includes("superseded_current_action"),
    ),
    true,
    "a prior current-action representation must clear when explicitly superseded",
  );
  assert.equal(JSON.stringify(clearTurnTwo.working_context).includes("推門"), false);
  assert.equal(JSON.stringify(clearTurnTwo.working_context).includes("離開房間"), true);
  assert.equal(
    clearTurnTwo.projection.boundaries.current_mind_clear_does_not_mutate_source_memory,
    true,
  );

  let releaseAlphaDuringAttention;
  const alphaAttentionGate = new Promise((resolve) => {
    releaseAlphaDuringAttention = resolve;
  });
  const blockingAlphaForAttention = runtimeManager.runCharacterTurn({
    world_simulation_session_id: "lineage-a",
    character: "Alpha",
    brain_input: {
      character: "Alpha",
      candidate_action_intents: [{ action_id: "alpha-attention-block", intent: "wait" }],
    },
    characterBrain: async () => {
      await alphaAttentionGate;
      return { action_id: "alpha-attention-block" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  let alphaQueuedAttentionResolved = false;
  const alphaQueuedAttention = runtimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "lineage-a",
    turn_id: "alpha-attention-queued",
    character: "Alpha",
    simulation_time: "2026-09-01T12:10:00+08:00",
    perception: { observed: ["Alpha cue"], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: null,
    compatibility_state: { goals: ["Alpha cue"] },
  }).then((value) => {
    alphaQueuedAttentionResolved = true;
    return value;
  });
  const betaIndependentAttention = await runtimeManager.prepareSpeculativeCurrentMind({
    world_simulation_session_id: "lineage-a",
    turn_id: "beta-attention-independent",
    character: "Beta",
    simulation_time: "2026-09-01T12:10:00+08:00",
    perception: { observed: ["Beta cue"], audible: [], other_senses: [] },
    recovered_memories: [],
    current_action: null,
    compatibility_state: { goals: ["Beta cue"] },
  });
  assert.equal(
    betaIndependentAttention.projection.focus_transition.to.content,
    "Beta cue",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    alphaQueuedAttentionResolved,
    false,
    "same-character Current Mind cycle must serialize behind that Runtime's active turn",
  );
  releaseAlphaDuringAttention();
  await blockingAlphaForAttention;
  const alphaQueuedAttentionResult = await alphaQueuedAttention;
  assert.equal(alphaQueuedAttentionResult.projection.focus_transition.to.content, "Alpha cue");

  const experienceRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: identityByCharacter.get(character),
      canonical_name: character === "AlphaAlias" ? "Alpha" : character,
      identity_source: "phase62c_experience_test_identity_resolver",
      formal: true,
    }),
  });
  const syntheticCommittedHistoryEntry = {
    turn_id: syntheticExperienceProjection.turn_id,
    revision_from: 0,
    revision_to: 1,
    committed_character_experience_projection: syntheticExperienceProjection,
  };
  const firstExperienceDelivery = await experienceRuntimeManager
    .deliverCommittedExperienceProjection({
      world_simulation_session_id: "experience-lineage",
      history_entry: syntheticCommittedHistoryEntry,
    });
  assert.equal(firstExperienceDelivery.delivery_count, 2);
  assert.equal(firstExperienceDelivery.consumed_count, 2);
  assert.equal(firstExperienceDelivery.duplicate_count, 0);
  assert.notEqual(
    firstExperienceDelivery.deliveries[0].receipt.receipt_id,
    firstExperienceDelivery.deliveries[1].receipt.receipt_id,
  );
  const firstAlphaReceiptId = firstExperienceDelivery.deliveries[0].receipt.receipt_id;
  const firstBetaReceiptId = firstExperienceDelivery.deliveries[1].receipt.receipt_id;
  const duplicateExperienceDelivery = await experienceRuntimeManager
    .deliverCommittedExperienceProjection({
      world_simulation_session_id: "experience-lineage",
      history_entry: syntheticCommittedHistoryEntry,
    });
  assert.equal(duplicateExperienceDelivery.consumed_count, 0);
  assert.equal(duplicateExperienceDelivery.duplicate_count, 2);
  assert.equal(duplicateExperienceDelivery.deliveries[0].receipt.receipt_id, firstAlphaReceiptId);
  assert.equal(duplicateExperienceDelivery.deliveries[1].receipt.receipt_id, firstBetaReceiptId);
  const alphaExperienceAfterDuplicate = await experienceRuntimeManager.inspectRuntime({
    world_simulation_session_id: "experience-lineage",
    character: "Alpha",
  });
  assert.equal(
    alphaExperienceAfterDuplicate.committed_experience.committed_experience_effect_count,
    1,
  );
  assert.equal(alphaExperienceAfterDuplicate.committed_experience.duplicate_delivery_attempts, 1);
  assert.equal(alphaExperienceAfterDuplicate.durable_mind_mutation_count, 0);

  const secondExperienceProjection = projectWorldSimulationCharacterExperienceEvidence({
    runtime_identities: syntheticRuntimeIdentitiesForSequence(2),
    prepared_turn: {
      turn_id: "synthetic-experience-turn-2",
      decision_packets: [
        {
          character: "Alpha",
          perception: {
            observed: [{ perceptual_label: "Alpha 看見第二個 committed 變化" }],
            audible: [],
            other_senses: [],
          },
        },
        {
          character: "Beta",
          perception: {
            observed: [{ perceptual_label: "Beta 看見第二個 committed 變化" }],
            audible: [],
            other_senses: [],
          },
        },
      ],
    },
    selected_action_intents: [
      {
        character: "Alpha",
        selection: "candidate_action_intent",
        action_id: "alpha-a",
        intent: "wait",
      },
      {
        character: "Beta",
        selection: "candidate_action_intent",
        action_id: "beta-a",
        intent: "move",
      },
    ],
    action_outcomes: [
      { actor: "Alpha", result: "waited" },
      { actor: "Beta", result: "moved" },
    ],
  });
  const secondCommittedHistoryEntry = {
    turn_id: secondExperienceProjection.turn_id,
    revision_from: 1,
    revision_to: 2,
    committed_character_experience_projection: secondExperienceProjection,
  };
  let releaseExperienceAlphaTurn;
  const experienceAlphaTurnGate = new Promise((resolve) => {
    releaseExperienceAlphaTurn = resolve;
  });
  const blockingExperienceAlphaTurn = experienceRuntimeManager.runCharacterTurn({
    world_simulation_session_id: "experience-lineage",
    character: "Alpha",
    brain_input: {
      character: "Alpha",
      candidate_action_intents: [{ action_id: "alpha-a", intent: "wait" }],
    },
    characterBrain: async () => {
      await experienceAlphaTurnGate;
      return { action_id: "alpha-a" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  let alphaExperienceDeliveryResolved = false;
  const alphaExperienceDelivery = experienceRuntimeManager.deliverCommittedExperience({
    world_simulation_session_id: "experience-lineage",
    history_entry: secondCommittedHistoryEntry,
    projection_envelope: secondExperienceProjection,
    character_projection: secondExperienceProjection.character_projections[0],
  }).then((value) => {
    alphaExperienceDeliveryResolved = true;
    return value;
  });
  const betaExperienceDelivery = await experienceRuntimeManager.deliverCommittedExperience({
    world_simulation_session_id: "experience-lineage",
    history_entry: secondCommittedHistoryEntry,
    projection_envelope: secondExperienceProjection,
    character_projection: secondExperienceProjection.character_projections[1],
  });
  assert.equal(betaExperienceDelivery.consumed, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    alphaExperienceDeliveryResolved,
    false,
    "Beta experience delivery must not wait on Alpha Runtime's queue",
  );
  releaseExperienceAlphaTurn();
  await blockingExperienceAlphaTurn;
  const alphaExperienceDeliveryResult = await alphaExperienceDelivery;
  assert.equal(alphaExperienceDeliveryResult.consumed, true);

  const fourthExperienceProjection = projectWorldSimulationCharacterExperienceEvidence({
    runtime_identities: syntheticRuntimeIdentitiesForSequence(4),
    prepared_turn: {
      turn_id: "synthetic-experience-turn-4",
      decision_packets: [{ character: "Alpha", perception: { observed: [], audible: [], other_senses: [] } }],
    },
    selected_action_intents: [{
      character: "Alpha",
      selection: "candidate_action_intent",
      action_id: "alpha-a",
      intent: "wait",
    }],
    action_outcomes: [{ actor: "Alpha", result: "waited_again" }],
  });
  await assert.rejects(
    () => experienceRuntimeManager.deliverCommittedExperience({
      world_simulation_session_id: "experience-lineage",
      history_entry: {
        turn_id: fourthExperienceProjection.turn_id,
        revision_from: 3,
        revision_to: 4,
        committed_character_experience_projection: fourthExperienceProjection,
      },
      projection_envelope: fourthExperienceProjection,
      character_projection: fourthExperienceProjection.character_projections[0],
    }),
    (error) => error?.code === "WORLD_SIMULATION_CHARACTER_EXPERIENCE_OUT_OF_ORDER",
  );
  const thirdExperienceProjection = projectWorldSimulationCharacterExperienceEvidence({
    runtime_identities: syntheticRuntimeIdentitiesForSequence(3),
    prepared_turn: {
      turn_id: "synthetic-experience-turn-3",
      decision_packets: [{ character: "Alpha", perception: { observed: [], audible: [], other_senses: [] } }],
    },
    selected_action_intents: [{
      character: "Alpha",
      selection: "candidate_action_intent",
      action_id: "alpha-a",
      intent: "wait",
    }],
    action_outcomes: [{ actor: "Alpha", result: "late_revision_three" }],
  });
  const thirdExperienceDelivery = await experienceRuntimeManager.deliverCommittedExperience({
    world_simulation_session_id: "experience-lineage",
    history_entry: {
      turn_id: thirdExperienceProjection.turn_id,
      revision_from: 2,
      revision_to: 3,
      committed_character_experience_projection: thirdExperienceProjection,
    },
    projection_envelope: thirdExperienceProjection,
    character_projection: thirdExperienceProjection.character_projections[0],
  });
  assert.equal(thirdExperienceDelivery.consumed, true);
  assert.equal(thirdExperienceDelivery.experience_sequence, 3);
  const fourthExperienceDelivery = await experienceRuntimeManager.deliverCommittedExperience({
    world_simulation_session_id: "experience-lineage",
    history_entry: {
      turn_id: fourthExperienceProjection.turn_id,
      revision_from: 3,
      revision_to: 4,
      committed_character_experience_projection: fourthExperienceProjection,
    },
    projection_envelope: fourthExperienceProjection,
    character_projection: fourthExperienceProjection.character_projections[0],
  });
  assert.equal(fourthExperienceDelivery.consumed, true);
  assert.equal(fourthExperienceDelivery.experience_sequence, 4);
  const alphaExperienceAfterOrdering = await experienceRuntimeManager.inspectRuntime({
    world_simulation_session_id: "experience-lineage",
    character: "Alpha",
  });
  assert.equal(alphaExperienceAfterOrdering.committed_experience.last_experience_sequence, 4);
  assert.equal(alphaExperienceAfterOrdering.committed_experience.last_committed_revision, 4);
  assert.equal(
    alphaExperienceAfterOrdering.committed_experience.committed_experience_effect_count,
    4,
  );

  const supportedExperienceRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: "character_alpha_supported_experience",
      canonical_name: character,
      identity_source: "phase62c_supported_experience_identity_resolver",
      formal: true,
    }),
  });
  const supportedExperienceProjection = projectWorldSimulationCharacterExperienceEvidence({
    runtime_identities: [{
      character: "Alpha",
      world_lineage: "experience-gating-lineage",
      character_entity_id: "character_alpha_supported_experience",
      canonical_name: "Alpha",
      identity_source: "phase62c_supported_experience_identity_resolver",
      formal_identity: true,
      experience_sequence: 1,
    }],
    prepared_turn: {
      turn_id: "supported-experience-turn-1",
      decision_packets: [{
        character: "Alpha",
        perception: {
          observed: [{
            perceptual_label: "剛才確認的出口仍與目前目標相關",
            goal_relevance: "high",
          }],
          audible: [],
          other_senses: [],
        },
      }],
    },
    selected_action_intents: [{
      character: "Alpha",
      selection: "reject_all",
      action_id: null,
      intent: null,
    }],
    action_outcomes: [],
  });
  const supportedExperienceDelivery = await supportedExperienceRuntimeManager
    .deliverCommittedExperienceProjection({
      world_simulation_session_id: "experience-gating-lineage",
      history_entry: {
        turn_id: supportedExperienceProjection.turn_id,
        revision_from: 0,
        revision_to: 1,
        committed_character_experience_projection: supportedExperienceProjection,
      },
    });
  assert.equal(supportedExperienceDelivery.consumed_count, 1);
  const supportedExperienceMind = await supportedExperienceRuntimeManager
    .prepareSpeculativeCurrentMind({
      world_simulation_session_id: "experience-gating-lineage",
      turn_id: "supported-experience-attention-2",
      character: "Alpha",
      simulation_time: "2026-09-01T13:00:00+08:00",
      perception: { observed: [], audible: [], other_senses: [] },
      recovered_memories: [],
      current_action: null,
      compatibility_state: {},
    });
  assert.equal(
    supportedExperienceMind.projection.reducer_state_after.last_experience_sequence_integrated,
    1,
  );
  const supportedExperienceAdmission = supportedExperienceMind.projection.admission_decisions.find(
    (decision) => decision.source_kind === "committed_experience",
  );
  assert.ok(supportedExperienceAdmission);
  assert.equal(supportedExperienceAdmission.gate_outcome, "admit");
  assert.equal(
    supportedExperienceAdmission.reason_codes.includes("goal_or_intention_support"),
    true,
  );
  const supportedExperienceWorkingItems = [
    supportedExperienceMind.working_context.focus,
    ...supportedExperienceMind.working_context.active_context,
    ...supportedExperienceMind.working_context.peripheral_context,
    ...supportedExperienceMind.working_context.fading_context,
    ...supportedExperienceMind.working_context.suspended_context,
  ].filter(Boolean);
  assert.equal(
    supportedExperienceWorkingItems.some((item) => (
      item.context_origin === "committed_experience"
      && item.content?.perceptual_label === "剛才確認的出口仍與目前目標相關"
    )),
    true,
    "goal-supported committed Experience must be eligible for actual N+1 Current Mind admission",
  );
  assert.equal(
    JSON.stringify(supportedExperienceMind.working_context).includes("goal_relevance"),
    false,
    "admission evidence must remain private after committed Experience enters working context",
  );

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62C main-loop fixture",
    seed: "phase62c",
    rules: {
      event_driven: true,
      persistent_causality: true,
    },
    initial_world_state: initialWorldState,
    initial_world_state_summary: {
      current_event: "evt-001",
      named_characters: 2,
    },
  }, options);

  assert.equal(session.world_state_initialized, true);
  assert.equal(session.world_state_revision, 0);
  assert.equal(session.world_state_hash, initialStateHash);
  assert.equal(hashAgentRunValue(initialWorldState), initialStateHash);

  const brainInputs = [];
  const adjudicatorInputs = [];
  const integrationRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: character === "伊萊亞斯・諾爾"
        ? "character_elias_runtime_fixture"
        : "character_yoru_runtime_fixture",
      canonical_name: character,
      identity_source: "phase62c_integration_identity_resolver",
      formal: true,
    }),
  });
  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-001",
    },
    {
      ...options,
      characterRuntimeManager: integrationRuntimeManager,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        assert.equal(Object.hasOwn(packet, "world_state"), false);
        assert.equal(Object.hasOwn(packet, "scene_analysis"), false);
        assert.equal(Object.hasOwn(packet, "runtime_id"), false);
        assert.equal(Object.hasOwn(packet, "world_lineage"), false);
        assert.equal(Object.hasOwn(packet, "character_entity_id"), false);
        assert.equal(Object.hasOwn(packet, "world_simulation_session_id"), false);
        assert.equal(Object.hasOwn(packet, "turn_id"), false);
        const serializedBrainPacket = JSON.stringify(packet);
        assert.equal(
          serializedBrainPacket.includes("evaluator_private_note"),
          false,
          "Private scene fields must not reach the character brain.",
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterExperienceContractVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterExperienceProjectionVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterCurrentMindContractVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterAttentionReducerVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterCurrentMindProjectionVersion),
          false,
        );
        assert.equal(serializedBrainPacket.includes("projection_hash"), false);
        assert.equal(serializedBrainPacket.includes("transition_hash"), false);
        assert.equal(serializedBrainPacket.includes("attention_bids"), false);
        assert.equal(serializedBrainPacket.includes("priority_evidence"), false);
        assert.equal(serializedBrainPacket.includes("internal_priority_strength"), false);
        assert.equal(serializedBrainPacket.includes("attention_encoding_evidence"), false);
        assert.equal(serializedBrainPacket.includes("current_mind_transition_projection"), false);
        assert.equal(serializedBrainPacket.includes("receipt_id"), false);
        assert.ok(packet.cognition.attention);
        assert.ok(packet.cognition.working_context);
        const characterFacingAttentionText = JSON.stringify(packet.cognition.attention);
        for (const forbiddenAttentionMetadata of [
          "source_kind",
          "salience",
          "perceptual_salience",
          "goal_relevance",
          "urgency",
          "expectation_violation",
          "awareness_boundary",
        ]) {
          assert.equal(
            characterFacingAttentionText.includes(forbiddenAttentionMetadata),
            false,
            `Character Brain must not receive Runtime attention metadata ${forbiddenAttentionMetadata}`,
          );
        }
        assert.equal(packet.boundaries.may_decide_outcome, false);
        return packet.character === "伊萊亞斯・諾爾"
          ? {
              action_id: "elias-step-line",
              next_world_state: { forbidden_character_authored_state: true },
              outcome: "forbidden_character_authored_success",
            }
          : { action_id: "yoru-watch" };
      },
      causalAdjudicator: async (input) => {
        adjudicatorInputs.push(input);
        assert.equal(input.world_state.event_queue[0].event_id, "evt-001");
        assert.equal(input.selected_action_intents.length, 2);
        assert.equal(
          Object.hasOwn(input.selected_action_intents[0], "next_world_state"),
          false,
        );
        assert.equal(Object.hasOwn(input.selected_action_intents[0], "outcome"), false);
        const next = structuredClone(input.world_state);
        next.simulation_time = "2026-08-24T08:10:02+08:00";
        next.scenes["training-room-a"].entity_positions["伊萊亞斯・諾爾"] = {
          x: 2,
          y: 5,
        };
        next.event_queue = [
          {
            event_id: "evt-002",
            type: "post_move_pause",
            scene_id: "training-room-a",
            participants: ["伊萊亞斯・諾爾"],
            summary: "移動後短暫停頓",
          },
        ];
        next.available_actions["伊萊亞斯・諾爾"] = [
          { action_id: "elias-wait", intent: "停在白線上等待" },
        ];
        return {
          causal_resolution_id: "resolve-evt-001",
          next_world_state: next,
          state_transitions: [
            {
              entity: "伊萊亞斯・諾爾",
              field: "position",
              from: { x: 2, y: 4 },
              to: { x: 2, y: 5 },
              cause: "elias-step-line resolved by movement rules",
            },
            {
              entity: "world",
              field: "simulation_time",
              from: "2026-08-24T08:10:00+08:00",
              to: "2026-08-24T08:10:02+08:00",
              cause: "movement duration elapsed",
            },
          ],
          action_outcomes: [
            {
              actor: "伊萊亞斯・諾爾",
              action: "走到前方白線",
              result: "movement_completed",
              causal_evidence: "path clear and destination reachable",
              character_experience: {
                performed: true,
                perceived_result: "movement_completed",
              },
            },
            {
              actor: "夜",
              action: "留在原地觀察",
              result: "continued_observation",
              causal_evidence: "no movement requested",
              character_experience: {
                performed: true,
                perceived_result: "continued_observation",
              },
            },
          ],
          knowledge_transitions: [],
          scheduled_events: ["evt-002"],
        };
      },
    },
  );

  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.equal(firstTurn.revision, 1);
  assert.equal(firstTurn.selected_action_intents.length, 2);
  assert.equal(
    Object.hasOwn(firstTurn.selected_action_intents[0], "next_world_state"),
    false,
  );
  assert.equal(Object.hasOwn(firstTurn.selected_action_intents[0], "outcome"), false);
  assert.equal(firstTurn.consistency.hard_conflict_count, 0);
  assert.equal(firstTurn.trace_ids.length, 10);
  assert.equal(brainInputs.length, 2);
  assert.equal(adjudicatorInputs.length, 1);
  assert.equal(
    firstTurn.committed_character_experience.experience_contract_version,
    worldSimulationCharacterExperienceContractVersion,
  );
  assert.equal(
    firstTurn.committed_character_experience.projection_version,
    worldSimulationCharacterExperienceProjectionVersion,
  );
  assert.equal(firstTurn.committed_character_experience.receipt_count, 2);
  assert.equal(firstTurn.committed_character_experience.delivered_count, 2);
  assert.equal(firstTurn.committed_character_experience.duplicate_delivery_count, 0);
  assert.equal(firstTurn.committed_character_experience.delivery_failed, false);
  assert.equal(firstTurn.committed_character_experience.replay_required, false);
  assert.equal(firstTurn.committed_character_experience.established_after_world_commit, true);
  assert.equal(firstTurn.committed_character_experience.durable_mind_mutation_count, 0);
  assert.equal(
    firstTurn.committed_character_current_mind.current_mind_contract_version,
    worldSimulationCharacterCurrentMindContractVersion,
  );
  assert.equal(
    firstTurn.committed_character_current_mind.attention_reducer_version,
    worldSimulationCharacterAttentionReducerVersion,
  );
  assert.equal(
    firstTurn.committed_character_current_mind.projection_version,
    worldSimulationCharacterCurrentMindProjectionVersion,
  );
  assert.equal(firstTurn.committed_character_current_mind.transition_count, 2);
  assert.equal(firstTurn.committed_character_current_mind.delivered_count, 2);
  assert.equal(firstTurn.committed_character_current_mind.duplicate_delivery_count, 0);
  assert.equal(firstTurn.committed_character_current_mind.delivery_failed, false);
  assert.equal(firstTurn.committed_character_current_mind.replay_required, false);
  assert.equal(firstTurn.committed_character_current_mind.established_after_world_commit, true);
  assert.equal(firstTurn.committed_character_current_mind.persistent_mind_learning_installed, false);
  assert.equal(firstTurn.committed_character_current_mind.durable_mind_mutation_count, 0);

  const eliasRuntimeAfterCommit = await integrationRuntimeManager.inspectRuntime({
    world_simulation_session_id: session.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  const yoruRuntimeAfterCommit = await integrationRuntimeManager.inspectRuntime({
    world_simulation_session_id: session.world_simulation_session_id,
    character: "夜",
  });
  assert.notEqual(eliasRuntimeAfterCommit.runtime_id, yoruRuntimeAfterCommit.runtime_id);
  assert.equal(eliasRuntimeAfterCommit.lifecycle.turns_completed, 1);
  assert.equal(yoruRuntimeAfterCommit.lifecycle.turns_completed, 1);
  assert.equal(
    eliasRuntimeAfterCommit.committed_experience.committed_experience_effect_count,
    1,
  );
  assert.equal(
    yoruRuntimeAfterCommit.committed_experience.committed_experience_effect_count,
    1,
  );
  assert.equal(eliasRuntimeAfterCommit.committed_experience.last_committed_revision, 1);
  assert.equal(yoruRuntimeAfterCommit.committed_experience.last_committed_revision, 1);
  assert.equal(eliasRuntimeAfterCommit.committed_experience.last_experience_sequence, 1);
  assert.equal(yoruRuntimeAfterCommit.committed_experience.last_experience_sequence, 1);
  assert.equal(eliasRuntimeAfterCommit.current_mind.owner, "character_runtime");
  assert.equal(yoruRuntimeAfterCommit.current_mind.owner, "character_runtime");
  assert.equal(eliasRuntimeAfterCommit.current_mind.committed_sequence, 1);
  assert.equal(yoruRuntimeAfterCommit.current_mind.committed_sequence, 1);
  assert.equal(eliasRuntimeAfterCommit.current_mind.committed_transition_effect_count, 1);
  assert.equal(yoruRuntimeAfterCommit.current_mind.committed_transition_effect_count, 1);
  assert.equal(eliasRuntimeAfterCommit.current_mind.last_committed_revision, 1);
  assert.equal(yoruRuntimeAfterCommit.current_mind.last_committed_revision, 1);
  assert.equal(
    eliasRuntimeAfterCommit.current_mind.reducer_state.last_experience_sequence_integrated,
    0,
    "Experience Receipt N must not retroactively alter Attention/Current Mind transition N",
  );
  assert.equal(eliasRuntimeAfterCommit.committed_experience.recent_receipts.length, 1);
  assert.equal(yoruRuntimeAfterCommit.committed_experience.recent_receipts.length, 1);
  const eliasCommittedReceipt = eliasRuntimeAfterCommit.committed_experience.recent_receipts[0];
  const yoruCommittedReceipt = yoruRuntimeAfterCommit.committed_experience.recent_receipts[0];
  assert.notEqual(eliasCommittedReceipt.receipt_id, yoruCommittedReceipt.receipt_id);
  assert.equal(
    eliasCommittedReceipt.experience_contract_version,
    worldSimulationCharacterExperienceContractVersion,
  );
  assert.equal(
    eliasCommittedReceipt.projection_version,
    worldSimulationCharacterExperienceProjectionVersion,
  );
  assert.equal(eliasCommittedReceipt.committed_revision, 1);
  assert.equal(eliasCommittedReceipt.experience_sequence, 1);
  assert.equal(
    eliasCommittedReceipt.world_lineage,
    session.world_simulation_session_id,
  );
  assert.equal(eliasCommittedReceipt.character_entity_id, "character_elias_runtime_fixture");
  assert.equal(eliasCommittedReceipt.experience.roles.participant, true);
  assert.equal(
    eliasCommittedReceipt.experience.participation.selected_intent.intent,
    "走到前方白線",
  );
  assert.equal(
    eliasCommittedReceipt.experience.participation.experienced_action_outcomes[0].perceived_result,
    "movement_completed",
  );
  assert.equal(
    eliasCommittedReceipt.experience.participation.selected_intent_is_not_outcome,
    true,
  );
  const liveReceiptText = JSON.stringify([eliasCommittedReceipt, yoruCommittedReceipt]);
  assert.equal(liveReceiptText.includes("causal_evidence"), false);
  assert.equal(liveReceiptText.includes("evaluator_private_note"), false);
  assert.equal(Object.hasOwn(eliasCommittedReceipt, "world_state"), false);
  assert.equal(Object.hasOwn(eliasCommittedReceipt.experience, "world_state"), false);
  assert.equal(eliasRuntimeAfterCommit.durable_mind_persistence, false);
  assert.equal(eliasRuntimeAfterCommit.durable_mind_mutation_count, 0);
  assert.equal(yoruRuntimeAfterCommit.durable_mind_mutation_count, 0);

  const stateAfterFirstTurn = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(stateAfterFirstTurn.revision, 1);
  assert.equal(stateAfterFirstTurn.state.event_queue[0].event_id, "evt-002");
  assert.deepEqual(
    stateAfterFirstTurn.state.scenes["training-room-a"]
      .entity_positions["伊萊亞斯・諾爾"],
    { x: 2, y: 5 },
  );
  assert.notEqual(stateAfterFirstTurn.state_hash, initialStateHash);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].causal_resolution_id, "resolve-evt-001");
  assert.equal(history.turns[0].previous_state_hash, initialStateHash);
  assert.equal(history.turns[0].next_state_hash, stateAfterFirstTurn.state_hash);
  const persistedCurrentMindProjection =
    history.turns[0].committed_character_current_mind_projection;
  assert.equal(
    persistedCurrentMindProjection.current_mind_contract_version,
    worldSimulationCharacterCurrentMindContractVersion,
  );
  assert.equal(
    persistedCurrentMindProjection.attention_reducer_version,
    worldSimulationCharacterAttentionReducerVersion,
  );
  assert.equal(
    persistedCurrentMindProjection.projection_version,
    worldSimulationCharacterCurrentMindProjectionVersion,
  );
  assert.equal(persistedCurrentMindProjection.character_projections.length, 2);
  assert.equal(
    persistedCurrentMindProjection.projection_hash,
    firstTurn.committed_character_current_mind.projection_hash,
  );
  assert.equal(
    persistedCurrentMindProjection.character_projections[0]
      .reducer_state_after.last_experience_sequence_integrated,
    0,
  );
  assert.equal(
    persistedCurrentMindProjection.character_projections[0].source_refs.some(
      (ref) => ref.kind === "committed_experience"
        || ref.kind === "committed_action_experience",
    ),
    false,
    "Experience Receipt N must not become a source of Current Mind transition N",
  );
  const persistedCurrentMindText = JSON.stringify(persistedCurrentMindProjection);
  assert.equal(persistedCurrentMindText.includes("evaluator_private_note"), false);
  assert.equal(persistedCurrentMindText.includes("causal_chain"), false);
  assert.equal(persistedCurrentMindText.includes("gpt_hidden_reasoning"), true);
  assert.equal(
    persistedCurrentMindProjection.boundaries.gpt_hidden_reasoning_stored_here,
    false,
  );
  assert.equal(
    persistedCurrentMindProjection.boundaries.replay_runs_current_attention_algorithm,
    false,
  );
  const persistedExperienceProjection =
    history.turns[0].committed_character_experience_projection;
  assert.equal(
    persistedExperienceProjection.experience_contract_version,
    worldSimulationCharacterExperienceContractVersion,
  );
  assert.equal(
    persistedExperienceProjection.projection_version,
    worldSimulationCharacterExperienceProjectionVersion,
  );
  assert.equal(persistedExperienceProjection.character_projections.length, 2);
  assert.equal(persistedExperienceProjection.character_projections[0].experience_sequence, 1);
  assert.equal(persistedExperienceProjection.character_projections[1].experience_sequence, 1);
  assert.equal(
    persistedExperienceProjection.character_projections[0].world_lineage,
    session.world_simulation_session_id,
  );
  assert.equal(
    persistedExperienceProjection.character_projections[0].character_entity_id,
    "character_elias_runtime_fixture",
  );
  assert.equal(
    persistedExperienceProjection.projection_hash,
    firstTurn.committed_character_experience.projection_hash,
  );
  const persistedExperienceText = JSON.stringify(persistedExperienceProjection);
  assert.equal(persistedExperienceText.includes("causal_evidence"), false);
  assert.equal(persistedExperienceText.includes("evaluator_private_note"), false);
  assert.equal(
    Object.hasOwn(
      persistedExperienceProjection.character_projections[0].experience,
      "world_state",
    ),
    false,
  );

  const duplicateCurrentMindDelivery = await integrationRuntimeManager
    .deliverCommittedCurrentMindProjection({
      world_simulation_session_id: session.world_simulation_session_id,
      history_entry: history.turns[0],
    }, options);
  assert.equal(duplicateCurrentMindDelivery.delivery_count, 2);
  assert.equal(duplicateCurrentMindDelivery.consumed_count, 0);
  assert.equal(duplicateCurrentMindDelivery.duplicate_count, 2);

  const duplicateCommittedDelivery = await integrationRuntimeManager
    .deliverCommittedExperienceProjection({
      world_simulation_session_id: session.world_simulation_session_id,
      history_entry: history.turns[0],
    }, options);
  assert.equal(duplicateCommittedDelivery.delivery_count, 2);
  assert.equal(duplicateCommittedDelivery.consumed_count, 0);
  assert.equal(duplicateCommittedDelivery.duplicate_count, 2);
  const eliasRuntimeAfterDuplicateCommitDelivery =
    await integrationRuntimeManager.inspectRuntime({
      world_simulation_session_id: session.world_simulation_session_id,
      character: "伊萊亞斯・諾爾",
    });
  assert.equal(
    eliasRuntimeAfterDuplicateCommitDelivery
      .committed_experience
      .committed_experience_effect_count,
    1,
  );
  assert.equal(
    eliasRuntimeAfterDuplicateCommitDelivery
      .committed_experience
      .duplicate_delivery_attempts,
    1,
  );

  const replayRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async () => {
      throw new Error(
        "historical replay must not re-resolve committed character identity",
      );
    },
  });
  const historicalReplay = await replayWorldSimulationCommittedCharacterExperiences(
    session.world_simulation_session_id,
    {
      ...options,
      characterRuntimeManager: replayRuntimeManager,
    },
  );
  assert.equal(historicalReplay.replay_source, "immutable_committed_world_history");
  assert.equal(historicalReplay.current_perception_engine_reanalysis_used, false);
  assert.equal(historicalReplay.current_attention_algorithm_reanalysis_used, false);
  assert.equal(historicalReplay.phase63c_memory_retrieval_reexecution_used, false);
  assert.equal(historicalReplay.character_brain_reexecution_used, false);
  assert.equal(historicalReplay.historical_projection_semantics_preserved, true);
  assert.equal(historicalReplay.committed_turns_with_projection, 1);
  assert.equal(historicalReplay.committed_turns_with_current_mind_projection, 1);
  assert.equal(historicalReplay.current_mind_delivery_count, 2);
  assert.equal(historicalReplay.current_mind_consumed_count, 2);
  assert.equal(historicalReplay.current_mind_failed_count, 0);
  assert.equal(historicalReplay.delivery_count, 2);
  assert.equal(historicalReplay.consumed_count, 2);
  assert.equal(historicalReplay.duplicate_count, 0);
  assert.equal(historicalReplay.failed_count, 0);
  assert.equal(historicalReplay.replay_required, false);
  const replayedEliasDelivery = historicalReplay.replays[0].deliveries.find(
    (item) => item.character_entity_id === "character_elias_runtime_fixture",
  );
  assert.ok(replayedEliasDelivery);
  assert.equal(
    replayedEliasDelivery.receipt.receipt_id,
    eliasCommittedReceipt.receipt_id,
  );
  assert.deepEqual(
    replayedEliasDelivery.receipt.experience,
    eliasCommittedReceipt.experience,
  );
  assert.equal(replayedEliasDelivery.receipt.experience_sequence, 1);
  assert.equal(
    replayedEliasDelivery.receipt.world_lineage,
    session.world_simulation_session_id,
  );
  assert.equal(
    replayedEliasDelivery.receipt.character_entity_id,
    "character_elias_runtime_fixture",
  );
  assert.equal(replayedEliasDelivery.receipt.boundaries.durable_mind_mutation, false);
  const replayedEliasRuntime = await replayRuntimeManager.inspectRuntime({
    world_simulation_session_id: session.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  }, {
    ...options,
    characterRuntimeWorldLineageResolver: async () => session.world_simulation_session_id,
    characterIdentityRegistryOptions: {
      formalCanonSources: [
        {
          source_file: "data/canon_db/sources/entity_current_mind_replay_fixture.md",
          source_hash: "current-mind-replay-fixture",
          source_modified_at: "2026-09-01T00:00:00.000Z",
          content: [
            "## character｜伊萊亞斯・諾爾｜character_elias_runtime_fixture",
            "",
            "| 欄位 | 正式 Canon |",
            "| --- | --- |",
            "| 中文名 | 伊萊亞斯・諾爾 |",
            "| 性別 | 男 |",
          ].join("\n"),
        },
      ],
    },
  }).catch(() => null);
  assert.equal(
    historicalReplay.replays[0].current_mind_delivery.deliveries.some(
      (item) => item.character_entity_id === "character_elias_runtime_fixture"
        && item.current_mind_sequence === 1,
    ),
    true,
  );
  assert.equal(
    replayedEliasRuntime,
    null,
    "historical replay must not need a fresh identity resolution path to consume stored Current Mind semantics",
  );

  let invalidSelectionAdjudicatorCalled = false;
  const preparedSecondTurn = await prepareWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-002",
  }, {
    ...options,
    characterRuntimeManager: integrationRuntimeManager,
  });
  const preparedSecondEliasPacket = preparedSecondTurn.decision_packets.find(
    (packet) => packet.character === "伊萊亞斯・諾爾",
  );
  const preparedSecondEliasMindProjection =
    preparedSecondTurn.current_mind_transition_projections.find(
      (item) => item.character === "伊萊亞斯・諾爾",
    )?.projection;
  assert.ok(preparedSecondEliasPacket);
  assert.ok(preparedSecondEliasMindProjection);
  assert.equal(
    Object.hasOwn(preparedSecondEliasPacket, "current_mind_transition_projection"),
    false,
    "server-owned Current Mind history projection must stay outside the character decision packet",
  );
  assert.equal(
    Object.hasOwn(preparedSecondEliasPacket, "attention_encoding_evidence"),
    false,
    "programmatic memory-encoding evidence must stay outside the character decision packet",
  );
  assert.equal(
    preparedSecondEliasMindProjection
      .reducer_state_after.last_experience_sequence_integrated,
    1,
    "Experience Receipt N becomes eligible only for the next speculative Current Mind cycle",
  );
  assert.equal(
    preparedSecondEliasMindProjection.source_refs.some(
      (ref) => ref.kind === "committed_experience"
        || ref.kind === "committed_action_experience",
    ),
    true,
  );
  const preparedSecondEliasExperienceAdmissions =
    preparedSecondEliasMindProjection.admission_decisions.filter(
      (decision) => decision.source_kind === "committed_experience"
        || decision.source_kind === "committed_action_experience",
    );
  assert.equal(preparedSecondEliasExperienceAdmissions.length > 0, true);
  assert.equal(
    preparedSecondEliasExperienceAdmissions.every(
      (decision) => decision.gate_outcome === "reject"
        && decision.reason_codes.includes("insufficient_current_mind_support"),
    ),
    true,
    "Receipt N is integrated as an N+1 candidate but unsupported committed Experience is not automatic admission",
  );
  await assert.rejects(
    () => resolveWorldSimulationTurn(
      preparedSecondTurn,
      { "伊萊亞斯・諾爾": { action_id: "teleport-to-roof" } },
      {
        ...options,
        causalAdjudicator: async () => {
          invalidSelectionAdjudicatorCalled = true;
          throw new Error("must not run");
        },
      },
    ),
    (error) => error?.code === "WORLD_SIMULATION_ACTION_NOT_AVAILABLE",
  );
  assert.equal(invalidSelectionAdjudicatorCalled, false);

  const blockedTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-002",
    },
    {
      ...options,
      characterRuntimeManager: integrationRuntimeManager,
      characterBrain: async (packet) => {
        const serializedBrainPacket = JSON.stringify(packet);
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterExperienceContractVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterExperienceProjectionVersion),
          false,
        );
        assert.equal(
          serializedBrainPacket.includes(worldSimulationCharacterCurrentMindProjectionVersion),
          false,
        );
        assert.equal(serializedBrainPacket.includes("projection_hash"), false);
        assert.equal(serializedBrainPacket.includes("transition_hash"), false);
        assert.equal(serializedBrainPacket.includes("attention_bids"), false);
        assert.equal(serializedBrainPacket.includes("receipt_id"), false);
        assert.equal(
          serializedBrainPacket.includes("committed_experience"),
          false,
          "unsupported Receipt N may be integrated as an N+1 candidate without being admitted to working context",
        );
        return { action_id: "elias-wait" };
      },
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.scenes["training-room-a"].entity_positions["伊萊亞斯・諾爾"] = {
          x: 99,
          y: 99,
        };
        return {
          causal_resolution_id: "invalid-teleport",
          next_world_state: next,
          state_transitions: [
            {
              entity: "伊萊亞斯・諾爾",
              field: "position",
              from: { x: 2, y: 5 },
              to: { x: 99, y: 99 },
            },
          ],
          action_outcomes: [],
          knowledge_transitions: [],
        };
      },
    },
  );
  assert.equal(blockedTurn.ok, false);
  assert.equal(blockedTurn.committed, false);
  assert.equal(blockedTurn.causal_resolution_discarded, true);
  assert.equal(blockedTurn.consistency.hard_conflict_count, 1);
  assert.equal(Object.hasOwn(blockedTurn, "committed_character_experience"), false);
  assert.equal(Object.hasOwn(blockedTurn, "committed_character_current_mind"), false);
  const eliasRuntimeAfterBlockedTurn = await integrationRuntimeManager.inspectRuntime({
    world_simulation_session_id: session.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  assert.equal(
    eliasRuntimeAfterBlockedTurn.committed_experience.committed_experience_effect_count,
    1,
    "blocked consistency turns must not create committed experience",
  );
  assert.equal(eliasRuntimeAfterBlockedTurn.committed_experience.last_committed_revision, 1);
  assert.equal(eliasRuntimeAfterBlockedTurn.current_mind.committed_sequence, 1);
  assert.equal(eliasRuntimeAfterBlockedTurn.current_mind.last_committed_revision, 1);
  assert.equal(
    eliasRuntimeAfterBlockedTurn.current_mind.committed_transition_effect_count,
    1,
    "blocked consistency must discard speculative Current Mind",
  );
  assert.equal(
    eliasRuntimeAfterBlockedTurn.current_mind.reducer_state.last_experience_sequence_integrated,
    0,
    "a blocked next-cycle workspace must not advance committed Current Mind",
  );
  assert.equal(eliasRuntimeAfterBlockedTurn.durable_mind_mutation_count, 0);

  const stateAfterBlockedTurn = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(stateAfterBlockedTurn.revision, 1);
  assert.equal(stateAfterBlockedTurn.state_hash, stateAfterFirstTurn.state_hash);

  await assert.rejects(
    () => commitWorldSimulationTurn(
      session.world_simulation_session_id,
      {
        expected_revision: 0,
        expected_state_hash: initialStateHash,
        turn_id: "stale-manual-turn",
        next_world_state: stateAfterBlockedTurn.state,
      },
      options,
    ),
    (error) => error?.code === "WORLD_SIMULATION_STALE_REVISION",
  );

  const eliasRuntimeAfterResolveAndCommitFailures =
    await integrationRuntimeManager.inspectRuntime({
      world_simulation_session_id: session.world_simulation_session_id,
      character: "伊萊亞斯・諾爾",
    });
  assert.equal(eliasRuntimeAfterResolveAndCommitFailures.lifecycle.turns_completed, 2);
  assert.equal(
    eliasRuntimeAfterResolveAndCommitFailures
      .committed_experience
      .committed_experience_effect_count,
    1,
  );
  assert.equal(
    eliasRuntimeAfterResolveAndCommitFailures.committed_experience.last_committed_revision,
    1,
  );
  assert.equal(eliasRuntimeAfterResolveAndCommitFailures.current_mind.committed_sequence, 1);
  assert.equal(
    eliasRuntimeAfterResolveAndCommitFailures.current_mind.committed_transition_effect_count,
    1,
  );
  assert.equal(eliasRuntimeAfterResolveAndCommitFailures.current_mind.last_committed_revision, 1);
  assert.equal(eliasRuntimeAfterResolveAndCommitFailures.durable_mind_persistence, false);
  assert.equal(eliasRuntimeAfterResolveAndCommitFailures.durable_mind_mutation_count, 0);
  const historyAfterBlockedAndStaleCommit = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(historyAfterBlockedAndStaleCommit.turns.length, 1);
  assert.equal(
    historyAfterBlockedAndStaleCommit.turns[0].committed_character_experience_projection.projection_hash,
    persistedExperienceProjection.projection_hash,
  );
  assert.equal(
    historyAfterBlockedAndStaleCommit.turns[0]
      .committed_character_current_mind_projection.projection_hash,
    persistedCurrentMindProjection.projection_hash,
  );

  const staleRaceSession = await beginWorldSimulationSession({
    simulation_label: "Phase62C committed experience stale commit race fixture",
    seed: "phase62c-experience-stale-race",
    rules: {
      event_driven: true,
      persistent_causality: true,
    },
    initial_world_state: initialWorldState,
  }, options);
  const staleRaceRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: character === "伊萊亞斯・諾爾"
        ? "character_elias_stale_race_fixture"
        : "character_yoru_stale_race_fixture",
      canonical_name: character,
      identity_source: "phase62c_stale_race_identity_resolver",
      formal: true,
    }),
  });
  let staleRaceInjected = false;
  await assert.rejects(
    () => runWorldSimulationTurn(
      {
        world_simulation_session_id: staleRaceSession.world_simulation_session_id,
        event_id: "evt-001",
      },
      {
        ...options,
        characterRuntimeManager: staleRaceRuntimeManager,
        characterBrain: async (packet) => ({
          action_id: packet.character === "伊萊亞斯・諾爾"
            ? "elias-wait"
            : "yoru-watch",
        }),
        causalAdjudicator: async (input) => {
          const next = structuredClone(input.world_state);
          next.event_queue = [];
          return {
            causal_resolution_id: "phase62c-experience-stale-race-original",
            next_world_state: next,
            state_transitions: [],
            action_outcomes: [],
            knowledge_transitions: [],
            scheduled_events: [],
          };
        },
        memoryEncodingDecider: async () => {
          if (!staleRaceInjected) {
            staleRaceInjected = true;
            await commitWorldSimulationTurn(
              staleRaceSession.world_simulation_session_id,
              {
                expected_revision: 0,
                expected_state_hash: staleRaceSession.world_state_hash,
                turn_id: "phase62c-experience-stale-race-winner",
                next_world_state: initialWorldState,
              },
              options,
            );
          }
          return [];
        },
      },
    ),
    (error) => error?.code === "WORLD_SIMULATION_STALE_REVISION",
  );
  assert.equal(staleRaceInjected, true);
  const staleRaceEliasRuntime = await staleRaceRuntimeManager.inspectRuntime({
    world_simulation_session_id: staleRaceSession.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  const staleRaceYoruRuntime = await staleRaceRuntimeManager.inspectRuntime({
    world_simulation_session_id: staleRaceSession.world_simulation_session_id,
    character: "夜",
  });
  assert.equal(
    staleRaceEliasRuntime.committed_experience.committed_experience_effect_count,
    0,
    "a turn whose atomic world commit loses a revision race must not deliver experience",
  );
  assert.equal(
    staleRaceYoruRuntime.committed_experience.committed_experience_effect_count,
    0,
  );
  assert.equal(staleRaceEliasRuntime.current_mind.committed_sequence, 0);
  assert.equal(staleRaceYoruRuntime.current_mind.committed_sequence, 0);
  assert.equal(staleRaceEliasRuntime.current_mind.committed_transition_effect_count, 0);
  assert.equal(staleRaceYoruRuntime.current_mind.committed_transition_effect_count, 0);
  assert.equal(staleRaceEliasRuntime.durable_mind_mutation_count, 0);
  assert.equal(staleRaceYoruRuntime.durable_mind_mutation_count, 0);
  const staleRaceHistory = await getWorldSimulationHistory(
    staleRaceSession.world_simulation_session_id,
    options,
  );
  assert.equal(staleRaceHistory.turns.length, 1);
  assert.equal(
    staleRaceHistory.turns[0].committed_character_experience_projection,
    null,
  );
  assert.equal(
    staleRaceHistory.turns[0].committed_character_current_mind_projection,
    null,
  );

  const commitFailureSession = await beginWorldSimulationSession({
    simulation_label: "Phase62C Current Mind atomic commit failure fixture",
    seed: "phase62c-current-mind-commit-failure",
    rules: {
      event_driven: true,
      persistent_causality: true,
    },
    initial_world_state: initialWorldState,
  }, options);
  const commitFailureRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: character === "伊萊亞斯・諾爾"
        ? "character_elias_commit_failure_fixture"
        : "character_yoru_commit_failure_fixture",
      canonical_name: character,
      identity_source: "phase62c_commit_failure_identity_resolver",
      formal: true,
    }),
  });
  process.env.FILE_TRANSACTION_TEST_MODE = "1";
  try {
    await assert.rejects(
      () => runWorldSimulationTurn(
        {
          world_simulation_session_id: commitFailureSession.world_simulation_session_id,
          event_id: "evt-001",
        },
        {
          ...options,
          testFailAfterTransactionCommits: 1,
          characterRuntimeManager: commitFailureRuntimeManager,
          characterBrain: async (packet) => ({
            action_id: packet.character === "伊萊亞斯・諾爾"
              ? "elias-wait"
              : "yoru-watch",
          }),
          causalAdjudicator: async (input) => {
            const next = structuredClone(input.world_state);
            next.event_queue = [];
            return {
              causal_resolution_id: "phase62c-current-mind-commit-failure",
              next_world_state: next,
              state_transitions: [],
              action_outcomes: [],
              knowledge_transitions: [],
              scheduled_events: [],
            };
          },
        },
      ),
      /Injected transaction failure after 1 commit\(s\)\./u,
    );
  } finally {
    delete process.env.FILE_TRANSACTION_TEST_MODE;
  }
  const commitFailureEliasRuntime = await commitFailureRuntimeManager.inspectRuntime({
    world_simulation_session_id: commitFailureSession.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  const commitFailureYoruRuntime = await commitFailureRuntimeManager.inspectRuntime({
    world_simulation_session_id: commitFailureSession.world_simulation_session_id,
    character: "夜",
  });
  for (const runtimeSnapshot of [commitFailureEliasRuntime, commitFailureYoruRuntime]) {
    assert.equal(runtimeSnapshot.current_mind.committed_sequence, 0);
    assert.equal(runtimeSnapshot.current_mind.committed_transition_effect_count, 0);
    assert.equal(runtimeSnapshot.current_mind.last_committed_revision, null);
    assert.equal(runtimeSnapshot.committed_experience.committed_experience_effect_count, 0);
    assert.equal(runtimeSnapshot.committed_experience.last_committed_revision, null);
    assert.equal(runtimeSnapshot.durable_mind_mutation_count, 0);
  }
  const stateAfterInjectedCommitFailure = await getWorldSimulationState(
    commitFailureSession.world_simulation_session_id,
    options,
  );
  assert.equal(stateAfterInjectedCommitFailure.revision, 0);
  assert.equal(stateAfterInjectedCommitFailure.state_hash, commitFailureSession.world_state_hash);
  const historyAfterInjectedCommitFailure = await getWorldSimulationHistory(
    commitFailureSession.world_simulation_session_id,
    options,
  );
  assert.equal(
    historyAfterInjectedCommitFailure.turns.length,
    0,
    "an atomic commit transaction failure must rollback both world history and speculative Current Mind eligibility",
  );

  const deliveryFailureSession = await beginWorldSimulationSession({
    simulation_label: "Phase62C Current Mind post-commit delivery recovery fixture",
    seed: "phase62c-current-mind-delivery-recovery",
    rules: {
      event_driven: true,
      persistent_causality: true,
    },
    initial_world_state: initialWorldState,
  }, options);
  const deliveryFailureBaseManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: character === "伊萊亞斯・諾爾"
        ? "character_elias_delivery_recovery_fixture"
        : "character_yoru_delivery_recovery_fixture",
      canonical_name: character,
      identity_source: "phase62c_delivery_recovery_identity_resolver",
      formal: true,
    }),
  });
  let experienceDeliveryAttemptCount = 0;
  const deliveryFailureRuntimeManager = {
    ...deliveryFailureBaseManager,
    deliverCommittedCurrentMindProjection: async ({ history_entry: historyEntry }) => ({
      projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
      current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
      attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
      projection_hash:
        historyEntry.committed_character_current_mind_projection.projection_hash,
      delivery_count:
        historyEntry.committed_character_current_mind_projection.character_projections.length,
      consumed_count: 0,
      duplicate_count: 0,
      failed_count: 1,
      delivery_failed: true,
      replay_required: true,
      deliveries: [],
      failures: [{
        error_code: "SYNTHETIC_CURRENT_MIND_DELIVERY_FAILURE",
      }],
    }),
    deliverCommittedExperienceProjection: async (...args) => {
      experienceDeliveryAttemptCount += 1;
      return deliveryFailureBaseManager.deliverCommittedExperienceProjection(...args);
    },
  };
  const deliveryFailureTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: deliveryFailureSession.world_simulation_session_id,
      event_id: "evt-001",
    },
    {
      ...options,
      characterRuntimeManager: deliveryFailureRuntimeManager,
      characterBrain: async (packet) => ({
        action_id: packet.character === "伊萊亞斯・諾爾"
          ? "elias-wait"
          : "yoru-watch",
      }),
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.event_queue = [];
        return {
          causal_resolution_id: "phase62c-current-mind-delivery-recovery",
          next_world_state: next,
          state_transitions: [],
          action_outcomes: [],
          knowledge_transitions: [],
          scheduled_events: [],
        };
      },
    },
  );
  assert.equal(deliveryFailureTurn.committed, true);
  assert.equal(deliveryFailureTurn.committed_character_current_mind.delivery_failed, true);
  assert.equal(deliveryFailureTurn.committed_character_current_mind.replay_required, true);
  assert.equal(deliveryFailureTurn.committed_character_current_mind.delivered_count, 0);
  assert.equal(deliveryFailureTurn.committed_character_experience.delivery_deferred, true);
  assert.equal(
    deliveryFailureTurn.committed_character_experience.deferred_reason,
    "current_mind_delivery_requires_replay",
  );
  assert.equal(deliveryFailureTurn.committed_character_experience.delivery_failed, false);
  assert.equal(deliveryFailureTurn.committed_character_experience.replay_required, true);
  assert.equal(deliveryFailureTurn.committed_character_experience.delivered_count, 0);
  assert.equal(
    experienceDeliveryAttemptCount,
    0,
    "Experience delivery must be deferred when committed Current Mind delivery requires replay",
  );
  const deliveryFailureEliasBeforeReplay = await deliveryFailureBaseManager.inspectRuntime({
    world_simulation_session_id: deliveryFailureSession.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  assert.equal(deliveryFailureEliasBeforeReplay.current_mind.committed_sequence, 0);
  assert.equal(
    deliveryFailureEliasBeforeReplay.committed_experience.committed_experience_effect_count,
    0,
  );
  const deliveryFailureHistory = await getWorldSimulationHistory(
    deliveryFailureSession.world_simulation_session_id,
    options,
  );
  assert.equal(deliveryFailureHistory.turns.length, 1);
  assert.ok(deliveryFailureHistory.turns[0].committed_character_current_mind_projection);
  assert.ok(deliveryFailureHistory.turns[0].committed_character_experience_projection);
  let replayExperienceDeliveryAttemptCount = 0;
  const stillFailingReplayManager = {
    ...deliveryFailureBaseManager,
    deliverCommittedCurrentMindProjection: async ({ history_entry: historyEntry }) => ({
      projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
      current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
      attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
      projection_hash:
        historyEntry.committed_character_current_mind_projection.projection_hash,
      delivery_count:
        historyEntry.committed_character_current_mind_projection.character_projections.length,
      consumed_count: 0,
      duplicate_count: 0,
      failed_count: 1,
      delivery_failed: true,
      replay_required: true,
      deliveries: [],
      failures: [{ error_code: "SYNTHETIC_REPLAY_CURRENT_MIND_FAILURE" }],
    }),
    deliverCommittedExperienceProjection: async (...args) => {
      replayExperienceDeliveryAttemptCount += 1;
      return deliveryFailureBaseManager.deliverCommittedExperienceProjection(...args);
    },
  };
  const stillBlockedReplay = await replayWorldSimulationCommittedCharacterExperiences(
    deliveryFailureSession.world_simulation_session_id,
    {
      ...options,
      characterRuntimeManager: stillFailingReplayManager,
    },
  );
  assert.equal(stillBlockedReplay.ok, false);
  assert.equal(stillBlockedReplay.current_mind_failed_count, 1);
  assert.equal(stillBlockedReplay.replays[0].delivery_deferred, true);
  assert.equal(
    stillBlockedReplay.replays[0].deferred_reason,
    "current_mind_replay_still_required",
  );
  assert.equal(
    replayExperienceDeliveryAttemptCount,
    0,
    "historical replay must not deliver Experience while the earlier Current Mind transition still requires replay",
  );
  const recoveredDeliveryReplay = await replayWorldSimulationCommittedCharacterExperiences(
    deliveryFailureSession.world_simulation_session_id,
    {
      ...options,
      characterRuntimeManager: deliveryFailureBaseManager,
    },
  );
  assert.equal(recoveredDeliveryReplay.ok, true);
  assert.equal(recoveredDeliveryReplay.current_mind_consumed_count, 2);
  assert.equal(recoveredDeliveryReplay.consumed_count, 2);
  const deliveryFailureEliasAfterReplay = await deliveryFailureBaseManager.inspectRuntime({
    world_simulation_session_id: deliveryFailureSession.world_simulation_session_id,
    character: "伊萊亞斯・諾爾",
  });
  assert.equal(deliveryFailureEliasAfterReplay.current_mind.committed_sequence, 1);
  assert.equal(
    deliveryFailureEliasAfterReplay.committed_experience.committed_experience_effect_count,
    1,
  );

  console.log(JSON.stringify({
    loop_version: contract.version,
    session_id: session.world_simulation_session_id,
    committed_revision: stateAfterFirstTurn.revision,
    committed_history_turns: history.turns.length,
    successful_turn_trace_count: firstTurn.trace_ids.length,
    blocked_conflicts: blockedTurn.consistency.hard_conflict_count,
    character_brain_world_truth_exposed: false,
  }));
  console.log("Phase62C world simulation main-loop integration test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
