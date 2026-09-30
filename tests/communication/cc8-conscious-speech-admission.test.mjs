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
    world_simulation_session_id: "cc8u", turn_id: "speak",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event: state.event_queue[0],
    selected_action_intents: [{ character: "A",
      selection: "candidate_action_intent", candidate: action }],
  });
  return { result, outcome: result.action_outcomes.find((item) =>
    item.action_id === action.action_id) };
}

const ambient = { sound_id: "room-clock", type: "clock_tick", scene_id: "room",
  source_position: { x: 4, y: 4 }, sound_level_db_at_1m: 45 };
for (const physical of [{}, { unconscious: true }, { incapacitated: true },
  { immobilized: true }]) {
  for (const effort of [null, "soft", "projected"]) {
    const state = world();
    state.characters.A.physical_state = physical;
    state.sound_events = [ambient];
    const action = candidate(effort);
    const original = hashAgentRunValue({ state, action });
    const { result, outcome } = await adjudicate(state, action);
    const blocked = physical.unconscious === true || physical.incapacitated === true;
    const label = JSON.stringify({ physical, effort });
    assert.equal(outcome.result, blocked ? "blocked" : "communication_emitted", label);
    assert.equal(hashAgentRunValue({ state, action }), original, "inputs remain immutable");
    assert.deepEqual(result.next_world_state.characters.A.physical_state, physical);
    const committedSounds = result.next_world_state.sound_events ?? [];
    assert.deepEqual(committedSounds.find(item => item.sound_id === ambient.sound_id), ambient);
    const signals = committedSounds.filter(item =>
      item.communication_action_id === action.action_id);
    assert.equal(signals.length, blocked ? 0 : 1, label);
    const bridge = projectWorldSimulationCommunicationAcousticBridge({
      world_state: result.next_world_state, scene_id: "room", turn_id: "speak",
      action_outcomes: [outcome],
    });
    const bridgeSounds = bridge.next_sound_events ?? committedSounds;
    assert.equal(bridgeSounds.filter(item =>
      item.communication_action_id === action.action_id).length, blocked ? 0 : 1, label);
    if (blocked) {
      assert.match(outcome.causal_evidence, /conscious actor/);
      assert.equal(Object.hasOwn(outcome, "communication_event"), false);
      assert.equal(Object.hasOwn(outcome, "communication_speech_stream"), false);
      assert.equal(result.communication_observer_increment_admissions.length, 0);
    } else {
      assert.equal(outcome.communication_event.surface_realization_complete, true);
      assert.equal(signals[0].sound_level_db_at_1m,
        effort === "soft" ? 48 : effort === "projected" ? 72 : 60);
      const hearing = queryWorldSimulationObserverAudibility({
        world_state: result.next_world_state, scene_state: result.next_world_state.scenes.room,
        scene_id: "room", observer: "B",
      }).result;
      assert.ok(hearing.audible_sound_count >= 1, label);
    }
  }
}
// Invalid voice requests must fail actor admission before overlapping voice
// claims can turn the physical failure into a resource-contention outcome.
for (const physical of [{ unconscious: true }, { incapacitated: true }]) {
  for (const reverse of [false, true]) {
    const state = world();
    state.characters.A.physical_state = physical;
    const actions = [candidate(null), candidate("soft")];
    if (reverse) actions.reverse();
    const result = await adjudicateWorldSimulationCausality({
      world_simulation_session_id: "cc8u", turn_id: "speak",
      world_state: state, world_state_hash: hashAgentRunValue(state),
      world_state_revision: 0, event: state.event_queue[0],
      selected_action_intents: actions.map(action => ({
        character: "A", selection: "candidate_action_intent", candidate: action,
      })),
    });
    assert.equal(result.action_outcomes.length, 2);
    for (const outcome of result.action_outcomes) {
      assert.equal(outcome.result, "blocked");
      assert.match(outcome.causal_evidence, /conscious actor/);
    }
    assert.equal((result.next_world_state.sound_events ?? []).length, 0);
  }
}
// Missing capacity does not invent a voice profile or change legacy semantic
// admission; this guard consumes only existing physical state.
{
  const state = world({});
  const action = candidate(null);
  const { result, outcome } = await adjudicate(state, action);
  assert.equal(outcome.result, "communication_emitted");
  assert.equal((result.next_world_state.sound_events ?? []).length, 0);
}
// CC-8W: speech must originate from an existing World character record.
for (const missing of [true, false]) {
  for (const record of missing ? [undefined] : [null, false, 0, "actor", []]) {
    for (const effort of [null, "soft", "projected"]) {
      const state = world();
      if (missing) delete state.characters.A;
      else state.characters.A = record;
      state.sound_events = [ambient];
      const action = candidate(effort);
      const original = hashAgentRunValue({ state, action });
      const { result, outcome } = await adjudicate(state, action);
      assert.equal(outcome.result, "blocked", "CC-8W absent or invalid actor");
      assert.match(outcome.causal_evidence, /existing actor/);
      assert.equal(Object.hasOwn(outcome, "communication_event"), false);
      assert.equal(Object.hasOwn(outcome, "communication_speech_stream"), false);
      assert.equal(result.communication_observer_increment_admissions.length, 0);
      assert.deepEqual(result.next_world_state.characters, state.characters);
      assert.deepEqual(result.next_world_state.sound_events, [ambient]);
      assert.equal(hashAgentRunValue({ state, action }), original);
    }
  }
}
for (const reverse of [false, true]) {
  const state = world();
  delete state.characters.A;
  const actions = [candidate(null), candidate("soft")];
  if (reverse) actions.reverse();
  const result = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: "cc8w", turn_id: "speak",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event: state.event_queue[0],
    selected_action_intents: actions.map(action => ({
      character: "A", selection: "candidate_action_intent", candidate: action,
    })),
  });
  assert.equal(result.action_outcomes.length, 2);
  for (const outcome of result.action_outcomes) {
    assert.equal(outcome.result, "blocked");
    assert.match(outcome.causal_evidence, /existing actor/);
  }
  assert.equal((result.next_world_state.sound_events ?? []).length, 0);
}
// CC-8X: noncanonical channels cannot bypass physical admission.
for (const channel of [" speech ", "\tspeech\n", ["speech"], [" speech "]]) {
  for (const physical of [{}, { unconscious: true }, { incapacitated: true },
    { immobilized: true }, null, "absent"]) {
    const state = world();
    if (physical === "absent") delete state.characters.A;
    else if (physical === null) state.characters.A = null;
    else state.characters.A.physical_state = physical;
    state.sound_events = [ambient];
    const action = candidate(null);
    action.communication.channel = channel;
    const original = hashAgentRunValue({ state, action });
    const { result, outcome } = await adjudicate(state, action);
    assert.equal(outcome.result, "blocked", "CC-8X noncanonical channel");
    assert.match(outcome.causal_evidence, /canonical communication channel/);
    assert.equal(Object.hasOwn(outcome, "communication_event"), false);
    assert.equal(Object.hasOwn(outcome, "communication_speech_stream"), false);
    assert.equal(result.communication_observer_increment_admissions.length, 0);
    assert.deepEqual(result.next_world_state.characters, state.characters);
    assert.deepEqual(result.next_world_state.sound_events, [ambient]);
    assert.equal(hashAgentRunValue({ state, action }), original);
  }
  for (const effort of [null, "soft", "projected"]) {
    const state = world();
    const action = candidate(effort);
    action.communication.channel = channel;
    action.communication.surface_realization_complete = false;
    action.communication.surface_realization = null;
    const { result, outcome } = await adjudicate(state, action);
    assert.equal(outcome.result, "blocked");
    assert.match(outcome.causal_evidence, /canonical communication channel/);
    assert.equal(Object.hasOwn(outcome, "communication_event"), false);
    assert.equal(Object.hasOwn(outcome, "communication_speech_stream"), false);
    assert.equal(result.communication_observer_increment_admissions.length, 0);
  }
  for (const reverse of [false, true]) {
    const state = world();
    const invalid = candidate(null);
    invalid.communication.channel = channel;
    const valid = candidate("soft");
    const actions = reverse ? [valid, invalid] : [invalid, valid];
    const result = await adjudicateWorldSimulationCausality({
      world_simulation_session_id: "cc8x", turn_id: "speak",
      world_state: state, world_state_hash: hashAgentRunValue(state),
      world_state_revision: 0, event: state.event_queue[0],
      selected_action_intents: actions.map(action => ({
        character: "A", selection: "candidate_action_intent", candidate: action,
      })),
    });
    const blocked = result.action_outcomes.find(item => item.action_id === invalid.action_id);
    const emitted = result.action_outcomes.find(item => item.action_id === valid.action_id);
    assert.equal(blocked.result, "blocked");
    assert.match(blocked.causal_evidence, /canonical communication channel/);
    assert.equal(emitted.result, "communication_emitted");
    assert.equal(result.next_world_state.sound_events.filter(item =>
      item.communication_action_id === valid.action_id).length, 1);
    assert.equal(result.next_world_state.sound_events.filter(item =>
      item.communication_action_id === invalid.action_id).length, 0);
  }
}
console.log("CC-8U/8W/8X canonical conscious existing actor speech admission tests passed.");
