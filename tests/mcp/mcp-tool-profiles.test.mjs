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

const publicToolNames = [
  "chatgpt_bridge_get_workbench_status",
  "chatgpt_bridge_get_current_inputs",
  "chatgpt_bridge_build_writing_context",
  "chatgpt_bridge_save_candidate",
  "chatgpt_bridge_build_proofing_context",
  "chatgpt_bridge_save_proof_report",
  "chatgpt_bridge_request_adoption",
  "chatgpt_bridge_build_settlement_context",
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
assert.equal(fullNames.length, 58, "full profile tool count changed");
for (const toolName of blockedToolNames) {
  assert(fullNames.includes(toolName), `full profile is missing ${toolName}`);
}

const activeEngineBefore = await readFile(activeEnginePath);
const publicRequests = [
  listRequest,
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

const activeEngineAfter = await readFile(activeEnginePath);
assert.equal(
  sha256(activeEngineAfter),
  sha256(activeEngineBefore),
  "blocked public calls changed active_engine.md",
);

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
