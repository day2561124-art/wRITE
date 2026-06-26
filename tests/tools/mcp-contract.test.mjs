import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const child = spawn(process.execPath, ["server/src/mcp-smoke-test.mjs"], {
  cwd: rootDir,
  stdio: "inherit",
  windowsHide: true,
});

let settled = false;
const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  terminateProcessTree(child);
  console.error("MCP contract test timed out after 300 seconds.");
  process.exitCode = 1;
}, 300_000);

child.on("error", (error) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.error(`MCP contract test failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.on("close", (code) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  console.log("MCP contract tests passed.");
});
