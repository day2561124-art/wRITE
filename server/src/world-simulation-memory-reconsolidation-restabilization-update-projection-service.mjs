import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence,
  worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion,
} from "./world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";

export const worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion =
  "phase85b-memory-reconsolidation-restabilization-update-projection-v1";

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
function requiredString(value, label, code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}
function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
}
function assertPhase85AEvidenceShape(evidence, character, currentTurnId) {
  if (!isObject(evidence)
    || evidence.version !== worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion
    || evidence.phase !== "Phase85A"
    || !sameCharacter(evidence.character, character)
    || evidence.current_turn_id !== currentTurnId
    || !Array.isArray(evidence.lability_candidates)
    || !isObject(evidence.audit)) {
    const error = new Error("Phase85B requires current Phase85A lability candidate evidence.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_INVALID";
    throw error;
  }
  requiredString(
    evidence.evidence_hash,
    "phase85a_evidence.evidence_hash",
    "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_HASH_REQUIRED",
  );
}
function verifyPhase85AEvidence(input, worldState, character, currentTurnId) {
  const evidence = cloneJson(object(input));
  assertPhase85AEvidenceShape(evidence, character, currentTurnId);

  const body = cloneJson(evidence);
  const storedHash = body.evidence_hash;
  delete body.evidence_hash;
  if (hashAgentRunValue(body) !== storedHash) {
    const error = new Error("Phase85A evidence failed immutable hash verification.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_HASH_MISMATCH";
    throw error;
  }

  const rebuilt = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
  });
  if (rebuilt.evidence_hash !== evidence.evidence_hash
    || JSON.stringify(rebuilt) !== JSON.stringify(evidence)) {
    const error = new Error("Phase85A evidence is detached from canonical current World State reconstruction.");
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_CANONICAL_MISMATCH";
    throw error;
  }
  return evidence;
}
function validateCandidate(candidate, index) {
  const memoryId = requiredString(
    candidate?.memory_id,
    `phase85a_evidence.lability_candidates[${index}].memory_id`,
    "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_CANDIDATE_INVALID",
  );
  if (candidate.reconsolidation_lability_candidate !== true
    || candidate.reconsolidation_established !== false
    || candidate.memory_update_applied !== false
    || !Array.isArray(candidate.evidence)
    || candidate.evidence.length === 0) {
    const error = new Error(`Phase85A candidate ${memoryId} is not eligible for Phase85B projection.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_CANDIDATE_INVALID";
    throw error;
  }
  for (const [evidenceIndex, item] of candidate.evidence.entries()) {
    if (!isObject(item)
      || item.source_memory_ref !== memoryId
      || item.retrieved_memory_supported_prior_claim !== true
      || item.later_explicit_claim_conflict_present !== true
      || item.prediction_error_proxy_only !== true
      || !["challenges", "supersedes"].includes(item.conflict_relation)
      || !optionalString(item.source_retrieval_event_id)
      || !optionalString(item.conflict_relation_event_id)
      || !optionalString(item.prior_claim_event_id)
      || !optionalString(item.current_claim_event_id)
      || !Array.isArray(item.current_supporting_memory_refs)
      || item.current_supporting_memory_refs.length === 0) {
      const error = new Error(`Phase85A candidate ${memoryId} evidence[${evidenceIndex}] is invalid for Phase85B.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_CANDIDATE_EVIDENCE_INVALID";
      throw error;
    }
  }
  return memoryId;
}

export function buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjectionContract() {
  return deepFreeze({
    version: worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion,
    phase: "Phase85B",
    status: "bounded_reconsolidation_restabilization_update_projection_installed",
    canonical_phase85a_evidence_required: true,
    phase85a_reconstruction_verification_required: true,
    prediction_error_proxy_required: true,
    biological_reconsolidation_claimed: false,
    universal_reconsolidation_window_modeled: false,
    numeric_prediction_error_threshold_modeled: false,
    memory_content_rewrite_allowed: false,
    storage_strength_mutation_allowed: false,
    retrieval_strength_mutation_allowed: false,
    canonical_world_state_mutation_allowed: false,
    update_projection_is_interpretive_overlay_only: true,
    prior_and_current_claim_lineage_preserved: true,
    source_retrieval_lineage_preserved: true,
    downstream_application_requires_separate_phase: true,
  });
}

export function buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const phase85a = verifyPhase85AEvidence(input.phase85a_evidence, worldState, character, currentTurnId);

  const projections = phase85a.lability_candidates.map((candidate, index) => {
    const memoryId = validateCandidate(candidate, index);
    const evidence = candidate.evidence;
    const relationKinds = sortedUnique(evidence.map((item) => item.conflict_relation));
    const sourceRetrievalEventIds = sortedUnique(evidence.map((item) => item.source_retrieval_event_id));
    const conflictRelationEventIds = sortedUnique(evidence.map((item) => item.conflict_relation_event_id));
    const priorClaimEventIds = sortedUnique(evidence.map((item) => item.prior_claim_event_id));
    const currentClaimEventIds = sortedUnique(evidence.map((item) => item.current_claim_event_id));
    const currentSupportingMemoryRefs = sortedUnique(
      evidence.flatMap((item) => array(item.current_supporting_memory_refs).map(optionalString)),
    );

    const projectionBody = {
      memory_id: memoryId,
      projection_kind: "bounded_reconsolidation_interpretive_update",
      source_phase85a_evidence_hash: phase85a.evidence_hash,
      source_retrieval_event_ids: sourceRetrievalEventIds,
      conflict_relation_event_ids: conflictRelationEventIds,
      conflict_relations: relationKinds,
      prior_claim_event_ids: priorClaimEventIds,
      current_claim_event_ids: currentClaimEventIds,
      newly_relevant_supporting_memory_refs: currentSupportingMemoryRefs,
      old_memory_trace_preserved: true,
      interpretation_update_projected: true,
      canonical_memory_content_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      biological_reconsolidation_established: false,
      restabilization_application_performed: false,
    };
    return {
      ...projectionBody,
      projection_hash: hashAgentRunValue(projectionBody),
    };
  }).sort((left, right) => left.memory_id.localeCompare(right.memory_id, "zh-Hant-TW"));

  const resultBody = {
    version: worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion,
    phase: "Phase85B",
    character,
    current_turn_id: currentTurnId,
    source_phase85a_evidence_hash: phase85a.evidence_hash,
    restabilization_update_projections: projections,
    audit: {
      phase85a_hash_verified: true,
      phase85a_canonical_reconstruction_verified: true,
      prediction_error_proxy_only: true,
      biological_reconsolidation_claimed: false,
      universal_reconsolidation_window_assumed: false,
      numeric_prediction_error_threshold_used: false,
      memory_content_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      canonical_world_state_mutated: false,
      update_projection_is_interpretive_overlay_only: true,
      downstream_application_requires_separate_phase: true,
    },
  };
  return deepFreeze({
    ...resultBody,
    projection_set_hash: hashAgentRunValue(resultBody),
  });
}
