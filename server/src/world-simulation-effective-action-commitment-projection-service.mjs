import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationActionCommitmentLifecycleDecision,
  worldSimulationActionCommitmentLifecycleDecisionVersion,
} from "./world-simulation-action-commitment-lifecycle-decision-service.mjs";

export const worldSimulationEffectiveActionCommitmentProjectionVersion =
  "phase75a-effective-action-commitment-projection-v1";
export const effectiveActionCommitmentEntrySchemaVersion =
  "phase75a-effective-action-commitment-entry-v1";

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

function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_INPUT_INVALID";
  throw error;
}

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function historyTurns(history) {
  if (!isObject(history)) {
    const error = new Error("world_history must be an object.");
    error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_INVALID";
    throw error;
  }
  if (!Array.isArray(history.turns)) {
    const error = new Error("world_history.turns must be an array.");
    error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_INVALID";
    throw error;
  }
  return history.turns;
}

function validateTurnChronology(turns) {
  const seenTurnIds = new Set();
  let previous = null;
  for (const [index, turn] of turns.entries()) {
    if (!isObject(turn)
        || !optionalString(turn.turn_id)
        || !Number.isSafeInteger(turn.revision_from)
        || !Number.isSafeInteger(turn.revision_to)
        || turn.revision_to !== turn.revision_from + 1
        || !optionalString(turn.previous_state_hash)
        || !optionalString(turn.next_state_hash)) {
      const error = new Error(`world_history.turns[${index}] has invalid commit lineage.`);
      error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_TURN_INVALID";
      throw error;
    }
    if (seenTurnIds.has(turn.turn_id)) {
      const error = new Error(`Duplicate committed turn ${turn.turn_id}.`);
      error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_DUPLICATE_TURN";
      throw error;
    }
    if (previous
        && (turn.revision_from !== previous.revision_to
          || turn.previous_state_hash !== previous.next_state_hash)) {
      const error = new Error(`Committed turn ${turn.turn_id} breaks world-history chronology.`);
      error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_CHAIN_MISMATCH";
      throw error;
    }
    seenTurnIds.add(turn.turn_id);
    previous = turn;
  }
}

function receiptForCharacter(bundle, character) {
  const key = characterKey(character);
  const matches = array(bundle.receipts)
    .filter((receipt) => characterKey(receipt?.character) === key);
  if (matches.length > 1) {
    const error = new Error(`Phase75A found multiple Phase74D receipts for ${character} in one turn.`);
    error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_DUPLICATE_CHARACTER_RECEIPT";
    throw error;
  }
  return matches[0] ?? null;
}

function commitmentEntry(receipt, turn, ordinal) {
  return {
    schema_version: effectiveActionCommitmentEntrySchemaVersion,
    commitment_ref: `phase75a_commitment_${hashAgentRunValue({
      version: worldSimulationEffectiveActionCommitmentProjectionVersion,
      receipt_id: receipt.receipt_id,
      turn_id: turn.turn_id,
      ordinal,
    }).slice(0, 24)}`,
    character: receipt.character,
    source_turn_id: turn.turn_id,
    source_revision_from: turn.revision_from,
    source_revision_to: turn.revision_to,
    source_receipt_id: receipt.receipt_id,
    source_receipt_hash: receipt.receipt_hash,
    selection_kind: receipt.selection_kind,
    action_id: receipt.action_id,
    action_ref: receipt.action_ref,
    prospect_ref: receipt.prospect_ref,
    option_ref: receipt.option_ref,
    deliberation_view_hash: receipt.deliberation_view_hash,
    prospective_consequence_view_hash: receipt.prospective_consequence_view_hash,
    cross_option_preference_view_hash: receipt.cross_option_preference_view_hash,
    commitment_status: receipt.selection_kind === "candidate_action_intent"
      ? "active"
      : "cleared_by_reject_all",
    receipt_records_intent_not_outcome: true,
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
}

export function buildWorldSimulationEffectiveActionCommitmentProjectionContract() {
  return deepFreeze({
    version: worldSimulationEffectiveActionCommitmentProjectionVersion,
    phase: "Phase75A",
    status: "effective_action_commitment_read_projection_installed",
    source_receipt_version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    source_of_truth: "committed_world_history_phase74d_receipts",
    event_history_remains_authoritative: true,
    projection_is_read_model: true,
    projection_is_rebuildable_from_history: true,
    projection_persistence_installed: false,
    projection_snapshot_is_authority: false,
    explicit_later_choice_supersedes_prior_commitment: true,
    reject_all_explicitly_clears_prior_commitment: true,
    missing_receipt_does_not_clear_prior_commitment: true,
    selected_action_intent_is_not_world_outcome: true,
    temporal_commitment_persistence_modeled: true,
    character_brain_exposure_installed: false,
    execution_application_installed: false,
    reconsideration_policy_installed: false,
    lifecycle_decision_projection_version:
      worldSimulationActionCommitmentLifecycleDecisionVersion,
    explicit_commitment_lifecycle_decisions_installed: true,
    world_state_mutation_allowed: false,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    numeric_utility_probability_confidence_modeled: false,
  });
}

export function projectWorldSimulationEffectiveActionCommitment(input = {}) {
  const history = cloneJson(input.world_history);
  const character = requiredString(input.character, "character");
  const sessionId = requiredString(
    input.world_simulation_session_id
      ?? history?.world_simulation_session_id,
    "world_simulation_session_id",
  );
  if (history.world_simulation_session_id !== sessionId) {
    const error = new Error("Phase75A world-history session lineage mismatch.");
    error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_SESSION_MISMATCH";
    throw error;
  }
  const inputHash = hashAgentRunValue(history);
  const turns = historyTurns(history);
  validateTurnChronology(turns);

  const replayed = [];
  const lifecycleDecisions = [];
  let effective = null;
  let supersededCount = 0;
  let verifiedBundleCount = 0;

  for (const turn of turns) {
    if (turn.subjective_choice_commitment_receipts === null
        || turn.subjective_choice_commitment_receipts === undefined) {
      continue;
    }
    const bundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
      turn.subjective_choice_commitment_receipts,
      {
        world_simulation_session_id: sessionId,
        turn_id: turn.turn_id,
        state_revision: turn.revision_from,
        world_state_hash: turn.previous_state_hash,
      },
    );
    verifiedBundleCount += 1;
    const receipt = receiptForCharacter(bundle, character);
    if (!receipt) continue;

    const lifecycleDecision = buildWorldSimulationActionCommitmentLifecycleDecision({
      prior_active_commitment: effective,
      current_choice_receipt: receipt,
    });
    lifecycleDecisions.push(lifecycleDecision);

    const entry = commitmentEntry(receipt, turn, replayed.length);
    if (lifecycleDecision.lifecycle_decision === "maintain" && effective?.commitment_ref) {
      entry.commitment_ref = effective.commitment_ref;
    }
    if (effective?.commitment_status === "active"
        && lifecycleDecision.lifecycle_decision !== "maintain") supersededCount += 1;
    replayed.push(entry);
    effective = entry.selection_kind === "candidate_action_intent" ? entry : null;
  }

  const latestDecision = replayed.length ? replayed[replayed.length - 1] : null;
  const projectionBody = {
    source: "committed_world_history_phase74d_receipts",
    character,
    current_commitment: effective ? cloneJson(effective) : null,
    latest_decision: latestDecision ? cloneJson(latestDecision) : null,
    lifecycle_decisions: cloneJson(lifecycleDecisions),
    latest_lifecycle_decision: lifecycleDecisions.length
      ? cloneJson(lifecycleDecisions[lifecycleDecisions.length - 1])
      : null,
    has_active_commitment: Boolean(effective),
    replayed_character_receipt_count: replayed.length,
    lifecycle_decision_count: lifecycleDecisions.length,
    superseded_active_commitment_count: supersededCount,
    verified_receipt_bundle_count: verifiedBundleCount,
    explicit_reject_all_cleared_commitment:
      latestDecision?.selection_kind === "reject_all",
  };
  const projection = {
    ...projectionBody,
    projection_hash: hashAgentRunValue(projectionBody),
  };

  if (hashAgentRunValue(history) !== inputHash) {
    const error = new Error("Phase75A mutated its world-history input.");
    error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationEffectiveActionCommitmentProjectionVersion,
    world_simulation_session_id: sessionId,
    character,
    projection,
    audit: {
      full_world_history_turn_chain_verified: true,
      phase74d_bundle_hashes_verified: true,
      explicit_temporal_replay_only: true,
      missing_receipt_used_as_clear_signal: false,
      selected_intent_promoted_to_world_outcome: false,
      world_state_mutated: false,
      persistent_projection_written: false,
      character_brain_exposure_applied: false,
      execution_application_applied: false,
      reconsideration_policy_applied: false,
      world_truth_authority_claimed: false,
      causal_outcome_authority_claimed: false,
      numeric_utility_probability_confidence_modeled: false,
    },
  });
}
