import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { adaptHostAuthorizedEngineeringRequest, adaptPiEngineeringIngress } from "../../server/src/pi-engineering-ingress.mjs";
import { createPiEngineeringApprovalSource, loadPiEngineeringApprovalBindings } from "../../server/src/pi-engineering-approval-source.mjs";
import { createWorkbenchTransportBoundary } from "../../server/src/mcp-trpg-gm-bridge.mjs";
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
  return { root, store, grant, options, setTime: value => { now = value; } };
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

test("host ingress cannot silently reinterpret a short PowerShell command", async t => {
  const f = await fixture(t);
  const { requested_actions, ...request } = source();
  for (const command of ["Get-Location", "Get-ChildItem"]) {
    await assert.rejects(adaptHostAuthorizedEngineeringRequest({
      ...request, command,
    }, f.options), { code: "EXPLICIT_ENGINEERING_ACTION_REQUIRED" });
  }
  const sandboxGrant = await f.store.issue({ ...context, goal,
    capabilities: ["workspace.powershell_isolated"], expires_at_ms: 200 });
  const sandbox = await adaptHostAuthorizedEngineeringRequest(source({
    requested_actions: [{ step_id: "sandbox", capability: "workspace.powershell_isolated",
      input: { command: "Get-Location", cwd: "." } }],
  }), { ...f.options, approvedGrantId: sandboxGrant.task_authorization_id });
  assert.equal(sandbox.requested_actions[0].capability, "workspace.powershell_isolated");
  assert.equal(sandbox.mutation_plan[0].target, context.workspace_id);
  await assert.rejects(adaptHostAuthorizedEngineeringRequest(source({
    requested_actions: [{ step_id: "host", capability: "host.powershell",
      input: { command: "Get-Location" } }],
  }), { ...f.options, approvedGrantId: sandboxGrant.task_authorization_id }), { code: "PERMISSION_DENIED" });
});

const principal = "authenticated-fixture-principal";
function approvalFixture(f) {
  const binding = { principal, workspace_id: context.workspace_id,
    workstream_id: context.workstream_id, goal,
    task_authorization_id: f.grant.task_authorization_id };
  let bindings = [binding];
  let resolutions = 0;
  const adapt = createPiEngineeringApprovalSource({
    loadBindings: async () => bindings,
    authorizeTask: f.store.authorize,
    resolveWorkspace: async () => { resolutions++; return { ...context }; },
  });
  return { binding, adapt, setBindings: value => { bindings = value; },
    resolutions: () => resolutions };
}

test("host binding resolves an existing approved grant without a caller-supplied grant identifier", async t => {
  const f = await fixture(t);
  const a = approvalFixture(f);
  const first = await a.adapt(source(), { authenticatedPrincipal: principal });
  const second = await a.adapt(source({ intent_id: "host-approved-second" }), { authenticatedPrincipal: principal });
  assert.equal(first.task_authorization_id, f.grant.task_authorization_id);
  assert.equal(second.task_authorization_id, first.task_authorization_id);
  assert.notEqual(second.intent_id, first.intent_id);
  assert.equal(a.resolutions(), 4);
  await f.store.authorize(first);
  await f.store.authorize(second);
});

test("binding source rejects absent, ambiguous, malformed and cross-principal bindings", async t => {
  const f = await fixture(t);
  const a = approvalFixture(f);
  const rejected = options => assert.rejects(a.adapt(source(), options), { code: "PERMISSION_DENIED" });
  await rejected({});
  await rejected({ authenticatedPrincipal: "other-principal" });
  for (const bindings of [
    [], [a.binding, a.binding], [{ ...a.binding, goal: "Different goal" }],
    [{ ...a.binding, workstream_id: "dev_workstream_20261125-010000_" + "c".repeat(12) }],
    [{ ...a.binding, unexpected: true }], [{ ...a.binding, task_authorization_id: "invalid" }],
  ]) {
    a.setBindings(bindings);
    await rejected({ authenticatedPrincipal: principal });
  }
  a.setBindings([a.binding]);
  await assert.rejects(a.adapt(source({ task_authorization_id: f.grant.task_authorization_id }),
    { authenticatedPrincipal: principal }), { code: "PERMISSION_DENIED" });
});

test("fresh host binding snapshots and the original grant verifier both remain authoritative", async t => {
  const f = await fixture(t);
  const a = approvalFixture(f);
  await a.adapt(source(), { authenticatedPrincipal: principal });
  a.setBindings([]);
  await assert.rejects(a.adapt(source(), { authenticatedPrincipal: principal }), { code: "PERMISSION_DENIED" });
  a.setBindings([a.binding]);
  await f.store.revoke(f.grant.task_authorization_id);
  await assert.rejects(a.adapt(source(), { authenticatedPrincipal: principal }), { code: "PERMISSION_DENIED" });
});

test("protected approval binding loader fails closed on missing, malformed and oversized records", async t => {
  const f = await fixture(t);
  const a = approvalFixture(f);
  const file = path.join(f.root, "engineering-bindings.json");
  for (const root of [undefined, ".", f.root]) {
    await assert.rejects(loadPiEngineeringApprovalBindings(root), { code: "PERMISSION_DENIED" });
  }
  await mkdir(file);
  await assert.rejects(loadPiEngineeringApprovalBindings(f.root), { code: "PERMISSION_DENIED" });
  await rm(file, { recursive: true });
  await writeFile(file, "{invalid");
  await assert.rejects(loadPiEngineeringApprovalBindings(f.root), { code: "PERMISSION_DENIED" });
  await writeFile(file, " ".repeat(256 * 1024 + 1));
  await assert.rejects(loadPiEngineeringApprovalBindings(f.root), { code: "PERMISSION_DENIED" });
  await writeFile(file, JSON.stringify([a.binding]));
  assert.deepEqual(await loadPiEngineeringApprovalBindings(f.root), [a.binding]);
});

test("new ingress uses verified transport principal and the protected approval source, not caller metadata", async t => {
  const f = await fixture(t);
  const a = approvalFixture(f);
  const boundary = createWorkbenchTransportBoundary({
    ipc: true, trustedLocalOwner: false,
    loadSecurity: async () => ({ verifier: { authorize: async ({ authorization }) => {
      return authorization === "Bearer SYNTHETIC_VALID_PROOF"
        ? { ok: true, principal: { key: principal } }
        : { ok: false, code: "INVALID_TOKEN" };
    } } }),
  });
  t.after(() => boundary.close());
  const request = source({ request_kind: "host_approved_engineering" });
  const message = token => ({
    method: "tools/call", params: { name: "dev_pi_execute_intent",
      arguments: { intent_json: JSON.stringify(request) },
      _meta: { workbench_http_access_token: token, actor: "untrusted-actor" },
    },
  });
  const options = {
    resolveWorkspace: f.options.resolveWorkspace, approvalSource: a.adapt,
  };
  const authentication = await boundary.authorize(message("SYNTHETIC_VALID_PROOF"));
  const intent = await adaptPiEngineeringIngress(request, { ...options, authentication });
  assert.equal(intent.task_authorization_id, f.grant.task_authorization_id);
  assert.equal(intent.context.workspace_id, context.workspace_id);
  for (const decision of [undefined, { ok: true, local: true, principal },
    { ok: true, local: false, principal: "other-principal" },
    await boundary.authorize(message("FORGED"))]) {
    await assert.rejects(adaptPiEngineeringIngress(request, { ...options, authentication: decision }),
      { code: "PERMISSION_DENIED" });
  }
  await assert.rejects(adaptPiEngineeringIngress({ ...request,
    task_authorization_id: f.grant.task_authorization_id }, { ...options, authentication }),
    { code: "PERMISSION_DENIED" });
  await assert.rejects(adaptPiEngineeringIngress({ ...request,
    authenticatedPrincipal: principal }, { ...options, authentication }),
    { code: "INVALID_AUTHORIZED_REQUEST" });
});

test("legacy ingress retains its existing contract and does not consult the approval source", async t => {
  const f = await fixture(t);
  const request = source({ task_authorization_id: f.grant.task_authorization_id });
  const intent = await adaptPiEngineeringIngress(request, {
    resolveWorkspace: f.options.resolveWorkspace,
    approvalSource: () => assert.fail("legacy ingress must not consult the binding source"),
  });
  assert.equal(intent.task_authorization_id, f.grant.task_authorization_id);
  await f.store.authorize(intent);
});
