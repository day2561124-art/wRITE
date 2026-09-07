import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveAutobiographicalLifeEvents,
} from "./world-simulation-autobiographical-life-event-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
} from "./world-simulation-personal-semantic-memory-service.mjs";
import {
  projectWorldSimulationEffectiveAutobiographicalLifePeriods,
} from "./world-simulation-autobiographical-life-period-service.mjs";

export const worldSimulationAutobiographicalSummaryProjectionVersion =
  "phase67e-autobiographical-summary-read-projection-v1";

export const worldSimulationAutobiographicalSummaryCharacterProjectionVersion =
  "phase67e-bounded-autobiographical-character-projection-v1";

export const worldSimulationAutobiographicalSummaryMaxPeriods = 8;
export const worldSimulationAutobiographicalSummaryMaxSemanticsPerPeriod = 6;
export const worldSimulationAutobiographicalSummaryMaxUnperiodizedSemantics = 8;

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
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_INPUT_INVALID";
  throw error;
}

function sameCharacter(left, right) {
  return String(left ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
}

function compareText(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function characterEntry(container, character) {
  const source = object(container);
  if (Object.hasOwn(source, character)) return object(source[character]);
  for (const [name, value] of Object.entries(source)) {
    if (sameCharacter(name, character)) return object(value);
  }
  return {};
}

function characterNames(...containers) {
  const names = [];
  for (const container of containers) {
    for (const name of Object.keys(object(container))) {
      if (!names.some((existing) => sameCharacter(existing, name))) names.push(name);
    }
  }
  return names.sort(compareText);
}

function historyIndex(history, key) {
  const map = new Map();
  array(history).forEach((reference, index) => {
    const id = optionalString(reference?.[key]);
    if (id) map.set(id, index);
  });
  return map;
}

function latestReferenceIndex(ids, index) {
  let latest = -1;
  for (const id of array(ids)) {
    const position = index.get(id);
    if (Number.isInteger(position) && position > latest) latest = position;
  }
  return latest;
}

function semanticEngineRecord(semantic, derivationHistoryIndex) {
  return {
    semantic_memory_id: semantic.semantic_memory_id,
    semantic_category: semantic.semantic_category,
    semantic_key: semantic.semantic_key,
    semantic_descriptor: cloneJson(semantic.semantic_descriptor),
    semantic_descriptor_hash: semantic.semantic_descriptor_hash,
    state: semantic.state,
    support_life_event_refs: cloneJson(semantic.support_life_event_refs),
    counterevidence_life_event_refs: cloneJson(semantic.counterevidence_life_event_refs),
    latest_derivation_event_id: semantic.latest_derivation_event_id,
    latest_derivation_index:
      derivationHistoryIndex.get(semantic.latest_derivation_event_id) ?? -1,
    subjective_not_world_truth: true,
    epistemic_acceptance_decided: false,
    confidence: null,
    probability: null,
  };
}

function assertSemanticRecord(record, character) {
  if (
    !isObject(record)
    || !optionalString(record.semantic_memory_id)
    || !optionalString(record.semantic_category)
    || !optionalString(record.semantic_key)
    || !isObject(record.semantic_descriptor)
    || !optionalString(record.semantic_descriptor_hash)
    || !["supported", "contested"].includes(record.state)
    || record.subjective_not_world_truth !== true
    || record.epistemic_acceptance_decided !== false
    || record.confidence !== null
    || record.probability !== null
  ) {
    const error = new Error(
      `Phase67E cannot project malformed Personal Semantic memory for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_SEMANTIC_INVALID";
    throw error;
  }
}

function characterSemanticMap(semanticProjection, character, derivationHistoryIndex) {
  const effective = characterEntry(
    semanticProjection.memories_by_character,
    character,
  );
  const result = new Map();
  for (const semantic of Object.values(effective)) {
    const record = semanticEngineRecord(semantic, derivationHistoryIndex);
    assertSemanticRecord(record, character);
    result.set(record.semantic_memory_id, record);
  }
  return result;
}

function periodEngineRecord(period, semanticMap, periodHistoryIndex) {
  const semanticIds = [];
  for (const reference of array(period.source_personal_semantic_refs)) {
    const semanticId = requiredString(
      reference?.semantic_memory_id,
      "LifePeriod source personal semantic memory id",
    );
    if (!semanticIds.includes(semanticId)) semanticIds.push(semanticId);
  }
  const semantics = semanticIds.map((semanticId) => {
    const semantic = semanticMap.get(semanticId);
    if (!semantic) {
      const error = new Error(
        `Phase67E cannot resolve LifePeriod-linked Personal Semantic memory ${semanticId}.`,
      );
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_SEMANTIC_UNRESOLVED";
      throw error;
    }
    return cloneJson(semantic);
  });
  return {
    life_period_id: period.life_period_id,
    period_descriptor: cloneJson(period.period_descriptor),
    period_descriptor_hash: period.period_descriptor_hash,
    state: period.state,
    member_life_event_refs: cloneJson(period.member_life_event_refs),
    member_life_event_ids: cloneJson(period.member_life_event_ids),
    source_personal_semantic_refs: cloneJson(period.source_personal_semantic_refs),
    personal_semantics: semantics,
    organization_event_ids: cloneJson(period.organization_event_ids),
    latest_organization_event_id: period.latest_organization_event_id,
    latest_organization_index:
      periodHistoryIndex.get(period.latest_organization_event_id) ?? -1,
    first_source_turn_id: period.first_source_turn_id,
    latest_source_turn_id: period.latest_source_turn_id,
    subjective_not_world_truth: true,
  };
}

function characterEngineSummary({
  character,
  lifeEventProjection,
  semanticProjection,
  periodProjection,
  derivationHistoryIndex,
  periodHistoryIndex,
}) {
  const semanticMap = characterSemanticMap(
    semanticProjection,
    character,
    derivationHistoryIndex,
  );
  const periods = characterEntry(periodProjection.periods_by_character, character);
  const periodAnchors = Object.values(periods).map((period) =>
    periodEngineRecord(period, semanticMap, periodHistoryIndex),
  );
  const linkedSemanticIds = new Set();
  for (const period of periodAnchors) {
    for (const semantic of period.personal_semantics) {
      linkedSemanticIds.add(semantic.semantic_memory_id);
    }
  }
  const unperiodized = [...semanticMap.values()]
    .filter((semantic) => !linkedSemanticIds.has(semantic.semantic_memory_id));
  const lifeEvents = characterEntry(
    lifeEventProjection.life_events_by_character,
    character,
  );
  const summary = {
    character,
    period_anchors: periodAnchors,
    unperiodized_personal_semantics: unperiodized,
    source_life_event_count: Object.keys(lifeEvents).length,
    source_personal_semantic_count: semanticMap.size,
    source_life_period_count: periodAnchors.length,
    source_projection_hashes: {
      life_events: lifeEventProjection.projection_hash,
      personal_semantics: semanticProjection.projection_hash,
      life_periods: periodProjection.projection_hash,
    },
    input_history_hash: hashAgentRunValue({
      phase67b: lifeEventProjection.source_history_hash,
      phase67c: semanticProjection.source_history_hash,
      phase67d: periodProjection.source_history_hash,
    }),
    read_only: true,
    reconstructable: true,
    durable_summary_record_created: false,
    freeform_summary_generated: false,
    narrative_identity_modeled: false,
    self_model_modeled: false,
    belief_resolution_applied: false,
    world_truth_authority_claimed: false,
  };
  summary.summary_hash = hashAgentRunValue(summary);
  return summary;
}

export function buildWorldSimulationAutobiographicalSummaryProjectionContract() {
  return deepFreeze({
    version: worldSimulationAutobiographicalSummaryProjectionVersion,
    character_projection_version:
      worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
    phase: "Phase67E",
    status: "bounded_autobiographical_summary_read_projection_installed",
    source_owners: ["Phase67B", "Phase67C", "Phase67D"],
    source_scope: "same_character_committed_autobiographical_organization",
    engine_projection_reconstructable: true,
    consumer_specific_character_dto: true,
    character_brain_exposure_installed: true,
    action_proposer_exposure_installed: true,
    committed_prior_turn_only: true,
    same_turn_autobiographical_feedback_allowed: false,
    same_turn_contamination_policy: "fail_closed",
    durable_summary_record_created: false,
    summary_history_created: false,
    phase62k_durable_write_required: false,
    world_state_mutation_allowed: false,
    freeform_llm_summary_authority: false,
    new_semantic_proposition_authority: false,
    narrative_identity_modeled: false,
    self_model_modeled: false,
    trait_inference_modeled: false,
    role_identity_inference_modeled: false,
    value_inference_modeled: false,
    preference_inference_modeled: false,
    belief_engine_duplicated: false,
    contested_personal_semantics_resolved: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    importance_score_modeled: false,
    salience_score_modeled: false,
    truncation_is_importance_ranking: false,
    truncation_is_salience_ranking: false,
    open_periods_preferred_for_transport_only: true,
    recency_used_for_transport_only: true,
    source_ids_hashes_engine_only: true,
    source_memory_content_exposed: false,
    source_episode_content_exposed: false,
    source_life_event_content_exposed: false,
    separate_retrieval_engine_installed: false,
    phase63_phase64_retrieval_substrate_reused: true,
    max_periods: worldSimulationAutobiographicalSummaryMaxPeriods,
    max_semantics_per_period:
      worldSimulationAutobiographicalSummaryMaxSemanticsPerPeriod,
    max_unperiodized_semantics:
      worldSimulationAutobiographicalSummaryMaxUnperiodizedSemantics,
    deterministic_projection_required: true,
    input_immutability_required: true,
  });
}

export function projectWorldSimulationAutobiographicalSummary(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const inputHash = hashAgentRunValue(worldState);
  const lifeEventProjection =
    projectWorldSimulationEffectiveAutobiographicalLifeEvents({
      world_state: worldState,
    });
  const semanticProjection =
    projectWorldSimulationEffectivePersonalSemanticMemories({
      world_state: worldState,
    });
  const periodProjection =
    projectWorldSimulationEffectiveAutobiographicalLifePeriods({
      world_state: worldState,
    });
  const derivationHistoryIndex = historyIndex(
    worldState.personal_semantic_derivation_history,
    "derivation_event_id",
  );
  const periodHistoryIndex = historyIndex(
    worldState.autobiographical_life_period_organization_history,
    "organization_event_id",
  );
  const summariesByCharacter = {};
  for (const character of characterNames(
    lifeEventProjection.life_events_by_character,
    semanticProjection.memories_by_character,
    periodProjection.periods_by_character,
  )) {
    summariesByCharacter[character] = characterEngineSummary({
      character,
      lifeEventProjection,
      semanticProjection,
      periodProjection,
      derivationHistoryIndex,
      periodHistoryIndex,
    });
  }
  const projection = {
    version: worldSimulationAutobiographicalSummaryProjectionVersion,
    source_projection_versions: {
      life_events: lifeEventProjection.version,
      personal_semantics: semanticProjection.version,
      life_periods: periodProjection.version,
    },
    source_projection_hashes: {
      life_events: lifeEventProjection.projection_hash,
      personal_semantics: semanticProjection.projection_hash,
      life_periods: periodProjection.projection_hash,
    },
    summaries_by_character: summariesByCharacter,
    read_only: true,
    reconstructable: true,
    durable_summary_record_created: false,
    freeform_summary_generated: false,
    narrative_identity_modeled: false,
    self_model_modeled: false,
    world_truth_authority_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error(
      "Phase67E autobiographical summary projection mutated its world-state input.",
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze(projection);
}

function assertNoSameTurnAutobiographicalWrites(worldState, character, currentTurnId) {
  const histories = [
    worldState.autobiographical_life_event_organization_history,
    worldState.personal_semantic_derivation_history,
    worldState.autobiographical_life_period_organization_history,
  ];
  for (const history of histories) {
    for (const reference of array(history)) {
      if (!sameCharacter(reference?.character, character)) continue;
      if (reference?.source_turn_id !== currentTurnId) continue;
      const error = new Error(
        `Phase67E cannot expose autobiographical state after same-turn write for ${character}.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}

function semanticCharacterView(record) {
  assertSemanticRecord(record, "character projection");
  const descriptor = object(record.semantic_descriptor);
  return {
    category: record.semantic_category,
    predicate: descriptor.predicate,
    object: descriptor.object_ref,
    qualifiers: cloneJson(array(descriptor.qualifiers)),
    status: record.state,
    subjective_not_world_truth: true,
    epistemic_resolution_applied: false,
  };
}

function compareTransportSemantics(left, right) {
  const recency = Number(right.latest_derivation_index ?? -1)
    - Number(left.latest_derivation_index ?? -1);
  if (recency !== 0) return recency;
  return compareText(left.semantic_memory_id, right.semantic_memory_id);
}

function compareTransportPeriods(left, right) {
  if (left.state === "open" && right.state !== "open") return -1;
  if (right.state === "open" && left.state !== "open") return 1;
  const recency = Number(right.latest_organization_index ?? -1)
    - Number(left.latest_organization_index ?? -1);
  if (recency !== 0) return recency;
  return compareText(left.life_period_id, right.life_period_id);
}

export function projectWorldSimulationAutobiographicalSummaryForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(
    input.current_turn_id,
    "current_turn_id",
  );
  const inputHash = hashAgentRunValue(worldState);
  const engineProjection = projectWorldSimulationAutobiographicalSummary({
    world_state: worldState,
  });
  assertNoSameTurnAutobiographicalWrites(worldState, character, currentTurnId);
  let summary = null;
  for (const [name, value] of Object.entries(engineProjection.summaries_by_character)) {
    if (sameCharacter(name, character)) {
      summary = value;
      break;
    }
  }
  const sourcePeriods = array(summary?.period_anchors)
    .map(cloneJson)
    .sort(compareTransportPeriods);
  const selectedPeriods = sourcePeriods.slice(
    0,
    worldSimulationAutobiographicalSummaryMaxPeriods,
  );
  const periodViews = selectedPeriods.map((period) => {
    const semantics = array(period.personal_semantics)
      .map(cloneJson)
      .sort(compareTransportSemantics);
    const selectedSemantics = semantics.slice(
      0,
      worldSimulationAutobiographicalSummaryMaxSemanticsPerPeriod,
    );
    const descriptor = object(period.period_descriptor);
    return {
      description: descriptor.period_key,
      qualifiers: cloneJson(array(descriptor.qualifiers)),
      state: period.state,
      personal_semantics: selectedSemantics.map(semanticCharacterView),
      personal_semantics_truncated:
        selectedSemantics.length < semantics.length,
      subjective_not_world_truth: true,
    };
  });
  const sourceUnperiodized = array(summary?.unperiodized_personal_semantics)
    .map(cloneJson)
    .sort(compareTransportSemantics);
  const selectedUnperiodized = sourceUnperiodized.slice(
    0,
    worldSimulationAutobiographicalSummaryMaxUnperiodizedSemantics,
  );
  const characterView = {
    source: "committed_prior_turn_autobiographical_organization",
    periods: periodViews,
    unperiodized_personal_semantics:
      selectedUnperiodized.map(semanticCharacterView),
    periods_truncated: selectedPeriods.length < sourcePeriods.length,
    unperiodized_personal_semantics_truncated:
      selectedUnperiodized.length < sourceUnperiodized.length,
    narrative_summary_generated: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error(
      "Phase67E bounded autobiographical character projection mutated its world-state input.",
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
    source_projection_version: worldSimulationAutobiographicalSummaryProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: engineProjection.projection_hash,
      source_summary_hash: summary?.summary_hash ?? null,
      source_period_count: sourcePeriods.length,
      projected_period_count: selectedPeriods.length,
      source_unperiodized_semantic_count: sourceUnperiodized.length,
      projected_unperiodized_semantic_count: selectedUnperiodized.length,
      open_periods_preferred_for_transport_only: true,
      recency_used_for_transport_only: true,
      truncation_used_as_importance_ranking: false,
      truncation_used_as_salience_ranking: false,
      freeform_summary_generated: false,
      new_semantic_propositions_generated: false,
      contested_personal_semantics_resolved: false,
      narrative_identity_modeled: false,
      self_model_modeled: false,
      belief_resolution_applied: false,
      world_truth_authority_exposed: false,
      confidence_probability_exposed: false,
      source_ids_exposed_to_character_brain: false,
      source_hashes_exposed_to_character_brain: false,
      memory_content_exposed_to_character_brain: false,
      episode_content_exposed_to_character_brain: false,
      life_event_content_exposed_to_character_brain: false,
      persistent_summary_written: false,
      phase62k_write_used: false,
      world_state_mutated: false,
      same_turn_autobiographical_feedback_allowed: false,
    },
    boundaries: {
      same_character_only: true,
      committed_prior_turn_only: true,
      same_turn_contamination_policy: "fail_closed",
      character_brain_may_observe_bounded_autobiographical_context: true,
      action_proposer_may_observe_bounded_autobiographical_context: true,
      character_brain_may_mutate_autobiographical_history: false,
      action_proposer_may_mutate_autobiographical_history: false,
      source_projection_engine_only: true,
      source_ids_hashes_engine_only: true,
      world_truth_authority_exposed: false,
      confidence_probability_exposed: false,
      narrative_identity_exposed: false,
      self_model_exposed: false,
    },
  });
}
