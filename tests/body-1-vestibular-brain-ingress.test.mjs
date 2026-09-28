import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyVestibularFeedback } from "../server/src/world-simulation-body-vestibular-feedback-service.mjs";
import {
  buildCommittedWorldSimulationCharacterBrainInput,
  buildWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "body1n-actor";
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
const packet = { character: actor, cognition: {}, boundaries: {} };
const project = (state = turned, transitions = [transition]) =>
  projectWorldSimulationBodyVestibularFeedback({
    world_state: state,
    world_history: { turns: [{ ...history.turns[0], state_transitions: transitions }] },
    world_state_revision: 1, character: actor,
  });
const source = project();
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  body_vestibular_feedback: source,
});
assert.deepEqual(brain.body_vestibular_evidence.head_orientation_sense, {
  status: "head_orientation_signal_available",
});
assert.deepEqual(brain.body_vestibular_evidence.head_rotation_feedback, [{
  modality: "vestibular", signal: "head_rotation_detected", source_world_revision: 1,
}]);
assert.equal(brain.boundaries.body_vestibular_exact_world_angle_exposed, false);
assert.equal(brain.boundaries.body_vestibular_angular_dynamics_inferred, false);
assert.equal(brain.boundaries.body_vestibular_evidence_is_character_belief, false);
assert.equal(JSON.stringify(brain).includes("facing_degrees"), false);
assert.equal(JSON.stringify(brain).includes('"to":90'), false);
for (const [forged, code] of [
  [{ ...source, character: "other" }, "BODY1N_VESTIBULAR_EVIDENCE_INVALID"],
  [{ ...source, boundaries: { ...source.boundaries,
    exact_world_angle_exposed: true } }, "BODY1N_VESTIBULAR_EVIDENCE_INVALID"],
  [{ ...source, head_orientation_sense: { status: "head_orientation_signal_available",
    facing_degrees: 90 } }, "BODY1N_VESTIBULAR_EVIDENCE_INVALID"],
  [{ ...source, head_rotation_feedback: [{ ...source.head_rotation_feedback[0],
    facing_degrees: 90 }] }, "BODY1N_VESTIBULAR_SIGNAL_INVALID"],
  [{ ...source, head_rotation_feedback: [{ ...source.head_rotation_feedback[0],
    source_world_revision: 2 }] }, "BODY1N_VESTIBULAR_SIGNAL_INVALID"],
  [{ ...source, head_rotation_feedback: [source.head_rotation_feedback[0],
    source.head_rotation_feedback[0]] }, "BODY1N_VESTIBULAR_EVIDENCE_INVALID"],
]) {
  assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
    body_vestibular_feedback: forged,
  }), { code });
}
assert.deepEqual(buildWorldSimulationCharacterBrainInput(packet, {
  body_vestibular_feedback: project(turned, []),
}).body_vestibular_evidence.head_rotation_feedback, []);
const unavailable = project({ ...turned, characters: {
  [actor]: { physical_state: {} },
} }, []);
assert.equal(buildWorldSimulationCharacterBrainInput(packet, {
  body_vestibular_feedback: unavailable,
}).body_vestibular_evidence.head_orientation_sense.status, "unavailable");

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1n-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1N committed vestibular Brain ingress",
    seed: "body1n", rules: { event_driven: true, persistent_causality: true },
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
  const committedBrain = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: packet,
    expected_revision: 1, expected_state_hash: committed.state_hash,
  }, options);
  assert.equal(committedBrain.body_vestibular_evidence.head_rotation_feedback[0].signal,
    "head_rotation_detected");
  assert.equal(committedBrain.body_proprioceptive_evidence.source_world_revision, 1);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: packet, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1N committed vestibular Character Brain ingress tests passed.");
