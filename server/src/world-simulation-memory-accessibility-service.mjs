import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationMemoryAccessibilityVersion = "phase63b-memory-accessibility-retrieval-v1";

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

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function unitNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 && number <= 1 ? number : fallback;
}

function positiveInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
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

function profileFor(context) {
  if (isObject(context.memory_retrieval_profile)) return object(context.memory_retrieval_profile);
  const worldState = object(context.world_state);
  const character = nonEmptyString(context.character);
  const characterState = object(characterMapValue(worldState.characters, character));
  const characterMemoryProfile = object(characterState.memory_profile);
  const worldRules = object(worldState.world_rules ?? worldState.rules);
  const worldMemoryProfile = object(worldRules.memory_profile);
  return object(
    characterState.memory_retrieval_profile
      ?? characterMemoryProfile.retrieval
      ?? worldRules.memory_retrieval_profile
      ?? worldMemoryProfile.retrieval,
  );
}

function timestampMs(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function elapsedHours(now, then) {
  const nowMs = timestampMs(now);
  const thenMs = timestampMs(then);
  if (nowMs === null || thenMs === null) return null;
  return Math.max(0, (nowMs - thenMs) / 3_600_000);
}

function decayAccessibility(ageHours, config) {
  if (ageHours === null) return null;
  const mode = nonEmptyString(config?.mode)?.toLowerCase() ?? null;
  if (!mode) return null;
  if (mode === "none") return 1;
  const scaleHours = positiveNumber(config?.scale_hours);
  if (scaleHours === null) return null;
  const ratio = ageHours / scaleHours;
  if (mode === "hyperbolic") return 1 / (1 + ratio);
  if (mode === "exponential") return Math.exp(-ratio);
  if (mode === "power") {
    const exponent = positiveNumber(config?.exponent);
    return exponent === null ? null : (1 + ratio) ** (-exponent);
  }
  return null;
}

function recallCount(record) {
  const explicit = nonNegativeInteger(record?.recall_count);
  if (explicit !== null) return explicit;
  const history = array(record?.retrieval_history);
  if (!history.length) return null;
  return history.filter((entry) => !isObject(entry) || entry.success !== false).length;
}

function recallFrequencyAccessibility(record, config) {
  const count = recallCount(record);
  const saturationCount = positiveInteger(config?.saturation_count);
  if (count === null || saturationCount === null) return null;
  return Math.min(1, count / saturationCount);
}

function primitiveCueValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => ["string", "number", "boolean"].includes(typeof item))
    .map((item) => typeof item === "string" ? item.trim().toLocaleLowerCase("zh-Hant-TW") : item)
    .filter((item) => item !== "");
}

function cuesOverlap(left, right) {
  const leftValues = primitiveCueValues(left);
  const rightValues = primitiveCueValues(right);
  if (!leftValues.length || !rightValues.length) return null;
  const rightSet = new Set(rightValues.map((item) => JSON.stringify(item)));
  return leftValues.some((item) => rightSet.has(JSON.stringify(item)));
}

function memoryCue(record, key) {
  const source = object(record?.source);
  const content = object(record?.content ?? record?.memory ?? record?.summary);
  const retrievalCues = object(record?.retrieval_cues);
  if (Object.hasOwn(retrievalCues, key)) return retrievalCues[key];
  if (key === "scene_id") return source.scene_id ?? record?.source_scene_id ?? null;
  if (key === "sense") return source.sense ?? record?.source_sense ?? null;
  if (key === "observation_kind") return content.kind ?? null;
  if (key === "memory_type") return record?.memory_type ?? null;
  return null;
}

function currentCue(currentContext, key) {
  const context = object(currentContext);
  const cues = object(context.cues);
  if (Object.hasOwn(cues, key)) return cues[key];
  if (key === "scene_id") return context.scene_id ?? null;
  if (key === "sense") return context.senses ?? context.sense ?? null;
  if (key === "observation_kind") return context.observation_kinds ?? null;
  if (key === "memory_type") return context.memory_types ?? null;
  return null;
}

function contextMatch(record, currentContext, cueWeights) {
  let weightedMatch = 0;
  let comparableWeight = 0;
  const details = {};
  for (const [key, rawWeight] of Object.entries(object(cueWeights))) {
    const weight = positiveNumber(rawWeight);
    if (weight === null) continue;
    const memoryValue = memoryCue(record, key);
    const currentValue = currentCue(currentContext, key);
    const match = cuesOverlap(memoryValue, currentValue);
    if (match === null) continue;
    comparableWeight += weight;
    if (match) weightedMatch += weight;
    details[key] = {
      comparable: true,
      matched: match,
      weight,
    };
  }
  if (comparableWeight <= 0) return { value: null, details };
  return {
    value: weightedMatch / comparableWeight,
    details,
  };
}

function interferenceKeys(record) {
  return primitiveCueValues(record?.interference_keys);
}

function interferenceFor(record, candidates, config) {
  const perCompetitorPenalty = unitNumber(config?.per_competitor_penalty);
  if (config?.enabled !== true || perCompetitorPenalty === null || perCompetitorPenalty <= 0) {
    return { competitor_count: 0, penalty: 0 };
  }
  const keys = interferenceKeys(record);
  if (!keys.length) return { competitor_count: 0, penalty: 0 };
  const ownId = String(record?.memory_id ?? record?.id ?? "");
  const keySet = new Set(keys.map((item) => JSON.stringify(item)));
  let competitorCount = 0;
  for (const other of candidates) {
    if (other === record) continue;
    const otherId = String(other?.memory_id ?? other?.id ?? "");
    if (ownId && otherId && ownId === otherId) continue;
    const otherKeys = interferenceKeys(other);
    if (otherKeys.some((item) => keySet.has(JSON.stringify(item)))) competitorCount += 1;
  }
  const uncapped = competitorCount * perCompetitorPenalty;
  const configuredCap = unitNumber(config?.max_penalty);
  const penalty = configuredCap === null
    ? Math.min(1, uncapped)
    : Math.min(configuredCap, uncapped);
  return { competitor_count: competitorCount, penalty };
}

function perceptionContext(context) {
  const perception = object(context.perception);
  const senses = new Set();
  const kinds = new Set();
  const collect = (sense, values) => {
    for (const value of array(values)) {
      senses.add(sense);
      if (isObject(value) && nonEmptyString(value.kind)) kinds.add(nonEmptyString(value.kind));
    }
  };
  collect("visual", perception.observed);
  collect("auditory", perception.audible);
  for (const value of array(perception.other_senses)) {
    const sense = isObject(value) ? nonEmptyString(value.sense) : null;
    if (sense) senses.add(sense);
    if (isObject(value) && nonEmptyString(value.kind)) kinds.add(nonEmptyString(value.kind));
  }
  return {
    scene_id: context.scene_id ?? perception.scene_id ?? null,
    senses: [...senses],
    observation_kinds: [...kinds],
    cues: cloneJson(object(context.context_cues)),
  };
}

function componentValue(record, component, context, profile, currentContext) {
  const now = context.simulation_time ?? context.world_state?.simulation_time ?? null;
  if (component === "storage_strength") return unitNumber(record?.storage_strength);
  if (component === "encoding_retrieval_strength") {
    return unitNumber(record?.retrieval_strength_at_encoding ?? record?.initial_retrieval_strength);
  }
  if (component === "age_accessibility") {
    const ageHours = elapsedHours(now, record?.encoded_at ?? record?.remembered_at);
    return decayAccessibility(ageHours, object(profile.age_accessibility));
  }
  if (component === "recall_recency") {
    const recallAgeHours = elapsedHours(now, record?.last_recalled_at);
    return decayAccessibility(recallAgeHours, object(profile.recall_recency));
  }
  if (component === "recall_frequency") {
    return recallFrequencyAccessibility(record, object(profile.recall_frequency));
  }
  if (component === "context_match") {
    return contextMatch(record, currentContext, object(profile.context_cue_weights)).value;
  }
  return null;
}

function evaluateMemory(record, originalIndex, candidates, context, profile, currentContext) {
  const componentWeights = object(profile.component_weights);
  const components = {};
  let weightedValue = 0;
  let totalWeight = 0;

  for (const [component, rawWeight] of Object.entries(componentWeights)) {
    const weight = positiveNumber(rawWeight);
    if (weight === null) continue;
    const value = unitNumber(componentValue(record, component, context, profile, currentContext));
    components[component] = {
      value,
      weight,
      used: value !== null,
    };
    if (value === null) continue;
    weightedValue += value * weight;
    totalWeight += weight;
  }

  const baseScore = totalWeight > 0 ? weightedValue / totalWeight : null;
  const interference = interferenceFor(record, candidates, object(profile.interference));
  const retrievalStrength = baseScore === null
    ? null
    : Math.max(0, Math.min(1, baseScore - interference.penalty));
  const threshold = unitNumber(profile.retrieval_threshold);
  const accessibleByRecord = isObject(record) && record.accessible !== false && record.suppressed !== true;
  const thresholdPassed = retrievalStrength === null || threshold === null || retrievalStrength >= threshold;
  const currentContextMatch = contextMatch(record, currentContext, object(profile.context_cue_weights));

  return {
    memory_id: record?.memory_id ?? record?.id ?? null,
    original_index: originalIndex,
    accessible_by_record: accessibleByRecord,
    threshold_passed: thresholdPassed,
    retrievable: accessibleByRecord && thresholdPassed,
    storage_strength: unitNumber(record?.storage_strength),
    retrieval_strength: retrievalStrength,
    retrieval_threshold: threshold,
    age_hours: elapsedHours(
      context.simulation_time ?? context.world_state?.simulation_time ?? null,
      record?.encoded_at ?? record?.remembered_at,
    ),
    recall_age_hours: elapsedHours(
      context.simulation_time ?? context.world_state?.simulation_time ?? null,
      record?.last_recalled_at,
    ),
    recall_count: recallCount(record),
    context_match: currentContextMatch.value,
    context_match_details: currentContextMatch.details,
    interference_competitor_count: interference.competitor_count,
    interference_penalty: interference.penalty,
    components,
  };
}

function stableRank(evaluations) {
  return [...evaluations].sort((left, right) => {
    const leftScore = left.retrieval_strength;
    const rightScore = right.retrieval_strength;
    if (leftScore !== null && rightScore !== null && Math.abs(leftScore - rightScore) > 1e-12) {
      return rightScore - leftScore;
    }
    if (leftScore !== null && rightScore === null) return -1;
    if (leftScore === null && rightScore !== null) return 1;
    return left.original_index - right.original_index;
  });
}

function solveMemoryAccessibility(context) {
  const records = array(context.memory_records);
  const profile = profileFor(context);
  const configured = profile.enabled === true;
  const currentContext = perceptionContext(context);
  const candidates = records.filter((record) => isObject(record));
  const evaluations = candidates.map((record, index) => evaluateMemory(
    record,
    records.indexOf(record) >= 0 ? records.indexOf(record) : index,
    candidates,
    context,
    profile,
    currentContext,
  ));

  const byId = new Map();
  const byIndex = new Map();
  for (const evaluation of evaluations) {
    if (evaluation.memory_id !== null && evaluation.memory_id !== undefined) {
      byId.set(String(evaluation.memory_id), evaluation);
    }
    byIndex.set(evaluation.original_index, evaluation);
  }

  const rankedEvaluations = configured
    ? stableRank(evaluations.filter((item) => item.retrievable))
    : evaluations.filter((item) => item.accessible_by_record);
  const rankedRecords = [];
  for (const evaluation of rankedEvaluations) {
    const record = records[evaluation.original_index];
    if (isObject(record)) rankedRecords.push(cloneJson(record));
  }
  const maxItems = positiveInteger(profile.max_items);
  const retrievableRecords = maxItems === null ? rankedRecords : rankedRecords.slice(0, Math.min(32, maxItems));

  return {
    status: configured ? "programmatic_memory_accessibility_applied" : "legacy_memory_accessibility_preserved",
    version: worldSimulationMemoryAccessibilityVersion,
    character: nonEmptyString(context.character),
    accessibility_enforced: configured,
    current_context: currentContext,
    retrieval_threshold: unitNumber(profile.retrieval_threshold),
    configured_max_items: maxItems === null ? null : Math.min(32, maxItems),
    evaluated_memory_count: evaluations.length,
    retrievable_memory_count: retrievableRecords.length,
    retrievable_memory_records: retrievableRecords,
    evaluations: evaluations.map((evaluation) => cloneJson(evaluation)),
    ranking: rankedEvaluations.map((evaluation, rankIndex) => ({
      rank: rankIndex + 1,
      memory_id: evaluation.memory_id,
      retrieval_strength: evaluation.retrieval_strength,
      original_index: evaluation.original_index,
    })),
    accessibility_boundary: {
      storage_strength_and_retrieval_strength_are_separate: true,
      time_passage_does_not_rewrite_persistent_memory_records: true,
      forgetting_does_not_delete_memory_records: true,
      confidence_and_clarity_are_not_rewritten_by_accessibility: true,
      no_universal_forgetting_curve_is_assumed: true,
      time_decay_mode_and_parameters_require_explicit_configuration: true,
      context_matching_uses_only_explicit_machine_readable_cues: true,
      interference_requires_explicit_memory_interference_keys: true,
      free_text_semantic_similarity_modeled: false,
      recall_history_is_read_only_in_this_phase: true,
      recall_reinforcement_modeled: false,
      source_confusion_or_memory_distortion_modeled: false,
      consolidation_or_semanticization_modeled: false,
      retrieval_strength_scores_are_diagnostics_not_character_brain_inputs: true,
      character_brain_decides_memory_accessibility: false,
    },
  };
}

export function queryWorldSimulationMemoryAccessibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    character: input.character ?? null,
    memory_records: array(input.memory_records),
    memory_retrieval_profile: isObject(input.memory_retrieval_profile)
      ? input.memory_retrieval_profile
      : undefined,
    simulation_time: input.simulation_time ?? input.world_state?.simulation_time ?? null,
    scene_id: input.scene_id ?? input.perception?.scene_id ?? null,
    perception: object(input.perception),
    context_cues: object(input.context_cues),
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveMemoryAccessibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Memory accessibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Memory accessibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationMemoryAccessibilityVersion,
    character: nonEmptyString(input.character),
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_memory_accessibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    persistent_memory_records_mutated: false,
    character_brain_decides_memory_accessibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationMemoryAccessibilityContract() {
  return {
    version: worldSimulationMemoryAccessibilityVersion,
    owner: "programmatic_subjective_memory_retrieval",
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    storage_strength_and_retrieval_strength_separate: true,
    persistent_memory_decay_writes_allowed: false,
    forgetting_deletes_memory_records: false,
    explicit_profile_required_for_programmatic_filtering: true,
    universal_forgetting_curve_assumed: false,
    supported_explicit_age_functions: ["none", "hyperbolic", "exponential", "power"],
    recency_frequency_context_and_interference_components_supported: true,
    explicit_context_cues_only: true,
    explicit_interference_keys_only: true,
    free_text_semantic_similarity_modeled: false,
    recall_reinforcement_modeled: false,
    source_confusion_or_distortion_modeled: false,
    consolidation_or_semanticization_modeled: false,
    retrieval_strength_scores_forwarded_to_character_brain: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
    character_brain_decides_memory_accessibility: false,
  };
}
