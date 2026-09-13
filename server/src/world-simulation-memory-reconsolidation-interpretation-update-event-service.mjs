import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection,
  worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion,
} from "./world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";

export const worldSimulationMemoryReconsolidationInterpretationUpdateEventVersion =
  "phase85c-memory-reconsolidation-interpretation-update-event-v1";
export const memoryReconsolidationInterpretationUpdateEventSchemaVersion =
  "phase85c-memory-reconsolidation-interpretation-update-event-schema-v1";
export const memoryReconsolidationInterpretationUpdateHistoryReferenceSchemaVersion =
  "phase85c-memory-reconsolidation-interpretation-update-history-ref-v1";

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function requiredString(value, label, code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}
function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameValue(left, right) { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); }

function assertPhase85BProjectionShape(projection, character, currentTurnId) {
  if (!isObject(projection)
    || projection.version !== worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion
    || projection.phase !== "Phase85B"
    || !sameCharacter(projection.character, character)
    || projection.current_turn_id !== currentTurnId
    || !Array.isArray(projection.restabilization_update_projections)
    || !isObject(projection.audit)
    || projection.audit.update_projection_is_interpretive_overlay_only !== true
    || projection.audit.memory_content_rewritten !== false
    || projection.audit.storage_strength_mutated !== false
    || projection.audit.retrieval_strength_mutated !== false) {
    const error = new Error("Phase85C requires a bounded canonical Phase85B interpretation update projection.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_PHASE85B_INVALID";
    throw error;
  }
  requiredString(projection.projection_set_hash, "phase85b_projection.projection_set_hash");
}

function verifyPhase85B(input, worldState, character, currentTurnId) {
  const supplied = cloneJson(object(input.phase85b_projection));
  assertPhase85BProjectionShape(supplied, character, currentTurnId);
  const body = cloneJson(supplied);
  const storedHash = body.projection_set_hash;
  delete body.projection_set_hash;
  if (hashAgentRunValue(body) !== storedHash) {
    const error = new Error("Phase85B projection failed immutable hash verification.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_PHASE85B_HASH_MISMATCH";
    throw error;
  }
  const rebuilt = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    phase85a_evidence: input.phase85a_evidence,
  });
  if (rebuilt.projection_set_hash !== supplied.projection_set_hash || !sameValue(rebuilt, supplied)) {
    const error = new Error("Phase85B projection is detached from canonical current World State reconstruction.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_PHASE85B_CANONICAL_MISMATCH";
    throw error;
  }
  return supplied;
}

function assertExistingEvent(event, eventId) {
  if (!isObject(event)
    || event.schema_version !== memoryReconsolidationInterpretationUpdateEventSchemaVersion
    || event.interpretation_update_event_id !== eventId
    || !optionalString(event.interpretation_update_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.memory_id)
    || !optionalString(event.source_phase85b_projection_hash)
    || !optionalString(event.source_projection_hash)
    || event.status !== "memory_reconsolidation_interpretation_update_recorded"
    || event.immutable !== true
    || event.original_memory_trace_preserved !== true
    || event.canonical_memory_content_rewritten !== false
    || event.storage_strength_mutated !== false
    || event.retrieval_strength_mutated !== false
    || event.biological_reconsolidation_established !== false) {
    const error = new Error(`Persisted Phase85C event ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_INVALID";
    throw error;
  }
  const body = cloneJson(event);
  delete body.interpretation_update_event_hash;
  if (hashAgentRunValue(body) !== event.interpretation_update_event_hash) {
    const error = new Error(`Persisted Phase85C event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateExistingHistory(worldState) {
  if (Object.hasOwn(worldState, "memory_reconsolidation_interpretation_update_events")
    && !isObject(worldState.memory_reconsolidation_interpretation_update_events)) {
    const error = new Error("memory_reconsolidation_interpretation_update_events must be an object when present.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "memory_reconsolidation_interpretation_update_history")
    && !Array.isArray(worldState.memory_reconsolidation_interpretation_update_history)) {
    const error = new Error("memory_reconsolidation_interpretation_update_history must be an array when present.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.memory_reconsolidation_interpretation_update_events);
  const history = array(worldState.memory_reconsolidation_interpretation_update_history);
  const latestByCharacter = new Map();
  const bySourceProjectionHash = new Map();
  const seen = new Set();
  for (const [index, ref] of history.entries()) {
    const eventId = optionalString(ref?.interpretation_update_event_id);
    if (!isObject(ref)
      || ref.schema_version !== memoryReconsolidationInterpretationUpdateHistoryReferenceSchemaVersion
      || ref.derived_index !== true
      || !eventId
      || !optionalString(ref.interpretation_update_event_hash)
      || !optionalString(ref.character)
      || !optionalString(ref.source_turn_id)
      || !optionalString(ref.memory_id)
      || !optionalString(ref.source_projection_hash)
      || ref.status !== "memory_reconsolidation_interpretation_update_recorded"
      || seen.has(eventId)) {
      const error = new Error(`memory_reconsolidation_interpretation_update_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const event = assertExistingEvent(events[eventId], eventId);
    const key = String(event.character).toLocaleLowerCase("zh-Hant-TW");
    const previous = latestByCharacter.get(key) ?? null;
    if (ref.interpretation_update_event_hash !== event.interpretation_update_event_hash
      || ref.source_projection_hash !== event.source_projection_hash
      || ref.memory_id !== event.memory_id
      || ref.character !== event.character
      || ref.source_turn_id !== event.source_turn_id
      || event.previous_interpretation_update_event_id !== (previous?.interpretation_update_event_id ?? null)
      || event.previous_interpretation_update_event_hash !== (previous?.interpretation_update_event_hash ?? null)) {
      const error = new Error(`Phase85C history reference ${eventId} does not match its immutable chain.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seen.add(eventId);
    latestByCharacter.set(key, event);
    bySourceProjectionHash.set(event.source_projection_hash, event);
  }
  return { events, history, latestByCharacter, bySourceProjectionHash };
}

function eventFor({ character, currentTurnId, phase85b, projection, previous }) {
  const eventId = `memory_reconsolidation_interpretation_update_${hashAgentRunValue({
    version: worldSimulationMemoryReconsolidationInterpretationUpdateEventVersion,
    character,
    source_turn_id: currentTurnId,
    memory_id: projection.memory_id,
    source_phase85b_projection_hash: phase85b.projection_set_hash,
    source_projection_hash: projection.projection_hash,
    previous_interpretation_update_event_hash: previous?.interpretation_update_event_hash ?? null,
  }).slice(0, 24)}`;
  const body = {
    schema_version: memoryReconsolidationInterpretationUpdateEventSchemaVersion,
    interpretation_update_event_id: eventId,
    character,
    source_turn_id: currentTurnId,
    memory_id: projection.memory_id,
    source_phase85b_projection_hash: phase85b.projection_set_hash,
    source_projection_hash: projection.projection_hash,
    source_projection: cloneJson(projection),
    source_retrieval_event_ids: cloneJson(projection.source_retrieval_event_ids),
    conflict_relation_event_ids: cloneJson(projection.conflict_relation_event_ids),
    prior_claim_event_ids: cloneJson(projection.prior_claim_event_ids),
    current_claim_event_ids: cloneJson(projection.current_claim_event_ids),
    newly_relevant_supporting_memory_refs: cloneJson(projection.newly_relevant_supporting_memory_refs),
    previous_interpretation_update_event_id: previous?.interpretation_update_event_id ?? null,
    previous_interpretation_update_event_hash: previous?.interpretation_update_event_hash ?? null,
    interpretation_update_recorded: true,
    original_memory_trace_preserved: true,
    canonical_memory_content_rewritten: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    biological_reconsolidation_established: false,
    future_retrieval_effect_applied: false,
    status: "memory_reconsolidation_interpretation_update_recorded",
    immutable: true,
  };
  return { ...body, interpretation_update_event_hash: hashAgentRunValue(body) };
}

function historyReferenceFor(event) {
  return {
    schema_version: memoryReconsolidationInterpretationUpdateHistoryReferenceSchemaVersion,
    derived_index: true,
    interpretation_update_event_id: event.interpretation_update_event_id,
    interpretation_update_event_hash: event.interpretation_update_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    memory_id: event.memory_id,
    source_projection_hash: event.source_projection_hash,
    previous_interpretation_update_event_id: event.previous_interpretation_update_event_id,
    previous_interpretation_update_event_hash: event.previous_interpretation_update_event_hash,
    status: event.status,
  };
}

export function buildWorldSimulationMemoryReconsolidationInterpretationUpdateEventContract() {
  return deepFreeze({
    version: worldSimulationMemoryReconsolidationInterpretationUpdateEventVersion,
    phase: "Phase85C",
    status: "append_only_reconsolidation_interpretation_update_events_installed",
    source_phase85b_version: worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion,
    canonical_phase85b_reconstruction_required: true,
    immutable_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    original_memory_trace_preserved: true,
    memory_content_rewrite_allowed: false,
    storage_strength_mutation_allowed: false,
    retrieval_strength_mutation_allowed: false,
    biological_reconsolidation_claimed: false,
    future_retrieval_effect_installed: false,
    downstream_retrieval_consumption_requires_separate_phase: true,
  });
}

export function buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const phase85b = verifyPhase85B(input, worldState, character, currentTurnId);
  const existing = validateExistingHistory(worldState);
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const alreadyPersisted = [];
  const appendedReferences = [];
  const transitions = [];

  for (const projection of phase85b.restabilization_update_projections) {
    const sourceProjectionHash = requiredString(projection?.projection_hash, "projection.projection_hash");
    const already = existing.bySourceProjectionHash.get(sourceProjectionHash);
    if (already) {
      alreadyPersisted.push(already.interpretation_update_event_id);
      continue;
    }
    const characterKey = character.toLocaleLowerCase("zh-Hant-TW");
    const previous = latestByCharacter.get(characterKey) ?? null;
    const event = eventFor({ character, currentTurnId, phase85b, projection, previous });
    const collision = object(existing.events[event.interpretation_update_event_id]);
    if (Object.keys(collision).length) {
      assertExistingEvent(collision, event.interpretation_update_event_id);
      if (!sameValue(collision, event)) {
        const error = new Error(`Phase85C event ${event.interpretation_update_event_id} already exists with different immutable content.`);
        error.code = "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersisted.push(event.interpretation_update_event_id);
      latestByCharacter.set(characterKey, collision);
      continue;
    }
    preview.memory_reconsolidation_interpretation_update_events = object(preview.memory_reconsolidation_interpretation_update_events);
    preview.memory_reconsolidation_interpretation_update_events[event.interpretation_update_event_id] = cloneJson(event);
    createdEvents.push(event);
    const reference = historyReferenceFor(event);
    appendedReferences.push(reference);
    latestByCharacter.set(characterKey, event);
    transitions.push({
      entity: "world",
      field: `memory_reconsolidation_interpretation_update_events.${event.interpretation_update_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable Phase85C interpretation update event ${event.interpretation_update_event_id}`,
      source_layer: "memory_reconsolidation_interpretation_update",
    });
  }

  if (appendedReferences.length) {
    const history = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.memory_reconsolidation_interpretation_update_history = history;
    transitions.push({
      entity: "world",
      field: "memory_reconsolidation_interpretation_update_history",
      from: cloneJson(worldState.memory_reconsolidation_interpretation_update_history ?? null),
      to: cloneJson(history),
      cause: `append ${appendedReferences.length} Phase85C interpretation update history reference(s)`,
      source_layer: "memory_reconsolidation_interpretation_update",
    });
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationMemoryReconsolidationInterpretationUpdateEventVersion,
    result: {
      processed_projection_count: phase85b.restabilization_update_projections.length,
      created_event_count: createdEvents.length,
      already_persisted_event_count: alreadyPersisted.length,
      interpretation_update_events_created: createdEvents,
      already_persisted_interpretation_update_event_ids: alreadyPersisted,
      history_references_appended: appendedReferences,
      state_transitions: transitions,
      preview_world_state: preview,
      audit: {
        phase85b_hash_verified: true,
        phase85b_canonical_reconstruction_verified: true,
        immutable_event_write_once_preserved: true,
        append_only_history_preserved: true,
        per_character_previous_event_hash_chain_preserved: true,
        original_memory_trace_preserved: true,
        historical_memory_content_rewritten: false,
        storage_strength_mutated: false,
        retrieval_strength_mutated: false,
        biological_reconsolidation_claimed: false,
        future_retrieval_effect_applied: false,
      },
    },
  });
}
