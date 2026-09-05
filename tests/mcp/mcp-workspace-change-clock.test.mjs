import assert from "node:assert/strict";

import { createWorkspaceChangeClock } from "../../server/src/mcp-workspace-change-clock.mjs";

const workspaceId = "dev_workspace_shared_repository_v1";
let idSequence = 0;
const clock = createWorkspaceChangeClock({
  provider_instance_id: "provider-test-instance",
  id_factory: () => `clock-id-${++idSequence}`,
});

// Without a production provider, the clock must fail closed and cannot mint a baseline token.
{
  const initial = clock.status({ workspace_id: workspaceId });
  assert.equal(initial.watch_state, "unknown");
  assert.equal(initial.provider_ready, false);
  assert.equal(initial.synchronized, false);
  assert.equal(initial.fresh_instance, true);
  const begin = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(begin.started, false);
  assert.equal(begin.reason, "change_clock_provider_unavailable");
  assert.equal(begin.token, null);
}

// Provider readiness begins a fresh synchronization epoch; only an unchanged token can promote healthy.
let firstToken;
{
  const ready = clock.markProviderReady({
    workspace_id: workspaceId,
    root_identity: "root:test:A",
  });
  assert.equal(ready.watch_state, "synchronizing");
  assert.equal(ready.provider_ready, true);
  assert.equal(ready.change_epoch, 1);
  assert.equal(ready.baseline_epoch, null);
  assert.equal(ready.fresh_instance, true);
  assert.equal(typeof ready.watch_instance_id, "string");

  const begin = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(begin.started, true);
  firstToken = begin.token;
  assert.equal(firstToken.provider_instance_id, "provider-test-instance");
  assert.equal(firstToken.change_epoch, 1);
  assert.equal(firstToken.root_identity, "root:test:A");

  const completed = clock.completeSynchronization({
    workspace_id: workspaceId,
    token: firstToken,
  });
  assert.equal(completed.completed, true);
  assert.equal(completed.watch_state, "healthy");
  assert.equal(completed.synchronized, true);
  assert.equal(completed.baseline_epoch, completed.change_epoch);
  assert.equal(completed.fresh_instance, false);
}

// Any observed change advances the monotonic epoch, invalidates the baseline, and rejects stale tokens.
{
  const changed = clock.noteChange({ workspace_id: workspaceId, reason: "file_write" });
  assert.equal(changed.change_epoch, 2);
  assert.equal(changed.watch_state, "synchronizing");
  assert.equal(changed.synchronized, false);
  assert.equal(changed.baseline_epoch, null);

  const stale = clock.completeSynchronization({
    workspace_id: workspaceId,
    token: firstToken,
  });
  assert.equal(stale.completed, false);
  assert.match(stale.reason, /token|synchronizing/u);

  const next = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(next.started, true);
  assert.equal(next.token.change_epoch, 2);
  const completed = clock.completeSynchronization({ workspace_id: workspaceId, token: next.token });
  assert.equal(completed.completed, true);
  assert.equal(completed.watch_state, "healthy");
}

// Unknown/error state is fail-closed and requires an explicit provider-ready transition before resync.
{
  const beforeUnknown = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(beforeUnknown.started, true);
  const unknown = clock.markUnknown({ workspace_id: workspaceId, reason: "watch_overflow" });
  assert.equal(unknown.watch_state, "unknown");
  assert.equal(unknown.provider_ready, false);
  assert.equal(unknown.synchronized, false);
  const stale = clock.completeSynchronization({ workspace_id: workspaceId, token: beforeUnknown.token });
  assert.equal(stale.completed, false);
  const blocked = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(blocked.started, false);
  assert.equal(blocked.reason, "change_clock_provider_unavailable");
}

// Fresh-instance semantics drop the previous watch/root identity and force a new exact baseline.
{
  const ready = clock.markProviderReady({
    workspace_id: workspaceId,
    root_identity: "root:test:A",
  });
  const previousWatchInstance = ready.watch_instance_id;
  const begin = clock.beginSynchronization({ workspace_id: workspaceId });
  const fresh = clock.markFreshInstance({ workspace_id: workspaceId, reason: "watcher_restart" });
  assert.equal(fresh.watch_state, "unknown");
  assert.equal(fresh.provider_ready, false);
  assert.equal(fresh.watch_instance_id, null);
  assert.equal(fresh.root_identity, null);
  assert.equal(fresh.fresh_instance, true);
  const stale = clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token });
  assert.equal(stale.completed, false);

  const restarted = clock.markProviderReady({
    workspace_id: workspaceId,
    root_identity: "root:test:A",
  });
  assert.notEqual(restarted.watch_instance_id, previousWatchInstance);
  const restartBegin = clock.beginSynchronization({ workspace_id: workspaceId });
  const restartCompleted = clock.completeSynchronization({ workspace_id: workspaceId, token: restartBegin.token });
  assert.equal(restartCompleted.completed, true);
  assert.equal(restartCompleted.fresh_instance, false);
}

// Root replacement and provider failure both invalidate the previous baseline.
{
  const rootChanged = clock.markProviderReady({
    workspace_id: workspaceId,
    root_identity: "root:test:B",
    reason: "root_identity_changed",
  });
  assert.equal(rootChanged.watch_state, "synchronizing");
  assert.equal(rootChanged.root_identity, "root:test:B");
  assert.equal(rootChanged.synchronized, false);
  const failed = clock.markFailed({ workspace_id: workspaceId, reason: "watch_backend_failed" });
  assert.equal(failed.watch_state, "failed");
  assert.equal(failed.provider_ready, false);
  assert.equal(failed.synchronized, false);
  const blocked = clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(blocked.started, false);
  assert.equal(blocked.reason, "change_clock_provider_failed");
}

console.log("Workspace change clock tests passed.");
