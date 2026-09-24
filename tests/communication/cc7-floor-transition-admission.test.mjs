import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { runWorldSimulationTurnIncrementHandoff } from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import { runWorldSimulationSpeakerNextTurnIntent } from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";
import { buildWorldSimulationFloorTransitionAdmission } from "../../server/src/world-simulation-communication-floor-transition-admission-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion as cc7c } from "../../server/src/world-simulation-communication-observer-increment-service.mjs";

const h = (v,p) => `${p}_${hashAgentRunValue(v).slice(0,24)}`;
const actionId = "communication_s_aaaaaaaaaaaaaaaa", actor="A", observer="B";
const soundId="sound_cc7s_1", streamId="stream_cc7s_1";
const sourceIncrement="speech_increment_s_1";
const outcome={
  actor,action_id:actionId,result:"communication_emitted",duration_ms:100,
  communication_event:{
    schema_version:"cc1-world-communication-event-v1",
    actor,addressee:observer,channel:"speech",
    semantic_content:"絕不可洩漏語意",surface_text:"絕不可洩漏字面",
    surface_realization_complete:true,
    surface_realization:{source_action_id:actionId,surface_text:"絕不可洩漏字面"},
  },
  communication_speech_stream:{
    stream_id:streamId,source_action_id:actionId,
    increments:[{
      stream_id:streamId,increment_ref:sourceIncrement,
      sequence:1,end_offset_ms:100,signal_phase:"acoustic_segment_ended",
    }],
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
    registered_sound_link_verified:true,static_acoustics_scope_verified:true,
  },
};
async function handoffFor(mode="request_floor",selection="selected_me") {
  return runWorldSimulationTurnIncrementHandoff({
    admissions:[admission],
    resolver:async(view)=>({
      listener_decision:{
        turn_end_projection:"possible_completion",
        projection_basis_refs:[view.perceived_speech_increment.perceived_cue_refs[0]],
        response_preparation:"ready",response_plan_ref:"reply_B",
      },
      response_preparation_context:{
        observer,available_response_plan_refs:["reply_B"],
      },
      participation_decision:mode===null?null:{
        mode,basis_refs:[cue],
        ...(mode==="request_floor"?{response_plan_ref:"reply_B"}:{}),
      },
      selection_cue_decision:selection===null?null:{
        status:selection,basis_refs:[cue],
      },
    }),
  });
}
async function speakerFor(mode="nominate_addressee"){
  return runWorldSimulationSpeakerNextTurnIntent({
    action_outcomes:[outcome],
    resolver:mode===null?null:async()=>({
      mode,...(mode==="nominate_addressee"?{target:observer}:{}),
    }),
  });
}
const base={
  handoff:await handoffFor(),
  admissions:[admission],action_outcomes:[outcome],
  speaker_intent_projection:await speakerFor(),
};
const run=(overrides={})=>buildWorldSimulationFloorTransitionAdmission({
  ...base,...overrides,
});
const nomination=run();
assert.deepEqual(nomination,run());
assert.equal(nomination.audit.nomination_pending_count,1);
assert.equal(nomination.audit.self_selection_pending_count,0);
assert.equal(nomination.audit.entries[0].admission,"nomination_pending_public_signal");
assert.equal(nomination.audit.entries[0].actual_floor_awarded,false);
assert.equal(nomination.engine_private_admissions.next_speaker_selected,null);
assert.equal(nomination.engine_private_admissions.public_invitation_emitted,false);
const publicAudit=JSON.stringify(nomination.audit);
for (const forbidden of [actionId,actor,observer,streamId,soundId,
  "絕不可洩漏語意","絕不可洩漏字面","reply_B"])
  assert.equal(publicAudit.includes(forbidden),false);
const open=run({speaker_intent_projection:await speakerFor("yield_open_floor")});
assert.equal(open.audit.self_selection_pending_count,1);
assert.equal(open.audit.entries[0].admission,
  "self_selection_pending_world_action");
const retain=run({speaker_intent_projection:await speakerFor("retain_turn")});
assert.equal(retain.audit.entries[0].admission,"speaker_intends_retention");
const absent=run({speaker_intent_projection:await speakerFor(null)});
assert.equal(absent.audit.entries[0].admission,"no_authorized_transition");
const silent=run({handoff:await handoffFor(null,null)});
assert.equal(silent.audit.observer_count,1);
assert.equal(silent.audit.entries[0].admission,"no_floor_request");
const backchannel=run({handoff:await handoffFor("backchannel",null)});
assert.equal(backchannel.audit.entries[0].admission,"nonfloor_backchannel");
const conflict=run({handoff:await handoffFor("request_floor","selected_other")});
assert.equal(conflict.audit.entries[0].admission,
  "unresolved_subjective_selection_conflict");
assert.throws(()=>run({admissions:[]}),/lacks one matching admitted/u);
assert.throws(()=>run({admissions:[admission,admission]}),/Duplicate audible/u);
assert.throws(()=>run({action_outcomes:[{...outcome,actor:"C"}]}),
  /invalid realized speech source/u);
console.log("CC-7S world-owned floor transition admission tests passed.");
