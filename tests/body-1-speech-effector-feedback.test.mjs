import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import {
  projectWorldSimulationBodySpeechEffectorFeedback,
  readCommittedWorldSimulationBodySpeechEffectorFeedback,
  buildWorldSimulationBodySpeechEffectorFeedbackContract,
} from "../server/src/world-simulation-body-speech-effector-feedback-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "speech-effector-actor";
const actionId = "speech-action";
const surface = "private test surface that cannot leak through effector feedback";
const selected = {
  character: actor, selection: "candidate_action_intent", action_id: actionId,
  candidate: { action_id: actionId, communication: { channel: "speech" } },
};
const emitted = {
  actor, action_id: actionId, result: "communication_emitted",
  communication_event: {
    actor, channel: "speech", surface_realization_complete: true,
    surface_text: surface, semantic_content: "private semantic payload",
    surface_realization: { source_action_id: actionId },
  },
  communication_speech_stream: { source_action_id: actionId, increments: [{ sequence: 1 }] },
  communication_acoustic_signal: {
    registered: true, source_action_id: actionId, sound_id: "sound-1",
  },
};
const turn = (outcomes) => ({
  revision_to: 1,
  selected_action_intents: [selected],
  action_outcomes: outcomes,
});
const project = (outcomes, character = actor) =>
  projectWorldSimulationBodySpeechEffectorFeedback({
    world_history: { turns: [turn(outcomes)] },
    world_state_revision: 1, character,
  });
const actual = project([emitted]);
assert.deepEqual(actual.feedback, [{
  action_id: actionId, status: "speech_emitted",
  temporal_stream_registered: true, physical_sound_registered: true,
  source_world_revision: 1,
}]);
const brain = buildWorldSimulationCharacterBrainInput({
  character: actor, cognition: {}, boundaries: {},
}, { body_speech_effector_feedback: actual });
assert.deepEqual(brain.body_speech_effector_feedback.feedback, [{
  action_id: actionId, status: "speech_emitted", source_world_revision: 1,
}]);
assert.equal(brain.boundaries.body_speech_feedback_is_listener_hearing, false);
assert.equal(brain.boundaries.body_speech_feedback_acoustic_registration_exposed, false);
assert.equal(brain.boundaries.body_speech_feedback_technical_stream_exposed, false);
assert.equal(JSON.stringify(brain).includes(surface), false);
assert.equal(JSON.stringify(brain).includes("private semantic payload"), false);
assert.equal(JSON.stringify(brain).includes("sound-1"), false);
assert.equal(project([]).feedback[0].status, "emission_unconfirmed");
assert.deepEqual(project([{ ...emitted, result: "action_blocked" }]).feedback[0], {
  action_id: actionId, status: "speech_not_emitted",
  temporal_stream_registered: false, physical_sound_registered: false,
  source_world_revision: 1,
});
const noAcoustic = project([{ ...emitted,
  communication_acoustic_signal: { registered: false } }]);
assert.equal(noAcoustic.feedback[0].status, "speech_emitted");
assert.equal(noAcoustic.feedback[0].physical_sound_registered, false);
assert.deepEqual(project([emitted], "other").feedback, []);
assert.throws(() => projectWorldSimulationBodySpeechEffectorFeedback({
  world_history: { turns: [turn([emitted])] },
  world_state_revision: 2, character: actor,
}), { code: "BODY1J_HISTORY_REVISION_MISMATCH" });
const forged = structuredClone(actual);
forged.feedback[0].surface_text = surface;
assert.throws(() => buildWorldSimulationCharacterBrainInput({
  character: actor, cognition: {}, boundaries: {},
}, { body_speech_effector_feedback: forged }), {
  code: "BODY1J_SPEECH_FEEDBACK_ITEM_INVALID",
});
const other = { ...actual, character: "other" };
assert.throws(() => buildWorldSimulationCharacterBrainInput({
  character: actor, cognition: {}, boundaries: {},
}, { body_speech_effector_feedback: other }), {
  code: "BODY1J_SPEECH_FEEDBACK_INVALID",
});
assert.equal(buildWorldSimulationBodySpeechEffectorFeedbackContract().respiratory_physiology_inferred, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1j-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const state = {
  characters: { [actor]: { physical_state: {} } },
  scenes: {}, objects: {}, event_queue: [],
};
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1J speech effector fixture",
    seed: "body1j", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: state,
  }, options);
  const session_id = session.world_simulation_session_id;
  const initial = await readCommittedWorldSimulationBodySpeechEffectorFeedback({
    session_id, character: actor, expected_revision: 0,
  }, options);
  assert.deepEqual(initial.feedback, []);
  const current = await getWorldSimulationState(session_id, options);
  await commitWorldSimulationTurn(session_id, {
    expected_revision: 0, expected_state_hash: current.state_hash,
    turn_id: "speech-turn", next_world_state: state,
    selected_action_intents: [selected], action_outcomes: [emitted],
  }, options);
  const committed = await readCommittedWorldSimulationBodySpeechEffectorFeedback({
    session_id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(committed.feedback[0].physical_sound_registered, true);
  await assert.rejects(readCommittedWorldSimulationBodySpeechEffectorFeedback({
    session_id, character: actor, expected_revision: 0,
  }, options), { code: "BODY1J_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1J speech effector feedback tests passed.");
