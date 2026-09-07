import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  autobiographicalLifeEventOrganizationEventSchemaVersion,
  autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion,
  projectWorldSimulationEffectiveAutobiographicalLifeEvents,
  worldSimulationAutobiographicalLifeEventVersion,
} from "./world-simulation-autobiographical-life-event-service.mjs";

export const worldSimulationPersonalSemanticMemoryVersion =
  "phase67c-personal-semantic-memory-v1";

export const personalSemanticDerivationEventSchemaVersion =
  "phase67c-personal-semantic-derivation-event-v1";

export const personalSemanticDerivationHistoryReferenceSchemaVersion =
  "phase67c-personal-semantic-derivation-history-ref-v1";

export const effectivePersonalSemanticMemoryProjectionVersion =
  "phase67c-effective-personal-semantic-memory-projection-v1";

const supportedCategories = Object.freeze([
  "recurring_event_pattern",
  "autobiographical_fact",
]);

const supportedOperations = Object.freeze([
  "form",
  "support",
  "counterevidence",
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
  code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_INPUT_INVALID",
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

function derivationEventHash(event) {
  const body = cloneJson(event);
  delete body.derivation_event_hash;
  return hashAgentRunValue(body);
}

function normalizeSemanticDescriptor(value) {
  if (!isObject(value)) {
    const error = new Error("semantic_descriptor must be an object.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
    throw error;
  }
  const predicate = requiredString(
    value.predicate,
    "semantic_descriptor.predicate",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID",
  );
  const objectRef = requiredString(
    value.object_ref,
    "semantic_descriptor.object_ref",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID",
  );
  if (predicate.length > 160 || objectRef.length > 320) {
    const error = new Error("Personal semantic descriptor exceeds the bounded v1 shape.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
    throw error;
  }
  const qualifiers = array(value.qualifiers).map((item, index) => {
    const text = requiredString(
      item,
      `semantic_descriptor.qualifiers[${index}]`,
      "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID",
    );
    if (text.length > 160) {
      const error = new Error("Personal semantic qualifier exceeds the bounded v1 shape.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
      throw error;
    }
    return text;
  }).sort(compareText);
  if (qualifiers.length > 16 || new Set(qualifiers).size !== qualifiers.length) {
    const error = new Error("Personal semantic qualifiers must be unique and bounded.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
    throw error;
  }
  return {
    subject_scope: "self_autobiographical_experience",
    predicate,
    object_ref: objectRef,
    qualifiers,
  };
}

function assertCanonicalOrganizationEvent(worldState, eventId) {
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
    const error = new Error(`Phase67C cannot resolve canonical Phase67B event ${eventId}.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_LIFE_EVENT_INVALID";
    throw error;
  }
  if (organizationEventHash(event) !== event.organization_event_hash) {
    const error = new Error(`Phase67B source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_LIFE_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function normalizeLifeEventRefs(worldState, value, expectedCharacter) {
  const refs = array(value).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`source_life_event_refs[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_INVALID";
      throw error;
    }
    const organizationEventId = requiredString(
      item.organization_event_id,
      `source_life_event_refs[${index}].organization_event_id`,
      "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_INVALID",
    );
    const event = assertCanonicalOrganizationEvent(worldState, organizationEventId);
    if (!sameCharacter(event.character, expectedCharacter)) {
      const error = new Error("Personal semantic evidence may use only same-character LifeEvents.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_CROSS_CHARACTER_EVIDENCE_FORBIDDEN";
      throw error;
    }
    const normalized = {
      life_event_id: requiredString(
        item.life_event_id,
        `source_life_event_refs[${index}].life_event_id`,
        "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_INVALID",
      ),
      organization_event_id: organizationEventId,
      organization_event_hash: requiredString(
        item.organization_event_hash,
        `source_life_event_refs[${index}].organization_event_hash`,
        "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_INVALID",
      ),
    };
    if (
      normalized.life_event_id !== event.life_event_id
      || normalized.organization_event_hash !== event.organization_event_hash
    ) {
      const error = new Error("Personal semantic evidence does not pin canonical Phase67B LifeEvent provenance.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_MISMATCH";
      throw error;
    }
    return normalized;
  });
  refs.sort((left, right) => {
    const life = compareText(left.life_event_id, right.life_event_id);
    if (life !== 0) return life;
    return compareText(left.organization_event_id, right.organization_event_id);
  });
  const keys = refs.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  );
  if (new Set(keys).size !== keys.length) {
    const error = new Error("Personal semantic LifeEvent evidence contains duplicates.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_DUPLICATE";
    throw error;
  }
  return refs;
}

function assertPersistedDerivationEvent(event, eventId, worldState) {
  if (
    !isObject(event)
    || event.schema_version !== personalSemanticDerivationEventSchemaVersion
    || event.version !== worldSimulationPersonalSemanticMemoryVersion
    || event.immutable !== true
    || event.derivation_event_id !== eventId
    || !optionalString(event.derivation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !supportedOperations.includes(event.operation)
    || !supportedCategories.includes(event.semantic_category)
    || !optionalString(event.semantic_memory_id)
    || !optionalString(event.semantic_key)
    || !optionalString(event.semantic_descriptor_hash)
    || !optionalString(event.resolver_view_hash)
    || event.status !== "personal_semantic_derivation_recorded"
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_acceptance_decided !== false
    || event.belief_engine_used !== false
    || event.confidence !== null
    || event.probability !== null
    || event.memory_content_copied !== false
    || event.episode_content_copied !== false
    || event.life_event_content_copied !== false
    || event.character_brain_direct_write !== false
  ) {
    const error = new Error(`PersonalSemanticDerivationEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_INVALID";
    throw error;
  }
  const descriptor = normalizeSemanticDescriptor(event.semantic_descriptor);
  if (
    !sameValue(descriptor, event.semantic_descriptor)
    || hashAgentRunValue(descriptor) !== event.semantic_descriptor_hash
    || derivationEventHash(event) !== event.derivation_event_hash
  ) {
    const error = new Error(`PersonalSemanticDerivationEvent ${eventId} failed immutable verification.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_HASH_MISMATCH";
    throw error;
  }
  const sourceRefs = normalizeLifeEventRefs(
    worldState,
    event.source_life_event_refs,
    event.character,
  );
  const currentTurnAnchored = sourceRefs.some((item) => {
    const sourceEvent = object(
      object(worldState.autobiographical_life_event_organization_events)[
        item.organization_event_id
      ],
    );
    return sourceEvent.source_turn_id === event.source_turn_id;
  });
  if (!currentTurnAnchored) {
    const error = new Error(
      `PersonalSemanticDerivationEvent ${eventId} is not anchored in a current-turn Phase67B LifeEvent update.`,
    );
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  return event;
}

function validateExistingSemanticHistory(worldState) {
  if (
    Object.hasOwn(worldState, "personal_semantic_derivation_events")
    && !isObject(worldState.personal_semantic_derivation_events)
  ) {
    const error = new Error("personal_semantic_derivation_events must be an object.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_STORE_INVALID";
    throw error;
  }
  if (
    Object.hasOwn(worldState, "personal_semantic_derivation_history")
    && !Array.isArray(worldState.personal_semantic_derivation_history)
  ) {
    const error = new Error("personal_semantic_derivation_history must be an array.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.personal_semantic_derivation_events);
  const history = array(worldState.personal_semantic_derivation_history);
  const latestByCharacter = new Map();
  const latestBySemantic = new Map();
  const seenEventIds = new Set();

  for (const [index, reference] of history.entries()) {
    if (
      !isObject(reference)
      || reference.schema_version !== personalSemanticDerivationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !optionalString(reference.derivation_event_id)
      || !optionalString(reference.derivation_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.semantic_memory_id)
      || !supportedOperations.includes(reference.operation)
      || reference.status !== "personal_semantic_derivation_recorded"
    ) {
      const error = new Error(`personal_semantic_derivation_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const eventId = reference.derivation_event_id;
    if (seenEventIds.has(eventId)) {
      const error = new Error(`Duplicate personal semantic derivation event ${eventId}.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }
    const event = assertPersistedDerivationEvent(events[eventId], eventId, worldState);
    const character = characterKey(event.character);
    const previousCharacterEvent = latestByCharacter.get(character) ?? null;
    const previousSemanticEvent = latestBySemantic.get(event.semantic_memory_id) ?? null;
    if (
      reference.derivation_event_hash !== event.derivation_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.semantic_memory_id !== event.semantic_memory_id
      || reference.operation !== event.operation
      || reference.previous_derivation_event_id !== event.previous_derivation_event_id
      || reference.previous_derivation_event_hash !== event.previous_derivation_event_hash
      || reference.previous_semantic_event_id !== event.previous_semantic_event_id
      || reference.previous_semantic_event_hash !== event.previous_semantic_event_hash
      || event.previous_derivation_event_id !== (previousCharacterEvent?.derivation_event_id ?? null)
      || event.previous_derivation_event_hash !== (previousCharacterEvent?.derivation_event_hash ?? null)
      || event.previous_semantic_event_id !== (previousSemanticEvent?.derivation_event_id ?? null)
      || event.previous_semantic_event_hash !== (previousSemanticEvent?.derivation_event_hash ?? null)
      || (event.operation === "form" && previousSemanticEvent !== null)
      || (event.operation !== "form" && previousSemanticEvent === null)
    ) {
      const error = new Error(`Personal semantic reference ${eventId} breaks its canonical chain.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (previousSemanticEvent) {
      if (
        event.semantic_category !== previousSemanticEvent.semantic_category
        || event.semantic_key !== previousSemanticEvent.semantic_key
        || event.semantic_descriptor_hash !== previousSemanticEvent.semantic_descriptor_hash
        || !sameValue(event.semantic_descriptor, previousSemanticEvent.semantic_descriptor)
      ) {
        const error = new Error(`Personal semantic identity ${event.semantic_memory_id} was rewritten.`);
        error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_REWRITE_FORBIDDEN";
        throw error;
      }
    }
    seenEventIds.add(eventId);
    latestByCharacter.set(character, event);
    latestBySemantic.set(event.semantic_memory_id, event);
  }

  return {
    events,
    history,
    latestByCharacter,
    latestBySemantic,
  };
}

export function projectWorldSimulationEffectivePersonalSemanticMemories(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateExistingSemanticHistory(worldState);
  const memoriesByCharacter = {};

  for (const reference of existing.history) {
    const event = existing.events[reference.derivation_event_id];
    const character = event.character;
    if (!isObject(memoriesByCharacter[character])) memoriesByCharacter[character] = {};
    const prior = object(memoriesByCharacter[character][event.semantic_memory_id]);
    const supportRefs = array(prior.support_life_event_refs).map(cloneJson);
    const counterRefs = array(prior.counterevidence_life_event_refs).map(cloneJson);
    const supportKeys = new Set(supportRefs.map((item) =>
      `${item.life_event_id}\u0000${item.organization_event_id}`,
    ));
    const counterKeys = new Set(counterRefs.map((item) =>
      `${item.life_event_id}\u0000${item.organization_event_id}`,
    ));
    const target = event.operation === "counterevidence" ? counterRefs : supportRefs;
    const targetKeys = event.operation === "counterevidence" ? counterKeys : supportKeys;
    for (const item of array(event.source_life_event_refs)) {
      const key = `${item.life_event_id}\u0000${item.organization_event_id}`;
      if (!targetKeys.has(key)) {
        target.push(cloneJson(item));
        targetKeys.add(key);
      }
    }
    supportRefs.sort((left, right) => compareText(left.organization_event_id, right.organization_event_id));
    counterRefs.sort((left, right) => compareText(left.organization_event_id, right.organization_event_id));
    memoriesByCharacter[character][event.semantic_memory_id] = {
      semantic_memory_id: event.semantic_memory_id,
      character,
      semantic_category: event.semantic_category,
      semantic_key: event.semantic_key,
      semantic_descriptor: cloneJson(event.semantic_descriptor),
      semantic_descriptor_hash: event.semantic_descriptor_hash,
      support_life_event_refs: supportRefs,
      counterevidence_life_event_refs: counterRefs,
      derivation_event_ids: [
        ...array(prior.derivation_event_ids),
        event.derivation_event_id,
      ],
      first_derivation_event_id:
        prior.first_derivation_event_id ?? event.derivation_event_id,
      latest_derivation_event_id: event.derivation_event_id,
      state: counterRefs.length ? "contested" : "supported",
      subjective_not_world_truth: true,
      epistemic_acceptance_decided: false,
      confidence: null,
      probability: null,
      memory_content_duplicated: false,
      episode_content_duplicated: false,
      life_event_content_duplicated: false,
    };
  }

  const projection = {
    version: effectivePersonalSemanticMemoryProjectionVersion,
    source_version: worldSimulationPersonalSemanticMemoryVersion,
    memories_by_character: memoriesByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    experience_near_only: true,
    supported_categories: [...supportedCategories],
    traits_modeled: false,
    role_identity_modeled: false,
    values_modeled: false,
    preferences_modeled: false,
    self_model_modeled: false,
    belief_authority_claimed: false,
    world_truth_authority_claimed: false,
    character_brain_exposure_installed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function currentOrganizationEventIds(worldState, sourceOrganizationEventIds, turnId) {
  const wanted = new Set(
    array(sourceOrganizationEventIds)
      .map((value) => requiredString(value, "source_organization_event_id")),
  );
  const ordered = [];
  for (const reference of array(worldState.autobiographical_life_event_organization_history)) {
    const eventId = optionalString(reference?.organization_event_id);
    if (!eventId || !wanted.has(eventId)) continue;
    const event = assertCanonicalOrganizationEvent(worldState, eventId);
    if (event.source_turn_id !== turnId) {
      const error = new Error(`Phase67C source LifeEvent event ${eventId} is not from turn ${turnId}.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_TURN_MISMATCH";
      throw error;
    }
    ordered.push(eventId);
    wanted.delete(eventId);
  }
  if (wanted.size) {
    const error = new Error(`Phase67C cannot resolve current Phase67B source event(s): ${[...wanted].join(", ")}.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_LIFE_EVENT_UNRESOLVED";
    throw error;
  }
  return ordered;
}

function lifeEventEvidenceSurface(worldState) {
  const refs = [];
  for (const reference of array(worldState.autobiographical_life_event_organization_history)) {
    const event = assertCanonicalOrganizationEvent(
      worldState,
      requiredString(reference?.organization_event_id, "organization_event_id"),
    );
    if (
      reference.schema_version !== autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion
      || reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.life_event_id !== event.life_event_id
    ) {
      const error = new Error("Phase67C encountered a non-canonical Phase67B history reference.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_LIFE_EVENT_HISTORY_INVALID";
      throw error;
    }
    refs.push({
      character: event.character,
      source_turn_id: event.source_turn_id,
      life_event_id: event.life_event_id,
      organization_event_id: event.organization_event_id,
      organization_event_hash: event.organization_event_hash,
      organization_resolution: event.resolution,
    });
  }
  return refs;
}

export function buildWorldSimulationPersonalSemanticMemoryResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const currentIds = currentOrganizationEventIds(
    worldState,
    input.source_organization_event_ids,
    turnId,
  );
  const effectiveLifeEvents = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
    world_state: worldState,
  });
  const effectiveSemantic = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: worldState,
  });
  const availableEvidence = lifeEventEvidenceSurface(worldState);
  const currentSet = new Set(currentIds);
  const view = {
    version: worldSimulationPersonalSemanticMemoryVersion,
    turn_id: turnId,
    current_life_event_updates: availableEvidence.filter((item) =>
      currentSet.has(item.organization_event_id),
    ),
    available_life_event_evidence_refs: availableEvidence,
    effective_life_event_projection_hash: effectiveLifeEvents.projection_hash,
    effective_personal_semantic_projection: cloneJson(effectiveSemantic.memories_by_character),
    effective_personal_semantic_projection_hash: effectiveSemantic.projection_hash,
    supported_operations: [...supportedOperations],
    supported_categories: [...supportedCategories],
    recurring_event_pattern_requires_distinct_life_events: true,
    recurring_event_pattern_auto_promoted_by_count: false,
    eager_semanticization: false,
    traits_exposed_for_authoring: false,
    role_identity_exposed_for_authoring: false,
    values_exposed_for_authoring: false,
    preferences_exposed_for_authoring: false,
    self_model_exposed_for_authoring: false,
    world_state_exposed: false,
    raw_world_event_exposed: false,
    memory_content_exposed: false,
    episode_content_exposed: false,
    life_event_content_exposed: false,
    world_truth_judgment_requested: false,
    epistemic_acceptance_requested: false,
    confidence_probability_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeDecision(worldState, raw, resolverView, existingProjection) {
  if (!isObject(raw)) {
    const error = new Error("Personal semantic decision must be an object.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID";
    throw error;
  }
  const character = requiredString(
    raw.character,
    "personal semantic decision character",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID",
  );
  const operation = requiredString(
    raw.operation,
    "personal semantic operation",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID",
  );
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported personal semantic operation: ${operation}.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID";
    throw error;
  }
  const semanticCategory = requiredString(
    raw.semantic_category,
    "semantic_category",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID",
  );
  if (!supportedCategories.includes(semanticCategory)) {
    const error = new Error(`Unsupported Phase67C v1 semantic category: ${semanticCategory}.`);
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_CATEGORY_UNSUPPORTED";
    throw error;
  }
  const semanticKey = requiredString(
    raw.semantic_key,
    "semantic_key",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID",
  );
  if (semanticKey.length > 240) {
    const error = new Error("semantic_key exceeds the bounded Phase67C v1 shape.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_INVALID";
    throw error;
  }
  const sourceRefs = normalizeLifeEventRefs(
    worldState,
    raw.source_life_event_refs,
    character,
  );
  if (!sourceRefs.length) {
    const error = new Error("Personal semantic derivation requires source LifeEvent evidence.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REQUIRED";
    throw error;
  }
  const resolverViewHash = requiredString(
    raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_RESOLVER_VIEW_HASH_REQUIRED",
  );
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Personal semantic decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const availableKeys = new Set(
    resolverView.available_life_event_evidence_refs.map((item) =>
      `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
    ),
  );
  if (sourceRefs.some((item) => !availableKeys.has(
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  ))) {
    const error = new Error("Personal semantic decision references LifeEvent evidence outside the resolver view.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_OUT_OF_VIEW";
    throw error;
  }
  const currentUpdateKeys = new Set(
    resolverView.current_life_event_updates.map((item) =>
      `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
    ),
  );
  if (!sourceRefs.some((item) => currentUpdateKeys.has(
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  ))) {
    const error = new Error(
      "Personal semantic derivation must be triggered by at least one current-turn Phase67B LifeEvent update.",
    );
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }

  let descriptor = raw.semantic_descriptor
    ? normalizeSemanticDescriptor(raw.semantic_descriptor)
    : null;
  let semanticMemoryId = optionalString(raw.semantic_memory_id);
  const existingCharacter = object(existingProjection.memories_by_character?.[character]);
  if (!Object.keys(existingCharacter).length) {
    const wanted = characterKey(character);
    for (const [name, items] of Object.entries(existingProjection.memories_by_character ?? {})) {
      if (characterKey(name) === wanted) {
        Object.assign(existingCharacter, object(items));
        break;
      }
    }
  }

  let existingSemantic = semanticMemoryId
    ? existingCharacter[semanticMemoryId] ?? null
    : null;
  if (!existingSemantic && operation !== "form") {
    existingSemantic = Object.values(existingCharacter).find((item) =>
      item.semantic_key === semanticKey && item.semantic_category === semanticCategory,
    ) ?? null;
    semanticMemoryId = existingSemantic?.semantic_memory_id ?? null;
  }

  if (operation === "form") {
    if (!descriptor) {
      const error = new Error("Forming personal semantic memory requires a structured semantic_descriptor.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_REQUIRED";
      throw error;
    }
    const descriptorHash = hashAgentRunValue(descriptor);
    const expectedId = `personal_semantic_memory_${hashAgentRunValue({
      version: worldSimulationPersonalSemanticMemoryVersion,
      character: characterKey(character),
      semantic_category: semanticCategory,
      semantic_key: semanticKey,
      semantic_descriptor_hash: descriptorHash,
    }).slice(0, 24)}`;
    if (semanticMemoryId && semanticMemoryId !== expectedId) {
      const error = new Error("Personal semantic memory ID does not match its deterministic identity.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_MISMATCH";
      throw error;
    }
    semanticMemoryId = expectedId;
    if (existingCharacter[semanticMemoryId]) {
      const error = new Error(`Personal semantic memory ${semanticMemoryId} already exists.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DUPLICATE_FORMATION";
      throw error;
    }
    if (semanticCategory === "recurring_event_pattern") {
      const distinctLifeEvents = new Set(sourceRefs.map((item) => item.life_event_id));
      if (distinctLifeEvents.size < 2) {
        const error = new Error("A recurring-event semantic pattern requires evidence from at least two distinct LifeEvents, but is never auto-promoted by count alone.");
        error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_RECURRING_PATTERN_DISTINCT_EVENTS_REQUIRED";
        throw error;
      }
    }
  } else {
    if (!existingSemantic || !semanticMemoryId) {
      const error = new Error("Support/counterevidence requires an existing personal semantic memory.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_TARGET_UNRESOLVED";
      throw error;
    }
    if (
      existingSemantic.semantic_key !== semanticKey
      || existingSemantic.semantic_category !== semanticCategory
    ) {
      const error = new Error("Support/counterevidence cannot rewrite personal semantic identity.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
    descriptor = normalizeSemanticDescriptor(existingSemantic.semantic_descriptor);
    if (raw.semantic_descriptor && !sameValue(
      descriptor,
      normalizeSemanticDescriptor(raw.semantic_descriptor),
    )) {
      const error = new Error("Support/counterevidence cannot rewrite the semantic descriptor.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
  }

  return {
    character,
    operation,
    semantic_category: semanticCategory,
    semantic_key: semanticKey,
    semantic_memory_id: semanticMemoryId,
    semantic_descriptor: descriptor,
    semantic_descriptor_hash: hashAgentRunValue(descriptor),
    source_life_event_refs: sourceRefs,
    resolver_view_hash: resolverViewHash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_personal_semantic_derivation",
    source: optionalString(raw.source) ?? "programmatic_personal_semantic_memory_resolver",
  };
}

function derivationEventFor({ decision, previousCharacterEvent, previousSemanticEvent, turnId }) {
  const base = {
    schema_version: personalSemanticDerivationEventSchemaVersion,
    version: worldSimulationPersonalSemanticMemoryVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    semantic_memory_id: decision.semantic_memory_id,
    semantic_category: decision.semantic_category,
    semantic_key: decision.semantic_key,
    semantic_descriptor: cloneJson(decision.semantic_descriptor),
    semantic_descriptor_hash: decision.semantic_descriptor_hash,
    source_life_event_refs: cloneJson(decision.source_life_event_refs),
    resolver_view_hash: decision.resolver_view_hash,
    previous_derivation_event_id: previousCharacterEvent?.derivation_event_id ?? null,
    previous_derivation_event_hash: previousCharacterEvent?.derivation_event_hash ?? null,
    previous_semantic_event_id: previousSemanticEvent?.derivation_event_id ?? null,
    previous_semantic_event_hash: previousSemanticEvent?.derivation_event_hash ?? null,
    derivation_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      resolver_view_ref: `phase67c_resolver_view:${decision.resolver_view_hash}`,
      eager_semanticization_used: false,
      recurrence_count_auto_promoted: false,
      numeric_confidence_threshold_used: false,
      freeform_llm_reflection_authority_used: false,
      same_character_life_event_evidence_only: true,
      current_turn_life_event_trigger_required: true,
    },
    source_semantics: {
      phase67b_life_event_evidence_is_authoritative_source: true,
      experience_near_personal_semantics_only: true,
      traits_modeled: false,
      role_identity_modeled: false,
      values_modeled: false,
      preferences_modeled: false,
      self_model_modeled: false,
      belief_revision_modeled: false,
      memory_content_copied: false,
      episode_content_copied: false,
      life_event_content_copied: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    epistemic_acceptance_decided: false,
    belief_engine_used: false,
    confidence: null,
    probability: null,
    memory_content_copied: false,
    episode_content_copied: false,
    life_event_content_copied: false,
    character_brain_direct_write: false,
    status: "personal_semantic_derivation_recorded",
  };
  const eventId = `personal_semantic_derivation_event_${hashAgentRunValue({
    version: worldSimulationPersonalSemanticMemoryVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    semantic_memory_id: decision.semantic_memory_id,
    semantic_descriptor_hash: decision.semantic_descriptor_hash,
    source_life_event_refs: decision.source_life_event_refs,
    previous_derivation_event_hash: base.previous_derivation_event_hash,
    previous_semantic_event_hash: base.previous_semantic_event_hash,
  }).slice(0, 24)}`;
  const event = {
    ...base,
    derivation_event_id: eventId,
  };
  event.derivation_event_hash = derivationEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: personalSemanticDerivationHistoryReferenceSchemaVersion,
    derived_index: true,
    derivation_event_id: event.derivation_event_id,
    derivation_event_hash: event.derivation_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    semantic_memory_id: event.semantic_memory_id,
    previous_derivation_event_id: event.previous_derivation_event_id,
    previous_derivation_event_hash: event.previous_derivation_event_hash,
    previous_semantic_event_id: event.previous_semantic_event_id,
    previous_semantic_event_hash: event.previous_semantic_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationPersonalSemanticMemoryContract() {
  return deepFreeze({
    version: worldSimulationPersonalSemanticMemoryVersion,
    phase: "Phase67C",
    status: "experience_near_personal_semantic_memory_installed",
    source_owner: "Phase67B",
    source_projection: "autobiographical_life_event_organization",
    supported_categories: [...supportedCategories],
    supported_operations: [...supportedOperations],
    experience_near_only: true,
    recurring_event_pattern_requires_distinct_life_events: true,
    recurring_event_pattern_auto_promoted_by_count: false,
    eager_semanticization_allowed: false,
    semanticization_requires_explicit_programmatic_decision: true,
    current_turn_life_event_trigger_required: true,
    same_character_life_event_evidence_only: true,
    immutable_derivation_events_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    per_semantic_memory_event_hash_chain_required: true,
    effective_projection_replayable: true,
    effective_projection_version: effectivePersonalSemanticMemoryProjectionVersion,
    counterevidence_preserved_without_epistemic_resolution: true,
    contradictory_candidates_silently_collapsed: false,
    trait_inference_modeled: false,
    role_identity_modeled: false,
    value_inference_modeled: false,
    preference_inference_modeled: false,
    self_model_modeled: false,
    belief_engine_duplicated: false,
    epistemic_acceptance_owner: "Phase65/66",
    source_life_event_content_copied: false,
    source_episode_content_copied: false,
    source_memory_content_copied: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    last_write_wins_allowed: false,
    freeform_llm_reflection_authority: false,
    separate_retrieval_engine_installed: false,
    phase63_phase64_retrieval_substrate_reused: true,
    character_brain_direct_durable_write_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationPersonalSemanticMemoryDerivations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const sourceIds = array(input.source_organization_event_ids);
  const rawDecisions = array(input.semantic_decisions);
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceIds,
    semantic_decisions: rawDecisions,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  currentOrganizationEventIds(worldState, sourceIds, turnId);
  const resolverView = buildWorldSimulationPersonalSemanticMemoryResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceIds,
  });
  const existing = validateExistingSemanticHistory(worldState);
  const existingProjection = projectWorldSimulationEffectivePersonalSemanticMemories({
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
  const latestBySemantic = new Map(existing.latestBySemantic);
  const semanticSeenInTurn = new Set();

  for (const decision of decisions) {
    const perTurnKey = `${decision.operation}:${decision.semantic_memory_id}`;
    if (semanticSeenInTurn.has(perTurnKey)) {
      const error = new Error(`Duplicate Phase67C ${decision.operation} decision for ${decision.semantic_memory_id}.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DECISION_DUPLICATE";
      throw error;
    }
    semanticSeenInTurn.add(perTurnKey);
    const character = characterKey(decision.character);
    const previousCharacterEvent = latestByCharacter.get(character) ?? null;
    const previousSemanticEvent = latestBySemantic.get(decision.semantic_memory_id) ?? null;
    const event = derivationEventFor({
      decision,
      previousCharacterEvent,
      previousSemanticEvent,
      turnId,
    });
    if (object(existing.events)[event.derivation_event_id]) {
      const collision = assertPersistedDerivationEvent(
        existing.events[event.derivation_event_id],
        event.derivation_event_id,
        worldState,
      );
      if (!sameValue(collision, event)) {
        const error = new Error(`PersonalSemanticDerivationEvent ${event.derivation_event_id} already exists with different immutable content.`);
        error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      continue;
    }
    preview.personal_semantic_derivation_events = object(
      preview.personal_semantic_derivation_events,
    );
    preview.personal_semantic_derivation_events[event.derivation_event_id] = cloneJson(event);
    createdEvents.push(event);
    appendedReferences.push(historyReferenceFor(event));
    latestByCharacter.set(character, event);
    latestBySemantic.set(event.semantic_memory_id, event);
    stateTransitions.push({
      entity: "world",
      field: `personal_semantic_derivation_events.${event.derivation_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable PersonalSemanticDerivationEvent ${event.derivation_event_id}`,
      source_layer: "personal_semantic_memory",
    });
  }

  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.personal_semantic_derivation_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "personal_semantic_derivation_history",
      from: cloneJson(worldState.personal_semantic_derivation_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase67C personal semantic derivation history reference(s)`,
      source_layer: "personal_semantic_memory",
    });
  }

  const effectiveProjection = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: preview,
  });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase67C personal semantic derivation mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationPersonalSemanticMemoryVersion,
    result: {
      processed_current_life_event_update_count: sourceIds.length,
      semantic_decision_count: decisions.length,
      derivation_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view: resolverView,
      effective_personal_semantic_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        source_phase67b_events_hash_verified: true,
        current_turn_life_event_trigger_verified: true,
        same_character_life_event_evidence_only: true,
        eager_semanticization_used: false,
        recurring_event_pattern_auto_promoted_by_count: false,
        explicit_programmatic_decision_required: true,
        counterevidence_preserved_without_epistemic_resolution: true,
        contradictory_candidates_silently_collapsed: false,
        trait_inference_modeled: false,
        role_identity_modeled: false,
        value_inference_modeled: false,
        preference_inference_modeled: false,
        self_model_modeled: false,
        belief_engine_duplicated: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        memory_content_copied: false,
        episode_content_copied: false,
        life_event_content_copied: false,
        separate_retrieval_engine_installed: false,
        character_brain_direct_write_used: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}
