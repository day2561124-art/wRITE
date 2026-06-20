import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import {
  callBackendGenerationProvider,
  resolveBackendGenerationProvider,
} from "../../server/src/backend-generation-provider-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
import {
  chatgpt_bridge_run_full_recursive_writing_pipeline,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();
const baseInput = {
  task_prompt: "Phase24B backend generation provider bridge test.",
  generation_context: { scene: "night corridor" },
  retrieval_context: { scope: "candidate only" },
  save_candidate: false,
};
const weakText = "這一章正式設定為千夜新增能力為絕對支配。故事結束。";
const fixedText = [
  "走廊的警示燈閃了兩次，千夜按住受傷的手，仍走向終端。",
  "九逃把止痛貼推過去。「先付代價，再談追擊。」",
  "螢幕跳出候場順序提前的通知，她們只剩十分鐘。",
  "千夜抓起外套，門外響起第二次集合鈴。",
].join("\n\n");
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
  if (draft === weakText) {
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
const candidatesBefore = await names(projectPaths.writingCandidates);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase24b-"));
const commonOptions = {
  env: { NODE_ENV: "production" },
  gptWritingContexts: path.join(tempRoot, "contexts"),
  writingCandidates: path.join(tempRoot, "candidates"),
  finalPolisherAdapter,
  characterVoiceGuardAdapter: async () => ({
    verdict: "pass",
    severity: "none",
    findings: [],
  }),
};

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (request.url === "/http-error") {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unavailable" }));
    return;
  }
  if (request.url === "/invalid-json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{invalid");
    return;
  }
  if (request.url === "/empty") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ model_name: "mock" }));
    return;
  }
  if (request.url === "/simple") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ output_text: fixedText }));
    return;
  }
  const isRevision = body.request_type === "revision";
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    text: isRevision ? fixedText : weakText,
    model_name: "mock-model",
    model_version: "24b",
    provider_trace_id: isRevision ? "trace-revision" : "trace-generation",
  }));
});

try {
  const endpoint = await listen(server);

  const disabled = await runFullRecursiveWritingPipeline(baseInput, commonOptions);
  assert.equal(disabled.status, "failed");
  assert.equal(disabled.stop_reason, "generation_provider_required");
  assert.equal(disabled.final_candidate_text, "");
  assert.equal(disabled.can_output_to_chat, false);
  assert.equal(disabled.generation_provider_required, true);

  const missingEndpoint = resolveBackendGenerationProvider({}, {
    env: {
      NODE_ENV: "production",
      WRITER_BACKEND_GENERATION_PROVIDER: "local_http",
    },
  });
  assert.equal(missingEndpoint.available, false);
  assert.equal(missingEndpoint.status, "generation_provider_required");
  assert(missingEndpoint.warnings.includes("backend_generation_endpoint_missing"));

  const blockedDeterministic = resolveBackendGenerationProvider({
    provider_type: "deterministic_test",
  }, {
    env: { NODE_ENV: "production" },
  });
  assert.equal(blockedDeterministic.available, false);
  assert(blockedDeterministic.warnings.includes("deterministic_test_provider_not_allowed"));

  const deterministic = await runFullRecursiveWritingPipeline({
    ...baseInput,
    provider_type: "deterministic_test",
  }, {
    ...commonOptions,
    allowDeterministicTestProvider: true,
  });
  assert.equal(deterministic.status, "completed");
  assert(deterministic.final_candidate_text);
  assert.equal(deterministic.backend_generation_provider_used, true);
  assert.equal(deterministic.backend_generation_provider_type, "deterministic_test");
  assert.equal(deterministic.can_output_to_chat, true);

  const revised = await runFullRecursiveWritingPipeline({
    ...baseInput,
    provider_type: "local_http",
  }, {
    ...commonOptions,
    provider: {
      provider_type: "local_http",
      provider_id: "phase24b-mock",
      endpoint_url: `${endpoint}/generate`,
    },
  });
  assert.equal(revised.status, "completed");
  assert.equal(revised.recursive_revision.status, "revised");
  assert.equal(revised.recursive_revision.rounds_attempted, 1);
  assert.equal(revised.final_candidate_source, "backend_recursive_revision");
  assert.deepEqual(revised.provider_trace_ids, ["trace-generation", "trace-revision"]);

  const revisionRequired = await runFullRecursiveWritingPipeline(baseInput, {
    ...commonOptions,
    generationAdapter: async () => ({ text: weakText }),
  });
  assert.equal(revisionRequired.status, "failed");
  assert.equal(revisionRequired.stop_reason, "revision_provider_required");
  assert.equal(revisionRequired.final_candidate_text, "");
  assert.equal(revisionRequired.revision_provider_required, true);

  const tokenName = "PHASE24B_TEST_TOKEN";
  const httpProvider = resolveBackendGenerationProvider({}, {
    env: {
      NODE_ENV: "test",
      WRITER_BACKEND_GENERATION_PROVIDER: "remote_http",
      WRITER_BACKEND_GENERATION_ENDPOINT: `${endpoint}/generate`,
      WRITER_BACKEND_GENERATION_TOKEN_ENV: tokenName,
      [tokenName]: "secret-must-not-leak",
    },
  });
  const normal = await callBackendGenerationProvider(httpProvider, {
    request_type: "generation",
    task_prompt: "test",
  });
  assert.equal(normal.text, weakText);
  assert.equal(normal.model_name, "mock-model");
  assert.equal(normal.provider_trace_id, "trace-generation");
  assert.equal(JSON.stringify(httpProvider).includes("secret-must-not-leak"), false);
  assert.equal(JSON.stringify(normal).includes("secret-must-not-leak"), false);

  const simpleProvider = resolveBackendGenerationProvider({}, {
    provider: {
      provider_type: "local_http",
      endpoint_url: `${endpoint}/simple`,
    },
    env: { NODE_ENV: "test" },
  });
  const simple = await callBackendGenerationProvider(simpleProvider, {
    request_type: "generation",
  });
  assert.equal(simple.text, fixedText);

  for (const [route, expected] of [
    ["/http-error", "provider_http_error"],
    ["/empty", "provider_empty_text"],
    ["/invalid-json", "provider_invalid_response"],
  ]) {
    const errorProvider = resolveBackendGenerationProvider({}, {
      provider: {
        provider_type: "local_http",
        endpoint_url: `${endpoint}${route}`,
      },
      env: { NODE_ENV: "test" },
    });
    await assert.rejects(
      callBackendGenerationProvider(errorProvider, { request_type: "generation" }),
      (error) => error.provider_status === expected,
    );
  }

  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline({
    ...baseInput,
    provider_type: "deterministic_test",
  }, {
    ...commonOptions,
    allowDeterministicTestProvider: true,
  });
  assert.equal(bridge.ok, true);
  assert(bridge.result.final_candidate_text);
  assert.equal(bridge.result.output_mode, "chat_text");
  assert.equal(bridge.result.can_output_to_chat, true);
  assert.equal(bridge.result.next_action, "output_final_candidate_text_to_chat");

  const failedBridge = await chatgpt_bridge_run_full_recursive_writing_pipeline(
    baseInput,
    commonOptions,
  );
  assert.equal(failedBridge.result.final_candidate_text, "");
  assert.equal(failedBridge.result.can_output_to_chat, false);
  assert.equal(failedBridge.result.next_action, "configure_backend_generation_provider");

  const previewCandidatesBefore = await names(commonOptions.writingCandidates);
  await runFullRecursiveWritingPipeline({
    ...baseInput,
    provider_type: "deterministic_test",
    save_candidate: false,
  }, {
    ...commonOptions,
    allowDeterministicTestProvider: true,
  });
  assert.deepEqual(await names(commonOptions.writingCandidates), previewCandidatesBefore);

  const saved = await runFullRecursiveWritingPipeline({
    ...baseInput,
    provider_type: "deterministic_test",
    save_candidate: true,
  }, {
    ...commonOptions,
    allowDeterministicTestProvider: true,
  });
  assert.equal(saved.candidate_created, true);
  assert.equal(saved.canon_status, "candidate_only");
  assert.equal(saved.active_engine_update_allowed, false);
  assert.equal(saved.canon_update_allowed, false);
  assert.equal(saved.adopted, false);
  assert.equal(saved.settled, false);

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file), `${file} changed`);
  }
  assert.deepEqual(await names(projectPaths.writingCandidates), candidatesBefore);
  console.log("Phase24B backend generation provider bridge tests passed.");
} finally {
  if (server.listening) await close(server);
  await rm(tempRoot, { recursive: true, force: true });
}
