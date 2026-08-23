import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  positionAtWorldSimulationActorTrajectory,
  velocityAtWorldSimulationActorTrajectory,
  worldSimulationActorTrajectoryBreakpoints,
} from "./world-simulation-actor-state-scheduler.mjs";
import {
  applyWorldSimulationCombatImpact,
} from "./world-simulation-combat-causal-service.mjs";
import {
  buildWorldSimulationImmutablePhysicsEffectContract,
  evaluateWorldSimulationAbilityEnergyConsumption,
  evaluateWorldSimulationAmmoConsumption,
  evaluateWorldSimulationCoverStructuralImpact,
  evaluateWorldSimulationProjectileSpawn,
  projectWorldSimulationImmutablePhysicsEffectProposals,
  worldSimulationImmutablePhysicsEffectVersion,
} from "./world-simulation-immutable-physics-effect-service.mjs";
import {
  buildWorldSimulationImmutableProjectileLifecycleContract,
  evaluateWorldSimulationProjectileAdvance,
  evaluateWorldSimulationProjectilePenetrationContinuation,
  evaluateWorldSimulationProjectileTermination,
  projectWorldSimulationImmutableProjectileLifecycleProposals,
  worldSimulationImmutableProjectileLifecycleVersion,
} from "./world-simulation-immutable-projectile-lifecycle-service.mjs";
import {
  buildWorldSimulationImmutableAbilityFieldLifecycleContract,
  evaluateWorldSimulationAbilityFieldLifecycle,
  evaluateWorldSimulationAbilityFieldSpawn,
  projectWorldSimulationImmutableAbilityFieldLifecycleProposals,
  worldSimulationImmutableAbilityFieldLifecycleVersion,
} from "./world-simulation-immutable-ability-field-lifecycle-service.mjs";

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

function actionTimeOverride(input, actionId) {
  return object(object(input?.action_time_overrides)[String(actionId ?? "")]);
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

function transitionTimeExtra(timeMs, extra = {}) {
  const value = finiteNumber(timeMs);
  return value === null ? extra : { ...extra, time_ms: Math.max(0, value) };
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

function movementProfile(snapshotScene, nextScene, selectedActionIntents, outcomes, character, actorTrajectories = {}) {
  const trajectory = object(object(actorTrajectories)[character]);
  if (Object.keys(trajectory).length) {
    const start = point(trajectory.start);
    const end = point(trajectory.final_position ?? trajectory.destination) ?? start;
    const completion = finiteNumber(trajectory.completion_time_ms);
    const interrupted = finiteNumber(trajectory.interrupted_at_ms);
    const durationMs = completion ?? interrupted ?? 0;
    return {
      start,
      end,
      durationMs,
      trajectory,
      breakpoints: worldSimulationActorTrajectoryBreakpoints(trajectory),
    };
  }
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
  if (Object.keys(object(profile.trajectory)).length) {
    return positionAtWorldSimulationActorTrajectory(profile.trajectory, timeMs);
  }
  if (profile.durationMs <= 0) return profile.start;
  const ratio = Math.min(1, Math.max(0, timeMs / profile.durationMs));
  return {
    x: profile.start.x + (profile.end.x - profile.start.x) * ratio,
    y: profile.start.y + (profile.end.y - profile.start.y) * ratio,
  };
}

function velocityDuring(profile, timeMs) {
  if (!profile) return { x: 0, y: 0 };
  if (Object.keys(object(profile.trajectory)).length) {
    return velocityAtWorldSimulationActorTrajectory(profile.trajectory, timeMs);
  }
  if (profile.durationMs <= 0 || timeMs >= profile.durationMs) return { x: 0, y: 0 };
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
  for (const breakpoint of array(profile?.breakpoints)) {
    if (breakpoint > startMs && breakpoint < endMs) boundaries.push(breakpoint);
  }
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

function recordImmutablePhysicsAudit(input, audit) {
  if (audit && Array.isArray(input.immutable_causal_evaluator_audits)) {
    input.immutable_causal_evaluator_audits.push(audit);
  }
}

function projectPhysicsEffectIntoPrivatePreview(input, nextWorldState, evaluation, elapsedMs = 0) {
  if (!array(evaluation?.mutation_proposals).length) return nextWorldState;
  return projectWorldSimulationImmutablePhysicsEffectProposals({
    world_state: nextWorldState,
    mutation_proposals: evaluation.mutation_proposals,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    scene_id: input.scene_id ?? null,
    elapsed_ms: Math.max(0, finiteNumber(elapsedMs, 0)),
  }).projected_world_state;
}

function projectProjectileLifecycleIntoPrivatePreview(input, nextWorldState, evaluation, elapsedMs = 0) {
  if (!array(evaluation?.mutation_proposals).length) return nextWorldState;
  return projectWorldSimulationImmutableProjectileLifecycleProposals({
    world_state: nextWorldState,
    mutation_proposals: evaluation.mutation_proposals,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    scene_id: input.scene_id ?? null,
    elapsed_ms: Math.max(0, finiteNumber(elapsedMs, 0)),
  }).projected_world_state;
}

function projectAbilityFieldLifecycleIntoPrivatePreview(input, nextWorldState, evaluation, elapsedMs = 0) {
  if (!array(evaluation?.mutation_proposals).length) return nextWorldState;
  return projectWorldSimulationImmutableAbilityFieldLifecycleProposals({
    world_state: nextWorldState,
    mutation_proposals: evaluation.mutation_proposals,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    scene_id: input.scene_id ?? null,
    elapsed_ms: Math.max(0, finiteNumber(elapsedMs, 0)),
  }).projected_world_state;
}

function applyProjectileLifecycleEvaluation(input, state, nextWorldState, transitions, evaluation, timeMs = 0) {
  recordImmutablePhysicsAudit(input, evaluation?.audit);
  transitions.push(...array(evaluation?.mutation_proposals));
  if (!array(evaluation?.mutation_proposals).length) return cloneJson(evaluation?.result ?? {});
  const projected = projectProjectileLifecycleIntoPrivatePreview(input, nextWorldState, evaluation, timeMs);
  const projectedProjectile = object(object(projected.projectiles)[state.projectileId]);
  replaceObjectContents(state.projectile, projectedProjectile);
  nextWorldState.projectiles[state.projectileId] = state.projectile;
  return cloneJson(evaluation?.result ?? {});
}

function consumeAmmo(input, nextWorldState, weaponId, transitions, timeMs = null) {
  const evaluation = evaluateWorldSimulationAmmoConsumption({
    world_state: nextWorldState,
    weapon_id: weaponId,
    time_ms: timeMs,
  });
  recordImmutablePhysicsAudit(input, evaluation.audit);
  transitions.push(...array(evaluation.mutation_proposals));
  const projected = projectPhysicsEffectIntoPrivatePreview(input, nextWorldState, evaluation, timeMs);
  nextWorldState.objects = cloneJson(object(projected.objects));
  return cloneJson(evaluation.result);
}

function spawnProjectiles(input, nextWorldState, snapshotScene, transitions, outcomes) {
  const spawned = [];
  const selectedActionIntents = array(input.selected_action_intents);
  nextWorldState.projectiles = object(nextWorldState.projectiles);
  const suppressedActionIds = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  for (const selected of selectedActionIntents) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const actionId = String(candidate.action_id ?? "");
    const intent = object(candidate.projectile);
    if (!actor || suppressedActionIds.has(actionId) || !Object.keys(intent).length) continue;
    const profile = weaponProjectileProfile(input.world_state, actor, intent);
    if (!profile.ok) {
      pushOutcome(outcomes, actor, candidate, "projectile_launch_blocked", profile.reason, { projectile_resolved: false });
      continue;
    }
    const nominalFireDelayMs = nonNegativeNumber(intent.fire_delay_ms, 0);
    const fireDelayMs = nonNegativeNumber(
      actionTimeOverride(input, actionId).projectile_launch_ms,
      nominalFireDelayMs,
    );
    const ammo = consumeAmmo(input, nextWorldState, profile.weaponId, transitions, fireDelayMs);
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
    const spawnEvaluation = evaluateWorldSimulationProjectileSpawn({
      world_state: nextWorldState,
      projectile_id: projectileId,
      projectile,
      weapon_id: profile.weaponId,
      time_ms: fireDelayMs,
    });
    recordImmutablePhysicsAudit(input, spawnEvaluation.audit);
    if (!spawnEvaluation.result.ok) {
      pushOutcome(outcomes, actor, candidate, "projectile_launch_blocked", spawnEvaluation.result.reason ?? `projectile ${projectileId} could not be spawned`, { projectile_resolved: false });
      continue;
    }
    transitions.push(...array(spawnEvaluation.mutation_proposals));
    const projectedSpawn = projectPhysicsEffectIntoPrivatePreview(input, nextWorldState, spawnEvaluation, fireDelayMs);
    nextWorldState.projectiles = cloneJson(object(projectedSpawn.projectiles));
    spawned.push({ projectileId, projectile: cloneJson(nextWorldState.projectiles[projectileId]), actor, candidate, activeAfterMs: fireDelayMs });
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
  const suppressedActionIds = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  for (const selected of array(input.selected_action_intents)) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const actionId = String(candidate.action_id ?? "");
    const intent = object(candidate.ability);
    if (!actor || suppressedActionIds.has(actionId) || !Object.keys(intent).length) continue;
    const abilityId = String(intent.ability_id ?? intent.id ?? "").trim();
    const profile = abilityProfile(input.world_state, actor, abilityId);
    const fieldProfile = object(profile.field ?? profile.area_effect);
    const nominalStartDelayMs = nonNegativeNumber(intent.start_delay_ms, 0);
    const startDelayMs = nonNegativeNumber(
      actionTimeOverride(input, actionId).ability_activation_ms,
      nominalStartDelayMs,
    );
    if (!abilityId || !Object.keys(profile).length || profile.enabled === false || profile.available === false) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId || "<missing>"} is unavailable in world state`);
      continue;
    }
    if (!Object.keys(fieldProfile).length) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} has no world-state field profile`);
      continue;
    }
    const energyCost = nonNegativeNumber(profile.energy_cost ?? fieldProfile.energy_cost, 0);
    const energyEvaluation = evaluateWorldSimulationAbilityEnergyConsumption({
      world_state: nextWorldState,
      actor,
      ability_id: abilityId,
      energy_cost: energyCost,
      time_ms: startDelayMs,
    });
    recordImmutablePhysicsAudit(input, energyEvaluation.audit);
    if (!energyEvaluation.result.ok) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", `ability ${abilityId} requires ${energyCost} energy but current world state is insufficient`);
      continue;
    }
    transitions.push(...array(energyEvaluation.mutation_proposals));
    const projectedEnergy = projectPhysicsEffectIntoPrivatePreview(input, nextWorldState, energyEvaluation, startDelayMs);
    nextWorldState.characters = cloneJson(object(projectedEnergy.characters));
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
    const fieldSpawnEvaluation = evaluateWorldSimulationAbilityFieldSpawn({
      field_id: fieldId,
      field,
      existing_field: nextWorldState.ability_fields[fieldId] ?? null,
      time_ms: startDelayMs,
    });
    recordImmutablePhysicsAudit(input, fieldSpawnEvaluation.audit);
    if (!fieldSpawnEvaluation.result.ok) {
      pushOutcome(outcomes, actor, candidate, "ability_activation_blocked", fieldSpawnEvaluation.result.reason ?? `ability field ${fieldId} could not be spawned`);
      continue;
    }
    transitions.push(...array(fieldSpawnEvaluation.mutation_proposals));
    const projectedFieldSpawn = projectAbilityFieldLifecycleIntoPrivatePreview(input, nextWorldState, fieldSpawnEvaluation, startDelayMs);
    nextWorldState.ability_fields = cloneJson(object(projectedFieldSpawn.ability_fields));
    const spawnedField = cloneJson(object(nextWorldState.ability_fields[fieldId]));
    spawned.push({ fieldId, field: spawnedField, actor, candidate, activeAfterMs: startDelayMs });
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
      input.actor_trajectories,
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

function replaceObjectContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, cloneJson(source));
}

function updateObstacleAfterImpact(input, nextWorldState, nextScene, collision, projectile, transitions, timeMs = null) {
  const evaluation = evaluateWorldSimulationCoverStructuralImpact({
    world_state: nextWorldState,
    scene_id: input.scene_id,
    obstacle_id: collision.obstacleId,
    projectile_id: projectile.projectile_id,
    penetration_energy: projectile.remaining_penetration_energy,
    time_ms: timeMs,
  });
  recordImmutablePhysicsAudit(input, evaluation.audit);
  if (!evaluation.result.ok) return evaluation.result;
  transitions.push(...array(evaluation.mutation_proposals));
  const projected = projectPhysicsEffectIntoPrivatePreview(input, nextWorldState, evaluation, timeMs);
  const projectedScene = object(object(projected.scenes)[input.scene_id] ?? projected.scene_state);
  replaceObjectContents(nextScene, projectedScene);
  if (isObject(nextWorldState.scenes) && Object.hasOwn(nextWorldState.scenes, input.scene_id)) {
    nextWorldState.scenes[input.scene_id] = nextScene;
  } else if (isObject(nextWorldState.scene_state)) {
    nextWorldState.scene_state = nextScene;
  }
  return cloneJson(evaluation.result);
}

function projectilePositionAt(projectile, deltaMs) {
  return {
    x: projectile.position.x + projectile.velocity_mps.x * (deltaMs / 1000),
    y: projectile.position.y + projectile.velocity_mps.y * (deltaMs / 1000),
  };
}

function nextProjectileTimelineStep(input, projectile, currentTimeMs, activeEndMs, snapshotScene, nextScene) {
  const ageRemaining = Math.max(
    0,
    positiveNumber(projectile.max_lifetime_ms, 5000) - nonNegativeNumber(projectile.age_ms, 0),
  );
  if (ageRemaining <= 1e-9) {
    return { kind: "lifetime", timeMs: currentTimeMs };
  }
  const windowEndMs = Math.min(activeEndMs, currentTimeMs + ageRemaining);
  const obstacle = obstacleEntry(nextScene, projectile, currentTimeMs, windowEndMs);
  const character = characterEntry(input, projectile, currentTimeMs, windowEndMs, snapshotScene, nextScene);
  const boundsTime = sceneBoundsExitTime(nextScene, projectile, currentTimeMs, windowEndMs);
  const events = [
    obstacle ? { kind: "obstacle", ...obstacle } : null,
    character ? { kind: "character", ...character } : null,
    boundsTime !== null ? { kind: "bounds", timeMs: boundsTime } : null,
  ].filter(Boolean).sort((left, right) => (
    left.timeMs - right.timeMs
    || left.kind.localeCompare(right.kind)
  ));
  if (events.length) return events[0];
  if (windowEndMs < activeEndMs - 1e-9) return { kind: "lifetime", timeMs: windowEndMs };
  return { kind: "advance_end", timeMs: activeEndMs };
}

function advanceProjectileTimelineClock(input, state, nextWorldState, transitions, toMs) {
  const fromMs = state.currentTimeMs;
  const travelMs = Math.max(0, toMs - fromMs);
  if (travelMs > 0) {
    const evaluation = evaluateWorldSimulationProjectileAdvance({
      projectile: state.projectile,
      delta_ms: travelMs,
      time_ms: toMs,
    });
    const result = applyProjectileLifecycleEvaluation(
      input,
      state,
      nextWorldState,
      transitions,
      evaluation,
      toMs,
    );
    if (!result.ok) {
      const error = new Error(result.reason ?? `projectile ${state.projectileId} could not advance`);
      error.code = "WORLD_SIMULATION_PROJECTILE_LIFECYCLE_ADVANCE_FAILED";
      throw error;
    }
  }
  state.currentTimeMs = toMs;
  return toMs;
}

function terminateProjectileLifecycle(input, state, nextWorldState, transitions, reason, options = {}) {
  const evaluation = evaluateWorldSimulationProjectileTermination({
    projectile: state.projectile,
    reason,
    zero_penetration_energy: options.zero_penetration_energy === true,
    time_ms: state.currentTimeMs,
  });
  const result = applyProjectileLifecycleEvaluation(
    input,
    state,
    nextWorldState,
    transitions,
    evaluation,
    state.currentTimeMs,
  );
  if (!result.ok) {
    const error = new Error(result.reason ?? `projectile ${state.projectileId} could not terminate`);
    error.code = "WORLD_SIMULATION_PROJECTILE_LIFECYCLE_TERMINATION_FAILED";
    throw error;
  }
  return result;
}

function continueProjectileAfterPenetration(input, state, nextWorldState, transitions, obstacleId, resistance) {
  const evaluation = evaluateWorldSimulationProjectilePenetrationContinuation({
    projectile: state.projectile,
    obstacle_id: obstacleId,
    resistance,
    time_ms: state.currentTimeMs,
    epsilon_ms: 0.01,
  });
  const result = applyProjectileLifecycleEvaluation(
    input,
    state,
    nextWorldState,
    transitions,
    evaluation,
    resultTime(evaluation, state.currentTimeMs),
  );
  if (!result.ok) {
    const error = new Error(result.reason ?? `projectile ${state.projectileId} could not continue after penetration`);
    error.code = "WORLD_SIMULATION_PROJECTILE_LIFECYCLE_PENETRATION_FAILED";
    throw error;
  }
  state.currentTimeMs = nonNegativeNumber(result.time_ms_after, state.currentTimeMs);
  return result;
}

function resultTime(evaluation, fallback) {
  return nonNegativeNumber(evaluation?.result?.time_ms_after, fallback);
}

function applyProjectileTimelineStep(input, state, event, nextWorldState, nextScene, transitions, outcomes, resolutions) {
  const projectile = state.projectile;
  advanceProjectileTimelineClock(input, state, nextWorldState, transitions, event.timeMs);
  if (event.kind === "advance_end") {
    state.doneForTurn = true;
    return;
  }
  if (event.kind === "lifetime") {
    terminateProjectileLifecycle(input, state, nextWorldState, transitions, "lifetime_expired");
    state.doneForTurn = true;
    return;
  }
  if (event.kind === "bounds") {
    terminateProjectileLifecycle(input, state, nextWorldState, transitions, "left_scene_bounds");
    resolutions.push({
      projectile_id: projectile.projectile_id,
      owner: projectile.owner,
      source_action_id: projectile.source_action_id,
      result: "left_scene_bounds",
      time_ms: state.currentTimeMs,
      position: cloneJson(projectile.position),
    });
    state.doneForTurn = true;
    return;
  }
  if (event.kind === "obstacle") {
    const impact = updateObstacleAfterImpact(input, nextWorldState, nextScene, event, projectile, transitions, state.currentTimeMs);
    if (impact.penetrated) {
      const continuation = continueProjectileAfterPenetration(
        input,
        state,
        nextWorldState,
        transitions,
        event.obstacleId,
        impact.resistance,
      );
      resolutions.push({
        projectile_id: projectile.projectile_id,
        owner: projectile.owner,
        source_action_id: projectile.source_action_id,
        result: "projectile_penetrated_cover",
        obstacle_id: event.obstacleId,
        time_ms: event.timeMs,
        remaining_penetration_energy: continuation.remaining_penetration_energy,
        cover_destroyed: impact.destroyed,
      });
      pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_penetrated_cover", `projectile energy ${impact.beforeEnergy.toFixed(3)} exceeded cover resistance ${impact.resistance.toFixed(3)}`, {
        projectile_id: projectile.projectile_id,
        obstacle_id: event.obstacleId,
        remaining_penetration_energy: continuation.remaining_penetration_energy,
        cover_destroyed: impact.destroyed,
      });
      return;
    }
    terminateProjectileLifecycle(input, state, nextWorldState, transitions, "stopped_by_cover", { zero_penetration_energy: true });
    resolutions.push({
      projectile_id: projectile.projectile_id,
      owner: projectile.owner,
      source_action_id: projectile.source_action_id,
      result: "projectile_stopped_by_cover",
      obstacle_id: event.obstacleId,
      time_ms: state.currentTimeMs,
      source_layer: "continuous_physics",
    });
    pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_stopped_by_cover", `cover resistance ${impact.resistance} was not exceeded by projectile energy ${impact.beforeEnergy}`, {
      projectile_id: projectile.projectile_id,
      obstacle_id: event.obstacleId,
      cover_destroyed: impact.destroyed,
    });
    state.doneForTurn = true;
    return;
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
      time_ms: state.currentTimeMs,
      source_layer: "continuous_physics",
    });
    if (impact.evaluator_audit) array(input.immutable_causal_evaluator_audits).push(impact.evaluator_audit);
    terminateProjectileLifecycle(input, state, nextWorldState, transitions, "character_contact", { zero_penetration_energy: true });
    resolutions.push({
      projectile_id: projectile.projectile_id,
      owner: projectile.owner,
      source_action_id: projectile.source_action_id,
      result: "projectile_hit_character",
      target: event.character,
      time_ms: state.currentTimeMs,
      damage_applied: impact.damage_applied,
    });
    pushOutcome(outcomes, projectile.owner, { action_id: projectile.source_action_id, intent: null }, "projectile_hit_character", `continuous relative-motion collision occurred at ${state.currentTimeMs.toFixed(3)}ms`, {
      projectile_id: projectile.projectile_id,
      target: event.character,
      hit: true,
      contact_resolved: true,
      damage_applied: impact.damage_applied,
      health_before: impact.health_before,
      health_after: impact.health_after,
      injury_severity: impact.injury_severity,
      movement_multiplier_after: impact.movement_multiplier_after,
      combat_multiplier_after: impact.combat_multiplier_after,
    });
    state.doneForTurn = true;
  }
}

function resolveProjectilesInGlobalTimeOrder(input, projectileStart, elapsedMs, nextWorldState, snapshotScene, nextScene, transitions, outcomes, resolutions) {
  const states = [];
  for (const [projectileId, rawProjectile] of Object.entries(object(nextWorldState.projectiles))) {
    const projectile = object(rawProjectile);
    if (projectile.active !== true || String(projectile.scene_id ?? "") !== input.scene_id) continue;
    const startMs = projectileStart.has(projectileId) ? projectileStart.get(projectileId) : 0;
    if (startMs >= elapsedMs) continue;
    states.push({ projectileId, projectile, currentTimeMs: startMs, doneForTurn: false });
  }

  let iterations = 0;
  const maxIterations = Math.max(128, states.length * 96);
  while (iterations < maxIterations) {
    iterations += 1;
    const candidates = states
      .filter((state) => state.projectile.active === true && state.doneForTurn !== true && state.currentTimeMs < elapsedMs - 1e-6)
      .map((state) => ({
        state,
        event: nextProjectileTimelineStep(input, state.projectile, state.currentTimeMs, elapsedMs, snapshotScene, nextScene),
      }));
    if (!candidates.length) break;
    candidates.sort((left, right) => (
      left.event.timeMs - right.event.timeMs
      || left.state.projectileId.localeCompare(right.state.projectileId)
      || left.event.kind.localeCompare(right.event.kind)
    ));
    const earliestTimeMs = candidates[0].event.timeMs;
    const simultaneous = candidates.filter((item) => Math.abs(item.event.timeMs - earliestTimeMs) <= 1e-6);
    for (const item of simultaneous) {
      applyProjectileTimelineStep(
        input,
        item.state,
        item.event,
        nextWorldState,
        nextScene,
        transitions,
        outcomes,
        resolutions,
      );
      nextWorldState.projectiles[item.state.projectileId] = item.state.projectile;
    }
  }

  for (const state of states) {
    if (iterations >= maxIterations && state.projectile.active === true && state.doneForTurn !== true) {
      terminateProjectileLifecycle(input, state, nextWorldState, transitions, "global_physics_iteration_guard");
      state.doneForTurn = true;
    }
    nextWorldState.projectiles[state.projectileId] = state.projectile;
  }
  return { iterations };
}

function timeInsideStaticCircle(profile, center, radius, startMs, endMs) {
  if (!profile || endMs <= startMs) return 0;
  const boundaries = [startMs, endMs];
  for (const breakpoint of array(profile?.breakpoints)) {
    if (breakpoint > startMs && breakpoint < endMs) boundaries.push(breakpoint);
  }
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
  const defaultTickMs = positiveNumber(rules.ability_field_tick_ms, 100);
  for (const [fieldId, rawField] of Object.entries(nextWorldState.ability_fields)) {
    const field = object(rawField);
    if (field.active !== true || String(field.scene_id ?? "") !== input.scene_id) continue;
    const startMs = newStart.has(fieldId) ? newStart.get(fieldId) : 0;
    const lifecycleEvaluation = evaluateWorldSimulationAbilityFieldLifecycle({
      field,
      start_ms: startMs,
      elapsed_ms: elapsedMs,
      default_tick_ms: defaultTickMs,
    });
    recordImmutablePhysicsAudit(input, lifecycleEvaluation.audit);
    if (!lifecycleEvaluation.result.ok) continue;
    const activeMs = nonNegativeNumber(lifecycleEvaluation.result.active_ms, 0);
    if (activeMs <= 0) continue;
    const center = point(field.center);
    const radius = positiveNumber(field.radius_m, null);
    if (!center || !radius) continue;
    const effect = object(field.effect);
    const dps = nonNegativeNumber(effect.damage_per_second, 0);
    const tickMs = positiveNumber(lifecycleEvaluation.result.tick_ms, defaultTickMs);
    const profiles = new Map();
    const exposureTotals = new Map();
    for (const character of characterNamesInScene(snapshotScene, input.world_state)) {
      profiles.set(character, movementProfile(
        snapshotScene,
        nextScene,
        input.selected_action_intents,
        input.resolved_action_outcomes,
        character,
        input.actor_trajectories,
      ));
    }

    const fieldEndMs = nonNegativeNumber(lifecycleEvaluation.result.field_end_ms, startMs + activeMs);
    for (const tickWindow of array(lifecycleEvaluation.result.tick_windows)) {
      const tickIndex = Math.max(1, Math.trunc(nonNegativeNumber(tickWindow.tick_index, 1)));
      const tickStartMs = nonNegativeNumber(tickWindow.tick_start_ms, startMs);
      const tickEndMs = nonNegativeNumber(tickWindow.tick_end_ms, fieldEndMs);
      for (const character of characterNamesInScene(snapshotScene, input.world_state)) {
        if (character === field.owner && field.affects_owner !== true) continue;
        const profile = profiles.get(character);
        const insideMs = timeInsideStaticCircle(profile, center, radius, tickStartMs, tickEndMs);
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
          time_ms: tickEndMs,
          source_layer: "continuous_physics",
        });
        if (impact.evaluator_audit) array(input.immutable_causal_evaluator_audits).push(impact.evaluator_audit);
        resolutions.push({
          field_id: fieldId,
          owner: field.owner,
          source_action_id: field.source_action_id ?? null,
          result: "ability_field_tick",
          target: character,
          tick_index: tickIndex,
          tick_start_ms: tickStartMs,
          time_ms: tickEndMs,
          inside_ms: insideMs,
          damage_applied: impact.damage_applied,
          health_before: impact.health_before,
          health_after: impact.health_after,
          injury_severity: impact.injury_severity,
          movement_multiplier_after: impact.movement_multiplier_after,
          combat_multiplier_after: impact.combat_multiplier_after,
        });
        pushOutcome(outcomes, field.owner, { action_id: field.source_action_id, intent: null }, "ability_field_tick", `${character} occupied field ${fieldId} for ${insideMs.toFixed(3)}ms during tick ${tickIndex}`, {
          ability_field_id: fieldId,
          target: character,
          tick_index: tickIndex,
          tick_start_ms: tickStartMs,
          time_ms: tickEndMs,
          inside_ms: insideMs,
          damage_applied: impact.damage_applied,
          health_before: impact.health_before,
          health_after: impact.health_after,
          injury_severity: impact.injury_severity,
          movement_multiplier_after: impact.movement_multiplier_after,
          combat_multiplier_after: impact.combat_multiplier_after,
        });
        const previousExposure = exposureTotals.get(character) ?? { inside_ms: 0, damage_applied: 0, health_before: impact.health_before, health_after: impact.health_after };
        previousExposure.inside_ms += insideMs;
        previousExposure.damage_applied += impact.damage_applied;
        previousExposure.health_after = impact.health_after;
        exposureTotals.set(character, previousExposure);
      }
    }

    for (const [character, total] of exposureTotals.entries()) {
      pushOutcome(outcomes, field.owner, { action_id: field.source_action_id, intent: null }, "ability_field_applied", `${character} occupied field ${fieldId} for ${total.inside_ms.toFixed(3)}ms across deterministic ticks`, {
        ability_field_id: fieldId,
        target: character,
        inside_ms: total.inside_ms,
        damage_applied: total.damage_applied,
        health_before: total.health_before,
        health_after: total.health_after,
        ticked: true,
      });
    }

    transitions.push(...array(lifecycleEvaluation.mutation_proposals));
    const projectedLifecycle = projectAbilityFieldLifecycleIntoPrivatePreview(input, nextWorldState, lifecycleEvaluation, fieldEndMs);
    nextWorldState.ability_fields = cloneJson(object(projectedLifecycle.ability_fields));
  }
}


export function buildWorldSimulationContinuousIntentTimelineEntries(input = {}) {
  const suppressed = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  const entries = [];
  for (const selected of array(input.selected_action_intents)) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const actionId = String(candidate.action_id ?? "").trim();
    if (!actor || !actionId || suppressed.has(actionId)) continue;
    const projectile = object(candidate.projectile);
    if (Object.keys(projectile).length) {
      entries.push({
        kind: "projectile_launch",
        actor,
        action_id: actionId,
        time_ms: nonNegativeNumber(
          actionTimeOverride(input, actionId).projectile_launch_ms,
          nonNegativeNumber(projectile.fire_delay_ms, 0),
        ),
        target: String(projectile.target_character ?? projectile.target ?? candidate.target ?? "").trim() || null,
      });
    }
    const ability = object(candidate.ability);
    if (Object.keys(ability).length) {
      entries.push({
        kind: "ability_activation",
        actor,
        action_id: actionId,
        time_ms: nonNegativeNumber(
          actionTimeOverride(input, actionId).ability_activation_ms,
          nonNegativeNumber(ability.start_delay_ms, 0),
        ),
        ability_id: String(ability.ability_id ?? ability.id ?? "").trim() || null,
      });
    }
  }
  return entries.sort((left, right) => (
    left.time_ms - right.time_ms
    || left.kind.localeCompare(right.kind)
    || left.actor.localeCompare(right.actor, "zh-Hant-TW")
    || left.action_id.localeCompare(right.action_id)
  ));
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
      deterministic_field_ticks: true,
      field_ticks_sample_piecewise_actor_trajectory: true,
    },
    topology: {
      destructible_cover_updates_scene_obstacle_state: true,
      destroyed_cover_becomes_non_colliding_and_passable: true,
      projectile_collisions_resolve_in_global_time_order: true,
      earlier_cover_destruction_changes_later_projectile_paths: true,
    },
    immutable_physics_effects: buildWorldSimulationImmutablePhysicsEffectContract(),
    immutable_projectile_lifecycle: buildWorldSimulationImmutableProjectileLifecycleContract(),
    immutable_ability_field_lifecycle: buildWorldSimulationImmutableAbilityFieldLifecycleContract(),
    known_boundary: "Projectile collisions share strict time order and observe earlier topology mutations. Phase62Q makes ability-field spawn, deterministic tick-window progression, remaining duration, and expiration immutable proposal evaluation; geometric exposure discovery remains programmatic.",
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
  const immutableCausalEvaluatorAudits = [];
  const physicsEffectInput = {
    ...input,
    world_state: snapshot,
    scene_id: sceneId,
    immutable_causal_evaluator_audits: immutableCausalEvaluatorAudits,
  };

  const spawnedProjectiles = spawnProjectiles(physicsEffectInput, nextWorldState, snapshotScene, transitions, outcomes);
  const spawnedFields = spawnAbilityFields(physicsEffectInput, nextWorldState, snapshotScene, transitions, outcomes);
  const projectileStart = new Map(spawnedProjectiles.map((item) => [item.projectileId, item.activeAfterMs]));
  nextWorldState.projectiles = object(nextWorldState.projectiles);

  const projectileScheduler = resolveProjectilesInGlobalTimeOrder(
    { ...input, world_state: snapshot, scene_id: sceneId, immutable_causal_evaluator_audits: immutableCausalEvaluatorAudits },
    projectileStart,
    elapsedMs,
    nextWorldState,
    snapshotScene,
    nextScene,
    transitions,
    outcomes,
    projectileResolutions,
  );

  resolveAbilityFields(
    { ...input, world_state: snapshot, scene_id: sceneId, immutable_causal_evaluator_audits: immutableCausalEvaluatorAudits },
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
    next_world_state_authority: "ephemeral_preview_only",
    state_transitions: transitions,
    mutation_proposals: transitions,
    action_outcomes: outcomes,
    projectile_resolutions: projectileResolutions,
    ability_resolutions: abilityResolutions,
    immutable_causal_evaluator_audits: immutableCausalEvaluatorAudits,
    timeline_entries: [
      ...buildWorldSimulationContinuousIntentTimelineEntries({ ...input, world_state: snapshot }),
      ...projectileResolutions.map((resolution) => ({
        kind: "projectile_resolution",
        actor: resolution.owner ?? null,
        action_id: resolution.source_action_id ?? null,
        projectile_id: resolution.projectile_id ?? null,
        result: resolution.result ?? null,
        target: resolution.target ?? null,
        obstacle_id: resolution.obstacle_id ?? null,
        time_ms: nonNegativeNumber(resolution.time_ms, 0),
      })),
      ...abilityResolutions.map((resolution) => ({
        kind: "ability_field_tick",
        actor: resolution.owner ?? null,
        action_id: resolution.source_action_id ?? null,
        field_id: resolution.field_id ?? null,
        result: resolution.result ?? null,
        target: resolution.target ?? null,
        damage_applied: resolution.damage_applied ?? 0,
        health_after: resolution.health_after ?? null,
        time_ms: nonNegativeNumber(resolution.time_ms, 0),
      })),
    ].sort((left, right) => (
      left.time_ms - right.time_ms
      || String(left.kind ?? "").localeCompare(String(right.kind ?? ""))
      || String(left.actor ?? "").localeCompare(String(right.actor ?? ""), "zh-Hant-TW")
      || String(left.action_id ?? "").localeCompare(String(right.action_id ?? ""))
    )),
    elapsed_ms: elapsedMs,
    projectile_scheduler: {
      ordering: "global_collision_time",
      iterations: projectileScheduler.iterations,
      strict_earlier_topology_mutation_visible_to_later_projectiles: true,
    },
    boundary: {
      projectile_collision_is_programmatic: true,
      cover_penetration_is_programmatic: true,
      ability_cost_and_field_effect_are_programmatic: true,
      immutable_physics_effect_version: worldSimulationImmutablePhysicsEffectVersion,
      immutable_projectile_lifecycle_version: worldSimulationImmutableProjectileLifecycleVersion,
      immutable_ability_field_lifecycle_version: worldSimulationImmutableAbilityFieldLifecycleVersion,
      ammo_energy_spawn_and_cover_effects_are_immutable_proposal_evaluators: true,
      projectile_flight_penetration_and_termination_are_immutable_proposal_evaluators: true,
      ability_field_spawn_tick_progression_and_expiration_are_immutable_proposal_evaluators: true,
      character_brain_selects_intent_only: true,
    },
  };
}
