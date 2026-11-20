import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const actor = "值班員", partner = "小夏", third = "小晴", sceneId = "會議室";
const firstName = "砂棠計時器", secondName = firstName + "二號";
const firstRef = "learned_" + "a".repeat(24), secondRef = "learned_" + "b".repeat(24);
const firstAnswer = "我記得有人說最多能倒數五十分鐘。";
const secondAnswer = "喔，我記得有人說最多能倒數十分鐘。";
const clarify = "你指的是哪一件？";
const time = "2026-11-20T08:30:00.000Z";

const memory = (name, referent, duration, key) => ({
  memory_id: "memory_" + key.repeat(24),
  memory_type: "episodic_direct_perception",
  accessible: true,
  encoded_at: "2026-11-20T08:00:00.000Z",
  source: {kind: "direct_perception", sense: "auditory"},
  subjective_memory_not_world_truth: true,
  content: {referent_id: referent, referent_name: name, referent_aliases: key === "b" ? ["二號"] : [],
    topic: "learned_dialogue", detail_type: "runtime", lesson: name + "最多能倒數" + duration + "。"},
  internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion,
    dialogue_source_channel: "understood_testimony"},
  retrieval_cue_links: [{kind: "semantic", value: "dialogue_ref_" + referent, source: "subjective_dialogue_learning"}],
});
const memories = [memory(firstName, firstRef, "五十分鐘", "a"), memory(secondName, secondRef, "十分鐘", "b")];
function speech(character, addressee, clause, text, more = {}) {
  const candidate = buildCharacterCommunicationActionCandidate({character, cognition: {communication_goal: {
    character, addressee, purpose: "對話", mode: "direct", public_content: text,
    surface_realization: {semantic_anchor: text, clause}, ...more,
  }}});
  assert.equal(candidate?.communication?.surface_realization?.surface_text, text);
  return candidate;
}
const asks = (person, subject) => speech(person, actor, {subject, predicate: "能倒數", object: "多久", punctuation: "？"},
  subject + "能倒數多久？");
const guessText = "我猜是五十分鐘。";
const guess = speech(actor, partner, {subject: "我", predicate: "猜是", object: "五十分鐘"}, guessText, {
  claim_kind: "explicit_assumption", communication_opportunity: "respond",
  assumption_intent: {addressee: partner, hypothetical_content: guessText,
    speaker_intends_hypothetical_frame: true, not_asserted_as_fact: true},
});
function correction(person, name) {
  return speech(person, actor, {topic: "不是", subject: "我", predicate: "說的是", object: name},
    "不是，我說的是" + name + "。");
}

const e = (event_id, participants, next_events = []) => ({event_id, scene_id: sceneId, type: "conversation", participants, next_events});
async function run(mode) {
  const isGroup = mode.startsWith("group_");
  const sharesEarlier = ["group_heard", "group_bare_heard"].includes(mode);
  const hearsEarlier = sharesEarlier || mode === "group_misheard";
  const bare = mode.startsWith("group_bare_");
  const corrector = mode === "repair_other" || isGroup ? third : partner;
  const finalSpeech = isGroup ? (bare
    ? speech(third, actor, {omit_subject: true, predicate: "那它呢", punctuation: "？"}, "那它呢？")
    : asks(third, "它")) : correction(corrector, mode === "repair_full" ? "「" + secondName + "」" : "二號");
  const unrelated = mode === "repair_unrelated"
    ? speech(actor, partner, {subject: "我", predicate: "去拿", object: "水"}, "我去拿水。") : null;
  const previousResponse = unrelated ?? guess;
  const firstQuestion = asks(partner, isGroup ? firstName : "它");
  const responder = e("answer", [actor]);
  const followup = e("followup", [corrector], [responder]);
  const listens = e("receive", isGroup ? [actor, third] : [actor], [followup]);
  const start = e("ask", [partner], [listens]);
  const temp = path.join(projectRoot, "tests", ".tmp");
  await mkdir(temp, {recursive: true});
  const fixtureRoot = await mkdtemp(path.join(temp, "native-dialogue-continuation-"));
  const people = [actor, partner, third];
  const runtime = createWorldSimulationCharacterRuntimeManager({identityResolver: async character => ({
    entity_id: "native-continuation-" + people.indexOf(character), canonical_name: character, identity_source: "fixture", formal: true,
  })});
  const options = {fixtureRoot, characterRuntimeManager: runtime, groundDialogueReferents: true, learnDialogueReferents: true};
  const voice = person => people.filter(other => other !== person).map(other => ({
    observer: person, source_speaker: other, perceived_speaker: other,
    evidence_kind: "familiar_voice", identity_status: "identified", active: true,
  }));
  try {
    const session = await beginWorldSimulationSession({simulation_label: "Native turn continuity and shared context", seed: mode,
      rules: {event_driven: true, persistent_causality: true, communication_action_seconds: 0.25},
      initial_world_state: {simulation_time: time, event_queue: [start],
        scenes: {[sceneId]: {scene_id: sceneId, simulation_time: time, dimensions: {width_m: 12, depth_m: 12},
          entity_positions: {[actor]: {x: 5, y: 5}, [partner]: {x: 4, y: 5}, [third]: {x: 6, y: 5}},
          audibility_profiles: {[actor]: {minimum_audible_db: 35}, [partner]: {minimum_audible_db: 35},
            [third]: {minimum_audible_db: hearsEarlier || mode === "repair_other" ? 35 : 1000}}}},
        characters: Object.fromEntries(people.map(person => [person, {current_goal: "談清楚設備",
          memory_retrieval_profile: {enabled: true, model_mode: "cue_dependent_v2"},
          communication_voice_identity_evidence: voice(person),
          speech_acoustics: {sound_level_db_at_1m: 60}}])),
        memories: {[actor]: memories, [partner]: [], [third]: []},
        available_actions: {[actor]: isGroup ? [] : [previousResponse],
          [partner]: [firstQuestion, ...(corrector === partner ? [finalSpeech] : [])],
          [third]: corrector === third ? [finalSpeech] : []},
      }}, options);
    const sid = session.world_simulation_session_id;
    const play = async (event_id, choose) => {
      const result = await runWorldSimulationTurn({world_simulation_session_id: sid, event_id}, {...options,
        characterCommunicationListenerInterpretationResolver: async ({observer, speech_candidates}) =>
          mode === "repair_unheard" && observer === partner ? [] : speech_candidates.map(cue => ({
            speech_candidate_id: cue.speech_candidate_id, heard_surface: cue.emitted_surface_signal,
            interpreted_content: mode === "group_misheard" && observer === third
              && cue.emitted_surface_signal === firstName + "能倒數多久？"
              ? secondName + "能倒數多久？" : cue.emitted_surface_signal,
            speech_content_intelligible: true, understanding_attested: true,
          })),
        characterBrain: choose,
      });
      assert.equal(result.committed, true, mode);
      return (await getWorldSimulationHistory(sid, options)).turns.at(-1);
    };
    const select = action => () => ({action_id: action.action_id});
    await play("ask", select(firstQuestion));
    let thirdActuallyHeard = null;
    const initialReply = await play("receive", packet => {
      if (packet.character === third) {
        thirdActuallyHeard = packet.perception.audible.some(item =>
          item?.kind === "understood_utterance" && item.semantic_content === firstQuestion.communication.surface_realization.surface_text);
        if (mode === "group_misheard") assert.ok(packet.perception.audible.some(item =>
          item?.kind === "understood_utterance" && item.semantic_content === secondName + "能倒數多久？"));
        return "reject_all";
      }
      if (!isGroup) return select(previousResponse)();
      const candidate = packet.candidate_action_intents.find(item => item.communication?.surface_realization?.surface_text === firstAnswer);
      assert.ok(candidate, "Expected named question to recover the original memory");
      return select(candidate)();
    });
    if (isGroup) assert.equal(thirdActuallyHeard, sharesEarlier, mode);
    else assert.equal(initialReply.action_outcomes[0]?.communication_event?.surface_text,
      previousResponse.communication.surface_realization.surface_text);
    let correctorActuallyHeardReply = null;
    await play("followup", packet => {
      if (!isGroup) correctorActuallyHeardReply = packet.perception.audible.some(item =>
        item?.kind === "understood_utterance" && item.semantic_content === previousResponse.communication.surface_realization.surface_text);
      return select(finalSpeech)();
    });
    if (!isGroup) assert.equal(correctorActuallyHeardReply, mode !== "repair_unheard", mode);
    const response = await play("answer", packet => {
      assert.ok(packet.perception.audible.some(item => item?.kind === "understood_utterance"
        && item.semantic_content === finalSpeech.communication.surface_realization.surface_text), mode);
      const privateKeys = ["dialogue_thread_anchors", "dialogue_answer_followups", "shared_with", "response_action_id"];
      assert.ok(privateKeys.every(key => !JSON.stringify(packet).includes('"' + key + '"')),
        "Private lineage must not enter the Brain packet");
      const candidate = packet.candidate_action_intents.find(item => item.action_id !== previousResponse.action_id
        && item.communication?.surface_realization_complete);
      return candidate ? select(candidate)() : "reject_all";
    });
    const spoken = response.action_outcomes.find(item => item.actor === actor)?.communication_event?.surface_text ?? null;
    const state = await getWorldSimulationState(sid, options);
    const kept = state.state.memories[actor].filter(record =>
      record.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion);
    assert.equal(kept.length, 2, "A correction of the referent must not rewrite either device's fact");
    assert.deepEqual(kept.map(r => [r.content.referent_id, r.content.lesson]),
      memories.map(r => [r.content.referent_id, r.content.lesson]));
    const expected = ({repair: secondAnswer, repair_full: secondAnswer, repair_other: null, repair_unheard: null, repair_unrelated: null,
      group_heard: firstAnswer, group_unheard: clarify, group_misheard: clarify,
      group_bare_heard: firstAnswer, group_bare_unheard: clarify})[mode];
    console.log(JSON.stringify({mode, thirdActuallyHeard, correctorActuallyHeardReply, spoken, expected, memoryRecords: kept.length}));
    assert.equal(spoken, expected, mode);
  } finally {
    await rm(fixtureRoot, {recursive: true, force: true});
  }
}
const modes = ["repair", "repair_full", "repair_other", "repair_unheard", "repair_unrelated",
  "group_heard", "group_unheard", "group_misheard", "group_bare_heard", "group_bare_unheard"];
const selected = process.argv[2];
assert.ok(!selected || modes.includes(selected), "Unknown test scenario");
for (const mode of selected ? [selected] : modes) await run(mode);
