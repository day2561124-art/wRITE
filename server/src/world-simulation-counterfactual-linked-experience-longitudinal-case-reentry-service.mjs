import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-reentry-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-appraisal-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-reuse-outcome-revise-retain-admission-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion =
  "phase82e-counterfactual-linked-experience-longitudinal-case-reentry-v1";

const maximumHistoryTurnsScanned = 64;
const maximumReentryCandidateCount = 32;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_INPUT_INVALID",
      `Phase82E ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function sameCharacter(left, right) {
  return requiredText(left, "character", 240).toLocaleLowerCase("zh-Hant-TW")
    === requiredText(right, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}

function appraisalIdentity(appraisal) {
  return {
    version: appraisal.version,
    world_simulation_session_id: appraisal.world_simulation_session_id,
    turn_id: appraisal.turn_id,
    state_revision: appraisal.state_revision,
    world_state_hash: appraisal.world_state_hash,
    character: appraisal.character,
    source_phase82b_projection_hash: appraisal.source_phase82b_projection_hash,
    source_phase82b_context_ref: appraisal.source_phase82b_context_ref,
    source_phase82b_context_hash: appraisal.source_phase82b_context_hash,
    source_phase82a_context_ref: appraisal.source_phase82a_context_ref,
    source_phase81m_capsule_ref: appraisal.source_phase81m_capsule_ref,
    reuse_intent_ref: appraisal.reuse_intent_ref,
    appraisal_kind: appraisal.appraisal_kind,
    learning_orientation: appraisal.learning_orientation,
    salient_comparison_refs: cloneJson(array(appraisal.salient_comparison_refs)),
  };
}

function admissionIdentity(admission) {
  return {
    version: admission.version,
    world_simulation_session_id: admission.world_simulation_session_id,
    turn_id: admission.turn_id,
    state_revision: admission.state_revision,
    world_state_hash: admission.world_state_hash,
    character: admission.character,
    source_phase82c_projection_hash: admission.source_phase82c_projection_hash,
    source_phase82c_appraisal_ref: admission.source_phase82c_appraisal_ref,
    source_phase82c_appraisal_hash: admission.source_phase82c_appraisal_hash,
    source_phase82b_context_ref: admission.source_phase82b_context_ref,
    source_phase82a_context_ref: admission.source_phase82a_context_ref,
    source_phase81m_capsule_ref: admission.source_phase81m_capsule_ref,
    reuse_intent_ref: admission.reuse_intent_ref,
    appraisal_kind: admission.appraisal_kind,
    learning_orientation: admission.learning_orientation,
    salient_comparison_refs: cloneJson(array(admission.salient_comparison_refs)),
    admission_decision: admission.admission_decision,
  };
}

function assertCanonicalSourceAppraisal(sourceTurn, admission, sessionId) {
  const projection = cloneJson(
    sourceTurn.counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal,
  );
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeAppraisalVersion
      || projection.phase !== "Phase82C"
      || projection.world_simulation_session_id !== sessionId
      || projection.turn_id !== sourceTurn.turn_id
      || projection.state_revision !== sourceTurn.revision_from
      || projection.world_state_hash !== sourceTurn.previous_state_hash
      || !Array.isArray(projection.appraisals)
      || projection.appraisal_count !== projection.appraisals.length
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash
      || projection.projection_hash !== admission.source_phase82c_projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_APPRAISAL_INVALID",
      "Phase82E retained admission must resolve to the exact persisted Phase82C appraisal projection in its source turn.",
    );
  }
  const matches = projection.appraisals.filter((appraisal) =>
    isObject(appraisal)
      && appraisal.appraisal_ref === admission.source_phase82c_appraisal_ref
      && appraisal.appraisal_hash === admission.source_phase82c_appraisal_hash);
  if (matches.length !== 1) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_APPRAISAL_MISMATCH",
      "Phase82E retained admission must resolve to exactly one persisted Phase82C source appraisal.",
    );
  }
  const appraisal = matches[0];
  const computedHash = hashAgentRunValue(appraisalIdentity(appraisal));
  if (computedHash !== appraisal.appraisal_hash
      || `phase82c_appraisal_${computedHash.slice(0, 24)}` !== appraisal.appraisal_ref
      || !sameCharacter(appraisal.character, admission.character)
      || appraisal.source_phase82b_context_ref !== admission.source_phase82b_context_ref
      || appraisal.source_phase82a_context_ref !== admission.source_phase82a_context_ref
      || appraisal.source_phase81m_capsule_ref !== admission.source_phase81m_capsule_ref
      || appraisal.reuse_intent_ref !== admission.reuse_intent_ref
      || appraisal.appraisal_kind !== admission.appraisal_kind
      || appraisal.learning_orientation !== admission.learning_orientation
      || hashAgentRunValue(array(appraisal.salient_comparison_refs))
        !== hashAgentRunValue(array(admission.salient_comparison_refs))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_APPRAISAL_MISMATCH",
      "Phase82E retained admission lineage must exactly match its persisted Phase82C appraisal.",
    );
  }
  return appraisal;
}

function retainedAdmissionsFromTurn(sourceTurn, sessionId) {
  const projection = cloneJson(
    sourceTurn.counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission,
  );
  if (projection === null) return [];
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion
      || projection.phase !== "Phase82D"
      || projection.world_simulation_session_id !== sessionId
      || projection.turn_id !== sourceTurn.turn_id
      || projection.state_revision !== sourceTurn.revision_from
      || projection.world_state_hash !== sourceTurn.previous_state_hash
      || !Array.isArray(projection.admissions)
      || projection.admission_count !== projection.admissions.length
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_ADMISSION_INVALID",
      "Phase82E historical source must contain an exact persisted Phase82D admission projection.",
    );
  }

  const retained = [];
  for (const admission of projection.admissions) {
    if (!isObject(admission)
        || admission.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeReviseRetainAdmissionVersion
        || admission.world_simulation_session_id !== sessionId
        || admission.turn_id !== sourceTurn.turn_id
        || admission.state_revision !== sourceTurn.revision_from
        || admission.world_state_hash !== sourceTurn.previous_state_hash
        || !text(admission.admission_ref)
        || !text(admission.admission_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_ADMISSION_INVALID",
        "Phase82E historical Phase82D admission record is invalid.",
      );
    }
    const computedHash = hashAgentRunValue(admissionIdentity(admission));
    if (computedHash !== admission.admission_hash
        || `phase82d_admission_${computedHash.slice(0, 24)}` !== admission.admission_ref) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_ADMISSION_MISMATCH",
        "Phase82E historical Phase82D admission identity/hash mismatch.",
      );
    }
    if (admission.admission_decision !== "retain_longitudinal_case_evidence") continue;
    if (admission.admitted_for_future_longitudinal_case_reentry !== true
        || admission.discriminating_context_evidence_requested !== false
        || admission.revise_retain_deferred !== false
        || admission.numeric_effectiveness_or_success_rate_assigned !== false
        || admission.probability_confidence_utility_reward_q_value_assigned !== false
        || admission.causal_or_outcome_credit_assigned !== false
        || admission.rule_or_preference_revision_performed !== false
        || admission.belief_revision_performed !== false
        || admission.semantic_revision_performed !== false
        || admission.ordinary_subjective_memory_rewrite_performed !== false
        || admission.world_state_mutated !== false
        || admission.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_SOURCE_ADMISSION_AUTHORITY_INVALID",
        "Phase82E may re-enter only bounded Phase82D retain admissions with no extra authority.",
      );
    }
    assertCanonicalSourceAppraisal(sourceTurn, admission, sessionId);
    retained.push({ projection, admission });
  }
  return retained;
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
    phase: "Phase82E",
    status: "retained_longitudinal_case_cross_turn_reentry_installed",
    source_history_owner: "WorldSimulationHistory",
    source_admission_owner: "Phase82D",
    current_relevance_owner: "Phase81N",
    prior_committed_turns_only: true,
    same_turn_feedback_allowed: false,
    retain_admission_required: true,
    exact_phase82d_admission_hash_required: true,
    exact_phase82c_source_appraisal_lineage_required: true,
    exact_current_phase81n_projection_required: true,
    exact_same_phase81m_capsule_and_reuse_intent_required: true,
    fuzzy_similarity_modeled: false,
    reentry_is_candidate_evidence_only: true,
    retained_admission_is_not_effectiveness_claim: true,
    action_selection_performed: false,
    numeric_effectiveness_success_probability_utility_reward_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    rule_or_preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    ordinary_subjective_memory_rewrite_performed: false,
    world_state_mutation_allowed: false,
    world_truth_authority_claimed: false,
    technical_history_window_not_cognitive_weight: true,
    maximum_history_turns_scanned: maximumHistoryTurnsScanned,
    maximum_reentry_candidate_count: maximumReentryCandidateCount,
    downstream_deliberative_use_requires_separate_phase: true,
  });
}

export function projectWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentry(input = {}) {
  const sessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id");
  const currentTurnId = requiredText(input.current_turn_id, "current_turn_id");
  const currentWorldStateHash = requiredText(input.current_world_state_hash, "current_world_state_hash", 128);
  const currentStateRevision = input.current_state_revision;
  if (!Number.isSafeInteger(currentStateRevision) || currentStateRevision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_INPUT_INVALID",
      "Phase82E current_state_revision must be a non-negative safe integer.",
    );
  }
  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== sessionId
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_HISTORY_INVALID",
      "Phase82E requires same-session canonical World Simulation history.",
    );
  }

  const currentPhase81N = array(
    input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
  ).map((raw) => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    raw,
    {
      world_simulation_session_id: sessionId,
      current_turn_id: currentTurnId,
      current_state_revision: currentStateRevision,
      current_world_state_hash: currentWorldStateHash,
      world_history: history,
    },
  ));
  const seenCharacters = new Set();
  for (const projection of currentPhase81N) {
    if (projection.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_PHASE81N_INVALID",
        "Phase82E requires canonical current Phase81N projections.",
      );
    }
    const key = projection.character.toLocaleLowerCase("zh-Hant-TW");
    if (seenCharacters.has(key)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_PHASE81N_DUPLICATE",
        "Phase82E accepts at most one current Phase81N projection per character.",
      );
    }
    seenCharacters.add(key);
  }

  const eligibleTurns = history.turns
    .filter((turn) => isObject(turn)
      && turn.turn_id !== currentTurnId
      && Number.isSafeInteger(turn.revision_from)
      && Number.isSafeInteger(turn.revision_to)
      && turn.revision_from >= 0
      && turn.revision_to > turn.revision_from
      && turn.revision_to <= currentStateRevision
      && text(turn.previous_state_hash))
    .sort((left, right) => left.revision_to - right.revision_to || compareText(left.turn_id, right.turn_id));
  const historyWindow = eligibleTurns.slice(-maximumHistoryTurnsScanned);

  const retainedSources = [];
  for (const sourceTurn of historyWindow) {
    for (const source of retainedAdmissionsFromTurn(sourceTurn, sessionId)) {
      retainedSources.push({ sourceTurn, ...source });
    }
  }

  const reentryCandidates = [];
  for (const currentProjection of currentPhase81N) {
    for (const currentCandidate of array(currentProjection.reentry_candidates)) {
      for (const source of retainedSources) {
        const admission = source.admission;
        if (!sameCharacter(admission.character, currentProjection.character)
            || admission.source_phase81m_capsule_ref !== currentCandidate.source_phase81m_capsule_ref
            || admission.reuse_intent_ref !== currentCandidate.reuse_intent_ref) continue;
        const identity = {
          version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
          world_simulation_session_id: sessionId,
          current_turn_id: currentTurnId,
          current_state_revision: currentStateRevision,
          current_world_state_hash: currentWorldStateHash,
          character: currentProjection.character,
          source_turn_id: source.sourceTurn.turn_id,
          source_revision_to: source.sourceTurn.revision_to,
          source_phase82d_projection_hash: source.projection.projection_hash,
          source_phase82d_admission_ref: admission.admission_ref,
          source_phase82d_admission_hash: admission.admission_hash,
          source_phase82c_projection_hash: admission.source_phase82c_projection_hash,
          source_phase82c_appraisal_ref: admission.source_phase82c_appraisal_ref,
          source_phase82c_appraisal_hash: admission.source_phase82c_appraisal_hash,
          source_phase82b_context_ref: admission.source_phase82b_context_ref,
          source_phase82a_context_ref: admission.source_phase82a_context_ref,
          source_phase81m_capsule_ref: admission.source_phase81m_capsule_ref,
          reuse_intent_ref: admission.reuse_intent_ref,
          current_phase81n_projection_hash: currentProjection.projection_hash,
          current_phase81n_reentry_candidate_ref: currentCandidate.reentry_candidate_ref,
          current_phase81n_reentry_candidate_hash: currentCandidate.reentry_candidate_hash,
          current_action_id: currentCandidate.current_action_id,
          current_action_ref: currentCandidate.current_action_ref,
        };
        const candidateHash = hashAgentRunValue(identity);
        reentryCandidates.push({
          reentry_candidate_ref: `phase82e_longitudinal_case_reentry_${candidateHash.slice(0, 24)}`,
          reentry_candidate_hash: candidateHash,
          ...identity,
          exact_same_phase81m_capsule_ref: true,
          exact_same_reuse_intent_ref: true,
          current_phase81n_exact_cue_relevance_required: true,
          retained_longitudinal_case_is_candidate_evidence_only: true,
          retained_admission_is_effectiveness_claim: false,
          retained_admission_is_success_claim: false,
          current_context_difference_present: currentCandidate.current_context_difference_present === true,
          exact_current_cue_match_count: currentCandidate.exact_current_cue_match_count,
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
          source_monitoring: {
            retained_case_source: "prior_committed_phase82d_retain_admission",
            retained_appraisal_source: "prior_committed_phase82c_subjective_appraisal",
            current_relevance_source: "current_canonical_phase81n_exact_cue_reentry",
            sources_may_not_be_collapsed: true,
          },
        });
      }
    }
  }
  reentryCandidates.sort((left, right) => compareText(left.reentry_candidate_ref, right.reentry_candidate_ref));
  if (reentryCandidates.length > maximumReentryCandidateCount) {
    reentryCandidates.length = maximumReentryCandidateCount;
  }

  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion,
    phase: "Phase82E",
    world_simulation_session_id: sessionId,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    history_window: {
      eligible_prior_turn_count: eligibleTurns.length,
      scanned_prior_turn_count: historyWindow.length,
      maximum_history_turns_scanned: maximumHistoryTurnsScanned,
      technical_window_is_not_cognitive_weight: true,
    },
    current_phase81n_projection_count: currentPhase81N.length,
    retained_phase82d_admission_count_scanned: retainedSources.length,
    reentry_candidate_count: reentryCandidates.length,
    reentry_candidates: reentryCandidates,
    audit: {
      prior_committed_turns_only: true,
      same_turn_feedback_performed: false,
      exact_phase82d_admission_identity_verified: true,
      exact_phase82c_source_appraisal_lineage_verified: true,
      exact_current_phase81n_lineage_verified: true,
      exact_same_phase81m_capsule_and_reuse_intent_required: true,
      fuzzy_similarity_used: false,
      retained_admission_interpreted_as_effectiveness: false,
      retained_admission_interpreted_as_success: false,
      action_selection_performed: false,
      numeric_effectiveness_success_probability_utility_reward_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      rule_or_preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      ordinary_subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_reentry: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      downstream_deliberative_use_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
    projection,
    {
      world_simulation_session_id: sessionId,
      current_turn_id: currentTurnId,
      current_state_revision: currentStateRevision,
      current_world_state_hash: currentWorldStateHash,
      world_history: history,
      counterfactual_linked_experience_reuse_outcome_reentry_projections:
        currentPhase81N,
    },
  );
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryVersion
      || projection.phase !== "Phase82E"
      || !text(projection.world_simulation_session_id)
      || !text(projection.current_turn_id)
      || !Number.isSafeInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !text(projection.current_world_state_hash)
      || !isObject(projection.history_window)
      || !Array.isArray(projection.reentry_candidates)
      || projection.reentry_candidate_count !== projection.reentry_candidates.length
      || projection.reentry_candidate_count > maximumReentryCandidateCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_INVALID",
      "Phase82E longitudinal case re-entry projection is invalid.",
    );
  }
  for (const key of [
    "world_simulation_session_id",
    "current_turn_id",
    "current_state_revision",
    "current_world_state_hash",
  ]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_LINEAGE_MISMATCH",
        `Phase82E projection ${key} does not match expected lineage.`,
      );
    }
  }
  const refs = new Set();
  for (const candidate of projection.reentry_candidates) {
    if (!isObject(candidate)
        || !text(candidate.reentry_candidate_ref)
        || !text(candidate.reentry_candidate_hash)
        || !text(candidate.character)
        || !text(candidate.source_turn_id)
        || !Number.isSafeInteger(candidate.source_revision_to)
        || !text(candidate.source_phase82d_projection_hash)
        || !text(candidate.source_phase82d_admission_ref)
        || !text(candidate.source_phase82d_admission_hash)
        || !text(candidate.source_phase82c_projection_hash)
        || !text(candidate.source_phase82c_appraisal_ref)
        || !text(candidate.source_phase82c_appraisal_hash)
        || !text(candidate.source_phase82b_context_ref)
        || !text(candidate.source_phase82a_context_ref)
        || !text(candidate.source_phase81m_capsule_ref)
        || !text(candidate.reuse_intent_ref)
        || !text(candidate.current_phase81n_projection_hash)
        || !text(candidate.current_phase81n_reentry_candidate_ref)
        || !text(candidate.current_phase81n_reentry_candidate_hash)
        || !text(candidate.current_action_id)
        || !text(candidate.current_action_ref)
        || candidate.exact_same_phase81m_capsule_ref !== true
        || candidate.exact_same_reuse_intent_ref !== true
        || candidate.current_phase81n_exact_cue_relevance_required !== true
        || candidate.retained_longitudinal_case_is_candidate_evidence_only !== true
        || candidate.retained_admission_is_effectiveness_claim !== false
        || candidate.retained_admission_is_success_claim !== false
        || candidate.action_selected !== false
        || candidate.numeric_effectiveness_or_success_rate_assigned !== false
        || candidate.probability_confidence_utility_reward_q_value_assigned !== false
        || candidate.causal_or_outcome_credit_assigned !== false
        || candidate.rule_or_preference_revision_performed !== false
        || candidate.belief_revision_performed !== false
        || candidate.semantic_revision_performed !== false
        || candidate.ordinary_subjective_memory_rewrite_performed !== false
        || candidate.world_state_mutated !== false
        || candidate.world_truth_authority !== false
        || !isObject(candidate.source_monitoring)
        || candidate.source_monitoring.sources_may_not_be_collapsed !== true) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CANDIDATE_INVALID",
        "Phase82E re-entry candidate is invalid or exceeds its evidence-only authority boundary.",
      );
    }
    const identity = {
      version: candidate.version,
      world_simulation_session_id: candidate.world_simulation_session_id,
      current_turn_id: candidate.current_turn_id,
      current_state_revision: candidate.current_state_revision,
      current_world_state_hash: candidate.current_world_state_hash,
      character: candidate.character,
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
      current_action_id: candidate.current_action_id,
      current_action_ref: candidate.current_action_ref,
    };
    const computedHash = hashAgentRunValue(identity);
    if (candidate.reentry_candidate_hash !== computedHash
        || candidate.reentry_candidate_ref !== `phase82e_longitudinal_case_reentry_${computedHash.slice(0, 24)}`
        || refs.has(candidate.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CANDIDATE_HASH_INVALID",
        "Phase82E re-entry candidate identity/hash is invalid or duplicated.",
      );
    }
    refs.add(candidate.reentry_candidate_ref);
  }

  if (Object.hasOwn(expected, "counterfactual_linked_experience_reuse_outcome_reentry_projections")) {
    const expectedCurrent = array(
      expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    ).map((raw) => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
      raw,
      {
        world_simulation_session_id: projection.world_simulation_session_id,
        current_turn_id: projection.current_turn_id,
        current_state_revision: projection.current_state_revision,
        current_world_state_hash: projection.current_world_state_hash,
        ...(Object.hasOwn(expected, "world_history")
          ? { world_history: expected.world_history }
          : {}),
      },
    ));
    const expectedByHash = new Map(expectedCurrent.map((item) => [item.projection_hash, item]));
    for (const candidate of projection.reentry_candidates) {
      const currentProjection = expectedByHash.get(candidate.current_phase81n_projection_hash);
      if (!currentProjection || !sameCharacter(currentProjection.character, candidate.character)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CURRENT_SOURCE_MISMATCH",
          "Phase82E candidate must resolve to the exact same-character current Phase81N projection.",
        );
      }
      const currentMatches = array(currentProjection.reentry_candidates).filter((currentCandidate) =>
        currentCandidate?.reentry_candidate_ref === candidate.current_phase81n_reentry_candidate_ref
          && currentCandidate?.reentry_candidate_hash === candidate.current_phase81n_reentry_candidate_hash);
      if (currentMatches.length !== 1) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CURRENT_SOURCE_MISMATCH",
          "Phase82E candidate must resolve to exactly one canonical current Phase81N re-entry candidate.",
        );
      }
      const currentCandidate = currentMatches[0];
      if (currentCandidate.source_phase81m_capsule_ref !== candidate.source_phase81m_capsule_ref
          || currentCandidate.reuse_intent_ref !== candidate.reuse_intent_ref
          || currentCandidate.current_action_id !== candidate.current_action_id
          || currentCandidate.current_action_ref !== candidate.current_action_ref
          || currentCandidate.action_defining_exact_match_present !== true
          || currentCandidate.exact_current_cue_match_count !== candidate.exact_current_cue_match_count
          || (currentCandidate.current_context_difference_present === true)
            !== candidate.current_context_difference_present) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CURRENT_SOURCE_MISMATCH",
          "Phase82E candidate current relevance must exactly match canonical Phase81N cue-bounded lineage.",
        );
      }
    }
  }

  if (Object.hasOwn(expected, "world_history")) {
    const history = cloneJson(expected.world_history);
    if (!isObject(history)
        || history.world_simulation_session_id !== projection.world_simulation_session_id
        || !Array.isArray(history.turns)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_HISTORY_INVALID",
        "Phase82E canonical source verification requires same-session World Simulation history.",
      );
    }
    for (const candidate of projection.reentry_candidates) {
      const sourceTurns = history.turns.filter((turn) => isObject(turn)
        && turn.turn_id === candidate.source_turn_id
        && turn.turn_id !== projection.current_turn_id
        && turn.revision_to === candidate.source_revision_to
        && turn.revision_to <= projection.current_state_revision);
      if (sourceTurns.length !== 1) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CANONICAL_SOURCE_MISMATCH",
          "Phase82E candidate must resolve to exactly one prior committed source turn.",
        );
      }
      const sources = retainedAdmissionsFromTurn(sourceTurns[0], projection.world_simulation_session_id)
        .filter((source) => source.admission.admission_ref === candidate.source_phase82d_admission_ref
          && source.admission.admission_hash === candidate.source_phase82d_admission_hash);
      if (sources.length !== 1) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CANONICAL_SOURCE_MISMATCH",
          "Phase82E candidate must resolve to exactly one canonical retained Phase82D admission.",
        );
      }
      const admission = sources[0].admission;
      if (admission.source_phase81m_capsule_ref !== candidate.source_phase81m_capsule_ref
          || admission.reuse_intent_ref !== candidate.reuse_intent_ref
          || admission.source_phase82c_projection_hash !== candidate.source_phase82c_projection_hash
          || admission.source_phase82c_appraisal_ref !== candidate.source_phase82c_appraisal_ref
          || admission.source_phase82c_appraisal_hash !== candidate.source_phase82c_appraisal_hash) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_REENTRY_CANONICAL_SOURCE_MISMATCH",
          "Phase82E candidate historical lineage does not match its canonical retained Phase82D admission.",
        );
      }
    }
  }
  return Object.freeze(projection);
}
