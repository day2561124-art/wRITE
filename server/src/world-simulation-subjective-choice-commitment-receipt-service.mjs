import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
} from "./world-simulation-subjective-prospective-consequence-service.mjs";
import {
  buildWorldSimulationSubjectiveCrossOptionPreferenceView,
} from "./world-simulation-subjective-cross-option-preference-service.mjs";

export const worldSimulationSubjectiveChoiceCommitmentReceiptVersion =
  "phase74d-durable-character-decision-commitment-receipt-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function requiredString(value, label, maxLength = 240) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_INPUT_INVALID";
    throw error;
  }
  return text;
}

function selectedForCharacter(selected, character) {
  const matches = array(selected).filter((item) => item?.character === character);
  if (matches.length !== 1) {
    const error = new Error(
      `Phase74D requires exactly one canonical selected-action record for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_SELECTION_INVALID";
    throw error;
  }
  return matches[0];
}

function canonicalViews(packet, character) {
  const deliberation = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
  });
  const prospection = buildWorldSimulationSubjectiveProspectiveConsequenceView({
    character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
    subjective_action_deliberation: deliberation,
  });
  const preference = buildWorldSimulationSubjectiveCrossOptionPreferenceView({
    character,
    cognition: packet.cognition,
    candidate_action_intents: packet.candidate_action_intents,
    subjective_action_deliberation: deliberation,
    subjective_prospective_consequence_simulation: prospection,
  });
  return { deliberation, prospection, preference };
}

function selectedReferences(selection, views) {
  if (selection.selection === "reject_all") {
    if (selection.action_id !== null) {
      const error = new Error("reject_all selection must not carry action_id.");
      error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_SELECTION_INVALID";
      throw error;
    }
    return {
      selection_kind: "reject_all",
      action_id: null,
      action_ref: null,
      prospect_ref: null,
      option_ref: null,
    };
  }

  if (selection.selection !== "candidate_action_intent") {
    const error = new Error(`Unsupported Phase74D selection kind: ${selection.selection ?? "<missing>"}.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_SELECTION_INVALID";
    throw error;
  }

  const actionId = requiredString(selection.action_id, "selection.action_id");
  const action = array(views.deliberation.action_options)
    .find((item) => item.action_id === actionId);
  const prospect = array(views.prospection.action_prospects)
    .find((item) => item.action_id === actionId);
  const option = array(views.preference.option_catalog)
    .find((item) => item.action_id === actionId);
  if (!action || !prospect || !option) {
    const error = new Error(
      `Selected action ${actionId} does not resolve across canonical Phase74A/B/C lineage.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_LINEAGE_INVALID";
    throw error;
  }
  return {
    selection_kind: "candidate_action_intent",
    action_id: actionId,
    action_ref: action.action_ref,
    prospect_ref: prospect.prospect_ref,
    option_ref: option.option_ref,
  };
}

export function buildWorldSimulationSubjectiveChoiceCommitmentReceiptContract() {
  return Object.freeze({
    version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    phase: "Phase74D",
    status: "durable_character_decision_commitment_receipt_installed",
    source_lineage: Object.freeze(["Phase74A", "Phase74B", "Phase74C"]),
    character_brain_remains_final_choice_owner: true,
    prepared_turn_broker_remains_order_and_membership_authority: true,
    causal_simulator_remains_action_outcome_owner: true,
    receipt_records_intent_not_outcome: true,
    reject_all_receipt_supported: true,
    deterministic_receipt_identity: true,
    append_only_world_history_persistence: true,
    broker_persistence_changed: false,
    numeric_utility_probability_confidence_modeled: false,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
  });
}

function receiptIdentity(receipt) {
  return {
    version: receipt.version,
    world_simulation_session_id: receipt.world_simulation_session_id,
    turn_id: receipt.turn_id,
    state_revision: receipt.state_revision,
    world_state_hash: receipt.world_state_hash,
    character: receipt.character,
    selection_kind: receipt.selection_kind,
    action_id: receipt.action_id,
    action_ref: receipt.action_ref,
    prospect_ref: receipt.prospect_ref,
    option_ref: receipt.option_ref,
    deliberation_view_hash: receipt.deliberation_view_hash,
    prospective_consequence_view_hash:
      receipt.prospective_consequence_view_hash,
    cross_option_preference_view_hash:
      receipt.cross_option_preference_view_hash,
  };
}

export function assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
  value,
  expected = {},
) {
  if (!isObject(value)
      || value.version !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
      || !Array.isArray(value.receipts)
      || value.receipt_count !== value.receipts.length) {
    const error = new Error("Phase74D choice commitment receipt bundle is invalid.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_RECEIPT_INVALID";
    throw error;
  }
  for (const [field, supplied] of [
    ["world_simulation_session_id", expected.world_simulation_session_id],
    ["turn_id", expected.turn_id],
    ["state_revision", expected.state_revision],
    ["world_state_hash", expected.world_state_hash],
  ]) {
    if (supplied !== undefined && value[field] !== supplied) {
      const error = new Error(`Phase74D receipt bundle ${field} does not match commit lineage.`);
      error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_LINEAGE_MISMATCH";
      throw error;
    }
  }
  for (const receipt of value.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
        || receipt.world_simulation_session_id !== value.world_simulation_session_id
        || receipt.turn_id !== value.turn_id
        || receipt.state_revision !== value.state_revision
        || receipt.world_state_hash !== value.world_state_hash) {
      const error = new Error("Phase74D receipt lineage does not match its bundle.");
      error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_LINEAGE_MISMATCH";
      throw error;
    }
    const expectedHash = hashAgentRunValue(receiptIdentity(receipt));
    if (receipt.receipt_hash !== expectedHash
        || receipt.receipt_id !== `phase74d_choice_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase74D receipt identity hash verification failed.");
      error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_HASH_MISMATCH";
      throw error;
    }
  }
  const bundleForHash = cloneJson(value);
  delete bundleForHash.receipt_bundle_hash;
  const expectedBundleHash = hashAgentRunValue(bundleForHash);
  if (value.receipt_bundle_hash !== expectedBundleHash) {
    const error = new Error("Phase74D receipt bundle hash verification failed.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_HASH_MISMATCH";
    throw error;
  }
  return cloneJson(value);
}

export function buildWorldSimulationSubjectiveChoiceCommitmentReceipts(input = {}) {
  const worldSimulationSessionId = requiredString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredString(input.turn_id, "turn_id");
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    const error = new Error("state_revision must be a non-negative integer.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_INPUT_INVALID";
    throw error;
  }
  const worldStateHash = requiredString(input.world_state_hash, "world_state_hash", 128);
  const packets = array(input.decision_packets);
  const selected = array(input.selected_action_intents);

  const receipts = packets.map((packet) => {
    const character = requiredString(packet?.character, "decision_packet.character");
    const selection = selectedForCharacter(selected, character);
    const views = canonicalViews(packet, character);
    const refs = selectedReferences(selection, views);
    const identity = {
      version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character,
      selection_kind: refs.selection_kind,
      action_id: refs.action_id,
      action_ref: refs.action_ref,
      prospect_ref: refs.prospect_ref,
      option_ref: refs.option_ref,
      deliberation_view_hash: views.deliberation.deliberation_view_hash,
      prospective_consequence_view_hash:
        views.prospection.prospective_consequence_view_hash,
      cross_option_preference_view_hash:
        views.preference.cross_option_preference_view_hash,
    };
    const receiptHash = hashAgentRunValue(identity);
    return Object.freeze({
      receipt_id: `phase74d_choice_${receiptHash.slice(0, 24)}`,
      receipt_hash: receiptHash,
      ...identity,
      receipt_status: "character_decision_committed_for_world_resolution",
      receipt_records_intent_not_outcome: true,
      selection_was_membership_validated_upstream: true,
      world_truth_authority: false,
      causal_outcome_authority: false,
      semantic_candidate_content_duplicated: false,
      numeric_score_recorded: false,
    });
  });

  const bundle = {
    version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    receipt_count: receipts.length,
    receipts,
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_is_authoritative: true,
      prepared_turn_broker_is_not_durable_store: true,
      receipt_does_not_mutate_world_state: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return Object.freeze(cloneJson(bundle));
}
