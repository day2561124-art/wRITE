import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import {
  queryWorldSimulationObserverOlfaction,
  buildWorldSimulationOlfactionQueryContract,
} from "../server/src/world-simulation-olfaction-query-service.mjs";
import {
  projectWorldSimulationBodyOlfactoryReentry,
  readCommittedWorldSimulationBodyOlfactoryReentry,
} from "../server/src/world-simulation-body-olfactory-reentry-service.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../server/src/world-simulation-state-service.mjs";

const actor = "observer-private-engine-id";
const odorId = "private-flower-engine-id";
const sceneId = "garden";
const original = {
  characters: { [actor]: {} },
  scenes: { [sceneId]: {
    scene_id: sceneId, entity_positions: { [actor]: { x: 0, y: 0 } },
    olfactory_profiles: { [actor]: { receptor_enabled: true, detection_threshold: 0.7 } },
    odor_sources: [{ id: odorId, position: { x: 10, y: 0 }, strength: 1, max_range_m: 8 }],
    olfactory_labels_by: { [actor]: { [odorId]: "花香" } },
  } },
  event_queue: [],
};
const moved = structuredClone(original);
moved.scenes[sceneId].entity_positions[actor] = { x: 6, y: 0 };
function query(world) {
  const sample = queryWorldSimulationObserverOlfaction({
    world_state: world, scene_state: world.scenes[sceneId],
    scene_id: sceneId, observer: actor,
  });
  return { version: sample.olfaction_query_version, result: sample.result, audit: sample.audit };
}
const pre = query(original);
const post = query(moved);
assert.equal(pre.result.perception_olfactory_observations.length, 0);
assert.deepEqual(post.result.perception_olfactory_observations, [
  { sense: "olfactory", kind: "detected_odor", perceptual_label: "花香" },
]);
assert.equal(post.result.source_audit[0].odor_id, odorId);
assert.equal(JSON.stringify(post.result.perception_olfactory_observations).includes(odorId), false);
assert.equal(JSON.stringify(post.result.perception_olfactory_observations).includes("received_strength"), false);
assert.equal(JSON.stringify(post.result.perception_olfactory_observations).includes("source_position"), false);
assert.deepEqual(query(moved), post);
const absent = structuredClone(moved);
delete absent.scenes[sceneId].olfactory_profiles;
assert.equal(query(absent).result.perception_olfactory_observations.length, 0);
const disabled = structuredClone(moved);
disabled.scenes[sceneId].olfactory_profiles[actor].receptor_enabled = false;
assert.equal(query(disabled).result.perception_olfactory_observations.length, 0);
assert.throws(() => queryWorldSimulationObserverOlfaction({
  world_state: moved, scene_state: { ...moved.scenes[sceneId],
    olfactory_profiles: { [actor]: { receptor_enabled: true } } },
  observer: actor,
}), { code: "BODY1F_THRESHOLD_INVALID" });
const otherScene = structuredClone(moved);
otherScene.scenes[sceneId].odor_sources = [];
otherScene.odor_sources = [{ id: odorId, scene_id: "different", position: { x: 6, y: 0 },
  strength: 1, max_range_m: 8 }];
assert.equal(query(otherScene).result.detected_count, 0);
assert.equal(buildWorldSimulationOlfactionQueryContract().explicit_receptor_required, true);

const selected = {
  character: actor, selection: "candidate_action_intent", action_id: "approach",
  candidate: { action_id: "approach", kind: "movement",
    movement: { destination: { x: 6, y: 0 } } },
};
const turn1 = {
  turn_id: "approach-turn", revision_from: 0, revision_to: 1,
  previous_state_hash: "initial", next_state_hash: "moved",
  selected_action_intents: [selected],
  action_outcomes: [{ actor, action_id: "approach", result: "movement_completed" }],
  state_transitions: [{ entity: actor, field: "position", from: { x: 0, y: 0 },
    to: { x: 6, y: 0 }, action_id: "approach" }],
  olfaction_queries: [pre],
};
const turn2 = {
  turn_id: "smell-after-approach", revision_from: 1, revision_to: 2,
  previous_state_hash: "moved", next_state_hash: "later", olfaction_queries: [post],
};
const project = (first, second) => projectWorldSimulationBodyOlfactoryReentry({
  world_history: { turns: [first, second] }, character: actor,
});
const result = project(turn1, turn2);
assert.equal(result.pairs[0].actual_position_changed, true);
assert.equal(result.pairs[0].next_olfactory_sample.observation_count_changed, true);
assert.equal(result.pairs[0].next_olfactory_sample.source_world_revision, 1);
assert.equal(JSON.stringify(result).includes(odorId), false);
assert.equal(JSON.stringify(result).includes('"received_strength":'), false);
const forged = structuredClone(turn2);
forged.previous_state_hash = "wrong";
assert.equal(project(turn1, forged).pairs[0].next_olfactory_sample, null);
const outcomeOnly = structuredClone(turn1);
outcomeOnly.state_transitions = [];
assert.equal(project(outcomeOnly, turn2).pairs[0].next_olfactory_sample, null);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1f-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1F olfactory reentry fixture", seed: "body-1f",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: original,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "approach-turn", next_world_state: moved,
    selected_action_intents: turn1.selected_action_intents,
    action_outcomes: turn1.action_outcomes, state_transitions: turn1.state_transitions,
    olfaction_queries: [pre],
  }, options);
  const pending = await readCommittedWorldSimulationBodyOlfactoryReentry({
    session_id: id, character: actor, expected_revision: 1,
  }, options);
  assert.equal(pending.pairs[0].next_olfactory_sample, null);
  const second = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 1, expected_state_hash: second.state_hash,
    turn_id: "smell-after-approach", next_world_state: moved, olfaction_queries: [post],
  }, options);
  const committed = await readCommittedWorldSimulationBodyOlfactoryReentry({
    session_id: id, character: actor, expected_revision: 2,
  }, options);
  assert.equal(committed.pairs[0].next_olfactory_sample.observation_count, 1);
  assert.equal(JSON.stringify(committed).includes(odorId), false);
  await assert.rejects(readCommittedWorldSimulationBodyOlfactoryReentry({
    session_id: id, character: actor, expected_state_hash: "wrong",
  }, options), { code: "BODY1F_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1F programmatic olfaction and committed reentry tests passed.");
