import assert from "node:assert/strict";
import { projectCharacterCommunicationTurnProjection } from "../../server/src/character-communication-turn-projection-service.mjs";
import { projectCharacterCommunicationTurnParticipationIntent } from "../../server/src/character-communication-turn-participation-intent-service.mjs";
import { projectCharacterCommunicationTurnSelectionCue } from "../../server/src/character-communication-turn-selection-cue-service.mjs";
import {
  buildWorldSimulationTurnIncrementHandoffContract,
  worldSimulationTurnIncrementHandoffVersion,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import {
  buildWorldSimulationSelectionAwareReadiness,
  buildWorldSimulationSelectionAwareReadinessContract,
} from "../../server/src/world-simulation-communication-selection-aware-readiness-service.mjs";

const c=buildWorldSimulationSelectionAwareReadinessContract();
assert.equal(c.selected_me_is_observer_hypothesis_only,true);
assert.equal(c.self_selection_is_not_automatically_authorized,true);
assert.equal(c.selection_hint_does_not_create_floor_request,true);
assert.equal(c.actual_next_speaker_selected,false);
assert.equal(c.world_floor_awarded,false);
assert.equal(c.audit_contains_surface_or_meaning_text,false);
function entry(observer, mode, status, release, selectionStatus = null,
 prior = null, signal = "signal_alpha") {
  const cue = `cue_${observer}_${release}`;
  const response = `response_${observer}`;
  const p=projectCharacterCommunicationTurnProjection({
    observer,
    perceived_speech_increment:{
      schema_version:"cc7-observer-speech-increment-v1",
      observer,speaker:"anonymous_voice",
      signal_ref:signal,increment_ref:`inc_${observer}_${release}`,
      heard_surface_fragment:"祕密文字不可被記錄",
      signal_phase:"ongoing",perceived_cue_refs:[cue],
    },
    listener_decision:{
      turn_end_projection:status,projection_basis_refs:[cue],
      response_preparation:mode==="request_floor"?"ready":"none",
      ...(mode==="request_floor"?{response_plan_ref:response}:{})
    },
    response_preparation_context:{
      observer,available_response_plan_refs:[response],
    },
    prior_state:prior?.projection??null,
  });
  const participation=mode===null?null:
    projectCharacterCommunicationTurnParticipationIntent({
      observer,turn_projection:p,
      participation_decision:{
        mode,basis_refs:["request_floor","backchannel"].includes(mode)?[cue]:[],
        ...(mode==="request_floor"?{response_plan_ref:response}:{})
      },
      prior_state:prior?.participation_intent??null,
    });
  const selection=selectionStatus===null?null:
    projectCharacterCommunicationTurnSelectionCue({
      observer,turn_projection:p,
      selection_decision:{
        status:selectionStatus,
        basis_refs:["selected_me","selected_other"].includes(selectionStatus)
          ?[cue]:[],
      },
      prior_state:prior?.selection_cue??null,
    });
  return {
    schema_version:worldSimulationTurnIncrementHandoffVersion,
    observer,release_time_ms:release,
    projection:p,participation_intent:participation,
    selection_cue:selection,source_meaning_interpretation_id:null,
    subjective_only:true,actual_world_action_replanned:false,
  };
}
const pack=(items,resolver=true)=>({
  schema_version:worldSimulationTurnIncrementHandoffVersion,
  resolver_used:resolver,projected_count:items.length,projections:items,
  boundaries:buildWorldSimulationTurnIncrementHandoffContract(),
});
const evaluate=(items,resolver=true)=>
  buildWorldSimulationSelectionAwareReadiness({handoff:pack(items,resolver)});
const b=entry("B","request_floor","possible_completion",100,"selected_me");
const cOther=entry("C","request_floor","possible_completion",100,"selected_other");
const d=entry("D","request_floor","possible_completion",100,"uncertain");
const e=entry("E","request_floor","continuing",100,"selected_me");
const conflict=evaluate([b,cOther,d,e]);
assert.deepEqual(conflict,evaluate([b,cOther,d,e]));
assert.equal(conflict.audit.active_request_count,4);
assert.equal(conflict.audit.subjective_selected_me_request_count,1);
assert.equal(conflict.audit.subjective_selection_conflict_count,1);
assert.equal(conflict.audit.unconfirmed_self_selection_route_count,1);
assert.equal(conflict.audit.unresolved_competition_observed,true);
assert.equal(conflict.audit.entries.find(x=>x.evidence_state===
  "completion_evidence_missing").subjective_selection_status,"selected_me");
assert.equal(conflict.engine_private_evidence.floor_winner,null);
assert.equal(conflict.engine_private_evidence.speaker_selected_next,null);
assert.equal(conflict.engine_private_evidence.transition_authoritatively_available,false);
assert(conflict.audit.entries.every(x=>x.floor_awarded===false&&
  x.signal_emitted===false));
for(const word of ["祕密文字不可被記錄","response_B","signal_alpha","anonymous_voice"]){
  assert.equal(JSON.stringify(conflict.audit).includes(word),false);
}
const selectedNoRequest=entry("B","wait","possible_completion",100,"selected_me");
const selectedBackchannel=entry("B","backchannel","possible_completion",100,"selected_me");
assert.equal(evaluate([selectedNoRequest]).audit
  .selection_hint_without_floor_request_count,1);
assert.equal(evaluate([selectedNoRequest]).audit.active_request_count,0);
assert.equal(evaluate([selectedBackchannel]).audit.entries[0].evidence_state,
  "nonfloor_backchannel");
assert.equal(evaluate([selectedBackchannel]).audit.active_request_count,0);
assert.equal(evaluate([entry("B","request_floor","possible_completion",100,null)])
  .audit.unconfirmed_self_selection_route_count,1);
const first=entry("B","request_floor","possible_completion",100,"selected_me");
const withdrawn=entry("B","withdraw","possible_completion",200,
  "no_selection_evidence",first);
assert.equal(evaluate([first,withdrawn]).audit.active_request_count,0);
assert.equal(evaluate([first,withdrawn]).audit.entries[0].evidence_state,
  "withdrawn_request");
assert.equal(evaluate([first,withdrawn]).engine_private_evidence.floor_winner,null);
const earlierHint=entry("B","request_floor","possible_completion",100,
  "selected_me");
const revisedHint=entry("B","request_floor","possible_completion",200,
  "uncertain",earlierHint);
const mostRecent=evaluate([earlierHint,revisedHint]);
assert.equal(mostRecent.audit.latest_observer_signal_count,1);
assert.equal(mostRecent.audit.subjective_selected_me_request_count,0);
assert.equal(mostRecent.audit.unconfirmed_self_selection_route_count,1);
assert.equal(mostRecent.audit.entries[0].release_time_ms,200);
const legacyWithoutSelection={...b};
delete legacyWithoutSelection.selection_cue;
assert.equal(evaluate([legacyWithoutSelection]).audit
  .unconfirmed_self_selection_route_count,1);
const noResolver=evaluate([],false);
assert.equal(noResolver.audit.status,"resolver_not_installed");
assert.equal(noResolver.audit.entries.length,0);
assert.equal(evaluate([b]).audit.active_request_count,1);
assert.equal(evaluate([b]).engine_private_evidence.floor_winner,null);
assert.throws(()=>evaluate([{...b,selection_cue:{
  ...b.selection_cue,floor_awarded:true,
}}]),/exceeds observer authority/u);
assert.throws(()=>evaluate([{...b,selection_cue:{
  ...b.selection_cue,selection_cue_id:"forged",
}}]),/identity does not match/u);
assert.throws(()=>evaluate([{...b,selection_cue:{
  ...b.selection_cue,observer:"C",
}}]),/foreign or exceeds/u);
assert.throws(()=>evaluate([{...b,participation_intent:{
  ...b.participation_intent,actual_floor_claimed:true,
}}]),/exceeds its authority/u);
assert.throws(()=>evaluate([b,entry("B","request_floor",
  "possible_completion",200,"selected_me",null)]),
  /same observer-signal lineage/u);
assert.throws(()=>buildWorldSimulationSelectionAwareReadiness({
  handoff:{...pack([b]),projected_count:0}
}),/canonical CC-7D/u);
console.log("CC-7P selection-aware readiness tests passed.");
