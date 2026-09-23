import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import {
  projectWorldSimulationObserverTickPerceptions,
  buildWorldSimulationObserverTickPerceptionContract,
} from "../../server/src/world-simulation-observer-tick-perception-service.mjs";

const contract = buildWorldSimulationObserverTickPerceptionContract();
assert.equal(contract.reconstructed_world_state_engine_only, true);
assert.equal(contract.persistence_contains_character_views, false);
assert.equal(contract.character_brain_invoked, false);
const noSecret = (item) => {
  const serialized = JSON.stringify(item);
  for (const forbidden of [
    "SECRET_BELIEF", "FUTURE_EVENT", "PRIVATE_DEVICE",
    "registered-sound-id", "A_TRUE_ID", "B_PRIVATE_CUE",
    '"characters":', '"world_state":', '"entity_id":', '"target_id":',
    '"line_of_sight_checks":', '"occluded_entities":', '"mutation_path":',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
};

const speechCue = (observer, phase, ref) => ({
  observer, signal_ref: "opaque-" + observer,
  signal_phase: phase, perceived_cue_refs: [ref],
  heard_surface_fragment: null, perceived_speaker: null,
  lexical_intelligibility_attested: false,
  speaker_identity_recognized: false,
  no_future_increment_exposed: true,
});
const source = {
  schema_version: worldSimulationObserverMicrotickLedgerVersion,
  ticks: [
    { release_time_ms: 100, observer_cues: [
      { observer: "B", observer_increment: speechCue("B","ongoing","B_HEARD_1") },
      { observer: "C", observer_increment: speechCue("C","ongoing","C_HEARD_1") },
    ] },
    { release_time_ms: 250, observer_cues: [
      { observer: "B", observer_increment: speechCue("B","acoustic_segment_ended","B_HEARD_2") },
    ] },
  ],
  tick_count: 2, admitted_cue_count: 3, boundaries: {},
};
const ledger = { ...source, ledger_hash: hashAgentRunValue(source) };
const scene = (blocked) => ({
  scene_id: "room",
  entity_positions: {
    A_TRUE_ID: {x:4,y:0}, B: {x:0,y:0},
    C: {x:0,y:3}, HIDDEN: {x:9,y:0},
  },
  entity_visual_labels: {
    A_TRUE_ID: "a person", HIDDEN: "invisible person",
  },
  doors: blocked ? { door: {
    open: false, x_min:1, x_max:2, y_min:-1, y_max:1,
  } } : {},
  observable_by: { B: {
    visual: [{ subject_entity_id:"HIDDEN", visual_label:"PRIVATE_DEVICE" }],
  }},
  vision_range_m: 6,
});
const state = (blocked, future=false) => ({
  scenes: { room: scene(blocked) },
  characters: {
    A_TRUE_ID: {private_belief:"SECRET_BELIEF"},
    B:{private_belief:"B_PRIVATE_CUE"},
    C:{private_belief:"SECRET_BELIEF"},
    HIDDEN:{private_belief:"SECRET_BELIEF"},
  },
  future_event: future ? "FUTURE_EVENT" : null,
});
const first=state(true);
const later=state(false,true);
const make = (states) => {
  const snaps=states.map((world_state,i)=>({
    release_time_ms:source.ticks[i].release_time_ms,
    world_state,
    reconstructed_world_state_hash:hashAgentRunValue(world_state),
    mutation_prefix_ref:"prefix-"+i,
  }));
  return {
    audit: {
      schema_version:worldSimulationObserverTickPrefixReconstructionVersion,
      status:"engine_private_prefixes_reconstructed",
      readiness_ledger_hash:ledger.ledger_hash,
      ticks:snaps.map(({world_state,...receipt})=>receipt),
    },
    engine_snapshots:snaps,
  };
};
const reconstruction=make([first,later]);
const result=projectWorldSimulationObserverTickPerceptions({
  ledger, reconstruction, scene_id:"room",
});
assert.equal(result.audit.status,"observer_views_engine_private");
assert.equal(result.audit.character_view_count,3);
assert.equal(result.audit.tick_count,2);
assert.equal(result.engine_private_character_views.length,3);
const view=(observer,t)=>result.engine_private_character_views.find(
  x=>x.observer===observer&&x.release_time_ms===t);
assert.equal(view("B",100).visual.some(
  v=>v.perceptual_label==="a person"),false);
assert.equal(view("B",250).visual.some(
  v=>v.perceptual_label==="a person"),true);
assert.deepEqual(view("B",100).heard_nonlexical[0].perceived_cue_refs,["B_HEARD_1"]);
assert.deepEqual(view("B",250).heard_nonlexical[0].perceived_cue_refs,["B_HEARD_2"]);
assert.deepEqual(view("C",100).heard_nonlexical[0].perceived_cue_refs,["C_HEARD_1"]);
assert.equal(view("C",250),undefined);
assert.equal(view("B",100).future_release_exposed,false);
assert.equal(view("B",100).world_snapshot_exposed,false);
for(const item of [...result.engine_private_character_views,result.audit])noSecret(item);
assert.equal(JSON.stringify(result.audit).includes("B_HEARD"),false);
assert.equal(JSON.stringify(result.audit).includes('"visual":'),false);
assert.deepEqual(first,state(true));
assert.deepEqual(later,state(false,true));
assert.deepEqual(result,projectWorldSimulationObserverTickPerceptions({
  ledger,reconstruction,scene_id:"room",
}));
assert.throws(()=>projectWorldSimulationObserverTickPerceptions({
  ledger,reconstruction:{...reconstruction,engine_snapshots:[
    {...reconstruction.engine_snapshots[0],
      world_state: {...first,future_event:"FORGED_FUTURE"}},
    reconstruction.engine_snapshots[1]]},
  scene_id:"room",
}),/exact verified World prefix/u);
assert.throws(()=>projectWorldSimulationObserverTickPerceptions({
  ledger:{...ledger,tick_count:9},reconstruction,scene_id:"room",
}),/release ledger/u);
const notReady=projectWorldSimulationObserverTickPerceptions({
  ledger,reconstruction:{
    audit:{schema_version:worldSimulationObserverTickPrefixReconstructionVersion,
      status:"not_reconstructed"},
    engine_snapshots:[]},scene_id:"room",
});
assert.equal(notReady.audit.status,"not_projected");
assert.deepEqual(notReady.engine_private_character_views,[]);
console.log("CC-7H observer-scoped exact-tick perception tests passed.");
