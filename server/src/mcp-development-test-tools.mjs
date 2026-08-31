import { spawn, spawnSync } from "node:child_process";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  controlledProcessEnvironment,
  createBoundedOutputCollector,
  redactProcessOutput,
  terminateProcessTree,
} from "./process-control.mjs";
import { projectRoot } from "./project-paths.mjs";

export const DEV_TEST_SUITES = Object.freeze(["mcp", "mcp_tunnel", "all"]);
export const DEV_TEST_OUTPUT_MAX_CHARACTERS = 128 * 1024;

const productionSuiteDefinitions = Object.freeze({
  mcp: Object.freeze({
    executable: process.execPath,
    argv: Object.freeze(["tests/tools/mcp-contract.test.mjs"]),
    timeoutMs: 300_000,
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
    timeoutMs: 3_600_000,
    cleanupPort: 8787,
  }),
});

const productionLockPath = path.join(projectRoot, "tests", ".tmp", "dev-run-tests.lock");

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
    if (record.hostname === os.hostname() && !isProcessRunning(record.pid)) {
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
        pid: process.pid,
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

async function releaseRunLock(handle, lockPath) {
  if (!handle) return;
  await handle.close().catch(() => {});
  await rm(lockPath, { force: true }).catch(() => {});
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

async function runDefinition(suite, definition, outputMaxCharacters) {
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
      cwd: projectRoot,
      env: controlledEnvironment(definition.fixedEnvironment),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    activeChild = child;
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

export function createDevTestRunner({
  suiteDefinitions = productionSuiteDefinitions,
  lockPath = productionLockPath,
  outputMaxCharacters = DEV_TEST_OUTPUT_MAX_CHARACTERS,
} = {}) {
  return async function runTests(input = {}) {
    const startedAt = Date.now();
    const suite = input?.suite;
    const definition = suiteDefinitions[suite];
    if (!definition || !DEV_TEST_SUITES.includes(suite)) {
      throw new Error(`suite must be one of: ${DEV_TEST_SUITES.join(", ")}.`);
    }

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
      return await runDefinition(suite, definition, outputMaxCharacters);
    } catch (error) {
      return {
        ...baseResult(suite, startedAt),
        stderr: redactTestOutput(`Internal test runner failure: ${error.message}`),
      };
    } finally {
      await releaseRunLock(lockHandle, lockPath);
    }
  };
}

export const dev_run_tests = createDevTestRunner();

export function getDevTestSuiteMapping() {
  return Object.fromEntries(
    Object.entries(productionSuiteDefinitions).map(([suite, definition]) => [suite, {
      executable: definition.executable,
      argv: [...definition.argv],
      timeout_ms: definition.timeoutMs,
    }]),
  );
}
