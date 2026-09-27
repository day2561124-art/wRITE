import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationBodyProprioceptiveFeedbackContract,
  projectWorldSimulationBodyProprioceptiveFeedback,
  readCommittedWorldSimulationBodyProprioceptiveFeedback,
} from "../server/src/world-simulation-body-proprioceptive-feedback-service.mjs";

const actor = "observer-engine-id";
const sceneId = "yard";
const initial = {
  characters: { [actor]: { physical_state: {} } },
  scenes: { [sceneId]: {
    scene_id: sceneId,
    dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 0, y: 0 } },
  } },
  event_queue: [],
};
const moved = structuredClone(initial);
moved.scenes[sceneId].entity_positions[actor] = { x: 2, y: 0 };

const selected = {
  character: actor,
  selection: "candidate_action_intent",
  action_id: "walk",
  candidate: {
    action_id: "walk",
    kind: "movement",
    movement: { destination: { x: 2, y: 0 } },
  },
};
const transition = {
  entity: actor,
  field: "position",
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  action_id: "walk",
};
const turn = {
  turn_id: "walk-turn",
  revision_from: 0,
  revision_to: 1,
  previous_state_hash: "before",
  next_state_hash: "after",
  selected_action_intents: [selected],
  action_outcomes: [{ actor, action_id: "walk", result: "movement_completed" }],
  state_transitions: [transition],
};

const before = projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: initial,
  world_history: { turns: [] },
  world_state_revision: 0,
  character: actor,
  scene_id: sceneId,
});
assert.equal(before.position_sense.status, "whole_body_position_signal_available");
assert.equal(before.movement_feedback.length, 0);
assert.equal(before.position_sense.exact_world_position_exposed, false);

const feedback = projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved,
  world_history: { turns: [turn] },
  world_state_revision: 1,
  character: actor,
  scene_id: sceneId,
});
assert.equal(feedback.movement_feedback.length, 1);
assert.equal(feedback.movement_feedback[0].signal, "whole_body_translation_detected");
assert.equal(feedback.movement_feedback[0].source_world_revision, 1);
assert.equal(feedback.boundaries.objective_world_coordinates_exposed, false);
assert.equal(feedback.boundaries.world_axis_direction_exposed, false);
assert.equal(feedback.movement_feedback[0].subjective_movement_belief_asserted, false);
assert.equal(Object.hasOwn(feedback, "position"), false);
assert.equal(Object.hasOwn(feedback.movement_feedback[0], "from"), false);
assert.equal(Object.hasOwn(feedback.movement_feedback[0], "to"), false);

const outcomeOnly = structuredClone(turn);
outcomeOnly.state_transitions = [];
assert.equal(projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved,
  world_history: { turns: [outcomeOnly] },
  world_state_revision: 1,
  character: actor,
  scene_id: sceneId,
}).movement_feedback.length, 0);

const staleTransition = structuredClone(turn);
staleTransition.state_transitions[0].to = { x: 1, y: 0 };
assert.equal(projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved,
  world_history: { turns: [staleTransition] },
  world_state_revision: 1,
  character: actor,
  scene_id: sceneId,
}).movement_feedback.length, 0);

const noPosition = structuredClone(initial);
delete noPosition.scenes[sceneId].entity_positions[actor];
assert.equal(projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: noPosition,
  world_history: { turns: [] },
  world_state_revision: 0,
  character: actor,
  scene_id: sceneId,
}).position_sense.status, "unavailable");

assert.throws(() => projectWorldSimulationBodyProprioceptiveFeedback({
  world_state: moved,
  world_history: { turns: [{ ...turn, revision_to: 2 }] },
  world_state_revision: 1,
  character: actor,
  scene_id: sceneId,
}), { code: "BODY1D_HISTORY_REVISION_MISMATCH" });

const contract = buildWorldSimulationBodyProprioceptiveFeedbackContract();
assert.equal(contract.movement_feedback_requires_committed_position_transition, true);
assert.equal(contract.action_outcome_alone_is_not_movement_feedback, true);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1d-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1D proprioceptive feedback fixture",
    seed: "body-1d",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const initialRead = await readCommittedWorldSimulationBodyProprioceptiveFeedback({
    session_id: id,
    character: actor,
    scene_id: sceneId,
    expected_revision: 0,
  }, options);
  assert.equal(initialRead.position_sense.status, "whole_body_position_signal_available");
  assert.equal(initialRead.movement_feedback.length, 0);

  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: first.state_hash,
    turn_id: "walk-turn",
    next_world_state: moved,
    selected_action_intents: turn.selected_action_intents,
    action_outcomes: turn.action_outcomes,
    state_transitions: turn.state_transitions,
  }, options);
  const committed = await readCommittedWorldSimulationBodyProprioceptiveFeedback({
    session_id: id,
    character: actor,
    scene_id: sceneId,
    expected_revision: 1,
  }, options);
  assert.equal(committed.movement_feedback.length, 1);
  assert.equal(committed.movement_feedback[0].signal, "whole_body_translation_detected");
  assert.equal(committed.world_state_hash.length > 0, true);

  await assert.rejects(
    readCommittedWorldSimulationBodyProprioceptiveFeedback({
      session_id: id,
      character: actor,
      scene_id: sceneId,
      expected_state_hash: "forged",
    }, options),
    { code: "BODY1D_STATE_HASH_CHANGED" },
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("BODY-1D committed proprioceptive movement feedback tests passed.");
