import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
  subjectiveActionDeliberationCharacterViewVersion,
} from "./world-simulation-subjective-action-deliberation-service.mjs";

export const worldSimulationSubjectiveProspectiveConsequenceVersion =
  "phase74b-subjective-prospective-consequence-simulation-v1";
export const subjectiveProspectiveConsequenceCharacterViewVersion =
  "phase74b-bounded-subjective-prospective-consequence-character-view-v1";

const maximumBranchesPerAction = 12;
const maximumReferencedGroundingsPerBranch = 8;

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
    error.code = "WORLD_SIMULATION_SUBJECTIVE_PROSPECTION_INPUT_INVALID";
    throw error;
  }
  return text;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function semanticPresent(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  return true;
}

function canonicalPhase74AView(input) {
  const expected = buildWorldSimulationSubjectiveActionDeliberationView({
    character: input.character,
    cognition: input.cognition,
    candidate_action_intents: input.candidate_action_intents,
  });
  const supplied = isObject(input.subjective_action_deliberation)
    ? input.subjective_action_deliberation
    : null;
  if (!supplied
      || supplied.version !== subjectiveActionDeliberationCharacterViewVersion
      || supplied.deliberation_view_hash !== expected.deliberation_view_hash) {
    const error = new Error(
      "Phase74B requires the exact canonical Phase74A subjective action deliberation view for the same character, cognition, and candidates.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_PROSPECTION_PHASE74A_VIEW_INVALID";
    throw error;
  }
  return expected;
}

function branchRecord({
  character,
  actionRef,
  actionId,
  branchKind,
  horizon,
  sourcePaths,
  semanticFingerprint,
  groundingRefs = [],
}) {
  const normalizedGroundingRefs = [...new Set(groundingRefs)]
    .sort(compareText)
    .slice(0, maximumReferencedGroundingsPerBranch);
  const identity = {
    version: worldSimulationSubjectiveProspectiveConsequenceVersion,
    character,
    action_ref: actionRef,
    action_id: actionId,
    branch_kind: branchKind,
    horizon,
    source_paths: [...new Set(sourcePaths)].sort(compareText),
    grounding_refs: normalizedGroundingRefs,
    semantic_fingerprint: semanticFingerprint,
  };
  const hash = hashAgentRunValue(identity);
  return {
    branch_ref: `phase74b_branch_${hash.slice(0, 24)}`,
    branch_kind: branchKind,
    horizon,
    epistemic_status: "subjective_possibility_not_prediction",
    source_paths: identity.source_paths,
    grounding_refs: normalizedGroundingRefs,
    semantic_content_duplicated: false,
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
}

function indexedBranches({
  character,
  actionRef,
  actionId,
  candidateIndex,
  values,
  field,
  branchKind,
  horizon,
}) {
  return array(values).map((value, index) => branchRecord({
    character,
    actionRef,
    actionId,
    branchKind,
    horizon,
    sourcePaths: [`candidate_action_intents[${candidateIndex}].${field}[${index}]`],
    semanticFingerprint: value,
  }));
}

function executionMechanics(candidate, candidateIndex) {
  const fields = [
    "target",
    "target_position",
    "movement",
    "door_interaction",
    "object_interaction",
    "attack",
    "defense",
    "projectile",
    "ability",
  ];
  const present = fields.filter((field) => semanticPresent(candidate[field]));
  if (!present.length) return null;
  return {
    source_paths: present.map((field) =>
      `candidate_action_intents[${candidateIndex}].${field}`),
    semantic_fingerprint: Object.fromEntries(
      present.map((field) => [field, cloneJson(candidate[field])]),
    ),
  };
}

function temporalResourceExposure(candidate, candidateIndex) {
  const fields = [
    "duration_estimate",
    "duration_ms",
    "duration_s",
    "resource_commitment",
  ];
  const present = fields.filter((field) => semanticPresent(candidate[field]));
  if (!present.length) return null;
  return {
    source_paths: present.map((field) =>
      `candidate_action_intents[${candidateIndex}].${field}`),
    semantic_fingerprint: Object.fromEntries(
      present.map((field) => [field, cloneJson(candidate[field])]),
    ),
  };
}

function branchesForAction({
  character,
  candidate,
  candidateIndex,
  actionOption,
  uncertaintyGroundingRefs,
}) {
  const branches = [
    branchRecord({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      branchKind: "intended_attempt_direction",
      horizon: "immediate",
      sourcePaths: [`candidate_action_intents[${candidateIndex}].intent`],
      semanticFingerprint: candidate.intent,
    }),
    ...indexedBranches({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      candidateIndex,
      values: candidate.blocked_by,
      field: "blocked_by",
      branchKind: "blocking_contingency",
      horizon: "immediate",
    }),
    ...indexedBranches({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      candidateIndex,
      values: candidate.prerequisites,
      field: "prerequisites",
      branchKind: "prerequisite_contingency",
      horizon: "immediate",
    }),
    ...indexedBranches({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      candidateIndex,
      values: candidate.known_costs,
      field: "known_costs",
      branchKind: "known_cost_exposure",
      horizon: "near_term",
    }),
  ];

  const mechanics = executionMechanics(candidate, candidateIndex);
  if (mechanics) {
    branches.push(branchRecord({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      branchKind: "execution_mechanics_contingency",
      horizon: "immediate",
      sourcePaths: mechanics.source_paths,
      semanticFingerprint: mechanics.semantic_fingerprint,
    }));
  }

  const exposure = temporalResourceExposure(candidate, candidateIndex);
  if (exposure) {
    branches.push(branchRecord({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      branchKind: "time_resource_exposure",
      horizon: "near_term",
      sourcePaths: exposure.source_paths,
      semanticFingerprint: exposure.semantic_fingerprint,
    }));
  }

  if (uncertaintyGroundingRefs.length) {
    branches.push(branchRecord({
      character,
      actionRef: actionOption.action_ref,
      actionId: actionOption.action_id,
      branchKind: "epistemic_uncertainty_contingency",
      horizon: "near_term",
      sourcePaths: ["cognition.uncertain"],
      semanticFingerprint: uncertaintyGroundingRefs,
      groundingRefs: uncertaintyGroundingRefs,
    }));
  }

  const retained = branches.slice(0, maximumBranchesPerAction);
  return {
    branches: retained,
    truncated: branches.length > retained.length,
    omitted_branch_count: Math.max(0, branches.length - retained.length),
  };
}

export function buildWorldSimulationSubjectiveProspectiveConsequenceContract() {
  return Object.freeze({
    version: worldSimulationSubjectiveProspectiveConsequenceVersion,
    phase: "Phase74B",
    status: "bounded_subjective_prospective_consequence_scaffolding_installed",
    phase74a_canonical_grounding_required: true,
    candidate_source_owner: "existing_world_action_proposer",
    candidate_generation_duplicated: false,
    character_brain_remains_final_action_choice_owner: true,
    action_outcome_owner: "causal_simulator",
    bounded_horizons: Object.freeze(["immediate", "near_term"]),
    distant_future_tree_search_modeled: false,
    intended_action_direction_is_not_expected_outcome: true,
    multiple_possible_branches_allowed: true,
    uncertainty_branch_preserved: true,
    qualitative_reference_scaffolds_only: true,
    semantic_source_content_duplicated: false,
    numeric_probability_confidence_utility_modeled: false,
    objective_feasibility_oracle_modeled: false,
    deterministic_action_winner_computed: false,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    durable_choice_receipt_modeled: false,
    cross_option_preference_resolution_modeled: false,
  });
}

export function buildWorldSimulationSubjectiveProspectiveConsequenceView(input = {}) {
  const character = boundedString(input.character, "character", 240);
  const candidates = array(input.candidate_action_intents);
  const deliberation = canonicalPhase74AView({
    ...input,
    character,
  });
  const optionById = new Map(
    array(deliberation.action_options).map((option) => [option.action_id, option]),
  );
  const uncertaintyGroundingRefs = array(deliberation.cognition_grounding_catalog)
    .filter((entry) => entry.grounding_kind === "uncertain_context")
    .map((entry) => entry.grounding_ref)
    .slice(0, maximumReferencedGroundingsPerBranch);

  const actionProspects = candidates.map((candidate, index) => {
    const actionId = boundedString(
      candidate?.action_id,
      `candidate_action_intents[${index}].action_id`,
      240,
    );
    const actionOption = optionById.get(actionId);
    if (!actionOption) {
      const error = new Error(
        `Phase74B candidate ${actionId} is not present in the canonical Phase74A action option catalog.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_PROSPECTION_ACTION_OUT_OF_CONTEXT";
      throw error;
    }
    const simulated = branchesForAction({
      character,
      candidate,
      candidateIndex: index,
      actionOption,
      uncertaintyGroundingRefs,
    });
    return {
      prospect_ref: `phase74b_prospect_${hashAgentRunValue({
        version: worldSimulationSubjectiveProspectiveConsequenceVersion,
        character,
        action_ref: actionOption.action_ref,
        branch_refs: simulated.branches.map((branch) => branch.branch_ref),
      }).slice(0, 24)}`,
      action_ref: actionOption.action_ref,
      action_id: actionId,
      simulation_mode: "bounded_qualitative_possible_consequences",
      consequence_branches: simulated.branches,
      consequence_branch_count: simulated.branches.length,
      branch_limit: maximumBranchesPerAction,
      branches_truncated: simulated.truncated,
      omitted_branch_count: simulated.omitted_branch_count,
      action_intent_not_promoted_to_outcome: true,
      no_branch_is_world_prediction: true,
    };
  });

  const view = {
    version: subjectiveProspectiveConsequenceCharacterViewVersion,
    source_version: worldSimulationSubjectiveProspectiveConsequenceVersion,
    source_deliberation_version: deliberation.version,
    source_deliberation_view_hash: deliberation.deliberation_view_hash,
    character,
    status: actionProspects.length
      ? "bounded_subjective_prospection_ready"
      : "no_action_candidates_available",
    simulation_horizon: {
      immediate: true,
      near_term: true,
      distant_future: false,
      exhaustive_tree_search: false,
    },
    action_prospects: actionProspects,
    action_prospect_count: actionProspects.length,
    simulation_boundary: {
      character_brain_may_reason_over_possible_consequences: true,
      multiple_branches_may_remain_unresolved: true,
      uncertainty_may_remain_unresolved: true,
      intended_direction_is_not_predicted_result: true,
      branch_membership_does_not_select_action: true,
      deterministic_action_winner_not_computed: true,
      cross_option_preference_resolution_deferred: true,
      durable_choice_receipt_deferred: true,
      numeric_probability_not_computed: true,
      numeric_confidence_not_computed: true,
      numeric_expected_utility_not_computed: true,
      objective_feasibility_not_asserted: true,
      causal_outcome_not_asserted: true,
    },
    information_boundary: {
      phase74a_reference_lineage_preserved: true,
      candidate_semantic_content_duplicated: false,
      cognition_semantic_content_duplicated: false,
      raw_world_state_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_private_cognition_exposed: false,
      branch_source_paths_reference_existing_character_facing_content: true,
    },
  };
  view.prospective_consequence_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}
