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

import { listNeuralTraces } from "../../server/src/neural-trace-service.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(rootDir, "server", "src", "mcp-http-server.mjs");
const endpoint = (port) => new URL(`http://127.0.0.1:${port}/mcp`);
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const capabilities = ["scene_planner", "character_simulator", "neural_critic", "style_drift_detector", "over_governance_detector", "writing_card_director"];
const markerAlpha = "PHASE44D_HTTP_SESSION_ALPHA";
const markerBeta = "PHASE44D_HTTP_SESSION_BETA";
const rawAlpha = "PHASE44D_RAW_ALPHA｜雨幕遮住北塔，她仍記得石階上那句沒有說完的承諾。";
const rawBeta = "PHASE44D_RAW_BETA｜曙光穿過練習場，他把舊徽章交給等待的人。";
const unknownSession = "agent_run_20000101-000000-deadbeef";
const unknownBundle = "gptctx_20000101-000000-deadbeef";

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

async function waitForPort(child, port, readStderr) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`HTTP MCP server exited.\n${readStderr()}`);
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
  throw new Error(`HTTP MCP readiness timed out.\n${readStderr()}`);
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
  return JSON.parse(result.content[0].text);
}

function assertMutationGuards(payload) {
  const boundary = payload.mutation_guards ?? payload;
  for (const guard of guards) assert.equal(boundary[guard], false, `${guard} must remain false`);
}

function assertSuccess(payload, session, moduleName) {
  assert.equal(payload.ok, true);
  assert.equal(payload.external_brain_session_id, session.external_brain_session_id);
  assert.equal(payload.writing_context_bundle_id, session.writing_context_bundle_id);
  assert.equal(payload.trace.run_id, session.external_brain_session_id);
  assert.equal(payload.trace.module_name, moduleName);
  assert.equal(payload.trace.status, "success");
  assert.match(payload.trace.trace_id, /^neural_trace_/u);
  assert.match(payload.trace.output_hash, /^[a-f0-9]{64}$/u);
  assertMutationGuards(payload);
}

function assertBlocked(payload) {
  assert.equal(payload.ok, false);
  assert.equal(payload.blocked, true);
  assert.equal("capability_output" in payload, false);
  assert.equal("trace" in payload, false);
  assertMutationGuards(payload);
}

async function call(client, name, arguments_) {
  return parse(await client.callTool({ name, arguments: arguments_ }));
}

async function invoke(client, session, capability, extra = {}) {
  return await call(client, `chatgpt_bridge_use_${capability}`, {
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: { phase: "44D", ...extra },
  });
}

async function successTraceIds(sessionA, sessionB) {
  return new Set([
    ...(await listNeuralTraces({ run_id: sessionA.external_brain_session_id })),
    ...(await listNeuralTraces({ run_id: sessionB.external_brain_session_id })),
  ].filter((trace) => trace.status === "success").map((trace) => trace.trace_id));
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "phase44d-http-reconnect-"));
const port = await reservePort();
const configPath = path.join(temporaryDirectory, "mcp-http.json");
await writeFile(configPath, JSON.stringify({ host: "127.0.0.1", port }, null, 2), "utf8");
const child = spawn(process.execPath, [serverPath, "--config", configPath], {
  cwd: rootDir,
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
child.stderr.setEncoding("utf8");
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
let clientA;
let clientB;

try {
  await waitForPort(child, port, () => stderr);
  clientA = new Client({ name: "phase44d-client-a", version: "1.0.0" }, { capabilities: {} });
  await clientA.connect(new StreamableHTTPClientTransport(endpoint(port)));
  const toolsA = await clientA.listTools();
  assert.equal(toolsA.tools.length, 24);
  const sessionA = await call(clientA, "chatgpt_bridge_begin_external_brain_writing_session", {
    task_prompt: `${markerAlpha}：雨夜北塔下的抉擇。`,
    chapter_mode: "specific_scene",
  });
  assert.equal(sessionA.ok, true);
  assertMutationGuards(sessionA);
  const sceneA = await invoke(clientA, sessionA, "scene_planner");
  assertSuccess(sceneA, sessionA, "scene_planner");
  assert.match(sceneA.capability_output.objective, new RegExp(markerAlpha, "u"));

  await clientA.close();
  clientA = null;
  await delay(100);

  clientB = new Client({ name: "phase44d-client-b", version: "1.0.0" }, { capabilities: {} });
  await clientB.connect(new StreamableHTTPClientTransport(endpoint(port)));
  const toolsB = await clientB.listTools();
  assert.equal(toolsB.tools.length, 24);
  assert.deepEqual(toolsB.tools.map(({ name }) => name), toolsA.tools.map(({ name }) => name));

  const retryOne = await invoke(clientB, sessionA, "character_simulator", { attempt: 1 });
  const retryTwo = await invoke(clientB, sessionA, "character_simulator", { attempt: 2 });
  assertSuccess(retryOne, sessionA, "character_simulator");
  assertSuccess(retryTwo, sessionA, "character_simulator");
  assert.notEqual(retryOne.trace.trace_id, retryTwo.trace.trace_id);

  const criticA = await invoke(clientB, sessionA, "neural_critic");
  const styleA = await invoke(clientB, sessionA, "style_drift_detector");
  const governanceA = await invoke(clientB, sessionA, "over_governance_detector");
  const cardA = await invoke(clientB, sessionA, "writing_card_director");
  for (const [payload, moduleName] of [[criticA, "neural_critic"], [styleA, "style_drift_detector"], [governanceA, "over_governance_detector"], [cardA, "writing_card_director"]]) {
    assertSuccess(payload, sessionA, moduleName);
  }
  assert.match(cardA.capability_output.direction, new RegExp(markerAlpha, "u"));

  const sessionB = await call(clientB, "chatgpt_bridge_begin_external_brain_writing_session", {
    task_prompt: `${markerBeta}：晨霧練習場邊的告別。`,
    chapter_mode: "specific_scene",
  });
  assert.equal(sessionB.ok, true);
  assert.notEqual(sessionA.external_brain_session_id, sessionB.external_brain_session_id);
  assert.notEqual(sessionA.writing_context_bundle_id, sessionB.writing_context_bundle_id);
  const sceneB = await invoke(clientB, sessionB, "scene_planner");
  const cardB = await invoke(clientB, sessionB, "writing_card_director");
  assertSuccess(sceneB, sessionB, "scene_planner");
  assertSuccess(cardB, sessionB, "writing_card_director");
  assert.match(sceneB.capability_output.objective, new RegExp(markerBeta, "u"));
  assert.doesNotMatch(sceneB.capability_output.objective, new RegExp(markerAlpha, "u"));
  assert.match(cardB.capability_output.direction, new RegExp(markerBeta, "u"));
  assert.notEqual(sceneA.capability_output.input_digest, sceneB.capability_output.input_digest);

  const tracesBeforeFailures = await successTraceIds(sessionA, sessionB);
  const failures = [
    await call(clientB, "chatgpt_bridge_use_scene_planner", {
      external_brain_session_id: sessionA.external_brain_session_id,
      writing_context_bundle_id: sessionB.writing_context_bundle_id,
    }),
    await call(clientB, "chatgpt_bridge_use_scene_planner", {
      external_brain_session_id: sessionB.external_brain_session_id,
      writing_context_bundle_id: sessionA.writing_context_bundle_id,
    }),
    await call(clientB, "chatgpt_bridge_use_scene_planner", {
      external_brain_session_id: unknownSession,
      writing_context_bundle_id: sessionA.writing_context_bundle_id,
    }),
    await call(clientB, "chatgpt_bridge_use_scene_planner", {
      external_brain_session_id: sessionA.external_brain_session_id,
      writing_context_bundle_id: unknownBundle,
    }),
  ];
  for (const failure of failures) assertBlocked(failure);
  const tracesAfterFailures = await successTraceIds(sessionA, sessionB);
  assert.deepEqual(tracesAfterFailures, tracesBeforeFailures);

  for (const capability of ["character_simulator", "neural_critic", "style_drift_detector", "over_governance_detector"]) {
    const result = await invoke(clientB, sessionB, capability);
    assertSuccess(result, sessionB, capability);
  }

  const alphaHash = sha256(rawAlpha);
  const betaHash = sha256(rawBeta);
  assert.notEqual(alphaHash, betaHash);
  const polishA1 = await call(clientB, "chatgpt_bridge_use_final_polisher", {
    external_brain_session_id: sessionA.external_brain_session_id,
    writing_context_bundle_id: sessionA.writing_context_bundle_id,
    raw_story_text: rawAlpha,
  });
  const polishA2 = await call(clientB, "chatgpt_bridge_use_final_polisher", {
    external_brain_session_id: sessionA.external_brain_session_id,
    writing_context_bundle_id: sessionA.writing_context_bundle_id,
    raw_story_text: rawAlpha,
  });
  const polishB = await call(clientB, "chatgpt_bridge_use_final_polisher", {
    external_brain_session_id: sessionB.external_brain_session_id,
    writing_context_bundle_id: sessionB.writing_context_bundle_id,
    raw_story_text: rawBeta,
  });
  assertSuccess(polishA1, sessionA, "final_polisher");
  assertSuccess(polishA2, sessionA, "final_polisher");
  assertSuccess(polishB, sessionB, "final_polisher");
  assert.equal(polishA1.raw_story_sha256, alphaHash);
  assert.equal(polishA2.raw_story_sha256, alphaHash);
  assert.equal(polishB.raw_story_sha256, betaHash);
  assert.notEqual(polishA1.trace.trace_id, polishA2.trace.trace_id);

  console.log(JSON.stringify({
    result: "Phase44D production HTTP MCP reconnect/retry continuity PASS",
    public_tool_count: toolsB.tools.length,
    session_a: sessionA.external_brain_session_id,
    bundle_a: sessionA.writing_context_bundle_id,
    session_b: sessionB.external_brain_session_id,
    bundle_b: sessionB.writing_context_bundle_id,
    reconnect_scene_trace_id: sceneA.trace.trace_id,
    retry_trace_ids: [retryOne.trace.trace_id, retryTwo.trace.trace_id],
    success_trace_count_before_failures: tracesBeforeFailures.size,
    success_trace_count_after_failures: tracesAfterFailures.size,
    final_polisher_a_trace_ids: [polishA1.trace.trace_id, polishA2.trace.trace_id],
    final_polisher_b_trace_id: polishB.trace.trace_id,
    sha_alpha: alphaHash,
    sha_beta: betaHash,
  }, null, 2));
} finally {
  if (clientA) await clientA.close().catch(() => {});
  if (clientB) await clientB.close().catch(() => {});
  await stopChild(child);
  await rm(temporaryDirectory, { recursive: true, force: true });
}
