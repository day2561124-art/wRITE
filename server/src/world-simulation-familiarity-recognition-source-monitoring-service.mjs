import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationFamiliarityRecognitionSourceMonitoringVersion =
  "phase94-familiarity-recognition-source-monitoring-v1";

const allowedSourceDimensions = Object.freeze([
  "kind",
  "actor",
  "sense",
]);

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
  error.code = "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_MONITORING_INPUT_INVALID";
  throw error;
}
function nonNegativeInteger(value, label) {
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric;
  const error = new Error(`${label} must be a non-negative safe integer.`);
  error.code = "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_MONITORING_INPUT_INVALID";
  throw error;
}

function normalizeSourceQuery(raw) {
  if (raw === null || raw === undefined) {
    return {
      requested: false,
      dimensions: [],
    };
  }

  if (!isObject(raw)) {
    const error = new Error("source_query must be an object when supplied.");
    error.code = "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_QUERY_INVALID";
    throw error;
  }

  const single = optionalString(raw.dimension);
  const requestedDimensions = [
    ...(single ? [single] : []),
    ...array(raw.dimensions).map(optionalString).filter(Boolean),
  ];

  const dimensions = requestedDimensions.length
    ? [...new Set(requestedDimensions)]
    : [...allowedSourceDimensions];

  for (const dimension of dimensions) {
    if (!allowedSourceDimensions.includes(dimension)) {
      const error = new Error(`Unsupported source_query dimension: ${dimension}.`);
      error.code = "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_QUERY_INVALID";
      throw error;
    }
  }

  return {
    requested: true,
    dimensions,
  };
}

function recognitionState(recoveredMemories, metamemory, retrievalTaskMode) {
  if (recoveredMemories.length > 0) {
    return {
      recognition_mode: "recollection_with_recovered_detail",
      familiarity_experience: "familiarity_not_used_as_substitute_for_recollection",
      recollected_detail_available: true,
    };
  }

  const partialAccess =
    metamemory.accessibility_experience === "partial_or_related_access"
    || metamemory.feeling_of_knowing === "felt_accessible_despite_incomplete_recall"
    || metamemory.partial_or_related_information_available === true;

  if (retrievalTaskMode === "recognition" && partialAccess) {
    return {
      recognition_mode: "familiarity_without_recollected_detail",
      familiarity_experience: "familiar_without_recollected_detail",
      recollected_detail_available: false,
    };
  }

  return {
    recognition_mode: "insufficient_positive_recognition_evidence",
    familiarity_experience:
      partialAccess
        ? "partial_access_not_promoted_to_familiarity_outside_recognition_context"
        : "no_positive_familiarity_evidence",
    recollected_detail_available: false,
  };
}

function sourceFeatures(memory) {
  const source = object(memory?.source);
  return {
    kind: optionalString(source.kind),
    actor: optionalString(source.actor),
    sense: optionalString(source.sense),
  };
}

function sourceMonitoring(sourceQuery, recoveredMemories, recognition) {
  if (!sourceQuery.requested) {
    return {
      source_query_requested: false,
      source_query_dimensions: [],
      source_certainty: "not_queried",
      source_status: "not_queried",
      source_attribution: null,
      source_uncertainty_reasons: [],
      source_basis: null,
      source_confusion_observed: false,
    };
  }

  if (!recoveredMemories.length) {
    return {
      source_query_requested: true,
      source_query_dimensions: cloneJson(sourceQuery.dimensions),
      source_certainty: "uncertain",
      source_status:
        recognition.recognition_mode === "familiarity_without_recollected_detail"
          ? "uncertain_familiarity_without_source_recollection"
          : "uncertain_no_recollected_source_evidence",
      source_attribution: null,
      source_uncertainty_reasons: [
        recognition.recognition_mode === "familiarity_without_recollected_detail"
          ? "familiarity_does_not_supply_source_detail"
          : "no_recollected_source_detail",
      ],
      source_basis: null,
      source_confusion_observed: false,
    };
  }

  const targetRelated = recoveredMemories.filter(
    (memory) => memory?.target_relation === "target_related",
  );
  const sourcePool = targetRelated.length ? targetRelated : recoveredMemories;
  const sourceConfusionObserved = sourcePool.some(
    (memory) => memory?.source_confused === true,
  );

  const attribution = {};
  const reasons = [];

  for (const dimension of sourceQuery.dimensions) {
    const values = [
      ...new Set(
        sourcePool
          .map((memory) => sourceFeatures(memory)[dimension])
          .filter(Boolean),
      ),
    ];

    if (values.length === 1) {
      attribution[dimension] = values[0];
      continue;
    }

    attribution[dimension] = null;
    reasons.push(
      values.length > 1
        ? `conflicting_recollected_source_${dimension}`
        : `missing_recollected_source_${dimension}`,
    );
  }

  if (sourceConfusionObserved) {
    reasons.push("recollected_memory_marked_source_confused");
  }

  const uncertain = reasons.length > 0;

  return {
    source_query_requested: true,
    source_query_dimensions: cloneJson(sourceQuery.dimensions),
    source_certainty: uncertain ? "uncertain" : "available",
    source_status: sourceConfusionObserved
      ? "uncertain_source_confusion_present"
      : uncertain
        ? "uncertain_incomplete_or_conflicting_source_features"
        : "source_attribution_available_from_recollected_features",
    source_attribution: attribution,
    source_uncertainty_reasons: reasons,
    source_basis: targetRelated.length
      ? "target_related_recollected_character_view"
      : "current_step_recollected_character_view",
    source_confusion_observed: sourceConfusionObserved,
  };
}

export function buildWorldSimulationFamiliarityRecognitionSourceMonitoringContract() {
  return deepFreeze({
    version: worldSimulationFamiliarityRecognitionSourceMonitoringVersion,
    phase: "Phase94",
    status: "bounded_familiarity_recognition_source_monitoring_installed",
    familiarity_distinct_from_recollection: true,
    familiarity_without_recollected_detail_supported: true,
    familiarity_requires_recognition_context: true,
    feeling_of_knowing_is_not_familiarity: true,
    familiarity_is_world_truth: false,
    familiarity_implies_person_known: false,
    recollection_requires_recovered_character_visible_detail: true,
    source_query_supported: true,
    source_dimensions: cloneJson(allowedSourceDimensions),
    source_attribution_uses_recollected_character_visible_features_only: true,
    source_uncertainty_supported: true,
    source_confusion_can_force_uncertainty: true,
    hidden_internal_provenance_inspected: false,
    unrecovered_memory_content_inspected: false,
    non_contacted_candidate_identity_inspected: false,
    numeric_source_confidence_modeled: false,
    source_attribution_is_world_truth: false,
    memory_content_rewritten: false,
    recognition_decision_authority_replaced: false,
    continuation_authority_replaced: false,
  });
}

export function projectWorldSimulationFamiliarityRecognitionSourceMonitoring(input = {}) {
  const queryId = requiredString(input.query_id, "query_id");
  const character = requiredString(input.character, "character");
  const stepIndex = nonNegativeInteger(input.step_index, "step_index");
  const recoveredMemories = cloneJson(array(input.recovered_memories_this_step));
  const metamemory = cloneJson(object(input.metamemory_retrieval_effort));
  const retrievalTaskMode = optionalString(input.retrieval_task_mode)
    ?? "unspecified";
  const sourceQuery = normalizeSourceQuery(input.source_query);

  const recognition = recognitionState(
    recoveredMemories,
    metamemory,
    retrievalTaskMode,
  );
  const source = sourceMonitoring(
    sourceQuery,
    recoveredMemories,
    recognition,
  );

  const characterView = {
    recognition_mode: recognition.recognition_mode,
    familiarity_experience: recognition.familiarity_experience,
    recollected_detail_available: recognition.recollected_detail_available,
    familiarity_not_world_truth: true,
    familiarity_does_not_establish_identity: true,
    source_query_requested: source.source_query_requested,
    source_query_dimensions: cloneJson(source.source_query_dimensions),
    source_certainty: source.source_certainty,
    source_status: source.source_status,
    source_attribution: cloneJson(source.source_attribution),
    source_uncertainty_reasons: cloneJson(source.source_uncertainty_reasons),
    source_confusion_observed: source.source_confusion_observed,
    source_attribution_not_world_truth: true,
  };

  const body = {
    version: worldSimulationFamiliarityRecognitionSourceMonitoringVersion,
    phase: "Phase94",
    query_id: queryId,
    character,
    step_index: stepIndex,
    source: "current_retrieval_step_character_visible_products",
    character_view: characterView,
    audit: {
      recovered_memory_count_observed: recoveredMemories.length,
      source_basis: source.source_basis,
      hidden_internal_provenance_checked: false,
      unrecovered_memory_content_checked: false,
      non_contacted_candidate_identity_checked: false,
      numeric_source_confidence_modeled: false,
      world_truth_promoted_from_familiarity: false,
      world_truth_promoted_from_source_attribution: false,
      memory_content_rewritten: false,
      continuation_decision_made: false,
      recognition_forced: false,
    },
  };

  return deepFreeze({
    ...body,
    projection_hash: hashAgentRunValue(body),
  });
}
