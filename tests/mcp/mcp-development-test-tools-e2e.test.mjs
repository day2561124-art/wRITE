import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");
const suite = process.argv[2];

assert(
  ["mcp", "mcp_tunnel"].includes(suite),
  "Usage: node tests/mcp/mcp-development-test-tools-e2e.test.mjs <mcp|mcp_tunnel>",
);

async function callTool() {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_developer" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`dev_run_tests ${suite} E2E timed out. stderr=${stderr}`));
    }, 360_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }
      try {
        const responses = stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(responses.find((response) => response.id === "dev-run-tests-e2e"));
      } catch (error) {
        reject(new Error(`Could not parse MCP output: ${error.message}\n${stdout}`));
      }
    });
    child.stdin.end(`${JSON.stringify({
      jsonrpc: "2.0",
      id: "dev-run-tests-e2e",
      method: "tools/call",
      params: {
        name: "dev_run_tests",
        arguments: { suite },
        _meta: { actor: `dev-test-e2e-${suite}` },
      },
    })}\n`);
  });
}

let auditBefore = null;
let auditExisted = false;
try {
  try {
    auditBefore = await readFile(auditLogPath);
    auditExisted = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(auditLogPath), { recursive: true });

  const response = await callTool();
  assert.equal(response.error, undefined);
  assert.equal(response.result?.isError, undefined);
  const result = JSON.parse(response.result.content[0].text);
  assert.equal(result.suite, suite);
  assert.equal(result.execution_ok, true);
  assert.equal(result.passed, true);
  assert.equal(result.exit_code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timed_out, false);
  assert(Number.isInteger(result.duration_ms) && result.duration_ms > 0);
  assert.equal(typeof result.stdout, "string");
  assert.equal(typeof result.stderr, "string");
  assert.equal(typeof result.stdout_truncated, "boolean");
  assert.equal(typeof result.stderr_truncated, "boolean");
  assert.match(result.stdout, suite === "mcp" ? /MCP contract tests passed/u : /MCP tunnel launcher integration tests passed/u);

  const records = (await readFile(auditLogPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const record = records.find((item) => item.actor === `dev-test-e2e-${suite}`);
  assert(record, "dev_run_tests E2E audit record was not written");
  assert.equal(record.tool_name, "dev_run_tests");
  assert.equal(record.risk, "low-risk-write");
  assert.equal(record.status, "completed");
  assert.deepEqual(record.affected_paths, []);
  assert.equal(record.result?.suite, suite);
  assert.equal(record.result?.execution_ok, true);
  assert.equal(record.result?.passed, true);
  assert.equal(record.result?.exit_code, 0);
  assert.equal(record.result?.timed_out, false);
  assert.equal(Object.hasOwn(record.result ?? {}, "stdout"), false);
  assert.equal(Object.hasOwn(record.result ?? {}, "stderr"), false);
  assert.equal(Object.hasOwn(record.result ?? {}, "text_preview"), false);

  console.log(`dev_run_tests ${suite} MCP E2E passed.`);
  console.log(`- duration_ms=${result.duration_ms}`);
  console.log(`- stdout_truncated=${result.stdout_truncated}`);
  console.log(`- stderr_truncated=${result.stderr_truncated}`);
  console.log("- audit contains bounded metadata only: yes");
} finally {
  if (auditExisted) await writeFile(auditLogPath, auditBefore);
  else await rm(auditLogPath, { force: true });
}
