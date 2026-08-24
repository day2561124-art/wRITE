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
  buildWorldSimulationCombatCausalContract,
} from "../../server/src/world-simulation-combat-causal-service.mjs";
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
  `phase62e-combat-${process.pid}-${Date.now()}`,
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

const attacker = "夜";
const secondAttacker = "朝日奈美咲";
const hitTarget = "伊萊亞斯・諾爾";
const dodgeTarget = "折原律";
const blockTarget = "柊木璃央";
const barrierTarget = "梅芙";
const sceneId = "combat-lab-a";

const initialWorldState = {
  simulation_time: "2026-08-24T09:00:00.000Z",
  world_rules: {
    default_movement_speed_mps: 2,
    collision_radius_m: 0.25,
    combat_target_radius_m: 0.25,
    attack_attempt_seconds: 0.5,
    defense_action_seconds: 0.5,
    default_attack_range_m: 1.5,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [
    { event_id: "evt-body-hit", scene_id: sceneId, participants: [attacker, hitTarget] },
    { event_id: "evt-dodge", scene_id: sceneId, participants: [attacker, dodgeTarget] },
    { event_id: "evt-block", scene_id: sceneId, participants: [attacker, blockTarget] },
    { event_id: "evt-barrier", scene_id: sceneId, participants: [attacker, secondAttacker, barrierTarget] },
    { event_id: "evt-injured-move", scene_id: sceneId, participants: [hitTarget] },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 10, depth_m: 10 },
      entity_positions: {
        [attacker]: { x: 1, y: 1 },
        [secondAttacker]: { x: 2, y: 0 },
        [hitTarget]: { x: 2, y: 1 },
        [dodgeTarget]: { x: 1, y: 2 },
        [blockTarget]: { x: 0, y: 1 },
        [barrierTarget]: { x: 1, y: 0 },
      },
      obstacles: [],
      observable_by: {
        [attacker]: { visual: ["四名對手都在近距離"] },
        [secondAttacker]: { visual: ["梅芙在近距離"] },
        [hitTarget]: { visual: ["夜持劍在近距離"] },
        [dodgeTarget]: { visual: ["夜持劍在近距離"] },
        [blockTarget]: { visual: ["夜持劍在近距離"] },
        [barrierTarget]: { visual: ["夜持劍在近距離"] },
      },
    },
  },
  characters: {
    [attacker]: {
      current_action: "combat_test",
      movement_speed_mps: 2,
      physical_state: { health_current: 100, health_max: 100 },
    },
    [secondAttacker]: {
      current_action: "combat_test",
      movement_speed_mps: 2,
      physical_state: { health_current: 100, health_max: 100 },
    },
    [hitTarget]: {
      current_action: "combat_test",
      movement_speed_mps: 2,
      armor: {
        regions: {
          torso: { absorption: 5, mitigation_fraction: 0 },
        },
      },
      physical_state: { health_current: 100, health_max: 100 },
    },
    [dodgeTarget]: {
      current_action: "combat_test",
      movement_speed_mps: 4,
      physical_state: { health_current: 100, health_max: 100 },
    },
    [blockTarget]: {
      current_action: "combat_test",
      movement_speed_mps: 2,
      physical_state: { health_current: 100, health_max: 100 },
    },
    [barrierTarget]: {
      current_action: "combat_test",
      movement_speed_mps: 2,
      abilities: {
        ward: {
          enabled: true,
          available: true,
          capacity_remaining: 25,
          absorption_per_hit: 25,
        },
      },
      physical_state: { health_current: 100, health_max: 100 },
    },
  },
  memories: {
    [attacker]: [],
    [secondAttacker]: [],
    [hitTarget]: [],
    [dodgeTarget]: [],
    [blockTarget]: [],
    [barrierTarget]: [],
  },
  objects: {
    "test-sword": {
      holder: attacker,
      state: "ready",
      enabled: true,
      combat: {
        range_m: 1.5,
        base_damage: 40,
        damage_type: "training_impact",
        penetration: 0,
      },
    },
    "second-sword": {
      holder: secondAttacker,
      state: "ready",
      enabled: true,
      combat: {
        range_m: 1.5,
        base_damage: 40,
        damage_type: "training_impact",
        penetration: 0,
      },
    },
    "test-shield": {
      holder: blockTarget,
      state: "ready",
      enabled: true,
      combat: {
        block_absorption: 60,
      },
    },
  },
  available_actions: {
    [attacker]: [
      {
        action_id: "attack-hit-target",
        intent: "朝伊萊亞斯軀幹揮擊",
        duration_ms: 500,
        attack: {
          target_character: hitTarget,
          weapon_id: "test-sword",
          strike_height_m: 1.1,
          windup_ms: 150,
          active_ms: 200,
          recovery_ms: 150,
        },
      },
      {
        action_id: "attack-dodge-target",
        intent: "朝折原律當前位置揮擊",
        duration_ms: 500,
        attack: {
          target_character: dodgeTarget,
          weapon_id: "test-sword",
          strike_height_m: 1.1,
          windup_ms: 150,
          active_ms: 200,
          recovery_ms: 150,
        },
      },
      {
        action_id: "attack-block-target",
        intent: "朝柊木璃央揮擊",
        duration_ms: 500,
        attack: {
          target_character: blockTarget,
          weapon_id: "test-sword",
          strike_height_m: 1.1,
          windup_ms: 150,
          active_ms: 200,
          recovery_ms: 150,
        },
      },
      {
        action_id: "attack-barrier-target",
        intent: "朝梅芙揮擊",
        duration_ms: 500,
        attack: {
          target_character: barrierTarget,
          weapon_id: "test-sword",
          strike_height_m: 1.1,
          windup_ms: 150,
          active_ms: 200,
          recovery_ms: 150,
        },
      },
    ],
    [secondAttacker]: [
      {
        action_id: "second-attack-barrier-target",
        intent: "在夜之後朝梅芙揮擊",
        duration_ms: 500,
        attack: {
          target_character: barrierTarget,
          weapon_id: "second-sword",
          strike_height_m: 1.1,
          windup_ms: 250,
          active_ms: 200,
          recovery_ms: 50,
        },
      },
    ],
    [hitTarget]: [
      { action_id: "hold-hit", intent: "維持位置" },
      {
        action_id: "injured-move",
        intent: "受傷後向右移動一公尺",
        movement: { dx: 1, dy: 0 },
      },
    ],
    [dodgeTarget]: [
      {
        action_id: "dodge-sideways",
        intent: "向後快速閃避",
        movement: { dx: 0, dy: 1 },
        defense: { type: "dodge", start_ms: 0 },
      },
    ],
    [blockTarget]: [
      {
        action_id: "block-with-shield",
        intent: "以 test-shield 格擋",
        duration_ms: 500,
        defense: {
          type: "block",
          object_id: "test-shield",
          start_ms: 0,
          active_ms: 500,
        },
      },
    ],
    [barrierTarget]: [
      {
        action_id: "raise-ward",
        intent: "啟動 ward 屏障",
        duration_ms: 500,
        defense: {
          type: "barrier",
          ability_id: "ward",
          start_ms: 0,
          active_ms: 500,
        },
      },
    ],
  },
};

function choice(eventId, character) {
  const map = {
    "evt-body-hit": {
      [attacker]: "attack-hit-target",
      [hitTarget]: "hold-hit",
    },
    "evt-dodge": {
      [attacker]: "attack-dodge-target",
      [dodgeTarget]: "dodge-sideways",
    },
    "evt-block": {
      [attacker]: "attack-block-target",
      [blockTarget]: "block-with-shield",
    },
    "evt-barrier": {
      [attacker]: "attack-barrier-target",
      [secondAttacker]: "second-attack-barrier-target",
      [barrierTarget]: "raise-ward",
    },
    "evt-injured-move": {
      [hitTarget]: "injured-move",
    },
  };
  return map[eventId]?.[character] ?? "reject_all";
}

try {
  const combatContract = buildWorldSimulationCombatCausalContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(combatContract.character_brain_may_not_choose.includes("hit"), true);
  assert.equal(combatContract.timing.same_turn_motion_sampled_at_contact_time, true);
  assert.equal(combatContract.injury.damage_updates_persistent_physical_state, true);
  assert.equal(causalContract.combat.combat_causal_layer.version, combatContract.version);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62E combat causal layer fixture",
    seed: "phase62e",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initialWorldState,
  }, options);

  const characterBrain = async (packet) => ({
    action_id: choice(testHarnessEventId, packet.character),
  });

  for (const eventId of [
    "evt-body-hit",
    "evt-dodge",
    "evt-block",
    "evt-barrier",
  ]) {
    const turn = await runWorldSimulationTurn({
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventId,
    }, { ...options, characterBrain });
    assert.equal(turn.ok, true);
  }

  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.characters[hitTarget].physical_state.health_current, 65);
  assert.equal(state.state.characters[hitTarget].physical_state.injuries.length, 1);
  assert.equal(state.state.characters[hitTarget].physical_state.injuries[0].region, "torso");
  assert.equal(state.state.characters[hitTarget].physical_state.injuries[0].severity, "severe");
  assert.equal(state.state.characters[hitTarget].physical_state.movement_multiplier, 0.6);
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[dodgeTarget], { x: 1, y: 3 });
  assert.equal(state.state.characters[blockTarget].physical_state.health_current, 100);
  assert.equal(state.state.characters[barrierTarget].physical_state.health_current, 45);
  assert.equal(state.state.characters[barrierTarget].physical_state.injuries.length, 2);
  assert.equal(state.state.characters[barrierTarget].abilities.ward.capacity_remaining, 0);

  const beforeMoveTime = Date.parse(state.state.simulation_time);
  const injuredMove = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-injured-move",
  }, { ...options, characterBrain });
  assert.equal(injuredMove.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const injuredMoveElapsed = Date.parse(state.state.simulation_time) - beforeMoveTime;
  assert.ok(injuredMoveElapsed >= 833);

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 5);
  const combatOutcome = (turnIndex, actionId) => history.turns[turnIndex].action_outcomes.find(
    (item) => item.action_id === actionId,
  );
  const hit = combatOutcome(0, "attack-hit-target");
  const dodge = combatOutcome(1, "attack-dodge-target");
  const block = combatOutcome(2, "attack-block-target");
  const barrier = combatOutcome(3, "attack-barrier-target");
  const barrierFollowUp = combatOutcome(3, "second-attack-barrier-target");

  assert.equal(hit.result, "hit_resolved");
  assert.equal(hit.hit, true);
  assert.equal(hit.damage_applied, 35);
  assert.equal(hit.health_after, 65);
  assert.equal(dodge.result, "missed_due_to_motion");
  assert.equal(dodge.hit, false);
  assert.equal(dodge.damage_applied, 0);
  assert.equal(block.result, "blocked_by_defense");
  assert.equal(block.hit, false);
  assert.equal(block.contact_type, "blocking_object");
  assert.equal(block.defense_type, "block");
  assert.equal(block.damage_applied, 0);
  assert.equal(barrier.result, "defense_reduced_hit");
  assert.equal(barrier.defense_type, "barrier");
  assert.equal(barrier.damage_applied, 15);
  assert.equal(barrier.health_after, 85);
  assert.equal(barrierFollowUp.result, "defense_exhausted_hit");
  assert.equal(barrierFollowUp.defense_effective, false);
  assert.equal(barrierFollowUp.damage_applied, 40);
  assert.equal(barrierFollowUp.health_before, 85);
  assert.equal(barrierFollowUp.health_after, 45);

  console.log(JSON.stringify({
    combat_causal_version: combatContract.version,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    body_hit_damage: hit.damage_applied,
    dodge_result: dodge.result,
    block_result: block.result,
    barrier_first_damage: barrier.damage_applied,
    barrier_follow_up_damage: barrierFollowUp.damage_applied,
    barrier_follow_up_result: barrierFollowUp.result,
    barrier_capacity_remaining: state.state.characters[barrierTarget].abilities.ward.capacity_remaining,
    injured_movement_multiplier: state.state.characters[hitTarget].physical_state.movement_multiplier,
    injured_move_elapsed_ms: injuredMoveElapsed,
    character_brain_decides_hit: false,
  }));
  console.log("Phase62E programmatic combat causal layer test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
