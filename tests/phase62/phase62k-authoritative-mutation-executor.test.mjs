import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
  worldSimulationMutationExecutorVersion,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62k-authoritative-mutation-executor-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const sceneId = "authoritative-mutation-lab";
const shooter = "權威射手";
const mover = "權威移動者";

const initialWorldState = {
  simulation_time: "2026-08-24T16:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    physics_action_seconds: 1,
    moderate_injury_ratio: 0.1,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [{ event_id: "evt-authoritative-mutation", scene_id: sceneId, participants: [shooter, mover] }],
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
    "authoritative-launcher": {
      holder: shooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 4,
        radius_m: 0.05,
        base_damage: 100,
        damage_type: "authority_slug",
        penetration_energy: 30,
        max_lifetime_ms: 1200,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [{
      action_id: "authority-fire",
      intent: "朝移動路徑交會點射擊",
      duration_ms: 1000,
      projectile: { weapon_id: "authoritative-launcher", aim_point: { x: 3, y: 1 }, fire_delay_ms: 0 },
    }],
    [mover]: [{
      action_id: "authority-run",
      intent: "跑到 x=9",
      duration_ms: 1000,
      movement: { to: { x: 9, y: 1 } },
    }],
  },
};

async function characterBrain(packet) {
  return { action_id: packet.character === shooter ? "authority-fire" : "authority-run" };
}

try {
  const contract = buildWorldSimulationChronologicalMutationQueueContract();
  assert.equal(contract.execution.sole_final_world_state_writer, true);
  assert.equal(contract.execution.subsystem_mutations_are_ephemeral_preview_only, true);
  assert.equal(contract.execution.unqueued_preview_state_changes_rejected, true);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62K authoritative mutation executor fixture",
    characters: [shooter, mover],
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const turn = history.turns[0];
  const execution = turn.chronological_mutation_execution;

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(execution);
  assert.equal(execution.version, worldSimulationMutationExecutorVersion);
  assert.equal(execution.sole_final_world_state_writer, true);
  assert.equal(execution.subsystem_world_state_mutations_are_ephemeral_preview_only, true);
  assert.equal(execution.all_preview_changes_reproduced_by_queue, true);
  assert.equal(execution.applied_mutation_count, turn.chronological_mutation_queue.mutation_count);
  assert.equal(typeof execution.execution_hash, "string");
  assert.ok(execution.execution_hash.length >= 32);
  assert.equal(state.state.characters[mover].physical_state.health_current, 0);
  assert.equal(state.state.characters[mover].physical_state.incapacitated, true);
  assert.ok(state.state.scenes[sceneId].entity_positions[mover].x < 9);

  const tinyState = { simulation_time: "2026-08-24T00:00:00.000Z", event_queue: [] };
  const tinyPreview = { simulation_time: "2026-08-24T00:00:00.100Z", event_queue: [] };
  const tinyQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: "tiny-authority-turn",
    world_state_hash: "fixture",
    elapsed_ms: 100,
    state_transitions: [{
      entity: "world",
      field: "simulation_time",
      from: tinyState.simulation_time,
      to: tinyPreview.simulation_time,
      cause: "fixture clock advance",
      time_ms: 100,
      source_layer: "causal_resolution",
    }],
    causal_timeline: { entries: [] },
  });
  const tinyExecution = executeWorldSimulationChronologicalMutationQueue({
    world_state: tinyState,
    preview_world_state: tinyPreview,
    queue: tinyQueue,
  });
  assert.deepEqual(tinyExecution.next_world_state, tinyPreview);

  assert.throws(() => executeWorldSimulationChronologicalMutationQueue({
    world_state: tinyState,
    preview_world_state: { ...tinyPreview, illicit_subsystem_write: true },
    queue: tinyQueue,
  }), (error) => error?.code === "WORLD_SIMULATION_UNQUEUED_STATE_MUTATION");

  const wrongQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: "wrong-precondition-turn",
    world_state_hash: "fixture",
    elapsed_ms: 100,
    state_transitions: [{
      entity: "world",
      field: "simulation_time",
      from: "2026-08-23T23:59:59.000Z",
      to: tinyPreview.simulation_time,
      cause: "invalid declared precondition",
      time_ms: 100,
      source_layer: "causal_resolution",
    }],
    causal_timeline: { entries: [] },
  });
  assert.throws(() => executeWorldSimulationChronologicalMutationQueue({
    world_state: tinyState,
    preview_world_state: tinyPreview,
    queue: wrongQueue,
  }), (error) => error?.code === "WORLD_SIMULATION_MUTATION_PRECONDITION_MISMATCH");

  console.log(JSON.stringify({
    mutation_executor_version: worldSimulationMutationExecutorVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    applied_mutation_count: execution.applied_mutation_count,
    sole_final_world_state_writer: execution.sole_final_world_state_writer,
    all_preview_changes_reproduced_by_queue: execution.all_preview_changes_reproduced_by_queue,
    unqueued_preview_write_rejected: true,
    mutation_precondition_mismatch_rejected: true,
    character_brain_decides_world_state_mutations: false,
  }));
  console.log("Phase62K authoritative chronological mutation executor test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
