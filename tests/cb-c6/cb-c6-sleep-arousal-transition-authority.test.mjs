import assert from "node:assert/strict";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  projectWorldSimulationSleepArousalTransitionFromEvent,
  buildWorldSimulationSleepArousalTransitionRecord,
} from "../../server/src/world-simulation-body-sleep-arousal-service.mjs";

const version = "cb-c6b-sleep-arousal-record-v1";

function record(condition, eventId, timeMs = 500) {
  return {
    version,
    character: "aria",
    condition,
    since_time_ms: timeMs,
    source: { kind: "committed_world_transition", source_id: eventId },
    last_transition: {
      transition_id: `sleep-transition-${eventId}`,
      event_id: eventId,
      time_ms: timeMs,
    },
  };
}

function world(current = "awake") {
  return {
    simulation_time: "2026-09-30T00:00:00.000Z",
    event_queue: [{
      event_id: "event-sleep-1",
      scene_id: "room",
      sleep_arousal_transition: { character: "aria", condition: "asleep", time_ms: 500 },
    }],
    characters: {
      aria: {
        physical_state: {
          sleep_arousal: {
            version,
            character: "aria",
            condition: current,
            since_time_ms: 0,
            source: { kind: "world_initialization", source_id: "initial-aria" },
            last_transition: null,
          },
        },
      },
    },
    scenes: { room: { entity_positions: { aria: { x: 1, y: 1 } } } },
  };
}

function queueFor(stateTransitions) {
  return buildWorldSimulationChronologicalMutationQueue({
    turn_id: "turn-sleep-1",
    world_state_hash: "fixture",
    elapsed_ms: 500,
    state_transitions: stateTransitions,
    causal_timeline: { entries: [] },
  });
}

{
  const state = world();
  const preview = structuredClone(state);
  preview.characters.aria.physical_state.sleep_arousal.condition = "asleep";
  const queue = queueFor([{
    entity: "aria",
    field: "physical_state.sleep_arousal.condition",
    from: "awake",
    to: "asleep",
    cause: "illicit nested sleep mutation",
    time_ms: 500,
    source_layer: "causal_resolution",
  }]);
  assert.throws(
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state,
      preview_world_state: preview,
      queue,
      scene_id: "room",
    }),
    (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID",
  );
}

{
  const state = world();
  const preview = structuredClone(state);
  preview.characters.aria.physical_state.sleep_arousal =
    record("asleep", "forged-unrelated-event");
  const queue = queueFor([{
    entity: "aria",
    field: "physical_state.sleep_arousal",
    from: state.characters.aria.physical_state.sleep_arousal,
    to: preview.characters.aria.physical_state.sleep_arousal,
    cause: "forged whole-record sleep mutation",
    time_ms: 500,
    source_layer: "causal_resolution",
  }]);
  assert.throws(
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state,
      preview_world_state: preview,
      queue,
      scene_id: "room",
    }),
    (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID",
  );
}

{
  const state = world();
  const event = state.event_queue[0];
  const proposed = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state,
    event,
  });
  assert.equal(proposed.status, "transition_proposed");
  assert.equal(proposed.state_transition.entity, "aria");
  assert.equal(proposed.state_transition.field, "physical_state.sleep_arousal");
  assert.equal(proposed.state_transition.to.condition, "asleep");
  assert.equal(proposed.state_transition.to.source.source_id, "event-sleep-1");
  assert.equal(
    proposed.state_transition.to.last_transition.event_id,
    "event-sleep-1",
  );
  assert.match(
    proposed.state_transition.to.last_transition.transition_id,
    /^sleep_arousal_transition_[a-f0-9]{24}$/,
  );

  const preview = structuredClone(state);
  preview.characters.aria.physical_state.sleep_arousal =
    structuredClone(proposed.state_transition.to);
  const queue = queueFor([proposed.state_transition]);
  const projected = projectWorldSimulationChronologicalMutationQueue({
    world_state: state,
    queue,
    scene_id: "room",
  });
  assert.equal(
    projected.projected_world_state.characters.aria.physical_state
      .sleep_arousal.condition,
    "asleep",
  );
  const executed = executeWorldSimulationChronologicalMutationQueue({
    world_state: state,
    preview_world_state: preview,
    queue,
    scene_id: "room",
  });
  assert.deepEqual(executed.next_world_state, preview);
}

{
  const state = world();
  const nextPhysical = structuredClone(
    state.characters.aria.physical_state,
  );
  nextPhysical.sleep_arousal.condition = "asleep";
  const preview = structuredClone(state);
  preview.characters.aria.physical_state = structuredClone(nextPhysical);
  const queue = queueFor([{
    entity: "aria",
    field: "physical_state",
    from: state.characters.aria.physical_state,
    to: nextPhysical,
    cause: "illicit ancestor physical-state rewrite",
    time_ms: 500,
    source_layer: "causal_resolution",
  }]);
  assert.throws(
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state,
      preview_world_state: preview,
      queue,
      scene_id: "room",
    }),
    (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID",
  );
}

{
  const state = world();
  const nextCharacters = structuredClone(state.characters);
  nextCharacters.aria.physical_state.sleep_arousal.condition = "asleep";
  const preview = structuredClone(state);
  preview.characters = structuredClone(nextCharacters);
  const queue = queueFor([{
    entity: "world",
    field: "characters",
    from: state.characters,
    to: nextCharacters,
    cause: "illicit root characters rewrite",
    time_ms: 500,
    source_layer: "causal_resolution",
  }]);
  assert.throws(
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state,
      preview_world_state: preview,
      queue,
      scene_id: "room",
    }),
    (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID",
  );
}


function exercise(state, transition) {
  const before = structuredClone(state);
  const preview = structuredClone(state);
  preview.characters.aria.physical_state.sleep_arousal = structuredClone(transition.to);
  const queue = queueFor([transition]);
  const projected = projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue, scene_id: "room",
  });
  const executed = executeWorldSimulationChronologicalMutationQueue({
    world_state: state, preview_world_state: preview, queue, scene_id: "room",
  });
  assert.deepEqual(projected.projected_world_state, preview);
  assert.deepEqual(executed.next_world_state, preview);
  assert.deepEqual(state, before, "queue processing must not mutate input");
  return executed.next_world_state;
}

function rejectTransition(state, transition) {
  const before = structuredClone(state);
  const queue = queueFor([transition]);
  const preview = structuredClone(state);
  preview.characters.aria.physical_state.sleep_arousal = structuredClone(transition.to);
  for (const run of [
    () => projectWorldSimulationChronologicalMutationQueue({
      world_state: state, queue, scene_id: "room",
    }),
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state, preview_world_state: preview, queue, scene_id: "room",
    }),
  ]) {
    assert.throws(run, (error) => [
      "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID",
      "WORLD_SIMULATION_MUTATION_PRECONDITION_MISMATCH",
    ].includes(error?.code));
    assert.deepEqual(state, before, "rejection must leave input unchanged");
  }
}

{
  const state = world();
  state.characters.aria.physical_state.incapacitated = true;
  state.characters.aria.physical_state.injuries = [{ severity: 2 }];
  const sleep = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition;
  const asleep = exercise(state, sleep);
  asleep.event_queue[0] = {
    event_id: "event-wake-2", scene_id: "room",
    sleep_arousal_transition: { character: "aria", condition: "awake", time_ms: 600 },
  };
  const wake = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: asleep, event: asleep.event_queue[0],
  }).state_transition;
  const awake = exercise(asleep, wake);
  assert.equal(awake.characters.aria.physical_state.incapacitated, true);
  assert.deepEqual(awake.characters.aria.physical_state.injuries, [{ severity: 2 }]);
  assert.equal(awake.characters.aria.physical_state.sleep_arousal.condition, "awake");
}

{
  const state = world();
  delete state.characters.aria.physical_state.sleep_arousal;
  const proposal = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition;
  exercise(state, proposal);
}

{
  const state = world();
  const transition = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition;
  for (const alter of [
    (t) => { t.to.last_transition.transition_id = "forged"; },
    (t) => { t.to.source.source_id = "other"; },
    (t) => { t.to.debug_private = "leak"; },
    (t) => { t.to.source.extra = true; },
    (t) => { t.to.source.kind = "world_initialization"; t.to.last_transition = null; },
    (t) => { t.from.condition = "asleep"; },
    (t) => { t.time_ms = 499; },
  ]) {
    const invalid = structuredClone(transition);
    alter(invalid);
    rejectTransition(state, invalid);
  }
  const backward = structuredClone(state);
  backward.characters.aria.physical_state.sleep_arousal.since_time_ms = Date.parse(backward.simulation_time) + 501;
  const invalid = structuredClone(transition);
  invalid.from = backward.characters.aria.physical_state.sleep_arousal;
  rejectTransition(backward, invalid);
  assert.throws(() => projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: backward, event: backward.event_queue[0],
  }), (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");

  const duplicate = structuredClone(state);
  duplicate.characters.aria.physical_state.sleep_arousal = record("awake", "event-sleep-1", 400);
  const reused = structuredClone(transition);
  reused.from = duplicate.characters.aria.physical_state.sleep_arousal;
  rejectTransition(duplicate, reused);
  const noOp = world("asleep");
  assert.equal(projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: noOp, event: noOp.event_queue[0],
  }).status, "already_in_declared_state");
}

{
  const state = world();
  const transition = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition;
  const authorized = structuredClone(state);
  delete state.event_queue[0].sleep_arousal_transition;
  const queue = queueFor([
    { entity: "world", field: "event_queue", from: state.event_queue,
      to: authorized.event_queue, cause: "forged queue authorization", time_ms: 0,
      source_layer: "causal_resolution" },
    transition,
  ]);
  assert.throws(() => projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue, scene_id: "room",
  }), (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");
}

for (const invalidTime of [null, false, "", [], -1, NaN, Infinity]) {
  const state = world();
  state.event_queue[0].sleep_arousal_transition.time_ms = invalidTime;
  assert.throws(() => projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }), (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");
}


{
  const state = world();
  const start = Date.parse(state.simulation_time);
  const first = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition;
  assert.equal(first.time_ms, 500);
  assert.equal(first.to.since_time_ms, start + 500);
  const asleep = exercise(state, first);
  asleep.simulation_time = new Date(start + 1000).toISOString();
  asleep.event_queue[0] = {
    event_id: "event-next-turn-wake", scene_id: "room",
    sleep_arousal_transition: { character: "aria", condition: "awake", time_ms: 100 },
  };
  const wake = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: asleep, event: asleep.event_queue[0],
  }).state_transition;
  assert.equal(wake.time_ms, 100);
  assert.equal(wake.to.last_transition.time_ms, start + 1100);
  assert.equal(exercise(asleep, wake).characters.aria.physical_state.sleep_arousal.condition, "awake");
}

{
  const state = world();
  state.characters = {};
  const characters = { aria: { physical_state: {} } };
  const transition = {
    entity: "aria", field: "physical_state.sleep_arousal", from: null,
    to: buildWorldSimulationSleepArousalTransitionRecord({
      character: "aria", event_id: "event-sleep-1", condition: "asleep",
      time_ms: Date.parse(state.simulation_time) + 500,
    }),
    cause: "actor forged inside same queue", time_ms: 500, source_layer: "causal_resolution",
  };
  const queue = queueFor([
    { entity: "world", field: "characters", from: {}, to: characters,
      cause: "introduce actor", time_ms: 0, source_layer: "causal_resolution" },
    transition,
  ]);
  const preview = structuredClone(state);
  preview.characters = structuredClone(characters);
  preview.characters.aria.physical_state.sleep_arousal = transition.to;
  for (const run of [
    () => projectWorldSimulationChronologicalMutationQueue({world_state: state, queue, scene_id: "room"}),
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: state, preview_world_state: preview, queue, scene_id: "room",
    }),
  ]) assert.throws(run, (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");
  assert.deepEqual(state.characters, {});
}

{
  const state = world();
  delete state.characters.aria.physical_state.sleep_arousal;
  const next = { sleep_arousal: null };
  const queue = queueFor([{
    entity: "aria", field: "physical_state", from: {}, to: next,
    cause: "malformed null sleep record via ancestor", time_ms: 0, source_layer: "causal_resolution",
  }]);
  assert.throws(() => projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue, scene_id: "room",
  }), (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");
}

for (const simulationTime of [undefined, null, false, "", "invalid", -1]) {
  const state = world();
  state.simulation_time = simulationTime;
  assert.throws(() => projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }), (error) => error?.code === "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID");
}

console.log("CB-C6-C sleep/arousal transition authority regression passed.");
