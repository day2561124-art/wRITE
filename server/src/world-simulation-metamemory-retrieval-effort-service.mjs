import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationMetamemoryRetrievalEffortVersion =
  "phase93-metamemory-retrieval-effort-v1";

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
  error.code = "WORLD_SIMULATION_METAMEMORY_RETRIEVAL_EFFORT_INPUT_INVALID";
  throw error;
}
function nonNegativeInteger(value, label) {
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric;
  const error = new Error(`${label} must be a non-negative safe integer.`);
  error.code = "WORLD_SIMULATION_METAMEMORY_RETRIEVAL_EFFORT_INPUT_INVALID";
  throw error;
}

function effortBand(stepIndex) {
  if (stepIndex <= 0) return "initial_attempt";
  if (stepIndex === 1) return "sustained_search";
  return "extended_search";
}

function partialAccessEvidence(recoveredMemories, recoveryOccurrences, availableCues) {
  return recoveredMemories.length > 0
    || recoveryOccurrences.length > 0
    || availableCues.length > 0;
}

function targetRecovered(targetOutcome) {
  return targetOutcome === "satisfied";
}

export function buildWorldSimulationMetamemoryRetrievalEffortContract() {
  return deepFreeze({
    version: worldSimulationMetamemoryRetrievalEffortVersion,
    phase: "Phase93",
    status: "bounded_metamemory_monitoring_and_retrieval_effort_installed",
    source_scope: "current_retrieval_step_character_accessible_products_only",
    cue_familiarity_or_partial_access_may_support_feeling_of_knowing: true,
    failed_recall_can_coexist_with_feeling_of_knowing: true,
    feeling_of_knowing_is_memory_truth: false,
    feeling_of_knowing_is_recall_probability: false,
    target_presence_in_hidden_memory_inspected: false,
    unrecovered_memory_content_inspected: false,
    non_contacted_candidate_identity_inspected: false,
    technical_step_budget_used_as_effort_evidence: false,
    actual_completed_search_steps_used_as_effort_evidence: true,
    continuation_authority_replaced: false,
    stop_authority_replaced: false,
    cue_selection_authority_replaced: false,
    retrieval_success_forced: false,
    memory_content_rewritten: false,
    numeric_confidence_or_probability_modeled: false,
  });
}

export function projectWorldSimulationMetamemoryRetrievalEffort(input = {}) {
  const queryId = requiredString(input.query_id, "query_id");
  const character = requiredString(input.character, "character");
  const stepIndex = nonNegativeInteger(input.step_index, "step_index");
  const targetOutcome = optionalString(input.cumulative_target_outcome_after_step)
    ?? "unresolved";
  const recoveredMemories = cloneJson(array(input.recovered_memories_this_step));
  const recoveryOccurrences = cloneJson(array(input.recovery_occurrences_this_step));
  const availableCues = cloneJson(array(input.available_reinstatement_cues));

  const targetIsRecovered = targetRecovered(targetOutcome);
  const partialAccess = partialAccessEvidence(
    recoveredMemories,
    recoveryOccurrences,
    availableCues,
  );

  const feelingOfKnowing = targetIsRecovered
    ? "not_applicable_target_recovered"
    : partialAccess
      ? "felt_accessible_despite_incomplete_recall"
      : "no_positive_feeling_of_knowing_evidence";

  const accessibilityExperience = targetIsRecovered
    ? "target_accessed"
    : partialAccess
      ? "partial_or_related_access"
      : "access_uncertain";

  const characterView = {
    accessibility_experience: accessibilityExperience,
    feeling_of_knowing: feelingOfKnowing,
    retrieval_effort: effortBand(stepIndex),
    partial_or_related_information_available: partialAccess,
    target_recovered: targetIsRecovered,
    subjective_not_memory_truth: true,
    recall_success_not_guaranteed: true,
  };

  const body = {
    version: worldSimulationMetamemoryRetrievalEffortVersion,
    phase: "Phase93",
    query_id: queryId,
    character,
    step_index: stepIndex,
    source: "current_retrieval_step_character_accessible_products",
    character_view: characterView,
    audit: {
      recovered_memory_count_observed: recoveredMemories.length,
      recovery_occurrence_count_observed: recoveryOccurrences.length,
      grounded_reinstatement_cue_count_observed: availableCues.length,
      hidden_memory_presence_checked: false,
      unrecovered_memory_content_checked: false,
      non_contacted_candidate_identity_checked: false,
      technical_step_budget_used: false,
      numeric_recall_probability_modeled: false,
      continuation_decision_made: false,
      stop_decision_made: false,
      cue_selection_made: false,
      retrieval_success_forced: false,
      memory_content_rewritten: false,
    },
  };

  return deepFreeze({
    ...body,
    projection_hash: hashAgentRunValue(body),
  });
}
