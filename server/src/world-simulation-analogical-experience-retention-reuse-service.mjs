import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceRetentionReentryProjection,
  worldSimulationAnalogicalExperienceRetentionReentryVersion,
} from "./world-simulation-analogical-experience-retention-reentry-service.mjs";

export const worldSimulationAnalogicalExperienceRetentionReuseVersion =
  "phase80h-retained-adapted-analogy-reuse-deliberation-v1";

const maximumReuseDecisionCount = 16;
const maximumReferenceItemsPerKind = 8;

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
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function projectionHash(value, omittedKey) {
  const copy = cloneJson(value);
  delete copy[omittedKey];
  return hashAgentRunValue(copy);
}

function normalizeRefs(raw, allowed, label) {
  if (!Array.isArray(raw)) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_INVALID",
      `Phase80H ${label} must be an explicit bounded array of refs.`,
    );
  }
  const refs = raw.map(text);
  if (refs.length > maximumReferenceItemsPerKind
      || refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_OUT_OF_VIEW",
      `Phase80H ${label} contains duplicate or out-of-view refs.`,
    );
  }
  return [...refs].sort(compareText);
}

function publicCandidate(candidate) {
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    current_impasse_ref: candidate.current_impasse_ref,
    current_corresponding_method_ref: candidate.current_corresponding_method_ref,
    retained_method_skeleton: cloneJson(candidate.retained_method_skeleton),
    exact_current_cue_matches: array(candidate.exact_current_cue_matches).map((match) => ({
      retained_cue_ref: match.retained_cue_ref,
      current_cue_ref: match.current_cue_ref,
      cue_kind: match.cue_kind,
      exact_kind_and_content_match: match.exact_kind_and_content_match === true,
    })),
    unmatched_retained_context_cues: array(candidate.unmatched_retained_context_cues).map((cue) => ({
      retained_cue_ref: cue.retained_cue_ref,
      cue_kind: cue.cue_kind,
      content: cloneJson(cue.content),
      prior_adaptation_role: cue.prior_adaptation_role,
    })),
    current_additional_context_cues: array(candidate.current_additional_context_cues).map((cue) => ({
      current_cue_ref: cue.current_cue_ref,
      cue_kind: cue.cue_kind,
      content: cloneJson(cue.content),
    })),
    current_context_difference_present: candidate.current_context_difference_present === true,
    historical_method_outcome_assessment: candidate.historical_method_outcome_assessment,
    prior_subjective_outcome_is_candidate_evidence_only: true,
    prior_subjective_outcome_is_current_world_truth: false,
  };
}

export function buildWorldSimulationAnalogicalExperienceRetentionReuseResolverView(input = {}) {
  const source = assertWorldSimulationAnalogicalExperienceRetentionReentryProjection(
    input.source_phase80g_projection,
  );
  if (source.version !== worldSimulationAnalogicalExperienceRetentionReentryVersion) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_SOURCE_INVALID",
      "Phase80H requires the canonical Phase80G retention re-entry projection.",
    );
  }
  const view = {
    version: worldSimulationAnalogicalExperienceRetentionReuseVersion,
    character: source.character,
    current_turn_id: source.current_turn_id,
    retained_analogy_candidates: source.reentry_candidates.map(publicCandidate),
    response_contract: {
      output_field: "reuse_decisions",
      may_return_empty_array: true,
      required_fields: [
        "reentry_candidate_ref",
        "retain_matched_current_cue_refs",
        "drop_unmatched_retained_cue_refs",
        "incorporate_current_additional_cue_refs",
      ],
      maximum_reuse_decision_count: Math.min(
        maximumReuseDecisionCount,
        source.reentry_candidates.length,
      ),
      maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
      exact_context_requires_at_least_one_retained_current_cue: true,
      changed_context_requires_at_least_one_difference_decision: true,
      direct_method_rewrite_allowed: false,
      direct_preference_selection_allowed: false,
      direct_action_selection_allowed: false,
    },
    boundaries: {
      source_phase80g_only: true,
      same_character_prior_committed_case_only: true,
      historical_subjective_outcome_is_candidate_evidence_only: true,
      historical_subjective_outcome_is_current_world_truth: false,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      direct_method_rewrite_allowed: false,
      direct_preference_selection_allowed: false,
      direct_action_selection_allowed: false,
      semantic_method_revision_allowed: false,
      world_truth_authority: false,
      numeric_similarity_confidence_probability_utility_reward_requested: false,
      explanation_or_hidden_reasoning_requested: false,
      further_current_context_revalidation_required: true,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return view;
}

export function assertWorldSimulationAnalogicalExperienceRetentionReuseResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationAnalogicalExperienceRetentionReuseVersion
      || !text(view.character)
      || !text(view.current_turn_id)
      || !Array.isArray(view.retained_analogy_candidates)
      || !isObject(view.response_contract)
      || !isObject(view.boundaries)
      || !text(view.resolver_view_hash)
      || projectionHash(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_VIEW_INVALID",
      "Phase80H retention reuse resolver view is invalid.",
    );
  }
  return view;
}

function normalizeDecision(raw, candidateByRef) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_INVALID",
      "Phase80H reuse decision must be an object.",
    );
  }
  const allowedKeys = new Set([
    "reentry_candidate_ref",
    "retain_matched_current_cue_refs",
    "drop_unmatched_retained_cue_refs",
    "incorporate_current_additional_cue_refs",
  ]);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_AUTHORITY_FIELD_FORBIDDEN",
      "Phase80H reuse decision contains fields outside the bounded response contract.",
    );
  }
  const candidateRef = text(raw.reentry_candidate_ref);
  const candidate = candidateByRef.get(candidateRef);
  if (!candidateRef || !candidate) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_OUT_OF_VIEW",
      "Phase80H reuse decision references an unknown retained analogy candidate.",
    );
  }
  const matched = new Set(
    array(candidate.exact_current_cue_matches)
      .map((match) => text(match?.current_cue_ref))
      .filter(Boolean),
  );
  const unmatched = new Set(
    array(candidate.unmatched_retained_context_cues)
      .map((cue) => text(cue?.retained_cue_ref))
      .filter(Boolean),
  );
  const additional = new Set(
    array(candidate.current_additional_context_cues)
      .map((cue) => text(cue?.current_cue_ref))
      .filter(Boolean),
  );
  const retain = normalizeRefs(
    raw.retain_matched_current_cue_refs,
    matched,
    "retain_matched_current_cue_refs",
  );
  const drop = normalizeRefs(
    raw.drop_unmatched_retained_cue_refs,
    unmatched,
    "drop_unmatched_retained_cue_refs",
  );
  const incorporate = normalizeRefs(
    raw.incorporate_current_additional_cue_refs,
    additional,
    "incorporate_current_additional_cue_refs",
  );
  if (candidate.current_context_difference_present === true) {
    if (drop.length === 0 && incorporate.length === 0) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DIFFERENCE_UNADDRESSED",
        "Phase80H changed-context reuse must address at least one retained/current context difference.",
      );
    }
  } else if (retain.length === 0) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_SUPPORT_REQUIRED",
      "Phase80H exact-context reuse must retain at least one matched current cue.",
    );
  }
  return {
    reentry_candidate_ref: candidateRef,
    retain_matched_current_cue_refs: retain,
    drop_unmatched_retained_cue_refs: drop,
    incorporate_current_additional_cue_refs: incorporate,
  };
}

export function projectWorldSimulationAnalogicalExperienceRetentionReuse(input = {}) {
  const source = assertWorldSimulationAnalogicalExperienceRetentionReentryProjection(
    input.source_phase80g_projection,
  );
  const view = assertWorldSimulationAnalogicalExperienceRetentionReuseResolverView(
    input.resolver_view,
  );
  if (view.character !== source.character
      || view.current_turn_id !== source.current_turn_id) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_LINEAGE_MISMATCH",
      "Phase80H resolver view does not match the Phase80G character/turn lineage.",
    );
  }
  const rebuilt = buildWorldSimulationAnalogicalExperienceRetentionReuseResolverView({
    source_phase80g_projection: source,
  });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_VIEW_STALE",
      "Phase80H resolver view is stale or was not built from the exact Phase80G projection.",
    );
  }
  const rawDecisions = array(input.reuse_decisions);
  if (rawDecisions.length > maximumReuseDecisionCount
      || rawDecisions.length > source.reentry_candidates.length) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_INVALID",
      "Phase80H reuse decision count exceeds the bounded candidate set.",
    );
  }
  const candidateByRef = new Map(
    source.reentry_candidates.map((candidate) => [candidate.reentry_candidate_ref, candidate]),
  );
  const seen = new Set();
  const reuseIntents = rawDecisions.map((raw) => {
    const decision = normalizeDecision(raw, candidateByRef);
    if (seen.has(decision.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_OUT_OF_VIEW",
        "Phase80H accepts at most one reuse decision per retained analogy candidate.",
      );
    }
    seen.add(decision.reentry_candidate_ref);
    const candidate = candidateByRef.get(decision.reentry_candidate_ref);
    const identity = {
      version: worldSimulationAnalogicalExperienceRetentionReuseVersion,
      character: source.character,
      current_turn_id: source.current_turn_id,
      source_phase80g_projection_hash: source.projection_hash,
      source_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_impasse_ref: candidate.current_impasse_ref,
      current_corresponding_method_ref: candidate.current_corresponding_method_ref,
      retained_method_skeleton: cloneJson(candidate.retained_method_skeleton),
      historical_method_outcome_assessment: candidate.historical_method_outcome_assessment,
      retain_matched_current_cue_refs: decision.retain_matched_current_cue_refs,
      drop_unmatched_retained_cue_refs: decision.drop_unmatched_retained_cue_refs,
      incorporate_current_additional_cue_refs: decision.incorporate_current_additional_cue_refs,
    };
    const reuseIntentHash = hashAgentRunValue(identity);
    return {
      reuse_intent_ref: `phase80h_reuse_${reuseIntentHash.slice(0, 24)}`,
      reuse_intent_hash: reuseIntentHash,
      ...identity,
      historical_subjective_outcome_is_candidate_evidence_only: true,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      method_rewritten: false,
      preference_selected: false,
      action_selected: false,
      semantic_method_revision_performed: false,
      world_truth_authority: false,
      further_current_context_revalidation_required: true,
    };
  });
  reuseIntents.sort((left, right) => compareText(left.reuse_intent_ref, right.reuse_intent_ref));
  const projection = {
    version: worldSimulationAnalogicalExperienceRetentionReuseVersion,
    character: source.character,
    current_turn_id: source.current_turn_id,
    source_phase80g_projection_hash: source.projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    reuse_intent_count: reuseIntents.length,
    reuse_intents: reuseIntents,
    character_view: {
      source: "phase80h_retained_adapted_analogy_reuse_intents",
      retained_analogy_reuse_intents: reuseIntents.map((intent) => ({
        reuse_intent_ref: intent.reuse_intent_ref,
        current_impasse_ref: intent.current_impasse_ref,
        current_corresponding_method_ref: intent.current_corresponding_method_ref,
        retained_method_skeleton: cloneJson(intent.retained_method_skeleton),
        historical_method_outcome_assessment: intent.historical_method_outcome_assessment,
        retain_matched_current_cue_refs: cloneJson(intent.retain_matched_current_cue_refs),
        drop_unmatched_retained_cue_refs: cloneJson(intent.drop_unmatched_retained_cue_refs),
        incorporate_current_additional_cue_refs: cloneJson(intent.incorporate_current_additional_cue_refs),
        historical_subjective_outcome_is_candidate_evidence_only: true,
        advisory_only: true,
        further_current_context_revalidation_required: true,
      })),
      advisory_only: true,
      selected_action_authority: false,
      preference_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase80g_lineage_required: true,
      explicit_character_brain_reuse_decision_required: true,
      empty_decision_set_means_no_reuse: true,
      changed_context_requires_difference_handling: true,
      exact_context_requires_positive_matched_cue_support: true,
      historical_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_success_does_not_imply_current_success: true,
      counterevidence_and_ambiguous_cases_may_be_considered: true,
      method_rewrite_performed: false,
      preference_selection_performed: false,
      action_selection_performed: false,
      semantic_method_revision_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      further_current_context_revalidation_required: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

export function buildWorldSimulationAnalogicalExperienceRetentionReuseContract() {
  return Object.freeze({
    version: worldSimulationAnalogicalExperienceRetentionReuseVersion,
    phase: "Phase80H",
    status: "retained_adapted_analogy_reuse_deliberation_installed",
    source_owner: "Phase80G",
    source_same_character_prior_committed_case_only: true,
    explicit_character_brain_reuse_decision_required: true,
    refs_only_decision_contract: true,
    changed_context_requires_difference_handling: true,
    exact_context_requires_positive_matched_cue_support: true,
    historical_subjective_outcome_is_candidate_evidence_only: true,
    prior_success_does_not_imply_current_success: true,
    method_rewrite_allowed: false,
    preference_selection_allowed: false,
    action_selection_allowed: false,
    semantic_method_revision_allowed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    further_current_context_revalidation_required: true,
    maximum_reuse_decision_count: maximumReuseDecisionCount,
    maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
  });
}
