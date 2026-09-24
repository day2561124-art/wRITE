import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "../../server/src/world-simulation-observer-prepared-epoch-service.mjs";
import {
  stepWorldSimulationNativeResponsePreparation,
  buildWorldSimulationNativeResponsePreparationContract,
} from "../../server/src/world-simulation-native-response-preparation-service.mjs";

const cue=(observer,ref,phase)=>({
  observer,signal_ref:"signal-"+observer,increment_ref:ref,
  signal_phase:phase,perceived_cue_refs:[ref],
  heard_surface_fragment:null,perceived_speaker:null,
  lexical_intelligibility_attested:false,
  speaker_identity_recognized:false,no_future_increment_exposed:true,
});
const pre={scene_state:{scene_id:"room"},secret:"ORIGINAL_WORLD_SECRET"};
const later={scene_state:{scene_id:"room"},secret:"FUTURE_WORLD_SECRET"};
const ticks=[
  {release_time_ms:100,observer_cues:[
    {observer:"B",observer_increment:cue("B","B_FIRST","ongoing")},
    {observer:"C",observer_increment:cue("C","C_FIRST","ongoing")},
  ]},
  {release_time_ms:200,observer_cues:[
    {observer:"C",observer_increment:cue("C","C_SECOND","ongoing")},
  ]},
  {release_time_ms:350,observer_cues:[
    {observer:"B",observer_increment:cue("B","B_NEXT","acoustic_segment_ended")},
  ]},
];
const ledgerPayload={
  schema_version:worldSimulationObserverMicrotickLedgerVersion,
  ticks,tick_count:3,admitted_cue_count:4,boundaries:{},
};
const ledger={...ledgerPayload,ledger_hash:hashAgentRunValue(ledgerPayload)};
const snapshots=[pre,pre,later].map((world_state,i)=>({
  release_time_ms:ticks[i].release_time_ms,
  world_state,
  reconstructed_world_state_hash:hashAgentRunValue(world_state),
  mutation_prefix_ref:"prefix-"+i,
}));
const reconstruction={audit:{
  schema_version:worldSimulationObserverTickPrefixReconstructionVersion,
  status:"engine_private_prefixes_reconstructed",
  readiness_ledger_hash:ledger.ledger_hash,
  source_execution_hash:"authoritative-world-execution",
  ticks:snapshots.map(s=>({
    release_time_ms:s.release_time_ms,
    reconstructed_world_state_hash:s.reconstructed_world_state_hash,
    mutation_prefix_ref:s.mutation_prefix_ref,
    source_pre_turn_world_state_hash:hashAgentRunValue(pre),
  })),
},engine_snapshots:snapshots};
const base={session_id:"session",turn_id:"turn",world_state_revision:7,
  pre_turn_world_state:pre,ledger,reconstruction,scene_id:"room",observer:"B"};
const first=prepareWorldSimulationObserverTemporalEpoch({...base,cursor:0});
const wait=stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:0},presented_epoch:first,decision:"wait",
});
assert.equal(wait.audit.wait_count,1);
assert.equal(wait.audit.revision_count,0);
assert.equal(wait.audit.consumed_count,1);
assert.equal(wait.audit.public_signal_emitted,false);
assert.equal(wait.audit.character_action_selected,false);
assert.equal(wait.audit.world_mutation_performed,false);
assert.equal(buildWorldSimulationNativeResponsePreparationContract()
  .numeric_turn_gap_threshold,false);
const second=prepareWorldSimulationObserverTemporalEpoch({
  ...base,cursor:2,previous_epoch:first,
});
const revision=stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2},
  presented_epoch:second,decision:"revise_preparation",previous:wait,
});
assert.equal(revision.audit.wait_count,1);
assert.equal(revision.audit.revision_count,1);
assert.equal(revision.audit.consumed_count,2);
assert.equal(revision.audit.previous_audit_hash,wait.audit.audit_hash);
assert.equal(revision.audit.last_release_time_ms,350);
assert.deepEqual(revision,stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2},presented_epoch:second,
  decision:"revise_preparation",previous:wait,
}));
assert.equal(JSON.stringify(wait.audit).includes("B_NEXT"),false);
assert.equal(JSON.stringify(wait.audit).includes("C_FIRST"),false);
assert.equal(JSON.stringify(wait.audit).includes("FUTURE_WORLD_SECRET"),false);
assert.equal(JSON.stringify(revision.audit).includes("ORIGINAL_WORLD_SECRET"),false);
assert.equal(JSON.stringify(revision.audit).includes("FUTURE_WORLD_SECRET"),false);
assert.throws(()=>stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:0},presented_epoch:first,
  decision:"wait",previous:wait,
}),/same observer|later|consumed|cannot be skipped|prior epoch/u);
assert.throws(()=>stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2},presented_epoch:first,
  decision:"revise_preparation",previous:wait,
}),/freshly reconstructed/u);
assert.throws(()=>stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2},presented_epoch:second,
  decision:"revise_preparation",previous:{
    ...wait,audit:{...wait.audit,wait_count:999},
  },
}),/altered/u);
assert.throws(()=>stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2,world_state_revision:8},
  presented_epoch:second,decision:"wait",previous:wait,
}),/same observer and causal epoch|reconstructed/u);
assert.throws(()=>stepWorldSimulationNativeResponsePreparation({
  epoch_context:{...base,cursor:2},presented_epoch:second,
  decision:"backchannel",previous:wait,
}),/nonemitting/u);
assert.equal(hashAgentRunValue(pre),
  hashAgentRunValue({scene_state:{scene_id:"room"},secret:"ORIGINAL_WORLD_SECRET"}));
console.log("CC-7AE bounded nonemitting observer preparation-revision tests passed.");
