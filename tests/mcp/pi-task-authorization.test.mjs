import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";
import { createPiProductionExecutionController } from "../../server/src/pi-production-execution-controller.mjs";
import { createPiProductionRouteStore } from "../../server/src/pi-production-execution-route.mjs";
import { createPiTaskAuthorizationStore, createPiTaskPolicy } from "../../server/src/pi-task-authorization.mjs";

const context = { project_id: "writer_workbench", workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261008-010000_" + "b".repeat(12) };
const workspace = { ...context, workspace_type: "isolated_worktree", state: "active", workstream_state: "active",
  lifecycle_state: "active", healthy: true, mutation_allowed: true };
const goal = "Repair the fixture and verify the result";
const write = { step_id: "write", capability: "filesystem.write", input: { path: "fixture.txt", content: "broken" } };
const verify = { step_id: "verify", capability: "verification.focused", input: { suite: "mcp_core" } };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-task-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const authorizationRoot = path.join(root, "authorization");
  await mkdir(authorizationRoot);
  let now = 100;
  const createStore = () => createPiTaskAuthorizationStore({ root: authorizationRoot, clock: () => now });
  const store = createStore();
  const grant = await store.issue({ ...context, goal, capabilities: ["filesystem.write", "filesystem.patch", "verification.focused"], expires_at_ms: 200 });
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const route = createPiProductionRouteStore({ journal });
  await route.change({ mode: "pi_default", expected_revision: 0, decision_id: "gpt-task-policy", gate_hash: "a".repeat(64) },
    { validateGate: async () => true });
  const calls = [];
  const adminCalls = [];
  let adminError;
  const admin = createPowerShellMaintenanceTool({ elevated: true, platform: "win32",
    workspaceContextResolver: async () => ({ ...workspace, root }),
    journalApi: { begin: journal.begin, complete: journal.complete, fail: journal.fail, degrade: journal.markDegraded },
    executor: async ({ command, cwd, timeoutMs }) => {
      adminCalls.push(command);
      return { elevated: true, execution_ok: true, ok: true, command_sha256: "a".repeat(64), cwd,
        timeout_ms: timeoutMs, exit_code: 0, timed_out: false, duration_ms: 1,
        stdout: "service_running", stderr: "", stdout_truncated: false, stderr_truncated: false, reason: null };
    },
  });
  let workstreamState = "active";
  const controller = () => createPiProductionExecutionController({ journal, route,
    authorizeTask: createPiTaskPolicy({ store: createStore(), required: true }),
    transport: {
      resolveWorkspace: async () => ({ ...workspace, workstream_state: workstreamState }),
      queryOperation: async () => assert.fail("A normal response must not reconcile"),
      callTool: async ({name, arguments: args}) => {
        calls.push(name);
        if (name === "powershell_admin_run") {
          try { return { content: [{ type: "text", text: JSON.stringify(await admin(args)) }] }; }
          catch (error) { adminError = error; throw error; }
        }
        const file = path.join(root, "fixture.txt");
        if (name === "dev_create_file") await writeFile(file, args.content, { flag: "wx" });
        if (name === "dev_apply_patch") {
          assert.equal(await readFile(file, "utf8"), args.oldText);
          await writeFile(file, args.newText);
        }
        return name === "dev_run_tests" ? { passed: (await readFile(file, "utf8")) === "fixed" } : { ok: true };
      },
    },
  });
  const intent = (intent_id, requested_actions, overrides = {}) => adaptAuthorizedPiRequest({
    request_kind: "autonomous_engineering", intent_id, goal, workspace_id: context.workspace_id,
    task_authorization_id: grant.task_authorization_id, requested_actions, ...overrides,
  }, { resolveWorkspace: async () => workspace });
  return { store, grant, journal, calls, adminCalls, adminError: () => adminError, controller, intent, setTime: value => { now = value; },
    setWorkstreamState: value => { workstreamState = value; } };
}

test("one grant spans failure, correction, re-verification and a fresh workspace history query", async t => {
  const f = await fixture(t);
  const first = await f.intent("initial", [write, { ...verify, depends_on: ["write"] }]);
  await f.controller().submit(first);
  const failed = await f.controller().execute(first);
  assert.equal(failed.state.status, "DECISION_REQUIRED");
  assert.equal(failed.state.last_error.step_id, "verify");
  const patch = { step_id: "patch", capability: "filesystem.patch", input: { path: "fixture.txt",
    oldText: "broken", newText: "fixed", expectedSha256: "b".repeat(64) } };
  const repair = await f.intent("repair", [patch, { ...verify, depends_on: ["patch"] }]);
  const completed = await f.controller().execute(repair);
  assert.equal(completed.state.status, "COMPLETED");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests", "dev_apply_patch", "dev_run_tests"]);
  assert.equal((await f.controller().execute(repair)).state.operation_id, completed.state.operation_id);
  assert.equal(f.calls.length, 4);
  const newest = await f.controller().listOperations({ context, limit: 1 });
  assert.deepEqual(newest.operations.map(op => [op.intent_id, op.status, op.task_authorization_id]),
    [["repair", "COMPLETED", f.grant.task_authorization_id]]);
  const older = await f.controller().listOperations({ context, before_sequence: newest.next_before_sequence });
  assert.equal(older.operations[0].next_step, "verify");
  assert.equal(older.operations[0].last_error.step_id, "verify");
  assert.deepEqual((await f.controller().listOperations({ context: { ...context, workspace_id: "other" } })).operations, []);
  assert.equal((await f.journal.status()).chain_verified, true);
});

test("grant enforcement rejects missing grants, changed scope, expiry and unsupported shell", async t => {
  const f = await fixture(t);
  const { task_authorization_id, ...noGrant } = await f.intent("no-grant", [write]);
  const wrongGoal = await f.intent("wrong-goal", [write], { goal: "Different task" });
  const shell = await f.intent("host-shell", [{ step_id: "run", capability: "host.powershell", input: { command: "Get-Location" } }]);
  for (const intent of [noGrant, wrongGoal, shell]) {
    await assert.rejects(f.controller().submit(intent), { code: "PERMISSION_DENIED" });
  }
  await assert.rejects(f.store.issue({ ...context, goal, capabilities: ["powershell_admin_run"], expires_at_ms: 200 }),
    { code: "PERMISSION_DENIED" });
  const granted = await f.intent("expires", [write]);
  await assert.rejects(f.store.authorize({ ...granted, context: { ...context, workstream_id: "other" } }),
    { code: "PERMISSION_DENIED" });
  f.setTime(200);
  await assert.rejects(f.controller().submit(granted), { code: "PERMISSION_DENIED" });
  assert.deepEqual(f.calls, []);
});

test("revocation and paused workstreams stop queued effects after a worker restart", async t => {
  const f = await fixture(t);
  const paused = await f.intent("paused", [write]);
  await f.controller().submit(paused);
  f.setWorkstreamState("paused");
  assert.equal((await f.controller().execute(paused)).state.last_error.code, "PERMISSION_DENIED");
  f.setWorkstreamState("active");
  const queued = await f.intent("revoked", [write]);
  const submitted = await f.controller().submit(queued);
  const first = await f.store.revoke(f.grant.task_authorization_id);
  assert.deepEqual(await f.store.revoke(f.grant.task_authorization_id), first);
  const later = f.controller();
  const blocked = await later.execute(queued);
  assert.equal(blocked.state.status, "BLOCKED");
  assert.equal(blocked.state.last_error.code, "PERMISSION_DENIED");
  assert.deepEqual(f.calls, []);
  assert.equal((await later.inspect({ operation_id: submitted.state.operation_id, context })).state.status, "BLOCKED");
});

test("one elevated grant covers two exact services and reuses the protected PowerShell tool", async t => {
  const f = await fixture(t);
  const capability = "windows.service.ensure_running";
  const service = (step_id, service_name) => ({ step_id, capability, input: { service_name } });
  const issue = { ...context, goal, capabilities: [capability], expires_at_ms: 200 };
  await assert.rejects(f.store.issue(issue), { code: "PERMISSION_DENIED" });
  const authorized = await f.store.issue({ ...issue, windows_services: ["NexaDev", "NexaWorker"] });
  assert.equal(authorized.permission_level, "workspace_with_admin_service");
  const override = { task_authorization_id: authorized.task_authorization_id };
  const wrongService = await f.intent("service-denied", [service("service", "Unrelated")], override);
  await assert.rejects(f.controller().submit(wrongService), { code: "PERMISSION_DENIED" });
  const wrongGrant = await f.intent("service-standard-grant", [service("service", "NexaDev")]);
  await assert.rejects(f.controller().submit(wrongGrant), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.intent("service-wildcard", [service("service", "Nexa*")], override), { code: "INVALID_WINDOWS_SERVICE_NAME" });
  const work = await f.intent("service-task", [service("service", "NEXADEV"), service("worker", "NexaWorker")], override);
  const completed = await f.controller().execute(work);
  assert.equal(f.adminError(), undefined, f.adminError()?.stack);
  assert.equal(completed.state.status, "COMPLETED", JSON.stringify(completed.state.last_error));
  assert.deepEqual(f.calls, ["powershell_admin_run", "powershell_admin_run"]);
  assert.match(f.adminCalls[0], /Get-Service -Name 'NEXADEV'/u);
  assert.match(f.adminCalls[1], /Get-Service -Name 'NexaWorker'/u);
  assert.equal((await f.journal.listOperations({ operation_type: "powershell_admin_maintenance" })).total, 2);
  await f.store.revoke(authorized.task_authorization_id);
  assert.equal((await f.controller().execute(work)).state.operation_id, completed.state.operation_id);
  assert.equal(f.adminCalls.length, 2);
  await assert.rejects(f.controller().submit(await f.intent("service-revoked", [service("service", "NexaDev")], override)),
    { code: "PERMISSION_DENIED" });
});

test("verified Journal health reports the unresolved terminal identity", async t => {
  const f = await fixture(t);
  const operation = await f.journal.begin({ operation_type: "test", tool_name: "test.fixture" });
  const terminal = await f.journal.fail(operation.operation_id, { result: { outcome: "ambiguous_effect", reconciliation_required: true } });
  const health = await f.journal.status();
  assert.equal(health.health, "degraded");
  assert.equal(health.chain_verified, true);
  assert.equal(health.dangling_operation_count, 0);
  assert.equal(health.ambiguous_terminal_count, 1);
  assert.equal(health.ambiguous_terminal_operations[0].terminal_event_id, terminal.journal_event_id);
  assert.equal(health.ambiguous_terminal_operations[0].operation_id, operation.operation_id);
});
