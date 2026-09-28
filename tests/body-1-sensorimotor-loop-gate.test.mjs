import assert from "node:assert/strict";

import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "../server/src/world-simulation-causal-rule-engine.mjs";
import { queryWorldSimulationObserverDirectionalHeightVisibility } from "../server/src/world-simulation-directional-height-visibility-service.mjs";
import { queryWorldSimulationObserverAudibility } from "../server/src/world-simulation-audibility-query-service.mjs";
import { queryWorldSimulationObserverOlfaction } from "../server/src/world-simulation-olfaction-query-service.mjs";
import { projectWorldSimulationBodyTactileContact } from "../server/src/world-simulation-body-tactile-contact-service.mjs";
import { projectWorldSimulationBodyProprioceptiveFeedback } from "../server/src/world-simulation-body-proprioceptive-feedback-service.mjs";

const actor = "body1-gate-actor";

function adjudicate(world, turnId, candidate) {
  return adjudicateWorldSimulationCausality({
    world_simulation_session_id: "body1-gate",
    turn_id: turnId,
    world_state: world,
    world_state_hash: hashAgentRunValue(world),
    world_state_revision: 0,
    event: world.event_queue[0],
    selected_action_intents: [{ character: actor, selection: "candidate_action_intent", candidate }],
  });
}

{
  const world = {
    simulation_time: "2026-09-28T00:00:00.000Z",
    world_rules: { default_vision_range_m: 20 },
    event_queue: [{ event_id: "turn-head", type: "observe", scene_id: "yard", participants: [actor] }],
    characters: { [actor]: { physical_state: {} }, front: {}, behind: {} },
    objects: {},
    scenes: {
      yard: {
        scene_id: "yard",
        dimensions: { width_m: 10, depth_m: 10 },
        entity_positions: {
          [actor]: { x: 2, y: 2 },
          front: { x: 4, y: 2 },
          behind: { x: 0, y: 2 },
        },
        visibility_profiles: {
          [actor]: { facing_degrees: 0, horizontal_fov_degrees: 90 },
        },
        perception_labels_by: {
          [actor]: { front: "前方人物", behind: "後方人物" },
        },
      },
    },
  };
  const observe = (state) => queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: state,
    scene_state: state.scenes.yard,
    scene_id: "yard",
    observer: actor,
  }).result;

  const before = observe(world);
  assert.equal(before.visible_entities.includes("front"), true);
  assert.equal(before.visible_entities.includes("behind"), false);

  const result = await adjudicate(world, "turn-head", {
    action_id: "turn-head",
    motor_command: { type: "orient_head", facing_degrees: 180 },
  });
  assert.equal(result.action_outcomes.find((entry) =>
    entry.action_id === "turn-head")?.result, "head_orientation_completed");

  const after = observe(result.next_world_state);
  assert.equal(after.visible_entities.includes("front"), false);
  assert.equal(after.visible_entities.includes("behind"), true);
}

{
  const soundId = "gate-sound-engine-id";
  const odorId = "gate-odor-engine-id";
  const world = {
    simulation_time: "2026-09-28T00:00:00.000Z",
    world_rules: { default_vision_range_m: 20 },
    event_queue: [{ event_id: "approach", type: "movement", scene_id: "garden", participants: [actor] }],
    characters: { [actor]: { physical_state: {} } },
    objects: {},
    scenes: {
      garden: {
        scene_id: "garden",
        dimensions: { width_m: 20, depth_m: 10 },
        entity_positions: { [actor]: { x: 0, y: 0 } },
        audibility_profiles: { [actor]: { minimum_audible_db: 45 } },
        sound_events: [{
          id: soundId,
          position: { x: 10, y: 0 },
          sound_level_db_at_1m: 60,
        }],
        auditory_labels_by: { [actor]: { [soundId]: "一聲鈴響" } },
        olfactory_profiles: {
          [actor]: { receptor_enabled: true, detection_threshold: 0.7 },
        },
        odor_sources: [{
          id: odorId,
          position: { x: 10, y: 0 },
          strength: 1,
          max_range_m: 8,
        }],
        olfactory_labels_by: { [actor]: { [odorId]: "花香" } },
      },
    },
  };
  const hear = (state) => queryWorldSimulationObserverAudibility({
    world_state: state,
    scene_state: state.scenes.garden,
    scene_id: "garden",
    observer: actor,
  }).result.perception_auditory_observations;
  const smell = (state) => queryWorldSimulationObserverOlfaction({
    world_state: state,
    scene_state: state.scenes.garden,
    scene_id: "garden",
    observer: actor,
  }).result.perception_olfactory_observations;

  assert.equal(hear(world).length, 0);
  assert.equal(smell(world).length, 0);

  const candidate = {
    action_id: "approach",
    kind: "movement",
    movement: { destination: { x: 6, y: 0 } },
  };
  const result = await adjudicate(world, "approach", candidate);
  assert.equal(result.action_outcomes.find((entry) =>
    entry.action_id === "approach")?.result, "movement_completed");
  assert.equal(result.state_transitions.some((entry) =>
    entry.entity === actor && entry.field === "position"), true);

  assert.equal(hear(result.next_world_state).length, 1);
  assert.equal(smell(result.next_world_state).length, 1);

  const proprioception = projectWorldSimulationBodyProprioceptiveFeedback({
    world_state: result.next_world_state,
    world_history: {
      turns: [{
        turn_id: "approach",
        revision_from: 0,
        revision_to: 1,
        previous_state_hash: "before",
        next_state_hash: "after",
        selected_action_intents: [{
          character: actor,
          selection: "candidate_action_intent",
          action_id: "approach",
          candidate,
        }],
        action_outcomes: result.action_outcomes,
        state_transitions: result.state_transitions,
      }],
    },
    world_state_revision: 1,
    character: actor,
    scene_id: "garden",
  });
  assert.equal(proprioception.movement_feedback.some((entry) =>
    entry.signal === "whole_body_translation_detected"), true);
  assert.equal(proprioception.boundaries.objective_world_coordinates_exposed, false);
}

{
  const objectId = "gate-private-object-id";
  const world = {
    simulation_time: "2026-09-28T00:00:00.000Z",
    event_queue: [{ event_id: "grasp", type: "object_interaction", scene_id: "room", participants: [actor] }],
    characters: {
      [actor]: {
        physical_state: {
          tactile_reception: { hand_contact_functional: true },
        },
      },
    },
    scenes: {
      room: {
        scene_id: "room",
        dimensions: { width_m: 10, depth_m: 10 },
        entity_positions: { [actor]: { x: 0, y: 0 } },
      },
    },
    objects: {
      [objectId]: {
        holder: null,
        scene_id: "room",
        position: { x: 0.5, y: 0 },
      },
    },
  };
  const candidate = {
    action_id: "take",
    object_interaction: { type: "pickup", object_id: objectId },
  };
  const result = await adjudicate(world, "grasp", candidate);
  assert.equal(result.action_outcomes.find((entry) =>
    entry.action_id === "take")?.result, "pickup_completed");

  const tactile = projectWorldSimulationBodyTactileContact({
    world_state: result.next_world_state,
    world_history: {
      turns: [{
        turn_id: "grasp",
        revision_from: 0,
        revision_to: 1,
        previous_state_hash: "before",
        next_state_hash: "after",
        selected_action_intents: [{
          character: actor,
          selection: "candidate_action_intent",
          action_id: "take",
          candidate,
        }],
        action_outcomes: result.action_outcomes,
        state_transitions: result.state_transitions,
      }],
    },
    world_state_revision: 1,
    character: actor,
  });
  assert.equal(tactile.tactile_signals.length, 1);
  assert.equal(tactile.tactile_signals[0].signal, "hand_contact_detected");
  assert.equal(JSON.stringify(tactile).includes(objectId), false);
}

console.log("BODY-1 Sensorimotor Loop Gate certification passed.");
