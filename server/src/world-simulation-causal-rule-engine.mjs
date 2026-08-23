import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  adjudicateWorldSimulationCombat,
  buildWorldSimulationCombatCausalContract,
} from "./world-simulation-combat-causal-service.mjs";
import {
  adjudicateWorldSimulationContinuousPhysics,
  buildWorldSimulationContinuousPhysicsContract,
} from "./world-simulation-continuous-physics-service.mjs";
import {
  arbitrateWorldSimulationGlobalTimeline,
  buildResolvedWorldSimulationGlobalTimeline,
  buildWorldSimulationGlobalCausalTimelineContract,
} from "./world-simulation-global-causal-timeline-service.mjs";
import {
  applyWorldSimulationActorTrajectories,
  buildWorldSimulationActorStateContract,
  reconcileWorldSimulationMovementOutcomes,
} from "./world-simulation-actor-state-scheduler.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationMutationProposalBoundaryContract,
} from "./world-simulation-mutation-proposal-service.mjs";
import {
  buildWorldSimulationPureProposalProducerContract,
  projectWorldSimulationPureProposalTransitions,
  runWorldSimulationPureProposalProducer,
} from "./world-simulation-pure-proposal-producer-service.mjs";
import {
  buildWorldSimulationImmutableCausalEvaluatorContract,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "./world-simulation-immutable-causal-evaluator-service.mjs";
import {
  buildWorldSimulationImmutablePhysicsEffectContract,
  worldSimulationImmutablePhysicsEffectVersion,
} from "./world-simulation-immutable-physics-effect-service.mjs";
import {
  buildWorldSimulationImmutableProjectileLifecycleContract,
  worldSimulationImmutableProjectileLifecycleVersion,
} from "./world-simulation-immutable-projectile-lifecycle-service.mjs";
import {
  buildWorldSimulationImmutableAbilityFieldLifecycleContract,
  worldSimulationImmutableAbilityFieldLifecycleVersion,
} from "./world-simulation-immutable-ability-field-lifecycle-service.mjs";
import {
  buildWorldSimulationImmutableEventQueryContract,
  worldSimulationImmutableEventQueryVersion,
} from "./world-simulation-immutable-event-query-service.mjs";
import {
  buildWorldSimulationImmutableEventArbitrationContract,
  worldSimulationImmutableEventArbitrationVersion,
} from "./world-simulation-immutable-event-arbitration-service.mjs";
import {
  buildWorldSimulationCrossLayerEventArbitrationContract,
  worldSimulationCrossLayerEventArbitrationVersion,
} from "./world-simulation-cross-layer-event-arbitration-service.mjs";
import {
  buildWorldSimulationFixedPointConvergenceContract,
  worldSimulationFixedPointConvergenceVersion,
} from "./world-simulation-fixed-point-convergence-service.mjs";

export const worldSimulationCausalRuleEngineVersion = "phase62d-spatial-causal-rules-v1";

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

function positiveNumber(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function point(value) {
  const item = object(value);
  const x = finiteNumber(item.x);
  const y = finiteNumber(item.y);
  return x === null || y === null ? null : { x, y };
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function parseDurationMs(candidate, fallbackMs = 0) {
  const directMs = finiteNumber(candidate.duration_ms);
  if (directMs !== null && directMs >= 0) return directMs;
  const directSeconds = finiteNumber(candidate.duration_s ?? candidate.duration_seconds);
  if (directSeconds !== null && directSeconds >= 0) return directSeconds * 1000;
  const raw = candidate.duration_estimate ?? candidate.duration ?? null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return raw * 1000;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(ms|s|sec|secs|second|seconds)$/);
    if (match) {
      const amount = Number(match[1]);
      return match[2] === "ms" ? amount : amount * 1000;
    }
  }
  return fallbackMs;
}

function sceneForEvent(worldState, event) {
  const sceneId = String(event.scene_id ?? event.location_id ?? "").trim();
  const scenes = object(worldState.scenes);
  if (sceneId && isObject(scenes[sceneId])) {
    return { sceneId, scene: scenes[sceneId] };
  }
  if (isObject(worldState.scene_state)) {
    return { sceneId: worldState.scene_state.scene_id ?? "scene_state", scene: worldState.scene_state };
  }
  throw new Error("Causal rule engine requires a scene for the current event.");
}

function positionFor(scene, entity) {
  return point(object(scene.entity_positions)[entity]);
}

function sceneDimensions(scene) {
  const dimensions = object(scene.dimensions);
  return {
    width: positiveNumber(dimensions.width_m ?? dimensions.width, Number.POSITIVE_INFINITY),
    depth: positiveNumber(dimensions.depth_m ?? dimensions.depth, Number.POSITIVE_INFINITY),
  };
}

function withinBounds(scene, destination) {
  const dimensions = sceneDimensions(scene);
  return destination.x >= 0
    && destination.y >= 0
    && destination.x <= dimensions.width
    && destination.y <= dimensions.depth;
}

function rectangleForObstacle(raw) {
  const obstacle = object(raw);
  const xMin = finiteNumber(obstacle.x_min ?? obstacle.left);
  const xMax = finiteNumber(obstacle.x_max ?? obstacle.right);
  const yMin = finiteNumber(obstacle.y_min ?? obstacle.top);
  const yMax = finiteNumber(obstacle.y_max ?? obstacle.bottom);
  if ([xMin, xMax, yMin, yMax].every((value) => value !== null)) {
    return {
      id: obstacle.id ?? obstacle.obstacle_id ?? null,
      xMin: Math.min(xMin, xMax),
      xMax: Math.max(xMin, xMax),
      yMin: Math.min(yMin, yMax),
      yMax: Math.max(yMin, yMax),
    };
  }
  const center = point(obstacle.position ?? obstacle.center);
  const width = finiteNumber(obstacle.width_m ?? obstacle.width);
  const depth = finiteNumber(obstacle.depth_m ?? obstacle.depth ?? obstacle.height_m ?? obstacle.height);
  if (!center || width === null || depth === null) return null;
  return {
    id: obstacle.id ?? obstacle.obstacle_id ?? null,
    xMin: center.x - width / 2,
    xMax: center.x + width / 2,
    yMin: center.y - depth / 2,
    yMax: center.y + depth / 2,
  };
}

function pointInsideRectangle(position, rectangle) {
  return position.x >= rectangle.xMin
    && position.x <= rectangle.xMax
    && position.y >= rectangle.yMin
    && position.y <= rectangle.yMax;
}

function segmentIntersectsRectangle(from, to, rectangle) {
  if (pointInsideRectangle(from, rectangle) || pointInsideRectangle(to, rectangle)) return true;
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
    if (p === 0 && q < 0) return false;
    if (p === 0) continue;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return false;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return false;
      if (ratio < t1) t1 = ratio;
    }
  }
  return t0 <= t1;
}

function movementDestination(candidate, start) {
  const movement = object(candidate.movement);
  const explicit = point(movement.to ?? movement.destination ?? candidate.target_position);
  if (explicit) return explicit;
  const dx = finiteNumber(movement.dx, 0);
  const dy = finiteNumber(movement.dy, 0);
  if (dx === 0 && dy === 0) return null;
  return { x: start.x + dx, y: start.y + dy };
}

function routeForMovement(scene, movement) {
  const routeId = String(movement.route_id ?? movement.route ?? "").trim();
  if (!routeId) return { routeId: null, route: null };
  const routes = object(scene.routes);
  return { routeId, route: isObject(routes[routeId]) ? routes[routeId] : null };
}

function doorRecord(scene, doorId) {
  if (!doorId) return null;
  const doors = object(scene.doors);
  if (isObject(doors[doorId])) return { container: "doors", value: doors[doorId] };
  const exits = array(scene.exits);
  const index = exits.findIndex((item) => String(item?.id ?? item?.door_id ?? "") === doorId);
  if (index >= 0) return { container: "exits", index, value: exits[index] };
  return null;
}

function doorIdForRoute(route) {
  if (!isObject(route)) return null;
  const value = route.door_id ?? route.blocked_by_door_id ?? route.requires_open_door ?? null;
  return value === null || value === undefined ? null : String(value);
}

function actorMovementSpeed(worldState, actor) {
  const character = object(object(worldState.characters)[actor]);
  const rules = object(worldState.world_rules ?? worldState.rules);
  let speed = positiveNumber(
    character.movement_speed_mps ?? character.speed_mps,
    positiveNumber(rules.default_movement_speed_mps, 1.4),
  );
  const physical = object(character.physical_state);
  if (physical.immobilized === true || character.immobilized === true) return 0;
  const injuryMultiplier = finiteNumber(
    physical.movement_multiplier ?? object(character.injury).movement_multiplier,
    1,
  );
  const fatigueMultiplier = finiteNumber(
    object(character.fatigue).movement_multiplier ?? character.fatigue_movement_multiplier,
    1,
  );
  speed *= Math.max(0, injuryMultiplier) * Math.max(0, fatigueMultiplier);
  return speed;
}

function actorReach(worldState, actor) {
  const character = object(object(worldState.characters)[actor]);
  return positiveNumber(character.reach_m, 1.25);
}

function objectPosition(worldState, scene, objectState) {
  if (objectState.holder) return positionFor(scene, objectState.holder);
  return point(objectState.position ?? objectState.world_position);
}

function actionKind(candidate) {
  if (isObject(candidate.door_interaction)) return "door_interaction";
  if (isObject(candidate.object_interaction)) return "object_interaction";
  if (isObject(candidate.projectile)) return "projectile";
  if (isObject(candidate.ability)) return "ability";
  if (isObject(candidate.attack)) return "attack";
  if (isObject(candidate.movement)) return "movement";
  if (isObject(candidate.defense)) return "defense";
  return "passive";
}

function pushOutcome(outcomes, actor, candidate, result, causalEvidence, extra = {}) {
  outcomes.push({
    actor,
    action_id: candidate.action_id ?? null,
    action: candidate.intent ?? null,
    result,
    causal_evidence: causalEvidence,
    ...extra,
  });
}

function pushTransition(transitions, entity, field, from, to, cause, extra = {}) {
  if (JSON.stringify(from) === JSON.stringify(to)) return;
  transitions.push({ entity, field, from: cloneJson(from), to: cloneJson(to), cause, ...extra });
}

function addMilliseconds(isoTime, elapsedMs) {
  const parsed = Date.parse(isoTime);
  if (!Number.isFinite(parsed)) return isoTime;
  return new Date(parsed + elapsedMs).toISOString();
}

function finalObjectHolders(worldState) {
  return Object.entries(object(worldState.objects)).flatMap(([objectId, value]) => {
    const holder = object(value).holder;
    return holder ? [{ object_id: objectId, holder }] : [];
  });
}

function pickupClaims(selectedActionIntents) {
  const claims = new Map();
  for (const selected of selectedActionIntents) {
    const interaction = object(selected?.candidate?.object_interaction);
    if (interaction.type !== "pickup") continue;
    const objectId = String(interaction.object_id ?? "").trim();
    if (!objectId) continue;
    if (!claims.has(objectId)) claims.set(objectId, []);
    claims.get(objectId).push(selected.character);
  }
  return claims;
}

function movementPlans(worldState, scene, selectedActionIntents) {
  const plans = new Map();
  for (const selected of selectedActionIntents) {
    const candidate = object(selected?.candidate);
    if (!isObject(candidate.movement)) continue;
    const start = positionFor(scene, selected.character);
    if (!start) continue;
    const destination = movementDestination(candidate, start);
    if (!destination) continue;
    plans.set(selected.character, { start, destination });
  }
  return plans;
}

function movementDestinationConflicts(worldState, scene, plans) {
  const rules = object(worldState.world_rules ?? worldState.rules);
  const radius = positiveNumber(rules.collision_radius_m, 0.4);
  const conflicts = new Map();
  const entries = [...plans.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    const [actorA, planA] = entries[i];
    for (let j = i + 1; j < entries.length; j += 1) {
      const [actorB, planB] = entries[j];
      if (distance(planA.destination, planB.destination) < radius * 2) {
        conflicts.set(actorA, `simultaneous_destination_conflict:${actorB}`);
        conflicts.set(actorB, `simultaneous_destination_conflict:${actorA}`);
      }
    }
  }
  const movingActors = new Set(plans.keys());
  for (const [actor, plan] of plans.entries()) {
    for (const [entity, rawPosition] of Object.entries(object(scene.entity_positions))) {
      if (entity === actor || movingActors.has(entity)) continue;
      const otherPosition = point(rawPosition);
      if (otherPosition && distance(plan.destination, otherPosition) < radius * 2) {
        conflicts.set(actor, `destination_occupied_by:${entity}`);
      }
    }
  }
  return conflicts;
}

function validateMovement(worldState, scene, actor, candidate, movementConflict) {
  const start = positionFor(scene, actor);
  if (!start) return { ok: false, reason: "actor_has_no_scene_position", durationMs: 0 };
  const destination = movementDestination(candidate, start);
  if (!destination) return { ok: false, reason: "movement_has_no_destination", durationMs: 0 };
  const speed = actorMovementSpeed(worldState, actor);
  const travelDistance = distance(start, destination);
  const physicalDurationMs = speed > 0 ? travelDistance / speed * 1000 : Number.POSITIVE_INFINITY;
  const requestedDurationMs = parseDurationMs(candidate, 0);
  const durationMs = Number.isFinite(physicalDurationMs)
    ? Math.max(requestedDurationMs, physicalDurationMs)
    : requestedDurationMs;
  if (speed <= 0) return { ok: false, reason: "actor_cannot_move", durationMs };
  if (!withinBounds(scene, destination)) {
    return { ok: false, reason: "destination_out_of_scene_bounds", durationMs };
  }
  if (movementConflict) return { ok: false, reason: movementConflict, durationMs };
  const movement = object(candidate.movement);
  const { routeId, route } = routeForMovement(scene, movement);
  if (routeId && !route) {
    return { ok: false, reason: `unknown_route:${routeId}`, durationMs };
  }
  const doorId = doorIdForRoute(route);
  if (doorId) {
    const door = doorRecord(scene, doorId);
    if (!door) return { ok: false, reason: `unknown_door:${doorId}`, durationMs };
    if (door.value.open !== true) {
      return { ok: false, reason: `route_blocked_by_closed_door:${doorId}`, durationMs };
    }
  }
  for (const raw of array(scene.obstacles)) {
    const obstacle = object(raw);
    if (obstacle.destroyed === true || obstacle.passable === true || obstacle.collision_enabled === false) continue;
    const rectangle = rectangleForObstacle(obstacle);
    if (rectangle && segmentIntersectsRectangle(start, destination, rectangle)) {
      return {
        ok: false,
        reason: `path_blocked_by_obstacle:${rectangle.id ?? "unnamed"}`,
        durationMs,
      };
    }
  }
  return { ok: true, start, destination, durationMs, travelDistance, speed };
}

function resolveDoorInteraction(snapshotScene, nextScene, actor, candidate, rules, outcomes, transitions) {
  const interaction = object(candidate.door_interaction);
  const doorId = String(interaction.door_id ?? interaction.id ?? "").trim();
  const operation = String(interaction.operation ?? interaction.action ?? "").trim();
  const durationMs = parseDurationMs(candidate, positiveNumber(rules.door_interaction_seconds, 0.5) * 1000);
  if (!doorId || !["open", "close"].includes(operation)) {
    pushOutcome(outcomes, actor, candidate, "blocked", "door interaction requires door_id and open/close operation");
    return durationMs;
  }
  const currentDoor = doorRecord(snapshotScene, doorId);
  const nextDoor = doorRecord(nextScene, doorId);
  if (!currentDoor || !nextDoor) {
    pushOutcome(outcomes, actor, candidate, "blocked", `door does not exist: ${doorId}`);
    return durationMs;
  }
  if (operation === "open" && currentDoor.value.locked === true) {
    pushOutcome(outcomes, actor, candidate, "blocked", `door is locked at turn start: ${doorId}`);
    return durationMs;
  }
  const before = currentDoor.value.open === true;
  const after = operation === "open";
  nextDoor.value.open = after;
  pushTransition(transitions, doorId, "open", before, after, `${actor} performed ${operation} on ${doorId}`, {
    time_ms: durationMs,
    actor,
    action_id: candidate.action_id ?? null,
    source_layer: "spatial_rules",
  });
  pushOutcome(outcomes, actor, candidate, `door_${operation}ed`, `door ${doorId} was ${before ? "open" : "closed"} and not causally blocked`);
  return durationMs;
}

function resolveObjectInteraction(snapshot, next, sceneId, snapshotScene, nextScene, actor, candidate, claims, rules, outcomes, transitions) {
  const interaction = object(candidate.object_interaction);
  const type = String(interaction.type ?? "").trim();
  const objectId = String(interaction.object_id ?? "").trim();
  const durationMs = parseDurationMs(candidate, positiveNumber(rules.object_interaction_seconds, 0.5) * 1000);
  if (!objectId || !["pickup", "drop", "transfer"].includes(type)) {
    pushOutcome(outcomes, actor, candidate, "blocked", "object interaction requires type and object_id");
    return durationMs;
  }
  const snapshotObject = object(object(snapshot.objects)[objectId]);
  const nextObject = object(object(next.objects)[objectId]);
  if (!Object.hasOwn(object(snapshot.objects), objectId)) {
    pushOutcome(outcomes, actor, candidate, "blocked", `object does not exist: ${objectId}`);
    return durationMs;
  }
  const actorPosition = positionFor(snapshotScene, actor);
  const reach = actorReach(snapshot, actor);
  if (type === "pickup") {
    if ((claims.get(objectId) ?? []).length > 1) {
      pushOutcome(outcomes, actor, candidate, "blocked", `simultaneous pickup contention for ${objectId}`);
      return durationMs;
    }
    if (snapshotObject.holder) {
      pushOutcome(outcomes, actor, candidate, "blocked", `${objectId} already held by ${snapshotObject.holder}`);
      return durationMs;
    }
    if (snapshotObject.scene_id && snapshotObject.scene_id !== sceneId) {
      pushOutcome(outcomes, actor, candidate, "blocked", `${objectId} is in another scene`);
      return durationMs;
    }
    const itemPosition = objectPosition(snapshot, snapshotScene, snapshotObject);
    if (!actorPosition || !itemPosition || distance(actorPosition, itemPosition) > reach) {
      pushOutcome(outcomes, actor, candidate, "blocked", `${objectId} is outside ${actor}'s reach`);
      return durationMs;
    }
    nextObject.holder = actor;
    nextObject.scene_id = null;
    nextObject.position = null;
    const transitionExtra = { time_ms: durationMs, actor, action_id: candidate.action_id ?? null, source_layer: "spatial_rules" };
    pushTransition(transitions, objectId, "holder", snapshotObject.holder ?? null, actor, `${actor} picked up ${objectId}`, transitionExtra);
    pushTransition(transitions, objectId, "scene_id", snapshotObject.scene_id ?? null, null, `${actor} picked up ${objectId}`, transitionExtra);
    pushTransition(transitions, objectId, "position", snapshotObject.position ?? null, null, `${actor} picked up ${objectId}`, transitionExtra);
    pushOutcome(outcomes, actor, candidate, "pickup_completed", `${objectId} was unheld and within ${reach}m reach`);
    return durationMs;
  }
  if (snapshotObject.holder !== actor) {
    pushOutcome(outcomes, actor, candidate, "blocked", `${actor} is not the holder of ${objectId}`);
    return durationMs;
  }
  if (type === "drop") {
    nextObject.holder = null;
    nextObject.scene_id = sceneId;
    nextObject.position = actorPosition ? cloneJson(actorPosition) : null;
    const transitionExtra = { time_ms: durationMs, actor, action_id: candidate.action_id ?? null, source_layer: "spatial_rules" };
    pushTransition(transitions, objectId, "holder", actor, null, `${actor} dropped ${objectId}`, transitionExtra);
    pushTransition(transitions, objectId, "scene_id", snapshotObject.scene_id ?? null, sceneId, `${actor} dropped ${objectId}`, transitionExtra);
    pushTransition(transitions, objectId, "position", snapshotObject.position ?? null, actorPosition ? cloneJson(actorPosition) : null, `${actor} dropped ${objectId}`, transitionExtra);
    pushOutcome(outcomes, actor, candidate, "drop_completed", `${actor} held ${objectId} at turn start`);
    return durationMs;
  }
  const target = String(interaction.target_character ?? interaction.target ?? "").trim();
  const targetPosition = positionFor(snapshotScene, target);
  if (!target || !actorPosition || !targetPosition || distance(actorPosition, targetPosition) > reach) {
    pushOutcome(outcomes, actor, candidate, "blocked", `transfer target is outside ${actor}'s reach`);
    return durationMs;
  }
  nextObject.holder = target;
  nextObject.scene_id = null;
  nextObject.position = null;
  const transitionExtra = { time_ms: durationMs, actor, action_id: candidate.action_id ?? null, source_layer: "spatial_rules" };
  pushTransition(transitions, objectId, "holder", actor, target, `${actor} transferred ${objectId} to ${target}`, transitionExtra);
  pushTransition(transitions, objectId, "scene_id", snapshotObject.scene_id ?? null, null, `${actor} transferred ${objectId} to ${target}`, transitionExtra);
  pushTransition(transitions, objectId, "position", snapshotObject.position ?? null, null, `${actor} transferred ${objectId} to ${target}`, transitionExtra);
  pushOutcome(outcomes, actor, candidate, "transfer_completed", `${actor} held ${objectId} and ${target} was within reach`);
  return durationMs;
}

function resolveAttack(snapshot, snapshotScene, actor, candidate, rules, outcomes) {
  const attack = object(candidate.attack);
  const target = String(attack.target_character ?? attack.target ?? candidate.target ?? "").trim();
  const durationMs = parseDurationMs(candidate, positiveNumber(rules.attack_attempt_seconds, 0.5) * 1000);
  const actorPosition = positionFor(snapshotScene, actor);
  const targetPosition = positionFor(snapshotScene, target);
  if (!target || !actorPosition || !targetPosition) {
    pushOutcome(outcomes, actor, candidate, "blocked", "attack requires actor and target positions");
    return durationMs;
  }
  const weaponId = String(attack.weapon_id ?? "").trim();
  if (weaponId) {
    const weapon = object(object(snapshot.objects)[weaponId]);
    if (!Object.hasOwn(object(snapshot.objects), weaponId) || weapon.holder !== actor) {
      pushOutcome(outcomes, actor, candidate, "blocked", `${actor} does not hold required weapon ${weaponId}`);
      return durationMs;
    }
    if (weapon.broken === true || weapon.enabled === false || weapon.state === "broken") {
      pushOutcome(outcomes, actor, candidate, "blocked", `required weapon ${weaponId} is unusable`);
      return durationMs;
    }
  }
  const range = positiveNumber(attack.range_m, positiveNumber(rules.default_attack_range_m, 1.5));
  const separation = distance(actorPosition, targetPosition);
  if (separation > range) {
    pushOutcome(outcomes, actor, candidate, "out_of_range", `target distance ${separation.toFixed(3)}m exceeds attack range ${range}m`, {
      target,
      distance_m: separation,
      range_m: range,
      contact_resolved: false,
    });
    return durationMs;
  }
  pushOutcome(outcomes, actor, candidate, "attack_window_valid", `target distance ${separation.toFixed(3)}m is within attack range ${range}m`, {
    target,
    distance_m: separation,
    range_m: range,
    contact_resolved: false,
    combat_boundary: "Range validity alone does not imply hit, injury, or damage.",
  });
  return durationMs;
}


function resolveSpatialRulePreview(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const next = cloneJson(snapshot);
  const event = object(input.event);
  const selectedActionIntents = array(input.selected_action_intents);
  const sceneId = String(input.scene_id ?? event.scene_id ?? event.location_id ?? "").trim();
  const snapshotScene = object(object(snapshot.scenes)[sceneId] ?? snapshot.scene_state);
  const nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);
  const rules = object(snapshot.world_rules ?? snapshot.rules);
  const transitions = [];
  const outcomes = [];
  const claims = pickupClaims(selectedActionIntents);
  const plans = movementPlans(snapshot, snapshotScene, selectedActionIntents);
  const movementConflicts = movementDestinationConflicts(snapshot, snapshotScene, plans);
  let elapsedMs = 0;

  for (const selected of selectedActionIntents) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    if (!actor || selected?.selection === "reject_all" || !Object.keys(candidate).length) {
      pushOutcome(outcomes, actor || null, candidate, "no_action_selected", "character brain rejected all candidate intents");
      continue;
    }
    const kind = actionKind(candidate);
    if (kind === "movement") {
      const movement = validateMovement(snapshot, snapshotScene, actor, candidate, movementConflicts.get(actor));
      elapsedMs = Math.max(elapsedMs, movement.durationMs ?? 0);
      if (!movement.ok) {
        pushOutcome(outcomes, actor, candidate, "movement_blocked", movement.reason);
        continue;
      }
      const before = positionFor(snapshotScene, actor);
      nextScene.entity_positions = object(nextScene.entity_positions);
      nextScene.entity_positions[actor] = cloneJson(movement.destination);
      pushTransition(
        transitions,
        actor,
        "position",
        before,
        movement.destination,
        `movement path validated: ${movement.travelDistance.toFixed(3)}m at ${movement.speed.toFixed(3)}m/s`,
        { scene_id: sceneId },
      );
      pushOutcome(
        outcomes,
        actor,
        candidate,
        "movement_completed",
        "destination in bounds, route open, obstacle path clear, and destination collision-free",
        { distance_m: movement.travelDistance, duration_ms: movement.durationMs },
      );
      continue;
    }
    if (kind === "door_interaction") {
      const durationMs = resolveDoorInteraction(snapshotScene, nextScene, actor, candidate, rules, outcomes, transitions);
      elapsedMs = Math.max(elapsedMs, durationMs);
      continue;
    }
    if (kind === "object_interaction") {
      const durationMs = resolveObjectInteraction(
        snapshot,
        next,
        sceneId,
        snapshotScene,
        nextScene,
        actor,
        candidate,
        claims,
        rules,
        outcomes,
        transitions,
      );
      elapsedMs = Math.max(elapsedMs, durationMs);
      continue;
    }
    if (kind === "projectile" || kind === "ability") {
      const durationMs = parseDurationMs(candidate, positiveNumber(rules.physics_action_seconds, 0.5) * 1000);
      elapsedMs = Math.max(elapsedMs, durationMs);
      pushOutcome(
        outcomes,
        actor,
        candidate,
        "continuous_physics_intent_registered",
        `${kind} intent registered; launch, resource use, collision, penetration, and persistent effects are resolved by the programmatic continuous-physics layer`,
      );
      continue;
    }
    if (kind === "attack") continue;
    if (kind === "defense") {
      const defense = object(candidate.defense);
      const durationMs = parseDurationMs(candidate, positiveNumber(rules.defense_action_seconds, 0.5) * 1000);
      elapsedMs = Math.max(elapsedMs, durationMs);
      pushOutcome(
        outcomes,
        actor,
        candidate,
        "defense_declared",
        `defense intent ${String(defense.type ?? defense.mode ?? "unspecified")} is registered; efficacy is resolved by the programmatic combat causal layer`,
      );
      continue;
    }
    const durationMs = parseDurationMs(candidate, positiveNumber(rules.passive_action_seconds, 0.25) * 1000);
    elapsedMs = Math.max(elapsedMs, durationMs);
    pushOutcome(outcomes, actor, candidate, "passive_action_recorded", "action declared no spatial or object mutation fields");
  }

  return {
    next_world_state: next,
    next_world_state_authority: "private_solver_preview_only",
    state_transitions: transitions,
    mutation_proposals: transitions,
    action_outcomes: outcomes,
    elapsed_ms: elapsedMs,
  };
}

export function buildWorldSimulationCausalRuleContract() {
  return {
    version: worldSimulationCausalRuleEngineVersion,
    owner: "programmatic_causal_adjudicator",
    reads_world_truth: true,
    writes_world_truth: "through_world_state_commit_only",
    simultaneous_action_preconditions: "turn_start_snapshot",
    movement: {
      bounds_enforced: true,
      speed_and_duration_enforced: true,
      route_door_state_enforced: true,
      rectangular_obstacle_intersection_enforced: true,
      end_position_collision_enforced: true,
    },
    objects: {
      exclusive_holder_enforced: true,
      reach_enforced: true,
      simultaneous_pickup_contention_blocks_all_claimants: true,
    },
    combat: {
      weapon_holder_state_enforced: true,
      range_enforced: true,
      range_validity_does_not_imply_hit: true,
      combat_causal_layer: buildWorldSimulationCombatCausalContract(),
    },
    continuous_physics: buildWorldSimulationContinuousPhysicsContract(),
    global_causal_timeline: buildWorldSimulationGlobalCausalTimelineContract(),
    continuous_actor_state: buildWorldSimulationActorStateContract(),
    chronological_mutation_queue: buildWorldSimulationChronologicalMutationQueueContract(),
    mutation_proposal_boundary: buildWorldSimulationMutationProposalBoundaryContract(),
    pure_proposal_producers: buildWorldSimulationPureProposalProducerContract(),
    immutable_causal_evaluators: buildWorldSimulationImmutableCausalEvaluatorContract(),
    immutable_physics_effects: buildWorldSimulationImmutablePhysicsEffectContract(),
    immutable_projectile_lifecycle: buildWorldSimulationImmutableProjectileLifecycleContract(),
    immutable_ability_field_lifecycle: buildWorldSimulationImmutableAbilityFieldLifecycleContract(),
    immutable_event_queries: buildWorldSimulationImmutableEventQueryContract(),
    immutable_event_arbitration: buildWorldSimulationImmutableEventArbitrationContract(),
    cross_layer_event_arbitration: buildWorldSimulationCrossLayerEventArbitrationContract(),
    fixed_point_convergence: buildWorldSimulationFixedPointConvergenceContract(),
    time: {
      turn_elapsed_ms: "maximum_resolved_action_duration",
      cross_layer_point_event_order: "global_programmatic_timeline",
    },
  };
}

export async function adjudicateWorldSimulationCausality(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  let next = cloneJson(snapshot);
  const event = object(input.event);
  const selectedActionIntents = array(input.selected_action_intents);
  const { sceneId, scene: snapshotScene } = sceneForEvent(snapshot, event);
  let nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);
  const transitions = [];
  const outcomes = [];
  const knowledgeTransitions = [];
  const scheduledEvents = [];
  const mutationProposalBoundaryAudits = [];
  const pureProposalProducerAudits = [];
  const immutableCausalEvaluatorAudits = [];
  const immutableCausalQueryAudits = [];
  const immutableEventArbitrationAudits = [];
  let elapsedMs = 0;

  const spatialProduced = runWorldSimulationPureProposalProducer({
    producer: "spatial_rules",
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    root_world_state: snapshot,
    authoritative_world_state: next,
    existing_state_transitions: transitions,
    causal_timeline: { entries: [] },
    elapsed_ms: 0,
    scene_id: sceneId,
    solve: ({ isolated_preview_world_state: isolatedPreview }) => resolveSpatialRulePreview({
      world_state: isolatedPreview,
      event,
      scene_id: sceneId,
      selected_action_intents: selectedActionIntents,
    }),
  });
  transitions.push(...array(spatialProduced.proposal_package.mutation_proposals));
  outcomes.push(...array(spatialProduced.result.action_outcomes));
  elapsedMs = Math.max(elapsedMs, finiteNumber(spatialProduced.result.elapsed_ms, 0));
  mutationProposalBoundaryAudits.push(spatialProduced.audit);
  pureProposalProducerAudits.push(spatialProduced.audit);
  const spatialProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [] },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = spatialProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);

  const spatialPreviewOutcomes = cloneJson(outcomes);
  const timelineArbitration = arbitrateWorldSimulationGlobalTimeline({
    world_state: snapshot,
    world_state_revision: input.world_state_revision ?? 0,
    world_state_hash: input.world_state_hash ?? hashAgentRunValue(snapshot),
    next_world_state: next,
    scene_id: sceneId,
    event,
    turn_id: input.turn_id ?? null,
    selected_action_intents: selectedActionIntents,
    resolved_action_outcomes: spatialPreviewOutcomes,
    elapsed_ms: elapsedMs,
  });
  const suppressedActionIds = array(timelineArbitration.suppressed_action_ids);
  const actionTimeOverrides = object(timelineArbitration.action_time_overrides);
  const actorTrajectories = object(timelineArbitration.actor_trajectories);
  for (const override of Object.values(actionTimeOverrides)) {
    for (const value of Object.values(object(override))) {
      elapsedMs = Math.max(elapsedMs, finiteNumber(value, 0));
    }
  }
  for (const trajectory of Object.values(actorTrajectories)) {
    const completion = finiteNumber(trajectory?.completion_time_ms);
    const interrupted = finiteNumber(trajectory?.interrupted_at_ms);
    if (completion !== null) elapsedMs = Math.max(elapsedMs, completion);
    else if (interrupted !== null) elapsedMs = Math.max(elapsedMs, interrupted);
  }
  reconcileWorldSimulationMovementOutcomes(outcomes, actorTrajectories);
  for (let index = transitions.length - 1; index >= 0; index -= 1) {
    const transition = transitions[index];
    if (transition?.field === "position" && Object.hasOwn(actorTrajectories, String(transition.entity ?? ""))) {
      transitions.splice(index, 1);
    }
  }
  const movementProposalBaseProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = movementProposalBaseProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);

  const actorStateProduced = runWorldSimulationPureProposalProducer({
    producer: "continuous_actor_state_precombat",
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    root_world_state: snapshot,
    authoritative_world_state: next,
    existing_state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
    solve: ({ isolated_preview_world_state: isolatedPreview }) => {
      const producerTransitions = [];
      const applied = applyWorldSimulationActorTrajectories(
        isolatedPreview,
        sceneId,
        actorTrajectories,
        elapsedMs,
        producerTransitions,
      );
      return {
        next_world_state: applied.next_world_state,
        next_world_state_authority: "private_solver_preview_only",
        state_transitions: producerTransitions,
        mutation_proposals: producerTransitions,
        final_positions: applied.final_positions,
      };
    },
  });
  transitions.push(...array(actorStateProduced.proposal_package.mutation_proposals));
  mutationProposalBoundaryAudits.push(actorStateProduced.audit);
  pureProposalProducerAudits.push(actorStateProduced.audit);
  const actorStateProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = actorStateProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);
  const spatialActionOutcomes = cloneJson(outcomes);
  for (const preemption of array(timelineArbitration.preemptions)) {
    outcomes.push({
      actor: preemption.actor ?? null,
      action_id: preemption.action_id ?? null,
      action: null,
      result: "action_preempted_by_earlier_incapacitation",
      causal_evidence: `${preemption.cause} at ${Number(preemption.preempted_at_ms).toFixed(3)}ms occurred before scheduled ${preemption.action_kind} execution at ${Number(preemption.scheduled_time_ms).toFixed(3)}ms`,
      preempted_at_ms: preemption.preempted_at_ms,
      scheduled_time_ms: preemption.scheduled_time_ms,
      caused_by_actor: preemption.caused_by_actor ?? null,
      caused_by_action_id: preemption.caused_by_action_id ?? null,
      projectile_id: preemption.projectile_id ?? null,
      adjudication: "programmatic_global_causal_timeline",
    });
  }

  const combatProduced = runWorldSimulationPureProposalProducer({
    producer: "combat",
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    root_world_state: snapshot,
    authoritative_world_state: next,
    existing_state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
    solve: ({ isolated_preview_world_state: isolatedPreview }) => adjudicateWorldSimulationCombat({
      world_state: snapshot,
      next_world_state: isolatedPreview,
      scene_id: sceneId,
      event,
      selected_action_intents: selectedActionIntents,
      resolved_action_outcomes: outcomes,
      suppressed_action_ids: suppressedActionIds,
      action_time_overrides: actionTimeOverrides,
      actor_trajectories: actorTrajectories,
    }),
  });
  const combatResolution = {
    ...combatProduced.result,
    state_transitions: cloneJson(combatProduced.proposal_package.mutation_proposals),
    mutation_proposals: cloneJson(combatProduced.proposal_package.mutation_proposals),
  };
  immutableCausalEvaluatorAudits.push(...array(combatResolution.immutable_causal_evaluator_audits));
  transitions.push(...array(combatProduced.proposal_package.mutation_proposals));
  outcomes.push(...array(combatResolution.action_outcomes));
  elapsedMs = Math.max(elapsedMs, finiteNumber(combatResolution.elapsed_ms, 0));
  mutationProposalBoundaryAudits.push(combatProduced.audit);
  pureProposalProducerAudits.push(combatProduced.audit);
  const combatProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = combatProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);

  const physicsProduced = runWorldSimulationPureProposalProducer({
    producer: "continuous_physics",
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    root_world_state: snapshot,
    authoritative_world_state: next,
    existing_state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
    solve: ({ isolated_preview_world_state: isolatedPreview }) => adjudicateWorldSimulationContinuousPhysics({
      world_state: snapshot,
      next_world_state: isolatedPreview,
      scene_id: sceneId,
      event,
      turn_id: input.turn_id ?? null,
      selected_action_intents: selectedActionIntents,
      resolved_action_outcomes: outcomes,
      elapsed_ms: elapsedMs,
      suppressed_action_ids: suppressedActionIds,
      action_time_overrides: actionTimeOverrides,
      actor_trajectories: actorTrajectories,
    }),
  });
  const physicsResolution = {
    ...physicsProduced.result,
    state_transitions: cloneJson(physicsProduced.proposal_package.mutation_proposals),
    mutation_proposals: cloneJson(physicsProduced.proposal_package.mutation_proposals),
  };
  immutableCausalEvaluatorAudits.push(...array(physicsResolution.immutable_causal_evaluator_audits));
  immutableCausalQueryAudits.push(...array(physicsResolution.immutable_causal_query_audits));
  immutableEventArbitrationAudits.push(...array(physicsResolution.immutable_event_arbitration_audits));
  transitions.push(...array(physicsProduced.proposal_package.mutation_proposals));
  outcomes.push(...array(physicsResolution.action_outcomes));
  mutationProposalBoundaryAudits.push(physicsProduced.audit);
  pureProposalProducerAudits.push(physicsProduced.audit);
  const physicsProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = physicsProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);

  const postPhysicsActorProduced = runWorldSimulationPureProposalProducer({
    producer: "continuous_actor_state_postphysics",
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    root_world_state: snapshot,
    authoritative_world_state: next,
    existing_state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
    solve: ({ isolated_preview_world_state: isolatedPreview }) => {
      const producerTransitions = [];
      const applied = applyWorldSimulationActorTrajectories(
        isolatedPreview,
        sceneId,
        actorTrajectories,
        elapsedMs,
        producerTransitions,
      );
      return {
        next_world_state: applied.next_world_state,
        next_world_state_authority: "private_solver_preview_only",
        state_transitions: producerTransitions,
        mutation_proposals: producerTransitions,
        final_positions: applied.final_positions,
      };
    },
  });
  transitions.push(...array(postPhysicsActorProduced.proposal_package.mutation_proposals));
  mutationProposalBoundaryAudits.push(postPhysicsActorProduced.audit);
  pureProposalProducerAudits.push(postPhysicsActorProduced.audit);
  const postPhysicsActorProjection = projectWorldSimulationPureProposalTransitions({
    root_world_state: snapshot,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: { entries: [], actor_trajectories: actorTrajectories },
    elapsed_ms: elapsedMs,
    scene_id: sceneId,
  });
  next = postPhysicsActorProjection.projected_world_state;
  nextScene = object(object(next.scenes)[sceneId] ?? next.scene_state);

  const causalTimeline = buildResolvedWorldSimulationGlobalTimeline({
    arbitration: timelineArbitration,
    spatial_action_outcomes: spatialActionOutcomes,
    combat_resolution: combatResolution,
    physics_resolution: physicsResolution,
  });

  const previousTime = snapshot.simulation_time ?? event.simulation_time ?? null;
  if (typeof previousTime === "string" && elapsedMs > 0) {
    const nextTime = addMilliseconds(previousTime, elapsedMs);
    next.simulation_time = nextTime;
    if (nextScene) nextScene.simulation_time = nextTime;
    pushTransition(
      transitions,
      "world",
      "simulation_time",
      previousTime,
      nextTime,
      `maximum resolved action duration elapsed: ${elapsedMs}ms`,
      { time_ms: elapsedMs, source_layer: "causal_resolution" },
    );
    if (nextScene) {
      pushTransition(
        transitions,
        sceneId,
        "simulation_time",
        snapshotScene.simulation_time ?? previousTime,
        nextTime,
        `scene clock advanced with world time by ${elapsedMs}ms`,
        { time_ms: elapsedMs, source_layer: "causal_resolution", scene_id: sceneId },
      );
    }
  }

  const queue = array(snapshot.event_queue);
  const currentEventId = String(event.event_id ?? event.id ?? "");
  const queueHeadId = String(queue[0]?.event_id ?? queue[0]?.id ?? "");
  if (queueHeadId && currentEventId && queueHeadId !== currentEventId) {
    const error = new Error("Causal rule engine received an event that is not the queue head.");
    error.code = "WORLD_SIMULATION_CAUSAL_EVENT_ORDER_VIOLATION";
    throw error;
  }
  const followUps = array(event.next_events ?? event.follow_up_events).map(cloneJson);
  next.event_queue = [...queue.slice(1), ...followUps];
  pushTransition(
    transitions,
    "world",
    "event_queue",
    queue,
    next.event_queue,
    `resolved queue-head event ${currentEventId || "<unnamed>"} and scheduled follow-ups`,
    { time_ms: elapsedMs, source_layer: "causal_resolution" },
  );
  for (const followUp of followUps) {
    scheduledEvents.push(followUp.event_id ?? followUp.id ?? followUp);
  }

  const chronologicalMutationQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: causalTimeline,
    elapsed_ms: elapsedMs,
  });
  const mutationExecution = executeWorldSimulationChronologicalMutationQueue({
    world_state: snapshot,
    preview_world_state: next,
    queue: chronologicalMutationQueue,
    scene_id: sceneId,
  });
  next = mutationExecution.next_world_state;

  const causalResolutionId = `causal_${hashAgentRunValue({
    engine: worldSimulationCausalRuleEngineVersion,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    event_id: currentEventId,
    selected_action_intents: selectedActionIntents,
    transitions,
    outcomes,
    causal_timeline_hash: causalTimeline.timeline_hash,
    chronological_mutation_queue_hash: chronologicalMutationQueue.queue_hash,
    mutation_execution_hash: mutationExecution.execution.execution_hash,
  }).slice(0, 24)}`;

  return {
    causal_rule_engine_version: worldSimulationCausalRuleEngineVersion,
    causal_resolution_id: causalResolutionId,
    next_world_state: next,
    state_transitions: transitions,
    action_outcomes: outcomes,
    knowledge_transitions: knowledgeTransitions,
    scheduled_events: scheduledEvents,
    object_holders: finalObjectHolders(next),
    causal_timeline: causalTimeline,
    causal_epochs: cloneJson(causalTimeline.causal_epochs ?? null),
    fixed_point_convergence: cloneJson(causalTimeline.fixed_point_convergence ?? null),
    chronological_mutation_queue: chronologicalMutationQueue,
    chronological_mutation_execution: mutationExecution.execution,
    mutation_proposal_boundary: {
      version: buildWorldSimulationMutationProposalBoundaryContract().version,
      audit_count: mutationProposalBoundaryAudits.length,
      audits: mutationProposalBoundaryAudits,
      subsystem_preview_world_state_authoritative: false,
      executor_projection_is_only_inter_subsystem_handoff_state: true,
    },
    pure_proposal_producers: {
      version: buildWorldSimulationPureProposalProducerContract().version,
      audit_count: pureProposalProducerAudits.length,
      audits: pureProposalProducerAudits,
      producer_outputs_contain_world_state: false,
      internal_preview_states_discarded_before_return: true,
      inter_subsystem_handoffs_use_executor_projection_only: true,
    },
    immutable_causal_evaluators: {
      version: worldSimulationImmutableCausalEvaluatorVersion,
      audit_count: immutableCausalEvaluatorAudits.length,
      audits: immutableCausalEvaluatorAudits,
      evaluator_inputs_immutable: immutableCausalEvaluatorAudits.every((audit) => audit?.input_context_immutable === true),
      evaluator_outputs_contain_world_state: false,
      deterministic_replay_verified: immutableCausalEvaluatorAudits.every((audit) => audit?.deterministic_replay_verified === true),
    },
    immutable_physics_effects: (() => {
      const contract = buildWorldSimulationImmutablePhysicsEffectContract();
      const migrated = new Set(contract.migrated_effect_evaluators);
      const audits = immutableCausalEvaluatorAudits.filter((audit) => migrated.has(String(audit?.evaluator ?? "")));
      return {
        version: worldSimulationImmutablePhysicsEffectVersion,
        audit_count: audits.length,
        audits,
        evaluator_inputs_immutable: audits.every((audit) => audit?.input_context_immutable === true),
        evaluator_outputs_contain_world_state: false,
        deterministic_replay_verified: audits.every((audit) => audit?.deterministic_replay_verified === true),
      };
    })(),
    immutable_projectile_lifecycle: (() => {
      const contract = buildWorldSimulationImmutableProjectileLifecycleContract();
      const migrated = new Set(contract.migrated_lifecycle_evaluators);
      const audits = immutableCausalEvaluatorAudits.filter((audit) => migrated.has(String(audit?.evaluator ?? "")));
      return {
        version: worldSimulationImmutableProjectileLifecycleVersion,
        audit_count: audits.length,
        audits,
        evaluator_inputs_immutable: audits.every((audit) => audit?.input_context_immutable === true),
        evaluator_outputs_contain_world_state: false,
        deterministic_replay_verified: audits.every((audit) => audit?.deterministic_replay_verified === true),
      };
    })(),
    immutable_ability_field_lifecycle: (() => {
      const contract = buildWorldSimulationImmutableAbilityFieldLifecycleContract();
      const migrated = new Set(contract.migrated_lifecycle_evaluators);
      const audits = immutableCausalEvaluatorAudits.filter((audit) => migrated.has(String(audit?.evaluator ?? "")));
      return {
        version: worldSimulationImmutableAbilityFieldLifecycleVersion,
        audit_count: audits.length,
        audits,
        evaluator_inputs_immutable: audits.every((audit) => audit?.input_context_immutable === true),
        evaluator_outputs_contain_world_state: false,
        deterministic_replay_verified: audits.every((audit) => audit?.deterministic_replay_verified === true),
      };
    })(),
    immutable_event_queries: {
      version: worldSimulationImmutableEventQueryVersion,
      audit_count: immutableCausalQueryAudits.length,
      audits: immutableCausalQueryAudits,
      query_inputs_immutable: immutableCausalQueryAudits.every((audit) => audit?.input_context_immutable === true),
      query_outputs_contain_world_state: false,
      query_outputs_contain_mutation_proposals: false,
      deterministic_replay_verified: immutableCausalQueryAudits.every((audit) => audit?.deterministic_replay_verified === true),
    },
    immutable_event_arbitration: {
      version: worldSimulationImmutableEventArbitrationVersion,
      audit_count: immutableEventArbitrationAudits.length,
      audits: immutableEventArbitrationAudits,
      candidate_inputs_immutable: immutableEventArbitrationAudits.every((audit) => audit?.input_candidates_immutable === true),
      arbitration_outputs_contain_world_state: false,
      arbitration_outputs_contain_mutation_proposals: false,
      candidate_order_invariant: immutableEventArbitrationAudits.every((audit) => audit?.candidate_order_invariant === true),
      exact_timestamp_batches_preserved: immutableEventArbitrationAudits.every((audit) => audit?.exact_timestamp_batch_preserved === true),
      unresolved_candidates_requeried_after_batch_application: true,
      deterministic_replay_verified: immutableEventArbitrationAudits.every((audit) => audit?.deterministic_replay_verified === true),
    },
    cross_layer_event_arbitration: {
      version: worldSimulationCrossLayerEventArbitrationVersion,
      audit_count: causalTimeline?.cross_layer_event_arbitration?.audit_count ?? 0,
      audits: cloneJson(array(causalTimeline?.cross_layer_event_arbitration?.audits)),
      final_result: cloneJson(causalTimeline?.cross_layer_event_arbitration?.final_result ?? null),
      candidate_inputs_immutable: causalTimeline?.cross_layer_event_arbitration?.candidate_inputs_immutable === true,
      arbitration_outputs_contain_world_state: false,
      arbitration_outputs_contain_mutation_proposals: false,
      candidate_order_invariant: causalTimeline?.cross_layer_event_arbitration?.candidate_order_invariant === true,
      exact_timestamp_batches_preserved: causalTimeline?.cross_layer_event_arbitration?.exact_timestamp_batches_preserved === true,
      deterministic_replay_verified: causalTimeline?.cross_layer_event_arbitration?.deterministic_replay_verified === true,
    },
    elapsed_ms: elapsedMs,
    resolution_boundary: {
      result_created_from_world_state_and_machine_readable_action_fields: true,
      character_brain_did_not_decide_outcome: true,
      same_turn_actions_do_not_retroactively_change_each_others_preconditions: true,
      combat_range_validity_does_not_equal_hit: true,
      combat_contact_damage_and_injury_are_programmatic: true,
      projectile_collision_and_field_exposure_discovery_are_immutable_read_only_queries: true,
      queried_projectile_candidates_use_immutable_deterministic_batch_arbitration: true,
      cross_layer_point_event_candidates_use_immutable_exact_time_batches: true,
      causal_candidates_are_bound_to_world_revision_hash_and_fixed_point_epoch: true,
      stale_causal_candidates_are_rejected_between_epochs: true,
      invalidated_epochs_require_candidate_requery_and_rearbitration: true,
      fixed_point_convergence_requires_identical_derivation_context_hash: true,
      fixed_point_oscillation_is_rejected: true,
      fixed_point_iteration_limit_without_convergence_is_rejected: true,
      fixed_point_silent_last_iteration_acceptance_forbidden: true,
      fixed_point_convergence_version: worldSimulationFixedPointConvergenceVersion,
      same_timestamp_cross_layer_events_are_simultaneous: true,
      exact_timestamp_arbitration_order_is_not_causal_precedence: true,
      final_world_state_written_only_by_chronological_mutation_queue: true,
      subsystem_preview_states_not_used_as_inter_subsystem_authority: true,
      inter_subsystem_handoffs_use_executor_projection: true,
      causal_subsystems_return_mutation_proposals_without_world_state: true,
      private_solver_previews_discarded_before_orchestration: true,
      combat_injury_and_barrier_effects_use_immutable_causal_evaluators: true,
      projectile_resource_spawn_and_cover_effects_use_immutable_causal_evaluators: true,
      projectile_lifecycle_state_uses_immutable_causal_evaluators: true,
      ability_field_lifecycle_state_uses_immutable_causal_evaluators: true,
      causal_effect_evaluator_outputs_do_not_contain_world_state: true,
      combat_causal_version: combatResolution.combat_causal_version,
      projectile_and_ability_physics_are_programmatic: true,
      continuous_physics_version: physicsResolution.continuous_physics_version,
      cross_layer_point_events_ordered_by_global_timeline: true,
      earlier_incapacitation_preempts_later_execution: true,
      global_causal_timeline_version: causalTimeline.version,
      timeline_refinement_version: causalTimeline.refinement_version,
      actor_state_scheduler_version: causalTimeline.actor_state_scheduler_version,
      chronological_mutation_queue_version: chronologicalMutationQueue.version,
      all_resolved_state_transitions_enter_one_timestamped_mutation_queue: true,
      same_timestamp_mutations_are_batched_without_retroactive_preemption: true,
      earlier_nonfatal_injury_can_delay_later_execution: true,
      earlier_topology_destruction_changes_later_projectile_paths: true,
    },
  };
}
