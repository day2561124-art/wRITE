import { randomUUID } from "node:crypto";

import {
  worldSimulationPreparedTurnBrokerProtocol,
} from "./world-simulation-prepared-turn-ephemeral-broker.mjs";

const allowedOperations = new Set([
  "prepared_turn_reserve_preparation",
  "prepared_turn_store_prepared",
  "prepared_turn_abort_preparation",
  "prepared_turn_get_receipt",
  "prepared_turn_get_active",
  "prepared_turn_submit_decision",
  "prepared_turn_take_for_resolution",
  "prepared_turn_complete_resolution",
  "prepared_turn_abort_resolution",
  "prepared_turn_invalidate",
]);

export function createWorldSimulationPreparedTurnBrokerIpcClient(options = {}) {
  const processLike = options.process_like ?? process;
  const timeoutMs = options.timeout_ms ?? 10_000;
  const pending = new Map();
  let disconnected = typeof processLike.send !== "function"
    || processLike.connected === false;

  function rejectPending(message) {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(message));
    }
    pending.clear();
  }

  processLike.on?.("message", (message) => {
    if (message?.protocol !== worldSimulationPreparedTurnBrokerProtocol
      || message?.kind !== "response") return;
    const entry = pending.get(message.request_id);
    if (!entry) return;
    pending.delete(message.request_id);
    clearTimeout(entry.timer);
    if (message.ok === true) {
      entry.resolve(message.result);
      return;
    }
    const error = new Error(
      message.error?.message
      ?? message.error?.code
      ?? "prepared_turn_parent_broker_request_failed",
    );
    error.code = message.error?.code
      ?? "prepared_turn_parent_broker_request_failed";
    entry.reject(error);
  });

  processLike.on?.("disconnect", () => {
    disconnected = true;
    rejectPending("prepared_turn_parent_broker_unavailable");
  });
  processLike.on?.("exit", () => {
    disconnected = true;
    rejectPending("prepared_turn_parent_broker_unavailable");
  });

  function request(operation, payload = {}) {
    if (!allowedOperations.has(operation)) {
      return Promise.reject(new Error("prepared_turn_parent_broker_operation_invalid"));
    }
    if (disconnected || typeof processLike.send !== "function" || processLike.connected === false) {
      return Promise.reject(new Error("prepared_turn_parent_broker_unavailable"));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("prepared_turn_parent_broker_timeout"));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      processLike.send({
        protocol: worldSimulationPreparedTurnBrokerProtocol,
        kind: "request",
        request_id: requestId,
        operation,
        payload,
      }, (error) => {
        if (!error) return;
        const entry = pending.get(requestId);
        if (!entry) return;
        pending.delete(requestId);
        clearTimeout(entry.timer);
        entry.reject(new Error("prepared_turn_parent_broker_unavailable"));
      });
    });
  }

  return Object.freeze({
    ownership: "mcp_http_parent_prepared_turn_ipc_client",
    reservePreparation: (payload) => request("prepared_turn_reserve_preparation", {
      world_simulation_session_id: payload.world_simulation_session_id,
      state_revision: payload.state_revision,
      world_state_hash: payload.world_state_hash,
    }),
    storePrepared: (payload) => request("prepared_turn_store_prepared", {
      prepared_turn_handle: payload.prepared_turn_handle,
      prepared_turn: payload.prepared_turn,
      decision_inputs: payload.decision_inputs,
    }),
    abortPreparation: (payload) => request("prepared_turn_abort_preparation", {
      prepared_turn_handle: payload.prepared_turn_handle,
      reason: payload.reason ?? null,
    }),
    getReceipt: (payload) => request("prepared_turn_get_receipt", payload),
    getActiveReceipt: (payload) => request("prepared_turn_get_active", payload),
    submitDecision: (payload) => request("prepared_turn_submit_decision", {
      prepared_turn_handle: payload.prepared_turn_handle,
      decision_handle: payload.decision_handle,
      ...(payload.reject_all === true
        ? { reject_all: true }
        : { action_id: payload.action_id }),
    }),
    takeForResolution: (payload) => request("prepared_turn_take_for_resolution", {
      prepared_turn_handle: payload.prepared_turn_handle,
    }),
    completeResolution: (payload) => request("prepared_turn_complete_resolution", {
      prepared_turn_handle: payload.prepared_turn_handle,
      resolution_token: payload.resolution_token,
      result_status: payload.result_status,
    }),
    abortResolution: (payload) => request("prepared_turn_abort_resolution", {
      prepared_turn_handle: payload.prepared_turn_handle,
      resolution_token: payload.resolution_token,
      reason: payload.reason ?? null,
    }),
    invalidate: (payload) => request("prepared_turn_invalidate", payload),
    pendingRequestCount: () => pending.size,
  });
}

export function attachWorldSimulationPreparedTurnBrokerIpc(
  child,
  broker,
  options = {},
) {
  const ownerId = options.owner_id
    ?? `prepared_turn_ipc_owner_${randomUUID()}`;

  const operationHandlers = {
    prepared_turn_reserve_preparation: (payload) => broker.reservePreparation({
      ...payload,
      preparer_owner_id: ownerId,
    }),
    prepared_turn_store_prepared: (payload) => broker.storePrepared({
      ...payload,
      preparer_owner_id: ownerId,
    }),
    prepared_turn_abort_preparation: (payload) => broker.abortPreparation({
      ...payload,
      preparer_owner_id: ownerId,
    }),
    prepared_turn_get_receipt: (payload) => broker.getReceipt(payload),
    prepared_turn_get_active: (payload) => broker.getActiveReceipt(payload),
    prepared_turn_submit_decision: (payload) => broker.submitDecision(payload),
    prepared_turn_take_for_resolution: (payload) => broker.takeForResolution({
      ...payload,
      resolver_owner_id: ownerId,
    }),
    prepared_turn_complete_resolution: (payload) => broker.completeResolution({
      ...payload,
      resolver_owner_id: ownerId,
    }),
    prepared_turn_abort_resolution: (payload) => broker.abortResolution({
      ...payload,
      resolver_owner_id: ownerId,
    }),
    prepared_turn_invalidate: (payload) => broker.invalidate(payload),
  };

  const onMessage = async (message) => {
    if (message?.protocol !== worldSimulationPreparedTurnBrokerProtocol
      || message?.kind !== "request") return;
    const requestId = message.request_id;
    const handler = operationHandlers[message.operation];
    let response;
    try {
      if (typeof requestId !== "string" || !requestId || !handler) {
        throw new Error("prepared_turn_parent_broker_protocol_error");
      }
      response = {
        protocol: worldSimulationPreparedTurnBrokerProtocol,
        kind: "response",
        request_id: requestId,
        ok: true,
        result: await handler(message.payload ?? {}),
      };
    } catch (error) {
      response = {
        protocol: worldSimulationPreparedTurnBrokerProtocol,
        kind: "response",
        request_id: typeof requestId === "string" ? requestId : null,
        ok: false,
        error: {
          code: error?.code ?? "prepared_turn_parent_broker_request_failed",
          message: error?.code ?? "prepared_turn_parent_broker_request_failed",
        },
      };
    }
    if (child.connected !== false) child.send(response, () => {});
  };

  let detached = false;
  const detach = () => {
    if (detached) return;
    detached = true;
    child.off?.("message", onMessage);
    child.off?.("exit", detach);
    child.off?.("disconnect", detach);
    broker.invalidateOwner(ownerId);
  };

  child.on?.("message", onMessage);
  child.on?.("exit", detach);
  child.on?.("disconnect", detach);
  return detach;
}
