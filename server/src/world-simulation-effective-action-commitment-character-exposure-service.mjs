import {
  worldSimulationEffectiveActionCommitmentProjectionVersion,
} from "./world-simulation-effective-action-commitment-projection-service.mjs";

export const worldSimulationEffectiveActionCommitmentCharacterExposureVersion =
  "phase75b-effective-action-commitment-character-exposure-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function buildWorldSimulationEffectiveActionCommitmentCharacterExposureContract() {
  return Object.freeze({
    version: worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
    phase: "Phase75B",
    status: "bounded_effective_action_commitment_character_exposure_installed",
    source_projection_version: worldSimulationEffectiveActionCommitmentProjectionVersion,
    same_character_only: true,
    current_action_separate_from_prior_committed_intention: true,
    active_prior_intention_may_ground_deliberation: true,
    commitment_is_defeasible_not_absolute: true,
    prior_commitment_does_not_auto_select_action: true,
    prior_commitment_does_not_auto_reject_alternatives: true,
    explicit_reject_all_clear_state_may_be_exposed: true,
    receipt_id_exposed: false,
    receipt_hash_exposed: false,
    world_revision_exposed: false,
    world_state_hash_exposed: false,
    world_history_exposed: false,
    other_character_commitment_exposed: false,
    causal_outcome_exposed: false,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function buildWorldSimulationEffectiveActionCommitmentCharacterExposure(
  projectionResult = {},
) {
  if (!isObject(projectionResult)
      || projectionResult.ok !== true
      || projectionResult.version !== worldSimulationEffectiveActionCommitmentProjectionVersion
      || !isObject(projectionResult.projection)) {
    fail(
      "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_SOURCE_INVALID",
      "Phase75B requires a valid Phase75A effective action commitment projection.",
    );
  }

  const character = optionalString(projectionResult.character);
  if (!character) {
    fail(
      "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_CHARACTER_INVALID",
      "Phase75B requires a character-bound Phase75A projection.",
    );
  }

  const projection = projectionResult.projection;
  const active = projection.has_active_commitment === true
    ? projection.current_commitment
    : null;
  if (active !== null && !isObject(active)) {
    fail(
      "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_COMMITMENT_INVALID",
      "Phase75B active commitment source is invalid.",
    );
  }

  const boundedCommitment = active
    ? {
        commitment_ref: optionalString(active.commitment_ref),
        selection_kind: "candidate_action_intent",
        action_id: optionalString(active.action_id),
        action_ref: optionalString(active.action_ref),
        prospect_ref: optionalString(active.prospect_ref),
        option_ref: optionalString(active.option_ref),
        persistence_state: "active_prior_committed_intention",
        defeasible: true,
        action_attempted_or_completed: false,
        outcome_known_from_commitment: false,
      }
    : null;

  if (boundedCommitment
      && (!boundedCommitment.commitment_ref || !boundedCommitment.action_id)) {
    fail(
      "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_COMMITMENT_INVALID",
      "Phase75B active commitment is missing bounded identity fields.",
    );
  }

  return Object.freeze(cloneJson({
    version: worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
    character,
    status: boundedCommitment
      ? "active_prior_committed_intention_available"
      : "no_active_prior_committed_intention",
    active_commitment: boundedCommitment,
    has_active_commitment: Boolean(boundedCommitment),
    explicit_reject_all_cleared_prior_commitment:
      projection.explicit_reject_all_cleared_commitment === true,
    deliberation_boundary: {
      commitment_is_context_not_command: true,
      commitment_may_constrain_but_not_determine_choice: true,
      reconsideration_allowed: true,
      alternatives_remain_open_unless_current_deliberation_rejects_them: true,
      current_action_is_distinct_from_prior_committed_intention: true,
      action_outcome_not_asserted: true,
    },
    information_boundary: {
      same_character_only: true,
      receipt_id_exposed: false,
      receipt_hash_exposed: false,
      source_turn_id_exposed: false,
      world_revision_exposed: false,
      world_state_hash_exposed: false,
      world_history_exposed: false,
      other_character_commitment_exposed: false,
      causal_outcome_exposed: false,
      world_truth_authority_claimed: false,
    },
  }));
}
