import assert from "node:assert/strict";
import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyHomeostaticCues } from "../server/src/world-simulation-body-homeostatic-cue-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
  buildCommittedWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "body1r-actor";
const packet = { character: actor, cognition: {}, boundaries: {} };
const before = {
  characters: { [actor]: { physical_state: { energy_current: 100,
    homeostatic_cues: { hunger: false, fullness: true, fatigue: false } } } },
  scenes: {}, objects: {}, event_queue: [],
};
const after = structuredClone(before);
after.characters[actor].physical_state.energy_current = 5;
after.characters[actor].physical_state.homeostatic_cues.hunger = true;
after.characters[actor].physical_state.homeostatic_cues.fullness = false;
const transitions = [
  { entity: actor, field: "physical_state.homeostatic_cues.hunger", from: false, to: true },
  { entity: actor, field: "physical_state.homeostatic_cues.fullness", from: true, to: false },
];
const projection = projectWorldSimulationBodyHomeostaticCues({
  world_state: after,
  world_history: { turns: [{ revision_to: 1, state_transitions: transitions }] },
  world_state_revision: 1, character: actor,
});
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  body_homeostatic_cues: projection,
});
assert.deepEqual(brain.body_homeostatic_evidence.cue_sense, {
  hunger: { status: "cue_active" },
  fullness: { status: "cue_inactive" },
  fatigue: { status: "cue_inactive" },
});
assert.equal(brain.body_homeostatic_evidence.cue_feedback.length, 2);
assert.equal(brain.boundaries.body_homeostatic_evidence_is_character_belief, false);
assert.equal(brain.boundaries.body_homeostatic_evidence_is_subjective_feeling, false);
assert.equal(JSON.stringify(brain).includes('"energy_current":5'), false);
assert.equal(buildWorldSimulationCharacterBrainInput(packet).body_homeostatic_evidence, undefined);

function rejects(candidate, code) {
  assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
    body_homeostatic_cues: candidate,
  }), { code });
}
rejects({ ...projection, character: "other" }, "BODY1R_HOMEOSTATIC_EVIDENCE_INVALID");
const leak = structuredClone(projection);
leak.cue_sense.hunger.energy_current = 5;
rejects(leak, "BODY1R_HOMEOSTATIC_SENSE_INVALID");
const forged = structuredClone(projection);
forged.cue_feedback[0].source_world_revision = 0;
rejects(forged, "BODY1R_HOMEOSTATIC_FEEDBACK_INVALID");
const subjective = structuredClone(projection);
subjective.cue_feedback[0].subjective_feeling = "hungry";
rejects(subjective, "BODY1R_HOMEOSTATIC_FEEDBACK_INVALID");
const unavailable = projectWorldSimulationBodyHomeostaticCues({
  world_state: { ...before, characters: {
    [actor]: { physical_state: { energy_current: 5 } },
  } },
  world_history: { turns: [] }, world_state_revision: 0, character: actor,
});
assert.deepEqual(buildWorldSimulationCharacterBrainInput(packet, {
  body_homeostatic_cues: unavailable,
}).body_homeostatic_evidence.cue_sense, {
  hunger: { status: "unavailable" },
  fullness: { status: "unavailable" },
  fatigue: { status: "unavailable" },
});
const formalSource = await readFile(path.join(projectRoot, "server/src",
  "world-simulation-formal-turn-transport-service.mjs"), "utf8");
assert.match(formalSource, /body_homeostatic_cues: bodyHomeostaticCues/);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1r-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1R committed ingress fixture", seed: "body1r",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: before,
  }, options);
  const session_id = session.world_simulation_session_id;
  const initial = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options);
  assert.equal(initial.body_homeostatic_evidence.cue_sense.hunger.status, "cue_inactive");
  assert.deepEqual(initial.body_homeostatic_evidence.cue_feedback, []);
  const current = await getWorldSimulationState(session_id, options);
  await commitWorldSimulationTurn(session_id, {
    expected_revision: 0, expected_state_hash: current.state_hash,
    turn_id: "body1r-homeostatic-change", next_world_state: after,
    state_transitions: transitions,
  }, options);
  const committed = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 1,
  }, options);
  assert.equal(committed.body_homeostatic_evidence.cue_sense.hunger.status, "cue_active");
  assert.equal(committed.body_homeostatic_evidence.cue_feedback.length, 2);
  assert.equal(JSON.stringify(committed).includes('"energy_current":5'), false);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1R committed homeostatic brain ingress tests passed.");
