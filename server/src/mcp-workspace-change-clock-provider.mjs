import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, realpath, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  controlledProcessEnvironment,
  terminateProcessTree,
} from "./process-control.mjs";
import { projectRoot } from "./project-paths.mjs";

const execFileAsync = promisify(execFile);
const workspaceIdPattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const DEFAULT_FENCE_TIMEOUT_MS = 2_000;
const DEFAULT_START_TIMEOUT_MS = 4_000;
const MAX_HELPER_LINE_BYTES = 128 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const helperScriptPath = path.join(projectRoot, "scripts", "mcp-workspace-change-watch.ps1");
const fenceRelativeDirectory = path.join("tests", ".tmp", ".writer-workbench-watch-fences");
const fenceProbeRelativePath = path.join(fenceRelativeDirectory, ".probe");

function assertWorkspaceId(value) {
  if (typeof value !== "string" || !workspaceIdPattern.test(value)) {
    throw new Error("workspace_id is invalid.");
  }
  return value;
}

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizePathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function boundedReason(value, fallback) {
  return String(value || fallback).slice(0, 160);
}

async function defaultResolveWorkspace(workspaceId) {
  const { resolveDevWorkspaceExecutionContext } = await import("./mcp-development-workstream-tools.mjs");
  return resolveDevWorkspaceExecutionContext({ workspace_id: workspaceId }, { mutation: false });
}

async function runGit(repositoryRoot, args) {
  const { stdout } = await execFileAsync(
    fixedGitExecutable,
    ["--no-pager", "-c", "core.fsmonitor=false", ...args],
    {
      cwd: repositoryRoot,
      env: controlledProcessEnvironment({
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_PAGER: "cat",
        PAGER: "cat",
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
      }),
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  return String(stdout).trim();
}

function parsePorcelainPath(line) {
  const raw = line.slice(3);
  const arrowIndex = raw.lastIndexOf(" -> ");
  return (arrowIndex === -1 ? raw : raw.slice(arrowIndex + 4)).replaceAll("\\", "/");
}

function projectedStateFromStatus(line) {
  const xy = line.slice(0, 2);
  if (xy === "??") return "untracked";
  if (xy.includes("D")) return "deleted";
  if (xy.includes("A")) return "added";
  return "modified";
}

function snapshotGitProjection(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.manifest)) {
    throw new Error("workspace snapshot Git projection is unavailable.");
  }
  const head = String(snapshot.head ?? "").toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(head)) throw new Error("workspace snapshot Git projection HEAD is invalid.");
  const entries = snapshot.manifest.map((entry) => ({
    path: String(entry?.path ?? "").replaceAll("\\", "/"),
    state: String(entry?.state ?? ""),
  }));
  if (entries.some((entry) => !entry.path || !["modified", "added", "deleted", "untracked"].includes(entry.state))) {
    throw new Error("workspace snapshot Git projection manifest is invalid.");
  }
  entries.sort((left, right) => left.path.localeCompare(right.path) || left.state.localeCompare(right.state));
  return { head, entries };
}

async function currentGitProjection(repositoryRoot) {
  const headBefore = (await runGit(repositoryRoot, ["rev-parse", "--verify", "HEAD"])).toLowerCase();
  const status = await runGit(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const headAfter = (await runGit(repositoryRoot, ["rev-parse", "--verify", "HEAD"])).toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(headBefore) || !/^[a-f0-9]{40}$/u.test(headAfter)) {
    throw new Error("workspace Git projection HEAD is invalid.");
  }
  if (headBefore !== headAfter) throw new Error("workspace Git projection changed while being read.");
  const normalizedHead = headAfter;
  const entries = status.split(/\r?\n/u).filter(Boolean).map((line) => ({
    path: parsePorcelainPath(line),
    state: projectedStateFromStatus(line),
  }));
  entries.sort((left, right) => left.path.localeCompare(right.path) || left.state.localeCompare(right.state));
  return { head: normalizedHead, entries };
}

async function defaultValidateGitProjection(entry, snapshot) {
  const expected = snapshotGitProjection(snapshot);
  const actual = await currentGitProjection(entry.repository_root);
  const expectedId = sha256Text(JSON.stringify(expected));
  const actualId = sha256Text(JSON.stringify(actual));
  return {
    ok: expectedId === actualId,
    reason: expectedId === actualId ? null : "git_projection_changed",
    expected_projection_id: expectedId,
    actual_projection_id: actualId,
  };
}

async function assertFencePathIgnored(repositoryRoot) {
  try {
    await execFileAsync(
      fixedGitExecutable,
      ["--no-pager", "-c", "core.fsmonitor=false", "check-ignore", "--quiet", "--", fenceProbeRelativePath.replaceAll(path.sep, "/")],
      {
        cwd: repositoryRoot,
        env: controlledProcessEnvironment({
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
          GIT_OPTIONAL_LOCKS: "0",
        }),
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        shell: false,
      },
    );
  } catch (error) {
    const wrapped = new Error("workspace watcher fence path is not ignored by Git.");
    wrapped.code = "WORKSPACE_CHANGE_CLOCK_FENCE_NOT_IGNORED";
    wrapped.cause = error;
    throw wrapped;
  }
}

async function describePathIdentity(targetPath) {
  const real = await realpath(targetPath);
  const info = await stat(real, { bigint: true });
  if (!info.isDirectory()) throw new Error(`Watcher root is not a directory: ${targetPath}`);
  return {
    real_path: real,
    dev: String(info.dev),
    ino: String(info.ino),
    birthtime_ms: String(info.birthtimeMs),
  };
}

async function identityForWatchRoots(watchRoots) {
  const descriptors = [];
  for (const watchRoot of watchRoots) descriptors.push(await describePathIdentity(watchRoot));
  descriptors.sort((left, right) => normalizePathKey(left.real_path).localeCompare(normalizePathKey(right.real_path)));
  return `sha256:${sha256Text(JSON.stringify(descriptors))}`;
}

async function defaultDescribeWorkspace(workspaceId, resolveWorkspace) {
  const context = await resolveWorkspace(workspaceId);
  const repositoryRoot = path.resolve(context.root);
  const realRepositoryRoot = await realpath(repositoryRoot);
  const absoluteGitDir = await runGit(repositoryRoot, ["rev-parse", "--absolute-git-dir"]);
  let commonGitDir = await runGit(repositoryRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (!path.isAbsolute(commonGitDir)) commonGitDir = path.resolve(repositoryRoot, commonGitDir);
  const identityPaths = [];
  const seen = new Set();
  for (const candidate of [realRepositoryRoot, absoluteGitDir, commonGitDir]) {
    const real = await realpath(candidate);
    const key = normalizePathKey(real);
    if (seen.has(key)) continue;
    seen.add(key);
    identityPaths.push(real);
  }
  if (identityPaths.length < 1 || identityPaths.length > 8) throw new Error("Workspace watcher resolved an invalid identity-root set.");
  // Only the working tree needs an event-stream watcher. Git metadata may live
  // outside an isolated worktree, so reuse is separately fenced by an exact
  // server-owned HEAD + projected-status validation instead of writing cookies
  // into .git internals.
  const watchRoots = [realRepositoryRoot];
  await assertFencePathIgnored(repositoryRoot);
  const fenceRoot = path.join(repositoryRoot, fenceRelativeDirectory);
  if (!isInside(repositoryRoot, fenceRoot)) throw new Error("Workspace watcher fence root escaped the workspace.");
  await mkdir(fenceRoot, { recursive: true });
  return {
    workspace_id: workspaceId,
    repository_root: repositoryRoot,
    watch_roots: watchRoots,
    identity_paths: identityPaths,
    root_identity: await identityForWatchRoots(identityPaths),
    fence_root: fenceRoot,
    git_entry_path: path.join(repositoryRoot, ".git"),
  };
}

function defaultSpawnHelper(descriptor) {
  const executable = "powershell.exe";
  const args = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    helperScriptPath,
    "-WatchRootsJson",
    JSON.stringify(descriptor.watch_roots),
    "-InternalBufferSize",
    "65536",
  ];
  return spawn(executable, args, {
    cwd: descriptor.repository_root,
    env: controlledProcessEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
}

function promiseWithTimeout(promise, timeoutMs, timeoutMessage) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function createWorkspaceChangeClockProvider(options = {}) {
  const changeClock = options.change_clock;
  if (!changeClock || typeof changeClock.status !== "function"
    || typeof changeClock.markProviderReady !== "function"
    || typeof changeClock.noteChange !== "function"
    || typeof changeClock.markFreshInstance !== "function"
    || typeof changeClock.markFailed !== "function") {
    throw new Error("change_clock provider requires the B4B change-clock contract.");
  }
  const platform = options.platform ?? process.platform;
  const resolveWorkspace = options.resolve_workspace ?? defaultResolveWorkspace;
  const describeWorkspace = options.describe_workspace
    ?? ((workspaceId) => defaultDescribeWorkspace(workspaceId, resolveWorkspace));
  const spawnHelper = options.spawn_helper ?? defaultSpawnHelper;
  const rootIdentityResolver = options.root_identity_resolver
    ?? ((entry) => identityForWatchRoots(entry.identity_paths ?? entry.watch_roots));
  const validateGitProjection = options.validate_git_projection ?? defaultValidateGitProjection;
  const writeFence = options.write_fence
    ?? ((filePath, content) => writeFile(filePath, content, { encoding: "utf8", flag: "wx" }));
  const removeFence = options.remove_fence
    ?? (async (filePath) => { try { await unlink(filePath); } catch {} });
  const fenceTimeoutMs = options.fence_timeout_ms ?? DEFAULT_FENCE_TIMEOUT_MS;
  const startTimeoutMs = options.start_timeout_ms ?? DEFAULT_START_TIMEOUT_MS;
  if (!Number.isSafeInteger(fenceTimeoutMs) || fenceTimeoutMs < 100 || fenceTimeoutMs > 4_000) {
    throw new Error("fence_timeout_ms must be an integer between 100 and 4000.");
  }
  if (!Number.isSafeInteger(startTimeoutMs) || startTimeoutMs < 100 || startTimeoutMs > 10_000) {
    throw new Error("start_timeout_ms must be an integer between 100 and 10000.");
  }

  const entries = new Map();
  const startPromises = new Map();
  let closed = false;

  function providerStatus(workspaceId) {
    const entry = entries.get(workspaceId);
    return {
      ownership: "mcp_http_parent_workspace_change_clock_provider",
      workspace_id: workspaceId,
      platform,
      backend: platform === "win32" ? "dotnet_filesystemwatcher" : "unavailable",
      helper_pid: entry?.child?.pid ?? null,
      helper_ready: entry?.ready === true,
      watch_root_count: entry?.watch_roots?.length ?? 0,
      event_count: entry?.event_count ?? 0,
      fence_count: entry?.fence_count ?? 0,
      git_projection_check_count: entry?.git_projection_check_count ?? 0,
      git_projection_mismatch_count: entry?.git_projection_mismatch_count ?? 0,
      overflow_count: entry?.overflow_count ?? 0,
      last_helper_sequence: entry?.last_helper_sequence ?? null,
      last_error: entry?.last_error ?? null,
      change_clock: changeClock.status({ workspace_id: workspaceId }),
    };
  }

  function rejectPendingFences(entry, reason) {
    for (const pending of entry.pending_fences.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    entry.pending_fences.clear();
  }

  function stopEntry(entry) {
    if (!entry || entry.stopping) return;
    entry.stopping = true;
    rejectPendingFences(entry, "workspace_change_clock_provider_stopped");
    if (entry.child && entry.child.exitCode === null && entry.child.signalCode === null) {
      try { terminateProcessTree(entry.child); } catch {}
    }
  }

  function markFault(entry, reason, { failed = false, overflow = false } = {}) {
    if (!entry || entry.faulted) return;
    entry.faulted = true;
    entry.ready = false;
    entry.last_error = boundedReason(reason, "workspace_change_clock_provider_fault");
    if (overflow) entry.overflow_count += 1;
    if (failed) {
      changeClock.markFailed({ workspace_id: entry.workspace_id, reason: entry.last_error });
    } else {
      changeClock.markFreshInstance({ workspace_id: entry.workspace_id, reason: entry.last_error });
    }
    stopEntry(entry);
  }

  function isFenceEvent(entry, fullPath, oldFullPath = null) {
    const fenceRootKey = normalizePathKey(entry.fence_root);
    const paths = [fullPath, oldFullPath].filter((value) => typeof value === "string" && value);
    return paths.some((candidate) => {
      const key = normalizePathKey(candidate);
      return key === fenceRootKey || key.startsWith(`${fenceRootKey}${path.sep}`);
    });
  }

  function resolveFenceEvent(entry, fullPath, oldFullPath = null) {
    const candidates = [fullPath, oldFullPath].filter((value) => typeof value === "string" && value);
    for (const candidate of candidates) {
      const pending = entry.pending_fences.get(normalizePathKey(candidate));
      if (!pending) continue;
      entry.pending_fences.delete(normalizePathKey(candidate));
      clearTimeout(pending.timer);
      entry.fence_count += 1;
      pending.resolve({ sequence: entry.last_helper_sequence });
      return true;
    }
    return false;
  }

  function classifyGitMetadataEvent(entry, fullPath, oldFullPath = null) {
    const gitEntry = entry.git_entry_path ?? path.join(entry.repository_root, ".git");
    const gitKey = normalizePathKey(gitEntry);
    const candidates = [fullPath, oldFullPath].filter((value) => typeof value === "string" && value);
    let descendant = false;
    for (const candidate of candidates) {
      const key = normalizePathKey(candidate);
      if (key === gitKey) return "entry";
      if (key.startsWith(`${gitKey}${path.sep}`)) descendant = true;
    }
    return descendant ? "descendant" : null;
  }

  function handleHelperMessage(entry, message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      markFault(entry, "watcher_protocol_invalid", { failed: true });
      return;
    }
    if (message.kind === "ready") {
      if (entry.ready || entry.faulted) return;
      entry.ready = true;
      entry.last_error = null;
      changeClock.markProviderReady({
        workspace_id: entry.workspace_id,
        root_identity: entry.root_identity,
        reason: "windows_filesystem_watcher_ready",
      });
      entry.ready_resolve?.(true);
      return;
    }
    if (message.kind === "overflow") {
      markFault(entry, "watcher_internal_buffer_overflow", { overflow: true });
      return;
    }
    if (message.kind === "root_lost") {
      markFault(entry, "watcher_root_lost");
      return;
    }
    if (message.kind === "error" || message.kind === "fatal") {
      markFault(entry, `watcher_${message.kind}`, { failed: message.kind === "fatal" && !entry.ready });
      return;
    }
    if (message.kind !== "event") {
      markFault(entry, "watcher_protocol_unknown_message", { failed: true });
      return;
    }
    if (Number.isSafeInteger(message.sequence)) entry.last_helper_sequence = message.sequence;
    entry.event_count += 1;
    const fullPath = typeof message.full_path === "string" ? message.full_path : "";
    const oldFullPath = typeof message.old_full_path === "string" ? message.old_full_path : null;
    if (!fullPath) {
      markFault(entry, "watcher_event_path_missing");
      return;
    }
    if (isFenceEvent(entry, fullPath, oldFullPath)) {
      resolveFenceEvent(entry, fullPath, oldFullPath);
      return;
    }
    const gitMetadataEvent = classifyGitMetadataEvent(entry, fullPath, oldFullPath);
    if (gitMetadataEvent === "entry") {
      markFault(entry, "git_entry_changed");
      return;
    }
    if (gitMetadataEvent === "descendant") {
      // Git metadata is validated through the exact HEAD + projected-status
      // proof in performFence(); treating its internal notifications as working-
      // tree changes would make the verifier invalidate itself.
      return;
    }
    changeClock.noteChange({
      workspace_id: entry.workspace_id,
      reason: `filesystem_${String(message.change_type || "changed").toLowerCase()}`,
    });
  }

  function bindHelper(entry) {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    entry.child.stdout?.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      if (Buffer.byteLength(stdoutBuffer, "utf8") > MAX_HELPER_LINE_BYTES * 2) {
        markFault(entry, "watcher_stdout_overflow", { failed: true });
        return;
      }
      while (true) {
        const newline = stdoutBuffer.indexOf("\n");
        if (newline < 0) break;
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (!line) continue;
        if (Buffer.byteLength(line, "utf8") > MAX_HELPER_LINE_BYTES) {
          markFault(entry, "watcher_protocol_line_too_large", { failed: true });
          continue;
        }
        try {
          handleHelperMessage(entry, JSON.parse(line));
        } catch {
          markFault(entry, "watcher_protocol_json_invalid", { failed: true });
        }
      }
    });
    entry.child.stderr?.on("data", (chunk) => {
      stderrBuffer = `${stderrBuffer}${chunk.toString("utf8")}`.slice(-MAX_STDERR_BYTES);
      entry.stderr_tail = stderrBuffer;
    });
    entry.child.on("error", (error) => {
      entry.ready_reject?.(error);
      markFault(entry, "watcher_helper_spawn_error", { failed: !entry.ready });
    });
    entry.child.on("exit", (code, signal) => {
      if (entry.stopping || closed) return;
      entry.ready_reject?.(new Error(`watcher helper exited code=${code} signal=${signal ?? "none"}`));
      markFault(entry, entry.ready ? "watcher_helper_exited" : "watcher_helper_start_failed", { failed: !entry.ready });
    });
  }

  async function startEntry(workspaceId) {
    const descriptor = await describeWorkspace(workspaceId);
    const prior = entries.get(workspaceId);
    if (prior) {
      const identity = await rootIdentityResolver(prior).catch(() => null);
      if (prior.ready && !prior.faulted && identity === prior.root_identity) return prior;
      stopEntry(prior);
      entries.delete(workspaceId);
      if (identity !== prior.root_identity) {
        changeClock.markFreshInstance({ workspace_id: workspaceId, reason: "watch_root_identity_changed" });
      }
    }
    const entry = {
      ...descriptor,
      child: null,
      ready: false,
      faulted: false,
      stopping: false,
      event_count: 0,
      fence_count: 0,
      git_projection_check_count: 0,
      git_projection_mismatch_count: 0,
      overflow_count: 0,
      last_helper_sequence: null,
      last_error: null,
      stderr_tail: "",
      pending_fences: new Map(),
      ready_resolve: null,
      ready_reject: null,
    };
    entries.set(workspaceId, entry);
    const readyPromise = new Promise((resolve, reject) => {
      entry.ready_resolve = resolve;
      entry.ready_reject = reject;
    });
    try {
      entry.child = spawnHelper(descriptor);
      bindHelper(entry);
      await promiseWithTimeout(readyPromise, startTimeoutMs, "workspace watcher start timeout");
      entry.ready_resolve = null;
      entry.ready_reject = null;
      return entry;
    } catch (error) {
      entry.ready_resolve = null;
      entry.ready_reject = null;
      markFault(entry, error?.message === "workspace watcher start timeout"
        ? "watcher_start_timeout"
        : "watcher_start_failed", { failed: true });
      return entry;
    }
  }

  async function ensureReady({ workspace_id } = {}) {
    const workspaceId = assertWorkspaceId(workspace_id);
    if (closed) return { ready: false, reason: "provider_closed", ...providerStatus(workspaceId) };
    if (platform !== "win32") {
      return { ready: false, reason: "unsupported_platform", ...providerStatus(workspaceId) };
    }
    const existingStart = startPromises.get(workspaceId);
    if (existingStart) {
      const entry = await existingStart;
      return {
        ready: entry.ready && !entry.faulted,
        reason: entry.ready && !entry.faulted ? null : entry.last_error ?? "watcher_not_ready",
        ...providerStatus(workspaceId),
      };
    }
    let entry = entries.get(workspaceId);
    if (entry?.ready && !entry.faulted && !entry.stopping) {
      const identity = await rootIdentityResolver(entry).catch(() => null);
      if (identity === entry.root_identity) return { ready: true, reason: null, ...providerStatus(workspaceId) };
      markFault(entry, "watch_root_identity_changed");
      entries.delete(workspaceId);
    }
    let startPromise;
    startPromise = startEntry(workspaceId).finally(() => {
      if (startPromises.get(workspaceId) === startPromise) startPromises.delete(workspaceId);
    });
    startPromises.set(workspaceId, startPromise);
    entry = await startPromise;
    return {
      ready: entry.ready && !entry.faulted,
      reason: entry.ready && !entry.faulted ? null : entry.last_error ?? "watcher_not_ready",
      ...providerStatus(workspaceId),
    };
  }

  async function performWorkspaceFence(entry) {
    const nonce = randomUUID();
    const fencePath = path.join(entry.fence_root, `${nonce}.cookie`);
    const fenceKey = normalizePathKey(fencePath);
    let resolveFence;
    let rejectFence;
    const observed = new Promise((resolve, reject) => {
      resolveFence = resolve;
      rejectFence = reject;
    });
    const timer = setTimeout(() => {
      entry.pending_fences.delete(fenceKey);
      rejectFence(new Error("watcher_fence_timeout"));
    }, fenceTimeoutMs);
    entry.pending_fences.set(fenceKey, { resolve: resolveFence, reject: rejectFence, timer });
    try {
      await writeFence(fencePath, `${nonce}\n`);
      await observed;
    } finally {
      entry.pending_fences.delete(fenceKey);
      clearTimeout(timer);
      await removeFence(fencePath);
    }
  }

  async function performFence(entry, expected = {}, snapshot = null) {
    const beforeIdentity = await rootIdentityResolver(entry).catch(() => null);
    if (beforeIdentity !== entry.root_identity) {
      markFault(entry, "watch_root_identity_changed");
      return { ok: false, reason: "watch_root_identity_changed" };
    }
    const before = changeClock.status({ workspace_id: entry.workspace_id });
    if (expected.root_identity && expected.root_identity !== entry.root_identity) {
      return { ok: false, reason: "fence_root_identity_mismatch" };
    }
    if (expected.watch_instance_id && expected.watch_instance_id !== before.watch_instance_id) {
      return { ok: false, reason: "fence_watch_instance_mismatch" };
    }
    if (Number.isSafeInteger(expected.change_epoch) && expected.change_epoch !== before.change_epoch) {
      return { ok: false, reason: "fence_change_epoch_mismatch" };
    }

    if (!snapshot) return { ok: false, reason: "git_projection_snapshot_unavailable" };
    try {
      // The first cookie drains all working-tree notifications that precede the
      // Git projection read. The second cookie drains notifications that occur
      // while Git is reading HEAD/status, closing the event-delivery lag window
      // without ever writing a barrier into .git internals.
      await performWorkspaceFence(entry);
      const projection = await validateGitProjection(entry, snapshot);
      entry.git_projection_check_count += 1;
      if (projection?.ok !== true) {
        entry.git_projection_mismatch_count += 1;
        changeClock.noteChange({
          workspace_id: entry.workspace_id,
          reason: boundedReason(projection?.reason, "git_projection_changed"),
        });
        return {
          ok: false,
          reason: boundedReason(projection?.reason, "git_projection_changed"),
          git_projection_checked: true,
        };
      }
      await performWorkspaceFence(entry);
    } catch (error) {
      markFault(entry, error?.message === "watcher_fence_timeout"
        ? "watcher_fence_timeout"
        : "watcher_fence_or_git_projection_failed");
      return { ok: false, reason: entry.last_error };
    }

    const afterIdentity = await rootIdentityResolver(entry).catch(() => null);
    if (afterIdentity !== entry.root_identity) {
      markFault(entry, "watch_root_identity_changed");
      return { ok: false, reason: "watch_root_identity_changed" };
    }
    const after = changeClock.status({ workspace_id: entry.workspace_id });
    if (expected.root_identity && after.root_identity !== expected.root_identity) {
      return { ok: false, reason: "fence_root_identity_mismatch" };
    }
    if (expected.watch_instance_id && after.watch_instance_id !== expected.watch_instance_id) {
      return { ok: false, reason: "fence_watch_instance_mismatch" };
    }
    if (Number.isSafeInteger(expected.change_epoch) && after.change_epoch !== expected.change_epoch) {
      return { ok: false, reason: "fence_change_epoch_mismatch" };
    }
    if (!after.provider_ready || after.watch_state === "unknown" || after.watch_state === "failed") {
      return { ok: false, reason: "watcher_not_authoritative" };
    }
    return {
      ok: true,
      reason: null,
      git_projection_checked: true,
      change_epoch: after.change_epoch,
      watch_instance_id: after.watch_instance_id,
      root_identity: after.root_identity,
      helper_sequence: entry.last_helper_sequence,
    };
  }

  async function prepareReuse({ workspace_id, snapshot = null } = {}) {
    const workspaceId = assertWorkspaceId(workspace_id);
    const ready = await ensureReady({ workspace_id: workspaceId });
    if (!ready.ready) return { ok: false, reason: ready.reason, ...providerStatus(workspaceId) };
    const state = changeClock.status({ workspace_id: workspaceId });
    if (state.watch_state !== "healthy" || state.synchronized !== true) {
      return { ok: true, fenced: false, reason: "baseline_not_synchronized", ...providerStatus(workspaceId) };
    }
    const entry = entries.get(workspaceId);
    const fenced = await performFence(entry, {
      root_identity: state.root_identity,
      watch_instance_id: state.watch_instance_id,
      change_epoch: state.change_epoch,
    }, snapshot);
    return { ...fenced, fenced: fenced.ok, ...providerStatus(workspaceId) };
  }

  async function prepareSynchronization({ workspace_id } = {}) {
    return ensureReady({ workspace_id });
  }

  async function fenceSynchronization({ workspace_id, token, snapshot = null } = {}) {
    const workspaceId = assertWorkspaceId(workspace_id);
    const entry = entries.get(workspaceId);
    if (!entry?.ready || entry.faulted || entry.stopping) {
      return { ok: false, reason: "watcher_not_ready", ...providerStatus(workspaceId) };
    }
    if (!token || typeof token !== "object") {
      return { ok: false, reason: "synchronization_token_invalid", ...providerStatus(workspaceId) };
    }
    const fenced = await performFence(entry, {
      root_identity: token.root_identity,
      watch_instance_id: token.watch_instance_id,
      change_epoch: token.change_epoch,
    }, snapshot);
    return { ...fenced, ...providerStatus(workspaceId) };
  }

  function status({ workspace_id } = {}) {
    return providerStatus(assertWorkspaceId(workspace_id));
  }

  function close() {
    if (closed) return;
    closed = true;
    for (const entry of entries.values()) stopEntry(entry);
    entries.clear();
  }

  return Object.freeze({
    ownership: "mcp_http_parent_workspace_change_clock_provider",
    backend: platform === "win32" ? "dotnet_filesystemwatcher" : "unavailable",
    ensureReady,
    prepareReuse,
    prepareSynchronization,
    fenceSynchronization,
    status,
    close,
  });
}
