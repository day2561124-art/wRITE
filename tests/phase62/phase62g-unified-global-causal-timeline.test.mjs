import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationGlobalCausalTimelineContract,
} from "../../server/src/world-simulation-global-causal-timeline-service.mjs";
import {
  runWorldSimulationTurn,
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
  `phase62g-global-timeline-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const projectileShooter = "時間軸射手";
const lateMeleeAttacker = "晚發近戰者";
const firstVictim = "第一目標";
const earlyMeleeAttacker = "早發近戰者";
const delayedShooter = "延遲射手";
const secondVictim = "第二目標";
const sceneId = "timeline-lab-a";

const initialWorldState = {
  simulation_time: "2026-08-24T12:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    default_movement_speed_mps: 2,
    attack_attempt_seconds: 0.5,
    physics_action_seconds: 0.5,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [
    {
      event_id: "evt-projectile-preempts-melee",
      scene_id: sceneId,
      participants: [projectileShooter, lateMeleeAttacker, firstVictim],
    },
    {
      event_id: "evt-melee-preempts-launch",
      scene_id: sceneId,
      participants: [earlyMeleeAttacker, delayedShooter, secondVictim],
    },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 12, depth_m: 5 },
      entity_positions: {
        [projectileShooter]: { x: 0.5, y: 1 },
        [lateMeleeAttacker]: { x: 3, y: 1 },
        [firstVictim]: { x: 4, y: 1 },
        [earlyMeleeAttacker]: { x: 5, y: 3 },
        [delayedShooter]: { x: 6, y: 3 },
        [secondVictim]: { x: 10, y: 3 },
      },
      obstacles: [],
      observable_by: {
        [projectileShooter]: { visual: ["晚發近戰者位於射線方向"] },
        [lateMeleeAttacker]: { visual: ["第一目標位於近戰距離"] },
        [firstVictim]: { visual: ["晚發近戰者正在準備攻擊"] },
        [earlyMeleeAttacker]: { visual: ["延遲射手位於近戰距離"] },
        [delayedShooter]: { visual: ["第二目標位於遠處射線方向"] },
        [secondVictim]: { visual: ["延遲射手持有發射器"] },
      },
    },
  },
  characters: {
    [projectileShooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [lateMeleeAttacker]: { physical_state: { health_current: 30, health_max: 100 } },
    [firstVictim]: { physical_state: { health_current: 100, health_max: 100 } },
    [earlyMeleeAttacker]: { physical_state: { health_current: 100, health_max: 100 } },
    [delayedShooter]: { physical_state: { health_current: 25, health_max: 100 } },
    [secondVictim]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: {
    [projectileShooter]: [],
    [lateMeleeAttacker]: [],
    [firstVictim]: [],
    [earlyMeleeAttacker]: [],
    [delayedShooter]: [],
    [secondVictim]: [],
  },
  objects: {
    "timeline-launcher-a": {
      holder: projectileShooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 20,
        radius_m: 0.05,
        base_damage: 40,
        damage_type: "timeline_test_slug",
        penetration_energy: 40,
        max_lifetime_ms: 2000,
      },
    },
    "timeline-sword-late": {
      holder: lateMeleeAttacker,
      state: "ready",
      enabled: true,
      combat: { range_m: 1.5, base_damage: 60, damage_type: "timeline_test_blade" },
    },
    "timeline-sword-early": {
      holder: earlyMeleeAttacker,
      state: "ready",
      enabled: true,
      combat: { range_m: 1.5, base_damage: 40, damage_type: "timeline_test_blade" },
    },
    "timeline-launcher-delayed": {
      holder: delayedShooter,
      state: "ready",
      enabled: true,
      ammo: { current: 1 },
      projectile: {
        speed_mps: 20,
        radius_m: 0.05,
        base_damage: 30,
        damage_type: "timeline_test_slug",
        penetration_energy: 30,
        max_lifetime_ms: 2000,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [projectileShooter]: [{
      action_id: "fire-before-melee",
      intent: "立即向晚發近戰者射擊",
      duration_ms: 500,
      projectile: { weapon_id: "timeline-launcher-a", target_character: lateMeleeAttacker, fire_delay_ms: 0 },
    }],
    [lateMeleeAttacker]: [{
      action_id: "late-melee-contact",
      intent: "在較晚接觸時間攻擊第一目標",
      duration_ms: 600,
      attack: {
        target_character: firstVictim,
        weapon_id: "timeline-sword-late",
        windup_ms: 250,
        active_ms: 100,
        recovery_ms: 250,
      },
    }],
    [firstVictim]: [{ action_id: "first-victim-wait", intent: "維持位置", duration_ms: 500 }],
    [earlyMeleeAttacker]: [{
      action_id: "early-melee-contact",
      intent: "先於延遲射擊命中延遲射手",
      duration_ms: 200,
      attack: {
        target_character: delayedShooter,
        weapon_id: "timeline-sword-early",
        windup_ms: 50,
        active_ms: 100,
        recovery_ms: 50,
      },
    }],
    [delayedShooter]: [{
      action_id: "delayed-projectile-launch",
      intent: "延遲後向第二目標射擊",
      duration_ms: 500,
      projectile: { weapon_id: "timeline-launcher-delayed", target_character: secondVictim, fire_delay_ms: 300 },
    }],
    [secondVictim]: [{ action_id: "second-victim-wait", intent: "維持位置", duration_ms: 500 }],
  },
};

function selectedAction(eventId, character) {
  const map = {
    "evt-projectile-preempts-melee": {
      [projectileShooter]: "fire-before-melee",
      [lateMeleeAttacker]: "late-melee-contact",
      [firstVictim]: "first-victim-wait",
    },
    "evt-melee-preempts-launch": {
      [earlyMeleeAttacker]: "early-melee-contact",
      [delayedShooter]: "delayed-projectile-launch",
      [secondVictim]: "second-victim-wait",
    },
  };
  return map[eventId]?.[character] ?? null;
}

async function characterBrain(packet) {
  const actionId = selectedAction(packet.event.event_id, packet.character);
  assert.ok(actionId, `fixture action missing for ${packet.event.event_id}/${packet.character}`);
  return { action_id: actionId };
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  const timelineContract = buildWorldSimulationGlobalCausalTimelineContract();
  assert.equal(timelineContract.version, "phase62g-global-causal-timeline-v1");
  assert.equal(contract.global_causal_timeline.version, timelineContract.version);
  assert.equal(timelineContract.ordering.strict_earlier_incapacitation_preempts_later_execution, true);
  assert.equal(timelineContract.ordering.exact_timestamp_ties_are_simultaneous_for_preemption, true);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62G global causal timeline integration fixture",
    characters: Object.keys(initialWorldState.characters),
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  let history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 1);
  assert.equal(state.state.characters[lateMeleeAttacker].physical_state.health_current, 0);
  assert.equal(state.state.characters[lateMeleeAttacker].physical_state.incapacitated, true);
  assert.equal(state.state.characters[firstVictim].physical_state.health_current, 100, "later melee contact must be preempted");
  assert.equal(state.state.objects["timeline-launcher-a"].ammo.current, 0);
  const firstTurn = history.turns[0];
  assert.ok(firstTurn.causal_timeline);
  assert.equal(firstTurn.causal_timeline.version, timelineContract.version);
  assert.ok(firstTurn.causal_timeline.suppressed_action_ids.includes("late-melee-contact"));
  const firstPreemption = firstTurn.action_outcomes.find((item) => item.action_id === "late-melee-contact" && item.result === "action_preempted_by_earlier_incapacitation");
  assert.ok(firstPreemption, "projectile must preempt later melee contact");
  assert.ok(firstPreemption.preempted_at_ms < firstPreemption.scheduled_time_ms);

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 2);
  assert.equal(history.turns.length, 2);
  assert.equal(state.state.characters[delayedShooter].physical_state.health_current, 0);
  assert.equal(state.state.characters[delayedShooter].physical_state.incapacitated, true);
  assert.equal(state.state.objects["timeline-launcher-delayed"].ammo.current, 1, "preempted launch must not consume ammunition");
  const delayedProjectiles = Object.values(state.state.projectiles).filter((item) => item.weapon_id === "timeline-launcher-delayed");
  assert.equal(delayedProjectiles.length, 0, "preempted delayed launch must not spawn projectile");
  assert.equal(state.state.characters[secondVictim].physical_state.health_current, 100);

  const secondTurn = history.turns[1];
  assert.ok(secondTurn.causal_timeline.suppressed_action_ids.includes("delayed-projectile-launch"));
  const secondPreemption = secondTurn.action_outcomes.find((item) => item.action_id === "delayed-projectile-launch" && item.result === "action_preempted_by_earlier_incapacitation");
  assert.ok(secondPreemption, "earlier melee must preempt later projectile launch");
  assert.ok(secondPreemption.preempted_at_ms < secondPreemption.scheduled_time_ms);
  assert.equal(typeof secondTurn.causal_timeline.timeline_hash, "string");
  assert.ok(secondTurn.causal_timeline.timeline_hash.length >= 32);

  const firstProjectileEvent = firstTurn.causal_timeline.entries.find((item) => item.kind === "projectile_resolution" && item.result === "projectile_hit_character");
  const firstPreemptEvent = firstTurn.causal_timeline.entries.find((item) => item.kind === "action_preempted" && item.action_id === "late-melee-contact");
  assert.ok(firstProjectileEvent && firstPreemptEvent);
  assert.ok(firstProjectileEvent.time_ms <= firstPreemptEvent.time_ms);

  console.log(JSON.stringify({
    global_causal_timeline_version: timelineContract.version,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    projectile_preempted_melee: firstTurn.causal_timeline.suppressed_action_ids.includes("late-melee-contact"),
    melee_preempted_projectile_launch: secondTurn.causal_timeline.suppressed_action_ids.includes("delayed-projectile-launch"),
    delayed_launcher_ammo_remaining: state.state.objects["timeline-launcher-delayed"].ammo.current,
    second_victim_health: state.state.characters[secondVictim].physical_state.health_current,
    timeline_persisted: Boolean(secondTurn.causal_timeline.timeline_hash),
    character_brain_decides_precedence: false,
  }));
  console.log("Phase62G unified global causal timeline test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
