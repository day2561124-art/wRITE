import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";

import {
  createWorkspaceSnapshotAuthority,
  normalizeExactWorkspaceSnapshot,
} from "../../server/src/mcp-workspace-snapshot-authority.mjs";
import {
  attachWorkspaceSnapshotAuthorityIpc,
  createWorkspaceSnapshotAuthorityIpcClient,
} from "../../server/src/mcp-workspace-snapshot-authority-ipc.mjs";

const workspaceId = "dev_workspace_shared_repository_v1";

function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactSnapshot(content = "A") {
  const bytes = Buffer.byteLength(content, "utf8");
  const head = "a".repeat(40);
  const manifest = [{
    path: "fixture.txt",
    state: "modified",
    sha256: sha256(content),
    bytes,
    artifact_type: "file",
  }];
  return {
    workspace_snapshot_id: sha256(canonicalJson({ head, manifest })),
    head,
    changed_artifact_count: manifest.length,
    manifest,
  };
}

function ipcPair(childPid) {
  const parentView = new EventEmitter();
  const childView = new EventEmitter();
  parentView.pid = childPid;
  parentView.connected = true;
  childView.connected = true;
  parentView.send = (message, callback) => {
    queueMicrotask(() => childView.emit("message", structuredClone(message)));
    callback?.(null);
    return true;
  };
  childView.send = (message, callback) => {
    queueMicrotask(() => parentView.emit("message", structuredClone(message)));
    callback?.(null);
    return true;
  };
  return { parentView, childView };
}

// Exact snapshot identity remains canonical {head,manifest} and malformed IDs fail closed.
{
  const snapshot = exactSnapshot("identity");
  const normalized = normalizeExactWorkspaceSnapshot(snapshot);
  assert.equal(normalized.workspace_snapshot_id, snapshot.workspace_snapshot_id);
  assert.deepEqual(normalized.manifest, snapshot.manifest);
  await assert.rejects(async () => normalizeExactWorkspaceSnapshot({
    ...snapshot,
    workspace_snapshot_id: "0".repeat(64),
  }), /identity does not match/u);
}

// Unknown watcher state may store an exact snapshot but must never authorize reuse.
{
  const authority = createWorkspaceSnapshotAuthority();
  const snapshot = exactSnapshot("unknown watcher");
  const published = authority.publishExact({ workspace_id: workspaceId, snapshot, source_pid: 101 });
  assert.equal(published.stored, true);
  assert.equal(published.reusable, false);
  const reuse = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(reuse.hit, false);
  assert.equal(reuse.reason, "watcher_unknown");
  assert.equal(authority.status({ workspace_id: workspaceId }).snapshot_present, true);
  assert.equal(authority.status({ workspace_id: workspaceId }).snapshot_reusable, false);
}

// A watch-state transition invalidates any snapshot captured before the healthy epoch.
{
  const authority = createWorkspaceSnapshotAuthority();
  const snapshot = exactSnapshot("watch transition");
  authority.publishExact({ workspace_id: workspaceId, snapshot, source_pid: 102 });
  authority.setWatchState({ workspace_id: workspaceId, watch_state: "healthy" });
  const stale = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(stale.hit, false);
  assert.equal(stale.reason, "watch_state_changed_to_healthy");
  const fresh = authority.publishExact({ workspace_id: workspaceId, snapshot, source_pid: 102 });
  assert.equal(fresh.reusable, true);
  const reuse = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(reuse.hit, true);
  assert.equal(reuse.snapshot.workspace_snapshot_id, snapshot.workspace_snapshot_id);
}

// The parent authority survives child replacement: a snapshot published by child A
// can be reused by child B only while the server-owned watch epoch remains healthy.
{
  const authority = createWorkspaceSnapshotAuthority();
  authority.setWatchState({ workspace_id: workspaceId, watch_state: "healthy" });
  const childA = ipcPair(201);
  const childB = ipcPair(202);
  const detachA = attachWorkspaceSnapshotAuthorityIpc(childA.parentView, authority);
  const detachB = attachWorkspaceSnapshotAuthorityIpc(childB.parentView, authority);
  const clientA = createWorkspaceSnapshotAuthorityIpcClient({ process_like: childA.childView, timeout_ms: 1_000 });
  const clientB = createWorkspaceSnapshotAuthorityIpcClient({ process_like: childB.childView, timeout_ms: 1_000 });
  const snapshotA = exactSnapshot("child A");
  try {
    const publishedA = await clientA.publishExact(workspaceId, snapshotA);
    assert.equal(publishedA.stored, true);
    assert.equal(publishedA.reusable, true);

    const reuseByB = await clientB.tryReuse(workspaceId);
    assert.equal(reuseByB.hit, true);
    assert.equal(reuseByB.snapshot.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(reuseByB.source_pid, 201);

    await clientB.invalidate(workspaceId, "controlled mutation");
    const invalidated = await clientA.tryReuse(workspaceId);
    assert.equal(invalidated.hit, false);
    assert.equal(invalidated.reason, "controlled mutation");

    const snapshotB = exactSnapshot("child B");
    await clientB.publishExact(workspaceId, snapshotB);
    const reuseByA = await clientA.tryReuse(workspaceId);
    assert.equal(reuseByA.hit, true);
    assert.equal(reuseByA.snapshot.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
    assert.equal(reuseByA.source_pid, 202);

    authority.setWatchState({ workspace_id: workspaceId, watch_state: "unhealthy", reason: "watcher restart" });
    const unhealthy = await clientA.tryReuse(workspaceId);
    assert.equal(unhealthy.hit, false);
    assert.equal(unhealthy.reason, "watcher_unhealthy");
  } finally {
    detachA();
    detachB();
  }
}

console.log("Workspace snapshot authority tests passed.");
