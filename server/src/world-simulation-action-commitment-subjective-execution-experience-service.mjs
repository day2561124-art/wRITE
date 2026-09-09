import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationActionCommitmentExecutionFeedbackVersion,
} from "./world-simulation-action-commitment-execution-feedback-service.mjs";

export const worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion =
  "phase75f-action-commitment-subjective-execution-experience-v1";

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

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function safeCharacterExperience(raw) {
  if (!isObject(raw)) return null;
  const performed = typeof raw.performed === "boolean" ? raw.performed : null;
  const perceivedResult = text(raw.perceived_result);
  if (performed === null && !perceivedResult) return null;
  return {
    performed,
    perceived_result: perceivedResult,
  };
}

export function buildWorldSimulationActionCommitmentSubjectiveExecutionExperienceContract() {
  return Object.freeze({
    version: worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
    phase: "Phase75F",
    status: "bounded_subjective_action_execution_experience_mediation_installed",
    authoritative_feedback_source_version:
      worldSimulationActionCommitmentExecutionFeedbackVersion,
    subjective_source: "committed_action_outcome_character_experience",
    authoritative_result_label_not_exposed: true,
    raw_action_outcome_not_exposed: true,
    causal_evidence_not_exposed: true,
    missing_character_experience_never_falls_back_to_world_truth: true,
    same_character_and_action_lineage_required: true,
    character_brain_exposure_supported: true,
    character_brain_may_reason_about_subjective_execution_feedback: true,
    execution_feedback_does_not_auto_revoke_commitment: true,
    execution_feedback_does_not_auto_select_replacement: true,
    goal_achievement_not_inferred: true,
    action_success_or_failure_not_inferred_beyond_perceived_result: true,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function projectWorldSimulationActionCommitmentSubjectiveExecutionExperience(input = {}) {
  const feedbackResult = input.execution_feedback_projection;
  if (!isObject(feedbackResult)
      || feedbackResult.ok !== true
      || feedbackResult.version !== worldSimulationActionCommitmentExecutionFeedbackVersion
      || !isObject(feedbackResult.projection)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_FEEDBACK_INVALID",
      "Phase75F requires a valid Phase75E execution feedback projection.",
    );
  }

  const sessionId = text(feedbackResult.world_simulation_session_id);
  const character = text(feedbackResult.character);
  const actionId = text(feedbackResult.projection.action_id);
  if (!sessionId || !character) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_FEEDBACK_INVALID",
      "Phase75F execution feedback is missing session or character lineage.",
    );
  }

  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== sessionId
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_HISTORY_INVALID",
      "Phase75F requires same-session committed world history.",
    );
  }

  if (feedbackResult.projection.status === "no_active_commitment_to_monitor") {
    const body = {
      character,
      status: "no_active_commitment_to_expose",
      active_commitment_ref: null,
      action_id: null,
      authoritative_feedback_count: 0,
      subjective_feedback_count: 0,
      subjective_feedback: [],
      latest_subjective_feedback: null,
    };
    return Object.freeze(cloneJson({
      ok: true,
      version: worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
      world_simulation_session_id: sessionId,
      character,
      projection: { ...body, projection_hash: hashAgentRunValue(body) },
      information_boundary: {
        authoritative_result_label_exposed: false,
        raw_action_outcome_exposed: false,
        causal_evidence_exposed: false,
        world_truth_fallback_used: false,
      },
    }));
  }

  const subjectiveFeedback = [];
  for (const feedback of array(feedbackResult.projection.feedback)) {
    const sourceTurnId = text(feedback?.source_turn_id);
    const outcomeIndex = feedback?.outcome_index;
    if (!sourceTurnId || !Number.isSafeInteger(outcomeIndex)) continue;
    const turn = history.turns.find((item) => item?.turn_id === sourceTurnId);
    if (!isObject(turn)) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_LINEAGE_MISSING",
        `Phase75F could not resolve committed turn ${sourceTurnId}.`,
      );
    }
    const outcome = array(turn.action_outcomes)[outcomeIndex];
    if (!isObject(outcome)
        || hashAgentRunValue(outcome) !== feedback.outcome_hash
        || characterKey(outcome.actor) !== characterKey(character)
        || text(outcome.action_id) !== actionId) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_LINEAGE_MISMATCH",
        "Phase75F authoritative feedback no longer matches committed causal history.",
      );
    }

    const experience = safeCharacterExperience(outcome.character_experience);
    if (!experience) continue;
    const identity = {
      version: worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
      character,
      active_commitment_ref: feedbackResult.projection.active_commitment_ref,
      action_id: actionId,
      source_feedback_ref: feedback.feedback_ref,
      source_turn_id: sourceTurnId,
      performed: experience.performed,
      perceived_result: experience.perceived_result,
    };
    const experienceHash = hashAgentRunValue(identity);
    subjectiveFeedback.push({
      subjective_feedback_ref: `phase75f_subjective_feedback_${experienceHash.slice(0, 24)}`,
      subjective_feedback_hash: experienceHash,
      ...identity,
      source_is_character_experience_not_world_result: true,
      world_result_label_exposed: false,
      causal_evidence_exposed: false,
    });
  }

  const body = {
    character,
    status: subjectiveFeedback.length
      ? "subjective_execution_feedback_available"
      : feedbackResult.projection.matching_outcome_count > 0
        ? "authoritative_execution_observed_but_not_subjectively_available"
        : "no_matching_authoritative_execution_feedback",
    active_commitment_ref: feedbackResult.projection.active_commitment_ref ?? null,
    action_id: actionId,
    authoritative_feedback_count:
      Number(feedbackResult.projection.matching_outcome_count ?? 0),
    subjective_feedback_count: subjectiveFeedback.length,
    subjective_feedback: subjectiveFeedback,
    latest_subjective_feedback: subjectiveFeedback.length
      ? subjectiveFeedback[subjectiveFeedback.length - 1]
      : null,
  };

  return Object.freeze(cloneJson({
    ok: true,
    version: worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
    world_simulation_session_id: sessionId,
    character,
    projection: { ...body, projection_hash: hashAgentRunValue(body) },
    information_boundary: {
      authoritative_result_label_exposed: false,
      raw_action_outcome_exposed: false,
      causal_evidence_exposed: false,
      world_truth_fallback_used: false,
      same_character_only: true,
      same_action_only: true,
    },
    authority_boundary: {
      character_brain_may_reconsider_from_subjective_feedback: true,
      automatic_commitment_revoke: false,
      automatic_replacement_selection: false,
      goal_achievement_inferred: false,
      world_state_mutated: false,
    },
  }));
}
