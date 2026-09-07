import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  autobiographicalSelfInterpretationEventSchemaVersion,
  autobiographicalSelfInterpretationHistoryReferenceSchemaVersion,
  projectWorldSimulationEffectiveAutobiographicalSelfInterpretations,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "./world-simulation-autobiographical-self-interpretation-service.mjs";

export const worldSimulationStructuredSelfModelVersion =
  "phase68b-structured-self-model-v1";
export const structuredSelfModelAspectEventSchemaVersion =
  "phase68b-structured-self-model-aspect-event-v1";
export const structuredSelfModelHistoryReferenceSchemaVersion =
  "phase68b-structured-self-model-history-ref-v1";
export const effectiveStructuredSelfModelProjectionVersion =
  "phase68b-effective-structured-self-model-projection-v1";
export const structuredSelfModelCharacterProjectionVersion =
  "phase68b-bounded-structured-self-model-character-projection-v1";
export const structuredSelfModelMaxCharacterItems = 10;
export const structuredSelfModelMaxResolverSourcesPerCharacter = 48;

const supportedOperations = Object.freeze(["form"]);
const supportedAspectTypes = Object.freeze([
  "trait_tendency",
  "value_orientation",
  "preference",
  "role_identity",
  "capability_appraisal",
]);
const relationByAspectType = Object.freeze({
  trait_tendency: "tends_toward",
  value_orientation: "values",
  preference: "prefers",
  role_identity: "identifies_as",
  capability_appraisal: "appraises_capability_as",
});

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
function boundedString(value, label, maxLength = 160, code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
function characterKey(value) {
  return boundedString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function uniqueBoundedStrings(values, label, maxItems = 4, maxLength = 80) {
  const result = [...new Set(array(values).map((value) => optionalString(value)).filter(Boolean))]
    .sort(compareText);
  if (result.length > maxItems || result.some((value) => value.length > maxLength)) {
    const error = new Error(`${label} exceeds the bounded Phase68B shape.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID";
    throw error;
  }
  return result;
}
function hashWithout(event, field) {
  const body = cloneJson(event);
  delete body[field];
  return hashAgentRunValue(body);
}
function aspectEventHash(event) {
  return hashWithout(event, "aspect_event_hash");
}
function interpretationEventHash(event) {
  return hashWithout(event, "interpretation_event_hash");
}
function sourceRefKey(reference) {
  return [reference?.source_event_id ?? null, reference?.source_event_hash ?? null].join("\u0000");
}

function validatePhase68ASourceEvent(worldState, eventId) {
  const event = object(object(worldState.autobiographical_self_interpretation_events)[eventId]);
  if (
    !Object.keys(event).length
    || event.schema_version !== autobiographicalSelfInterpretationEventSchemaVersion
    || event.version !== worldSimulationAutobiographicalSelfInterpretationVersion
    || event.immutable !== true
    || event.interpretation_event_id !== eventId
    || !optionalString(event.interpretation_event_hash)
    || !optionalString(event.interpretation_id)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_belief !== false
    || event.self_model !== false
    || event.status !== "autobiographical_self_interpretation_recorded"
  ) {
    const error = new Error(`Phase68B cannot resolve canonical Phase68A event ${eventId}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PHASE68A_SOURCE_INVALID";
    throw error;
  }
  if (interpretationEventHash(event) !== event.interpretation_event_hash) {
    const error = new Error(`Phase68A source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PHASE68A_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function canonicalPhase68ASources(worldState) {
  const sources = [];
  for (const [index, reference] of array(worldState.autobiographical_self_interpretation_history).entries()) {
    if (
      !isObject(reference)
      || reference.schema_version !== autobiographicalSelfInterpretationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !optionalString(reference.interpretation_event_id)
      || !optionalString(reference.interpretation_event_hash)
      || !optionalString(reference.interpretation_id)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
    ) {
      const error = new Error(`Phase68A history reference ${index} is invalid for Phase68B sourcing.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PHASE68A_HISTORY_INVALID";
      throw error;
    }
    const event = validatePhase68ASourceEvent(worldState, reference.interpretation_event_id);
    if (
      reference.interpretation_event_hash !== event.interpretation_event_hash
      || reference.interpretation_id !== event.interpretation_id
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
    ) {
      const error = new Error(`Phase68A history reference ${event.interpretation_event_id} is not canonical.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PHASE68A_HISTORY_INVALID";
      throw error;
    }
    sources.push({
      source_kind: "phase68a_autobiographical_self_interpretation",
      source_event_id: event.interpretation_event_id,
      source_event_hash: event.interpretation_event_hash,
      interpretation_id: event.interpretation_id,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: index,
      character_view: {
        interpretation_kind: event.interpretation_kind,
        qualifiers: cloneJson(array(event.qualifiers)),
        subjective_not_world_truth: true,
      },
    });
  }
  return sources;
}

function normalizeDescriptor(aspectType, raw) {
  if (!isObject(raw)) {
    const error = new Error("Phase68B self-model descriptor must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID";
    throw error;
  }
  const relation = boundedString(raw.relation, "descriptor.relation", 80,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID");
  const requiredRelation = relationByAspectType[aspectType];
  if (relation !== requiredRelation) {
    const error = new Error(`Phase68B ${aspectType} requires relation ${requiredRelation}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_RELATION_INVALID";
    throw error;
  }
  if (raw.subject_scope !== "self") {
    const error = new Error("Phase68B descriptor subject_scope must be self.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID";
    throw error;
  }
  return {
    subject_scope: "self",
    domain: boundedString(raw.domain, "descriptor.domain", 120,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID"),
    relation,
    object_ref: boundedString(raw.object_ref, "descriptor.object_ref", 160,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DESCRIPTOR_INVALID"),
    qualifiers: uniqueBoundedStrings(raw.qualifiers, "descriptor.qualifiers"),
  };
}

function validatePersistedAspectEvent(event, eventId) {
  if (
    !isObject(event)
    || event.schema_version !== structuredSelfModelAspectEventSchemaVersion
    || event.version !== worldSimulationStructuredSelfModelVersion
    || event.immutable !== true
    || event.aspect_event_id !== eventId
    || !optionalString(event.aspect_event_hash)
    || !optionalString(event.aspect_id)
    || !optionalString(event.aspect_key)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || event.operation !== "form"
    || !supportedAspectTypes.includes(event.aspect_type)
    || !Array.isArray(event.source_refs)
    || event.source_refs.length < 1
    || !optionalString(event.resolver_view_hash)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.epistemic_belief !== false
    || event.self_model_content !== true
    || event.self_model_accuracy_claimed !== false
    || event.self_model_clarity_claimed !== false
    || event.motivation_goal_model !== false
    || event.confidence !== null
    || event.probability !== null
    || event.character_brain_direct_write !== false
    || event.status !== "structured_self_model_aspect_formed"
  ) {
    const error = new Error(`StructuredSelfModelAspectEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_EVENT_INVALID";
    throw error;
  }
  normalizeDescriptor(event.aspect_type, event.descriptor);
  if (aspectEventHash(event) !== event.aspect_event_hash) {
    const error = new Error(`StructuredSelfModelAspectEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateHistory(worldState) {
  if (Object.hasOwn(worldState, "structured_self_model_aspect_events")
      && !isObject(worldState.structured_self_model_aspect_events)) {
    const error = new Error("structured_self_model_aspect_events must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "structured_self_model_history")
      && !Array.isArray(worldState.structured_self_model_history)) {
    const error = new Error("structured_self_model_history must be an array.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.structured_self_model_aspect_events);
  const history = array(worldState.structured_self_model_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const seenAspectIds = new Set();
  for (const [index, reference] of history.entries()) {
    if (
      !isObject(reference)
      || reference.schema_version !== structuredSelfModelHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !optionalString(reference.aspect_event_id)
      || !optionalString(reference.aspect_event_hash)
      || !optionalString(reference.aspect_id)
      || !optionalString(reference.aspect_key)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || reference.operation !== "form"
      || !supportedAspectTypes.includes(reference.aspect_type)
      || reference.status !== "structured_self_model_aspect_formed"
    ) {
      const error = new Error(`structured_self_model_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const eventId = reference.aspect_event_id;
    if (seenEventIds.has(eventId) || seenAspectIds.has(reference.aspect_id)) {
      const error = new Error(`Phase68B history reuses event or aspect identity at ${eventId}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedAspectEvent(events[eventId], eventId);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (
      reference.aspect_event_hash !== event.aspect_event_hash
      || reference.aspect_id !== event.aspect_id
      || reference.aspect_key !== event.aspect_key
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.operation !== event.operation
      || reference.aspect_type !== event.aspect_type
      || reference.previous_aspect_event_id !== event.previous_aspect_event_id
      || reference.previous_aspect_event_hash !== event.previous_aspect_event_hash
      || event.previous_aspect_event_id !== (previous?.aspect_event_id ?? null)
      || event.previous_aspect_event_hash !== (previous?.aspect_event_hash ?? null)
    ) {
      const error = new Error(`Phase68B history reference ${eventId} breaks its canonical per-character chain.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    latestByCharacter.set(key, event);
    seenEventIds.add(eventId);
    seenAspectIds.add(event.aspect_id);
  }
  return { events, history, latestByCharacter, seenAspectIds };
}

export function projectWorldSimulationEffectiveStructuredSelfModel(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateHistory(worldState);
  const aspectsByCharacter = {};
  existing.history.forEach((reference, historyIndex) => {
    const event = existing.events[reference.aspect_event_id];
    aspectsByCharacter[event.character] ??= {};
    aspectsByCharacter[event.character][event.aspect_id] = {
      aspect_id: event.aspect_id,
      aspect_key: event.aspect_key,
      character: event.character,
      aspect_type: event.aspect_type,
      descriptor: cloneJson(event.descriptor),
      source_refs: cloneJson(event.source_refs),
      established_by_aspect_event_id: event.aspect_event_id,
      history_index: historyIndex,
      state: "formed",
      subjective_not_world_truth: true,
      epistemic_belief: false,
      self_model_content: true,
      self_model_accuracy_claimed: false,
      self_model_clarity_claimed: false,
      confidence: null,
      probability: null,
    };
  });
  const projection = {
    version: effectiveStructuredSelfModelProjectionVersion,
    source_version: worldSimulationStructuredSelfModelVersion,
    aspects_by_character: aspectsByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    formation_only: true,
    revision_applied: false,
    last_write_wins_applied: false,
    forced_cross_domain_consistency_applied: false,
    world_truth_authority_claimed: false,
    belief_authority_claimed: false,
    motivation_goal_authority_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function boundedSourcesForResolver(allSources, turnId) {
  const byCharacter = new Map();
  for (const source of allSources) {
    const key = characterKey(source.character);
    if (!byCharacter.has(key)) byCharacter.set(key, []);
    byCharacter.get(key).push(source);
  }
  const selected = [];
  for (const sources of byCharacter.values()) {
    const current = sources.filter((source) => source.source_turn_id === turnId);
    const currentKeys = new Set(current.map(sourceRefKey));
    const prior = sources
      .filter((source) => !currentKeys.has(sourceRefKey(source)))
      .sort((left, right) => Number(right.history_index) - Number(left.history_index)
        || compareText(left.source_event_id, right.source_event_id));
    const remaining = Math.max(0, structuredSelfModelMaxResolverSourcesPerCharacter - current.length);
    selected.push(...current, ...prior.slice(0, remaining));
  }
  return selected.sort((left, right) => {
    const character = compareText(characterKey(left.character), characterKey(right.character));
    if (character !== 0) return character;
    const currentLeft = left.source_turn_id === turnId ? 0 : 1;
    const currentRight = right.source_turn_id === turnId ? 0 : 1;
    return currentLeft - currentRight || Number(right.history_index) - Number(left.history_index);
  });
}

export function buildWorldSimulationStructuredSelfModelResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const sources = boundedSourcesForResolver(canonicalPhase68ASources(worldState), turnId);
  const currentTurnSources = sources.filter((source) => source.source_turn_id === turnId);
  const existingProjection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: worldState });
  const phase68AProjection = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({ world_state: worldState });
  const view = {
    version: worldSimulationStructuredSelfModelVersion,
    turn_id: turnId,
    current_turn_interpretation_refs: currentTurnSources.map((source) => ({
      source_kind: source.source_kind,
      source_event_id: source.source_event_id,
      source_event_hash: source.source_event_hash,
      character: source.character,
      character_view: cloneJson(source.character_view),
    })),
    available_interpretation_refs: sources.map((source) => ({
      source_kind: source.source_kind,
      source_event_id: source.source_event_id,
      source_event_hash: source.source_event_hash,
      character: source.character,
      character_view: cloneJson(source.character_view),
    })),
    effective_self_interpretations: cloneJson(phase68AProjection.interpretations_by_character),
    effective_structured_self_model: cloneJson(existingProjection.aspects_by_character),
    supported_operations: [...supportedOperations],
    supported_aspect_types: [...supportedAspectTypes],
    required_relation_by_aspect_type: cloneJson(relationByAspectType),
    current_turn_phase68a_trigger_required: true,
    same_character_evidence_only: true,
    formation_only: true,
    revision_requested: false,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_content_exposed: false,
    phase67_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    world_truth_judgment_requested: false,
    self_model_accuracy_requested: false,
    self_model_clarity_requested: false,
    confidence_probability_requested: false,
    motivation_goal_selection_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeSourceRefs(rawRefs, character, resolverView) {
  const available = new Map(resolverView.available_interpretation_refs.map((reference) => [sourceRefKey(reference), reference]));
  const refs = array(rawRefs).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`source_refs[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_REF_INVALID";
      throw error;
    }
    if (item.source_kind !== "phase68a_autobiographical_self_interpretation") {
      const error = new Error("Phase68B accepts only Phase68A interpretation sources.");
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_KIND_UNSUPPORTED";
      throw error;
    }
    const normalized = {
      source_kind: item.source_kind,
      source_event_id: boundedString(item.source_event_id, `source_refs[${index}].source_event_id`, 240,
        "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_REF_INVALID"),
      source_event_hash: boundedString(item.source_event_hash, `source_refs[${index}].source_event_hash`, 128,
        "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_REF_INVALID"),
    };
    const found = available.get(sourceRefKey(normalized));
    if (!found) {
      const error = new Error("Phase68B source is outside the bounded resolver view.");
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_OUT_OF_VIEW";
      throw error;
    }
    if (!sameCharacter(found.character, character)) {
      const error = new Error("Phase68B may use only same-character Phase68A evidence.");
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_CROSS_CHARACTER_SOURCE_FORBIDDEN";
      throw error;
    }
    return normalized;
  }).sort((left, right) => compareText(left.source_event_id, right.source_event_id));
  if (!refs.length || new Set(refs.map(sourceRefKey)).size !== refs.length) {
    const error = new Error("Phase68B source refs must be non-empty and unique.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SOURCE_REF_INVALID";
    throw error;
  }
  const current = new Set(resolverView.current_turn_interpretation_refs.map(sourceRefKey));
  if (!refs.some((reference) => current.has(sourceRefKey(reference)))) {
    const error = new Error("Phase68B formation requires a current-turn Phase68A interpretation trigger.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  return refs;
}

function normalizeDecision(raw, resolverView, existingProjection) {
  if (!isObject(raw)) {
    const error = new Error("Phase68B self-model decision must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_INVALID";
    throw error;
  }
  const character = boundedString(raw.character, "decision.character", 240,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_INVALID");
  const operation = boundedString(raw.operation, "decision.operation", 80,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_INVALID");
  if (operation !== "form") {
    const error = new Error(`Unsupported Phase68B operation: ${operation}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_OPERATION_UNSUPPORTED";
    throw error;
  }
  const aspectType = boundedString(raw.aspect_type, "decision.aspect_type", 80,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_INVALID");
  if (!supportedAspectTypes.includes(aspectType)) {
    const error = new Error(`Unsupported Phase68B aspect type: ${aspectType}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_ASPECT_TYPE_UNSUPPORTED";
    throw error;
  }
  const aspectKey = boundedString(raw.aspect_key, "decision.aspect_key", 160,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_INVALID");
  const descriptor = normalizeDescriptor(aspectType, raw.descriptor);
  const resolverViewHash = boundedString(raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash", 128, "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_RESOLVER_VIEW_HASH_REQUIRED");
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase68B decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const sourceRefs = normalizeSourceRefs(raw.source_refs, character, resolverView);
  const aspectId = `structured_self_model_aspect_${hashAgentRunValue({
    version: worldSimulationStructuredSelfModelVersion,
    character: characterKey(character),
    aspect_type: aspectType,
    aspect_key: aspectKey,
    descriptor,
    source_refs: sourceRefs,
  }).slice(0, 24)}`;
  const existing = object(existingProjection.aspects_by_character[character]);
  if (existing[aspectId]) {
    const error = new Error(`Phase68B aspect ${aspectId} already exists.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DUPLICATE";
    throw error;
  }
  return {
    character,
    operation,
    aspect_type: aspectType,
    aspect_key: aspectKey,
    aspect_id: aspectId,
    descriptor,
    source_refs: sourceRefs,
    resolver_view_hash: resolverViewHash,
    source: optionalString(raw.source) ?? "programmatic_structured_self_model_resolver",
    reason: optionalString(raw.reason) ?? "explicit_programmatic_structured_self_model_formation",
  };
}

function aspectEventFor(decision, previousEvent, turnId) {
  const base = {
    schema_version: structuredSelfModelAspectEventSchemaVersion,
    version: worldSimulationStructuredSelfModelVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: "form",
    aspect_id: decision.aspect_id,
    aspect_key: decision.aspect_key,
    aspect_type: decision.aspect_type,
    descriptor: cloneJson(decision.descriptor),
    source_refs: cloneJson(decision.source_refs),
    resolver_view_hash: decision.resolver_view_hash,
    previous_aspect_event_id: previousEvent?.aspect_event_id ?? null,
    previous_aspect_event_hash: previousEvent?.aspect_event_hash ?? null,
    formation_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      resolver_view_ref: `phase68b_resolver_view:${decision.resolver_view_hash}`,
      same_character_phase68a_evidence_only: true,
      current_turn_phase68a_trigger_required: true,
      formation_only: true,
      revision_applied: false,
      forced_cross_domain_consistency_applied: false,
      last_write_wins_applied: false,
    },
    source_semantics: {
      phase68a_interpretation_is_authoritative_source: true,
      phase68a_rewritten: false,
      world_truth_is_source: false,
      raw_memory_scanned: false,
      phase67_store_scanned: false,
      second_retrieval_engine_installed: false,
      hidden_semantic_graph_used: false,
      belief_resolution_modeled: false,
      self_model_revision_modeled: false,
      motivation_goal_selection_modeled: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    epistemic_belief: false,
    self_model_content: true,
    self_model_accuracy_claimed: false,
    self_model_clarity_claimed: false,
    motivation_goal_model: false,
    confidence: null,
    probability: null,
    personality_score: null,
    capability_score: null,
    freeform_profile_authority: false,
    character_brain_direct_write: false,
    status: "structured_self_model_aspect_formed",
  };
  const eventId = `structured_self_model_aspect_event_${hashAgentRunValue({
    version: worldSimulationStructuredSelfModelVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    aspect_id: decision.aspect_id,
    previous_aspect_event_hash: previousEvent?.aspect_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, aspect_event_id: eventId };
  event.aspect_event_hash = aspectEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: structuredSelfModelHistoryReferenceSchemaVersion,
    derived_index: true,
    aspect_event_id: event.aspect_event_id,
    aspect_event_hash: event.aspect_event_hash,
    aspect_id: event.aspect_id,
    aspect_key: event.aspect_key,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    aspect_type: event.aspect_type,
    previous_aspect_event_id: event.previous_aspect_event_id,
    previous_aspect_event_hash: event.previous_aspect_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationStructuredSelfModelContract() {
  return deepFreeze({
    version: worldSimulationStructuredSelfModelVersion,
    phase: "Phase68B",
    status: "structured_self_model_formation_installed",
    source_owner: "Phase68A",
    supported_operations: [...supportedOperations],
    supported_aspect_types: [...supportedAspectTypes],
    required_relation_by_aspect_type: cloneJson(relationByAspectType),
    immutable_aspect_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    current_turn_phase68a_trigger_required: true,
    same_character_phase68a_evidence_only: true,
    max_one_aspect_event_per_character_per_turn: true,
    effective_projection_replayable: true,
    effective_projection_version: effectiveStructuredSelfModelProjectionVersion,
    character_projection_version: structuredSelfModelCharacterProjectionVersion,
    formation_only: true,
    revision_modeled: false,
    last_write_wins_allowed: false,
    forced_cross_domain_consistency_required: false,
    self_model_accuracy_claimed: false,
    self_model_clarity_claimed: false,
    confidence_probability_modeled: false,
    scalar_personality_score_modeled: false,
    scalar_capability_score_modeled: false,
    freeform_profile_authority: false,
    world_truth_authority_claimed: false,
    belief_engine_duplicated: false,
    motivation_goal_selection_modeled: false,
    separate_retrieval_engine_installed: false,
    hidden_semantic_graph_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    committed_prior_turn_character_projection_only: true,
    same_turn_character_brain_feedback_allowed: false,
    same_turn_contamination_policy: "fail_closed",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationStructuredSelfModelAspects(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const rawDecisions = array(input.aspect_decisions);
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, aspect_decisions: rawDecisions });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateHistory(worldState);
  const existingProjection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: worldState });
  const resolverView = buildWorldSimulationStructuredSelfModelResolverView({ world_state: worldState, turn_id: turnId });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, existingProjection));
  const existingCharactersThisTurn = new Set(existing.history
    .map((reference) => existing.events[reference.aspect_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => characterKey(event.character)));
  const seenCharacters = new Set();
  const seenAspectIds = new Set();
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    if (existingCharactersThisTurn.has(key) || seenCharacters.has(key)) {
      const error = new Error(`Phase68B v1 allows at most one durable self-model aspect per character per turn: ${decision.character}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PER_CHARACTER_TURN_LIMIT";
      throw error;
    }
    if (seenAspectIds.has(decision.aspect_id)) {
      const error = new Error(`Duplicate Phase68B aspect decision ${decision.aspect_id}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_DECISION_DUPLICATE";
      throw error;
    }
    seenCharacters.add(key);
    seenAspectIds.add(decision.aspect_id);
  }

  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const event = aspectEventFor(decision, latestByCharacter.get(key) ?? null, turnId);
    if (object(preview.structured_self_model_aspect_events)[event.aspect_event_id]) {
      const error = new Error(`Phase68B aspect event ${event.aspect_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.structured_self_model_aspect_events = object(preview.structured_self_model_aspect_events);
    preview.structured_self_model_aspect_events[event.aspect_event_id] = cloneJson(event);
    const reference = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(reference);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `structured_self_model_aspect_events.${event.aspect_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable StructuredSelfModelAspectEvent ${event.aspect_event_id}`,
      source_layer: "structured_self_model",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.structured_self_model_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "structured_self_model_history",
      from: cloneJson(worldState.structured_self_model_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase68B self-model history reference(s)`,
      source_layer: "structured_self_model",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase68B structured self model mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationStructuredSelfModelVersion,
    result: {
      aspect_decision_count: decisions.length,
      aspect_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_structured_self_model_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        same_character_phase68a_evidence_only: true,
        current_turn_phase68a_trigger_required: true,
        formation_only: true,
        revision_applied: false,
        world_truth_authority_claimed: false,
        raw_memory_scanned: false,
        phase67_store_scanned: false,
        second_retrieval_engine_installed: false,
        hidden_semantic_graph_used: false,
        self_model_accuracy_claimed: false,
        self_model_clarity_claimed: false,
        confidence_probability_modeled: false,
        motivation_goal_selection_applied: false,
        character_brain_direct_write_used: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}

function characterAspectRecords(projection, character) {
  for (const [name, records] of Object.entries(projection.aspects_by_character ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}
function assertNoSameTurnWrites(worldState, character, currentTurnId) {
  for (const reference of array(worldState.structured_self_model_history)) {
    if (sameCharacter(reference?.character, character) && reference?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase68B cannot expose self-model state after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}

export function projectWorldSimulationStructuredSelfModelForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnWrites(worldState, character, currentTurnId);
  const effectiveProjection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: worldState });
  const records = Object.values(characterAspectRecords(effectiveProjection, character))
    .sort((left, right) => Number(right.history_index) - Number(left.history_index)
      || compareText(left.aspect_key, right.aspect_key));
  const selected = records.slice(0, structuredSelfModelMaxCharacterItems);
  const aspects = selected.map((record) => ({
    aspect_type: record.aspect_type,
    domain: record.descriptor.domain,
    relation: record.descriptor.relation,
    object: record.descriptor.object_ref,
    qualifiers: cloneJson(record.descriptor.qualifiers),
    subjective_not_world_truth: true,
  }));
  const characterView = {
    source: "committed_prior_turn_structured_self_model",
    aspects,
    aspects_truncated: selected.length < records.length,
    formation_only: true,
    revision_applied: false,
    self_model_accuracy_claimed: false,
    self_model_clarity_claimed: false,
    confidence_probability_exposed: false,
    numeric_scores_exposed: false,
    motivation_goal_authority_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase68B bounded character projection mutated its input.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: structuredSelfModelCharacterProjectionVersion,
    source_projection_version: effectiveStructuredSelfModelProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effectiveProjection.projection_hash,
      source_aspect_count: records.length,
      projected_aspect_count: selected.length,
      recency_used_for_transport_only: true,
      aspect_ids_exposed: false,
      event_ids_exposed: false,
      source_ids_hashes_exposed: false,
      source_turn_ids_exposed: false,
      world_truth_authority_exposed: false,
      belief_authority_exposed: false,
      confidence_probability_exposed: false,
      numeric_personality_capability_scores_exposed: false,
      persistent_projection_written: false,
      same_turn_feedback_allowed: false,
    },
    boundaries: {
      same_character_only: true,
      committed_prior_turn_only: true,
      same_turn_contamination_policy: "fail_closed",
      character_brain_may_observe_bounded_self_model_context: true,
      action_proposer_may_observe_bounded_self_model_context: true,
      character_brain_may_mutate_self_model_history: false,
      action_proposer_may_mutate_self_model_history: false,
      world_truth_authority_exposed: false,
      motivation_goal_authority_exposed: false,
    },
  });
}
