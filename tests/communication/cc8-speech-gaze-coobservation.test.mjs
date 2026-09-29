import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { readCommittedWorldSimulationObserverGaze } from "../../server/src/world-simulation-communication-gaze-observer-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8h-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const semantic = "男孩離開房子";
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8H speech and gaze co-observation",
    seed: "cc8h",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: {
      simulation_time: "2026-09-29T00:00:00.000Z",
      world_rules: { communication_action_seconds: 0.3 },
      event_queue: [
        { event_id: "speak", type: "interaction", scene_id: "room",
          participants: ["A", "B"] },
        { event_id: "observe", type: "interaction", scene_id: "room",
          participants: ["B"] },
      ],
      scenes: { room: {
        scene_id: "room", dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: { A: { x: 1, y: 1 }, B: { x: 1, y: 4 } },
        entity_visual_detail_profiles: {
          A: { head_orientation_discernible: true,
            head_orientation_max_distance_m: 5 },
        },
        audibility_profiles: { B: { minimum_audible_db: 35 } },
      } },
      characters: {
        A: {
          facing_degrees: 0, physical_state: {},
          known: [semantic],
          current_goal: "告知 B",
          speech_acoustics: { sound_level_db_at_1m: 65 },
          communication_goal: {
            character: "A", addressee: "B", purpose: "告知",
            mode: "direct", public_content: semantic,
            claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: semantic,
              clause: { subject: "男孩", predicate: "離開",
                aspect_particle: "了", object: "房子" },
            },
            communication_context: { intentional_display: {
              intended_meaning: "希望 B 留意",
              modality: "gaze", target: "B",
            } },
          },
        },
        B: { facing_degrees: 270, physical_state: {},
          known: [], current_goal: "留意周遭" },
      },
      objects: {}, memories: { A: [], B: [] },
      available_actions: { A: [], B: [] },
    },
  }, options);
  const id = session.world_simulation_session_id;
  const characterRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc8h_test_identity",
      formal: true,
    }),
  });
  let actionId = null;
  const first = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "speak",
  }, {
    ...options, characterRuntimeManager,
    characterBrain: async (packet) => {
      if (packet.character !== "A") return "reject_all";
      const candidate = packet.candidate_action_intents.find((item) =>
        item.communication?.surface_realization_complete === true
          && item.communication?.embodied_display_request?.modality === "gaze");
      assert(candidate);
      actionId = candidate.action_id;
      return { action_id: actionId };
    },
  });
  assert.equal(first.committed, true);
  assert(actionId);
  const history = await getWorldSimulationHistory(id, options);
  const outcome = history.turns[0].action_outcomes.find((item) =>
    item.actor === "A" && item.result === "communication_emitted");
  assert(outcome);
  assert.equal(outcome.communication_event.channel, "speech");
  assert.equal(outcome.communication_event.embodied_display.realized, true);
  assert.equal(outcome.communication_acoustic_signal.registered, true);
  const post = await getWorldSimulationState(id, options);
  const soundId = outcome.communication_acoustic_signal.sound_id;
  assert(post.state.sound_events.some((sound) => sound.sound_id === soundId));
  const gaze = await readCommittedWorldSimulationObserverGaze({
    session_id: id, observer: "B", scene_id: "room", expected_revision: 1,
    expected_state_hash: post.state_hash,
  }, options);
  assert.equal(gaze.character_view.length, 1);
  const visualText = JSON.stringify(gaze.character_view);
  for (const hidden of [semantic, "希望 B 留意", actionId, soundId])
    assert.equal(visualText.includes(hidden), false, hidden);
  let observerInput = null;
  const second = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "observe",
  }, {
    ...options, characterRuntimeManager,
    characterBrain: async (packet) => {
      assert.equal(packet.character, "B");
      observerInput = structuredClone(packet);
      return "reject_all";
    },
  });
  assert.equal(second.committed, true);
  assert(observerInput);
  assert.equal(observerInput.observed_gaze_cues.length, 1);
  assert.equal(Object.hasOwn(observerInput.cognition.perception,
    "observed_gaze_cues"), false);
  const serialized = JSON.stringify(observerInput);
  assert.equal(serialized.includes("unidentified_speech_sound"), true);
  for (const hidden of [semantic, "希望 B 留意", actionId, soundId])
    assert.equal(serialized.includes(hidden), false, hidden);
  assert.equal(observerInput.perception.information_boundary
    .programmatic_audibility_enforced, true);
  const after = await getWorldSimulationState(id, options);
  assert.equal((after.state.sound_events ?? []).some((sound) =>
    sound.sound_id === soundId), false);
  console.log("CC-8H native speech and gaze co-observation tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
