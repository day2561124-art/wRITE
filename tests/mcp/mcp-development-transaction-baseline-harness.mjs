import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createDevCheckpointService } from "../../server/src/mcp-development-checkpoint-tools.mjs";
import { computeWorkspaceSnapshot } from "../../server/src/mcp-development-journal-tools.mjs";
import { createDevTransactionService } from "../../server/src/mcp-development-transaction-tools.mjs";
import { dev_git_diff, dev_git_diff_check, dev_git_status, dev_read_file } from "../../server/src/mcp-development-readonly-tools.mjs";
import { dev_apply_patch, dev_git_commit } from "../../server/src/mcp-development-write-tools.mjs";
import { createDevTestRunner } from "../../server/src/mcp-development-test-tools.mjs";

const execFileAsync = promisify(execFile);
const gitExecutable = process.platform === "win32" ? "git.exe" : "git";
const __filename = fileURLToPath(import.meta.url);

async function git(cwd, args, { allowFailure = false } = {}) {
  try {
    const { stdout } = await execFileAsync(gitExecutable, args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat" },
    });
    return String(stdout);
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function randomWorkspaceId() {
  return `dev_workspace_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function randomWorkstreamId() {
  return `dev_workstream_20260903-080000_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function journalStub() {
  let sequence = 0;
  const events = [];
  const operations = new Map();
  const nextId = () => `dev_operation_${(++sequence).toString(16).padStart(32, "0")}`;
  return {
    events,
    api: {
      async status() { return { health: "healthy", dangling_operation_count: 0 }; },
      async begin(input) {
        const operation_id = nextId();
        operations.set(operation_id, input);
        events.push({ stage: "started", operation_id, input: structuredClone(input) });
        return { operation_id };
      },
      async complete(operation_id, input) {
        events.push({ stage: "completed", operation_id, input: structuredClone(input) });
        return { operation_id };
      },
      async fail(operation_id, input) {
        events.push({ stage: "failed", operation_id, input: structuredClone(input) });
        return { operation_id };
      },
      async markDegraded(reason) { events.push({ stage: "degraded", reason: String(reason) }); },
    },
  };
}

async function initRepository(repositoryRoot) {
  await mkdir(path.join(repositoryRoot, "tests"), { recursive: true });
  await git(repositoryRoot, ["init", "-b", "main"]);
  await git(repositoryRoot, ["config", "user.name", "Phase 3C Transaction Test"]);
  await git(repositoryRoot, ["config", "user.email", "phase3c@test.invalid"]);
  await writeFile(path.join(repositoryRoot, "tests", "a.txt"), "base-a\n", "utf8");
  await writeFile(path.join(repositoryRoot, "tests", "b.txt"), "base-b\n", "utf8");
  await writeFile(path.join(repositoryRoot, "tests", "move-source.txt"), "move-content\n", "utf8");
  await git(repositoryRoot, ["add", "--all"]);
  await git(repositoryRoot, ["commit", "-m", "phase3c baseline"]);
  return (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
}

async function harness(label, { hooks = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), `writer-workbench-transaction-${label}-`));
  const repositoryRoot = path.join(root, "repo");
  await mkdir(repositoryRoot);
  const baseHead = await initRepository(repositoryRoot);
  const workspace_id = randomWorkspaceId();
  const workstream_id = randomWorkstreamId();
  const checkpointRoot = path.join(root, "checkpoints");
  const transactionRoot = path.join(root, "transactions");
  const journal = journalStub();

  async function contextResolver() {
    const current_head = (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
    const branch = (await git(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim();
    const gitDirRaw = (await git(repositoryRoot, ["rev-parse", "--git-dir"])).trim();
    const gitCommonRaw = (await git(repositoryRoot, ["rev-parse", "--git-common-dir"])).trim();
    return {
      workspace_id,
      workstream_id,
      workspace_type: "isolated_worktree",
      root: repositoryRoot,
      branch,
      base_head: baseHead,
      current_head,
      git_dir: path.resolve(repositoryRoot, gitDirRaw),
      git_common_dir: path.resolve(repositoryRoot, gitCommonRaw),
      lifecycle_state: "active",
      workstream_state: "active",
      healthy: true,
      mutation_allowed: true,
    };
  }

  const checkpointService = createDevCheckpointService({
    storageRoot: checkpointRoot,
    repositoryRoot,
    workspaceContextResolver: contextResolver,
    journal: journal.api,
  });
  const checkpointApi = {
    status: () => checkpointService.status(),
    captureRecovery: (input) => checkpointService.captureInternalTransactionRecovery(input),
    load: (checkpointId, options) => checkpointService.loadInternalTransactionCheckpoint(checkpointId, options),
    readBlob: (descriptor) => checkpointService.readInternalBlob(descriptor),
    verifyWorkspace: (context, checkpointId) => checkpointService.verifyWorkspaceAgainstCheckpointInternal(context, checkpointId),
    retireRecovery: (checkpointId) => checkpointService.retireInternalTransactionCheckpoint(checkpointId),
    listRecoveryByOwner: (transactionId) => checkpointService.listInternalTransactionCheckpointsByOwner(transactionId),
    retireRecoveryByOwner: (transactionId) => checkpointService.retireInternalTransactionCheckpointsByOwner(transactionId),
  };
  const makeTransactionService = (serviceHooks = hooks) => createDevTransactionService({
    storageRoot: transactionRoot,
    workspaceContextResolver: contextResolver,
    checkpoint: checkpointApi,
    journal: journal.api,
    hooks: serviceHooks,
  });

  return {
    root,
    repositoryRoot,
    checkpointRoot,
    transactionRoot,
    baseHead,
    workspace_id,
    workstream_id,
    journal,
    contextResolver,
    checkpointService,
    checkpointApi,
    makeTransactionService,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  };
}


export{harness,git};
