import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";

const workspace_id = "dev_workspace_" + "b".repeat(24);
const workstream_id = "dev_workstream_20261113-000000_" + "c".repeat(12);
const resolveWorkspace = async () => ({
  workspace_id, workstream_id, workspace_type: "isolated_worktree",
  lifecycle_state: "active", healthy: true, mutation_allowed: true,
});

test("autonomous short-form host command carries an explicit cwd into formal Pi intent", async () => {
  const req = {
    request_kind: "autonomous_engineering", intent_id: "host-cwd-policy-001",
    goal: "Inspect a local drive", workspace_id,
    command: "Get-ChildItem", cwd: "D:\\",
  };
  const intent = await adaptAuthorizedPiRequest(req, { resolveWorkspace });
  assert.equal(intent.requested_actions.length, 1);
  assert.equal(intent.requested_actions[0].capability, "host.powershell");
  assert.equal(intent.requested_actions[0].input.cwd, "D:\\");
  assert.equal(intent.permissions.write, true);
  assert.equal(intent.permissions.push, false);
  for (const cwd of ["", 42, "x".repeat(4097)]) {
    await assert.rejects(adaptAuthorizedPiRequest({ ...req, cwd }, { resolveWorkspace }),
      { code: "INVALID_HOST_CWD" });
  }
  const { command, ...withoutCommand } = req;
  await assert.rejects(adaptAuthorizedPiRequest({
    ...withoutCommand, requested_actions: [
      { step_id: "read", capability: "filesystem.list", input: {} },
    ],
  }, { resolveWorkspace }), { code: "INVALID_AUTONOMOUS_ACTIONS" });
});

test("non-elevated host can use another local drive directory; isolation and admin cannot",
  { skip: process.platform !== "win32" }, async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), "pi-host-cwd-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const inside = path.join(base, "workspace");
  const outside = path.join(base, "separate-project");
  await mkdir(inside);
  await mkdir(outside);
  const journalApi = {
    begin: async () => ({ operation_id: "dev_operation_" + "a".repeat(32) }),
    complete: async () => {},
    fail: async () => {},
    degrade: async () => {},
  };
  const executor = async ({ command, cwd, timeoutMs }) => ({
    elevated: false, execution_ok: true, ok: true, command_sha256: "b".repeat(64),
    cwd, timeout_ms: timeoutMs, exit_code: 0, signal: null, timed_out: false,
    duration_ms: 1, stdout: command, stderr: "",
    stdout_truncated: false, stderr_truncated: false,
  });
  const tool = (elevated, workspace_type) => createPowerShellMaintenanceTool({
    elevated, platform: "win32",
    workspaceContextResolver: async () => ({
      root: inside, workspace_type, workstream_id,
      workspace_id: workspace_type === "shared"
        ? "dev_workspace_shared_repository_v1" : workspace_id,
      branch: "main", base_head: "0".repeat(40), current_head: "0".repeat(40),
    }), executor, journalApi,
  });
  const host = tool(false, "shared");
  const isolated = tool(false, "isolated_worktree");
  const admin = tool(true, "shared");
  const command = "Write-Output 'host-cwd'";
  const run = await host({ command, cwd: outside });
  assert.equal(run.ok, true);
  assert.equal(run.cwd, await realpath(outside));
  assert.match(run.stdout, /host-cwd/u);
  await assert.rejects(isolated({ command, cwd: outside }),
    /workspace-relative/u);
  await assert.rejects(admin({ command, cwd: outside }),
    /workspace-relative/u);
  await assert.rejects(host({ command, cwd: ".." }),
    /inside the selected Writer Workbench workspace/u);
  await assert.rejects(host({ command, cwd: path.join(base, "missing") }),
    { code: "ENOENT" });
  await assert.rejects(host({ command, cwd: "\\\\host\\share" }),
    /local absolute drive path/u);
  await assert.rejects(host({ command: "Format-Volume -DriveLetter C", cwd: outside }),
    /rejected/u);

  // Exercise the actual Windows PowerShell process rather than only a fake
  // executor; the physical working directory must be the external folder.
  const liveHost = createPowerShellMaintenanceTool({
    elevated: false, platform: "win32",
    workspaceContextResolver: async () => ({
      root: inside, workspace_type: "shared",
      workspace_id: "dev_workspace_shared_repository_v1", workstream_id,
      branch: "main", base_head: "0".repeat(40), current_head: "0".repeat(40),
    }),
    journalApi,
  });
  const actual = await liveHost({
    command: "(Get-Location).Path", cwd: outside, timeoutMs: 15000,
  });
  assert.equal(actual.ok, true, actual.stderr);
  assert.equal(path.resolve(actual.stdout.trim()).toLowerCase(),
    (await realpath(outside)).toLowerCase());
});
