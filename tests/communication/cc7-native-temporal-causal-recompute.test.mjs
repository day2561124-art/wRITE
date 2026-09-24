import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { buildWorldSimulationSpeechOverlapEvidence } from "../../server/src/world-simulation-communication-speech-overlap-service.mjs";
import { buildWorldSimulationObserverMicrotickLedger } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";

const pre = {
  simulation_time: "2026-09-24T00:00:00.000Z",
  event_queue: [{ event_id:"talk", type:"conversation", scene_id:"room",
    participants:["A","B"] }],
  world_rules:{communication_action_seconds:0.3,communication_speech_stream_increment_max_chars:2},
  scenes:{room:{
    scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
    entity_positions:{ A:{x:1,y:1}, B:{x:2,y:1} },
    audibility_profiles:{ B:{minimum_audible_db:35}, A:{minimum_audible_db:35} },
  }},
  characters:{ A:{ speech_acoustics:{sound_level_db_at_1m:65} },
    B:{ speech_acoustics:{sound_level_db_at_1m:65} }},
};
const candidate=(actor,addressee,semantic,subject,predicate,object)=>buildCharacterCommunicationActionCandidate({
  character:actor,
  cognition:{communication_goal:{
    character:actor,addressee,purpose:"回答",mode:"direct",public_content:semantic,
    surface_realization:{
      schema_version:"cc5-mandarin-clause-request-v1",semantic_anchor:semantic,
      clause:{subject,predicate,object},
    },
  }},
});
const a=candidate("A","B","男孩離開房子","男孩","離開","房子");
const b=candidate("B","A","我聽見了","我","聽見","了");
assert(a?.communication?.surface_realization_complete);
assert(b?.communication?.surface_realization_complete);
const root = {
  world_simulation_session_id:"native-test",turn_id:"turn-1",
  world_state:pre,world_state_hash:hashAgentRunValue(pre),
  world_state_revision:1,event:pre.event_queue[0],
  selected_action_intents:[{character:"A",candidate:a}],
};
const initial=await adjudicateWorldSimulationCausality(root);
const aOutcome=initial.action_outcomes.find(x=>x.action_id===a.action_id);
assert.equal(aOutcome.result,"communication_emitted");
const releases=initial.causal_timeline.entries.filter(e=>
  e.kind==="communication_speech_increment"&&e.action_id===a.action_id);
assert(releases.length>1);
const first=releases[0].time_ms;
const replay=await adjudicateWorldSimulationCausality({
  ...root,selected_action_intents:[...root.selected_action_intents,{character:"B",candidate:b}],
  native_temporal_response:{actor:"B",action_id:b.action_id,start_time_ms:first},
});
const response=replay.action_outcomes.find(x=>x.action_id===b.action_id);
assert.equal(response.result,"communication_emitted");
assert.equal(response.start_time_ms,first);
assert.equal(response.communication_speech_stream.start_time_ms,first);
const responseEvents=replay.causal_timeline.entries.filter(e=>
  e.kind==="communication_speech_increment"&&e.action_id===b.action_id);
assert(responseEvents.length>0);
assert(responseEvents.every(e=>e.time_ms>first));
assert.equal(responseEvents.at(-1).time_ms,first+response.duration_ms);
const firstSource=replay.causal_timeline.entries.find(e=>
  e.kind==="communication_speech_increment"&&e.increment_ref===releases[0].increment_ref);
assert.equal(firstSource.time_ms,first);
const ledger=buildWorldSimulationObserverMicrotickLedger({
  causal_timeline:replay.causal_timeline,
  admissions:replay.communication_observer_increment_admissions,
});
assert(ledger.ticks.some(t=>t.release_time_ms===first&&
  t.observer_cues.some(c=>c.observer==="B")));
assert(ledger.ticks.some(t=>t.release_time_ms>first&&
  t.observer_cues.some(c=>c.observer==="A")));
const overlap=buildWorldSimulationSpeechOverlapEvidence({
  action_outcomes:replay.action_outcomes,causal_timeline:replay.causal_timeline,
});
assert.equal(overlap.overlapping_pair_count,1);
assert.equal(overlap.pairs[0].overlap_start_ms,first);
assert.equal(overlap.pairs[0].interruption_judged,false);
assert.equal(hashAgentRunValue(pre),root.world_state_hash);
await assert.rejects(()=>adjudicateWorldSimulationCausality({
  ...root,native_temporal_response:{actor:"B",action_id:"forged",start_time_ms:first},
}),/Invalid World-owned/u);
await assert.rejects(()=>adjudicateWorldSimulationCausality({
  ...root,native_temporal_response:{actor:"A",action_id:a.action_id,start_time_ms:-1},
}),/Invalid World-owned/u);
await assert.rejects(()=>adjudicateWorldSimulationCausality({
  ...root,native_temporal_response:{
    actor:"A",action_id:a.action_id,start_time_ms:first,unexpected:"forged",
  },
}),/Invalid World-owned/u);
console.log("CC-7AD anchored native speech re-adjudication tests passed.");
