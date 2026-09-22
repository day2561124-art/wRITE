import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const DEFAULT_TIMEOUT_MS = 360_000;
export const MAX_PARALLEL_TEST_CONCURRENCY = 4;

export function resolveMaxConcurrency(options = {}) {
  const requested = Number.isInteger(options.maxConcurrency)
    ? options.maxConcurrency
    : 1;
  return Math.min(MAX_PARALLEL_TEST_CONCURRENCY, Math.max(1, requested));
}

function singleTestPath(args) {
  if (!Array.isArray(args) || args.length !== 1 || typeof args[0] !== "string") {
    return null;
  }
  const normalized = args[0].replaceAll("\\", "/").replace(/^\.\//u, "");
  if (!normalized.startsWith("tests/") || !normalized.endsWith(".test.mjs")) {
    return null;
  }
  return normalized;
}

export function partitionTestStepsByParallelSafety(steps, options = {}) {
  const reviewed = new Set(options.parallelSafeTestPaths ?? []);
  const parallel = [];
  const serial = [];
  for (const step of steps ?? []) {
    const [, args] = Array.isArray(step) ? step : [step?.label, step?.args];
    const testPath = singleTestPath(args);
    (testPath && reviewed.has(testPath) ? parallel : serial).push(step);
  }
  return Object.freeze({
    parallel: Object.freeze(parallel),
    serial: Object.freeze(serial),
  });
}

export function resolveTimeoutMs(options = {}) {
  const {
    timeoutMs,
    suiteTimeoutMs,
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  if (Number.isFinite(suiteTimeoutMs) && suiteTimeoutMs > 0) {
    return suiteTimeoutMs;
  }

  if (Number.isFinite(defaultTimeoutMs) && defaultTimeoutMs > 0) {
    return defaultTimeoutMs;
  }

  return DEFAULT_TIMEOUT_MS;
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

function runStep(label, args, stepOptions = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`\n== ${label} ==`);

    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
    });

    let settled = false;
    const timeoutMs = resolveTimeoutMs(stepOptions);
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

  const suiteTimeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : undefined;

  const suiteStartedAt = Date.now();
  const timings = [];
  for (const step of steps) {
    const [label, args, stepOptions = {}] = Array.isArray(step)
      ? step
      : [step.label, step.args, step];
    const timeoutMs = resolveTimeoutMs({
      timeoutMs: stepOptions.timeoutMs,
      suiteTimeoutMs,
    });
    timings.push(await runStep(label, args, { timeoutMs }));
  }

  const suiteDurationMs = Math.max(0, Date.now() - suiteStartedAt);
  printTestTimingSummary(timings);
  console.log(`\n${suiteLabel} completed in ${formatTestDuration(suiteDurationMs)}.`);
  console.log(`\n${suiteLabel} passed.`);
  return { duration_ms: suiteDurationMs, timings };
}

export async function runParallelTestSteps(steps, options = {}) {
  const suiteLabel =
    typeof options.suiteLabel === "string" && options.suiteLabel.trim()
      ? options.suiteLabel.trim()
      : "Parallel test shard";
  const reviewed = new Set(options.parallelSafeTestPaths ?? []);
  const normalized = [];

  for (const step of steps ?? []) {
    const [label, args, stepOptions = {}] = Array.isArray(step)
      ? step
      : [step?.label, step?.args, step ?? {}];
    const testPath = singleTestPath(args);
    if (!testPath || !reviewed.has(testPath)) {
      throw new Error(
        `${label ?? "<unnamed>"} is not an explicitly reviewed parallel-safe test step.`,
      );
    }
    normalized.push({ label, args, stepOptions, testPath });
  }

  const maxConcurrency = resolveMaxConcurrency(options);
  const suiteTimeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : undefined;
  const suiteStartedAt = Date.now();
  const timings = [];

  // Deliberately run bounded batches. Promise.allSettled waits for every
  // already-started child in the batch before reporting failure, preventing
  // an early rejection from leaving sibling test processes behind.
  for (let offset = 0; offset < normalized.length; offset += maxConcurrency) {
    const batch = normalized.slice(offset, offset + maxConcurrency);
    const settled = await Promise.allSettled(batch.map(({ label, args, stepOptions }) => {
      const timeoutMs = resolveTimeoutMs({
        timeoutMs: stepOptions.timeoutMs,
        suiteTimeoutMs,
      });
      return runStep(label, args, { timeoutMs });
    }));
    for (const result of settled) {
      if (result.status === "fulfilled") timings.push(result.value);
    }
    const failure = settled.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  const suiteDurationMs = Math.max(0, Date.now() - suiteStartedAt);
  printTestTimingSummary(timings);
  console.log(
    `\n${suiteLabel} completed in ${formatTestDuration(suiteDurationMs)} with max concurrency ${maxConcurrency}.`,
  );
  console.log(`\n${suiteLabel} passed.`);
  return {
    duration_ms: suiteDurationMs,
    timings,
    max_concurrency: maxConcurrency,
    parallel_safe_test_paths: normalized.map(({ testPath }) => testPath),
  };
}