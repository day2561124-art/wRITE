import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion =
  "phase82d-counterfactual-linked-experience-longitudinal-reuse-outcome-revise-retain-admission-v1";

export const longitudinalReuseOutcomeAdmissionDecisions = Object.freeze([
  "retain_longitudinal_case_evidence",
  "request_discriminating_context_evidence",
  "defer",
]);

const maximumAdmissionCount = 32;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_INPUT_INVALID",
      `Phase82D ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}

function expectedDecisionsFor(appraisal) {
  if (appraisal.appraisal_kind === "recurrent_pattern_candidate"
      && appraisal.learning_orientation === "preserve_as_future_case_evidence") {
    return ["retain_longitudinal_case_evidence", "defer"];
  }
  if (appraisal.appraisal_kind === "context_sensitive_pattern_candidate"
      && appraisal.learning_orientation === "seek_discriminating_context") {
    return ["request_discriminating_context_evidence", "defer"];
  }
  return ["defer"];
}

function verifyCanonicalPhase82C(input, lineage) {
  const supplied = cloneJson(input.longitudinal_reuse_outcome_appraisal);
  if (!isObject(supplied)
      || supplied.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion
      || supplied.phase !== "Phase82C"
      || supplied.world_simulation_session_id !== lineage.world_simulation_session_id
      || supplied.turn_id !== lineage.turn_id
      || supplied.state_revision !== lineage.state_revision
      || supplied.world_state_hash !== lineage.world_state_hash
      || !Array.isArray(supplied.appraisals)
      || supplied.appraisal_count !== supplied.appraisals.length
      || !text(supplied.projection_hash)
      || hashWithout(supplied, "projection_hash") !== supplied.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_PHASE82C_INVALID",
      "Phase82D requires the canonical Phase82C appraisal projection for this turn.",
    );
  }

  const resolverView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(input);
  const appraisalDecisions = supplied.appraisals.map((appraisal) => ({
    comparison_context_ref: appraisal.source_phase82b_context_ref,
    appraisal_kind: appraisal.appraisal_kind,
    learning_orientation: appraisal.learning_orientation,
    salient_comparison_refs: cloneJson(array(appraisal.salient_comparison_refs)),
  }));
  const rebuilt = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...input,
    resolver_view: resolverView,
    appraisal_decisions: appraisalDecisions,
  });
  if (rebuilt.projection_hash !== supplied.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_PHASE82C_MISMATCH",
      "Phase82D requires Phase82C to match a fresh reconstruction from canonical Phase82B and underlying lineage.",
    );
  }
  return supplied;
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
    phase: "Phase82D",
    status: "bounded_longitudinal_reuse_outcome_revise_retain_admission_installed",
    source_owner: "Phase82C",
    admission_owner: "CharacterBrain",
    supported_decisions: [...longitudinalReuseOutcomeAdmissionDecisions],
    exact_phase82c_projection_hash_required: true,
    canonical_phase82c_reconstruction_required: true,
    exact_source_appraisal_ref_required: true,
    source_distinct_subjective_outcomes_preserved: true,
    recurrence_may_admit_future_case_evidence_only: true,
    contextual_variation_may_request_discriminating_context_only: true,
    uncertain_pattern_must_defer: true,
    numeric_effectiveness_or_success_rate_modeled: false,
    probability_confidence_utility_reward_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    automatic_rule_or_preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    ordinary_subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    world_state_mutation_allowed: false,
    same_turn_action_selection_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    future_reentry_requires_separate_phase: true,
  });
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input = {}) {
  const lineage = {
    world_simulation_session_id: requiredText(input.world_simulation_session_id, "world_simulation_session_id"),
    turn_id: requiredText(input.turn_id, "turn_id"),
    state_revision: input.state_revision,
    world_state_hash: requiredText(input.world_state_hash, "world_state_hash", 128),
  };
  if (!Number.isSafeInteger(lineage.state_revision) || lineage.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_INPUT_INVALID",
      "Phase82D state_revision must be a non-negative safe integer.",
    );
  }
  const phase82c = verifyCanonicalPhase82C(input, lineage);
  const candidates = phase82c.appraisals.map((appraisal) => ({
    appraisal_ref: appraisal.appraisal_ref,
    appraisal_hash: appraisal.appraisal_hash,
    character: appraisal.character,
    source_phase82b_context_ref: appraisal.source_phase82b_context_ref,
    source_phase82a_context_ref: appraisal.source_phase82a_context_ref,
    source_phase81m_capsule_ref: appraisal.source_phase81m_capsule_ref,
    reuse_intent_ref: appraisal.reuse_intent_ref,
    appraisal_kind: appraisal.appraisal_kind,
    learning_orientation: appraisal.learning_orientation,
    salient_comparison_refs: cloneJson(array(appraisal.salient_comparison_refs)),
    allowed_admission_decisions: expectedDecisionsFor(appraisal),
  })).sort((left, right) => compareText(left.appraisal_ref, right.appraisal_ref));
  const view = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
    phase: "Phase82D",
    ...lineage,
    source_phase82c_projection_hash: phase82c.projection_hash,
    status: candidates.length > 0 ? "bounded_revise_retain_admission_ready" : "no_phase82c_appraisal_to_admit",
    candidate_count: candidates.length,
    candidates,
    response_contract: {
      output_shape: "array_of_appraisal_ref_and_admission_decision",
      required_fields: ["appraisal_ref", "decision"],
      allowed_decisions_must_come_from_candidate: true,
      freeform_rule_or_memory_content_authoring_allowed: false,
      numeric_score_probability_reward_q_value_authoring_allowed: false,
    },
    boundaries: {
      phase82b_raw_comparison_payload_exposed: false,
      raw_world_state_exposed: false,
      raw_causal_outcome_exposed: false,
      source_distinct_subjective_outcomes_preserved: true,
      same_turn_action_selection_feedback_allowed: false,
      world_truth_authority: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion
      || view.phase !== "Phase82D"
      || !text(view.world_simulation_session_id)
      || !text(view.turn_id)
      || !Number.isSafeInteger(view.state_revision)
      || view.state_revision < 0
      || !text(view.world_state_hash)
      || !text(view.source_phase82c_projection_hash)
      || !Array.isArray(view.candidates)
      || view.candidate_count !== view.candidates.length
      || view.candidate_count > maximumAdmissionCount
      || !text(view.resolver_view_hash)
      || hashWithout(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_VIEW_INVALID",
      "Phase82D requires an exact bounded revise/retain admission resolver view.",
    );
  }
  for (const candidate of view.candidates) {
    if (!isObject(candidate)
        || !text(candidate.appraisal_ref)
        || !text(candidate.appraisal_hash)
        || !text(candidate.character)
        || !text(candidate.appraisal_kind)
        || !text(candidate.learning_orientation)
        || !Array.isArray(candidate.allowed_admission_decisions)
        || candidate.allowed_admission_decisions.some((decision) => !longitudinalReuseOutcomeAdmissionDecisions.includes(decision))) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_VIEW_INVALID",
        "Phase82D resolver view contains an invalid admission candidate.",
      );
    }
  }
  return Object.freeze(view);
}

const allowedDecisionFields = new Set(["appraisal_ref", "decision"]);
const forbiddenDecisionFields = new Set([
  "effectiveness", "effectiveness_score", "success", "failure", "success_rate", "failure_rate",
  "probability", "confidence", "utility", "reward", "q_value", "causal_credit", "outcome_credit",
  "rule", "preference", "belief", "belief_revision", "semantic", "semantic_revision",
  "memory", "memory_revision", "world_state", "world_truth", "selected_action",
]);

export function projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission(input = {}) {
  const view = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input.resolver_view);
  const rebuiltView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input);
  if (rebuiltView.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_VIEW_STALE",
      "Phase82D resolver view no longer matches exact canonical Phase82C sources.",
    );
  }
  const rawDecisions = array(input.admission_decisions);
  if (rawDecisions.length > view.candidate_count || rawDecisions.length > maximumAdmissionCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_LIMIT",
      "Phase82D accepts at most one admission decision per visible Phase82C appraisal.",
    );
  }
  const candidateByRef = new Map(view.candidates.map((candidate) => [candidate.appraisal_ref, candidate]));
  const seen = new Set();
  const admissions = [];
  for (const [index, raw] of rawDecisions.entries()) {
    if (!isObject(raw)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_INVALID",
        `Phase82D decision ${index} must be an object.`,
      );
    }
    const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
    if (forbidden.length) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_AUTHORITY_FIELD_FORBIDDEN",
        `Phase82D resolver may not author authority field(s): ${forbidden.join(", ")}.`,
      );
    }
    const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
    if (unknown.length) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_FIELD_FORBIDDEN",
        `Phase82D decision contains unsupported field(s): ${unknown.join(", ")}.`,
      );
    }
    const appraisalRef = requiredText(raw.appraisal_ref, `decisions[${index}].appraisal_ref`, 180);
    const decision = requiredText(raw.decision, `decisions[${index}].decision`, 120);
    if (seen.has(appraisalRef)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_DUPLICATE",
        `Phase82D received duplicate admission decision for ${appraisalRef}.`,
      );
    }
    seen.add(appraisalRef);
    const candidate = candidateByRef.get(appraisalRef);
    if (!candidate) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_APPRAISAL_OUT_OF_VIEW",
        `Phase82D decision references appraisal outside resolver view: ${appraisalRef}.`,
      );
    }
    if (!candidate.allowed_admission_decisions.includes(decision)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_INCOMPATIBLE",
        `Phase82D decision ${decision} is incompatible with the exact Phase82C appraisal orientation.`,
      );
    }
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
      world_simulation_session_id: view.world_simulation_session_id,
      turn_id: view.turn_id,
      state_revision: view.state_revision,
      world_state_hash: view.world_state_hash,
      character: candidate.character,
      source_phase82c_projection_hash: view.source_phase82c_projection_hash,
      source_phase82c_appraisal_ref: candidate.appraisal_ref,
      source_phase82c_appraisal_hash: candidate.appraisal_hash,
      source_phase82b_context_ref: candidate.source_phase82b_context_ref,
      source_phase82a_context_ref: candidate.source_phase82a_context_ref,
      source_phase81m_capsule_ref: candidate.source_phase81m_capsule_ref,
      reuse_intent_ref: candidate.reuse_intent_ref,
      appraisal_kind: candidate.appraisal_kind,
      learning_orientation: candidate.learning_orientation,
      salient_comparison_refs: cloneJson(candidate.salient_comparison_refs),
      admission_decision: decision,
    };
    const admissionHash = hashAgentRunValue(identity);
    admissions.push({
      admission_ref: `phase82d_admission_${admissionHash.slice(0, 24)}`,
      admission_hash: admissionHash,
      ...identity,
      admitted_for_future_longitudinal_case_reentry:
        decision === "retain_longitudinal_case_evidence",
      discriminating_context_evidence_requested:
        decision === "request_discriminating_context_evidence",
      revise_retain_deferred:
        decision === "defer",
      recurrence_is_effectiveness_claim: false,
      variation_is_failure_claim: false,
      numeric_effectiveness_or_success_rate_assigned: false,
      probability_confidence_utility_reward_q_value_assigned: false,
      causal_or_outcome_credit_assigned: false,
      rule_or_preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      ordinary_subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    });
  }
  admissions.sort((left, right) => compareText(left.admission_ref, right.admission_ref));
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
    phase: "Phase82D",
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
    source_phase82c_projection_hash: view.source_phase82c_projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    admission_count: admissions.length,
    admissions,
    audit: {
      exact_phase82c_source_reconstructed: true,
      exact_source_appraisal_refs_verified: true,
      source_distinct_subjective_outcomes_preserved: true,
      numeric_effectiveness_or_success_rate_modeled: false,
      probability_confidence_utility_reward_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      automatic_rule_or_preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      ordinary_subjective_memory_rewrite_performed: false,
      same_turn_action_selection_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_admission: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      admitted_evidence_may_reenter_only_in_future_turn: true,
      future_reentry_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}
