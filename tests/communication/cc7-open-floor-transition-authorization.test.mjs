import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { runWorldSimulationTurnIncrementHandoff } from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import { runWorldSimulationSpeakerNextTurnIntent } from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";
import { buildWorldSimulationOpenFloorTransitionAuthorization as build } from "../../server/src/world-simulation-communication-open-floor-transition-authorization-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion as cc7c } from "../../server/src/world-simulation-communication-observer-increment-service.mjs";

const h=(v,p)=>`${p}_${hashAgentRunValue(v).slice(0,24)}`;
const actor="A", actionId="communication_w_aaaaaaaaaaaaaaaa";
const soundId="sound_cc7w", streamId="stream_cc7w", sourceIncrement="segment_cc7w";
const surface="我說完了。", semantic="A completes the current contribution";
const outcome={
  actor,action_id:actionId,result:"communication_emitted",duration_ms:100,
  communication_event:{
    schema_version:"cc1-world-communication-event-v1",
    actor,addressee:"B",channel:"speech",
    semantic_content:semantic,surface_text:surface,
    surface_realization_complete:true,
    surface_realization:{source_action_id:actionId,surface_text:surface},
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

function admissionFor(observer, release=100) {
  const signal=h({version:cc7c,observer,sound_id:soundId},"observer_signal");
  const increment=h({version:cc7c,signal_ref:signal,
    increment_ref:sourceIncrement},"observer_increment");
  const cue=h({version:cc7c,signal_ref:signal,
    increment_ref:sourceIncrement},"audible_cue");
  return {
    schema_version:cc7c,observer,release_time_ms:release,
    admission_status:"heard_acoustic_cues_only",
    observer_increment:{
      schema_version:"cc7-observer-speech-increment-v1",
      observer,signal_ref:signal,increment_ref:increment,
      signal_phase:"acoustic_segment_ended",perceived_cue_refs:[cue],
      heard_surface_fragment:null,perceived_speaker:null,
      lexical_intelligibility_attested:false,speaker_identity_recognized:false,
      release_time_ms:release,no_future_increment_exposed:true,
    },
    audit:{
      source_stream_id:streamId,source_action_id:actionId,source_sound_id:soundId,
      source_speaker:actor,registered_sound_link_verified:true,
      static_acoustics_scope_verified:true,
    },
  };
}

async function handoffFor(admissions, decide) {
  return runWorldSimulationTurnIncrementHandoff({
    admissions,
    resolver:async(view)=>{
      const cue=view.perceived_speech_increment.perceived_cue_refs[0];
      const plan=`reply_${view.observer}`;
      const choice=decide(view.observer);
      return {
        listener_decision:{
          turn_end_projection:choice.projection ?? "possible_completion",
          projection_basis_refs:[cue],
          response_preparation:choice.mode==="request_floor"?"ready":"none",
          ...(choice.mode==="request_floor"?{response_plan_ref:plan}:{}),
        },
        ...(choice.mode==="request_floor"?{
          response_preparation_context:{
            observer:view.observer,available_response_plan_refs:[plan],
          },
        }:{}),
        ...(choice.mode?{
          participation_decision:{
            mode:choice.mode,
            basis_refs:["request_floor","backchannel"].includes(choice.mode)?[cue]:[],
            ...(choice.mode==="request_floor"?{response_plan_ref:plan}:{}),
          },
        }:{}),
        ...(choice.selection?{
          selection_cue_decision:{status:choice.selection,basis_refs:[cue]},
        }:{}),
      };
    },
  });
}

async function speaker(mode) {
  return runWorldSimulationSpeakerNextTurnIntent({
    action_outcomes:[outcome],
    resolver:async()=>({
      mode,
      ...(mode==="nominate_addressee"?{target:"B"}:{}),
    }),
  });
}

const b=admissionFor("B");
const oneHandoff=await handoffFor([b],()=>({mode:"request_floor",selection:"uncertain"}));
const base={
  handoff:oneHandoff,admissions:[b],action_outcomes:[outcome],
  speaker_intent_projection:await speaker("yield_open_floor"),
};
const run=(changes={})=>build({...base,...changes});

const authorized=run();
assert.deepEqual(authorized,run(),"CC-7W authorization must be deterministic.");
assert.equal(authorized.audit.status,"open_floor_future_transition_authorized");
assert.equal(authorized.audit.self_selection_candidate_count,1);
assert.equal(authorized.audit.distinct_candidate_observer_count,1);
assert.equal(authorized.audit.next_speaker_selected,true);
assert.equal(authorized.audit.selected_transition.authorization,
  "future_open_floor_self_selection");
assert.equal(authorized.audit.selected_transition.actual_floor_awarded,false);
assert.equal(authorized.audit.selected_transition.response_emitted,false);
assert.equal(authorized.engine_private_authorization.next_speaker_selected,"B");
assert.equal(authorized.engine_private_authorization.response_plan_ref,"reply_B");
assert.equal(authorized.engine_private_authorization.future_turn_execution_required,true);
assert.equal(authorized.engine_private_authorization.actual_floor_awarded,false);
assert.equal(authorized.engine_private_authorization.world_action_replanned,false);
assert.equal(authorized.audit.boundaries.arrival_order_is_not_priority,true);
assert.equal(authorized.audit.boundaries.same_release_time_is_not_tie_breaker,true);
assert.equal(authorized.audit.boundaries.competition_requires_later_arbitration,true);
assert.equal(authorized.audit.boundaries.backchannel_is_not_self_selection,true);
assert.equal(authorized.audit.boundaries.overlap_or_interruption_judged,false);
assert.equal(authorized.audit.boundaries.fixed_gap_threshold_used,false);
for(const secret of [actor,"B",actionId,soundId,streamId,surface,semantic,
  "reply_B","yield_open_floor"])
  assert.equal(JSON.stringify(authorized.audit).includes(secret),false,
    `CC-7W audit leaked ${secret}`);

const nominated=run({speaker_intent_projection:await speaker("nominate_addressee")});
assert.equal(nominated.audit.status,"no_open_floor_transition_authorized");
assert.equal(nominated.audit.next_speaker_selected,false);

const retained=run({speaker_intent_projection:await speaker("retain_turn")});
assert.equal(retained.audit.status,"no_open_floor_transition_authorized");
assert.equal(retained.audit.next_speaker_selected,false);

const backchannel=await handoffFor([b],()=>({mode:"backchannel"}));
assert.equal(run({handoff:backchannel}).audit.next_speaker_selected,false);

const conflict=await handoffFor([b],()=>({
  mode:"request_floor",selection:"selected_other",
}));
assert.equal(run({handoff:conflict}).audit.next_speaker_selected,false);

// Two valid self-selectors remain unresolved. Reversing input order must not
// manufacture a winner or use release/array order as priority.
const c=admissionFor("C");
const both=[b,c];
const bothHandoff=await handoffFor(both,()=>({
  mode:"request_floor",selection:"uncertain",
}));
const competition=build({
  handoff:bothHandoff,admissions:both,action_outcomes:[outcome],
  speaker_intent_projection:await speaker("yield_open_floor"),
});
assert.equal(competition.audit.status,"open_floor_competition_deferred");
assert.equal(competition.audit.self_selection_candidate_count,2);
assert.equal(competition.audit.distinct_candidate_observer_count,2);
assert.equal(competition.audit.next_speaker_selected,false);
assert.equal(competition.engine_private_authorization.next_speaker_selected,null);
assert.equal(competition.engine_private_authorization.future_turn_execution_required,false);

const reverseHandoff=await handoffFor([c,b],()=>({
  mode:"request_floor",selection:"uncertain",
}));
const reversed=build({
  handoff:reverseHandoff,admissions:[c,b],action_outcomes:[outcome],
  speaker_intent_projection:await speaker("yield_open_floor"),
});
assert.equal(reversed.audit.status,"open_floor_competition_deferred");
assert.equal(reversed.audit.next_speaker_selected,false);

// Subjective completion without an actual request does not self-select.
const silent=await handoffFor([b],()=>({mode:"wait"}));
assert.equal(run({handoff:silent}).audit.next_speaker_selected,false);

assert.throws(()=>run({admissions:[]}),/lacks one matching admitted/u);
assert.throws(()=>run({admissions:[{...b,
  audit:{...b.audit,source_sound_id:"foreign"}}]}),/acoustic receipt is foreign/u);

// Native World wiring: an ordinary realized speech contribution can end with
// speaker-authored yield_open_floor. B's current request may then become the
// one future self-selected speaker without exposing the private speaker intent.
const nativeRoot=path.join(projectRoot,"tests",".tmp",
  `cc7w-native-open-floor-${process.pid}-${Date.now()}`);
const nativeOptions={fixtureRoot:nativeRoot};
await rm(nativeRoot,{recursive:true,force:true});
try {
  const nativeSemantic="男孩已離開房子";
  const session=await beginWorldSimulationSession({
    simulation_label:"CC-7W native open-floor self-selection",
    seed:"cc7w-native-open-floor",
    rules:{
      event_driven:true,persistent_causality:true,
      communication_action_seconds:0.25,
      communication_speech_stream_increment_max_chars:3,
    },
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00+08:00",
      event_queue:[{
        event_id:"evt-cc7w",type:"conversation",scene_id:"room",
        participants:["A","B"],summary:"A finishes a contribution and yields",
      }],
      scenes:{room:{
        entity_positions:{A:{x:2,y:2},B:{x:3,y:2}},
        audibility_profiles:{B:{minimum_audible_db:35}},
        observable_by:{
          A:{visual:[],audible:[]},
          B:{visual:[],audible:[]},
        },
      }},
      characters:{
        A:{
          known:[nativeSemantic],current_goal:"告知 B",
          relationships:{B:"朋友"},
          speech_acoustics:{sound_level_db_at_1m:60},
          communication_goal:{
            character:"A",purpose:"告知",addressee:"B",mode:"direct",
            public_content:nativeSemantic,claim_kind:"sincere_assertion",
            surface_realization:{
              schema_version:"cc5-mandarin-clause-request-v1",
              semantic_anchor:nativeSemantic,
              clause:{
                subject:"男孩",predicate:"離開",aspect_particle:"了",object:"房子",
              },
            },
          },
        },
        B:{known:[],current_goal:"等待 A 說完",relationships:{A:"朋友"}},
      },
      memories:{A:[],B:[]},
      available_actions:{A:[],B:[]},
    },
  },nativeOptions);
  const manager=createWorldSimulationCharacterRuntimeManager({
    identityResolver:async(character)=>({
      entity_id:`character_${character.toLowerCase()}`,
      canonical_name:character,
      identity_source:"cc7w_test_identity_resolver",
      formal:true,
    }),
  });
  const listenerViews=[];
  const result=await runWorldSimulationTurn({
    world_simulation_session_id:session.world_simulation_session_id,
    event_id:"evt-cc7w",
  },{
    ...nativeOptions,
    characterRuntimeManager:manager,
    characterCommunicationSpeakerNextTurnResolver:async(view)=>{
      assert.equal(view.actor,"A");
      return {mode:"yield_open_floor"};
    },
    characterCommunicationTurnIncrementResolver:async(view)=>{
      assert.equal(view.observer,"B");
      listenerViews.push(structuredClone(view));
      const cue=view.perceived_speech_increment.perceived_cue_refs[0];
      return {
        listener_decision:{
          turn_end_projection:"possible_completion",
          projection_basis_refs:[cue],
          response_preparation:"ready",
          response_plan_ref:"cc7w_reply_B",
        },
        response_preparation_context:{
          observer:"B",available_response_plan_refs:["cc7w_reply_B"],
        },
        participation_decision:{
          mode:"request_floor",basis_refs:[cue],response_plan_ref:"cc7w_reply_B",
        },
        selection_cue_decision:{status:"uncertain",basis_refs:[]},
      };
    },
    characterBrain:async(packet)=>{
      if(packet.character!=="A") return "reject_all";
      const candidate=packet.candidate_action_intents.find(
        item=>item.communication?.surface_realization_complete===true,
      );
      assert.ok(candidate);
      return {action_id:candidate.action_id};
    },
  });
  assert.equal(result.committed,true);
  assert(listenerViews.length>0);
  assert.equal(JSON.stringify(listenerViews).includes("yield_open_floor"),false);
  const history=await getWorldSimulationHistory(
    session.world_simulation_session_id,nativeOptions);
  const turn=history.turns.at(-1);
  const openFloor=turn.communication_open_floor_transition_authorization;
  assert.equal(openFloor.status,"open_floor_future_transition_authorized");
  assert.equal(openFloor.self_selection_candidate_count,1);
  assert.equal(openFloor.distinct_candidate_observer_count,1);
  assert.equal(openFloor.next_speaker_selected,true);
  assert.equal(openFloor.selected_transition.authorization,
    "future_open_floor_self_selection");
  assert.equal(openFloor.selected_transition.actual_floor_awarded,false);
  assert.equal(openFloor.selected_transition.response_emitted,false);
  assert.equal(openFloor.boundaries.arrival_order_is_not_priority,true);
  assert.equal(openFloor.boundaries.current_turn_world_action_replanned,false);
  assert.equal(JSON.stringify(openFloor).includes("cc7w_reply_B"),false);
  assert.equal(JSON.stringify(openFloor).includes(nativeSemantic),false);
  const nominated=turn.communication_nominated_transition_authorization;
  assert.equal(nominated.next_speaker_selected,false);
  assert.equal(nominated.status,"no_nominated_transition_authorized");
} finally {
  await rm(nativeRoot,{recursive:true,force:true});
}

console.log("CC-7W open-floor self-selection authorization tests passed.");
