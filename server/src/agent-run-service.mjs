import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import { projectPaths } from "./project-paths.mjs";

export const agentRunIdPattern = /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const gptWritingContextBundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const agentTaskTypes = new Set([
  "draft_generation",
  "proofing",
  "chapter_settlement",
  "settlement_import",
  "test",
]);
export const neuralModuleNames = new Set([
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
  "final_polisher",
]);
const runStatuses = new Set(["running", "success", "warning", "failed"]);

function isoStamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function canonicalJson(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cannot hash a non-finite number.");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") throw new TypeError("Cannot hash a BigInt value.");
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Cannot hash a ${typeof value} value.`);
  }
  if (ancestors.has(value)) throw new TypeError("Cannot hash a circular value.");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Cannot hash a non-plain object.");
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], ancestors)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function stableSerializeHashValue(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return value;
  return canonicalJson(value);
}

export function hashAgentRunValue(value) {
  return createHash("sha256").update(stableSerializeHashValue(value)).digest("hex");
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label, maxLength = 100_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return value.trim();
}

function uniqueModules(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("required_neural_modules must be an array.");
  const modules = value.map((item) => requireString(item, "required neural module", 100));
  const unknown = modules.filter((item) => !neuralModuleNames.has(item));
  if (unknown.length) throw new Error(`Unknown neural module: ${unknown.join(", ")}.`);
  return [...new Set(modules)];
}

function runPaths(runId) {
  assertAgentRunId(runId);
  const directory = path.join(projectPaths.agentRuns, runId);
  return {
    directory,
    run: path.join(directory, "run.json"),
    modules: path.join(directory, "neural_modules_used.json"),
    warnings: path.join(directory, "warnings.json"),
    blockedReason: path.join(directory, "blocked_reason.json"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeRunFiles(runId, files, metadata = {}) {
  const paths = runPaths(runId);
  const operations = Object.entries(files).map(([key, value]) => ({
    type: "write",
    filePath: paths[key],
    content: `${JSON.stringify(value, null, 2)}\n`,
  }));
  return commitFileTransaction("agent-run-update", operations, {
    run_id: runId,
    ...metadata,
  });
}

export function assertAgentRunId(runId) {
  if (typeof runId !== "string" || !agentRunIdPattern.test(runId)) {
    throw new Error("run_id is invalid.");
  }
  return runId;
}

export async function ensureAgentRunDirectories() {
  await Promise.all([
    mkdir(projectPaths.agentRuns, { recursive: true }),
    mkdir(projectPaths.neuralTraces, { recursive: true }),
    mkdir(projectPaths.neuralModuleOutputs, { recursive: true }),
  ]);
}

export async function createAgentRun(input = {}) {
  requireObject(input, "agent run input");
  await ensureAgentRunDirectories();
  const taskType = input.task_type ?? "test";
  if (!agentTaskTypes.has(taskType)) {
    throw new Error(`task_type must be one of: ${[...agentTaskTypes].join(", ")}.`);
  }
  const requiresNeuralModules = input.requires_neural_modules === true;
  const requiredNeuralModules = uniqueModules(input.required_neural_modules);
  const runId = `agent_run_${isoStamp()}-${randomBytes(4).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const mode = input.mode ? requireString(input.mode, "mode", 50) : "local";
  const writingContextBundleId = input.writing_context_bundle_id === undefined
    ? null
    : requireString(input.writing_context_bundle_id, "writing_context_bundle_id", 100);
  if (writingContextBundleId && !gptWritingContextBundleIdPattern.test(writingContextBundleId)) {
    throw new Error("writing_context_bundle_id is invalid.");
  }
  const run = {
    run_id: runId,
    task_type: taskType,
    created_at: createdAt,
    created_by: input.created_by ? requireString(input.created_by, "created_by", 100) : "local_ui",
    mode,
    ...(mode === "chatgpt_owned_external_brain" ? {
      external_brain_session_id: runId,
    } : {}),
    ...(writingContextBundleId ? {
      writing_context_bundle_id: writingContextBundleId,
    } : {}),
    requires_neural_modules: requiresNeuralModules,
    required_neural_modules: requiredNeuralModules,
    status: "running",
    input_hash: input.input_hash
      ? requireString(input.input_hash, "input_hash", 64)
      : hashAgentRunValue(input.input === undefined ? "" : input.input),
    output_hash: null,
    warning: false,
    blocked: false,
    blocked_reason: null,
  };
  await writeRunFiles(runId, {
    run,
    modules: { neural_modules_used: [] },
    warnings: { warnings: [] },
    blockedReason: { blocked: false, blocked_reason: null },
  }, { action: "create" });
  return run;
}

export async function getAgentRun(runId) {
  const paths = runPaths(runId);
  try {
    return await readJson(paths.run);
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error(`Agent run not found: ${runId}`);
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

export async function listAgentRuns() {
  await ensureAgentRunDirectories();
  const names = await readdir(projectPaths.agentRuns, { withFileTypes: true });
  const runs = [];
  for (const entry of names) {
    if (!entry.isDirectory() || !agentRunIdPattern.test(entry.name)) continue;
    try {
      runs.push(await getAgentRun(entry.name));
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  return runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function updateAgentRunStatus(runId, status, updates = {}) {
  if (!runStatuses.has(status)) {
    throw new Error(`status must be one of: ${[...runStatuses].join(", ")}.`);
  }
  requireObject(updates, "agent run updates");
  const run = await getAgentRun(runId);
  const next = {
    ...run,
    status,
    warning: updates.warning ?? status === "warning",
    blocked: updates.blocked ?? run.blocked,
    blocked_reason: updates.blocked_reason ?? run.blocked_reason,
    output_hash: updates.output_hash ?? run.output_hash,
    updated_at: new Date().toISOString(),
  };
  await writeRunFiles(runId, {
    run: next,
    blockedReason: {
      blocked: next.blocked,
      blocked_reason: next.blocked_reason,
    },
  }, { action: "status", status });
  return next;
}

export async function attachNeuralModulesUsed(runId, usage) {
  requireObject(usage, "neural module usage");
  const paths = runPaths(runId);
  await getAgentRun(runId);
  const current = await readJson(paths.modules);
  const entries = Array.isArray(current.neural_modules_used) ? current.neural_modules_used : [];
  const { normalizeNeuralModuleKey } = await import("./neural-module-utils.mjs");
  const nextEntry = {
    module_name: normalizeNeuralModuleKey(requireString(usage.module_name, "module_name", 100)),
    model_name: requireString(usage.model_name, "model_name", 200),
    model_version: requireString(usage.model_version, "model_version", 100),
    status: requireString(usage.status, "status", 20),
    trace_id: requireString(usage.trace_id, "trace_id", 100),
    latency_ms: Number.isFinite(usage.latency_ms) ? Math.max(0, Math.round(usage.latency_ms)) : 0,
  };
  const filtered = entries.filter((entry) => entry.trace_id !== nextEntry.trace_id);
  const payload = { neural_modules_used: [...filtered, nextEntry] };
  await writeRunFiles(runId, { modules: payload }, { action: "attach-neural-module" });
  return payload;
}

export async function verifyRequiredNeuralModules(runId) {
  const run = await getAgentRun(runId);
  const paths = runPaths(runId);
  const usage = await readJson(paths.modules);
  const entries = Array.isArray(usage.neural_modules_used) ? usage.neural_modules_used : [];
  const { normalizeNeuralModuleKey } = await import("./neural-module-utils.mjs");
  const successful = new Set(
    entries.filter((entry) => entry.status === "success").map((entry) => normalizeNeuralModuleKey(entry.module_name)),
  );
  const missing = run.requires_neural_modules
    ? run.required_neural_modules.filter((moduleName) => !successful.has(moduleName))
    : [];
  const warnings = missing.map((moduleName) => ({
    code: "required_neural_module_missing",
    module_name: moduleName,
    message: `Required neural module has no success trace: ${moduleName}`,
  }));
  const nextRun = {
    ...run,
    status: missing.length ? "warning" : (run.status === "warning" ? "running" : run.status),
    warning: missing.length > 0,
    updated_at: new Date().toISOString(),
  };
  await writeRunFiles(runId, {
    run: nextRun,
    warnings: { warnings },
  }, { action: "verify-neural-modules", missing_count: missing.length });
  return {
    ok: missing.length === 0,
    required: run.required_neural_modules,
    successful: [...successful],
    missing,
    warnings,
    run: nextRun,
  };
}

export async function finalizeAgentRun(runId, options = {}) {
  requireObject(options, "finalize options");
  const verification = await verifyRequiredNeuralModules(runId);
  const run = verification.run;
  const outputHash = options.output_hash
    ? requireString(options.output_hash, "output_hash", 64)
    : hashAgentRunValue(options.output === undefined ? "" : options.output);
  const status = verification.ok ? "success" : "warning";
  return updateAgentRunStatus(runId, status, {
    warning: !verification.ok,
    output_hash: outputHash,
  });
}
