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
  projectWorldSimulationCounterfactualReflectionReentry,
} from "../../server/src/world-simulation-counterfactual-reflection-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeRevalidationProjection,
  assertWorldSimulationCounterfactualPreparativeRevalidationResolverView,
  buildWorldSimulationCounterfactualPreparativeRevalidationContract,
  buildWorldSimulationCounterfactualPreparativeRevalidationResolverView,
  counterfactualPreparativeApplicabilityJudgments,
  projectWorldSimulationCounterfactualPreparativeRevalidation,
  worldSimulationCounterfactualPreparativeRevalidationVersion,
} from "../../server/src/world-simulation-counterfactual-preparative-revalidation-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";

const sessionId = "session_phase81e";
const character = "千夜";
const currentTurnId = "turn_phase81e_current";
const currentStateRevision = 8;
const currentWorldStateHash = "world_state_hash_phase81e_current";

function clone(value) {
  return structuredClone(value);
}

function withProjectionHash(value) {
  const output = clone(value);
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

function rehashPhase81EJudgment(judgment) {
  const identity = clone(judgment);
  for (const key of [
    "revalidation_judgment_ref",
    "revalidation_judgment_hash",
    "historical_counterfactual_is_candidate_evidence_only",
    "historical_alternative_was_experienced",
    "historical_unchosen_outcome_observed",
    "historical_counterfactual_world_truth",
    "causal_superiority_inferred",
    "applicability_is_subjective_deliberative_relevance_not_world_truth",
    "preference_revision_performed",
    "action_selected",
    "belief_revision_performed",
    "semantic_revision_performed",
    "subjective_memory_rewrite_performed",
    "world_state_mutated",
    "world_truth_authority",
  ]) delete identity[key];
  const judgmentHash = hashAgentRunValue(identity);
  judgment.revalidation_judgment_hash = judgmentHash;
  judgment.revalidation_judgment_ref =
    `phase81e_revalidation_${judgmentHash.slice(0, 24)}`;
}

function rehashPhase81EProjection(value) {
  const projection = clone(value);
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

function makeRetentionProjection({
  preparativeOrientation = "future_improvement_candidate",
  candidate = {
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["slower"],
    duration_s: 3,
  },
} = {}) {
  const sourceTurnId = "turn_phase81e_history";
  const sourceStateRevision = 5;
  const sourceWorldStateHash = "world_state_hash_phase81e_history";
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
    comparison_direction: "imagined_better_than_actual",
    appraisal_kind: "regret_like_counterfactual_concern",
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

function phase81DProjection({ preparativeOrientation = "future_improvement_candidate" } = {}) {
  const retention = makeRetentionProjection({ preparativeOrientation });
  const currentCandidate = {
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  };
  const cognition = {
    goals: [{ summary: "reach ally" }],
    decision_pressures: [{ kind: "protective" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: [currentCandidate],
  });
  return projectWorldSimulationCounterfactualReflectionReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: [currentCandidate],
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
}

const contract = buildWorldSimulationCounterfactualPreparativeRevalidationContract();
assert.equal(contract.phase, "Phase81E");
assert.equal(contract.exact_phase81d_lineage_required, true);
assert.equal(contract.no_preparative_takeaway_excluded, true);
assert.equal(contract.refs_only_decision_contract, true);
assert.equal(contract.every_judgment_requires_exact_current_cue_support, true);
assert.equal(contract.changed_context_requires_difference_handling, true);
assert.equal(contract.applicability_is_subjective_deliberative_relevance_not_world_truth, true);
assert.equal(contract.preference_revision_allowed, false);
assert.equal(contract.action_selection_allowed, false);
assert.equal(contract.belief_revision_allowed, false);
assert.equal(contract.semantic_revision_allowed, false);
assert.equal(contract.subjective_memory_rewrite_allowed, false);
assert.equal(contract.world_state_mutation_allowed, false);
assert.deepEqual(counterfactualPreparativeApplicabilityJudgments, [
  "currently_applicable_as_deliberative_evidence",
  "currently_not_applicable_as_deliberative_evidence",
  "current_applicability_unresolved",
]);

const phase81D = phase81DProjection();
assert.equal(phase81D.reentry_candidate_count, 1);
assert.equal(phase81D.reentry_candidates[0].current_context_difference_present, true);
const view = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
  source_phase81d_projection: phase81D,
});
assert.equal(view.version, worldSimulationCounterfactualPreparativeRevalidationVersion);
assert.equal(view.preparative_revalidation_candidates.length, 1);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualPreparativeRevalidationResolverView(view));
const candidate = view.preparative_revalidation_candidates[0];
assert.equal(candidate.historical_preparative_orientation, "future_improvement_candidate");
assert.ok(candidate.exact_current_cue_matches.some((match) => match.action_defining === true));
assert.ok(candidate.historical_context_differences.length > 0);
assert.ok(candidate.current_context_additions.length > 0);
assert.equal(JSON.stringify(candidate).includes("source_phase81c_projection_hash"), false);
assert.equal(JSON.stringify(candidate).includes("historical_imagined_content"), true);
assert.equal(JSON.stringify(candidate).includes('"historical_imagined_content_exposed":true'), false);

const retainedCurrentCueRef = candidate.exact_current_cue_matches[0].current_cue_ref;
const addressedHistoricalRef = candidate.historical_context_differences[0]
  .historical_difference_cue_ref;
const decisions = [{
  reentry_candidate_ref: candidate.reentry_candidate_ref,
  applicability_judgment: "currently_applicable_as_deliberative_evidence",
  retain_matched_current_cue_refs: [retainedCurrentCueRef],
  address_historical_difference_cue_refs: [addressedHistoricalRef],
  incorporate_current_additional_cue_refs: [],
}];
const projection = projectWorldSimulationCounterfactualPreparativeRevalidation({
  source_phase81d_projection: phase81D,
  resolver_view: view,
  preparative_revalidation_decisions: decisions,
});
assert.equal(projection.phase, "Phase81E");
assert.equal(projection.revalidation_judgment_count, 1);
assert.equal(
  projection.revalidation_judgments[0].applicability_judgment,
  "currently_applicable_as_deliberative_evidence",
);
assert.equal(projection.revalidation_judgments[0].preference_revision_performed, false);
assert.equal(projection.revalidation_judgments[0].action_selected, false);
assert.equal(projection.revalidation_judgments[0].belief_revision_performed, false);
assert.equal(projection.revalidation_judgments[0].semantic_revision_performed, false);
assert.equal(projection.revalidation_judgments[0].subjective_memory_rewrite_performed, false);
assert.equal(projection.revalidation_judgments[0].world_state_mutated, false);
assert.equal(projection.revalidation_judgments[0].world_truth_authority, false);
assert.equal(projection.character_view.advisory_only, true);
assert.equal(projection.character_view.selected_action_authority, false);
assert.equal(projection.character_view.preference_revision_authority, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualPreparativeRevalidationProjection(projection, {
    source_phase81d_projection: phase81D,
  }));
const characterText = JSON.stringify(projection.character_view);
assert.equal(characterText.includes("source_phase81d_projection_hash"), false);
assert.equal(characterText.includes("source_reentry_candidate_hash"), false);
assert.equal(characterText.includes("revalidation_judgment_hash"), false);
assert.equal(characterText.includes("current_action_ref"), false);

assert.throws(
  () => projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: phase81D,
    resolver_view: view,
    preparative_revalidation_decisions: [{
      ...decisions[0],
      address_historical_difference_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DIFFERENCE_UNADDRESSED",
);
assert.throws(
  () => projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: phase81D,
    resolver_view: view,
    preparative_revalidation_decisions: [{
      ...decisions[0],
      retain_matched_current_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_CURRENT_SUPPORT_REQUIRED",
);
assert.throws(
  () => projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: phase81D,
    resolver_view: view,
    preparative_revalidation_decisions: [{
      ...decisions[0],
      action_id: "forbidden",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_AUTHORITY_FIELD_FORBIDDEN",
);

const staleView = clone(view);
staleView.preparative_revalidation_candidates[0].current_action_id = "tampered";
delete staleView.resolver_view_hash;
staleView.resolver_view_hash = hashAgentRunValue(staleView);
assert.throws(
  () => projectWorldSimulationCounterfactualPreparativeRevalidation({
    source_phase81d_projection: phase81D,
    resolver_view: staleView,
    preparative_revalidation_decisions: [],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_VIEW_STALE",
);

const tamperedProjection = clone(projection);
tamperedProjection.revalidation_judgments[0].action_selected = true;
delete tamperedProjection.projection_hash;
tamperedProjection.projection_hash = hashAgentRunValue(tamperedProjection);
assert.throws(
  () => assertWorldSimulationCounterfactualPreparativeRevalidationProjection(
    tamperedProjection,
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_JUDGMENT_INVALID",
);

// A caller that rewrites nested lineage and then recomputes both the judgment
// and outer projection hashes must still fail against the exact Phase81D source.
const forgedLineageProjection = clone(projection);
forgedLineageProjection.revalidation_judgments[0].source_reentry_candidate_hash =
  "forged_phase81d_candidate_hash";
rehashPhase81EJudgment(forgedLineageProjection.revalidation_judgments[0]);
const forgedLineageRehashed = rehashPhase81EProjection(forgedLineageProjection);
assert.throws(
  () => assertWorldSimulationCounterfactualPreparativeRevalidationProjection(
    forgedLineageRehashed,
    { source_phase81d_projection: phase81D },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
);

// The public advisory is derived output, not an independently mutable surface.
// Recomputing only the outer hash cannot make a forged Character Brain view valid.
const forgedCharacterView = clone(projection);
forgedCharacterView.character_view.judgments[0].applicability_judgment =
  "currently_not_applicable_as_deliberative_evidence";
const forgedCharacterViewRehashed = rehashPhase81EProjection(forgedCharacterView);
assert.throws(
  () => assertWorldSimulationCounterfactualPreparativeRevalidationProjection(
    forgedCharacterViewRehashed,
    { source_phase81d_projection: phase81D },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_CHARACTER_VIEW_INVALID",
);

const noTakeawayPhase81D = phase81DProjection({
  preparativeOrientation: "no_preparative_takeaway",
});
assert.equal(noTakeawayPhase81D.reentry_candidate_count, 1);
const noTakeawayView = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
  source_phase81d_projection: noTakeawayPhase81D,
});
assert.equal(noTakeawayView.preparative_revalidation_candidates.length, 0);

// Formal transport uses Phase81E as a same-snapshot bounded deliberation round
// immediately before ACTION. The stored response is hash-bound and replayed
// through the existing server-owned resolver closure.
const formalRound = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    counterfactual_preparative_revalidation_resolver_views: [view],
  },
  prior_submissions: [],
});
assert.equal(
  formalRound.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE81E,
);
assert.equal(formalRound.decision_inputs.length, 1);
assert.equal(
  formalRound.decision_inputs[0].character_input.experiential_deliberation
    .response_contract.output_field,
  "preparative_revalidation_decisions",
);
assert.equal(
  JSON.stringify(formalRound.decision_inputs[0].character_input).includes("resolver_view_hash"),
  false,
);
const stored = buildWorldSimulationFormalImpasseStoredSubmission({
  resolver_binding: formalRound.decision_inputs[0].resolver_binding,
  character_input: formalRound.decision_inputs[0].character_input,
  deliberation_response: {
    preparative_revalidation_decisions: decisions,
  },
});
const replay = buildWorldSimulationFormalImpasseResolverReplay([stored]);
assert.deepEqual(
  await replay.counterfactualPreparativeRevalidationResolver(view),
  decisions,
);
assert.equal(
  buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: {
      counterfactual_preparative_revalidation_resolver_views: [view],
    },
    prior_submissions: [stored],
  }),
  null,
);
assert.throws(
  () => buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: formalRound.decision_inputs[0].resolver_binding,
    character_input: formalRound.decision_inputs[0].character_input,
    deliberation_response: {
      preparative_revalidation_decisions: [{
        ...decisions[0],
        preference: "choose_this_now",
      }],
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const transportSource = await readFile(
  "server/src/world-simulation-formal-turn-transport-service.mjs",
  "utf8",
);
const brokerSource = await readFile(
  "server/src/world-simulation-prepared-turn-ephemeral-broker.mjs",
  "utf8",
);
assert.match(
  stateSource,
  /counterfactual_preparative_revalidation_projections:\s*\r?\n\s*input\.counterfactual_preparative_revalidation_projections \?\? null/,
);
assert.match(loopSource, /counterfactualPreparativeRevalidationResolver/);
assert.match(loopSource, /counterfactual_preparative_revalidation/);
assert.match(loopSource, /counterfactualPreparativeRevalidationProjections/);
assert.match(transportSource, /counterfactual_preparative_revalidation_resolver_views/);
assert.match(transportSource, /counterfactualPreparativeRevalidationProjections/);
assert.match(transportSource, /acquisition\.prepared_turn\.counterfactual_preparative_revalidation_projections/);
assert.match(brokerSource, /worldSimulationFormalImpasseDecisionKinds\.PHASE81E/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81E",
  version: worldSimulationCounterfactualPreparativeRevalidationVersion,
  applicability_judgment_count: counterfactualPreparativeApplicabilityJudgments.length,
  exact_phase81d_lineage_required: true,
  exact_current_cue_support_required: true,
  changed_context_difference_handling_required: true,
  no_preparative_takeaway_excluded: true,
  formal_same_snapshot_replay_verified: true,
  direct_action_selection_authority: false,
  world_truth_authority: false,
}));
console.log("Phase81E counterfactual preparative revalidation tests passed.");
