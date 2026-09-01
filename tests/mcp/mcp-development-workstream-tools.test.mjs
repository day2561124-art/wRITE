import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import {
  DEV_WORKSTREAM_MAX_DEPENDENCIES,
  DEV_WORKSTREAM_MAX_LABEL_CHARACTERS,
  DEV_WORKSTREAM_MAX_METADATA_PROPERTIES,
  DEV_WORKSTREAM_MAX_SCOPE_ENTRIES,
  DEV_WORKSTREAM_SCHEMA_VERSION,
  DEV_WORKSTREAM_WORKSPACE_ID,
  createDevWorkstreamRegistryService,
} from "../../server/src/mcp-development-workstream-tools.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const TEST_HEAD = "1234567890abcdef1234567890abcdef12345678";

async function createHarness(name) {
  const root = path.join(
    projectRoot,
    "tests",
    ".tmp",
    `dev-workstream-${name}-${process.pid}-${randomUUID().slice(0, 8)}`,
  );
  await mkdir(root, { recursive: true });
  const registryPath = path.join(root, "workstream_registry.json");
  const service = createDevWorkstreamRegistryService({
    registryPath,
    headReader: async () => TEST_HEAD,
  });
  return {
    root,
    registryPath,
    service,
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function createGitHarness(name) {
  const root = path.join(projectRoot, "tests", ".tmp", `dev-worktree-${name}-${process.pid}-${randomUUID().slice(0, 8)}`);
  const repositoryRoot = path.join(root, "repo");
  const worktreeRootPath = path.join(root, ".writer-workbench-worktrees");
  const registryPath = path.join(root, "workstream_registry.json");
  await mkdir(repositoryRoot, { recursive: true });
  const git = process.platform === "win32" ? "git.exe" : "git";
  const runGit = async (args, options = {}) => execFileAsync(git, args, {
    cwd: options.cwd ?? repositoryRoot,
    windowsHide: true,
    timeout: options.timeout ?? 30_000,
    maxBuffer: 256 * 1024,
    shell: false,
  });
  await runGit(["init", "-b", "main"]);
  await runGit(["config", "user.email", "phase2b@example.invalid"]);
  await runGit(["config", "user.name", "Phase2B Test"]);
  await writeFile(path.join(repositoryRoot, "tracked.txt"), "base\n", "utf8");
  await runGit(["add", "tracked.txt"]);
  await runGit(["commit", "-m", "base"]);
  const { stdout } = await runGit(["rev-parse", "HEAD"]);
  const head = String(stdout).trim().toLowerCase();
  const service = createDevWorkstreamRegistryService({
    registryPath,
    headReader: async () => head,
    repositoryRoot,
    worktreeRootPath,
    gitRunner: runGit,
  });
  return {
    root,
    repositoryRoot,
    worktreeRootPath,
    registryPath,
    head,
    runGit,
    service,
    async cleanup() { await rm(root, { recursive: true, force: true }); },
  };
}

async function assertRejectsMessage(promise, pattern) {
  await assert.rejects(promise, pattern);
}

test("persistent workstream lifecycle captures server HEAD and survives service recreation", async () => {
  const harness = await createHarness("lifecycle");
  try {
    const created = await harness.service.begin({
      label: "Phase 2A registry",
      purpose: "primary",
      declared_scope: ["server/src", "tests/mcp"],
      metadata: { owner: "mcp", priority: 2, audited: true },
    });
    assert.match(created.workstream_id, /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u);
    assert.equal(created.schema_version, DEV_WORKSTREAM_SCHEMA_VERSION);
    assert.equal(created.revision, 1);
    assert.equal(created.base_head, TEST_HEAD);
    assert.equal(created.mode, "shared");
    assert.equal(created.workspace_id, DEV_WORKSTREAM_WORKSPACE_ID);
    assert.equal(created.state, "active");
    assert.equal(created.registry_revision, 1);

    const recreated = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => TEST_HEAD,
    });
    const fetched = await recreated.get({ workstream_id: created.workstream_id });
    assert.equal(fetched.workstream_id, created.workstream_id);
    assert.equal(fetched.base_head, TEST_HEAD);
    assert.equal(fetched.revision, 1);

    const listed = await recreated.list({ lifecycle: "active" });
    assert.equal(listed.total, 1);
    assert.equal(listed.workstreams[0].workstream_id, created.workstream_id);
    assert.equal(listed.registry_health, "healthy");
    assert.equal(listed.storage_health, "healthy");

    const paused = await recreated.update({
      workstream_id: created.workstream_id,
      expected_revision: 1,
      state: "paused",
    });
    assert.equal(paused.state, "paused");
    assert.equal(paused.revision, 2);

    const resumed = await recreated.update({
      workstream_id: created.workstream_id,
      expected_revision: 2,
      state: "active",
    });
    assert.equal(resumed.state, "active");
    assert.equal(resumed.revision, 3);

    const blocked = await recreated.update({
      workstream_id: created.workstream_id,
      expected_revision: 3,
      state: "blocked",
    });
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.revision, 4);

    const completed = await recreated.end({
      workstream_id: created.workstream_id,
      expected_revision: 4,
      outcome: "completed",
    });
    assert.equal(completed.state, "completed");
    assert.equal(completed.revision, 5);

    await assertRejectsMessage(
      recreated.update({ workstream_id: created.workstream_id, state: "active" }),
      /Terminal workstreams cannot be updated or restarted/u,
    );
    await assertRejectsMessage(
      recreated.end({ workstream_id: created.workstream_id, outcome: "abandoned" }),
      /already terminal/u,
    );

    const afterReload = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => TEST_HEAD,
    });
    const terminal = await afterReload.get({ workstream_id: created.workstream_id });
    assert.equal(terminal.state, "completed");
    const terminalList = await afterReload.list({ lifecycle: "terminal" });
    assert.equal(terminalList.total, 1);
  } finally {
    await harness.cleanup();
  }
});

test("dependency validation rejects missing, self, and cyclic dependencies", async () => {
  const harness = await createHarness("dependencies");
  try {
    const missing = "dev_workstream_20260902-001000_aaaaaaaaaaaa";
    await assertRejectsMessage(
      harness.service.begin({ label: "missing dependency", depends_on: [missing] }),
      /does not exist/u,
    );

    const parent = await harness.service.begin({ label: "parent", purpose: "primary" });
    const child = await harness.service.begin({
      label: "child",
      purpose: "candidate",
      parent_workstream_id: parent.workstream_id,
      depends_on: [parent.workstream_id],
    });
    assert.equal(child.parent_workstream_id, parent.workstream_id);
    assert.deepEqual(child.depends_on, [parent.workstream_id]);

    await assertRejectsMessage(
      harness.service.update({
        workstream_id: child.workstream_id,
        expected_revision: child.revision,
        depends_on: [child.workstream_id],
      }),
      /cannot depend on itself/u,
    );

    await assertRejectsMessage(
      harness.service.update({
        workstream_id: parent.workstream_id,
        expected_revision: parent.revision,
        depends_on: [child.workstream_id],
      }),
      /dependency cycle detected/u,
    );
  } finally {
    await harness.cleanup();
  }
});

test("declared scope overlap is advisory and does not block parallel workstreams", async () => {
  const harness = await createHarness("scope-overlap");
  try {
    const first = await harness.service.begin({
      label: "first",
      declared_scope: ["server/src/runtime"],
    });
    const second = await harness.service.begin({
      label: "second",
      purpose: "experiment",
      declared_scope: ["server/src/runtime", "tests/mcp"],
    });
    assert.equal(second.potential_overlap, true);
    assert.deepEqual(second.overlap_workstream_ids, [first.workstream_id]);
    const fetchedFirst = await harness.service.get({ workstream_id: first.workstream_id });
    assert.equal(fetchedFirst.potential_overlap, true);
    assert.deepEqual(fetchedFirst.overlap_workstream_ids, [second.workstream_id]);
  } finally {
    await harness.cleanup();
  }
});

test("server-owned base_head and storage fields cannot be forged and isolated mode is reserved", async () => {
  const harness = await createHarness("security-input");
  try {
    await assertRejectsMessage(
      harness.service.begin({ label: "forged", base_head: "f".repeat(40) }),
      /does not accept base_head/u,
    );
    for (const forbidden of [
      "command", "args", "executable", "cwd", "env", "shell", "storagePath",
      "registryPath", "worktreePath", "branch", "refspec",
    ]) {
      await assertRejectsMessage(
        harness.service.begin({ label: "forbidden", [forbidden]: "x" }),
        new RegExp(`does not accept ${forbidden}`, "u"),
      );
    }
    await assertRejectsMessage(
      harness.service.begin({ label: "isolated", mode: "isolated" }),
      /dev_workspace_create_isolated|controlled Phase 2B/iu,
    );
  } finally {
    await harness.cleanup();
  }
});

test("bounds reject oversized labels, dependencies, scope, metadata, and unknown update fields", async () => {
  const harness = await createHarness("bounds");
  try {
    await assertRejectsMessage(
      harness.service.begin({ label: "x".repeat(DEV_WORKSTREAM_MAX_LABEL_CHARACTERS + 1) }),
      /label must contain/u,
    );
    const fakeIds = Array.from({ length: DEV_WORKSTREAM_MAX_DEPENDENCIES + 1 }, (_, index) => (
      `dev_workstream_20260902-0010${String(index % 10)}_${String(index).padStart(12, "a").slice(-12)}`
        .replace(/[^a-f0-9_-]/gu, "a")
    ));
    await assertRejectsMessage(
      harness.service.begin({ label: "too many deps", depends_on: fakeIds }),
      /at most 16 items/u,
    );
    await assertRejectsMessage(
      harness.service.begin({
        label: "too much scope",
        declared_scope: Array.from({ length: DEV_WORKSTREAM_MAX_SCOPE_ENTRIES + 1 }, (_, i) => `scope-${i}`),
      }),
      /at most 64 items/u,
    );
    await assertRejectsMessage(
      harness.service.begin({
        label: "too much metadata",
        metadata: Object.fromEntries(
          Array.from({ length: DEV_WORKSTREAM_MAX_METADATA_PROPERTIES + 1 }, (_, i) => [`k${i}`, i]),
        ),
      }),
      /at most 16 properties/u,
    );

    const created = await harness.service.begin({ label: "valid" });
    await assertRejectsMessage(
      harness.service.update({ workstream_id: created.workstream_id, base_head: TEST_HEAD }),
      /does not accept base_head/u,
    );
    await assertRejectsMessage(
      harness.service.update({ workstream_id: created.workstream_id }),
      /requires at least one mutable field/u,
    );
  } finally {
    await harness.cleanup();
  }
});

test("concurrent creates are serialized across service instances without lost records", async () => {
  const harness = await createHarness("concurrent-create");
  try {
    const peer = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => TEST_HEAD,
    });
    const [a, b] = await Promise.all([
      harness.service.begin({ label: "parallel-a", purpose: "experiment" }),
      peer.begin({ label: "parallel-b", purpose: "candidate" }),
    ]);
    assert.notEqual(a.workstream_id, b.workstream_id);
    const listed = await harness.service.list({});
    assert.equal(listed.total, 2);
    assert.deepEqual(
      new Set(listed.workstreams.map((item) => item.workstream_id)),
      new Set([a.workstream_id, b.workstream_id]),
    );
    assert.equal(listed.registry_revision, 2);
  } finally {
    await harness.cleanup();
  }
});

test("same-workstream stale revision races reject one writer and unguarded distinct updates do not lose data", async () => {
  const harness = await createHarness("concurrent-update");
  try {
    const peer = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => TEST_HEAD,
    });
    const created = await harness.service.begin({ label: "race" });
    const race = await Promise.allSettled([
      harness.service.update({
        workstream_id: created.workstream_id,
        expected_revision: 1,
        state: "paused",
      }),
      peer.update({
        workstream_id: created.workstream_id,
        expected_revision: 1,
        state: "blocked",
      }),
    ]);
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(race.filter((item) => item.status === "rejected").length, 1);
    assert.match(
      race.find((item) => item.status === "rejected").reason.message,
      /stale workstream revision/u,
    );
    const afterRace = await harness.service.get({ workstream_id: created.workstream_id });
    assert.equal(afterRace.revision, 2);

    await Promise.all([
      harness.service.update({ workstream_id: created.workstream_id, label: "renamed" }),
      peer.update({ workstream_id: created.workstream_id, metadata: { lane: "phase2a" } }),
    ]);
    const finalRecord = await harness.service.get({ workstream_id: created.workstream_id });
    assert.equal(finalRecord.label, "renamed");
    assert.deepEqual(finalRecord.metadata, { lane: "phase2a" });
    assert.equal(finalRecord.revision, 4);
  } finally {
    await harness.cleanup();
  }
});

test("malformed or checksum-corrupt registry fails closed and is not overwritten", async () => {
  const harness = await createHarness("corruption");
  try {
    const created = await harness.service.begin({ label: "healthy" });
    const healthyRaw = await readFile(harness.registryPath, "utf8");
    const malformed = healthyRaw.slice(0, Math.max(1, Math.floor(healthyRaw.length / 2)));
    await writeFile(harness.registryPath, malformed, "utf8");
    await assertRejectsMessage(
      harness.service.get({ workstream_id: created.workstream_id }),
      /malformed JSON/u,
    );
    await assertRejectsMessage(
      harness.service.begin({ label: "must not overwrite malformed storage" }),
      /malformed JSON/u,
    );
    assert.equal(await readFile(harness.registryPath, "utf8"), malformed);

    await writeFile(harness.registryPath, healthyRaw, "utf8");
    const parsed = JSON.parse(healthyRaw);
    parsed.workstreams[0].label = "externally modified without checksum update";
    const checksumCorrupt = `${JSON.stringify(parsed, null, 2)}\n`;
    await writeFile(harness.registryPath, checksumCorrupt, "utf8");
    await assertRejectsMessage(
      harness.service.list({}),
      /checksum mismatch/u,
    );
    await assertRejectsMessage(
      harness.service.update({ workstream_id: created.workstream_id, label: "blocked write" }),
      /checksum mismatch/u,
    );
    assert.equal(await readFile(harness.registryPath, "utf8"), checksumCorrupt);
  } finally {
    await harness.cleanup();
  }
});

test("status reports bounded counts, storage health, current HEAD, and local base divergence only", async () => {
  const harness = await createHarness("status");
  try {
    const empty = await harness.service.status({});
    assert.equal(empty.registry_health, "healthy");
    assert.equal(empty.storage_health, "not_initialized");
    assert.equal(empty.current_repository_head, TEST_HEAD);
    assert.equal(empty.total_workstream_count, 0);
    assert.equal(empty.authoritative_remote_status_included, false);
    assert.equal(empty.tracking_ref_used_as_authority, false);

    const active = await harness.service.begin({ label: "active" });
    const paused = await harness.service.begin({ label: "paused" });
    const blocked = await harness.service.begin({ label: "blocked" });
    const terminal = await harness.service.begin({ label: "terminal" });
    await harness.service.update({ workstream_id: paused.workstream_id, state: "paused" });
    await harness.service.update({ workstream_id: blocked.workstream_id, state: "blocked" });
    await harness.service.end({ workstream_id: terminal.workstream_id, outcome: "abandoned" });

    const status = await harness.service.status({});
    assert.equal(status.active_workstream_count, 1);
    assert.equal(status.paused_workstream_count, 1);
    assert.equal(status.blocked_workstream_count, 1);
    assert.equal(status.terminal_workstream_count, 1);
    assert.equal(status.total_workstream_count, 4);
    assert.equal(status.active_workstreams[0].workstream_id, active.workstream_id);
    assert.equal(status.active_workstreams[0].base_head_differs_from_current_head, false);
  } finally {
    await harness.cleanup();
  }
});

test("controlled isolated worktree create is server-owned, locked, persistent, and removable after terminal", async () => {
  const harness = await createGitHarness("lifecycle");
  try {
    const workstream = await harness.service.begin({ label: "phase2b isolated" });
    const isolated = await harness.service.createIsolated({
      workstream_id: workstream.workstream_id,
      expected_workstream_revision: workstream.revision,
    });
    assert.match(isolated.workspace_id, /^dev_workspace_[a-f0-9]{24}$/u);
    assert.equal(isolated.workspace_type, "isolated_worktree");
    assert.equal(isolated.state, "active");
    assert.equal(isolated.base_head, harness.head);
    assert.equal(isolated.git_worktree_head, harness.head);
    assert.equal(isolated.locked, true);
    assert.equal(isolated.branch_name, `dev-ws/${isolated.workspace_id.slice("dev_workspace_".length)}`);
    assert.equal(isolated.worktree_relative_path, `../.writer-workbench-worktrees/${isolated.workspace_id}`);
    assert.equal(isolated.main_uncommitted_changes_copied, false);

    const fetched = await harness.service.getWorkspace({ workspace_id: isolated.workspace_id });
    assert.equal(fetched.healthy, true);
    assert.equal(fetched.dirty, false);
    assert.equal(fetched.filesystem_path_exists, true);
    assert.equal(fetched.git_worktree_mapping_exists, true);
    assert.equal(fetched.registered_branch_matches, true);
    assert.equal(fetched.locked, true);

    const recreated = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => harness.head,
      repositoryRoot: harness.repositoryRoot,
      worktreeRootPath: harness.worktreeRootPath,
      gitRunner: harness.runGit,
    });
    const afterReload = await recreated.getWorkspace({ workspace_id: isolated.workspace_id });
    assert.equal(afterReload.healthy, true);
    assert.equal(afterReload.locked, true);

    const ended = await recreated.end({
      workstream_id: workstream.workstream_id,
      expected_revision: isolated.workstream_revision,
      outcome: "completed",
    });
    const removed = await recreated.removeIsolated({
      workspace_id: isolated.workspace_id,
      expected_workstream_revision: ended.revision,
    });
    assert.equal(removed.state, "removed");
    assert.equal(removed.healthy, true);
    const history = await recreated.get({ workstream_id: workstream.workstream_id });
    assert.equal(history.state, "completed");
    assert.equal(history.workspace.workspace_id, isolated.workspace_id);
    assert.equal(history.workspace.state, "removed");
  } finally {
    await harness.cleanup();
  }
});

test("dirty main does not block isolated create and uncommitted main content is not copied", async () => {
  const harness = await createGitHarness("dirty-main");
  try {
    await writeFile(path.join(harness.repositoryRoot, "tracked.txt"), "dirty-main\n", "utf8");
    await writeFile(path.join(harness.repositoryRoot, "untracked-main.txt"), "main-only\n", "utf8");
    const workstream = await harness.service.begin({ label: "dirty main create" });
    const isolated = await harness.service.createIsolated({ workstream_id: workstream.workstream_id });
    const absolute = path.join(harness.worktreeRootPath, isolated.workspace_id);
    assert.equal(await readFile(path.join(absolute, "tracked.txt"), "utf8"), "base\n");
    await assert.rejects(readFile(path.join(absolute, "untracked-main.txt"), "utf8"), /ENOENT/u);
    await harness.service.end({ workstream_id: workstream.workstream_id, outcome: "abandoned" });
    await harness.service.removeIsolated({ workspace_id: isolated.workspace_id });
  } finally {
    await harness.cleanup();
  }
});

test("terminal create, duplicate create, stale revision, and dirty removal fail closed", async () => {
  const harness = await createGitHarness("guards");
  try {
    const terminal = await harness.service.begin({ label: "terminal" });
    await harness.service.end({ workstream_id: terminal.workstream_id, outcome: "completed" });
    await assertRejectsMessage(
      harness.service.createIsolated({ workstream_id: terminal.workstream_id }),
      /Terminal workstreams/u,
    );

    const active = await harness.service.begin({ label: "active" });
    await assertRejectsMessage(
      harness.service.createIsolated({ workstream_id: active.workstream_id, expected_workstream_revision: 99 }),
      /stale workstream revision/u,
    );
    const isolated = await harness.service.createIsolated({ workstream_id: active.workstream_id });
    await assertRejectsMessage(
      harness.service.createIsolated({ workstream_id: active.workstream_id }),
      /already has an isolated workspace/u,
    );
    await harness.service.end({ workstream_id: active.workstream_id, outcome: "completed" });
    const absolute = path.join(harness.worktreeRootPath, isolated.workspace_id);
    await writeFile(path.join(absolute, "untracked.txt"), "preserve\n", "utf8");
    await assertRejectsMessage(
      harness.service.removeIsolated({ workspace_id: isolated.workspace_id }),
      /Dirty isolated worktree cannot be removed/u,
    );
    const stillThere = await harness.service.getWorkspace({ workspace_id: isolated.workspace_id });
    assert.equal(stillThere.filesystem_path_exists, true);
    assert.equal(stillThere.untracked.includes("untracked.txt"), true);
    await rm(path.join(absolute, "untracked.txt"));
    await harness.service.removeIsolated({ workspace_id: isolated.workspace_id });
  } finally {
    await harness.cleanup();
  }
});

test("same-workstream concurrent isolated create yields exactly one workspace", async () => {
  const harness = await createGitHarness("concurrency");
  try {
    const workstream = await harness.service.begin({ label: "race isolated" });
    const peer = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => harness.head,
      repositoryRoot: harness.repositoryRoot,
      worktreeRootPath: harness.worktreeRootPath,
      gitRunner: harness.runGit,
    });
    const race = await Promise.allSettled([
      harness.service.createIsolated({ workstream_id: workstream.workstream_id, expected_workstream_revision: 1 }),
      peer.createIsolated({ workstream_id: workstream.workstream_id, expected_workstream_revision: 1 }),
    ]);
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(race.filter((item) => item.status === "rejected").length, 1);
    const list = await harness.service.listWorkspaces({ workstream_id: workstream.workstream_id });
    assert.equal(list.total, 1);
    const workspace = list.workspaces[0];
    await harness.service.end({ workstream_id: workstream.workstream_id, outcome: "abandoned" });
    await harness.service.removeIsolated({ workspace_id: workspace.workspace_id });
  } finally {
    await harness.cleanup();
  }
});

test("different workstreams can concurrently create collision-free isolated worktrees", async () => {
  const harness = await createGitHarness("parallel-distinct");
  try {
    const first = await harness.service.begin({ label: "parallel first" });
    const second = await harness.service.begin({ label: "parallel second" });
    const peer = createDevWorkstreamRegistryService({
      registryPath: harness.registryPath,
      headReader: async () => harness.head,
      repositoryRoot: harness.repositoryRoot,
      worktreeRootPath: harness.worktreeRootPath,
      gitRunner: harness.runGit,
    });
    const [a, b] = await Promise.all([
      harness.service.createIsolated({ workstream_id: first.workstream_id }),
      peer.createIsolated({ workstream_id: second.workstream_id }),
    ]);
    assert.notEqual(a.workspace_id, b.workspace_id);
    assert.notEqual(a.branch_name, b.branch_name);
    assert.notEqual(a.worktree_relative_path, b.worktree_relative_path);
    assert.equal((await harness.service.getWorkspace({ workspace_id: a.workspace_id })).healthy, true);
    assert.equal((await harness.service.getWorkspace({ workspace_id: b.workspace_id })).healthy, true);
    await harness.service.end({ workstream_id: first.workstream_id, outcome: "abandoned" });
    await harness.service.end({ workstream_id: second.workstream_id, outcome: "abandoned" });
    await harness.service.removeIsolated({ workspace_id: a.workspace_id });
    await harness.service.removeIsolated({ workspace_id: b.workspace_id });
  } finally {
    await harness.cleanup();
  }
});

test("tracked, staged, and conflicted isolated worktrees are all removal-blocking", async () => {
  for (const fixture of ["tracked", "staged", "conflicted"]) {
    const harness = await createGitHarness(`dirty-${fixture}`);
    try {
      const workstream = await harness.service.begin({ label: `dirty ${fixture}` });
      const isolated = await harness.service.createIsolated({ workstream_id: workstream.workstream_id });
      await harness.service.end({ workstream_id: workstream.workstream_id, outcome: "completed" });
      const absolute = path.join(harness.worktreeRootPath, isolated.workspace_id);
      if (fixture === "tracked" || fixture === "staged") {
        await writeFile(path.join(absolute, "tracked.txt"), `${fixture}\n`, "utf8");
        if (fixture === "staged") await harness.runGit(["add", "tracked.txt"], { cwd: absolute });
      } else {
        await writeFile(path.join(absolute, "tracked.txt"), "worktree-side\n", "utf8");
        await harness.runGit(["add", "tracked.txt"], { cwd: absolute });
        await harness.runGit(["commit", "-m", "worktree-side"], { cwd: absolute });
        await writeFile(path.join(harness.repositoryRoot, "tracked.txt"), "main-side\n", "utf8");
        await harness.runGit(["add", "tracked.txt"]);
        await harness.runGit(["commit", "-m", "main-side"]);
        await assert.rejects(
          harness.runGit(["merge", "main"], { cwd: absolute }),
          /conflict|CONFLICT|Automatic merge failed/iu,
        );
      }
      const health = await harness.service.getWorkspace({ workspace_id: isolated.workspace_id });
      assert.equal(health.dirty, true);
      if (fixture === "staged") assert(health.staged.length > 0);
      if (fixture === "conflicted") assert(health.conflicted.length > 0);
      await assertRejectsMessage(
        harness.service.removeIsolated({ workspace_id: isolated.workspace_id }),
        /Dirty isolated worktree cannot be removed/u,
      );
    } finally {
      await harness.cleanup();
    }
  }
});
