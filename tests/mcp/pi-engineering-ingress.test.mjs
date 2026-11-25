import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { adaptHostAuthorizedEngineeringRequest } from "../../server/src/pi-engineering-ingress.mjs";
import { createPiTaskAuthorizationStore } from "../../server/src/pi-task-authorization.mjs";

const context = {
  project_id: "writer_workbench",
  workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + "b".repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active",
  healthy: true, mutation_allowed: true,
};
const goal = "Verify the engineering ingress fixture";
const source = (overrides = {}) => ({
  request_kind: "autonomous_engineering",
  intent_id: "host-approved-fixture",
  workspace_id: context.workspace_id, goal,
  requested_actions: [{ step_id: "write", capability: "filesystem.write",
    input: { path: "fixture.txt", content: "fixture" } }],
  ...overrides,
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-engineering-ingress-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let now = 100;
  const store = createPiTaskAuthorizationStore({ root, clock: () => now });
  const grant = await store.issue({ ...context, goal,
    capabilities: ["filesystem.write", "verification.focused"], expires_at_ms: 200 });
  const options = {
    approvedGrantId: grant.task_authorization_id,
    resolveWorkspace: async () => ({ ...context }),
    authorizeTask: store.authorize,
  };
  return { store, grant, options, setTime: value => { now = value; } };
}

test("host-supplied approved grant creates an unchanged strict intent without a caller grant ID", async t => {
  const f = await fixture(t);
  const request = source();
  const before = JSON.stringify(request);
  const intent = await adaptHostAuthorizedEngineeringRequest(request, f.options);
  assert.equal(JSON.stringify(request), before);
  assert.equal(intent.task_authorization_id, f.grant.task_authorization_id);
  assert.equal(intent.context.workspace_id, context.workspace_id);
  assert.equal(intent.requested_actions[0].capability, "filesystem.write");
  assert.equal(intent.permissions.integrate, false);
  assert.equal(intent.permissions.push, false);
  assert.deepEqual(await adaptHostAuthorizedEngineeringRequest(request, f.options), intent);
  await f.store.authorize(intent);
});

test("the host adapter denies missing, malformed, expired and revoked grants", async t => {
  const f = await fixture(t);
  for (const options of [
    {}, { ...f.options, approvedGrantId: undefined },
    { ...f.options, approvedGrantId: "bad" },
    { ...f.options, approvedGrantId: "pi_task_" + "c".repeat(32) },
    { ...f.options, authorizeTask: undefined },
  ]) {
    await assert.rejects(adaptHostAuthorizedEngineeringRequest(source(), options),
      { code: "PERMISSION_DENIED" });
  }
  f.setTime(200);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source(), f.options), { code: "PERMISSION_DENIED" });
  f.setTime(150);
  await f.store.revoke(f.grant.task_authorization_id);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source(), f.options), { code: "PERMISSION_DENIED" });
});

test("host grant cannot be reused for a changed goal, workspace, capability or elevated action", async t => {
  const f = await fixture(t);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({ goal: "Other goal" }), f.options),
    { code: "PERMISSION_DENIED" });
  const other = "dev_workspace_" + "d".repeat(24);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({ workspace_id: other }), {
    ...f.options, resolveWorkspace: async () => ({ ...context, workspace_id: other }),
  }), { code: "PERMISSION_DENIED" });
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({ requested_actions: [
    { step_id: "service", capability: "windows.service.ensure_running", input: { service_name: "Example" } },
  ] }), f.options), { code: "PERMISSION_DENIED" });
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({ requested_actions: [
    { step_id: "list", capability: "filesystem.list", input: {} },
  ] }), f.options), { code: "PERMISSION_DENIED" });
});

test("caller cannot inject a grant reference or host-only parameter", async t => {
  const f = await fixture(t);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({
    task_authorization_id: f.grant.task_authorization_id,
  }), f.options), { code: "PERMISSION_DENIED" });
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({
    approvedGrantId: f.grant.task_authorization_id,
  }), f.options), { code: "INVALID_AUTHORIZED_REQUEST" });
});
