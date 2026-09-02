import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  DEV_INTEGRATION_SCHEMA_VERSION,
  createDevIntegrationService,
} from "../../server/src/mcp-development-integration-tools.mjs";

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

  async function createSource({ changes, dependsOn = [], base = baseHead, message = "source commit" }) {
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
      depends_on: [...dependsOn],
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

  const validationRunner = async (integrationPath) => {
    const status = (await git(integrationPath, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout;
    assert.equal(status, "");
    return [
      { suite: "mcp", execution_ok: true, passed: true, timed_out: false, exit_code: 0, duration_ms: 1 },
      { suite: "mcp_tunnel", execution_ok: true, passed: true, timed_out: false, exit_code: 0, duration_ms: 1 },
    ];
  };

  function createService() {
    return createDevIntegrationService({
      repositoryRoot,
      registryPath: path.join(runtimeRoot, "integration_registry.json"),
      registryLockPath: path.join(runtimeRoot, "integration_registry.lock"),
      applyLockPath: path.join(runtimeRoot, "integration_apply.lock"),
      integrationRootPath: integrationRoot,
      workstreamReader,
      workspaceReader,
      validationRunner,
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
    assert.equal(ready.integration_workspace.state, "removed");
    assert.equal(ready.integration_workspace.cleanup_pending, false);

    const dirtyPath = path.join(harness.repositoryRoot, "unrelated-dirty.txt");
    await writeFile(dirtyPath, "preserve me\n", "utf8");
    const dirtyHash = await sha256(dirtyPath);
    const integrated = await service.integrate({
      integration_candidate_id: ready.integration_candidate_id,
      expected_revision: ready.revision,
    });
    assert.equal(integrated.state, "integrated");
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

console.log("MCP development controlled integration runtime tests passed.");
console.log("- persistent candidate identity, exact validation, and cleanup: passed");
console.log("- ancestry, fast-forward, merge-tree, merge commit, and conflict rejection: passed");
console.log("- dependency, serial race, source/dependency stale validation: passed");
console.log("- dirty-main carry-forward and overlap rejection: passed");
