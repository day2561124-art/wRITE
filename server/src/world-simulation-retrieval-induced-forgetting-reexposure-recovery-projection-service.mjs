import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "./world-simulation-retrieval-induced-forgetting-consequence-service.mjs";
import {
  worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
} from "./world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";

export const worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion =
  "phase83c-retrieval-induced-forgetting-reexposure-recovery-projection-v1";

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

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value, label, code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function timestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function memoryIdFor(record, index, label = "memory_records") {
  if (!isObject(record)) {
    const error = new Error(`${label}[${index}] must be an object.`);
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_MEMORY_INVALID";
    throw error;
  }
  return requiredString(
    record.memory_id ?? record.id,
    `${label}[${index}].memory_id`,
    "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_MEMORY_ID_REQUIRED",
  );
}

function validateMemorySnapshot(records, label = "memory_records") {
  const seen = new Set();
  return array(records).map((record, index) => {
    const memoryId = memoryIdFor(record, index, label);
    if (seen.has(memoryId)) {
      const error = new Error(`Duplicate memory_id in ${label}: ${memoryId}.`);
      error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_MEMORY_DUPLICATE";
      throw error;
    }
    seen.add(memoryId);
    return {
      memory_id: memoryId,
      original_index: index,
      record: cloneJson(record),
    };
  });
}

function verifyPhase83BProjection(projection, snapshot) {
  if (!isObject(projection)
    || projection.version !== worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion) {
    const error = new Error("Phase83C requires the current Phase83B accessibility projection.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_INVALID";
    throw error;
  }

  const projectionId = requiredString(
    projection.projection_id,
    "phase83b_projection.projection_id",
    "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_ID_REQUIRED",
  );
  const projectionBody = {
    version: projection.version,
    character: projection.character,
    current_turn_id: projection.current_turn_id,
    as_of: cloneJson(projection.as_of),
    input_memory_ids: cloneJson(projection.input_memory_ids),
    projected_memory_ids: cloneJson(projection.projected_memory_ids),
    suppression_evidence: cloneJson(projection.suppression_evidence),
    consequence_evidence: cloneJson(projection.consequence_evidence),
  };
  const expectedId = `rif_accessibility_projection_${hashAgentRunValue(projectionBody).slice(0, 24)}`;
  if (projectionId !== expectedId) {
    const error = new Error("Phase83B projection identity failed verification.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_ID_MISMATCH";
    throw error;
  }

  const inputIds = snapshot.map((entry) => entry.memory_id);
  if (JSON.stringify(array(projection.input_memory_ids)) !== JSON.stringify(inputIds)) {
    const error = new Error("Phase83B input memory identity/order does not match Phase83C input snapshot.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_INPUT_MISMATCH";
    throw error;
  }

  const projectedSnapshot = validateMemorySnapshot(
    projection.projected_memory_records,
    "phase83b_projection.projected_memory_records",
  );
  const projectedIds = projectedSnapshot.map((entry) => entry.memory_id);
  if (JSON.stringify(array(projection.projected_memory_ids)) !== JSON.stringify(projectedIds)) {
    const error = new Error("Phase83B projected memory records are detached from projected_memory_ids.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_RECORD_MISMATCH";
    throw error;
  }
  if (projectedIds.length !== inputIds.length
    || projectedIds.some((memoryId) => !inputIds.includes(memoryId))) {
    const error = new Error("Phase83B projection changed memory candidate membership.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_MEMBERSHIP_MISMATCH";
    throw error;
  }

  return projection;
}

function verifyConsequenceEvent(worldState, eventId, character, memoryId) {
  const event = object(object(worldState.retrieval_induced_forgetting_events)[eventId]);
  if (event.schema_version !== retrievalInducedForgettingConsequenceEventSchemaVersion
    || event.version !== worldSimulationRetrievalInducedForgettingConsequenceVersion
    || event.phase !== "Phase83A"
    || event.consequence_kind !== "future_accessibility_suppression_candidate"
    || event.immutable !== true
    || event.consequence_event_id !== eventId
    || event.character !== character
    || event.suppression_candidate_memory_ref !== memoryId) {
    const error = new Error(`Phase83A consequence event ${eventId} is invalid for Phase83C.`);
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_EVENT_INVALID";
    throw error;
  }
  const storedHash = requiredString(
    event.consequence_event_hash,
    `Phase83A ${eventId}.consequence_event_hash`,
    "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_HASH_REQUIRED",
  );
  const body = cloneJson(event);
  delete body.consequence_event_hash;
  if (hashAgentRunValue(body) !== storedHash) {
    const error = new Error(`Phase83A consequence event ${eventId} failed immutable hash verification.`);
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_HASH_MISMATCH";
    throw error;
  }
  const occurredAtMs = timestampMs(event.occurred_at);
  if (occurredAtMs === null) {
    const error = new Error(`Phase83A consequence event ${eventId} has no usable occurred_at.`);
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_TIME_REQUIRED";
    throw error;
  }
  return { event, occurred_at_ms: occurredAtMs };
}

function exactObservationHash(record) {
  return optionalString(object(record?.internal_provenance).observation_hash);
}

function encodedAtMs(record) {
  return timestampMs(record?.encoded_at);
}

function sourceSense(record) {
  return optionalString(object(record?.source).sense)
    ?? optionalString(object(record?.retrieval_cues).sense);
}

function exactPostConsequenceReencodingEvidence({
  snapshot,
  candidate,
  latestConsequenceMs,
  asOfMs,
  currentTurnId,
}) {
  const candidateHash = exactObservationHash(candidate.record);
  if (!candidateHash) return [];
  const candidateSense = sourceSense(candidate.record);

  return snapshot
    .filter((entry) => entry.memory_id !== candidate.memory_id)
    .map((entry) => {
      const entryHash = exactObservationHash(entry.record);
      if (!entryHash || entryHash !== candidateHash) return null;
      const entrySense = sourceSense(entry.record);
      if (candidateSense && entrySense && candidateSense !== entrySense) return null;
      const entryEncodedAtMs = encodedAtMs(entry.record);
      if (entryEncodedAtMs === null
        || entryEncodedAtMs <= latestConsequenceMs
        || entryEncodedAtMs > asOfMs) {
        return null;
      }
      const sourceTurnId = optionalString(object(entry.record.internal_provenance).turn_id);
      if (sourceTurnId && sourceTurnId === currentTurnId) return null;
      return {
        reencoded_memory_id: entry.memory_id,
        observation_hash: entryHash,
        encoded_at: cloneJson(entry.record.encoded_at),
        source_turn_id: sourceTurnId,
        exact_observation_hash_match: true,
        distinct_memory_identity: true,
        post_latest_applicable_consequence: true,
        committed_prior_turn_only: sourceTurnId !== currentTurnId,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftMs = timestampMs(left.encoded_at) ?? 0;
      const rightMs = timestampMs(right.encoded_at) ?? 0;
      if (leftMs !== rightMs) return leftMs - rightMs;
      return left.reencoded_memory_id.localeCompare(right.reencoded_memory_id);
    });
}

export function buildWorldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionContract() {
  return deepFreeze({
    version: worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
    phase: "Phase83C",
    status: "bounded_exact_post_consequence_reencoding_recovery_projection_installed",
    source_phase83b_projection_required: true,
    source_phase83a_consequence_revalidated: true,
    exact_post_consequence_observation_reencoding_required: true,
    distinct_reencoded_memory_identity_required: true,
    reencoding_must_follow_latest_applicable_suppression_consequence: true,
    current_turn_reencoding_recovery_allowed: false,
    fixed_time_expiry_allowed: false,
    duration_threshold_modeled: false,
    recovery_changes_ephemeral_memory_search_order_only: true,
    stable_relative_order_within_still_suppressed_and_available_groups: true,
    candidate_membership_changed: false,
    persistent_memory_order_mutated: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    numeric_relearning_strength_modeled: false,
    complete_psychological_relearning_asserted: false,
    inhibition_mechanism_asserted: false,
    interference_mechanism_asserted: false,
    retrieval_success_forced: false,
  });
}

export function projectWorldSimulationRetrievalInducedForgettingReexposureRecovery(input = {}) {
  const worldState = object(input.world_state);
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(
    input.current_turn_id ?? input.turn_id,
    "current_turn_id",
  );
  const asOf = input.as_of ?? input.simulation_time ?? worldState.simulation_time ?? null;
  const asOfMs = timestampMs(asOf);
  if (asOfMs === null) {
    const error = new Error("Phase83C requires current simulation time.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_TIME_REQUIRED";
    throw error;
  }

  const snapshot = validateMemorySnapshot(input.memory_records);
  const phase83b = verifyPhase83BProjection(input.phase83b_projection, snapshot);
  if (phase83b.character !== character || phase83b.current_turn_id !== currentTurnId) {
    const error = new Error("Phase83B projection character/turn identity does not match Phase83C input.");
    error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_PHASE83B_CONTEXT_MISMATCH";
    throw error;
  }

  const snapshotById = new Map(snapshot.map((entry) => [entry.memory_id, entry]));
  const stillSuppressed = new Set();
  const recovered = new Set();
  const recoveryEvidence = [];

  for (const suppression of array(phase83b.suppression_evidence)) {
    if (!isObject(suppression) || suppression.suppression_applied !== true) continue;
    const memoryId = requiredString(
      suppression.memory_id,
      "phase83b_projection.suppression_evidence[].memory_id",
    );
    const candidate = snapshotById.get(memoryId);
    if (!candidate) {
      const error = new Error(`Phase83B suppressed memory ${memoryId} is outside Phase83C input snapshot.`);
      error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_SUPPRESSED_MEMORY_MISSING";
      throw error;
    }
    const consequenceIds = array(suppression.applicable_consequence_event_ids)
      .map((value) => requiredString(value, "applicable_consequence_event_ids[]"));
    if (!consequenceIds.length) {
      const error = new Error(`Phase83B suppressed memory ${memoryId} has no applicable consequence lineage.`);
      error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_LINEAGE_REQUIRED";
      throw error;
    }

    const consequences = consequenceIds.map((eventId) => (
      verifyConsequenceEvent(worldState, eventId, character, memoryId)
    ));
    const latestConsequenceMs = Math.max(...consequences.map((item) => item.occurred_at_ms));
    if (latestConsequenceMs > asOfMs) {
      const error = new Error(`Phase83A consequence for ${memoryId} occurs after Phase83C projection time.`);
      error.code = "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_FUTURE_CONSEQUENCE";
      throw error;
    }

    const reencodingEvidence = exactPostConsequenceReencodingEvidence({
      snapshot,
      candidate,
      latestConsequenceMs,
      asOfMs,
      currentTurnId,
    });

    if (reencodingEvidence.length) {
      recovered.add(memoryId);
      recoveryEvidence.push({
        memory_id: memoryId,
        status: "exact_post_consequence_reencoding_recovered",
        recovery_applied: true,
        applicable_consequence_event_ids: consequenceIds,
        latest_applicable_consequence_at:
          consequences
            .slice()
            .sort((left, right) => right.occurred_at_ms - left.occurred_at_ms)[0]
            .event.occurred_at,
        recovery_evidence: reencodingEvidence,
      });
    } else {
      stillSuppressed.add(memoryId);
      recoveryEvidence.push({
        memory_id: memoryId,
        status: exactObservationHash(candidate.record)
          ? "no_qualifying_post_consequence_reencoding"
          : "candidate_lacks_exact_observation_hash_evidence",
        recovery_applied: false,
        applicable_consequence_event_ids: consequenceIds,
        recovery_evidence: [],
      });
    }
  }

  const available = snapshot.filter((entry) => !stillSuppressed.has(entry.memory_id));
  const suppressed = snapshot.filter((entry) => stillSuppressed.has(entry.memory_id));
  const projected = [...available, ...suppressed];
  const projectedMemoryIds = projected.map((entry) => entry.memory_id);
  const projectedMemoryRecords = projected.map((entry) => cloneJson(entry.record));
  const projectedIndexById = new Map(projectedMemoryIds.map((memoryId, index) => [memoryId, index]));

  const projectionBody = {
    version: worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    as_of: cloneJson(asOf),
    source_phase83b_projection_id: phase83b.projection_id,
    input_memory_ids: snapshot.map((entry) => entry.memory_id),
    phase83b_projected_memory_ids: cloneJson(phase83b.projected_memory_ids),
    projected_memory_ids: projectedMemoryIds,
    recovery_evidence: recoveryEvidence,
    ordering_evidence: snapshot.map((entry) => ({
      memory_id: entry.memory_id,
      original_index: entry.original_index,
      phase83b_projected_index: array(phase83b.projected_memory_ids).indexOf(entry.memory_id),
      projected_index: projectedIndexById.get(entry.memory_id),
      recovered_from_phase83b_suppression: recovered.has(entry.memory_id),
      suppression_remains_applied: stillSuppressed.has(entry.memory_id),
    })),
  };

  return deepFreeze({
    ...projectionBody,
    projection_id: `rif_reexposure_recovery_projection_${hashAgentRunValue(projectionBody).slice(0, 24)}`,
    projected_memory_records: projectedMemoryRecords,
    audit: {
      recovery_applied: recovered.size > 0,
      recovered_memory_count: recovered.size,
      still_suppressed_memory_count: stillSuppressed.size,
      phase83b_suppressed_memory_count:
        array(phase83b.suppression_evidence)
          .filter((entry) => entry?.suppression_applied === true).length,
      exact_post_consequence_observation_reencoding_required: true,
      current_turn_reencoding_recovery_used: false,
      fixed_time_expiry_used: false,
      duration_threshold_used: false,
      candidate_membership_preserved:
        snapshot.length === projected.length
        && snapshot.every((entry) => projectedMemoryIds.includes(entry.memory_id)),
      stable_available_relative_order: true,
      stable_still_suppressed_relative_order: true,
      source_world_state_mutated: false,
      persistent_memory_order_mutated: false,
      memory_content_rewritten: false,
      memory_deleted: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      numeric_relearning_strength_modeled: false,
      complete_psychological_relearning_asserted: false,
      inhibition_mechanism_asserted: false,
      interference_mechanism_asserted: false,
      retrieval_success_forced: false,
    },
  });
}
