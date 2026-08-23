import {
  projectWorldSimulationImmutableEvaluatorProposals,
  runWorldSimulationImmutableCausalEvaluator,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "./world-simulation-immutable-causal-evaluator-service.mjs";

export const worldSimulationImmutablePhysicsEffectVersion = "phase62o-immutable-physics-effects-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
}

function transition(entity, field, from, to, cause, timeMs = null, extra = {}) {
  if (JSON.stringify(from) === JSON.stringify(to)) return null;
  const resolvedTime = finiteNumber(timeMs);
  return {
    entity,
    field,
    from: cloneJson(from),
    to: cloneJson(to),
    cause,
    adjudication: "programmatic_continuous_physics",
    ...(resolvedTime === null ? {} : { time_ms: Math.max(0, resolvedTime) }),
    ...cloneJson(extra),
  };
}

function sceneRecord(worldState, sceneId) {
  const scenes = object(worldState.scenes);
  if (sceneId && isObject(scenes[sceneId])) return scenes[sceneId];
  return object(worldState.scene_state);
}

function obstacleRecord(worldState, sceneId, obstacleId) {
  const scene = sceneRecord(worldState, sceneId);
  const index = array(scene.obstacles).findIndex((item) => String(item?.id ?? item?.obstacle_id ?? "") === String(obstacleId ?? ""));
  return index >= 0 ? { scene, obstacle: object(scene.obstacles[index]), index } : null;
}

function obstacleResistance(obstacle) {
  const material = object(obstacle.material);
  return nonNegativeNumber(
    obstacle.penetration_resistance
      ?? material.penetration_resistance
      ?? material.resistance,
    Number.POSITIVE_INFINITY,
  );
}

function obstacleIntegrity(obstacle) {
  const current = finiteNumber(obstacle.integrity_current ?? obstacle.hp_current ?? obstacle.integrity ?? obstacle.hp);
  return current === null ? null : Math.max(0, current);
}

function energyRecord(character) {
  const physical = object(character.physical_state);
  if (finiteNumber(physical.energy_current) !== null) {
    return { path: "physical_state.energy_current", value: finiteNumber(physical.energy_current, 0) };
  }
  const resources = object(character.resources);
  const energy = object(resources.energy);
  if (finiteNumber(energy.current) !== null) {
    return { path: "resources.energy.current", value: finiteNumber(energy.current, 0) };
  }
  if (finiteNumber(character.energy_current) !== null) {
    return { path: "energy_current", value: finiteNumber(character.energy_current, 0) };
  }
  return null;
}

export function evaluateWorldSimulationAmmoConsumption(input = {}) {
  const worldState = object(input.world_state);
  const weaponId = String(input.weapon_id ?? "").trim();
  const weapon = object(object(worldState.objects)[weaponId]);
  const ammo = object(weapon.ammo);
  const direct = finiteNumber(weapon.ammo_current);
  const nested = finiteNumber(ammo.current);
  const field = direct !== null ? "ammo_current" : nested !== null ? "ammo.current" : null;
  const current = direct ?? nested;
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_ammo_consumption",
    context: {
      weapon_id: weaponId,
      ammo_field: field,
      ammo_current: current,
      time_ms: finiteNumber(input.time_ms),
    },
    evaluate: (context) => {
      if (!context.ammo_field || context.ammo_current === null) {
        return { mutation_proposals: [], ok: true, remaining: null, unlimited_or_untracked: true };
      }
      if (context.ammo_current <= 0) {
        return { mutation_proposals: [], ok: false, remaining: context.ammo_current, unlimited_or_untracked: false };
      }
      const remaining = context.ammo_current - 1;
      const proposal = transition(
        context.weapon_id,
        context.ammo_field,
        context.ammo_current,
        remaining,
        "programmatic projectile launch consumed one round",
        context.time_ms,
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        remaining,
        unlimited_or_untracked: false,
      };
    },
  });
}

export function evaluateWorldSimulationAbilityEnergyConsumption(input = {}) {
  const worldState = object(input.world_state);
  const actor = String(input.actor ?? "").trim();
  const abilityId = String(input.ability_id ?? "").trim();
  const energy = energyRecord(object(object(worldState.characters)[actor]));
  const energyCost = nonNegativeNumber(input.energy_cost, 0);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "ability_energy_consumption",
    context: {
      actor,
      ability_id: abilityId,
      energy_path: energy?.path ?? null,
      energy_before: energy?.value ?? null,
      energy_cost: energyCost,
      time_ms: finiteNumber(input.time_ms),
    },
    evaluate: (context) => {
      if (context.energy_cost <= 0) {
        return { mutation_proposals: [], ok: true, remaining: context.energy_before, cost: 0 };
      }
      if (!context.energy_path || context.energy_before === null || context.energy_before < context.energy_cost) {
        return { mutation_proposals: [], ok: false, remaining: context.energy_before, cost: context.energy_cost };
      }
      const remaining = context.energy_before - context.energy_cost;
      const proposal = transition(
        context.actor,
        context.energy_path,
        context.energy_before,
        remaining,
        `ability ${context.ability_id} activation consumed world-state energy cost`,
        context.time_ms,
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        remaining,
        cost: context.energy_cost,
        energy_path: context.energy_path,
      };
    },
  });
}

export function evaluateWorldSimulationProjectileSpawn(input = {}) {
  const worldState = object(input.world_state);
  const projectileId = String(input.projectile_id ?? input.projectile?.projectile_id ?? "").trim();
  const projectile = cloneJson(object(input.projectile));
  const existing = Object.hasOwn(object(worldState.projectiles), projectileId)
    ? cloneJson(worldState.projectiles[projectileId])
    : null;
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_spawn",
    context: {
      projectile_id: projectileId,
      projectile,
      existing_projectile: existing,
      weapon_id: String(input.weapon_id ?? projectile.weapon_id ?? "").trim() || null,
      time_ms: finiteNumber(input.time_ms),
    },
    evaluate: (context) => {
      if (!context.projectile_id || !Object.keys(object(context.projectile)).length) {
        return { mutation_proposals: [], ok: false, reason: "projectile spawn requires id and projectile state" };
      }
      if (context.existing_projectile !== null) {
        return { mutation_proposals: [], ok: false, reason: `projectile ${context.projectile_id} already exists` };
      }
      const proposal = transition(
        context.projectile_id,
        "projectile",
        null,
        context.projectile,
        `projectile spawned from world-state weapon profile ${context.weapon_id ?? "<unknown>"}`,
        context.time_ms,
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        projectile_id: context.projectile_id,
      };
    },
  });
}

export function evaluateWorldSimulationCoverStructuralImpact(input = {}) {
  const worldState = object(input.world_state);
  const sceneId = String(input.scene_id ?? "").trim();
  const obstacleId = String(input.obstacle_id ?? "").trim();
  const projectileId = String(input.projectile_id ?? "").trim();
  const record = obstacleRecord(worldState, sceneId, obstacleId);
  const obstacle = object(record?.obstacle);
  const resistance = obstacleResistance(obstacle);
  const beforeEnergy = nonNegativeNumber(input.penetration_energy, 0);
  const beforeIntegrity = obstacleIntegrity(obstacle);
  const beforeDestroyed = obstacle.destroyed === true;
  const beforePassable = obstacle.passable === true;
  const beforeCollisionEnabled = obstacle.collision_enabled !== false;
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_cover_structural_impact",
    context: {
      scene_id: sceneId,
      obstacle_id: obstacleId,
      projectile_id: projectileId,
      obstacle_found: Boolean(record),
      resistance,
      penetration_energy_before: beforeEnergy,
      integrity_before: beforeIntegrity,
      destroyed_before: beforeDestroyed,
      passable_before: beforePassable,
      collision_enabled_before: beforeCollisionEnabled,
      time_ms: finiteNumber(input.time_ms),
    },
    evaluate: (context) => {
      if (!context.obstacle_found) {
        return { mutation_proposals: [], ok: false, reason: `obstacle ${context.obstacle_id} does not exist` };
      }
      const structuralDamage = context.integrity_before === null
        ? 0
        : Math.min(context.integrity_before, context.penetration_energy_before);
      const integrityAfter = context.integrity_before === null
        ? null
        : Math.max(0, context.integrity_before - structuralDamage);
      const destroyed = context.destroyed_before || (integrityAfter !== null && integrityAfter <= 0 && structuralDamage > 0);
      const proposals = [];
      if (context.integrity_before !== null && structuralDamage > 0) {
        proposals.push(transition(
          context.obstacle_id,
          "integrity_current",
          context.integrity_before,
          integrityAfter,
          `projectile ${context.projectile_id} transferred structural energy to cover`,
          context.time_ms,
          { scene_id: context.scene_id },
        ));
      }
      if (destroyed && !context.destroyed_before) {
        proposals.push(transition(
          context.obstacle_id,
          "destroyed",
          false,
          true,
          `projectile ${context.projectile_id} destroyed scene obstacle`,
          context.time_ms,
          { scene_id: context.scene_id },
        ));
      }
      if (destroyed && !context.passable_before) {
        proposals.push(transition(
          context.obstacle_id,
          "passable",
          false,
          true,
          `projectile ${context.projectile_id} made destroyed obstacle passable`,
          context.time_ms,
          { scene_id: context.scene_id },
        ));
      }
      if (destroyed && context.collision_enabled_before) {
        proposals.push(transition(
          context.obstacle_id,
          "collision_enabled",
          true,
          false,
          `projectile ${context.projectile_id} disabled destroyed obstacle collision`,
          context.time_ms,
          { scene_id: context.scene_id },
        ));
      }
      return {
        mutation_proposals: proposals.filter(Boolean),
        ok: true,
        resistance: context.resistance,
        beforeEnergy: context.penetration_energy_before,
        penetrated: context.penetration_energy_before > context.resistance,
        destroyed,
        structuralDamage,
        integrity_before: context.integrity_before,
        integrity_after: integrityAfter,
      };
    },
  });
}

export function projectWorldSimulationImmutablePhysicsEffectProposals(input = {}) {
  return projectWorldSimulationImmutableEvaluatorProposals(input);
}

export function buildWorldSimulationImmutablePhysicsEffectContract() {
  return {
    version: worldSimulationImmutablePhysicsEffectVersion,
    foundation_evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    owner: "programmatic_immutable_physics_effect_evaluation",
    migrated_effect_evaluators: [
      "projectile_ammo_consumption",
      "ability_energy_consumption",
      "projectile_spawn",
      "projectile_cover_structural_impact",
    ],
    guarantees: {
      relevant_input_snapshot_is_frozen_before_effect_evaluation: true,
      evaluator_outputs_world_state: false,
      state_change_expressed_as_mutation_proposals: true,
      identical_inputs_are_determinism_checked: true,
      private_preview_projection_is_mechanical_and_noncausal: true,
    },
    character_brain_may_decide_resource_or_topology_mutation_values: false,
    known_boundary: "Phase62O migrates projectile ammo consumption, ability energy consumption, projectile spawn, and cover structural impact into immutable deterministic effect evaluators. Projectile flight-state evolution and ability-field lifecycle advancement still use isolated mutable solver previews behind the pure proposal boundary.",
  };
}
