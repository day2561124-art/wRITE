import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionContract,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-revise-retain-admission-service.mjs";
import { buildPhase82LongitudinalScenario } from "./phase82-longitudinal-fixture.mjs";

const clone = (value) => structuredClone(value);

function buildPhase82C(scenario, appraisalKind, learningOrientation) {
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(
    scenario.canonicalInput,
  );
  const comparisonRef = view.appraisal_contexts[0].prior_comparisons[0].comparison_ref;
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...scenario.canonicalInput,
    resolver_view: view,
    appraisal_decisions: [{
      comparison_context_ref: view.appraisal_contexts[0].comparison_context_ref,
      appraisal_kind: appraisalKind,
      learning_orientation: learningOrientation,
      salient_comparison_refs: [comparisonRef],
    }],
  });
}

function phase82DInput(scenario, phase82c) {
  return {
    ...scenario.canonicalInput,
    longitudinal_reuse_outcome_appraisal: phase82c,
  };
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionContract();
assert.equal(contract.phase, "Phase82D");
assert.equal(contract.source_owner, "Phase82C");
assert.equal(contract.admission_owner, "CharacterBrain");
assert.equal(contract.canonical_phase82c_reconstruction_required, true);
assert.equal(contract.recurrence_may_admit_future_case_evidence_only, true);
assert.equal(contract.contextual_variation_may_request_discriminating_context_only, true);
assert.equal(contract.uncertain_pattern_must_defer, true);
assert.equal(contract.numeric_effectiveness_or_success_rate_modeled, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.semantic_revision_performed, false);
assert.equal(contract.future_reentry_requires_separate_phase, true);

const exact = buildPhase82LongitudinalScenario({ mode: "exact" });
const exactC = buildPhase82C(exact, "recurrent_pattern_candidate", "preserve_as_future_case_evidence");
const exactInput = phase82DInput(exact, exactC);
const exactView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(exactInput);
assert.equal(exactView.version, worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion);
assert.equal(exactView.candidate_count, 1);
assert.deepEqual(exactView.candidates[0].allowed_admission_decisions, [
  "retain_longitudinal_case_evidence",
  "defer",
]);
const retained = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
  ...exactInput,
  resolver_view: exactView,
  admission_decisions: [{
    appraisal_ref: exactView.candidates[0].appraisal_ref,
    decision: "retain_longitudinal_case_evidence",
  }],
});
assert.equal(retained.admission_count, 1);
assert.equal(retained.admissions[0].admitted_for_future_longitudinal_case_reentry, true);
assert.equal(retained.admissions[0].discriminating_context_evidence_requested, false);
assert.equal(retained.admissions[0].recurrence_is_effectiveness_claim, false);
assert.equal(retained.admissions[0].numeric_effectiveness_or_success_rate_assigned, false);
assert.equal(retained.admissions[0].causal_or_outcome_credit_assigned, false);
assert.equal(retained.admissions[0].semantic_revision_performed, false);
assert.equal(retained.admissions[0].world_truth_authority, false);

const variation = buildPhase82LongitudinalScenario({ mode: "variation" });
const variationC = buildPhase82C(
  variation,
  "context_sensitive_pattern_candidate",
  "seek_discriminating_context",
);
const variationInput = phase82DInput(variation, variationC);
const variationView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(variationInput);
assert.deepEqual(variationView.candidates[0].allowed_admission_decisions, [
  "request_discriminating_context_evidence",
  "defer",
]);
const discriminating = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
  ...variationInput,
  resolver_view: variationView,
  admission_decisions: [{
    appraisal_ref: variationView.candidates[0].appraisal_ref,
    decision: "request_discriminating_context_evidence",
  }],
});
assert.equal(discriminating.admissions[0].discriminating_context_evidence_requested, true);
assert.equal(discriminating.admissions[0].variation_is_failure_claim, false);

const incomplete = buildPhase82LongitudinalScenario({ mode: "variation", includeStatus: false });
const incompleteC = buildPhase82C(incomplete, "pattern_uncertain", "defer_revise_retain");
const incompleteInput = phase82DInput(incomplete, incompleteC);
const incompleteView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(incompleteInput);
assert.deepEqual(incompleteView.candidates[0].allowed_admission_decisions, ["defer"]);
const deferred = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
  ...incompleteInput,
  resolver_view: incompleteView,
  admission_decisions: [{
    appraisal_ref: incompleteView.candidates[0].appraisal_ref,
    decision: "defer",
  }],
});
assert.equal(deferred.admissions[0].revise_retain_deferred, true);

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...variationInput,
    resolver_view: variationView,
    admission_decisions: [{
      appraisal_ref: variationView.candidates[0].appraisal_ref,
      decision: "retain_longitudinal_case_evidence",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_DECISION_INCOMPATIBLE",
);

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...exactInput,
    resolver_view: exactView,
    admission_decisions: [{
      appraisal_ref: exactView.candidates[0].appraisal_ref,
      decision: "retain_longitudinal_case_evidence",
      success_rate: 1,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_AUTHORITY_FIELD_FORBIDDEN",
);

// A locally rehashed Phase82C forgery cannot cross the Phase82D admission boundary.
const forgedInput = clone(exactInput);
forgedInput.longitudinal_reuse_outcome_appraisal.appraisals[0].learning_orientation =
  "defer_revise_retain";
delete forgedInput.longitudinal_reuse_outcome_appraisal.projection_hash;
forgedInput.longitudinal_reuse_outcome_appraisal.projection_hash =
  hashAgentRunValue(forgedInput.longitudinal_reuse_outcome_appraisal);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(forgedInput),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_ADMISSION_PHASE82C_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const cIndex = loopSource.indexOf(
  "const counterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView =",
);
const dIndex = loopSource.indexOf(
  "const counterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView =",
);
assert.ok(cIndex >= 0 && dIndex > cIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82D",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
  canonical_phase82c_reconstruction_required: true,
  recurrent_pattern_future_case_retention_supported: true,
  context_sensitive_discriminating_context_request_supported: true,
  uncertain_pattern_forced_to_defer: true,
  incompatible_admission_rejected: true,
  authority_fields_rejected: true,
  rehashed_phase82c_forgery_rejected: true,
  numeric_effectiveness_or_success_rate_modeled: false,
  causal_or_outcome_credit_assigned: false,
  belief_semantic_memory_world_mutation_performed: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82D longitudinal reuse-outcome revise/retain admission tests passed.");
