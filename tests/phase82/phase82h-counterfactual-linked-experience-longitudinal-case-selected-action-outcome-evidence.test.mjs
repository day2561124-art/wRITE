import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationPostOutcomeSubjectivePerceptionVersion } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-revise-retain-admission-service.mjs";
import { projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry } from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-reentry-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-deliberative-reuse-service.mjs";
import { buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage } from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-selected-action-lineage-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceContract,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-selected-action-outcome-evidence-service.mjs";
import {
  buildPhase82CommittedReuseTurn,
  buildPhase82LongitudinalScenario,
  buildPhase82ReuseTurn,
} from "./phase82-longitudinal-fixture.mjs";

const clone = (value) => structuredClone(value);

function buildPhase82C(scenario) {
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(scenario.canonicalInput);
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...scenario.canonicalInput,
    resolver_view: view,
    appraisal_decisions: [{
      comparison_context_ref: view.appraisal_contexts[0].comparison_context_ref,
      appraisal_kind: "recurrent_pattern_candidate",
      learning_orientation: "preserve_as_future_case_evidence",
      salient_comparison_refs: [view.appraisal_contexts[0].prior_comparisons[0].comparison_ref],
    }],
  });
}
function buildPhase82D(scenario, phase82c) {
  const input = { ...scenario.canonicalInput, longitudinal_reuse_outcome_appraisal: phase82c };
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input);
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...input,
    resolver_view: view,
    admission_decisions: [{ appraisal_ref: view.candidates[0].appraisal_ref, decision: "retain_longitudinal_case_evidence" }],
  });
}
function sourceTurn(scenario, phase82c, phase82d) {
  return {
    ...buildPhase82CommittedReuseTurn(scenario.turnId, scenario.revision, scenario.worldStateHash, scenario.current),
    counterfactual_linked_experience_longitudinal_reuse_outcome_evidence: clone(scenario.phase82a),
    counterfactual_linked_experience_longitudinal_reuse_outcome_variation: clone(scenario.phase82b),
    counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal: clone(phase82c),
    counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission: clone(phase82d),
  };
}
function canonicalSource() {
  const scenario = buildPhase82LongitudinalScenario({ mode: "exact" });
  const phase82c = buildPhase82C(scenario);
  const phase82d = buildPhase82D(scenario, phase82c);
  const history = clone(scenario.history);
  history.turns.push(sourceTurn(scenario, phase82c, phase82d));
  const future = buildPhase82ReuseTurn(history, {
    turnId: "turn_phase82h_future",
    revision: 151,
    worldStateHash: "world_state_hash_phase82h_future",
    result: "reached_cover",
    status: "stable",
  });
  const phase82eInput = {
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    current_turn_id: future.phase81N.current_turn_id,
    current_state_revision: future.phase81N.current_state_revision,
    current_world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
  };
  const phase82e = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(phase82eInput);
  const character = phase82e.reentry_candidates[0].character;
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
    character,
    source_phase82e_projection: phase82e,
    expected_source: phase82eInput,
  });
  const phase82f = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
    character,
    source_phase82e_projection: phase82e,
    expected_source: phase82eInput,
    resolver_view: view,
    activated_longitudinal_case_refs: [view.longitudinal_case_candidates[0].reentry_candidate_ref],
  });
  const phase82g = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage({
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    turn_id: future.phase81N.current_turn_id,
    state_revision: future.phase81N.current_state_revision,
    world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_longitudinal_case_reentry: phase82e,
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [phase82f],
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
    subjective_choice_commitment_receipts: future.choices,
  });
  return { history, future, phase82e, phase82f, phase82g };
}
function phase76A(turnId, character, actionId, experience = {}) {
  const bounded = {
    action_id: actionId,
    performed: true,
    perceived_result: "reached_cover",
    perceived_status: "stable",
    ...experience,
  };
  const identity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: turnId,
    character,
    action_id: actionId,
    experience: bounded,
    source_outcome_hashes: ["phase82h_outcome_hash"],
    source_transition_hashes: ["phase82h_transition_hash"],
  };
  const record = {
    subjective_perception_ref: `phase76a_post_outcome_${hashAgentRunValue(identity).slice(0, 24)}`,
    ...identity,
    source_outcome_count: 1,
    source_transition_count: 1,
    objective_result_label_exposed: false,
    causal_evidence_exposed: false,
    exact_engine_geometry_exposed: false,
    other_character_private_state_exposed: false,
    raw_result_interpreted_as_perceived_success_or_failure: false,
  };
  const projection = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    phase: "Phase76A",
    status: "bounded_post_outcome_subjective_perception_available",
    turn_id: turnId,
    character_experiences: [record],
    boundaries: {
      objective_world_outcome_remains_causal_authority: true,
      projection_is_subjective_observation_not_world_truth: true,
      selected_action_is_not_success_claim: true,
      action_outcome_presence_is_not_success_claim: true,
      own_action_transition_is_not_goal_achievement: true,
      result_label_auto_exposure: false,
      causal_evidence_auto_exposure: false,
      exact_engine_geometry_auto_exposure: false,
      other_character_private_state_auto_exposure: false,
      explicit_actor_experience_may_be_preserved: true,
      world_state_mutation_applied: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}
function inputFor(c, subjective) {
  return {
    world_simulation_session_id: c.future.phase81N.world_simulation_session_id,
    turn_id: c.future.phase81N.current_turn_id,
    state_revision: c.future.phase81N.current_state_revision,
    world_state_hash: c.future.phase81N.current_world_state_hash,
    world_history: c.history,
    counterfactual_linked_experience_longitudinal_case_selected_action_lineage: c.phase82g,
    subjective_choice_commitment_receipts: c.future.choices,
    counterfactual_linked_experience_longitudinal_case_reentry: c.phase82e,
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [c.phase82f],
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [c.future.phase81N],
    post_outcome_subjective_perception_projection: subjective,
  };
}
function rehashRecord(record) {
  const identity = clone(record);
  for (const key of [
    "evidence_ref", "evidence_hash", "selected_action_subjective_outcome_observed",
    "retained_longitudinal_case_is_current_world_truth", "retained_admission_is_effectiveness_claim",
    "retained_admission_is_success_claim", "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome", "longitudinal_case_activation_caused_selection_claimed",
    "longitudinal_case_effectiveness_inferred", "success_failure_interpretation_performed",
    "causal_or_outcome_credit_assigned", "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  record.evidence_hash = hash;
  record.evidence_ref = `phase82h_outcome_evidence_${hash.slice(0, 24)}`;
}
function rehashProjection(projection) {
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase82H");
assert.equal(contract.source_selected_action_lineage_owner, "Phase82G");
assert.equal(contract.source_subjective_outcome_owner, "Phase76A");
assert.equal(contract.longitudinal_case_effectiveness_inferred, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);

const c = canonicalSource();
assert.equal(c.phase82g.receipt_count, 1);
const lineage = c.phase82g.receipts[0];
const subjective = phase76A(c.future.phase81N.current_turn_id, lineage.character, lineage.action_id);
const input = inputFor(c, subjective);
const evidence = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(input);
assert.equal(evidence.version, worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion);
assert.equal(evidence.phase, "Phase82H");
assert.equal(evidence.evidence_count, 1);
assert.equal(evidence.evidence_records[0].phase82g_receipt_id, lineage.receipt_id);
assert.equal(evidence.evidence_records[0].action_id, lineage.action_id);
assert.equal(evidence.evidence_records[0].selected_action_subjective_outcome_observed, true);
assert.equal(evidence.evidence_records[0].longitudinal_case_effectiveness_inferred, false);
assert.equal(evidence.evidence_records[0].success_failure_interpretation_performed, false);
assert.equal(evidence.evidence_records[0].causal_or_outcome_credit_assigned, false);
assert.doesNotThrow(() => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(evidence, input));

const noMatch = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(
  inputFor(c, phase76A(c.future.phase81N.current_turn_id, lineage.character, "different_action")),
);
assert.equal(noMatch.evidence_count, 0);

const forged = clone(evidence);
forged.evidence_records[0].action_ref = "forged_action_ref";
rehashRecord(forged.evidence_records[0]);
rehashProjection(forged);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(forged, input),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const forgedExperience = clone(evidence);
forgedExperience.evidence_records[0].selected_action_subjective_experience.perceived_result = "invented_result";
rehashRecord(forgedExperience.evidence_records[0]);
rehashProjection(forgedExperience);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(forgedExperience, input),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence/);
assert.match(loopSource, /counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence\)/);
assert.match(stateSource, /counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence \?\? null/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82H",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion,
  exact_phase82g_lineage_required: true,
  exact_phase82e_82f_74d_81n_history_revalidation_required: true,
  exact_phase76a_subjective_outcome_required: true,
  nonmatching_subjective_outcome_produces_evidence: false,
  rehashed_phase82h_lineage_forgery_rejected: true,
  rehashed_phase82h_subjective_outcome_forgery_rejected: true,
  effectiveness_success_inferred: false,
  causal_or_outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82H longitudinal case selected-action subjective outcome evidence tests passed.");
