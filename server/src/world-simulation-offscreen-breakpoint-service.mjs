import {
  evaluateWorldSimulationAbilityFieldLifecycle,
} from "./world-simulation-immutable-ability-field-lifecycle-service.mjs";
import { queryWorldSimulationProjectileNextEvent } from "./world-simulation-immutable-event-query-service.mjs";

export const worldSimulationOffscreenBreakpointVersion =
  "cb-c6e3-offscreen-breakpoint-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function canonicalTime(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return Date.parse(value);
}

function unresolved(subjectType, subjectId, reason) {
  return { unresolved: true, subject_type: subjectType, subject_id: String(subjectId), reason };
}

function sceneFor(worldState, sceneId) {
  const scenes = object(worldState.scenes);
  return object(scenes[sceneId]);
}

function staticMotionProfiles(worldState, scene, windowMs, targetRadiusM) {
  const positions = object(scene.entity_positions);
  return Object.keys(object(worldState.characters))
    .sort().map((character) => {
      const position = point(positions[character]);
      if (!position) return null;
      return {
        character,
        target_radius_m: targetRadiusM,
        profile: {
          start: position,
          end: position,
          duration_ms: windowMs,
          breakpoints: [0, windowMs],
        },
      };
    })
    .filter(Boolean);
}

function abilityFieldCandidate(worldState, fieldId, rawField, currentTimeMs, horizonDeltaMs) {
  const field = object(rawField);
  if (field.active !== true) return null;
  const remainingMs = positiveNumber(field.remaining_ms);
  if (remainingMs === null) return unresolved("ability_field", fieldId,
    "active_field_remaining_time_unavailable");
  const rules = object(worldState.world_rules ?? worldState.rules);
  const defaultTickMs = positiveNumber(rules.ability_field_tick_ms, 100);
  const lifecycle = evaluateWorldSimulationAbilityFieldLifecycle({
    field,
    start_ms: 0,
    elapsed_ms: 0,
    default_tick_ms: defaultTickMs,
  });
  const tickMs = positiveNumber(lifecycle?.result?.tick_ms);
  if (lifecycle?.result?.ok !== true || tickMs === null)
    return unresolved("ability_field", fieldId, "field_lifecycle_unresolved");
  const deltaMs = Math.min(remainingMs, tickMs);
  if (horizonDeltaMs !== null && deltaMs > horizonDeltaMs + 1e-9) return null;
  const expires = remainingMs <= tickMs + 1e-9;
  return {
    kind: expires ? "ability_field_expiration" : "ability_field_tick",
    subject_type: "ability_field",
    subject_id: String(field.field_id ?? fieldId),
    delta_ms: deltaMs,
    simulation_time: new Date(currentTimeMs + deltaMs).toISOString(),
    source_authority: "programmatic_immutable_ability_field_lifecycle",
  };
}

function projectileCandidate(worldState, projectileId, rawProjectile, currentTimeMs, horizonDeltaMs) {
  const projectile = object(rawProjectile);
  if (projectile.active !== true) return null;
  const sceneId = String(projectile.scene_id ?? "").trim();
  const scene = sceneFor(worldState, sceneId);
  if (!sceneId || !Object.keys(scene).length)
    return unresolved("projectile", projectileId, "projectile_scene_unavailable");
  if (![projectile.position?.x, projectile.position?.y,
      projectile.velocity_mps?.x, projectile.velocity_mps?.y]
      .every(value => typeof value === "number" && Number.isFinite(value)))
    return unresolved("projectile", projectileId, "projectile_motion_unavailable");

  const ageMs = Math.max(0, finiteNumber(projectile.age_ms, 0));
  const maxLifetimeMs = positiveNumber(projectile.max_lifetime_ms, 5000);
  if (maxLifetimeMs === null) return null;
  const lifetimeRemainingMs = Math.max(0, maxLifetimeMs - ageMs);
  // The existing query distinguishes lifetime from advance_end only when
  // its window extends past expiry. Extend read-only discovery by one
  // microsecond, then enforce the caller's exact horizon on the result.
  const discoveryWindowMs = (horizonDeltaMs === null
    ? lifetimeRemainingMs : Math.max(0, horizonDeltaMs)) + 0.001;

  const rules = object(worldState.world_rules ?? worldState.rules);
  const targetRadiusM = positiveNumber(rules.combat_target_radius_m, 0.3);
  const queried = queryWorldSimulationProjectileNextEvent({
    projectile,
    scene,
    character_motion_profiles: staticMotionProfiles(
      worldState,
      scene,
      discoveryWindowMs,
      targetRadiusM,
    ),
    current_time_ms: 0,
    active_end_ms: discoveryWindowMs,
  });
  const event = object(queried?.result?.event);
  const deltaMs = finiteNumber(event.timeMs);
  if (queried?.result?.ok !== true || deltaMs === null || deltaMs < 0
      || event.kind === "advance_end"
      || (horizonDeltaMs !== null && deltaMs > horizonDeltaMs + 1e-9)) {
    return null;
  }
  return {
    kind: `projectile_${String(event.kind ?? "event")}`,
    subject_type: "projectile",
    subject_id: String(projectile.projectile_id ?? projectileId),
    delta_ms: deltaMs,
    simulation_time: new Date(currentTimeMs + deltaMs).toISOString(),
    source_authority: "programmatic_immutable_event_discovery",
  };
}

/**
 * Read-only discovery of the earliest causal breakpoint already implied by
 * committed persistent World processes. It never advances World time, mutates
 * a process, invokes Character Brain, or invents a physiological slow process.
 */
export function projectWorldSimulationOffscreenBreakpoint({
  world_state,
  target_horizon = null,
} = {}) {
  const state = object(world_state);
  const currentTimeMs = canonicalTime(state.simulation_time);
  if (currentTimeMs === null) {
    const error = new Error("Offscreen breakpoint discovery requires committed World time.");
    error.code = "C6E_OFFSCREEN_BREAKPOINT_INVALID";
    throw error;
  }
  const targetTimeMs = target_horizon === null ? null : canonicalTime(target_horizon);
  if (target_horizon !== null && (targetTimeMs === null || targetTimeMs < currentTimeMs)) {
    const error = new Error("Offscreen breakpoint target must not precede committed World time.");
    error.code = "C6E_OFFSCREEN_BREAKPOINT_INVALID";
    throw error;
  }
  const horizonDeltaMs = targetTimeMs === null ? null : targetTimeMs - currentTimeMs;
  const candidates = [];
  const unresolvedProcesses = [];

  for (const [fieldId, field] of Object.entries(object(state.ability_fields))) {
    const candidate = abilityFieldCandidate(
      state,
      fieldId,
      field,
      currentTimeMs,
      horizonDeltaMs,
    );
    if (candidate?.unresolved) unresolvedProcesses.push(candidate);
    else if (candidate) candidates.push(candidate);
  }

  for (const [projectileId, projectile] of Object.entries(object(state.projectiles))) {
    const candidate = projectileCandidate(
      state,
      projectileId,
      projectile,
      currentTimeMs,
      horizonDeltaMs,
    );
    if (candidate?.unresolved) unresolvedProcesses.push(candidate);
    else if (candidate) candidates.push(candidate);
  }

  candidates.sort((left, right) => (
    left.delta_ms - right.delta_ms
    || left.kind.localeCompare(right.kind)
    || left.subject_type.localeCompare(right.subject_type)
    || left.subject_id.localeCompare(right.subject_id)
  ));

  return Object.freeze({
    version: worldSimulationOffscreenBreakpointVersion,
    authority: "engine_private_read_only_projection",
    current_simulation_time: state.simulation_time,
    requested_target_horizon: target_horizon,
    status: unresolvedProcesses.length ? "process_authority_unresolved"
      : candidates.length ? "breakpoint_available" : "no_authoritative_breakpoint",
    breakpoint: candidates.length ? Object.freeze({ ...candidates[0] }) : null,
    candidate_count: candidates.length,
    unresolved_process_count: unresolvedProcesses.length,
    unresolved_processes: Object.freeze(unresolvedProcesses
      .sort((left, right) => left.subject_type.localeCompare(right.subject_type, "en")
        || left.subject_id.localeCompare(right.subject_id, "en"))
      .map(item => Object.freeze({ ...item }))),
    earliest_breakpoint_confirmed: candidates.length > 0 && unresolvedProcesses.length === 0,
    boundaries: Object.freeze({
      world_time_advanced: false,
      world_state_mutated: false,
      character_brain_invoked: false,
      automatic_recovery_inferred: false,
      sleep_pressure_inferred: false,
      unknown_slow_process_synthesized: false,
    }),
  });
}
