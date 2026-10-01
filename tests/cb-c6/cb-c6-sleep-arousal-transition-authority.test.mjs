import assert from "node:assert/strict";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  projectWorldSimulationSleepArousalTransitionFromEvent,
  buildWorldSimulationSleepArousalTransitionRecord,
  bindWorldSimulationSleepArousalBodyMutation as bindBodyMutation,
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


import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState, getWorldSimulationHistory,
  worldSimulationStatePaths,
} from "../../server/src/world-simulation-state-service.mjs";

for (const clock of [
  "2026-09-30T00:00:00.000", "2026-09-30", "09/30/2026",
  "2026-02-30T00:00:00.000Z", "2026-02-29T00:00:00.000+08:00",
  "2026-09-31T00:00:00.000Z", "2026-09-30T24:00:00.000Z",
  "2026-09-30T00:00:00.000+24:00", "2026-09-30T00:00:00.000+08:60",
]) {
  const state = world();
  state.simulation_time = clock;
  assert.throws(() => projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }), { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" });
}
{
  const state = world();
  state.simulation_time = "2026-09-30T08:00:00.000+08:00";
  assert.equal(projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition.to.since_time_ms, Date.parse(world().simulation_time) + 500);
}

for (const [clock, expected] of [
  ["2024-02-29T08:00:00.1+08:00", "2024-02-29T00:00:00.100Z"],
  ["2024-02-28T19:00:00.12-05:00", "2024-02-29T00:00:00.120Z"],
  ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z"],
]) {
  const state = world();
  state.simulation_time = clock;
  assert.equal(projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: state, event: state.event_queue[0],
  }).state_transition.to.since_time_ms, Date.parse(expected) + 500);
}

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `c6c-commit-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const initial = configuredBodyWorld();
  // Explicit fixture guard: this test does not model physiological cue updates.
  initial.world_rules.sleep_arousal.rules[1].required_homeostatic_cues.fatigue = true;
  initial.characters.aria.physical_state.incapacitated = true;
  initial.characters.aria.physical_state.injuries = [{ severity: 2 }];
  const session = await beginWorldSimulationSession({
    simulation_label: "C6-C authoritative sleep commit fixture",
    seed: "c6-c-commit",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const sessionId = session.world_simulation_session_id;
  const paths = worldSimulationStatePaths(sessionId, options);
  const bytes = async () => Promise.all([
    readFile(paths.state, "utf8"), readFile(paths.history, "utf8"),
  ]);
  const inputFor = (envelope, transition, turnId) => {
    const next = structuredClone(envelope.state);
    next.characters.aria.physical_state.sleep_arousal = structuredClone(transition.to);
    next.simulation_time = new Date(transition.to.since_time_ms).toISOString();
    return {
      expected_revision: envelope.revision, expected_state_hash: envelope.state_hash,
      turn_id: turnId, event: structuredClone(envelope.state.event_queue[0]),
      next_world_state: next, state_transitions: [bindBodyMutation({
        ...bodyContext(envelope.state, envelope.revision, transition.time_ms),
        result: adjudicateBodySleep(bodyContext(envelope.state, envelope.revision, transition.time_ms)),
      })],
    };
  };
  const reject = async (input, code = "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID") => {
    const before = await bytes();
    await assert.rejects(commitWorldSimulationTurn(sessionId, input, options), { code });
    assert.deepEqual(await bytes(), before, "rejection must preserve state and history bytes");
  };
  const first = await getWorldSimulationState(sessionId, options);
  const sleep = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: first.state, event: first.state.event_queue[0],
  }).state_transition;
  const valid = inputFor(first, sleep, "sleep");
  for (const alter of [
    (input) => { input.state_transitions = []; },
    (input) => { delete input.state_transitions[0].body_sleep_adjudication; },
    (input) => { input.state_transitions[0].body_sleep_adjudication = null; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.source_world_revision += 1; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.source_world_state_hash = "forged"; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.rule_configuration_hash = "forged"; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.evidence[0].character = "bystander"; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.evidence[0].value = false; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.resolved_horizon_ms += 1; },
    (input) => { input.state_transitions[0].body_sleep_adjudication.extra = true; },
    (input) => { input.event.event_id = "forged-event"; },
    (input) => { input.state_transitions[0].from.condition = "asleep"; },
    (input) => { input.next_world_state.simulation_time = first.state.simulation_time; },
    (input) => { input.next_world_state.characters.aria.physical_state.sleep_arousal = null; },
    (input) => { delete input.next_world_state.characters.aria; },
  ]) {
    const invalid = structuredClone(valid);
    alter(invalid);
    await reject(invalid);
  }
  valid.next_world_state.event_queue = [{
    event_id: "event-wake-2", scene_id: "room",
    sleep_arousal_transition: { character: "aria", condition: "awake", time_ms: 100 },
  }];
  const accepted = structuredClone(valid);
  const pendingCommit = commitWorldSimulationTurn(sessionId, valid, options);
  // This runs while session/transaction I/O is pending, without a timing race.
  valid.event.event_id = "caller-mutated-event";
  valid.state_transitions[0].to.condition = "awake";
  valid.next_world_state.characters.aria.physical_state.sleep_arousal = null;
  await pendingCommit;
  const acceptedHistory = await getWorldSimulationHistory(sessionId, options);
  assert.deepEqual(acceptedHistory.turns[0].event, accepted.event);
  assert.deepEqual(acceptedHistory.turns[0].state_transitions, accepted.state_transitions);
  assert.deepEqual((await getWorldSimulationState(sessionId, options)).state,
    accepted.next_world_state);
  await reject(valid, "WORLD_SIMULATION_STALE_REVISION");
  const second = await getWorldSimulationState(sessionId, options);
  const wake = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: second.state, event: second.state.event_queue[0],
  }).state_transition;
  const wakeInput = inputFor(second, wake, "wake");
  wakeInput.next_world_state.event_queue = structuredClone(initial.event_queue);
  await commitWorldSimulationTurn(sessionId, wakeInput, options);
  const third = await getWorldSimulationState(sessionId, options);
  assert.equal(third.state.characters.aria.physical_state.incapacitated, true);
  assert.deepEqual(third.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
  const reused = projectWorldSimulationSleepArousalTransitionFromEvent({
    world_state: third.state, event: third.state.event_queue[0],
  }).state_transition;
  await reject(inputFor(third, reused, "reused-source-event"));
  const history = await getWorldSimulationHistory(sessionId, options);
  assert.equal(history.turns.length, 2);
  let replay = structuredClone(initial.characters.aria.physical_state.sleep_arousal);
  for (const turn of history.turns) {
    const transition = turn.state_transitions[0];
    assert.deepEqual(transition.from, replay);
    assert.equal(transition.to.source.source_id, turn.event.event_id);
    replay = structuredClone(transition.to);
  }
  assert.deepEqual(replay, third.state.characters.aria.physical_state.sleep_arousal);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}


import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  adjudicateWorldSimulationSleepArousalFromBody as adjudicateBodySleep,
  assertWorldSimulationSleepArousalBodyAdjudication as assertBodySleep,
  worldSimulationSleepArousalBodyRuleVersion as bodyRuleVersion,
} from "../../server/src/world-simulation-body-sleep-arousal-service.mjs";

function bodyContext(state, revision = 4, horizon = 500) {
  return {
    world_state: state, world_state_revision: revision,
    world_state_hash: hashAgentRunValue(state),
    event: structuredClone(state.event_queue[0]), elapsed_ms: horizon,
  };
}
function configuredBodyWorld(current = "awake") {
  const state = world(current);
  state.characters.aria.physical_state.homeostatic_cues = { fatigue: true };
  state.world_rules = { sleep_arousal: {
    version: bodyRuleVersion,
    rules: [{
      rule_id: "fixture-explicit-sleep-guard", character: "aria",
      from_condition: "awake", condition: "asleep",
      required_homeostatic_cues: { fatigue: true },
    }, {
      rule_id: "fixture-explicit-wake-guard", character: "aria",
      from_condition: "asleep", condition: "awake",
      required_homeostatic_cues: { fatigue: false },
    }],
  } };
  return state;
}
{
  const state = world();
  state.event_queue[0].wish = "I want to sleep";
  state.event_queue[0].audible_sound = true;
  assert.equal(adjudicateBodySleep(bodyContext(state)).reason, "body_rule_configuration_missing");
}
for (const mutate of [
  (state) => { delete state.characters.aria.physical_state.homeostatic_cues; },
  (state) => { state.characters.aria.physical_state.homeostatic_cues.fatigue = "true"; },
  (state) => { state.characters.aria.physical_state.homeostatic_cues.fatigue = 1; },
]) {
  const state = configuredBodyWorld();
  mutate(state);
  state.characters.aria.energy_state = 0;
  state.event_queue[0].audible_sound = true;
  const before = structuredClone(state);
  const result = adjudicateBodySleep(bodyContext(state));
  assert.equal(result.reason, "body_cue_evidence_unavailable");
  assert.equal(result.state_transition, null);
  assert.equal(result.adjudication, null);
  assert.deepEqual(state, before);
}
{
  const state = configuredBodyWorld();
  state.characters.aria.physical_state.homeostatic_cues.fatigue = false;
  assert.equal(adjudicateBodySleep(bodyContext(state)).reason, "body_rule_guard_not_satisfied");
  state.world_rules.sleep_arousal.rules[0].character = "bystander";
  assert.equal(adjudicateBodySleep(bodyContext(state)).reason, "body_rule_not_configured_for_transition");
}
for (const alter of [
  (config) => { config.version = "unsupported"; },
  (config) => { config.rules[0].required_homeostatic_cues = {}; },
  (config) => { config.rules[0].required_homeostatic_cues = { energy: true }; },
  (config) => { config.rules[0].required_homeostatic_cues.fatigue = "true"; },
  (config) => { config.rules[0].private_override = true; },
  (config) => { config.rules[0].from_condition = "asleep"; },
  (config) => { config.rules[1].rule_id = config.rules[0].rule_id; },
  (config) => { config.rules = Array.from({ length: 65 }, (_, i) =>
    ({ ...config.rules[0], rule_id: `rule-${i}` })); },
]) {
  const state = configuredBodyWorld();
  alter(state.world_rules.sleep_arousal);
  const result = adjudicateBodySleep(bodyContext(state));
  assert.equal(result.reason, "body_rule_configuration_invalid");
  assert.equal(result.state_transition, null);
}
{
  const state = configuredBodyWorld();
  state.world_rules.sleep_arousal.rules.push({
    ...structuredClone(state.world_rules.sleep_arousal.rules[0]), rule_id: "conflict",
  });
  assert.equal(adjudicateBodySleep(bodyContext(state)).reason, "conflicting_body_rules");
  assert.equal(adjudicateBodySleep(bodyContext(state, 4, 499)).reason, "beyond_resolved_horizon");
}
{
  const state = configuredBodyWorld();
  state.characters.aria.physical_state.incapacitated = true;
  state.characters.aria.physical_state.injuries = [{ severity: 2 }];
  const before = structuredClone(state);
  const context = bodyContext(state);
  const result = adjudicateBodySleep(context);
  assert.equal(result.status, "transition_adjudicated");
  assert.equal(result.adjudication.source_world_revision, 4);
  assert.equal(result.adjudication.source_world_state_hash, context.world_state_hash);
  assert.equal(result.adjudication.prior_condition, "awake");
  assert.equal(result.adjudication.evidence[0].value, true);
  assert.deepEqual(adjudicateBodySleep(context), result, "deterministic replay");
  assert.equal(assertBodySleep({ result, ...context }), true);
  for (const alter of [
    (r) => { r.adjudication.rule_id = "forged"; },
    (r) => { r.adjudication.evidence[0].character = "bystander"; },
    (r) => { r.adjudication.source_world_revision = 3; },
    (r) => { r.state_transition.to.condition = "awake"; },
  ]) {
    const forged = structuredClone(result);
    alter(forged);
    assert.throws(() => assertBodySleep({ result: forged, ...context }),
      { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" });
  }
  assert.throws(() => assertBodySleep({ result, ...context, world_state_revision: 5 }),
    { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" });
  assert.throws(() => adjudicateBodySleep({ ...context, world_state_hash: "stale" }),
    { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" });
  assert.throws(() => adjudicateBodySleep({ ...context, event: { ...context.event, event_id: "other" } }),
    { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" });
  const asleep = exercise(state, result.state_transition);
  asleep.simulation_time = new Date(Date.parse(state.simulation_time) + 1000).toISOString();
  asleep.event_queue[0] = {
    event_id: "body-rule-wake", scene_id: "room",
    sleep_arousal_transition: { character: "aria", condition: "awake", time_ms: 100 },
  };
  const missingWakeEvidence = structuredClone(asleep);
  delete missingWakeEvidence.characters.aria.physical_state.homeostatic_cues.fatigue;
  missingWakeEvidence.event_queue[0].audible_sound = true;
  assert.equal(adjudicateBodySleep(bodyContext(missingWakeEvidence, 5, 100)).status, "unresolved");
  asleep.characters.aria.physical_state.homeostatic_cues.fatigue = false;
  const wake = adjudicateBodySleep(bodyContext(asleep, 5, 100));
  assert.equal(wake.status, "transition_adjudicated");
  assert.equal(wake.adjudication.evidence[0].value, false);
  const awake = exercise(asleep, wake.state_transition);
  assert.equal(awake.characters.aria.physical_state.incapacitated, true);
  assert.deepEqual(awake.characters.aria.physical_state.injuries, [{ severity: 2 }]);
  assert.deepEqual(state, before, "Body solver must not mutate World");
  result.state_transition.from.condition = "asleep";
  assert.deepEqual(state, before, "returned proposal must be detached from World");
}
{
  const state = configuredBodyWorld();
  delete state.event_queue[0].sleep_arousal_transition;
  assert.equal(adjudicateBodySleep(bodyContext(state)).status, "not_requested");
  const unknown = configuredBodyWorld();
  delete unknown.characters.aria.physical_state.sleep_arousal;
  assert.equal(adjudicateBodySleep(bodyContext(unknown)).status, "unresolved");
  unknown.world_rules.sleep_arousal.rules[0].from_condition = "unknown";
  assert.equal(adjudicateBodySleep(bodyContext(unknown)).status, "transition_adjudicated");
}


// Queue transport retains a detached receipt and hashes it into the queue.
// Legacy C1 structural previews remain available; actual commit requires proof.
{
  const state = configuredBodyWorld();
  const context = bodyContext(state);
  const result = adjudicateBodySleep(context);
  const mutation = bindBodyMutation({ result, ...context });
  const queue = queueFor([mutation]);
  assert.deepEqual(queue.batches[0].mutations[0].body_sleep_adjudication, result.adjudication);
  mutation.body_sleep_adjudication.evidence[0].value = false;
  assert.equal(queue.batches[0].mutations[0].body_sleep_adjudication.evidence[0].value, true);
  exercise(state, bindBodyMutation({ result, ...context }));
  for (const alter of [
    (m) => { m.body_sleep_adjudication = null; },
    (m) => { m.body_sleep_adjudication.evidence[0].character = "bystander"; },
    (m) => { m.body_sleep_adjudication.evidence[0].value = false; },
    (m) => { m.body_sleep_adjudication.source_world_state_hash = "forged"; },
    (m) => { m.body_sleep_adjudication.prior_record_hash = "forged"; },
    (m) => { m.body_sleep_adjudication.rule_id = "forged"; },
    (m) => { m.body_sleep_adjudication.extra = true; },
  ]) {
    const invalid = bindBodyMutation({ result, ...context });
    alter(invalid);
    assert.notEqual(queueFor([invalid]).queue_hash, queue.queue_hash);
    rejectTransition(state, invalid);
  }
  const changedCue = structuredClone(state);
  changedCue.characters.aria.physical_state.homeostatic_cues.fatigue = false;
  rejectTransition(changedCue, bindBodyMutation({ result, ...context }));
  const unconfigured = structuredClone(state);
  delete unconfigured.world_rules.sleep_arousal;
  rejectTransition(unconfigured, bindBodyMutation({ result, ...context }));
}


import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";

async function nativeBodyScenario(label, alter, expectedReason, cycle = false) {
  const root = path.join(projectRoot, "tests", ".tmp", `c6-native-${label}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const initial = configuredBodyWorld();
    initial.characters.aria.physical_state.incapacitated = true;
    initial.characters.aria.physical_state.injuries = [{ severity: 2 }];
    initial.characters.aria.known = [];
    initial.characters.aria.current_goal = "保留既有關切";
    initial.characters.keeper = { known: [], current_goal: "短暫停留", physical_state: {} };
    initial.memories = { aria: [], keeper: [] };
    initial.available_actions = {
      aria: [], keeper: [{ action_id: "bounded-rest", intent: "留在原地", duration_ms: 500 }],
    };
    initial.scenes.room.scene_id = "room";
    initial.scenes.room.simulation_time = initial.simulation_time;
    initial.scenes.room.dimensions = { width_m: 8, depth_m: 8 };
    initial.scenes.room.entity_positions.keeper = { x: 2, y: 1 };
    initial.scenes.room.observable_by = { aria: { visual: [], audible: [] }, keeper: { visual: [], audible: [] } };
    Object.assign(initial.event_queue[0], {
      participants: ["aria", "keeper"], type: "bounded_body_request", summary: "短暫停留",
    });
    if (cycle) {
      // An explicit fixture rule, not a simulated cue change or wake threshold.
      initial.world_rules.sleep_arousal.rules[1].required_homeostatic_cues.fatigue = true;
      initial.event_queue[0].next_events = [{
        event_id: "native-body-wake", scene_id: "room", participants: ["aria", "keeper"],
        type: "bounded_body_request", summary: "接續短暫停留",
        sleep_arousal_transition: { character: "aria", condition: "awake", time_ms: 500 },
      }];
    }
    alter(initial);
    const session = await beginWorldSimulationSession({
      simulation_label: "C6 Native configured Body lifecycle", seed: label,
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const runtimeManager = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (name) => ({
        entity_id: `character_${name}`, canonical_name: name,
        identity_source: "c6_native_fixture", formal: true,
      }),
    });
    let brainCalls = 0;
    const turnOptions = {
      ...nativeOptions, characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        brainCalls += 1;
        const raw = JSON.stringify(packet);
        for (const privateValue of [
          "body_sleep_adjudication", bodyRuleVersion,
          "fixture-explicit-sleep-guard", "fixture-explicit-wake-guard",
        ]) assert.equal(raw.includes(privateValue), false, "Body authority must remain engine-private");
        return packet.character === "keeper" ? { action_id: "bounded-rest" } : "reject_all";
      },
    };
    const before = await getWorldSimulationState(sid, nativeOptions);
    assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, turnOptions)).committed, true);
    const after = await getWorldSimulationState(sid, nativeOptions);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    const turn = history.turns[0];
    const audit = turn.pure_proposal_producers.audits.find((item) => item.producer === "body_sleep_arousal");
    assert.ok(audit);
    assert.equal(audit.body_sleep_resolution.reason, expectedReason);
    assert.equal(audit.producer_return_contains_world_state, false);
    assert.equal(audit.hidden_preview_writes_rejected_before_return, true);
    assert.equal(turn.pure_proposal_producers.audit_count, 6);
    const sleep = turn.state_transitions.find((item) => item.field === "physical_state.sleep_arousal");
    const accepted = expectedReason === "configured_body_guard_accepted";
    assert.equal(Boolean(sleep), accepted);
    assert.equal(after.state.characters.aria.physical_state.sleep_arousal.condition, accepted ? "asleep" : "awake");
    assert.equal(Date.parse(after.state.simulation_time) - Date.parse(before.state.simulation_time), 500);
    assert.equal(after.state.characters.aria.physical_state.incapacitated, true);
    assert.deepEqual(after.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
    assert.equal(turn.causal_timeline.entries.filter((item) => item.kind === "sleep_arousal_transition").length, accepted ? 1 : 0);
    const { timeline_hash, ...timeline } = turn.causal_timeline;
    assert.equal(timeline_hash, hashAgentRunValue(timeline));
    if (accepted) {
      assert.equal(sleep.body_sleep_adjudication.source_world_revision, before.revision);
      assert.equal(sleep.body_sleep_adjudication.source_world_state_hash, before.state_hash);
      const queued = turn.chronological_mutation_queue.batches.flatMap((batch) => batch.mutations)
        .find((item) => item.field === "physical_state.sleep_arousal");
      assert.deepEqual(queued.body_sleep_adjudication, sleep.body_sleep_adjudication);
      const replayInput = {
        turn_id: turn.turn_id, world_state: before.state,
        world_state_revision: before.revision, world_state_hash: before.state_hash,
        event: turn.event, selected_action_intents: turn.selected_action_intents,
      };
      const replay = await adjudicateWorldSimulationCausality(replayInput);
      assert.deepEqual(replay.state_transitions.find((item) => item.field === sleep.field), sleep);
      assert.deepEqual((await adjudicateWorldSimulationCausality(replayInput)).causal_timeline, replay.causal_timeline);
    } else {
      assert.deepEqual(after.state.characters.aria.physical_state, before.state.characters.aria.physical_state);
    }
    if (cycle) {
      assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, turnOptions)).committed, true);
      const final = await getWorldSimulationState(sid, nativeOptions);
      const all = await getWorldSimulationHistory(sid, nativeOptions);
      assert.equal(all.turns.length, 2);
      const wake = all.turns[1].state_transitions.find((item) => item.field === "physical_state.sleep_arousal");
      assert.deepEqual(wake.from, sleep.to);
      assert.equal(wake.to.condition, "awake");
      assert.equal(wake.to.since_time_ms, Date.parse(before.state.simulation_time) + 1000);
      assert.equal(wake.body_sleep_adjudication.source_world_revision, 1);
      assert.equal(final.state.characters.aria.physical_state.incapacitated, true);
      assert.deepEqual(final.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
    }
    assert.ok(brainCalls > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
await nativeBodyScenario("cycle", () => {}, "configured_body_guard_accepted", true);
await nativeBodyScenario("unconfigured", (state) => {
  delete state.world_rules.sleep_arousal;
  state.event_queue[0].wish = "I want to sleep"; state.event_queue[0].audible_sound = true;
}, "body_rule_configuration_missing");
await nativeBodyScenario("false-guard", (state) => {
  state.characters.aria.physical_state.homeostatic_cues.fatigue = false;
}, "body_rule_guard_not_satisfied");
await nativeBodyScenario("missing-cue", (state) => {
  delete state.characters.aria.physical_state.homeostatic_cues.fatigue;
}, "body_cue_evidence_unavailable");
await nativeBodyScenario("conflict", (state) => {
  state.world_rules.sleep_arousal.rules.push({
    ...structuredClone(state.world_rules.sleep_arousal.rules[0]), rule_id: "native-conflict",
  });
}, "conflicting_body_rules");
await nativeBodyScenario("beyond-horizon", (state) => {
  state.event_queue[0].sleep_arousal_transition.time_ms = 501;
}, "beyond_resolved_horizon");
await nativeBodyScenario("fractional-tail", (state) => {
  state.available_actions.keeper[0].duration_ms = 500.75;
  state.event_queue[0].sleep_arousal_transition.time_ms = 500.25;
}, "beyond_resolved_horizon");

console.log("CB-C6-C sleep/arousal transition authority regression passed.");
