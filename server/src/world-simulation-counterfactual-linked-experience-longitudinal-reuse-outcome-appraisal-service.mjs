import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-variation-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion =
  "phase82c-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-v1";

export const longitudinalReuseOutcomeAppraisalKinds = Object.freeze([
  "recurrent_pattern_candidate",
  "context_sensitive_pattern_candidate",
  "pattern_uncertain",
]);
export const longitudinalReuseOutcomeLearningOrientations = Object.freeze([
  "preserve_as_future_case_evidence",
  "seek_discriminating_context",
  "defer_revise_retain",
]);

const maximumContextCount = 32;
const maximumSalientComparisonRefs = 12;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_INPUT_INVALID", `Phase82C ${label} must be a bounded non-empty string.`);
  }
  return normalized;
}
function hashWithout(value, field) { const copy = cloneJson(value); delete copy[field]; return hashAgentRunValue(copy); }
function hasMissingComparisonEvidence(context) {
  return array(context.prior_comparisons).some((comparison) =>
    array(comparison.field_comparisons).some((item) =>
      item.relation === "missing_current"
      || item.relation === "missing_prior"
      || item.relation === "missing_both"));
}

function verifyCanonicalPhase82B(input, expectedLineage) {
  const supplied = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation(
    input.longitudinal_reuse_outcome_variation,
    expectedLineage,
  );
  if (supplied.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion) {
    fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PHASE82B_INVALID", "Phase82C requires the canonical Phase82B variation version.");
  }
  const rebuilt = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation({
    world_simulation_session_id: expectedLineage.world_simulation_session_id,
    turn_id: expectedLineage.turn_id,
    state_revision: expectedLineage.state_revision,
    world_state_hash: expectedLineage.world_state_hash,
    world_history: input.world_history,
    longitudinal_reuse_outcome_evidence: input.longitudinal_reuse_outcome_evidence,
    current_phase81q_outcome_evidence: input.current_phase81q_outcome_evidence,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage:
      input.counterfactual_linked_experience_reuse_outcome_selected_action_lineage,
    subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
    counterfactual_linked_experience_reuse_outcome_reentry_projections:
      input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    counterfactual_linked_experience_reuse_outcome_deliberation_projections:
      input.counterfactual_linked_experience_reuse_outcome_deliberation_projections,
    post_outcome_subjective_perception_projection:
      input.post_outcome_subjective_perception_projection,
  });
  if (rebuilt.projection_hash !== supplied.projection_hash) {
    fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PHASE82B_MISMATCH", "Phase82C requires Phase82B to match a fresh reconstruction from canonical Phase82A/Phase81Q/World History sources.");
  }
  return supplied;
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
    phase: "Phase82C",
    status: "bounded_longitudinal_reuse_outcome_qualitative_appraisal_installed",
    source_owner: "Phase82B",
    appraisal_owner: "CharacterBrain",
    supported_appraisal_kinds: [...longitudinalReuseOutcomeAppraisalKinds],
    supported_learning_orientations: [...longitudinalReuseOutcomeLearningOrientations],
    exact_phase82b_projection_hash_required: true,
    exact_phase82b_comparison_refs_required: true,
    per_outcome_source_lineage_preserved: true,
    numeric_effectiveness_or_success_rate_modeled: false,
    reward_or_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    automatic_revise_or_retain_performed: false,
    automatic_rule_promotion_performed: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_action_selection_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    revise_retain_decision_deferred_to_separate_phase: true,
  });
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(input = {}) {
  const lineage = {
    world_simulation_session_id: requiredText(input.world_simulation_session_id, "world_simulation_session_id"),
    turn_id: requiredText(input.turn_id, "turn_id"),
    state_revision: input.state_revision,
    world_state_hash: requiredText(input.world_state_hash, "world_state_hash", 128),
  };
  if (!Number.isSafeInteger(lineage.state_revision) || lineage.state_revision < 0) {
    fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_INPUT_INVALID", "Phase82C state_revision must be a non-negative safe integer.");
  }
  const phase82b = verifyCanonicalPhase82B(input, lineage);
  const contexts = phase82b.comparison_contexts.map((source) => ({
    comparison_context_ref: source.comparison_context_ref,
    comparison_context_hash: source.comparison_context_hash,
    character: source.character,
    source_phase82a_context_ref: source.source_phase82a_context_ref,
    source_phase81m_capsule_ref: source.source_phase81m_capsule_ref,
    reuse_intent_ref: source.reuse_intent_ref,
    prior_comparison_count: source.prior_comparison_count,
    exact_subjective_outcome_match_count: source.exact_subjective_outcome_match_count,
    subjective_outcome_variation_count: source.subjective_outcome_variation_count,
    all_prior_subjective_outcomes_exactly_match_current: source.all_prior_subjective_outcomes_exactly_match_current,
    any_subjective_outcome_variation_observed: source.any_subjective_outcome_variation_observed,
    missing_outcome_field_evidence_present: hasMissingComparisonEvidence(source),
    prior_comparisons: source.prior_comparisons.map((comparison) => ({
      comparison_ref: comparison.comparison_ref,
      comparison_hash: comparison.comparison_hash,
      current_turn_id: comparison.current_turn_id,
      current_phase81q_evidence_ref: comparison.current_phase81q_evidence_ref,
      prior_turn_id: comparison.prior_turn_id,
      prior_phase81q_evidence_ref: comparison.prior_phase81q_evidence_ref,
      field_comparisons: cloneJson(comparison.field_comparisons),
      exact_subjective_outcome_match: comparison.exact_subjective_outcome_match,
      subjective_outcome_variation_observed: comparison.subjective_outcome_variation_observed,
    })),
  }));
  const view = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
    phase: "Phase82C",
    ...lineage,
    source_phase82b_projection_hash: phase82b.projection_hash,
    status: contexts.length > 0 ? "bounded_longitudinal_appraisal_ready" : "no_longitudinal_variation_context_to_appraise",
    appraisal_context_count: contexts.length,
    appraisal_contexts: contexts,
    supported_appraisal_kinds: [...longitudinalReuseOutcomeAppraisalKinds],
    supported_learning_orientations: [...longitudinalReuseOutcomeLearningOrientations],
    response_contract: {
      output_shape: "array_of_context_ref_appraisal_orientation_and_salient_comparison_refs",
      required_fields: ["comparison_context_ref", "appraisal_kind", "learning_orientation", "salient_comparison_refs"],
      salient_comparison_refs_must_be_subset_of_phase82b_context: true,
      recurrence_may_not_be_called_effectiveness_or_success: true,
      variation_may_not_be_called_failure: true,
      numeric_score_probability_reward_q_value_authoring_allowed: false,
      revise_retain_rule_belief_semantic_memory_world_authoring_allowed: false,
    },
    boundaries: {
      source_phase82b_only: true,
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

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion
      || view.phase !== "Phase82C"
      || !text(view.world_simulation_session_id)
      || !text(view.turn_id)
      || !Number.isSafeInteger(view.state_revision)
      || view.state_revision < 0
      || !text(view.world_state_hash)
      || !text(view.source_phase82b_projection_hash)
      || !Array.isArray(view.appraisal_contexts)
      || view.appraisal_context_count !== view.appraisal_contexts.length
      || view.appraisal_context_count > maximumContextCount
      || !text(view.resolver_view_hash)
      || hashWithout(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_VIEW_INVALID", "Phase82C requires an exact bounded appraisal resolver view.");
  }
  return Object.freeze(view);
}

const allowedDecisionFields = new Set([
  "comparison_context_ref", "appraisal_kind", "learning_orientation", "salient_comparison_refs",
]);
const forbiddenDecisionFields = new Set([
  "effectiveness", "effectiveness_score", "success", "failure", "success_rate", "failure_rate",
  "probability", "confidence", "utility", "reward", "q_value", "causal_credit", "outcome_credit",
  "revise", "retain", "rule", "preference", "belief_revision", "semantic_revision", "memory_revision",
  "world_state", "world_truth", "selected_action",
]);

function normalizeDecision(raw, view, index) {
  if (!isObject(raw)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_DECISION_INVALID", `Phase82C decision ${index} must be an object.`);
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_AUTHORITY_FIELD_FORBIDDEN", `Phase82C resolver may not author authority field(s): ${forbidden.join(", ")}.`);
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_DECISION_FIELD_FORBIDDEN", `Phase82C decision contains unsupported field(s): ${unknown.join(", ")}.`);
  const contextRef = requiredText(raw.comparison_context_ref, `decisions[${index}].comparison_context_ref`, 180);
  const appraisalKind = requiredText(raw.appraisal_kind, `decisions[${index}].appraisal_kind`, 120);
  const learningOrientation = requiredText(raw.learning_orientation, `decisions[${index}].learning_orientation`, 120);
  if (!longitudinalReuseOutcomeAppraisalKinds.includes(appraisalKind)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_KIND_INVALID", `Unsupported Phase82C appraisal kind ${appraisalKind}.`);
  if (!longitudinalReuseOutcomeLearningOrientations.includes(learningOrientation)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_ORIENTATION_INVALID", `Unsupported Phase82C learning orientation ${learningOrientation}.`);
  const context = view.appraisal_contexts.find((item) => item.comparison_context_ref === contextRef);
  if (!context) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_CONTEXT_OUT_OF_VIEW", `Phase82C decision references context outside resolver view: ${contextRef}.`);
  if (!Array.isArray(raw.salient_comparison_refs)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_DECISION_INVALID", `Phase82C decision ${index} requires salient_comparison_refs.`);
  const refs = raw.salient_comparison_refs.map((value, refIndex) => requiredText(value, `decisions[${index}].salient_comparison_refs[${refIndex}]`, 180));
  if (refs.length > maximumSalientComparisonRefs || new Set(refs).size !== refs.length) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_REFS_INVALID", "Phase82C salient comparison refs must be unique and bounded.");
  const visible = new Map(context.prior_comparisons.map((item) => [item.comparison_ref, item]));
  for (const ref of refs) if (!visible.has(ref)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_REF_OUT_OF_VIEW", `Phase82C comparison ref is outside its exact Phase82B context: ${ref}.`);
  if (refs.length === 0) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_SUPPORT_REQUIRED", "Phase82C appraisal requires at least one exact Phase82B comparison ref.");
  const salientComparisons = refs.map((ref) => visible.get(ref));

  if (appraisalKind === "recurrent_pattern_candidate") {
    if (!context.all_prior_subjective_outcomes_exactly_match_current || context.missing_outcome_field_evidence_present) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PATTERN_MISMATCH", "Phase82C recurrent pattern candidate requires complete exact subjective-outcome recurrence evidence.");
    if (!["preserve_as_future_case_evidence", "defer_revise_retain"].includes(learningOrientation)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_ORIENTATION_MISMATCH", "Phase82C recurrent pattern candidate may only be preserved as future case evidence or defer revise/retain.");
  } else if (appraisalKind === "context_sensitive_pattern_candidate") {
    if (!context.any_subjective_outcome_variation_observed || context.missing_outcome_field_evidence_present) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PATTERN_MISMATCH", "Phase82C context-sensitive pattern candidate requires complete observed variation evidence.");
    if (!salientComparisons.some((comparison) => comparison?.subjective_outcome_variation_observed === true)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_SUPPORT_REQUIRED", "Phase82C context-sensitive pattern candidate must cite at least one exact Phase82B comparison that contains observed variation.");
    if (!["seek_discriminating_context", "defer_revise_retain"].includes(learningOrientation)) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_ORIENTATION_MISMATCH", "Phase82C context-sensitive pattern candidate may only seek discriminating context or defer revise/retain.");
  } else {
    if (learningOrientation !== "defer_revise_retain") fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_ORIENTATION_MISMATCH", "Phase82C uncertain pattern must defer revise/retain.");
  }
  return { context, comparison_context_ref: contextRef, appraisal_kind: appraisalKind, learning_orientation: learningOrientation, salient_comparison_refs: [...refs].sort(compareText) };
}

export function projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal(input = {}) {
  const view = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(input.resolver_view);
  const rebuilt = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(input);
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_VIEW_STALE", "Phase82C resolver view no longer matches exact canonical Phase82B sources.");
  const rawDecisions = array(input.appraisal_decisions);
  if (rawDecisions.length > view.appraisal_context_count) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_DECISION_LIMIT", "Phase82C accepts at most one appraisal decision per visible Phase82B context.");
  const normalized = rawDecisions.map((raw, index) => normalizeDecision(raw, view, index));
  const contextRefs = normalized.map((item) => item.comparison_context_ref);
  if (new Set(contextRefs).size !== contextRefs.length) fail("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_DECISION_DUPLICATE", "Phase82C accepts at most one appraisal per Phase82B context.");
  const appraisals = normalized.map((decision) => {
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
      world_simulation_session_id: view.world_simulation_session_id,
      turn_id: view.turn_id,
      state_revision: view.state_revision,
      world_state_hash: view.world_state_hash,
      character: decision.context.character,
      source_phase82b_projection_hash: view.source_phase82b_projection_hash,
      source_phase82b_context_ref: decision.context.comparison_context_ref,
      source_phase82b_context_hash: decision.context.comparison_context_hash,
      source_phase82a_context_ref: decision.context.source_phase82a_context_ref,
      source_phase81m_capsule_ref: decision.context.source_phase81m_capsule_ref,
      reuse_intent_ref: decision.context.reuse_intent_ref,
      appraisal_kind: decision.appraisal_kind,
      learning_orientation: decision.learning_orientation,
      salient_comparison_refs: decision.salient_comparison_refs,
    };
    const appraisalHash = hashAgentRunValue(identity);
    return {
      appraisal_ref: `phase82c_appraisal_${appraisalHash.slice(0, 24)}`,
      appraisal_hash: appraisalHash,
      ...identity,
      appraisal_is_bounded_subjective_interpretation: true,
      source_distinct_subjective_outcomes_preserved: true,
      recurrence_is_effectiveness_claim: false,
      variation_is_failure_claim: false,
      numeric_effectiveness_or_success_rate_assigned: false,
      reward_or_q_value_assigned: false,
      causal_or_outcome_credit_assigned: false,
      revise_or_retain_performed: false,
      rule_promoted: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    };
  });
  appraisals.sort((left, right) => compareText(left.appraisal_ref, right.appraisal_ref));
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
    phase: "Phase82C",
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
    source_phase82b_projection_hash: view.source_phase82b_projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    appraisal_count: appraisals.length,
    appraisals,
    audit: {
      exact_phase82b_source_reconstructed: true,
      exact_phase82b_comparison_refs_verified: true,
      source_distinct_subjective_outcomes_preserved: true,
      numeric_effectiveness_or_success_rate_modeled: false,
      reward_or_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      automatic_revise_or_retain_performed: false,
      automatic_rule_promotion_performed: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_action_selection_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_appraisal: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      revise_retain_decision_deferred_to_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}
