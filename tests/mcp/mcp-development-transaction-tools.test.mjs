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

async function createTargetState(h) {
  await writeFile(path.join(h.repositoryRoot, "tests", "a.txt"), "target-a\n", "utf8");
  await unlink(path.join(h.repositoryRoot, "tests", "b.txt"));
  await rename(path.join(h.repositoryRoot, "tests", "move-source.txt"), path.join(h.repositoryRoot, "tests", "move-dest.txt"));
  await writeFile(path.join(h.repositoryRoot, "tests", "target-new.txt"), "target-new\n", "utf8");
  await mkdir(path.join(h.repositoryRoot, "tests", "target-empty"));
  return h.checkpointService.create({ workspace_id: h.workspace_id, label: "C1 target" });
}

async function mutateToSourceState(h) {
  await writeFile(path.join(h.repositoryRoot, "tests", "a.txt"), "source-a\n", "utf8");
  await writeFile(path.join(h.repositoryRoot, "tests", "b.txt"), "base-b\n", "utf8");
  try { await rename(path.join(h.repositoryRoot, "tests", "move-dest.txt"), path.join(h.repositoryRoot, "tests", "move-source.txt")); } catch {}
  await rm(path.join(h.repositoryRoot, "tests", "target-new.txt"), { force: true });
  await rmdir(path.join(h.repositoryRoot, "tests", "target-empty"));
  await mkdir(path.join(h.repositoryRoot, "tests", "source-empty"));
  await writeFile(path.join(h.repositoryRoot, "tests", "source-new.txt"), "source-new\n", "utf8");
}

function simulatedCrash(message) {
  const error = new Error(message);
  error.code = "SIMULATED_TRANSACTION_CRASH";
  return error;
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code, error?.stack ?? error?.message);
    return true;
  });
}

async function firstTransaction(service, workspaceId) {
  const listed = await service.list({ workspace_id: workspaceId, limit: 10 });
  assert.equal(listed.total, 1);
  return listed.transactions[0];
}

async function runBarrierWorker() {
  const service = createDevTransactionService({ storageRoot: process.env.TRANSACTION_WORKER_STORAGE_ROOT });
  try {
    await service.assertWorkspaceAvailable(process.env.TRANSACTION_WORKER_WORKSPACE_ID);
    process.stdout.write(`${JSON.stringify({ blocked: false })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ blocked: true, code: error.code, details: error.details ?? null })}\n`);
  }
}

async function spawnBarrierWorker(storageRoot, workspaceId) {
  const child = spawn(process.execPath, [__filename, "--barrier-worker"], {
    env: { ...process.env, TRANSACTION_WORKER_STORAGE_ROOT: storageRoot, TRANSACTION_WORKER_WORKSPACE_ID: workspaceId },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  if (code !== 0) throw new Error(`barrier worker failed (${code}): ${stderr}`);
  return JSON.parse(stdout.trim());
}

async function runTests() {
  // Same-HEAD exact restore: replace/create/delete/move + empty-directory semantics.
  {
    const h = await harness("success");
    try {
      const checkpoint = await createTargetState(h);
      const targetSnapshot = checkpoint.workspace_snapshot_id;
      await mutateToSourceState(h);
      const sourceSnapshot = await computeWorkspaceSnapshot(await h.contextResolver());
      const transaction = await h.makeTransactionService().restore({
        workspace_id: h.workspace_id,
        checkpoint_id: checkpoint.checkpoint_id,
        expected_current_snapshot_id: sourceSnapshot.workspace_snapshot_id,
      });
      assert.equal(transaction.state, "completed");
      assert.equal(transaction.source_snapshot_id, sourceSnapshot.workspace_snapshot_id);
      assert.equal(transaction.target_snapshot_id, targetSnapshot);
      assert.equal(transaction.prepared_marker, true);
      assert.equal(transaction.commit_marker, true);
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, targetSnapshot);
      assert.equal(await readFile(path.join(h.repositoryRoot, "tests", "a.txt"), "utf8"), "target-a\n");
      await assert.rejects(readFile(path.join(h.repositoryRoot, "tests", "b.txt"), "utf8"), /ENOENT/u);
      assert.equal(await readFile(path.join(h.repositoryRoot, "tests", "move-dest.txt"), "utf8"), "move-content\n");
      await assert.rejects(readFile(path.join(h.repositoryRoot, "tests", "move-source.txt"), "utf8"), /ENOENT/u);
      assert.equal((await git(h.repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase(), h.baseHead);
      assert.equal((await git(h.repositoryRoot, ["diff", "--cached", "--name-only"])).trim(), "");
      const publicCheckpoints = await h.checkpointService.list({ workspace_id: h.workspace_id });
      assert.equal(publicCheckpoints.checkpoints.some((item) => item.checkpoint_id === transaction.recovery_checkpoint_id), false);
      assert(h.journal.events.some((event) => event.input?.operation_type === "transaction_prepare"));
      assert(h.journal.events.some((event) => event.input?.operation_type === "transaction_commit"));
      assert(h.journal.events.some((event) => event.input?.operation_type === "transaction_cleanup"));
      const plan = JSON.parse(await readFile(path.join(h.transactionRoot, "records", transaction.transaction_id, "plan.json"), "utf8"));
      assert(plan.transitions.some((item) => item.move_role === "source"));
      assert(plan.transitions.some((item) => item.move_role === "destination"));
    } finally { await h.cleanup(); }
  }

  // Different HEAD rejects before any transaction record/effect and never rewinds Git.
  {
    const h = await harness("head-mismatch");
    try {
      const checkpoint = await createTargetState(h);
      await git(h.repositoryRoot, ["add", "--all"]);
      await git(h.repositoryRoot, ["commit", "-m", "advance head after checkpoint"]);
      const advanced = (await git(h.repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
      await expectCode(h.makeTransactionService().restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "CHECKPOINT_HEAD_MISMATCH");
      assert.equal((await git(h.repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase(), advanced);
      assert.equal((await h.makeTransactionService().list({ workspace_id: h.workspace_id })).total, 0);
    } finally { await h.cleanup(); }
  }

  // Windows-style case-insensitive aliases are rejected by the server-generated plan before PREPARED.
  {
    const h = await harness("case-alias-collision");
    try {
      await git(h.repositoryRoot, ["config", "core.ignorecase", "false"]);
      await writeFile(path.join(h.repositoryRoot, "tests", "Foo.txt"), "case-content\n", "utf8");
      await git(h.repositoryRoot, ["add", "tests/Foo.txt"]);
      await git(h.repositoryRoot, ["commit", "-m", "case collision baseline"]);
      const temp = path.join(h.repositoryRoot, "tests", "case-temp.txt");
      await rename(path.join(h.repositoryRoot, "tests", "Foo.txt"), temp);
      await rename(temp, path.join(h.repositoryRoot, "tests", "foo.txt"));
      const checkpoint = await h.checkpointService.create({ workspace_id: h.workspace_id, label: "case target" });
      await rename(path.join(h.repositoryRoot, "tests", "foo.txt"), temp);
      await rename(temp, path.join(h.repositoryRoot, "tests", "Foo.txt"));
      await expectCode(h.makeTransactionService().restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "TRANSACTION_PATH_COLLISION");
      const rejected = await firstTransaction(h.makeTransactionService(), h.workspace_id);
      assert.equal(rejected.state, "abandoned");
      assert.equal(rejected.prepared_marker, false);
      assert.equal(await readFile(path.join(h.repositoryRoot, "tests", "Foo.txt"), "utf8"), "case-content\n");
    } finally { await h.cleanup(); }
  }

  // Parent-file versus child-path overlap is rejected instead of inventing an unsafe ordering.
  {
    const h = await harness("path-overlap-collision");
    try {
      const overlapDirectory = path.join(h.repositoryRoot, "tests", "overlap.txt");
      await mkdir(overlapDirectory);
      await writeFile(path.join(overlapDirectory, "child.txt"), "target-child\n", "utf8");
      const checkpoint = await h.checkpointService.create({ workspace_id: h.workspace_id, label: "overlap target" });
      await rm(overlapDirectory, { recursive: true, force: true });
      await writeFile(overlapDirectory, "source-parent-file\n", "utf8");
      await expectCode(h.makeTransactionService().restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "TRANSACTION_PLAN_COLLISION");
      const rejected = await firstTransaction(h.makeTransactionService(), h.workspace_id);
      assert.equal(rejected.state, "abandoned");
      assert.equal(rejected.prepared_marker, false);
      assert.equal(await readFile(overlapDirectory, "utf8"), "source-parent-file\n");
    } finally { await h.cleanup(); }
  }

  // PREPARED + partial apply + crash: commit marker absent => exact SOURCE rollback on reload.
  {
    const h = await harness("crash-partial");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const sourceSnapshot = await computeWorkspaceSnapshot(await h.contextResolver());
      let count = 0;
      const crashing = h.makeTransactionService({ afterTransition: async () => { count += 1; if (count === 1) throw simulatedCrash("after first transition"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      assert.equal(transaction.prepared_marker, true);
      assert.equal(transaction.commit_marker, false);
      await expectCode(crashing.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      const crossProcess = await spawnBarrierWorker(h.transactionRoot, h.workspace_id);
      assert.equal(crossProcess.blocked, true);
      assert.equal(crossProcess.code, "WORKSPACE_TRANSACTION_IN_PROGRESS");
      const unrelatedWorkspaceId = randomWorkspaceId();
      assert.equal((await spawnBarrierWorker(h.transactionRoot, unrelatedWorkspaceId)).blocked, false);

      const gatedResolver = async (input = {}, options = {}) => {
        const requestedWorkspaceId = input.workspace_id ?? h.workspace_id;
        await crashing.assertWorkspaceAvailable(requestedWorkspaceId, { transactionId: options.transactionId ?? null });
        const base = await h.contextResolver();
        return {
          ...base,
          workspace_id: requestedWorkspaceId,
          workstream_id: requestedWorkspaceId === h.workspace_id ? h.workstream_id : randomWorkstreamId(),
        };
      };
      const gatedOptions = { workspaceContextResolver: gatedResolver };
      await expectCode(dev_read_file({ workspace_id: h.workspace_id, path: "tests/a.txt" }, gatedOptions), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      await expectCode(dev_apply_patch({ workspace_id: h.workspace_id, path: "tests/a.txt", oldText: "source-a\n", newText: "blocked\n" }, gatedOptions), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      await expectCode(dev_git_status({ workspace_id: h.workspace_id, includeUntracked: true }, gatedOptions), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      await expectCode(dev_git_diff({ workspace_id: h.workspace_id, mode: "working" }, gatedOptions), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      await expectCode(dev_git_diff_check({ workspace_id: h.workspace_id, mode: "working" }, gatedOptions), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      const blockedCommit = await dev_git_commit({
        workspace_id: h.workspace_id,
        expectedHead: h.baseHead,
        paths: ["tests/a.txt"],
        message: "test: must be transaction blocked",
      }, gatedOptions);
      assert.equal(blockedCommit.execution_ok, false);
      assert.match(blockedCommit.reason, /active transaction|transaction/i);
      const blockedRunner = createDevTestRunner({
        suiteDefinitions: { mcp: { executable: process.execPath, argv: ["-e", "process.exit(0)"], timeoutMs: 10_000 } },
        lockPath: path.join(h.root, "barrier-test.lock"),
        workspaceContextResolver: gatedResolver,
      });
      const blockedTest = await blockedRunner({ suite: "mcp", workspace_id: h.workspace_id });
      assert.equal(blockedTest.passed, false);
      assert.match(blockedTest.stderr, /transaction/i);
      const checkpointBlockedService = createDevCheckpointService({
        storageRoot: path.join(h.root, "barrier-checkpoints"),
        repositoryRoot: h.repositoryRoot,
        workspaceContextResolver: gatedResolver,
        journal: h.journal.api,
      });
      await expectCode(checkpointBlockedService.create({ workspace_id: h.workspace_id, label: "must be blocked" }), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      assert.equal((await dev_read_file({ workspace_id: unrelatedWorkspaceId, path: "tests/a.txt" }, gatedOptions)).content.length > 0, true);

      // A child may die after creating a target-local publish temp but before rename.
      // This exact transaction-owned reserved path is a known safe intermediate and
      // must be reclaimed before exact SOURCE verification.
      const strandedPublishTemp = `${path.join(h.repositoryRoot, "tests", "a.txt")}.writer-workbench-${transaction.transaction_id.slice(-12)}.tmp`;
      await writeFile(strandedPublishTemp, "partial-transaction-temp\n", "utf8");

      const reloaded = h.makeTransactionService();
      const initialized = await reloaded.initialize();
      assert.equal(initialized.health, "healthy");
      const recovered = await reloaded.get({ transaction_id: transaction.transaction_id });
      assert.equal(recovered.state, "rolled_back");
      assert.equal(recovered.commit_marker, false);
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, sourceSnapshot.workspace_snapshot_id);
      await assert.rejects(readFile(strandedPublishTemp, "utf8"), /ENOENT/u);
      await reloaded.assertWorkspaceAvailable(h.workspace_id);
      assert.equal(recovered.transaction_plan_hash, transaction.transaction_plan_hash);
    } finally { await h.cleanup(); }
  }

  // All target files may already match, but no COMMIT marker still means rollback SOURCE.
  {
    const h = await harness("target-before-marker");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const sourceSnapshot = await computeWorkspaceSnapshot(await h.contextResolver());
      const crashing = h.makeTransactionService({ beforeCommitMarker: async () => { throw simulatedCrash("before commit marker"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      assert.equal(transaction.commit_marker, false);
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, sourceSnapshot.workspace_snapshot_id);
      assert.equal((await reloaded.get({ transaction_id: transaction.transaction_id })).state, "rolled_back");
    } finally { await h.cleanup(); }
  }

  // Crash after durable COMMIT marker: reload must keep/reconcile TARGET, never rollback.
  {
    const h = await harness("after-commit-marker");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const crashing = h.makeTransactionService({ afterCommitMarker: async () => { throw simulatedCrash("after commit marker"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      assert.equal(transaction.commit_marker, true);
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      const completed = await reloaded.get({ transaction_id: transaction.transaction_id });
      assert.equal(completed.state, "completed");
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
    } finally { await h.cleanup(); }
  }

  // Rollback itself may crash; subsequent reload resumes idempotently to exact SOURCE.
  {
    const h = await harness("rollback-crash");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const sourceSnapshot = await computeWorkspaceSnapshot(await h.contextResolver());
      let applyCount = 0;
      const crashing = h.makeTransactionService({ afterTransition: async () => { applyCount += 1; if (applyCount === 2) throw simulatedCrash("partial apply"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      let rollbackCount = 0;
      const rollbackCrashes = h.makeTransactionService({ duringRollback: async () => { rollbackCount += 1; if (rollbackCount === 1) throw simulatedCrash("rollback interrupted"); } });
      await rollbackCrashes.initialize();
      assert.equal((await rollbackCrashes.get({ transaction_id: transaction.transaction_id })).state, "recovery_required");
      const finalReload = h.makeTransactionService();
      await finalReload.initialize();
      assert.equal((await finalReload.get({ transaction_id: transaction.transaction_id })).state, "rolled_back");
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, sourceSnapshot.workspace_snapshot_id);
    } finally { await h.cleanup(); }
  }

  // External C state is never overwritten during recovery: block workspace as recovery_required.
  {
    const h = await harness("ambiguous-external");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      let count = 0;
      const crashing = h.makeTransactionService({ afterTransition: async () => { count += 1; if (count === 1) throw simulatedCrash("partial apply"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      const plan = JSON.parse(await readFile(path.join(h.transactionRoot, "records", transaction.transaction_id, "plan.json"), "utf8"));
      const changedPath = plan.execution_order[0];
      const absolute = path.join(h.repositoryRoot, changedPath);
      await rm(absolute, { recursive: true, force: true }).catch(() => {});
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, "external-C\n", "utf8");
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      const blocked = await reloaded.get({ transaction_id: transaction.transaction_id });
      assert.equal(blocked.state, "recovery_required");
      assert.equal(blocked.failure.code, "AMBIGUOUS_EXTERNAL_MUTATION");
      assert.equal(await readFile(absolute, "utf8"), "external-C\n");
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
      assert.equal((await reloaded.status()).health, "degraded");
    } finally { await h.cleanup(); }
  }

  // HEAD race after target verification cannot commit and never rewinds Git.
  {
    const h = await harness("head-race");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      let advancedHead = null;
      const racing = h.makeTransactionService({
        beforeCommitMarker: async () => {
          await git(h.repositoryRoot, ["add", "--all"]);
          await git(h.repositoryRoot, ["commit", "-m", "external controlled head race"]);
          advancedHead = (await git(h.repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
        },
      });
      await expectCode(racing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "CHECKPOINT_HEAD_MISMATCH");
      const transaction = await firstTransaction(racing, h.workspace_id);
      assert.equal(transaction.commit_marker, false);
      assert.equal((await git(h.repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase(), advancedHead);
      assert.equal((await racing.get({ transaction_id: transaction.transaction_id })).state, "recovery_required");
    } finally { await h.cleanup(); }
  }

  // Marker integrity is fail-closed.
  {
    const h = await harness("marker-corrupt");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const crashing = h.makeTransactionService({ afterPrepared: async () => { throw simulatedCrash("prepared crash"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const transaction = await firstTransaction(crashing, h.workspace_id);
      const markerPath = path.join(h.transactionRoot, "records", transaction.transaction_id, "prepared.marker");
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      marker.transaction_plan_hash = "f".repeat(64);
      await writeFile(markerPath, `${JSON.stringify(marker)}\n`, "utf8");
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      assert.equal((await reloaded.status()).health, "corrupt");
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  // Orphan persistent barrier is explicit subsystem corruption and still reports the blocked workspace.
  {
    const h = await harness("orphan-barrier");
    try {
      const service = h.makeTransactionService();
      await service.status();
      const orphanTransactionId = `dev_transaction_${randomUUID().replaceAll("-", "")}`;
      const barrierRoot = path.join(h.transactionRoot, "barriers");
      await writeFile(path.join(barrierRoot, `${h.workspace_id}.json`), `${JSON.stringify({
        schema_version: 1,
        workspace_id: h.workspace_id,
        transaction_id: orphanTransactionId,
        state: "preparing",
        transaction_plan_hash: null,
        updated_at: new Date().toISOString(),
      })}\n`, "utf8");
      const status = await service.status();
      assert.equal(status.health, "corrupt");
      assert(status.integrity_issues.some((issue) => issue.code === "TRANSACTION_ORPHAN_BARRIER"));
      assert(status.blocked_workspaces.includes(h.workspace_id));
      await expectCode(service.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  // Malformed persistent transaction metadata is fail-closed and never releases its workspace barrier.
  {
    const h = await harness("record-corrupt");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const crashing = h.makeTransactionService({ afterPrepared: async () => { throw simulatedCrash("prepared crash"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const pending = await firstTransaction(crashing, h.workspace_id);
      const recordPath = path.join(h.transactionRoot, "records", pending.transaction_id, "transaction.json");
      const record = JSON.parse(await readFile(recordPath, "utf8"));
      record.created_at = "not-a-timestamp";
      await writeFile(recordPath, `${JSON.stringify(record)}\n`, "utf8");
      const reloaded = h.makeTransactionService();
      const initialized = await reloaded.initialize();
      assert.equal(initialized.health, "corrupt");
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  // Pre-PREPARED crash is safe-abort/reclaimable semantics: no workspace effect, barrier released, owned hidden recovery root retired.
  {
    const h = await harness("pre-prepared");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const sourceSnapshot = await computeWorkspaceSnapshot(await h.contextResolver());
      const originalCapture = h.checkpointApi.captureRecovery;
      const transaction = createDevTransactionService({
        storageRoot: h.transactionRoot,
        workspaceContextResolver: h.contextResolver,
        checkpoint: { ...h.checkpointApi, captureRecovery: async (...args) => { await originalCapture(...args); throw simulatedCrash("pre-prepared interruption"); } },
        journal: h.journal.api,
      });
      await expectCode(transaction.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const pending = await firstTransaction(transaction, h.workspace_id);
      assert.equal(pending.prepared_marker, false);
      const ownedBefore = await h.checkpointService.listInternalTransactionCheckpointsByOwner(pending.transaction_id);
      assert.equal(ownedBefore.filter((entry) => entry.state === "active").length, 1);
      const stagingRoot = path.join(h.transactionRoot, "records", pending.transaction_id, "after-images");
      await mkdir(stagingRoot, { recursive: true });
      await writeFile(path.join(stagingRoot, "orphan.tmp"), "reclaimable\n", "utf8");
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      assert.equal((await reloaded.get({ transaction_id: pending.transaction_id })).state, "abandoned");
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, sourceSnapshot.workspace_snapshot_id);
      assert.equal((await h.checkpointService.listInternalTransactionCheckpointsByOwner(pending.transaction_id)).filter((entry) => entry.state === "active").length, 0);
      await assert.rejects(readFile(path.join(stagingRoot, "orphan.tmp"), "utf8"), /ENOENT/u);
      await reloaded.assertWorkspaceAvailable(h.workspace_id);
    } finally { await h.cleanup(); }
  }

  // Pre-PREPARED barrier does not hide external/manual drift: abandon is refused and workspace remains blocked.
  {
    const h = await harness("pre-prepared-external-drift");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const originalCapture = h.checkpointApi.captureRecovery;
      const transaction = createDevTransactionService({
        storageRoot: h.transactionRoot,
        workspaceContextResolver: h.contextResolver,
        checkpoint: { ...h.checkpointApi, captureRecovery: async (...args) => { await originalCapture(...args); throw simulatedCrash("pre-prepared interruption"); } },
        journal: h.journal.api,
      });
      await expectCode(transaction.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const pending = await firstTransaction(transaction, h.workspace_id);
      await writeFile(path.join(h.repositoryRoot, "tests", "a.txt"), "external-pre-prepared-C\n", "utf8");
      const reloaded = h.makeTransactionService();
      const initialized = await reloaded.initialize();
      assert.equal(initialized.health, "degraded");
      const blocked = await reloaded.get({ transaction_id: pending.transaction_id });
      assert.equal(blocked.state, "recovery_required");
      assert.equal(blocked.failure.code, "TRANSACTION_PRE_PREPARED_SOURCE_CHANGED");
      assert.equal(await readFile(path.join(h.repositoryRoot, "tests", "a.txt"), "utf8"), "external-pre-prepared-C\n");
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  // Missing recovery checkpoint after PREPARED fails closed and keeps the barrier.
  {
    const h = await harness("missing-recovery-checkpoint");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const crashing = h.makeTransactionService({ afterPrepared: async () => { throw simulatedCrash("prepared crash"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const pending = await firstTransaction(crashing, h.workspace_id);
      await h.checkpointService.retireInternalTransactionCheckpoint(pending.recovery_checkpoint_id);
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      const blocked = await reloaded.get({ transaction_id: pending.transaction_id });
      assert.equal(blocked.state, "recovery_required");
      assert.equal((await reloaded.status()).health, "degraded");
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  // Corrupt COMMIT marker never triggers SOURCE rollback; integrity status fails closed and target remains blocked.
  {
    const h = await harness("commit-marker-corrupt");
    try {
      const checkpoint = await createTargetState(h);
      await mutateToSourceState(h);
      const crashing = h.makeTransactionService({ afterCommitMarker: async () => { throw simulatedCrash("after commit marker"); } });
      await expectCode(crashing.restore({ workspace_id: h.workspace_id, checkpoint_id: checkpoint.checkpoint_id }), "SIMULATED_TRANSACTION_CRASH");
      const pending = await firstTransaction(crashing, h.workspace_id);
      const markerPath = path.join(h.transactionRoot, "records", pending.transaction_id, "commit.marker");
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      marker.transaction_plan_hash = "e".repeat(64);
      await writeFile(markerPath, `${JSON.stringify(marker)}\n`, "utf8");
      const reloaded = h.makeTransactionService();
      await reloaded.initialize();
      assert.equal((await reloaded.status()).health, "corrupt");
      assert.equal((await computeWorkspaceSnapshot(await h.contextResolver())).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      await expectCode(reloaded.assertWorkspaceAvailable(h.workspace_id), "WORKSPACE_TRANSACTION_IN_PROGRESS");
    } finally { await h.cleanup(); }
  }

  console.log("MCP development transaction runtime tests passed.");
}

if (process.argv[2] === "--barrier-worker") await runBarrierWorker();
else await runTests();
