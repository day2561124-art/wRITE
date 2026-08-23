import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  worldSimulationTimelineRefinementVersion,
} from "../../server/src/world-simulation-timeline-refinement-service.mjs";
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
  `phase62h-timeline-refinement-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const shooter = "傷勢時序射手";
const woundedAttacker = "受傷近戰者";
const meleeVictim = "近戰目標";
const lateShooter = "後發低穿透射手";
const coverBreaker = "先發破障射手";
const topologyTarget = "掩體後目標";
const injuryScene = "timeline-refinement-injury-lab";
const topologyScene = "timeline-refinement-topology-lab";

const initialWorldState = {
  simulation_time: "2026-08-24T13:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    attack_attempt_seconds: 0.8,
    physics_action_seconds: 0.8,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [
    {
      event_id: "evt-nonfatal-injury-delays-melee",
      scene_id: injuryScene,
      participants: [shooter, woundedAttacker, meleeVictim],
    },
    {
      event_id: "evt-earlier-cover-destruction-rewrites-later-path",
      scene_id: topologyScene,
      participants: [lateShooter, coverBreaker, topologyTarget],
    },
  ],
  scenes: {
    [injuryScene]: {
      scene_id: injuryScene,
      dimensions: { width_m: 10, depth_m: 4 },
      entity_positions: {
        [shooter]: { x: 0, y: 1 },
        [woundedAttacker]: { x: 3, y: 1 },
        [meleeVictim]: { x: 4, y: 1 },
      },
      obstacles: [],
      observable_by: {
        [shooter]: { visual: ["受傷近戰者位於射線方向"] },
        [woundedAttacker]: { visual: ["近戰目標位於攻擊距離"] },
        [meleeVictim]: { visual: ["受傷近戰者正在準備攻擊"] },
      },
    },
    [topologyScene]: {
      scene_id: topologyScene,
      dimensions: { width_m: 10, depth_m: 4 },
      entity_positions: {
        [lateShooter]: { x: 0, y: 2 },
        [coverBreaker]: { x: 0, y: 3 },
        [topologyTarget]: { x: 6, y: 2 },
      },
      obstacles: [{
        id: "breakable-cover-h",
        x_min: 3,
        x_max: 3.2,
        y_min: 1.5,
        y_max: 2.5,
        penetration_resistance: 10,
        integrity_current: 30,
        collision_enabled: true,
        passable: false,
        destroyed: false,
      }],
      observable_by: {
        [lateShooter]: { visual: ["目標位於可破壞掩體後方"] },
        [coverBreaker]: { visual: ["可破壞掩體位於射線上"] },
        [topologyTarget]: { visual: ["兩名射手位於掩體另一側"] },
      },
    },
  },
  characters: {
    [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [woundedAttacker]: { physical_state: { health_current: 100, health_max: 100 } },
    [meleeVictim]: { physical_state: { health_current: 100, health_max: 100 } },
    [lateShooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [coverBreaker]: { physical_state: { health_current: 100, health_max: 100 } },
    [topologyTarget]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: Object.fromEntries([
    shooter,
    woundedAttacker,
    meleeVictim,
    lateShooter,
    coverBreaker,
    topologyTarget,
  ].map((name) => [name, []])),
  objects: {
    "injury-launcher-h": {
      holder: shooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 20,
        radius_m: 0.05,
        base_damage: 25,
        damage_type: "timeline_refinement_slug",
        penetration_energy: 30,
        max_lifetime_ms: 1500,
      },
    },
    "injury-sword-h": {
      holder: woundedAttacker,
      enabled: true,
      state: "ready",
      combat: { range_m: 1.5, base_damage: 15, damage_type: "timeline_refinement_blade" },
    },
    "late-low-penetration-launcher-h": {
      holder: lateShooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 20,
        radius_m: 0.05,
        base_damage: 20,
        damage_type: "timeline_refinement_late_slug",
        penetration_energy: 5,
        max_lifetime_ms: 1500,
      },
    },
    "cover-breaker-launcher-h": {
      holder: coverBreaker,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 15,
        radius_m: 0.05,
        base_damage: 0,
        damage_type: "timeline_refinement_breaker_slug",
        penetration_energy: 40,
        max_lifetime_ms: 220,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [{
      action_id: "injure-before-contact-h",
      intent: "先射中正在準備近戰的角色",
      duration_ms: 800,
      projectile: { weapon_id: "injury-launcher-h", target_character: woundedAttacker, fire_delay_ms: 0 },
    }],
    [woundedAttacker]: [{
      action_id: "slowable-melee-h",
      intent: "完成較長起手後攻擊近戰目標",
      duration_ms: 800,
      attack: {
        target_character: meleeVictim,
        weapon_id: "injury-sword-h",
        windup_ms: 400,
        active_ms: 200,
        recovery_ms: 200,
      },
    }],
    [meleeVictim]: [{ action_id: "melee-victim-wait-h", intent: "維持位置", duration_ms: 800 }],
    [lateShooter]: [{
      action_id: "late-low-shot-h",
      intent: "延遲射向掩體後目標",
      duration_ms: 600,
      projectile: { weapon_id: "late-low-penetration-launcher-h", target_character: topologyTarget, fire_delay_ms: 100 },
    }],
    [coverBreaker]: [{
      action_id: "early-cover-breaker-h",
      intent: "先摧毀射線上的掩體",
      duration_ms: 600,
      projectile: { weapon_id: "cover-breaker-launcher-h", target_character: topologyTarget, fire_delay_ms: 0 },
    }],
    [topologyTarget]: [{ action_id: "topology-target-wait-h", intent: "維持位置", duration_ms: 600 }],
  },
};

function selectedAction(eventId, character) {
  const map = {
    "evt-nonfatal-injury-delays-melee": {
      [shooter]: "injure-before-contact-h",
      [woundedAttacker]: "slowable-melee-h",
      [meleeVictim]: "melee-victim-wait-h",
    },
    "evt-earlier-cover-destruction-rewrites-later-path": {
      [lateShooter]: "late-low-shot-h",
      [coverBreaker]: "early-cover-breaker-h",
      [topologyTarget]: "topology-target-wait-h",
    },
  };
  return map[eventId]?.[character] ?? null;
}

async function characterBrain(packet) {
  const actionId = selectedAction(packet.event.event_id, packet.character);
  assert.ok(actionId, `missing Phase62H fixture action for ${packet.event.event_id}/${packet.character}`);
  return { action_id: actionId };
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  const refinement = contract.global_causal_timeline.timeline_refinement;
  assert.equal(refinement.version, worldSimulationTimelineRefinementVersion);
  assert.equal(refinement.nonfatal_injury.earlier_injury_can_delay_later_execution, true);
  assert.equal(refinement.topology.strictly_earlier_cover_destruction_changes_later_projectile_paths, true);
  assert.equal(refinement.character_brain_may_decide_rate_change_or_topology_result, false);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62H dynamic timeline refinement fixture",
    characters: Object.keys(initialWorldState.characters),
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  let history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 1);
  assert.equal(state.state.characters[woundedAttacker].physical_state.health_current, 75);
  assert.equal(state.state.characters[woundedAttacker].physical_state.combat_multiplier, 0.7);
  assert.equal(state.state.characters[meleeVictim].physical_state.health_current, 85, "delayed attack should still resolve if attacker remains capable");

  const firstTimeline = history.turns[0].causal_timeline;
  assert.equal(firstTimeline.refinement_version, worldSimulationTimelineRefinementVersion);
  const adjustment = firstTimeline.rate_adjustments.find((item) => item.action_id === "slowable-melee-h" && item.kind === "melee_contact");
  assert.ok(adjustment, "earlier nonfatal injury must create a melee timing adjustment");
  assert.ok(adjustment.refined_time_ms > adjustment.nominal_time_ms);
  const meleeContact = firstTimeline.entries.find((item) => item.kind === "melee_contact" && item.actor === woundedAttacker && item.damage_applied === 15);
  assert.ok(meleeContact);
  assert.ok(meleeContact.time_ms > 500, "actual melee contact must move later than its nominal 500ms contact");

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 2);
  assert.equal(history.turns.length, 2);
  const cover = state.state.scenes[topologyScene].obstacles.find((item) => item.id === "breakable-cover-h");
  assert.equal(cover.destroyed, true);
  assert.equal(cover.passable, true);
  assert.equal(cover.collision_enabled, false);
  assert.equal(state.state.characters[topologyTarget].physical_state.health_current, 80, "later low-penetration projectile must pass after earlier cover destruction");

  const secondTimeline = history.turns[1].causal_timeline;
  const coverBreak = secondTimeline.entries.find((item) => item.kind === "projectile_resolution" && item.obstacle_id === "breakable-cover-h" && item.result === "projectile_penetrated_cover");
  const laterHit = secondTimeline.entries.find((item) => item.kind === "projectile_resolution" && item.target === topologyTarget && item.result === "projectile_hit_character");
  assert.ok(coverBreak);
  assert.ok(laterHit);
  assert.ok(coverBreak.time_ms < laterHit.time_ms, "cover destruction must occur before the later projectile reaches the target");
  const lateStopped = secondTimeline.entries.find((item) => item.action_id === "late-low-shot-h" && item.result === "projectile_stopped_by_cover");
  assert.equal(lateStopped, undefined, "late projectile must not collide with cover that was destroyed earlier in world time");

  console.log(JSON.stringify({
    timeline_refinement_version: worldSimulationTimelineRefinementVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    nominal_melee_contact_ms: adjustment.nominal_time_ms,
    refined_melee_contact_ms: adjustment.refined_time_ms,
    wounded_combat_multiplier: state.state.characters[woundedAttacker].physical_state.combat_multiplier,
    cover_destroyed_before_late_projectile: coverBreak.time_ms < laterHit.time_ms,
    topology_target_health: state.state.characters[topologyTarget].physical_state.health_current,
    character_brain_decides_timeline_refinement: false,
  }));
  console.log("Phase62H dynamic timeline refinement test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
