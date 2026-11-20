import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { analyzeObserverDialogueLearning, observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const actor = "器材管理員", original = "同事小夏", other = "第一次到訪的小晴";
const name = "砂棠計時器", newName = name + "二號";
const oldFact = `${name}最多能倒數五十分鐘。`;
const oldRoom = "器材室", newRoom = "接待室", time = "2026-11-20T08:00:00.000Z";
const cases = [
  ["same_thread", oldRoom, original, "它能倒數多久？", oldFact, "同一人延續上一輪"],
  ["changed_speaker", oldRoom, other, "它能倒數多久？", null, "同房但換成沒聽過前文的人"],
  ["changed_scene_and_speaker", newRoom, other, "它能倒數多久？", null, "換房又換成沒聽過前文的人"],
  ["explicit_name_control", newRoom, other, `${name}能倒數多久？`, oldFact, "換人換場但叫對完整名稱"],
  ["unseen_suffix", newRoom, other, `「${newName}」能倒數多久？`, null, "二號未曾學過，不能沿用舊機"],
  ["unseen_suffix_assertion", newRoom, other, `「${newName}」最多能倒數十分鐘。`, null, "二號的陳述不可寫進舊機記憶"],
  ["chosen_guess", newRoom, other, "它能倒數多久？", null, "角色仍可選擇把自己的猜測說出口"],
];

const first = "learned_" + "a".repeat(24), second = "learned_" + "b".repeat(24);
const record = (referent_id, referent_name, referent_aliases = []) => ({
  content: {referent_id, referent_name, referent_aliases},
  internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion},
});
function analyze(line, memories) {
  return analyzeObserverDialogueLearning({character: actor, perception: {audible: [line]}, memories});
}
const oldOnly = [record(first, name, ["砂棠"])];
const both = [...oldOnly, record(second, newName)];
for (const reference of [newName, `「${newName}」`, `『${newName}』`, `"${newName}"`]) {
  assert.equal(analyze(reference + "能倒數多久？", oldOnly).scope?.mode, "ambiguous", reference);
  assert.equal(analyze(reference + "能倒數多久？", both).scope?.referent, second, reference);
  assert.equal(analyze(reference + "最多能倒數十分鐘。", oldOnly).bindings.size, 0, reference);
}
assert.equal(analyze("砂棠能倒數多久？", both).scope?.referent, first);
assert.equal(analyze(`「${name}」和「${newName}」哪個能倒數比較久？`, both).scope?.mode, "ambiguous");
assert.equal(analyze(`這台計時器叫「${newName}」。`, oldOnly).bindings.get("auditory:0")?.referent_name, newName);
assert.equal(analyze(`${name}放在「修理櫃」。`, both).bindings.get("auditory:0")?.detail?.detail_type, "location");
for (const prefix of ["我猜", "我猜，", "大概"]) {
  const uncertain = analyze(prefix + name + "最多能倒數四十分鐘。", both);
  assert.equal(uncertain.scope?.referent, first);
  assert.equal(uncertain.bindings.size, 0);
}
const temporary = path.join(projectRoot, "tests", ".tmp");
await mkdir(temporary, {recursive: true});
const root = await mkdtemp(path.join(temporary, "holdout-dialogue-thread-"));
async function run([id, location, talker, line, expect, criterion]) {
  const fixtureRoot = path.join(root, id);
  const statement = id.endsWith("_assertion");
  const choosesGuess = id === "chosen_guess";
  const guessText = "我猜它能倒數十分鐘。";
  const guess = choosesGuess ? buildCharacterCommunicationActionCandidate({character: actor, cognition: {
    communication_goal: {
      character: actor, addressee: talker, purpose: "先提出自己的猜想", mode: "direct", public_content: guessText,
      claim_kind: "explicit_assumption",
      assumption_intent: {addressee: talker, hypothetical_content: guessText,
        speaker_intends_hypothetical_frame: true, not_asserted_as_fact: true},
      surface_realization: {semantic_anchor: guessText,
        clause: {subject: "我", predicate: "猜", object: "它能倒數十分鐘"}},
    },
  }}) : null;
  if (choosesGuess) assert.equal(guess?.communication?.surface_realization?.surface_text, guessText);
  const subject = line.split(/(?:最多能倒數|能倒數)/u)[0];
  function build(character, public_content, subject, predicate, object, punctuation) {
    const candidate = buildCharacterCommunicationActionCandidate({character, cognition: {communication_goal: {
      character, addressee: actor, purpose: "交換器材資訊", mode: "direct", public_content,
      surface_realization: {semantic_anchor: public_content, clause: {subject, predicate, object, punctuation}},
    }}});
    assert.equal(candidate?.communication?.surface_realization?.surface_text, public_content, id);
    return candidate;
  }
  const speech = build(talker, line, subject, statement ? "最多能倒數" : "能倒數",
    statement ? "十分鐘" : "多久", statement ? "。" : "？");
  const introText = `這台計時器叫「${name}」。`;
  const introSpeech = build(original, introText, "這台計時器", "叫", `「${name}」`, "。");
  const factSpeech = build(original, oldFact, name, "最多能倒數", "五十分鐘", "。");
  const evt = (event_id, scene_id, participants, next_events=[]) => ({event_id, type: "conversation", scene_id, participants, next_events});
  const heardNew = evt("hear", location, [actor]);
  const sayNew = evt("say", location, [talker], [heardNew]);
  const hearFact = evt("hear-fact", oldRoom, [actor], [sayNew]);
  const sayFact = evt("say-fact", oldRoom, [original], [hearFact]);
  const learnName = evt("learn-name", oldRoom, [actor], [sayFact]);
  const events = evt("intro", oldRoom, [original], [learnName]);
  const room = scene_id => ({
    scene_id, simulation_time: time, dimensions: {width_m: 12, depth_m: 10},
    entity_positions: {[actor]: {x: 4,y: 4}, [original]: {x: 3,y: 4},
      [other]: scene_id === oldRoom ? {x: 5, y: 4} : {x: 3,y: 4}},
    audibility_profiles: {[actor]: {minimum_audible_db: 35}},
    observable_by: {[actor]: {visual: [], audible: []}},
  });
  const runtime = createWorldSimulationCharacterRuntimeManager({identityResolver: async character => ({
    entity_id: character === actor ? "holdout-actor" : character === original ? "holdout-original" : "holdout-visitor",
    canonical_name: character, identity_source: "fixture", formal: true,
  })});
  const options = {fixtureRoot, characterRuntimeManager: runtime, groundDialogueReferents: true, learnDialogueReferents: true};
  const session = await beginWorldSimulationSession({simulation_label: "Holdout: listener thread versus object recall", seed: id,
    rules: {event_driven: true, persistent_causality: true, communication_action_seconds: 0.25},
    initial_world_state: {
      simulation_time: time, event_queue: [events],
      scenes: {[oldRoom]: room(oldRoom), [newRoom]: room(newRoom)},
      characters: {
        [actor]: {current_goal: "向來訪者答覆正確的器材資訊",
          memory_retrieval_profile: {enabled: true, model_mode: "cue_dependent_v2"},
          communication_voice_identity_evidence: [original, other].map(who => ({
            observer: actor, source_speaker: who, perceived_speaker: who, evidence_kind: "familiar_voice",
            identity_status: "identified", active: true,
          })),
        },
        [original]: {speech_acoustics: {sound_level_db_at_1m: 60}},
        [other]: {speech_acoustics: {sound_level_db_at_1m: 60}},
      },
      memories: {[actor]: [], [original]: [], [other]: []}, available_actions: {
        ...(guess ? {[actor]: [guess]} : {}),
        [original]: [introSpeech, factSpeech, ...(talker === original ? [speech] : [])],
        ...(talker === original ? {} : {[talker]: [speech]})},
    },
  }, options);
  const sid = session.world_simulation_session_id;
  const play = async (event_id, characterBrain) => {
    const result = await runWorldSimulationTurn({world_simulation_session_id: sid, event_id}, {
      ...options,
      characterCommunicationListenerInterpretationResolver: async ({observer, speech_candidates}) =>
        observer === actor ? speech_candidates.map(cue => ({speech_candidate_id: cue.speech_candidate_id,
          heard_surface: cue.emitted_surface_signal, interpreted_content: cue.emitted_surface_signal,
          speech_content_intelligible: true, understanding_attested: true})) : [],
      characterBrain,
    });
    assert.equal(result.committed, true, id);
    return (await getWorldSimulationHistory(sid, options)).turns.at(-1);
  };
  const choose = action => () => ({action_id: action.action_id});
  await play("intro", choose(introSpeech));
  await play("learn-name", () => "reject_all");
  await play("say-fact", choose(factSpeech));
  await play("hear-fact", () => "reject_all");
  const learned = state => state.state.memories[actor].filter(record =>
    record.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion);
  const before = learned(await getWorldSimulationState(sid, options));
  assert.equal(before.length, 2, id);
  assert.equal(before[0].content.referent_name, name, id);
  assert.ok(before.some(record=>record.content.lesson===oldFact), id);
  const said = await play("say", packet => packet.character === talker ? {action_id: speech.action_id} : "reject_all");
  assert.equal(said.action_outcomes.find(item => item.actor === talker)?.communication_event?.surface_text, line, id);
  let oldInWorking, proposed;
  const clarify = "你指的是哪一件？";
  const heard = await play("hear", packet => {
    const understood = packet.perception.audible.find(x => x?.kind === "understood_utterance" && x.semantic_content === line);
    assert.equal(understood?.speaker, talker, id);
    assert.ok(!JSON.stringify(packet).includes("dialogue_thread_anchors"), id);
    oldInWorking = JSON.stringify(packet.cognition.working_context).includes(oldFact);
    const candidate = packet.candidate_action_intents.find(item => item.communication?.surface_realization_complete
      && item.action_id !== guess?.action_id);
    if (guess) {
      const hypothesis = packet.candidate_action_intents.find(item => item.action_id === guess.action_id);
      assert.equal(hypothesis?.communication?.message?.epistemic_status, "speaker_hypothetical", id);
    }
    proposed = candidate?.communication.surface_realization.surface_text ?? null;
    return guess ? {action_id: guess.action_id} : candidate ? {action_id: candidate.action_id} : "reject_all";
  });
  const after = learned(await getWorldSimulationState(sid, options));
  const wrongWrite = after.find(record => record.content.referent_id === before[0].content.referent_id
    && typeof record.content.lesson === "string" && record.content.lesson.includes("二號"));
  const spoken = heard.action_outcomes.find(item => item.actor === actor)?.communication_event?.surface_text ?? null;
  if (statement) {
    assert.equal(after.length, before.length, "Unknown name must not create a learned detail");
    assert.equal(wrongWrite, undefined, id);
    assert.equal(spoken, null, id);
  } else {
    assert.equal(oldInWorking, Boolean(expect), id);
    const expectedSpeech = expect ? "我記得有人說最多能倒數五十分鐘。" : clarify;
    assert.equal(proposed, expectedSpeech, id);
    assert.equal(spoken, guess ? guessText : expectedSpeech, id);
    if (guess) {
      assert.equal(after.length, before.length, id);
      assert.equal(heard.action_outcomes.find(item => item.actor === actor)?.communication_event?.world_truth_claimed, false);
    }
  }
  return {id, criterion, actualSpeech: spoken, recordsCreated: after.length - before.length};
}
try {
  const selected = process.argv[2];
  const casesToRun = selected ? cases.filter(c => c[0] === selected) : cases;
  assert.ok(casesToRun.length, "Unknown regression scenario");
  // World trace writes share a project-level lock even with separate fixtures.
  for (const scenario of casesToRun) console.log(JSON.stringify(await run(scenario)));
} finally {
  await rm(root, {recursive:true,force:true});
}
