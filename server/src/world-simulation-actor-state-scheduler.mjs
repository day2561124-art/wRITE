export const worldSimulationActorStateSchedulerVersion = "phase62i-continuous-actor-state-v1";

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

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
}

function point(value) {
  const record = object(value);
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  if (x === null || y === null) return null;
  return { x, y };
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function sceneFor(worldState, sceneId) {
  const scenes = object(worldState.scenes);
  return object(scenes[sceneId] ?? worldState.scene_state);
}

function selectedForCharacter(selectedActionIntents, actor) {
  return array(selectedActionIntents).find((item) => String(item?.character ?? "") === actor) ?? null;
}

function movementOutcomeFor(outcomes, actor, actionId) {
  return array(outcomes).find((item) => (
    String(item?.actor ?? "") === actor
    && String(item?.action_id ?? "") === String(actionId ?? "")
    && item?.result === "movement_completed"
  )) ?? null;
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

function initialMovementMultiplier(worldState, actor) {
  const character = object(object(worldState.characters)[actor]);
  const physical = object(character.physical_state);
  return positiveNumber(physical.movement_multiplier ?? character.movement_multiplier, 1);
}

function actorEvents(input, actor) {
  const events = [];
  for (const injury of array(input.injury_events)) {
    if (String(injury?.target ?? "") !== actor) continue;
    const timeMs = finiteNumber(injury?.time_ms);
    if (timeMs === null || timeMs < 0) continue;
    events.push({
      kind: "injury_rate_change",
      time_ms: timeMs,
      movement_multiplier_after: nonNegativeNumber(injury.movement_multiplier_after, 1),
      source_layer: injury.source_layer ?? null,
      source_action_id: injury.source_action_id ?? null,
      projectile_id: injury.projectile_id ?? null,
      injury_severity: injury.injury_severity ?? null,
    });
  }
  for (const fatal of array(input.incapacitation_events)) {
    if (String(fatal?.target ?? "") !== actor) continue;
    const timeMs = finiteNumber(fatal?.time_ms);
    if (timeMs === null || timeMs < 0) continue;
    events.push({
      kind: "incapacitation",
      time_ms: timeMs,
      source_layer: fatal.source_layer ?? null,
      source_action_id: fatal.action_id ?? null,
      projectile_id: fatal.projectile_id ?? null,
      cause: fatal.cause ?? "incapacitation",
    });
  }
  const priority = new Map([["injury_rate_change", 10], ["incapacitation", 20]]);
  return events.sort((left, right) => (
    left.time_ms - right.time_ms
    || (priority.get(left.kind) ?? 99) - (priority.get(right.kind) ?? 99)
    || String(left.source_action_id ?? "").localeCompare(String(right.source_action_id ?? ""))
  ));
}

function interpolate(from, to, ratio) {
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function pushMotionSegment(segments, startMs, endMs, from, to, speedMps, rate, cause) {
  if (endMs <= startMs + 1e-9) return;
  segments.push({
    start_ms: startMs,
    end_ms: endMs,
    from: cloneJson(from),
    to: cloneJson(to),
    speed_mps: speedMps,
    execution_rate: rate,
    cause,
  });
}

function buildTrajectoryForMovement(input, actor, candidate, outcome, start, destination) {
  const nominalDurationMs = positiveNumber(outcome.duration_ms, positiveNumber(candidate.duration_ms, null));
  const totalDistance = distance(start, destination);
  if (!nominalDurationMs || totalDistance <= 1e-12) {
    return {
      actor,
      action_id: candidate.action_id ?? null,
      start: cloneJson(start),
      destination: cloneJson(destination),
      total_distance_m: totalDistance,
      nominal_completion_ms: nominalDurationMs ?? 0,
      completion_time_ms: nominalDurationMs ?? 0,
      interrupted: false,
      interrupted_at_ms: null,
      stop_reason: null,
      segments: [],
      final_position: cloneJson(destination),
      distance_travelled_m: totalDistance,
    };
  }

  const unit = {
    x: (destination.x - start.x) / totalDistance,
    y: (destination.y - start.y) / totalDistance,
  };
  const nominalSpeed = totalDistance / (nominalDurationMs / 1000);
  const initialMultiplier = initialMovementMultiplier(input.world_state, actor);
  let currentMultiplier = initialMultiplier;
  let currentRate = 1;
  let currentTimeMs = 0;
  let travelled = 0;
  let currentPosition = cloneJson(start);
  let interrupted = false;
  let interruptedAtMs = null;
  let stopReason = null;
  const segments = [];
  const rateChanges = [];

  const advanceUntil = (targetTimeMs, cause) => {
    if (interrupted || travelled >= totalDistance - 1e-9 || targetTimeMs <= currentTimeMs + 1e-9) {
      currentTimeMs = Math.max(currentTimeMs, targetTimeMs);
      return false;
    }
    const speed = nominalSpeed * currentRate;
    if (speed <= 1e-12) {
      currentTimeMs = targetTimeMs;
      return false;
    }
    const availableSeconds = (targetTimeMs - currentTimeMs) / 1000;
    const possibleDistance = speed * availableSeconds;
    const remainingDistance = totalDistance - travelled;
    if (possibleDistance >= remainingDistance - 1e-9) {
      const neededMs = remainingDistance / speed * 1000;
      const endTimeMs = currentTimeMs + neededMs;
      const from = cloneJson(currentPosition);
      currentPosition = cloneJson(destination);
      pushMotionSegment(segments, currentTimeMs, endTimeMs, from, currentPosition, speed, currentRate, cause);
      travelled = totalDistance;
      currentTimeMs = endTimeMs;
      return true;
    }
    const from = cloneJson(currentPosition);
    travelled += possibleDistance;
    currentPosition = {
      x: start.x + unit.x * travelled,
      y: start.y + unit.y * travelled,
    };
    pushMotionSegment(segments, currentTimeMs, targetTimeMs, from, currentPosition, speed, currentRate, cause);
    currentTimeMs = targetTimeMs;
    return false;
  };

  for (const event of actorEvents(input, actor)) {
    if (travelled >= totalDistance - 1e-9 || interrupted) break;
    const eventTimeMs = Math.max(currentTimeMs, event.time_ms);
    if (advanceUntil(eventTimeMs, "movement_before_actor_state_change")) break;
    if (event.kind === "incapacitation") {
      interrupted = true;
      interruptedAtMs = event.time_ms;
      stopReason = event.cause ?? "incapacitated_mid_movement";
      rateChanges.push({
        actor,
        action_id: candidate.action_id ?? null,
        kind: "movement_interrupted",
        time_ms: event.time_ms,
        position: cloneJson(currentPosition),
        cause: stopReason,
        source_layer: event.source_layer ?? null,
        source_action_id: event.source_action_id ?? null,
        projectile_id: event.projectile_id ?? null,
      });
      break;
    }
    const after = nonNegativeNumber(event.movement_multiplier_after, currentMultiplier);
    const previousRate = currentRate;
    currentMultiplier = Math.min(currentMultiplier, after);
    currentRate = initialMultiplier > 1e-12 ? Math.max(0, currentMultiplier / initialMultiplier) : 0;
    if (Math.abs(previousRate - currentRate) > 1e-9) {
      rateChanges.push({
        actor,
        action_id: candidate.action_id ?? null,
        kind: "movement_rate_adjusted",
        time_ms: event.time_ms,
        execution_rate_before: previousRate,
        execution_rate_after: currentRate,
        movement_multiplier_after: currentMultiplier,
        position: cloneJson(currentPosition),
        cause: "earlier_injury_reduced_movement_rate",
        source_layer: event.source_layer ?? null,
        source_action_id: event.source_action_id ?? null,
        projectile_id: event.projectile_id ?? null,
      });
    }
    if (currentRate <= 1e-12) {
      interrupted = true;
      interruptedAtMs = event.time_ms;
      stopReason = "movement_rate_reduced_to_zero";
      break;
    }
  }

  if (!interrupted && travelled < totalDistance - 1e-9) {
    const speed = nominalSpeed * currentRate;
    if (speed <= 1e-12) {
      interrupted = true;
      interruptedAtMs = currentTimeMs;
      stopReason = "movement_rate_zero";
    } else {
      const remainingDistance = totalDistance - travelled;
      const endTimeMs = currentTimeMs + remainingDistance / speed * 1000;
      const from = cloneJson(currentPosition);
      currentPosition = cloneJson(destination);
      pushMotionSegment(
        segments,
        currentTimeMs,
        endTimeMs,
        from,
        currentPosition,
        speed,
        currentRate,
        currentTimeMs > 0 ? "movement_after_actor_state_change" : "nominal_movement",
      );
      travelled = totalDistance;
      currentTimeMs = endTimeMs;
    }
  }

  return {
    actor,
    action_id: candidate.action_id ?? null,
    start: cloneJson(start),
    destination: cloneJson(destination),
    total_distance_m: totalDistance,
    nominal_completion_ms: nominalDurationMs,
    completion_time_ms: interrupted ? null : currentTimeMs,
    interrupted,
    interrupted_at_ms: interruptedAtMs,
    stop_reason: stopReason,
    segments,
    rate_changes: rateChanges,
    final_position: cloneJson(currentPosition),
    distance_travelled_m: travelled,
  };
}

export function positionAtWorldSimulationActorTrajectory(trajectory, timeMs) {
  const record = object(trajectory);
  const start = point(record.start);
  if (!start) return null;
  const time = Math.max(0, finiteNumber(timeMs, 0));
  for (const segment of array(record.segments)) {
    const segmentStart = finiteNumber(segment.start_ms, 0);
    const segmentEnd = finiteNumber(segment.end_ms, segmentStart);
    if (time < segmentStart - 1e-9) return point(segment.from) ?? start;
    if (time <= segmentEnd + 1e-9) {
      const from = point(segment.from) ?? start;
      const to = point(segment.to) ?? from;
      const duration = Math.max(1e-9, segmentEnd - segmentStart);
      const ratio = Math.min(1, Math.max(0, (time - segmentStart) / duration));
      return interpolate(from, to, ratio);
    }
  }
  return point(record.final_position ?? record.destination) ?? start;
}

export function velocityAtWorldSimulationActorTrajectory(trajectory, timeMs) {
  const time = Math.max(0, finiteNumber(timeMs, 0));
  for (const segment of array(object(trajectory).segments)) {
    const startMs = finiteNumber(segment.start_ms, 0);
    const endMs = finiteNumber(segment.end_ms, startMs);
    if (time < startMs - 1e-9 || time >= endMs - 1e-9) continue;
    const from = point(segment.from);
    const to = point(segment.to);
    if (!from || !to || endMs <= startMs) return { x: 0, y: 0 };
    const seconds = (endMs - startMs) / 1000;
    return { x: (to.x - from.x) / seconds, y: (to.y - from.y) / seconds };
  }
  return { x: 0, y: 0 };
}

export function worldSimulationActorTrajectoryBreakpoints(trajectory) {
  const values = new Set([0]);
  for (const segment of array(object(trajectory).segments)) {
    values.add(nonNegativeNumber(segment.start_ms, 0));
    values.add(nonNegativeNumber(segment.end_ms, 0));
  }
  const interruptedAt = finiteNumber(object(trajectory).interrupted_at_ms);
  if (interruptedAt !== null) values.add(nonNegativeNumber(interruptedAt, 0));
  const completion = finiteNumber(object(trajectory).completion_time_ms);
  if (completion !== null) values.add(nonNegativeNumber(completion, 0));
  return [...values].sort((a, b) => a - b);
}

export function buildWorldSimulationActorTrajectories(input = {}) {
  const scene = sceneFor(object(input.world_state), input.scene_id);
  const trajectories = {};
  const adjustments = [];
  for (const selected of array(input.selected_action_intents)) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const actionId = String(candidate.action_id ?? "").trim();
    if (!actor || !actionId || !isObject(candidate.movement)) continue;
    const outcome = movementOutcomeFor(input.resolved_action_outcomes, actor, actionId);
    if (!outcome) continue;
    const start = point(object(scene.entity_positions)[actor]);
    if (!start) continue;
    const destination = movementDestination(candidate, start);
    if (!destination) continue;
    const trajectory = buildTrajectoryForMovement(input, actor, candidate, outcome, start, destination);
    trajectories[actor] = trajectory;
    adjustments.push(...array(trajectory.rate_changes));
    if (!trajectory.interrupted
      && trajectory.completion_time_ms !== null
      && Math.abs(trajectory.completion_time_ms - trajectory.nominal_completion_ms) > 1e-6) {
      adjustments.push({
        actor,
        action_id: actionId,
        kind: "movement_completion_refined",
        time_ms: trajectory.completion_time_ms,
        nominal_time_ms: trajectory.nominal_completion_ms,
        refined_time_ms: trajectory.completion_time_ms,
        cause: "piecewise_movement_rate_integration",
      });
    }
  }
  return {
    version: worldSimulationActorStateSchedulerVersion,
    actor_trajectories: trajectories,
    movement_adjustments: adjustments,
  };
}

export function applyWorldSimulationActorTrajectories(nextWorldState, sceneId, actorTrajectories, elapsedMs, transitions = []) {
  const state = object(nextWorldState);
  const scene = object(object(state.scenes)[sceneId] ?? state.scene_state);
  scene.entity_positions = object(scene.entity_positions);
  const finalPositions = {};
  for (const [actor, trajectory] of Object.entries(object(actorTrajectories))) {
    const before = point(scene.entity_positions[actor]);
    const position = positionAtWorldSimulationActorTrajectory(trajectory, elapsedMs);
    if (!position) continue;
    scene.entity_positions[actor] = cloneJson(position);
    finalPositions[actor] = cloneJson(position);
    if (!before || Math.hypot(before.x - position.x, before.y - position.y) > 1e-9) {
      transitions.push({
        entity: actor,
        field: "position",
        from: cloneJson(before),
        to: cloneJson(position),
        cause: object(trajectory).interrupted
          ? `continuous actor-state scheduler stopped movement at ${Number(trajectory.interrupted_at_ms).toFixed(3)}ms`
          : `continuous actor-state scheduler integrated movement through ${Number(elapsedMs).toFixed(3)}ms`,
        adjudication: "programmatic_continuous_actor_state_scheduler",
        scene_id: sceneId,
      });
    }
  }
  if (Object.hasOwn(object(state.scenes), sceneId)) state.scenes[sceneId] = scene;
  else state.scene_state = scene;
  return { next_world_state: state, final_positions: finalPositions };
}

export function reconcileWorldSimulationMovementOutcomes(outcomes, actorTrajectories) {
  for (const outcome of array(outcomes)) {
    if (outcome?.result !== "movement_completed") continue;
    const trajectory = object(object(actorTrajectories)[String(outcome.actor ?? "")]);
    if (!Object.keys(trajectory).length || String(trajectory.action_id ?? "") !== String(outcome.action_id ?? "")) continue;
    if (trajectory.interrupted) {
      outcome.result = "movement_interrupted";
      outcome.duration_ms = nonNegativeNumber(trajectory.interrupted_at_ms, 0);
      outcome.distance_m = nonNegativeNumber(trajectory.distance_travelled_m, 0);
      outcome.causal_evidence = `movement stopped at ${Number(outcome.duration_ms).toFixed(3)}ms because ${trajectory.stop_reason ?? "actor became unable to continue"}`;
      outcome.interrupted_at_ms = trajectory.interrupted_at_ms;
      outcome.final_position = cloneJson(trajectory.final_position);
      outcome.adjudication = "programmatic_continuous_actor_state_scheduler";
      continue;
    }
    if (finiteNumber(trajectory.completion_time_ms) !== null) {
      outcome.nominal_duration_ms = outcome.duration_ms;
      outcome.duration_ms = trajectory.completion_time_ms;
      outcome.timeline_refined = Math.abs(outcome.duration_ms - outcome.nominal_duration_ms) > 1e-6;
      outcome.final_position = cloneJson(trajectory.final_position);
      if (outcome.timeline_refined) {
        outcome.causal_evidence = `movement duration refined from ${Number(outcome.nominal_duration_ms).toFixed(3)}ms to ${Number(outcome.duration_ms).toFixed(3)}ms by piecewise actor-state integration`;
        outcome.adjudication = "programmatic_continuous_actor_state_scheduler";
      }
    }
  }
  return outcomes;
}

export function buildWorldSimulationActorStateContract() {
  return {
    version: worldSimulationActorStateSchedulerVersion,
    owner: "programmatic_continuous_actor_state_scheduler",
    movement: {
      piecewise_position_integration: true,
      nonfatal_injury_changes_remaining_speed_immediately: true,
      incapacitation_stops_in_progress_movement_at_causal_position: true,
      refined_completion_time_can_extend_turn_window: true,
      combat_and_projectile_collision_may_sample_piecewise_trajectory: true,
    },
    ability_field: {
      exposure_may_sample_piecewise_actor_trajectory: true,
      deterministic_tick_events_supported: true,
    },
    character_brain_may_decide_position_after_interruption: false,
    character_brain_may_decide_field_exposure: false,
    known_boundary: "Phase62I v1 makes actor movement piecewise and lets ability exposure sample that trajectory. Tick damage is deterministic, but all continuous world processes are not yet represented as one infinitesimal-step solver.",
  };
}
