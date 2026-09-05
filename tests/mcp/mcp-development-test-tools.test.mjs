import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDevTestRunner,
  DEV_TEST_LAST_RESULT_TEXT_MAX_CHARACTERS,
  getDevTestSuiteMapping,
} from "../../server/src/mcp-development-test-tools.mjs";
import {
  createDevGitTools,
  DEV_GIT_WHITESPACE_POLICY,
  getDevGitCommandMapping,
} from "../../server/src/mcp-development-readonly-tools.mjs";
import {
  createDevGitCommitTool,
  createDevGitPushTool,
  createDevGitRemoteStatusTool,
  getDevGitCommitCommandMapping,
  getDevGitPushCommandMapping,
  getDevGitRemoteStatusCommandMapping,
} from "../../server/src/mcp-development-write-tools.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function isPortAvailable(port) {
  const server = createServer();
  return await new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function runMcp(request) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_developer" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }
      try {
        const responses = stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(responses.find((response) => response.id === request.id));
      } catch (error) {
        reject(new Error(`Could not parse MCP response: ${error.message}\n${stdout}`));
      }
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}

function testDefinition(argv, options = {}) {
  return {
    executable: options.executable ?? process.execPath,
    argv,
    timeoutMs: options.timeoutMs ?? 5_000,
    cleanupPort: options.cleanupPort,
    fixedEnvironment: options.fixedEnvironment,
  };
}

function runFixtureGit(cwd, args) {
  const executable = process.platform === "win32" ? "git.exe" : "git";
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `fixture git ${args.join(" ")} failed: ${result.stderr}`,
  );
  return result;
}

function runFixtureGitWithInput(cwd, args, input) {
  const executable = process.platform === "win32" ? "git.exe" : "git";
  const result = spawnSync(executable, args, {
    cwd,
    input,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `fixture git ${args.join(" ")} failed: ${result.stderr}`);
  return result;
}

async function createCommitFixture(parent, name) {
  const repositoryRoot = path.join(parent, name);
  await mkdir(path.join(repositoryRoot, "server", "src"), { recursive: true });
  await mkdir(path.join(repositoryRoot, "tests"), { recursive: true });
  await mkdir(path.join(repositoryRoot, "docs"), { recursive: true });
  runFixtureGit(repositoryRoot, ["init"]);
  runFixtureGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runFixtureGit(repositoryRoot, ["config", "user.name", "Writer Workbench Test"]);
  runFixtureGit(repositoryRoot, ["config", "user.email", "writer-workbench-test@example.invalid"]);
  await writeFile(path.join(repositoryRoot, "server", "src", "requested.mjs"), "export const requested = 1;\n", "utf8");
  await writeFile(path.join(repositoryRoot, "server", "src", "unrelated.mjs"), "export const unrelated = 1;\n", "utf8");
  await writeFile(path.join(repositoryRoot, "tests", "base.test.mjs"), "export const baseTest = true;\n", "utf8");
  runFixtureGit(repositoryRoot, [
    "add", "--",
    "server/src/requested.mjs",
    "server/src/unrelated.mjs",
    "tests/base.test.mjs",
  ]);
  runFixtureGit(repositoryRoot, ["commit", "-m", "test: base fixture"]);
  return repositoryRoot;
}

async function createPushFixture(parent, name) {
  const repositoryRoot = await createCommitFixture(parent, `${name}-repo`);
  const gitDir = path.join(repositoryRoot, ".git");
  const baseHead = fixtureHead(repositoryRoot);
  await mkdir(path.join(gitDir, "refs", "heads"), { recursive: true });
  await writeFile(path.join(gitDir, "refs", "heads", "main"), `${baseHead}\n`, "utf8");
  await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n", "utf8");

  const bareRoot = path.join(parent, `${name}-remote.git`);
  await mkdir(bareRoot, { recursive: true });
  runFixtureGit(bareRoot, ["init", "--bare"]);
  await cp(path.join(gitDir, "objects"), path.join(bareRoot, "objects"), {
    recursive: true,
    force: true,
  });
  await mkdir(path.join(bareRoot, "refs", "heads"), { recursive: true });
  await writeFile(path.join(bareRoot, "refs", "heads", "main"), `${baseHead}\n`, "utf8");
  await writeFile(path.join(bareRoot, "HEAD"), "ref: refs/heads/main\n", "utf8");

  const remoteUrl = pathToFileURL(bareRoot).href;
  runFixtureGit(repositoryRoot, ["config", "remote.origin.url", remoteUrl]);
  runFixtureGit(repositoryRoot, ["config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"]);
  runFixtureGit(repositoryRoot, ["config", "branch.main.remote", "origin"]);
  runFixtureGit(repositoryRoot, ["config", "branch.main.merge", "refs/heads/main"]);
  await mkdir(path.join(gitDir, "refs", "remotes", "origin"), { recursive: true });
  await writeFile(
    path.join(gitDir, "refs", "remotes", "origin", "main"),
    `${baseHead}\n`,
    "utf8",
  );

  await writeFile(
    path.join(repositoryRoot, "server", "src", "requested.mjs"),
    "export const requested = 42;\n",
    "utf8",
  );
  runFixtureGit(repositoryRoot, ["add", "--", "server/src/requested.mjs"]);
  runFixtureGit(repositoryRoot, ["commit", "-m", "test: local push fixture ahead"]);
  return {
    repositoryRoot,
    bareRoot,
    remoteUrl,
    baseHead,
    head: fixtureHead(repositoryRoot),
  };
}

function pushTestPolicy(remoteUrl) {
  return {
    remote: "origin",
    branch: "main",
    upstream: "origin/main",
    canonicalUrl: remoteUrl,
    allowedProtocols: ["file"],
    allowedCredentialHelpers: ["manager", "manager-core", "wincred"],
  };
}

function fixtureBareHead(bareRoot) {
  return runFixtureGit(bareRoot, ["rev-parse", "refs/heads/main"]).stdout.trim();
}

async function advanceBareRemoteFromLocal(fixture, message = "test: remote advance") {
  const { repositoryRoot, bareRoot, head } = fixture;
  const gitDir = path.join(repositoryRoot, ".git");
  const indexPath = path.join(gitDir, "index");
  const indexBefore = await readFile(indexPath);
  const unrelatedPath = path.join(repositoryRoot, "server", "src", "unrelated.mjs");
  await writeFile(unrelatedPath, "export const unrelated = 99;\n", "utf8");
  runFixtureGit(repositoryRoot, ["add", "--", "server/src/unrelated.mjs"]);
  runFixtureGit(repositoryRoot, ["commit", "-m", message]);
  const remoteHead = fixtureHead(repositoryRoot);
  await cp(path.join(gitDir, "objects"), path.join(bareRoot, "objects"), {
    recursive: true,
    force: true,
  });
  await writeFile(path.join(bareRoot, "refs", "heads", "main"), `${remoteHead}\n`, "utf8");
  await writeFile(path.join(gitDir, "refs", "heads", "main"), `${head}\n`, "utf8");
  await writeFile(indexPath, indexBefore);
  await writeFile(unrelatedPath, "export const unrelated = 1;\n", "utf8");
  return remoteHead;
}

function fixtureHead(repositoryRoot) {
  return runFixtureGit(repositoryRoot, ["rev-parse", "HEAD"]).stdout.trim();
}

function fixtureHeadPaths(repositoryRoot) {
  return runFixtureGit(
    repositoryRoot,
    ["show", "--pretty=format:", "--name-only", "HEAD"],
  ).stdout.split(/\r?\n/u).filter(Boolean).sort();
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function removeTempTree(target) {
  const retryable = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (error) {
      if (!retryable.has(error?.code) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "writer-workbench-dev-tests-"));
const originalApiKey = process.env.OPENAI_API_KEY;
let auditBefore = null;
let auditExisted = false;

try {
  const mapping = getDevTestSuiteMapping();
  assert.deepEqual(Object.keys(mapping), ["mcp", "mcp_tunnel", "all"]);
  assert.equal(mapping.mcp.executable, process.execPath);
  assert.deepEqual(mapping.mcp.argv, ["tests/tools/mcp-contract.test.mjs"]);
  assert.deepEqual(mapping.mcp_tunnel.argv, ["tests/mcp-tunnel-launcher.test.mjs"]);
  assert.deepEqual(mapping.all.argv, ["tests/run-all.mjs"]);
  assert.equal(mapping.mcp.timeout_ms, 1_500_000);
  assert.equal(mapping.mcp_tunnel.timeout_ms, 300_000);
  assert.equal(mapping.all.timeout_ms, 7_200_000);

  const dependencyBridgeWorkspace = path.join(tempRoot, "dependency-bridge-workspace");
  const dependencySourceRoot = path.join(tempRoot, "dependency-source-root");
  const fakeSdkRoot = path.join(dependencySourceRoot, "node_modules", "@modelcontextprotocol", "sdk");
  await mkdir(path.join(fakeSdkRoot, "client"), { recursive: true });
  await writeFile(
    path.join(fakeSdkRoot, "package.json"),
    `${JSON.stringify({ name: "@modelcontextprotocol/sdk", type: "module", exports: { "./client/index.js": "./client/index.js" } })}\n`,
    "utf8",
  );
  await writeFile(path.join(fakeSdkRoot, "client", "index.js"), "export class Client {}\n", "utf8");
  await mkdir(dependencyBridgeWorkspace, { recursive: true });
  await writeFile(
    path.join(dependencyBridgeWorkspace, "dependency-probe.mjs"),
    "import { Client } from '@modelcontextprotocol/sdk/client/index.js';\nif (typeof Client !== 'function') process.exit(2);\n",
    "utf8",
  );
  assert.equal(await pathExists(path.join(dependencyBridgeWorkspace, "node_modules")), false);
  const dependencyBridgeRunner = createDevTestRunner({
    suiteDefinitions: {
      mcp: testDefinition(["dependency-probe.mjs"]),
    },
    lockPath: path.join(tempRoot, "dependency-bridge.lock"),
    dependencyRoot: dependencySourceRoot,
    workspaceContextResolver: async () => ({
      workspace_id: "dev_workspace_000000000000000000000001",
      workstream_id: "dev_workstream_20260902-120000_000000000001",
      workspace_type: "isolated_worktree",
      root: dependencyBridgeWorkspace,
      branch: "dev-ws/000000000000000000000001",
      base_head: "0000000000000000000000000000000000000000",
      current_head: "0000000000000000000000000000000000000000",
    }),
  });
  const dependencyBridgeResult = await dependencyBridgeRunner({ suite: "mcp" });
  assert.equal(dependencyBridgeResult.execution_ok, true);
  assert.equal(dependencyBridgeResult.passed, true);
  assert.equal(await pathExists(path.join(dependencyBridgeWorkspace, "node_modules")), false, "server-owned dependency bridge was not cleaned");

  process.env.OPENAI_API_KEY = "sk-test-secret-not-for-child";
  const failingRunner = createDevTestRunner({
    suiteDefinitions: {
      mcp: testDefinition([
        "-e",
        `process.stdout.write("\\u001b[31mhead\\u001b[0m\\nBearer abcdefghijklmnop\\nsk-proj-1234567890abcdef\\nghp_1234567890abcdef\\nAKIA1234567890ABCDEF\\n" + "x".repeat(12000) + "\\nUSEFUL_STDOUT_TAIL\\n"); process.stderr.write("password=hunter2\\n-----BEGIN PRIVATE KEY-----\\nprivate-material\\n-----END PRIVATE KEY-----\\nUSEFUL_STDERR_TAIL\\nenv=" + (process.env.OPENAI_API_KEY ?? "missing") + "\\n"); process.exit(1);`,
      ]),
    },
    lockPath: path.join(tempRoot, "failing.lock"),
    outputMaxCharacters: 4_096,
  });
  const failed = await failingRunner({ suite: "mcp" });
  assert.equal(failed.execution_ok, true);
  assert.equal(failed.passed, false);
  assert.equal(failed.exit_code, 1);
  assert.equal(failed.signal, null);
  assert.equal(failed.timed_out, false);
  assert.equal(failed.stdout_truncated, true);
  assert(failed.stdout.includes("USEFUL_STDOUT_TAIL"));
  assert(failed.stderr.includes("USEFUL_STDERR_TAIL"));
  assert(failed.stderr.includes("env=missing"));
  assert(!failed.stdout.includes("abcdefghijklmnop"));
  assert(!failed.stdout.includes("sk-proj-1234567890abcdef"));
  assert(!failed.stdout.includes("ghp_1234567890abcdef"));
  assert(!failed.stdout.includes("AKIA1234567890ABCDEF"));
  assert(!failed.stderr.includes("hunter2"));
  assert(!failed.stderr.includes("private-material"));
  assert(!failed.stdout.includes("\u001b[31m"));

  const persistedFailure = JSON.parse(
    await readFile(path.join(tempRoot, "dev-run-tests.last.json"), "utf8"),
  );
  assert.equal(persistedFailure.suite, "mcp");
  assert.equal(persistedFailure.execution_ok, true);
  assert.equal(persistedFailure.passed, false);
  assert.equal(persistedFailure.exit_code, 1);
  assert.equal(persistedFailure.timed_out, false);
  assert.match(persistedFailure.workspace_snapshot_id, /^[a-f0-9]{64}$/u);
  assert.match(persistedFailure.head, /^[a-f0-9]{40}$/u);
  assert(Number.isFinite(persistedFailure.changed_artifact_count));
  assert(Number.isFinite(persistedFailure.snapshot_total_ms));
  assert(Number.isFinite(persistedFailure.snapshot_git_status_ms));
  assert(Number.isFinite(persistedFailure.snapshot_artifact_capture_ms));
  assert(Number.isFinite(persistedFailure.snapshot_capture_concurrency_limit));
  assert(Number.isFinite(persistedFailure.snapshot_capture_peak_concurrency));
  assert(Number.isFinite(persistedFailure.snapshot_capture_task_count));
  assert(persistedFailure.snapshot_capture_peak_concurrency <= persistedFailure.snapshot_capture_concurrency_limit);
  assert(Number.isFinite(persistedFailure.snapshot_consistency_recheck_ms));
  assert(Number.isFinite(persistedFailure.snapshot_consistency_attempt_count));
  assert(Number.isFinite(persistedFailure.snapshot_consistency_retry_count));
  assert(Number.isFinite(persistedFailure.snapshot_mutation_generation_start));
  assert(Number.isFinite(persistedFailure.snapshot_mutation_generation_end));
  assert(persistedFailure.snapshot_consistency_attempt_count >= 1);
  assert(persistedFailure.snapshot_consistency_retry_count >= 0);
  assert.equal(persistedFailure.snapshot_mutation_generation_start, persistedFailure.snapshot_mutation_generation_end);
  assert(Number.isFinite(persistedFailure.snapshot_hashed_artifact_count));
  assert(Number.isFinite(persistedFailure.snapshot_hashed_bytes));
  assert(Number.isFinite(persistedFailure.total_wall_clock_ms));
  assert(persistedFailure.total_wall_clock_ms >= persistedFailure.duration_ms);
  assert.match(persistedFailure.stdout_tail, /USEFUL_STDOUT_TAIL/u);
  assert.match(persistedFailure.stderr_tail, /USEFUL_STDERR_TAIL/u);
  assert.equal(
    persistedFailure.stdout_tail.length <= DEV_TEST_LAST_RESULT_TEXT_MAX_CHARACTERS,
    true,
  );
  assert.equal(
    persistedFailure.stderr_tail.length <= DEV_TEST_LAST_RESULT_TEXT_MAX_CHARACTERS,
    true,
  );
  assert(!persistedFailure.stdout_tail.includes("abcdefghijklmnop"));
  assert(!persistedFailure.stdout_tail.includes("sk-proj-1234567890abcdef"));
  assert(!persistedFailure.stderr_tail.includes("hunter2"));
  assert.match(persistedFailure.completed_at, /^\d{4}-\d{2}-\d{2}T/u);

  const timeoutPort = await freePort();
  const descendantCode = `require("node:net").createServer(() => {}).listen(${timeoutPort}, "127.0.0.1"); setInterval(() => {}, 1000);`;
  const parentCode = `const { spawn } = require("node:child_process"); spawn(process.execPath, ["-e", ${JSON.stringify(descendantCode)}], { stdio: "ignore", windowsHide: true }); setInterval(() => {}, 1000);`;
  const timeoutRunner = createDevTestRunner({
    suiteDefinitions: {
      mcp_tunnel: testDefinition(["-e", parentCode], {
        timeoutMs: 400,
        cleanupPort: timeoutPort,
      }),
    },
    lockPath: path.join(tempRoot, "timeout.lock"),
  });
  const timedOut = await timeoutRunner({ suite: "mcp_tunnel" });
  assert.equal(timedOut.execution_ok, true);
  assert.equal(timedOut.passed, false);
  assert.equal(timedOut.timed_out, true);
  assert.equal(await isPortAvailable(timeoutPort), true, "timeout left its descendant listener alive");

  const concurrentWorkspace = await createCommitFixture(tempRoot, "concurrent-runner-workspace");
  const concurrentRunner = createDevTestRunner({
    suiteDefinitions: {
      mcp: testDefinition(["-e", "setTimeout(() => process.exit(0), 700);"]),
    },
    lockPath: path.join(tempRoot, "concurrent.lock"),
    workspaceContextResolver: async () => ({
      workspace_id: "dev_workspace_shared_repository_v1",
      workstream_id: null,
      workspace_type: "shared",
      root: concurrentWorkspace,
      branch: "main",
      base_head: null,
      current_head: fixtureHead(concurrentWorkspace),
    }),
  });
  const firstRun = concurrentRunner({ suite: "mcp" });
  let activeLock = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    activeLock = JSON.parse(await readFile(path.join(tempRoot, "concurrent.lock"), "utf8"));
    if (Number.isInteger(activeLock.child_pid) && activeLock.child_pid > 0) break;
  }
  assert.equal(activeLock.owner_pid, process.pid);
  assert.equal(Number.isInteger(activeLock.child_pid), true);
  assert.equal(activeLock.child_pid > 0, true);
  assert.notEqual(activeLock.child_pid, process.pid);
  const busy = await concurrentRunner({ suite: "mcp" });
  const completed = await firstRun;
  assert.equal(completed.passed, true);
  assert.equal(busy.execution_ok, false);
  assert.equal(busy.passed, false);
  assert.match(busy.stderr, /already running/u);
  const persistedConcurrent = JSON.parse(
    await readFile(path.join(tempRoot, "dev-run-tests.last.json"), "utf8"),
  );
  assert.equal(persistedConcurrent.suite, "mcp");
  assert.equal(persistedConcurrent.execution_ok, true);
  assert.equal(persistedConcurrent.passed, true);
  assert.equal(persistedConcurrent.exit_code, 0);
  assert.equal(persistedConcurrent.timed_out, false);
  assert.match(persistedConcurrent.workspace_snapshot_id, /^[a-f0-9]{64}$/u);
  assert(Number.isFinite(persistedConcurrent.snapshot_total_ms));
  assert(Number.isFinite(persistedConcurrent.snapshot_capture_concurrency_limit));
  assert(Number.isFinite(persistedConcurrent.snapshot_capture_peak_concurrency));
  assert(Number.isFinite(persistedConcurrent.snapshot_capture_task_count));
  assert(persistedConcurrent.snapshot_capture_peak_concurrency <= persistedConcurrent.snapshot_capture_concurrency_limit);
  assert(Number.isFinite(persistedConcurrent.snapshot_consistency_recheck_ms));
  assert(Number.isFinite(persistedConcurrent.snapshot_consistency_attempt_count));
  assert(Number.isFinite(persistedConcurrent.snapshot_consistency_retry_count));
  assert.equal(persistedConcurrent.snapshot_mutation_generation_start, persistedConcurrent.snapshot_mutation_generation_end);
  assert(Number.isFinite(persistedConcurrent.total_wall_clock_ms));
  assert(persistedConcurrent.total_wall_clock_ms >= persistedConcurrent.duration_ms);

  const legacySelfLockPath = path.join(tempRoot, "legacy-self.lock");
  await writeFile(
    legacySelfLockPath,
    `${JSON.stringify({
      pid: process.pid,
      hostname: os.hostname(),
      suite: "all",
      started_at: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  const legacySelfRunner = createDevTestRunner({
    suiteDefinitions: {
      all: testDefinition(["-e", "process.exit(0);"]),
    },
    lockPath: legacySelfLockPath,
  });
  const reclaimedLegacySelf = await legacySelfRunner({ suite: "all" });
  assert.equal(reclaimedLegacySelf.passed, true);
  assert.equal(await pathExists(legacySelfLockPath), false);

  const launchingLockPath = path.join(tempRoot, "launching-owner.lock");
  await writeFile(
    launchingLockPath,
    `${JSON.stringify({
      owner_pid: process.pid,
      child_pid: null,
      hostname: os.hostname(),
      suite: "all",
      started_at: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  const launchingRunner = createDevTestRunner({
    suiteDefinitions: {
      all: testDefinition(["-e", "process.exit(0);"]),
    },
    lockPath: launchingLockPath,
  });
  const launchingBusy = await launchingRunner({ suite: "all" });
  assert.equal(launchingBusy.execution_ok, false);
  assert.equal(launchingBusy.passed, false);
  assert.match(launchingBusy.stderr, /already running/u);
  await rm(launchingLockPath, { force: true });

  const spawnFailureRunner = createDevTestRunner({
    suiteDefinitions: {
      all: testDefinition([], {
        executable: path.join(tempRoot, "executable-that-does-not-exist.exe"),
      }),
    },
    lockPath: path.join(tempRoot, "spawn-failure.lock"),
  });
  const spawnFailure = await spawnFailureRunner({ suite: "all" });
  assert.equal(spawnFailure.execution_ok, false);
  assert.equal(spawnFailure.passed, false);
  assert.equal(spawnFailure.exit_code, null);
  assert.match(spawnFailure.stderr, /failed to start/u);

  const gitMapping = getDevGitCommandMapping();
  assert.equal(gitMapping.executable, process.platform === "win32" ? "git.exe" : "git");
  assert.equal(gitMapping.cwd, ".");
  assert.equal(gitMapping.shell, false);
  assert.deepEqual(gitMapping.status.include_untracked_true, [
    "--no-pager", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "--branch", "--untracked-files=all",
  ]);
  assert.deepEqual(gitMapping.diff.working, [
    "--no-pager", "-c", "core.fsmonitor=false", "diff", "--no-ext-diff", "--no-textconv", "--no-color",
  ]);
  assert.deepEqual(gitMapping.diff.staged, [
    "--no-pager", "-c", "core.fsmonitor=false", "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--cached",
  ]);
  assert.deepEqual(gitMapping.diff_check.working, [
    "--no-pager", "-c", "core.fsmonitor=false",
    "-c", `core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`,
    "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--check",
  ]);
  assert.deepEqual(gitMapping.diff_check.staged, [
    "--no-pager", "-c", "core.fsmonitor=false",
    "-c", `core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`,
    "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--cached", "--check",
  ]);

  const commitMapping = getDevGitCommitCommandMapping();
  assert.equal(commitMapping.executable, process.platform === "win32" ? "git.exe" : "git");
  assert.equal(commitMapping.cwd, ".");
  assert.equal(commitMapping.shell, false);
  assert(commitMapping.fixed_prefix.includes("--literal-pathspecs"));
  assert(commitMapping.fixed_prefix.includes("core.fsmonitor=false"));
  assert(commitMapping.fixed_prefix.some((item) => item.startsWith("core.hooksPath=")));
  assert(commitMapping.fixed_prefix.includes("commit.gpgSign=false"));
  assert.deepEqual(
    commitMapping.tracked_filter_audit.ls_files.slice(-2),
    ["ls-files", "-z"],
  );
  assert.deepEqual(
    commitMapping.tracked_filter_audit.check_attr_stdin.slice(-4),
    ["check-attr", "-z", "--stdin", "filter"],
  );
  assert.deepEqual(
    commitMapping.requested_filter_check.slice(-5),
    ["check-attr", "-z", "filter", "--", "<literal validated paths>"],
  );
  assert.deepEqual(commitMapping.add.slice(-2), ["--", "<literal validated paths>"]);
  assert(commitMapping.diff_check.includes("--cached"));
  assert(commitMapping.diff_check.includes("--check"));
  assert(commitMapping.diff_check.includes("--no-ext-diff"));
  assert(commitMapping.diff_check.includes("--no-textconv"));
  assert(commitMapping.diff_check.includes(`core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`));
  assert.equal(
    DEV_GIT_WHITESPACE_POLICY,
    "blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol",
  );
  assert(commitMapping.commit.includes("--no-gpg-sign"));
  assert(commitMapping.commit.includes("-m"));
  const serializedCommitMapping = JSON.stringify(commitMapping);
  for (const forbidden of [
    " add .", "add -A", "add --all", "reset", "restore", "checkout", "clean", "stash",
    "--amend", "rebase", "merge", "push", "fetch", "pull",
  ]) {
    assert.equal(serializedCommitMapping.includes(forbidden), false, `commit mapping exposed ${forbidden}`);
  }
  const commitArgvTokens = Object.values(commitMapping)
    .filter((value) => Array.isArray(value))
    .flat();
  for (const forbiddenToken of [
    "reset", "restore", "checkout", "clean", "stash", "rebase", "merge", "tag",
    "push", "fetch", "pull", "--amend", "-A", "--all",
  ]) {
    assert.equal(
      commitArgvTokens.includes(forbiddenToken),
      false,
      `commit mapping exposed forbidden argv token ${forbiddenToken}`,
    );
  }

  const pushMapping = getDevGitPushCommandMapping();
  assert.equal(pushMapping.executable, process.platform === "win32" ? "git.exe" : "git");
  assert.equal(pushMapping.cwd, ".");
  assert.equal(pushMapping.shell, false);
  assert.equal(pushMapping.timeout_ms, 120_000);
  assert.equal(pushMapping.remote, "origin");
  assert.equal(pushMapping.branch, "main");
  assert.equal(pushMapping.upstream, "origin/main");
  assert.equal(pushMapping.canonical_url, "https://github.com/day2561124-art/wRITE.git");
  assert.deepEqual(pushMapping.allowed_protocols, ["https"]);
  assert(pushMapping.push.includes("protocol.allow=never"));
  assert(pushMapping.push.includes("protocol.https.allow=always"));
  assert(pushMapping.push.includes("protocol.ext.allow=never"));
  assert(pushMapping.push.includes("protocol.file.allow=never"));
  assert(pushMapping.push.includes("protocol.git.allow=never"));
  assert(pushMapping.push.includes("protocol.ssh.allow=never"));
  assert(pushMapping.push.includes("--no-verify"));
  assert.equal(
    pushMapping.push.at(-2),
    "https://github.com/day2561124-art/wRITE.git",
  );
  assert.equal(pushMapping.push.at(-1), "HEAD:refs/heads/main");
  for (const forbiddenToken of [
    "--force", "--force-with-lease", "--mirror", "--delete", "--tags", "--follow-tags",
    "--set-upstream", "--prune", "fetch", "pull", "reset", "restore", "checkout",
    "rebase", "merge",
  ]) {
    assert.equal(
      pushMapping.push.includes(forbiddenToken),
      false,
      `push mapping exposed forbidden argv token ${forbiddenToken}`,
    );
  }

  const remoteStatusMapping = getDevGitRemoteStatusCommandMapping();
  assert.equal(remoteStatusMapping.executable, process.platform === "win32" ? "git.exe" : "git");
  assert.equal(remoteStatusMapping.cwd, ".");
  assert.equal(remoteStatusMapping.shell, false);
  assert.equal(remoteStatusMapping.timeout_ms, 120_000);
  assert.equal(remoteStatusMapping.remote, "origin");
  assert.equal(remoteStatusMapping.branch, "main");
  assert.equal(remoteStatusMapping.tracking_ref, "refs/remotes/origin/main");
  assert.equal(remoteStatusMapping.canonical_url, "https://github.com/day2561124-art/wRITE.git");
  assert.deepEqual(remoteStatusMapping.allowed_protocols, ["https"]);
  assert(remoteStatusMapping.remote_head.includes("ls-remote"));
  assert(remoteStatusMapping.remote_head.includes("--refs"));
  assert.equal(remoteStatusMapping.remote_head.at(-2), "https://github.com/day2561124-art/wRITE.git");
  assert.equal(remoteStatusMapping.remote_head.at(-1), "refs/heads/main");
  assert(remoteStatusMapping.local_remote_relation.includes("rev-list"));
  assert(remoteStatusMapping.commit_containment.includes("merge-base"));
  for (const forbiddenToken of [
    "fetch", "pull", "push", "reset", "restore", "checkout", "rebase", "merge", "clean", "stash",
  ]) {
    assert.equal(
      remoteStatusMapping.remote_head.includes(forbiddenToken),
      false,
      `remote status mapping exposed forbidden network argv token ${forbiddenToken}`,
    );
  }

  const gitRoot = path.join(tempRoot, "git-fixture");
  await mkdir(gitRoot, { recursive: true });
  runFixtureGit(gitRoot, ["init"]);
  runFixtureGit(gitRoot, ["config", "core.autocrlf", "false"]);
  const trackedPath = path.join(gitRoot, "tracked.txt");
  const untrackedPath = path.join(gitRoot, "untracked.txt");
  await writeFile(trackedPath, "base\n", "utf8");
  runFixtureGit(gitRoot, ["add", "tracked.txt"]);
  await writeFile(trackedPath, "base\nworking change\n", "utf8");
  await writeFile(untrackedPath, "untracked\n", "utf8");

  const gitTools = createDevGitTools({
    repositoryRoot: gitRoot,
    outputMaxCharacters: 2_048,
  });
  const indexPath = path.join(gitRoot, ".git", "index");
  const indexBeforeReadTools = await readFile(indexPath);

  const gitStatus = await gitTools.status({ includeUntracked: true });
  assert.equal(gitStatus.execution_ok, true);
  assert.equal(gitStatus.exit_code, 0);
  assert.equal(gitStatus.clean, false);
  assert(gitStatus.staged.some((item) => item.path.includes("tracked.txt")));
  assert(gitStatus.modified.some((item) => item.includes("tracked.txt")));
  assert(gitStatus.untracked.some((item) => item.includes("untracked.txt")));

  const workingDiff = await gitTools.diff({ mode: "working" });
  assert.equal(workingDiff.execution_ok, true);
  assert.equal(workingDiff.exit_code, 0);
  assert.match(workingDiff.diff, /working change/u);
  const stagedDiff = await gitTools.diff({ mode: "staged" });
  assert.equal(stagedDiff.execution_ok, true);
  assert.equal(stagedDiff.exit_code, 0);
  assert.match(stagedDiff.diff, /base/u);

  const workingCheckPass = await gitTools.diffCheck({ mode: "working" });
  assert.equal(workingCheckPass.execution_ok, true);
  assert.equal(workingCheckPass.passed, true);
  assert.equal(workingCheckPass.exit_code, 0);
  assert.deepEqual(await readFile(indexPath), indexBeforeReadTools, "read-only Git tools modified the index");

  await writeFile(trackedPath, "base\nworking change  \n", "utf8");
  const workingCheckFail = await gitTools.diffCheck({ mode: "working" });
  assert.equal(workingCheckFail.execution_ok, true);
  assert.equal(workingCheckFail.passed, false);
  assert.notEqual(workingCheckFail.exit_code, 0);
  assert.match(workingCheckFail.output, /trailing whitespace/u);

  const stagedWhitespacePath = path.join(gitRoot, "staged-whitespace.txt");
  await writeFile(stagedWhitespacePath, "staged bad  \n", "utf8");
  runFixtureGit(gitRoot, ["add", "staged-whitespace.txt"]);
  const indexBeforeStagedCheck = await readFile(indexPath);
  const stagedCheckFail = await gitTools.diffCheck({ mode: "staged" });
  assert.equal(stagedCheckFail.execution_ok, true);
  assert.equal(stagedCheckFail.passed, false);
  assert.notEqual(stagedCheckFail.exit_code, 0);
  assert.match(stagedCheckFail.output, /trailing whitespace/u);
  assert.deepEqual(await readFile(indexPath), indexBeforeStagedCheck, "staged diff check modified the index");

  const crlfReadOnlyRoot = await createCommitFixture(tempRoot, "git-crlf-readonly");
  const crlfReadOnlyPath = path.join(crlfReadOnlyRoot, "server", "src", "requested.mjs");
  const crlfReadOnlyTools = createDevGitTools({ repositoryRoot: crlfReadOnlyRoot });
  await writeFile(crlfReadOnlyPath, "export const requested = 20;\r\n", "utf8");
  const crlfWorkingPass = await crlfReadOnlyTools.diffCheck({ mode: "working" });
  assert.equal(crlfWorkingPass.execution_ok, true);
  assert.equal(crlfWorkingPass.passed, true);
  assert.equal(crlfWorkingPass.exit_code, 0);
  runFixtureGit(crlfReadOnlyRoot, ["add", "--", "server/src/requested.mjs"]);
  assert(
    runFixtureGit(crlfReadOnlyRoot, ["show", ":server/src/requested.mjs"]).stdout.includes("\r\n"),
    "CRLF staged fixture was normalized before diff-check",
  );
  const crlfStagedPass = await crlfReadOnlyTools.diffCheck({ mode: "staged" });
  assert.equal(crlfStagedPass.execution_ok, true);
  assert.equal(crlfStagedPass.passed, true);
  assert.equal(crlfStagedPass.exit_code, 0);

  await writeFile(crlfReadOnlyPath, "export const requested = 21;  \r\n", "utf8");
  const crlfWorkingSpaceFail = await crlfReadOnlyTools.diffCheck({ mode: "working" });
  assert.equal(crlfWorkingSpaceFail.execution_ok, true);
  assert.equal(crlfWorkingSpaceFail.passed, false);
  assert.match(crlfWorkingSpaceFail.output, /trailing whitespace/u);
  runFixtureGit(crlfReadOnlyRoot, ["add", "--", "server/src/requested.mjs"]);
  const crlfStagedSpaceFail = await crlfReadOnlyTools.diffCheck({ mode: "staged" });
  assert.equal(crlfStagedSpaceFail.execution_ok, true);
  assert.equal(crlfStagedSpaceFail.passed, false);
  assert.match(crlfStagedSpaceFail.output, /trailing whitespace/u);

  await writeFile(crlfReadOnlyPath, "export const requested = 22;\t\r\n", "utf8");
  const crlfWorkingTabFail = await crlfReadOnlyTools.diffCheck({ mode: "working" });
  assert.equal(crlfWorkingTabFail.execution_ok, true);
  assert.equal(crlfWorkingTabFail.passed, false);
  assert.match(crlfWorkingTabFail.output, /trailing whitespace/u);
  runFixtureGit(crlfReadOnlyRoot, ["add", "--", "server/src/requested.mjs"]);
  const crlfStagedTabFail = await crlfReadOnlyTools.diffCheck({ mode: "staged" });
  assert.equal(crlfStagedTabFail.execution_ok, true);
  assert.equal(crlfStagedTabFail.passed, false);
  assert.match(crlfStagedTabFail.output, /trailing whitespace/u);

  const secretToken = "sk-proj-1234567890abcdef";
  await writeFile(
    trackedPath,
    `base\n\u001b[31msecret\u001b[0m\nBearer abcdefghijklmnop\n${secretToken}\n${"x".repeat(12_000)}\nUSEFUL_GIT_TAIL\n`,
    "utf8",
  );
  const indexBeforeLargeDiff = await readFile(indexPath);
  const largeDiff = await gitTools.diff({ mode: "working" });
  assert.equal(largeDiff.execution_ok, true);
  assert.equal(largeDiff.exit_code, 0);
  assert.equal(largeDiff.truncated, true);
  assert(largeDiff.characters > 2_048);
  assert(largeDiff.bytes >= largeDiff.characters);
  assert(largeDiff.diff.includes("USEFUL_GIT_TAIL"));
  assert(!largeDiff.diff.includes(secretToken));
  assert(!largeDiff.diff.includes("abcdefghijklmnop"));
  assert(!largeDiff.diff.includes("\u001b[31m"));
  assert.deepEqual(await readFile(indexPath), indexBeforeLargeDiff, "bounded Git diff modified the index");
  assert.equal(await readFile(untrackedPath, "utf8"), "untracked\n");

  const successCommitRoot = await createCommitFixture(tempRoot, "commit-success");
  const successCommitTool = createDevGitCommitTool({ repositoryRoot: successCommitRoot });
  const successHeadBefore = fixtureHead(successCommitRoot);
  await writeFile(
    path.join(successCommitRoot, "server", "src", "requested.mjs"),
    "export const requested = 2;\n",
    "utf8",
  );
  const successCommit = await successCommitTool({
    paths: ["server/src/requested.mjs"],
    message: "test: controlled commit success",
  });
  assert.equal(successCommit.execution_ok, true);
  assert.equal(successCommit.committed, true);
  assert.equal(successCommit.commit_created, true);
  assert.notEqual(successCommit.commit, successHeadBefore);
  assert.equal(successCommit.files_changed, 1);
  assert.equal(successCommit.branch !== null, true);
  assert.equal(successCommit.working_tree_clean, true);
  assert.deepEqual(fixtureHeadPaths(successCommitRoot), ["server/src/requested.mjs"]);

  const multipleCommitRoot = await createCommitFixture(tempRoot, "commit-multiple-untracked");
  const multipleCommitTool = createDevGitCommitTool({ repositoryRoot: multipleCommitRoot });
  await writeFile(
    path.join(multipleCommitRoot, "server", "src", "requested.mjs"),
    "export const requested = 3;\n",
    "utf8",
  );
  await writeFile(
    path.join(multipleCommitRoot, "tests", "new-commit.test.mjs"),
    "export const newCommitTest = true;\n",
    "utf8",
  );
  const multipleCommit = await multipleCommitTool({
    paths: ["server/src/requested.mjs", "tests/new-commit.test.mjs"],
    message: "test: commit multiple paths",
  });
  assert.equal(multipleCommit.committed, true);
  assert.equal(multipleCommit.files_changed, 2);
  assert.deepEqual(
    fixtureHeadPaths(multipleCommitRoot),
    ["server/src/requested.mjs", "tests/new-commit.test.mjs"],
  );

  const unrelatedRoot = await createCommitFixture(tempRoot, "commit-unrelated-unstaged");
  const unrelatedTool = createDevGitCommitTool({ repositoryRoot: unrelatedRoot });
  await writeFile(
    path.join(unrelatedRoot, "server", "src", "requested.mjs"),
    "export const requested = 4;\n",
    "utf8",
  );
  await writeFile(
    path.join(unrelatedRoot, "server", "src", "unrelated.mjs"),
    "export const unrelated = 99;\n",
    "utf8",
  );
  const unrelatedCommit = await unrelatedTool({
    paths: ["server/src/requested.mjs"],
    message: "test: leave unrelated unstaged",
  });
  assert.equal(unrelatedCommit.committed, true);
  assert.equal(unrelatedCommit.working_tree_clean, false);
  assert.deepEqual(fixtureHeadPaths(unrelatedRoot), ["server/src/requested.mjs"]);
  assert.match(
    runFixtureGit(unrelatedRoot, ["diff", "--name-only"]).stdout,
    /server\/src\/unrelated\.mjs/u,
  );

  const prestagedRoot = await createCommitFixture(tempRoot, "commit-unrelated-prestaged");
  const prestagedTool = createDevGitCommitTool({ repositoryRoot: prestagedRoot });
  await writeFile(
    path.join(prestagedRoot, "server", "src", "unrelated.mjs"),
    "export const unrelated = 5;\n",
    "utf8",
  );
  runFixtureGit(prestagedRoot, ["add", "--", "server/src/unrelated.mjs"]);
  await writeFile(
    path.join(prestagedRoot, "server", "src", "requested.mjs"),
    "export const requested = 5;\n",
    "utf8",
  );
  const prestagedIndexPath = path.join(prestagedRoot, ".git", "index");
  const prestagedIndexBefore = await readFile(prestagedIndexPath);
  const prestagedHeadBefore = fixtureHead(prestagedRoot);
  const prestagedReject = await prestagedTool({
    paths: ["server/src/requested.mjs"],
    message: "test: reject unrelated prestaged",
  });
  assert.equal(prestagedReject.committed, false);
  assert.match(prestagedReject.reason, /preexisting unrelated staged changes/iu);
  assert.deepEqual(await readFile(prestagedIndexPath), prestagedIndexBefore);
  assert.equal(fixtureHead(prestagedRoot), prestagedHeadBefore);
  assert.match(
    runFixtureGit(prestagedRoot, ["diff", "--cached", "--name-only"]).stdout,
    /server\/src\/unrelated\.mjs/u,
  );

  const invalidCommitRoot = await createCommitFixture(tempRoot, "commit-invalid-inputs");
  const invalidCommitTool = createDevGitCommitTool({ repositoryRoot: invalidCommitRoot });
  for (const invalidPath of [
    "../x",
    "C:\\x",
    path.resolve(invalidCommitRoot, "absolute.mjs"),
    "*",
    ":(glob)*",
    "--all",
    "data/canon_db/active_engine.md",
    ".git/config",
  ]) {
    const rejected = await invalidCommitTool({
      paths: [invalidPath],
      message: "test: rejected path",
    });
    assert.equal(rejected.committed, false, `invalid path was accepted: ${invalidPath}`);
    assert.equal(rejected.execution_ok, false, `invalid path did not fail validation: ${invalidPath}`);
  }

  const noOpRoot = await createCommitFixture(tempRoot, "commit-no-op");
  const noOpTool = createDevGitCommitTool({ repositoryRoot: noOpRoot });
  const noOpHeadBefore = fixtureHead(noOpRoot);
  const noOp = await noOpTool({
    paths: ["server/src/requested.mjs"],
    message: "test: no empty commit",
  });
  assert.equal(noOp.committed, false);
  assert.equal(noOp.stage_completed, true);
  assert.match(noOp.reason, /no staged changes|empty commits/u);
  assert.equal(fixtureHead(noOpRoot), noOpHeadBefore);
  assert.equal(
    runFixtureGit(noOpRoot, ["diff", "--cached", "--name-only"]).stdout.trim(),
    "",
  );

  const whitespaceRoot = await createCommitFixture(tempRoot, "commit-whitespace");
  const whitespaceTool = createDevGitCommitTool({ repositoryRoot: whitespaceRoot });
  const whitespaceHeadBefore = fixtureHead(whitespaceRoot);
  await writeFile(
    path.join(whitespaceRoot, "server", "src", "requested.mjs"),
    "export const requested = 6;  \n",
    "utf8",
  );
  const whitespaceReject = await whitespaceTool({
    paths: ["server/src/requested.mjs"],
    message: "test: whitespace must fail",
  });
  assert.equal(whitespaceReject.committed, false);
  assert.equal(whitespaceReject.stage_completed, true);
  assert.match(whitespaceReject.reason, /diff --check failed/u);
  assert.equal(fixtureHead(whitespaceRoot), whitespaceHeadBefore);
  assert.match(
    runFixtureGit(whitespaceRoot, ["diff", "--cached", "--name-only"]).stdout,
    /server\/src\/requested\.mjs/u,
  );

  const crlfCommitRoot = await createCommitFixture(tempRoot, "commit-crlf-clean");
  const crlfCommitTool = createDevGitCommitTool({ repositoryRoot: crlfCommitRoot });
  const crlfCommitPath = path.join(crlfCommitRoot, "server", "src", "requested.mjs");
  const crlfCommitHeadBefore = fixtureHead(crlfCommitRoot);
  await writeFile(crlfCommitPath, "export const requested = 61;\r\n", "utf8");
  const crlfCommit = await crlfCommitTool({
    paths: ["server/src/requested.mjs"],
    message: "test: clean CRLF commit succeeds",
  });
  assert.equal(crlfCommit.execution_ok, true);
  assert.equal(crlfCommit.committed, true);
  assert.equal(crlfCommit.commit_created, true);
  assert.notEqual(crlfCommit.commit, crlfCommitHeadBefore);
  assert(
    runFixtureGit(crlfCommitRoot, ["show", "HEAD:server/src/requested.mjs"]).stdout.includes("\r\n"),
    "clean CRLF commit fixture was normalized before commit",
  );

  const crlfSpaceRoot = await createCommitFixture(tempRoot, "commit-crlf-trailing-space");
  const crlfSpaceTool = createDevGitCommitTool({ repositoryRoot: crlfSpaceRoot });
  const crlfSpaceHeadBefore = fixtureHead(crlfSpaceRoot);
  await writeFile(
    path.join(crlfSpaceRoot, "server", "src", "requested.mjs"),
    "export const requested = 62;  \r\n",
    "utf8",
  );
  const crlfSpaceReject = await crlfSpaceTool({
    paths: ["server/src/requested.mjs"],
    message: "test: CRLF trailing spaces fail",
  });
  assert.equal(crlfSpaceReject.committed, false);
  assert.equal(crlfSpaceReject.stage_completed, true);
  assert.match(crlfSpaceReject.reason, /diff --check failed/u);
  assert.match(crlfSpaceReject.reason, /trailing whitespace/u);
  assert.equal(fixtureHead(crlfSpaceRoot), crlfSpaceHeadBefore);

  const crlfTabRoot = await createCommitFixture(tempRoot, "commit-crlf-trailing-tab");
  const crlfTabTool = createDevGitCommitTool({ repositoryRoot: crlfTabRoot });
  const crlfTabHeadBefore = fixtureHead(crlfTabRoot);
  await writeFile(
    path.join(crlfTabRoot, "server", "src", "requested.mjs"),
    "export const requested = 63;\t\r\n",
    "utf8",
  );
  const crlfTabReject = await crlfTabTool({
    paths: ["server/src/requested.mjs"],
    message: "test: CRLF trailing tab fails",
  });
  assert.equal(crlfTabReject.committed, false);
  assert.equal(crlfTabReject.stage_completed, true);
  assert.match(crlfTabReject.reason, /diff --check failed/u);
  assert.match(crlfTabReject.reason, /trailing whitespace/u);
  assert.equal(fixtureHead(crlfTabRoot), crlfTabHeadBefore);

  const hookRoot = await createCommitFixture(tempRoot, "commit-hook-disabled");
  const hookTool = createDevGitCommitTool({ repositoryRoot: hookRoot });
  const hookMarker = path.join(hookRoot, "hook-marker.txt");
  const hookMarkerForShell = hookMarker.replaceAll("\\", "/").replaceAll('"', '\\"');
  const preCommitHook = path.join(hookRoot, ".git", "hooks", "pre-commit");
  await writeFile(
    preCommitHook,
    `#!/bin/sh\nprintf hook > "${hookMarkerForShell}"\nexit 1\n`,
    "utf8",
  );
  await chmod(preCommitHook, 0o755);
  await writeFile(
    path.join(hookRoot, "server", "src", "requested.mjs"),
    "export const requested = 7;\n",
    "utf8",
  );
  const hookCommit = await hookTool({
    paths: ["server/src/requested.mjs"],
    message: "test: repository hook is disabled",
  });
  assert.equal(hookCommit.committed, true);
  assert.equal(await pathExists(hookMarker), false, "malicious pre-commit hook executed");

  const messageRoot = await createCommitFixture(tempRoot, "commit-message-literal");
  const messageTool = createDevGitCommitTool({ repositoryRoot: messageRoot });
  await writeFile(
    path.join(messageRoot, "server", "src", "requested.mjs"),
    "export const requested = 8;\n",
    "utf8",
  );
  const literalMessage = '--amend -m evil $(whoami) "; powershell -NoProfile';
  const messageCommit = await messageTool({
    paths: ["server/src/requested.mjs"],
    message: literalMessage,
  });
  assert.equal(messageCommit.committed, true);
  assert.equal(
    runFixtureGit(messageRoot, ["log", "-1", "--format=%s"]).stdout.trim(),
    literalMessage,
  );

  const filterRoot = await createCommitFixture(tempRoot, "commit-filter-blocked");
  const filterTool = createDevGitCommitTool({ repositoryRoot: filterRoot });
  const filterMarker = path.join(filterRoot, "filter-marker.txt");
  await writeFile(
    path.join(filterRoot, ".gitattributes"),
    "server/src/requested.mjs filter=evil\n",
    "utf8",
  );
  runFixtureGit(filterRoot, [
    "config",
    "filter.evil.clean",
    `node -e "require('node:fs').writeFileSync('${filterMarker.replaceAll("\\", "/")}', 'ran')"`,
  ]);
  await writeFile(
    path.join(filterRoot, "server", "src", "requested.mjs"),
    "export const requested = 9;\n",
    "utf8",
  );
  const filterReject = await filterTool({
    paths: ["server/src/requested.mjs"],
    message: "test: block external clean filter",
  });
  assert.equal(filterReject.committed, false);
  assert.match(filterReject.reason, /Git filters|external filter execution is blocked/u);
  assert.equal(await pathExists(filterMarker), false, "configured clean filter executed");

  const processFilterRoot = await createCommitFixture(tempRoot, "commit-process-filter-blocked");
  const processFilterTool = createDevGitCommitTool({ repositoryRoot: processFilterRoot });
  const processFilterMarker = path.join(processFilterRoot, "process-filter-marker.txt");
  await writeFile(
    path.join(processFilterRoot, ".gitattributes"),
    "server/src/requested.mjs filter=evilprocess\n",
    "utf8",
  );
  runFixtureGit(processFilterRoot, [
    "config",
    "filter.evilprocess.process",
    `node -e "require('node:fs').writeFileSync('${processFilterMarker.replaceAll("\\", "/")}', 'ran'); process.exit(1)"`,
  ]);
  await writeFile(
    path.join(processFilterRoot, "server", "src", "requested.mjs"),
    "export const requested = 91;\n",
    "utf8",
  );
  const processFilterReject = await processFilterTool({
    paths: ["server/src/requested.mjs"],
    message: "test: block external process filter",
  });
  assert.equal(processFilterReject.committed, false);
  assert.match(processFilterReject.reason, /Git filters|external filter execution is blocked/u);
  assert.equal(
    await pathExists(processFilterMarker),
    false,
    "configured process filter executed",
  );

  const untrackedFilterRoot = await createCommitFixture(tempRoot, "commit-untracked-filter-blocked");
  const untrackedFilterTool = createDevGitCommitTool({ repositoryRoot: untrackedFilterRoot });
  const untrackedFilterMarker = path.join(untrackedFilterRoot, "untracked-filter-marker.txt");
  await writeFile(
    path.join(untrackedFilterRoot, ".gitattributes"),
    "tests/新規-filter.test.mjs filter=eviluntracked\n",
    "utf8",
  );
  runFixtureGit(untrackedFilterRoot, [
    "config",
    "filter.eviluntracked.clean",
    `node -e "require('node:fs').writeFileSync('${untrackedFilterMarker.replaceAll("\\", "/")}', 'ran')"`,
  ]);
  await writeFile(
    path.join(untrackedFilterRoot, "tests", "新規-filter.test.mjs"),
    "export const untrackedFilter = true;\n",
    "utf8",
  );
  const untrackedFilterReject = await untrackedFilterTool({
    paths: ["tests/新規-filter.test.mjs"],
    message: "test: audit untracked requested filter",
  });
  assert.equal(untrackedFilterReject.committed, false);
  assert.match(untrackedFilterReject.reason, /Requested paths use Git filters|external filter execution is blocked/u);
  assert.equal(
    await pathExists(untrackedFilterMarker),
    false,
    "requested untracked clean filter executed",
  );

  const commitFailureRoot = await createCommitFixture(tempRoot, "commit-failure-preserves-index");
  const commitFailureTool = createDevGitCommitTool({ repositoryRoot: commitFailureRoot });
  runFixtureGit(commitFailureRoot, ["config", "user.name", ""]);
  runFixtureGit(commitFailureRoot, ["config", "user.email", ""]);
  await writeFile(
    path.join(commitFailureRoot, "server", "src", "requested.mjs"),
    "export const requested = 10;\n",
    "utf8",
  );
  const failureHeadBefore = fixtureHead(commitFailureRoot);
  const commitFailure = await commitFailureTool({
    paths: ["server/src/requested.mjs"],
    message: "test: commit failure preserves index",
  });
  assert.equal(commitFailure.committed, false);
  assert.equal(commitFailure.stage_completed, true);
  assert.match(commitFailure.reason, /git commit failed/u);
  assert.equal(fixtureHead(commitFailureRoot), failureHeadBefore);
  assert.match(
    runFixtureGit(commitFailureRoot, ["diff", "--cached", "--name-only"]).stdout,
    /server\/src\/requested\.mjs/u,
  );

  const remoteStatusFixture = await createPushFixture(tempRoot, "remote-status");
  const remoteStatusTool = createDevGitRemoteStatusTool({
    repositoryRoot: remoteStatusFixture.repositoryRoot,
    policy: pushTestPolicy(remoteStatusFixture.remoteUrl),
  });
  const remoteStatusTrackingPath = path.join(
    remoteStatusFixture.repositoryRoot,
    ".git",
    "refs",
    "remotes",
    "origin",
    "main",
  );
  const remoteStatusIndexPath = path.join(remoteStatusFixture.repositoryRoot, ".git", "index");
  const remoteStatusTrackingBefore = await readFile(remoteStatusTrackingPath, "utf8");
  const remoteStatusIndexBefore = await readFile(remoteStatusIndexPath);
  const remoteStatusBeforePush = await remoteStatusTool({
    commits: [remoteStatusFixture.baseHead, remoteStatusFixture.head],
  });
  assert.equal(remoteStatusBeforePush.execution_ok, true);
  assert.equal(remoteStatusBeforePush.authoritative_remote_read, true);
  assert.equal(remoteStatusBeforePush.remote, "origin");
  assert.equal(remoteStatusBeforePush.branch, "main");
  assert.equal(remoteStatusBeforePush.local_head, remoteStatusFixture.head);
  assert.equal(remoteStatusBeforePush.local_branch, "main");
  assert.equal(remoteStatusBeforePush.local_branch_matches_policy, true);
  assert.equal(remoteStatusBeforePush.tracking_head, remoteStatusFixture.baseHead);
  assert.equal(remoteStatusBeforePush.remote_head, remoteStatusFixture.baseHead);
  assert.equal(remoteStatusBeforePush.tracking_matches_remote, true);
  assert.equal(remoteStatusBeforePush.tracking_stale, false);
  assert.equal(remoteStatusBeforePush.local_matches_remote, false);
  assert.equal(remoteStatusBeforePush.remote_head_object_available_locally, true);
  assert.equal(remoteStatusBeforePush.local_ahead_remote, 1);
  assert.equal(remoteStatusBeforePush.local_behind_remote, 0);
  assert.equal(remoteStatusBeforePush.local_remote_relation, "local_ahead");
  assert.equal(remoteStatusBeforePush.dirty_worktree_allowed, true);
  assert.equal(
    remoteStatusBeforePush.commit_checks.find((item) => item.sha === remoteStatusFixture.baseHead)?.remote_contains,
    true,
  );
  assert.equal(
    remoteStatusBeforePush.commit_checks.find((item) => item.sha === remoteStatusFixture.head)?.remote_contains,
    false,
  );
  assert.equal(await readFile(remoteStatusTrackingPath, "utf8"), remoteStatusTrackingBefore);
  assert.deepEqual(await readFile(remoteStatusIndexPath), remoteStatusIndexBefore);

  runFixtureGit(remoteStatusFixture.repositoryRoot, [
    "push",
    remoteStatusFixture.remoteUrl,
    "HEAD:refs/heads/main",
  ]);
  await writeFile(
    path.join(remoteStatusFixture.repositoryRoot, "server", "src", "unrelated.mjs"),
    "export const unrelated = 123;\n",
    "utf8",
  );
  const staleTrackingStatus = await remoteStatusTool({
    commits: [remoteStatusFixture.baseHead, remoteStatusFixture.head],
  });
  assert.equal(staleTrackingStatus.execution_ok, true);
  assert.equal(staleTrackingStatus.authoritative_remote_read, true);
  assert.equal(staleTrackingStatus.local_head, remoteStatusFixture.head);
  assert.equal(staleTrackingStatus.remote_head, remoteStatusFixture.head);
  assert.equal(staleTrackingStatus.tracking_head, remoteStatusFixture.baseHead);
  assert.equal(staleTrackingStatus.tracking_matches_remote, false);
  assert.equal(staleTrackingStatus.tracking_stale, true);
  assert.equal(staleTrackingStatus.local_matches_remote, true);
  assert.equal(staleTrackingStatus.local_ahead_remote, 0);
  assert.equal(staleTrackingStatus.local_behind_remote, 0);
  assert.equal(staleTrackingStatus.local_remote_relation, "equal");
  assert.equal(staleTrackingStatus.working_tree_status_read_ok, true);
  assert.equal(staleTrackingStatus.working_tree_clean, false);
  assert.equal(
    staleTrackingStatus.commit_checks.every((item) => item.remote_contains === true),
    true,
  );
  assert.equal(
    await readFile(remoteStatusTrackingPath, "utf8"),
    remoteStatusTrackingBefore,
    "dev_git_remote_status mutated the stale local origin/main tracking ref",
  );
  assert.deepEqual(
    await readFile(remoteStatusIndexPath),
    remoteStatusIndexBefore,
    "dev_git_remote_status modified the Git index",
  );

  for (const invalidRemoteStatusInput of [
    { commits: ["not-a-sha"] },
    { commits: [remoteStatusFixture.head], command: "ls-remote" },
    { commits: Array.from({ length: 101 }, () => remoteStatusFixture.head) },
  ]) {
    const invalidRemoteStatus = await remoteStatusTool(invalidRemoteStatusInput);
    assert.equal(invalidRemoteStatus.execution_ok, false);
    assert.equal(invalidRemoteStatus.authoritative_remote_read, false);
    assert.equal(invalidRemoteStatus.reason, "INVALID_INPUT");
  }

  const pushSuccessFixture = await createPushFixture(tempRoot, "push-success");
  const pushSuccessTool = createDevGitPushTool({
    repositoryRoot: pushSuccessFixture.repositoryRoot,
    policy: pushTestPolicy(pushSuccessFixture.remoteUrl),
  });
  const pushSuccessLocalBefore = fixtureHead(pushSuccessFixture.repositoryRoot);
  const pushSuccessRemoteBefore = fixtureBareHead(pushSuccessFixture.bareRoot);
  assert.equal(pushSuccessRemoteBefore, pushSuccessFixture.baseHead);
  const pushSuccess = await pushSuccessTool({ expectedHead: pushSuccessFixture.head });
  assert.equal(pushSuccess.execution_ok, true);
  assert.equal(pushSuccess.pushed, true, JSON.stringify(pushSuccess));
  assert.equal(pushSuccess.remote, "origin");
  assert.equal(pushSuccess.branch, "main");
  assert.equal(pushSuccess.head, pushSuccessFixture.head);
  assert.equal(pushSuccess.upstream, "origin/main");
  assert.equal(pushSuccess.ahead_before, 1);
  assert.equal(pushSuccess.behind_before, 0);
  assert.equal(pushSuccess.exit_code, 0);
  assert.equal(pushSuccess.timed_out, false);
  assert.equal(fixtureBareHead(pushSuccessFixture.bareRoot), pushSuccessFixture.head);
  assert.equal(fixtureHead(pushSuccessFixture.repositoryRoot), pushSuccessLocalBefore);

  const stalePushFixture = await createPushFixture(tempRoot, "push-stale-head");
  const stalePushTool = createDevGitPushTool({
    repositoryRoot: stalePushFixture.repositoryRoot,
    policy: pushTestPolicy(stalePushFixture.remoteUrl),
  });
  const staleRemoteBefore = fixtureBareHead(stalePushFixture.bareRoot);
  const stalePush = await stalePushTool({ expectedHead: stalePushFixture.baseHead });
  assert.equal(stalePush.execution_ok, true);
  assert.equal(stalePush.pushed, false);
  assert.equal(stalePush.reason, "STALE_HEAD");
  assert.equal(fixtureBareHead(stalePushFixture.bareRoot), staleRemoteBefore);

  const modifiedPushFixture = await createPushFixture(tempRoot, "push-working-modified");
  const modifiedPushTool = createDevGitPushTool({
    repositoryRoot: modifiedPushFixture.repositoryRoot,
    policy: pushTestPolicy(modifiedPushFixture.remoteUrl),
  });
  const modifiedPushPath = path.join(modifiedPushFixture.repositoryRoot, "server", "src", "requested.mjs");
  await writeFile(modifiedPushPath, "export const requested = 43;\n", "utf8");
  const modifiedPushWorkingBefore = await readFile(modifiedPushPath, "utf8");
  const modifiedPushIndexPath = path.join(modifiedPushFixture.repositoryRoot, ".git", "index");
  const modifiedPushIndexBefore = await readFile(modifiedPushIndexPath);
  const modifiedPushTrackingPath = path.join(modifiedPushFixture.repositoryRoot, ".git", "refs", "remotes", "origin", "main");
  const modifiedPushTrackingBefore = await readFile(modifiedPushTrackingPath, "utf8");
  const modifiedPush = await modifiedPushTool({ expectedHead: modifiedPushFixture.head });
  assert.equal(modifiedPush.pushed, true, JSON.stringify(modifiedPush));
  assert.equal(modifiedPush.authoritative_remote_verified, true);
  assert.equal(modifiedPush.working_tree_dirty, true);
  assert.equal(modifiedPush.modified_count > 0, true);
  assert.equal(modifiedPush.untracked_count, 0);
  assert.equal(modifiedPush.staged_count, 0);
  assert.equal(modifiedPush.conflicted_count, 0);
  assert.equal(modifiedPush.remote_head_before, modifiedPushFixture.baseHead);
  assert.equal(modifiedPush.remote_head_after, modifiedPushFixture.head);
  assert.equal(await readFile(modifiedPushPath, "utf8"), modifiedPushWorkingBefore);
  assert.deepEqual(await readFile(modifiedPushIndexPath), modifiedPushIndexBefore);
  assert.equal(await readFile(modifiedPushTrackingPath, "utf8"), modifiedPushTrackingBefore);

  const stagedPushFixture = await createPushFixture(tempRoot, "push-staged");
  const stagedPushTool = createDevGitPushTool({
    repositoryRoot: stagedPushFixture.repositoryRoot,
    policy: pushTestPolicy(stagedPushFixture.remoteUrl),
  });
  await writeFile(
    path.join(stagedPushFixture.repositoryRoot, "server", "src", "requested.mjs"),
    "export const requested = 44;\n",
    "utf8",
  );
  runFixtureGit(stagedPushFixture.repositoryRoot, ["add", "--", "server/src/requested.mjs"]);
  const stagedPush = await stagedPushTool({ expectedHead: stagedPushFixture.head });
  assert.equal(stagedPush.pushed, false);
  assert.equal(stagedPush.reason, "STAGED_CHANGES");

  const conflictedPushFixture = await createPushFixture(tempRoot, "push-conflicted");
  const conflictedPushTool = createDevGitPushTool({
    repositoryRoot: conflictedPushFixture.repositoryRoot,
    policy: pushTestPolicy(conflictedPushFixture.remoteUrl),
  });
  const conflictPath = "server/src/requested.mjs";
  const conflictBaseBlob = runFixtureGit(conflictedPushFixture.repositoryRoot, [
    "rev-parse", `${conflictedPushFixture.baseHead}:${conflictPath}`,
  ]).stdout.trim();
  const conflictOursBlob = runFixtureGit(conflictedPushFixture.repositoryRoot, [
    "rev-parse", `${conflictedPushFixture.head}:${conflictPath}`,
  ]).stdout.trim();
  const conflictTheirsPath = path.join(conflictedPushFixture.repositoryRoot, "conflict-theirs.txt");
  await writeFile(conflictTheirsPath, "export const requested = 999;\n", "utf8");
  const conflictTheirsBlob = runFixtureGit(conflictedPushFixture.repositoryRoot, [
    "hash-object", "-w", "--", conflictTheirsPath,
  ]).stdout.trim();
  runFixtureGitWithInput(
    conflictedPushFixture.repositoryRoot,
    ["update-index", "--index-info"],
    [
      `0 ${"0".repeat(40)}\t${conflictPath}`,
      `100644 ${conflictBaseBlob} 1\t${conflictPath}`,
      `100644 ${conflictOursBlob} 2\t${conflictPath}`,
      `100644 ${conflictTheirsBlob} 3\t${conflictPath}`,
      "",
    ].join("\n"),
  );
  const conflictedPush = await conflictedPushTool({ expectedHead: conflictedPushFixture.head });
  assert.equal(conflictedPush.pushed, false);
  assert.equal(conflictedPush.reason, "CONFLICTED");
  assert.equal(conflictedPush.conflicted_count > 0, true);

  const untrackedPushFixture = await createPushFixture(tempRoot, "push-untracked");
  const untrackedPushTool = createDevGitPushTool({
    repositoryRoot: untrackedPushFixture.repositoryRoot,
    policy: pushTestPolicy(untrackedPushFixture.remoteUrl),
  });
  const untrackedPushPath = path.join(untrackedPushFixture.repositoryRoot, "untracked.txt");
  await writeFile(untrackedPushPath, "nope\n", "utf8");
  const untrackedPushBefore = await readFile(untrackedPushPath, "utf8");
  const untrackedPush = await untrackedPushTool({ expectedHead: untrackedPushFixture.head });
  assert.equal(untrackedPush.pushed, true, JSON.stringify(untrackedPush));
  assert.equal(untrackedPush.working_tree_dirty, true);
  assert.equal(untrackedPush.modified_count, 0);
  assert.equal(untrackedPush.untracked_count, 1);
  assert.equal(untrackedPush.staged_count, 0);
  assert.equal(untrackedPush.conflicted_count, 0);
  assert.equal(await readFile(untrackedPushPath, "utf8"), untrackedPushBefore);

  const truncatedUntrackedPushFixture = await createPushFixture(tempRoot, "push-truncated-untracked-status");
  for (let index = 0; index < 200; index += 1) {
    const suffix = `${String(index).padStart(3, "0")}-${"x".repeat(64)}.txt`;
    await writeFile(
      path.join(truncatedUntrackedPushFixture.repositoryRoot, `untracked-${suffix}`),
      "preserve me\n",
      "utf8",
    );
  }
  const truncatedUntrackedPushTool = createDevGitPushTool({
    repositoryRoot: truncatedUntrackedPushFixture.repositoryRoot,
    policy: pushTestPolicy(truncatedUntrackedPushFixture.remoteUrl),
    outputMaxCharacters: 4096,
  });
  const truncatedUntrackedPush = await truncatedUntrackedPushTool({ expectedHead: truncatedUntrackedPushFixture.head });
  assert.equal(truncatedUntrackedPush.pushed, true, JSON.stringify(truncatedUntrackedPush));
  assert.equal(truncatedUntrackedPush.authoritative_remote_verified, true);
  assert.equal(truncatedUntrackedPush.working_tree_dirty, true);
  assert.equal(truncatedUntrackedPush.untracked_count > 0, true);
  assert.equal(truncatedUntrackedPush.staged_count, 0);
  assert.equal(truncatedUntrackedPush.conflicted_count, 0);
  assert.equal(fixtureBareHead(truncatedUntrackedPushFixture.bareRoot), truncatedUntrackedPushFixture.head);

  const combinedDirtyPushFixture = await createPushFixture(tempRoot, "push-combined-dirty");
  const combinedDirtyPushTool = createDevGitPushTool({
    repositoryRoot: combinedDirtyPushFixture.repositoryRoot,
    policy: pushTestPolicy(combinedDirtyPushFixture.remoteUrl),
  });
  const combinedModifiedPath = path.join(combinedDirtyPushFixture.repositoryRoot, "server", "src", "requested.mjs");
  const combinedUntrackedPath = path.join(combinedDirtyPushFixture.repositoryRoot, "untracked.txt");
  await writeFile(combinedModifiedPath, "export const requested = 45;\n", "utf8");
  await writeFile(combinedUntrackedPath, "preserve me\n", "utf8");
  const combinedModifiedBefore = await readFile(combinedModifiedPath, "utf8");
  const combinedUntrackedBefore = await readFile(combinedUntrackedPath, "utf8");
  const combinedDirtyPush = await combinedDirtyPushTool({ expectedHead: combinedDirtyPushFixture.head });
  assert.equal(combinedDirtyPush.pushed, true, JSON.stringify(combinedDirtyPush));
  assert.equal(combinedDirtyPush.working_tree_dirty, true);
  assert.equal(combinedDirtyPush.modified_count > 0, true);
  assert.equal(combinedDirtyPush.untracked_count, 1);
  assert.equal(combinedDirtyPush.staged_count, 0);
  assert.equal(combinedDirtyPush.conflicted_count, 0);
  assert.equal(await readFile(combinedModifiedPath, "utf8"), combinedModifiedBefore);
  assert.equal(await readFile(combinedUntrackedPath, "utf8"), combinedUntrackedBefore);

  const detachedPushFixture = await createPushFixture(tempRoot, "push-detached");
  const detachedPushTool = createDevGitPushTool({
    repositoryRoot: detachedPushFixture.repositoryRoot,
    policy: pushTestPolicy(detachedPushFixture.remoteUrl),
  });
  await writeFile(
    path.join(detachedPushFixture.repositoryRoot, ".git", "HEAD"),
    `${detachedPushFixture.head}\n`,
    "utf8",
  );
  const detachedPush = await detachedPushTool({ expectedHead: detachedPushFixture.head });
  assert.equal(detachedPush.pushed, false);
  assert.equal(detachedPush.reason, "DETACHED_HEAD");

  const wrongBranchFixture = await createPushFixture(tempRoot, "push-wrong-branch");
  const wrongBranchTool = createDevGitPushTool({
    repositoryRoot: wrongBranchFixture.repositoryRoot,
    policy: pushTestPolicy(wrongBranchFixture.remoteUrl),
  });
  await writeFile(
    path.join(wrongBranchFixture.repositoryRoot, ".git", "refs", "heads", "feature"),
    `${wrongBranchFixture.head}\n`,
    "utf8",
  );
  await writeFile(
    path.join(wrongBranchFixture.repositoryRoot, ".git", "HEAD"),
    "ref: refs/heads/feature\n",
    "utf8",
  );
  const wrongBranch = await wrongBranchTool({ expectedHead: wrongBranchFixture.head });
  assert.equal(wrongBranch.pushed, false);
  assert.equal(wrongBranch.reason, "WRONG_BRANCH");

  const wrongUpstreamFixture = await createPushFixture(tempRoot, "push-wrong-upstream");
  const wrongUpstreamTool = createDevGitPushTool({
    repositoryRoot: wrongUpstreamFixture.repositoryRoot,
    policy: pushTestPolicy(wrongUpstreamFixture.remoteUrl),
  });
  await mkdir(
    path.join(wrongUpstreamFixture.repositoryRoot, ".git", "refs", "remotes", "wrong"),
    { recursive: true },
  );
  await writeFile(
    path.join(wrongUpstreamFixture.repositoryRoot, ".git", "refs", "remotes", "wrong", "main"),
    `${wrongUpstreamFixture.baseHead}\n`,
    "utf8",
  );
  runFixtureGit(wrongUpstreamFixture.repositoryRoot, ["config", "remote.wrong.url", wrongUpstreamFixture.remoteUrl]);
  runFixtureGit(wrongUpstreamFixture.repositoryRoot, ["config", "remote.wrong.fetch", "+refs/heads/*:refs/remotes/wrong/*"]);
  runFixtureGit(wrongUpstreamFixture.repositoryRoot, ["config", "branch.main.remote", "wrong"]);
  const wrongUpstream = await wrongUpstreamTool({ expectedHead: wrongUpstreamFixture.head });
  assert.equal(wrongUpstream.pushed, false);
  assert.equal(wrongUpstream.reason, "WRONG_UPSTREAM");

  const remoteMismatchFixture = await createPushFixture(tempRoot, "push-remote-mismatch");
  const remoteMismatchTool = createDevGitPushTool({
    repositoryRoot: remoteMismatchFixture.repositoryRoot,
    policy: pushTestPolicy(remoteMismatchFixture.remoteUrl),
  });
  runFixtureGit(remoteMismatchFixture.repositoryRoot, [
    "config", "remote.origin.url", pathToFileURL(path.join(tempRoot, "not-the-remote.git")).href,
  ]);
  const remoteMismatch = await remoteMismatchTool({ expectedHead: remoteMismatchFixture.head });
  assert.equal(remoteMismatch.pushed, false);
  assert.equal(remoteMismatch.reason, "REMOTE_URL_MISMATCH");

  const pushurlFixture = await createPushFixture(tempRoot, "push-pushurl");
  const pushurlTool = createDevGitPushTool({
    repositoryRoot: pushurlFixture.repositoryRoot,
    policy: pushTestPolicy(pushurlFixture.remoteUrl),
  });
  runFixtureGit(pushurlFixture.repositoryRoot, [
    "config", "remote.origin.pushurl", pathToFileURL(path.join(tempRoot, "evil-pushurl.git")).href,
  ]);
  const pushurlReject = await pushurlTool({ expectedHead: pushurlFixture.head });
  assert.equal(pushurlReject.pushed, false);
  assert.equal(pushurlReject.reason, "PUSHURL_CONFIGURED");

  const receivepackFixture = await createPushFixture(tempRoot, "push-receivepack");
  const receivepackTool = createDevGitPushTool({
    repositoryRoot: receivepackFixture.repositoryRoot,
    policy: pushTestPolicy(receivepackFixture.remoteUrl),
  });
  runFixtureGit(receivepackFixture.repositoryRoot, ["config", "remote.origin.receivepack", "evil-receive-pack"]);
  const receivepackReject = await receivepackTool({ expectedHead: receivepackFixture.head });
  assert.equal(receivepackReject.pushed, false);
  assert.equal(receivepackReject.reason, "RECEIVEPACK_CONFIGURED");

  for (const rewriteKey of ["insteadOf", "pushInsteadOf"]) {
    const rewriteFixture = await createPushFixture(tempRoot, `push-url-rewrite-${rewriteKey.toLowerCase()}`);
    const rewriteTool = createDevGitPushTool({
      repositoryRoot: rewriteFixture.repositoryRoot,
      policy: pushTestPolicy(rewriteFixture.remoteUrl),
    });
    runFixtureGit(rewriteFixture.repositoryRoot, [
      "config",
      `url.https://rewrite.invalid/.${rewriteKey}`,
      rewriteFixture.remoteUrl,
    ]);
    const rewriteReject = await rewriteTool({ expectedHead: rewriteFixture.head });
    assert.equal(rewriteReject.pushed, false);
    assert.equal(rewriteReject.reason, "URL_REWRITE_CONFIGURED");
  }

  const behindFixture = await createPushFixture(tempRoot, "push-behind");
  const behindRemoteHead = await advanceBareRemoteFromLocal(behindFixture, "test: make upstream ahead");
  await writeFile(
    path.join(behindFixture.repositoryRoot, ".git", "refs", "remotes", "origin", "main"),
    `${behindRemoteHead}\n`,
    "utf8",
  );
  const behindTool = createDevGitPushTool({
    repositoryRoot: behindFixture.repositoryRoot,
    policy: pushTestPolicy(behindFixture.remoteUrl),
  });
  const behindReject = await behindTool({ expectedHead: behindFixture.head });
  assert.equal(behindReject.pushed, false);
  assert.equal(behindReject.reason, "REMOTE_AHEAD");
  assert.equal(behindReject.ahead_before, 0);
  assert.equal(behindReject.behind_before > 0, true);

  const divergedFixture = await createPushFixture(tempRoot, "push-diverged");
  const divergedBaseTree = runFixtureGit(divergedFixture.repositoryRoot, [
    "rev-parse", `${divergedFixture.baseHead}^{tree}`,
  ]).stdout.trim();
  const divergedRemoteHead = runFixtureGit(divergedFixture.repositoryRoot, [
    "commit-tree", divergedBaseTree, "-p", divergedFixture.baseHead, "-m", "test: divergent remote",
  ]).stdout.trim();
  await cp(
    path.join(divergedFixture.repositoryRoot, ".git", "objects"),
    path.join(divergedFixture.bareRoot, "objects"),
    { recursive: true, force: true },
  );
  await writeFile(path.join(divergedFixture.bareRoot, "refs", "heads", "main"), `${divergedRemoteHead}\n`, "utf8");
  const divergedTool = createDevGitPushTool({
    repositoryRoot: divergedFixture.repositoryRoot,
    policy: pushTestPolicy(divergedFixture.remoteUrl),
  });
  const divergedReject = await divergedTool({ expectedHead: divergedFixture.head });
  assert.equal(divergedReject.pushed, false);
  assert.equal(divergedReject.reason, "REMOTE_DIVERGED");
  assert.equal(divergedReject.ahead_before > 0, true);
  assert.equal(divergedReject.behind_before > 0, true);

  const notAheadFixture = await createPushFixture(tempRoot, "push-not-ahead");
  runFixtureGit(notAheadFixture.repositoryRoot, [
    "push",
    notAheadFixture.remoteUrl,
    "HEAD:refs/heads/main",
  ]);
  const notAheadTool = createDevGitPushTool({
    repositoryRoot: notAheadFixture.repositoryRoot,
    policy: pushTestPolicy(notAheadFixture.remoteUrl),
  });
  const notAheadReject = await notAheadTool({ expectedHead: notAheadFixture.head });
  assert.equal(notAheadReject.pushed, false);
  assert.equal(notAheadReject.reason, "ALREADY_UP_TO_DATE");
  assert.equal(notAheadReject.authoritative_remote_verified, true);
  assert.equal(notAheadReject.remote_head_before, notAheadFixture.head);
  assert.equal(notAheadReject.ahead_before, 0);
  assert.equal(notAheadReject.behind_before, 0);

  const nffFixture = await createPushFixture(tempRoot, "push-non-fast-forward");
  const nffLocalHeadBefore = fixtureHead(nffFixture.repositoryRoot);
  const nffRemoteHead = await advanceBareRemoteFromLocal(nffFixture, "test: hidden remote advance");
  const nffTool = createDevGitPushTool({
    repositoryRoot: nffFixture.repositoryRoot,
    policy: pushTestPolicy(nffFixture.remoteUrl),
  });
  const nffReject = await nffTool({ expectedHead: nffFixture.head });
  assert.equal(nffReject.execution_ok, true);
  assert.equal(nffReject.pushed, false);
  assert.equal(nffReject.reason, "REMOTE_AHEAD");
  assert.equal(fixtureHead(nffFixture.repositoryRoot), nffLocalHeadBefore);
  assert.equal(fixtureBareHead(nffFixture.bareRoot), nffRemoteHead);

  const hookPushFixture = await createPushFixture(tempRoot, "push-hook-disabled");
  const hookPushTool = createDevGitPushTool({
    repositoryRoot: hookPushFixture.repositoryRoot,
    policy: pushTestPolicy(hookPushFixture.remoteUrl),
  });
  const pushHookMarker = path.join(hookPushFixture.repositoryRoot, "push-hook-marker.txt");
  const pushHookMarkerForShell = pushHookMarker.replaceAll("\\", "/").replaceAll('"', '\\"');
  const prePushHook = path.join(hookPushFixture.repositoryRoot, ".git", "hooks", "pre-push");
  await writeFile(
    prePushHook,
    `#!/bin/sh\nprintf hook > "${pushHookMarkerForShell}"\nexit 1\n`,
    "utf8",
  );
  await chmod(prePushHook, 0o755);
  const hookPush = await hookPushTool({ expectedHead: hookPushFixture.head });
  assert.equal(hookPush.pushed, true);
  assert.equal(await pathExists(pushHookMarker), false, "malicious pre-push hook executed");
  assert.equal(fixtureBareHead(hookPushFixture.bareRoot), hookPushFixture.head);

  const filterPushFixture = await createPushFixture(tempRoot, "push-filter-blocked");
  const pushFilterMarker = path.join(filterPushFixture.repositoryRoot, "push-filter-marker.txt");
  await writeFile(
    path.join(filterPushFixture.repositoryRoot, ".gitattributes"),
    "server/src/requested.mjs filter=evilpush\n",
    "utf8",
  );
  runFixtureGit(filterPushFixture.repositoryRoot, ["add", "--", ".gitattributes"]);
  runFixtureGit(filterPushFixture.repositoryRoot, ["commit", "-m", "test: tracked malicious filter attributes"]);
  runFixtureGit(filterPushFixture.repositoryRoot, [
    "config",
    "filter.evilpush.clean",
    `node -e "require('node:fs').writeFileSync('${pushFilterMarker.replaceAll("\\", "/")}', 'ran')"`,
  ]);
  const filterPushTool = createDevGitPushTool({
    repositoryRoot: filterPushFixture.repositoryRoot,
    policy: pushTestPolicy(filterPushFixture.remoteUrl),
  });
  const filterPushReject = await filterPushTool({
    expectedHead: fixtureHead(filterPushFixture.repositoryRoot),
  });
  assert.equal(filterPushReject.pushed, false);
  assert.equal(filterPushReject.reason, "GIT_FILTER_ACTIVE");
  assert.equal(await pathExists(pushFilterMarker), false, "malicious push clean filter executed");

  const credentialFixture = await createPushFixture(tempRoot, "push-credential-helper-blocked");
  const credentialMarker = path.join(credentialFixture.repositoryRoot, "credential-marker.txt");
  runFixtureGit(credentialFixture.repositoryRoot, [
    "config",
    "credential.helper",
    `!node -e "require('node:fs').writeFileSync('${credentialMarker.replaceAll("\\", "/")}', 'ran')"`,
  ]);
  const credentialTool = createDevGitPushTool({
    repositoryRoot: credentialFixture.repositoryRoot,
    policy: pushTestPolicy(credentialFixture.remoteUrl),
  });
  const credentialReject = await credentialTool({ expectedHead: credentialFixture.head });
  assert.equal(credentialReject.pushed, false);
  assert.equal(credentialReject.reason, "UNSAFE_CREDENTIAL_HELPER");
  assert.equal(await pathExists(credentialMarker), false, "malicious credential helper executed");

  const askpassFixture = await createPushFixture(tempRoot, "push-askpass-blocked");
  const askpassMarker = path.join(askpassFixture.repositoryRoot, "askpass-marker.txt");
  const askpassScript = path.join(askpassFixture.repositoryRoot, "askpass-malicious.sh");
  await writeFile(
    askpassScript,
    `#!/bin/sh\nprintf askpass > "${askpassMarker.replaceAll("\\", "/")}"\nexit 1\n`,
    "utf8",
  );
  await chmod(askpassScript, 0o755);
  runFixtureGit(askpassFixture.repositoryRoot, ["config", "core.askPass", askpassScript]);
  const askpassTool = createDevGitPushTool({
    repositoryRoot: askpassFixture.repositoryRoot,
    policy: pushTestPolicy(askpassFixture.remoteUrl),
  });
  const askpassReject = await askpassTool({ expectedHead: askpassFixture.head });
  assert.equal(askpassReject.pushed, false);
  assert.equal(askpassReject.reason, "ASKPASS_CONFIGURED");
  assert.equal(await pathExists(askpassMarker), false, "malicious askpass executed");

  for (const marker of [
    "MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer",
  ]) {
    const operationFixture = await createPushFixture(tempRoot, `push-operation-${marker.toLowerCase()}`);
    const operationMarker = path.join(operationFixture.repositoryRoot, ".git", marker);
    await writeFile(operationMarker, "operation\n", "utf8");
    const operationTool = createDevGitPushTool({
      repositoryRoot: operationFixture.repositoryRoot,
      policy: pushTestPolicy(operationFixture.remoteUrl),
    });
    const operationReject = await operationTool({ expectedHead: operationFixture.head });
    assert.equal(operationReject.pushed, false);
    assert.equal(operationReject.reason, "OPERATION_IN_PROGRESS");
  }

  const invalidPushFixture = await createPushFixture(tempRoot, "push-invalid-input");
  const invalidPushTool = createDevGitPushTool({
    repositoryRoot: invalidPushFixture.repositoryRoot,
    policy: pushTestPolicy(invalidPushFixture.remoteUrl),
  });
  for (const invalidInput of [
    { expectedHead: "not-a-sha" },
    { expectedHead: invalidPushFixture.head, remote: "evil" },
    { expectedHead: invalidPushFixture.head, args: ["--force"] },
    { expectedHead: invalidPushFixture.head, force: true },
  ]) {
    const invalidPush = await invalidPushTool(invalidInput);
    assert.equal(invalidPush.execution_ok, false);
    assert.equal(invalidPush.pushed, false);
    assert.equal(invalidPush.reason, "INVALID_INPUT");
  }

  const remoteReadFailureFixture = await createPushFixture(tempRoot, "push-remote-read-failure");
  const remoteReadFailureScript = path.join(tempRoot, "push-remote-read-failure.mjs");
  await writeFile(remoteReadFailureScript, "process.stderr.write('remote unavailable\\n'); process.exit(1);\n", "utf8");
  const remoteReadFailureTool = createDevGitPushTool({
    repositoryRoot: remoteReadFailureFixture.repositoryRoot,
    policy: pushTestPolicy(remoteReadFailureFixture.remoteUrl),
    networkExecutable: process.execPath,
    networkExecutablePrefix: [remoteReadFailureScript],
  });
  const remoteReadFailure = await remoteReadFailureTool({ expectedHead: remoteReadFailureFixture.head });
  assert.equal(remoteReadFailure.pushed, false);
  assert.equal(remoteReadFailure.reason, "REMOTE_READ_FAILED");

  const raceFixture = await createPushFixture(tempRoot, "push-remote-race");
  await cp(
    path.join(raceFixture.repositoryRoot, ".git", "objects"),
    path.join(raceFixture.bareRoot, "objects"),
    { recursive: true, force: true },
  );
  const raceScript = path.join(tempRoot, "push-remote-race.mjs");
  const raceCounterPath = path.join(tempRoot, "push-remote-race.count");
  const raceRemoteRefPath = path.join(raceFixture.bareRoot, "refs", "heads", "main");
  await writeFile(
    raceScript,
    `import { spawnSync } from "node:child_process";\nimport { existsSync, readFileSync, writeFileSync } from "node:fs";\nconst args = process.argv.slice(2);\nconst git = process.platform === "win32" ? "git.exe" : "git";\nif (args.includes("ls-remote")) {\n  const result = spawnSync(git, args, { encoding: "utf8", windowsHide: true, shell: false });\n  process.stdout.write(result.stdout ?? "");\n  process.stderr.write(result.stderr ?? "");\n  const count = existsSync(${JSON.stringify(raceCounterPath)}) ? Number(readFileSync(${JSON.stringify(raceCounterPath)}, "utf8")) : 0;\n  writeFileSync(${JSON.stringify(raceCounterPath)}, String(count + 1));\n  if (count === 0) writeFileSync(${JSON.stringify(raceRemoteRefPath)}, ${JSON.stringify(`${raceFixture.head}\n`)});\n  process.exit(result.status ?? 1);\n}\nprocess.exit(99);\n`,
    "utf8",
  );
  const raceTool = createDevGitPushTool({
    repositoryRoot: raceFixture.repositoryRoot,
    policy: pushTestPolicy(raceFixture.remoteUrl),
    networkExecutable: process.execPath,
    networkExecutablePrefix: [raceScript],
  });
  const raceReject = await raceTool({ expectedHead: raceFixture.head });
  assert.equal(raceReject.pushed, false);
  assert.equal(raceReject.reason, "REMOTE_CHANGED_DURING_GATE");
  assert.equal(raceReject.remote_head_before, raceFixture.baseHead);
  assert.equal(raceReject.remote_head_after, raceFixture.head);

  const postMismatchFixture = await createPushFixture(tempRoot, "push-post-mismatch");
  const postMismatchScript = path.join(tempRoot, "push-post-mismatch.mjs");
  await writeFile(
    postMismatchScript,
    `import { spawnSync } from "node:child_process";\nconst args = process.argv.slice(2);\nif (args.includes("ls-remote")) {\n  const git = process.platform === "win32" ? "git.exe" : "git";\n  const result = spawnSync(git, args, { stdio: "inherit", windowsHide: true, shell: false });\n  process.exit(result.status ?? 1);\n}\nif (args.includes("push")) process.exit(0);\nprocess.exit(98);\n`,
    "utf8",
  );
  const postMismatchTool = createDevGitPushTool({
    repositoryRoot: postMismatchFixture.repositoryRoot,
    policy: pushTestPolicy(postMismatchFixture.remoteUrl),
    networkExecutable: process.execPath,
    networkExecutablePrefix: [postMismatchScript],
  });
  const postMismatch = await postMismatchTool({ expectedHead: postMismatchFixture.head });
  assert.equal(postMismatch.execution_ok, true);
  assert.equal(postMismatch.pushed, false);
  assert.equal(postMismatch.reason, "POST_PUSH_REMOTE_MISMATCH");
  assert.equal(postMismatch.remote_head_before, postMismatchFixture.baseHead);
  assert.equal(postMismatch.remote_head_after, postMismatchFixture.baseHead);

  const timeoutPushFixture = await createPushFixture(tempRoot, "push-timeout-cleanup");
  const timeoutPushPort = await freePort();
  const timeoutNetworkScript = path.join(tempRoot, "push-timeout-network.mjs");
  const timeoutDescendant = `require("node:net").createServer(() => {}).listen(${timeoutPushPort}, "127.0.0.1"); setInterval(() => {}, 1000);`;
  await writeFile(
    timeoutNetworkScript,
    `import { spawn, spawnSync } from "node:child_process";\nconst args = process.argv.slice(2);\nif (args.includes("ls-remote")) {\n  const git = process.platform === "win32" ? "git.exe" : "git";\n  const result = spawnSync(git, args, { stdio: "inherit", windowsHide: true, shell: false });\n  process.exit(result.status ?? 1);\n}\nspawn(process.execPath, ["-e", ${JSON.stringify(timeoutDescendant)}], { stdio: "ignore", windowsHide: true });\nsetInterval(() => {}, 1000);\n`,
    "utf8",
  );
  const timeoutPushTool = createDevGitPushTool({
    repositoryRoot: timeoutPushFixture.repositoryRoot,
    policy: pushTestPolicy(timeoutPushFixture.remoteUrl),
    timeoutMs: 1_500,
    networkExecutable: process.execPath,
    networkExecutablePrefix: [timeoutNetworkScript],
  });
  const timeoutPush = await timeoutPushTool({ expectedHead: timeoutPushFixture.head });
  assert.equal(timeoutPush.execution_ok, false);
  assert.equal(timeoutPush.pushed, false);
  assert.equal(timeoutPush.reason, "PUSH_TIMEOUT");
  assert.equal(timeoutPush.timed_out, true);
  assert.equal(await isPortAvailable(timeoutPushPort), true, "push timeout left descendant process alive");

  const outputPushFixture = await createPushFixture(tempRoot, "push-output-redaction");
  const outputNetworkScript = path.join(tempRoot, "push-output-network.mjs");
  await writeFile(
    outputNetworkScript,
    `import { spawnSync } from "node:child_process";\nconst args = process.argv.slice(2);\nif (args.includes("ls-remote")) {\n  const git = process.platform === "win32" ? "git.exe" : "git";\n  const result = spawnSync(git, args, { stdio: "inherit", windowsHide: true, shell: false });\n  process.exit(result.status ?? 1);\n}\nprocess.stdout.write("\\u001b[31mhead\\u001b[0m\\nBearer abcdefghijklmnop\\nsk-proj-1234567890abcdef\\n" + "x".repeat(12000) + "\\nUSEFUL_PUSH_TAIL\\n");\nprocess.stderr.write("password=hunter2\\nUSEFUL_PUSH_STDERR_TAIL\\n");\nprocess.exit(1);\n`,
    "utf8",
  );
  const outputPushTool = createDevGitPushTool({
    repositoryRoot: outputPushFixture.repositoryRoot,
    policy: pushTestPolicy(outputPushFixture.remoteUrl),
    outputMaxCharacters: 2_048,
    networkExecutable: process.execPath,
    networkExecutablePrefix: [outputNetworkScript],
  });
  const outputPush = await outputPushTool({ expectedHead: outputPushFixture.head });
  assert.equal(outputPush.execution_ok, true);
  assert.equal(outputPush.pushed, false);
  assert.equal(outputPush.reason, "GIT_PUSH_REJECTED");
  assert.equal(outputPush.stdout_truncated, true);
  assert(outputPush.output.includes("USEFUL_PUSH_TAIL"));
  assert(outputPush.stderr.includes("USEFUL_PUSH_STDERR_TAIL"));
  assert(!outputPush.output.includes("abcdefghijklmnop"));
  assert(!outputPush.output.includes("sk-proj-1234567890abcdef"));
  assert(!outputPush.output.includes("\u001b[31m"));
  assert(!outputPush.stderr.includes("hunter2"));

  try {
    auditBefore = await readFile(auditLogPath);
    auditExisted = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(auditLogPath), { recursive: true });

  const invalidFixtures = [
    {
      id: "dev-test-injection-semicolon",
      arguments: { suite: "mcp; whoami" },
      expected: "suite must be one of: mcp, mcp_tunnel, all.",
    },
    {
      id: "dev-test-injection-powershell",
      arguments: { suite: "mcp && powershell -NoProfile" },
      expected: "suite must be one of: mcp, mcp_tunnel, all.",
    },
    {
      id: "dev-test-unknown-command",
      arguments: { suite: "mcp", command: "whoami" },
      expected: "Unknown argument for dev_run_tests: command.",
    },
  ];
  for (const fixture of invalidFixtures) {
    const response = await runMcp({
      jsonrpc: "2.0",
      id: fixture.id,
      method: "tools/call",
      params: {
        name: "dev_run_tests",
        arguments: fixture.arguments,
        _meta: { actor: "dev-test-security-fixture" },
      },
    });
    assert.equal(response.error, undefined);
    assert.equal(response.result?.isError, true);
    assert.equal(response.result.content[0].text, fixture.expected);
  }

  for (const fixture of [
    { name: "dev_read_file_range", arguments: { path: "server/src/mcp-server.mjs", startLine: 1, command: "cat" }, expected: "Unknown argument for dev_read_file_range: command." },
    { name: "dev_delete_file", arguments: { path: "server/src/mcp-server.mjs", command: "rm" }, expected: "Unknown argument for dev_delete_file: command." },
    { name: "dev_git_status", arguments: { command: "status" }, expected: "Unknown argument for dev_git_status: command." },
    { name: "dev_git_remote_status", arguments: { command: "ls-remote" }, expected: "Unknown argument for dev_git_remote_status: command." },
    { name: "dev_git_diff", arguments: { mode: "working", args: ["--name-only"] }, expected: "Unknown argument for dev_git_diff: args." },
    { name: "dev_git_diff_check", arguments: { mode: "working; whoami" }, expected: "mode must be one of: working, staged." },
    { name: "dev_git_push", arguments: { expectedHead: "0000000000000000000000000000000000000000", remote: "evil" }, expected: "Unknown argument for dev_git_push: remote." },
  ]) {
    const response = await runMcp({
      jsonrpc: "2.0",
      id: `dev-git-security-${fixture.name}`,
      method: "tools/call",
      params: {
        name: fixture.name,
        arguments: fixture.arguments,
      },
    });
    assert.equal(response.error, undefined);
    assert.equal(response.result?.isError, true);
    assert.equal(response.result.content[0].text, fixture.expected);
  }

  const commitAuditResponse = await runMcp({
    jsonrpc: "2.0",
    id: "dev-git-commit-audit-redaction",
    method: "tools/call",
    params: {
      name: "dev_git_commit",
      arguments: {
        paths: ["../must-not-stage"],
        message: "test: sk-proj-1234567890abcdef must be redacted",
        expectedHead: fixtureHead(rootDir),
      },
      _meta: { actor: "dev-git-commit-audit-fixture" },
    },
  });
  assert.equal(commitAuditResponse.error, undefined);
  assert.equal(commitAuditResponse.result?.isError, undefined);
  const commitAuditPayload = JSON.parse(commitAuditResponse.result.content[0].text);
  assert.equal(commitAuditPayload.committed, false);
  assert.equal(commitAuditPayload.execution_ok, false);
  assert.match(commitAuditPayload.reason, /path traversal/u);

  const pushAuditResponse = await runMcp({
    jsonrpc: "2.0",
    id: "dev-git-push-audit-bounded",
    method: "tools/call",
    params: {
      name: "dev_git_push",
      arguments: { expectedHead: "0000000000000000000000000000000000000000" },
      _meta: { actor: "dev-git-push-audit-fixture" },
    },
  });
  assert.equal(pushAuditResponse.error, undefined);
  assert.equal(pushAuditResponse.result?.isError, undefined);
  const pushAuditPayload = JSON.parse(pushAuditResponse.result.content[0].text);
  assert.equal(pushAuditPayload.execution_ok, true);
  assert.equal(pushAuditPayload.pushed, false);
  assert.equal(pushAuditPayload.reason, "STALE_HEAD");

  const auditLines = (await readFile(auditLogPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const securityRecords = auditLines.filter(
    (record) => record.actor === "dev-test-security-fixture",
  );
  assert.equal(securityRecords.length, invalidFixtures.length);
  for (const record of securityRecords) {
    assert.equal(record.tool_name, "dev_run_tests");
    assert.equal(record.risk, "low-risk-write");
    assert.equal(record.status, "tool_error");
    assert.deepEqual(record.affected_paths, []);
    assert.equal(record.result?.is_error, true);
  }

  const commitAuditRecords = auditLines.filter(
    (record) => record.actor === "dev-git-commit-audit-fixture",
  );
  assert.equal(commitAuditRecords.length, 1);
  const [commitAuditRecord] = commitAuditRecords;
  assert.equal(commitAuditRecord.tool_name, "dev_git_commit");
  assert.equal(commitAuditRecord.risk, "low-risk-write");
  assert.equal(commitAuditRecord.status, "completed");
  assert.deepEqual(commitAuditRecord.affected_paths, []);
  assert.equal(commitAuditRecord.input_summary?.message?.type, "string");
  assert.equal(commitAuditRecord.input_summary?.message?.length > 0, true);
  assert.equal(commitAuditRecord.input_summary?.message?.preview.includes("sk-proj-1234567890abcdef"), false);
  assert.match(commitAuditRecord.input_summary?.message?.preview ?? "", /REDACTED API KEY/u);
  assert.equal(commitAuditRecord.result?.execution_ok, false);
  assert.equal(commitAuditRecord.result?.committed, false);
  assert.equal(Object.hasOwn(commitAuditRecord.result ?? {}, "stdout"), false);
  assert.equal(Object.hasOwn(commitAuditRecord.result ?? {}, "stderr"), false);

  const pushAuditRecords = auditLines.filter(
    (record) => record.actor === "dev-git-push-audit-fixture",
  );
  assert.equal(pushAuditRecords.length, 1);
  const [pushAuditRecord] = pushAuditRecords;
  assert.equal(pushAuditRecord.tool_name, "dev_git_push");
  assert.equal(pushAuditRecord.risk, "high-risk-write");
  assert.equal(pushAuditRecord.status, "completed");
  assert.deepEqual(pushAuditRecord.affected_paths, []);
  assert.equal(pushAuditRecord.input_summary?.expectedHead?.type, "string");
  assert.equal(pushAuditRecord.input_summary?.expectedHead?.length, 40);
  assert.equal(pushAuditRecord.result?.execution_ok, true);
  assert.equal(pushAuditRecord.result?.pushed, false);
  assert.equal(pushAuditRecord.result?.reason, "STALE_HEAD");
  assert.equal(Object.hasOwn(pushAuditRecord.result ?? {}, "stdout"), false);
  assert.equal(Object.hasOwn(pushAuditRecord.result ?? {}, "stderr"), false);
  assert.equal(Object.hasOwn(pushAuditRecord.result ?? {}, "output"), false);

  console.log("MCP development Git commit security tests passed.");
  console.log("- isolated success, multiple paths, untracked, and unrelated unstaged fixtures: passed");
  console.log("- preexisting staged isolation, protected/traversal/pathspec/no-op guards: passed");
  console.log("- staged diff-check failure preserves index and blocks commit: passed");
  console.log("- repository hooks and configured clean filters cannot execute: passed");
  console.log("- commit message injection stays literal and commit failure preserves staged state: passed");
  console.log("- bounded/redacted MCP audit metadata fixture: passed");
  console.log("MCP development Git read-only security tests passed.");
  console.log("- status/diff/staged diff and working/staged diff-check fixtures: passed");
  console.log("- fixed Git argv, bounded head/tail output, ANSI/secret redaction, and index immutability: passed");
  console.log("- Git schema injection/additional-properties rejection through MCP: passed");
  console.log("MCP development test runner security tests passed.");
  console.log("- fixed Node entrypoint mapping and controlled environment: passed");
  console.log("- nonzero exit, bounded head/tail output, ANSI removal, and redaction: passed");
  console.log("- timeout process-tree/port cleanup and exclusive concurrency: passed");
  console.log("- spawn failure and schema injection/additional-properties rejection: passed");
} finally {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (auditExisted) await writeFile(auditLogPath, auditBefore);
  else await rm(auditLogPath, { force: true });
  await removeTempTree(tempRoot);
}
