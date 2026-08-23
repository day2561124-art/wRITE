import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationChronologicalMutationQueueContract,
  worldSimulationChronologicalMutationQueueVersion,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62j-chronological-mutation-queue-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const sceneId = "mutation-queue-lab";
const shooter = "時序射手";
const mover = "時序移動者";

const initialWorldState = {
  simulation_time: "2026-08-24T15:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    physics_action_seconds: 1,
    moderate_injury_ratio: 0.1,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [{
    event_id: "evt-cross-layer-mutation-queue",
    scene_id: sceneId,
    participants: [shooter, mover],
  }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 12, depth_m: 4 },
      entity_positions: {
        [shooter]: { x: 3, y: 0 },
        [mover]: { x: 1, y: 1 },
      },
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
    "mutation-launcher": {
      holder: shooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 4,
        radius_m: 0.05,
        base_damage: 100,
        damage_type: "mutation_queue_slug",
        penetration_energy: 30,
        max_lifetime_ms: 1200,
      },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [shooter]: [{
      action_id: "mutation-fire",
      intent: "朝移動路徑交會點射擊",
      duration_ms: 1000,
      projectile: {
        weapon_id: "mutation-launcher",
        aim_point: { x: 3, y: 1 },
        fire_delay_ms: 0,
      },
    }],
    [mover]: [{
      action_id: "mutation-run",
      intent: "跑到 x=9",
      duration_ms: 1000,
      movement: { to: { x: 9, y: 1 } },
    }],
  },
};

async function characterBrain(packet) {
  return {
    action_id: packet.character === shooter ? "mutation-fire" : "mutation-run",
  };
}

try {
  const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(queueContract.version, worldSimulationChronologicalMutationQueueVersion);
  assert.equal(causalContract.chronological_mutation_queue.version, queueContract.version);
  assert.equal(queueContract.ordering.timestamp_ordered, true);
  assert.equal(queueContract.ordering.exact_same_timestamp_batched, true);
  assert.equal(queueContract.ordering.earlier_batch_commits_before_later_batch_reads, true);
  assert.equal(queueContract.character_brain_may_create_or_reorder_mutations, false);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62J unified chronological mutation queue fixture",
    characters: [shooter, mover],
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.equal(state.state.characters[mover].physical_state.health_current, 0);
  assert.equal(state.state.characters[mover].physical_state.incapacitated, true);

  const turn = history.turns[0];
  const queue = turn.chronological_mutation_queue;
  assert.ok(queue, "mutation queue must persist in world history");
  assert.equal(queue.version, worldSimulationChronologicalMutationQueueVersion);
  assert.equal(queue.all_mutations_timed, true);
  assert.equal(queue.mutation_count, turn.state_transitions.length);
  assert.equal(queue.continuity_warning_count, 0);
  assert.ok(queue.batch_count >= 2);
  assert.ok(queue.exact_timestamp_mutation_count > 0);
  assert.equal(typeof queue.queue_hash, "string");
  assert.ok(queue.queue_hash.length >= 32);

  for (let index = 1; index < queue.batches.length; index += 1) {
    assert.ok(queue.batches[index - 1].time_ms <= queue.batches[index].time_ms);
    assert.equal(queue.batches[index].chain_hash_before, queue.batches[index - 1].chain_hash_after);
    assert.equal(queue.batches[index].mutation_revision_from, queue.batches[index - 1].mutation_revision_to);
  }

  const projectileResolution = turn.causal_timeline.entries.find((entry) => (
    entry.kind === "projectile_resolution"
    && entry.result === "projectile_hit_character"
    && entry.target === mover
  ));
  assert.ok(projectileResolution);
  const hitTime = projectileResolution.time_ms;
  const hitBatch = queue.batches.find((batch) => Math.abs(batch.time_ms - hitTime) <= 1e-6);
  assert.ok(hitBatch, "projectile contact timestamp must have a mutation batch");
  assert.equal(hitBatch.same_timestamp_does_not_create_preemption, true);
  assert.ok(hitBatch.point_events.some((entry) => entry.kind === "projectile_resolution"));

  const healthMutation = hitBatch.mutations.find((mutation) => (
    mutation.entity === mover
    && mutation.field === "physical_state.health_current"
    && mutation.to === 0
  ));
  assert.ok(healthMutation, "projectile damage must mutate health in the exact contact batch");
  assert.equal(healthMutation.source_layer, "continuous_physics");
  assert.equal(healthMutation.time_precision, "exact");

  const positionMutation = hitBatch.mutations.find((mutation) => (
    mutation.entity === mover
    && mutation.field === "position"
  ));
  assert.ok(positionMutation, "continuous actor scheduler must commit the interrupted position in the same causal-time batch");
  assert.equal(positionMutation.source_layer, "continuous_actor_state");
  assert.deepEqual(state.state.scenes[sceneId].entity_positions[mover], positionMutation.to);

  const launchBatch = queue.batches.find((batch) => batch.time_ms === 0);
  assert.ok(launchBatch);
  assert.ok(launchBatch.mutations.some((mutation) => mutation.entity === "mutation-launcher" && mutation.field === "ammo.current"));
  assert.ok(launchBatch.mutations.some((mutation) => mutation.field === "projectile"));

  console.log(JSON.stringify({
    chronological_mutation_queue_version: worldSimulationChronologicalMutationQueueVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    mutation_count: queue.mutation_count,
    mutation_batch_count: queue.batch_count,
    exact_timestamp_mutation_count: queue.exact_timestamp_mutation_count,
    continuity_warning_count: queue.continuity_warning_count,
    hit_batch_time_ms: hitBatch.time_ms,
    hit_batch_cross_layer_mutations: new Set(hitBatch.mutations.map((item) => item.source_layer)).size,
    interrupted_position_x: state.state.scenes[sceneId].entity_positions[mover].x,
    queue_persisted: Boolean(queue.queue_hash),
    character_brain_decides_mutation_order: false,
  }));
  console.log("Phase62J unified chronological mutation queue test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
