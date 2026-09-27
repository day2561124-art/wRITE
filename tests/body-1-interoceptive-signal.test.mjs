import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationBodyInteroceptiveSignalContract,
  projectWorldSimulationBodyInteroceptiveSignals,
  readCommittedWorldSimulationBodyInteroceptiveSignals,
} from "../server/src/world-simulation-body-interoceptive-signal-service.mjs";

const actor = "interoceptive-actor";
const before = {
  characters: { [actor]: { physical_state: { energy_current: 100 } } },
  scenes: {},
  objects: {},
  event_queue: [],
};
const after = structuredClone(before);
after.characters[actor].physical_state.energy_current = 70;
const transition = {
  entity: actor,
  field: "physical_state.energy_current",
  from: 100,
  to: 70,
  cause: "committed internal resource use",
  adjudication: "programmatic_continuous_physics",
};
const turn = {
  turn_id: "energy-change",
  revision_from: 0,
  revision_to: 1,
  previous_state_hash: "before",
  next_state_hash: "after",
  state_transitions: [transition],
};

const projected = projectWorldSimulationBodyInteroceptiveSignals({
  world_state: after,
  world_history: { turns: [turn] },
  world_state_revision: 1,
  character: actor,
});
assert.equal(projected.channel_status, "available");
assert.deepEqual(projected.signals, [{
  modality: "interoception",
  channel: "internal_energy_state",
  signal: "internal_energy_change_detected",
  direction: "decrease",
  source_world_revision: 1,
  objective_energy_value_exposed: false,
  change_magnitude_exposed: false,
  subjective_fatigue_asserted: false,
  subjective_hunger_asserted: false,
  subjective_feeling_asserted: false,
  character_belief_asserted: false,
}]);
assert.equal(JSON.stringify(projected.signals).includes("70"), false);
assert.equal(projected.boundaries.physiological_fatigue_inferred, false);
assert.equal(projected.boundaries.hunger_inferred, false);

const forged = structuredClone(turn);
forged.state_transitions[0].to = 60;
assert.equal(projectWorldSimulationBodyInteroceptiveSignals({
  world_state: after,
  world_history: { turns: [forged] },
  world_state_revision: 1,
  character: actor,
}).signals.length, 0);

const otherActor = structuredClone(turn);
otherActor.state_transitions[0].entity = "someone-else";
assert.equal(projectWorldSimulationBodyInteroceptiveSignals({
  world_state: after,
  world_history: { turns: [otherActor] },
  world_state_revision: 1,
  character: actor,
}).signals.length, 0);

const noInternalEnergy = structuredClone(after);
delete noInternalEnergy.characters[actor].physical_state.energy_current;
const unavailable = projectWorldSimulationBodyInteroceptiveSignals({
  world_state: noInternalEnergy,
  world_history: { turns: [turn] },
  world_state_revision: 1,
  character: actor,
});
assert.equal(unavailable.channel_status, "unavailable");
assert.equal(unavailable.signals.length, 0);

const contract = buildWorldSimulationBodyInteroceptiveSignalContract();
assert.equal(contract.numeric_internal_state_exposed, false);
assert.equal(contract.change_signal_is_subjective_feeling, false);
assert.equal(contract.fatigue_or_hunger_inferred, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1h-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1H basic interoception fixture",
    seed: "body1h",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: before,
  }, options);
  const id = session.world_simulation_session_id;
  const initial = await readCommittedWorldSimulationBodyInteroceptiveSignals({
    session_id: id,
    character: actor,
    expected_revision: 0,
  }, options);
  assert.equal(initial.channel_status, "available");
  assert.equal(initial.signals.length, 0);

  const state = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: state.state_hash,
    turn_id: "energy-change",
    next_world_state: after,
    state_transitions: [transition],
  }, options);

  const committed = await readCommittedWorldSimulationBodyInteroceptiveSignals({
    session_id: id,
    character: actor,
    expected_revision: 1,
  }, options);
  assert.equal(committed.signals.length, 1);
  assert.equal(committed.signals[0].direction, "decrease");
  assert.equal(JSON.stringify(committed).includes('"energy_current":70'), false);
  await assert.rejects(readCommittedWorldSimulationBodyInteroceptiveSignals({
    session_id: id,
    character: actor,
    expected_state_hash: "wrong",
  }, options), { code: "BODY1H_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("BODY-1H basic interoceptive signal tests passed.");
