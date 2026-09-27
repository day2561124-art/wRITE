import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "../server/src/world-simulation-causal-rule-engine.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationBodyGustatoryContactContract,
  projectWorldSimulationBodyGustatoryContact,
  readCommittedWorldSimulationBodyGustatoryContact,
} from "../server/src/world-simulation-body-gustatory-contact-service.mjs";

const actor = "private-actor";
const objectId = "private-sample-engine-id";
const initial = {
  characters: { [actor]: { physical_state: {
    gustatory_reception: { oral_contact_functional: true },
  } } },
  scenes: { kitchen: {
    scene_id: "kitchen", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 0, y: 0 } },
  } },
  objects: { [objectId]: {
    holder: actor, scene_id: null, position: null,
    gustatory_profile: { sampleable: true },
    gustatory_labels_by: { [actor]: "帶酸味" },
  } },
  event_queue: [],
};
const selected = { character: actor, selection: "candidate_action_intent",
  action_id: "sample", candidate: { action_id: "sample",
    gustatory_sampling: { object_id: objectId } } };
function native(world, intent = selected, turnId = "sample-turn") {
  return adjudicateWorldSimulationCausality({
    world_simulation_session_id: "body1g-native", turn_id: turnId,
    world_state: world, world_state_hash: hashAgentRunValue(world),
    world_state_revision: 0, event: { event_id: turnId, scene_id: "kitchen" },
    selected_action_intents: [intent],
  });
}
const adjudicated = await native(initial);
const completed = adjudicated.action_outcomes.find((entry) =>
  entry.actor === actor && entry.action_id === "sample");
assert.equal(completed?.result, "gustatory_contact_completed");
assert.equal(completed?.sampled_object_id, objectId);
assert.equal(completed?.ingestion_asserted, false);
assert.deepEqual(adjudicated.next_world_state.objects[objectId], initial.objects[objectId]);
const turn = { turn_id: "sample-turn", revision_from: 0, revision_to: 1,
  previous_state_hash: "before", next_state_hash: "after",
  selected_action_intents: [selected], action_outcomes: adjudicated.action_outcomes };
function project(world = initial, event = turn) {
  return projectWorldSimulationBodyGustatoryContact({
    world_state: world, world_history: { turns: [event] },
    world_state_revision: 1, character: actor,
  });
}
const observation = project();
assert.deepEqual(observation.gustatory_observations, [{
  sense: "gustatory", kind: "oral_contact_taste",
  perceptual_label: "帶酸味", source_world_revision: 1,
  ingestion_asserted: false, nutrition_asserted: false,
  subjective_preference_asserted: false,
}]);
assert.equal(JSON.stringify(observation).includes(objectId), false);
assert.equal(project(initial, { ...turn, action_outcomes: [] }).gustatory_observations.length, 0);
assert.equal(project(initial, { ...turn, selected_action_intents: [] }).gustatory_observations.length, 0);
const unheld = structuredClone(initial);
unheld.objects[objectId].holder = null;
assert.equal((await native(unheld, selected, "unheld")).action_outcomes
  .some((item) => item.result === "gustatory_contact_completed"), false);
assert.equal(project(unheld).gustatory_observations.length, 0);
const unsampleable = structuredClone(initial);
unsampleable.objects[objectId].gustatory_profile.sampleable = false;
assert.equal((await native(unsampleable, selected, "unsampleable")).action_outcomes
  .some((item) => item.result === "gustatory_contact_completed"), false);
assert.equal(project(unsampleable).gustatory_observations.length, 0);
const numb = structuredClone(initial);
numb.characters[actor].physical_state.gustatory_reception.oral_contact_functional = false;
assert.equal((await native(numb, selected, "numb")).action_outcomes
  .some((item) => item.result === "gustatory_contact_completed"), false);
assert.equal(project(numb).gustatory_observations.length, 0);
const forged = structuredClone(turn);
forged.action_outcomes[0].sampled_object_id = "wrong";
assert.equal(project(initial, forged).gustatory_observations.length, 0);
const contract = buildWorldSimulationBodyGustatoryContactContract();
assert.equal(contract.ingestion_modeled, false);
assert.equal(contract.brain_receives_engine_object_id, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1g-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1G gustatory contact fixture", seed: "body1g",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const before = await readCommittedWorldSimulationBodyGustatoryContact({
    session_id: id, character: actor, expected_revision: 0,
  }, options);
  assert.equal(before.gustatory_observations.length, 0);
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "sample-turn", next_world_state: adjudicated.next_world_state,
    selected_action_intents: [selected],
    action_outcomes: adjudicated.action_outcomes,
    state_transitions: adjudicated.state_transitions,
  }, options);
  const committed = await readCommittedWorldSimulationBodyGustatoryContact({
    session_id: id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(committed.gustatory_observations.length, 1);
  assert.equal(JSON.stringify(committed).includes(objectId), false);
  await assert.rejects(readCommittedWorldSimulationBodyGustatoryContact({
    session_id: id, character: actor, expected_state_hash: "wrong",
  }, options), { code: "BODY1G_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1G committed gustatory contact tests passed.");
