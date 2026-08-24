import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationIlluminationVisibilityContract,
  queryWorldSimulationObserverIlluminationVisibility,
  worldSimulationIlluminationVisibilityVersion,
} from "../../server/src/world-simulation-illumination-visibility-service.mjs";
import {
  buildWorldSimulationLoopContract,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { worldSimulationDirectionalHeightVisibilityVersion } from "../../server/src/world-simulation-directional-height-visibility-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62y-illumination-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "observer-light-engine-id";
const clearTarget = "clear-target-engine-id";
const dimTarget = "dim-target-engine-id";
const silhouetteTarget = "silhouette-target-engine-id";
const darkTarget = "dark-target-engine-id";
const sourceLitTarget = "source-lit-target-engine-id";
const shadowTarget = "shadow-target-engine-id";
const dimObject = "dim-object-engine-id";
const sceneId = "phase62y-lighting-lab";

const sceneState = {
  scene_id: sceneId,
  dimensions: { width_m: 18, depth_m: 12 },
  entity_positions: {
    [observer]: { x: 0, y: 0 },
    [clearTarget]: { x: 4, y: 0 },
    [dimTarget]: { x: 4, y: 2 },
    [silhouetteTarget]: { x: 4, y: -2 },
    [darkTarget]: { x: 6, y: 1 },
    [sourceLitTarget]: { x: 8, y: 3 },
    [shadowTarget]: { x: 8, y: -3 },
  },
  object_positions: {
    [dimObject]: { x: 5, y: -1 },
  },
  visibility_profiles: {
    [observer]: {
      facing_degrees: 0,
      horizontal_fov_degrees: 120,
      eye_height_m: 1.6,
      illumination_thresholds_lux: {
        silhouette_min_lux: 1,
        dim_min_lux: 5,
        clear_min_lux: 20,
      },
    },
    [clearTarget]: { height_m: 1.8 },
    [dimTarget]: { height_m: 1.8 },
    [silhouetteTarget]: { height_m: 1.8 },
    [darkTarget]: { height_m: 1.8 },
    [sourceLitTarget]: { height_m: 1.8 },
    [shadowTarget]: { height_m: 1.8 },
    [dimObject]: { height_m: 0.8 },
  },
  lighting: {
    ambient_lux: 0.5,
    target_illumination_lux: {
      entities: {
        [clearTarget]: 30,
        [dimTarget]: 10,
        [silhouetteTarget]: 2,
        [darkTarget]: 0.4,
      },
      objects: {
        [dimObject]: 6,
      },
    },
    light_sources: [
      {
        id: "upper-lamp",
        position: { x: 6, y: 3 },
        illuminance_lux_at_1m: 80,
        max_range_m: 4,
      },
      {
        id: "lower-lamp",
        position: { x: 6, y: -3 },
        illuminance_lux_at_1m: 80,
        max_range_m: 4,
      },
    ],
  },
  light_blockers: [
    {
      id: "lower-light-screen",
      x_min: 6.8,
      x_max: 7.2,
      y_min: -3.5,
      y_max: -2.5,
      blocks_light: true,
    },
  ],
  perception_labels_by: {
    [observer]: {
      [clearTarget]: {
        visual_label: "胸前有銀色徽章的學生",
        dim_visual_label: "昏暗中的學生身影",
        silhouette_label: "一道學生身形的輪廓",
      },
      [dimTarget]: {
        visual_label: "制服姓名牌完全清楚的學生",
        dim_visual_label: "昏暗中的另一名學生身影",
        silhouette_label: "另一道人形輪廓",
      },
      [silhouetteTarget]: {
        visual_label: "能看清五官的學生",
        silhouette_label: "一道無法辨識五官的人形輪廓",
      },
      [darkTarget]: { visual_label: "陰影中的學生五官清楚可見" },
      [sourceLitTarget]: { visual_label: "被上方燈光照亮的學生" },
      [shadowTarget]: { visual_label: "被遮光板後燈光照亮的學生" },
      [dimObject]: {
        visual_label: "能看清標籤文字的工具箱",
        dim_visual_label: "昏暗中的工具箱輪廓",
      },
    },
  },
  public_visual: ["出口方向的綠色指示燈仍亮著"],
  observable_by: {
    [observer]: {
      visual: [
        { subject_entity_id: clearTarget, text: "銀色徽章的形狀清楚可辨" },
        { subject_entity_id: dimTarget, text: "姓名牌上的文字清楚可讀" },
        { subject_entity_id: dimTarget, text: "昏暗中能辨認有人站著", minimum_illumination_tier: "dim" },
        { subject_entity_id: silhouetteTarget, text: "只能看到人形輪廓", minimum_illumination_tier: "silhouette" },
        { subject_entity_id: darkTarget, text: "黑暗中的人臉仍然清楚" },
        { subject_entity_id: shadowTarget, text: "遮光板後的人五官清楚" },
      ],
      audible: ["通風設備持續發出低沉風聲"],
    },
  },
};

const worldState = {
  simulation_time: "2026-08-24T18:00:00+08:00",
  world_rules: { default_vision_range_m: 30 },
  event_queue: [{
    event_id: "evt-illumination-visibility",
    type: "observe_lighting_lab",
    scene_id: sceneId,
    participants: [observer],
  }],
  scenes: { [sceneId]: sceneState },
  characters: {
    [observer]: { known: ["自己正在觀察照明實驗場"], current_action: "面向實驗區", vision_range_m: 30 },
    [clearTarget]: {}, [dimTarget]: {}, [silhouetteTarget]: {}, [darkTarget]: {}, [sourceLitTarget]: {}, [shadowTarget]: {},
  },
  memories: { [observer]: [] },
  objects: {
    [dimObject]: { scene_id: sceneId, position: { x: 5, y: -1 } },
  },
  available_actions: {
    [observer]: [{ action_id: "keep-observing-light", intent: "維持位置並繼續觀察光線變化" }],
  },
};

try {
  const contract = buildWorldSimulationIlluminationVisibilityContract();
  assert.equal(contract.version, worldSimulationIlluminationVisibilityVersion);
  assert.equal(contract.base_directional_height_visibility_version, worldSimulationDirectionalHeightVisibilityVersion);
  assert.equal(contract.explicit_lux_thresholds_required, true);
  assert.equal(contract.hidden_threshold_defaults_allowed, false);
  assert.equal(contract.point_light_inverse_square_attenuation_supported, true);
  assert.equal(contract.light_occlusion_supported, true);
  assert.equal(contract.clear_dim_silhouette_unresolved_tiers_supported, true);
  assert.equal(contract.brain_receives_engine_target_ids, false);
  assert.equal(contract.sound_propagation_modeled, false);

  const loopContract = buildWorldSimulationLoopContract();
  assert.equal(loopContract.character_perception_visuals_use_illumination_visibility, true);
  assert.equal(loopContract.illumination_visibility.version, worldSimulationIlluminationVisibilityVersion);

  const worldHashBefore = hashAgentRunValue(worldState);
  const sceneHashBefore = hashAgentRunValue(sceneState);
  const direct = queryWorldSimulationObserverIlluminationVisibility({
    world_state: worldState,
    scene_state: sceneState,
    scene_id: sceneId,
    observer,
  });
  assert.equal(direct.result.status, "illumination_visibility_resolved");
  assert.equal(direct.result.lighting_enforced, true);
  assert.deepEqual(direct.result.observer_thresholds_lux, {
    silhouette_min_lux: 1,
    dim_min_lux: 5,
    clear_min_lux: 20,
  });
  assert.equal(direct.result.clear_entities.includes(clearTarget), true);
  assert.equal(direct.result.dim_entities.includes(dimTarget), true);
  assert.equal(direct.result.silhouette_entities.includes(silhouetteTarget), true);
  assert.equal(direct.result.occluded_entities.some((item) => item.entity_id === darkTarget && item.reason === "insufficient_illumination"), true);
  assert.equal(direct.result.clear_entities.includes(sourceLitTarget), true);
  const shadow = direct.result.occluded_entities.find((item) => item.entity_id === shadowTarget);
  assert.ok(shadow);
  assert.equal(shadow.reason, "insufficient_illumination");
  assert.equal(shadow.illumination.contributions.some((item) => item.light_id === "lower-lamp" && item.occluded === true), true);
  assert.equal(direct.result.dim_objects.includes(dimObject), true);
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.equal(direct.audit.character_brain_decides_illumination_visibility, false);
  assert.equal(hashAgentRunValue(worldState), worldHashBefore);
  assert.equal(hashAgentRunValue(sceneState), sceneHashBefore);

  const visualText = JSON.stringify(direct.result.perception_visual_observations);
  assert.equal(visualText.includes("胸前有銀色徽章的學生"), true);
  assert.equal(visualText.includes("昏暗中的另一名學生身影"), true);
  assert.equal(visualText.includes("一道無法辨識五官的人形輪廓"), true);
  assert.equal(visualText.includes("昏暗中的工具箱輪廓"), true);
  assert.equal(visualText.includes("銀色徽章的形狀清楚可辨"), true);
  assert.equal(visualText.includes("昏暗中能辨認有人站著"), true);
  assert.equal(visualText.includes("只能看到人形輪廓"), true);
  assert.equal(visualText.includes("姓名牌上的文字清楚可讀"), false);
  assert.equal(visualText.includes("黑暗中的人臉仍然清楚"), false);
  assert.equal(visualText.includes("遮光板後的人五官清楚"), false);
  assert.equal(visualText.includes("制服姓名牌完全清楚的學生"), false);
  assert.equal(visualText.includes("能看清五官的學生"), false);
  assert.equal(visualText.includes("出口方向的綠色指示燈仍亮著"), true);
  for (const engineId of [clearTarget, dimTarget, silhouetteTarget, darkTarget, sourceLitTarget, shadowTarget, dimObject]) {
    assert.equal(visualText.includes(engineId), false);
  }

  const unblockedScene = structuredClone(sceneState);
  unblockedScene.light_blockers = [];
  const unblocked = queryWorldSimulationObserverIlluminationVisibility({
    world_state: { ...worldState, scenes: { [sceneId]: unblockedScene } },
    scene_state: unblockedScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(unblocked.result.clear_entities.includes(shadowTarget), true);

  const legacyScene = structuredClone(sceneState);
  delete legacyScene.visibility_profiles[observer].illumination_thresholds_lux;
  const legacy = queryWorldSimulationObserverIlluminationVisibility({
    world_state: { ...worldState, scenes: { [sceneId]: legacyScene } },
    scene_state: legacyScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(legacy.result.lighting_enforced, false);
  assert.equal(legacy.result.visible_entities.includes(darkTarget), true);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62Y illumination visibility fixture",
    seed: "phase62y",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-illumination-visibility",
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        const serialized = JSON.stringify(packet);
        assert.equal(packet.boundaries.programmatic_visibility_enforced, true);
        assert.equal(packet.boundaries.directional_height_visibility_enforced, true);
        assert.equal(packet.boundaries.illumination_visibility_enforced, true);
        assert.equal(packet.perception.information_boundary.illumination_visibility_enforced, true);
        assert.equal(serialized.includes("胸前有銀色徽章的學生"), true);
        assert.equal(serialized.includes("昏暗中的另一名學生身影"), true);
        assert.equal(serialized.includes("一道無法辨識五官的人形輪廓"), true);
        assert.equal(serialized.includes("姓名牌上的文字清楚可讀"), false);
        assert.equal(serialized.includes("黑暗中的人臉仍然清楚"), false);
        assert.equal(serialized.includes("通風設備持續發出低沉風聲"), true);
        for (const engineId of [clearTarget, dimTarget, silhouetteTarget, darkTarget, sourceLitTarget, shadowTarget, dimObject]) {
          assert.equal(serialized.includes(engineId), false);
        }
        return { action_id: "keep-observing-light" };
      },
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.event_queue = [];
        return {
          causal_resolution_id: "phase62y-noop-resolution",
          next_world_state: next,
          state_transitions: [],
          action_outcomes: [{ actor: observer, action_id: "keep-observing-light", result: "continued_observation", causal_evidence: "no world mutation requested" }],
          knowledge_transitions: [],
          scheduled_events: [],
        };
      },
    },
  );
  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].illumination_visibility_queries.length, 1);
  assert.equal(history.turns[0].illumination_visibility_queries[0].version, worldSimulationIlluminationVisibilityVersion);
  assert.equal(history.turns[0].illumination_visibility_queries[0].result.dim_entities.includes(dimTarget), true);

  console.log(JSON.stringify({
    illumination_visibility_version: worldSimulationIlluminationVisibilityVersion,
    persisted_history_turns: history.turns.length,
    lighting_enforced: direct.result.lighting_enforced,
    clear_target_resolved: direct.result.clear_entities.includes(clearTarget),
    dim_target_resolved: direct.result.dim_entities.includes(dimTarget),
    silhouette_target_resolved: direct.result.silhouette_entities.includes(silhouetteTarget),
    dark_target_rejected_by_illumination: direct.result.occluded_entities.some((item) => item.entity_id === darkTarget && item.reason === "insufficient_illumination"),
    point_light_inverse_square_clear: direct.result.clear_entities.includes(sourceLitTarget),
    light_blocker_casts_shadow: shadow.illumination.contributions.some((item) => item.light_id === "lower-lamp" && item.occluded === true),
    removing_light_blocker_restores_visibility: unblocked.result.clear_entities.includes(shadowTarget),
    missing_thresholds_preserve_legacy_visibility: legacy.result.lighting_enforced === false && legacy.result.visible_entities.includes(darkTarget),
    detailed_dim_visual_filtered: visualText.includes("姓名牌上的文字清楚可讀") === false,
    low_light_identity_detail_not_inferred: visualText.includes("制服姓名牌完全清楚的學生") === false,
    engine_target_ids_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_illumination_visibility: false,
    vertical_light_transport_modeled: false,
    sound_propagation_modeled: false,
  }));
  console.log("Phase62Y programmatic illumination visibility test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
