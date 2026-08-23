import {
  projectWorldSimulationImmutableEvaluatorProposals,
  runWorldSimulationImmutableCausalEvaluator,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "./world-simulation-immutable-causal-evaluator-service.mjs";

export const worldSimulationImmutableAbilityFieldLifecycleVersion = "phase62q-immutable-ability-field-lifecycle-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
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

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function fieldTransition(fieldId, field, from, to, cause, timeMs = null, extra = {}) {
  if (JSON.stringify(from) === JSON.stringify(to)) return null;
  const resolvedTime = finiteNumber(timeMs);
  return {
    entity: fieldId,
    field,
    from: cloneJson(from),
    to: cloneJson(to),
    cause,
    adjudication: "programmatic_continuous_physics",
    ...(resolvedTime === null ? {} : { time_ms: Math.max(0, resolvedTime) }),
    ...cloneJson(extra),
  };
}

function validateField(field) {
  const fieldId = String(field?.field_id ?? "").trim();
  const remainingMs = nonNegativeNumber(field?.remaining_ms, 0);
  return {
    fieldId,
    remainingMs,
    ok: Boolean(fieldId),
  };
}

export function evaluateWorldSimulationAbilityFieldSpawn(input = {}) {
  const field = cloneJson(object(input.field));
  const fieldId = String(input.field_id ?? field.field_id ?? "").trim();
  const existingField = input.existing_field == null ? null : cloneJson(input.existing_field);
  const timeMs = finiteNumber(input.time_ms);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "ability_field_spawn",
    context: {
      field,
      field_id: fieldId,
      existing_field: existingField,
      time_ms: timeMs,
    },
    evaluate: (context) => {
      const current = cloneJson(object(context.field));
      const checked = validateField(current);
      if (!context.field_id || !checked.ok || checked.fieldId !== context.field_id) {
        return { mutation_proposals: [], ok: false, reason: "ability field spawn requires matching field_id" };
      }
      if (context.existing_field !== null) {
        return { mutation_proposals: [], ok: false, reason: `ability field ${context.field_id} already exists` };
      }
      if (current.active !== true || !(checked.remainingMs > 0)) {
        return { mutation_proposals: [], ok: false, reason: "ability field spawn requires active field with positive remaining_ms" };
      }
      const proposal = fieldTransition(
        context.field_id,
        "ability_field",
        null,
        current,
        `immutable ability field ${context.field_id} spawned`,
        context.time_ms,
        { lifecycle_effect: "spawn" },
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        field_id: context.field_id,
        field_after: current,
      };
    },
  });
}

export function evaluateWorldSimulationAbilityFieldLifecycle(input = {}) {
  const field = cloneJson(object(input.field));
  const startMs = nonNegativeNumber(input.start_ms, 0);
  const elapsedMs = nonNegativeNumber(input.elapsed_ms, 0);
  const defaultTickMs = positiveNumber(input.default_tick_ms, 100);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "ability_field_lifecycle_advance",
    context: {
      field,
      start_ms: startMs,
      elapsed_ms: elapsedMs,
      default_tick_ms: defaultTickMs,
    },
    evaluate: (context) => {
      const current = cloneJson(object(context.field));
      const checked = validateField(current);
      if (!checked.ok) {
        return { mutation_proposals: [], ok: false, reason: "ability field lifecycle requires field_id" };
      }
      if (current.active !== true) {
        return {
          mutation_proposals: [],
          ok: true,
          field_id: checked.fieldId,
          active_ms: 0,
          field_end_ms: context.start_ms,
          tick_ms: positiveNumber(current.tick_ms ?? object(current.effect).tick_ms, context.default_tick_ms),
          tick_windows: [],
          field_after: current,
          already_inactive: true,
        };
      }
      const availableMs = Math.max(0, context.elapsed_ms - context.start_ms);
      const activeMs = Math.min(checked.remainingMs, availableMs);
      const tickMs = positiveNumber(current.tick_ms ?? object(current.effect).tick_ms, context.default_tick_ms);
      if (!(activeMs > 0)) {
        return {
          mutation_proposals: [],
          ok: true,
          field_id: checked.fieldId,
          active_ms: 0,
          field_end_ms: context.start_ms,
          tick_ms: tickMs,
          tick_windows: [],
          field_after: current,
        };
      }

      const fieldEndMs = context.start_ms + activeMs;
      const tickWindows = [];
      let tickStartMs = context.start_ms;
      let tickIndex = 0;
      while (tickStartMs < fieldEndMs - 1e-9) {
        tickIndex += 1;
        const tickEndMs = Math.min(fieldEndMs, tickStartMs + tickMs);
        tickWindows.push({
          tick_index: tickIndex,
          tick_start_ms: tickStartMs,
          tick_end_ms: tickEndMs,
        });
        tickStartMs = tickEndMs;
      }

      const after = cloneJson(current);
      after.remaining_ms = Math.max(0, checked.remainingMs - activeMs);
      if (after.remaining_ms <= 0) {
        after.active = false;
        after.termination_reason = "duration_expired";
      }
      after.last_advanced_ms = context.elapsed_ms;
      after.tick_ms = tickMs;
      const proposal = fieldTransition(
        checked.fieldId,
        "ability_field_state",
        current,
        after,
        `immutable ability field lifecycle advanced through ${activeMs}ms window`,
        fieldEndMs,
        {
          lifecycle_effect: "lifecycle_advance",
          active_ms: activeMs,
          tick_count: tickWindows.length,
          expired: after.active === false,
        },
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        field_id: checked.fieldId,
        active_ms: activeMs,
        field_end_ms: fieldEndMs,
        tick_ms: tickMs,
        tick_windows: tickWindows,
        remaining_ms_after: after.remaining_ms,
        active_after: after.active === true,
        termination_reason: after.termination_reason ?? null,
        field_after: after,
      };
    },
  });
}

export function projectWorldSimulationImmutableAbilityFieldLifecycleProposals(input = {}) {
  return projectWorldSimulationImmutableEvaluatorProposals(input);
}

export function buildWorldSimulationImmutableAbilityFieldLifecycleContract() {
  return {
    version: worldSimulationImmutableAbilityFieldLifecycleVersion,
    owner: "programmatic_immutable_ability_field_lifecycle",
    immutable_evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    migrated_lifecycle_evaluators: [
      "ability_field_spawn",
      "ability_field_lifecycle_advance",
    ],
    lifecycle_state_owned_by_proposals: [
      "field_spawn",
      "remaining_ms",
      "active",
      "termination_reason",
      "last_advanced_ms",
      "tick_ms",
    ],
    deterministic_tick_windows_from_immutable_input: true,
    duration_expiration_is_programmatic: true,
    damage_ticks_reuse_programmatic_combat_impact: true,
    deterministic_replay_checked: true,
    evaluator_outputs_may_contain_world_state: false,
    scheduler_uses_mechanical_projection_of_lifecycle_proposals: true,
    character_brain_may_decide_lifecycle_mutation_values: false,
    known_boundary: "Phase62Q makes ability-field spawn, remaining duration, tick-window progression, and expiration immutable deterministic proposal evaluation. Geometric exposure integration remains programmatic, while damage and injury continue through the immutable combat-impact path.",
  };
}
