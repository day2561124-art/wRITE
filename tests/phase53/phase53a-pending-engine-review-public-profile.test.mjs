import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");

function listPublicTools() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_public" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`chatgpt_public MCP exited ${code}: ${stderr}`));
        return;
      }
      const messages = stdout.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
      resolve(messages.find((message) => message.id === "list")?.result?.tools ?? []);
    });
    child.stdin.end(`${JSON.stringify({
      jsonrpc: "2.0",
      id: "list",
      method: "tools/list",
      params: {},
    })}\n`);
  });
}

const tools = await listPublicTools();
assert.equal(tools.length, 29, "chatgpt_public should expose 29 tools after Phase53A");
const map = new Map(tools.map((tool) => [tool.name, tool]));

const expected = [
  "build_pending_engine_candidate_review",
  "get_pending_engine_candidate_review",
  "list_pending_engine_candidate_reviews",
  "request_pending_engine_candidate_activation",
];
for (const name of expected) assert(map.has(name), `chatgpt_public missing ${name}`);

const build = map.get("build_pending_engine_candidate_review");
assert.deepEqual(build.inputSchema.required, ["pendingEngineCandidateId"]);
assert.match(build.description, /without requesting or performing activation/i);
assert.equal(build._meta?.["armed-academy/permission"]?.can_modify_active_engine, false);
assert.equal(build._meta?.["armed-academy/permission"]?.can_modify_canon, false);

for (const name of [
  "get_pending_engine_candidate_review",
  "list_pending_engine_candidate_reviews",
]) {
  assert.equal(map.get(name).annotations?.readOnlyHint, true, `${name} must remain read-only`);
}

const request = map.get("request_pending_engine_candidate_activation");
assert.match(request.description, /approval-queue activation request/i);
assert.match(request.description, /without approving or activating/i);
assert.deepEqual(request.inputSchema.required, ["pendingEngineCandidateId"]);
assert.equal(request._meta?.["armed-academy/permission"]?.can_modify_active_engine, false);
assert.equal(request._meta?.["armed-academy/permission"]?.can_modify_canon, false);

console.log("Phase53A pending engine review public profile exposure test passed.");
