import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence,
  buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence,
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-evidence-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion =
  "phase82b-counterfactual-linked-experience-longitudinal-reuse-outcome-variation-v1";

const comparableOutcomeFields = Object.freeze([
  "performed",
  "perceived_result",
  "perceived_status",
]);
const maximumContextCount = 32;
const maximumPriorComparisonCountPerContext = 12;

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
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_INPUT_INVALID",
      `Phase82B ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredText(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function scalarEqual(left, right) {
  return hashAgentRunValue(left) === hashAgentRunValue(right);
}

function compareSubjectiveExperiences(currentExperience, priorExperience) {
  const current = isObject(currentExperience) ? currentExperience : {};
  const prior = isObject(priorExperience) ? priorExperience : {};
  const fieldComparisons = comparableOutcomeFields.map((field) => {
    const currentPresent = Object.hasOwn(current, field);
    const priorPresent = Object.hasOwn(prior, field);
    let relation = "missing_both";
    if (currentPresent && priorPresent) {
      relation = scalarEqual(current[field], prior[field]) ? "exact_match" : "different";
    } else if (currentPresent) {
      relation = "missing_prior";
    } else if (priorPresent) {
      relation = "missing_current";
    }
    return { field, relation };
  });
  const observed = fieldComparisons.filter((item) => item.relation !== "missing_both");
  const differing = observed.filter((item) => item.relation !== "exact_match");
  return {
    field_comparisons: fieldComparisons,
    comparable_field_count: observed.filter((item) =>
      item.relation === "exact_match" || item.relation === "different").length,
    exact_match_field_count: observed.filter((item) => item.relation === "exact_match").length,
    differing_or_missing_field_count: differing.length,
    exact_subjective_outcome_match: observed.length > 0 && differing.length === 0,
    subjective_outcome_variation_observed: differing.length > 0,
  };
}

function comparisonForPrior(context, currentAnchor, prior) {
  const comparison = compareSubjectiveExperiences(
    currentAnchor.selected_action_subjective_experience,
    prior.selected_action_subjective_experience,
  );
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion,
    character: context.character,
    source_phase82a_context_ref: context.context_ref,
    source_phase82a_context_hash: context.context_hash,
    current_turn_id: currentAnchor.turn_id,
    current_phase81q_evidence_ref: currentAnchor.phase81q_evidence_ref,
    current_phase81q_evidence_hash: currentAnchor.phase81q_evidence_hash,
    prior_turn_id: prior.turn_id,
    prior_phase81q_evidence_ref: prior.phase81q_evidence_ref,
    prior_phase81q_evidence_hash: prior.phase81q_evidence_hash,
    field_comparisons: comparison.field_comparisons,
  };
  const comparisonHash = hashAgentRunValue(identity);
  return {
    comparison_ref: `phase82b_variation_${comparisonHash.slice(0, 24)}`,
    comparison_hash: comparisonHash,
    ...identity,
    comparable_field_count: comparison.comparable_field_count,
    exact_match_field_count: comparison.exact_match_field_count,
    differing_or_missing_field_count: comparison.differing_or_missing_field_count,
    exact_subjective_outcome_match: comparison.exact_subjective_outcome_match,
    subjective_outcome_variation_observed: comparison.subjective_outcome_variation_observed,
    effectiveness_interpretation_performed: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
  };
}

function deriveComparisonContexts(phase82a) {
  const contexts = [];
  for (const source of phase82a.character_case_contexts) {
    if (source.longitudinal_ready !== true || source.prior_reuse_outcome_count < 1) continue;
    if (source.prior_reuse_outcome_count > maximumPriorComparisonCountPerContext) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_LIMIT_EXCEEDED",
        `Phase82B accepts at most ${maximumPriorComparisonCountPerContext} prior outcomes per context.`,
      );
    }
    const currentAnchor = source.current_anchor;
    const comparisons = source.prior_reuse_outcomes.map((prior) =>
      comparisonForPrior(source, currentAnchor, prior));
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion,
      world_simulation_session_id: phase82a.world_simulation_session_id,
      turn_id: phase82a.turn_id,
      state_revision: phase82a.state_revision,
      world_state_hash: phase82a.world_state_hash,
      character: source.character,
      source_phase82a_context_ref: source.context_ref,
      source_phase82a_context_hash: source.context_hash,
      source_phase81m_capsule_ref: source.source_phase81m_capsule_ref,
      source_phase81l_evidence_ref: source.source_phase81l_evidence_ref,
      reuse_intent_ref: source.reuse_intent_ref,
      current_turn_id: currentAnchor.turn_id,
      current_phase81q_evidence_ref: currentAnchor.phase81q_evidence_ref,
      current_phase81q_evidence_hash: currentAnchor.phase81q_evidence_hash,
      prior_comparisons: comparisons,
    };
    const contextHash = hashAgentRunValue(identity);
    const exactMatchCount = comparisons.filter((item) => item.exact_subjective_outcome_match).length;
    const variationCount = comparisons.filter((item) => item.subjective_outcome_variation_observed).length;
    contexts.push({
      comparison_context_ref: `phase82b_context_${contextHash.slice(0, 24)}`,
      comparison_context_hash: contextHash,
      ...identity,
      prior_comparison_count: comparisons.length,
      exact_subjective_outcome_match_count: exactMatchCount,
      subjective_outcome_variation_count: variationCount,
      all_prior_subjective_outcomes_exactly_match_current:
        comparisons.length > 0 && exactMatchCount === comparisons.length,
      any_subjective_outcome_variation_observed: variationCount > 0,
      effectiveness_interpretation_performed: false,
      success_failure_interpretation_performed: false,
      reward_or_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      recurrence_count_auto_promotes_rule: false,
    });
  }
  contexts.sort((left, right) => compareText(left.comparison_context_ref, right.comparison_context_ref));
  if (contexts.length > maximumContextCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_LIMIT_EXCEEDED",
      `Phase82B accepts at most ${maximumContextCount} comparison contexts per turn.`,
    );
  }
  return contexts;
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion,
    phase: "Phase82B",
    status: "bounded_longitudinal_reuse_outcome_variation_evidence_installed",
    source_owner: "Phase82A",
    exact_phase82a_projection_hash_required: true,
    exact_phase82a_context_hash_required: true,
    same_character_same_root_reuse_case_inherited: true,
    comparison_fields: [...comparableOutcomeFields],
    per_prior_outcome_comparison_preserved: true,
    missing_field_distinction_preserved: true,
    exact_match_is_not_effectiveness_claim: true,
    variation_is_not_failure_claim: true,
    effectiveness_interpretation_performed: false,
    success_failure_interpretation_performed: false,
    reward_or_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    recurrence_count_auto_promotes_rule: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    qualitative_appraisal_deferred_to_separate_phase: true,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion
      || projection.phase !== "Phase82B"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase82a_projection_hash)
      || !Array.isArray(projection.comparison_contexts)
      || projection.comparison_context_count !== projection.comparison_contexts.length
      || projection.comparison_context_count > maximumContextCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_INVALID",
      "Phase82B longitudinal reuse-outcome variation projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && expected[key] !== undefined && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_LINEAGE_MISMATCH",
        `Phase82B projection ${key} does not match expected lineage.`,
      );
    }
  }
  const seenContexts = new Set();
  const seenComparisons = new Set();
  for (const context of projection.comparison_contexts) {
    if (!isObject(context)
        || !text(context.comparison_context_ref)
        || !text(context.comparison_context_hash)
        || !text(context.character)
        || !text(context.source_phase82a_context_ref)
        || !text(context.source_phase82a_context_hash)
        || !text(context.source_phase81m_capsule_ref)
        || !text(context.source_phase81l_evidence_ref)
        || !text(context.reuse_intent_ref)
        || !Array.isArray(context.prior_comparisons)
        || context.prior_comparison_count !== context.prior_comparisons.length
        || context.prior_comparison_count < 1
        || context.prior_comparison_count > maximumPriorComparisonCountPerContext
        || context.exact_subjective_outcome_match_count
          !== context.prior_comparisons.filter((item) => item.exact_subjective_outcome_match === true).length
        || context.subjective_outcome_variation_count
          !== context.prior_comparisons.filter((item) => item.subjective_outcome_variation_observed === true).length
        || context.all_prior_subjective_outcomes_exactly_match_current
          !== (context.prior_comparison_count > 0
            && context.exact_subjective_outcome_match_count === context.prior_comparison_count)
        || context.any_subjective_outcome_variation_observed
          !== (context.subjective_outcome_variation_count > 0)
        || context.effectiveness_interpretation_performed !== false
        || context.success_failure_interpretation_performed !== false
        || context.reward_or_q_value_modeled !== false
        || context.causal_or_outcome_credit_assigned !== false
        || context.recurrence_count_auto_promotes_rule !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_CONTEXT_INVALID",
        "Phase82B contains an invalid or over-authoritative comparison context.",
      );
    }
    const contextIdentity = cloneJson(context);
    for (const key of [
      "comparison_context_ref", "comparison_context_hash", "prior_comparison_count",
      "exact_subjective_outcome_match_count", "subjective_outcome_variation_count",
      "all_prior_subjective_outcomes_exactly_match_current", "any_subjective_outcome_variation_observed",
      "effectiveness_interpretation_performed", "success_failure_interpretation_performed",
      "reward_or_q_value_modeled", "causal_or_outcome_credit_assigned",
      "recurrence_count_auto_promotes_rule",
    ]) delete contextIdentity[key];
    const expectedContextHash = hashAgentRunValue(contextIdentity);
    if (context.comparison_context_hash !== expectedContextHash
        || context.comparison_context_ref !== `phase82b_context_${expectedContextHash.slice(0, 24)}`
        || seenContexts.has(context.comparison_context_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_CONTEXT_HASH_MISMATCH",
        "Phase82B comparison context identity verification failed.",
      );
    }
    seenContexts.add(context.comparison_context_ref);
    for (const comparison of context.prior_comparisons) {
      if (!isObject(comparison)
          || comparison.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion
          || characterKey(comparison.character) !== characterKey(context.character)
          || comparison.source_phase82a_context_ref !== context.source_phase82a_context_ref
          || comparison.source_phase82a_context_hash !== context.source_phase82a_context_hash
          || !text(comparison.current_phase81q_evidence_ref)
          || !text(comparison.current_phase81q_evidence_hash)
          || !text(comparison.prior_phase81q_evidence_ref)
          || !text(comparison.prior_phase81q_evidence_hash)
          || !Array.isArray(comparison.field_comparisons)
          || comparison.field_comparisons.length !== comparableOutcomeFields.length
          || comparison.field_comparisons.some((item, index) =>
            !isObject(item)
            || item.field !== comparableOutcomeFields[index]
            || !["exact_match", "different", "missing_current", "missing_prior", "missing_both"]
              .includes(item.relation))
          || comparison.effectiveness_interpretation_performed !== false
          || comparison.success_failure_interpretation_performed !== false
          || comparison.causal_or_outcome_credit_assigned !== false
          || !text(comparison.comparison_ref)
          || !text(comparison.comparison_hash)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_COMPARISON_INVALID",
          "Phase82B contains an invalid prior-outcome comparison.",
        );
      }
      const comparableCount = comparison.field_comparisons.filter((item) =>
        item.relation === "exact_match" || item.relation === "different").length;
      const exactCount = comparison.field_comparisons.filter((item) => item.relation === "exact_match").length;
      const differenceCount = comparison.field_comparisons.filter((item) =>
        item.relation !== "exact_match" && item.relation !== "missing_both").length;
      const observedCount = comparison.field_comparisons.filter((item) => item.relation !== "missing_both").length;
      if (comparison.comparable_field_count !== comparableCount
          || comparison.exact_match_field_count !== exactCount
          || comparison.differing_or_missing_field_count !== differenceCount
          || comparison.exact_subjective_outcome_match !== (observedCount > 0 && differenceCount === 0)
          || comparison.subjective_outcome_variation_observed !== (differenceCount > 0)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_COMPARISON_DERIVATION_MISMATCH",
          "Phase82B comparison summary no longer matches field-level evidence.",
        );
      }
      const comparisonIdentity = cloneJson(comparison);
      for (const key of [
        "comparison_ref", "comparison_hash", "comparable_field_count", "exact_match_field_count",
        "differing_or_missing_field_count", "exact_subjective_outcome_match",
        "subjective_outcome_variation_observed", "effectiveness_interpretation_performed",
        "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
      ]) delete comparisonIdentity[key];
      const expectedComparisonHash = hashAgentRunValue(comparisonIdentity);
      if (comparison.comparison_hash !== expectedComparisonHash
          || comparison.comparison_ref !== `phase82b_variation_${expectedComparisonHash.slice(0, 24)}`
          || seenComparisons.has(comparison.comparison_ref)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_COMPARISON_HASH_MISMATCH",
          "Phase82B comparison identity verification failed.",
        );
      }
      seenComparisons.add(comparison.comparison_ref);
    }
  }
  if (projection.audit.exact_phase82a_projection_hash_verified !== true
      || projection.audit.exact_phase82a_context_hashes_verified !== true
      || projection.audit.per_prior_outcome_comparison_preserved !== true
      || projection.audit.missing_field_distinction_preserved !== true
      || projection.audit.effectiveness_interpretation_performed !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.reward_or_q_value_modeled !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.recurrence_count_auto_promotes_rule !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.same_turn_character_brain_feedback !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_evidence !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true
      || projection.persistence_boundary.qualitative_appraisal_deferred_to_separate_phase !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_BOUNDARY_INVALID",
      "Phase82B projection violates its structural-evidence authority boundary.",
    );
  }

  if (expected.longitudinal_reuse_outcome_evidence !== undefined) {
    const source = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
      expected.longitudinal_reuse_outcome_evidence,
      {
        world_simulation_session_id: projection.world_simulation_session_id,
        turn_id: projection.turn_id,
        state_revision: projection.state_revision,
        world_state_hash: projection.world_state_hash,
      },
    );
    if (source.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion
        || source.projection_hash !== projection.source_phase82a_projection_hash
        || hashAgentRunValue(deriveComparisonContexts(source))
          !== hashAgentRunValue(projection.comparison_contexts)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_LINEAGE_MISMATCH",
        "Phase82B projection no longer matches its exact canonical Phase82A source evidence.",
      );
    }
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation(
  input = {},
) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id");
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_INPUT_INVALID",
      "Phase82B state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const suppliedPhase82A = assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
    input.longitudinal_reuse_outcome_evidence,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (suppliedPhase82A.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_PHASE82A_INVALID",
      "Phase82B requires the canonical Phase82A longitudinal evidence version.",
    );
  }
  const phase82a = buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence({
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    world_history: input.world_history,
    current_phase81q_outcome_evidence: input.current_phase81q_outcome_evidence,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage:
      input.counterfactual_linked_experience_reuse_outcome_selected_action_lineage,
    subjective_choice_commitment_receipts:
      input.subjective_choice_commitment_receipts,
    counterfactual_linked_experience_reuse_outcome_reentry_projections:
      input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    counterfactual_linked_experience_reuse_outcome_deliberation_projections:
      input.counterfactual_linked_experience_reuse_outcome_deliberation_projections,
    post_outcome_subjective_perception_projection:
      input.post_outcome_subjective_perception_projection,
  });
  if (phase82a.projection_hash !== suppliedPhase82A.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_VARIATION_PHASE82A_MISMATCH",
      "Phase82B requires Phase82A to match a fresh reconstruction from canonical Phase81Q and World History sources.",
    );
  }
  const contexts = deriveComparisonContexts(phase82a);
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariationVersion,
    phase: "Phase82B",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase82a_projection_hash: phase82a.projection_hash,
    comparison_context_count: contexts.length,
    comparison_contexts: contexts,
    audit: {
      exact_phase82a_projection_hash_verified: true,
      exact_phase82a_context_hashes_verified: true,
      per_prior_outcome_comparison_preserved: true,
      missing_field_distinction_preserved: true,
      exact_match_is_not_effectiveness_claim: true,
      variation_is_not_failure_claim: true,
      effectiveness_interpretation_performed: false,
      success_failure_interpretation_performed: false,
      reward_or_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      recurrence_count_auto_promotes_rule: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_character_brain_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      qualitative_appraisal_deferred_to_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeVariation(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      longitudinal_reuse_outcome_evidence: phase82a,
    },
  );
}
