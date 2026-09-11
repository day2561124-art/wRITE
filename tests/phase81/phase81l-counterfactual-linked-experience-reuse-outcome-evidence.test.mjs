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
  worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-retention-capsule-service.mjs";
import {
  projectWorldSimulationCounterfactualLinkedExperienceReentry,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reentry-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceReuse,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-service.mjs";
import {
  buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage,
} from "../../server/src/world-simulation-counterfactual-linked-experience-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceContract,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-evidence-service.mjs";

const sessionId = "session_phase81l";
const character = "千夜";
const historicalTurnId = "turn_phase81l_history";
const historicalRevision = 41;
const historicalWorldStateHash = "world_state_hash_phase81l_history";
const currentTurnId = "turn_phase81l_current";
const currentRevision = 47;
const currentWorldStateHash = "world_state_hash_phase81l_current";

function clone(value) {
  return structuredClone(value);
}

function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}

function retainedProjection() {
  const intent = "approach using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: historicalRevision,
    world_state_hash: historicalWorldStateHash,
    character,
    source_phase81g_evidence_ref: "phase81g_evidence_phase81l",
    source_phase81g_evidence_hash: "phase81g_evidence_hash_phase81l",
    source_phase81e_projection_hash: "phase81e_projection_hash_phase81l",
    source_phase81e_judgment_ref: "phase81e_judgment_phase81l",
    source_phase81e_judgment_hash: "phase81e_judgment_hash_phase81l",
    source_phase81d_projection_hash: "phase81d_projection_hash_phase81l",
    source_phase81d_reentry_candidate_ref: "phase81d_reentry_phase81l",
    source_phase81d_reentry_candidate_hash: "phase81d_reentry_hash_phase81l",
    current_action_id: "historical_covered_advance",
    current_action_ref: "phase74a_historical_covered_advance",
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
    addressed_historical_context_difference_kinds: ["action_candidate.known_costs"],
    current_selected_action_subjective_experience: {
      action_id: "historical_covered_advance",
      performed: true,
      perceived_result: "reached_cover",
      perceived_status: "stable_after_move",
    },
    applicability_judgment: "currently_applicable_as_deliberative_evidence",
    selection_relation: "advisory_linked_candidate_was_selected",
    historical_actual_selected_action_id: "direct_advance",
    historical_imagined_alternative_action_id: "covered_advance",
    historical_comparison_direction: "imagined_better_than_actual",
    historical_appraisal_kind: "regret_like_counterfactual_concern",
    historical_preparative_orientation: "future_improvement_candidate",
    source_monitoring: {
      historical_alternative_source: "imagined_decision_time_possibility",
      historical_appraisal_source: "subjective_counterfactual_reflection",
      current_applicability_source: "subjective_deliberative_relevance_judgment",
      current_selection_source: "actual_selected_action_lineage",
      current_outcome_source: "experienced_subjective_outcome",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase81h_retention_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    current_selected_action_subjective_outcome_observed: true,
    historical_imagined_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    counterfactual_advisory_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    outcome_credit_assigned: false,
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
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    phase: "Phase81H",
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: historicalRevision,
    world_state_hash: historicalWorldStateHash,
    source_phase81g_projection_hash: "phase81g_projection_hash_phase81l",
    source_phase81e_projection_hashes: ["phase81e_projection_hash_phase81l"],
    source_phase81d_projection_hashes: ["phase81d_projection_hash_phase81l"],
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81g_outcome_evidence_verified: true,
      exact_phase81e_revalidation_lineage_verified: true,
      exact_phase81d_reentry_lineage_verified: true,
      hash_level_current_context_signatures_retained: true,
      historical_and_current_sources_kept_separate: true,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
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
      future_reentry_or_usefulness_interpretation_requires_separate_phase: true,
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
      turn_id: historicalTurnId,
      revision_from: historicalRevision,
      revision_to: historicalRevision + 1,
      previous_state_hash: historicalWorldStateHash,
      next_state_hash: `next_${historicalWorldStateHash}`,
      counterfactual_linked_experience_retention: retainedProjection(),
    }],
  };
}

function phase81ISource() {
  const candidates = [{
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  }];
  const cognition = {
    goals: [{ summary: "reach ally" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return projectWorldSimulationCounterfactualLinkedExperienceReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidates,
    source_phase74a_deliberation: phase74A,
    world_history: worldHistory(),
  });
}

function phase81JSource(phase81I) {
  const view = buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
  });
  const candidate = view.linked_experience_candidates[0];
  const actionDefiningRef = candidate.exact_current_cue_matches
    .find((match) => match.action_defining === true)?.current_cue_ref;
  const dropRef = candidate.unmatched_retained_context_signatures[0]?.retained_cue_ref;
  const incorporateRef = candidate.current_additional_candidate_cues[0]?.current_cue_ref;
  return projectWorldSimulationCounterfactualLinkedExperienceReuse({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
    resolver_view: view,
    linked_experience_reuse_decisions: [{
      reentry_candidate_ref: candidate.reentry_candidate_ref,
      retain_matched_current_cue_refs: [actionDefiningRef],
      drop_unmatched_retained_cue_refs: dropRef ? [dropRef] : [],
      incorporate_current_additional_cue_refs: dropRef ? [] : [incorporateRef],
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
    deliberation_view_hash: "phase74a_hash_phase81l",
    prospective_consequence_view_hash: "phase74b_hash_phase81l",
    cross_option_preference_view_hash: "phase74c_hash_phase81l",
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

function buildPhase76A({
  experienceActionId,
  experienceCharacter = character,
  perceivedResult = "reached_cover",
  perceivedStatus = "stable_after_move",
} = {}) {
  const actualActionId = experienceActionId ?? "current_covered_advance";
  const experience = {
    action_id: actualActionId,
    performed: true,
    perceived_result: perceivedResult,
    perceived_status: perceivedStatus,
  };
  const identity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: currentTurnId,
    character: experienceCharacter,
    action_id: actualActionId,
    experience,
    source_outcome_hashes: ["bounded_outcome_hash_phase81l"],
    source_transition_hashes: ["bounded_transition_hash_phase81l"],
  };
  const record = {
    subjective_perception_ref:
      `phase76a_post_outcome_${hashAgentRunValue(identity).slice(0, 24)}`,
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
    turn_id: currentTurnId,
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

function rehash81KReceipt(receipt) {
  const identity = clone(receipt);
  for (const key of [
    "receipt_id", "receipt_hash",
    "selected_action_matches_phase81j_current_action",
    "lineage_records_selection_relation_only",
    "reuse_intent_caused_selection_claimed",
    "counterfactual_case_caused_candidate_generation_claimed",
    "historical_subjective_outcome_is_current_world_truth",
    "historical_counterfactual_truth_evaluated",
    "action_outcome_observed", "advisory_effectiveness_inferred",
    "outcome_credit_assigned", "success_failure_learning_performed",
    "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed",
    "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  receipt.receipt_hash = hash;
  receipt.receipt_id = `phase81k_selected_relation_${hash.slice(0, 24)}`;
}

function rehash81LRecord(record) {
  const output = clone(record);
  const identity = clone(output);
  for (const key of [
    "evidence_ref", "evidence_hash",
    "selected_action_subjective_outcome_observed",
    "prior_linked_case_subjective_outcome_is_current_world_truth",
    "historical_imagined_alternative_was_experienced",
    "historical_unchosen_outcome_observed",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome",
    "reuse_intent_caused_selection_claimed",
    "reuse_or_advisory_effectiveness_inferred",
    "success_failure_interpretation_performed",
    "causal_or_outcome_credit_assigned",
    "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed",
    "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  output.evidence_hash = hash;
  output.evidence_ref = `phase81l_reuse_outcome_${hash.slice(0, 24)}`;
  return output;
}

function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase81L");
assert.equal(contract.source_selected_action_lineage_owner, "Phase81K");
assert.equal(contract.source_subjective_outcome_owner, "Phase76A");
assert.equal(contract.exact_phase81i_phase81j_phase74d_world_history_revalidation_required, true);
assert.equal(contract.prior_linked_case_subjective_outcome_is_current_world_truth, false);
assert.equal(contract.historical_counterfactual_truth_evaluated, false);
assert.equal(contract.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(contract.reuse_intent_caused_selection_claimed, false);
assert.equal(contract.reuse_or_advisory_effectiveness_inferred, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase81I = phase81ISource();
const phase81J = phase81JSource(phase81I);
const intent = phase81J.reuse_intents[0];
const choices = choiceBundle(intent.current_action_id, intent.current_action_ref);
const phase81K = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(phase81K.receipt_count, 1);
const phase76A = buildPhase76A({ experienceActionId: intent.current_action_id });

const evidence = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_selected_action_lineage: phase81K,
  subjective_choice_commitment_receipts: choices,
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  post_outcome_subjective_perception_projection: phase76A,
});
assert.equal(evidence.version, worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion);
assert.equal(evidence.phase, "Phase81L");
assert.equal(evidence.evidence_count, 1);
const record = evidence.evidence_records[0];
assert.equal(record.phase81k_receipt_id, phase81K.receipts[0].receipt_id);
assert.equal(record.reuse_intent_ref, intent.reuse_intent_ref);
assert.equal(record.action_id, intent.current_action_id);
assert.equal(record.action_ref, intent.current_action_ref);
assert.deepEqual(record.selected_action_subjective_experience, {
  action_id: intent.current_action_id,
  performed: true,
  perceived_result: "reached_cover",
  perceived_status: "stable_after_move",
});
assert.equal(record.selected_action_subjective_outcome_observed, true);
assert.equal(record.prior_linked_case_subjective_outcome_is_current_world_truth, false);
assert.equal(record.historical_imagined_alternative_was_experienced, false);
assert.equal(record.historical_unchosen_outcome_observed, false);
assert.equal(record.historical_counterfactual_truth_evaluated, false);
assert.equal(record.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(record.reuse_intent_caused_selection_claimed, false);
assert.equal(record.reuse_or_advisory_effectiveness_inferred, false);
assert.equal(record.success_failure_interpretation_performed, false);
assert.equal(record.causal_or_outcome_credit_assigned, false);
assert.equal(record.preference_revision_performed, false);
assert.equal(record.belief_revision_performed, false);
assert.equal(record.semantic_revision_performed, false);
assert.equal(record.subjective_memory_rewrite_performed, false);
assert.equal(record.world_state_mutated, false);
assert.equal(record.world_truth_authority, false);

const exactExpected = {
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  counterfactual_linked_experience_selected_action_lineage: phase81K,
  subjective_choice_commitment_receipts: choices,
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  world_history: worldHistory(),
  post_outcome_subjective_perception_projection: phase76A,
};
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    evidence,
    exactExpected,
  ));

const differentActionPhase76A = buildPhase76A({
  experienceActionId: "hold_position",
  perceivedResult: "held_ground",
  perceivedStatus: "stable",
});
const noOutcomeMatch = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_selected_action_lineage: phase81K,
  subjective_choice_commitment_receipts: choices,
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  post_outcome_subjective_perception_projection: differentActionPhase76A,
});
assert.equal(noOutcomeMatch.evidence_count, 0);

const noLineageChoices = choiceBundle("hold_position", "phase74a_hold_position");
const noLineage = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  subjective_choice_commitment_receipts: noLineageChoices,
});
const noLineageEvidence = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_selected_action_lineage: noLineage,
  subjective_choice_commitment_receipts: noLineageChoices,
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  post_outcome_subjective_perception_projection: phase76A,
});
assert.equal(noLineageEvidence.evidence_count, 0);

// A forged Phase81K selected-action lineage cannot become Phase81L outcome
// evidence merely by recomputing its receipt and bundle hashes. Phase81L must
// replay the canonical Phase74D/81I/81J/prior-history sources through Phase81K.
const forged81K = clone(phase81K);
forged81K.receipts[0].action_id = "forged_action";
rehash81KReceipt(forged81K.receipts[0]);
const forged81KBody = clone(forged81K);
delete forged81KBody.receipt_bundle_hash;
forged81K.receipt_bundle_hash = hashAgentRunValue(forged81KBody);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: worldHistory(),
    counterfactual_linked_experience_selected_action_lineage: forged81K,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reentry_projections: [phase81I],
    counterfactual_linked_experience_reuse_projections: [phase81J],
    post_outcome_subjective_perception_projection: phase76A,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
);

// Re-hashing Phase81L after changing lineage content still cannot evade exact
// source replay against canonical Phase81K and Phase76A.
const forgedEvidenceLineage = clone(evidence);
forgedEvidenceLineage.evidence_records[0].action_ref = "forged_action_ref";
forgedEvidenceLineage.evidence_records[0] =
  rehash81LRecord(forgedEvidenceLineage.evidence_records[0]);
const forgedEvidenceLineageProjection = rehashProjection(forgedEvidenceLineage);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    forgedEvidenceLineageProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const forgedSubjectiveExperience = clone(evidence);
forgedSubjectiveExperience.evidence_records[0]
  .selected_action_subjective_experience.perceived_result = "invented_better_result";
forgedSubjectiveExperience.evidence_records[0] =
  rehash81LRecord(forgedSubjectiveExperience.evidence_records[0]);
const forgedSubjectiveExperienceProjection = rehashProjection(forgedSubjectiveExperience);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    forgedSubjectiveExperienceProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

// Phase76A itself remains source-monitored. Re-hashing the projection after
// changing experience content without reconstructing its canonical perception
// ref is rejected before Phase81L can consume it.
const forgedPhase76A = clone(phase76A);
forgedPhase76A.character_experiences[0].experience.perceived_result = "forged_result";
delete forgedPhase76A.projection_hash;
forgedPhase76A.projection_hash = hashAgentRunValue(forgedPhase76A);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: worldHistory(),
    counterfactual_linked_experience_selected_action_lineage: phase81K,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reentry_projections: [phase81I],
    counterfactual_linked_experience_reuse_projections: [phase81J],
    post_outcome_subjective_perception_projection: forgedPhase76A,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_HASH_MISMATCH",
);

assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    evidence,
    {
      counterfactual_linked_experience_selected_action_lineage: phase81K,
      subjective_choice_commitment_receipts: choices,
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_EXPECTED_SOURCE_SET_INCOMPLETE",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81KIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceSelectedActionLineage =",
);
const causalResolutionIndex = resolveSource.indexOf(
  "const causalResolution = assertCausalResolution(await causalAdjudicator({",
);
const phase76AIndex = resolveSource.indexOf(
  "const postOutcomeSubjectivePerceptionProjection =",
);
const phase81LIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeEvidence =",
);
const phase81GIndex = resolveSource.indexOf(
  "const counterfactualSelectedActionOutcomeEvidence =",
);
assert.ok(resolveStart >= 0);
assert.ok(phase81KIndex >= 0);
assert.ok(causalResolutionIndex > phase81KIndex);
assert.ok(phase76AIndex > causalResolutionIndex);
assert.ok(phase81LIndex > phase76AIndex);
assert.ok(phase81GIndex > phase81LIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_evidence:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_evidence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81L",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
  exact_phase81k_lineage_required: true,
  exact_phase81i_81j_74d_history_revalidation_required: true,
  exact_phase76a_subjective_outcome_required: true,
  nonmatching_subjective_outcome_produces_evidence: false,
  missing_selected_reuse_lineage_produces_evidence: false,
  rehashed_phase81k_forgery_rejected: true,
  rehashed_phase81l_lineage_forgery_rejected: true,
  rehashed_phase81l_subjective_outcome_forgery_rejected: true,
  historical_counterfactual_validated_by_current_outcome: false,
  reuse_effectiveness_inferred: false,
  success_failure_interpretation_performed: false,
  causal_or_outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81L counterfactual-linked reuse subjective outcome evidence tests passed.");
