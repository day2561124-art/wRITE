import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "./world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationChronologicalMutationQueueVersion } from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationObserverTickSnapshotReadinessVersion =
  "cc7f-observer-tick-snapshot-readiness-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => Array.isArray(v) ? v : [];

function reject(message) {
  const error = new Error(message);
  error.code = "CC7F_OBSERVER_TICK_SNAPSHOT_READINESS_INVALID";
  throw error;
}

export function buildWorldSimulationObserverTickSnapshotReadinessContract() {
  return {
    version: worldSimulationObserverTickSnapshotReadinessVersion,
    source: "cc7e_release_ledger_and_phase62j_mutation_queue",
    engine_only: true,
    observer_world_view_created: false,
    snapshot_world_state_materialized: false,
    character_brain_invoked_here: false,
    world_action_replanned: false,
    atomic_world_turn_committed_per_tick: false,
    all_queued_mutation_times_must_be_exact: true,
    same_timestamp_batch_must_remain_indivisible: true,
    inferred_turn_end_time_is_not_actual_occurrence_time: true,
    unverified_mutation_executor_cannot_authorize_snapshot: true,
    private_or_future_state_exposed: false,
    future_increment_forwarded: false,
    floor_or_grounding_claimed: false,
  };
}

/**
 * Readiness evidence ONLY. A Phase62J mutation timestamp may be inferred
 * from turn-end, so replaying that mutation at its nominal timestamp cannot
 * make a trustworthy mid-turn World snapshot. Even an "eligible" receipt is
 * not an actual World state or a Character Brain perception.
 */
export function buildWorldSimulationObserverTickSnapshotReadiness({
  ledger,
  chronological_mutation_queue = null,
  chronological_mutation_execution = null,
} = {}) {
  if (!record(ledger)
      || ledger.schema_version !== worldSimulationObserverMicrotickLedgerVersion
      || !Array.isArray(ledger.ticks)
      || ledger.tick_count !== ledger.ticks.length
      || ledger.admitted_cue_count !== ledger.ticks.reduce(
        (sum, tick) => sum + list(tick?.observer_cues).length, 0)
      || !ledger.ledger_hash)
    reject("CC-7F requires a valid CC-7E release ledger.");
  const { ledger_hash: ledgerHash, ...ledgerPayload } = ledger;
  if (ledgerHash !== hashAgentRunValue(ledgerPayload))
    reject("CC-7F refuses altered release ledger evidence.");
  if (!ledger.tick_count) {
    return {
      schema_version: worldSimulationObserverTickSnapshotReadinessVersion,
      ledger_hash: ledgerHash,
      status: "no_observer_release_ticks",
      ticks: [],
      ready_tick_count: 0,
      boundaries: buildWorldSimulationObserverTickSnapshotReadinessContract(),
    };
  }

  const queue = chronological_mutation_queue;
  const execution = chronological_mutation_execution;
  const hasQueue = record(queue)
    && queue.version === worldSimulationChronologicalMutationQueueVersion
    && Array.isArray(queue.batches);
  if (hasQueue) {
    const hashBody = {
      version: queue.version,
      turn_id: queue.turn_id,
      mutation_count: queue.mutation_count,
      batch_count: queue.batch_count,
      terminal_chain_hash: queue.terminal_chain_hash,
      batches: queue.batches,
    };
    if (queue.validation_context) hashBody.validation_context = queue.validation_context;
    if (hashAgentRunValue(hashBody) !== queue.queue_hash)
      reject("CC-7F refuses a modified authoritative mutation queue.");
  }
  const batches = hasQueue ? queue.batches : [];
  if (batches.length > 4096)
    reject("CC-7F mutation batches exceed the bounded readiness scope.");
  let preceding = -Infinity;
  let mutationCount = 0;
  let inferredCount = 0;
  for (const batch of batches) {
    if (!record(batch) || !Number.isFinite(batch.time_ms)
        || batch.time_ms <= preceding || batch.time_ms < 0
        || !Array.isArray(batch.mutations))
      reject("CC-7F requires ordered bounded mutation batches.");
    preceding = batch.time_ms;
    for (const mutation of batch.mutations) {
      if (!record(mutation) || mutation.time_ms !== batch.time_ms
          || typeof mutation.mutation_id !== "string")
        reject("Mutation timestamp and batch identity must agree.");
      mutationCount += 1;
      if (mutation.time_precision !== "exact") inferredCount += 1;
    }
  }
  if (hasQueue && (queue.mutation_count !== mutationCount
      || queue.batch_count !== batches.length
      || queue.inferred_timestamp_mutation_count !== inferredCount))
    reject("CC-7F refuses inconsistent mutation queue totals.");
  const executionAttested = hasQueue
    && record(execution)
    && execution.queue_hash === queue.queue_hash
    && execution.all_preview_changes_reproduced_by_queue === true
    && execution.sole_final_world_state_writer === true;
  const ready = hasQueue
    && inferredCount === 0
    && queue.continuity_warning_count === 0
    && executionAttested;
  const reason = !hasQueue ? "authoritative_mutation_queue_unavailable"
    : inferredCount ? "mutation_occurrence_time_inferred"
    : queue.continuity_warning_count !== 0 ? "mutation_continuity_unverified"
    : !executionAttested ? "mutation_executor_attestation_unavailable"
    : null;

  let priorTickTime = -Infinity;
  const ticks = ledger.ticks.map((tick) => {
    if (!record(tick) || !Number.isFinite(tick.release_time_ms)
        || tick.release_time_ms <= priorTickTime)
      reject("CC-7F requires strictly ordered release ticks.");
    priorTickTime = tick.release_time_ms;
    const releasedBatches = batches.filter(
      (batch) => batch.time_ms <= tick.release_time_ms);
    return {
      release_time_ms: tick.release_time_ms,
      snapshot_ready: ready,
      refusal_reason: reason,
      complete_same_timestamp_batch_count: ready ? releasedBatches.length : 0,
      complete_same_timestamp_mutation_count: ready
        ? releasedBatches.reduce((count, batch) => count + batch.mutations.length, 0) : 0,
      // Hashes are engine-side evidence only; do not export the queue or states.
      verified_mutation_prefix_ref: ready
        ? `tick_prefix_${hashAgentRunValue({
          queue_hash: queue.queue_hash,
          ledger_hash: ledgerHash,
          release_time_ms: tick.release_time_ms,
          complete_batch_hashes: releasedBatches.map((batch) => batch.chain_hash_after),
        }).slice(0, 24)}` : null,
      world_snapshot_materialized: false,
      character_view_created: false,
    };
  });
  return {
    schema_version: worldSimulationObserverTickSnapshotReadinessVersion,
    ledger_hash: ledgerHash,
    source_queue_hash: hasQueue ? queue.queue_hash : null,
    status: ready ? "exact_prefix_readiness_only" : "snapshot_not_safe",
    ready_tick_count: ready ? ticks.length : 0,
    ticks,
    boundaries: buildWorldSimulationObserverTickSnapshotReadinessContract(),
  };
}
