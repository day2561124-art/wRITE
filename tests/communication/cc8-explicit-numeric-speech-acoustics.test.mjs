import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { projectWorldSimulationCommunicationAcousticBridge } from "../../server/src/world-simulation-communication-acoustic-bridge-service.mjs";
import { queryWorldSimulationObserverAudibility } from "../../server/src/world-simulation-audibility-query-service.mjs";

const semantic = "男孩離開房子";
function candidate(effort = "projected") {
  return buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: { known: [semantic], communication_goal: {
      character: "A", addressee: "B", purpose: "告知", mode: "direct",
      public_content: semantic, claim_kind: "sincere_assertion",
      ...(effort ? { vocal_effort: effort } : {}),
      surface_realization: {
        schema_version: "cc5-mandarin-clause-request-v1",
        semantic_anchor: semantic,
        clause: { subject: "男孩", predicate: "離開", aspect_particle: "了", object: "房子" },
      },
    } },
  });
}
function world(profile = { sound_level_db_at_1m: 60, projected_sound_level_db_at_1m: 72,
  soft_sound_level_db_at_1m: 48 }) {
  return {
    simulation_time: "2026-09-29T00:00:00.000Z",
    world_rules: { communication_action_seconds: 0.3 },
    event_queue: [{ event_id: "speak", type: "interaction", scene_id: "room",
      participants: ["A", "B"] }],
    scenes: { room: { scene_id: "room",
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: { A: { x: 1, y: 1 }, B: { x: 1, y: 4 } },
      audibility_profiles: { B: { minimum_audible_db: 35 } },
    } },
    characters: { A: { physical_state: {}, speech_acoustics: profile },
      B: { physical_state: {} } }, objects: {},
  };
}
async function adjudicate(state, action) {
  const result = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: "cc8v", turn_id: "speak",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event: state.event_queue[0],
    selected_action_intents: [{ character: "A",
      selection: "candidate_action_intent", candidate: action }],
  });
  return { result, outcome: result.action_outcomes.find((item) =>
    item.action_id === action.action_id) };
}

const cases = [
  { name: "zero", profile: { sound_level_db_at_1m: 0 }, valid: true },
  { name: "finite", profile: { sound_level_db_at_1m: 60 }, valid: true },
  { name: "fractional", profile: { sound_level_db_at_1m: 60.5 }, valid: true },
  { name: "missing", profile: {}, valid: false },
  ...[null, false, true, "", " ", "60", [], [60], {}, -1].map(value => ({
    name: JSON.stringify(value), profile: { sound_level_db_at_1m: value }, valid: false,
  })),
];
const ambient = { sound_id: "ambient-clock", scene_id: "room",
  position: { x: 7, y: 7 }, sound_level_db_at_1m: 0 };
const old = { schema_version: "cc6b-communication-acoustic-bridge-v1",
  kind: "communication_speech_signal", sound_id: "old-speech", scene_id: "room",
  source_entity_id: "A", communication_action_id: "old-action",
  sound_level_db_at_1m: 60, active: true };
for (const entry of cases) {
  const state = world(entry.profile);
  state.scenes.room.entity_positions.B = { x: 1, y: 2 };
  state.scenes.room.audibility_profiles.B.minimum_audible_db = 0;
  state.sound_events = [ambient, old];
  const action = candidate(null);
  const original = hashAgentRunValue({ state, action });
  const { result, outcome } = await adjudicate(state, action);
  assert.equal(outcome.result, "communication_emitted", "legacy semantic admission");
  assert.equal(hashAgentRunValue({ state, action }), original, "immutable inputs");
  const sounds = result.next_world_state.sound_events ?? [];
  const signals = sounds.filter(item => item.communication_action_id === action.action_id);
  assert.equal(signals.length, entry.valid ? 1 : 0, entry.name);
  assert.deepEqual(sounds.find(item => item.sound_id === ambient.sound_id), ambient);
  assert.equal(sounds.some(item => item.sound_id === old.sound_id), false);
  const bridge = projectWorldSimulationCommunicationAcousticBridge({
    world_state: state, scene_id: "room", turn_id: "speak", action_outcomes: [outcome],
  });
  assert.deepEqual(bridge.next_sound_events, sounds, entry.name);
  assert.deepEqual(bridge.expired_sound_ids, [old.sound_id]);
  assert.equal(bridge.registrations.length, entry.valid ? 1 : 0, entry.name);
  const hearing = queryWorldSimulationObserverAudibility({
    world_state: result.next_world_state, scene_state: result.next_world_state.scenes.room,
    scene_id: "room", observer: "B",
  }).result;
  assert.equal(hearing.audible_sound_count, entry.valid ? 1 : 0, entry.name);
  if (entry.valid) {
    assert.equal(signals[0].sound_level_db_at_1m, entry.profile.sound_level_db_at_1m);
    assert.equal(signals[0].surface_text_exposed, false);
    assert.equal(signals[0].semantic_content_exposed, false);
    const observed = JSON.stringify(hearing.perception_auditory_observations);
    assert.equal(observed.includes(semantic), false);
    assert.equal(observed.includes(action.action_id), false);
    assert.equal(observed.includes(signals[0].sound_id), false);
  } else {
    assert.equal(bridge.skipped[0].status, "explicit_speech_acoustics_unavailable");
    assert.equal(result.communication_observer_increment_admissions.length, 0);
  }
}
// The projector also rejects non-JSON numeric values without coercion.
for (const value of [NaN, Infinity, -Infinity]) {
  const state = world();
  const action = candidate(null);
  const { outcome } = await adjudicate(state, action);
  state.characters.A.speech_acoustics.sound_level_db_at_1m = value;
  const bridge = projectWorldSimulationCommunicationAcousticBridge({
    world_state: state, scene_id: "room", turn_id: "speak", action_outcomes: [outcome],
  });
  assert.equal(bridge.registrations.length, 0);
  assert.equal(bridge.skipped[0].status, "explicit_speech_acoustics_unavailable");
}
console.log("CC-8V explicit numeric speech acoustic source tests passed.");
