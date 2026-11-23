import { hashAgentRunValue } from "./agent-run-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory, commitWorldSimulationTurn }
  from "./world-simulation-state-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission }
  from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { runWorldSimulationCommittedReplySpeakerLexicalMeaning }
  from "./world-simulation-committed-reply-speaker-lexical-meaning-service.mjs";
import { formWorldSimulationSubjectiveMemories }
  from "./world-simulation-subjective-memory-formation-service.mjs";
import { buildWorldSimulationSubjectiveClaims }
  from "./world-simulation-subjective-claim-projection-service.mjs";
import { resolveWorldSimulationSubjectiveBeliefs }
  from "./world-simulation-subjective-belief-resolution-service.mjs";
import { buildWorldSimulationSubjectiveBeliefRevisions }
  from "./world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationReplySubjectiveMemoryVersion =
  "world-reply-subjective-dialogue-memory-v1";

const array = x => Array.isArray(x) ? x : [];
const record = x => x !== null && typeof x === "object" && !Array.isArray(x);
const copy = x => JSON.parse(JSON.stringify(x ?? null));
function reject(code,message) {const e=new Error(message);e.code=code;throw e;}
function exactCas(input,snapshot) {
  if(!Number.isSafeInteger(input.expected_revision)
    || snapshot.revision!==input.expected_revision
    || snapshot.state_hash!==input.expected_state_hash)
    reject("WORLD_REPLY_MEMORY_WORLD_STALE",
      "A private interpreted reply can be encoded only on its original World CAS.");
}
async function invokeBrain(packet,input,options) {
  let calls=0, brainResult, callbackError=null;
  const callback=async incoming=>{
    try{
      if(++calls!==1 || incoming?.character!==input.observer
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_REPLY_MEMORY_BRAIN_PACKET_INVALID",
          "Only the exact original-speaker Brain may decide whether to encode memory.");
      const fresh=await getWorldSimulationState(input.world_simulation_session_id,options);
      exactCas(input,fresh);
      if(!projectWorldSimulationConsciousCognitionAdmission(fresh.state,input.observer).admitted)
        reject("WORLD_REPLY_MEMORY_CHARACTER_ASLEEP",
          "Sleeping characters cannot consciously encode a dialogue interpretation.");
      brainResult=await options.characterBrain(copy(incoming));
      return brainResult;
    }catch(error){callbackError=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn)
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:input.world_simulation_session_id,
      character:input.observer,brain_input:copy(packet),characterBrain:callback,
    },options);
  else await callback(packet);
  if(callbackError)throw callbackError;
  if(calls!==1)reject("WORLD_REPLY_MEMORY_BRAIN_NOT_INVOKED",
    "Encoding must be explicitly decided by the actual Character Brain.");
  if(!record(brainResult)
    || Object.keys(brainResult).length!==1
    || !["encode","do_not_encode"].includes(brainResult.decision))
    reject("WORLD_REPLY_MEMORY_ENCODING_DECISION_INVALID",
      "Brain may only encode its interpretation or choose not to remember it.");
  return brainResult.decision;
}


async function invokeClaimBrain(packet,input,options) {
  let calls=0,answer,callbackError=null;
  const callback=async incoming=>{
    try{
      if(++calls!==1 || incoming?.character!==input.observer
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_REPLY_CLAIM_BRAIN_PACKET_INVALID",
          "Subjective claim proposals belong to the exact original speaker.");
      const fresh=await getWorldSimulationState(input.world_simulation_session_id,options);
      exactCas(input,fresh);
      if(!projectWorldSimulationConsciousCognitionAdmission(fresh.state,input.observer).admitted)
        reject("WORLD_REPLY_CLAIM_CHARACTER_ASLEEP",
          "Only conscious original-speaker cognition may propose a private claim.");
      answer=await options.characterBrain(copy(incoming));
      return answer;
    }catch(error){callbackError=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn)
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:input.world_simulation_session_id,
      character:input.observer,brain_input:copy(packet),characterBrain:callback,
    },options);
  else await callback(packet);
  if(callbackError)throw callbackError;
  if(calls!==1)reject("WORLD_REPLY_CLAIM_BRAIN_NOT_INVOKED",
    "A real original-speaker Brain decision is required.");
  if(!record(answer))
    reject("WORLD_REPLY_CLAIM_PROPOSAL_INVALID","Claim decision must be an object.");
  if(answer.decision==="do_not_propose" && Object.keys(answer).length===1)
    return {decision:"do_not_propose",proposition:null};
  if(answer.decision!=="propose_and_adopt_if_unopposed"
    || Object.keys(answer).length!==2
    || typeof answer.proposition!=="string"
    || !answer.proposition.trim()
    || [...answer.proposition.trim()].length>400)
    reject("WORLD_REPLY_CLAIM_PROPOSAL_INVALID",
      "Only an explicit, bounded, Brain-owned subjective proposition can be considered.");
  return {decision:answer.decision,proposition:answer.proposition.trim()};
}

/**
 * A real listener's reply, heard by the original speaker, may become ONE
 * new, possibly mistaken subjective auditory memory. Reuses CC7J/CC7K
 * cognition and the canonical Phase63A memory encoder + World mutation queue.
 * A separate Brain decision owns encoding. Engine does not adopt a World
 * fact, rewrite a belief, or claim psychological consolidation.
 */
export async function runWorldSimulationCommittedReplySubjectiveMemory(
  input={},options={},
) {
  if(typeof options.characterBrain!=="function")
    reject("WORLD_REPLY_MEMORY_BRAIN_REQUIRED","Real Character Brain is mandatory.");
  const originalBrain=options.characterBrain;
  let acceptedMeaning=null;
  const meaningResult=await runWorldSimulationCommittedReplySpeakerLexicalMeaning(
    input,{...options,characterBrain:async packet=>{
      const result=await originalBrain(copy(packet));
      if(packet.cognition?.observer_meaning_interpretation){
        if(acceptedMeaning!==null)
          reject("WORLD_REPLY_MEMORY_MEANING_AMBIGUOUS",
            "The bounded first-fragment bridge permits one meaning response.");
        acceptedMeaning=copy(result);
      }
      return result;
    }},
  );
  if(meaningResult.meaning_interpretation_count!==1
    || !record(acceptedMeaning)
    || typeof acceptedMeaning.interpreted_content!=="string"
    || !acceptedMeaning.interpreted_content.trim())
    return Object.freeze({
      version:worldSimulationReplySubjectiveMemoryVersion,
      status:"no_validated_subjective_interpretation",committed:false,
      memory_encoded:false,belief_revised:false,world_truth_claimed:false,
    });

  const [before,history]=await Promise.all([
    getWorldSimulationState(input.world_simulation_session_id,options),
    getWorldSimulationHistory(input.world_simulation_session_id,options),
  ]);
  exactCas(input,before);
  if(history.world_simulation_session_id!==input.world_simulation_session_id
    || array(history.turns).length!==before.revision
    || array(before.state.event_queue).length)
    reject("WORLD_REPLY_MEMORY_WORLD_PRIORITY_INVALID",
      "An eventless memory encoding must preserve queue and World history priority.");
  const source=array(history.turns).at(-1);
  const sourceMeta=source?.autonomous_listener_clarification_reply;
  if(source?.turn_id!==input.source_turn_id
    || sourceMeta?.version!=="world-listener-clarification-causal-reply-v1"
    || sourceMeta.source_character!==input.observer)
    reject("WORLD_REPLY_MEMORY_SOURCE_INVALID",
      "Only the original speaker's current source-verified reply is encodable.");
  const admissions=array(source.communication_observer_increment_admissions)
    .filter(item=>item?.observer===input.observer
      && item?.admission_status==="heard_acoustic_cues_only"
      && item?.audit?.source_action_id===sourceMeta.action_id
      && item?.audit?.source_speaker===sourceMeta.character
      && record(item.observer_increment))
    .sort((a,b)=>a.release_time_ms-b.release_time_ms);
  if(!admissions.length)
    reject("WORLD_REPLY_MEMORY_SOURCE_INVALID",
      "No actually released reply sound belongs to this original speaker.");
  const observedIncrementRef=admissions[0].observer_increment.increment_ref;
  const subjectiveMeaning=acceptedMeaning.interpreted_content.trim();
  if([...subjectiveMeaning].length>1200)
    reject("WORLD_REPLY_MEMORY_CONTENT_UNBOUNDED","Interpreted content is unbounded.");
  const encodedDecision=await invokeBrain({
    character:input.observer,
    cognition:{
      subjective_reply_memory_candidate:{
        kind:"uncertain_personal_interpretation_of_heard_speech",
        interpreted_content:subjectiveMeaning,
        interpretation_status:acceptedMeaning.interpretation_status,
        possibly_incorrect:true,
        source_utterance_verified:false,
      },
    },
    boundaries:{
      source:"source_authenticated_reply_subjective_meaning_only",
      selection:"encode_or_do_not_encode",
      source_transcript_exposed:false,
      real_speaker_identity_exposed:false,
      other_character_private_state_exposed:false,
      world_truth_authority:false,
      belief_write_authority:false,
      direct_memory_record_write_authority:false,
      same_turn_action_selection_authority:false,
    },
  },input,options);
  if(encodedDecision==="do_not_encode")
    return Object.freeze({
      version:worldSimulationReplySubjectiveMemoryVersion,
      status:"character_declined_encoding",committed:false,
      memory_encoded:false,belief_revised:false,world_truth_claimed:false,
    });

  const sessionId=input.world_simulation_session_id;
  const character=input.observer;
  const sourceHash=hashAgentRunValue(source);
  const turnId="world_reply_memory_"+hashAgentRunValue({
    sessionId,source_turn_id:source.turn_id,source_hash:sourceHash,
    character,observed_increment_ref:observedIncrementRef,
  }).slice(0,24);
  const context={
    world_state:before.state,
    turn_id:turnId,
    event:{event_id:turnId,scene_id:sourceMeta.scene_id},
    decision_packets:[{
      character,
      perception:{
        simulation_time:before.state.simulation_time,
        scene_id:sourceMeta.scene_id,
        observed:[],other_senses:[],
        audible:[{
          kind:"subjective_spoken_reply_interpretation",
          interpreted_content:subjectiveMeaning,
          interpretation_status:acceptedMeaning.interpretation_status,
          lexical_comprehension_is_subjective:true,
          source_utterance_verified:false,
          speaker_identity_recognized:false,
          world_truth_claimed:false,
          possibly_incorrect:true,
        }],
      },
    }],
    encoding_decisions:[{
      character,sense:"auditory",sense_index:0,decision:"encode",
      source:"explicit_original_speaker_character_brain_decision",
    }],
  };
  const formed=formWorldSimulationSubjectiveMemories(context);
  const made=array(formed.result.character_updates)
    .filter(item=>item.character===character)
    .flatMap(item=>array(item.memory_records));
  const memoryTransitions=array(formed.result.memory_transitions);
  if(formed.result.created_memory_count!==1 || made.length!==1
    || memoryTransitions.length!==1
    || made[0]?.content?.kind!=="subjective_spoken_reply_interpretation"
    || made[0]?.possibly_incorrect!==true
    || made[0]?.subjective_memory_not_world_truth!==true)
    reject("WORLD_REPLY_MEMORY_CANONICAL_FORMATION_INVALID",
      "The canonical Phase63A memory encoder must generate one uncertain auditory memory.");

  let preview=copy(before.state);
  if(!record(preview.memories))preview.memories={};
  preview.memories[character]=copy(memoryTransitions[0].to);
  const transitions=memoryTransitions.map(item=>({...item,time_ms:0}));
  let subjectiveClaim=null, beliefResolution=null, beliefRevision=null;
  let adoption=null;
  if(input.enable_subjective_reply_claim===true){
    const choice=await invokeClaimBrain({
      character,
      cognition:{subjective_reply_claim_opportunity:{
        kind:"source_pinned_personal_interpretation",
        own_interpretation:subjectiveMeaning,
        possibly_incorrect:true,
        memory_just_encoded:true,
        proposal_optional:true,
        adoption_if_unopposed_requires_explicit_opt_in:true,
      }},
      boundaries:{
        same_turn_new_subjective_memory_only:true,
        source_is_own_interpretation_not_speaker_intent:true,
        other_character_private_state_exposed:false,
        world_state_exposed:false,
        factual_truth_authority:false,
        confidence_probability_authority:false,
        direct_belief_write_authority:false,
        direct_memory_write_authority:false,
        same_turn_action_authority:false,
        possible_challenge_or_revision_not_precluded:true,
      },
    },input,options);
    if(choice.decision==="propose_and_adopt_if_unopposed"){
      subjectiveClaim=buildWorldSimulationSubjectiveClaims({
        world_state:preview,turn_id:turnId,
        source_memory_records:[{character,memory_record:made[0]}],
        claim_proposals:[{
          proposal_ref:"original_speaker_subjective_reply_interpretation",
          character,proposition:choice.proposition,
          evidence:[{source_memory_ref:made[0].memory_id,relation:"supports"}],
        }],
      });
      if(subjectiveClaim.result.claim_events_created.length!==1
        || subjectiveClaim.result.already_persisted_claim_event_ids.length!==0)
        reject("WORLD_REPLY_CLAIM_PROJECTION_INVALID",
          "One original-speaker claim must be minted from one same-turn memory.");
      beliefResolution=resolveWorldSimulationSubjectiveBeliefs({
        world_state:subjectiveClaim.result.preview_world_state,turn_id:turnId,
      });
      if(beliefResolution.result.decisions.length!==1
        || beliefResolution.result.decisions[0].action!=="adopt"
        || beliefResolution.result.decisions[0].character!==character)
        reject("WORLD_REPLY_CLAIM_RESOLUTION_INVALID",
          "Only an unopposed Phase65D subjective adoption is in this integration scope.");
      beliefRevision=buildWorldSimulationSubjectiveBeliefRevisions({
        world_state:subjectiveClaim.result.preview_world_state,
        turn_id:turnId,resolution:beliefResolution.result,
      });
      if(beliefRevision.result.revision_events_created.length!==1
        || beliefRevision.result.revision_events_created[0].character!==character
        || beliefRevision.result.revision_events_created[0].resolution_action!=="adopt")
        reject("WORLD_REPLY_CLAIM_REVISION_INVALID",
          "Phase66A must append one same-character adopted subjective revision.");
      preview=copy(beliefRevision.result.preview_world_state);
      transitions.push(...subjectiveClaim.result.state_transitions.map(
        item=>({...item,time_ms:1})));
      transitions.push(...beliefRevision.result.state_transitions.map(
        item=>({...item,time_ms:2})));
      const claimEvent=subjectiveClaim.result.claim_events_created[0];
      const revisionEvent=beliefRevision.result.revision_events_created[0];
      adoption={
        decision:choice.decision,
        proposition_hash:hashAgentRunValue(choice.proposition),
        claim_event_id:claimEvent.claim_event_id,
        claim_event_hash:claimEvent.claim_event_hash,
        revision_event_id:revisionEvent.belief_revision_event_id,
        revision_event_hash:revisionEvent.belief_revision_event_hash,
        phase65a_projection_hash:hashAgentRunValue(subjectiveClaim),
        phase65d_resolution_hash:hashAgentRunValue(beliefResolution),
        phase66a_projection_hash:hashAgentRunValue(beliefRevision),
      };
    }
  }
  const queue=buildWorldSimulationChronologicalMutationQueue({
    turn_id:turnId,world_state_hash:before.state_hash,
    state_transitions:transitions,elapsed_ms:2,
  });
  const applied=executeWorldSimulationChronologicalMutationQueue({
    world_state:before.state,preview_world_state:preview,
    queue,scene_id:sourceMeta.scene_id,
  });
  if(hashAgentRunValue(applied.next_world_state)!==hashAgentRunValue(preview))
    reject("WORLD_REPLY_MEMORY_QUEUE_DIVERGED",
      "Authoritative mutation executor and Phase63A preview disagree.");
  const fresh=await getWorldSimulationState(sessionId,options);
  exactCas(input,fresh);
  const marker={
    version:worldSimulationReplySubjectiveMemoryVersion,
    character,source_turn_id:source.turn_id,
    source_turn_hash:sourceHash,source_revision_to:source.revision_to,
    source_action_id:sourceMeta.action_id,source_character:sourceMeta.character,
    scene_id:sourceMeta.scene_id,observer_increment_ref:observedIncrementRef,
    memory_id:made[0].memory_id,memory_hash:hashAgentRunValue(made[0]),
    interpreted_content_hash:hashAgentRunValue(subjectiveMeaning),
    interpretation_status:acceptedMeaning.interpretation_status,
    phase63a_result_hash:formed.audit.result_hash,
    mutation_queue_hash:queue.queue_hash,
    ...(adoption ? {claim_adoption:adoption} : {}),
  };
  const committed=await commitWorldSimulationTurn(sessionId,{
    expected_revision:before.revision,expected_state_hash:before.state_hash,
    turn_id:turnId,next_world_state:applied.next_world_state,event:null,
    selected_action_intents:[],action_outcomes:[],state_transitions:transitions,
    subjective_memory_formation:formed,
    subjective_memory_mutation_queue:queue,
    subjective_memory_mutation_execution:applied.execution,
    ...(subjectiveClaim ? {
      subjective_claim_projection:subjectiveClaim,
      subjective_claim_mutation_queue:queue,
      subjective_claim_mutation_execution:applied.execution,
      subjective_belief_resolution:beliefResolution,
      subjective_belief_revision_projection:beliefRevision,
      subjective_belief_revision_mutation_queue:queue,
      subjective_belief_revision_mutation_execution:applied.execution,
    } : {}),
    chronological_mutation_queue:queue,
    chronological_mutation_execution:applied.execution,
    autonomous_reply_subjective_memory_encoding:marker,
  },options);
  return Object.freeze({
    version:worldSimulationReplySubjectiveMemoryVersion,
    status:"subjective_reply_memory_committed",
    committed:true,memory_encoded:true,memory_id:made[0].memory_id,
    turn_id:turnId,revision:committed.state.revision,
    source_turn_id:source.turn_id,
    possibly_incorrect:true,fully_consolidated:false,
    belief_revised:adoption!==null,
    subjective_claim_adopted:adoption!==null,
    belief_revision_event_id:adoption?.revision_event_id??null,
    world_truth_claimed:false,
    public_action_performed:false,
  });
}
