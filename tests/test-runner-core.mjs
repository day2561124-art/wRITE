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

export function formatTestDuration(durationMs) {
  const milliseconds = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  const totalSeconds = milliseconds / 1_000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - (minutes * 60);
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

export function printTestTimingSummary(timings, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0
    ? options.limit
    : 10;
  const normalized = Array.isArray(timings)
    ? timings.filter((item) => item && Number.isFinite(item.duration_ms))
    : [];
  if (normalized.length === 0) return;

  console.log(`\nSlowest test steps (top ${Math.min(limit, normalized.length)}):`);
  for (const item of [...normalized]
    .sort((left, right) => right.duration_ms - left.duration_ms)
    .slice(0, limit)) {
    console.log(`- ${item.label}: ${formatTestDuration(item.duration_ms)}`);
  }
}

function runStep(label, args) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
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
        const durationMs = Math.max(0, Date.now() - startedAt);
        console.log(`-- ${label} passed in ${formatTestDuration(durationMs)}.`);
        resolve({ label, duration_ms: durationMs });
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

  const suiteStartedAt = Date.now();
  const timings = [];
  for (const [label, args] of steps) {
    timings.push(await runStep(label, args));
  }

  const suiteDurationMs = Math.max(0, Date.now() - suiteStartedAt);
  printTestTimingSummary(timings);
  console.log(`\n${suiteLabel} completed in ${formatTestDuration(suiteDurationMs)}.`);
  console.log(`\n${suiteLabel} passed.`);
  return { duration_ms: suiteDurationMs, timings };
}