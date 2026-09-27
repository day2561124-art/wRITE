import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationBodyHistoryContract,
  projectWorldSimulationBodyHistory,
  readCommittedWorldSimulationBodyHistory,
} from "../server/src/world-simulation-body-history-service.mjs";

const actor = "aria";
const initial = {
  characters: { aria: { physical_state: { injuries: [] } },
    bystander: { physical_state: { injuries: [] } } },
  scenes: { yard: { entity_positions: {
    aria: { x: 0, y: 0 }, bystander: { x: 8, y: 8 },
  } } },
  event_queue: [],
};
const choice = (action_id) => ({
  character: actor, selection: "selected",
  candidate: { action_id, movement: { destination: { x: 4, y: 0 } },
    object_id: "private-world-object" },
});
const blocked = {
  turn_id: "blocked", revision_to: 1,
  selected_action_intents: [choice("walk-blocked")],
  action_outcomes: [{ actor, action_id: "walk-blocked", result: "movement_blocked" }],
  state_transitions: [{ entity: "bystander", field: "position",
    from: { x: 8, y: 8 }, to: { x: 9, y: 8 } }],
};
const projected = projectWorldSimulationBodyHistory({
  character: actor, world_history: { turns: [blocked] },
});
assert.equal(projected.turns[0].intentions[0].motor_intention_recorded, true);
assert.equal(projected.turns[0].intentions[0].world_outcome, "movement_blocked");
assert.deepEqual(projected.turns[0].actual_movement, []);
assert.equal(JSON.stringify(projected).includes("private-world-object"), false);
assert.equal(JSON.stringify(projected).includes("bystander"), false);
assert.throws(() => projectWorldSimulationBodyHistory({
  character: actor, max_turns: 129,
}), { code: "BODY0B_HISTORY_LIMIT_INVALID" });
assert.equal(buildWorldSimulationBodyHistoryContract().separate_body_truth_authority, false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `body0b-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-0B committed history fixture",
    seed: "body-0b",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const empty = await readCommittedWorldSimulationBodyHistory({
    session_id: id, character: actor, expected_revision: 0,
  }, options);
  assert.deepEqual(empty.turns, []);
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: first.revision, expected_state_hash: first.state_hash,
    turn_id: "blocked", next_world_state: initial,
    selected_action_intents: blocked.selected_action_intents,
    action_outcomes: blocked.action_outcomes,
    state_transitions: blocked.state_transitions,
  }, options);
  const afterBlocked = await readCommittedWorldSimulationBodyHistory({
    session_id: id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(afterBlocked.turns[0].actual_movement.length, 0);
  const second = await getWorldSimulationState(id, options);
  const moved = structuredClone(initial);
  moved.scenes.yard.entity_positions.aria = { x: 4, y: 0 };
  moved.characters.aria.physical_state.injuries = [
    { region: "left_arm", severity: "severe" },
  ];
  await commitWorldSimulationTurn(id, {
    expected_revision: second.revision, expected_state_hash: second.state_hash,
    turn_id: "completed", next_world_state: moved,
    selected_action_intents: [choice("walk-completed")],
    action_outcomes: [{ actor, action_id: "walk-completed", result: "movement_completed" }],
    state_transitions: [
      { entity: actor, field: "position", from: { x: 0, y: 0 }, to: { x: 4, y: 0 } },
      { entity: actor, field: "physical_state.injuries", from: [],
        to: moved.characters.aria.physical_state.injuries },
    ],
  }, options);
  const actual = await readCommittedWorldSimulationBodyHistory({
    session_id: id, character: actor, expected_revision: 2, max_turns: 1,
  }, options);
  assert.equal(actual.authority, "committed_world_causal_history");
  assert.equal(actual.turns.length, 1);
  assert.deepEqual(actual.turns[0].actual_movement, [{
    from: { x: 0, y: 0 }, to: { x: 4, y: 0 },
  }]);
  assert.deepEqual(actual.turns[0].injury_changes, [{
    before_count: 0, after_count: 1,
  }]);
  assert.equal(JSON.stringify(actual).includes("severe"), false);
  await assert.rejects(readCommittedWorldSimulationBodyHistory({
    session_id: id, character: actor, expected_state_hash: "forged",
  }, options), { code: "BODY0B_COMMITTED_STATE_HASH_CHANGED" });
  await assert.rejects(readCommittedWorldSimulationBodyHistory({
    session_id: id, character: "unknown",
  }, options), { code: "BODY0B_CHARACTER_NOT_IN_COMMITTED_WORLD" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-0B committed body history tests passed.");
