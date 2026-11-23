import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  worldSimulationActorStateSchedulerVersion,
} from "../../server/src/world-simulation-actor-state-scheduler.mjs";
import {
  runWorldSimulationTurn as runWorldSimulationTurnRuntime,
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
  `phase62i-continuous-actor-state-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

let testHarnessEventId = null;
async function runWorldSimulationTurn(input, runtimeOptions) {
  const sessionId = input?.world_simulation_session_id ?? null;
  const harnessState = sessionId
    ? await getWorldSimulationState(sessionId, runtimeOptions)
    : null;
  testHarnessEventId = input?.event_id
    ?? harnessState?.state?.event_queue?.[0]?.event_id
    ?? null;
  try {
    return await runWorldSimulationTurnRuntime(input, runtimeOptions);
  } finally {
    testHarnessEventId = null;
  }
}
await rm(fixtureRoot, { recursive: true, force: true });

const interruptScene = "actor-state-interruption-lab";
const fieldScene = "actor-state-field-lab";
const shooter = "中途攔截射手";
const interruptedMover = "移動中受創者";
const fieldOwner = "場域維持者";
const fieldMover = "場域穿越者";

const initialWorldState = {
  simulation_time: "2026-08-24T14:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    physics_action_seconds: 1,
    ability_field_tick_ms: 100,
    moderate_injury_ratio: 0.1,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [
    {
      event_id: "evt-projectile-interrupts-movement",
      scene_id: interruptScene,
      participants: [shooter, interruptedMover],
    },
    {
      event_id: "evt-field-ticks-refine-movement",
      scene_id: fieldScene,
      participants: [fieldOwner, fieldMover],
    },
  ],
  scenes: {
    [interruptScene]: {
      scene_id: interruptScene,
      dimensions: { width_m: 12, depth_m: 4 },
      entity_positions: {
        [shooter]: { x: 3, y: 0 },
        [interruptedMover]: { x: 1, y: 1 },
      },
      obstacles: [],
      observable_by: {
        [shooter]: { visual: ["移動者將穿過 x=3 的射線"] },
        [interruptedMover]: { visual: ["前方路線暢通"] },
      },
    },
    [fieldScene]: {
      scene_id: fieldScene,
      dimensions: { width_m: 8, depth_m: 4 },
      entity_positions: {
        [fieldOwner]: { x: 2, y: 3 },
        [fieldMover]: { x: 0, y: 1 },
      },
      obstacles: [],
      observable_by: {
        [fieldOwner]: { visual: ["持續場域覆蓋移動路徑"] },
        [fieldMover]: { visual: ["前方路線位於持續場域內"] },
      },
    },
  },
  characters: {
    [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
    [interruptedMover]: {
      movement_speed_mps: 8,
      physical_state: { health_current: 100, health_max: 100, movement_multiplier: 1 },
    },
    [fieldOwner]: { physical_state: { health_current: 100, health_max: 100 } },
    [fieldMover]: {
      movement_speed_mps: 4,
      physical_state: { health_current: 100, health_max: 100, movement_multiplier: 1 },
    },
  },
  memories: {
    [shooter]: [],
    [interruptedMover]: [],
    [fieldOwner]: [],
    [fieldMover]: [],
  },
  objects: {
    "interrupt-launcher-i": {
      holder: shooter,
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 4,
        radius_m: 0.05,
        base_damage: 100,
        damage_type: "actor_state_stop_slug",
        penetration_energy: 30,
        max_lifetime_ms: 1200,
      },
    },
  },
  projectiles: {},
  ability_fields: {
    "persistent-field-i": {
      field_id: "persistent-field-i",
      owner: fieldOwner,
      ability_id: "persistent-test-field",
      source_action_id: null,
      scene_id: fieldScene,
      center: { x: 2, y: 1 },
      radius_m: 5,
      remaining_ms: 300,
      active: true,
      affects_owner: false,
      tick_ms: 100,
      effect: {
        damage_per_second: 100,
        damage_type: "actor_state_field",
        penetration: 0,
        ignore_armor: true,
      },
    },
  },
  available_actions: {
    [shooter]: [{
      action_id: "interrupt-moving-target-i",
      intent: "朝移動路徑上的預測交會點射擊",
      duration_ms: 1000,
      projectile: {
        weapon_id: "interrupt-launcher-i",
        aim_point: { x: 3, y: 1 },
        fire_delay_ms: 0,
      },
    }],
    [interruptedMover]: [{
      action_id: "long-run-i",
      intent: "沿直線跑到 x=9",
      duration_ms: 1000,
      movement: { to: { x: 9, y: 1 } },
    }],
    [fieldOwner]: [{ action_id: "maintain-field-i", intent: "維持原位", duration_ms: 1000 }],
    [fieldMover]: [{
      action_id: "field-run-i",
      intent: "穿越持續場域到 x=4",
      duration_ms: 1000,
      movement: { to: { x: 4, y: 1 } },
    }],
  },
};

function actionFor(eventId, character) {
  const map = {
    "evt-projectile-interrupts-movement": {
      [shooter]: "interrupt-moving-target-i",
      [interruptedMover]: "long-run-i",
    },
    "evt-field-ticks-refine-movement": {
      [fieldOwner]: "maintain-field-i",
      [fieldMover]: "field-run-i",
    },
  };
  return map[eventId]?.[character] ?? null;
}

async function characterBrain(packet) {
  const actionId = actionFor(testHarnessEventId, packet.character);
  assert.ok(actionId, `missing Phase62I fixture action for ${testHarnessEventId}/${packet.character}`);
  return { action_id: actionId };
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  const actorState = contract.continuous_actor_state;
  assert.equal(actorState.version, worldSimulationActorStateSchedulerVersion);
  assert.equal(actorState.movement.piecewise_position_integration, true);
  assert.equal(actorState.movement.incapacitation_stops_in_progress_movement_at_causal_position, true);
  assert.equal(actorState.ability_field.deterministic_tick_events_supported, true);
  assert.equal(actorState.character_brain_may_decide_position_after_interruption, false);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62I continuous actor-state scheduler fixture",
    characters: Object.keys(initialWorldState.characters),
    initial_world_state: initialWorldState,
  }, options);

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  let history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 1);
  assert.equal(state.state.characters[interruptedMover].physical_state.health_current, 0);
  assert.equal(state.state.characters[interruptedMover].physical_state.incapacitated, true);

  const firstTimeline = history.turns[0].causal_timeline;
  assert.equal(firstTimeline.actor_state_scheduler_version, worldSimulationActorStateSchedulerVersion);
  const interruptedTrajectory = firstTimeline.actor_trajectories[interruptedMover];
  assert.ok(interruptedTrajectory);
  assert.equal(interruptedTrajectory.interrupted, true);
  assert.ok(interruptedTrajectory.interrupted_at_ms > 0 && interruptedTrajectory.interrupted_at_ms < 1000);
  assert.ok(interruptedTrajectory.final_position.x > 1 && interruptedTrajectory.final_position.x < 9);
  assert.deepEqual(state.state.scenes[interruptScene].entity_positions[interruptedMover], interruptedTrajectory.final_position);
  const interruptedOutcome = history.turns[0].action_outcomes.find((item) => item.action_id === "long-run-i");
  assert.equal(interruptedOutcome.result, "movement_interrupted");
  assert.ok(firstTimeline.entries.some((item) => item.kind === "movement_interrupted" && item.actor === interruptedMover));

  await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, { ...options, characterBrain });

  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 2);
  assert.equal(history.turns.length, 2);
  assert.deepEqual(state.state.scenes[fieldScene].entity_positions[fieldMover], { x: 4, y: 1 });
  assert.equal(state.state.characters[fieldMover].physical_state.health_current, 70);
  assert.equal(state.state.characters[fieldMover].physical_state.movement_multiplier, 0.85);

  const secondTimeline = history.turns[1].causal_timeline;
  const fieldTrajectory = secondTimeline.actor_trajectories[fieldMover];
  assert.ok(fieldTrajectory);
  assert.equal(fieldTrajectory.interrupted, false);
  assert.ok(fieldTrajectory.completion_time_ms > fieldTrajectory.nominal_completion_ms);
  const tickEntries = secondTimeline.entries.filter((item) => item.kind === "ability_field_tick" && item.target === fieldMover);
  assert.equal(tickEntries.length, 3);
  assert.deepEqual(tickEntries.map((item) => item.time_ms), [100, 200, 300]);
  const movementRateChange = secondTimeline.movement_adjustments.find((item) => item.kind === "movement_rate_adjusted" && item.actor === fieldMover);
  assert.ok(movementRateChange);
  assert.equal(movementRateChange.time_ms, 100);
  assert.ok(secondTimeline.entries.some((item) => item.kind === "movement_completion_refined" && item.actor === fieldMover));


  // C6-F: a later slow-field hit may not be applied before an earlier fast
  // overlapping-field hit when determining when a moving actor collapses.
  // At 100ms: slow 0.5 + fast 5 = 5.5 damage, so 0.5 HP remains.
  // At 200ms: slow's next 0.5 HP crosses zero. A field-ID batch ordering
  // incorrectly applies a 200ms slow hit before the 100ms fast hit, stopping
  // the moving actor at 100ms despite the actual 200ms lethal frontier.
  const overlapWorld = structuredClone(initialWorldState);
  overlapWorld.event_queue = [{
    event_id: "evt-field-ticks-refine-movement",
    scene_id: fieldScene,
    participants: [fieldMover],
  }];
  overlapWorld.characters[fieldMover].physical_state = {
    health_current: 6, health_max: 100,
    injuries: [], movement_multiplier: 1, combat_multiplier: 1,
    incapacitated: false, immobilized: false,
  };
  const slow = structuredClone(overlapWorld.ability_fields["persistent-field-i"]);
  slow.field_id = "a-slow-moving-field";
  slow.tick_ms = 200;
  slow.remaining_ms = 200;
  slow.effect.damage_per_second = 5;
  slow.effect.damage_type = "slow-moving-field";
  const fast = structuredClone(slow);
  fast.field_id = "z-fast-moving-field";
  fast.tick_ms = 100;
  fast.remaining_ms = 100;
  fast.effect.damage_per_second = 50;
  fast.effect.damage_type = "fast-moving-field";
  overlapWorld.ability_fields = {
    "a-slow-moving-field": slow, "z-fast-moving-field": fast,
  };
  const overlapRoot = structuredClone(overlapWorld);
  const overlapSession = await beginWorldSimulationSession({
    source_text: "CB-C6-F moving actor overlapping fields causal order",
    characters: Object.keys(overlapWorld.characters),
    initial_world_state: overlapWorld,
  }, options);
  const overlapId = overlapSession.world_simulation_session_id;
  await runWorldSimulationTurn({
    world_simulation_session_id: overlapId,
  }, { ...options, characterBrain });
  const moved = await getWorldSimulationState(overlapId, options);
  const movedHistory = await getWorldSimulationHistory(overlapId, options);
  assert.equal(moved.revision, 1);
  assert.equal(movedHistory.turns.length, 1);
  const fieldHits = movedHistory.turns[0].action_outcomes.filter(item =>
    item.result === "ability_field_tick" && item.target === fieldMover);
  assert.deepEqual(fieldHits.map(item => [
    item.ability_field_id, item.time_ms, item.damage_applied,
  ]), [
    ["a-slow-moving-field", 100, 0.5],
    ["z-fast-moving-field", 100, 5],
    ["a-slow-moving-field", 200, 0.5],
  ], "overlapping fields must share causal frontiers rather than field-ID tick batches");
  assert.deepEqual(fieldHits.map(item => [item.health_before, item.health_after]), [
    [6, 5.5], [5.5, 0.5], [0.5, 0],
  ]);
  assert.equal(moved.state.characters[fieldMover].physical_state.health_current, 0);
  assert.equal(moved.state.characters[fieldMover].physical_state.incapacitated, true);
  const overlapTrajectory = movedHistory.turns[0].causal_timeline.actor_trajectories[fieldMover];
  assert.equal(overlapTrajectory.interrupted, true);
  assert.equal(overlapTrajectory.interrupted_at_ms, 200,
    "later injury cannot preempt movement retroactively at an earlier timestamp");
  assert.ok(overlapTrajectory.final_position.x > 0.4
    && overlapTrajectory.final_position.x <= 0.8,
    "World must stop the mover at the actual 200ms causal position, not at the fast field's 100ms tick");
  assert.deepEqual(moved.state.scenes[fieldScene].entity_positions[fieldMover],
    overlapTrajectory.final_position);
  assert.deepEqual(moved.state.characters[fieldMover].physical_state.injuries.map(item => item.source), [
    "a-slow-moving-field", "z-fast-moving-field", "a-slow-moving-field",
  ]);
  assert.deepEqual(moved.state.ability_fields["a-slow-moving-field"].remaining_ms, 0);
  assert.deepEqual(moved.state.ability_fields["z-fast-moving-field"].remaining_ms, 0);
  assert.deepEqual(overlapWorld, overlapRoot, "the overlap fixture is immutable");

  console.log(JSON.stringify({
    actor_state_scheduler_version: worldSimulationActorStateSchedulerVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    interrupted_movement_x: interruptedTrajectory.final_position.x,
    interrupted_at_ms: interruptedTrajectory.interrupted_at_ms,
    field_tick_count: tickEntries.length,
    field_mover_health: state.state.characters[fieldMover].physical_state.health_current,
    field_mover_movement_multiplier: state.state.characters[fieldMover].physical_state.movement_multiplier,
    refined_field_move_completion_ms: fieldTrajectory.completion_time_ms,
    character_brain_decides_partial_position: false,
    character_brain_decides_field_exposure: false,
  }));
  console.log("Phase62I continuous actor-state scheduler test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
