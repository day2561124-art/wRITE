import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceCandidateVersion,
} from "../../server/src/world-simulation-analogical-experience-candidate-service.mjs";
import {
  buildWorldSimulationAnalogicalExperienceAdaptationContract,
  buildWorldSimulationAnalogicalExperienceAdaptationResolverView,
  projectWorldSimulationAnalogicalExperienceAdaptation,
  worldSimulationAnalogicalExperienceAdaptationVersion,
} from "../../server/src/world-simulation-analogical-experience-adaptation-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";

const character = "千夜";
const turnId = "turn_phase80b_current";
const stateRevision = 12;

function makePhase80AProjection() {
  const identity = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    source_phase79i_precedent_ref: "phase79i_precedent_phase80b",
    source_phase79i_precedent_hash: "phase79i_precedent_hash_phase80b",
    current_impasse_ref: "phase79d_impasse_phase80b",
    source_turn_id: "turn_phase80b_history",
    source_revision_to: 8,
    historical_impasse_ref: "phase79d_impasse_phase80b_history",
    method_set_hash: "method_set_hash_phase80b",
    historical_dominant_method_skeleton_hash: "method_skeleton_hash_phase80b",
    current_corresponding_method_ref: "phase76e_transfer_phase80b",
    current_corresponding_method_skeleton_hash: "method_skeleton_hash_phase80b",
    method_outcome_assessment: "supports_prior_method",
    precedent_kind: "supported_resolution_selected_method_precedent",
    alignment_kind: "exact_method_structure_with_context_difference",
    aligned_cue_pairs: [{
      historical_cue_ref: "historical_route",
      current_cue_ref: "current_route",
      cue_kind: "perception",
      cue_content_hash: "cue_hash_route",
      exact_kind_and_content_alignment: true,
    }],
    historical_unmatched_cues: [{
      historical_cue_ref: "historical_visibility",
      cue_kind: "attention",
      content: { visibility: "low" },
      cue_content_hash: "cue_hash_visibility",
    }],
    current_additional_cues: [{
      current_cue_ref: "current_threat",
      cue_kind: "working_context",
      content: { nearby_threat: "closing distance" },
      cue_content_hash: "cue_hash_threat",
    }],
  };
  const candidateHash = hashAgentRunValue(identity);
  const candidate = {
    analogy_candidate_ref: `phase80a_analogy_${candidateHash.slice(0, 24)}`,
    analogy_candidate_hash: candidateHash,
    ...identity,
    aligned_cue_count: 1,
    historical_unmatched_cue_count: 1,
    current_additional_cue_count: 1,
    exact_method_structure_alignment: true,
    context_difference_present: true,
    adaptation_required: true,
    direct_reuse_allowed: false,
    comparative_preference_validated: false,
    automatic_preference_selected: false,
    action_selection_performed: false,
    semantic_revision_performed: false,
    world_truth_authority: false,
    source_current_state_revision: stateRevision,
  };
  const projection = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    character,
    current_turn_id: turnId,
    current_state_revision: stateRevision,
    current_world_state_hash: "world_state_hash_phase80b",
    source_phase79e_evidence_hash: "phase79e_hash_phase80b",
    source_phase79i_precedent_reentry_hash: "phase79i_hash_phase80b",
    source_phase79i_precedent_count: 1,
    source_phase79i_exact_full_cue_match_count: 0,
    source_phase79i_near_miss_count: 1,
    analogy_candidate_count: 1,
    analogy_candidates: [candidate],
    audit: {
      character_brain_exposure_performed: false,
      fuzzy_semantic_similarity_used: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

const contract = buildWorldSimulationAnalogicalExperienceAdaptationContract();
assert.equal(contract.version, worldSimulationAnalogicalExperienceAdaptationVersion);
assert.equal(contract.phase, "Phase80B");
assert.equal(contract.adaptation_is_ref_selection_not_semantic_authoring, true);
assert.equal(contract.direct_method_rewrite_allowed, false);
assert.equal(contract.direct_method_reuse_allowed, false);
assert.equal(contract.preference_resolution_performed, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.numeric_similarity_confidence_probability_utility_reward_modeled, false);
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);

const phase80A = makePhase80AProjection();
const view = buildWorldSimulationAnalogicalExperienceAdaptationResolverView({
  source_phase80a_projection: phase80A,
});
assert.equal(view.character, character);
assert.equal(view.current_turn_id, turnId);
assert.equal(view.analogy_candidates.length, 1);
assert.equal(view.boundaries.source_phase80a_projection_hash, phase80A.projection_hash);
assert.equal(view.boundaries.raw_world_state_exposed, false);
assert.equal(view.boundaries.raw_world_history_exposed, false);
assert.equal(view.boundaries.world_truth_authority, false);
assert.equal(view.response_contract.semantic_method_authoring_allowed, false);
assert.equal(view.response_contract.preference_authoring_allowed, false);
assert.equal(view.response_contract.action_authoring_allowed, false);

const candidate = view.analogy_candidates[0];
const decision = {
  analogy_candidate_ref: candidate.analogy_candidate_ref,
  retain_aligned_current_cue_refs: ["current_route"],
  drop_historical_cue_refs: ["historical_visibility"],
  incorporate_current_cue_refs: ["current_threat"],
};
const adaptation = projectWorldSimulationAnalogicalExperienceAdaptation({
  resolver_view: view,
  adaptation_decisions: [decision],
});
assert.equal(adaptation.adaptation_decision_count, 1);
assert.deepEqual(
  adaptation.character_view.adaptation_intents[0].retain_aligned_current_cue_refs,
  ["current_route"],
);
assert.equal(adaptation.character_view.advisory_only, true);
assert.equal(adaptation.character_view.further_current_context_revalidation_required, true);
assert.equal(adaptation.audit.resolver_authored_semantic_method_content, false);
assert.equal(adaptation.audit.direct_method_reuse_performed, false);
assert.equal(adaptation.audit.preference_resolution_performed, false);
assert.equal(adaptation.audit.action_selection_performed, false);
assert.equal(adaptation.audit.world_truth_authority_claimed, false);

assert.throws(
  () => projectWorldSimulationAnalogicalExperienceAdaptation({
    resolver_view: view,
    adaptation_decisions: [{ ...decision, action_id: "forbidden" }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceAdaptation({
    resolver_view: view,
    adaptation_decisions: [{
      ...decision,
      retain_aligned_current_cue_refs: ["out_of_view"],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceAdaptation({
    resolver_view: view,
    adaptation_decisions: [{
      analogy_candidate_ref: candidate.analogy_candidate_ref,
      retain_aligned_current_cue_refs: ["current_route"],
      drop_historical_cue_refs: [],
      incorporate_current_cue_refs: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DIFFERENCE_USE_REQUIRED",
);

const tamperedView = structuredClone(view);
tamperedView.analogy_candidates[0].current_additional_cues[0].content = { nearby_threat: "gone" };
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceAdaptation({
    resolver_view: tamperedView,
    adaptation_decisions: [],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_RESOLVER_VIEW_INVALID",
);

const round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    analogical_experience_adaptation_resolver_views: [view],
  },
  prior_submissions: [],
});
assert.equal(round.decision_round_kind, worldSimulationFormalImpasseDecisionKinds.PHASE80B);
assert.equal(round.decision_inputs.length, 1);
assert.equal(round.decision_inputs[0].character_input.character, character);
assert.equal(
  round.decision_inputs[0].character_input.experiential_deliberation.response_contract.output_field,
  "adaptation_decisions",
);
assert.equal(JSON.stringify(round.decision_inputs[0].character_input).includes("resolver_view_hash"), false);
assert.equal(JSON.stringify(round.decision_inputs[0].character_input).includes("projection_hash"), false);

const stored = buildWorldSimulationFormalImpasseStoredSubmission({
  resolver_binding: round.decision_inputs[0].resolver_binding,
  character_input: round.decision_inputs[0].character_input,
  deliberation_response: { adaptation_decisions: [decision] },
});
const replay = buildWorldSimulationFormalImpasseResolverReplay([stored]);
assert.deepEqual(await replay.analogicalExperienceAdaptationResolver(view), [decision]);

assert.throws(
  () => buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: round.decision_inputs[0].resolver_binding,
    character_input: round.decision_inputs[0].character_input,
    deliberation_response: {
      adaptation_decisions: [{ ...decision, preference: "left_preferred" }],
    },
  }),
  (error) => error?.code === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
);

console.log("Phase80B bounded analogical adaptation deliberation tests passed.");
