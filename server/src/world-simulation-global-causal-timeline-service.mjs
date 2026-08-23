import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  adjudicateWorldSimulationCombat,
  buildWorldSimulationCombatTimelineEntries,
} from "./world-simulation-combat-causal-service.mjs";
import {
  adjudicateWorldSimulationContinuousPhysics,
  buildWorldSimulationContinuousIntentTimelineEntries,
} from "./world-simulation-continuous-physics-service.mjs";

export const worldSimulationGlobalCausalTimelineVersion = "phase62g-global-causal-timeline-v1";

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

function stableSort(entries) {
  const priority = new Map([
    ["projectile_resolution", 10],
    ["melee_contact", 20],
    ["action_preempted", 30],
    ["defense_start", 40],
    ["projectile_launch", 50],
    ["ability_activation", 60],
    ["movement_complete", 70],
    ["door_interaction_complete", 80],
    ["object_interaction_complete", 90],
    ["action_complete", 100],
  ]);
  return [...entries].sort((left, right) => (
    nonNegativeNumber(left.time_ms, 0) - nonNegativeNumber(right.time_ms, 0)
    || (priority.get(left.kind) ?? 999) - (priority.get(right.kind) ?? 999)
    || String(left.actor ?? "").localeCompare(String(right.actor ?? ""), "zh-Hant-TW")
    || String(left.action_id ?? "").localeCompare(String(right.action_id ?? ""))
    || String(left.projectile_id ?? "").localeCompare(String(right.projectile_id ?? ""))
  ));
}

function actionWindowMs(input, combatEntries) {
  let elapsedMs = nonNegativeNumber(input.elapsed_ms, 0);
  for (const selected of array(input.selected_action_intents)) {
    elapsedMs = Math.max(elapsedMs, parseDurationMs(object(selected?.candidate), 0));
  }
  for (const entry of combatEntries) {
    elapsedMs = Math.max(elapsedMs, nonNegativeNumber(entry.total_ms, 0), nonNegativeNumber(entry.time_ms, 0));
  }
  return elapsedMs;
}

function fatalCombatEvents(combatResolution) {
  const entries = [];
  for (const outcome of array(combatResolution.action_outcomes)) {
    const healthAfter = finiteNumber(outcome?.health_after);
    const target = String(outcome?.target ?? "").trim();
    const timeMs = finiteNumber(outcome?.resolution_trace?.contact_time_ms);
    if (!target || healthAfter === null || healthAfter > 0 || timeMs === null) continue;
    entries.push({
      kind: "incapacitation",
      target,
      actor: outcome.actor ?? null,
      action_id: outcome.action_id ?? null,
      time_ms: timeMs,
      cause: outcome.result ?? "melee_contact",
      source_layer: "combat",
    });
  }
  return entries;
}

function fatalProjectileEvents(physicsResolution) {
  const hitOutcomes = array(physicsResolution.action_outcomes).filter((item) => item?.result === "projectile_hit_character");
  const entries = [];
  for (const resolution of array(physicsResolution.projectile_resolutions)) {
    if (resolution?.result !== "projectile_hit_character") continue;
    const matching = hitOutcomes.find((item) => (
      String(item?.projectile_id ?? "") === String(resolution.projectile_id ?? "")
      && String(item?.target ?? "") === String(resolution.target ?? "")
    ));
    const healthAfter = finiteNumber(matching?.health_after);
    if (healthAfter === null || healthAfter > 0) continue;
    entries.push({
      kind: "incapacitation",
      target: String(resolution.target ?? "").trim(),
      actor: resolution.owner ?? matching?.actor ?? null,
      action_id: resolution.source_action_id ?? matching?.action_id ?? null,
      projectile_id: resolution.projectile_id ?? null,
      time_ms: nonNegativeNumber(resolution.time_ms, 0),
      cause: "projectile_hit_character",
      source_layer: "continuous_physics",
    });
  }
  return entries.filter((entry) => entry.target);
}

function executionEntries(input, suppressedActionIds) {
  return stableSort([
    ...buildWorldSimulationCombatTimelineEntries({
      world_state: input.world_state,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedActionIds,
    }),
    ...buildWorldSimulationContinuousIntentTimelineEntries({
      world_state: input.world_state,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedActionIds,
    }),
  ]);
}

function preemptionsFor(executions, fatalEvents, suppressed) {
  const additions = [];
  for (const execution of executions) {
    const actionId = String(execution.action_id ?? "");
    const actor = String(execution.actor ?? "");
    if (!actionId || !actor || suppressed.has(actionId)) continue;
    const fatal = fatalEvents
      .filter((entry) => entry.target === actor && entry.time_ms < execution.time_ms - 1e-6)
      .sort((left, right) => left.time_ms - right.time_ms)[0];
    if (!fatal) continue;
    additions.push({
      action_id: actionId,
      actor,
      action_kind: execution.kind,
      scheduled_time_ms: execution.time_ms,
      preempted_at_ms: fatal.time_ms,
      cause: fatal.cause,
      caused_by_actor: fatal.actor ?? null,
      caused_by_action_id: fatal.action_id ?? null,
      projectile_id: fatal.projectile_id ?? null,
    });
  }
  return additions;
}

export function buildWorldSimulationGlobalCausalTimelineContract() {
  return {
    version: worldSimulationGlobalCausalTimelineVersion,
    owner: "programmatic_global_causal_timeline",
    ordering: {
      clock: "turn_relative_milliseconds",
      stable_sort: true,
      strict_earlier_incapacitation_preempts_later_execution: true,
      exact_timestamp_ties_are_simultaneous_for_preemption: true,
      fixed_point_recomputed_after_preemption: true,
    },
    unified_point_events: [
      "melee_contact",
      "defense_start",
      "projectile_launch",
      "projectile_collision",
      "ability_activation",
    ],
    persisted_history: true,
    character_brain_may_decide_timestamps_as_outcomes: false,
    known_boundary: "Phase62G v1 unifies cross-layer point-event ordering and incapacitation preemption. Continuous nonfatal injury rate changes, mid-turn topology replay, and field-damage microticks remain delegated to their causal layers until a later timeline refinement.",
  };
}

export function arbitrateWorldSimulationGlobalTimeline(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const baseNext = cloneJson(object(input.next_world_state ?? snapshot));
  const suppressed = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  const preemptions = [];
  let lastCombat = null;
  let lastPhysics = null;
  let iterations = 0;
  const maxIterations = Math.max(2, array(input.selected_action_intents).length + 2);

  while (iterations < maxIterations) {
    iterations += 1;
    const suppressedList = [...suppressed].sort();
    const combatEntries = buildWorldSimulationCombatTimelineEntries({
      world_state: snapshot,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedList,
    });
    const elapsedMs = actionWindowMs(input, combatEntries);
    lastCombat = adjudicateWorldSimulationCombat({
      world_state: snapshot,
      next_world_state: baseNext,
      scene_id: input.scene_id,
      event: input.event,
      selected_action_intents: input.selected_action_intents,
      resolved_action_outcomes: input.resolved_action_outcomes,
      suppressed_action_ids: suppressedList,
    });
    lastPhysics = adjudicateWorldSimulationContinuousPhysics({
      world_state: snapshot,
      next_world_state: baseNext,
      scene_id: input.scene_id,
      event: input.event,
      turn_id: input.turn_id ?? null,
      selected_action_intents: input.selected_action_intents,
      resolved_action_outcomes: input.resolved_action_outcomes,
      elapsed_ms: Math.max(elapsedMs, nonNegativeNumber(lastCombat.elapsed_ms, 0)),
      suppressed_action_ids: suppressedList,
    });

    const fatals = stableSort([
      ...fatalCombatEvents(lastCombat),
      ...fatalProjectileEvents(lastPhysics),
    ]);
    const executions = executionEntries(input, suppressedList);
    const additions = preemptionsFor(executions, fatals, suppressed);
    if (!additions.length) break;
    for (const item of additions) {
      if (suppressed.has(item.action_id)) continue;
      suppressed.add(item.action_id);
      preemptions.push(item);
    }
  }

  const suppressedActionIds = [...suppressed].sort();
  const previewEntries = stableSort([
    ...array(lastCombat?.timeline_entries).map((entry) => ({ ...entry, source_layer: "combat" })),
    ...array(lastPhysics?.timeline_entries).map((entry) => ({ ...entry, source_layer: "continuous_physics" })),
    ...preemptions.map((item) => ({
      kind: "action_preempted",
      actor: item.actor,
      action_id: item.action_id,
      time_ms: item.preempted_at_ms,
      scheduled_time_ms: item.scheduled_time_ms,
      cause: item.cause,
      caused_by_actor: item.caused_by_actor,
      caused_by_action_id: item.caused_by_action_id,
      projectile_id: item.projectile_id,
      source_layer: "global_timeline",
    })),
  ]);

  return {
    version: worldSimulationGlobalCausalTimelineVersion,
    iterations,
    suppressed_action_ids: suppressedActionIds,
    preemptions,
    preview_entries: previewEntries,
    timeline_hash: hashAgentRunValue({
      version: worldSimulationGlobalCausalTimelineVersion,
      turn_id: input.turn_id ?? null,
      suppressed_action_ids: suppressedActionIds,
      preemptions,
      preview_entries: previewEntries,
    }),
  };
}

export function buildResolvedWorldSimulationGlobalTimeline(input = {}) {
  const entries = [];
  for (const outcome of array(input.spatial_action_outcomes)) {
    const durationMs = finiteNumber(outcome?.duration_ms);
    if (durationMs === null) continue;
    let kind = "action_complete";
    if (outcome.result === "movement_completed") kind = "movement_complete";
    else if (String(outcome.result ?? "").startsWith("door_")) kind = "door_interaction_complete";
    else if (["pickup_completed", "drop_completed", "transfer_completed"].includes(outcome.result)) kind = "object_interaction_complete";
    entries.push({
      kind,
      actor: outcome.actor ?? null,
      action_id: outcome.action_id ?? null,
      time_ms: durationMs,
      result: outcome.result ?? null,
      source_layer: "spatial_rules",
    });
  }
  entries.push(...array(input.combat_resolution?.timeline_entries).map((entry) => ({ ...entry, source_layer: "combat" })));
  for (const resolution of array(input.combat_resolution?.combat_resolutions)) {
    const timeMs = finiteNumber(resolution?.resolution_trace?.contact_time_ms);
    if (timeMs === null) continue;
    entries.push({
      kind: "melee_contact",
      actor: resolution.actor ?? null,
      target: resolution.target ?? null,
      time_ms: timeMs,
      hit: resolution.hit ?? null,
      damage_applied: resolution.damage_applied ?? 0,
      result: resolution.hit ? "melee_contact_resolved" : (resolution.reason ?? "melee_miss"),
      source_layer: "combat_resolution",
    });
  }
  entries.push(...array(input.physics_resolution?.timeline_entries).map((entry) => ({ ...entry, source_layer: "continuous_physics" })));
  entries.push(...array(input.arbitration?.preemptions).map((item) => ({
    kind: "action_preempted",
    actor: item.actor,
    action_id: item.action_id,
    time_ms: item.preempted_at_ms,
    scheduled_time_ms: item.scheduled_time_ms,
    result: "preempted_by_earlier_incapacitation",
    cause: item.cause,
    caused_by_actor: item.caused_by_actor,
    caused_by_action_id: item.caused_by_action_id,
    projectile_id: item.projectile_id,
    source_layer: "global_timeline",
  })));

  const ordered = stableSort(entries).map((entry, index) => ({
    sequence: index + 1,
    ...entry,
  }));
  const timeline = {
    version: worldSimulationGlobalCausalTimelineVersion,
    ordering: "time_ms_then_stable_programmatic_tie_break",
    suppressed_action_ids: array(input.arbitration?.suppressed_action_ids),
    arbitration_iterations: input.arbitration?.iterations ?? 0,
    entries: ordered,
  };
  timeline.timeline_hash = hashAgentRunValue(timeline);
  return timeline;
}
