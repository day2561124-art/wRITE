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
  assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle,
  buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage,
  buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageContract,
  worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-selected-action-lineage-service.mjs";

const sessionId = "session_phase81k";
const character = "千夜";
const historicalTurnId = "turn_phase81k_history";
const historicalRevision = 31;
const historicalWorldStateHash = "world_state_hash_phase81k_history";
const currentTurnId = "turn_phase81k_current";
const currentRevision = 37;
const currentWorldStateHash = "world_state_hash_phase81k_current";

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
    source_phase81g_evidence_ref: "phase81g_evidence_phase81k",
    source_phase81g_evidence_hash: "phase81g_evidence_hash_phase81k",
    source_phase81e_projection_hash: "phase81e_projection_hash_phase81k",
    source_phase81e_judgment_ref: "phase81e_judgment_phase81k",
    source_phase81e_judgment_hash: "phase81e_judgment_hash_phase81k",
    source_phase81d_projection_hash: "phase81d_projection_hash_phase81k",
    source_phase81d_reentry_candidate_ref: "phase81d_reentry_phase81k",
    source_phase81d_reentry_candidate_hash: "phase81d_reentry_hash_phase81k",
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
    source_phase81g_projection_hash: "phase81g_projection_hash_phase81k",
    source_phase81e_projection_hashes: ["phase81e_projection_hash_phase81k"],
    source_phase81d_projection_hashes: ["phase81d_projection_hash_phase81k"],
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
    deliberation_view_hash: "phase74a_hash_phase81k",
    prospective_consequence_view_hash: "phase74b_hash_phase81k",
    cross_option_preference_view_hash: "phase74c_hash_phase81k",
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

function rehash81JIntent(intent) {
  const identity = clone(intent);
  for (const key of [
    "reuse_intent_ref", "reuse_intent_hash",
    "historical_subjective_outcome_is_candidate_evidence_only",
    "historical_subjective_outcome_is_current_world_truth",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_prior_outcome",
    "advisory_effectiveness_inferred", "success_failure_interpretation_performed",
    "causal_credit_assigned", "preference_selected", "action_selected",
    "belief_revision_performed", "semantic_revision_performed",
    "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  intent.reuse_intent_hash = hash;
  intent.reuse_intent_ref = `phase81j_reuse_${hash.slice(0, 24)}`;
}

function rehash81JProjection(projection) {
  const value = clone(projection);
  delete value.projection_hash;
  value.projection_hash = hashAgentRunValue(value);
  return value;
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

const contract = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageContract();
assert.equal(contract.phase, "Phase81K");
assert.equal(contract.source_reuse_owner, "Phase81J");
assert.equal(contract.source_choice_owner, "Phase74D");
assert.equal(contract.lineage_records_selection_relation_only, true);
assert.equal(contract.reuse_intent_caused_selection_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.advisory_effectiveness_inferred, false);
assert.equal(contract.success_failure_learning_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase81I = phase81ISource();
const phase81J = phase81JSource(phase81I);
assert.equal(phase81J.reuse_intent_count, 1);
const currentIntent = phase81J.reuse_intents[0];
const choices = choiceBundle(currentIntent.current_action_id, currentIntent.current_action_ref);
const lineage = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(lineage.version, worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion);
assert.equal(lineage.phase, "Phase81K");
assert.equal(lineage.receipt_count, 1);
assert.equal(lineage.receipts[0].action_id, currentIntent.current_action_id);
assert.equal(lineage.receipts[0].reuse_intent_ref, currentIntent.reuse_intent_ref);
assert.equal(
  lineage.receipts[0].selection_relation,
  "selected_action_matches_counterfactual_linked_reuse_intent",
);
assert.equal(lineage.receipts[0].reuse_intent_caused_selection_claimed, false);
assert.equal(lineage.receipts[0].action_outcome_observed, false);
assert.equal(lineage.receipts[0].advisory_effectiveness_inferred, false);
assert.equal(lineage.receipts[0].outcome_credit_assigned, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(lineage, {
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reentry_projections: [phase81I],
    counterfactual_linked_experience_reuse_projections: [phase81J],
    world_history: worldHistory(),
  }));

const nonMatchingChoices = choiceBundle("different_action", "phase74a_different_action");
const noMatch = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [phase81J],
  subjective_choice_commitment_receipts: nonMatchingChoices,
});
assert.equal(noMatch.receipt_count, 0);

const omittedReuse = projectWorldSimulationCounterfactualLinkedExperienceReuse({
  source_phase81i_projection: phase81I,
  expected_source: { world_history: worldHistory() },
  resolver_view: buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
  }),
  linked_experience_reuse_decisions: [],
});
const omittedLineage = buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
  world_simulation_session_id: sessionId,
  turn_id: currentTurnId,
  state_revision: currentRevision,
  world_state_hash: currentWorldStateHash,
  world_history: worldHistory(),
  counterfactual_linked_experience_reentry_projections: [phase81I],
  counterfactual_linked_experience_reuse_projections: [omittedReuse],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(omittedLineage.receipt_count, 0);

// A forged Phase81J nested source cannot become selected-action lineage merely by re-hashing it.
const forged81J = clone(phase81J);
forged81J.reuse_intents[0].historical_comparison_direction = "forged_comparison";
rehash81JIntent(forged81J.reuse_intents[0]);
const forged81JRehashed = rehash81JProjection(forged81J);
assert.throws(
  () => buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentRevision,
    world_state_hash: currentWorldStateHash,
    world_history: worldHistory(),
    counterfactual_linked_experience_reentry_projections: [phase81I],
    counterfactual_linked_experience_reuse_projections: [forged81JRehashed],
    subjective_choice_commitment_receipts: choices,
  }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
);

// A forged Phase81K action relation also fails exact Phase74D/81J replay even if all local hashes are recomputed.
const forgedLineage = clone(lineage);
forgedLineage.receipts[0].action_id = "forged_action";
rehash81KReceipt(forgedLineage.receipts[0]);
forgedLineage.receipt_bundle_hash = hashAgentRunValue((() => {
  const copy = clone(forgedLineage);
  delete copy.receipt_bundle_hash;
  return copy;
})());
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(
    forgedLineage,
    {
      subjective_choice_commitment_receipts: choices,
      counterfactual_linked_experience_reentry_projections: [phase81I],
      counterfactual_linked_experience_reuse_projections: [phase81J],
      world_history: worldHistory(),
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage/);
assert.match(loopSource, /counterfactualLinkedExperienceSelectedActionLineage/);
assert.match(
  loopSource,
  /counterfactual_linked_experience_selected_action_lineage:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceSelectedActionLineage\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_selected_action_lineage:\s*\r?\n\s*input\.counterfactual_linked_experience_selected_action_lineage \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81K",
  version: worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
  exact_phase81i_81j_lineage_required: true,
  exact_phase74d_selected_action_required: true,
  nonmatching_selected_action_produces_receipt: false,
  omitted_reuse_intent_produces_receipt: false,
  rehashed_nested_phase81j_forgery_rejected: true,
  rehashed_phase81k_action_forgery_rejected: true,
  caused_selection_claimed: false,
  action_outcome_consumed: false,
  advisory_effectiveness_inferred: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81K counterfactual-linked reuse intent selected-action lineage tests passed.");
