import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyProprioceptiveFeedback } from "../server/src/world-simulation-body-proprioceptive-feedback-service.mjs";
import {
  buildCommittedWorldSimulationCharacterBrainInput,
  buildWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "body1l-actor";
const sceneId = "yard";
const initial = {
  characters: { [actor]: { physical_state: {} } },
  scenes: { [sceneId]: {
    scene_id: sceneId, dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 0, y: 0 } },
  } },
  event_queue: [],
};
const moved = structuredClone(initial);
moved.scenes[sceneId].entity_positions[actor] = { x: 2, y: 0 };
const transition = {
  entity: actor, field: "position", from: { x: 0, y: 0 }, to: { x: 2, y: 0 },
};
const history = { turns: [{
  turn_id: "walk-turn", revision_to: 1, state_transitions: [transition],
  action_outcomes: [{ actor, action_id: "walk", result: "movement_completed" }],
}] };
const packet = { character: actor, cognition: {}, boundaries: {} };
const projection = projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved, world_history: history,
  world_state_revision: 1, character: actor,
});
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  body_proprioceptive_feedback: projection,
});
assert.deepEqual(brain.body_proprioceptive_evidence.movement_feedback, [{
  modality: "proprioception", signal: "whole_body_translation_detected",
  source_world_revision: 1,
}]);
assert.deepEqual(brain.body_proprioceptive_evidence.position_sense, {
  status: "whole_body_position_signal_available",
});
assert.equal(brain.boundaries.body_proprioceptive_world_coordinates_exposed, false);
assert.equal(brain.boundaries.body_proprioceptive_exact_displacement_exposed, false);
assert.equal(brain.boundaries.body_proprioceptive_evidence_is_character_belief, false);
assert.equal(JSON.stringify(brain).includes('"x":2'), false);
assert.equal(JSON.stringify(brain).includes('"to"'), false);
const forged = structuredClone(projection);
forged.movement_feedback[0].to = { x: 2, y: 0 };
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_proprioceptive_feedback: forged,
}), { code: "BODY1L_PROPRIOCEPTIVE_SIGNAL_INVALID" });
const wrongActor = { ...projection, character: "other" };
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_proprioceptive_feedback: wrongActor,
}), { code: "BODY1L_PROPRIOCEPTIVE_EVIDENCE_INVALID" });
const stale = { ...projection, source_world_revision: 2 };
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_proprioceptive_feedback: stale,
}), { code: "BODY1L_PROPRIOCEPTIVE_SIGNAL_INVALID" });
const outcomeOnly = projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved,
  world_history: { turns: [{ ...history.turns[0], state_transitions: [] }] },
  world_state_revision: 1, character: actor,
});
assert.deepEqual(buildWorldSimulationCharacterBrainInput(packet, {
  body_proprioceptive_feedback: outcomeOnly,
}).body_proprioceptive_evidence.movement_feedback, []);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1l-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1L committed proprioceptive Brain ingress",
    seed: "body1l", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const sessionId = session.world_simulation_session_id;
  const before = await getWorldSimulationState(sessionId, options);
  await commitWorldSimulationTurn(sessionId, {
    expected_revision: 0, expected_state_hash: before.state_hash,
    turn_id: "walk-turn", next_world_state: moved,
    selected_action_intents: [{ character: actor, selection: "candidate_action_intent",
      action_id: "walk", candidate: { action_id: "walk",
        movement: { destination: { x: 2, y: 0 } } } }],
    action_outcomes: history.turns[0].action_outcomes,
    state_transitions: [transition],
  }, options);
  const committed = await getWorldSimulationState(sessionId, options);
  const committedBrain = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id: sessionId, decision_packet: packet,
    expected_revision: 1, expected_state_hash: committed.state_hash,
  }, options);
  assert.equal(committedBrain.body_proprioceptive_evidence.movement_feedback[0].signal,
    "whole_body_translation_detected");
  assert.equal(committedBrain.body_interoceptive_evidence.source_world_revision, 1);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id: sessionId, decision_packet: packet, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1L committed proprioceptive Character Brain ingress tests passed.");
