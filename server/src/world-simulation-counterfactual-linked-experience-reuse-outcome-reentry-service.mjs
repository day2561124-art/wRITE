import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
  subjectiveActionDeliberationCharacterViewVersion,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-retention-capsule-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion =
  "phase81n-counterfactual-linked-experience-reuse-outcome-reentry-v1";

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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_INPUT_INVALID",
      `Phase81N ${label} is required and must be bounded.`,
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
  if (depth > maximumDepth || value === undefined || value === null) return null;
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
function cueCatalog(candidate, ownerRef) {
  const summary = candidateSummary(candidate);
  return candidateFields
    .filter((field) => Object.hasOwn(summary, field))
    .map((field) => {
      const cueKind = `action_candidate.${field}`;
      const content = cloneJson(summary[field]);
      const contentHash = cueContentHash(cueKind, content);
      return {
        cue_ref: `phase81n_current_cue_${hashAgentRunValue({
          owner_ref: ownerRef,
          cue_kind: cueKind,
          cue_content_hash: contentHash,
        }).slice(0, 24)}`,
        cue_kind: cueKind,
        content,
        cue_content_hash: contentHash,
        action_defining: actionDefiningFields.has(field),
        source_kind: "current_phase74a_action_candidate",
      };
    });
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_PHASE74A_INVALID",
      "Phase81N requires the exact canonical current Phase74A deliberation view.",
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CURRENT_CANDIDATE_INVALID",
        `Phase81N current candidate ${index} must be an object.`,
      );
    }
    const actionId = requiredText(candidate.action_id, `current candidate ${index}.action_id`, 240);
    const option = optionsById.get(actionId);
    if (!option || seen.has(actionId)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CURRENT_CANDIDATE_INVALID",
        "Phase81N current candidates must resolve uniquely to the canonical Phase74A action set.",
      );
    }
    seen.add(actionId);
    const summary = candidateSummary(candidate);
    return {
      action_id: actionId,
      action_ref: option.action_ref,
      candidate_summary: summary,
      cues: cueCatalog(summary, option.action_ref),
    };
  });
}

function retainedSignatureRef(capsule, signature) {
  return `phase81n_retained_cue_${hashAgentRunValue({
    capsule_ref: capsule.capsule_ref,
    retention_role: signature.retention_role,
    cue_kind: signature.cue_kind,
    cue_content_hash: signature.cue_content_hash,
    action_defining: signature.action_defining === true,
  }).slice(0, 24)}`;
}

function buildCandidate({ capsule, retainedProjection, sourceTurn, current }) {
  const retained = array(capsule.current_context_cue_signatures).map((signature) => ({
    retained_cue_ref: retainedSignatureRef(capsule, signature),
    cue_kind: signature.cue_kind,
    cue_content_hash: signature.cue_content_hash,
    action_defining: signature.action_defining === true,
    prior_retention_role: signature.retention_role,
  }));
  const matches = [];
  for (const historical of retained) {
    for (const currentCue of current.cues) {
      if (historical.cue_kind !== currentCue.cue_kind
          || historical.cue_content_hash !== currentCue.cue_content_hash) continue;
      matches.push({
        retained_cue_ref: historical.retained_cue_ref,
        current_cue_ref: currentCue.cue_ref,
        cue_kind: historical.cue_kind,
        cue_content_hash: historical.cue_content_hash,
        prior_retention_role: historical.prior_retention_role,
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
  const unmatchedRetained = retained.filter((cue) => !matchedRetained.has(cue.retained_cue_ref));
  const currentAdditional = current.cues.filter((cue) => !matchedCurrent.has(cue.cue_ref));
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
    current_action_id: current.action_id,
    current_action_ref: current.action_ref,
    source_turn_id: sourceTurn.turn_id,
    source_revision_to: sourceTurn.revision_to,
    source_phase81m_projection_hash: retainedProjection.projection_hash,
    source_phase81m_capsule_ref: capsule.capsule_ref,
    source_phase81m_capsule_hash: capsule.capsule_hash,
    source_phase81l_evidence_ref: capsule.source_phase81l_evidence_ref,
    source_phase81l_evidence_hash: capsule.source_phase81l_evidence_hash,
    source_phase81j_projection_hash: capsule.source_phase81j_projection_hash,
    source_phase81i_projection_hash: capsule.source_phase81i_projection_hash,
    reuse_intent_ref: capsule.reuse_intent_ref,
    reuse_intent_hash: capsule.reuse_intent_hash,
    source_reentry_candidate_ref: capsule.source_reentry_candidate_ref,
    source_reentry_candidate_hash: capsule.source_reentry_candidate_hash,
    retained_reuse_action_id: capsule.current_action_id,
    retained_reuse_action_ref: capsule.current_action_ref,
    handled_context_difference_kinds: cloneJson(capsule.handled_context_difference_kinds),
    prior_linked_case_subjective_experience:
      cloneJson(capsule.prior_linked_case_subjective_experience),
    prior_reuse_action_subjective_experience:
      cloneJson(capsule.current_selected_action_subjective_experience),
    exact_current_cue_matches: matches,
    unmatched_retained_context_signatures: cloneJson(unmatchedRetained),
    current_additional_candidate_cues: cloneJson(currentAdditional),
    source_monitoring: {
      historical_counterfactual_source: "imagined_decision_time_possibility",
      prior_linked_case_outcome_source: "prior_experienced_subjective_outcome",
      prior_reuse_intent_source: "prior_subjective_deliberative_reuse_intent",
      prior_reuse_selection_source: "prior_actual_selected_action_lineage",
      prior_reuse_outcome_source: "prior_reuse_experienced_subjective_outcome",
      reentry_source: "prior_committed_phase81m_reuse_outcome_capsule",
      sources_may_not_be_collapsed: true,
    },
  };
  const candidateHash = hashAgentRunValue(identity);
  return {
    reentry_candidate_ref: `phase81n_reentry_${candidateHash.slice(0, 24)}`,
    reentry_candidate_hash: candidateHash,
    ...identity,
    exact_current_cue_match_count: matches.length,
    action_defining_exact_match_present: true,
    unmatched_retained_context_signature_count: unmatchedRetained.length,
    current_additional_candidate_cue_count: currentAdditional.length,
    current_context_difference_present:
      unmatchedRetained.length > 0 || currentAdditional.length > 0,
    prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
    prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
    prior_linked_case_subjective_outcome_is_current_world_truth: false,
    prior_reuse_subjective_outcome_is_current_world_truth: false,
    prior_outcomes_compared_for_effectiveness: false,
    repeated_reuse_counts_as_effectiveness_evidence: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_prior_outcomes: false,
    reuse_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
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

function canonicalHistoricalCandidateSource(candidate, projection, expected) {
  if (!Object.hasOwn(expected, "world_history")) return;
  const history = cloneJson(expected.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== projection.world_simulation_session_id
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_HISTORY_INVALID",
      "Phase81N canonical source verification requires same-session World Simulation history.",
    );
  }
  const sourceTurns = history.turns.filter((turn) =>
    isObject(turn)
      && turn.turn_id === candidate.source_turn_id
      && turn.turn_id !== projection.current_turn_id
      && turn.revision_to === candidate.source_revision_to
      && Number.isSafeInteger(turn.revision_from)
      && turn.revision_from >= 0
      && turn.revision_to <= projection.current_state_revision);
  if (sourceTurns.length !== 1) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
      "Phase81N candidate must resolve to exactly one prior committed source turn.",
    );
  }
  const sourceTurn = sourceTurns[0];
  const retained = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    sourceTurn.counterfactual_linked_experience_reuse_outcome_retention,
    {
      world_simulation_session_id: projection.world_simulation_session_id,
      turn_id: sourceTurn.turn_id,
      state_revision: sourceTurn.revision_from,
      world_state_hash: sourceTurn.previous_state_hash,
    },
  );
  if (retained.projection_hash !== candidate.source_phase81m_projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
      "Phase81N candidate Phase81M projection hash does not match canonical committed history.",
    );
  }
  const capsules = retained.capsules.filter((capsule) =>
    capsule?.capsule_ref === candidate.source_phase81m_capsule_ref
      && capsule?.capsule_hash === candidate.source_phase81m_capsule_hash
      && sameCharacter(capsule?.character, projection.character));
  if (capsules.length !== 1) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
      "Phase81N candidate must resolve to exactly one canonical same-character Phase81M capsule.",
    );
  }
  const capsule = capsules[0];
  const canonicalSource = {
    source_phase81l_evidence_ref: capsule.source_phase81l_evidence_ref,
    source_phase81l_evidence_hash: capsule.source_phase81l_evidence_hash,
    source_phase81j_projection_hash: capsule.source_phase81j_projection_hash,
    source_phase81i_projection_hash: capsule.source_phase81i_projection_hash,
    reuse_intent_ref: capsule.reuse_intent_ref,
    reuse_intent_hash: capsule.reuse_intent_hash,
    source_reentry_candidate_ref: capsule.source_reentry_candidate_ref,
    source_reentry_candidate_hash: capsule.source_reentry_candidate_hash,
    retained_reuse_action_id: capsule.current_action_id,
    retained_reuse_action_ref: capsule.current_action_ref,
    handled_context_difference_kinds: cloneJson(capsule.handled_context_difference_kinds),
    prior_linked_case_subjective_experience:
      cloneJson(capsule.prior_linked_case_subjective_experience),
    prior_reuse_action_subjective_experience:
      cloneJson(capsule.current_selected_action_subjective_experience),
  };
  const projectedSource = {};
  for (const key of Object.keys(canonicalSource)) projectedSource[key] = cloneJson(candidate[key]);
  if (hashAgentRunValue(projectedSource) !== hashAgentRunValue(canonicalSource)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
      "Phase81N candidate historical content must exactly match the canonical committed Phase81M capsule.",
    );
  }

  const retainedCues = array(capsule.current_context_cue_signatures).map((signature) => ({
    retained_cue_ref: retainedSignatureRef(capsule, signature),
    cue_kind: signature.cue_kind,
    cue_content_hash: signature.cue_content_hash,
    action_defining: signature.action_defining === true,
    prior_retention_role: signature.retention_role,
  }));
  const retainedByRef = new Map(retainedCues.map((cue) => [cue.retained_cue_ref, cue]));
  const matchedRetainedRefs = new Set();
  for (const match of candidate.exact_current_cue_matches) {
    const canonical = retainedByRef.get(match.retained_cue_ref);
    if (!canonical
        || canonical.cue_kind !== match.cue_kind
        || canonical.cue_content_hash !== match.cue_content_hash
        || canonical.prior_retention_role !== match.prior_retention_role
        || canonical.action_defining !== match.action_defining) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
        "Phase81N exact cue match does not resolve to canonical retained Phase81M context evidence.",
      );
    }
    matchedRetainedRefs.add(match.retained_cue_ref);
  }
  const canonicalUnmatched = retainedCues.filter((cue) => !matchedRetainedRefs.has(cue.retained_cue_ref));
  if (hashAgentRunValue(candidate.unmatched_retained_context_signatures)
      !== hashAgentRunValue(canonicalUnmatched)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
      "Phase81N unmatched retained context must be derivable from canonical Phase81M context signatures.",
    );
  }
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryContract() {
  return deepFreeze({
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
    phase: "Phase81N",
    status: "retained_counterfactual_linked_reuse_outcome_cross_turn_reentry_installed",
    source_history_owner: "WorldSimulationHistory",
    source_retention_owner: "Phase81M",
    current_candidate_owner: "Phase74A_existing_world_action_proposer_candidates",
    same_character_prior_committed_turns_only: true,
    same_turn_feedback_allowed: false,
    exact_phase81m_capsule_hash_and_world_turn_lineage_required: true,
    exact_current_phase74a_deliberation_required: true,
    exact_action_defining_cue_overlap_required: true,
    fuzzy_semantic_similarity_modeled: false,
    prior_linked_case_subjective_outcome_is_candidate_evidence_only: true,
    prior_reuse_subjective_outcome_is_candidate_evidence_only: true,
    prior_outcomes_compared_for_effectiveness: false,
    repeated_reuse_counts_as_effectiveness_evidence: false,
    reuse_effectiveness_inferred: false,
    historical_counterfactual_truth_evaluated: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
    automatic_preference_revision_performed: false,
    action_selection_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    direct_world_state_mutation_allowed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    technical_history_window_not_cognitive_weight: true,
    maximum_history_turns_scanned: maximumHistoryTurnsScanned,
    maximum_reentry_candidate_count: maximumReentryCandidateCount,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion
      || projection.phase !== "Phase81N"
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
      || !isObject(projection.audit)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_INVALID",
      "Phase81N reuse-outcome re-entry projection is invalid.",
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_LINEAGE_MISMATCH",
        `Phase81N projection ${key} does not match expected lineage.`,
      );
    }
  }
  const refs = new Set();
  for (const candidate of projection.reentry_candidates) {
    if (!isObject(candidate)
        || !text(candidate.reentry_candidate_ref)
        || !text(candidate.reentry_candidate_hash)
        || !text(candidate.current_action_id)
        || !text(candidate.current_action_ref)
        || !text(candidate.source_turn_id)
        || !Number.isSafeInteger(candidate.source_revision_to)
        || !text(candidate.source_phase81m_projection_hash)
        || !text(candidate.source_phase81m_capsule_ref)
        || !text(candidate.source_phase81m_capsule_hash)
        || !text(candidate.source_phase81l_evidence_ref)
        || !text(candidate.source_phase81l_evidence_hash)
        || !text(candidate.reuse_intent_ref)
        || !text(candidate.reuse_intent_hash)
        || !text(candidate.retained_reuse_action_id)
        || !text(candidate.retained_reuse_action_ref)
        || !isObject(candidate.prior_linked_case_subjective_experience)
        || !isObject(candidate.prior_reuse_action_subjective_experience)
        || !Array.isArray(candidate.exact_current_cue_matches)
        || candidate.exact_current_cue_matches.length === 0
        || candidate.exact_current_cue_match_count !== candidate.exact_current_cue_matches.length
        || candidate.action_defining_exact_match_present !== true
        || !candidate.exact_current_cue_matches.some((match) => match?.action_defining === true)
        || !Array.isArray(candidate.unmatched_retained_context_signatures)
        || candidate.unmatched_retained_context_signature_count
          !== candidate.unmatched_retained_context_signatures.length
        || !Array.isArray(candidate.current_additional_candidate_cues)
        || candidate.current_additional_candidate_cue_count
          !== candidate.current_additional_candidate_cues.length
        || !isObject(candidate.source_monitoring)
        || candidate.source_monitoring.sources_may_not_be_collapsed !== true
        || candidate.prior_linked_case_subjective_outcome_is_candidate_evidence_only !== true
        || candidate.prior_reuse_subjective_outcome_is_candidate_evidence_only !== true
        || candidate.prior_linked_case_subjective_outcome_is_current_world_truth !== false
        || candidate.prior_reuse_subjective_outcome_is_current_world_truth !== false
        || candidate.prior_outcomes_compared_for_effectiveness !== false
        || candidate.repeated_reuse_counts_as_effectiveness_evidence !== false
        || candidate.historical_counterfactual_truth_evaluated !== false
        || candidate.historical_counterfactual_validated_by_prior_outcomes !== false
        || candidate.reuse_effectiveness_inferred !== false
        || candidate.success_failure_interpretation_performed !== false
        || candidate.causal_or_outcome_credit_assigned !== false
        || candidate.automatic_preference_revision_performed !== false
        || candidate.action_selected !== false
        || candidate.belief_revision_performed !== false
        || candidate.semantic_revision_performed !== false
        || candidate.subjective_memory_rewrite_performed !== false
        || candidate.world_state_mutated !== false
        || candidate.resolver_used !== false
        || candidate.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANDIDATE_INVALID",
        "Phase81N re-entry candidate violates its bounded evidence contract.",
      );
    }
    for (const match of candidate.exact_current_cue_matches) {
      if (!isObject(match)
          || !text(match.retained_cue_ref)
          || !text(match.current_cue_ref)
          || !text(match.cue_kind)
          || !text(match.cue_content_hash)
          || typeof match.action_defining !== "boolean"
          || match.exact_kind_and_content_match !== true) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CUE_INVALID",
          "Phase81N re-entry candidate contains an invalid exact cue match.",
        );
      }
    }
    const identity = cloneJson(candidate);
    for (const key of [
      "reentry_candidate_ref", "reentry_candidate_hash", "exact_current_cue_match_count",
      "action_defining_exact_match_present", "unmatched_retained_context_signature_count",
      "current_additional_candidate_cue_count", "current_context_difference_present",
      "prior_linked_case_subjective_outcome_is_candidate_evidence_only",
      "prior_reuse_subjective_outcome_is_candidate_evidence_only",
      "prior_linked_case_subjective_outcome_is_current_world_truth",
      "prior_reuse_subjective_outcome_is_current_world_truth",
      "prior_outcomes_compared_for_effectiveness", "repeated_reuse_counts_as_effectiveness_evidence",
      "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_prior_outcomes", "reuse_effectiveness_inferred",
      "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
      "automatic_preference_revision_performed", "action_selected", "belief_revision_performed",
      "semantic_revision_performed", "subjective_memory_rewrite_performed", "world_state_mutated",
      "resolver_used", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (candidate.reentry_candidate_hash !== expectedHash
        || candidate.reentry_candidate_ref !== `phase81n_reentry_${expectedHash.slice(0, 24)}`
        || refs.has(candidate.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANDIDATE_HASH_MISMATCH",
        "Phase81N re-entry candidate identity verification failed.",
      );
    }
    refs.add(candidate.reentry_candidate_ref);
    canonicalHistoricalCandidateSource(candidate, projection, expected);
  }
  if (projection.audit.same_character_prior_committed_turns_only !== true
      || projection.audit.same_turn_history_ignored !== true
      || projection.audit.exact_phase81m_capsule_hash_and_world_turn_lineage_verified !== true
      || projection.audit.exact_current_phase74a_lineage_verified !== true
      || projection.audit.exact_action_defining_cue_overlap_required !== true
      || projection.audit.fuzzy_semantic_similarity_used !== false
      || projection.audit.prior_linked_case_subjective_outcome_treated_as_candidate_evidence_only !== true
      || projection.audit.prior_reuse_subjective_outcome_treated_as_candidate_evidence_only !== true
      || projection.audit.prior_outcomes_compared_for_effectiveness !== false
      || projection.audit.repeated_reuse_counts_as_effectiveness_evidence !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.reuse_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.automatic_preference_revision_performed !== false
      || projection.audit.action_selection_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.resolver_used !== false
      || projection.audit.world_truth_authority_claimed !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_BOUNDARY_INVALID",
      "Phase81N projection violates its source-monitoring or authority boundary.",
    );
  }
  return deepFreeze(projection);
}

export function projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
    240,
  );
  const character = requiredText(input.character, "character", 240);
  const currentTurnId = requiredText(input.current_turn_id, "current_turn_id", 240);
  if (!Number.isSafeInteger(input.current_state_revision) || input.current_state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_INPUT_INVALID",
      "Phase81N current_state_revision must be a non-negative safe integer.",
    );
  }
  const currentWorldStateHash = requiredText(
    input.current_world_state_hash,
    "current_world_state_hash",
    128,
  );
  const phase74A = verifyCurrentPhase74A(input, character);
  const currents = currentCandidates(input, phase74A);
  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== worldSimulationSessionId
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_HISTORY_INVALID",
      "Phase81N requires canonical same-session World Simulation history.",
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
    const rawRetention = turn.counterfactual_linked_experience_reuse_outcome_retention;
    if (!isObject(rawRetention)) continue;
    const retained = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
      rawRetention,
      {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turn.turn_id,
        state_revision: turn.revision_from,
        world_state_hash: turn.previous_state_hash,
      },
    );
    if (retained.version
        !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_HISTORY_PHASE81M_INVALID",
        "Phase81N historical Phase81M retention projection version mismatch.",
      );
    }
    retainedProjectionCount += 1;
    for (const capsule of retained.capsules) {
      if (!sameCharacter(capsule.character, character)) continue;
      if (capsule.same_turn_reentry_allowed !== false
          || capsule.current_selected_action_subjective_outcome_observed !== true
          || capsule.prior_linked_case_subjective_outcome_is_current_world_truth !== false
          || capsule.prior_and_current_subjective_outcomes_compared_for_effectiveness !== false
          || capsule.reuse_or_advisory_effectiveness_inferred !== false
          || capsule.historical_counterfactual_truth_evaluated !== false
          || capsule.success_failure_interpretation_performed !== false
          || capsule.causal_or_outcome_credit_assigned !== false
          || capsule.preference_revision_performed !== false
          || capsule.belief_revision_performed !== false
          || capsule.semantic_revision_performed !== false
          || capsule.subjective_memory_rewrite_performed !== false
          || capsule.world_state_mutated !== false
          || capsule.world_truth_authority !== false) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CAPSULE_BOUNDARY_INVALID",
          "Phase81N rejects historical Phase81M capsules that violate their sealed authority boundary.",
        );
      }
      sameCharacterCapsuleCount += 1;
      for (const current of currents) {
        const candidate = buildCandidate({
          capsule,
          retainedProjection: retained,
          sourceTurn: turn,
          current,
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
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
    phase: "Phase81N",
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
      exact_phase81m_capsule_hash_and_world_turn_lineage_verified: true,
      exact_current_phase74a_lineage_verified: true,
      exact_action_defining_cue_overlap_required: true,
      fuzzy_semantic_similarity_used: false,
      prior_linked_case_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_reuse_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_outcomes_compared_for_effectiveness: false,
      repeated_reuse_counts_as_effectiveness_evidence: false,
      historical_counterfactual_truth_evaluated: false,
      reuse_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      automatic_preference_revision_performed: false,
      action_selection_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      world_state_mutated: false,
      resolver_used: false,
      world_truth_authority_claimed: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      character,
      current_turn_id: currentTurnId,
      current_state_revision: input.current_state_revision,
      current_world_state_hash: currentWorldStateHash,
    },
  );
}
