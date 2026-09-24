import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { runWorldSimulationTurnIncrementHandoff } from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import { runWorldSimulationSpeakerNextTurnIntent } from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";
import { buildWorldSimulationNominatedTransitionAuthorization as build } from "../../server/src/world-simulation-communication-nominated-transition-authorization-service.mjs";
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
const authorized=run();
assert.deepEqual(authorized,run(),"CC-7V authorization must be deterministic.");
assert.equal(authorized.audit.status,"nominated_future_transition_authorized");
assert.equal(authorized.audit.convergent_nomination_candidate_count,1);
assert.equal(authorized.audit.next_speaker_selected,true);
assert.equal(authorized.audit.selected_transition.authorization,
  "future_nominated_turn_selected");
assert.equal(authorized.audit.selected_transition.actual_floor_awarded,false);
assert.equal(authorized.audit.selected_transition.response_emitted,false);
assert.equal(authorized.engine_private_authorization.next_speaker_selected,observer);
assert.equal(authorized.engine_private_authorization.response_plan_ref,"reply_B");
assert.equal(authorized.engine_private_authorization.future_turn_execution_required,true);
assert.equal(authorized.engine_private_authorization.actual_floor_awarded,false);
assert.equal(authorized.engine_private_authorization.world_action_replanned,false);
for(const secret of [actionId,actor,observer,soundId,streamId,surface,semantic,
  "reply_B","nominate_addressee"])
  assert.equal(JSON.stringify(authorized.audit).includes(secret),false,
    `CC-7V persisted audit leaked ${secret}`);
assert.equal(authorized.audit.boundaries.public_invitation_alone_does_not_select,true);
assert.equal(authorized.audit.boundaries.subjective_selected_me_alone_does_not_select,true);
assert.equal(authorized.audit.boundaries.open_floor_self_selection_deferred,true);
assert.equal(authorized.audit.boundaries.overlap_or_interruption_judged,false);
assert.equal(authorized.audit.boundaries.fixed_gap_threshold_used,false);

const noResolver=await runWorldSimulationTurnIncrementHandoff({admissions:[admission]});
const noProjection=run({handoff:noResolver});
assert.equal(noProjection.audit.status,"no_nominated_transition_authorized");
assert.equal(noProjection.audit.next_speaker_selected,false);
assert.equal(noProjection.engine_private_authorization.next_speaker_selected,null);

// Merely believing "selected me" without requesting the floor preserves silence.
const hintOnly=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
  resolver:async(view)=>({
    listener_decision:{
      turn_end_projection:"possible_completion",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"none",
    },
    selection_cue_decision:{
      status:"selected_me",
      basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
    },
  }),
});
const hinted=run({handoff:hintOnly});
assert.equal(hinted.audit.status,"no_nominated_transition_authorized");
assert.equal(hinted.audit.convergent_nomination_candidate_count,0);

// A ready request that the observer itself interprets as selecting somebody
// else cannot be converted into an authoritative nomination for this observer.
const conflict=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
  resolver:async(view)=>({
    listener_decision:{
      turn_end_projection:"possible_completion",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"ready",response_plan_ref:"reply_B",
    },
    response_preparation_context:{observer,available_response_plan_refs:["reply_B"]},
    participation_decision:{
      mode:"request_floor",
      basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_plan_ref:"reply_B",
    },
    selection_cue_decision:{
      status:"selected_other",
      basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
    },
  }),
});
const conflicted=run({handoff:conflict});
assert.equal(conflicted.audit.status,"no_nominated_transition_authorized");
assert.equal(conflicted.audit.next_speaker_selected,false);

// Two separately valid nominations in one unresolved interaction context do
// not get ordered by release time, actor id, or array order. Multiparty/track
// arbitration is a later concern, so CC-7V fails closed to "deferred".
const actor2="C", observer2="D";
const actionId2="communication_v_cccccccccccccccc";
const soundId2="sound_cc7v_2", streamId2="stream_cc7v_2";
const sourceIncrement2="segment_cc7v_2";
const surface2="D，換你說。", semantic2="邀請 D 接續發言";
const outcome2={
  actor:actor2,action_id:actionId2,result:"communication_emitted",duration_ms:120,
  communication_event:{
    schema_version:"cc1-world-communication-event-v1",
    actor:actor2,addressee:observer2,channel:"speech",speech_act:"invite_next_turn",
    semantic_content:semantic2,surface_text:surface2,surface_realization_complete:true,
    surface_realization:{source_action_id:actionId2,surface_text:surface2},
  },
  communication_speech_stream:{
    stream_id:streamId2,source_action_id:actionId2,
    increments:[{stream_id:streamId2,increment_ref:sourceIncrement2,
      sequence:1,end_offset_ms:120,signal_phase:"acoustic_segment_ended"}],
  },
  communication_acoustic_signal:{
    registered:true,source_action_id:actionId2,sound_id:soundId2,
  },
};
const signal2=h({version:cc7c,observer:observer2,sound_id:soundId2},"observer_signal");
const increment2=h({version:cc7c,signal_ref:signal2,
  increment_ref:sourceIncrement2},"observer_increment");
const cue2=h({version:cc7c,signal_ref:signal2,
  increment_ref:sourceIncrement2},"audible_cue");
const admission2={
  schema_version:cc7c,observer:observer2,release_time_ms:120,
  admission_status:"heard_acoustic_cues_only",
  observer_increment:{
    schema_version:"cc7-observer-speech-increment-v1",
    observer:observer2,signal_ref:signal2,increment_ref:increment2,
    signal_phase:"acoustic_segment_ended",perceived_cue_refs:[cue2],
    heard_surface_fragment:null,perceived_speaker:null,
    lexical_intelligibility_attested:false,speaker_identity_recognized:false,
    release_time_ms:120,no_future_increment_exposed:true,
  },
  audit:{
    source_stream_id:streamId2,source_action_id:actionId2,source_sound_id:soundId2,
    source_speaker:actor2,registered_sound_link_verified:true,
    static_acoustics_scope_verified:true,
  },
};
const bothAdmissions=[admission,admission2];
const bothHandoff=await runWorldSimulationTurnIncrementHandoff({
  admissions:bothAdmissions,
  resolver:async(view)=>{
    const plan=view.observer===observer?"reply_B":"reply_D";
    const perceived=view.perceived_speech_increment.perceived_cue_refs[0];
    return {
      listener_decision:{
        turn_end_projection:"possible_completion",
        projection_basis_refs:[perceived],
        response_preparation:"ready",response_plan_ref:plan,
      },
      response_preparation_context:{
        observer:view.observer,available_response_plan_refs:[plan],
      },
      participation_decision:{
        mode:"request_floor",basis_refs:[perceived],response_plan_ref:plan,
      },
      selection_cue_decision:{status:"selected_me",basis_refs:[perceived]},
    };
  },
});
const bothSpeaker=await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes:[outcome,outcome2],
  resolver:async(view)=>({
    mode:"nominate_addressee",target:view.current_public_addressee,
  }),
});
const bothSelected=[
  selected[0],
  {character:actor2,candidate:{action_id:actionId2,communication:{
    channel:"speech",addressee:observer2,
    message:{speech_act:"invite_next_turn",semantic_content:semantic2},
  }}},
];
const deferred=build({
  handoff:bothHandoff,admissions:bothAdmissions,
  action_outcomes:[outcome,outcome2],
  speaker_intent_projection:bothSpeaker,
  selected_action_intents:bothSelected,
});
assert.equal(deferred.audit.status,"multiple_nominated_transitions_deferred");
assert.equal(deferred.audit.convergent_nomination_candidate_count,2);
assert.equal(deferred.audit.next_speaker_selected,false);
assert.equal(deferred.engine_private_authorization.next_speaker_selected,null);
assert.equal(deferred.engine_private_authorization.future_turn_execution_required,false);

// CC-7V must fail through the upstream canonical lineage gates rather than
// trusting a selected-action label or an acoustic receipt by itself.
assert.throws(()=>run({selected_action_intents:[]}),
  /selected emitted audible speech/u);
assert.throws(()=>run({admissions:[{...admission,
  audit:{...admission.audit,source_sound_id:"foreign"}}]}),
  /acoustic receipt is foreign/u);

console.log("CC-7V nominated public transition authorization tests passed.");
