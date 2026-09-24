import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  runWorldSimulationTurnIncrementHandoff,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import {
  runWorldSimulationSpeakerNextTurnIntent,
} from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";
import {
  buildWorldSimulationSourceLineageReconciliation,
  buildWorldSimulationSourceLineageReconciliationContract,
} from "../../server/src/world-simulation-communication-source-lineage-reconciliation-service.mjs";
import {
  worldSimulationObserverSpeechIncrementVersion as cc7c,
} from "../../server/src/world-simulation-communication-observer-increment-service.mjs";

const h=(value,prefix)=>
  `${prefix}_${hashAgentRunValue(value).slice(0,24)}`;
const actionId="communication_r_aaaaaaaaaaaaaaaa";
const actor="A", observer="B", soundId="sound_cc7r_1";
const streamId="stream_cc7r_1", sourceIncrement="speech_increment_1";
const outcome={
  actor,action_id:actionId,result:"communication_emitted",duration_ms:100,
  communication_event:{
    schema_version:"cc1-world-communication-event-v1",
    actor,addressee:observer,channel:"speech",
    semantic_content:"絕不能流出的語意",
    surface_text:"絕不能流出的字面",
    surface_realization_complete:true,
    surface_realization:{
      source_action_id:actionId,surface_text:"絕不能流出的字面",
    },
  },
  communication_speech_stream:{
    stream_id:streamId,source_action_id:actionId,
    increments:[{stream_id:streamId,increment_ref:sourceIncrement,
      sequence:1,end_offset_ms:100,signal_phase:"acoustic_segment_ended"}],
  },
  communication_acoustic_signal:{
    registered:true,source_action_id:actionId,sound_id:soundId,
  },
};
const signal=h({version:cc7c,observer,sound_id:soundId},"observer_signal");
const increment=h({
  version:cc7c,signal_ref:signal,increment_ref:sourceIncrement,
},"observer_increment");
const cue=h({
  version:cc7c,signal_ref:signal,increment_ref:sourceIncrement,
},"audible_cue");
const admission={
  schema_version:cc7c,observer,release_time_ms:100,
  admission_status:"heard_acoustic_cues_only",
  observer_increment:{
    schema_version:"cc7-observer-speech-increment-v1",
    observer,signal_ref:signal,increment_ref:increment,
    signal_phase:"acoustic_segment_ended",
    perceived_cue_refs:[cue],heard_surface_fragment:null,
    perceived_speaker:null,lexical_intelligibility_attested:false,
    speaker_identity_recognized:false,release_time_ms:100,
    no_future_increment_exposed:true,
  },
  audit:{
    source_stream_id:streamId,source_action_id:actionId,
    source_sound_id:soundId,source_speaker:actor,
    registered_sound_link_verified:true,
    static_acoustics_scope_verified:true,
  },
};
const handoff=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
  resolver:async(view)=>({
    listener_decision:{
      turn_end_projection:"possible_completion",
      projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
      response_preparation:"ready",
      response_plan_ref:"reply_B",
    },
    response_preparation_context:{
      observer,available_response_plan_refs:["reply_B"],
    },
    participation_decision:{
      mode:"request_floor",basis_refs:[cue],
      response_plan_ref:"reply_B",
    },
    selection_cue_decision:{
      status:"selected_me",basis_refs:[cue],
    },
  }),
});
assert.equal(handoff.projected_count,1);
const speaker=await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes:[outcome],
  resolver:async()=>({mode:"nominate_addressee",target:observer}),
});
const input={
  handoff,admissions:[admission],action_outcomes:[outcome],
  speaker_intent_projection:speaker,
};
const check=(overrides={})=>
  buildWorldSimulationSourceLineageReconciliation({...input,...overrides});
const contract=buildWorldSimulationSourceLineageReconciliationContract();
assert.equal(contract.world_owned_source_action_link_required,true);
assert.equal(contract.anonymous_perceived_speaker_not_used_as_world_identity,true);
assert.equal(contract.actual_floor_awarded,false);
assert.equal(contract.private_world_join_never_forwarded_to_character_resolver,true);
const joined=check();
assert.deepEqual(joined,check());
assert.equal(joined.audit.eligible_source_count,1);
assert.equal(joined.audit.audible_receipt_count,1);
assert.equal(joined.audit.emitted_speaker_intention_count,1);
assert.equal(joined.audit.linked_latest_observer_count,1);
assert.equal(joined.audit.unmatched_intention_count,0);
assert.equal(joined.audit.entries[0].speaker_intent_relation,
  "speaker_intends_nominate_this_observer");
assert.equal(joined.audit.entries[0].listener_evidence_state,
  "subjective_selected_me_request");
assert.equal(joined.engine_private_world_evidence.joined_observer_sources[0]
  .source_action_id,actionId);
assert.equal(joined.engine_private_world_evidence.joined_observer_sources[0]
  .source_actor,actor);
assert.equal(joined.engine_private_world_evidence.actual_floor_awarded,false);
assert.equal(joined.engine_private_world_evidence.next_speaker_selected,null);
const serial=JSON.stringify(joined.audit);
for(const forbidden of [
  actionId,actor,soundId,streamId,signal,increment,cue,
  "絕不能流出的語意","絕不能流出的字面","reply_B",
]) assert.equal(serial.includes(forbidden),false);

const noSpeaker=await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes:[outcome],
});
const without=check({speaker_intent_projection:noSpeaker});
assert.equal(without.audit.emitted_speaker_intention_count,0);
assert.equal(without.audit.entries[0].speaker_intent_relation,
  "no_speaker_intention");
const silent=check({handoff:{
  ...handoff,projected_count:0,projections:[],
}});
const noAcousticSource={...outcome,
  communication_speech_stream:undefined,
  communication_acoustic_signal:undefined,
};
const speakerWithoutAudio=check({
  handoff:{...handoff,projected_count:0,projections:[]},
  admissions:[],
  action_outcomes:[noAcousticSource],
});
assert.equal(speakerWithoutAudio.audit.eligible_source_count,1);
assert.equal(speakerWithoutAudio.audit.linked_latest_observer_count,0);
assert.equal(speakerWithoutAudio.audit.unmatched_intention_count,1);
assert.throws(()=>check({
  action_outcomes:[noAcousticSource],
}),/foreign or not actually admitted/u);
assert.equal(silent.audit.linked_latest_observer_count,0);
assert.equal(silent.audit.unmatched_intention_count,1);
const noResolver=await runWorldSimulationTurnIncrementHandoff({
  admissions:[admission],
});
assert.equal(check({handoff:noResolver}).audit.linked_latest_observer_count,0);
const bad=(overrides,pattern)=>assert.throws(()=>check(overrides),pattern);
bad({admissions:[]},/lacks one matching admitted/u);
bad({admissions:[admission,admission]},/Duplicate audible/u);
bad({admissions:[{...admission,release_time_ms:99}]},
  /not actually admitted/u);
bad({admissions:[{...admission,audit:{
  ...admission.audit,source_action_id:"foreign",
}}]},/foreign or not actually admitted/u);
bad({admissions:[{...admission,audit:{
  ...admission.audit,source_sound_id:"foreign",
}}]},/foreign or not actually admitted/u);
bad({admissions:[{...admission,observer_increment:{
  ...admission.observer_increment,signal_ref:"forged",
}}]},/not linked to a current stream/u);
bad({admissions:[{...admission,observer_increment:{
  ...admission.observer_increment,increment_ref:"future",
}}]},/not linked to a current stream/u);
bad({admissions:[{...admission,observer_increment:{
  ...admission.observer_increment,release_time_ms:200,
},release_time_ms:200}]},/not linked to a current stream/u);
bad({speaker_intent_projection:{...speaker,
  engine_private_intentions:[{...speaker.engine_private_intentions[0],
    actor:"C"}],
}},/foreign or exceeds/u);
bad({speaker_intent_projection:{...speaker,
  engine_private_intentions:[{...speaker.engine_private_intentions[0],
    intention_id:"forged"}],
}},/identity differs/u);
bad({speaker_intent_projection:{...speaker,
  audit:{...speaker.audit,decision_count:2},
}},/audit counts disagree/u);
bad({handoff:{...handoff,projections:[{
  ...handoff.projections[0],projection:{
    ...handoff.projections[0].projection,
    projection_id:"forged",
  },
}]}},/identity/u);
assert.equal(check({admissions:[
  {...admission,admission_status:"not_audible",observer_increment:null},
  admission,
]}).audit.linked_latest_observer_count,1);
console.log("CC-7R World-owned source lineage reconciliation tests passed.");
