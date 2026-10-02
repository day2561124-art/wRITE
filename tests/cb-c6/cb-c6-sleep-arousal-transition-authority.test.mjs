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
import {
  arbitrateWorldSimulationGlobalTimeline,
  buildWorldSimulationGlobalCausalTimelineContract,
} from "../../server/src/world-simulation-global-causal-timeline-service.mjs";

async function nativeBodyScenario(label, alter, expectedReason, cycle = false, invalidReceipt = null) {
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
    let forgedAttempts = 0;
    if (invalidReceipt) {
      turnOptions.causalAdjudicator = async (input) => {
        const resolution = await adjudicateWorldSimulationCausality(input);
        const mutation = resolution.state_transitions.find((item) => item.field === "physical_state.sleep_arousal");
        assert.ok(mutation?.body_sleep_adjudication, "fixture must first obtain real Body authority");
        invalidReceipt(mutation);
        forgedAttempts += 1;
        return resolution;
      };
    }
    const before = await getWorldSimulationState(sid, nativeOptions);
    if (invalidReceipt) {
      const paths = worldSimulationStatePaths(sid, nativeOptions);
      const durableBytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
      const originalBytes = await durableBytes();
      await assert.rejects(
        runWorldSimulationTurn({ world_simulation_session_id: sid }, turnOptions),
        { code: "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID" },
      );
      assert.equal(forgedAttempts, 1, "custom adjudicator must actually reach the proof rejection");
      assert.ok(brainCalls > 0);
      assert.deepEqual(await durableBytes(), originalBytes, "Native proof rejection preserves exact state/history bytes");
      assert.deepEqual(await getWorldSimulationState(sid, nativeOptions), before);
      assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 0);
      return;
    }
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
    assert.equal(after.state.characters.aria.physical_state.sleep_arousal?.condition,
      accepted ? "asleep" : before.state.characters.aria.physical_state.sleep_arousal?.condition);
    assert.equal(Object.hasOwn(after.state.characters.keeper.physical_state, "sleep_arousal"), false,
      "ordinary turns must not initialize an unrelated legacy actor as awake or asleep");
    assert.equal(Date.parse(after.state.simulation_time) - Date.parse(before.state.simulation_time), 500);
    assert.equal(after.state.characters.aria.physical_state.incapacitated, true);
    assert.deepEqual(after.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
    assert.equal(turn.causal_timeline.entries.filter((item) => item.kind === "sleep_arousal_transition").length, accepted ? 1 : 0);
    const { timeline_hash, ...timeline } = turn.causal_timeline;
    assert.equal(timeline_hash, hashAgentRunValue(timeline));
    if (accepted) {
      assert.equal(sleep.body_sleep_adjudication.prior_condition,
        before.state.characters.aria.physical_state.sleep_arousal?.condition ?? "unknown");
      assert.equal(sleep.body_sleep_adjudication.prior_record_hash,
        hashAgentRunValue(before.state.characters.aria.physical_state.sleep_arousal ?? null));
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

await nativeBodyScenario("legacy-unknown-unconfigured-prior", (state) => {
  delete state.characters.aria.physical_state.sleep_arousal;
}, "body_rule_not_configured_for_transition");
await nativeBodyScenario("legacy-unknown-explicit-prior", (state) => {
  delete state.characters.aria.physical_state.sleep_arousal;
  state.world_rules.sleep_arousal.rules[0].from_condition = "unknown";
}, "configured_body_guard_accepted");
for (const [label, forge] of [
  ["missing-proof", (mutation) => { delete mutation.body_sleep_adjudication; }],
  ["stale-proof", (mutation) => { mutation.body_sleep_adjudication.source_world_revision += 1; }],
  ["cross-character-proof", (mutation) => { mutation.body_sleep_adjudication.evidence[0].character = "keeper"; }],
]) {
  await nativeBodyScenario(label, () => {}, "configured_body_guard_accepted", false, forge);
}

console.log("CB-C6-C sleep/arousal transition authority regression passed.");

import {
  projectWorldSimulationAutonomousCognitionOpportunities,
  worldSimulationConsciousCognitionAdmissionVersion,
} from "../../server/src/world-simulation-autonomous-cognition-scheduler-service.mjs";
import {
  scheduleWorldSimulationAutonomousCognitionOpportunities,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  motivationalGoalEventSchemaVersion,
  motivationalGoalHistoryReferenceSchemaVersion,
  worldSimulationMotivationGoalIntegrationVersion,
} from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionEvents,
  buildWorldSimulationGoalImplementationIntentionResolverView,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import { projectWorldSimulationEffectiveGoalImplementationIntentionExecution }
  from "../../server/src/world-simulation-goal-implementation-intention-execution-feedback-service.mjs";

function d1Clone(value) { return JSON.parse(JSON.stringify(value)); }
function d1GoalHash(event) { const body = d1Clone(event); delete body.goal_event_hash; return hashAgentRunValue(body); }
function d1GoalRef(event) {
  return {
    schema_version: motivationalGoalHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_event_id: event.goal_event_id,
    goal_event_hash: event.goal_event_hash,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    previous_goal_event_id: event.previous_goal_event_id,
    previous_goal_event_hash: event.previous_goal_event_hash,
    status: event.status,
  };
}
function d1MakeGoalEvent({ character, goalId, turnId, operation, previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation,
    goal_id: goalId,
    goal_kind: "maintain_state",
    domain: "relationships",
    target_descriptor: { label: "keep_companions_safe", context: "academy_conflict" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "self_aspect_source_69d",
      source_event_hash: "self_aspect_hash_69d",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `goal_resolver_${turnId}`,
    previous_goal_event_id: previous?.goal_event_id ?? null,
    previous_goal_event_hash: previous?.goal_event_hash ?? null,
    subjective_not_world_truth: true,
    world_truth_verified: false,
    proposed_is_not_committed: true,
    committed_goal_is_selected_action: false,
    action_plan_generated: false,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    character_brain_direct_write: false,
    status: "motivational_goal_event_recorded",
    goal_event_id: `goal_event_${turnId}`,
  };
  event.goal_event_hash = d1GoalHash(event);
  return event;
}
function d1ExecuteBuilt(world, turnId, layer, built) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}

function d1Fixture(condition) {
  let state = configuredBodyWorld(condition);
  Object.assign(state.characters.aria, { known: [], current_goal: "保留既有關切" });
  Object.assign(state.characters.aria.physical_state, {
    incapacitated: true, injuries: [{ severity: 2 }],
    homeostatic_cues: { fatigue: condition === "awake" },
  });
  state.characters.keeper = { known: [], current_goal: "短暫停留", physical_state: {} };
  state.memories = { aria: [], keeper: [] };
  state.available_actions = {
    aria: [], keeper: [{ action_id: "bounded-rest", intent: "留在原地", duration_ms: 500 }],
  };
  Object.assign(state.scenes.room, {
    scene_id: "room", simulation_time: state.simulation_time,
    dimensions: { width_m: 8, depth_m: 8 },
    observable_by: { aria: { visual: [], audible: [] }, keeper: { visual: [], audible: [] } },
  });
  state.scenes.room.entity_positions.keeper = { x: 2, y: 1 };
  Object.assign(state.event_queue[0], {
    event_id: "d1-configured-body-transition", participants: ["keeper"],
    type: "bounded_body_request", summary: "短暫停留",
    sleep_arousal_transition: {
      character: "aria", condition: condition === "asleep" ? "awake" : "asleep", time_ms: 500,
    },
  });
  const goalId = "c6-d-preserved-goal";
  const proposed = d1MakeGoalEvent({ character: "aria", goalId, turnId: "d1-goal-propose", operation: "propose" });
  const committed = d1MakeGoalEvent({ character: "aria", goalId, turnId: "d1-goal-commit", operation: "commit", previous: proposed });
  state.motivational_goal_events = { [proposed.goal_event_id]: proposed, [committed.goal_event_id]: committed };
  state.motivational_goal_history = [d1GoalRef(proposed), d1GoalRef(committed)];
  const turnId = "d1-form-plan";
  const resolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: state, turn_id: turnId });
  const formed = buildWorldSimulationGoalImplementationIntentionEvents({
    world_state: state, turn_id: turnId,
    implementation_intention_decisions: [{
      character: "aria", goal_id: goalId,
      cue_descriptor: { cue_kind: "obstacle", label: "companion_is_threatened", context: "academy_conflict" },
      response_descriptor: { response_kind: "seek_support", label: "coordinate_with_nearby_ally", context: "planning_only" },
      resolver_view_hash: resolver.resolver_view_hash,
    }],
  });
  state = d1ExecuteBuilt(state, turnId, "goal_implementation_intention", formed);
  const planId = formed.result.implementation_intention_events_created[0].implementation_intention_id;
  const context = {
    aria: {
      idle: true,
      pending_internal_cues: [{ kind: "unresolved_question", source_ref: "d1-pending-concern" }],
      temporal_cues: [{ source_ref: "d1-due-cue", due_at: state.simulation_time }],
      applicable_implementation_intention_ids: [planId],
    },
  };
  return { state, context, planId };
}

// Pure projection covers canonical alias lookup, legacy compatibility and no mutation.
{
  const { state, context } = d1Fixture("asleep");
  state.characters.keeper.physical_state.sleep_arousal = {
    ...d1Clone(state.characters.aria.physical_state.sleep_arousal),
    character: "keeper", condition: "awake",
    source: { kind: "world_initialization", source_id: "initial-keeper" },
  };
  state.characters.legacy = { current_goal: "等待線索", physical_state: {} };
  const input = {
    world_state: state,
    runtime_context_by_character: { ARIA: context.aria, keeper: { idle: true }, legacy: { idle: true } },
  };
  const before = d1Clone(input);
  const projection = projectWorldSimulationAutonomousCognitionOpportunities(input);
  assert.deepEqual(input, before);
  assert.equal(projection.opportunity_count, 2);
  assert.equal(projection.deferred_opportunity_count, 1);
  const pending = projection.deferred_opportunities[0];
  assert.equal(pending.character, "ARIA");
  assert.equal(pending.goal_refs.length, 1);
  assert.equal(pending.plan_refs.length, 1);
  assert.ok(pending.trigger_kinds.includes("unresolved_question"));
  assert.ok(pending.trigger_kinds.includes("explicit_temporal_cue_due"));
  assert.ok(pending.trigger_kinds.includes("implementation_intention_cue_applicable"));
  assert.deepEqual(projectWorldSimulationAutonomousCognitionOpportunities(input), projection);
  assert.equal(projection.conscious_admission_audits.find((item) => item.character === "legacy").condition, "unknown");
  assert.equal(projection.conscious_admission_audits.find((item) => item.character === "legacy").admitted, true);
  const consumed = projectWorldSimulationAutonomousCognitionOpportunities({
    ...input, consumed_opportunity_ids: [pending.opportunity_id],
  });
  assert.equal(consumed.deferred_opportunity_count, 0);
  assert.equal(consumed.opportunity_count, 2);
  const { projection_hash, ...body } = projection;
  assert.equal(projection_hash, hashAgentRunValue(body));
  for (const invalid of [null, { ...d1Clone(state.characters.aria.physical_state.sleep_arousal), character: "keeper" }]) {
    const invalidInput = d1Clone(input);
    invalidInput.world_state.characters.aria.physical_state.sleep_arousal = invalid;
    invalidInput.consumed_opportunity_ids = [pending.opportunity_id];
    const original = d1Clone(invalidInput);
    assert.throws(() => projectWorldSimulationAutonomousCognitionOpportunities(invalidInput),
      { code: "C6B_SLEEP_AROUSAL_RECORD_INVALID" });
    assert.deepEqual(invalidInput, original);
  }
}

async function d1NativeCognition(mode) {
  const root = path.join(projectRoot, "tests", ".tmp", `c6-d1-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const lifecycle = mode === "lifecycle";
    const partial = mode === "partial-stale";
    const { state: initial, context } = d1Fixture(lifecycle ? "asleep" : "awake");
    if (lifecycle) context.keeper = { idle: true };
    if (partial) {
      initial.characters.a = { known_entities: [], current_goal: "保留第一個已完成關切", physical_state: {} };
      initial.memories.a = [];
      context.a = { idle: true };
    }
    const contextBefore = d1Clone(context);
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-D conscious cognition admission", seed: mode, initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const paths = worldSimulationStatePaths(sid, nativeOptions);
    const durableBytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const before = await getWorldSimulationState(sid, nativeOptions);
    const originalBytes = await durableBytes();
    const originalPlans = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
      world_state: before.state,
    }).plans_by_character.aria;
    const runtime = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (name) => ({
        entity_id: `d1_character_${name}`, canonical_name: name, identity_source: "d1_fixture", formal: true,
      }),
    });
    const input = { world_simulation_session_id: sid, runtime_context_by_character: context };
    const scheduled = await scheduleWorldSimulationAutonomousCognitionOpportunities(input, nativeOptions);
    const pending = lifecycle ? scheduled.scheduler_projection.deferred_opportunities[0]
      : scheduled.scheduler_projection.opportunities.find((item) => item.character === "aria");
    assert.ok(pending);
    const packets = [];
    const brain = async (packet) => {
      packets.push(d1Clone(packet));
      const raw = JSON.stringify(packet);
      for (const privateValue of [
        "sleep_arousal", worldSimulationConsciousCognitionAdmissionVersion, bodyRuleVersion,
        "initial-aria", "d1-configured-body-transition", before.state_hash, pending.opportunity_id,
      ]) assert.equal(raw.includes(privateValue), false, "conscious admission remains engine-private");
      return { disposition: "processed_autonomous_cognition_opportunity" };
    };
    const worldTurn = async () => {
      assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, {
        ...nativeOptions, characterRuntimeManager: runtime,
        characterBrain: async () => ({ action_id: "bounded-rest" }),
      })).committed, true);
    };
    if (!lifecycle) {
      const customRuntime = {
        inspectRuntime: async () => ({ current_mind: { character_facing_view: {} } }),
        runCharacterTurn: async ({ character, brain_input, characterBrain }) => {
          if (partial && character === "a") return characterBrain(brain_input);
          if (mode === "incomplete") return {};
          if (mode === "duplicate") {
            await characterBrain(brain_input);
            try { await characterBrain(brain_input); } catch { return {}; }
          } else {
            await worldTurn();
            try { return await characterBrain(brain_input); }
            catch (error) { if (mode === "stale-swallowed") return {}; throw error; }
          }
        },
      };
      const code = mode === "incomplete" ? "C6D_CONSCIOUS_COGNITION_CALLBACK_NOT_COMPLETED"
        : mode === "duplicate" ? "C6D_CONSCIOUS_COGNITION_DUPLICATE_INVOCATION"
          : "C6D_CONSCIOUS_COGNITION_STATE_CHANGED";
      let failedDispatch = null;
      await assert.rejects(dispatchWorldSimulationAutonomousCognitionOpportunities(input, {
        ...nativeOptions, characterRuntimeManager: customRuntime, characterBrain: brain,
      }), (error) => {
        failedDispatch = error;
        assert.equal(error.code, code);
        assert.equal(error.failed_opportunity_id, pending.opportunity_id);
        const consumed = partial
          ? [scheduled.scheduler_projection.opportunities.find((item) => item.character === "a").opportunity_id]
          : mode === "duplicate" ? [pending.opportunity_id] : [];
        assert.deepEqual(error.consumed_opportunity_ids, consumed);
        return true;
      });
      assert.deepEqual(packets.map((packet) => packet.character), partial ? ["a"] : mode === "duplicate" ? ["aria"] : []);
      if (mode === "incomplete" || mode === "duplicate") {
        assert.deepEqual(await durableBytes(), originalBytes);
      } else {
        const after = await getWorldSimulationState(sid, nativeOptions);
        assert.equal(after.revision, before.revision + 1);
        assert.equal(after.state.characters.aria.physical_state.sleep_arousal.condition, "asleep");
        assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 1);
        const retryInput = { ...input, consumed_opportunity_ids: failedDispatch.consumed_opportunity_ids };
        const deferred = await scheduleWorldSimulationAutonomousCognitionOpportunities(retryInput, nativeOptions);
        assert.deepEqual(deferred.scheduler_projection.deferred_opportunities, [pending]);
        const sleepBytes = await durableBytes();
        assert.equal((await dispatchWorldSimulationAutonomousCognitionOpportunities(retryInput, nativeOptions)).dispatch_count, 0);
        assert.deepEqual(await durableBytes(), sleepBytes);
      }
    } else {
      assert.equal(scheduled.scheduler_projection.opportunity_count, 1);
      assert.equal(scheduled.scheduler_projection.deferred_opportunity_count, 1);
      const first = await dispatchWorldSimulationAutonomousCognitionOpportunities(input, {
        ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain,
      });
      assert.deepEqual(packets.map((packet) => packet.character), ["keeper"]);
      assert.equal(first.consumed_opportunity_ids.includes(pending.opportunity_id), false);
      assert.deepEqual(await durableBytes(), originalBytes);
      await worldTurn();
      const awakened = await getWorldSimulationState(sid, nativeOptions);
      assert.equal(awakened.state.characters.aria.physical_state.sleep_arousal.condition, "awake");
      assert.equal(awakened.state.characters.aria.physical_state.incapacitated, true);
      assert.deepEqual(awakened.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
      assert.deepEqual(awakened.state.memories.aria, before.state.memories.aria);
      assert.deepEqual(projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
        world_state: awakened.state,
      }).plans_by_character.aria, originalPlans);
      const wakingInput = { ...input, consumed_opportunity_ids: first.consumed_opportunity_ids };
      const reentry = await scheduleWorldSimulationAutonomousCognitionOpportunities(wakingInput, nativeOptions);
      assert.deepEqual(reentry.scheduler_projection.opportunities, [pending], "actual guarded wake preserves C2 opportunity identity and evidence");
      assert.equal(reentry.scheduler_projection.deferred_opportunity_count, 0);
      const wakingBytes = await durableBytes();
      const second = await dispatchWorldSimulationAutonomousCognitionOpportunities(wakingInput, {
        ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain,
      });
      assert.deepEqual(packets.map((packet) => packet.character), ["keeper", "aria"]);
      assert.deepEqual(second.consumed_opportunity_ids, [pending.opportunity_id]);
      assert.equal((await dispatchWorldSimulationAutonomousCognitionOpportunities({
        ...input, consumed_opportunity_ids: [...first.consumed_opportunity_ids, ...second.consumed_opportunity_ids],
      }, nativeOptions)).dispatch_count, 0);
      assert.deepEqual(await durableBytes(), wakingBytes);
    }
    assert.deepEqual(context, contextBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const mode of ["lifecycle", "stale", "stale-swallowed", "partial-stale", "incomplete", "duplicate"]) {
  await d1NativeCognition(mode);
}
console.log("CB-C6-D1 conscious cognition deferral and pinned dispatch regression passed.");

import { prepareWorldSimulationTurn as d2Prepare, resolveWorldSimulationTurn as d2Resolve }
  from "../../server/src/world-simulation-loop-service.mjs";

async function d2NativeAdmission(mode) {
  const root = path.join(projectRoot, "tests", ".tmp", `c6-d2a-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const stale = mode.startsWith("stale");
    const allAsleep = mode === "all-asleep";
    const { state: initial } = d1Fixture(stale ? "awake" : "asleep");
    initial.event_queue[0].participants = allAsleep ? ["aria"] : ["aria", "keeper"];
    if (allAsleep) initial.event_queue[0].sleep_arousal_transition.time_ms = 0;
    if (mode === "lifecycle") initial.event_queue[0].next_events = [{
      event_id: "d2-awake-ordinary", scene_id: "room", participants: ["aria", "keeper"],
      type: "bounded_ordinary_event", summary: "醒後繼續原本事件",
    }];
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-D2a Native conscious participant admission", seed: mode, initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const paths = worldSimulationStatePaths(sid, nativeOptions);
    const durableBytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const before = await getWorldSimulationState(sid, nativeOptions);
    const beforeBytes = await durableBytes();
    const runtime = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (name) => ({
        entity_id: `d2_character_${name}`, canonical_name: name, identity_source: "d2_fixture", formal: true,
      }),
    });
    const beforeMind = (await runtime.inspectRuntime({
      world_simulation_session_id: sid, character: "aria",
    }, nativeOptions)).current_mind;
    const preparations = [];
    const trackedRuntime = { ...runtime, prepareSpeculativeCurrentMind: async (input, options) => {
      preparations.push(input.character);
      return runtime.prepareSpeculativeCurrentMind(input, options);
    } };
    const packets = [];
    const brain = async (packet) => {
      packets.push(d1Clone(packet));
      const raw = JSON.stringify(packet);
      for (const privateValue of ["sleep_arousal", "conscious_participant_admissions",
        worldSimulationConsciousCognitionAdmissionVersion, bodyRuleVersion, before.state_hash]) {
        assert.equal(raw.includes(privateValue), false, "Native conscious admission stays engine-private");
      }
      return packet.character === "keeper" ? { action_id: "bounded-rest" } : "reject_all";
    };
    const options = { ...nativeOptions, characterRuntimeManager: trackedRuntime, characterBrain: brain };
    if (stale) {
      options.characterRuntimeManager = { ...trackedRuntime,
        runCharacterTurn: async ({ brain_input, characterBrain }) => {
          await runWorldSimulationTurn({ world_simulation_session_id: sid }, {
            ...nativeOptions, characterRuntimeManager: runtime,
            characterBrain: async (packet) => packet.character === "keeper"
              ? { action_id: "bounded-rest" } : "reject_all",
          });
          try { return await characterBrain(brain_input); }
          catch (error) { if (mode === "stale-swallowed") return "reject_all"; throw error; }
        },
      };
      await assert.rejects(runWorldSimulationTurn({ world_simulation_session_id: sid }, options),
        { code: "C6D_NATIVE_CONSCIOUS_STATE_CHANGED" });
      assert.equal(packets.length, 0);
      const after = await getWorldSimulationState(sid, nativeOptions);
      assert.equal(after.revision, before.revision + 1);
      assert.equal(after.state.characters.aria.physical_state.sleep_arousal.condition, "asleep");
      assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 1);
      return;
    }

    const prepared = await d2Prepare({ world_simulation_session_id: sid }, options);
    assert.deepEqual(prepared.decision_packets.map((packet) => packet.character), allAsleep ? [] : ["keeper"]);
    assert.deepEqual(preparations, allAsleep ? [] : ["keeper"]);
    const admission = prepared.conscious_participant_admissions.find((item) => item.character === "aria");
    assert.equal(admission.condition, "asleep");
    assert.equal(admission.admitted, false);
    if (!allAsleep) {
      const legacy = prepared.conscious_participant_admissions.find((item) => item.character === "keeper");
      assert.equal(legacy.condition, "unknown");
      assert.equal(legacy.admitted, true);
    }
    for (const field of ["memory_retrieval_processes", "current_mind_transition_projections",
      "subjective_cognition_projections", "listener_social_interpretation_projections"]) {
      assert.equal(JSON.stringify(prepared[field]).includes('"character":"aria"'), false, field);
    }
    assert.equal(packets.length, 0);
    assert.deepEqual(await durableBytes(), beforeBytes);
    const forged = d1Clone(prepared);
    forged.decision_packets.push({ character: "ARIA", candidate_action_intents: [] });
    forged.conscious_participant_admissions = [{ character: "ARIA", condition: "awake", admitted: true }];
    let adjudications = 0;
    await assert.rejects(d2Resolve(forged, { ARIA: "reject_all" }, {
      ...nativeOptions, causalAdjudicator: async () => { adjudications += 1; throw new Error("must not adjudicate"); },
    }), { code: "C6D_NATIVE_CONSCIOUS_ADMISSION_DENIED" });
    assert.equal(adjudications, 0);
    assert.deepEqual(await durableBytes(), beforeBytes);

    const result = await runWorldSimulationTurn({ world_simulation_session_id: sid }, options);
    assert.equal(result.committed, true);
    assert.deepEqual(packets.map((packet) => packet.character), allAsleep ? [] : ["keeper"]);
    const awakened = await getWorldSimulationState(sid, nativeOptions);
    assert.equal(awakened.state.characters.aria.physical_state.sleep_arousal.condition, "awake");
    assert.equal(Date.parse(awakened.state.simulation_time) - Date.parse(before.state.simulation_time),
      allAsleep ? 0 : 500, "World horizon derives from real physical resolution, never a fabricated sleeping action");
    assert.deepEqual(awakened.state.memories.aria, before.state.memories.aria);
    assert.deepEqual(awakened.state.motivational_goal_events, before.state.motivational_goal_events);
    assert.deepEqual(projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
      world_state: awakened.state,
    }).plans_by_character.aria, projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
      world_state: before.state,
    }).plans_by_character.aria);
    assert.equal(awakened.state.characters.aria.physical_state.incapacitated, true);
    assert.deepEqual(awakened.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
    assert.deepEqual((await runtime.inspectRuntime({
      world_simulation_session_id: sid, character: "aria",
    }, nativeOptions)).current_mind, beforeMind);
    if (mode === "lifecycle") {
      assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, options)).committed, true);
      assert.deepEqual(packets.map((packet) => packet.character), ["keeper", "aria", "keeper"]);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const mode of ["lifecycle", "all-asleep", "stale", "stale-swallowed"]) await d2NativeAdmission(mode);
console.log("CB-C6-D2a Native participant and ordinary action admission regression passed.");

import { buildWorldSimulationConsciousObserverAdmission }
  from "../../server/src/world-simulation-conscious-observer-admission-service.mjs";
import { runWorldSimulationObserverTickBrainIngress }
  from "../../server/src/world-simulation-observer-tick-brain-ingress-service.mjs";
import { worldSimulationObserverTickPerceptionVersion }
  from "../../server/src/world-simulation-observer-tick-perception-service.mjs";

// Body-only timing proof never relaxes CC-7F/G's complete World-prefix gate.
for (const condition of ["awake", "asleep"]) {
  const { state } = d1Fixture(condition);
  state.event_queue[0].sleep_arousal_transition.time_ms = 125;
  const context = bodyContext(state, 4, 250);
  const mutation = bindBodyMutation({ ...context, result: adjudicateBodySleep(context) });
  const next = d1Clone(state);
  next.simulation_time = new Date(Date.parse(state.simulation_time) + 250).toISOString();
  next.characters.aria.physical_state.sleep_arousal = d1Clone(mutation.to);
  const input = { ...context, next_world_state: next, state_transitions: [mutation], committed_history: { turns: [] } };
  const original = d1Clone(input);
  const admission = buildWorldSimulationConsciousObserverAdmission(input);
  assert.equal(admission.at("ARIA", 124).admitted, condition === "awake");
  assert.equal(admission.at("ARIA", 125).admitted, condition === "asleep");
  assert.equal(admission.at("aria", 250).admitted, condition === "asleep");
  assert.equal(admission.at("aria", 250.75).admitted, condition === "asleep",
    "fractional acoustic releases retain precision within the truncated World clock bucket");
  assert.equal(admission.at("keeper", 125).condition, "unknown");
  assert.throws(() => admission.at("aria", 251), { code: "C6D_CONSCIOUS_OBSERVER_ADMISSION_INVALID" });
  const sources = [124, 125, 250].map((release_time_ms) => ({
    schema_version: worldSimulationObserverTickPerceptionVersion,
    observer: "aria", release_time_ms, visual: [], heard_nonlexical: [],
    world_truth_authority: false, future_release_exposed: false, world_snapshot_exposed: false,
  }));
  const perception = {
    audit: { schema_version: worldSimulationObserverTickPerceptionVersion,
      status: "observer_views_engine_private", character_view_count: 3, tick_count: 3,
      ticks: sources.map((view) => ({ release_time_ms: view.release_time_ms, observer_view_count: 1 })),
    },
    engine_private_character_views: sources,
  };
  const sourceCopy = d1Clone(perception);
  const seen = [];
  const filtered = admission.filterPerception(perception);
  const ingress = await runWorldSimulationObserverTickBrainIngress({
    perception: filtered, resolver: async (packet) => {
      seen.push(packet.release_time_ms);
      assert.equal(JSON.stringify(packet).includes("sleep_arousal"), false);
      return { noticing_status: "no_noticing", attended_senses: [] };
    },
  });
  assert.deepEqual(seen, condition === "awake" ? [124] : [125, 250]);
  assert.equal(ingress.invocation_count, seen.length);
  assert.equal(filtered.audit.character_view_count, seen.length);
  assert.deepEqual(perception, sourceCopy);
  assert.deepEqual(input, original);
  const forged = d1Clone(input);
  forged.state_transitions[0].time_ms = 124;
  assert.throws(() => buildWorldSimulationConsciousObserverAdmission(forged));
  const missingProof = d1Clone(input);
  delete missingProof.state_transitions[0].body_sleep_adjudication;
  assert.throws(() => buildWorldSimulationConsciousObserverAdmission(missingProof));
}

async function d2bNativeObserver(mode) {
  const root = path.join(projectRoot, "tests", ".tmp", `c6-d2b-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const wakes = mode.startsWith("wake") || mode === "stale";
    const startsAsleep = wakes || mode === "asleep";
    const { state: initial } = d1Fixture(startsAsleep ? "asleep" : "awake");
    const boundary = mode.endsWith("equal") ? 250 : 125;
    Object.assign(initial.event_queue[0], { type: "conversation", participants: ["aria", "keeper"] });
    if (mode === "awake" || mode === "asleep") delete initial.event_queue[0].sleep_arousal_transition;
    else initial.event_queue[0].sleep_arousal_transition.time_ms = boundary;
    initial.scenes.room.audibility_profiles = { aria: { minimum_audible_db: 30 } };
    const semantic = "男孩已離開房子";
    Object.assign(initial.characters.keeper, {
      known: [semantic], speech_acoustics: { sound_level_db_at_1m: 60 },
      communication_goal: {
        character: "keeper", purpose: "告知", addressee: "aria", mode: "direct",
        public_content: semantic, claim_kind: "sincere_assertion",
        surface_realization: { schema_version: "cc5-mandarin-clause-request-v1", semantic_anchor: semantic,
          clause: { subject: "男孩", predicate: "離開", aspect_particle: "了", object: "房子" } },
      },
    });
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-D2b release-time conscious observer admission", seed: mode,
      rules: { ...initial.world_rules, event_driven: true, persistent_causality: true,
        communication_action_seconds: 0.25, communication_speech_stream_increment_max_chars: 3 },
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, nativeOptions);
    const runtime = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (name) => ({
        entity_id: `d2b_character_${name}`, canonical_name: name, identity_source: "d2b_fixture", formal: true,
      }),
    });
    const brain = async (packet) => {
      if (packet.character !== "keeper") return "reject_all";
      const candidate = packet.candidate_action_intents.find((item) => item.communication?.surface_realization_complete === true);
      assert.ok(candidate, "fixture must select real, bounded Mandarin speech");
      return { action_id: candidate.action_id };
    };
    const lexical = [], meanings = [], turns = [], perceptions = [];
    const options = {
      ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain,
      characterObserverTickPerceptionResolver: async (packet) => {
        perceptions.push(d1Clone(packet));
        return { noticing_status: "no_noticing", attended_senses: [] };
      },
      characterCommunicationLexicalIncrementResolver: async (packet) => {
        lexical.push(d1Clone(packet));
        for (const secret of ["sleep_arousal", "body_sleep_adjudication", before.state_hash])
          assert.equal(JSON.stringify(packet).includes(secret), false);
        if (mode === "stale" && lexical.length === 1)
          await runWorldSimulationTurn({ world_simulation_session_id: sid }, {
            ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain,
          });
        return { recognition_status: "recognized", heard_surface_fragment: packet.emitted_surface_fragment };
      },
      characterCommunicationIncrementalMeaningResolver: async (packet) => {
        meanings.push(d1Clone(packet));
        assert.equal(packet.heard_surface_prefix,
          meanings.map((item) => item.current_heard_surface_fragment).join(""),
          "sleeping fragments must never enter the later meaning prefix");
        return { interpretation_status: "partial", interpreted_content: packet.heard_surface_prefix,
          interpreted_interaction_function: "ongoing_statement_candidate", understanding_attested: false };
      },
      characterCommunicationTurnIncrementResolver: async (packet) => {
        turns.push(d1Clone(packet));
        return { listener_decision: { turn_end_projection: "uncertain",
          projection_basis_refs: [], response_preparation: "none" } };
      },
    };
    if (mode === "stale") {
      await assert.rejects(runWorldSimulationTurn({ world_simulation_session_id: sid }, options),
        { code: "C6D_NATIVE_CONSCIOUS_STATE_CHANGED" });
      assert.equal(lexical.length, 1);
      assert.equal(meanings.length, 0);
      assert.equal(turns.length, 0);
      assert.equal((await getWorldSimulationState(sid, nativeOptions)).revision, before.revision + 1);
      assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 1);
      return;
    }
    assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, options)).committed, true);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    const receipts = history.turns[0].communication_observer_increment_admissions
      .filter((item) => item.observer === "aria" && item.admission_status === "heard_acoustic_cues_only");
    assert.ok(receipts.length > 1, "physical sleeping acoustic receipts must remain intact");
    const permitted = (time) => mode === "asleep" ? false : mode === "awake" ? true
      : wakes ? time >= boundary : time < boundary;
    const expected = receipts.filter((item) => permitted(item.release_time_ms)).map((item) => item.release_time_ms);
    assert.deepEqual(lexical.map((item) => item.release_time_ms), expected);
    assert.deepEqual(meanings.map((item) => item.release_time_ms), expected);
    assert.deepEqual(turns.map((item) => item.release_time_ms), expected);
    assert.ok(perceptions.every((item) => permitted(item.release_time_ms)));
    const after = await getWorldSimulationState(sid, nativeOptions);
    assert.equal(Date.parse(after.state.simulation_time) - Date.parse(before.state.simulation_time), 250);
    assert.equal(after.state.characters.aria.physical_state.sleep_arousal.condition,
      mode === "asleep" || mode.startsWith("sleep") ? "asleep" : "awake");
    assert.equal(after.state.characters.aria.physical_state.incapacitated, true);
    assert.deepEqual(after.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
    assert.deepEqual(after.state.motivational_goal_events, before.state.motivational_goal_events);
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const mode of ["asleep", "awake", "wake", "sleep", "wake-equal", "sleep-equal", "stale"])
  await d2bNativeObserver(mode);
console.log("CB-C6-D2b post-causal conscious observer admission regression passed.");

function d2cSpeechGoal(character, addressee) {
  const semantic = "男孩已離開房子";
  return {
    character, addressee, purpose: "告知", mode: "direct",
    public_content: semantic, claim_kind: "sincere_assertion",
    surface_realization: { schema_version: "cc5-mandarin-clause-request-v1", semantic_anchor: semantic,
      clause: { subject: "男孩", predicate: "離開", aspect_particle: "了", object: "房子" } },
  };
}
async function d2cNativeIngress(mode) {
  const root = path.join(projectRoot, "tests", ".tmp", `c6-d2c-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const speaker = mode.startsWith("speaker");
    const initiallyAsleep = mode === "native-initial-asleep";
    const { state: initial } = d1Fixture(initiallyAsleep ? "asleep" : "awake");
    initial.characters.aria.physical_state.incapacitated = false;
    Object.assign(initial.event_queue[0], { type: "conversation", participants: ["aria", "keeper"] });
    const sleepBoundary = mode === "native-sleep-mid" || mode === "speaker-sleep" ? 200
      : mode === "speaker-sleep-before" ? 0 : 125;
    initial.event_queue[0].sleep_arousal_transition.time_ms =
      mode === "native-sleep-before" ? 0 : sleepBoundary;
    if (mode === "speaker-awake" || mode === "speaker-stale" || mode === "native-awake"
        || mode.startsWith("native-stale"))
      delete initial.event_queue[0].sleep_arousal_transition;
    initial.scenes.room.audibility_profiles = { aria: { minimum_audible_db: 30 }, keeper: { minimum_audible_db: 30 } };
    Object.assign(initial.characters.keeper, {
      known: ["男孩已離開房子"], speech_acoustics: { sound_level_db_at_1m: 60 },
      communication_goal: d2cSpeechGoal("keeper", "aria"),
    });
    if (mode.startsWith("speaker-sleep")) {
      initial.characters.keeper.physical_state = {
        sleep_arousal: { ...d1Clone(initial.characters.aria.physical_state.sleep_arousal),
          character: "keeper", source: { kind: "world_initialization", source_id: "initial-keeper" } },
        homeostatic_cues: { fatigue: true },
      };
      initial.world_rules.sleep_arousal.rules.push({
        rule_id: "d2c-keeper-sleep", character: "keeper", from_condition: "awake", condition: "asleep",
        required_homeostatic_cues: { fatigue: true },
      });
      initial.event_queue[0].sleep_arousal_transition = {
        character: "keeper", condition: "asleep", time_ms: sleepBoundary,
      };
    }
    if (mode === "speaker-stale") Object.assign(initial.characters.aria, {
      known: ["男孩已離開房子"], speech_acoustics: { sound_level_db_at_1m: 60 },
      communication_goal: d2cSpeechGoal("aria", "keeper"),
    });
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-D2c conscious speaker and Native temporal ingress", seed: mode,
      rules: { ...initial.world_rules, event_driven: true, persistent_causality: true,
        communication_action_seconds: 0.25, communication_speech_stream_increment_max_chars: 3 },
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, nativeOptions);
    const runtime = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (name) => ({
        entity_id: `d2c_character_${name}`, canonical_name: name, identity_source: "d2c_fixture", formal: true,
      }),
    });
    const brain = async (packet) => {
      if (packet.character !== "keeper" && mode !== "speaker-stale") return "reject_all";
      const candidate = packet.candidate_action_intents.find((item) => item.communication?.surface_realization_complete === true);
      assert.ok(candidate);
      return { action_id: candidate.action_id };
    };
    const advance = () => runWorldSimulationTurn({ world_simulation_session_id: sid }, {
      ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain,
    });
    const calls = { speaker: [], preparation: [], input: [], selection: [] };
    function capture(kind, packet) {
      calls[kind].push(d1Clone(packet));
      for (const secret of ["sleep_arousal", "body_sleep_adjudication", before.state_hash])
        assert.equal(JSON.stringify(packet).includes(secret), false, "Body proof and World CAS remain private");
    }
    const options = { ...nativeOptions, characterRuntimeManager: runtime, characterBrain: brain };
    if (speaker) options.characterCommunicationSpeakerNextTurnResolver = async (packet) => {
      capture("speaker", packet);
      if (mode === "speaker-stale" && calls.speaker.length === 1) await advance();
      return { mode: "nominate_addressee", target: packet.current_public_addressee };
    };
    else Object.assign(options, {
      characterNativeTemporalResponseObserver: "aria",
      characterNativeTemporalResponsePreparationResolver: async (packet) => {
        capture("preparation", packet);
        if (mode === "native-stale-preparation") await advance();
        return { epoch_id: packet.epoch_id, decision: mode === "native-sleep-mid" ? "wait" : "select_response" };
      },
      characterNativeTemporalResponseInputResolver: async (packet) => {
        capture("input", packet);
        if (mode === "native-stale-input") await advance();
        return { character: "aria", cognition: { communication_goal: d2cSpeechGoal("aria", "keeper") } };
      },
      characterNativeTemporalResponseSelectionResolver: async (packet) => {
        capture("selection", packet);
        return { epoch_id: packet.epoch_id, reject_all: true };
      },
    });
    if (mode.includes("stale")) {
      await assert.rejects(runWorldSimulationTurn({ world_simulation_session_id: sid }, options),
        { code: "C6D_NATIVE_CONSCIOUS_STATE_CHANGED" }).catch((error) => {
          error.message += ` mode=${mode} callbacks=${JSON.stringify(Object.fromEntries(
            Object.entries(calls).map(([kind, packets]) => [kind, packets.length])))}`;
          error.stack += `\n${error.message}`;
          throw error;
        });
      assert.equal(calls.speaker.length, speaker ? 1 : 0);
      assert.equal(calls.preparation.length, speaker ? 0 : 1);
      assert.equal(calls.input.length, mode === "native-stale-input" ? 1 : 0);
      assert.equal(calls.selection.length, 0);
      assert.equal((await getWorldSimulationState(sid, nativeOptions)).revision, before.revision + 1);
      assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 1);
      return;
    }
    assert.equal((await runWorldSimulationTurn({ world_simulation_session_id: sid }, options)).committed, true);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    const turn = history.turns[0];
    const receipts = turn.communication_observer_increment_admissions
      .filter((item) => item.observer === "aria" && item.admission_status === "heard_acoustic_cues_only");
    if (!mode.startsWith("speaker-sleep"))
      assert.ok(receipts.length > 1, "listener sleep must not retract physical speech already emitted by an awake speaker");
    if (speaker) {
      assert.equal(calls.speaker.length, mode.startsWith("speaker-sleep") ? 0 : 1);
      const speechOutcome = turn.action_outcomes.find((item) =>
        item.actor === "keeper" && item.result === "communication_emitted");
      assert.ok(speechOutcome, "post-causal admission must preserve the already resolved speech action");
      if (mode.startsWith("speaker-sleep")) {
        const stream = speechOutcome.communication_speech_stream;
        const released = turn.causal_timeline.entries.filter((item) =>
          item.kind === "communication_speech_increment"
          && item.action_id === speechOutcome.action_id);
        const interrupted = turn.causal_timeline.entries.filter((item) =>
          item.kind === "communication_speech_interrupted"
          && item.action_id === speechOutcome.action_id);
        assert.equal(interrupted.length, 1);
        assert.equal(interrupted[0].time_ms, sleepBoundary);
        assert.equal(interrupted[0].released_increment_count, released.length);
        assert.equal(interrupted[0].cancelled_future_increment_count,
          stream.increment_count - released.length);
        assert.equal(interrupted[0].original_increment_count, stream.increment_count);
        assert.equal(speechOutcome.communication_speech_interruption.released_increment_count,
          released.length);
        assert.equal(speechOutcome.communication_speech_interruption.cancelled_future_increment_count,
          stream.increment_count - released.length);
        assert.equal(speechOutcome.communication_speech_interruption.already_released_increment_retracted, false);
        assert.equal(speechOutcome.communication_speech_interruption.full_selected_surface_rewritten, false);
        assert.deepEqual(receipts.map((item) => item.release_time_ms),
          released.map((item) => item.time_ms),
          "observer receipts must exist only for actually released pre-sleep increments");
        if (mode === "speaker-sleep-before") {
          assert.equal(released.length, 0);
          assert.equal(receipts.length, 0);
          assert.equal(speechOutcome.communication_acoustic_signal.registered, false);
          assert.equal(speechOutcome.communication_acoustic_signal.reason,
            "no_speech_increment_released_before_body_sleep");
        } else {
          assert.ok(released.length > 0 && released.length < stream.increment_count);
          assert.equal(speechOutcome.communication_acoustic_signal.registered, true);
          assert.ok(released.every((item) => item.time_ms <= sleepBoundary + 1e-9));
          assert.ok(stream.increments
            .filter((item) => (item.release_time_ms ?? item.end_offset_ms) > sleepBoundary + 1e-9)
            .every((item) => !released.some((entry) => entry.increment_ref === item.increment_ref)));
        }
      }
    } else {
      const admitted = mode === "native-sleep-mid" ? receipts.filter((item) => item.release_time_ms < sleepBoundary) : receipts;
      if (mode === "native-sleep-mid") assert.ok(admitted.length > 0 && admitted.length < receipts.length,
        "fixture must include genuine conscious releases before sleep and physical releases after sleep");
      const expectedPreparation = mode === "native-initial-asleep" || mode === "native-sleep-before" ? []
        : mode === "native-sleep-mid" ? admitted.map((item) => item.release_time_ms) : [receipts[0].release_time_ms];
      assert.deepEqual(calls.preparation.map((item) => item.release_time_ms), expectedPreparation);
      assert.equal(calls.input.length, mode === "native-awake" ? 1 : 0);
      assert.equal(calls.selection.length, mode === "native-awake" ? 1 : 0);
      assert.equal(Object.hasOwn(turn, "native_temporal_choice_evidence"), false,
        "sleep admission cannot fabricate an initial rejection or selected response");
    }
    const after = await getWorldSimulationState(sid, nativeOptions);
    assert.equal(Date.parse(after.state.simulation_time) - Date.parse(before.state.simulation_time), 250);
    assert.equal(after.state.characters.aria.physical_state.sleep_arousal.condition,
      mode.startsWith("native-sleep") ? "asleep" : "awake");
    if (mode.startsWith("speaker-sleep"))
      assert.equal(after.state.characters.keeper.physical_state.sleep_arousal.condition, "asleep");
    assert.deepEqual(after.state.motivational_goal_events, before.state.motivational_goal_events);
    assert.deepEqual(after.state.characters.aria.physical_state.injuries, [{ severity: 2 }]);
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const mode of ["speaker-awake", "speaker-sleep", "speaker-sleep-before", "speaker-stale",
  "native-initial-asleep", "native-awake", "native-sleep-before", "native-sleep-mid",
  "native-stale-preparation", "native-stale-input"])
  await d2cNativeIngress(mode);
console.log("CB-C6-D2c conscious speaker and Native temporal ingress regression passed.");

// CB-C6-D3a: canonically adjudicated Body sleep is a same-turn physical
// actor-state interruption. It reuses the Phase62G/62I fixed-point and
// trajectory machinery; it does not truncate CC-7B speech streams here.
function d3aTimelineWorld({
  condition = "awake",
  transitionCondition = "asleep",
  transitionTimeMs = 100,
} = {}) {
  const state = configuredBodyWorld(condition);
  Object.assign(state.world_rules, {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    default_movement_speed_mps: 8,
    physics_action_seconds: 1,
    attack_attempt_seconds: 1,
  });
  state.characters.aria.physical_state.homeostatic_cues.fatigue =
    transitionCondition === "asleep";
  Object.assign(state.characters.aria.physical_state, {
    health_current: 100,
    health_max: 100,
    movement_multiplier: 1,
  });
  state.characters.target = {
    physical_state: { health_current: 100, health_max: 100 },
  };
  state.scenes.room = {
    scene_id: "room",
    dimensions: { width_m: 12, depth_m: 4 },
    entity_positions: {
      aria: { x: 1, y: 1 },
      target: { x: 9, y: 1 },
    },
    obstacles: [],
    observable_by: {
      aria: { visual: ["target"], audible: [] },
      target: { visual: ["aria"], audible: [] },
    },
  };
  state.event_queue[0] = {
    event_id: "d3a-" + condition + "-" + transitionCondition + "-" + transitionTimeMs,
    scene_id: "room",
    participants: ["aria", "target"],
    sleep_arousal_transition: {
      character: "aria",
      condition: transitionCondition,
      time_ms: transitionTimeMs,
    },
  };
  state.objects = {
    "d3a-launcher": {
      holder: "aria",
      enabled: true,
      state: "ready",
      ammo: { current: 1 },
      projectile: {
        speed_mps: 20,
        radius_m: 0.05,
        base_damage: 10,
        damage_type: "d3a_test",
        penetration_energy: 20,
        max_lifetime_ms: 1000,
      },
    },
  };
  state.projectiles = {};
  state.ability_fields = {};
  return state;
}

function d3aArbitrate(state, selectedActionIntents, resolvedActionOutcomes = []) {
  return arbitrateWorldSimulationGlobalTimeline({
    world_state: state,
    world_state_revision: 7,
    world_state_hash: hashAgentRunValue(state),
    next_world_state: structuredClone(state),
    scene_id: "room",
    event: structuredClone(state.event_queue[0]),
    turn_id: "c6-d3a-regression",
    selected_action_intents: selectedActionIntents,
    resolved_action_outcomes: resolvedActionOutcomes,
    elapsed_ms: 0,
  });
}

{
  const contract = buildWorldSimulationGlobalCausalTimelineContract();
  assert.equal(contract.ordering.strict_earlier_body_sleep_preempts_later_execution, true);
  assert.equal(contract.ordering.exact_timestamp_ties_are_simultaneous_for_preemption, true);
  assert.equal(contract.ordering.body_sleep_preview_requires_canonical_body_adjudication, true);

  const state = d3aTimelineWorld({ transitionTimeMs: 100 });
  const selected = [{
    character: "aria",
    candidate: {
      action_id: "d3a-delayed-launch",
      intent: "延遲發射",
      duration_ms: 500,
      projectile: {
        weapon_id: "d3a-launcher",
        target_character: "target",
        fire_delay_ms: 300,
      },
    },
  }];
  const arbitration = d3aArbitrate(state, selected);
  assert.ok(arbitration.suppressed_action_ids.includes("d3a-delayed-launch"));
  const preemption = arbitration.preemptions.find((item) =>
    item.action_id === "d3a-delayed-launch");
  assert.ok(preemption);
  assert.equal(preemption.preemption_kind, "sleep_arousal_asleep");
  assert.equal(preemption.preempted_at_ms, 100);
  assert.equal(preemption.scheduled_time_ms, 300);
  assert.equal(preemption.cause, "body_sleep_arousal_transition");
  assert.ok(preemption.transition_id);
  assert.ok(arbitration.cross_layer_event_arbitration.audits.some((audit) =>
    audit.source_layers.includes("body_sleep_arousal")));

  const sameTime = d3aTimelineWorld({ transitionTimeMs: 300 });
  const tied = d3aArbitrate(sameTime, selected);
  assert.equal(tied.suppressed_action_ids.includes("d3a-delayed-launch"), false,
    "same timestamp sleep and execution remain simultaneous rather than retroactive");

  const wake = d3aTimelineWorld({
    condition: "asleep",
    transitionCondition: "awake",
    transitionTimeMs: 100,
  });
  const waking = d3aArbitrate(wake, selected);
  assert.equal(waking.suppressed_action_ids.includes("d3a-delayed-launch"), false,
    "wake transition is not a physical preemption source");
}

{
  const state = d3aTimelineWorld({ transitionTimeMs: 250 });
  const selected = [{
    character: "aria",
    candidate: {
      action_id: "d3a-long-move",
      intent: "持續移動",
      duration_ms: 1000,
      movement: { to: { x: 9, y: 1 } },
    },
  }];
  const arbitration = d3aArbitrate(state, selected, [{
    actor: "aria",
    action_id: "d3a-long-move",
    result: "movement_completed",
    duration_ms: 1000,
    distance_m: 8,
  }]);
  const trajectory = arbitration.actor_trajectories.aria;
  assert.ok(trajectory);
  assert.equal(trajectory.interrupted, true);
  assert.equal(trajectory.interrupted_at_ms, 250);
  assert.equal(trajectory.stop_reason, "body_sleep_arousal_transition");
  assert.ok(trajectory.distance_travelled_m > 0 && trajectory.distance_travelled_m < 8);
  assert.ok(Math.abs(trajectory.final_position.x - 3) < 1e-9);
  assert.equal(arbitration.suppressed_action_ids.includes("d3a-long-move"), false,
    "in-progress movement is truncated at causal position rather than erased");
  const interruption = arbitration.movement_adjustments.find((item) =>
    item.kind === "movement_interrupted" && item.actor === "aria");
  assert.equal(interruption.time_ms, 250);
  assert.equal(interruption.cause, "body_sleep_arousal_transition");
  assert.ok(interruption.transition_id);
}

console.log("CB-C6-D3a Body sleep physical action preemption regression passed.");

import { runWorldSimulationOffscreenEventBatch }
  from "../../server/src/world-simulation-offscreen-event-batch-service.mjs";
import { projectWorldSimulationOffscreenBreakpoint }
  from "../../server/src/world-simulation-offscreen-breakpoint-service.mjs";

for (const budget of [-1, 33, 1.5, null, "1", undefined]) {
  await assert.rejects(runWorldSimulationOffscreenEventBatch({
    world_simulation_session_id: "invalid-budget-never-read", max_turns: budget,
  }), { code: "C6E_OFFSCREEN_BATCH_INVALID" });
}
await assert.rejects(runWorldSimulationOffscreenEventBatch({
  world_simulation_session_id: "unsupported-horizon-never-read", max_turns: 1,
  target_horizon: "2026-10-01T00:00:00Z",
}), { code: "C6E_OFFSCREEN_BATCH_INVALID" });
await assert.rejects(runWorldSimulationOffscreenEventBatch({
  world_simulation_session_id: "custom-adjudicator-never-read", max_turns: 1,
}, { causalAdjudicator: () => ({}) }), { code: "C6E_OFFSCREEN_BATCH_INVALID" });

for (const mode of ["budget-resume", "partial-failure"]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e1-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const { state: initial } = d1Fixture("awake");
    const first = initial.event_queue[0];
    initial.event_queue = [first, ...[2, 3].map(index => {
      const event = d1Clone(first);
      event.event_id = `e1-event-${index}`;
      delete event.sleep_arousal_transition;
      return event;
    })];
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E1 canonical offscreen batch", seed: mode,
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, nativeOptions);
    const runtime = createWorldSimulationCharacterRuntimeManager({
      identityResolver: async name => ({
        entity_id: `e1_character_${name}`, canonical_name: name,
        identity_source: "e1_fixture", formal: true,
      }),
    });
    let brainCalls = 0;
    let failSecond = mode === "partial-failure";
    const options = {
      ...nativeOptions, characterRuntimeManager: runtime,
      characterBrain: async () => {
        brainCalls += 1;
        if (failSecond && brainCalls === 2) throw new Error("e1 deliberate second-turn failure");
        return { action_id: "bounded-rest" };
      },
    };
    const input = { world_simulation_session_id: sid, max_turns: 0 };
    const zero = await runWorldSimulationOffscreenEventBatch(input, options);
    assert.equal(zero.status, "budget_exhausted");
    assert.equal(zero.committed_turn_count, 0);
    assert.equal(zero.reached_simulation_time, before.state.simulation_time);
    assert.equal(zero.pending_event_count, 3);
    assert.equal(brainCalls, 0);
    assert.deepEqual(await getWorldSimulationState(sid, nativeOptions), before);

    let firstBatch;
    if (failSecond) {
      await assert.rejects(runWorldSimulationOffscreenEventBatch({
        ...input, max_turns: 3,
      }, options), error => {
        firstBatch = error.offscreen_batch_progress;
        assert.equal(firstBatch.status, "failed");
        assert.equal(firstBatch.committed_turn_count, 1);
        assert.equal(firstBatch.attempted_turn_count, 2);
        assert.equal(firstBatch.pending_event_id, "e1-event-2");
        assert.equal(firstBatch.automatic_replay_allowed, false);
        return true;
      });
      failSecond = false;
    } else {
      firstBatch = await runWorldSimulationOffscreenEventBatch({
        ...input, max_turns: 2,
      }, options);
      assert.equal(firstBatch.status, "budget_exhausted");
      assert.equal(firstBatch.committed_turn_count, 2);
      assert.equal(firstBatch.pending_event_id, "e1-event-3");
    }
    const middle = await getWorldSimulationState(sid, nativeOptions);
    assert.equal(firstBatch.last_observed_revision, middle.revision);
    assert.equal(firstBatch.last_observed_state_hash, middle.state_hash);
    assert.equal(firstBatch.state_reconciliation_required, false);
    assert.equal(firstBatch.reached_simulation_time, middle.state.simulation_time);
    assert.equal(Date.parse(middle.state.simulation_time) - Date.parse(before.state.simulation_time),
      firstBatch.committed_turn_count * 500);
    assert.equal(middle.state.characters.aria.physical_state.sleep_arousal.condition, "asleep");
    assert.deepEqual(middle.state.characters.aria.physical_state.injuries,
      before.state.characters.aria.physical_state.injuries);
    assert.deepEqual(middle.state.motivational_goal_events, before.state.motivational_goal_events);

    const resumed = await runWorldSimulationOffscreenEventBatch({
      ...input, max_turns: 3 - firstBatch.committed_turn_count,
    }, options);
    assert.equal(resumed.status, "no_pending_event");
    assert.equal(resumed.committed_turn_count, 3 - firstBatch.committed_turn_count);
    assert.equal(resumed.pending_event_count, 0);
    const final = await getWorldSimulationState(sid, nativeOptions);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    assert.equal(history.turns.length, 3);
    assert.deepEqual(history.turns.map(turn => turn.event.event_id),
      initial.event_queue.map(event => event.event_id));
    assert.equal(Date.parse(final.state.simulation_time) - Date.parse(before.state.simulation_time), 1500);
    assert.equal(resumed.reached_simulation_time, final.state.simulation_time);
    assert.equal(resumed.target_horizon_claimed, false);
    assert.equal(resumed.canonical_turn_fidelity_preserved, true);
    assert.equal(resumed.wall_clock_catch_up_used, false);
    const callsBeforeEmpty = brainCalls;
    const empty = await runWorldSimulationOffscreenEventBatch({ ...input, max_turns: 1 }, options);
    assert.equal(empty.committed_turn_count, 0);
    assert.equal(empty.status, "no_pending_event");
    assert.equal(brainCalls, callsBeforeEmpty);
    assert.deepEqual(await getWorldSimulationState(sid, nativeOptions), final);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E1 bounded canonical offscreen event batch regression passed.");

for (const mode of ["concurrent-commit", "unreadable-state"]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e1-report-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  let restoreState = null;
  try {
    const { state: initial } = d1Fixture("awake");
    const second = d1Clone(initial.event_queue[0]);
    second.event_id = "e1-report-second";
    delete second.sleep_arousal_transition;
    initial.event_queue.push(second);
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E1 concurrent failure reporting", seed: mode,
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, nativeOptions);
    const makeRuntime = () => createWorldSimulationCharacterRuntimeManager({
      identityResolver: async name => ({
        entity_id: `e1_report_character_${name}`, canonical_name: name,
        identity_source: "e1_report_fixture", formal: true,
      }),
    });
    const { rename } = await import("node:fs/promises");
    let progress;
    await assert.rejects(runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 2,
    }, {
      ...nativeOptions, characterRuntimeManager: makeRuntime(),
      characterBrain: async () => {
        if (mode === "concurrent-commit") {
          const independentlyCommitted = await runWorldSimulationTurn({
            world_simulation_session_id: sid,
          }, {
            ...nativeOptions, characterRuntimeManager: makeRuntime(),
            characterBrain: async () => ({ action_id: "bounded-rest" }),
          });
          assert.equal(independentlyCommitted.committed, true);
          return { action_id: "bounded-rest" };
        }
        const statePath = worldSimulationStatePaths(sid, nativeOptions).state;
        const savedPath = statePath + ".e1-test-unavailable";
        await rename(statePath, savedPath);
        restoreState = () => rename(savedPath, statePath);
        throw new Error("e1 fixture temporarily cannot read its committed state");
      },
    }), error => {
      progress = error.offscreen_batch_progress;
      assert.equal(progress.status, "failed");
      assert.equal(progress.committed_turn_count, 0);
      assert.equal(progress.attempted_turn_count, 1);
      assert.equal(progress.state_reconciliation_required, true);
      assert.equal(progress.reached_simulation_time, null);
      assert.equal(progress.pending_event_id, null);
      assert.equal(progress.pending_event_count, null);
      assert.equal(progress.automatic_replay_allowed, false);
      return true;
    });
    if (restoreState) { await restoreState(); restoreState = null; }
    const current = await getWorldSimulationState(sid, nativeOptions);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    if (mode === "concurrent-commit") {
      assert.equal(current.revision, before.revision + 1);
      assert.equal(history.turns.length, 1);
      assert.equal(progress.last_observed_revision, current.revision);
      assert.equal(progress.last_observed_state_hash, current.state_hash);
      assert.equal(current.state.event_queue[0].event_id, "e1-report-second");
      const resumed = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns: 1,
      }, {
        ...nativeOptions, characterRuntimeManager: makeRuntime(),
        characterBrain: async () => ({ action_id: "bounded-rest" }),
      });
      assert.equal(resumed.committed_turn_count, 1);
      assert.equal(resumed.pending_event_count, 0);
      assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, 2);
    } else {
      assert.deepEqual(current, before);
      assert.equal(history.turns.length, 0);
      assert.equal(progress.last_observed_revision, before.revision);
      assert.equal(progress.last_observed_state_hash, before.state_hash);
    }
  } finally {
    if (restoreState) await restoreState();
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E1 concurrent and unreadable state reporting regression passed.");

for (const target_horizon of [null, "", "not-a-time", "2026-10-01T00:00:00Z", 500]) {
  await assert.rejects(runWorldSimulationOffscreenEventBatch({
    world_simulation_session_id: "e2-invalid-never-read", max_turns: 1, target_horizon,
  }), { code: "C6E_OFFSCREEN_BATCH_INVALID" });
}
await assert.rejects(runWorldSimulationTurn({
  world_simulation_session_id: "e2-native-invalid-never-read",
}, {
  worldSimulationTimeCeiling: "not-a-time", characterBrain: async () => "reject_all",
}), { code: "C6E_OFFSCREEN_BATCH_INVALID" });
await assert.rejects(runWorldSimulationOffscreenEventBatch({
  world_simulation_session_id: "e2-override-never-read", max_turns: 1,
}, { worldSimulationTimeCeiling: "2026-10-01T00:00:00.000Z" }),
{ code: "C6E_OFFSCREEN_BATCH_INVALID" });

for (const [mode, horizonMs, firstCount] of [
  ["inside-first", 250, 0], ["inside-second", 750, 1], ["exact", 500, 1],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e2-${mode}-${process.pid}-${Date.now()}`);
  const nativeOptions = { fixtureRoot: root };
  try {
    const { state: initial } = d1Fixture("awake");
    const first = initial.event_queue[0];
    initial.event_queue = [first, ...[2, 3].map(index => {
      const event = d1Clone(first);
      event.event_id = `e2-event-${index}`;
      delete event.sleep_arousal_transition;
      return event;
    })];
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E2 exact horizon guard", seed: mode,
      initial_world_state: initial,
    }, nativeOptions);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, nativeOptions);
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    let brainCalls = 0;
    const options = {
      ...nativeOptions,
      characterRuntimeManager: createWorldSimulationCharacterRuntimeManager({
        identityResolver: async name => ({
          entity_id: `e2_character_${name}`, canonical_name: name,
          identity_source: "e2_fixture", formal: true,
        }),
      }),
      characterBrain: async packet => {
        brainCalls += 1;
        assert.equal(JSON.stringify(packet).includes("worldSimulationTimeCeiling"), false);
        assert.equal(JSON.stringify(packet).includes("requested_target_horizon"), false);
        return { action_id: "bounded-rest" };
      },
    };
    const input = { world_simulation_session_id: sid, max_turns: 3 };
    await assert.rejects(runWorldSimulationOffscreenEventBatch({
      ...input, target_horizon: at(-1),
    }, options), { code: "C6E_OFFSCREEN_BATCH_INVALID" });
    const zero = await runWorldSimulationOffscreenEventBatch({
      ...input, target_horizon: at(0),
    }, options);
    assert.equal(zero.status, "target_horizon_reached");
    assert.equal(zero.target_horizon_claimed, true);
    assert.equal(zero.committed_turn_count, 0);
    assert.equal(brainCalls, 0);
    assert.deepEqual(await getWorldSimulationState(sid, nativeOptions), before);

    const batch = await runWorldSimulationOffscreenEventBatch({
      ...input, target_horizon: at(horizonMs),
    }, options);
    assert.equal(batch.committed_turn_count, firstCount);
    assert.equal(batch.reached_simulation_time, at(firstCount * 500));
    assert.equal(batch.requested_target_horizon, at(horizonMs));
    assert.equal(batch.target_horizon_claimed, mode === "exact");
    assert.equal(batch.status, mode === "exact" ? "target_horizon_reached" : "blocked");
    assert.equal(batch.blocked_reason, mode === "exact"
      ? null : "offscreen_horizon_would_be_exceeded");
    assert.equal(batch.attempted_turn_count, mode === "exact" ? 1 : firstCount + 1);
    assert.equal(batch.pending_event_count, 3 - firstCount);
    assert.equal(batch.state_reconciliation_required, false);
    const middle = await getWorldSimulationState(sid, nativeOptions);
    assert.equal(middle.revision, before.revision + firstCount);
    assert.deepEqual(middle.state.event_queue, initial.event_queue.slice(firstCount));
    assert.equal((await getWorldSimulationHistory(sid, nativeOptions)).turns.length, firstCount);
    assert.deepEqual(middle.state.motivational_goal_events, before.state.motivational_goal_events);
    assert.deepEqual(middle.state.characters.aria.physical_state.injuries,
      before.state.characters.aria.physical_state.injuries);
    if (firstCount === 0) assert.deepEqual(middle, before);

    const budget = await runWorldSimulationOffscreenEventBatch({
      ...input, max_turns: 1, target_horizon: at(1500),
    }, options);
    assert.equal(budget.status, "budget_exhausted");
    assert.equal(budget.committed_turn_count, 1);
    assert.equal(budget.target_horizon_claimed, false);
    assert.equal(budget.reached_simulation_time, at((firstCount + 1) * 500));
    const resumed = await runWorldSimulationOffscreenEventBatch({
      ...input, target_horizon: at(1500),
    }, options);
    assert.equal(resumed.status, "target_horizon_reached");
    assert.equal(resumed.target_horizon_claimed, true);
    const final = await getWorldSimulationState(sid, nativeOptions);
    const history = await getWorldSimulationHistory(sid, nativeOptions);
    assert.equal(final.state.simulation_time, at(1500));
    assert.equal(final.state.characters.aria.physical_state.sleep_arousal.condition, "asleep");
    assert.equal(history.turns.length, 3);
    assert.deepEqual(history.turns.map(turn => turn.event.event_id),
      initial.event_queue.map(event => event.event_id));
    const callsBeforeEmpty = brainCalls;
    const empty = await runWorldSimulationOffscreenEventBatch({
      ...input, target_horizon: at(2000),
    }, options);
    assert.equal(empty.status, "no_pending_event");
    assert.equal(empty.target_horizon_claimed, false);
    assert.equal(empty.reached_simulation_time, at(1500));
    assert.equal(brainCalls, callsBeforeEmpty);
    assert.deepEqual(await getWorldSimulationState(sid, nativeOptions), final);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E2 canonical offscreen horizon regression passed.");

{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e2-equivalent-time-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root };
  try {
    const { state: initial } = d1Fixture("awake");
    const target = new Date(Date.parse(initial.simulation_time)).toISOString();
    initial.simulation_time = target.replace("Z", "+00:00");
    initial.scenes.room.simulation_time = initial.simulation_time;
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E2 equivalent committed timestamp",
      seed: "equivalent-time", initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytesBefore = await Promise.all([
      readFile(paths.state, "utf8"), readFile(paths.history, "utf8"),
    ]);
    for (const max_turns of [0, 1]) {
      const reached = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns, target_horizon: target,
      }, {
        ...options,
        characterBrain: async () => {
          assert.fail("An equivalent already-reached World horizon must not invoke Brain.");
        },
      });
      assert.equal(reached.status, "target_horizon_reached");
      assert.equal(reached.target_horizon_claimed, true);
      assert.equal(reached.attempted_turn_count, 0);
      assert.equal(reached.committed_turn_count, 0);
      assert.equal(reached.reached_simulation_time, before.state.simulation_time);
      assert.equal(reached.pending_event_count, before.state.event_queue.length);
      assert.deepEqual(await getWorldSimulationState(sid, options), before);
      assert.deepEqual(await Promise.all([
        readFile(paths.state, "utf8"), readFile(paths.history, "utf8"),
      ]), bytesBefore, "time comparison must not normalize or rewrite committed bytes");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E2 equivalent timestamp horizon regression passed.");

function e3PersistentProcessWorld() {
  const { state } = d1Fixture("awake");
  state.event_queue = [];
  state.ability_fields = {
    field_e3: {
      field_id: "field_e3",
      owner: "keeper",
      ability_id: "e3_field",
      scene_id: "room",
      center: { x: 6, y: 6 },
      radius_m: 0.5,
      remaining_ms: 250,
      active: true,
      affects_owner: false,
      effect: { damage_per_second: 0 },
      tick_ms: 100,
    },
  };
  state.projectiles = {
    projectile_e3: {
      projectile_id: "projectile_e3",
      owner: "keeper",
      source_action_id: null,
      weapon_id: "e3-fixture",
      scene_id: "room",
      position: { x: 7, y: 4 },
      velocity_mps: { x: 2, y: 0 },
      radius_m: 0.05,
      base_damage: 0,
      damage_type: "fixture",
      initial_penetration_energy: 1,
      remaining_penetration_energy: 1,
      max_lifetime_ms: 5000,
      age_ms: 0,
      active: true,
      target_character: null,
      penetrated_obstacles: [],
    },
  };
  state.world_rules = {
    ...(state.world_rules ?? {}),
    ability_field_tick_ms: 100,
    combat_target_radius_m: 0.2,
  };
  return state;
}

{
  const state = e3PersistentProcessWorld();
  const before = d1Clone(state);
  const first = projectWorldSimulationOffscreenBreakpoint({ world_state: state });
  assert.equal(first.status, "breakpoint_available");
  assert.equal(first.breakpoint.kind, "ability_field_tick");
  assert.equal(first.breakpoint.subject_id, "field_e3");
  assert.equal(first.breakpoint.delta_ms, 100);
  assert.equal(first.breakpoint.source_authority,
    "programmatic_immutable_ability_field_lifecycle");
  assert.equal(first.boundaries.world_time_advanced, false);
  assert.equal(first.boundaries.world_state_mutated, false);
  assert.equal(first.boundaries.character_brain_invoked, false);
  assert.equal(first.boundaries.automatic_recovery_inferred, false);
  assert.deepEqual(projectWorldSimulationOffscreenBreakpoint({ world_state: state }), first,
    "same committed World state must discover the same deterministic breakpoint");
  assert.deepEqual(state, before, "breakpoint discovery must not mutate committed input");

  const projectileOnly = d1Clone(state);
  projectileOnly.ability_fields = {};
  const projectile = projectWorldSimulationOffscreenBreakpoint({
    world_state: projectileOnly,
  });
  assert.equal(projectile.breakpoint.kind, "projectile_bounds");
  assert.equal(projectile.breakpoint.subject_id, "projectile_e3");
  assert.equal(projectile.breakpoint.delta_ms, 500);
  assert.equal(projectile.breakpoint.source_authority,
    "programmatic_immutable_event_discovery");

  const at = ms => new Date(Date.parse(state.simulation_time) + ms).toISOString();
  const beforeKnownBreakpoint = projectWorldSimulationOffscreenBreakpoint({
    world_state: state,
    target_horizon: at(50),
  });
  assert.equal(beforeKnownBreakpoint.status, "no_authoritative_breakpoint");
  assert.equal(beforeKnownBreakpoint.breakpoint, null);
  assert.equal(beforeKnownBreakpoint.boundaries.unknown_slow_process_synthesized, false);

  const noProcesses = d1Clone(state);
  noProcesses.ability_fields = {};
  noProcesses.projectiles = {};
  const none = projectWorldSimulationOffscreenBreakpoint({ world_state: noProcesses });
  assert.equal(none.status, "no_authoritative_breakpoint");
  assert.equal(none.breakpoint, null);
}
console.log("CB-C6-E3 read-only persistent-process breakpoint projection regression passed.");

{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e3-empty-queue-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root };
  try {
    const initial = e3PersistentProcessWorld();
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E3 empty queue breakpoint discovery",
      seed: "e3-breakpoint", initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytesBefore = await Promise.all([
      readFile(paths.state, "utf8"), readFile(paths.history, "utf8"),
    ]);
    for (const max_turns of [0, 1]) {
      const result = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid,
        max_turns,
      }, {
        ...options,
        characterBrain: async () => {
          assert.fail("E3 breakpoint discovery must not invoke Character Brain.");
        },
      });
      assert.equal(result.status, "slow_process_breakpoint_pending");
      assert.equal(result.blocked_reason, "offscreen_slow_process_breakpoint_pending");
      assert.equal(result.attempted_turn_count, max_turns === 0 ? 0 : 1);
      assert.equal(result.physical_step_blocked_reason, null);
      assert.equal(result.committed_turn_count, max_turns);
      assert.equal(result.pending_event_count, 0);
      assert.equal(result.pending_breakpoint.kind, "ability_field_tick");
      assert.equal(result.pending_breakpoint.delta_ms, 100);
      assert.equal(result.reached_simulation_time, max_turns === 0
        ? before.state.simulation_time
        : new Date(Date.parse(before.state.simulation_time) + 100).toISOString());
      assert.equal(result.target_horizon_claimed, false);
      const after = await getWorldSimulationState(sid, options);
      if (max_turns === 0) {
        assert.deepEqual(after, before);
        assert.deepEqual(await Promise.all([
          readFile(paths.state, "utf8"), readFile(paths.history, "utf8"),
        ]), bytesBefore, "budget-zero E3 discovery preserves exact durable bytes");
      } else {
        assert.equal(after.revision, before.revision + 1);
        assert.equal(after.state.ability_fields.field_e3.remaining_ms, 150);
        assert.equal(after.state.projectiles.projectile_e3.age_ms, 100);
        assert.deepEqual(after.state.characters, before.state.characters);
        assert.deepEqual(after.state.memories, before.state.memories);
        assert.deepEqual(after.state.event_queue, before.state.event_queue);
        const history = await getWorldSimulationHistory(sid, options);
        assert.equal(history.turns.length, 1);
        assert.equal(history.turns[0].previous_state_hash, before.state_hash);
        assert.equal(history.turns[0].next_state_hash, after.state_hash);
        assert.equal(result.committed_turns[0].next_state_hash, after.state_hash);
      }
    }

    const beforeInjury = d1Clone(before.state.characters.aria.physical_state.injuries);
    assert.deepEqual(
      (await getWorldSimulationState(sid, options)).state.characters.aria.physical_state.injuries,
      beforeInjury,
      "elapsed offscreen discovery must not synthesize recovery",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E3 empty-queue breakpoint admission regression passed.");

{
  const state = e3PersistentProcessWorld();
  state.ability_fields = {};
  const p = state.projectiles.projectile_e3;
  p.velocity_mps = { x: 0, y: 0 };
  p.max_lifetime_ms = 500;
  const at = ms => new Date(Date.parse(state.simulation_time) + ms).toISOString();
  const before = d1Clone(state);
  assert.equal(projectWorldSimulationOffscreenBreakpoint({
    world_state: state, target_horizon: at(499),
  }).breakpoint, null);
  const exact = projectWorldSimulationOffscreenBreakpoint({
    world_state: state, target_horizon: at(500),
  });
  assert.equal(exact.breakpoint.kind, "projectile_lifetime");
  assert.equal(exact.breakpoint.delta_ms, 500);
  assert.equal(exact.earliest_breakpoint_confirmed, true);
  assert.deepEqual(state, before);
  p.age_ms = 500;
  const due = projectWorldSimulationOffscreenBreakpoint({
    world_state: state, target_horizon: at(0),
  });
  assert.equal(due.breakpoint.kind, "projectile_lifetime");
  assert.equal(due.breakpoint.delta_ms, 0);

  const unknown = e3PersistentProcessWorld();
  delete unknown.projectiles.projectile_e3.velocity_mps;
  const unresolved = projectWorldSimulationOffscreenBreakpoint({ world_state: unknown });
  assert.equal(unresolved.status, "process_authority_unresolved");
  assert.equal(unresolved.unresolved_process_count, 1);
  assert.equal(unresolved.unresolved_processes[0].reason, "projectile_motion_unavailable");
  assert.equal(unresolved.breakpoint.kind, "ability_field_tick");
  assert.equal(unresolved.earliest_breakpoint_confirmed, false,
    "a known candidate cannot prove it precedes an unresolved active process");
  unknown.ability_fields.field_e3.remaining_ms = null;
  assert.equal(projectWorldSimulationOffscreenBreakpoint({
    world_state: unknown,
  }).unresolved_process_count, 2);

  const tied = e3PersistentProcessWorld();
  tied.projectiles = {};
  const field = tied.ability_fields.field_e3;
  const alpha = { ...field, field_id: "alpha" };
  const zeta = { ...field, field_id: "zeta" };
  tied.ability_fields = { zeta, alpha };
  const first = projectWorldSimulationOffscreenBreakpoint({ world_state: tied });
  tied.ability_fields = { alpha, zeta };
  assert.deepEqual(projectWorldSimulationOffscreenBreakpoint({ world_state: tied }), first);
  assert.equal(first.breakpoint.subject_id, "alpha");
}

for (const mode of ["exact-lifetime", "due-now", "unresolved"]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e3-boundary-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root };
  try {
    const initial = e3PersistentProcessWorld();
    let horizonMs = 500;
    if (mode === "unresolved") {
      delete initial.projectiles.projectile_e3.velocity_mps;
      horizonMs = 100;
    } else {
      initial.ability_fields = {};
      initial.projectiles.projectile_e3.velocity_mps = { x: 0, y: 0 };
      initial.projectiles.projectile_e3.max_lifetime_ms = 500;
      if (mode === "due-now") {
        initial.projectiles.projectile_e3.age_ms = 500;
        horizonMs = 0;
      }
    }
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E3 pending boundary preservation", seed: mode,
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const durable = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await durable();
    for (const max_turns of [0, 1]) {
      const result = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns,
        target_horizon: new Date(Date.parse(before.state.simulation_time) + horizonMs).toISOString(),
      }, {
        ...options, characterBrain: async () => assert.fail("Discovery may not invoke Brain."),
      });
      if (mode === "due-now" && max_turns > 0) {
        assert.equal(result.status, "target_horizon_reached");
        assert.equal(result.attempted_turn_count, 1);
        assert.equal(result.committed_turn_count, 1);
        assert.equal(result.committed_physical_step_count, 1);
        assert.equal(result.pending_breakpoint, null);
        assert.equal(result.unresolved_process_count, 0);
        assert.equal(result.state_reconciliation_required, false);
        assert.equal(result.reached_simulation_time, before.state.simulation_time);
        assert.equal(result.target_horizon_claimed, true);
        const after = await getWorldSimulationState(sid, options);
        assert.equal(after.revision, before.revision + 1);
        assert.equal(after.state.projectiles.projectile_e3.active, false);
        assert.equal(after.state.projectiles.projectile_e3.termination_reason, "lifetime_expired");
        assert.equal(after.state.projectiles.projectile_e3.age_ms, 500);
        assert.deepEqual(after.state.projectiles.projectile_e3.position,
          before.state.projectiles.projectile_e3.position);
        assert.deepEqual(after.state.characters, before.state.characters);
        assert.deepEqual(after.state.memories, before.state.memories);
        assert.deepEqual(after.state.event_queue, before.state.event_queue);
        const history = await getWorldSimulationHistory(sid, options);
        assert.equal(history.turns.length, 1);
        assert.equal(result.committed_turns[0].next_state_hash, history.turns[0].next_state_hash);
        assert.equal(history.turns[0].previous_state_hash, before.state_hash);
        assert.equal(after.state_hash, history.turns[0].next_state_hash);
        assert.ok(history.turns[0].state_transitions.some(item =>
          item.field === "projectile_state" && item.lifecycle_effect === "termination" && item.time_ms === 0));
        continue;
      }
      assert.equal(result.status, mode === "unresolved"
        ? "slow_process_authority_unresolved" : "slow_process_breakpoint_pending");
      assert.equal(result.unresolved_process_count, mode === "unresolved" ? 1 : 0);
      assert.equal(result.pending_breakpoint_confirmed, mode !== "unresolved");
      const flightCommitted = mode === "exact-lifetime" && max_turns > 0;
      assert.equal(result.pending_breakpoint.delta_ms,
        mode === "unresolved" ? 100 : flightCommitted ? 0 : horizonMs);
      assert.equal(result.attempted_turn_count, flightCommitted ? 1 : 0);
      assert.equal(result.committed_turn_count, flightCommitted ? 1 : 0);
      const after = await getWorldSimulationState(sid, options);
      assert.equal(result.reached_simulation_time, flightCommitted
        ? new Date(Date.parse(before.state.simulation_time) + 500).toISOString()
        : before.state.simulation_time);
      assert.equal(result.target_horizon_claimed, mode === "due-now" || flightCommitted,
        "reaching the horizon does not imply draining its same-time work");
      if (flightCommitted) {
        assert.equal(after.revision, before.revision + 1);
        assert.equal(after.state.projectiles.projectile_e3.age_ms, 500);
        assert.equal(after.state.projectiles.projectile_e3.active, true);
        assert.deepEqual(after.state.characters, before.state.characters);
        assert.deepEqual(after.state.memories, before.state.memories);
        assert.deepEqual(after.state.event_queue, before.state.event_queue);
        const history = await getWorldSimulationHistory(sid, options);
        assert.equal(history.turns.length, 1);
        assert.equal(result.committed_turns[0].next_state_hash, history.turns[0].next_state_hash);
        assert.equal(result.committed_turns[0].previous_state_hash, before.state_hash);
        assert.equal(after.state_hash, history.turns[0].next_state_hash);
      } else {
        assert.deepEqual(after, before);
        assert.deepEqual(await durable(), original);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log("CB-C6-E3 horizon equality and unresolved process regression passed.");

import { adjudicateWorldSimulationOffscreenPhysicalStep } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { runWorldSimulationOffscreenPhysicalStep } from "../../server/src/world-simulation-offscreen-physical-step-service.mjs";

function e4FieldWorld() {
  const state = e3PersistentProcessWorld();
  state.projectiles = {};
  return state;
}
async function e4Resolve(state, target_horizon = null) {
  return adjudicateWorldSimulationOffscreenPhysicalStep({
    world_simulation_session_id: "e4-pure", world_state: state,
    world_state_revision: 0, world_state_hash: hashAgentRunValue(state), target_horizon,
  });
}
{
  const state = e4FieldWorld();
  const before = d1Clone(state);
  const first = await e4Resolve(state);
  assert.equal(first.next_world_state.ability_fields.field_e3.remaining_ms, 150);
  assert.equal(first.next_world_state.simulation_time,
    new Date(Date.parse(state.simulation_time) + 100).toISOString());
  assert.deepEqual(first.next_world_state.event_queue, []);
  assert.deepEqual(first.next_world_state.memories, state.memories);
  assert.deepEqual(first.next_world_state.motivational_goal_history, state.motivational_goal_history);
  assert.ok(first.chronological_mutation_queue.queue_hash);
  assert.ok(first.chronological_mutation_execution.execution_hash);
  assert.deepEqual(await e4Resolve(state), first, "physical step must replay exactly");
  assert.deepEqual(state, before, "causal entry must not mutate committed input");
  const second = await e4Resolve(first.next_world_state);
  const third = await e4Resolve(second.next_world_state);
  assert.equal(third.next_world_state.ability_fields.field_e3.active, false);
  assert.equal(third.next_world_state.ability_fields.field_e3.remaining_ms, 0);
  assert.equal(third.next_world_state.simulation_time,
    new Date(Date.parse(state.simulation_time) + 250).toISOString());
  const horizon = new Date(Date.parse(state.simulation_time) + 99).toISOString();
  assert.equal((await e4Resolve(state, horizon)).blocked_reason, "physical_step_no_breakpoint");
  const damage = e4FieldWorld();
  damage.ability_fields.field_e3.center = d1Clone(damage.scenes.room.entity_positions.aria);
  damage.ability_fields.field_e3.radius_m = 1;
  damage.ability_fields.field_e3.effect.damage_per_second = 10;
  const hit = await e4Resolve(damage);
  assert.ok(hit.action_outcomes.some(item => item.result === "ability_field_tick"
    && item.damage_applied > 0), "existing field impact owner must retain actual damage");
  for (const [mode, reason] of [
    ["queue", "physical_step_queue_not_empty"],
    ["projectile_obstacles", "physical_step_projectile_obstacle_progression_pending"],
    ["geometry", "physical_step_field_geometry_unresolved"],
    ["scenes", "physical_step_scene_scope_unresolved"],
    ["unresolved", "physical_step_authority_unresolved"],
    ["fractional", "physical_step_same_time_or_fractional_pending"],
  ]) {
    const pending = e4FieldWorld();
    if (mode === "queue") pending.event_queue = [{ event_id: "pending" }];
    if (mode === "projectile_obstacles") {
      pending.projectiles = e3PersistentProcessWorld().projectiles;
      pending.scenes.room.obstacles = [{ obstacle_id: "e4-unmodeled" }];
    }
    if (mode === "geometry") delete pending.ability_fields.field_e3.center;
    if (mode === "scenes") {
      pending.scenes.other = d1Clone(pending.scenes.room);
      pending.ability_fields.other = { ...d1Clone(pending.ability_fields.field_e3),
        field_id: "other", scene_id: "other" };
    }
    if (mode === "unresolved") pending.ability_fields.field_e3.remaining_ms = null;
    if (mode === "fractional") pending.ability_fields.field_e3.remaining_ms = 0.5;
    const original = d1Clone(pending);
    assert.equal((await e4Resolve(pending)).blocked_reason, reason);
    assert.deepEqual(pending, original);
  }
  await assert.rejects(adjudicateWorldSimulationOffscreenPhysicalStep({
    world_state: state, world_state_revision: 0, world_state_hash: "forged",
  }), { code: "C6E_PHYSICAL_STEP_INVALID" });
}
{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e4-physical-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root, characterBrain: async () => assert.fail("Physical step may not invoke Brain.") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E4 native physical field progression", seed: "e4-field",
      initial_world_state: e4FieldWorld(),
    }, options);
    const sid = session.world_simulation_session_id;
    const original = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const at = ms => new Date(Date.parse(original.state.simulation_time) + ms).toISOString();
    let current = original;
    for (const [elapsed, remaining] of [[100, 150], [200, 50], [250, 0]]) {
      const result = await runWorldSimulationOffscreenPhysicalStep({
        world_simulation_session_id: sid, expected_revision: current.revision,
        expected_state_hash: current.state_hash, target_horizon: at(250),
      }, options);
      assert.equal(result.committed, true);
      assert.equal(result.reached_simulation_time, at(elapsed));
      assert.equal(result.automatic_replay_allowed, false);
      const next = await getWorldSimulationState(sid, options);
      assert.equal(next.revision, current.revision + 1);
      assert.equal(next.state.ability_fields.field_e3.remaining_ms, remaining);
      assert.deepEqual(next.state.event_queue, []);
      assert.deepEqual(next.state.memories, original.state.memories);
      assert.deepEqual(next.state.motivational_goal_history, original.state.motivational_goal_history);
      assert.deepEqual(next.state.characters.aria.physical_state.injuries,
        original.state.characters.aria.physical_state.injuries);
      assert.deepEqual(next.state.characters.aria.physical_state.sleep_arousal,
        original.state.characters.aria.physical_state.sleep_arousal);
      current = next;
    }
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, 3);
    for (const turn of history.turns) {
      assert.equal(turn.event.type, "offscreen_physical_process_step");
      assert.deepEqual(turn.selected_action_intents, []);
      assert.deepEqual(turn.knowledge_transitions, []);
      assert.ok(turn.chronological_mutation_queue.queue_hash);
      assert.ok(turn.chronological_mutation_execution.execution_hash);
    }
    const durable = await bytes();
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: original.revision,
      expected_state_hash: original.state_hash,
    }, options), { code: "C6E_PHYSICAL_STEP_STALE" });
    assert.deepEqual(await bytes(), durable);
    const idle = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: current.revision,
      expected_state_hash: current.state_hash, target_horizon: at(500),
    }, options);
    assert.equal(idle.committed, false);
    assert.equal(idle.blocked_reason, "physical_step_no_breakpoint");
    assert.deepEqual(await bytes(), durable, "idle must not jump to requested horizon");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E4 World-owned physical field progression regression passed.");

{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e4-acoustic-pending-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("Pending acoustic ingress may not invoke Brain from a physical step.") };
  try {
    const initial = e4FieldWorld();
    initial.sound_events = [{
      schema_version: "cc6b-communication-acoustic-bridge-v1",
      sound_id: "e4-pending-speech", scene_id: "room",
      kind: "communication_speech_signal", lifecycle: "next_perception_only",
      source_entity_id: "keeper", active: true,
    }];
    const clone = d1Clone(initial);
    const projected = await e4Resolve(initial);
    assert.equal(projected.blocked_reason, "physical_step_acoustic_ingress_pending");
    assert.deepEqual(initial, clone);
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E4 pending acoustic admission preservation",
      seed: "e4-acoustic-pending", initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const durable = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await durable();
    const result = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash,
    }, options);
    assert.equal(result.committed, false);
    assert.equal(result.blocked_reason, "physical_step_acoustic_ingress_pending");
    assert.equal(result.reached_simulation_time, before.state.simulation_time);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await durable(), original,
      "physical step must preserve unheard CC-6B signal and exact durable bytes");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E4 physical step preserves pending acoustic ingress regression passed.");

for (const [budget, horizonMs, elapsed, commits] of [
  [0, 250, 0, 0], [1, 250, 100, 1], [2, 250, 200, 2],
  [3, 250, 250, 3], [32, 200, 200, 2], [32, 99, 0, 0],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e5-budget-${budget}-${horizonMs}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("Empty-queue physical batch must not invoke Brain.") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E5 bounded physical batch", seed: "e5-field",
      initial_world_state: e4FieldWorld(),
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const durable = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const bytesBefore = await durable();
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: budget, target_horizon: at(horizonMs),
    }, options);
    assert.equal(result.attempted_turn_count, commits);
    assert.equal(result.committed_turn_count, commits);
    assert.equal(result.committed_physical_step_count, commits);
    assert.equal(result.reached_simulation_time, at(elapsed));
    assert.equal(result.target_horizon_claimed, elapsed === horizonMs);
    assert.equal(result.state_reconciliation_required, false);
    assert.equal(result.automatic_replay_allowed, false);
    assert.equal(result.pending_event_count, 0);
    if (budget < 3 && horizonMs === 250) {
      assert.equal(result.status, "slow_process_breakpoint_pending");
      assert.equal(result.pending_breakpoint.delta_ms, elapsed === 200 ? 50 : 100);
    }
    if (elapsed === horizonMs) assert.equal(result.status, "target_horizon_reached");
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + commits);
    assert.equal(after.state.ability_fields.field_e3.remaining_ms, 250 - elapsed);
    assert.equal(after.state.ability_fields.field_e3.active, elapsed < 250);
    assert.deepEqual(after.state.event_queue, []);
    assert.deepEqual(after.state.characters.aria.physical_state, before.state.characters.aria.physical_state);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, commits);
    for (let i = 0; i < commits; i += 1) {
      const completed = result.committed_turns[i];
      assert.equal(completed.execution_kind, "physical_process_step");
      assert.equal(completed.turn_id, history.turns[i].turn_id);
      assert.equal(completed.next_state_hash, history.turns[i].next_state_hash,
        "physical batch hash must match the actual atomic writer history");
      assert.equal(completed.event_id, history.turns[i].event.event_id);
      assert.equal(history.turns[i].event.type, "offscreen_physical_process_step");
      assert.ok(history.turns[i].chronological_mutation_execution.execution_hash);
      if (i) assert.equal(completed.previous_state_hash, result.committed_turns[i - 1].next_state_hash);
    }
    if (!commits) assert.deepEqual(await durable(), bytesBefore);
    if (elapsed === 250) {
      const bytesAfter = await durable();
      const idle = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns: 32, target_horizon: at(500),
      }, options);
      assert.equal(idle.reached_simulation_time, at(250));
      assert.equal(idle.committed_turn_count, 0);
      assert.equal(idle.target_horizon_claimed, false);
      assert.deepEqual(await durable(), bytesAfter, "inactive fields cannot authorize a horizon jump");
    }
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E5 bounded physical batch horizon and lineage regression passed.");

for (const [mode, reason, attempts] of [
  ["acoustic", "physical_step_acoustic_ingress_pending", 1],
  ["projectile_obstacles", "physical_step_projectile_obstacle_progression_pending", 1],
  ["geometry", "physical_step_field_geometry_unresolved", 1],
  ["scenes", "physical_step_scene_scope_unresolved", 1],
  ["fractional", null, 0], ["unresolved", null, 0],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e5-pending-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("Unsupported physical processes must stay pending without Brain.") };
  try {
    const initial = e4FieldWorld();
    if (mode === "acoustic") initial.sound_events = [{
      schema_version: "cc6b-communication-acoustic-bridge-v1", sound_id: "e5-pending",
      scene_id: "room", source_entity_id: "keeper", active: true, lifecycle: "next_perception_only",
    }];
    if (mode === "projectile_obstacles") {
      initial.projectiles = e3PersistentProcessWorld().projectiles;
      initial.scenes.room.obstacles = [{ obstacle_id: "e5-unmodeled" }];
    }
    if (mode === "geometry") delete initial.ability_fields.field_e3.center;
    if (mode === "scenes") {
      initial.scenes.other = d1Clone(initial.scenes.room);
      initial.ability_fields.other = { ...d1Clone(initial.ability_fields.field_e3),
        field_id: "other", scene_id: "other" };
    }
    if (mode === "fractional") initial.ability_fields.field_e3.remaining_ms = 0.5;
    if (mode === "unresolved") initial.ability_fields.field_e3.remaining_ms = null;
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E5 pending physical authority", seed: mode, initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const durable = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await durable();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32,
    }, options);
    assert.equal(result.attempted_turn_count, attempts);
    assert.equal(result.committed_turn_count, 0);
    assert.equal(result.committed_physical_step_count, 0);
    assert.equal(result.physical_step_blocked_reason, reason);
    assert.equal(result.reached_simulation_time, before.state.simulation_time);
    assert.equal(result.state_reconciliation_required, false);
    assert.ok(result.pending_breakpoint || result.unresolved_process_count);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await durable(), original, "pending authority must preserve exact durable bytes");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E5 physical batch unsupported authority and acoustic preservation regression passed.");

function e6ProjectileWorld(mode) {
  const state = e3PersistentProcessWorld();
  state.ability_fields = {};
  state.scenes.room.obstacles = [];
  const projectile = state.projectiles.projectile_e3;
  if (mode === "lifetime") projectile.max_lifetime_ms = 300;
  if (mode === "contact") {
    projectile.position = { x: 1, y: 4 };
    projectile.velocity_mps = { x: 1, y: 0 };
    projectile.radius_m = 0.25;
    projectile.base_damage = 10;
    Object.assign(state.characters.aria.physical_state, {
      health_current: 100, health_max: 100,
    });
    state.scenes.room.entity_positions.aria = { x: 3, y: 4 };
    state.scenes.room.entity_positions.keeper = { x: 0, y: 0 };
    state.characters.aria.combat_profile = {
      ...state.characters.aria.combat_profile, collision_radius_m: 0.75,
    };
  }
  return state;
}
for (const [mode, elapsed] of [["bounds", 500], ["lifetime", 300], ["contact", 1000]]) {
  const state = e6ProjectileWorld(mode);
  const original = d1Clone(state);
  const discovery = projectWorldSimulationOffscreenBreakpoint({ world_state: state });
  assert.equal(discovery.breakpoint.delta_ms, elapsed);
  const first = await e4Resolve(state);
  assert.equal(first.next_world_state.simulation_time,
    new Date(Date.parse(state.simulation_time) + elapsed).toISOString());
  assert.equal(first.next_world_state.projectiles.projectile_e3.age_ms, elapsed);
  assert.deepEqual(state, original, "E6 keeps committed input immutable");
  assert.deepEqual(await e4Resolve(state), first, "E6 deterministic replay");
  assert.deepEqual(first.next_world_state.memories, state.memories);
  assert.deepEqual(first.next_world_state.motivational_goal_history, state.motivational_goal_history);
  assert.ok(first.chronological_mutation_execution.execution_hash);
  if (mode === "contact") {
    assert.equal(first.next_world_state.projectiles.projectile_e3.active, false);
    assert.equal(first.next_world_state.projectiles.projectile_e3.termination_reason, "character_contact");
    assert.ok(first.action_outcomes.some(item => item.result === "projectile_hit_character"
      && item.target === "aria" && item.damage_applied > 0));
  } else {
    assert.equal(first.next_world_state.projectiles.projectile_e3.active, true);
    assert.equal(projectWorldSimulationOffscreenBreakpoint({
      world_state: first.next_world_state,
    }).breakpoint.delta_ms, 0, "reached endpoint retains due same-time work");
    const sameTime = await e4Resolve(first.next_world_state);
    if (["lifetime", "bounds"].includes(mode)) {
      assert.equal(sameTime.next_world_state.projectiles.projectile_e3.active, false);
      assert.equal(sameTime.next_world_state.projectiles.projectile_e3.termination_reason,
        mode === "lifetime" ? "lifetime_expired" : "left_scene_bounds");
      assert.equal(sameTime.next_world_state.simulation_time, first.next_world_state.simulation_time);
      assert.equal(sameTime.next_world_state.projectiles.projectile_e3.age_ms, elapsed);
      assert.deepEqual(sameTime.next_world_state.projectiles.projectile_e3.position,
        first.next_world_state.projectiles.projectile_e3.position);
    } else {
      assert.equal(sameTime.blocked_reason, "physical_step_same_time_or_fractional_pending");
    }
  }
}
{
  const initial = e6ProjectileWorld("lifetime");
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e6-native-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E6 physical flight must not invoke Brain") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E6 projectile flight endpoint pending", seed: "e6-lifetime",
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 1,
    }, options);
    assert.equal(result.committed_physical_step_count, 1);
    assert.equal(result.attempted_turn_count, 1);
    assert.equal(result.status, "slow_process_breakpoint_pending");
    assert.equal(result.pending_breakpoint.delta_ms, 0);
    assert.equal(result.state_reconciliation_required, false);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.state.projectiles.projectile_e3.age_ms, 300);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, 1);
    assert.equal(result.committed_turns[0].next_state_hash, history.turns[0].next_state_hash);
    assert.deepEqual(history.turns[0].selected_action_intents, []);
    assert.deepEqual(history.turns[0].knowledge_transitions, []);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const committedBytes = await bytes();
    const retry = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 0,
    }, options);
    assert.equal(retry.committed_turn_count, 0);
    assert.equal(retry.pending_breakpoint.delta_ms, 0);
    assert.deepEqual(await bytes(), committedBytes, "E6 same-time pending cannot replay flight");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E6 projectile-only flight, contact, endpoint pending and Native lineage regression passed.");

for (const [mode, reason, attempts] of [
  ["obstacles", "physical_step_projectile_obstacle_progression_pending", 1],
  ["scenes", "physical_step_scene_scope_unresolved", 1],
  ["fractional", null, 0],
  ["acoustic", "physical_step_acoustic_ingress_pending", 1],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e6-pending-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E6 pending authority must not invoke Brain") };
  try {
    const initial = e6ProjectileWorld("lifetime");
    if (mode === "obstacles") initial.scenes.room.obstacles = [{ obstacle_id: "e6-unmodeled" }];
    if (mode === "scenes") {
      initial.scenes.other = d1Clone(initial.scenes.room);
      initial.projectiles.other = { ...d1Clone(initial.projectiles.projectile_e3),
        projectile_id: "other", scene_id: "other" };
    }
    if (mode === "fractional") initial.projectiles.projectile_e3.max_lifetime_ms = 0.5;
    if (mode === "acoustic") initial.sound_events = [{
      schema_version: "cc6b-communication-acoustic-bridge-v1",
      sound_id: "e6-pending-speech", scene_id: "room", active: true,
      source_entity_id: "keeper", lifecycle: "next_perception_only",
    }];
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E6 unsupported projectile authority", seed: mode,
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32,
    }, options);
    assert.equal(result.attempted_turn_count, attempts);
    assert.equal(result.committed_turn_count, 0);
    assert.equal(result.physical_step_blocked_reason, reason);
    assert.equal(result.reached_simulation_time, before.state.simulation_time);
    assert.equal(result.state_reconciliation_required, false);
    assert.ok(result.pending_breakpoint_confirmed);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "E6 unsupported processes retain exact durable bytes");
  } finally { await rm(root, { recursive: true, force: true }); }
}
{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e6-contact-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E6 Native contact cannot invoke Brain") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E6 Native contact bounded admission", seed: "e6-contact",
      initial_world_state: e6ProjectileWorld("contact"),
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    for (const [budget, horizon] of [[0, 1000], [32, 999]]) {
      const pending = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns: budget, target_horizon: at(horizon),
      }, options);
      assert.equal(pending.committed_turn_count, 0);
      assert.equal(pending.attempted_turn_count, 0);
      assert.equal(pending.target_horizon_claimed, false);
      assert.deepEqual(await bytes(), original, "budget/horizon cannot authorize premature contact");
    }
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 1, target_horizon: at(1000),
    }, options);
    assert.equal(result.committed_physical_step_count, 1);
    assert.equal(result.reached_simulation_time, at(1000));
    assert.equal(result.target_horizon_claimed, true);
    assert.equal(result.state_reconciliation_required, false);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.state.projectiles.projectile_e3.active, false);
    assert.equal(after.state.projectiles.projectile_e3.termination_reason, "character_contact");
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, 1);
    const turn = history.turns[0];
    assert.equal(turn.next_state_hash, after.state_hash);
    assert.equal(result.committed_turns[0].next_state_hash, turn.next_state_hash);
    assert.equal(turn.previous_state_hash, before.state_hash);
    assert.deepEqual(turn.selected_action_intents, []);
    assert.deepEqual(turn.knowledge_transitions, []);
    assert.ok(turn.chronological_mutation_execution.execution_hash);
    const hit = turn.action_outcomes.find(item => item.result === "projectile_hit_character"
      && item.target === "aria");
    assert.ok(hit && hit.damage_applied > 0 && hit.health_after < hit.health_before);
    assert.equal(before.state.characters.aria.physical_state.health_current, 100);
    assert.equal(after.state.characters.aria.physical_state.health_current, hit.health_after);
    assert.ok(turn.state_transitions.some(item => item.entity === "aria"
      && item.field === "physical_state.health_current"
      && item.from === hit.health_before && item.to === hit.health_after));
    const committedBytes = await bytes();
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: at(1000),
    }, options), { code: "C6E_PHYSICAL_STEP_STALE" });
    assert.deepEqual(await bytes(), committedBytes, "stale contact admission cannot rewrite history");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E6 Native contact, budget/horizon and unsupported projectile authority regression passed.");

function e7MixedWorld(mode) {
  const state = e6ProjectileWorld("contact");
  state.projectiles.projectile_e3.velocity_mps = { x: 10, y: 0 };
  const field = d1Clone(e4FieldWorld().ability_fields.field_e3);
  field.center = d1Clone(state.scenes.room.entity_positions.aria);
  field.radius_m = 1;
  field.remaining_ms = mode === "field-first" ? 50 : mode === "projectile-first" ? 150 : 100;
  field.effect.damage_per_second = 20;
  state.ability_fields = { field_e3: field };
  return state;
}
for (const [mode, firstMs, fieldRemaining, projectileActive] of [
  ["field-first", 50, 0, true], ["projectile-first", 100, 50, false], ["tie", 100, 0, false],
]) {
  const state = e7MixedWorld(mode);
  const before = d1Clone(state);
  const discovery = projectWorldSimulationOffscreenBreakpoint({ world_state: state });
  assert.equal(discovery.breakpoint.delta_ms, firstMs);
  const first = await e4Resolve(state);
  assert.equal(first.next_world_state.simulation_time,
    new Date(Date.parse(state.simulation_time) + firstMs).toISOString());
  assert.equal(first.next_world_state.ability_fields.field_e3.remaining_ms, fieldRemaining);
  assert.equal(first.next_world_state.ability_fields.field_e3.active, fieldRemaining > 0);
  assert.equal(first.next_world_state.projectiles.projectile_e3.age_ms, firstMs);
  assert.equal(first.next_world_state.projectiles.projectile_e3.active, projectileActive);
  const fieldHits = first.action_outcomes.filter(item =>
    item.result === "ability_field_tick" && item.target === "aria");
  const projectileHits = first.action_outcomes.filter(item =>
    item.result === "projectile_hit_character" && item.target === "aria");
  assert.equal(fieldHits.length, 1);
  assert.equal(projectileHits.length, projectileActive ? 0 : 1);
  assert.ok(fieldHits[0].damage_applied > 0);
  const actualDamage = [...fieldHits, ...projectileHits]
    .reduce((total, hit) => total + hit.damage_applied, 0);
  assert.ok(Math.abs(first.next_world_state.characters.aria.physical_state.health_current
    - (100 - actualDamage)) < 1e-9, "both evaluator effects must persist exactly once");
  assert.deepEqual(state, before, "E7 input remains immutable");
  assert.deepEqual(await e4Resolve(state), first, "E7 same snapshot replays exactly");
  assert.deepEqual(first.next_world_state.event_queue, state.event_queue);
  assert.deepEqual(first.next_world_state.memories, state.memories);
  assert.deepEqual(first.next_world_state.motivational_goal_history, state.motivational_goal_history);
  assert.deepEqual(first.next_world_state.characters.aria.physical_state.sleep_arousal,
    state.characters.aria.physical_state.sleep_arousal);
  assert.ok(first.chronological_mutation_queue.queue_hash);
  assert.ok(first.chronological_mutation_execution.execution_hash);
  assert.deepEqual(first.knowledge_transitions, []);
}
{
  const state = e7MixedWorld("tie");
  const inactiveField = { ...d1Clone(state.ability_fields.field_e3),
    field_id: "inactive-field", active: false };
  const inactiveProjectile = { ...d1Clone(state.projectiles.projectile_e3),
    projectile_id: "inactive-projectile", active: false };
  state.ability_fields = { z: inactiveField, field_e3: state.ability_fields.field_e3 };
  state.projectiles = { z: inactiveProjectile, projectile_e3: state.projectiles.projectile_e3 };
  const first = await e4Resolve(state);
  state.ability_fields = Object.fromEntries(Object.entries(state.ability_fields).reverse());
  state.projectiles = Object.fromEntries(Object.entries(state.projectiles).reverse());
  assert.deepEqual(await e4Resolve(state), first, "map insertion cannot reorder mixed effects");
}
for (const [mode, horizonMs, totalCommits] of [
  ["field-first", 100, 2], ["projectile-first", 150, 2], ["tie", 100, 1],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e7-mixed-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E7 mixed physics must not invoke Brain") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E7 Native mixed physical boundaries", seed: mode,
      initial_world_state: e7MixedWorld(mode),
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    const firstMs = mode === "field-first" ? 50 : 100;
    for (const [budget, horizon] of [[0, horizonMs], [32, firstMs - 1]]) {
      const result = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns: budget, target_horizon: at(horizon),
      }, options);
      assert.equal(result.committed_turn_count, 0);
      assert.equal(result.attempted_turn_count, 0);
      assert.equal(result.target_horizon_claimed, false);
      assert.deepEqual(await bytes(), original, "E7 budget/horizon preserve durable bytes");
    }
    const first = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 1, target_horizon: at(horizonMs),
    }, options);
    assert.equal(first.committed_physical_step_count, 1);
    assert.equal(first.reached_simulation_time, at(firstMs));
    assert.equal(first.target_horizon_claimed, firstMs === horizonMs);
    assert.equal(first.state_reconciliation_required, false);
    const rest = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, target_horizon: at(horizonMs),
    }, options);
    assert.equal(rest.committed_physical_step_count, totalCommits - 1);
    assert.equal(rest.reached_simulation_time, at(horizonMs));
    assert.equal(rest.target_horizon_claimed, true);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + totalCommits);
    assert.equal(after.state.projectiles.projectile_e3.active, false);
    assert.equal(after.state.projectiles.projectile_e3.termination_reason, "character_contact");
    assert.equal(after.state.projectiles.projectile_e3.age_ms, 100);
    assert.equal(after.state.ability_fields.field_e3.active, false);
    assert.equal(after.state.ability_fields.field_e3.remaining_ms, 0);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, totalCommits);
    const completed = [...first.committed_turns, ...rest.committed_turns];
    for (let i = 0; i < history.turns.length; i += 1) {
      const turn = history.turns[i];
      assert.equal(turn.previous_state_hash, i ? history.turns[i - 1].next_state_hash : before.state_hash);
      assert.equal(turn.next_state_hash, completed[i].next_state_hash);
      assert.deepEqual(turn.selected_action_intents, []);
      assert.deepEqual(turn.knowledge_transitions, []);
      assert.ok(turn.chronological_mutation_execution.execution_hash);
    }
    assert.equal(history.turns.at(-1).next_state_hash, after.state_hash);
    const hits = history.turns.flatMap(turn => turn.action_outcomes).filter(item =>
      item.target === "aria" && ["projectile_hit_character", "ability_field_tick"].includes(item.result));
    assert.equal(hits.filter(item => item.result === "projectile_hit_character").length, 1);
    const actualDamage = hits.reduce((sum, hit) => sum + hit.damage_applied, 0);
    assert.ok(Math.abs(after.state.characters.aria.physical_state.health_current
      - (100 - actualDamage)) < 1e-9, "Native history and durable combined damage agree");
    const committedBytes = await bytes();
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: at(horizonMs),
    }, options), { code: "C6E_PHYSICAL_STEP_STALE" });
    assert.deepEqual(await bytes(), committedBytes, "stale mixed step cannot duplicate damage");
    const idle = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, target_horizon: at(horizonMs + 100),
    }, options);
    assert.equal(idle.committed_turn_count, 0);
    assert.equal(idle.reached_simulation_time, at(horizonMs));
    assert.equal(idle.target_horizon_claimed, false);
    assert.deepEqual(await bytes(), committedBytes, "inactive mixed processes cannot authorize time");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E7 mixed field/projectile order, ties, Native damage, budget and lineage regression passed.");

// Compare the offscreen shared bound with an ordinary causal turn of the same duration.
for (const mode of ["field-first", "projectile-first", "tie"]) {
  const state = e7MixedWorld(mode);
  const physical = await e4Resolve(state);
  const elapsed = Date.parse(physical.next_world_state.simulation_time) - Date.parse(state.simulation_time);
  const foreground = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: "e7-foreground", world_state: state,
    world_state_revision: 0, world_state_hash: hashAgentRunValue(state),
    turn_id: "e7-foreground", event: { event_id: "e7-foreground", scene_id: "room", type: "bounded_wait" },
    selected_action_intents: [{ character: "keeper", candidate: {
      action_id: "e7-wait", intent: "remain still", duration_ms: elapsed,
    } }],
  });
  assert.equal(foreground.next_world_state.simulation_time, physical.next_world_state.simulation_time);
  assert.deepEqual(foreground.next_world_state.projectiles, physical.next_world_state.projectiles);
  assert.deepEqual(foreground.next_world_state.ability_fields, physical.next_world_state.ability_fields);
  assert.equal(foreground.next_world_state.characters.aria.physical_state.health_current,
    physical.next_world_state.characters.aria.physical_state.health_current,
    "foreground and offscreen damage agree at the shared bound");
}
for (const [mode, reason, attempts] of [
  ["obstacles", "physical_step_projectile_obstacle_progression_pending", 1],
  ["geometry", "physical_step_field_geometry_unresolved", 1],
  ["scenes", "physical_step_scene_scope_unresolved", 1],
  ["unresolved", null, 0],
  ["due-now", "physical_step_same_time_or_fractional_pending", 1],
  ["fractional", null, 0],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e7-pending-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("unsupported mixed authority cannot invoke Brain") };
  try {
    const initial = e7MixedWorld("tie");
    if (mode === "obstacles") initial.scenes.room.obstacles = [{ obstacle_id: "e7-unmodeled" }];
    if (mode === "geometry") delete initial.ability_fields.field_e3.center;
    if (mode === "scenes") {
      initial.scenes.other = d1Clone(initial.scenes.room);
      initial.ability_fields.field_e3.scene_id = "other";
    }
    if (mode === "unresolved") delete initial.projectiles.projectile_e3.velocity_mps;
    if (mode === "due-now") initial.projectiles.projectile_e3.age_ms = initial.projectiles.projectile_e3.max_lifetime_ms;
    if (mode === "fractional") initial.ability_fields.field_e3.remaining_ms = 0.5;
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E7 unsupported mixed authority", seed: mode, initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32,
    }, options);
    assert.equal(result.attempted_turn_count, attempts);
    assert.equal(result.committed_turn_count, 0);
    assert.equal(result.physical_step_blocked_reason, reason);
    assert.equal(result.reached_simulation_time, before.state.simulation_time);
    assert.equal(result.state_reconciliation_required, false);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "unsupported mixed authority preserves durable state/history");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E7 foreground equivalence and unsupported mixed authority regression passed.");

function e8ExpiredWorld() {
  const state = e6ProjectileWorld("lifetime");
  state.projectiles.projectile_e3.age_ms = 300;
  return state;
}
{
  const state = e8ExpiredWorld();
  const original = d1Clone(state);
  const due = state.projectiles.projectile_e3;
  const first = await e4Resolve(state, state.simulation_time);
  const terminated = first.next_world_state.projectiles.projectile_e3;
  assert.equal(terminated.active, false);
  assert.equal(terminated.termination_reason, "lifetime_expired");
  assert.equal(first.next_world_state.simulation_time, state.simulation_time);
  assert.equal(terminated.age_ms, due.age_ms);
  assert.deepEqual(terminated.position, due.position);
  assert.equal(terminated.remaining_penetration_energy, due.remaining_penetration_energy);
  assert.deepEqual(first.next_world_state.characters, state.characters);
  assert.deepEqual(first.next_world_state.event_queue, state.event_queue);
  assert.deepEqual(first.next_world_state.memories, state.memories);
  assert.deepEqual(first.next_world_state.motivational_goal_history, state.motivational_goal_history);
  const effects = first.state_transitions.filter(item => item.field === "projectile_state");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].time_ms, 0);
  assert.equal(effects[0].lifecycle_effect, "termination");
  assert.deepEqual(effects[0].from, due);
  assert.deepEqual(effects[0].to, terminated);
  assert.equal(first.action_outcomes.filter(item => item.result === "projectile_lifetime_expired").length, 1);
  assert.ok(first.chronological_mutation_queue.queue_hash);
  assert.ok(first.chronological_mutation_execution.execution_hash);
  assert.deepEqual(await e4Resolve(state, state.simulation_time), first);
  assert.deepEqual(state, original, "E8 zero-time termination owns immutable input");
  assert.equal((await e4Resolve(first.next_world_state)).blocked_reason, "physical_step_no_breakpoint");
  const forged = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: "e8-forged", world_state: state,
    world_state_revision: 0, world_state_hash: hashAgentRunValue(state), turn_id: "e8-forged",
    event: { event_id: "e8-forged", scene_id: "room", type: "offscreen_physical_process_step" },
    selected_action_intents: [], drain_expired_projectiles_at_current_time: true,
    zero_time_lifetime_drain: true,
  });
  assert.equal(forged.next_world_state.projectiles.projectile_e3.active, true,
    "public causal input cannot forge the private World step context");
  assert.equal(forged.next_world_state.simulation_time, state.simulation_time);
}
{
  const state = e8ExpiredWorld();
  const due = state.projectiles.projectile_e3;
  const alpha = { ...d1Clone(due), projectile_id: "alpha" };
  const zeta = { ...d1Clone(due), projectile_id: "zeta" };
  const live = { ...d1Clone(due), projectile_id: "live", age_ms: 0, velocity_mps: { x: 0, y: 0 } };
  state.projectiles = { zeta, live, alpha };
  const first = await e4Resolve(state, state.simulation_time);
  assert.equal(first.next_world_state.projectiles.alpha.active, false);
  assert.equal(first.next_world_state.projectiles.zeta.active, false);
  assert.deepEqual(first.next_world_state.projectiles.live, live,
    "zero-time drain cannot advance or terminate a future process");
  assert.equal(first.action_outcomes.filter(item => item.result === "projectile_lifetime_expired").length, 2);
  state.projectiles = { alpha, live, zeta };
  assert.deepEqual(await e4Resolve(state, state.simulation_time), first,
    "same-time lifetime batch cannot depend on map insertion order");
}
for (const mode of ["already-due", "flight-then-due"]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e8-lifetime-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E8 zero-time lifetime must not invoke Brain") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E8 direct Native zero-time lifetime", seed: mode,
      initial_world_state: mode === "already-due" ? e8ExpiredWorld() : e6ProjectileWorld("lifetime"),
    }, options);
    const sid = session.world_simulation_session_id;
    let before = await getWorldSimulationState(sid, options);
    const original = before;
    if (mode === "flight-then-due") {
      const flight = await runWorldSimulationOffscreenPhysicalStep({
        world_simulation_session_id: sid, expected_revision: before.revision,
        expected_state_hash: before.state_hash,
      }, options);
      assert.equal(flight.committed, true);
      before = await getWorldSimulationState(sid, options);
      assert.equal(before.state.projectiles.projectile_e3.age_ms, 300);
      assert.equal(before.state.projectiles.projectile_e3.active, true);
    }
    const reached = before.state.simulation_time;
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const priorBytes = await bytes();
    // A zero budget must preserve E8's direct Native fixture; E9 covers positive budgets.
    for (const max_turns of [0]) {
      const pending = await runWorldSimulationOffscreenEventBatch({
        world_simulation_session_id: sid, max_turns, target_horizon: reached,
      }, options);
      assert.equal(pending.committed_turn_count, 0);
      assert.equal(pending.attempted_turn_count, 0);
      assert.equal(pending.pending_breakpoint.delta_ms, 0);
      assert.equal(pending.target_horizon_claimed, true);
      assert.deepEqual(await bytes(), priorBytes);
    }
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, zero_time_lifetime_drain: true,
    }, options), { code: "C6E_PHYSICAL_STEP_INVALID" });
    assert.deepEqual(await bytes(), priorBytes, "Native cannot accept caller-owned drain flags");
    const result = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: reached,
    }, options);
    assert.equal(result.committed, true);
    assert.equal(result.reached_simulation_time, reached);
    assert.equal(result.previous_state_hash, before.state_hash);
    assert.equal(result.automatic_replay_allowed, false);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + 1);
    assert.notEqual(after.state_hash, before.state_hash);
    assert.equal(after.state.simulation_time, reached);
    assert.equal(after.state.projectiles.projectile_e3.active, false);
    assert.equal(after.state.projectiles.projectile_e3.termination_reason, "lifetime_expired");
    assert.equal(after.state.projectiles.projectile_e3.age_ms, 300);
    assert.deepEqual(after.state.projectiles.projectile_e3.position, before.state.projectiles.projectile_e3.position);
    assert.deepEqual(after.state.characters, before.state.characters);
    assert.deepEqual(after.state.event_queue, before.state.event_queue);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, mode === "already-due" ? 1 : 2);
    const turn = history.turns.at(-1);
    assert.equal(turn.turn_id, result.turn_id);
    assert.equal(turn.previous_state_hash, before.state_hash);
    assert.equal(turn.next_state_hash, after.state_hash);
    assert.equal(history.turns[0].previous_state_hash, original.state_hash);
    if (history.turns.length === 2) assert.equal(history.turns[0].next_state_hash, turn.previous_state_hash);
    assert.deepEqual(turn.selected_action_intents, []);
    assert.deepEqual(turn.knowledge_transitions, []);
    assert.ok(turn.chronological_mutation_execution.execution_hash);
    assert.ok(turn.state_transitions.some(item => item.field === "projectile_state"
      && item.lifecycle_effect === "termination" && item.time_ms === 0));
    const committedBytes = await bytes();
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: reached,
    }, options), { code: "C6E_PHYSICAL_STEP_STALE" });
    assert.deepEqual(await bytes(), committedBytes, "old CAS cannot duplicate termination");
    const idle = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: after.revision,
      expected_state_hash: after.state_hash, target_horizon: reached,
    }, options);
    assert.equal(idle.committed, false);
    assert.equal(idle.blocked_reason, "physical_step_no_breakpoint");
    assert.deepEqual(await bytes(), committedBytes, "terminated process cannot create a second history turn");
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const [mode, reason] of [
  ["fields", "physical_step_same_time_or_fractional_pending"],
  ["obstacles", "physical_step_projectile_obstacle_progression_pending"],
  ["queue", "physical_step_queue_not_empty"],
  ["acoustic", "physical_step_acoustic_ingress_pending"],
  ["scenes", "physical_step_scene_scope_unresolved"],
  ["unresolved", "physical_step_authority_unresolved"],
]) {
  const initial = e8ExpiredWorld();
  if (mode === "fields") initial.ability_fields = e4FieldWorld().ability_fields;
  if (mode === "obstacles") initial.scenes.room.obstacles = [{ obstacle_id: "e8-unmodeled" }];
  if (mode === "queue") initial.event_queue = [{ event_id: "e8-pending" }];
  if (mode === "acoustic") initial.sound_events = [{
    schema_version: "cc6b-communication-acoustic-bridge-v1",
    sound_id: "e8-pending-speech", scene_id: "room", active: true,
  }];
  if (mode === "scenes") {
    initial.scenes.other = d1Clone(initial.scenes.room);
    initial.projectiles.other = { ...d1Clone(initial.projectiles.projectile_e3),
      projectile_id: "other", scene_id: "other" };
  }
  if (mode === "unresolved") delete initial.projectiles.projectile_e3.velocity_mps;
  const original = d1Clone(initial);
  assert.equal((await e4Resolve(initial)).blocked_reason, reason);
  assert.deepEqual(initial, original, "unsupported zero-time authority stays immutable");
}
console.log("CB-C6-E8 direct Native zero-time lifetime, replay, lineage and batch-policy preservation regression passed.");

const e9Cases = [
  ["due", 0, 0], ["due", 1, 0], ["due", 32, 0],
  ["due", 1, 500], ["due", 32, null],
  ["flight", 0, 300], ["flight", 1, 300], ["flight", 2, 300], ["flight", 32, 300],
  ["flight", 2, 500], ["flight", 32, null], ["flight", 32, 299],
];
for (const [mode, budget, horizonMs] of e9Cases) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e9-${mode}-${budget}-${horizonMs}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E9 batch lifetime must not invoke Brain") };
  try {
    const initial = mode === "due" ? e8ExpiredWorld() : e6ProjectileWorld("lifetime");
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E9 bounded batch lifetime", seed: `${mode}-${budget}-${horizonMs}`,
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    const target = horizonMs === null ? {} : { target_horizon: at(horizonMs) };
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const originalBytes = await bytes();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: budget, ...target,
    }, options);
    const crossCeiling = mode === "flight" && horizonMs === 299;
    const required = mode === "due" ? 1 : 2;
    const commits = crossCeiling ? 0 : Math.min(budget, required);
    const elapsed = mode === "flight" && commits > 0 ? 300 : 0;
    assert.equal(result.attempted_turn_count, commits);
    assert.equal(result.committed_turn_count, commits);
    assert.equal(result.committed_physical_step_count, commits);
    assert.equal(result.reached_simulation_time, at(elapsed));
    assert.equal(result.target_horizon_claimed, horizonMs !== null && horizonMs === elapsed);
    assert.equal(result.state_reconciliation_required, false);
    assert.equal(result.automatic_replay_allowed, false);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + commits);
    assert.equal(after.state.simulation_time, at(elapsed), "no epsilon beyond actual flight");
    assert.equal(after.state.projectiles.projectile_e3.active, commits < required);
    assert.equal(after.state.projectiles.projectile_e3.age_ms,
      mode === "due" || elapsed ? 300 : 0);
    if (mode === "due") assert.deepEqual(after.state.projectiles.projectile_e3.position,
      before.state.projectiles.projectile_e3.position);
    assert.deepEqual(after.state.characters, before.state.characters);
    assert.deepEqual(after.state.event_queue, before.state.event_queue);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    if (!commits) assert.deepEqual(await bytes(), originalBytes);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, commits);
    for (let i = 0; i < commits; i++) {
      const turn = history.turns[i], entry = result.committed_turns[i];
      assert.equal(entry.execution_kind, "physical_process_step");
      assert.equal(entry.turn_id, turn.turn_id);
      assert.equal(entry.previous_state_hash, turn.previous_state_hash);
      assert.equal(entry.next_state_hash, turn.next_state_hash);
      assert.equal(turn.previous_state_hash, i ? history.turns[i - 1].next_state_hash : before.state_hash);
      assert.deepEqual(turn.selected_action_intents, []);
      assert.deepEqual(turn.knowledge_transitions, []);
      assert.ok(turn.chronological_mutation_execution.execution_hash);
    }
    if (commits < required && !crossCeiling) assert.ok(result.pending_breakpoint_confirmed);
    else if (!crossCeiling) {
      assert.equal(result.pending_breakpoint, null);
      assert.equal(after.state.projectiles.projectile_e3.termination_reason, "lifetime_expired");
      const terminations = history.turns.flatMap(turn => turn.state_transitions)
        .filter(item => item.field === "projectile_state" && item.lifecycle_effect === "termination");
      assert.equal(terminations.length, 1);
      assert.equal(terminations[0].time_ms, 0);
    }
    if (crossCeiling) {
      assert.equal(result.physical_step_blocked_reason, null);
      assert.equal(result.pending_breakpoint, null);
      assert.equal(result.status, "no_pending_event");
      continue;
    }
    const rest = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, ...target,
    }, options);
    assert.equal(rest.committed_turn_count, required - commits);
    assert.equal(rest.attempted_turn_count, required - commits);
    assert.equal(rest.reached_simulation_time, at(mode === "due" ? 0 : 300));
    const final = await getWorldSimulationState(sid, options);
    assert.equal(final.revision, before.revision + required);
    assert.equal(final.state.projectiles.projectile_e3.active, false);
    const finalHistory = await getWorldSimulationHistory(sid, options);
    assert.equal(finalHistory.turns.length, required);
    assert.equal(finalHistory.turns.at(-1).next_state_hash, final.state_hash);
    if (required === 2) assert.equal(finalHistory.turns[1].previous_state_hash,
      finalHistory.turns[0].next_state_hash);
    const finalBytes = await bytes();
    const idle = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, ...target,
    }, options);
    assert.equal(idle.attempted_turn_count, 0);
    assert.equal(idle.committed_turn_count, 0);
    assert.equal(idle.reached_simulation_time, final.state.simulation_time);
    assert.deepEqual(await bytes(), finalBytes, "terminated batch cannot duplicate history or invent time");
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const [mode, reason, attempts] of [
  ["fields", "physical_step_same_time_or_fractional_pending", 1],
  ["obstacles", "physical_step_projectile_obstacle_progression_pending", 1],
  ["acoustic", "physical_step_acoustic_ingress_pending", 1],
  ["queue", null, 0],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e9-pending-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E9 unsupported same-time work stays pending") };
  try {
    const initial = e8ExpiredWorld();
    if (mode === "fields") initial.ability_fields = e4FieldWorld().ability_fields;
    if (mode === "obstacles") initial.scenes.room.obstacles = [{ obstacle_id: "e9-unmodeled" }];
    if (mode === "acoustic") initial.sound_events = [{
      schema_version: "cc6b-communication-acoustic-bridge-v1",
      sound_id: "e9-pending", scene_id: "room", active: true,
    }];
    if (mode === "queue") initial.event_queue = [{ event_id: "e9-pending" }];
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E9 unsupported same-time", seed: mode, initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, target_horizon: before.state.simulation_time,
    }, options);
    assert.equal(result.attempted_turn_count, attempts);
    assert.equal(result.committed_turn_count, 0);
    assert.equal(result.physical_step_blocked_reason, reason);
    assert.equal(result.target_horizon_claimed, true);
    assert.equal(result.state_reconciliation_required, false);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "E9 cannot broaden unsupported or queued authority");
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E9 bounded same-time batch lifetime, budget/horizon, history and idle regression passed.");

import { queryWorldSimulationProjectileNextEvent } from "../../server/src/world-simulation-immutable-event-query-service.mjs";
for (const [position, velocity, due] of [
  [{ x: 8, y: 4 }, { x: 1, y: 0 }, true],
  [{ x: 0, y: 4 }, { x: -1, y: 0 }, true],
  [{ x: 4, y: 8 }, { x: 0, y: 1 }, true],
  [{ x: 4, y: 0 }, { x: 0, y: -1 }, true],
  [{ x: 8, y: 4 }, { x: -1, y: 0 }, false],
  [{ x: 8, y: 4 }, { x: 0, y: 0 }, false],
]) {
  const projectile = { ...e6ProjectileWorld("bounds").projectiles.projectile_e3,
    position, velocity_mps: velocity };
  const input = { projectile, scene: { dimensions: { width_m: 8, depth_m: 8 }, obstacles: [] },
    character_motion_profiles: [], current_time_ms: 0, active_end_ms: 0 };
  const original = d1Clone(input);
  const result = queryWorldSimulationProjectileNextEvent(input);
  assert.equal(result.result.event.kind, due ? "bounds" : "advance_end");
  assert.equal(result.result.event.timeMs, 0);
  assert.deepEqual(queryWorldSimulationProjectileNextEvent(input), result);
  assert.deepEqual(input, original);
}
async function e10BoundsWorld() {
  return (await e4Resolve(e6ProjectileWorld("bounds"))).next_world_state;
}
{
  const initial = await e10BoundsWorld(), original = d1Clone(initial);
  const result = await e4Resolve(initial, initial.simulation_time);
  assert.equal(result.next_world_state.projectiles.projectile_e3.active, false);
  assert.equal(result.next_world_state.projectiles.projectile_e3.termination_reason, "left_scene_bounds");
  assert.equal(result.next_world_state.simulation_time, initial.simulation_time);
  assert.equal(result.next_world_state.projectiles.projectile_e3.age_ms, 500);
  assert.deepEqual(result.next_world_state.projectiles.projectile_e3.position,
    initial.projectiles.projectile_e3.position);
  assert.equal(result.next_world_state.projectiles.projectile_e3.remaining_penetration_energy,
    initial.projectiles.projectile_e3.remaining_penetration_energy);
  assert.deepEqual(result.next_world_state.characters, initial.characters);
  assert.deepEqual(result.next_world_state.memories, initial.memories);
  assert.deepEqual(result.next_world_state.motivational_goal_history, initial.motivational_goal_history);
  assert.deepEqual(result.next_world_state.event_queue, initial.event_queue);
  const effects = result.state_transitions.filter(item =>
    item.field === "projectile_state" && item.lifecycle_effect === "termination");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].time_ms, 0);
  assert.ok(result.chronological_mutation_execution.execution_hash);
  assert.deepEqual(await e4Resolve(initial, initial.simulation_time), result);
  assert.deepEqual(initial, original);
  assert.equal((await e4Resolve(result.next_world_state)).blocked_reason, "physical_step_no_breakpoint");
  const forged = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: "e10-forged", world_state: initial,
    world_state_revision: 0, world_state_hash: hashAgentRunValue(initial), turn_id: "e10-forged",
    event: { event_id: "e10-forged", scene_id: "room", type: "offscreen_physical_process_step" },
    selected_action_intents: [], drain_projectile_terminations_at_current_time: true,
    zero_time_projectile_termination_drain: true,
  });
  assert.equal(forged.next_world_state.projectiles.projectile_e3.active, true);
  assert.equal(forged.next_world_state.simulation_time, initial.simulation_time);
  const p = initial.projectiles.projectile_e3;
  const alpha = { ...d1Clone(p), projectile_id: "alpha" };
  const zeta = { ...d1Clone(p), projectile_id: "zeta", position: { x: 7, y: 4 },
    age_ms: p.max_lifetime_ms };
  const live = { ...d1Clone(p), projectile_id: "live", position: { x: 7, y: 4 },
    velocity_mps: { x: 0, y: 0 } };
  initial.projectiles = { zeta, live, alpha };
  const multiple = await e4Resolve(initial, initial.simulation_time);
  assert.equal(multiple.next_world_state.projectiles.alpha.termination_reason, "left_scene_bounds");
  assert.equal(multiple.next_world_state.projectiles.zeta.termination_reason, "lifetime_expired");
  assert.deepEqual(multiple.next_world_state.projectiles.live, live);
  initial.projectiles = { alpha, live, zeta };
  assert.deepEqual(await e4Resolve(initial, initial.simulation_time), multiple);
}
for (const mode of ["already-due", "flight-then-due"]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e10-bounds-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E10 boundary termination must not invoke Brain") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E10 Native boundary termination", seed: mode,
      initial_world_state: mode === "already-due" ? await e10BoundsWorld() : e6ProjectileWorld("bounds"),
    }, options);
    const sid = session.world_simulation_session_id;
    let before = await getWorldSimulationState(sid, options);
    const firstHash = before.state_hash;
    if (mode === "flight-then-due") {
      const flight = await runWorldSimulationOffscreenPhysicalStep({
        world_simulation_session_id: sid, expected_revision: before.revision,
        expected_state_hash: before.state_hash,
      }, options);
      assert.equal(flight.committed, true);
      before = await getWorldSimulationState(sid, options);
      assert.equal(before.state.projectiles.projectile_e3.active, true);
      assert.equal(before.state.projectiles.projectile_e3.age_ms, 500);
    }
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const prior = await bytes();
    const batch = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 0, target_horizon: before.state.simulation_time,
    }, options);
    assert.equal(batch.committed_turn_count, 0);
    assert.equal(batch.attempted_turn_count, 0);
    assert.equal(batch.pending_breakpoint.kind, "projectile_bounds");
    assert.deepEqual(await bytes(), prior, "zero-budget bounds discovery cannot commit");
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, zero_time_projectile_termination_drain: true,
    }, options), { code: "C6E_PHYSICAL_STEP_INVALID" });
    assert.deepEqual(await bytes(), prior);
    const committed = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: before.state.simulation_time,
    }, options);
    assert.equal(committed.committed, true);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + 1);
    assert.notEqual(after.state_hash, before.state_hash);
    assert.equal(after.state.simulation_time, before.state.simulation_time);
    assert.equal(after.state.projectiles.projectile_e3.active, false);
    assert.equal(after.state.projectiles.projectile_e3.termination_reason, "left_scene_bounds");
    assert.equal(after.state.projectiles.projectile_e3.age_ms, 500);
    assert.deepEqual(after.state.projectiles.projectile_e3.position, before.state.projectiles.projectile_e3.position);
    assert.deepEqual(after.state.characters, before.state.characters);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    assert.deepEqual(after.state.event_queue, before.state.event_queue);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, mode === "already-due" ? 1 : 2);
    assert.equal(history.turns[0].previous_state_hash, firstHash);
    const turn = history.turns.at(-1);
    assert.equal(turn.turn_id, committed.turn_id);
    assert.equal(turn.previous_state_hash, before.state_hash);
    assert.equal(turn.next_state_hash, after.state_hash);
    assert.deepEqual(turn.selected_action_intents, []);
    assert.deepEqual(turn.knowledge_transitions, []);
    assert.ok(turn.state_transitions.some(item => item.field === "projectile_state"
      && item.lifecycle_effect === "termination" && item.time_ms === 0));
    if (history.turns.length === 2) assert.equal(history.turns[0].next_state_hash, turn.previous_state_hash);
    const finalBytes = await bytes();
    await assert.rejects(runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash,
    }, options), { code: "C6E_PHYSICAL_STEP_STALE" });
    assert.deepEqual(await bytes(), finalBytes);
    const idle = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: after.revision,
      expected_state_hash: after.state_hash,
    }, options);
    assert.equal(idle.committed, false);
    assert.equal(idle.blocked_reason, "physical_step_no_breakpoint");
    assert.deepEqual(await bytes(), finalBytes);
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const [mode, reason] of [
  ["fields", "physical_step_same_time_or_fractional_pending"],
  ["obstacles", "physical_step_projectile_obstacle_progression_pending"],
  ["queue", "physical_step_queue_not_empty"],
  ["acoustic", "physical_step_acoustic_ingress_pending"],
  ["scenes", "physical_step_scene_scope_unresolved"],
  ["unresolved", "physical_step_authority_unresolved"],
]) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e10-pending-${mode}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E10 unsupported bounds must not invoke Brain") };
  try {
    const initial = await e10BoundsWorld();
    if (mode === "fields") initial.ability_fields = e4FieldWorld().ability_fields;
    if (mode === "obstacles") initial.scenes.room.obstacles = [{ obstacle_id: "e10-unmodeled" }];
    if (mode === "queue") initial.event_queue = [{ event_id: "e10-pending" }];
    if (mode === "acoustic") initial.sound_events = [{
      schema_version: "cc6b-communication-acoustic-bridge-v1",
      sound_id: "e10-pending-speech", scene_id: "room", active: true,
    }];
    if (mode === "scenes") {
      initial.scenes.other = d1Clone(initial.scenes.room);
      initial.projectiles.other = { ...d1Clone(initial.projectiles.projectile_e3),
        projectile_id: "other", scene_id: "other" };
    }
    if (mode === "unresolved") delete initial.projectiles.projectile_e3.velocity_mps;
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E10 unsupported boundary authority", seed: mode,
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const result = await runWorldSimulationOffscreenPhysicalStep({
      world_simulation_session_id: sid, expected_revision: before.revision,
      expected_state_hash: before.state_hash, target_horizon: before.state.simulation_time,
    }, options);
    assert.equal(result.committed, false);
    assert.equal(result.blocked_reason, reason);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "unsupported boundary authority preserves durable bytes");
    const batch = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, target_horizon: before.state.simulation_time,
    }, options);
    assert.equal(batch.committed_turn_count, 0);
    assert.equal(batch.state_reconciliation_required, false);
    assert.equal(batch.target_horizon_claimed, true);
    if (batch.attempted_turn_count) assert.equal(batch.physical_step_blocked_reason, reason);
    if (mode === "queue" || mode === "unresolved") assert.equal(batch.attempted_turn_count, 0);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "E11 unsupported batch preserves durable bytes");

  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E10 direct Native zero-time bounds, immutable query, replay, lineage and batch preservation passed.");

const e11Cases = [
  ["due", 0, 0], ["due", 1, 0], ["due", 32, 0],
  ["due", 1, 500], ["due", 32, null],
  ["flight", 0, null], ["flight", 1, null], ["flight", 2, null], ["flight", 32, null],
  ["flight", 32, 499],
];
for (const [mode, budget, horizonMs] of e11Cases) {
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e11-${mode}-${budget}-${horizonMs}-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E11 batch bounds must not invoke Brain") };
  try {
    const initial = mode === "due" ? await e10BoundsWorld() : e6ProjectileWorld("bounds");
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E11 bounded batch bounds", seed: `${mode}-${budget}-${horizonMs}`,
      initial_world_state: initial,
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const at = ms => new Date(Date.parse(before.state.simulation_time) + ms).toISOString();
    const target = horizonMs === null ? {} : { target_horizon: at(horizonMs) };
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const originalBytes = await bytes();
    const result = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: budget, ...target,
    }, options);
    const crossCeiling = mode === "flight" && horizonMs === 499;
    const required = mode === "due" ? 1 : 2;
    const commits = crossCeiling ? 0 : Math.min(budget, required);
    const elapsed = mode === "flight" && commits > 0 ? 500 : 0;
    assert.equal(result.attempted_turn_count, commits);
    assert.equal(result.committed_turn_count, commits);
    assert.equal(result.committed_physical_step_count, commits);
    assert.equal(result.reached_simulation_time, at(elapsed));
    assert.equal(result.target_horizon_claimed, horizonMs !== null && horizonMs === elapsed);
    assert.equal(result.state_reconciliation_required, false);
    assert.equal(result.automatic_replay_allowed, false);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + commits);
    assert.equal(after.state.simulation_time, at(elapsed), "no epsilon beyond actual flight");
    assert.equal(after.state.projectiles.projectile_e3.active, commits < required);
    assert.equal(after.state.projectiles.projectile_e3.age_ms,
      mode === "due" || elapsed ? 500 : 0);
    if (mode === "due") assert.deepEqual(after.state.projectiles.projectile_e3.position,
      before.state.projectiles.projectile_e3.position);
    assert.deepEqual(after.state.characters, before.state.characters);
    assert.deepEqual(after.state.event_queue, before.state.event_queue);
    assert.deepEqual(after.state.memories, before.state.memories);
    assert.deepEqual(after.state.motivational_goal_history, before.state.motivational_goal_history);
    if (!commits) assert.deepEqual(await bytes(), originalBytes);
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, commits);
    for (let i = 0; i < commits; i++) {
      const turn = history.turns[i], entry = result.committed_turns[i];
      assert.equal(entry.execution_kind, "physical_process_step");
      assert.equal(entry.turn_id, turn.turn_id);
      assert.equal(entry.previous_state_hash, turn.previous_state_hash);
      assert.equal(entry.next_state_hash, turn.next_state_hash);
      assert.equal(turn.previous_state_hash, i ? history.turns[i - 1].next_state_hash : before.state_hash);
      assert.deepEqual(turn.selected_action_intents, []);
      assert.deepEqual(turn.knowledge_transitions, []);
      assert.ok(turn.chronological_mutation_execution.execution_hash);
    }
    if (commits < required && !crossCeiling) assert.ok(result.pending_breakpoint_confirmed);
    else if (!crossCeiling) {
      assert.equal(result.pending_breakpoint, null);
      assert.equal(after.state.projectiles.projectile_e3.termination_reason, "left_scene_bounds");
      const terminations = history.turns.flatMap(turn => turn.state_transitions)
        .filter(item => item.field === "projectile_state" && item.lifecycle_effect === "termination");
      assert.equal(terminations.length, 1);
      assert.equal(terminations[0].time_ms, 0);
    }
    if (crossCeiling) {
      assert.equal(result.physical_step_blocked_reason, null);
      assert.equal(result.pending_breakpoint, null);
      assert.equal(result.status, "no_pending_event");
      continue;
    }
    const rest = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, ...target,
    }, options);
    assert.equal(rest.committed_turn_count, required - commits,
      JSON.stringify({ mode, budget, horizonMs, rest }));
    assert.equal(rest.attempted_turn_count, required - commits);
    assert.equal(rest.reached_simulation_time, at(mode === "due" ? 0 : 500));
    const final = await getWorldSimulationState(sid, options);
    assert.equal(final.revision, before.revision + required);
    assert.equal(final.state.projectiles.projectile_e3.active, false);
    const finalHistory = await getWorldSimulationHistory(sid, options);
    assert.equal(finalHistory.turns.length, required);
    assert.equal(finalHistory.turns.at(-1).next_state_hash, final.state_hash);
    if (required === 2) assert.equal(finalHistory.turns[1].previous_state_hash,
      finalHistory.turns[0].next_state_hash);
    const finalBytes = await bytes();
    const idle = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, ...target,
    }, options);
    assert.equal(idle.attempted_turn_count, 0);
    assert.equal(idle.committed_turn_count, 0);
    assert.equal(idle.reached_simulation_time, final.state.simulation_time);
    assert.deepEqual(await bytes(), finalBytes, "terminated batch cannot duplicate history or invent time");
  } finally { await rm(root, { recursive: true, force: true }); }
}
{
  const root = path.join(projectRoot, "tests", ".tmp",
    `c6-e11-fractional-discovery-${process.pid}-${Date.now()}`);
  const options = { fixtureRoot: root,
    characterBrain: async () => assert.fail("E11 cannot round fractional discovery into World time") };
  try {
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-E11 fractional bounded flight stays pending", seed: "e11-fractional",
      initial_world_state: e6ProjectileWorld("bounds"),
    }, options);
    const sid = session.world_simulation_session_id;
    const before = await getWorldSimulationState(sid, options);
    const target = new Date(Date.parse(before.state.simulation_time) + 500).toISOString();
    const discovery = projectWorldSimulationOffscreenBreakpoint({
      world_state: before.state, target_horizon: target,
    });
    assert.equal(discovery.breakpoint.kind, "projectile_bounds");
    assert.equal(Number.isSafeInteger(discovery.breakpoint.delta_ms), false,
      "the existing bounded query exposes fractional arithmetic; no rounding authority");
    const paths = worldSimulationStatePaths(sid, options);
    const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    const original = await bytes();
    const pending = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 32, target_horizon: target,
    }, options);
    assert.equal(pending.attempted_turn_count, 0);
    assert.equal(pending.committed_turn_count, 0);
    assert.equal(pending.status, "slow_process_breakpoint_pending");
    assert.equal(pending.target_horizon_claimed, false);
    assert.deepEqual(pending.pending_breakpoint, discovery.breakpoint);
    assert.deepEqual(await getWorldSimulationState(sid, options), before);
    assert.deepEqual(await bytes(), original, "fractional pending cannot alter durable bytes");
    // The existing untargeted owner confirms an exact 500ms step. Its flight
    // and zero-time termination remain two budgeted commits, never a rounded retry.
    const resumed = await runWorldSimulationOffscreenEventBatch({
      world_simulation_session_id: sid, max_turns: 2,
    }, options);
    assert.equal(resumed.attempted_turn_count, 2);
    assert.equal(resumed.committed_turn_count, 2);
    assert.equal(resumed.reached_simulation_time, target);
    const after = await getWorldSimulationState(sid, options);
    assert.equal(after.revision, before.revision + 2);
    assert.equal(after.state.projectiles.projectile_e3.termination_reason, "left_scene_bounds");
    const history = await getWorldSimulationHistory(sid, options);
    assert.equal(history.turns.length, 2);
    assert.equal(history.turns[0].previous_state_hash, before.state_hash);
    assert.equal(history.turns[1].previous_state_hash, history.turns[0].next_state_hash);
    assert.equal(history.turns[1].next_state_hash, after.state_hash);
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log("CB-C6-E11 bounded batch bounds, budget/horizon, history, idle and unsupported authority regression passed.");
