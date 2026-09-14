import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
  worldSimulationMemoryAccessibilityVersion,
} from "./world-simulation-memory-accessibility-service.mjs";
import {
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "./world-simulation-retrieval-practice-activation-projection-service.mjs";
import {
  worldSimulationBaseLevelActivationProjectionVersion,
} from "./world-simulation-base-level-activation-projection-service.mjs";
import {
  worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
} from "./world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";
import {
  worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
} from "./world-simulation-retrieval-induced-forgetting-reexposure-recovery-projection-service.mjs";
import {
  worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
} from "./world-simulation-retrieval-context-revival-accessibility-projection-service.mjs";

export const worldSimulationUnifiedMemoryAccessibilityProjectionVersion =
  "phase90b-unified-memory-accessibility-projection-v1";

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

function requiredString(value, label, code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function memoryId(record, index, label) {
  if (!isObject(record)) {
    const error = new Error(`${label}[${index}] must be an object.`);
    error.code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_MEMORY_INVALID";
    throw error;
  }
  return requiredString(
    record.memory_id ?? record.id,
    `${label}[${index}].memory_id`,
    "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_MEMORY_ID_REQUIRED",
  );
}

function memoryIds(records, label = "memory_records") {
  const seen = new Set();
  return array(records).map((record, index) => {
    const id = memoryId(record, index, label);
    if (seen.has(id)) {
      const error = new Error(`Duplicate memory_id in ${label}: ${id}.`);
      error.code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_MEMORY_DUPLICATE";
      throw error;
    }
    seen.add(id);
    return id;
  });
}

function sameArray(left, right) {
  return JSON.stringify(array(left)) === JSON.stringify(array(right));
}

function verifyProjection(projection, expectedVersion, label) {
  if (!isObject(projection) || projection.version !== expectedVersion) {
    const error = new Error(`${label} has an unsupported version.`);
    error.code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_SOURCE_INVALID";
    error.source = label;
    throw error;
  }
  return projection;
}

function verifyContext(projection, character, currentTurnId, label) {
  if (optionalString(projection.character) !== character
    || optionalString(projection.current_turn_id) !== currentTurnId) {
    const error = new Error(`${label} character/turn identity does not match Phase90B context.`);
    error.code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_CONTEXT_MISMATCH";
    error.source = label;
    throw error;
  }
}

function mapByMemoryId(entries) {
  return new Map(
    array(entries)
      .filter(isObject)
      .map((entry) => [optionalString(entry.memory_id), entry])
      .filter(([id]) => Boolean(id)),
  );
}

function candidateRankByMemoryId(query) {
  return new Map(
    array(query?.result?.candidate_ranking)
      .filter(isObject)
      .map((entry) => [optionalString(entry.memory_id), entry])
      .filter(([id]) => Boolean(id)),
  );
}

function candidateEvaluationByMemoryId(query) {
  return new Map(
    array(query?.result?.candidate_evaluations)
      .filter(isObject)
      .map((entry) => [optionalString(entry.memory_id), entry])
      .filter(([id]) => Boolean(id)),
  );
}

function evidenceFor({
  finalMemoryIds,
  retrievalPracticeProjection,
  baseLevelProjection,
  rifProjection,
  reexposureProjection,
  contextRevivalProjection,
  accessibilityQuery,
}) {
  const practiceById = mapByMemoryId(retrievalPracticeProjection.activation_evidence);
  const baseById = mapByMemoryId(baseLevelProjection.base_level_activation_evidence);
  const rifById = mapByMemoryId(rifProjection.suppression_evidence);
  const reexposureById = mapByMemoryId(reexposureProjection.recovery_evidence);
  const revivalById = mapByMemoryId(contextRevivalProjection.recovery_evidence);
  const revivalOrderById = mapByMemoryId(contextRevivalProjection.ordering_evidence);
  const evaluationById = candidateEvaluationByMemoryId(accessibilityQuery);
  const candidateRankById = candidateRankByMemoryId(accessibilityQuery);
  const candidateIds = new Set(
    array(accessibilityQuery?.result?.candidate_memory_records)
      .map((record, index) => memoryId(record, index, "phase63b_candidate_memory_records")),
  );

  return finalMemoryIds.map((id, finalIndex) => {
    const practice = practiceById.get(id) ?? null;
    const base = baseById.get(id) ?? null;
    const rif = rifById.get(id) ?? null;
    const reexposure = reexposureById.get(id) ?? null;
    const revival = revivalById.get(id) ?? null;
    const revivalOrder = revivalOrderById.get(id) ?? null;
    const evaluation = evaluationById.get(id) ?? null;
    const candidateRank = candidateRankById.get(id) ?? null;
    const sourceSignals = [];

    if (Number(practice?.qualifying_prior_practice_count ?? 0) > 0) {
      sourceSignals.push("retrieval_practice_history");
    }
    if (base?.complete_base_level_evidence === true) {
      sourceSignals.push("base_level_time_and_use_history");
    }
    if (rif?.suppression_applied === true) {
      sourceSignals.push("retrieval_induced_forgetting_suppression");
    }
    if (reexposure?.recovery_applied === true) {
      sourceSignals.push("exact_reexposure_recovery");
    }
    if (revival?.recovery_applied === true) {
      sourceSignals.push("explicit_context_revival_recovery");
    }
    if (candidateIds.has(id)) {
      sourceSignals.push("current_query_cue_accessibility");
    }

    return {
      memory_id: id,
      final_ephemeral_index: finalIndex,
      current_accessibility_status: candidateIds.has(id)
        ? "phase63b_candidate_now"
        : "not_phase63b_candidate_now",
      current_candidate_rank: candidateRank?.rank ?? null,
      source_signals: sourceSignals,
      retrieval_practice_evidence: practice
        ? {
            qualifying_prior_practice_count:
              Number(practice.qualifying_prior_practice_count ?? 0),
            latest_qualifying_practice_at:
              practice.latest_qualifying_practice_at ?? null,
            activation_score:
              Number.isFinite(practice.activation_score)
                ? practice.activation_score
                : null,
          }
        : null,
      base_level_evidence: base
        ? {
            complete_base_level_evidence:
              base.complete_base_level_evidence === true,
            encoded_at: base.encoded_at ?? null,
            encoding_age_seconds:
              Number.isFinite(base.encoding_age_seconds)
                ? base.encoding_age_seconds
                : null,
            base_level_activation_score:
              Number.isFinite(base.base_level_activation_score)
                ? base.base_level_activation_score
                : null,
          }
        : null,
      rif_suppression_evidence: rif
        ? {
            suppression_applied: rif.suppression_applied === true,
            applicable_consequence_event_ids:
              cloneJson(rif.applicable_consequence_event_ids ?? []),
          }
        : null,
      reexposure_recovery_evidence: reexposure
        ? {
            status: reexposure.status ?? null,
            recovery_applied: reexposure.recovery_applied === true,
          }
        : null,
      context_revival_evidence: revival
        ? {
            status: revival.status ?? null,
            recovery_applied: revival.recovery_applied === true,
            prior_phase83c_recovery_preserved:
              revival.prior_phase83c_recovery_preserved === true,
          }
        : null,
      ordering_evidence: revivalOrder
        ? {
            suppression_remains_applied:
              revivalOrder.suppression_remains_applied === true,
            recovered_from_phase83b_suppression:
              revivalOrder.recovered_from_phase83b_suppression === true,
          }
        : null,
      current_query_evaluation: evaluation
        ? {
            candidate: candidateIds.has(id),
            accessibility_score:
              Number.isFinite(evaluation.accessibility_score)
                ? evaluation.accessibility_score
                : null,
          }
        : {
            candidate: candidateIds.has(id),
            accessibility_score: null,
          },
    };
  });
}

export function buildWorldSimulationUnifiedMemoryAccessibilityProjectionContract() {
  return deepFreeze({
    version: worldSimulationUnifiedMemoryAccessibilityProjectionVersion,
    phase: "Phase90B",
    status: "unified_bounded_memory_accessibility_projection_installed",
    source_retrieval_practice_version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,
    source_base_level_activation_version:
      worldSimulationBaseLevelActivationProjectionVersion,
    source_rif_accessibility_version:
      worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
    source_reexposure_recovery_version:
      worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
    source_context_revival_version:
      worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
    final_query_owner: worldSimulationMemoryAccessibilityVersion,
    composition_order: [
      "retrieval_practice",
      "base_level_time_and_use_history",
      "bounded_rif_suppression",
      "exact_reexposure_recovery",
      "explicit_context_revival_recovery",
      "phase63b_current_query_cue_accessibility",
    ],
    final_ephemeral_order_owner:
      "phase84b_projected_memory_records_before_phase63b_query",
    candidate_membership_owner: "Phase63B",
    actual_retrieval_process_owner: "Phase63C",
    single_memory_strength_created: false,
    new_scalar_accessibility_score_created: false,
    phase63b_diagnostic_score_preserved_as_diagnostic_only: true,
    source_memory_content_mutated: false,
    persistent_memory_order_mutated: false,
    storage_strength_mutated: false,
    retrieval_strength_mutated: false,
    same_turn_retrieval_history_feedback_allowed: false,
    accessibility_is_not_world_truth: true,
    current_accessibility_is_not_successful_retrieval: true,
    all_modulation_sources_preserve_provenance: true,
  });
}

export function projectWorldSimulationUnifiedMemoryAccessibility(input = {}) {
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(
    input.current_turn_id ?? input.turn_id,
    "current_turn_id",
  );
  const accessibilityInput = object(input.accessibility_input);

  const retrievalPracticeProjection = verifyProjection(
    input.retrieval_practice_activation_projection,
    worldSimulationRetrievalPracticeActivationProjectionVersion,
    "retrieval_practice_activation_projection",
  );
  const baseLevelProjection = verifyProjection(
    input.base_level_activation_projection,
    worldSimulationBaseLevelActivationProjectionVersion,
    "base_level_activation_projection",
  );
  const rifProjection = verifyProjection(
    input.retrieval_induced_forgetting_accessibility_projection,
    worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
    "retrieval_induced_forgetting_accessibility_projection",
  );
  const reexposureProjection = verifyProjection(
    input.retrieval_induced_forgetting_reexposure_recovery_projection,
    worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
    "retrieval_induced_forgetting_reexposure_recovery_projection",
  );
  const contextRevivalProjection = verifyProjection(
    input.retrieval_context_revival_accessibility_projection,
    worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
    "retrieval_context_revival_accessibility_projection",
  );

  for (const [projection, label] of [
    [retrievalPracticeProjection, "retrieval_practice_activation_projection"],
    [baseLevelProjection, "base_level_activation_projection"],
    [rifProjection, "retrieval_induced_forgetting_accessibility_projection"],
    [reexposureProjection, "retrieval_induced_forgetting_reexposure_recovery_projection"],
    [contextRevivalProjection, "retrieval_context_revival_accessibility_projection"],
  ]) {
    verifyContext(projection, character, currentTurnId, label);
  }

  const baseProjectedIds = array(baseLevelProjection.projected_memory_ids);
  const finalMemoryIds = memoryIds(
    accessibilityInput.memory_records,
    "accessibility_input.memory_records",
  );
  const contextRevivalRecordIds = memoryIds(
    contextRevivalProjection.projected_memory_records,
    "retrieval_context_revival_accessibility_projection.projected_memory_records",
  );

  if (baseLevelProjection.source_retrieval_practice_projection_id
      !== retrievalPracticeProjection.projection_id
    || !sameArray(baseProjectedIds, rifProjection.input_memory_ids)
    || !sameArray(baseProjectedIds, reexposureProjection.input_memory_ids)
    || !sameArray(baseProjectedIds, contextRevivalProjection.input_memory_ids)
    || reexposureProjection.source_phase83b_projection_id !== rifProjection.projection_id
    || contextRevivalProjection.source_phase83b_projection_id !== rifProjection.projection_id
    || contextRevivalProjection.source_phase83c_projection_id !== reexposureProjection.projection_id
    || !sameArray(contextRevivalProjection.projected_memory_ids, contextRevivalRecordIds)
    || !sameArray(contextRevivalProjection.projected_memory_ids, finalMemoryIds)) {
    const error = new Error(
      "Phase90B source projections do not form one canonical accessibility lineage.",
    );
    error.code = "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_LINEAGE_MISMATCH";
    throw error;
  }

  const accessibilityQuery = queryWorldSimulationMemoryAccessibility({
    ...cloneJson(accessibilityInput),
    character,
  });
  const unifiedEvidence = evidenceFor({
    finalMemoryIds,
    retrievalPracticeProjection,
    baseLevelProjection,
    rifProjection,
    reexposureProjection,
    contextRevivalProjection,
    accessibilityQuery,
  });

  const projectionBody = {
    version: worldSimulationUnifiedMemoryAccessibilityProjectionVersion,
    phase: "Phase90B",
    character,
    current_turn_id: currentTurnId,
    source_projection_refs: {
      retrieval_practice_activation_projection_id:
        retrievalPracticeProjection.projection_id,
      base_level_activation_projection_id:
        baseLevelProjection.projection_id,
      retrieval_induced_forgetting_accessibility_projection_id:
        rifProjection.projection_id,
      retrieval_induced_forgetting_reexposure_recovery_projection_id:
        reexposureProjection.projection_id,
      retrieval_context_revival_accessibility_projection_id:
        contextRevivalProjection.projection_id,
      phase63b_query_audit_hash:
        accessibilityQuery.audit.audit_hash,
    },
    input_memory_ids: cloneJson(baseProjectedIds),
    final_ephemeral_memory_ids: cloneJson(finalMemoryIds),
    candidate_memory_ids: array(accessibilityQuery.result.candidate_memory_records)
      .map((record, index) => memoryId(record, index, "phase63b_candidate_memory_records")),
    accessibility_evidence: unifiedEvidence,
  };

  return deepFreeze({
    ...projectionBody,
    projection_id:
      `unified_memory_accessibility_projection_${hashAgentRunValue(projectionBody).slice(0, 24)}`,
    memory_accessibility_query: cloneJson(accessibilityQuery),
    projected_memory_records:
      cloneJson(accessibilityInput.memory_records),
    candidate_memory_records:
      cloneJson(accessibilityQuery.result.candidate_memory_records),
    audit: {
      projection_applied: true,
      source_lineage_verified: true,
      phase63b_query_executed_once_by_unified_projection: true,
      final_ephemeral_order_matches_phase84b: true,
      memory_membership_preserved_before_phase63b_candidate_filter: true,
      candidate_membership_owned_by_phase63b: true,
      actual_retrieval_owned_by_phase63c: true,
      source_memory_content_mutated: false,
      persistent_memory_order_mutated: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      single_memory_strength_created: false,
      new_scalar_accessibility_score_created: false,
      phase63b_diagnostic_score_reinterpreted_as_probability: false,
      current_accessibility_claimed_as_successful_retrieval: false,
      world_truth_authority_claimed: false,
      provenance_preserved_per_memory: true,
    },
  });
}
