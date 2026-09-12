import { hashAgentRunValue } from "./agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "./world-simulation-memory-retrieval-persistence-service.mjs";
import { worldSimulationMemoryRetrievalProcessV3Version } from "./world-simulation-memory-retrieval-multistep-service.mjs";
import { probeWorldSimulationRetrievalCompetitionMonitoringEvidence } from "./world-simulation-retrieval-competition-monitoring-evidence-service.mjs";

export const worldSimulationRetrievalInducedForgettingConsequenceVersion =
  "phase83a-retrieval-induced-forgetting-consequence-evidence-v1";

export const retrievalInducedForgettingConsequenceEventSchemaVersion =
  "phase83a-retrieval-induced-forgetting-consequence-event-v1";

export const retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion =
  "phase83a-retrieval-induced-forgetting-consequence-history-ref-v1";

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

function requiredString(value, label, code = "WORLD_SIMULATION_RIF_CONSEQUENCE_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function normalizedRuntimeProcess(raw) {
  const wrapper = object(raw);
  const runtime = isObject(wrapper.result) ? wrapper.result : wrapper;
  if (runtime.version !== worldSimulationMemoryRetrievalProcessV3Version) return null;
  if (runtime.process_occurred !== true || !isObject(runtime.retrieval_process)) return null;
  return runtime;
}

function assertRetrievalEvent(event, expected = {}) {
  if (!isObject(event)
    || event.schema_version !== memoryRetrievalEventSchemaVersion
    || event.immutable !== true) {
    const error = new Error("Phase83A requires one canonical immutable Phase63C RetrievalEvent.");
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_INVALID";
    throw error;
  }
  const eventId = requiredString(event.retrieval_event_id, "RetrievalEvent.retrieval_event_id");
  const storedHash = requiredString(event.retrieval_event_hash, "RetrievalEvent.retrieval_event_hash");
  const hashBody = cloneJson(event);
  delete hashBody.retrieval_event_hash;
  if (hashAgentRunValue(hashBody) !== storedHash) {
    const error = new Error(`RetrievalEvent ${eventId} failed immutable hash verification.`);
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_HASH_MISMATCH";
    throw error;
  }
  if (expected.turn_id && event.turn_id !== expected.turn_id) {
    const error = new Error(`RetrievalEvent ${eventId} is not from the current turn.`);
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_TURN_MISMATCH";
    throw error;
  }
  if (expected.process_id && event.retrieval_process_id !== expected.process_id) {
    const error = new Error(`RetrievalEvent ${eventId} does not match the Phase63C process.`);
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_PROCESS_MISMATCH";
    throw error;
  }
  if (expected.process_hash && event.retrieval_process_hash !== expected.process_hash) {
    const error = new Error(`RetrievalEvent ${eventId} process hash does not match canonical Phase63C.`);
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_PROCESS_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function retrievalEventForProcess(worldState, turnId, process, processHash) {
  const processId = requiredString(process.retrieval_process_id, "retrieval_process.retrieval_process_id");
  const matches = Object.values(object(worldState.retrieval_events))
    .filter((event) => isObject(event)
      && event.turn_id === turnId
      && event.retrieval_process_id === processId);
  if (matches.length !== 1) {
    const error = new Error(
      `Phase83A expected exactly one current-turn RetrievalEvent for process ${processId}; found ${matches.length}.`,
    );
    error.code = "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_CARDINALITY_INVALID";
    throw error;
  }
  return assertRetrievalEvent(matches[0], {
    turn_id: turnId,
    process_id: processId,
    process_hash: processHash,
  });
}

function assertEvidenceBinding(runtime) {
  const process = runtime.retrieval_process;
  const monitor = runtime.initial_retrieval_competition_monitoring_evidence;
  const r4b3 = runtime.initial_associative_activation_composition_evidence;
  if (!isObject(monitor) || !isObject(r4b3)) return null;

  const monitorHash = requiredString(monitor.evidence_hash, "Phase64A-R4C.evidence_hash");
  const r4b3Hash = requiredString(r4b3.evidence_hash, "Phase64A-R4B3.evidence_hash");
  if (monitorHash !== optionalString(process.initial_retrieval_competition_monitoring_evidence_hash)) {
    const error = new Error("Phase83A R4C evidence is detached from the canonical retrieval process.");
    error.code = "WORLD_SIMULATION_RIF_R4C_BINDING_MISMATCH";
    throw error;
  }
  if (r4b3Hash !== optionalString(process.initial_associative_activation_composition_evidence_hash)) {
    const error = new Error("Phase83A R4B3 evidence is detached from the canonical retrieval process.");
    error.code = "WORLD_SIMULATION_RIF_R4B3_BINDING_MISMATCH";
    throw error;
  }
  return { monitor, r4b3, monitorHash, r4b3Hash };
}

function eventBodyFor({ retrievalEvent, runtime, evidence, dominatorMemoryId, competitorMemoryId, report }) {
  const process = runtime.retrieval_process;
  return {
    schema_version: retrievalInducedForgettingConsequenceEventSchemaVersion,
    version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
    phase: "Phase83A",
    character: requiredString(retrievalEvent.character, "RetrievalEvent.character"),
    source_turn_id: retrievalEvent.turn_id ?? null,
    occurred_at: retrievalEvent.occurred_at ?? null,
    source_retrieval_event_id: retrievalEvent.retrieval_event_id,
    source_retrieval_event_hash: retrievalEvent.retrieval_event_hash,
    source_retrieval_process_id: retrievalEvent.retrieval_process_id,
    source_retrieval_process_hash: retrievalEvent.retrieval_process_hash,
    source_r4c_competition_monitor_evidence_hash: evidence.monitorHash,
    source_r4b3_associative_composition_evidence_hash: evidence.r4b3Hash,
    query_id: evidence.monitor.query_id ?? process.query_id ?? null,
    recovered_dominator_memory_ref: dominatorMemoryId,
    suppression_candidate_memory_ref: competitorMemoryId,
    modeled_competition_status: report.competition_status,
    evidence_relation: "recovered_memory_dominated_unrecovered_competitor_on_modeled_dimensions",
    consequence_kind: "future_accessibility_suppression_candidate",
    mechanism_interpretation: "bounded_behavioral_consequence_without_inhibition_mechanism_claim",
    selective_retrieval_verified: true,
    dominator_actually_recovered: true,
    competitor_not_recovered: true,
    same_query_competition_evidence_verified: true,
    active_interference_observed: false,
    suppression_effect_established: false,
    future_accessibility_changed: false,
    storage_strength_changed: false,
    retrieval_strength_changed: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    numeric_inhibition_strength_modeled: false,
    inhibition_mechanism_asserted: false,
    interference_mechanism_asserted: false,
    same_turn_feedback_allowed: false,
    downstream_accessibility_effect_requires_separate_phase: true,
    immutable: true,
  };
}

function historyReferenceFor(event) {
  return {
    schema_version: retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
    consequence_event_id: event.consequence_event_id,
    consequence_event_hash: event.consequence_event_hash,
    character: event.character,
    suppression_candidate_memory_ref: event.suppression_candidate_memory_ref,
    recovered_dominator_memory_ref: event.recovered_dominator_memory_ref,
    source_retrieval_event_id: event.source_retrieval_event_id,
    source_retrieval_event_hash: event.source_retrieval_event_hash,
    role: "retrieval_induced_forgetting_suppression_candidate_registered",
    derived_index: true,
  };
}

function historyIdentity(reference) {
  return JSON.stringify([
    reference?.consequence_event_id ?? null,
    reference?.suppression_candidate_memory_ref ?? null,
  ]);
}

function assertPersistedConsequenceEvent(event, eventId) {
  if (!isObject(event)
    || event.schema_version !== retrievalInducedForgettingConsequenceEventSchemaVersion
    || event.version !== worldSimulationRetrievalInducedForgettingConsequenceVersion
    || event.immutable !== true
    || optionalString(event.consequence_event_id) !== eventId
    || !optionalString(event.consequence_event_hash)) {
    const error = new Error(`Persisted Phase83A consequence event ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_RIF_EVENT_INVALID";
    throw error;
  }
  const body = cloneJson(event);
  delete body.consequence_event_hash;
  if (hashAgentRunValue(body) !== event.consequence_event_hash) {
    const error = new Error(`Persisted Phase83A consequence event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_RIF_EVENT_HASH_MISMATCH";
    throw error;
  }
}

function validateExistingHistory(worldState) {
  if (Object.hasOwn(worldState, "retrieval_induced_forgetting_events")
    && !isObject(worldState.retrieval_induced_forgetting_events)) {
    const error = new Error("retrieval_induced_forgetting_events must be an object when present.");
    error.code = "WORLD_SIMULATION_RIF_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "retrieval_induced_forgetting_history")
    && !Array.isArray(worldState.retrieval_induced_forgetting_history)) {
    const error = new Error("retrieval_induced_forgetting_history must be an array when present.");
    error.code = "WORLD_SIMULATION_RIF_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.retrieval_induced_forgetting_events);
  const seen = new Set();
  for (const [index, ref] of array(worldState.retrieval_induced_forgetting_history).entries()) {
    const identity = historyIdentity(ref);
    if (!isObject(ref)
      || ref.schema_version !== retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion
      || ref.derived_index !== true
      || ref.role !== "retrieval_induced_forgetting_suppression_candidate_registered"
      || !optionalString(ref.consequence_event_id)
      || !optionalString(ref.consequence_event_hash)
      || !optionalString(ref.character)
      || !optionalString(ref.suppression_candidate_memory_ref)
      || !optionalString(ref.recovered_dominator_memory_ref)) {
      const error = new Error(`retrieval_induced_forgetting_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_RIF_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seen.has(identity)) {
      const error = new Error(`retrieval_induced_forgetting_history contains duplicate ${identity}.`);
      error.code = "WORLD_SIMULATION_RIF_HISTORY_DUPLICATE";
      throw error;
    }
    seen.add(identity);
    const event = events[ref.consequence_event_id];
    assertPersistedConsequenceEvent(event, ref.consequence_event_id);
    if (event.consequence_event_hash !== ref.consequence_event_hash
      || event.character !== ref.character
      || event.suppression_candidate_memory_ref !== ref.suppression_candidate_memory_ref
      || event.recovered_dominator_memory_ref !== ref.recovered_dominator_memory_ref) {
      const error = new Error(`retrieval_induced_forgetting_history reference ${identity} is detached from its event.`);
      error.code = "WORLD_SIMULATION_RIF_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
  }
}

export function buildWorldSimulationRetrievalInducedForgettingConsequenceContract() {
  return deepFreeze({
    version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
    phase: "Phase83A",
    status: "bounded_retrieval_induced_forgetting_consequence_evidence_installed",
    source_phase63c_actual_selective_retrieval_required: true,
    source_phase64a_r4c_known_dominated_competitor_required: true,
    dominator_witness_must_be_actually_recovered: true,
    suppression_candidate_competitor_must_be_unrecovered: true,
    same_query_r4b3_r4c_lineage_required: true,
    incomplete_competition_evidence_produces_consequence: false,
    undominated_candidate_produces_consequence: false,
    passive_contact_without_recovery_produces_consequence: false,
    active_interference_observed: false,
    suppression_effect_established: false,
    append_only_consequence_event_persistence: true,
    consequence_is_future_accessibility_suppression_candidate_only: true,
    same_turn_feedback_allowed: false,
    future_accessibility_changed: false,
    storage_strength_changed: false,
    retrieval_strength_changed: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    numeric_inhibition_strength_modeled: false,
    inhibition_mechanism_asserted: false,
    interference_mechanism_asserted: false,
    downstream_accessibility_effect_requires_separate_phase: true,
  });
}

export function buildWorldSimulationRetrievalInducedForgettingConsequences(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  validateExistingHistory(worldState);

  const existingEvents = object(worldState.retrieval_induced_forgetting_events);
  const nextEvents = cloneJson(existingEvents);
  const existingHistory = array(worldState.retrieval_induced_forgetting_history).map(cloneJson);
  const historySeen = new Set(existingHistory.map(historyIdentity));
  const nextHistory = [...existingHistory];
  const createdEvents = [];
  const alreadyPersistedEventIds = [];
  const appendedHistoryReferences = [];

  for (const raw of array(input.memory_retrieval_processes)) {
    const runtime = normalizedRuntimeProcess(raw);
    if (!runtime) continue;
    const process = runtime.retrieval_process;
    const processHash = hashAgentRunValue(cloneJson(process));
    const retrievalEvent = retrievalEventForProcess(worldState, turnId, process, processHash);
    const evidence = assertEvidenceBinding(runtime);
    if (!evidence) continue;

    const recoveredIds = new Set(
      array(retrievalEvent.memory_recoveries)
        .map((recovery) => optionalString(recovery?.source_memory_ref))
        .filter(Boolean),
    );
    if (recoveredIds.size === 0) continue;

    const candidateIds = array(evidence.monitor.candidate_memory_ids)
      .map(optionalString)
      .filter(Boolean);

    for (const competitorMemoryId of candidateIds) {
      if (recoveredIds.has(competitorMemoryId)) continue;
      const report = probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
        evidence.monitor,
        evidence.r4b3,
        competitorMemoryId,
      );
      if (report.competition_status !== "known_dominated_on_modeled_dimensions") continue;
      const dominatorMemoryId = optionalString(report.dominator_witness_memory_id);
      if (!dominatorMemoryId || !recoveredIds.has(dominatorMemoryId)) continue;

      const eventBody = eventBodyFor({
        retrievalEvent,
        runtime,
        evidence,
        dominatorMemoryId,
        competitorMemoryId,
        report,
      });
      const seed = {
        version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
        source_retrieval_event_id: retrievalEvent.retrieval_event_id,
        source_retrieval_event_hash: retrievalEvent.retrieval_event_hash,
        recovered_dominator_memory_ref: dominatorMemoryId,
        suppression_candidate_memory_ref: competitorMemoryId,
        source_r4c_competition_monitor_evidence_hash: evidence.monitorHash,
      };
      const consequenceEventId = `retrieval_induced_forgetting_event_${hashAgentRunValue(seed).slice(0, 24)}`;
      const eventWithoutHash = {
        consequence_event_id: consequenceEventId,
        ...eventBody,
      };
      const consequenceEvent = {
        ...eventWithoutHash,
        consequence_event_hash: hashAgentRunValue(eventWithoutHash),
      };

      const existing = existingEvents[consequenceEventId];
      if (isObject(existing)) {
        assertPersistedConsequenceEvent(existing, consequenceEventId);
        if (!sameValue(existing, consequenceEvent)) {
          const error = new Error(`Phase83A consequence event ${consequenceEventId} already exists with different immutable content.`);
          error.code = "WORLD_SIMULATION_RIF_EVENT_IMMUTABILITY_VIOLATION";
          throw error;
        }
        alreadyPersistedEventIds.push(consequenceEventId);
      } else if (!isObject(nextEvents[consequenceEventId])) {
        nextEvents[consequenceEventId] = cloneJson(consequenceEvent);
        createdEvents.push(cloneJson(consequenceEvent));
      }

      const reference = historyReferenceFor(consequenceEvent);
      const identity = historyIdentity(reference);
      if (!historySeen.has(identity)) {
        historySeen.add(identity);
        nextHistory.push(cloneJson(reference));
        appendedHistoryReferences.push(cloneJson(reference));
      }
    }
  }

  const preview = cloneJson(worldState);
  const stateTransitions = [];
  if (!sameValue(existingEvents, nextEvents)) {
    preview.retrieval_induced_forgetting_events = cloneJson(nextEvents);
    stateTransitions.push({
      entity: "world",
      field: "retrieval_induced_forgetting_events",
      from: cloneJson(existingEvents),
      to: cloneJson(nextEvents),
      cause: "persist immutable Phase83A retrieval-induced-forgetting consequence evidence",
      source_layer: "memory_retrieval_competition_consequence",
    });
  }
  if (!sameValue(existingHistory, nextHistory)) {
    preview.retrieval_induced_forgetting_history = cloneJson(nextHistory);
    stateTransitions.push({
      entity: "world",
      field: "retrieval_induced_forgetting_history",
      from: cloneJson(existingHistory),
      to: cloneJson(nextHistory),
      cause: "append Phase83A retrieval-induced-forgetting consequence history",
      source_layer: "memory_retrieval_competition_consequence",
    });
  }

  return deepFreeze({
    version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
    phase: "Phase83A",
    result: {
      consequence_events_created: createdEvents,
      already_persisted_consequence_event_ids: alreadyPersistedEventIds,
      appended_history_references: appendedHistoryReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      audit: {
        source_phase63c_actual_retrieval_verified: true,
        source_phase64a_r4b3_r4c_binding_verified: true,
        consequence_event_count: createdEvents.length,
        history_reference_append_count: appendedHistoryReferences.length,
        same_turn_feedback_used: false,
        active_interference_observed: false,
        suppression_effect_established: false,
        future_accessibility_changed: false,
        storage_strength_changed: false,
        retrieval_strength_changed: false,
        memory_content_rewritten: false,
        memory_deleted: false,
        numeric_inhibition_strength_modeled: false,
        inhibition_mechanism_asserted: false,
        interference_mechanism_asserted: false,
        downstream_accessibility_effect_requires_separate_phase: true,
      },
    },
  });
}
