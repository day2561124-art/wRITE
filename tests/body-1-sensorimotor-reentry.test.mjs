import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn, getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";
import {
  queryWorldSimulationObserverDirectionalHeightVisibility,
} from "../server/src/world-simulation-directional-height-visibility-service.mjs";
import {
  buildWorldSimulationBodySensorimotorReentryContract,
  projectWorldSimulationBodySensorimotorReentry,
  readCommittedWorldSimulationBodySensorimotorReentry,
} from "../server/src/world-simulation-body-sensorimotor-reentry-service.mjs";

const actor = "observer-engine-id";
const target = "hidden-engine-id";
const sceneId = "yard";
const original = {
  characters: { [actor]: {}, [target]: {} },
  scenes: { [sceneId]: {
    scene_id: sceneId, dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { [actor]: { x: 0, y: 0 }, [target]: { x: 4, y: 0 } },
    visibility_profiles: { [actor]: {
      facing_degrees: 0, horizontal_fov_degrees: 90,
    } },
    obstacles: [{
      id: "screen", x_min: 1.5, x_max: 2.5, y_min: -0.5, y_max: 0.5,
      blocks_vision: true,
    }],
    perception_labels_by: { [actor]: { [target]: "前方的一名學生" } },
  } },
  world_rules: { default_vision_range_m: 20 },
  event_queue: [],
};
const moved = structuredClone(original);
moved.scenes[sceneId].entity_positions[actor] = { x: 3, y: 0 };
const query = (world) => queryWorldSimulationObserverDirectionalHeightVisibility({
  world_state: world, scene_state: world.scenes[sceneId],
  scene_id: sceneId, observer: actor,
});
const pre = query(original);
const post = query(moved);
assert.equal(pre.result.perception_visual_observations.length, 0);
assert.equal(post.result.perception_visual_observations.length, 1);
const movement = {
  character: actor, selection: "candidate_action_intent", action_id: "walk",
  candidate: { action_id: "walk", kind: "movement",
    movement: { destination: { x: 3, y: 0 } }, object_id: target },
};
const turn1 = {
  turn_id: "walk-turn", revision_from: 0, revision_to: 1,
  previous_state_hash: "initial", next_state_hash: "moved",
  selected_action_intents: [movement],
  action_outcomes: [{ actor, action_id: "walk", result: "movement_completed" }],
  state_transitions: [{ entity: actor, field: "position",
    from: { x: 0, y: 0 }, to: { x: 3, y: 0 } }],
  directional_height_visibility_queries: [pre],
};
const turn2 = {
  turn_id: "look-turn", revision_from: 1, revision_to: 2,
  previous_state_hash: "moved", next_state_hash: "later",
  directional_height_visibility_queries: [post],
};
const result = projectWorldSimulationBodySensorimotorReentry({
  world_history: { turns: [turn1, turn2] }, character: actor,
});
assert.equal(result.pairs.length, 1);
assert.equal(result.pairs[0].actual_position_changed, true);
assert.equal(result.pairs[0].pre_action_visual_observation_count, 0);
assert.equal(result.pairs[0].next_visual_sample.observation_count, 1);
assert.equal(result.pairs[0].next_visual_sample.source_world_revision, 1);
assert.equal(result.pairs[0].next_visual_sample.observation_count_changed, true);
assert.equal(JSON.stringify(result).includes(target), false);
assert.equal(JSON.stringify(result).includes("前方的一名學生"), false);
const forged = structuredClone(turn2);
forged.previous_state_hash = "wrong";
assert.equal(projectWorldSimulationBodySensorimotorReentry({
  world_history: { turns: [turn1, forged] }, character: actor,
}).pairs[0].next_visual_sample, null);
const blocked = structuredClone(turn1);
blocked.state_transitions = [];
blocked.action_outcomes[0].result = "movement_blocked";
assert.equal(projectWorldSimulationBodySensorimotorReentry({
  world_history: { turns: [blocked] }, character: actor,
}).pairs[0].actual_position_changed, false);
assert.equal(buildWorldSimulationBodySensorimotorReentryContract()
  .later_visual_sample_requires_committed_revision_link, true);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1a-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1A reentry fixture", seed: "body-1a",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: original,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "walk-turn", next_world_state: moved,
    selected_action_intents: turn1.selected_action_intents,
    action_outcomes: turn1.action_outcomes,
    state_transitions: turn1.state_transitions,
    directional_height_visibility_queries: [pre],
  }, options);
  const beforeNextSample = await readCommittedWorldSimulationBodySensorimotorReentry({
    session_id: id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(beforeNextSample.pairs[0].feedback_status, "no_later_committed_sample");
  const second = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 1, expected_state_hash: second.state_hash,
    turn_id: "look-turn", next_world_state: moved,
    directional_height_visibility_queries: [post],
  }, options);
  const afterNextSample = await readCommittedWorldSimulationBodySensorimotorReentry({
    session_id: id, character: actor, expected_revision: 2,
  }, options);
  assert.equal(afterNextSample.pairs[0].feedback_status, "later_committed_sample_available");
  assert.equal(afterNextSample.pairs[0].next_visual_sample.observation_count, 1);
  await assert.rejects(readCommittedWorldSimulationBodySensorimotorReentry({
    session_id: id, character: actor, expected_state_hash: "forged",
  }, options), { code: "BODY1A_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1A committed motor to visual reentry tests passed.");
