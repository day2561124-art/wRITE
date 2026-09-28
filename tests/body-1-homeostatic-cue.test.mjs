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
  buildWorldSimulationBodyHomeostaticCueContract,
  projectWorldSimulationBodyHomeostaticCues,
  readCommittedWorldSimulationBodyHomeostaticCues,
} from "../server/src/world-simulation-body-homeostatic-cue-service.mjs";

const actor = "homeostatic-actor";
const before = {
  characters: {
    [actor]: {
      physical_state: {
        energy_current: 100,
        homeostatic_cues: {
          hunger: false,
          fullness: true,
          fatigue: false,
        },
      },
    },
  },
  scenes: {},
  objects: {},
  event_queue: [],
};
const after = structuredClone(before);
after.characters[actor].physical_state.energy_current = 10;
after.characters[actor].physical_state.homeostatic_cues.hunger = true;
after.characters[actor].physical_state.homeostatic_cues.fullness = false;
after.characters[actor].physical_state.homeostatic_cues.fatigue = true;

const transitions = [
  {
    entity: actor,
    field: "physical_state.energy_current",
    from: 100,
    to: 10,
  },
  {
    entity: actor,
    field: "physical_state.homeostatic_cues.hunger",
    from: false,
    to: true,
  },
  {
    entity: actor,
    field: "physical_state.homeostatic_cues.fullness",
    from: true,
    to: false,
  },
  {
    entity: actor,
    field: "physical_state.homeostatic_cues.fatigue",
    from: false,
    to: true,
  },
];
const turn = {
  turn_id: "homeostatic-change",
  revision_from: 0,
  revision_to: 1,
  previous_state_hash: "before",
  next_state_hash: "after",
  state_transitions: transitions,
};

const projected = projectWorldSimulationBodyHomeostaticCues({
  world_state: after,
  world_history: { turns: [turn] },
  world_state_revision: 1,
  character: actor,
});
assert.deepEqual(projected.cue_sense, {
  hunger: { status: "cue_active" },
  fullness: { status: "cue_inactive" },
  fatigue: { status: "cue_active" },
});
assert.deepEqual(projected.cue_feedback, [
  {
    modality: "interoception",
    channel: "hunger",
    signal: "homeostatic_cue_activated",
    source_world_revision: 1,
  },
  {
    modality: "interoception",
    channel: "fullness",
    signal: "homeostatic_cue_deactivated",
    source_world_revision: 1,
  },
  {
    modality: "interoception",
    channel: "fatigue",
    signal: "homeostatic_cue_activated",
    source_world_revision: 1,
  },
]);
assert.equal(JSON.stringify(projected).includes('"energy_current":10'), false);
assert.equal(projected.boundaries.energy_state_does_not_imply_hunger_or_fatigue, true);
assert.equal(projected.boundaries.cue_is_subjective_feeling, false);
assert.equal(projected.boundaries.cue_is_character_belief, false);

const energyOnly = structuredClone(after);
delete energyOnly.characters[actor].physical_state.homeostatic_cues;
assert.deepEqual(projectWorldSimulationBodyHomeostaticCues({
  world_state: energyOnly,
  world_history: { turns: [turn] },
  world_state_revision: 1,
  character: actor,
}).cue_sense, {
  hunger: { status: "unavailable" },
  fullness: { status: "unavailable" },
  fatigue: { status: "unavailable" },
});

const forged = structuredClone(turn);
forged.state_transitions[1].to = false;
assert.equal(projectWorldSimulationBodyHomeostaticCues({
  world_state: after,
  world_history: { turns: [forged] },
  world_state_revision: 1,
  character: actor,
}).cue_feedback.some((entry) => entry.channel === "hunger"), false);

const contract = buildWorldSimulationBodyHomeostaticCueContract();
assert.deepEqual(contract.channels, ["hunger", "fullness", "fatigue"]);
assert.equal(contract.energy_or_food_history_inference_allowed, false);
assert.equal(contract.subjective_feeling_asserted, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1q-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1Q committed homeostatic cue fixture",
    seed: "body1q",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: before,
  }, options);
  const id = session.world_simulation_session_id;
  const initial = await readCommittedWorldSimulationBodyHomeostaticCues({
    session_id: id,
    character: actor,
    expected_revision: 0,
  }, options);
  assert.equal(initial.cue_sense.hunger.status, "cue_inactive");
  assert.equal(initial.cue_feedback.length, 0);

  const state = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: state.state_hash,
    turn_id: "homeostatic-change",
    next_world_state: after,
    state_transitions: transitions,
  }, options);

  const committed = await readCommittedWorldSimulationBodyHomeostaticCues({
    session_id: id,
    character: actor,
    expected_revision: 1,
  }, options);
  assert.equal(committed.cue_sense.hunger.status, "cue_active");
  assert.equal(committed.cue_sense.fullness.status, "cue_inactive");
  assert.equal(committed.cue_sense.fatigue.status, "cue_active");
  assert.equal(committed.cue_feedback.length, 3);
  await assert.rejects(readCommittedWorldSimulationBodyHomeostaticCues({
    session_id: id,
    character: actor,
    expected_revision: 0,
  }, options), { code: "BODY1Q_STATE_REVISION_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("BODY-1Q committed homeostatic cue foundation tests passed.");
