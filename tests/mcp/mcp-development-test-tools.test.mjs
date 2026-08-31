import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  DEV_GIT_WHITESPACE_POLICY,
  getDevGitCommandMapping,
} from "../../server/src/mcp-development-readonly-tools.mjs";
import {
  createDevGitCommitTool,
  getDevGitCommitCommandMapping,
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

  const commitAuditResponse = await runMcp({
    jsonrpc: "2.0",
    id: "dev-git-commit-audit-redaction",
    method: "tools/call",
    params: {
      name: "dev_git_commit",
      arguments: {
        paths: ["../must-not-stage"],
        message: "test: sk-proj-1234567890abcdef must be redacted",
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
  await rm(tempRoot, { recursive: true, force: true });
}
