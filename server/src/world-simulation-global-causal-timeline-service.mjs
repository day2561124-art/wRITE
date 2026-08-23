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
import {
  buildWorldSimulationTimelineRefinementContract,
  collectWorldSimulationInjuryRateEvents,
  refineWorldSimulationExecutionTimes,
  worldSimulationTimelineRefinementVersion,
} from "./world-simulation-timeline-refinement-service.mjs";
import {
  buildWorldSimulationActorStateContract,
  buildWorldSimulationActorTrajectories,
  worldSimulationActorStateSchedulerVersion,
} from "./world-simulation-actor-state-scheduler.mjs";
import {
  arbitrateWorldSimulationCrossLayerEventCandidates,
  buildWorldSimulationCrossLayerEventArbitrationContract,
  worldSimulationCrossLayerEventArbitrationVersion,
} from "./world-simulation-cross-layer-event-arbitration-service.mjs";
import {
  assertWorldSimulationCausalEpochCandidatesFresh,
  bindWorldSimulationCandidatesToCausalEpoch,
  buildWorldSimulationCausalEpochContract,
  openWorldSimulationCausalEpoch,
  worldSimulationCausalEpochVersion,
} from "./world-simulation-causal-epoch-service.mjs";

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
    ["ability_field_tick", 15],
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

function fatalAbilityFieldEvents(physicsResolution) {
  return array(physicsResolution?.ability_resolutions).flatMap((resolution) => {
    if (resolution?.result !== "ability_field_tick") return [];
    const healthAfter = finiteNumber(resolution?.health_after);
    const target = String(resolution?.target ?? "").trim();
    if (!target || healthAfter === null || healthAfter > 0) return [];
    return [{
      kind: "incapacitation",
      target,
      actor: resolution.owner ?? null,
      action_id: resolution.source_action_id ?? null,
      field_id: resolution.field_id ?? null,
      time_ms: nonNegativeNumber(resolution.time_ms, 0),
      cause: "ability_field_tick",
      source_layer: "ability_field",
    }];
  });
}

function executionEntries(input, suppressedActionIds, actionTimeOverrides = {}) {
  return stableSort([
    ...buildWorldSimulationCombatTimelineEntries({
      world_state: input.world_state,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedActionIds,
      action_time_overrides: actionTimeOverrides,
    }),
    ...buildWorldSimulationContinuousIntentTimelineEntries({
      world_state: input.world_state,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedActionIds,
      action_time_overrides: actionTimeOverrides,
    }),
  ]);
}

function crossLayerCandidate(entry, role) {
  const observation = cloneJson(object(entry));
  const sourceLayer = String(observation.source_layer ?? "unknown").trim() || "unknown";
  const kind = String(observation.kind ?? "event").trim() || "event";
  const actor = String(observation.actor ?? observation.target ?? "").trim();
  const actionId = String(observation.action_id ?? "").trim();
  const subjectId = String(
    observation.projectile_id
      ?? observation.field_id
      ?? actor
      ?? actionId
      ?? "",
  ).trim();
  return {
    candidate_id: `${sourceLayer}:${role}:${kind}:${subjectId || actionId || "anonymous"}:${nonNegativeNumber(observation.time_ms, 0)}`,
    source_layer: sourceLayer,
    role,
    kind,
    subject_id: subjectId || null,
    action_id: actionId || null,
    time_ms: nonNegativeNumber(observation.time_ms, 0),
    observation,
  };
}

function crossLayerObservations(arbitration, role) {
  return array(arbitration?.result?.batches).flatMap((batch) => (
    array(batch.members)
      .filter((candidate) => candidate?.role === role)
      .map((candidate) => cloneJson(object(candidate.observation)))
  ));
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
    timeline_refinement: buildWorldSimulationTimelineRefinementContract(),
    continuous_actor_state: buildWorldSimulationActorStateContract(),
    cross_layer_event_arbitration: buildWorldSimulationCrossLayerEventArbitrationContract(),
    causal_epoch_freshness: buildWorldSimulationCausalEpochContract(),
    character_brain_may_decide_timestamps_as_outcomes: false,
    known_boundary: "Phase62G supplies the global point-event clock. Phase62H refines deferred execution/topology, and Phase62I integrates in-progress actor movement with injury/incapacitation plus piecewise ability-field exposure.",
  };
}

export function arbitrateWorldSimulationGlobalTimeline(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const persistedWorldStateHash = String(input.world_state_hash ?? hashAgentRunValue(snapshot));
  const persistedWorldStateRevision = Number.isSafeInteger(Number(input.world_state_revision))
    && Number(input.world_state_revision) >= 0
    ? Number(input.world_state_revision)
    : 0;
  const baseNext = cloneJson(object(input.next_world_state ?? snapshot));
  const suppressed = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  const preemptions = [];
  let actionTimeOverrides = {};
  let rateAdjustments = [];
  let injuryRateEvents = [];
  let actorTrajectories = {};
  let movementAdjustments = [];
  let lastCombat = null;
  let lastPhysics = null;
  let lastCrossLayerArbitration = null;
  const crossLayerArbitrationAudits = [];
  const causalEpochRecords = [];
  let iterations = 0;
  const maxIterations = Math.max(4, array(input.selected_action_intents).length * 2 + 4);

  while (iterations < maxIterations) {
    iterations += 1;
    const suppressedList = [...suppressed].sort();
    const causalEpoch = openWorldSimulationCausalEpoch({
      world_state: snapshot,
      world_state_revision: persistedWorldStateRevision,
      world_state_hash: persistedWorldStateHash,
      epoch_index: iterations,
      derivation_context: {
        suppressed_action_ids: suppressedList,
        action_time_overrides: cloneJson(actionTimeOverrides),
        actor_trajectories: cloneJson(actorTrajectories),
      },
    });
    const combatEntries = buildWorldSimulationCombatTimelineEntries({
      world_state: snapshot,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedList,
      action_time_overrides: actionTimeOverrides,
    });
    const continuousEntries = buildWorldSimulationContinuousIntentTimelineEntries({
      world_state: snapshot,
      selected_action_intents: input.selected_action_intents,
      suppressed_action_ids: suppressedList,
      action_time_overrides: actionTimeOverrides,
    });
    let elapsedMs = actionWindowMs(input, combatEntries);
    for (const entry of continuousEntries) elapsedMs = Math.max(elapsedMs, nonNegativeNumber(entry.time_ms, 0));
    for (const override of Object.values(object(actionTimeOverrides))) {
      for (const value of Object.values(object(override))) elapsedMs = Math.max(elapsedMs, nonNegativeNumber(value, 0));
    }
    for (const trajectory of Object.values(object(actorTrajectories))) {
      const completion = finiteNumber(trajectory?.completion_time_ms);
      const interrupted = finiteNumber(trajectory?.interrupted_at_ms);
      if (completion !== null) elapsedMs = Math.max(elapsedMs, nonNegativeNumber(completion, 0));
      else if (interrupted !== null) elapsedMs = Math.max(elapsedMs, nonNegativeNumber(interrupted, 0));
    }

    lastCombat = adjudicateWorldSimulationCombat({
      world_state: snapshot,
      next_world_state: baseNext,
      scene_id: input.scene_id,
      event: input.event,
      selected_action_intents: input.selected_action_intents,
      resolved_action_outcomes: input.resolved_action_outcomes,
      suppressed_action_ids: suppressedList,
      action_time_overrides: actionTimeOverrides,
      actor_trajectories: actorTrajectories,
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
      action_time_overrides: actionTimeOverrides,
      actor_trajectories: actorTrajectories,
    });

    const fatals = stableSort([
      ...fatalCombatEvents(lastCombat),
      ...fatalProjectileEvents(lastPhysics),
      ...fatalAbilityFieldEvents(lastPhysics),
    ]);
    const executionCandidates = [
      ...combatEntries.map((entry) => crossLayerCandidate({ ...entry, source_layer: "combat" }, "execution")),
      ...continuousEntries.map((entry) => crossLayerCandidate({ ...entry, source_layer: "continuous_physics" }, "execution")),
    ];
    const fatalCandidates = fatals.map((entry) => crossLayerCandidate(entry, "incapacitation"));
    const epochBoundCandidates = bindWorldSimulationCandidatesToCausalEpoch({
      epoch: causalEpoch.epoch,
      candidates: [...executionCandidates, ...fatalCandidates],
    });
    const freshness = assertWorldSimulationCausalEpochCandidatesFresh({
      epoch: causalEpoch.epoch,
      candidates: epochBoundCandidates.candidates,
    });
    lastCrossLayerArbitration = arbitrateWorldSimulationCrossLayerEventCandidates({
      candidates: epochBoundCandidates.candidates,
      simultaneous_tolerance_ms: 1e-6,
    });
    crossLayerArbitrationAudits.push(lastCrossLayerArbitration.audit);
    const executions = crossLayerObservations(lastCrossLayerArbitration, "execution");
    const orderedFatals = crossLayerObservations(lastCrossLayerArbitration, "incapacitation");
    const additions = preemptionsFor(executions, orderedFatals, suppressed);

    injuryRateEvents = collectWorldSimulationInjuryRateEvents({
      combat_resolution: lastCombat,
      physics_resolution: lastPhysics,
    });
    const nominalExecutions = executionEntries(input, suppressedList, {});
    const refinement = refineWorldSimulationExecutionTimes({
      world_state: snapshot,
      execution_entries: nominalExecutions,
      injury_events: injuryRateEvents,
    });
    const nextOverrides = refinement.action_time_overrides;
    const overridesChanged = JSON.stringify(nextOverrides) !== JSON.stringify(actionTimeOverrides);
    actionTimeOverrides = nextOverrides;
    rateAdjustments = refinement.rate_adjustments;

    const actorState = buildWorldSimulationActorTrajectories({
      world_state: snapshot,
      scene_id: input.scene_id,
      selected_action_intents: input.selected_action_intents,
      resolved_action_outcomes: input.resolved_action_outcomes,
      injury_events: injuryRateEvents,
      incapacitation_events: fatals,
      elapsed_ms: elapsedMs,
    });
    const nextActorTrajectories = actorState.actor_trajectories;
    const trajectoriesChanged = JSON.stringify(nextActorTrajectories) !== JSON.stringify(actorTrajectories);
    actorTrajectories = nextActorTrajectories;
    movementAdjustments = actorState.movement_adjustments;

    for (const item of additions) {
      if (suppressed.has(item.action_id)) continue;
      suppressed.add(item.action_id);
      preemptions.push(item);
    }
    const invalidationReasons = [];
    if (additions.length) invalidationReasons.push("suppressed_action_set_changed");
    if (overridesChanged) invalidationReasons.push("action_time_overrides_changed");
    if (trajectoriesChanged) invalidationReasons.push("actor_trajectories_changed");
    causalEpochRecords.push({
      ...cloneJson(causalEpoch.epoch),
      candidate_count: freshness.candidate_count,
      candidate_set_hash: freshness.candidate_set_hash,
      candidate_freshness_verified: freshness.candidate_freshness_verified,
      arbitration_audit_hash: lastCrossLayerArbitration.audit.audit_hash,
      invalidated_after_iteration: invalidationReasons.length > 0,
      invalidation_reasons: invalidationReasons,
      next_iteration_requires_requery_and_rearbitration: invalidationReasons.length > 0,
    });
    if (!invalidationReasons.length) break;
  }

  const suppressedActionIds = [...suppressed].sort();
  const previewEntries = stableSort([
    ...array(lastCombat?.timeline_entries).map((entry) => ({ ...entry, source_layer: "combat" })),
    ...array(lastPhysics?.timeline_entries).map((entry) => ({ ...entry, source_layer: "continuous_physics" })),
    ...rateAdjustments.map((item) => ({
      kind: "action_rate_adjusted",
      actor: item.actor,
      action_id: item.action_id,
      time_ms: item.refined_time_ms,
      nominal_time_ms: item.nominal_time_ms,
      refined_time_ms: item.refined_time_ms,
      cause: item.cause,
      source_layer: "timeline_refinement",
    })),
    ...movementAdjustments.map((item) => ({
      ...cloneJson(item),
      source_layer: "continuous_actor_state",
    })),
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
    refinement_version: worldSimulationTimelineRefinementVersion,
    actor_state_scheduler_version: worldSimulationActorStateSchedulerVersion,
    cross_layer_event_arbitration_version: worldSimulationCrossLayerEventArbitrationVersion,
    causal_epoch_version: worldSimulationCausalEpochVersion,
    causal_epochs: {
      version: worldSimulationCausalEpochVersion,
      world_state_revision: persistedWorldStateRevision,
      world_state_hash: persistedWorldStateHash,
      epoch_count: causalEpochRecords.length,
      epochs: cloneJson(causalEpochRecords),
      all_candidates_bound_to_epoch: causalEpochRecords.every((epoch) => epoch?.candidate_freshness_verified === true),
      stale_candidate_rejection_enabled: true,
      prior_epoch_candidates_reused: false,
      requery_rearbitration_after_epoch_invalidation: causalEpochRecords
        .filter((epoch) => epoch?.invalidated_after_iteration === true)
        .every((epoch) => epoch?.next_iteration_requires_requery_and_rearbitration === true),
    },
    cross_layer_event_arbitration: {
      version: worldSimulationCrossLayerEventArbitrationVersion,
      audit_count: crossLayerArbitrationAudits.length,
      audits: cloneJson(crossLayerArbitrationAudits),
      final_result: cloneJson(lastCrossLayerArbitration?.result ?? null),
      candidate_inputs_immutable: crossLayerArbitrationAudits.every((audit) => audit?.input_candidates_immutable === true),
      candidate_order_invariant: crossLayerArbitrationAudits.every((audit) => audit?.candidate_order_invariant === true),
      exact_timestamp_batches_preserved: crossLayerArbitrationAudits.every((audit) => audit?.exact_timestamp_batches_preserved === true),
      deterministic_replay_verified: crossLayerArbitrationAudits.every((audit) => audit?.deterministic_replay_verified === true),
      arbitration_outputs_contain_world_state: false,
      arbitration_outputs_contain_mutation_proposals: false,
    },
    iterations,
    suppressed_action_ids: suppressedActionIds,
    preemptions,
    injury_rate_events: injuryRateEvents,
    action_time_overrides: actionTimeOverrides,
    rate_adjustments: rateAdjustments,
    actor_trajectories: actorTrajectories,
    movement_adjustments: movementAdjustments,
    preview_entries: previewEntries,
    timeline_hash: hashAgentRunValue({
      version: worldSimulationGlobalCausalTimelineVersion,
      refinement_version: worldSimulationTimelineRefinementVersion,
      actor_state_scheduler_version: worldSimulationActorStateSchedulerVersion,
      cross_layer_event_arbitration_version: worldSimulationCrossLayerEventArbitrationVersion,
      cross_layer_event_arbitration: cloneJson(lastCrossLayerArbitration?.result ?? null),
      causal_epoch_version: worldSimulationCausalEpochVersion,
      causal_epochs: cloneJson(causalEpochRecords),
      turn_id: input.turn_id ?? null,
      suppressed_action_ids: suppressedActionIds,
      preemptions,
      injury_rate_events: injuryRateEvents,
      action_time_overrides: actionTimeOverrides,
      rate_adjustments: rateAdjustments,
      actor_trajectories: actorTrajectories,
      movement_adjustments: movementAdjustments,
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
  entries.push(...array(input.arbitration?.rate_adjustments).map((item) => ({
    kind: "action_rate_adjusted",
    actor: item.actor ?? null,
    action_id: item.action_id ?? null,
    time_ms: item.refined_time_ms ?? 0,
    nominal_time_ms: item.nominal_time_ms ?? null,
    refined_time_ms: item.refined_time_ms ?? null,
    result: "execution_delayed_by_earlier_nonfatal_injury",
    source_layer: "timeline_refinement",
  })));
  entries.push(...array(input.arbitration?.movement_adjustments).map((item) => ({
    ...cloneJson(item),
    result: item.kind === "movement_interrupted"
      ? "movement_interrupted_by_actor_state"
      : "movement_reintegrated_by_actor_state",
    source_layer: "continuous_actor_state",
  })));
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
    refinement_version: input.arbitration?.refinement_version ?? null,
    actor_state_scheduler_version: input.arbitration?.actor_state_scheduler_version ?? null,
    cross_layer_event_arbitration_version: input.arbitration?.cross_layer_event_arbitration_version ?? null,
    cross_layer_event_arbitration: cloneJson(input.arbitration?.cross_layer_event_arbitration ?? null),
    causal_epoch_version: input.arbitration?.causal_epoch_version ?? null,
    causal_epochs: cloneJson(input.arbitration?.causal_epochs ?? null),
    action_time_overrides: cloneJson(object(input.arbitration?.action_time_overrides)),
    rate_adjustments: cloneJson(array(input.arbitration?.rate_adjustments)),
    actor_trajectories: cloneJson(object(input.arbitration?.actor_trajectories)),
    movement_adjustments: cloneJson(array(input.arbitration?.movement_adjustments)),
    entries: ordered,
  };
  timeline.timeline_hash = hashAgentRunValue(timeline);
  return timeline;
}
