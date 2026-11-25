import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPiTaskAuthorizationStore } from "../../server/src/pi-task-authorization.mjs";
import { createPiEngineeringBindingPublisher } from "../../server/src/pi-engineering-binding-publisher.mjs";
import { createPiEngineeringApprovalSource, loadPiEngineeringApprovalBindings } from "../../server/src/pi-engineering-approval-source.mjs";
import { createPiOperatorBatchApproval } from "../../server/src/pi-operator-batch-approval.mjs";

const context = (w, s) => ({ workspace_id: "dev_workspace_" + w.repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + s.repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active",
  workstream_state: "active", healthy: true, mutation_allowed: true });
const first = context("a", "b"), second = context("c", "d"), old = context("e", "f");
const principal = "operator-reviewed-test-principal";
const scope = (c, goal) => ({ workspace_id: c.workspace_id, workstream_id: c.workstream_id,
  goal, capabilities: ["filesystem.write", "git.status"] });
const planFor = (expected = null) => ({ schema_version: 1, principal, expected_current_sha256: expected,
  expires_at_ms: 100000, scopes: [scope(first, "First approved goal"), scope(second, "Second approved goal")] });

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-batch-approval-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const clock = () => 150;
  const store = createPiTaskAuthorizationStore({ root, clock });
  const contexts = new Map([first, second, old].map(c => [c.workspace_id, c]));
  const resolveWorkspace = async ({ workspace_id }) => contexts.get(workspace_id);
  const publisher = createPiEngineeringBindingPublisher({ root, resolveWorkspace, authorizeTask: store.authorize });
  const batch = createPiOperatorBatchApproval({ root, store, publisher, resolveWorkspace, clock });
  const adapt = createPiEngineeringApprovalSource({ loadBindings: () => loadPiEngineeringApprovalBindings(root),
    resolveWorkspace, authorizeTask: store.authorize });
  const request = (s, id = "batch-fixture") => ({ request_kind: "autonomous_engineering",
    intent_id: id, workspace_id: s.workspace_id, goal: s.goal,
    requested_actions: [{ step_id: "write", capability: "filesystem.write", input: { path: "fixture.txt", content: "fixture" } }] });
  return { root, store, publisher, batch, adapt, request, contexts, resolveWorkspace, clock };
}

test("one operator reviewed batch issues exact-scope grants and preserves pre-existing bindings", async t => {
  const f = await fixture(t);
  const oldScope = scope(old, "Existing approved goal");
  const existing = await f.store.issue({ ...oldScope, expires_at_ms: 100000 });
  const initial = await f.publisher.publish({ expected_current_sha256: null, bindings: [{
    principal, workspace_id: oldScope.workspace_id, workstream_id: oldScope.workstream_id,
    goal: oldScope.goal, task_authorization_id: existing.task_authorization_id,
  }] });
  const plan = planFor(initial.sha256);
  const before = await readdir(f.root);
  const preview = await f.batch.preview(plan);
  assert.equal(preview.new_grant_count, 2);
  assert.equal(preview.preserved_binding_count, 1);
  assert.equal(preview.publication_performed, false);
  assert.deepEqual(await readdir(f.root), before);
  const result = await f.batch.apply(plan, preview.plan_sha256);
  assert.equal(result.count, 3);
  assert.equal(result.new_grant_count, 2);
  assert.equal(result.publication_performed, true);
  const [a, b] = await Promise.all(plan.scopes.map(s => f.adapt(f.request(s), { authenticatedPrincipal: principal })));
  assert.notEqual(a.task_authorization_id, b.task_authorization_id);
  assert.equal((await f.adapt(f.request(oldScope), { authenticatedPrincipal: principal })).task_authorization_id, existing.task_authorization_id);
  assert.equal((await f.adapt(f.request(plan.scopes[0], "batch-fixture-next"), { authenticatedPrincipal: principal })).task_authorization_id, a.task_authorization_id);
  await assert.rejects(f.adapt(f.request({ ...plan.scopes[0], goal: "Unapproved goal" }), { authenticatedPrincipal: principal }), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.adapt(f.request(plan.scopes[0]), { authenticatedPrincipal: "wrong-principal" }), { code: "PERMISSION_DENIED" });
  await f.store.revoke(a.task_authorization_id);
  await assert.rejects(f.store.authorize(a), { code: "PERMISSION_DENIED" });
  await f.store.authorize(b);
  await assert.rejects(f.batch.apply(plan, preview.plan_sha256), { code: "BINDING_MANIFEST_CHANGED" });
});

test("batch rejects modified review digest, shell and protected capabilities, invalid scopes and expiry", async t => {
  const f = await fixture(t);
  const plan = planFor();
  const preview = await f.batch.preview(plan);
  await assert.rejects(f.batch.apply({ ...plan, principal: "different-principal" }, preview.plan_sha256),
    { code: "OPERATOR_BATCH_APPROVAL_MISMATCH" });
  for (const capability of ["host.powershell", "workspace.powershell_isolated", "windows.service.ensure_running",
    "windows.powershell.run_approved", "workspace.begin_workstream", "git.push", "unknown"]) {
    await assert.rejects(f.batch.preview({ ...plan, scopes: [{ ...plan.scopes[0], capabilities: [capability] }] }),
      { code: "INVALID_OPERATOR_BATCH_SCOPE" });
  }
  await assert.rejects(f.batch.preview({ ...plan, expires_at_ms: 150 }), { code: "INVALID_OPERATOR_BATCH_EXPIRY" });
  await assert.rejects(f.batch.preview({ ...plan, expires_at_ms: 150 + 31 * 86400000 }), { code: "INVALID_OPERATOR_BATCH_EXPIRY" });
  await assert.rejects(f.batch.preview({ ...plan, scopes: [plan.scopes[0], plan.scopes[0]] }), { code: "AMBIGUOUS_BINDING" });
  await assert.rejects(f.batch.preview({ ...plan, scopes: [{ ...plan.scopes[0], workstream_id: second.workstream_id }] }),
    { code: "BINDING_WORKSPACE_UNAVAILABLE" });
  f.contexts.set(second.workspace_id, { ...second, workstream_state: "paused" });
  await assert.rejects(f.batch.apply(plan, preview.plan_sha256), { code: "BINDING_WORKSPACE_UNAVAILABLE" });
  assert.deepEqual(await readdir(f.root), []);
});

test("failed publication revokes only batch-created grants and preserves the existing manifest", async t => {
  const f = await fixture(t);
  const oldScope = scope(old, "Existing approved goal");
  const existing = await f.store.issue({ ...oldScope, expires_at_ms: 100000 });
  const initial = await f.publisher.publish({ expected_current_sha256: null, bindings: [{
    principal, workspace_id: oldScope.workspace_id, workstream_id: oldScope.workstream_id,
    goal: oldScope.goal, task_authorization_id: existing.task_authorization_id,
  }] });
  const created = [];
  const store = { ...f.store, issue: async input => {
    const grant = await f.store.issue(input);
    created.push(grant);
    return grant;
  } };
  const batch = createPiOperatorBatchApproval({ root: f.root, store, resolveWorkspace: f.resolveWorkspace,
    clock: f.clock, publisher: { inspect: f.publisher.inspect, publish: async () => {
      throw new Error("simulated publication conflict");
    } } });
  const plan = planFor(initial.sha256);
  const preview = await batch.preview(plan);
  await assert.rejects(batch.apply(plan, preview.plan_sha256), error =>
    error.code === "OPERATOR_BATCH_FAILED_RECONCILE" && error.new_grant_count === 2
      && error.unrevoked_grant_ids.length === 0);
  assert.equal(created.length, 2);
  assert.deepEqual(await f.publisher.inspect(), initial);
  for (const grant of created) {
    await assert.rejects(f.store.authorize({ task_authorization_id: grant.task_authorization_id,
      context: { project_id: "writer_workbench", workspace_id: grant.workspace_id, workstream_id: grant.workstream_id },
      goal: grant.goal, requested_actions: [] }), { code: "PERMISSION_DENIED" });
  }
  await f.store.authorize(await f.adapt(f.request(oldScope), { authenticatedPrincipal: principal }));
});
