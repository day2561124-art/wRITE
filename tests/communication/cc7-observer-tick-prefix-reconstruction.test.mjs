import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationObserverTickSnapshotReadiness,
} from "../../server/src/world-simulation-observer-tick-snapshot-readiness-service.mjs";
import {
  worldSimulationObserverMicrotickLedgerVersion,
} from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import {
  buildWorldSimulationObserverTickPrefixReconstructionContract,
  reconstructWorldSimulationObserverTickPrefixes,
} from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";

const contract = buildWorldSimulationObserverTickPrefixReconstructionContract();
assert.equal(contract.snapshots_engine_private_only, true);
assert.equal(contract.persistent_audit_contains_world_state, false);
assert.equal(contract.character_brain_invoked, false);
assert.equal(contract.mid_turn_action_replanning, false);

const payload = {
  schema_version: worldSimulationObserverMicrotickLedgerVersion,
  ticks: [
    { release_time_ms: 100, observer_cues: [{ observer: "B" }] },
    { release_time_ms: 250, observer_cues: [{ observer: "B" }] },
  ],
  tick_count: 2,
  admitted_cue_count: 2,
  boundaries: {},
};
const ledger = { ...payload, ledger_hash: hashAgentRunValue(payload) };
const pre = { simulation_time: "2026-09-23T00:00:00.000Z", marker: "before" };
const full = { simulation_time: pre.simulation_time, marker: "later" };
const queue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "cc7g-fixture",
  world_state_hash: hashAgentRunValue(pre),
  elapsed_ms: 250,
  state_transitions: [{
    entity: "world", field: "marker",
    from: "before", to: "earlier",
    time_ms: 100, source_layer: "spatial_rules",
  }, {
    entity: "world", field: "marker",
    from: "earlier", to: "later",
    time_ms: 250, source_layer: "spatial_rules",
  }],
  causal_timeline: { entries: [] },
});
const execution = executeWorldSimulationChronologicalMutationQueue({
  world_state: pre, preview_world_state: full, queue,
}).execution;
const readiness = buildWorldSimulationObserverTickSnapshotReadiness({
  ledger,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
});
assert.equal(readiness.ready_tick_count, 2);
const rebuilt = reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: pre,
  authoritative_next_world_state: full,
  ledger, readiness,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
});
assert.equal(rebuilt.audit.status, "engine_private_prefixes_reconstructed");
assert.equal(rebuilt.audit.reconstructed_tick_count, 2);
assert.deepEqual(rebuilt.engine_snapshots.map((s) => s.world_state.marker),
  ["earlier", "later"]);
assert.equal(rebuilt.engine_snapshots[0].release_time_ms, 100);
assert.equal(rebuilt.engine_snapshots[1].release_time_ms, 250);
assert.equal(rebuilt.audit.ticks[0].complete_same_timestamp_batch_count, 1);
assert.equal(rebuilt.audit.ticks[1].complete_same_timestamp_batch_count, 2);
assert.equal(rebuilt.audit.ticks[0].reconstructed_world_state_hash,
  hashAgentRunValue(rebuilt.engine_snapshots[0].world_state));
assert.equal(JSON.stringify(rebuilt.audit).includes("\"marker\":\"earlier\""), false);
assert.equal(JSON.stringify(rebuilt.audit).includes("\"marker\":\"later\""), false);
assert.equal(JSON.stringify(rebuilt.audit).includes("\"world_state\":"), false);
assert.deepEqual(pre, { simulation_time: "2026-09-23T00:00:00.000Z", marker: "before" });
assert.deepEqual(full, { simulation_time: pre.simulation_time, marker: "later" });
assert.deepEqual(
  reconstructWorldSimulationObserverTickPrefixes({
    pre_turn_world_state: pre, authoritative_next_world_state: full,
    ledger, readiness, chronological_mutation_queue: queue,
    chronological_mutation_execution: execution,
  }),
  rebuilt,
);

const altered = reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: pre,
  authoritative_next_world_state: { ...full, marker: "forged" },
  ledger, readiness,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
});
assert.equal(altered.audit.status, "not_reconstructed");
assert.deepEqual(altered.engine_snapshots, []);
const forgedExecutor = reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: pre,
  authoritative_next_world_state: full,
  ledger, readiness,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: { ...execution, execution_hash: "wrong" },
});
assert.equal(forgedExecutor.audit.reason, "authoritative_full_replay_mismatch");
const excessiveTicksPayload = {
  ...payload,
  ticks: Array.from({ length: 33 }, (_, i) => ({
    release_time_ms: i + 1,
    observer_cues: [{ observer: "B" }],
  })),
  tick_count: 33,
  admitted_cue_count: 33,
};
const excessiveLedger = {
  ...excessiveTicksPayload,
  ledger_hash: hashAgentRunValue(excessiveTicksPayload),
};
const excessiveReadiness = buildWorldSimulationObserverTickSnapshotReadiness({
  ledger: excessiveLedger,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
});
assert.equal(reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: pre, authoritative_next_world_state: full,
  ledger: excessiveLedger, readiness: excessiveReadiness,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
}).audit.reason, "snapshot_count_budget_exceeded");
assert.equal(reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: { ...pre, oversized: "x".repeat(1000000) },
  authoritative_next_world_state: full,
  ledger, readiness,
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
}).audit.reason, "source_world_state_budget_exceeded");
assert.throws(() => reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state: pre, authoritative_next_world_state: full,
  ledger, readiness: { ...readiness, source_queue_hash: "forged" },
  chronological_mutation_queue: queue,
  chronological_mutation_execution: execution,
}), /altered CC-7F readiness/u);
const inferredQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "cc7g-inferred",
  world_state_hash: hashAgentRunValue(pre),
  elapsed_ms: 250,
  state_transitions: [{
    entity: "world", field: "marker",
    from: "before", to: "later",
    source_layer: "spatial_rules",
  }],
});
const inferred = buildWorldSimulationObserverTickSnapshotReadiness({
  ledger,
  chronological_mutation_queue: inferredQueue,
  chronological_mutation_execution: {
    queue_hash: inferredQueue.queue_hash,
    all_preview_changes_reproduced_by_queue: true,
    sole_final_world_state_writer: true,
  },
});
assert.equal(inferred.ready_tick_count, 0);
assert.equal(reconstructWorldSimulationObserverTickPrefixes({
  ledger, readiness: inferred,
}).audit.status, "not_reconstructed");
assert.equal(reconstructWorldSimulationObserverTickPrefixes({
  ledger, readiness: buildWorldSimulationObserverTickSnapshotReadiness({ ledger: {
    ...payload, ticks: [], tick_count: 0, admitted_cue_count: 0,
    ledger_hash: hashAgentRunValue({ ...payload, ticks: [], tick_count: 0, admitted_cue_count: 0 }),
  } }),
}).audit.status, "not_reconstructed");

console.log("CC-7G engine-private exact-prefix reconstruction tests passed.");
