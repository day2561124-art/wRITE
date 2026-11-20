import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { panelReadingContents } from "../../server/src/observer-dialogue-panel-memory-service.mjs";

import { resolvePendingPanelRecheck, schedulePanelRechecks } from "../../server/src/observer-dialogue-panel-recheck-service.mjs";

const actor = "值班員", speaker = "來訪者";
const room = "器材室";
const referent = "learned_" + "2".repeat(24);
const descriptor = {anchor: "架上", color: "白色", kind: "計時器"};
const canonicalObject = "hidden_panel_native_id";
const oldTime = "2026-11-20T02:25:00.000Z", startTime = "2026-11-20T02:30:00.000Z";
const question = "架上那台白色計時器能倒數多久？", verify = "現在還是一樣嗎？";
const nowSpeech = "我剛看了面板，現在的上限是42分鐘。", fallback = "我現在還不能確認。";
const quoted = "我上次看面板時，上限是50分鐘。";
const oldIdentity = hashAgentRunValue({kind: "countdown_limit_panel", object_id: canonicalObject});
const entry = {
  memory_id: "memory_" + "3".repeat(24), memory_type: "episodic_direct_perception", accessible: true,
  encoded_at: oldTime, source: {kind: "direct_perception", sense: "visual"}, subjective_memory_not_world_truth: true,
  content: {referent_id: referent, referent_description: descriptor, topic: "learned_dialogue", detail_type: "runtime",
    statement_kind: "observed_panel_readout", panel_reading: {observed_at: oldTime, max_countdown_seconds: 3000},
    lesson: panelReadingContents(3000).lesson},
  internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion,
    dialogue_source_channel: "direct_panel_readout", dialogue_panel_identity: oldIdentity, dialogue_panel_revision: 0},
  retrieval_cue_links: [{kind: "semantic", value: "dialogue_ref_" + referent, source: "subjective_dialogue_learning"}],
};
function speech(text, subject, predicate, object) {
  return buildCharacterCommunicationActionCandidate({character: speaker, cognition: {communication_goal: {
    character: speaker, addressee: actor, purpose: "問倒數上限", mode: "direct", public_content: text,
    surface_realization: {semantic_anchor: text, clause: {subject, predicate, object, punctuation: "？"}},
  }}});
}
const ask = speech(question, "架上那台白色計時器", "能倒數", "多久");
const reask = speech(verify, "現在", "還是", "一樣嗎");
const evt = (event_id, participants, next_events = []) => ({event_id, scene_id: room, participants, next_events, type: "conversation"});
const finalQuestion = evt("decide", [actor]);
const inquiry = evt("reask", [speaker], [finalQuestion]);
const quote = evt("quote", [actor], [inquiry]);
const idle = {event_id: "idle", scene_id: room, participants: [actor], next_events: [], type: "observation"};
const initial = evt("ask", [speaker], [quote]);

async function run(mode) {
  assert.ok(["open", "blocked", "different", "declined"].includes(mode));
  const temp = path.join(projectRoot, "tests", ".tmp");
  await mkdir(temp, {recursive: true});
  const fixtureRoot = await mkdtemp(path.join(temp, "native-panel-recheck-"));
  const runtime = createWorldSimulationCharacterRuntimeManager({identityResolver: async character => ({
    entity_id: character === actor ? "panel-operator" : "panel-visitor", canonical_name: character, identity_source: "fixture", formal: true,
  })});
  const options = {fixtureRoot, characterRuntimeManager: runtime, groundDialogueReferents: true, learnDialogueReferents: true};
  try {
    const actualObject = mode === "different" ? canonicalObject + "_replacement" : canonicalObject;
    const session = await beginWorldSimulationSession({simulation_label: "Fresh panel confirmation", seed: mode,
      rules: {event_driven: true, persistent_causality: true, communication_action_seconds: 0.25},
      initial_world_state: {
        simulation_time: startTime, event_queue: [{...idle, next_events: [initial]}],
        scenes: {[room]: {scene_id: room, simulation_time: startTime, dimensions: {width_m: 10, depth_m: 10},
          entity_positions: {[actor]: {x: 2,y: 2}, [speaker]: {x: 1,y: 3}},
          obstacles: mode === "blocked" ? [{obstacle_id: "barrier", x_min: 3, x_max: 3.5, y_min: 1.6, y_max: 2.4,
            blocks_vision: false}] : [],
          audibility_profiles: {[actor]: {minimum_audible_db: 35}}}},
        objects: {[actualObject]: {scene_id: room, position: {x: 6,y: 2}, visual_label: "架上那台白色計時器",
          public_runtime_display: {kind: "countdown_limit_panel", max_countdown_seconds: 2520}}},
        characters: {[actor]: {current_goal: "回應來訪者", movement_speed_mps: 1.3,
          speech_acoustics: {sound_level_db_at_1m: 60}, memory_retrieval_profile: {enabled: true, model_mode: "cue_dependent_v2"},
          communication_voice_identity_evidence: [{observer: actor, source_speaker: speaker, perceived_speaker: speaker,
            evidence_kind: "familiar_voice", identity_status: "identified", active: true}]},
        [speaker]: {current_goal: "核對計時", speech_acoustics: {sound_level_db_at_1m: 60}}},
        memories: {[actor]: [entry], [speaker]: []}, available_actions: {[speaker]: [ask, reask]},
      }}, options);
    const sid = session.world_simulation_session_id;
    const play = async (event_id, select) => {
      const result = await runWorldSimulationTurn({world_simulation_session_id: sid, event_id}, {
        ...options, characterCommunicationListenerInterpretationResolver: async ({observer, speech_candidates}) =>
          observer === actor ? speech_candidates.map(cue => ({speech_candidate_id: cue.speech_candidate_id,
            heard_surface: cue.emitted_surface_signal, interpreted_content: cue.emitted_surface_signal,
            speech_content_intelligible: true, understanding_attested: true})) : [],
        characterBrain: select,
      });
      assert.equal(result.committed, true);
      return (await getWorldSimulationHistory(sid, options)).turns.at(-1);
    };
    function chooseSpeech(packet, text) {
      assert.ok(!JSON.stringify(packet).includes(canonicalObject));
      const action = packet.candidate_action_intents.find(c => c.communication?.surface_realization?.surface_text === text);
      assert.ok(action, JSON.stringify({mode, wanted: text, candidates: packet.candidate_action_intents}));
      return {action_id: action.action_id};
    }
    await play("idle", () => "reject_all");
    await play("ask", () => ({action_id: ask.action_id}));
    const quoteTurn = await play("quote", packet => chooseSpeech(packet, quoted));
    assert.equal(quoteTurn.dialogue_panel_quotes.length, 1);
    await play("reask", () => ({action_id: reask.action_id}));
    const decided = await play("decide", packet => {
      assert.ok(!JSON.stringify(packet).includes("42分鐘"));
      const walks = packet.candidate_action_intents.filter(c => c.intent === "走近計時器，再確認一次面板");
      if (mode === "different") {
        assert.equal(walks.length, 0);
        return chooseSpeech(packet, fallback);
      }
      assert.equal(walks.length, 1);
      return mode === "declined" ? "reject_all" : {action_id: walks[0].action_id};
    });
    let current = await getWorldSimulationState(sid, options);
    const next = current.state.event_queue[0];
    if (["different", "declined"].includes(mode)) {
      assert.equal(next, undefined);
      assert.equal(decided.action_outcomes.some(row => row.communication_event?.surface_text === fallback), mode === "different");
    } else {
      assert.equal(decided.action_outcomes[0].result, mode === "open" ? "movement_completed" : "movement_blocked");
      assert.ok(next?.event_id?.startsWith("dialogue_panel_recheck_"));
      const checked = await play(next.event_id, packet => {
        assert.equal(packet.candidate_action_intents.some(c => c.intent === "走近計時器，再確認一次面板"), false);
        return chooseSpeech(packet, mode === "open" ? nowSpeech : fallback);
      });
      assert.equal(checked.action_outcomes[0].communication_event.surface_text, mode === "open" ? nowSpeech : fallback);
      current = await getWorldSimulationState(sid, options);
      assert.equal(current.state.event_queue.length, 0);
    }
    const reads = current.state.memories[actor].filter(m => m.content?.statement_kind === "observed_panel_readout");
    assert.deepEqual(reads.map(m => m.content.panel_reading.max_countdown_seconds), mode === "open" ? [3000, 2520] : [3000]);
    console.log(JSON.stringify({mode, checked: mode === "open", action: decided.action_outcomes[0]?.result ?? null}));
  } finally {
    await rm(fixtureRoot, {recursive: true, force: true});
  }
}

// Simultaneous moves may queue more than one readback from the same world turn.
const plans = [actor, "另一位值班員"].map((character, index) => ({
  character, partner: speaker, referent, identity: oldIdentity, action_id: "dialogue_panel_recheck_" + index,
}));
const actionOutcomes = plans.map((plan, index) => ({actor: plan.character, action_id: plan.action_id,
  result: index ? "movement_blocked" : "movement_completed"}));
const [firstCheck, secondCheck] = schedulePanelRechecks({
  plans, selections: plans.map(plan => ({character: plan.character, action_id: plan.action_id,
    candidate: {movement: {dx: 1, dy: 0}}})),
  outcomes: actionOutcomes, turnId: "movement", sceneId: room,
});
const sourceTurn = {turn_id: "movement", event: {scene_id: room}, revision_to: 2,
  next_state_hash: "rev2", scheduled_events: [firstCheck.event_id, secondCheck.event_id], action_outcomes: actionOutcomes};
const siblingTurn = {event: firstCheck, revision_from: 2, revision_to: 3,
  previous_state_hash: "rev2", next_state_hash: "rev3"};
const input = {event: secondCheck, character: plans[1].character,
  snapshot: {revision: 3, state_hash: "rev3"}};
assert.equal(resolvePendingPanelRecheck({...input, history: {turns: [sourceTurn, siblingTurn]}})?.moved, false);
for (const invalidSibling of [
  {...siblingTurn, previous_state_hash: "unrelated"},
  {...siblingTurn, event: {...firstCheck, event_id: "dialogue_panel_recheck_unrelated"}},
]) {
  assert.equal(resolvePendingPanelRecheck({...input, history: {turns: [sourceTurn, invalidSibling]}}), null);
}

await Promise.all((process.argv[2] ? [process.argv[2]] : ["open", "blocked", "different", "declined"]).map(run));
