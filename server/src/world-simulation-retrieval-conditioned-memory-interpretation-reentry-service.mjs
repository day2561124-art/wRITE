import { hashAgentRunValue } from "./agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "./world-simulation-memory-retrieval-persistence-service.mjs";
import { validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory } from "./world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";
import { projectWorldSimulationSubjectiveCognition } from "./world-simulation-subjective-cognition-projection-service.mjs";

export const worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion =
  "phase87a-retrieval-conditioned-memory-interpretation-reentry-v1";
export const worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries = 8;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_INPUT_INVALID";
  throw error;
}
function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function verifyCurrentRetrievalEvent(worldState, event, character, currentTurnId) {
  if (!isObject(event)
    || event.schema_version !== memoryRetrievalEventSchemaVersion
    || !optionalString(event.retrieval_event_id)
    || !optionalString(event.retrieval_event_hash)
    || !sameCharacter(event.character, character)
    || event.turn_id !== currentTurnId
    || event.immutable !== true
    || !Array.isArray(event.memory_recoveries)
    || typeof event.recovered_any_content !== "boolean") {
    const error = new Error("Phase87A requires one immutable canonical RetrievalEvent for the current character and turn.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_INVALID";
    throw error;
  }
  const body = cloneJson(event);
  delete body.retrieval_event_hash;
  if (hashAgentRunValue(body) !== event.retrieval_event_hash) {
    const error = new Error("Phase87A current RetrievalEvent failed immutable hash verification.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_HASH_MISMATCH";
    throw error;
  }
  const canonical = object(worldState.retrieval_events)[event.retrieval_event_id];
  if (!isObject(canonical)
    || canonical.retrieval_event_hash !== event.retrieval_event_hash
    || !sameValue(canonical, event)) {
    const error = new Error("Phase87A current RetrievalEvent is not the canonical event in world state.");
    error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_RETRIEVAL_EVENT_NOT_CANONICAL";
    throw error;
  }
  return event;
}

function recoveredMemoryIds(event) {
  if (event.recovered_any_content !== true) return [];
  const ids = [];
  const seen = new Set();
  for (const recovery of array(event.memory_recoveries)) {
    const id = optionalString(recovery?.source_memory_ref);
    if (!id || seen.has(id)) continue;
    if (!optionalString(recovery.memory_recovery_id)
      || !Array.isArray(recovery.recovered_fragment_ids)
      || recovery.recovered_fragment_ids.length === 0
      || recovery.recovered_fragment_ids.some((fragmentId) =>
        !optionalString(fragmentId)
        || !array(event.recovered_content).some((fragment) =>
          fragment?.fragment_id === fragmentId && fragment.source_memory_ref === id))) {
      const error = new Error("Phase87A current RetrievalEvent contains an invalid successful memory recovery.");
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_MEMORY_RECOVERY_INVALID";
      throw error;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function latestInterpretationsByMemory(worldState, character, currentTurnId) {
  const validated = validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory(worldState);
  const latest = new Map();
  for (const ref of validated.history) {
    const event = validated.events[ref.interpretation_update_event_id];
    if (!sameCharacter(event.character, character) || event.source_turn_id === currentTurnId) continue;
    latest.set(event.memory_id, event);
  }
  return latest;
}

function sanitizedInterpretations(worldState, event) {
  const claims = object(worldState.subjective_claim_events);
  const relations = object(worldState.subjective_claim_relation_events);
  const result = [];
  const seen = new Set();
  for (const relationId of array(event.conflict_relation_event_ids)) {
    const relation = relations[relationId];
    const prior = claims[relation?.target_claim_event_id];
    const later = claims[relation?.source_claim_event_id];
    if (!isObject(relation) || !isObject(prior) || !isObject(later)
      || !sameCharacter(relation.character, event.character)
      || relation.source_turn_id !== event.source_turn_id
      || !["challenges", "supersedes"].includes(relation.relation)
      || !optionalString(prior.proposition)
      || !optionalString(later.proposition)) {
      const error = new Error("Phase87A interpretation lineage is detached from canonical subjective cognition.");
      error.code = "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_LINEAGE_MISMATCH";
      throw error;
    }
    const item = {
      prior_interpretation: prior.proposition,
      later_interpretation: later.proposition,
      relation: relation.relation,
      retrieval_conditioned: true,
      subjective_not_world_truth: true,
      original_memory_preserved: true,
      belief_adoption_implied: false,
    };
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryContract() {
  return deepFreeze({
    version: worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion,
    phase: "Phase87A",
    status: "retrieval_conditioned_memory_interpretation_reentry_installed",
    canonical_current_retrieval_event_required: true,
    current_successful_recovery_required: true,
    exact_recovered_memory_identity_required: true,
    prior_committed_phase85c_interpretation_required: true,
    latest_prior_interpretation_per_recovered_memory_only: true,
    same_turn_reentry_allowed: false,
    character_scope_isolated: true,
    character_view_sanitized: true,
    engine_event_identity_exposed_to_character: false,
    memory_identity_exposed_to_character: false,
    canonical_memory_content_rewritten: false,
    storage_strength_mutation_allowed: false,
    retrieval_strength_mutation_allowed: false,
    retrieval_success_forced: false,
    biological_reconsolidation_claimed: false,
    numeric_interpretation_weight_modeled: false,
    native_loop_adoption_installed: false,
    max_entries: worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries,
  });
}

export function projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id ?? input.turn_id, "current_turn_id");

  // Reuse the sealed subjective-cognition validator so Phase87A cannot become a
  // second authority for claim/relation integrity or memory-interpretation lineage.
  projectWorldSimulationSubjectiveCognition({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
  });

  const retrievalEvent = verifyCurrentRetrievalEvent(
    worldState,
    cloneJson(input.retrieval_event),
    character,
    currentTurnId,
  );
  const recoveredIds = recoveredMemoryIds(retrievalEvent);
  const latestByMemory = latestInterpretationsByMemory(worldState, character, currentTurnId);
  const entries = [];

  for (const memoryId of recoveredIds) {
    const interpretationEvent = latestByMemory.get(memoryId);
    if (!interpretationEvent) continue;
    entries.push(...sanitizedInterpretations(worldState, interpretationEvent));
  }

  const bounded = entries.slice(-worldSimulationRetrievalConditionedMemoryInterpretationReentryMaxEntries);
  const body = {
    version: worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion,
    phase: "Phase87A",
    character,
    current_turn_id: currentTurnId,
    source: "current_successful_retrieval_plus_committed_prior_turn_memory_interpretation_history",
    interpretations: bounded,
    truncated: bounded.length < entries.length,
    audit: {
      current_retrieval_event_hash_verified: true,
      current_retrieval_event_canonical: true,
      recovered_memory_identity_matched_engine_side: true,
      prior_interpretation_history_verified: true,
      subjective_cognition_lineage_verified: true,
      same_turn_interpretation_reentry_used: false,
      source_world_state_mutated: false,
      canonical_memory_content_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      retrieval_success_forced: false,
      biological_reconsolidation_claimed: false,
      numeric_interpretation_weight_modeled: false,
    },
  };
  return deepFreeze({
    ...body,
    projection_hash: hashAgentRunValue(body),
  });
}
