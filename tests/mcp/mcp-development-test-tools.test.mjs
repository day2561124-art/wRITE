import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDevTestRunner,
  getDevTestSuiteMapping,
} from "../../server/src/mcp-development-test-tools.mjs";
import {
  createDevGitTools,
  getDevGitCommandMapping,
} from "../../server/src/mcp-development-readonly-tools.mjs";

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
  assert.equal(mapping.mcp.timeout_ms, 300_000);
  assert.equal(mapping.mcp_tunnel.timeout_ms, 300_000);
  assert.equal(mapping.all.timeout_ms, 3_600_000);

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

  const concurrentRunner = createDevTestRunner({
    suiteDefinitions: {
      mcp: testDefinition(["-e", "setTimeout(() => process.exit(0), 700);"]),
    },
    lockPath: path.join(tempRoot, "concurrent.lock"),
  });
  const firstRun = concurrentRunner({ suite: "mcp" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const busy = await concurrentRunner({ suite: "mcp" });
  const completed = await firstRun;
  assert.equal(completed.passed, true);
  assert.equal(busy.execution_ok, false);
  assert.equal(busy.passed, false);
  assert.match(busy.stderr, /already running/u);

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
    "--no-pager", "-c", "core.fsmonitor=false", "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--check",
  ]);
  assert.deepEqual(gitMapping.diff_check.staged, [
    "--no-pager", "-c", "core.fsmonitor=false", "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--cached", "--check",
  ]);

  const gitRoot = path.join(tempRoot, "git-fixture");
  await mkdir(gitRoot, { recursive: true });
  runFixtureGit(gitRoot, ["init"]);
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
    { name: "dev_git_status", arguments: { command: "status" }, expected: "Unknown argument for dev_git_status: command." },
    { name: "dev_git_diff", arguments: { mode: "working", args: ["--name-only"] }, expected: "Unknown argument for dev_git_diff: args." },
    { name: "dev_git_diff_check", arguments: { mode: "working; whoami" }, expected: "mode must be one of: working, staged." },
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
  await rm(tempRoot, { recursive: true, force: true });
}
