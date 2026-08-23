import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationFixedPointConvergenceContract,
  evaluateWorldSimulationFixedPointIteration,
  worldSimulationFixedPointConvergenceVersion,
} from "../../server/src/world-simulation-fixed-point-convergence-service.mjs";
import {
  arbitrateWorldSimulationGlobalTimeline,
  buildWorldSimulationGlobalCausalTimelineContract,
} from "../../server/src/world-simulation-global-causal-timeline-service.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62v-fixed-point-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const contract = buildWorldSimulationFixedPointConvergenceContract();
  const timelineContract = buildWorldSimulationGlobalCausalTimelineContract();
  assert.equal(contract.version, worldSimulationFixedPointConvergenceVersion);
  assert.equal(contract.convergence_contract.convergence_requires_identical_context_hash, true);
  assert.equal(contract.convergence_contract.oscillation_is_fatal, true);
  assert.equal(contract.convergence_contract.iteration_limit_without_convergence_is_fatal, true);
  assert.equal(contract.convergence_contract.silent_acceptance_of_last_iteration_forbidden, true);
  assert.equal(timelineContract.fixed_point_convergence.version, worldSimulationFixedPointConvergenceVersion);

  const contextA = {
    suppressed_action_ids: [],
    action_time_overrides: {},
    actor_trajectories: {},
  };
  const contextB = {
    suppressed_action_ids: ["late-melee"],
    action_time_overrides: {},
    actor_trajectories: {},
  };
  const contextC = {
    suppressed_action_ids: ["late-melee"],
    action_time_overrides: { "late-melee": { contact_time_ms: 700 } },
    actor_trajectories: {},
  };
  const contextASnapshot = JSON.stringify(contextA);
  const contextBSnapshot = JSON.stringify(contextB);

  const first = evaluateWorldSimulationFixedPointIteration({
    iteration: 1,
    max_iterations: 4,
    current_derivation_context: contextA,
    next_derivation_context: contextB,
    seen_context_hashes: [],
  });
  const firstReplay = evaluateWorldSimulationFixedPointIteration({
    iteration: 1,
    max_iterations: 4,
    current_derivation_context: contextA,
    next_derivation_context: contextB,
    seen_context_hashes: [],
  });
  assert.deepEqual(firstReplay, first);
  assert.equal(first.converged, false);
  assert.equal(first.should_continue, true);
  assert.equal(first.oscillation_detected, false);
  assert.equal(first.iteration_limit_exhausted, false);

  const second = evaluateWorldSimulationFixedPointIteration({
    iteration: 2,
    max_iterations: 4,
    current_derivation_context: contextB,
    next_derivation_context: contextB,
    seen_context_hashes: first.next_seen_context_hashes,
  });
  assert.equal(second.converged, true);
  assert.equal(second.should_continue, false);
  assert.equal(second.current_context_hash, second.next_context_hash);
  assert.equal(JSON.stringify(contextA), contextASnapshot);
  assert.equal(JSON.stringify(contextB), contextBSnapshot);

  assert.throws(() => evaluateWorldSimulationFixedPointIteration({
    iteration: 2,
    max_iterations: 4,
    current_derivation_context: contextB,
    next_derivation_context: contextA,
    seen_context_hashes: first.next_seen_context_hashes,
  }), (error) => (
    error?.code === "WORLD_SIMULATION_CAUSAL_FIXED_POINT_OSCILLATION"
    && error?.diagnostics?.oscillation_detected === true
  ));

  assert.throws(() => evaluateWorldSimulationFixedPointIteration({
    iteration: 2,
    max_iterations: 2,
    current_derivation_context: contextB,
    next_derivation_context: contextC,
    seen_context_hashes: first.next_seen_context_hashes,
  }), (error) => (
    error?.code === "WORLD_SIMULATION_CAUSAL_FIXED_POINT_DID_NOT_CONVERGE"
    && error?.diagnostics?.iteration_limit_exhausted === true
  ));

  const shooter = "收斂射手";
  const lateAttacker = "收斂晚發近戰者";
  const target = "收斂目標";
  const sceneId = "fixed-point-convergence-lab";
  const fixedPointWorld = {
    simulation_time: "2026-08-25T04:00:00.000Z",
    world_rules: {
      collision_radius_m: 0.2,
      combat_target_radius_m: 0.2,
      physics_action_seconds: 0.5,
      severe_injury_ratio: 0.25,
      critical_injury_ratio: 0.4,
    },
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        dimensions: { width_m: 8, depth_m: 4 },
        entity_positions: {
          [shooter]: { x: 0.5, y: 1 },
          [lateAttacker]: { x: 3, y: 1 },
          [target]: { x: 4, y: 1 },
        },
        obstacles: [],
      },
    },
    characters: {
      [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
      [lateAttacker]: { physical_state: { health_current: 30, health_max: 100 } },
      [target]: { physical_state: { health_current: 100, health_max: 100 } },
    },
    objects: {
      launcher: {
        holder: shooter,
        state: "ready",
        enabled: true,
        ammo: { current: 1 },
        projectile: {
          speed_mps: 20,
          radius_m: 0.05,
          base_damage: 40,
          penetration_energy: 40,
          max_lifetime_ms: 2000,
        },
      },
      sword: {
        holder: lateAttacker,
        state: "ready",
        enabled: true,
        combat: { range_m: 1.5, base_damage: 60 },
      },
    },
    projectiles: {},
    ability_fields: {},
  };
  const fixedPoint = arbitrateWorldSimulationGlobalTimeline({
    world_state: fixedPointWorld,
    next_world_state: fixedPointWorld,
    scene_id: sceneId,
    selected_action_intents: [
      {
        character: shooter,
        candidate: {
          action_id: "fire-before-melee",
          duration_ms: 500,
          projectile: { weapon_id: "launcher", target_character: lateAttacker, fire_delay_ms: 0 },
        },
      },
      {
        character: lateAttacker,
        candidate: {
          action_id: "late-melee",
          duration_ms: 600,
          attack: { target_character: target, weapon_id: "sword", windup_ms: 250, active_ms: 100, recovery_ms: 250 },
        },
      },
    ],
    resolved_action_outcomes: [],
    elapsed_ms: 600,
  });
  const convergence = fixedPoint.fixed_point_convergence;
  assert.equal(convergence.version, worldSimulationFixedPointConvergenceVersion);
  assert.equal(convergence.converged, true);
  assert.ok(convergence.convergence_iteration >= 2);
  assert.equal(convergence.iteration_count, fixedPoint.iterations);
  assert.equal(convergence.records.length, fixedPoint.iterations);
  assert.equal(convergence.records.at(-1).converged, true);
  assert.equal(convergence.records.at(-1).should_continue, false);
  assert.ok(convergence.records.slice(0, -1).every((record) => record.should_continue === true));
  assert.equal(convergence.oscillation_rejection_enabled, true);
  assert.equal(convergence.iteration_limit_rejection_enabled, true);
  assert.equal(convergence.silent_last_iteration_acceptance, false);
  assert.equal(fixedPoint.causal_epochs.epochs.at(-1).fixed_point_converged_after_iteration, true);

  const owner = "收斂持久化觀察者";
  const persistedState = {
    simulation_time: "2026-08-25T04:30:00.000Z",
    world_rules: { passive_action_seconds: 0.1 },
    event_queue: [{ event_id: "evt-convergence-persist", scene_id: "persist-lab", participants: [owner] }],
    scenes: {
      "persist-lab": {
        scene_id: "persist-lab",
        dimensions: { width_m: 4, depth_m: 4 },
        entity_positions: { [owner]: { x: 1, y: 1 } },
        obstacles: [],
        observable_by: { [owner]: { visual: ["固定點收斂持久化測試區"] } },
      },
    },
    characters: { [owner]: { physical_state: { health_current: 100, health_max: 100 } } },
    memories: { [owner]: [] },
    objects: {},
    projectiles: {},
    ability_fields: {},
    available_actions: { [owner]: [{ action_id: "wait-owner", intent: "等待", duration_ms: 100 }] },
  };
  const session = await beginWorldSimulationSession({
    source_text: "Phase62V fixed-point convergence persistence fixture",
    characters: [owner],
    initial_world_state: persistedState,
  }, options);
  const turn = await runWorldSimulationTurn(
    { world_simulation_session_id: session.world_simulation_session_id },
    { ...options, characterBrain: async () => ({ action_id: "wait-owner" }) },
  );
  assert.equal(turn.ok, true);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const persisted = history.turns[0].fixed_point_convergence;
  assert.ok(persisted);
  assert.equal(persisted.version, worldSimulationFixedPointConvergenceVersion);
  assert.equal(persisted.converged, true);
  assert.equal(persisted.records.at(-1).converged, true);
  assert.equal(persisted.silent_last_iteration_acceptance, false);

  console.log(JSON.stringify({
    fixed_point_convergence_version: worldSimulationFixedPointConvergenceVersion,
    persisted_history_turns: history.turns.length,
    direct_converged_on_iteration: second.iteration,
    oscillation_rejected: true,
    iteration_limit_without_convergence_rejected: true,
    fixed_point_iteration_count: convergence.iteration_count,
    final_context_hash_stable: convergence.final_context_hash === convergence.records.at(-1).next_context_hash,
    silent_last_iteration_acceptance: convergence.silent_last_iteration_acceptance,
    deterministic_replay_verified: first.diagnostic_hash === firstReplay.diagnostic_hash,
    character_brain_decides_fixed_point_convergence: false,
  }));
  console.log("Phase62V fixed-point convergence test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
