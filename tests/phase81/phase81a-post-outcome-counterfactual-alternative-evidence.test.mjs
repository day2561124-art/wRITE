import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationPostOutcomeCounterfactualAlternativeEvidenceContract,
  buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView,
  projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence,
  worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-alternative-evidence-service.mjs";

const sessionId = "session_phase81a";
const turnId = "turn_phase81a";
const stateRevision = 12;
const worldStateHash = "world_state_hash_phase81a";
const character = "千夜";
const decisionPacket = {
  character,
  cognition: {
    goals: [{ goal: "protect_ally" }],
    values: [{ value: "avoid_unnecessary_harm" }],
    working_context: { focus: ["injured_ally", "narrow_corridor"] },
    uncertain: [{ question: "enemy_reinforcement_timing" }],
  },
  candidate_action_intents: [
    {
      action_id: "hold_cover",
      intent: "Stay behind cover while shielding the injured ally.",
      known_costs: ["slower_progress"],
      movement: { mode: "hold_position" },
      resource_commitment: { attention: "high" },
    },
    {
      action_id: "flank_through_side_passage",
      intent: "Use the side passage to pressure the threat from another angle.",
      prerequisites: ["side_passage_accessible"],
      known_costs: ["temporary_distance_from_ally"],
      movement: {
        mode: "side_passage",
        world_state: { hidden: "must_not_escape" },
        internal_route_id: "route_secret",
        route_hash: "hash_secret",
        engine_debug: "engine_secret",
      },
      resource_commitment: {
        attention: "split",
        causal_evidence: { hidden: true },
      },
    },
  ],
};
const selected = [{ character, selection: "candidate_action_intent", action_id: "hold_cover" }];

function makeReceiptBundle() {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    selected_action_intents: selected,
  });
}

function makePhase76A({ includeExperience = true } = {}) {
  return projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: includeExperience ? [{
      actor: character,
      action_id: "hold_cover",
      character_experience: {
        performed: true,
        perceived_result: "The ally stayed protected, but the threat kept its position.",
        perceived_status: "mixed_result_observed",
      },
    }] : [],
    state_transitions: [],
  });
}

function makeView(overrides = {}) {
  return buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    subjective_choice_commitment_receipts: makeReceiptBundle(),
    post_outcome_subjective_perception_projection: makePhase76A(),
    ...overrides,
  });
}

function project(view, decisions, overrides = {}) {
  return projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    subjective_choice_commitment_receipts: makeReceiptBundle(),
    post_outcome_subjective_perception_projection: makePhase76A(),
    resolver_view: view,
    counterfactual_decisions: decisions,
    ...overrides,
  });
}

const contract = buildWorldSimulationPostOutcomeCounterfactualAlternativeEvidenceContract();
assert.equal(contract.phase, "Phase81A");
assert.equal(contract.alternative_must_have_existed_at_decision_time, true);
assert.equal(contract.counterfactual_world_re_simulation_performed, false);
assert.equal(contract.objective_counterfactual_truth_claimed, false);
assert.equal(contract.causal_superiority_claimed, false);
assert.equal(contract.numeric_regret_modeled, false);
assert.equal(contract.numeric_utility_reward_q_value_probability_modeled, false);
assert.equal(contract.automatic_preference_revision_allowed, false);
assert.equal(contract.automatic_action_selection_allowed, false);
assert.equal(contract.direct_semantic_revision_allowed, false);
assert.equal(contract.same_turn_action_selection_feedback_allowed, false);

const view = makeView();
assert.equal(view.version, worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion);
assert.equal(view.counterfactual_context_count, 1);
assert.equal(view.boundaries.raw_causal_outcome_exposed, false);
assert.equal(view.boundaries.raw_world_state_exposed, false);
assert.equal(view.boundaries.alternative_outcome_observed, false);
const context = view.counterfactual_contexts[0];
assert.equal(context.actual_selected_action.action_id, "hold_cover");
assert.equal(context.actual_selected_action.actual_subjective_experience_is_world_truth, false);
assert.equal(context.decision_time_alternative_count, 1);
const alternative = context.decision_time_alternatives[0];
assert.equal(alternative.alternative_action_id, "flank_through_side_passage");
assert.equal(alternative.alternative_was_selected, false);
assert.equal(alternative.alternative_outcome_observed, false);
assert.equal(
  alternative.decision_time_candidate.intent,
  "Use the side passage to pressure the threat from another angle.",
);
assert.equal(alternative.decision_time_candidate.movement.mode, "side_passage");
assert.equal(
  Object.hasOwn(alternative.decision_time_candidate.movement, "world_state"),
  false,
);
assert.equal(
  Object.hasOwn(alternative.decision_time_candidate.movement, "internal_route_id"),
  false,
);
assert.equal(
  Object.hasOwn(alternative.decision_time_candidate.movement, "route_hash"),
  false,
);
assert.equal(
  Object.hasOwn(alternative.decision_time_candidate.movement, "engine_debug"),
  false,
);
assert.equal(
  Object.hasOwn(alternative.decision_time_candidate.resource_commitment, "causal_evidence"),
  false,
);

const upwardDecision = {
  counterfactual_context_ref: context.counterfactual_context_ref,
  alternative_action_ref: alternative.alternative_action_ref,
  alternative_branch_refs: [alternative.consequence_branches[0].branch_ref],
  comparison_direction: "imagined_better_than_actual",
};
const projection = project(view, [upwardDecision]);
assert.equal(projection.counterfactual_evidence_count, 1);
const evidence = projection.counterfactual_evidence[0];
assert.equal(evidence.alternative_available_at_decision_time, true);
assert.equal(evidence.alternative_was_selected, false);
assert.equal(evidence.alternative_outcome_observed, false);
assert.equal(evidence.comparison_is_subjective_counterfactual_evidence_only, true);
assert.equal(evidence.counterfactual_world_truth_claimed, false);
assert.equal(evidence.causal_superiority_claimed, false);
assert.equal(evidence.numeric_regret_assigned, false);
assert.equal(evidence.automatic_preference_selected, false);
assert.equal(evidence.action_selected, false);
assert.equal(evidence.semantic_revision_performed, false);
assert.equal(projection.audit.counterfactual_world_re_simulation_performed, false);
assert.equal(projection.audit.same_turn_action_selection_feedback, false);

const unresolved = project(view, [{
  ...upwardDecision,
  alternative_branch_refs: [],
  comparison_direction: "comparison_unresolved",
}]);
assert.equal(unresolved.counterfactual_evidence[0].comparison_direction, "comparison_unresolved");

for (const forbiddenDecision of [
  { ...upwardDecision, success: true },
  { ...upwardDecision, regret_score: 0.8 },
  { ...upwardDecision, q_value: 12 },
  { ...upwardDecision, world_truth: true },
]) {
  assert.throws(
    () => project(view, [forbiddenDecision]),
    (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_AUTHORITY_FIELD_FORBIDDEN",
  );
}
assert.throws(
  () => project(view, [{ ...upwardDecision, alternative_action_ref: "phase74a_action_not_visible" }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_ALTERNATIVE_OUT_OF_VIEW",
);
assert.throws(
  () => project(view, [{ ...upwardDecision, alternative_branch_refs: ["phase74b_branch_not_visible"] }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_BRANCH_OUT_OF_VIEW",
);
const missingRequiredArray = structuredClone(upwardDecision);
delete missingRequiredArray.alternative_branch_refs;
assert.throws(
  () => project(view, [missingRequiredArray]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
);
assert.throws(
  () => project(view, [{ ...upwardDecision, alternative_branch_refs: [] }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_SUPPORT_REQUIRED",
);

const tamperedPhase76A = structuredClone(makePhase76A());
tamperedPhase76A.character_experiences[0].experience.perceived_status = "tampered";
assert.throws(
  () => makeView({ post_outcome_subjective_perception_projection: tamperedPhase76A }),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_HASH_MISMATCH",
);
const tamperedReceipt = structuredClone(makeReceiptBundle());
tamperedReceipt.receipts[0].prospective_consequence_view_hash = "forged_phase74b_hash";
assert.throws(
  () => makeView({ subjective_choice_commitment_receipts: tamperedReceipt }),
  (error) => [
    "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_HASH_MISMATCH",
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE74_LINEAGE_MISMATCH",
  ].includes(error?.code),
);

const noExperiencePhase76A = makePhase76A({ includeExperience: false });
const noExperienceView = makeView({
  post_outcome_subjective_perception_projection: noExperiencePhase76A,
});
assert.equal(noExperienceView.counterfactual_context_count, 0);
assert.equal(noExperienceView.status, "no_eligible_post_outcome_counterfactual_context");
const noExperienceProjection = projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  decision_packets: [decisionPacket],
  subjective_choice_commitment_receipts: makeReceiptBundle(),
  post_outcome_subjective_perception_projection: noExperiencePhase76A,
  resolver_view: noExperienceView,
  counterfactual_decisions: [],
});
assert.equal(noExperienceProjection.counterfactual_evidence_count, 0);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView/);
assert.match(loopSource, /postOutcomeCounterfactualAlternativeResolver/);
assert.match(loopSource, /post_outcome_counterfactual_alternative_evidence:/);
assert.match(stateSource, /post_outcome_counterfactual_alternative_evidence:/);
assert.equal(
  stateSource.includes("post_outcome_counterfactual_alternative_resolver_view:"),
  false,
  "Phase81A resolver view must remain ephemeral.",
);

console.log("Phase81A post-outcome counterfactual alternative evidence tests passed.");
