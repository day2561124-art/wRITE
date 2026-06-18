import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  assertAgentRunId,
  attachNeuralModulesUsed,
  ensureAgentRunDirectories,
  getAgentRun,
  verifyRequiredNeuralModules as verifyAgentRunModules,
} from "./agent-run-service.mjs";
import { normalizeNeuralModuleKey } from "./neural-module-utils.mjs";
import { atomicWriteFile } from "./file-transactions.mjs";
import { projectPaths } from "./project-paths.mjs";

export const neuralTraceIdPattern = /^neural_trace_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const traceStatuses = new Set(["success", "failed", "skipped"]);
const wrapperProof = Symbol("neural-wrapper-execution");

function isoStamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function requireString(value, label, maxLength = 100_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return value.trim();
}

function tracePath(traceId) {
  assertNeuralTraceId(traceId);
  return path.join(projectPaths.neuralTraces, `${traceId}.json`);
}

function normalizeTrace(input, allowSuccess) {
  const status = input.status ?? "skipped";
  if (!traceStatuses.has(status)) {
    throw new Error(`status must be one of: ${[...traceStatuses].join(", ")}.`);
  }
  if (status === "success" && !allowSuccess) {
    throw new Error("success traces may only be created by a neural module wrapper.");
  }
  if (status === "success" && (!input.input_hash || !input.output_hash)) {
    throw new Error("success traces require input_hash and output_hash.");
  }
  if (status === "failed" && !String(input.error_message ?? "").trim()) {
    throw new Error("failed traces require error_message.");
  }
  const traceId = input.trace_id ?? `neural_trace_${isoStamp()}-${randomBytes(4).toString("hex")}`;
  assertNeuralTraceId(traceId);
  assertAgentRunId(input.run_id);
  // Normalize module name: accept either "run_*" wrapper names or canonical module keys
  let moduleNameRaw = String(input.module_name ?? "").trim();
  if (!moduleNameRaw) throw new Error("module_name is required.");
  // If someone passed a wrapper-style name like "run_scene_planner", strip the prefix.
  if (moduleNameRaw.startsWith("run_")) moduleNameRaw = moduleNameRaw.slice(4);
  return {
    run_id: input.run_id,
    trace_id: traceId,
    task_type: requireString(input.task_type, "task_type", 100),
    module_name: requireString(moduleNameRaw, "module_name", 100),
    model_name: requireString(input.model_name, "model_name", 200),
    model_version: requireString(input.model_version, "model_version", 100),
    called_at: input.called_at ?? new Date().toISOString(),
    input_hash: input.input_hash ? requireString(input.input_hash, "input_hash", 64) : null,
    output_hash: input.output_hash ? requireString(input.output_hash, "output_hash", 64) : null,
    status,
    latency_ms: Number.isFinite(input.latency_ms) ? Math.max(0, Math.round(input.latency_ms)) : 0,
    warnings: Array.isArray(input.warnings) ? input.warnings.map(String) : [],
    error_message: input.error_message ? String(input.error_message) : null,
    input_summary: input.input_summary && typeof input.input_summary === "object"
      ? input.input_summary
      : {},
    output_summary: input.output_summary && typeof input.output_summary === "object"
      ? input.output_summary
      : {},
  };
}

async function persistTrace(input, proof) {
  await ensureAgentRunDirectories();
  const run = await getAgentRun(input.run_id);
  const trace = normalizeTrace(input, proof === wrapperProof);
  if (run.task_type !== trace.task_type) {
    throw new Error("trace task_type must match the agent run task_type.");
  }
  await atomicWriteFile(tracePath(trace.trace_id), `${JSON.stringify(trace, null, 2)}\n`, {
    name: "neural-trace",
    run_id: trace.run_id,
    trace_id: trace.trace_id,
  });
  await attachNeuralModulesUsed(trace.run_id, trace);
  return trace;
}

export function hashNeuralValue(value) {
  return createHash("sha256").update(
    Buffer.isBuffer(value) ? value : String(value ?? ""),
  ).digest("hex");
}

export function assertNeuralTraceId(traceId) {
  if (typeof traceId !== "string" || !neuralTraceIdPattern.test(traceId)) {
    throw new Error("trace_id is invalid.");
  }
  return traceId;
}

export async function createNeuralTrace(input = {}) {
  return persistTrace(input, null);
}

export async function appendNeuralTrace(input = {}) {
  return createNeuralTrace(input);
}

export async function recordNeuralWrapperTrace(input = {}) {
  return persistTrace(input, wrapperProof);
}

export async function getNeuralTrace(traceId) {
  try {
    return JSON.parse(await readFile(tracePath(traceId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error(`Neural trace not found: ${traceId}`);
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

export async function listNeuralTraces(options = {}) {
  await ensureAgentRunDirectories();
  const runId = options.run_id ? assertAgentRunId(options.run_id) : "";
  const names = await readdir(projectPaths.neuralTraces, { withFileTypes: true });
  const traces = [];
  for (const entry of names) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const traceId = entry.name.slice(0, -5);
    if (!neuralTraceIdPattern.test(traceId)) continue;
    const trace = await getNeuralTrace(traceId);
    if (!runId || trace.run_id === runId) traces.push(trace);
  }
  return traces.sort((a, b) => String(b.called_at).localeCompare(String(a.called_at)));
}

export async function summarizeNeuralUsageForRun(runId) {
  assertAgentRunId(runId);
  const run = await getAgentRun(runId);
  const traces = await listNeuralTraces({ run_id: runId });
  // Normalize module names from traces: accept either "run_*" or canonical keys.
  const successfulModules = [...new Set(
    traces.filter((trace) => trace.status === "success").map((trace) => normalizeNeuralModuleKey(trace.module_name)),
  )];
  const missingRequiredModules = run.requires_neural_modules
    ? run.required_neural_modules.filter((moduleName) => !successfulModules.includes(moduleName))
    : [];
  return {
    run_id: runId,
    traces,
    trace_count: traces.length,
    success_count: traces.filter((trace) => trace.status === "success").length,
    failed_count: traces.filter((trace) => trace.status === "failed").length,
    skipped_count: traces.filter((trace) => trace.status === "skipped").length,
    neural_modules_used: successfulModules,
    used_neural_network: successfulModules.length > 0,
    required_neural_modules: run.required_neural_modules,
    missing_required_neural_modules: missingRequiredModules,
    warning: missingRequiredModules.length > 0,
  };
}

export async function verifyRequiredNeuralModules(runId) {
  return verifyAgentRunModules(runId);
}
