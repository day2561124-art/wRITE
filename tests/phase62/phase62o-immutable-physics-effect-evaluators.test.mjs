import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  evaluateWorldSimulationAbilityEnergyConsumption,
  evaluateWorldSimulationAmmoConsumption,
  evaluateWorldSimulationCoverStructuralImpact,
  evaluateWorldSimulationProjectileSpawn,
  projectWorldSimulationImmutablePhysicsEffectProposals,
  worldSimulationImmutablePhysicsEffectVersion,
} from "../../server/src/world-simulation-immutable-physics-effect-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62o-immutable-physics-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const shooter = "物理射手";
const caster = "能量術者";
const sceneId = "immutable-physics-lab";

const initialWorldState = {
  simulation_time: "2026-08-24T21:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    passive_action_seconds: 0.25,
    physics_action_seconds: 0.5,
    ability_field_tick_ms: 100,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [{ event_id: "evt-immutable-physics", scene_id: sceneId, participants: [shooter, caster] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 5 },
      entity_positions: {
        [shooter]: { x: 1, y: 1 },
        [caster]: { x: 6, y: 4 },
      },
      obstacles: [{
        id: "fragile-cover",
        x_min: 2.5,
        x_max: 2.7,
        y_min: 0.5,
        y_max: 1.5,
        penetration_resistance: 10,
        integrity_current: 4,
        destroyed: false,
        passable: false,
        collision_enabled: true,
      }],
      observable_by: {
        [shooter]: { visual: ["fragile-cover 位於射線前方"] },
        [caster]: { visual: ["可在自身附近展開無傷害測試場"] },
      },
    },
  },
  characters: {
    [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [caster]: {
      abilities: {
        quiet_field: {
          enabled: true,
          available: true,
          energy_cost: 15,
          field: {
            radius_m: 0.5,
            duration_ms: 400,
            damage_per_second: 0,
            damage_type: "none",
          },
        },
      },
      physical_state: { health_current: 100, health_max: 100, energy_current: 50 },
    },
  },
  memories: { [shooter]: [], [caster]: [] },
  objects: {
    launcher: {
      holder: shooter,
      state: "ready",
      enabled: true,
      ammo: { current: 2 },
      projectile: {
        speed_mps: 10,
        radius_m: 0.04,
        base_damage: 5,
        damage_type: "training_slug",
        penetration_energy: 5,
        max_lifetime_ms: 2000,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [{
      action_id: "immutable-fire",
      intent: "朝脆弱掩體後方射擊",
      duration_ms: 1000,
      projectile: { weapon_id: "launcher", aim_point: { x: 5, y: 1 } },
    }],
    [caster]: [{
      action_id: "immutable-field",
      intent: "展開測試場",
      duration_ms: 1000,
      ability: { ability_id: "quiet_field", center: { x: 6, y: 4 } },
    }],
  },
};

async function characterBrain(packet) {
  return { action_id: packet.character === shooter ? "immutable-fire" : "immutable-field" };
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.immutable_physics_effects.version, worldSimulationImmutablePhysicsEffectVersion);
  assert.deepEqual(contract.immutable_physics_effects.migrated_effect_evaluators, [
    "projectile_ammo_consumption",
    "ability_energy_consumption",
    "projectile_spawn",
    "projectile_cover_structural_impact",
  ]);

  const directState = structuredClone(initialWorldState);
  const directBefore = JSON.stringify(directState);

  const ammo = evaluateWorldSimulationAmmoConsumption({
    world_state: directState,
    weapon_id: "launcher",
    time_ms: 20,
  });
  assert.equal(ammo.result.ok, true);
  assert.equal(ammo.result.remaining, 1);
  assert.equal(ammo.audit.input_context_immutable, true);
  assert.equal(ammo.audit.deterministic_replay_verified, true);
  assert.equal(ammo.audit.evaluator_output_contains_world_state, false);
  assert.equal(directState.objects.launcher.ammo.current, 2);

  const ammoProjection = projectWorldSimulationImmutablePhysicsEffectProposals({
    world_state: directState,
    mutation_proposals: ammo.mutation_proposals,
    scene_id: sceneId,
    elapsed_ms: 20,
  });
  assert.equal(ammoProjection.projected_world_state.objects.launcher.ammo.current, 1);
  assert.equal(directState.objects.launcher.ammo.current, 2);

  const energy = evaluateWorldSimulationAbilityEnergyConsumption({
    world_state: directState,
    actor: caster,
    ability_id: "quiet_field",
    energy_cost: 15,
    time_ms: 30,
  });
  assert.equal(energy.result.ok, true);
  assert.equal(energy.result.remaining, 35);
  assert.equal(directState.characters[caster].physical_state.energy_current, 50);

  const directProjectile = {
    projectile_id: "direct-projectile",
    owner: shooter,
    weapon_id: "launcher",
    scene_id: sceneId,
    position: { x: 1, y: 1 },
    velocity_mps: { x: 10, y: 0 },
    active: true,
  };
  const spawn = evaluateWorldSimulationProjectileSpawn({
    world_state: directState,
    projectile_id: directProjectile.projectile_id,
    projectile: directProjectile,
    weapon_id: "launcher",
    time_ms: 40,
  });
  assert.equal(spawn.result.ok, true);
  assert.equal(spawn.mutation_proposals.length, 1);
  assert.equal(Object.hasOwn(directState.projectiles, directProjectile.projectile_id), false);

  const cover = evaluateWorldSimulationCoverStructuralImpact({
    world_state: directState,
    scene_id: sceneId,
    obstacle_id: "fragile-cover",
    projectile_id: directProjectile.projectile_id,
    penetration_energy: 5,
    time_ms: 150,
  });
  assert.equal(cover.result.ok, true);
  assert.equal(cover.result.structuralDamage, 4);
  assert.equal(cover.result.destroyed, true);
  assert.equal(cover.result.penetrated, false);
  assert.equal(directState.scenes[sceneId].obstacles[0].integrity_current, 4);
  assert.equal(JSON.stringify(directState), directBefore);

  for (const evaluation of [ammo, energy, spawn, cover]) {
    assert.equal(evaluation.audit.input_context_immutable, true);
    assert.equal(evaluation.audit.deterministic_replay_verified, true);
    assert.equal(evaluation.audit.evaluator_output_contains_world_state, false);
  }

  const session = await beginWorldSimulationSession({
    source_text: "Phase62O immutable physics effect fixture",
    characters: [shooter, caster],
    initial_world_state: initialWorldState,
  }, options);
  await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const immutablePhysics = history.turns[0].immutable_physics_effects;
  const obstacle = state.state.scenes[sceneId].obstacles.find((item) => item.id === "fragile-cover");

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.equal(state.state.objects.launcher.ammo.current, 1);
  assert.equal(state.state.characters[caster].physical_state.energy_current, 35);
  assert.equal(obstacle.integrity_current, 0);
  assert.equal(obstacle.destroyed, true);
  assert.equal(obstacle.passable, true);
  assert.equal(obstacle.collision_enabled, false);
  assert.ok(Object.keys(state.state.projectiles).length >= 1);
  assert.ok(Object.keys(state.state.ability_fields).length >= 1);
  assert.ok(immutablePhysics);
  assert.equal(immutablePhysics.version, worldSimulationImmutablePhysicsEffectVersion);
  assert.equal(immutablePhysics.audit_count, 4);
  assert.equal(immutablePhysics.evaluator_inputs_immutable, true);
  assert.equal(immutablePhysics.evaluator_outputs_contain_world_state, false);
  assert.equal(immutablePhysics.deterministic_replay_verified, true);
  assert.deepEqual(immutablePhysics.audits.map((audit) => audit.evaluator).sort(), [
    "ability_energy_consumption",
    "projectile_ammo_consumption",
    "projectile_cover_structural_impact",
    "projectile_spawn",
  ]);

  console.log(JSON.stringify({
    immutable_physics_effect_version: worldSimulationImmutablePhysicsEffectVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_physics_effect_audit_count: immutablePhysics.audit_count,
    ammo_remaining: state.state.objects.launcher.ammo.current,
    energy_remaining: state.state.characters[caster].physical_state.energy_current,
    cover_destroyed: obstacle.destroyed,
    deterministic_replay_verified: immutablePhysics.deterministic_replay_verified,
    evaluator_outputs_contain_world_state: immutablePhysics.evaluator_outputs_contain_world_state,
    character_brain_decides_physics_mutation_values: false,
  }));
  console.log("Phase62O immutable physics effect evaluator test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
