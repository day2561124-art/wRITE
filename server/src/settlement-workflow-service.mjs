import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getAgentRun } from "./agent-run-service.mjs";
import { importSettlementResult } from "./engine-candidate-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import {
  assertAdoptedChapterId,
  getAdoptedChapter,
  getCandidateDraft,
  getProofReport,
  updateAdoptedChapterStatus,
} from "./writing-workflow-service.mjs";

export const settlementContextIdPattern =
  /^settlement_context_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const settlementReportIdPattern =
  /^settlement_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createId(prefix) {
  const compact = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const timestamp = `${compact.slice(0, 8)}-${compact.slice(8)}`;
  return `${prefix}_${timestamp}-${randomBytes(4).toString("hex")}`;
}

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireText(value, label, maxLength = 1_000_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw errorWithStatus(`${label} is required.`);
  }
  if (value.length > maxLength) {
    throw errorWithStatus(`${label} exceeds ${maxLength} characters.`);
  }
  return value;
}

function optionalText(value, maxLength = 10_000) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw errorWithStatus(`Text exceeds ${maxLength} characters.`);
  return text;
}

function rootsFor(options = {}) {
  const writingWorkflow = options.writingWorkflow
    ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow test root")
    : projectPaths.writingWorkflow;
  const settlementWorkflow = path.join(writingWorkflow, "settlements");
  return {
    writingWorkflow,
    settlementWorkflow,
    settlementContexts: path.join(settlementWorkflow, "contexts"),
    settlementReports: path.join(settlementWorkflow, "reports"),
    activeEngine: options.activeEnginePath
      ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
      : projectPaths.activeEngine,
  };
}

function contextPaths(settlementContextId, roots) {
  assertSettlementContextId(settlementContextId);
  const directory = path.join(roots.settlementContexts, settlementContextId);
  return {
    directory,
    context: path.join(directory, "settlement_context.md"),
    adoptedChapter: path.join(directory, "adopted_chapter.md"),
    manifest: path.join(directory, "source_manifest.json"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
  };
}

function reportPaths(settlementReportId, roots) {
  assertSettlementReportId(settlementReportId);
  const directory = path.join(roots.settlementReports, settlementReportId);
  return {
    directory,
    report: path.join(directory, "settlement_report.md"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
    neural: path.join(directory, "neural_modules_used.json"),
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sourceRecord(label, filePath, canonStatus) {
  try {
    const content = await readFile(filePath);
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: true,
      hash: sha256(content),
      canon_status: canonStatus,
      content: content.toString("utf8"),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: false,
      hash: "",
      canon_status: canonStatus,
      content: "",
    };
  }
}

async function neuralUsage(runId, neuralModulesUsedPath = "") {
  if (!runId) {
    return {
      run_id: "",
      requires_neural_modules: false,
      required_neural_modules: [],
      neural_modules_used: [],
      traces: [],
      used_neural_network: false,
      warning: false,
      message: "未使用 / 缺少 trace",
    };
  }
  const run = await getAgentRun(runId);
  const expected = path.join(projectPaths.agentRuns, runId, "neural_modules_used.json");
  if (neuralModulesUsedPath) {
    const resolved = assertPathInside(
      neuralModulesUsedPath,
      projectPaths.agentRuns,
      "neural_modules_used_path",
    );
    if (resolved !== expected) {
      throw errorWithStatus("neural_modules_used_path does not match run_id.");
    }
  }
  const usage = await summarizeNeuralUsageForRun(runId);
  return {
    run_id: runId,
    requires_neural_modules: run.requires_neural_modules,
    required_neural_modules: run.required_neural_modules,
    neural_modules_used: usage.neural_modules_used,
    traces: usage.traces,
    used_neural_network: usage.used_neural_network,
    warning: usage.warning,
    missing_required_neural_modules: usage.missing_required_neural_modules,
    message: usage.used_neural_network ? "已由 success trace 證實" : "未使用 / 缺少 trace",
  };
}

function sourceSummary(manifest) {
  return manifest.sources.map((source) => (
    `- ${source.label}: ${source.exists ? source.hash : "missing"} (${source.canon_status})`
  )).join("\n");
}

export function isSafeSettlementContextId(id) {
  return typeof id === "string" && settlementContextIdPattern.test(id);
}

export function isSafeSettlementReportId(id) {
  return typeof id === "string" && settlementReportIdPattern.test(id);
}

export function assertSettlementContextId(id) {
  if (!isSafeSettlementContextId(id)) {
    throw errorWithStatus("Invalid settlement_context_id.");
  }
  return id;
}

export function assertSettlementReportId(id) {
  if (!isSafeSettlementReportId(id)) {
    throw errorWithStatus("Invalid settlement_report_id.");
  }
  return id;
}

export async function ensureSettlementWorkflowDirectories(options = {}) {
  const roots = rootsFor(options);
  await Promise.all([
    mkdir(roots.settlementContexts, { recursive: true }),
    mkdir(roots.settlementReports, { recursive: true }),
  ]);
  return roots;
}

export async function buildSettlementContext(
  adoptedChapterId,
  { runId = "", note = "" } = {},
  options = {},
) {
  assertAdoptedChapterId(adoptedChapterId);
  const roots = await ensureSettlementWorkflowDirectories(options);
  const adopted = await getAdoptedChapter(adoptedChapterId, options);
  if (adopted.status.status !== "accepted_pending_settlement") {
    throw errorWithStatus(
      `Adopted chapter cannot create settlement context: ${adopted.status.status}`,
      409,
    );
  }
  const draft = await getCandidateDraft(adopted.metadata.draft_id, options);
  if (draft.status.status !== "accepted_pending_settlement") {
    throw errorWithStatus(
      `Source draft cannot create settlement context: ${draft.status.status}`,
      409,
    );
  }
  const proof = adopted.metadata.proof_report_id
    ? await getProofReport(adopted.metadata.proof_report_id, options)
    : null;
  const adoptedPath = path.join(
    roots.writingWorkflow,
    "adopted_chapters",
    adoptedChapterId,
    "chapter.md",
  );
  const sources = await Promise.all([
    sourceRecord("active_engine", roots.activeEngine, "active"),
    sourceRecord("adopted_chapter", adoptedPath, "adopted_pending_settlement"),
    sourceRecord(
      "generation_context",
      path.join(projectRoot, "data", "outputs", "generation_context.md"),
      "working_context",
    ),
    sourceRecord(
      "retrieval_context",
      path.join(projectRoot, "data", "outputs", "retrieval_context.md"),
      "working_context",
    ),
    sourceRecord(
      "active_proofing_card",
      path.join(projectRoot, "data", "proofing_policy_db", "active_proofing_card.md"),
      "policy",
    ),
  ]);
  const publicSources = sources.map(({ content, ...source }) => source);
  const missingSources = publicSources.filter((source) => !source.exists).map((source) => source.label);
  const warnings = missingSources
    .filter((label) => label !== "active_engine" && label !== "adopted_chapter")
    .map((label) => `${label} is missing.`);
  const manifest = {
    sources: publicSources,
    missing_sources: missingSources,
    warnings,
  };
  const active = sources.find((source) => source.label === "active_engine");
  const adoptedSource = sources.find((source) => source.label === "adopted_chapter");
  const blockedReason = !active.exists
    ? "active_engine.md 不存在"
    : !adoptedSource.exists
      ? "adopted_chapter.md 不存在"
      : null;
  const settlementContextId = createId("settlement_context");
  const paths = contextPaths(settlementContextId, roots);
  const metadata = {
    settlement_context_id: settlementContextId,
    adopted_chapter_id: adoptedChapterId,
    draft_id: adopted.metadata.draft_id,
    proof_report_id: adopted.metadata.proof_report_id || "",
    run_id: optionalText(runId, 100),
    created_at: new Date().toISOString(),
    created_by: "local_ui",
    active_engine_hash: active.hash,
    adopted_chapter_hash: adoptedSource.hash,
    canon_status: "settlement_context",
    note: optionalText(note, 5_000),
  };
  const status = {
    status: blockedReason ? "blocked" : "ready",
    blocked_reason: blockedReason,
    can_save_settlement_report: !blockedReason,
  };
  const proofSummary = proof
    ? JSON.stringify(proof.issue_summary, null, 2)
    : "無 proof_report。";
  const contextText = [
    "# 章節結算 Context",
    "",
    "## 任務模式",
    "",
    "正式章節結算候選。",
    "",
    "## 硬規則",
    "",
    "- 只同步 adopted_chapter 中已明確成立的內容。",
    "- 不續寫。",
    "- 不補戲。",
    "- 不推定未成立結果。",
    "- 不把未支付骨架寫成正史。",
    "- 不把候選、退稿、外部研究、錯誤報告或推論寫成正史。",
    "- 只產生 settlement_report 與 pending_engine_candidate。",
    "- 不得直接啟用 active_engine。",
    "",
    "## Active Engine",
    "",
    active.content || "[missing]",
    "",
    "## Adopted Chapter",
    "",
    adopted.chapter_text,
    "",
    "## Proof Report 摘要",
    "",
    proofSummary,
    "",
    "## Source Manifest",
    "",
    sourceSummary(manifest),
    "",
  ].join("\n");
  await commitFileTransaction("build-settlement-context", [
    { filePath: paths.context, content: contextText },
    { filePath: paths.adoptedChapter, content: adopted.chapter_text },
    { filePath: paths.manifest, content: json(manifest) },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.status, content: json(status) },
  ], {
    settlement_context_id: settlementContextId,
    adopted_chapter_id: adoptedChapterId,
    phase: "phase_4b_settlement_pending_only",
  });
  if (!blockedReason) {
    await updateAdoptedChapterStatus(adoptedChapterId, {
      status: "settlement_context_created",
      settlement_context_id: settlementContextId,
      settlement_context_created_at: new Date().toISOString(),
      can_create_settlement: false,
    }, options);
  }
  return getSettlementContext(settlementContextId, options);
}

export async function listSettlementContexts(options = {}) {
  const roots = await ensureSettlementWorkflowDirectories(options);
  const entries = await readdir(roots.settlementContexts, { withFileTypes: true });
  const contexts = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSettlementContextId(entry.name)) continue;
    try {
      const paths = contextPaths(entry.name, roots);
      const [metadata, status] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
      ]);
      contexts.push({ ...metadata, ...status });
    } catch {
      // Ignore incomplete records.
    }
  }
  return contexts.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getSettlementContext(settlementContextId, options = {}) {
  assertSettlementContextId(settlementContextId);
  const roots = rootsFor(options);
  const paths = contextPaths(settlementContextId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Settlement context not found.", 404);
  const [contextText, adoptedChapterText, manifest, metadata, status] = await Promise.all([
    readFile(paths.context, "utf8"),
    readFile(paths.adoptedChapter, "utf8"),
    readJson(paths.manifest),
    readJson(paths.metadata),
    readJson(paths.status),
  ]);
  return {
    settlement_context_text: contextText,
    adopted_chapter_text: adoptedChapterText,
    source_manifest: manifest,
    metadata,
    status,
  };
}

export async function saveSettlementReport(input = {}, options = {}) {
  const settlementContextId = assertSettlementContextId(
    input.settlementContextId ?? input.settlement_context_id,
  );
  const settlementText = requireText(
    input.settlementText ?? input.settlement_text,
    "settlementText",
  );
  const roots = await ensureSettlementWorkflowDirectories(options);
  const context = await getSettlementContext(settlementContextId, options);
  if (!context.status.can_save_settlement_report || context.status.status === "blocked") {
    throw errorWithStatus(
      `Settlement context cannot save report: ${context.status.blocked_reason || context.status.status}`,
      409,
    );
  }
  const runId = optionalText(input.runId ?? input.run_id, 100);
  const neuralModulesUsedPath = optionalText(
    input.neuralModulesUsedPath ?? input.neural_modules_used_path,
    500,
  );
  const usage = await neuralUsage(runId, neuralModulesUsedPath);
  const settlementReportId = createId("settlement_report");
  const paths = reportPaths(settlementReportId, roots);
  const metadata = {
    settlement_report_id: settlementReportId,
    settlement_context_id: settlementContextId,
    adopted_chapter_id: context.metadata.adopted_chapter_id,
    run_id: runId,
    source_chapter: optionalText(input.sourceChapter ?? input.source_chapter, 500),
    created_at: new Date().toISOString(),
    created_by: "local_ui_import",
    settlement_hash: sha256(settlementText),
    active_engine_hash_at_settlement: context.metadata.active_engine_hash,
    neural_modules_used_path: neuralModulesUsedPath
      ? normalizeProjectPath(assertPathInside(
        neuralModulesUsedPath,
        projectPaths.agentRuns,
        "neural_modules_used_path",
      ))
      : "",
    canon_status: "settlement_report",
    note: optionalText(input.note, 5_000),
  };
  const status = {
    status: "settlement_report_saved",
    pending_candidate_id: null,
    can_create_pending_candidate: true,
    blocked_reason: null,
  };
  await commitFileTransaction("save-settlement-report", [
    { filePath: paths.report, content: settlementText },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.status, content: json(status) },
    { filePath: paths.neural, content: json(usage) },
  ], {
    settlement_report_id: settlementReportId,
    settlement_context_id: settlementContextId,
    phase: "phase_4b_settlement_pending_only",
  });
  await updateAdoptedChapterStatus(context.metadata.adopted_chapter_id, {
    status: "settlement_report_saved",
    settlement_context_id: settlementContextId,
    settlement_report_id: settlementReportId,
    settlement_report_saved_at: new Date().toISOString(),
  }, options);
  return getSettlementReport(settlementReportId, options);
}

export async function listSettlementReports(options = {}) {
  const roots = await ensureSettlementWorkflowDirectories(options);
  const entries = await readdir(roots.settlementReports, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSettlementReportId(entry.name)) continue;
    try {
      const paths = reportPaths(entry.name, roots);
      const [metadata, status, neural] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
        readJson(paths.neural),
      ]);
      reports.push({ ...metadata, ...status, neural_usage: neural });
    } catch {
      // Ignore incomplete records.
    }
  }
  return reports.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getSettlementReport(settlementReportId, options = {}) {
  assertSettlementReportId(settlementReportId);
  const roots = rootsFor(options);
  const paths = reportPaths(settlementReportId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Settlement report not found.", 404);
  const [settlementText, metadata, status, neural] = await Promise.all([
    readFile(paths.report, "utf8"),
    readJson(paths.metadata),
    readJson(paths.status),
    readJson(paths.neural),
  ]);
  return {
    settlement_text: settlementText,
    metadata,
    status,
    neural_usage: neural,
  };
}

export async function createPendingCandidateFromSettlementReport(
  settlementReportId,
  { sourceChapter = "", note = "" } = {},
  options = {},
) {
  assertSettlementReportId(settlementReportId);
  const roots = rootsFor(options);
  const report = await getSettlementReport(settlementReportId, options);
  if (
    report.status.status !== "settlement_report_saved"
    || report.status.can_create_pending_candidate !== true
    || report.status.blocked_reason
  ) {
    throw errorWithStatus(
      `Settlement report cannot create pending candidate: ${report.status.blocked_reason || report.status.status}`,
      409,
    );
  }
  const candidate = await importSettlementResult({
    rawText: report.settlement_text,
    sourceChapter: optionalText(sourceChapter, 500) || report.metadata.source_chapter,
    note: optionalText(note, 5_000) || report.metadata.note,
    runId: report.metadata.run_id,
    neuralModulesUsedPath: report.metadata.neural_modules_used_path,
    requiresNeuralModules: report.neural_usage.requires_neural_modules === true,
  }, options);
  const candidateId = candidate.metadata.candidate_id;
  const paths = reportPaths(settlementReportId, roots);
  const nextReportStatus = {
    ...report.status,
    status: "pending_candidate_created",
    pending_candidate_id: candidateId,
    can_create_pending_candidate: false,
    pending_candidate_created_at: new Date().toISOString(),
  };
  await commitFileTransaction("link-settlement-pending-candidate", [
    { filePath: paths.status, content: json(nextReportStatus) },
  ], {
    settlement_report_id: settlementReportId,
    candidate_id: candidateId,
    phase: "phase_4b_settlement_pending_only",
  });
  await updateAdoptedChapterStatus(report.metadata.adopted_chapter_id, {
    status: "settlement_candidate_created",
    settlement_context_id: report.metadata.settlement_context_id,
    settlement_report_id: settlementReportId,
    settlement_candidate_id: candidateId,
    settlement_candidate_created_at: new Date().toISOString(),
    can_create_settlement: false,
  }, options);
  return {
    pending_candidate: candidate,
    settlement_report: await getSettlementReport(settlementReportId, options),
    adopted_chapter: await getAdoptedChapter(report.metadata.adopted_chapter_id, options),
  };
}
