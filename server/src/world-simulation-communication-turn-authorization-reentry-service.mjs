import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationNominatedTransitionAuthorizationVersion,
} from "./world-simulation-communication-nominated-transition-authorization-service.mjs";
import {
  worldSimulationOpenFloorTransitionAuthorizationVersion,
} from "./world-simulation-communication-open-floor-transition-authorization-service.mjs";

export const worldSimulationTurnAuthorizationReentryVersion =
  "cc7x-committed-turn-authorization-reentry-v1";

const copy=(value)=>JSON.parse(JSON.stringify(value??null));
const record=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);

function fail(message) {
  const error=new Error(message);
  error.code="CC7X_TURN_AUTHORIZATION_REENTRY_INVALID";
  throw error;
}
function text(value,label,limit=240) {
  if(typeof value!=="string"||!value.trim()||[...value.trim()].length>limit)
    fail(`${label} must be bounded nonblank text.`);
  return value.trim();
}
function observerRef(version,character) {
  return `observer_${hashAgentRunValue({version,value:character}).slice(0,24)}`;
}
function turnRef(turnId) {
  return `prior_turn_${hashAgentRunValue({
    version:worldSimulationTurnAuthorizationReentryVersion,
    turn_id:turnId,
  }).slice(0,24)}`;
}
function authorizationCandidate(turn,key,kind,version,status,authorization) {
  const value=turn?.[key];
  if(value==null) return null;
  if(!record(value)||value.schema_version!==version)
    fail(`${key} is not canonical CC-7 authorization evidence.`);
  const selected=value.next_speaker_selected===true;
  if(!selected) {
    if(value.selected_transition!==null)
      fail(`${key} cannot retain a selected transition when no speaker was selected.`);
    return null;
  }
  if(value.status!==status||!record(value.selected_transition)||
      value.selected_transition.authorization!==authorization||
      value.selected_transition.actual_floor_awarded!==false||
      value.selected_transition.response_emitted!==false||
      !text(value.selected_transition.authorization_ref,
        `${key}.authorization_ref`)||
      !text(value.selected_transition.observer_ref,
        `${key}.observer_ref`))
    fail(`${key} selected transition is incomplete or contradictory.`);
  return {
    kind,
    version,
    authorization_ref:value.selected_transition.authorization_ref,
    observer_ref:value.selected_transition.observer_ref,
    release_time_ms:value.selected_transition.release_time_ms??null,
  };
}

/**
 * Re-enter only the immediately prior committed World authorization.
 *
 * Persisted CC-7V/W audits deliberately hide raw character identity. CC-7X
 * re-identifies the selected participant by recomputing the version-bound
 * opaque observer ref from the current decision participants. The raw match
 * stays engine-private. Character Brain inputs are not modified here.
 */
export function buildWorldSimulationTurnAuthorizationReentry({
  world_history,
  current_turn_id,
  current_characters,
}={}) {
  if(!record(world_history)||!Array.isArray(world_history.turns))
    fail("world_history.turns is required.");
  const turnId=text(current_turn_id,"current_turn_id");
  if(!Array.isArray(current_characters)||current_characters.length>4096)
    fail("current_characters must be a bounded list.");
  const characters=current_characters.map((item)=>text(item,"current_character"));
  if(new Set(characters).size!==characters.length)
    fail("current_characters must be distinct.");

  const prior=world_history.turns.at(-1)??null;
  if(!prior) {
    return copy({
      audit:{
        schema_version:worldSimulationTurnAuthorizationReentryVersion,
        status:"no_prior_committed_turn",
        source_turn_ref:null,
        authorization_kind:null,
        authorization_ref:null,
        participant_match_count:0,
        decision_priority_applied:false,
        boundaries:{
          committed_prior_turn_only:true,
          same_turn_reentry_allowed:false,
          opaque_observer_ref_mapping_only:true,
          raw_selected_character_persisted:false,
          character_brain_input_modified:false,
          expression_forced:false,
          floor_claim_emitted:false,
          world_action_replanned:false,
        },
      },
      engine_private_reentry:{
        selected_character:null,
        authorization_kind:null,
        authorization_ref:null,
        source_turn_id:null,
        decision_priority_required:false,
      },
    });
  }
  const priorTurnId=text(prior.turn_id,"prior turn_id");
  if(priorTurnId===turnId)
    fail("CC-7X cannot re-enter authorization from the current turn.");

  const nominated=authorizationCandidate(
    prior,
    "communication_nominated_transition_authorization",
    "nominated",
    worldSimulationNominatedTransitionAuthorizationVersion,
    "nominated_future_transition_authorized",
    "future_nominated_turn_selected",
  );
  const openFloor=authorizationCandidate(
    prior,
    "communication_open_floor_transition_authorization",
    "open_floor",
    worldSimulationOpenFloorTransitionAuthorizationVersion,
    "open_floor_future_transition_authorized",
    "future_open_floor_self_selection",
  );
  const active=[nominated,openFloor].filter(Boolean);
  if(active.length>1)
    fail("One prior committed turn cannot authorize two next speakers.");

  if(active.length===0) {
    return copy({
      audit:{
        schema_version:worldSimulationTurnAuthorizationReentryVersion,
        status:"no_prior_next_speaker_authorization",
        source_turn_ref:turnRef(priorTurnId),
        authorization_kind:null,
        authorization_ref:null,
        participant_match_count:0,
        decision_priority_applied:false,
        boundaries:{
          committed_prior_turn_only:true,
          same_turn_reentry_allowed:false,
          opaque_observer_ref_mapping_only:true,
          raw_selected_character_persisted:false,
          character_brain_input_modified:false,
          expression_forced:false,
          floor_claim_emitted:false,
          world_action_replanned:false,
        },
      },
      engine_private_reentry:{
        selected_character:null,
        authorization_kind:null,
        authorization_ref:null,
        source_turn_id:priorTurnId,
        decision_priority_required:false,
      },
    });
  }

  const authorization=active[0];
  const matching=characters.filter((character)=>
    observerRef(authorization.version,character)===authorization.observer_ref);
  if(matching.length!==1)
    fail("Prior next-speaker authorization must match exactly one current participant.");

  return copy({
    audit:{
      schema_version:worldSimulationTurnAuthorizationReentryVersion,
      status:"prior_next_speaker_authorization_reentered",
      source_turn_ref:turnRef(priorTurnId),
      authorization_kind:authorization.kind,
      authorization_ref:authorization.authorization_ref,
      participant_match_count:1,
      decision_priority_applied:true,
      boundaries:{
        committed_prior_turn_only:true,
        same_turn_reentry_allowed:false,
        opaque_observer_ref_mapping_only:true,
        raw_selected_character_persisted:false,
        character_brain_input_modified:false,
        expression_forced:false,
        floor_claim_emitted:false,
        world_action_replanned:false,
      },
    },
    engine_private_reentry:{
      selected_character:matching[0],
      authorization_kind:authorization.kind,
      authorization_ref:authorization.authorization_ref,
      source_turn_id:priorTurnId,
      decision_priority_required:true,
    },
  });
}

export function prioritizeWorldSimulationAuthorizedSpeakerDecision({
  decision_inputs,
  reentry,
}={}) {
  if(!Array.isArray(decision_inputs))
    fail("decision_inputs must be an array.");
  const selected=reentry?.engine_private_reentry?.selected_character??null;
  if(selected===null) return copy(decision_inputs);
  const matching=decision_inputs.filter((item)=>
    item?.character_input?.character===selected);
  if(matching.length!==1)
    fail("Authorized speaker must map to exactly one formal decision input.");
  return copy([
    matching[0],
    ...decision_inputs.filter((item)=>item?.character_input?.character!==selected),
  ]);
}

export default buildWorldSimulationTurnAuthorizationReentry;
