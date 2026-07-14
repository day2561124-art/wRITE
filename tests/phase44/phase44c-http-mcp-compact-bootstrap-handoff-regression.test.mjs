import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(rootDir, "server", "src", "mcp-http-server.mjs");
const capabilities = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer().unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") return reject(new Error("Unable to reserve port."));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForPort(child, port, stderr) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`HTTP MCP server exited before readiness.\n${stderr()}`);
    }
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      const finish = (value) => { socket.destroy(); resolve(value); };
      socket.setTimeout(250);
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.once("timeout", () => finish(false));
    });
    if (ready) return;
    await delay(100);
  }
  throw new Error(`HTTP MCP server readiness timed out.\n${stderr()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

function parseToolResult(result) {
  assert.notEqual(result.isError, true);
  assert.equal(result.content?.[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "phase44c-http-bootstrap-"));
const port = await reservePort();
const configPath = path.join(tempDirectory, "mcp-http.json");
await writeFile(configPath, JSON.stringify({ host: "127.0.0.1", port }, null, 2), "utf8");

const child = spawn(process.execPath, [serverPath, "--config", configPath], {
  cwd: rootDir,
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
child.stderr.setEncoding("utf8");
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
let client;

try {
  await waitForPort(child, port, () => stderr);
  client = new Client(
    { name: "phase44c-http-compact-bootstrap-handoff", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));

  const listed = await client.listTools();
  assert.equal(listed.tools.length, 25);

  const beginCall = await client.callTool({
    name: "chatgpt_bridge_begin_external_brain_writing_session",
    arguments: {
      task_prompt: "Phase44C production HTTP MCP compact bootstrap handoff regression。",
      chapter_mode: "specific_scene",
    },
  });
  const begin = parseToolResult(beginCall);
  const serializedBytes = Buffer.byteLength(beginCall.content[0].text, "utf8");
  assert.equal(begin.ok, true);
  assert.equal(begin.architecture_route, "chatgpt_owned_external_brain");
  assert.equal(begin.orchestration_owner, "ChatGPT");
  assert.equal(begin.prose_generator, "ChatGPT");
  assert.match(begin.external_brain_session_id, /^agent_run_/u);
  assert.match(begin.writing_context_bundle_id, /^gptctx_/u);
  assert.deepEqual(begin.next_capabilities, capabilities);
  assert(serializedBytes < 16 * 1024, `HTTP bootstrap response is not compact: ${serializedBytes} bytes`);
  assert.equal("writing_context" in begin, false);
  assert.equal("context_for_chat" in begin, false);

  for (const capability of capabilities) {
    const called = parseToolResult(await client.callTool({
      name: `chatgpt_bridge_use_${capability}`,
      arguments: {
        external_brain_session_id: begin.external_brain_session_id,
        writing_context_bundle_id: begin.writing_context_bundle_id,
        capability_input: { transport: "production_http_mcp" },
      },
    }));
    assert.equal(called.ok, true);
    assert.equal(called.external_brain_session_id, begin.external_brain_session_id);
    assert.equal(called.writing_context_bundle_id, begin.writing_context_bundle_id);
    assert.equal(called.trace.module_name, capability);
    assert.equal(called.trace.status, "success");
  }

  console.log(
    `Phase 44C production HTTP MCP compact bootstrap handoff regression passed: size=${serializedBytes} bytes, tool_count=25, capabilities=6/6`,
  );
} finally {
  if (client) await client.close().catch(() => {});
  await stopChild(child);
  await rm(tempDirectory, { recursive: true, force: true });
}
