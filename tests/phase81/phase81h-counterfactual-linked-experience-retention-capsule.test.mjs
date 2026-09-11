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
  buildWorldSimulationCounterfactualPreparativeSelectedActionLineage,
} from "../../server/src/world-simulation-counterfactual-preparative-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence,
} from "../../server/src/world-simulation-counterfactual-selected-action-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules,
  buildWorldSimulationCounterfactualLinkedExperienceRetentionCapsules,
  buildWorldSimulationCounterfactualLinkedExperienceRetentionContract,
  worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-retention-capsule-service.mjs";

const sessionId = "session_phase81h";
const character = "千夜";
const turnId = "turn_phase81h_current";
const stateRevision = 14;
const worldStateHash = "world_state_hash_phase81h_current";

function clone(value) {
  return structuredClone(value);
}

function withProjectionHash(value) {
  const output = clone(value);
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

function makeRetentionProjection() {
  const sourceTurnId = "turn_phase81h_history";
  const sourceStateRevision = 8;
  const sourceWorldStateHash = "world_state_hash_phase81h_history";
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
        performed: true,
        perceived_result: "heavy_obstruction",
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
    comparison_direction: "imagined_better_than_actual",
    appraisal_kind: "regret_like_counterfactual_concern",
    preparative_orientation: "future_improvement_candidate",
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

function currentFixture() {
  const retention = makeRetentionProjection();
  const matchedCandidate = {
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  };
  const candidateActionIntents = [
    matchedCandidate,
    {
      action_id: "hold_position",
      intent: "hold position",
      defense: { mode: "brace" },
      duration_s: 2,
    },
  ];
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
    current_turn_id: turnId,
    current_state_revision: stateRevision,
    current_world_state_hash: worldStateHash,
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
  const view81E = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
    source_phase81d_projection: phase81D,
  });
  assert.equal(view81E.preparative_revalidation_candidates.length, 1);
  const reentry = view81E.preparative_revalidation_candidates[0];
  const phase81E = projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: phase81D,
    resolver_view: view81E,
    preparative_revalidation_decisions: [{
      reentry_candidate_ref: reentry.reentry_candidate_ref,
      applicability_judgment: "currently_applicable_as_deliberative_evidence",
      retain_matched_current_cue_refs: [reentry.exact_current_cue_matches[0].current_cue_ref],
      address_historical_difference_cue_refs:
        reentry.historical_context_differences.length > 0
          ? [reentry.historical_context_differences[0].historical_difference_cue_ref]
          : [],
      incorporate_current_additional_cue_refs:
        reentry.current_context_additions.length > 0
          ? [reentry.current_context_additions[0].current_additional_cue_ref]
          : [],
    }],
  });
  const choices = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [{
      character,
      cognition,
      candidate_action_intents: candidateActionIntents,
    }],
    selected_action_intents: [{
      character,
      selection: "candidate_action_intent",
      action_id: matchedCandidate.action_id,
    }],
  });
  const phase81F = buildWorldSimulationCounterfactualPreparativeSelectedActionLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    counterfactual_reflection_reentry_projections: [phase81D],
    counterfactual_preparative_revalidation_projections: [phase81E],
    subjective_choice_commitment_receipts: choices,
  });
  const experienceIdentity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: turnId,
    character,
    action_id: matchedCandidate.action_id,
    experience: {
      action_id: matchedCandidate.action_id,
      performed: true,
      perceived_result: "reached_cover",
      perceived_status: "stable_after_move",
    },
    source_outcome_hashes: ["bounded_outcome_hash_phase81h"],
    source_transition_hashes: ["bounded_transition_hash_phase81h"],
  };
  const perception = {
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
  const phase76A = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    phase: "Phase76A",
    status: "bounded_post_outcome_subjective_perception_available",
    turn_id: turnId,
    character_experiences: [perception],
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
  phase76A.projection_hash = hashAgentRunValue(phase76A);
  const phase81G = buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    counterfactual_preparative_selected_action_lineage: phase81F,
    post_outcome_subjective_perception_projection: phase76A,
  });
  return { phase81D, phase81E, phase81G, matchedCandidate };
}

function rehashCapsule(capsule) {
  const output = clone(capsule);
  const identity = clone(output);
  for (const key of [
    "capsule_ref", "capsule_hash",
    "current_selected_action_subjective_outcome_observed",
    "historical_imagined_alternative_was_experienced",
    "historical_unchosen_outcome_observed",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_current_outcome",
    "counterfactual_advisory_effectiveness_inferred",
    "success_failure_interpretation_performed", "outcome_credit_assigned",
    "preference_revision_performed", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed",
    "counterfactual_linked_capsule_is_episodic_fact_memory",
    "same_turn_reentry_allowed", "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  output.capsule_hash = hash;
  output.capsule_ref = `phase81h_retention_${hash.slice(0, 24)}`;
  return output;
}

function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceRetentionContract();
assert.equal(contract.phase, "Phase81H");
assert.equal(contract.source_outcome_evidence_owner, "Phase81G");
assert.equal(contract.source_revalidation_owner, "Phase81E");
assert.equal(contract.source_reentry_owner, "Phase81D");
assert.equal(contract.historical_imagined_alternative_and_current_experience_sources_separated, true);
assert.equal(contract.historical_counterfactual_truth_evaluated, false);
assert.equal(contract.counterfactual_advisory_effectiveness_inferred, false);
assert.equal(contract.same_turn_reentry_allowed, false);

const fixture = currentFixture();
const retained = buildWorldSimulationCounterfactualLinkedExperienceRetentionCapsules({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  counterfactual_selected_action_outcome_evidence: fixture.phase81G,
  counterfactual_reflection_reentry_projections: [fixture.phase81D],
  counterfactual_preparative_revalidation_projections: [fixture.phase81E],
});
assert.equal(retained.version, worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion);
assert.equal(retained.phase, "Phase81H");
assert.equal(retained.capsule_count, 1);
const capsule = retained.capsules[0];
assert.equal(capsule.current_action_id, fixture.matchedCandidate.action_id);
assert.ok(capsule.current_context_cue_signatures.length >= 1);
assert.equal(capsule.current_context_cue_signatures.some((item) => item.action_defining), true);
assert.deepEqual(capsule.current_selected_action_subjective_experience, {
  action_id: fixture.matchedCandidate.action_id,
  performed: true,
  perceived_result: "reached_cover",
  perceived_status: "stable_after_move",
});
assert.equal(capsule.current_selected_action_subjective_outcome_observed, true);
assert.equal(capsule.historical_imagined_alternative_was_experienced, false);
assert.equal(capsule.historical_unchosen_outcome_observed, false);
assert.equal(capsule.historical_counterfactual_truth_evaluated, false);
assert.equal(capsule.historical_counterfactual_validated_by_current_outcome, false);
assert.equal(capsule.counterfactual_advisory_effectiveness_inferred, false);
assert.equal(capsule.success_failure_interpretation_performed, false);
assert.equal(capsule.outcome_credit_assigned, false);
assert.equal(capsule.counterfactual_linked_capsule_is_episodic_fact_memory, false);
assert.equal(capsule.same_turn_reentry_allowed, false);
assert.equal(capsule.source_monitoring.sources_may_not_be_collapsed, true);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(retained, {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    counterfactual_selected_action_outcome_evidence: fixture.phase81G,
    counterfactual_reflection_reentry_projections: [fixture.phase81D],
    counterfactual_preparative_revalidation_projections: [fixture.phase81E],
  }));

const forgedCue = clone(retained);
forgedCue.capsules[0].current_context_cue_signatures[0].cue_content_hash = "forged_cue_hash";
forgedCue.capsules[0] = rehashCapsule(forgedCue.capsules[0]);
const forgedCueProjection = rehashProjection(forgedCue);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(
    forgedCueProjection,
    {
      counterfactual_selected_action_outcome_evidence: fixture.phase81G,
      counterfactual_reflection_reentry_projections: [fixture.phase81D],
      counterfactual_preparative_revalidation_projections: [fixture.phase81E],
    },
  ),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
);

const forgedOutcome = clone(retained);
forgedOutcome.capsules[0].current_selected_action_subjective_experience.perceived_result = "invented_result";
forgedOutcome.capsules[0] = rehashCapsule(forgedOutcome.capsules[0]);
const forgedOutcomeProjection = rehashProjection(forgedOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(
    forgedOutcomeProjection,
    {
      counterfactual_selected_action_outcome_evidence: fixture.phase81G,
      counterfactual_reflection_reentry_projections: [fixture.phase81D],
      counterfactual_preparative_revalidation_projections: [fixture.phase81E],
    },
  ),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const resolveStart = loopSource.indexOf("export async function resolveWorldSimulationTurn(");
const resolveSource = loopSource.slice(resolveStart);
const phase81GIndex = resolveSource.indexOf("const counterfactualSelectedActionOutcomeEvidence =");
const phase81HIndex = resolveSource.indexOf("const counterfactualLinkedExperienceRetention =");
assert.ok(resolveStart >= 0);
assert.ok(phase81GIndex >= 0);
assert.ok(phase81HIndex > phase81GIndex);
assert.match(
  loopSource,
  /counterfactual_linked_experience_retention:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceRetention\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_retention:\s*\r?\n\s*input\.counterfactual_linked_experience_retention \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81H",
  version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
  exact_phase81d_81e_81g_lineage_required: true,
  hash_level_current_context_signatures_retained: true,
  current_subjective_outcome_retained: true,
  historical_counterfactual_truth_evaluated: false,
  advisory_effectiveness_inferred: false,
  same_turn_reentry_allowed: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81H counterfactual-linked experience retention capsule tests passed.");
