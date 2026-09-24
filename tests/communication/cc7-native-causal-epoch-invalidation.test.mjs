import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import {
  assessWorldSimulationNativeCausalEpochSupersession,
  worldSimulationNativeCausalEpochInvalidationVersion,
} from "../../server/src/world-simulation-native-causal-epoch-invalidation-service.mjs";

const goal=(content,subject,predicate,object)=>({
  character:"A",addressee:"B",purpose:"告知",mode:"direct",
  public_content:content,surface_realization:{
    schema_version:"cc5-mandarin-clause-request-v1",
    semantic_anchor:content,
    clause:{subject,predicate,object},
  },
});
const world={
  simulation_time:"2026-09-24T00:00:00.000Z",
  event_queue:[{event_id:"talk",type:"conversation",scene_id:"room",
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
const candidate=buildCharacterCommunicationActionCandidate({
  character:"A",cognition:{
    communication_goal:goal("男孩離開房子","男孩","離開","房子"),
  },
});
const replacement=buildCharacterCommunicationActionCandidate({
  character:"A",cognition:{
    communication_goal:goal("男孩走進房子","男孩","走進","房子"),
  },
});
assert(candidate?.communication?.surface_realization_complete);
assert(replacement?.communication?.surface_realization_complete);
assert.notEqual(candidate.action_id,replacement.action_id);
const speech=(value)=>({
  character:"A",selection:"candidate_action_intent",
  action_id:value.action_id,intent:value.intent,candidate:value,
});
const rejected=(character)=>({
  character,selection:"reject_all",action_id:null,intent:null,candidate:null,
});
const original=[speech(candidate),rejected("B")];
const input={
  session_id:"cc7af-test",turn_id:"turn-1",
  world_state:world,world_state_revision:1,
  world_state_hash:hashAgentRunValue(world),
  event:world.event_queue[0],
  original_selected_action_intents:original,
  observer:"B",
};
const assess=(changes={})=>assessWorldSimulationNativeCausalEpochSupersession({
  ...input,revised_selected_action_intents:original,...changes,
});
const same=await assess();
assert.equal(same.schema_version,worldSimulationNativeCausalEpochInvalidationVersion);
assert.equal(same.status,"unchanged_epoch");
assert.equal(same.source_survives_revised_execution,true);
assert.equal(same.obsolete_preparation_must_not_authorize_new_action,false);
assert.equal(same.audit_hash,hashAgentRunValue(
  Object.fromEntries(Object.entries(same).filter(([key])=>key!=="audit_hash"))));
assert.equal(same.public_signal_emitted,false);
assert.equal(same.world_mutation_performed,false);
assert.equal(same.previously_committed_sound_retracted,false);
assert.equal(same.interruption_or_floor_loss_inferred,false);
assert.deepEqual(same,await assess());
const cancelled=await assess({
  revised_selected_action_intents:[rejected("A"),rejected("B")],
});
assert.equal(cancelled.status,"source_not_released_in_revised_execution");
assert.equal(cancelled.source_survives_revised_execution,false);
assert.equal(cancelled.obsolete_preparation_must_not_authorize_new_action,true);
assert.notEqual(cancelled.revised_ledger_hash,cancelled.original_ledger_hash);
assert.equal(cancelled.previously_committed_sound_retracted,false);
const substituted=await assess({
  revised_selected_action_intents:[speech(replacement),rejected("B")],
});
assert.equal(substituted.status,"source_not_released_in_revised_execution");
assert.equal(substituted.obsolete_preparation_must_not_authorize_new_action,true);
assert.equal(substituted.public_signal_emitted,false);
assert.equal(substituted.interruption_or_floor_loss_inferred,false);
const privateAudit=JSON.stringify(cancelled);
for(const hidden of ["男孩離開房子","男孩走進房子",'"world_state":','"surface_fragment":'])
  assert.equal(privateAudit.includes(hidden),false,hidden);
assert.equal(hashAgentRunValue(world),input.world_state_hash);
await assert.rejects(()=>assess({world_state_hash:"forged"}),
  /Exact original World state/u);
await assert.rejects(()=>assess({
  expected_original_execution_hash:"forged",
}),/stale original observer causal epoch/u);
await assert.rejects(()=>assess({
  expected_original_ledger_hash:"forged",
}),/stale original observer causal epoch/u);
await assert.rejects(()=>assess({original_release_cursor:999}),
  /actually admitted World tick/u);
await assert.rejects(()=>assess({observer:"A"}),
  /exactly one observer cue/u);
await assert.rejects(()=>assess({
  revised_selected_action_intents:[rejected("B")],
}),/introduce or remove World characters/u);
console.log("CC-7AF canonical World source supersession dry-run tests passed.");
