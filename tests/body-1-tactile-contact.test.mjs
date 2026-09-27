import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "../server/src/world-simulation-causal-rule-engine.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationBodyTactileContactContract,
  projectWorldSimulationBodyTactileContact,
  readCommittedWorldSimulationBodyTactileContact,
} from "../server/src/world-simulation-body-tactile-contact-service.mjs";

const actor = "observer-engine-id";
const objectId = "sealed-private-object-id";
const initial = {
  characters: { [actor]: { physical_state: {
    tactile_reception: { hand_contact_functional: true },
  } } },
  scenes: { yard: {
    scene_id: "yard", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 0, y: 0 } },
  } },
  objects: { [objectId]: { holder: null, scene_id: "yard",
    position: { x: 0.5, y: 0 } } },
  event_queue: [],
};
const held = structuredClone(initial);
held.objects[objectId] = { holder: actor, scene_id: null, position: null };
const selected = { character: actor, selection: "candidate_action_intent",
  action_id: "take", candidate: { action_id: "take",
    object_interaction: { type: "pickup", object_id: objectId } } };
const completed = { actor, action_id: "take", result: "pickup_completed" };
const transition = { entity: objectId, field: "holder", from: null,
  to: actor, action_id: "take" };
const turn = { turn_id: "grasp", revision_from: 0, revision_to: 1,
  previous_state_hash: "before", next_state_hash: "after",
  selected_action_intents: [selected], action_outcomes: [completed],
  state_transitions: [transition] };
const project = (state, history = { turns: [turn] }) =>
  projectWorldSimulationBodyTactileContact({
    world_state: state, world_history: history,
    world_state_revision: 1, character: actor,
  });
const contact = project(held);
assert.equal(contact.tactile_signals.length, 1);
const native = await adjudicateWorldSimulationCausality({
  world_simulation_session_id: "body1c-native", turn_id: "grasp",
  world_state: initial, world_state_hash: hashAgentRunValue(initial),
  world_state_revision: 0, event: { event_id: "grasp", scene_id: "yard" },
  selected_action_intents: [selected],
});
assert.equal(native.action_outcomes.find((entry) =>
  entry.action_id === "take")?.result, "pickup_completed");
const nativeContact = projectWorldSimulationBodyTactileContact({
  world_state: native.next_world_state,
  world_history: { turns: [{
    ...turn, action_outcomes: native.action_outcomes,
    state_transitions: native.state_transitions,
  }] },
  world_state_revision: 1, character: actor,
});
assert.equal(nativeContact.tactile_signals.length, 1);
assert.equal(JSON.stringify(nativeContact).includes(objectId), false);
assert.equal(contact.tactile_signals[0].signal, "hand_contact_detected");
assert.equal(contact.tactile_signals[0].source_world_revision, 1);
assert.equal(contact.tactile_signals[0].texture_asserted, false);
assert.equal(JSON.stringify(contact).includes(objectId), false);
assert.equal(project(initial).tactile_signals.length, 0);
assert.equal(project(held, { turns: [{ ...turn,
  action_outcomes: [{ ...completed, result: "blocked" }] }] })
  .tactile_signals.length, 0);
assert.equal(project(held, { turns: [{ ...turn,
  state_transitions: [] }] }).tactile_signals.length, 0);
assert.equal(project(held, { turns: [{ ...turn,
  selected_action_intents: [{ character: actor, selection: "reject_all" }] }] })
  .tactile_signals.length, 0);
const numb = structuredClone(held);
numb.characters[actor].physical_state.tactile_reception.hand_contact_functional = false;
assert.equal(project(numb).receptor_status, "unavailable");
assert.equal(project(numb).tactile_signals.length, 0);
assert.throws(() => project(held, { turns: [{ ...turn, revision_to: 2 }] }),
  { code: "BODY1C_HISTORY_REVISION_MISMATCH" });
assert.equal(buildWorldSimulationBodyTactileContactContract()
  .object_identity_exposed, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1c-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1C contact fixture", seed: "body1c",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const before = await readCommittedWorldSimulationBodyTactileContact({
    session_id: id, character: actor, expected_revision: 0,
  }, options);
  assert.equal(before.tactile_signals.length, 0);
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "grasp", next_world_state: held,
    selected_action_intents: [selected], action_outcomes: [completed],
    state_transitions: [transition],
  }, options);
  const committed = await readCommittedWorldSimulationBodyTactileContact({
    session_id: id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(committed.tactile_signals.length, 1);
  assert.equal(committed.tactile_signals[0].source_world_revision, 1);
  assert.equal(JSON.stringify(committed).includes(objectId), false);
  await assert.rejects(readCommittedWorldSimulationBodyTactileContact({
    session_id: id, character: actor, expected_state_hash: "forged",
  }, options), { code: "BODY1C_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1C committed grasp-contact tactile input tests passed.");
