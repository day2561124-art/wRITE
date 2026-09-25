import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  getWorldSimulationHistory,getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  assessWorldSimulationPendingAcousticCancellation,
  worldSimulationNativePendingCancellationVersion,
} from "../../server/src/world-simulation-native-committed-source-service.mjs";

const fixtureRoot=path.join(projectRoot,"tests",".tmp",
  "cc7af-pending-cancel-"+process.pid+"-"+Date.now());
const options={fixtureRoot};
await rm(fixtureRoot,{recursive:true,force:true});
const runtime=createWorldSimulationCharacterRuntimeManager({
  identityResolver:async(character)=>({
    entity_id:"character_"+character.toLowerCase(),
    canonical_name:character,formal:true,
    identity_source:"cc7af_pending_cancellation_test",
  }),
});
const request={event_id:"dependent",source_character:"A",observer:"B"};
const goal={
  character:"A",addressee:"B",purpose:"告知",mode:"direct",
  public_content:"男孩離開房子",
  surface_realization:{
    schema_version:"cc5-mandarin-clause-request-v1",
    semantic_anchor:"男孩離開房子",
    clause:{subject:"男孩",predicate:"離開",object:"房子"},
  },
};
async function setup(label,cancellationRequest=request) {
  const session=await beginWorldSimulationSession({
    simulation_label:label,seed:label,
    rules:{event_driven:true,persistent_causality:true,
      communication_action_seconds:0.3,
      communication_speech_stream_increment_max_chars:2},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{
        event_id:"origin",type:"conversation",scene_id:"room",
        participants:["A","B"],
        next_events:[
          {event_id:"cancel",type:"conversation",scene_id:"room",
            participants:["A","B"],
            native_acoustic_cancellation_requests:[cancellationRequest]},
          {event_id:"dependent",type:"conversation",scene_id:"room",
            participants:["A","B"],
            native_acoustic_dependency_request:{
              schema_version:"cc7af-queued-acoustic-source-request-v1",
              source_character:"A",observer:"B",
            }},
          {event_id:"independent",type:"conversation",scene_id:"room",
            participants:["A","B"]},
        ],
      }],
      scenes:{room:{
        scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
        dimensions:{width_m:6,depth_m:6},
        entity_positions:{A:{x:1,y:1},B:{x:2,y:1}},
        audibility_profiles:{A:{minimum_audible_db:35},
          B:{minimum_audible_db:35}},
        observable_by:{A:{visual:[],audible:[]},
          B:{visual:[],audible:[]}},
      }},
      characters:{
        A:{known:["男孩離開房子"],current_goal:"告知B",
          communication_goal:goal,
          speech_acoustics:{sound_level_db_at_1m:65}},
        B:{known:[],current_goal:"聽A說話",
          speech_acoustics:{sound_level_db_at_1m:65}},
      },
      memories:{A:[],B:[]},available_actions:{A:[],B:[]},
    },
  },options);
  const sid=session.world_simulation_session_id;
  const result=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"origin",
  },{
    ...options,characterRuntimeManager:runtime,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      const candidate=packet.candidate_action_intents.find(item=>
        item.communication?.channel==="speech"
        &&item.communication?.surface_realization_complete===true);
      assert(candidate);return {action_id:candidate.action_id};
    },
  });
  assert.equal(result.committed,true);
  return sid;
}
try {
  const sid=await setup("cc7af-pending-valid");
  const before=await getWorldSimulationState(sid,options);
  const prior=await getWorldSimulationHistory(sid,options);
  assert.equal(before.state.event_queue.length,3);
  assert.equal(prior.turns.length,1);
  const event=before.state.event_queue[0];
  const dependent=before.state.event_queue[1];
  const unrelated=before.state.event_queue[2];
  assert.equal(event.event_id,"cancel");
  assert.equal(dependent.event_id,"dependent");
  assert.equal(unrelated.event_id,"independent");
  assert.equal(dependent.native_acoustic_source_lineage.source_character,"A");
  const params={
    session_id:sid,event_id:"cancel",
    expected_current_revision:before.revision,
    expected_current_state_hash:before.state_hash,
  };
  const plan=await assessWorldSimulationPendingAcousticCancellation(
    params,options);
  assert.equal(plan.schema_version,
    worldSimulationNativePendingCancellationVersion);
  assert.equal(plan.status,
    "verified_future_dependency_invalidation_plan_only");
  assert.equal(plan.target_count,1);
  assert.equal(plan.targets[0].event_id,"dependent");
  assert.equal(plan.targets[0].source_lineage_hash,
    dependent.native_acoustic_source_lineage.lineage_hash);
  assert.equal(plan.targets[0].source_turn_hash,
    hashAgentRunValue(prior.turns[0]));
  assert.equal(plan.world_queue_mutated,false);
  assert.equal(plan.world_committed,false);
  assert.equal(plan.prior_sound_retracted,false);
  assert.equal(plan.brain_invoked,false);
  assert.equal(plan.interruption_inferred,false);
  assert.equal(plan.audit_hash,hashAgentRunValue(
    Object.fromEntries(Object.entries(plan).filter(([k])=>k!=="audit_hash"))));
  assert.equal(JSON.stringify(plan).includes("男孩離開房子"),false);
  assert.equal((await getWorldSimulationState(sid,options)).state_hash,
    before.state_hash);
  assert.equal((await getWorldSimulationHistory(sid,options)).turns.length,1);
  await assert.rejects(()=>assessWorldSimulationPendingAcousticCancellation({
    ...params,expected_current_state_hash:"forged",
  },options),/stale against current World CAS/u);
  await assert.rejects(()=>assessWorldSimulationPendingAcousticCancellation({
    ...params,event_id:"independent",
  },options),/no bounded pending cancellation request/u);

  const wrong=await setup("cc7af-pending-wrong-target",{
    event_id:"independent",source_character:"A",observer:"B",
  });
  const wrongState=await getWorldSimulationState(wrong,options);
  await assert.rejects(()=>assessWorldSimulationPendingAcousticCancellation({
    session_id:wrong,event_id:"cancel",
    expected_current_revision:wrongState.revision,
    expected_current_state_hash:wrongState.state_hash,
  },options),/matching actual acoustic source/u);
  assert.equal((await getWorldSimulationHistory(wrong,options)).turns.length,1);

  // Native execution: the VERIFIED queue-head request, never caller-provided
  // removal IDs, is adopted by existing World adjudication and atomic CAS.
  let cancellationBrainCalls=0;
  const canceled=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"cancel",
  },{
    ...options,characterRuntimeManager:runtime,
    characterBrain:async(packet)=>{
      cancellationBrainCalls++;
      assert.equal(JSON.stringify(packet)
        .includes("native_acoustic_cancellation_requests"),false);
      assert.equal(JSON.stringify(packet)
        .includes("native_acoustic_source_lineage"),false);
      return "reject_all";
    },
  });
  assert.equal(canceled.committed,true);
  assert.equal(cancellationBrainCalls,2);
  const after=await getWorldSimulationState(sid,options);
  const history=await getWorldSimulationHistory(sid,options);
  assert.equal(after.revision,before.revision+1);
  assert.deepEqual(after.state.event_queue.map(e=>e.event_id),
    ["independent"]);
  assert.equal(history.turns.length,2);
  assert.equal(hashAgentRunValue(history.turns[0]),
    hashAgentRunValue(prior.turns[0]));
  assert.equal(history.turns[0].action_outcomes.some(x=>
    x.actor==="A"&&x.result==="communication_emitted"),true);
  const evidence=history.turns[1].native_acoustic_cancellation_evidence;
  assert.equal(evidence.target_count,1);
  assert.equal(evidence.canceled_future_event_refs[0].event_id,
    "dependent");
  assert.equal(evidence.source_assessment_audit_hash,plan.audit_hash);
  assert.equal(evidence.prior_sound_retracted,false);
  assert.equal(evidence.only_uncommitted_future_events_removed,true);
  assert.equal(evidence.interruption_inferred,false);
  assert.equal(evidence.evidence_hash,hashAgentRunValue(
    Object.fromEntries(Object.entries(evidence).filter(
      ([key])=>key!=="evidence_hash"))));
  assert.equal(JSON.stringify(history.turns[1].event)
    .includes("native_acoustic_cancellation_requests"),false);
  assert.equal(history.turns[1].action_outcomes.some(x=>
    x.result==="communication_emitted"),false);
  assert.equal(history.turns[1].state_transitions.some(x=>
    x.field==="event_queue"),true);

  // Cancel request aimed at an unrelated event fails BEFORE any Brain
  // and has no World commit, deletion, or new sound.
  let wrongBrainCalls=0;
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:wrong,event_id:"cancel",
  },{
    ...options,characterRuntimeManager:runtime,
    characterBrain:async()=>{
      wrongBrainCalls++;throw new Error("Invalid queue cannot invoke Brain");
    },
  }),/matching actual acoustic source/u);
  assert.equal(wrongBrainCalls,0);
  assert.equal((await getWorldSimulationHistory(wrong,options)).turns.length,1);

  // The independently retained queue head must still be runnable.
  const independent=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"independent",
  },{
    ...options,characterRuntimeManager:runtime,
    characterBrain:async()=>"reject_all",
  });
  assert.equal(independent.committed,true);
  assert.equal((await getWorldSimulationHistory(sid,options)).turns.length,3);
  console.log("CC-7AF pending queued cancellation plan tests passed.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
