import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationCommunicationBodyOrientationObserverContract,
  projectWorldSimulationObserverCommittedBodyOrientation,
  readCommittedWorldSimulationObserverBodyOrientation,
} from "../../server/src/world-simulation-communication-body-orientation-observer-service.mjs";

const action = buildCharacterCommunicationActionCandidate({
  character: "A",
  cognition: {
    communication_goal: {
      character: "A",
      addressee: "B",
      purpose: "請 B 暫停",
      mode: "nonverbal",
      nonverbal_signal: "以身體朝向示意",
      communication_context: {
        intentional_display: {
          intended_meaning: "不希望 B 離開",
          modality: "body",
          target: "B",
        },
      },
    },
  },
});

const initial = {
  simulation_time: "2026-09-29T00:00:00.000Z",
  world_rules: { communication_action_seconds: 0.25 },
  event_queue: [{
    event_id: "body-orientation",
    type: "interaction",
    scene_id: "room",
    participants: ["A", "B"],
  }],
  scenes: {
    room: {
      scene_id: "room",
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: {
        A: { x: 1, y: 1 },
        B: { x: 1, y: 4 },
      },
      entity_visual_detail_profiles: {
        A: {
          body_orientation_discernible: true,
          body_orientation_max_distance_m: 5,
        },
      },
    },
  },
  characters: {
    A: {
      facing_degrees: 0,
      body_facing_degrees: 0,
      physical_state: {},
    },
    B: {
      facing_degrees: 270,
      body_facing_degrees: 270,
      physical_state: {},
    },
  },
  objects: {},
};

const resolved = await adjudicateWorldSimulationCausality({
  world_simulation_session_id: "cc8k-test",
  turn_id: "body-orientation",
  world_state: initial,
  world_state_hash: hashAgentRunValue(initial),
  world_state_revision: 0,
  event: initial.event_queue[0],
  selected_action_intents: [{
    character: "A",
    selection: "candidate_action_intent",
    candidate: action,
  }],
});

const state = resolved.next_world_state;
const turn = {
  turn_id: "body-orientation",
  event: initial.event_queue[0],
  revision_from: 0,
  revision_to: 1,
  previous_state_hash: hashAgentRunValue(initial),
  next_state_hash: hashAgentRunValue(state),
  selected_action_intents: [{
    character: "A",
    selection: "candidate_action_intent",
    candidate: action,
  }],
  action_outcomes: resolved.action_outcomes,
  state_transitions: resolved.state_transitions,
};

const project = (world = state, source = turn, observer = "B") =>
  projectWorldSimulationObserverCommittedBodyOrientation({
    committed_turn: source,
    post_world_state: world,
    observer,
    scene_id: "room",
  });

const admitted = project();
assert.equal(admitted.admission_status, "visible_physical_cue_only");
assert.equal(admitted.character_view.length, 1);
assert.equal(
  admitted.character_view[0].kind,
  "visible_body_orientation_change",
);
assert.equal(admitted.audit.candidates[0].source_action_id, action.action_id);
assert.equal(
  JSON.stringify(admitted.character_view).includes(action.action_id),
  false,
);
assert.equal(
  JSON.stringify(admitted.character_view).includes("不希望 B 離開"),
  false,
);
assert.equal(JSON.stringify(admitted.character_view).includes('"A"'), false);
assert.equal(JSON.stringify(admitted.character_view).includes("90"), false);
assert.deepEqual(project(), admitted);

const withoutDetail = structuredClone(state);
delete withoutDetail.scenes.room.entity_visual_detail_profiles.A;
assert.equal(
  project(withoutDetail, {
    ...turn,
    next_state_hash: hashAgentRunValue(withoutDetail),
  }).admission_status,
  "no_admitted_visual_cue",
);

const tooFar = structuredClone(state);
tooFar.scenes.room.entity_visual_detail_profiles.A
  .body_orientation_max_distance_m = 1;
assert.equal(
  project(tooFar, {
    ...turn,
    next_state_hash: hashAgentRunValue(tooFar),
  }).admission_status,
  "no_admitted_visual_cue",
);

const occluded = structuredClone(state);
occluded.scenes.room.visibility_blockers = [{
  id: "wall",
  x_min: 0.5,
  x_max: 1.5,
  y_min: 2,
  y_max: 3,
}];
assert.equal(
  project(occluded, {
    ...turn,
    next_state_hash: hashAgentRunValue(occluded),
  }).admission_status,
  "no_admitted_visual_cue",
);

const unconscious = structuredClone(state);
unconscious.characters.B.physical_state.unconscious = true;
assert.equal(
  project(unconscious, {
    ...turn,
    next_state_hash: hashAgentRunValue(unconscious),
  }).admission_status,
  "no_admitted_visual_cue",
);

const dim = structuredClone(state);
dim.scenes.room.visibility_profiles = {
  B: {
    illumination_thresholds_lux: {
      silhouette_min_lux: 1,
      dim_min_lux: 5,
      clear_min_lux: 20,
    },
  },
};
dim.scenes.room.lighting = { ambient_lux: 10 };
assert.equal(
  project(dim, {
    ...turn,
    next_state_hash: hashAgentRunValue(dim),
  }).admission_status,
  "no_admitted_visual_cue",
);

assert.throws(
  () => project({ ...state, simulation_time: "tampered" }),
  /Exact committed post-action World revision and hash/,
);

const wrongTransition = structuredClone(turn);
const wrongOrientation = wrongTransition.state_transitions.find((item) =>
  item.field === "body_facing_degrees");
wrongOrientation.source_action_id = "wrong";
assert.throws(
  () => project(state, wrongTransition),
  /action-linked committed body change/,
);

const unchanged = structuredClone(turn);
const orientation = unchanged.state_transitions.find((item) =>
  item.field === "body_facing_degrees");
orientation.from = orientation.to;
assert.throws(
  () => project(state, unchanged),
  /action-linked committed body change/,
);

assert.equal(
  buildWorldSimulationCommunicationBodyOrientationObserverContract()
    .native_brain_ingress_performed,
  false,
);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc8k-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8K committed body orientation observer fixture",
    seed: "cc8k",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0,
    expected_state_hash: first.state_hash,
    turn_id: "body-orientation",
    next_world_state: state,
    selected_action_intents: turn.selected_action_intents,
    action_outcomes: turn.action_outcomes,
    state_transitions: turn.state_transitions,
    event: initial.event_queue[0],
  }, options);

  const committed =
    await readCommittedWorldSimulationObserverBodyOrientation({
      session_id: id,
      observer: "B",
      scene_id: "room",
      expected_revision: 1,
    }, options);
  assert.equal(
    committed.admission_status,
    "visible_physical_cue_only",
  );

  await assert.rejects(
    readCommittedWorldSimulationObserverBodyOrientation({
      session_id: id,
      observer: "B",
      scene_id: "room",
      expected_state_hash: "forged",
    }, options),
    { code: "CC8K_BODY_ORIENTATION_OBSERVER_INVALID" },
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-8K committed body orientation observer cue tests passed.");
