import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildWorldSimulationMemoryCueLinks } from "./world-simulation-memory-accessibility-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "./world-simulation-memory-retrieval-persistence-service.mjs";

export const worldSimulationRetrievalContextRevivalCandidateEvidenceVersion =
  "phase84a-retrieval-context-revival-candidate-evidence-v1";

const revivalContextCueKinds = new Set([
  "spatial_context",
  "subjective_episode",
  "temporal",
  "task",
]);

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

function requiredString(value, label, code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_INVALID") {
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

function validateMemorySnapshot(records) {
  const seen = new Set();
  return array(records).map((record, index) => {
    if (!isObject(record)) {
      const error = new Error(`memory_records[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_MEMORY_INVALID";
      throw error;
    }
    const memoryId = requiredString(
      record.memory_id ?? record.id,
      `memory_records[${index}].memory_id`,
      "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_MEMORY_ID_REQUIRED",
    );
    if (seen.has(memoryId)) {
      const error = new Error(`Duplicate memory_id: ${memoryId}.`);
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_MEMORY_DUPLICATE";
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

function cueIdentity(cue) {
  return JSON.stringify([cue.kind, cue.value]);
}

function contextualCueLinks(record) {
  return buildWorldSimulationMemoryCueLinks(record)
    .filter((cue) => revivalContextCueKinds.has(optionalString(cue?.kind)))
    .map((cue) => ({
      kind: cue.kind,
      value: cloneJson(cue.value),
      source: cue.source ?? null,
      cue_identity: cueIdentity(cue),
    }));
}

function sharedContextCues(leftRecord, rightRecord) {
  const left = contextualCueLinks(leftRecord);
  const rightByIdentity = new Map(
    contextualCueLinks(rightRecord).map((cue) => [cue.cue_identity, cue]),
  );
  const seen = new Set();
  const shared = [];
  for (const cue of left) {
    if (seen.has(cue.cue_identity) || !rightByIdentity.has(cue.cue_identity)) continue;
    seen.add(cue.cue_identity);
    const other = rightByIdentity.get(cue.cue_identity);
    shared.push({
      kind: cue.kind,
      value: cloneJson(cue.value),
      recovered_memory_cue_source: cue.source ?? null,
      candidate_memory_cue_source: other.source ?? null,
      exact_match: true,
    });
  }
  return shared.sort((a, b) => JSON.stringify([a.kind, a.value]).localeCompare(JSON.stringify([b.kind, b.value])));
}

function verifyRetrievalEvent(event, expectedCharacter) {
  if (!isObject(event)
    || event.schema_version !== memoryRetrievalEventSchemaVersion
    || event.immutable !== true) {
    const error = new Error("Phase84A requires canonical immutable Phase63C RetrievalEvents.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_INVALID";
    throw error;
  }
  const eventId = requiredString(
    event.retrieval_event_id,
    "RetrievalEvent.retrieval_event_id",
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_ID_REQUIRED",
  );
  const storedHash = requiredString(
    event.retrieval_event_hash,
    "RetrievalEvent.retrieval_event_hash",
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_HASH_REQUIRED",
  );
  const body = cloneJson(event);
  delete body.retrieval_event_hash;
  if (hashAgentRunValue(body) !== storedHash) {
    const error = new Error(`RetrievalEvent ${eventId} failed immutable hash verification.`);
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_HASH_MISMATCH";
    throw error;
  }
  if (event.character !== expectedCharacter) {
    const error = new Error(`RetrievalEvent ${eventId} character mismatch.`);
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_CHARACTER_MISMATCH";
    throw error;
  }
  const turnId = requiredString(
    event.turn_id,
    `RetrievalEvent ${eventId}.turn_id`,
    "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_TURN_REQUIRED",
  );
  const occurredAtMs = timestampMs(event.occurred_at);
  if (occurredAtMs === null) {
    const error = new Error(`RetrievalEvent ${eventId} has no usable occurred_at.`);
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_TIME_REQUIRED";
    throw error;
  }
  return {
    event,
    event_id: eventId,
    turn_id: turnId,
    occurred_at_ms: occurredAtMs,
    successful_retrieval: event.recovered_any_content === true,
  };
}

function encodedAtMs(record) {
  return timestampMs(record?.encoded_at ?? record?.remembered_at);
}

export function buildWorldSimulationRetrievalContextRevivalCandidateEvidenceContract() {
  return deepFreeze({
    version: worldSimulationRetrievalContextRevivalCandidateEvidenceVersion,
    phase: "Phase84A",
    status: "bounded_explicit_context_revival_candidate_evidence_installed",
    canonical_prior_turn_successful_retrieval_required: true,
    exact_shared_explicit_context_cue_required: true,
    contextual_cue_kinds: [...revivalContextCueKinds],
    candidate_must_preexist_source_retrieval: true,
    source_recovered_memory_must_preexist_source_retrieval: true,
    candidate_recovered_in_same_event_is_revival_candidate: false,
    same_turn_retrieval_feedback_allowed: false,
    hidden_context_vector_modeled: false,
    universal_context_drift_assumed: false,
    generic_context_switch_cancels_rif: false,
    fixed_delay_threshold_modeled: false,
    accessibility_reordering_performed: false,
    candidate_membership_changed: false,
    persistent_memory_order_mutated: false,
    memory_content_rewritten: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    causal_context_reinstatement_mechanism_asserted: false,
    downstream_accessibility_effect_requires_separate_phase: true,
  });
}

export function buildWorldSimulationRetrievalContextRevivalCandidateEvidence(input = {}) {
  const worldState = object(input.world_state);
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id ?? input.turn_id, "current_turn_id");
  const asOf = input.as_of ?? input.simulation_time ?? worldState.simulation_time ?? null;
  const asOfMs = timestampMs(asOf);
  if (asOfMs === null) {
    const error = new Error("Phase84A requires current simulation time.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_TIME_REQUIRED";
    throw error;
  }

  const snapshot = validateMemorySnapshot(input.memory_records);
  const snapshotById = new Map(snapshot.map((entry) => [entry.memory_id, entry]));
  const evidenceByCandidate = new Map();
  const qualifyingEventIds = [];

  const rawEvents = Object.values(object(worldState.retrieval_events))
    .filter((event) => isObject(event) && event.character === character)
    .sort((left, right) => {
      const leftMs = timestampMs(left.occurred_at) ?? Number.POSITIVE_INFINITY;
      const rightMs = timestampMs(right.occurred_at) ?? Number.POSITIVE_INFINITY;
      if (leftMs !== rightMs) return leftMs - rightMs;
      return String(left.retrieval_event_id ?? "").localeCompare(String(right.retrieval_event_id ?? ""));
    });

  for (const rawEvent of rawEvents) {
    const rawOccurredAtMs = timestampMs(rawEvent.occurred_at);
    if (rawOccurredAtMs === null || rawOccurredAtMs > asOfMs) continue;

    const verified = verifyRetrievalEvent(rawEvent, character);
    if (verified.turn_id === currentTurnId || !verified.successful_retrieval) continue;
    const recoveredIds = new Set(
      array(verified.event.memory_recoveries)
        .map((recovery) => optionalString(recovery?.source_memory_ref))
        .filter(Boolean),
    );
    if (!recoveredIds.size) continue;

    let eventProducedEvidence = false;
    for (const recoveredMemoryId of [...recoveredIds].sort()) {
      const recovered = snapshotById.get(recoveredMemoryId);
      if (!recovered) continue;
      const recoveredEncodedMs = encodedAtMs(recovered.record);
      if (recoveredEncodedMs === null || recoveredEncodedMs > verified.occurred_at_ms) continue;

      for (const candidate of snapshot) {
        if (candidate.memory_id === recoveredMemoryId || recoveredIds.has(candidate.memory_id)) continue;
        const candidateEncodedMs = encodedAtMs(candidate.record);
        if (candidateEncodedMs === null || candidateEncodedMs > verified.occurred_at_ms) continue;

        const shared = sharedContextCues(recovered.record, candidate.record);
        if (!shared.length) continue;

        if (!evidenceByCandidate.has(candidate.memory_id)) evidenceByCandidate.set(candidate.memory_id, []);
        evidenceByCandidate.get(candidate.memory_id).push({
          source_retrieval_event_id: verified.event_id,
          source_retrieval_event_hash: verified.event.retrieval_event_hash,
          source_turn_id: verified.event.turn_id ?? null,
          source_retrieval_occurred_at: cloneJson(verified.event.occurred_at),
          recovered_source_memory_id: recoveredMemoryId,
          shared_context_cues: shared,
          exact_shared_explicit_context_cue: true,
          prior_turn_successful_retrieval: true,
          candidate_not_recovered_by_source_event: true,
          candidate_preexisted_source_retrieval: candidateEncodedMs === null || candidateEncodedMs <= verified.occurred_at_ms,
        });
        eventProducedEvidence = true;
      }
    }
    if (eventProducedEvidence) qualifyingEventIds.push(verified.event_id);
  }

  const revivalCandidates = [...evidenceByCandidate.entries()]
    .map(([memoryId, evidence]) => ({
      memory_id: memoryId,
      evidence: evidence.sort((left, right) => {
        const leftMs = timestampMs(left.source_retrieval_occurred_at) ?? 0;
        const rightMs = timestampMs(right.source_retrieval_occurred_at) ?? 0;
        if (leftMs !== rightMs) return leftMs - rightMs;
        if (left.source_retrieval_event_id !== right.source_retrieval_event_id) {
          return left.source_retrieval_event_id.localeCompare(right.source_retrieval_event_id);
        }
        return left.recovered_source_memory_id.localeCompare(right.recovered_source_memory_id);
      }),
    }))
    .sort((left, right) => {
      const leftIndex = snapshotById.get(left.memory_id)?.original_index ?? Number.POSITIVE_INFINITY;
      const rightIndex = snapshotById.get(right.memory_id)?.original_index ?? Number.POSITIVE_INFINITY;
      return leftIndex - rightIndex || left.memory_id.localeCompare(right.memory_id);
    });

  const evidenceBody = {
    version: worldSimulationRetrievalContextRevivalCandidateEvidenceVersion,
    phase: "Phase84A",
    character,
    current_turn_id: currentTurnId,
    as_of: cloneJson(asOf),
    input_memory_ids: snapshot.map((entry) => entry.memory_id),
    source_retrieval_event_ids: [...new Set(qualifyingEventIds)],
    revival_candidates: revivalCandidates,
  };

  return deepFreeze({
    ...evidenceBody,
    evidence_id: `retrieval_context_revival_evidence_${hashAgentRunValue(evidenceBody).slice(0, 24)}`,
    audit: {
      revival_candidate_count: revivalCandidates.length,
      qualifying_source_retrieval_event_count: evidenceBody.source_retrieval_event_ids.length,
      same_turn_retrieval_feedback_used: false,
      exact_shared_explicit_context_cue_required: true,
      hidden_context_vector_used: false,
      universal_context_drift_used: false,
      generic_context_switch_rif_release_asserted: false,
      fixed_delay_threshold_used: false,
      accessibility_reordering_performed: false,
      candidate_membership_preserved: true,
      persistent_memory_order_mutated: false,
      source_world_state_mutated: false,
      memory_content_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      causal_context_reinstatement_mechanism_asserted: false,
      downstream_accessibility_effect_requires_separate_phase: true,
    },
  });
}
