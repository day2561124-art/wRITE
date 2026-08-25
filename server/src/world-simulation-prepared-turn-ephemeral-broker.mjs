import { randomBytes } from "node:crypto";

import {
  hashCanonicalValue,
} from "./canonical-json-hash-service.mjs";

export const worldSimulationPreparedTurnBrokerVersion =
  "phase62a-r1-step4b1-prepared-turn-broker-v1";

export const worldSimulationPreparedTurnBrokerProtocol =
  "writer_workbench.world_prepared_turn_broker.v1";

export const worldSimulationPreparedTurnHandlePattern =
  /^world_prepared_turn_\d{8}-\d{6}-[a-f0-9]{12}$/u;

const decisionHandlePattern =
  /^world_decision_[a-f0-9]{32}$/u;

const resolutionTokenPattern =
  /^world_resolution_[a-f0-9]{32}$/u;

const activeStatuses =
  new Set([
    "preparing",
    "prepared",
    "ready_to_resolve",
    "taken_for_resolution",
  ]);

const terminalStatuses =
  new Set([
    "committed",
    "blocked",
    "invalidated",
  ]);

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function compactTimestamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
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

function requiredHandle(value) {
  const text = requiredString(
    value,
    "prepared_turn_handle",
    "WORLD_SIMULATION_PREPARED_TURN_HANDLE_INVALID",
  );
  if (!worldSimulationPreparedTurnHandlePattern.test(text)) {
    fail(
      "WORLD_SIMULATION_PREPARED_TURN_HANDLE_INVALID",
      "prepared_turn_handle is invalid.",
    );
  }
  return text;
}

function requiredDecisionHandle(value) {
  const text = requiredString(
    value,
    "decision_handle",
    "WORLD_SIMULATION_DECISION_HANDLE_INVALID",
  );
  if (!decisionHandlePattern.test(text)) {
    fail(
      "WORLD_SIMULATION_DECISION_HANDLE_INVALID",
      "decision_handle is invalid.",
    );
  }
  return text;
}

function requiredResolutionToken(value) {
  const text = requiredString(
    value,
    "resolution_token",
    "WORLD_SIMULATION_RESOLUTION_TOKEN_INVALID",
  );
  if (!resolutionTokenPattern.test(text)) {
    fail(
      "WORLD_SIMULATION_RESOLUTION_TOKEN_INVALID",
      "resolution_token is invalid.",
    );
  }
  return text;
}

function requiredRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(
      "WORLD_SIMULATION_PREPARED_TURN_REVISION_INVALID",
      "state_revision must be a non-negative safe integer.",
    );
  }
  return value;
}

function publicDecision(record) {
  if (record.lifecycle_status !== "prepared") return null;
  const decision = record.decisions[record.current_decision_index];
  if (!decision || decision.status !== "pending") return null;
  return {
    decision_index: record.current_decision_index,
    decision_handle: decision.decision_handle,
    character_input: cloneJson(decision.character_input),
  };
}

function publicReceipt(record) {
  if (!record) return null;
  return {
    prepared_turn_handle: record.prepared_turn_handle,
    world_simulation_session_id: record.world_simulation_session_id,
    state_revision: record.state_revision,
    world_state_hash: record.world_state_hash,
    prepared_turn_hash: record.prepared_turn_hash,
    created_at: record.created_at,
    resolved_at: record.resolved_at ?? null,
    invalidated_at: record.invalidated_at ?? null,
    lifecycle_status: record.lifecycle_status,
    status: record.lifecycle_status,
    decision_count: record.decisions.length,
    submitted_decision_count:
      record.decisions.filter((decision) => decision.status === "submitted").length,
    ready_to_resolve: record.lifecycle_status === "ready_to_resolve",
    current_decision: publicDecision(record),
    payload_reference_active: Boolean(record.prepared_turn),
    payload_release_semantics: record.prepared_turn
      ? "active_process_local_reference"
      : "process_local_reference_released_not_secure_memory_erase",
    broker_storage_scope: record.broker_storage_scope,
    broker_runtime_process_instance_id: record.broker_runtime_process_instance_id,
    broker_persistence: "none",
    persists_across_process_restart: false,
    terminal: terminalStatuses.has(record.lifecycle_status),
    invalidation_reason: record.invalidation_reason ?? null,
  };
}

export function createWorldSimulationPreparedTurnHandle(date = new Date()) {
  return `world_prepared_turn_${compactTimestamp(date)}-${randomBytes(6).toString("hex")}`;
}

export function createEphemeralWorldSimulationPreparedTurnBroker(options = {}) {
  const records = new Map();
  const activeBySession = new Map();
  const brokerStorageScope = options.storage_scope
    ?? "process_local_ephemeral_memory";
  const brokerRuntimeProcessInstanceId = options.broker_runtime_process_instance_id
    ?? `world_broker_runtime_${compactTimestamp()}-${randomBytes(12).toString("hex")}`;

  function recordForHandle(value) {
    const handle = requiredHandle(value);
    const record = records.get(handle);
    if (!record) {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_NOT_FOUND",
        "prepared_turn_handle was not found in ephemeral storage.",
      );
    }
    return record;
  }

  function releasePayload(record) {
    delete record.prepared_turn;
    for (const decision of record.decisions) {
      delete decision.character_input;
      delete decision.candidate_action_ids;
    }
    record.preparer_owner_id = null;
    record.resolution_token = null;
    record.resolver_owner_id = null;
  }

  function clearActive(record) {
    if (activeBySession.get(record.world_simulation_session_id) === record.prepared_turn_handle) {
      activeBySession.delete(record.world_simulation_session_id);
    }
  }

  function terminal(record, status, metadata = {}) {
    record.lifecycle_status = status;
    if (status === "invalidated") {
      record.invalidated_at = new Date().toISOString();
      record.invalidation_reason = metadata.reason ?? "invalidated";
    } else {
      record.resolved_at = new Date().toISOString();
    }
    clearActive(record);
    releasePayload(record);
    return publicReceipt(record);
  }

  function reservePreparation(input = {}) {
    const sessionId = requiredString(
      input.world_simulation_session_id,
      "world_simulation_session_id",
      "WORLD_SIMULATION_PREPARED_TURN_SESSION_INVALID",
    );
    const stateRevision = requiredRevision(input.state_revision);
    const worldStateHash = requiredString(
      input.world_state_hash,
      "world_state_hash",
      "WORLD_SIMULATION_PREPARED_TURN_STATE_HASH_INVALID",
    );
    const ownerId = requiredString(
      input.preparer_owner_id,
      "preparer_owner_id",
      "WORLD_SIMULATION_PREPARER_OWNER_INVALID",
    );
    const activeHandle = activeBySession.get(sessionId);
    if (activeHandle) {
      const active = records.get(activeHandle);
      if (active && activeStatuses.has(active.lifecycle_status)) {
        return {
          acquired: false,
          receipt: publicReceipt(active),
        };
      }
      activeBySession.delete(sessionId);
    }
    const handle = createWorldSimulationPreparedTurnHandle();
    const record = {
      prepared_turn_handle: handle,
      world_simulation_session_id: sessionId,
      state_revision: stateRevision,
      world_state_hash: worldStateHash,
      prepared_turn_hash: null,
      prepared_turn: null,
      decisions: [],
      current_decision_index: 0,
      lifecycle_status: "preparing",
      created_at: new Date().toISOString(),
      broker_storage_scope: brokerStorageScope,
      broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
      preparer_owner_id: ownerId,
      resolution_token: null,
      resolver_owner_id: null,
    };
    records.set(handle, record);
    activeBySession.set(sessionId, handle);
    return {
      acquired: true,
      receipt: publicReceipt(record),
    };
  }

  function storePrepared(input = {}) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (record.lifecycle_status !== "preparing") {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_NOT_PREPARING",
        "prepared_turn_handle is not held by an active preparation reservation.",
      );
    }
    const ownerId = requiredString(
      input.preparer_owner_id,
      "preparer_owner_id",
      "WORLD_SIMULATION_PREPARER_OWNER_INVALID",
    );
    if (record.preparer_owner_id !== ownerId) {
      fail(
        "WORLD_SIMULATION_PREPARATION_OWNER_MISMATCH",
        "Prepared-turn preparation reservation belongs to another owner.",
      );
    }
    if (!isObject(input.prepared_turn)) {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_PAYLOAD_INVALID",
        "prepared_turn must be an object.",
      );
    }
    if (!Array.isArray(input.decision_inputs) || input.decision_inputs.length === 0) {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_DECISIONS_REQUIRED",
        "decision_inputs must contain at least one named-character decision.",
      );
    }
    if (input.prepared_turn.world_simulation_session_id !== record.world_simulation_session_id
      || input.prepared_turn.state_revision !== record.state_revision
      || input.prepared_turn.world_state_hash !== record.world_state_hash) {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_BINDING_MISMATCH",
        "prepared_turn session/revision/hash binding does not match the preparation reservation.",
      );
    }

    const preparedTurn = cloneJson(input.prepared_turn);
    const characters = new Set();
    const decisions = input.decision_inputs.map((item, index) => {
      if (!isObject(item) || !isObject(item.character_input)) {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_DECISION_INVALID",
          `decision_inputs[${index}] is invalid.`,
        );
      }
      const character = requiredString(
        item.character_input.character,
        `decision_inputs[${index}].character_input.character`,
        "WORLD_SIMULATION_PREPARED_TURN_CHARACTER_INVALID",
      );
      if (characters.has(character)) {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_CHARACTER_DUPLICATE",
          `Duplicate prepared-turn character: ${character}`,
        );
      }
      characters.add(character);
      const candidates = Array.isArray(item.character_input.candidate_action_intents)
        ? item.character_input.candidate_action_intents
        : [];
      const candidateActionIds = candidates.map((candidate, candidateIndex) => requiredString(
        candidate?.action_id,
        `decision_inputs[${index}].candidate_action_intents[${candidateIndex}].action_id`,
        "WORLD_SIMULATION_PREPARED_TURN_ACTION_ID_INVALID",
      ));
      return {
        decision_handle: `world_decision_${randomBytes(16).toString("hex")}`,
        decision_index: index,
        character,
        character_input: cloneJson(item.character_input),
        candidate_action_ids: [...new Set(candidateActionIds)],
        status: "pending",
        selection: null,
        submitted_at: null,
      };
    });

    record.prepared_turn_hash = hashCanonicalValue(preparedTurn);
    record.prepared_turn = preparedTurn;
    record.decisions = decisions;
    record.current_decision_index = 0;
    record.lifecycle_status = "prepared";
    record.preparer_owner_id = null;
    record.prepared_at = new Date().toISOString();
    return publicReceipt(record);
  }

  function abortPreparation(input = {}) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (record.lifecycle_status !== "preparing") {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_NOT_PREPARING",
        "prepared_turn_handle is not held by an active preparation reservation.",
      );
    }
    const ownerId = requiredString(
      input.preparer_owner_id,
      "preparer_owner_id",
      "WORLD_SIMULATION_PREPARER_OWNER_INVALID",
    );
    if (record.preparer_owner_id !== ownerId) {
      fail(
        "WORLD_SIMULATION_PREPARATION_OWNER_MISMATCH",
        "Prepared-turn preparation reservation belongs to another owner.",
      );
    }
    return terminal(record, "invalidated", {
      reason: input.reason ?? "preparation_failed",
    });
  }

  // Direct in-process convenience API. Formal cross-process transport uses
  // reservePreparation -> storePrepared so only one child may run native
  // preparation for a session/revision/hash at a time.
  function store(input = {}) {
    const ownerId = `direct_store_${randomBytes(16).toString("hex")}`;
    const reservation = reservePreparation({
      world_simulation_session_id: input.world_simulation_session_id,
      state_revision: input.state_revision,
      world_state_hash: input.world_state_hash,
      preparer_owner_id: ownerId,
    });
    if (!reservation.acquired) {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_ALREADY_ACTIVE",
        "This world simulation session already has one active prepared turn.",
      );
    }
    try {
      return storePrepared({
        prepared_turn_handle: reservation.receipt.prepared_turn_handle,
        preparer_owner_id: ownerId,
        prepared_turn: input.prepared_turn,
        decision_inputs: input.decision_inputs,
      });
    } catch (error) {
      try {
        abortPreparation({
          prepared_turn_handle: reservation.receipt.prepared_turn_handle,
          preparer_owner_id: ownerId,
          reason: error?.code ?? "direct_store_failed",
        });
      } catch {}
      throw error;
    }
  }

  function getReceipt(input = {}) {
    return publicReceipt(recordForHandle(input.prepared_turn_handle));
  }

  function getActiveReceipt(input = {}) {
    const sessionId = requiredString(
      input.world_simulation_session_id,
      "world_simulation_session_id",
      "WORLD_SIMULATION_PREPARED_TURN_SESSION_INVALID",
    );
    const handle = activeBySession.get(sessionId);
    if (!handle) return null;
    const record = records.get(handle);
    if (!record || !activeStatuses.has(record.lifecycle_status)) {
      activeBySession.delete(sessionId);
      return null;
    }
    return publicReceipt(record);
  }

  function submitDecision(input = {}) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (record.lifecycle_status !== "prepared") {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_NOT_ACCEPTING_DECISIONS",
        "prepared_turn_handle is not accepting character decisions.",
      );
    }
    const expected = record.decisions[record.current_decision_index];
    const decisionHandle = requiredDecisionHandle(input.decision_handle);
    if (!expected || expected.decision_handle !== decisionHandle || expected.status !== "pending") {
      fail(
        "WORLD_SIMULATION_DECISION_ORDER_VIOLATION",
        "Only the current pending character decision may be submitted.",
      );
    }

    const rejectAll = input.reject_all === true;
    const actionId = typeof input.action_id === "string"
      ? input.action_id.trim()
      : "";
    if (rejectAll === actionId.length > 0) {
      fail(
        "WORLD_SIMULATION_DECISION_SELECTION_INVALID",
        "Submit exactly one of action_id or reject_all=true.",
      );
    }
    if (!rejectAll && !expected.candidate_action_ids.includes(actionId)) {
      fail(
        "WORLD_SIMULATION_ACTION_NOT_AVAILABLE",
        "Selected action_id is not available in the current character packet.",
      );
    }

    expected.status = "submitted";
    expected.selection = rejectAll
      ? "reject_all"
      : { action_id: actionId };
    expected.submitted_at = new Date().toISOString();
    record.current_decision_index += 1;
    if (record.current_decision_index >= record.decisions.length) {
      record.lifecycle_status = "ready_to_resolve";
    }
    return publicReceipt(record);
  }

  function takeForResolution(input = {}) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (record.lifecycle_status !== "ready_to_resolve") {
      fail(
        "WORLD_SIMULATION_PREPARED_TURN_NOT_READY",
        "prepared_turn_handle is not ready for one-shot resolution.",
      );
    }
    const ownerId = requiredString(
      input.resolver_owner_id,
      "resolver_owner_id",
      "WORLD_SIMULATION_RESOLVER_OWNER_INVALID",
    );
    const token = `world_resolution_${randomBytes(16).toString("hex")}`;
    record.lifecycle_status = "taken_for_resolution";
    record.resolution_token = token;
    record.resolver_owner_id = ownerId;
    record.taken_at = new Date().toISOString();
    const selectedActions = Object.fromEntries(
      record.decisions.map((decision) => [
        decision.character,
        cloneJson(decision.selection),
      ]),
    );
    return {
      receipt: publicReceipt(record),
      resolution_token: token,
      prepared_turn: cloneJson(record.prepared_turn),
      selected_actions: selectedActions,
    };
  }

  function assertResolutionLease(input) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (record.lifecycle_status !== "taken_for_resolution") {
      fail(
        "WORLD_SIMULATION_RESOLUTION_LEASE_INACTIVE",
        "prepared_turn_handle is not held for resolution.",
      );
    }
    const token = requiredResolutionToken(input.resolution_token);
    const ownerId = requiredString(
      input.resolver_owner_id,
      "resolver_owner_id",
      "WORLD_SIMULATION_RESOLVER_OWNER_INVALID",
    );
    if (record.resolution_token !== token || record.resolver_owner_id !== ownerId) {
      fail(
        "WORLD_SIMULATION_RESOLUTION_LEASE_MISMATCH",
        "prepared-turn resolution lease does not match the active taker.",
      );
    }
    return record;
  }

  function completeResolution(input = {}) {
    const record = assertResolutionLease(input);
    const status = input.result_status;
    if (status !== "committed" && status !== "blocked") {
      fail(
        "WORLD_SIMULATION_RESOLUTION_RESULT_STATUS_INVALID",
        "result_status must be committed or blocked.",
      );
    }
    return terminal(record, status);
  }

  function abortResolution(input = {}) {
    const record = assertResolutionLease(input);
    return terminal(record, "invalidated", {
      reason: input.reason ?? "resolution_failed",
    });
  }

  function invalidate(input = {}) {
    const record = recordForHandle(input.prepared_turn_handle);
    if (terminalStatuses.has(record.lifecycle_status)) return publicReceipt(record);
    return terminal(record, "invalidated", {
      reason: input.reason ?? "invalidated_by_transport_core",
    });
  }

  function invalidateOwner(ownerId) {
    const normalizedOwner = typeof ownerId === "string" ? ownerId.trim() : "";
    if (!normalizedOwner) return 0;
    let count = 0;
    for (const record of records.values()) {
      if (record.lifecycle_status === "preparing"
        && record.preparer_owner_id === normalizedOwner) {
        terminal(record, "invalidated", {
          reason: "preparer_owner_disconnected",
        });
        count += 1;
        continue;
      }
      if (record.lifecycle_status === "taken_for_resolution"
        && record.resolver_owner_id === normalizedOwner) {
        terminal(record, "invalidated", {
          reason: "resolver_owner_disconnected",
        });
        count += 1;
      }
    }
    return count;
  }

  return Object.freeze({
    version: worldSimulationPreparedTurnBrokerVersion,
    ownership: options.ownership ?? "world_simulation_transport_core",
    storage_scope: brokerStorageScope,
    persistence: "none",
    broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
    reservePreparation,
    storePrepared,
    abortPreparation,
    store,
    getReceipt,
    getActiveReceipt,
    submitDecision,
    takeForResolution,
    completeResolution,
    abortResolution,
    invalidate,
    invalidateOwner,
    getStorageStatus: () => ({
      version: worldSimulationPreparedTurnBrokerVersion,
      storage_scope: brokerStorageScope,
      broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
      broker_persistence: "none",
      persists_across_process_restart: false,
      active_prepared_turn_count: activeBySession.size,
      receipt_count: records.size,
      payload_reference_count:
        [...records.values()].filter((record) => Boolean(record.prepared_turn)).length,
      secure_memory_erase_claimed: false,
    }),
  });
}
