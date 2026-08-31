import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const testScripts = [
  "server/src/mcp-smoke-test.mjs",
  "tests/mcp/mcp-tool-profiles.test.mjs",
  "tests/mcp/mcp-development-write-tools.test.mjs",
  "tests/mcp/mcp-development-test-tools.test.mjs",
];

function runTestScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`${scriptPath} timed out after 300 seconds.`));
    }, 300_000);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${scriptPath} failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${scriptPath} exited with code ${code ?? 1}.`));
        return;
      }
      resolve();
    });
  });
}

try {
  for (const scriptPath of testScripts) {
    await runTestScript(scriptPath);
  }
  console.log("MCP contract tests passed.");
} catch (error) {
  console.error(`MCP contract test failed: ${error.message}`);
  process.exitCode = 1;
}
