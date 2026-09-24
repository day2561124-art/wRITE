import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { proveWorldSimulationNativeSourceReentry } from "../../server/src/world-simulation-native-source-reentry-service.mjs";
import { replayWorldSimulationNativeTemporalResponse } from "../../server/src/world-simulation-native-temporal-replay-service.mjs";

const makeGoal=(character,addressee,content,subject,predicate,object)=>({
  character,addressee,purpose:"告知",mode:"direct",public_content:content,
  surface_realization:{
    schema_version:"cc5-mandarin-clause-request-v1",
    semantic_anchor:content,clause:{subject,predicate,object},
  },
});
const aOld=makeGoal("A","B","男孩離開房子","男孩","離開","房子");
const aNew=makeGoal("A","B","男孩走進房子","男孩","走進","房子");
const bGoal=makeGoal("B","A","我聽見了","我","聽見","了");
const candidate=(character,communication_goal)=>
  buildCharacterCommunicationActionCandidate({character,cognition:{communication_goal}});
const aOldAction=candidate("A",aOld);
const aNewAction=candidate("A",aNew);
const bAction=candidate("B",bGoal);
assert(aOldAction&&aNewAction&&bAction);
assert.notEqual(aOldAction.action_id,aNewAction.action_id);
const selected=(action)=>({
  character:"A",selection:"candidate_action_intent",
  action_id:action.action_id,intent:action.intent,candidate:action,
});
const rejected={character:"B",selection:"reject_all",
  action_id:null,intent:null,candidate:null};
const original=[selected(aOldAction),rejected];
const revised=[selected(aNewAction),rejected];
const originalPackets=[
  {character:"A",cognition:{communication_goal:aOld},
    candidate_action_intents:[aOldAction]},
  {character:"B",cognition:{communication_goal:bGoal},
    candidate_action_intents:[bAction]},
];
const revisedPackets=[
  {character:"A",cognition:{communication_goal:aNew},
    candidate_action_intents:[aNewAction]},
  originalPackets[1],
];
const world={
  simulation_time:"2026-09-24T00:00:00.000Z",
  event_queue:[{event_id:"reentry-talk",type:"conversation",scene_id:"room",
    participants:["A","B"]}],
  world_rules:{communication_action_seconds:0.3,
    communication_speech_stream_increment_max_chars:2},
  scenes:{room:{
    scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
    entity_positions:{A:{x:1,y:1},B:{x:2,y:1}},
    audibility_profiles:{B:{minimum_audible_db:35},A:{minimum_audible_db:35}},
  }},
  characters:{
    A:{speech_acoustics:{sound_level_db_at_1m:65}},
    B:{speech_acoustics:{sound_level_db_at_1m:65}},
  },
};
const session_id="cc7af-reentry",turn_id="one-revision";
const world_state_hash=hashAgentRunValue(world);
const receipts=(decision_packets,selected_action_intents)=>
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id:session_id,turn_id,
    state_revision:1,world_state_hash,decision_packets,selected_action_intents,
  });
const oldReceipts=receipts(originalPackets,original);
const newReceipts=receipts(revisedPackets,revised);
assert.notEqual(oldReceipts.receipt_bundle_hash,newReceipts.receipt_bundle_hash);
let brainInputs=0,brainChoices=0,prepCalls=0;
const input={
  session_id,turn_id,world_state:world,
  world_state_revision:1,world_state_hash,event:world.event_queue[0],
  original_decision_packets:originalPackets,
  original_selected_action_intents:original,
  original_receipts:oldReceipts,
  revised_decision_packets:revisedPackets,
  revised_selected_action_intents:revised,
  revised_receipts:newReceipts,observer:"B",
  character_input_resolver:async(view)=>{
    brainInputs++;
    assert.equal(view.character,"B");
    assert.equal(view.observer_view.future_release_exposed,false);
    assert.equal(JSON.stringify(view).includes("男孩離開房子"),false);
    return {character:"B",cognition:{
      communication_goal:bGoal,private_belief:"B_SECRET_NOT_PUBLIC",
    }};
  },
  selection_resolver:async(view)=>{
    brainChoices++;
    assert.equal(view.observer,"B");
    assert.equal(view.observer_view.future_release_exposed,false);
    assert.equal(JSON.stringify(view).includes("B_SECRET_NOT_PUBLIC"),false);
    return {epoch_id:view.epoch_id,
      action_id:view.candidate_action_intents[0].action_id};
  },
};
const oldSpeculation=await replayWorldSimulationNativeTemporalResponse({
  session_id,turn_id,world_state:world,world_state_revision:1,
  world_state_hash,event:world.event_queue[0],
  selected_action_intents:original,observer:"B",
  character_input:{character:"B",cognition:{communication_goal:bGoal}},
  selection_resolver:async(view)=>({
    epoch_id:view.epoch_id,
    action_id:view.candidate_action_intents[0].action_id,
  }),
});
assert.equal(oldSpeculation.status,"replayed_same_turn");
const first=await proveWorldSimulationNativeSourceReentry(input);
assert.notEqual(first.audit.new_response_epoch_id,
  oldSpeculation.native_temporal_response.source_epoch_id);
assert.equal(first.engine_private_replay.initial_selected_action_intents[0].action_id,
  aNewAction.action_id);
assert.equal(first.audit.status,"provisional_new_observer_epoch_only");
assert.equal(first.audit.source_original_receipt_bundle_hash,
  oldReceipts.receipt_bundle_hash);
assert.equal(first.audit.source_revised_receipt_bundle_hash,
  newReceipts.receipt_bundle_hash);
assert.equal(first.audit.old_preparation_reused,false);
assert.equal(first.audit.prior_committed_sound_retracted,false);
assert.equal(first.audit.world_commit_performed,false);
assert.equal(first.audit.requires_fresh_broker_world_authority,true);
assert.equal(first.engine_private_replay.status,"replayed_same_turn");
assert.equal(first.engine_private_replay.initial_selected_action_intents[0].action_id,
  aNewAction.action_id);
assert.equal(first.engine_private_replay.native_temporal_response.action_id,
  bAction.action_id);
assert.equal(first.engine_private_replay.native_temporal_response.source_epoch_id,
  first.audit.new_response_epoch_id);
assert.equal(first.engine_private_replay.native_temporal_response.start_time_ms,
  first.audit.new_response_release_time_ms);
assert.equal(brainInputs,1);
assert.equal(brainChoices,1);
assert.equal(prepCalls,0);
assert.equal(JSON.stringify(first.audit).includes("男孩"),false);
assert.equal(JSON.stringify(first.audit).includes("B_SECRET"),false);
assert.equal(first.audit.audit_hash,hashAgentRunValue(
  Object.fromEntries(Object.entries(first.audit)
    .filter(([key])=>key!=="audit_hash"))));
assert.equal(hashAgentRunValue(world),world_state_hash);
let invalidBrainCalls=0;
const guarded={
  ...input,
  character_input_resolver:async()=>{
    invalidBrainCalls++;
    throw new Error("Invalid authorization must not invoke new Brain input");
  },
  selection_resolver:async()=>{
    invalidBrainCalls++;
    throw new Error("Invalid authorization must not select speech");
  },
};
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,revised_receipts:oldReceipts,
}),/Phase74D receipts do not match/u);
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,
  revised_selected_action_intents:original,
}),/selected action is not the exact prepared/u);
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,
  revised_decision_packets:originalPackets,
}),/selected action is not the exact prepared/u);
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,revised_selected_action_intents:original,
  revised_decision_packets:originalPackets,revised_receipts:oldReceipts,
}),/genuinely revised/u);
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,world_state_hash:"forged",
}),/exact original World snapshot/u);
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,observer:"A",
}),/Observer must retain/u);
// A canceled source is not magically replaced by a new audible event.
const canceledActions=[
  {character:"A",selection:"reject_all",action_id:null,
    intent:null,candidate:null},
  rejected,
];
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...guarded,revised_selected_action_intents:canceledActions,
  revised_receipts:receipts(revisedPackets,canceledActions),
}),/no independently replayed same-turn selected response/u);
assert.equal(invalidBrainCalls,0);
// Replaying the B action ID is not enough: the new epoch_id is mandatory.
let staleEpochChoiceCalls=0;
await assert.rejects(()=>proveWorldSimulationNativeSourceReentry({
  ...input,
  selection_resolver:async()=>{
    staleEpochChoiceCalls++;
    return {
      epoch_id:oldSpeculation.native_temporal_response.source_epoch_id,
      action_id:bAction.action_id,
    };
  },
}),/stale epoch/u);
assert.equal(staleEpochChoiceCalls,1);
console.log("CC-7AF provisional fresh-source reentry proof tests passed.");
