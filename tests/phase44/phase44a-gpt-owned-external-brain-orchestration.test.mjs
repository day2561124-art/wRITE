import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const rawStory = "第44A章 夜雨\n\n雨水沿著窗框滑落，她握緊門把，沒有回頭。";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const preCapabilities = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];

async function treeDigest(relativePath) {
  const root = path.join(rootDir, relativePath);
  const records = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(prefix, entry.name).replaceAll("\\", "/");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) records.push(`${relative}:${sha256(await readFile(absolute))}`);
    }
  }
  await visit(root);
  return sha256(records.join("\n"));
}

const productionStateBefore = {
  canon_db: await treeDigest("data/canon_db"),
  writing_candidates: await treeDigest("data/outputs/writing_candidates"),
};

const child = spawn(process.execPath, [serverPath], {
  cwd: rootDir,
  env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_public" },
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
let stdoutBuffer = "";
let stderr = "";
let nextId = 1;
const pending = new Map();
child.stderr.on("data", (chunk) => { stderr += chunk; });
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split(/\r?\n/u);
  stdoutBuffer = lines.pop() ?? "";
  for (const line of lines.filter(Boolean)) {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter.resolve(message);
    }
  }
});

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP request ${id} timed out. STDERR:\n${stderr}`));
    }, 120_000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject,
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function payload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response.error));
  assert.notEqual(response.result?.isError, true);
  return JSON.parse(response.result.content[0].text);
}

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "phase44a", version: "1" },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  const listed = await request("tools/list");
  const toolMap = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
  assert.match(toolMap.get("chatgpt_bridge_get_workbench_status")?.description ?? "", /inspection only/i);
  assert.match(toolMap.get("chatgpt_bridge_begin_external_brain_writing_session")?.description ?? "", /Architecture-primary/i);
  assert.match(toolMap.get("chatgpt_bridge_build_full_neural_writing_handoff")?.description ?? "", /aggregate compatibility/i);
  for (const capability of [...preCapabilities, "final_polisher"]) {
    assert(toolMap.has(`chatgpt_bridge_use_${capability}`));
  }

  const begin = payload(await request("tools/call", {
    name: "chatgpt_bridge_begin_external_brain_writing_session",
    arguments: { task_prompt: "以 GPT 為唯一寫作者，寫一個雨夜場景。", chapter_mode: "specific_scene" },
  }));
  assert.equal(begin.tool_name, "chatgpt_bridge_begin_external_brain_writing_session");
  const session = begin;
  assert.equal(session.ok, true);
  assert.equal(session.architecture_route, "chatgpt_owned_external_brain");
  assert.equal(session.orchestration_owner, "ChatGPT");
  assert.equal(session.prose_generator, "ChatGPT");
  assert.match(session.external_brain_session_id, /^agent_run_/u);
  assert.match(session.writing_context_bundle_id, /^gptctx_/u);

  const traces = [];
  for (const capability of preCapabilities) {
    const toolName = `chatgpt_bridge_use_${capability}`;
    const called = payload(await request("tools/call", {
      name: toolName,
      arguments: {
        external_brain_session_id: session.external_brain_session_id,
        writing_context_bundle_id: session.writing_context_bundle_id,
        capability_input: { requested_by: "chatgpt" },
      },
    }));
    assert.equal(called.tool_name, toolName);
    assert.equal(called.capability_name, `run_${capability}`);
    assert.equal(called.generation_boundary, "pre_generation");
    assert.equal(called.external_brain_session_id, session.external_brain_session_id);
    assert.equal(called.trace.run_id, session.external_brain_session_id);
    assert.equal(called.trace.module_name, capability);
    assert.equal(called.trace.status, "success");
    assert.match(called.trace.trace_id, /^neural_trace_/u);
    assert.match(called.trace.output_hash, /^[a-f0-9]{64}$/u);
    assert(called.capability_output && typeof called.capability_output === "object");
    traces.push(called.trace.trace_id);
  }

  const polished = payload(await request("tools/call", {
    name: "chatgpt_bridge_use_final_polisher",
    arguments: {
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      raw_story_text: rawStory,
    },
  }));
  assert.equal(polished.tool_name, "chatgpt_bridge_use_final_polisher");
  assert.equal(polished.capability_name, "run_final_polisher");
  assert.equal(polished.generation_boundary, "post_generation");
  assert.equal(polished.raw_story_sha256, sha256(rawStory));
  assert.equal(polished.capability_output.raw_story_sha256, sha256(rawStory));
  assert.equal(polished.capability_output.polished_text, rawStory);
  assert.equal(polished.trace.module_name, "final_polisher");
  assert.equal(polished.trace.status, "success");
  assert.equal(polished.trace.run_id, session.external_brain_session_id);
  assert.equal(polished.agent_run_status, "success");
  traces.push(polished.trace.trace_id);
  assert.equal(new Set(traces).size, 7);

  for (const result of [session, polished]) {
    assert.equal(result.candidate_created, false);
    assert.equal(result.canon_updated, false);
    assert.equal(result.active_engine_updated, false);
    assert.equal(result.adopted, false);
    assert.equal(result.settled, false);
  }
  assert.deepEqual({
    canon_db: await treeDigest("data/canon_db"),
    writing_candidates: await treeDigest("data/outputs/writing_candidates"),
  }, productionStateBefore);
  console.log(`Phase 44A GPT-owned external brain orchestration passed: 7/7 individual traces, session=${session.external_brain_session_id}, raw_story_sha256=${sha256(rawStory)}`);
} finally {
  child.stdin.end();
  await new Promise((resolve) => child.once("close", resolve));
}
