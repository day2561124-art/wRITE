import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once, EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  externalBrainOwnership,
  externalBrainPreGenerationCapabilities,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { buildRawStoryIntegrityManifest } from "../../server/src/raw-story-handoff-integrity-service.mjs";
import {
  createEphemeralRawStoryHandoffBroker,
  createRawStoryHandoffId,
  rawStoryHandoffBrokerProtocol,
} from "../../server/src/raw-story-handoff-ephemeral-broker.mjs";
import { createRawStoryHandoffBrokerIpcClient } from "../../server/src/raw-story-handoff-broker-ipc.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(rootDir, "server", "src", "mcp-http-server.mjs");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const story = "Phase47J 唯一隱私正文\r\n她沒有改動那個全形空格。　😀\n\uFEFF末行保留。 ";
const protectedHashes = {
  [projectPaths.activeEngine]: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  [projectPaths.compressedRules]: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const immutableEvidencePath = path.join(projectRoot, "config", "phase46d-real-chatgpt-immutable-raw-story-handoff-live-acceptance-evidence.json");
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];

async function names(directory) {
  try { return new Set(await readdir(directory)); }
  catch (error) { if (error.code === "ENOENT") return new Set(); throw error; }
}

async function removeNewEntries(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer().unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") return reject(new Error("Unable to reserve HTTP port."));
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

async function connectClient(port, name) {
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  await withTimeout(client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`))), `${name} connect`);
  return client;
}

async function withTimeout(promise, label, timeoutMs = 90_000) {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => { throw new Error(`${label} timed out after ${timeoutMs}ms`); }),
  ]);
}

async function assertStoryAbsentFromFiles(root) {
  async function visit(current) {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); }
    catch (error) {
      if (error.code === "ENOENT") return;
      if (error.code === "ENOTDIR") {
        const content = await readFile(current);
        assert.equal(content.includes(Buffer.from(story, "utf8")), false, `raw story persisted at ${current}`);
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const content = await readFile(absolute);
        assert.equal(content.includes(Buffer.from(story, "utf8")), false, `raw story persisted at ${absolute}`);
      }
    }
  }
  await visit(root);
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));
const evidenceBefore = await readFile(immutableEvidencePath);
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "phase47j-parent-broker-"));
const port = await reservePort();
const configPath = path.join(temporaryDirectory, "mcp-http.json");
await writeFile(configPath, JSON.stringify({ host: "127.0.0.1", port }, null, 2), "utf8");
const httpParent = spawn(process.execPath, [serverPath, "--config", configPath], {
  cwd: rootDir,
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
httpParent.stderr.setEncoding("utf8");
let stderr = "";
httpParent.stderr.on("data", (chunk) => { stderr += chunk; });
let childAClient;
let childBClient;

try {
  assert.deepEqual(externalBrainPreGenerationCapabilities, [
    "run_scene_planner",
    "run_character_simulator",
    "run_neural_critic",
    "run_style_drift_detector",
    "run_over_governance_detector",
    "run_writing_card_director",
  ]);
  assert.equal(externalBrainOwnership.orchestration_owner, "chatgpt");
  assert.equal(externalBrainOwnership.final_prose_generator, "chatgpt");
  for (const [filePath, expected] of Object.entries(protectedHashes)) {
    assert.equal(sha256(await readFile(filePath)), expected);
  }

  const broker = createEphemeralRawStoryHandoffBroker();
  const unitId = createRawStoryHandoffId();
  const unitManifest = buildRawStoryIntegrityManifest(story);
  const stored = broker.store({
    raw_story_handoff_id: unitId,
    run_id: "agent_run_20260714-120000-1234abcd",
    writing_context_bundle_id: "gptctx_20260714-120000-1234abcd",
    raw_story_text: story,
    seal_ingress_raw_story_sha256: sha256(story),
    raw_story_integrity_manifest: unitManifest,
  });
  assert.equal(stored.parent_broker_received_raw_story_sha256, sha256(story));
  assert.equal(stored.internal_payload_continuity_exact_match, true);
  assert.equal(JSON.stringify(stored).includes(story), false);
  const acquisitions = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => broker.acquire({
    raw_story_handoff_id: unitId,
    run_id: "agent_run_20260714-120000-1234abcd",
    writing_context_bundle_id: "gptctx_20260714-120000-1234abcd",
  }))));
  assert.deepEqual(acquisitions.map(({ status }) => status).sort(), ["fulfilled", "rejected"]);
  const acquired = acquisitions.find(({ status }) => status === "fulfilled").value;
  assert.equal(acquired.raw_story_text, story);
  broker.consume({ raw_story_handoff_id: unitId, handoff_lease_id: acquired.handoff_lease_id });
  assert.equal(broker.getReceipt(unitId).status, "consumed");
  assert.equal(broker.getReceipt(unitId).payload_reference_active, false);
  assert.equal(broker.getStorageStatus().secure_memory_erase_claimed, false);
  assert.throws(() => broker.acquire({
    raw_story_handoff_id: unitId,
    run_id: "agent_run_20260714-120000-1234abcd",
    writing_context_bundle_id: "gptctx_20260714-120000-1234abcd",
  }), /consumed/u);

  const mismatchId = createRawStoryHandoffId();
  assert.throws(() => broker.store({
    raw_story_handoff_id: mismatchId,
    run_id: "agent_run_20260714-120000-1234abcd",
    writing_context_bundle_id: "gptctx_20260714-120000-1234abcd",
    raw_story_text: story,
    seal_ingress_raw_story_sha256: "0".repeat(64),
    raw_story_integrity_manifest: unitManifest,
  }), /mismatch/u);
  assert.equal(broker.getReceipt(mismatchId), null);

  const restartedBroker = createEphemeralRawStoryHandoffBroker();
  assert.notEqual(restartedBroker.broker_runtime_process_instance_id, broker.broker_runtime_process_instance_id);
  assert.throws(() => restartedBroker.acquire({
    raw_story_handoff_id: unitId,
    run_id: "agent_run_20260714-120000-1234abcd",
    writing_context_bundle_id: "gptctx_20260714-120000-1234abcd",
  }), /not found/u);

  const unavailableProcess = new EventEmitter();
  unavailableProcess.connected = false;
  const unavailableClient = createRawStoryHandoffBrokerIpcClient({ process_like: unavailableProcess, timeout_ms: 25 });
  await assert.rejects(unavailableClient.acquire({}), /parent_broker_unavailable/u);

  const adapterSource = await readFile(path.join(rootDir, "server", "src", "mcp-http-stdio-adapter.mjs"), "utf8");
  const httpSource = await readFile(serverPath, "utf8");
  const ipcSource = await readFile(path.join(rootDir, "server", "src", "raw-story-handoff-broker-ipc.mjs"), "utf8");
  const brokerSource = await readFile(path.join(rootDir, "server", "src", "raw-story-handoff-ephemeral-broker.mjs"), "utf8");
  const sealSource = await readFile(path.join(rootDir, "server", "src", "raw-story-handoff-seal-service.mjs"), "utf8");
  assert.match(adapterSource, /stdio: \['pipe', 'pipe', 'pipe', 'ipc'\]/u);
  assert.match(adapterSource, /spawn\(process\.execPath, \['server\/src\/mcp-server\.mjs'\]/u);
  assert.match(httpSource, /const sessions = new Map\(\)/u);
  assert.match(httpSource, /createStdioSession\(\{ rawStoryHandoffBroker \}\)/u);
  assert.match(httpSource, /mcp_http_parent_process_ephemeral_memory/u);
  assert.match(brokerSource, new RegExp(rawStoryHandoffBrokerProtocol.replaceAll(".", "\\."), "u"));
  assert.doesNotMatch(ipcSource, /stdout\.write|child\.stdout/u);
  assert.doesNotMatch(`${ipcSource}\n${sealSource}`, /NODE_ENV/u);

  await waitForPort(httpParent, port, () => stderr);
  const begin = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "Phase47J cross-child parent broker acceptance",
    chapter_mode: "specific_scene",
  });
  assert.equal(begin.ok, true);
  for (const [capability, invoke] of [
    ["scene_planner", chatgpt_bridge_use_scene_planner],
    ["character_simulator", chatgpt_bridge_use_character_simulator],
    ["neural_critic", chatgpt_bridge_use_neural_critic],
    ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
    ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
  ]) {
    const response = await invoke({
      external_brain_session_id: begin.external_brain_session_id,
      writing_context_bundle_id: begin.writing_context_bundle_id,
      capability_input: { phase: "47J", module_name: capability },
    });
    assert.equal(response.ok, true);
  }
  const director = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: begin.external_brain_session_id,
    writing_context_bundle_id: begin.writing_context_bundle_id,
  });
  assert.equal(director.ok, true);
  assert.equal(director.capability_output.integration_mode, "same_author_cognition_synthesis");

  childAClient = await connectClient(port, "phase47j-seal-child-a");
  const tools = await childAClient.listTools();
  assert.equal(tools.tools.length, 25);
  const sealed = parse(await withTimeout(childAClient.callTool({
    name: "chatgpt_bridge_seal_raw_story_handoff",
    arguments: {
      external_brain_session_id: begin.external_brain_session_id,
      writing_context_bundle_id: begin.writing_context_bundle_id,
      raw_story_text: story,
    },
  }), `seal child A call; parent stderr=${stderr}`));
  assert.equal(sealed.ok, true);
  assert.equal(sealed.raw_story_sha256, sha256(story));
  assert.equal(sealed.seal_ingress_raw_story_sha256, sha256(story));
  assert.equal(sealed.parent_broker_received_raw_story_sha256, sha256(story));
  assert.equal(sealed.internal_payload_continuity_exact_match, true);
  assert.equal(sealed.broker_storage_scope, "mcp_http_parent_process_ephemeral_memory");
  assert.equal(sealed.broker_persistence, "none");
  assert.equal(JSON.stringify(sealed).includes(story), false);

  childBClient = await connectClient(port, "phase47j-final-polisher-child-b");
  const polished = parse(await withTimeout(childBClient.callTool({
    name: "chatgpt_bridge_use_final_polisher",
    arguments: {
      external_brain_session_id: begin.external_brain_session_id,
      writing_context_bundle_id: begin.writing_context_bundle_id,
      raw_story_handoff_id: sealed.raw_story_handoff_id,
    },
  }), `final child B call; parent stderr=${stderr}`));
  assert.equal(polished.ok, true, JSON.stringify(polished));
  assert.notEqual(polished.runtime_process_instance_id, sealed.runtime_process_instance_id);
  assert.equal(polished.broker_runtime_process_instance_id, sealed.broker_runtime_process_instance_id);
  assert.equal(polished.raw_story_integrity.seal_ingress_raw_story_sha256, sha256(story));
  assert.equal(polished.raw_story_integrity.parent_broker_received_raw_story_sha256, sha256(story));
  assert.equal(polished.raw_story_integrity.final_polisher_resolved_raw_story_sha256, sha256(story));
  assert.equal(polished.raw_story_integrity.triple_hash_exact_match, true);
  assert.equal(polished.raw_story_integrity.integrity_route, "single_ingress_immutable_seal");
  assert.equal(polished.trace.status, "success");
  assert.equal(JSON.stringify(polished).includes(story), false);
  for (const guard of ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"]) {
    assert.equal(polished[guard], false);
    assert.equal(polished.mutation_guards[guard], false);
  }
  for (const persistedRoot of [
    path.join(projectPaths.agentRuns, begin.external_brain_session_id),
    path.join(projectPaths.neuralModuleOutputs, begin.external_brain_session_id),
    path.join(projectPaths.gptWritingContexts, begin.writing_context_bundle_id),
    path.join(projectPaths.outputLogs, "mcp_audit_intents"),
  ]) {
    await assertStoryAbsentFromFiles(persistedRoot);
  }
  for (const traceName of await names(projectPaths.neuralTraces)) {
    if (!cleanupBaselines.get(projectPaths.neuralTraces).has(traceName)) {
      await assertStoryAbsentFromFiles(path.join(projectPaths.neuralTraces, traceName));
    }
  }
  await assertStoryAbsentFromFiles(path.join(projectPaths.outputLogs, "mcp_tool_audit.jsonl"));
  await assertStoryAbsentFromFiles(path.join(projectPaths.outputLogs, "transactions"));
  assert.deepEqual(await readFile(immutableEvidencePath), evidenceBefore);
  for (const [filePath, expected] of Object.entries(protectedHashes)) {
    assert.equal(sha256(await readFile(filePath)), expected);
  }
  console.log("Phase47J MCP parent ephemeral raw-story seal broker PASS.");
} finally {
  if (childAClient) await Promise.race([childAClient.close().catch(() => {}), delay(5_000)]);
  if (childBClient) await Promise.race([childBClient.close().catch(() => {}), delay(5_000)]);
  await stopChild(httpParent);
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const root of cleanupRoots.toReversed()) await removeNewEntries(root, cleanupBaselines.get(root));
}
