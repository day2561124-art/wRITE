import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
} from "./world-simulation-subjective-prospective-consequence-service.mjs";
import {
  buildWorldSimulationSubjectiveCrossOptionPreferenceView,
} from "./world-simulation-subjective-cross-option-preference-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion =
  "phase81a-post-outcome-counterfactual-alternative-evidence-v1";

export const postOutcomeCounterfactualComparisonDirections = Object.freeze([
  "imagined_better_than_actual",
  "imagined_worse_than_actual",
  "comparison_unresolved",
]);

const maximumContexts = 24;
const maximumAlternativesPerContext = 23;
const maximumBranchRefsPerDecision = 12;
const maximumCollectionItems = 8;
const maximumObjectEntries = 12;
const maximumStringChars = 600;
const maximumValueDepth = 4;

const privateCandidateKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_world_event",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
  "resolver_view_hash",
  "projection_hash",
  "world_truth",
  "world_truth_verified",
  "objective_feasibility",
  "success_probability",
  "probability",
  "utility",
  "utility_score",
  "priority_score",
  "feasibility_score",
]);

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

function requiredString(value, label, maxLength = 600, code = "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_INPUT_INVALID") {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return normalized;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function sameCharacter(left, right) {
  const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  const l = normalize(left);
  return Boolean(l) && l === normalize(right);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function verifyPhase76AProjection(value, expectedTurnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
      || projection.phase !== "Phase76A"
      || projection.turn_id !== expectedTurnId
      || !Array.isArray(projection.character_experiences)
      || !text(projection.projection_hash)
      || !isObject(projection.boundaries)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_INVALID",
      "Phase81A requires the exact canonical current-turn Phase76A subjective perception projection.",
    );
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_HASH_MISMATCH",
      "Phase81A Phase76A projection hash verification failed.",
    );
  }
  if (projection.boundaries.projection_is_subjective_observation_not_world_truth !== true
      || projection.boundaries.result_label_auto_exposure !== false
      || projection.boundaries.causal_evidence_auto_exposure !== false) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_BOUNDARY_INVALID",
      "Phase81A rejects a Phase76A source that violates sealed subjective-outcome boundaries.",
    );
  }
  for (const [index, entry] of projection.character_experiences.entries()) {
    if (!isObject(entry)
        || entry.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
        || entry.turn_id !== expectedTurnId
        || !text(entry.subjective_perception_ref)
        || !text(entry.character)
        || !text(entry.action_id)
        || !isObject(entry.experience)
        || !Array.isArray(entry.source_outcome_hashes)
        || !Array.isArray(entry.source_transition_hashes)
        || entry.objective_result_label_exposed !== false
        || entry.causal_evidence_exposed !== false
        || entry.raw_result_interpreted_as_perceived_success_or_failure !== false) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_ENTRY_INVALID",
        `Phase81A Phase76A subjective experience ${index} is invalid.`,
      );
    }
    const identity = {
      version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
      turn_id: expectedTurnId,
      character: entry.character,
      action_id: entry.action_id,
      experience: cloneJson(entry.experience),
      source_outcome_hashes: cloneJson(entry.source_outcome_hashes),
      source_transition_hashes: cloneJson(entry.source_transition_hashes),
    };
    const expectedRef = `phase76a_post_outcome_${hashAgentRunValue(identity).slice(0, 24)}`;
    if (entry.subjective_perception_ref !== expectedRef) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_ENTRY_HASH_MISMATCH",
        "Phase81A Phase76A subjective experience identity verification failed.",
      );
    }
  }
  return projection;
}

function packetForCharacter(decisionPackets, character) {
  const matches = array(decisionPackets).filter((packet) => sameCharacter(packet?.character, character));
  if (matches.length !== 1) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_PACKET_INVALID",
      `Phase81A requires exactly one decision-time packet for ${character}.`,
    );
  }
  return matches[0];
}

function phase76AForSelection(projection, character, actionId) {
  const matches = array(projection.character_experiences).filter((entry) => (
    sameCharacter(entry?.character, character) && entry?.action_id === actionId
  ));
  if (matches.length > 1) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE76A_CARDINALITY_INVALID",
      `Phase81A found multiple Phase76A subjective outcomes for ${character}/${actionId}.`,
    );
  }
  return matches[0] ?? null;
}

function privateCandidateKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return privateCandidateKeys.has(normalized)
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.endsWith("_hash")
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids");
}

function boundedCandidateValue(value, depth = 0) {
  if (depth > maximumValueDepth) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized
      ? Array.from(normalized).slice(0, maximumStringChars).join("")
      : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maximumCollectionItems)
      .map((item) => boundedCandidateValue(item, depth + 1))
      .filter((item) => item !== null && item !== undefined);
  }
  if (!isObject(value)) return null;
  const output = {};
  for (const key of Object.keys(value).sort(compareText).slice(0, maximumObjectEntries)) {
    if (privateCandidateKey(key)) continue;
    const child = boundedCandidateValue(value[key], depth + 1);
    if (child === null || child === undefined) continue;
    if (Array.isArray(child) && child.length === 0) continue;
    if (isObject(child) && Object.keys(child).length === 0) continue;
    output[key] = child;
  }
  return output;
}

function candidateSummary(candidate) {
  const source = isObject(candidate) ? candidate : {};
  const summary = {
    intent: boundedCandidateValue(source.intent),
    prerequisites: boundedCandidateValue(array(source.prerequisites)),
    known_costs: boundedCandidateValue(array(source.known_costs)),
    blocked_by: boundedCandidateValue(array(source.blocked_by)),
  };
  for (const field of [
    "duration_estimate",
    "duration_ms",
    "duration_s",
    "target",
    "target_position",
    "movement",
    "door_interaction",
    "object_interaction",
    "attack",
    "defense",
    "projectile",
    "ability",
    "resource_commitment",
  ]) {
    const bounded = boundedCandidateValue(source[field]);
    if (bounded !== null && bounded !== undefined) {
      summary[field] = bounded;
    }
  }
  return summary;
}

function publicBranch(branch) {
  return {
    branch_ref: branch.branch_ref,
    branch_kind: branch.branch_kind,
    horizon: branch.horizon,
    epistemic_status: branch.epistemic_status,
    source_paths: cloneJson(array(branch.source_paths)),
    grounding_refs: cloneJson(array(branch.grounding_refs)),
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
}

function rebuildDecisionTimeViews(packet, receipt) {
  const deliberation = buildWorldSimulationSubjectiveActionDeliberationView({
    character: packet.character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
  });
  const prospection = buildWorldSimulationSubjectiveProspectiveConsequenceView({
    character: packet.character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
    subjective_action_deliberation: deliberation,
  });
  const preference = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
    character: packet.character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
    subjective_action_deliberation: deliberation,
    subjective_prospective_consequence_simulation: prospection,
  });
  if (receipt.deliberation_view_hash !== deliberation.deliberation_view_hash
      || receipt.prospective_consequence_view_hash !== prospection.prospective_consequence_view_hash
      || receipt.cross_option_preference_view_hash !== preference.cross_option_preference_view_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE74_LINEAGE_MISMATCH",
      "Phase81A decision-time Phase74A/B/C reconstruction does not match the committed Phase74D receipt.",
    );
  }
  const selectedAction = array(deliberation.action_options)
    .find((option) => option.action_id === receipt.action_id);
  const selectedProspect = array(prospection.action_prospects)
    .find((prospect) => prospect.action_id === receipt.action_id);
  const selectedOption = array(preference.option_catalog)
    .find((option) => option.action_id === receipt.action_id);
  if (!selectedAction || !selectedProspect || !selectedOption
      || selectedAction.action_ref !== receipt.action_ref
      || selectedProspect.prospect_ref !== receipt.prospect_ref
      || selectedOption.option_ref !== receipt.option_ref) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE74_SELECTION_MISMATCH",
      "Phase81A selected action does not resolve across the exact committed Phase74D lineage.",
    );
  }
  return { deliberation, prospection, preference };
}

function buildContext(packet, receipt, phase76AEntry) {
  const { deliberation, prospection, preference } = rebuildDecisionTimeViews(packet, receipt);
  const candidates = array(packet.candidate_action_intents);
  const candidatesById = new Map(candidates.map((candidate) => [candidate?.action_id, candidate]));
  const preferenceById = new Map(array(preference.option_catalog).map((option) => [option.action_id, option]));
  const alternatives = array(prospection.action_prospects)
    .filter((prospect) => prospect.action_id !== receipt.action_id)
    .slice(0, maximumAlternativesPerContext)
    .map((prospect) => {
      const option = preferenceById.get(prospect.action_id);
      const candidate = candidatesById.get(prospect.action_id);
      if (!option || !candidate) {
        fail(
          "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_ALTERNATIVE_LINEAGE_INVALID",
          `Phase81A could not resolve decision-time alternative ${prospect.action_id}.`,
        );
      }
      return {
        alternative_action_ref: prospect.action_ref,
        alternative_action_id: prospect.action_id,
        alternative_prospect_ref: prospect.prospect_ref,
        alternative_option_ref: option.option_ref,
        decision_time_candidate: candidateSummary(candidate),
        consequence_branches: array(prospect.consequence_branches).map(publicBranch),
        consequence_branch_count: array(prospect.consequence_branches).length,
        alternative_available_at_decision_time: true,
        alternative_was_selected: false,
        alternative_outcome_observed: false,
        branch_is_subjective_possibility_not_prediction: true,
      };
    });
  const identity = {
    version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
    character: receipt.character,
    phase74d_receipt_id: receipt.receipt_id,
    phase74d_receipt_hash: receipt.receipt_hash,
    phase76a_subjective_perception_ref: phase76AEntry.subjective_perception_ref,
    selected_action_ref: receipt.action_ref,
    selected_action_id: receipt.action_id,
    alternative_action_refs: alternatives.map((item) => item.alternative_action_ref),
  };
  const contextHash = hashAgentRunValue(identity);
  return {
    counterfactual_context_ref: `phase81a_context_${contextHash.slice(0, 24)}`,
    character: receipt.character,
    actual_selected_action: {
      action_ref: receipt.action_ref,
      action_id: receipt.action_id,
      prospect_ref: receipt.prospect_ref,
      option_ref: receipt.option_ref,
      subjective_perception_ref: phase76AEntry.subjective_perception_ref,
      subjective_experience: cloneJson(phase76AEntry.experience),
      actual_subjective_experience_is_world_truth: false,
    },
    decision_time_alternatives: alternatives,
    decision_time_alternative_count: alternatives.length,
    source_lineage: {
      phase74d_receipt_id: receipt.receipt_id,
      phase74d_receipt_hash: receipt.receipt_hash,
      phase74a_deliberation_view_hash: deliberation.deliberation_view_hash,
      phase74b_prospective_consequence_view_hash: prospection.prospective_consequence_view_hash,
      phase74c_cross_option_preference_view_hash: preference.cross_option_preference_view_hash,
      phase76a_subjective_perception_ref: phase76AEntry.subjective_perception_ref,
    },
  };
}

export function buildWorldSimulationPostOutcomeCounterfactualAlternativeEvidenceContract() {
  return Object.freeze({
    version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
    phase: "Phase81A",
    status: "bounded_post_outcome_counterfactual_alternative_evidence_installed",
    source_choice_owner: "Phase74D",
    source_decision_time_alternative_owner: "Phase74A_Phase74B_Phase74C",
    source_actual_subjective_outcome_owner: "Phase76A",
    exact_phase74d_receipt_lineage_required: true,
    exact_phase76a_projection_required: true,
    alternative_must_have_existed_at_decision_time: true,
    selected_action_may_not_be_reused_as_counterfactual_alternative: true,
    resolver_selects_only_visible_alternative_branch_refs_and_subjective_direction: true,
    supported_comparison_directions: [...postOutcomeCounterfactualComparisonDirections],
    counterfactual_world_re_simulation_performed: false,
    unchosen_action_outcome_observed: false,
    objective_counterfactual_truth_claimed: false,
    causal_superiority_claimed: false,
    numeric_regret_modeled: false,
    numeric_utility_reward_q_value_probability_modeled: false,
    automatic_preference_revision_allowed: false,
    automatic_action_selection_allowed: false,
    direct_semantic_revision_allowed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_action_selection_feedback_allowed: false,
    persistence_only_with_successful_world_turn_commit: true,
  });
}

export function buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView(input = {}) {
  const sessionId = requiredString(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const turnId = requiredString(input.turn_id, "turn_id", 240);
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_INPUT_INVALID",
      "Phase81A state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredString(input.world_state_hash, "world_state_hash", 128);
  const receiptBundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    input.subjective_choice_commitment_receipts,
    {
      world_simulation_session_id: sessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (receiptBundle.version !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_PHASE74D_INVALID",
      "Phase81A requires the canonical Phase74D receipt bundle.",
    );
  }
  const phase76A = verifyPhase76AProjection(
    input.post_outcome_subjective_perception_projection,
    turnId,
  );
  const decisionPackets = cloneJson(array(input.decision_packets));
  const contexts = [];
  for (const receipt of receiptBundle.receipts) {
    if (receipt.selection_kind !== "candidate_action_intent") continue;
    const phase76AEntry = phase76AForSelection(phase76A, receipt.character, receipt.action_id);
    if (!phase76AEntry) continue;
    const packet = packetForCharacter(decisionPackets, receipt.character);
    const context = buildContext(packet, receipt, phase76AEntry);
    if (context.decision_time_alternative_count > 0) contexts.push(context);
  }
  if (contexts.length > maximumContexts) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_CONTEXT_LIMIT",
      `Phase81A accepts at most ${maximumContexts} counterfactual contexts per turn.`,
    );
  }
  contexts.sort((left, right) => compareText(left.character, right.character));
  const view = {
    version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
    phase: "Phase81A",
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: receiptBundle.receipt_bundle_hash,
    source_phase76a_projection_hash: phase76A.projection_hash,
    status: contexts.length > 0
      ? "bounded_counterfactual_alternative_review_ready"
      : "no_eligible_post_outcome_counterfactual_context",
    counterfactual_contexts: contexts,
    counterfactual_context_count: contexts.length,
    supported_comparison_directions: [...postOutcomeCounterfactualComparisonDirections],
    response_contract: {
      output_shape: "array_of_context_alternative_branch_refs_and_subjective_direction",
      required_fields: [
        "counterfactual_context_ref",
        "alternative_action_ref",
        "alternative_branch_refs",
        "comparison_direction",
      ],
      alternative_branch_refs_must_be_explicit_array: true,
      better_or_worse_requires_at_least_one_visible_branch_ref: true,
      comparison_unresolved_may_use_empty_branch_refs: true,
      new_alternative_authoring_allowed: false,
      counterfactual_outcome_authoring_allowed: false,
      world_truth_authoring_allowed: false,
      causal_superiority_authoring_allowed: false,
      numeric_regret_utility_reward_q_value_probability_authoring_allowed: false,
      preference_or_action_authoring_allowed: false,
      semantic_revision_authoring_allowed: false,
    },
    boundaries: {
      decision_time_available_alternatives_only: true,
      actual_experience_is_phase76a_subjective_only: true,
      raw_causal_outcome_exposed: false,
      raw_world_state_exposed: false,
      hidden_causal_evidence_exposed: false,
      alternative_outcome_observed: false,
      counterfactual_branch_is_subjective_possibility_not_prediction: true,
      counterfactual_world_truth_claimed: false,
      same_turn_action_selection_feedback_allowed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}

export function assertWorldSimulationPostOutcomeCounterfactualAlternativeResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion
      || view.phase !== "Phase81A"
      || !text(view.world_simulation_session_id)
      || !text(view.turn_id)
      || !Number.isSafeInteger(view.state_revision)
      || !text(view.world_state_hash)
      || !text(view.source_phase74d_receipt_bundle_hash)
      || !text(view.source_phase76a_projection_hash)
      || !Array.isArray(view.counterfactual_contexts)
      || view.counterfactual_context_count !== view.counterfactual_contexts.length
      || !text(view.resolver_view_hash)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_VIEW_INVALID",
      "Phase81A requires an exact canonical counterfactual alternative resolver view.",
    );
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_VIEW_HASH_MISMATCH",
      "Phase81A resolver view hash verification failed.",
    );
  }
  return view;
}

const allowedDecisionFields = new Set([
  "counterfactual_context_ref",
  "alternative_action_ref",
  "alternative_branch_refs",
  "comparison_direction",
]);

const forbiddenDecisionFields = new Set([
  "action_id",
  "selected_action",
  "selection",
  "outcome",
  "result",
  "success",
  "failure",
  "would_succeed",
  "would_fail",
  "world_truth",
  "counterfactual_world_truth",
  "causal_credit",
  "causal_superiority",
  "regret",
  "regret_score",
  "utility",
  "utility_score",
  "reward",
  "q_value",
  "probability",
  "success_probability",
  "confidence",
  "preference",
  "preferred_action",
  "semantic_revision",
]);

function decisionArray(raw, field, index) {
  if (!Object.hasOwn(raw, field) || !Array.isArray(raw[field])) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
      `Phase81A decision ${index} requires explicit array field ${field}.`,
    );
  }
  const values = raw[field].map((value, valueIndex) => requiredString(
    value,
    `decisions[${index}].${field}[${valueIndex}]`,
    240,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
  ));
  if (values.length > maximumBranchRefsPerDecision) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_BRANCH_LIMIT",
      `Phase81A accepts at most ${maximumBranchRefsPerDecision} branch refs per decision.`,
    );
  }
  if (new Set(values).size !== values.length) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
      "Phase81A alternative_branch_refs must not contain duplicates.",
    );
  }
  return values;
}

function normalizeDecision(raw, view, index) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
      `Phase81A decision ${index} must be an object.`,
    );
  }
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length > 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_AUTHORITY_FIELD_FORBIDDEN",
      `Phase81A resolver may not author authority field(s): ${forbidden.join(", ")}.`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length > 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_FIELD_FORBIDDEN",
      `Phase81A decision contains unsupported field(s): ${unknown.join(", ")}.`,
    );
  }
  const contextRef = requiredString(
    raw.counterfactual_context_ref,
    `decisions[${index}].counterfactual_context_ref`,
    180,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
  );
  const alternativeActionRef = requiredString(
    raw.alternative_action_ref,
    `decisions[${index}].alternative_action_ref`,
    180,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
  );
  const alternativeBranchRefs = decisionArray(raw, "alternative_branch_refs", index);
  const comparisonDirection = requiredString(
    raw.comparison_direction,
    `decisions[${index}].comparison_direction`,
    80,
    "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_INVALID",
  );
  if (!postOutcomeCounterfactualComparisonDirections.includes(comparisonDirection)) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DIRECTION_INVALID",
      `Unsupported Phase81A comparison direction ${comparisonDirection}.`,
    );
  }
  const context = view.counterfactual_contexts.find(
    (item) => item.counterfactual_context_ref === contextRef,
  );
  if (!context) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_CONTEXT_OUT_OF_VIEW",
      `Phase81A decision references context outside resolver view: ${contextRef}.`,
    );
  }
  const alternative = context.decision_time_alternatives.find(
    (item) => item.alternative_action_ref === alternativeActionRef,
  );
  if (!alternative) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_ALTERNATIVE_OUT_OF_VIEW",
      `Phase81A decision references an alternative outside its context: ${alternativeActionRef}.`,
    );
  }
  const visibleBranchRefs = new Set(
    array(alternative.consequence_branches).map((branch) => branch.branch_ref),
  );
  for (const branchRef of alternativeBranchRefs) {
    if (!visibleBranchRefs.has(branchRef)) {
      fail(
        "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_BRANCH_OUT_OF_VIEW",
        `Phase81A decision references a branch outside the selected alternative: ${branchRef}.`,
      );
    }
  }
  if (comparisonDirection !== "comparison_unresolved" && alternativeBranchRefs.length === 0) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_SUPPORT_REQUIRED",
      "Phase81A better/worse comparison requires at least one visible alternative branch ref.",
    );
  }
  return {
    context,
    alternative,
    counterfactual_context_ref: contextRef,
    alternative_action_ref: alternativeActionRef,
    alternative_branch_refs: [...alternativeBranchRefs].sort(compareText),
    comparison_direction: comparisonDirection,
  };
}

export function projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence(input = {}) {
  const view = assertWorldSimulationPostOutcomeCounterfactualAlternativeResolverView(
    input.resolver_view,
  );
  const rebuilt = buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView({
    world_simulation_session_id: input.world_simulation_session_id,
    turn_id: input.turn_id,
    state_revision: input.state_revision,
    world_state_hash: input.world_state_hash,
    decision_packets: input.decision_packets,
    subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
    post_outcome_subjective_perception_projection:
      input.post_outcome_subjective_perception_projection,
  });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_VIEW_STALE",
      "Phase81A resolver view no longer matches its exact source lineage.",
    );
  }
  const rawDecisions = array(input.counterfactual_decisions);
  const maximumDecisionCount = view.counterfactual_contexts.reduce(
    (sum, context) => sum + context.decision_time_alternative_count,
    0,
  );
  if (rawDecisions.length > maximumDecisionCount) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_LIMIT",
      "Phase81A accepts at most one decision per visible decision-time alternative.",
    );
  }
  const decisions = rawDecisions.map((raw, index) => normalizeDecision(raw, view, index));
  const decisionKeys = decisions.map(
    (decision) => `${decision.counterfactual_context_ref}\u0000${decision.alternative_action_ref}`,
  );
  if (new Set(decisionKeys).size !== decisionKeys.length) {
    fail(
      "WORLD_SIMULATION_POST_OUTCOME_COUNTERFACTUAL_DECISION_DUPLICATE",
      "Phase81A accepts at most one comparison per visible alternative.",
    );
  }
  decisions.sort((left, right) => compareText(
    `${left.context.character}\u0000${left.alternative_action_ref}`,
    `${right.context.character}\u0000${right.alternative_action_ref}`,
  ));
  const evidence = decisions.map((decision) => {
    const identity = {
      version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
      turn_id: view.turn_id,
      character: decision.context.character,
      counterfactual_context_ref: decision.counterfactual_context_ref,
      source_phase74d_receipt_hash: decision.context.source_lineage.phase74d_receipt_hash,
      actual_selected_action_ref: decision.context.actual_selected_action.action_ref,
      actual_subjective_perception_ref:
        decision.context.actual_selected_action.subjective_perception_ref,
      alternative_action_ref: decision.alternative_action_ref,
      alternative_prospect_ref: decision.alternative.alternative_prospect_ref,
      alternative_option_ref: decision.alternative.alternative_option_ref,
      alternative_branch_refs: decision.alternative_branch_refs,
      comparison_direction: decision.comparison_direction,
    };
    const evidenceHash = hashAgentRunValue(identity);
    return {
      counterfactual_evidence_ref: `phase81a_evidence_${evidenceHash.slice(0, 24)}`,
      counterfactual_evidence_hash: evidenceHash,
      ...identity,
      alternative_available_at_decision_time: true,
      alternative_was_selected: false,
      alternative_outcome_observed: false,
      comparison_is_subjective_counterfactual_evidence_only: true,
      alternative_branch_is_subjective_possibility_not_prediction: true,
      counterfactual_world_truth_claimed: false,
      causal_superiority_claimed: false,
      numeric_regret_assigned: false,
      numeric_utility_reward_q_value_probability_assigned: false,
      automatic_preference_selected: false,
      action_selected: false,
      semantic_revision_performed: false,
      world_state_mutated: false,
    };
  });
  const projection = {
    version: worldSimulationPostOutcomeCounterfactualAlternativeEvidenceVersion,
    phase: "Phase81A",
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
    source_phase74d_receipt_bundle_hash: view.source_phase74d_receipt_bundle_hash,
    source_phase76a_projection_hash: view.source_phase76a_projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    counterfactual_evidence_count: evidence.length,
    counterfactual_evidence: evidence,
    audit: {
      exact_phase74d_decision_time_lineage_verified: true,
      exact_phase76a_subjective_outcome_lineage_verified: true,
      decision_time_available_alternatives_only: true,
      unchosen_alternative_outcome_observed: false,
      raw_causal_outcome_consumed: false,
      raw_world_state_consumed: false,
      hidden_causal_evidence_consumed: false,
      counterfactual_world_re_simulation_performed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_claimed: false,
      numeric_regret_utility_reward_q_value_probability_modeled: false,
      automatic_preference_or_action_revision: false,
      semantic_revision_performed: false,
      same_turn_action_selection_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}
