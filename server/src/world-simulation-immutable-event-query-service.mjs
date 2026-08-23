import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  positionAtWorldSimulationActorTrajectory,
  velocityAtWorldSimulationActorTrajectory,
} from "./world-simulation-actor-state-scheduler.mjs";

export const worldSimulationImmutableEventQueryVersion = "phase62r-immutable-event-query-v1";

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

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function point(value) {
  const record = object(value);
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  return x === null || y === null ? null : { x, y };
}

function forbiddenOutputPaths(value, prefix = [], output = []) {
  if (!value || typeof value !== "object") return output;
  const forbidden = new Set([
    "world_state",
    "next_world_state",
    "preview_world_state",
    "projected_world_state",
    "mutation_proposals",
    "state_transitions",
  ]);
  for (const [key, child] of Object.entries(value)) {
    const path = [...prefix, key];
    if (forbidden.has(key)) output.push(path.join("."));
    forbiddenOutputPaths(child, path, output);
  }
  return output;
}

export function runWorldSimulationImmutableCausalQuery(input = {}) {
  if (typeof input.query !== "function") {
    const error = new Error("Immutable causal query requires a synchronous query function.");
    error.code = "WORLD_SIMULATION_IMMUTABLE_CAUSAL_QUERY_REQUIRED";
    throw error;
  }
  const queryName = String(input.query_name ?? "causal_query").trim() || "causal_query";
  const context = cloneJson(object(input.context));
  const contextHashBefore = hashAgentRunValue(context);

  const queryOnce = () => {
    const frozenContext = deepFreeze(cloneJson(context));
    const result = cloneJson(object(input.query(frozenContext)));
    const forbidden = forbiddenOutputPaths(result);
    if (forbidden.length) {
      const error = new Error(`Immutable causal query ${queryName} returned forbidden state-changing fields: ${forbidden.join(", ")}.`);
      error.code = "WORLD_SIMULATION_IMMUTABLE_CAUSAL_QUERY_OUTPUT_FORBIDDEN";
      error.forbidden_fields = forbidden;
      throw error;
    }
    return result;
  };

  const first = queryOnce();
  const second = input.verify_determinism === false ? first : queryOnce();
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error(`Immutable causal query ${queryName} produced non-deterministic output for identical input.`);
    error.code = "WORLD_SIMULATION_CAUSAL_QUERY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }

  const contextHashAfter = hashAgentRunValue(context);
  if (contextHashBefore !== contextHashAfter) {
    const error = new Error(`Immutable causal query ${queryName} mutated its input context.`);
    error.code = "WORLD_SIMULATION_CAUSAL_QUERY_INPUT_MUTATION";
    throw error;
  }

  const audit = {
    version: worldSimulationImmutableEventQueryVersion,
    query: queryName,
    input_context_hash: contextHashBefore,
    output_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    read_only_event_discovery: true,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    query_version: worldSimulationImmutableEventQueryVersion,
    query: queryName,
    result: first,
    audit,
  };
}

function profilePositionAt(profile, timeMs) {
  const record = object(profile);
  const trajectory = object(record.trajectory);
  if (Object.keys(trajectory).length) {
    return positionAtWorldSimulationActorTrajectory(trajectory, timeMs);
  }
  const start = point(record.start);
  const end = point(record.end) ?? start;
  if (!start || !end) return null;
  const durationMs = nonNegativeNumber(record.durationMs ?? record.duration_ms, 0);
  if (durationMs <= 0) return start;
  const ratio = Math.min(1, Math.max(0, nonNegativeNumber(timeMs, 0) / durationMs));
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function profileVelocityAt(profile, timeMs) {
  const record = object(profile);
  const trajectory = object(record.trajectory);
  if (Object.keys(trajectory).length) {
    return velocityAtWorldSimulationActorTrajectory(trajectory, timeMs);
  }
  const start = point(record.start);
  const end = point(record.end) ?? start;
  const durationMs = nonNegativeNumber(record.durationMs ?? record.duration_ms, 0);
  if (!start || !end || durationMs <= 0 || nonNegativeNumber(timeMs, 0) >= durationMs) return { x: 0, y: 0 };
  const seconds = durationMs / 1000;
  return {
    x: (end.x - start.x) / seconds,
    y: (end.y - start.y) / seconds,
  };
}

function profileBreakpoints(profile) {
  const record = object(profile);
  const values = new Set(array(record.breakpoints).map((value) => nonNegativeNumber(value, 0)));
  const durationMs = finiteNumber(record.durationMs ?? record.duration_ms);
  if (durationMs !== null) values.add(Math.max(0, durationMs));
  return [...values].sort((left, right) => left - right);
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
  for (const breakpoint of profileBreakpoints(profile)) {
    if (breakpoint > startMs && breakpoint < endMs) boundaries.push(breakpoint);
  }
  boundaries.sort((left, right) => left - right);
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStartMs = boundaries[index];
    const segmentEndMs = boundaries[index + 1];
    const seconds = (segmentEndMs - segmentStartMs) / 1000;
    if (seconds <= 0) continue;
    const projectileStart = {
      x: projectile.position.x + projectile.velocity_mps.x * ((segmentStartMs - startMs) / 1000),
      y: projectile.position.y + projectile.velocity_mps.y * ((segmentStartMs - startMs) / 1000),
    };
    const targetStart = profilePositionAt(profile, segmentStartMs);
    if (!targetStart) continue;
    const targetVelocity = profileVelocityAt(profile, segmentStartMs);
    const contactSeconds = solveCircleContact(
      {
        x: projectileStart.x - targetStart.x,
        y: projectileStart.y - targetStart.y,
      },
      {
        x: projectile.velocity_mps.x - targetVelocity.x,
        y: projectile.velocity_mps.y - targetVelocity.y,
      },
      radius,
      seconds,
    );
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
    if (!best || timeMs < best.timeMs) best = { index, obstacleId, timeMs };
  }
  return best;
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
  const dx = end.x - projectile.position.x;
  const dy = end.y - projectile.position.y;
  const candidates = [];
  if (dx > 0 && Number.isFinite(width)) candidates.push((width - projectile.position.x) / dx);
  if (dx < 0) candidates.push((0 - projectile.position.x) / dx);
  if (dy > 0 && Number.isFinite(depth)) candidates.push((depth - projectile.position.y) / dy);
  if (dy < 0) candidates.push((0 - projectile.position.y) / dy);
  const fraction = candidates.filter((value) => value >= 0 && value <= 1).sort((left, right) => left - right)[0];
  return fraction === undefined ? null : startMs + fraction * (endMs - startMs);
}

export function queryWorldSimulationProjectileNextEvent(input = {}) {
  return runWorldSimulationImmutableCausalQuery({
    query_name: "projectile_collision_discovery",
    context: {
      projectile: cloneJson(object(input.projectile)),
      scene: cloneJson(object(input.scene)),
      character_motion_profiles: cloneJson(array(input.character_motion_profiles)),
      current_time_ms: nonNegativeNumber(input.current_time_ms, 0),
      active_end_ms: nonNegativeNumber(input.active_end_ms, 0),
    },
    evaluate_determinism: true,
    query: (context) => {
      const projectile = object(context.projectile);
      const currentTimeMs = nonNegativeNumber(context.current_time_ms, 0);
      const activeEndMs = Math.max(currentTimeMs, nonNegativeNumber(context.active_end_ms, currentTimeMs));
      const ageRemaining = Math.max(
        0,
        positiveNumber(projectile.max_lifetime_ms, 5000) - nonNegativeNumber(projectile.age_ms, 0),
      );
      if (ageRemaining <= 1e-9) {
        return { ok: true, event: { kind: "lifetime", timeMs: currentTimeMs } };
      }
      const windowEndMs = Math.min(activeEndMs, currentTimeMs + ageRemaining);
      const obstacle = obstacleEntry(object(context.scene), projectile, currentTimeMs, windowEndMs);
      let character = null;
      for (const item of array(context.character_motion_profiles)) {
        const name = String(item?.character ?? "").trim();
        if (!name || name === String(projectile.owner ?? "")) continue;
        const profile = object(item?.profile);
        if (!Object.keys(profile).length) continue;
        const contactTimeMs = movingCharacterContact(
          projectile,
          profile,
          currentTimeMs,
          windowEndMs,
          positiveNumber(item?.target_radius_m, 0.3),
        );
        if (contactTimeMs === null) continue;
        if (!character || contactTimeMs < character.timeMs) character = { character: name, timeMs: contactTimeMs };
      }
      const boundsTime = sceneBoundsExitTime(object(context.scene), projectile, currentTimeMs, windowEndMs);
      const events = [
        obstacle ? { kind: "obstacle", ...obstacle } : null,
        character ? { kind: "character", ...character } : null,
        boundsTime !== null ? { kind: "bounds", timeMs: boundsTime } : null,
      ].filter(Boolean).sort((left, right) => (
        left.timeMs - right.timeMs
        || left.kind.localeCompare(right.kind)
      ));
      if (events.length) return { ok: true, event: events[0] };
      if (windowEndMs < activeEndMs - 1e-9) return { ok: true, event: { kind: "lifetime", timeMs: windowEndMs } };
      return { ok: true, event: { kind: "advance_end", timeMs: activeEndMs } };
    },
  });
}

function timeInsideStaticCircle(profile, center, radius, startMs, endMs) {
  if (!profile || endMs <= startMs) return 0;
  const boundaries = [startMs, endMs];
  for (const breakpoint of profileBreakpoints(profile)) {
    if (breakpoint > startMs && breakpoint < endMs) boundaries.push(breakpoint);
  }
  boundaries.sort((left, right) => left - right);
  let insideMs = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const aMs = boundaries[index];
    const bMs = boundaries[index + 1];
    const durationMs = bMs - aMs;
    if (durationMs <= 0) continue;
    const start = profilePositionAt(profile, aMs);
    const end = profilePositionAt(profile, bMs);
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

export function queryWorldSimulationAbilityFieldExposure(input = {}) {
  return runWorldSimulationImmutableCausalQuery({
    query_name: "ability_field_geometric_exposure",
    context: {
      profile: cloneJson(object(input.profile)),
      center: cloneJson(point(input.center)),
      radius_m: positiveNumber(input.radius_m, null),
      start_ms: nonNegativeNumber(input.start_ms, 0),
      end_ms: nonNegativeNumber(input.end_ms, 0),
      character: String(input.character ?? "").trim() || null,
      field_id: String(input.field_id ?? "").trim() || null,
    },
    query: (context) => {
      const center = point(context.center);
      const radius = positiveNumber(context.radius_m, null);
      if (!center || !radius) return { ok: false, inside_ms: 0, reason: "field exposure query requires center and positive radius" };
      const startMs = nonNegativeNumber(context.start_ms, 0);
      const endMs = Math.max(startMs, nonNegativeNumber(context.end_ms, startMs));
      return {
        ok: true,
        character: context.character ?? null,
        field_id: context.field_id ?? null,
        start_ms: startMs,
        end_ms: endMs,
        inside_ms: timeInsideStaticCircle(object(context.profile), center, radius, startMs, endMs),
      };
    },
  });
}

export function buildWorldSimulationImmutableEventQueryContract() {
  return {
    version: worldSimulationImmutableEventQueryVersion,
    owner: "programmatic_immutable_event_discovery",
    query_contract: {
      receives_frozen_cloned_context: true,
      may_return_world_state: false,
      may_return_mutation_proposals: false,
      read_only_event_discovery_only: true,
      deterministic_replay_checked_for_identical_input: true,
    },
    migrated_event_queries: [
      "projectile_collision_discovery",
      "ability_field_geometric_exposure",
    ],
    projectile_query_discovers: [
      "obstacle_contact",
      "character_contact",
      "scene_bounds_exit",
      "lifetime_expiration",
      "turn_window_advance",
    ],
    ability_field_query_discovers: [
      "piecewise_actor_trajectory_exposure_ms",
    ],
    query_results_are_observations_not_mutations: true,
    character_brain_may_decide_event_discovery: false,
    known_boundary: "Phase62R makes projectile next-event discovery and ability-field geometric exposure immutable deterministic read-only causal queries. Global scheduling/arbitration still consumes those query results programmatically, and broader spatial pathfinding remains outside this query layer.",
  };
}
