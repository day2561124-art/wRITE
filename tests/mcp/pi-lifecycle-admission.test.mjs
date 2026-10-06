import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createExecutionIntent, hashExecutionInput, capabilityDefinition, REQUIRED_DECISION_BOUNDARIES } from "../../server/src/pi-execution-contract.mjs";
import { createMcpCapabilityAdapter } from "../../server/src/pi-mcp-adapter.mjs";
import { createPiReliableMcpAdapter } from "../../server/src/pi-mcp-reliable-adapter.mjs";
import { createPiReliableExecutionStore } from "../../server/src/pi-reliable-execution-store.mjs";
import { createPiReliableExecutionEngine } from "../../server/src/pi-reliable-execution-engine.mjs";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createDevWorkstreamRegistryService } from "../../server/src/mcp-development-workstream-tools.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const context = { project_id: "writer_workbench", workstream_id: "dev_workstream_20261004-031724_a929be8db22b", workspace_id: "dev_workspace_" + "a".repeat(24) };
const operationId = "dev_operation_" + "b".repeat(32);
const checkpointId = "dev_checkpoint_" + "c".repeat(32);
const base = "1".repeat(40);
const workstream = { ...context, base_head: base, mode: "isolated", state: "active", revision: 5 };
const checkpoint = { ...context, checkpoint_id: checkpointId, state: "active", health: "healthy", workstream_base_head: base, git_head: base, workspace_snapshot_id: "2".repeat(64) };
const operation = { ...context, operation_id: operationId };
function intent(capability, input, effect = false, overrides = {}) {
  const action = { step_id: "lifecycle", capability, input, depends_on: [], ...(effect ? { idempotency_key: "lifecycle-effect-key-001" } : {}) };
  return { schema_version: 1, intent_id: "lifecycle-admission-001", goal: "Execute the GPT-selected lifecycle capability", context,
    constraints: ["Keep sealed production routing and shared main intact"], requested_actions: [action],
    mutation_plan: effect ? [{ step_id: action.step_id, target: capability === "workspace.create_checkpoint" ? context.workspace_id : context.workstream_id,
      expected_change: "Apply the exact GPT-selected lifecycle operation", input_sha256: hashExecutionInput(input) }] : [],
    verification: { focused: [], affected: [], full: [] }, completion_conditions: ["GPT reviews the observed facts"],
    permissions: { read: true, workspace_create: true, write: true, tests: false, commit: false, integrate: false, push: false },
    decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES], ...overrides };
}
async function scope(overrides = {}) {
  const { createPiLifecycleScopeVerifier } = await import("../../server/src/pi-lifecycle-scope.mjs");
  return createPiLifecycleScopeVerifier({
    getWorkstream: async () => workstream,
    getCheckpoint: async () => checkpoint,
    getOperation: async () => operation,
    ...overrides,
  });
}
const cases = [
  ["workspace.get_workstream", { workstream_id: context.workstream_id }, "dev_workspace_get_workstream", { workstream_id: context.workstream_id }],
  ["workspace.get_checkpoint", { checkpoint_id: checkpointId }, "dev_workspace_get_checkpoint", { checkpoint_id: checkpointId }],
  ["workspace.get_operation", { operation_id: operationId }, "dev_workspace_get_operation", { operation_id: operationId }],
  ["workspace.list_operations", { limit: 12, after_sequence: 0 }, "dev_workspace_list_operations", { limit: 12, after_sequence: 0, workspace_id: context.workspace_id, workstream_id: context.workstream_id }],
  ["workspace.get_provenance", { path: "server/src/pi-execution-contract.mjs", limit: 12 }, "dev_workspace_get_provenance", { path: "server/src/pi-execution-contract.mjs", limit: 12, workspace_id: context.workspace_id }],
];
for (const [capability, input, tool, args] of cases) test(`${capability} maps to the existing bounded MCP API`, () => {
  const source = createExecutionIntent(intent(capability, input));
  const step = createMcpCapabilityAdapter().describe(source, "lifecycle");
  assert.equal(step.tool, tool); assert.equal(step.effect, false); assert.equal(step.permission, "read");
  assert.deepEqual(step.arguments, args); assert.equal(step.input_hash, hashExecutionInput(input));
});
test("checkpoint creation is a write with explicit permission, exact target and one key", () => {
  const source = intent("workspace.create_checkpoint", { label: "GPT checkpoint" }, true);
  const step = createMcpCapabilityAdapter().describe(source, "lifecycle");
  assert.equal(step.tool, "dev_workspace_create_checkpoint"); assert.equal(step.effect, true); assert.equal(step.permission, "write");
  assert.deepEqual(step.arguments, { label: "GPT checkpoint", workspace_id: context.workspace_id });
  assert.throws(() => createExecutionIntent({ ...source, permissions: { ...source.permissions, write: false } }), /PERMISSION_DENIED/);
  assert.throws(() => createExecutionIntent({ ...source, mutation_plan: [{ ...source.mutation_plan[0], target: "other-workspace" }] }), /MUTATION_TARGET_MISMATCH/);
  const actionWithoutKey = { ...source.requested_actions[0] };
  delete actionWithoutKey.idempotency_key;
  assert.throws(() => createExecutionIntent({ ...source, requested_actions: [actionWithoutKey] }), /INVALID_IDEMPOTENCY_KEY/);
});
test("workstream recovery update is a CAS-guarded write with exact target and one key", () => {
  const source = intent("workspace.update_workstream", {
    workstream_id: context.workstream_id, expected_revision: 5, state: "active",
  }, true);
  const step = createMcpCapabilityAdapter().describe(source, "lifecycle");
  assert.equal(step.tool, "dev_workspace_update_workstream");
  assert.equal(step.permission, "write"); assert.equal(step.effect, true); assert.equal(step.scope, "workstream_update");
  assert.deepEqual(step.arguments, { workstream_id: context.workstream_id, expected_revision: 5, state: "active" });
  assert.throws(() => createExecutionIntent({ ...source, permissions: { ...source.permissions, write: false } }), /PERMISSION_DENIED/);
  assert.throws(() => createExecutionIntent({ ...source, mutation_plan: [{ ...source.mutation_plan[0], target: "other" }] }), /MUTATION_TARGET_MISMATCH/);
  assert.throws(() => createExecutionIntent(intent("workspace.update_workstream", { workstream_id: context.workstream_id, expected_revision: 5, state: "completed" }, true)), /INVALID_WORKSTREAM_STATE/);
  assert.throws(() => createExecutionIntent(intent("workspace.update_workstream", { workstream_id: context.workstream_id, state: "active" }, true)));
});
test("create_isolated uses the existing workspace creation semantics and CAS", () => {
  const source = intent("workspace.create_isolated", { workstream_id: context.workstream_id, expected_workstream_revision: 5 }, true);
  const step = createMcpCapabilityAdapter().describe(source, "lifecycle");
  assert.equal(step.tool, "dev_workspace_create_isolated"); assert.equal(step.permission, "workspace_create"); assert.equal(step.scope, "workstream");
  assert.throws(() => createExecutionIntent({ ...source, permissions: { ...source.permissions, workspace_create: false } }), /PERMISSION_DENIED/);
});
test("new observation inputs cannot supply different scopes, arbitrary code or unbounded queries", () => {
  for (const [capability, input] of [
    ["workspace.get_workstream", { workstream_id: "dev_workstream_20261004-031724_" + "b".repeat(12) }],
    ["workspace.list_operations", { workspace_id: context.workspace_id }],
    ["workspace.list_operations", { workstream_id: context.workstream_id }],
    ["workspace.list_operations", { limit: 51 }], ["workspace.list_operations", { after_sequence: -1 }],
    ["workspace.list_operations", { outcome: "invented" }], ["workspace.list_operations", { operation_type: "x".repeat(161) }],
    ["workspace.get_checkpoint", { checkpoint_id: "../other" }],
    ["workspace.get_provenance", { path: "../outside" }], ["workspace.get_provenance", { path: "C:\\outside" }],
    ["workspace.get_provenance", { path: "package.json", commit: base }],
    ["workspace.get_operation", { operation_id: operationId, reconciliation_key: "caller-substitution" }],
  ]) assert.throws(() => createExecutionIntent(intent(capability, input)), undefined, capability + JSON.stringify(input));
});
test("checkpoint label and shared-main mutation target fail at contract admission", () => {
  assert.throws(() => createExecutionIntent(intent("workspace.create_checkpoint", { label: "x".repeat(161) }, true)));
  const shared = { ...context, workspace_id: "dev_workspace_shared_repository_v1" };
  const source = intent("workspace.create_checkpoint", {}, true, { context: shared });
  source.mutation_plan[0].target = shared.workspace_id;
  assert.throws(() => createExecutionIntent(source), /ISOLATED_WORKSPACE_REQUIRED/);
});
test("original sealed read intent hash and arguments remain unchanged", () => {
  const source = intent("filesystem.read", { path: "package.json", maxBytes: 4096 });
  assert.equal(hashExecutionInput(createExecutionIntent(source)), hashExecutionInput(source));
  assert.deepEqual(createMcpCapabilityAdapter().describe(source, "lifecycle").arguments, { path: "package.json", maxBytes: 4096, workspace_id: context.workspace_id });
  assert.equal(capabilityDefinition("workspace.create").tool, "dev_workspace_create_isolated");
});
test("workstream observations permit terminal state without reopening it", async () => {
  const verify = await scope({ getWorkstream: async () => ({ ...workstream, state: "completed" }) });
  const step = createMcpCapabilityAdapter().describe(intent("workspace.get_workstream", { workstream_id: context.workstream_id }), "lifecycle");
  assert.equal(await verify({ context, step }), true);
  for (const property of ["workspace_id", "workstream_id"]) {
    const mismatch = await scope({ getWorkstream: async () => ({ ...workstream, [property]: "different" }) });
    assert.equal(await mismatch({ context, step }), false);
  }
});
test("operation reads require the original workstream and workspace identity", async () => {
  const step = createMcpCapabilityAdapter().describe(intent("workspace.get_operation", { operation_id: operationId }), "lifecycle");
  assert.equal(await (await scope())({ context, step }), true);
  for (const change of [{ operation_id: "dev_operation_" + "d".repeat(32) }, { workstream_id: "other" }, { workspace_id: "other" }]) {
    const verify = await scope({ getOperation: async () => ({ ...operation, ...change }) });
    assert.equal(await verify({ context, step }), false, JSON.stringify(change));
  }
});
test("recovery scope accepts exact paused or blocked CAS and rejects stale or terminal identity", async () => {
  const step = createMcpCapabilityAdapter().describe(intent("workspace.update_workstream", {
    workstream_id: context.workstream_id, expected_revision: 5, state: "active",
  }, true), "lifecycle");
  for (const state of ["paused", "active"]) {
    const verify = await scope({ getWorkstream: async () => ({ ...workstream, state }) });
    assert.equal(await verify({ context, step }), true, state);
  }
  for (const change of [
    { revision: 6 }, { state: "completed" }, { state: "abandoned" },
    { workspace_id: "other" }, { workstream_id: "other" },
  ]) {
    const verify = await scope({ getWorkstream: async () => ({ ...workstream, ...change }) });
    assert.equal(await verify({ context, step }), false, JSON.stringify(change));
  }
});
test("checkpoint reads require the original workstream, workspace and base plus healthy active identity", async () => {
  const step = createMcpCapabilityAdapter().describe(intent("workspace.get_checkpoint", { checkpoint_id: checkpointId }), "lifecycle");
  assert.equal(await (await scope())({ context, step }), true);
  for (const change of [ { checkpoint_id: "dev_checkpoint_" + "d".repeat(32) }, { workstream_id: "other" }, { workspace_id: "other" },
    { workstream_base_head: "3".repeat(40) }, { health: "corrupt" }, { state: "deleted" }, { git_head: "invalid" }, { workspace_snapshot_id: "invalid" } ]) {
    const verify = await scope({ getCheckpoint: async () => ({ ...checkpoint, ...change }) });
    assert.equal(await verify({ context, step }), false, JSON.stringify(change));
  }
});
test("list and provenance scope authority rejects caller-selected scopes or a different tool", async () => {
  const verify = await scope();
  for (const [capability, input] of [["workspace.list_operations", {}], ["workspace.get_provenance", { path: "package.json" }]]) {
    const step = createMcpCapabilityAdapter().describe(intent(capability, input), "lifecycle");
    assert.equal(await verify({ context, step }), true);
    assert.equal(await verify({ context, step: { ...step, arguments: { ...step.arguments, workspace_id: "other" } } }), false);
    assert.equal(await verify({ context, step: { ...step, tool: "dev_workspace_begin_workstream" } }), false);
  }
});
test("scope authority requires trusted bindings and rejects unknown scope", async () => {
  const { createPiLifecycleScopeVerifier } = await import("../../server/src/pi-lifecycle-scope.mjs");
  assert.throws(() => createPiLifecycleScopeVerifier({}), /HOST_LIFECYCLE_SCOPE_UNBOUND/);
  assert.equal(await (await scope())({ context, step: { scope: "invented", tool: "anything", arguments: {} } }), false);
});
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-lifecycle-admission-"));
  t.after(async () => { assert.equal(path.dirname(root), os.tmpdir()); await rm(root, { recursive: true, force: true }); });
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const store = createPiReliableExecutionStore({ journal });
  return { root, journal, store };
}
function adapter(callTool, extra = {}) {
  return createPiReliableMcpAdapter({ callTool, queryOperation: async () => { throw new Error("Unexpected reconciliation"); },
    resolveWorkspace: async () => ({ ...context, workspace_type: "isolated_worktree", state: "active" }), ...extra });
}
test("registry bootstrap primitive is durable, conflict-safe and concurrent-duplicate safe", async t => {
  await mkdir(path.join(projectRoot, "tests", ".tmp"), { recursive: true });
  const root = await mkdtemp(path.join(projectRoot, "tests", ".tmp", "pi-workstream-bootstrap-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const registryPath = path.join(root, "workstream_registry.json");
  const make = () => createDevWorkstreamRegistryService({ registryPath, headReader: async () => base });
  const input = {
    bootstrap_id: "gpt-bootstrap-registry-001",
    request_fingerprint_sha256: "4".repeat(64),
    label: "Pi bootstrap regression",
    purpose: "experiment",
    declared_scope: ["server/src", "tests/mcp"],
  };
  const first = await make().beginBootstrap(input);
  const duplicate = await make().beginBootstrap(input);
  assert.equal(first.bootstrap_reconciled, false);
  assert.equal(duplicate.bootstrap_reconciled, true);
  assert.equal(duplicate.workstream_id, first.workstream_id);
  assert.equal((await make().list({ lifecycle: "all" })).total, 1);
  await assert.rejects(
    make().beginBootstrap({ ...input, request_fingerprint_sha256: "5".repeat(64) }),
    error => error?.code === "PI_BOOTSTRAP_KEY_CONFLICT",
  );
  const concurrent = { ...input, bootstrap_id: "gpt-bootstrap-registry-002", request_fingerprint_sha256: "6".repeat(64) };
  const [left, right] = await Promise.all([make().beginBootstrap(concurrent), make().beginBootstrap(concurrent)]);
  assert.equal(left.workstream_id, right.workstream_id);
  assert.equal((await make().list({ lifecycle: "all" })).total, 2);
});
test("checkpoint effect duplicate and cold store reopen preserve the exact terminal projection", async t => {
  const { journal, store } = await fixture(t); let dispatches = 0;
  const source = intent("workspace.create_checkpoint", { label: "GPT checkpoint" }, true);
  const a = adapter(async request => { dispatches++; assert.equal(request._meta.reconciliation_key, "lifecycle-effect-key-001"); return checkpoint; });
  const first = await createPiReliableExecutionEngine({ store, adapter: a }).execute(source);
  assert.equal(first.state.status, "COMPLETED"); assert.equal(first.receipts[0].evidence.checkpoint_id, checkpointId);
  const reopened = createPiReliableExecutionStore({ journal });
  const second = await createPiReliableExecutionEngine({ store: reopened, adapter: a }).execute(source);
  assert.equal(second.projection_hash, first.projection_hash); assert.equal(second.state.operation_id, first.state.operation_id);
  assert.equal(dispatches, 1); assert.equal((await journal.status()).active_operation_count, 0);
});
test("workstream recovery duplicate and cold store reopen do not replay the state transition", async t => {
  const { journal, store } = await fixture(t); let dispatches = 0;
  const source = intent("workspace.update_workstream", {
    workstream_id: context.workstream_id, expected_revision: 5, state: "active",
  }, true);
  const recovered = { ...workstream, state: "active", revision: 6 };
  const a = adapter(async request => {
    dispatches++;
    assert.equal(request._meta.reconciliation_key, "lifecycle-effect-key-001");
    return recovered;
  }, { verifyScope: await scope({ getWorkstream: async () => ({ ...workstream, state: "paused" }) }) });
  const first = await createPiReliableExecutionEngine({ store, adapter: a }).execute(source);
  assert.equal(first.state.status, "COMPLETED");
  const reopened = createPiReliableExecutionStore({ journal });
  const second = await createPiReliableExecutionEngine({ store: reopened, adapter: a }).execute(source);
  assert.equal(second.projection_hash, first.projection_hash);
  assert.equal(dispatches, 1);
});
test("checkpoint response loss reconciles the original effect with zero replay", async t => {
  const { store } = await fixture(t); let dispatches = 0; let queries = 0;
  const source = intent("workspace.create_checkpoint", {}, true);
  const a = adapter(async () => { dispatches++; throw Object.assign(new Error("response lost"), { code: "TIMEOUT" }); }, {
    queryOperation: async args => { queries++; return { ...args, reconciliation_state: "completed", operation_id: operationId, original_result: checkpoint }; },
  });
  const result = await createPiReliableExecutionEngine({ store, adapter: a }).execute(source);
  assert.equal(result.state.status, "COMPLETED"); assert.equal(dispatches, 1); assert.equal(queries, 1);
  assert.equal(result.receipts[0].kind, "reconciled_facts");
});
test("unrelated or corrupt checkpoint cannot reach MCP dispatch", async t => {
  const { store } = await fixture(t); let dispatches = 0;
  const verifyScope = await scope({ getCheckpoint: async () => ({ ...checkpoint, workspace_id: "other" }) });
  const result = await createPiReliableExecutionEngine({ store, adapter: adapter(async () => { dispatches++; return checkpoint; }, { verifyScope }) })
    .execute(intent("workspace.get_checkpoint", { checkpoint_id: checkpointId }));
  assert.equal(result.state.status, "BLOCKED"); assert.equal(result.state.last_error.code, "PERMISSION_DENIED"); assert.equal(dispatches, 0);
});

test('unresolved blocker never dispatches a recovery mutation',async t=>{
  const {journal,store}=await fixture(t);
  const blocker=await journal.begin({operation_type:'test_evidence',tool_name:'dev_run_tests',workspace_id:context.workspace_id,workstream_id:context.workstream_id});
  await journal.complete(blocker.operation_id,{result:{passed:false,suite:'mcp_core'}});
  const blocked={...workstream,state:'blocked',metadata:{blocker_operation_id:blocker.operation_id}};
  const verifyScope=await scope({getWorkstream:async()=>blocked,getOperation:args=>journal.getOperation(args)});
  let dispatches=0;
  const source=intent('workspace.update_workstream',{workstream_id:context.workstream_id,expected_revision:5,state:'active',blocker_resolution_operation_id:blocker.operation_id},true);
  const result=await createPiReliableExecutionEngine({store,adapter:adapter(async()=>{dispatches++;return workstream;},{verifyScope})}).execute(source);
  assert.equal(result.state.status,'BLOCKED');assert.equal(result.state.last_error.code,'PERMISSION_DENIED');assert.equal(dispatches,0);
  assert.equal((await journal.status()).health,'healthy');
});

test('blocked recovery requires a later durable passing result in the same workspace and suite',async t=>{
  const {journal,store}=await fixture(t);
  const emit=async(passed,suite='mcp_core',workspace_id=context.workspace_id)=>{
    const op=await journal.begin({operation_type:'test_evidence',tool_name:'dev_run_tests',workspace_id,workstream_id:context.workstream_id});
    await journal.complete(op.operation_id,{result:{passed,suite}});return op.operation_id;
  };
  const earlier=await emit(true),blocker=await emit(false),failed=await emit(false),wrongSuite=await emit(true,'mcp_reliability'),foreign=await emit(true,'mcp_core','dev_workspace_'+'f'.repeat(24)),passed=await emit(true);
  const blocked={...workstream,state:'blocked',metadata:{blocker_operation_id:blocker}};
  const verifyScope=await scope({getWorkstream:async()=>blocked,getOperation:args=>journal.getOperation(args)});
  for(const proof of [earlier,failed,wrongSuite,foreign]){
    const step=createMcpCapabilityAdapter().describe(intent('workspace.update_workstream',{workstream_id:context.workstream_id,expected_revision:5,state:'active',blocker_resolution_operation_id:proof},true),'lifecycle');
    assert.equal(await verifyScope({context,step}),false,proof);
  }
  const source=intent('workspace.update_workstream',{workstream_id:context.workstream_id,expected_revision:5,state:'active',blocker_resolution_operation_id:passed},true);
  let dispatches=0;const a=adapter(async()=>{dispatches++;return {...workstream,revision:6};},{verifyScope});
  const first=await createPiReliableExecutionEngine({store,adapter:a}).execute(source);
  assert.equal(first.state.status,'COMPLETED');
  const reopened=createPiReliableExecutionStore({journal});
  const duplicate=await createPiReliableExecutionEngine({store:reopened,adapter:a}).execute(source);
  assert.equal(duplicate.projection_hash,first.projection_hash);assert.equal(dispatches,1);
});
