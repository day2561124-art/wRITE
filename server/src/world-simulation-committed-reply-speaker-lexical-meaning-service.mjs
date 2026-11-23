import { hashAgentRunValue } from "./agent-run-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState }
  from "./world-simulation-state-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission }
  from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import { runWorldSimulationCommittedReplySpeakerCognition }
  from "./world-simulation-committed-reply-speaker-ingress-service.mjs";
import { assertWorldSimulationCommittedAcousticSource }
  from "./world-simulation-native-committed-source-service.mjs";
import { runWorldSimulationObserverLexicalIncrementAdmission }
  from "./world-simulation-communication-observer-lexical-increment-service.mjs";
import { runWorldSimulationObserverMeaningIncrementAdmission }
  from "./world-simulation-communication-observer-meaning-increment-service.mjs";

export const worldSimulationReplySpeakerLexicalMeaningVersion =
  "world-reply-speaker-private-lexical-meaning-v1";

const array = value => Array.isArray(value) ? value : [];
const copy = value => JSON.parse(JSON.stringify(value ?? null));
const record = value => value !== null && typeof value === "object"
  && !Array.isArray(value);

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function exactCas(input, snapshot) {
  if (snapshot.revision !== input.expected_revision
    || snapshot.state_hash !== input.expected_state_hash)
    reject("WORLD_REPLY_LEXICAL_WORLD_STALE",
      "Private lexical recognition requires an unchanged committed World CAS.");
}
async function invokeSpeakerBrain(packet, input, options) {
  let calls=0, actualBrainResult, callbackError=null;
  const callback=async incoming=>{
    try {
      if(++calls!==1 || incoming?.character!==input.observer
        || hashAgentRunValue(incoming)!==hashAgentRunValue(packet))
        reject("WORLD_REPLY_LEXICAL_BRAIN_PACKET_INVALID",
          "Only the original speaker may receive their exact bounded lexical packet.");
      const current=await getWorldSimulationState(input.world_simulation_session_id,options);
      exactCas(input,current);
      if(!projectWorldSimulationConsciousCognitionAdmission(current.state,input.observer).admitted)
        reject("WORLD_REPLY_LEXICAL_CHARACTER_ASLEEP",
          "An unconscious speaker cannot recognize or interpret speech.");
      actualBrainResult=await options.characterBrain(copy(incoming));
      return actualBrainResult;
    } catch(error) {callbackError=error;throw error;}
  };
  if(options.characterRuntimeManager?.runCharacterTurn)
    await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:input.world_simulation_session_id,
      character:input.observer,
      brain_input:copy(packet),
      characterBrain:callback,
    },options);
  else await callback(packet);
  if(callbackError) throw callbackError;
  if(calls!==1)
    reject("WORLD_REPLY_LEXICAL_BRAIN_NOT_INVOKED",
      "The exact original speaker Brain must run once for this recognition stage.");
  return actualBrainResult;
}

/**
 * The original speaker may separately recognize *one* verified released
 * fragment of the listener's clarification, and interpret only their own
 * recognized fragment. Both decisions come from the Character Brain.
 *
 * Existing CC7J/CC7K owners validate the two returned decisions. This
 * read-only bridge neither generates a canonical objective transcript nor
 * treats the character's interpretation as World truth or persistent memory.
 */
export async function runWorldSimulationCommittedReplySpeakerLexicalMeaning(
  input={},options={},
) {
  if(typeof options.characterBrain!=="function")
    reject("WORLD_REPLY_LEXICAL_BRAIN_REQUIRED",
      "Source-backed lexical and meaning stages require a Character Brain.");

  const privateHearing=await runWorldSimulationCommittedReplySpeakerCognition(
    input,options,
  );
  if(!privateHearing.character_brain_invoked)
    return Object.freeze({
      version:worldSimulationReplySpeakerLexicalMeaningVersion,
      status:"no_authenticated_speech_sound",
      lexical_recognition_count:0,
      meaning_interpretation_count:0,
      world_mutation_performed:false,
      world_truth_claimed:false,
    });

  const [snapshot,history]=await Promise.all([
    getWorldSimulationState(input.world_simulation_session_id,options),
    getWorldSimulationHistory(input.world_simulation_session_id,options),
  ]);
  exactCas(input,snapshot);
  const reply=array(history.turns).at(-1);
  const meta=reply?.autonomous_listener_clarification_reply;
  if(history.world_simulation_session_id!==input.world_simulation_session_id
    || array(history.turns).length!==snapshot.revision
    || reply?.turn_id!==input.source_turn_id
    || meta?.version!=="world-listener-clarification-causal-reply-v1"
    || meta.source_character!==input.observer)
    reject("WORLD_REPLY_LEXICAL_SOURCE_INVALID",
      "Lexical recognition requires the exact current verified listener reply.");

  const admissions=array(reply.communication_observer_increment_admissions)
    .filter(item=>item?.observer===input.observer
      && item?.admission_status==="heard_acoustic_cues_only"
      && item?.audit?.source_action_id===meta.action_id
      && item?.audit?.source_speaker===meta.character
      && record(item.observer_increment))
    .sort((a,b)=>a.release_time_ms-b.release_time_ms
      || a.observer_increment.increment_ref.localeCompare(
        b.observer_increment.increment_ref,"en"));
  if(!admissions.length)
    reject("WORLD_REPLY_LEXICAL_ADMISSION_LOST",
      "Previously authenticated original-speaker hearing cannot vanish.");
  const first=admissions[0];
  const proof=await assertWorldSimulationCommittedAcousticSource({
    session_id:input.world_simulation_session_id,
    source_turn_id:reply.turn_id,
    source_turn_hash:hashAgentRunValue(reply),
    source_action_id:meta.action_id,
    source_character:meta.character,
    observer:input.observer,
    observer_increment_ref:first.observer_increment.increment_ref,
    release_time_ms:first.release_time_ms,
    expected_source_receipt_bundle_hash:
      reply.subjective_choice_commitment_receipts?.receipt_bundle_hash,
    expected_source_revision_to:reply.revision_to,
    expected_source_next_state_hash:reply.next_state_hash,
    expected_current_revision:snapshot.revision,
    expected_current_state_hash:snapshot.state_hash,
  },options);
  if(proof.status!=="committed_source_verified_without_retraction")
    reject("WORLD_REPLY_LEXICAL_SOURCE_INVALID",
      "CC7AF did not authenticate the exact speech fragment source.");

  let lexicalCalls=0, meaningCalls=0;
  const lexical=await runWorldSimulationObserverLexicalIncrementAdmission({
    admissions:[copy(first)],
    action_outcomes:copy(reply.action_outcomes),
    resolver:async resolverPacket=>{
      if(resolverPacket?.observer!==input.observer
        || resolverPacket?.increment_ref!==first.observer_increment.increment_ref
        || resolverPacket?.boundaries?.source_semantics_available!==false
        || resolverPacket?.boundaries?.source_identity_available!==false)
        reject("WORLD_REPLY_LEXICAL_RESOLVER_SCOPE_INVALID",
          "Lexical recognition must see only one actually heard source fragment.");
      lexicalCalls++;
      return invokeSpeakerBrain({
        character:input.observer,
        cognition:{observer_lexical_recognition:copy(resolverPacket)},
        boundaries:{
          stage:"speaker_subjective_lexical_recognition",
          emitted_fragment_is_symbolic_acoustic_input:true,
          lexical_recognition_may_be_mistaken:true,
          source_speaker_identity_exposed:false,
          source_utterance_semantics_exposed:false,
          future_fragment_exposed:false,
          action_selection_authority:false,
          world_truth_authority:false,
          durable_memory_write_authority:false,
        },
      },input,options);
    },
  });
  if(lexicalCalls!==1 || lexical.audit.candidate_count!==1)
    reject("WORLD_REPLY_LEXICAL_RELEASE_INVALID",
      "Only the first actually released acoustic increment may be considered.");

  const meaning=await runWorldSimulationObserverMeaningIncrementAdmission({
    lexical_recognitions:copy(lexical.engine_private_lexical_increments),
    resolver:async resolverPacket=>{
      if(resolverPacket?.observer!==input.observer
        || resolverPacket?.increment_ref!==first.observer_increment.increment_ref
        || resolverPacket?.boundaries?.source_semantics_available!==false
        || resolverPacket?.boundaries?.source_identity_available!==false)
        reject("WORLD_REPLY_MEANING_RESOLVER_SCOPE_INVALID",
          "Meaning interpretation must use the same observer's own lexical recognition.");
      meaningCalls++;
      return invokeSpeakerBrain({
        character:input.observer,
        cognition:{observer_meaning_interpretation:copy(resolverPacket)},
        boundaries:{
          stage:"speaker_subjective_meaning_interpretation",
          recognized_text_is_listener_subjective:true,
          source_speaker_private_intent_exposed:false,
          source_world_truth_exposed:false,
          future_fragment_exposed:false,
          action_selection_authority:false,
          belief_write_authority:false,
          durable_memory_write_authority:false,
        },
      },input,options);
    },
  });
  const after=await getWorldSimulationState(input.world_simulation_session_id,options);
  exactCas(input,after);

  const interpreted=array(meaning.engine_private_meaning_increments);
  return Object.freeze({
    version:worldSimulationReplySpeakerLexicalMeaningVersion,
    status:lexical.audit.recognition_count===0
      ? "speaker_declined_lexical_recognition"
      : interpreted.length===0
      ? "no_subjective_meaning_interpretation"
      : "original_speaker_subjective_interpretation_observed",
    source_chain_verified:true,
    heard_fragment_count:1,
    lexical_character_brain_calls:lexicalCalls,
    meaning_character_brain_calls:meaningCalls,
    lexical_recognition_count:lexical.audit.recognition_count,
    meaning_interpretation_count:meaning.audit.interpretation_count,
    subjective_understanding_attested:interpreted.some(
      item=>item.understanding_attested===true),
    interpreted_content_exposed:false,
    speaker_identity_from_acoustics_inferred:false,
    world_truth_claimed:false,
    world_mutation_performed:false,
    durable_memory_written:false,
    public_action_performed:false,
  });
}
