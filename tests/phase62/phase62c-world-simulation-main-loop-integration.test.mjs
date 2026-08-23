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
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
  runWorldSimulationTurn,
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
  assert.equal(contract.causal_outcome_owner, "programmatic_causal_adjudicator");
  assert.equal(contract.character_brain_receives_world_truth, false);
  assert.equal(contract.stale_state_commit_rejected, true);

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
  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-001",
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        assert.equal(Object.hasOwn(packet, "world_state"), false);
        assert.equal(Object.hasOwn(packet, "scene_analysis"), false);
        assert.equal(
          JSON.stringify(packet).includes("evaluator_private_note"),
          false,
          "Private scene fields must not reach the character brain.",
        );
        assert.equal(packet.boundaries.may_decide_outcome, false);
        return packet.character === "伊萊亞斯・諾爾"
          ? { action_id: "elias-step-line" }
          : { action_id: "yoru-watch" };
      },
      causalAdjudicator: async (input) => {
        adjudicatorInputs.push(input);
        assert.equal(input.world_state.event_queue[0].event_id, "evt-001");
        assert.equal(input.selected_action_intents.length, 2);
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
            },
            {
              actor: "夜",
              action: "留在原地觀察",
              result: "continued_observation",
              causal_evidence: "no movement requested",
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
  assert.equal(firstTurn.consistency.hard_conflict_count, 0);
  assert.equal(firstTurn.trace_ids.length, 10);
  assert.equal(brainInputs.length, 2);
  assert.equal(adjudicatorInputs.length, 1);

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

  const blockedTurn = await resolveWorldSimulationTurn(
    preparedSecondTurn,
    { "伊萊亞斯・諾爾": { action_id: "elias-wait" } },
    {
      ...options,
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
