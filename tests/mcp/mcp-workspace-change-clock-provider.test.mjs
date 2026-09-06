import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createWorkspaceChangeClock } from "../../server/src/mcp-workspace-change-clock.mjs";
import { createWorkspaceChangeClockProvider } from "../../server/src/mcp-workspace-change-clock-provider.mjs";

const execFileAsync = promisify(execFile);
const workspaceId = "dev_workspace_shared_repository_v1";
const snapshotFixture = Object.freeze({
  head: "a".repeat(40),
  manifest: Object.freeze([]),
});

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.exitCode = null;
    this.signalCode = null;
    this.killed = false;
  }

  kill(signal = "SIGTERM") {
    this.killed = true;
    this.signalCode = signal;
    return true;
  }
}

function emitJson(child, payload) {
  child.stdout.emit("data", Buffer.from(`${JSON.stringify(payload)}\n`, "utf8"));
}

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function git(root, args) {
  const { stdout } = await execFileAsync(process.platform === "win32" ? "git.exe" : "git", args, {
    cwd: root,
    windowsHide: true,
    shell: false,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return String(stdout).trim();
}

function createHarness({ platform = "win32", fenceTimeoutMs = 250 } = {}) {
  let idSequence = 0;
  let pidSequence = 4000;
  let helperSequence = 0;
  let currentIdentity = "sha256:root-A";
  let gitProjectionMatches = true;
  const children = [];
  const clock = createWorkspaceChangeClock({
    provider_instance_id: "provider-contract-test",
    id_factory: () => `clock-${++idSequence}`,
  });

  const provider = createWorkspaceChangeClockProvider({
    change_clock: clock,
    platform,
    fence_timeout_ms: fenceTimeoutMs,
    start_timeout_ms: 500,
    describe_workspace: async () => ({
      workspace_id: workspaceId,
      repository_root: "/repo",
      watch_roots: ["/repo"],
      identity_paths: ["/repo", "/repo/.git"],
      root_identity: currentIdentity,
      fence_root: "/repo/tests/.tmp/.writer-workbench-watch-fences",
    }),
    root_identity_resolver: async () => currentIdentity,
    validate_git_projection: async (_entry, snapshot) => ({
      ok: snapshot === snapshotFixture && gitProjectionMatches,
      reason: snapshot === snapshotFixture && gitProjectionMatches ? null : "git_projection_changed",
    }),
    spawn_helper: () => {
      const child = new FakeChild(++pidSequence);
      children.push(child);
      return child;
    },
    write_fence: async (filePath) => {
      const child = children.at(-1);
      queueMicrotask(() => emitJson(child, {
        kind: "event",
        sequence: ++helperSequence,
        watch_index: 0,
        root: "/repo",
        change_type: "Created",
        full_path: filePath,
      }));
    },
    remove_fence: async () => {},
  });

  async function readyProvider() {
    const promise = provider.ensureReady({ workspace_id: workspaceId });
    await nextTurn();
    const child = children.at(-1);
    emitJson(child, {
      kind: "ready",
      watcher_count: 1,
      roots: ["/repo"],
      process_id: child.pid,
    });
    const result = await promise;
    assert.equal(result.ready, true);
    return child;
  }

  function emitWorkspaceChange(changeType = "Changed", fullPath = "/repo/file.txt") {
    emitJson(children.at(-1), {
      kind: "event",
      sequence: ++helperSequence,
      watch_index: 0,
      root: "/repo",
      change_type: changeType,
      full_path: fullPath,
    });
  }

  return {
    clock,
    provider,
    children,
    readyProvider,
    emitWorkspaceChange,
    setIdentity(value) { currentIdentity = value; },
    setGitProjectionMatches(value) { gitProjectionMatches = value === true; },
    get identity() { return currentIdentity; },
  };
}

// Unsupported platforms remain fail-closed and never promote the clock.
{
  const h = createHarness({ platform: "linux" });
  const ready = await h.provider.ensureReady({ workspace_id: workspaceId });
  assert.equal(ready.ready, false);
  assert.equal(ready.reason, "unsupported_platform");
  assert.equal(h.clock.status({ workspace_id: workspaceId }).watch_state, "unknown");
  assert.equal(h.children.length, 0);
  h.provider.close();
}

// Concurrent first-use requests share one per-workspace watcher startup.
{
  const h = createHarness();
  const first = h.provider.ensureReady({ workspace_id: workspaceId });
  const second = h.provider.ensureReady({ workspace_id: workspaceId });
  await nextTurn();
  assert.equal(h.children.length, 1);
  const child = h.children[0];
  emitJson(child, {
    kind: "ready",
    watcher_count: 1,
    roots: ["/repo"],
    process_id: child.pid,
  });
  const [firstReady, secondReady] = await Promise.all([first, second]);
  assert.equal(firstReady.ready, true);
  assert.equal(secondReady.ready, true);
  assert.equal(h.children.length, 1);
  h.provider.close();
}

// A ready helper begins a fresh synchronization epoch; a fence is required before completion.
{
  const h = createHarness();
  await h.readyProvider();
  const state = h.clock.status({ workspace_id: workspaceId });
  assert.equal(state.watch_state, "synchronizing");
  assert.equal(state.provider_ready, true);
  assert.equal(state.fresh_instance, true);

  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(begin.started, true);
  const fence = await h.provider.fenceSynchronization({
    workspace_id: workspaceId,
    token: begin.token,
    snapshot: snapshotFixture,
  });
  assert.equal(fence.ok, true);
  assert.equal(fence.git_projection_checked, true);
  assert.equal(fence.fence_count, 2);
  assert.equal(fence.git_projection_check_count, 1);
  assert.equal(fence.git_projection_mismatch_count, 0);

  const completed = h.clock.completeSynchronization({
    workspace_id: workspaceId,
    token: begin.token,
  });
  assert.equal(completed.completed, true);
  assert.equal(completed.watch_state, "healthy");
  assert.equal(completed.synchronized, true);

  // Every authority reuse candidate must cross another in-stream fence.
  const reuseFence = await h.provider.prepareReuse({
    workspace_id: workspaceId,
    snapshot: snapshotFixture,
  });
  assert.equal(reuseFence.ok, true);
  assert.equal(reuseFence.fenced, true);
  assert.equal(reuseFence.git_projection_checked, true);
  assert.equal(reuseFence.fence_count, 4);
  assert.equal(reuseFence.git_projection_check_count, 2);
  assert.equal(reuseFence.git_projection_mismatch_count, 0);
  assert.equal(h.clock.status({ workspace_id: workspaceId }).watch_state, "healthy");
  h.provider.close();
}

// Git metadata that changes the snapshot's projected HEAD/path-state identity
// invalidates reuse even when the external gitdir notification stream is not fenced.
{
  const h = createHarness();
  await h.readyProvider();
  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal((await h.provider.fenceSynchronization({
    workspace_id: workspaceId,
    token: begin.token,
    snapshot: snapshotFixture,
  })).ok, true);
  assert.equal(h.clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token }).completed, true);
  const beforeEpoch = h.clock.status({ workspace_id: workspaceId }).change_epoch;
  h.setGitProjectionMatches(false);
  const reuse = await h.provider.prepareReuse({ workspace_id: workspaceId, snapshot: snapshotFixture });
  assert.equal(reuse.ok, false);
  assert.equal(reuse.reason, "git_projection_changed");
  assert.equal(reuse.git_projection_check_count, 2);
  assert.equal(reuse.git_projection_mismatch_count, 1);
  const changed = h.clock.status({ workspace_id: workspaceId });
  assert.ok(changed.change_epoch > beforeEpoch);
  assert.equal(changed.watch_state, "synchronizing");
  assert.equal(changed.synchronized, false);
  h.provider.close();
}

// Root-level .git metadata descendants are validated by the Git projection,
// while replacement of the .git entry itself is a fresh-instance boundary.
{
  const h = createHarness();
  const child = await h.readyProvider();
  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal((await h.provider.fenceSynchronization({
    workspace_id: workspaceId,
    token: begin.token,
    snapshot: snapshotFixture,
  })).ok, true);
  assert.equal(h.clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token }).completed, true);
  const healthyEpoch = h.clock.status({ workspace_id: workspaceId }).change_epoch;
  h.emitWorkspaceChange("Changed", "/repo/.git/index");
  assert.equal(h.clock.status({ workspace_id: workspaceId }).change_epoch, healthyEpoch);
  h.emitWorkspaceChange("Renamed", "/repo/.git");
  const fresh = h.clock.status({ workspace_id: workspaceId });
  assert.equal(fresh.watch_state, "unknown");
  assert.equal(fresh.fresh_instance, true);
  assert.equal(child.killed, true);
  h.provider.close();
}

// Real filesystem events advance the epoch, while fence-cookie events are excluded from invalidation.
{
  const h = createHarness();
  await h.readyProvider();
  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal((await h.provider.fenceSynchronization({ workspace_id: workspaceId, token: begin.token, snapshot: snapshotFixture })).ok, true);
  assert.equal(h.clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token }).completed, true);
  const healthyEpoch = h.clock.status({ workspace_id: workspaceId }).change_epoch;

  h.emitWorkspaceChange("Changed", "/repo/src/a.mjs");
  const changed = h.clock.status({ workspace_id: workspaceId });
  assert.equal(changed.change_epoch, healthyEpoch + 1);
  assert.equal(changed.watch_state, "synchronizing");
  assert.equal(changed.synchronized, false);

  const reuse = await h.provider.prepareReuse({ workspace_id: workspaceId });
  assert.equal(reuse.ok, true);
  assert.equal(reuse.fenced, false);
  assert.equal(reuse.reason, "baseline_not_synchronized");
  h.provider.close();
}

// A change after synchronization begins invalidates the token before exact publication can promote it.
{
  const h = createHarness();
  await h.readyProvider();
  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  h.emitWorkspaceChange("Created", "/repo/new.txt");
  const fence = await h.provider.fenceSynchronization({ workspace_id: workspaceId, token: begin.token, snapshot: snapshotFixture });
  assert.equal(fence.ok, false);
  assert.equal(fence.reason, "fence_change_epoch_mismatch");
  const completed = h.clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token });
  assert.equal(completed.completed, false);
  h.provider.close();
}

// Kernel-buffer overflow is a fresh-instance boundary, never a recoverable ordinary event.
{
  const h = createHarness();
  const child = await h.readyProvider();
  const begin = h.clock.beginSynchronization({ workspace_id: workspaceId });
  assert.equal(begin.started, true);
  emitJson(child, {
    kind: "overflow",
    watch_index: 0,
    root: "/repo",
    exception_type: "System.IO.InternalBufferOverflowException",
    message: "Too many changes at once.",
  });
  const state = h.clock.status({ workspace_id: workspaceId });
  assert.equal(state.watch_state, "unknown");
  assert.equal(state.provider_ready, false);
  assert.equal(state.fresh_instance, true);
  assert.equal(state.watch_instance_id, null);
  assert.equal(h.provider.status({ workspace_id: workspaceId }).overflow_count, 1);
  assert.equal(child.killed, true);
  assert.equal(h.clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token }).completed, false);
  h.provider.close();
}

// Root identity replacement forces a new helper/watch instance and a new exact baseline.
{
  const h = createHarness();
  const firstChild = await h.readyProvider();
  const firstWatchInstance = h.clock.status({ workspace_id: workspaceId }).watch_instance_id;
  h.setIdentity("sha256:root-B");
  const readyPromise = h.provider.ensureReady({ workspace_id: workspaceId });
  await nextTurn();
  const secondChild = h.children.at(-1);
  assert.notEqual(secondChild, firstChild);
  emitJson(secondChild, {
    kind: "ready",
    watcher_count: 1,
    roots: ["/repo"],
    process_id: secondChild.pid,
  });
  const ready = await readyPromise;
  assert.equal(ready.ready, true);
  const state = h.clock.status({ workspace_id: workspaceId });
  assert.equal(state.root_identity, "sha256:root-B");
  assert.notEqual(state.watch_instance_id, firstWatchInstance);
  assert.equal(state.watch_state, "synchronizing");
  assert.equal(state.fresh_instance, true);
  h.provider.close();
}

// A fence timeout is fail-closed: the helper is discarded and the clock returns to fresh/unknown.
{
  let child;
  const clock = createWorkspaceChangeClock({ provider_instance_id: "timeout-provider" });
  const provider = createWorkspaceChangeClockProvider({
    change_clock: clock,
    platform: "win32",
    fence_timeout_ms: 100,
    start_timeout_ms: 500,
    describe_workspace: async () => ({
      workspace_id: workspaceId,
      repository_root: "/repo",
      watch_roots: ["/repo"],
      root_identity: "sha256:timeout-root",
      fence_root: "/repo/tests/.tmp/.writer-workbench-watch-fences",
    }),
    root_identity_resolver: async () => "sha256:timeout-root",
    validate_git_projection: async () => ({ ok: true, reason: null }),
    spawn_helper: () => {
      child = new FakeChild(9001);
      return child;
    },
    write_fence: async () => {},
    remove_fence: async () => {},
  });
  const readyPromise = provider.ensureReady({ workspace_id: workspaceId });
  await nextTurn();
  emitJson(child, { kind: "ready", watcher_count: 1, roots: ["/repo"], process_id: child.pid });
  await readyPromise;
  const begin = clock.beginSynchronization({ workspace_id: workspaceId });
  const fence = await provider.fenceSynchronization({ workspace_id: workspaceId, token: begin.token, snapshot: snapshotFixture });
  assert.equal(fence.ok, false);
  assert.equal(fence.reason, "watcher_fence_timeout");
  const state = clock.status({ workspace_id: workspaceId });
  assert.equal(state.watch_state, "unknown");
  assert.equal(state.fresh_instance, true);
  assert.equal(child.killed, true);
  provider.close();
}

// Windows production smoke: launch the real PowerShell/.NET watcher, cross a
// fence, and verify that a real recursive filesystem mutation advances the epoch.
if (process.platform === "win32") {
  const temp = await mkdtemp(path.join(os.tmpdir(), "writer-workbench-watch-provider-"));
  const root = path.join(temp, "武裝監看");
  const fenceRoot = path.join(root, "tests", ".tmp", ".writer-workbench-watch-fences");
  await mkdir(root, { recursive: true });
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Watcher Regression"]);
  await git(root, ["config", "user.email", "watcher@test.invalid"]);
  await writeFile(path.join(root, "baseline.txt"), "baseline\n", "utf8");
  await git(root, ["add", "baseline.txt"]);
  await git(root, ["commit", "-m", "baseline"]);
  const baselineSnapshot = {
    head: await git(root, ["rev-parse", "HEAD"]),
    manifest: [],
  };
  await mkdir(fenceRoot, { recursive: true });
  const clock = createWorkspaceChangeClock({ provider_instance_id: "windows-live-provider" });
  const identity = "sha256:windows-live-root";
  const provider = createWorkspaceChangeClockProvider({
    change_clock: clock,
    platform: "win32",
    fence_timeout_ms: 2_000,
    start_timeout_ms: 4_000,
    describe_workspace: async () => ({
      workspace_id: workspaceId,
      repository_root: root,
      watch_roots: [root],
      root_identity: identity,
      fence_root: fenceRoot,
    }),
    root_identity_resolver: async () => identity,
  });
  try {
    const ready = await provider.ensureReady({ workspace_id: workspaceId });
    assert.equal(ready.ready, true, ready.last_error ?? "real Windows watcher did not become ready");
    assert.equal(ready.backend, "dotnet_filesystemwatcher");

    const begin = clock.beginSynchronization({ workspace_id: workspaceId });
    assert.equal(begin.started, true);
    const fenced = await provider.fenceSynchronization({ workspace_id: workspaceId, token: begin.token, snapshot: baselineSnapshot });
    assert.equal(fenced.ok, true, fenced.reason ?? "real Windows watcher fence failed");
    assert.equal(fenced.git_projection_checked, true);
    assert.equal(clock.completeSynchronization({ workspace_id: workspaceId, token: begin.token }).completed, true);
    const reusable = await provider.prepareReuse({ workspace_id: workspaceId, snapshot: baselineSnapshot });
    assert.equal(reusable.ok, true, reusable.reason ?? "real Windows watcher reuse fence failed");
    assert.equal(reusable.fenced, true);
    assert.equal(reusable.git_projection_checked, true);
    const beforeEpoch = clock.status({ workspace_id: workspaceId }).change_epoch;

    await writeFile(path.join(root, "實際變更.txt"), "changed\n", "utf8");
    const deadline = Date.now() + 3_000;
    while (clock.status({ workspace_id: workspaceId }).change_epoch === beforeEpoch && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const changed = clock.status({ workspace_id: workspaceId });
    assert.ok(changed.change_epoch > beforeEpoch, "real Windows watcher did not observe the filesystem mutation");
    assert.equal(changed.watch_state, "synchronizing");
  } finally {
    provider.close();
    await rm(temp, { recursive: true, force: true });
  }
}

console.log("Workspace change clock provider tests passed.");
