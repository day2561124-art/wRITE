import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";
import { createPiProductionExecutionController, guardPiDirectExecution } from "../../server/src/pi-production-execution-controller.mjs";
import { createPiProductionRouteStore } from "../../server/src/pi-production-execution-route.mjs";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createDevWorkstreamRegistryService } from "../../server/src/mcp-development-workstream-tools.mjs";
import { dev_read_file, dev_search_files, dev_list_directory } from "../../server/src/mcp-development-readonly-tools.mjs";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { hashExecutionInput, REQUIRED_DECISION_BOUNDARIES } from "../../server/src/pi-execution-contract.mjs";

const context = { workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261008-010000_" + "b".repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active", healthy: true, mutation_allowed: true };
const resolveWorkspace = async () => context;
const route = { inspect: async () => ({ revision: 1, mode: "pi_default" }) };
const request = (capability = "filesystem.write", input = { path: "scripts/probe.mjs", content: "// exact GPT bytes\n" }) => ({
  schema_version: 1, request_kind: "authorized_engineering", intent_id: "policy-authorized-001",
  goal: "Execute precisely the authorized action", workspace_id: context.workspace_id,
  constraints: ["No integrate, push, cutover or scope expansion"],
  requested_actions: [{ step_id: "execute", capability, input }],
  permissions: { read: true, write: true, tests: true, commit: false },
  completion_conditions: ["GPT reviews the returned facts"],
});

test("authorized request fills mechanical fields deterministically without granting permissions", async () => {
  const source = request();
  const before = JSON.stringify(source);
  const intent = await adaptAuthorizedPiRequest(source, { resolveWorkspace });
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(intent.requested_actions[0].input, source.requested_actions[0].input);
  assert.deepEqual(intent.context, { project_id: "writer_workbench", workspace_id: context.workspace_id, workstream_id: context.workstream_id });
  assert.equal(intent.mutation_plan[0].input_sha256, hashExecutionInput(source.requested_actions[0].input));
  assert.equal(intent.mutation_plan[0].target, "scripts/probe.mjs");
  assert.equal(intent.permissions.integrate, false);
  assert.equal(intent.permissions.push, false);
  assert.equal(intent.permissions.workspace_create, false);
  assert.equal(intent.permissions.commit, false);
  assert.deepEqual(intent.decision_boundaries, [...REQUIRED_DECISION_BOUNDARIES]);
  assert.deepEqual(await adaptAuthorizedPiRequest(source, { resolveWorkspace }), intent);
  assert.deepEqual(await adaptAuthorizedPiRequest(intent), intent); // Full-contract compatibility.
  const verify = await adaptAuthorizedPiRequest(request("verification.focused", { suite: "mcp_core" }), { resolveWorkspace });
  assert.deepEqual(verify.verification, { focused: ["execute"], affected: [], full: [] });
});

test("adapter rejects unauthorized mutation, high-risk capabilities and caller mechanical overrides", async () => {
  for (const capability of ["git.integrate", "git.push", "filesystem.delete", "production.cutover", "host.powershell_admin", "workspace.update_workstream"]) {
    await assert.rejects(adaptAuthorizedPiRequest(request(capability, {}), { resolveWorkspace }), { code: "STRICT_EXECUTION_INTENT_REQUIRED" });
  }
  for (const permissions of [{}, { read: true }, { write: false }, { write: "true" }, { write: true, integrate: true }]) {
    await assert.rejects(adaptAuthorizedPiRequest({ ...request(), permissions }, { resolveWorkspace }));
  }
  for (const key of ["context", "mutation_plan", "verification", "bootstrap", "env", "executable"]) {
    await assert.rejects(adaptAuthorizedPiRequest({ ...request(), [key]: {} }, { resolveWorkspace }), { code: "INVALID_AUTHORIZED_REQUEST" });
  }
  for (const input of [{ path: "../other/probe.mjs", content: "x" }, { path: "scripts/probe.mjs", content: "x", workspace_id: "other" }]) {
    await assert.rejects(adaptAuthorizedPiRequest(request("filesystem.write", input), { resolveWorkspace }));
  }
  await assert.rejects(adaptAuthorizedPiRequest({ ...request(), decision_boundaries: [] }, { resolveWorkspace }), { code: "MISSING_DECISION_BOUNDARY" });
  await assert.rejects(adaptAuthorizedPiRequest({ ...request(), goal: "x".repeat(600000) }, { resolveWorkspace }), { code: "CONTRACT_SIZE_LIMIT" });
});

test("adapter binds the registered active isolated workspace and preserves explicit schema expectations", async () => {
  for (const edit of [{ workspace_id: "dev_workspace_" + "c".repeat(24) }, { workspace_type: "shared" }, { lifecycle_state: "removed" }, { healthy: false }, { mutation_allowed: false }]) {
    await assert.rejects(adaptAuthorizedPiRequest(request(), { resolveWorkspace: async () => ({ ...context, ...edit }) }), { code: "WORKSPACE_IDENTITY_MISMATCH" });
  }
  await assert.rejects(adaptAuthorizedPiRequest({ ...request(), workspace_id: "dev_workspace_shared_repository_v1" }, { resolveWorkspace }), { code: "ISOLATED_WORKSPACE_REQUIRED" });
  const source = request();
  Object.assign(source.requested_actions[0], { expected_capability_version: "2", expected_schema_hash: "d".repeat(64), idempotency_key: "gpt-explicit-key-001" });
  const intent = await adaptAuthorizedPiRequest(source, { resolveWorkspace });
  assert.equal(intent.requested_actions[0].expected_capability_version, "2");
  assert.equal(intent.requested_actions[0].expected_schema_hash, "d".repeat(64));
  assert.equal(intent.requested_actions[0].idempotency_key, "gpt-explicit-key-001");
});

test("adapter uses the actual registry context contract of a registered Git worktree", async t => {
  const fixtureParent = fileURLToPath(new URL("../.tmp/", import.meta.url));
  await mkdir(fixtureParent, { recursive: true });
  const root = await mkdtemp(path.join(fixtureParent, "pi-policy-registry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repo");
  await mkdir(repositoryRoot);
  const git = (args, options = {}) => promisify(execFile)(process.platform === "win32" ? "git.exe" : "git", args,
    { cwd: options.cwd ?? repositoryRoot, windowsHide: true, timeout: 30000 });
  await git(["init", "-b", "main"]);
  await git(["config", "user.name", "Pi Policy Test"]);
  await git(["config", "user.email", "pi-policy@test.invalid"]);
  await writeFile(path.join(repositoryRoot, "probe.txt"), "tracked\n");
  await git(["add", "probe.txt"]);
  await git(["commit", "-m", "test fixture"]);
  const service = createDevWorkstreamRegistryService({ repositoryRoot, registryPath: path.join(root, "registry.json"),
    worktreeRootPath: path.join(root, ".writer-workbench-worktrees"), gitRunner: git,
    headReader: async () => (await git(["rev-parse", "HEAD"])).stdout.trim() });
  const workstream = await service.begin({ label: "Authorized policy fixture", declared_scope: ["scripts/probe.mjs"] });
  const workspace = await service.createIsolated({ workstream_id: workstream.workstream_id, expected_workstream_revision: workstream.revision });
  const source = { ...request(), workspace_id: workspace.workspace_id };
  const intent = await adaptAuthorizedPiRequest(source, { resolveWorkspace: service.resolveExecutionContext });
  assert.equal(intent.context.workstream_id, workstream.workstream_id);
  assert.equal(intent.context.workspace_id, workspace.workspace_id);
  const args = { workspace_id: workspace.workspace_id, path: "probe.txt" };
  await guardPiDirectExecution({ route, tool: "dev_read_file", params: { arguments: args }, resolveWorkspace: service.resolveExecutionContext });
  assert.match((await dev_read_file(args, { workspaceContextResolver: service.resolveExecutionContext })).content, /tracked/);
  await assert.rejects(guardPiDirectExecution({ route, tool: "dev_read_file", params: { arguments: { ...args, workspace_id: context.workspace_id } }, resolveWorkspace: service.resolveExecutionContext }), /Unknown workspace/);
});

test("read route is finite, workspace-bound and cannot admit shell or mutation", async () => {
  let resolutions = 0;
  const binding = async (input, options) => {
    resolutions++;
    assert.deepEqual(input, { workspace_id: context.workspace_id });
    assert.deepEqual(options, { mutation: false });
    return context;
  };
  const params = { arguments: { workspace_id: context.workspace_id } };
  for (const tool of ["dev_read_file", "dev_read_file_range", "dev_search_files", "dev_list_directory", "dev_get_file_info", "dev_git_status", "dev_git_diff", "dev_git_diff_check", "dev_pi_execute_readonly"]) {
    await guardPiDirectExecution({ route, tool, params, mutation: false, resolveWorkspace: binding });
  }
  assert.equal(resolutions, 9);
  for (const tool of ["powershell_run", "powershell_admin_run", "dev_create_file", "dev_apply_patch", "dev_delete_file", "dev_git_commit", "dev_workspace_integrate", "dev_git_push", "unknown_read_tool"]) {
    await assert.rejects(guardPiDirectExecution({ route, tool, params, mutation: false, resolveWorkspace: binding }), { code: "PI_EXECUTION_INTENT_REQUIRED" });
  }
  await assert.rejects(guardPiDirectExecution({ route, tool: "dev_read_file", params, mutation: true, resolveWorkspace: binding }), { code: "PI_EXECUTION_INTENT_REQUIRED" });
  await assert.rejects(guardPiDirectExecution({ route, tool: "dev_read_file", params: {}, resolveWorkspace: binding }), { code: "PI_EXECUTION_INTENT_REQUIRED" });
  await assert.rejects(guardPiDirectExecution({ route, tool: "dev_read_file", params, resolveWorkspace: async () => ({ workspace_id: "other" }) }), { code: "WORKSPACE_IDENTITY_MISMATCH" });
  await assert.rejects(guardPiDirectExecution({ route: { inspect: async () => { throw Error("corrupt route"); } }, tool: "dev_read_file", params, resolveWorkspace: binding }), /corrupt route/);
});

test("lightweight reads reuse real path, secret, symlink and output limits in separate workspaces", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-policy-paths-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const left = path.join(root, "left"), right = path.join(root, "right");
  await mkdir(left); await mkdir(right);
  await writeFile(path.join(left, "probe.txt"), "authorized-left\n");
  await writeFile(path.join(right, "probe.txt"), "other-workspace\n");
  await writeFile(path.join(left, ".env"), "SECRET=hidden\n");
  await writeFile(path.join(left, "large.txt"), "x".repeat(262145));
  await symlink(right, path.join(left, "linked"), process.platform === "win32" ? "junction" : "dir");
  const resolver = async args => ({ ...context, workspace_id: args.workspace_id, root: args.workspace_id === context.workspace_id ? left : right });
  const options = { workspaceContextResolver: resolver };
  const args = { workspace_id: context.workspace_id, path: "probe.txt" };
  await guardPiDirectExecution({ route, tool: "dev_read_file", params: { arguments: args }, resolveWorkspace: resolver });
  assert.equal((await dev_read_file(args, options)).content, "authorized-left\n");
  assert.equal((await dev_read_file({ ...args, workspace_id: "dev_workspace_" + "c".repeat(24) }, options)).content, "other-workspace\n");
  for (const target of ["../right/probe.txt", path.join(right, "probe.txt"), ".env", "linked/probe.txt", "large.txt", ".git/config"]) {
    await assert.rejects(dev_read_file({ ...args, path: target }, options));
  }
  await assert.rejects(dev_read_file({ ...args, maxBytes: 999999 }, options));
  const listing = await dev_list_directory({ workspace_id: context.workspace_id, path: "." }, options);
  assert.equal(listing.entries.some(entry => entry.name === ".env"), false);
  const search = await dev_search_files({ workspace_id: context.workspace_id, path: ".", query: "authorized-left" }, options);
  assert.equal(search.matches.length, 1);
  assert.equal(await readFile(path.join(right, "probe.txt"), "utf8"), "other-workspace\n");
});

test("authorized PowerShell retains formal Pi persistence, exact dispatch and duplicate suppression", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-policy-powershell-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const productionRoute = createPiProductionRouteStore({ journal });
  await productionRoute.change({ mode: "pi_default", decision_id: "gpt-policy-test", gate_hash: "a".repeat(64), expected_revision: 0 }, { validateGate: async () => true });
  let calls = 0;
  let dispatchError;
  const hostContext = { ...context, workspace_id: "dev_workspace_shared_repository_v1", root,
    branch: "main", base_head: "a".repeat(40), current_head: "a".repeat(40) };
  const tool = createPowerShellMaintenanceTool({ elevated: false, workspaceContextResolver: async () => hostContext,
    journalApi: {
      begin: input => journal.begin(input),
      complete: (id, input) => journal.complete(id, input),
      fail: (id, input) => journal.fail(id, input),
      degrade: async () => { throw Error("unexpected journal degradation"); },
    },
  });
  const input = { command: "Write-Output 'pi-policy-powershell-ok'", cwd: ".", timeoutMs: 5000 };
  const intent = await adaptAuthorizedPiRequest(request("host.powershell", input), { resolveWorkspace });
  const controller = createPiProductionExecutionController({ journal, route: productionRoute, transport: {
    resolveWorkspace, queryOperation: async args => ({ ...args, reconciliation_state: "unknown" }),
    verifyScope: async ({ step }) => step.scope === "host_maintenance" && step.arguments.workspace_id === hostContext.workspace_id,
    callTool: async params => {
      calls++;
      assert.equal(params.name, "powershell_run");
      assert.deepEqual(params.arguments, { ...input, workspace_id: hostContext.workspace_id });
      assert.equal(params._meta.reconciliation_key, intent.requested_actions[0].idempotency_key);
      try { return await tool(params.arguments); }
      catch (error) { dispatchError = error; throw error; }
    },
  } });
  const result = await controller.execute(intent);
  assert.equal(dispatchError, undefined, dispatchError?.stack);
  assert.equal(result.state.status, "COMPLETED", JSON.stringify(result.state.last_error));
  assert.match(JSON.stringify(result.receipts), /pi-policy-powershell-ok/);
  assert.equal(result.result.persistence_enabled, true);
  assert.equal((await controller.execute(intent)).projection_hash, result.projection_hash);
  assert.equal(calls, 1);
  assert.equal((await journal.status()).health, "healthy");
});

test("real MCP permits explicit scoped reads without mutation transactions and blocks direct mutations", async t => {
  const group = randomUUID();
  const root = path.join(os.tmpdir(), "writer-workbench-operation-journal-test-" + group);
  t.after(() => rm(root, { recursive: true, force: true }));
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "operation-journal") });
  await createPiProductionRouteStore({ journal }).change({ mode: "pi_default", decision_id: "gpt-policy-wire", gate_hash: "a".repeat(64), expected_revision: 0 }, { validateGate: async () => true });
  const adapterUrl = new URL("../../server/src/mcp-http-stdio-adapter.mjs", import.meta.url).href;
  const code = `import {createStdioSession} from ${JSON.stringify(adapterUrl)};
    const session=createStdioSession({readonlyRetryMaxAttempts:0});
    const call=m=>new Promise((r,j)=>session.call(m,(e,v)=>e?j(e):r(v)));
    try {
      await call({jsonrpc:'2.0',id:'init',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'policy-wire',version:'1'}}});
      session.send({jsonrpc:'2.0',method:'notifications/initialized',params:{}});
      const results={};
      for(const [name,args] of [
        ['dev_read_file',{path:'package.json',maxBytes:8192}],
        ['dev_search_files',{path:'scripts',query:'submitPiExecutionIntent',maxResults:2}],
        ['dev_git_status',{includeUntracked:false}],
        ['dev_capability_list',{limit:2}],
        ['dev_pi_runtime_status',{}],
        ['dev_create_file',{path:'scripts/must-not-create.mjs',content:'denied'}],
        ['powershell_run',{command:"Write-Output 'must-not-dispatch'"}],
        ['powershell_admin_run',{command:'Get-Process'}],
      ]) results[name]=await call({jsonrpc:'2.0',id:name,method:'tools/call',params:{name,arguments:{...args,...(name.startsWith('dev_capability')||name==='dev_pi_runtime_status'?{}:{workspace_id:'dev_workspace_shared_repository_v1'})}}});
      console.log(JSON.stringify(results));
    } finally {session.close();}`;
  const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), windowsHide: true, timeout: 120000, maxBuffer: 1048576,
    env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_developer", WRITER_WORKBENCH_TEST_JOURNAL_GROUP: group,
      WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL: "1", WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT: "1", WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION: "1" },
  });
  const results = JSON.parse(stdout);
  for (const name of ["dev_read_file", "dev_search_files", "dev_git_status", "dev_capability_list", "dev_pi_runtime_status"]) {
    assert.equal(results[name].error, undefined, JSON.stringify(results[name]));
    assert.notEqual(results[name].result.isError, true, JSON.stringify(results[name]));
  }
  for (const name of ["dev_create_file", "powershell_run", "powershell_admin_run"]) {
    assert.equal(results[name].error.message, "PI_EXECUTION_INTENT_REQUIRED");
  }
  assert.equal((await journal.listOperations({ operation_type: "pi_diagnostic_fallback" })).total, 0);
  assert.equal((await journal.listOperations({ operation_type: "pi_execution_projection" })).total, 0);
  assert.equal((await journal.listOperations()).total, 1); // Only the fixture's initial route record.
});
