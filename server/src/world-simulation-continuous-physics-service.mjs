import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  applyWorldSimulationCombatImpact,
} from "./world-simulation-combat-causal-service.mjs";

export const worldSimulationContinuousPhysicsVersion = "phase62f-continuous-physics-v1";

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

function positiveNumber(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function point(value) {
  const item = object(value);
  const x = finiteNumber(item.x);
  const y = finiteNumber(item.y);
  return x === null || y === null ? null : { x, y };
}

function vector(value) {
  const item = object(value);
  const x = finiteNumber(item.x ?? item.dx);
  const y = finiteNumber(item.y ?? item.dy);
  return x === null || y === null ? null : { x, y };
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeVector(from, to) {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-12) return null;
  return { x: dx / length, y: dy / length };
}

function parseDurationMs(candidate, fallbackMs = 0) {
  const directMs = finiteNumber(candidate.duration_ms);
  if (directMs !== null && directMs >= 0) return directMs;
  const directSeconds = finiteNumber(candidate.duration_s ?? candidate.duration_seconds);
  if (directSeconds !== null && directSeconds >= 0) return directSeconds * 1000;
  const raw = candidate.duration_estimate ?? candidate.duration ?? null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw * 1000;
  if (typeof raw === "string") {
    const match = raw.trim().toLowerCase().match(/^([0-9]+(?:\.[0-9]+)?)\s*(ms|s|sec|secs|second|seconds)$/);
    if (match) return match[2] === "ms" ? Number(match[1]) : Number(match[1]) * 1000;
  }
  return fallbackMs;
}

function pushOutcome(outcomes, actor, candidate, result, causalEvidence, extra = {}) {
  outcomes.push({
    actor: actor || null,
    action_id: candidate?.action_id ?? null,
    action: candidate?.intent ?? null,
    result,
    causal_evidence: causalEvidence,
    adjudication: "programmatic_continuous_physics",
    continuous_physics_version: worldSimulationContinuousPhysicsVersion,
    ...extra,
  });
}

function pushTransition(transitions, entity, field, from, to, cause, extra = {}) {
  if (JSON.stringify(from) === JSON.stringify(to)) return;
  transitions.push({
    entity,
    field,
    from: cloneJson(from),
    to: cloneJson(to),
    cause,
    adjudication: "programmatic_continuous_physics",
    ...extra,
  });
}

function scenePosition(scene, entity) {
  return point(object(scene.entity_positions)[entity]);
}

function movementOutcomeFor(outcomes, character, actionId) {
  return array(outcomes).find((item) => (
    String(item?.actor ?? "") === character
    && String(item?.action_id ?? "") === String(actionId ?? "")
    && item?.result === "movement_completed"
  )) ?? null;
}

function selectedCandidateFor(selectedActionIntents, character) {
  const found = array(selectedActionIntents).find((item) => String(item?.character ?? "") === character);
  return found ? object(found.candidate) : {};
}

function movementProfile(snapshotScene, nextScene, selectedActionIntents, outcomes, character) {
  const start = scenePosition(snapshotScene, character);
  if (!start) return null;
  const candidate = selectedCandidateFor(selectedActionIntents, character);
  const movement = object(candidate.movement);
  const outcome = movementOutcomeFor(outcomes, character, candidate.action_id);
  const end = outcome ? scenePosition(nextScene, character) : start;
  const durationMs = outcome ? positiveNumber(outcome.duration_ms, 1) : 0;
  return { start, end: end ?? start, durationMs };
}

function positionAt(profile, timeMs) {
  if (!profile) return null;
  if (profile.durationMs <= 0) return profile.start;
  const ratio = Math.min(1, Math.max(0, timeMs / profile.durationMs));
  return {
    x: profile.start.x + (profile.end.x - profile.start.x) * ratio,
    y: profile.start.y + (profile.end.y - profile.start.y) * ratio,
  };
}

function velocityDuring(profile, timeMs) {
  if (!profile || profile.durationMs <= 0 || timeMs >= profile.durationMs) return { x: 0, y: 0 };
  const seconds = profile.durationMs / 1000;
  return {
    x: (profile.end.x - profile.start.x) / seconds,
    y: (profile.end.y - profile.start.y) / seconds,
  };
}

function solveCircleContact(relativePosition, relativeVelocity, radius, maxSeconds) {
  const c = relativePosition.x ** 2 + relativePosition.y ** 2 - radius ** 2;
  if (c <= 0) return 0;
  const a = relativeVelocity.x ** 2 + relativeVelocity.y ** 2;
  if (a <= 1e-12) return null;
  const b = 2 * (relativePosition.x * relativeVelocity.x + relativePosition.y * relativeVelocity.y);
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((value) => value >= -1e-9 && value <= maxSeconds + 1e-9)
    .sort((left, right) => left - right);
  return candidates.length ? Math.max(0, candidates[0]) : null;
}

function movingCharacterContact(projectile, profile, startMs, endMs, targetRadius) {
  const projectileRadius = positiveNumber(projectile.radius_m, 0.05);
  const radius = projectileRadius + targetRadius;
  const boundaries = [startMs, endMs];
  if (profile?.durationMs > startMs && profile.durationMs < endMs) boundaries.push(profile.durationMs);
  boundaries.sort((a, b) => a - b);
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStartMs = boundaries[index];
    const segmentEndMs = boundaries[index + 1];
    const seconds = (segmentEndMs - segmentStartMs) / 1000;
    if (seconds <= 0) continue;
    const projectileStart = {
      x: projectile.position.x + projectile.velocity_mps.x * ((segmentStartMs - startMs) / 1000),
      y: projectile.position.y + projectile.velocity_mps.y * ((segmentStartMs - startMs) / 1000),
    };
    const targetStart = positionAt(profile, segmentStartMs);
    if (!targetStart) continue;
    const targetVelocity = velocityDuring(profile, segmentStartMs);
    const relativePosition = {
      x: projectileStart.x - targetStart.x,
      y: projectileStart.y - targetStart.y,
    };
    const relativeVelocity = {
      x: projectile.velocity_mps.x - targetVelocity.x,
      y: projectile.velocity_mps.y - targetVelocity.y,
    };
    const contactSeconds = solveCircleContact(relativePosition, relativeVelocity, radius, seconds);
    if (contactSeconds !== null) return segmentStartMs + contactSeconds * 1000;
  }
  return null;
}

function rectangleForObstacle(raw, expansion = 0) {
  const obstacle = object(raw);
  const xMin = finiteNumber(obstacle.x_min ?? obstacle.left);
  const xMax = finiteNumber(obstacle.x_max ?? obstacle.right);
  const yMin = finiteNumber(obstacle.y_min ?? obstacle.top);
  const yMax = finiteNumber(obstacle.y_max ?? obstacle.bottom);
  if ([xMin, xMax, yMin, yMax].every((item) => item !== null)) {
    return {
      xMin: Math.min(xMin, xMax) - expansion,
      xMax: Math.max(xMin, xMax) + expansion,
      yMin: Math.min(yMin, yMax) - expansion,
      yMax: Math.max(yMin, yMax) + expansion,
    };
  }
  const center = point(obstacle.position ?? obstacle.center);
  const width = finiteNumber(obstacle.width_m ?? obstacle.width);
  const depth = finiteNumber(obstacle.depth_m ?? obstacle.depth ?? obstacle.height_m ?? obstacle.height);
  if (!center || width === null || depth === null) return null;
  return {
    xMin: center.x - width / 2 - expansion,
    xMax: center.x + width / 2 + expansion,
    yMin: center.y - depth / 2 - expansion,
    yMax: center.y + depth / 2 + expansion,
  };
}

function segmentRectangleEntry(from, to, rectangle) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, from.x - rectangle.xMin],
    [dx, rectangle.xMax - from.x],
    [-dy, from.y - rectangle.yMin],
    [dy, rectangle.yMax - from.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) <= 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return null;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return null;
      if (ratio < t1) t1 = ratio;
    }
  }
  return t0 <= t1 ? Math.max(0, t0) : null;
}

function sceneBoundsExitTime(scene, projectile, startMs, endMs) {
  const dimensions = object(scene.dimensions);
  const width = positiveNumber(dimensions.width_m ?? dimensions.width, Number.POSITIVE_INFINITY);
  const depth = positiveNumber(dimensions.depth_m ?? dimensions.depth, Number.POSITIVE_INFINITY);
  const seconds = (endMs - startMs) / 1000;
  const end = {
    x: projectile.position.x + projectile.velocity_mps.x * seconds,
    y: projectile.position.y + projectile.velocity_mps.y * seconds,
  };
  if (end.x >= 0 && end.y >= 0 && end.x <= width && end.y <= depth) return null;
  const rect = { xMin: 0, xMax: width, yMin: 0, yMax: depth };
  const dx = end.x - projectile.position.x;
  const dy = end.y - projectile.position.y;
  const candidates = [];
  if (dx > 0 && Number.isFinite(width)) candidates.push((width - projectile.position.x) / dx);
  if (dx < 0) candidates.push((0 - projectile.position.x) / dx);
  if (dy > 0 && Number.isFinite(depth)) candidates.push((depth - projectile.position.y) / dy);
  if (dy < 0) candidates.push((0 - projectile.position.y) / dy);
  const t = candidates.filter((value) => value >= 0 && value <= 1).sort((a, b) => a - b)[0];
  if (t === undefined) return null;
  void rect;
  return startMs + t * (endMs - startMs);
}

function characterRadius(worldState, character, rules) {
  const state = object(object(worldState.characters)[character]);
  return positiveNumber(
    object(state.combat_profile).collision_radius_m ?? state.collision_radius_m,
    positiveNumber(rules.combat_target_radius_m ?? rules.collision_radius_m, 0.3),
  );
}

function characterNamesInScene(scene, worldState) {
  const characterNames = new Set(Object.keys(object(worldState.characters)));
  return Object.keys(object(scene.entity_positions)).filter((name) => characterNames.has(name));
}

function energyRecord(character) {
  const physical = object(character.physical_state);
  if (finiteNumber(physical.energy_current) !== null) {
    return { container: physical, field: "energy_current", value: finiteNumber(physical.energy_current, 0), path: "physical_state.energy_current" };
  }
  const resources = object(character.resources);
  const energy = object(resources.energy);
  if (finiteNumber(energy.current) !== null) {
    return { container: energy, field: "current", value: finiteNumber(energy.current, 0), path: "resources.energy.current" };
  }
  if (finiteNumber(character.energy_current) !== null) {
    return { container: character, field: "energy_current", value: finiteNumber(character.energy_current, 0), path: "energy_current" };
  }
  return null;
}

function abilityProfile(worldState, actor, abilityId) {
  const character = object(object(worldState.characters)[actor]);
  return object(object(character.abilities)[abilityId]);
}

function weaponProjectileProfile(worldState, actor, intent) {
  const weaponId = String(intent.weapon_id ?? "").trim();
  if (!weaponId) return { ok: false, reason: "projectile intent requires weapon_id" };
  const weapon = object(object(worldState.objects)[weaponId]);
  if (!Object.keys(weapon).length) return { ok: false, reason: `projectile weapon ${weaponId} does not exist` };
  if (weapon.holder !== actor) return { ok: false, reason: `${actor} does not hold projectile weapon ${weaponId}` };
  if (weapon.enabled === false || weapon.broken === true || weapon.state === "broken") {
    return { ok: false, reason: `projectile weapon ${weaponId} is unusable` };
  }
  const profile = object(weapon.projectile ?? object(weapon.combat).projectile);
  const speed = positiveNumber(profile.speed_mps ?? profile.muzzle_velocity_mps, null);
  if (!speed) return { ok: false, reason: `projectile weapon ${weaponId} has no positive projectile speed` };
  return {
    ok: true,
    weaponId,
    weapon,
    profile,
    speed,
    radius: positiveNumber(profile.radius_m, 0.05),
    damage: nonNegativeNumber(profile.base_damage ?? profile.damage, 0),
    damageType: String(profile.damage_type ?? "projectile_impact"),
    penetrationEnergy: nonNegativeNumber(profile.penetration_energy ?? profile.kinetic_energy, 0),
    maxLifetimeMs: positiveNumber(profile.max_lifetime_ms, 5000),
  };
}

function consumeAmmo(nextWorldState, weaponId, transitions) {
  const weapon = object(object(nextWorldState.objects)[weaponId]);
  const ammo = object(weapon.ammo);
  const direct = finiteNumber(weapon.ammo_current);
  const nested = finiteNumber(ammo.current);
  if (direct === null && nested === null) return { ok: true, remaining: null };
  const current = direct ?? nested;
  if (current <= 0) return { ok: false, remaining: current };
  if (direct !== null) {
    weapon.ammo_current = current - 1;
    pushTransition(transitions, weaponId, "ammo_current", current, current - 1, "programmatic projectile launch consumed one round");
  } else {
    weapon.ammo = ammo;
    ammo.current = current - 1;
    pushTransition(transitions, weaponId, "ammo.current", current, current - 1, "programmatic projectile launch consumed one round");
  }
  nextWorldState.objects[weaponId] = weapon;
  return { ok: true, remaining: current - 1 };
}

function spawnProjectiles(input, nextWorldState, snapshotScene, transitions, outcomes) {
  const spawned = [];
  const selectedActionIntents = array(input.selected_action_intents);
  nextWorldState.projectiles = object(nextWorldState.projectiles);
  for (const selected of selectedActionIntents) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const intent = object(candidate.projectile);
    if (!actor || !Object.keys(intent).length) continue;
    const profile = weaponProjectileProfile(input.world_state, actor, intent);
    if (!profile.ok) {
      pushOutcome(outcomes, actor, candidate, "projectile_launch_blocked", profile.reason, { projectile_resolved: false });
      continue;
    }
    const ammo = consumeAmmo(nextWorldState, profile.weaponId, transitions);
    if (!ammo.ok) {
      pushOutcome(outcomes, actor, candidate, "projectile_launch_blocked", `projectile weapon ${profile.weaponId} has no ammunition`, { projectile_resolved: false });
      continue;
    }
    const origin = scenePosition(snapshotScene, actor);
    const targetCharacter = String(intent.target_character ?? intent.target ?? candidate.target ?? "").trim();
    const targetPosition = targetCharacter ? scenePosition(snapshotScene, targetCharacter) : null;
    const aimPoint = point(intent.aim_point ?? intent.target_point) ?? targetPosition;
    const direction = normalizeVector(origin, aimPoint);
    if (!origin || !direction) {
      pushOutcome(outcomes, actor, candidate, "projectile_launch_blocked", "projectile launch requires actor position and a non-zero aim direction", { projectile_resolved: false });
      continue;
    }
    const fireDelayMs = nonNegativeNumber(intent.fire_delay_ms, 0);
    const projectileId = `projectile_${hashAgentRunValue({
      owner: actor,
      action_id: candidate.action_id ?? null,
      turn_id: input.turn_id ?? null,
      origin,
      target: targetCharacter || aimPoint,
    }).slice(0, 20)}`;
    const projectile = {
      projectile_id: projectileId,
      owner: actor,
      source_action_id: candidate.action_id ?? null,
      weapon_id: profile.weaponId,
      scene_id: input.scene_id,
      position: cloneJson(origin),
      velocity_mps: { x: direction.x * profile.speed, y: direction.y * profile.speed },
      radius_m: profile.radius,
      base_damage: profile.damage,
      damage_type: profile.damageType,
      initial_penetration_energy: profile.penetrationEnergy,
      remaining_penetration_energy: profile.penetrationEnergy,
      max_lifetime_ms: profile.maxLifetimeMs,
      age_ms: 0,
      active: true,
      fire_delay_ms: fireDelayMs,
      target_character: targetCharacter || null,
      penetrated_obstacles: [],
    };
    nextWorldState.projectiles[projectileId] = projectile;
    spawned.push({ projectileId, projectile, actor, candidate, activeAfterMs: fireDelayMs });
    pushTransition(transitions, projectileId, "projectile", null, projectile, `projectile spawned from world-state weapon profile ${profile.weaponId}`);
    pushOutcome(outcomes, actor, candidate, "projectile_spawned", `projectile ${projectileId} spawned from ${profile.weaponId}; speed/damage/penetration came from world state`, {
      projectile_id: projectileId,
      projectile_resolved: false,
      ammo_remaining: ammo.remaining,
    });
  }
  return spawned;
}

function spawnAbilityFields(input, nextWorldState, snapshotScene, transitions, outcomes) {
  const spawned = [];
  nextWorldState.ability_fields = object(nextWorldState.ability_fields);
  nextWorldState.characters = object(nextWorldState.characters);
  for (const selected of array(input.selected_action_intents)) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const intent = object(candidate.ability);
    if (!actor || !Object.keys(intent).length) continue;
    const abilityId = String(intent.ability_id ?? intent.id ?? "").trim();
    const profile = abilityProfile(input.world_state, actor, abilityId);
    const fieldProfile = object(profile.field ?? profile.area_effect);
    if (!abilityId || !Object.keys(profile).length || profile.enabled === false || profile.available === false) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId || "<missing>"} is unavailable in world state`);
      continue;
    }
    if (!Object.keys(fieldProfile).length) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} has no world-state field profile`);
      continue;
    }
    const currentCharacter = object(nextWorldState.characters[actor]);
    const energy = energyRecord(currentCharacter);
    const energyCost = nonNegativeNumber(profile.energy_cost ?? fieldProfile.energy_cost, 0);
    if (energyCost > 0 && (!energy || energy.value < energyCost)) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} requires ${energyCost} energy but current world state is insufficient`);
      continue;
    }
    if (energy && energyCost > 0) {
      const before = energy.value;
      energy.container[energy.field] = before - energyCost;
      pushTransition(transitions, actor, energy.path, before, before - energyCost, `ability ${abilityId} activation consumed world-state energy cost`);
    }
    const origin = scenePosition(snapshotScene, actor);
    const center = point(intent.center ?? intent.target_point) ?? origin;
    if (!center) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} requires an actor or target position`);
      continue;
    }
    const radiusM = positiveNumber(fieldProfile.radius_m, null);
    const durationMs = positiveNumber(fieldProfile.duration_ms, null);
    if (!radiusM || !durationMs) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} field radius/duration must exist in world state`);
      continue;
    }
    const startDelayMs = nonNegativeNumber(intent.start_delay_ms, 0);
    const fieldId = `field_${hashAgentRunValue({
      actor,
      ability_id: abilityId,
      action_id: candidate.action_id ?? null,
      turn_id: input.turn_id ?? null,
      center,
    }).slice(0, 20)}`;
    const field = {
      field_id: fieldId,
      owner: actor,
      ability_id: abilityId,
      source_action_id: candidate.action_id ?? null,
      scene_id: input.scene_id,
      center: cloneJson(center),
      radius_m: radiusM,
      remaining_ms: durationMs,
      active: true,
      affects_owner: fieldProfile.affects_owner === true,
      effect: {
        damage_per_second: nonNegativeNumber(fieldProfile.damage_per_second ?? fieldProfile.dps, 0),
        damage_type: String(fieldProfile.damage_type ?? "ability_field"),
        penetration: nonNegativeNumber(fieldProfile.penetration, 0),
        ignore_armor: fieldProfile.ignore_armor === true,
      },
      start_delay_ms: startDelayMs,
    };
    nextWorldState.ability_fields[fieldId] = field;
    spawned.push({ fieldId, field, actor, candidate, activeAfterMs: startDelayMs });
    pushTransition(transitions, fieldId, "ability_field", null, field, `ability ${abilityId} created persistent programmatic field`);
    pushOutcome(outcomes, actor, candidate, "ability_field_created", `ability ${abilityId} created field ${fieldId}; radius/duration/effect came from world state`, {
      ability_field_id: fieldId,
      energy_cost: energyCost,
    });
  }
  return spawned;
}

function obstacleEntry(scene, projectile, startMs, endMs) {
  const durationSeconds = (endMs - startMs) / 1000;
  const end = {
    x: projectile.position.x + projectile.velocity_mps.x * durationSeconds,
    y: projectile.position.y + projectile.velocity_mps.y * durationSeconds,
  };
  let best = null;
  for (let index = 0; index < array(scene.obstacles).length; index += 1) {
    const obstacle = object(scene.obstacles[index]);
    const obstacleId = String(obstacle.id ?? obstacle.obstacle_id ?? `obstacle_${index}`);
    if (obstacle.destroyed === true || obstacle.passable === true || obstacle.collision_enabled === false) continue;
    if (array(projectile.penetrated_obstacles).includes(obstacleId)) continue;
    const rectangle = rectangleForObstacle(obstacle, positiveNumber(projectile.radius_m, 0.05));
    if (!rectangle) continue;
    const fraction = segmentRectangleEntry(projectile.position, end, rectangle);
    if (fraction === null) continue;
    const timeMs = startMs + fraction * (endMs - startMs);
    if (!best || timeMs < best.timeMs) best = { index, obstacleId, obstacle, timeMs };
  }
  return best;
}

function characterEntry(input, projectile, startMs, endMs, snapshotScene, nextScene) {
  let best = null;
  const rules = object(input.world_state.world_rules ?? input.world_state.rules);
  for (const character of characterNamesInScene(snapshotScene, input.world_state)) {
    if (character === projectile.owner) continue;
    const profile = movementProfile(
      snapshotScene,
      nextScene,
      input.selected_action_intents,
      input.resolved_action_outcomes,
      character,
    );
    if (!profile) continue;
    const contactTimeMs = movingCharacterContact(
      projectile,
      profile,
      startMs,
      endMs,
      characterRadius(input.world_state, character, rules),
    );
    if (contactTimeMs === null) continue;
    if (!best || contactTimeMs < best.timeMs) best = { character, timeMs: contactTimeMs, profile };
  }
  return best;
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

function updateObstacleAfterImpact(nextScene, collision, projectile, transitions) {
  nextScene.obstacles = array(nextScene.obstacles);
  const current = object(nextScene.obstacles[collision.index]);
  const resistance = obstacleResistance(current);
  const beforeEnergy = nonNegativeNumber(projectile.remaining_penetration_energy, 0);
  const beforeIntegrity = obstacleIntegrity(current);
  const structuralDamage = beforeIntegrity === null ? 0 : Math.min(beforeIntegrity, beforeEnergy);
  let destroyed = current.destroyed === true;
  if (beforeIntegrity !== null && structuralDamage > 0) {
    const afterIntegrity = Math.max(0, beforeIntegrity - structuralDamage);
    current.integrity_current = afterIntegrity;
    pushTransition(transitions, collision.obstacleId, "integrity_current", beforeIntegrity, afterIntegrity, `projectile ${projectile.projectile_id} transferred structural energy to cover`);
    if (afterIntegrity <= 0) {
      destroyed = true;
      current.destroyed = true;
      current.passable = true;
      current.collision_enabled = false;
      pushTransition(transitions, collision.obstacleId, "destroyed", false, true, `projectile ${projectile.projectile_id} destroyed scene obstacle`);
    }
  }
  nextScene.obstacles[collision.index] = current;
  const penetrated = beforeEnergy > resistance;
  return { resistance, beforeEnergy, penetrated, destroyed, structuralDamage };
}

function projectilePositionAt(projectile, deltaMs) {
  return {
    x: projectile.position.x + projectile.velocity_mps.x * (deltaMs / 1000),
    y: projectile.position.y + projectile.velocity_mps.y * (deltaMs / 1000),
  };
}

function resolveProjectile(input, projectile, activeStartMs, activeEndMs, nextWorldState, snapshotScene, nextScene, transitions, outcomes, resolutions) {
  let currentTimeMs = activeStartMs;
  let loops = 0;
  while (projectile.active === true && currentTimeMs < activeEndMs - 1e-6 && loops < 32) {
    loops += 1;
    const ageRemaining = Math.max(0, positiveNumber(projectile.max_lifetime_ms, 5000) - nonNegativeNumber(projectile.age_ms, 0));
    const windowEndMs = Math.min(activeEndMs, currentTimeMs + ageRemaining);
    if (windowEndMs <= currentTimeMs + 1e-9) {
      projectile.active = false;
      projectile.termination_reason = "lifetime_expired";
      break;
    }
    const obstacle = obstacleEntry(nextScene, projectile, currentTimeMs, windowEndMs);
    const character = characterEntry(input, projectile, currentTimeMs, windowEndMs, snapshotScene, nextScene);
    const boundsTime = sceneBoundsExitTime(nextScene, projectile, currentTimeMs, windowEndMs);
    const events = [
      obstacle ? { kind: "obstacle", ...obstacle } : null,
      character ? { kind: "character", ...character } : null,
      boundsTime !== null ? { kind: "bounds", timeMs: boundsTime } : null,
    ].filter(Boolean).sort((a, b) => a.timeMs - b.timeMs || a.kind.localeCompare(b.kind));
    const event = events[0] ?? null;
    const stopTimeMs = event ? event.timeMs : windowEndMs;
    const travelMs = Math.max(0, stopTimeMs - currentTimeMs);
    projectile.position = projectilePositionAt(projectile, travelMs);
    projectile.age_ms = nonNegativeNumber(projectile.age_ms, 0) + travelMs;
    currentTimeMs = stopTimeMs;

    if (!event) break;
    if (event.kind === "bounds") {
      projectile.active = false;
      projectile.termination_reason = "left_scene_bounds";
      resolutions.push({ projectile_id: projectile.projectile_id, result: "left_scene_bounds", time_ms: currentTimeMs, position: cloneJson(projectile.position) });
      break;
    }
    if (event.kind === "obstacle") {
      const impact = updateObstacleAfterImpact(nextScene, event, projectile, transitions);
      if (impact.penetrated) {
        projectile.remaining_penetration_energy = Math.max(0, impact.beforeEnergy - impact.resistance);
        projectile.penetrated_obstacles = [...array(projectile.penetrated_obstacles), event.obstacleId];
        resolutions.push({
          projectile_id: projectile.projectile_id,
          result: "projectile_penetrated_cover",
          obstacle_id: event.obstacleId,
          time_ms: currentTimeMs,
          remaining_penetration_energy: projectile.remaining_penetration_energy,
          cover_destroyed: impact.destroyed,
        });
        pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_penetrated_cover", `projectile energy ${impact.beforeEnergy.toFixed(3)} exceeded cover resistance ${impact.resistance.toFixed(3)}`, {
          projectile_id: projectile.projectile_id,
          obstacle_id: event.obstacleId,
          remaining_penetration_energy: projectile.remaining_penetration_energy,
          cover_destroyed: impact.destroyed,
        });
        const epsilonMs = 0.01;
        projectile.position = projectilePositionAt(projectile, epsilonMs);
        projectile.age_ms += epsilonMs;
        currentTimeMs += epsilonMs;
        continue;
      }
      projectile.active = false;
      projectile.termination_reason = "stopped_by_cover";
      projectile.remaining_penetration_energy = 0;
      resolutions.push({ projectile_id: projectile.projectile_id, result: "projectile_stopped_by_cover", obstacle_id: event.obstacleId, time_ms: currentTimeMs });
      pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_stopped_by_cover", `cover resistance ${impact.resistance} was not exceeded by projectile energy ${impact.beforeEnergy}`, {
        projectile_id: projectile.projectile_id,
        obstacle_id: event.obstacleId,
        cover_destroyed: impact.destroyed,
      });
      break;
    }
    if (event.kind === "character") {
      const initialEnergy = nonNegativeNumber(projectile.initial_penetration_energy, 0);
      const energyRatio = initialEnergy > 0
        ? Math.min(1, Math.max(0, nonNegativeNumber(projectile.remaining_penetration_energy, 0) / initialEnergy))
        : 1;
      const baseDamage = nonNegativeNumber(projectile.base_damage, 0) * energyRatio;
      const impact = applyWorldSimulationCombatImpact({
        world_state: input.world_state,
        next_world_state: nextWorldState,
        target: event.character,
        hit_region: "torso",
        base_damage: baseDamage,
        penetration: nonNegativeNumber(projectile.remaining_penetration_energy, 0),
        damage_type: projectile.damage_type,
        source: projectile.projectile_id,
        state_transitions: transitions,
      });
      projectile.active = false;
      projectile.termination_reason = "character_contact";
      projectile.remaining_penetration_energy = 0;
      resolutions.push({
        projectile_id: projectile.projectile_id,
        result: "projectile_hit_character",
        target: event.character,
        time_ms: currentTimeMs,
        damage_applied: impact.damage_applied,
      });
      pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_hit_character", `continuous relative-motion collision occurred at ${currentTimeMs.toFixed(3)}ms`, {
        projectile_id: projectile.projectile_id,
        target: event.character,
        hit: true,
        contact_resolved: true,
        damage_applied: impact.damage_applied,
        health_before: impact.health_before,
        health_after: impact.health_after,
        injury_severity: impact.injury_severity,
      });
      break;
    }
  }
  if (loops >= 32 && projectile.active === true) {
    projectile.active = false;
    projectile.termination_reason = "physics_iteration_guard";
  }
}

function timeInsideStaticCircle(profile, center, radius, startMs, endMs) {
  if (!profile || endMs <= startMs) return 0;
  const boundaries = [startMs, endMs];
  if (profile.durationMs > startMs && profile.durationMs < endMs) boundaries.push(profile.durationMs);
  boundaries.sort((a, b) => a - b);
  let insideMs = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const aMs = boundaries[index];
    const bMs = boundaries[index + 1];
    const durationMs = bMs - aMs;
    if (durationMs <= 0) continue;
    const start = positionAt(profile, aMs);
    const end = positionAt(profile, bMs);
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const fx = start.x - center.x;
    const fy = start.y - center.y;
    const qa = dx * dx + dy * dy;
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - radius * radius;
    if (qa <= 1e-12) {
      if (qc <= 0) insideMs += durationMs;
      continue;
    }
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant < 0) {
      if (qc <= 0) insideMs += durationMs;
      continue;
    }
    const root = Math.sqrt(discriminant);
    const r1 = (-qb - root) / (2 * qa);
    const r2 = (-qb + root) / (2 * qa);
    const enter = Math.max(0, Math.min(r1, r2));
    const exit = Math.min(1, Math.max(r1, r2));
    if (exit > enter) insideMs += durationMs * (exit - enter);
    else if (qc <= 0) insideMs += durationMs;
  }
  return insideMs;
}

function resolveAbilityFields(input, newFields, nextWorldState, snapshotScene, nextScene, elapsedMs, transitions, outcomes, resolutions) {
  nextWorldState.ability_fields = object(nextWorldState.ability_fields);
  const newStart = new Map(newFields.map((item) => [item.fieldId, item.activeAfterMs]));
  const rules = object(input.world_state.world_rules ?? input.world_state.rules);
  for (const [fieldId, rawField] of Object.entries(nextWorldState.ability_fields)) {
    const field = object(rawField);
    if (field.active !== true || String(field.scene_id ?? "") !== input.scene_id) continue;
    const startMs = newStart.has(fieldId) ? newStart.get(fieldId) : 0;
    const availableMs = Math.max(0, elapsedMs - startMs);
    const activeMs = Math.min(nonNegativeNumber(field.remaining_ms, 0), availableMs);
    if (activeMs <= 0) continue;
    const center = point(field.center);
    const radius = positiveNumber(field.radius_m, null);
    if (!center || !radius) continue;
    const effect = object(field.effect);
    const dps = nonNegativeNumber(effect.damage_per_second, 0);
    for (const character of characterNamesInScene(snapshotScene, input.world_state)) {
      if (character === field.owner && field.affects_owner !== true) continue;
      const profile = movementProfile(snapshotScene, nextScene, input.selected_action_intents, input.resolved_action_outcomes, character);
      const insideMs = timeInsideStaticCircle(profile, center, radius, startMs, startMs + activeMs);
      if (insideMs <= 0 || dps <= 0) continue;
      const rawDamage = dps * insideMs / 1000;
      const impact = applyWorldSimulationCombatImpact({
        world_state: input.world_state,
        next_world_state: nextWorldState,
        target: character,
        hit_region: "whole_body",
        base_damage: rawDamage,
        penetration: nonNegativeNumber(effect.penetration, 0),
        damage_type: effect.damage_type,
        source: fieldId,
        ignore_armor: effect.ignore_armor === true,
        state_transitions: transitions,
      });
      resolutions.push({ field_id: fieldId, result: "ability_field_applied", target: character, inside_ms: insideMs, damage_applied: impact.damage_applied });
      pushOutcome(outcomes, field.owner, { action_id: field.source_action_id, intent: null }, "ability_field_applied", `${character} occupied field ${fieldId} for ${insideMs.toFixed(3)}ms`, {
        ability_field_id: fieldId,
        target: character,
        inside_ms: insideMs,
        damage_applied: impact.damage_applied,
        health_before: impact.health_before,
        health_after: impact.health_after,
      });
    }
    const beforeRemaining = nonNegativeNumber(field.remaining_ms, 0);
    field.remaining_ms = Math.max(0, beforeRemaining - activeMs);
    if (field.remaining_ms <= 0) {
      field.active = false;
      field.termination_reason = "duration_expired";
    }
    pushTransition(transitions, fieldId, "remaining_ms", beforeRemaining, field.remaining_ms, `ability field advanced ${activeMs}ms through continuous physics`);
    nextWorldState.ability_fields[fieldId] = field;
  }
  void rules;
}

export function buildWorldSimulationContinuousPhysicsContract() {
  return {
    version: worldSimulationContinuousPhysicsVersion,
    owner: "programmatic_continuous_physics_adjudicator",
    character_brain_may_choose: [
      "fire_projectile_intent",
      "aim_point_or_target",
      "ability_activation_intent",
      "ability_field_center",
    ],
    character_brain_may_not_choose: [
      "projectile_speed",
      "projectile_damage",
      "projectile_penetration_result",
      "projectile_collision_result",
      "cover_destruction_result",
      "ability_radius",
      "ability_damage",
      "ability_duration",
      "energy_cost_result",
    ],
    projectiles: {
      persistent_world_entities: true,
      continuous_relative_motion_collision: true,
      cover_collision_precedes_character_collision_by_time: true,
      penetration_energy_persists_after_cover: true,
      scene_bounds_and_lifetime_enforced: true,
    },
    abilities: {
      profiles_read_from_world_state: true,
      activation_energy_cost_enforced: true,
      area_fields_persist_across_turns: true,
      moving_character_exposure_integrated_over_time: true,
    },
    topology: {
      destructible_cover_updates_scene_obstacle_state: true,
      destroyed_cover_becomes_non_colliding_and_passable: true,
    },
    known_boundary: "Projectile/field contacts are continuous within this layer. A later phase may unify projectile contact timestamps with melee contact timestamps into one global combat timeline.",
  };
}

export function adjudicateWorldSimulationContinuousPhysics(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const nextWorldState = cloneJson(object(input.next_world_state ?? snapshot));
  const sceneId = String(input.scene_id ?? input.event?.scene_id ?? "").trim();
  const snapshotScene = object(object(snapshot.scenes)[sceneId] ?? snapshot.scene_state);
  const nextScene = object(object(nextWorldState.scenes)[sceneId] ?? nextWorldState.scene_state);
  const elapsedMs = nonNegativeNumber(input.elapsed_ms, 0);
  const transitions = [];
  const outcomes = [];
  const projectileResolutions = [];
  const abilityResolutions = [];

  const spawnedProjectiles = spawnProjectiles({ ...input, world_state: snapshot, scene_id: sceneId }, nextWorldState, snapshotScene, transitions, outcomes);
  const spawnedFields = spawnAbilityFields({ ...input, world_state: snapshot, scene_id: sceneId }, nextWorldState, snapshotScene, transitions, outcomes);
  const projectileStart = new Map(spawnedProjectiles.map((item) => [item.projectileId, item.activeAfterMs]));
  nextWorldState.projectiles = object(nextWorldState.projectiles);

  for (const [projectileId, rawProjectile] of Object.entries(nextWorldState.projectiles)) {
    const projectile = object(rawProjectile);
    if (projectile.active !== true || String(projectile.scene_id ?? "") !== sceneId) continue;
    const startMs = projectileStart.has(projectileId) ? projectileStart.get(projectileId) : 0;
    if (startMs >= elapsedMs) continue;
    const before = cloneJson(projectile);
    resolveProjectile(
      { ...input, world_state: snapshot, scene_id: sceneId },
      projectile,
      startMs,
      elapsedMs,
      nextWorldState,
      snapshotScene,
      nextScene,
      transitions,
      outcomes,
      projectileResolutions,
    );
    nextWorldState.projectiles[projectileId] = projectile;
    pushTransition(transitions, projectileId, "projectile_state", before, projectile, `continuous projectile physics advanced through ${Math.max(0, elapsedMs - startMs)}ms window`);
  }

  resolveAbilityFields(
    { ...input, world_state: snapshot, scene_id: sceneId },
    spawnedFields,
    nextWorldState,
    snapshotScene,
    nextScene,
    elapsedMs,
    transitions,
    outcomes,
    abilityResolutions,
  );

  if (isObject(nextWorldState.scenes) && Object.hasOwn(nextWorldState.scenes, sceneId)) {
    nextWorldState.scenes[sceneId] = nextScene;
  } else if (isObject(nextWorldState.scene_state)) {
    nextWorldState.scene_state = nextScene;
  }

  return {
    continuous_physics_version: worldSimulationContinuousPhysicsVersion,
    next_world_state: nextWorldState,
    state_transitions: transitions,
    action_outcomes: outcomes,
    projectile_resolutions: projectileResolutions,
    ability_resolutions: abilityResolutions,
    elapsed_ms: elapsedMs,
    boundary: {
      projectile_collision_is_programmatic: true,
      cover_penetration_is_programmatic: true,
      ability_cost_and_field_effect_are_programmatic: true,
      character_brain_selects_intent_only: true,
    },
  };
}
