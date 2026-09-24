import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationNativePreparationEvidence,
  assertWorldSimulationNativePreparationEvidence,
} from "../../server/src/world-simulation-native-response-preparation-service.mjs";
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
// CC-7AE: the observer can wait without ANY Brain action selection; only
// a subsequent physically admitted cue permits a fresh same-character
// response at that later World-owned timestamp.
const delayedViews=[];
const delayedBrainInputs=[];
const delayedSelections=[];
const delayed=await replayWorldSimulationNativeTemporalResponse({
  ...input,
  character_input_resolver:async(view)=>{
    delayedBrainInputs.push(view);
    assert.equal(view.character,"B");
    assert.equal(view.observer_view.future_release_exposed,false);
    assert.equal(JSON.stringify(view).includes("B_ONLY_PRIVATE"),false);
    return input.character_input;
  },
  preparation_decision_resolver:async(view)=>{
    delayedViews.push(view);
    assert.equal(view.character,"B");
    assert.equal(view.boundaries.no_future_cue,true);
    assert.equal(view.boundaries.no_public_signal_from_wait_or_revision,true);
    assert.equal(JSON.stringify(view).includes("男孩離開"),false);
    return {epoch_id:view.epoch_id,
      decision:delayedViews.length===1?"wait":"select_response"};
  },
  selection_resolver:async(view)=>{
    delayedSelections.push(view);
    assert.equal(view.observer,"B");
    assert.equal(view.observer_view.future_release_exposed,false);
    return {epoch_id:view.epoch_id,
      action_id:view.candidate_action_intents[0].action_id};
  },
});
assert.equal(delayed.status,"replayed_same_turn");
assert.equal(delayedViews.length,2);
assert.equal(delayedBrainInputs.length,1);
assert.equal(delayedSelections.length,1);
assert.notEqual(delayedViews[0].epoch_id,delayedViews[1].epoch_id);
assert(delayedViews[1].release_time_ms>delayedViews[0].release_time_ms);
assert.equal(delayed.native_temporal_response.start_time_ms,
  delayedViews[1].release_time_ms);
assert(delayed.native_temporal_response.start_time_ms
  >first.native_temporal_response.start_time_ms);
assert.equal(delayed.preparation_audit.wait_count,1);
assert.equal(delayed.preparation_audit.revision_count,0);
assert.equal(delayed.native_temporal_response.source_preparation_audit_hash,
  delayed.preparation_audit.audit_hash);
assert.equal(JSON.stringify(delayed.preparation_audit).includes("B_ONLY_PRIVATE"),false);
assert.equal(JSON.stringify(delayed.preparation_audit).includes("男孩離開"),false);
assert.equal(delayed.causal_resolution.action_outcomes.find(x=>
  x.action_id===speechB.action_id).start_time_ms,
  delayedViews[1].release_time_ms);
const revisedViews=[];
let revisedInputCalls=0;
let revisedSelectionCalls=0;
const revised=await replayWorldSimulationNativeTemporalResponse({
  ...input,
  preparation_decision_resolver:async(view)=>{
    revisedViews.push(view);
    return {epoch_id:view.epoch_id,
      decision:revisedViews.length===1?"wait":
        revisedViews.length===2?"revise_preparation":"select_response"};
  },
  character_input_resolver:async(view)=>{
    revisedInputCalls++;
    assert.equal(view.observer_view.release_time_ms,
      revisedViews[2].release_time_ms);
    assert.equal(view.observer_view.future_release_exposed,false);
    return input.character_input;
  },
  selection_resolver:async(view)=>{
    revisedSelectionCalls++;
    return {epoch_id:view.epoch_id,
      action_id:view.candidate_action_intents[0].action_id};
  },
});
assert.equal(revised.status,"replayed_same_turn");
assert.equal(revisedViews.length,3);
assert.equal(revisedInputCalls,1);
assert.equal(revisedSelectionCalls,1);
assert.equal(revised.preparation_audit.wait_count,1);
assert.equal(revised.preparation_audit.revision_count,1);
assert.equal(revised.preparation_audit.consumed_count,2);
assert(revisedViews[0].release_time_ms<revisedViews[1].release_time_ms);
assert(revisedViews[1].release_time_ms<revisedViews[2].release_time_ms);
assert.equal(revised.native_temporal_response.start_time_ms,
  revisedViews[2].release_time_ms);
assert.equal(revised.native_temporal_response.source_preparation_consumed_count,2);
let allWaitInputs=0,allWaitSelections=0;
const waiting=await replayWorldSimulationNativeTemporalResponse({
  ...input,
  character_input_resolver:async()=>{
    allWaitInputs++;throw new Error("Waiting must not ask for a new Brain action");
  },
  selection_resolver:async()=>{
    allWaitSelections++;throw new Error("Waiting must not choose a Brain action");
  },
  preparation_decision_resolver:async(view)=>({
    epoch_id:view.epoch_id,decision:"wait",
  }),
});
assert.equal(waiting.status,"awaiting_later_cue");
assert.equal(waiting.native_temporal_response,null);
assert.equal(waiting.selected_action_intents[1].selection,"reject_all");
assert(waiting.preparation_audit.wait_count>delayedViews.length);
assert.equal(waiting.preparation_audit.wait_count,
  waiting.preparation_audit.consumed_count);
assert.equal(allWaitInputs,0);
assert.equal(allWaitSelections,0);
await assert.rejects(()=>replayWorldSimulationNativeTemporalResponse({
  ...input,
  character_input_resolver:async()=>input.character_input,
  selection_resolver:choose,
  preparation_decision_resolver:async()=>({
    epoch_id:"forged",decision:"select_response",
  }),
}),/exact current observer epoch/u);
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
const revisedChoice = reconcileWorldSimulationNativeTemporalChoiceLineage({
  original_receipts: originalReceipts,
  native_replay: revised,
});
assert.equal(revisedChoice.preparation_decision_count,2);
assert.equal(revisedChoice.source_preparation_audit_hash,
  revised.preparation_audit.audit_hash);
const revisedProof = buildWorldSimulationNativePreparationEvidence({
  native_replay: revised, choice_evidence: revisedChoice,
  original_receipts: originalReceipts,
});
assert.equal(revisedProof.preparation_audits.length,2);
assert.deepEqual(revisedProof.preparation_audits.map(a=>a.latest_decision),
  ["wait","revise_preparation"]);
assert.equal(revisedProof.preparation_audits[1].previous_audit_hash,
  revisedProof.preparation_audits[0].audit_hash);
assert.equal(revisedProof.last_preparation_audit_hash,
  revisedChoice.source_preparation_audit_hash);
const checkRevisedProof=(evidence,choice_evidence=revisedChoice)=>
  assertWorldSimulationNativePreparationEvidence({
    evidence, choice_evidence, original_receipts:originalReceipts,
    action_outcomes:revised.causal_resolution.action_outcomes,
  });
assert.deepEqual(checkRevisedProof(revisedProof),revisedProof);
const forgedChain=structuredClone(revisedProof);
forgedChain.preparation_audits[1].previous_audit_hash="forged";
const {audit_hash:ignoredAuditHash,...forgedAuditPayload}=
  forgedChain.preparation_audits[1];
forgedChain.preparation_audits[1].audit_hash=
  hashAgentRunValue(forgedAuditPayload);
forgedChain.last_preparation_audit_hash=
  forgedChain.preparation_audits[1].audit_hash;
const {evidence_hash:ignoredEvidenceHash,...forgedPayload}=forgedChain;
forgedChain.evidence_hash=hashAgentRunValue(forgedPayload);
assert.throws(()=>checkRevisedProof(forgedChain),
  /stale, forged|provenance disagree/u);
assert.throws(()=>checkRevisedProof(revisedProof,{
  ...revisedChoice,source_preparation_audit_hash:"forged",
}),/stale, forged|provenance disagree|matching later committed speech/u);
assert.throws(()=>checkRevisedProof(null),/must carry its linked/u);
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
