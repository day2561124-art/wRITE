import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle,
  worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
} from "../../server/src/world-simulation-counterfactual-preparative-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence,
  buildWorldSimulationCounterfactualSelectedActionOutcomeEvidenceContract,
  worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-counterfactual-selected-action-outcome-evidence-service.mjs";

const sessionId = "session_phase81g";
const turnId = "turn_phase81g";
const stateRevision = 12;
const worldStateHash = "world_state_hash_phase81g";
const character = "千夜";
const actionId = "current_covered_advance";
const actionRef = "phase74a_action_current_covered_advance";

function clone(value) {
  return structuredClone(value);
}

function buildPhase81FBundle() {
  const identity = {
    version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    phase81e_projection_hash: "phase81e_projection_hash_phase81g",
    source_phase81d_projection_hash: "phase81d_projection_hash_phase81g",
    revalidation_judgment_ref: "phase81e_revalidation_phase81g",
    revalidation_judgment_hash: "phase81e_revalidation_hash_phase81g",
    source_reentry_candidate_ref: "phase81d_reentry_candidate_phase81g",
    source_reentry_candidate_hash: "phase81d_reentry_candidate_hash_phase81g",
    historical_actual_selected_action_id: "direct_advance",
    historical_imagined_alternative_action_id: "covered_advance",
    historical_comparison_direction: "imagined_better_than_actual",
    historical_appraisal_kind: "regret_like_counterfactual_concern",
    historical_preparative_orientation: "future_improvement_candidate",
    applicability_judgment: "currently_applicable_as_deliberative_evidence",
    selection_relation: "selected_action_matches_currently_applicable_counterfactual_advisory",
    phase74d_choice_receipt_version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    phase74d_choice_receipt_id: "phase74d_receipt_phase81g",
    phase74d_choice_receipt_hash: "phase74d_receipt_hash_phase81g",
    selection_kind: "candidate_action_intent",
    action_id: actionId,
    action_ref: actionRef,
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      sources_may_not_be_collapsed: true,
    },
  };
  const receiptHash = hashAgentRunValue(identity);
  const receipt = {
    receipt_id: `phase81f_selected_relation_${receiptHash.slice(0, 24)}`,
    receipt_hash: receiptHash,
    ...identity,
    selected_action_matches_phase81e_current_action: true,
    lineage_records_selection_relation_only: true,
    counterfactual_advisory_caused_selection_claimed: false,
    counterfactual_caused_candidate_generation_claimed: false,
    historical_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    action_outcome_observed: false,
    outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_state_mutated: false,
    world_truth_authority: false,
  };
  const bundle = {
    version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
    phase: "Phase81F",
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: "phase74d_receipt_bundle_hash_phase81g",
    source_phase81e_projection_hashes: [identity.phase81e_projection_hash],
    receipt_count: 1,
    receipts: [receipt],
    audit: {
      exact_phase81d_phase81e_lineage_verified: true,
      exact_phase74d_selected_action_lineage_verified: true,
      lineage_records_selection_relation_only: true,
      counterfactual_advisory_caused_selection_claimed: false,
      historical_alternative_experienced: false,
      unchosen_outcome_observed: false,
      action_outcome_consumed: false,
      outcome_credit_assigned: false,
      success_failure_learning_performed: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_only: true,
      receipt_does_not_mutate_world_state: true,
      future_outcome_interpretation_requires_separate_phase: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(bundle, {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  });
}

function buildPhase76A({
  experienceActionId = actionId,
  experienceCharacter = character,
  experience = {
    action_id: actionId,
    performed: true,
    perceived_result: "reached_cover",
    perceived_status: "stable_after_move",
  },
} = {}) {
  const normalizedExperience = {
    ...clone(experience),
    action_id: experienceActionId,
  };
  const experienceIdentity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: turnId,
    character: experienceCharacter,
    action_id: experienceActionId,
    experience: normalizedExperience,
    source_outcome_hashes: ["bounded_outcome_hash_phase81g"],
    source_transition_hashes: ["bounded_transition_hash_phase81g"],
  };
  const experienceRecord = {
    subjective_perception_ref:
      `phase76a_post_outcome_${hashAgentRunValue(experienceIdentity).slice(0, 24)}`,
    ...experienceIdentity,
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
    character_experiences: [experienceRecord],
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

function rehashEvidenceRecord(record) {
  const output = clone(record);
  const identity = clone(output);
  for (const key of [
    "evidence_ref",
    "evidence_hash",
    "selected_action_subjective_outcome_observed",
    "historical_imagined_alternative_was_experienced",
    "historical_unchosen_outcome_observed",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome",
    "counterfactual_advisory_effectiveness_inferred",
    "counterfactual_advisory_caused_selection_claimed",
    "success_failure_interpretation_performed",
    "outcome_credit_assigned",
    "preference_revision_performed",
    "belief_revision_performed",
    "semantic_revision_performed",
    "subjective_memory_rewrite_performed",
    "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const evidenceHash = hashAgentRunValue(identity);
  output.evidence_hash = evidenceHash;
  output.evidence_ref = `phase81g_outcome_evidence_${evidenceHash.slice(0, 24)}`;
  return output;
}

function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract = buildWorldSimulationCounterfactualSelectedActionOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase81G");
assert.equal(contract.source_selected_action_lineage_owner, "Phase81F");
assert.equal(contract.source_subjective_outcome_owner, "Phase76A");
assert.equal(contract.historical_imagined_alternative_outcome_observed, false);
assert.equal(contract.historical_counterfactual_truth_evaluated, false);
assert.equal(contract.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(contract.counterfactual_advisory_effectiveness_inferred, false);
assert.equal(contract.success_failure_interpretation_performed, false);
assert.equal(contract.outcome_credit_assigned, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase81F = buildPhase81FBundle();
const phase76A = buildPhase76A();
const evidence = buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  counterfactual_preparative_selected_action_lineage: phase81F,
  post_outcome_subjective_perception_projection: phase76A,
});
assert.equal(evidence.version, worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion);
assert.equal(evidence.phase, "Phase81G");
assert.equal(evidence.evidence_count, 1);
const record = evidence.evidence_records[0];
assert.equal(record.character, character);
assert.equal(record.action_id, actionId);
assert.equal(record.action_ref, actionRef);
assert.deepEqual(record.selected_action_subjective_experience, {
  action_id: actionId,
  performed: true,
  perceived_result: "reached_cover",
  perceived_status: "stable_after_move",
});
assert.equal(record.selected_action_subjective_outcome_observed, true);
assert.equal(record.historical_imagined_alternative_was_experienced, false);
assert.equal(record.historical_unchosen_outcome_observed, false);
assert.equal(record.historical_counterfactual_truth_evaluated, false);
assert.equal(record.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(record.counterfactual_advisory_effectiveness_inferred, false);
assert.equal(record.counterfactual_advisory_caused_selection_claimed, false);
assert.equal(record.success_failure_interpretation_performed, false);
assert.equal(record.outcome_credit_assigned, false);
assert.equal(record.preference_revision_performed, false);
assert.equal(record.belief_revision_performed, false);
assert.equal(record.semantic_revision_performed, false);
assert.equal(record.subjective_memory_rewrite_performed, false);
assert.equal(record.world_state_mutated, false);
assert.equal(record.world_truth_authority, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(evidence, {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    counterfactual_preparative_selected_action_lineage: phase81F,
    post_outcome_subjective_perception_projection: phase76A,
  }));

// A Phase76A experience for another selected action does not become evidence for
// this counterfactual-linked action merely because it belongs to the same turn.
const differentActionPhase76A = buildPhase76A({
  experienceActionId: "hold_position",
  experience: {
    action_id: "hold_position",
    performed: true,
    perceived_result: "held_ground",
    perceived_status: "stable",
  },
});
const noActionMatch = buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  counterfactual_preparative_selected_action_lineage: phase81F,
  post_outcome_subjective_perception_projection: differentActionPhase76A,
});
assert.equal(noActionMatch.evidence_count, 0);

const differentCharacterPhase76A = buildPhase76A({ experienceCharacter: "另一角色" });
const noCharacterMatch = buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  counterfactual_preparative_selected_action_lineage: phase81F,
  post_outcome_subjective_perception_projection: differentCharacterPhase76A,
});
assert.equal(noCharacterMatch.evidence_count, 0);

// Even if an attacker changes a nested 81F-derived field in Phase81G and
// recomputes both the record and projection hashes, exact-source validation must
// still reject it against the canonical Phase81F and Phase76A sources.
const forgedLineage = clone(evidence);
forgedLineage.evidence_records[0].action_ref = "forged_action_ref";
forgedLineage.evidence_records[0] = rehashEvidenceRecord(forgedLineage.evidence_records[0]);
const forgedLineageProjection = rehashProjection(forgedLineage);
assert.throws(
  () => assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(
    forgedLineageProjection,
    {
      counterfactual_preparative_selected_action_lineage: phase81F,
      post_outcome_subjective_perception_projection: phase76A,
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

// The same protection applies if the copied subjective experience is altered
// and all Phase81G-local hashes are recomputed.
const forgedExperience = clone(evidence);
forgedExperience.evidence_records[0].selected_action_subjective_experience.perceived_result =
  "invented_better_result";
forgedExperience.evidence_records[0] = rehashEvidenceRecord(forgedExperience.evidence_records[0]);
const forgedExperienceProjection = rehashProjection(forgedExperience);
assert.throws(
  () => assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(
    forgedExperienceProjection,
    {
      counterfactual_preparative_selected_action_lineage: phase81F,
      post_outcome_subjective_perception_projection: phase76A,
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81FIndex = resolveSource.indexOf(
  "const counterfactualPreparativeSelectedActionLineage =",
);
const causalResolutionIndex = resolveSource.indexOf(
  "const causalResolution = assertCausalResolution(await causalAdjudicator({",
);
const phase76AIndex = resolveSource.indexOf(
  "const postOutcomeSubjectivePerceptionProjection =",
);
const phase81GIndex = resolveSource.indexOf(
  "const counterfactualSelectedActionOutcomeEvidence =",
);
assert.ok(resolveStart >= 0);
assert.ok(phase81FIndex >= 0);
assert.ok(causalResolutionIndex > phase81FIndex);
assert.ok(phase76AIndex > causalResolutionIndex);
assert.ok(phase81GIndex > phase76AIndex);
assert.match(
  loopSource,
  /counterfactual_selected_action_outcome_evidence:\s*\r?\n\s*cloneJson\(counterfactualSelectedActionOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /counterfactual_selected_action_outcome_evidence:\s*\r?\n\s*input\.counterfactual_selected_action_outcome_evidence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81G",
  version: worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
  exact_phase81f_lineage_required: true,
  exact_phase76a_subjective_outcome_required: true,
  selected_action_subjective_outcome_observed: true,
  historical_counterfactual_truth_evaluated: false,
  historical_counterfactual_validated_by_current_outcome: false,
  advisory_effectiveness_inferred: false,
  success_failure_interpretation_performed: false,
  outcome_credit_assigned: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81G selected counterfactual-linked action subjective outcome evidence tests passed.");
