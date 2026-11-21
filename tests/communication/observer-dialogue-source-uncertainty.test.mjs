import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import {
  analyzeObserverDialogueLearning, learnedDialogueMemoryStage, observerDialogueLearningVersion,
  observerLearningObservations,
} from "../../server/src/observer-dialogue-learning-service.mjs";
import { planDialogueLocationAnswer } from "../../server/src/observer-dialogue-location-answer-service.mjs";
import { activeTestimonyClaims, findEllipticalLocationCorrection, findTestimonyRetractions,
  singleUncontestedTestimony } from "../../server/src/observer-dialogue-testimony-revision-service.mjs";

const observer="值班員", witness="陳叔", visitor="季文", name="霧橋出入簿";
const ref="learned_"+"b".repeat(24);
const east=name+"放在東樓梯櫃。", west=name+"放在西側醫務櫃。", basement=name+"放在地下保管室。";
function claim(memory_id, lesson, opts={}) {
  return {memory_id,encoded_at:opts.encoded_at??"2026-09-01T09:00:00.000Z",
    accessible:true,suppressed:false, possibly_incorrect:opts.possibly_incorrect??false,
    source_confused:opts.source_confused??false,
    content:{referent_id:ref,referent_name:name,referent_aliases:[],
      detail_type:"location",lesson,
      ...(opts.speaker === null ? {} : {testimony_speaker:opts.speaker??witness}),
      ...(opts.retracts ? {retracts_memory_id:opts.retracts} : {}),
    },
    internal_provenance:{dialogue_learning_version:observerDialogueLearningVersion,
      dialogue_source_channel:opts.channel??"understood_testimony"}};
}
const first=claim("memory_east",east);
const corrected=claim("memory_west",west,{retracts:first.memory_id,encoded_at:"2026-09-02T09:00:00.000Z"});
const confusedCorrection={...corrected,source_confused:true};
const unsureCorrection={...corrected,possibly_incorrect:true};
const third=claim("memory_basement",basement,{retracts:corrected.memory_id,encoded_at:"2026-11-19T09:00:00.000Z"});
const later=claim("memory_later",basement,{retracts:first.memory_id,encoded_at:"2026-11-19T09:00:00.000Z"});

function retrieval(record) {
  return {recovered_fragments:[{source_memory_ref:record.memory_id,
    content:record.content.lesson,content_grounding:{materialized_by_kernel:true,
      source_memory_ref:record.memory_id,selector:{kind:"json_pointer",path:"/lesson"}}}]};
}
function cognition(record) {
  return {working_context:{focus:{character:observer,context_origin:"recovered_memory",
    content:record.content.lesson}}};
}
const target={observer,partner:visitor}, request={kind:"object_location",
  speaker:visitor,referent:ref,referent_collision:false};
function reply(memories, remembered) {
  return planDialogueLocationAnswer({character:observer,target,request,memories,
    retrieval:remembered ? retrieval(remembered) : {recovered_fragments:[]},
    cognition:remembered ? cognition(remembered) : {working_context:{}}});
}
function stage(frontier, all) {
  return learnedDialogueMemoryStage({stage:"recovery",request_field:"location",
    conversation_referent:ref,committed_referent_memories:all,
    current_frontier:{candidate_memory_records:frontier}});
}
// A later, explicitly recorded correction must never resurrect an earlier
// withdrawn assertion just because its newer content is tagged uncertain.
for (const doubtful of [confusedCorrection,unsureCorrection]) {
  assert.equal(singleUncontestedTestimony([first,doubtful],ref,"location"),null,
    "Doubt about the corrected memory must not resurrect withdrawn testimony");
  assert.equal(reply([first,doubtful],first)?.public_content,"我不確定，得再查一下。",
    "Do not report an old location as if its later withdrawal never happened");
  assert.deepEqual(stage([first],[first,doubtful]).recovered_selections,[],
    "Old retrieval fragments must not bypass an uncertain correction");
}
// A later valid, explicit second correction remains reachable through the
// retained chain even if a middle link has become source-confused.
assert.equal(singleUncontestedTestimony([first,confusedCorrection,third],ref,"location")?.memory_id,
  third.memory_id);
assert.equal(singleUncontestedTestimony([first,unsureCorrection,third],ref,"location")?.memory_id,
  third.memory_id);
assert.equal(reply([first,unsureCorrection,third],third)?.surface_realization?.clause?.topic,
  witness+"後來說");
assert.equal(singleUncontestedTestimony([first,later],ref,"location")?.memory_id,later.memory_id);
// A direct visual clue is an observed text, not a named person's statement.
const observed=claim("memory_visual",east,{speaker:null,channel:"observed_text"});
assert.equal(reply([observed],observed)?.surface_realization?.clause?.topic,
  "我看到的線索是",
  "A visual clue must not be misreported as somebody's testimony or direct proof of an object's location");
assert.equal(observerLearningObservations({observed:[east]},observer)[0]?.channel,"observed_text");
assert.equal(observerLearningObservations({audible:[east]},observer)[0]?.channel,"heard_text");
assert.equal(reply([observed,corrected],corrected)?.public_content,"我不確定，得再查一下。",
  "A named witness cannot erase contradictory independently seen evidence");
const overheard=claim("memory_unattributed",east,{speaker:null,channel:"heard_text"});
assert.equal(reply([overheard],overheard)?.surface_realization?.clause?.topic,
  "我聽到的說法是");
// Delayed recall is allowed only when the memory kernel actually materialized
// an old record. Passage of time must not authorize direct catalog lookup.
assert.equal(reply([first,corrected],corrected)?.surface_realization?.clause?.topic,
  witness+"後來說","The known 2026-09 correction can still be used when genuinely retrieved");
assert.equal(reply([first,corrected],null)?.public_content,"我不確定，得再查一下。",
  "No active retrieval means no automatic omniscient answer");
const lateSource={channel:"understood_testimony",speaker:witness,receipt_hash:"verified",
  text:"我剛才說錯了，是地下保管室。"};
assert.equal(findEllipticalLocationCorrection({source:lateSource,memories:[first,corrected],
  observedAt:"2026-11-20T10:00:00Z"}),null,
  "A bare correction cannot silently infer a forgotten subject two months later");
assert.deepEqual(findTestimonyRetractions({source:{...lateSource,text:"我剛才說錯了，"+basement},
  memories:[first,corrected],referent:ref,detail:{detail_type:"location",lesson:basement}}),
  [corrected.memory_id],"An explicit named correction is not subject to the elliptical time limit");
// A newly misidentified speaker has no trusted witness receipt.
const misidentified={kind:"understood_utterance",schema_version:"cc2-listener-understood-utterance-v1",
  observer,speaker:witness,semantic_content:"我剛才說錯了，"+west,
  speech_content_intelligible:true,speaker_identity_recognized:false,
  public_event_committed:true,world_truth_claimed:false};
const a=analyzeObserverDialogueLearning({character:observer,
  perception:{audible:[misidentified]},memories:[first],
  verifiedReceiptHashes:[hashAgentRunValue(misidentified)]});
assert.equal(a.bindings.size,0);
console.log("Witness source uncertainty: confused corrections, faithful visual/heard origins, delayed recall and unidentified speakers verified.");
