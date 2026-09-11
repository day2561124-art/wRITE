import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-reflection-retention-service.mjs";
import {
  projectWorldSimulationCounterfactualReflectionReentry,
} from "../../server/src/world-simulation-counterfactual-reflection-reentry-service.mjs";
import {
  buildWorldSimulationCounterfactualPreparativeRevalidationResolverView,
  projectWorldSimulationCounterfactualPreparativeRevalidation,
} from "../../server/src/world-simulation-counterfactual-preparative-revalidation-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle,
  buildWorldSimulationCounterfactualPreparativeSelectedActionLineage,
  buildWorldSimulationCounterfactualPreparativeSelectedActionLineageContract,
  worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
} from "../../server/src/world-simulation-counterfactual-preparative-selected-action-lineage-service.mjs";

const sessionId = "session_phase81f";
const character = "千夜";
const currentTurnId = "turn_phase81f_current";
const currentStateRevision = 9;
const currentWorldStateHash = "world_state_hash_phase81f_current";

function clone(value) {
  return structuredClone(value);
}

function withProjectionHash(value) {
  const output = clone(value);
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

function makeRetentionProjection({
  preparativeOrientation = "future_improvement_candidate",
  comparisonDirection = "imagined_better_than_actual",
  appraisalKind = "regret_like_counterfactual_concern",
} = {}) {
  const sourceTurnId = "turn_phase81f_history";
  const sourceStateRevision = 5;
  const sourceWorldStateHash = "world_state_hash_phase81f_history";
  const candidate = {
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["slower"],
    duration_s: 3,
  };
  const identity = {
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    world_simulation_session_id: sessionId,
    source_turn_id: sourceTurnId,
    source_state_revision: sourceStateRevision,
    source_world_state_hash: sourceWorldStateHash,
    character,
    source_phase81b_appraisal_ref: `phase81b_appraisal_${sourceTurnId}`,
    source_phase81b_appraisal_hash: `phase81b_appraisal_hash_${sourceTurnId}`,
    source_phase81b_projection_hash: `phase81b_projection_hash_${sourceTurnId}`,
    source_phase81b_resolver_view_hash: `phase81b_view_hash_${sourceTurnId}`,
    source_phase81a_projection_hash: `phase81a_projection_hash_${sourceTurnId}`,
    source_phase81a_resolver_view_hash: `phase81a_view_hash_${sourceTurnId}`,
    source_phase81a_evidence_ref: `phase81a_evidence_${sourceTurnId}`,
    source_phase81a_evidence_hash: `phase81a_evidence_hash_${sourceTurnId}`,
    source_phase74d_receipt_hash: `phase74d_receipt_hash_${sourceTurnId}`,
    source_phase76a_subjective_perception_ref: `phase76a_perception_${sourceTurnId}`,
    actual_experienced_anchor: {
      selected_action_ref: `phase74a_action_actual_${sourceTurnId}`,
      selected_action_id: "direct_advance",
      subjective_perception_ref: `phase76a_perception_${sourceTurnId}`,
      subjective_experience: {
        performed: { intent: "direct advance" },
        perceived_result: { obstruction: "heavy" },
        perceived_status: "difficult",
      },
      source_kind: "experienced_subjective_outcome",
      world_truth_authority: false,
    },
    imagined_alternative_context: {
      alternative_action_ref: `phase74a_action_alt_${sourceTurnId}`,
      alternative_action_id: "covered_advance",
      decision_time_candidate: clone(candidate),
      salient_branches: [],
      salient_branch_refs: [],
      source_kind: "imagined_decision_time_possibility",
      alternative_available_at_decision_time: true,
      alternative_was_selected: false,
      alternative_outcome_observed: false,
      branches_are_subjective_possibilities_not_predictions: true,
    },
    comparison_direction: comparisonDirection,
    appraisal_kind: appraisalKind,
    preparative_orientation: preparativeOrientation,
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase81c_reflection_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    counterfactual_capsule_is_episodic_fact_memory: false,
    unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    automatic_preference_revision_performed: false,
    action_selected: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_state_mutated: false,
    same_turn_reentry_allowed: false,
  };
  return withProjectionHash({
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    phase: "Phase81C",
    world_simulation_session_id: sessionId,
    turn_id: sourceTurnId,
    state_revision: sourceStateRevision,
    world_state_hash: sourceWorldStateHash,
    source_phase81b_projection_hash: identity.source_phase81b_projection_hash,
    source_phase81b_resolver_view_hash: identity.source_phase81b_resolver_view_hash,
    source_phase81a_projection_hash: identity.source_phase81a_projection_hash,
    source_phase81a_resolver_view_hash: identity.source_phase81a_resolver_view_hash,
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81a_phase81b_lineage_verified: true,
      actual_and_imagined_sources_explicitly_separated: true,
      actual_subjective_experience_retained_as_experienced_anchor: true,
      only_phase81b_salient_branch_metadata_retained: true,
      alternative_candidate_context_retained_for_future_cue_matching: true,
      preparative_orientation_retained_as_candidate_not_policy: true,
      counterfactual_capsules_are_episodic_fact_memories: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      numeric_emotion_utility_reward_q_value_probability_modeled: false,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      failed_or_blocked_turn_persists_capsules: false,
      projection_does_not_mutate_world_state: true,
      future_reentry_requires_separate_projection: true,
    },
  });
}

function currentFixture(options = {}) {
  const retention = makeRetentionProjection(options);
  const matchedCandidate = {
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  };
  const unrelatedCandidate = {
    action_id: "hold_position",
    intent: "hold position",
    defense: { mode: "brace" },
    duration_s: 2,
  };
  const candidateActionIntents = [matchedCandidate, unrelatedCandidate];
  const cognition = {
    goals: [{ summary: "reach ally" }],
    decision_pressures: [{ kind: "protective" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidateActionIntents,
  });
  const phase81D = projectWorldSimulationCounterfactualReflectionReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidateActionIntents,
    source_phase74a_deliberation: phase74A,
    world_history: {
      version: "phase62c-world-state-v1",
      world_simulation_session_id: sessionId,
      turns: [{
        turn_id: retention.turn_id,
        revision_from: retention.state_revision,
        revision_to: retention.state_revision + 1,
        previous_state_hash: retention.world_state_hash,
        next_state_hash: `next_${retention.world_state_hash}`,
        post_outcome_counterfactual_reflection_retention: retention,
      }],
    },
  });
  return { cognition, candidateActionIntents, matchedCandidate, unrelatedCandidate, phase81D };
}

function phase81EFromFixture(fixture, applicabilityJudgment) {
  const view = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
    source_phase81d_projection: fixture.phase81D,
  });
  assert.equal(view.preparative_revalidation_candidates.length, 1);
  const candidate = view.preparative_revalidation_candidates[0];
  const decisions = [{
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    applicability_judgment: applicabilityJudgment,
    retain_matched_current_cue_refs: [candidate.exact_current_cue_matches[0].current_cue_ref],
    address_historical_difference_cue_refs:
      candidate.historical_context_differences.length > 0
        ? [candidate.historical_context_differences[0].historical_difference_cue_ref]
        : [],
    incorporate_current_additional_cue_refs: [],
  }];
  return projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: fixture.phase81D,
    resolver_view: view,
    preparative_revalidation_decisions: decisions,
  });
}

function choiceBundle(fixture, selectedActionId) {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentStateRevision,
    world_state_hash: currentWorldStateHash,
    decision_packets: [{
      character,
      cognition: fixture.cognition,
      candidate_action_intents: fixture.candidateActionIntents,
    }],
    selected_action_intents: [{
      character,
      selection: selectedActionId === null ? "reject_all" : "candidate_action_intent",
      action_id: selectedActionId,
    }],
  });
}

function buildLineage(fixture, phase81E, choices) {
  return buildWorldSimulationCounterfactualPreparativeSelectedActionLineage({
    world_simulation_session_id: sessionId,
    turn_id: currentTurnId,
    state_revision: currentStateRevision,
    world_state_hash: currentWorldStateHash,
    counterfactual_reflection_reentry_projections: [fixture.phase81D],
    counterfactual_preparative_revalidation_projections: [phase81E],
    subjective_choice_commitment_receipts: choices,
  });
}

const contract = buildWorldSimulationCounterfactualPreparativeSelectedActionLineageContract();
assert.equal(contract.phase, "Phase81F");
assert.equal(contract.source_revalidation_owner, "Phase81E");
assert.equal(contract.source_choice_owner, "Phase74D");
assert.equal(contract.exact_phase81d_phase81e_lineage_required, true);
assert.equal(contract.exact_phase74d_choice_receipt_required, true);
assert.equal(contract.lineage_records_selection_relation_only, true);
assert.equal(contract.counterfactual_advisory_caused_selection_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.outcome_credit_assigned, false);
assert.equal(contract.success_failure_learning_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const fixture = currentFixture();
assert.equal(fixture.phase81D.reentry_candidate_count, 1);

for (const [applicabilityJudgment, expectedRelation] of [
  [
    "currently_applicable_as_deliberative_evidence",
    "selected_action_matches_currently_applicable_counterfactual_advisory",
  ],
  [
    "currently_not_applicable_as_deliberative_evidence",
    "selected_action_matches_currently_nonapplicable_counterfactual_advisory",
  ],
  [
    "current_applicability_unresolved",
    "selected_action_matches_unresolved_counterfactual_advisory",
  ],
]) {
  const phase81E = phase81EFromFixture(fixture, applicabilityJudgment);
  const choices = choiceBundle(fixture, fixture.matchedCandidate.action_id);
  const lineage = buildLineage(fixture, phase81E, choices);
  assert.equal(lineage.version, worldSimulationCounterfactualPreparativeSelectedActionLineageVersion);
  assert.equal(lineage.phase, "Phase81F");
  assert.equal(lineage.receipt_count, 1);
  const receipt = lineage.receipts[0];
  assert.equal(receipt.action_id, fixture.matchedCandidate.action_id);
  assert.equal(receipt.applicability_judgment, applicabilityJudgment);
  assert.equal(receipt.selection_relation, expectedRelation);
  assert.equal(receipt.selected_action_matches_phase81e_current_action, true);
  assert.equal(receipt.lineage_records_selection_relation_only, true);
  assert.equal(receipt.counterfactual_advisory_caused_selection_claimed, false);
  assert.equal(receipt.counterfactual_caused_candidate_generation_claimed, false);
  assert.equal(receipt.historical_alternative_was_experienced, false);
  assert.equal(receipt.historical_unchosen_outcome_observed, false);
  assert.equal(receipt.action_outcome_observed, false);
  assert.equal(receipt.outcome_credit_assigned, false);
  assert.equal(receipt.success_failure_learning_performed, false);
  assert.equal(receipt.preference_revision_performed, false);
  assert.equal(receipt.belief_revision_performed, false);
  assert.equal(receipt.semantic_revision_performed, false);
  assert.equal(receipt.subjective_memory_rewrite_performed, false);
  assert.equal(receipt.world_state_mutated, false);
  assert.equal(receipt.world_truth_authority, false);
  assert.doesNotThrow(() =>
    assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(lineage, {
      world_simulation_session_id: sessionId,
      turn_id: currentTurnId,
      state_revision: currentStateRevision,
      world_state_hash: currentWorldStateHash,
      subjective_choice_commitment_receipts: choices,
      counterfactual_reflection_reentry_projections: [fixture.phase81D],
      counterfactual_preparative_revalidation_projections: [phase81E],
    }));
}

const applicablePhase81E = phase81EFromFixture(
  fixture,
  "currently_applicable_as_deliberative_evidence",
);
const unrelatedChoice = choiceBundle(fixture, fixture.unrelatedCandidate.action_id);
const unrelatedLineage = buildLineage(fixture, applicablePhase81E, unrelatedChoice);
assert.equal(unrelatedLineage.receipt_count, 0);

const rejectAll = choiceBundle(fixture, null);
const rejectAllLineage = buildLineage(fixture, applicablePhase81E, rejectAll);
assert.equal(rejectAllLineage.receipt_count, 0);

// A self-consistent forged Phase81F receipt must still fail when exact Phase81E
// and Phase74D sources are supplied to the downstream validator.
const selectedChoices = choiceBundle(fixture, fixture.matchedCandidate.action_id);
const canonicalLineage = buildLineage(fixture, applicablePhase81E, selectedChoices);
const forged = clone(canonicalLineage);
forged.receipts[0].historical_imagined_alternative_action_id = "forged_alternative";
const forgedIdentity = clone(forged.receipts[0]);
for (const key of [
  "receipt_id",
  "receipt_hash",
  "selected_action_matches_phase81e_current_action",
  "lineage_records_selection_relation_only",
  "counterfactual_advisory_caused_selection_claimed",
  "counterfactual_caused_candidate_generation_claimed",
  "historical_alternative_was_experienced",
  "historical_unchosen_outcome_observed",
  "counterfactual_world_truth_claimed",
  "action_outcome_observed",
  "outcome_credit_assigned",
  "success_failure_learning_performed",
  "preference_revision_performed",
  "belief_revision_performed",
  "semantic_revision_performed",
  "subjective_memory_rewrite_performed",
  "world_state_mutated",
  "world_truth_authority",
]) delete forgedIdentity[key];
const forgedReceiptHash = hashAgentRunValue(forgedIdentity);
forged.receipts[0].receipt_hash = forgedReceiptHash;
forged.receipts[0].receipt_id = `phase81f_selected_relation_${forgedReceiptHash.slice(0, 24)}`;
delete forged.receipt_bundle_hash;
forged.receipt_bundle_hash = hashAgentRunValue(forged);
assert.throws(
  () => assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(forged, {
    subjective_choice_commitment_receipts: selectedChoices,
    counterfactual_reflection_reentry_projections: [fixture.phase81D],
    counterfactual_preparative_revalidation_projections: [applicablePhase81E],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  loopSource,
  /buildWorldSimulationCounterfactualPreparativeSelectedActionLineage\(/,
);
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81FBuildIndex = resolveSource.indexOf(
  "buildWorldSimulationCounterfactualPreparativeSelectedActionLineage({",
);
const phase74DReceiptIndex = resolveSource.indexOf(
  "const subjectiveChoiceCommitmentReceipts =",
);
const causalResolutionIndex = resolveSource.indexOf(
  "const causalResolution = assertCausalResolution(await causalAdjudicator({",
);
assert.ok(resolveStart >= 0);
assert.ok(phase74DReceiptIndex >= 0);
assert.ok(phase81FBuildIndex > phase74DReceiptIndex);
assert.ok(causalResolutionIndex > phase81FBuildIndex);
assert.match(
  loopSource,
  /counterfactual_preparative_selected_action_lineage:\s*\r?\n\s*cloneJson\(counterfactualPreparativeSelectedActionLineage\)/,
);
assert.match(
  stateSource,
  /counterfactual_preparative_selected_action_lineage:\s*\r?\n\s*input\.counterfactual_preparative_selected_action_lineage \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81F",
  version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
  all_applicability_judgments_preserved: true,
  selected_action_exact_match_required: true,
  counterfactual_caused_selection_claimed: false,
  action_outcome_consumed: false,
  outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81F counterfactual advisory-to-selected-action lineage tests passed.");
