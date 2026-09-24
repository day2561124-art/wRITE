import {
  buildWorldSimulationTurnAuthorizationReentry,
  worldSimulationTurnAuthorizationReentryVersion,
} from "./world-simulation-communication-turn-authorization-reentry-service.mjs";
import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationAuthorizedFloorClaimVersion =
  "cc7y-authorized-floor-claim-execution-v1";

const copy=(value)=>JSON.parse(JSON.stringify(value??null));
const record=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);

function fail(message) {
  const error=new Error(message);
  error.code="CC7Y_AUTHORIZED_FLOOR_CLAIM_INVALID";
  throw error;
}
function nonblank(value) {
  return typeof value==="string"&&value.trim().length>0;
}
function claimRef(value) {
  return `floor_claim_${hashAgentRunValue({
    version:worldSimulationAuthorizedFloorClaimVersion,
    value,
  }).slice(0,24)}`;
}

/**
 * CC-7Y consumes a previously committed CC-7V/W authorization only after
 * the authorized character actually selects speech and World confirms that
 * the same action emitted communication.
 *
 * No authorization can force expression. Reject-all, silence, non-speech
 * actions, failed communication, or mismatched lineage leave the floor
 * unawarded. The award means only "this emitted speech legitimately occupies
 * the current conversational floor"; it does not imply comprehension,
 * agreement, grounding, truth, memory, or interruption classification.
 */
export function buildWorldSimulationAuthorizedFloorClaim({
  world_history,
  current_turn_id,
  current_characters,
  prepared_reentry,
  selected_action_intents=[],
  action_outcomes=[],
}={}) {
  const canonical=buildWorldSimulationTurnAuthorizationReentry({
    world_history,
    current_turn_id,
    current_characters,
  });
  if(canonical.audit?.schema_version!==worldSimulationTurnAuthorizationReentryVersion)
    fail("CC-7Y requires canonical CC-7X re-entry.");
  if(prepared_reentry!==undefined&&prepared_reentry!==null&&
      (!record(prepared_reentry)||
       JSON.stringify(prepared_reentry)!==JSON.stringify(canonical)))
    fail("Prepared CC-7X re-entry does not match committed history.");

  const selectedCharacter=canonical.engine_private_reentry?.selected_character??null;
  const authorizationRef=canonical.engine_private_reentry?.authorization_ref??null;
  const authorizationKind=canonical.engine_private_reentry?.authorization_kind??null;
  const sourceTurnId=canonical.engine_private_reentry?.source_turn_id??null;

  if(!Array.isArray(selected_action_intents)||selected_action_intents.length>4096||
      !Array.isArray(action_outcomes)||action_outcomes.length>4096)
    fail("CC-7Y requires bounded selected actions and outcomes.");

  let selectedSpeech=null;
  if(selectedCharacter!==null) {
    const sameCharacter=selected_action_intents.filter(
      (item)=>item?.character===selectedCharacter,
    );
    if(sameCharacter.length!==1)
      fail("Authorized character must have exactly one current selection record.");
    const selection=sameCharacter[0];
    const candidate=selection?.candidate??null;
    if(candidate&&candidate.communication?.channel==="speech"&&
        candidate.communication?.surface_realization_complete===true&&
        nonblank(candidate.action_id)) {
      selectedSpeech={
        action_id:candidate.action_id,
        character:selectedCharacter,
      };
    }
  }

  let emittedOutcome=null;
  if(selectedSpeech) {
    const matches=action_outcomes.filter((item)=>
      item?.actor===selectedSpeech.character &&
      item?.action_id===selectedSpeech.action_id,
    );
    if(matches.length>1)
      fail("Authorized speech action has duplicate World outcomes.");
    if(matches.length===1) {
      const outcome=matches[0];
      if(outcome?.result==="communication_emitted"&&
          outcome?.communication_event?.channel==="speech"&&
          outcome?.communication_event?.actor===selectedSpeech.character) {
        emittedOutcome=outcome;
      }
    }
  }

  const awarded=Boolean(selectedCharacter&&selectedSpeech&&emittedOutcome);
  const status=selectedCharacter===null
    ?"no_prior_authorization_to_consume"
    : awarded
      ?"authorized_floor_claim_awarded"
      :"authorized_floor_claim_not_exercised";
  const floorClaimRef=awarded
    ? claimRef({
      authorization_ref:authorizationRef,
      selected_character:selectedCharacter,
      action_id:selectedSpeech.action_id,
      source_turn_id:sourceTurnId,
      current_turn_id,
    })
    : null;

  return copy({
    audit:{
      schema_version:worldSimulationAuthorizedFloorClaimVersion,
      status,
      authorization_kind:authorizationKind,
      authorization_ref:authorizationRef,
      source_turn_ref:canonical.audit?.source_turn_ref??null,
      authorized_participant_present:selectedCharacter!==null,
      authorized_speech_selected:Boolean(selectedSpeech),
      communication_emitted:Boolean(emittedOutcome),
      actual_floor_awarded:awarded,
      floor_claim_ref:floorClaimRef,
      boundaries:{
        exact_committed_cc7x_reentry_required:true,
        authorized_character_may_decline:true,
        speech_selection_required:true,
        world_emitted_speech_required:true,
        non_speech_action_is_not_floor_claim:true,
        failed_or_missing_emission_is_not_floor_claim:true,
        floor_award_is_not_comprehension:true,
        floor_award_is_not_grounding:true,
        floor_award_is_not_agreement:true,
        floor_award_is_not_world_truth:true,
        overlap_or_interruption_judged:false,
        response_content_inferred:false,
        belief_or_memory_changed:false,
        same_turn_replanning:false,
      },
    },
    engine_private_claim:{
      floor_claim_ref:floorClaimRef,
      authorization_ref:authorizationRef,
      authorization_kind:authorizationKind,
      selected_character:selectedCharacter,
      action_id:selectedSpeech?.action_id??null,
      source_turn_id:sourceTurnId,
      current_turn_id,
      actual_floor_awarded:awarded,
      authorization_consumed:selectedCharacter!==null,
      response_emitted:Boolean(emittedOutcome),
    },
  });
}

export default buildWorldSimulationAuthorizedFloorClaim;
