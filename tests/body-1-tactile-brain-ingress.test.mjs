import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyTactileContact } from "../server/src/world-simulation-body-tactile-contact-service.mjs";
import {
  buildCommittedWorldSimulationCharacterBrainInput,
  buildWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "body1s-actor";
const objectId = "private-object-identity";
const packet = { character: actor, cognition: {}, boundaries: {} };
const before = {
  characters: { [actor]: { physical_state: {
    tactile_reception: { hand_contact_functional: true },
  } } },
  scenes: { yard: { scene_id: "yard", entity_positions: {
    [actor]: { x: 0, y: 0 },
  } } },
  objects: { [objectId]: { holder: null, scene_id: "yard",
    position: { x: 0.5, y: 0 } } },
  event_queue: [],
};
const after = structuredClone(before);
after.objects[objectId] = { holder: actor, scene_id: null, position: null };
const selected = { character: actor, selection: "candidate_action_intent",
  action_id: "take", candidate: { action_id: "take",
    object_interaction: { type: "pickup", object_id: objectId } } };
const outcome = { actor, action_id: "take", result: "pickup_completed" };
const transition = { entity: objectId, field: "holder", from: null,
  to: actor, action_id: "take" };
const projection = projectWorldSimulationBodyTactileContact({
  world_state: after, world_state_revision: 1, character: actor,
  world_history: { turns: [{ revision_to: 1,
    selected_action_intents: [selected], action_outcomes: [outcome],
    state_transitions: [transition] }] },
});
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  body_tactile_contact: projection,
});
assert.equal(brain.body_tactile_evidence.tactile_signals.length, 1);
assert.equal(brain.body_tactile_evidence.tactile_signals[0].signal,
  "hand_contact_detected");
assert.match(brain.body_tactile_evidence.tactile_signals[0].contact_ref,
  /^contact_[a-f0-9]{32}$/);
assert.equal(brain.boundaries.body_tactile_object_identity_exposed, false);
assert.equal(brain.boundaries.body_tactile_evidence_is_subjective_touch, false);
assert.equal(brain.boundaries.body_tactile_evidence_is_character_belief, false);
assert.equal(JSON.stringify(brain).includes(objectId), false);
assert.equal(buildWorldSimulationCharacterBrainInput(packet).body_tactile_evidence,
  undefined);

function rejects(candidate, code) {
  assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
    body_tactile_contact: candidate,
  }), { code });
}
rejects({ ...projection, character: "other" },
  "BODY1S_TACTILE_EVIDENCE_INVALID");
const identityLeak = structuredClone(projection);
identityLeak.tactile_signals[0].object_id = objectId;
rejects(identityLeak, "BODY1S_TACTILE_SIGNAL_INVALID");
const subjectiveLeak = structuredClone(projection);
subjectiveLeak.tactile_signals[0].pain_asserted = true;
rejects(subjectiveLeak, "BODY1S_TACTILE_SIGNAL_INVALID");
const stale = structuredClone(projection);
stale.tactile_signals[0].source_world_revision = 0;
rejects(stale, "BODY1S_TACTILE_SIGNAL_INVALID");
const unavailable = structuredClone(projection);
unavailable.receptor_status = "unavailable";
rejects(unavailable, "BODY1S_TACTILE_EVIDENCE_INVALID");
const formal = await readFile(path.join(projectRoot, "server/src",
  "world-simulation-formal-turn-transport-service.mjs"), "utf8");
assert.match(formal, /body_tactile_contact: bodyTactileContact/);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1s-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1S committed tactile ingress", seed: "body1s",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: before,
  }, options);
  const session_id = session.world_simulation_session_id;
  const initial = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options);
  assert.equal(initial.body_tactile_evidence.tactile_signals.length, 0);
  const current = await getWorldSimulationState(session_id, options);
  await commitWorldSimulationTurn(session_id, {
    expected_revision: 0, expected_state_hash: current.state_hash,
    turn_id: "grasp", next_world_state: after,
    selected_action_intents: [selected], action_outcomes: [outcome],
    state_transitions: [transition],
  }, options);
  const committed = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 1,
  }, options);
  assert.equal(committed.body_tactile_evidence.tactile_signals.length, 1);
  assert.equal(committed.body_tactile_evidence.tactile_signals[0].source_action_id,
    "take");
  assert.equal(JSON.stringify(committed).includes(objectId), false);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1S committed tactile Character Brain ingress tests passed.");
