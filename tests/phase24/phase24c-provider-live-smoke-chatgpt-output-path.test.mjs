import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import {
  chatgpt_bridge_run_full_recursive_writing_pipeline,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();
const draftText = "千夜站在走廊，事情結束了。";
const finalText = [
  "走廊盡頭的警示燈亮起時，千夜沒有先看傷口。",
  "她把終端貼到牆邊的讀取框，讓九逃能看見跳出的候場變更。",
  "九逃壓低聲音。「妳可以現在退掉，這不是丟臉。」",
  "千夜把外套披回肩上，聽見門後第二次集合鈴響起。",
].join("\n\n");
const tokenName = "PHASE24C_PROVIDER_TOKEN";
const tokenValue = "phase24c-secret-must-not-leak";
const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
  projectPaths.entityRegistryData,
  projectPaths.entityRegistryIndex,
  projectPaths.entityRegistryBuildReport,
  projectPaths.entityRegistryConflictReport,
  projectPaths.entityRegistryProvenance,
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

function createdSince(after, before) {
  return [...after].filter((name) => !before.has(name)).sort();
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (
    error ? reject(error) : resolve()
  )));
}

function finalPolisherAdapter({ raw_draft_text: draft }) {
  if (draft === draftText) {
    return {
      status: "completed",
      polished_text: draft,
      needs_structural_revision: true,
      suggested_return_stage: "draft_revision",
      revision_report: {
        structural_gate: {
          reasons: ["missing_scene_function", "missing_ending_event_hook"],
        },
        risk_flags: ["pretty_but_empty_ending"],
      },
      warnings: [],
    };
  }
  return {
    status: "completed",
    polished_text: draft,
    needs_structural_revision: false,
    warnings: [],
  };
}

const protectedBefore = new Map();
for (const file of protectedFiles) {
  protectedBefore.set(file, hash(await readFile(file)));
}
const repoCandidatesBefore = await names(projectPaths.writingCandidates);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase24c-"));
const requests = [];
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  requests.push({ body, url: request.url, headers: request.headers });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    text: body.request_type === "revision" ? finalText : draftText,
    model_name: "phase24c-live-smoke-model",
    model_version: "24c-live",
    provider_trace_id: `phase24c-${body.request_type}-trace`,
  }));
});

try {
  const endpoint = await listen(server);
  const options = {
    env: {
      NODE_ENV: "production",
      WRITER_BACKEND_GENERATION_PROVIDER: "remote_http",
      WRITER_BACKEND_GENERATION_PROVIDER_ID: "phase24c-live-smoke-provider",
      WRITER_BACKEND_GENERATION_ENDPOINT: `${endpoint}/writer`,
      WRITER_BACKEND_GENERATION_TOKEN_ENV: tokenName,
      WRITER_BACKEND_GENERATION_MODEL: "phase24c-live-smoke-model",
      WRITER_BACKEND_GENERATION_VERSION: "24c-live",
      [tokenName]: tokenValue,
    },
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    finalPolisherAdapter,
    characterVoiceGuardAdapter: async () => ({
      character_voice_guard_used: true,
      character_voice_registry_loaded: true,
      verdict: "fail",
      severity: "high",
      findings: [{
        code: "phase24c_voice_gate_smoke",
        severity: "high",
        characters: ["千夜"],
      }],
    }),
  };
  const previewCandidatesBefore = await names(options.writingCandidates);
  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline({
    task_prompt: "Phase24C provider live smoke and ChatGPT output path test.",
    generation_context: { scene: "live provider corridor smoke" },
    retrieval_context: { scope: "candidate only", phase: "24C" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, options);
  const result = bridge.result;
  assert.equal(bridge.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.final_candidate_text, finalText);
  assert.equal(result.final_text_can_be_displayed, true);
  assert.equal(result.can_output_to_chat, true);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat");
  assert.equal(result.output_mode, "chat_text");
  assert.equal(result.save_candidate_requested, false);
  assert.equal(result.candidate_created, false);
  assert.equal(result.candidate_id, null);
  assert.equal(result.canon_status, "candidate_only");
  assert.equal(result.direct_adoption_allowed, false);
  assert.equal(result.adoption_requires_approval_queue, true);
  assert.equal(result.active_engine_update_allowed, false);
  assert.equal(result.canon_update_allowed, false);
  assert.equal(result.character_voice_guard_display.blocking, true);
  assert.equal(result.character_voice_guard.blocking, true);
  assert.deepEqual(result.provider_trace_ids, [
    "phase24c-generation-trace",
    "phase24c-revision-trace",
  ]);
  assert.equal(result.generation_provider.provider_type, "remote_http");
  assert.equal(result.generation_provider.provider_id, "phase24c-live-smoke-provider");
  assert.equal(result.generation_provider.endpoint_url_present, true);
  assert.equal(result.generation_provider.token_env_name, tokenName);
  assert.equal(result.generation_provider.token_present, true);
  assert.deepEqual(requests.map((item) => item.body.request_type), ["generation", "revision"]);
  assert(requests.every((item) => item.url === "/writer"));
  assert(requests.every((item) => item.headers.authorization === `Bearer ${tokenValue}`));
  assert(requests.every((item) => item.body.safety_contract?.candidate_only === true));
  assert(requests.every((item) => item.body.safety_contract?.no_canon_update === true));
  assert(requests.every((item) => item.body.safety_contract?.no_active_engine_update === true));
  assert(requests.every((item) => item.body.safety_contract?.no_adoption === true));
  assert.deepEqual(createdSince(await names(options.writingCandidates), previewCandidatesBefore), []);
  assert.equal(JSON.stringify(bridge).includes(tokenValue), false);
  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file), `${file} changed`);
  }
  assert.deepEqual(await names(projectPaths.writingCandidates), repoCandidatesBefore);
  console.log("Phase24C provider live smoke and ChatGPT output path tests passed.");
} finally {
  if (server.listening) await close(server);
  await rm(tempRoot, { recursive: true, force: true });
}
