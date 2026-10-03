import assert from "node:assert/strict";
import test from "node:test";
import { createPiReadOnlyEntry } from "../../server/src/mcp-pi-agent-tools.mjs";

const context = {
  workspace_id: "server-bound-workspace",
  workstream_id: "registered-workstream",
  workspace_type: "isolated_worktree",
  branch: "fixture",
  base_head: "base",
  current_head: "head",
  root: "protected-host-root",
};

test("Pi entry rejects extra fields and byte limits before workspace resolution", async () => {
  let resolutions = 0;
  let executions = 0;
  const entry = createPiReadOnlyEntry({
    resolveWorkspace: async () => { resolutions += 1; return context; },
    execute: async () => { executions += 1; return { ok: true }; },
  });
  for (const input of [
    null, [], {},
    { code: "return 1", workspace_id: "" },
    { code: "return 1", workspace_id: "x".repeat(257) },
    { code: "中".repeat(5500), workspace_id: "registered" },
    ...["executable", "nodeExecutable", "readTool", "options", "env", "model", "endpoint", "timeoutMs"].map((key) => ({
      code: "return 1", workspace_id: "registered", [key]: "caller-controlled",
    })),
  ]) assert.equal((await entry(input)).reason, "invalid_request");
  assert.equal(resolutions, 0);
  assert.equal(executions, 0);
});

test("Pi entry resolves read-only scope before dispatch and binds returned identity", async () => {
  const events = [];
  const entry = createPiReadOnlyEntry({
    resolveWorkspace: async (input, options) => {
      events.push("resolve");
      assert.deepEqual(input, { workspace_id: "requested" });
      assert.deepEqual(options, { mutation: false });
      return context;
    },
    execute: async (input, options) => {
      events.push("execute");
      assert.deepEqual(input, { code: "return 1" });
      assert.deepEqual(options, { workspaceId: context.workspace_id });
      return { ok: true, value: 1, model_requests: 0 };
    },
  });
  const result = await entry({ code: "return 1", workspace_id: "requested" });
  assert.deepEqual(events, ["resolve", "execute"]);
  assert.equal(result.ok, true);
  assert.equal(result.value, 1);
  assert.equal(result.workspace_context.workspace_id, context.workspace_id);
  assert.equal(result.workspace_context.current_head, "head");
  assert.equal(JSON.stringify(result).includes(context.root), false);
});

test("Pi entry closes missing or failed workspace resolution without launching", async () => {
  let executions = 0;
  for (const resolveWorkspace of [
    async () => { throw new Error(context.root); },
    async () => null,
    async () => ({}),
  ]) {
    const entry = createPiReadOnlyEntry({
      resolveWorkspace,
      execute: async () => { executions += 1; return { ok: true }; },
    });
    const result = await entry({ code: "return 1", workspace_id: "missing" });
    assert.equal(result.reason, "workspace_unavailable");
    assert.equal(JSON.stringify(result).includes(context.root), false);
  }
  assert.equal(executions, 0);
});

test("Pi entry returns bounded execution failure with scope provenance", async () => {
  const entry = createPiReadOnlyEntry({
    resolveWorkspace: async () => context,
    execute: async () => { throw new Error(context.root); },
  });
  const result = await entry({ code: "return 1", workspace_id: "registered" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "execution_failed");
  assert.equal(result.model_requests, 0);
  assert.equal(result.workspace_context.workspace_id, context.workspace_id);
  assert.equal(JSON.stringify(result).includes(context.root), false);
});
