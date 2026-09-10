import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle,
  worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion,
} from "./world-simulation-experiential-method-impasse-resolution-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "./world-simulation-experiential-method-outcome-credit-service.mjs";

export const worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion =
  "phase79h-impasse-resolution-outcome-evidence-v1";

const maximumEvidenceRecordCount = 64;
const supportedAssessments = Object.freeze([
  "supports_prior_method",
  "counterevidence_for_prior_method",
  "ambiguous_no_revision",
]);

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

function requiredString(value, label, maxLength = 512, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`Phase79H ${label} is required and must be bounded.`);
    error.code = code;
    throw error;
  }
  return text;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function characterKey(value) {
  return requiredString(value, "character", 240)
    .toLocaleLowerCase("zh-Hant-TW");
}

function verifyPhase76GProjection(value, expectedTurnId, expectedPhase76FBundleHash) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodOutcomeCreditVersion
      || projection.turn_id !== expectedTurnId
      || projection.source_phase76f_receipt_bundle_hash !== expectedPhase76FBundleHash
      || !optionalString(projection.source_phase76b_bridge_hash)
      || !optionalString(projection.resolver_view_hash)
      || !Array.isArray(projection.assessments)
      || projection.assessment_count !== projection.assessments.length
      || !Array.isArray(projection.semantic_decisions)
      || projection.semantic_decision_count !== projection.semantic_decisions.length
      || !optionalString(projection.projection_hash)) {
    const error = new Error("Phase79H requires an exact canonical Phase76G outcome-credit projection for the same selected-application bundle.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    const error = new Error("Phase79H Phase76G projection failed immutable verification.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_HASH_MISMATCH";
    throw error;
  }
  const audit = object(projection.audit);
  if (audit.exact_phase76f_application_receipts_verified !== true
      || audit.exact_phase76b_subjective_experience_verified !== true
      || audit.raw_action_outcome_consumed !== false
      || audit.hidden_causal_evidence_consumed !== false
      || audit.objective_causation_claimed !== false
      || audit.success_auto_credits_method !== false
      || audit.failure_auto_discredits_method !== false
      || audit.numeric_reward_q_value_success_rate_modeled !== false
      || audit.parallel_semantic_store_created !== false
      || audit.same_turn_character_brain_feedback !== false) {
    const error = new Error("Phase79H rejects a Phase76G source that does not preserve sealed subjective-outcome boundaries.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_BOUNDARY_INVALID";
    throw error;
  }
  const seenAssessmentRefs = new Set();
  const seenReceiptIds = new Set();
  for (const [index, assessment] of projection.assessments.entries()) {
    if (!isObject(assessment)
        || !optionalString(assessment.assessment_ref)
        || !optionalString(assessment.assessment_hash)
        || assessment.version !== worldSimulationExperientialMethodOutcomeCreditVersion
        || assessment.turn_id !== expectedTurnId
        || !optionalString(assessment.application_ref)
        || !optionalString(assessment.phase76f_application_receipt_id)
        || !optionalString(assessment.phase76f_application_receipt_hash)
        || !supportedAssessments.includes(assessment.assessment)
        || !optionalString(assessment.character)
        || !optionalString(assessment.action_id)
        || assessment.outcome_basis !== "bounded_subjective_post_outcome_experience"
        || assessment.objective_causation_claimed !== false
        || assessment.numeric_credit_assigned !== false
        || assessment.subjective_not_world_truth !== true) {
      const error = new Error(`Phase79H Phase76G assessment ${index} is invalid.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_INVALID";
      throw error;
    }
    const identity = {
      version: assessment.version,
      turn_id: assessment.turn_id,
      application_ref: assessment.application_ref,
      phase76f_application_receipt_id: assessment.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: assessment.phase76f_application_receipt_hash,
      assessment: assessment.assessment,
    };
    const expectedHash = hashAgentRunValue(identity);
    if (assessment.assessment_hash !== expectedHash
        || assessment.assessment_ref !== `phase76g_credit_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase79H Phase76G assessment identity verification failed.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_HASH_MISMATCH";
      throw error;
    }
    if (seenAssessmentRefs.has(assessment.assessment_ref)
        || seenReceiptIds.has(assessment.phase76f_application_receipt_id)) {
      const error = new Error("Phase79H requires at most one Phase76G assessment per selected Phase76F application receipt.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_DUPLICATE";
      throw error;
    }
    seenAssessmentRefs.add(assessment.assessment_ref);
    seenReceiptIds.add(assessment.phase76f_application_receipt_id);
  }
  return deepFreeze(projection);
}

function outcomeEvidenceKind(assessment) {
  if (assessment === "supports_prior_method") {
    return "resolution_selected_method_supported_by_subjective_outcome";
  }
  if (assessment === "counterevidence_for_prior_method") {
    return "resolution_selected_method_counterevidenced_by_subjective_outcome";
  }
  return "resolution_selected_method_outcome_ambiguous";
}

export function buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
    phase: "Phase79H",
    status: "resolution_selected_method_subjective_outcome_evidence_installed",
    source_resolution_application_owner: "Phase79G",
    source_subjective_outcome_credit_owner: "Phase76G",
    exact_phase79g_receipt_bundle_hash_required: true,
    exact_phase76g_projection_hash_required: true,
    exact_phase76f_receipt_identity_join_required: true,
    phase79g_resolution_source_provenance_preserved: true,
    phase79j_resolution_hash_preserved_when_present: true,
    only_phase79g_proven_resolution_applications_observed: true,
    only_explicit_phase76g_assessments_observed: true,
    comparative_preference_validated: false,
    alternative_method_outcomes_observed: false,
    counterfactual_superiority_inferred: false,
    resolution_success_inferred_from_method_success: false,
    resolution_failure_inferred_from_method_failure: false,
    automatic_preference_retention_performed: false,
    semantic_retention_performed: false,
    semantic_revision_performed: false,
    numeric_confidence_probability_utility_reward_modeled: false,
    raw_action_outcome_consumed: false,
    hidden_causal_evidence_consumed: false,
    world_truth_authority_claimed: false,
    resolver_used: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_evidence_record_count: maximumEvidenceRecordCount,
  });
}

export function assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion
      || !optionalString(projection.world_simulation_session_id)
      || !optionalString(projection.turn_id)
      || !Number.isInteger(projection.state_revision)
      || projection.state_revision < 0
      || !optionalString(projection.world_state_hash)
      || !optionalString(projection.source_phase79g_receipt_bundle_hash)
      || !optionalString(projection.source_phase76g_projection_hash)
      || !Array.isArray(projection.evidence_records)
      || projection.evidence_count !== projection.evidence_records.length
      || projection.evidence_count > maximumEvidenceRecordCount
      || !optionalString(projection.projection_hash)) {
    const error = new Error("Phase79H outcome-evidence projection is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    const error = new Error("Phase79H outcome-evidence projection hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_HASH_MISMATCH";
    throw error;
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      const error = new Error(`Phase79H projection ${key} does not match expected lineage.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH";
      throw error;
    }
  }
  const seenRefs = new Set();
  for (const record of projection.evidence_records) {
    const resolutionSourceOwner = optionalString(record?.resolution_source_owner) ?? "Phase79F";
    if (!isObject(record)
        || record.version !== worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion
        || record.world_simulation_session_id !== projection.world_simulation_session_id
        || record.turn_id !== projection.turn_id
        || record.state_revision !== projection.state_revision
        || record.world_state_hash !== projection.world_state_hash
        || !optionalString(record.character)
        || !optionalString(record.phase79g_lineage_receipt_id)
        || !optionalString(record.phase79g_lineage_receipt_hash)
        || !optionalString(record.phase79f_reresolution_hash)
        || !["Phase79F", "Phase79J"].includes(resolutionSourceOwner)
        || (resolutionSourceOwner === "Phase79F"
          && (Object.hasOwn(record, "resolution_source_owner")
            || Object.hasOwn(record, "phase79j_reresolution_hash")))
        || (resolutionSourceOwner === "Phase79J"
          && !optionalString(record.phase79j_reresolution_hash))
        || !optionalString(record.impasse_ref)
        || !["tie_impasse", "conflict_impasse"].includes(record.prior_impasse_type)
        || record.resolution_status !== "resolved_dominant"
        || !optionalString(record.dominant_method_ref)
        || !optionalString(record.phase76f_application_receipt_id)
        || !optionalString(record.phase76f_application_receipt_hash)
        || !optionalString(record.phase76g_assessment_ref)
        || !optionalString(record.phase76g_assessment_hash)
        || !supportedAssessments.includes(record.method_outcome_assessment)
        || !optionalString(record.outcome_evidence_kind)
        || record.comparative_preference_validated !== false
        || record.alternative_method_outcomes_observed !== false
        || record.counterfactual_superiority_inferred !== false
        || record.resolution_success_inferred !== false
        || record.resolution_failure_inferred !== false
        || record.preference_retention_performed !== false
        || record.semantic_retention_performed !== false
        || record.semantic_revision_performed !== false
        || record.world_truth_authority !== false
        || !optionalString(record.evidence_ref)
        || !optionalString(record.evidence_hash)) {
      const error = new Error("Phase79H outcome-evidence record is invalid.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_RECORD_INVALID";
      throw error;
    }
    if (record.outcome_evidence_kind !== outcomeEvidenceKind(record.method_outcome_assessment)) {
      const error = new Error("Phase79H outcome-evidence kind does not match the source Phase76G assessment.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_RECORD_INVALID";
      throw error;
    }
    const identity = {
      version: record.version,
      world_simulation_session_id: record.world_simulation_session_id,
      turn_id: record.turn_id,
      state_revision: record.state_revision,
      world_state_hash: record.world_state_hash,
      character: record.character,
      phase79g_lineage_receipt_id: record.phase79g_lineage_receipt_id,
      phase79g_lineage_receipt_hash: record.phase79g_lineage_receipt_hash,
      phase79f_reresolution_hash: record.phase79f_reresolution_hash,
      ...(resolutionSourceOwner === "Phase79J"
        ? {
          resolution_source_owner: "Phase79J",
          phase79j_reresolution_hash: record.phase79j_reresolution_hash,
        }
        : {}),
      impasse_ref: record.impasse_ref,
      prior_impasse_type: record.prior_impasse_type,
      resolution_status: record.resolution_status,
      dominant_method_ref: record.dominant_method_ref,
      phase76f_application_receipt_id: record.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: record.phase76f_application_receipt_hash,
      phase76g_assessment_ref: record.phase76g_assessment_ref,
      phase76g_assessment_hash: record.phase76g_assessment_hash,
      method_outcome_assessment: record.method_outcome_assessment,
      outcome_evidence_kind: record.outcome_evidence_kind,
    };
    const expectedHash = hashAgentRunValue(identity);
    if (record.evidence_hash !== expectedHash
        || record.evidence_ref !== `phase79h_outcome_evidence_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase79H outcome-evidence record identity verification failed.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_RECORD_HASH_MISMATCH";
      throw error;
    }
    if (seenRefs.has(record.evidence_ref)) {
      const error = new Error(`Phase79H duplicate evidence ref ${record.evidence_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_RECORD_DUPLICATE";
      throw error;
    }
    seenRefs.add(record.evidence_ref);
  }
  return deepFreeze(projection);
}

export function buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(input = {}) {
  const worldSimulationSessionId = requiredString(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const turnId = requiredString(input.turn_id, "turn_id", 240);
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    const error = new Error("Phase79H state_revision must be a non-negative integer.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_INPUT_INVALID";
    throw error;
  }
  const worldStateHash = requiredString(input.world_state_hash, "world_state_hash", 128);
  const lineageBundle = assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle(
    input.impasse_resolution_application_lineage,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (lineageBundle.version !== worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion) {
    const error = new Error("Phase79H requires the canonical Phase79G lineage version.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE79G_INVALID";
    throw error;
  }
  const outcomeCredit = verifyPhase76GProjection(
    input.experiential_method_outcome_credit,
    turnId,
    lineageBundle.source_phase76f_receipt_bundle_hash,
  );

  const assessmentByReceiptId = new Map(
    outcomeCredit.assessments.map((assessment) => [assessment.phase76f_application_receipt_id, assessment]),
  );
  const evidenceRecords = [];
  for (const lineage of lineageBundle.receipts) {
    const resolutionSourceOwner = optionalString(lineage.resolution_source_owner) ?? "Phase79F";
    const assessment = assessmentByReceiptId.get(lineage.phase76f_application_receipt_id);
    if (!assessment) continue;
    if (assessment.phase76f_application_receipt_hash !== lineage.phase76f_application_receipt_hash
        || characterKey(assessment.character) !== characterKey(lineage.character)
        || assessment.action_id !== lineage.action_id) {
      const error = new Error("Phase79H Phase79G/Phase76G selected-application lineage does not match.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_SOURCE_MISMATCH";
      throw error;
    }
    const identity = {
      version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: lineage.character,
      phase79g_lineage_receipt_id: lineage.receipt_id,
      phase79g_lineage_receipt_hash: lineage.receipt_hash,
      phase79f_reresolution_hash: lineage.phase79f_reresolution_hash,
      ...(resolutionSourceOwner === "Phase79J"
        ? {
          resolution_source_owner: "Phase79J",
          phase79j_reresolution_hash: lineage.phase79j_reresolution_hash,
        }
        : {}),
      impasse_ref: lineage.impasse_ref,
      prior_impasse_type: lineage.prior_impasse_type,
      resolution_status: lineage.resolution_status,
      dominant_method_ref: lineage.dominant_method_ref,
      phase76f_application_receipt_id: lineage.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: lineage.phase76f_application_receipt_hash,
      phase76g_assessment_ref: assessment.assessment_ref,
      phase76g_assessment_hash: assessment.assessment_hash,
      method_outcome_assessment: assessment.assessment,
      outcome_evidence_kind: outcomeEvidenceKind(assessment.assessment),
    };
    const evidenceHash = hashAgentRunValue(identity);
    evidenceRecords.push({
      evidence_ref: `phase79h_outcome_evidence_${evidenceHash.slice(0, 24)}`,
      evidence_hash: evidenceHash,
      ...identity,
      comparative_preference_validated: false,
      alternative_method_outcomes_observed: false,
      counterfactual_superiority_inferred: false,
      resolution_success_inferred: false,
      resolution_failure_inferred: false,
      preference_retention_performed: false,
      semantic_retention_performed: false,
      semantic_revision_performed: false,
      world_truth_authority: false,
    });
  }
  evidenceRecords.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  if (evidenceRecords.length > maximumEvidenceRecordCount) {
    const error = new Error(`Phase79H accepts at most ${maximumEvidenceRecordCount} outcome-evidence records per turn.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_LIMIT_EXCEEDED";
    throw error;
  }
  const projection = {
    version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase79g_receipt_bundle_hash: lineageBundle.receipt_bundle_hash,
    source_phase76g_projection_hash: outcomeCredit.projection_hash,
    evidence_count: evidenceRecords.length,
    evidence_records: evidenceRecords,
    audit: {
      exact_phase79g_lineage_verified: true,
      exact_phase76g_outcome_credit_verified: true,
      exact_phase76f_receipt_identity_joined: true,
      only_explicit_phase76g_assessments_observed: true,
      comparative_preference_validated: false,
      alternative_method_outcomes_observed: false,
      counterfactual_superiority_inferred: false,
      resolution_success_inferred_from_method_success: false,
      resolution_failure_inferred_from_method_failure: false,
      automatic_preference_retention_performed: false,
      semantic_retention_performed: false,
      semantic_revision_performed: false,
      numeric_confidence_probability_utility_reward_modeled: false,
      raw_action_outcome_consumed: false,
      hidden_causal_evidence_consumed: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      projection_does_not_mutate_world_state: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
  });
}
