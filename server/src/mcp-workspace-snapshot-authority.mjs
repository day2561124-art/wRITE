import { createHash } from "node:crypto";

export const WORKSPACE_SNAPSHOT_AUTHORITY_SCHEMA_VERSION = 1;
export const WORKSPACE_SNAPSHOT_AUTHORITY_MAX_WORKSPACES = 32;
export const WORKSPACE_SNAPSHOT_AUTHORITY_MAX_ARTIFACTS = 20_000;
export const WORKSPACE_SNAPSHOT_AUTHORITY_MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

const workspaceIdPattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const artifactStateSet = new Set(["modified", "added", "deleted", "untracked"]);
const artifactTypeSet = new Set([null, "file", "directory"]);
const watchStateSet = new Set(["unknown", "healthy", "unhealthy"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON does not allow non-finite numbers.");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("Canonical JSON supports JSON values only.");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeWorkspaceId(value) {
  if (typeof value !== "string" || !workspaceIdPattern.test(value)) {
    throw new Error("workspace_id is invalid.");
  }
  return value;
}

function normalizeManifestEntry(value) {
  if (!isObject(value)) throw new Error("Snapshot manifest entries must be objects.");
  if (typeof value.path !== "string" || !value.path || value.path.length > 4096 || value.path.includes("\u0000")) {
    throw new Error("Snapshot manifest path is invalid.");
  }
  if (!artifactStateSet.has(value.state)) throw new Error("Snapshot manifest state is invalid.");
  const artifactType = value.artifact_type ?? null;
  if (!artifactTypeSet.has(artifactType)) throw new Error("Snapshot manifest artifact_type is invalid.");
  const sha256 = value.sha256 ?? null;
  if (sha256 !== null && (typeof sha256 !== "string" || !sha256Pattern.test(sha256))) {
    throw new Error("Snapshot manifest sha256 is invalid.");
  }
  const bytes = value.bytes ?? null;
  if (bytes !== null && (!Number.isSafeInteger(bytes) || bytes < 0)) {
    throw new Error("Snapshot manifest bytes is invalid.");
  }
  if (value.state === "deleted" && (artifactType !== null || sha256 !== null || bytes !== null)) {
    throw new Error("Deleted snapshot entries must have null artifact metadata.");
  }
  if (artifactType === "directory" && (sha256 !== null || bytes !== null)) {
    throw new Error("Directory snapshot entries must not have file digest metadata.");
  }
  if (artifactType === null && value.state !== "deleted") {
    throw new Error("Existing snapshot entries require an artifact_type.");
  }
  return {
    path: value.path,
    state: value.state,
    sha256,
    bytes,
    artifact_type: artifactType,
  };
}

function structuralDiagnostics(manifest) {
  let hashedArtifactCount = 0;
  let hashedBytes = 0;
  let unhashedFileCount = 0;
  let directoryCount = 0;
  let modifiedCount = 0;
  let addedCount = 0;
  let deletedCount = 0;
  let untrackedCount = 0;
  for (const entry of manifest) {
    if (entry.sha256 !== null) {
      hashedArtifactCount += 1;
      hashedBytes += entry.bytes ?? 0;
    } else if (entry.artifact_type === "file") unhashedFileCount += 1;
    else if (entry.artifact_type === "directory") directoryCount += 1;
    if (entry.state === "modified") modifiedCount += 1;
    else if (entry.state === "added") addedCount += 1;
    else if (entry.state === "deleted") deletedCount += 1;
    else if (entry.state === "untracked") untrackedCount += 1;
  }
  return {
    hashed_artifact_count: hashedArtifactCount,
    hashed_bytes: hashedBytes,
    unhashed_file_count: unhashedFileCount,
    directory_count: directoryCount,
    modified_count: modifiedCount,
    added_count: addedCount,
    deleted_count: deletedCount,
    untracked_count: untrackedCount,
  };
}

export function normalizeExactWorkspaceSnapshot(snapshot) {
  if (!isObject(snapshot)) throw new Error("workspace snapshot must be an object.");
  const head = String(snapshot.head ?? "").toLowerCase();
  const workspaceSnapshotId = String(snapshot.workspace_snapshot_id ?? "").toLowerCase();
  if (!gitSha1Pattern.test(head)) throw new Error("workspace snapshot head is invalid.");
  if (!sha256Pattern.test(workspaceSnapshotId)) throw new Error("workspace_snapshot_id is invalid.");
  if (!Array.isArray(snapshot.manifest) || snapshot.manifest.length > WORKSPACE_SNAPSHOT_AUTHORITY_MAX_ARTIFACTS) {
    throw new Error("workspace snapshot manifest exceeds the authority limit.");
  }
  const manifest = snapshot.manifest.map(normalizeManifestEntry);
  if (!Number.isSafeInteger(snapshot.changed_artifact_count) || snapshot.changed_artifact_count !== manifest.length) {
    throw new Error("changed_artifact_count does not match the snapshot manifest.");
  }
  const canonicalPayload = canonicalJson({ head, manifest });
  if (Buffer.byteLength(canonicalPayload, "utf8") > WORKSPACE_SNAPSHOT_AUTHORITY_MAX_SNAPSHOT_BYTES) {
    throw new Error("workspace snapshot exceeds the authority byte limit.");
  }
  const recomputed = sha256Text(canonicalPayload);
  if (recomputed !== workspaceSnapshotId) {
    throw new Error("workspace snapshot identity does not match canonical {head,manifest}.");
  }
  return {
    workspace_snapshot_id: workspaceSnapshotId,
    head,
    changed_artifact_count: manifest.length,
    manifest,
    structural_diagnostics: structuralDiagnostics(manifest),
  };
}

export function createWorkspaceSnapshotAuthority(options = {}) {
  const maxWorkspaces = options.max_workspaces ?? WORKSPACE_SNAPSHOT_AUTHORITY_MAX_WORKSPACES;
  if (!Number.isSafeInteger(maxWorkspaces) || maxWorkspaces < 1 || maxWorkspaces > 1024) {
    throw new Error("max_workspaces must be an integer between 1 and 1024.");
  }
  const clock = typeof options.clock === "function" ? options.clock : () => Date.now();
  const states = new Map();
  let authorityEpoch = 0;

  function stateFor(workspaceId) {
    const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
    let state = states.get(normalizedWorkspaceId);
    if (!state) {
      state = {
        workspace_id: normalizedWorkspaceId,
        watch_state: "unknown",
        workspace_epoch: 0,
        snapshot: null,
        snapshot_epoch: null,
        published_at_ms: null,
        source_pid: null,
        invalidation_reason: "authority_initialized_without_watcher",
      };
      states.set(normalizedWorkspaceId, state);
      enforceCapacity();
    } else {
      states.delete(normalizedWorkspaceId);
      states.set(normalizedWorkspaceId, state);
    }
    return state;
  }

  function enforceCapacity() {
    while (states.size > maxWorkspaces) {
      const oldest = states.keys().next().value;
      states.delete(oldest);
    }
  }

  function invalidate({ workspace_id, reason = "workspace_invalidated" } = {}) {
    const state = stateFor(workspace_id);
    authorityEpoch += 1;
    state.workspace_epoch += 1;
    state.invalidation_reason = String(reason || "workspace_invalidated").slice(0, 160);
    return {
      schema_version: WORKSPACE_SNAPSHOT_AUTHORITY_SCHEMA_VERSION,
      workspace_id: state.workspace_id,
      authority_epoch: authorityEpoch,
      workspace_epoch: state.workspace_epoch,
      watch_state: state.watch_state,
      reusable: false,
      reason: state.invalidation_reason,
    };
  }

  function setWatchState({ workspace_id, watch_state, reason = null } = {}) {
    if (!watchStateSet.has(watch_state)) throw new Error("watch_state is invalid.");
    const state = stateFor(workspace_id);
    if (state.watch_state !== watch_state) {
      authorityEpoch += 1;
      state.workspace_epoch += 1;
      state.watch_state = watch_state;
      state.invalidation_reason = reason
        ? String(reason).slice(0, 160)
        : `watch_state_changed_to_${watch_state}`;
    }
    return status({ workspace_id: state.workspace_id });
  }

  function publishExact({ workspace_id, snapshot, source_pid = null } = {}) {
    const state = stateFor(workspace_id);
    const exact = normalizeExactWorkspaceSnapshot(snapshot);
    state.snapshot = exact;
    state.snapshot_epoch = state.workspace_epoch;
    state.published_at_ms = clock();
    state.source_pid = Number.isSafeInteger(source_pid) && source_pid > 0 ? source_pid : null;
    state.invalidation_reason = null;
    authorityEpoch += 1;
    return {
      schema_version: WORKSPACE_SNAPSHOT_AUTHORITY_SCHEMA_VERSION,
      workspace_id: state.workspace_id,
      authority_epoch: authorityEpoch,
      workspace_epoch: state.workspace_epoch,
      watch_state: state.watch_state,
      stored: true,
      reusable: state.watch_state === "healthy",
      workspace_snapshot_id: exact.workspace_snapshot_id,
      head: exact.head,
      changed_artifact_count: exact.changed_artifact_count,
      published_at_ms: state.published_at_ms,
    };
  }

  function tryReuse({ workspace_id } = {}) {
    const state = stateFor(workspace_id);
    const base = {
      schema_version: WORKSPACE_SNAPSHOT_AUTHORITY_SCHEMA_VERSION,
      workspace_id: state.workspace_id,
      authority_epoch: authorityEpoch,
      workspace_epoch: state.workspace_epoch,
      watch_state: state.watch_state,
    };
    if (state.watch_state !== "healthy") {
      return { ...base, hit: false, reason: `watcher_${state.watch_state}` };
    }
    if (!state.snapshot) return { ...base, hit: false, reason: "snapshot_not_published" };
    if (state.snapshot_epoch !== state.workspace_epoch) {
      return { ...base, hit: false, reason: state.invalidation_reason ?? "snapshot_invalidated" };
    }
    return {
      ...base,
      hit: true,
      reason: null,
      snapshot: structuredClone(state.snapshot),
      published_at_ms: state.published_at_ms,
      source_pid: state.source_pid,
    };
  }

  function status({ workspace_id } = {}) {
    const state = stateFor(workspace_id);
    return {
      schema_version: WORKSPACE_SNAPSHOT_AUTHORITY_SCHEMA_VERSION,
      ownership: "mcp_http_parent_process_ephemeral_memory",
      workspace_id: state.workspace_id,
      authority_epoch: authorityEpoch,
      workspace_epoch: state.workspace_epoch,
      watch_state: state.watch_state,
      snapshot_present: state.snapshot !== null,
      snapshot_epoch: state.snapshot_epoch,
      snapshot_reusable: Boolean(
        state.snapshot
        && state.watch_state === "healthy"
        && state.snapshot_epoch === state.workspace_epoch
      ),
      workspace_snapshot_id: state.snapshot?.workspace_snapshot_id ?? null,
      published_at_ms: state.published_at_ms,
      source_pid: state.source_pid,
      invalidation_reason: state.invalidation_reason,
    };
  }

  return Object.freeze({
    ownership: "mcp_http_parent_workspace_snapshot_authority",
    publishExact,
    tryReuse,
    invalidate,
    status,
    // Server-only seam. It is deliberately not exposed by the child IPC protocol.
    setWatchState,
  });
}
