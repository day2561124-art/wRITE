import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView,
  projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence,
} from "../../server/src/world-simulation-post-outcome-counterfactual-alternative-evidence-service.mjs";
import {
  buildWorldSimulationPostOutcomeCounterfactualAppraisalContract,
  buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView,
  projectWorldSimulationPostOutcomeCounterfactualAppraisal,
  worldSimulationPostOutcomeCounterfactualAppraisalVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-appraisal-service.mjs";

const sessionId = "session_phase81b";
const turnId = "turn_phase81b";
const stateRevision = 21;
const worldStateHash = "world_state_hash_phase81b";
const character = "千夜";
const decisionPacket = {
  character,
  cognition: {
    goals: [{ goal: "protect_ally" }],
    values: [{ value: "avoid_unnecessary_harm" }],
    working_context: { focus: ["injured_ally", "side_passage"] },
    uncertain: [{ question: "reinforcement_timing" }],
  },
  candidate_action_intents: [
    {
      action_id: "hold_cover",
      intent: "Stay behind cover while shielding the injured ally.",
      known_costs: ["slower_progress"],
      movement: { mode: "hold_position" },
    },
    {
      action_id: "flank_side_passage",
      intent: "Use the side passage to pressure the threat from another angle.",
      prerequisites: ["side_passage_accessible"],
      known_costs: ["temporary_distance_from_ally"],
      movement: { mode: "side_passage" },
    },
  ],
};
const selected = [{ character, selection: "candidate_action_intent", action_id: "hold_cover" }];

function receiptBundle() {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    selected_action_intents: selected,
  });
}

function phase76A() {
  return projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: [{
      actor: character,
      action_id: "hold_cover",
      character_experience: {
        performed: true,
        perceived_result: "The ally stayed protected, but the threat kept its position.",
        perceived_status: "mixed_result_observed",
      },
    }],
    state_transitions: [],
  });
}

function phase81AView() {
  return buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    subjective_choice_commitment_receipts: receiptBundle(),
    post_outcome_subjective_perception_projection: phase76A(),
  });
}

function phase81AProjection(comparisonDirection = "imagined_better_than_actual") {
  const view = phase81AView();
  const context = view.counterfactual_contexts[0];
  const alternative = context.decision_time_alternatives[0];
  const branches = comparisonDirection === "comparison_unresolved"
    ? []
    : [alternative.consequence_branches[0].branch_ref];
  return {
    view,
    projection: projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence({
      world_simulation_session_id: sessionId,
      turn_id: turnId,
      state_revision: stateRevision,
      world_state_hash: worldStateHash,
      decision_packets: [decisionPacket],
      subjective_choice_commitment_receipts: receiptBundle(),
      post_outcome_subjective_perception_projection: phase76A(),
      resolver_view: view,
      counterfactual_decisions: [{
        counterfactual_context_ref: context.counterfactual_context_ref,
        alternative_action_ref: alternative.alternative_action_ref,
        alternative_branch_refs: branches,
        comparison_direction: comparisonDirection,
      }],
    }),
  };
}

function phase81BView(comparisonDirection = "imagined_better_than_actual") {
  const source = phase81AProjection(comparisonDirection);
  return {
    ...source,
    appraisalView: buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
      counterfactual_alternative_resolver_view: source.view,
      post_outcome_counterfactual_alternative_evidence: source.projection,
    }),
  };
}

function projectAppraisal(source, decisions) {
  return projectWorldSimulationPostOutcomeCounterfactualAppraisal({
    counterfactual_alternative_resolver_view: source.view,
    post_outcome_counterfactual_alternative_evidence: source.projection,
    resolver_view: source.appraisalView,
    appraisal_decisions: decisions,
  });
}

const contract = buildWorldSimulationPostOutcomeCounterfactualAppraisalContract();
assert.equal(contract.phase, "Phase81B");
assert.equal(contract.unchosen_outcome_observed, false);
assert.equal(contract.regret_or_relief_treated_as_objective_emotion_fact, false);
assert.equal(contract.causal_self_blame_inferred, false);
assert.equal(contract.numeric_emotion_intensity_modeled, false);
assert.equal(contract.automatic_preference_revision_allowed, false);
assert.equal(contract.automatic_action_selection_allowed, false);
assert.equal(contract.automatic_belief_revision_allowed, false);
assert.equal(contract.direct_semantic_revision_allowed, false);

const upward = phase81BView("imagined_better_than_actual");
assert.equal(upward.appraisalView.version, worldSimulationPostOutcomeCounterfactualAppraisalVersion);
assert.equal(upward.appraisalView.appraisal_context_count, 1);
assert.equal(upward.appraisalView.boundaries.unchosen_outcome_observed, false);
assert.equal(upward.appraisalView.boundaries.causal_self_blame_inferred, false);
const upwardContext = upward.appraisalView.appraisal_contexts[0];
assert.equal(upwardContext.comparison_direction, "imagined_better_than_actual");
assert.equal(upwardContext.actual_selected_action.actual_subjective_experience_is_world_truth, false);
assert.equal(upwardContext.imagined_alternative.alternative_outcome_observed, false);
assert.equal(upwardContext.imagined_alternative.branches_are_subjective_possibilities_not_predictions, true);

const regretDecision = {
  counterfactual_evidence_ref: upwardContext.counterfactual_evidence_ref,
  appraisal_kind: "regret_like_counterfactual_concern",
  preparative_orientation: "future_improvement_candidate",
  salient_branch_refs: [upwardContext.imagined_alternative.supporting_branch_refs[0]],
};
const regretProjection = projectAppraisal(upward, [regretDecision]);
assert.equal(regretProjection.counterfactual_appraisal_count, 1);
const regretAppraisal = regretProjection.counterfactual_appraisals[0];
assert.equal(regretAppraisal.appraisal_kind, "regret_like_counterfactual_concern");
assert.equal(regretAppraisal.preparative_orientation, "future_improvement_candidate");
assert.equal(regretAppraisal.appraisal_is_subjective_not_forgone_outcome_fact, true);
assert.equal(regretAppraisal.unchosen_outcome_observed, false);
assert.equal(regretAppraisal.causal_self_blame_inferred, false);
assert.equal(regretAppraisal.numeric_emotion_intensity_assigned, false);
assert.equal(regretAppraisal.automatic_preference_revision_performed, false);
assert.equal(regretAppraisal.action_selected, false);
assert.equal(regretAppraisal.belief_revision_performed, false);
assert.equal(regretAppraisal.semantic_revision_performed, false);
assert.equal(regretProjection.audit.same_turn_action_selection_feedback, false);

const downward = phase81BView("imagined_worse_than_actual");
const downwardContext = downward.appraisalView.appraisal_contexts[0];
const reliefProjection = projectAppraisal(downward, [{
  counterfactual_evidence_ref: downwardContext.counterfactual_evidence_ref,
  appraisal_kind: "relief_like_counterfactual_contrast",
  preparative_orientation: "current_choice_reassurance_candidate",
  salient_branch_refs: [downwardContext.imagined_alternative.supporting_branch_refs[0]],
}]);
assert.equal(reliefProjection.counterfactual_appraisals[0].appraisal_kind, "relief_like_counterfactual_contrast");
assert.equal(reliefProjection.counterfactual_appraisals[0].preparative_orientation, "current_choice_reassurance_candidate");

const unresolved = phase81BView("comparison_unresolved");
const unresolvedContext = unresolved.appraisalView.appraisal_contexts[0];
const unresolvedProjection = projectAppraisal(unresolved, [{
  counterfactual_evidence_ref: unresolvedContext.counterfactual_evidence_ref,
  appraisal_kind: "reflective_uncertainty",
  preparative_orientation: "no_preparative_takeaway",
  salient_branch_refs: [],
}]);
assert.equal(unresolvedProjection.counterfactual_appraisals[0].appraisal_kind, "reflective_uncertainty");

assert.throws(
  () => projectAppraisal(upward, [{
    ...regretDecision,
    appraisal_kind: "relief_like_counterfactual_contrast",
  }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
);
assert.throws(
  () => projectAppraisal(downward, [{
    counterfactual_evidence_ref: downwardContext.counterfactual_evidence_ref,
    appraisal_kind: "regret_like_counterfactual_concern",
    preparative_orientation: "future_improvement_candidate",
    salient_branch_refs: [downwardContext.imagined_alternative.supporting_branch_refs[0]],
  }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
);
assert.throws(
  () => projectAppraisal(unresolved, [{
    counterfactual_evidence_ref: unresolvedContext.counterfactual_evidence_ref,
    appraisal_kind: "regret_like_counterfactual_concern",
    preparative_orientation: "future_improvement_candidate",
    salient_branch_refs: [],
  }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
);
assert.throws(
  () => projectAppraisal(upward, [{
    ...regretDecision,
    salient_branch_refs: [],
  }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_SUPPORT_REQUIRED",
);
assert.throws(
  () => projectAppraisal(upward, [{
    ...regretDecision,
    salient_branch_refs: ["phase81a_branch_not_visible"],
  }]),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_BRANCH_OUT_OF_VIEW",
);

for (const forbiddenDecision of [
  { ...regretDecision, world_truth: true },
  { ...regretDecision, causal_blame: "self" },
  { ...regretDecision, regret_score: 0.8 },
  { ...regretDecision, emotion_intensity: 0.9 },
  { ...regretDecision, q_value: 3 },
  { ...regretDecision, preferred_action: "flank_side_passage" },
  { ...regretDecision, belief_revision: "I should always flank." },
  { ...regretDecision, semantic_revision: "Flanking is superior." },
]) {
  assert.throws(
    () => projectAppraisal(upward, [forbiddenDecision]),
    (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_AUTHORITY_FIELD_FORBIDDEN",
  );
}

const tamperedProjection = structuredClone(upward.projection);
tamperedProjection.counterfactual_evidence[0].comparison_direction = "imagined_worse_than_actual";
assert.throws(
  () => buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
    counterfactual_alternative_resolver_view: upward.view,
    post_outcome_counterfactual_alternative_evidence: tamperedProjection,
  }),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_HASH_MISMATCH",
);

const emptyA = phase81AView();
const emptyAProjection = projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  decision_packets: [decisionPacket],
  subjective_choice_commitment_receipts: receiptBundle(),
  post_outcome_subjective_perception_projection: phase76A(),
  resolver_view: emptyA,
  counterfactual_decisions: [],
});
const emptyBView = buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
  counterfactual_alternative_resolver_view: emptyA,
  post_outcome_counterfactual_alternative_evidence: emptyAProjection,
});
assert.equal(emptyBView.appraisal_context_count, 0);
assert.equal(emptyBView.status, "no_counterfactual_evidence_to_appraise");
const emptyBProjection = projectWorldSimulationPostOutcomeCounterfactualAppraisal({
  counterfactual_alternative_resolver_view: emptyA,
  post_outcome_counterfactual_alternative_evidence: emptyAProjection,
  resolver_view: emptyBView,
  appraisal_decisions: [],
});
assert.equal(emptyBProjection.counterfactual_appraisal_count, 0);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView/);
assert.match(loopSource, /postOutcomeCounterfactualAppraisalResolver/);
assert.match(loopSource, /post_outcome_counterfactual_appraisal:/);
assert.match(stateSource, /post_outcome_counterfactual_appraisal:/);
assert.equal(
  stateSource.includes("post_outcome_counterfactual_appraisal_resolver_view:"),
  false,
  "Phase81B resolver view must remain ephemeral.",
);

console.log("Phase81B post-outcome counterfactual appraisal tests passed.");
