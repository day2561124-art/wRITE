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
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryContract,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-reentry-service.mjs";
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
  const comparisonRef = view.appraisal_contexts[0].prior_comparisons[0].comparison_ref;
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisal({
    ...scenario.canonicalInput,
    resolver_view: view,
    appraisal_decisions: [{
      comparison_context_ref: view.appraisal_contexts[0].comparison_context_ref,
      appraisal_kind: "recurrent_pattern_candidate",
      learning_orientation: "preserve_as_future_case_evidence",
      salient_comparison_refs: [comparisonRef],
    }],
  });
}

function buildPhase82D(scenario, phase82c, decision = "retain_longitudinal_case_evidence") {
  const input = {
    ...scenario.canonicalInput,
    longitudinal_reuse_outcome_appraisal: phase82c,
  };
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input);
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...input,
    resolver_view: view,
    admission_decisions: [{ appraisal_ref: view.candidates[0].appraisal_ref, decision }],
  });
}

function committedPhase82SourceTurn(scenario, phase82c, phase82d) {
  return {
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
}

function phase82EInput(history, future) {
  return {
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    current_turn_id: future.phase81N.current_turn_id,
    current_state_revision: future.phase81N.current_state_revision,
    current_world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
  };
}

function rehashPhase82ECandidate(candidate) {
  const identity = {
    version: candidate.version,
    world_simulation_session_id: candidate.world_simulation_session_id,
    current_turn_id: candidate.current_turn_id,
    current_state_revision: candidate.current_state_revision,
    current_world_state_hash: candidate.current_world_state_hash,
    character: candidate.character,
    source_turn_id: candidate.source_turn_id,
    source_revision_to: candidate.source_revision_to,
    source_phase82d_projection_hash: candidate.source_phase82d_projection_hash,
    source_phase82d_admission_ref: candidate.source_phase82d_admission_ref,
    source_phase82d_admission_hash: candidate.source_phase82d_admission_hash,
    source_phase82c_projection_hash: candidate.source_phase82c_projection_hash,
    source_phase82c_appraisal_ref: candidate.source_phase82c_appraisal_ref,
    source_phase82c_appraisal_hash: candidate.source_phase82c_appraisal_hash,
    source_phase82b_context_ref: candidate.source_phase82b_context_ref,
    source_phase82a_context_ref: candidate.source_phase82a_context_ref,
    source_phase81m_capsule_ref: candidate.source_phase81m_capsule_ref,
    reuse_intent_ref: candidate.reuse_intent_ref,
    current_phase81n_projection_hash: candidate.current_phase81n_projection_hash,
    current_phase81n_reentry_candidate_ref: candidate.current_phase81n_reentry_candidate_ref,
    current_phase81n_reentry_candidate_hash: candidate.current_phase81n_reentry_candidate_hash,
    current_action_id: candidate.current_action_id,
    current_action_ref: candidate.current_action_ref,
  };
  const hash = hashAgentRunValue(identity);
  candidate.reentry_candidate_hash = hash;
  candidate.reentry_candidate_ref = `phase82e_longitudinal_case_reentry_${hash.slice(0, 24)}`;
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryContract();
assert.equal(contract.phase, "Phase82E");
assert.equal(contract.source_admission_owner, "Phase82D");
assert.equal(contract.current_relevance_owner, "Phase81N");
assert.equal(contract.prior_committed_turns_only, true);
assert.equal(contract.same_turn_feedback_allowed, false);
assert.equal(contract.retain_admission_required, true);
assert.equal(contract.exact_phase82c_source_appraisal_lineage_required, true);
assert.equal(contract.exact_current_phase81n_projection_required, true);
assert.equal(contract.exact_same_phase81m_capsule_and_reuse_intent_required, true);
assert.equal(contract.fuzzy_similarity_modeled, false);
assert.equal(contract.downstream_deliberative_use_requires_separate_phase, true);

const exact = buildPhase82LongitudinalScenario({ mode: "exact" });
const phase82c = buildPhase82C(exact);
const phase82d = buildPhase82D(exact, phase82c);
assert.equal(phase82d.admissions[0].admission_decision, "retain_longitudinal_case_evidence");

const futureHistory = clone(exact.history);
futureHistory.turns.push(committedPhase82SourceTurn(exact, phase82c, phase82d));
const future = buildPhase82ReuseTurn(futureHistory, {
  turnId: "turn_phase82_fixture_reuse_3",
  revision: 119,
  worldStateHash: "world_state_hash_phase82_fixture_reuse_3",
  result: "reached_cover",
  status: "stable",
});
const input = phase82EInput(futureHistory, future);
const projection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(input);
assert.equal(projection.version, worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion);
assert.equal(projection.reentry_candidate_count, 1);
const candidate = projection.reentry_candidates[0];
assert.equal(candidate.source_turn_id, exact.turnId);
assert.equal(candidate.source_phase82d_admission_ref, phase82d.admissions[0].admission_ref);
assert.equal(candidate.source_phase81m_capsule_ref, future.phase81N.reentry_candidates[0].source_phase81m_capsule_ref);
assert.equal(candidate.reuse_intent_ref, future.phase81N.reentry_candidates[0].reuse_intent_ref);
assert.equal(candidate.current_phase81n_reentry_candidate_ref, future.phase81N.reentry_candidates[0].reentry_candidate_ref);
assert.equal(candidate.current_phase81n_exact_cue_relevance_required, true);
assert.equal(candidate.retained_longitudinal_case_is_candidate_evidence_only, true);
assert.equal(candidate.retained_admission_is_effectiveness_claim, false);
assert.equal(candidate.retained_admission_is_success_claim, false);
assert.equal(candidate.action_selected, false);
assert.equal(candidate.numeric_effectiveness_or_success_rate_assigned, false);
assert.equal(candidate.causal_or_outcome_credit_assigned, false);
assert.equal(candidate.semantic_revision_performed, false);
assert.equal(candidate.world_truth_authority, false);

// A Phase82D defer decision does not become future re-entry evidence.
const deferredPhase82D = buildPhase82D(exact, phase82c, "defer");
const deferHistory = clone(exact.history);
deferHistory.turns.push(committedPhase82SourceTurn(exact, phase82c, deferredPhase82D));
const deferFuture = buildPhase82ReuseTurn(deferHistory, {
  turnId: "turn_phase82_fixture_reuse_defer_future",
  revision: 121,
  worldStateHash: "world_state_hash_phase82_fixture_reuse_defer_future",
  result: "reached_cover",
  status: "stable",
});
const deferredReentry = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(
  phase82EInput(deferHistory, deferFuture),
);
assert.equal(deferredReentry.reentry_candidate_count, 0);

// Even if the source turn is visible in history, it cannot feed back into itself.
const sameTurnInput = {
  world_simulation_session_id: exact.sessionId,
  current_turn_id: exact.turnId,
  current_state_revision: exact.revision,
  current_world_state_hash: exact.worldStateHash,
  world_history: futureHistory,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [exact.current.phase81N],
};
const sameTurnProjection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(sameTurnInput);
assert.equal(sameTurnProjection.reentry_candidate_count, 0);

// Rehashing historical Phase82D cannot detach it from its persisted Phase82C source appraisal.
const forgedHistory = clone(futureHistory);
const forgedSourceTurn = forgedHistory.turns.find((turn) => turn.turn_id === exact.turnId);
const forgedAdmissionProjection = forgedSourceTurn.counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission;
const forgedAdmission = forgedAdmissionProjection.admissions[0];
forgedAdmission.learning_orientation = "defer_revise_retain";
const forgedAdmissionIdentity = {
  version: forgedAdmission.version,
  world_simulation_session_id: forgedAdmission.world_simulation_session_id,
  turn_id: forgedAdmission.turn_id,
  state_revision: forgedAdmission.state_revision,
  world_state_hash: forgedAdmission.world_state_hash,
  character: forgedAdmission.character,
  source_phase82c_projection_hash: forgedAdmission.source_phase82c_projection_hash,
  source_phase82c_appraisal_ref: forgedAdmission.source_phase82c_appraisal_ref,
  source_phase82c_appraisal_hash: forgedAdmission.source_phase82c_appraisal_hash,
  source_phase82b_context_ref: forgedAdmission.source_phase82b_context_ref,
  source_phase82a_context_ref: forgedAdmission.source_phase82a_context_ref,
  source_phase81m_capsule_ref: forgedAdmission.source_phase81m_capsule_ref,
  reuse_intent_ref: forgedAdmission.reuse_intent_ref,
  appraisal_kind: forgedAdmission.appraisal_kind,
  learning_orientation: forgedAdmission.learning_orientation,
  salient_comparison_refs: clone(forgedAdmission.salient_comparison_refs),
  admission_decision: forgedAdmission.admission_decision,
};
forgedAdmission.admission_hash = hashAgentRunValue(forgedAdmissionIdentity);
forgedAdmission.admission_ref = `phase82d_admission_${forgedAdmission.admission_hash.slice(0, 24)}`;
delete forgedAdmissionProjection.projection_hash;
forgedAdmissionProjection.projection_hash = hashAgentRunValue(forgedAdmissionProjection);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry({
    ...input,
    world_history: forgedHistory,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_APPRAISAL_MISMATCH",
);

// Rehashing Phase82E itself cannot detach current relevance from canonical Phase81N.
const forgedProjection = clone(projection);
forgedProjection.reentry_candidates[0].current_action_ref = "forged_current_action_ref";
rehashPhase82ECandidate(forgedProjection.reentry_candidates[0]);
delete forgedProjection.projection_hash;
forgedProjection.projection_hash = hashAgentRunValue(forgedProjection);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
    forgedProjection,
    {
      world_simulation_session_id: input.world_simulation_session_id,
      current_turn_id: input.current_turn_id,
      current_state_revision: input.current_state_revision,
      current_world_state_hash: input.current_world_state_hash,
      world_history: futureHistory,
      counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CURRENT_SOURCE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const nIndex = loopSource.indexOf("const counterfactualLinkedExperienceLongitudinalCaseReentry =");
const oIndex = loopSource.indexOf("const counterfactualLinkedExperienceReuseOutcomeReentryByCharacter =");
assert.ok(nIndex >= 0 && oIndex > nIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_longitudinal_case_reentry:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalCaseReentry\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_longitudinal_case_reentry:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_case_reentry \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82E",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
  prior_committed_phase82d_retain_admission_required: true,
  canonical_phase82c_source_appraisal_revalidated: true,
  canonical_current_phase81n_relevance_revalidated: true,
  exact_phase81m_capsule_and_reuse_intent_join_required: true,
  same_turn_feedback_blocked: true,
  defer_admission_does_not_reenter: true,
  rehashed_historical_phase82d_forgery_rejected: true,
  rehashed_current_phase81n_detachment_rejected: true,
  fuzzy_similarity_used: false,
  effectiveness_success_reward_q_causal_credit_modeled: false,
  action_selection_authority: false,
  belief_semantic_memory_world_mutation_performed: false,
  downstream_deliberative_use_deferred: true,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82E retained longitudinal case evidence cross-turn re-entry tests passed.");
