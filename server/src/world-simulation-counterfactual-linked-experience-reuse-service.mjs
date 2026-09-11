import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReentryProjection,
  worldSimulationCounterfactualLinkedExperienceReentryVersion,
} from "./world-simulation-counterfactual-linked-experience-reentry-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceReuseVersion =
  "phase81j-counterfactual-linked-experience-reuse-deliberation-v1";

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
  const normalized = value.trim();
  return normalized || null;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function projectionHash(value, omittedKey = "projection_hash") {
  const copy = cloneJson(value);
  delete copy[omittedKey];
  return hashAgentRunValue(copy);
}
function normalizeRefs(raw, allowed, label) {
  if (!Array.isArray(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_INVALID",
      `Phase81J ${label} must be an explicit bounded array of refs.`,
    );
  }
  const refs = raw.map(text);
  if (refs.length > maximumReferenceItemsPerKind
      || refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_OUT_OF_VIEW",
      `Phase81J ${label} contains duplicate or out-of-view refs.`,
    );
  }
  return [...refs].sort(compareText);
}

function publicCandidate(candidate) {
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    current_action_id: candidate.current_action_id,
    historical_linked_action_id: candidate.historical_linked_action_id,
    historical_applicability_judgment: candidate.historical_applicability_judgment,
    historical_selection_relation: candidate.historical_selection_relation,
    historical_actual_selected_action_id: candidate.historical_actual_selected_action_id,
    historical_imagined_alternative_action_id:
      candidate.historical_imagined_alternative_action_id,
    historical_comparison_direction: candidate.historical_comparison_direction,
    historical_appraisal_kind: candidate.historical_appraisal_kind,
    historical_preparative_orientation: candidate.historical_preparative_orientation,
    prior_selected_action_subjective_experience:
      cloneJson(candidate.prior_selected_action_subjective_experience),
    exact_current_cue_matches: array(candidate.exact_current_cue_matches).map((match) => ({
      retained_cue_ref: match.retained_cue_ref,
      current_cue_ref: match.current_cue_ref,
      cue_kind: match.cue_kind,
      prior_retention_role: match.prior_retention_role,
      action_defining: match.action_defining === true,
      exact_kind_and_content_match: match.exact_kind_and_content_match === true,
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
      historical_alternative_source: "imagined_decision_time_possibility",
      historical_appraisal_source: "subjective_counterfactual_reflection",
      prior_applicability_source: "subjective_deliberative_relevance_judgment",
      prior_selection_source: "actual_selected_action_lineage",
      prior_outcome_source: "experienced_subjective_outcome",
      sources_may_not_be_collapsed: true,
    },
    prior_linked_subjective_outcome_is_candidate_evidence_only: true,
    prior_linked_subjective_outcome_is_current_world_truth: false,
    historical_counterfactual_truth_evaluated: false,
    advisory_effectiveness_inferred: false,
  };
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView(input = {}) {
  const source = assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(
    input.source_phase81i_projection,
    input.expected_source ?? {},
  );
  if (source.version !== worldSimulationCounterfactualLinkedExperienceReentryVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_INVALID",
      "Phase81J requires the canonical Phase81I linked-experience re-entry projection.",
    );
  }
  const view = {
    version: worldSimulationCounterfactualLinkedExperienceReuseVersion,
    character: source.character,
    current_turn_id: source.current_turn_id,
    linked_experience_candidates: source.reentry_candidates.map(publicCandidate),
    response_contract: {
      output_field: "linked_experience_reuse_decisions",
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
      source_phase81i_only: true,
      same_character_prior_committed_case_only: true,
      historical_subjective_outcome_is_candidate_evidence_only: true,
      historical_subjective_outcome_is_current_world_truth: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_prior_outcome: false,
      advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_credit_assigned: false,
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
  return view;
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualLinkedExperienceReuseVersion
      || !text(view.character)
      || !text(view.current_turn_id)
      || !Array.isArray(view.linked_experience_candidates)
      || !isObject(view.response_contract)
      || !isObject(view.boundaries)
      || !text(view.resolver_view_hash)
      || projectionHash(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_VIEW_INVALID",
      "Phase81J linked-experience reuse resolver view is invalid.",
    );
  }
  return view;
}

function normalizeDecision(raw, candidateByRef) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_INVALID",
      "Phase81J reuse decision must be an object.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_AUTHORITY_FIELD_FORBIDDEN",
      "Phase81J reuse decision contains fields outside the bounded refs-only response contract.",
    );
  }
  const candidateRef = text(raw.reentry_candidate_ref);
  const candidate = candidateByRef.get(candidateRef);
  if (!candidateRef || !candidate) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_OUT_OF_VIEW",
      "Phase81J reuse decision references an unknown Phase81I candidate.",
    );
  }
  const matched = new Map(
    array(candidate.exact_current_cue_matches)
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SUPPORT_REQUIRED",
      "Phase81J reuse requires at least one retained action-defining exact current cue.",
    );
  }
  if (candidate.current_context_difference_present === true
      && drop.length === 0
      && incorporate.length === 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DIFFERENCE_UNADDRESSED",
      "Phase81J changed-context reuse must explicitly address at least one retained/current difference.",
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
    source: "phase81j_counterfactual_linked_experience_reuse_intents",
    linked_experience_reuse_intents: intents.map((intent) => ({
      current_action_id: intent.current_action_id,
      historical_linked_action_id: intent.historical_linked_action_id,
      historical_applicability_judgment: intent.historical_applicability_judgment,
      historical_selection_relation: intent.historical_selection_relation,
      historical_comparison_direction: intent.historical_comparison_direction,
      historical_appraisal_kind: intent.historical_appraisal_kind,
      historical_preparative_orientation: intent.historical_preparative_orientation,
      prior_selected_action_subjective_experience:
        cloneJson(intent.prior_selected_action_subjective_experience),
      retained_matched_current_cue_kinds:
        cloneJson(intent.retained_matched_current_cue_kinds),
      dropped_unmatched_retained_cue_kinds:
        cloneJson(intent.dropped_unmatched_retained_cue_kinds),
      incorporated_current_additional_cue_kinds:
        cloneJson(intent.incorporated_current_additional_cue_kinds),
      current_context_difference_present: intent.current_context_difference_present,
      historical_subjective_outcome_is_candidate_evidence_only: true,
      historical_subjective_outcome_is_current_world_truth: false,
      historical_counterfactual_truth_evaluated: false,
      advisory_effectiveness_inferred: false,
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

export function projectWorldSimulationCounterfactualLinkedExperienceReuse(input = {}) {
  const source = assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(
    input.source_phase81i_projection,
    input.expected_source ?? {},
  );
  const view = assertWorldSimulationCounterfactualLinkedExperienceReuseResolverView(
    input.resolver_view,
  );
  if (view.character !== source.character || view.current_turn_id !== source.current_turn_id) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_LINEAGE_MISMATCH",
      "Phase81J resolver view does not match the Phase81I character/turn lineage.",
    );
  }
  const rebuilt = buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView({
    source_phase81i_projection: source,
    expected_source: input.expected_source ?? {},
  });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_VIEW_STALE",
      "Phase81J resolver view is stale or was not built from the exact Phase81I projection.",
    );
  }
  const rawDecisions = array(input.linked_experience_reuse_decisions);
  if (rawDecisions.length > maximumReuseDecisionCount
      || rawDecisions.length > source.reentry_candidates.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_INVALID",
      "Phase81J reuse decision count exceeds the bounded candidate set.",
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DECISION_OUT_OF_VIEW",
        "Phase81J accepts at most one reuse decision per Phase81I candidate.",
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
      version: worldSimulationCounterfactualLinkedExperienceReuseVersion,
      character: source.character,
      current_turn_id: source.current_turn_id,
      source_phase81i_projection_hash: source.projection_hash,
      source_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_action_id: candidate.current_action_id,
      current_action_ref: candidate.current_action_ref,
      historical_linked_action_id: candidate.historical_linked_action_id,
      historical_applicability_judgment: candidate.historical_applicability_judgment,
      historical_selection_relation: candidate.historical_selection_relation,
      historical_comparison_direction: candidate.historical_comparison_direction,
      historical_appraisal_kind: candidate.historical_appraisal_kind,
      historical_preparative_orientation: candidate.historical_preparative_orientation,
      prior_selected_action_subjective_experience:
        cloneJson(candidate.prior_selected_action_subjective_experience),
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
      reuse_intent_ref: `phase81j_reuse_${intentHash.slice(0, 24)}`,
      reuse_intent_hash: intentHash,
      ...identity,
      historical_subjective_outcome_is_candidate_evidence_only: true,
      historical_subjective_outcome_is_current_world_truth: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_prior_outcome: false,
      advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_credit_assigned: false,
      preference_selected: false,
      action_selected: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    };
  });
  reuseIntents.sort((left, right) => compareText(left.reuse_intent_ref, right.reuse_intent_ref));
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceReuseVersion,
    phase: "Phase81J",
    character: source.character,
    current_turn_id: source.current_turn_id,
    source_phase81i_projection_hash: source.projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    reuse_intent_count: reuseIntents.length,
    reuse_intents: reuseIntents,
    character_view: characterViewFor(reuseIntents),
    audit: {
      exact_phase81i_lineage_required: true,
      explicit_character_brain_reuse_decision_required: true,
      empty_decision_set_means_no_reuse: true,
      reuse_requires_action_defining_exact_current_support: true,
      changed_context_requires_difference_handling: true,
      historical_subjective_outcome_treated_as_candidate_evidence_only: true,
      historical_subjective_outcome_treated_as_current_world_truth: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_prior_outcome: false,
      advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_credit_assigned: false,
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
  return assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(projection, {
    source_phase81i_projection: source,
    expected_source: input.expected_source ?? {},
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceReuseVersion
      || projection.phase !== "Phase81J"
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.source_phase81i_projection_hash)
      || !text(projection.resolver_view_hash)
      || !Array.isArray(projection.reuse_intents)
      || projection.reuse_intent_count !== projection.reuse_intents.length
      || projection.reuse_intent_count > maximumReuseDecisionCount
      || !isObject(projection.character_view)
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_PROJECTION_INVALID",
      "Phase81J linked-experience reuse projection is invalid.",
    );
  }

  const source = Object.hasOwn(expected, "source_phase81i_projection")
    ? assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(
      expected.source_phase81i_projection,
      expected.expected_source ?? {},
    )
    : null;
  const candidateByRef = source
    ? new Map(
      source.reentry_candidates.map((candidate) => [candidate.reentry_candidate_ref, candidate]),
    )
    : null;
  if (source) {
    if (projection.character !== source.character
        || projection.current_turn_id !== source.current_turn_id
        || projection.source_phase81i_projection_hash !== source.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
        "Phase81J projection does not match its canonical Phase81I source.",
      );
    }
    const rebuiltView = buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView({
      source_phase81i_projection: source,
      expected_source: expected.expected_source ?? {},
    });
    if (projection.resolver_view_hash !== rebuiltView.resolver_view_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_VIEW_STALE",
        "Phase81J projection resolver view no longer matches the exact Phase81I source.",
      );
    }
  }

  const refs = new Set();
  const sourceCandidateRefs = new Set();
  for (const intent of projection.reuse_intents) {
    if (!isObject(intent)
        || !text(intent.reuse_intent_ref)
        || !text(intent.reuse_intent_hash)
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
        || !isObject(intent.source_monitoring)
        || intent.source_monitoring.sources_may_not_be_collapsed !== true
        || intent.historical_subjective_outcome_is_candidate_evidence_only !== true
        || intent.historical_subjective_outcome_is_current_world_truth !== false
        || intent.historical_counterfactual_truth_evaluated !== false
        || intent.historical_counterfactual_validated_by_prior_outcome !== false
        || intent.advisory_effectiveness_inferred !== false
        || intent.success_failure_interpretation_performed !== false
        || intent.causal_credit_assigned !== false
        || intent.preference_selected !== false
        || intent.action_selected !== false
        || intent.belief_revision_performed !== false
        || intent.semantic_revision_performed !== false
        || intent.subjective_memory_rewrite_performed !== false
        || intent.world_state_mutated !== false
        || intent.world_truth_authority !== false
        || refs.has(intent.reuse_intent_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_INTENT_INVALID",
        "Phase81J reuse intent violates its bounded advisory contract.",
      );
    }

    if (source) {
      const candidate = candidateByRef.get(intent.source_reentry_candidate_ref);
      if (!candidate
          || sourceCandidateRefs.has(intent.source_reentry_candidate_ref)
          || intent.version !== worldSimulationCounterfactualLinkedExperienceReuseVersion
          || intent.character !== source.character
          || intent.current_turn_id !== source.current_turn_id
          || intent.source_phase81i_projection_hash !== source.projection_hash
          || intent.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || intent.current_action_id !== candidate.current_action_id
          || intent.current_action_ref !== candidate.current_action_ref
          || intent.historical_linked_action_id !== candidate.historical_linked_action_id
          || intent.historical_applicability_judgment !== candidate.historical_applicability_judgment
          || intent.historical_selection_relation !== candidate.historical_selection_relation
          || intent.historical_comparison_direction !== candidate.historical_comparison_direction
          || intent.historical_appraisal_kind !== candidate.historical_appraisal_kind
          || intent.historical_preparative_orientation !== candidate.historical_preparative_orientation
          || intent.current_context_difference_present
            !== (candidate.current_context_difference_present === true)
          || hashAgentRunValue(intent.prior_selected_action_subjective_experience)
            !== hashAgentRunValue(candidate.prior_selected_action_subjective_experience)
          || hashAgentRunValue(intent.source_monitoring)
            !== hashAgentRunValue(candidate.source_monitoring)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
          "Phase81J reuse intent must resolve exactly to its canonical Phase81I candidate.",
        );
      }
      sourceCandidateRefs.add(intent.source_reentry_candidate_ref);

      const matchedByRef = new Map(
        array(candidate.exact_current_cue_matches)
          .map((match) => [text(match?.current_cue_ref), match])
          .filter(([ref]) => Boolean(ref)),
      );
      const unmatchedByRef = new Map(
        array(candidate.unmatched_retained_context_signatures)
          .map((cue) => [text(cue?.retained_cue_ref), cue])
          .filter(([ref]) => Boolean(ref)),
      );
      const additionalByRef = new Map(
        array(candidate.current_additional_candidate_cues)
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
            "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
            `Phase81J ${label} no longer matches canonical Phase81I cue lineage.`,
          );
        }
      };
      validateCanonicalRefs(
        intent.retain_matched_current_cue_refs,
        matchedByRef,
        "retained current cue refs",
      );
      validateCanonicalRefs(
        intent.drop_unmatched_retained_cue_refs,
        unmatchedByRef,
        "dropped retained cue refs",
      );
      validateCanonicalRefs(
        intent.incorporate_current_additional_cue_refs,
        additionalByRef,
        "incorporated current cue refs",
      );
      if (!intent.retain_matched_current_cue_refs.some(
        (ref) => matchedByRef.get(ref)?.action_defining === true,
      ) || (candidate.current_context_difference_present === true
        && intent.drop_unmatched_retained_cue_refs.length === 0
        && intent.incorporate_current_additional_cue_refs.length === 0)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
          "Phase81J reuse intent lost required action-defining support or changed-context handling.",
        );
      }
      const expectedMatchedKinds = intent.retain_matched_current_cue_refs
        .map((ref) => matchedByRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText);
      const expectedDroppedKinds = intent.drop_unmatched_retained_cue_refs
        .map((ref) => unmatchedByRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText);
      const expectedAdditionalKinds = intent.incorporate_current_additional_cue_refs
        .map((ref) => additionalByRef.get(ref)?.cue_kind).filter(Boolean).sort(compareText);
      if (hashAgentRunValue(intent.retained_matched_current_cue_kinds)
            !== hashAgentRunValue(expectedMatchedKinds)
          || hashAgentRunValue(intent.dropped_unmatched_retained_cue_kinds)
            !== hashAgentRunValue(expectedDroppedKinds)
          || hashAgentRunValue(intent.incorporated_current_additional_cue_kinds)
            !== hashAgentRunValue(expectedAdditionalKinds)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
          "Phase81J reuse-intent cue-kind summaries do not match their exact Phase81I refs.",
        );
      }
    }

    const identity = cloneJson(intent);
    for (const key of [
      "reuse_intent_ref", "reuse_intent_hash",
      "historical_subjective_outcome_is_candidate_evidence_only",
      "historical_subjective_outcome_is_current_world_truth",
      "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_prior_outcome",
      "advisory_effectiveness_inferred", "success_failure_interpretation_performed",
      "causal_credit_assigned", "preference_selected", "action_selected",
      "belief_revision_performed", "semantic_revision_performed",
      "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (intent.reuse_intent_hash !== expectedHash
        || intent.reuse_intent_ref !== `phase81j_reuse_${expectedHash.slice(0, 24)}`) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_INTENT_HASH_MISMATCH",
        "Phase81J reuse intent identity verification failed.",
      );
    }
    refs.add(intent.reuse_intent_ref);
  }

  const expectedCharacterView = characterViewFor(projection.reuse_intents);
  if (hashAgentRunValue(projection.character_view) !== hashAgentRunValue(expectedCharacterView)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_CHARACTER_VIEW_MISMATCH",
      "Phase81J character view must be derived exactly from engine-side reuse intents.",
    );
  }
  if (projection.audit.exact_phase81i_lineage_required !== true
      || projection.audit.explicit_character_brain_reuse_decision_required !== true
      || projection.audit.empty_decision_set_means_no_reuse !== true
      || projection.audit.reuse_requires_action_defining_exact_current_support !== true
      || projection.audit.changed_context_requires_difference_handling !== true
      || projection.audit.historical_subjective_outcome_treated_as_candidate_evidence_only !== true
      || projection.audit.historical_subjective_outcome_treated_as_current_world_truth !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.historical_counterfactual_validated_by_prior_outcome !== false
      || projection.audit.advisory_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_credit_assigned !== false
      || projection.audit.preference_selection_performed !== false
      || projection.audit.action_selection_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_BOUNDARY_INVALID",
      "Phase81J projection violates its source-monitoring or authority boundary.",
    );
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceReuseVersion,
    phase: "Phase81J",
    status: "retained_counterfactual_linked_experience_reuse_deliberation_installed",
    source_owner: "Phase81I",
    source_same_character_prior_committed_case_only: true,
    explicit_character_brain_reuse_decision_required: true,
    refs_only_decision_contract: true,
    omitted_candidate_means_no_reuse: true,
    reuse_requires_action_defining_exact_current_support: true,
    changed_context_requires_difference_handling: true,
    historical_subjective_outcome_is_candidate_evidence_only: true,
    historical_subjective_outcome_is_current_world_truth: false,
    historical_counterfactual_truth_evaluated: false,
    advisory_effectiveness_inferred: false,
    effectiveness_judgment_allowed: false,
    success_failure_interpretation_allowed: false,
    causal_credit_allowed: false,
    preference_selection_allowed: false,
    action_selection_allowed: false,
    belief_revision_allowed: false,
    semantic_revision_allowed: false,
    subjective_memory_rewrite_allowed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    maximum_reuse_decision_count: maximumReuseDecisionCount,
    maximum_reference_items_per_kind: maximumReferenceItemsPerKind,
  });
}
