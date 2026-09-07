import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  structuredSelfModelAspectEventSchemaVersion,
  structuredSelfModelHistoryReferenceSchemaVersion,
  worldSimulationStructuredSelfModelVersion,
  projectWorldSimulationEffectiveStructuredSelfModel,
} from "./world-simulation-structured-self-model-service.mjs";
import {
  autobiographicalSelfInterpretationEventSchemaVersion,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "./world-simulation-autobiographical-self-interpretation-service.mjs";

export const worldSimulationStructuredSelfModelRevisionVersion =
  "phase68c-structured-self-model-revision-v1";
export const structuredSelfModelRevisionEventSchemaVersion =
  "phase68c-structured-self-model-revision-event-v1";
export const structuredSelfModelRevisionHistoryReferenceSchemaVersion =
  "phase68c-structured-self-model-revision-history-ref-v1";
export const effectiveRevisedStructuredSelfModelProjectionVersion =
  "phase68c-effective-revised-structured-self-model-projection-v1";
export const revisedStructuredSelfModelCharacterProjectionVersion =
  "phase68c-bounded-revised-structured-self-model-character-projection-v1";
export const structuredSelfModelRevisionMaxCharacterItems = 10;
export const structuredSelfModelRevisionMaxResolverSourcesPerCharacter = 48;

const supportedOperations = Object.freeze(["support", "challenge", "revise"]);
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
function boundedString(value, label, maxLength = 160, code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) { return boundedString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW"); }
function sameCharacter(left, right) { return characterKey(left) === characterKey(right); }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function hashWithout(value, field) { const body = cloneJson(value); delete body[field]; return hashAgentRunValue(body); }
function revisionEventHash(event) { return hashWithout(event, "revision_event_hash"); }
function phase68AEventHash(event) { return hashWithout(event, "interpretation_event_hash"); }
function phase68BEventHash(event) { return hashWithout(event, "aspect_event_hash"); }
function sourceRefKey(ref) { return [ref?.source_kind, ref?.source_event_id, ref?.source_event_hash].join("\u0000"); }
function uniqueSortedStrings(values, label, maxItems = 8, maxLength = 240) {
  const result = [...new Set(array(values).map(optionalString).filter(Boolean))].sort(compareText);
  if (!result.length || result.length > maxItems || result.some((value) => value.length > maxLength)) {
    const error = new Error(`${label} is invalid or exceeds the Phase68C bound.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_TARGET_INVALID";
    throw error;
  }
  return result;
}
function boundedQualifiers(values) {
  const result = [...new Set(array(values).map(optionalString).filter(Boolean))].sort(compareText);
  if (result.length > 4 || result.some((value) => value.length > 80)) {
    const error = new Error("replacement_descriptor.qualifiers exceeds the bounded Phase68C shape.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  return result;
}
function normalizeDescriptor(aspectType, raw) {
  if (!isObject(raw)) {
    const error = new Error("Phase68C replacement descriptor must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  const relation = boundedString(raw.relation, "replacement_descriptor.relation", 80,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID");
  if (relation !== relationByAspectType[aspectType] || raw.subject_scope !== "self") {
    const error = new Error(`Phase68C ${aspectType} replacement descriptor relation/subject is invalid.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  return {
    subject_scope: "self",
    domain: boundedString(raw.domain, "replacement_descriptor.domain", 120,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID"),
    relation,
    object_ref: boundedString(raw.object_ref, "replacement_descriptor.object_ref", 160,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DESCRIPTOR_INVALID"),
    qualifiers: boundedQualifiers(raw.qualifiers),
  };
}

function validatePhase68AEvent(worldState, eventId) {
  const event = object(object(worldState.autobiographical_self_interpretation_events)[eventId]);
  if (!Object.keys(event).length
      || event.schema_version !== autobiographicalSelfInterpretationEventSchemaVersion
      || event.version !== worldSimulationAutobiographicalSelfInterpretationVersion
      || event.immutable !== true
      || event.interpretation_event_id !== eventId
      || !optionalString(event.interpretation_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || phase68AEventHash(event) !== event.interpretation_event_hash) {
    const error = new Error(`Phase68C cannot resolve canonical Phase68A event ${eventId}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_PHASE68A_SOURCE_INVALID";
    throw error;
  }
  return event;
}
function validatePhase68BEvent(worldState, eventId) {
  const event = object(object(worldState.structured_self_model_aspect_events)[eventId]);
  if (!Object.keys(event).length
      || event.schema_version !== structuredSelfModelAspectEventSchemaVersion
      || event.version !== worldSimulationStructuredSelfModelVersion
      || event.immutable !== true
      || event.aspect_event_id !== eventId
      || !optionalString(event.aspect_event_hash)
      || !optionalString(event.aspect_id)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || phase68BEventHash(event) !== event.aspect_event_hash) {
    const error = new Error(`Phase68C cannot resolve canonical Phase68B event ${eventId}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_PHASE68B_SOURCE_INVALID";
    throw error;
  }
  return event;
}
function canonicalSources(worldState) {
  const sources = [];
  for (const [index, ref] of array(worldState.autobiographical_self_interpretation_history).entries()) {
    const eventId = optionalString(ref?.interpretation_event_id);
    if (!eventId) continue;
    const event = validatePhase68AEvent(worldState, eventId);
    if (ref.interpretation_event_hash !== event.interpretation_event_hash) {
      const error = new Error(`Phase68A source history ${index} is not canonical.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_HISTORY_INVALID";
      throw error;
    }
    sources.push({
      source_kind: "phase68a_autobiographical_self_interpretation",
      source_event_id: event.interpretation_event_id,
      source_event_hash: event.interpretation_event_hash,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: index,
      character_view: { interpretation_kind: event.interpretation_kind, qualifiers: cloneJson(event.qualifiers), subjective_not_world_truth: true },
    });
  }
  for (const [index, ref] of array(worldState.structured_self_model_history).entries()) {
    if (ref?.schema_version !== structuredSelfModelHistoryReferenceSchemaVersion) continue;
    const eventId = optionalString(ref?.aspect_event_id);
    if (!eventId) continue;
    const event = validatePhase68BEvent(worldState, eventId);
    if (ref.aspect_event_hash !== event.aspect_event_hash || ref.aspect_id !== event.aspect_id) {
      const error = new Error(`Phase68B source history ${index} is not canonical.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_HISTORY_INVALID";
      throw error;
    }
    sources.push({
      source_kind: "phase68b_structured_self_model_aspect",
      source_event_id: event.aspect_event_id,
      source_event_hash: event.aspect_event_hash,
      character: event.character,
      source_turn_id: event.source_turn_id,
      history_index: index,
      character_view: { aspect_type: event.aspect_type, descriptor: cloneJson(event.descriptor), subjective_not_world_truth: true },
    });
  }
  return sources;
}

function validatePersistedRevisionEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== structuredSelfModelRevisionEventSchemaVersion
      || event.version !== worldSimulationStructuredSelfModelRevisionVersion
      || event.immutable !== true
      || event.revision_event_id !== eventId
      || !optionalString(event.revision_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !supportedOperations.includes(event.operation)
      || !Array.isArray(event.target_aspect_ids)
      || event.target_aspect_ids.length < 1
      || !Array.isArray(event.source_refs)
      || event.source_refs.length < 1
      || !optionalString(event.resolver_view_hash)
      || event.subjective_not_world_truth !== true
      || event.world_truth_verified !== false
      || event.epistemic_belief !== false
      || event.self_model_revision !== true
      || event.self_model_accuracy_claimed !== false
      || event.self_model_clarity_claimed !== false
      || event.motivation_goal_model !== false
      || event.confidence !== null
      || event.probability !== null
      || event.character_brain_direct_write !== false
      || event.status !== "structured_self_model_revision_recorded") {
    const error = new Error(`StructuredSelfModelRevisionEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_EVENT_INVALID";
    throw error;
  }
  if (event.operation === "revise") {
    if (!optionalString(event.replacement_aspect_id)
        || !supportedAspectTypes.includes(event.replacement_aspect_type)) {
      const error = new Error(`StructuredSelfModelRevisionEvent ${eventId} lacks replacement aspect.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_INVALID";
      throw error;
    }
    normalizeDescriptor(event.replacement_aspect_type, event.replacement_descriptor);
  } else if (event.replacement_aspect_id !== null || event.replacement_aspect_type !== null || event.replacement_descriptor !== null) {
    const error = new Error(`${event.operation} may not create a replacement aspect.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_FORBIDDEN";
    throw error;
  }
  if (revisionEventHash(event) !== event.revision_event_hash) {
    const error = new Error(`StructuredSelfModelRevisionEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}
function validateRevisionHistory(worldState) {
  if (Object.hasOwn(worldState, "structured_self_model_revision_events") && !isObject(worldState.structured_self_model_revision_events)) {
    const error = new Error("structured_self_model_revision_events must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "structured_self_model_revision_history") && !Array.isArray(worldState.structured_self_model_revision_history)) {
    const error = new Error("structured_self_model_revision_history must be an array.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.structured_self_model_revision_events);
  const history = array(worldState.structured_self_model_revision_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const seenReplacementAspectIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== structuredSelfModelRevisionHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.revision_event_id)
        || !optionalString(ref.revision_event_hash)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || !supportedOperations.includes(ref.operation)
        || !Array.isArray(ref.target_aspect_ids)
        || ref.status !== "structured_self_model_revision_recorded") {
      const error = new Error(`structured_self_model_revision_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.revision_event_id)) {
      const error = new Error(`Duplicate Phase68C revision event ${ref.revision_event_id}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedRevisionEvent(events[ref.revision_event_id], ref.revision_event_id);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (ref.revision_event_hash !== event.revision_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.operation !== event.operation
        || JSON.stringify(ref.target_aspect_ids) !== JSON.stringify(event.target_aspect_ids)
        || ref.replacement_aspect_id !== event.replacement_aspect_id
        || ref.previous_revision_event_id !== event.previous_revision_event_id
        || ref.previous_revision_event_hash !== event.previous_revision_event_hash
        || event.previous_revision_event_id !== (previous?.revision_event_id ?? null)
        || event.previous_revision_event_hash !== (previous?.revision_event_hash ?? null)) {
      const error = new Error(`Phase68C history reference ${ref.revision_event_id} breaks its canonical per-character chain.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (event.replacement_aspect_id) {
      if (seenReplacementAspectIds.has(event.replacement_aspect_id)) {
        const error = new Error(`Phase68C replacement aspect identity ${event.replacement_aspect_id} was reused.`);
        error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_IDENTITY_REUSE_FORBIDDEN";
        throw error;
      }
      seenReplacementAspectIds.add(event.replacement_aspect_id);
    }
    seenEventIds.add(event.revision_event_id);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, seenReplacementAspectIds };
}

function findCharacterRecords(recordsByCharacter, character) {
  for (const [name, records] of Object.entries(recordsByCharacter ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

export function projectWorldSimulationEffectiveRevisedStructuredSelfModel(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const baseProjection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: worldState });
  const revision = validateRevisionHistory(worldState);
  const aspectsByCharacter = cloneJson(baseProjection.aspects_by_character);
  for (const records of Object.values(aspectsByCharacter)) {
    for (const record of Object.values(object(records))) {
      record.state = "active";
      record.support_event_ids = [];
      record.challenge_event_ids = [];
      record.superseded_by_revision_event_id = null;
      record.replacement_aspect_id = null;
    }
  }
  revision.history.forEach((ref, historyIndex) => {
    const event = revision.events[ref.revision_event_id];
    aspectsByCharacter[event.character] ??= {};
    const records = aspectsByCharacter[event.character];
    for (const targetId of event.target_aspect_ids) {
      const target = records[targetId];
      if (!target || target.state !== "active") {
        const error = new Error(`Phase68C target ${targetId} is not active during replay.`);
        error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_TARGET_INVALID";
        throw error;
      }
      if (event.operation === "support") target.support_event_ids.push(event.revision_event_id);
      if (event.operation === "challenge") target.challenge_event_ids.push(event.revision_event_id);
      if (event.operation === "revise") {
        target.state = "superseded";
        target.superseded_by_revision_event_id = event.revision_event_id;
        target.replacement_aspect_id = event.replacement_aspect_id;
      }
    }
    if (event.operation === "revise") {
      if (records[event.replacement_aspect_id]) {
        const error = new Error(`Phase68C replacement aspect ${event.replacement_aspect_id} already exists.`);
        error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_IDENTITY_REUSE_FORBIDDEN";
        throw error;
      }
      records[event.replacement_aspect_id] = {
        aspect_id: event.replacement_aspect_id,
        aspect_key: event.replacement_aspect_key,
        character: event.character,
        aspect_type: event.replacement_aspect_type,
        descriptor: cloneJson(event.replacement_descriptor),
        source_refs: cloneJson(event.source_refs),
        established_by_revision_event_id: event.revision_event_id,
        history_index: Number(baseProjection.replayed_event_count) + historyIndex,
        state: "active",
        support_event_ids: [],
        challenge_event_ids: [],
        superseded_by_revision_event_id: null,
        replacement_aspect_id: null,
        subjective_not_world_truth: true,
        epistemic_belief: false,
        self_model_content: true,
        self_model_accuracy_claimed: false,
        self_model_clarity_claimed: false,
        confidence: null,
        probability: null,
      };
    }
  });
  const projection = {
    version: effectiveRevisedStructuredSelfModelProjectionVersion,
    source_formation_version: worldSimulationStructuredSelfModelVersion,
    source_revision_version: worldSimulationStructuredSelfModelRevisionVersion,
    aspects_by_character: aspectsByCharacter,
    formation_history_hash: baseProjection.source_history_hash,
    revision_history_hash: hashAgentRunValue(revision.history),
    replayed_formation_event_count: baseProjection.replayed_event_count,
    replayed_revision_event_count: revision.history.length,
    replayable_projection: true,
    explicit_revision_only: true,
    support_preserves_active_state: true,
    challenge_preserves_active_state: true,
    last_write_wins_applied: false,
    forced_global_coherence_applied: false,
    neighboring_aspect_propagation_applied: false,
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
    const prior = sources.filter((source) => !currentKeys.has(sourceRefKey(source)))
      .sort((left, right) => Number(right.history_index) - Number(left.history_index)
        || compareText(left.source_event_id, right.source_event_id));
    selected.push(...current, ...prior.slice(0, Math.max(0, structuredSelfModelRevisionMaxResolverSourcesPerCharacter - current.length)));
  }
  return selected;
}

export function buildWorldSimulationStructuredSelfModelRevisionResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const sources = boundedSourcesForResolver(canonicalSources(worldState), turnId);
  const effective = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: worldState });
  const view = {
    version: worldSimulationStructuredSelfModelRevisionVersion,
    turn_id: turnId,
    current_turn_trigger_refs: sources.filter((source) => source.source_turn_id === turnId).map((source) => ({
      source_kind: source.source_kind,
      source_event_id: source.source_event_id,
      source_event_hash: source.source_event_hash,
      character: source.character,
      character_view: cloneJson(source.character_view),
    })),
    available_source_refs: sources.map((source) => ({
      source_kind: source.source_kind,
      source_event_id: source.source_event_id,
      source_event_hash: source.source_event_hash,
      character: source.character,
      character_view: cloneJson(source.character_view),
    })),
    effective_structured_self_model: cloneJson(effective.aspects_by_character),
    supported_operations: [...supportedOperations],
    supported_aspect_types: [...supportedAspectTypes],
    required_relation_by_aspect_type: cloneJson(relationByAspectType),
    current_turn_phase68a_or_phase68b_trigger_required: true,
    same_character_evidence_and_targets_only: true,
    explicit_targets_required: true,
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
  const available = new Map(resolverView.available_source_refs.map((ref) => [sourceRefKey(ref), ref]));
  const refs = array(rawRefs).map((raw, index) => {
    if (!isObject(raw) || !["phase68a_autobiographical_self_interpretation", "phase68b_structured_self_model_aspect"].includes(raw.source_kind)) {
      const error = new Error(`source_refs[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_REF_INVALID";
      throw error;
    }
    const ref = {
      source_kind: raw.source_kind,
      source_event_id: boundedString(raw.source_event_id, `source_refs[${index}].source_event_id`, 240,
        "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_REF_INVALID"),
      source_event_hash: boundedString(raw.source_event_hash, `source_refs[${index}].source_event_hash`, 128,
        "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_REF_INVALID"),
    };
    const found = available.get(sourceRefKey(ref));
    if (!found) {
      const error = new Error("Phase68C source is outside the bounded resolver view.");
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_OUT_OF_VIEW";
      throw error;
    }
    if (!sameCharacter(found.character, character)) {
      const error = new Error("Phase68C may use only same-character evidence.");
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_CROSS_CHARACTER_SOURCE_FORBIDDEN";
      throw error;
    }
    return ref;
  }).sort((left, right) => compareText(sourceRefKey(left), sourceRefKey(right)));
  if (!refs.length || new Set(refs.map(sourceRefKey)).size !== refs.length) {
    const error = new Error("Phase68C source refs must be non-empty and unique.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SOURCE_REF_INVALID";
    throw error;
  }
  const current = new Set(resolverView.current_turn_trigger_refs.map(sourceRefKey));
  if (!refs.some((ref) => current.has(sourceRefKey(ref)))) {
    const error = new Error("Phase68C revision requires a current-turn Phase68A or Phase68B trigger.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_CURRENT_TURN_TRIGGER_REQUIRED";
    throw error;
  }
  return refs;
}

function normalizeDecision(raw, resolverView, effectiveProjection) {
  if (!isObject(raw)) {
    const error = new Error("Phase68C revision decision must be an object.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DECISION_INVALID";
    throw error;
  }
  const character = boundedString(raw.character, "decision.character", 240,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DECISION_INVALID");
  const operation = boundedString(raw.operation, "decision.operation", 80,
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_DECISION_INVALID");
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase68C operation ${operation}.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_OPERATION_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = boundedString(raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash", 128, "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_RESOLVER_VIEW_HASH_REQUIRED");
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase68C decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const sourceRefs = normalizeSourceRefs(raw.source_refs, character, resolverView);
  const targetAspectIds = uniqueSortedStrings(raw.target_aspect_ids, "target_aspect_ids");
  const records = findCharacterRecords(effectiveProjection.aspects_by_character, character);
  for (const targetId of targetAspectIds) {
    if (!records[targetId] || records[targetId].state !== "active") {
      const error = new Error(`Phase68C target ${targetId} is not an active same-character aspect.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_TARGET_INVALID";
      throw error;
    }
  }
  let replacement = { aspect_id: null, aspect_key: null, aspect_type: null, descriptor: null };
  if (operation === "revise") {
    const aspectType = boundedString(raw.replacement_aspect_type, "replacement_aspect_type", 80,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_INVALID");
    if (!supportedAspectTypes.includes(aspectType)) {
      const error = new Error(`Unsupported replacement aspect type ${aspectType}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_INVALID";
      throw error;
    }
    const aspectKey = boundedString(raw.replacement_aspect_key, "replacement_aspect_key", 160,
      "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_INVALID");
    const descriptor = normalizeDescriptor(aspectType, raw.replacement_descriptor);
    const aspectId = `structured_self_model_aspect_${hashAgentRunValue({
      version: worldSimulationStructuredSelfModelRevisionVersion,
      character: characterKey(character),
      aspect_type: aspectType,
      aspect_key: aspectKey,
      descriptor,
      source_refs: sourceRefs,
      supersedes: targetAspectIds,
    }).slice(0, 24)}`;
    if (records[aspectId]) {
      const error = new Error(`Phase68C replacement aspect ${aspectId} already exists.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    replacement = { aspect_id: aspectId, aspect_key: aspectKey, aspect_type: aspectType, descriptor };
  } else if (raw.replacement_aspect_type != null || raw.replacement_aspect_key != null || raw.replacement_descriptor != null) {
    const error = new Error(`${operation} may not define a replacement aspect.`);
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_REPLACEMENT_FORBIDDEN";
    throw error;
  }
  return {
    character, operation, source_refs: sourceRefs, target_aspect_ids: targetAspectIds,
    replacement_aspect_id: replacement.aspect_id,
    replacement_aspect_key: replacement.aspect_key,
    replacement_aspect_type: replacement.aspect_type,
    replacement_descriptor: replacement.descriptor,
    resolver_view_hash: resolverViewHash,
    source: optionalString(raw.source) ?? "programmatic_structured_self_model_revision_resolver",
    reason: optionalString(raw.reason) ?? `explicit_programmatic_self_model_${operation}`,
  };
}

function revisionEventFor(decision, previousEvent, turnId) {
  const base = {
    schema_version: structuredSelfModelRevisionEventSchemaVersion,
    version: worldSimulationStructuredSelfModelRevisionVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    target_aspect_ids: cloneJson(decision.target_aspect_ids),
    source_refs: cloneJson(decision.source_refs),
    replacement_aspect_id: decision.replacement_aspect_id,
    replacement_aspect_key: decision.replacement_aspect_key,
    replacement_aspect_type: decision.replacement_aspect_type,
    replacement_descriptor: cloneJson(decision.replacement_descriptor),
    resolver_view_hash: decision.resolver_view_hash,
    previous_revision_event_id: previousEvent?.revision_event_id ?? null,
    previous_revision_event_hash: previousEvent?.revision_event_hash ?? null,
    revision_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      resolver_view_ref: `phase68c_resolver_view:${decision.resolver_view_hash}`,
      same_character_evidence_and_targets_only: true,
      current_turn_phase68a_or_phase68b_trigger_required: true,
      explicit_targets_required: true,
      support_preserves_active_state: true,
      challenge_preserves_active_state: true,
      revise_explicitly_supersedes_targets: true,
      last_write_wins_applied: false,
      forced_global_coherence_applied: false,
    },
    source_semantics: {
      phase68a_phase68b_are_authoritative_cognition_sources: true,
      phase68a_rewritten: false,
      phase68b_rewritten: false,
      world_truth_is_source: false,
      raw_memory_scanned: false,
      phase67_store_scanned: false,
      second_retrieval_engine_installed: false,
      hidden_semantic_graph_used: false,
      belief_revision_modeled: false,
      neighboring_aspect_propagation_modeled: false,
      motivation_goal_selection_modeled: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    epistemic_belief: false,
    self_model_revision: true,
    self_model_accuracy_claimed: false,
    self_model_clarity_claimed: false,
    motivation_goal_model: false,
    confidence: null,
    probability: null,
    character_brain_direct_write: false,
    status: "structured_self_model_revision_recorded",
  };
  const eventId = `structured_self_model_revision_event_${hashAgentRunValue({
    version: worldSimulationStructuredSelfModelRevisionVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    target_aspect_ids: decision.target_aspect_ids,
    replacement_aspect_id: decision.replacement_aspect_id,
    previous_revision_event_hash: previousEvent?.revision_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, revision_event_id: eventId };
  event.revision_event_hash = revisionEventHash(event);
  return deepFreeze(event);
}
function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: structuredSelfModelRevisionHistoryReferenceSchemaVersion,
    derived_index: true,
    revision_event_id: event.revision_event_id,
    revision_event_hash: event.revision_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    target_aspect_ids: cloneJson(event.target_aspect_ids),
    replacement_aspect_id: event.replacement_aspect_id,
    previous_revision_event_id: event.previous_revision_event_id,
    previous_revision_event_hash: event.previous_revision_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationStructuredSelfModelRevisionContract() {
  return deepFreeze({
    version: worldSimulationStructuredSelfModelRevisionVersion,
    phase: "Phase68C",
    status: "structured_self_model_revision_installed",
    source_owners: ["Phase68A", "Phase68B"],
    supported_operations: [...supportedOperations],
    supported_aspect_types: [...supportedAspectTypes],
    immutable_revision_event_write_once_required: true,
    append_only_revision_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    current_turn_phase68a_or_phase68b_trigger_required: true,
    same_character_evidence_and_targets_only: true,
    explicit_targets_required: true,
    support_preserves_active_state: true,
    challenge_preserves_active_state: true,
    revise_explicitly_supersedes_targets: true,
    replacement_receives_new_deterministic_identity: true,
    max_one_revision_event_per_character_per_turn: true,
    unresolved_challenges_may_coexist: true,
    last_write_wins_allowed: false,
    forced_global_coherence_required: false,
    neighboring_aspect_auto_propagation_allowed: false,
    world_truth_authority_claimed: false,
    belief_engine_duplicated: false,
    confidence_probability_modeled: false,
    self_model_accuracy_score_modeled: false,
    self_model_clarity_score_modeled: false,
    motivation_goal_selection_modeled: false,
    separate_retrieval_engine_installed: false,
    hidden_semantic_graph_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    committed_prior_turn_character_projection_only: true,
    same_turn_character_brain_feedback_allowed: false,
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationStructuredSelfModelRevisions(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const rawDecisions = array(input.revision_decisions);
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, revision_decisions: rawDecisions });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateRevisionHistory(worldState);
  const effective = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: worldState });
  const resolverView = buildWorldSimulationStructuredSelfModelRevisionResolverView({ world_state: worldState, turn_id: turnId });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, effective));
  const existingCharactersThisTurn = new Set(existing.history
    .map((ref) => existing.events[ref.revision_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => characterKey(event.character)));
  const seenCharacters = new Set();
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    if (existingCharactersThisTurn.has(key) || seenCharacters.has(key)) {
      const error = new Error(`Phase68C allows at most one durable self-model revision per character per turn: ${decision.character}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_PER_CHARACTER_TURN_LIMIT";
      throw error;
    }
    seenCharacters.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const event = revisionEventFor(decision, latestByCharacter.get(key) ?? null, turnId);
    if (object(preview.structured_self_model_revision_events)[event.revision_event_id]) {
      const error = new Error(`Phase68C revision event ${event.revision_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.structured_self_model_revision_events = object(preview.structured_self_model_revision_events);
    preview.structured_self_model_revision_events[event.revision_event_id] = cloneJson(event);
    const reference = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(reference);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `structured_self_model_revision_events.${event.revision_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable StructuredSelfModelRevisionEvent ${event.revision_event_id}`,
      source_layer: "structured_self_model_revision",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.structured_self_model_revision_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "structured_self_model_revision_history",
      from: cloneJson(worldState.structured_self_model_revision_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase68C self-model revision history reference(s)`,
      source_layer: "structured_self_model_revision",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase68C structured self-model revision mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationStructuredSelfModelRevisionVersion,
    result: {
      revision_decision_count: decisions.length,
      revision_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_revised_structured_self_model_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        same_character_evidence_and_targets_only: true,
        current_turn_phase68a_or_phase68b_trigger_required: true,
        explicit_targets_required: true,
        support_preserves_active_state: true,
        challenge_preserves_active_state: true,
        revise_explicitly_supersedes_targets: true,
        last_write_wins_applied: false,
        forced_global_coherence_applied: false,
        neighboring_aspect_propagation_applied: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        self_model_accuracy_clarity_scores_modeled: false,
        motivation_goal_selection_applied: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}

function assertNoSameTurnWrites(worldState, character, currentTurnId) {
  for (const ref of array(worldState.structured_self_model_revision_history)) {
    if (sameCharacter(ref?.character, character) && ref?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase68C cannot expose revised self-model state after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}
export function projectWorldSimulationRevisedStructuredSelfModelForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnWrites(worldState, character, currentTurnId);
  const effective = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: worldState });
  const records = Object.values(findCharacterRecords(effective.aspects_by_character, character))
    .filter((record) => record.state === "active")
    .sort((left, right) => Number(right.history_index) - Number(left.history_index)
      || compareText(left.aspect_key, right.aspect_key));
  const selected = records.slice(0, structuredSelfModelRevisionMaxCharacterItems);
  const aspects = selected.map((record) => ({
    aspect_type: record.aspect_type,
    domain: record.descriptor.domain,
    relation: record.descriptor.relation,
    object: record.descriptor.object_ref,
    qualifiers: cloneJson(record.descriptor.qualifiers),
    revision_state: record.challenge_event_ids?.length ? "challenged_but_active" : "active",
    subjective_not_world_truth: true,
  }));
  const characterView = {
    source: "committed_prior_turn_effective_revised_structured_self_model",
    aspects,
    aspects_truncated: selected.length < records.length,
    explicit_revision_only: true,
    unresolved_challenge_preserved: true,
    self_model_accuracy_claimed: false,
    self_model_clarity_claimed: false,
    confidence_probability_exposed: false,
    motivation_goal_authority_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase68C bounded character projection mutated its input.");
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: revisedStructuredSelfModelCharacterProjectionVersion,
    source_projection_version: effectiveRevisedStructuredSelfModelProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effective.projection_hash,
      source_active_aspect_count: records.length,
      projected_aspect_count: selected.length,
      aspect_ids_exposed: false,
      revision_event_ids_exposed: false,
      source_ids_hashes_exposed: false,
      source_turn_ids_exposed: false,
      world_truth_authority_exposed: false,
      confidence_probability_exposed: false,
      motivation_goal_authority_exposed: false,
      same_turn_feedback_allowed: false,
    },
    boundaries: {
      same_character_only: true,
      committed_prior_turn_only: true,
      character_brain_may_observe_bounded_revised_self_model_context: true,
      character_brain_may_mutate_revision_history: false,
      world_truth_authority_exposed: false,
      motivation_goal_authority_exposed: false,
    },
  });
}
