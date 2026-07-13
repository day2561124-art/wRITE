import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const rawStory = "ChatGPT-native test prose string：雨點敲在門環上，她把答案留在下一次呼吸裡。";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const capabilities = ["scene_planner", "character_simulator", "neural_critic", "style_drift_detector", "over_governance_detector", "writing_card_director"];
const legacySurface = (key) => key === "chatgpt_final_output" || key.startsWith("chatgpt_operator_compact_diagnostics");

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
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`HTTP MCP server exited.\n${stderr()}`);
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
  throw new Error(`HTTP MCP readiness timed out.\n${stderr()}`);
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

function parse(result) {
  assert.notEqual(result.isError, true);
  assert.equal(result.content?.[0]?.type, "text");
  return { payload: JSON.parse(result.content[0].text), bytes: Buffer.byteLength(result.content[0].text, "utf8") };
}

function assertCommon(payload, bytes, capability, session, boundary) {
  assert.equal(payload.ok, true);
  assert.equal(payload.architecture_route, "chatgpt_owned_external_brain");
  assert.equal(payload.external_brain_session_id, session.external_brain_session_id);
  assert.equal(payload.writing_context_bundle_id, session.writing_context_bundle_id);
  assert.equal(payload.capability_name, `run_${capability}`);
  assert.equal(payload.generation_boundary, boundary);
  assert.equal(payload.full_neural_orchestrator_used, false);
  assert(payload.capability_output && typeof payload.capability_output === "object");
  assert.doesNotMatch(JSON.stringify(payload.capability_output), /Writer Workbench executed|please integrate|generic acknowledgement/iu);
  assert.equal(payload.trace.module_name, capability);
  assert.equal(payload.trace.status, "success");
  assert.match(payload.trace.trace_id, /^neural_trace_/u);
  assert.match(payload.trace.output_hash, /^[a-f0-9]{64}$/u);
  for (const guard of guards) assert.equal(payload.mutation_guards[guard], false);
  assert.equal(Object.keys(payload).some(legacySurface), false);
  assert(bytes < 16 * 1024, `${capability} HTTP response is not compact: ${bytes} bytes`);
}

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "phase44c-http-semantic-"));
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
  client = new Client({ name: "phase44c-http-individual-semantic-handoff", version: "1.0.0" }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 24);
  const begin = parse(await client.callTool({
    name: "chatgpt_bridge_begin_external_brain_writing_session",
    arguments: { task_prompt: "Phase44C production HTTP semantic handoff：雨夜門前的抉擇。", chapter_mode: "specific_scene" },
  })).payload;
  const sizes = {};
  const traceIds = [];
  for (const capability of capabilities) {
    const result = parse(await client.callTool({
      name: `chatgpt_bridge_use_${capability}`,
      arguments: {
        external_brain_session_id: begin.external_brain_session_id,
        writing_context_bundle_id: begin.writing_context_bundle_id,
        capability_input: { transport: "production_http_mcp" },
      },
    }));
    assertCommon(result.payload, result.bytes, capability, begin, "pre_generation");
    sizes[capability] = result.bytes;
    traceIds.push(result.payload.trace.trace_id);
  }
  const finalResult = parse(await client.callTool({
    name: "chatgpt_bridge_use_final_polisher",
    arguments: {
      external_brain_session_id: begin.external_brain_session_id,
      writing_context_bundle_id: begin.writing_context_bundle_id,
      raw_story_text: rawStory,
      raw_story_sha256: sha256(rawStory),
    },
  }));
  assertCommon(finalResult.payload, finalResult.bytes, "final_polisher", begin, "post_generation");
  assert.equal(finalResult.payload.raw_story_sha256, sha256(rawStory));
  assert.equal(finalResult.payload.capability_output.raw_story_sha256, sha256(rawStory));
  assert.equal(finalResult.payload.capability_output.result_type, "final_polisher_report");
  assert.equal(finalResult.payload.capability_output.editorial_review_required_for_success, true);
  assert.equal(finalResult.payload.capability_output.text_change_required, false);
  assert.equal(finalResult.payload.capability_output.prose_ownership.final_prose_generator, "ChatGPT");
  assert.equal("polished_text" in finalResult.payload.capability_output, false);
  sizes.final_polisher = finalResult.bytes;
  traceIds.push(finalResult.payload.trace.trace_id);
  assert.equal(new Set(traceIds).size, 7);
  console.log(`Phase 44C production HTTP individual semantic handoff passed: semantic=6/6, traces=7/7, raw_story_sha256=${sha256(rawStory)}, http_sizes=${JSON.stringify(sizes)}`);
} finally {
  if (client) await client.close().catch(() => {});
  await stopChild(child);
  await rm(tempDirectory, { recursive: true, force: true });
}
