import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { projectWorldSimulationCommunicationAcousticBridge } from "../../server/src/world-simulation-communication-acoustic-bridge-service.mjs";
import { queryWorldSimulationObserverAudibility } from "../../server/src/world-simulation-audibility-query-service.mjs";
import { projectCharacterCommunicationListenerReception } from "../../server/src/character-communication-listener-reception-service.mjs";
import { buildCharacterCommunicationListenerUnderstandingResolverView } from "../../server/src/character-communication-listener-understanding-service.mjs";

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
    world_simulation_session_id: "cc8i", turn_id: "speak",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event: state.event_queue[0],
    selected_action_intents: [{ character: "A",
      selection: "candidate_action_intent", candidate: action }],
  });
  return { result, outcome: result.action_outcomes.find((item) =>
    item.action_id === action.action_id) };
}

{
  const action = candidate();
  assert.deepEqual(action.communication.vocal_effort_request, {
    schema_version: "cc8i-vocal-effort-request-v1", level: "projected" });
  const { result, outcome } = await adjudicate(world(), action);
  assert.equal(outcome.result, "communication_emitted");
  assert.deepEqual(outcome.communication_event.vocal_effort_realization, {
    schema_version: "cc8i-vocal-effort-realization-v1",
    level: "projected", sound_level_db_at_1m: 72,
    source_action_id: action.action_id,
  });
  const bridge = projectWorldSimulationCommunicationAcousticBridge({
    world_state: result.next_world_state, scene_id: "room", turn_id: "speak",
    action_outcomes: [outcome],
  });
  const sound = bridge.next_sound_events.find((item) =>
    item.communication_action_id === action.action_id);
  assert.equal(sound.sound_level_db_at_1m, 72);
  assert.equal(sound.vocal_effort_cue, "projected_voice");
  const post = { ...result.next_world_state, sound_events: bridge.next_sound_events };
  const hearing = queryWorldSimulationObserverAudibility({
    world_state: post, scene_state: post.scenes.room, scene_id: "room", observer: "B",
  }).result;
  assert.equal(hearing.audible_sound_count, 1);
  assert.equal(hearing.perception_auditory_observations[0].vocal_effort_cue,
    "projected_voice");
  const reception = projectCharacterCommunicationListenerReception({
    observer: "B", sound_id: sound.sound_id, scene_id: "room",
    scene_state: post.scenes.room, world_state: post, committed_outcome: outcome,
  });
  assert.equal(reception.admission_status, "heard_sound_only");
  assert.equal(reception.character_view.vocal_effort_cue, "projected_voice");
  assert.equal(reception.character_view.speech_content_intelligible, false);
  const resolver = buildCharacterCommunicationListenerUnderstandingResolverView({
    observer: "B", world_state: post, scene_state: post.scenes.room,
    scene_id: "room",
    world_history: { turns: [{ turn_id: "speak", action_outcomes: [outcome] }] },
    audibility_result: hearing,
  });
  assert.equal(resolver.resolver_view.speech_candidates.length, 1);
  assert.equal(resolver.resolver_view.speech_candidates[0]
    .acoustic_observation.vocal_effort_cue, "projected_voice");
  assert.equal(JSON.stringify(resolver.resolver_view).includes(action.action_id), false);
  assert.equal(JSON.stringify(resolver.resolver_view).includes(sound.sound_id), false);
  const observed = JSON.stringify(hearing.perception_auditory_observations);
  assert.equal(observed.includes(semantic), false);
  assert.equal(observed.includes(action.action_id), false);
  assert.equal(observed.includes(sound.sound_id), false);
}
{
  const action = candidate("soft");
  const { outcome } = await adjudicate(world(), action);
  assert.equal(outcome.communication_event.vocal_effort_realization.sound_level_db_at_1m, 48);
}
{
  const action = candidate("projected");
  const { outcome } = await adjudicate(world({ sound_level_db_at_1m: 60 }), action);
  assert.equal(outcome.result, "blocked");
  assert.match(outcome.causal_evidence, /vocal effort/);
}
{
  const action = candidate(null);
  const { outcome } = await adjudicate(world(), action);
  assert.equal(outcome.result, "communication_emitted");
  assert.equal(Object.hasOwn(outcome.communication_event, "vocal_effort_realization"), false);
}
{
  const action = candidate(null);
  action.communication.vocal_effort_request = {
    schema_version: "cc8i-vocal-effort-request-v1", level: "projected" };
  const { outcome } = await adjudicate(world(), action);
  assert.equal(outcome.result, "blocked");
}
assert.throws(() => candidate("unbounded"), /Vocal effort/);
console.log("CC-8I bounded vocal effort tests passed.");
