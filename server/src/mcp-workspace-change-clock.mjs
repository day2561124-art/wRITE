import { randomUUID } from "node:crypto";

export const WORKSPACE_CHANGE_CLOCK_SCHEMA_VERSION = 1;
export const WORKSPACE_CHANGE_CLOCK_MAX_WORKSPACES = 32;

const workspaceIdPattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const watchStateSet = new Set(["starting", "synchronizing", "healthy", "unknown", "failed"]);

function normalizeWorkspaceId(value) {
  if (typeof value !== "string" || !workspaceIdPattern.test(value)) {
    throw new Error("workspace_id is invalid.");
  }
  return value;
}

function normalizeRootIdentity(value) {
  if (typeof value !== "string" || !value || value.length > 512 || value.includes("\u0000")) {
    throw new Error("root_identity is invalid.");
  }
  return value;
}

function boundedReason(value, fallback) {
  return String(value || fallback).slice(0, 160);
}

export function createWorkspaceChangeClock(options = {}) {
  const maxWorkspaces = options.max_workspaces ?? WORKSPACE_CHANGE_CLOCK_MAX_WORKSPACES;
  if (!Number.isSafeInteger(maxWorkspaces) || maxWorkspaces < 1 || maxWorkspaces > 1024) {
    throw new Error("max_workspaces must be an integer between 1 and 1024.");
  }
  const idFactory = typeof options.id_factory === "function" ? options.id_factory : () => randomUUID();
  const providerInstanceId = typeof options.provider_instance_id === "string" && options.provider_instance_id
    ? options.provider_instance_id.slice(0, 160)
    : idFactory();
  const states = new Map();

  function enforceCapacity() {
    while (states.size > maxWorkspaces) {
      const oldest = states.keys().next().value;
      states.delete(oldest);
    }
  }

  function stateFor(workspaceId) {
    const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
    let state = states.get(normalizedWorkspaceId);
    if (!state) {
      state = {
        workspace_id: normalizedWorkspaceId,
        watch_state: "unknown",
        provider_ready: false,
        watch_instance_id: null,
        root_identity: null,
        change_epoch: 0,
        baseline_epoch: null,
        active_sync_nonce: null,
        active_sync_epoch: null,
        fresh_instance: true,
        last_reason: "change_clock_provider_unavailable",
      };
      states.set(normalizedWorkspaceId, state);
      enforceCapacity();
    } else {
      states.delete(normalizedWorkspaceId);
      states.set(normalizedWorkspaceId, state);
    }
    return state;
  }

  function status({ workspace_id } = {}) {
    const state = stateFor(workspace_id);
    return {
      schema_version: WORKSPACE_CHANGE_CLOCK_SCHEMA_VERSION,
      ownership: "mcp_http_parent_workspace_change_clock",
      workspace_id: state.workspace_id,
      provider_instance_id: providerInstanceId,
      watch_instance_id: state.watch_instance_id,
      watch_state: state.watch_state,
      provider_ready: state.provider_ready,
      root_identity: state.root_identity,
      change_epoch: state.change_epoch,
      baseline_epoch: state.baseline_epoch,
      synchronized: state.watch_state === "healthy"
        && state.baseline_epoch === state.change_epoch,
      fresh_instance: state.fresh_instance,
      last_reason: state.last_reason,
    };
  }

  function markProviderReady({ workspace_id, root_identity, reason = "change_clock_provider_ready" } = {}) {
    const state = stateFor(workspace_id);
    const normalizedRootIdentity = normalizeRootIdentity(root_identity);
    state.change_epoch += 1;
    state.provider_ready = true;
    state.watch_state = "synchronizing";
    state.watch_instance_id = idFactory();
    state.root_identity = normalizedRootIdentity;
    state.baseline_epoch = null;
    state.active_sync_nonce = null;
    state.active_sync_epoch = null;
    state.fresh_instance = true;
    state.last_reason = boundedReason(reason, "change_clock_provider_ready");
    return status({ workspace_id: state.workspace_id });
  }

  function beginSynchronization({ workspace_id } = {}) {
    const state = stateFor(workspace_id);
    const base = status({ workspace_id: state.workspace_id });
    if (!state.provider_ready || state.watch_state === "unknown" || state.watch_state === "failed") {
      return {
        ...base,
        started: false,
        reason: state.watch_state === "failed"
          ? "change_clock_provider_failed"
          : "change_clock_provider_unavailable",
        token: null,
      };
    }
    if (!state.watch_instance_id || !state.root_identity) {
      return {
        ...base,
        started: false,
        reason: "change_clock_root_identity_unavailable",
        token: null,
      };
    }
    const nonce = idFactory();
    state.watch_state = "synchronizing";
    state.active_sync_nonce = nonce;
    state.active_sync_epoch = state.change_epoch;
    state.last_reason = "exact_baseline_synchronization_started";
    const token = Object.freeze({
      schema_version: WORKSPACE_CHANGE_CLOCK_SCHEMA_VERSION,
      workspace_id: state.workspace_id,
      provider_instance_id: providerInstanceId,
      watch_instance_id: state.watch_instance_id,
      root_identity: state.root_identity,
      change_epoch: state.change_epoch,
      sync_nonce: nonce,
    });
    return {
      ...status({ workspace_id: state.workspace_id }),
      started: true,
      reason: null,
      token,
    };
  }

  function completeSynchronization({ workspace_id, token } = {}) {
    const state = stateFor(workspace_id);
    const fail = (reason) => ({
      ...status({ workspace_id: state.workspace_id }),
      completed: false,
      reason,
    });
    if (!token || typeof token !== "object" || Array.isArray(token)) return fail("synchronization_token_invalid");
    if (!state.provider_ready || state.watch_state !== "synchronizing") return fail("change_clock_not_synchronizing");
    if (token.schema_version !== WORKSPACE_CHANGE_CLOCK_SCHEMA_VERSION) return fail("synchronization_token_schema_mismatch");
    if (token.workspace_id !== state.workspace_id) return fail("synchronization_token_workspace_mismatch");
    if (token.provider_instance_id !== providerInstanceId) return fail("synchronization_token_provider_mismatch");
    if (token.watch_instance_id !== state.watch_instance_id) return fail("synchronization_token_watch_instance_mismatch");
    if (token.root_identity !== state.root_identity) return fail("synchronization_token_root_mismatch");
    if (token.change_epoch !== state.change_epoch || state.active_sync_epoch !== state.change_epoch) {
      return fail("synchronization_token_epoch_mismatch");
    }
    if (token.sync_nonce !== state.active_sync_nonce) return fail("synchronization_token_nonce_mismatch");
    state.baseline_epoch = state.change_epoch;
    state.watch_state = "healthy";
    state.active_sync_nonce = null;
    state.active_sync_epoch = null;
    state.fresh_instance = false;
    state.last_reason = "exact_baseline_synchronized";
    return {
      ...status({ workspace_id: state.workspace_id }),
      completed: true,
      reason: null,
    };
  }

  function noteChange({ workspace_id, reason = "workspace_changed" } = {}) {
    const state = stateFor(workspace_id);
    state.change_epoch += 1;
    state.baseline_epoch = null;
    state.active_sync_nonce = null;
    state.active_sync_epoch = null;
    state.watch_state = state.provider_ready ? "synchronizing" : "unknown";
    state.last_reason = boundedReason(reason, "workspace_changed");
    return status({ workspace_id: state.workspace_id });
  }

  function markUnknown({ workspace_id, reason = "change_clock_unknown", fresh_instance = false } = {}) {
    const state = stateFor(workspace_id);
    state.change_epoch += 1;
    state.provider_ready = false;
    state.watch_state = "unknown";
    state.baseline_epoch = null;
    state.active_sync_nonce = null;
    state.active_sync_epoch = null;
    if (fresh_instance) {
      state.watch_instance_id = null;
      state.root_identity = null;
      state.fresh_instance = true;
    }
    state.last_reason = boundedReason(reason, "change_clock_unknown");
    return status({ workspace_id: state.workspace_id });
  }

  function markFailed({ workspace_id, reason = "change_clock_failed" } = {}) {
    const state = stateFor(workspace_id);
    state.change_epoch += 1;
    state.provider_ready = false;
    state.watch_state = "failed";
    state.baseline_epoch = null;
    state.active_sync_nonce = null;
    state.active_sync_epoch = null;
    state.last_reason = boundedReason(reason, "change_clock_failed");
    return status({ workspace_id: state.workspace_id });
  }

  function markFreshInstance({ workspace_id, reason = "change_clock_fresh_instance" } = {}) {
    return markUnknown({ workspace_id, reason, fresh_instance: true });
  }

  return Object.freeze({
    ownership: "mcp_http_parent_workspace_change_clock",
    provider_instance_id: providerInstanceId,
    status,
    markProviderReady,
    beginSynchronization,
    completeSynchronization,
    noteChange,
    markUnknown,
    markFailed,
    markFreshInstance,
  });
}
