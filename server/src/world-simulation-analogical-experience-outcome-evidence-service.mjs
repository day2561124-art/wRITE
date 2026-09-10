import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceApplicationLineageBundle,
  worldSimulationAnalogicalExperienceApplicationLineageVersion,
} from "./world-simulation-analogical-experience-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "./world-simulation-experiential-method-outcome-credit-service.mjs";

export const worldSimulationAnalogicalExperienceOutcomeEvidenceVersion =
  "phase80e-adapted-analogy-subjective-outcome-evidence-v1";

const maximumEvidenceRecordCount = 48;
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
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`Phase80E ${label} is required and must be bounded.`);
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_INPUT_INVALID";
    throw error;
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredText(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function projectionHash(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}

function verifyPhase76G(value, expectedTurnId, expectedPhase76FBundleHash) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodOutcomeCreditVersion
      || projection.turn_id !== expectedTurnId
      || projection.source_phase76f_receipt_bundle_hash !== expectedPhase76FBundleHash
      || !text(projection.source_phase76b_bridge_hash)
      || !text(projection.resolver_view_hash)
      || !Array.isArray(projection.assessments)
      || projection.assessment_count !== projection.assessments.length
      || !Array.isArray(projection.semantic_decisions)
      || projection.semantic_decision_count !== projection.semantic_decisions.length
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_INVALID",
      "Phase80E requires an exact canonical Phase76G subjective outcome projection for the same selected-application bundle.",
    );
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
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_BOUNDARY_INVALID",
      "Phase80E rejects a Phase76G source that violates the sealed subjective-outcome boundary.",
    );
  }
  const seenAssessmentRefs = new Set();
  const seenReceiptIds = new Set();
  for (const [index, assessment] of projection.assessments.entries()) {
    if (!isObject(assessment)
        || assessment.version !== worldSimulationExperientialMethodOutcomeCreditVersion
        || assessment.turn_id !== expectedTurnId
        || !text(assessment.assessment_ref)
        || !text(assessment.assessment_hash)
        || !text(assessment.application_ref)
        || !text(assessment.phase76f_application_receipt_id)
        || !text(assessment.phase76f_application_receipt_hash)
        || !supportedAssessments.includes(assessment.assessment)
        || !text(assessment.character)
        || !text(assessment.action_id)
        || assessment.outcome_basis !== "bounded_subjective_post_outcome_experience"
        || assessment.objective_causation_claimed !== false
        || assessment.numeric_credit_assigned !== false
        || assessment.subjective_not_world_truth !== true) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_INVALID",
        `Phase80E Phase76G assessment ${index} is invalid.`,
      );
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
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_HASH_MISMATCH",
        "Phase80E Phase76G assessment identity verification failed.",
      );
    }
    if (seenAssessmentRefs.has(assessment.assessment_ref)
        || seenReceiptIds.has(assessment.phase76f_application_receipt_id)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_DUPLICATE",
        "Phase80E accepts at most one Phase76G assessment per selected application receipt.",
      );
    }
    seenAssessmentRefs.add(assessment.assessment_ref);
    seenReceiptIds.add(assessment.phase76f_application_receipt_id);
  }
  return deepFreeze(projection);
}

function evidenceKind(assessment) {
  if (assessment === "supports_prior_method") {
    return "adapted_analogy_method_supported_by_subjective_outcome";
  }
  if (assessment === "counterevidence_for_prior_method") {
    return "adapted_analogy_method_counterevidenced_by_subjective_outcome";
  }
  return "adapted_analogy_method_outcome_ambiguous";
}

export function buildWorldSimulationAnalogicalExperienceOutcomeEvidenceContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceOutcomeEvidenceVersion,
    phase: "Phase80E",
    status: "adapted_analogy_subjective_outcome_evidence_installed",
    source_adapted_application_lineage_owner: "Phase80D",
    source_subjective_outcome_owner: "Phase76G",
    exact_phase80d_receipt_bundle_hash_required: true,
    exact_phase76g_projection_hash_required: true,
    exact_phase76f_receipt_identity_join_required: true,
    full_phase80a_b_c_d_provenance_preserved: true,
    selected_application_observed_before_outcome_evidence: true,
    only_explicit_subjective_outcome_assessments_observed: true,
    adaptation_success_inferred: false,
    analogy_validity_inferred: false,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    preference_authority_claimed: false,
    automatic_retain_revise_decision_performed: false,
    semantic_retention_performed: false,
    semantic_revision_performed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    raw_action_outcome_consumed: false,
    hidden_causal_evidence_consumed: false,
    world_truth_authority_claimed: false,
    direct_action_selection_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_evidence_record_count: maximumEvidenceRecordCount,
  });
}

export function assertWorldSimulationAnalogicalExperienceOutcomeEvidence(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceOutcomeEvidenceVersion
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase80d_receipt_bundle_hash)
      || !text(projection.source_phase76g_projection_hash)
      || !Array.isArray(projection.evidence_records)
      || projection.evidence_count !== projection.evidence_records.length
      || projection.evidence_count > maximumEvidenceRecordCount
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_INVALID",
      "Phase80E adapted-analogy outcome-evidence projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        `Phase80E projection ${key} does not match expected lineage.`,
      );
    }
  }
  const seenRefs = new Set();
  for (const record of projection.evidence_records) {
    if (!isObject(record)
        || record.version !== worldSimulationAnalogicalExperienceOutcomeEvidenceVersion
        || record.world_simulation_session_id !== projection.world_simulation_session_id
        || record.turn_id !== projection.turn_id
        || record.state_revision !== projection.state_revision
        || record.world_state_hash !== projection.world_state_hash
        || !text(record.character)
        || !text(record.phase80d_lineage_receipt_id)
        || !text(record.phase80d_lineage_receipt_hash)
        || !text(record.phase80c_projection_hash)
        || !text(record.source_phase80a_projection_hash)
        || !text(record.source_phase80b_adaptation_hash)
        || !text(record.analogy_candidate_ref)
        || !text(record.current_impasse_ref)
        || !text(record.current_corresponding_method_ref)
        || !text(record.phase76f_application_receipt_id)
        || !text(record.phase76f_application_receipt_hash)
        || !text(record.action_id)
        || !text(record.action_ref)
        || !text(record.phase76g_assessment_ref)
        || !text(record.phase76g_assessment_hash)
        || !supportedAssessments.includes(record.method_outcome_assessment)
        || record.outcome_evidence_kind !== evidenceKind(record.method_outcome_assessment)
        || record.selected_application_method_identity_preserved !== true
        || record.subjective_outcome_not_world_truth !== true
        || record.adaptation_success_inferred !== false
        || record.analogy_validity_inferred !== false
        || record.comparative_superiority_inferred !== false
        || record.causal_credit_assigned !== false
        || record.preference_retention_performed !== false
        || record.semantic_retention_performed !== false
        || record.semantic_revision_performed !== false
        || record.world_truth_authority !== false
        || !text(record.evidence_ref)
        || !text(record.evidence_hash)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_RECORD_INVALID",
        "Phase80E adapted-analogy outcome-evidence record is invalid.",
      );
    }
    const identity = {
      version: record.version,
      world_simulation_session_id: record.world_simulation_session_id,
      turn_id: record.turn_id,
      state_revision: record.state_revision,
      world_state_hash: record.world_state_hash,
      character: record.character,
      phase80d_lineage_receipt_id: record.phase80d_lineage_receipt_id,
      phase80d_lineage_receipt_hash: record.phase80d_lineage_receipt_hash,
      phase80c_projection_hash: record.phase80c_projection_hash,
      source_phase80a_projection_hash: record.source_phase80a_projection_hash,
      source_phase80b_adaptation_hash: record.source_phase80b_adaptation_hash,
      analogy_candidate_ref: record.analogy_candidate_ref,
      current_impasse_ref: record.current_impasse_ref,
      current_corresponding_method_ref: record.current_corresponding_method_ref,
      phase76f_application_receipt_id: record.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: record.phase76f_application_receipt_hash,
      action_id: record.action_id,
      action_ref: record.action_ref,
      phase76g_assessment_ref: record.phase76g_assessment_ref,
      phase76g_assessment_hash: record.phase76g_assessment_hash,
      method_outcome_assessment: record.method_outcome_assessment,
      outcome_evidence_kind: record.outcome_evidence_kind,
    };
    const expectedHash = hashAgentRunValue(identity);
    if (record.evidence_hash !== expectedHash
        || record.evidence_ref !== `phase80e_outcome_evidence_${expectedHash.slice(0, 24)}`
        || seenRefs.has(record.evidence_ref)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_RECORD_HASH_MISMATCH",
        "Phase80E adapted-analogy outcome-evidence record identity verification failed.",
      );
    }
    seenRefs.add(record.evidence_ref);
  }
  return deepFreeze(projection);
}

export function buildWorldSimulationAnalogicalExperienceOutcomeEvidence(input = {}) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id");
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_INPUT_INVALID",
      "Phase80E state_revision must be a non-negative integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const lineageBundle = assertWorldSimulationAnalogicalExperienceApplicationLineageBundle(
    input.analogical_experience_application_lineage,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (lineageBundle.version !== worldSimulationAnalogicalExperienceApplicationLineageVersion) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE80D_INVALID",
      "Phase80E requires the canonical Phase80D application-lineage version.",
    );
  }
  const outcomeCredit = verifyPhase76G(
    input.experiential_method_outcome_credit,
    turnId,
    lineageBundle.source_phase76f_receipt_bundle_hash,
  );
  const assessmentByReceipt = new Map(
    outcomeCredit.assessments.map((assessment) => [assessment.phase76f_application_receipt_id, assessment]),
  );
  const evidenceRecords = [];
  for (const lineage of lineageBundle.receipts) {
    const assessment = assessmentByReceipt.get(lineage.phase76f_application_receipt_id);
    if (!assessment) continue;
    if (assessment.phase76f_application_receipt_hash !== lineage.phase76f_application_receipt_hash
        || characterKey(assessment.character) !== characterKey(lineage.character)
        || assessment.action_id !== lineage.action_id) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_SOURCE_MISMATCH",
        "Phase80E Phase80D/Phase76G selected-application lineage does not match.",
      );
    }
    const identity = {
      version: worldSimulationAnalogicalExperienceOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: lineage.character,
      phase80d_lineage_receipt_id: lineage.receipt_id,
      phase80d_lineage_receipt_hash: lineage.receipt_hash,
      phase80c_projection_hash: lineage.phase80c_projection_hash,
      source_phase80a_projection_hash: lineage.source_phase80a_projection_hash,
      source_phase80b_adaptation_hash: lineage.source_phase80b_adaptation_hash,
      analogy_candidate_ref: lineage.analogy_candidate_ref,
      current_impasse_ref: lineage.current_impasse_ref,
      current_corresponding_method_ref: lineage.current_corresponding_method_ref,
      phase76f_application_receipt_id: lineage.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: lineage.phase76f_application_receipt_hash,
      action_id: lineage.action_id,
      action_ref: lineage.action_ref,
      phase76g_assessment_ref: assessment.assessment_ref,
      phase76g_assessment_hash: assessment.assessment_hash,
      method_outcome_assessment: assessment.assessment,
      outcome_evidence_kind: evidenceKind(assessment.assessment),
    };
    const evidenceHash = hashAgentRunValue(identity);
    evidenceRecords.push({
      evidence_ref: `phase80e_outcome_evidence_${evidenceHash.slice(0, 24)}`,
      evidence_hash: evidenceHash,
      ...identity,
      selected_application_method_identity_preserved: true,
      subjective_outcome_not_world_truth: true,
      adaptation_success_inferred: false,
      analogy_validity_inferred: false,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      preference_retention_performed: false,
      semantic_retention_performed: false,
      semantic_revision_performed: false,
      world_truth_authority: false,
    });
  }
  evidenceRecords.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  if (evidenceRecords.length > maximumEvidenceRecordCount) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_LIMIT_EXCEEDED",
      `Phase80E accepts at most ${maximumEvidenceRecordCount} outcome-evidence records per turn.`,
    );
  }
  const projection = {
    version: worldSimulationAnalogicalExperienceOutcomeEvidenceVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase80d_receipt_bundle_hash: lineageBundle.receipt_bundle_hash,
    source_phase76g_projection_hash: outcomeCredit.projection_hash,
    evidence_count: evidenceRecords.length,
    evidence_records: evidenceRecords,
    audit: {
      exact_phase80d_lineage_verified: true,
      exact_phase76g_subjective_outcome_verified: true,
      exact_phase76f_receipt_identity_joined: true,
      full_phase80a_b_c_d_provenance_preserved: true,
      only_explicit_phase76g_assessments_observed: true,
      adaptation_success_inferred: false,
      analogy_validity_inferred: false,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      automatic_retain_revise_decision_performed: false,
      semantic_retention_performed: false,
      semantic_revision_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      raw_action_outcome_consumed: false,
      hidden_causal_evidence_consumed: false,
      same_turn_character_brain_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      projection_does_not_mutate_world_state: true,
      retention_deferred: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationAnalogicalExperienceOutcomeEvidence(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
  });
}
