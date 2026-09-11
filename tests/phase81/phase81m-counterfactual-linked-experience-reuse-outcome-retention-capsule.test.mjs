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
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionContract,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-retention-capsule-service.mjs";

const sessionId = "session_phase81m";
const character = "千夜";
const historicalTurnId = "turn_phase81m_history";
const historicalRevision = 51;
const historicalWorldStateHash = "world_state_hash_phase81m_history";
const currentTurnId = "turn_phase81m_current";
const currentRevision = 57;
const currentWorldStateHash = "world_state_hash_phase81m_current";

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
    source_phase81g_evidence_ref: "phase81g_evidence_phase81m",
    source_phase81g_evidence_hash: "phase81g_evidence_hash_phase81m",
    source_phase81e_projection_hash: "phase81e_projection_hash_phase81m",
    source_phase81e_judgment_ref: "phase81e_judgment_phase81m",
    source_phase81e_judgment_hash: "phase81e_judgment_hash_phase81m",
    source_phase81d_projection_hash: "phase81d_projection_hash_phase81m",
    source_phase81d_reentry_candidate_ref: "phase81d_reentry_phase81m",
    source_phase81d_reentry_candidate_hash: "phase81d_reentry_hash_phase81m",
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
    source_phase81g_projection_hash: "phase81g_projection_hash_phase81m",
    source_phase81e_projection_hashes: ["phase81e_projection_hash_phase81m"],
    source_phase81d_projection_hashes: ["phase81d_projection_hash_phase81m"],
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
    deliberation_view_hash: "phase74a_hash_phase81m",
    prospective_consequence_view_hash: "phase74b_hash_phase81m",
    cross_option_preference_view_hash: "phase74c_hash_phase81m",
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

function buildPhase76A(actionId) {
  const experience = {
    action_id: actionId,
    performed: true,
    perceived_result: "reached_cover_again",
    perceived_status: "stable_after_reuse",
  };
  const identity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: currentTurnId,
    character,
    action_id: actionId,
    experience,
    source_outcome_hashes: ["bounded_outcome_hash_phase81m"],
    source_transition_hashes: ["bounded_transition_hash_phase81m"],
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

function rehash81MCapsule(capsule) {
  const output = clone(capsule);
  const identity = clone(output);
  for (const key of [
    "capsule_ref", "capsule_hash",
    "current_selected_action_subjective_outcome_observed",
    "prior_linked_case_subjective_outcome_is_current_world_truth",
    "prior_and_current_subjective_outcomes_compared_for_effectiveness",
    "reuse_or_advisory_effectiveness_inferred", "historical_counterfactual_truth_evaluated",
    "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
    "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed",
    "counterfactual_linked_capsule_is_episodic_fact_memory", "same_turn_reentry_allowed",
    "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  output.capsule_hash = hash;
  output.capsule_ref = `phase81m_reuse_retention_${hash.slice(0, 24)}`;
  return output;
}

function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionContract();
assert.equal(contract.phase, "Phase81M");
assert.equal(contract.source_outcome_evidence_owner, "Phase81L");
assert.equal(contract.source_reuse_owner, "Phase81J");
assert.equal(contract.source_reentry_owner, "Phase81I");
assert.equal(contract.prior_and_current_subjective_outcomes_source_distinct, true);
assert.equal(contract.reuse_effectiveness_inferred, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.causal_or_outcome_credit_assigned, false);
assert.equal(contract.same_turn_reentry_allowed, false);
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
const phase76A = buildPhase76A(intent.current_action_id);
const phase81L = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence({
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

const exactInput = {
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reuse_outcome_evidence: phase81L,
  counterfactual_linked_experience_selected_action_lineage: phase81K,
  subjective_choice_commitment_receipts: choices,
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  post_outcome_subjective_perception_projection: phase76A,
};
const retention = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
  exactInput,
);
assert.equal(retention.version, worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion);
assert.equal(retention.phase, "Phase81M");
assert.equal(retention.capsule_count, 1);
const capsule = retention.capsules[0];
assert.equal(capsule.source_phase81l_evidence_ref, phase81L.evidence_records[0].evidence_ref);
assert.equal(capsule.reuse_intent_ref, intent.reuse_intent_ref);
assert.equal(capsule.current_action_id, intent.current_action_id);
assert.equal(capsule.current_action_ref, intent.current_action_ref);
assert.deepEqual(
  capsule.prior_linked_case_subjective_experience,
  intent.prior_selected_action_subjective_experience,
);
assert.deepEqual(capsule.current_selected_action_subjective_experience, {
  action_id: intent.current_action_id,
  performed: true,
  perceived_result: "reached_cover_again",
  perceived_status: "stable_after_reuse",
});
assert.ok(capsule.current_context_cue_signatures.length > 0);
assert.ok(capsule.current_context_cue_signatures.some((item) => item.action_defining === true));
assert.ok(capsule.current_context_cue_signatures.every((item) => !Object.hasOwn(item, "content")));
assert.equal(capsule.current_selected_action_subjective_outcome_observed, true);
assert.equal(capsule.prior_linked_case_subjective_outcome_is_current_world_truth, false);
assert.equal(capsule.prior_and_current_subjective_outcomes_compared_for_effectiveness, false);
assert.equal(capsule.reuse_or_advisory_effectiveness_inferred, false);
assert.equal(capsule.historical_counterfactual_truth_evaluated, false);
assert.equal(capsule.success_failure_interpretation_performed, false);
assert.equal(capsule.causal_or_outcome_credit_assigned, false);
assert.equal(capsule.same_turn_reentry_allowed, false);
assert.equal(capsule.world_truth_authority, false);

const exactExpected = {
  ...exactInput,
  counterfactual_linked_experience_reuse_outcome_evidence: phase81L,
};
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    retention,
    exactExpected,
  ));

// Phase81M cannot turn an empty selected-reuse outcome set into a retained case.
const empty81L = clone(phase81L);
empty81L.evidence_records = [];
empty81L.evidence_count = 0;
delete empty81L.projection_hash;
empty81L.projection_hash = hashAgentRunValue(empty81L);
const emptyRetention = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules({
  ...exactInput,
  counterfactual_linked_experience_reuse_outcome_evidence: empty81L,
});
assert.equal(emptyRetention.capsule_count, 0);

// Re-hashing a modified current subjective outcome cannot detach it from Phase81L.
const forgedCurrentOutcome = clone(retention);
forgedCurrentOutcome.capsules[0].current_selected_action_subjective_experience.perceived_result =
  "invented_current_result";
forgedCurrentOutcome.capsules[0] = rehash81MCapsule(forgedCurrentOutcome.capsules[0]);
const forgedCurrentOutcomeProjection = rehashProjection(forgedCurrentOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    forgedCurrentOutcomeProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
);

// The prior linked-case experience is ancestry, not freely editable memory content.
const forgedPriorOutcome = clone(retention);
forgedPriorOutcome.capsules[0].prior_linked_case_subjective_experience.perceived_result =
  "invented_prior_result";
forgedPriorOutcome.capsules[0] = rehash81MCapsule(forgedPriorOutcome.capsules[0]);
const forgedPriorOutcomeProjection = rehashProjection(forgedPriorOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    forgedPriorOutcomeProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
);

// Current-context cue signatures are exact hash-level Phase81I/81J provenance.
const forgedCue = clone(retention);
forgedCue.capsules[0].current_context_cue_signatures[0].cue_content_hash = "forged_cue_hash";
forgedCue.capsules[0] = rehash81MCapsule(forgedCue.capsules[0]);
const forgedCueProjection = rehashProjection(forgedCue);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    forgedCueProjection,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
);

// A local effectiveness claim is invalid even if the projection hash is recomputed.
const overAuthoritative = clone(retention);
overAuthoritative.capsules[0].reuse_or_advisory_effectiveness_inferred = true;
delete overAuthoritative.projection_hash;
overAuthoritative.projection_hash = hashAgentRunValue(overAuthoritative);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    overAuthoritative,
    exactExpected,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CAPSULE_INVALID",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81LIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeEvidence =",
);
const phase81MIndex = resolveSource.indexOf(
  "const counterfactualLinkedExperienceReuseOutcomeRetention =",
);
const phase81GIndex = resolveSource.indexOf(
  "const counterfactualSelectedActionOutcomeEvidence =",
);
assert.ok(resolveStart >= 0);
assert.ok(phase81LIndex >= 0);
assert.ok(phase81MIndex > phase81LIndex);
assert.ok(phase81GIndex > phase81MIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_retention:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeRetention\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_retention:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_retention \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81M",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
  exact_phase81l_outcome_evidence_required: true,
  exact_phase81i_81j_81k_74d_history_revalidation_required: true,
  hash_level_current_context_retained: true,
  prior_and_current_subjective_outcomes_source_distinct: true,
  rehashed_current_outcome_forgery_rejected: true,
  rehashed_prior_outcome_forgery_rejected: true,
  rehashed_context_cue_forgery_rejected: true,
  reuse_effectiveness_inferred: false,
  success_failure_interpretation_performed: false,
  causal_or_outcome_credit_assigned: false,
  same_turn_reentry_allowed: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81M counterfactual-linked reuse outcome retention capsule tests passed.");
