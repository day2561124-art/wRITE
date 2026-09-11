import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-reentry-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion =
  "phase81o-counterfactual-linked-experience-reuse-outcome-deliberation-v1";

const maximumReuseDecisionCount = 32;
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
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function projectionHash(value, field = "projection_hash") {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function normalizeRefs(raw, allowed, label) {
  if (!Array.isArray(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_INVALID",
      `Phase81O ${label} must be an explicit bounded array of refs.`,
    );
  }
  const refs = raw.map(text);
  if (refs.length > maximumReferenceItemsPerKind
      || refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_OUT_OF_VIEW",
      `Phase81O ${label} contains duplicate or out-of-view refs.`,
    );
  }
  return [...refs].sort(compareText);
}

function publicCandidate(candidate) {
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    current_action_id: candidate.current_action_id,
    retained_reuse_action_id: candidate.retained_reuse_action_id,
    handled_context_difference_kinds: cloneJson(candidate.handled_context_difference_kinds),
    prior_linked_case_subjective_experience:
      cloneJson(candidate.prior_linked_case_subjective_experience),
    prior_reuse_action_subjective_experience:
      cloneJson(candidate.prior_reuse_action_subjective_experience),
    exact_current_cue_matches:
      array(candidate.exact_current_cue_matches).map((match) => ({
        retained_cue_ref: match.retained_cue_ref,
        current_cue_ref: match.current_cue_ref,
        cue_kind: match.cue_kind,
        action_defining: match.action_defining === true,
        exact_kind_and_content_match: true,
      })),
    unmatched_retained_context_signatures:
      array(candidate.unmatched_retained_context_signatures).map((cue) => ({
        retained_cue_ref: cue.retained_cue_ref,
        cue_kind: cue.cue_kind,
        prior_retention_role: cue.prior_retention_role,
        action_defining: cue.action_defining === true,
      })),
    current_additional_candidate_cues:
      array(candidate.current_additional_candidate_cues).map((cue) => ({
        current_cue_ref: cue.cue_ref,
        cue_kind: cue.cue_kind,
        content: cloneJson(cue.content),
        action_defining: cue.action_defining === true,
      })),
    current_context_difference_present: candidate.current_context_difference_present === true,
    source_monitoring: {
      historical_counterfactual_source: "imagined_decision_time_possibility",
      prior_linked_case_outcome_source: "prior_experienced_subjective_outcome",
      prior_reuse_intent_source: "prior_subjective_deliberative_reuse_intent",
      prior_reuse_selection_source: "prior_actual_selected_action_lineage",
      prior_reuse_outcome_source: "prior_reuse_experienced_subjective_outcome",
      current_reentry_source: "canonical_phase81n_reentry_candidate",
      sources_may_not_be_collapsed: true,
    },
    prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
    prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
    prior_outcomes_may_not_be_compared_as_effectiveness_proof: true,
    reuse_effectiveness_inferred: false,
    direct_action_selection_allowed: false,
  };
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationContract() {
  return deepFreeze({
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
    phase: "Phase81O",
    status: "retained_reuse_outcome_deliberative_reuse_installed",
    source_reentry_owner: "Phase81N",
    exact_phase81n_projection_required: true,
    canonical_phase81m_world_history_lineage_revalidated_by_source: true,
    exact_current_action_defining_support_required: true,
    changed_context_requires_explicit_difference_handling: true,
    prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
    prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
    prior_outcomes_compared_for_effectiveness: false,
    repeated_reuse_counts_as_effectiveness_evidence: false,
    historical_counterfactual_truth_evaluated: false,
    reuse_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
    preference_selection_performed: false,
    action_selection_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    direct_world_state_mutation_allowed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    same_snapshot_formal_deliberation_required: true,
    maximum_reuse_decision_count: maximumReuseDecisionCount,
    maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
  });
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView(
  input = {},
) {
  const source = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    input.source_phase81n_projection,
    input.expected_source ?? {},
  );
  if (source.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SOURCE_INVALID",
      "Phase81O requires the canonical Phase81N reuse-outcome re-entry projection.",
    );
  }
  const view = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
    character: source.character,
    current_turn_id: source.current_turn_id,
    reuse_outcome_candidates: source.reentry_candidates.map(publicCandidate),
    response_contract: {
      output_field: "reuse_outcome_deliberation_decisions",
      may_return_empty_array: true,
      omitted_candidate_means_no_reuse: true,
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
      reuse_requires_action_defining_exact_current_support: true,
      changed_context_requires_at_least_one_difference_decision: true,
      effectiveness_judgment_allowed: false,
      direct_preference_selection_allowed: false,
      direct_action_selection_allowed: false,
    },
    boundaries: {
      source_phase81n_only: true,
      exact_phase81m_history_lineage_revalidated_by_phase81n: true,
      prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
      prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
      prior_outcomes_compared_for_effectiveness: false,
      repeated_reuse_counts_as_effectiveness_evidence: false,
      historical_counterfactual_truth_evaluated: false,
      reuse_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      direct_preference_selection_allowed: false,
      direct_action_selection_allowed: false,
      belief_revision_allowed: false,
      semantic_revision_allowed: false,
      subjective_memory_rewrite_allowed: false,
      world_truth_authority: false,
      numeric_similarity_confidence_probability_utility_reward_requested: false,
      explanation_or_hidden_reasoning_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView(
  value,
) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion
      || !text(view.character)
      || !text(view.current_turn_id)
      || !Array.isArray(view.reuse_outcome_candidates)
      || !isObject(view.response_contract)
      || !isObject(view.boundaries)
      || !text(view.resolver_view_hash)
      || projectionHash(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_VIEW_INVALID",
      "Phase81O reuse-outcome deliberation resolver view is invalid.",
    );
  }
  return deepFreeze(view);
}

function normalizeDecision(raw, candidateByRef) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_INVALID",
      "Phase81O deliberative reuse decision must be an object.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
      "Phase81O decision contains fields outside the bounded refs-only response contract.",
    );
  }
  const candidateRef = text(raw.reentry_candidate_ref);
  const candidate = candidateByRef.get(candidateRef);
  if (!candidateRef || !candidate) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_OUT_OF_VIEW",
      "Phase81O decision references an unknown Phase81N candidate.",
    );
  }
  const matchedEntries = array(candidate.exact_current_cue_matches);
  const matched = new Map(
    matchedEntries
      .map((match) => [text(match?.current_cue_ref), match])
      .filter(([ref]) => Boolean(ref)),
  );
  const unmatched = new Set(
    array(candidate.unmatched_retained_context_signatures)
      .map((cue) => text(cue?.retained_cue_ref))
      .filter(Boolean),
  );
  const additional = new Set(
    array(candidate.current_additional_candidate_cues)
      .map((cue) => text(cue?.cue_ref))
      .filter(Boolean),
  );
  const retain = normalizeRefs(
    raw.retain_matched_current_cue_refs,
    new Set(matched.keys()),
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
  if (!retain.some((ref) => matched.get(ref)?.action_defining === true)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SUPPORT_REQUIRED",
      "Phase81O reuse requires at least one retained action-defining exact current cue.",
    );
  }
  if (candidate.current_context_difference_present === true
      && drop.length === 0
      && incorporate.length === 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DIFFERENCE_UNADDRESSED",
      "Phase81O changed-context reuse must explicitly address at least one retained/current difference.",
    );
  }
  return {
    reentry_candidate_ref: candidateRef,
    retain_matched_current_cue_refs: retain,
    drop_unmatched_retained_cue_refs: drop,
    incorporate_current_additional_cue_refs: incorporate,
  };
}

function characterViewFor(intents) {
  return {
    source: "phase81o_counterfactual_linked_reuse_outcome_deliberative_intents",
    reuse_outcome_deliberative_intents: intents.map((intent) => ({
      current_action_id: intent.current_action_id,
      retained_reuse_action_id: intent.retained_reuse_action_id,
      handled_context_difference_kinds: cloneJson(intent.handled_context_difference_kinds),
      prior_linked_case_subjective_experience:
        cloneJson(intent.prior_linked_case_subjective_experience),
      prior_reuse_action_subjective_experience:
        cloneJson(intent.prior_reuse_action_subjective_experience),
      retained_matched_current_cue_kinds:
        cloneJson(intent.retained_matched_current_cue_kinds),
      dropped_unmatched_retained_cue_kinds:
        cloneJson(intent.dropped_unmatched_retained_cue_kinds),
      incorporated_current_additional_cue_kinds:
        cloneJson(intent.incorporated_current_additional_cue_kinds),
      current_context_difference_present: intent.current_context_difference_present,
      prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
      prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
      prior_outcomes_compared_for_effectiveness: false,
      reuse_effectiveness_inferred: false,
      advisory_only: true,
    })),
    advisory_only: true,
    effectiveness_authority: false,
    selected_action_authority: false,
    preference_authority: false,
    belief_revision_authority: false,
    semantic_revision_authority: false,
    subjective_memory_rewrite_authority: false,
    world_truth_authority: false,
  };
}

export function projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation(
  input = {},
) {
  const source = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    input.source_phase81n_projection,
    input.expected_source ?? {},
  );
  const view = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView(
    input.resolver_view,
  );
  if (view.character !== source.character || view.current_turn_id !== source.current_turn_id) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_LINEAGE_MISMATCH",
      "Phase81O resolver view does not match the Phase81N character/turn lineage.",
    );
  }
  const rebuilt =
    buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
      source_phase81n_projection: source,
      expected_source: input.expected_source ?? {},
    });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_VIEW_STALE",
      "Phase81O resolver view is stale or was not built from the exact Phase81N projection.",
    );
  }
  const rawDecisions = array(input.reuse_outcome_deliberation_decisions);
  if (rawDecisions.length > maximumReuseDecisionCount
      || rawDecisions.length > source.reentry_candidates.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_INVALID",
      "Phase81O decision count exceeds the bounded candidate set.",
    );
  }
  const candidateByRef = new Map(
    source.reentry_candidates.map((candidate) => [candidate.reentry_candidate_ref, candidate]),
  );
  const seen = new Set();
  const intents = rawDecisions.map((raw) => {
    const decision = normalizeDecision(raw, candidateByRef);
    if (seen.has(decision.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DECISION_OUT_OF_VIEW",
        "Phase81O accepts at most one decision per Phase81N candidate.",
      );
    }
    seen.add(decision.reentry_candidate_ref);
    const candidate = candidateByRef.get(decision.reentry_candidate_ref);
    const matchByCurrentRef = new Map(
      candidate.exact_current_cue_matches.map((match) => [match.current_cue_ref, match]),
    );
    const unmatchedByRef = new Map(
      candidate.unmatched_retained_context_signatures.map((cue) => [cue.retained_cue_ref, cue]),
    );
    const additionalByRef = new Map(
      candidate.current_additional_candidate_cues.map((cue) => [cue.cue_ref, cue]),
    );
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
      character: source.character,
      current_turn_id: source.current_turn_id,
      source_phase81n_projection_hash: source.projection_hash,
      source_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_action_id: candidate.current_action_id,
      current_action_ref: candidate.current_action_ref,
      source_turn_id: candidate.source_turn_id,
      source_revision_to: candidate.source_revision_to,
      source_phase81m_projection_hash: candidate.source_phase81m_projection_hash,
      source_phase81m_capsule_ref: candidate.source_phase81m_capsule_ref,
      source_phase81m_capsule_hash: candidate.source_phase81m_capsule_hash,
      source_phase81l_evidence_ref: candidate.source_phase81l_evidence_ref,
      source_phase81l_evidence_hash: candidate.source_phase81l_evidence_hash,
      reuse_intent_ref: candidate.reuse_intent_ref,
      reuse_intent_hash: candidate.reuse_intent_hash,
      retained_reuse_action_id: candidate.retained_reuse_action_id,
      retained_reuse_action_ref: candidate.retained_reuse_action_ref,
      handled_context_difference_kinds: cloneJson(candidate.handled_context_difference_kinds),
      prior_linked_case_subjective_experience:
        cloneJson(candidate.prior_linked_case_subjective_experience),
      prior_reuse_action_subjective_experience:
        cloneJson(candidate.prior_reuse_action_subjective_experience),
      retain_matched_current_cue_refs: decision.retain_matched_current_cue_refs,
      drop_unmatched_retained_cue_refs: decision.drop_unmatched_retained_cue_refs,
      incorporate_current_additional_cue_refs: decision.incorporate_current_additional_cue_refs,
      retained_matched_current_cue_kinds: decision.retain_matched_current_cue_refs
        .map((ref) => matchByCurrentRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText),
      dropped_unmatched_retained_cue_kinds: decision.drop_unmatched_retained_cue_refs
        .map((ref) => unmatchedByRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText),
      incorporated_current_additional_cue_kinds: decision.incorporate_current_additional_cue_refs
        .map((ref) => additionalByRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText),
      current_context_difference_present: candidate.current_context_difference_present === true,
      source_monitoring: cloneJson(candidate.source_monitoring),
    };
    const intentHash = hashAgentRunValue(identity);
    return {
      deliberative_reuse_intent_ref: `phase81o_reuse_${intentHash.slice(0, 24)}`,
      deliberative_reuse_intent_hash: intentHash,
      ...identity,
      prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
      prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
      prior_outcomes_compared_for_effectiveness: false,
      repeated_reuse_counts_as_effectiveness_evidence: false,
      historical_counterfactual_truth_evaluated: false,
      reuse_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_selected: false,
      action_selected: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    };
  });
  intents.sort((left, right) => compareText(
    left.deliberative_reuse_intent_ref,
    right.deliberative_reuse_intent_ref,
  ));
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
    phase: "Phase81O",
    character: source.character,
    current_turn_id: source.current_turn_id,
    source_phase81n_projection_hash: source.projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    deliberative_reuse_intent_count: intents.length,
    deliberative_reuse_intents: intents,
    character_view: characterViewFor(intents),
    audit: {
      exact_phase81n_lineage_required: true,
      canonical_phase81m_history_lineage_revalidated_by_source: true,
      explicit_character_brain_reuse_decision_required: true,
      empty_decision_set_means_no_reuse: true,
      reuse_requires_action_defining_exact_current_support: true,
      changed_context_requires_difference_handling: true,
      prior_linked_case_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_reuse_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_outcomes_compared_for_effectiveness: false,
      repeated_reuse_counts_as_effectiveness_evidence: false,
      historical_counterfactual_truth_evaluated: false,
      reuse_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_selection_performed: false,
      action_selection_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection(
    projection,
    {
      source_phase81n_projection: source,
      expected_source: input.expected_source ?? {},
    },
  );
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion
      || projection.phase !== "Phase81O"
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.source_phase81n_projection_hash)
      || !text(projection.resolver_view_hash)
      || !Array.isArray(projection.deliberative_reuse_intents)
      || projection.deliberative_reuse_intent_count !== projection.deliberative_reuse_intents.length
      || projection.deliberative_reuse_intent_count > maximumReuseDecisionCount
      || !isObject(projection.character_view)
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_PROJECTION_INVALID",
      "Phase81O reuse-outcome deliberation projection is invalid.",
    );
  }
  const source = Object.hasOwn(expected, "source_phase81n_projection")
    ? assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
      expected.source_phase81n_projection,
      expected.expected_source ?? {},
    )
    : null;
  const candidateByRef = source
    ? new Map(source.reentry_candidates.map((candidate) => [candidate.reentry_candidate_ref, candidate]))
    : null;
  if (source) {
    if (projection.character !== source.character
        || projection.current_turn_id !== source.current_turn_id
        || projection.source_phase81n_projection_hash !== source.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SOURCE_MISMATCH",
        "Phase81O projection does not match its canonical Phase81N source.",
      );
    }
    const rebuiltView =
      buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
        source_phase81n_projection: source,
        expected_source: expected.expected_source ?? {},
      });
    if (projection.resolver_view_hash !== rebuiltView.resolver_view_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_VIEW_STALE",
        "Phase81O projection resolver view no longer matches the exact Phase81N source.",
      );
    }
  }
  const refs = new Set();
  const candidateRefs = new Set();
  for (const intent of projection.deliberative_reuse_intents) {
    if (!isObject(intent)
        || !text(intent.deliberative_reuse_intent_ref)
        || !text(intent.deliberative_reuse_intent_hash)
        || !text(intent.source_reentry_candidate_ref)
        || !text(intent.source_reentry_candidate_hash)
        || !text(intent.current_action_id)
        || !text(intent.current_action_ref)
        || !Array.isArray(intent.retain_matched_current_cue_refs)
        || !Array.isArray(intent.drop_unmatched_retained_cue_refs)
        || !Array.isArray(intent.incorporate_current_additional_cue_refs)
        || !Array.isArray(intent.retained_matched_current_cue_kinds)
        || !Array.isArray(intent.dropped_unmatched_retained_cue_kinds)
        || !Array.isArray(intent.incorporated_current_additional_cue_kinds)
        || !isObject(intent.prior_linked_case_subjective_experience)
        || !isObject(intent.prior_reuse_action_subjective_experience)
        || !isObject(intent.source_monitoring)
        || intent.source_monitoring.sources_may_not_be_collapsed !== true
        || intent.prior_linked_case_subjective_outcome_is_candidate_evidence_only !== true
        || intent.prior_reuse_subjective_outcome_is_candidate_evidence_only !== true
        || intent.prior_outcomes_compared_for_effectiveness !== false
        || intent.repeated_reuse_counts_as_effectiveness_evidence !== false
        || intent.historical_counterfactual_truth_evaluated !== false
        || intent.reuse_effectiveness_inferred !== false
        || intent.success_failure_interpretation_performed !== false
        || intent.causal_or_outcome_credit_assigned !== false
        || intent.preference_selected !== false
        || intent.action_selected !== false
        || intent.belief_revision_performed !== false
        || intent.semantic_revision_performed !== false
        || intent.subjective_memory_rewrite_performed !== false
        || intent.world_state_mutated !== false
        || intent.world_truth_authority !== false
        || refs.has(intent.deliberative_reuse_intent_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_INTENT_INVALID",
        "Phase81O deliberative reuse intent violates its bounded advisory contract.",
      );
    }
    if (source) {
      const candidate = candidateByRef.get(intent.source_reentry_candidate_ref);
      if (!candidate
          || candidateRefs.has(intent.source_reentry_candidate_ref)
          || intent.source_phase81n_projection_hash !== source.projection_hash
          || intent.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || intent.current_action_id !== candidate.current_action_id
          || intent.current_action_ref !== candidate.current_action_ref
          || intent.source_turn_id !== candidate.source_turn_id
          || intent.source_revision_to !== candidate.source_revision_to
          || intent.source_phase81m_projection_hash !== candidate.source_phase81m_projection_hash
          || intent.source_phase81m_capsule_ref !== candidate.source_phase81m_capsule_ref
          || intent.source_phase81m_capsule_hash !== candidate.source_phase81m_capsule_hash
          || intent.source_phase81l_evidence_ref !== candidate.source_phase81l_evidence_ref
          || intent.source_phase81l_evidence_hash !== candidate.source_phase81l_evidence_hash
          || intent.reuse_intent_ref !== candidate.reuse_intent_ref
          || intent.reuse_intent_hash !== candidate.reuse_intent_hash
          || intent.retained_reuse_action_id !== candidate.retained_reuse_action_id
          || intent.retained_reuse_action_ref !== candidate.retained_reuse_action_ref
          || hashAgentRunValue(intent.handled_context_difference_kinds)
            !== hashAgentRunValue(candidate.handled_context_difference_kinds)
          || hashAgentRunValue(intent.prior_linked_case_subjective_experience)
            !== hashAgentRunValue(candidate.prior_linked_case_subjective_experience)
          || hashAgentRunValue(intent.prior_reuse_action_subjective_experience)
            !== hashAgentRunValue(candidate.prior_reuse_action_subjective_experience)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SOURCE_MISMATCH",
          "Phase81O intent no longer matches the exact canonical Phase81N candidate.",
        );
      }
      const matched = new Map(candidate.exact_current_cue_matches
        .map((match) => [match.current_cue_ref, match]));
      const unmatched = new Set(candidate.unmatched_retained_context_signatures
        .map((cue) => cue.retained_cue_ref));
      const additional = new Set(candidate.current_additional_candidate_cues
        .map((cue) => cue.cue_ref));
      if (intent.retain_matched_current_cue_refs.some((ref) => !matched.has(ref))
          || !intent.retain_matched_current_cue_refs
            .some((ref) => matched.get(ref)?.action_defining === true)
          || intent.drop_unmatched_retained_cue_refs.some((ref) => !unmatched.has(ref))
          || intent.incorporate_current_additional_cue_refs.some((ref) => !additional.has(ref))
          || (candidate.current_context_difference_present === true
            && intent.drop_unmatched_retained_cue_refs.length === 0
            && intent.incorporate_current_additional_cue_refs.length === 0)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SOURCE_MISMATCH",
          "Phase81O intent cue decisions no longer match the canonical Phase81N candidate.",
        );
      }
      candidateRefs.add(intent.source_reentry_candidate_ref);
    }
    const identity = cloneJson(intent);
    for (const key of [
      "deliberative_reuse_intent_ref", "deliberative_reuse_intent_hash",
      "prior_linked_case_subjective_outcome_is_candidate_evidence_only",
      "prior_reuse_subjective_outcome_is_candidate_evidence_only",
      "prior_outcomes_compared_for_effectiveness", "repeated_reuse_counts_as_effectiveness_evidence",
      "historical_counterfactual_truth_evaluated", "reuse_effectiveness_inferred",
      "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
      "preference_selected", "action_selected", "belief_revision_performed",
      "semantic_revision_performed", "subjective_memory_rewrite_performed",
      "world_state_mutated", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (intent.deliberative_reuse_intent_hash !== expectedHash
        || intent.deliberative_reuse_intent_ref !== `phase81o_reuse_${expectedHash.slice(0, 24)}`) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_INTENT_HASH_MISMATCH",
        "Phase81O deliberative reuse intent identity verification failed.",
      );
    }
    refs.add(intent.deliberative_reuse_intent_ref);
  }
  if (projection.audit.exact_phase81n_lineage_required !== true
      || projection.audit.canonical_phase81m_history_lineage_revalidated_by_source !== true
      || projection.audit.explicit_character_brain_reuse_decision_required !== true
      || projection.audit.empty_decision_set_means_no_reuse !== true
      || projection.audit.reuse_requires_action_defining_exact_current_support !== true
      || projection.audit.changed_context_requires_difference_handling !== true
      || projection.audit.prior_linked_case_subjective_outcome_treated_as_candidate_evidence_only !== true
      || projection.audit.prior_reuse_subjective_outcome_treated_as_candidate_evidence_only !== true
      || projection.audit.prior_outcomes_compared_for_effectiveness !== false
      || projection.audit.repeated_reuse_counts_as_effectiveness_evidence !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.reuse_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.preference_selection_performed !== false
      || projection.audit.action_selection_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_BOUNDARY_INVALID",
      "Phase81O projection violates its source-monitoring or authority boundary.",
    );
  }
  return deepFreeze(projection);
}
