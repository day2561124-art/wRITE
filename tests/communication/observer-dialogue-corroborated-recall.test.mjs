import assert from "node:assert/strict";
import { learnedDialogueMemoryStage, observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { planDialogueLocationAnswer } from "../../server/src/observer-dialogue-location-answer-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";

const observer="值班員", requester="季文", ref="learned_"+"c".repeat(24);
const book="霧橋出入簿", lesson=book+"放在東側庫房。";
function claim(id, speaker, detail=lesson, referent=ref) {
  return {memory_id:id,accessible:id!=="first",source_confused:false,possibly_incorrect:false,
    encoded_at:"2026-11-21T09:00:00.000Z",
    content:{referent_id:referent,referent_name:book,referent_aliases:[],
      detail_type:"location",lesson:detail,testimony_speaker:speaker},
    internal_provenance:{dialogue_learning_version:observerDialogueLearningVersion,
      dialogue_source_channel:"understood_testimony"}};
}
const older=claim("first","陳叔");
const recent=claim("second","小吳");
const duplicate=claim("third","陳叔");
const unrelated=claim("wrong_referent","隔壁員工",lesson,"learned_"+"d".repeat(24));
const conflict=claim("conflict","另一位證人",book+"放在南側保全室。");
const memoryState=memory=>({working_context:{focus:{context_origin:"recovered_memory",
  content:memory.content.lesson,source_confused:false,possibly_incorrect:false}}});
const retrieval=memory=>({recovered_fragments:[{
  source_memory_ref:memory.memory_id,content:memory.content.lesson,
  content_grounding:{materialized_by_kernel:true,source_memory_ref:memory.memory_id,
    selector:{kind:"json_pointer",path:"/lesson"}}}]});
const request={kind:"object_location",speaker:requester,referent:ref,referent_collision:false};
const target={observer,partner:requester};
function answer(memories,memory) {
  return planDialogueLocationAnswer({character:observer,target,request,memories,
    cognition:memoryState(memory),retrieval:retrieval(memory)});
}
function stage(frontier,all,referent=ref) {
  return learnedDialogueMemoryStage({stage:"recovery",request_field:"location",
    conversation_referent:referent,committed_referent_memories:all,
    current_frontier:{candidate_memory_records:frontier}});
}
const selected=stage([recent],[older,recent]).recovered_selections;
assert.equal(selected.length,1,
  "If two witnesses agree but only the second memory is accessible, recover the available one");
assert.equal(selected[0].source_memory_ref,recent.memory_id);
const reply=answer([older,recent],recent);
assert.equal(reply?.surface_realization?.clause?.topic,"小吳說",
  "An admitted agreement from the second witness should be answerable without reviving the first memory");
assert.equal(buildCharacterCommunicationActionCandidate({character:observer,cognition:{
  ...memoryState(recent),communication_goal:reply,
}})?.communication?.surface_realization?.surface_text,"小吳說，"+lesson);

// The selector may not bypass an independently conflicting location,
// even if it is unavailable to the immediate recovery frontier.
assert.deepEqual(stage([recent],[older,recent,conflict]).recovered_selections,[]);
assert.equal(answer([older,recent,conflict],recent)?.public_content,"我不確定，得再查一下。");
assert.deepEqual(stage([unrelated],[older,recent,unrelated]).recovered_selections,[]);
assert.equal(answer([older,recent,unrelated],unrelated)?.public_content,"我不確定，得再查一下。");
// Repeated memories are separate episodes. They still offer a usable
// retrieval route when another agreeing episode has faded.
assert.equal(stage([duplicate],[older,recent,duplicate]).recovered_selections[0]?.source_memory_ref,
  duplicate.memory_id);
assert.equal(answer([older,recent,duplicate],duplicate)?.surface_realization?.clause?.topic,"陳叔說");
// A claimed recovered content string without the materialized kernel proof
// never grants an answer, even when it matches several memories.
assert.equal(planDialogueLocationAnswer({character:observer,target,request,memories:[older,recent],
  cognition:memoryState(recent),retrieval:{recovered_fragments:[{
    source_memory_ref:recent.memory_id,content:recent.content.lesson,
    content_grounding:{materialized_by_kernel:false,source_memory_ref:recent.memory_id,
      selector:{kind:"json_pointer",path:"/lesson"}},
  }]}})?.public_content,"我不確定，得再查一下。");
console.log("Corroborated recall: accessible agreeing testimony selected; conflicts, wrong referents, forged retrievals rejected.");
