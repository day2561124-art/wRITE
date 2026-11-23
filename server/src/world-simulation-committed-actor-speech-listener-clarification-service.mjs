import { hashAgentRunValue } from "./agent-run-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory, commitWorldSimulationTurn } from "./world-simulation-state-service.mjs";
import { runWorldSimulationCommittedActorSpeechListenerCognition } from "./world-simulation-committed-actor-speech-listener-ingress-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission } from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { runWorldSimulationNativeCapability } from "./world-simulation-neural-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { adjudicateWorldSimulationCausality } from "./world-simulation-causal-rule-engine.mjs";

export const worldSimulationListenerClarificationVersion =
  "world-listener-clarification-causal-reply-v1";

const array = value => Array.isArray(value) ? value : [];
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const copy = value => JSON.parse(JSON.stringify(value ?? null));

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function same(a, b) {
  return typeof a === "string" && typeof b === "string"
    && a.trim().toLocaleLowerCase("zh-Hant-TW") === b.trim().toLocaleLowerCase("zh-Hant-TW");
}
function exact(recordValue, actor) {
  const values = Object.entries(record(recordValue)).filter(([name]) => same(name,actor));
  return values.length === 1 ? values[0][1] : null;
}
function assertCas(input, snapshot) {
  if (!Number.isSafeInteger(input.expected_revision)
    || typeof input.expected_state_hash !== "string"
    || snapshot.revision !== input.expected_revision
    || snapshot.state_hash !== input.expected_state_hash)
    reject("WORLD_LISTENER_REPLY_WORLD_STALE",
      "The listener reply must use the current committed World revision and hash.");
}
function assertWorkPriority(world, source) {
  if (array(world.event_queue).length)
    reject("WORLD_LISTENER_REPLY_QUEUED_EVENT_PRECEDENCE",
      "A queued external event has priority over voluntary clarification.");
  if (Object.values(record(world.projectiles)).some(item => item?.active === true)
    || Object.values(record(world.ability_fields)).some(item => item?.active === true))
    reject("WORLD_LISTENER_REPLY_PHYSICAL_CONFLICT",
      "A pending physical process prevents this autonomous reply.");
  // The one source sound is the cue being answered. All unrelated sounds
  // must still take their own normal perception turn, not be skipped.
  const sounds = array(world.sound_events);
  if (sounds.some(item => item?.schema_version !== "cc6b-communication-acoustic-bridge-v1"
    || item?.created_turn_id !== source.turn_id
    || item?.communication_action_id !== source.autonomous_actor_initiated_action.action_id
    || !same(item?.source_entity_id,source.autonomous_actor_initiated_action.character)))
    reject("WORLD_LISTENER_REPLY_ACOUSTIC_CONFLICT",
      "Unrelated acoustic work must not be bypassed by a listener reply.");
}
function sameTrustedCandidate(source, proposed) {
  const base=record(source), normalized=record(proposed);
  const optional=new Set([
    "prerequisites","known_costs","blocked_by",
    "duration_estimate","duration_ms","duration_s",
    "target","target_position","movement","door_interaction",
    "object_interaction","attack","defense","projectile","ability",
    "communication","resource_commitment",
  ]);
  if (Object.keys(normalized).some(key=>!Object.hasOwn(base,key)
    && (!optional.has(key)
      || !(normalized[key]===null
        || (Array.isArray(normalized[key]) && normalized[key].length===0)))))
    return false;
  return Object.entries(base).every(([key,value])=>
    Object.hasOwn(normalized,key)
    && hashAgentRunValue(normalized[key])===hashAgentRunValue(value));
}
function sceneFor(world, listener, sourceActor, sourceScene) {
  const scenes=Object.entries(record(world.scenes)).filter(([sceneId,scene])=>{
    const positions=record(scene?.entity_positions);
    const listenerPosition=exact(positions,listener);
    const actorPosition=exact(positions,sourceActor);
    return sceneId===sourceScene
      && listenerPosition && actorPosition
      && Number.isFinite(listenerPosition.x) && Number.isFinite(listenerPosition.y)
      && Number.isFinite(actorPosition.x) && Number.isFinite(actorPosition.y);
  });
  if (scenes.length!==1)
    reject("WORLD_LISTENER_REPLY_SCENE_UNRESOLVED",
      "The current listener and source actor must share the source scene.");
  // Acoustic detection alone does not identify a speaker. The first slice
  // is intentionally limited to a two-character scene: in a group, filtering
  // the action menu to the engine-known source actor would leak identity.
  const positions=record(scenes[0][1].entity_positions);
  const presentCharacters=Object.entries(positions).filter(([name,point])=>
    exact(world.characters,name)
    && point && Number.isFinite(point.x) && Number.isFinite(point.y));
  if(presentCharacters.length!==2)
    reject("WORLD_LISTENER_REPLY_MULTIPARTY_UNSUPPORTED",
      "Nonlexical hearing cannot identify which of several visible characters spoke.");
  return scenes[0][0];
}
async function chooseWithBrain(packet, input, options) {
  let calls=0, errorDuringCallback=null, actualBrainResult;
  const callback=async incoming=>{
    try{
      if (++calls!==1 || incoming?.character!==input.observer
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_LISTENER_REPLY_BRAIN_IDENTITY_INVALID",
          "Runtime must preserve the exact listener, decision packet and single Brain invocation.");
      const current=await getWorldSimulationState(input.world_simulation_session_id,options);
      assertCas(input,current);
      if (!projectWorldSimulationConsciousCognitionAdmission(current.state,input.observer).admitted)
        reject("WORLD_LISTENER_REPLY_LISTENER_ASLEEP",
          "Sleeping listener cannot decide to reply.");
      actualBrainResult=await options.characterBrain(copy(incoming));
      return actualBrainResult;
    } catch(error) {errorDuringCallback=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn) {
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:input.world_simulation_session_id,
      character:input.observer,
      brain_input:copy(packet),
      characterBrain:callback,
    },options);
  } else await callback(packet);
  if(errorDuringCallback) throw errorDuringCallback;
  if(calls!==1)
    reject("WORLD_LISTENER_REPLY_BRAIN_NOT_INVOKED",
      "Listener Brain must make its own explicit action decision.");
  // A custom Runtime cannot replace the result returned by the actual Brain.
  return actualBrainResult;
}

/**
 * Source-authenticated listener hearing -> independent listener action choice
 * -> canonical World adjudication. The first Brain pass is private perception;
 * the second is a fresh explicit World candidate choice. Hearing alone cannot
 * authorize answering the semantic question, and neither pass authors facts.
 *
 * This first slice is a same-scene clarification opportunity only: replies
 * must be existing World-owned speech candidates addressed to the source actor.
 * The World never chooses a candidate if the Brain declines.
 */
export async function runWorldSimulationCommittedActorSpeechListenerClarification(
  input = {}, options = {},
) {
  if(typeof options.characterBrain!=="function")
    reject("WORLD_LISTENER_REPLY_CHARACTER_BRAIN_REQUIRED",
      "Listener response requires a real Character Brain.");
  if(options.causalAdjudicator!==undefined)
    reject("WORLD_LISTENER_REPLY_CUSTOM_CAUSAL_FORBIDDEN",
      "Listener responses use only canonical World causal rules.");

  let heard=null;
  const cognition=await runWorldSimulationCommittedActorSpeechListenerCognition(
    input,{...options,characterBrain:async packet=>{
      const result=await options.characterBrain(packet);
      heard=copy(packet.cognition?.committed_acoustic_observation);
      return result;
    }},
  );
  if(!cognition.character_brain_invoked) return Object.freeze({
    version:worldSimulationListenerClarificationVersion,status:"no_authenticated_hearing",
    committed:false,public_reply_emitted:false,
  });
  if(cognition.source_proof_verified!==true || !heard?.increment_ref
    || heard.content_understood!==false || heard.speaker_identity_recognized!==false)
    reject("WORLD_LISTENER_REPLY_UNVERIFIED_HEARING",
      "Only the exact authenticated nonlexical acoustic cue can initiate clarification.");

  const sessionId=input.world_simulation_session_id;
  const listener=input.observer;
  const [before,history]=await Promise.all([
    getWorldSimulationState(sessionId,options),
    getWorldSimulationHistory(sessionId,options),
  ]);
  assertCas(input,before);
  const source=array(history.turns).at(-1);
  if(history.world_simulation_session_id!==sessionId
    || array(history.turns).length!==before.revision
    || source?.turn_id!==input.source_turn_id
    || source?.autonomous_actor_initiated_action?.version!=="world-actor-initiated-speech-v1"
    || source?.autonomous_actor_initiated_action?.character===listener)
    reject("WORLD_LISTENER_REPLY_SOURCE_NOT_CURRENT",
      "Reply is restricted to the latest authenticated actor speech.");
  const sourceMeta=source.autonomous_actor_initiated_action;
  const admission=array(source.communication_observer_increment_admissions)
    .filter(item=>item?.observer===listener
      && item?.observer_increment?.increment_ref===heard.increment_ref
      && item?.admission_status==="heard_acoustic_cues_only");
  if(admission.length!==1)
    reject("WORLD_LISTENER_REPLY_HEARING_MISMATCH",
      "The selected acoustic increment must belong to this listener.");
  assertWorkPriority(before.state,source);
  if(!projectWorldSimulationConsciousCognitionAdmission(before.state,listener).admitted)
    reject("WORLD_LISTENER_REPLY_LISTENER_ASLEEP","Listener must remain awake.");
  const speaker=sourceMeta.character;
  const sceneId=sceneFor(before.state,listener,speaker,sourceMeta.scene_id);
  const catalog=array(exact(before.state.available_actions,listener));
  if(catalog.length>24)
    reject("WORLD_LISTENER_REPLY_CATALOG_UNBOUNDED","Reply action catalog is unbounded.");
  const ids=new Set(), candidates=[];
  for(const action of catalog){
    if(typeof action?.action_id!=="string" || !action.action_id
      || typeof action.intent!=="string" || !action.intent
      || ids.has(action.action_id))
      reject("WORLD_LISTENER_REPLY_CATALOG_INVALID",
        "World action candidates must have distinct bounded identities.");
    ids.add(action.action_id);
    if(action.communication?.channel==="speech"
      && same(action.communication?.addressee,speaker)
      && action.communication?.message?.speech_act==="inform_or_request"
      && action.communication?.world_truth_claimed===false)
      candidates.push(copy(action));
  }
  if(!candidates.length) return Object.freeze({
    version:worldSimulationListenerClarificationVersion,
    status:"no_world_grounded_clarification_candidate",
    committed:false,public_reply_emitted:false,
  });

  const proposal=await runWorldSimulationNativeCapability("world_action_proposer",{
    character:listener,available_actions:copy(candidates),
    cognition:{
      committed_acoustic_observation:copy(heard),
      clarification_only:true,
      lexical_understanding_attested:false,
      speaker_identity_from_sound_inferred:false,
      current_goal:exact(before.state.characters,listener)?.current_goal??null,
    },
    current_action:exact(before.state.characters,listener)?.current_action??null,
  },{...options,run_id:sessionId,source:"cb_c4_listener_clarification"});
  const proposed=record(proposal.output?.character_view??proposal.output);
  const menu=array(proposed.candidate_action_intents);
  if(!menu.length) return Object.freeze({
    version:worldSimulationListenerClarificationVersion,
    status:"no_admitted_clarification_candidates",
    committed:false,public_reply_emitted:false,
  });
  const proposedIds=new Set();
  for(const item of menu){
    const trusted=candidates.find(c=>c.action_id===item?.action_id);
    if(!trusted || proposedIds.has(item.action_id)
      || !sameTrustedCandidate(trusted,item))
      reject("WORLD_LISTENER_REPLY_CATALOG_TAMPERED",
        "Native proposer must not create, duplicate or alter World speech candidates.");
    proposedIds.add(item.action_id);
  }
  const packet={
    character:listener,
    cognition:{
      committed_acoustic_observation:copy(heard),
      clarification_opportunity:{
        source:"verified_listener_acoustic_release",
        lexical_meaning_understood:false,
        original_speaker_from_sound_identified:false,
        reply_allowed_to_known_visible_scene_actor:true,
      },
    },
    candidate_action_intents:copy(menu),
    boundaries:{
      external_world_event_present:false,
      action_choice_owner:"character_brain",
      causal_result_owner:"world_simulation_causal_rule_engine",
      world_truth_exposed:false,
      speaker_identity_exposed_by_acoustic_cue:false,
      source_transcript_exposed:false,
      other_observer_cues_exposed:false,
      clarification_not_an_answer:true,
    },
  };
  const response=record(await chooseWithBrain(packet,input,options));
  if(["goal_intents","plan_intents","world_state","world_truth",
      "selected_action_intents","action_intents"].some(k=>Object.hasOwn(response,k)))
    reject("WORLD_LISTENER_REPLY_MIXED_WRITES_UNSUPPORTED",
      "Reply choice may not claim another World writer or update beliefs.");
  const actionId=response.action_id;
  if(actionId==null || actionId==="reject_all")
    return Object.freeze({
      version:worldSimulationListenerClarificationVersion,
      status:"listener_declined_clarification",
      committed:false,public_reply_emitted:false,
    });
  if(typeof actionId!=="string" || !actionId.trim())
    reject("WORLD_LISTENER_REPLY_INVALID_SELECTION",
      "An explicit World candidate action ID is required.");
  const candidate=menu.find(item=>item.action_id===actionId);
  const trusted=candidates.find(item=>item.action_id===actionId);
  if(!candidate || !trusted || !sameTrustedCandidate(trusted,candidate))
    reject("WORLD_LISTENER_REPLY_ACTION_NOT_AVAILABLE",
      "The listener attempted to select an untrusted reply action.");
  const selected=[{
    character:listener,selection:"candidate_action_intent",
    action_id:actionId,intent:trusted.intent??null,candidate:copy(trusted),
  }];
  const sourceHash=hashAgentRunValue(source);
  const turnId="world_listener_reply_"+hashAgentRunValue({
    session_id:sessionId,source_turn_hash:sourceHash,
    listener,increment_ref:heard.increment_ref,
    action_id:actionId,
  }).slice(0,24);
  const receipt=buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id:sessionId,turn_id:turnId,
    state_revision:before.revision,world_state_hash:before.state_hash,
    decision_packets:[packet],selected_action_intents:selected,
  });
  const current=await getWorldSimulationState(sessionId,options);
  assertCas(input,current);
  assertWorkPriority(current.state,source);
  const causal=await adjudicateWorldSimulationCausality({
    world_simulation_session_id:sessionId,turn_id:turnId,
    world_state:copy(before.state),world_state_revision:before.revision,
    world_state_hash:before.state_hash,
    event:{
      event_id:turnId,scene_id:sceneId,
      type:"actor_initiated_speech_causal_context",
      simulation_time:before.state.simulation_time,participants:[listener],
    },
    selected_action_intents:copy(selected),
  });
  const outcome=array(causal.action_outcomes).filter(item=>
    item?.actor===listener && item?.action_id===actionId
      && item?.result==="communication_emitted"
      && item?.communication_event?.channel==="speech"
      && item?.communication_event?.world_truth_claimed===false);
  if(outcome.length!==1)
    reject("WORLD_LISTENER_REPLY_CAUSAL_SPEECH_MISSING",
      "A listener reply requires one real World speech outcome.");
  const critic=await runWorldSimulationNativeCapability("world_consistency_critic",{
    state_transitions:array(causal.state_transitions),
    object_holders:array(causal.object_holders),
    knowledge_transitions:array(causal.knowledge_transitions),
    action_outcomes:array(causal.action_outcomes),
  },{...options,run_id:sessionId,source:"cb_c4_listener_reply_consistency"});
  const gate=record(critic.output?.commit_gate_view??critic.output);
  if((gate.hard_conflict_count??0)>0)
    return Object.freeze({
      version:worldSimulationListenerClarificationVersion,
      status:"world_consistency_conflict",
      committed:false,public_reply_emitted:false,
    });
  const result=await commitWorldSimulationTurn(sessionId,{
    expected_revision:before.revision,expected_state_hash:before.state_hash,
    turn_id:turnId,next_world_state:causal.next_world_state,event:null,
    selected_action_intents:selected,
    subjective_choice_commitment_receipts:copy(receipt),
    communication_observer_increment_admissions:
      copy(causal.communication_observer_increment_admissions??[]),
    state_transitions:array(causal.state_transitions),
    action_outcomes:array(causal.action_outcomes),
    knowledge_transitions:array(causal.knowledge_transitions),
    scheduled_events:array(causal.scheduled_events),
    causal_timeline:causal.causal_timeline??null,
    chronological_mutation_queue:causal.chronological_mutation_queue,
    chronological_mutation_execution:causal.chronological_mutation_execution,
    causal_resolution_id:causal.causal_resolution_id,
    autonomous_listener_clarification_reply:{
      version:worldSimulationListenerClarificationVersion,
      character:listener,scene_id:sceneId,action_id:actionId,
      causal_resolution_id:causal.causal_resolution_id,
      source_turn_id:source.turn_id,source_turn_hash:sourceHash,
      source_revision_to:source.revision_to,
      source_character:speaker,source_action_id:sourceMeta.action_id,
      observer_increment_ref:heard.increment_ref,
    },
  },options);
  return Object.freeze({
    version:worldSimulationListenerClarificationVersion,
    status:"listener_clarification_world_committed",
    committed:true,public_reply_emitted:true,
    turn_id:turnId,revision:result.state.revision,
    source_turn_id:source.turn_id,
    original_source_preserved:true,
    action_id:actionId,
    content_understood:false,information_verified:false,
    external_world_event_created:false,
  });
}
