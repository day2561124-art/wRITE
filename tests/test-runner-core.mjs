import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getTimeoutMs() {
  return 360_000;
}

function runStep(label, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);

    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
    });

    let settled = false;
    const timeoutMs = getTimeoutMs(label);
    const timeoutSeconds = Math.round(timeoutMs / 1000);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`${label} timed out after ${timeoutSeconds} seconds.`));
    }, timeoutMs);

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

export async function runTestSteps(steps, options = {}) {
  const suiteLabel =
    typeof options.suiteLabel === "string" && options.suiteLabel.trim()
      ? options.suiteLabel.trim()
      : "Test suite";

  for (const [label, args] of steps) {
    await runStep(label, args);
  }

  console.log(`\n${suiteLabel} passed.`);
}