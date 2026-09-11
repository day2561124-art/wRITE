import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationPostOutcomeCounterfactualAlternativeResolverView,
  worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
} from "./world-simulation-post-outcome-counterfactual-alternative-evidence-service.mjs";

export const worldSimulationPostOutcomeCounterfactualAppraisalVersion =
  "phase81b-post-outcome-counterfactual-appraisal-v1";

export const postOutcomeCounterfactualAppraisalKinds = Object.freeze([
  "regret_like_counterfactual_concern",
  "relief_like_counterfactual_contrast",
  "reflective_uncertainty",
]);

export const postOutcomeCounterfactualPreparativeOrientations = Object.freeze([
  "future_improvement_candidate",
  "current_choice_reassurance_candidate",
  "no_preparative_takeaway",
]);

const maximumSalientBranchRefs = 12;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredString(
  value,
  label,
  maxLength = 240,
  code = "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_INPUT_INVALID",
) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(code, `${label} must be a non-empty string no longer than ${maxLength} characters.`);
  }
  return normalized;
}

function verifyPhase81AProjection(value, sourceView) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion
      || projection.phase !== "Phase81A"
      || projection.world_simulation_session_id !== sourceView.world_simulation_session_id
      || projection.turn_id !== sourceView.turn_id
      || projection.state_revision !== sourceView.state_revision
      || projection.world_state_hash !== sourceView.world_state_hash
      || projection.source_phase74d_receipt_bundle_hash !== sourceView.source_phase74d_receipt_bundle_hash
      || projection.source_phase76a_projection_hash !== sourceView.source_phase76a_projection_hash
      || projection.resolver_view_hash !== sourceView.resolver_view_hash
      || !Array.isArray(projection.counterfactual_evidence)
      || projection.counterfactual_evidence_count !== projection.counterfactual_evidence.length
      || !isObject(projection.audit)
      || !text(projection.projection_hash)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_INVALID",
      "Phase81B requires the exact canonical Phase81A counterfactual evidence projection and resolver lineage.",
    );
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_HASH_MISMATCH",
      "Phase81B Phase81A projection hash verification failed.",
    );
  }
  if (projection.audit.unchosen_alternative_outcome_observed !== false
      || projection.audit.raw_causal_outcome_consumed !== false
      || projection.audit.raw_world_state_consumed !== false
      || projection.audit.hidden_causal_evidence_consumed !== false
      || projection.audit.counterfactual_world_re_simulation_performed !== false
      || projection.audit.counterfactual_world_truth_claimed !== false
      || projection.audit.causal_superiority_claimed !== false
      || projection.audit.numeric_regret_utility_reward_q_value_probability_modeled !== false
      || projection.audit.automatic_preference_or_action_revision !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.same_turn_action_selection_feedback !== false) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_BOUNDARY_INVALID",
      "Phase81B rejects Phase81A evidence that violates the sealed subjective counterfactual boundary.",
    );
  }

  for (const [index, evidence] of projection.counterfactual_evidence.entries()) {
    if (!isObject(evidence)
        || !text(evidence.counterfactual_evidence_ref)
        || !text(evidence.counterfactual_evidence_hash)
        || evidence.version !== worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion
        || evidence.turn_id !== projection.turn_id
        || !text(evidence.character)
        || !text(evidence.counterfactual_context_ref)
        || !text(evidence.source_phase74d_receipt_hash)
        || !text(evidence.actual_selected_action_ref)
        || !text(evidence.actual_subjective_perception_ref)
        || !text(evidence.alternative_action_ref)
        || !text(evidence.alternative_prospect_ref)
        || !text(evidence.alternative_option_ref)
        || !Array.isArray(evidence.alternative_branch_refs)
        || !text(evidence.comparison_direction)
        || evidence.alternative_available_at_decision_time !== true
        || evidence.alternative_was_selected !== false
        || evidence.alternative_outcome_observed !== false
        || evidence.comparison_is_subjective_counterfactual_evidence_only !== true
        || evidence.alternative_branch_is_subjective_possibility_not_prediction !== true
        || evidence.counterfactual_world_truth_claimed !== false
        || evidence.causal_superiority_claimed !== false
        || evidence.numeric_regret_assigned !== false
        || evidence.numeric_utility_reward_q_value_probability_assigned !== false
        || evidence.automatic_preference_selected !== false
        || evidence.action_selected !== false
        || evidence.semantic_revision_performed !== false
        || evidence.world_state_mutated !== false) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_EVIDENCE_INVALID",
        `Phase81B Phase81A evidence ${index} is invalid.`,
      );
    }
    const identity = {
      version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
      turn_id: evidence.turn_id,
      character: evidence.character,
      counterfactual_context_ref: evidence.counterfactual_context_ref,
      source_phase74d_receipt_hash: evidence.source_phase74d_receipt_hash,
      actual_selected_action_ref: evidence.actual_selected_action_ref,
      actual_subjective_perception_ref: evidence.actual_subjective_perception_ref,
      alternative_action_ref: evidence.alternative_action_ref,
      alternative_prospect_ref: evidence.alternative_prospect_ref,
      alternative_option_ref: evidence.alternative_option_ref,
      alternative_branch_refs: cloneJson(evidence.alternative_branch_refs),
      comparison_direction: evidence.comparison_direction,
    };
    const expectedHash = hashAgentRunValue(identity);
    const expectedRef = `phase81a_evidence_${expectedHash.slice(0, 24)}`;
    if (evidence.counterfactual_evidence_hash !== expectedHash
        || evidence.counterfactual_evidence_ref !== expectedRef) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_PHASE81A_EVIDENCE_HASH_MISMATCH",
        `Phase81B Phase81A evidence ${index} identity verification failed.`,
      );
    }
  }
  return projection;
}

function resolveEvidenceContext(sourceView, evidence) {
  const context = sourceView.counterfactual_contexts.find(
    (item) => item.counterfactual_context_ref === evidence.counterfactual_context_ref,
  );
  if (!context || context.character !== evidence.character) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_CONTEXT_LINEAGE_INVALID",
      `Phase81B cannot resolve Phase81A context ${evidence.counterfactual_context_ref}.`,
    );
  }
  const alternative = context.decision_time_alternatives.find(
    (item) => item.alternative_action_ref === evidence.alternative_action_ref,
  );
  if (!alternative
      || context.actual_selected_action.action_ref !== evidence.actual_selected_action_ref
      || context.actual_selected_action.subjective_perception_ref !== evidence.actual_subjective_perception_ref
      || context.source_lineage.phase74d_receipt_hash !== evidence.source_phase74d_receipt_hash
      || alternative.alternative_prospect_ref !== evidence.alternative_prospect_ref
      || alternative.alternative_option_ref !== evidence.alternative_option_ref) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_CONTEXT_LINEAGE_INVALID",
      `Phase81B Phase81A evidence ${evidence.counterfactual_evidence_ref} does not match its exact bounded context lineage.`,
    );
  }
  const visibleBranches = new Map(
    array(alternative.consequence_branches).map((branch) => [branch.branch_ref, branch]),
  );
  const selectedBranches = evidence.alternative_branch_refs.map((branchRef) => {
    const branch = visibleBranches.get(branchRef);
    if (!branch) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_BRANCH_LINEAGE_INVALID",
        `Phase81B Phase81A evidence references branch outside the exact alternative: ${branchRef}.`,
      );
    }
    return cloneJson(branch);
  });
  return { context, alternative, selectedBranches };
}

export function buildWorldSimulationPostOutcomeCounterfactualAppraisalContract() {
  return Object.freeze({
    version: worldSimulationPostOutcomeCounterfactualAppraisalVersion,
    phase: "Phase81B",
    status: "bounded_counterfactual_appraisal_and_preparative_orientation_installed",
    source_evidence_owner: "Phase81A",
    appraisal_owner: "CharacterBrain",
    supported_appraisal_kinds: [...postOutcomeCounterfactualAppraisalKinds],
    supported_preparative_orientations: [...postOutcomeCounterfactualPreparativeOrientations],
    regret_like_requires_upward_subjective_comparison: true,
    relief_like_requires_downward_subjective_comparison: true,
    unresolved_requires_reflective_uncertainty: true,
    unchosen_outcome_observed: false,
    regret_or_relief_treated_as_objective_emotion_fact: false,
    causal_self_blame_inferred: false,
    numeric_emotion_intensity_modeled: false,
    counterfactual_world_truth_claimed: false,
    automatic_preference_revision_allowed: false,
    automatic_action_selection_allowed: false,
    automatic_belief_revision_allowed: false,
    direct_semantic_revision_allowed: false,
    direct_world_state_mutation_allowed: false,
    persistence_only_with_successful_world_turn_commit: true,
  });
}

export function buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView(input = {}) {
  const sourceView = assertWorldSimulationPostOutcomeCounterfactualAlternativeResolverView(
    input.counterfactual_alternative_resolver_view,
  );
  const phase81A = verifyPhase81AProjection(
    input.post_outcome_counterfactual_alternative_evidence,
    sourceView,
  );
  const contexts = phase81A.counterfactual_evidence.map((evidence) => {
    const { context, alternative, selectedBranches } = resolveEvidenceContext(sourceView, evidence);
    return {
      counterfactual_evidence_ref: evidence.counterfactual_evidence_ref,
      character: evidence.character,
      comparison_direction: evidence.comparison_direction,
      actual_selected_action: {
        action_ref: context.actual_selected_action.action_ref,
        action_id: context.actual_selected_action.action_id,
        subjective_perception_ref: context.actual_selected_action.subjective_perception_ref,
        subjective_experience: cloneJson(context.actual_selected_action.subjective_experience),
        actual_subjective_experience_is_world_truth: false,
      },
      imagined_alternative: {
        alternative_action_ref: alternative.alternative_action_ref,
        alternative_action_id: alternative.alternative_action_id,
        decision_time_candidate: cloneJson(alternative.decision_time_candidate),
        supporting_branches: selectedBranches,
        supporting_branch_refs: cloneJson(evidence.alternative_branch_refs),
        alternative_available_at_decision_time: true,
        alternative_was_selected: false,
        alternative_outcome_observed: false,
        branches_are_subjective_possibilities_not_predictions: true,
      },
      source_lineage: {
        counterfactual_context_ref: evidence.counterfactual_context_ref,
        counterfactual_evidence_hash: evidence.counterfactual_evidence_hash,
        source_phase74d_receipt_hash: evidence.source_phase74d_receipt_hash,
        source_phase76a_subjective_perception_ref: evidence.actual_subjective_perception_ref,
      },
    };
  });
  contexts.sort((left, right) => compareText(
    `${left.character}\u0000${left.counterfactual_evidence_ref}`,
    `${right.character}\u0000${right.counterfactual_evidence_ref}`,
  ));
  const view = {
    version: worldSimulationPostOutcomeCounterfactualAppraisalVersion,
    phase: "Phase81B",
    world_simulation_session_id: sourceView.world_simulation_session_id,
    turn_id: sourceView.turn_id,
    state_revision: sourceView.state_revision,
    world_state_hash: sourceView.world_state_hash,
    source_phase81a_resolver_view_hash: sourceView.resolver_view_hash,
    source_phase81a_projection_hash: phase81A.projection_hash,
    status: contexts.length > 0
      ? "bounded_counterfactual_appraisal_ready"
      : "no_counterfactual_evidence_to_appraise",
    appraisal_contexts: contexts,
    appraisal_context_count: contexts.length,
    supported_appraisal_kinds: [...postOutcomeCounterfactualAppraisalKinds],
    supported_preparative_orientations: [...postOutcomeCounterfactualPreparativeOrientations],
    response_contract: {
      output_shape: "array_of_evidence_appraisal_orientation_and_salient_branch_refs",
      required_fields: [
        "counterfactual_evidence_ref",
        "appraisal_kind",
        "preparative_orientation",
        "salient_branch_refs",
      ],
      regret_like_only_for_imagined_better: true,
      relief_like_only_for_imagined_worse: true,
      reflective_uncertainty_required_for_unresolved: true,
      salient_branch_refs_must_be_subset_of_phase81a_support: true,
      freeform_counterfactual_outcome_authoring_allowed: false,
      causal_blame_authoring_allowed: false,
      numeric_emotion_or_utility_authoring_allowed: false,
      preference_action_belief_semantic_revision_authoring_allowed: false,
    },
    boundaries: {
      source_phase81a_evidence_only: true,
      raw_causal_outcome_exposed: false,
      raw_world_state_exposed: false,
      unchosen_outcome_observed: false,
      regret_relief_labels_are_subjective_appraisal_not_forgone_outcome_fact: true,
      causal_self_blame_inferred: false,
      counterfactual_world_truth_claimed: false,
      same_turn_action_selection_feedback_allowed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}

export function assertWorldSimulationPostOutcomeCounterfactualAppraisalResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationPostOutcomeCounterfactualAppraisalVersion
      || view.phase !== "Phase81B"
      || !text(view.world_simulation_session_id)
      || !text(view.turn_id)
      || !Number.isSafeInteger(view.state_revision)
      || !text(view.world_state_hash)
      || !text(view.source_phase81a_resolver_view_hash)
      || !text(view.source_phase81a_projection_hash)
      || !Array.isArray(view.appraisal_contexts)
      || view.appraisal_context_count !== view.appraisal_contexts.length
      || !text(view.resolver_view_hash)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_VIEW_INVALID",
      "Phase81B requires an exact canonical counterfactual appraisal resolver view.",
    );
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_VIEW_HASH_MISMATCH",
      "Phase81B resolver view hash verification failed.",
    );
  }
  return view;
}

const allowedDecisionFields = new Set([
  "counterfactual_evidence_ref",
  "appraisal_kind",
  "preparative_orientation",
  "salient_branch_refs",
]);

const forbiddenDecisionFields = new Set([
  "outcome",
  "result",
  "success",
  "failure",
  "would_succeed",
  "would_fail",
  "world_truth",
  "counterfactual_world_truth",
  "causal_blame",
  "self_blame",
  "causal_credit",
  "causal_superiority",
  "regret",
  "regret_score",
  "relief",
  "relief_score",
  "emotion_intensity",
  "affect_score",
  "utility",
  "utility_score",
  "reward",
  "q_value",
  "probability",
  "confidence",
  "preference",
  "preferred_action",
  "action",
  "selected_action",
  "belief_revision",
  "semantic_revision",
  "memory_revision",
  "goal_revision",
]);

function decisionArray(raw, field, index) {
  if (!Object.hasOwn(raw, field) || !Array.isArray(raw[field])) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
      `Phase81B decision ${index} requires explicit array field ${field}.`,
    );
  }
  const values = raw[field].map((value, valueIndex) => requiredString(
    value,
    `decisions[${index}].${field}[${valueIndex}]`,
    240,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
  ));
  if (values.length > maximumSalientBranchRefs || new Set(values).size !== values.length) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_BRANCH_REFS_INVALID",
      `Phase81B ${field} must contain at most ${maximumSalientBranchRefs} unique refs.`,
    );
  }
  return values;
}

function assertDirectionalCompatibility(context, appraisalKind, preparativeOrientation, salientBranchRefs) {
  const direction = context.comparison_direction;
  if (direction === "imagined_better_than_actual") {
    if (!["regret_like_counterfactual_concern", "reflective_uncertainty"].includes(appraisalKind)) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
        "Phase81B upward counterfactual evidence may only support regret-like concern or reflective uncertainty.",
      );
    }
    if (appraisalKind === "regret_like_counterfactual_concern") {
      if (!["future_improvement_candidate", "no_preparative_takeaway"].includes(preparativeOrientation)) {
        fail(
          "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_ORIENTATION_MISMATCH",
          "Phase81B regret-like concern may only mark future improvement as a candidate or no preparative takeaway.",
        );
      }
      if (salientBranchRefs.length === 0) {
        fail(
          "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_SUPPORT_REQUIRED",
          "Phase81B regret-like concern requires at least one Phase81A supporting branch ref.",
        );
      }
    } else if (preparativeOrientation !== "no_preparative_takeaway") {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_ORIENTATION_MISMATCH",
        "Phase81B reflective uncertainty cannot directly claim a preparative orientation.",
      );
    }
    return;
  }
  if (direction === "imagined_worse_than_actual") {
    if (!["relief_like_counterfactual_contrast", "reflective_uncertainty"].includes(appraisalKind)) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
        "Phase81B downward counterfactual evidence may only support relief-like contrast or reflective uncertainty.",
      );
    }
    if (appraisalKind === "relief_like_counterfactual_contrast") {
      if (!["current_choice_reassurance_candidate", "no_preparative_takeaway"].includes(preparativeOrientation)) {
        fail(
          "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_ORIENTATION_MISMATCH",
          "Phase81B relief-like contrast may only mark current-choice reassurance as a candidate or no preparative takeaway.",
        );
      }
      if (salientBranchRefs.length === 0) {
        fail(
          "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_SUPPORT_REQUIRED",
          "Phase81B relief-like contrast requires at least one Phase81A supporting branch ref.",
        );
      }
    } else if (preparativeOrientation !== "no_preparative_takeaway") {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_ORIENTATION_MISMATCH",
        "Phase81B reflective uncertainty cannot directly claim a preparative orientation.",
      );
    }
    return;
  }
  if (direction === "comparison_unresolved") {
    if (appraisalKind !== "reflective_uncertainty"
        || preparativeOrientation !== "no_preparative_takeaway") {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_MISMATCH",
        "Phase81B unresolved comparison requires reflective uncertainty with no preparative takeaway.",
      );
    }
    return;
  }
  fail(
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DIRECTION_INVALID",
    `Phase81B does not recognize Phase81A comparison direction ${direction}.`,
  );
}

function normalizeDecision(raw, view, index) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
      `Phase81B decision ${index} must be an object.`,
    );
  }
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length > 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_AUTHORITY_FIELD_FORBIDDEN",
      `Phase81B resolver may not author authority field(s): ${forbidden.join(", ")}.`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length > 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_FIELD_FORBIDDEN",
      `Phase81B decision contains unsupported field(s): ${unknown.join(", ")}.`,
    );
  }
  const evidenceRef = requiredString(
    raw.counterfactual_evidence_ref,
    `decisions[${index}].counterfactual_evidence_ref`,
    180,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
  );
  const appraisalKind = requiredString(
    raw.appraisal_kind,
    `decisions[${index}].appraisal_kind`,
    100,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
  );
  const preparativeOrientation = requiredString(
    raw.preparative_orientation,
    `decisions[${index}].preparative_orientation`,
    100,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_INVALID",
  );
  if (!postOutcomeCounterfactualAppraisalKinds.includes(appraisalKind)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_KIND_INVALID",
      `Unsupported Phase81B appraisal kind ${appraisalKind}.`,
    );
  }
  if (!postOutcomeCounterfactualPreparativeOrientations.includes(preparativeOrientation)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_ORIENTATION_INVALID",
      `Unsupported Phase81B preparative orientation ${preparativeOrientation}.`,
    );
  }
  const salientBranchRefs = decisionArray(raw, "salient_branch_refs", index);
  const context = view.appraisal_contexts.find(
    (item) => item.counterfactual_evidence_ref === evidenceRef,
  );
  if (!context) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_EVIDENCE_OUT_OF_VIEW",
      `Phase81B decision references evidence outside resolver view: ${evidenceRef}.`,
    );
  }
  const visibleBranchRefs = new Set(context.imagined_alternative.supporting_branch_refs);
  for (const branchRef of salientBranchRefs) {
    if (!visibleBranchRefs.has(branchRef)) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_BRANCH_OUT_OF_VIEW",
        `Phase81B decision references a branch outside the Phase81A support set: ${branchRef}.`,
      );
    }
  }
  assertDirectionalCompatibility(
    context,
    appraisalKind,
    preparativeOrientation,
    salientBranchRefs,
  );
  return {
    context,
    counterfactual_evidence_ref: evidenceRef,
    appraisal_kind: appraisalKind,
    preparative_orientation: preparativeOrientation,
    salient_branch_refs: [...salientBranchRefs].sort(compareText),
  };
}

export function projectWorldSimulationPostOutcomeCounterfactualAppraisal(input = {}) {
  const view = assertWorldSimulationPostOutcomeCounterfactualAppraisalResolverView(
    input.resolver_view,
  );
  const rebuilt = buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
    counterfactual_alternative_resolver_view:
      input.counterfactual_alternative_resolver_view,
    post_outcome_counterfactual_alternative_evidence:
      input.post_outcome_counterfactual_alternative_evidence,
  });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_VIEW_STALE",
      "Phase81B resolver view no longer matches its exact Phase81A source lineage.",
    );
  }
  const rawDecisions = array(input.appraisal_decisions);
  if (rawDecisions.length > view.appraisal_context_count) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_LIMIT",
      "Phase81B accepts at most one appraisal decision per visible Phase81A evidence record.",
    );
  }
  const decisions = rawDecisions.map((raw, index) => normalizeDecision(raw, view, index));
  const refs = decisions.map((decision) => decision.counterfactual_evidence_ref);
  if (new Set(refs).size !== refs.length) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_APPRAISAL_DECISION_DUPLICATE",
      "Phase81B accepts at most one appraisal per Phase81A evidence record.",
    );
  }
  decisions.sort((left, right) => compareText(
    `${left.context.character}\u0000${left.counterfactual_evidence_ref}`,
    `${right.context.character}\u0000${right.counterfactual_evidence_ref}`,
  ));
  const appraisals = decisions.map((decision) => {
    const identity = {
      version: worldSimulationPostOutcomeCounterfactualAppraisalVersion,
      turn_id: view.turn_id,
      character: decision.context.character,
      counterfactual_evidence_ref: decision.counterfactual_evidence_ref,
      counterfactual_evidence_hash: decision.context.source_lineage.counterfactual_evidence_hash,
      actual_selected_action_ref: decision.context.actual_selected_action.action_ref,
      alternative_action_ref: decision.context.imagined_alternative.alternative_action_ref,
      comparison_direction: decision.context.comparison_direction,
      appraisal_kind: decision.appraisal_kind,
      preparative_orientation: decision.preparative_orientation,
      salient_branch_refs: decision.salient_branch_refs,
    };
    const appraisalHash = hashAgentRunValue(identity);
    return {
      counterfactual_appraisal_ref: `phase81b_appraisal_${appraisalHash.slice(0, 24)}`,
      counterfactual_appraisal_hash: appraisalHash,
      ...identity,
      appraisal_is_subjective_not_forgone_outcome_fact: true,
      unchosen_outcome_observed: false,
      causal_self_blame_inferred: false,
      causal_superiority_inferred: false,
      numeric_emotion_intensity_assigned: false,
      numeric_regret_relief_assigned: false,
      automatic_preference_revision_performed: false,
      action_selected: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      memory_rewrite_performed: false,
      world_state_mutated: false,
    };
  });
  const projection = {
    version: worldSimulationPostOutcomeCounterfactualAppraisalVersion,
    phase: "Phase81B",
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
    source_phase81a_resolver_view_hash: view.source_phase81a_resolver_view_hash,
    source_phase81a_projection_hash: view.source_phase81a_projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    counterfactual_appraisal_count: appraisals.length,
    counterfactual_appraisals: appraisals,
    audit: {
      source_phase81a_lineage_verified: true,
      unchosen_outcome_observed: false,
      raw_causal_outcome_consumed: false,
      raw_world_state_consumed: false,
      regret_relief_are_subjective_appraisal_not_objective_forgone_outcome_fact: true,
      causal_self_blame_inferred: false,
      counterfactual_world_truth_claimed: false,
      numeric_emotion_regret_relief_utility_reward_q_value_probability_modeled: false,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      same_turn_action_selection_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}
