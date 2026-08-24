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
  buildWorldSimulationContinuousPhysicsContract,
} from "../../server/src/world-simulation-continuous-physics-service.mjs";
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
  `phase62f-physics-${process.pid}-${Date.now()}`,
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

const shooter = "夜";
const coverTarget = "伊萊亞斯・諾爾";
const persistenceShooter = "折原律";
const persistenceTarget = "柊木璃央";
const motionShooter = "測試射手";
const motionTarget = "移動靶";
const abilityUser = "梅芙";
const fieldTarget = "朝日奈美咲";
const mover = "測試移動者";
const sceneId = "physics-lab-a";

const initialWorldState = {
  simulation_time: "2026-08-24T10:00:00.000Z",
  world_rules: {
    default_movement_speed_mps: 2,
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    passive_action_seconds: 0.25,
    physics_action_seconds: 0.5,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [
    { event_id: "evt-low-cover", scene_id: sceneId, participants: [shooter] },
    { event_id: "evt-high-cover", scene_id: sceneId, participants: [shooter] },
    { event_id: "evt-persist-fire", scene_id: sceneId, participants: [persistenceShooter] },
    { event_id: "evt-persist-tick", scene_id: sceneId, participants: [persistenceTarget] },
    { event_id: "evt-motion-projectile", scene_id: sceneId, participants: [motionShooter, motionTarget] },
    { event_id: "evt-field-create", scene_id: sceneId, participants: [abilityUser] },
    { event_id: "evt-field-tick", scene_id: sceneId, participants: [fieldTarget] },
    { event_id: "evt-move-through-cover", scene_id: sceneId, participants: [mover] },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 10, depth_m: 6 },
      entity_positions: {
        [shooter]: { x: 1, y: 1 },
        [coverTarget]: { x: 6, y: 1 },
        [persistenceShooter]: { x: 1, y: 4 },
        [persistenceTarget]: { x: 6, y: 4 },
        [motionShooter]: { x: 1, y: 5 },
        [motionTarget]: { x: 4, y: 5 },
        [abilityUser]: { x: 8, y: 4 },
        [fieldTarget]: { x: 8.5, y: 4 },
        [mover]: { x: 2.5, y: 1.4 },
      },
      obstacles: [
        {
          id: "cover-panel",
          x_min: 3,
          x_max: 3.2,
          y_min: 0.5,
          y_max: 1.5,
          penetration_resistance: 12,
          integrity_current: 35,
          destroyed: false,
          collision_enabled: true,
        },
      ],
      observable_by: {
        [shooter]: { visual: ["cover-panel 與其後方目標在射線方向"] },
        [persistenceShooter]: { visual: ["遠處目標位於水平射線方向"] },
        [persistenceTarget]: { visual: ["場內仍存在先前射出的飛行物"] },
        [motionShooter]: { visual: ["移動靶位於水平射線方向"] },
        [motionTarget]: { visual: ["測試射手正在瞄準目前位置"] },
        [abilityUser]: { visual: ["朝日奈美咲位於能力有效區域內"] },
        [fieldTarget]: { visual: ["能力場仍在持續"] },
        [mover]: { visual: ["cover-panel 已經破壞"] },
      },
    },
  },
  characters: {
    [shooter]: {
      current_action: "physics_test",
      physical_state: { health_current: 100, health_max: 100 },
    },
    [coverTarget]: {
      current_action: "physics_test",
      armor: { regions: { torso: { absorption: 5, mitigation_fraction: 0 } } },
      physical_state: { health_current: 100, health_max: 100 },
    },
    [persistenceShooter]: {
      current_action: "physics_test",
      physical_state: { health_current: 100, health_max: 100 },
    },
    [persistenceTarget]: {
      current_action: "physics_test",
      physical_state: { health_current: 100, health_max: 100 },
    },
    [motionShooter]: {
      current_action: "physics_test",
      physical_state: { health_current: 100, health_max: 100 },
    },
    [motionTarget]: {
      current_action: "physics_test",
      movement_speed_mps: 4,
      physical_state: { health_current: 100, health_max: 100 },
    },
    [abilityUser]: {
      current_action: "physics_test",
      abilities: {
        ember_field: {
          enabled: true,
          available: true,
          energy_cost: 30,
          field: {
            radius_m: 1,
            duration_ms: 1000,
            damage_per_second: 20,
            damage_type: "thermal_field",
            ignore_armor: true,
          },
        },
      },
      physical_state: { health_current: 100, health_max: 100, energy_current: 100 },
    },
    [fieldTarget]: {
      current_action: "physics_test",
      physical_state: { health_current: 100, health_max: 100 },
    },
    [mover]: {
      current_action: "physics_test",
      movement_speed_mps: 2,
      physical_state: { health_current: 100, health_max: 100 },
    },
  },
  memories: {
    [shooter]: [],
    [coverTarget]: [],
    [persistenceShooter]: [],
    [persistenceTarget]: [],
    [motionShooter]: [],
    [motionTarget]: [],
    [abilityUser]: [],
    [fieldTarget]: [],
    [mover]: [],
  },
  objects: {
    "low-launcher": {
      holder: shooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 10,
        radius_m: 0.04,
        base_damage: 12,
        damage_type: "training_slug",
        penetration_energy: 8,
        max_lifetime_ms: 2000,
      },
    },
    "high-launcher": {
      holder: shooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 10,
        radius_m: 0.04,
        base_damage: 30,
        damage_type: "training_slug",
        penetration_energy: 50,
        max_lifetime_ms: 2000,
      },
    },
    "motion-launcher": {
      holder: motionShooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 10,
        radius_m: 0.04,
        base_damage: 20,
        damage_type: "training_slug",
        penetration_energy: 20,
        max_lifetime_ms: 2000,
      },
    },
    "slow-launcher": {
      holder: persistenceShooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 4,
        radius_m: 0.04,
        base_damage: 20,
        damage_type: "training_slug",
        penetration_energy: 20,
        max_lifetime_ms: 3000,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [
      {
        action_id: "fire-low-cover",
        intent: "以 low-launcher 朝 cover-panel 後方射擊",
        duration_ms: 700,
        projectile: { weapon_id: "low-launcher", target_character: coverTarget },
      },
      {
        action_id: "fire-high-cover",
        intent: "以 high-launcher 朝 cover-panel 後方射擊",
        duration_ms: 700,
        projectile: { weapon_id: "high-launcher", target_character: coverTarget },
      },
    ],
    [persistenceShooter]: [
      {
        action_id: "fire-persistent",
        intent: "以 slow-launcher 朝遠方目標射擊",
        duration_ms: 200,
        projectile: { weapon_id: "slow-launcher", target_character: persistenceTarget },
      },
    ],
    [persistenceTarget]: [
      { action_id: "wait-projectile", intent: "維持位置", duration_ms: 1100 },
    ],
    [motionShooter]: [
      {
        action_id: "fire-motion-target",
        intent: "朝移動靶目前位置射擊",
        duration_ms: 500,
        projectile: { weapon_id: "motion-launcher", target_character: motionTarget },
      },
    ],
    [motionTarget]: [
      {
        action_id: "move-out-of-line",
        intent: "向上移出原射線",
        movement: { dx: 0, dy: 1 },
      },
    ],
    [abilityUser]: [
      {
        action_id: "create-ember-field",
        intent: "啟動 ember_field",
        duration_ms: 500,
        ability: { ability_id: "ember_field", center: { x: 8, y: 4 } },
      },
    ],
    [fieldTarget]: [
      { action_id: "wait-field", intent: "維持位置", duration_ms: 500 },
    ],
    [mover]: [
      {
        action_id: "cross-destroyed-cover",
        intent: "穿過已破壞的 cover-panel 區域",
        movement: { dx: 1, dy: 0 },
      },
    ],
  },
};

function actionFor(eventId, character) {
  const map = {
    "evt-low-cover": { [shooter]: "fire-low-cover" },
    "evt-high-cover": { [shooter]: "fire-high-cover" },
    "evt-persist-fire": { [persistenceShooter]: "fire-persistent" },
    "evt-persist-tick": { [persistenceTarget]: "wait-projectile" },
    "evt-motion-projectile": {
      [motionShooter]: "fire-motion-target",
      [motionTarget]: "move-out-of-line",
    },
    "evt-field-create": { [abilityUser]: "create-ember-field" },
    "evt-field-tick": { [fieldTarget]: "wait-field" },
    "evt-move-through-cover": { [mover]: "cross-destroyed-cover" },
  };
  return map[eventId]?.[character] ?? "reject_all";
}

try {
  const physicsContract = buildWorldSimulationContinuousPhysicsContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(physicsContract.projectiles.persistent_world_entities, true);
  assert.equal(physicsContract.projectiles.continuous_relative_motion_collision, true);
  assert.equal(physicsContract.abilities.activation_energy_cost_enforced, true);
  assert.equal(physicsContract.topology.destroyed_cover_becomes_non_colliding_and_passable, true);
  assert.equal(physicsContract.character_brain_may_not_choose.includes("projectile_collision_result"), true);
  assert.equal(causalContract.continuous_physics.version, physicsContract.version);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62F continuous projectile and ability physics fixture",
    seed: "phase62f",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initialWorldState,
  }, options);

  const characterBrain = async (packet) => ({ action_id: actionFor(testHarnessEventId, packet.character) });

  const lowTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-low-cover",
  }, { ...options, characterBrain });
  assert.equal(lowTurn.ok, true);
  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  let obstacle = state.state.scenes[sceneId].obstacles[0];
  assert.equal(obstacle.destroyed, false);
  assert.equal(obstacle.integrity_current, 27);
  assert.equal(state.state.objects["low-launcher"].ammo.current, 0);

  const highTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-high-cover",
  }, { ...options, characterBrain });
  assert.equal(highTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  obstacle = state.state.scenes[sceneId].obstacles[0];
  assert.equal(obstacle.destroyed, true);
  assert.equal(obstacle.passable, true);
  assert.equal(obstacle.collision_enabled, false);
  assert.equal(state.state.characters[coverTarget].physical_state.health_current < 100, true);
  assert.equal(state.state.objects["high-launcher"].ammo.current, 0);

  const persistentFireTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-persist-fire",
  }, { ...options, characterBrain });
  assert.equal(persistentFireTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const persistentProjectile = Object.values(state.state.projectiles).find(
    (projectile) => projectile.source_action_id === "fire-persistent",
  );
  assert.ok(persistentProjectile);
  assert.equal(persistentProjectile.active, true);
  assert.ok(Math.abs(persistentProjectile.position.x - 1.8) < 0.001);
  const persistentXAfterSpawnTurn = persistentProjectile.position.x;

  const persistentTickTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-persist-tick",
  }, { ...options, characterBrain });
  assert.equal(persistentTickTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const persistentAfterTick = Object.values(state.state.projectiles).find(
    (projectile) => projectile.source_action_id === "fire-persistent",
  );
  assert.equal(persistentAfterTick.active, false);
  assert.equal(persistentAfterTick.termination_reason, "character_contact");
  assert.equal(state.state.characters[persistenceTarget].physical_state.health_current < 100, true);

  const motionTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-motion-projectile",
  }, { ...options, characterBrain });
  assert.equal(motionTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[motionTarget], { x: 4, y: 6 });
  assert.equal(state.state.characters[motionTarget].physical_state.health_current, 100);

  const fieldCreateTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-field-create",
  }, { ...options, characterBrain });
  assert.equal(fieldCreateTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.characters[abilityUser].physical_state.energy_current, 70);
  assert.equal(state.state.characters[fieldTarget].physical_state.health_current, 90);
  const field = Object.values(state.state.ability_fields).find((item) => item.ability_id === "ember_field");
  assert.ok(field);
  assert.equal(field.active, true);
  assert.equal(field.remaining_ms, 500);

  const fieldTickTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-field-tick",
  }, { ...options, characterBrain });
  assert.equal(fieldTickTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(state.state.characters[fieldTarget].physical_state.health_current, 80);
  const expiredField = Object.values(state.state.ability_fields).find((item) => item.ability_id === "ember_field");
  assert.equal(expiredField.active, false);
  assert.equal(expiredField.remaining_ms, 0);

  const moveTurn = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-move-through-cover",
  }, { ...options, characterBrain });
  assert.equal(moveTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[mover], { x: 3.5, y: 1.4 });

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 8);
  const allOutcomes = history.turns.flatMap((turn) => turn.action_outcomes);
  const lowCover = allOutcomes.find((item) => item.result === "projectile_stopped_by_cover");
  const highCover = allOutcomes.find((item) => item.result === "projectile_penetrated_cover" && item.cover_destroyed === true);
  const persistentHit = allOutcomes.find((item) => item.result === "projectile_hit_character" && item.target === persistenceTarget);
  const fieldTicks = allOutcomes.filter((item) => item.result === "ability_field_applied" && item.target === fieldTarget);
  const moverOutcome = allOutcomes.find((item) => item.action_id === "cross-destroyed-cover");
  assert.ok(lowCover);
  assert.ok(highCover);
  assert.ok(persistentHit);
  assert.equal(fieldTicks.length, 2);
  assert.equal(moverOutcome.result, "movement_completed");

  console.log(JSON.stringify({
    continuous_physics_version: physicsContract.version,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    moving_target_avoided_projectile: state.state.characters[motionTarget].physical_state.health_current === 100,
    low_cover_result: lowCover.result,
    cover_destroyed: obstacle.destroyed,
    persistent_projectile_x_after_spawn_turn: persistentXAfterSpawnTurn,
    persistent_projectile_result: persistentHit.result,
    ability_energy_after_activation: state.state.characters[abilityUser].physical_state.energy_current,
    field_target_health_after_two_ticks: state.state.characters[fieldTarget].physical_state.health_current,
    field_expired: expiredField.active === false,
    destroyed_cover_passable_for_movement: moverOutcome.result === "movement_completed",
    character_brain_decides_projectile_collision: false,
  }));
  console.log("Phase62F continuous projectile/ability physics test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
