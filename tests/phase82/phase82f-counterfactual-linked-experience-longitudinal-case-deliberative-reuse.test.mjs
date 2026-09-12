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
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseContract,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-deliberative-reuse-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationContract,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";
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
  const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionResolverView(input);
  return projectWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmission({
    ...input,
    resolver_view: view,
    admission_decisions: [{
      appraisal_ref: view.candidates[0].appraisal_ref,
      decision: "retain_longitudinal_case_evidence",
    }],
  });
}

function sourceTurn(scenario, phase82c, phase82d) {
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

function buildCanonicalSource() {
  const scenario = buildPhase82LongitudinalScenario({ mode: "exact" });
  const phase82c = buildPhase82C(scenario);
  const phase82d = buildPhase82D(scenario, phase82c);
  const history = clone(scenario.history);
  history.turns.push(sourceTurn(scenario, phase82c, phase82d));
  const future = buildPhase82ReuseTurn(history, {
    turnId: "turn_phase82f_future",
    revision: 129,
    worldStateHash: "world_state_hash_phase82f_future",
    result: "reached_cover",
    status: "stable",
  });
  const expectedSource = {
    world_simulation_session_id: future.phase81N.world_simulation_session_id,
    current_turn_id: future.phase81N.current_turn_id,
    current_state_revision: future.phase81N.current_state_revision,
    current_world_state_hash: future.phase81N.current_world_state_hash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [future.phase81N],
  };
  const phase82e = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(expectedSource);
  return { scenario, history, future, expectedSource, phase82e };
}

function rehashIntent(intent) {
  const identity = clone(intent);
  for (const key of [
    "deliberative_reuse_intent_ref",
    "deliberative_reuse_intent_hash",
    "explicit_character_brain_activation_recorded",
    "retained_longitudinal_case_is_candidate_evidence_only",
    "retained_admission_is_effectiveness_claim",
    "retained_admission_is_success_claim",
    "preference_selected",
    "action_selected",
    "numeric_effectiveness_or_success_rate_assigned",
    "probability_confidence_utility_reward_q_value_assigned",
    "causal_or_outcome_credit_assigned",
    "rule_or_preference_revision_performed",
    "belief_revision_performed",
    "semantic_revision_performed",
    "ordinary_subjective_memory_rewrite_performed",
    "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  intent.deliberative_reuse_intent_hash = hash;
  intent.deliberative_reuse_intent_ref = `phase82f_longitudinal_case_reuse_${hash.slice(0, 24)}`;
}

function rehashProjection(projection) {
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseContract();
assert.equal(contract.phase, "Phase82F");
assert.equal(contract.source_owner, "Phase82E");
assert.equal(contract.deliberation_owner, "CharacterBrain");
assert.equal(contract.exact_phase82e_lineage_required, true);
assert.equal(contract.explicit_character_brain_activation_required, true);
assert.equal(contract.omitted_candidate_means_no_deliberative_reuse, true);
assert.equal(contract.opaque_refs_only_response_contract, true);
assert.equal(contract.retained_admission_is_not_effectiveness_claim, true);
assert.equal(contract.retained_admission_is_not_success_claim, true);
assert.equal(contract.automatic_preference_selection_allowed, false);
assert.equal(contract.automatic_action_selection_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const canonical = buildCanonicalSource();
assert.equal(canonical.phase82e.reentry_candidate_count, 1);
const character = canonical.phase82e.reentry_candidates[0].character;
const view = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
  character,
  source_phase82e_projection: canonical.phase82e,
  expected_source: canonical.expectedSource,
});
assert.equal(view.longitudinal_case_candidates.length, 1);
assert.equal(view.response_contract.output_field, "activated_longitudinal_case_refs");
assert.equal(view.response_contract.opaque_refs_only, true);
assert.equal(view.boundaries.retained_admission_interpreted_as_effectiveness, false);
assert.equal(view.boundaries.retained_admission_interpreted_as_success, false);
assert.equal(view.boundaries.automatic_action_selection_allowed, false);
assert.equal(view.boundaries.world_truth_authority, false);
assert.equal(Object.hasOwn(view.longitudinal_case_candidates[0], "source_phase82d_admission_ref"), false);
assert.equal(Object.hasOwn(view.longitudinal_case_candidates[0], "source_phase82c_appraisal_ref"), false);
assert.equal(Object.hasOwn(view.longitudinal_case_candidates[0], "subjective_experience"), false);

const empty = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
  character,
  source_phase82e_projection: canonical.phase82e,
  expected_source: canonical.expectedSource,
  resolver_view: view,
  activated_longitudinal_case_refs: [],
});
assert.equal(empty.deliberative_reuse_intent_count, 0);
assert.equal(empty.character_view.retained_longitudinal_case_deliberative_evidence.length, 0);

const activatedRef = view.longitudinal_case_candidates[0].reentry_candidate_ref;
const projection = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
  character,
  source_phase82e_projection: canonical.phase82e,
  expected_source: canonical.expectedSource,
  resolver_view: view,
  activated_longitudinal_case_refs: [activatedRef],
});
assert.equal(projection.version, worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion);
assert.equal(projection.phase, "Phase82F");
assert.equal(projection.deliberative_reuse_intent_count, 1);
const intent = projection.deliberative_reuse_intents[0];
assert.equal(intent.source_reentry_candidate_ref, activatedRef);
assert.equal(intent.explicit_character_brain_activation_recorded, true);
assert.equal(intent.retained_longitudinal_case_is_candidate_evidence_only, true);
assert.equal(intent.retained_admission_is_effectiveness_claim, false);
assert.equal(intent.retained_admission_is_success_claim, false);
assert.equal(intent.preference_selected, false);
assert.equal(intent.action_selected, false);
assert.equal(intent.numeric_effectiveness_or_success_rate_assigned, false);
assert.equal(intent.causal_or_outcome_credit_assigned, false);
assert.equal(intent.world_truth_authority, false);
assert.equal(projection.character_view.effectiveness_authority, false);
assert.equal(projection.character_view.selected_action_authority, false);
assert.equal(projection.character_view.world_truth_authority, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
    projection,
    {
      character,
      source_phase82e_projection: canonical.phase82e,
      expected_source: canonical.expectedSource,
    },
  ));

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
    character,
    source_phase82e_projection: canonical.phase82e,
    expected_source: canonical.expectedSource,
    resolver_view: view,
    activated_longitudinal_case_refs: ["phase82e_not_in_view"],
  }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_DECISION_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
    character,
    source_phase82e_projection: canonical.phase82e,
    expected_source: canonical.expectedSource,
    resolver_view: view,
    activated_longitudinal_case_refs: [activatedRef, activatedRef],
  }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_DECISION_INVALID",
);

// Rehashing Phase82F-local lineage cannot detach it from canonical Phase82E.
const forged = clone(projection);
forged.deliberative_reuse_intents[0].current_action_ref = "forged_action_ref";
rehashIntent(forged.deliberative_reuse_intents[0]);
rehashProjection(forged);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
    forged,
    {
      character,
      source_phase82e_projection: canonical.phase82e,
      expected_source: canonical.expectedSource,
    },
  ),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_SOURCE_MISMATCH",
);

// Rehashing the historical source chain must also fail through Phase82E canonical replay.
const forgedHistory = clone(canonical.history);
const sourceTurnValue = forgedHistory.turns.find((turn) => turn.turn_id === canonical.scenario.turnId);
const admissionProjection = sourceTurnValue.counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission;
admissionProjection.admissions[0].learning_orientation = "forged_orientation";
delete admissionProjection.projection_hash;
admissionProjection.projection_hash = hashAgentRunValue(admissionProjection);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
    character,
    source_phase82e_projection: canonical.phase82e,
    expected_source: {
      ...canonical.expectedSource,
      world_history: forgedHistory,
    },
  }),
  (error) => Boolean(error?.code),
);

const formalSource = await readFile("server/src/world-simulation-formal-turn-transport-service.mjs", "utf8");
const formalDeliberationSource = await readFile("server/src/world-simulation-formal-experiential-deliberation-service.mjs", "utf8");
const formalContractSource = await readFile("server/src/world-simulation-formal-experiential-deliberation-contract.mjs", "utf8");
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(formalContractSource, /counterfactual_linked_longitudinal_case_deliberative_reuse/);
assert.match(formalContractSource, /activated_longitudinal_case_refs/);
assert.match(formalDeliberationSource, /counterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolver/);
assert.match(formalDeliberationSource, /Phase82F/);
assert.match(formalSource, /buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView/);
assert.match(formalSource, /counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections/);
assert.match(
  loopSource,
  /assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection/,
);
assert.match(
  loopSource,
  /counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjections\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections \?\? null/,
);
const formalDeliberationContract = buildWorldSimulationFormalImpasseDeliberationContract();
const phase81OStageIndex = formalDeliberationContract.stage_order.indexOf("Phase81O");
const phase82FStageIndex = formalDeliberationContract.stage_order.indexOf("Phase82F");
const actionSelectionStageIndex = formalDeliberationContract.stage_order.indexOf("action_selection");
assert.ok(phase81OStageIndex >= 0);
assert.ok(phase82FStageIndex > phase81OStageIndex);
assert.ok(actionSelectionStageIndex > phase82FStageIndex);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82F",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
  exact_phase82e_lineage_required: true,
  exact_phase82d_phase82c_history_replay_required: true,
  exact_current_phase81n_relevance_required: true,
  explicit_character_brain_activation_required: true,
  opaque_refs_only_response_contract: true,
  omitted_candidate_means_no_reuse: true,
  duplicate_or_out_of_view_refs_rejected: true,
  rehashed_phase82f_lineage_forgery_rejected: true,
  historical_source_forgery_rejected: true,
  effectiveness_success_preference_action_authority: false,
  causal_or_outcome_credit_assigned: false,
  formal_same_snapshot_replay_wired: true,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82F retained longitudinal case deliberative reuse tests passed.");
