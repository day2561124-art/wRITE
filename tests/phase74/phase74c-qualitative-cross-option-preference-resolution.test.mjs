import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
} from "../../server/src/world-simulation-subjective-prospective-consequence-service.mjs";
import {
  buildWorldSimulationSubjectiveCrossOptionPreferenceContract,
  buildWorldSimulationSubjectiveCrossOptionPreferenceView,
  subjectiveCrossOptionPreferenceCharacterViewVersion,
  subjectiveCrossOptionPreferenceImpasseKinds,
  subjectiveCrossOptionPreferenceRelations,
  worldSimulationSubjectiveCrossOptionPreferenceVersion,
} from "../../server/src/world-simulation-subjective-cross-option-preference-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const CHARACTER = "千夜測試角色";
const cognition = {
  goals: ["保護同伴", "離開危險區域"],
  values: { loyalty: "high", caution: "important" },
  relationship_cognition: { 同伴甲: { relation: "trusted" } },
  decision_pressures: ["出口正在關閉"],
  current_action: "守住入口",
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
    movement: { direction: "east", distance_m: 4 },
  },
  {
    action_id: "hold_position",
    intent: "繼續守住入口",
    known_costs: ["撤退時間可能變少"],
    defense: { stance: "hold" },
  },
  {
    action_id: "draw_enemy_away",
    intent: "主動把敵人引離出口",
    known_costs: ["自己會離同伴更遠"],
    movement: { direction: "west", distance_m: 3 },
  },
];

function phase74A(candidateList = candidates) {
  return buildWorldSimulationSubjectiveActionDeliberationView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: candidateList,
  });
}

function phase74B(candidateList = candidates, deliberation = phase74A(candidateList)) {
  return buildWorldSimulationSubjectiveProspectiveConsequenceView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: candidateList,
    subjective_action_deliberation: deliberation,
  });
}

const contract = buildWorldSimulationSubjectiveCrossOptionPreferenceContract();
assert.equal(contract.phase, "Phase74C");
assert.equal(contract.version, worldSimulationSubjectiveCrossOptionPreferenceVersion);
assert.equal(contract.phase74a_canonical_grounding_required, true);
assert.equal(contract.phase74b_canonical_prospection_required, true);
assert.equal(contract.pairwise_comparison_workspace_complete_for_bounded_candidate_set, true);
assert.equal(contract.partial_preference_order_allowed, true);
assert.equal(contract.incomparability_or_unresolved_preference_allowed, true);
assert.equal(contract.indifference_allowed, true);
assert.equal(contract.reject_both_allowed, true);
assert.equal(contract.preference_cycles_not_auto_repaired, true);
assert.equal(contract.transitive_closure_not_invented, true);
assert.equal(contract.hidden_tie_breaker_not_used, true);
assert.equal(contract.numeric_utility_probability_confidence_score_modeled, false);
assert.equal(contract.deterministic_action_winner_computed, false);
assert.equal(contract.character_brain_remains_preference_and_final_choice_owner, true);
assert.deepEqual(contract.supported_relations, subjectiveCrossOptionPreferenceRelations);

const deliberation = phase74A();
const prospection = phase74B(candidates, deliberation);
const inputSnapshot = JSON.stringify({ cognition, candidates, deliberation, prospection });
const view = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
  subjective_action_deliberation: deliberation,
  subjective_prospective_consequence_simulation: prospection,
});

assert.equal(view.version, subjectiveCrossOptionPreferenceCharacterViewVersion);
assert.equal(view.source_version, worldSimulationSubjectiveCrossOptionPreferenceVersion);
assert.equal(view.source_deliberation_view_hash, deliberation.deliberation_view_hash);
assert.equal(view.source_prospection_view_hash, prospection.prospective_consequence_view_hash);
assert.equal(view.character, CHARACTER);
assert.equal(view.status, "qualitative_pairwise_preference_workspace_ready");
assert.equal(view.option_count, 3);
assert.equal(view.pairwise_comparison_count, 3);
assert.equal(view.expected_complete_pairwise_comparison_count, 3);
assert.deepEqual(view.supported_relations, subjectiveCrossOptionPreferenceRelations);
assert.deepEqual(view.supported_impasse_kinds, subjectiveCrossOptionPreferenceImpasseKinds);
assert.match(view.deliberation_basis_catalog.basis_catalog_ref, /^phase74c_basis_/);
for (const dimension of ["goal", "value", "belief", "commitment"]) {
  assert.ok(
    view.deliberation_basis_catalog.refs_by_dimension[dimension].length > 0,
    `Phase74C basis catalog must expose ${dimension} references when source cognition provides them.`,
  );
}
assert.equal(view.deliberation_basis_catalog.semantic_content_duplicated, false);
assert.equal(view.deliberation_basis_catalog.commitment_is_defeasible_not_absolute, true);
assert.ok(view.cross_option_preference_view_hash);
assert.equal(JSON.stringify({ cognition, candidates, deliberation, prospection }), inputSnapshot);

assert.deepEqual(
  view.option_catalog.map((option) => option.action_id),
  candidates.map((candidate) => candidate.action_id),
);
for (const option of view.option_catalog) {
  assert.match(option.option_ref, /^phase74c_option_/);
  assert.match(option.action_ref, /^phase74a_action_/);
  assert.match(option.prospect_ref, /^phase74b_prospect_/);
  assert.equal(option.semantic_content_duplicated, false);
  assert.equal(option.candidate_membership_authority, false);
  assert.equal(option.selection_authority, false);
  assert.equal(option.consequence_branch_refs.every((ref) => /^phase74b_branch_/.test(ref)), true);
}

const pairKeys = new Set();
for (const comparison of view.pairwise_comparisons) {
  assert.match(comparison.comparison_ref, /^phase74c_comparison_/);
  assert.equal(comparison.comparison_status, "open_for_character_brain_qualitative_resolution");
  assert.deepEqual(comparison.allowed_relations, subjectiveCrossOptionPreferenceRelations);
  assert.deepEqual(comparison.allowed_impasse_kinds, subjectiveCrossOptionPreferenceImpasseKinds);
  assert.equal(comparison.preference_relation, "unresolved");
  assert.equal(comparison.relation_not_precomputed, true);
  assert.equal(comparison.total_order_not_required, true);
  assert.equal(comparison.unresolved_relation_allowed, true);
  assert.equal(comparison.incomparable_relation_allowed, true);
  assert.equal(comparison.individual_rejection_allowed, true);
  assert.equal(comparison.reject_both_allowed, true);
  assert.equal(comparison.semantic_content_duplicated, false);
  assert.equal(comparison.numeric_score_computed, false);
  assert.equal(comparison.winner_computed, false);
  assert.equal(comparison.first_candidate_default_forbidden, true);
  assert.notEqual(comparison.left_action_id, comparison.right_action_id);
  pairKeys.add([comparison.left_action_id, comparison.right_action_id].sort().join("::"));
  assert.equal(
    comparison.basis_catalog_ref,
    view.deliberation_basis_catalog.basis_catalog_ref,
  );
  assert.equal(Object.hasOwn(comparison, "relation"), false);
  assert.equal(Object.hasOwn(comparison, "score"), false);
  assert.equal(Object.hasOwn(comparison, "utility"), false);
  assert.equal(Object.hasOwn(comparison, "probability"), false);
  assert.equal(Object.hasOwn(comparison, "confidence"), false);
  assert.equal(Object.hasOwn(comparison, "selected_action_id"), false);
}
assert.equal(pairKeys.size, 3, "Phase74C must expose every unordered pair exactly once.");

assert.equal(view.preference_boundary.character_brain_owns_qualitative_preference_formation, true);
assert.equal(view.preference_boundary.character_brain_owns_final_action_choice, true);
assert.equal(view.preference_boundary.comparison_workspace_does_not_select_action, true);
assert.equal(view.preference_boundary.comparison_workspace_does_not_rank_actions, true);
assert.equal(view.preference_boundary.partial_preference_order_allowed, true);
assert.equal(view.preference_boundary.unresolved_relation_allowed, true);
assert.equal(view.preference_boundary.explicit_impasse_preserved, true);
assert.equal(view.preference_boundary.total_order_not_required, true);
assert.equal(view.preference_boundary.transitive_closure_not_computed, true);
assert.equal(view.preference_boundary.cyclic_preference_not_auto_repaired, true);
assert.equal(view.preference_boundary.hidden_tie_breaker_not_used, true);
assert.equal(view.preference_boundary.deterministic_action_winner_not_computed, true);
assert.equal(view.preference_boundary.numeric_utility_not_computed, true);
assert.equal(view.preference_boundary.numeric_probability_not_computed, true);
assert.equal(view.preference_boundary.numeric_confidence_not_computed, true);
assert.equal(view.preference_boundary.numeric_priority_score_not_computed, true);

const serialized = JSON.stringify(view);
for (const forbiddenDuplicate of [
  "和同伴一起向東側出口撤退",
  "繼續守住入口",
  "主動把敵人引離出口",
  "保護同伴",
  "敵人是否會從側門出現",
  "撤退時間可能變少",
]) {
  assert.equal(serialized.includes(forbiddenDuplicate), false);
}
assert.equal(serialized.includes("selected_action_id"), false);
assert.equal(serialized.includes("winner_action_id"), false);
assert.equal(view.information_boundary.raw_world_state_exposed, false);
assert.equal(view.information_boundary.hidden_causal_evidence_exposed, false);
assert.equal(view.information_boundary.other_character_private_cognition_exposed, false);

const repeated = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
  subjective_action_deliberation: deliberation,
  subjective_prospective_consequence_simulation: prospection,
});
assert.deepEqual(repeated, view);

const singleCandidates = [candidates[0]];
const singleDeliberation = phase74A(singleCandidates);
const singleProspection = phase74B(singleCandidates, singleDeliberation);
const single = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: singleCandidates,
  subjective_action_deliberation: singleDeliberation,
  subjective_prospective_consequence_simulation: singleProspection,
});
assert.equal(single.status, "single_action_no_cross_option_comparison_needed");
assert.equal(single.option_count, 1);
assert.equal(single.pairwise_comparison_count, 0);

const emptyCandidates = [];
const emptyDeliberation = phase74A(emptyCandidates);
const emptyProspection = phase74B(emptyCandidates, emptyDeliberation);
const empty = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: emptyCandidates,
  subjective_action_deliberation: emptyDeliberation,
  subjective_prospective_consequence_simulation: emptyProspection,
});
assert.equal(empty.status, "no_action_candidates_available");
assert.equal(empty.option_count, 0);
assert.equal(empty.pairwise_comparison_count, 0);

const forgedDeliberation = JSON.parse(JSON.stringify(deliberation));
forgedDeliberation.deliberation_view_hash = "forged";
assert.throws(
  () => buildWorldSimulationSubjectiveCrossOptionPreferenceView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: candidates,
    subjective_action_deliberation: forgedDeliberation,
    subjective_prospective_consequence_simulation: prospection,
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_PHASE74A_VIEW_INVALID",
);

const forgedProspection = JSON.parse(JSON.stringify(prospection));
forgedProspection.prospective_consequence_view_hash = "forged";
assert.throws(
  () => buildWorldSimulationSubjectiveCrossOptionPreferenceView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: candidates,
    subjective_action_deliberation: deliberation,
    subjective_prospective_consequence_simulation: forgedProspection,
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_PHASE74B_VIEW_INVALID",
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
assert.equal(brainInput.boundaries.subjective_cross_option_preference_resolution_v1_installed, true);
assert.equal(
  brainInput.subjective_cross_option_preference_resolution.version,
  subjectiveCrossOptionPreferenceCharacterViewVersion,
);
assert.equal(
  brainInput.subjective_cross_option_preference_resolution.source_deliberation_view_hash,
  brainInput.subjective_action_deliberation.deliberation_view_hash,
);
assert.equal(
  brainInput.subjective_cross_option_preference_resolution.source_prospection_view_hash,
  brainInput.subjective_prospective_consequence_simulation.prospective_consequence_view_hash,
);
assert.equal(
  Object.hasOwn(brainInput.subjective_cross_option_preference_resolution, "selected_action_id"),
  false,
);

console.log("Phase74C qualitative cross-option preference resolution tests passed.");
