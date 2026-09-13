import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
} from "./world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";
import {
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "./world-simulation-retrieval-induced-forgetting-consequence-service.mjs";
import {
  worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
} from "./world-simulation-retrieval-induced-forgetting-reexposure-recovery-projection-service.mjs";
import {
  buildWorldSimulationRetrievalContextRevivalCandidateEvidence,
  worldSimulationRetrievalContextRevivalCandidateEvidenceVersion,
} from "./world-simulation-retrieval-context-revival-candidate-evidence-service.mjs";

export const worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion =
  "phase84b-retrieval-context-revival-accessibility-projection-v1";

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

function requiredString(value, label, code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_INVALID") {
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

function validateMemorySnapshot(records, label = "memory_records") {
  const seen = new Set();
  return array(records).map((record, index) => {
    if (!isObject(record)) {
      const error = new Error(`${label}[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_MEMORY_INVALID";
      throw error;
    }
    const memoryId = requiredString(
      record.memory_id ?? record.id,
      `${label}[${index}].memory_id`,
      "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_MEMORY_ID_REQUIRED",
    );
    if (seen.has(memoryId)) {
      const error = new Error(`Duplicate memory_id in ${label}: ${memoryId}.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_MEMORY_DUPLICATE";
      throw error;
    }
    seen.add(memoryId);
    return { memory_id: memoryId, original_index: index, record: cloneJson(record) };
  });
}

function verifyPhase83BProjection(projection, snapshot) {
  if (!isObject(projection)
    || projection.version !== worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion) {
    const error = new Error("Phase84B requires the current Phase83B accessibility projection.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_INVALID";
    throw error;
  }
  const projectionId = requiredString(
    projection.projection_id,
    "phase83b_projection.projection_id",
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_ID_REQUIRED",
  );
  const body = {
    version: projection.version,
    character: projection.character,
    current_turn_id: projection.current_turn_id,
    as_of: cloneJson(projection.as_of),
    input_memory_ids: cloneJson(projection.input_memory_ids),
    projected_memory_ids: cloneJson(projection.projected_memory_ids),
    suppression_evidence: cloneJson(projection.suppression_evidence),
    consequence_evidence: cloneJson(projection.consequence_evidence),
  };
  const expectedId = `rif_accessibility_projection_${hashAgentRunValue(body).slice(0, 24)}`;
  if (projectionId !== expectedId) {
    const error = new Error("Phase83B projection identity failed verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_ID_MISMATCH";
    throw error;
  }
  const inputIds = snapshot.map((entry) => entry.memory_id);
  if (JSON.stringify(array(projection.input_memory_ids)) !== JSON.stringify(inputIds)) {
    const error = new Error("Phase83B input memory identity/order does not match Phase84B input snapshot.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_INPUT_MISMATCH";
    throw error;
  }
  const projected = validateMemorySnapshot(
    projection.projected_memory_records,
    "phase83b_projection.projected_memory_records",
  );
  const projectedIds = projected.map((entry) => entry.memory_id);
  if (JSON.stringify(array(projection.projected_memory_ids)) !== JSON.stringify(projectedIds)
    || projectedIds.length !== inputIds.length
    || projectedIds.some((memoryId) => !inputIds.includes(memoryId))) {
    const error = new Error("Phase83B projection records/membership failed verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_MEMBERSHIP_MISMATCH";
    throw error;
  }
  return projection;
}

function verifyPhase83CProjection(projection, snapshot, phase83b) {
  if (!isObject(projection)
    || projection.version !== worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion) {
    const error = new Error("Phase84B requires the current Phase83C recovery projection.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83C_INVALID";
    throw error;
  }
  const projectionId = requiredString(
    projection.projection_id,
    "phase83c_projection.projection_id",
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83C_ID_REQUIRED",
  );
  const body = {
    version: projection.version,
    character: projection.character,
    current_turn_id: projection.current_turn_id,
    as_of: cloneJson(projection.as_of),
    source_phase83b_projection_id: projection.source_phase83b_projection_id,
    input_memory_ids: cloneJson(projection.input_memory_ids),
    phase83b_projected_memory_ids: cloneJson(projection.phase83b_projected_memory_ids),
    projected_memory_ids: cloneJson(projection.projected_memory_ids),
    recovery_evidence: cloneJson(projection.recovery_evidence),
    ordering_evidence: cloneJson(projection.ordering_evidence),
  };
  const expectedId = `rif_reexposure_recovery_projection_${hashAgentRunValue(body).slice(0, 24)}`;
  if (projectionId !== expectedId) {
    const error = new Error("Phase83C projection identity failed verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83C_ID_MISMATCH";
    throw error;
  }
  const inputIds = snapshot.map((entry) => entry.memory_id);
  const projected = validateMemorySnapshot(
    projection.projected_memory_records,
    "phase83c_projection.projected_memory_records",
  );
  const projectedIds = projected.map((entry) => entry.memory_id);
  if (projection.source_phase83b_projection_id !== phase83b.projection_id
    || JSON.stringify(array(projection.input_memory_ids)) !== JSON.stringify(inputIds)
    || JSON.stringify(array(projection.phase83b_projected_memory_ids)) !== JSON.stringify(array(phase83b.projected_memory_ids))
    || JSON.stringify(array(projection.projected_memory_ids)) !== JSON.stringify(projectedIds)
    || projectedIds.length !== inputIds.length
    || projectedIds.some((memoryId) => !inputIds.includes(memoryId))) {
    const error = new Error("Phase83C projection lineage/membership failed verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83C_LINEAGE_MISMATCH";
    throw error;
  }
  return projection;
}

function verifyPhase84AEvidence(evidence, snapshot, { worldState, character, currentTurnId, asOf }) {
  if (!isObject(evidence)
    || evidence.version !== worldSimulationRetrievalContextRevivalCandidateEvidenceVersion
    || evidence.phase !== "Phase84A") {
    const error = new Error("Phase84B requires the current Phase84A revival candidate evidence.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_INVALID";
    throw error;
  }
  const evidenceId = requiredString(
    evidence.evidence_id,
    "phase84a_evidence.evidence_id",
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_ID_REQUIRED",
  );
  const body = {
    version: evidence.version,
    phase: evidence.phase,
    character: evidence.character,
    current_turn_id: evidence.current_turn_id,
    as_of: cloneJson(evidence.as_of),
    input_memory_ids: cloneJson(evidence.input_memory_ids),
    source_retrieval_event_ids: cloneJson(evidence.source_retrieval_event_ids),
    revival_candidates: cloneJson(evidence.revival_candidates),
  };
  const expectedId = `retrieval_context_revival_evidence_${hashAgentRunValue(body).slice(0, 24)}`;
  if (evidenceId !== expectedId) {
    const error = new Error("Phase84A evidence identity failed verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_ID_MISMATCH";
    throw error;
  }
  const inputIds = snapshot.map((entry) => entry.memory_id);
  if (JSON.stringify(array(evidence.input_memory_ids)) !== JSON.stringify(inputIds)) {
    const error = new Error("Phase84A input memory identity/order does not match Phase84B input snapshot.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_INPUT_MISMATCH";
    throw error;
  }
  const canonical = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: snapshot.map((entry) => entry.record),
  });
  if (canonical.evidence_id !== evidenceId
    || JSON.stringify(canonical.revival_candidates) !== JSON.stringify(evidence.revival_candidates)
    || JSON.stringify(canonical.source_retrieval_event_ids) !== JSON.stringify(evidence.source_retrieval_event_ids)) {
    const error = new Error("Phase84A evidence is detached from canonical current World State reconstruction.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_CANONICAL_MISMATCH";
    throw error;
  }
  return evidence;
}

function latestApplicableConsequence(worldState, phase83b, character, memoryId) {
  const consequenceIds = new Set(
    array(phase83b.suppression_evidence)
      .filter((entry) => entry?.suppression_applied === true && entry?.memory_id === memoryId)
      .flatMap((entry) => array(entry.applicable_consequence_event_ids))
      .map((value) => requiredString(value, "applicable_consequence_event_ids[]")),
  );
  if (!consequenceIds.size) {
    const error = new Error(`Phase83B suppressed memory ${memoryId} has no applicable consequence lineage.`);
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONSEQUENCE_LINEAGE_REQUIRED";
    throw error;
  }
  const verified = [...consequenceIds].map((eventId) => {
    const event = object(object(worldState.retrieval_induced_forgetting_events)[eventId]);
    if (event.schema_version !== retrievalInducedForgettingConsequenceEventSchemaVersion
      || event.version !== worldSimulationRetrievalInducedForgettingConsequenceVersion
      || event.consequence_event_id !== eventId
      || event.character !== character
      || event.suppression_candidate_memory_ref !== memoryId
      || event.phase !== "Phase83A"
      || event.consequence_kind !== "future_accessibility_suppression_candidate"
      || event.immutable !== true) {
      const error = new Error(`Phase83A consequence event ${eventId} is invalid for Phase84B timing lineage.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONSEQUENCE_INVALID";
      throw error;
    }
    const storedHash = requiredString(
      event.consequence_event_hash,
      `Phase83A ${eventId}.consequence_event_hash`,
      "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONSEQUENCE_HASH_REQUIRED",
    );
    const body = cloneJson(event);
    delete body.consequence_event_hash;
    if (hashAgentRunValue(body) !== storedHash) {
      const error = new Error(`Phase83A consequence event ${eventId} failed immutable hash verification.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONSEQUENCE_HASH_MISMATCH";
      throw error;
    }
    const occurredAtMs = timestampMs(event.occurred_at);
    if (occurredAtMs === null) {
      const error = new Error(`Phase83A consequence event ${eventId} has no usable occurred_at.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONSEQUENCE_TIME_REQUIRED";
      throw error;
    }
    return { event_id: eventId, occurred_at: cloneJson(event.occurred_at), occurred_at_ms: occurredAtMs };
  });
  verified.sort((left, right) => left.occurred_at_ms - right.occurred_at_ms || left.event_id.localeCompare(right.event_id));
  return {
    consequence_ids: [...consequenceIds],
    latest_ms: verified.at(-1).occurred_at_ms,
    latest_at: verified.at(-1).occurred_at,
  };
}

function qualifyingRevivalEvidence(phase84a, memoryId, latestConsequenceMs, asOfMs) {
  const candidate = array(phase84a.revival_candidates)
    .find((entry) => entry?.memory_id === memoryId);
  if (!candidate) return [];
  return array(candidate.evidence)
    .filter((entry) => {
      if (!isObject(entry)
        || entry.exact_shared_explicit_context_cue !== true
        || entry.prior_turn_successful_retrieval !== true
        || entry.candidate_not_recovered_by_source_event !== true
        || entry.candidate_preexisted_source_retrieval !== true) return false;
      const occurredAtMs = timestampMs(entry.source_retrieval_occurred_at);
      if (occurredAtMs === null || occurredAtMs > asOfMs) return false;
      if (latestConsequenceMs !== null && occurredAtMs <= latestConsequenceMs) return false;
      return array(entry.shared_context_cues).length > 0;
    })
    .map(cloneJson)
    .sort((left, right) => {
      const leftMs = timestampMs(left.source_retrieval_occurred_at) ?? 0;
      const rightMs = timestampMs(right.source_retrieval_occurred_at) ?? 0;
      if (leftMs !== rightMs) return leftMs - rightMs;
      return String(left.source_retrieval_event_id).localeCompare(String(right.source_retrieval_event_id));
    });
}

export function buildWorldSimulationRetrievalContextRevivalAccessibilityProjectionContract() {
  return deepFreeze({
    version: worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
    phase: "Phase84B",
    status: "bounded_explicit_context_revival_accessibility_recovery_projection_installed",
    source_phase83b_projection_required: true,
    source_phase83c_recovery_projection_required: true,
    prior_phase83c_recovery_may_not_be_reversed: true,
    source_phase84a_evidence_required: true,
    exact_shared_explicit_context_cue_required: true,
    revival_retrieval_must_follow_applicable_suppression_consequence: true,
    generic_context_switch_release_allowed: false,
    same_turn_retrieval_feedback_allowed: false,
    hidden_context_vector_modeled: false,
    accessibility_recovery_changes_ephemeral_memory_search_order_only: true,
    stable_relative_order_within_available_and_still_suppressed_groups: true,
    candidate_membership_changed: false,
    persistent_memory_order_mutated: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    numeric_revival_strength_modeled: false,
    rif_cancellation_asserted: false,
    causal_context_reinstatement_mechanism_asserted: false,
    retrieval_success_forced: false,
  });
}

export function projectWorldSimulationRetrievalContextRevivalAccessibility(input = {}) {
  const worldState = object(input.world_state);
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id ?? input.turn_id, "current_turn_id");
  const asOf = input.as_of ?? input.simulation_time ?? worldState.simulation_time ?? null;
  const asOfMs = timestampMs(asOf);
  if (asOfMs === null) {
    const error = new Error("Phase84B requires current simulation time.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_TIME_REQUIRED";
    throw error;
  }

  const snapshot = validateMemorySnapshot(input.memory_records);
  const phase83b = verifyPhase83BProjection(input.phase83b_projection, snapshot);
  const phase83c = verifyPhase83CProjection(input.phase83c_projection, snapshot, phase83b);
  const phase84a = verifyPhase84AEvidence(input.phase84a_evidence, snapshot, {
    worldState,
    character,
    currentTurnId,
    asOf,
  });
  if (phase83b.character !== character || phase83b.current_turn_id !== currentTurnId
    || phase83c.character !== character || phase83c.current_turn_id !== currentTurnId
    || phase84a.character !== character || phase84a.current_turn_id !== currentTurnId
    || JSON.stringify(phase83b.as_of) !== JSON.stringify(asOf)
    || JSON.stringify(phase83c.as_of) !== JSON.stringify(asOf)
    || JSON.stringify(phase84a.as_of) !== JSON.stringify(asOf)) {
    const error = new Error("Phase83B/Phase83C/Phase84A character, turn, or projection time does not match Phase84B input.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONTEXT_MISMATCH";
    throw error;
  }

  const suppressedIds = new Set(
    array(phase83b.suppression_evidence)
      .filter((entry) => entry?.suppression_applied === true)
      .map((entry) => requiredString(entry.memory_id, "phase83b suppression memory_id")),
  );
  const phase83cRecovered = new Set(
    array(phase83c.recovery_evidence)
      .filter((entry) => entry?.recovery_applied === true)
      .map((entry) => requiredString(entry.memory_id, "phase83c recovery memory_id")),
  );
  const recovered = new Set();
  const stillSuppressed = new Set();
  const recoveryEvidence = [];

  for (const memoryId of suppressedIds) {
    const consequence = latestApplicableConsequence(worldState, phase83b, character, memoryId);
    if (phase83cRecovered.has(memoryId)) {
      recoveryEvidence.push({
        memory_id: memoryId,
        status: "prior_phase83c_recovery_preserved",
        recovery_applied: false,
        prior_phase83c_recovery_preserved: true,
        applicable_consequence_event_ids: consequence.consequence_ids,
        revival_evidence: [],
      });
      continue;
    }
    const evidence = qualifyingRevivalEvidence(phase84a, memoryId, consequence.latest_ms, asOfMs);
    if (evidence.length) {
      recovered.add(memoryId);
      recoveryEvidence.push({
        memory_id: memoryId,
        status: "bounded_explicit_context_revival_recovered",
        recovery_applied: true,
        prior_phase83c_recovery_preserved: false,
        applicable_consequence_event_ids: consequence.consequence_ids,
        revival_evidence: evidence,
      });
    } else {
      stillSuppressed.add(memoryId);
      recoveryEvidence.push({
        memory_id: memoryId,
        status: "no_qualifying_post_suppression_context_revival_evidence",
        recovery_applied: false,
        prior_phase83c_recovery_preserved: false,
        applicable_consequence_event_ids: consequence.consequence_ids,
        revival_evidence: [],
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
    version: worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    as_of: cloneJson(asOf),
    source_phase83b_projection_id: phase83b.projection_id,
    source_phase83c_projection_id: phase83c.projection_id,
    source_phase84a_evidence_id: phase84a.evidence_id,
    input_memory_ids: snapshot.map((entry) => entry.memory_id),
    phase83b_projected_memory_ids: cloneJson(phase83b.projected_memory_ids),
    phase83c_projected_memory_ids: cloneJson(phase83c.projected_memory_ids),
    projected_memory_ids: projectedMemoryIds,
    recovery_evidence: recoveryEvidence,
    ordering_evidence: snapshot.map((entry) => ({
      memory_id: entry.memory_id,
      original_index: entry.original_index,
      phase83b_projected_index: array(phase83b.projected_memory_ids).indexOf(entry.memory_id),
      phase83c_projected_index: array(phase83c.projected_memory_ids).indexOf(entry.memory_id),
      projected_index: projectedIndexById.get(entry.memory_id),
      recovered_by_phase83c: phase83cRecovered.has(entry.memory_id),
      recovered_by_phase84b: recovered.has(entry.memory_id),
      recovered_from_phase83b_suppression:
        phase83cRecovered.has(entry.memory_id) || recovered.has(entry.memory_id),
      suppression_remains_applied: stillSuppressed.has(entry.memory_id),
    })),
  };

  return deepFreeze({
    ...projectionBody,
    projection_id: `retrieval_context_revival_accessibility_projection_${hashAgentRunValue(projectionBody).slice(0, 24)}`,
    projected_memory_records: projectedMemoryRecords,
    audit: {
      recovery_applied: recovered.size > 0,
      recovered_memory_count: recovered.size,
      prior_phase83c_recovered_memory_count: phase83cRecovered.size,
      prior_phase83c_recovery_reversed: false,
      total_recovered_from_phase83b_suppression_count:
        new Set([...phase83cRecovered, ...recovered]).size,
      still_suppressed_memory_count: stillSuppressed.size,
      exact_shared_explicit_context_cue_required: true,
      post_suppression_retrieval_required: true,
      generic_context_switch_release_used: false,
      same_turn_retrieval_feedback_used: false,
      hidden_context_vector_used: false,
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
      numeric_revival_strength_modeled: false,
      rif_cancellation_asserted: false,
      causal_context_reinstatement_mechanism_asserted: false,
      retrieval_success_forced: false,
    },
  });
}
