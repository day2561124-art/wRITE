import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationSubjectiveMemoryFormationVersion = "phase63a-subjective-memory-formation-v1";

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

function finiteUnit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = String(character ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) return value;
  }
  return undefined;
}

const strippedObservationKeys = new Set([
  "world_state",
  "source_position",
  "target_position",
  "exact_source_position",
  "exact_target_position",
  "relative_position",
  "target_illumination_lux",
  "received_level_db",
  "reference_level_db",
  "reference_distance_m",
  "minimum_audible_db",
  "observer_thresholds_lux",
  "distance_m",
]);

function keyIsEngineIdentifier(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || strippedObservationKeys.has(normalized);
}

function sanitizePerceivedValue(value) {
  if (Array.isArray(value)) return value.map(sanitizePerceivedValue);
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsEngineIdentifier(key)) continue;
    clean[key] = sanitizePerceivedValue(child);
  }
  return clean;
}

function encodingProfileFor(worldState, character) {
  const state = object(characterMapValue(object(worldState).characters, character));
  return object(state.memory_encoding_profile ?? state.memory_profile);
}

function profileMetric(profile, sense, metric) {
  const direct = object(profile.direct_perception);
  const senses = object(profile.senses);
  const candidates = [
    object(direct[sense])[metric],
    object(senses[sense])[metric],
    object(profile[sense])[metric],
    direct[metric],
    profile[metric],
  ];
  for (const candidate of candidates) {
    const numeric = finiteUnit(candidate);
    if (numeric !== null) return numeric;
  }
  return null;
}

function metricFromObservation(observation, metric) {
  if (!isObject(observation)) return null;
  const candidates = metric === "confidence"
    ? [observation.confidence, observation.perceptual_confidence, observation.certainty]
    : [observation.clarity, observation.perceptual_clarity, observation.memory_clarity];
  for (const candidate of candidates) {
    const numeric = finiteUnit(candidate);
    if (numeric !== null) return numeric;
  }
  return null;
}

function metricWithOrigin(observation, profile, sense, metric) {
  const direct = metricFromObservation(observation, metric);
  if (direct !== null) return { value: direct, origin: "perception_observation" };
  const configured = profileMetric(profile, sense, metric);
  if (configured !== null) return { value: configured, origin: "character_memory_encoding_profile" };
  return { value: null, origin: "unspecified" };
}

function observationEntries(perception) {
  const entries = [];
  const push = (sense, values) => {
    for (const value of array(values)) entries.push({ sense, observation: value });
  };
  push("visual", perception?.observed);
  push("auditory", perception?.audible);
  push("other", perception?.other_senses);
  return entries;
}

function memoryRecordFor({
  character,
  observation,
  sense,
  profile,
  turnId,
  eventId,
  sceneId,
  encodedAt,
  observationIndex,
}) {
  const sanitized = sanitizePerceivedValue(observation);
  if (sanitized === null || sanitized === undefined) return null;
  if (isObject(sanitized) && !Object.keys(sanitized).length) return null;
  const contentHash = hashAgentRunValue({ sense, content: sanitized });
  const confidence = metricWithOrigin(observation, profile, sense, "confidence");
  const clarity = metricWithOrigin(observation, profile, sense, "clarity");
  const memoryId = `memory_${hashAgentRunValue({
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: turnId,
    character,
    sense,
    observation_index: observationIndex,
    content_hash: contentHash,
  }).slice(0, 24)}`;
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: sanitized,
    source: {
      kind: "direct_perception",
      sense,
      event_id: eventId,
      scene_id: sceneId,
      turn_id: turnId,
      observation_hash: contentHash,
      formation_version: worldSimulationSubjectiveMemoryFormationVersion,
    },
    confidence: confidence.value,
    confidence_origin: confidence.origin,
    clarity: clarity.value,
    clarity_origin: clarity.origin,
    encoded_at: encodedAt,
    last_recalled_at: null,
    relevance: isObject(observation) ? cloneJson(observation.relevance ?? null) : null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: isObject(observation) && observation.possibly_incorrect === true,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

function solveSubjectiveMemoryFormation(context) {
  const worldState = object(context.world_state);
  const turnId = nonEmptyString(context.turn_id);
  const event = object(context.event);
  const eventId = nonEmptyString(event.event_id ?? event.id);
  const sceneId = nonEmptyString(event.scene_id ?? event.location_id);
  const updates = [];
  const transitions = [];
  let totalCreated = 0;

  for (const packet of array(context.decision_packets)) {
    const character = nonEmptyString(packet?.character);
    if (!character) continue;
    const perception = object(packet?.perception);
    const encodedAt = perception.simulation_time ?? worldState.simulation_time ?? event.simulation_time ?? null;
    const profile = encodingProfileFor(worldState, character);
    const existingRaw = characterMapValue(worldState.memories, character);
    const existing = Array.isArray(existingRaw) ? cloneJson(existingRaw) : [];
    const existingIds = new Set(existing.map((item) => String(item?.memory_id ?? item?.id ?? "")).filter(Boolean));
    const seenContent = new Set();
    const created = [];
    const entries = observationEntries(perception);

    entries.forEach(({ sense, observation }, observationIndex) => {
      const record = memoryRecordFor({
        character,
        observation,
        sense,
        profile,
        turnId,
        eventId,
        sceneId: perception.scene_id ?? sceneId,
        encodedAt,
        observationIndex,
      });
      if (!record || existingIds.has(record.memory_id)) return;
      const dedupe = `${sense}:${record.source.observation_hash}`;
      if (seenContent.has(dedupe)) return;
      seenContent.add(dedupe);
      created.push(record);
    });

    if (!created.length) {
      updates.push({
        character,
        created_memory_count: 0,
        memory_records: [],
        before_memory_count: existing.length,
        after_memory_count: existing.length,
      });
      continue;
    }

    const after = [...existing, ...created];
    totalCreated += created.length;
    updates.push({
      character,
      created_memory_count: created.length,
      memory_records: cloneJson(created),
      before_memory_count: existing.length,
      after_memory_count: after.length,
    });
    transitions.push({
      entity: "world",
      field: `memories.${character}`,
      from: existingRaw === undefined ? null : existing,
      to: after,
      cause: `encoded ${created.length} bounded direct-perception memories for ${character}`,
      time_ms: 0,
      source_layer: "subjective_memory",
      adjudication: worldSimulationSubjectiveMemoryFormationVersion,
    });
  }

  return {
    status: "subjective_memory_formation_resolved",
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: turnId,
    event_id: eventId,
    created_memory_count: totalCreated,
    character_updates: updates,
    memory_transitions: transitions,
    formation_boundary: {
      source_is_character_bounded_perception_only: true,
      raw_world_state_facts_are_not_memory_content_sources: true,
      objective_knowledge_is_not_promoted_from_memory: true,
      engine_target_or_sound_source_ids_are_stripped_from_memory_content: true,
      direct_perception_provenance_is_preserved: true,
      confidence_requires_explicit_observation_or_character_profile: true,
      clarity_requires_explicit_observation_or_character_profile: true,
      hidden_confidence_or_clarity_defaults_allowed: false,
      memories_become_retrievable_on_later_turns_not_retroactively_in_same_decision: true,
      active_memory_decay_modeled: false,
      consolidation_reconsolidation_modeled: false,
      post_outcome_perception_capture_modeled: false,
    },
  };
}

export function formWorldSimulationSubjectiveMemories(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    turn_id: input.turn_id ?? null,
    event: object(input.event),
    decision_packets: array(input.decision_packets),
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveSubjectiveMemoryFormation(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Subjective memory formation produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEMORY_FORMATION_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Subjective memory formation mutated its input context.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEMORY_FORMATION_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: input.turn_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    formation_output_contains_world_state: false,
    formation_output_contains_memory_transitions_only: true,
    memory_content_derived_only_from_bounded_perception: true,
    character_brain_creates_or_edits_persisted_memory: false,
    memory_is_not_objective_world_truth: true,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    subjective_memory_formation_version: worldSimulationSubjectiveMemoryFormationVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationSubjectiveMemoryFormationContract() {
  return {
    version: worldSimulationSubjectiveMemoryFormationVersion,
    owner: "programmatic_subjective_memory_layer",
    input_source: "bounded_character_perception_packets",
    deterministic_replay_required: true,
    immutable_input_context: true,
    persisted_memory_is_subjective_not_world_truth: true,
    direct_perception_provenance_preserved: true,
    explicit_confidence_or_profile_required_for_numeric_confidence: true,
    explicit_clarity_or_profile_required_for_numeric_clarity: true,
    hidden_cognitive_defaults_allowed: false,
    engine_target_ids_in_memory_content_allowed: false,
    objective_known_facts_auto_promotion_allowed: false,
    same_turn_retroactive_memory_use_allowed: false,
    final_memory_state_written_through_authoritative_mutation_executor: true,
    active_memory_decay_modeled: false,
    consolidation_reconsolidation_modeled: false,
    post_outcome_perception_capture_modeled: false,
    neural_module_direct_memory_mutation_allowed: false,
  };
}
