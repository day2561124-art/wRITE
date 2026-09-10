import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceCandidateProjection,
  worldSimulationAnalogicalExperienceCandidateVersion,
} from "./world-simulation-analogical-experience-candidate-service.mjs";

export const worldSimulationAnalogicalExperienceAdaptationVersion =
  "phase80b-bounded-analogical-adaptation-deliberation-v1";

const maximumAdaptationDecisionCount = 16;
const maximumReferenceItems = 8;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
  return isObject(value) ? value : {};
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
function requiredText(value, label, maxLength = 512) {
  const result = text(value);
  if (!result || result.length > maxLength) {
    const error = new Error(`Phase80B ${label} is required and must be bounded.`);
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_INPUT_INVALID";
    throw error;
  }
  return result;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function projectionHash(value, hashField) {
  const body = cloneJson(value);
  delete body[hashField];
  return hashAgentRunValue(body);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function publicCue(cue, refField) {
  return {
    [refField]: requiredText(cue?.[refField], refField, 240),
    cue_kind: requiredText(cue?.cue_kind, "cue_kind", 120),
    content: cloneJson(cue?.content ?? null),
    subjective_context_evidence_only: true,
    world_truth_authority: false,
  };
}

export function buildWorldSimulationAnalogicalExperienceAdaptationContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceAdaptationVersion,
    phase: "Phase80B",
    status: "bounded_analogical_adaptation_deliberation_installed",
    source_owner: "Phase80A",
    exact_phase80a_projection_hash_required: true,
    near_miss_candidates_only: true,
    structural_alignment_preserved: true,
    aligned_current_cues_may_be_retained: true,
    historical_difference_cues_may_be_dropped: true,
    current_additional_cues_may_be_incorporated: true,
    adaptation_is_ref_selection_not_semantic_authoring: true,
    no_adaptation_may_return_empty: true,
    direct_method_rewrite_allowed: false,
    direct_method_reuse_allowed: false,
    preference_resolution_performed: false,
    action_selection_performed: false,
    plan_goal_belief_current_mind_world_mutation_allowed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    fuzzy_semantic_similarity_modeled: false,
    historical_outcome_is_world_truth: false,
    explanation_or_hidden_reasoning_requested: false,
    maximum_adaptation_decision_count: maximumAdaptationDecisionCount,
    maximum_reference_items_per_kind: maximumReferenceItems,
  });
}

export function buildWorldSimulationAnalogicalExperienceAdaptationResolverView(input = {}) {
  const source = assertWorldSimulationAnalogicalExperienceCandidateProjection(
    input.source_phase80a_projection,
  );
  if (source.version !== worldSimulationAnalogicalExperienceCandidateVersion) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_SOURCE_INVALID",
      "Phase80B requires the exact canonical Phase80A analogy-candidate projection.",
    );
  }
  const candidates = source.analogy_candidates.map((candidate) => ({
    analogy_candidate_ref: candidate.analogy_candidate_ref,
    current_impasse_ref: candidate.current_impasse_ref,
    current_corresponding_method_ref: candidate.current_corresponding_method_ref,
    alignment_kind: candidate.alignment_kind,
    aligned_current_cues: array(candidate.aligned_cue_pairs)
      .map((pair) => ({
        current_cue_ref: requiredText(pair?.current_cue_ref, "aligned current_cue_ref", 240),
        cue_kind: requiredText(pair?.cue_kind, "aligned cue_kind", 120),
        exact_structural_context_alignment: true,
      }))
      .sort((a, b) => compareText(a.current_cue_ref, b.current_cue_ref)),
    historical_difference_cues: array(candidate.historical_unmatched_cues)
      .map((cue) => publicCue(cue, "historical_cue_ref"))
      .sort((a, b) => compareText(a.historical_cue_ref, b.historical_cue_ref)),
    current_additional_cues: array(candidate.current_additional_cues)
      .map((cue) => publicCue(cue, "current_cue_ref"))
      .sort((a, b) => compareText(a.current_cue_ref, b.current_cue_ref)),
    adaptation_required: true,
    direct_reuse_allowed: false,
    source_outcome_assessment: candidate.method_outcome_assessment,
    source_outcome_is_not_comparative_truth: true,
  }));
  const view = {
    version: worldSimulationAnalogicalExperienceAdaptationVersion,
    character: source.character,
    current_turn_id: source.current_turn_id,
    analogy_candidates: candidates,
    response_contract: {
      output_field: "adaptation_decisions",
      may_return_empty_array: true,
      one_decision_per_analogy_candidate_ref: true,
      required_fields: [
        "analogy_candidate_ref",
        "retain_aligned_current_cue_refs",
        "drop_historical_cue_refs",
        "incorporate_current_cue_refs",
      ],
      maximum_adaptation_decision_count: maximumAdaptationDecisionCount,
      maximum_reference_items_per_kind: maximumReferenceItems,
      semantic_method_authoring_allowed: false,
      action_authoring_allowed: false,
      preference_authoring_allowed: false,
    },
    boundaries: {
      source_phase80a_projection_hash: source.projection_hash,
      same_character_only: true,
      raw_world_state_exposed: false,
      raw_world_history_exposed: false,
      source_turn_identity_exposed: false,
      source_revision_exposed: false,
      source_hashes_exposed: false,
      engine_action_ids_exposed: false,
      numeric_scores_exposed: false,
      historical_cues_are_subjective_prior_experience_only: true,
      current_cues_are_character_visible_context_only: true,
      world_truth_authority: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function assertResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationAnalogicalExperienceAdaptationVersion
      || !text(view.character)
      || !text(view.current_turn_id)
      || !Array.isArray(view.analogy_candidates)
      || !text(view.resolver_view_hash)
      || projectionHash(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_RESOLVER_VIEW_INVALID",
      "Phase80B requires an exact canonical bounded adaptation resolver view.",
    );
  }
  return view;
}

function normalizeRefList(raw, allowed, label) {
  if (!Array.isArray(raw)
      || raw.length > maximumReferenceItems
      || raw.some((value) => !text(value))) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_INVALID",
      `Phase80B ${label} must be a bounded array of refs.`,
    );
  }
  const refs = raw.map(text);
  if (new Set(refs).size !== refs.length || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_OUT_OF_VIEW",
      `Phase80B ${label} contains a duplicate or out-of-view ref.`,
    );
  }
  return [...refs].sort(compareText);
}

export function projectWorldSimulationAnalogicalExperienceAdaptation(input = {}) {
  const view = assertResolverView(input.resolver_view);
  if (!Array.isArray(input.adaptation_decisions)
      || input.adaptation_decisions.length > maximumAdaptationDecisionCount) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_INVALID",
      "Phase80B adaptation_decisions must be a bounded array.",
    );
  }
  const candidateByRef = new Map(view.analogy_candidates.map((candidate) => [
    candidate.analogy_candidate_ref,
    candidate,
  ]));
  const seen = new Set();
  const decisions = input.adaptation_decisions.map((raw, index) => {
    if (!isObject(raw)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_INVALID",
        `Phase80B adaptation_decisions[${index}] must be an object.`,
      );
    }
    const allowedKeys = new Set([
      "analogy_candidate_ref",
      "retain_aligned_current_cue_refs",
      "drop_historical_cue_refs",
      "incorporate_current_cue_refs",
    ]);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_AUTHORITY_FIELD_FORBIDDEN",
        `Phase80B adaptation_decisions[${index}] contains an authority or semantic authoring field.`,
      );
    }
    const candidateRef = requiredText(raw.analogy_candidate_ref, "analogy_candidate_ref", 240);
    const candidate = candidateByRef.get(candidateRef);
    if (!candidate || seen.has(candidateRef)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DECISION_OUT_OF_VIEW",
        "Phase80B adaptation decision references an unknown or duplicate analogy candidate.",
      );
    }
    seen.add(candidateRef);
    const aligned = new Set(array(candidate.aligned_current_cues).map((cue) => cue.current_cue_ref));
    const historical = new Set(array(candidate.historical_difference_cues).map((cue) => cue.historical_cue_ref));
    const current = new Set(array(candidate.current_additional_cues).map((cue) => cue.current_cue_ref));
    const retain = normalizeRefList(raw.retain_aligned_current_cue_refs, aligned, "retain_aligned_current_cue_refs");
    const drop = normalizeRefList(raw.drop_historical_cue_refs, historical, "drop_historical_cue_refs");
    const incorporate = normalizeRefList(raw.incorporate_current_cue_refs, current, "incorporate_current_cue_refs");
    if (drop.length === 0 && incorporate.length === 0) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_ADAPTATION_DIFFERENCE_USE_REQUIRED",
        "Phase80B adaptation must address at least one historical difference or current additional cue.",
      );
    }
    return {
      analogy_candidate_ref: candidateRef,
      current_impasse_ref: candidate.current_impasse_ref,
      current_corresponding_method_ref: candidate.current_corresponding_method_ref,
      retain_aligned_current_cue_refs: retain,
      drop_historical_cue_refs: drop,
      incorporate_current_cue_refs: incorporate,
      adaptation_required: true,
      direct_method_reuse: false,
      direct_method_rewrite: false,
      preference_selected: false,
      action_selected: false,
      world_truth_claimed: false,
    };
  });
  const projection = {
    version: worldSimulationAnalogicalExperienceAdaptationVersion,
    character: view.character,
    current_turn_id: view.current_turn_id,
    source_phase80a_projection_hash: view.boundaries.source_phase80a_projection_hash,
    resolver_view_hash: view.resolver_view_hash,
    adaptation_decision_count: decisions.length,
    adaptation_decisions: decisions,
    character_view: {
      source: "difference_aware_structural_analogy_adaptation",
      adaptation_intents: decisions.map((decision) => cloneJson(decision)),
      advisory_only: true,
      further_current_context_revalidation_required: true,
      concrete_method_or_action_generation_deferred: true,
    },
    audit: {
      exact_phase80a_source_bound: true,
      structural_alignment_preserved: true,
      context_differences_addressed_by_refs_only: true,
      resolver_authored_semantic_method_content: false,
      direct_method_reuse_performed: false,
      direct_method_rewrite_performed: false,
      preference_resolution_performed: false,
      action_selection_performed: false,
      plan_goal_belief_current_mind_world_mutation_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      fuzzy_semantic_similarity_used: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
