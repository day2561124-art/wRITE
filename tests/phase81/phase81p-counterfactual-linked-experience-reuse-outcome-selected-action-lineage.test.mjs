import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-retention-capsule-service.mjs";
import {
  projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-reentry-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-deliberation-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageBundle,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageContract,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-selected-action-lineage-service.mjs";

const sessionId = "session_phase81p";
const character = "千夜";
const retainedTurnId = "turn_phase81p_retained";
const retainedRevision = 61;
const retainedWorldStateHash = "world_state_hash_phase81p_retained";
const currentTurnId = "turn_phase81p_current";
const currentRevision = 67;
const currentWorldStateHash = "world_state_hash_phase81p_current";

function clone(value) {
  return structuredClone(value);
}
function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}
function phase81MRetention() {
  const intent = "advance using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: retainedTurnId,
    state_revision: retainedRevision,
    world_state_hash: retainedWorldStateHash,
    character,
    source_phase81l_evidence_ref: "phase81l_evidence_phase81p",
    source_phase81l_evidence_hash: "phase81l_evidence_hash_phase81p",
    source_phase81j_projection_hash: "phase81j_projection_hash_phase81p",
    source_phase81i_projection_hash: "phase81i_projection_hash_phase81p",
    reuse_intent_ref: "phase81j_reuse_phase81p",
    reuse_intent_hash: "phase81j_reuse_hash_phase81p",
    source_reentry_candidate_ref: "phase81i_reentry_phase81p",
    source_reentry_candidate_hash: "phase81i_reentry_hash_phase81p",
    current_action_id: "retained_covered_advance",
    current_action_ref: "phase74a_retained_covered_advance",
    current_context_cue_signatures: [
      {
        cue_kind: "action_candidate.intent",
        cue_content_hash: cueContentHash("action_candidate.intent", intent),
        action_defining: true,
        retention_role: "retained_exact_current_support",
      },
      {
        cue_kind: "action_candidate.movement",
        cue_content_hash: cueContentHash("action_candidate.movement", movement),
        action_defining: true,
        retention_role: "incorporated_current_context_addition",
      },
    ],
    handled_context_difference_kinds: ["action_candidate.known_costs"],
    prior_linked_case_subjective_experience: {
      action_id: "earlier_covered_advance",
      performed: true,
      perceived_result: "reached_first_cover",
      perceived_status: "stable_after_first_move",
    },
    current_selected_action_subjective_experience: {
      action_id: "retained_covered_advance",
      performed: true,
      perceived_result: "reached_second_cover",
      perceived_status: "stable_after_reuse",
    },
    source_monitoring: {
      historical_counterfactual_source: "imagined_decision_time_possibility",
      prior_linked_case_outcome_source: "prior_experienced_subjective_outcome",
      current_reuse_intent_source: "current_subjective_deliberative_reuse_intent",
      current_selection_source: "actual_selected_action_lineage",
      current_outcome_source: "current_experienced_subjective_outcome",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase81m_reuse_retention_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    current_selected_action_subjective_outcome_observed: true,
    prior_linked_case_subjective_outcome_is_current_world_truth: false,
    prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
    reuse_or_advisory_effectiveness_inferred: false,
    historical_counterfactual_truth_evaluated: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    counterfactual_linked_capsule_is_episodic_fact_memory: false,
    same_turn_reentry_allowed: false,
    world_state_mutated: false,
    world_truth_authority: false,
  };
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    phase: "Phase81M",
    world_simulation_session_id: sessionId,
    turn_id: retainedTurnId,
    state_revision: retainedRevision,
    world_state_hash: retainedWorldStateHash,
    source_phase81l_projection_hash: "phase81l_projection_hash_phase81p",
    source_phase81j_projection_hashes: ["phase81j_projection_hash_phase81p"],
    source_phase81i_projection_hashes: ["phase81i_projection_hash_phase81p"],
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81l_outcome_evidence_verified: true,
      exact_phase81k_phase81j_phase81i_phase74d_world_history_revalidated: true,
      hash_level_current_context_signatures_retained: true,
      prior_and_current_subjective_outcomes_source_distinct: true,
      prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
      reuse_or_advisory_effectiveness_inferred: false,
      historical_counterfactual_truth_evaluated: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_capsules: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      future_reentry_or_effectiveness_interpretation_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}
function worldHistory() {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: retainedTurnId,
      revision_from: retainedRevision,
      revision_to: retainedRevision + 1,
      previous_state_hash: retainedWorldStateHash,
      next_state_hash: `next_${retainedWorldStateHash}`,
      counterfactual_linked_experience_reuse_outcome_retention: phase81MRetention(),
    }],
  };
}
function phase81NSource(history = worldHistory()) {
  const candidates = [{
    action_id: "current_covered_advance",
    intent: "advance using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["higher_attention"],
    duration_s: 5,
    target: { label: "doorway" },
  }];
  const cognition = {
    goals: [{ summary: "reach ally safely" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidates,
    source_phase74a_deliberation: phase74A,
    world_history: history,
  });
}
function phase81OSource(phase81N, history = worldHistory()) {
  const view = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
  });
  const candidate = view.reuse_outcome_candidates[0];
  const actionDefining = candidate.exact_current_cue_matches
    .find((match) => match.action_defining === true)?.current_cue_ref;
  const unmatched = candidate.unmatched_retained_context_signatures[0]?.retained_cue_ref;
  const currentAddition = candidate.current_additional_candidate_cues[0]?.current_cue_ref;
  return projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
    resolver_view: view,
    reuse_outcome_deliberation_decisions: [{
      reentry_candidate_ref: candidate.reentry_candidate_ref,
      retain_matched_current_cue_refs: [actionDefining],
      drop_unmatched_retained_cue_refs: unmatched ? [unmatched] : [],
      incorporate_current_additional_cue_refs:
        unmatched ? [] : (currentAddition ? [currentAddition] : []),
    }],
  });
}
function choiceBundle(actionId, actionRef) {
  const identity = {
    version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    character,
    selection_kind: "candidate_action_intent",
    action_id: actionId,
    action_ref: actionRef,
    prospect_ref: null,
    option_ref: null,
    deliberation_view_hash: "phase74a_hash_phase81p",
    prospective_consequence_view_hash: "phase74b_hash_phase81p",
    cross_option_preference_view_hash: "phase74c_hash_phase81p",
  };
  const receiptHash = hashAgentRunValue(identity);
  const receipt = {
    receipt_id: `phase74d_choice_${receiptHash.slice(0, 24)}`,
    receipt_hash: receiptHash,
    ...identity,
    receipt_status: "character_decision_committed_for_world_resolution",
    receipt_records_intent_not_outcome: true,
    selection_was_membership_validated_upstream: true,
    world_truth_authority: false,
    causal_outcome_authority: false,
    semantic_candidate_content_duplicated: false,
    numeric_score_recorded: false,
  };
  const bundle = {
    version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    receipt_count: 1,
    receipts: [receipt],
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_is_authoritative: true,
      prepared_turn_broker_is_not_durable_store: true,
      receipt_does_not_mutate_world_state: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return bundle;
}
function rehashReceipt(receipt) {
  const identity = clone(receipt);
  for (const key of [
    "receipt_id", "receipt_hash", "selected_action_matches_phase81o_current_action",
    "lineage_records_selection_relation_only", "deliberative_reuse_intent_caused_selection_claimed",
    "counterfactual_case_caused_candidate_generation_claimed",
    "prior_linked_case_subjective_outcome_is_current_world_truth",
    "prior_reuse_subjective_outcome_is_current_world_truth", "historical_counterfactual_truth_evaluated",
    "action_outcome_observed", "reuse_effectiveness_inferred", "causal_or_outcome_credit_assigned",
    "success_failure_learning_performed", "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed", "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  receipt.receipt_hash = hash;
  receipt.receipt_id = `phase81p_selected_relation_${hash.slice(0, 24)}`;
}
function rehashBundle(bundle) {
  delete bundle.receipt_bundle_hash;
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageContract();
assert.equal(contract.phase, "Phase81P");
assert.equal(contract.source_deliberation_owner, "Phase81O");
assert.equal(contract.source_reentry_owner, "Phase81N");
assert.equal(contract.source_choice_owner, "Phase74D");
assert.equal(contract.lineage_records_selection_relation_only, true);
assert.equal(contract.deliberative_reuse_intent_caused_selection_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.reuse_effectiveness_inferred, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);

const history = worldHistory();
const phase81N = phase81NSource(history);
const phase81O = phase81OSource(phase81N, history);
assert.equal(phase81O.deliberative_reuse_intent_count, 1);
const intent = phase81O.deliberative_reuse_intents[0];
const choices = choiceBundle(intent.current_action_id, intent.current_action_ref);
const lineage = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: history,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
  counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(lineage.version, worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageVersion);
assert.equal(lineage.phase, "Phase81P");
assert.equal(lineage.receipt_count, 1);
assert.equal(lineage.receipts[0].action_id, intent.current_action_id);
assert.equal(lineage.receipts[0].deliberative_reuse_intent_ref, intent.deliberative_reuse_intent_ref);
assert.equal(lineage.receipts[0].selection_relation, "selected_action_matches_reuse_outcome_deliberative_intent");
assert.equal(lineage.receipts[0].deliberative_reuse_intent_caused_selection_claimed, false);
assert.equal(lineage.receipts[0].action_outcome_observed, false);
assert.equal(lineage.receipts[0].reuse_effectiveness_inferred, false);
assert.doesNotThrow(() => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageBundle(
  lineage,
  {
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    world_history: history,
  },
));

const noMatchChoices = choiceBundle("different_action", "phase74a_different_action");
const noMatch = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: history,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
  counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
  subjective_choice_commitment_receipts: noMatchChoices,
});
assert.equal(noMatch.receipt_count, 0);

const emptyView = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
  source_phase81n_projection: phase81N,
  expected_source: { world_history: history },
});
const emptyO = projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
  source_phase81n_projection: phase81N,
  expected_source: { world_history: history },
  resolver_view: emptyView,
  reuse_outcome_deliberation_decisions: [],
});
const noIntent = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: history,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
  counterfactual_linked_experience_reuse_outcome_deliberation_projections: [emptyO],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(noIntent.receipt_count, 0);

const forged = clone(lineage);
forged.receipts[0].action_id = "forged_action";
rehashReceipt(forged.receipts[0]);
rehashBundle(forged);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageBundle(
    forged,
    {
      subjective_choice_commitment_receipts: choices,
      counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
      counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
      world_history: history,
    },
  ),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage/);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_selected_action_lineage:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeSelectedActionLineage\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_selected_action_lineage:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_selected_action_lineage \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81P",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineageVersion,
  exact_phase81n_81o_lineage_required: true,
  exact_phase74d_selected_action_required: true,
  nonmatching_selected_action_produces_receipt: false,
  omitted_deliberative_reuse_intent_produces_receipt: false,
  rehashed_phase81p_action_forgery_rejected: true,
  caused_selection_claimed: false,
  action_outcome_consumed: false,
  reuse_effectiveness_inferred: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81P reuse-outcome deliberation selected-action lineage tests passed.");
