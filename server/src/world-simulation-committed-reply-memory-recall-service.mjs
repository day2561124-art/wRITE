import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission }
  from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { queryWorldSimulationMemoryAccessibility }
  from "./world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQuery,
  executeWorldSimulationMemoryRetrievalProcess,
} from "./world-simulation-memory-retrieval-process-service.mjs";

export const worldSimulationReplyMemoryRecallVersion =
  "world-reply-subjective-memory-recall-v1";

const record = value => value !== null && typeof value === "object"
  && !Array.isArray(value);
const array = value => Array.isArray(value) ? value : [];
const copy = value => JSON.parse(JSON.stringify(value ?? null));

function reject(code, message) {
  const error=new Error(message);
  error.code=code;
  throw error;
}
function required(value,name){
  if(typeof value!=="string" || !value.trim() || value.length>240)
    reject("WORLD_REPLY_RECALL_INPUT_INVALID",
      name+" must be a bounded nonblank identifier.");
  return value;
}
function cas(input,snapshot){
  if(!Number.isSafeInteger(input.expected_revision) || input.expected_revision<3
    || typeof input.expected_state_hash!=="string"
    || snapshot.revision!==input.expected_revision
    || snapshot.state_hash!==input.expected_state_hash)
    reject("WORLD_REPLY_RECALL_STALE",
      "Reply memory reentry requires the exact current committed World CAS.");
}
async function brainChoice(packet,input,options) {
  let calls=0, actual, callbackError=null;
  const callback=async incoming=>{
    try{
      if(++calls!==1 || incoming?.character!==input.observer
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_REPLY_RECALL_BRAIN_PACKET_INVALID",
          "Runtime must invoke exactly the original speaker Brain with the unaltered private packet.");
      const current=await getWorldSimulationState(input.world_simulation_session_id,options);
      cas(input,current);
      if(!projectWorldSimulationConsciousCognitionAdmission(current.state,input.observer).admitted)
        reject("WORLD_REPLY_RECALL_ASLEEP",
          "An unconscious character cannot deliberately recall earlier dialogue.");
      actual=await options.characterBrain(copy(incoming));
      return actual;
    }catch(error){callbackError=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn)
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:input.world_simulation_session_id,
      character:input.observer,brain_input:copy(packet),characterBrain:callback,
    },options);
  else await callback(packet);
  if(callbackError)throw callbackError;
  if(calls!==1)
    reject("WORLD_REPLY_RECALL_BRAIN_NOT_INVOKED",
      "The original speaker's Brain must actually decide each retrieval stage.");
  return actual;
}
function verifyMemoryLineage(input,snapshot,history) {
  if(history.world_simulation_session_id!==input.world_simulation_session_id
    || !Array.isArray(history.turns)
    || history.turns.length!==snapshot.revision
    || history.turns.length>4096
    || hashAgentRunValue(snapshot.state)!==snapshot.state_hash)
    reject("WORLD_REPLY_RECALL_HISTORY_INVALID",
      "The authoritative World snapshot and append-only history disagree.");
  for(let i=0;i<history.turns.length;i++){
    const item=history.turns[i];
    if(!record(item)||item.revision_from!==i||item.revision_to!==i+1
      || (i>0 && item.previous_state_hash!==history.turns[i-1].next_state_hash))
      reject("WORLD_REPLY_RECALL_HISTORY_INVALID",
        "A broken World revision/hash chain cannot support private memory reentry.");
  }
  if(history.turns.at(-1)?.next_state_hash!==snapshot.state_hash)
    reject("WORLD_REPLY_RECALL_HISTORY_INVALID",
      "Latest World history state hash differs from the committed snapshot.");

  // First integration slice is immediately after the memory turn. Future
  // arbitrary-later reentry and reconsolidation need their own source verifier.
  const memoryTurn=history.turns.at(-1), reply=history.turns.at(-2);
  const meta=memoryTurn?.autonomous_reply_subjective_memory_encoding;
  const source=reply?.autonomous_listener_clarification_reply;
  if(memoryTurn?.event!==null
    || meta?.version!=="world-reply-subjective-dialogue-memory-v1"
    || memoryTurn.turn_id!==input.memory_turn_id
    || meta.character!==input.observer
    || meta.memory_id!==input.memory_id
    || meta.source_turn_id!==reply?.turn_id
    || meta.source_revision_to!==reply?.revision_to
    || meta.source_turn_hash!==hashAgentRunValue(reply)
    || source?.version!=="world-listener-clarification-causal-reply-v1"
    || source.character!==meta.source_character
    || source.action_id!==meta.source_action_id
    || source.scene_id!==meta.scene_id
    || source.source_character!==input.observer)
    reject("WORLD_REPLY_RECALL_SOURCE_INVALID",
      "A recalled memory must originate in the immediately preceding genuine listener clarification.");

  const admission=array(reply.communication_observer_increment_admissions)
    .filter(item=>item?.observer===input.observer
      && item?.admission_status==="heard_acoustic_cues_only"
      && item?.audit?.source_speaker===meta.source_character
      && item?.audit?.source_action_id===meta.source_action_id
      && item?.observer_increment?.increment_ref===meta.observer_increment_ref);
  const list=array(snapshot.state?.memories?.[input.observer]);
  const memories=list.filter(item=>item?.memory_id===meta.memory_id);
  if(admission.length!==1 || memories.length!==1
    || meta.memory_hash!==hashAgentRunValue(memories[0])
    || memories[0].internal_provenance?.turn_id!==memoryTurn.turn_id
    || memories[0].internal_provenance?.scene_id!==meta.scene_id
    || memories[0].content?.kind!=="subjective_spoken_reply_interpretation"
    || memories[0].content?.world_truth_claimed!==false
    || memories[0].content?.source_utterance_verified!==false
    || memories[0].subjective_memory_not_world_truth!==true
    || memories[0].possibly_incorrect!==true
    || hashAgentRunValue(memories[0].content?.interpreted_content)
      !==meta.interpreted_content_hash)
    reject("WORLD_REPLY_RECALL_MEMORY_INVALID",
      "Only the exact prior-turn, source-pinned, possibly mistaken personal memory can be retrieved.");
  return {memory:memories[0], memories:list};
}

/**
 * Read-only early follow-up to PR #35. The original speaker's independent
 * Brain may DECLINE to recall. If it requests an attempt, Phase63B decides
 * current accessibility, then Phase63C materializes only one grounded
 * source-memory fragment; the Brain can choose whether to attend to it.
 *
 * This is a source-targeted single-fragment test of wiring, not proof of
 * unconstrained spontaneous autobiographical search or memory persistence
 * from a read-only cognitive pass.
 */
export async function runWorldSimulationCommittedReplyMemoryRecall(
  input={},options={},
) {
  const sessionId=required(input.world_simulation_session_id,"session");
  const observer=required(input.observer,"original speaker");
  required(input.memory_turn_id,"memory turn");
  required(input.memory_id,"private memory");
  if(typeof options.characterBrain!=="function")
    reject("WORLD_REPLY_RECALL_BRAIN_REQUIRED",
      "Real Character Brain is required for a deliberate retrieval attempt.");
  const [snapshot,history]=await Promise.all([
    getWorldSimulationState(sessionId,options),
    getWorldSimulationHistory(sessionId,options),
  ]);
  cas(input,snapshot);
  if(!projectWorldSimulationConsciousCognitionAdmission(snapshot.state,observer).admitted)
    reject("WORLD_REPLY_RECALL_ASLEEP",
      "Only the awake original speaker may attempt recall.");
  const {memory,memories}=verifyMemoryLineage(input,snapshot,history);
  const invocation=await brainChoice({
    character:observer,
    cognition:{subjective_dialogue_recall_opportunity:{
      kind:"earlier_spoken_exchange",
      source:"committed_personal_memory",
      remembered_content_exposed:false,
      recall_is_optional:true,
    }},
    boundaries:{
      stage:"decide_whether_to_attempt_personal_recall",
      memory_content_exposed:false,
      other_character_memory_exposed:false,
      engine_memory_id_exposed:false,
      action_selection_authority:false,
      world_truth_authority:false,
      belief_revision_authority:false,
      memory_mutation_authority:false,
    },
  },input,options);
  if(!record(invocation)
    || Object.keys(invocation).length!==1
    || !["attempt_recall","decline"].includes(invocation.decision))
    reject("WORLD_REPLY_RECALL_DECISION_INVALID",
      "Brain must explicitly attempt or decline a private retrieval.");
  if(invocation.decision==="decline")
    return Object.freeze({
      version:worldSimulationReplyMemoryRecallVersion,
      status:"character_declined_recall",retrieval_attempted:false,
      recalled_content_count:0,world_mutation_performed:false,
      world_truth_claimed:false,
    });

  const accessible=queryWorldSimulationMemoryAccessibility({
    world_state:snapshot.state,character:observer,memory_records:copy(memories),
    scene_id:snapshot.state?.scenes?.[memory.internal_provenance.scene_id]
      ? memory.internal_provenance.scene_id:null,
    perception:{scene_id:memory.internal_provenance.scene_id},
    simulation_time:snapshot.state.simulation_time,
  });
  const candidateRecords=array(accessible.result.candidate_memory_records);
  if(!candidateRecords.some(item=>item.memory_id===memory.memory_id)){
    const after=await getWorldSimulationState(sessionId,options);
    cas(input,after);
    return Object.freeze({
      version:worldSimulationReplyMemoryRecallVersion,
      status:"memory_not_currently_accessible",
      retrieval_attempted:true,recalled_content_count:0,
      world_mutation_performed:false,world_truth_claimed:false,
    });
  }
  const query=buildWorldSimulationMemoryRetrievalQuery({
    character:observer,turn_id:"reentry_"+memory.internal_provenance.turn_id,
    phase63b_version:accessible.memory_accessibility_version,
    candidate_memory_records:copy(candidateRecords),
    initial_cues:[{kind:"subjective_dialogue_recall",value:"prior_spoken_exchange"}],
    retrieval_goal:{kind:"memory_content",memory_id:memory.memory_id,
      requested_selectors:[{kind:"json_pointer",path:"/interpreted_content"}]},
  });
  const recovered=executeWorldSimulationMemoryRetrievalProcess({
    query,candidate_memory_records:copy(candidateRecords),
    resolution:{
      process_occurred:true,
      initiation:{mode:"deliberate",trigger_origin:"self_generated"},
      retrieval_task:{mode:"cued_recall"},
      contacted_candidate_refs:[memory.memory_id],
      recovered_selections:[{
        source_memory_ref:memory.memory_id,
        selector:{kind:"json_pointer",path:"/interpreted_content"},
        content_kind:"semantic_fragment",target_relation:"target_related",
      }],
    },
  });
  if(recovered.recovered_any_content!==true
    || recovered.target_outcome!=="satisfied"
    || recovered.recovered_memories.length!==1
    || recovered.recovered_memories[0].content!==memory.content.interpreted_content
    || recovered.recovered_memories[0].possibly_incorrect!==true)
    reject("WORLD_REPLY_RECALL_KERNEL_INVALID",
      "Only Phase63C's real grounded, uncertain source-memory fragment is admissible.");
  const remembered=recovered.recovered_memories[0];
  const assessment=await brainChoice({
    character:observer,
    cognition:{recovered_subjective_dialogue_fragment:{
      kind:"recovered_personal_interpretation",
      fragment:remembered.content,
      possibly_incorrect:true,
      subjective_not_world_truth:true,
      speaker_identity_not_proven:true,
      only_own_past_interpretation:true,
    }},
    boundaries:{
      stage:"decide_private_use_of_recalled_fragment",
      subjective_fragment_not_utterance_transcript:true,
      no_world_truth_authority:true,
      no_belief_adoption_authority:true,
      no_public_action_authority:true,
      no_memory_rewrite_authority:true,
      no_other_character_private_state:true,
    },
  },input,options);
  if(!record(assessment)||Object.keys(assessment).length!==1
    || !["consider_uncertain","ignore"].includes(assessment.decision))
    reject("WORLD_REPLY_RECALL_ASSESSMENT_INVALID",
      "Brain may privately consider or ignore a possibly mistaken recollection.");
  const after=await getWorldSimulationState(sessionId,options);
  cas(input,after);
  return Object.freeze({
    version:worldSimulationReplyMemoryRecallVersion,
    status:assessment.decision==="consider_uncertain"
      ?"private_uncertain_memory_considered":"private_memory_ignored",
    source_chain_verified:true,
    retrieval_attempted:true,recall_kernel:"phase63c",
    recalled_content_count:1,
    original_memory_kind:"subjective_spoken_reply_interpretation",
    semantic_truth_attested:false,confidence_inferred:false,
    belief_adopted:false,public_action_performed:false,
    memory_persistence_performed:false,world_mutation_performed:false,
    world_truth_claimed:false,
  });
}
