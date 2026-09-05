import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  DEV_JOURNAL_STORAGE_ROOT,
  beginDevJournalOperation,
  canonicalJson,
  completeDevJournalOperation,
  computeWorkspaceSnapshot,
  createDevOperationJournalService,
  dev_workspace_get_operation,
  dev_workspace_get_provenance,
} from "../../server/src/mcp-development-journal-tools.mjs";
import {
  dev_apply_patch,
  dev_create_directory,
  dev_create_file,
  dev_delete_file,
  dev_git_commit,
  dev_move_path,
} from "../../server/src/mcp-development-write-tools.mjs";
import { dev_git_diff_check } from "../../server/src/mcp-development-readonly-tools.mjs";
import { createDevTestRunner } from "../../server/src/mcp-development-test-tools.mjs";

const __filename = fileURLToPath(import.meta.url);
const execFileAsync = promisify(execFile);
const gitExecutable = process.platform === "win32" ? "git.exe" : "git";
const workspaceId = "dev_workspace_shared_repository_v1";
const zeroHead = "0".repeat(40);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileState(value) {
  const bytes = Buffer.from(value, "utf8");
  return { exists: true, artifact_type: "file", sha256: sha256(bytes), bytes: bytes.length };
}

const absentState = { exists: false, artifact_type: null, sha256: null, bytes: null };

function eventHash(event) {
  const { event_hash: ignored, ...payload } = event;
  return sha256(Buffer.from(canonicalJson(payload), "utf8"));
}

async function tempFixture(label) {
  const root = await mkdtemp(path.join(os.tmpdir(), `writer-workbench-journal-${label}-`));
  const workspaceRoot = path.join(root, "workspace");
  const storageRoot = path.join(root, "journal");
  await mkdir(workspaceRoot);
  return { root, workspaceRoot, storageRoot };
}

async function clean(fixture) {
  await rm(fixture.root, { recursive: true, force: true });
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync(gitExecutable, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat" },
  });
  return String(stdout);
}

async function gitHarness(label, identity = 10) {
  const root = await mkdtemp(path.join(os.tmpdir(), `writer-workbench-journal-git-${label}-`));
  const repositoryRoot = path.join(root, "repo");
  await mkdir(repositoryRoot);
  await mkdir(path.join(repositoryRoot, "tests"));
  await git(repositoryRoot, ["init", "-b", "main"]);
  await git(repositoryRoot, ["config", "user.name", "Phase 3A Journal Test"]);
  await git(repositoryRoot, ["config", "user.email", "phase3a@test.invalid"]);
  await writeFile(path.join(repositoryRoot, "base.txt"), "base\n", "utf8");
  await git(repositoryRoot, ["add", "base.txt"]);
  await git(repositoryRoot, ["commit", "-m", "baseline"]);
  const baseHead = (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim();
  const hex = identity.toString(16).padStart(24, "0").slice(-24);
  const suffix = identity.toString(16).padStart(12, "0").slice(-12);
  const contextResolver = async () => ({
    workspace_id: `dev_workspace_${hex}`,
    workstream_id: `dev_workstream_20260903-010000_${suffix}`,
    workspace_type: "isolated_worktree",
    root: repositoryRoot,
    branch: `dev-ws/${hex}`,
    base_head: baseHead,
    current_head: (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim(),
    lifecycle_state: "active",
    workstream_state: "active",
    healthy: true,
    mutation_allowed: true,
  });
  return {
    root,
    repositoryRoot,
    baseHead,
    workspace_id: `dev_workspace_${hex}`,
    workstream_id: `dev_workstream_20260903-010000_${suffix}`,
    contextResolver,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  };
}

async function eventFiles(storageRoot) {
  return (await readdir(path.join(storageRoot, "events"))).filter((name) => name.endsWith(".json")).sort();
}

async function readEvent(storageRoot, index) {
  const files = await eventFiles(storageRoot);
  return { file: files[index], event: JSON.parse(await readFile(path.join(storageRoot, "events", files[index]), "utf8")) };
}

async function writeJournalLock(storageRoot, pid = process.pid) {
  await writeFile(
    path.join(storageRoot, "append.lock"),
    `${JSON.stringify({ pid, hostname: os.hostname(), acquired_at: new Date().toISOString() })}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorker(storageRoot, mode, extra = {}) {
  const child = spawn(process.execPath, [__filename, "--worker", mode], {
    env: {
      ...process.env,
      JOURNAL_WORKER_ROOT: storageRoot,
      JOURNAL_WORKER_PATH: extra.path ?? "fixture.txt",
      JOURNAL_WORKER_BEFORE: extra.before ?? "AAA",
      JOURNAL_WORKER_EXPECTED: extra.expected ?? "BBB",
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
  if (code !== 0) throw new Error(`journal worker failed (${mode}): ${stderr || stdout}`);
  return stdout.trim();
}

if (process.argv[2] === "--worker") {
  const mode = process.argv[3];
  const storageRoot = process.env.JOURNAL_WORKER_ROOT;
  const service = createDevOperationJournalService({ storageRoot });
  const before = process.env.JOURNAL_WORKER_BEFORE ?? "AAA";
  const expected = process.env.JOURNAL_WORKER_EXPECTED ?? "BBB";
  const targetPath = process.env.JOURNAL_WORKER_PATH ?? "fixture.txt";
  const started = await service.begin({
    operation_type: "filesystem_patch",
    tool_name: "dev_apply_patch",
    workspace_id: workspaceId,
    targets: [{
      path: targetPath,
      role: "modified_file",
      before: fileState(before),
      expected: fileState(expected),
    }],
  });
  if (mode === "complete") {
    await service.complete(started.operation_id, {
      targets: [{
        path: targetPath,
        role: "modified_file",
        before: fileState(before),
        expected: fileState(expected),
        after: fileState(expected),
      }],
      result: { changed: true },
    });
  }
  process.stdout.write(started.operation_id);
  process.exit(0);
}

async function completedFixture(label = "valid") {
  const fixture = await tempFixture(label);
  const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
  const started = await service.begin({
    operation_type: "fixture",
    tool_name: "dev_fixture",
    workspace_id: workspaceId,
  });
  await service.complete(started.operation_id, { result: { passed: true } });
  return { fixture, service, started };
}

// Valid canonical append/hash-chain/head semantics.
{
  const { fixture, service, started } = await completedFixture();
  try {
    const verified = await service.verify();
    assert.equal(verified.events.length, 2);
    assert.equal(verified.events[0].sequence, 1);
    assert.equal(verified.events[1].sequence, 2);
    assert.equal(verified.events[1].previous_event_hash, verified.events[0].event_hash);
    assert.equal(verified.head.latest_event_hash, verified.events[1].event_hash);
    const operation = await service.getOperation({ operation_id: started.operation_id });
    assert.equal(operation.terminal, true);
    assert.equal(operation.events.length, 2);
  } finally { await clean(fixture); }
}

async function expectCorrupt(label, mutate) {
  const { fixture, service } = await completedFixture(label);
  try {
    await mutate(fixture.storageRoot);
    const status = await service.status();
    assert.equal(status.health, "corrupt", label);
    assert.equal(status.chain_verified, false, label);
    assert.equal(status.reconciliation_required, true, label);
    await assert.rejects(
      service.begin({ operation_type: "must_fail_closed", tool_name: "dev_fixture", workspace_id: workspaceId }),
      undefined,
      `${label} corruption must fail closed for new mutation`,
    );
  } finally { await clean(fixture); }
}

await expectCorrupt("modified-event", async (storageRoot) => {
  const { file, event } = await readEvent(storageRoot, 0);
  event.tool_name = "tampered";
  await writeFile(path.join(storageRoot, "events", file), `${JSON.stringify(event)}\n`, "utf8");
});

await expectCorrupt("missing-event", async (storageRoot) => {
  const files = await eventFiles(storageRoot);
  await rm(path.join(storageRoot, "events", files[0]));
});

await expectCorrupt("wrong-previous-hash", async (storageRoot) => {
  const { file, event } = await readEvent(storageRoot, 1);
  event.previous_event_hash = "f".repeat(64);
  event.event_hash = eventHash(event);
  await writeFile(path.join(storageRoot, "events", file), `${canonicalJson(event)}\n`, "utf8");
});

await expectCorrupt("sequence-gap", async (storageRoot) => {
  const { file, event } = await readEvent(storageRoot, 1);
  event.sequence = 3;
  event.event_hash = eventHash(event);
  await writeFile(path.join(storageRoot, "events", file), `${canonicalJson(event)}\n`, "utf8");
});

await expectCorrupt("duplicate-sequence", async (storageRoot) => {
  const { event } = await readEvent(storageRoot, 1);
  event.sequence = 1;
  event.journal_event_id = `dev_journal_event_${randomUUID().replaceAll("-", "")}`;
  event.event_hash = eventHash(event);
  const file = `000000000001-${event.journal_event_id}.json`;
  await writeFile(path.join(storageRoot, "events", file), `${canonicalJson(event)}\n`, "utf8");
});

await expectCorrupt("malformed-event", async (storageRoot) => {
  const files = await eventFiles(storageRoot);
  await writeFile(path.join(storageRoot, "events", files[0]), "{}\n", "utf8");
});

await expectCorrupt("head-mismatch", async (storageRoot) => {
  const headPath = path.join(storageRoot, "head.json");
  const head = JSON.parse(await readFile(headPath, "utf8"));
  head.latest_sequence += 1;
  await writeFile(headPath, `${canonicalJson(head)}\n`, "utf8");
});

await expectCorrupt("orphan-tail", async (storageRoot) => {
  const second = (await readEvent(storageRoot, 1)).event;
  const tail = {
    ...second,
    sequence: 3,
    journal_event_id: `dev_journal_event_${randomUUID().replaceAll("-", "")}`,
    operation_id: `dev_operation_${randomUUID().replaceAll("-", "")}`,
    stage: "operation_started",
    previous_event_hash: second.event_hash,
    event_hash: null,
  };
  tail.event_hash = eventHash(tail);
  await writeFile(
    path.join(storageRoot, "events", `000000000003-${tail.journal_event_id}.json`),
    `${canonicalJson(tail)}\n`,
    "utf8",
  );
});

await expectCorrupt("unexpected-event-entry", async (storageRoot) => {
  await writeFile(path.join(storageRoot, "events", "unexpected.txt"), "unexpected\n", "utf8");
});

// Crash recovery A: STARTED owner exits and no effect is visible.
{
  const fixture = await tempFixture("recover-before");
  try {
    const targetPath = path.join(fixture.workspaceRoot, "fixture.txt");
    await writeFile(targetPath, "AAA", "utf8");
    const operationId = await runWorker(fixture.storageRoot, "start-only");
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    const recovered = await service.reconcileDangling({
      contextResolver: async () => ({ root: fixture.workspaceRoot, current_head: zeroHead }),
    });
    assert.equal(recovered.dangling_operations.length, 0);
    const operation = await service.getOperation({ operation_id: operationId });
    assert.equal(operation.outcome, "operation_recovered");
    assert.equal(operation.events[1].result.outcome, "no_effect_observed");
    assert.equal(operation.events[1].reconciles_event_id, operation.events[0].journal_event_id);
    assert.equal((await service.status()).health, "healthy");
  } finally { await clean(fixture); }
}

// Crash recovery B: intended effect is already durable.
{
  const fixture = await tempFixture("recover-after");
  try {
    const targetPath = path.join(fixture.workspaceRoot, "fixture.txt");
    await writeFile(targetPath, "AAA", "utf8");
    const operationId = await runWorker(fixture.storageRoot, "start-only");
    await writeFile(targetPath, "BBB", "utf8");
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    await service.reconcileDangling({
      contextResolver: async () => ({ root: fixture.workspaceRoot, current_head: zeroHead }),
    });
    const operation = await service.getOperation({ operation_id: operationId });
    assert.equal(operation.events[1].result.outcome, "intended_effect_observed");
    assert.equal((await service.status()).health, "healthy");
  } finally { await clean(fixture); }
}

// Crash recovery C: ambiguous observed state is append-only recorded and mutation stays blocked.
{
  const fixture = await tempFixture("recover-ambiguous");
  try {
    const targetPath = path.join(fixture.workspaceRoot, "fixture.txt");
    await writeFile(targetPath, "AAA", "utf8");
    const operationId = await runWorker(fixture.storageRoot, "start-only");
    await writeFile(targetPath, "CCC", "utf8");
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    await service.reconcileDangling({
      contextResolver: async () => ({ root: fixture.workspaceRoot, current_head: zeroHead }),
    });
    const operation = await service.getOperation({ operation_id: operationId });
    assert.equal(operation.events[1].result.outcome, "ambiguous_effect");
    const status = await service.status();
    assert.equal(status.health, "degraded");
    assert.equal(status.reconciliation_required, true);
  } finally { await clean(fixture); }
}

// Cross-process concurrent append: one monotonic chain, no lost events, active STARTED is not mistaken for crash.
{
  const fixture = await tempFixture("concurrent");
  try {
    const workers = 6;
    await Promise.all(Array.from({ length: workers }, () => runWorker(fixture.storageRoot, "complete")));
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    const verified = await service.verify();
    assert.equal(verified.events.length, workers * 2);
    assert.equal(verified.head.latest_sequence, workers * 2);
    assert.equal(new Set(verified.events.map((event) => event.sequence)).size, workers * 2);
    assert.equal(new Set(verified.events.map((event) => event.journal_event_id)).size, workers * 2);
    for (let index = 0; index < verified.events.length; index += 1) {
      assert.equal(verified.events[index].sequence, index + 1);
      assert.equal(verified.events[index].previous_event_hash, index === 0 ? null : verified.events[index - 1].event_hash);
    }
    assert.equal((await service.status()).health, "healthy");
  } finally { await clean(fixture); }
}

// begin() performs one admission verification when no dangling operation exists; it must not
// immediately repeat the same full read-only scan through status().
{
  const { fixture } = await completedFixture("begin-single-verification");
  try {
    let eventReadCount = 0;
    const service = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      eventReader: async (...args) => {
        eventReadCount += 1;
        return readFile(...args);
      },
    });
    const started = await service.begin({
      operation_type: "single_admission_verify",
      tool_name: "dev_fixture",
      workspace_id: workspaceId,
    });
    assert.equal(eventReadCount, 2, "begin admission should scan the existing two-event journal exactly once");
    await service.complete(started.operation_id, { result: { single_verify: true } });
  } finally { await clean(fixture); }
}

// Snapshot verification must not retain append.lock while hashing the captured immutable prefix.
// A legal concurrent append may advance the live head; the verifier catches up to the new suffix
// without classifying that forward progress as corruption.
{
  const { fixture } = await completedFixture("snapshot-catchup");
  let signalFirstRead;
  let releaseFirstRead;
  const firstReadStarted = new Promise((resolve) => { signalFirstRead = resolve; });
  const firstReadGate = new Promise((resolve) => { releaseFirstRead = resolve; });
  let blocked = false;
  try {
    const slowVerifier = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      eventReader: async (...args) => {
        if (!blocked) {
          blocked = true;
          signalFirstRead();
          await firstReadGate;
        }
        return readFile(...args);
      },
    });
    const verificationPromise = slowVerifier.verify();
    await firstReadStarted;

    const concurrentService = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      lockAcquireTimeoutMs: 500,
    });
    let concurrentStarted;
    try {
      concurrentStarted = await concurrentService.begin({
        operation_type: "concurrent_during_verify",
        tool_name: "dev_fixture",
        workspace_id: workspaceId,
      });
      await concurrentService.complete(concurrentStarted.operation_id, { result: { concurrent: true } });
    } finally {
      releaseFirstRead();
    }

    const verified = await verificationPromise;
    assert.equal(verified.events.length, 4);
    assert.equal(verified.head.latest_sequence, 4);
    assert(verified.events.some((event) => event.operation_id === concurrentStarted.operation_id && event.stage === "operation_completed"));
    assert.equal(verified.head.latest_event_hash, verified.events.at(-1).event_hash);
    assert.equal((await slowVerifier.status()).health, "healthy");
  } finally { await clean(fixture); }
}

// A live same-host owner retains append.lock. A contender waits with bounded backoff and succeeds
// after the owner releases the lock, while total ordering and head/hash-chain identity stay intact.
{
  const { fixture } = await completedFixture("live-lock-wait");
  const lockPath = path.join(fixture.storageRoot, "append.lock");
  try {
    await writeJournalLock(fixture.storageRoot);
    const contender = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      lockAcquireTimeoutMs: 1_000,
    });
    let settled = false;
    const waiting = contender.begin({
      operation_type: "wait_for_live_lock",
      tool_name: "dev_fixture",
      workspace_id: workspaceId,
    }).then(
      (value) => { settled = true; return value; },
      (error) => { settled = true; throw error; },
    );
    await delay(80);
    assert.equal(settled, false, "contender must wait while the live-PID lock remains owned");
    await rm(lockPath);
    const started = await waiting;
    await contender.complete(started.operation_id, { result: { waited: true } });
    const verified = await contender.verify();
    assert.equal(verified.head.latest_sequence, 4);
    assert.equal(verified.head.latest_event_hash, verified.events.at(-1).event_hash);
    for (let index = 0; index < verified.events.length; index += 1) {
      assert.equal(verified.events[index].sequence, index + 1);
      assert.equal(verified.events[index].previous_event_hash, index === 0 ? null : verified.events[index - 1].event_hash);
    }
  } finally {
    await rm(lockPath, { force: true });
    await clean(fixture);
  }
}

// A live lock held beyond the configured acquisition deadline is explicit transient contention,
// never fake success and never a sticky corruption classification. Once released, health recovers.
{
  const { fixture } = await completedFixture("lock-timeout");
  const lockPath = path.join(fixture.storageRoot, "append.lock");
  try {
    await writeJournalLock(fixture.storageRoot);
    const shortDeadline = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      lockAcquireTimeoutMs: 120,
    });
    await assert.rejects(
      shortDeadline.verify(),
      (error) => {
        assert.equal(error.code, "JOURNAL_LOCK_CONTENDED");
        return true;
      },
    );
    const transient = await shortDeadline.status();
    assert.equal(transient.health, "recovering");
    assert.equal(transient.chain_verified, false);
    assert.equal(transient.reconciliation_required, false);
    assert.match(transient.last_health_error, /JOURNAL_LOCK_CONTENDED/u);

    await rm(lockPath);
    const recovered = await shortDeadline.status();
    assert.equal(recovered.health, "healthy");
    assert.equal(recovered.chain_verified, true);
    assert.equal(recovered.reconciliation_required, false);
  } finally {
    await rm(lockPath, { force: true });
    await clean(fixture);
  }
}

// A dead same-host PID lock is still formally stale and recoverable; stale recovery must not weaken
// append ordering or the verified chain.
{
  const { fixture } = await completedFixture("stale-lock");
  const lockPath = path.join(fixture.storageRoot, "append.lock");
  try {
    await writeJournalLock(fixture.storageRoot, 2_147_483_647);
    const service = createDevOperationJournalService({
      storageRoot: fixture.storageRoot,
      lockAcquireTimeoutMs: 1_000,
    });
    const started = await service.begin({
      operation_type: "stale_lock_recovery",
      tool_name: "dev_fixture",
      workspace_id: workspaceId,
    });
    await service.complete(started.operation_id, { result: { stale_recovered: true } });
    const status = await service.status();
    assert.equal(status.health, "healthy");
    assert.equal(status.chain_verified, true);
    assert.equal(status.latest_sequence, 4);
  } finally {
    await rm(lockPath, { force: true });
    await clean(fixture);
  }
}

// Explicit in-process degradation (for example terminal append failure) must stay sticky
// across verification and block new mutation until process restart/reconciliation ownership changes.
{
  const fixture = await tempFixture("sticky-degraded");
  try {
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    await service.markDegraded("terminal append failed after durable effect");
    const status = await service.status();
    assert.equal(status.health, "degraded");
    assert.equal(status.reconciliation_required, true);
    assert.match(status.last_health_error, /terminal append failed/u);
    await assert.rejects(
      service.begin({ operation_type: "fixture", tool_name: "dev_fixture", workspace_id: workspaceId }),
      /JOURNAL_DEGRADED/u,
    );
  } finally { await clean(fixture); }
}

// Operation pagination is keyed by STARTED publication order, never by a later terminal event.
{
  const fixture = await tempFixture("pagination");
  try {
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    const operationIds = [];
    for (let index = 0; index < 3; index += 1) {
      const started = await service.begin({ operation_type: "fixture", tool_name: "dev_fixture", workspace_id: workspaceId });
      operationIds.push(started.operation_id);
      await service.complete(started.operation_id, { result: { index } });
    }
    const first = await service.listOperations({ limit: 1 });
    assert.equal(first.operations[0].operation_id, operationIds[0]);
    assert.equal(first.truncated, true);
    const second = await service.listOperations({ limit: 2, after_sequence: first.next_after_sequence });
    assert.deepEqual(second.operations.map((item) => item.operation_id), operationIds.slice(1));
  } finally { await clean(fixture); }
}

// Typed causal traversal links source commit -> validation evidence -> integration apply.
{
  const fixture = await tempFixture("causal-graph");
  try {
    const service = createDevOperationJournalService({ storageRoot: fixture.storageRoot });
    const sourceCommit = "a".repeat(40);
    const integrationCommit = "b".repeat(40);
    const candidateId = "dev_integration_20260903-010000_000000000001";
    const commit = await service.begin({
      operation_type: "git_commit",
      tool_name: "dev_git_commit",
      workspace_id: workspaceId,
      result: { before_head: "0".repeat(40) },
    });
    await service.complete(commit.operation_id, { result: { commit: sourceCommit, after_head: sourceCommit } });
    const testEvidence = await service.begin({
      operation_type: "test_evidence",
      tool_name: "dev_run_tests",
      workspace_id: workspaceId,
      result: { suite: "mcp", workspace_snapshot_id: "c".repeat(64), head: sourceCommit },
    });
    await service.complete(testEvidence.operation_id, {
      result: { suite: "mcp", workspace_snapshot_id: "c".repeat(64), head: sourceCommit, passed: true, execution_ok: true, timed_out: false },
    });
    const validation = await service.begin({
      operation_type: "integration_validation",
      tool_name: "dev_workspace_validate_integration",
      workspace_id: workspaceId,
      links: [
        { relation: "used", commit: sourceCommit },
        { relation: "related_to", integration_candidate_id: candidateId },
      ],
      result: { integration_candidate_id: candidateId, integration_commit: integrationCommit },
    });
    await service.complete(validation.operation_id, {
      links: [
        { relation: "used", commit: sourceCommit },
        { relation: "used", commit: integrationCommit },
        { relation: "validated_by", operation_id: testEvidence.operation_id },
        { relation: "related_to", integration_candidate_id: candidateId },
      ],
      result: { integration_candidate_id: candidateId, integration_commit: integrationCommit, passed: true },
    });
    const integration = await service.begin({
      operation_type: "integration_apply",
      tool_name: "dev_workspace_integrate",
      workspace_id: workspaceId,
      links: [
        { relation: "used", commit: sourceCommit },
        { relation: "related_to", integration_candidate_id: candidateId },
      ],
      result: { integration_candidate_id: candidateId, integration_commit: integrationCommit },
    });
    await service.complete(integration.operation_id, {
      links: [
        { relation: "used", commit: sourceCommit },
        { relation: "integrated_by", commit: integrationCommit },
        { relation: "related_to", integration_candidate_id: candidateId },
      ],
      result: { integration_candidate_id: candidateId, integration_commit: integrationCommit, integrated: true },
    });
    const provenance = await service.getProvenance({ integration_candidate_id: candidateId, limit: 100 });
    assert.equal(provenance.matched_operation_count, 2);
    assert.equal(provenance.causal_operation_count, 4);
    assert.deepEqual(
      new Set(provenance.events.filter((event) => event.stage === "operation_started").map((event) => event.operation_type)),
      new Set(["git_commit", "test_evidence", "integration_validation", "integration_apply"]),
    );
    assert(provenance.events.some((event) => event.links.some((link) => link.relation === "validated_by" && link.operation_id === testEvidence.operation_id)));
    assert(provenance.events.some((event) => event.links.some((link) => link.relation === "integrated_by" && link.commit === integrationCommit)));
  } finally { await clean(fixture); }
}

// The following acceptance fixtures use the real Phase 3A wrappers and therefore must
// never run against the production journal.
assert.equal(
  process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL,
  "1",
  "Phase 3A wrapper provenance tests require WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL=1.",
);

// Filesystem mutations record bounded before/expected/after artifact states without content.
{
  const harness = await gitHarness("filesystem", 20);
  try {
    const options = { workspaceContextResolver: harness.contextResolver };
    const fixtureA = "phase3a-journal-fixture-body-A\n";
    const fixtureB = "phase3a-journal-fixture-body-B\n";
    const created = await dev_create_file({
      path: "tests/provenance.txt",
      content: fixtureA,
      workspace_id: harness.workspace_id,
    }, options);
    const patched = await dev_apply_patch({
      path: "tests/provenance.txt",
      oldText: fixtureA,
      newText: fixtureB,
      expectedSha256: created.sha256,
      workspace_id: harness.workspace_id,
    }, options);
    const moved = await dev_move_path({
      sourcePath: "tests/provenance.txt",
      destinationPath: "tests/provenance-moved.txt",
      expectedSha256: patched.after_sha256,
      workspace_id: harness.workspace_id,
    }, options);
    const deleted = await dev_delete_file({
      path: "tests/provenance-moved.txt",
      expectedSha256: moved.sha256,
      workspace_id: harness.workspace_id,
    }, options);
    const directory = await dev_create_directory({
      path: "tests/provenance-directory",
      workspace_id: harness.workspace_id,
    }, options);

    const [createOp, patchOp, moveOp, deleteOp, directoryOp] = await Promise.all([
      created.operation_id,
      patched.operation_id,
      moved.operation_id,
      deleted.operation_id,
      directory.operation_id,
    ].map((operation_id) => dev_workspace_get_operation({ operation_id })));
    for (const operation of [createOp, patchOp, moveOp, deleteOp, directoryOp]) {
      assert.equal(operation.terminal, true);
      assert.equal(operation.events[0].stage, "operation_started");
      assert.equal(operation.events[1].stage, "operation_completed");
      assert.equal(operation.workspace_id, harness.workspace_id);
      assert.equal(operation.workstream_id, harness.workstream_id);
      const encoded = JSON.stringify(operation.events);
      assert.equal(encoded.includes(fixtureA.trim()), false);
      assert.equal(encoded.includes(fixtureB.trim()), false);
    }
    assert.equal(createOp.events[0].targets[0].before.exists, false);
    assert.equal(createOp.events[0].targets[0].expected.sha256, created.sha256);
    assert.equal(createOp.events[1].targets[0].after.sha256, created.sha256);
    assert.equal(patchOp.events[0].targets[0].before.sha256, created.sha256);
    assert.equal(patchOp.events[0].targets[0].expected.sha256, patched.after_sha256);
    assert.equal(patchOp.events[1].targets[0].after.sha256, patched.after_sha256);
    assert.equal(moveOp.events[1].targets[0].after.exists, false);
    assert.equal(moveOp.events[1].targets[1].after.sha256, moved.sha256);
    assert.equal(deleteOp.events[1].targets[0].after.exists, false);
    assert.equal(directoryOp.events[1].targets[0].after.artifact_type, "directory");
    assert.equal(directoryOp.events[1].targets[0].after.sha256, null);
    const pathProvenance = await dev_workspace_get_provenance({
      workspace_id: harness.workspace_id,
      path: "tests/provenance.txt",
      limit: 100,
    });
    assert(pathProvenance.events.some((event) => event.operation_id === created.operation_id));
    assert(pathProvenance.events.some((event) => event.operation_id === patched.operation_id));
    assert(pathProvenance.events.some((event) => event.operation_id === moved.operation_id));
    await assert.rejects(
      dev_workspace_get_provenance({ path: "tests/provenance.txt", limit: 10 }),
      /workspace_id is required/u,
    );
  } finally { await harness.cleanup(); }
}

// Test and diff-check evidence are bound to the exact dirty-workspace snapshot, not HEAD alone.
{
  const harness = await gitHarness("snapshot", 21);
  try {
    const options = { workspaceContextResolver: harness.contextResolver };
    const contextA = await harness.contextResolver();
    const snapshotA = await computeWorkspaceSnapshot(contextA);
    assert.equal(
      snapshotA.workspace_snapshot_id,
      sha256(Buffer.from(canonicalJson({ head: snapshotA.head, manifest: snapshotA.manifest }), "utf8")),
    );
    assert(Number.isFinite(snapshotA.diagnostics.total_ms));
    assert(Number.isFinite(snapshotA.diagnostics.git_status_ms));
    assert(Number.isFinite(snapshotA.diagnostics.artifact_capture_ms));
    assert.equal(snapshotA.diagnostics.root_resolve_ms, 0);
    assert.equal(snapshotA.diagnostics.hashed_artifact_count, 0);
    assert.equal(snapshotA.diagnostics.hashed_bytes, 0);
    const diffA = await dev_git_diff_check({ mode: "working", workspace_id: harness.workspace_id }, options);
    const runner = createDevTestRunner({
      suiteDefinitions: {
        mcp: { executable: process.execPath, argv: ["-e", "process.exit(0)"], timeoutMs: 10_000 },
      },
      lockPath: path.join(harness.root, "snapshot-test.lock"),
      workspaceContextResolver: harness.contextResolver,
      dependencyRoot: process.env.WRITER_WORKBENCH_DEPENDENCY_ROOT?.trim() || process.cwd(),
    });
    const testA = await runner({ suite: "mcp", workspace_id: harness.workspace_id });
    assert.equal(testA.passed, true);
    assert(Number.isFinite(testA.total_wall_clock_ms));
    assert(testA.total_wall_clock_ms >= testA.duration_ms);
    assert.equal(testA.snapshot_diagnostics.hashed_artifact_count, 0);
    assert.equal(diffA.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(testA.workspace_snapshot_id, snapshotA.workspace_snapshot_id);

    await writeFile(path.join(harness.repositoryRoot, "base.txt"), "base changed without HEAD movement\n", "utf8");
    const contextB = await harness.contextResolver();
    const snapshotB = await computeWorkspaceSnapshot(contextB);
    assert.equal(snapshotB.head, snapshotA.head);
    assert.notEqual(snapshotB.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(
      snapshotB.workspace_snapshot_id,
      sha256(Buffer.from(canonicalJson({ head: snapshotB.head, manifest: snapshotB.manifest }), "utf8")),
    );
    assert.equal(snapshotB.diagnostics.hashed_artifact_count, 1);
    assert.equal(snapshotB.diagnostics.hashed_bytes, Buffer.byteLength("base changed without HEAD movement\n", "utf8"));
    assert(snapshotB.diagnostics.status_bytes > 0);
    const diffB = await dev_git_diff_check({ mode: "working", workspace_id: harness.workspace_id }, options);
    const testB = await runner({ suite: "mcp", workspace_id: harness.workspace_id });
    assert.equal(testB.passed, true);
    assert.equal(testB.snapshot_diagnostics.hashed_artifact_count, 1);
    assert.equal(testB.snapshot_diagnostics.hashed_bytes, snapshotB.diagnostics.hashed_bytes);
    assert(Number.isFinite(testB.total_wall_clock_ms));
    assert.equal(diffB.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
    assert.equal(testB.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
    assert.notEqual(testB.workspace_snapshot_id, testA.workspace_snapshot_id);

    const [testAOperation, testBOperation, diffAOperation, diffBOperation] = await Promise.all([
      testA.operation_id,
      testB.operation_id,
      diffA.operation_id,
      diffB.operation_id,
    ].map((operation_id) => dev_workspace_get_operation({ operation_id })));
    assert.equal(testAOperation.events[1].result.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(testAOperation.events[0].result.snapshot_hashed_artifact_count, 0);
    assert(Number.isFinite(testAOperation.events[0].result.snapshot_total_ms));
    assert.equal(testAOperation.events[0].result.snapshot_consistency_attempt_count, 1);
    assert.equal(testAOperation.events[0].result.snapshot_consistency_retry_count, 0);
    assert(Number.isFinite(testAOperation.events[0].result.snapshot_consistency_recheck_ms));
    assert.equal(
      testAOperation.events[0].result.snapshot_mutation_generation_start,
      testAOperation.events[0].result.snapshot_mutation_generation_end,
    );
    assert(Number.isFinite(testAOperation.events[1].result.total_wall_clock_ms));
    assert.equal(diffAOperation.events[1].result.workspace_snapshot_id, snapshotA.workspace_snapshot_id);
    assert.equal(testBOperation.events[1].result.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
    assert.equal(testBOperation.events[0].result.snapshot_hashed_artifact_count, 1);
    assert.equal(testBOperation.events[0].result.snapshot_hashed_bytes, snapshotB.diagnostics.hashed_bytes);
    assert(Number.isFinite(testBOperation.events[1].result.snapshot_artifact_capture_ms));
    assert.equal(diffBOperation.events[1].result.workspace_snapshot_id, snapshotB.workspace_snapshot_id);
  } finally { await harness.cleanup(); }
}

// Snapshot generation guard retries when content changes but porcelain status remains unchanged.
{
  const harness = await gitHarness("snapshot-generation", 23);
  try {
    const firstContent = "base dirty generation one\n";
    const secondContent = "base dirty generation two\n";
    await writeFile(path.join(harness.repositoryRoot, "base.txt"), firstContent, "utf8");
    const context = await harness.contextResolver();
    let hookCount = 0;
    const snapshot = await computeWorkspaceSnapshot(context, {
      afterArtifactCapture: async ({ attempt }) => {
        if (attempt !== 1) return;
        hookCount += 1;
        const operation = await beginDevJournalOperation({
          operation_type: "filesystem_patch",
          tool_name: "dev_snapshot_generation_fixture",
          workstream_id: harness.workstream_id,
          workspace_id: harness.workspace_id,
          targets: [{
            path: "base.txt",
            role: "modified_file",
            before: fileState(firstContent),
            expected: fileState(secondContent),
          }],
        });
        await writeFile(path.join(harness.repositoryRoot, "base.txt"), secondContent, "utf8");
        await completeDevJournalOperation(operation.operation_id, {
          targets: [{
            path: "base.txt",
            role: "modified_file",
            before: fileState(firstContent),
            expected: fileState(secondContent),
            after: fileState(secondContent),
          }],
          result: { changed: true },
        });
      },
    });
    assert.equal(hookCount, 1);
    assert.equal(snapshot.diagnostics.consistency_attempt_count, 2);
    assert.equal(snapshot.diagnostics.consistency_retry_count, 1);
    assert(Number.isFinite(snapshot.diagnostics.consistency_recheck_ms));
    assert.equal(snapshot.diagnostics.mutation_generation_start, snapshot.diagnostics.mutation_generation_end);
    const baseEntry = snapshot.manifest.find((entry) => entry.path === "base.txt");
    assert.equal(baseEntry?.sha256, fileState(secondContent).sha256);
    assert.equal(baseEntry?.bytes, Buffer.byteLength(secondContent, "utf8"));
    assert.equal(
      snapshot.workspace_snapshot_id,
      sha256(Buffer.from(canonicalJson({ head: snapshot.head, manifest: snapshot.manifest }), "utf8")),
    );
  } finally { await harness.cleanup(); }
}

// Commit provenance links only digest-matching journal producers and reports partial gaps honestly.
{
  const harness = await gitHarness("commit-linking", 22);
  try {
    const options = { workspaceContextResolver: harness.contextResolver };
    const linked = await dev_create_file({
      path: "tests/linked.txt",
      content: "journal-linked-file\n",
      workspace_id: harness.workspace_id,
    }, options);
    const firstHead = (await harness.contextResolver()).current_head;
    const committed = await dev_git_commit({
      paths: ["tests/linked.txt"],
      message: "test: linked provenance",
      expectedHead: firstHead,
      workspace_id: harness.workspace_id,
    }, options);
    assert.equal(committed.committed, true);
    assert.equal(committed.provenance_coverage, "complete");
    assert.deepEqual(committed.linked_paths, ["tests/linked.txt"]);
    assert.deepEqual(committed.unlinked_paths, []);
    const commitOperation = await dev_workspace_get_operation({ operation_id: committed.operation_id });
    assert(commitOperation.events[1].links.some((link) => link.relation === "produced_by" && link.operation_id === linked.operation_id));
    const commitProvenance = await dev_workspace_get_provenance({ commit: committed.commit, limit: 100 });
    assert(commitProvenance.operation_ids.includes(linked.operation_id));
    assert(commitProvenance.operation_ids.includes(committed.operation_id));

    const linkedTwo = await dev_create_file({
      path: "tests/linked-two.txt",
      content: "journal-linked-second-file\n",
      workspace_id: harness.workspace_id,
    }, options);
    await writeFile(path.join(harness.repositoryRoot, "tests", "external.txt"), "external pre-journal mutation\n", "utf8");
    const secondHead = (await harness.contextResolver()).current_head;
    const partial = await dev_git_commit({
      paths: ["tests/linked-two.txt", "tests/external.txt"],
      message: "test: partial provenance",
      expectedHead: secondHead,
      workspace_id: harness.workspace_id,
    }, options);
    assert.equal(partial.committed, true);
    assert.equal(partial.provenance_coverage, "partial");
    assert(partial.linked_paths.includes("tests/linked-two.txt"));
    assert(partial.unlinked_paths.includes("tests/external.txt"));
    const partialOperation = await dev_workspace_get_operation({ operation_id: partial.operation_id });
    assert(partialOperation.events[1].links.some((link) => link.operation_id === linkedTwo.operation_id));
    assert.equal(partialOperation.events[1].links.some((link) => link.operation_id === linked.operation_id), false);
  } finally { await harness.cleanup(); }
}

if (process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL === "1") {
  await rm(path.dirname(DEV_JOURNAL_STORAGE_ROOT), { recursive: true, force: true });
}

console.log("MCP development operation journal tests passed.");
