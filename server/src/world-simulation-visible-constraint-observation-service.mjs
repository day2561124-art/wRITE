import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  meansFeasibilityEventSchemaVersion,
  meansFeasibilityHistoryReferenceSchemaVersion,
  worldSimulationMeansFeasibilityVersion,
} from "./world-simulation-means-feasibility-service.mjs";

export const worldSimulationVisibleConstraintObservationVersion =
  "phase73a-visible-constraint-observation-v1";
export const visibleConstraintObservationEventSchemaVersion =
  "phase73a-visible-constraint-observation-event-v1";
export const visibleConstraintObservationHistoryReferenceSchemaVersion =
  "phase73a-visible-constraint-observation-history-ref-v1";
export const visibleConstraintObservationCharacterProjectionVersion =
  "phase73a-visible-constraint-observation-character-projection-v1";

const maximumVisibleObservationsPerTurn = 32;
const supportedEvidenceKinds = new Set([
  "selected_action_intent",
  "action_outcome",
  "causal_state_transition",
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
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function boundedString(
  value,
  label,
  maxLength = 240,
  code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = code;
    throw error;
  }
  return text;
}
function nonNegativeSafeInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    const error = new Error(`${label} must be a non-negative safe integer.`);
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_REVISION_INVALID";
    throw error;
  }
  return numeric;
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}
function hashWithout(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function meansFeasibilityEventHash(event) {
  return hashWithout(event, "means_feasibility_event_hash");
}
function observationEventHash(event) {
  return hashWithout(event, "observation_event_hash");
}
function evidenceCharacter(value) {
  const evidence = object(value);
  return optionalString(
    evidence.character
    ?? evidence.actor
    ?? evidence.character_name
    ?? null,
  );
}

const characterFacingPrivateKeys = new Set([
  "world_state",
  "world_state_patch",
  "mutation",
  "mutation_path",
  "memory_store",
  "hidden_retrieval_graph",
  "gpt_hidden_reasoning",
  "internal_chain_of_thought",
  "means_status",
  "physical_executability",
  "authorization_status",
  "constraint_status",
  "constraint_checks",
  "character_visible_evidence_refs",
  "authoritative_evidence_catalog_hash",
  "resolver_view_hash",
  "context_hash",
]);
function sanitizeCharacterFacingEvidence(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, 64)
      .map((item) => sanitizeCharacterFacingEvidence(item, depth + 1));
  }
  if (!isObject(value)) {
    if (typeof value === "string") return value.slice(0, 1200);
    if (typeof value === "number" || typeof value === "boolean" || value == null) {
      return value;
    }
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value).slice(0, 96)) {
    const normalized = String(key).toLowerCase();
    if (characterFacingPrivateKeys.has(normalized)
        || normalized === "id"
        || normalized.endsWith("_id")
        || normalized.endsWith("_ids")
        || normalized.startsWith("engine_")
        || normalized.startsWith("internal_")) {
      continue;
    }
    clean[key] = sanitizeCharacterFacingEvidence(child, depth + 1);
  }
  return clean;
}
function characterFacingObservation(evidenceEntry) {
  return deepFreeze({
    modality: "constraint_related",
    evidence_kind: evidenceEntry.evidence_kind,
    perceived_evidence: sanitizeCharacterFacingEvidence(evidenceEntry.evidence),
    source: "character_visible_world_evidence",
    world_truth_authority: false,
    subjective_interpretation_required: true,
    actual_means_feasibility_verdict_exposed: false,
  });
}

function validatePhase72Context(context, turnId) {
  const phase72 = object(context);
  if (!Object.keys(phase72).length) {
    const error = new Error(
      "Phase73A requires the exact bounded Phase72 authoritative validation context.",
    );
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_PHASE72_CONTEXT_REQUIRED";
    throw error;
  }
  const body = cloneJson(phase72);
  const contextHash = optionalString(body.context_hash);
  delete body.context_hash;
  if (phase72.version !== worldSimulationMeansFeasibilityVersion
      || phase72.turn_id !== turnId
      || phase72.bounded_current_turn_engine_evidence_catalog !== true
      || phase72.character_visible_evidence_is_explicit_subset_only !== true
      || phase72.raw_world_state_exposed !== false
      || !contextHash
      || hashAgentRunValue(body) !== contextHash
      || !Array.isArray(phase72.authoritative_evidence)) {
    const error = new Error(
      "Phase73A received an invalid or stale Phase72 authoritative validation context.",
    );
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_PHASE72_CONTEXT_INVALID";
    throw error;
  }
  const evidenceByRef = new Map();
  for (const entry of phase72.authoritative_evidence) {
    const evidenceRef = optionalString(entry?.evidence_ref);
    const evidenceHash = optionalString(entry?.evidence_hash);
    const evidenceIndex = Number(entry?.evidence_index);
    const evidenceKind = optionalString(entry?.evidence_kind);
    if (!isObject(entry)
        || !supportedEvidenceKinds.has(evidenceKind)
        || !Number.isInteger(evidenceIndex)
        || evidenceIndex < 0
        || evidenceIndex > 63
        || !evidenceRef
        || !evidenceHash
        || evidenceByRef.has(evidenceRef)
        || hashAgentRunValue(entry.evidence) !== evidenceHash
        || evidenceCharacter(entry.evidence) !== (entry.evidence_character ?? null)) {
      const error = new Error(
        "Phase73A Phase72 evidence catalog contains an invalid entry.",
      );
      error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_PHASE72_CONTEXT_INVALID";
      throw error;
    }
    const expectedRef = `phase72_evidence_${hashAgentRunValue({
      version: worldSimulationMeansFeasibilityVersion,
      turn_id: turnId,
      kind: evidenceKind,
      index: evidenceIndex,
      evidence_hash: evidenceHash,
    }).slice(0, 24)}`;
    if (expectedRef !== evidenceRef) {
      const error = new Error(
        `Phase73A evidence ref ${evidenceRef} is not canonical Phase72 evidence.`,
      );
      error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_PHASE72_CONTEXT_INVALID";
      throw error;
    }
    evidenceByRef.set(evidenceRef, entry);
  }
  return { phase72, evidenceByRef };
}

function validatePhase72Event(worldState, rawEvent, turnId, phase72Context, evidenceByRef) {
  const event = object(rawEvent);
  if (!Object.keys(event).length
      || event.schema_version !== meansFeasibilityEventSchemaVersion
      || event.version !== worldSimulationMeansFeasibilityVersion
      || event.immutable !== true
      || event.operation !== "verify_means_feasibility"
      || event.status !== "goal_implementation_intention_means_feasibility_recorded"
      || event.source_turn_id !== turnId
      || !optionalString(event.means_feasibility_event_id)
      || !optionalString(event.means_feasibility_event_hash)
      || meansFeasibilityEventHash(event) !== event.means_feasibility_event_hash
      || !optionalString(event.character)
      || !Array.isArray(event.character_visible_evidence_refs)
      || event.character_visible_evidence_subset_only !== true
      || event.world_truth_is_not_character_knowledge !== true
      || event.character_knowledge_updated !== false
      || event.character_brain_direct_write !== false
      || hashAgentRunValue(phase72Context.authoritative_evidence)
        !== event.authoritative_evidence_catalog_hash) {
    const error = new Error("Phase73A source Phase72 event is invalid or not canonical.");
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_SOURCE_EVENT_INVALID";
    throw error;
  }
  const persisted = object(
    object(worldState.goal_implementation_intention_means_feasibility_events)[
      event.means_feasibility_event_id
    ],
  );
  const persistedRef = array(
    worldState.goal_implementation_intention_means_feasibility_history,
  ).find((ref) => ref?.means_feasibility_event_id === event.means_feasibility_event_id);
  if (!Object.keys(persisted).length
      || persisted.means_feasibility_event_hash !== event.means_feasibility_event_hash
      || meansFeasibilityEventHash(persisted) !== persisted.means_feasibility_event_hash
      || !sameValue(persisted, event)
      || !isObject(persistedRef)
      || persistedRef.schema_version !== meansFeasibilityHistoryReferenceSchemaVersion
      || persistedRef.derived_index !== true
      || persistedRef.means_feasibility_event_hash !== event.means_feasibility_event_hash
      || persistedRef.character !== event.character
      || persistedRef.source_turn_id !== event.source_turn_id
      || persistedRef.goal_id !== event.goal_id
      || persistedRef.implementation_intention_id !== event.implementation_intention_id
      || persistedRef.means_status !== event.means_status
      || persistedRef.status !== event.status) {
    const error = new Error(
      `Phase73A source ${event.means_feasibility_event_id} is not the committed canonical Phase72 event/history pair.`,
    );
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_SOURCE_EVENT_INVALID";
    throw error;
  }
  const usedEvidenceRefs = new Set(
    array(event.constraint_checks).flatMap((check) => array(check?.evidence_refs)),
  );
  const visibleRefs = array(event.character_visible_evidence_refs);
  if (visibleRefs.length > 16
      || new Set(visibleRefs).size !== visibleRefs.length
      || visibleRefs.some((ref) => !usedEvidenceRefs.has(ref) || !evidenceByRef.has(ref))) {
    const error = new Error(
      `Phase73A source ${event.means_feasibility_event_id} has an invalid character-visible subset.`,
    );
    error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_VISIBLE_SUBSET_INVALID";
    throw error;
  }
  for (const evidenceRef of visibleRefs) {
    const entry = evidenceByRef.get(evidenceRef);
    if (optionalString(entry.evidence_character)
        && !sameCharacter(entry.evidence_character, event.character)) {
      const error = new Error(
        `Phase73A source ${event.means_feasibility_event_id} exposes cross-character evidence.`,
      );
      error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_CROSS_CHARACTER_FORBIDDEN";
      throw error;
    }
  }
  return event;
}

function validateHistory(worldState) {
  const events = object(worldState.visible_constraint_observation_events);
  const history = array(worldState.visible_constraint_observation_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const seenSourceEvidence = new Set();
  for (const ref of history) {
    const event = object(events[ref?.observation_event_id]);
    const source = object(
      object(worldState.goal_implementation_intention_means_feasibility_events)[
        event.source_means_feasibility_event_id
      ],
    );
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    const sourceEvidenceKey = `${key}\u0000${event.source_means_feasibility_event_id}\u0000${event.source_evidence_ref}`;
    if (!isObject(ref)
        || ref.schema_version !== visibleConstraintObservationHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.observation_event_id)
        || seenEventIds.has(ref.observation_event_id)
        || !Object.keys(event).length
        || event.schema_version !== visibleConstraintObservationEventSchemaVersion
        || event.version !== worldSimulationVisibleConstraintObservationVersion
        || event.immutable !== true
        || event.observation_event_id !== ref.observation_event_id
        || observationEventHash(event) !== event.observation_event_hash
        || ref.observation_event_hash !== event.observation_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.source_means_feasibility_event_id !== event.source_means_feasibility_event_id
        || ref.source_evidence_ref !== event.source_evidence_ref
        || ref.deliver_at_state_revision !== event.deliver_at_state_revision
        || ref.previous_observation_event_id !== event.previous_observation_event_id
        || ref.previous_observation_event_hash !== event.previous_observation_event_hash
        || event.previous_observation_event_id !== (previous?.observation_event_id ?? null)
        || event.previous_observation_event_hash !== (previous?.observation_event_hash ?? null)
        || seenSourceEvidence.has(sourceEvidenceKey)
        || !Object.keys(source).length
        || source.means_feasibility_event_hash !== event.source_means_feasibility_event_hash
        || meansFeasibilityEventHash(source) !== source.means_feasibility_event_hash
        || !array(source.character_visible_evidence_refs).includes(event.source_evidence_ref)
        || !sameCharacter(source.character, event.character)
        || event.perceptual_channel !== "other_senses"
        || event.actual_means_feasibility_verdict_exposed !== false
        || event.world_truth_authority_exposed !== false
        || event.direct_belief_write !== false
        || event.same_turn_cognition_feedback_allowed !== false
        || event.status !== "visible_constraint_observation_recorded") {
      const error = new Error(
        "Phase73A visible-constraint observation history contains an invalid reference/event pair.",
      );
      error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_HISTORY_INVALID";
      throw error;
    }
    seenEventIds.add(event.observation_event_id);
    seenSourceEvidence.add(sourceEvidenceKey);
    latestByCharacter.set(key, event);
  }
  return {
    events,
    history,
    latestByCharacter,
    seenEventIds,
    seenSourceEvidence,
  };
}

function observationEventFor(
  sourceEvent,
  evidenceEntry,
  sourceStateRevision,
  previous,
) {
  const deliverAtStateRevision = sourceStateRevision + 1;
  const base = {
    schema_version: visibleConstraintObservationEventSchemaVersion,
    version: worldSimulationVisibleConstraintObservationVersion,
    immutable: true,
    character: sourceEvent.character,
    source_turn_id: sourceEvent.source_turn_id,
    source_state_revision: sourceStateRevision,
    deliver_at_state_revision: deliverAtStateRevision,
    operation: "publish_visible_constraint_observation",
    source_means_feasibility_event_id: sourceEvent.means_feasibility_event_id,
    source_means_feasibility_event_hash: sourceEvent.means_feasibility_event_hash,
    source_evidence_ref: evidenceEntry.evidence_ref,
    source_evidence_hash: evidenceEntry.evidence_hash,
    source_evidence_kind: evidenceEntry.evidence_kind,
    authoritative_evidence_catalog_hash: sourceEvent.authoritative_evidence_catalog_hash,
    perceptual_channel: "other_senses",
    character_facing_observation: characterFacingObservation(evidenceEntry),
    previous_observation_event_id: previous?.observation_event_id ?? null,
    previous_observation_event_hash: previous?.observation_event_hash ?? null,
    explicit_phase72_character_visible_subset_only: true,
    next_committed_revision_only: true,
    actual_means_feasibility_verdict_exposed: false,
    world_truth_authority_exposed: false,
    direct_belief_write: false,
    direct_subjective_memory_write: false,
    direct_current_mind_write: false,
    same_turn_cognition_feedback_allowed: false,
    same_turn_replanning_triggered: false,
    cross_character_exposure_allowed: false,
    status: "visible_constraint_observation_recorded",
  };
  const eventId = `visible_constraint_observation_event_${hashAgentRunValue({
    version: worldSimulationVisibleConstraintObservationVersion,
    character: characterKey(sourceEvent.character),
    source_turn_id: sourceEvent.source_turn_id,
    source_state_revision: sourceStateRevision,
    source_means_feasibility_event_hash: sourceEvent.means_feasibility_event_hash,
    source_evidence_hash: evidenceEntry.evidence_hash,
    previous_observation_event_hash: previous?.observation_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = {
    ...base,
    observation_event_id: eventId,
  };
  event.observation_event_hash = observationEventHash(event);
  return deepFreeze(event);
}
function historyRefFor(event) {
  return deepFreeze({
    schema_version: visibleConstraintObservationHistoryReferenceSchemaVersion,
    derived_index: true,
    observation_event_id: event.observation_event_id,
    observation_event_hash: event.observation_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    source_means_feasibility_event_id: event.source_means_feasibility_event_id,
    source_evidence_ref: event.source_evidence_ref,
    deliver_at_state_revision: event.deliver_at_state_revision,
    previous_observation_event_id: event.previous_observation_event_id,
    previous_observation_event_hash: event.previous_observation_event_hash,
    status: event.status,
  });
}
function authoritativeValidationContext(phase72Context, turnId, sourceStateRevision) {
  const context = {
    version: worldSimulationVisibleConstraintObservationVersion,
    turn_id: turnId,
    source_state_revision: sourceStateRevision,
    deliver_at_state_revision: sourceStateRevision + 1,
    phase72_authoritative_validation_context: cloneJson(phase72Context),
    explicit_phase72_character_visible_subset_only: true,
    next_committed_revision_only: true,
    raw_world_state_exposed_to_character: false,
    actual_means_feasibility_verdict_exposed_to_character: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

export function buildWorldSimulationVisibleConstraintObservationContract() {
  return deepFreeze({
    version: worldSimulationVisibleConstraintObservationVersion,
    phase: "Phase73A",
    status: "observer_scoped_visible_constraint_observation_bridge_installed",
    source: "Phase72 explicit character-visible evidence subset only",
    phase72_world_truth_verdict_directly_exposed: false,
    only_source_evidence_payload_becomes_perception: true,
    output_perceptual_channel: "other_senses",
    observer_scope_required: true,
    cross_character_exposure_allowed: false,
    direct_subjective_memory_write: false,
    direct_subjective_claim_or_belief_write: false,
    direct_current_mind_write: false,
    same_turn_cognition_feedback_allowed: false,
    same_turn_replanning_triggered: false,
    delivery_window: "exactly_next_committed_state_revision",
    failed_prepare_or_resolve_retry_preserves_delivery: true,
    immutable_observation_event_write_once_required: true,
    append_only_observation_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationVisibleConstraintObservations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const sourceStateRevision = nonNegativeSafeInteger(
    input.source_state_revision,
    "source_state_revision",
  );
  const rawPhase72Context = input.phase72_authoritative_validation_context
    ?? input.authoritative_validation_context;
  const { phase72, evidenceByRef } = validatePhase72Context(rawPhase72Context, turnId);
  const sourceEvents = array(input.means_feasibility_events)
    .map((event) => validatePhase72Event(worldState, event, turnId, phase72, evidenceByRef));
  const replay = validateHistory(worldState);
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(replay.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  const seenSourceEvidence = new Set(replay.seenSourceEvidence);

  for (const sourceEvent of sourceEvents) {
    for (const evidenceRef of array(sourceEvent.character_visible_evidence_refs)) {
      if (createdEvents.length >= maximumVisibleObservationsPerTurn) {
        const error = new Error(
          `Phase73A allows at most ${maximumVisibleObservationsPerTurn} visible constraint observations per turn.`,
        );
        error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_TURN_LIMIT";
        throw error;
      }
      const evidenceEntry = evidenceByRef.get(evidenceRef);
      if (!evidenceEntry) {
        const error = new Error(
          `Phase73A evidence ${evidenceRef} is outside the canonical Phase72 context.`,
        );
        error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_EVIDENCE_OUT_OF_CONTEXT";
        throw error;
      }
      if (optionalString(evidenceEntry.evidence_character)
          && !sameCharacter(evidenceEntry.evidence_character, sourceEvent.character)) {
        const error = new Error(
          `Phase73A evidence ${evidenceRef} belongs to another character.`,
        );
        error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_CROSS_CHARACTER_FORBIDDEN";
        throw error;
      }
      const sourceEvidenceKey = `${characterKey(sourceEvent.character)}\u0000${sourceEvent.means_feasibility_event_id}\u0000${evidenceRef}`;
      if (seenSourceEvidence.has(sourceEvidenceKey)) {
        const error = new Error(
          `Phase73A evidence ${evidenceRef} already has a durable observation receipt.`,
        );
        error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_DUPLICATE_SOURCE";
        throw error;
      }
      const key = characterKey(sourceEvent.character);
      const event = observationEventFor(
        sourceEvent,
        evidenceEntry,
        sourceStateRevision,
        latestByCharacter.get(key) ?? null,
      );
      preview.visible_constraint_observation_events = object(
        preview.visible_constraint_observation_events,
      );
      if (preview.visible_constraint_observation_events[event.observation_event_id]) {
        const error = new Error(
          `Phase73A observation ${event.observation_event_id} already exists.`,
        );
        error.code = "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_IMMUTABILITY_VIOLATION";
        throw error;
      }
      preview.visible_constraint_observation_events[event.observation_event_id] = cloneJson(event);
      const ref = historyRefFor(event);
      createdEvents.push(event);
      appendedReferences.push(ref);
      latestByCharacter.set(key, event);
      seenSourceEvidence.add(sourceEvidenceKey);
      stateTransitions.push({
        entity: "world",
        field: `visible_constraint_observation_events.${event.observation_event_id}`,
        from: null,
        to: cloneJson(event),
        cause: `persist immutable Phase73A visible constraint observation ${event.observation_event_id}`,
        source_layer: "visible_constraint_observation",
      });
    }
  }
  if (appendedReferences.length) {
    const nextHistory = [
      ...replay.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.visible_constraint_observation_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "visible_constraint_observation_history",
      from: cloneJson(worldState.visible_constraint_observation_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase73A visible constraint observation history reference(s)`,
      source_layer: "visible_constraint_observation",
    });
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationVisibleConstraintObservationVersion,
    result: {
      visible_observation_count: createdEvents.length,
      observation_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      authoritative_validation_context: authoritativeValidationContext(
        phase72,
        turnId,
        sourceStateRevision,
      ),
      audit: {
        phase72_character_visible_subset_only: true,
        observer_scoped: true,
        next_committed_revision_only: true,
        actual_means_feasibility_verdict_exposed: false,
        world_truth_authority_exposed: false,
        direct_subjective_memory_write: false,
        direct_subjective_claim_or_belief_write: false,
        direct_current_mind_write: false,
        same_turn_cognition_feedback_allowed: false,
        same_turn_replanning_triggered: false,
        cross_character_exposure_allowed: false,
      },
    },
  });
}

export function projectWorldSimulationVisibleConstraintObservationsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character");
  const stateRevision = nonNegativeSafeInteger(input.state_revision, "state_revision");
  const replay = validateHistory(worldState);
  const observations = replay.history
    .map((ref) => replay.events[ref.observation_event_id])
    .filter((event) => sameCharacter(event?.character, character)
      && event?.deliver_at_state_revision === stateRevision)
    .map((event) => cloneJson(event.character_facing_observation));
  const characterView = {
    source: "committed_prior_revision_phase72_character_visible_evidence_only",
    other_senses: observations,
    observation_count: observations.length,
    observations_truncated: false,
    world_truth_authority: false,
    actual_means_feasibility_verdict_exposed: false,
  };
  const result = {
    version: visibleConstraintObservationCharacterProjectionVersion,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      character,
      state_revision: stateRevision,
      exact_delivery_revision_only: true,
      same_character_only: true,
      replayed_observation_event_count: replay.history.length,
      projected_observation_count: observations.length,
      engine_source_event_ids_exposed: false,
      engine_evidence_refs_exposed: false,
      actual_means_feasibility_verdict_exposed: false,
      world_truth_authority_exposed: false,
      direct_belief_write: false,
    },
  };
  return deepFreeze(result);
}
