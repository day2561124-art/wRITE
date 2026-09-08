import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationEffectiveActionCommitmentProjectionVersion } from "./world-simulation-effective-action-commitment-projection-service.mjs";

export const worldSimulationActionCommitmentExecutionFeedbackVersion =
  "phase75e-action-commitment-execution-feedback-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
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

function validateHistory(history, sessionId) {
  if (!isObject(history) || history.world_simulation_session_id !== sessionId || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_HISTORY_INVALID",
      "Phase75E requires same-session committed world history.",
    );
  }
  let previous = null;
  for (const [index, turn] of history.turns.entries()) {
    if (!isObject(turn)
        || !optionalString(turn.turn_id)
        || !Number.isSafeInteger(turn.revision_from)
        || !Number.isSafeInteger(turn.revision_to)
        || turn.revision_to !== turn.revision_from + 1
        || !optionalString(turn.previous_state_hash)
        || !optionalString(turn.next_state_hash)) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_HISTORY_TURN_INVALID",
        `world_history.turns[${index}] has invalid commit lineage.`,
      );
    }
    if (previous
        && (turn.revision_from !== previous.revision_to
          || turn.previous_state_hash !== previous.next_state_hash)) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_HISTORY_CHAIN_MISMATCH",
        `Committed turn ${turn.turn_id} breaks world-history chronology.`,
      );
    }
    previous = turn;
  }
}

export function buildWorldSimulationActionCommitmentExecutionFeedbackContract() {
  return Object.freeze({
    version: worldSimulationActionCommitmentExecutionFeedbackVersion,
    phase: "Phase75E",
    status: "authoritative_action_commitment_execution_feedback_projection_installed",
    source_of_truth: "committed_world_history_action_outcomes",
    effective_commitment_source_version: worldSimulationEffectiveActionCommitmentProjectionVersion,
    engine_side_read_model_only: true,
    matching_requires_same_character_and_action_id: true,
    feedback_window_starts_at_effective_commitment_source_revision: true,
    raw_causal_evidence_exposed_to_character: false,
    raw_action_outcome_payload_exposed_to_character: false,
    character_exposure_installed: false,
    result_label_interpreted_as_success_or_failure: false,
    completion_or_failure_inferred: false,
    action_outcome_authority_preserved: true,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function projectWorldSimulationActionCommitmentExecutionFeedback(input = {}) {
  const projectionResult = input.effective_action_commitment_projection;
  if (!isObject(projectionResult)
      || projectionResult.ok !== true
      || projectionResult.version !== worldSimulationEffectiveActionCommitmentProjectionVersion
      || !isObject(projectionResult.projection)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_COMMITMENT_INVALID",
      "Phase75E requires a valid Phase75A effective action commitment projection.",
    );
  }

  const sessionId = optionalString(projectionResult.world_simulation_session_id);
  const character = optionalString(projectionResult.character);
  if (!sessionId || !character) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_COMMITMENT_INVALID",
      "Phase75E commitment projection is missing session or character lineage.",
    );
  }

  const history = cloneJson(input.world_history);
  const inputHash = hashAgentRunValue(history);
  validateHistory(history, sessionId);

  const active = projectionResult.projection.has_active_commitment === true
    ? projectionResult.projection.current_commitment
    : null;
  if (active === null) {
    const body = {
      character,
      status: "no_active_commitment_to_monitor",
      active_commitment_ref: null,
      action_id: null,
      matching_outcome_count: 0,
      attempt_observed: false,
      latest_feedback: null,
      feedback: [],
    };
    return Object.freeze(cloneJson({
      ok: true,
      version: worldSimulationActionCommitmentExecutionFeedbackVersion,
      world_simulation_session_id: sessionId,
      character,
      projection: { ...body, projection_hash: hashAgentRunValue(body) },
      audit: {
        committed_world_history_read_only: true,
        raw_causal_payload_exposed_to_character: false,
        result_semantics_interpreted: false,
        completion_or_failure_inferred: false,
        world_state_mutated: false,
      },
    }));
  }

  const commitmentRef = optionalString(active.commitment_ref);
  const actionId = optionalString(active.action_id);
  if (!commitmentRef || !actionId || !Number.isSafeInteger(active.source_revision_from)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_COMMITMENT_INVALID",
      "Phase75E active commitment is missing bounded execution lineage.",
    );
  }

  const feedback = [];
  for (const turn of history.turns) {
    if (turn.revision_from < active.source_revision_from) continue;
    for (const [outcomeIndex, outcome] of array(turn.action_outcomes).entries()) {
      if (!isObject(outcome)
          || characterKey(outcome.actor) !== characterKey(character)
          || optionalString(outcome.action_id) !== actionId) {
        continue;
      }
      const outcomeHash = hashAgentRunValue(outcome);
      const identity = {
        version: worldSimulationActionCommitmentExecutionFeedbackVersion,
        character,
        active_commitment_ref: commitmentRef,
        action_id: actionId,
        source_turn_id: turn.turn_id,
        source_revision_from: turn.revision_from,
        outcome_index: outcomeIndex,
        outcome_hash: outcomeHash,
        result_label: optionalString(outcome.result),
      };
      const feedbackHash = hashAgentRunValue(identity);
      feedback.push({
        feedback_ref: `phase75e_feedback_${feedbackHash.slice(0, 24)}`,
        feedback_hash: feedbackHash,
        ...identity,
        authoritative_causal_outcome_observed: true,
        result_label_preserved_not_interpreted: true,
        raw_outcome_payload_exposed: false,
        causal_evidence_exposed: false,
      });
    }
  }

  const body = {
    character,
    status: feedback.length
      ? "authoritative_execution_feedback_available"
      : "no_matching_authoritative_action_outcome_observed",
    active_commitment_ref: commitmentRef,
    action_id: actionId,
    source_revision_from: active.source_revision_from,
    matching_outcome_count: feedback.length,
    attempt_observed: feedback.length > 0,
    latest_feedback: feedback.length ? feedback[feedback.length - 1] : null,
    feedback,
  };

  if (hashAgentRunValue(history) !== inputHash) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_INPUT_MUTATED",
      "Phase75E mutated its world-history input.",
    );
  }

  return Object.freeze(cloneJson({
    ok: true,
    version: worldSimulationActionCommitmentExecutionFeedbackVersion,
    world_simulation_session_id: sessionId,
    character,
    projection: { ...body, projection_hash: hashAgentRunValue(body) },
    audit: {
      committed_world_history_read_only: true,
      matching_requires_same_character_and_action_id: true,
      feedback_window_starts_at_effective_commitment_source_revision: true,
      raw_causal_payload_exposed_to_character: false,
      result_semantics_interpreted: false,
      completion_or_failure_inferred: false,
      world_state_mutated: false,
    },
  }));
}
