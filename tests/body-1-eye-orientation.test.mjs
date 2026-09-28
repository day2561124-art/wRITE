import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { projectRoot } from "../server/src/project-paths.mjs";
import { adjudicateWorldSimulationCausality } from "../server/src/world-simulation-causal-rule-engine.mjs";
import { queryWorldSimulationObserverDirectionalHeightVisibility } from "../server/src/world-simulation-directional-height-visibility-service.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState, getWorldSimulationHistory,
} from "../server/src/world-simulation-state-service.mjs";

const actor = "aria";
const scene = {
  scene_id: "yard", dimensions: { width_m: 10, depth_m: 10 },
  entity_positions: {
    aria: { x: 2, y: 2 }, front: { x: 4, y: 2 },
    angled: { x: 3, y: 3.732 },
  },
  visibility_profiles: { aria: { horizontal_fov_degrees: 40 } },
  perception_labels_by: { aria: {
    front: "前方的人", angled: "斜前方的人",
  } },
};
const world = {
  simulation_time: "2026-09-28T04:00:00Z",
  event_queue: [{ event_id: "eye-turn", scene_id: "yard", type: "observe",
    participants: [actor] }],
  world_rules: { default_vision_range_m: 10 },
  scenes: { yard: scene },
  characters: {
    aria: { facing_degrees: 0, physical_state: { eye_yaw_limit_degrees: 70 } },
    front: {}, angled: {},
  },
};
const observe = (state) =>
  queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: state, scene_state: state.scenes.yard,
    scene_id: "yard", observer: actor,
  }).result;
const candidate = { action_id: "turn-eyes", motor_command: {
  type: "orient_eyes", eye_yaw_degrees: 60,
} };
const event = world.event_queue[0];
const solve = async (state = world, action = candidate) =>
  adjudicateWorldSimulationCausality({
    world_simulation_session_id: "body1k-test", turn_id: "eye-turn",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event,
    selected_action_intents: [{ character: actor, candidate: action }],
  });

assert.equal(observe(world).visible_entities.includes("front"), true);
assert.equal(observe(world).visible_entities.includes("angled"), false);
const result = await solve();
assert.equal(result.action_outcomes.find((item) =>
  item.action_id === "turn-eyes")?.result, "eye_orientation_completed");
assert.equal(result.next_world_state.characters.aria.facing_degrees, 0);
assert.equal(result.next_world_state.characters.aria.eye_yaw_degrees, 60);
assert.equal(result.state_transitions.some((item) =>
  item.entity === actor && item.field === "eye_yaw_degrees"), true);
assert.equal(observe(result.next_world_state).visible_entities.includes("angled"), true);
assert.equal(observe(result.next_world_state).visible_entities.includes("front"), false);
assert.equal(observe(world).visible_entities.includes("angled"), false);
assert.equal(JSON.stringify(result.action_outcomes).includes("斜前方的人"), false);

const blocked = async (state, yaw) => {
  const resolved = await solve(state, { action_id: "blocked-eye",
    motor_command: { type: "orient_eyes", eye_yaw_degrees: yaw } });
  assert.equal(resolved.action_outcomes.find((item) =>
    item.action_id === "blocked-eye")?.result, "eye_orientation_blocked");
  assert.equal(resolved.next_world_state.characters.aria.eye_yaw_degrees, undefined);
};
await blocked({ ...world, characters: {
  ...world.characters, aria: { facing_degrees: 0, physical_state: {} },
} }, 60);
await blocked(world, 71);
await blocked(world, "60");
await blocked({ ...world, characters: {
  ...world.characters, aria: { ...world.characters.aria,
    physical_state: { eye_yaw_limit_degrees: 70, unconscious: true } },
} }, 60);
await blocked({ ...world, characters: {
  ...world.characters, aria: { physical_state: { eye_yaw_limit_degrees: 70 } },
} }, 60);
assert.throws(() => observe({ ...world, characters: {
  ...world.characters, aria: { ...world.characters.aria, eye_yaw_degrees: 71 },
} }), { code: "WORLD_SIMULATION_VISIBILITY_EYE_YAW_INVALID" });

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1k-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1K committed ocular visual reentry", seed: "body1k",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: world,
  }, options);
  const sessionId = session.world_simulation_session_id;
  const current = await getWorldSimulationState(sessionId, options);
  const selected = [{ character: actor, candidate }];
  await commitWorldSimulationTurn(sessionId, {
    expected_revision: 0, expected_state_hash: current.state_hash,
    turn_id: "eye-turn", next_world_state: result.next_world_state,
    selected_action_intents: selected, action_outcomes: result.action_outcomes,
    state_transitions: result.state_transitions,
  }, options);
  const committed = await getWorldSimulationState(sessionId, options);
  const history = await getWorldSimulationHistory(sessionId, options);
  assert.equal(committed.revision, 1);
  assert.equal(committed.state.characters.aria.eye_yaw_degrees, 60);
  assert.equal(history.turns.at(-1).revision_to, 1);
  assert.equal(observe(committed.state).visible_entities.includes("angled"), true);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1K configured ocular orientation and visual reentry tests passed.");
