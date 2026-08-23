import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCausalRuleContract } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  evaluateWorldSimulationProjectileAdvance,
  evaluateWorldSimulationProjectilePenetrationContinuation,
  evaluateWorldSimulationProjectileTermination,
  projectWorldSimulationImmutableProjectileLifecycleProposals,
  worldSimulationImmutableProjectileLifecycleVersion,
} from "../../server/src/world-simulation-immutable-projectile-lifecycle-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62p-projectile-lifecycle-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "彈道觀測員";
const sceneId = "projectile-lifecycle-lab";

function projectile(id, position, velocity, extra = {}) {
  return {
    projectile_id: id,
    owner: observer,
    source_action_id: null,
    weapon_id: "fixture-launcher",
    scene_id: sceneId,
    position,
    velocity_mps: velocity,
    radius_m: 0.05,
    base_damage: 0,
    damage_type: "fixture",
    initial_penetration_energy: 5,
    remaining_penetration_energy: 5,
    max_lifetime_ms: 5000,
    age_ms: 0,
    active: true,
    target_character: null,
    penetrated_obstacles: [],
    ...extra,
  };
}

const initialWorldState = {
  simulation_time: "2026-08-24T22:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    passive_action_seconds: 0.5,
    physics_action_seconds: 0.5,
  },
  event_queue: [{ event_id: "evt-projectile-lifecycle", scene_id: sceneId, participants: [observer] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 5 },
      entity_positions: { [observer]: { x: 0.5, y: 0.5 } },
      obstacles: [{
        id: "thin-cover",
        x_min: 2.5,
        x_max: 2.7,
        y_min: 3.5,
        y_max: 4.5,
        penetration_resistance: 2,
        integrity_current: 100,
        destroyed: false,
        passable: false,
        collision_enabled: true,
      }],
      observable_by: { [observer]: { visual: ["彈道測試區"] } },
    },
  },
  characters: { [observer]: { physical_state: { health_current: 100, health_max: 100 } } },
  memories: { [observer]: [] },
  objects: {},
  projectiles: {
    p_advance: projectile("p_advance", { x: 1, y: 1 }, { x: 2, y: 0 }, { age_ms: 100 }),
    p_lifetime: projectile("p_lifetime", { x: 1, y: 2 }, { x: 1, y: 0 }, { age_ms: 490, max_lifetime_ms: 500 }),
    p_bounds: projectile("p_bounds", { x: 7.9, y: 3 }, { x: 2, y: 0 }),
    p_cover: projectile("p_cover", { x: 1, y: 4 }, { x: 10, y: 0 }),
  },
  ability_fields: {},
  available_actions: {
    [observer]: [{ action_id: "observe", intent: "觀察彈道", duration_ms: 500 }],
  },
};

async function characterBrain() {
  return { action_id: "observe" };
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.immutable_projectile_lifecycle.version, worldSimulationImmutableProjectileLifecycleVersion);
  assert.deepEqual(contract.immutable_projectile_lifecycle.migrated_lifecycle_evaluators, [
    "projectile_flight_advance",
    "projectile_penetration_continuation",
    "projectile_termination",
  ]);

  const direct = projectile("direct", { x: 1, y: 1 }, { x: 10, y: 0 });
  const directBefore = JSON.stringify(direct);
  const advance = evaluateWorldSimulationProjectileAdvance({ projectile: direct, delta_ms: 100, time_ms: 100 });
  assert.equal(advance.result.ok, true);
  assert.equal(advance.result.position_after.x, 2);
  assert.equal(advance.result.age_ms_after, 100);
  assert.equal(advance.audit.input_context_immutable, true);
  assert.equal(advance.audit.deterministic_replay_verified, true);
  assert.equal(advance.audit.evaluator_output_contains_world_state, false);
  assert.equal(JSON.stringify(direct), directBefore);

  const directWorld = {
    scenes: { [sceneId]: initialWorldState.scenes[sceneId] },
    projectiles: { direct },
  };
  const advanceProjection = projectWorldSimulationImmutableProjectileLifecycleProposals({
    world_state: directWorld,
    mutation_proposals: advance.mutation_proposals,
    scene_id: sceneId,
    elapsed_ms: 100,
  });
  assert.equal(advanceProjection.projected_world_state.projectiles.direct.position.x, 2);
  assert.equal(direct.position.x, 1);

  const penetrationInput = advance.result.projectile_after;
  const penetrationBefore = JSON.stringify(penetrationInput);
  const penetration = evaluateWorldSimulationProjectilePenetrationContinuation({
    projectile: penetrationInput,
    obstacle_id: "thin-cover",
    resistance: 2,
    time_ms: 100,
    epsilon_ms: 0.01,
  });
  assert.equal(penetration.result.ok, true);
  assert.equal(penetration.result.remaining_penetration_energy, 3);
  assert.deepEqual(penetration.result.penetrated_obstacles, ["thin-cover"]);
  assert.equal(JSON.stringify(penetrationInput), penetrationBefore);

  const terminationInput = penetration.result.projectile_after;
  const terminationBefore = JSON.stringify(terminationInput);
  const termination = evaluateWorldSimulationProjectileTermination({
    projectile: terminationInput,
    reason: "character_contact",
    zero_penetration_energy: true,
    time_ms: 120,
  });
  assert.equal(termination.result.ok, true);
  assert.equal(termination.result.projectile_after.active, false);
  assert.equal(termination.result.projectile_after.termination_reason, "character_contact");
  assert.equal(termination.result.remaining_penetration_energy, 0);
  assert.equal(JSON.stringify(terminationInput), terminationBefore);

  for (const evaluation of [advance, penetration, termination]) {
    assert.equal(evaluation.audit.input_context_immutable, true);
    assert.equal(evaluation.audit.deterministic_replay_verified, true);
    assert.equal(evaluation.audit.evaluator_output_contains_world_state, false);
  }

  const session = await beginWorldSimulationSession({
    source_text: "Phase62P immutable projectile lifecycle fixture",
    characters: [observer],
    initial_world_state: initialWorldState,
  }, options);
  const turn = await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  assert.equal(turn.ok, true);
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const lifecycle = history.turns[0].immutable_projectile_lifecycle;

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(Math.abs(state.state.projectiles.p_advance.position.x - 2) < 1e-9);
  assert.equal(state.state.projectiles.p_advance.age_ms, 600);
  assert.equal(state.state.projectiles.p_advance.active, true);
  assert.ok(Math.abs(state.state.projectiles.p_lifetime.position.x - 1.01) < 1e-9);
  assert.equal(state.state.projectiles.p_lifetime.age_ms, 500);
  assert.equal(state.state.projectiles.p_lifetime.active, false);
  assert.equal(state.state.projectiles.p_lifetime.termination_reason, "lifetime_expired");
  assert.ok(Math.abs(state.state.projectiles.p_bounds.position.x - 8) < 1e-9);
  assert.equal(state.state.projectiles.p_bounds.active, false);
  assert.equal(state.state.projectiles.p_bounds.termination_reason, "left_scene_bounds");
  assert.ok(Math.abs(state.state.projectiles.p_cover.position.x - 6) < 1e-6);
  assert.equal(state.state.projectiles.p_cover.remaining_penetration_energy, 3);
  assert.deepEqual(state.state.projectiles.p_cover.penetrated_obstacles, ["thin-cover"]);
  assert.equal(state.state.projectiles.p_cover.active, true);

  assert.ok(lifecycle);
  assert.equal(lifecycle.version, worldSimulationImmutableProjectileLifecycleVersion);
  assert.ok(lifecycle.audit_count >= 8);
  assert.equal(lifecycle.evaluator_inputs_immutable, true);
  assert.equal(lifecycle.evaluator_outputs_contain_world_state, false);
  assert.equal(lifecycle.deterministic_replay_verified, true);
  const evaluatorNames = new Set(lifecycle.audits.map((audit) => audit.evaluator));
  assert.equal(evaluatorNames.has("projectile_flight_advance"), true);
  assert.equal(evaluatorNames.has("projectile_penetration_continuation"), true);
  assert.equal(evaluatorNames.has("projectile_termination"), true);

  console.log(JSON.stringify({
    immutable_projectile_lifecycle_version: worldSimulationImmutableProjectileLifecycleVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_projectile_lifecycle_audit_count: lifecycle.audit_count,
    persistent_projectile_x: state.state.projectiles.p_advance.position.x,
    lifetime_terminated: state.state.projectiles.p_lifetime.termination_reason === "lifetime_expired",
    bounds_terminated: state.state.projectiles.p_bounds.termination_reason === "left_scene_bounds",
    penetrated_projectile_energy_remaining: state.state.projectiles.p_cover.remaining_penetration_energy,
    deterministic_replay_verified: lifecycle.deterministic_replay_verified,
    evaluator_outputs_contain_world_state: lifecycle.evaluator_outputs_contain_world_state,
    character_brain_decides_projectile_lifecycle_mutation_values: false,
  }));
  console.log("Phase62P immutable projectile lifecycle test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
