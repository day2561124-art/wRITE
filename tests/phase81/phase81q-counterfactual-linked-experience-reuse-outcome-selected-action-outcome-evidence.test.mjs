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
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceContract,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-selected-action-outcome-evidence-service.mjs";

const sessionId = "session_phase81q";
const character = "千夜";
const retainedTurnId = "turn_phase81q_retained";
const retainedRevision = 71;
const retainedWorldStateHash = "world_state_hash_phase81q_retained";
const currentTurnId = "turn_phase81q_current";
const currentRevision = 77;
const currentWorldStateHash = "world_state_hash_phase81q_current";

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
    source_phase81l_evidence_ref: "phase81l_evidence_phase81q",
    source_phase81l_evidence_hash: "phase81l_evidence_hash_phase81q",
    source_phase81j_projection_hash: "phase81j_projection_hash_phase81q",
    source_phase81i_projection_hash: "phase81i_projection_hash_phase81q",
    reuse_intent_ref: "phase81j_reuse_phase81q",
    reuse_intent_hash: "phase81j_reuse_hash_phase81q",
    source_reentry_candidate_ref: "phase81i_reentry_phase81q",
    source_reentry_candidate_hash: "phase81i_reentry_hash_phase81q",
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
    source_phase81l_projection_hash: "phase81l_projection_hash_phase81q",
    source_phase81j_projection_hashes: ["phase81j_projection_hash_phase81q"],
    source_phase81i_projection_hashes: ["phase81i_projection_hash_phase81q"],
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
    deliberation_view_hash: "phase74a_hash_phase81q",
    prospective_consequence_view_hash: "phase74b_hash_phase81q",
    cross_option_preference_view_hash: "phase74c_hash_phase81q",
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
  perceivedResult = "reached_third_cover",
  perceivedStatus = "stable_after_second_generation_reuse",
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
    source_outcome_hashes: ["bounded_outcome_hash_phase81q"],
    source_transition_hashes: ["bounded_transition_hash_phase81q"],
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
function rehash81PReceipt(receipt) {
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
function rehash81QRecord(record) {
  const output = clone(record);
  const identity = clone(output);
  for (const key of [
    "evidence_ref", "evidence_hash", "selected_action_subjective_outcome_observed",
    "prior_linked_case_subjective_outcome_is_current_world_truth",
    "prior_reuse_subjective_outcome_is_current_world_truth", "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome",
    "deliberative_reuse_intent_caused_selection_claimed", "reuse_effectiveness_inferred",
    "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
    "preference_revision_performed", "belief_revision_performed", "semantic_revision_performed",
    "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  output.evidence_hash = hash;
  output.evidence_ref = `phase81q_outcome_evidence_${hash.slice(0, 24)}`;
  return output;
}
function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract =
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase81Q");
assert.equal(contract.source_selected_action_lineage_owner, "Phase81P");
assert.equal(contract.source_subjective_outcome_owner, "Phase76A");
assert.equal(contract.exact_phase81n_phase81o_phase74d_world_history_revalidation_required, true);
assert.equal(contract.prior_linked_case_subjective_outcome_is_current_world_truth, false);
assert.equal(contract.prior_reuse_subjective_outcome_is_current_world_truth, false);
assert.equal(contract.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(contract.deliberative_reuse_intent_caused_selection_claimed, false);
assert.equal(contract.reuse_effectiveness_inferred, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.world_truth_authority_claimed, false);

const history = worldHistory();
const phase81N = phase81NSource(history);
const phase81O = phase81OSource(phase81N, history);
const intent = phase81O.deliberative_reuse_intents[0];
const choices = choiceBundle(intent.current_action_id, intent.current_action_ref);
const phase81P = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: history,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
  counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(phase81P.receipt_count, 1);
const phase76A = buildPhase76A({ experienceActionId: intent.current_action_id });

const evidence =
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    post_outcome_subjective_perception_projection: phase76A,
  });
assert.equal(
  evidence.version,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceVersion,
);
assert.equal(evidence.phase, "Phase81Q");
assert.equal(evidence.evidence_count, 1);
const record = evidence.evidence_records[0];
assert.equal(record.phase81p_receipt_id, phase81P.receipts[0].receipt_id);
assert.equal(record.deliberative_reuse_intent_ref, intent.deliberative_reuse_intent_ref);
assert.equal(record.action_id, intent.current_action_id);
assert.equal(record.action_ref, intent.current_action_ref);
assert.deepEqual(record.selected_action_subjective_experience, {
  action_id: intent.current_action_id,
  performed: true,
  perceived_result: "reached_third_cover",
  perceived_status: "stable_after_second_generation_reuse",
});
assert.equal(record.selected_action_subjective_outcome_observed, true);
assert.equal(record.prior_linked_case_subjective_outcome_is_current_world_truth, false);
assert.equal(record.prior_reuse_subjective_outcome_is_current_world_truth, false);
assert.equal(record.historical_counterfactual_truth_evaluated, false);
assert.equal(record.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(record.deliberative_reuse_intent_caused_selection_claimed, false);
assert.equal(record.reuse_effectiveness_inferred, false);
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
  counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
  subjective_choice_commitment_receipts: choices,
  counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
  counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
  world_history: history,
  post_outcome_subjective_perception_projection: phase76A,
};
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
    evidence,
    exactExpected,
  ));

const differentActionPhase76A = buildPhase76A({
  experienceActionId: "hold_position",
  perceivedResult: "held_ground",
  perceivedStatus: "stable",
});
const noOutcomeMatch =
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    post_outcome_subjective_perception_projection: differentActionPhase76A,
  });
assert.equal(noOutcomeMatch.evidence_count, 0);

const forged81P = clone(phase81P);
forged81P.receipts[0].action_id = "forged_action";
rehash81PReceipt(forged81P.receipts[0]);
delete forged81P.receipt_bundle_hash;
forged81P.receipt_bundle_hash = hashAgentRunValue(forged81P);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: forged81P,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    post_outcome_subjective_perception_projection: phase76A,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
);

const forgedLineageEvidence = clone(evidence);
forgedLineageEvidence.evidence_records[0].action_ref = "forged_action_ref";
forgedLineageEvidence.evidence_records[0] = rehash81QRecord(forgedLineageEvidence.evidence_records[0]);
const forgedLineageProjection = rehashProjection(forgedLineageEvidence);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
    forgedLineageProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const forgedSubjectiveEvidence = clone(evidence);
forgedSubjectiveEvidence.evidence_records[0]
  .selected_action_subjective_experience.perceived_result = "invented_better_result";
forgedSubjectiveEvidence.evidence_records[0] = rehash81QRecord(
  forgedSubjectiveEvidence.evidence_records[0],
);
const forgedSubjectiveProjection = rehashProjection(forgedSubjectiveEvidence);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
    forgedSubjectiveProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const forgedPhase76A = clone(phase76A);
forgedPhase76A.character_experiences[0].experience.perceived_result = "forged_result";
delete forgedPhase76A.projection_hash;
forgedPhase76A.projection_hash = hashAgentRunValue(forgedPhase76A);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    post_outcome_subjective_perception_projection: forgedPhase76A,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_HASH_MISMATCH",
);

assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
    evidence,
    {
      counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
      subjective_choice_commitment_receipts: choices,
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_OUTCOME_EVIDENCE_EXPECTED_SOURCE_SET_INCOMPLETE",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81PIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeSelectedActionLineage =",
);
const causalResolutionIndex = resolveSource.indexOf(
  "const causalResolution = assertCausalResolution(await causalAdjudicator({",
);
const phase76AIndex = resolveSource.indexOf(
  "const postOutcomeSubjectivePerceptionProjection =",
);
const phase81QIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence =",
);
const phase81LIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeEvidence =",
);
assert.ok(resolveStart >= 0);
assert.ok(phase81PIndex >= 0);
assert.ok(causalResolutionIndex > phase81PIndex);
assert.ok(phase76AIndex > causalResolutionIndex);
assert.ok(phase81QIndex > phase76AIndex);
assert.ok(phase81LIndex > phase81QIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81Q",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceVersion,
  exact_phase81p_lineage_required: true,
  exact_phase81n_81o_74d_history_revalidation_required: true,
  exact_phase76a_subjective_outcome_required: true,
  nonmatching_subjective_outcome_produces_evidence: false,
  rehashed_phase81p_forgery_rejected: true,
  rehashed_phase81q_lineage_forgery_rejected: true,
  rehashed_phase81q_subjective_outcome_forgery_rejected: true,
  historical_counterfactual_validated_by_current_outcome: false,
  reuse_effectiveness_inferred: false,
  success_failure_interpretation_performed: false,
  causal_or_outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81Q reuse-outcome selected-action subjective outcome evidence tests passed.");
