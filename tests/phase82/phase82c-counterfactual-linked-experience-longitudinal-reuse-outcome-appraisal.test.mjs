import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalContract,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-service.mjs";
import { buildPhase82LongitudinalScenario } from "./phase82-longitudinal-fixture.mjs";

const clone = (value) => structuredClone(value);
const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalContract();
assert.equal(contract.phase, "Phase82C");
assert.equal(contract.source_owner, "Phase82B");
assert.equal(contract.appraisal_owner, "CharacterBrain");
assert.equal(contract.numeric_effectiveness_or_success_rate_modeled, false);
assert.equal(contract.reward_or_q_value_modeled, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.automatic_revise_or_retain_performed, false);
assert.equal(contract.revise_retain_decision_deferred_to_separate_phase, true);

const exact = buildPhase82LongitudinalScenario({ mode: "exact" });
const exactView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(exact.canonicalInput);
assert.equal(exactView.version, worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion);
assert.equal(exactView.appraisal_context_count, 1);
assert.equal(exactView.appraisal_contexts[0].all_prior_subjective_outcomes_exactly_match_current, true);
const exactRef = exactView.appraisal_contexts[0].prior_comparisons[0].comparison_ref;
const exactProjection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
  ...exact.canonicalInput,
  resolver_view: exactView,
  appraisal_decisions: [{
    comparison_context_ref: exactView.appraisal_contexts[0].comparison_context_ref,
    appraisal_kind: "recurrent_pattern_candidate",
    learning_orientation: "preserve_as_future_case_evidence",
    salient_comparison_refs: [exactRef],
  }],
});
assert.equal(exactProjection.appraisal_count, 1);
assert.equal(exactProjection.appraisals[0].appraisal_kind, "recurrent_pattern_candidate");
assert.equal(exactProjection.appraisals[0].recurrence_is_effectiveness_claim, false);
assert.equal(exactProjection.appraisals[0].numeric_effectiveness_or_success_rate_assigned, false);
assert.equal(exactProjection.appraisals[0].revise_or_retain_performed, false);
assert.equal(exactProjection.appraisals[0].world_truth_authority, false);

const variation = buildPhase82LongitudinalScenario({ mode: "variation" });
const variationView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(variation.canonicalInput);
assert.equal(variationView.appraisal_context_count, 1);
assert.equal(variationView.appraisal_contexts[0].any_subjective_outcome_variation_observed, true);
const variationComparison = variationView.appraisal_contexts[0].prior_comparisons[0];
assert.equal(variationComparison.subjective_outcome_variation_observed, true);
const variationRef = variationComparison.comparison_ref;
const variationProjection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
  ...variation.canonicalInput,
  resolver_view: variationView,
  appraisal_decisions: [{
    comparison_context_ref: variationView.appraisal_contexts[0].comparison_context_ref,
    appraisal_kind: "context_sensitive_pattern_candidate",
    learning_orientation: "seek_discriminating_context",
    salient_comparison_refs: [variationRef],
  }],
});
assert.equal(variationProjection.appraisal_count, 1);
assert.equal(variationProjection.appraisals[0].variation_is_failure_claim, false);
assert.equal(variationProjection.appraisals[0].causal_or_outcome_credit_assigned, false);
assert.equal(variationProjection.persistence_boundary.revise_retain_decision_deferred_to_separate_phase, true);

const incomplete = buildPhase82LongitudinalScenario({ mode: "variation", includeStatus: false });
const incompleteView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(incomplete.canonicalInput);
assert.equal(incompleteView.appraisal_contexts[0].missing_outcome_field_evidence_present, true);
assert.equal(
  incompleteView.appraisal_contexts[0].prior_comparisons[0].field_comparisons
    .find((item) => item.field === "perceived_status")?.relation,
  "missing_both",
);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...incomplete.canonicalInput,
    resolver_view: incompleteView,
    appraisal_decisions: [{
      comparison_context_ref: incompleteView.appraisal_contexts[0].comparison_context_ref,
      appraisal_kind: "context_sensitive_pattern_candidate",
      learning_orientation: "seek_discriminating_context",
      salient_comparison_refs: [incompleteView.appraisal_contexts[0].prior_comparisons[0].comparison_ref],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PATTERN_MISMATCH",
);
const uncertainProjection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
  ...incomplete.canonicalInput,
  resolver_view: incompleteView,
  appraisal_decisions: [{
    comparison_context_ref: incompleteView.appraisal_contexts[0].comparison_context_ref,
    appraisal_kind: "pattern_uncertain",
    learning_orientation: "defer_revise_retain",
    salient_comparison_refs: [incompleteView.appraisal_contexts[0].prior_comparisons[0].comparison_ref],
  }],
});
assert.equal(uncertainProjection.appraisals[0].appraisal_kind, "pattern_uncertain");

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...variation.canonicalInput,
    resolver_view: variationView,
    appraisal_decisions: [{
      comparison_context_ref: variationView.appraisal_contexts[0].comparison_context_ref,
      appraisal_kind: "context_sensitive_pattern_candidate",
      learning_orientation: "seek_discriminating_context",
      salient_comparison_refs: [variationRef],
      success_rate: 1,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_AUTHORITY_FIELD_FORBIDDEN",
);

// Rehashing a forged Phase82B projection cannot cross the Phase82C source boundary.
const forgedInput = clone(variation.canonicalInput);
forgedInput.longitudinal_reuse_outcome_variation.comparison_contexts[0].prior_comparisons[0]
  .subjective_outcome_variation_observed = false;
const comparison = forgedInput.longitudinal_reuse_outcome_variation.comparison_contexts[0].prior_comparisons[0];
const comparisonIdentity = clone(comparison);
for (const key of ["comparison_ref", "comparison_hash", "comparable_field_count", "exact_match_field_count", "differing_or_missing_field_count", "exact_subjective_outcome_match", "subjective_outcome_variation_observed", "effectiveness_interpretation_performed", "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned"]) delete comparisonIdentity[key];
comparison.comparison_hash = hashAgentRunValue(comparisonIdentity);
comparison.comparison_ref = `phase82b_variation_${comparison.comparison_hash.slice(0, 24)}`;
delete forgedInput.longitudinal_reuse_outcome_variation.projection_hash;
forgedInput.longitudinal_reuse_outcome_variation.projection_hash = hashAgentRunValue(forgedInput.longitudinal_reuse_outcome_variation);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(forgedInput),
  (error) => String(error?.code ?? "").startsWith("WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_")
    || error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_APPRAISAL_PHASE82B_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const bIndex = loopSource.indexOf("const counterfactualLinkedExperienceLongitudinalReuseOutcomeVariation =");
const cIndex = loopSource.indexOf("const counterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView =");
assert.ok(bIndex >= 0 && cIndex > bIndex);
assert.match(loopSource, /counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal\)/);
assert.match(stateSource, /counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal \?\? null/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82C",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
  character_brain_owned_appraisal: true,
  canonical_phase82b_reconstruction_required: true,
  recurrent_pattern_candidate_supported: true,
  context_sensitive_pattern_candidate_supported: true,
  incomplete_evidence_forces_uncertainty: true,
  authority_fields_rejected: true,
  numeric_effectiveness_or_success_rate_modeled: false,
  causal_or_outcome_credit_assigned: false,
  revise_retain_deferred: true,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82C longitudinal reuse-outcome qualitative appraisal tests passed.");
