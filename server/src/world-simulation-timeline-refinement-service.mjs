export const worldSimulationTimelineRefinementVersion = "phase62h-timeline-refinement-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function matchingProjectileOutcome(physicsResolution, resolution) {
  return array(physicsResolution?.action_outcomes).find((item) => (
    item?.result === "projectile_hit_character"
    && String(item?.projectile_id ?? "") === String(resolution?.projectile_id ?? "")
    && String(item?.target ?? "") === String(resolution?.target ?? "")
  )) ?? null;
}

export function collectWorldSimulationInjuryRateEvents(input = {}) {
  const events = [];
  for (const outcome of array(input.combat_resolution?.action_outcomes)) {
    const target = String(outcome?.target ?? "").trim();
    const damage = finiteNumber(outcome?.damage_applied, 0);
    const healthAfter = finiteNumber(outcome?.health_after);
    const timeMs = finiteNumber(outcome?.resolution_trace?.contact_time_ms);
    if (!target || damage <= 0 || healthAfter === null || healthAfter <= 0 || timeMs === null) continue;
    events.push({
      target,
      time_ms: timeMs,
      source_layer: "combat",
      source_action_id: outcome.action_id ?? null,
      movement_multiplier_after: positiveNumber(outcome.movement_multiplier_after, 1),
      combat_multiplier_after: positiveNumber(outcome.combat_multiplier_after, 1),
      injury_severity: outcome.injury_severity ?? null,
    });
  }
  for (const resolution of array(input.physics_resolution?.projectile_resolutions)) {
    if (resolution?.result !== "projectile_hit_character") continue;
    const outcome = matchingProjectileOutcome(input.physics_resolution, resolution);
    const target = String(resolution?.target ?? outcome?.target ?? "").trim();
    const damage = finiteNumber(outcome?.damage_applied ?? resolution?.damage_applied, 0);
    const healthAfter = finiteNumber(outcome?.health_after);
    if (!target || damage <= 0 || healthAfter === null || healthAfter <= 0) continue;
    events.push({
      target,
      time_ms: finiteNumber(resolution?.time_ms, 0),
      source_layer: "continuous_physics",
      source_action_id: resolution?.source_action_id ?? outcome?.action_id ?? null,
      projectile_id: resolution?.projectile_id ?? outcome?.projectile_id ?? null,
      movement_multiplier_after: positiveNumber(outcome?.movement_multiplier_after, 1),
      combat_multiplier_after: positiveNumber(outcome?.combat_multiplier_after, 1),
      injury_severity: outcome?.injury_severity ?? null,
    });
  }
  return events.sort((left, right) => (
    left.time_ms - right.time_ms
    || left.target.localeCompare(right.target, "zh-Hant-TW")
    || String(left.source_action_id ?? "").localeCompare(String(right.source_action_id ?? ""))
  ));
}

function initialCombatMultiplier(worldState, actor) {
  const character = object(object(worldState?.characters)[actor]);
  const physical = object(character.physical_state);
  return positiveNumber(physical.combat_multiplier ?? character.combat_multiplier, 1);
}

function multiplierForExecution(worldState, actor, kind, event) {
  if (["melee_contact", "defense_start", "projectile_launch", "ability_activation"].includes(kind)) {
    const initial = initialCombatMultiplier(worldState, actor);
    const after = positiveNumber(event.combat_multiplier_after, initial);
    return Math.min(1, after / initial);
  }
  return 1;
}

function refinedTimeMs(worldState, nominalTimeMs, actor, kind, injuryEvents) {
  const nominal = Math.max(0, finiteNumber(nominalTimeMs, 0));
  if (nominal <= 0) return nominal;
  const events = array(injuryEvents)
    .filter((event) => event?.target === actor && finiteNumber(event.time_ms) !== null)
    .sort((left, right) => left.time_ms - right.time_ms);
  let remainingWorkMs = nominal;
  let currentTimeMs = 0;
  let rate = 1;
  for (const event of events) {
    const eventTimeMs = Math.max(0, finiteNumber(event.time_ms, 0));
    if (eventTimeMs < currentTimeMs - 1e-9) continue;
    const availableMs = eventTimeMs - currentTimeMs;
    const workDone = availableMs * rate;
    if (workDone >= remainingWorkMs - 1e-9) {
      return currentTimeMs + remainingWorkMs / Math.max(rate, 1e-9);
    }
    remainingWorkMs -= workDone;
    currentTimeMs = eventTimeMs;
    rate = Math.min(rate, multiplierForExecution(worldState, actor, kind, event));
  }
  return currentTimeMs + remainingWorkMs / Math.max(rate, 1e-9);
}

function overrideFields(kind, refinedTime, refinedTotal) {
  if (kind === "melee_contact") {
    return { contact_time_ms: refinedTime, total_ms: refinedTotal };
  }
  if (kind === "defense_start") return { defense_start_ms: refinedTime };
  if (kind === "projectile_launch") return { projectile_launch_ms: refinedTime };
  if (kind === "ability_activation") return { ability_activation_ms: refinedTime };
  if (kind === "movement_complete") return { movement_complete_ms: refinedTime };
  return {};
}

export function refineWorldSimulationExecutionTimes(input = {}) {
  const overrides = {};
  const adjustments = [];
  for (const entry of array(input.execution_entries)) {
    const actor = String(entry?.actor ?? "").trim();
    const actionId = String(entry?.action_id ?? "").trim();
    const kind = String(entry?.kind ?? "").trim();
    const nominalTimeMs = finiteNumber(entry?.nominal_time_ms ?? entry?.time_ms);
    if (!actor || !actionId || nominalTimeMs === null) continue;
    const refinedTime = refinedTimeMs(input.world_state, nominalTimeMs, actor, kind, input.injury_events);
    const nominalTotalMs = finiteNumber(entry?.nominal_total_ms ?? entry?.total_ms);
    const refinedTotal = nominalTotalMs === null
      ? null
      : refinedTimeMs(input.world_state, nominalTotalMs, actor, kind, input.injury_events);
    if (Math.abs(refinedTime - nominalTimeMs) <= 1e-6
      && (nominalTotalMs === null || Math.abs(refinedTotal - nominalTotalMs) <= 1e-6)) continue;
    overrides[actionId] = {
      ...(overrides[actionId] ?? {}),
      ...overrideFields(kind, refinedTime, refinedTotal),
    };
    adjustments.push({
      actor,
      action_id: actionId,
      kind,
      nominal_time_ms: nominalTimeMs,
      refined_time_ms: refinedTime,
      nominal_total_ms: nominalTotalMs,
      refined_total_ms: refinedTotal,
      cause: "earlier_nonfatal_injury_reduced_execution_rate",
    });
  }
  return {
    version: worldSimulationTimelineRefinementVersion,
    action_time_overrides: overrides,
    rate_adjustments: adjustments,
  };
}

export function buildWorldSimulationTimelineRefinementContract() {
  return {
    version: worldSimulationTimelineRefinementVersion,
    owner: "programmatic_global_timeline_refinement",
    nonfatal_injury: {
      earlier_injury_can_delay_later_execution: true,
      combat_multiplier_applies_to_later_combat_projectile_and_ability_execution: true,
      fixed_point_recomputed_after_time_shift: true,
    },
    topology: {
      projectile_collisions_are_globally_time_ordered_within_physics_window: true,
      strictly_earlier_cover_destruction_changes_later_projectile_paths: true,
      exact_timestamp_collision_candidates_are_not_erased_retroactively: true,
    },
    character_brain_may_decide_rate_change_or_topology_result: false,
    known_boundary: "Phase62H v1 refines deferred execution times after nonfatal injury and replays projectile topology in strict collision-time order. Partial-path interruption of already-moving actors and field-damage microticks remain future refinements.",
  };
}
