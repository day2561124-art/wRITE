import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceContract,
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
  subjectiveProspectiveConsequenceCharacterViewVersion,
  worldSimulationSubjectiveProspectiveConsequenceVersion,
} from "../../server/src/world-simulation-subjective-prospective-consequence-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const CHARACTER = "千夜測試角色";

const cognition = {
  goals: ["保護同伴"],
  values: { caution: "important" },
  relationship_cognition: { 同伴甲: { relation: "trusted" } },
  decision_pressures: ["出口正在關閉"],
  emotion: { state: "緊張" },
  working_context: {
    focus: { content: "出口正在關閉" },
    active_context: [{ content: "同伴仍在身後" }],
  },
  known: ["出口在東側"],
  uncertain: ["敵人是否會從側門出現"],
};

const candidates = [
  {
    action_id: "retreat_with_ally",
    intent: "和同伴一起向東側出口撤退",
    prerequisites: ["同伴仍能移動"],
    known_costs: ["放棄目前防守位置"],
    blocked_by: ["出口已完全關閉"],
    duration_estimate: "立即",
    movement: { direction: "east", distance_m: 4 },
    target: "東側出口",
    resource_commitment: { stamina: "moderate" },
  },
  {
    action_id: "hold_position",
    intent: "繼續守住入口",
    prerequisites: [],
    known_costs: ["撤退時間可能變少"],
    blocked_by: [],
    defense: { stance: "hold" },
  },
];

function phase74AView(candidateList = candidates, cognitionValue = cognition) {
  return buildWorldSimulationSubjectiveActionDeliberationView({
    character: CHARACTER,
    cognition: cognitionValue,
    candidate_action_intents: candidateList,
  });
}

const contract = buildWorldSimulationSubjectiveProspectiveConsequenceContract();
assert.equal(contract.phase, "Phase74B");
assert.equal(contract.version, worldSimulationSubjectiveProspectiveConsequenceVersion);
assert.equal(contract.phase74a_canonical_grounding_required, true);
assert.equal(contract.candidate_source_owner, "existing_world_action_proposer");
assert.equal(contract.candidate_generation_duplicated, false);
assert.equal(contract.character_brain_remains_final_action_choice_owner, true);
assert.equal(contract.action_outcome_owner, "causal_simulator");
assert.deepEqual(contract.bounded_horizons, ["immediate", "near_term"]);
assert.equal(contract.distant_future_tree_search_modeled, false);
assert.equal(contract.intended_action_direction_is_not_expected_outcome, true);
assert.equal(contract.multiple_possible_branches_allowed, true);
assert.equal(contract.uncertainty_branch_preserved, true);
assert.equal(contract.numeric_probability_confidence_utility_modeled, false);
assert.equal(contract.objective_feasibility_oracle_modeled, false);
assert.equal(contract.deterministic_action_winner_computed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.causal_outcome_authority_claimed, false);
assert.equal(contract.cross_option_preference_resolution_modeled, false);

const inputSnapshot = JSON.stringify({ cognition, candidates });
const deliberation = phase74AView();
const view = buildWorldSimulationSubjectiveProspectiveConsequenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
  subjective_action_deliberation: deliberation,
});

assert.equal(view.version, subjectiveProspectiveConsequenceCharacterViewVersion);
assert.equal(view.source_version, worldSimulationSubjectiveProspectiveConsequenceVersion);
assert.equal(view.source_deliberation_view_hash, deliberation.deliberation_view_hash);
assert.equal(view.character, CHARACTER);
assert.equal(view.status, "bounded_subjective_prospection_ready");
assert.equal(view.action_prospect_count, 2);
assert.equal(view.simulation_horizon.immediate, true);
assert.equal(view.simulation_horizon.near_term, true);
assert.equal(view.simulation_horizon.distant_future, false);
assert.equal(view.simulation_horizon.exhaustive_tree_search, false);
assert.ok(view.prospective_consequence_view_hash);
assert.equal(JSON.stringify({ cognition, candidates }), inputSnapshot);

const retreat = view.action_prospects.find((entry) => entry.action_id === "retreat_with_ally");
assert.ok(retreat);
assert.match(retreat.prospect_ref, /^phase74b_prospect_/);
assert.equal(retreat.action_ref, deliberation.action_options[0].action_ref);
assert.equal(retreat.simulation_mode, "bounded_qualitative_possible_consequences");
assert.equal(retreat.action_intent_not_promoted_to_outcome, true);
assert.equal(retreat.no_branch_is_world_prediction, true);
assert.equal(retreat.branches_truncated, false);
assert.equal(
  retreat.consequence_branches.some((branch) =>
    branch.source_paths.some((sourcePath) => sourcePath.startsWith("candidate_action_intents[0]."))),
  true,
  "Phase74B candidate lineage must use canonical array-index source paths rather than conceptual action-id paths.",
);

const retreatKinds = new Set(retreat.consequence_branches.map((branch) => branch.branch_kind));
for (const expected of [
  "intended_attempt_direction",
  "blocking_contingency",
  "prerequisite_contingency",
  "known_cost_exposure",
  "execution_mechanics_contingency",
  "time_resource_exposure",
  "epistemic_uncertainty_contingency",
]) {
  assert.equal(retreatKinds.has(expected), true, `missing Phase74B branch kind ${expected}`);
}

for (const prospect of view.action_prospects) {
  for (const branch of prospect.consequence_branches) {
    assert.match(branch.branch_ref, /^phase74b_branch_/);
    assert.ok(["immediate", "near_term"].includes(branch.horizon));
    assert.equal(branch.epistemic_status, "subjective_possibility_not_prediction");
    assert.equal(branch.semantic_content_duplicated, false);
    assert.equal(branch.world_truth_authority, false);
    assert.equal(branch.causal_outcome_authority, false);
    assert.equal(Object.hasOwn(branch, "content"), false);
    assert.equal(Object.hasOwn(branch, "probability"), false);
    assert.equal(Object.hasOwn(branch, "confidence"), false);
    assert.equal(Object.hasOwn(branch, "utility"), false);
    assert.equal(Object.hasOwn(branch, "success"), false);
    assert.equal(Object.hasOwn(branch, "result"), false);
    assert.equal(Object.hasOwn(branch, "winner"), false);
  }
}

const uncertaintyBranch = retreat.consequence_branches.find(
  (branch) => branch.branch_kind === "epistemic_uncertainty_contingency",
);
assert.ok(uncertaintyBranch);
assert.ok(uncertaintyBranch.grounding_refs.length > 0);
const allowedUncertaintyRefs = new Set(
  deliberation.cognition_grounding_catalog
    .filter((entry) => entry.grounding_kind === "uncertain_context")
    .map((entry) => entry.grounding_ref),
);
assert.equal(
  uncertaintyBranch.grounding_refs.every((ref) => allowedUncertaintyRefs.has(ref)),
  true,
);

const serialized = JSON.stringify(view);
for (const forbiddenSemanticDuplicate of [
  "和同伴一起向東側出口撤退",
  "同伴仍能移動",
  "放棄目前防守位置",
  "出口已完全關閉",
  "敵人是否會從側門出現",
  "保護同伴",
]) {
  assert.equal(
    serialized.includes(forbiddenSemanticDuplicate),
    false,
    `Phase74B must reference existing character-facing semantics rather than duplicate ${forbiddenSemanticDuplicate}.`,
  );
}
assert.equal(view.simulation_boundary.deterministic_action_winner_not_computed, true);
assert.equal(view.simulation_boundary.cross_option_preference_resolution_deferred, true);
assert.equal(view.simulation_boundary.numeric_probability_not_computed, true);
assert.equal(view.simulation_boundary.numeric_expected_utility_not_computed, true);
assert.equal(view.simulation_boundary.objective_feasibility_not_asserted, true);
assert.equal(view.simulation_boundary.causal_outcome_not_asserted, true);
assert.equal(view.information_boundary.candidate_semantic_content_duplicated, false);
assert.equal(view.information_boundary.cognition_semantic_content_duplicated, false);
assert.equal(view.information_boundary.raw_world_state_exposed, false);

const repeated = buildWorldSimulationSubjectiveProspectiveConsequenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
  subjective_action_deliberation: deliberation,
});
assert.deepEqual(repeated, view, "Phase74B prospection must be deterministic for the same bounded subjective inputs.");

const mechanicalVariantA = [{
  action_id: "advance",
  intent: "向前移動",
  movement: { direction: "east", distance_m: 2 },
}];
const mechanicalVariantB = [{
  action_id: "advance",
  intent: "向前移動",
  movement: { direction: "east", distance_m: 5 },
}];
const variantA = buildWorldSimulationSubjectiveProspectiveConsequenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: mechanicalVariantA,
  subjective_action_deliberation: phase74AView(mechanicalVariantA),
});
const variantB = buildWorldSimulationSubjectiveProspectiveConsequenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: mechanicalVariantB,
  subjective_action_deliberation: phase74AView(mechanicalVariantB),
});
const mechanicsA = variantA.action_prospects[0].consequence_branches.find(
  (branch) => branch.branch_kind === "execution_mechanics_contingency",
);
const mechanicsB = variantB.action_prospects[0].consequence_branches.find(
  (branch) => branch.branch_kind === "execution_mechanics_contingency",
);
assert.notEqual(
  mechanicsA.branch_ref,
  mechanicsB.branch_ref,
  "Opaque Phase74B mechanics branches must distinguish materially different candidate mechanics without exposing them twice.",
);

const emptyCandidates = [];
const empty = buildWorldSimulationSubjectiveProspectiveConsequenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: emptyCandidates,
  subjective_action_deliberation: phase74AView(emptyCandidates),
});
assert.equal(empty.status, "no_action_candidates_available");
assert.equal(empty.action_prospect_count, 0);

const forgedDeliberation = JSON.parse(JSON.stringify(deliberation));
forgedDeliberation.deliberation_view_hash = "forged";
assert.throws(
  () => buildWorldSimulationSubjectiveProspectiveConsequenceView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: candidates,
    subjective_action_deliberation: forgedDeliberation,
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_PROSPECTION_PHASE74A_VIEW_INVALID",
);

const packet = {
  character: CHARACTER,
  perception: { observed: [], audible: [], other_senses: [] },
  recovered_memories: [],
  retrieval_experience: {
    process_occurred: false,
    initiation_mode: null,
    target_outcome: null,
    recovered_any_content: false,
  },
  cognition,
  candidate_action_intents: candidates,
  boundaries: {},
};
const brainInput = buildWorldSimulationCharacterBrainInput(packet);
assert.equal(
  brainInput.boundaries.subjective_action_deliberation_grounding_v1_installed,
  true,
);
assert.equal(
  brainInput.boundaries.subjective_prospective_consequence_simulation_v1_installed,
  true,
);
assert.equal(
  brainInput.subjective_prospective_consequence_simulation.version,
  subjectiveProspectiveConsequenceCharacterViewVersion,
);
assert.equal(
  brainInput.subjective_prospective_consequence_simulation.source_deliberation_view_hash,
  brainInput.subjective_action_deliberation.deliberation_view_hash,
);
assert.equal(
  Object.hasOwn(brainInput.subjective_prospective_consequence_simulation, "selected_action_id"),
  false,
);

console.log("Phase74B subjective prospective consequence simulation tests passed.");
