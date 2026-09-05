import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";

import {
  createWorkspaceSnapshotAuthority,
  normalizeExactWorkspaceSnapshot,
} from "../../server/src/mcp-workspace-snapshot-authority.mjs";
import { createWorkspaceChangeClock } from "../../server/src/mcp-workspace-change-clock.mjs";
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

// Unknown change-clock state may store an exact snapshot but must never authorize reuse.
{
  const changeClock = createWorkspaceChangeClock({ provider_instance_id: "authority-unknown" });
  const authority = createWorkspaceSnapshotAuthority({ change_clock: changeClock });
  const snapshot = exactSnapshot("unknown watcher");
  const published = authority.publishExact({ workspace_id: workspaceId, snapshot, source_pid: 101 });
  assert.equal(published.stored, true);
  assert.equal(published.reusable, false);
  assert.equal(published.synchronization_completed, false);
  const reuse = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(reuse.hit, false);
  assert.equal(reuse.reason, "watcher_unknown");
  assert.equal(authority.status({ workspace_id: workspaceId }).snapshot_present, true);
  assert.equal(authority.status({ workspace_id: workspaceId }).snapshot_reusable, false);
}

// Provider readiness alone is insufficient: exact publish must carry the unchanged synchronization token.
{
  let ids = 0;
  const changeClock = createWorkspaceChangeClock({
    provider_instance_id: "authority-sync",
    id_factory: () => `authority-sync-${++ids}`,
  });
  const authority = createWorkspaceSnapshotAuthority({ change_clock: changeClock });
  const snapshot = exactSnapshot("watch transition");
  changeClock.markProviderReady({ workspace_id: workspaceId, root_identity: "root:authority" });
  const unsynchronized = authority.publishExact({ workspace_id: workspaceId, snapshot, source_pid: 102 });
  assert.equal(unsynchronized.reusable, false);
  const stale = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(stale.hit, false);
  assert.equal(stale.reason, "watcher_synchronizing");

  const begin = authority.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(begin.started, true);
  changeClock.noteChange({ workspace_id: workspaceId, reason: "mid_capture_change" });
  const raced = authority.publishExact({
    workspace_id: workspaceId,
    snapshot,
    source_pid: 102,
    synchronization_token: begin.token,
  });
  assert.equal(raced.stored, true);
  assert.equal(raced.reusable, false);
  assert.equal(raced.synchronization_completed, false);
  assert.match(raced.synchronization_reason, /epoch|synchronizing/u);

  const retry = authority.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(retry.started, true);
  const fresh = authority.publishExact({
    workspace_id: workspaceId,
    snapshot,
    source_pid: 102,
    synchronization_token: retry.token,
  });
  assert.equal(fresh.reusable, true);
  assert.equal(fresh.synchronization_completed, true);
  const reuse = authority.tryReuse({ workspace_id: workspaceId });
  assert.equal(reuse.hit, true);
  assert.equal(reuse.snapshot.workspace_snapshot_id, snapshot.workspace_snapshot_id);
}

// The parent authority survives child replacement: child A establishes an exact
// synchronized baseline, child B reuses it, and any mutation/fresh instance fails closed.
{
  let ids = 0;
  const changeClock = createWorkspaceChangeClock({
    provider_instance_id: "authority-cross-child",
    id_factory: () => `authority-cross-child-${++ids}`,
  });
  const authority = createWorkspaceSnapshotAuthority({ change_clock: changeClock });
  changeClock.markProviderReady({ workspace_id: workspaceId, root_identity: "root:cross-child" });
  const childA = ipcPair(201);
  const childB = ipcPair(202);
  const detachA = attachWorkspaceSnapshotAuthorityIpc(childA.parentView, authority);
  const detachB = attachWorkspaceSnapshotAuthorityIpc(childB.parentView, authority);
  const clientA = createWorkspaceSnapshotAuthorityIpcClient({ process_like: childA.childView, timeout_ms: 1_000 });
  const clientB = createWorkspaceSnapshotAuthorityIpcClient({ process_like: childB.childView, timeout_ms: 1_000 });
  const snapshotA = exactSnapshot("child A");
  try {
    const syncA = await clientA.beginSynchronization(workspaceId);
    assert.equal(syncA.started, true);
    const publishedA = await clientA.publishExact(workspaceId, snapshotA, syncA.token);
    assert.equal(publishedA.stored, true);
    assert.equal(publishedA.reusable, true);
    assert.equal(publishedA.synchronization_completed, true);

    const reuseByB = await clientB.tryReuse(workspaceId);
    assert.equal(reuseByB.hit, true);
    assert.equal(reuseByB.snapshot.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(reuseByB.source_pid, 201);

    await clientB.invalidate(workspaceId, "controlled mutation");
    const invalidated = await clientA.tryReuse(workspaceId);
    assert.equal(invalidated.hit, false);
    assert.equal(invalidated.reason, "watcher_synchronizing");

    const snapshotB = exactSnapshot("child B");
    const syncB = await clientB.beginSynchronization(workspaceId);
    assert.equal(syncB.started, true);
    const publishedB = await clientB.publishExact(workspaceId, snapshotB, syncB.token);
    assert.equal(publishedB.reusable, true);
    const reuseByA = await clientA.tryReuse(workspaceId);
    assert.equal(reuseByA.hit, true);
    assert.equal(reuseByA.snapshot.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
    assert.equal(reuseByA.source_pid, 202);

    changeClock.markFreshInstance({ workspace_id: workspaceId, reason: "watcher restart" });
    const freshInstance = await clientA.tryReuse(workspaceId);
    assert.equal(freshInstance.hit, false);
    assert.equal(freshInstance.reason, "watcher_unknown");
    const staleSync = await clientA.beginSynchronization(workspaceId);
    assert.equal(staleSync.started, false);
    assert.equal(staleSync.reason, "change_clock_provider_unavailable");
  } finally {
    detachA();
    detachB();
  }
}

console.log("Workspace snapshot authority tests passed.");
