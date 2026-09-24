import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  prepareWorldSimulationObserverTemporalEpoch,
  acceptWorldSimulationObserverPreparedEpochResponse,
} from "./world-simulation-observer-prepared-epoch-service.mjs";

export const worldSimulationNativeResponsePreparationVersion =
  "cc7ae-native-response-preparation-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function invalid(message) {
  const error = new Error(message);
  error.code = "CC7AE_NATIVE_PREPARATION_INVALID";
  throw error;
}

export function buildWorldSimulationNativeResponsePreparationContract() {
  return {
    schema_version: worldSimulationNativeResponsePreparationVersion,
    owner: "world_engine_private_observer_cursor",
    source: "cc7ab_one_use_verified_epoch_response",
    revision_must_follow_a_new_admitted_release: true,
    may_wait_or_revise_preparation_only: true,
    future_cue_available: false,
    other_observer_view_available: false,
    world_truth_available: false,
    speaker_intention_available: false,
    numeric_turn_gap_threshold: false,
    public_signal_emitted: false,
    character_action_selected: false,
    world_mutation_performed: false,
    long_term_memory_written: false,
    engine_private_epoch_must_not_be_persisted: true,
  };
}

/**
 * One internal preparation decision at an already-admitted observer release.
 * Calls the existing CC-7AB exact-epoch and one-use receipt gates, instead of
 * implementing a second perception, memory, or Character Brain. A following
 * release MUST receive the engine_private_last_epoch from this result and
 * cannot skip any intervening admitted cue for the same observer.
 */
export function stepWorldSimulationNativeResponsePreparation({
  epoch_context, presented_epoch, decision, previous = null,
} = {}) {
  if (!record(epoch_context) || !record(presented_epoch)
      || !["wait", "revise_preparation"].includes(decision))
    invalid("Response preparation requires an exact epoch and a nonemitting decision.");
  if (previous !== null) {
    if (!record(previous) || !record(previous.audit)
        || previous.audit.schema_version !== worldSimulationNativeResponsePreparationVersion
        || !record(previous.engine_private_last_epoch)
        || !Array.isArray(previous.engine_private_consumed_epoch_ids)
        || previous.audit.last_epoch_id !== previous.engine_private_last_epoch.epoch_id
        || previous.audit.consumed_count !== previous.engine_private_consumed_epoch_ids.length
        || previous.audit.audit_hash !== hashAgentRunValue(Object.fromEntries(
          Object.entries(previous.audit).filter(([key]) => key !== "audit_hash"))))
      invalid("Previous preparation receipt or private epoch was altered.");
  }
  const priorEpoch = previous?.engine_private_last_epoch ?? null;
  const current = prepareWorldSimulationObserverTemporalEpoch({
    ...epoch_context,
    previous_epoch: priorEpoch,
  });
  if (!current || JSON.stringify(current) !== JSON.stringify(presented_epoch))
    invalid("Preparation must match the freshly reconstructed observer epoch.");
  if (priorEpoch && (current.epoch_id === priorEpoch.epoch_id
      || current.observer !== priorEpoch.observer
      || current.release_time_ms <= priorEpoch.release_time_ms))
    invalid("Preparation may revise only after a later same-observer release.");
  const accepted = acceptWorldSimulationObserverPreparedEpochResponse({
    prepared_epoch: presented_epoch,
    current_epoch: current,
    response: { epoch_id: current.epoch_id, decision },
    consumed_epoch_ids: previous?.engine_private_consumed_epoch_ids ?? [],
  });
  const source = previous?.audit;
  const audit = {
    schema_version: worldSimulationNativeResponsePreparationVersion,
    observer_ref: `observer_${hashAgentRunValue(current.observer).slice(0, 24)}`,
    source_pre_turn_world_state_hash: current.pre_turn_world_state_hash,
    source_causal_epoch_hash: current.causal_epoch_hash,
    previous_audit_hash: source?.audit_hash ?? null,
    first_epoch_id: source?.first_epoch_id ?? current.epoch_id,
    last_epoch_id: current.epoch_id,
    last_release_time_ms: current.release_time_ms,
    last_release_cursor: current.release_cursor,
    latest_decision: decision,
    wait_count: (source?.wait_count ?? 0) + Number(decision === "wait"),
    revision_count: (source?.revision_count ?? 0)
      + Number(decision === "revise_preparation"),
    consumed_count: accepted.consumed_epoch_ids.length,
    public_signal_emitted: false,
    character_action_selected: false,
    world_mutation_performed: false,
    persistent_memory_written: false,
    boundaries: buildWorldSimulationNativeResponsePreparationContract(),
  };
  return {
    audit: { ...audit, audit_hash: hashAgentRunValue(audit) },
    engine_private_last_epoch: copy(current),
    engine_private_consumed_epoch_ids: [...accepted.consumed_epoch_ids],
  };
}
