import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../server/src/project-paths.mjs";
import {
  queryWorldSimulationObserverAudibility,
  worldSimulationAudibilityQueryVersion,
} from "../server/src/world-simulation-audibility-query-service.mjs";
import {
  buildWorldSimulationBodyAuditoryReentryContract,
  projectWorldSimulationBodyAuditoryReentry,
  readCommittedWorldSimulationBodyAuditoryReentry,
} from "../server/src/world-simulation-body-auditory-reentry-service.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationState,
} from "../server/src/world-simulation-state-service.mjs";

const actor = "observer-engine-id";
const sceneId = "auditory-yard";
const soundId = "private-bell-engine-id";

const original = {
  characters: { [actor]: {} },
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 20, depth_m: 10 },
      entity_positions: { [actor]: { x: 0, y: 0 } },
      audibility_profiles: {
        [actor]: { minimum_audible_db: 45 },
      },
      sound_events: [{
        id: soundId,
        position: { x: 10, y: 0 },
        sound_level_db_at_1m: 60,
      }],
      auditory_labels_by: {
        [actor]: { [soundId]: "前方傳來一聲微弱鈴響" },
      },
    },
  },
  event_queue: [],
};

const moved = structuredClone(original);
moved.scenes[sceneId].entity_positions[actor] = { x: 6, y: 0 };

function persistedAudibility(world) {
  const query = queryWorldSimulationObserverAudibility({
    world_state: world,
    scene_state: world.scenes[sceneId],
    scene_id: sceneId,
    observer: actor,
  });
  return {
    version: query.audibility_query_version,
    result: query.result,
    audit: query.audit,
  };
}

const pre = persistedAudibility(original);
const post = persistedAudibility(moved);
assert.equal(pre.version, worldSimulationAudibilityQueryVersion);
assert.equal(pre.result.perception_auditory_observations.length, 0);
assert.equal(post.result.perception_auditory_observations.length, 1);

const selected = {
  character: actor,
  selection: "candidate_action_intent",
  action_id: "approach",
  candidate: {
    action_id: "approach",
    kind: "movement",
    movement: { destination: { x: 6, y: 0 } },
  },
};
const turn1 = {
  turn_id: "approach-turn",
  revision_from: 0,
  revision_to: 1,
  previous_state_hash: "initial",
  next_state_hash: "moved",
  selected_action_intents: [selected],
  action_outcomes: [{
    actor,
    action_id: "approach",
    result: "movement_completed",
  }],
  state_transitions: [{
    entity: actor,
    field: "position",
    from: { x: 0, y: 0 },
    to: { x: 6, y: 0 },
    action_id: "approach",
  }],
  audibility_queries: [pre],
};
const turn2 = {
  turn_id: "listen-after-approach",
  revision_from: 1,
  revision_to: 2,
  previous_state_hash: "moved",
  next_state_hash: "later",
  audibility_queries: [post],
};

const result = projectWorldSimulationBodyAuditoryReentry({
  world_history: { turns: [turn1, turn2] },
  character: actor,
});
assert.equal(result.pairs.length, 1);
assert.equal(result.pairs[0].actual_position_changed, true);
assert.equal(result.pairs[0].pre_action_auditory_observation_count, 0);
assert.equal(result.pairs[0].next_auditory_sample.observation_count, 1);
assert.equal(result.pairs[0].next_auditory_sample.source_world_revision, 1);
assert.equal(result.pairs[0].next_auditory_sample.observation_count_changed, true);
assert.equal(result.pairs[0].next_auditory_sample.bounded_observation_set_changed, true);
assert.equal(result.pairs[0].feedback_status,
  "later_committed_auditory_sample_available");

const serialized = JSON.stringify(result);
assert.equal(serialized.includes(soundId), false);
assert.equal(serialized.includes("received_level_db"), false);
assert.equal(serialized.includes("source_position"), false);

const forged = structuredClone(turn2);
forged.previous_state_hash = "wrong";
assert.equal(projectWorldSimulationBodyAuditoryReentry({
  world_history: { turns: [turn1, forged] },
  character: actor,
}).pairs[0].next_auditory_sample, null);

const outcomeOnly = structuredClone(turn1);
outcomeOnly.state_transitions = [];
const outcomeOnlyResult = projectWorldSimulationBodyAuditoryReentry({
  world_history: { turns: [outcomeOnly, turn2] },
  character: actor,
});
assert.equal(outcomeOnlyResult.pairs[0].actual_position_changed, false);
assert.equal(outcomeOnlyResult.pairs[0].next_auditory_sample, null);
assert.equal(outcomeOnlyResult.pairs[0].feedback_status,
  "no_later_committed_auditory_sample");
assert.equal(outcomeOnlyResult.boundaries.action_outcome_alone_is_not_auditory_feedback, true);

const contract = buildWorldSimulationBodyAuditoryReentryContract();
assert.equal(contract.movement_feedback_requires_committed_position_transition, true);
assert.equal(contract.later_auditory_sample_requires_committed_revision_hash_link, true);
assert.equal(contract.engine_sound_source_ids_exposed, false);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `body1e-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-1E auditory reentry fixture",
    seed: "body-1e",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: original,
  }, options);
  const id = session.world_simulation_session_id;

  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: first.state_hash,
    turn_id: "approach-turn",
    next_world_state: moved,
    selected_action_intents: turn1.selected_action_intents,
    action_outcomes: turn1.action_outcomes,
    state_transitions: turn1.state_transitions,
    audibility_queries: [pre],
  }, options);

  const beforeLaterSample = await readCommittedWorldSimulationBodyAuditoryReentry({
    session_id: id,
    character: actor,
    expected_revision: 1,
  }, options);
  assert.equal(beforeLaterSample.pairs[0].feedback_status,
    "no_later_committed_auditory_sample");

  const second = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 1,
    expected_state_hash: second.state_hash,
    turn_id: "listen-after-approach",
    next_world_state: moved,
    audibility_queries: [post],
  }, options);

  const afterLaterSample = await readCommittedWorldSimulationBodyAuditoryReentry({
    session_id: id,
    character: actor,
    expected_revision: 2,
  }, options);
  assert.equal(afterLaterSample.pairs[0].feedback_status,
    "later_committed_auditory_sample_available");
  assert.equal(afterLaterSample.pairs[0].next_auditory_sample.observation_count, 1);
  assert.equal(JSON.stringify(afterLaterSample).includes(soundId), false);

  await assert.rejects(
    readCommittedWorldSimulationBodyAuditoryReentry({
      session_id: id,
      character: actor,
      expected_state_hash: "forged",
    }, options),
    { code: "BODY1E_STATE_HASH_CHANGED" },
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("BODY-1E committed movement to auditory reentry tests passed.");
