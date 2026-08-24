import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationDirectionalHeightVisibilityContract,
  queryWorldSimulationObserverDirectionalHeightVisibility,
  worldSimulationDirectionalHeightVisibilityVersion,
} from "../../server/src/world-simulation-directional-height-visibility-service.mjs";
import {
  buildWorldSimulationLoopContract,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  worldSimulationVisibilityQueryVersion,
} from "../../server/src/world-simulation-visibility-query-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62x-directional-height-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "observer-engine-id";
const openTarget = "front-open-engine-id";
const boundaryTarget = "fov-boundary-engine-id";
const partialTarget = "partial-cover-engine-id";
const crouchedTarget = "crouched-cover-engine-id";
const rearTarget = "rear-engine-id";
const legacyTarget = "legacy-cover-engine-id";
const sceneId = "phase62x-visibility-lab";

const sceneState = {
  scene_id: sceneId,
  dimensions: { width_m: 14, depth_m: 10 },
  entity_positions: {
    [observer]: { x: 0, y: 0 },
    [openTarget]: { x: 4, y: -3 },
    [boundaryTarget]: { x: 4, y: 4 },
    [partialTarget]: { x: 6, y: 0 },
    [crouchedTarget]: { x: 6, y: 2 },
    [rearTarget]: { x: -3, y: 0 },
    [legacyTarget]: { x: 6, y: -2 },
  },
  visibility_profiles: {
    [observer]: {
      facing_degrees: 0,
      horizontal_fov_degrees: 90,
      eye_height_m: 1.6,
    },
    [openTarget]: { height_m: 1.8 },
    [boundaryTarget]: { height_m: 1.8 },
    [partialTarget]: { height_m: 1.8 },
    [crouchedTarget]: {
      posture: "crouching",
      posture_height_m: 0.9,
    },
    [rearTarget]: { height_m: 1.8 },
    [legacyTarget]: { height_m: 1.8 },
  },
  obstacles: [
    {
      id: "low-cover",
      x_min: 3,
      x_max: 3.5,
      y_min: -0.45,
      y_max: 0.45,
      base_z_m: 0,
      top_z_m: 1.0,
      blocks_vision: true,
    },
    {
      id: "crouch-cover",
      x_min: 3,
      x_max: 3.5,
      y_min: 0.8,
      y_max: 1.3,
      base_z_m: 0,
      top_z_m: 1.4,
      blocks_vision: true,
    },
    {
      id: "legacy-unbounded-cover",
      x_min: 3,
      x_max: 3.5,
      y_min: -1.3,
      y_max: -0.7,
      blocks_vision: true,
    },
  ],
  perception_labels_by: {
    [observer]: {
      [openTarget]: "前方偏右的一名學生",
      [boundaryTarget]: "視野邊緣的一名學生",
      [partialTarget]: "矮牆上方露出的身影",
      [crouchedTarget]: "蹲在掩體後的人",
      [rearTarget]: "背後的人",
      [legacyTarget]: "舊式遮蔽物後的人",
    },
  },
  public_visual: [
    "訓練場的白色地面標線清楚可見",
    {
      subject_entity_id: rearTarget,
      text: "背後的人清楚可見",
    },
  ],
  observable_by: {
    [observer]: {
      visual: [
        {
          subject_entity_id: partialTarget,
          text: "能完整看清矮牆後那人的全身",
        },
        {
          subject_entity_id: partialTarget,
          text: "只看得到矮牆上方露出的部分輪廓",
          allow_partial_visibility: true,
        },
        {
          subject_entity_id: crouchedTarget,
          text: "能看見蹲在高掩體後的人",
        },
      ],
      audible: ["身後傳來一聲鞋底摩擦地面的聲音"],
    },
  },
};

const worldState = {
  simulation_time: "2026-08-24T17:30:00+08:00",
  world_rules: {
    default_vision_range_m: 20,
  },
  event_queue: [
    {
      event_id: "evt-directional-height-visibility",
      type: "observe_training_area",
      scene_id: sceneId,
      participants: [observer],
    },
  ],
  scenes: {
    [sceneId]: sceneState,
  },
  characters: {
    [observer]: {
      known: ["自己正在訓練場進行觀察"],
      current_action: "面向前方觀察",
      vision_range_m: 20,
    },
    [openTarget]: {},
    [boundaryTarget]: {},
    [partialTarget]: {},
    [crouchedTarget]: {},
    [rearTarget]: {},
    [legacyTarget]: {},
  },
  memories: {
    [observer]: [],
  },
  objects: {},
  available_actions: {
    [observer]: [
      {
        action_id: "keep-observing",
        intent: "維持朝向並繼續觀察",
      },
    ],
  },
};

try {
  const contract = buildWorldSimulationDirectionalHeightVisibilityContract();
  assert.equal(contract.version, worldSimulationDirectionalHeightVisibilityVersion);
  assert.equal(contract.base_visibility_version, worldSimulationVisibilityQueryVersion);
  assert.equal(contract.explicit_horizontal_fov_supported, true);
  assert.equal(contract.bounded_vertical_occlusion_supported, true);
  assert.equal(contract.partial_target_visibility_supported, true);
  assert.equal(contract.posture_label_to_height_inference_allowed, false);
  assert.equal(contract.legacy_unbounded_blockers_preserve_full_occlusion, true);
  assert.equal(contract.brain_receives_engine_target_ids, false);
  assert.equal(contract.lighting_threshold_modeled, false);
  assert.equal(contract.sound_propagation_modeled, false);

  const loopContract = buildWorldSimulationLoopContract();
  assert.equal(loopContract.character_perception_visuals_use_directional_height_visibility, true);
  assert.equal(
    loopContract.directional_height_visibility.version,
    worldSimulationDirectionalHeightVisibilityVersion,
  );
  assert.equal(loopContract.visibility_and_occlusion.version, worldSimulationVisibilityQueryVersion);

  const worldHashBefore = hashAgentRunValue(worldState);
  const sceneHashBefore = hashAgentRunValue(sceneState);
  const direct = queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: worldState,
    scene_state: sceneState,
    scene_id: sceneId,
    observer,
  });
  assert.equal(direct.result.status, "directional_height_visibility_resolved");
  assert.equal(direct.result.fov_enforced, true);
  assert.equal(direct.result.facing_degrees, 0);
  assert.equal(direct.result.horizontal_fov_degrees, 90);
  assert.equal(direct.result.observer_eye_z_m, 1.6);
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.equal(direct.audit.character_brain_decides_fov_or_height_visibility, false);

  assert.equal(direct.result.visible_entities.includes(openTarget), true);
  assert.equal(direct.result.visible_entities.includes(boundaryTarget), true);
  assert.equal(direct.result.visible_entities.includes(partialTarget), true);
  assert.equal(direct.result.visible_entities.includes(crouchedTarget), false);
  assert.equal(direct.result.visible_entities.includes(rearTarget), false);
  assert.equal(direct.result.visible_entities.includes(legacyTarget), false);

  const partial = direct.result.partially_visible_entities.find(
    (item) => item.entity_id === partialTarget,
  );
  assert.ok(partial);
  assert.equal(partial.visible_fraction > 0 && partial.visible_fraction < 1, true);
  assert.equal(
    direct.result.occluded_entities.find((item) => item.entity_id === crouchedTarget)?.reason,
    "height_occluded",
  );
  assert.equal(
    direct.result.occluded_entities.find((item) => item.entity_id === rearTarget)?.reason,
    "outside_field_of_view",
  );
  assert.equal(
    direct.result.occluded_entities.find((item) => item.entity_id === legacyTarget)
      ?.vertical_occlusion?.legacy_unbounded_blocker_present,
    true,
  );

  const directVisualText = JSON.stringify(direct.result.perception_visual_observations);
  assert.equal(directVisualText.includes("前方偏右的一名學生"), true);
  assert.equal(directVisualText.includes("視野邊緣的一名學生"), true);
  assert.equal(directVisualText.includes("矮牆上方露出的身影"), true);
  assert.equal(directVisualText.includes("只看得到矮牆上方露出的部分輪廓"), true);
  assert.equal(directVisualText.includes("能完整看清矮牆後那人的全身"), false);
  assert.equal(directVisualText.includes("能看見蹲在高掩體後的人"), false);
  assert.equal(directVisualText.includes("背後的人清楚可見"), false);
  for (const engineId of [openTarget, boundaryTarget, partialTarget, crouchedTarget, rearTarget, legacyTarget]) {
    assert.equal(directVisualText.includes(engineId), false);
  }
  assert.equal(hashAgentRunValue(worldState), worldHashBefore);
  assert.equal(hashAgentRunValue(sceneState), sceneHashBefore);

  const turnedScene = structuredClone(sceneState);
  turnedScene.visibility_profiles[observer].facing_degrees = 180;
  const turned = queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: { ...worldState, scenes: { [sceneId]: turnedScene } },
    scene_state: turnedScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(turned.result.visible_entities.includes(rearTarget), true);
  assert.equal(turned.result.visible_entities.includes(openTarget), false);

  const standingScene = structuredClone(sceneState);
  standingScene.visibility_profiles[crouchedTarget] = {
    posture: "standing",
    posture_height_m: 1.8,
  };
  const standing = queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: { ...worldState, scenes: { [sceneId]: standingScene } },
    scene_state: standingScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(standing.result.visible_entities.includes(crouchedTarget), true);
  assert.equal(
    standing.result.partially_visible_entities.some((item) => item.entity_id === crouchedTarget),
    true,
  );

  const legacyCompatibleScene = structuredClone(sceneState);
  delete legacyCompatibleScene.visibility_profiles[observer].facing_degrees;
  delete legacyCompatibleScene.visibility_profiles[observer].horizontal_fov_degrees;
  delete legacyCompatibleScene.visibility_profiles[observer].eye_height_m;
  const legacyCompatible = queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: { ...worldState, scenes: { [sceneId]: legacyCompatibleScene } },
    scene_state: legacyCompatibleScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(legacyCompatible.result.fov_enforced, false);
  assert.equal(legacyCompatible.result.height_occlusion_available, false);
  assert.equal(legacyCompatible.result.visible_entities.includes(rearTarget), true);
  assert.equal(legacyCompatible.result.visible_entities.includes(partialTarget), false);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62X directional height visibility fixture",
    seed: "phase62x",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-directional-height-visibility",
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        const serialized = JSON.stringify(packet);
        assert.equal(packet.boundaries.programmatic_visibility_enforced, true);
        assert.equal(packet.boundaries.directional_height_visibility_enforced, true);
        assert.equal(packet.boundaries.engine_visibility_target_ids_exposed, false);
        assert.equal(packet.perception.information_boundary.programmatic_visibility_enforced, true);
        assert.equal(packet.perception.information_boundary.directional_height_visibility_enforced, true);
        assert.equal(serialized.includes("前方偏右的一名學生"), true);
        assert.equal(serialized.includes("視野邊緣的一名學生"), true);
        assert.equal(serialized.includes("矮牆上方露出的身影"), true);
        assert.equal(serialized.includes("只看得到矮牆上方露出的部分輪廓"), true);
        assert.equal(serialized.includes("身後傳來一聲鞋底摩擦地面的聲音"), true);
        assert.equal(serialized.includes("能完整看清矮牆後那人的全身"), false);
        assert.equal(serialized.includes("背後的人"), false);
        assert.equal(serialized.includes("蹲在掩體後的人"), false);
        for (const engineId of [openTarget, boundaryTarget, partialTarget, crouchedTarget, rearTarget, legacyTarget]) {
          assert.equal(serialized.includes(engineId), false);
        }
        return { action_id: "keep-observing" };
      },
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.event_queue = [];
        return {
          causal_resolution_id: "phase62x-noop-resolution",
          next_world_state: next,
          state_transitions: [],
          action_outcomes: [
            {
              actor: observer,
              action_id: "keep-observing",
              result: "continued_observation",
              causal_evidence: "no world mutation requested",
            },
          ],
          knowledge_transitions: [],
          scheduled_events: [],
        };
      },
    },
  );
  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].visibility_queries.length, 1);
  assert.equal(history.turns[0].visibility_queries[0].version, worldSimulationVisibilityQueryVersion);
  assert.equal(history.turns[0].directional_height_visibility_queries.length, 1);
  assert.equal(
    history.turns[0].directional_height_visibility_queries[0].version,
    worldSimulationDirectionalHeightVisibilityVersion,
  );
  assert.equal(
    history.turns[0].directional_height_visibility_queries[0].result.partially_visible_entities
      .some((item) => item.entity_id === partialTarget),
    true,
  );

  console.log(JSON.stringify({
    directional_height_visibility_version: worldSimulationDirectionalHeightVisibilityVersion,
    persisted_history_turns: history.turns.length,
    fov_enforced: direct.result.fov_enforced,
    exact_fov_boundary_visible: direct.result.visible_entities.includes(boundaryTarget),
    rear_target_rejected_by_fov: direct.result.occluded_entities.some(
      (item) => item.entity_id === rearTarget && item.reason === "outside_field_of_view",
    ),
    turning_restores_rear_visibility: turned.result.visible_entities.includes(rearTarget),
    partial_cover_visible_fraction: partial.visible_fraction,
    crouched_target_fully_height_occluded: direct.result.occluded_entities.some(
      (item) => item.entity_id === crouchedTarget && item.reason === "height_occluded",
    ),
    explicit_standing_height_restores_partial_visibility: standing.result.partially_visible_entities
      .some((item) => item.entity_id === crouchedTarget),
    legacy_unbounded_cover_preserved: direct.result.occluded_entities.some(
      (item) => item.entity_id === legacyTarget
        && item.vertical_occlusion?.legacy_unbounded_blocker_present === true,
    ),
    partial_unsafe_declared_visual_filtered: directVisualText.includes("能完整看清矮牆後那人的全身") === false,
    engine_target_ids_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_fov_or_height_visibility: false,
    lighting_threshold_modeled: false,
    sound_propagation_modeled: false,
  }));
  console.log("Phase62X directional/FOV + height visibility test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
