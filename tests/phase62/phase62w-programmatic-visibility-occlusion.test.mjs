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
  buildWorldSimulationVisibilityQueryContract,
  queryWorldSimulationObserverVisibility,
  worldSimulationVisibilityQueryVersion,
} from "../../server/src/world-simulation-visibility-query-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62w-visibility-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

await rm(fixtureRoot, { recursive: true, force: true });

const observer = "observer-char";
const visibleTarget = "visible-target-engine-id";
const occludedTarget = "occluded-target-engine-id";
const doorTarget = "door-target-engine-id";
const visibleObject = "visible-object-engine-id";
const hiddenObject = "hidden-object-engine-id";
const sceneId = "visibility-lab";

const sceneState = {
  scene_id: sceneId,
  dimensions: { width_m: 12, depth_m: 8 },
  entity_positions: {
    [observer]: { x: 1, y: 2 },
    [visibleTarget]: { x: 3, y: 2 },
    [occludedTarget]: { x: 8, y: 2 },
    [doorTarget]: { x: 8, y: 6 },
  },
  object_positions: {
    [visibleObject]: { x: 2, y: 4 },
    [hiddenObject]: { x: 8, y: 3 },
  },
  obstacles: [
    {
      id: "opaque-wall",
      x_min: 5,
      x_max: 6,
      y_min: 0,
      y_max: 4,
      blocks_vision: true,
    },
    {
      id: "glass-panel",
      x_min: 3.5,
      x_max: 4,
      y_min: 0,
      y_max: 1,
      transparent: true,
    },
  ],
  doors: {
    "closed-visual-door": {
      open: false,
      x_min: 4,
      x_max: 5,
      y_min: 3.5,
      y_max: 4.5,
      blocks_vision: true,
    },
  },
  perception_labels_by: {
    [observer]: {
      [visibleTarget]: "一名穿白色訓練服的人",
      [occludedTarget]: "牆後的人影",
      [doorTarget]: "門後的人影",
      [visibleObject]: "一顆紅色訓練球",
      [hiddenObject]: "牆後的藍色箱子",
    },
  },
  public_visual: [
    "天花板照明穩定亮著",
    {
      subject_object_id: hiddenObject,
      text: "牆後的藍色箱子清楚可見",
    },
  ],
  observable_by: {
    [observer]: {
      visual: [
        {
          subject_entity_id: visibleTarget,
          text: "前方有人站在白線旁",
        },
        {
          subject_entity_id: occludedTarget,
          text: "能直接看見牆後的人",
        },
        "自己面前有白色站位線",
      ],
      audible: ["隔壁有模糊腳步聲"],
    },
  },
};

const worldState = {
  simulation_time: "2026-08-24T08:30:00+08:00",
  world_rules: {
    default_vision_range_m: 20,
  },
  event_queue: [
    {
      event_id: "evt-visibility",
      type: "visibility_observation",
      scene_id: sceneId,
      participants: [observer],
    },
  ],
  scenes: {
    [sceneId]: sceneState,
  },
  characters: {
    [observer]: {
      known: ["自己正在視線測試區"],
      current_action: "觀察",
      vision_range_m: 20,
    },
    [visibleTarget]: {},
    [occludedTarget]: {},
    [doorTarget]: {},
  },
  memories: {
    [observer]: [],
  },
  objects: {
    [visibleObject]: {
      scene_id: sceneId,
      position: { x: 2, y: 4 },
    },
    [hiddenObject]: {
      scene_id: sceneId,
      position: { x: 8, y: 3 },
    },
  },
  available_actions: {
    [observer]: [
      {
        action_id: "keep-observing",
        intent: "留在原地觀察",
      },
    ],
  },
};

try {
  const contract = buildWorldSimulationVisibilityQueryContract();
  assert.equal(contract.version, worldSimulationVisibilityQueryVersion);
  assert.equal(contract.read_only, true);
  assert.equal(contract.rectangular_occlusion_geometry, true);
  assert.equal(contract.closed_doors_with_geometry_supported, true);
  assert.equal(contract.brain_receives_engine_target_ids, false);
  assert.equal(contract.lighting_threshold_modeled, false);
  assert.equal(contract.sound_propagation_modeled, false);

  const loopContract = buildWorldSimulationLoopContract();
  assert.equal(loopContract.character_perception_visuals_use_programmatic_visibility, true);
  assert.equal(
    loopContract.visibility_and_occlusion.version,
    worldSimulationVisibilityQueryVersion,
  );

  const worldHashBefore = hashAgentRunValue(worldState);
  const sceneHashBefore = hashAgentRunValue(sceneState);
  const direct = queryWorldSimulationObserverVisibility({
    world_state: worldState,
    scene_state: sceneState,
    scene_id: sceneId,
    observer,
  });
  assert.equal(direct.result.status, "visibility_resolved");
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.deepEqual(direct.result.visible_entities, [visibleTarget]);
  assert.deepEqual(
    direct.result.occluded_entities.map((item) => item.entity_id).sort(),
    [doorTarget, occludedTarget].sort(),
  );
  assert.deepEqual(direct.result.visible_objects, [visibleObject]);
  assert.deepEqual(
    direct.result.occluded_objects.map((item) => item.object_id),
    [hiddenObject],
  );
  assert.equal(
    direct.result.occluded_entities.find((item) => item.entity_id === occludedTarget)
      ?.occluder?.blocker_id,
    "opaque-wall",
  );
  assert.equal(
    direct.result.occluded_entities.find((item) => item.entity_id === doorTarget)
      ?.occluder?.blocker_id,
    "closed-visual-door",
  );
  assert.equal(direct.result.filtered_declared_visual_count, 2);
  const directVisualText = JSON.stringify(direct.result.perception_visual_observations);
  assert.equal(directVisualText.includes("前方有人站在白線旁"), true);
  assert.equal(directVisualText.includes("自己面前有白色站位線"), true);
  assert.equal(directVisualText.includes("天花板照明穩定亮著"), true);
  assert.equal(directVisualText.includes("一名穿白色訓練服的人"), true);
  assert.equal(directVisualText.includes("一顆紅色訓練球"), true);
  assert.equal(directVisualText.includes("能直接看見牆後的人"), false);
  assert.equal(directVisualText.includes("牆後的藍色箱子清楚可見"), false);
  assert.equal(directVisualText.includes(visibleTarget), false);
  assert.equal(directVisualText.includes(occludedTarget), false);
  assert.equal(directVisualText.includes(hiddenObject), false);
  assert.equal(hashAgentRunValue(worldState), worldHashBefore);
  assert.equal(hashAgentRunValue(sceneState), sceneHashBefore);

  const openDoorScene = structuredClone(sceneState);
  openDoorScene.doors["closed-visual-door"].open = true;
  const openDoor = queryWorldSimulationObserverVisibility({
    world_state: {
      ...worldState,
      scenes: { [sceneId]: openDoorScene },
    },
    scene_state: openDoorScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(openDoor.result.visible_entities.includes(doorTarget), true);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62W visibility fixture",
    seed: "phase62w",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-visibility",
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        const serialized = JSON.stringify(packet);
        assert.equal(packet.boundaries.programmatic_visibility_enforced, true);
        assert.equal(packet.boundaries.engine_visibility_target_ids_exposed, false);
        assert.equal(packet.perception.information_boundary.programmatic_visibility_enforced, true);
        assert.equal(serialized.includes("一名穿白色訓練服的人"), true);
        assert.equal(serialized.includes("一顆紅色訓練球"), true);
        assert.equal(serialized.includes("隔壁有模糊腳步聲"), true);
        assert.equal(serialized.includes("能直接看見牆後的人"), false);
        assert.equal(serialized.includes("牆後的人影"), false);
        assert.equal(serialized.includes("門後的人影"), false);
        assert.equal(serialized.includes(visibleTarget), false);
        assert.equal(serialized.includes(occludedTarget), false);
        assert.equal(serialized.includes(doorTarget), false);
        assert.equal(serialized.includes(hiddenObject), false);
        return { action_id: "keep-observing" };
      },
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.event_queue = [];
        return {
          causal_resolution_id: "phase62w-noop-resolution",
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
  assert.equal(
    history.turns[0].visibility_queries[0].version,
    worldSimulationVisibilityQueryVersion,
  );
  assert.equal(
    history.turns[0].visibility_queries[0].audit.deterministic_replay_verified,
    true,
  );
  assert.equal(
    history.turns[0].visibility_queries[0].result.occluded_entities
      .some((item) => item.entity_id === occludedTarget),
    true,
  );

  console.log(JSON.stringify({
    visibility_query_version: worldSimulationVisibilityQueryVersion,
    persisted_history_turns: history.turns.length,
    visible_entity_count: direct.result.visible_entities.length,
    occluded_entity_count: direct.result.occluded_entities.length,
    visible_object_count: direct.result.visible_objects.length,
    closed_door_blocks_vision: direct.result.occluded_entities.some(
      (item) => item.entity_id === doorTarget && item.occluder?.blocker_id === "closed-visual-door",
    ),
    opening_door_restores_visibility: openDoor.result.visible_entities.includes(doorTarget),
    structured_hidden_visuals_filtered: direct.result.filtered_declared_visual_count === 2,
    engine_target_ids_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_visibility: false,
    lighting_threshold_modeled: false,
    sound_propagation_modeled: false,
  }));
  console.log("Phase62W programmatic visibility/occlusion test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
