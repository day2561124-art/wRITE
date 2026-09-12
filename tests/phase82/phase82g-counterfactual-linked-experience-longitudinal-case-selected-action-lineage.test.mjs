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
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-deliberative-reuse-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageContract,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-case-selected-action-lineage-service.mjs";
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
    turnId: "turn_phase82g_future",
    revision: 137,
    worldStateHash: "world_state_hash_phase82g_future",
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
  const phase82e = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(
    phase82eInput,
  );
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
  return { scenario, history, future, phase82eInput, phase82e, phase82f };
}

function rehashLineageReceipt(receipt) {
  const identity = clone(receipt);
  for (const key of [
    "receipt_id",
    "receipt_hash",
    "selected_action_matches_phase82f_current_action",
    "lineage_records_selection_relation_only",
    "longitudinal_case_activation_caused_selection_claimed",
    "retained_longitudinal_case_caused_candidate_generation_claimed",
    "retained_admission_is_effectiveness_claim",
    "retained_admission_is_success_claim",
    "historical_counterfactual_truth_evaluated",
    "action_outcome_observed",
    "longitudinal_case_effectiveness_inferred",
    "causal_or_outcome_credit_assigned",
    "success_failure_learning_performed",
    "preference_revision_performed",
    "belief_revision_performed",
    "semantic_revision_performed",
    "subjective_memory_rewrite_performed",
    "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  receipt.receipt_hash = hash;
  receipt.receipt_id = `phase82g_selected_relation_${hash.slice(0, 24)}`;
}

function rehashBundle(bundle) {
  delete bundle.receipt_bundle_hash;
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageContract();
assert.equal(contract.phase, "Phase82G");
assert.equal(contract.source_deliberation_owner, "Phase82F");
assert.equal(contract.source_reentry_owner, "Phase82E");
assert.equal(contract.source_choice_owner, "Phase74D");
assert.equal(contract.exact_phase82e_phase82f_lineage_required, true);
assert.equal(contract.exact_phase74d_choice_receipt_required, true);
assert.equal(contract.lineage_records_selection_relation_only, true);
assert.equal(contract.longitudinal_case_activation_caused_selection_claimed, false);
assert.equal(contract.retained_longitudinal_case_caused_candidate_generation_claimed, false);
assert.equal(contract.retained_admission_is_effectiveness_claim, false);
assert.equal(contract.retained_admission_is_success_claim, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.longitudinal_case_effectiveness_inferred, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.direct_world_state_mutation_allowed, false);

const canonical = buildCanonicalSource();
assert.equal(canonical.phase82f.deliberative_reuse_intent_count, 1);
const intent = canonical.phase82f.deliberative_reuse_intents[0];
assert.equal(canonical.future.choices.receipts[0].action_id, intent.current_action_id);
assert.equal(canonical.future.choices.receipts[0].action_ref, intent.current_action_ref);

const lineage = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage({
  world_simulation_session_id: canonical.future.phase81N.world_simulation_session_id,
  turn_id: canonical.future.phase81N.current_turn_id,
  state_revision: canonical.future.phase81N.current_state_revision,
  world_state_hash: canonical.future.phase81N.current_world_state_hash,
  world_history: canonical.history,
  counterfactual_linked_experience_longitudinal_case_reentry: canonical.phase82e,
  counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [canonical.phase82f],
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [canonical.future.phase81N],
  subjective_choice_commitment_receipts: canonical.future.choices,
});
assert.equal(lineage.version, worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion);
assert.equal(lineage.phase, "Phase82G");
assert.equal(lineage.receipt_count, 1);
const receipt = lineage.receipts[0];
assert.equal(receipt.character, canonical.phase82f.character);
assert.equal(receipt.phase82f_projection_hash, canonical.phase82f.projection_hash);
assert.equal(receipt.source_phase82e_projection_hash, canonical.phase82e.projection_hash);
assert.equal(receipt.deliberative_reuse_intent_ref, intent.deliberative_reuse_intent_ref);
assert.equal(receipt.source_reentry_candidate_ref, intent.source_reentry_candidate_ref);
assert.equal(receipt.source_phase82d_admission_ref, intent.source_phase82d_admission_ref);
assert.equal(receipt.current_phase81n_projection_hash, canonical.future.phase81N.projection_hash);
assert.equal(receipt.action_id, intent.current_action_id);
assert.equal(receipt.action_ref, intent.current_action_ref);
assert.equal(receipt.selection_relation, "selected_action_matches_longitudinal_case_deliberative_reuse_intent");
assert.equal(receipt.selected_action_matches_phase82f_current_action, true);
assert.equal(receipt.lineage_records_selection_relation_only, true);
assert.equal(receipt.longitudinal_case_activation_caused_selection_claimed, false);
assert.equal(receipt.retained_longitudinal_case_caused_candidate_generation_claimed, false);
assert.equal(receipt.retained_admission_is_effectiveness_claim, false);
assert.equal(receipt.retained_admission_is_success_claim, false);
assert.equal(receipt.action_outcome_observed, false);
assert.equal(receipt.longitudinal_case_effectiveness_inferred, false);
assert.equal(receipt.causal_or_outcome_credit_assigned, false);
assert.equal(receipt.world_state_mutated, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
    lineage,
    {
      subjective_choice_commitment_receipts: canonical.future.choices,
      counterfactual_linked_experience_longitudinal_case_reentry: canonical.phase82e,
      counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [canonical.phase82f],
      counterfactual_linked_experience_reuse_outcome_reentry_projections: [canonical.future.phase81N],
      world_history: canonical.history,
    },
  ));

const emptyView = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
  character: canonical.phase82f.character,
  source_phase82e_projection: canonical.phase82e,
  expected_source: canonical.phase82eInput,
});
const emptyPhase82F = projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse({
  character: canonical.phase82f.character,
  source_phase82e_projection: canonical.phase82e,
  expected_source: canonical.phase82eInput,
  resolver_view: emptyView,
  activated_longitudinal_case_refs: [],
});
const noActivation = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage({
  world_simulation_session_id: canonical.future.phase81N.world_simulation_session_id,
  turn_id: canonical.future.phase81N.current_turn_id,
  state_revision: canonical.future.phase81N.current_state_revision,
  world_state_hash: canonical.future.phase81N.current_world_state_hash,
  world_history: canonical.history,
  counterfactual_linked_experience_longitudinal_case_reentry: canonical.phase82e,
  counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [emptyPhase82F],
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [canonical.future.phase81N],
  subjective_choice_commitment_receipts: canonical.future.choices,
});
assert.equal(noActivation.receipt_count, 0);

// Rehashing a Phase82G-local action claim cannot detach the receipt from the exact Phase74D choice.
const forged = clone(lineage);
forged.receipts[0].action_id = "forged_phase82g_action";
rehashLineageReceipt(forged.receipts[0]);
rehashBundle(forged);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
    forged,
    {
      subjective_choice_commitment_receipts: canonical.future.choices,
      counterfactual_linked_experience_longitudinal_case_reentry: canonical.phase82e,
      counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections: [canonical.phase82f],
      counterfactual_linked_experience_reuse_outcome_reentry_projections: [canonical.future.phase81N],
      world_history: canonical.history,
    },
  ),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  loopSource,
  /buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage/,
);
assert.match(
  loopSource,
  /counterfactual_linked_experience_longitudinal_case_selected_action_lineage:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_longitudinal_case_selected_action_lineage:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_case_selected_action_lineage \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82G",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
  exact_phase82e_82f_lineage_required: true,
  exact_phase74d_selected_action_required: true,
  omitted_phase82f_activation_produces_receipt: false,
  rehashed_phase82g_action_forgery_rejected: true,
  selection_relation_only: true,
  caused_selection_claimed: false,
  action_outcome_consumed: false,
  effectiveness_success_inferred: false,
  causal_or_outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82G longitudinal case activation selected-action lineage tests passed.");
