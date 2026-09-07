import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationAutobiographicalSelfInterpretationVersion =
  "phase68a-autobiographical-self-interpretation-v1";

export const autobiographicalSelfInterpretationEventSchemaVersion =
  "phase68a-autobiographical-self-interpretation-event-v1";

export const autobiographicalSelfInterpretationHistoryReferenceSchemaVersion =
  "phase68a-autobiographical-self-interpretation-history-ref-v1";

export const effectiveAutobiographicalSelfInterpretationProjectionVersion =
  "phase68a-effective-autobiographical-self-interpretation-projection-v1";

export const autobiographicalSelfInterpretationCharacterProjectionVersion =
  "phase68a-bounded-autobiographical-self-interpretation-character-projection-v1";

export const autobiographicalSelfInterpretationMaxCharacterItems = 8;
export const autobiographicalSelfInterpretationMaxResolverAnchorsPerCharacter = 64;

const supportedOperations = Object.freeze([
  "establish",
  "supersede",
]);

const supportedInterpretationKinds = Object.freeze([
  "continuity",
  "change",
  "causal_connection",
  "thematic_recurrence",
  "contrast",
]);

const supportedQualifiers = Object.freeze([
  "turning_point",
  "repeated_pattern",
  "before_after",
  "across_periods",
  "within_period",
  "counterpattern",
  "unresolved_tension",
  "contextual_change",
]);

const supportedSourceKinds = Object.freeze([
  "phase67b_life_event_organization",
  "phase67c_personal_semantic_derivation",
  "phase67d_life_period_organization",
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

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_INPUT_INVALID",
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

function uniqueSortedStrings(values) {
  return [...new Set(array(values).map((value) => optionalString(value)).filter(Boolean))]
    .sort(compareText);
}

function eventHash(event, hashField) {
  const body = cloneJson(event);
  delete body[hashField];
  return hashAgentRunValue(body);
}

function selfInterpretationEventHash(event) {
  return eventHash(event, "interpretation_event_hash");
}

function normalizedQualifiers(value) {
  const qualifiers = uniqueSortedStrings(value);
  if (qualifiers.length > 4) {
    const error = new Error("Phase68A interpretation qualifiers exceed the bounded v1 shape.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_QUALIFIERS_INVALID";
    throw error;
  }
  for (const qualifier of qualifiers) {
    if (!supportedQualifiers.includes(qualifier)) {
      const error = new Error(`Unsupported Phase68A interpretation qualifier: ${qualifier}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_QUALIFIER_UNSUPPORTED";
      throw error;
    }
  }
  return qualifiers;
}

function sourceRefKey(reference) {
  return [
    reference?.source_kind ?? null,
    reference?.source_event_id ?? null,
    reference?.source_event_hash ?? null,
  ].join("\u0000");
}

function safeSemanticAnchorView(event) {
  const descriptor = object(event.semantic_descriptor);
  return {
    source_kind: "personal_semantic",
    category: event.semantic_category,
    predicate: descriptor.predicate ?? null,
    object: descriptor.object_ref ?? null,
    qualifiers: cloneJson(array(descriptor.qualifiers)),
    subjective_not_world_truth: true,
  };
}

function safeLifePeriodAnchorView(event) {
  const descriptor = object(event.period_descriptor);
  return {
    source_kind: "life_period",
    description: descriptor.period_key ?? null,
    qualifiers: cloneJson(array(descriptor.qualifiers)),
    state_change: event.operation ?? null,
    subjective_not_world_truth: true,
  };
}

function safeLifeEventAnchorView() {
  return {
    source_kind: "life_event",
    subjective_not_world_truth: true,
  };
}

function validatePhase67BEvent(worldState, eventId) {
  const event = object(
    object(worldState.autobiographical_life_event_organization_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.immutable !== true
    || event.organization_event_id !== eventId
    || !optionalString(event.organization_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.memory_content_copied !== false
    || event.episode_content_copied !== false
  ) {
    const error = new Error(`Phase68A cannot resolve canonical Phase67B event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67B_SOURCE_INVALID";
    throw error;
  }
  if (eventHash(event, "organization_event_hash") !== event.organization_event_hash) {
    const error = new Error(`Phase67B source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67B_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validatePhase67CEvent(worldState, eventId) {
  const event = object(
    object(worldState.personal_semantic_derivation_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.immutable !== true
    || event.derivation_event_id !== eventId
    || !optionalString(event.derivation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.semantic_memory_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_acceptance_decided !== false
    || event.belief_engine_used !== false
  ) {
    const error = new Error(`Phase68A cannot resolve canonical Phase67C event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67C_SOURCE_INVALID";
    throw error;
  }
  if (eventHash(event, "derivation_event_hash") !== event.derivation_event_hash) {
    const error = new Error(`Phase67C source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67C_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validatePhase67DEvent(worldState, eventId) {
  const event = object(
    object(worldState.autobiographical_life_period_organization_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.immutable !== true
    || event.organization_event_id !== eventId
    || !optionalString(event.organization_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.life_period_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
  ) {
    const error = new Error(`Phase68A cannot resolve canonical Phase67D event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67D_SOURCE_INVALID";
    throw error;
  }
  if (eventHash(event, "organization_event_hash") !== event.organization_event_hash) {
    const error = new Error(`Phase67D source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67D_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function sourceAnchorFromHistoryReference(worldState, sourceKind, reference, historyIndex) {
  if (sourceKind === "phase67b_life_event_organization") {
    const eventId = requiredString(
      reference?.organization_event_id,
      "Phase67B organization_event_id",
    );
    const event = validatePhase67BEvent(worldState, eventId);
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
    ) {
      const error = new Error(`Phase67B history reference ${eventId} is not canonical.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67B_HISTORY_INVALID";
      throw error;
    }
    return {
      source_kind: sourceKind,
      source_event_id: eventId,
      source_event_hash: event.organization_event_hash,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: historyIndex,
      character_view: safeLifeEventAnchorView(),
    };
  }
  if (sourceKind === "phase67c_personal_semantic_derivation") {
    const eventId = requiredString(
      reference?.derivation_event_id,
      "Phase67C derivation_event_id",
    );
    const event = validatePhase67CEvent(worldState, eventId);
    if (
      reference.derivation_event_hash !== event.derivation_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
    ) {
      const error = new Error(`Phase67C history reference ${eventId} is not canonical.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67C_HISTORY_INVALID";
      throw error;
    }
    return {
      source_kind: sourceKind,
      source_event_id: eventId,
      source_event_hash: event.derivation_event_hash,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: historyIndex,
      character_view: safeSemanticAnchorView(event),
    };
  }
  if (sourceKind === "phase67d_life_period_organization") {
    const eventId = requiredString(
      reference?.organization_event_id,
      "Phase67D organization_event_id",
    );
    const event = validatePhase67DEvent(worldState, eventId);
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
    ) {
      const error = new Error(`Phase67D history reference ${eventId} is not canonical.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PHASE67D_HISTORY_INVALID";
      throw error;
    }
    return {
      source_kind: sourceKind,
      source_event_id: eventId,
      source_event_hash: event.organization_event_hash,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: historyIndex,
      character_view: safeLifePeriodAnchorView(event),
    };
  }
  const error = new Error(`Unsupported Phase68A source kind: ${sourceKind}.`);
  error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_KIND_UNSUPPORTED";
  throw error;
}

function allCanonicalSourceAnchors(worldState) {
  const anchors = [];
  array(worldState.autobiographical_life_event_organization_history)
    .forEach((reference, index) => {
      anchors.push(sourceAnchorFromHistoryReference(
        worldState,
        "phase67b_life_event_organization",
        reference,
        index,
      ));
    });
  array(worldState.personal_semantic_derivation_history)
    .forEach((reference, index) => {
      anchors.push(sourceAnchorFromHistoryReference(
        worldState,
        "phase67c_personal_semantic_derivation",
        reference,
        index,
      ));
    });
  array(worldState.autobiographical_life_period_organization_history)
    .forEach((reference, index) => {
      anchors.push(sourceAnchorFromHistoryReference(
        worldState,
        "phase67d_life_period_organization",
        reference,
        index,
      ));
    });
  return anchors;
}

function validatePersistedInterpretationEvent(event, eventId) {
  if (
    !isObject(event)
    || event.schema_version !== autobiographicalSelfInterpretationEventSchemaVersion
    || event.version !== worldSimulationAutobiographicalSelfInterpretationVersion
    || event.immutable !== true
    || event.interpretation_event_id !== eventId
    || !optionalString(event.interpretation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !supportedOperations.includes(event.operation)
    || !optionalString(event.interpretation_id)
    || !supportedInterpretationKinds.includes(event.interpretation_kind)
    || !Array.isArray(event.source_refs)
    || event.source_refs.length < 1
    || !Array.isArray(event.supersedes_interpretation_ids)
    || !optionalString(event.resolver_view_hash)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_belief !== false
    || event.self_model !== false
    || event.trait_model !== false
    || event.value_model !== false
    || event.preference_model !== false
    || event.role_identity_model !== false
    || event.capability_self_rating_model !== false
    || event.motivation_goal_model !== false
    || event.confidence !== null
    || event.probability !== null
    || event.character_brain_direct_write !== false
    || event.freeform_life_story_authority !== false
    || event.status !== "autobiographical_self_interpretation_recorded"
  ) {
    const error = new Error(`AutobiographicalSelfInterpretationEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_EVENT_INVALID";
    throw error;
  }
  normalizedQualifiers(event.qualifiers);
  if (selfInterpretationEventHash(event) !== event.interpretation_event_hash) {
    const error = new Error(`AutobiographicalSelfInterpretationEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateExistingInterpretationHistory(worldState) {
  if (
    Object.hasOwn(worldState, "autobiographical_self_interpretation_events")
    && !isObject(worldState.autobiographical_self_interpretation_events)
  ) {
    const error = new Error("autobiographical_self_interpretation_events must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_EVENT_STORE_INVALID";
    throw error;
  }
  if (
    Object.hasOwn(worldState, "autobiographical_self_interpretation_history")
    && !Array.isArray(worldState.autobiographical_self_interpretation_history)
  ) {
    const error = new Error("autobiographical_self_interpretation_history must be an array.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.autobiographical_self_interpretation_events);
  const history = array(worldState.autobiographical_self_interpretation_history);
  const latestByCharacter = new Map();
  const activeByCharacter = new Map();
  const seenEventIds = new Set();
  const seenInterpretationIds = new Set();

  for (const [index, reference] of history.entries()) {
    if (
      !isObject(reference)
      || reference.schema_version
        !== autobiographicalSelfInterpretationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !optionalString(reference.interpretation_event_id)
      || !optionalString(reference.interpretation_event_hash)
      || !optionalString(reference.interpretation_id)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !supportedOperations.includes(reference.operation)
      || !supportedInterpretationKinds.includes(reference.interpretation_kind)
      || !Array.isArray(reference.supersedes_interpretation_ids)
      || reference.status !== "autobiographical_self_interpretation_recorded"
    ) {
      const error = new Error(`autobiographical_self_interpretation_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const eventId = reference.interpretation_event_id;
    if (seenEventIds.has(eventId)) {
      const error = new Error(`Duplicate Phase68A interpretation event ${eventId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_HISTORY_DUPLICATE_EVENT";
      throw error;
    }
    const event = validatePersistedInterpretationEvent(events[eventId], eventId);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    const active = activeByCharacter.get(key) ?? new Set();
    if (
      reference.interpretation_event_hash !== event.interpretation_event_hash
      || reference.interpretation_id !== event.interpretation_id
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.operation !== event.operation
      || reference.interpretation_kind !== event.interpretation_kind
      || !sameValue(reference.supersedes_interpretation_ids, event.supersedes_interpretation_ids)
      || reference.previous_interpretation_event_id !== event.previous_interpretation_event_id
      || reference.previous_interpretation_event_hash !== event.previous_interpretation_event_hash
      || event.previous_interpretation_event_id !== (previous?.interpretation_event_id ?? null)
      || event.previous_interpretation_event_hash !== (previous?.interpretation_event_hash ?? null)
    ) {
      const error = new Error(`Phase68A history reference ${eventId} breaks its canonical per-character chain.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (seenInterpretationIds.has(event.interpretation_id)) {
      const error = new Error(`Phase68A interpretation identity ${event.interpretation_id} was reused.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    if (event.operation === "establish" && event.supersedes_interpretation_ids.length) {
      const error = new Error("Phase68A establish may not supersede prior interpretations.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_ESTABLISH_SUPERSESSION_FORBIDDEN";
      throw error;
    }
    if (event.operation === "supersede") {
      if (!event.supersedes_interpretation_ids.length) {
        const error = new Error("Phase68A supersede requires explicit prior interpretation targets.");
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SUPERSESSION_TARGET_REQUIRED";
        throw error;
      }
      for (const targetId of event.supersedes_interpretation_ids) {
        if (!active.has(targetId)) {
          const error = new Error(`Phase68A supersession target ${targetId} is not active for the same character.`);
          error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SUPERSESSION_TARGET_INVALID";
          throw error;
        }
        active.delete(targetId);
      }
    }
    active.add(event.interpretation_id);
    activeByCharacter.set(key, active);
    latestByCharacter.set(key, event);
    seenEventIds.add(eventId);
    seenInterpretationIds.add(event.interpretation_id);
  }
  return {
    events,
    history,
    latestByCharacter,
    activeByCharacter,
    seenInterpretationIds,
  };
}

export function projectWorldSimulationEffectiveAutobiographicalSelfInterpretations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateExistingInterpretationHistory(worldState);
  const interpretationsByCharacter = {};
  const activeInterpretationIdsByCharacter = {};

  existing.history.forEach((reference, historyIndex) => {
    const event = existing.events[reference.interpretation_event_id];
    const character = event.character;
    if (!isObject(interpretationsByCharacter[character])) {
      interpretationsByCharacter[character] = {};
    }
    const records = interpretationsByCharacter[character];
    for (const targetId of event.supersedes_interpretation_ids) {
      if (records[targetId]) {
        records[targetId] = {
          ...records[targetId],
          state: "superseded",
          superseded_by_interpretation_event_id: event.interpretation_event_id,
        };
      }
    }
    records[event.interpretation_id] = {
      interpretation_id: event.interpretation_id,
      character,
      interpretation_kind: event.interpretation_kind,
      qualifiers: cloneJson(event.qualifiers),
      source_refs: cloneJson(event.source_refs),
      established_by_interpretation_event_id: event.interpretation_event_id,
      latest_interpretation_event_id: event.interpretation_event_id,
      latest_history_index: historyIndex,
      state: "active",
      superseded_by_interpretation_event_id: null,
      subjective_not_world_truth: true,
      epistemic_belief: false,
      self_model: false,
      trait_model: false,
      value_model: false,
      preference_model: false,
      role_identity_model: false,
      capability_self_rating_model: false,
      motivation_goal_model: false,
      confidence: null,
      probability: null,
    };
  });

  for (const [character, records] of Object.entries(interpretationsByCharacter)) {
    activeInterpretationIdsByCharacter[character] = Object.values(records)
      .filter((record) => record.state === "active")
      .sort((left, right) => {
        const recent = Number(right.latest_history_index) - Number(left.latest_history_index);
        return recent || compareText(left.interpretation_id, right.interpretation_id);
      })
      .map((record) => record.interpretation_id);
  }

  const projection = {
    version: effectiveAutobiographicalSelfInterpretationProjectionVersion,
    source_version: worldSimulationAutobiographicalSelfInterpretationVersion,
    interpretations_by_character: interpretationsByCharacter,
    active_interpretation_ids_by_character: activeInterpretationIdsByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    explicit_supersession_only: true,
    multiple_active_interpretations_allowed: true,
    last_write_wins_applied: false,
    mandatory_narrative_coherence_applied: false,
    world_truth_authority_claimed: false,
    belief_authority_claimed: false,
    self_model_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function boundedAnchorsForResolver(allAnchors, turnId) {
  const byCharacter = new Map();
  for (const anchor of allAnchors) {
    const key = characterKey(anchor.character);
    if (!byCharacter.has(key)) byCharacter.set(key, []);
    byCharacter.get(key).push(anchor);
  }
  const selected = [];
  for (const anchors of byCharacter.values()) {
    const current = anchors.filter((anchor) => anchor.source_turn_id === turnId);
    const currentKeys = new Set(current.map(sourceRefKey));
    const prior = anchors
      .filter((anchor) => !currentKeys.has(sourceRefKey(anchor)))
      .sort((left, right) => {
        const kind = compareText(left.source_kind, right.source_kind);
        if (kind !== 0) return kind;
        const recent = Number(right.history_index) - Number(left.history_index);
        return recent || compareText(left.source_event_id, right.source_event_id);
      });
    const remaining = Math.max(
      0,
      autobiographicalSelfInterpretationMaxResolverAnchorsPerCharacter - current.length,
    );
    selected.push(...current, ...prior.slice(0, remaining));
  }
  return selected.sort((left, right) => {
    const character = compareText(characterKey(left.character), characterKey(right.character));
    if (character !== 0) return character;
    const currentLeft = left.source_turn_id === turnId ? 0 : 1;
    const currentRight = right.source_turn_id === turnId ? 0 : 1;
    if (currentLeft !== currentRight) return currentLeft - currentRight;
    const kind = compareText(left.source_kind, right.source_kind);
    if (kind !== 0) return kind;
    return compareText(left.source_event_id, right.source_event_id);
  });
}

export function buildWorldSimulationAutobiographicalSelfInterpretationResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const allAnchors = allCanonicalSourceAnchors(worldState);
  const availableAnchors = boundedAnchorsForResolver(allAnchors, turnId);
  const currentTurnTriggers = availableAnchors.filter((anchor) =>
    anchor.source_turn_id === turnId,
  );
  const effectiveProjection =
    projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
      world_state: worldState,
    });
  const view = {
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    turn_id: turnId,
    current_turn_trigger_refs: currentTurnTriggers.map((anchor) => ({
      source_kind: anchor.source_kind,
      source_event_id: anchor.source_event_id,
      source_event_hash: anchor.source_event_hash,
      character: anchor.character,
      character_view: cloneJson(anchor.character_view),
    })),
    available_autobiographical_evidence_refs: availableAnchors.map((anchor) => ({
      source_kind: anchor.source_kind,
      source_event_id: anchor.source_event_id,
      source_event_hash: anchor.source_event_hash,
      character: anchor.character,
      character_view: cloneJson(anchor.character_view),
    })),
    effective_self_interpretations:
      cloneJson(effectiveProjection.interpretations_by_character),
    effective_self_interpretation_projection_hash:
      effectiveProjection.projection_hash,
    supported_operations: [...supportedOperations],
    supported_interpretation_kinds: [...supportedInterpretationKinds],
    supported_qualifiers: [...supportedQualifiers],
    current_turn_phase67_trigger_required: true,
    same_character_evidence_only: true,
    resolver_anchor_budget_per_character:
      autobiographicalSelfInterpretationMaxResolverAnchorsPerCharacter,
    resolver_recency_is_transport_only: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    memory_content_exposed: false,
    hidden_retrieval_graph_exposed: false,
    world_truth_judgment_requested: false,
    belief_resolution_requested: false,
    self_model_requested: false,
    trait_inference_requested: false,
    value_inference_requested: false,
    preference_inference_requested: false,
    role_identity_inference_requested: false,
    capability_self_rating_requested: false,
    motivation_goal_inference_requested: false,
    confidence_probability_requested: false,
    freeform_life_story_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeSourceRefs(rawRefs, character, resolverView) {
  const available = new Map(
    resolverView.available_autobiographical_evidence_refs.map((reference) => [
      sourceRefKey(reference),
      reference,
    ]),
  );
  const refs = array(rawRefs).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`source_refs[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_REF_INVALID";
      throw error;
    }
    const sourceKind = requiredString(
      item.source_kind,
      `source_refs[${index}].source_kind`,
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_REF_INVALID",
    );
    if (!supportedSourceKinds.includes(sourceKind)) {
      const error = new Error(`Unsupported Phase68A source kind: ${sourceKind}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_KIND_UNSUPPORTED";
      throw error;
    }
    const normalized = {
      source_kind: sourceKind,
      source_event_id: requiredString(
        item.source_event_id,
        `source_refs[${index}].source_event_id`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_REF_INVALID",
      ),
      source_event_hash: requiredString(
        item.source_event_hash,
        `source_refs[${index}].source_event_hash`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_REF_INVALID",
      ),
    };
    const found = available.get(sourceRefKey(normalized));
    if (!found) {
      const error = new Error("Phase68A interpretation references autobiographical evidence outside the bounded resolver view.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_OUT_OF_VIEW";
      throw error;
    }
    if (!sameCharacter(found.character, character)) {
      const error = new Error("Phase68A interpretation may use only same-character autobiographical evidence.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_CROSS_CHARACTER_SOURCE_FORBIDDEN";
      throw error;
    }
    return normalized;
  });
  refs.sort((left, right) => {
    const kind = compareText(left.source_kind, right.source_kind);
    if (kind !== 0) return kind;
    return compareText(left.source_event_id, right.source_event_id);
  });
  if (!refs.length || new Set(refs.map(sourceRefKey)).size !== refs.length) {
    const error = new Error("Phase68A interpretation source refs must be non-empty and unique.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_REF_INVALID";
    throw error;
  }
  const current = new Set(
    resolverView.current_turn_trigger_refs.map(sourceRefKey),
  );
  if (!refs.some((reference) => current.has(sourceRefKey(reference)))) {
    const error = new Error(
      "Phase68A interpretation requires at least one current-turn Phase67 autobiographical trigger.",
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  return refs;
}

function characterInterpretationRecords(projection, character) {
  for (const [name, records] of Object.entries(projection.interpretations_by_character ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

function normalizeDecision(raw, resolverView, existingProjection) {
  if (!isObject(raw)) {
    const error = new Error("Phase68A interpretation decision must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DECISION_INVALID";
    throw error;
  }
  const character = requiredString(
    raw.character,
    "interpretation decision character",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DECISION_INVALID",
  );
  const operation = requiredString(
    raw.operation,
    "interpretation decision operation",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DECISION_INVALID",
  );
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase68A operation: ${operation}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_OPERATION_UNSUPPORTED";
    throw error;
  }
  const interpretationKind = requiredString(
    raw.interpretation_kind,
    "interpretation_kind",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DECISION_INVALID",
  );
  if (!supportedInterpretationKinds.includes(interpretationKind)) {
    const error = new Error(`Unsupported Phase68A interpretation kind: ${interpretationKind}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_KIND_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = requiredString(
    raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_RESOLVER_VIEW_HASH_REQUIRED",
  );
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase68A interpretation decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const sourceRefs = normalizeSourceRefs(raw.source_refs, character, resolverView);
  const qualifiers = normalizedQualifiers(raw.qualifiers);
  const supersedes = uniqueSortedStrings(raw.supersedes_interpretation_ids);
  const existing = characterInterpretationRecords(existingProjection, character);
  if (operation === "establish" && supersedes.length) {
    const error = new Error("Phase68A establish may not specify supersession targets.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_ESTABLISH_SUPERSESSION_FORBIDDEN";
    throw error;
  }
  if (operation === "supersede") {
    if (!supersedes.length) {
      const error = new Error("Phase68A supersede requires explicit supersession targets.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SUPERSESSION_TARGET_REQUIRED";
      throw error;
    }
    for (const targetId of supersedes) {
      if (!existing[targetId] || existing[targetId].state !== "active") {
        const error = new Error(`Phase68A supersession target ${targetId} is not an active same-character interpretation.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SUPERSESSION_TARGET_INVALID";
        throw error;
      }
    }
  }
  const interpretationId = `autobiographical_self_interpretation_${hashAgentRunValue({
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    character: characterKey(character),
    interpretation_kind: interpretationKind,
    source_refs: sourceRefs,
    qualifiers,
  }).slice(0, 24)}`;
  if (existing[interpretationId]) {
    const error = new Error(`Phase68A interpretation ${interpretationId} already exists.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DUPLICATE";
    throw error;
  }
  return {
    character,
    operation,
    interpretation_id: interpretationId,
    interpretation_kind: interpretationKind,
    source_refs: sourceRefs,
    qualifiers,
    supersedes_interpretation_ids: supersedes,
    resolver_view_hash: resolverViewHash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_autobiographical_self_interpretation",
    source: optionalString(raw.source) ?? "programmatic_autobiographical_self_interpretation_resolver",
  };
}

function interpretationEventFor(decision, previousEvent, turnId) {
  const base = {
    schema_version: autobiographicalSelfInterpretationEventSchemaVersion,
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    interpretation_id: decision.interpretation_id,
    interpretation_kind: decision.interpretation_kind,
    source_refs: cloneJson(decision.source_refs),
    qualifiers: cloneJson(decision.qualifiers),
    supersedes_interpretation_ids: cloneJson(decision.supersedes_interpretation_ids),
    resolver_view_hash: decision.resolver_view_hash,
    previous_interpretation_event_id:
      previousEvent?.interpretation_event_id ?? null,
    previous_interpretation_event_hash:
      previousEvent?.interpretation_event_hash ?? null,
    interpretation_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      resolver_view_ref: `phase68a_resolver_view:${decision.resolver_view_hash}`,
      same_character_autobiographical_evidence_only: true,
      current_turn_phase67_trigger_required: true,
      explicit_supersession_only: true,
      multiple_active_interpretations_allowed: true,
      last_write_wins_applied: false,
      mandatory_narrative_coherence_applied: false,
      resolver_recency_used_as_transport_only: true,
    },
    source_semantics: {
      phase67_autobiographical_evidence_is_authoritative_source: true,
      world_truth_is_source: false,
      source_memory_rewritten: false,
      source_episode_rewritten: false,
      source_life_event_rewritten: false,
      source_personal_semantic_rewritten: false,
      source_life_period_rewritten: false,
      second_retrieval_engine_installed: false,
      hidden_semantic_graph_used: false,
      belief_resolution_modeled: false,
      self_model_modeled: false,
      trait_inference_modeled: false,
      value_inference_modeled: false,
      preference_inference_modeled: false,
      role_identity_inference_modeled: false,
      capability_self_rating_modeled: false,
      motivation_goal_inference_modeled: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    epistemic_belief: false,
    self_model: false,
    trait_model: false,
    value_model: false,
    preference_model: false,
    role_identity_model: false,
    capability_self_rating_model: false,
    motivation_goal_model: false,
    confidence: null,
    probability: null,
    freeform_life_story_authority: false,
    character_brain_direct_write: false,
    status: "autobiographical_self_interpretation_recorded",
  };
  const eventId = `autobiographical_self_interpretation_event_${hashAgentRunValue({
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    interpretation_id: decision.interpretation_id,
    supersedes_interpretation_ids: decision.supersedes_interpretation_ids,
    previous_interpretation_event_hash:
      previousEvent?.interpretation_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = {
    ...base,
    interpretation_event_id: eventId,
  };
  event.interpretation_event_hash = selfInterpretationEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: autobiographicalSelfInterpretationHistoryReferenceSchemaVersion,
    derived_index: true,
    interpretation_event_id: event.interpretation_event_id,
    interpretation_event_hash: event.interpretation_event_hash,
    interpretation_id: event.interpretation_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    interpretation_kind: event.interpretation_kind,
    supersedes_interpretation_ids: cloneJson(event.supersedes_interpretation_ids),
    previous_interpretation_event_id: event.previous_interpretation_event_id,
    previous_interpretation_event_hash: event.previous_interpretation_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationAutobiographicalSelfInterpretationContract() {
  return deepFreeze({
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    phase: "Phase68A",
    status: "autobiographical_self_interpretation_foundation_installed",
    source_owners: ["Phase67B", "Phase67C", "Phase67D"],
    source_scope: "same_character_subjective_autobiographical_evidence_only",
    supported_operations: [...supportedOperations],
    supported_interpretation_kinds: [...supportedInterpretationKinds],
    supported_qualifiers: [...supportedQualifiers],
    immutable_interpretation_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    effective_projection_replayable: true,
    effective_projection_version:
      effectiveAutobiographicalSelfInterpretationProjectionVersion,
    character_projection_version:
      autobiographicalSelfInterpretationCharacterProjectionVersion,
    explicit_supersession_only: true,
    multiple_active_interpretations_allowed: true,
    max_one_interpretation_event_per_character_per_turn: true,
    last_write_wins_allowed: false,
    mandatory_narrative_coherence_required: false,
    world_truth_authority_claimed: false,
    belief_engine_duplicated: false,
    self_model_modeled: false,
    stable_traits_modeled: false,
    values_modeled: false,
    preferences_modeled: false,
    role_identity_modeled: false,
    capability_self_rating_modeled: false,
    motivation_goal_integration_modeled: false,
    confidence_probability_modeled: false,
    importance_salience_truth_ranking_modeled: false,
    freeform_llm_life_story_authority: false,
    source_phase63_phase67_records_rewritten: false,
    separate_retrieval_engine_installed: false,
    hidden_semantic_graph_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    committed_prior_turn_character_projection_only: true,
    same_turn_character_brain_feedback_allowed: false,
    same_turn_contamination_policy: "fail_closed",
    max_character_projection_items:
      autobiographicalSelfInterpretationMaxCharacterItems,
    max_resolver_anchors_per_character:
      autobiographicalSelfInterpretationMaxResolverAnchorsPerCharacter,
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationAutobiographicalSelfInterpretations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const rawDecisions = array(input.interpretation_decisions);
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    interpretation_decisions: rawDecisions,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateExistingInterpretationHistory(worldState);
  const existingProjection =
    projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
      world_state: worldState,
    });
  const resolverView = buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
    world_state: worldState,
    turn_id: turnId,
  });
  const decisions = rawDecisions.map((decision) =>
    normalizeDecision(decision, resolverView, existingProjection),
  );
  const existingDecisionCharactersThisTurn = new Set(
    existing.history
      .map((reference) => existing.events[reference.interpretation_event_id])
      .filter((event) => event?.source_turn_id === turnId)
      .map((event) => characterKey(event.character)),
  );
  const seenNewInterpretationIds = new Set();
  const seenDecisionCharacters = new Set();
  const supersededThisTurn = new Set();
  for (const decision of decisions) {
    const decisionCharacter = characterKey(decision.character);
    if (
      existingDecisionCharactersThisTurn.has(decisionCharacter)
      || seenDecisionCharacters.has(decisionCharacter)
    ) {
      const error = new Error(
        `Phase68A v1 allows at most one durable self-interpretation event per character per turn: ${decision.character}.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PER_CHARACTER_TURN_LIMIT";
      throw error;
    }
    seenDecisionCharacters.add(decisionCharacter);
    if (seenNewInterpretationIds.has(decision.interpretation_id)) {
      const error = new Error(`Duplicate Phase68A interpretation decision ${decision.interpretation_id}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_DECISION_DUPLICATE";
      throw error;
    }
    for (const targetId of decision.supersedes_interpretation_ids) {
      if (supersededThisTurn.has(targetId)) {
        const error = new Error(`Phase68A interpretation ${targetId} is superseded more than once in one turn.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SUPERSESSION_DUPLICATE";
        throw error;
      }
      supersededThisTurn.add(targetId);
    }
    seenNewInterpretationIds.add(decision.interpretation_id);
  }

  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];

  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const previous = latestByCharacter.get(key) ?? null;
    const event = interpretationEventFor(decision, previous, turnId);
    if (object(preview.autobiographical_self_interpretation_events)[event.interpretation_event_id]) {
      const error = new Error(`Phase68A interpretation event ${event.interpretation_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.autobiographical_self_interpretation_events = object(
      preview.autobiographical_self_interpretation_events,
    );
    preview.autobiographical_self_interpretation_events[event.interpretation_event_id] =
      cloneJson(event);
    createdEvents.push(event);
    const reference = historyReferenceFor(event);
    appendedReferences.push(reference);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `autobiographical_self_interpretation_events.${event.interpretation_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable AutobiographicalSelfInterpretationEvent ${event.interpretation_event_id}`,
      source_layer: "autobiographical_self_interpretation",
    });
  }

  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.autobiographical_self_interpretation_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "autobiographical_self_interpretation_history",
      from: cloneJson(worldState.autobiographical_self_interpretation_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase68A self-interpretation history reference(s)`,
      source_layer: "autobiographical_self_interpretation",
    });
  }

  const effectiveProjection =
    projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
      world_state: preview,
    });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase68A autobiographical self-interpretation mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    result: {
      interpretation_decision_count: decisions.length,
      interpretation_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_self_interpretation_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        same_character_autobiographical_evidence_only: true,
        current_turn_phase67_trigger_required: true,
        explicit_supersession_only: true,
        multiple_active_interpretations_allowed: true,
        last_write_wins_applied: false,
        mandatory_narrative_coherence_applied: false,
        source_phase63_phase67_records_rewritten: false,
        second_retrieval_engine_installed: false,
        hidden_semantic_graph_used: false,
        world_truth_authority_claimed: false,
        belief_resolution_applied: false,
        self_model_inference_applied: false,
        trait_value_preference_role_capability_goal_inference_applied: false,
        confidence_probability_modeled: false,
        freeform_life_story_authority_used: false,
        character_brain_direct_write_used: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}

function assertNoSameTurnInterpretationWrites(worldState, character, currentTurnId) {
  for (const reference of array(worldState.autobiographical_self_interpretation_history)) {
    if (!sameCharacter(reference?.character, character)) continue;
    if (reference?.source_turn_id !== currentTurnId) continue;
    const error = new Error(
      `Phase68A cannot expose self-interpretation state after same-turn write for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SAME_TURN_CONTAMINATION";
    throw error;
  }
}

function characterViewForSourceRef(sourceRef, anchorByKey) {
  const anchor = anchorByKey.get(sourceRefKey(sourceRef));
  if (!anchor) {
    const error = new Error(`Phase68A cannot reconstruct source anchor ${sourceRef.source_event_id}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SOURCE_RECONSTRUCTION_FAILED";
    throw error;
  }
  return cloneJson(anchor.character_view);
}

export function projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnInterpretationWrites(worldState, character, currentTurnId);
  const effectiveProjection =
    projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
      world_state: worldState,
    });
  const allAnchors = allCanonicalSourceAnchors(worldState);
  const anchorByKey = new Map(allAnchors.map((anchor) => [sourceRefKey(anchor), anchor]));
  const records = Object.values(
    characterInterpretationRecords(effectiveProjection, character),
  )
    .filter((record) => record.state === "active")
    .sort((left, right) => {
      const recent = Number(right.latest_history_index) - Number(left.latest_history_index);
      return recent || compareText(left.interpretation_id, right.interpretation_id);
    });
  const selected = records.slice(0, autobiographicalSelfInterpretationMaxCharacterItems);
  const interpretations = selected.map((record) => ({
    interpretation_kind: record.interpretation_kind,
    qualifiers: cloneJson(record.qualifiers),
    autobiographical_anchors: record.source_refs.map((sourceRef) =>
      characterViewForSourceRef(sourceRef, anchorByKey),
    ),
    subjective_not_world_truth: true,
    epistemic_belief: false,
    self_model: false,
  }));
  const characterView = {
    source: "committed_prior_turn_autobiographical_self_interpretation",
    interpretations,
    interpretations_truncated: selected.length < records.length,
    multiple_active_interpretations_allowed: true,
    mandatory_narrative_coherence_applied: false,
    narrative_story_generated: false,
    trait_model_exposed: false,
    value_model_exposed: false,
    preference_model_exposed: false,
    role_identity_model_exposed: false,
    capability_self_rating_exposed: false,
    motivation_goal_model_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase68A bounded character projection mutated its world-state input.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: autobiographicalSelfInterpretationCharacterProjectionVersion,
    source_projection_version:
      effectiveAutobiographicalSelfInterpretationProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effectiveProjection.projection_hash,
      source_active_interpretation_count: records.length,
      projected_interpretation_count: selected.length,
      recency_used_for_transport_only: true,
      importance_salience_truth_ranking_used: false,
      source_ids_exposed_to_character_brain: false,
      source_hashes_exposed_to_character_brain: false,
      source_turn_ids_exposed_to_character_brain: false,
      world_truth_authority_exposed: false,
      belief_resolution_applied: false,
      self_model_exposed: false,
      trait_value_preference_role_capability_goal_model_exposed: false,
      confidence_probability_exposed: false,
      freeform_life_story_generated: false,
      persistent_projection_written: false,
      same_turn_feedback_allowed: false,
    },
    boundaries: {
      same_character_only: true,
      committed_prior_turn_only: true,
      same_turn_contamination_policy: "fail_closed",
      character_brain_may_observe_bounded_self_interpretation_context: true,
      action_proposer_may_observe_bounded_self_interpretation_context: true,
      character_brain_may_mutate_interpretation_history: false,
      action_proposer_may_mutate_interpretation_history: false,
      source_ids_hashes_engine_only: true,
      world_truth_authority_exposed: false,
      belief_authority_exposed: false,
      self_model_exposed: false,
    },
  });
}
