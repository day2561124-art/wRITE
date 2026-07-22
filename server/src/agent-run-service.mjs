import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import { assertPathInside, projectPaths, projectRoot } from "./project-paths.mjs";

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
export const externalBrainSessionLifecycleStatuses = new Set([
  "ACTIVE",
  "COMPLETED",
  "ABANDONED",
  "FAILED",
  "BLOCKED",
]);

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

function agentRunRoots(options = {}) {
  if (!options.fixtureRoot) {
    return {
      agentRuns: projectPaths.agentRuns,
      neuralTraces: projectPaths.neuralTraces,
      neuralOutputs: projectPaths.neuralModuleOutputs,
    };
  }
  const fixtureRoot = assertPathInside(
    options.fixtureRoot,
    path.join(projectRoot, "tests", ".tmp"),
    "agent run fixture root",
  );
  return {
    agentRuns: path.join(fixtureRoot, "data", "agent_runs"),
    neuralTraces: path.join(fixtureRoot, "data", "agent_runs", "neural_traces"),
    neuralOutputs: path.join(fixtureRoot, "data", "agent_runs", "neural_outputs"),
  };
}

function fixtureTransactionMetadata(options = {}) {
  return options.fixtureRoot
    ? { test_transaction_dir: path.join(options.fixtureRoot, "data", "outputs", "logs", "transactions") }
    : {};
}

export function agentRunPaths(runId, options = {}) {
  assertAgentRunId(runId);
  const directory = path.join(agentRunRoots(options).agentRuns, runId);
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

async function writeRunFiles(runId, files, metadata = {}, options = {}) {
  const paths = agentRunPaths(runId, options);
  const operations = Object.entries(files).map(([key, value]) => ({
    type: "write",
    filePath: paths[key],
    content: `${JSON.stringify(value, null, 2)}\n`,
  }));
  return commitFileTransaction("agent-run-update", operations, {
    run_id: runId,
    ...metadata,
    ...fixtureTransactionMetadata(options),
  });
}

export function assertAgentRunId(runId) {
  if (typeof runId !== "string" || !agentRunIdPattern.test(runId)) {
    throw new Error("run_id is invalid.");
  }
  return runId;
}

export async function ensureAgentRunDirectories(options = {}) {
  const roots = agentRunRoots(options);
  await Promise.all([
    mkdir(roots.agentRuns, { recursive: true }),
    mkdir(roots.neuralTraces, { recursive: true }),
    mkdir(roots.neuralOutputs, { recursive: true }),
  ]);
}

export async function createAgentRun(input = {}, options = {}) {
  requireObject(input, "agent run input");
  await ensureAgentRunDirectories(options);
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
      session_lifecycle_status: "ACTIVE",
      lifecycle_generation: 1,
      last_activity_at: createdAt,
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
  }, { action: "create" }, options);
  return run;
}

export async function getAgentRun(runId, options = {}) {
  const paths = agentRunPaths(runId, options);
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

export async function listAgentRuns(options = {}) {
  await ensureAgentRunDirectories(options);
  const names = await readdir(agentRunRoots(options).agentRuns, { withFileTypes: true });
  const runs = [];
  for (const entry of names) {
    if (!entry.isDirectory() || !agentRunIdPattern.test(entry.name)) continue;
    try {
      runs.push(await getAgentRun(entry.name, options));
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  return runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function updateAgentRunStatus(runId, status, updates = {}, options = {}) {
  if (!runStatuses.has(status)) {
    throw new Error(`status must be one of: ${[...runStatuses].join(", ")}.`);
  }
  requireObject(updates, "agent run updates");
  const run = await getAgentRun(runId, options);
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
  }, { action: "status", status }, options);
  return next;
}

export async function attachNeuralModulesUsed(runId, usage, options = {}) {
  requireObject(usage, "neural module usage");
  const paths = agentRunPaths(runId, options);
  const run = await getAgentRun(runId, options);
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
  const activityAt = usage.called_at ?? new Date().toISOString();
  const files = { modules: payload };
  if (run.mode === "chatgpt_owned_external_brain") {
    files.run = {
      ...run,
      session_lifecycle_status: run.session_lifecycle_status ?? "ACTIVE",
      last_activity_at: activityAt,
      last_activity_source: `neural_trace:${nextEntry.trace_id}`,
      updated_at: new Date().toISOString(),
    };
  }
  await writeRunFiles(runId, files, { action: "attach-neural-module" }, options);
  return payload;
}

export async function verifyRequiredNeuralModules(runId, options = {}) {
  const run = await getAgentRun(runId, options);
  const paths = agentRunPaths(runId, options);
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
  }, { action: "verify-neural-modules", missing_count: missing.length }, options);
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
  const verification = await verifyRequiredNeuralModules(runId, options);
  const run = verification.run;
  const outputHash = options.output_hash
    ? requireString(options.output_hash, "output_hash", 64)
    : hashAgentRunValue(options.output === undefined ? "" : options.output);
  const status = verification.ok ? "success" : "warning";
  return updateAgentRunStatus(runId, status, {
    warning: !verification.ok,
    output_hash: outputHash,
  }, options);
}

function validIsoTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return new Date(value).toISOString();
}

export async function recordExternalBrainSessionActivity(runId, input = {}, options = {}) {
  requireObject(input, "external brain session activity");
  const run = await getAgentRun(runId, options);
  if (run.mode !== "chatgpt_owned_external_brain" || run.external_brain_session_id !== run.run_id) {
    throw new Error("run_id is not a ChatGPT-owned external brain session.");
  }
  const activityAt = input.activity_at
    ? validIsoTimestamp(input.activity_at, "activity_at")
    : new Date().toISOString();
  const currentActivity = Date.parse(run.last_activity_at ?? run.created_at ?? "");
  const nextActivity = Date.parse(activityAt) >= currentActivity
    ? activityAt
    : run.last_activity_at;
  const next = {
    ...run,
    session_lifecycle_status: run.session_lifecycle_status ?? "ACTIVE",
    last_activity_at: nextActivity,
    last_activity_source: requireString(input.activity_source ?? "external_brain_capability", "activity_source", 200),
    updated_at: new Date().toISOString(),
  };
  await writeRunFiles(runId, { run: next }, {
    action: "external-brain-session-activity",
    activity_source: next.last_activity_source,
  }, options);
  return next;
}

export async function transitionExternalBrainSessionLifecycle(runId, lifecycleStatus, input = {}, options = {}) {
  const normalized = requireString(lifecycleStatus, "session_lifecycle_status", 20).toUpperCase();
  if (!externalBrainSessionLifecycleStatuses.has(normalized)) {
    throw new Error(`session_lifecycle_status must be one of: ${[...externalBrainSessionLifecycleStatuses].join(", ")}.`);
  }
  requireObject(input, "external brain lifecycle transition");
  const run = await getAgentRun(runId, options);
  if (run.mode !== "chatgpt_owned_external_brain" || run.external_brain_session_id !== run.run_id) {
    throw new Error("run_id is not a ChatGPT-owned external brain session.");
  }
  const transitionedAt = input.transitioned_at
    ? validIsoTimestamp(input.transitioned_at, "transitioned_at")
    : new Date().toISOString();
  const currentLifecycle = String(run.session_lifecycle_status ?? "ACTIVE").toUpperCase();
  const currentGeneration = Number.isSafeInteger(run.lifecycle_generation)
    && run.lifecycle_generation > 0
    ? run.lifecycle_generation
    : 1;
  const lifecycleGeneration = normalized === "ACTIVE" && currentLifecycle !== "ACTIVE"
    ? currentGeneration + 1
    : currentGeneration;
  const next = {
    ...run,
    session_lifecycle_status: normalized,
    lifecycle_generation: lifecycleGeneration,
    last_activity_at: transitionedAt,
    last_activity_source: requireString(input.activity_source ?? `lifecycle:${normalized.toLowerCase()}`, "activity_source", 200),
    updated_at: new Date().toISOString(),
    ...(normalized === "COMPLETED" ? { session_completed_at: transitionedAt } : {}),
    ...(normalized === "ABANDONED" ? {
      retired_at: transitionedAt,
      retired_by: requireString(input.retired_by, "retired_by", 200),
      retirement_reason: requireString(input.retirement_reason, "retirement_reason", 2_000),
    } : {}),
  };
  await writeRunFiles(runId, { run: next }, {
    action: "external-brain-session-lifecycle",
    session_lifecycle_status: normalized,
  }, options);
  return next;
}
