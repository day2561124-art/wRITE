import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { projectRoot } from "../server/src/project-paths.mjs";
import {
  adjudicateWorldSimulationCausality,
  buildWorldSimulationCausalRuleContract,
} from "../server/src/world-simulation-causal-rule-engine.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";

const actor = "aria";
const sceneId = "yard";
const world = {
  simulation_time: "2026-09-28T18:00:00+08:00",
  event_queue: [{
    event_id: "turn-body",
    scene_id: sceneId,
    type: "movement",
    participants: [actor],
  }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 10, depth_m: 10 },
      entity_positions: { [actor]: { x: 2, y: 2 } },
    },
  },
  characters: {
    [actor]: {
      body_facing_degrees: 0,
      facing_degrees: 30,
      eye_yaw_degrees: 10,
      physical_state: {},
    },
  },
};

const candidate = {
  action_id: "turn-torso",
  motor_command: {
    type: "orient_body",
    body_facing_degrees: 180,
  },
};
const solve = (state = world, action = candidate) =>
  adjudicateWorldSimulationCausality({
    world_simulation_session_id: "body1p-test",
    turn_id: "turn-body",
    world_state: state,
    world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0,
    event: state.event_queue[0],
    selected_action_intents: [{ character: actor, candidate: action }],
  });

const result = await solve();
assert.equal(
  result.action_outcomes.find((item) => item.action_id === candidate.action_id)?.result,
  "body_orientation_completed",
);
assert.equal(result.next_world_state.characters[actor].body_facing_degrees, 180);
assert.equal(result.next_world_state.characters[actor].facing_degrees, 30);
assert.equal(result.next_world_state.characters[actor].eye_yaw_degrees, 10);
assert.equal(result.state_transitions.some((item) =>
  item.entity === actor
  && item.field === "body_facing_degrees"
  && item.from === 0
  && item.to === 180), true);

for (const bodyFacing of ["180", -1, 360]) {
  const blocked = await solve(world, {
    action_id: "blocked-body-turn",
    motor_command: {
      type: "orient_body",
      body_facing_degrees: bodyFacing,
    },
  });
  assert.equal(
    blocked.action_outcomes.find((item) =>
      item.action_id === "blocked-body-turn")?.result,
    "body_orientation_blocked",
  );
  assert.equal(blocked.next_world_state.characters[actor].body_facing_degrees, 0);
}

const unconscious = structuredClone(world);
unconscious.characters[actor].physical_state.unconscious = true;
assert.equal(
  (await solve(unconscious)).action_outcomes.find((item) =>
    item.action_id === candidate.action_id)?.result,
  "body_orientation_blocked",
);

const absent = structuredClone(world);
delete absent.scenes[sceneId].entity_positions[actor];
assert.equal(
  (await solve(absent)).action_outcomes.find((item) =>
    item.action_id === candidate.action_id)?.result,
  "body_orientation_blocked",
);

const contract = buildWorldSimulationCausalRuleContract();
assert.equal(contract.orientation.body_orientation_supported, true);
assert.equal(contract.orientation.body_orientation_field, "body_facing_degrees");
assert.equal(contract.orientation.head_orientation_field, "facing_degrees");
assert.equal(contract.orientation.body_orientation_does_not_rewrite_head_orientation, true);
assert.equal(contract.orientation.world_commit_required, true);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `body1p-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1P body orientation fixture",
    seed: "body-1p",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: world,
  }, options);
  const id = session.world_simulation_session_id;
  const before = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: before.state_hash,
    turn_id: "turn-body",
    next_world_state: result.next_world_state,
    selected_action_intents: [{ character: actor, candidate }],
    action_outcomes: result.action_outcomes,
    state_transitions: result.state_transitions,
  }, options);
  const committed = await getWorldSimulationState(id, options);
  const history = await getWorldSimulationHistory(id, options);
  assert.equal(committed.revision, 1);
  assert.equal(committed.state.characters[actor].body_facing_degrees, 180);
  assert.equal(committed.state.characters[actor].facing_degrees, 30);
  assert.equal(history.turns.at(-1).state_transitions.some((item) =>
    item.entity === actor && item.field === "body_facing_degrees"), true);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("BODY-1P body orientation effector foundation tests passed.");
