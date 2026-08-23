import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCausalRuleContract } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationImmutableEventQueryContract,
  queryWorldSimulationAbilityFieldExposure,
  queryWorldSimulationProjectileNextEvent,
  runWorldSimulationImmutableCausalQuery,
  worldSimulationImmutableEventQueryVersion,
} from "../../server/src/world-simulation-immutable-event-query-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62r-event-query-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const owner = "事件查詢源";
const target = "事件查詢目標";
const sceneId = "immutable-event-query-lab";

const initialWorldState = {
  simulation_time: "2026-08-25T00:00:00.000Z",
  world_rules: {
    combat_target_radius_m: 0.2,
    collision_radius_m: 0.2,
    passive_action_seconds: 0.5,
    physics_action_seconds: 0.5,
    ability_field_tick_ms: 100,
  },
  event_queue: [{ event_id: "evt-event-query", scene_id: sceneId, participants: [owner, target] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 6, depth_m: 6 },
      entity_positions: {
        [owner]: { x: 5, y: 5 },
        [target]: { x: 2.5, y: 2 },
      },
      obstacles: [],
      observable_by: {
        [owner]: { visual: ["事件查詢測試區"] },
        [target]: { visual: ["事件查詢測試區"] },
      },
    },
  },
  characters: {
    [owner]: { physical_state: { health_current: 100, health_max: 100 } },
    [target]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: { [owner]: [], [target]: [] },
  objects: {},
  projectiles: {
    p_query: {
      projectile_id: "p_query",
      owner,
      source_action_id: "fixture-projectile",
      scene_id: sceneId,
      position: { x: 1, y: 5 },
      velocity_mps: { x: 2, y: 0 },
      radius_m: 0.05,
      age_ms: 100,
      max_lifetime_ms: 5000,
      active: true,
      base_damage: 5,
      damage_type: "fixture_projectile",
      initial_penetration_energy: 1,
      remaining_penetration_energy: 1,
      penetrated_obstacles: [],
    },
  },
  ability_fields: {
    field_query: {
      field_id: "field_query",
      owner,
      ability_id: "fixture_field",
      source_action_id: "fixture-field",
      scene_id: sceneId,
      center: { x: 2.5, y: 2 },
      radius_m: 1,
      remaining_ms: 300,
      active: true,
      affects_owner: false,
      effect: {
        damage_per_second: 10,
        damage_type: "fixture_field",
        penetration: 0,
        ignore_armor: true,
      },
    },
  },
  available_actions: {
    [owner]: [{ action_id: "wait-owner", intent: "等待", duration_ms: 500 }],
    [target]: [{ action_id: "wait-target", intent: "等待", duration_ms: 500 }],
  },
};

try {
  const contract = buildWorldSimulationImmutableEventQueryContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.version, worldSimulationImmutableEventQueryVersion);
  assert.equal(causalContract.immutable_event_queries.version, worldSimulationImmutableEventQueryVersion);
  assert.deepEqual(contract.migrated_event_queries, [
    "projectile_collision_discovery",
    "ability_field_geometric_exposure",
  ]);
  assert.equal(contract.query_contract.receives_frozen_cloned_context, true);
  assert.equal(contract.query_contract.may_return_world_state, false);
  assert.equal(contract.query_contract.may_return_mutation_proposals, false);

  const projectileInput = {
    projectile: {
      projectile_id: "direct_projectile",
      owner,
      position: { x: 0, y: 1 },
      velocity_mps: { x: 10, y: 0 },
      radius_m: 0.05,
      age_ms: 0,
      max_lifetime_ms: 5000,
      penetrated_obstacles: [],
    },
    scene: {
      dimensions: { width_m: 10, depth_m: 4 },
      obstacles: [{ id: "direct_cover", x_min: 2, x_max: 2.2, y_min: 0.8, y_max: 1.2 }],
    },
    character_motion_profiles: [{
      character: target,
      target_radius_m: 0.2,
      profile: { start: { x: 3, y: 1 }, end: { x: 3, y: 1 }, durationMs: 0, breakpoints: [] },
    }],
    current_time_ms: 0,
    active_end_ms: 500,
  };
  const projectileBefore = JSON.stringify(projectileInput);
  const projectileQuery = queryWorldSimulationProjectileNextEvent(projectileInput);
  assert.equal(projectileQuery.result.ok, true);
  assert.equal(projectileQuery.result.event.kind, "obstacle");
  assert.equal(projectileQuery.result.event.obstacleId, "direct_cover");
  assert.ok(Math.abs(projectileQuery.result.event.timeMs - 195) < 1e-6);
  assert.equal(JSON.stringify(projectileInput), projectileBefore);
  assert.equal(projectileQuery.audit.input_context_immutable, true);
  assert.equal(projectileQuery.audit.deterministic_replay_verified, true);
  assert.equal(projectileQuery.audit.query_output_contains_world_state, false);
  assert.equal(projectileQuery.audit.query_output_contains_mutation_proposals, false);

  const exposureInput = {
    profile: {
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
      durationMs: 400,
      breakpoints: [],
    },
    center: { x: 2, y: 0 },
    radius_m: 1,
    start_ms: 0,
    end_ms: 400,
    character: target,
    field_id: "direct_field",
  };
  const exposureBefore = JSON.stringify(exposureInput);
  const exposureQuery = queryWorldSimulationAbilityFieldExposure(exposureInput);
  assert.equal(exposureQuery.result.ok, true);
  assert.ok(Math.abs(exposureQuery.result.inside_ms - 200) < 1e-6);
  assert.equal(JSON.stringify(exposureInput), exposureBefore);
  assert.equal(exposureQuery.audit.input_context_immutable, true);
  assert.equal(exposureQuery.audit.deterministic_replay_verified, true);

  assert.throws(() => runWorldSimulationImmutableCausalQuery({
    query_name: "forbidden-mutation-query",
    context: { value: 1 },
    query: () => ({ mutation_proposals: [{ illicit: true }] }),
  }), (error) => error?.code === "WORLD_SIMULATION_IMMUTABLE_CAUSAL_QUERY_OUTPUT_FORBIDDEN");

  let toggle = false;
  assert.throws(() => runWorldSimulationImmutableCausalQuery({
    query_name: "nondeterministic-query",
    context: { value: 1 },
    query: () => {
      toggle = !toggle;
      return { value: toggle };
    },
  }), (error) => error?.code === "WORLD_SIMULATION_CAUSAL_QUERY_NONDETERMINISTIC");

  const session = await beginWorldSimulationSession({
    source_text: "Phase62R immutable event query fixture",
    characters: [owner, target],
    initial_world_state: initialWorldState,
  }, options);
  const characterBrain = async (packet) => ({ action_id: packet.character === owner ? "wait-owner" : "wait-target" });
  const turn = await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  assert.equal(turn.ok, true);

  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const queries = history.turns[0].immutable_event_queries;
  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(queries);
  assert.equal(queries.version, worldSimulationImmutableEventQueryVersion);
  assert.ok(queries.audit_count >= 4);
  assert.equal(queries.query_inputs_immutable, true);
  assert.equal(queries.query_outputs_contain_world_state, false);
  assert.equal(queries.query_outputs_contain_mutation_proposals, false);
  assert.equal(queries.deterministic_replay_verified, true);
  const queryNames = new Set(queries.audits.map((audit) => audit.query));
  assert.equal(queryNames.has("projectile_collision_discovery"), true);
  assert.equal(queryNames.has("ability_field_geometric_exposure"), true);
  assert.equal(state.state.projectiles.p_query.position.x, 2);
  assert.equal(state.state.ability_fields.field_query.active, false);
  assert.equal(state.state.ability_fields.field_query.termination_reason, "duration_expired");
  assert.equal(state.state.characters[target].physical_state.health_current, 97);

  console.log(JSON.stringify({
    immutable_event_query_version: worldSimulationImmutableEventQueryVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_event_query_audit_count: queries.audit_count,
    projectile_query_event: projectileQuery.result.event.kind,
    direct_field_exposure_ms: exposureQuery.result.inside_ms,
    persistent_projectile_x: state.state.projectiles.p_query.position.x,
    target_health_after_field: state.state.characters[target].physical_state.health_current,
    deterministic_replay_verified: queries.deterministic_replay_verified,
    query_outputs_contain_world_state: queries.query_outputs_contain_world_state,
    query_outputs_contain_mutation_proposals: queries.query_outputs_contain_mutation_proposals,
    character_brain_decides_event_discovery: false,
  }));
  console.log("Phase62R immutable event discovery query test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
