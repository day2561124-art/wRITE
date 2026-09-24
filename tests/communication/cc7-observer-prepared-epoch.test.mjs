import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import {
  prepareWorldSimulationObserverTemporalEpoch,
  acceptWorldSimulationObserverPreparedEpochResponse,
  buildWorldSimulationObserverPreparedEpochContract,
} from "../../server/src/world-simulation-observer-prepared-epoch-service.mjs";

const cue = (observer, ref, phase) => ({
  observer, signal_ref: "signal-" + observer, increment_ref: ref,
  signal_phase: phase, perceived_cue_refs: [ref],
  heard_surface_fragment: null, perceived_speaker: null,
  lexical_intelligibility_attested: false,
  speaker_identity_recognized: false,
  no_future_increment_exposed: true,
});
const pre = { scene_state: { scene_id: "room" }, secret: "PRE_WORLD_SECRET" };
const later = { scene_state: { scene_id: "room" }, secret: "FUTURE_WORLD_SECRET" };
const ticks = [
  { release_time_ms: 100, observer_cues: [
    { observer: "B", observer_increment: cue("B", "B_FIRST", "ongoing") },
    { observer: "C", observer_increment: cue("C", "C_FIRST", "ongoing") },
  ] },
  { release_time_ms: 250, observer_cues: [
    { observer: "B", observer_increment: cue("B", "B_FUTURE", "acoustic_segment_ended") },
    { observer: "D", observer_increment: cue("D", "D_FIRST", "ongoing") },
  ] },
];
const ledgerPayload = {
  schema_version: worldSimulationObserverMicrotickLedgerVersion,
  ticks, tick_count: 2, admitted_cue_count: 4, boundaries: {},
};
const ledger = { ...ledgerPayload, ledger_hash: hashAgentRunValue(ledgerPayload) };
const snapshots = [pre, later].map((world_state, index) => ({
  release_time_ms: ticks[index].release_time_ms,
  world_state,
  reconstructed_world_state_hash: hashAgentRunValue(world_state),
  mutation_prefix_ref: "prefix-" + index,
}));
const reconstruction = {
  audit: {
    schema_version: worldSimulationObserverTickPrefixReconstructionVersion,
    status: "engine_private_prefixes_reconstructed",
    readiness_ledger_hash: ledger.ledger_hash,
    source_execution_hash: "authoritative-execution-hash",
    ticks: snapshots.map((snapshot) => ({
      release_time_ms: snapshot.release_time_ms,
      reconstructed_world_state_hash: snapshot.reconstructed_world_state_hash,
      mutation_prefix_ref: snapshot.mutation_prefix_ref,
      source_pre_turn_world_state_hash: hashAgentRunValue(pre),
    })),
  },
  engine_snapshots: snapshots,
};
const args = {
  session_id: "session-1", turn_id: "turn-8", world_state_revision: 7,
  pre_turn_world_state: pre, ledger, reconstruction, scene_id: "room",
};
const first = prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B",
});
assert.deepEqual(first, prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B",
}));
assert.equal(first.release_cursor, 0);
assert.equal(first.next_cursor, 1);
assert.equal(first.release_time_ms, 100);
assert.deepEqual(first.observer_view.heard_nonlexical[0].perceived_cue_refs, ["B_FIRST"]);
assert.equal(first.observer_view.heard_nonlexical.length, 1);
assert.equal(first.observer_view.future_release_exposed, false);
assert.equal(first.boundaries.public_signal_emitted, false);
assert.equal(buildWorldSimulationObserverPreparedEpochContract().action_proposal_supported, false);
const serialized = JSON.stringify(first);
for (const hidden of [
  "B_FUTURE", "C_FIRST", "D_FIRST", "PRE_WORLD_SECRET", "FUTURE_WORLD_SECRET",
  '"world_state":', "source_action_id", "speaker_identity_recognized\":true",
]) assert.equal(serialized.includes(hidden), false, hidden);
const cFirst = prepareWorldSimulationObserverTemporalEpoch({ ...args, observer: "C" });
assert.notEqual(first.epoch_id, cFirst.epoch_id);
assert.deepEqual(cFirst.observer_view.heard_nonlexical[0].perceived_cue_refs, ["C_FIRST"]);

const accepted = acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch: first, current_epoch: first,
  response: { epoch_id: first.epoch_id, decision: "wait" },
});
assert.equal(accepted.accepted, true);
assert.equal(accepted.public_signal_emitted, false);
assert.equal(accepted.world_mutation_performed, false);
assert.throws(() => acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch: first, current_epoch: first,
  response: { epoch_id: first.epoch_id, decision: "wait" },
  consumed_epoch_ids: accepted.consumed_epoch_ids,
}), /already been consumed/u);
assert.throws(() => acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch: first, current_epoch: first,
  response: { epoch_id: first.epoch_id, decision: "backchannel" },
}), /cannot propose a public action/u);

const second = prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B", cursor: 1, previous_epoch: first,
});
assert.deepEqual(second.observer_view.heard_nonlexical[0].perceived_cue_refs, ["B_FUTURE"]);
assert.equal(second.release_time_ms, 250);
assert.throws(() => prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B", cursor: 1,
}), /cannot be skipped/u);
assert.equal(prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "C", cursor: 1, previous_epoch: cFirst,
}), null);
const dFirst = prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "D", cursor: 1,
});
assert.deepEqual(dFirst.observer_view.heard_nonlexical[0].perceived_cue_refs, ["D_FIRST"]);
assert.equal(dFirst.release_cursor, 1);
assert.throws(() => acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch: first, current_epoch: second,
  response: { epoch_id: first.epoch_id, decision: "wait" },
}), /Stale or mismatched/u);
const changedRevision = prepareWorldSimulationObserverTemporalEpoch({
  ...args, world_state_revision: 8, observer: "B",
});
assert.throws(() => acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch: first, current_epoch: changedRevision,
  response: { epoch_id: first.epoch_id, decision: "wait" },
}), /Stale or mismatched/u);
assert.throws(() => prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B", reconstruction: {
    ...reconstruction,
    audit: { ...reconstruction.audit, source_execution_hash: "changed" },
  }, cursor: 1, previous_epoch: first,
}), /same observer and causal epoch/u);
assert.throws(() => prepareWorldSimulationObserverTemporalEpoch({
  ...args, observer: "B", reconstruction: {
    ...reconstruction,
    engine_snapshots: [{ ...snapshots[0], world_state: later }, snapshots[1]],
  },
}), /authoritative prefix|exact verified/u);
assert.deepEqual(pre, { scene_state: { scene_id: "room" }, secret: "PRE_WORLD_SECRET" });
console.log("CC-7AB read-only prepared epoch tests passed.");
