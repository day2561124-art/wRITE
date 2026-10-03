import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executePiReadOnly } from "../../server/src/pi-codemode-bridge.mjs";
import { isPiNodeVersionCompatible } from "../../server/src/pi-agent-execution-service.mjs";

const installed = existsSync(new URL("../../scripts/pi-runtime/node_modules/@earendil-works/pi-coding-agent/package.json", import.meta.url));
const ready = installed && isPiNodeVersionCompatible(process.versions.node);
const realTest = (name, fn) => test(name, { skip: ready ? false : "optional Pi sidecar and Node >=22.19 required" }, fn);
const bound = { workspaceId: "fixture-workspace" };

test("Pi bridge rejects caller configuration and missing workspace before launch", async () => {
  assert.equal((await executePiReadOnly({ code: "return 1", executable: "arbitrary" }, bound)).reason, "invalid_request");
  assert.equal((await executePiReadOnly({ code: "x".repeat(16385) }, bound)).reason, "invalid_request");
  assert.equal((await executePiReadOnly({ code: "return 1" })).reason, "workspace_required");
  const missing = await executePiReadOnly({ code: "return 1" }, {
    ...bound, nodeExecutable: path.join(os.tmpdir(), "pi-missing-node-fixture-07491473.exe"),
  });
  assert.equal(missing.ok, false);
  assert(["sidecar_unavailable", "ipc_failed"].includes(missing.reason));
});

realTest("Pi bridge batches actual Workbench reads while preserving file policy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-readonly-"));
  try {
    await writeFile(path.join(root, "fixture.md"), "hello");
    await writeFile(path.join(root, ".env"), "protected-fixture");
    const tools = await import("../../server/src/mcp-development-readonly-tools.mjs");
    const readTool = (name, args, workspaceId) => tools[name]({ ...args, workspace_id: workspaceId }, {
      workspaceContextResolver: async (input) => {
        assert.equal(input.workspace_id, bound.workspaceId);
        return { root, workspace_id: bound.workspaceId, workspace_type: "fixture", current_head: "fixture" };
      },
    });
    const result = await executePiReadOnly({ code: "const r = await Promise.all([tools.dev_read_file({path:'fixture.md'}), tools.dev_list_directory({path:'.'})]); return [r[0].content, r[1].returned_entries];" }, { ...bound, readTool });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, ["hello", 1]);
    assert.equal(result.host_calls, 2);
    assert.equal(result.model_requests, 0);
    for (const target of [".env", "../outside.md", ".git/config"]) {
      const denied = await executePiReadOnly({ code: `return await tools.dev_read_file({path:${JSON.stringify(target)}});` }, { ...bound, readTool });
      assert.equal(denied.ok, false);
      assert.equal(JSON.stringify(denied).includes("protected-fixture"), false);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

realTest("Pi bridge blocks extra args, workspace switching and ambient capabilities", async () => {
  let host = 0;
  const options = { ...bound, readTool: async () => { host += 1; return {}; } };
  for (const code of [
    "return await tools.dev_read_file({path:'fixture.md', workspace_id:'other'});",
    "return await tools.dev_list_directory({path:'.', command:'arbitrary'});",
    "return await tools.dev_read_file({path:'fixture.md',maxBytes:8193});",
    "return await tools.dev_git_push({});",
  ]) assert.equal((await executePiReadOnly({ code }, options)).ok, false);
  assert.equal(host, 0);
  const globals = await executePiReadOnly({ code: "return [typeof process,typeof require,typeof fetch,typeof models,typeof setTimeout];" }, options);
  assert.equal(globals.ok, true);
  assert.deepEqual(globals.value, Array(5).fill("undefined"));
});

realTest("Pi bridge bounds call count, per-call output and final output", async () => {
  const repeated = await executePiReadOnly({ code: "for(let i=0;i<9;i++) await tools.dev_list_directory({path:'.'}); return 1;" }, { ...bound, readTool: async () => ({}) });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.reason, "call_limit");
  const largeCall = await executePiReadOnly({ code: "return await tools.dev_read_file({path:'fixture.md'});" }, { ...bound, readTool: async () => ({ content: "x".repeat(17000) }) });
  assert.equal(largeCall.reason, "output_limit");
  const largeResult = await executePiReadOnly({ code: "return 'x'.repeat(40000);" }, bound);
  assert.equal(largeResult.reason, "output_limit");
  const cumulative = await executePiReadOnly({ code: "for(let i=0;i<5;i++) await tools.dev_read_file({path:'fixture.md'}); return 1;" }, {
    ...bound, readTool: async () => ({ content: "x".repeat(16000) }),
  });
  assert.equal(cumulative.reason, "output_limit");
  assert.equal(cumulative.host_calls, 5);
});

realTest("Pi bridge rejects a third concurrent read before host dispatch", async () => {
  let active = 0;
  let peak = 0;
  let dispatched = 0;
  const result = await executePiReadOnly({ code: "return await Promise.all([1,2,3].map(() => tools.dev_list_directory({path:'.'})));" }, {
    ...bound,
    readTool: async () => {
      dispatched += 1;
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      active -= 1;
      return {};
    },
  });
  assert.equal(result.ok, false);
  assert.equal(dispatched, 2);
  assert.equal(peak, 2);
  // Reads admitted before the script failed still hold host capacity.
  await new Promise((resolve) => setTimeout(resolve, 60));
});

realTest("Pi bridge contains memory exhaustion and executes again", async () => {
  const exhausted = await executePiReadOnly({ code: "const a=[]; for(let i=0;i<1000;i++) a.push('x'.repeat(100000)); return a.length;" }, bound);
  assert.equal(exhausted.ok, false);
  assert.notEqual(exhausted.reason, "timeout");
  const recovered = await executePiReadOnly({ code: "return 9;" }, bound);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value, 9);
});

realTest("Pi bridge bounds concurrency, deadline and recovers after termination", async () => {
  let entered;
  const enteredPromise = new Promise((resolve) => { entered = resolve; });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const first = executePiReadOnly({ code: "return await tools.dev_list_directory({path:'.'});" }, {
    ...bound, timeoutMs: 1500, readTool: () => { entered(); return pending; },
  });
  await enteredPromise;
  assert.equal((await executePiReadOnly({ code: "return 1" }, bound)).reason, "execution_busy");
  assert.equal((await first).reason, "timeout");
  release({});
  const cpu = await executePiReadOnly({ code: "while(true){}" }, { ...bound, timeoutMs: 500 });
  assert.equal(cpu.ok, false);
  assert.equal(cpu.reason, "timeout");
  const recovered = await executePiReadOnly({ code: "return 7;" }, bound);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value, 7);
});
