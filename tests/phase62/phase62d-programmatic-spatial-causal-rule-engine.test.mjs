import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  runWorldSimulationTurn as runWorldSimulationTurnRuntime,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62d-causal-rules-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

let testHarnessEventId = null;
async function runWorldSimulationTurn(input, runtimeOptions) {
  const sessionId = input?.world_simulation_session_id ?? null;
  const harnessState = sessionId
    ? await getWorldSimulationState(sessionId, runtimeOptions)
    : null;
  testHarnessEventId = input?.event_id
    ?? harnessState?.state?.event_queue?.[0]?.event_id
    ?? null;
  try {
    return await runWorldSimulationTurnRuntime(input, runtimeOptions);
  } finally {
    testHarnessEventId = null;
  }
}

await rm(fixtureRoot, { recursive: true, force: true });

const actor = "伊萊亞斯・諾爾";
const observer = "夜";
const sceneId = "training-room-a";

const initialWorldState = {
  simulation_time: "2026-08-24T08:10:00.000Z",
  world_rules: {
    default_movement_speed_mps: 1,
    collision_radius_m: 0.3,
    door_interaction_seconds: 0.5,
    object_interaction_seconds: 0.5,
    attack_attempt_seconds: 0.5,
  },
  event_queue: [
    { event_id: "evt-closed-door", scene_id: sceneId, participants: [actor] },
    { event_id: "evt-open-door", scene_id: sceneId, participants: [actor] },
    { event_id: "evt-move-through", scene_id: sceneId, participants: [actor] },
    { event_id: "evt-pickup", scene_id: sceneId, participants: [actor] },
    { event_id: "evt-invalid-pickup", scene_id: sceneId, participants: [observer] },
    { event_id: "evt-attack-range", scene_id: sceneId, participants: [observer] },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      simulation_time: "2026-08-24T08:10:00.000Z",
      dimensions: { width_m: 10, depth_m: 10 },
      entity_positions: {
        [actor]: { x: 1, y: 1 },
        [observer]: { x: 8, y: 1 },
      },
      doors: {
        "gate-a": { open: false, locked: false },
      },
      routes: {
        "through-gate-a": { door_id: "gate-a" },
      },
      obstacles: [
        { id: "equipment-rack", x_min: 6, x_max: 7, y_min: 6, y_max: 7 },
      ],
      observable_by: {
        [actor]: { visual: ["gate-a 在前方"] },
        [observer]: { visual: ["伊萊亞斯在房間另一側"] },
      },
    },
  },
  characters: {
    [actor]: {
      known: ["自己在訓練室"],
      current_action: "待命",
      movement_speed_mps: 1,
      reach_m: 1.25,
    },
    [observer]: {
      known: ["自己在訓練室"],
      current_action: "觀察",
      movement_speed_mps: 1,
      reach_m: 1.25,
    },
  },
  memories: {
    [actor]: [],
    [observer]: [],
  },
  objects: {
    "test-token": {
      holder: null,
      scene_id: sceneId,
      position: { x: 3.5, y: 1 },
    },
    "training-blade": {
      holder: observer,
      scene_id: null,
      position: null,
      state: "ready",
      enabled: true,
    },
  },
  available_actions: {
    [actor]: [
      {
        action_id: "move-through-gate",
        intent: "穿過 gate-a 移動到前方",
        movement: { dx: 2, dy: 0, route_id: "through-gate-a" },
      },
      {
        action_id: "open-gate",
        intent: "打開 gate-a",
        door_interaction: { door_id: "gate-a", operation: "open" },
      },
      {
        action_id: "pickup-token",
        intent: "撿起 test-token",
        object_interaction: { type: "pickup", object_id: "test-token" },
      },
    ],
    [observer]: [
      {
        action_id: "pickup-token-night",
        intent: "撿起 test-token",
        object_interaction: { type: "pickup", object_id: "test-token" },
      },
      {
        action_id: "attack-elias",
        intent: "以 training-blade 對伊萊亞斯發動攻擊",
        attack: { target_character: actor, weapon_id: "training-blade", range_m: 2 },
      },
    ],
  },
};

function actionForEvent(eventId) {
  return {
    "evt-closed-door": "move-through-gate",
    "evt-open-door": "open-gate",
    "evt-move-through": "move-through-gate",
    "evt-pickup": "pickup-token",
    "evt-invalid-pickup": "pickup-token-night",
    "evt-attack-range": "attack-elias",
  }[eventId];
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.owner, "programmatic_causal_adjudicator");
  assert.equal(contract.movement.route_door_state_enforced, true);
  assert.equal(contract.objects.exclusive_holder_enforced, true);
  assert.equal(contract.combat.range_validity_does_not_imply_hit, true);
  assert.equal(contract.simultaneous_action_preconditions, "turn_start_snapshot");

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62D causal rule engine fixture",
    seed: "phase62d",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initialWorldState,
  }, options);

  const characterBrain = async (packet) => ({
    action_id: actionForEvent(testHarnessEventId),
  });

  const closedDoorTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-closed-door",
  }, { ...options, characterBrain });
  assert.equal(closedDoorTurn.ok, true);
  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[actor], { x: 1, y: 1 });
  assert.equal(state.state.scenes[sceneId].doors["gate-a"].open, false);
  assert.equal(state.state.event_queue[0].event_id, "evt-open-door");

  const openDoorTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-open-door",
  }, { ...options, characterBrain });
  assert.equal(openDoorTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.scenes[sceneId].doors["gate-a"].open, true);

  const beforeMoveTime = Date.parse(state.state.simulation_time);
  const moveTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-move-through",
  }, { ...options, characterBrain });
  assert.equal(moveTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[actor], { x: 3, y: 1 });
  assert.ok(Date.parse(state.state.simulation_time) - beforeMoveTime >= 2000);

  const pickupTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-pickup",
  }, { ...options, characterBrain });
  assert.equal(pickupTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.objects["test-token"].holder, actor);
  assert.equal(state.state.objects["test-token"].scene_id, null);

  const invalidPickupTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-invalid-pickup",
  }, { ...options, characterBrain });
  assert.equal(invalidPickupTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.objects["test-token"].holder, actor);

  const attackTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-attack-range",
  }, { ...options, characterBrain });
  assert.equal(attackTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.event_queue.length, 0);

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 6);
  const closedOutcome = history.turns[0].action_outcomes[0];
  assert.equal(closedOutcome.result, "movement_blocked");
  assert.match(closedOutcome.causal_evidence, /closed_door/);
  assert.equal(history.turns[1].action_outcomes[0].result, "door_opened");
  assert.equal(history.turns[2].action_outcomes[0].result, "movement_completed");
  assert.equal(history.turns[3].action_outcomes[0].result, "pickup_completed");
  assert.equal(history.turns[4].action_outcomes[0].result, "blocked");
  assert.match(history.turns[4].action_outcomes[0].causal_evidence, /already held/);
  assert.equal(history.turns[5].action_outcomes[0].result, "out_of_range");
  assert.equal(history.turns[5].action_outcomes[0].contact_resolved, false);

  assert.equal(
    history.turns.every((turn) => typeof turn.causal_resolution_id === "string" && turn.causal_resolution_id.startsWith("causal_")),
    true,
  );

  console.log(JSON.stringify({
    causal_rule_engine_version: contract.version,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    closed_door_blocked: closedOutcome.result === "movement_blocked",
    final_token_holder: state.state.objects["test-token"].holder,
    attack_result: history.turns[5].action_outcomes[0].result,
    attack_contact_resolved: history.turns[5].action_outcomes[0].contact_resolved,
  }));
  console.log("Phase62D programmatic spatial causal rule engine test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
