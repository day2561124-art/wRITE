import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createExecutionIntent, hashExecutionInput, REQUIRED_DECISION_BOUNDARIES } from "../../server/src/pi-execution-contract.mjs";
import { createCapabilityRegistry, createMcpCapabilityAdapter } from "../../server/src/pi-mcp-adapter.mjs";
import { planExecutionIntent } from "../../server/src/pi-execution-orchestrator.mjs";

function intent(overrides = {}) {
  return createExecutionIntent({
    schema_version: 1, intent_id: "intent-adapter-001", goal: "Read the chosen source",
    context: { project_id: "writer_workbench", workstream_id: "dev_workstream_20261003-073214_3867df627fa2",
      workspace_id: "dev_workspace_5cdbb0f1d7044d71abd73592" },
    constraints: ["Keep the production default"], completion_conditions: ["GPT reviews the result"],
    permissions: { read: true, workspace_create: false, write: false, tests: false, commit: false, integrate: false, push: false },
    requested_actions: [{ step_id: "read", capability: "filesystem.read", input: { path: "package.json", maxBytes: 1000 }, depends_on: [] }],
    mutation_plan: [], verification: { focused: [], affected: [], full: [] },
    decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES], ...overrides,
  });
}

test("adapter executes real Workbench reads and retains its protected-file boundary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-mcp-adapter-"));
  try {
    await writeFile(path.join(root, "package.json"), '{"fixture":true}');
    await writeFile(path.join(root, ".env"), "protected-sentinel");
    const tools = await import("../../server/src/mcp-development-readonly-tools.mjs");
    const source = intent();
    const context = { ...source.context, root, workspace_type: "fixture", current_head: "1".repeat(40) };
    const adapter = createMcpCapabilityAdapter({
      resolveWorkspace: async () => context,
      callTool: (name, args) => tools[name](args, { workspaceContextResolver: async () => context }),
    });
    const result = await adapter.execute(source, "read", { mode: "read_only" });
    assert.equal(result.status, "OBSERVED");
    assert.equal(JSON.parse(result.evidence.content).fixture, true);
    assert.equal(result.evidence.workspace_context.workspace_id, source.context.workspace_id);
    const denied = intent({ requested_actions: [{ step_id: "read", capability: "filesystem.read",
      input: { path: ".env" }, depends_on: [] }] });
    const outcome = await adapter.execute(denied, "read", { mode: "read_only" });
    assert.equal(outcome.status, "DECISION_REQUIRED");
    assert.equal(JSON.stringify(outcome).includes("protected-sentinel"), false);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    await rm(root, { recursive: true, force: true });
  }
});

test("cross-operation reads stay disabled until durable journal identity binding exists", async () => {
  let calls = 0;
  const adapter = createMcpCapabilityAdapter({ resolveWorkspace: async () => { calls++; },
    callTool: async () => { calls++; } });
  const source = intent({ requested_actions: [{ step_id: "inspect-operation", capability: "execution.query",
    input: { operation_id: "dev_operation_" + "a".repeat(32) }, depends_on: [] }] });
  await assert.rejects(adapter.execute(source, "inspect-operation", { mode: "read_only" }), /CAPABILITY_READ_NOT_ENABLED/);
  assert.equal(calls, 0);
});

test("capability registry is fixed by the trusted host and returns immutable descriptors", () => {
  const registry = createCapabilityRegistry();
  assert.equal(registry.resolve("filesystem.read").tool, "dev_read_file");
  assert.throws(() => registry.resolve("fix_everything"), /UNKNOWN_CAPABILITY/);
  assert.ok(Object.isFrozen(registry.resolve("filesystem.write")));
  assert.ok(registry.list().some(x => x.capability === "git.push" && x.permission === "push"));
});

test("planning and shadow observation have zero MCP calls, zero mutations and preserve GPT order", async () => {
  let calls = 0;
  const adapter = createMcpCapabilityAdapter({ callTool: async () => { calls++; },
    resolveWorkspace: async () => { calls++; } });
  const source = intent();
  const plan = planExecutionIntent(source, { adapter, operation_id: "pi_operation_" + "b".repeat(32) });
  assert.equal(plan.state.status, "PREPARING");
  assert.equal(plan.production_default_changed, false);
  assert.equal(plan.model_requests, 0);
  assert.deepEqual(plan.steps.map(x => x.step_id), ["read"]);
  assert.equal((await adapter.execute(source, "read", { mode: "shadow" })).status, "PLANNED");
  assert.equal(calls, 0);
  assert.equal(plan.steps[0].input_hash, hashExecutionInput(source.requested_actions[0].input));
});

test("read adapter binds registered workspace; schema and scope are revalidated at dispatch", async () => {
  const seen = [];
  const source = intent();
  const adapter = createMcpCapabilityAdapter({
    resolveWorkspace: async (args, options) => {
      assert.equal(args.workspace_id, source.context.workspace_id);
      assert.equal(options.mutation, false);
      return { workspace_id: args.workspace_id, workstream_id: source.context.workstream_id };
    },
    callTool: async (tool, args) => { seen.push({ tool, args }); return { ok: true, content: "{}" }; },
  });
  const result = await adapter.execute(source, "read", { mode: "read_only" });
  assert.equal(result.status, "OBSERVED");
  assert.deepEqual(seen, [{ tool: "dev_read_file", args: { path: "package.json", maxBytes: 1000,
    workspace_id: source.context.workspace_id } }]);
  await assert.rejects(adapter.execute({ ...source, permissions: { ...source.permissions, read: false } }, "read", { mode: "read_only" }));
  await assert.rejects(adapter.execute(source, "invented-step", { mode: "read_only" }));
  await assert.rejects(adapter.execute(source, "read", { mode: "production" }));
  assert.equal(seen.length, 1);
});

test("unknown/mismatched workspace is rejected before any tool call", async () => {
  for (const context of [null, { workspace_id: "dev_workspace_shared_repository_v1" },
    { workspace_id: intent().context.workspace_id, workstream_id: null }]) {
    let calls = 0;
    const adapter = createMcpCapabilityAdapter({ resolveWorkspace: async () => context,
      callTool: async () => { calls++; } });
    await assert.rejects(adapter.execute(intent(), "read", { mode: "read_only" }), /WORKSPACE/);
    assert.equal(calls, 0);
  }
});

test("Phase A blocks every effect including tests, commits and workspace creation despite explicit permission", async () => {
  const mutations = [
    ["filesystem.write", { path: "server/new.mjs", content: "export const n=1;" }, "write", "server/new.mjs"],
    ["filesystem.patch", { path: "server/existing.mjs", oldText: "old", newText: "new", expectedSha256: "1".repeat(64) }, "write", "server/existing.mjs"],
    ["verification.affected", { suite: "affected" }, "tests", "verification:affected"],
    ["verification.full", { suite: "all" }, "tests", "verification:full"],
    ["git.integrate", { integration_candidate_id: "dev_integration_20261003-061249_5f3b8a5e4ab9", expected_revision: 8 }, "integrate", "git:integrate"],
    ["git.push", { expectedHead: "1".repeat(40) }, "push", "git:push"],
    ["verification.focused", { suite: "mcp" }, "tests", "verification:focused"],
    ["workspace.create", { workstream_id: intent().context.workstream_id, expected_workstream_revision: 1 }, "workspace_create", intent().context.workstream_id],
    ["git.commit", { message: "Exact approved patch", paths: ["server/new.mjs"], expectedHead: "1".repeat(40) }, "commit", "git:commit"],
  ];
  for (const [capability, input, permission, target] of mutations) {
    let calls = 0;
    const adapter = createMcpCapabilityAdapter({ callTool: async () => { calls++; },
      resolveWorkspace: async () => { calls++; } });
    const source = intent({ permissions: { ...intent().permissions, [permission]: true },
      requested_actions: [{ step_id: "effect", capability, input, depends_on: [],
        idempotency_key: "intent-adapter-001:effect" }],
      mutation_plan: [{ step_id: "effect", target, expected_change: "Apply exactly approved input", input_sha256: hashExecutionInput(input) }],
      verification: { focused: capability === "verification.focused" ? ["effect"] : [],
        affected: capability === "verification.affected" ? ["effect"] : [],
        full: capability === "verification.full" ? ["effect"] : [] } });
    await assert.rejects(adapter.execute(source, "effect", { mode: "read_only" }), /MUTATION_NOT_ENABLED/);
    assert.equal(calls, 0);
  }
});

test("MCP tool-error envelopes become structured facts requiring GPT interpretation", async () => {
  const adapter = createMcpCapabilityAdapter({
    resolveWorkspace: async () => ({ ...intent().context }),
    callTool: async () => ({ isError: true, content: [{ type: "text", text: "denied" }] }),
  });
  const result = await adapter.execute(intent(), "read", { mode: "read_only" });
  assert.equal(result.status, "DECISION_REQUIRED");
  assert.equal(result.decision.action, "decision_required");
  assert.equal(result.model_requests, 0);
  assert.equal(result.evidence.isError, true);
});

test("failure evidence is bounded, and transport failure never changes the requested implementation", async () => {
  const source = intent();
  const before = hashExecutionInput(source);
  const adapter = createMcpCapabilityAdapter({
    resolveWorkspace: async () => ({ ...source.context }),
    callTool: async () => { const e = new Error("untrusted details"); e.code = "TRANSPORT_ERROR"; throw e; },
  });
  const result = await adapter.execute(source, "read", { mode: "read_only" });
  assert.equal(result.status, "WAITING_RETRY");
  assert.equal(result.decision.action, "retry");
  assert.equal(result.error.code, "TRANSPORT_ERROR");
  assert.equal("message" in result.error, false);
  assert.equal(hashExecutionInput(source), before);
});
