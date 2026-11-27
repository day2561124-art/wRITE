import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, rmdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import test from "node:test";
import "./mcp-integration-verification-router.test.mjs";
import "./mcp-verification-manifest.test.mjs";
import "./mcp-independent-verification-evidence.test.mjs";
import {
  DEV_INTEGRATION_SCHEMA_VERSION,
  createDevIntegrationService,
} from "../../server/src/mcp-development-integration-tools.mjs";
import {
  beginDevJournalOperation,
  completeDevJournalOperation,
  computeWorkspaceSnapshot,
  createDevOperationJournalService,
  dev_workspace_get_provenance,
} from "../../server/src/mcp-development-journal-tools.mjs";

const execFileAsync = promisify(execFile);
const gitExecutable = process.platform === "win32" ? "git.exe" : "git";
let identityCounter = 0;

async function git(cwd, args, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(gitExecutable, args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat" },
    });
    return { stdout, stderr, exit_code: 0 };
  } catch (error) {
    if (allowFailure && Number.isInteger(error?.code)) {
      return { stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? ""), exit_code: error.code };
    }
    throw error;
  }
}

function nextIdentity() {
  identityCounter += 1;
  const hex = identityCounter.toString(16).padStart(24, "0").slice(-24);
  const suffix = identityCounter.toString(16).padStart(12, "0").slice(-12);
  return {
    workstream_id: `dev_workstream_20260902-120000_${suffix}`,
    workspace_id: `dev_workspace_${hex}`,
    branch_name: `dev-ws/${hex}`,
  };
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function createHarness(name) {
  const root = await mkdtemp(path.join(os.tmpdir(), `phase2d-${name}-${process.pid}-`));
  const repositoryRoot = path.join(root, "repo");
  const worktreeRoot = path.join(root, ".writer-workbench-worktrees");
  const integrationRoot = path.join(root, ".writer-workbench-integrations");
  const runtimeRoot = path.join(root, "runtime");
  await mkdir(repositoryRoot);
  await mkdir(worktreeRoot);
  await git(repositoryRoot, ["init", "-b", "main"]);
  await git(repositoryRoot, ["config", "user.name", "Phase 2D Test"]);
  await git(repositoryRoot, ["config", "user.email", "phase2d@test.invalid"]);
  await writeFile(path.join(repositoryRoot, "base.txt"), "base\n", "utf8");
  await writeFile(path.join(repositoryRoot, "conflict.txt"), "base conflict\n", "utf8");
  await git(repositoryRoot, ["add", "base.txt", "conflict.txt"]);
  await git(repositoryRoot, ["commit", "-m", "baseline"]);
  const baseHead = (await git(repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim();
  const workstreams = new Map();
  const workspaces = new Map();

  async function createSource({
    changes,
    dependsOn = [],
    base = baseHead,
    message = "source commit",
    parentWorkstreamId = null,
    metadata = {},
  }) {
    const identity = nextIdentity();
    const worktreePath = path.join(worktreeRoot, identity.workspace_id);
    await git(repositoryRoot, ["worktree", "add", "-b", identity.branch_name, worktreePath, base]);
    for (const [relativePath, content] of Object.entries(changes)) {
      const filePath = path.join(worktreePath, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }
    await git(worktreePath, ["add", "--", ...Object.keys(changes)]);
    await git(worktreePath, ["commit", "-m", message]);
    const sourceHead = (await git(worktreePath, ["rev-parse", "HEAD"])).stdout.trim();
    workstreams.set(identity.workstream_id, {
      workstream_id: identity.workstream_id,
      revision: 1,
      state: "completed",
      mode: "isolated",
      base_head: base,
      workspace_id: identity.workspace_id,
      workspace: { workspace_id: identity.workspace_id },
      parent_workstream_id: parentWorkstreamId,
      depends_on: [...dependsOn],
      metadata: structuredClone(metadata),
    });
    workspaces.set(identity.workspace_id, {
      workspace_id: identity.workspace_id,
      workstream_id: identity.workstream_id,
      workspace_type: "isolated_worktree",
      state: "active",
      branch_name: identity.branch_name,
      worktree_relative_path: `../.writer-workbench-worktrees/${identity.workspace_id}`,
      worktreePath,
    });
    return { ...identity, worktreePath, sourceHead };
  }

  async function workstreamReader({ workstream_id }) {
    const record = workstreams.get(workstream_id);
    if (!record) throw new Error(`missing workstream ${workstream_id}`);
    return structuredClone(record);
  }

  async function workspaceReader({ workspace_id }) {
    const record = workspaces.get(workspace_id);
    if (!record) throw new Error(`missing workspace ${workspace_id}`);
    const head = (await git(repositoryRoot, ["rev-parse", `refs/heads/${record.branch_name}`])).stdout.trim();
    return {
      ...structuredClone(record),
      healthy: true,
      registered_branch_matches: true,
      registry_mapping_consistent: true,
      git_worktree_head: head,
    };
  }

  const validationRunner = async (integrationPath, candidate) => {
    const status = (await git(integrationPath, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout;
    assert.equal(status, "");
    const snapshot = await computeWorkspaceSnapshot({
      root: integrationPath,
      workspace_id: candidate.workspace_id,
      workspace_type: "integration_worktree",
      current_head: candidate.integration_commit,
    });
    assert.equal(snapshot.head, candidate.integration_commit);
    const results = [];
    for (const suite of ["mcp", "mcp_tunnel"]) {
      const operation = await beginDevJournalOperation({
        operation_type: "test_evidence",
        tool_name: "dev_run_tests",
        workstream_id: candidate.workstream_id,
        workspace_id: candidate.workspace_id,
        result: {
          suite,
          workspace_snapshot_id: snapshot.workspace_snapshot_id,
          head: snapshot.head,
        },
      });
      await completeDevJournalOperation(operation.operation_id, {
        result: {
          suite,
          workspace_snapshot_id: snapshot.workspace_snapshot_id,
          head: snapshot.head,
          execution_ok: true,
          passed: true,
          timed_out: false,
          duration_ms: 1,
        },
      });
      results.push({
        suite,
        execution_ok: true,
        passed: true,
        timed_out: false,
        exit_code: 0,
        duration_ms: 1,
        operation_id: operation.operation_id,
        head: snapshot.head,
        workspace_snapshot_id: snapshot.workspace_snapshot_id,
      });
    }
    return results;
  };

  function createService(overrides = {}) {
    return createDevIntegrationService({
      repositoryRoot,
      registryPath: path.join(runtimeRoot, "integration_registry.json"),
      registryLockPath: path.join(runtimeRoot, "integration_registry.lock"),
      applyLockPath: path.join(runtimeRoot, "integration_apply.lock"),
      integrationRootPath: integrationRoot,
      workstreamReader,
      workspaceReader,
      validationRunner,
      ...overrides,
    });
  }

  async function advanceMain(relativePath, content, message = "advance main") {
    const filePath = path.join(repositoryRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    await git(repositoryRoot, ["add", "--", relativePath]);
    await git(repositoryRoot, ["commit", "-m", message]);
    return (await git(repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim();
  }

  async function advanceSource(source, relativePath, content, message = "advance source") {
    const filePath = path.join(source.worktreePath, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    await git(source.worktreePath, ["add", "--", relativePath]);
    await git(source.worktreePath, ["commit", "-m", message]);
    return (await git(source.worktreePath, ["rev-parse", "HEAD"])).stdout.trim();
  }

  return {
    root,
    repositoryRoot,
    baseHead,
    workstreams,
    workspaces,
    createSource,
    createService,
    advanceMain,
    advanceSource,
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("fast-forward candidate persists, validates exact commit, and preserves unrelated dirty main", async () => {
  const harness = await createHarness("fast-forward");
  try {
    const source = await harness.createSource({ changes: { "a.txt": "A\n" } });
    let service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    assert.equal(candidate.schema_version, DEV_INTEGRATION_SCHEMA_VERSION);
    assert.equal(candidate.state, "preflight_passed");
    assert.equal(candidate.strategy, "fast_forward");
    assert.equal(candidate.target_head, harness.baseHead);
    assert.equal(candidate.source_head, source.sourceHead);
    assert.equal(candidate.integration_commit, source.sourceHead);

    service = harness.createService();
    const persisted = await service.getCandidate({ integration_candidate_id: candidate.integration_candidate_id });
    assert.equal(persisted.integration_commit, source.sourceHead);
    assert.equal(persisted.state, "preflight_passed");
    const ready = await service.validateIntegration({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: persisted.revision,
    });
    assert.equal(ready.state, "ready");
    assert.equal(ready.validation_report.passed, true);
    assert.equal(ready.validation_report.integration_commit, source.sourceHead);
    assert.equal(ready.validation_report.verification_manifest.commit, source.sourceHead);
    assert.deepEqual(ready.validation_report.verification_manifest.changed_files, ["a.txt"]);
    assert.deepEqual(ready.validation_report.verification_manifest.tests_selected, ["mcp", "mcp_tunnel"]);
    assert.equal(ready.validation_report.verification_manifest.gate_result, "passed");
    assert.match(ready.validation_report.verification_manifest_sha256, /^[a-f0-9]{64}$/u);
    assert.equal(ready.integration_workspace.state, "removed");
    assert.equal(ready.integration_workspace.cleanup_pending, false);
    const validationProvenance = await dev_workspace_get_provenance({
      integration_candidate_id: candidate.integration_candidate_id,
      limit: 100,
    });
    const validationStarted = validationProvenance.events.find((event) => event.stage === "operation_started" && event.operation_type === "integration_validation");
    assert(validationStarted);
    const validationCompleted = validationProvenance.events.find((event) => event.operation_id === validationStarted.operation_id && event.stage === "operation_completed");
    assert(validationCompleted);
    assert(validationCompleted.links.some((link) => link.relation === "related_to" && link.integration_candidate_id === candidate.integration_candidate_id));
    assert.equal(validationCompleted.links.filter((link) => link.relation === "validated_by" && typeof link.operation_id === "string").length, 2);
    assert(validationCompleted.links.some((link) => link.relation === "used" && link.commit === source.sourceHead));

    const dirtyPath = path.join(harness.repositoryRoot, "unrelated-dirty.txt");
    await writeFile(dirtyPath, "preserve me\n", "utf8");
    const dirtyHash = await sha256(dirtyPath);
    const integrated = await service.integrate({
      integration_candidate_id: ready.integration_candidate_id,
      expected_revision: ready.revision,
    });
    assert.equal(integrated.state, "integrated");
    const candidateProvenance = await dev_workspace_get_provenance({
      integration_candidate_id: candidate.integration_candidate_id,
      limit: 100,
    });
    const integrationStarted = candidateProvenance.events.find((event) => event.stage === "operation_started" && event.operation_type === "integration_apply");
    assert(integrationStarted);
    const integrationCompleted = candidateProvenance.events.find((event) => event.operation_id === integrationStarted.operation_id && event.stage === "operation_completed");
    assert(integrationCompleted);
    assert(integrationCompleted.links.some((link) => link.relation === "integrated_by" && link.commit === source.sourceHead));
    assert(candidateProvenance.operation_ids.includes(validationStarted.operation_id));
    assert(candidateProvenance.operation_ids.includes(integrationStarted.operation_id));
    assert.equal(
      new Set(candidateProvenance.events.filter((event) => event.stage === "operation_started").map((event) => event.operation_type)).has("integration_validation"),
      true,
    );
    assert.equal(
      new Set(candidateProvenance.events.filter((event) => event.stage === "operation_started").map((event) => event.operation_type)).has("integration_apply"),
      true,
    );
    assert.equal(
      candidateProvenance.events.filter((event) => event.stage === "operation_started" && event.operation_type === "test_evidence").length,
      2,
    );
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), source.sourceHead);
    assert.equal(await sha256(dirtyPath), dirtyHash);
    assert.equal(await readFile(dirtyPath, "utf8"), "preserve me\n");
    assert.equal((await git(harness.repositoryRoot, ["diff", "--cached", "--name-only"])).stdout, "");
    assert.match((await git(harness.repositoryRoot, ["status", "--porcelain=v1"])).stdout, /\?\? unrelated-dirty\.txt/u);

    const already = await service.preflight({ workstream_id: source.workstream_id });
    assert.equal(already.state, "integrated");
    assert.equal(already.strategy, "already_integrated");
    assert.equal(already.integration_commit, source.sourceHead);
  } finally {
    await harness.cleanup();
  }
});

test("integration preserves more than 256 unrelated dirty paths without path-count rejection", async () => {
  const harness = await createHarness("large-dirty-main");
  try {
    const source = await harness.createSource({ changes: { "feature.txt": "feature\n" } });
    const service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const ready = await service.validateIntegration({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });

    const dirtyDirectory = path.join(harness.repositoryRoot, "runtime-dirty");
    await mkdir(dirtyDirectory, { recursive: true });
    const dirtyEntries = [];
    for (let index = 0; index < 300; index += 1) {
      const relativePath = `runtime-dirty/item-${String(index).padStart(3, "0")}.txt`;
      const content = `dirty-${index}\n`;
      await writeFile(path.join(harness.repositoryRoot, relativePath), content, "utf8");
      dirtyEntries.push({ relativePath, content });
    }

    const integrated = await service.integrate({
      integration_candidate_id: ready.integration_candidate_id,
      expected_revision: ready.revision,
    });
    assert.equal(integrated.state, "integrated");
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), source.sourceHead);
    assert.equal(await readFile(path.join(harness.repositoryRoot, dirtyEntries[0].relativePath), "utf8"), dirtyEntries[0].content);
    assert.equal(await readFile(path.join(harness.repositoryRoot, dirtyEntries.at(-1).relativePath), "utf8"), dirtyEntries.at(-1).content);
    const untracked = (await git(harness.repositoryRoot, ["ls-files", "--others", "--exclude-standard"])).stdout.split(/\r?\n/u).filter(Boolean);
    assert.equal(untracked.length, 300);
  } finally {
    await harness.cleanup();
  }
});

test("integration excludes server-owned cleanup runtime from untracked carry-forward while preserving ordinary untracked files", async () => {
  const harness = await createHarness("server-owned-cleanup-runtime");
  try {
    const source = await harness.createSource({ changes: { "feature.txt": "feature\n" } });
    let observedUntrackedArgs = null;
    const gitRunner = async (args, options = {}) => {
      if (args[0] === "ls-files" && args.includes("--others")) observedUntrackedArgs = [...args];
      return git(options.cwd ?? harness.repositoryRoot, args, { allowFailure: options.allowFailure === true });
    };
    const service = harness.createService({ gitRunner });
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const ready = await service.validateIntegration({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });

    const cleanupPath = path.join(
      harness.repositoryRoot,
      "data",
      "cleanup",
      "trash",
      "cleanup_trash_fixture",
      "payload.txt",
    );
    const ordinaryPath = path.join(harness.repositoryRoot, "ordinary-untracked.txt");
    await mkdir(path.dirname(cleanupPath), { recursive: true });
    await writeFile(cleanupPath, "server-owned cleanup payload\n", "utf8");
    await writeFile(ordinaryPath, "ordinary untracked payload\n", "utf8");
    const cleanupHash = await sha256(cleanupPath);
    const ordinaryHash = await sha256(ordinaryPath);

    const integrated = await service.integrate({
      integration_candidate_id: ready.integration_candidate_id,
      expected_revision: ready.revision,
    });

    assert.equal(integrated.state, "integrated");
    assert(observedUntrackedArgs);
    assert(observedUntrackedArgs.includes("."));
    assert(observedUntrackedArgs.includes(":(exclude)data/cleanup"));
    assert(observedUntrackedArgs.includes(":(exclude)data/cleanup/**"));

    const enumerated = String(
      (await git(harness.repositoryRoot, observedUntrackedArgs)).stdout,
    ).split("\0").filter(Boolean);
    assert.equal(enumerated.includes("ordinary-untracked.txt"), true);
    assert.equal(
      enumerated.some((relativePath) => relativePath.startsWith("data/cleanup/")),
      false,
    );
    assert.equal(await sha256(cleanupPath), cleanupHash);
    assert.equal(await sha256(ordinaryPath), ordinaryHash);
  } finally {
    await harness.cleanup();
  }
});

test("overlay preflight uses a large bounded buffer and labels pre-apply failures", async () => {
  const harness = await createHarness("overlay-buffer-diagnostic");
  try {
    const source = await harness.createSource({ changes: { "feature.txt": "feature\n" } });
    let observedOverlayBuffer = null;
    const gitRunner = async (args, options = {}) => {
      if (args[0] === "read-tree" && args.includes("--dry-run")) {
        observedOverlayBuffer = options.maxBuffer;
        const error = new Error("stdout maxBuffer length exceeded");
        error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
        throw error;
      }
      return git(options.cwd ?? harness.repositoryRoot, args, { allowFailure: options.allowFailure === true });
    };
    const service = harness.createService({ gitRunner });
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const ready = await service.validateIntegration({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });
    await assert.rejects(
      service.integrate({ integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision }),
      (error) => {
        assert.equal(error.code, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
        assert.equal(error.integration_stage, "overlay_preflight");
        assert.match(error.message, /Integration pre-apply stage overlay_preflight failed/u);
        return true;
      },
    );
    assert.equal(observedOverlayBuffer, 8 * 1024 * 1024);
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), harness.baseHead);
  } finally {
    await harness.cleanup();
  }
});

test("diverged histories produce a server merge commit with exact parents and integrate by fast-forward", async () => {
  const harness = await createHarness("merge-commit");
  try {
    const source = await harness.createSource({ changes: { "source.txt": "source\n" } });
    const targetHead = await harness.advanceMain("main.txt", "main\n");
    const service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    assert.equal(candidate.state, "preflight_passed");
    assert.equal(candidate.strategy, "merge_commit");
    assert.equal(candidate.target_head, targetHead);
    assert.notEqual(candidate.integration_commit, source.sourceHead);
    const parents = (await git(harness.repositoryRoot, ["show", "-s", "--format=%P", candidate.integration_commit])).stdout.trim().split(/\s+/u);
    assert.deepEqual(parents, [targetHead, source.sourceHead]);
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", `${candidate.integration_commit}^{tree}`])).stdout.trim(), candidate.result_tree);
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), targetHead);

    const ready = await service.validateIntegration({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision });
    assert.equal(ready.state, "ready");
    const integrated = await service.integrate({ integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision });
    assert.equal(integrated.state, "integrated");
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), candidate.integration_commit);
    assert.equal(await readFile(path.join(harness.repositoryRoot, "source.txt"), "utf8"), "source\n");
    assert.equal(await readFile(path.join(harness.repositoryRoot, "main.txt"), "utf8"), "main\n");
  } finally {
    await harness.cleanup();
  }
});

test("merge-tree conflict is bounded and leaves main plus source unchanged", async () => {
  const harness = await createHarness("conflict");
  try {
    const source = await harness.createSource({ changes: { "conflict.txt": "source change\n" } });
    const targetHead = await harness.advanceMain("conflict.txt", "main change\n", "main conflict change");
    const service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    assert.equal(candidate.state, "conflicted");
    assert.equal(candidate.failure_reason.code, "CONFLICT");
    assert.equal(candidate.failure_reason.target_head, targetHead);
    assert.equal(candidate.failure_reason.source_head, source.sourceHead);
    assert(candidate.failure_reason.conflicts.length >= 1);
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), targetHead);
    assert.equal((await git(source.worktreePath, ["rev-parse", "HEAD"])).stdout.trim(), source.sourceHead);
    assert.equal((await git(harness.repositoryRoot, ["diff", "--cached", "--name-only"])).stdout, "");
  } finally {
    await harness.cleanup();
  }
});

test("dependency gate blocks before dependency integration and admits a fresh serial candidate after it", async () => {
  const harness = await createHarness("dependency");
  try {
    const dependency = await harness.createSource({ changes: { "dep.txt": "dependency\n" } });
    const dependent = await harness.createSource({
      changes: { "dependent.txt": "dependent\n" },
      dependsOn: [dependency.workstream_id],
    });
    const service = harness.createService();
    const blocked = await service.preflight({ workstream_id: dependent.workstream_id });
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.failure_reason.code, "BLOCKED_BY_DEPENDENCY");

    const dependencyCandidate = await service.preflight({ workstream_id: dependency.workstream_id });
    const dependencyReady = await service.validateIntegration({
      integration_candidate_id: dependencyCandidate.integration_candidate_id,
      expected_revision: dependencyCandidate.revision,
    });
    const dependencyIntegrated = await service.integrate({
      integration_candidate_id: dependencyReady.integration_candidate_id,
      expected_revision: dependencyReady.revision,
    });
    assert.equal(dependencyIntegrated.state, "integrated");

    const admitted = await service.preflight({ workstream_id: dependent.workstream_id });
    assert.equal(admitted.state, "preflight_passed");
    assert.equal(admitted.strategy, "merge_commit");
    assert.equal(admitted.depends_on[0].integration_commit, dependencyIntegrated.integration_commit);
  } finally {
    await harness.cleanup();
  }
});

test("semantic resolution workstream supersedes its exact conflicted parent dependency without faking integration", async () => {
  const harness = await createHarness("semantic-resolution-dependency");
  try {
    const dependency = await harness.createSource({
      changes: { "conflict.txt": "dependency source\n" },
    });
    const targetHead = await harness.advanceMain(
      "conflict.txt",
      "main conflict\n",
      "main conflict for semantic resolution",
    );
    const service = harness.createService();
    const conflicted = await service.preflight({ workstream_id: dependency.workstream_id });
    assert.equal(conflicted.state, "conflicted");
    assert.equal(conflicted.failure_reason.code, "CONFLICT");

    const invalidResolution = await harness.createSource({
      base: targetHead,
      changes: { "invalid-resolution.txt": "invalid\n" },
      dependsOn: [dependency.workstream_id],
      parentWorkstreamId: dependency.workstream_id,
      metadata: {
        resolution_for: conflicted.integration_candidate_id,
        source_commit: dependency.sourceHead,
        target_head: targetHead,
        strategy: "semantic_three_way_resolution_only",
        no_redo: false,
      },
    });
    const invalidCandidate = await service.preflight({
      workstream_id: invalidResolution.workstream_id,
    });
    assert.equal(invalidCandidate.state, "blocked");
    assert.equal(invalidCandidate.failure_reason.code, "BLOCKED_BY_DEPENDENCY");

    const resolution = await harness.createSource({
      base: targetHead,
      changes: { "conflict.txt": "semantic resolution\n" },
      dependsOn: [dependency.workstream_id],
      parentWorkstreamId: dependency.workstream_id,
      metadata: {
        resolution_for: conflicted.integration_candidate_id,
        source_commit: dependency.sourceHead,
        target_head: targetHead,
        strategy: "semantic_three_way_resolution_only",
        no_redo: true,
      },
    });
    const candidate = await service.preflight({ workstream_id: resolution.workstream_id });
    assert.equal(candidate.state, "preflight_passed");
    assert.equal(candidate.strategy, "fast_forward");
    assert.equal(candidate.depends_on.length, 1);
    assert.equal(candidate.depends_on[0].source_branch, dependency.branch_name);
    assert.equal(candidate.depends_on[0].source_head, dependency.sourceHead);
    assert.equal(candidate.depends_on[0].integration_commit, null);

    const ready = await service.validateIntegration({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });
    assert.equal(ready.state, "ready");
    const integrated = await service.integrate({
      integration_candidate_id: ready.integration_candidate_id,
      expected_revision: ready.revision,
    });
    assert.equal(integrated.state, "integrated");
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), resolution.sourceHead);
  } finally {
    await harness.cleanup();
  }
});

test("serial candidates cannot reuse validation after main advances", async () => {
  const harness = await createHarness("serial-race");
  try {
    const sourceA = await harness.createSource({ changes: { "a.txt": "A\n" } });
    const sourceB = await harness.createSource({ changes: { "b.txt": "B\n" } });
    const service = harness.createService();
    const candidateA = await service.preflight({ workstream_id: sourceA.workstream_id });
    const candidateB = await service.preflight({ workstream_id: sourceB.workstream_id });
    assert.equal(candidateA.target_head, candidateB.target_head);
    const readyA = await service.validateIntegration({ integration_candidate_id: candidateA.integration_candidate_id, expected_revision: candidateA.revision });
    const readyB = await service.validateIntegration({ integration_candidate_id: candidateB.integration_candidate_id, expected_revision: candidateB.revision });
    const integratedA = await service.integrate({ integration_candidate_id: readyA.integration_candidate_id, expected_revision: readyA.revision });
    assert.equal(integratedA.state, "integrated");
    const staleB = await service.integrate({ integration_candidate_id: readyB.integration_candidate_id, expected_revision: readyB.revision });
    assert.equal(staleB.state, "stale");
    assert(staleB.stale_reason.reasons.some((reason) => reason.code === "TARGET_HEAD_CHANGED"));
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), integratedA.integration_commit);
  } finally {
    await harness.cleanup();
  }
});

test("source and dependency head changes invalidate exact validated candidates", async () => {
  const harness = await createHarness("stale-heads");
  try {
    const source = await harness.createSource({ changes: { "source.txt": "one\n" } });
    const service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const ready = await service.validateIntegration({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision });
    await harness.advanceSource(source, "source-2.txt", "two\n");
    const stale = await service.integrate({ integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision });
    assert.equal(stale.state, "stale");
    assert(stale.stale_reason.reasons.some((reason) => reason.code === "SOURCE_HEAD_CHANGED"));
  } finally {
    await harness.cleanup();
  }

  const dependencyHarness = await createHarness("stale-dependency");
  try {
    const dependency = await dependencyHarness.createSource({ changes: { "dep.txt": "one\n" } });
    const service = dependencyHarness.createService();
    const depCandidate = await service.preflight({ workstream_id: dependency.workstream_id });
    const depReady = await service.validateIntegration({ integration_candidate_id: depCandidate.integration_candidate_id, expected_revision: depCandidate.revision });
    const depIntegrated = await service.integrate({ integration_candidate_id: depReady.integration_candidate_id, expected_revision: depReady.revision });
    assert.equal(depIntegrated.state, "integrated");

    const dependent = await dependencyHarness.createSource({
      base: dependencyHarness.baseHead,
      changes: { "dependent.txt": "dependent\n" },
      dependsOn: [dependency.workstream_id],
    });
    const candidate = await service.preflight({ workstream_id: dependent.workstream_id });
    const ready = await service.validateIntegration({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision });
    await dependencyHarness.advanceSource(dependency, "dep-2.txt", "two\n");
    const stale = await service.integrate({ integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision });
    assert.equal(stale.state, "stale");
    assert(stale.stale_reason.reasons.some((reason) => reason.code === "DEPENDENCY_HEAD_CHANGED"));
  } finally {
    await dependencyHarness.cleanup();
  }
});

test("dirty-main overlap is rejected before ref/index/worktree mutation", async () => {
  const harness = await createHarness("dirty-overlap");
  try {
    const source = await harness.createSource({ changes: { "conflict.txt": "candidate integration\n" } });
    const service = harness.createService();
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const ready = await service.validateIntegration({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision });
    const originalHead = (await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim();
    const dirtyPath = path.join(harness.repositoryRoot, "conflict.txt");
    await writeFile(dirtyPath, "local dirty overlay\n", "utf8");
    const dirtyHash = await sha256(dirtyPath);
    const blocked = await service.integrate({ integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision });
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.failure_reason.code, "MAIN_WORKTREE_OVERLAY_CONFLICT");
    assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), originalHead);
    assert.equal(await sha256(dirtyPath), dirtyHash);
    assert.equal((await git(harness.repositoryRoot, ["diff", "--cached", "--name-only"])).stdout, "");
  } finally {
    await harness.cleanup();
  }
});

test("service rejects caller-controlled integration plumbing fields", async () => {
  const harness = await createHarness("schema-guard");
  try {
    const source = await harness.createSource({ changes: { "guard.txt": "guard\n" } });
    const service = harness.createService();
    await assert.rejects(
      service.preflight({ workstream_id: source.workstream_id, targetHead: harness.baseHead }),
      /does not accept targetHead/u,
    );
    await assert.rejects(
      service.listCandidates({ command: "git" }),
      /does not accept command/u,
    );
  } finally {
    await harness.cleanup();
  }
});

test("hard interruption recovers only bound dead validation, including interrupted cleanup and append", async () => {
  const harness = await createHarness("interrupted-validation");
  try {
    const source = await harness.createSource({ changes: { "docs/recovery.txt": "recovery\n", ".gitignore": "/node_modules\n" } });
    const runtime = path.join(harness.root, "runtime");
    const journalRoot = path.join(runtime, "journal");
    const lockPath = path.join(runtime, "test.lock");
    const journal = createDevOperationJournalService({ storageRoot: journalRoot });
    const dependencyRoot = path.join(harness.root, "dependencies");
    await mkdir(path.join(dependencyRoot, "node_modules"), { recursive: true });
    await writeFile(path.join(dependencyRoot, "node_modules", "preserve.txt"), "dependencies\n");
    const overrides = { journal, testLockPath: lockPath, dependencyRoot };
    const service = harness.createService(overrides);
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const workstream = harness.workstreams.get(source.workstream_id);
    const workspace = { ...harness.workspaces.get(source.workspace_id), healthy: true,
      registered_branch_matches: true, registry_mapping_consistent: true, git_worktree_head: source.sourceHead };
    const worker = `
      import {writeFile} from 'node:fs/promises';
      import os from 'node:os';
      import {createDevIntegrationService} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-integration-tools.mjs")).href)};
      import {createDevOperationJournalService} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-journal-tools.mjs")).href)};
      import {fingerprintMcpMutationRequest} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-operation-reconciliation-context.mjs")).href)};
      const journal = createDevOperationJournalService({storageRoot:${JSON.stringify(journalRoot)}});
      const service = createDevIntegrationService({
        repositoryRoot:${JSON.stringify(harness.repositoryRoot)},
        registryPath:${JSON.stringify(path.join(runtime, "integration_registry.json"))},
        registryLockPath:${JSON.stringify(path.join(runtime, "integration_registry.lock"))},
        applyLockPath:${JSON.stringify(path.join(runtime, "integration_apply.lock"))},
        integrationRootPath:${JSON.stringify(path.join(harness.root, ".writer-workbench-integrations"))},
        journal, workstreamReader:async()=>(${JSON.stringify(workstream)}), workspaceReader:async()=>(${JSON.stringify(workspace)}),
        validationRunner:async()=>{
          await journal.begin({operation_type:'test_evidence',tool_name:'dev_run_tests',
            workspace_id:${JSON.stringify(source.workspace_id)},workstream_id:${JSON.stringify(source.workstream_id)},
            result:{suite:'mcp',head:${JSON.stringify(source.sourceHead)}}});
          await writeFile(${JSON.stringify(lockPath)},JSON.stringify({owner_pid:process.pid,child_pid:process.pid,
            hostname:os.hostname(),suite:'mcp',started_at:new Date().toISOString()}));
          process.exit(77);
        }
      });
      const input=${JSON.stringify({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision })};
      await journal.executeReconciled({reconciliation_key:'integration-test-hard-interruption',tool_name:'dev_workspace_validate_integration',
        request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_validate_integration',input)},
        ()=>service.validateIntegration(input));
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", worker], { cwd: path.resolve("."), windowsHide: true, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", data => { stderr += data; });
    const exit = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    assert.equal(exit, 77, stderr);
    let current = await service.getCandidate({ integration_candidate_id: candidate.integration_candidate_id });
    assert.equal(current.state, "testing");
    assert.equal(current.validation_report, null);
    let proof = await journal.verify();
    assert.equal(proof.dangling_operations.length, 3);
    const start = proof.events.find(e => e.operation_type === "integration_validation");
    const input = { integration_candidate_id: current.integration_candidate_id, expected_revision: current.revision,
      operation_id: start.operation_id, expected_start_hash: start.event_hash };
    const journalHead = proof.head.latest_event_hash;
    await journal.reconcileDangling();
    assert.equal((await journal.verify()).head.latest_event_hash, journalHead, "generic recovery must not claim no-effect for tests");
    await assert.rejects(service.recoverInterruptedValidation({ ...input, expected_revision: input.expected_revision - 1 }), /STALE_REVISION/);
    await assert.rejects(service.recoverInterruptedValidation({ ...input, expected_start_hash: "0".repeat(64) }), /BINDING_MISMATCH/);
    const originalLock = await readFile(lockPath);
    await writeFile(lockPath, JSON.stringify({ owner_pid: process.pid, hostname: os.hostname(), suite: "mcp" }));
    await assert.rejects(service.recoverInterruptedValidation(input), /RUNNER_CONFLICT/);
    await writeFile(lockPath, originalLock);
    const integrationPath = path.join(harness.root, ".writer-workbench-integrations", current.integration_candidate_id);
    await symlink(path.join(dependencyRoot, "node_modules"), path.join(integrationPath, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
    await writeFile(path.join(integrationPath, "untracked.txt"), "preserve me");
    await assert.rejects(service.recoverInterruptedValidation(input), /DIRTY_WORKTREE/);
    await rm(path.join(integrationPath, "untracked.txt"));
    assert.equal((await service.getCandidate({ integration_candidate_id: current.integration_candidate_id })).revision, input.expected_revision);
    const cleanupFailure = harness.createService({ ...overrides, gitRunner: async (args, options) => {
      if (args[0] === "worktree" && args[1] === "remove") throw new Error("fixture cleanup interrupted");
      return git(options.cwd, args, options);
    } });
    current = await cleanupFailure.recoverInterruptedValidation(input);
    assert.equal(current.state, "failed");
    assert.equal(current.validation_report.status, "interrupted");
    assert.equal(current.validation_report.passed, false);
    assert.equal(current.integration_workspace.cleanup_pending, true);
    assert.equal((await journal.verify()).dangling_operations.length, 3);
    let appendCount = 0;
    const appendFailure = harness.createService({ ...overrides, journal: { ...journal, recover: async (...args) => {
      if (++appendCount === 2) throw new Error("fixture append interrupted");
      return journal.recover(...args);
    } } });
    await assert.rejects(appendFailure.recoverInterruptedValidation({ ...input, expected_revision: current.revision }), /append interrupted/);
    current = await service.getCandidate({ integration_candidate_id: current.integration_candidate_id });
    assert.equal(current.integration_workspace.state, "removed");
    await assert.rejects(access(integrationPath), { code: "ENOENT" });
    assert.equal(await readFile(path.join(dependencyRoot, "node_modules", "preserve.txt"), "utf8"), "dependencies\n");
    assert.equal((await journal.verify()).dangling_operations.length, 2);
    const revisionBeforeResume = current.revision;
    current = await service.recoverInterruptedValidation({ ...input, expected_revision: current.revision });
    assert.equal(current.revision, revisionBeforeResume, "already cleaned candidate is not rewritten");
    proof = await journal.verify();
    assert.equal(proof.dangling_operations.length, 0);
    assert.equal(proof.active_operations.length, 0);
    assert.equal(proof.events.filter(e => e.stage === "operation_recovered").length, 3);
    // A leftover unregistered directory is never recursively removed. A retry
    // can clean only the exact owned junction after unrelated files are gone.
    await mkdir(integrationPath);
    await writeFile(path.join(integrationPath, "preserve.txt"), "unowned\n");
    current = await service.recoverInterruptedValidation({ ...input, expected_revision: current.revision });
    assert.equal(current.integration_workspace.cleanup_pending, true);
    assert.equal(await readFile(path.join(integrationPath, "preserve.txt"), "utf8"), "unowned\n");
    await rm(path.join(integrationPath, "preserve.txt"));
    await symlink(path.join(dependencyRoot, "node_modules"), path.join(integrationPath, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
    current = await service.recoverInterruptedValidation({ ...input, expected_revision: current.revision });
    assert.equal(current.integration_workspace.state, "removed");
    await assert.rejects(access(integrationPath), { code: "ENOENT" });
    const successor = await service.preflight({ workstream_id: source.workstream_id });
    assert.equal(successor.state, "preflight_passed");
    assert.notEqual(successor.integration_candidate_id, current.integration_candidate_id);
    assert.equal(successor.integration_commit, current.integration_commit);
  } finally { await harness.cleanup(); }
});

test("completed failed validation recovers missing provenance without rewriting results or replaying suites", async () => {
  const harness = await createHarness("failed-provenance");
  try {
    const source = await harness.createSource({ changes: { "server/src/fixture.mjs": "export const fixture = true;\n" } });
    const runtime = path.join(harness.root, "runtime");
    const journalRoot = path.join(runtime, "journal");
    const lockPath = path.join(runtime, "test.lock");
    const journal = createDevOperationJournalService({ storageRoot: journalRoot });
    const service = harness.createService({ journal, testLockPath: lockPath,
      validationRunner: async () => { throw new Error("Recovery must not dispatch tests"); } });
    const candidate = await service.preflight({ workstream_id: source.workstream_id });
    const workstream = harness.workstreams.get(source.workstream_id);
    const workspace = await harness.createService().getCandidate({ integration_candidate_id: candidate.integration_candidate_id });
    assert.equal(workspace.source_head, source.sourceHead);
    const worker = `
      import {createDevIntegrationService} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-integration-tools.mjs")).href)};
      import {createDevOperationJournalService,computeWorkspaceSnapshot} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-journal-tools.mjs")).href)};
      import {fingerprintMcpMutationRequest} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-operation-reconciliation-context.mjs")).href)};
      const journal=createDevOperationJournalService({storageRoot:${JSON.stringify(journalRoot)}});
      const service=createDevIntegrationService({
        repositoryRoot:${JSON.stringify(harness.repositoryRoot)},
        registryPath:${JSON.stringify(path.join(runtime, "integration_registry.json"))},
        registryLockPath:${JSON.stringify(path.join(runtime, "integration_registry.lock"))},
        applyLockPath:${JSON.stringify(path.join(runtime, "integration_apply.lock"))},
        integrationRootPath:${JSON.stringify(path.join(harness.root, ".writer-workbench-integrations"))},
        journal,testLockPath:${JSON.stringify(lockPath)},
        workstreamReader:async()=>(${JSON.stringify(workstream)}),
        workspaceReader:async()=>(${JSON.stringify({ ...harness.workspaces.get(source.workspace_id), healthy: true, registered_branch_matches: true, registry_mapping_consistent: true, git_worktree_head: source.sourceHead })}),
        validationRunner:async(integrationPath,candidate)=>{
          const snapshot=await computeWorkspaceSnapshot({root:integrationPath,workspace_id:candidate.workspace_id,
            workspace_type:'integration_worktree',current_head:candidate.integration_commit});
          const results=[];
          for(const suite of ['mcp','mcp_tunnel']) {
            const identity={suite,head:snapshot.head,workspace_snapshot_id:snapshot.workspace_snapshot_id};
            const op=await journal.begin({operation_type:'test_evidence',tool_name:'dev_run_tests',
              workspace_id:candidate.workspace_id,workstream_id:candidate.workstream_id,result:identity});
            const result={...identity,operation_id:op.operation_id,passed:suite==='mcp',execution_ok:suite==='mcp',
              timed_out:false,exit_code:0,duration_ms:1};
            if(suite==='mcp') await journal.complete(op.operation_id,{result});
            // Model an actual test effect followed by failed terminal publication.
            results.push(result);
          }
          return results;
        }
      });
      const input=${JSON.stringify({ integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision })};
      await journal.executeReconciled({reconciliation_key:'failed-validation-boundary',tool_name:'dev_workspace_validate_integration',
        request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_validate_integration',input)},async()=>{
          const result=await service.validateIntegration(input);
          if(result.state!=='failed') throw new Error('Expected failed gate');
          process.exit(77); // Boundary terminal delivery was interrupted, not the tests.
        });
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", worker], { cwd: path.resolve("."), windowsHide: true, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", data => { stderr += data; });
    const exit = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", code => resolve(code)); });
    assert.equal(exit, 77, stderr);
    const failed = await service.getCandidate({ integration_candidate_id: candidate.integration_candidate_id });
    assert.equal(failed.state, "failed");
    assert.equal(failed.failure_reason.code, "INTEGRATION_VALIDATION_FAILED");
    assert.equal(failed.integration_workspace.state, "removed");
    let proof = await journal.verify();
    assert.equal(proof.dangling_operations.length, 2);
    const start = proof.events.find(e => e.stage === "operation_started" && e.operation_type === "integration_validation");
    const input = { integration_candidate_id: failed.integration_candidate_id, expected_revision: failed.revision,
      operation_id: start.operation_id, expected_start_hash: start.event_hash };
    const terminalsBefore = proof.events.filter(e => e.stage !== "operation_started");
    const registryPath = path.join(runtime, "integration_registry.json");
    const registryBefore = await readFile(registryPath);
    await assert.rejects(service.recoverInterruptedValidation({ ...input, expected_revision: failed.revision - 1 }), /STALE_REVISION/);
    await assert.rejects(service.recoverInterruptedValidation({ ...input, expected_start_hash: "0".repeat(64) }), /BINDING_MISMATCH/);
    const rejectProof = async (change, pattern) => {
      const guarded = harness.createService({ journal: { ...journal, verify: async () => {
        const actual = await journal.verify();
        return { ...actual, events: change(structuredClone(actual.events)) };
      } }, testLockPath: lockPath });
      const before = (await journal.verify()).head.latest_event_hash;
      await assert.rejects(guarded.recoverInterruptedValidation(input), pattern);
      assert.equal((await journal.verify()).head.latest_event_hash, before, "Rejected proof never appends");
    };
    await rejectProof(events => events.filter(e => !(e.operation_id === start.operation_id && e.stage === "operation_completed")), /COMPLETED_REPORT_MISMATCH/);
    await rejectProof(events => events.map(e => {
      if (e.operation_id === start.operation_id && e.stage === "operation_completed") e.result.verification_manifest_sha256 = "0".repeat(64);
      return e;
    }), /COMPLETED_REPORT_MISMATCH/);
    await rejectProof(events => events.map(e => {
      if (e.stage === "operation_started") e.diagnostic.owner_pid = process.pid;
      return e;
    }), /OWNER_ACTIVE_OR_UNKNOWN/);
    await rejectProof(events => events.map(e => {
      if (e.operation_type === "test_evidence" && e.stage === "operation_completed") e.result.passed = false;
      return e;
    }), /TERMINAL_CONFLICT/);
    await rejectProof(events => events.map(e => {
      if (e.operation_type === "test_evidence" && e.stage === "operation_started") e.result.workspace_snapshot_id = "0".repeat(64);
      return e;
    }), /TEST_BINDING_MISMATCH/);
    await writeFile(lockPath, JSON.stringify({ owner_pid: process.pid, hostname: os.hostname(), suite: "mcp" }));
    await assert.rejects(service.recoverInterruptedValidation(input), /RUNNER_CONFLICT/);
    await rm(lockPath);
    const residue = path.join(harness.root, ".writer-workbench-integrations", failed.integration_candidate_id);
    await mkdir(residue);
    await writeFile(path.join(residue, "preserve.txt"), "unknown residue\n");
    await assert.rejects(service.recoverInterruptedValidation(input), /COMPLETED_WORKTREE_PRESENT/);
    assert.equal(await readFile(path.join(residue, "preserve.txt"), "utf8"), "unknown residue\n");
    await rm(path.join(residue, "preserve.txt"));
    await rmdir(residue);
    let appended = 0;
    const interrupted = harness.createService({ journal: { ...journal, recover: async (...args) => {
      if (++appended === 2) throw new Error("fixture boundary publication interrupted");
      return journal.recover(...args);
    } }, testLockPath: lockPath });
    await assert.rejects(interrupted.recoverInterruptedValidation(input), /fixture boundary publication interrupted/);
    assert.equal((await journal.verify()).dangling_operations.length, 1);
    const result = await service.recoverInterruptedValidation(input);
    assert.deepEqual(result, failed, "Failed candidate and its manifest stay unchanged");
    assert.deepEqual(await readFile(registryPath), registryBefore, "No candidate result or revision is rewritten");
    proof = await journal.verify();
    assert.equal(proof.dangling_operations.length, 0);
    assert.equal(proof.active_operations.length, 0);
    assert.deepEqual(proof.events.filter(e => terminalsBefore.some(old => old.journal_event_id === e.journal_event_id)), terminalsBefore);
    const recovered = proof.events.filter(e => e.stage === "operation_recovered");
    assert.equal(recovered.length, 2);
    assert(recovered.every(e => e.result.passed === false && e.result.provenance_finalization === true));
    const head = proof.head.latest_event_hash;
    await service.recoverInterruptedValidation(input);
    assert.equal((await journal.verify()).head.latest_event_hash, head, "Finalization is idempotent");
    assert.equal((await journal.status()).health, "healthy");
  } finally { await harness.cleanup(); }
});

console.log("MCP development controlled integration runtime tests passed.");
console.log("- persistent candidate identity, exact validation, and cleanup: passed");
console.log("- ancestry, fast-forward, merge-tree, merge commit, and conflict rejection: passed");
console.log("- dependency, serial race, source/dependency stale validation: passed");
console.log("- dirty-main carry-forward and overlap rejection: passed");

test("R16 real candidate preflight survives a lost response with exact Journal evidence and no duplicate candidate", async t => {
  const harness = await createHarness("r16-managed-preflight");
  t.after(() => harness.cleanup());
  const source = await harness.createSource({ changes: { "r16.txt": "fixture\n" } });
  const journalRoot = path.join(harness.root, "r16-journal");
  const journal = createDevOperationJournalService({ storageRoot: journalRoot });
  const service = harness.createService({ journal });
  const { createPiReliableMcpAdapter } = await import("../../server/src/pi-mcp-reliable-adapter.mjs");
  const { createPiLifecycleScopeVerifier } = await import("../../server/src/pi-lifecycle-scope.mjs");
  const { hashExecutionInput, REQUIRED_DECISION_BOUNDARIES } = await import("../../server/src/pi-execution-contract.mjs");
  const context = { project_id: "writer_workbench", workstream_id: source.workstream_id, workspace_id: source.workspace_id };
  const input = { workstream_id: source.workstream_id, expected_workstream_revision: 1 };
  const intent = { schema_version: 1, intent_id: "r16-real-preflight-fixture", goal: "Verify disposable candidate preflight",
    context, constraints: ["Disposable repository only"],
    requested_actions: [{ step_id: "preflight", capability: "git.integration_preflight", input, depends_on: [], idempotency_key: "r16-real-preflight-key" }],
    mutation_plan: [{ step_id: "preflight", target: source.workstream_id, expected_change: "Create one exact candidate", input_sha256: hashExecutionInput(input) }],
    verification: { focused: [], affected: [], full: [] }, completion_conditions: ["Observe exact candidate"],
    permissions: { read: false, write: false, workspace_create: false, tests: false, commit: false, integrate: true, push: false },
    decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES] };
  let sends = 0;
  const verifyScope = createPiLifecycleScopeVerifier({
    getWorkstream: async ({ workstream_id }) => harness.workstreams.get(workstream_id),
    getCheckpoint: async () => null, getOperation: args => journal.getOperation(args),
    getIntegrationCandidate: args => service.getCandidate(args), validationAllowed: async () => false,
  });
  const makeAdapter = (callTool, store = journal) => createPiReliableMcpAdapter({
    callTool, queryOperation: args => store.getOperation(args),
    resolveWorkspace: async () => null, verifyScope,
  });
  const first = makeAdapter(async request => {
    sends++;
    assert.equal(request.name, "dev_workspace_integration_preflight");
    const outcome = await journal.executeReconciled({
      reconciliation_key: request._meta.reconciliation_key,
      request_fingerprint_sha256: hashExecutionInput({ tool_name: request.name, arguments: request.arguments }),
      tool_name: request.name,
      resolve_workspace_scope: async () => ({ workspace_id: source.workspace_id, workstream_id: source.workstream_id }),
    }, async () => ({ content: [{ type: "text", text: JSON.stringify(await service.preflight(request.arguments)) }] }));
    assert.equal(outcome.reconciled, false);
    throw Object.assign(new Error("fixture loses response after real candidate creation"), { code: "TIMEOUT" });
  });
  await assert.rejects(first.execute(intent, "preflight"), { code: "TIMEOUT" });
  const reopened = createDevOperationJournalService({ storageRoot: journalRoot });
  const restored = makeAdapter(async () => assert.fail("must not replay candidate creation"), reopened);
  const result = await restored.reconcile(intent, "preflight");
  assert.equal(result.verdict, "completed");
  const facts = result.receipt.evidence.original_result;
  assert.equal(facts.integration_commit, source.sourceHead);
  assert.equal(facts.workspace_id, source.workspace_id);
  assert.equal(facts.workstream_id, source.workstream_id);
  const persisted = await harness.createService().getCandidate({ integration_candidate_id: facts.integration_candidate_id });
  assert.equal(persisted.revision, facts.revision);
  assert.equal(persisted.state, "preflight_passed");
  const candidates = await service.listCandidates({ workstream_id: source.workstream_id });
  assert.equal(candidates.total, 1);
  assert.equal(sends, 1);
  assert.equal((await reopened.status()).chain_verified, true);
  assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), harness.baseHead);

  // Exercise actual candidate materialization, diff checks, cleanup and
  // persisted validation receipt. Suite results below are injected fixture
  // observations, NOT production or full isolated test-suite execution.
  const validationService = harness.createService({ journal: reopened,
    validationRunner: async (integrationPath, candidate) => {
      const observedHead = (await git(integrationPath, ["rev-parse", "HEAD"])).stdout.trim();
      assert.equal(observedHead, source.sourceHead);
      const results = [];
      for (const suite of ["mcp", "mcp_tunnel"]) {
        const op = await reopened.begin({ operation_type: "test_evidence", tool_name: "dev_run_tests",
          workstream_id: source.workstream_id, workspace_id: source.workspace_id,
          result: { suite, head: observedHead, fixture: true } });
        await reopened.complete(op.operation_id, { result: { suite, head: observedHead,
          passed: true, execution_ok: true, timed_out: false, fixture: true } });
        results.push({ suite, operation_id: op.operation_id, head: observedHead,
          passed: true, execution_ok: true, timed_out: false, exit_code: 0, duration_ms: 1 });
      }
      return results;
    },
  });
  const validateInput = { integration_candidate_id: facts.integration_candidate_id, expected_revision: persisted.revision };
  const validationIntent = { ...intent, intent_id: "r16-real-validation-fixture",
    goal: "Verify disposable validation receipt with injected suite observations",
    requested_actions: [{ step_id: "validate", capability: "git.integration_validate", input: validateInput,
      depends_on: [], idempotency_key: "r16-real-validation-key" }],
    mutation_plan: [{ step_id: "validate", target: facts.integration_candidate_id,
      expected_change: "Validate exact disposable candidate", input_sha256: hashExecutionInput(validateInput) }] };
  const rejected = makeAdapter(async () => assert.fail("protected validation must not dispatch"), reopened);
  await assert.rejects(rejected.execute(validationIntent, "validate"), { code: "PERMISSION_DENIED" });
  const allowedVerifier = createPiLifecycleScopeVerifier({
    getWorkstream: async ({ workstream_id }) => harness.workstreams.get(workstream_id),
    getCheckpoint: async () => null, getOperation: args => reopened.getOperation(args),
    getIntegrationCandidate: args => validationService.getCandidate(args), validationAllowed: async () => true,
  });
  const validator = createPiReliableMcpAdapter({
    resolveWorkspace: async () => null, verifyScope: allowedVerifier, queryOperation: args => reopened.getOperation(args),
    callTool: async request => {
      sends++;
      assert.equal(request.name, "dev_workspace_validate_integration");
      const outcome = await reopened.executeReconciled({
        reconciliation_key: request._meta.reconciliation_key,
        request_fingerprint_sha256: hashExecutionInput({ tool_name: request.name, arguments: request.arguments }),
        tool_name: request.name,
        resolve_workspace_scope: async () => ({ workspace_id: source.workspace_id, workstream_id: source.workstream_id }),
      }, async () => ({ content: [{ type: "text", text: JSON.stringify(await validationService.validateIntegration(request.arguments)) }] }));
      assert.equal(outcome.reconciled, false);
      throw Object.assign(new Error("fixture loses response after candidate validation"), { code: "TIMEOUT" });
    },
  });
  await assert.rejects(validator.execute(validationIntent, "validate"), { code: "TIMEOUT" });
  const cold = createDevOperationJournalService({ storageRoot: journalRoot });
  const recovered = await makeAdapter(async () => assert.fail("must not replay validation"), cold).reconcile(validationIntent, "validate");
  assert.equal(recovered.verdict, "completed");
  const verified = recovered.receipt.evidence.original_result;
  assert.equal(verified.integration_candidate_id, facts.integration_candidate_id);
  assert.equal(verified.integration_commit, source.sourceHead);
  assert.equal(verified.candidate_validation_passed, true);
  assert.equal(verified.candidate_cleanup_pending, false);
  const ready = await validationService.getCandidate({ integration_candidate_id: facts.integration_candidate_id });
  assert.equal(ready.state, "ready");
  assert.equal(ready.revision, verified.revision);
  assert.equal(ready.integration_workspace.state, "removed");
  assert.equal((await cold.status()).chain_verified, true);
  assert.equal((await cold.status()).active_operation_count, 0);
  assert.equal(sends, 2);
  assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), harness.baseHead);
});

test("R16 independent candidate evidence binds the real Git risk plan and refuses changed target or partial coverage", async t => {
  const harness = await createHarness("r16-independent-binding");
  t.after(() => harness.cleanup());
  const source = await harness.createSource({ changes: { "r16-independent.txt": "fixture\n" } });
  const journal = createDevOperationJournalService({ storageRoot: path.join(harness.root, "independent-journal") });
  const service = harness.createService({ journal });
  const candidate = await service.preflight({ workstream_id: source.workstream_id, expected_workstream_revision: 1 });
  const request = { integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision };
  const context = await service.getIndependentVerificationContext(request);
  assert.equal(context.candidate.integration_commit, source.sourceHead);
  assert.equal(context.candidate.target_head, harness.baseHead);
  assert.deepEqual(context.plan.changed_paths, ["r16-independent.txt"]);
  assert.ok(context.plan.required_suites.includes("mcp"));
  assert.ok(context.plan.required_suites.includes("mcp_tunnel"));
  assert.equal(context.execution_authorized, false);
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { createIndependentCandidateObserver } = await import("../../server/src/mcp-independent-verification-candidate.mjs");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  const workflows = [...context.plan.required_suites, "mcp_pi_postseal"].map(suite => ({
    suite, platform: "linux", workflow_sha256: "b".repeat(64),
  }));
  const policy = { repository: "owner/disposable", issuer: "fixture-issuer", max_age_ms: 60000,
    suite_workflows: workflows, additional_required: ["mcp_pi_postseal"] };
  let reads = 0;
  function envelope(identity, rows = workflows) {
    const payload = JSON.stringify({ schema_version: 1, issuer: policy.issuer, repository: policy.repository,
      candidate: identity, issued_at_ms: now - 1000, expires_at_ms: now + 1000,
      results: rows.map((row, i) => ({ ...row, commit: identity.integration_commit, run_id: 123, job_id: 1000 + i,
        run_attempt: 1, completed_at_ms: now - 2000, execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0 })) });
    return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
  }
  const make = overrides => createIndependentCandidateObserver({ integrationService: service, policy, pinnedPublicKey: publicKey,
    readEnvelope: async identity => { reads++; return envelope(identity); }, journal, clock: () => now, ...overrides });
  const result = await make()(request);
  assert.equal(result.verified, true);
  assert.equal(result.suite_count, workflows.length);
  assert.equal(result.execution_authorized, false);
  const unchanged = await service.getCandidate({ integration_candidate_id: candidate.integration_candidate_id });
  assert.equal(unchanged.state, "preflight_passed");
  assert.equal(unchanged.revision, candidate.revision);
  assert.equal(unchanged.validation_report, null);
  assert.equal(unchanged.integration_workspace.state, "not_materialized");
  const insufficient = await make({ policy: { ...policy, suite_workflows: workflows.slice(1) } })(request);
  assert.equal(insufficient.verified, false);
  assert.equal(reads, 1, "incomplete policy must not read an envelope");
  assert.equal((await make({ readEnvelope: async identity => envelope(identity, workflows.slice(1)) })(request)).code, "VERIFICATION_COVERAGE_MISMATCH");
  await assert.rejects(service.getIndependentVerificationContext({ ...request, expected_revision: 0 }), { code: "INDEPENDENT_VERIFICATION_REVISION_REQUIRED" });
  await assert.rejects(service.getIndependentVerificationContext({ ...request, required_suites: ["mcp_hermetic_core"] }));
  const before = (await journal.verify()).events.length;
  const raced = make({ readEnvelope: async identity => {
    await writeFile(path.join(harness.repositoryRoot, "target-change.txt"), "new target\n");
    await git(harness.repositoryRoot, ["add", "target-change.txt"]);
    await git(harness.repositoryRoot, ["commit", "-m", "advance target during evidence read"]);
    return envelope(identity);
  } });
  assert.equal((await raced(request)).verified, false);
  await assert.rejects(service.getIndependentVerificationContext(request), { code: "INDEPENDENT_VERIFICATION_CANDIDATE_STALE" });
  assert.equal((await journal.verify()).events.length, before);
  assert.equal((await service.getCandidate({ integration_candidate_id: candidate.integration_candidate_id })).state, "preflight_passed");
  assert.equal((await journal.status()).chain_verified, true);
});

test("R16 independent candidate evidence rechecks signed receipt at apply without treating observation as authority", async () => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { createIndependentCandidateEvidenceGate } = await import("../../server/src/mcp-independent-verification-candidate.mjs");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  let currentTime = now;
  const candidate = { integration_candidate_id: "dev_integration_20261127-010000_aabbccddeeff",
    revision: 2, state: "preflight_passed", source_head: "1".repeat(40),
    target_head: "2".repeat(40), integration_commit: "3".repeat(40) };
  const row = { suite: "all", platform: "linux", workflow_sha256: "4".repeat(64) };
  const policy = { repository: "owner/disposable", issuer: "fixture-issuer", max_age_ms: 60000,
    suite_workflows: [row], additional_required: [] };
  const plan = { required_suites: ["all"] };
  let jobId = 2;
  let reads = 0;
  const readEnvelope = async identity => {
    reads++;
    const payload = JSON.stringify({ schema_version: 1, issuer: policy.issuer, repository: policy.repository,
      candidate: identity, issued_at_ms: now - 1000, expires_at_ms: now + 1000,
      results: [{ ...row, commit: identity.integration_commit, run_id: 1, job_id: jobId,
        run_attempt: 1, completed_at_ms: now - 2000, execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0 }] });
    return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
  };
  const build = overrides => createIndependentCandidateEvidenceGate({ policy, pinnedPublicKey: publicKey,
    readEnvelope, clock: () => currentTime, ...overrides });
  const gate = build();
  const verified = await gate.reviewForValidation(candidate, plan);
  assert.equal(verified.verified, true);
  assert.equal(verified.execution_authorized, false);
  assert.equal(verified.evidence_reference.candidate_revision, candidate.revision);
  const ready = { ...candidate, revision: 6, state: "ready" };
  assert.equal((await gate.reviewForApply(ready, plan, verified.evidence_reference)).verified, true);
  assert.equal(reads, 2);
  assert.equal((await gate.reviewForApply(ready, plan)).verified, false);
  assert.equal((await gate.reviewForApply(ready, plan, { ...verified.evidence_reference, candidate_revision: 6 })).verified, false);
  assert.equal((await gate.reviewForApply(candidate, plan, verified.evidence_reference)).verified, false);
  assert.equal((await gate.reviewForValidation(candidate, { required_suites: ["mcp_hermetic_core"] })).verified, false);
  const differentPolicy = build({ policy: { ...policy, max_age_ms: 59999 } });
  assert.equal((await differentPolicy.reviewForApply(ready, plan, verified.evidence_reference)).code, "INDEPENDENT_EVIDENCE_POLICY_CHANGED");
  jobId++;
  assert.equal((await gate.reviewForApply(ready, plan, verified.evidence_reference)).code, "INDEPENDENT_EVIDENCE_RECEIPT_CHANGED");
  jobId--;
  currentTime = now + 1000;
  assert.equal((await gate.reviewForApply(ready, plan, verified.evidence_reference)).code, "VERIFICATION_RECEIPT_EXPIRED");
  assert.equal(candidate.state, "preflight_passed");
  assert.equal(ready.state, "ready");
});

test("R16 independent adoption keeps actual candidate and Journal fences without claiming local tests", async t => {
  const harness = await createHarness("r16-independent-adoption");
  t.after(() => harness.cleanup());
  const journal = createDevOperationJournalService({ storageRoot: path.join(harness.root, "independent-adoption-journal") });
  const source = await harness.createSource({ changes: { "independent-adoption.txt": "fixture\n" } });
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { createIndependentCandidateEvidenceGate } = await import("../../server/src/mcp-independent-verification-candidate.mjs");
  const { requireIndependentApplyEvidence } = await import("../../server/src/mcp-independent-verification-adoption.mjs");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  let currentTime = now;
  const rows = ["mcp", "mcp_tunnel"].map(suite => ({ suite, platform: "linux", workflow_sha256: "b".repeat(64) }));
  const policy = { repository: "owner/disposable", issuer: "fixture-issuer", max_age_ms: 60000, suite_workflows: rows, additional_required: [] };
  let envelopeAvailable = true;
  let job = 20;
  const gate = createIndependentCandidateEvidenceGate({ policy, pinnedPublicKey: publicKey, clock: () => currentTime,
    readEnvelope: async candidate => {
      if (!envelopeAvailable) throw Error("source unavailable");
      const payload = JSON.stringify({ schema_version: 1, issuer: policy.issuer, repository: policy.repository,
        candidate, issued_at_ms: now - 1000, expires_at_ms: now + 60000 - 1000,
        results: rows.map((row, i) => ({ ...row, commit: candidate.integration_commit, run_id: 10, job_id: job + i,
          run_attempt: 1, completed_at_ms: now - 2000, execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0 })) });
      return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
    },
  });
  const service = harness.createService({ journal, independentEvidenceGate: gate,
    clock: () => new Date(currentTime), validationRunner: async () => assert.fail("independent adoption must not run local tests") });
  const candidate = await service.preflight({ workstream_id: source.workstream_id, expected_workstream_revision: 1 });
  const req = { integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision };
  envelopeAvailable = false;
  await assert.rejects(service.validateIntegration(req), { code: "INDEPENDENT_VALIDATION_EVIDENCE_REQUIRED" });
  assert.equal((await service.getCandidate({ integration_candidate_id: req.integration_candidate_id })).state, "preflight_passed");
  envelopeAvailable = true;
  const context = await service.getIndependentVerificationContext(req);
  const ready = await service.validateIntegration(req);
  assert.equal(ready.state, "ready");
  assert.equal(ready.integration_workspace.state, "removed");
  assert.equal(ready.integration_workspace.cleanup_pending, false);
  assert.equal(ready.validation_report.evidence_source, "independent_signed");
  assert.deepEqual(ready.validation_report.suites, []);
  assert.equal(ready.validation_report.verification_manifest.independent_results.length, 2);
  assert.equal(ready.validation_report.verification_manifest.passed, true);
  const events = (await journal.verify()).events;
  assert.equal(events.some(e => e.operation_type === "test_evidence"), false);
  const proof = await gate.reviewForApply(ready, context.plan, ready.validation_report.evidence_reference);
  assert.equal(requireIndependentApplyEvidence({ candidate: ready, plan: context.plan, proof, events, nowMs: now }), true);
  const operation = ready.validation_report.independent_validation_operation_id;
  assert.throws(() => requireIndependentApplyEvidence({ candidate: ready, plan: context.plan, proof,
    events: events.filter(e => e.operation_id !== operation || e.stage !== "operation_completed"), nowMs: now }),
    { code: "INDEPENDENT_APPLY_JOURNAL_EVIDENCE_REQUIRED" });
  const apply = { integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision };
  const noVerifier = harness.createService({ journal });
  await assert.rejects(noVerifier.integrate(apply), /INDEPENDENT_APPLY_EVIDENCE_REQUIRED/);
  job++;
  await assert.rejects(service.integrate(apply), /INDEPENDENT_APPLY_EVIDENCE_REQUIRED/);
  job--;
  currentTime = now + 60000;
  await assert.rejects(service.integrate(apply), /INDEPENDENT_APPLY_EVIDENCE_REQUIRED/);
  assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), harness.baseHead);
  currentTime = now;
  const integrated = await service.integrate(apply);
  assert.equal(integrated.state, "integrated");
  assert.equal((await git(harness.repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(), ready.integration_commit);
  assert.equal((await journal.status()).chain_verified, true);
});

test("R16 independent adoption recovers producer exit with active worktree or before and after durable validation terminal", async () => {
  for (const phase of ["active-worktree","before-terminal","after-terminal"]) {
    const completed=phase==="after-terminal", active=phase==="active-worktree";
    const harness = await createHarness(active ? "r16 interruption" : "r16-independent-interruption");
    try {
      const runtime = path.join(harness.root, "runtime");
      const journalRoot = path.join(harness.root, "independent-interruption-journal");
      const journal = createDevOperationJournalService({ storageRoot: journalRoot });
      const source = await harness.createSource({ changes: { "independent-interruption.txt": "fixture\n" } });
      const service = harness.createService({ journal });
      const candidate = await service.preflight({ workstream_id: source.workstream_id, expected_workstream_revision: 1 });
      const request = { integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision };
      const worker = `
        import {generateKeyPairSync,sign} from 'node:crypto';
        import {execFile} from 'node:child_process';
        import {promisify} from 'node:util';
        import path from 'node:path';
        import {createDevIntegrationService} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-integration-tools.mjs")).href)};
        import {createIndependentCandidateEvidenceGate} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-independent-verification-candidate.mjs")).href)};
        import {createDevOperationJournalService} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-development-journal-tools.mjs")).href)};
        import {fingerprintMcpMutationRequest} from ${JSON.stringify(pathToFileURL(path.resolve("server/src/mcp-operation-reconciliation-context.mjs")).href)};
        const journal=createDevOperationJournalService({storageRoot:${JSON.stringify(journalRoot)}});
        const {publicKey,privateKey}=generateKeyPairSync('ed25519');
        const rows=['mcp','mcp_tunnel'].map(suite=>({suite,platform:'linux',workflow_sha256:'b'.repeat(64)}));
        const policy={repository:'owner/disposable',issuer:'fixture-issuer',max_age_ms:60000,suite_workflows:rows,additional_required:[]};
        const gate=createIndependentCandidateEvidenceGate({policy,pinnedPublicKey:publicKey,readEnvelope:async candidate=>{
          const now=Date.now();
          const payload=JSON.stringify({schema_version:1,issuer:policy.issuer,repository:policy.repository,
            candidate,issued_at_ms:now-1000,expires_at_ms:now+30000,
            results:rows.map((row,i)=>({...row,commit:candidate.integration_commit,run_id:10,job_id:20+i,
              run_attempt:1,completed_at_ms:now-2000,execution_ok:true,passed:true,timed_out:false,skipped:false,exit_code:0}))});
          return {payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64url')};
        }});
        const integrationPath=path.join(${JSON.stringify(path.join(harness.root,".writer-workbench-integrations"))},${JSON.stringify(candidate.integration_candidate_id)});
        const exec=promisify(execFile);
        let headReads=0;
        const gitRunner=async(args,{cwd,timeout=60000,maxBuffer=524288,allowFailure=false,extraEnv={}}={})=>{
          try{
            const {stdout,stderr}=await exec(process.platform==='win32'?'git.exe':'git',
              ['--no-pager','-c','core.fsmonitor=false',...args],
              {cwd,timeout,maxBuffer,windowsHide:true,shell:false,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_PAGER:'cat',...extraEnv}});
            // The second actual HEAD inspection occurs after the durable
            // testing transition, before any cleanup or report publication.
            if(${active}&&cwd===integrationPath&&args.join(' ')==='rev-parse --verify HEAD'&&++headReads===2)
              process.exit(77);
            return {stdout,stderr,exit_code:0};
          }catch(error){
            if(allowFailure&&Number.isInteger(error.code))return {stdout:String(error.stdout??''),stderr:String(error.stderr??''),exit_code:error.code};
            throw error;
          }
        };
        const service=createDevIntegrationService({
          ...(${active}?{gitRunner}:{}),
          repositoryRoot:${JSON.stringify(harness.repositoryRoot)},
          registryPath:${JSON.stringify(path.join(runtime,"integration_registry.json"))},
          registryLockPath:${JSON.stringify(path.join(runtime,"integration_registry.lock"))},
          applyLockPath:${JSON.stringify(path.join(runtime,"integration_apply.lock"))},
          integrationRootPath:${JSON.stringify(path.join(harness.root,".writer-workbench-integrations"))},
          workstreamReader:async()=> (${JSON.stringify(harness.workstreams.get(source.workstream_id))}),
          workspaceReader:async()=> (${JSON.stringify({...harness.workspaces.get(source.workspace_id),
            healthy:true,registered_branch_matches:true,registry_mapping_consistent:true,git_worktree_head:source.sourceHead})}),
          independentEvidenceGate:gate,
          validationRunner:async()=>{throw Error('no local tests');},
          journal:{...journal,complete:async(...args)=>{
            if(${completed}) await journal.complete(...args);
            process.exit(77);
          }},
        });
        const input=${JSON.stringify(request)};
        await journal.executeReconciled({reconciliation_key:'independent-interruption-fixture',tool_name:'dev_workspace_validate_integration',
          request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_validate_integration',input)},async()=>service.validateIntegration(input));
      `;
      const child=spawn(process.execPath,["--input-type=module","-e",worker],{cwd:path.resolve("."),windowsHide:true,stdio:"pipe"});
      let stderr="";
      child.stderr.on("data",data=>{stderr+=data;});
      const exit=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve);});
      assert.equal(exit,77,stderr);
      const current=await service.getCandidate({integration_candidate_id:candidate.integration_candidate_id});
      assert.equal(current.state,active?"testing":"validated");
      assert.equal(current.integration_workspace.state,active?"active":"removed");
      const integrationPath=path.join(harness.root,".writer-workbench-integrations",current.integration_candidate_id);
      if(active){
        assert.equal(current.validation_report,null);
        assert.equal((await git(integrationPath,["rev-parse","HEAD"])).stdout.trim(),current.integration_commit);
        assert.equal((await git(integrationPath,["status","--porcelain=v1","--untracked-files=all"])).stdout,"");
        const registrations=(await git(harness.repositoryRoot,["worktree","list","--porcelain"])).stdout;
        assert(registrations.includes("locked Writer Workbench integration "+current.integration_candidate_id));
      }
      const before=await journal.verify();
      const start=before.events.find(e=>e.operation_type==="integration_validation"&&e.stage==="operation_started");
      assert.equal(before.events.some(e=>e.operation_id===start.operation_id&&e.stage==="operation_completed"),completed);
      const input={integration_candidate_id:current.integration_candidate_id,expected_revision:current.revision,
        operation_id:start.operation_id,expected_start_hash:start.event_hash};
      await assert.rejects(service.recoverInterruptedValidation({...input,expected_start_hash:"0".repeat(64)}),/BINDING_MISMATCH/);
      const liveOwner=harness.createService({journal:{...journal,verify:async()=>{
        const actual=await journal.verify();
        return {...actual,events:actual.events.map(e=>e.stage==="operation_started"
          ? {...e,diagnostic:{...e.diagnostic,owner_pid:process.pid}}:e)};
      }}});
      await assert.rejects(liveOwner.recoverInterruptedValidation(input),/OWNER_ACTIVE_OR_UNKNOWN/);
      assert.equal((await journal.verify()).head.latest_event_hash,before.head.latest_event_hash);
      if(active){
        await git(harness.repositoryRoot,["worktree","unlock",integrationPath]);
        await git(harness.repositoryRoot,["worktree","lock","--reason","different owner",integrationPath]);
        await assert.rejects(service.recoverInterruptedValidation(input),/INDEPENDENT_RECOVERY_WORKTREE_OWNERSHIP_MISMATCH/);
        assert.equal((await journal.verify()).head.latest_event_hash,before.head.latest_event_hash);
        assert.equal((await service.getCandidate({integration_candidate_id:current.integration_candidate_id})).revision,current.revision);
        await git(harness.repositoryRoot,["worktree","unlock",integrationPath]);
        await git(harness.repositoryRoot,["worktree","lock","--reason","Writer Workbench integration "+current.integration_candidate_id,integrationPath]);
        const unexpected=path.join(integrationPath,"unexpected-untracked.txt");
        await writeFile(unexpected,"preserve this data");
        await assert.rejects(service.recoverInterruptedValidation(input),/VALIDATION_RECOVERY_DIRTY_WORKTREE/);
        assert.equal(await readFile(unexpected,"utf8"),"preserve this data");
        assert.equal((await journal.verify()).head.latest_event_hash,before.head.latest_event_hash);
        assert.equal((await service.getCandidate({integration_candidate_id:current.integration_candidate_id})).revision,current.revision);
        await rm(unexpected);
      }
      const retired=await service.recoverInterruptedValidation(input);
      assert.equal(retired.integration_workspace.state,"removed");
      assert.equal(retired.integration_workspace.cleanup_pending,false);
      await assert.rejects(access(integrationPath),error=>error.code==="ENOENT");
      const remaining=(await git(harness.repositoryRoot,["worktree","list","--porcelain"])).stdout;
      assert(!remaining.includes("locked Writer Workbench integration "+current.integration_candidate_id));
      assert.equal(retired.state,"failed");
      assert.equal(retired.failure_reason.code,"INDEPENDENT_VALIDATION_INTERRUPTED");
      assert.equal(retired.validation_report.passed,false);
      assert.deepEqual(retired.validation_report.prior_validation_report,current.validation_report);
      const after=await journal.verify();
      assert.equal(after.dangling_operations.length,0);
      assert.equal(after.active_operations.length,0);
      assert.deepEqual(after.events.slice(0,before.events.length),before.events);
      const recovered=after.events.slice(before.events.length);
      assert.equal(recovered.length,completed?1:2);
      assert.ok(recovered.every(e=>e.stage==="operation_recovered"&&e.result.passed===false&&e.result.independent_interruption===true));
      assert.equal((await journal.status()).health,"healthy");
      await service.recoverInterruptedValidation({...input,expected_revision:retired.revision});
      assert.equal((await journal.verify()).head.latest_event_hash,after.head.latest_event_hash);
      assert.equal((await git(harness.repositoryRoot,["rev-parse","HEAD"])).stdout.trim(),harness.baseHead);
      const successor=await service.preflight({workstream_id:source.workstream_id,expected_workstream_revision:1});
      assert.notEqual(successor.integration_candidate_id,retired.integration_candidate_id);
      assert.equal(successor.state,"preflight_passed");
    } finally { await harness.cleanup(); }
  }
});
