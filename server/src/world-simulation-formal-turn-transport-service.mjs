import { randomBytes } from "node:crypto";

import {
  buildWorldSimulationCharacterBrainInput,
  worldSimulationCharacterBrainInputVersion,
} from "./world-simulation-character-brain-input-service.mjs";
import {
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
} from "./world-simulation-loop-service.mjs";
import {
  createEphemeralWorldSimulationPreparedTurnBroker,
  worldSimulationPreparedTurnBrokerVersion,
} from "./world-simulation-prepared-turn-ephemeral-broker.mjs";
import {
  assertWorldSimulationSession,
  beginWorldSimulationSession,
} from "./world-simulation-session-service.mjs";
import {
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationFormalTurnTransportVersion =
  "phase62a-r1-step4b1-formal-turn-transport-core-v1";

const formalResolverOwnerId =
  `formal_turn_runtime_${randomBytes(16).toString("hex")}`;

const inProcessPreparedTurnBroker =
  createEphemeralWorldSimulationPreparedTurnBroker({
    ownership: "formal_world_turn_in_process_runtime",
    storage_scope: "process_local_ephemeral_memory",
  });

function formalLoopOptions(options = {}) {
  // Deliberately do not forward caller callbacks/adapters. Formal transport
  // owns the runtime route: missing retrieval resolver means no retrieval
  // process, and resolve always uses the built-in programmatic adjudicator.
  return options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
}

function preparedTurnBroker(options = {}) {
  return options.preparedTurnBroker
    ?? inProcessPreparedTurnBroker;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredString(value, label, code) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) fail(code, `${label} is required.`);
  return text;
}

function sameSnapshot(receipt, snapshot) {
  return receipt?.state_revision === snapshot?.revision
    && receipt?.world_state_hash === snapshot?.state_hash;
}

function preparationSurface(receipt, reused) {
  return {
    ok: true,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_handle: receipt.prepared_turn_handle,
    world_simulation_session_id: receipt.world_simulation_session_id,
    lifecycle_status: receipt.lifecycle_status,
    decision_count: receipt.decision_count,
    submitted_decision_count: receipt.submitted_decision_count,
    ready_to_resolve: receipt.ready_to_resolve,
    reused_existing_prepared_turn: reused === true,
    current_decision: receipt.current_decision,
    boundaries: {
      full_prepared_turn_exposed: false,
      world_state_exposed: false,
      raw_world_event_exposed: false,
      all_character_packets_exposed_together: false,
      one_active_prepared_turn_per_world_session: true,
      decision_order_server_enforced: true,
      caller_authors_candidate_action: false,
      caller_decides_causal_outcome: false,
      caller_decides_commit_gate: false,
      missing_memory_retrieval_resolver_means_no_process: true,
      formal_transport_accepts_runtime_callbacks: false,
      mcp_public_adoption_installed: false,
    },
  };
}

function resolutionSurface(receipt, result) {
  return {
    ok: result?.ok === true,
    committed: result?.committed === true,
    blocked: result?.committed !== true,
    blocked_reason: result?.blocked_reason ?? null,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_handle: receipt.prepared_turn_handle,
    world_simulation_session_id: receipt.world_simulation_session_id,
    lifecycle_status: receipt.lifecycle_status,
    revision: result?.revision ?? null,
    previous_state_hash: result?.previous_state_hash ?? null,
    next_state_hash: result?.next_state_hash ?? null,
    boundaries: {
      next_world_state_exposed: false,
      causal_resolution_exposed: false,
      next_event_exposed: false,
      consistency_internal_details_exposed: false,
      one_shot_resolution: true,
      programmatic_causal_adjudicator_exclusive: true,
      programmatic_consistency_gate_exclusive: true,
    },
  };
}

async function assertReceiptFresh(receipt, options) {
  const snapshot = await getWorldSimulationState(
    receipt.world_simulation_session_id,
    formalLoopOptions(options),
  );
  if (!sameSnapshot(receipt, snapshot)) {
    const broker = preparedTurnBroker(options);
    await broker.invalidate({
      prepared_turn_handle: receipt.prepared_turn_handle,
      reason: "persisted_world_state_changed",
    });
    fail(
      "WORLD_SIMULATION_FORMAL_PREPARED_TURN_STALE",
      "Prepared world turn no longer matches the persisted world-state revision/hash.",
    );
  }
  return snapshot;
}

export function buildWorldSimulationFormalTurnTransportContract() {
  return {
    version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_broker_version: worldSimulationPreparedTurnBrokerVersion,
    character_brain_input_version: worldSimulationCharacterBrainInputVersion,
    phase: "Phase62A-R1 Step 4B-1",
    bootstrap: {
      initial_world_state_supported_at_session_begin: true,
      repeated_world_state_initialization_allowed: false,
      automatic_canon_hydration_installed: false,
    },
    lifecycle: {
      one_active_prepared_turn_per_world_session: true,
      repeated_prepare_same_snapshot_reuses_handle: true,
      concurrent_prepare_uses_parent_reservation: true,
      decision_submission_sequential: true,
      one_shot_resolution: true,
      parent_restart_invalidates_ephemeral_payload: true,
      arbitrary_ttl_required_for_security: false,
    },
    character_boundary: {
      single_character_packet_surface: true,
      raw_world_event_exposed: false,
      engine_session_or_turn_identity_inside_character_input: false,
      legacy_retrieved_memories_alias_in_formal_surface: false,
      model_context_isolation_claimed: false,
    },
    authority: {
      caller_may_submit_action_id_only: true,
      caller_may_submit_action_object: false,
      caller_may_submit_selected_actions_map: false,
      caller_may_submit_next_world_state: false,
      caller_may_submit_causal_resolution: false,
      caller_may_submit_hard_conflict_count: false,
      custom_causal_adjudicator_forwarded: false,
      custom_memory_retrieval_resolver_forwarded: false,
    },
    mcp_public_adoption_installed: false,
    http_parent_broker_adoption_installed: false,
  };
}

export async function beginFormalWorldSimulationSession(input = {}, options = {}) {
  const session = await beginWorldSimulationSession(
    input,
    formalLoopOptions(options),
  );
  return {
    ...session,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    formal_turn_transport_core_installed: true,
    mcp_public_adoption_installed: false,
  };
}

export async function prepareFormalWorldSimulationTurn(input = {}, options = {}) {
  const sessionId = requiredString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
    "WORLD_SIMULATION_FORMAL_SESSION_REQUIRED",
  );
  const loopOptions = formalLoopOptions(options);
  await assertWorldSimulationSession(sessionId, loopOptions);
  const snapshot = await getWorldSimulationState(sessionId, loopOptions);
  const broker = preparedTurnBroker(options);
  const active = await broker.getActiveReceipt({
    world_simulation_session_id: sessionId,
  });

  if (active) {
    if (sameSnapshot(active, snapshot)) {
      if (active.lifecycle_status === "preparing") {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_PREPARATION_IN_PROGRESS",
          "The active world turn is already being prepared by another transport owner.",
        );
      }
      if (active.lifecycle_status === "taken_for_resolution") {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_RESOLUTION_IN_PROGRESS",
          "The active prepared world turn is already being resolved.",
        );
      }
      return preparationSurface(active, true);
    }
    await broker.invalidate({
      prepared_turn_handle: active.prepared_turn_handle,
      reason: "persisted_world_state_changed_before_prepare",
    });
  }

  const reservation = await broker.reservePreparation({
    world_simulation_session_id: sessionId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    preparer_owner_id: formalResolverOwnerId,
  });

  if (reservation.acquired !== true) {
    const competing = reservation.receipt;
    if (sameSnapshot(competing, snapshot)
      && competing.lifecycle_status !== "preparing"
      && competing.lifecycle_status !== "taken_for_resolution") {
      return preparationSurface(competing, true);
    }
    fail(
      "WORLD_SIMULATION_PREPARED_TURN_PREPARATION_IN_PROGRESS",
      "Another transport owner acquired the preparation reservation first.",
    );
  }

  try {
    const prepared = await prepareWorldSimulationTurn(
      {
        world_simulation_session_id: sessionId,
      },
      loopOptions,
    );

    const decisionInputs = prepared.decision_packets.map((packet) => ({
      character_input: buildWorldSimulationCharacterBrainInput(packet),
    }));

    const receipt = await broker.storePrepared({
      prepared_turn_handle: reservation.receipt.prepared_turn_handle,
      preparer_owner_id: formalResolverOwnerId,
      prepared_turn: prepared,
      decision_inputs: decisionInputs,
    });

    return preparationSurface(receipt, false);
  } catch (error) {
    try {
      await broker.abortPreparation({
        prepared_turn_handle: reservation.receipt.prepared_turn_handle,
        preparer_owner_id: formalResolverOwnerId,
        reason: error?.code ?? "formal_preparation_failed",
      });
    } catch {}
    throw error;
  }
}

export async function submitFormalWorldSimulationCharacterAction(
  input = {},
  options = {},
) {
  const handle = requiredString(
    input.prepared_turn_handle,
    "prepared_turn_handle",
    "WORLD_SIMULATION_FORMAL_PREPARED_TURN_HANDLE_REQUIRED",
  );
  const broker = preparedTurnBroker(options);
  const before = await broker.getReceipt({
    prepared_turn_handle: handle,
  });
  await assertReceiptFresh(before, options);

  const decisionHandle = requiredString(
    input.decision_handle,
    "decision_handle",
    "WORLD_SIMULATION_FORMAL_DECISION_HANDLE_REQUIRED",
  );

  const hasActionId = typeof input.action_id === "string"
    && input.action_id.trim().length > 0;
  const rejectAll = input.reject_all === true;
  if (hasActionId === rejectAll) {
    fail(
      "WORLD_SIMULATION_FORMAL_DECISION_SELECTION_INVALID",
      "Submit exactly one of action_id or reject_all=true.",
    );
  }

  const receipt = await broker.submitDecision({
    prepared_turn_handle: handle,
    decision_handle: decisionHandle,
    ...(rejectAll
      ? { reject_all: true }
      : { action_id: input.action_id.trim() }),
  });

  return preparationSurface(receipt, false);
}

export async function resolveFormalWorldSimulationTurn(input = {}, options = {}) {
  const handle = requiredString(
    input.prepared_turn_handle,
    "prepared_turn_handle",
    "WORLD_SIMULATION_FORMAL_PREPARED_TURN_HANDLE_REQUIRED",
  );
  const broker = preparedTurnBroker(options);
  const acquisition = await broker.takeForResolution({
    prepared_turn_handle: handle,
    resolver_owner_id: formalResolverOwnerId,
  });

  try {
    const result = await resolveWorldSimulationTurn(
      acquisition.prepared_turn,
      acquisition.selected_actions,
      formalLoopOptions(options),
    );
    const receipt = await broker.completeResolution({
      prepared_turn_handle: handle,
      resolution_token: acquisition.resolution_token,
      resolver_owner_id: formalResolverOwnerId,
      result_status: result?.committed === true
        ? "committed"
        : "blocked",
    });
    return resolutionSurface(receipt, result);
  } catch (error) {
    try {
      await broker.abortResolution({
        prepared_turn_handle: handle,
        resolution_token: acquisition.resolution_token,
        resolver_owner_id: formalResolverOwnerId,
        reason: error?.code ?? "formal_resolution_failed",
      });
    } catch {
      // The original native-loop failure remains authoritative.
    }
    throw error;
  }
}
