import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
  subjectiveActionDeliberationCharacterViewVersion,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
  subjectiveProspectiveConsequenceCharacterViewVersion,
} from "./world-simulation-subjective-prospective-consequence-service.mjs";

export const worldSimulationSubjectiveCrossOptionPreferenceVersion =
  "phase74c-qualitative-cross-option-preference-resolution-v1";
export const subjectiveCrossOptionPreferenceCharacterViewVersion =
  "phase74c-bounded-qualitative-cross-option-preference-character-view-v1";

export const subjectiveCrossOptionPreferenceRelations = Object.freeze([
  "prefer_left",
  "prefer_right",
  "indifferent",
  "incomparable",
  "reject_left",
  "reject_right",
  "reject_both",
  "unresolved",
]);

export const subjectiveCrossOptionPreferenceImpasseKinds = Object.freeze([
  "insufficient_preference_evidence",
  "tie",
  "conflict",
  "incomparable",
  "no_viable_option",
]);

const maximumActionCandidates = 24;
const maximumGroundingRefs = 48;
const maximumBranchRefsPerOption = 12;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function boundedString(value, label, maxLength = 240) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_INPUT_INVALID";
    throw error;
  }
  return text;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

const groundingDimensionByKind = Object.freeze({
  active_goal: "goal",
  value_context: "value",
  known_context: "belief",
  uncertain_context: "belief",
  current_action: "commitment",
  effective_action_commitment: "commitment",
  relationship_context: "relationship",
  decision_pressure: "pressure",
  emotion_context: "emotion",
  working_memory_focus: "working_memory",
  working_memory_active_context: "working_memory",
});

function emptyDimensionRefs() {
  return {
    goal: [],
    value: [],
    belief: [],
    commitment: [],
    relationship: [],
    pressure: [],
    emotion: [],
    working_memory: [],
  };
}

function buildDeliberationBasisCatalog(character, groundings) {
  const refsByDimension = emptyDimensionRefs();
  const groundingRefs = [];
  for (const grounding of array(groundings).slice(0, maximumGroundingRefs)) {
    const groundingRef = optionalString(grounding?.grounding_ref);
    if (!groundingRef) continue;
    groundingRefs.push(groundingRef);
    const dimension = groundingDimensionByKind[grounding?.grounding_kind];
    if (dimension) refsByDimension[dimension].push(groundingRef);
  }
  for (const dimension of Object.keys(refsByDimension)) {
    refsByDimension[dimension] = [...new Set(refsByDimension[dimension])]
      .sort(compareText);
  }
  const uniqueGroundingRefs = [...new Set(groundingRefs)].sort(compareText);
  const basisHash = hashAgentRunValue({
    version: worldSimulationSubjectiveCrossOptionPreferenceVersion,
    character,
    refs_by_dimension: refsByDimension,
    grounding_refs: uniqueGroundingRefs,
  });
  return {
    basis_catalog_ref: `phase74c_basis_${basisHash.slice(0, 24)}`,
    refs_by_dimension: refsByDimension,
    grounding_refs: uniqueGroundingRefs,
    semantic_content_duplicated: false,
    goal_value_belief_commitment_dimensions_explicit: true,
    commitment_source_is_current_action_context: true,
    implementation_intention_commitment_directly_exposed: false,
    commitment_is_defeasible_not_absolute: true,
    affective_and_social_context_advisory_only: true,
  };
}

function branchRefsByKind(prospect) {
  const output = {};
  for (const branch of array(prospect?.consequence_branches)
    .slice(0, maximumBranchRefsPerOption)) {
    const branchRef = optionalString(branch?.branch_ref);
    const branchKind = optionalString(branch?.branch_kind);
    if (!branchRef || !branchKind) continue;
    if (!output[branchKind]) output[branchKind] = [];
    output[branchKind].push(branchRef);
  }
  return Object.fromEntries(
    Object.entries(output)
      .sort(([left], [right]) => compareText(left, right))
      .map(([kind, refs]) => [kind, [...new Set(refs)].sort(compareText)]),
  );
}

function canonicalInputs(input, character) {
  const deliberation = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition: input.cognition,
    candidate_action_intents: input.candidate_action_intents,
  });
  const suppliedDeliberation = isObject(input.subjective_action_deliberation)
    ? input.subjective_action_deliberation
    : null;
  if (!suppliedDeliberation
      || suppliedDeliberation.version !== subjectiveActionDeliberationCharacterViewVersion
      || suppliedDeliberation.deliberation_view_hash !== deliberation.deliberation_view_hash) {
    const error = new Error(
      "Phase74C requires the exact canonical Phase74A subjective action deliberation view for the same character, cognition, and candidates.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_PHASE74A_VIEW_INVALID";
    throw error;
  }

  const prospection = buildWorldSimulationSubjectiveProspectiveConsequenceView({
    character,
    cognition: input.cognition,
    candidate_action_intents: input.candidate_action_intents,
    subjective_action_deliberation: deliberation,
  });
  const suppliedProspection = isObject(input.subjective_prospective_consequence_simulation)
    ? input.subjective_prospective_consequence_simulation
    : null;
  if (!suppliedProspection
      || suppliedProspection.version !== subjectiveProspectiveConsequenceCharacterViewVersion
      || suppliedProspection.prospective_consequence_view_hash
        !== prospection.prospective_consequence_view_hash) {
    const error = new Error(
      "Phase74C requires the exact canonical Phase74B prospective consequence view for the same character, cognition, and candidates.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_PHASE74B_VIEW_INVALID";
    throw error;
  }

  return { deliberation, prospection };
}

function optionRecord(actionOption, prospect) {
  const branchRefs = array(prospect?.consequence_branches)
    .map((branch) => optionalString(branch?.branch_ref))
    .filter(Boolean)
    .slice(0, maximumBranchRefsPerOption);
  return {
    action_id: actionOption.action_id,
    action_ref: actionOption.action_ref,
    prospect_ref: prospect.prospect_ref,
    consequence_branch_refs: branchRefs,
    consequence_branch_refs_by_kind: branchRefsByKind(prospect),
    semantic_content_duplicated: false,
    candidate_membership_authority: false,
    selection_authority: false,
    blocker_or_cost_branch_does_not_auto_reject: true,
  };
}

function comparisonRecord(character, left, right, basisCatalogRef) {
  const identity = {
    version: worldSimulationSubjectiveCrossOptionPreferenceVersion,
    character,
    left_action_ref: left.action_ref,
    right_action_ref: right.action_ref,
    left_prospect_ref: left.prospect_ref,
    right_prospect_ref: right.prospect_ref,
    basis_catalog_ref: basisCatalogRef,
  };
  const hash = hashAgentRunValue(identity);
  return {
    comparison_ref: `phase74c_comparison_${hash.slice(0, 24)}`,
    left_option_ref: left.option_ref,
    right_option_ref: right.option_ref,
    left_action_id: left.action_id,
    right_action_id: right.action_id,
    left_action_ref: left.action_ref,
    right_action_ref: right.action_ref,
    left_prospect_ref: left.prospect_ref,
    right_prospect_ref: right.prospect_ref,
    comparison_status: "open_for_character_brain_qualitative_resolution",
    basis_catalog_ref: basisCatalogRef,
    preference_relation: "unresolved",
    allowed_relations: [...subjectiveCrossOptionPreferenceRelations],
    allowed_impasse_kinds: [...subjectiveCrossOptionPreferenceImpasseKinds],
    relation_not_precomputed: true,
    total_order_not_required: true,
    unresolved_relation_allowed: true,
    incomparable_relation_allowed: true,
    individual_rejection_allowed: true,
    reject_both_allowed: true,
    semantic_content_duplicated: false,
    numeric_score_computed: false,
    winner_computed: false,
    first_candidate_default_forbidden: true,
  };
}

export function buildWorldSimulationSubjectiveCrossOptionPreferenceContract() {
  return Object.freeze({
    version: worldSimulationSubjectiveCrossOptionPreferenceVersion,
    phase: "Phase74C",
    status: "bounded_qualitative_goal_value_belief_commitment_conflict_deliberation_installed",
    phase74a_canonical_grounding_required: true,
    phase74b_canonical_prospection_required: true,
    pairwise_comparison_workspace_complete_for_bounded_candidate_set: true,
    goal_value_belief_commitment_basis_catalog_installed: true,
    implementation_intention_commitment_directly_exposed: false,
    current_action_used_as_bounded_commitment_context: true,
    commitment_is_defeasible_not_absolute: true,
    existing_commitment_may_constrain_but_not_auto_win: true,
    prospective_blocker_or_cost_does_not_auto_reject: true,
    supported_relations: subjectiveCrossOptionPreferenceRelations,
    supported_impasse_kinds: subjectiveCrossOptionPreferenceImpasseKinds,
    partial_preference_order_allowed: true,
    incomparability_or_unresolved_preference_allowed: true,
    indifference_allowed: true,
    individual_rejection_allowed: true,
    reject_both_allowed: true,
    preference_cycles_not_auto_repaired: true,
    transitive_closure_not_invented: true,
    hidden_tie_breaker_not_used: true,
    random_tie_breaker_not_used: true,
    first_candidate_default_not_used: true,
    emotion_relationship_pressure_may_inform_but_not_override_authority: true,
    numeric_utility_probability_confidence_score_modeled: false,
    deterministic_action_winner_computed: false,
    character_brain_remains_preference_and_final_choice_owner: true,
    prepared_turn_broker_remains_membership_and_submission_authority: true,
    causal_simulator_remains_action_outcome_owner: true,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    durable_choice_receipt_modeled: false,
  });
}

export function buildWorldSimulationSubjectiveCrossOptionPreferenceView(input = {}) {
  const character = boundedString(input.character, "character", 240);
  const candidates = array(input.candidate_action_intents);
  if (candidates.length > maximumActionCandidates) {
    const error = new Error(
      `Phase74C accepts at most ${maximumActionCandidates} action candidates.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_CANDIDATE_LIMIT_EXCEEDED";
    throw error;
  }

  const { deliberation, prospection } = canonicalInputs(input, character);
  const prospectByActionId = new Map(
    array(prospection.action_prospects).map((prospect) => [prospect.action_id, prospect]),
  );
  const basisCatalog = buildDeliberationBasisCatalog(
    character,
    deliberation.cognition_grounding_catalog,
  );

  const options = array(deliberation.action_options).map((actionOption, index) => {
    const prospect = prospectByActionId.get(actionOption.action_id);
    if (!prospect) {
      const error = new Error(
        `Phase74C action ${actionOption.action_id} is missing its canonical Phase74B prospect.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_CROSS_OPTION_PREFERENCE_PROSPECT_MISSING";
      throw error;
    }
    const base = optionRecord(actionOption, prospect);
    const optionHash = hashAgentRunValue({
      version: worldSimulationSubjectiveCrossOptionPreferenceVersion,
      character,
      action_ref: base.action_ref,
      prospect_ref: base.prospect_ref,
      position: index,
    });
    return {
      option_ref: `phase74c_option_${optionHash.slice(0, 24)}`,
      ...base,
    };
  });

  const comparisons = [];
  for (let leftIndex = 0; leftIndex < options.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < options.length; rightIndex += 1) {
      comparisons.push(comparisonRecord(
        character,
        options[leftIndex],
        options[rightIndex],
        basisCatalog.basis_catalog_ref,
      ));
    }
  }

  const expectedComparisonCount = options.length * (options.length - 1) / 2;
  const view = {
    version: subjectiveCrossOptionPreferenceCharacterViewVersion,
    source_version: worldSimulationSubjectiveCrossOptionPreferenceVersion,
    source_deliberation_version: deliberation.version,
    source_deliberation_view_hash: deliberation.deliberation_view_hash,
    source_prospection_version: prospection.version,
    source_prospection_view_hash: prospection.prospective_consequence_view_hash,
    character,
    status: options.length > 1
      ? "qualitative_pairwise_preference_workspace_ready"
      : options.length === 1
        ? "single_action_no_cross_option_comparison_needed"
        : "no_action_candidates_available",
    option_catalog: options,
    option_count: options.length,
    pairwise_comparisons: comparisons,
    pairwise_comparison_count: comparisons.length,
    expected_complete_pairwise_comparison_count: expectedComparisonCount,
    deliberation_basis_catalog: basisCatalog,
    shared_cognition_grounding_refs: basisCatalog.grounding_refs,
    supported_relations: [...subjectiveCrossOptionPreferenceRelations],
    supported_impasse_kinds: [...subjectiveCrossOptionPreferenceImpasseKinds],
    preference_boundary: {
      character_brain_owns_qualitative_preference_formation: true,
      character_brain_owns_final_action_choice: true,
      comparison_workspace_does_not_select_action: true,
      comparison_workspace_does_not_rank_actions: true,
      partial_preference_order_allowed: true,
      unresolved_relation_allowed: true,
      incomparable_relation_allowed: true,
      indifference_allowed: true,
      individual_rejection_allowed: true,
      reject_both_allowed: true,
      explicit_impasse_preserved: true,
      total_order_not_required: true,
      transitive_closure_not_computed: true,
      cyclic_preference_not_auto_repaired: true,
      hidden_tie_breaker_not_used: true,
      random_tie_breaker_not_used: true,
      first_candidate_default_not_used: true,
      existing_commitment_may_constrain_but_not_auto_win: true,
      blocker_or_cost_branch_does_not_auto_reject: true,
      deterministic_action_winner_not_computed: true,
      numeric_utility_not_computed: true,
      numeric_probability_not_computed: true,
      numeric_confidence_not_computed: true,
      numeric_priority_score_not_computed: true,
      durable_choice_receipt_deferred: true,
    },
    information_boundary: {
      phase74a_reference_lineage_preserved: true,
      phase74b_reference_lineage_preserved: true,
      candidate_semantic_content_duplicated: false,
      prospective_semantic_content_duplicated: false,
      cognition_semantic_content_duplicated: false,
      raw_world_state_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_private_cognition_exposed: false,
    },
  };
  view.cross_option_preference_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}
