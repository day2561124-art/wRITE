import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import {
  projectWorldSimulationBodyVestibularFeedback,
  readCommittedWorldSimulationBodyVestibularFeedback,
  buildWorldSimulationBodyVestibularFeedbackContract,
} from "../server/src/world-simulation-body-vestibular-feedback-service.mjs";

const actor = "body1m-actor";
const initial = {
  characters: { [actor]: { facing_degrees: 0, physical_state: {} } },
  scenes: { yard: { scene_id: "yard", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 1, y: 1 } } } },
  event_queue: [],
};
const turned = structuredClone(initial);
turned.characters[actor].facing_degrees = 90;
const transition = { entity: actor, field: "facing_degrees", from: 0, to: 90 };
const history = { turns: [{
  turn_id: "turn-head", revision_to: 1, state_transitions: [transition],
  action_outcomes: [{ actor, result: "head_orientation_completed" }],
}] };
const project = (state = turned, revisions = history) =>
  projectWorldSimulationBodyVestibularFeedback({
    world_state: state, world_history: revisions, world_state_revision: 1,
    character: actor,
  });
const result = project();
assert.equal(result.head_orientation_sense.status, "head_orientation_signal_available");
assert.deepEqual(result.head_rotation_feedback, [{
  modality: "vestibular", signal: "head_rotation_detected", source_world_revision: 1,
}]);
assert.equal(JSON.stringify(result).includes("90"), false);
assert.equal(result.boundaries.angular_velocity_or_acceleration_inferred, false);
assert.equal(buildWorldSimulationBodyVestibularFeedbackContract()
  .subjective_orientation_belief_asserted, false);
for (const transitions of [
  [], [{ ...transition, entity: "someone-else" }],
  [{ ...transition, field: "eye_yaw_degrees" }],
  [{ ...transition, from: 90 }],
  [{ ...transition, to: 180 }],
  [{ ...transition, from: null }],
]) {
  assert.deepEqual(project(turned, { turns: [{ ...history.turns[0],
    state_transitions: transitions }] }).head_rotation_feedback, []);
}
const unturned = structuredClone(initial);
assert.deepEqual(project(unturned).head_rotation_feedback, []);
assert.equal(projectWorldSimulationBodyVestibularFeedback({
  world_state: initial, world_history: { turns: [] },
  world_state_revision: 0, character: actor,
}).head_rotation_feedback.length, 0);
assert.throws(() => project(turned, { turns: [{ ...history.turns[0],
  revision_to: 2 }] }), { code: "BODY1M_HISTORY_REVISION_MISMATCH" });

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1m-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1M committed head rotation",
    seed: "body1m", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const before = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: before.state_hash,
    turn_id: "turn-head", next_world_state: turned,
    selected_action_intents: [{ character: actor, selection: "candidate_action_intent",
      action_id: "turn-head", candidate: { action_id: "turn-head",
        motor_command: { type: "orient_head", facing_degrees: 90 } } }],
    action_outcomes: history.turns[0].action_outcomes,
    state_transitions: [transition],
  }, options);
  const committed = await getWorldSimulationState(id, options);
  const signal = await readCommittedWorldSimulationBodyVestibularFeedback({
    session_id: id, character: actor, expected_revision: 1,
    expected_state_hash: committed.state_hash,
  }, options);
  assert.equal(signal.head_rotation_feedback[0].signal, "head_rotation_detected");
  assert.equal(signal.world_state_hash, committed.state_hash);
  await assert.rejects(readCommittedWorldSimulationBodyVestibularFeedback({
    session_id: id, character: actor, expected_revision: 0,
  }, options), { code: "BODY1M_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1M committed vestibular head rotation tests passed.");
