import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  worldSimulationActorStateSchedulerVersion,
} from "../../server/src/world-simulation-actor-state-scheduler.mjs";
import {
  queryWorldSimulationAbilityFieldExposure,
} from "../../server/src/world-simulation-immutable-event-query-service.mjs";
import {
  runWorldSimulationTurn as runWorldSimulationTurnRuntime,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
  worldSimulationStatePaths,
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
    "evt-field-injury-reentry": {
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

  // C6-F: use an actual committed Phase62I movement trajectory whose speed
  // falls from 4 m/s to 3.4 m/s after the first 100ms field injury. The
  // immutable exposure query must derive segment boundaries directly from
  // the trajectory, without a duplicate breakpoints property from its caller.
  // Narrow field x=.5..1.5 is entirely crossed after the rate reduction:
  // exposure = 1m / 3.4m/s, not 1m / 4m/s.
  const rateTrajectoryInput = {
    profile: {
      start: fieldTrajectory.start,
      end: fieldTrajectory.final_position,
      durationMs: fieldTrajectory.completion_time_ms,
      trajectory: fieldTrajectory,
    },
    center: { x: 1, y: 1 }, radius_m: 0.5,
    start_ms: 0,
    end_ms: fieldTrajectory.completion_time_ms,
    character: fieldMover, field_id: "rate-change-measurement",
  };
  const beforeRateInput = JSON.stringify(rateTrajectoryInput);
  const actualRateExposure = queryWorldSimulationAbilityFieldExposure(rateTrajectoryInput);
  assert.ok(Math.abs(actualRateExposure.result.inside_ms - 1000 / 3.4) < 1e-5,
    "post-injury 3.4m/s trajectory must determine the physical time spent inside the circle");
  const times = [0, 100, 200, 300, 500, fieldTrajectory.completion_time_ms];
  let segmentedRateExposureMs = 0;
  for (let i = 0; i < times.length - 1; i++) {
    const partial = queryWorldSimulationAbilityFieldExposure({
      ...rateTrajectoryInput,
      start_ms: times[i], end_ms: times[i + 1],
    });
    segmentedRateExposureMs += partial.result.inside_ms;
    assert.equal(partial.audit.deterministic_replay_verified, true);
  }
  assert.ok(Math.abs(segmentedRateExposureMs - actualRateExposure.result.inside_ms) < 1e-6,
    "splitting a rate-adjusted trajectory at arbitrary times cannot change total exposure");
  assert.equal(JSON.stringify(rateTrajectoryInput), beforeRateInput);



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

  // C6-F: a moving target enters and exits two partially overlapping circles.
  // Integer 125ms sampling and binary-exact .5m boundaries make these precise:
  // A: x=.5..1.5 => t=125..375, B: x=1..2 => t=250..500.
  // Only positive-length interior exposure may inflict damage. In particular,
  // x=1.5 at t=375 is the *exit* of A, not a full extra A tick.
  for (const startingHp of [1000, 5]) {
    const crossing = structuredClone(initialWorldState);
    crossing.event_queue = [{
      event_id: "evt-field-ticks-refine-movement",
      scene_id: fieldScene, participants: [fieldMover],
    }];
    if (startingHp === 5) crossing.event_queue.push({
      event_id: "evt-field-injury-reentry",
      scene_id: fieldScene, participants: [fieldMover],
    });
    crossing.characters[fieldMover].physical_state = {
      health_current: startingHp, health_max: 1000,
      injuries: [], movement_multiplier: 1, combat_multiplier: 1,
      incapacitated: false, immobilized: false,
    };
    const first = structuredClone(crossing.ability_fields["persistent-field-i"]);
    first.field_id = "a-entry-exit-field";
    first.center = { x: 1, y: 1 };
    first.radius_m = 0.5;
    first.remaining_ms = 1000;
    first.tick_ms = 125;
    first.effect = {
      damage_per_second: 16, damage_type: "entry_exit_a",
      penetration: 0, ignore_armor: true,
    };
    const second = structuredClone(first);
    second.field_id = "z-overlapping-exit-field";
    second.center = { x: 1.5, y: 1 };
    second.effect = { ...first.effect, damage_type: "entry_exit_b" };
    crossing.ability_fields = {
      "a-entry-exit-field": first,
      "z-overlapping-exit-field": second,
    };
    const fixtureBefore = structuredClone(crossing);
    const crossingSession = await beginWorldSimulationSession({
      source_text: "CB-C6-F moving entry/exit shared field boundaries",
      characters: Object.keys(crossing.characters),
      initial_world_state: crossing,
    }, options);
    const crossingId = crossingSession.world_simulation_session_id;
    await runWorldSimulationTurn({
      world_simulation_session_id: crossingId,
    }, { ...options, characterBrain });
    const crossingState = await getWorldSimulationState(crossingId, options);
    const crossingHistory = await getWorldSimulationHistory(crossingId, options);
    assert.equal(crossingState.revision, 1);
    assert.equal(crossingHistory.turns.length, 1);
    const turn = crossingHistory.turns[0];
    const fieldTicks = turn.action_outcomes.filter(item =>
      item.result === "ability_field_tick" && item.target === fieldMover);
    const hitEvidence = fieldTicks.map(item => [
      item.ability_field_id, item.time_ms,
      Number(item.inside_ms.toFixed(6)),
      Number(item.damage_applied.toFixed(6)),
    ]);
    const expectedFirstHits = [
      ["a-entry-exit-field", 250, 125, 2],
      ["a-entry-exit-field", 375, 125, 2],
      ["z-overlapping-exit-field", 375, 125, 2],
    ];
    assert.deepEqual(hitEvidence.slice(0, 3), expectedFirstHits,
      "the first two overlapping circle boundaries must have exact exposed windows");
    const body = crossingState.state.characters[fieldMover].physical_state;
    const trajectory = turn.causal_timeline.actor_trajectories[fieldMover];
    if (startingHp === 1000) {
      assert.deepEqual(hitEvidence, [
        ...expectedFirstHits,
        ["z-overlapping-exit-field", 500, 125, 2],
      ], "leaving each circle at the tick boundary must never add an extra injury");
      assert.equal(body.health_current, 992);
      assert.equal(body.injuries.length, 4);
      assert.deepEqual(body.injuries.map(item => item.source),
        ["a-entry-exit-field", "a-entry-exit-field",
          "z-overlapping-exit-field", "z-overlapping-exit-field"]);
      assert.equal(trajectory.interrupted, false);
      assert.deepEqual(crossingState.state.scenes[fieldScene].entity_positions[fieldMover],
        { x: 4, y: 1 });
    } else {
      assert.deepEqual(fieldTicks.slice(0, 3).map(item => [
        item.health_before, item.health_after,
      ]), [[5, 3], [3, 1], [1, 0]]);
      assert.equal(body.health_current, 0);
      assert.equal(body.incapacitated, true);
      assert.equal(body.immobilized, true);
      assert.equal(trajectory.interrupted, true);
      assert.equal(trajectory.interrupted_at_ms, 375);
      assert.deepEqual(trajectory.final_position, { x: 1.5, y: 1 },
        "incapacitation at the overlap boundary stops movement at the causal location");
      assert.deepEqual(crossingState.state.scenes[fieldScene].entity_positions[fieldMover],
        trajectory.final_position);
      assert.ok(fieldTicks.length > 3,
        "later field exposure continues after the body becomes immobile");
    }
    assert.equal(crossingState.state.ability_fields["a-entry-exit-field"].remaining_ms, 0);
    assert.equal(crossingState.state.ability_fields["z-overlapping-exit-field"].remaining_ms, 0);
    assert.equal(new Set(body.injuries.map(item => item.injury_id)).size,
      body.injuries.length, "committed injury identities must remain unique");
    assert.deepEqual(crossing, fixtureBefore, "source World state must stay immutable");
    const persistedPaths = worldSimulationStatePaths(crossingId, options);
    const bytesBeforeRead = await Promise.all([
      readFile(persistedPaths.state, "utf8"),
      readFile(persistedPaths.history, "utf8"),
    ]);
    assert.deepEqual(await getWorldSimulationState(crossingId, { fixtureRoot }),
      crossingState, "a fresh disk reader must reproduce the committed World Body");
    assert.deepEqual(await getWorldSimulationHistory(crossingId, { fixtureRoot }),
      crossingHistory, "a fresh disk reader must reproduce the causal trajectory and injury order");
    assert.deepEqual(await Promise.all([
      readFile(persistedPaths.state, "utf8"),
      readFile(persistedPaths.history, "utf8"),
    ]), bytesBeforeRead, "read-only rehydration cannot rewrite durable World evidence");
    assert.equal(turn.previous_state_hash !== turn.next_state_hash, true);
    assert.equal(turn.next_state_hash, crossingState.state_hash);
    if (startingHp === 5) {
      // A second canonical turn consumes the next queued event from disk.
      // Reusing the previously selected movement intent cannot resurrect a
      // 0HP actor or rewind the first turn's incapacitation trajectory.
      const fatalPosition = structuredClone(trajectory.final_position);
      const fatalBody = structuredClone(body);
      await runWorldSimulationTurn({
        world_simulation_session_id: crossingId,
      }, { ...options, characterBrain });
      const later = await getWorldSimulationState(crossingId, { fixtureRoot });
      const laterHistory = await getWorldSimulationHistory(crossingId, { fixtureRoot });
      assert.equal(later.revision, 2);
      assert.equal(laterHistory.turns.length, 2);
      assert.deepEqual(later.state.scenes[fieldScene].entity_positions[fieldMover],
        fatalPosition, "a durable fatal field interruption forbids reentry movement");
      assert.deepEqual(later.state.characters[fieldMover].physical_state, fatalBody,
        "a blocked reentry cannot mutate persisted injury provenance");
      const blocked = laterHistory.turns[1].action_outcomes.filter(item =>
        item.actor === fieldMover && item.action_id === "field-run-i");
      assert.equal(blocked.some(item => item.result === "movement_blocked"), true);
      assert.equal(blocked.some(item => item.result === "movement_completed"), false);
      assert.deepEqual(laterHistory.turns[0], turn,
        "the original trajectory and causally ordered field injuries must never be replayed differently");
      assert.equal(laterHistory.turns[1].previous_state_hash, crossingState.state_hash);
      assert.equal(laterHistory.turns[1].next_state_hash, later.state_hash);
    }
  }

  // A legacy or externally imported Body record may be incapacitated or
  // unconscious without also setting immobilized. Persisted physiological
  // authority, not the incidental redundancy of flags, gates later movement.
  for (const [where, flag] of [
    ["physical", "incapacitated"],
    ["physical", "unconscious"],
    ["physical", "immobilized"],
    ["character", "incapacitated"],
    ["character", "unconscious"],
    ["character", "immobilized"],
  ]) {
    const disabled = structuredClone(initialWorldState);
    disabled.event_queue = [{
      event_id: "evt-field-injury-reentry",
      scene_id: fieldScene, participants: [fieldMover],
    }];
    disabled.ability_fields = {};
    disabled.projectiles = {};
    const character = disabled.characters[fieldMover];
    character.physical_state = {
      health_current: 60, health_max: 100,
      movement_multiplier: 1, immobilized: false,
      incapacitated: false, unconscious: false,
    };
    if (where === "physical") character.physical_state[flag] = true;
    else character[flag] = true;
    const source = structuredClone(disabled);
    const disabledSession = await beginWorldSimulationSession({
      source_text: "C6-F persisted Body movement authority " + where + "/" + flag,
      characters: Object.keys(disabled.characters),
      initial_world_state: disabled,
    }, options);
    const id = disabledSession.world_simulation_session_id;
    const beforeState = await getWorldSimulationState(id, options);
    await runWorldSimulationTurn({ world_simulation_session_id: id },
      { ...options, characterBrain });
    const afterState = await getWorldSimulationState(id, { fixtureRoot });
    const afterHistory = await getWorldSimulationHistory(id, { fixtureRoot });
    const result = afterHistory.turns[0];
    assert.equal(afterState.revision, 1, where + "/" + flag);
    assert.equal(afterHistory.turns.length, 1);
    assert.equal(result.previous_state_hash, beforeState.state_hash);
    assert.equal(result.next_state_hash, afterState.state_hash);
    assert.deepEqual(afterState.state.scenes[fieldScene].entity_positions[fieldMover],
      source.scenes[fieldScene].entity_positions[fieldMover],
      where + "/" + flag + ": persisted Body restrictions must block the next movement");
    assert.equal(result.action_outcomes.some(item =>
      item.actor === fieldMover && item.result === "movement_blocked"), true,
      where + "/" + flag + ": the cause must be a World refusal rather than a hidden teleport");
    assert.equal(result.action_outcomes.some(item =>
      item.actor === fieldMover && item.result === "movement_completed"), false);
    assert.equal(result.causal_timeline.actor_trajectories[fieldMover] ?? null, null,
      "blocked reentry must not create a new motion trajectory");
    assert.deepEqual(afterState.state.characters[fieldMover].physical_state,
      source.characters[fieldMover].physical_state);
    assert.deepEqual(disabled, source, "the initial fixture must not be mutated");
  }

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
