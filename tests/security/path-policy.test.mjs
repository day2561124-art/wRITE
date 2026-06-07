import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveGeneratedMarkdownPath,
  resolveProjectPath,
} from "../../server/src/project-paths.mjs";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const auditPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");
const intentDir = path.join(rootDir, "data", "outputs", "logs", "mcp_audit_intents");
const transactionDir = path.join(rootDir, "data", "outputs", "logs", "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function optionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function optionalNames(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewFiles(dirPath, before) {
  for (const name of await optionalNames(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

function callMcpPathViolation() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      terminateProcessTree(child);
      reject(new Error(`MCP path policy fixture timed out: ${stderr}`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline === -1) return;
      clearTimeout(timer);
      const response = JSON.parse(stdout.slice(0, newline));
      child.stdin.end();
      resolve(response);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "build_task_prompt",
        arguments: {
          task: "Path policy fixture.",
          output: "data/canon_db/active_engine.md",
        },
        _meta: { actor: "path-policy-test" },
      },
    })}\n`);
  });
}

async function main() {
  assert(
    (() => {
      try {
        resolveProjectPath("../outside.md", "fixture");
        return false;
      } catch {
        return true;
      }
    })(),
    "Project traversal was not rejected.",
  );
  assert(
    (() => {
      try {
        resolveGeneratedMarkdownPath("data/canon_db/active_engine.md", "fixture");
        return false;
      } catch {
        return true;
      }
    })(),
    "Generated output policy allowed a Canon target.",
  );

  const activeBefore = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
  const auditBefore = await optionalBuffer(auditPath);
  const intentsBefore = await optionalNames(intentDir);
  const transactionsBefore = await optionalNames(transactionDir);
  try {
    const response = await callMcpPathViolation();
    const text = response.result?.content?.[0]?.text ?? "";
    assert(response.result?.isError === true, "MCP path violation did not return a tool error.");
    assert(
      text.includes("output must stay under data/outputs"),
      `Unexpected MCP path policy message: ${text}`,
    );
    const activeAfter = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
    assert(activeAfter === activeBefore, "MCP path violation changed active_engine.md.");
  } finally {
    if (auditBefore.exists) await writeFile(auditPath, auditBefore.content);
    else await rm(auditPath, { force: true });
    await removeNewFiles(intentDir, intentsBefore);
    await removeNewFiles(transactionDir, transactionsBefore);
  }
  console.log("Path policy security test passed.");
}

main().catch((error) => {
  console.error(`Path policy security test failed: ${error.message}`);
  process.exitCode = 1;
});
