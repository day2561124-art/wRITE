import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualReflectionReentryProjection,
  worldSimulationCounterfactualReflectionReentryVersion,
} from "./world-simulation-counterfactual-reflection-reentry-service.mjs";

export const worldSimulationCounterfactualPreparativeRevalidationVersion =
  "phase81e-counterfactual-preparative-revalidation-v1";

export const counterfactualPreparativeApplicabilityJudgments = Object.freeze([
  "currently_applicable_as_deliberative_evidence",
  "currently_not_applicable_as_deliberative_evidence",
  "current_applicability_unresolved",
]);

const applicabilityJudgments = new Set(counterfactualPreparativeApplicabilityJudgments);
const maximumRevalidationDecisionCount = 32;
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

function hashWithout(value, key) {
  const copy = cloneJson(value);
  delete copy[key];
  return hashAgentRunValue(copy);
}

function publicCueMatch(match) {
  return {
    current_cue_ref: match.current_cue_ref,
    cue_kind: match.cue_kind,
    action_defining: match.action_defining === true,
    exact_kind_and_content_match: match.exact_kind_and_content_match === true,
  };
}

function publicHistoricalDifference(cue) {
  return {
    historical_difference_cue_ref: cue.cue_ref,
    cue_kind: cue.cue_kind,
    action_defining: cue.action_defining === true,
    historical_imagined_content_exposed: false,
  };
}

function publicCurrentAddition(cue) {
  return {
    current_additional_cue_ref: cue.cue_ref,
    cue_kind: cue.cue_kind,
    cue_content: cloneJson(cue.cue_content),
    action_defining: cue.action_defining === true,
  };
}

function eligibleSourceCandidate(candidate) {
  return candidate?.historical_preparative_orientation !== "no_preparative_takeaway";
}

function publicCandidate(candidate) {
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    current_action_id: candidate.current_action_id,
    historical_actual_selected_action_id:
      candidate.historical_actual_selected_action_id,
    historical_imagined_alternative_action_id:
      candidate.historical_imagined_alternative_action_id,
    historical_comparison_direction: candidate.historical_comparison_direction,
    historical_appraisal_kind: candidate.historical_appraisal_kind,
    historical_preparative_orientation: candidate.historical_preparative_orientation,
    exact_current_cue_matches:
      array(candidate.exact_current_cue_matches).map(publicCueMatch),
    historical_context_differences:
      array(candidate.unmatched_retained_candidate_cues).map(publicHistoricalDifference),
    current_context_additions:
      array(candidate.current_additional_candidate_cues).map(publicCurrentAddition),
    current_context_difference_present:
      candidate.current_context_difference_present === true,
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      current_reentry_source: "prior_counterfactual_reflection_reminder",
      sources_may_not_be_collapsed: true,
    },
    historical_counterfactual_is_candidate_evidence_only: true,
    historical_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    historical_counterfactual_world_truth: false,
    causal_superiority_inferred: false,
  };
}

export function buildWorldSimulationCounterfactualPreparativeRevalidationResolverView(
  input = {},
) {
  const source = assertWorldSimulationCounterfactualReflectionReentryProjection(
    input.source_phase81d_projection,
  );
  if (source.version !== worldSimulationCounterfactualReflectionReentryVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_SOURCE_INVALID",
      "Phase81E requires the canonical Phase81D counterfactual reflection re-entry projection.",
    );
  }
  const candidates = source.reentry_candidates
    .filter(eligibleSourceCandidate)
    .map(publicCandidate);
  const view = {
    version: worldSimulationCounterfactualPreparativeRevalidationVersion,
    phase: "Phase81E",
    character: source.character,
    current_turn_id: source.current_turn_id,
    preparative_revalidation_candidates: candidates,
    response_contract: {
      output_field: "preparative_revalidation_decisions",
      may_return_empty_array: true,
      required_fields: [
        "reentry_candidate_ref",
        "applicability_judgment",
        "retain_matched_current_cue_refs",
        "address_historical_difference_cue_refs",
        "incorporate_current_additional_cue_refs",
      ],
      supported_applicability_judgments:
        [...counterfactualPreparativeApplicabilityJudgments],
      maximum_revalidation_decision_count: Math.min(
        maximumRevalidationDecisionCount,
        candidates.length,
      ),
      maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
      every_judgment_requires_current_exact_match_support: true,
      changed_context_requires_explicit_difference_handling: true,
      no_preparative_takeaway_is_not_a_revalidation_candidate: true,
      direct_action_preference_allowed: false,
      direct_action_selection_allowed: false,
    },
    boundaries: {
      source_phase81d_only: true,
      same_character_prior_committed_reflection_only: true,
      current_phase74a_candidate_universe_preserved: true,
      historical_counterfactual_is_candidate_evidence_only: true,
      historical_alternative_was_experienced: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      applicability_is_subjective_deliberative_relevance_not_world_truth: true,
      direct_preference_revision_allowed: false,
      direct_action_selection_allowed: false,
      belief_revision_allowed: false,
      semantic_revision_allowed: false,
      subjective_memory_rewrite_allowed: false,
      world_state_mutation_allowed: false,
      numeric_similarity_confidence_probability_utility_reward_requested: false,
      explanation_or_hidden_reasoning_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return view;
}

export function assertWorldSimulationCounterfactualPreparativeRevalidationResolverView(
  value,
) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualPreparativeRevalidationVersion
      || view.phase !== "Phase81E"
      || !text(view.character)
      || !text(view.current_turn_id)
      || !Array.isArray(view.preparative_revalidation_candidates)
      || !isObject(view.response_contract)
      || !isObject(view.boundaries)
      || !text(view.resolver_view_hash)
      || hashWithout(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_VIEW_INVALID",
      "Phase81E preparative revalidation resolver view is invalid.",
    );
  }
  const refs = new Set();
  for (const candidate of view.preparative_revalidation_candidates) {
    if (!isObject(candidate)
        || !text(candidate.reentry_candidate_ref)
        || refs.has(candidate.reentry_candidate_ref)
        || !text(candidate.current_action_id)
        || !text(candidate.historical_actual_selected_action_id)
        || !text(candidate.historical_imagined_alternative_action_id)
        || !text(candidate.historical_comparison_direction)
        || !text(candidate.historical_appraisal_kind)
        || !text(candidate.historical_preparative_orientation)
        || candidate.historical_preparative_orientation === "no_preparative_takeaway"
        || !Array.isArray(candidate.exact_current_cue_matches)
        || candidate.exact_current_cue_matches.length === 0
        || !candidate.exact_current_cue_matches.some((match) => match?.action_defining === true)
        || !Array.isArray(candidate.historical_context_differences)
        || !Array.isArray(candidate.current_context_additions)
        || candidate.current_context_difference_present
          !== (candidate.historical_context_differences.length > 0
            || candidate.current_context_additions.length > 0)
        || !isObject(candidate.source_monitoring)
        || candidate.source_monitoring.sources_may_not_be_collapsed !== true
        || candidate.historical_counterfactual_is_candidate_evidence_only !== true
        || candidate.historical_alternative_was_experienced !== false
        || candidate.historical_unchosen_outcome_observed !== false
        || candidate.historical_counterfactual_world_truth !== false
        || candidate.causal_superiority_inferred !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_VIEW_CANDIDATE_INVALID",
        "Phase81E resolver view contains an invalid bounded preparative candidate.",
      );
    }
    refs.add(candidate.reentry_candidate_ref);
  }
  return view;
}

function normalizeRefs(raw, allowed, label) {
  if (!Array.isArray(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_INVALID",
      `Phase81E ${label} must be an explicit bounded array of refs.`,
    );
  }
  const refs = raw.map(text);
  if (refs.length > maximumReferenceItemsPerKind
      || refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_OUT_OF_VIEW",
      `Phase81E ${label} contains duplicate or out-of-view refs.`,
    );
  }
  return [...refs].sort(compareText);
}

function normalizeDecision(raw, candidateByRef) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_INVALID",
      "Phase81E preparative revalidation decision must be an object.",
    );
  }
  const allowedKeys = new Set([
    "reentry_candidate_ref",
    "applicability_judgment",
    "retain_matched_current_cue_refs",
    "address_historical_difference_cue_refs",
    "incorporate_current_additional_cue_refs",
  ]);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_AUTHORITY_FIELD_FORBIDDEN",
      "Phase81E decision contains fields outside the bounded response contract.",
    );
  }
  const candidateRef = text(raw.reentry_candidate_ref);
  const candidate = candidateByRef.get(candidateRef);
  const applicability = text(raw.applicability_judgment);
  if (!candidateRef
      || !candidate
      || !applicability
      || !applicabilityJudgments.has(applicability)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_OUT_OF_VIEW",
      "Phase81E decision references an unknown candidate or unsupported applicability judgment.",
    );
  }
  const matched = new Set(
    array(candidate.exact_current_cue_matches)
      .map((match) => text(match?.current_cue_ref))
      .filter(Boolean),
  );
  const historicalDifferences = new Set(
    array(candidate.historical_context_differences)
      .map((cue) => text(cue?.historical_difference_cue_ref))
      .filter(Boolean),
  );
  const currentAdditions = new Set(
    array(candidate.current_context_additions)
      .map((cue) => text(cue?.current_additional_cue_ref))
      .filter(Boolean),
  );
  const retain = normalizeRefs(
    raw.retain_matched_current_cue_refs,
    matched,
    "retain_matched_current_cue_refs",
  );
  const addressHistorical = normalizeRefs(
    raw.address_historical_difference_cue_refs,
    historicalDifferences,
    "address_historical_difference_cue_refs",
  );
  const incorporateCurrent = normalizeRefs(
    raw.incorporate_current_additional_cue_refs,
    currentAdditions,
    "incorporate_current_additional_cue_refs",
  );
  if (retain.length === 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_CURRENT_SUPPORT_REQUIRED",
      "Phase81E every applicability judgment requires at least one exact current cue match.",
    );
  }
  if (candidate.current_context_difference_present === true
      && addressHistorical.length === 0
      && incorporateCurrent.length === 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DIFFERENCE_UNADDRESSED",
      "Phase81E changed-context judgment must explicitly address at least one historical/current difference.",
    );
  }
  return {
    reentry_candidate_ref: candidateRef,
    applicability_judgment: applicability,
    retain_matched_current_cue_refs: retain,
    address_historical_difference_cue_refs: addressHistorical,
    incorporate_current_additional_cue_refs: incorporateCurrent,
  };
}

function characterJudgment(judgment) {
  return {
    current_action_id: judgment.current_action_id,
    historical_actual_selected_action_id:
      judgment.historical_actual_selected_action_id,
    historical_imagined_alternative_action_id:
      judgment.historical_imagined_alternative_action_id,
    historical_comparison_direction: judgment.historical_comparison_direction,
    historical_appraisal_kind: judgment.historical_appraisal_kind,
    historical_preparative_orientation: judgment.historical_preparative_orientation,
    applicability_judgment: judgment.applicability_judgment,
    matched_current_cue_kinds: cloneJson(judgment.matched_current_cue_kinds),
    historical_context_difference_kinds:
      cloneJson(judgment.historical_context_difference_kinds),
    current_additional_cue_kinds:
      cloneJson(judgment.current_additional_cue_kinds),
    current_context_difference_present:
      judgment.current_context_difference_present === true,
    historical_counterfactual_is_candidate_evidence_only: true,
    historical_alternative_was_experienced: false,
    unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    advisory_only: true,
    current_action_preference_selected: false,
    action_selected: false,
  };
}

export function projectWorldSimulationCounterfactualPreparativeRevalidation(input = {}) {
  const source = assertWorldSimulationCounterfactualReflectionReentryProjection(
    input.source_phase81d_projection,
  );
  const view = assertWorldSimulationCounterfactualPreparativeRevalidationResolverView(
    input.resolver_view,
  );
  if (view.character !== source.character
      || view.current_turn_id !== source.current_turn_id) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
      "Phase81E resolver view does not match the Phase81D character/turn lineage.",
    );
  }
  const rebuilt = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
    source_phase81d_projection: source,
  });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_VIEW_STALE",
      "Phase81E resolver view is stale or was not built from the exact Phase81D projection.",
    );
  }
  const rawDecisions = array(input.preparative_revalidation_decisions);
  if (rawDecisions.length > maximumRevalidationDecisionCount
      || rawDecisions.length > view.preparative_revalidation_candidates.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_INVALID",
      "Phase81E revalidation decision count exceeds the bounded candidate set.",
    );
  }
  const sourceCandidateByRef = new Map(
    source.reentry_candidates
      .filter(eligibleSourceCandidate)
      .map((candidate) => [candidate.reentry_candidate_ref, candidate]),
  );
  const publicCandidateByRef = new Map(
    view.preparative_revalidation_candidates
      .map((candidate) => [candidate.reentry_candidate_ref, candidate]),
  );
  const seen = new Set();
  const judgments = rawDecisions.map((raw) => {
    const decision = normalizeDecision(raw, publicCandidateByRef);
    if (seen.has(decision.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_DECISION_OUT_OF_VIEW",
        "Phase81E accepts at most one revalidation decision per re-entry candidate.",
      );
    }
    seen.add(decision.reentry_candidate_ref);
    const sourceCandidate = sourceCandidateByRef.get(decision.reentry_candidate_ref);
    const publicSource = publicCandidateByRef.get(decision.reentry_candidate_ref);
    const identity = {
      version: worldSimulationCounterfactualPreparativeRevalidationVersion,
      character: source.character,
      current_turn_id: source.current_turn_id,
      source_phase81d_projection_hash: source.projection_hash,
      source_reentry_candidate_ref: sourceCandidate.reentry_candidate_ref,
      source_reentry_candidate_hash: sourceCandidate.reentry_candidate_hash,
      current_action_ref: sourceCandidate.current_action_ref,
      current_action_id: sourceCandidate.current_action_id,
      historical_actual_selected_action_ref:
        sourceCandidate.historical_actual_selected_action_ref,
      historical_actual_selected_action_id:
        sourceCandidate.historical_actual_selected_action_id,
      historical_imagined_alternative_action_ref:
        sourceCandidate.historical_imagined_alternative_action_ref,
      historical_imagined_alternative_action_id:
        sourceCandidate.historical_imagined_alternative_action_id,
      historical_comparison_direction: sourceCandidate.historical_comparison_direction,
      historical_appraisal_kind: sourceCandidate.historical_appraisal_kind,
      historical_preparative_orientation:
        sourceCandidate.historical_preparative_orientation,
      applicability_judgment: decision.applicability_judgment,
      retain_matched_current_cue_refs: decision.retain_matched_current_cue_refs,
      address_historical_difference_cue_refs:
        decision.address_historical_difference_cue_refs,
      incorporate_current_additional_cue_refs:
        decision.incorporate_current_additional_cue_refs,
      matched_current_cue_kinds: array(publicSource.exact_current_cue_matches)
        .filter((item) => decision.retain_matched_current_cue_refs.includes(item.current_cue_ref))
        .map((item) => item.cue_kind)
        .sort(compareText),
      historical_context_difference_kinds:
        array(publicSource.historical_context_differences)
          .filter((item) => decision.address_historical_difference_cue_refs
            .includes(item.historical_difference_cue_ref))
          .map((item) => item.cue_kind)
          .sort(compareText),
      current_additional_cue_kinds: array(publicSource.current_context_additions)
        .filter((item) => decision.incorporate_current_additional_cue_refs
          .includes(item.current_additional_cue_ref))
        .map((item) => item.cue_kind)
        .sort(compareText),
      current_context_difference_present:
        sourceCandidate.current_context_difference_present === true,
      source_monitoring: cloneJson(sourceCandidate.source_monitoring),
    };
    const judgmentHash = hashAgentRunValue(identity);
    return {
      revalidation_judgment_ref: `phase81e_revalidation_${judgmentHash.slice(0, 24)}`,
      revalidation_judgment_hash: judgmentHash,
      ...identity,
      historical_counterfactual_is_candidate_evidence_only: true,
      historical_alternative_was_experienced: false,
      historical_unchosen_outcome_observed: false,
      historical_counterfactual_world_truth: false,
      causal_superiority_inferred: false,
      applicability_is_subjective_deliberative_relevance_not_world_truth: true,
      preference_revision_performed: false,
      action_selected: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    };
  });
  judgments.sort((left, right) => compareText(
    left.revalidation_judgment_ref,
    right.revalidation_judgment_ref,
  ));
  const projection = {
    version: worldSimulationCounterfactualPreparativeRevalidationVersion,
    phase: "Phase81E",
    character: source.character,
    current_turn_id: source.current_turn_id,
    source_phase81d_projection_hash: source.projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    revalidation_judgment_count: judgments.length,
    revalidation_judgments: judgments,
    character_view: {
      source: "phase81e_current_context_counterfactual_preparative_revalidation",
      judgments: judgments.map(characterJudgment),
      advisory_only: true,
      historical_counterfactual_is_candidate_evidence_only: true,
      selected_action_authority: false,
      preference_revision_authority: false,
      belief_revision_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase81d_lineage_required: true,
      explicit_character_brain_applicability_judgment_required: true,
      empty_decision_set_means_no_preparative_reuse: true,
      no_preparative_takeaway_excluded: true,
      every_judgment_requires_exact_current_cue_support: true,
      changed_context_requires_difference_handling: true,
      applicability_is_subjective_deliberative_relevance_not_world_truth: true,
      historical_counterfactual_treated_as_candidate_evidence_only: true,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      preference_revision_performed: false,
      action_selection_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualPreparativeRevalidationProjection(projection, {
    source_phase81d_projection: source,
  });
}

export function assertWorldSimulationCounterfactualPreparativeRevalidationProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualPreparativeRevalidationVersion
      || projection.phase !== "Phase81E"
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.source_phase81d_projection_hash)
      || !text(projection.resolver_view_hash)
      || !Array.isArray(projection.revalidation_judgments)
      || projection.revalidation_judgment_count !== projection.revalidation_judgments.length
      || projection.revalidation_judgment_count > maximumRevalidationDecisionCount
      || !isObject(projection.character_view)
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_PROJECTION_INVALID",
      "Phase81E counterfactual preparative revalidation projection is invalid.",
    );
  }
  const source = expected.source_phase81d_projection
    ? assertWorldSimulationCounterfactualReflectionReentryProjection(
      expected.source_phase81d_projection,
    )
    : null;
  if (source
      && (projection.character !== source.character
        || projection.current_turn_id !== source.current_turn_id
        || projection.source_phase81d_projection_hash !== source.projection_hash)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
      "Phase81E projection does not match the expected Phase81D lineage.",
    );
  }
  const sourceCandidateByRef = source
    ? new Map(
      source.reentry_candidates
        .filter(eligibleSourceCandidate)
        .map((candidate) => [candidate.reentry_candidate_ref, candidate]),
    )
    : null;
  if (source) {
    const rebuiltView = buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
      source_phase81d_projection: source,
    });
    if (projection.resolver_view_hash !== rebuiltView.resolver_view_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_VIEW_STALE",
        "Phase81E projection resolver-view lineage no longer matches the exact Phase81D source.",
      );
    }
  }
  const refs = new Set();
  const sourceCandidateRefs = new Set();
  for (const judgment of projection.revalidation_judgments) {
    if (!isObject(judgment)
        || !text(judgment.revalidation_judgment_ref)
        || !text(judgment.revalidation_judgment_hash)
        || refs.has(judgment.revalidation_judgment_ref)
        || !text(judgment.source_reentry_candidate_ref)
        || !text(judgment.source_reentry_candidate_hash)
        || !text(judgment.current_action_ref)
        || !text(judgment.current_action_id)
        || !text(judgment.historical_preparative_orientation)
        || judgment.historical_preparative_orientation === "no_preparative_takeaway"
        || !applicabilityJudgments.has(judgment.applicability_judgment)
        || !Array.isArray(judgment.retain_matched_current_cue_refs)
        || judgment.retain_matched_current_cue_refs.length < 1
        || !Array.isArray(judgment.address_historical_difference_cue_refs)
        || !Array.isArray(judgment.incorporate_current_additional_cue_refs)
        || !isObject(judgment.source_monitoring)
        || judgment.source_monitoring.sources_may_not_be_collapsed !== true
        || judgment.historical_counterfactual_is_candidate_evidence_only !== true
        || judgment.historical_alternative_was_experienced !== false
        || judgment.historical_unchosen_outcome_observed !== false
        || judgment.historical_counterfactual_world_truth !== false
        || judgment.causal_superiority_inferred !== false
        || judgment.applicability_is_subjective_deliberative_relevance_not_world_truth !== true
        || judgment.preference_revision_performed !== false
        || judgment.action_selected !== false
        || judgment.belief_revision_performed !== false
        || judgment.semantic_revision_performed !== false
        || judgment.subjective_memory_rewrite_performed !== false
        || judgment.world_state_mutated !== false
        || judgment.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_JUDGMENT_INVALID",
        "Phase81E projection contains an invalid or over-authoritative judgment.",
      );
    }
    if (source) {
      const sourceCandidate = sourceCandidateByRef.get(judgment.source_reentry_candidate_ref);
      if (!sourceCandidate
          || sourceCandidateRefs.has(judgment.source_reentry_candidate_ref)
          || judgment.version !== worldSimulationCounterfactualPreparativeRevalidationVersion
          || judgment.character !== source.character
          || judgment.current_turn_id !== source.current_turn_id
          || judgment.source_phase81d_projection_hash !== source.projection_hash
          || judgment.source_reentry_candidate_hash !== sourceCandidate.reentry_candidate_hash
          || judgment.current_action_ref !== sourceCandidate.current_action_ref
          || judgment.current_action_id !== sourceCandidate.current_action_id
          || judgment.historical_actual_selected_action_ref
            !== sourceCandidate.historical_actual_selected_action_ref
          || judgment.historical_actual_selected_action_id
            !== sourceCandidate.historical_actual_selected_action_id
          || judgment.historical_imagined_alternative_action_ref
            !== sourceCandidate.historical_imagined_alternative_action_ref
          || judgment.historical_imagined_alternative_action_id
            !== sourceCandidate.historical_imagined_alternative_action_id
          || judgment.historical_comparison_direction
            !== sourceCandidate.historical_comparison_direction
          || judgment.historical_appraisal_kind !== sourceCandidate.historical_appraisal_kind
          || judgment.historical_preparative_orientation
            !== sourceCandidate.historical_preparative_orientation
          || judgment.current_context_difference_present
            !== (sourceCandidate.current_context_difference_present === true)
          || hashAgentRunValue(judgment.source_monitoring)
            !== hashAgentRunValue(sourceCandidate.source_monitoring)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
          "Phase81E judgment does not match its exact Phase81D source candidate lineage.",
        );
      }
      sourceCandidateRefs.add(judgment.source_reentry_candidate_ref);
      const matchedCueByRef = new Map(
        array(sourceCandidate.exact_current_cue_matches)
          .map((match) => [text(match?.current_cue_ref), match])
          .filter(([ref]) => Boolean(ref)),
      );
      const historicalDifferenceByRef = new Map(
        array(sourceCandidate.unmatched_retained_candidate_cues)
          .map((cue) => [text(cue?.cue_ref), cue])
          .filter(([ref]) => Boolean(ref)),
      );
      const currentAdditionByRef = new Map(
        array(sourceCandidate.current_additional_candidate_cues)
          .map((cue) => [text(cue?.cue_ref), cue])
          .filter(([ref]) => Boolean(ref)),
      );
      const validateCanonicalRefs = (rawRefs, allowedByRef, label) => {
        if (rawRefs.length > maximumReferenceItemsPerKind
            || rawRefs.some((ref) => text(ref) !== ref || !allowedByRef.has(ref))
            || new Set(rawRefs).size !== rawRefs.length
            || hashAgentRunValue(rawRefs)
              !== hashAgentRunValue([...rawRefs].sort(compareText))) {
          fail(
            "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
            `Phase81E ${label} no longer matches canonical Phase81D cue lineage.`,
          );
        }
      };
      validateCanonicalRefs(
        judgment.retain_matched_current_cue_refs,
        matchedCueByRef,
        "retained current cue refs",
      );
      validateCanonicalRefs(
        judgment.address_historical_difference_cue_refs,
        historicalDifferenceByRef,
        "historical difference refs",
      );
      validateCanonicalRefs(
        judgment.incorporate_current_additional_cue_refs,
        currentAdditionByRef,
        "current addition refs",
      );
      if (judgment.retain_matched_current_cue_refs.length === 0
          || (sourceCandidate.current_context_difference_present === true
            && judgment.address_historical_difference_cue_refs.length === 0
            && judgment.incorporate_current_additional_cue_refs.length === 0)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
          "Phase81E judgment lost required current support or changed-context handling.",
        );
      }
      const expectedMatchedKinds = judgment.retain_matched_current_cue_refs
        .map((ref) => matchedCueByRef.get(ref)?.cue_kind)
        .sort(compareText);
      const expectedHistoricalKinds = judgment.address_historical_difference_cue_refs
        .map((ref) => historicalDifferenceByRef.get(ref)?.cue_kind)
        .sort(compareText);
      const expectedCurrentKinds = judgment.incorporate_current_additional_cue_refs
        .map((ref) => currentAdditionByRef.get(ref)?.cue_kind)
        .sort(compareText);
      if (hashAgentRunValue(judgment.matched_current_cue_kinds)
            !== hashAgentRunValue(expectedMatchedKinds)
          || hashAgentRunValue(judgment.historical_context_difference_kinds)
            !== hashAgentRunValue(expectedHistoricalKinds)
          || hashAgentRunValue(judgment.current_additional_cue_kinds)
            !== hashAgentRunValue(expectedCurrentKinds)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_LINEAGE_MISMATCH",
          "Phase81E judgment cue-kind summaries do not match their exact Phase81D refs.",
        );
      }
    }
    const identity = cloneJson(judgment);
    for (const key of [
      "revalidation_judgment_ref",
      "revalidation_judgment_hash",
      "historical_counterfactual_is_candidate_evidence_only",
      "historical_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "historical_counterfactual_world_truth",
      "causal_superiority_inferred",
      "applicability_is_subjective_deliberative_relevance_not_world_truth",
      "preference_revision_performed",
      "action_selected",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (judgment.revalidation_judgment_hash !== expectedHash
        || judgment.revalidation_judgment_ref
          !== `phase81e_revalidation_${expectedHash.slice(0, 24)}`) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_JUDGMENT_HASH_MISMATCH",
        "Phase81E revalidation judgment identity verification failed.",
      );
    }
    refs.add(judgment.revalidation_judgment_ref);
  }
  const expectedCharacterView = {
    source: "phase81e_current_context_counterfactual_preparative_revalidation",
    judgments: projection.revalidation_judgments.map(characterJudgment),
    advisory_only: true,
    historical_counterfactual_is_candidate_evidence_only: true,
    selected_action_authority: false,
    preference_revision_authority: false,
    belief_revision_authority: false,
    semantic_revision_authority: false,
    world_truth_authority: false,
  };
  if (hashAgentRunValue(projection.character_view)
      !== hashAgentRunValue(expectedCharacterView)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_CHARACTER_VIEW_INVALID",
      "Phase81E character-facing advisory no longer matches the canonical engine-side judgments.",
    );
  }
  if (projection.audit.exact_phase81d_lineage_required !== true
      || projection.audit.explicit_character_brain_applicability_judgment_required !== true
      || projection.audit.empty_decision_set_means_no_preparative_reuse !== true
      || projection.audit.no_preparative_takeaway_excluded !== true
      || projection.audit.every_judgment_requires_exact_current_cue_support !== true
      || projection.audit.changed_context_requires_difference_handling !== true
      || projection.audit.applicability_is_subjective_deliberative_relevance_not_world_truth !== true
      || projection.audit.historical_counterfactual_treated_as_candidate_evidence_only !== true
      || projection.audit.unchosen_outcome_observed !== false
      || projection.audit.counterfactual_world_truth_claimed !== false
      || projection.audit.causal_superiority_inferred !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.action_selection_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_BOUNDARY_INVALID",
      "Phase81E projection violates its authority or source-monitoring boundary.",
    );
  }
  return projection;
}

export function buildWorldSimulationCounterfactualPreparativeRevalidationContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualPreparativeRevalidationVersion,
    phase: "Phase81E",
    status: "current_context_counterfactual_preparative_revalidation_installed",
    source_owner: "Phase81D",
    exact_phase81d_lineage_required: true,
    prior_committed_same_character_reflection_only: true,
    no_preparative_takeaway_excluded: true,
    explicit_character_brain_applicability_judgment_required: true,
    refs_only_decision_contract: true,
    every_judgment_requires_exact_current_cue_support: true,
    changed_context_requires_difference_handling: true,
    applicability_is_subjective_deliberative_relevance_not_world_truth: true,
    current_phase74a_candidate_universe_preserved: true,
    historical_counterfactual_is_candidate_evidence_only: true,
    historical_alternative_was_experienced: false,
    unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    preference_revision_allowed: false,
    action_selection_allowed: false,
    belief_revision_allowed: false,
    semantic_revision_allowed: false,
    subjective_memory_rewrite_allowed: false,
    world_state_mutation_allowed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    maximum_revalidation_decision_count: maximumRevalidationDecisionCount,
    maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
  });
}
