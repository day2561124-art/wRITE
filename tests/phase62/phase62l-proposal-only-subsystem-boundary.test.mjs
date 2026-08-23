import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationMutationProposalBoundaryContract,
  projectWorldSimulationMutationProposals,
  worldSimulationMutationProposalBoundaryVersion,
} from "../../server/src/world-simulation-mutation-proposal-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62l-proposal-boundary-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const sceneId = "proposal-boundary-lab";
const shooter = "提案射手";
const mover = "提案移動者";

const initialWorldState = {
  simulation_time: "2026-08-24T17:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    physics_action_seconds: 1,
    moderate_injury_ratio: 0.1,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [{ event_id: "evt-proposal-boundary", scene_id: sceneId, participants: [shooter, mover] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      entity_positions: {
        [shooter]: { x: 3, y: 0 },
        [mover]: { x: 1, y: 1 },
      },
      dimensions: { width_m: 12, depth_m: 4 },
      obstacles: [],
      observable_by: {
        [shooter]: { visual: ["移動者將穿過射線"] },
        [mover]: { visual: ["前方路線暢通"] },
      },
    },
  },
  characters: {
    [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [mover]: {
      movement_speed_mps: 8,
      physical_state: { health_current: 100, health_max: 100, movement_multiplier: 1 },
    },
  },
  memories: { [shooter]: [], [mover]: [] },
  objects: {
    "proposal-launcher": {
      holder: shooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 4,
        radius_m: 0.05,
        base_damage: 100,
        damage_type: "proposal_slug",
        penetration_energy: 30,
        max_lifetime_ms: 1200,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [{
      action_id: "proposal-fire",
      intent: "朝移動路徑交會點射擊",
      duration_ms: 1000,
      projectile: { weapon_id: "proposal-launcher", aim_point: { x: 3, y: 1 }, fire_delay_ms: 0 },
    }],
    [mover]: [{
      action_id: "proposal-run",
      intent: "跑到 x=9",
      duration_ms: 1000,
      movement: { to: { x: 9, y: 1 } },
    }],
  },
};

async function characterBrain(packet) {
  return { action_id: packet.character === shooter ? "proposal-fire" : "proposal-run" };
}

try {
  const contract = buildWorldSimulationMutationProposalBoundaryContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.version, worldSimulationMutationProposalBoundaryVersion);
  assert.equal(causalContract.mutation_proposal_boundary.version, contract.version);
  assert.equal(contract.subsystem_interface.next_world_state_return_value_is_preview_only, true);
  assert.equal(contract.subsystem_interface.inter_subsystem_world_state_handoffs_use_executor_projection_only, true);
  assert.equal(contract.subsystem_interface.hidden_preview_writes_rejected_before_handoff, true);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62L proposal-only subsystem boundary fixture",
    characters: [shooter, mover],
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const turn = history.turns[0];
  const boundary = turn.mutation_proposal_boundary;

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(boundary);
  assert.equal(boundary.version, worldSimulationMutationProposalBoundaryVersion);
  assert.equal(boundary.subsystem_preview_world_state_authoritative, false);
  assert.equal(boundary.executor_projection_is_only_inter_subsystem_handoff_state, true);
  assert.ok(boundary.audit_count >= 5);
  assert.equal(boundary.audits.length, boundary.audit_count);
  const producers = new Set(boundary.audits.map((audit) => audit.producer));
  for (const producer of [
    "spatial_rules",
    "continuous_actor_state_precombat",
    "combat",
    "continuous_physics",
    "continuous_actor_state_postphysics",
  ]) assert.ok(producers.has(producer), `missing proposal boundary audit for ${producer}`);
  for (const audit of boundary.audits) {
    assert.equal(audit.subsystem_preview_world_state_authoritative, false);
    assert.equal(audit.executor_projection_is_only_inter_subsystem_handoff_state, true);
    assert.equal(audit.hidden_preview_writes_rejected_at_boundary, true);
    assert.equal(audit.committed_world_state_written_here, false);
    assert.equal(typeof audit.projection_queue_hash, "string");
    assert.equal(typeof audit.projection_execution_hash, "string");
  }
  assert.equal(state.state.characters[mover].physical_state.health_current, 0);
  assert.equal(state.state.characters[mover].physical_state.incapacitated, true);
  assert.ok(state.state.scenes[sceneId].entity_positions[mover].x < 9);

  const tinyState = { simulation_time: "2026-08-24T00:00:00.000Z", event_queue: [] };
  const tinyPreview = { simulation_time: "2026-08-24T00:00:00.100Z", event_queue: [] };
  const tinyTransition = {
    entity: "world",
    field: "simulation_time",
    from: tinyState.simulation_time,
    to: tinyPreview.simulation_time,
    cause: "proposal boundary fixture clock advance",
    time_ms: 100,
    source_layer: "causal_resolution",
  };
  const projection = projectWorldSimulationMutationProposals({
    producer: "fixture_producer",
    world_state: tinyState,
    preview_world_state: tinyPreview,
    state_transitions: [tinyTransition],
    elapsed_ms: 100,
  });
  assert.deepEqual(projection.projected_world_state, tinyPreview);
  assert.equal(projection.audit.subsystem_preview_world_state_authoritative, false);

  assert.throws(() => projectWorldSimulationMutationProposals({
    producer: "malicious_fixture_producer",
    world_state: tinyState,
    preview_world_state: { ...tinyPreview, illicit_private_write: true },
    state_transitions: [tinyTransition],
    elapsed_ms: 100,
  }), (error) => error?.code === "WORLD_SIMULATION_UNQUEUED_STATE_MUTATION");

  console.log(JSON.stringify({
    mutation_proposal_boundary_version: worldSimulationMutationProposalBoundaryVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    proposal_boundary_audit_count: boundary.audit_count,
    audited_producers: [...producers].sort(),
    inter_subsystem_handoffs_use_executor_projection: boundary.executor_projection_is_only_inter_subsystem_handoff_state,
    subsystem_preview_world_state_authoritative: boundary.subsystem_preview_world_state_authoritative,
    hidden_preview_write_rejected_before_handoff: true,
    mover_health: state.state.characters[mover].physical_state.health_current,
    character_brain_decides_mutation_proposals: false,
  }));
  console.log("Phase62L proposal-only subsystem boundary test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
