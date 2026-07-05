import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStdioSession } from "../../server/src/mcp-http-stdio-adapter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const publicReadPaths = [
  path.join(rootDir, "config", "engine-components.json"),
  activeEnginePath,
  path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(rootDir, "server", "src", "neural-module-service.mjs"),
  path.join(rootDir, "docs", "DAILY-WORKFLOW.md"),
];

const publicToolNames = [
  "get_engine_components_status",
  "chatgpt_bridge_get_workbench_status",
  "chatgpt_bridge_get_current_inputs",
  "chatgpt_bridge_build_writing_context",
  "chatgpt_bridge_save_candidate",
    "chatgpt_bridge_build_full_neural_writing_handoff",
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "chatgpt_bridge_build_proofing_context",
  "chatgpt_bridge_save_proof_report",
  "chatgpt_bridge_request_adoption",
  "chatgpt_bridge_build_settlement_context",
  "chatgpt_bridge_get_foreshadowing_settlement_surface",
  "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
  "chatgpt_bridge_save_settlement_report",
  "approval_queue_bridge_readiness_report",
];

const blockedToolNames = [
  "activate_engine_version",
  "compress_error_rules",
  "import_policy_file",
  "commit_error_report",
  "create_settlement_proposal",
  "build_pending_engine_candidate_from_settlement_report",
  "request_pending_engine_candidate_activation",
  "query_mcp_audit",
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
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

function adapterCall(session, message) {
  return new Promise((resolve, reject) => {
    session.call(message, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

const listRequest = {
  jsonrpc: "2.0",
  id: "list",
  method: "tools/list",
  params: {},
};

const fullResponses = await runStdioSession("full", [listRequest]);
const fullNames = fullResponses[0].result.tools.map((tool) => tool.name);
assert.equal(fullNames.length, 70, "full profile tool count changed");
for (const toolName of blockedToolNames) {
  assert(fullNames.includes(toolName), `full profile is missing ${toolName}`);
}

const publicReadHashesBefore = new Map();
for (const filePath of publicReadPaths) {
  publicReadHashesBefore.set(filePath, sha256(await readFile(filePath)));
}
const publicRequests = [
  listRequest,
  {
    jsonrpc: "2.0",
    id: "component-status",
    method: "tools/call",
    params: {
      name: "get_engine_components_status",
      arguments: {},
    },
  },
  ...blockedToolNames.map((name, index) => ({
    jsonrpc: "2.0",
    id: `blocked-${index}`,
    method: "tools/call",
    params: {
      name,
      arguments: {},
    },
  })),
  {
    jsonrpc: "2.0",
    id: "ping",
    method: "ping",
    params: {},
  },
];
const publicResponses = await runStdioSession("chatgpt_public", publicRequests);
const publicList = publicResponses.find((response) => response.id === "list");
const listedPublicNames = publicList.result.tools.map((tool) => tool.name);
assert.deepEqual(
  [...listedPublicNames].sort(),
  [...publicToolNames].sort(),
);

const publicToolMap = new Map(publicList.result.tools.map((tool) => [tool.name, tool]));
const publicNativeHandoffTool = publicToolMap.get(
  "chatgpt_bridge_build_full_neural_writing_handoff",
);
assert(
  publicNativeHandoffTool,
  "chatgpt_public missing chatgpt_bridge_build_full_neural_writing_handoff",
);
assert.match(
  publicNativeHandoffTool.description ?? "",
  /ChatGPT-native|ChatGPT itself as the prose generator|final_chatgpt_writing_instruction|After this tool returns, ChatGPT should write/i,
  "chatgpt_bridge_build_full_neural_writing_handoff description should advertise ChatGPT-native writing handoff routing",
);
assert.match(
  publicNativeHandoffTool.description ?? "",
  /does not call or require a backend generation provider|does not save a candidate|does not update Canon|does not update active_engine/i,
  "chatgpt_bridge_build_full_neural_writing_handoff description should preserve no-provider/no-canon/no-candidate safety",
);

const nativeHandoffSchema = publicNativeHandoffTool.inputSchema?.properties ?? {};
for (const forbiddenField of ["provider_type", "provider_id", "model_name", "save_candidate", "generation_provider"]) {
  assert.equal(
    Object.hasOwn(nativeHandoffSchema, forbiddenField),
    false,
    `native handoff schema leaked provider/candidate field ${forbiddenField}`,
  );
}

const nativePermission = publicNativeHandoffTool._meta?.["armed-academy/permission"];
assert.equal(nativePermission?.permission_level, "write_low_risk");
assert.equal(nativePermission?.can_modify_canon, false);
assert.equal(nativePermission?.can_modify_active_engine, false);
assert(nativePermission?.allowed_sources?.includes("user_input"));
assert(nativePermission?.allowed_sources?.includes("registered_project_sources"));
assert(nativePermission?.allowed_sources?.includes("gpt_writing_context_records"));
assert.equal(
  nativePermission?.allowed_sources?.includes("generation_provider"),
  false,
  "native handoff permissionSources must not require generation_provider",
);

const publicNeuralPipelineTool = publicToolMap.get(
  "chatgpt_bridge_run_full_neural_writing_pipeline",
);
assert(
  publicNeuralPipelineTool,
  "chatgpt_public missing chatgpt_bridge_run_full_neural_writing_pipeline fallback",
);
assert.match(
  publicNeuralPipelineTool.description ?? "",
  /Optional fallback|generation-provider|provider_type|not the ChatGPT-native mainline/i,
  "chatgpt_bridge_run_full_neural_writing_pipeline should be documented as optional provider fallback",
);
assert.match(
  publicNeuralPipelineTool.description ?? "",
  /use chatgpt_bridge_build_full_neural_writing_handoff instead/i,
  "provider pipeline description should route ChatGPT-native writing to the native handoff tool",
);
const publicContextTool = publicToolMap.get("chatgpt_bridge_build_writing_context");
assert.match(
  publicContextTool?.description ?? "",
  /context-only|context only|not.*final.*story|do not use.*final/i,
  "chatgpt_bridge_build_writing_context description should warn it is context-only and not final story output",
);
assert.match(
  publicContextTool?.description ?? "",
  /chatgpt_bridge_build_full_neural_writing_handoff/i,
  "chatgpt_bridge_build_writing_context description should route final story output to the ChatGPT-native handoff tool",
);

const publicWritingContextSchema = publicToolMap.get(
  "chatgpt_bridge_build_writing_context",
)?.inputSchema?.properties;
for (const field of ["run_neural_traces", "runNeuralTraces"]) {
  assert.equal(
    publicWritingContextSchema?.[field]?.type,
    "boolean",
    `chatgpt_public chatgpt_bridge_build_writing_context did not expose ${field} as boolean`,
  );
  assert.equal(
    publicWritingContextSchema?.[field]?.default,
    false,
    `chatgpt_public chatgpt_bridge_build_writing_context ${field} default drifted`,
  );
  assert.match(
    publicWritingContextSchema?.[field]?.description ?? "",
    /default false/i,
    `chatgpt_public ${field} schema should document default false`,
  );
  assert.match(
    publicWritingContextSchema?.[field]?.description ?? "",
    /never fake trace success/i,
    `chatgpt_public ${field} schema should document no fake trace success`,
  );
}

const fullToolMap = new Map(fullResponses[0].result.tools.map((tool) => [tool.name, tool]));
for (const toolName of ["chatgpt_bridge_build_writing_context", "build_gpt_writing_context"]) {
  const schema = fullToolMap.get(toolName)?.inputSchema?.properties;
  for (const field of ["run_neural_traces", "runNeuralTraces"]) {
    assert.equal(schema?.[field]?.type, "boolean", `full ${toolName} did not expose ${field} as boolean`);
    assert.equal(schema?.[field]?.default, false, `full ${toolName} ${field} default drifted`);
  }
}

for (const [index, toolName] of blockedToolNames.entries()) {
  assert(!listedPublicNames.includes(toolName), `${toolName} leaked into tools/list`);
  const response = publicResponses.find(
    (item) => item.id === `blocked-${index}`,
  );
  assert.equal(response.error.code, -32602);
  assert.equal(
    response.error.message,
    `Tool not allowed by MCP tool profile chatgpt_public: ${toolName}`,
    `${toolName} reached validation or execution instead of the profile guard`,
  );
}
assert.deepEqual(
  publicResponses.find((response) => response.id === "ping").result,
  {},
);

const componentStatusResponse = publicResponses.find(
  (response) => response.id === "component-status",
);
assert.equal(componentStatusResponse.result.isError, undefined);
const componentStatus = JSON.parse(componentStatusResponse.result.content[0].text);
assert.equal(componentStatus.ok, true);
assert.equal(componentStatus.read_only, true);
assert.equal(componentStatus.components.neural_pipeline.required, true);

for (const filePath of publicReadPaths) {
  assert.equal(
    sha256(await readFile(filePath)),
    publicReadHashesBefore.get(filePath),
    `${path.relative(rootDir, filePath)} changed during public read-only call`,
  );
}

const adapterSession = createStdioSession();
try {
  const adapterList = await adapterCall(adapterSession, {
    jsonrpc: "2.0",
    id: "adapter-list",
    method: "tools/list",
    params: {},
  });
  assert.deepEqual(
    adapterList.result.tools.map((tool) => tool.name).sort(),
    [...publicToolNames].sort(),
    "HTTP stdio adapter did not start its child with chatgpt_public",
  );
} finally {
  adapterSession.close();
}

console.log("MCP tool profile tests passed.");
