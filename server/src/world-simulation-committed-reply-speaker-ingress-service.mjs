import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission }
  from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { assertWorldSimulationCommittedAcousticSource }
  from "./world-simulation-native-committed-source-service.mjs";
import {
  buildWorldSimulationObserverMicrotickLedger,
  readWorldSimulationObserverMicrotickRelease,
} from "./world-simulation-observer-microtick-ledger-service.mjs";

export const worldSimulationCommittedReplySpeakerIngressVersion =
  "world-listener-reply-speaker-acoustic-ingress-v1";

const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const array = v => Array.isArray(v) ? v : [];
const copy = v => JSON.parse(JSON.stringify(v ?? null));

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function required(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 240)
    reject("WORLD_REPLY_SPEAKER_INPUT_INVALID",
      label+" must be bounded nonblank text.");
  return value;
}
function exactState(input, snapshot) {
  if (!Number.isSafeInteger(input.expected_revision)
    || input.expected_revision < 2
    || typeof input.expected_state_hash !== "string"
    || !input.expected_state_hash
    || snapshot.revision !== input.expected_revision
    || snapshot.state_hash !== input.expected_state_hash)
    reject("WORLD_REPLY_SPEAKER_WORLD_STALE",
      "Original speaker cognition requires exact current World CAS.");
}
function firstActualAdmission(source, observer, sourceActor, actionId) {
  return array(source?.communication_observer_increment_admissions)
    .filter(item=>item?.observer===observer
      && item?.admission_status==="heard_acoustic_cues_only"
      && item?.audit?.source_speaker===sourceActor
      && item?.audit?.source_action_id===actionId
      && record(item.observer_increment))
    .sort((a,b)=>a.release_time_ms-b.release_time_ms
      || a.observer_increment.increment_ref.localeCompare(
        b.observer_increment.increment_ref,"en"))[0]??null;
}
function safeAcousticCue(cue) {
  return {
    schema_version:"world-listener-acoustic-only-observation-v1",
    kind:"speech_sound_detected",
    signal_phase:cue.signal_phase,
    perceived_cue_refs:copy(cue.perceived_cue_refs),
    signal_ref:cue.signal_ref,
    increment_ref:cue.increment_ref,
    heard_surface_fragment:null,
    speaker_identity_recognized:false,
    lexical_intelligibility_attested:false,
    content_understood:false,
    world_truth_claimed:false,
  };
}
async function sourceAudit(sessionId, turn, actor, observer, admission, snapshot, options) {
  if (!turn?.subjective_choice_commitment_receipts?.receipt_bundle_hash
    || !admission?.observer_increment?.increment_ref)
    reject("WORLD_REPLY_SPEAKER_SOURCE_INVALID",
      "A hearing dependency needs a genuine committed Phase74D receipt.");
  const proof=await assertWorldSimulationCommittedAcousticSource({
    session_id:sessionId,
    source_turn_id:turn.turn_id,
    source_turn_hash:hashAgentRunValue(turn),
    source_action_id:admission.audit.source_action_id,
    source_character:actor,observer,
    observer_increment_ref:admission.observer_increment.increment_ref,
    release_time_ms:admission.release_time_ms,
    expected_source_receipt_bundle_hash:
      turn.subjective_choice_commitment_receipts.receipt_bundle_hash,
    expected_source_revision_to:turn.revision_to,
    expected_source_next_state_hash:turn.next_state_hash,
    expected_current_revision:snapshot.revision,
    expected_current_state_hash:snapshot.state_hash,
  },options);
  if (proof.status!=="committed_source_verified_without_retraction")
    reject("WORLD_REPLY_SPEAKER_SOURCE_INVALID",
      "World failed to authenticate the actual speaker hearing.");
}

/**
 * Reads the first source-verified acoustic increment of the immediate
 * listener-owned clarification reply, for the *original* speaker only.
 * The older original speech and the new reply are independently authenticated.
 * This is private, non-durable cognition; no answer, public action, lexical
 * understanding, belief revision or one-use memory consumption is claimed.
 */
export async function runWorldSimulationCommittedReplySpeakerCognition(
  input={},options={},
) {
  const sessionId=required(input.world_simulation_session_id,"session");
  const observer=required(input.observer,"original speaker");
  const sourceTurnId=required(input.source_turn_id,"reply turn");
  if(typeof options.characterBrain!=="function")
    reject("WORLD_REPLY_SPEAKER_BRAIN_REQUIRED",
      "An actual original-speaker Character Brain is required.");
  const [snapshot,history]=await Promise.all([
    getWorldSimulationState(sessionId,options),
    getWorldSimulationHistory(sessionId,options),
  ]);
  exactState(input,snapshot);
  if(history.world_simulation_session_id!==sessionId
    || array(history.turns).length!==snapshot.revision)
    reject("WORLD_REPLY_SPEAKER_HISTORY_INVALID",
      "Original speaker ingress requires exact append-only World history.");
  if(!record(snapshot.state?.characters?.[observer])
    || !projectWorldSimulationConsciousCognitionAdmission(snapshot.state,observer).admitted)
    reject("WORLD_REPLY_SPEAKER_NOT_ADMITTED",
      "Only an awake admitted speaker may notice a reply sound.");

  const turns=history.turns, reply=turns.at(-1), prior=turns.at(-2);
  const meta=reply?.autonomous_listener_clarification_reply;
  const origin=prior?.autonomous_actor_initiated_action;
  if(reply?.turn_id!==sourceTurnId || reply.event!==null
    || meta?.version!=="world-listener-clarification-causal-reply-v1"
    || !prior || prior.event!==null
    || origin?.version!=="world-actor-initiated-speech-v1"
    || meta.source_turn_id!==prior.turn_id
    || meta.source_turn_hash!==hashAgentRunValue(prior)
    || meta.source_revision_to!==prior.revision_to
    || meta.source_character!==observer
    || meta.source_character!==origin.character
    || meta.source_action_id!==origin.action_id
    || meta.scene_id!==origin.scene_id
    || meta.character===observer)
    reject("WORLD_REPLY_SPEAKER_SOURCE_NOT_CURRENT",
      "Only the real original speaker may consume an immediate verified listener reply.");

  const originalHeard=firstActualAdmission(prior,meta.character,
    observer,meta.source_action_id);
  if(originalHeard?.observer_increment?.increment_ref!==meta.observer_increment_ref)
    reject("WORLD_REPLY_SPEAKER_ORIGINAL_HEARING_INVALID",
      "Clarification source must be the listener's genuinely admitted original sound.");
  await sourceAudit(sessionId,prior,observer,meta.character,originalHeard,snapshot,options);

  const selected=array(reply.selected_action_intents).filter(item=>
    item.character===meta.character && item.action_id===meta.action_id
      && item.selection==="candidate_action_intent"
      && item.candidate?.communication?.addressee===observer);
  const outcomes=array(reply.action_outcomes).filter(item=>
    item.actor===meta.character && item.action_id===meta.action_id
      && item.result==="communication_emitted"
      && item.communication_event?.channel==="speech"
      && item.communication_event?.addressee===observer
      && item.communication_acoustic_signal?.registered===true);
  if(selected.length!==1 || outcomes.length!==1)
    reject("WORLD_REPLY_SPEAKER_REPLY_NOT_EMITTED",
      "The listener's selected action must really produce an addressed acoustic reply.");
  const first=firstActualAdmission(reply,observer,meta.character,meta.action_id);
  if(!first) return Object.freeze({
    version:worldSimulationCommittedReplySpeakerIngressVersion,
    status:"no_original_speaker_acoustic_admission",
    character_brain_invoked:false,world_mutation_performed:false,
    public_reply_emitted:false,content_understood:false,
  });
  await sourceAudit(sessionId,reply,meta.character,observer,first,snapshot,options);
  const ledger=buildWorldSimulationObserverMicrotickLedger({
    causal_timeline:reply.causal_timeline,
    admissions:reply.communication_observer_increment_admissions,
  });
  let verifiedFirst=null;
  for(let cursor=0;cursor<ledger.tick_count;cursor++){
    const release=readWorldSimulationObserverMicrotickRelease({
      ledger,observer,cursor,
    });
    if(release.perceived_increments.length){
      verifiedFirst=release.perceived_increments.find(item=>
        item.increment_ref===first.observer_increment.increment_ref)??null;
      break;
    }
  }
  if(!verifiedFirst || hashAgentRunValue(verifiedFirst)
    !==hashAgentRunValue(first.observer_increment))
    reject("WORLD_REPLY_SPEAKER_MICROTICK_INVALID",
      "Only the original speaker's first real, canonical acoustic cue is available.");

  const packet={
    character:observer,
    cognition:{committed_acoustic_observation:safeAcousticCue(verifiedFirst)},
    boundaries:{
      source:"source_authenticated_listener_clarification_reply",
      prior_speech_transcript_exposed:false,
      reply_surface_exposed:false,
      engine_speaker_identity_exposed:false,
      lexical_meaning_inferred:false,
      world_truth_exposed:false,
      other_observer_cues_exposed:false,
      future_cues_exposed:false,
      action_selection_authority:false,
      durable_memory_written:false,
      external_event_queue_injected:false,
    },
  };
  let brainCalls=0, brainResult,callbackError=null;
  const brain=async incoming=>{
    try{
      if(++brainCalls!==1
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_REPLY_SPEAKER_BRAIN_PACKET_INVALID",
          "Runtime must pass the exact one-speaker private acoustic packet once.");
      const current=await getWorldSimulationState(sessionId,options);
      exactState(input,current);
      if(!projectWorldSimulationConsciousCognitionAdmission(current.state,observer).admitted)
        reject("WORLD_REPLY_SPEAKER_NOT_ADMITTED",
          "Sleeping original speaker cannot receive a new acoustic cue.");
      brainResult=await options.characterBrain(copy(incoming));
      return brainResult;
    } catch(error){callbackError=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn)
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:sessionId,character:observer,
      brain_input:copy(packet),characterBrain:brain,
    },options);
  else await brain(packet);
  if(callbackError) throw callbackError;
  if(brainCalls!==1)
    reject("WORLD_REPLY_SPEAKER_BRAIN_NOT_INVOKED",
      "Actual original-speaker Brain cognition must occur exactly once.");
  if(record(brainResult) && [
    "action_id","selected_action","selected_action_id","action_intents",
    "selected_action_intents","goal_intents","plan_intents",
    "world_state","world_truth",
  ].some(key=>Object.hasOwn(brainResult,key)))
    reject("WORLD_REPLY_SPEAKER_PUBLIC_ACTION_UNSUPPORTED",
      "Private hearing cannot claim a public action or belief update.");
  const after=await getWorldSimulationState(sessionId,options);
  exactState(input,after);
  return Object.freeze({
    version:worldSimulationCommittedReplySpeakerIngressVersion,
    status:"verified_original_speaker_hears_clarification",
    source_chain_verified:true,
    original_speech_preserved:true,
    character_brain_invoked:true,
    original_speaker_acoustic_cues_present:1,
    content_understood:false,
    public_reply_emitted:false,
    world_mutation_performed:false,
    durable_cognition_consumption_claimed:false,
  });
}
