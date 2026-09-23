import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  executeWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationObserverTickSnapshotReadiness,
  worldSimulationObserverTickSnapshotReadinessVersion,
} from "./world-simulation-observer-tick-snapshot-readiness-service.mjs";

export const worldSimulationObserverTickPrefixReconstructionVersion =
  "cc7g-observer-tick-prefix-reconstruction-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function invalid(message) {
  const error = new Error(message);
  error.code = "CC7G_PREFIX_RECONSTRUCTION_INVALID";
  throw error;
}

export function buildWorldSimulationObserverTickPrefixReconstructionContract() {
  return {
    version: worldSimulationObserverTickPrefixReconstructionVersion,
    source: "cc7f_verified_readiness_and_phase62k_authoritative_replay",
    snapshots_engine_private_only: true,
    persistent_audit_contains_world_state: false,
    base_is_pre_turn_world_state: true,
    replay_uses_existing_phase62k_precondition_checks: true,
    earlier_complete_timestamp_batches_only: true,
    same_timestamp_batches_not_split: true,
    unverified_final_executor_hash_refused: true,
    no_ready_ticks_means_no_reconstruction: true,
    maximum_engine_private_snapshot_count: 32,
    maximum_source_state_json_characters: 1000000,
    world_mutation_performed: false,
    character_view_created: false,
    character_brain_invoked: false,
    mid_turn_action_replanning: false,
  };
}

const refusal = (readiness, reason) => ({
  audit: {
    schema_version: worldSimulationObserverTickPrefixReconstructionVersion,
    readiness_ledger_hash: readiness?.ledger_hash ?? null,
    status: "not_reconstructed",
    reason,
    reconstructed_tick_count: 0,
    ticks: [],
    boundaries: buildWorldSimulationObserverTickPrefixReconstructionContract(),
  },
  engine_snapshots: [],
});

/**
 * This function returns private, speculative World states solely to the
 * engine. The native turn persists ONLY the audit, never engine_snapshots.
 * A replay is not a live time-sliced commit or observer perception.
 */
export function reconstructWorldSimulationObserverTickPrefixes({
  pre_turn_world_state,
  authoritative_next_world_state,
  ledger,
  readiness,
  chronological_mutation_queue,
  chronological_mutation_execution,
  scene_id = null,
} = {}) {
  if (!record(readiness)
      || readiness.schema_version !== worldSimulationObserverTickSnapshotReadinessVersion
      || !Array.isArray(readiness.ticks))
    invalid("CC-7G requires the prior CC-7F readiness record.");

  // No snapshot work or world state inspection on ordinary no-speech turns.
  if (!readiness.ready_tick_count)
    return refusal(readiness, "no_cc7f_ready_ticks");

  const recomputed = buildWorldSimulationObserverTickSnapshotReadiness({
    ledger,
    chronological_mutation_queue,
    chronological_mutation_execution,
  });
  if (JSON.stringify(recomputed) !== JSON.stringify(readiness))
    invalid("CC-7G refuses stale or altered CC-7F readiness.");
  if (readiness.ready_tick_count !== readiness.ticks.length
      || readiness.status !== "exact_prefix_readiness_only"
      || !record(pre_turn_world_state)
      || !record(authoritative_next_world_state))
    return refusal(readiness, "authoritative_world_state_unavailable");

  if (readiness.ticks.length > 32)
    return refusal(readiness, "snapshot_count_budget_exceeded");
  const sourceJson = JSON.stringify(pre_turn_world_state);
  if (sourceJson.length > 1000000)
    return refusal(readiness, "source_world_state_budget_exceeded");

  const queue = chronological_mutation_queue;
  const execution = chronological_mutation_execution;
  if (!record(queue) || !record(execution) || typeof execution.execution_hash !== "string")
    return refusal(readiness, "authoritative_execution_hash_unavailable");

  // The same authoritative executor must reproduce this exact complete
  // resolution from the actual pre-turn state before any prefix may be used.
  let full;
  try {
    full = executeWorldSimulationChronologicalMutationQueue({
      world_state: pre_turn_world_state,
      preview_world_state: authoritative_next_world_state,
      queue,
      scene_id,
    });
  } catch {
    return refusal(readiness, "authoritative_full_replay_failed");
  }
  if (full.execution.execution_hash !== execution.execution_hash
      || hashAgentRunValue(full.next_world_state)
        !== hashAgentRunValue(authoritative_next_world_state))
    return refusal(readiness, "authoritative_full_replay_mismatch");

  const engineSnapshots = [];
  const tickAudits = [];
  const originalHash = hashAgentRunValue(pre_turn_world_state);
  for (const tick of readiness.ticks) {
    if (tick.snapshot_ready !== true
        || !Number.isFinite(tick.release_time_ms)
        || typeof tick.verified_mutation_prefix_ref !== "string")
      invalid("CC-7G only accepts exact verified release ticks.");
    const prefixBatches = queue.batches.filter(
      (batch) => batch.time_ms <= tick.release_time_ms);
    const prefix = {
      ...queue,
      batches: prefixBatches,
      batch_count: prefixBatches.length,
      mutation_count: prefixBatches.reduce(
        (count, batch) => count + batch.mutations.length, 0),
    };
    let reconstructed;
    try {
      reconstructed = projectWorldSimulationChronologicalMutationQueue({
        world_state: pre_turn_world_state,
        queue: prefix,
        scene_id,
      }).projected_world_state;
    } catch {
      return refusal(readiness, "authoritative_prefix_replay_failed");
    }
    const snapshotHash = hashAgentRunValue(reconstructed);
    const receipt = {
      release_time_ms: tick.release_time_ms,
      mutation_prefix_ref: tick.verified_mutation_prefix_ref,
      reconstructed_world_state_hash: snapshotHash,
      source_pre_turn_world_state_hash: originalHash,
      complete_same_timestamp_batch_count: prefixBatches.length,
      world_snapshot_materialized_engine_only: true,
      character_view_created: false,
    };
    tickAudits.push(receipt);
    engineSnapshots.push({
      release_time_ms: tick.release_time_ms,
      world_state: copy(reconstructed),
      ...receipt,
    });
  }

  return {
    audit: {
      schema_version: worldSimulationObserverTickPrefixReconstructionVersion,
      readiness_ledger_hash: readiness.ledger_hash,
      source_queue_hash: queue.queue_hash,
      source_execution_hash: execution.execution_hash,
      status: "engine_private_prefixes_reconstructed",
      reconstructed_tick_count: tickAudits.length,
      ticks: tickAudits,
      boundaries: buildWorldSimulationObserverTickPrefixReconstructionContract(),
    },
    engine_snapshots: engineSnapshots,
  };
}
