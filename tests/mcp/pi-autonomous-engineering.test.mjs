import assert from "node:assert/strict";
import test from "node:test";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";
import { hashExecutionInput, REQUIRED_DECISION_BOUNDARIES } from "../../server/src/pi-execution-contract.mjs";

const workspace_id = "dev_workspace_" + "a".repeat(24);
const workstream_id = "dev_workstream_20261112-160000_" + "b".repeat(12);
const resolveWorkspace = async () => ({
  workspace_id, workstream_id, workspace_type: "isolated_worktree",
  lifecycle_state: "active", healthy: true, mutation_allowed: true,
});
const simple = (changes = {}) => JSON.parse(JSON.stringify({
  request_kind: "autonomous_engineering",
  intent_id: "autonomous-test-intent-001",
  goal: "Inspect Windows drives without changing any files",
  workspace_id,
  command: "Get-PSDrive -PSProvider FileSystem",
  ...changes,
}));

test("autonomous engineering lowers a host command into exactly the existing Pi contract", async () => {
  const source = simple();
  const copy = JSON.stringify(source);
  const intent = await adaptAuthorizedPiRequest(source, { resolveWorkspace });
  assert.equal(JSON.stringify(source), copy);
  assert.equal(intent.context.project_id, "writer_workbench");
  assert.equal(intent.context.workspace_id, workspace_id);
  assert.equal(intent.context.workstream_id, workstream_id);
  assert.equal(intent.requested_actions.length, 1);
  assert.equal(intent.requested_actions[0].capability, "host.powershell");
  assert.equal(intent.requested_actions[0].input.command, source.command);
  assert.deepEqual(intent.permissions, {
    read: false, workspace_create: false, write: true, tests: false,
    commit: false, integrate: false, push: false,
  });
  assert.equal(intent.mutation_plan[0].target, "dev_workspace_shared_repository_v1");
  assert.equal(intent.mutation_plan[0].input_sha256, hashExecutionInput(intent.requested_actions[0].input));
  assert.deepEqual(intent.decision_boundaries, [...REQUIRED_DECISION_BOUNDARIES]);
  assert.deepEqual(await adaptAuthorizedPiRequest(source, { resolveWorkspace }), intent);
});

test("autonomous engineering can infer permissions for multiple ordinary actions", async () => {
  const actions = [
    { step_id: "read", capability: "filesystem.read", input: { path: "package.json" } },
    { step_id: "patch", capability: "filesystem.patch",
      input: { path: "README.md", oldText: "old", newText: "new", expectedSha256: "a".repeat(64) },
      depends_on: ["read"] },
  ];
  const intent = await adaptAuthorizedPiRequest(simple({
    command: undefined, requested_actions: actions, permissions: { read: true, write: true },
  }), { resolveWorkspace });
  assert.equal(intent.requested_actions.length, 2);
  assert.equal(intent.permissions.read, true);
  assert.equal(intent.permissions.write, true);
  assert.equal(intent.permissions.commit, false);
  assert.equal(intent.mutation_plan.length, 1);
});

test("autonomous mode rejects elevated or unknown actions and invalid contracts", async () => {
  for (const capability of ["git.push", "git.integrate", "workspace.powershell", "host.powershell_admin", "filesystem.delete"]) {
    await assert.rejects(adaptAuthorizedPiRequest(simple({
      command: undefined, requested_actions: [{ step_id: "x", capability, input: {} }],
    }), { resolveWorkspace }), { code: "STRICT_EXECUTION_INTENT_REQUIRED" });
  }
  await assert.rejects(adaptAuthorizedPiRequest(simple({ permissions: { write: false } }),
    { resolveWorkspace }), { code: "PERMISSION_DENIED" });
  await assert.rejects(adaptAuthorizedPiRequest(simple({ command: "echo ok", requested_actions: [] }),
    { resolveWorkspace }), { code: "INVALID_AUTONOMOUS_ACTIONS" });
  await assert.rejects(adaptAuthorizedPiRequest(simple({ command: undefined }),
    { resolveWorkspace }), { code: "INVALID_AUTONOMOUS_ACTIONS" });
  await assert.rejects(adaptAuthorizedPiRequest(simple({ env: { PATH: "C:\\Windows" } }),
    { resolveWorkspace }), { code: "INVALID_AUTHORIZED_REQUEST" });
  await assert.rejects(adaptAuthorizedPiRequest(simple({ schema_version: 2 }),
    { resolveWorkspace }), { code: "UNSUPPORTED_INTENT_VERSION" });
  await assert.rejects(adaptAuthorizedPiRequest(simple({ workspace_id: "dev_workspace_shared_repository_v1" }),
    { resolveWorkspace }), { code: "ISOLATED_WORKSPACE_REQUIRED" });
  await assert.rejects(adaptAuthorizedPiRequest(simple(),
    { resolveWorkspace: async () => ({ ...(await resolveWorkspace()), healthy: false }) }),
    { code: "WORKSPACE_IDENTITY_MISMATCH" });
});
