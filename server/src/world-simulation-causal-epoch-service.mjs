import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationCausalEpochVersion = "phase62u-causal-epoch-freshness-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function revisionValue(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    const error = new Error("Causal epoch world_state_revision must be a non-negative safe integer.");
    error.code = "WORLD_SIMULATION_CAUSAL_EPOCH_REVISION_INVALID";
    throw error;
  }
  return number;
}

function epochIndexValue(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    const error = new Error("Causal epoch epoch_index must be a non-negative safe integer.");
    error.code = "WORLD_SIMULATION_CAUSAL_EPOCH_INDEX_INVALID";
    throw error;
  }
  return number;
}

function normalizedEpoch(value) {
  const epoch = object(value);
  const epochId = String(epoch.epoch_id ?? "").trim();
  const worldStateHash = String(epoch.world_state_hash ?? "").trim();
  const derivationContextHash = String(epoch.derivation_context_hash ?? "").trim();
  if (!epochId || !worldStateHash || !derivationContextHash) {
    const error = new Error("Causal epoch identity is incomplete.");
    error.code = "WORLD_SIMULATION_CAUSAL_EPOCH_IDENTITY_INVALID";
    throw error;
  }
  return {
    epoch_id: epochId,
    epoch_index: epochIndexValue(epoch.epoch_index, 0),
    world_state_revision: revisionValue(epoch.world_state_revision, 0),
    world_state_hash: worldStateHash,
    derivation_context_hash: derivationContextHash,
  };
}

export function openWorldSimulationCausalEpoch(input = {}) {
  if (!isObject(input.world_state)) {
    const error = new Error("Causal epoch requires world_state.");
    error.code = "WORLD_SIMULATION_CAUSAL_EPOCH_WORLD_STATE_REQUIRED";
    throw error;
  }
  const worldState = deepFreeze(cloneJson(input.world_state));
  const actualWorldStateHash = hashAgentRunValue(worldState);
  const suppliedWorldStateHash = String(input.world_state_hash ?? actualWorldStateHash).trim();
  if (!suppliedWorldStateHash || suppliedWorldStateHash !== actualWorldStateHash) {
    const error = new Error("Causal epoch world_state_hash does not match the supplied world_state snapshot.");
    error.code = "WORLD_SIMULATION_CAUSAL_EPOCH_WORLD_STATE_HASH_MISMATCH";
    error.expected_world_state_hash = actualWorldStateHash;
    error.received_world_state_hash = suppliedWorldStateHash || null;
    throw error;
  }
  const worldStateRevision = revisionValue(input.world_state_revision, 0);
  const epochIndex = epochIndexValue(input.epoch_index, 0);
  const derivationContext = deepFreeze(cloneJson(object(input.derivation_context)));
  const derivationContextHash = hashAgentRunValue(derivationContext);
  const epochId = `causal_epoch_${hashAgentRunValue({
    version: worldSimulationCausalEpochVersion,
    epoch_index: epochIndex,
    world_state_revision: worldStateRevision,
    world_state_hash: actualWorldStateHash,
    derivation_context_hash: derivationContextHash,
  }).slice(0, 24)}`;
  const epoch = {
    version: worldSimulationCausalEpochVersion,
    epoch_id: epochId,
    epoch_index: epochIndex,
    world_state_revision: worldStateRevision,
    world_state_hash: actualWorldStateHash,
    derivation_context_hash: derivationContextHash,
  };
  const audit = {
    version: worldSimulationCausalEpochVersion,
    epoch_id: epochId,
    epoch_index: epochIndex,
    world_state_revision: worldStateRevision,
    world_state_hash_verified: true,
    world_state_snapshot_immutable: true,
    derivation_context_immutable: true,
    derivation_context_hash: derivationContextHash,
    candidates_must_match_epoch_identity: true,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    epoch,
    derivation_context: cloneJson(derivationContext),
    audit,
  };
}

export function bindWorldSimulationCandidatesToCausalEpoch(input = {}) {
  const epoch = normalizedEpoch(input.epoch);
  const candidates = array(input.candidates).map((raw) => ({
    ...cloneJson(object(raw)),
    causal_epoch_id: epoch.epoch_id,
    causal_epoch_index: epoch.epoch_index,
    world_state_revision: epoch.world_state_revision,
    world_state_hash: epoch.world_state_hash,
    derivation_context_hash: epoch.derivation_context_hash,
  }));
  return {
    version: worldSimulationCausalEpochVersion,
    epoch: cloneJson(epoch),
    candidates,
    candidate_count: candidates.length,
    candidate_set_hash: hashAgentRunValue(candidates),
  };
}

export function assertWorldSimulationCausalEpochCandidatesFresh(input = {}) {
  const epoch = normalizedEpoch(input.epoch);
  const candidates = array(input.candidates);
  for (const [index, raw] of candidates.entries()) {
    const candidate = object(raw);
    const staleReasons = [];
    if (String(candidate.causal_epoch_id ?? "") !== epoch.epoch_id) staleReasons.push("causal_epoch_id");
    if (revisionValue(candidate.world_state_revision, -1) !== epoch.world_state_revision) staleReasons.push("world_state_revision");
    if (String(candidate.world_state_hash ?? "") !== epoch.world_state_hash) staleReasons.push("world_state_hash");
    if (String(candidate.derivation_context_hash ?? "") !== epoch.derivation_context_hash) staleReasons.push("derivation_context_hash");
    if (staleReasons.length) {
      const error = new Error(`Causal candidate ${index} is stale for epoch ${epoch.epoch_id}: ${staleReasons.join(", ")}.`);
      error.code = "WORLD_SIMULATION_STALE_CAUSAL_CANDIDATE";
      error.candidate_index = index;
      error.stale_reasons = staleReasons;
      error.expected_epoch = cloneJson(epoch);
      throw error;
    }
  }
  return {
    ok: true,
    version: worldSimulationCausalEpochVersion,
    epoch_id: epoch.epoch_id,
    candidate_count: candidates.length,
    candidate_freshness_verified: true,
    candidate_set_hash: hashAgentRunValue(candidates),
  };
}

export function buildWorldSimulationCausalEpochContract() {
  return {
    version: worldSimulationCausalEpochVersion,
    owner: "deterministic_causal_epoch_freshness_guard",
    epoch_identity: [
      "world_state_revision",
      "world_state_hash",
      "derivation_context_hash",
      "epoch_index",
    ],
    candidate_contract: {
      candidates_are_bound_to_exact_epoch_identity: true,
      stale_candidates_are_rejected: true,
      candidates_may_not_be_reused_after_epoch_change: true,
      unchanged_persisted_revision_can_still_open_new_epoch_when_derivation_context_changes: true,
    },
    fixed_point_contract: {
      each_iteration_opens_fresh_epoch: true,
      suppression_time_override_or_actor_trajectory_change_invalidates_prior_epoch_candidates: true,
      next_iteration_rebuilds_queries_and_rearbitrates: true,
    },
    world_snapshot_contract: {
      supplied_world_state_hash_must_match_snapshot: true,
      persisted_revision_and_hash_are_recorded_on_every_epoch: true,
    },
    character_brain_may_decide_candidate_freshness: false,
    known_boundary: "Phase62U binds fixed-point candidate observations to persisted world revision/hash plus a deterministic derivation-context hash. It rejects stale candidate reuse across causal epochs; subsystem resolution and fixed-point convergence remain programmatic orchestration.",
  };
}
