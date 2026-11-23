import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildWorldSimulationSubjectiveClaims }
  from "./world-simulation-subjective-claim-projection-service.mjs";
import { resolveWorldSimulationSubjectiveBeliefs }
  from "./world-simulation-subjective-belief-resolution-service.mjs";
import { buildWorldSimulationSubjectiveBeliefRevisions }
  from "./world-simulation-subjective-belief-revision-service.mjs";
import { buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue }
  from "./world-simulation-chronological-mutation-queue-service.mjs";

/**
 * Strict writer-side proof for one optional original-speaker subjective belief.
 *
 * Rebuilds Phase65A/65D/66A from the *newly staged Phase63A memory*, never
 * from an older remembered fragment or a claimed World transcript.
 * The World CAS + acoustic history source is checked by the state service.
 */
export function assertWorldSimulationReplySubjectiveBeliefCommit(input) {
  const {previous_world_state:previous,next_world_state:next,turn_id:turnId,
    commit:payload,metadata:meta,world_state_hash:oldHash}=input;
  const adoption=meta?.claim_adoption;
  const exists=x=>x!==null && x!==undefined;
  const same=(a,b)=>hashAgentRunValue(a??null)===hashAgentRunValue(b??null);
  const invalid=(why)=>{
    const error=new Error("Unverified reply subjective belief commit: "+why);
    error.code="WORLD_REPLY_BELIEF_COMMIT_INVALID";
    throw error;
  };
  if(!adoption){
    for(const field of ["subjective_claim_projection","subjective_claim_mutation_queue",
      "subjective_claim_mutation_execution","subjective_belief_resolution",
      "subjective_belief_revision_projection","subjective_belief_revision_mutation_queue",
      "subjective_belief_revision_mutation_execution"])
      if(exists(payload[field]))invalid("Unexpected Phase65/66 material without claim adoption.");
    return;
  }
  if(adoption.decision!=="propose_and_adopt_if_unopposed"
    || Object.keys(adoption).length!==11
    || !Object.values(adoption).every(value=>typeof value==="string"&&value.trim())
    || !Array.isArray(payload.state_transitions)
    || payload.state_transitions.length!==5
    || payload.state_transitions[0].field!=="memories."+meta.character
    || payload.state_transitions[0].time_ms!==0)
    invalid("An adopted subjective belief must be one explicitly authorized and temporally ordered pipeline.");

  const memory=next?.memories?.[meta.character]?.at(-1);
  if(!memory || memory.memory_id!==meta.memory_id
    || hashAgentRunValue(memory)!==meta.memory_hash
    || memory.internal_provenance?.turn_id!==turnId
    || memory.subjective_memory_not_world_truth!==true
    || memory.possibly_incorrect!==true)
    invalid("The evidence must be the one exact newly created private memory.");

  const memoryOnly=structuredClone(previous);
  memoryOnly.memories=memoryOnly.memories??{};
  memoryOnly.memories[meta.character]=structuredClone(payload.state_transitions[0].to);
  if(!same(memoryOnly.memories[meta.character],
    next.memories[meta.character]))invalid("Memory image mismatch.");

  const sourceClaim=payload.subjective_claim_projection?.result?.claim_events_created;
  if(!Array.isArray(sourceClaim)||sourceClaim.length!==1
    || sourceClaim[0].character!==meta.character
    || sourceClaim[0].source_turn_id!==turnId
    || !sourceClaim[0].proposition?.trim()
    || [...sourceClaim[0].proposition].length>400
    || sourceClaim[0].derivation?.proposal_ref
      !=="original_speaker_subjective_reply_interpretation"
    || !same(sourceClaim[0].proposition_hash,adoption.proposition_hash)
    || !same(sourceClaim[0].claim_event_hash,adoption.claim_event_hash)
    || sourceClaim[0].claim_event_id!==adoption.claim_event_id)
    invalid("Subjective claim is not tied to the original speaker's bounded proposition.");

  const proposed=buildWorldSimulationSubjectiveClaims({
    world_state:memoryOnly,turn_id:turnId,
    source_memory_records:[{character:meta.character,memory_record:memory}],
    claim_proposals:[{
      proposal_ref:"original_speaker_subjective_reply_interpretation",
      character:meta.character,proposition:sourceClaim[0].proposition,
      evidence:[{source_memory_ref:memory.memory_id,relation:"supports"}],
    }],
  });
  if(!same(proposed,payload.subjective_claim_projection)
    || !same(hashAgentRunValue(proposed),adoption.phase65a_projection_hash))
    invalid("Phase65A source-memory evidence projection diverged.");

  const resolved=resolveWorldSimulationSubjectiveBeliefs({
    world_state:proposed.result.preview_world_state,turn_id:turnId,
  });
  if(resolved.result.decisions.length!==1
    || resolved.result.decisions[0].action!=="adopt"
    || resolved.result.decisions[0].character!==meta.character
    || !same(resolved,payload.subjective_belief_resolution)
    || !same(hashAgentRunValue(resolved),adoption.phase65d_resolution_hash))
    invalid("Phase65D unopposed subjective decision diverged.");

  const revised=buildWorldSimulationSubjectiveBeliefRevisions({
    world_state:proposed.result.preview_world_state,turn_id:turnId,
    resolution:resolved.result,
  });
  if(revised.result.revision_events_created.length!==1
    || revised.result.revision_events_created[0].character!==meta.character
    || revised.result.revision_events_created[0].resolution_action!=="adopt"
    || revised.result.revision_events_created[0].belief_revision_event_id
      !==adoption.revision_event_id
    || !same(revised.result.revision_events_created[0].belief_revision_event_hash,
      adoption.revision_event_hash)
    || !same(revised,payload.subjective_belief_revision_projection)
    || !same(hashAgentRunValue(revised),adoption.phase66a_projection_hash)
    || !same(revised.result.preview_world_state,next))
    invalid("Phase66A revision cannot change unrelated World fields or beliefs.");

  const expected=[
    {...payload.state_transitions[0]},
    ...proposed.result.state_transitions.map(entry=>({...entry,time_ms:1})),
    ...revised.result.state_transitions.map(entry=>({...entry,time_ms:2})),
  ];
  if(!same(expected,payload.state_transitions))
    invalid("The exact canonical claim and revision transitions were not supplied.");
  const memoryQueue=buildWorldSimulationChronologicalMutationQueue({
    turn_id:turnId,world_state_hash:oldHash,
    state_transitions:[payload.state_transitions[0]],elapsed_ms:0,
  });
  if(memoryQueue.queue_hash!==meta.mutation_queue_hash
    || !same(memoryQueue,payload.subjective_memory_mutation_queue))
    invalid("Phase63A requires its exact independent memory queue.");
  const memoryExecution=executeWorldSimulationChronologicalMutationQueue({
    world_state:previous,preview_world_state:memoryOnly,
    queue:memoryQueue,scene_id:meta.scene_id,
  });
  if(!same(memoryExecution.next_world_state,memoryOnly)
    || !same(memoryExecution.execution,payload.subjective_memory_mutation_execution))
    invalid("Phase63A memory queue execution diverged.");

  const claimQueue=buildWorldSimulationChronologicalMutationQueue({
    turn_id:`${turnId}:subjective_claim`,
    world_state_hash:hashAgentRunValue(memoryOnly),
    state_transitions:proposed.result.state_transitions,elapsed_ms:0,
  });
  if(claimQueue.queue_hash!==adoption.phase65a_queue_hash
    || !same(claimQueue,payload.subjective_claim_mutation_queue))
    invalid("Phase65A requires its own exact source-turn claim queue.");
  const claimExecution=executeWorldSimulationChronologicalMutationQueue({
    world_state:memoryOnly,
    preview_world_state:proposed.result.preview_world_state,
    queue:claimQueue,scene_id:meta.scene_id,
  });
  if(!same(claimExecution.next_world_state,proposed.result.preview_world_state)
    || !same(claimExecution.execution,payload.subjective_claim_mutation_execution))
    invalid("Phase65A claim queue execution diverged.");

  const revisionQueue=buildWorldSimulationChronologicalMutationQueue({
    turn_id:`${turnId}:subjective_belief_revision`,
    world_state_hash:hashAgentRunValue(proposed.result.preview_world_state),
    state_transitions:revised.result.state_transitions,elapsed_ms:0,
  });
  if(revisionQueue.queue_hash!==adoption.phase66a_queue_hash
    || !same(revisionQueue,payload.subjective_belief_revision_mutation_queue))
    invalid("Phase66A requires its exact source-turn revision queue.");
  const revisionExecution=executeWorldSimulationChronologicalMutationQueue({
    world_state:proposed.result.preview_world_state,
    preview_world_state:next,queue:revisionQueue,
    scene_id:meta.scene_id,
  });
  if(!same(revisionExecution.next_world_state,next)
    || !same(revisionExecution.execution,
      payload.subjective_belief_revision_mutation_execution))
    invalid("Phase66A adopted belief queue execution diverged.");
  if(exists(payload.chronological_mutation_queue)
    || exists(payload.chronological_mutation_execution))
    invalid("Three source-scoped queues must not be disguised as one chronological queue.");

}
