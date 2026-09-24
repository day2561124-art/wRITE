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

export const worldSimulationNativePreparationEvidenceVersion =
  "cc7ae-native-preparation-commit-evidence-v1";

/**
 * The ONLY preparation material allowed into committed World history.
 * Exact, bounded private audit hashes and source time/ref fields are kept;
 * observer epochs, received surface fragments, World snapshots and cognition
 * stay inside the speculative World engine and are never persisted.
 */
export function assertWorldSimulationNativePreparationEvidence({
  evidence, choice_evidence, original_receipts, action_outcomes,
} = {}) {
  if (evidence === undefined || evidence === null) {
    if (choice_evidence?.source_preparation_audit_hash !== undefined)
      invalid("Delayed response must carry its linked preparation evidence.");
    return null;
  }
  const keys = [
    "schema_version", "character", "source_pre_turn_world_state_hash",
    "source_original_receipt_bundle_hash", "source_native_replay_audit_hash",
    "source_response_action_id", "source_response_release_time_ms",
    "preparation_audits", "last_preparation_audit_hash",
    "evidence_hash",
  ];
  if (!record(evidence) || Object.keys(evidence).sort().join("|")
      !== keys.sort().join("|")
      || evidence.schema_version !== worldSimulationNativePreparationEvidenceVersion
      || !record(choice_evidence) || !record(original_receipts)
      || !Array.isArray(action_outcomes)
      || !Array.isArray(evidence.preparation_audits)
      || evidence.preparation_audits.length < 1
      || evidence.preparation_audits.length > 32)
    invalid("Preparation commit evidence requires bounded exact source records.");
  const { evidence_hash: hash, ...payload } = evidence;
  if (hash !== hashAgentRunValue(payload)
      || evidence.source_original_receipt_bundle_hash
        !== original_receipts.receipt_bundle_hash
      || evidence.source_pre_turn_world_state_hash
        !== original_receipts.world_state_hash
      || evidence.character !== choice_evidence.character
      || evidence.source_native_replay_audit_hash
        !== choice_evidence.source_native_replay_audit_hash
      || evidence.source_response_action_id
        !== choice_evidence.response_action_id
      || evidence.source_response_release_time_ms
        !== choice_evidence.response_release_time_ms
      || choice_evidence.preparation_decision_count
        !== evidence.preparation_audits.length)
    invalid("Preparation commit evidence and selected speech provenance disagree.");
  const expectedObserverRef =
    `observer_${hashAgentRunValue(evidence.character).slice(0, 24)}`;
  let prior = null;
  for (const audit of evidence.preparation_audits) {
    if (!record(audit)) invalid("Preparation audit must be a record.");
    const { audit_hash: auditHash, ...raw } = audit;
    if (auditHash !== hashAgentRunValue(raw)
        || audit.schema_version !== worldSimulationNativeResponsePreparationVersion
        || audit.observer_ref !== expectedObserverRef
        || audit.source_pre_turn_world_state_hash
          !== evidence.source_pre_turn_world_state_hash
        || JSON.stringify(audit.boundaries)
          !== JSON.stringify(buildWorldSimulationNativeResponsePreparationContract())
        || audit.consumed_count !== (prior?.consumed_count ?? 0) + 1
        || audit.wait_count + audit.revision_count !== audit.consumed_count
        || audit.wait_count !== (prior?.wait_count ?? 0)
          + Number(audit.latest_decision === "wait")
        || audit.revision_count !== (prior?.revision_count ?? 0)
          + Number(audit.latest_decision === "revise_preparation")
        || audit.previous_audit_hash !== (prior?.audit_hash ?? null)
        || (prior && (audit.first_epoch_id !== prior.first_epoch_id
          || audit.source_causal_epoch_hash !== prior.source_causal_epoch_hash
          || audit.last_release_cursor <= prior.last_release_cursor
          || audit.last_release_time_ms <= prior.last_release_time_ms))
        || !Number.isFinite(audit.last_release_time_ms)
        || audit.last_release_time_ms < 0
        || audit.public_signal_emitted !== false
        || audit.character_action_selected !== false
        || audit.world_mutation_performed !== false
        || audit.persistent_memory_written !== false)
      invalid("Preparation chain is stale, forged, or reports a public outcome.");
    prior = audit;
  }
  if (prior.audit_hash !== evidence.last_preparation_audit_hash
      || choice_evidence.source_preparation_audit_hash
        !== prior.audit_hash
      || choice_evidence.response_release_time_ms
        <= prior.last_release_time_ms
      || action_outcomes.filter((outcome) =>
        outcome.actor === evidence.character
        && outcome.action_id === evidence.source_response_action_id
        && outcome.result === "communication_emitted"
        && outcome.start_time_ms === evidence.source_response_release_time_ms
        && outcome.communication_event?.channel === "speech").length !== 1)
    invalid("Preparation chain has no matching later committed speech.");
  return copy(evidence);
}

export function buildWorldSimulationNativePreparationEvidence({
  native_replay, choice_evidence, original_receipts,
} = {}) {
  const replay = native_replay;
  const audits = replay?.preparation_audits;
  const response = replay?.native_temporal_response;
  if (replay?.status !== "replayed_same_turn"
      || !Array.isArray(audits) || audits.length === 0
      || !record(response) || !record(choice_evidence)
      || !record(replay.preparation_audit)
      || response.source_preparation_audit_hash
        !== replay.preparation_audit.audit_hash
      || response.source_preparation_consumed_count !== audits.length
      || JSON.stringify(replay.preparation_audit)
        !== JSON.stringify(audits.at(-1)))
    invalid("Only the actual World replay may generate delayed preparation evidence.");
  const payload = {
    schema_version: worldSimulationNativePreparationEvidenceVersion,
    character: response.actor,
    source_pre_turn_world_state_hash: response.source_pre_turn_state_hash,
    source_original_receipt_bundle_hash:
      original_receipts?.receipt_bundle_hash ?? null,
    source_native_replay_audit_hash: response.audit_hash,
    source_response_action_id: response.action_id,
    source_response_release_time_ms: response.start_time_ms,
    preparation_audits: copy(audits),
    last_preparation_audit_hash: audits.at(-1).audit_hash,
  };
  const evidence = { ...payload, evidence_hash: hashAgentRunValue(payload) };
  return assertWorldSimulationNativePreparationEvidence({
    evidence, choice_evidence, original_receipts,
    action_outcomes: replay.causal_resolution?.action_outcomes ?? [],
  });
}
