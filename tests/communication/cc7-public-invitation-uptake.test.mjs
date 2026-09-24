import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { runWorldSimulationTurnIncrementHandoff } from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import { runWorldSimulationSpeakerNextTurnIntent } from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";
import { buildWorldSimulationPublicInvitationUptake as build } from "../../server/src/world-simulation-communication-public-invitation-uptake-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion as cc7c } from "../../server/src/world-simulation-communication-observer-increment-service.mjs";

const h=(v,p)=>`${p}_${hashAgentRunValue(v).slice(0,24)}`;
const actor="A", observer="B", actionId="communication_t_aaaaaaaaaaaaaaaa";
const soundId="sound_cc7t", streamId="stream_cc7t", sourceIncrement="segment_cc7t";
const surface="B，換你說。", semantic="邀請 B 接續發言";
const authoredGoal={
  character:actor,purpose:"讓 B 接續發言",addressee:observer,mode:"direct",
  public_content:semantic,
  turn_invitation_intent:{
    addressee:observer,public_content:semantic,explicit_public_invitation:true,
  },
};
const authored=buildCharacterCommunicationActionCandidate({
  character:actor,cognition:{communication_goal:authoredGoal},
});
assert.equal(authored.communication.message.speech_act,"invite_next_turn");
assert.equal(authored.communication.ir.content.speech_act,"invite_next_turn");
assert.throws(()=>buildCharacterCommunicationActionCandidate({
  character:actor,cognition:{communication_goal:{...authoredGoal,
    turn_invitation_intent:{...authoredGoal.turn_invitation_intent,addressee:"C"}}},
}),/actor-authored public direct content/u);
assert.throws(()=>buildCharacterCommunicationActionCandidate({
  character:actor,cognition:{communication_goal:{...authoredGoal,mode:"silence"}},
}),/requires direct speech/u);
const event={
  schema_version:"cc1-world-communication-event-v1",
  actor,addressee:observer,channel:"speech",speech_act:"invite_next_turn",
  semantic_content:semantic,surface_text:surface,surface_realization_complete:true,
  surface_realization:{source_action_id:actionId,surface_text:surface},
};
const outcome={
  actor,action_id:actionId,result:"communication_emitted",duration_ms:100,
  communication_event:event,
  communication_speech_stream:{
    stream_id:streamId,source_action_id:actionId,
    increments:[{stream_id:streamId,increment_ref:sourceIncrement,
      sequence:1,end_offset_ms:100,signal_phase:"acoustic_segment_ended"}],
  },
  communication_acoustic_signal:{registered:true,source_action_id:actionId,sound_id:soundId},
};
const signal=h({version:cc7c,observer,sound_id:soundId},"observer_signal");
const increment=h({version:cc7c,signal_ref:signal,increment_ref:sourceIncrement},"observer_increment");
const cue=h({version:cc7c,signal_ref:signal,increment_ref:sourceIncrement},"audible_cue");
const admission={
  schema_version:cc7c,observer,release_time_ms:100,
  admission_status:"heard_acoustic_cues_only",
  observer_increment:{
    schema_version:"cc7-observer-speech-increment-v1",
    observer,signal_ref:signal,increment_ref:increment,
    signal_phase:"acoustic_segment_ended",perceived_cue_refs:[cue],
    heard_surface_fragment:null,perceived_speaker:null,
    lexical_intelligibility_attested:false,speaker_identity_recognized:false,
    release_time_ms:100,no_future_increment_exposed:true,
  },
  audit:{
    source_stream_id:streamId,source_action_id:actionId,source_sound_id:soundId,
    source_speaker:actor,registered_sound_link_verified:true,
    static_acoustics_scope_verified:true,
  },
};
const handoff=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
  resolver:async(view)=>({
    listener_decision:{
      turn_end_projection:"possible_completion",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"ready",response_plan_ref:"reply_B",
    },
    response_preparation_context:{observer,available_response_plan_refs:["reply_B"]},
    participation_decision:{mode:"request_floor",basis_refs:[cue],response_plan_ref:"reply_B"},
    selection_cue_decision:{status:"selected_me",basis_refs:[cue]},
  }),
});
const speaker=await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes:[outcome],
  resolver:async()=>({mode:"nominate_addressee",target:observer}),
});
const selected=[{
  character:actor,
  candidate:{action_id:actionId,communication:{
    channel:"speech",addressee:observer,
    message:{speech_act:"invite_next_turn",semantic_content:semantic},
  }},
}];
const base={
  handoff,admissions:[admission],action_outcomes:[outcome],
  speaker_intent_projection:speaker,selected_action_intents:selected,
};
const run=(changes={})=>build({...base,...changes});
const accepted=run();
assert.deepEqual(accepted,run(),"The World audit must be deterministic.");
assert.equal(accepted.audit.status,"public_and_subjective_evidence_join_only");
assert.equal(accepted.audit.audible_invitation_count,1);
assert.equal(accepted.audit.current_observer_projection_count,1);
assert.equal(accepted.audit.convergent_request_count,1);
assert.equal(accepted.audit.entries[0].target_relation,"nominated_observer");
assert.equal(accepted.audit.entries[0].subjective_selection,"selected_me");
assert.equal(accepted.audit.entries[0].subjective_readiness,"subjective_selected_me_request");
assert.equal(accepted.audit.entries[0].evidence_relation,
  "public_invitation_and_subjective_request_coincide");
assert.equal(accepted.audit.entries[0].lexical_invitation_understood,false);
assert.equal(accepted.audit.entries[0].actual_floor_awarded,false);
assert.equal(accepted.engine_private_evidence.entries.length,1);
assert.equal(accepted.engine_private_evidence.entries[0].observer,observer);
assert.equal(accepted.engine_private_evidence.entries[0].response_plan_ref,"reply_B");
assert.equal(accepted.engine_private_evidence.entries[0].evidence_relation,
  "public_invitation_and_subjective_request_coincide");
assert.equal(accepted.engine_private_evidence.next_speaker_selected,null);
assert.equal(accepted.engine_private_evidence.world_action_replanned,false);
for(const secret of [actionId,actor,observer,soundId,streamId,surface,semantic,
  "reply_B","nominate_addressee"])
  assert.equal(JSON.stringify(accepted.audit).includes(secret),false,
    `World history leaked ${secret}`);
assert.equal(accepted.audit.boundaries.hidden_speaker_intent_forwarded_to_listener,false);

const noResolver=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
});
const noProjection=run({handoff:noResolver});
assert.equal(noProjection.audit.audible_invitation_count,1);
assert.equal(noProjection.audit.current_observer_projection_count,0);
assert.equal(noProjection.audit.convergent_request_count,0);
assert.equal(noProjection.audit.entries[0].evidence_relation,"no_current_projection");

// Hearing an invitation does not make a nonrequesting observer ready.
const waiting=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],resolver:async(view)=>({
    listener_decision:{turn_end_projection:"uncertain",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"none"},
  }),
});
const waitingEvidence=run({handoff:waiting});
assert.equal(waitingEvidence.audit.current_observer_projection_count,1);
assert.equal(waitingEvidence.audit.convergent_request_count,0);
assert.equal(waitingEvidence.audit.entries[0].evidence_relation,
  "independent_subjective_evidence");

// A physically admitted bystander can have an independent, mistaken belief
// that they were selected. It cannot become the public speaker's intention.
const C="C";
const cSignal=h({version:cc7c,observer:C,sound_id:soundId},"observer_signal");
const cIncrement=h({version:cc7c,signal_ref:cSignal,
  increment_ref:sourceIncrement},"observer_increment");
const cCue=h({version:cc7c,signal_ref:cSignal,
  increment_ref:sourceIncrement},"audible_cue");
const bystander={...admission,observer:C,
  observer_increment:{...admission.observer_increment,observer:C,
    signal_ref:cSignal,increment_ref:cIncrement,perceived_cue_refs:[cCue]}};
const both=[admission,bystander];
const bothHandoff=await runWorldSimulationTurnIncrementHandoff({
  admissions:both,resolver:async(view)=>({
    listener_decision:{turn_end_projection:"possible_completion",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"ready",response_plan_ref:"reply_B"},
    response_preparation_context:{observer:view.observer,
      available_response_plan_refs:["reply_B"]},
    participation_decision:{mode:"request_floor",
      basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_plan_ref:"reply_B"},
    selection_cue_decision:{status:"selected_me",
      basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]]},
  }),
});
const joined=run({handoff:bothHandoff,admissions:both});
assert.equal(joined.audit.audible_invitation_count,2);
assert.equal(joined.audit.current_observer_projection_count,2);
assert.equal(joined.audit.convergent_request_count,1);
assert.deepEqual(joined.audit.entries.map(x=>x.evidence_relation),[
  "public_invitation_and_subjective_request_coincide",
  "subjective_selection_conflicts_with_source",
]);
assert(joined.audit.entries.every(x=>x.actual_floor_awarded===false
  && x.lexical_invitation_understood===false));
assert.equal(JSON.stringify(joined.audit).includes(C),false);

// An admitted source without the matching public action is not invitation
// evidence; a private nomination without selected public speech is not enough.
const absentPublic=run({action_outcomes:[{...outcome,
  communication_event:{...event,speech_act:"question"}}]});
assert.equal(absentPublic.audit.audible_invitation_count,0);
const withoutNomination=run({speaker_intent_projection:
  await runWorldSimulationSpeakerNextTurnIntent({action_outcomes:[outcome]})});
assert.equal(withoutNomination.audit.audible_invitation_count,0);
const noSound=run({handoff:await runWorldSimulationTurnIncrementHandoff({
  admissions:[]}),admissions:[]});
assert.equal(noSound.audit.audible_invitation_count,0);
assert.throws(()=>run({admissions:[]}),/lacks one matching admitted/u);
assert.throws(()=>run({selected_action_intents:[]}),
  /selected emitted audible speech/u);
assert.throws(()=>run({admissions:[{...admission,
  audit:{...admission.audit,source_sound_id:"foreign"}}]}),
  /acoustic receipt is foreign/u);
console.log("CC-7U public invitation observer uptake tests passed.");
