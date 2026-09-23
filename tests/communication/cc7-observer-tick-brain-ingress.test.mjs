import assert from "node:assert/strict";
import {
  runWorldSimulationObserverTickBrainIngress,
  buildWorldSimulationObserverTickBrainIngressContract,
  worldSimulationObserverTickBrainIngressVersion,
} from "../../server/src/world-simulation-observer-tick-brain-ingress-service.mjs";
import { worldSimulationObserverTickPerceptionVersion } from "../../server/src/world-simulation-observer-tick-perception-service.mjs";

const contract=buildWorldSimulationObserverTickBrainIngressContract();
assert.equal(contract.actual_mid_turn_world_action_replanning,false);
assert.equal(contract.no_new_action_or_speech_decision_accepted,true);
assert.equal(contract.source_world_snapshot_exposed,false);
assert.equal(contract.persistent_audit_contains_views_or_response_text,false);
const visual={sense:"visual",kind:"visible_entity",perceptual_label:"someone in a coat",
  distance_m:3,relative_position:{dx_m:3,dy_m:0}};
const heard=(ref)=>({
  signal_phase:"ongoing",perceived_cue_refs:[ref],
  anonymous_voice_ref:"anonymous_voice_"+"a".repeat(24),
  heard_surface_fragment:null,speaker_identity_recognized:false,
  lexical_intelligibility_attested:false,
});
const view=(observer,time,cues=[],visuals=[])=>({
  schema_version:worldSimulationObserverTickPerceptionVersion,
  observer,release_time_ms:time,visual:visuals,heard_nonlexical:cues,
  world_truth_authority:false,future_release_exposed:false,world_snapshot_exposed:false,
});
const views=[
  view("B",100,[heard("B_FIRST")],[]),
  view("C",100,[heard("C_ONLY")],[]),
  view("B",250,[heard("B_SECOND")],[visual]),
];
const perception={
  audit:{schema_version:worldSimulationObserverTickPerceptionVersion,
    status:"observer_views_engine_private",character_view_count:3},
  engine_private_character_views:views,
};
const noResolver=await runWorldSimulationObserverTickBrainIngress({perception});
assert.equal(noResolver.resolver_used,false);
assert.equal(noResolver.invocation_count,0);
const seen=[];
const resolved=await runWorldSimulationObserverTickBrainIngress({
  perception,
  resolver:async packet=>{
    seen.push(structuredClone(packet));
    // Deliberate callback-side mutation cannot corrupt next view or source.
    packet.perception.visual.push({illicit:"mutated"});
    return packet.observer==="C"
      ? null
      : {noticing_status:"noticed",attended_senses:
        packet.release_time_ms===250?["visual","auditory"]:["auditory"]};
  },
});
assert.equal(resolved.schema_version,worldSimulationObserverTickBrainIngressVersion);
assert.equal(resolved.invocation_count,3);
assert.equal(resolved.noticed_count,2);
assert.deepEqual(seen.map(p=>[p.observer,p.release_time_ms]),
  [["B",100],["C",100],["B",250]]);
assert.deepEqual(seen[0].perception.heard_nonlexical[0].perceived_cue_refs,["B_FIRST"]);
assert.deepEqual(seen[1].perception.heard_nonlexical[0].perceived_cue_refs,["C_ONLY"]);
assert.deepEqual(seen[2].perception.heard_nonlexical[0].perceived_cue_refs,["B_SECOND"]);
assert.equal(seen[0].perception.visual.length,0);
assert.equal(seen[2].perception.visual.length,1);
for(const packet of seen) {
  assert.deepEqual(Object.keys(packet).sort(),[
    "boundaries","observer","perception","release_time_ms","schema_version"]);
  assert.deepEqual(Object.keys(packet.perception).sort(),["heard_nonlexical","visual"]);
  assert.equal(packet.boundaries.action_selection_available,false);
  assert.equal(packet.boundaries.world_effect_authority,false);
  assert.equal(packet.boundaries.future_tick_available,false);
  assert.equal(JSON.stringify(packet).includes("C_ONLY"),
    packet.observer==="C");
}
assert.deepEqual(views[2].visual,[visual]);
assert.deepEqual(resolved.audit.map(x=>x.response_status),
  ["noticed","no_noticing","noticed"]);
for(const term of ["B_FIRST","B_SECOND","C_ONLY","someone in a coat",
  '"world_state":','"perception":','"action_id":','"speech":']) {
  assert.equal(JSON.stringify(resolved).includes(term),false,term);
}
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception,resolver:async()=>({noticing_status:"noticed",
    attended_senses:["auditory"],action_id:"illicit"}),
}),e=>e?.code==="CC7I_OBSERVER_TICK_BRAIN_INGRESS_INVALID");
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception,resolver:async()=>({noticing_status:"noticed",
    attended_senses:["visual"]}),
}),/absent or unnoticed/u);
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception,resolver:async()=>({noticing_status:"no_noticing",
    attended_senses:["auditory"]}),
}),/absent or unnoticed/u);
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception:{...perception,engine_private_character_views:[
    views[0],views[0],views[2]]},
  resolver:async()=>null,
}),/Duplicate observer\/tick/u);
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception:{...perception,engine_private_character_views:[
    views[2],views[0],views[1]]},
  resolver:async()=>null,
}),/causal tick order/u);
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception:{...perception,engine_private_character_views:[
    {...views[0],world_state:{secret:true}},views[1],views[2]]},
  resolver:async()=>null,
}),/outside its allowlist/u);
await assert.rejects(runWorldSimulationObserverTickBrainIngress({
  perception:{...perception,engine_private_character_views:[
    {...views[0],heard_nonlexical:[{...heard("B_FIRST"),
      heard_surface_fragment:"future secret"}]},views[1],views[2]]},
  resolver:async()=>null,
}),/verified nonlexical/u);
assert.equal((await runWorldSimulationObserverTickBrainIngress({
  perception:{audit:{schema_version:worldSimulationObserverTickPerceptionVersion,
    status:"not_projected"},engine_private_character_views:[]},
  resolver:async()=>{throw new Error("should not call");},
})).invocation_count,0);
console.log("CC-7I observer-specific post-causal Brain ingress tests passed.");
