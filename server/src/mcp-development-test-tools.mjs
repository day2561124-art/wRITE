import { spawn, spawnSync } from "node:child_process";
import { lstat, mkdir, open, readFile, realpath, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  controlledProcessEnvironment,
  createBoundedOutputCollector,
  redactProcessOutput,
  terminateProcessTree,
} from "./process-control.mjs";
import { projectRoot } from "./project-paths.mjs";
import { workspaceExecutionProvenance } from "./mcp-development-readonly-tools.mjs";
import { resolveDevWorkspaceExecutionContext } from "./mcp-development-workstream-tools.mjs";
import {
  beginDevJournalOperation,
  completeDevJournalOperation,
  computeWorkspaceSnapshot,
  failDevJournalOperation,
  markDevJournalDegraded,
} from "./mcp-development-journal-tools.mjs";

export const DEV_TEST_SUITES = Object.freeze(["mcp", "mcp_tunnel", "all"]);
export const DEV_TEST_OUTPUT_MAX_CHARACTERS = 128 * 1024;

const productionSuiteDefinitions = Object.freeze({
  mcp: Object.freeze({
    executable: process.execPath,
    argv: Object.freeze(["tests/tools/mcp-contract.test.mjs"]),
    timeoutMs: 1_500_000,
  }),
  mcp_tunnel: Object.freeze({
    executable: process.execPath,
    argv: Object.freeze(["tests/mcp-tunnel-launcher.test.mjs"]),
    timeoutMs: 300_000,
    cleanupPort: 8787,
  }),
  all: Object.freeze({
    executable: process.execPath,
    argv: Object.freeze(["tests/run-all.mjs"]),
    timeoutMs: 7_200_000,
    cleanupPort: 8787,
  }),
});

const productionLockPath = path.join(projectRoot, "tests", ".tmp", "dev-run-tests.lock");
export const DEV_TEST_LAST_RESULT_TEXT_MAX_CHARACTERS = 12 * 1024;

let activeChild = null;

process.once("exit", () => {
  if (activeChild) terminateProcessTree(activeChild);
});

const controlledEnvironment = controlledProcessEnvironment;
const createBoundedCollector = createBoundedOutputCollector;
export const redactTestOutput = redactProcessOutput;

function externalProcessHandle(pid) {
  return {
    pid,
    exitCode: null,
    killed: false,
    kill() {
      try {
        process.kill(pid);
      } catch {
        // The process may already have exited.
      }
    },
  };
}

function windowsListeningPids(port) {
  if (process.platform !== "win32" || !port) return new Set();
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  if (result.error || result.status !== 0) return new Set();
  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/u)) {
    const columns = line.trim().split(/\s+/u);
    if (columns.length < 5 || columns[3]?.toUpperCase() !== "LISTENING") continue;
    const localAddress = columns[1] ?? "";
    if (!localAddress.endsWith(`:${port}`)) continue;
    const pid = Number.parseInt(columns.at(-1), 10);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return pids;
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanupNewPortListeners(port, originalPids) {
  if (process.platform !== "win32" || !port) return null;
  let newPids = new Set(
    [...windowsListeningPids(port)].filter((pid) => !originalPids.has(pid)),
  );
  if (newPids.size === 0) return null;

  for (const pid of newPids) terminateProcessTree(externalProcessHandle(pid));
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    await wait(100);
    newPids = new Set(
      [...windowsListeningPids(port)].filter((pid) => !originalPids.has(pid)),
    );
    if (newPids.size === 0) return null;
  }
  return `Could not release port ${port}; remaining listener PIDs: ${[...newPids].join(", ")}.`;
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function removeStaleLock(lockPath) {
  try {
    const record = JSON.parse(await readFile(lockPath, "utf8"));
    if (record.hostname !== os.hostname()) return false;

    const childPid = Number.isInteger(record.child_pid) ? record.child_pid : null;
    if (childPid) {
      if (isProcessRunning(childPid)) return false;
      await rm(lockPath, { force: true });
      return true;
    }

    const ownerPid = Number.isInteger(record.owner_pid)
      ? record.owner_pid
      : (Number.isInteger(record.pid) ? record.pid : null);
    if (!ownerPid || !isProcessRunning(ownerPid)) {
      await rm(lockPath, { force: true });
      return true;
    }

    // Legacy locks recorded only the long-lived MCP server PID. If this is
    // our own server process and no test child is active, the lock is orphaned.
    if (
      Number.isInteger(record.pid)
      && !Number.isInteger(record.owner_pid)
      && ownerPid === process.pid
      && activeChild === null
    ) {
      await rm(lockPath, { force: true });
      return true;
    }
  } catch {
    // An unreadable lock is treated as active instead of being removed unsafely.
  }
  return false;
}

async function acquireRunLock(lockPath, suite) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({
        owner_pid: process.pid,
        child_pid: null,
        hostname: os.hostname(),
        suite,
        started_at: new Date().toISOString(),
      })}\n`, "utf8");
      return handle;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt === 0 && await removeStaleLock(lockPath)) continue;
      return null;
    }
  }
  return null;
}

async function bindRunLockToChild(handle, suite, childPid) {
  if (!handle || !Number.isInteger(childPid) || childPid <= 0) return;
  const record = `${JSON.stringify({
    owner_pid: process.pid,
    child_pid: childPid,
    hostname: os.hostname(),
    suite,
    started_at: new Date().toISOString(),
  })}\n`;
  await handle.truncate(0);
  await handle.write(record, 0, "utf8");
}

async function releaseRunLock(handle, lockPath) {
  if (!handle) return;
  await handle.close().catch(() => {});
  await rm(lockPath, { force: true }).catch(() => {});
}

function lastResultPathForLock(lockPath) {
  return path.join(path.dirname(lockPath), "dev-run-tests.last.json");
}

function tailText(value, maxCharacters = DEV_TEST_LAST_RESULT_TEXT_MAX_CHARACTERS) {
  const text = typeof value === "string" ? value : "";
  return text.length > maxCharacters ? text.slice(-maxCharacters) : text;
}

async function persistLastRunResult(resultPath, result) {
  await mkdir(path.dirname(resultPath), { recursive: true });
  const record = {
    suite: result.suite,
    execution_ok: result.execution_ok === true,
    passed: result.passed === true,
    exit_code: Number.isInteger(result.exit_code) ? result.exit_code : null,
    signal: typeof result.signal === "string" ? result.signal : null,
    timed_out: result.timed_out === true,
    duration_ms: Number.isFinite(result.duration_ms) ? Math.max(0, result.duration_ms) : null,
    total_wall_clock_ms: Number.isFinite(result.total_wall_clock_ms) ? Math.max(0, result.total_wall_clock_ms) : null,
    workspace_snapshot_id: typeof result.workspace_snapshot_id === "string" ? result.workspace_snapshot_id : null,
    head: typeof result.head === "string" ? result.head : null,
    changed_artifact_count: Number.isFinite(result.changed_artifact_count) ? result.changed_artifact_count : null,
    ...snapshotJournalTelemetry({ diagnostics: result.snapshot_diagnostics }),
    stdout_truncated: result.stdout_truncated === true,
    stderr_truncated: result.stderr_truncated === true,
    stdout_tail: tailText(result.stdout),
    stderr_tail: tailText(result.stderr),
    completed_at: new Date().toISOString(),
  };
  const temporaryPath = `${resultPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(record)}\n`, "utf8");
  try {
    await rename(temporaryPath, resultPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function baseResult(suite, startedAt) {
  return {
    suite,
    execution_ok: false,
    passed: false,
    exit_code: null,
    signal: null,
    timed_out: false,
    duration_ms: Math.max(0, Date.now() - startedAt),
    stdout: "",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
  };
}

function snapshotJournalTelemetry(snapshot) {
  const diagnostics = snapshot?.diagnostics ?? {};
  return {
    snapshot_total_ms: Number.isFinite(diagnostics.total_ms) ? diagnostics.total_ms : null,
    snapshot_git_head_ms: Number.isFinite(diagnostics.git_head_ms) ? diagnostics.git_head_ms : null,
    snapshot_git_status_ms: Number.isFinite(diagnostics.git_status_ms) ? diagnostics.git_status_ms : null,
    snapshot_root_resolve_ms: Number.isFinite(diagnostics.root_resolve_ms) ? diagnostics.root_resolve_ms : null,
    snapshot_artifact_capture_ms: Number.isFinite(diagnostics.artifact_capture_ms) ? diagnostics.artifact_capture_ms : null,
    snapshot_capture_concurrency_limit: Number.isFinite(diagnostics.capture_concurrency_limit) ? diagnostics.capture_concurrency_limit : null,
    snapshot_capture_peak_concurrency: Number.isFinite(diagnostics.capture_peak_concurrency) ? diagnostics.capture_peak_concurrency : null,
    snapshot_capture_task_count: Number.isFinite(diagnostics.capture_task_count) ? diagnostics.capture_task_count : null,
    snapshot_fingerprint_cache_eligible: diagnostics.fingerprint_cache_eligible === true,
    snapshot_fingerprint_cache_source_entry_count: Number.isFinite(diagnostics.fingerprint_cache_source_entry_count) ? diagnostics.fingerprint_cache_source_entry_count : null,
    snapshot_fingerprint_cache_hit_count: Number.isFinite(diagnostics.fingerprint_cache_hit_count) ? diagnostics.fingerprint_cache_hit_count : null,
    snapshot_fingerprint_cache_miss_count: Number.isFinite(diagnostics.fingerprint_cache_miss_count) ? diagnostics.fingerprint_cache_miss_count : null,
    snapshot_fingerprint_cache_reused_bytes: Number.isFinite(diagnostics.fingerprint_cache_reused_bytes) ? diagnostics.fingerprint_cache_reused_bytes : null,
    snapshot_fingerprint_versioned_artifact_count: Number.isFinite(diagnostics.fingerprint_versioned_artifact_count) ? diagnostics.fingerprint_versioned_artifact_count : null,
    snapshot_fingerprint_version_recheck_ms: Number.isFinite(diagnostics.fingerprint_version_recheck_ms) ? diagnostics.fingerprint_version_recheck_ms : null,
    snapshot_fingerprint_version_recheck_count: Number.isFinite(diagnostics.fingerprint_version_recheck_count) ? diagnostics.fingerprint_version_recheck_count : null,
    snapshot_fingerprint_cache_published: diagnostics.fingerprint_cache_published === true,
    snapshot_manifest_finalize_ms: Number.isFinite(diagnostics.manifest_finalize_ms) ? diagnostics.manifest_finalize_ms : null,
    snapshot_consistency_recheck_ms: Number.isFinite(diagnostics.consistency_recheck_ms) ? diagnostics.consistency_recheck_ms : null,
    snapshot_consistency_attempt_count: Number.isFinite(diagnostics.consistency_attempt_count) ? diagnostics.consistency_attempt_count : null,
    snapshot_consistency_retry_count: Number.isFinite(diagnostics.consistency_retry_count) ? diagnostics.consistency_retry_count : null,
    snapshot_mutation_generation_start: Number.isFinite(diagnostics.mutation_generation_start) ? diagnostics.mutation_generation_start : null,
    snapshot_mutation_generation_end: Number.isFinite(diagnostics.mutation_generation_end) ? diagnostics.mutation_generation_end : null,
    snapshot_status_bytes: Number.isFinite(diagnostics.status_bytes) ? diagnostics.status_bytes : null,
    snapshot_hashed_artifact_count: Number.isFinite(diagnostics.hashed_artifact_count) ? diagnostics.hashed_artifact_count : null,
    snapshot_hashed_bytes: Number.isFinite(diagnostics.hashed_bytes) ? diagnostics.hashed_bytes : null,
    snapshot_unhashed_file_count: Number.isFinite(diagnostics.unhashed_file_count) ? diagnostics.unhashed_file_count : null,
    snapshot_directory_count: Number.isFinite(diagnostics.directory_count) ? diagnostics.directory_count : null,
    snapshot_modified_count: Number.isFinite(diagnostics.modified_count) ? diagnostics.modified_count : null,
    snapshot_added_count: Number.isFinite(diagnostics.added_count) ? diagnostics.added_count : null,
    snapshot_deleted_count: Number.isFinite(diagnostics.deleted_count) ? diagnostics.deleted_count : null,
    snapshot_untracked_count: Number.isFinite(diagnostics.untracked_count) ? diagnostics.untracked_count : null,
  };
}

async function prepareWorkspaceDependencyBridge(context, dependencyRoot) {
  if (!["isolated_worktree", "integration_worktree"].includes(context?.workspace_type)) {
    return async () => {};
  }
  const repositoryRoot = path.resolve(context.root);
  const sourcePath = path.join(path.resolve(dependencyRoot), "node_modules");
  const bridgePath = path.join(repositoryRoot, "node_modules");
  const sourceInfo = await lstat(sourcePath);
  if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
    throw new Error("Project node_modules must be a real directory before isolated test execution.");
  }
  const sourceRealPath = await realpath(sourcePath);
  try {
    const existing = await lstat(bridgePath);
    if (existing.isDirectory() && !existing.isSymbolicLink()) {
      return async () => {};
    }
    if (!existing.isSymbolicLink()) {
      throw new Error("Workspace node_modules exists but is not a server-owned dependency bridge or directory.");
    }
    const existingRealPath = await realpath(bridgePath);
    if (existingRealPath !== sourceRealPath) {
      throw new Error("Workspace node_modules dependency bridge points outside the project dependency root.");
    }
    return async () => {};
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  await symlink(sourceRealPath, bridgePath, process.platform === "win32" ? "junction" : "dir");
  const linkedRealPath = await realpath(bridgePath);
  if (linkedRealPath !== sourceRealPath) {
    await unlink(bridgePath).catch(() => {});
    throw new Error("Workspace dependency bridge verification failed.");
  }
  return async () => {
    const info = await lstat(bridgePath).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return;
    if (!info.isSymbolicLink()) {
      throw new Error("Workspace dependency bridge changed type during test execution; cleanup refused.");
    }
    const currentRealPath = await realpath(bridgePath);
    if (currentRealPath !== sourceRealPath) {
      throw new Error("Workspace dependency bridge target changed during test execution; cleanup refused.");
    }
    await unlink(bridgePath);
  };
}

async function runDefinition(suite, definition, outputMaxCharacters, lockHandle, repositoryRoot, dependencyRoot) {
  const startedAt = Date.now();
  const stdout = createBoundedCollector(outputMaxCharacters);
  const stderr = createBoundedCollector(outputMaxCharacters);
  const originalPortPids = windowsListeningPids(definition.cleanupPort);
  let child;
  let timedOut = false;
  let spawnError = null;
  let exitCode = null;
  let signal = null;

  try {
    child = spawn(definition.executable, [...definition.argv], {
      cwd: repositoryRoot,
      env: controlledEnvironment({
        ...definition.fixedEnvironment,
        WRITER_WORKBENCH_DEPENDENCY_ROOT: path.resolve(dependencyRoot),
      }),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    activeChild = child;
    await bindRunLockToChild(lockHandle, suite, child.pid);
  } catch (error) {
    spawnError = error;
  }

  if (child) {
    child.stdout.on("data", (chunk) => stdout.append(chunk));
    child.stderr.on("data", (chunk) => stderr.append(chunk));

    await new Promise((resolve) => {
      let settled = false;
      let forceSettleTimer;
      const finish = (code, childSignal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(forceSettleTimer);
        exitCode = Number.isInteger(code) ? code : null;
        signal = typeof childSignal === "string" ? childSignal : null;
        resolve();
      };
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child);
        forceSettleTimer = setTimeout(() => finish(null, null), 5_000);
        forceSettleTimer.unref?.();
      }, definition.timeoutMs);
      timeoutTimer.unref?.();

      child.once("error", (error) => {
        spawnError = error;
        finish(null, null);
      });
      child.once("close", finish);
    });
  }

  if (activeChild === child) activeChild = null;
  const cleanupError = await cleanupNewPortListeners(
    definition.cleanupPort,
    originalPortPids,
  );
  const stdoutResult = stdout.finish();
  const stderrResult = stderr.finish();
  const errorMessages = [];
  if (spawnError) errorMessages.push(`Test process failed to start: ${spawnError.message}`);
  if (cleanupError) errorMessages.push(cleanupError);
  const extraError = redactTestOutput(errorMessages.join("\n"));

  return {
    suite,
    execution_ok: !spawnError && !cleanupError,
    passed: !spawnError && !cleanupError && !timedOut && exitCode === 0,
    exit_code: exitCode,
    signal,
    timed_out: timedOut,
    duration_ms: Math.max(0, Date.now() - startedAt),
    stdout: stdoutResult.text,
    stderr: [stderrResult.text, extraError].filter(Boolean).join("\n"),
    stdout_truncated: stdoutResult.truncated,
    stderr_truncated: stderrResult.truncated,
  };
}

function sharedTestWorkspaceContext() {
  return {
    workspace_id: "dev_workspace_shared_repository_v1",
    workstream_id: null,
    workspace_type: "shared",
    root: projectRoot,
    branch: "main",
    base_head: null,
    current_head: null,
  };
}

export function createDevTestRunner({
  suiteDefinitions = productionSuiteDefinitions,
  lockPath = productionLockPath,
  resultPath = lastResultPathForLock(lockPath),
  outputMaxCharacters = DEV_TEST_OUTPUT_MAX_CHARACTERS,
  workspaceContextResolver = async () => sharedTestWorkspaceContext(),
  dependencyRoot = process.env.WRITER_WORKBENCH_DEPENDENCY_ROOT?.trim() || projectRoot,
} = {}) {
  return async function runTests(input = {}) {
    const startedAt = Date.now();
    const suite = input?.suite;
    const definition = suiteDefinitions[suite];
    if (!definition || !DEV_TEST_SUITES.includes(suite)) {
      throw new Error(`suite must be one of: ${DEV_TEST_SUITES.join(", ")}.`);
    }

    let context;
    let lockHandle;
    try {
      lockHandle = await acquireRunLock(lockPath, suite);
    } catch (error) {
      return {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Could not acquire test-run lock: ${error.message}`),
      };
    }
    if (!lockHandle) {
      return {
        ...baseResult(suite, startedAt),
        stderr: "Another dev_run_tests invocation is already running.",
      };
    }

    try {
      context = await workspaceContextResolver(
        { workspace_id: input?.workspace_id },
        { mutation: true },
      );
    } catch (error) {
      await releaseRunLock(lockHandle, lockPath);
      return {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Could not resolve workspace execution context: ${error.message}`),
      };
    }

    let journalOperation;
    let workspaceSnapshot;
    try {
      workspaceSnapshot = await computeWorkspaceSnapshot(context);
      journalOperation = await beginDevJournalOperation({
        operation_type: "test_evidence",
        tool_name: "dev_run_tests",
        workstream_id: context.workstream_id,
        workspace_id: context.workspace_id,
        result: {
          suite,
          workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
          head: workspaceSnapshot.head,
          changed_artifact_count: workspaceSnapshot.changed_artifact_count,
          ...snapshotJournalTelemetry(workspaceSnapshot),
        },
      });
    } catch (error) {
      await releaseRunLock(lockHandle, lockPath);
      return {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Could not establish test provenance before execution: ${error.message}`),
        workspace_context: workspaceExecutionProvenance(context),
      };
    }

    let dependencyBridgeCleanup = async () => {};
    try {
      dependencyBridgeCleanup = await prepareWorkspaceDependencyBridge(context, dependencyRoot);
    } catch (error) {
      try {
        await failDevJournalOperation(journalOperation.operation_id, {
          result: {
            suite,
            execution_ok: false,
            passed: false,
            reason: `dependency_bridge_setup_failed:${String(error.message).slice(0, 512)}`,
            workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
            head: workspaceSnapshot.head,
            changed_artifact_count: workspaceSnapshot.changed_artifact_count,
            total_wall_clock_ms: Math.max(0, Date.now() - startedAt),
            ...snapshotJournalTelemetry(workspaceSnapshot),
          },
        });
      } catch (journalError) {
        await markDevJournalDegraded(`dev_run_tests setup failure terminal append failed: ${journalError.message}`);
      }
      await releaseRunLock(lockHandle, lockPath);
      return {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Could not prepare workspace dependency bridge: ${error.message}`),
        operation_id: journalOperation.operation_id,
        workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
        snapshot_diagnostics: workspaceSnapshot.diagnostics ?? null,
        total_wall_clock_ms: Math.max(0, Date.now() - startedAt),
        workspace_context: workspaceExecutionProvenance(context),
      };
    }

    let result;
    try {
      result = await runDefinition(
        suite,
        definition,
        outputMaxCharacters,
        lockHandle,
        context.root,
        dependencyRoot,
      );
    } catch (error) {
      result = {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Internal test runner failure: ${error.message}`),
      };
    }

    try {
      await dependencyBridgeCleanup();
    } catch (error) {
      result = {
        ...result,
        execution_ok: false,
        passed: false,
        stderr: [
          result.stderr,
          redactTestOutput(`Could not clean workspace dependency bridge: ${error.message}`),
        ].filter(Boolean).join("\n"),
      };
    }

    try {
      await persistLastRunResult(resultPath, {
        ...result,
        total_wall_clock_ms: Math.max(0, Date.now() - startedAt),
        workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
        head: workspaceSnapshot.head,
        changed_artifact_count: workspaceSnapshot.changed_artifact_count,
        snapshot_diagnostics: workspaceSnapshot.diagnostics ?? null,
      });
    } catch (error) {
      result = {
        ...result,
        execution_ok: false,
        passed: false,
        stderr: [
          result.stderr,
          redactTestOutput(`Could not persist test-run result: ${error.message}`),
        ].filter(Boolean).join("\n"),
      };
    }
    try {
      await completeDevJournalOperation(journalOperation.operation_id, {
        result: {
          suite,
          passed: result.passed === true,
          execution_ok: result.execution_ok === true,
          timed_out: result.timed_out === true,
          duration_ms: result.duration_ms,
          total_wall_clock_ms: Math.max(0, Date.now() - startedAt),
          workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
          head: workspaceSnapshot.head,
          changed_artifact_count: workspaceSnapshot.changed_artifact_count,
          ...snapshotJournalTelemetry(workspaceSnapshot),
        },
      });
    } catch (error) {
      await markDevJournalDegraded(`dev_run_tests terminal append failed: ${error.message}`);
      result = {
        ...result,
        execution_ok: false,
        passed: false,
        stderr: [
          result.stderr,
          redactTestOutput(`Test effect completed but provenance terminal append failed: ${error.message}`),
        ].filter(Boolean).join("\n"),
      };
    }
    await releaseRunLock(lockHandle, lockPath);
    return {
      ...result,
      operation_id: journalOperation.operation_id,
      workspace_snapshot_id: workspaceSnapshot.workspace_snapshot_id,
      snapshot_diagnostics: workspaceSnapshot.diagnostics ?? null,
      total_wall_clock_ms: Math.max(0, Date.now() - startedAt),
      workspace_context: workspaceExecutionProvenance(context),
    };
  };
}

export const dev_run_tests = createDevTestRunner({
  workspaceContextResolver: resolveDevWorkspaceExecutionContext,
});

export function getDevTestSuiteMapping() {
  return Object.fromEntries(
    Object.entries(productionSuiteDefinitions).map(([suite, definition]) => [suite, {
      executable: definition.executable,
      argv: [...definition.argv],
      timeout_ms: definition.timeoutMs,
    }]),
  );
}
