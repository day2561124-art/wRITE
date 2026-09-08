import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationSubjectiveChoiceCommitmentReceiptVersion } from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";

export const worldSimulationActionCommitmentLifecycleDecisionVersion =
  "phase75d-action-commitment-lifecycle-decision-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function buildWorldSimulationActionCommitmentLifecycleDecisionContract() {
  return Object.freeze({
    version: worldSimulationActionCommitmentLifecycleDecisionVersion,
    phase: "Phase75D",
    status: "durable_action_commitment_lifecycle_decision_projection_installed",
    source_of_truth: "committed_phase74d_choice_receipts",
    lifecycle_decisions: Object.freeze(["adopt", "maintain", "release", "replace", "no_change"]),
    same_action_later_choice_means_maintain: true,
    reject_all_with_active_commitment_means_release: true,
    different_action_later_choice_means_replace: true,
    first_selected_action_means_adopt: true,
    lifecycle_receipts_are_deterministic_rebuildable_derivations: true,
    source_phase74d_receipt_remains_durable_authority: true,
    reconsideration_evidence_does_not_auto_decide_lifecycle: true,
    character_brain_remains_choice_owner: true,
    action_execution_or_success_inferred: false,
    causal_outcome_authority_claimed: false,
    world_truth_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function buildWorldSimulationActionCommitmentLifecycleDecision(input = {}) {
  const receipt = input.current_choice_receipt;
  if (!isObject(receipt)
      || receipt.version !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
      || !text(receipt.receipt_id)
      || !text(receipt.receipt_hash)
      || !text(receipt.character)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_LIFECYCLE_RECEIPT_INVALID",
      "Phase75D requires one canonical Phase74D choice receipt.",
    );
  }

  const prior = isObject(input.prior_active_commitment)
    && input.prior_active_commitment.commitment_status === "active"
    ? input.prior_active_commitment
    : null;
  if (prior && text(prior.character) !== text(receipt.character)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_LIFECYCLE_CHARACTER_MISMATCH",
      "Prior commitment and current choice receipt must belong to the same character.",
    );
  }

  let lifecycleDecision = null;
  let priorCommitmentRef = prior ? text(prior.commitment_ref) : null;
  let replacementActionId = null;

  if (receipt.selection_kind === "reject_all") {
    if (receipt.action_id !== null) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_LIFECYCLE_SELECTION_INVALID",
        "reject_all receipt must not carry action_id.",
      );
    }
    lifecycleDecision = prior ? "release" : "no_change";
  } else if (receipt.selection_kind === "candidate_action_intent") {
    const actionId = text(receipt.action_id);
    if (!actionId) {
      fail(
        "WORLD_SIMULATION_ACTION_COMMITMENT_LIFECYCLE_SELECTION_INVALID",
        "candidate_action_intent receipt requires action_id.",
      );
    }
    if (!prior) lifecycleDecision = "adopt";
    else if (prior.action_id === actionId) lifecycleDecision = "maintain";
    else {
      lifecycleDecision = "replace";
      replacementActionId = actionId;
    }
  } else {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_LIFECYCLE_SELECTION_INVALID",
      `Unsupported Phase74D selection kind: ${receipt.selection_kind ?? "<missing>"}.`,
    );
  }

  const identity = {
    version: worldSimulationActionCommitmentLifecycleDecisionVersion,
    world_simulation_session_id: receipt.world_simulation_session_id,
    turn_id: receipt.turn_id,
    state_revision: receipt.state_revision,
    world_state_hash: receipt.world_state_hash,
    character: receipt.character,
    source_receipt_id: receipt.receipt_id,
    source_receipt_hash: receipt.receipt_hash,
    prior_commitment_ref: priorCommitmentRef,
    prior_action_id: prior?.action_id ?? null,
    lifecycle_decision: lifecycleDecision,
    selected_action_id: receipt.action_id ?? null,
    replacement_action_id: replacementActionId,
  };
  const lifecycleDecisionHash = hashAgentRunValue(identity);
  return Object.freeze(cloneJson({
    lifecycle_decision_id: `phase75d_lifecycle_${lifecycleDecisionHash.slice(0, 24)}`,
    lifecycle_decision_hash: lifecycleDecisionHash,
    ...identity,
    decision_status: "derived_from_committed_character_choice",
    durable_via_source_receipt: true,
    rebuildable_from_world_history: true,
    receipt_records_commitment_lifecycle_not_action_outcome: true,
    reconsideration_evidence_auto_decided_lifecycle: false,
    action_execution_or_success_inferred: false,
    world_truth_authority: false,
    causal_outcome_authority: false,
  }));
}
