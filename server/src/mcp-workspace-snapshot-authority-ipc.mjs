import { randomUUID } from "node:crypto";

export const workspaceSnapshotAuthorityProtocol =
  "writer_workbench_workspace_snapshot_authority_v1";

const allowedOperations = new Set([
  "snapshot_try_reuse",
  "snapshot_begin_synchronization",
  "snapshot_publish_exact",
  "snapshot_invalidate",
  "snapshot_status",
]);

export function createWorkspaceSnapshotAuthorityIpcClient(options = {}) {
  const processLike = options.process_like ?? process;
  const timeoutMs = options.timeout_ms ?? 5_000;
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
    if (message?.protocol !== workspaceSnapshotAuthorityProtocol
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
      ?? "workspace_snapshot_parent_authority_request_failed",
    );
    error.code = message.error?.code
      ?? "workspace_snapshot_parent_authority_request_failed";
    entry.reject(error);
  });

  processLike.on?.("disconnect", () => {
    disconnected = true;
    rejectPending("workspace_snapshot_parent_authority_unavailable");
  });
  processLike.on?.("exit", () => {
    disconnected = true;
    rejectPending("workspace_snapshot_parent_authority_unavailable");
  });

  function request(operation, payload = {}) {
    if (!allowedOperations.has(operation)) {
      return Promise.reject(new Error("workspace_snapshot_parent_authority_operation_invalid"));
    }
    if (disconnected || typeof processLike.send !== "function" || processLike.connected === false) {
      return Promise.reject(new Error("workspace_snapshot_parent_authority_unavailable"));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("workspace_snapshot_parent_authority_timeout"));
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, { resolve, reject, timer });
      processLike.send({
        protocol: workspaceSnapshotAuthorityProtocol,
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
        entry.reject(new Error("workspace_snapshot_parent_authority_unavailable"));
      });
    });
  }

  return Object.freeze({
    ownership: "mcp_http_parent_workspace_snapshot_authority_ipc_client",
    tryReuse: (workspaceId) => request("snapshot_try_reuse", {
      workspace_id: workspaceId,
    }),
    beginSynchronization: (workspaceId) => request("snapshot_begin_synchronization", {
      workspace_id: workspaceId,
    }),
    publishExact: (workspaceId, snapshot, synchronizationToken = null) => request("snapshot_publish_exact", {
      workspace_id: workspaceId,
      snapshot,
      synchronization_token: synchronizationToken,
    }),
    invalidate: (workspaceId, reason = "workspace_mutation") => request("snapshot_invalidate", {
      workspace_id: workspaceId,
      reason,
    }),
    status: (workspaceId) => request("snapshot_status", {
      workspace_id: workspaceId,
    }),
    pendingRequestCount: () => pending.size,
  });
}

export function attachWorkspaceSnapshotAuthorityIpc(child, authority, options = {}) {
  const changeClockProvider = options.change_clock_provider ?? null;

  async function runProviderStep(step, payload) {
    if (!changeClockProvider || typeof changeClockProvider[step] !== "function") return null;
    try {
      return await changeClockProvider[step](payload);
    } catch {
      const reason = `change_clock_provider_${step}_failed`;
      authority.invalidate({
        workspace_id: payload?.workspace_id,
        reason,
      });
      return { ok: false, reason, provider_step_failed: true };
    }
  }

  const operationHandlers = {
    snapshot_try_reuse: async (payload) => {
      const candidate = authority.tryReuse(payload);
      if (candidate?.hit !== true) return candidate;
      const providerResult = await runProviderStep("prepareReuse", {
        ...payload,
        snapshot: candidate.snapshot,
      });
      // B4A/B4B1 compatibility: an older parent with no production provider
      // retains the pre-B4B2 authority semantics. A B4B2 provider, however,
      // must positively fence the candidate before it can leave the parent.
      if (providerResult === null) return candidate;
      if (providerResult?.ok !== true || providerResult?.fenced !== true) {
        authority.invalidate({
          workspace_id: payload?.workspace_id,
          reason: providerResult?.reason ?? "change_clock_provider_reuse_fence_failed",
        });
      }
      return authority.tryReuse(payload);
    },
    snapshot_begin_synchronization: async (payload) => {
      const providerResult = await runProviderStep("prepareSynchronization", payload);
      if (providerResult !== null && providerResult?.ready !== true) {
        return {
          ...authority.status(payload),
          started: false,
          reason: providerResult?.reason ?? "change_clock_provider_sync_prepare_failed",
          token: null,
        };
      }
      return authority.beginSynchronization(payload);
    },
    snapshot_publish_exact: async (payload) => {
      if (payload?.synchronization_token) {
        const providerResult = await runProviderStep("fenceSynchronization", {
          workspace_id: payload.workspace_id,
          token: payload.synchronization_token,
          snapshot: payload.snapshot,
        });
        if (providerResult !== null && providerResult?.ok !== true) {
          authority.invalidate({
            workspace_id: payload.workspace_id,
            reason: providerResult?.reason ?? "change_clock_provider_sync_fence_failed",
          });
        }
      }
      return authority.publishExact({
        ...payload,
        source_pid: child.pid ?? null,
      });
    },
    snapshot_invalidate: (payload) => authority.invalidate(payload),
    snapshot_status: (payload) => authority.status(payload),
  };

  const onMessage = async (message) => {
    if (message?.protocol !== workspaceSnapshotAuthorityProtocol
      || message?.kind !== "request") return;
    const requestId = message.request_id;
    const handler = operationHandlers[message.operation];
    let response;
    try {
      if (typeof requestId !== "string" || !requestId || !handler) {
        throw new Error("workspace_snapshot_parent_authority_protocol_error");
      }
      response = {
        protocol: workspaceSnapshotAuthorityProtocol,
        kind: "response",
        request_id: requestId,
        ok: true,
        result: await handler(message.payload ?? {}),
      };
    } catch (error) {
      response = {
        protocol: workspaceSnapshotAuthorityProtocol,
        kind: "response",
        request_id: typeof requestId === "string" ? requestId : null,
        ok: false,
        error: {
          code: error?.code ?? "workspace_snapshot_parent_authority_request_failed",
          message: error?.message ?? "workspace_snapshot_parent_authority_request_failed",
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
    // Parent authority intentionally survives child/session replacement.
  };

  child.on?.("message", onMessage);
  child.on?.("exit", detach);
  child.on?.("disconnect", detach);
  return detach;
}
