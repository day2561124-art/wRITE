import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function fileHash(relativePath) {
  try {
    return sha256(await readFile(path.join(rootDir, relativePath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function dirSnapshot(relativePath) {
  const dir = path.join(rootDir, relativePath);
  try {
    const entries = await readdir(dir);
    const rows = [];
    for (const entry of entries.sort()) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);
      rows.push({
        entry,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
      });
    }
    return rows;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function runStdioSession(profile, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: profile,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }

      try {
        resolve(
          stdout
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        );
      } catch (error) {
        reject(new Error(`Could not parse MCP output: ${error.message}\n${stdout}`));
      }
    });

    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";

const protectedFileHashesBefore = new Map([
  ["data/canon_db/active_engine.md", await fileHash("data/canon_db/active_engine.md")],
  ["data/outputs/logs/draft_index.jsonl", await fileHash("data/outputs/logs/draft_index.jsonl")],
  ["data/outputs/logs/proof_report_index.jsonl", await fileHash("data/outputs/logs/proof_report_index.jsonl")],
  ["data/outputs/logs/settlement_proposal_index.jsonl", await fileHash("data/outputs/logs/settlement_proposal_index.jsonl")],
  ["data/feedback_db/accepted_drafts.jsonl", await fileHash("data/feedback_db/accepted_drafts.jsonl")],
  ["data/feedback_db/rejected_drafts.jsonl", await fileHash("data/feedback_db/rejected_drafts.jsonl")],
]);

const protectedDirSnapshotsBefore = new Map([
  ["data/outputs/drafts", await dirSnapshot("data/outputs/drafts")],
  ["data/outputs/proof_reports", await dirSnapshot("data/outputs/proof_reports")],
  ["data/outputs/settlement_proposals", await dirSnapshot("data/outputs/settlement_proposals")],
]);

const responses = await runStdioSession("chatgpt_public", [
  {
    jsonrpc: "2.0",
    id: "initialize",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "phase38i-chatgpt-native-handoff-live-mcp-acceptance-smoke",
        version: "38I",
      },
    },
  },
  {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: "tools-list",
    method: "tools/list",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: "native-handoff-call",
    method: "tools/call",
    params: {
      name: "chatgpt_bridge_build_full_neural_writing_handoff",
      arguments: {
        task_prompt: taskPrompt,
        generation_context: {
          phase: "38I",
          route_expectation: "chatgpt_native_handoff",
        },
        retrieval_context: {
          acceptance_smoke: "phase38i",
        },
        chapter_mode: "next_chapter",
        output_mode: "chatgpt_native_handoff",
        max_context_chars: 48000,
      },
      _meta: {
        actor: "phase38i-live-mcp-acceptance-smoke",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: "old-provider-call-negative-shape",
    method: "tools/call",
    params: {
      name: "chatgpt_bridge_run_full_neural_writing_pipeline",
      arguments: {
        task_prompt: taskPrompt,
        output_mode: "chatgpt_native_handoff",
      },
    },
  },
]);

const initializeResponse = responses.find((response) => response.id === "initialize");
assert.equal(initializeResponse?.result?.serverInfo?.name, "armed-academy-fiction-engine");

const listResponse = responses.find((response) => response.id === "tools-list");
const tools = listResponse.result.tools;
const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

assert(toolMap.has("chatgpt_bridge_build_full_neural_writing_handoff"));
assert(toolMap.has("chatgpt_bridge_begin_external_brain_writing_session"));
assert(toolMap.has("chatgpt_bridge_run_full_neural_writing_pipeline"));

const nativeTool = toolMap.get("chatgpt_bridge_build_full_neural_writing_handoff");
assert.match(
  nativeTool.description ?? "",
  /aggregate compatibility|ChatGPT remains orchestration owner and final prose generator/i,
);
assert.match(
  nativeTool.description ?? "",
  /does not call or require a backend generation provider|does not save a candidate|does not update Canon|does not update active_engine/i,
);

const nativeSchema = nativeTool.inputSchema?.properties ?? {};
assert.equal(nativeSchema.task_prompt?.type, "string");
assert.equal(nativeSchema.output_mode?.enum?.includes("chatgpt_native_handoff"), true);
for (const forbiddenField of ["provider_type", "provider_id", "model_name", "save_candidate", "generation_provider"]) {
  assert.equal(
    Object.hasOwn(nativeSchema, forbiddenField),
    false,
    `native handoff schema must not expose ${forbiddenField}`,
  );
}

const nativePermission = nativeTool._meta?.["armed-academy/permission"];
assert.equal(nativePermission?.permission_level, "write_low_risk");
assert.equal(nativePermission?.can_modify_canon, false);
assert.equal(nativePermission?.can_modify_active_engine, false);
assert(nativePermission?.allowed_sources?.includes("user_input"));
assert(nativePermission?.allowed_sources?.includes("registered_project_sources"));
assert(nativePermission?.allowed_sources?.includes("gpt_writing_context_records"));
assert.equal(nativePermission?.allowed_sources?.includes("generation_provider"), false);

const oldProviderTool = toolMap.get("chatgpt_bridge_run_full_neural_writing_pipeline");
assert.match(
  oldProviderTool.description ?? "",
  /Optional fallback|generation-provider|provider_type|not the ChatGPT-native mainline/i,
);
assert.match(
  oldProviderTool.description ?? "",
  /chatgpt_bridge_begin_external_brain_writing_session/i,
);

const handoffResponse = responses.find((response) => response.id === "native-handoff-call");
assert.equal(handoffResponse.result.isError, undefined);

const handoffToolPayload = JSON.parse(handoffResponse.result.content[0].text);
assert.equal(
  handoffToolPayload.tool_name ?? handoffToolPayload.result?.tool_name,
  "chatgpt_bridge_build_full_neural_writing_handoff",
);

const handoffResult = handoffToolPayload.result ?? handoffToolPayload;
if (handoffResult?.status !== "ready_for_chatgpt_native_generation") {
  console.error("Unexpected native handoff MCP payload:");
  console.error(JSON.stringify(handoffToolPayload, null, 2).slice(0, 8000));
}
assert.equal(handoffResult.status, "ready_for_chatgpt_native_generation");
assert.equal(handoffResult.output_mode, "chatgpt_native_handoff");
assert.equal(handoffResult.candidate_created, false);
assert.equal(handoffResult.candidate_id, null);
assert.equal(handoffResult.canon_updated, false);
assert.equal(handoffResult.active_engine_updated, false);
assert.equal(handoffResult.adopted, false);
assert.equal(handoffResult.settled, false);

const handoff = handoffResult.chatgpt_native_writing_handoff;
assert.equal(handoff.used, true);
assert.equal(handoff.contract_valid, true);
assert.equal(handoff.surface_kind, "chatgpt_native_full_neural_writing_handoff");
assert.match(handoff.final_chatgpt_writing_instruction, /ChatGPT 原生正文生成器/u);
assert.match(handoff.final_chatgpt_writing_instruction, /直接依使用者任務輸出正文/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不要要求使用者啟動 local generation provider/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不加工程說明/u);

assert.equal(handoff.constraints.tool_must_not_generate_story_text, true);
assert.equal(handoff.constraints.chatgpt_must_generate_after_handoff, true);
assert.equal(handoff.constraints.chatgpt_may_generate_story_text, true);
assert.equal(handoff.constraints.save_candidate, false);
assert.equal(handoff.constraints.candidate_created, false);
assert.equal(handoff.constraints.canon_update_allowed, false);
assert.equal(handoff.constraints.active_engine_update_allowed, false);
assert.equal(handoff.constraints.backend_provider_required, false);
assert.equal(handoff.constraints.local_provider_required, false);
assert.equal(handoff.constraints.provider_type_required, false);

assert.equal(typeof handoff.writing_context, "object");
assert.equal(typeof handoff.constraints, "object");
assert.equal(typeof handoff.neural_modules_diagnostics, "object");
assert.equal(handoff.neural_modules_diagnostics.required_modules_checked, true);

const forbiddenSurfaceFields = [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "generation_provider_required",
];

for (const forbidden of forbiddenSurfaceFields) {
  assert.equal(
    Object.hasOwn(handoffResult, forbidden),
    false,
    `native handoff top-level surface leaked ${forbidden}`,
  );
  assert.equal(
    Object.hasOwn(handoff, forbidden),
    false,
    `native handoff contract surface leaked ${forbidden}`,
  );
  assert.equal(
    Object.hasOwn(handoff.constraints ?? {}, forbidden),
    false,
    `native handoff constraints leaked ${forbidden}`,
  );
}

const nativeSurfaceForLeakCheck = {
  ...handoffResult,
  chatgpt_native_writing_handoff: {
    ...handoff,
    writing_context: "[omitted from surface leak check]",
    neural_modules_diagnostics: "[omitted from surface leak check]",
  },
};

const serializedNativeSurface = JSON.stringify(nativeSurfaceForLeakCheck);
for (const forbidden of forbiddenSurfaceFields) {
  assert.equal(
    serializedNativeSurface.includes(`"${forbidden}"`),
    false,
    `native handoff exposed legacy output field ${forbidden} on its MCP surface`,
  );
}

const oldProviderNegativeResponse = responses.find((response) => response.id === "old-provider-call-negative-shape");
assert.equal(oldProviderNegativeResponse.error?.code, undefined);
assert.equal(oldProviderNegativeResponse.result?.isError, true);
assert.match(
  oldProviderNegativeResponse.result.content[0].text,
  /output_mode must be one of: chat_text|provider_type|generation provider/i,
  "old provider pipeline should not accept chatgpt_native_handoff shape",
);

for (const [relativePath, beforeHash] of protectedFileHashesBefore.entries()) {
  assert.equal(
    await fileHash(relativePath),
    beforeHash,
    `${relativePath} changed during native handoff live smoke`,
  );
}

for (const [relativePath, beforeSnapshot] of protectedDirSnapshotsBefore.entries()) {
  assert.deepEqual(
    await dirSnapshot(relativePath),
    beforeSnapshot,
    `${relativePath} changed during native handoff live smoke`,
  );
}

const serverSource = await readFile(path.join(rootDir, "server", "src", "mcp-server.mjs"), "utf8");
assert.match(
  serverSource,
  /architecture-primary route begins with chatgpt_bridge_begin_external_brain_writing_session/u,
);
assert.match(
  serverSource,
  /Optional fallback full neural story writing pipeline entry/u,
);

console.log("Phase38I ChatGPT native handoff live MCP acceptance smoke tests passed.");
