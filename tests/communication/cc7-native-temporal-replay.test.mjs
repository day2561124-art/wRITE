import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  replayWorldSimulationNativeTemporalResponse,
  buildWorldSimulationNativeTemporalReplayContract,
  reconcileWorldSimulationNativeTemporalChoiceLineage,
} from "../../server/src/world-simulation-native-temporal-replay-service.mjs";

const makeGoal = (character, addressee, content, subject, predicate, object) => ({
  character, addressee, purpose: "回應", mode: "direct", public_content: content,
  surface_realization: {
    schema_version: "cc5-mandarin-clause-request-v1", semantic_anchor: content,
    clause: { subject, predicate, object },
  },
});
const goalA = makeGoal("A", "B", "男孩離開房子", "男孩", "離開", "房子");
const goalB = makeGoal("B", "A", "我聽見了", "我", "聽見", "了");
const initial = {
  simulation_time: "2026-09-24T00:00:00.000Z",
  event_queue: [{
    event_id: "talk", type: "conversation", scene_id: "room", participants: ["A", "B"],
  }],
  world_rules: {
    communication_action_seconds: 0.3,
    communication_speech_stream_increment_max_chars: 2,
  },
  scenes: { room: {
    scene_id: "room", simulation_time: "2026-09-24T00:00:00.000Z",
    entity_positions: { A: {x:1,y:1}, B: {x:2,y:1} },
    audibility_profiles: { B:{minimum_audible_db:35}, A:{minimum_audible_db:35} },
  } },
  characters: {
    A: { speech_acoustics: {sound_level_db_at_1m:65} },
    B: { speech_acoustics: {sound_level_db_at_1m:65} },
  },
};
const speechA = buildCharacterCommunicationActionCandidate({
  character:"A", cognition:{communication_goal:goalA},
});
const speechB = buildCharacterCommunicationActionCandidate({
  character:"B", cognition:{communication_goal:goalB},
});
assert(speechA?.communication?.surface_realization_complete);
assert(speechB?.communication?.surface_realization_complete);
const input = {
  session_id:"native-replay-test", turn_id:"turn-1", world_state:initial,
  world_state_revision:1, world_state_hash:hashAgentRunValue(initial),
  event:initial.event_queue[0],
  selected_action_intents:[
    { character:"A", selection:"candidate_action_intent",
      action_id:speechA.action_id, intent:speechA.intent, candidate:speechA },
    { character:"B", selection:"reject_all", action_id:null,intent:null,candidate:null },
  ],
  observer:"B",
  character_input: {
    character:"B", cognition:{communication_goal:goalB, private_belief:"B_ONLY_PRIVATE"},
  },
};
const seen=[];
const choose = async(view) => {
  seen.push(view);
  assert.equal(view.observer,"B");
  assert.equal(view.observer_view.future_release_exposed,false);
  assert.equal(JSON.stringify(view).includes("B_ONLY_PRIVATE"),false);
  assert.equal(JSON.stringify(view).includes("男孩離開"),false);
  return {epoch_id:view.epoch_id,action_id:view.candidate_action_intents[0].action_id};
};
const run = () => replayWorldSimulationNativeTemporalResponse({
  ...input,selection_resolver:choose,
});
const first=await run();
assert.equal(seen.length,1,"one observer epoch must invoke Character Brain selection only once");
assert.equal(first.status,"replayed_same_turn");
assert.equal(first.native_temporal_response.response_emitted,true);
assert.equal(first.native_temporal_response.world_committed,false);
assert.equal(first.native_temporal_response.initial_selection_kind,"reject_all");
assert.equal(first.native_temporal_response.post_cue_selection_kind,"candidate_action_intent");
assert.equal(first.native_temporal_response.source_initial_selection_hash,
  hashAgentRunValue(input.selected_action_intents));
assert.equal(first.initial_selected_action_intents[1].selection,"reject_all");
assert.equal(first.native_temporal_response.audit_hash,hashAgentRunValue(
  Object.fromEntries(Object.entries(first.native_temporal_response)
    .filter(([key])=>key!=="audit_hash"))));
assert.equal(first.selected_action_intents[1].action_id,speechB.action_id);
assert.equal(first.selected_action_intents[1].selection,"candidate_action_intent");
assert.equal(first.causal_resolution.action_outcomes.find(x=>
  x.action_id===speechB.action_id).result,"communication_emitted");
const source=first.causal_resolution.causal_timeline.entries.find(x=>
  x.kind==="communication_speech_increment"&&x.action_id===speechA.action_id);
assert(source);
assert.equal(first.native_temporal_response.start_time_ms,source.time_ms);
assert(first.causal_resolution.causal_timeline.entries.some(x=>
  x.kind==="communication_speech_increment"&&x.action_id===speechB.action_id
    && x.time_ms>source.time_ms));
assert.equal(first.boundaries.world_commit_performed_here,false);
assert.equal(buildWorldSimulationNativeTemporalReplayContract().observer_must_have_rejected_initial_action,true);
assert(seen.length>=1);
assert.deepEqual(first,await run());
const originalReceipts = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
  world_simulation_session_id: input.session_id, turn_id: input.turn_id,
  state_revision:input.world_state_revision, world_state_hash:input.world_state_hash,
  decision_packets:[
    {character:"A",cognition:{communication_goal:goalA},candidate_action_intents:[speechA]},
    {character:"B",cognition:{communication_goal:goalB},candidate_action_intents:[speechB]},
  ],
  selected_action_intents:input.selected_action_intents,
});
const originalHash = hashAgentRunValue(originalReceipts);
const choice = reconcileWorldSimulationNativeTemporalChoiceLineage({
  original_receipts:originalReceipts,native_replay:first,
});
assert.equal(choice.initial_selection_scope,"pre_observer_cue_only");
assert.equal(choice.original_phase74d_receipt_unchanged,true);
assert.equal(choice.post_cue_phase74a_b_c_lineage_fabricated,false);
assert.equal(choice.response_action_id,speechB.action_id);
assert.equal(choice.world_committed,false);
assert.equal(choice.evidence_hash,hashAgentRunValue(
  Object.fromEntries(Object.entries(choice).filter(([key])=>key!=="evidence_hash"))));
assert.equal(hashAgentRunValue(originalReceipts),originalHash);
assert.throws(()=>reconcileWorldSimulationNativeTemporalChoiceLineage({
  original_receipts:originalReceipts,native_replay:{...first,
    initial_selected_action_intents:first.selected_action_intents},
}),/independently revalidated/u);
assert.throws(()=>reconcileWorldSimulationNativeTemporalChoiceLineage({
  original_receipts:originalReceipts,native_replay:{...first,
    native_temporal_response:{...first.native_temporal_response,action_id:"forged"}},
}),/independently revalidated/u);
assert.equal(hashAgentRunValue(initial),input.world_state_hash);
await assert.rejects(()=>replayWorldSimulationNativeTemporalResponse({
  ...input,world_state_hash:"forged",selection_resolver:choose,
}),/exact original snapshot/u);
await assert.rejects(()=>replayWorldSimulationNativeTemporalResponse({
  ...input,selected_action_intents:[
    input.selected_action_intents[0],
    {character:"B",selection:"candidate_action_intent",
      action_id:speechB.action_id,intent:speechB.intent,candidate:speechB},
  ],selection_resolver:choose,
}),/rejecting its initial/u);
await assert.rejects(()=>replayWorldSimulationNativeTemporalResponse({
  ...input,character_input:{...input.character_input,character:"C"},
  selection_resolver:choose,
}),/one same-character/u);
const inaudible = structuredClone(input.world_state);
inaudible.scenes.room.audibility_profiles.B.minimum_audible_db=100;
let called=false;
const silence = await replayWorldSimulationNativeTemporalResponse({
  ...input,world_state:inaudible,world_state_hash:hashAgentRunValue(inaudible),
  selection_resolver:async()=>{called=true;throw new Error("must not select");},
});
assert.equal(silence.status,"no_admitted_cue");
assert.equal(called,false);
assert.equal(silence.native_temporal_response,null);
const refuse = await replayWorldSimulationNativeTemporalResponse({
  ...input,selection_resolver:async(view)=>({epoch_id:view.epoch_id,reject_all:true}),
});
assert.equal(refuse.status,"rejected_all");
assert.equal(refuse.native_temporal_response,null);
assert.equal(refuse.selected_action_intents[1].selection,"reject_all");
console.log("CC-7AD world-owned source-verified causal replay tests passed.");
