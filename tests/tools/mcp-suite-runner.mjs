import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";
import {
  mcpSuiteScripts,
  mcpScriptTimeoutOverrides,
} from "./mcp-suite-groups.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultTimeoutMs = 300_000;

function runTestScript(scriptPath) {
  const timeoutMs = mcpScriptTimeoutOverrides.get(scriptPath) ?? defaultTimeoutMs;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL: "1",
        WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT: "1",
        WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION: "1",
      },
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`${scriptPath} timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
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

export async function runMcpScriptGroup(suite) {
  if (!Object.hasOwn(mcpSuiteScripts, suite)) {
    throw new Error("Unknown fixed MCP script group.");
  }
  // The preflight is additive; all original MCP tests retain their original membership.
  await runTestScript("tests/tools/mcp-suite-groups.test.mjs");
  for (const scriptPath of mcpSuiteScripts[suite]) {
    await runTestScript(scriptPath);
  }
  console.log(`MCP ${suite} tests passed.`);
}
