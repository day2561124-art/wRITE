import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationAudibilityQueryContract,
  queryWorldSimulationObserverAudibility,
  worldSimulationAudibilityQueryVersion,
} from "../../server/src/world-simulation-audibility-query-service.mjs";
import {
  buildWorldSimulationLoopContract,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62z-audibility-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "observer-hearing-engine-id";
const rearSpeaker = "rear-speaker-engine-id";
const nearSound = "near-metal-sound-engine-id";
const farSound = "far-bell-sound-engine-id";
const doorSound = "door-side-sound-engine-id";
const hardBlockedSound = "hard-blocked-sound-engine-id";
const weakSound = "weak-sound-engine-id";
const rearSound = "rear-step-sound-engine-id";
const sceneId = "phase62z-audibility-lab";

const sceneState = {
  scene_id: sceneId,
  dimensions: { width_m: 32, depth_m: 16 },
  entity_positions: {
    [observer]: { x: 0, y: 0 },
    [rearSpeaker]: { x: -3, y: 0 },
  },
  visibility_profiles: {
    [observer]: { facing_degrees: 0, horizontal_fov_degrees: 120, eye_height_m: 1.6 },
    [rearSpeaker]: { height_m: 1.8 },
  },
  audibility_profiles: {
    [observer]: {
      minimum_audible_db: 35,
      localization_min_margin_db: 8,
      localization_sectors: 4,
    },
  },
  sound_events: [
    {
      id: nearSound,
      position: { x: 2, y: 0 },
      sound_level_db_at_1m: 60,
    },
    {
      id: farSound,
      position: { x: 10, y: 0 },
      sound_level_db_at_1m: 60,
    },
    {
      id: doorSound,
      position: { x: 6, y: 2 },
      sound_level_db_at_1m: 60,
    },
    {
      id: hardBlockedSound,
      position: { x: 4, y: -2 },
      sound_level_db_at_1m: 70,
    },
    {
      id: weakSound,
      position: { x: 20, y: 0 },
      sound_level_db_at_1m: 60,
    },
    {
      id: rearSound,
      source_entity_id: rearSpeaker,
      sound_level_db_at_1m: 60,
      speaker_identity: "engine-only-known-speaker",
    },
  ],
  auditory_labels_by: {
    [observer]: {
      [nearSound]: "前方傳來清楚的金屬敲擊聲",
      [farSound]: "遠處傳來一聲鈴響",
      [doorSound]: "門另一側傳來短促碰撞聲",
      [hardBlockedSound]: "隔音屏後傳來不該聽見的聲音",
      [weakSound]: "極遠處的微弱聲音",
      [rearSound]: "身後傳來一聲短促腳步聲",
    },
  },
  sound_blockers: [
    {
      id: "hard-acoustic-screen",
      x_min: 1.8,
      x_max: 2.2,
      y_min: -1.3,
      y_max: -0.7,
      blocks_sound: true,
    },
  ],
  obstacles: [
    {
      id: "visual-only-obstacle",
      x_min: 0.8,
      x_max: 1.2,
      y_min: -0.2,
      y_max: 0.2,
    },
  ],
  doors: {
    "acoustic-door": {
      open: false,
      x_min: 2.8,
      x_max: 3.2,
      y_min: 0.7,
      y_max: 1.3,
      sound_attenuation_db: 25,
    },
  },
  public_audio: ["RAW_PUBLIC_AUDIO_SHOULD_BE_BYPASSED_WHEN_PROGRAMMATIC_AUDIBILITY_IS_ACTIVE"],
  observable_by: {
    [observer]: {
      audible: ["RAW_SCOPED_AUDIO_SHOULD_BE_BYPASSED_WHEN_PROGRAMMATIC_AUDIBILITY_IS_ACTIVE"],
    },
  },
};

const worldState = {
  simulation_time: "2026-08-24T18:40:00+08:00",
  world_rules: { default_vision_range_m: 40 },
  event_queue: [{
    event_id: "evt-audibility-propagation",
    type: "listen_in_acoustic_lab",
    scene_id: sceneId,
    participants: [observer],
  }],
  scenes: { [sceneId]: sceneState },
  characters: {
    [observer]: { current_action: "保持安靜並聆聽周遭聲音", vision_range_m: 40 },
    [rearSpeaker]: {},
  },
  memories: { [observer]: [] },
  objects: {},
  available_actions: {
    [observer]: [{ action_id: "keep-listening", intent: "保持位置並繼續聆聽" }],
  },
};

try {
  const contract = buildWorldSimulationAudibilityQueryContract();
  assert.equal(contract.version, worldSimulationAudibilityQueryVersion);
  assert.equal(contract.explicit_hearing_threshold_db_required, true);
  assert.equal(contract.hidden_human_hearing_default_allowed, false);
  assert.equal(contract.free_field_distance_attenuation_supported, true);
  assert.equal(contract.sound_blocker_attenuation_supported, true);
  assert.equal(contract.closed_door_acoustic_attenuation_supported, true);
  assert.equal(contract.unconfigured_visual_geometry_does_not_imply_sound_blocking, true);
  assert.equal(contract.brain_receives_engine_sound_ids, false);
  assert.equal(contract.source_identity_inference_from_engine_id_allowed, false);
  assert.equal(contract.cross_scene_room_graph_propagation_modeled, false);
  assert.equal(contract.speech_content_intelligibility_modeled, false);

  const loopContract = buildWorldSimulationLoopContract();
  assert.equal(loopContract.character_perception_audio_uses_programmatic_audibility, true);
  assert.equal(loopContract.audibility_and_sound_propagation.version, worldSimulationAudibilityQueryVersion);

  const worldHashBefore = hashAgentRunValue(worldState);
  const sceneHashBefore = hashAgentRunValue(sceneState);
  const direct = queryWorldSimulationObserverAudibility({
    world_state: worldState,
    scene_state: sceneState,
    scene_id: sceneId,
    observer,
  });
  assert.equal(direct.result.status, "audibility_resolved");
  assert.equal(direct.result.audibility_enforced, true);
  assert.deepEqual(direct.result.observer_hearing_profile, {
    minimum_audible_db: 35,
    localization_min_margin_db: 8,
    localization_sectors: 4,
  });
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.equal(direct.audit.character_brain_decides_audibility, false);
  assert.equal(hashAgentRunValue(worldState), worldHashBefore);
  assert.equal(hashAgentRunValue(sceneState), sceneHashBefore);

  const near = direct.result.audible_sounds.find((item) => item.sound_id === nearSound);
  const far = direct.result.audible_sounds.find((item) => item.sound_id === farSound);
  const doorBlocked = direct.result.inaudible_sounds.find((item) => item.sound_id === doorSound);
  const hardBlocked = direct.result.inaudible_sounds.find((item) => item.sound_id === hardBlockedSound);
  const weak = direct.result.inaudible_sounds.find((item) => item.sound_id === weakSound);
  const rear = direct.result.audible_sounds.find((item) => item.sound_id === rearSound);
  assert.ok(near);
  assert.ok(far);
  assert.ok(doorBlocked);
  assert.ok(hardBlocked);
  assert.ok(weak);
  assert.ok(rear);
  assert.equal(near.received_level_db > far.received_level_db, true);
  assert.equal(near.blocker_hits.some((item) => item.blocker_id === "visual-only-obstacle"), false);
  assert.equal(doorBlocked.reason, "below_hearing_threshold");
  assert.equal(doorBlocked.blocker_hits.some((item) => item.blocker_id === "acoustic-door" && item.attenuation_db === 25), true);
  assert.equal(hardBlocked.reason, "sound_fully_blocked");
  assert.equal(hardBlocked.hard_blocked, true);
  assert.equal(weak.reason, "below_hearing_threshold");
  assert.equal(rear.relative_direction_sector, "behind");

  const auditoryText = JSON.stringify(direct.result.perception_auditory_observations);
  assert.equal(auditoryText.includes("前方傳來清楚的金屬敲擊聲"), true);
  assert.equal(auditoryText.includes("遠處傳來一聲鈴響"), true);
  assert.equal(auditoryText.includes("身後傳來一聲短促腳步聲"), true);
  assert.equal(auditoryText.includes("門另一側傳來短促碰撞聲"), false);
  assert.equal(auditoryText.includes("隔音屏後傳來不該聽見的聲音"), false);
  assert.equal(auditoryText.includes("極遠處的微弱聲音"), false);
  for (const engineId of [nearSound, farSound, doorSound, hardBlockedSound, weakSound, rearSound, rearSpeaker]) {
    assert.equal(auditoryText.includes(engineId), false);
  }
  assert.equal(auditoryText.includes("engine-only-known-speaker"), false);
  assert.equal(auditoryText.includes("received_level_db"), false);
  assert.equal(auditoryText.includes("source_position"), false);

  const openDoorScene = structuredClone(sceneState);
  openDoorScene.doors["acoustic-door"].open = true;
  const openDoor = queryWorldSimulationObserverAudibility({
    world_state: { ...worldState, scenes: { [sceneId]: openDoorScene } },
    scene_state: openDoorScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(openDoor.result.audible_sounds.some((item) => item.sound_id === doorSound), true);

  const legacyScene = structuredClone(sceneState);
  delete legacyScene.audibility_profiles[observer];
  const legacy = queryWorldSimulationObserverAudibility({
    world_state: { ...worldState, scenes: { [sceneId]: legacyScene } },
    scene_state: legacyScene,
    scene_id: sceneId,
    observer,
  });
  assert.equal(legacy.result.audibility_enforced, false);
  assert.equal(legacy.result.perception_auditory_observations.length, 0);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62Z audibility propagation fixture",
    seed: "phase62z",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-audibility-propagation",
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        const serialized = JSON.stringify(packet);
        assert.equal(packet.boundaries.programmatic_audibility_enforced, true);
        assert.equal(packet.boundaries.engine_sound_source_ids_exposed, false);
        assert.equal(packet.perception.information_boundary.programmatic_audibility_enforced, true);
        assert.equal(packet.perception.information_boundary.raw_scene_audio_sources_bypassed_when_audibility_enforced, true);
        assert.equal(serialized.includes("前方傳來清楚的金屬敲擊聲"), true);
        assert.equal(serialized.includes("遠處傳來一聲鈴響"), true);
        assert.equal(serialized.includes("身後傳來一聲短促腳步聲"), true);
        assert.equal(serialized.includes("relative_direction_sector\":\"behind"), true);
        assert.equal(serialized.includes("RAW_PUBLIC_AUDIO_SHOULD_BE_BYPASSED"), false);
        assert.equal(serialized.includes("RAW_SCOPED_AUDIO_SHOULD_BE_BYPASSED"), false);
        assert.equal(serialized.includes("engine-only-known-speaker"), false);
        for (const engineId of [nearSound, farSound, doorSound, hardBlockedSound, weakSound, rearSound, rearSpeaker]) {
          assert.equal(serialized.includes(engineId), false);
        }
        return { action_id: "keep-listening" };
      },
      causalAdjudicator: async (input) => {
        const next = structuredClone(input.world_state);
        next.event_queue = [];
        return {
          causal_resolution_id: "phase62z-noop-resolution",
          next_world_state: next,
          state_transitions: [],
          action_outcomes: [{ actor: observer, action_id: "keep-listening", result: "continued_listening", causal_evidence: "no world mutation requested" }],
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
  assert.equal(history.turns[0].audibility_queries.length, 1);
  assert.equal(history.turns[0].audibility_queries[0].version, worldSimulationAudibilityQueryVersion);
  assert.equal(history.turns[0].audibility_queries[0].result.audible_sounds.some((item) => item.sound_id === rearSound), true);

  console.log(JSON.stringify({
    audibility_query_version: worldSimulationAudibilityQueryVersion,
    persisted_history_turns: history.turns.length,
    audibility_enforced: direct.result.audibility_enforced,
    audible_sound_count: direct.result.audible_sound_count,
    distance_attenuation_reduces_received_level: near.received_level_db > far.received_level_db,
    unconfigured_visual_geometry_does_not_block_sound: near.blocker_hits.some((item) => item.blocker_id === "visual-only-obstacle") === false,
    closed_door_attenuates_below_threshold: doorBlocked.reason === "below_hearing_threshold",
    opening_door_restores_audibility: openDoor.result.audible_sounds.some((item) => item.sound_id === doorSound),
    hard_sound_blocker_suppresses_signal: hardBlocked.reason === "sound_fully_blocked",
    weak_sound_below_threshold_filtered: weak.reason === "below_hearing_threshold",
    coarse_rear_direction_localized: rear.relative_direction_sector === "behind",
    missing_threshold_preserves_legacy_audio_mode: legacy.result.audibility_enforced === false,
    raw_scene_audio_bypassed_when_enforced: true,
    source_identity_inferred_from_engine_id: false,
    engine_sound_source_ids_exposed_to_character_brain: false,
    exact_source_coordinates_exposed_to_character_brain: false,
    exact_received_db_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_audibility: false,
    cross_scene_room_graph_propagation_modeled: false,
    speech_content_intelligibility_modeled: false,
  }));
  console.log("Phase62Z programmatic audibility/sound propagation test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
