import {
  projectWorldSimulationImmutableEvaluatorProposals,
  runWorldSimulationImmutableCausalEvaluator,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "./world-simulation-immutable-causal-evaluator-service.mjs";

export const worldSimulationImmutableProjectileLifecycleVersion = "phase62p-immutable-projectile-lifecycle-v1";

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

function projectileTransition(projectileId, before, after, cause, timeMs = null, extra = {}) {
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  const resolvedTime = finiteNumber(timeMs);
  return {
    entity: projectileId,
    field: "projectile_state",
    from: cloneJson(before),
    to: cloneJson(after),
    cause,
    adjudication: "programmatic_continuous_physics",
    ...(resolvedTime === null ? {} : { time_ms: Math.max(0, resolvedTime) }),
    ...cloneJson(extra),
  };
}

function validateProjectile(projectile) {
  const projectileId = String(projectile?.projectile_id ?? "").trim();
  const position = point(projectile?.position);
  const velocity = vector(projectile?.velocity_mps);
  return {
    projectileId,
    position,
    velocity,
    ok: Boolean(projectileId && position && velocity),
  };
}

export function evaluateWorldSimulationProjectileAdvance(input = {}) {
  const projectile = cloneJson(object(input.projectile));
  const validated = validateProjectile(projectile);
  const deltaMs = nonNegativeNumber(input.delta_ms, 0);
  const timeMs = finiteNumber(input.time_ms);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_flight_advance",
    context: {
      projectile,
      projectile_id: validated.projectileId,
      delta_ms: deltaMs,
      time_ms: timeMs,
    },
    evaluate: (context) => {
      const current = cloneJson(object(context.projectile));
      const checked = validateProjectile(current);
      if (!checked.ok) {
        return { mutation_proposals: [], ok: false, reason: "projectile advance requires id, position, and velocity" };
      }
      const seconds = context.delta_ms / 1000;
      const after = cloneJson(current);
      after.position = {
        x: checked.position.x + checked.velocity.x * seconds,
        y: checked.position.y + checked.velocity.y * seconds,
      };
      after.age_ms = nonNegativeNumber(current.age_ms, 0) + context.delta_ms;
      const proposal = projectileTransition(
        checked.projectileId,
        current,
        after,
        `immutable projectile flight advanced ${context.delta_ms}ms`,
        context.time_ms,
        { lifecycle_effect: "flight_advance" },
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        projectile_id: checked.projectileId,
        delta_ms: context.delta_ms,
        position_after: cloneJson(after.position),
        age_ms_after: after.age_ms,
        projectile_after: after,
      };
    },
  });
}

export function evaluateWorldSimulationProjectilePenetrationContinuation(input = {}) {
  const projectile = cloneJson(object(input.projectile));
  const resistance = nonNegativeNumber(input.resistance, 0);
  const obstacleId = String(input.obstacle_id ?? "").trim();
  const epsilonMs = nonNegativeNumber(input.epsilon_ms, 0.01);
  const impactTimeMs = nonNegativeNumber(input.time_ms, 0);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_penetration_continuation",
    context: {
      projectile,
      resistance,
      obstacle_id: obstacleId,
      epsilon_ms: epsilonMs,
      impact_time_ms: impactTimeMs,
    },
    evaluate: (context) => {
      const current = cloneJson(object(context.projectile));
      const checked = validateProjectile(current);
      if (!checked.ok || !context.obstacle_id) {
        return { mutation_proposals: [], ok: false, reason: "projectile penetration continuation requires projectile kinematics and obstacle_id" };
      }
      const beforeEnergy = nonNegativeNumber(current.remaining_penetration_energy, 0);
      if (!(beforeEnergy > context.resistance)) {
        return {
          mutation_proposals: [],
          ok: false,
          reason: "projectile penetration continuation requires energy strictly above resistance",
          remaining_penetration_energy: beforeEnergy,
        };
      }
      const after = cloneJson(current);
      after.remaining_penetration_energy = Math.max(0, beforeEnergy - context.resistance);
      after.penetrated_obstacles = [...new Set([...array(current.penetrated_obstacles).map(String), context.obstacle_id])];
      const seconds = context.epsilon_ms / 1000;
      after.position = {
        x: checked.position.x + checked.velocity.x * seconds,
        y: checked.position.y + checked.velocity.y * seconds,
      };
      after.age_ms = nonNegativeNumber(current.age_ms, 0) + context.epsilon_ms;
      const proposalTimeMs = context.impact_time_ms + context.epsilon_ms;
      const proposal = projectileTransition(
        checked.projectileId,
        current,
        after,
        `immutable projectile penetration continuation cleared obstacle ${context.obstacle_id}`,
        proposalTimeMs,
        { lifecycle_effect: "penetration_continuation", obstacle_id: context.obstacle_id },
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        projectile_id: checked.projectileId,
        remaining_penetration_energy: after.remaining_penetration_energy,
        penetrated_obstacles: cloneJson(after.penetrated_obstacles),
        epsilon_ms: context.epsilon_ms,
        time_ms_after: proposalTimeMs,
        projectile_after: after,
      };
    },
  });
}

export function evaluateWorldSimulationProjectileTermination(input = {}) {
  const projectile = cloneJson(object(input.projectile));
  const reason = String(input.reason ?? "terminated").trim() || "terminated";
  const zeroEnergy = input.zero_penetration_energy === true;
  const timeMs = finiteNumber(input.time_ms);
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "projectile_termination",
    context: {
      projectile,
      reason,
      zero_penetration_energy: zeroEnergy,
      time_ms: timeMs,
    },
    evaluate: (context) => {
      const current = cloneJson(object(context.projectile));
      const projectileId = String(current.projectile_id ?? "").trim();
      if (!projectileId) {
        return { mutation_proposals: [], ok: false, reason: "projectile termination requires projectile_id" };
      }
      const after = cloneJson(current);
      after.active = false;
      after.termination_reason = context.reason;
      if (context.zero_penetration_energy) after.remaining_penetration_energy = 0;
      const proposal = projectileTransition(
        projectileId,
        current,
        after,
        `immutable projectile lifecycle terminated: ${context.reason}`,
        context.time_ms,
        { lifecycle_effect: "termination", termination_reason: context.reason },
      );
      return {
        mutation_proposals: proposal ? [proposal] : [],
        ok: true,
        projectile_id: projectileId,
        termination_reason: context.reason,
        remaining_penetration_energy: nonNegativeNumber(after.remaining_penetration_energy, 0),
        projectile_after: after,
      };
    },
  });
}

export function projectWorldSimulationImmutableProjectileLifecycleProposals(input = {}) {
  return projectWorldSimulationImmutableEvaluatorProposals(input);
}

export function buildWorldSimulationImmutableProjectileLifecycleContract() {
  return {
    version: worldSimulationImmutableProjectileLifecycleVersion,
    owner: "programmatic_immutable_projectile_lifecycle",
    immutable_evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    migrated_lifecycle_evaluators: [
      "projectile_flight_advance",
      "projectile_penetration_continuation",
      "projectile_termination",
    ],
    lifecycle_state_owned_by_proposals: [
      "position",
      "age_ms",
      "remaining_penetration_energy",
      "penetrated_obstacles",
      "active",
      "termination_reason",
    ],
    termination_reasons_routed_through_immutable_evaluator: [
      "lifetime_expired",
      "left_scene_bounds",
      "stopped_by_cover",
      "character_contact",
      "global_physics_iteration_guard",
    ],
    deterministic_replay_checked: true,
    evaluator_outputs_may_contain_world_state: false,
    scheduler_uses_mechanical_projection_of_lifecycle_proposals: true,
    character_brain_may_decide_lifecycle_mutation_values: false,
    known_boundary: "Phase62P makes projectile flight advance, penetration continuation, and termination immutable deterministic proposal evaluators. Collision-time discovery is still performed by the programmatic global projectile scheduler, and ability-field lifecycle advancement remains on the isolated mutable-preview path.",
  };
}
