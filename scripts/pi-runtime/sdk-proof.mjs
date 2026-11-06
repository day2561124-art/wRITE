import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local deterministic MCP peer. It never opens a network connection or reads production data.
if (process.argv[2] === "--mcp-fixture") {
  const { createInterface } = await import("node:readline");
  const auditPath = process.argv[3];
  const send = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
  const tools = ["double", "forbidden", "fail", "slow", "hidden"].map(name => ({
    name, description: name === "double" ? "Calculate double 計算兩倍 整數" : name + " upgrade fixture",
    inputSchema: { type: "object", properties: { value: { type: "integer" } }, required: ["value"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  }));
  const pending = new Map();
  for await (const line of createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    if (request.method === "initialize") send(request.id, {
      protocolVersion: request.params.protocolVersion, capabilities: { tools: {} },
      serverInfo: { name: "pi-upgrade-fixture", version: "1" }, instructions: "Deterministic isolated upgrade test.",
    });
    else if (request.method === "tools/list") send(request.id, { tools });
    else if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      await appendFile(auditPath, JSON.stringify({ name, args }) + "\n");
      if (!args || Object.keys(args).length !== 1 || !Number.isSafeInteger(args.value)) {
        send(request.id, { isError: true, content: [{ type: "text", text: "host_validation_failed" }] });
      } else if (name === "slow") {
        pending.set(request.id, setTimeout(() => {
          pending.delete(request.id);
          send(request.id, { content: [{ type: "text", text: "slow completed" }] });
        }, 10000));
      } else if (name === "fail") {
        send(request.id, { isError: true, content: [{ type: "text", text: "fixture_failure" }] });
      } else {
        const value = args.value * 2;
        send(request.id, { content: [{ type: "text", text: String(value) }], structuredContent: { value } });
      }
    } else if (request.method === "notifications/cancelled") {
      clearTimeout(pending.get(request.params.requestId));
      pending.delete(request.params.requestId);
    } else if (request.id !== undefined) send(request.id, {});
  }
} else {
  const {
    createAgentSession, DefaultResourceLoader, createCodemodeExtension, createToolSearchExtension,
    createMcpExtension, SessionManager, SettingsManager, ModelRuntime,
  } = await import("@earendil-works/pi-coding-agent");
  const { createAssistantMessageEventStream } = await import("@earendil-works/pi-ai");
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-sdk-upgrade-"));
  const agentDir = path.join(root, "agent");
  const auditPath = path.join(root, "mcp-calls.jsonl");
  const settings = SettingsManager.inMemory({ retry: { enabled: false }, compaction: { enabled: false } });
  const runtime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(root, "models-store.json"), allowModelNetwork: false, refreshOnCreate: false,
  });
  const model = runtime.getModels().find(item => item.provider === "openai");
  assert(model, "static fixture model must exist; no production model is selected");
  await runtime.setRuntimeApiKey(model.provider, "upgrade-fixture-not-a-real-key");
  let networkRequests = 0;
  runtime.streamSimple = () => { networkRequests++; throw new Error("provider_calls_forbidden"); };
  const events = [];
  const starts = [];
  const errors = [];
  const config = {
    servers: [{
      name: "fixture", source: "upgrade-fixture", scope: "extension",
      config: {
        command: process.execPath, args: [fileURLToPath(import.meta.url), "--mcp-fixture", auditPath],
        exposure: "deferred", timeout: 2,
        toolExposure: { forbidden: "direct", fail: "direct", slow: "direct", hidden: "hidden" },
      },
    }], autoEnableCodemode: false, errors: [],
  };
  let sequence = 0;
  async function open(manager) {
    const loader = new DefaultResourceLoader({
      cwd: root, agentDir, settingsManager: settings, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [
        createCodemodeExtension({ models: false }), createToolSearchExtension(),
        createMcpExtension({ loadConfig: () => config, logPath: path.join(root, "mcp.log") }),
        pi => {
          pi.on("before_agent_start", event => { starts.push(event.messageType); });
          pi.on("tool_call", event => {
            if (event.toolName === "mcp__fixture__forbidden") return { block: true, reason: "fixture_permission_denied" };
          });
        },
      ],
    });
    await loader.reload();
    const result = await createAgentSession({
      cwd: root, agentDir, model, modelRuntime: runtime, settingsManager: settings,
      sessionManager: manager, resourceLoader: loader, thinkingLevel: "off",
      ...(manager.getEntries().length > 0 ? {} : { noTools: "builtin" }),
    });
    assert.equal(result.extensionsResult.errors.length, 0);
    const current = result.session;
    current.subscribe(event => events.push(event));
    await current.bindExtensions({ onError: error => errors.push(error) });
    let calls = [];
    current.agent.streamFunction = async () => {
      const content = calls.length ? calls.splice(0) : [{ type: "text", text: "fixture done" }];
      const message = {
        role: "assistant", content, api: model.api, provider: model.provider, model: model.id,
        stopReason: content[0].type === "toolCall" ? "toolUse" : "stop", timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({ type: "start", partial: message });
        stream.push({ type: "done", reason: message.stopReason, message });
        stream.end();
      });
      return stream;
    };
    return {
      session: current,
      async call(name, args) {
        const id = "fixture-" + (++sequence);
        calls = [{ type: "toolCall", id, name, arguments: args }];
        await current.prompt("Run the exact deterministic fixture call.");
        const result = current.state.messages.find(message => message.role === "toolResult" && message.toolCallId === id);
        assert(result, "actual tool result must be persisted");
        return result;
      },
    };
  }
  const textOf = result => result.content.filter(item => item.type === "text").map(item => item.text).join("\n");
  const audit = async () => (await readFile(auditPath, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
  async function close(h) {
    if (!h) return;
    await h.session.abort();
    await h.session.extensionRunner.emit({ type: "session_shutdown", reason: "exit" });
    h.session.dispose();
  }
  let harness;
  try {
    const manager = SessionManager.create(root, path.join(root, "sessions"));
    harness = await open(manager);
    harness.session.setActiveToolsByName(["codemode", "tool_search", "mcp__fixture__forbidden", "mcp__fixture__fail", "mcp__fixture__slow"]);
    const search = await harness.call("tool_search", { query: "計算兩倍", limit: 1 });
    assert.equal(search.isError, false);
    assert(textOf(search).includes("mcp__fixture__double"), JSON.stringify({ search, errors, tools: harness.session.getAllTools().map(tool => ({ name: tool.name, exposure: tool.exposure })), log: (await readFile(path.join(root, "mcp.log"), "utf8").catch(() => "no fixture log")).slice(-3000) }));
    const doubled = await harness.call("mcp__fixture__double", { value: "3" });
    assert.equal(doubled.isError, false);
    assert((await audit()).some(item => item.name === "double" && item.args.value === 3), "pi-schema coercion reaches strictly validating host");
    const before = (await audit()).length;
    assert.equal((await harness.call("mcp__fixture__double", { value: "invalid" })).isError, true);
    assert.equal((await harness.call("mcp__fixture__forbidden", { value: 1 })).isError, true);
    assert.equal((await harness.call("mcp__fixture__hidden", { value: 1 })).isError, true);
    assert.equal((await audit()).length, before, "invalid, hidden and denied calls never reach MCP");
    const failed = await harness.call("mcp__fixture__fail", { value: 1 });
    assert.equal(failed.isError, true);
    assert(textOf(failed).includes("fixture_failure"));
    const batch = await harness.call("codemode", {
      code: "const r=await Promise.all([tools.mcp__fixture__double({value:4}),tools.mcp__fixture__double({value:5})]); store('upgradeProof',r.reduce((n,x)=>n+x.structuredContent.value,0)); return load('upgradeProof');",
    });
    assert.equal(batch.isError, false);
    assert(textOf(batch).includes("18"));
    const timed = await harness.call("mcp__fixture__slow", { value: 1 });
    assert.equal(timed.isError, true);
    assert.equal((await harness.call("mcp__fixture__double", { value: 2 })).isError, false);
    assert(events.some(event => event.type === "tool_execution_end" && event.parentToolCallId), "nested lifecycle includes parent identity");
    assert(events.some(event => event.type === "agent_settled"));
    assert(starts.length > 0 && starts.every(type => type === "user"), "1.2+ before_agent_start discriminant");
    const sessionFile = manager.getSessionFile();
    const entries = manager.getEntries();
    await close(harness);
    harness = undefined;
    const restored = SessionManager.open(sessionFile);
    assert.equal(restored.getEntries().length, entries.length);
    // JSONL omits undefined object fields; compare the complete serializable transcript.
    assert.deepEqual(restored.buildSessionContext().messages, JSON.parse(JSON.stringify(manager.buildSessionContext().messages)));
    harness = await open(restored);
    const resumed = await harness.call("codemode", { code: "return load('upgradeProof');" });
    assert.equal(resumed.isError, false);
    assert(textOf(resumed).includes("18"), "codemode state survives actual session reopen");
    assert(harness.session.getActiveToolNames().includes("mcp__fixture__double"), "Tool Search activation survives resume");
    assert(!harness.session.getActiveToolNames().some(name => ["read", "bash", "edit", "write"].includes(name)), "resume preserves restricted loadout");
    assert.equal(errors.length, 0);
    assert.equal(networkRequests, 0);
    console.log(JSON.stringify({ ok: true, model_requests: 0, checks: [
      "sdk_session", "real_stdio_mcp", "cjk_tool_search", "schema_coercion", "host_validation",
      "permission_denial", "hidden_tools", "mcp_error", "codemode_parallel_mcp",
      "mcp_timeout_recovery", "nested_events", "session_disk_restore", "active_tools_restore", "codemode_store_restore",
    ], mcp_calls: (await audit()).length }));
  } finally {
    await close(harness);
    // Remove only this process-created temporary fixture directory.
    assert(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("pi-sdk-upgrade-"));
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
