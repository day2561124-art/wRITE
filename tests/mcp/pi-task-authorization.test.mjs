import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";
import { adaptHostAuthorizedEngineeringRequest } from "../../server/src/pi-engineering-ingress.mjs";
import { hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
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
  const grant = await store.issue({ ...context, goal,
    capabilities: ["filesystem.write", "filesystem.patch", "verification.focused", "git.commit"], expires_at_ms: 200 });
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const route = createPiProductionRouteStore({ journal });
  await route.change({ mode: "pi_default", expected_revision: 0, decision_id: "gpt-task-policy", gate_hash: "a".repeat(64) },
    { validateGate: async () => true });
  const calls = [];
  const adminCalls = [];
  const scriptCalls = [];
  let adminError;
  const admin = createPowerShellMaintenanceTool({ elevated: true, platform: "win32",
    workspaceContextResolver: async () => ({ ...workspace, root }),
    journalApi: { begin: journal.begin, complete: journal.complete, fail: journal.fail, degrade: journal.markDegraded },
    executor: async ({ command, cwd, timeoutMs, scriptAuthorization }) => {
      adminCalls.push(command);
      if (scriptAuthorization) scriptCalls.push(scriptAuthorization);
      return { elevated: true, execution_ok: true, ok: true, command_sha256: "a".repeat(64), cwd,
        timeout_ms: timeoutMs, exit_code: 0, timed_out: false, duration_ms: 1,
        stdout: "service_running", stderr: "", stdout_truncated: false, stderr_truncated: false, reason: null };
    },
  });
  let workstreamState = "active";
  const controller = ({ executionHook, testTimeout = false, loseFirstTestResponse = false } = {}) =>
    createPiProductionExecutionController({ journal, route, executionHook,
    authorizeTask: createPiTaskPolicy({ store: createStore(), required: true }),
    transport: {
      resolveWorkspace: async () => ({ ...workspace, workstream_state: workstreamState }),
      queryOperation: args => loseFirstTestResponse ? journal.getOperation(args) : assert.fail("A normal response must not reconcile"),
      callTool: async ({name, arguments: args, _meta}) => {
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
        if (name === "dev_git_commit") return {
          execution_ok: true, committed: true, commit_created: true, exit_code: 0, commit: "d".repeat(40),
        };
        if (name !== "dev_run_tests") return { ok: true };
        const passed = !testTimeout && (await readFile(file, "utf8")) === "fixed";
        const result = { suite: args.suite, passed, execution_ok: true, timed_out: testTimeout,
          exit_code: testTimeout ? null : passed ? 0 : 1, failure_code: null };
        if (loseFirstTestResponse && calls.filter(tool => tool === name).length === 1) {
          await journal.executeReconciled({ tool_name: name, reconciliation_key: _meta.reconciliation_key,
            request_fingerprint_sha256: hashExecutionInput({ tool_name: name, arguments: args }),
            resolve_workspace_scope: async () => context }, async () => {
            const scope = { suite: args.suite, head: "a".repeat(40), workspace_snapshot_id: "b".repeat(64) };
            const child = await journal.begin({ ...context, operation_type: "test_evidence", tool_name: name, result: scope });
            await journal.complete(child.operation_id, { result: { ...scope, passed, execution_ok: true, timed_out: false,
              verification_manifest_sha256: "c".repeat(64), verification_manifest_gate_result: passed ? "passed" : "failed" } });
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
          });
          throw Object.assign(new Error("Fixture lost the test response after its Journal terminal"), { code: "TRANSPORT_ERROR" });
        }
        return result;
      },
    },
  });
  const intent = (intent_id, requested_actions, overrides = {}) => adaptAuthorizedPiRequest({
    request_kind: "autonomous_engineering", intent_id, goal, workspace_id: context.workspace_id,
    task_authorization_id: grant.task_authorization_id, requested_actions, ...overrides,
  }, { resolveWorkspace: async () => workspace });
  return { store, grant, journal, calls, adminCalls, scriptCalls, adminError: () => adminError, controller, intent, setTime: value => { now = value; },
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

function conditionalPlan({ alreadyFixed = false, lastSuite = verify.input.suite } = {}) {
  return [
    { ...write, input: { ...write.input, content: alreadyFixed ? "fixed" : "broken" } },
    { ...verify, depends_on: ["write"], on_failure: ["patch", "verify-again"] },
    { step_id: "patch", capability: "filesystem.patch", depends_on: ["verify"],
      input: { path: "fixture.txt", oldText: "broken", newText: "fixed", expectedSha256: "b".repeat(64) } },
    { ...verify, step_id: "verify-again", depends_on: ["patch"], input: { suite: lastSuite } },
  ];
}

test("Pi resumes a scheduled test repair and verifies it in the same authorized intent", async t => {
  const f = await fixture(t);
  const intent = await f.intent("automatic-repair", [...conditionalPlan(), {
    step_id: "commit", capability: "git.commit", depends_on: ["verify"],
    input: { message: "Commit the verified fixture", paths: ["fixture.txt"], expectedHead: "b".repeat(40) },
  }]);
  const controller = f.controller({ executionHook: async point => {
    if (point === "verification_recovery_scheduled") throw new Error("fixture worker interrupted");
  } });
  const queued = await controller.submit(intent);
  await assert.rejects(controller.execute(intent), /fixture worker interrupted/u);
  const fresh = f.controller();
  const paused = await fresh.inspect({ operation_id: queued.state.operation_id, context });
  assert.equal(paused.state.recovery.active_step, "verify");
  assert.equal(paused.state.last_error.code, "TEST_FAILURE");
  assert.equal(paused.state.pending_steps[0], "patch");
  const journalEvents = await f.journal.readExecutionProjections();
  const selected = journalEvents.find(event => event.execution_projection.command.type === "verification_recovery_scheduled");
  assert.equal(selected.execution_projection.command.receipt.evidence.exit_code, 1);
  const completed = await fresh.execute(intent);
  assert.equal(completed.state.status, "COMPLETED");
  assert.deepEqual(completed.state.recovery, { active_step: null, recovered_steps: ["verify"], skipped_steps: [] });
  assert.deepEqual(completed.state.completed_steps, ["write", "patch", "verify-again", "commit"]);
  assert.equal(completed.state.verification_state.focused, "passed");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests", "dev_apply_patch", "dev_run_tests", "dev_git_commit"]);
  assert.equal((await fresh.execute(intent)).state.operation_id, queued.state.operation_id);
  assert.equal(f.calls.length, 5);
  const latest = (await fresh.listOperations({ context })).operations[0];
  assert.deepEqual(latest.recovery, completed.state.recovery);
  assert.equal((await f.journal.status()).health, "healthy");
});

test("initial success skips all repair steps and an infrastructure timeout never triggers repairs", async t => {
  const f = await fixture(t);
  const success = await f.intent("repair-not-needed", conditionalPlan({ alreadyFixed: true }));
  const result = await f.controller().execute(success);
  assert.equal(result.state.status, "COMPLETED");
  assert.deepEqual(result.state.recovery.skipped_steps, ["patch", "verify-again"]);
  assert.equal(result.state.verification_state.focused, "passed");
  const timeout = await f.intent("repair-timeout", conditionalPlan({ alreadyFixed: true }).slice(1)
    .map(step => step.step_id === "verify" ? { ...step, depends_on: [] } : step));
  const declined = await f.controller({ testTimeout: true }).execute(timeout);
  assert.equal(declined.state.status, "DECISION_REQUIRED");
  assert.equal(declined.state.recovery.active_step, null);
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests", "dev_run_tests"]);
});

test("a verified failed test receipt can schedule repairs after a lost response", async t => {
  const f = await fixture(t);
  const intent = await f.intent("test-response-lost", conditionalPlan());
  const result = await f.controller({ loseFirstTestResponse: true }).execute(intent);
  assert.equal(result.state.status, "COMPLETED");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests", "dev_apply_patch", "dev_run_tests"]);
  const projections = await f.journal.readExecutionProjections();
  const selected = projections.find(event => event.execution_projection.command.type === "verification_recovery_scheduled");
  const receipt = selected.execution_projection.command.receipt;
  assert.equal(receipt.kind, "reconciled_facts");
  assert.equal(receipt.evidence.original_result.passed, false);
  assert.equal(result.state.verification_state.focused, "passed");
  assert.equal((await f.journal.status()).chain_verified, true);
});

test("failure recovery respects grant revocation and must finish by rerunning the exact suite", async t => {
  const f = await fixture(t);
  await assert.rejects(f.intent("mismatched-repair-suite", conditionalPlan({ lastSuite: "mcp_tunnel" })),
    { code: "INVALID_FAILURE_RECOVERY" });
  const intent = await f.intent("revoked-repair", conditionalPlan());
  const controller = f.controller({ executionHook: async point => {
    if (point === "verification_recovery_scheduled") await f.store.revoke(f.grant.task_authorization_id);
  } });
  const result = await controller.execute(intent);
  assert.equal(result.state.status, "BLOCKED");
  assert.equal(result.state.last_error.code, "PERMISSION_DENIED");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests"]);
  assert.equal(result.state.recovery.active_step, "verify");
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

test("Pi reuses exact sandbox and scoped administrator receipts after their transport responses are lost", async t => {
  const f = await fixture(t);
  const capabilities = ["workspace.powershell_isolated", "windows.service.ensure_running", "windows.powershell.run_approved"];
  const script = { script_id: "reviewed-transport-fixture", script_sha256: "c".repeat(64) };
  const grant = await f.store.issue({ ...context, goal, capabilities, windows_services: ["NexaDev"], windows_scripts: [script], expires_at_ms: 200 });
  const work = await f.intent("reconcile-command-receipts", [
    { step_id: "shell", capability: capabilities[0], input: { command: "Write-Output 'fixture'" } },
    { step_id: "service", capability: capabilities[1], input: { service_name: "NexaDev" }, depends_on: ["shell"] },
    { step_id: "script", capability: capabilities[2], input: script, depends_on: ["service"] },
  ], { task_authorization_id: grant.task_authorization_id });
  const calls = [];
  const controller = () => createPiProductionExecutionController({ journal: f.journal,
    route: createPiProductionRouteStore({ journal: f.journal }),
    authorizeTask: createPiTaskPolicy({ store: f.store, required: true }),
    transport: {
      resolveWorkspace: async () => workspace,
      queryOperation: args => f.journal.getOperation(args),
      callTool: async params => {
        calls.push(params.arguments);
        await f.journal.executeReconciled({ tool_name: params.name, reconciliation_key: params._meta.reconciliation_key,
          request_fingerprint_sha256: hashExecutionInput({ tool_name: params.name, arguments: params.arguments }),
          resolve_workspace_scope: async () => context }, async () => ({
          content: [{ type: "text", text: JSON.stringify({ ok: true, execution_ok: true, timed_out: false, exit_code: 0 }) }],
        }));
        throw Object.assign(new Error("Lost the response after publishing the journal receipt"), { code: "TRANSPORT_ERROR" });
      },
    },
  });
  const completed = await controller().execute(work);
  assert.equal(completed.state.status, "COMPLETED");
  assert.deepEqual(completed.state.completed_steps, ["shell", "service", "script"]);
  assert.equal(calls[0].sandbox, true);
  assert.equal(calls[1].service_authorization.task_authorization_id, grant.task_authorization_id);
  assert.equal(calls[2].script_authorization.script_sha256, script.script_sha256);
  assert.equal((await controller().execute(work)).state.operation_id, completed.state.operation_id);
  assert.equal(calls.length, 3);
  assert.equal((await f.journal.status()).health, "healthy");
});

test("Pi validates the protected script's identifier, digest and workstream before dispatch", async t => {
  const f = await fixture(t);
  const capability = "windows.powershell.run_approved";
  const script = { script_id: "repair-development-fixture", script_sha256: "c".repeat(64) };
  const issue = { ...context, goal, capabilities: [capability], expires_at_ms: 200 };
  await assert.rejects(f.store.issue(issue), { code: "PERMISSION_DENIED" });
  await assert.rejects(f.store.issue({ ...issue, windows_scripts: [{ ...script, script_id: "nul" }] }), { code: "PERMISSION_DENIED" });
  const grant = await f.store.issue({ ...issue, windows_scripts: [script] });
  const override = { task_authorization_id: grant.task_authorization_id };
  const step = { step_id: "script", capability, input: script };
  const changed = await f.intent("script-wrong-digest", [{ ...step, input: { ...script, script_sha256: "d".repeat(64) } }], override);
  await assert.rejects(f.controller().submit(changed), { code: "PERMISSION_DENIED" });
  const unbound = await f.intent("script-wrong-grant", [step]);
  await assert.rejects(f.controller().submit(unbound), { code: "PERMISSION_DENIED" });
  assert.deepEqual(f.calls, []);

  const request = await f.intent("script-approved", [step], override);
  const completed = await f.controller().execute(request);
  assert.equal(completed.state.status, "COMPLETED");
  assert.deepEqual(f.scriptCalls, [{ workspace_id: context.workspace_id, workstream_id: context.workstream_id, goal,
    task_authorization_id: grant.task_authorization_id, ...script }]);
  assert.deepEqual(f.adminCalls, [`approved_script:${script.script_id}:${script.script_sha256}`]);
  const child = (await f.journal.verify()).events.find(event => event.operation_type === "powershell_admin_maintenance"
    && event.stage === "operation_started");
  assert.equal(child.result.script_sha256, script.script_sha256);
  await f.store.revoke(grant.task_authorization_id);
  await assert.rejects(f.controller().submit(await f.intent("script-revoked", [step], override)), { code: "PERMISSION_DENIED" });
  assert.equal(f.scriptCalls.length, 1);
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

test("host-bound engineering request retains durable dispatch and revocation checks", async t => {
  const f = await fixture(t);
  const build = (intent_id, requested_actions) => adaptHostAuthorizedEngineeringRequest({
    request_kind: "autonomous_engineering", intent_id, goal,
    workspace_id: context.workspace_id, requested_actions,
  }, { resolveWorkspace: async () => workspace,
    approvedGrantId: f.grant.task_authorization_id, authorizeTask: f.store.authorize });
  const first = await build("host-ingress-dispatch", [
    { ...write, input: { ...write.input, content: "fixed" } },
    { ...verify, depends_on: ["write"] },
  ]);
  const done = await f.controller().execute(first);
  assert.equal(done.state.status, "COMPLETED");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests"]);
  assert.equal((await f.controller().execute(first)).state.operation_id, done.state.operation_id);
  const queued = await build("host-ingress-revoked", [verify]);
  const submitted = await f.controller().submit(queued);
  await f.store.revoke(f.grant.task_authorization_id);
  const restarted = f.controller();
  const blocked = await restarted.execute(queued);
  assert.equal(blocked.state.status, "BLOCKED");
  assert.equal(blocked.state.last_error.code, "PERMISSION_DENIED");
  assert.deepEqual(f.calls, ["dev_create_file", "dev_run_tests"]);
  assert.equal((await restarted.inspect({ operation_id: submitted.state.operation_id, context })).state.status, "BLOCKED");
  assert.equal((await f.journal.status()).chain_verified, true);
});
