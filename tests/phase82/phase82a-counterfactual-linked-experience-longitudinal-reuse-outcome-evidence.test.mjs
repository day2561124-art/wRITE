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
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-selected-action-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceContract,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-evidence-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";

const sessionId = "session_phase82a";
const character = "千夜";
const retainedTurnId = "turn_phase82a_retained";
const retainedRevision = 81;
const retainedWorldStateHash = "world_state_hash_phase82a_retained";

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
    source_phase81l_evidence_ref: "phase81l_evidence_phase82a",
    source_phase81l_evidence_hash: "phase81l_evidence_hash_phase82a",
    source_phase81j_projection_hash: "phase81j_projection_hash_phase82a",
    source_phase81i_projection_hash: "phase81i_projection_hash_phase82a",
    reuse_intent_ref: "phase81j_reuse_phase82a",
    reuse_intent_hash: "phase81j_reuse_hash_phase82a",
    source_reentry_candidate_ref: "phase81i_reentry_phase82a",
    source_reentry_candidate_hash: "phase81i_reentry_hash_phase82a",
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
    source_phase81l_projection_hash: "phase81l_projection_hash_phase82a",
    source_phase81j_projection_hashes: ["phase81j_projection_hash_phase82a"],
    source_phase81i_projection_hashes: ["phase81i_projection_hash_phase82a"],
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
function baseHistory() {
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
function choiceBundle(turnId, revision, worldStateHash, actionId, actionRef) {
  const identity = {
    version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: revision,
    world_state_hash: worldStateHash,
    character,
    selection_kind: "candidate_action_intent",
    action_id: actionId,
    action_ref: actionRef,
    prospect_ref: null,
    option_ref: null,
    deliberation_view_hash: `phase74a_hash_${turnId}`,
    prospective_consequence_view_hash: `phase74b_hash_${turnId}`,
    cross_option_preference_view_hash: `phase74c_hash_${turnId}`,
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
    turn_id: turnId,
    state_revision: revision,
    world_state_hash: worldStateHash,
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
function phase76A(turnId, actionId, perceivedResult, perceivedStatus) {
  const experience = {
    action_id: actionId,
    performed: true,
    perceived_result: perceivedResult,
    perceived_status: perceivedStatus,
  };
  const identity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: turnId,
    character,
    action_id: actionId,
    experience,
    source_outcome_hashes: [`bounded_outcome_${turnId}`],
    source_transition_hashes: [`bounded_transition_${turnId}`],
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
function buildReuseTurn(history, { turnId, revision, worldStateHash, result, status }) {
  const candidates = [{
    action_id: `covered_advance_${turnId}`,
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
  const phase81N = projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: turnId,
    current_state_revision: revision,
    current_world_state_hash: worldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidates,
    source_phase74a_deliberation: phase74A,
    world_history: history,
  });
  const resolverView = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
  });
  const candidate = resolverView.reuse_outcome_candidates[0];
  assert.ok(candidate, "expected a Phase81N reuse-outcome candidate");
  const actionDefining = candidate.exact_current_cue_matches
    .find((match) => match.action_defining === true)?.current_cue_ref;
  const unmatched = candidate.unmatched_retained_context_signatures[0]?.retained_cue_ref;
  const currentAddition = candidate.current_additional_candidate_cues[0]?.current_cue_ref;
  const phase81O = projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
    resolver_view: resolverView,
    reuse_outcome_deliberation_decisions: [{
      reentry_candidate_ref: candidate.reentry_candidate_ref,
      retain_matched_current_cue_refs: [actionDefining],
      drop_unmatched_retained_cue_refs: unmatched ? [unmatched] : [],
      incorporate_current_additional_cue_refs:
        unmatched ? [] : (currentAddition ? [currentAddition] : []),
    }],
  });
  const intent = phase81O.deliberative_reuse_intents[0];
  assert.ok(intent, "expected Phase81O deliberative reuse intent");
  const choices = choiceBundle(
    turnId,
    revision,
    worldStateHash,
    intent.current_action_id,
    intent.current_action_ref,
  );
  const phase81P = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: revision,
    world_state_hash: worldStateHash,
    world_history: history,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
    subjective_choice_commitment_receipts: choices,
  });
  const outcome = phase76A(turnId, intent.current_action_id, result, status);
  const phase81Q =
    buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence({
      world_simulation_session_id: sessionId,
      turn_id: turnId,
      state_revision: revision,
      world_state_hash: worldStateHash,
      world_history: history,
      counterfactual_linked_experience_reuse_outcome_selected_action_lineage: phase81P,
      subjective_choice_commitment_receipts: choices,
      counterfactual_linked_experience_reuse_outcome_reentry_projections: [phase81N],
      counterfactual_linked_experience_reuse_outcome_deliberation_projections: [phase81O],
      post_outcome_subjective_perception_projection: outcome,
    });
  return { phase81N, phase81O, phase81P, choices, outcome, phase81Q, intent };
}
function committedTurn(turnId, revision, worldStateHash, built) {
  return {
    turn_id: turnId,
    revision_from: revision,
    revision_to: revision + 1,
    previous_state_hash: worldStateHash,
    next_state_hash: `next_${worldStateHash}`,
    subjective_choice_commitment_receipts: built.choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [built.phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [built.phase81O],
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: built.phase81P,
    counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence: built.phase81Q,
    post_outcome_subjective_perception_projection: built.outcome,
  };
}
function rehashQRecord(record) {
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

const contract =
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase82A");
assert.equal(contract.source_current_outcome_owner, "Phase81Q");
assert.equal(contract.exact_prior_phase81q_per_turn_revalidation_required, true);
assert.equal(contract.prior_outcome_required_for_longitudinal_ready, 1);
assert.equal(contract.effectiveness_interpretation_performed, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.reward_or_q_value_modeled, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.recurrence_count_auto_promotes_rule, false);

const history1 = baseHistory();
const firstTurnId = "turn_phase82a_reuse_1";
const firstRevision = 87;
const firstWorldStateHash = "world_state_hash_phase82a_reuse_1";
const first = buildReuseTurn(history1, {
  turnId: firstTurnId,
  revision: firstRevision,
  worldStateHash: firstWorldStateHash,
  result: "reached_third_cover",
  status: "stable_after_repeated_reuse",
});
assert.equal(first.phase81Q.evidence_count, 1);

const history2 = clone(history1);
history2.turns.push(committedTurn(firstTurnId, firstRevision, firstWorldStateHash, first));
const secondTurnId = "turn_phase82a_reuse_2";
const secondRevision = 93;
const secondWorldStateHash = "world_state_hash_phase82a_reuse_2";
const second = buildReuseTurn(history2, {
  turnId: secondTurnId,
  revision: secondRevision,
  worldStateHash: secondWorldStateHash,
  result: "reached_fourth_cover",
  status: "stable_after_another_reuse",
});
assert.equal(second.phase81Q.evidence_count, 1);

const longitudinal =
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: secondTurnId,
    state_revision: secondRevision,
    world_state_hash: secondWorldStateHash,
    world_history: history2,
    current_phase81q_outcome_evidence: second.phase81Q,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: second.phase81P,
    subjective_choice_commitment_receipts: second.choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [second.phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [second.phase81O],
    post_outcome_subjective_perception_projection: second.outcome,
  });
assert.equal(
  longitudinal.version,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
);
assert.equal(longitudinal.phase, "Phase82A");
assert.equal(longitudinal.context_count, 1);
assert.equal(longitudinal.longitudinal_ready_context_count, 1);
const context = longitudinal.character_case_contexts[0];
assert.equal(context.character, character);
assert.equal(context.longitudinal_ready, true);
assert.equal(context.prior_reuse_outcome_count, 1);
assert.equal(context.current_anchor.turn_id, secondTurnId);
assert.equal(context.current_anchor.role, "current_anchor");
assert.equal(context.prior_reuse_outcomes[0].turn_id, firstTurnId);
assert.equal(context.prior_reuse_outcomes[0].role, "prior_reuse_outcome");
assert.equal(
  context.source_phase81m_capsule_ref,
  first.phase81Q.evidence_records[0].source_phase81m_capsule_ref,
);
assert.equal(context.effectiveness_interpretation_performed, false);
assert.equal(context.success_failure_interpretation_performed, false);
assert.equal(context.causal_or_outcome_credit_assigned, false);
assert.equal(context.recurrence_count_auto_promotes_rule, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
    longitudinal,
    {
      world_simulation_session_id: sessionId,
      turn_id: secondTurnId,
      state_revision: secondRevision,
      world_state_hash: secondWorldStateHash,
    },
  ));

// A locally re-hashed historical Phase81Q record cannot become longitudinal
// evidence if it no longer matches that turn's canonical Phase76A experience.
const forgedHistory = clone(history2);
const forgedQ = forgedHistory.turns[1]
  .counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence;
forgedQ.evidence_records[0].selected_action_subjective_experience.perceived_result =
  "invented_historical_result";
forgedQ.evidence_records[0] = rehashQRecord(forgedQ.evidence_records[0]);
delete forgedQ.projection_hash;
forgedQ.projection_hash = hashAgentRunValue(forgedQ);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: secondTurnId,
    state_revision: secondRevision,
    world_state_hash: secondWorldStateHash,
    world_history: forgedHistory,
    current_phase81q_outcome_evidence: second.phase81Q,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage: second.phase81P,
    subjective_choice_commitment_receipts: second.choices,
    counterfactual_linked_experience_reuse_outcome_reentry_projections: [second.phase81N],
    counterfactual_linked_experience_reuse_outcome_deliberation_projections: [second.phase81O],
    post_outcome_subjective_perception_projection: second.outcome,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const qIndex = loopSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence =",
);
const phase82AIndex = loopSource.indexOf(
  "const counterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence =",
);
const phase81LIndex = loopSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeEvidence =",
);
assert.ok(qIndex >= 0);
assert.ok(phase82AIndex > qIndex);
assert.ok(phase81LIndex > phase82AIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_longitudinal_reuse_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_longitudinal_reuse_outcome_evidence:\s*\r?\n\s*input\.counterfactual_linked_experience_longitudinal_reuse_outcome_evidence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase82A",
  version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
  exact_current_phase81q_lineage_required: true,
  exact_prior_phase81q_per_turn_revalidation_required: true,
  same_root_case_longitudinal_join_verified: true,
  repeated_reuse_outcomes_preserved_as_distinct_subjective_evidence: true,
  rehashed_historical_phase81q_forgery_rejected: true,
  effectiveness_interpretation_performed: false,
  success_failure_interpretation_performed: false,
  reward_or_q_value_modeled: false,
  causal_or_outcome_credit_assigned: false,
  recurrence_count_auto_promotes_rule: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase82A longitudinal counterfactual-linked reuse-outcome evidence tests passed.");
