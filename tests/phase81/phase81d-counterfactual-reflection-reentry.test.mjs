import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-reflection-retention-service.mjs";
import {
  assertWorldSimulationCounterfactualReflectionReentryProjection,
  buildWorldSimulationCounterfactualReflectionReentryContract,
  projectWorldSimulationCounterfactualReflectionReentry,
  worldSimulationCounterfactualReflectionReentryVersion,
} from "../../server/src/world-simulation-counterfactual-reflection-reentry-service.mjs";

const sessionId = "session_phase81d";
const character = "千夜";
const currentTurnId = "turn_phase81d_current";
const currentStateRevision = 8;
const currentWorldStateHash = "world_state_hash_phase81d_current";

function clone(value) {
  return structuredClone(value);
}

function withProjectionHash(value) {
  const output = clone(value);
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

function makeCapsule({
  sourceTurnId = "turn_phase81d_history",
  sourceStateRevision = 5,
  sourceWorldStateHash = "world_state_hash_phase81d_history",
  capsuleCharacter = character,
  candidate = {
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["slower"],
    duration_s: 3,
  },
  comparisonDirection = "imagined_better_than_actual",
  appraisalKind = "regret_like_counterfactual_concern",
  preparativeOrientation = "future_improvement_candidate",
} = {}) {
  const identity = {
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    world_simulation_session_id: sessionId,
    source_turn_id: sourceTurnId,
    source_state_revision: sourceStateRevision,
    source_world_state_hash: sourceWorldStateHash,
    character: capsuleCharacter,
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
  return {
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
}

function makeRetentionProjection(options = {}) {
  const capsule = makeCapsule(options);
  return withProjectionHash({
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    phase: "Phase81C",
    world_simulation_session_id: sessionId,
    turn_id: capsule.source_turn_id,
    state_revision: capsule.source_state_revision,
    world_state_hash: capsule.source_world_state_hash,
    source_phase81b_projection_hash: capsule.source_phase81b_projection_hash,
    source_phase81b_resolver_view_hash: capsule.source_phase81b_resolver_view_hash,
    source_phase81a_projection_hash: capsule.source_phase81a_projection_hash,
    source_phase81a_resolver_view_hash: capsule.source_phase81a_resolver_view_hash,
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

function makeHistory(projections = [makeRetentionProjection()]) {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: projections.map((projection, index) => ({
      turn_id: projection.turn_id,
      revision_from: projection.state_revision,
      revision_to: projection.state_revision + 1,
      previous_state_hash: projection.world_state_hash,
      next_state_hash: `next_${projection.world_state_hash}`,
      post_outcome_counterfactual_reflection_retention: projection,
      order: index,
    })),
  };
}

function makeCurrent({
  candidate = {
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  },
} = {}) {
  const cognition = {
    goals: [{ summary: "reach ally" }],
    decision_pressures: [{ kind: "protective" }],
    working_context: { focus: "safe approach" },
  };
  const candidates = [candidate];
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return { cognition, candidates, phase74A };
}

function project({ history = makeHistory(), current = makeCurrent() } = {}) {
  return projectWorldSimulationCounterfactualReflectionReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: current.cognition,
    current_candidate_action_intents: current.candidates,
    source_phase74a_deliberation: current.phase74A,
    world_history: history,
  });
}

const contract = buildWorldSimulationCounterfactualReflectionReentryContract();
assert.equal(contract.phase, "Phase81D");
assert.equal(contract.same_character_prior_committed_turns_only, true);
assert.equal(contract.same_turn_feedback_allowed, false);
assert.equal(contract.exact_phase81c_capsule_hash_and_lineage_required, true);
assert.equal(contract.exact_current_phase74a_deliberation_required, true);
assert.equal(contract.exact_action_defining_cue_overlap_required, true);
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);
assert.equal(contract.prior_counterfactual_is_episodic_fact_memory, false);
assert.equal(contract.unchosen_outcome_observed, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.belief_revision_performed, false);
assert.equal(contract.direct_world_state_mutation_allowed, false);

const projection = project();
assert.equal(projection.version, worldSimulationCounterfactualReflectionReentryVersion);
assert.equal(projection.phase, "Phase81D");
assert.equal(projection.reentry_candidate_count, 1);
assert.equal(projection.same_character_retention_capsule_count_scanned, 1);
const candidate = projection.reentry_candidates[0];
assert.equal(candidate.current_action_id, "current_covered_advance");
assert.equal(candidate.action_defining_exact_match_present, true);
assert.ok(candidate.exact_current_cue_match_count >= 2);
assert.ok(candidate.exact_current_cue_matches.some((match) => match.cue_kind === "action_candidate.intent"));
assert.ok(candidate.exact_current_cue_matches.some((match) => match.cue_kind === "action_candidate.movement"));
assert.equal(candidate.historical_comparison_direction, "imagined_better_than_actual");
assert.equal(candidate.historical_appraisal_kind, "regret_like_counterfactual_concern");
assert.equal(candidate.historical_preparative_orientation, "future_improvement_candidate");
assert.equal(candidate.historical_counterfactual_is_candidate_evidence_only, true);
assert.equal(candidate.historical_counterfactual_is_episodic_fact_memory, false);
assert.equal(candidate.historical_alternative_was_experienced, false);
assert.equal(candidate.historical_unchosen_outcome_observed, false);
assert.equal(candidate.historical_counterfactual_world_truth, false);
assert.equal(candidate.causal_superiority_inferred, false);
assert.equal(candidate.automatic_preference_revision_performed, false);
assert.equal(candidate.action_selected, false);
assert.equal(candidate.belief_revision_performed, false);
assert.equal(candidate.semantic_revision_performed, false);
assert.equal(candidate.subjective_memory_rewrite_performed, false);
assert.equal(candidate.world_state_mutated, false);
assert.equal(candidate.resolver_used, false);
assert.equal(candidate.world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationCounterfactualReflectionReentryProjection(projection, {
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
}));

const constraintOnlyHistory = makeHistory([makeRetentionProjection({
  candidate: {
    intent: "historically unrelated action",
    movement: { mode: "retreat" },
    known_costs: ["shared_cost"],
    duration_s: 4,
  },
})]);
const constraintOnlyCurrent = makeCurrent({
  candidate: {
    action_id: "constraint_only",
    intent: "different current action",
    movement: { mode: "advance" },
    known_costs: ["shared_cost"],
    duration_s: 4,
  },
});
assert.equal(project({ history: constraintOnlyHistory, current: constraintOnlyCurrent }).reentry_candidate_count, 0);

const semanticallySimilarCurrent = makeCurrent({
  candidate: {
    action_id: "semantic_only",
    intent: "advance while staying behind protection",
    movement: { mode: "advance", cover: "different_wall" },
  },
});
assert.equal(project({ current: semanticallySimilarCurrent }).reentry_candidate_count, 0);

const otherCharacterHistory = makeHistory([makeRetentionProjection({ capsuleCharacter: "另一人" })]);
assert.equal(project({ history: otherCharacterHistory }).reentry_candidate_count, 0);

const sameTurnProjection = makeRetentionProjection({
  sourceTurnId: currentTurnId,
  sourceStateRevision: currentStateRevision,
  sourceWorldStateHash: currentWorldStateHash,
});
const sameTurnResult = project({ history: makeHistory([sameTurnProjection]) });
assert.equal(sameTurnResult.reentry_candidate_count, 0);
assert.equal(sameTurnResult.history_window.total_prior_committed_turn_count, 0);

const tamperedHistory = makeHistory();
tamperedHistory.turns[0].post_outcome_counterfactual_reflection_retention
  .capsules[0].imagined_alternative_context.decision_time_candidate.intent = "tampered";
assert.throws(
  () => project({ history: tamperedHistory }),
  (error) => [
    "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_INVALID",
    "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_CAPSULE_HASH_MISMATCH",
  ].includes(error?.code),
);

const tamperedCurrent = makeCurrent();
tamperedCurrent.phase74A.action_options[0].action_ref = "tampered_action_ref";
assert.throws(
  () => project({ current: tamperedCurrent }),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_PHASE74A_INVALID",
);

const privateCurrent = makeCurrent({
  candidate: {
    action_id: "private_current",
    intent: "approach using cover",
    movement: {
      mode: "advance",
      cover: "left_wall",
      engine_target_id: "must_not_reenter",
      world_state: { hidden: true },
    },
  },
});
const privateProjection = project({ current: privateCurrent });
assert.equal(privateProjection.reentry_candidate_count, 1);
const privateText = JSON.stringify(privateProjection.reentry_candidates[0]);
assert.equal(privateText.includes("must_not_reenter"), false);
assert.equal(privateText.includes('"world_state"'), false);

const tamperedProjection = clone(projection);
tamperedProjection.reentry_candidates[0].historical_counterfactual_world_truth = true;
delete tamperedProjection.projection_hash;
tamperedProjection.projection_hash = hashAgentRunValue(tamperedProjection);
assert.throws(
  () => assertWorldSimulationCounterfactualReflectionReentryProjection(tamperedProjection),
  (error) => [
    "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_INVALID",
    "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CANDIDATE_INVALID",
  ].includes(error?.code),
);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  stateSource,
  /counterfactual_reflection_reentry_projections:\s*\r?\n\s*input\.counterfactual_reflection_reentry_projections \?\? null/,
);

console.log("Phase81D cue-dependent counterfactual reflection re-entry tests passed.");
