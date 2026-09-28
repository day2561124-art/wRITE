import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import {
  projectWorldSimulationBodyRespiratoryState,
  readCommittedWorldSimulationBodyRespiratoryState,
  buildWorldSimulationBodyRespiratoryStateContract,
} from "../server/src/world-simulation-body-respiratory-state-service.mjs";

const actor = "body1o-actor";
const initial = {
  characters: { [actor]: { physical_state: { respiratory_activity: true } } },
  scenes: { yard: { scene_id: "yard", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 1, y: 1 } } } },
  event_queue: [],
};
const changed = structuredClone(initial);
changed.characters[actor].physical_state.respiratory_activity = false;
const transition = {
  entity: actor, field: "physical_state.respiratory_activity", from: true, to: false,
};
const history = { turns: [{
  turn_id: "respiratory-turn", revision_to: 1,
  state_transitions: [transition],
  action_outcomes: [{ actor, action_id: "speak", result: "communication_emitted" }],
}] };
const project = (state = changed, transitions = [transition]) =>
  projectWorldSimulationBodyRespiratoryState({
    world_state: state,
    world_history: { turns: [{ ...history.turns[0], state_transitions: transitions }] },
    world_state_revision: 1, character: actor,
  });
const result = project();
assert.equal(result.respiratory_activity_sense.status,
  "respiratory_activity_signal_available");
assert.deepEqual(result.respiratory_feedback, [{
  modality: "respiratory_interoception",
  signal: "respiratory_activity_transition_detected",
  source_world_revision: 1,
}]);
assert.equal(JSON.stringify(result).includes('"respiratory_activity":false'), false);
assert.equal(result.boundaries.respiratory_capacity_inferred, false);
assert.equal(result.boundaries.subjective_breathlessness_asserted, false);
assert.equal(buildWorldSimulationBodyRespiratoryStateContract()
  .action_or_speech_infers_respiratory_activity, false);
for (const transitions of [
  [], [{ ...transition, entity: "someone-else" }],
  [{ ...transition, field: "physical_state.energy_current" }],
  [{ ...transition, from: false }],
  [{ ...transition, to: true }],
  [{ ...transition, from: null }],
]) assert.deepEqual(project(changed, transitions).respiratory_feedback, []);
assert.equal(project(changed, Array.from({ length: 100 }, () => transition))
  .respiratory_feedback.length, 1);
const absent = structuredClone(initial);
delete absent.characters[actor].physical_state.respiratory_activity;
assert.equal(project(absent, []).respiratory_activity_sense.status, "unavailable");
assert.deepEqual(project(absent, []).respiratory_feedback, []);
assert.deepEqual(projectWorldSimulationBodyRespiratoryState({
  world_state: initial, world_history: { turns: [] },
  world_state_revision: 0, character: actor,
}).respiratory_feedback, []);
assert.deepEqual(project(changed, [{ ...transition, to: 1 }]).respiratory_feedback, []);
assert.throws(() => projectWorldSimulationBodyRespiratoryState({
  world_state: changed, world_history: { turns: [{
    ...history.turns[0], revision_to: 2,
  }] }, world_state_revision: 1, character: actor,
}), { code: "BODY1O_HISTORY_REVISION_MISMATCH" });

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1o-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1O committed respiratory activity",
    seed: "body1o", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const before = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: before.state_hash,
    turn_id: "respiratory-turn", next_world_state: changed,
    selected_action_intents: [{ character: actor, selection: "candidate_action_intent",
      action_id: "speak", candidate: { action_id: "speak",
        communication: { channel: "speech" } } }],
    action_outcomes: history.turns[0].action_outcomes,
    state_transitions: [transition],
  }, options);
  const committed = await getWorldSimulationState(id, options);
  const signal = await readCommittedWorldSimulationBodyRespiratoryState({
    session_id: id, character: actor, expected_revision: 1,
    expected_state_hash: committed.state_hash,
  }, options);
  assert.equal(signal.respiratory_feedback[0].signal,
    "respiratory_activity_transition_detected");
  assert.equal(signal.world_state_hash, committed.state_hash);
  await assert.rejects(readCommittedWorldSimulationBodyRespiratoryState({
    session_id: id, character: actor, expected_revision: 0,
  }, options), { code: "BODY1O_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1O committed respiratory activity interface tests passed.");
