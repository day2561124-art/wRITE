import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const steps = [
  ["JSON/codeblock validation", ["server/src/tools/validate-json-codeblocks.mjs"]],
  ["Strict JSONL validation", ["server/src/tools/validate-jsonl.mjs", "--all", "--strict"]],
  ["Source trust validation", ["server/src/tools/source-trust-checker.mjs"]],
  ["Canon golden tests", ["tests/golden/canon-golden.test.mjs"]],
  ["UI server contract tests", ["tests/ui/ui-server.test.mjs"]],
  ["MCP contract tests", ["tests/tools/mcp-contract.test.mjs"]],
];

function runStep(label, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`${label} timed out after 240 seconds.`));
    }, 240_000);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

async function main() {
  for (const [label, args] of steps) {
    await runStep(label, args);
  }
  console.log("\nAll tests passed.");
}

main().catch((error) => {
  console.error(`\nTest suite failed: ${error.message}`);
  process.exitCode = 1;
});
