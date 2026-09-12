import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-case-reentry-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion =
  "phase82f-counterfactual-linked-experience-longitudinal-case-deliberative-reuse-v1";

const maximumActivationCount = 32;

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
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_INPUT_INVALID",
      `Phase82F ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function projectionHash(value, field = "projection_hash") {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}

function publicCandidate(candidate) {
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    current_action_id: candidate.current_action_id,
    current_context_difference_present:
      candidate.current_context_difference_present === true,
    exact_current_cue_match_count: candidate.exact_current_cue_match_count,
    prior_committed_retained_longitudinal_case: true,
    current_exact_cue_relevance_verified: true,
    retained_longitudinal_case_is_candidate_evidence_only: true,
    retained_admission_is_effectiveness_claim: false,
    retained_admission_is_success_claim: false,
  };
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
    phase: "Phase82F",
    status: "retained_longitudinal_case_deliberative_reuse_installed",
    source_owner: "Phase82E",
    deliberation_owner: "CharacterBrain",
    exact_phase82e_lineage_required: true,
    prior_phase82d_retain_admission_required_by_source: true,
    current_phase81n_exact_cue_relevance_required_by_source: true,
    explicit_character_brain_activation_required: true,
    omitted_candidate_means_no_deliberative_reuse: true,
    opaque_refs_only_response_contract: true,
    retained_longitudinal_case_is_candidate_evidence_only: true,
    retained_admission_is_not_effectiveness_claim: true,
    retained_admission_is_not_success_claim: true,
    automatic_preference_selection_allowed: false,
    automatic_action_selection_allowed: false,
    numeric_effectiveness_success_probability_confidence_utility_reward_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    rule_or_preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    ordinary_subjective_memory_rewrite_performed: false,
    world_state_mutation_allowed: false,
    world_truth_authority_claimed: false,
    maximum_activation_count: maximumActivationCount,
  });
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView(
  input = {},
) {
  const character = requiredText(input.character, "character", 240);
  const source = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
    input.source_phase82e_projection,
    input.expected_source ?? {},
  );
  if (source.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_SOURCE_INVALID",
      "Phase82F requires the canonical Phase82E longitudinal-case re-entry projection.",
    );
  }
  const candidates = source.reentry_candidates.filter((candidate) =>
    sameCharacter(candidate?.character, character));
  const view = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
    character,
    current_turn_id: source.current_turn_id,
    source_phase82e_projection_hash: source.projection_hash,
    longitudinal_case_candidates: candidates.map(publicCandidate),
    response_contract: {
      output_field: "activated_longitudinal_case_refs",
      may_return_empty_array: true,
      omitted_candidate_means_no_deliberative_reuse: true,
      opaque_refs_only: true,
      maximum_activation_count: Math.min(maximumActivationCount, candidates.length),
      direct_preference_selection_allowed: false,
      direct_action_selection_allowed: false,
    },
    boundaries: {
      source_phase82e_only: true,
      exact_phase82d_phase82c_history_lineage_revalidated_by_source: true,
      exact_current_phase81n_relevance_revalidated_by_source: true,
      retained_longitudinal_case_is_candidate_evidence_only: true,
      retained_admission_interpreted_as_effectiveness: false,
      retained_admission_interpreted_as_success: false,
      automatic_preference_selection_allowed: false,
      automatic_action_selection_allowed: false,
      numeric_effectiveness_success_probability_confidence_utility_reward_q_value_requested: false,
      causal_or_outcome_credit_assigned: false,
      rule_or_preference_revision_allowed: false,
      belief_revision_allowed: false,
      semantic_revision_allowed: false,
      ordinary_subjective_memory_rewrite_allowed: false,
      world_truth_authority: false,
      explanation_or_hidden_reasoning_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(view);
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView(
  value,
) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion
      || !text(view.character)
      || !text(view.current_turn_id)
      || !text(view.source_phase82e_projection_hash)
      || !Array.isArray(view.longitudinal_case_candidates)
      || !isObject(view.response_contract)
      || !isObject(view.boundaries)
      || !text(view.resolver_view_hash)
      || projectionHash(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_VIEW_INVALID",
      "Phase82F longitudinal-case reuse resolver view is invalid.",
    );
  }
  return Object.freeze(view);
}

function normalizeActivatedRefs(raw, candidates) {
  if (!Array.isArray(raw)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_DECISION_INVALID",
      "Phase82F activated_longitudinal_case_refs must be an explicit bounded array.",
    );
  }
  const allowed = new Set(candidates.map((candidate) => candidate.reentry_candidate_ref));
  if (raw.length > maximumActivationCount || raw.length > allowed.size) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_DECISION_INVALID",
      "Phase82F activation count exceeds the bounded candidate set.",
    );
  }
  const refs = raw.map((value) => text(isObject(value) ? value.reentry_candidate_ref : value));
  if (refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_DECISION_OUT_OF_VIEW",
      "Phase82F may activate only unique opaque refs from the exact current resolver view.",
    );
  }
  return refs.sort(compareText);
}

function characterView(intents) {
  return {
    source: "phase82f_retained_longitudinal_case_deliberative_evidence",
    retained_longitudinal_case_deliberative_evidence: intents.map((intent) => ({
      current_action_id: intent.current_action_id,
      current_context_difference_present: intent.current_context_difference_present,
      prior_committed_retained_longitudinal_case: true,
      current_exact_cue_relevance_verified: true,
      retained_longitudinal_case_is_candidate_evidence_only: true,
      retained_admission_is_effectiveness_claim: false,
      retained_admission_is_success_claim: false,
      advisory_only: true,
    })),
    advisory_only: true,
    selected_action_authority: false,
    preference_authority: false,
    effectiveness_authority: false,
    success_failure_authority: false,
    causal_credit_authority: false,
    belief_revision_authority: false,
    semantic_revision_authority: false,
    subjective_memory_rewrite_authority: false,
    world_truth_authority: false,
  };
}

export function projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuse(
  input = {},
) {
  const character = requiredText(input.character, "character", 240);
  const source = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
    input.source_phase82e_projection,
    input.expected_source ?? {},
  );
  const view = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView(
    input.resolver_view,
  );
  if (!sameCharacter(view.character, character)
      || view.current_turn_id !== source.current_turn_id
      || view.source_phase82e_projection_hash !== source.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_LINEAGE_MISMATCH",
      "Phase82F resolver view does not match its exact Phase82E character/turn source.",
    );
  }
  const rebuilt =
    buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
      character,
      source_phase82e_projection: source,
      expected_source: input.expected_source ?? {},
    });
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_VIEW_STALE",
      "Phase82F resolver view is stale or was not built from the exact canonical Phase82E projection.",
    );
  }
  const candidates = source.reentry_candidates.filter((candidate) =>
    sameCharacter(candidate?.character, character));
  const activatedRefs = normalizeActivatedRefs(
    input.activated_longitudinal_case_refs ?? [],
    candidates,
  );
  const byRef = new Map(candidates.map((candidate) => [candidate.reentry_candidate_ref, candidate]));
  const intents = activatedRefs.map((candidateRef) => {
    const candidate = byRef.get(candidateRef);
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
      character,
      current_turn_id: source.current_turn_id,
      source_phase82e_projection_hash: source.projection_hash,
      source_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_action_id: candidate.current_action_id,
      current_action_ref: candidate.current_action_ref,
      source_turn_id: candidate.source_turn_id,
      source_revision_to: candidate.source_revision_to,
      source_phase82d_projection_hash: candidate.source_phase82d_projection_hash,
      source_phase82d_admission_ref: candidate.source_phase82d_admission_ref,
      source_phase82d_admission_hash: candidate.source_phase82d_admission_hash,
      source_phase82c_projection_hash: candidate.source_phase82c_projection_hash,
      source_phase82c_appraisal_ref: candidate.source_phase82c_appraisal_ref,
      source_phase82c_appraisal_hash: candidate.source_phase82c_appraisal_hash,
      source_phase82b_context_ref: candidate.source_phase82b_context_ref,
      source_phase82a_context_ref: candidate.source_phase82a_context_ref,
      source_phase81m_capsule_ref: candidate.source_phase81m_capsule_ref,
      reuse_intent_ref: candidate.reuse_intent_ref,
      current_phase81n_projection_hash: candidate.current_phase81n_projection_hash,
      current_phase81n_reentry_candidate_ref: candidate.current_phase81n_reentry_candidate_ref,
      current_phase81n_reentry_candidate_hash: candidate.current_phase81n_reentry_candidate_hash,
      current_context_difference_present:
        candidate.current_context_difference_present === true,
    };
    const intentHash = hashAgentRunValue(identity);
    return {
      deliberative_reuse_intent_ref: `phase82f_longitudinal_case_reuse_${intentHash.slice(0, 24)}`,
      deliberative_reuse_intent_hash: intentHash,
      ...identity,
      explicit_character_brain_activation_recorded: true,
      retained_longitudinal_case_is_candidate_evidence_only: true,
      retained_admission_is_effectiveness_claim: false,
      retained_admission_is_success_claim: false,
      preference_selected: false,
      action_selected: false,
      numeric_effectiveness_or_success_rate_assigned: false,
      probability_confidence_utility_reward_q_value_assigned: false,
      causal_or_outcome_credit_assigned: false,
      rule_or_preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      ordinary_subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    };
  });
  intents.sort((left, right) => compareText(
    left.deliberative_reuse_intent_ref,
    right.deliberative_reuse_intent_ref,
  ));
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
    phase: "Phase82F",
    character,
    current_turn_id: source.current_turn_id,
    source_phase82e_projection_hash: source.projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    deliberative_reuse_intent_count: intents.length,
    deliberative_reuse_intents: intents,
    character_view: characterView(intents),
    audit: {
      exact_phase82e_lineage_required: true,
      exact_phase82d_phase82c_history_lineage_revalidated_by_source: true,
      exact_current_phase81n_relevance_revalidated_by_source: true,
      explicit_character_brain_activation_required: true,
      omitted_candidate_means_no_deliberative_reuse: true,
      retained_longitudinal_case_treated_as_candidate_evidence_only: true,
      retained_admission_interpreted_as_effectiveness: false,
      retained_admission_interpreted_as_success: false,
      preference_selection_performed: false,
      action_selection_performed: false,
      numeric_effectiveness_success_probability_confidence_utility_reward_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      rule_or_preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      ordinary_subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
    projection,
    {
      character,
      source_phase82e_projection: source,
      expected_source: input.expected_source ?? {},
    },
  );
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion
      || projection.phase !== "Phase82F"
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.source_phase82e_projection_hash)
      || !text(projection.resolver_view_hash)
      || !Array.isArray(projection.deliberative_reuse_intents)
      || projection.deliberative_reuse_intent_count !== projection.deliberative_reuse_intents.length
      || projection.deliberative_reuse_intent_count > maximumActivationCount
      || !isObject(projection.character_view)
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_PROJECTION_INVALID",
      "Phase82F longitudinal-case deliberative reuse projection is invalid.",
    );
  }
  if (Object.hasOwn(expected, "character")
      && !sameCharacter(projection.character, expected.character)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_LINEAGE_MISMATCH",
      "Phase82F projection character does not match expected lineage.",
    );
  }
  const source = Object.hasOwn(expected, "source_phase82e_projection")
    ? assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
      expected.source_phase82e_projection,
      expected.expected_source ?? {},
    )
    : null;
  const candidateByRef = source
    ? new Map(source.reentry_candidates
      .filter((candidate) => sameCharacter(candidate?.character, projection.character))
      .map((candidate) => [candidate.reentry_candidate_ref, candidate]))
    : null;
  if (source) {
    if (projection.current_turn_id !== source.current_turn_id
        || projection.source_phase82e_projection_hash !== source.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_SOURCE_MISMATCH",
        "Phase82F projection does not match its exact canonical Phase82E source.",
      );
    }
    const rebuiltView =
      buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseResolverView({
        character: projection.character,
        source_phase82e_projection: source,
        expected_source: expected.expected_source ?? {},
      });
    if (projection.resolver_view_hash !== rebuiltView.resolver_view_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_VIEW_STALE",
        "Phase82F projection resolver view no longer matches the exact canonical Phase82E source.",
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
        || !text(intent.source_phase82d_admission_ref)
        || !text(intent.source_phase82d_admission_hash)
        || !text(intent.source_phase82c_appraisal_ref)
        || !text(intent.source_phase82c_appraisal_hash)
        || !text(intent.source_phase81m_capsule_ref)
        || !text(intent.reuse_intent_ref)
        || intent.explicit_character_brain_activation_recorded !== true
        || intent.retained_longitudinal_case_is_candidate_evidence_only !== true
        || intent.retained_admission_is_effectiveness_claim !== false
        || intent.retained_admission_is_success_claim !== false
        || intent.preference_selected !== false
        || intent.action_selected !== false
        || intent.numeric_effectiveness_or_success_rate_assigned !== false
        || intent.probability_confidence_utility_reward_q_value_assigned !== false
        || intent.causal_or_outcome_credit_assigned !== false
        || intent.rule_or_preference_revision_performed !== false
        || intent.belief_revision_performed !== false
        || intent.semantic_revision_performed !== false
        || intent.ordinary_subjective_memory_rewrite_performed !== false
        || intent.world_state_mutated !== false
        || intent.world_truth_authority !== false
        || refs.has(intent.deliberative_reuse_intent_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_INTENT_INVALID",
        "Phase82F deliberative reuse intent violates its bounded advisory authority.",
      );
    }
    if (source) {
      const candidate = candidateByRef.get(intent.source_reentry_candidate_ref);
      if (!candidate
          || candidateRefs.has(intent.source_reentry_candidate_ref)
          || intent.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || intent.current_action_id !== candidate.current_action_id
          || intent.current_action_ref !== candidate.current_action_ref
          || intent.source_turn_id !== candidate.source_turn_id
          || intent.source_revision_to !== candidate.source_revision_to
          || intent.source_phase82d_projection_hash !== candidate.source_phase82d_projection_hash
          || intent.source_phase82d_admission_ref !== candidate.source_phase82d_admission_ref
          || intent.source_phase82d_admission_hash !== candidate.source_phase82d_admission_hash
          || intent.source_phase82c_projection_hash !== candidate.source_phase82c_projection_hash
          || intent.source_phase82c_appraisal_ref !== candidate.source_phase82c_appraisal_ref
          || intent.source_phase82c_appraisal_hash !== candidate.source_phase82c_appraisal_hash
          || intent.source_phase82b_context_ref !== candidate.source_phase82b_context_ref
          || intent.source_phase82a_context_ref !== candidate.source_phase82a_context_ref
          || intent.source_phase81m_capsule_ref !== candidate.source_phase81m_capsule_ref
          || intent.reuse_intent_ref !== candidate.reuse_intent_ref
          || intent.current_phase81n_projection_hash !== candidate.current_phase81n_projection_hash
          || intent.current_phase81n_reentry_candidate_ref
            !== candidate.current_phase81n_reentry_candidate_ref
          || intent.current_phase81n_reentry_candidate_hash
            !== candidate.current_phase81n_reentry_candidate_hash
          || intent.current_context_difference_present
            !== (candidate.current_context_difference_present === true)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_SOURCE_MISMATCH",
          "Phase82F intent no longer matches the exact canonical Phase82E re-entry candidate.",
        );
      }
      candidateRefs.add(intent.source_reentry_candidate_ref);
    }
    const identity = cloneJson(intent);
    for (const key of [
      "deliberative_reuse_intent_ref",
      "deliberative_reuse_intent_hash",
      "explicit_character_brain_activation_recorded",
      "retained_longitudinal_case_is_candidate_evidence_only",
      "retained_admission_is_effectiveness_claim",
      "retained_admission_is_success_claim",
      "preference_selected",
      "action_selected",
      "numeric_effectiveness_or_success_rate_assigned",
      "probability_confidence_utility_reward_q_value_assigned",
      "causal_or_outcome_credit_assigned",
      "rule_or_preference_revision_performed",
      "belief_revision_performed",
      "semantic_revision_performed",
      "ordinary_subjective_memory_rewrite_performed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const computedHash = hashAgentRunValue(identity);
    if (intent.deliberative_reuse_intent_hash !== computedHash
        || intent.deliberative_reuse_intent_ref
          !== `phase82f_longitudinal_case_reuse_${computedHash.slice(0, 24)}`) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REUSE_INTENT_HASH_INVALID",
        "Phase82F deliberative reuse intent identity/hash is invalid.",
      );
    }
    refs.add(intent.deliberative_reuse_intent_ref);
  }
  return Object.freeze(projection);
}
