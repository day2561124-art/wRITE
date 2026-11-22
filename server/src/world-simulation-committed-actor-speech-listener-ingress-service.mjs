import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission }
  from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { assertWorldSimulationCommittedAcousticSource }
  from "./world-simulation-native-committed-source-service.mjs";
import {
  buildWorldSimulationObserverMicrotickLedger,
  readWorldSimulationObserverMicrotickRelease,
} from "./world-simulation-observer-microtick-ledger-service.mjs";

export const worldSimulationCommittedActorSpeechListenerIngressVersion =
  "world-actor-committed-listener-cue-ingress-v1";

const record = v => v != null && typeof v === "object" && !Array.isArray(v);
const array = v => Array.isArray(v) ? v : [];
const copy = v => JSON.parse(JSON.stringify(v ?? null));

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function required(v, label) {
  if (typeof v !== "string" || !v.trim() || v.length > 240)
    reject("WORLD_LISTENER_CUE_INPUT_INVALID", label+" must be bounded nonblank text.");
  return v;
}
function exactState(expectedRevision, expectedHash, snapshot) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || typeof expectedHash !== "string" || !expectedHash
    || snapshot.revision !== expectedRevision
    || snapshot.state_hash !== expectedHash)
    reject("WORLD_LISTENER_CUE_WORLD_STATE_STALE",
      "Listener ingress requires the exact current committed World CAS.");
}
function safeObserverIncrement(cue) {
  // Only source-authenticated, acoustic-only CC7C observer fields. Do not
  // forward speaker, source action, real transcript, World clock or scene.
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

/**
 * Reads the FIRST authentic, observer-scoped acoustic increment from the
 * latest committed actor-initiated World speech, then invokes only that
 * listener's Character Brain for a private cognition opportunity.
 *
 * No response selection or World commit is authorized by this read-only
 * ingress. Re-reading is NOT durable one-use cognition consumption.
 */
export async function runWorldSimulationCommittedActorSpeechListenerCognition(
  input = {}, options = {},
) {
  const sessionId = required(input.world_simulation_session_id, "session_id");
  const observer = required(input.observer, "observer");
  const sourceTurnId = required(input.source_turn_id, "source_turn_id");
  if (typeof options.characterBrain !== "function")
    reject("WORLD_LISTENER_CUE_CHARACTER_BRAIN_REQUIRED",
      "A real Character Brain callback is required for listener ingress.");

  const [snapshot, history] = await Promise.all([
    getWorldSimulationState(sessionId, options),
    getWorldSimulationHistory(sessionId, options),
  ]);
  exactState(input.expected_revision, input.expected_state_hash, snapshot);
  if (!record(snapshot.state?.characters?.[observer])
    || !projectWorldSimulationConsciousCognitionAdmission(snapshot.state,observer).admitted)
    reject("WORLD_LISTENER_CUE_CONSCIOUS_ADMISSION_DENIED",
      "Only an awake World-admitted listener can process fresh acoustic input.");

  // The listener cue may only originate from the immediately previous
  // World causal turn. Old history is not a newly arriving sound.
  if (history.world_simulation_session_id !== sessionId
    || array(history.turns).length !== snapshot.revision
    || array(history.turns).length === 0)
    reject("WORLD_LISTENER_CUE_HISTORY_INVALID",
      "Listener ingress requires matching append-only World history.");
  const source=history.turns.at(-1);
  const sourceMeta=source?.autonomous_actor_initiated_action;
  if (source?.turn_id !== sourceTurnId || source?.event !== null
    || sourceMeta?.version !== "world-actor-initiated-speech-v1"
    || sourceMeta.character === observer)
    reject("WORLD_LISTENER_CUE_SOURCE_NOT_CURRENT",
      "No current verified actor-initiated acoustic source belongs to this listener.");

  const actionId=required(sourceMeta.action_id,"source_action_id");
  const speaker=required(sourceMeta.character,"source_character");
  const selected=array(source.selected_action_intents).filter(x=>
    x.character===speaker && x.action_id===actionId
      && x.selection==="candidate_action_intent");
  const emitted=array(source.action_outcomes).filter(x=>
    x.actor===speaker && x.action_id===actionId
      && x.result==="communication_emitted"
      && x.communication_event?.channel==="speech"
      && x.communication_acoustic_signal?.registered===true);
  if (selected.length!==1 || emitted.length!==1
    || !source.subjective_choice_commitment_receipts?.receipt_bundle_hash)
    reject("WORLD_LISTENER_CUE_SOURCE_INVALID",
      "Listener ingress needs a real committed selected acoustic speech action.");

  const admissions=array(source.communication_observer_increment_admissions)
    .filter(x=>x.observer===observer
      && x.admission_status==="heard_acoustic_cues_only"
      && x.audit?.source_action_id===actionId
      && x.audit?.source_speaker===speaker
      && record(x.observer_increment))
    .sort((a,b)=>a.release_time_ms-b.release_time_ms);
  if (!admissions.length) return Object.freeze({
    version:worldSimulationCommittedActorSpeechListenerIngressVersion,
    status:"no_observer_acoustic_admission",
    character_brain_invoked:false,
    world_mutation_performed:false,
    public_reply_emitted:false,
    content_understood:false,
  });
  const first=admissions[0];
  // CC7AF re-reads and authenticates exact historical source, Phase74D
  // receipt, original sound and observer increment. Caller-provided cue
  // content or hashes cannot authorize character awareness.
  const proof=await assertWorldSimulationCommittedAcousticSource({
    session_id:sessionId,
    source_turn_id:source.turn_id,
    source_turn_hash:hashAgentRunValue(source),
    source_action_id:actionId,
    source_character:speaker,
    observer,
    observer_increment_ref:first.observer_increment.increment_ref,
    release_time_ms:first.release_time_ms,
    expected_source_receipt_bundle_hash:
      source.subjective_choice_commitment_receipts.receipt_bundle_hash,
    expected_source_revision_to:source.revision_to,
    expected_source_next_state_hash:source.next_state_hash,
    expected_current_revision:snapshot.revision,
    expected_current_state_hash:snapshot.state_hash,
  },options);
  if (proof.status!=="committed_source_verified_without_retraction")
    reject("WORLD_LISTENER_CUE_SOURCE_INVALID","Committed source was not authenticated.");

  const ledger=buildWorldSimulationObserverMicrotickLedger({
    causal_timeline:source.causal_timeline,
    admissions:source.communication_observer_increment_admissions,
  });
  let verifiedFirst=null;
  for(let cursor=0; cursor<ledger.tick_count; cursor++){
    const view=readWorldSimulationObserverMicrotickRelease({
      ledger,observer,cursor,
    });
    if(view.perceived_increments.length){
      verifiedFirst=view.perceived_increments.find(cue=>
        cue.increment_ref===first.observer_increment.increment_ref)??null;
      break;
    }
  }
  if (!verifiedFirst
    || hashAgentRunValue(verifiedFirst)
      !== hashAgentRunValue(first.observer_increment))
    reject("WORLD_LISTENER_CUE_LEDGER_INVALID",
      "The first listener cue must match the canonical World release ledger.");

  const packet={
    character:observer,
    cognition:{
      committed_acoustic_observation:safeObserverIncrement(verifiedFirst),
    },
    boundaries:{
      source:"authenticated_committed_world_acoustic_release",
      external_event_queue_injected:false,
      speaker_identity_exposed:false,
      speech_surface_exposed:false,
      lexical_meaning_inferred:false,
      other_observer_cues_exposed:false,
      future_cues_exposed:false,
      action_selection_authority:false,
      world_truth_authority:false,
      durable_memory_written:false,
    },
  };
  let brainCalls=0;
  let brainResult;
  const callBrain=async incoming=>{
    if (++brainCalls!==1 || incoming?.character!==observer)
      reject("WORLD_LISTENER_CUE_CHARACTER_MISMATCH",
        "Listener cognition must run once for the exact admitted observer.");
    const current=await getWorldSimulationState(sessionId,options);
    exactState(input.expected_revision,input.expected_state_hash,current);
    if (!projectWorldSimulationConsciousCognitionAdmission(current.state,observer).admitted)
      reject("WORLD_LISTENER_CUE_CONSCIOUS_ADMISSION_DENIED",
        "Listener is no longer admitted for conscious hearing.");
    brainResult=await options.characterBrain(copy(incoming));
    return brainResult;
  };
  if (options.characterRuntimeManager?.runCharacterTurn){
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:sessionId,
      character:observer,
      brain_input:copy(packet),
      characterBrain:callBrain,
    },options);
  } else {
    await callBrain(packet);
  }
  if (brainCalls!==1)
    reject("WORLD_LISTENER_CUE_BRAIN_NOT_INVOKED",
      "Listener ingress requires exactly one authentic Brain input.");
  if (record(brainResult) && [
    "action_id","selected_action_id","selected_action",
    "action_intents","selected_action_intents",
    "goal_intents","plan_intents","world_state","world_truth",
  ].some(key=>Object.hasOwn(brainResult,key)))
    reject("WORLD_LISTENER_CUE_ACTION_UNSUPPORTED",
      "Private acoustic cognition cannot claim a public action, goal write or World truth.");
  const after=await getWorldSimulationState(sessionId,options);
  exactState(input.expected_revision,input.expected_state_hash,after);
  return Object.freeze({
    version:worldSimulationCommittedActorSpeechListenerIngressVersion,
    status:"verified_listener_acoustic_brain_ingress",
    character_brain_invoked:true,
    source_proof_verified:true,
    observer_acoustic_cues_present:1,
    content_understood:false,
    public_reply_emitted:false,
    world_mutation_performed:false,
    durable_cognition_consumption_claimed:false,
  });
}
