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
  projectWorldSimulationCharacterExperienceEvidence,
  replayWorldSimulationCommittedCharacterExperiences,
  resolveWorldSimulationFormalCharacterIdentity,
  resolveWorldSimulationTurn,
  runWorldSimulationTurn,
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
        assert.equal(serializedBrainPacket.includes("projection_hash"), false);
        assert.equal(serializedBrainPacket.includes("receipt_id"), false);
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
  assert.equal(historicalReplay.historical_projection_semantics_preserved, true);
  assert.equal(historicalReplay.committed_turns_with_projection, 1);
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

  let invalidSelectionAdjudicatorCalled = false;
  const preparedSecondTurn = await prepareWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-002",
  }, options);
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
        assert.equal(serializedBrainPacket.includes("projection_hash"), false);
        assert.equal(serializedBrainPacket.includes("receipt_id"), false);
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
