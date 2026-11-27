import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPiStandingAuthorizationReader, createPiStandingPolicyPublisher } from "../../server/src/pi-standing-authorization.mjs";
import { adaptPiEngineeringIngress } from "../../server/src/pi-engineering-ingress.mjs";
import { createPiTaskPolicy } from "../../server/src/pi-task-authorization.mjs";
import { createPiProductionExecutionController, assertPiManagedMcpCall } from "../../server/src/pi-production-execution-controller.mjs";
import { createPiProductionRouteStore } from "../../server/src/pi-production-execution-route.mjs";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createExecutionIntent } from "../../server/src/pi-execution-contract.mjs";

const workspace = (w, s) => ({ project_id: "writer_workbench", workspace_id: "dev_workspace_" + w.repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + s.repeat(12), workspace_type: "isolated_worktree",
  state: "active", workstream_state: "active", lifecycle_state: "active", healthy: true, mutation_allowed: true });
const first = workspace("a", "b"), second = workspace("c", "d"), unrelated = workspace("e", "f");
const principal = "verified-operator-fixture";
const authentication = { ok: true, local: false, principal };
const scope = ({ workspace_id, workstream_id }) => ({ workspace_id, workstream_id });
const plan = () => ({ schema_version: 1, project_id: "writer_workbench", principal,
  scopes: [scope(first), scope(second)], capabilities: ["filesystem.write", "filesystem.read"], expires_at_ms: 1000 });
const source = (id, ws = first, overrides = {}) => ({ request_kind: "standing_engineering",
  intent_id: id, goal: "Exact GPT engineering request " + id, workspace_id: ws.workspace_id,
  requested_actions: [{ step_id: "write", capability: "filesystem.write", input: { path: id + ".txt", content: "fixture" } }],
  ...overrides });

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-standing-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const grants = path.join(root, "protected-fixture"); await mkdir(grants);
  const contexts = new Map([first, second, unrelated].map(ws => [ws.workspace_id, ws]));
  let now = 100;
  const resolveWorkspace = async ({ workspace_id }) => contexts.get(workspace_id);
  const reader = () => createPiStandingAuthorizationReader({ root: grants, resolveWorkspace, clock: () => now });
  const publisher = createPiStandingPolicyPublisher({ root: grants, resolveWorkspace, clock: () => now });
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const route = createPiProductionRouteStore({ journal });
  await route.change({ mode: "pi_default", expected_revision: 0, decision_id: "gpt-standing-policy-fixture", gate_hash: "a".repeat(64) },
    { validateGate: async () => true });
  const calls = [];
  const controller = () => createPiProductionExecutionController({ journal, route,
    authorizeTask: createPiTaskPolicy({ required: true, authorizeStanding: reader().authorize }),
    transport: { resolveWorkspace,
      queryOperation: () => assert.fail("no reconciliation expected"),
      callTool: async ({ name, arguments: args }) => {
        await assertPiManagedMcpCall();
        calls.push({ name, args });
        return { ok: true };
      },
    } });
  const adapt = (request, auth = authentication, approvalSource) => adaptPiEngineeringIngress(request, {
    authentication: auth, resolveWorkspace, standingApprovalSource: reader().bind,
    automaticStandingApprovalSource: reader().bindIfApplicable, approvalSource,
    requireTaskAuthorization: true,
  });
  const approve = async (input = plan()) => {
    const preview = await publisher.preview(input);
    return publisher.issue(input, preview.plan_sha256);
  };
  return { grants, contexts, reader, publisher, journal, calls, controller, adapt, approve, setTime: value => { now = value; } };
}

test("independent policy permits multiple distinct goals in exactly two approved workstreams across durable worker reconstruction", async t => {
  const f = await fixture(t);
  await assert.rejects(f.adapt(source("before-approval")), { code: "PERMISSION_DENIED" });
  const preview = await f.publisher.preview(plan());
  assert.equal(preview.publication_performed, false);
  assert.deepEqual(await readdir(f.grants), []);
  const policy = await f.publisher.issue(plan(), preview.plan_sha256);
  const intents = await Promise.all([
    f.adapt(source("first-work")), f.adapt(source("second-goal")), f.adapt(source("other-workstream", second)),
  ]);
  for (const intent of intents) {
    assert.equal(intent.task_authorization_id, undefined);
    assert.deepEqual(intent.standing_authorization, { policy_id: policy.policy_id, policy_sha256: policy.policy_sha256, principal });
    await f.controller().submit(intent, { authentication });
  }
  const worker = f.controller();
  const pending = await worker.discover();
  assert.equal(pending.length, 3);
  for (const operation of pending) {
    const complete = await worker.execute(operation.intent);
    assert.equal(complete.state.status, "COMPLETED");
    assert.deepEqual(complete.intent.standing_authorization, intents[0].standing_authorization);
  }
  assert.equal(f.calls.length, 3);
  await assert.rejects(f.adapt(source("outside", unrelated)), { code: "PERMISSION_DENIED" });
  assert.equal((await f.journal.status()).chain_verified, true);
});

test("untrusted transport cannot supply standing evidence, combine grants, use protected capabilities or create a new record directly", async t => {
  const f = await fixture(t);
  await f.approve();
  const intent = await f.adapt(source("genuine"));
  await assert.rejects(f.adapt(intent), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.adapt(source("forged", first, { standing_authorization: intent.standing_authorization })), { code: "PERMISSION_DENIED" });
  for (const auth of [null, { ok: true, local: true, principal }, { ok: true, local: false, principal: "different" }]) {
    await assert.rejects(f.adapt(source("wrong-identity"), auth), { code: "PERMISSION_DENIED" });
  }
  await assert.rejects(f.controller().submit(intent), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.controller().submit(intent, { authentication: { ...authentication, principal: "other" } }), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.controller().admit(intent), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.controller().execute(intent), { code: "PERMISSION_DENIED" });
  assert.throws(() => createExecutionIntent({ ...intent, task_authorization_id: "pi_task_" + "a".repeat(32) }), { code: "INVALID_STANDING_AUTHORIZATION" });
  await assert.rejects(createPiTaskPolicy({ required: false })(intent), { code: "PERMISSION_DENIED" });
  for (const capability of ["host.powershell", "workspace.powershell_isolated", "windows.service.ensure_running",
    "windows.powershell.run_approved", "workspace.begin_workstream", "git.push", "git.integrate"]) {
    await assert.rejects(f.adapt(source("protected", first, { requested_actions: [{ step_id: "run", capability, input: {} }] })),
      { code: "PERMISSION_DENIED" });
    await assert.rejects(f.publisher.preview({ ...plan(), capabilities: [capability] }), { code: "INVALID_STANDING_POLICY_PLAN" });
  }
  assert.deepEqual(f.calls, []);
});

test("revocation, changed workstream identity, expiry and altered policy evidence stop queued effects", async t => {
  const f = await fixture(t);
  const policy = await f.approve();
  const paused = await f.adapt(source("paused"));
  await f.controller().submit(paused, { authentication });
  f.contexts.set(first.workspace_id, { ...first, workstream_id: unrelated.workstream_id });
  const blocked = await f.controller().execute(paused);
  assert.equal(blocked.state.last_error.code, "PERMISSION_DENIED");
  f.contexts.set(first.workspace_id, first);
  const expired = await f.adapt(source("expired"));
  await f.controller().submit(expired, { authentication });
  f.setTime(1000);
  assert.equal((await f.controller().execute(expired)).state.last_error.code, "PERMISSION_DENIED");
  f.setTime(150);
  const changed = await f.adapt(source("changed"));
  await f.controller().submit(changed, { authentication });
  const file = path.join(f.grants, policy.policy_id + ".approved.json");
  const original = await readFile(file, "utf8");
  const tampered = JSON.parse(original); tampered.issued_at_ms++;
  await writeFile(file, JSON.stringify(tampered));
  assert.equal((await f.controller().execute(changed)).state.last_error.code, "PERMISSION_DENIED");
  await writeFile(file, original);
  const revoked = await f.adapt(source("revoked", second));
  await f.controller().submit(revoked, { authentication });
  await f.publisher.revoke(policy.policy_id);
  assert.equal((await f.controller().execute(revoked)).state.last_error.code, "PERMISSION_DENIED");
  await assert.rejects(f.adapt(source("after-revocation")), { code: "PERMISSION_DENIED" });
  assert.equal((await f.publisher.list())[0].revoked, true);
  assert.deepEqual(f.calls, []);
});

test("operator review digest and overlapping policy protections are fail closed", async t => {
  const f = await fixture(t);
  const preview = await f.publisher.preview(plan());
  await assert.rejects(f.publisher.issue({ ...plan(), principal: "different" }, preview.plan_sha256),
    { code: "STANDING_POLICY_APPROVAL_MISMATCH" });
  await assert.rejects(f.publisher.preview({ ...plan(), scopes: [{ ...scope(first), workstream_id: unrelated.workstream_id }] }),
    { code: "STANDING_WORKSPACE_UNAVAILABLE" });
  await assert.rejects(f.publisher.preview({ ...plan(), expires_at_ms: 100 + 31 * 86400000 }),
    { code: "INVALID_STANDING_POLICY_PLAN" });
  const issued = await f.approve();
  await assert.rejects(f.publisher.issue(plan(), preview.plan_sha256), { code: "STANDING_POLICY_SCOPE_ALREADY_APPROVED" });
  await f.publisher.revoke(issued.policy_id);
  const replacement = await f.approve();
  assert.notEqual(replacement.policy_id, issued.policy_id);
  assert.equal((await f.adapt(source("replacement"))).standing_authorization.policy_id, replacement.policy_id);
});

test("explicit nonexpiring policy survives time and restart, but never revocation or scope changes", async t => {
  const f = await fixture(t);
  const permanent = { ...plan(), expires_at_ms: null };
  const preview = await f.publisher.preview(permanent);
  assert.equal(preview.plan.expires_at_ms, null);
  await assert.rejects(f.publisher.issue(plan(), preview.plan_sha256),
    { code: "STANDING_POLICY_APPROVAL_MISMATCH" });
  const issued = await f.publisher.issue(permanent, preview.plan_sha256);
  const before = await f.adapt(source("before"));
  await f.controller().submit(before, { authentication });
  f.setTime(100 + 365 * 86400000);
  const worker = f.controller();
  const pending = await worker.discover();
  assert.equal(pending.length, 1);
  assert.equal((await worker.execute(pending[0].intent)).state.status, "COMPLETED");
  const after = await f.adapt(source("after-year"));
  assert.equal(after.standing_authorization.policy_id, issued.policy_id);
  assert.equal(after.task_authorization_id, undefined);
  assert.equal((await f.publisher.list())[0].expired, false);
  await assert.rejects(f.approve({ ...plan(), expires_at_ms: 100 + 366 * 86400000 }),
    { code: "STANDING_POLICY_SCOPE_ALREADY_APPROVED" });
  await assert.rejects(f.adapt(source("outside-permanent", unrelated)), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.adapt(source("wrong-principal"), { ...authentication, principal: "other" }),
    { code: "PERMISSION_DENIED" });
  f.contexts.set(first.workspace_id, { ...first, healthy: false });
  // Ingress rejects an unhealthy workspace before policy binding; the reader
  // independently refuses an already-bound intent at the dispatch boundary.
  await assert.rejects(f.adapt(source("unhealthy")), { code: "WORKSPACE_IDENTITY_MISMATCH" });
  await assert.rejects(f.reader().authorize(after), { code: "PERMISSION_DENIED" });
  f.contexts.set(first.workspace_id, first);
  await f.controller().submit(after, { authentication });
  await f.publisher.revoke(issued.policy_id);
  assert.equal((await f.controller().execute(after)).state.last_error.code, "PERMISSION_DENIED");
  await assert.rejects(f.adapt(source("after-revoke-permanent")), { code: "PERMISSION_DENIED" });
  assert.equal((await f.publisher.list())[0].revoked, true);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.journal.status()).chain_verified, true);
});

test("permanence requires explicit null; malformed expiry and overlapping finite policies fail closed", async t => {
  const f = await fixture(t);
  const { expires_at_ms, ...omitted } = plan();
  for (const candidate of [omitted, { ...plan(), expires_at_ms: "never" },
    { ...plan(), expires_at_ms: false }, { ...plan(), expires_at_ms: 0 },
    { ...plan(), expires_at_ms: 100 + 31 * 86400000 }]) {
    await assert.rejects(f.publisher.preview(candidate), { code: "INVALID_STANDING_POLICY_PLAN" });
  }
  const finite = await f.approve();
  await assert.rejects(f.approve({ ...plan(), expires_at_ms: null }), { code: "STANDING_POLICY_SCOPE_ALREADY_APPROVED" });
  f.setTime(1000);
  assert.equal((await f.publisher.list()).find(p => p.policy_id === finite.policy_id).expired, true);
  const permanent = await f.approve({ ...plan(), expires_at_ms: null });
  assert.equal((await f.adapt(source("replacement-after-expiry"))).standing_authorization.policy_id, permanent.policy_id);
  f.setTime(999);
  // Clock rollback must not make the newer permanent record usable before issuance.
  await assert.rejects(f.reader().authorize({ ...(await f.adapt(source("old-record"))),
    standing_authorization: { policy_id: permanent.policy_id, policy_sha256: permanent.policy_sha256, principal } }),
    { code: "PERMISSION_DENIED" });
});

test("unified autonomous ingress binds an existing policy without caller authorization IDs", async t => {
  const f = await fixture(t);
  const auto = (id, ws = first, overrides = {}) => source(id, ws, { request_kind: "autonomous_engineering", ...overrides });
  const policy = await f.approve({ ...plan(), expires_at_ms: null });
  const neverFallback = () => assert.fail("standing policy must not use legacy binding");
  const bound = await f.adapt(auto("unified"), authentication, neverFallback);
  const legacy = await f.adapt(source("unified"));
  assert.deepEqual(bound, legacy);
  assert.equal(bound.task_authorization_id, undefined);
  assert.equal(bound.standing_authorization.policy_id, policy.policy_id);
  await f.controller().submit(bound, { authentication });
  assert.equal((await f.controller().execute(bound)).state.status, "COMPLETED");
  assert.equal(f.calls.length, 1);
  // An existing policy is not silently bypassed by requesting additional capabilities.
  await assert.rejects(f.adapt(auto("extra-capability", first, {
    requested_actions: [{ step_id: "verify", capability: "verification.focused", input: { suite: "mcp_hermetic_core" } }],
  }), authentication, neverFallback), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.adapt(auto("forged", first, { standing_authorization: bound.standing_authorization }),
    authentication, neverFallback), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.adapt(auto("local"), { ...authentication, local: true }, neverFallback),
    { code: "PERMISSION_DENIED" });
  await f.publisher.revoke(policy.policy_id);
  await assert.rejects(f.adapt(auto("revoked"), authentication, neverFallback), { code: "PERMISSION_DENIED" });
});

test("automatic legacy binding is consulted only for verified absence of standing history", async t => {
  const f = await fixture(t);
  const auto = (id, ws = first) => source(id, ws, { request_kind: "autonomous_engineering" });
  const seen = [];
  const oldBinding = async (request, identity) => {
    seen.push({ request, identity });
    // Exercise selection, not authorization. An independent binding must still approve.
    throw Object.assign(new Error("LEGACY_BINDING_NOT_APPROVED"), { code: "LEGACY_BINDING_NOT_APPROVED" });
  };
  await assert.rejects(f.adapt(auto("no-history"), authentication, oldBinding), { code: "LEGACY_BINDING_NOT_APPROVED" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].identity.authenticatedPrincipal, principal);
  const policy = await f.approve();
  await assert.rejects(f.adapt(auto("unrelated", unrelated), authentication, oldBinding), { code: "LEGACY_BINDING_NOT_APPROVED" });
  assert.equal(seen.length, 2);
  f.setTime(1000);
  await assert.rejects(f.adapt(auto("expired"), authentication, oldBinding), { code: "PERMISSION_DENIED" });
  assert.equal(seen.length, 2);
  const file = path.join(f.grants, policy.policy_id + ".approved.json");
  await writeFile(file, "invalid JSON");
  await assert.rejects(f.adapt(auto("corrupt-store", unrelated), authentication, oldBinding), { code: "PERMISSION_DENIED" });
  assert.equal(seen.length, 2);
  assert.deepEqual(f.calls, []);
});
