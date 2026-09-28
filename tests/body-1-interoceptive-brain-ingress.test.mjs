import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyInteroceptiveSignals } from "../server/src/world-simulation-body-interoceptive-signal-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
  buildCommittedWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const actor = "interoceptive-ingress-actor";
const packet = { character: actor, cognition: {}, boundaries: {} };
const before = {
  characters: { [actor]: { physical_state: { energy_current: 100 } } },
  scenes: {}, objects: {}, event_queue: [],
};
const after = structuredClone(before);
after.characters[actor].physical_state.energy_current = 70;
const transition = {
  entity: actor, field: "physical_state.energy_current",
  from: 100, to: 70, cause: "committed internal resource use",
};
const projection = projectWorldSimulationBodyInteroceptiveSignals({
  world_state: after,
  world_history: { turns: [{ revision_to: 1, state_transitions: [transition] }] },
  world_state_revision: 1,
  character: actor,
});
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  body_interoceptive_signals: projection,
});
assert.deepEqual(brain.body_interoceptive_evidence.signals, [{
  modality: "interoception", channel: "internal_energy_state",
  signal: "internal_energy_change_detected", direction: "decrease",
  source_world_revision: 1,
}]);
assert.equal(brain.boundaries.body_interoceptive_evidence_is_character_belief, false);
assert.equal(JSON.stringify(brain).includes("70"), false);
assert.equal(buildWorldSimulationCharacterBrainInput(packet).body_interoceptive_evidence, undefined);

const wrongActor = { ...projection, character: "other" };
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_interoceptive_signals: wrongActor,
}), { code: "BODY1I_INTEROCEPTIVE_EVIDENCE_INVALID" });
const numericLeak = structuredClone(projection);
numericLeak.signals[0].energy_current = 70;
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_interoceptive_signals: numericLeak,
}), { code: "BODY1I_INTEROCEPTIVE_SIGNAL_INVALID" });
const staleSignal = structuredClone(projection);
staleSignal.signals[0].source_world_revision = 0;
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_interoceptive_signals: staleSignal,
}), { code: "BODY1I_INTEROCEPTIVE_SIGNAL_INVALID" });
const subjectiveLeak = structuredClone(projection);
subjectiveLeak.signals[0].subjective_feeling_asserted = true;
assert.throws(() => buildWorldSimulationCharacterBrainInput(packet, {
  body_interoceptive_signals: subjectiveLeak,
}), { code: "BODY1I_INTEROCEPTIVE_SIGNAL_INVALID" });

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `body1i-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1I committed ingress fixture", seed: "body1i",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: before,
  }, options);
  const session_id = session.world_simulation_session_id;
  const initial = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options);
  assert.deepEqual(initial.body_interoceptive_evidence.signals, []);
  const current = await getWorldSimulationState(session_id, options);
  await commitWorldSimulationTurn(session_id, {
    expected_revision: 0, expected_state_hash: current.state_hash,
    turn_id: "body1i-energy-change", next_world_state: after,
    state_transitions: [transition],
  }, options);
  const committed = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 1,
  }, options);
  assert.equal(committed.body_interoceptive_evidence.signals[0].direction, "decrease");
  assert.equal(JSON.stringify(committed).includes('"energy_current":70'), false);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id, decision_packet: packet, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1I committed interoceptive brain ingress tests passed.");
