import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  autobiographicalLifeEventOrganizationEventSchemaVersion,
  autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion,
  projectWorldSimulationEffectiveAutobiographicalLifeEvents,
  worldSimulationAutobiographicalLifeEventVersion,
} from "./world-simulation-autobiographical-life-event-service.mjs";
import {
  personalSemanticDerivationEventSchemaVersion,
  personalSemanticDerivationHistoryReferenceSchemaVersion,
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationAutobiographicalLifePeriodVersion =
  "phase67d-autobiographical-life-period-v1";

export const autobiographicalLifePeriodOrganizationEventSchemaVersion =
  "phase67d-autobiographical-life-period-organization-event-v1";

export const autobiographicalLifePeriodOrganizationHistoryReferenceSchemaVersion =
  "phase67d-autobiographical-life-period-organization-history-ref-v1";

export const effectiveAutobiographicalLifePeriodProjectionVersion =
  "phase67d-effective-autobiographical-life-period-projection-v1";

const supportedOperations = Object.freeze([
  "start_period",
  "attach_life_event",
  "close_period",
]);

const supportedEvidenceKinds = Object.freeze([
  "explicit_programmatic_binding",
  "personal_semantic_support",
]);

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
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

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function characterKey(value) {
  return requiredString(value, "character")
    .toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function organizationEventHash(event) {
  const body = cloneJson(event);
  delete body.organization_event_hash;
  return hashAgentRunValue(body);
}

function semanticDerivationEventHash(event) {
  const body = cloneJson(event);
  delete body.derivation_event_hash;
  return hashAgentRunValue(body);
}

function lifePeriodOrganizationEventHash(event) {
  const body = cloneJson(event);
  delete body.organization_event_hash;
  return hashAgentRunValue(body);
}

function normalizePeriodDescriptor(value) {
  if (!isObject(value)) {
    const error = new Error("period_descriptor must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
    throw error;
  }
  const periodKey = requiredString(
    value.period_key,
    "period_descriptor.period_key",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID",
  );
  if (periodKey.length > 240) {
    const error = new Error("LifePeriod period_key exceeds the bounded v1 shape.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
    throw error;
  }
  const qualifiers = array(value.qualifiers).map((item, index) => {
    const text = requiredString(
      item,
      `period_descriptor.qualifiers[${index}]`,
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID",
    );
    if (text.length > 160) {
      const error = new Error("LifePeriod qualifier exceeds the bounded v1 shape.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
      throw error;
    }
    return text;
  }).sort(compareText);
  if (qualifiers.length > 16 || new Set(qualifiers).size !== qualifiers.length) {
    const error = new Error("LifePeriod qualifiers must be unique and bounded.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
    throw error;
  }
  return {
    subject_scope: "self_autobiographical_life",
    period_key: periodKey,
    qualifiers,
  };
}

function assertCanonicalLifeEventOrganizationEvent(worldState, eventId) {
  const event = object(
    object(worldState.autobiographical_life_event_organization_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.schema_version !== autobiographicalLifeEventOrganizationEventSchemaVersion
    || event.version !== worldSimulationAutobiographicalLifeEventVersion
    || event.immutable !== true
    || event.organization_event_id !== eventId
    || !optionalString(event.organization_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.life_event_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.memory_content_copied !== false
    || event.episode_content_copied !== false
  ) {
    const error = new Error(`Phase67D cannot resolve canonical Phase67B event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_LIFE_EVENT_INVALID";
    throw error;
  }
  if (organizationEventHash(event) !== event.organization_event_hash) {
    const error = new Error(`Phase67B source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_LIFE_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function assertCanonicalSemanticDerivationEvent(worldState, eventId) {
  const event = object(
    object(worldState.personal_semantic_derivation_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.schema_version !== personalSemanticDerivationEventSchemaVersion
    || event.version !== worldSimulationPersonalSemanticMemoryVersion
    || event.immutable !== true
    || event.derivation_event_id !== eventId
    || !optionalString(event.derivation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.semantic_memory_id)
    || !optionalString(event.source_turn_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_acceptance_decided !== false
    || event.belief_engine_used !== false
  ) {
    const error = new Error(`Phase67D cannot resolve canonical Phase67C event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_SEMANTIC_EVENT_INVALID";
    throw error;
  }
  if (semanticDerivationEventHash(event) !== event.derivation_event_hash) {
    const error = new Error(`Phase67C source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_SEMANTIC_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function normalizeLifeEventRefs(worldState, value, expectedCharacter) {
  const refs = array(value).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`source_life_event_refs[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_INVALID";
      throw error;
    }
    const organizationEventId = requiredString(
      item.organization_event_id,
      `source_life_event_refs[${index}].organization_event_id`,
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_INVALID",
    );
    const event = assertCanonicalLifeEventOrganizationEvent(worldState, organizationEventId);
    if (!sameCharacter(event.character, expectedCharacter)) {
      const error = new Error("LifePeriod organization may use only same-character LifeEvents.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CROSS_CHARACTER_EVIDENCE_FORBIDDEN";
      throw error;
    }
    const normalized = {
      life_event_id: requiredString(
        item.life_event_id,
        `source_life_event_refs[${index}].life_event_id`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_INVALID",
      ),
      organization_event_id: organizationEventId,
      organization_event_hash: requiredString(
        item.organization_event_hash,
        `source_life_event_refs[${index}].organization_event_hash`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_INVALID",
      ),
    };
    if (
      normalized.life_event_id !== event.life_event_id
      || normalized.organization_event_hash !== event.organization_event_hash
    ) {
      const error = new Error("LifePeriod evidence does not pin canonical Phase67B provenance.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_MISMATCH";
      throw error;
    }
    return normalized;
  }).sort((left, right) => {
    const life = compareText(left.life_event_id, right.life_event_id);
    return life !== 0 ? life : compareText(left.organization_event_id, right.organization_event_id);
  });
  const keys = refs.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  );
  if (new Set(keys).size !== keys.length) {
    const error = new Error("LifePeriod LifeEvent evidence contains duplicates.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_DUPLICATE";
    throw error;
  }
  return refs;
}

function normalizePersonalSemanticRefs(worldState, value, expectedCharacter) {
  const refs = array(value).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`source_personal_semantic_refs[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_INVALID";
      throw error;
    }
    const derivationEventId = requiredString(
      item.derivation_event_id,
      `source_personal_semantic_refs[${index}].derivation_event_id`,
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_INVALID",
    );
    const event = assertCanonicalSemanticDerivationEvent(worldState, derivationEventId);
    if (!sameCharacter(event.character, expectedCharacter)) {
      const error = new Error("LifePeriod semantic evidence may use only same-character Personal Semantic Memory.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CROSS_CHARACTER_EVIDENCE_FORBIDDEN";
      throw error;
    }
    const normalized = {
      semantic_memory_id: requiredString(
        item.semantic_memory_id,
        `source_personal_semantic_refs[${index}].semantic_memory_id`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_INVALID",
      ),
      derivation_event_id: derivationEventId,
      derivation_event_hash: requiredString(
        item.derivation_event_hash,
        `source_personal_semantic_refs[${index}].derivation_event_hash`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_INVALID",
      ),
    };
    if (
      normalized.semantic_memory_id !== event.semantic_memory_id
      || normalized.derivation_event_hash !== event.derivation_event_hash
    ) {
      const error = new Error("LifePeriod semantic evidence does not pin canonical Phase67C provenance.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_MISMATCH";
      throw error;
    }
    return normalized;
  }).sort((left, right) => {
    const semantic = compareText(left.semantic_memory_id, right.semantic_memory_id);
    return semantic !== 0
      ? semantic
      : compareText(left.derivation_event_id, right.derivation_event_id);
  });
  const keys = refs.map((item) =>
    `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
  );
  if (new Set(keys).size !== keys.length) {
    const error = new Error("LifePeriod personal-semantic evidence contains duplicates.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_DUPLICATE";
    throw error;
  }
  return refs;
}

function currentSourceSets(
  worldState,
  turnId,
  sourceOrganizationEventIds,
  sourceSemanticDerivationEventIds,
) {
  const lifeWanted = new Set(array(sourceOrganizationEventIds).map((value) =>
    requiredString(value, "source_organization_event_id"),
  ));
  const semanticWanted = new Set(array(sourceSemanticDerivationEventIds).map((value) =>
    requiredString(value, "source_semantic_derivation_event_id"),
  ));
  const lifeIds = [];
  const semanticIds = [];
  for (const reference of array(worldState.autobiographical_life_event_organization_history)) {
    const eventId = optionalString(reference?.organization_event_id);
    if (!eventId || !lifeWanted.has(eventId)) continue;
    const event = assertCanonicalLifeEventOrganizationEvent(worldState, eventId);
    if (event.source_turn_id !== turnId) {
      const error = new Error(`Phase67D source LifeEvent event ${eventId} is not from turn ${turnId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_TURN_MISMATCH";
      throw error;
    }
    lifeIds.push(eventId);
    lifeWanted.delete(eventId);
  }
  for (const reference of array(worldState.personal_semantic_derivation_history)) {
    const eventId = optionalString(reference?.derivation_event_id);
    if (!eventId || !semanticWanted.has(eventId)) continue;
    const event = assertCanonicalSemanticDerivationEvent(worldState, eventId);
    if (event.source_turn_id !== turnId) {
      const error = new Error(`Phase67D source Personal Semantic event ${eventId} is not from turn ${turnId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_TURN_MISMATCH";
      throw error;
    }
    semanticIds.push(eventId);
    semanticWanted.delete(eventId);
  }
  if (lifeWanted.size || semanticWanted.size) {
    const missing = [...lifeWanted, ...semanticWanted];
    const error = new Error(`Phase67D cannot resolve current source event(s): ${missing.join(", ")}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CURRENT_SOURCE_UNRESOLVED";
    throw error;
  }
  return {
    life_event_organization_event_ids: lifeIds,
    personal_semantic_derivation_event_ids: semanticIds,
  };
}

function lifeEventEvidenceSurface(worldState) {
  const refs = [];
  for (const reference of array(worldState.autobiographical_life_event_organization_history)) {
    const eventId = requiredString(reference?.organization_event_id, "organization_event_id");
    const event = assertCanonicalLifeEventOrganizationEvent(worldState, eventId);
    if (
      reference.schema_version !== autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion
      || reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.life_event_id !== event.life_event_id
    ) {
      const error = new Error("Phase67D encountered a non-canonical Phase67B history reference.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_LIFE_EVENT_HISTORY_INVALID";
      throw error;
    }
    refs.push({
      character: event.character,
      source_turn_id: event.source_turn_id,
      life_event_id: event.life_event_id,
      organization_event_id: event.organization_event_id,
      organization_event_hash: event.organization_event_hash,
    });
  }
  return refs;
}

function personalSemanticEvidenceSurface(worldState) {
  const refs = [];
  for (const reference of array(worldState.personal_semantic_derivation_history)) {
    const eventId = requiredString(reference?.derivation_event_id, "derivation_event_id");
    const event = assertCanonicalSemanticDerivationEvent(worldState, eventId);
    if (
      reference.schema_version !== personalSemanticDerivationHistoryReferenceSchemaVersion
      || reference.derivation_event_hash !== event.derivation_event_hash
      || reference.character !== event.character
      || reference.semantic_memory_id !== event.semantic_memory_id
    ) {
      const error = new Error("Phase67D encountered a non-canonical Phase67C history reference.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_SEMANTIC_HISTORY_INVALID";
      throw error;
    }
    refs.push({
      character: event.character,
      source_turn_id: event.source_turn_id,
      semantic_memory_id: event.semantic_memory_id,
      semantic_category: event.semantic_category,
      derivation_event_id: event.derivation_event_id,
      derivation_event_hash: event.derivation_event_hash,
      operation: event.operation,
    });
  }
  return refs;
}

function assertPersistedLifePeriodEvent(event, eventId, worldState) {
  if (
    !isObject(event)
    || event.schema_version !== autobiographicalLifePeriodOrganizationEventSchemaVersion
    || event.version !== worldSimulationAutobiographicalLifePeriodVersion
    || event.immutable !== true
    || event.organization_event_id !== eventId
    || !optionalString(event.organization_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !supportedOperations.includes(event.operation)
    || !optionalString(event.life_period_id)
    || !optionalString(event.period_descriptor_hash)
    || !optionalString(event.resolver_view_hash)
    || !supportedEvidenceKinds.includes(event.evidence_kind)
    || event.status !== "autobiographical_life_period_organization_recorded"
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.confidence !== null
    || event.probability !== null
    || event.life_event_content_copied !== false
    || event.personal_semantic_content_copied !== false
    || event.memory_content_copied !== false
    || event.character_brain_direct_write !== false
  ) {
    const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_INVALID";
    throw error;
  }
  const descriptor = normalizePeriodDescriptor(event.period_descriptor);
  if (
    !sameValue(descriptor, event.period_descriptor)
    || hashAgentRunValue(descriptor) !== event.period_descriptor_hash
    || lifePeriodOrganizationEventHash(event) !== event.organization_event_hash
  ) {
    const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} failed immutable verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_HASH_MISMATCH";
    throw error;
  }
  const lifeRefs = normalizeLifeEventRefs(worldState, event.source_life_event_refs, event.character);
  const semanticRefs = normalizePersonalSemanticRefs(
    worldState,
    event.source_personal_semantic_refs,
    event.character,
  );
  const currentTurnTrigger = lifeRefs.some((item) =>
    assertCanonicalLifeEventOrganizationEvent(worldState, item.organization_event_id)
      .source_turn_id === event.source_turn_id,
  ) || semanticRefs.some((item) =>
    assertCanonicalSemanticDerivationEvent(worldState, item.derivation_event_id)
      .source_turn_id === event.source_turn_id,
  );
  if (!currentTurnTrigger) {
    const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} lacks a current-turn autobiographical trigger.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  if (
    ["start_period", "attach_life_event"].includes(event.operation)
    && !lifeRefs.length
  ) {
    const error = new Error(`${event.operation} requires at least one LifeEvent membership source.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_MEMBERSHIP_SOURCE_REQUIRED";
    throw error;
  }
  if (event.evidence_kind === "personal_semantic_support" && !semanticRefs.length) {
    const error = new Error("personal_semantic_support requires canonical Phase67C evidence.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_SUPPORT_REQUIRED";
    throw error;
  }
  const evidence = object(event.organization_evidence);
  if (
    evidence.decision_source !== "programmatic_autobiographical_life_period_organization_resolver"
    || evidence.resolver_view_ref !== `phase67d_resolver_view:${event.resolver_view_hash}`
    || evidence.temporal_adjacency_alone_used !== false
    || evidence.calendar_bucket_used !== false
    || evidence.fixed_duration_threshold_used !== false
    || evidence.freeform_llm_period_authority_used !== false
    || evidence.current_turn_autobiographical_trigger_required !== true
    || evidence.overlapping_periods_allowed !== true
  ) {
    const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} violates Phase67D evidence semantics.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_BOUNDARY_VIOLATION";
    throw error;
  }
  if (event.evidence_kind === "explicit_programmatic_binding") {
    if (
      evidence.binding_source_ref !== `phase67d_resolver_view:${event.resolver_view_hash}`
      || evidence.binding_source_hash !== event.resolver_view_hash
    ) {
      const error = new Error("Explicit LifePeriod binding does not pin the canonical resolver view.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_BINDING_PROVENANCE_INVALID";
      throw error;
    }
  }
  return event;
}

function validateExistingLifePeriodHistory(worldState) {
  if (
    Object.hasOwn(worldState, "autobiographical_life_period_organization_events")
    && !isObject(worldState.autobiographical_life_period_organization_events)
  ) {
    const error = new Error("autobiographical_life_period_organization_events must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_STORE_INVALID";
    throw error;
  }
  if (
    Object.hasOwn(worldState, "autobiographical_life_period_organization_history")
    && !Array.isArray(worldState.autobiographical_life_period_organization_history)
  ) {
    const error = new Error("autobiographical_life_period_organization_history must be an array.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.autobiographical_life_period_organization_events);
  const history = array(worldState.autobiographical_life_period_organization_history);
  const latestByCharacter = new Map();
  const latestByPeriod = new Map();
  const seen = new Set();
  for (const [index, reference] of history.entries()) {
    if (
      !isObject(reference)
      || reference.schema_version !== autobiographicalLifePeriodOrganizationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !optionalString(reference.organization_event_id)
      || !optionalString(reference.organization_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.life_period_id)
      || !supportedOperations.includes(reference.operation)
      || reference.status !== "autobiographical_life_period_organization_recorded"
    ) {
      const error = new Error(`autobiographical_life_period_organization_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const eventId = reference.organization_event_id;
    if (seen.has(eventId)) {
      const error = new Error(`Duplicate LifePeriod organization event ${eventId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }
    const event = assertPersistedLifePeriodEvent(events[eventId], eventId, worldState);
    const character = characterKey(event.character);
    const previousCharacterEvent = latestByCharacter.get(character) ?? null;
    const previousPeriodEvent = latestByPeriod.get(event.life_period_id) ?? null;
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.life_period_id !== event.life_period_id
      || reference.operation !== event.operation
      || reference.previous_organization_event_id !== event.previous_organization_event_id
      || reference.previous_organization_event_hash !== event.previous_organization_event_hash
      || reference.previous_period_event_id !== event.previous_period_event_id
      || reference.previous_period_event_hash !== event.previous_period_event_hash
      || event.previous_organization_event_id !== (previousCharacterEvent?.organization_event_id ?? null)
      || event.previous_organization_event_hash !== (previousCharacterEvent?.organization_event_hash ?? null)
      || event.previous_period_event_id !== (previousPeriodEvent?.organization_event_id ?? null)
      || event.previous_period_event_hash !== (previousPeriodEvent?.organization_event_hash ?? null)
      || (event.operation === "start_period" && previousPeriodEvent !== null)
      || (event.operation !== "start_period" && previousPeriodEvent === null)
    ) {
      const error = new Error(`LifePeriod organization reference ${eventId} breaks its canonical chain.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (previousPeriodEvent) {
      if (
        event.period_descriptor_hash !== previousPeriodEvent.period_descriptor_hash
        || !sameValue(event.period_descriptor, previousPeriodEvent.period_descriptor)
      ) {
        const error = new Error(`LifePeriod identity ${event.life_period_id} was rewritten.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_REWRITE_FORBIDDEN";
        throw error;
      }
      if (previousPeriodEvent.operation === "close_period") {
        const error = new Error(`Closed LifePeriod ${event.life_period_id} cannot be mutated in Phase67D v1.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CLOSED_PERIOD_MUTATION_FORBIDDEN";
        throw error;
      }
    }
    seen.add(eventId);
    latestByCharacter.set(character, event);
    latestByPeriod.set(event.life_period_id, event);
  }
  return {
    events,
    history,
    latestByCharacter,
    latestByPeriod,
  };
}

export function projectWorldSimulationEffectiveAutobiographicalLifePeriods(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateExistingLifePeriodHistory(worldState);
  const periodsByCharacter = {};
  const periodIdsByLifeEventByCharacter = {};
  const openPeriodIdsByCharacter = {};
  const lifeEventHistoryIndex = new Map();
  array(worldState.autobiographical_life_event_organization_history)
    .forEach((reference, index) => {
      if (optionalString(reference?.organization_event_id)) {
        lifeEventHistoryIndex.set(reference.organization_event_id, index);
      }
    });

  for (const reference of existing.history) {
    const event = existing.events[reference.organization_event_id];
    const character = event.character;
    if (!isObject(periodsByCharacter[character])) periodsByCharacter[character] = {};
    if (!isObject(periodIdsByLifeEventByCharacter[character])) {
      periodIdsByLifeEventByCharacter[character] = {};
    }
    if (!Array.isArray(openPeriodIdsByCharacter[character])) {
      openPeriodIdsByCharacter[character] = [];
    }
    const prior = object(periodsByCharacter[character][event.life_period_id]);
    const memberRefs = array(prior.member_life_event_refs).map(cloneJson);
    const membershipKeys = new Set(memberRefs.map((item) =>
      `${item.life_event_id}\u0000${item.organization_event_id}`,
    ));
    if (["start_period", "attach_life_event"].includes(event.operation)) {
      for (const item of array(event.source_life_event_refs)) {
        const key = `${item.life_event_id}\u0000${item.organization_event_id}`;
        if (!membershipKeys.has(key)) {
          memberRefs.push(cloneJson(item));
          membershipKeys.add(key);
        }
      }
    }
    memberRefs.sort((left, right) => {
      const leftIndex = lifeEventHistoryIndex.get(left.organization_event_id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = lifeEventHistoryIndex.get(right.organization_event_id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex !== rightIndex
        ? leftIndex - rightIndex
        : compareText(left.organization_event_id, right.organization_event_id);
    });
    const semanticRefs = [
      ...array(prior.source_personal_semantic_refs).map(cloneJson),
    ];
    const semanticKeys = new Set(semanticRefs.map((item) =>
      `${item.semantic_memory_id}\u0000${item.derivation_event_id}`,
    ));
    for (const item of array(event.source_personal_semantic_refs)) {
      const key = `${item.semantic_memory_id}\u0000${item.derivation_event_id}`;
      if (!semanticKeys.has(key)) {
        semanticRefs.push(cloneJson(item));
        semanticKeys.add(key);
      }
    }
    semanticRefs.sort((left, right) => compareText(left.derivation_event_id, right.derivation_event_id));
    const state = event.operation === "close_period" ? "closed" : "open";
    periodsByCharacter[character][event.life_period_id] = {
      life_period_id: event.life_period_id,
      character,
      period_descriptor: cloneJson(event.period_descriptor),
      period_descriptor_hash: event.period_descriptor_hash,
      member_life_event_refs: memberRefs,
      member_life_event_ids: [...new Set(memberRefs.map((item) => item.life_event_id))],
      source_personal_semantic_refs: semanticRefs,
      organization_event_ids: [
        ...array(prior.organization_event_ids),
        event.organization_event_id,
      ],
      first_organization_event_id:
        prior.first_organization_event_id ?? event.organization_event_id,
      latest_organization_event_id: event.organization_event_id,
      first_source_turn_id: prior.first_source_turn_id ?? event.source_turn_id,
      latest_source_turn_id: event.source_turn_id,
      first_member_source_turn_id: memberRefs.length
        ? assertCanonicalLifeEventOrganizationEvent(
          worldState,
          memberRefs[0].organization_event_id,
        ).source_turn_id
        : null,
      latest_member_source_turn_id: memberRefs.length
        ? assertCanonicalLifeEventOrganizationEvent(
          worldState,
          memberRefs[memberRefs.length - 1].organization_event_id,
        ).source_turn_id
        : null,
      state,
      subjective_not_world_truth: true,
      life_event_content_duplicated: false,
      personal_semantic_content_duplicated: false,
      memory_content_duplicated: false,
    };
    for (const item of memberRefs) {
      if (!Array.isArray(periodIdsByLifeEventByCharacter[character][item.life_event_id])) {
        periodIdsByLifeEventByCharacter[character][item.life_event_id] = [];
      }
      const ids = periodIdsByLifeEventByCharacter[character][item.life_event_id];
      if (!ids.includes(event.life_period_id)) ids.push(event.life_period_id);
      ids.sort(compareText);
    }
    const openIds = openPeriodIdsByCharacter[character];
    const index = openIds.indexOf(event.life_period_id);
    if (state === "open" && index < 0) openIds.push(event.life_period_id);
    if (state === "closed" && index >= 0) openIds.splice(index, 1);
    openIds.sort(compareText);
  }

  const projection = {
    version: effectiveAutobiographicalLifePeriodProjectionVersion,
    source_version: worldSimulationAutobiographicalLifePeriodVersion,
    periods_by_character: periodsByCharacter,
    period_ids_by_life_event_by_character: periodIdsByLifeEventByCharacter,
    open_period_ids_by_character: openPeriodIdsByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    overlapping_periods_allowed: true,
    many_to_many_life_event_membership: true,
    one_primary_period_parent_per_life_event: false,
    calendar_bucket_model: false,
    temporal_adjacency_membership_authority: false,
    world_truth_authority_claimed: false,
    character_brain_exposure_installed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

export function buildWorldSimulationAutobiographicalLifePeriodResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const current = currentSourceSets(
    worldState,
    turnId,
    input.source_organization_event_ids,
    input.source_semantic_derivation_event_ids,
  );
  const lifeEvidence = lifeEventEvidenceSurface(worldState);
  const semanticEvidence = personalSemanticEvidenceSurface(worldState);
  const currentLifeSet = new Set(current.life_event_organization_event_ids);
  const currentSemanticSet = new Set(current.personal_semantic_derivation_event_ids);
  const lifeProjection = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
    world_state: worldState,
  });
  const semanticProjection = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: worldState,
  });
  const periodProjection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
    world_state: worldState,
  });
  const view = {
    version: worldSimulationAutobiographicalLifePeriodVersion,
    turn_id: turnId,
    current_life_event_updates: lifeEvidence.filter((item) =>
      currentLifeSet.has(item.organization_event_id),
    ),
    current_personal_semantic_updates: semanticEvidence.filter((item) =>
      currentSemanticSet.has(item.derivation_event_id),
    ),
    available_life_event_evidence_refs: lifeEvidence,
    available_personal_semantic_evidence_refs: semanticEvidence,
    effective_life_event_projection_hash: lifeProjection.projection_hash,
    effective_personal_semantic_projection: cloneJson(semanticProjection.memories_by_character),
    effective_personal_semantic_projection_hash: semanticProjection.projection_hash,
    effective_life_period_projection: cloneJson(periodProjection.periods_by_character),
    effective_life_period_projection_hash: periodProjection.projection_hash,
    supported_operations: [...supportedOperations],
    supported_evidence_kinds: [...supportedEvidenceKinds],
    explicit_programmatic_binding_source_ref_format:
      "phase67d_resolver_view:<resolver_view_hash>",
    current_turn_autobiographical_trigger_required: true,
    overlapping_periods_allowed: true,
    many_to_many_life_event_membership: true,
    one_primary_period_parent_per_life_event: false,
    temporal_adjacency_alone_is_sufficient: false,
    calendar_bucket_is_sufficient: false,
    fixed_duration_threshold_used: false,
    life_event_content_exposed: false,
    memory_content_exposed: false,
    raw_world_event_exposed: false,
    whole_world_state_exposed: false,
    world_truth_judgment_requested: false,
    confidence_probability_requested: false,
    self_model_inference_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeDecision(worldState, raw, resolverView, existingProjection) {
  if (!isObject(raw)) {
    const error = new Error("LifePeriod organization decision must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_INVALID";
    throw error;
  }
  const character = requiredString(
    raw.character,
    "life period decision character",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_INVALID",
  );
  const operation = requiredString(
    raw.operation,
    "life period operation",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_INVALID",
  );
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase67D operation: ${operation}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_INVALID";
    throw error;
  }
  const evidenceKind = requiredString(
    raw.evidence_kind,
    "evidence_kind",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_INVALID",
  );
  if (!supportedEvidenceKinds.includes(evidenceKind)) {
    const error = new Error(`Unsupported Phase67D evidence kind: ${evidenceKind}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVIDENCE_KIND_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = requiredString(
    raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_RESOLVER_VIEW_HASH_REQUIRED",
  );
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("LifePeriod decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const lifeRefs = normalizeLifeEventRefs(worldState, raw.source_life_event_refs, character);
  const semanticRefs = normalizePersonalSemanticRefs(
    worldState,
    raw.source_personal_semantic_refs,
    character,
  );
  const availableLife = new Set(resolverView.available_life_event_evidence_refs.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  ));
  if (lifeRefs.some((item) => !availableLife.has(
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  ))) {
    const error = new Error("LifePeriod decision references LifeEvent evidence outside the resolver view.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_OUT_OF_VIEW";
    throw error;
  }
  const availableSemantic = new Set(
    resolverView.available_personal_semantic_evidence_refs.map((item) =>
      `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
    ),
  );
  if (semanticRefs.some((item) => !availableSemantic.has(
    `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
  ))) {
    const error = new Error("LifePeriod decision references Personal Semantic evidence outside the resolver view.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_OUT_OF_VIEW";
    throw error;
  }
  const currentLife = new Set(resolverView.current_life_event_updates.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  ));
  const currentSemantic = new Set(resolverView.current_personal_semantic_updates.map((item) =>
    `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
  ));
  const currentTurnTriggered = lifeRefs.some((item) => currentLife.has(
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  )) || semanticRefs.some((item) => currentSemantic.has(
    `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
  ));
  if (!currentTurnTriggered) {
    const error = new Error("LifePeriod organization requires at least one current-turn autobiographical trigger.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  if (["start_period", "attach_life_event"].includes(operation) && !lifeRefs.length) {
    const error = new Error(`${operation} requires at least one LifeEvent membership source.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_MEMBERSHIP_SOURCE_REQUIRED";
    throw error;
  }
  if (evidenceKind === "personal_semantic_support" && !semanticRefs.length) {
    const error = new Error("personal_semantic_support requires canonical Phase67C evidence.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_SUPPORT_REQUIRED";
    throw error;
  }

  let lifePeriodId = optionalString(raw.life_period_id);
  let descriptor = raw.period_descriptor
    ? normalizePeriodDescriptor(raw.period_descriptor)
    : null;
  let existingPeriod = null;
  const existingCharacterPeriods = object(existingProjection.periods_by_character?.[character]);
  if (lifePeriodId) existingPeriod = existingCharacterPeriods[lifePeriodId] ?? null;

  if (operation === "start_period") {
    if (!descriptor) {
      const error = new Error("start_period requires a structured period_descriptor.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_REQUIRED";
      throw error;
    }
    const descriptorHash = hashAgentRunValue(descriptor);
    const expectedId = `autobiographical_life_period_${hashAgentRunValue({
      version: worldSimulationAutobiographicalLifePeriodVersion,
      character: characterKey(character),
      source_turn_id: resolverView.turn_id,
      period_descriptor_hash: descriptorHash,
      source_life_event_refs: lifeRefs,
      source_personal_semantic_refs: semanticRefs,
    }).slice(0, 24)}`;
    if (lifePeriodId && lifePeriodId !== expectedId) {
      const error = new Error("LifePeriod ID does not match deterministic formation identity.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_MISMATCH";
      throw error;
    }
    lifePeriodId = expectedId;
    if (existingCharacterPeriods[lifePeriodId]) {
      const error = new Error(`LifePeriod ${lifePeriodId} already exists.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DUPLICATE_START";
      throw error;
    }
  } else {
    if (!lifePeriodId || !existingPeriod) {
      const error = new Error(`${operation} requires an existing LifePeriod.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_TARGET_UNRESOLVED";
      throw error;
    }
    if (existingPeriod.state !== "open") {
      const error = new Error(`LifePeriod ${lifePeriodId} is already closed.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CLOSED_PERIOD_MUTATION_FORBIDDEN";
      throw error;
    }
    descriptor = normalizePeriodDescriptor(existingPeriod.period_descriptor);
    if (raw.period_descriptor && !sameValue(
      descriptor,
      normalizePeriodDescriptor(raw.period_descriptor),
    )) {
      const error = new Error("LifePeriod update cannot rewrite its period descriptor.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
    if (operation === "attach_life_event") {
      const existingMembership = new Set(array(existingPeriod.member_life_event_refs).map((item) =>
        `${item.life_event_id}\u0000${item.organization_event_id}`,
      ));
      const addsNewMembership = lifeRefs.some((item) => !existingMembership.has(
        `${item.life_event_id}\u0000${item.organization_event_id}`,
      ));
      if (!addsNewMembership) {
        const error = new Error("attach_life_event must add at least one new LifeEvent membership reference.");
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DUPLICATE_MEMBERSHIP";
        throw error;
      }
    }
  }

  return {
    character,
    operation,
    evidence_kind: evidenceKind,
    life_period_id: lifePeriodId,
    period_descriptor: descriptor,
    period_descriptor_hash: hashAgentRunValue(descriptor),
    source_life_event_refs: lifeRefs,
    source_personal_semantic_refs: semanticRefs,
    resolver_view_hash: resolverViewHash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_life_period_organization",
    source: optionalString(raw.source)
      ?? "programmatic_autobiographical_life_period_organization_resolver",
  };
}

function organizationEventFor({ decision, previousCharacterEvent, previousPeriodEvent, turnId }) {
  const base = {
    schema_version: autobiographicalLifePeriodOrganizationEventSchemaVersion,
    version: worldSimulationAutobiographicalLifePeriodVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    evidence_kind: decision.evidence_kind,
    life_period_id: decision.life_period_id,
    period_descriptor: cloneJson(decision.period_descriptor),
    period_descriptor_hash: decision.period_descriptor_hash,
    source_life_event_refs: cloneJson(decision.source_life_event_refs),
    source_personal_semantic_refs: cloneJson(decision.source_personal_semantic_refs),
    resolver_view_hash: decision.resolver_view_hash,
    previous_organization_event_id: previousCharacterEvent?.organization_event_id ?? null,
    previous_organization_event_hash: previousCharacterEvent?.organization_event_hash ?? null,
    previous_period_event_id: previousPeriodEvent?.organization_event_id ?? null,
    previous_period_event_hash: previousPeriodEvent?.organization_event_hash ?? null,
    organization_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      resolver_view_ref: `phase67d_resolver_view:${decision.resolver_view_hash}`,
      binding_source_ref: decision.evidence_kind === "explicit_programmatic_binding"
        ? `phase67d_resolver_view:${decision.resolver_view_hash}`
        : null,
      binding_source_hash: decision.evidence_kind === "explicit_programmatic_binding"
        ? decision.resolver_view_hash
        : null,
      temporal_adjacency_alone_used: false,
      calendar_bucket_used: false,
      fixed_duration_threshold_used: false,
      freeform_llm_period_authority_used: false,
      current_turn_autobiographical_trigger_required: true,
      overlapping_periods_allowed: true,
      many_to_many_life_event_membership: true,
    },
    source_semantics: {
      phase67b_life_event_evidence_allowed: true,
      phase67c_personal_semantic_evidence_allowed: true,
      temporal_proximity_is_supporting_only: true,
      calendar_bucket_is_membership_authority: false,
      cultural_life_script_assumption_used: false,
      one_primary_period_parent_per_life_event: false,
      life_event_content_copied: false,
      personal_semantic_content_copied: false,
      memory_content_copied: false,
      self_model_modeled: false,
      belief_revision_modeled: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    confidence: null,
    probability: null,
    life_event_content_copied: false,
    personal_semantic_content_copied: false,
    memory_content_copied: false,
    character_brain_direct_write: false,
    status: "autobiographical_life_period_organization_recorded",
  };
  const eventId = `autobiographical_life_period_organization_event_${hashAgentRunValue({
    version: worldSimulationAutobiographicalLifePeriodVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    life_period_id: decision.life_period_id,
    period_descriptor_hash: decision.period_descriptor_hash,
    source_life_event_refs: decision.source_life_event_refs,
    source_personal_semantic_refs: decision.source_personal_semantic_refs,
    previous_organization_event_hash: base.previous_organization_event_hash,
    previous_period_event_hash: base.previous_period_event_hash,
  }).slice(0, 24)}`;
  const event = {
    ...base,
    organization_event_id: eventId,
  };
  event.organization_event_hash = lifePeriodOrganizationEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: autobiographicalLifePeriodOrganizationHistoryReferenceSchemaVersion,
    derived_index: true,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    life_period_id: event.life_period_id,
    previous_organization_event_id: event.previous_organization_event_id,
    previous_organization_event_hash: event.previous_organization_event_hash,
    previous_period_event_id: event.previous_period_event_id,
    previous_period_event_hash: event.previous_period_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationAutobiographicalLifePeriodContract() {
  return deepFreeze({
    version: worldSimulationAutobiographicalLifePeriodVersion,
    phase: "Phase67D",
    status: "autobiographical_life_period_organization_installed",
    source_owners: ["Phase67B", "Phase67C"],
    supported_operations: [...supportedOperations],
    supported_evidence_kinds: [...supportedEvidenceKinds],
    overlapping_periods_allowed: true,
    many_to_many_life_event_membership: true,
    one_primary_period_parent_per_life_event: false,
    temporal_adjacency_alone_is_sufficient: false,
    calendar_bucket_is_sufficient: false,
    fixed_duration_threshold_modeled: false,
    explicit_programmatic_binding_provenance_verified: true,
    personal_semantic_support_requires_materialized_phase67c_evidence: true,
    current_turn_autobiographical_trigger_required: true,
    missing_resolver_means_no_period_organization: true,
    immutable_organization_events_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    per_period_event_hash_chain_required: true,
    closed_period_reopen_modeled: false,
    split_merge_revision_semantics_deferred: true,
    effective_projection_replayable: true,
    effective_projection_version: effectiveAutobiographicalLifePeriodProjectionVersion,
    source_life_event_content_copied: false,
    source_personal_semantic_content_copied: false,
    source_memory_content_copied: false,
    cultural_life_script_assumptions_used: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    last_write_wins_allowed: false,
    freeform_llm_period_authority: false,
    belief_engine_duplicated: false,
    self_model_modeled: false,
    separate_retrieval_engine_installed: false,
    phase63_phase64_retrieval_substrate_reused: true,
    character_brain_direct_durable_write_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationAutobiographicalLifePeriodOrganizations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const sourceOrganizationEventIds = array(input.source_organization_event_ids);
  const sourceSemanticDerivationEventIds = array(input.source_semantic_derivation_event_ids);
  const rawDecisions = array(input.organization_decisions);
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    source_semantic_derivation_event_ids: sourceSemanticDerivationEventIds,
    organization_decisions: rawDecisions,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  currentSourceSets(
    worldState,
    turnId,
    sourceOrganizationEventIds,
    sourceSemanticDerivationEventIds,
  );
  const resolverView = buildWorldSimulationAutobiographicalLifePeriodResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    source_semantic_derivation_event_ids: sourceSemanticDerivationEventIds,
  });
  const existing = validateExistingLifePeriodHistory(worldState);
  const existingProjection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
    world_state: worldState,
  });
  const decisions = rawDecisions.map((raw) =>
    normalizeDecision(worldState, raw, resolverView, existingProjection),
  );

  const preview = cloneJson(worldState);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  const latestByCharacter = new Map(existing.latestByCharacter);
  const latestByPeriod = new Map(existing.latestByPeriod);
  const seenPeriodOperationInTurn = new Set();

  for (const decision of decisions) {
    const operationKey = `${decision.life_period_id}\u0000${decision.operation}`;
    if (seenPeriodOperationInTurn.has(operationKey)) {
      const error = new Error(`Duplicate Phase67D ${decision.operation} decision for ${decision.life_period_id}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DECISION_DUPLICATE";
      throw error;
    }
    seenPeriodOperationInTurn.add(operationKey);
    const previousCharacterEvent = latestByCharacter.get(characterKey(decision.character)) ?? null;
    const previousPeriodEvent = latestByPeriod.get(decision.life_period_id) ?? null;
    if (previousPeriodEvent?.operation === "close_period") {
      const error = new Error(`Closed LifePeriod ${decision.life_period_id} cannot be mutated.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CLOSED_PERIOD_MUTATION_FORBIDDEN";
      throw error;
    }
    const event = organizationEventFor({
      decision,
      previousCharacterEvent,
      previousPeriodEvent,
      turnId,
    });
    const collision = object(existing.events[event.organization_event_id]);
    if (Object.keys(collision).length) {
      assertPersistedLifePeriodEvent(collision, event.organization_event_id, worldState);
      if (!sameValue(collision, event)) {
        const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${event.organization_event_id} already exists with different immutable content.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      continue;
    }
    preview.autobiographical_life_period_organization_events = object(
      preview.autobiographical_life_period_organization_events,
    );
    preview.autobiographical_life_period_organization_events[event.organization_event_id] =
      cloneJson(event);
    createdEvents.push(event);
    const reference = historyReferenceFor(event);
    appendedReferences.push(reference);
    latestByCharacter.set(characterKey(event.character), event);
    latestByPeriod.set(event.life_period_id, event);
    stateTransitions.push({
      entity: "world",
      field: `autobiographical_life_period_organization_events.${event.organization_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable AutobiographicalLifePeriodOrganizationEvent ${event.organization_event_id}`,
      source_layer: "autobiographical_life_period_organization",
    });
  }

  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.autobiographical_life_period_organization_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "autobiographical_life_period_organization_history",
      from: cloneJson(worldState.autobiographical_life_period_organization_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase67D LifePeriod organization history reference(s)`,
      source_layer: "autobiographical_life_period_organization",
    });
  }

  const effectiveProjection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
    world_state: preview,
  });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase67D LifePeriod organization mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationAutobiographicalLifePeriodVersion,
    result: {
      processed_current_life_event_update_count: sourceOrganizationEventIds.length,
      processed_current_personal_semantic_update_count: sourceSemanticDerivationEventIds.length,
      organization_decision_count: decisions.length,
      organization_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      effective_life_period_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        same_character_evidence_only: true,
        current_turn_autobiographical_trigger_required: true,
        overlapping_periods_allowed: true,
        many_to_many_life_event_membership: true,
        one_primary_period_parent_per_life_event: false,
        temporal_adjacency_alone_used_for_membership: false,
        calendar_bucket_used_for_membership: false,
        fixed_duration_threshold_used: false,
        cultural_life_script_assumptions_used: false,
        freeform_llm_period_authority_used: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}
