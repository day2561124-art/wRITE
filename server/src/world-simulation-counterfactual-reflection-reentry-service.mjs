import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
  subjectiveActionDeliberationCharacterViewVersion,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  postOutcomeCounterfactualComparisonDirections,
} from "./world-simulation-post-outcome-counterfactual-alternative-evidence-service.mjs";
import {
  postOutcomeCounterfactualAppraisalKinds,
  postOutcomeCounterfactualPreparativeOrientations,
} from "./world-simulation-post-outcome-counterfactual-appraisal-service.mjs";
import {
  assertWorldSimulationPostOutcomeCounterfactualReflectionRetention,
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
} from "./world-simulation-post-outcome-counterfactual-reflection-retention-service.mjs";

export const worldSimulationCounterfactualReflectionReentryVersion =
  "phase81d-counterfactual-reflection-reentry-v1";

const maximumHistoryTurnsScanned = 64;
const maximumReentryCandidateCount = 32;
const maximumCollectionItems = 8;
const maximumObjectEntries = 12;
const maximumStringChars = 600;
const maximumDepth = 4;

const candidateFields = Object.freeze([
  "intent",
  "prerequisites",
  "known_costs",
  "blocked_by",
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
]);

const actionDefiningFields = new Set([
  "intent",
  "movement",
  "door_interaction",
  "object_interaction",
  "attack",
  "defense",
  "projectile",
  "ability",
]);

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
  const normalized = value.trim();
  return normalized || null;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_INPUT_INVALID",
      `Phase81D ${label} is required and must be bounded.`,
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
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function semanticValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  return true;
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
  if (depth > maximumDepth || value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? Array.from(normalized).slice(0, maximumStringChars).join("") : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
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
    if (!semanticValuePresent(child)) continue;
    output[key] = child;
  }
  return output;
}
function candidateSummary(candidate) {
  const source = object(candidate);
  const output = {};
  for (const field of candidateFields) {
    const raw = ["prerequisites", "known_costs", "blocked_by"].includes(field)
      ? array(source[field])
      : source[field];
    const bounded = boundedCandidateValue(raw);
    if (!semanticValuePresent(bounded)) continue;
    output[field] = bounded;
  }
  return output;
}
function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: cloneJson(content) });
}
function cueCatalog(candidate, ownerRef, sourceKind) {
  const summary = candidateSummary(candidate);
  return candidateFields
    .filter((field) => Object.hasOwn(summary, field))
    .map((field) => {
      const cueKind = `action_candidate.${field}`;
      const content = cloneJson(summary[field]);
      const contentHash = cueContentHash(cueKind, content);
      return {
        cue_ref: `phase81d_cue_${hashAgentRunValue({
          owner_ref: ownerRef,
          cue_kind: cueKind,
          cue_content_hash: contentHash,
          source_kind: sourceKind,
        }).slice(0, 24)}`,
        cue_kind: cueKind,
        content,
        cue_content_hash: contentHash,
        action_defining: actionDefiningFields.has(field),
        source_kind: sourceKind,
      };
    });
}
function cueField(cueKind) {
  const normalized = text(cueKind);
  if (!normalized?.startsWith("action_candidate.")) return null;
  const field = normalized.slice("action_candidate.".length);
  return candidateFields.includes(field) ? field : null;
}
function assertCanonicalCue(cue, expectedSourceKind, label) {
  if (!isObject(cue)
      || !text(cue.cue_ref)
      || !text(cue.cue_kind)
      || !text(cue.cue_content_hash)
      || cue.source_kind !== expectedSourceKind) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CUE_INVALID",
      `Phase81D ${label} cue is invalid.`,
    );
  }
  const field = cueField(cue.cue_kind);
  const canonicalContent = boundedCandidateValue(cue.content);
  if (!field
      || !semanticValuePresent(canonicalContent)
      || hashAgentRunValue(canonicalContent) !== hashAgentRunValue(cue.content)
      || cue.cue_content_hash !== cueContentHash(cue.cue_kind, cue.content)
      || cue.action_defining !== actionDefiningFields.has(field)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CUE_INVALID",
      `Phase81D ${label} cue is non-canonical or misclassified.`,
    );
  }
  return cue;
}
function projectionHash(value) {
  const body = cloneJson(value);
  delete body.projection_hash;
  return hashAgentRunValue(body);
}

function verifyCurrentPhase74A(input, character) {
  const expected = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition: input.current_cognition,
    candidate_action_intents: input.current_candidate_action_intents,
  });
  const supplied = cloneJson(input.source_phase74a_deliberation);
  if (!isObject(supplied)
      || supplied.version !== subjectiveActionDeliberationCharacterViewVersion
      || !text(supplied.deliberation_view_hash)
      || supplied.deliberation_view_hash !== expected.deliberation_view_hash
      || hashAgentRunValue(supplied) !== hashAgentRunValue(expected)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_PHASE74A_INVALID",
      "Phase81D requires the exact canonical current Phase74A deliberation view.",
    );
  }
  return supplied;
}

function currentCandidates(input, phase74A) {
  const raw = array(input.current_candidate_action_intents);
  const optionsById = new Map(array(phase74A.action_options).map((option) => [option.action_id, option]));
  const seen = new Set();
  return raw.map((candidate, index) => {
    if (!isObject(candidate)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CURRENT_CANDIDATE_INVALID",
        `Phase81D current candidate ${index} must be an object.`,
      );
    }
    const actionId = requiredText(candidate.action_id, `current candidate ${index}.action_id`, 240);
    const option = optionsById.get(actionId);
    if (!option || seen.has(actionId)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CURRENT_CANDIDATE_INVALID",
        "Phase81D current candidates must resolve uniquely to the canonical Phase74A action set.",
      );
    }
    seen.add(actionId);
    const summary = candidateSummary(candidate);
    const cues = cueCatalog(summary, option.action_ref, "current_phase74a_action_candidate");
    return {
      action_id: actionId,
      action_ref: option.action_ref,
      candidate_summary: summary,
      cues,
    };
  });
}

function historicalCues(capsule) {
  return cueCatalog(
    capsule.imagined_alternative_context.decision_time_candidate,
    capsule.capsule_ref,
    "historical_imagined_decision_time_alternative",
  );
}

function buildCandidate({ capsule, retainedProjection, sourceTurn, current }) {
  const retainedCues = historicalCues(capsule);
  const matches = [];
  for (const historical of retainedCues) {
    for (const currentCue of current.cues) {
      if (historical.cue_kind !== currentCue.cue_kind
          || historical.cue_content_hash !== currentCue.cue_content_hash) continue;
      matches.push({
        retained_cue_ref: historical.cue_ref,
        current_cue_ref: currentCue.cue_ref,
        cue_kind: historical.cue_kind,
        cue_content_hash: historical.cue_content_hash,
        action_defining: historical.action_defining === true && currentCue.action_defining === true,
        exact_kind_and_content_match: true,
      });
    }
  }
  matches.sort((left, right) => compareText(left.retained_cue_ref, right.retained_cue_ref)
    || compareText(left.current_cue_ref, right.current_cue_ref));
  if (!matches.some((match) => match.action_defining === true)) return null;

  const matchedRetained = new Set(matches.map((match) => match.retained_cue_ref));
  const matchedCurrent = new Set(matches.map((match) => match.current_cue_ref));
  const unmatchedRetained = retainedCues.filter((cue) => !matchedRetained.has(cue.cue_ref));
  const currentAdditional = current.cues.filter((cue) => !matchedCurrent.has(cue.cue_ref));
  const identity = {
    version: worldSimulationCounterfactualReflectionReentryVersion,
    current_action_ref: current.action_ref,
    current_action_id: current.action_id,
    source_turn_id: sourceTurn.turn_id,
    source_revision_to: sourceTurn.revision_to,
    source_phase81c_projection_hash: retainedProjection.projection_hash,
    source_phase81c_capsule_ref: capsule.capsule_ref,
    source_phase81c_capsule_hash: capsule.capsule_hash,
    source_phase81b_appraisal_ref: capsule.source_phase81b_appraisal_ref,
    source_phase81b_appraisal_hash: capsule.source_phase81b_appraisal_hash,
    source_phase81a_evidence_ref: capsule.source_phase81a_evidence_ref,
    source_phase81a_evidence_hash: capsule.source_phase81a_evidence_hash,
    historical_actual_selected_action_ref: capsule.actual_experienced_anchor.selected_action_ref,
    historical_actual_selected_action_id: capsule.actual_experienced_anchor.selected_action_id,
    historical_imagined_alternative_action_ref:
      capsule.imagined_alternative_context.alternative_action_ref,
    historical_imagined_alternative_action_id:
      capsule.imagined_alternative_context.alternative_action_id,
    historical_comparison_direction: capsule.comparison_direction,
    historical_appraisal_kind: capsule.appraisal_kind,
    historical_preparative_orientation: capsule.preparative_orientation,
    historical_salient_branch_refs:
      cloneJson(capsule.imagined_alternative_context.salient_branch_refs),
    exact_current_cue_matches: matches,
    unmatched_retained_candidate_cues: cloneJson(unmatchedRetained),
    current_additional_candidate_cues: cloneJson(currentAdditional),
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      reentry_source: "prior_committed_counterfactual_reflection_capsule",
      sources_may_not_be_collapsed: true,
    },
  };
  const candidateHash = hashAgentRunValue(identity);
  return {
    reentry_candidate_ref: `phase81d_reentry_${candidateHash.slice(0, 24)}`,
    reentry_candidate_hash: candidateHash,
    ...identity,
    exact_current_cue_match_count: matches.length,
    action_defining_exact_match_present: true,
    unmatched_retained_candidate_cue_count: unmatchedRetained.length,
    current_additional_candidate_cue_count: currentAdditional.length,
    current_context_difference_present:
      unmatchedRetained.length > 0 || currentAdditional.length > 0,
    historical_counterfactual_is_candidate_evidence_only: true,
    historical_counterfactual_is_episodic_fact_memory: false,
    historical_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    historical_counterfactual_world_truth: false,
    causal_superiority_inferred: false,
    automatic_preference_revision_performed: false,
    action_selected: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_state_mutated: false,
    resolver_used: false,
    world_truth_authority: false,
  };
}

export function buildWorldSimulationCounterfactualReflectionReentryContract() {
  return deepFreeze({
    version: worldSimulationCounterfactualReflectionReentryVersion,
    phase: "Phase81D",
    status: "cue_dependent_counterfactual_reflection_cross_turn_reentry_installed",
    source_history_owner: "WorldSimulationHistory",
    source_retention_owner: "Phase81C",
    current_candidate_owner: "Phase74A_existing_world_action_proposer_candidates",
    same_character_prior_committed_turns_only: true,
    same_turn_feedback_allowed: false,
    exact_phase81c_capsule_hash_and_lineage_required: true,
    exact_current_phase74a_deliberation_required: true,
    exact_action_defining_cue_overlap_required: true,
    fuzzy_semantic_similarity_modeled: false,
    prior_counterfactual_is_candidate_evidence_only: true,
    prior_counterfactual_is_episodic_fact_memory: false,
    unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    automatic_preference_revision_performed: false,
    action_selection_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    direct_world_state_mutation_allowed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    technical_history_window_not_cognitive_weight: true,
    maximum_history_turns_scanned: maximumHistoryTurnsScanned,
    maximum_reentry_candidate_count: maximumReentryCandidateCount,
  });
}

export function assertWorldSimulationCounterfactualReflectionReentryProjection(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualReflectionReentryVersion
      || projection.phase !== "Phase81D"
      || !text(projection.world_simulation_session_id)
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !Number.isSafeInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !text(projection.current_world_state_hash)
      || !text(projection.source_phase74a_deliberation_view_hash)
      || !Number.isSafeInteger(projection.retained_projection_count_scanned)
      || projection.retained_projection_count_scanned < 0
      || !Number.isSafeInteger(projection.same_character_retention_capsule_count_scanned)
      || projection.same_character_retention_capsule_count_scanned < 0
      || !Array.isArray(projection.reentry_candidates)
      || projection.reentry_candidate_count !== projection.reentry_candidates.length
      || projection.reentry_candidate_count > maximumReentryCandidateCount
      || !isObject(projection.history_window)
      || !Number.isSafeInteger(projection.history_window.total_prior_committed_turn_count)
      || projection.history_window.total_prior_committed_turn_count < 0
      || !Number.isSafeInteger(projection.history_window.scanned_turn_count)
      || projection.history_window.scanned_turn_count < 0
      || projection.history_window.scanned_turn_count > maximumHistoryTurnsScanned
      || projection.history_window.scanned_turn_count
        > projection.history_window.total_prior_committed_turn_count
      || projection.history_window.maximum_history_turns_scanned !== maximumHistoryTurnsScanned
      || projection.history_window.truncated
        !== (projection.history_window.total_prior_committed_turn_count > maximumHistoryTurnsScanned)
      || projection.history_window.technical_bound_only !== true
      || projection.history_window.recency_is_not_confidence_or_utility !== true
      || projection.retained_projection_count_scanned > projection.history_window.scanned_turn_count
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_INVALID",
      "Phase81D counterfactual reflection re-entry projection is invalid.",
    );
  }
  for (const key of [
    "world_simulation_session_id",
    "character",
    "current_turn_id",
    "current_state_revision",
    "current_world_state_hash",
  ]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_LINEAGE_MISMATCH",
        `Phase81D projection ${key} does not match expected lineage.`,
      );
    }
  }
  if (projection.audit.same_character_prior_committed_turns_only !== true
      || projection.audit.same_turn_history_ignored !== true
      || projection.audit.exact_phase81c_capsule_hash_and_lineage_verified !== true
      || projection.audit.exact_current_phase74a_deliberation_verified !== true
      || projection.audit.action_defining_exact_cue_overlap_required !== true
      || projection.audit.fuzzy_semantic_similarity_used !== false
      || projection.audit.prior_counterfactual_treated_as_candidate_evidence_only !== true
      || projection.audit.prior_counterfactual_treated_as_episodic_fact_memory !== false
      || projection.audit.unchosen_outcome_observed !== false
      || projection.audit.counterfactual_world_truth_claimed !== false
      || projection.audit.causal_superiority_inferred !== false
      || projection.audit.automatic_preference_action_belief_revision !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.resolver_used !== false
      || projection.audit.same_turn_character_brain_feedback !== false
      || projection.audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_BOUNDARY_INVALID",
      "Phase81D projection violates its source-monitoring or authority boundary.",
    );
  }
  const refs = new Set();
  for (const candidate of projection.reentry_candidates) {
    if (!isObject(candidate)
        || !text(candidate.reentry_candidate_ref)
        || !text(candidate.reentry_candidate_hash)
        || !text(candidate.current_action_ref)
        || !text(candidate.current_action_id)
        || !text(candidate.source_turn_id)
        || !Number.isSafeInteger(candidate.source_revision_to)
        || !text(candidate.source_phase81c_projection_hash)
        || !text(candidate.source_phase81c_capsule_ref)
        || !text(candidate.source_phase81c_capsule_hash)
        || !text(candidate.source_phase81b_appraisal_ref)
        || !text(candidate.source_phase81b_appraisal_hash)
        || !text(candidate.source_phase81a_evidence_ref)
        || !text(candidate.source_phase81a_evidence_hash)
        || !text(candidate.historical_actual_selected_action_ref)
        || !text(candidate.historical_actual_selected_action_id)
        || !text(candidate.historical_imagined_alternative_action_ref)
        || !text(candidate.historical_imagined_alternative_action_id)
        || !postOutcomeCounterfactualComparisonDirections.includes(
          candidate.historical_comparison_direction,
        )
        || !postOutcomeCounterfactualAppraisalKinds.includes(candidate.historical_appraisal_kind)
        || !postOutcomeCounterfactualPreparativeOrientations.includes(
          candidate.historical_preparative_orientation,
        )
        || !Array.isArray(candidate.historical_salient_branch_refs)
        || candidate.historical_salient_branch_refs.some((ref) => !text(ref))
        || new Set(candidate.historical_salient_branch_refs).size
          !== candidate.historical_salient_branch_refs.length
        || candidate.source_turn_id === projection.current_turn_id
        || candidate.source_revision_to < 1
        || candidate.source_revision_to > projection.current_state_revision
        || !Array.isArray(candidate.exact_current_cue_matches)
        || candidate.exact_current_cue_matches.length === 0
        || candidate.exact_current_cue_match_count !== candidate.exact_current_cue_matches.length
        || candidate.action_defining_exact_match_present !== true
        || !candidate.exact_current_cue_matches.some((match) => match?.action_defining === true)
        || !Array.isArray(candidate.unmatched_retained_candidate_cues)
        || candidate.unmatched_retained_candidate_cue_count
          !== candidate.unmatched_retained_candidate_cues.length
        || !Array.isArray(candidate.current_additional_candidate_cues)
        || candidate.current_additional_candidate_cue_count
          !== candidate.current_additional_candidate_cues.length
        || !isObject(candidate.source_monitoring)
        || candidate.source_monitoring.actual_anchor_source !== "experienced_subjective_outcome"
        || candidate.source_monitoring.alternative_source !== "imagined_decision_time_possibility"
        || candidate.source_monitoring.appraisal_source !== "subjective_counterfactual_reflection"
        || candidate.source_monitoring.reentry_source
          !== "prior_committed_counterfactual_reflection_capsule"
        || candidate.source_monitoring.sources_may_not_be_collapsed !== true
        || candidate.historical_counterfactual_is_candidate_evidence_only !== true
        || candidate.historical_counterfactual_is_episodic_fact_memory !== false
        || candidate.historical_alternative_was_experienced !== false
        || candidate.historical_unchosen_outcome_observed !== false
        || candidate.historical_counterfactual_world_truth !== false
        || candidate.causal_superiority_inferred !== false
        || candidate.automatic_preference_revision_performed !== false
        || candidate.action_selected !== false
        || candidate.belief_revision_performed !== false
        || candidate.semantic_revision_performed !== false
        || candidate.subjective_memory_rewrite_performed !== false
        || candidate.world_state_mutated !== false
        || candidate.resolver_used !== false
        || candidate.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CANDIDATE_INVALID",
        "Phase81D re-entry candidate violates its bounded evidence contract.",
      );
    }
    const matchKeys = new Set();
    for (const match of candidate.exact_current_cue_matches) {
      const field = cueField(match?.cue_kind);
      const key = `${match?.retained_cue_ref ?? ""}\u0000${match?.current_cue_ref ?? ""}`;
      if (!isObject(match)
          || !text(match.retained_cue_ref)
          || !text(match.current_cue_ref)
          || !field
          || !text(match.cue_content_hash)
          || match.exact_kind_and_content_match !== true
          || match.action_defining !== actionDefiningFields.has(field)
          || matchKeys.has(key)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_MATCH_INVALID",
          "Phase81D exact cue match metadata is invalid or duplicated.",
        );
      }
      matchKeys.add(key);
    }
    for (const cue of candidate.unmatched_retained_candidate_cues) {
      assertCanonicalCue(
        cue,
        "historical_imagined_decision_time_alternative",
        "unmatched retained candidate",
      );
    }
    for (const cue of candidate.current_additional_candidate_cues) {
      assertCanonicalCue(cue, "current_phase74a_action_candidate", "current additional candidate");
    }
    if (candidate.current_context_difference_present
          !== (candidate.unmatched_retained_candidate_cues.length > 0
            || candidate.current_additional_candidate_cues.length > 0)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CANDIDATE_INVALID",
        "Phase81D current-context difference flag does not match retained/current cue evidence.",
      );
    }
    const identity = cloneJson(candidate);
    for (const key of [
      "reentry_candidate_ref",
      "reentry_candidate_hash",
      "exact_current_cue_match_count",
      "action_defining_exact_match_present",
      "unmatched_retained_candidate_cue_count",
      "current_additional_candidate_cue_count",
      "current_context_difference_present",
      "historical_counterfactual_is_candidate_evidence_only",
      "historical_counterfactual_is_episodic_fact_memory",
      "historical_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "historical_counterfactual_world_truth",
      "causal_superiority_inferred",
      "automatic_preference_revision_performed",
      "action_selected",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "resolver_used",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (candidate.reentry_candidate_hash !== expectedHash
        || candidate.reentry_candidate_ref !== `phase81d_reentry_${expectedHash.slice(0, 24)}`
        || refs.has(candidate.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CANDIDATE_HASH_MISMATCH",
        "Phase81D re-entry candidate identity verification failed.",
      );
    }
    refs.add(candidate.reentry_candidate_ref);
  }
  return deepFreeze(projection);
}

export function projectWorldSimulationCounterfactualReflectionReentry(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
    240,
  );
  const character = requiredText(input.character, "character", 240);
  const currentTurnId = requiredText(input.current_turn_id, "current_turn_id", 240);
  if (!Number.isSafeInteger(input.current_state_revision) || input.current_state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_INPUT_INVALID",
      "Phase81D current_state_revision must be a non-negative safe integer.",
    );
  }
  const currentWorldStateHash = requiredText(
    input.current_world_state_hash,
    "current_world_state_hash",
    128,
  );
  const phase74A = verifyCurrentPhase74A(input, character);
  const current = currentCandidates(input, phase74A);
  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== worldSimulationSessionId
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_HISTORY_INVALID",
      "Phase81D requires canonical same-session World Simulation history.",
    );
  }

  const priorTurns = history.turns.filter((turn) =>
    isObject(turn)
      && turn.turn_id !== currentTurnId
      && Number.isSafeInteger(turn.revision_from)
      && turn.revision_from >= 0
      && Number.isSafeInteger(turn.revision_to)
      && turn.revision_to >= 1
      && turn.revision_to <= input.current_state_revision);
  const truncated = priorTurns.length > maximumHistoryTurnsScanned;
  const scannedTurns = priorTurns.slice(-maximumHistoryTurnsScanned);
  const candidates = [];
  let retainedProjectionCount = 0;
  let sameCharacterCapsuleCount = 0;

  for (const turn of scannedTurns) {
    const rawRetention = turn.post_outcome_counterfactual_reflection_retention;
    if (!isObject(rawRetention)) continue;
    const retained = assertWorldSimulationPostOutcomeCounterfactualReflectionRetention(rawRetention, {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turn.turn_id,
      state_revision: turn.revision_from,
      world_state_hash: turn.previous_state_hash,
    });
    if (retained.version !== worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_HISTORY_PHASE81C_INVALID",
        "Phase81D historical retention projection version mismatch.",
      );
    }
    retainedProjectionCount += 1;
    for (const capsule of retained.capsules) {
      if (!sameCharacter(capsule.character, character)) continue;
      if (capsule.same_turn_reentry_allowed !== false
          || capsule.counterfactual_capsule_is_episodic_fact_memory !== false
          || capsule.unchosen_outcome_observed !== false
          || capsule.counterfactual_world_truth_claimed !== false
          || capsule.causal_superiority_inferred !== false
          || capsule.automatic_preference_revision_performed !== false
          || capsule.action_selected !== false
          || capsule.belief_revision_performed !== false
          || capsule.semantic_revision_performed !== false
          || capsule.subjective_memory_rewrite_performed !== false
          || capsule.world_state_mutated !== false) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CAPSULE_BOUNDARY_INVALID",
          "Phase81D rejects historical Phase81C capsules that violate the sealed authority boundary.",
        );
      }
      sameCharacterCapsuleCount += 1;
      for (const currentCandidate of current) {
        const candidate = buildCandidate({
          capsule,
          retainedProjection: retained,
          sourceTurn: turn,
          current: currentCandidate,
        });
        if (candidate) candidates.push(candidate);
      }
    }
  }

  candidates.sort((left, right) => {
    if (left.source_revision_to !== right.source_revision_to) {
      return right.source_revision_to - left.source_revision_to;
    }
    return compareText(left.reentry_candidate_ref, right.reentry_candidate_ref);
  });
  const bounded = candidates.slice(0, maximumReentryCandidateCount);
  const projection = {
    version: worldSimulationCounterfactualReflectionReentryVersion,
    phase: "Phase81D",
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
    source_phase74a_deliberation_view_hash: phase74A.deliberation_view_hash,
    retained_projection_count_scanned: retainedProjectionCount,
    same_character_retention_capsule_count_scanned: sameCharacterCapsuleCount,
    reentry_candidate_count: bounded.length,
    reentry_candidates: bounded,
    history_window: {
      total_prior_committed_turn_count: priorTurns.length,
      scanned_turn_count: scannedTurns.length,
      maximum_history_turns_scanned: maximumHistoryTurnsScanned,
      truncated,
      technical_bound_only: true,
      recency_is_not_confidence_or_utility: true,
    },
    audit: {
      same_character_prior_committed_turns_only: true,
      same_turn_history_ignored: true,
      exact_phase81c_capsule_hash_and_lineage_verified: true,
      exact_current_phase74a_deliberation_verified: true,
      action_defining_exact_cue_overlap_required: true,
      fuzzy_semantic_similarity_used: false,
      prior_counterfactual_treated_as_candidate_evidence_only: true,
      prior_counterfactual_treated_as_episodic_fact_memory: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualReflectionReentryProjection(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
  });
}
