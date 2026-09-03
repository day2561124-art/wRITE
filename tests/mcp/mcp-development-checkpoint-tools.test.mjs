import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  createDevCheckpointService,
} from "../../server/src/mcp-development-checkpoint-tools.mjs";
import {
  computeWorkspaceSnapshot,
} from "../../server/src/mcp-development-journal-tools.mjs";
import {
  createDevWorkstreamRegistryService,
} from "../../server/src/mcp-development-workstream-tools.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

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

function createJournalStub() {
  let sequence = 0;
  const events = [];
  const nextOperationId = () => `dev_operation_${(++sequence).toString(16).padStart(32, "0")}`;
  return {
    events,
    api: {
      async begin(input) {
        const operation_id = nextOperationId();
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
      async markDegraded(reason) {
        events.push({ stage: "degraded", reason: String(reason) });
      },
    },
  };
}

function randomWorkspaceId() {
  return `dev_workspace_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function randomWorkstreamId() {
  return `dev_workstream_20260903-050000_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function initRepository(repositoryRoot, { extraTracked = {} } = {}) {
  await mkdir(path.join(repositoryRoot, "tests"), { recursive: true });
  await git(repositoryRoot, ["init", "-b", "main"]);
  await git(repositoryRoot, ["config", "user.name", "Phase 3B Checkpoint Test"]);
  await git(repositoryRoot, ["config", "user.email", "phase3b@test.invalid"]);
  const tracked = {
    "tests/tracked.txt": "base tracked\n",
    "tests/to-delete.txt": "delete me\n",
    ...extraTracked,
  };
  for (const [relativePath, content] of Object.entries(tracked)) {
    const target = path.join(repositoryRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  await git(repositoryRoot, ["add", "--all"]);
  await git(repositoryRoot, ["commit", "-m", "checkpoint fixture baseline"]);
  return (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
}

async function simpleHarness(label, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), `writer-workbench-checkpoint-${label}-`));
  const repositoryRoot = path.join(root, "repo");
  await mkdir(repositoryRoot);
  const baseHead = await initRepository(repositoryRoot, options);
  const workspace_id = randomWorkspaceId();
  const workstream_id = randomWorkstreamId();
  const storageRoot = path.join(root, "checkpoints");
  const journal = createJournalStub();

  async function contextResolver() {
    const currentHead = (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
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
      current_head: currentHead,
      git_dir: path.resolve(repositoryRoot, gitDirRaw),
      git_common_dir: path.resolve(repositoryRoot, gitCommonRaw),
      lifecycle_state: "active",
      workstream_state: "active",
      healthy: true,
      mutation_allowed: true,
    };
  }

  const service = (serviceOptions = {}) => createDevCheckpointService({
    storageRoot,
    repositoryRoot,
    workspaceContextResolver: contextResolver,
    journal: journal.api,
    ...serviceOptions,
  });

  return {
    root,
    repositoryRoot,
    storageRoot,
    baseHead,
    workspace_id,
    workstream_id,
    journal,
    contextResolver,
    service,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code, error?.stack ?? error?.message);
    return true;
  });
}

async function workerContextFromEnvironment() {
  const repositoryRoot = process.env.CHECKPOINT_WORKER_REPOSITORY_ROOT;
  const workspace_id = process.env.CHECKPOINT_WORKER_WORKSPACE_ID;
  const workstream_id = process.env.CHECKPOINT_WORKER_WORKSTREAM_ID;
  const baseHead = process.env.CHECKPOINT_WORKER_BASE_HEAD;
  return async () => {
    const currentHead = (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase();
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
      current_head: currentHead,
      git_dir: path.resolve(repositoryRoot, gitDirRaw),
      git_common_dir: path.resolve(repositoryRoot, gitCommonRaw),
      lifecycle_state: "active",
      workstream_state: "active",
      healthy: true,
      mutation_allowed: true,
    };
  };
}

async function runConcurrentWorker() {
  const contextResolver = await workerContextFromEnvironment();
  const journal = createJournalStub();
  const service = createDevCheckpointService({
    storageRoot: process.env.CHECKPOINT_WORKER_STORAGE_ROOT,
    repositoryRoot: process.env.CHECKPOINT_WORKER_REPOSITORY_ROOT,
    workspaceContextResolver: contextResolver,
    journal: journal.api,
  });
  const result = await service.create({
    workspace_id: process.env.CHECKPOINT_WORKER_WORKSPACE_ID,
    label: `worker-${process.pid}`,
  });
  process.stdout.write(`${JSON.stringify({ checkpoint_id: result.checkpoint_id, checkpoint_content_id: result.checkpoint_content_id })}\n`);
}

async function spawnConcurrentWorker(harness) {
  const child = spawn(process.execPath, [__filename, "--checkpoint-worker"], {
    env: {
      ...process.env,
      CHECKPOINT_WORKER_REPOSITORY_ROOT: harness.repositoryRoot,
      CHECKPOINT_WORKER_STORAGE_ROOT: harness.storageRoot,
      CHECKPOINT_WORKER_WORKSPACE_ID: harness.workspace_id,
      CHECKPOINT_WORKER_WORKSTREAM_ID: harness.workstream_id,
      CHECKPOINT_WORKER_BASE_HEAD: harness.baseHead,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) throw new Error(`checkpoint worker failed (${code}): ${stderr || stdout}`);
  return JSON.parse(stdout.trim());
}

async function recoveryHarness(label) {
  const root = await mkdtemp(path.join(os.tmpdir(), `writer-workbench-checkpoint-recovery-${label}-`));
  const repositoryRoot = path.join(root, "repo");
  const worktreeRootPath = path.join(root, ".writer-workbench-worktrees");
  await mkdir(repositoryRoot);
  const baseHead = await initRepository(repositoryRoot);
  const registryPath = path.join(projectRoot, "tests", ".tmp", `phase3b-workstreams-${randomUUID()}.json`);
  await mkdir(path.dirname(registryPath), { recursive: true });
  const workstreams = createDevWorkstreamRegistryService({
    registryPath,
    repositoryRoot,
    worktreeRootPath,
    headReader: async () => (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim().toLowerCase(),
  });
  const source = await workstreams.begin({
    label: "Phase 3B recovery source",
    purpose: "experiment",
    declared_scope: ["tests"],
  });
  const workspace = await workstreams.createIsolated({
    workstream_id: source.workstream_id,
    expected_workstream_revision: source.revision,
  });
  const sourceContext = await workstreams.resolveExecutionContext({ workspace_id: workspace.workspace_id });
  const journal = createJournalStub();
  const storageRoot = path.join(root, "checkpoints");
  const service = () => createDevCheckpointService({
    storageRoot,
    repositoryRoot,
    workspaceContextResolver: (input, options) => workstreams.resolveExecutionContext(input, options),
    recoveryContextResolver: (input) => workstreams.resolveExecutionContext(input, {
      mutation: true,
      lifecycleStates: ["materializing", "verifying"],
    }),
    beginRecoveryWorkstream: (input) => workstreams.beginRecovery(input),
    createRecoveryIsolated: (input) => workstreams.createIsolated(input, { recovery: true }),
    transitionRecoveryWorkspace: (input) => workstreams.transitionRecoveryWorkspace(input),
    listRecoveryWorkspaces: () => workstreams.listRecoveryWorkspacesInternal(),
    journal: journal.api,
  });
  return {
    root,
    repositoryRoot,
    registryPath,
    baseHead,
    workstreams,
    source,
    workspace,
    sourceContext,
    journal,
    storageRoot,
    service,
    cleanup: async () => {
      await rm(registryPath, { force: true }).catch(() => {});
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function runTests() {
  // A clean workspace is a valid checkpoint: exact HEAD + empty overlay.
  {
    const h = await simpleHarness("clean");
    try {
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace_id, label: "clean" });
      assert.equal(checkpoint.git_head, h.baseHead);
      assert.equal(checkpoint.artifact_count, 0);
      assert.equal(checkpoint.logical_bytes, 0);
      assert.equal((await service.get({ checkpoint_id: checkpoint.checkpoint_id })).health, "healthy");
      assert.equal((await service.compare({ checkpoint_id: checkpoint.checkpoint_id, workspace_id: h.workspace_id })).identical, true);
    } finally { await h.cleanup(); }
  }

  // Ignored empty directories are not silently included in checkpoint coverage.
  {
    const h = await simpleHarness("ignored-empty");
    try {
      await writeFile(path.join(h.repositoryRoot, ".gitignore"), "tests/ignored-empty/\n", "utf8");
      await git(h.repositoryRoot, ["add", ".gitignore"]);
      await git(h.repositoryRoot, ["commit", "-m", "ignore checkpoint fixture directory"]);
      await mkdir(path.join(h.repositoryRoot, "tests", "ignored-empty"));
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace_id, label: "ignored empty" });
      const detail = await service.get({ checkpoint_id: checkpoint.checkpoint_id });
      assert.equal(detail.artifacts.some((artifact) => artifact.path === "tests/ignored-empty"), false);
      assert.equal((await service.compare({ checkpoint_id: checkpoint.checkpoint_id, workspace_id: h.workspace_id })).identical, true);
    } finally { await h.cleanup(); }
  }

  // Complete capture: modified tracked + approved untracked + deleted tracked + empty directory.
  {
    const h = await simpleHarness("capture");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "checkpoint one\n", "utf8");
      await writeFile(path.join(h.repositoryRoot, "tests", "new.txt"), "new checkpoint file\n", "utf8");
      await unlink(path.join(h.repositoryRoot, "tests", "to-delete.txt"));
      await mkdir(path.join(h.repositoryRoot, "tests", "empty-dir"));
      const before = await computeWorkspaceSnapshot(await h.contextResolver());
      const service = h.service();
      const c1 = await service.create({ workspace_id: h.workspace_id, label: "C1" });
      assert.equal(c1.workspace_snapshot_id, before.workspace_snapshot_id);
      assert.equal(c1.git_head, h.baseHead);
      assert.equal(c1.capture_coverage.complete, true);
      const detail = await service.get({ checkpoint_id: c1.checkpoint_id });
      const states = new Map(detail.artifacts.map((artifact) => [artifact.path, artifact.state]));
      assert.equal(states.get("tests/tracked.txt"), "modified");
      assert.equal(states.get("tests/new.txt"), "added");
      assert.equal(states.get("tests/to-delete.txt"), "deleted");
      assert.equal(states.get("tests/empty-dir"), "directory");
      const read = await service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "tests/tracked.txt" });
      assert.equal(read.content, "checkpoint one\n");
      await expectCode(service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "tests/to-delete.txt" }), "CHECKPOINT_PATH_DELETED");
      await expectCode(service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "tests/absent.txt" }), "CHECKPOINT_PATH_ABSENT");
      await expectCode(service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "tests/empty-dir" }), "CHECKPOINT_PATH_DIRECTORY");
      await expectCode(service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "data/secret.txt" }), "CHECKPOINT_INCOMPLETE_SOURCE");
      assert.equal((await service.compare({ checkpoint_id: c1.checkpoint_id, workspace_id: h.workspace_id })).identical, true);

      const duplicate = await service.create({ workspace_id: h.workspace_id, label: "same content, new lifecycle identity" });
      assert.notEqual(duplicate.checkpoint_id, c1.checkpoint_id);
      assert.equal(duplicate.checkpoint_content_id, c1.checkpoint_content_id);
      const dedupStatus = await service.status();
      assert.equal(dedupStatus.health, "healthy");
      assert(dedupStatus.deduplicated_bytes_saved > 0);

      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "checkpoint two\n", "utf8");
      await writeFile(path.join(h.repositoryRoot, "tests", "later.txt"), "later\n", "utf8");
      const c2 = await service.create({ workspace_id: h.workspace_id, label: "C2" });
      assert.notEqual(c2.workspace_snapshot_id, c1.workspace_snapshot_id);
      const compared = await service.compare({ checkpoint_id: c1.checkpoint_id, other_checkpoint_id: c2.checkpoint_id });
      assert.equal(compared.identical, false);
      assert(compared.modified_paths.includes("tests/tracked.txt"));
      assert(compared.added_paths.includes("tests/later.txt"));
      assert.equal((await service.readCheckpointFile({ checkpoint_id: c1.checkpoint_id, path: "tests/tracked.txt" })).content, "checkpoint one\n");

      // Empty-directory-only drift must not be hidden by an unchanged Phase 3A snapshot ID.
      await rm(path.join(h.repositoryRoot, "tests", "empty-dir"), { recursive: true, force: false });
      const directoryCompare = await service.compare({ checkpoint_id: c2.checkpoint_id, workspace_id: h.workspace_id });
      assert.equal(directoryCompare.left_snapshot_id, directoryCompare.right_snapshot_id);
      assert.equal(directoryCompare.identical, false);
      assert(directoryCompare.deleted_paths.includes("tests/empty-dir"));
      await mkdir(path.join(h.repositoryRoot, "tests", "empty-dir"));

      await service.deleteCheckpoint({ checkpoint_id: c1.checkpoint_id });
      assert.equal((await service.readCheckpointFile({ checkpoint_id: duplicate.checkpoint_id, path: "tests/tracked.txt" })).content, "checkpoint one\n");
      await service.deleteCheckpoint({ checkpoint_id: duplicate.checkpoint_id });
      await service.deleteCheckpoint({ checkpoint_id: c2.checkpoint_id });
      const gcDryRun = await service.gc({ dryRun: true });
      assert(gcDryRun.reclaimable_blob_count > 0);
      const gc = await service.gc({ dryRun: false });
      assert.equal(gc.reclaimed_blob_count, gcDryRun.reclaimable_blob_count);
      const afterGc = await service.status();
      assert.equal(afterGc.health, "healthy");
      assert.equal(afterGc.reclaimable_blob_count, 0);
      assert.equal(afterGc.physical_blob_bytes, 0);
    } finally { await h.cleanup(); }
  }

  // Source CAS drift after initial snapshot is rejected without a visible checkpoint.
  {
    const h = await simpleHarness("source-drift");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "before drift\n", "utf8");
      const service = h.service({
        hooks: {
          afterInitialSnapshot: async () => {
            await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "after drift\n", "utf8");
          },
        },
      });
      await expectCode(service.create({ workspace_id: h.workspace_id }), "CHECKPOINT_SOURCE_CHANGED");
      assert.equal((await service.list({ workspace_id: h.workspace_id })).total, 0);
    } finally { await h.cleanup(); }
  }

  // Crash while publishing blobs leaves only reclaimable orphan blobs and no visible checkpoint.
  {
    const h = await simpleHarness("partial-blob");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "blob one\n", "utf8");
      await writeFile(path.join(h.repositoryRoot, "tests", "new.txt"), "blob two\n", "utf8");
      let publishes = 0;
      const service = h.service({
        hooks: {
          afterEachBlobPublish: async () => {
            publishes += 1;
            if (publishes === 1) throw new Error("simulated crash after first blob");
          },
        },
      });
      await assert.rejects(service.create({ workspace_id: h.workspace_id }), /simulated crash/u);
      assert.equal((await service.list({ workspace_id: h.workspace_id })).total, 0);
      const status = await service.status();
      assert.equal(status.health, "healthy");
      assert.equal(status.reclaimable_blob_count, 1);
      assert(status.reclaimable_bytes > 0);
    } finally { await h.cleanup(); }
  }

  // Identity manifest is the visibility commit point; interrupted registry update is reconciled.
  {
    const h = await simpleHarness("registry-reconcile");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "registry reconcile\n", "utf8");
      const checkpointId = `dev_checkpoint_${"a".repeat(32)}`;
      const interrupted = h.service({
        idGenerator: () => checkpointId,
        hooks: {
          afterIdentityPublishBeforeRegistry: async () => { throw new Error("simulated registry interruption"); },
        },
      });
      await assert.rejects(interrupted.create({ workspace_id: h.workspace_id }), /simulated registry interruption/u);
      const recoveredService = h.service();
      const listed = await recoveredService.list({ workspace_id: h.workspace_id });
      assert.equal(listed.total, 1);
      assert.equal(listed.checkpoints[0].checkpoint_id, checkpointId);
      assert.equal((await recoveredService.get({ checkpoint_id: checkpointId })).health, "healthy");
    } finally { await h.cleanup(); }
  }

  // Count quota is fail-closed and never evicts an older checkpoint automatically.
  {
    const h = await simpleHarness("quota");
    try {
      const service = h.service({ quotas: { maxCheckpointsPerWorkspace: 1, maxCheckpointsPerWorkstream: 1 } });
      await service.create({ workspace_id: h.workspace_id, label: "first" });
      await expectCode(service.create({ workspace_id: h.workspace_id, label: "second" }), "CHECKPOINT_QUOTA_EXCEEDED");
      assert.equal((await service.list({ workspace_id: h.workspace_id })).total, 1);
    } finally { await h.cleanup(); }
  }

  // Conservative staged-index semantics.
  {
    const h = await simpleHarness("staged");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "staged\n", "utf8");
      await git(h.repositoryRoot, ["add", "tests/tracked.txt"]);
      await expectCode(h.service().create({ workspace_id: h.workspace_id }), "CHECKPOINT_UNSUPPORTED_INDEX_STATE");
    } finally { await h.cleanup(); }
  }

  // Conflicted index and in-progress Git operations are rejected by the conservative HEAD+working-tree model.
  {
    const conflicted = await simpleHarness("conflicted");
    try {
      await git(conflicted.repositoryRoot, ["checkout", "-b", "phase3b-conflict-side"]);
      await writeFile(path.join(conflicted.repositoryRoot, "tests", "tracked.txt"), "side\n", "utf8");
      await git(conflicted.repositoryRoot, ["add", "tests/tracked.txt"]);
      await git(conflicted.repositoryRoot, ["commit", "-m", "side conflict"]);
      await git(conflicted.repositoryRoot, ["checkout", "main"]);
      await writeFile(path.join(conflicted.repositoryRoot, "tests", "tracked.txt"), "main\n", "utf8");
      await git(conflicted.repositoryRoot, ["add", "tests/tracked.txt"]);
      await git(conflicted.repositoryRoot, ["commit", "-m", "main conflict"]);
      await git(conflicted.repositoryRoot, ["merge", "phase3b-conflict-side"], { allowFailure: true });
      await expectCode(conflicted.service().create({ workspace_id: conflicted.workspace_id }), "CHECKPOINT_UNSUPPORTED_INDEX_STATE");
    } finally { await conflicted.cleanup(); }

    const operation = await simpleHarness("git-operation");
    try {
      await writeFile(path.join(operation.repositoryRoot, ".git", "MERGE_HEAD"), `${operation.baseHead}\n`, "utf8");
      await expectCode(operation.service().create({ workspace_id: operation.workspace_id }), "CHECKPOINT_UNSUPPORTED_INDEX_STATE");
    } finally { await operation.cleanup(); }
  }

  // Unsupported/binary, protected and oversized changed artifacts fail closed instead of silent skipping.
  {
    const binary = await simpleHarness("binary");
    try {
      await writeFile(path.join(binary.repositoryRoot, "tests", "binary.txt"), Buffer.from([0, 1, 2, 3]));
      await expectCode(binary.service().create({ workspace_id: binary.workspace_id }), "CHECKPOINT_INCOMPLETE_SOURCE");
    } finally { await binary.cleanup(); }

    const protectedHarness = await simpleHarness("protected", { extraTracked: { "data/protected.txt": "protected base\n" } });
    try {
      await writeFile(path.join(protectedHarness.repositoryRoot, "data", "protected.txt"), "protected changed\n", "utf8");
      await expectCode(protectedHarness.service().create({ workspace_id: protectedHarness.workspace_id }), "CHECKPOINT_INCOMPLETE_SOURCE");
    } finally { await protectedHarness.cleanup(); }

    const oversized = await simpleHarness("oversized");
    try {
      await writeFile(path.join(oversized.repositoryRoot, "tests", "large.txt"), "123456789\n", "utf8");
      await expectCode(oversized.service({ quotas: { maxFileBytes: 5 } }).create({ workspace_id: oversized.workspace_id }), "CHECKPOINT_INCOMPLETE_SOURCE");
    } finally { await oversized.cleanup(); }
  }

  // Checkpoint file reads remain bounded even when capture safely stores a larger UTF-8 development file.
  {
    const h = await simpleHarness("read-too-large");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "large-readable.txt"), `${"x".repeat(300_000)}\n`, "utf8");
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace_id });
      await expectCode(
        service.readCheckpointFile({ checkpoint_id: checkpoint.checkpoint_id, path: "tests/large-readable.txt" }),
        "CHECKPOINT_READ_TOO_LARGE",
      );
    } finally { await h.cleanup(); }
  }

  // Symlink capture is rejected when the host permits creating the fixture symlink.
  {
    const h = await simpleHarness("symlink");
    try {
      const outside = path.join(h.root, "outside.txt");
      await writeFile(outside, "outside\n", "utf8");
      let supported = true;
      try { await symlink(outside, path.join(h.repositoryRoot, "tests", "unsafe.txt")); } catch (error) {
        if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) supported = false;
        else throw error;
      }
      if (supported) await expectCode(h.service().create({ workspace_id: h.workspace_id }), "CHECKPOINT_INCOMPLETE_SOURCE");
    } finally { await h.cleanup(); }
  }

  // Corrupt active blobs degrade health, block reads/recovery roots, and block destructive GC.
  {
    const h = await simpleHarness("corrupt-blob");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "corrupt me\n", "utf8");
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace_id });
      const detail = await service.get({ checkpoint_id: checkpoint.checkpoint_id });
      const artifact = detail.artifacts.find((item) => item.path === "tests/tracked.txt");
      const blobPath = path.join(h.storageRoot, "blobs", "sha256", artifact.sha256.slice(0, 2), artifact.sha256);
      await writeFile(blobPath, "tampered", "utf8");
      assert.equal((await service.get({ checkpoint_id: checkpoint.checkpoint_id })).health, "corrupt");
      assert.equal((await service.status()).health, "corrupt");
      await expectCode(service.readCheckpointFile({ checkpoint_id: checkpoint.checkpoint_id, path: "tests/tracked.txt" }), "CHECKPOINT_STORE_CORRUPT");
      await expectCode(service.gc({ dryRun: false }), "CHECKPOINT_STORE_CORRUPT");
    } finally { await h.cleanup(); }
  }

  // Cross-process checkpoint publication: unique lifecycle IDs, shared content ID, intact CAS/registry.
  {
    const h = await simpleHarness("cross-process");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "concurrent state\n", "utf8");
      await writeFile(path.join(h.repositoryRoot, "tests", "new.txt"), "concurrent new\n", "utf8");
      const results = await Promise.all([spawnConcurrentWorker(h), spawnConcurrentWorker(h)]);
      assert.notEqual(results[0].checkpoint_id, results[1].checkpoint_id);
      assert.equal(results[0].checkpoint_content_id, results[1].checkpoint_content_id);
      const service = h.service();
      const listed = await service.list({ workspace_id: h.workspace_id });
      assert.equal(listed.total, 2);
      assert.equal(new Set(listed.checkpoints.map((item) => item.checkpoint_id)).size, 2);
      assert.equal((await service.status()).health, "healthy");
    } finally { await h.cleanup(); }
  }

  // Destructive GC cannot race a checkpoint publish root-set mutation; the store lock serializes manifest visibility and reclamation.
  {
    const h = await simpleHarness("gc-publish-race");
    try {
      await writeFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "race state\n", "utf8");
      let releasePublish;
      let blobPublishedResolve;
      const blobPublished = new Promise((resolve) => { blobPublishedResolve = resolve; });
      const release = new Promise((resolve) => { releasePublish = resolve; });
      const creating = h.service({
        hooks: {
          afterEachBlobPublish: async () => {
            blobPublishedResolve();
            await release;
          },
        },
      }).create({ workspace_id: h.workspace_id, label: "publish race" });
      await blobPublished;
      let gcResolved = false;
      const gcPromise = h.service().gc({ dryRun: false }).then((result) => {
        gcResolved = true;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(gcResolved, false, "GC must wait while checkpoint manifest publication owns the maintenance lock");
      releasePublish();
      const checkpoint = await creating;
      const gc = await gcPromise;
      assert.equal(gc.reclaimed_blob_count, 0);
      assert.equal((await h.service().get({ checkpoint_id: checkpoint.checkpoint_id })).health, "healthy");
    } finally { await h.cleanup(); }
  }

  // Recovery fork uses exact checkpoint HEAD, preserves source/main, reproduces overlay and empty directories.
  {
    const h = await recoveryHarness("exact");
    try {
      const sourceRoot = h.sourceContext.root;
      await writeFile(path.join(sourceRoot, "tests", "tracked.txt"), "recover this\n", "utf8");
      await writeFile(path.join(sourceRoot, "tests", "new.txt"), "recovery new\n", "utf8");
      await unlink(path.join(sourceRoot, "tests", "to-delete.txt"));
      await mkdir(path.join(sourceRoot, "tests", "empty-dir"));
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace.workspace_id, label: "Recovery source" });
      await writeFile(path.join(sourceRoot, "tests", "tracked.txt"), "source advanced after checkpoint\n", "utf8");
      const sourceAfter = await computeWorkspaceSnapshot(await h.workstreams.resolveExecutionContext({ workspace_id: h.workspace.workspace_id }));
      const mainBefore = await readFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "utf8");
      const recovered = await service.recover({ checkpoint_id: checkpoint.checkpoint_id });
      assert.notEqual(recovered.recovery_workstream_id, h.source.workstream_id);
      assert.notEqual(recovered.recovery_workspace_id, h.workspace.workspace_id);
      assert.equal(recovered.git_head, checkpoint.git_head);
      assert.equal(recovered.workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      const recoveryRecord = await h.workstreams.get({ workstream_id: recovered.recovery_workstream_id });
      assert.equal(recoveryRecord.metadata.recovery_operation_id, recovered.operation_id);
      const recoveryStarted = h.journal.events.find((event) => event.stage === "started" && event.operation_id === recovered.operation_id);
      assert(recoveryStarted);
      assert.equal(recoveryStarted.input.workstream_id, h.source.workstream_id);
      assert.equal(recoveryStarted.input.workspace_id, h.workspace.workspace_id);
      const recoveryContext = await h.workstreams.resolveExecutionContext({ workspace_id: recovered.recovery_workspace_id });
      assert.equal(recoveryContext.current_head, checkpoint.git_head);
      assert.equal((await computeWorkspaceSnapshot(recoveryContext)).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      assert.equal(await readFile(path.join(recoveryContext.root, "tests", "tracked.txt"), "utf8"), "recover this\n");
      assert.equal(await readFile(path.join(recoveryContext.root, "tests", "new.txt"), "utf8"), "recovery new\n");
      await assert.rejects(readFile(path.join(recoveryContext.root, "tests", "to-delete.txt"), "utf8"), /ENOENT/u);
      assert((await readdir(path.join(recoveryContext.root, "tests", "empty-dir"))).length === 0);
      const sourceNow = await computeWorkspaceSnapshot(await h.workstreams.resolveExecutionContext({ workspace_id: h.workspace.workspace_id }));
      assert.equal(sourceNow.workspace_snapshot_id, sourceAfter.workspace_snapshot_id);
      assert.equal(await readFile(path.join(sourceRoot, "tests", "tracked.txt"), "utf8"), "source advanced after checkpoint\n");
      assert.equal(await readFile(path.join(h.repositoryRoot, "tests", "tracked.txt"), "utf8"), mainBefore);
      assert.equal((await service.get({ checkpoint_id: checkpoint.checkpoint_id })).state, "active");
    } finally { await h.cleanup(); }
  }

  // Phase 3A dangling recovery reconciliation can resume from a durable recovery workstream before its workspace exists.
  {
    const h = await recoveryHarness("dangling-workstream");
    try {
      const sourceRoot = h.sourceContext.root;
      await writeFile(path.join(sourceRoot, "tests", "tracked.txt"), "dangling tracked\n", "utf8");
      await writeFile(path.join(sourceRoot, "tests", "new.txt"), "dangling new\n", "utf8");
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace.workspace_id, label: "Dangling recovery source" });
      const recoveryOperationId = "dev_operation_22222222222222222222222222222222";
      const recoveryWorkstream = await h.workstreams.beginRecovery({
        checkpoint_id: checkpoint.checkpoint_id,
        source_workstream_id: h.source.workstream_id,
        base_head: checkpoint.git_head,
        label: "Dangling recovery",
        recovery_operation_id: recoveryOperationId,
      });
      const inspection = await service.inspectOperationEffect({
        operation_type: "checkpoint_recovery",
        operation_id: recoveryOperationId,
        result: { checkpoint_id: checkpoint.checkpoint_id },
      });
      assert.equal(inspection.outcome, "intended_effect_observed");
      assert.equal(inspection.reconciliation_required, false);
      const records = await h.workstreams.listRecoveryWorkspacesInternal();
      const record = records.find((item) => item.workstream_id === recoveryWorkstream.workstream_id);
      assert(record?.workspace_id);
      assert.equal(record.workspace_state, "active");
      const context = await h.workstreams.resolveExecutionContext({ workspace_id: record.workspace_id });
      assert.equal((await computeWorkspaceSnapshot(context)).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      assert.equal(await readFile(path.join(context.root, "tests", "new.txt"), "utf8"), "dangling new\n");
    } finally { await h.cleanup(); }
  }

  // Reload-style reconciliation resumes an existing partial materializing recovery workspace.
  {
    const h = await recoveryHarness("resume");
    try {
      const sourceRoot = h.sourceContext.root;
      await writeFile(path.join(sourceRoot, "tests", "tracked.txt"), "resume tracked\n", "utf8");
      await writeFile(path.join(sourceRoot, "tests", "new.txt"), "resume new\n", "utf8");
      const service = h.service();
      const checkpoint = await service.create({ workspace_id: h.workspace.workspace_id, label: "Resume source" });
      const recoveryWorkstream = await h.workstreams.beginRecovery({
        checkpoint_id: checkpoint.checkpoint_id,
        source_workstream_id: h.source.workstream_id,
        base_head: checkpoint.git_head,
        label: "Interrupted recovery",
        recovery_operation_id: "dev_operation_11111111111111111111111111111111",
      });
      const recoveryWorkspace = await h.workstreams.createIsolated({
        workstream_id: recoveryWorkstream.workstream_id,
        expected_workstream_revision: recoveryWorkstream.revision,
      }, { recovery: true });
      const partialContext = await h.workstreams.resolveExecutionContext({ workspace_id: recoveryWorkspace.workspace_id }, {
        mutation: true,
        lifecycleStates: ["materializing", "verifying"],
      });
      await writeFile(path.join(partialContext.root, "tests", "tracked.txt"), "resume tracked\n", "utf8");
      const beforeInit = await h.workstreams.getWorkspace({ workspace_id: recoveryWorkspace.workspace_id });
      assert.equal(beforeInit.state, "materializing");
      const initialized = await h.service().initialize();
      assert.equal(initialized.resumed_recoveries, 1);
      assert.equal(initialized.reconciliation_required, 0);
      const afterInit = await h.workstreams.getWorkspace({ workspace_id: recoveryWorkspace.workspace_id });
      assert.equal(afterInit.state, "active");
      const finalContext = await h.workstreams.resolveExecutionContext({ workspace_id: recoveryWorkspace.workspace_id });
      assert.equal((await computeWorkspaceSnapshot(finalContext)).workspace_snapshot_id, checkpoint.workspace_snapshot_id);
      assert.equal(await readFile(path.join(finalContext.root, "tests", "new.txt"), "utf8"), "resume new\n");
    } finally { await h.cleanup(); }
  }

  console.log("MCP development checkpoint runtime tests passed.");
}

if (process.argv[2] === "--checkpoint-worker") {
  await runConcurrentWorker();
} else {
  await runTests();
}
