import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPiTaskAuthorizationStore } from "../../server/src/pi-task-authorization.mjs";
import { createPiEngineeringBindingPublisher } from "../../server/src/pi-engineering-binding-publisher.mjs";
import { createPiEngineeringApprovalSource, loadPiEngineeringApprovalBindings } from "../../server/src/pi-engineering-approval-source.mjs";

const workspace = { workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + "b".repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active",
  workstream_state: "active", healthy: true, mutation_allowed: true };
const goal = "Verify host-owned binding maintenance";
const principal = "verified-operator-fixture";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-binding-publish-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = createPiTaskAuthorizationStore({ root, clock: () => 150 });
  const grant = await store.issue({ ...workspace, goal, expires_at_ms: 200,
    capabilities: ["filesystem.write"] });
  let context = workspace;
  const resolveWorkspace = async () => ({ ...context });
  const publisher = createPiEngineeringBindingPublisher({ root, resolveWorkspace, authorizeTask: store.authorize });
  const binding = { principal, workspace_id: workspace.workspace_id, workstream_id: workspace.workstream_id,
    goal, task_authorization_id: grant.task_authorization_id };
  const adapt = createPiEngineeringApprovalSource({ loadBindings: () => loadPiEngineeringApprovalBindings(root),
    resolveWorkspace, authorizeTask: store.authorize });
  const source = { request_kind: "autonomous_engineering", intent_id: "binding-publisher-fixture",
    workspace_id: workspace.workspace_id, goal,
    requested_actions: [{ step_id: "write", capability: "filesystem.write", input: { path: "fixture.txt", content: "fixture" } }] };
  return { root, store, grant, publisher, binding, adapt, source, setContext: value => { context = value; } };
}

test("operator publishes and removes a binding for an existing grant; ingress reuses the original grant", async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.publisher.inspect(), { sha256: null, count: 0 });
  const published = await f.publisher.publish({ expected_current_sha256: null, bindings: [f.binding] });
  assert.match(published.sha256, /^[a-f0-9]{64}$/);
  assert.equal(published.count, 1);
  assert.deepEqual(await f.publisher.inspect(), published);
  const intent = await f.adapt(f.source, { authenticatedPrincipal: principal });
  assert.equal(intent.task_authorization_id, f.grant.task_authorization_id);
  await assert.rejects(f.publisher.publish({ expected_current_sha256: null, bindings: [] }), { code: "BINDING_MANIFEST_CHANGED" });
  const removed = await f.publisher.publish({ expected_current_sha256: published.sha256, bindings: [] });
  assert.equal(removed.count, 0);
  await assert.rejects(f.adapt(f.source, { authenticatedPrincipal: principal }), { code: "PERMISSION_DENIED" });
  // Removing the binding is not grant revocation: the existing store still
  // owns any previously enrolled work and its independent revocation check.
  await f.store.authorize(intent);
});

test("invalid, ambiguous, revoked and inactive bindings leave the original manifest intact", async t => {
  const f = await fixture(t);
  const published = await f.publisher.publish({ expected_current_sha256: null, bindings: [f.binding] });
  const file = path.join(f.root, "engineering-bindings.json");
  const bytes = await readFile(file, "utf8");
  for (const bindings of [
    [f.binding, f.binding],
    [f.binding, { ...f.binding, principal: "another" }],
    [{ ...f.binding, goal: "wrong" }],
    [{ ...f.binding, task_authorization_id: "pi_task_" + "d".repeat(32) }],
    [{ ...f.binding, unexpected: true }],
  ]) {
    await assert.rejects(f.publisher.publish({ expected_current_sha256: published.sha256, bindings }));
    assert.equal(await readFile(file, "utf8"), bytes);
  }
  f.setContext({ ...workspace, workstream_state: "paused" });
  await assert.rejects(f.publisher.publish({ expected_current_sha256: published.sha256, bindings: [f.binding] }), { code: "BINDING_WORKSPACE_UNAVAILABLE" });
  f.setContext(workspace);
  await f.store.revoke(f.grant.task_authorization_id);
  await assert.rejects(f.publisher.publish({ expected_current_sha256: published.sha256, bindings: [f.binding] }), { code: "PERMISSION_DENIED" });
  assert.equal(await readFile(file, "utf8"), bytes);
});

test("concurrent publication is refused and malformed existing evidence is not overwritten", async t => {
  const f = await fixture(t);
  const lock = path.join(f.root, ".engineering-bindings.publish.lock");
  await writeFile(lock, "operator-maintenance-in-progress");
  await assert.rejects(f.publisher.publish({ expected_current_sha256: null, bindings: [f.binding] }), { code: "EEXIST" });
  await rm(lock);
  const file = path.join(f.root, "engineering-bindings.json");
  await writeFile(file, "{malformed");
  await assert.rejects(f.publisher.inspect());
  await assert.rejects(f.publisher.publish({ expected_current_sha256: null, bindings: [f.binding] }));
  assert.equal(await readFile(file, "utf8"), "{malformed");
});
