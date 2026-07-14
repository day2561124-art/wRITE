import { randomUUID } from "node:crypto";
import { rawStoryHandoffBrokerProtocol } from "./raw-story-handoff-ephemeral-broker.mjs";

const allowedOperations = new Set(["raw_story_seal_store", "raw_story_seal_acquire", "raw_story_seal_consume", "raw_story_seal_abort"]);

export function createRawStoryHandoffBrokerIpcClient(options = {}) {
  const processLike = options.process_like ?? process;
  const timeoutMs = options.timeout_ms ?? 10_000;
  const pending = new Map();
  let disconnected = typeof processLike.send !== "function" || processLike.connected === false;

  function rejectPending(message) {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(message));
    }
    pending.clear();
  }

  processLike.on?.("message", (message) => {
    if (message?.protocol !== rawStoryHandoffBrokerProtocol || message?.kind !== "response") return;
    const entry = pending.get(message.request_id);
    if (!entry) return;
    pending.delete(message.request_id);
    clearTimeout(entry.timer);
    if (message.ok === true) entry.resolve(message.result);
    else entry.reject(new Error(message.error?.code ?? "parent_broker_request_failed"));
  });
  processLike.on?.("disconnect", () => {
    disconnected = true;
    rejectPending("parent_broker_unavailable");
  });
  processLike.on?.("exit", () => {
    disconnected = true;
    rejectPending("parent_broker_unavailable");
  });

  function request(operation, payload) {
    if (!allowedOperations.has(operation)) return Promise.reject(new Error("parent_broker_operation_invalid"));
    if (disconnected || typeof processLike.send !== "function" || processLike.connected === false) {
      return Promise.reject(new Error("parent_broker_unavailable"));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("parent_broker_timeout"));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      processLike.send({
        protocol: rawStoryHandoffBrokerProtocol,
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
        entry.reject(new Error("parent_broker_unavailable"));
      });
    });
  }

  return Object.freeze({
    ownership: "mcp_http_parent_ipc_client",
    store: (payload) => request("raw_story_seal_store", payload),
    acquire: (payload) => request("raw_story_seal_acquire", payload),
    consume: (payload) => request("raw_story_seal_consume", payload),
    abort: (payload) => request("raw_story_seal_abort", payload),
    pendingRequestCount: () => pending.size,
  });
}

export function attachRawStoryHandoffBrokerIpc(child, broker) {
  const operationHandlers = {
    raw_story_seal_store: (payload) => broker.store(payload),
    raw_story_seal_acquire: (payload) => broker.acquire(payload),
    raw_story_seal_consume: (payload) => broker.consume(payload),
    raw_story_seal_abort: (payload) => broker.abort(payload),
  };
  const onMessage = async (message) => {
    if (message?.protocol !== rawStoryHandoffBrokerProtocol || message?.kind !== "request") return;
    const requestId = message.request_id;
    const handler = operationHandlers[message.operation];
    let response;
    try {
      if (typeof requestId !== "string" || !requestId || !handler) throw new Error("parent_broker_protocol_error");
      response = {
        protocol: rawStoryHandoffBrokerProtocol,
        kind: "response",
        request_id: requestId,
        ok: true,
        result: await handler(message.payload ?? {}),
      };
    } catch (error) {
      response = {
        protocol: rawStoryHandoffBrokerProtocol,
        kind: "response",
        request_id: typeof requestId === "string" ? requestId : null,
        ok: false,
        error: { code: error instanceof Error ? error.message : "parent_broker_request_failed" },
      };
    }
    if (child.connected) child.send(response, () => {});
  };
  child.on("message", onMessage);
  return () => child.off("message", onMessage);
}
