import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
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
import { buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence } from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-selected-action-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidenceContract,
  worldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-retained-longitudinal-case-outcome-evidence-service.mjs";
import {
  buildPhase82CommittedReuseTurn,
  buildPhase82LongitudinalScenario,
  buildPhase82ReuseTurn,
} from "./phase82-longitudinal-fixture.mjs";

const clone = (value) => structuredClone(value);

function buildPhase82C(scenario) {
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalResolverView(
    scenario.canonicalInput,
  );
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
  const input = {
    ...scenario.canonicalInput,
    longitudinal_reuse_outcome_appraisal: phase82c,
  };
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(
    input,
  );
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...input,
    resolver_view: view,
    admission_decisions: [{
      appraisal_ref: view.candidates[0].appraisal_ref,
      decision: "retain_longitudinal_case_evidence",
    }],
  });
}

function retainedSourceHistory() {
  const scenario = buildPhase82LongitudinalScenario({ mode: "exact" });
  const phase82c = buildPhase82C(scenario);
  const phase82d = buildPhase82D(scenario, phase82c);
  const sourceTurn = {
    ...buildPhase82CommittedReuseTurn(
      scenario.turnId,
      scenario.revision,
      scenario.worldStateHash,
      scenario.current,
    ),
    counterfactual_linked_experience_longitudinal_reuse_outcome_evidence: clone(scenario.phase82a),
    counterfactual_linked_experience_longitudinal_reuse_outcome_variation: clone(scenario.phase82b),
    counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal: clone(phase82c),
    counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission: clone(phase82d),
  };
  const history = clone(scenario.history);
  history.turns.push(sourceTurn);
  return history;
}

function retainedUse(history, { turnId, revision, worldStateHash, result, status }) {
  const future = buildPhase82ReuseTurn(history, {
    turnId,
    revision,
    worldStateHash,
    result,
    status,
  });
  const phase82eInput = {
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    current_turn_id: future.phase81N.current_turn_id,
    current_state_revision: future.phase81N.current_state_revision,
    current_world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
  };
  const phase82e = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(
    phase82eInput,
  );
  assert.equal(phase82e.reentry_candidate_count, 1);
  const character = phase82e.reentry_candidates[0].character;
  const phase82fView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
    character,
    source_phase82e_projection: phase82e,
    expected_source: phase82eInput,
  });
  const phase82f = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
    character,
    source_phase82e_projection: phase82e,
    expected_source: phase82eInput,
    resolver_view: phase82fView,
    activated_longitudinal_case_refs: [
      phase82fView.longitudinal_case_candidates[0].reentry_candidate_ref,
    ],
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
  const phase82h = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence({
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    turn_id: future.phase81N.current_turn_id,
    state_revision: future.phase81N.current_state_revision,
    world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_longitudinal_case_selected_action_lineage: phase82g,
    subjective_choice_commitment_receipts: future.choices,
    counterfactual_linked_experience_longitudinal_case_reentry: phase82e,
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [phase82f],
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
    post_outcome_subjective_perception_projection: future.outcome,
  });
  return { future, phase82e, phase82f, phase82g, phase82h };
}

function committedRetainedUse(turnId, revision, worldStateHash, built) {
  return {
    ...buildPhase82CommittedReuseTurn(turnId, revision, worldStateHash, built.future),
    counterfactual_linked_experience_longitudinal_case_reentry: clone(built.phase82e),
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [
      clone(built.phase82f),
    ],
    counterfactual_linked_experience_longitudinal_case_selected_action_lineage:
      clone(built.phase82g),
    counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence:
      clone(built.phase82h),
  };
}

function phase82iInput(history, built) {
  return {
    world_simulation_session_id: built.future.phase81N.world_simulation_session_id,
    turn_id: built.future.phase81N.current_turn_id,
    state_revision: built.future.phase81N.current_state_revision,
    world_state_hash: built.future.phase81N.current_world_state_hash,
    world_history: history,
    current_phase82h_outcome_evidence: built.phase82h,
    counterfactual_linked_experience_longitudinal_case_selected_action_lineage: built.phase82g,
    subjective_choice_commitment_receipts: built.future.choices,
    counterfactual_linked_experience_longitudinal_case_reentry: built.phase82e,
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [
      built.phase82f,
    ],
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [
      built.future.phase81N,
    ],
    post_outcome_subjective_perception_projection: built.future.outcome,
  };
}

function rehashPhase82HRecord(record) {
  const identity = clone(record);
  for (const key of [
    "evidence_ref",
    "evidence_hash",
    "selected_action_subjective_outcome_observed",
    "retained_longitudinal_case_is_current_world_truth",
    "retained_admission_is_effectiveness_claim",
    "retained_admission_is_success_claim",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome",
    "longitudinal_case_activation_caused_selection_claimed",
    "longitudinal_case_effectiveness_inferred",
    "success_failure_interpretation_performed",
    "causal_or_outcome_credit_assigned",
    "preference_revision_performed",
    "belief_revision_performed",
    "semantic_revision_performed",
    "subjective_memory_rewrite_performed",
    "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  record.evidence_hash = hash;
  record.evidence_ref = `phase82h_outcome_evidence_${hash.slice(0, 24)}`;
}
function rehashProjection(projection) {
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase82I");
assert.equal(contract.source_current_outcome_owner, "Phase82H");
assert.equal(contract.source_prior_outcome_owner, "Phase82H committed World History");
assert.equal(contract.same_character_same_phase82d_admission_required, true);
assert.equal(contract.effectiveness_interpretation_performed, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.reward_or_q_value_modeled, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);

const sourceHistory = retainedSourceHistory();
const first = retainedUse(sourceHistory, {
  turnId: "turn_phase82i_retained_use_1",
  revision: 171,
  worldStateHash: "world_state_hash_phase82i_retained_use_1",
  result: "reached_cover",
  status: "stable",
});
const firstProjection = buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence(
  phase82iInput(sourceHistory, first),
);
assert.equal(firstProjection.context_count, 1);
assert.equal(firstProjection.longitudinal_ready_context_count, 0);
assert.equal(firstProjection.character_case_contexts[0].prior_retained_case_outcome_count, 0);

const historyWithFirst = clone(sourceHistory);
historyWithFirst.turns.push(committedRetainedUse(
  first.future.phase81N.current_turn_id,
  first.future.phase81N.current_state_revision,
  first.future.phase81N.current_world_state_hash,
  first,
));
const second = retainedUse(historyWithFirst, {
  turnId: "turn_phase82i_retained_use_2",
  revision: 179,
  worldStateHash: "world_state_hash_phase82i_retained_use_2",
  result: "paused_before_cover",
  status: "uncertain",
});
const secondInput = phase82iInput(historyWithFirst, second);
const projection = buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence(
  secondInput,
);
assert.equal(
  projection.version,
  worldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidenceVersion,
);
assert.equal(projection.phase, "Phase82I");
assert.equal(projection.context_count, 1);
assert.equal(projection.longitudinal_ready_context_count, 1);
const context = projection.character_case_contexts[0];
assert.equal(context.prior_retained_case_outcome_count, 1);
assert.equal(
  context.current_anchor.phase82h_evidence_ref,
  second.phase82h.evidence_records[0].evidence_ref,
);
assert.equal(
  context.prior_retained_case_outcomes[0].phase82h_evidence_ref,
  first.phase82h.evidence_records[0].evidence_ref,
);
assert.equal(
  context.source_phase82d_admission_ref,
  first.phase82h.evidence_records[0].source_phase82d_admission_ref,
);
assert.equal(
  context.current_anchor.selected_action_subjective_experience.perceived_result,
  "paused_before_cover",
);
assert.equal(
  context.prior_retained_case_outcomes[0].selected_action_subjective_experience.perceived_result,
  "reached_cover",
);
assert.equal(context.effectiveness_interpretation_performed, false);
assert.equal(context.success_failure_interpretation_performed, false);
assert.equal(context.causal_or_outcome_credit_assigned, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence(
    projection,
    secondInput,
  ));

const forgedHistory = clone(historyWithFirst);
const forgedPriorH = forgedHistory.turns.at(-1)
  .counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence;
forgedPriorH.evidence_records[0].selected_action_subjective_experience.perceived_result =
  "forged_prior_result";
rehashPhase82HRecord(forgedPriorH.evidence_records[0]);
rehashProjection(forgedPriorH);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence({
    ...secondInput,
    world_history: forgedHistory,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const forgedCurrentInput = clone(secondInput);
forgedCurrentInput.current_phase82h_outcome_evidence.evidence_records[0]
  .selected_action_subjective_experience.perceived_status = "forged_current_status";
rehashPhase82HRecord(
  forgedCurrentInput.current_phase82h_outcome_evidence.evidence_records[0],
);
rehashProjection(forgedCurrentInput.current_phase82h_outcome_evidence);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence(
    forgedCurrentInput,
  ),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  loopSource,
  /buildWorldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence/,
);
assert.match(
  loopSource,
  /counterfactual_linked_experience_retained_longitudinal_case_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_retained_longitudinal_case_outcome_evidence:\s*\r?\n\s*input\.counterfactual_linked_experience_retained_longitudinal_case_outcome_evidence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82I",
  version: worldSimulationCounterfactualLinkedExperienceRetainedLongitudinalCaseOutcomeEvidenceVersion,
  exact_current_phase82h_lineage_required: true,
  exact_prior_phase82h_per_turn_revalidation_required: true,
  same_phase82d_admission_and_root_case_join_required: true,
  same_turn_feedback_blocked_by_committed_history_boundary: true,
  rehashed_prior_phase82h_forgery_rejected: true,
  rehashed_current_phase82h_forgery_rejected: true,
  effectiveness_success_reward_q_modeled: false,
  causal_or_outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82I retained longitudinal case outcome evidence tests passed.");
