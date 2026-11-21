import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { analyzeObserverDialogueLearning, learnedDialogueMemoryStage, observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { planDialogueLocationAnswer } from "../../server/src/observer-dialogue-location-answer-service.mjs";
import { activeTestimonyClaims, findEllipticalLocationCorrection, findTestimonyRetraction,
  findTestimonyRetractions, revisedTestimonyBody, singleUncontestedTestimony
} from "../../server/src/observer-dialogue-testimony-revision-service.mjs";

const observer = "值班員", witness = "陳叔", other = "季文", name = "霧橋出入簿";
const referent = "learned_" + "a".repeat(24);
const old = name + "放在東樓梯櫃。", revised = name + "放在西側醫務櫃。";
const line = "我剛才說錯了，" + revised;
function record(id, speaker, lesson, retracts_memory_id = null) {
  return {memory_id: id, accessible: true, encoded_at: "2026-11-20T08:00:00Z",
    content: {referent_id: referent, referent_name: name, referent_aliases: [],
      topic: "learned_dialogue", detail_type: "location", lesson,
      ...(speaker ? {testimony_speaker: speaker} : {}),
      ...(retracts_memory_id ? {retracts_memory_id} : {})},
    internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion,
      dialogue_source_channel: "understood_testimony"}};
}
const first = record("memory_first", witness, old);
const second = record("memory_second", witness, revised, first.memory_id);
const third = record("memory_third", witness, name + "放在圖書室。", second.memory_id);
const speaking = (text, speaker = witness) => ({channel: "understood_testimony",
  speaker, receipt_hash: "verified", text});
const detail = {lesson: revised, detail_type: "location"};
assert.equal(revisedTestimonyBody(line), revised);
assert.equal(revisedTestimonyBody(revised), null);
const brief = "我剛才說錯了，是西側醫務櫃。";
const briefSource = speaking(brief);
assert.equal(findEllipticalLocationCorrection({source: briefSource, memories:[first],
  observedAt:"2026-11-20T08:01:00Z"})?.detail.lesson, revised);
assert.equal(findEllipticalLocationCorrection({source: speaking(brief, other), memories:[first],
  observedAt:"2026-11-20T08:01:00Z"}), null);
assert.equal(findEllipticalLocationCorrection({source: briefSource, memories:[first],
  observedAt:"2026-11-20T10:30:00Z"}), null);
assert.equal(findEllipticalLocationCorrection({source: briefSource,
  memories:[first,record("other-item", witness, "星夜日誌放在圖書室。")],
  observedAt:"2026-11-20T08:01:00Z"}), null, "Ambiguous subject must not be guessed");
assert.equal(findTestimonyRetraction({source: speaking(line), memories: [first],
  referent, detail}), first.memory_id);
assert.equal(findTestimonyRetraction({source: speaking(revised), memories: [first],
  referent, detail}), null, "A contradiction alone is not an explicit retraction");
assert.equal(findTestimonyRetraction({source: speaking(line, other), memories: [first],
  referent, detail}), null, "Another speaker cannot retract the original witness");
assert.equal(findTestimonyRetraction({source: {...speaking(line), channel: "heard_text"},
  memories: [first], referent, detail}), null, "Anonymous words cannot authenticate a correction");
assert.equal(findTestimonyRetraction({source: speaking(line),
  memories: [record("anonymous", null, old)], referent, detail}), null);
assert.equal(findTestimonyRetraction({source: speaking("我大概說錯了，" + revised),
  memories: [first], referent, detail}), null);
assert.equal(singleUncontestedTestimony([first, second], referent, "location")?.memory_id, second.memory_id);
assert.equal(singleUncontestedTestimony([first, second, third], referent, "location")?.memory_id, third.memory_id);
assert.deepEqual(activeTestimonyClaims([first, second, third], referent, "location").map(x => x.memory_id),
  [third.memory_id], "Past testimony is retained but no longer competes in current judgement");

// After a witness repeats the corrected answer, one later correction must
// withdraw *both* copies of that witness's now-stale location.
const repeated = record("memory_repeated", witness, revised);
const final = record("memory_final", witness, name + "放在地下保管室。",
  null);
const finalLine = "我剛才說錯了，" + final.content.lesson;
const finalDetail = {detail_type:"location", lesson:final.content.lesson};
assert.deepEqual(findTestimonyRetractions({source:speaking(finalLine),
  memories:[first,second,repeated],referent,detail:finalDetail}),
  [second.memory_id,repeated.memory_id]);
const chainFinal = {...final, content:{...final.content,
  retracts_memory_ids:[second.memory_id,repeated.memory_id]}};
assert.deepEqual(activeTestimonyClaims([first,second,repeated,chainFinal],referent,"location")
  .map(x=>x.memory_id),[final.memory_id]);
assert.equal(singleUncontestedTestimony([first,second,repeated,chainFinal],referent,"location")
  ?.content.lesson,final.content.lesson);
assert.equal(findTestimonyRetraction({source:speaking(finalLine),
  memories:[first,second,repeated],referent,detail:finalDetail}),null,
  "The old single-target API refuses ambiguous multiple rows");
const repeatedBrief = findEllipticalLocationCorrection({
  source:speaking("我剛才說錯了，是地下保管室。"),
  memories:[first,second,repeated], observedAt:"2026-11-20T08:01:00Z",
});
assert.deepEqual(repeatedBrief?.retracts_memory_ids,
  [second.memory_id,repeated.memory_id]);
assert.equal(repeatedBrief?.detail.lesson,final.content.lesson);

const otherWitness = record("memory_other_witness",other,revised);
assert.deepEqual(findTestimonyRetractions({source:speaking(finalLine),
  memories:[first,second,repeated,otherWitness],referent,detail:finalDetail}),
  [second.memory_id,repeated.memory_id],"Do not retract a different person's testimony");
assert.equal(singleUncontestedTestimony(
  [first,second,repeated,chainFinal,otherWitness],referent,"location"),null,
  "An independent contradictory witness must remain in the dispute");
assert.deepEqual(findTestimonyRetractions({source:speaking(finalLine,other),
  memories:[first,second,repeated],referent,detail:finalDetail}),[],
  "Even a confidently recognized different speaker cannot retract this witness");
const firstHand = {...record("sighted",null,name+"放在東樓梯櫃。"),
  internal_provenance:{dialogue_learning_version:observerDialogueLearningVersion,
    dialogue_source_channel:"observed_text"}};
assert.equal(singleUncontestedTestimony([firstHand,second,repeated,chainFinal],
  referent,"location"),null,"An eyewitness location conflict must not be silently overridden");

assert.equal(singleUncontestedTestimony([first, record("unretracted", witness, revised)], referent, "location"), null,
  "Same speaker inconsistency without a correction is unresolved");
assert.equal(singleUncontestedTestimony([first, record("other", other, revised)], referent, "location"), null,
  "Different witnesses disagree without automatically retracting one another");
const heard = {kind: "understood_utterance", schema_version: "cc2-listener-understood-utterance-v1",
  observer, speaker: witness, semantic_content: line, speech_content_intelligible: true,
  speaker_identity_recognized: true, public_event_committed: true, world_truth_claimed: false};
const unrecognized = {...heard, speaker_identity_recognized:false};
const unrecognizedAnalysis = analyzeObserverDialogueLearning({
  character:observer, perception:{audible:[unrecognized]},memories:[first],
  verifiedReceiptHashes:[hashAgentRunValue(unrecognized)],
});
assert.equal(unrecognizedAnalysis.bindings.size,0,
  "An unrecognized speaker must not be adopted as a witness correction");
const analyzed = analyzeObserverDialogueLearning({
  character: observer, perception: {audible: [heard]}, memories: [first],
  verifiedReceiptHashes: [hashAgentRunValue(heard)],
});
const binding = analyzed.bindings.get("auditory:0");
assert.equal(binding?.detail?.lesson, revised);
assert.equal(binding?.source?.speaker, witness);
assert.equal(binding?.retracts_memory_id, first.memory_id);
const abbreviated = {...heard, semantic_content: brief};
const abbreviatedAnalysis = analyzeObserverDialogueLearning({
  character: observer, perception: {simulation_time:"2026-11-20T08:01:00Z",audible:[abbreviated]},
  memories:[first],verifiedReceiptHashes:[hashAgentRunValue(abbreviated)],
});
assert.equal(abbreviatedAnalysis.bindings.get("auditory:0")?.detail?.lesson, revised);
assert.equal(abbreviatedAnalysis.bindings.get("auditory:0")?.retracts_memory_id, first.memory_id);
const notAnOfficialCorrection = analyzeObserverDialogueLearning({
  character: observer, perception: {audible: [{...heard, semantic_content: revised}]},
  memories: [first], verifiedReceiptHashes: [hashAgentRunValue({...heard, semantic_content: revised})],
});
assert.equal(notAnOfficialCorrection.bindings.get("auditory:0")?.retracts_memory_id, undefined);

function recovered(memory) {
  return {recovered_fragments: [{
    source_memory_ref: memory.memory_id, content: memory.content.lesson,
    content_grounding: {materialized_by_kernel: true, source_memory_ref: memory.memory_id,
      selector: {kind: "json_pointer", path: "/lesson"}},
  }]};
}
const cognition = memory => ({working_context: {focus: {context_origin: "recovered_memory",
  content: memory.content.lesson}}});
const request = {kind: "object_location", referent, speaker: other, referent_collision: false};
const target = {observer, partner: other};
const reply = planDialogueLocationAnswer({character: observer, target, request,
  memories: [first, second], retrieval: recovered(second), cognition: cognition(second)});
assert.equal(reply?.surface_realization?.clause?.topic, witness + "後來說");
const repeatedCorrectionReply = planDialogueLocationAnswer({character:observer,target,request,
  memories:[first,second,repeated,chainFinal],
  retrieval:recovered(chainFinal),cognition:cognition(chainFinal)});
assert.equal(repeatedCorrectionReply?.surface_realization?.clause?.topic,witness+"後來說",
  "Multi-retraction lineage must still be described as a witness's later correction");
assert.equal(buildCharacterCommunicationActionCandidate({character: observer, cognition: {
  ...cognition(second), communication_goal: reply}})?.communication?.surface_realization?.surface_text,
  witness + "後來說，" + revised);
const uncertain = (memories, memory) => planDialogueLocationAnswer({character: observer, target,
  request, memories, retrieval: recovered(memory), cognition: cognition(memory)}).public_content;
assert.equal(uncertain([first, second], first), "我不確定，得再查一下。",
  "A previously retrieved old claim cannot override the correction");
assert.equal(uncertain([first, record("other", other, revised)], first), "我不確定，得再查一下。");
assert.equal(uncertain([first, second, record("other", other, old)], second), "我不確定，得再查一下。",
  "A contradictory independent witness still blocks certainty");

function memoryStage(current, all) {
  return learnedDialogueMemoryStage({stage: "recovery", conversation_referent: referent,
    request_field: "location", committed_referent_memories: all,
    current_frontier: {candidate_memory_records: current}});
}
assert.deepEqual(memoryStage([first], [first, second]).recovered_selections, [],
  "Stale memories are not selected even if the frontier only contains the old claim");
assert.equal(memoryStage([first, second], [first, second]).recovered_selections[0]?.source_memory_ref,
  second.memory_id);
assert.deepEqual(memoryStage([first], [first, record("other", other, revised)]).recovered_selections, []);

console.log("Testimony revisions: explicit, per-witness chains; independent contradictions; verified perception; stale-frontier veto; admitted answer verified.");
