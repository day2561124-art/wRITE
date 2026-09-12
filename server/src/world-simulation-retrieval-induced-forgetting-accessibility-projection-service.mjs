import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "./world-simulation-retrieval-induced-forgetting-consequence-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "./world-simulation-memory-retrieval-persistence-service.mjs";
import {
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "./world-simulation-retrieval-practice-activation-projection-service.mjs";

export const worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion =
  "phase83b-retrieval-induced-forgetting-accessibility-projection-v1";

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

function requiredString(value, label, code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_PROJECTION_INVALID") {
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

function memoryIdFor(record, index) {
  if (!isObject(record)) {
    const error = new Error(`memory_records[${index}] must be an object.`);
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_MEMORY_INVALID";
    throw error;
  }
  return requiredString(
    record.memory_id ?? record.id,
    `memory_records[${index}].memory_id`,
    "WORLD_SIMULATION_RIF_ACCESSIBILITY_MEMORY_ID_REQUIRED",
  );
}

function cueIdentity(cue) {
  if (!isObject(cue) || !optionalString(cue.kind)) return null;
  if (!["string", "number", "boolean"].includes(typeof cue.value)) return null;
  return JSON.stringify([cue.kind, cue.value]);
}

function currentCueIdentitySet(cues) {
  return new Set(
    array(cues)
      .map(cueIdentity)
      .filter(Boolean),
  );
}

function sourceCueIdentitySet(retrievalEvent) {
  const orientation = object(retrievalEvent.search_orientation);
  const refs = [
    ...array(object(orientation.trigger).grounded_cue_refs),
    ...array(object(orientation.orientation).grounded_cue_refs),
  ];
  return new Set(
    refs
      .map((ref) => cueIdentity(ref?.canonical_cue))
      .filter(Boolean),
  );
}

function verifyHashedImmutableEvent(event, hashField, idField, expectedId, codePrefix) {
  if (!isObject(event) || event.immutable !== true || optionalString(event[idField]) !== expectedId) {
    const error = new Error(`${codePrefix} event ${expectedId} is invalid.`);
    error.code = `WORLD_SIMULATION_RIF_ACCESSIBILITY_${codePrefix}_INVALID`;
    throw error;
  }
  const storedHash = requiredString(
    event[hashField],
    `${codePrefix}.${hashField}`,
    `WORLD_SIMULATION_RIF_ACCESSIBILITY_${codePrefix}_HASH_REQUIRED`,
  );
  const body = cloneJson(event);
  delete body[hashField];
  if (hashAgentRunValue(body) !== storedHash) {
    const error = new Error(`${codePrefix} event ${expectedId} failed immutable hash verification.`);
    error.code = `WORLD_SIMULATION_RIF_ACCESSIBILITY_${codePrefix}_HASH_MISMATCH`;
    throw error;
  }
  return event;
}

function validateConsequenceEvent(event, reference) {
  const eventId = requiredString(
    reference.consequence_event_id,
    "retrieval_induced_forgetting_history[].consequence_event_id",
  );
  verifyHashedImmutableEvent(
    event,
    "consequence_event_hash",
    "consequence_event_id",
    eventId,
    "CONSEQUENCE_EVENT",
  );
  if (event.schema_version !== retrievalInducedForgettingConsequenceEventSchemaVersion
    || event.version !== worldSimulationRetrievalInducedForgettingConsequenceVersion
    || event.phase !== "Phase83A"
    || event.consequence_kind !== "future_accessibility_suppression_candidate") {
    const error = new Error(`Phase83A consequence event ${eventId} has unsupported semantics.`);
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_CONSEQUENCE_EVENT_INVALID";
    throw error;
  }
  if (event.consequence_event_hash !== reference.consequence_event_hash
    || event.character !== reference.character
    || event.suppression_candidate_memory_ref !== reference.suppression_candidate_memory_ref
    || event.recovered_dominator_memory_ref !== reference.recovered_dominator_memory_ref
    || event.source_retrieval_event_id !== reference.source_retrieval_event_id
    || event.source_retrieval_event_hash !== reference.source_retrieval_event_hash) {
    const error = new Error(`Phase83A consequence history reference ${eventId} is detached from its event.`);
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_CONSEQUENCE_REFERENCE_MISMATCH";
    throw error;
  }
  return event;
}

function validateSourceRetrievalEvent(worldState, consequenceEvent) {
  const eventId = requiredString(
    consequenceEvent.source_retrieval_event_id,
    "Phase83A.source_retrieval_event_id",
  );
  const event = object(object(worldState.retrieval_events)[eventId]);
  verifyHashedImmutableEvent(
    event,
    "retrieval_event_hash",
    "retrieval_event_id",
    eventId,
    "SOURCE_RETRIEVAL_EVENT",
  );
  if (event.schema_version !== memoryRetrievalEventSchemaVersion
    || event.retrieval_event_hash !== consequenceEvent.source_retrieval_event_hash
    || event.turn_id !== consequenceEvent.source_turn_id
    || event.occurred_at !== consequenceEvent.occurred_at
    || event.character !== consequenceEvent.character) {
    const error = new Error(`Phase83A consequence ${consequenceEvent.consequence_event_id} is detached from its Phase63C RetrievalEvent.`);
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_SOURCE_RETRIEVAL_EVENT_MISMATCH";
    throw error;
  }
  return event;
}

function practiceEvidenceByMemory(projection) {
  if (!isObject(projection)
    || projection.version !== worldSimulationRetrievalPracticeActivationProjectionVersion) {
    const error = new Error("Phase83B requires the current Phase64A retrieval-practice activation projection.");
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_PRACTICE_PROJECTION_INVALID";
    throw error;
  }
  return new Map(
    array(projection.activation_evidence)
      .map((entry) => [optionalString(entry?.memory_id), entry])
      .filter(([memoryId]) => Boolean(memoryId)),
  );
}

function laterSuccessfulPractice(consequenceEvent, practiceEvidence) {
  const consequenceMs = timestampMs(consequenceEvent.occurred_at);
  if (consequenceMs === null) return null;
  for (const trace of array(practiceEvidence?.practice_traces)) {
    const traceMs = timestampMs(trace?.occurred_at);
    if (traceMs === null || traceMs <= consequenceMs) continue;
    if (optionalString(trace?.source_turn_id) === optionalString(consequenceEvent.source_turn_id)) continue;
    return cloneJson(trace);
  }
  return null;
}

function contextOverlap(sourceRetrievalEvent, currentCueIdentities) {
  const sourceCueIdentities = sourceCueIdentitySet(sourceRetrievalEvent);
  const matchedCueIdentities = [...sourceCueIdentities]
    .filter((identity) => currentCueIdentities.has(identity))
    .sort();
  return {
    source_cue_count: sourceCueIdentities.size,
    current_cue_count: currentCueIdentities.size,
    matched_cue_identities: matchedCueIdentities,
    exact_context_cue_overlap: matchedCueIdentities.length > 0,
  };
}

function validateMemorySnapshot(records) {
  const seen = new Set();
  return array(records).map((record, index) => {
    const memoryId = memoryIdFor(record, index);
    if (seen.has(memoryId)) {
      const error = new Error(`Duplicate memory_id in Phase83B projection snapshot: ${memoryId}.`);
      error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_MEMORY_DUPLICATE";
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

export function buildWorldSimulationRetrievalInducedForgettingAccessibilityProjectionContract() {
  return deepFreeze({
    version: worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
    phase: "Phase83B",
    status: "bounded_delayed_retrieval_induced_accessibility_suppression_projection_installed",
    source_phase83a_prior_turn_consequence_required: true,
    source_phase63c_retrieval_event_revalidated: true,
    exact_current_cue_overlap_required: true,
    cue_free_global_suppression_allowed: false,
    later_successful_retrieval_practice_shields_candidate: true,
    same_turn_effect_allowed: false,
    projection_occurs_before_authoritative_phase63b_candidate_freeze: true,
    projection_changes_ephemeral_memory_search_order_only: true,
    stable_relative_order_within_suppressed_and_unsuppressed_groups: true,
    candidate_membership_changed: false,
    persistent_memory_order_mutated: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    numeric_inhibition_strength_modeled: false,
    inhibition_mechanism_asserted: false,
    interference_mechanism_asserted: false,
    suppression_is_permanent_forgetting_claim: false,
    retrieval_success_forced: false,
    same_turn_feedback_allowed: false,
  });
}

export function projectWorldSimulationRetrievalInducedForgettingAccessibility(input = {}) {
  const worldState = object(input.world_state);
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(
    input.current_turn_id ?? input.turn_id,
    "current_turn_id",
  );
  const asOf = input.as_of ?? input.simulation_time ?? worldState.simulation_time ?? null;
  const asOfMs = timestampMs(asOf);
  if (asOfMs === null) {
    const error = new Error("Phase83B requires current simulation time for bounded delayed projection.");
    error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_TIME_REQUIRED";
    throw error;
  }

  const snapshot = validateMemorySnapshot(input.memory_records);
  const memoryIds = new Set(snapshot.map((entry) => entry.memory_id));
  const currentCueIdentities = currentCueIdentitySet(input.current_active_cues);
  const practiceByMemory = practiceEvidenceByMemory(input.retrieval_practice_activation_projection);
  const consequenceEvents = object(worldState.retrieval_induced_forgetting_events);
  const history = array(worldState.retrieval_induced_forgetting_history);
  const applicableByMemory = new Map();
  const evidence = [];
  const seenHistoryIdentities = new Set();

  for (let index = 0; index < history.length; index += 1) {
    const reference = history[index];
    if (!isObject(reference)
      || reference.schema_version !== retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion
      || reference.role !== "retrieval_induced_forgetting_suppression_candidate_registered"
      || reference.derived_index !== true) {
      const error = new Error(`retrieval_induced_forgetting_history[${index}] is invalid for Phase83B.`);
      error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const identity = JSON.stringify([
      reference.consequence_event_id ?? null,
      reference.suppression_candidate_memory_ref ?? null,
    ]);
    if (seenHistoryIdentities.has(identity)) {
      const error = new Error(`Duplicate Phase83A consequence history reference: ${identity}.`);
      error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_HISTORY_DUPLICATE";
      throw error;
    }
    seenHistoryIdentities.add(identity);

    const consequenceEvent = validateConsequenceEvent(
      object(consequenceEvents[reference.consequence_event_id]),
      reference,
    );
    if (consequenceEvent.character !== character) continue;

    const memoryId = requiredString(
      consequenceEvent.suppression_candidate_memory_ref,
      "Phase83A.suppression_candidate_memory_ref",
    );
    if (!memoryIds.has(memoryId)) {
      evidence.push({
        consequence_event_id: consequenceEvent.consequence_event_id,
        memory_id: memoryId,
        status: "candidate_outside_current_memory_snapshot",
        suppression_applied: false,
      });
      continue;
    }

    const sourceRetrievalEvent = validateSourceRetrievalEvent(worldState, consequenceEvent);
    const consequenceMs = timestampMs(consequenceEvent.occurred_at);
    if (consequenceEvent.source_turn_id === currentTurnId) {
      evidence.push({
        consequence_event_id: consequenceEvent.consequence_event_id,
        memory_id: memoryId,
        status: "same_source_turn_excluded",
        suppression_applied: false,
      });
      continue;
    }
    if (consequenceMs === null) {
      evidence.push({
        consequence_event_id: consequenceEvent.consequence_event_id,
        memory_id: memoryId,
        status: "source_time_unavailable",
        suppression_applied: false,
      });
      continue;
    }
    if (consequenceMs > asOfMs) {
      const error = new Error(`Phase83A consequence ${consequenceEvent.consequence_event_id} occurs after the Phase83B projection time.`);
      error.code = "WORLD_SIMULATION_RIF_ACCESSIBILITY_FUTURE_CONSEQUENCE";
      throw error;
    }

    const overlap = contextOverlap(sourceRetrievalEvent, currentCueIdentities);
    if (!overlap.exact_context_cue_overlap) {
      evidence.push({
        consequence_event_id: consequenceEvent.consequence_event_id,
        memory_id: memoryId,
        status: "current_context_not_cue_overlapping",
        suppression_applied: false,
        ...overlap,
      });
      continue;
    }

    const laterPractice = laterSuccessfulPractice(
      consequenceEvent,
      practiceByMemory.get(memoryId),
    );
    if (laterPractice) {
      evidence.push({
        consequence_event_id: consequenceEvent.consequence_event_id,
        memory_id: memoryId,
        status: "later_successful_retrieval_practice_shielded",
        suppression_applied: false,
        ...overlap,
        shielding_practice: laterPractice,
      });
      continue;
    }

    const applicable = {
      consequence_event_id: consequenceEvent.consequence_event_id,
      consequence_event_hash: consequenceEvent.consequence_event_hash,
      source_turn_id: consequenceEvent.source_turn_id,
      source_retrieval_event_id: consequenceEvent.source_retrieval_event_id,
      memory_id: memoryId,
      status: "bounded_delayed_suppression_applied",
      suppression_applied: true,
      ...overlap,
    };
    evidence.push(applicable);
    if (!applicableByMemory.has(memoryId)) applicableByMemory.set(memoryId, []);
    applicableByMemory.get(memoryId).push(applicable);
  }

  const unsuppressed = snapshot.filter((entry) => !applicableByMemory.has(entry.memory_id));
  const suppressed = snapshot.filter((entry) => applicableByMemory.has(entry.memory_id));
  const projected = [...unsuppressed, ...suppressed];
  const projectedMemoryIds = projected.map((entry) => entry.memory_id);
  const projectedMemoryRecords = projected.map((entry) => cloneJson(entry.record));
  const projectedIndexById = new Map(projectedMemoryIds.map((memoryId, index) => [memoryId, index]));
  const suppressionEvidence = snapshot.map((entry) => ({
    memory_id: entry.memory_id,
    original_index: entry.original_index,
    projected_index: projectedIndexById.get(entry.memory_id),
    projected_rank: projectedIndexById.get(entry.memory_id) + 1,
    suppression_applied: applicableByMemory.has(entry.memory_id),
    applicable_consequence_event_ids: array(applicableByMemory.get(entry.memory_id))
      .map((item) => item.consequence_event_id),
  }));

  const projectionBody = {
    version: worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    as_of: cloneJson(asOf),
    input_memory_ids: snapshot.map((entry) => entry.memory_id),
    projected_memory_ids: projectedMemoryIds,
    suppression_evidence: suppressionEvidence,
    consequence_evidence: evidence,
  };

  return deepFreeze({
    ...projectionBody,
    projection_id: `rif_accessibility_projection_${hashAgentRunValue(projectionBody).slice(0, 24)}`,
    projected_memory_records: projectedMemoryRecords,
    audit: {
      projection_applied: suppressed.length > 0,
      input_memory_count: snapshot.length,
      projected_memory_count: projected.length,
      suppressed_memory_count: suppressed.length,
      current_active_cue_count: currentCueIdentities.size,
      consequence_history_reference_count: history.length,
      source_phase83a_prior_turn_only: true,
      source_phase63c_retrieval_event_revalidated: true,
      exact_current_cue_overlap_required: true,
      later_successful_retrieval_practice_shield_enabled: true,
      candidate_membership_preserved:
        snapshot.length === projected.length
        && snapshot.every((entry) => projectedMemoryIds.includes(entry.memory_id)),
      stable_unsuppressed_relative_order: true,
      stable_suppressed_relative_order: true,
      source_world_state_mutated: false,
      persistent_memory_order_mutated: false,
      memory_content_rewritten: false,
      memory_deleted: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      numeric_inhibition_strength_modeled: false,
      inhibition_mechanism_asserted: false,
      interference_mechanism_asserted: false,
      retrieval_success_forced: false,
      same_turn_feedback_used: false,
    },
  });
}
