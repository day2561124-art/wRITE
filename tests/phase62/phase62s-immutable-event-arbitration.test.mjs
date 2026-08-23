import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCausalRuleContract } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  arbitrateWorldSimulationEventCandidates,
  buildWorldSimulationImmutableEventArbitrationContract,
  worldSimulationImmutableEventArbitrationVersion,
} from "../../server/src/world-simulation-immutable-event-arbitration-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62s-event-arbitration-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const owner = "事件仲裁源";
const sceneId = "immutable-event-arbitration-lab";

const initialWorldState = {
  simulation_time: "2026-08-25T00:00:00.000Z",
  world_rules: {
    combat_target_radius_m: 0.2,
    collision_radius_m: 0.2,
    passive_action_seconds: 1,
    physics_action_seconds: 1,
  },
  event_queue: [{ event_id: "evt-event-arbitration", scene_id: sceneId, participants: [owner] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 4 },
      entity_positions: { [owner]: { x: 7, y: 3 } },
      obstacles: [{
        id: "fragile-topology-cover",
        x_min: 2.5,
        x_max: 2.7,
        y_min: 0.8,
        y_max: 1.2,
        penetration_resistance: 2,
        integrity_current: 2,
        destroyed: false,
        passable: false,
        collision_enabled: true,
      }],
      observable_by: { [owner]: { visual: ["事件仲裁測試區"] } },
    },
  },
  characters: {
    [owner]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: { [owner]: [] },
  objects: {},
  projectiles: {
    p_breaker: {
      projectile_id: "p_breaker",
      owner,
      source_action_id: "fixture-breaker",
      scene_id: sceneId,
      position: { x: 1, y: 1 },
      velocity_mps: { x: 10, y: 0 },
      radius_m: 0.05,
      age_ms: 0,
      max_lifetime_ms: 5000,
      active: true,
      base_damage: 1,
      damage_type: "fixture",
      initial_penetration_energy: 10,
      remaining_penetration_energy: 10,
      penetrated_obstacles: [],
    },
    p_later: {
      projectile_id: "p_later",
      owner,
      source_action_id: "fixture-later",
      scene_id: sceneId,
      position: { x: 1, y: 1 },
      velocity_mps: { x: 3, y: 0 },
      radius_m: 0.05,
      age_ms: 0,
      max_lifetime_ms: 5000,
      active: true,
      base_damage: 1,
      damage_type: "fixture",
      initial_penetration_energy: 1,
      remaining_penetration_energy: 1,
      penetrated_obstacles: [],
    },
  },
  ability_fields: {},
  available_actions: {
    [owner]: [{ action_id: "wait-owner", intent: "等待", duration_ms: 1000 }],
  },
};

try {
  const contract = buildWorldSimulationImmutableEventArbitrationContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.version, worldSimulationImmutableEventArbitrationVersion);
  assert.equal(causalContract.immutable_event_arbitration.version, worldSimulationImmutableEventArbitrationVersion);
  assert.equal(contract.selection_contract.earliest_time_batch_only, true);
  assert.equal(contract.selection_contract.exact_timestamp_ties_are_simultaneous, true);
  assert.equal(contract.selection_contract.stable_member_order_is_replay_only_not_causal_precedence, true);
  assert.equal(contract.selection_contract.all_unresolved_candidates_are_requeried_after_batch_application, true);
  assert.equal(contract.may_return_world_state, false);
  assert.equal(contract.may_return_mutation_proposals, false);

  const directCandidates = [
    { candidate_id: "late", source: "fixture", subject_id: "late", time_ms: 120, event: { kind: "character", timeMs: 120 } },
    { candidate_id: "tie-b", source: "fixture", subject_id: "b", time_ms: 100, event: { kind: "obstacle", timeMs: 100 } },
    { candidate_id: "tie-a", source: "fixture", subject_id: "a", time_ms: 100, event: { kind: "bounds", timeMs: 100 } },
  ];
  const directBefore = JSON.stringify(directCandidates);
  const first = arbitrateWorldSimulationEventCandidates({ candidates: directCandidates });
  const permuted = arbitrateWorldSimulationEventCandidates({ candidates: [...directCandidates].reverse() });
  assert.equal(JSON.stringify(directCandidates), directBefore);
  assert.equal(first.result.earliest_time_ms, 100);
  assert.equal(first.result.selected_count, 2);
  assert.deepEqual(first.result.selected_batch.map((candidate) => candidate.subject_id), ["a", "b"]);
  assert.equal(first.audit.input_candidate_set_hash, permuted.audit.input_candidate_set_hash);
  assert.equal(first.audit.output_batch_hash, permuted.audit.output_batch_hash);
  assert.equal(first.audit.input_candidates_immutable, true);
  assert.equal(first.audit.deterministic_replay_verified, true);
  assert.equal(first.audit.output_contains_world_state, false);
  assert.equal(first.audit.output_contains_mutation_proposals, false);
  assert.equal(first.audit.candidate_order_invariant, true);
  assert.equal(first.audit.exact_timestamp_batch_preserved, true);
  assert.equal(first.audit.selected_batch_internal_order_is_replay_only, true);
  assert.equal(first.audit.requery_required_after_batch_application, true);

  assert.throws(() => arbitrateWorldSimulationEventCandidates({
    candidates: [{ candidate_id: "illegal", time_ms: 1, mutation_proposals: [{ illicit: true }], event: { kind: "illegal", timeMs: 1 } }],
  }), (error) => error?.code === "WORLD_SIMULATION_IMMUTABLE_EVENT_ARBITRATION_INPUT_FORBIDDEN");

  const session = await beginWorldSimulationSession({
    source_text: "Phase62S immutable event arbitration fixture",
    characters: [owner],
    initial_world_state: initialWorldState,
  }, options);
  const characterBrain = async () => ({ action_id: "wait-owner" });
  const turn = await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  assert.equal(turn.ok, true);

  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const arbitration = history.turns[0].immutable_event_arbitration;
  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(arbitration);
  assert.equal(arbitration.version, worldSimulationImmutableEventArbitrationVersion);
  assert.ok(arbitration.audit_count >= 2);
  assert.equal(arbitration.candidate_inputs_immutable, true);
  assert.equal(arbitration.arbitration_outputs_contain_world_state, false);
  assert.equal(arbitration.arbitration_outputs_contain_mutation_proposals, false);
  assert.equal(arbitration.candidate_order_invariant, true);
  assert.equal(arbitration.exact_timestamp_batches_preserved, true);
  assert.equal(arbitration.unresolved_candidates_requeried_after_batch_application, true);
  assert.equal(arbitration.deterministic_replay_verified, true);

  const obstacle = state.state.scenes[sceneId].obstacles.find((item) => item.id === "fragile-topology-cover");
  assert.equal(obstacle.destroyed, true);
  assert.equal(obstacle.collision_enabled, false);
  assert.equal(obstacle.passable, true);
  assert.ok(Math.abs(state.state.projectiles.p_later.position.x - 4) < 1e-6);
  assert.equal(state.state.projectiles.p_later.active, true);
  assert.deepEqual(state.state.projectiles.p_later.penetrated_obstacles, []);

  console.log(JSON.stringify({
    immutable_event_arbitration_version: worldSimulationImmutableEventArbitrationVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_event_arbitration_audit_count: arbitration.audit_count,
    direct_selected_count: first.result.selected_count,
    direct_earliest_time_ms: first.result.earliest_time_ms,
    candidate_order_invariant: arbitration.candidate_order_invariant,
    exact_timestamp_batches_preserved: arbitration.exact_timestamp_batches_preserved,
    cover_destroyed_before_later_projectile: obstacle.destroyed,
    later_projectile_x_after_requery: state.state.projectiles.p_later.position.x,
    deterministic_replay_verified: arbitration.deterministic_replay_verified,
    arbitration_outputs_contain_world_state: arbitration.arbitration_outputs_contain_world_state,
    arbitration_outputs_contain_mutation_proposals: arbitration.arbitration_outputs_contain_mutation_proposals,
    character_brain_decides_event_precedence: false,
  }));
  console.log("Phase62S immutable event arbitration test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
