import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  resolveProjectPath,
} from "./project-paths.mjs";
import { assertAgentRunId, getAgentRun } from "./agent-run-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";

export const engineCandidateIdPattern = /^engine_candidate_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const engineSnapshotIdPattern = /^engine_snapshot_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const engineArchiveIdPattern = /^engine_archive_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const engineActivationLogIdPattern =
  /^engine_activation_log_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const parserVersion = "local-engine-candidate-parser-v1";
const allowedStatuses = new Set(["candidate", "blocked", "rejected", "activated"]);
const acceptedHeadings = new Set([
  "新版完整創作引擎候選",
  "新版完整創作引擎",
  "完整創作引擎候選",
  "下一版完整創作引擎",
  "新版 engine 候選",
  "pending_engine_candidate",
]);
const excludedHeadings = new Set([
  "檢核結果",
  "必要提醒",
  "完成狀態",
  "停止原因",
  "不可推定事項",
  "待確認事項",
  "risk_flags",
  "新版 engine 候選摘要",
  "需人工確認項",
  "create-settlement-proposal 建議參數",
]);
const highRiskTerms = [
  "死亡", "角色死亡", "戰死", "犧牲", "長期失能", "永久失能", "重大傷殘",
  "退賽", "能力突破", "階級突破", "成熟者", "超脫者", "代表資格", "隊伍資格",
  "正式名額", "正式編組", "固定關係", "固定配對", "戀人", "婚約", "家族關係",
  "敵我關係", "重大關係翻轉", "暗線核心真相", "核心真相", "反派身份", "身份揭露",
  "組織核心目的", "世界格局", "大部終局", "正史核心設定",
];
const contaminationTerms = [
  "unknown", "rejected", "candidate", "候選", "未確認", "未採用", "退稿", "外部研究", "推論",
];
const mediumRiskTerms = [
  "能力", "關係", "資格", "長線設定", "編組", "名額", "異能武裝本質",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function timestampIdPart(date = new Date()) {
  return date.toISOString().replace(/\D/gu, "").slice(0, 14);
}

function createCandidateId() {
  const stamp = timestampIdPart();
  return `engine_candidate_${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(4).toString("hex")}`;
}

function createSnapshotId() {
  const stamp = timestampIdPart();
  return `engine_snapshot_${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(4).toString("hex")}`;
}

function createArchiveId() {
  const stamp = timestampIdPart();
  return `engine_archive_${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(4).toString("hex")}`;
}

function createActivationLogId() {
  const stamp = timestampIdPart();
  return `engine_activation_log_${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(4).toString("hex")}`;
}

function candidatePaths(candidateId, roots = {}) {
  const pendingRoot = roots.pendingEngineCandidates ?? projectPaths.pendingEngineCandidates;
  const directory = path.join(pendingRoot, candidateId);
  return {
    directory,
    raw: path.join(directory, "raw_import.txt"),
    candidate: path.join(directory, "candidate_engine.md"),
    metadata: path.join(directory, "metadata.json"),
    diff: path.join(directory, "diff.json"),
    risk: path.join(directory, "risk_report.json"),
    status: path.join(directory, "status.json"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
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

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeHeading(value) {
  return value.trim().replace(/[：:]\s*$/u, "").toLocaleLowerCase("zh-Hant");
}

function preview(value, maxLength = 20_000) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n\n[preview truncated]` : text;
}

function activePathFor(options = {}) {
  return options.activeEnginePath
    ? resolveProjectPath(options.activeEnginePath, "active engine test path")
    : projectPaths.activeEngine;
}

function candidateRootsFor(options = {}) {
  if (!options.pendingEngineCandidates) return {};
  return {
    pendingEngineCandidates: assertPathInside(
      options.pendingEngineCandidates,
      projectPaths.canonDb,
      "pending candidate test root",
    ),
  };
}

function phase3PathsFor(options = {}) {
  const resolveCanonRoot = (value, fallback, label) => (
    value ? assertPathInside(value, projectPaths.canonDb, label) : fallback
  );
  return {
    activeEngine: activePathFor(options),
    pendingEngineCandidates: options.pendingEngineCandidates
      ? assertPathInside(
        options.pendingEngineCandidates,
        projectPaths.canonDb,
        "pending candidate test root",
      )
      : projectPaths.pendingEngineCandidates,
    engineSnapshots: resolveCanonRoot(
      options.engineSnapshots,
      projectPaths.engineSnapshots,
      "engine snapshots root",
    ),
    engineArchive: resolveCanonRoot(
      options.engineArchive,
      projectPaths.engineArchive,
      "engine archive root",
    ),
    activationLog: options.activationLog
      ? assertPathInside(options.activationLog, projectPaths.canonDb, "activation log")
      : projectPaths.activationLog,
    rollbackIndex: options.rollbackIndex
      ? assertPathInside(options.rollbackIndex, projectPaths.canonDb, "rollback index")
      : projectPaths.rollbackIndex,
  };
}

function snapshotPaths(snapshotId, roots) {
  assertSnapshotId(snapshotId);
  const directory = path.join(roots.engineSnapshots, snapshotId);
  return {
    directory,
    engine: path.join(directory, "active_engine_before_activation.md"),
    metadata: path.join(directory, "metadata.json"),
  };
}

function archivePaths(archiveId, roots) {
  assertArchiveId(archiveId);
  const directory = path.join(roots.engineArchive, archiveId);
  return {
    directory,
    engine: path.join(directory, "archived_active_engine.md"),
    metadata: path.join(directory, "metadata.json"),
  };
}

async function uniqueSnapshotId(roots) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const snapshotId = createSnapshotId();
    if (!await exists(snapshotPaths(snapshotId, roots).directory)) return snapshotId;
  }
  throw new Error("Could not allocate a unique snapshot_id.");
}

async function uniqueArchiveId(roots) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const archiveId = createArchiveId();
    if (!await exists(archivePaths(archiveId, roots).directory)) return archiveId;
  }
  throw new Error("Could not allocate a unique archive_id.");
}

async function readRollbackIndex(filePath) {
  try {
    const value = await readJson(filePath);
    return {
      updated_at: value.updated_at ?? null,
      activations: Array.isArray(value.activations) ? value.activations : [],
      rollbacks: Array.isArray(value.rollbacks) ? value.rollbacks : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { updated_at: null, activations: [], rollbacks: [] };
    }
    throw error;
  }
}

export function isSafeCandidateId(id) {
  return typeof id === "string" && engineCandidateIdPattern.test(id);
}

export function isSafeSnapshotId(id) {
  return typeof id === "string" && engineSnapshotIdPattern.test(id);
}

export function isSafeArchiveId(id) {
  return typeof id === "string" && engineArchiveIdPattern.test(id);
}

export function assertEngineCandidateId(id) {
  if (!isSafeCandidateId(id)) throw errorWithStatus("Invalid candidate_id.");
  return id;
}

export function assertSnapshotId(id) {
  if (!isSafeSnapshotId(id)) throw errorWithStatus("Invalid snapshot_id.");
  return id;
}

export function assertArchiveId(id) {
  if (!isSafeArchiveId(id)) throw errorWithStatus("Invalid archive_id.");
  return id;
}

export async function ensureEngineCandidateDirectories() {
  await Promise.all([
    mkdir(projectPaths.pendingEngineCandidates, { recursive: true }),
    mkdir(projectPaths.rejectedEngineCandidates, { recursive: true }),
    mkdir(projectPaths.engineSnapshots, { recursive: true }),
    mkdir(projectPaths.engineArchive, { recursive: true }),
    mkdir(projectPaths.activationLogs, { recursive: true }),
    mkdir(projectPaths.rollback, { recursive: true }),
  ]);
}

export async function activeEngineStatus(options = {}) {
  const activeEnginePath = activePathFor(options);
  try {
    const [content, stats] = await Promise.all([
      readFile(activeEnginePath),
      stat(activeEnginePath),
    ]);
    return {
      active_engine_path: normalizeProjectPath(activeEnginePath),
      active_engine_exists: true,
      active_engine_hash: sha256(content),
      active_engine_size: stats.size,
      modified_at: stats.mtime.toISOString(),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      active_engine_path: normalizeProjectPath(activeEnginePath),
      active_engine_exists: false,
      blocked: true,
      blocked_reason: "active_engine.md 不存在",
    };
  }
}

export function parseEngineCandidate(rawText) {
  const text = String(rawText ?? "").replace(/\r\n?/gu, "\n");
  const lines = text.split("\n");
  let selected = null;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (!match) continue;
    const heading = normalizeHeading(match[2]);
    if (excludedHeadings.has(heading) || !acceptedHeadings.has(heading)) continue;
    selected = { index, level: match[1].length };
    break;
  }
  if (!selected) {
    return {
      ok: false,
      candidateText: "",
      parser_version: parserVersion,
      blocked_reason: "找不到新版完整創作引擎候選區塊",
    };
  }

  let start = selected.index + 1;
  while (start < lines.length && !lines[start].trim()) start += 1;
  let candidateText = "";
  const fence = lines[start]?.match(/^```(?:md|markdown|txt)?\s*$/iu);
  if (fence) {
    const closing = lines.findIndex((line, index) => index > start && /^```\s*$/u.test(line));
    if (closing !== -1) candidateText = lines.slice(start + 1, closing).join("\n").trim();
  } else {
    let end = lines.length;
    for (let index = start; index < lines.length; index += 1) {
      const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/u);
      if (match && match[1].length <= selected.level) {
        end = index;
        break;
      }
    }
    candidateText = lines.slice(start, end).join("\n").trim();
  }

  if (!candidateText) {
    return {
      ok: false,
      candidateText: "",
      parser_version: parserVersion,
      blocked_reason: "新版完整創作引擎候選區塊為空白",
    };
  }
  return {
    ok: true,
    candidateText,
    parser_version: parserVersion,
    blocked_reason: null,
  };
}

export function generateEngineDiff(activeText, candidateText) {
  if (!String(activeText ?? "").trim()) throw new Error("active_engine.md 不存在或為空白");
  if (!String(candidateText ?? "").trim()) throw new Error("candidate_engine.md 為空白");
  const activeLines = String(activeText).replace(/\r\n?/gu, "\n").replace(/\n+$/u, "").split("\n");
  const candidateLines = String(candidateText).replace(/\r\n?/gu, "\n").replace(/\n+$/u, "").split("\n");
  let prefix = 0;
  while (
    prefix < activeLines.length
    && prefix < candidateLines.length
    && activeLines[prefix] === candidateLines[prefix]
  ) prefix += 1;
  let suffix = 0;
  while (
    suffix < activeLines.length - prefix
    && suffix < candidateLines.length - prefix
    && activeLines[activeLines.length - 1 - suffix] === candidateLines[candidateLines.length - 1 - suffix]
  ) suffix += 1;

  const oldMiddle = activeLines.slice(prefix, activeLines.length - suffix);
  const newMiddle = candidateLines.slice(prefix, candidateLines.length - suffix);
  const paired = Math.min(oldMiddle.length, newMiddle.length);
  const modified = [];
  for (let index = 0; index < paired; index += 1) {
    if (oldMiddle[index] !== newMiddle[index]) {
      modified.push({
        active_line: prefix + index + 1,
        candidate_line: prefix + index + 1,
        from: oldMiddle[index],
        to: newMiddle[index],
      });
    }
  }
  const deleted = oldMiddle.slice(paired).map((line, index) => ({
    line: prefix + paired + index + 1,
    text: line,
  }));
  const added = newMiddle.slice(paired).map((line, index) => ({
    line: prefix + paired + index + 1,
    text: line,
  }));
  const contextBefore = activeLines.slice(Math.max(0, prefix - 3), prefix).map((line) => ` ${line}`);
  const contextAfter = activeLines.slice(activeLines.length - suffix, activeLines.length - suffix + 3)
    .map((line) => ` ${line}`);
  const rawLines = [
    "--- active_engine.md",
    "+++ candidate_engine.md",
    `@@ -${prefix + 1},${oldMiddle.length} +${prefix + 1},${newMiddle.length} @@`,
    ...contextBefore,
    ...modified.flatMap((item) => [`-${item.from}`, `+${item.to}`]),
    ...deleted.map((item) => `-${item.text}`),
    ...added.map((item) => `+${item.text}`),
    ...contextAfter,
  ];
  return {
    summary: {
      added_count: added.length,
      deleted_count: deleted.length,
      modified_count: modified.length,
    },
    added,
    deleted,
    modified,
    raw_unified_diff: `${rawLines.join("\n")}\n`,
    active_line_count: activeLines.length,
    candidate_line_count: candidateLines.length,
  };
}

export function detectRiskChanges(candidateText, diff, activeText) {
  const candidate = String(candidateText ?? "");
  const active = String(activeText ?? "");
  const changedText = [
    ...(diff?.added ?? []).map((item) => item.text),
    ...(diff?.modified ?? []).map((item) => item.to),
  ].join("\n");
  const lowerChangedText = changedText.toLocaleLowerCase("zh-Hant");
  const matchedKeywords = highRiskTerms.filter((term) => (
    lowerChangedText.includes(term.toLocaleLowerCase("zh-Hant"))
  ));
  const blockedTerms = contaminationTerms.filter((term) => (
    lowerChangedText.includes(term.toLocaleLowerCase("zh-Hant"))
  ));
  const mediumTerms = mediumRiskTerms.filter((term) => (
    lowerChangedText.includes(term.toLocaleLowerCase("zh-Hant"))
  ));
  const activeLines = Math.max(1, Number(diff?.active_line_count) || active.split(/\r?\n/u).length);
  const deleteRatio = ((diff?.summary?.deleted_count ?? 0) + (diff?.summary?.modified_count ?? 0)) / activeLines;
  const candidateLengthRatio = active.length ? candidate.length / active.length : 0;
  const reportLike = /(?:^|\n)#{0,3}\s*(?:檢核結果|必要提醒|完成狀態|停止原因|待確認事項)\b/mu.test(candidate)
    && !/(?:創作引擎|角色|世界|規則|章節)/u.test(candidate);
  const warnings = [];
  let riskLevel = "low";
  if (matchedKeywords.length || mediumTerms.length) riskLevel = matchedKeywords.length ? "high" : "medium";
  if (candidateLengthRatio < 0.5) warnings.push("candidateText 少於 active_engine 字數 50%");
  if (deleteRatio > 0.3) warnings.push("刪除或替換行數超過 active_engine 行數 30%");
  if (reportLike) warnings.push("candidateText 疑似只有檢核或完成狀態");
  if (blockedTerms.length) warnings.push("candidateText 含有未確認或候選污染詞");
  if (warnings.length) riskLevel = "critical";
  return {
    risk_level: riskLevel,
    requires_second_confirmation: riskLevel === "high",
    warnings,
    matched_keywords: [...new Set([...matchedKeywords, ...mediumTerms])],
    blocked_terms: blockedTerms,
    delete_ratio: Number(deleteRatio.toFixed(4)),
    candidate_length_ratio: Number(candidateLengthRatio.toFixed(4)),
  };
}

function buildStatus({ blockedReason = null, riskReport = null }) {
  const blocked = Boolean(blockedReason) || riskReport?.risk_level === "critical";
  return {
    status: blocked ? "blocked" : "candidate",
    can_activate: false,
    blocked_reason: blockedReason
      ?? (riskReport?.risk_level === "critical" ? riskReport.warnings.join("；") : null),
    requires_second_confirmation: Boolean(riskReport?.requires_second_confirmation),
    eligible_for_phase_3_activation: !blocked,
    activated_at: null,
    rejected_at: null,
    phase: "phase_2_pending_only",
  };
}

async function evaluateCandidate(rawText, activeEnginePath) {
  const parsed = parseEngineCandidate(rawText);
  const activeStatus = await activeEngineStatus({ activeEnginePath });
  let activeText = "";
  if (activeStatus.active_engine_exists) activeText = await readFile(activeEnginePath, "utf8");
  if (!parsed.ok) {
    return {
      parsed,
      activeStatus,
      activeText,
      diff: null,
      riskReport: {
        risk_level: "critical",
        requires_second_confirmation: false,
        warnings: [parsed.blocked_reason],
        matched_keywords: [],
        blocked_terms: [],
        delete_ratio: 0,
        candidate_length_ratio: 0,
      },
      status: buildStatus({ blockedReason: parsed.blocked_reason }),
    };
  }
  if (!activeStatus.active_engine_exists) {
    return {
      parsed,
      activeStatus,
      activeText,
      diff: null,
      riskReport: {
        risk_level: "critical",
        requires_second_confirmation: false,
        warnings: [activeStatus.blocked_reason],
        matched_keywords: [],
        blocked_terms: [],
        delete_ratio: 0,
        candidate_length_ratio: 0,
      },
      status: buildStatus({ blockedReason: activeStatus.blocked_reason }),
    };
  }
  try {
    const diff = generateEngineDiff(activeText, parsed.candidateText);
    const riskReport = detectRiskChanges(parsed.candidateText, diff, activeText);
    return {
      parsed,
      activeStatus,
      activeText,
      diff,
      riskReport,
      status: buildStatus({ riskReport }),
    };
  } catch (error) {
    const riskReport = {
      risk_level: "critical",
      requires_second_confirmation: false,
      warnings: [error.message],
      matched_keywords: [],
      blocked_terms: [],
      delete_ratio: 0,
      candidate_length_ratio: 0,
    };
    return {
      parsed,
      activeStatus,
      activeText,
      diff: null,
      riskReport,
      status: buildStatus({ blockedReason: `diff 產生失敗：${error.message}` }),
    };
  }
}

function validateImportReferences(runId, neuralModulesUsedPath) {
  if (runId) assertAgentRunId(runId);
  if (!neuralModulesUsedPath) return "";
  const resolved = assertPathInside(
    neuralModulesUsedPath,
    projectPaths.agentRuns,
    "neural_modules_used_path",
  );
  if (path.basename(resolved) !== "neural_modules_used.json") {
    throw errorWithStatus("neural_modules_used_path must point to neural_modules_used.json.");
  }
  return normalizeProjectPath(resolved);
}

export async function importSettlementResult(input, options = {}) {
  const rawText = String(input?.rawText ?? "");
  if (!rawText.trim()) throw errorWithStatus("rawText 不可空白。");
  const sourceChapter = String(input?.sourceChapter ?? "").trim().slice(0, 500);
  const note = String(input?.note ?? "").trim().slice(0, 5000);
  const runId = String(input?.runId ?? "").trim();
  const requiresNeuralModules = input?.requiresNeuralModules === true;
  const neuralModulesUsedPath = validateImportReferences(
    runId,
    String(input?.neuralModulesUsedPath ?? "").trim(),
  );
  const roots = candidateRootsFor(options);
  const pendingRoot = roots.pendingEngineCandidates ?? projectPaths.pendingEngineCandidates;
  await mkdir(pendingRoot, { recursive: true });
  const candidateId = createCandidateId();
  const paths = candidatePaths(candidateId, roots);
  const activeEnginePath = activePathFor(options);
  const before = await activeEngineStatus({ activeEnginePath });
  const evaluated = await evaluateCandidate(rawText, activeEnginePath);
  const createdAt = new Date().toISOString();
  const metadata = {
    candidate_id: candidateId,
    source_chapter: sourceChapter,
    note,
    created_at: createdAt,
    created_by: "local_ui_import",
    run_id: runId,
    raw_hash: sha256(rawText),
    candidate_hash: evaluated.parsed.ok ? sha256(evaluated.parsed.candidateText) : "",
    active_engine_hash_at_import: evaluated.activeStatus.active_engine_hash ?? "",
    parser_version: parserVersion,
    canon_status: "pending",
    requires_user_confirmation: true,
    requires_neural_modules: requiresNeuralModules,
    neural_modules_used_path: neuralModulesUsedPath,
  };
  const operations = [
    { filePath: paths.raw, content: rawText },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.risk, content: json(evaluated.riskReport) },
    { filePath: paths.status, content: json(evaluated.status) },
  ];
  if (evaluated.parsed.ok) {
    operations.push({ filePath: paths.candidate, content: `${evaluated.parsed.candidateText}\n` });
  }
  if (evaluated.diff) operations.push({ filePath: paths.diff, content: json(evaluated.diff) });
  await commitFileTransaction("import-engine-candidate", operations, {
    candidate_id: candidateId,
    phase: "phase_2_pending_only",
  });
  const after = await activeEngineStatus({ activeEnginePath });
  if (
    before.active_engine_exists !== after.active_engine_exists
    || before.active_engine_hash !== after.active_engine_hash
  ) {
    throw new Error("Safety violation: active_engine.md changed during candidate import.");
  }
  return getPendingCandidate(candidateId, { ...options, pendingEngineCandidates: pendingRoot });
}

export async function listPendingCandidates(options = {}) {
  const roots = candidateRootsFor(options);
  const pendingRoot = roots.pendingEngineCandidates ?? projectPaths.pendingEngineCandidates;
  await mkdir(pendingRoot, { recursive: true });
  const entries = await readdir(pendingRoot, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeCandidateId(entry.name)) continue;
    try {
      const paths = candidatePaths(entry.name, roots);
      const [metadata, status, riskReport] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
        readJson(paths.risk),
      ]);
      if (!allowedStatuses.has(status.status)) continue;
      results.push({
        candidate_id: entry.name,
        source_chapter: metadata.source_chapter,
        created_at: metadata.created_at,
        status: status.status,
        risk_level: riskReport.risk_level,
        candidate_hash: metadata.candidate_hash,
        active_engine_hash_at_import: metadata.active_engine_hash_at_import,
        requires_second_confirmation: status.requires_second_confirmation,
        blocked_reason: status.blocked_reason,
        eligible_for_phase_3_activation: status.eligible_for_phase_3_activation === true,
      });
    } catch {
      // Ignore incomplete directories rather than exposing partial records.
    }
  }
  return results.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getPendingCandidate(candidateId, options = {}) {
  assertEngineCandidateId(candidateId);
  const roots = candidateRootsFor(options);
  const paths = candidatePaths(candidateId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Pending candidate not found.", 404);
  const [metadata, status, riskReport, diff, candidateText, rawText] = await Promise.all([
    readJson(paths.metadata),
    readJson(paths.status),
    readJson(paths.risk),
    exists(paths.diff).then((present) => present ? readJson(paths.diff) : null),
    readOptionalText(paths.candidate),
    readOptionalText(paths.raw),
  ]);
  return {
    metadata,
    status,
    risk_report: riskReport,
    diff,
    candidate_preview: preview(candidateText),
    raw_import_preview: preview(rawText),
  };
}

export async function reparsePendingCandidate(candidateId, options = {}) {
  assertEngineCandidateId(candidateId);
  const roots = candidateRootsFor(options);
  const paths = candidatePaths(candidateId, roots);
  const [metadata, currentStatus, rawText] = await Promise.all([
    readJson(paths.metadata),
    readJson(paths.status),
    readFile(paths.raw, "utf8"),
  ]);
  if (["rejected", "activated"].includes(currentStatus.status)) {
    throw errorWithStatus(
      `${currentStatus.status} candidate cannot be reparsed; import it as a new candidate.`,
      409,
    );
  }
  const activeEnginePath = activePathFor(options);
  const before = await activeEngineStatus({ activeEnginePath });
  const evaluated = await evaluateCandidate(rawText, activeEnginePath);
  const nextMetadata = {
    ...metadata,
    candidate_hash: evaluated.parsed.ok ? sha256(evaluated.parsed.candidateText) : "",
    active_engine_hash_at_import: evaluated.activeStatus.active_engine_hash ?? "",
    parser_version: parserVersion,
    reparsed_at: new Date().toISOString(),
  };
  const operations = [
    { filePath: paths.metadata, content: json(nextMetadata) },
    { filePath: paths.risk, content: json(evaluated.riskReport) },
    { filePath: paths.status, content: json(evaluated.status) },
  ];
  if (evaluated.parsed.ok) {
    operations.push({ filePath: paths.candidate, content: `${evaluated.parsed.candidateText}\n` });
  } else if (await exists(paths.candidate)) {
    operations.push({ type: "delete", filePath: paths.candidate });
  }
  if (evaluated.diff) {
    operations.push({ filePath: paths.diff, content: json(evaluated.diff) });
  } else if (await exists(paths.diff)) {
    operations.push({ type: "delete", filePath: paths.diff });
  }
  await commitFileTransaction("reparse-engine-candidate", operations, {
    candidate_id: candidateId,
    phase: "phase_2_pending_only",
  });
  const after = await activeEngineStatus({ activeEnginePath });
  if (
    before.active_engine_exists !== after.active_engine_exists
    || before.active_engine_hash !== after.active_engine_hash
  ) {
    throw new Error("Safety violation: active_engine.md changed during candidate reparse.");
  }
  return getPendingCandidate(candidateId, options);
}

export async function rejectPendingCandidate(candidateId, { reason = "" } = {}, options = {}) {
  assertEngineCandidateId(candidateId);
  const roots = candidateRootsFor(options);
  const paths = candidatePaths(candidateId, roots);
  const status = await readJson(paths.status);
  if (!allowedStatuses.has(status.status)) throw errorWithStatus("Invalid candidate status.");
  if (["rejected", "activated"].includes(status.status)) {
    throw errorWithStatus(`Candidate status cannot be rejected: ${status.status}`, 409);
  }
  const nextStatus = {
    ...status,
    status: "rejected",
    can_activate: false,
    eligible_for_phase_3_activation: false,
    rejected_at: new Date().toISOString(),
    rejection_reason: String(reason ?? "").trim().slice(0, 5000),
    phase: "phase_2_pending_only",
  };
  await commitFileTransaction("reject-engine-candidate", [
    { filePath: paths.status, content: json(nextStatus) },
  ], {
    candidate_id: candidateId,
    phase: "phase_2_pending_only",
  });
  return getPendingCandidate(candidateId, options);
}

async function verifyCandidateNeuralEvidence(metadata) {
  if (metadata.requires_neural_modules !== true) {
    return {
      required: false,
      ok: true,
      run_id: metadata.run_id || "",
      missing_required_neural_modules: [],
    };
  }
  try {
    const runId = assertAgentRunId(metadata.run_id);
    const expectedPath = path.join(projectPaths.agentRuns, runId, "neural_modules_used.json");
    const actualPath = assertPathInside(
      metadata.neural_modules_used_path,
      projectPaths.agentRuns,
      "neural_modules_used_path",
    );
    if (actualPath !== expectedPath) {
      throw new Error("neural_modules_used_path does not match run_id.");
    }
    await getAgentRun(runId);
    const usage = await summarizeNeuralUsageForRun(runId);
    if (usage.missing_required_neural_modules.length) {
      throw new Error(
        `required modules missing success trace: ${usage.missing_required_neural_modules.join(", ")}`,
      );
    }
    return {
      required: true,
      ok: true,
      run_id: runId,
      used_neural_network: usage.used_neural_network,
      neural_modules_used: usage.neural_modules_used,
      missing_required_neural_modules: [],
    };
  } catch (error) {
    throw errorWithStatus(`neural_trace_missing: ${error.message}`, 409);
  }
}

export async function activatePendingCandidate(
  candidateId,
  {
    confirm = false,
    secondConfirm = false,
    approvedBy = "local_user",
    approvalItemId = null,
    activationSource = "legacy_service_confirmation",
  } = {},
  options = {},
) {
  assertEngineCandidateId(candidateId);
  if (confirm !== true) throw errorWithStatus("User confirmation is required.", 409);
  const roots = phase3PathsFor(options);
  const paths = candidatePaths(candidateId, {
    pendingEngineCandidates: roots.pendingEngineCandidates,
  });
  const [metadata, status, riskReport, candidateText, activeText] = await Promise.all([
    readJson(paths.metadata),
    readJson(paths.status),
    readJson(paths.risk),
    readFile(paths.candidate, "utf8"),
    readFile(roots.activeEngine, "utf8"),
  ]);
  if (status.status !== "candidate") {
    throw errorWithStatus(`Candidate status cannot be activated: ${status.status}`, 409);
  }
  if (riskReport.risk_level === "critical") {
    throw errorWithStatus("Critical-risk candidate cannot be activated.", 409);
  }
  if (!candidateText.trim()) throw errorWithStatus("candidate_engine.md is empty.", 409);
  if (riskReport.requires_second_confirmation === true && secondConfirm !== true) {
    throw errorWithStatus("High-risk candidate requires second confirmation.", 409);
  }
  const currentHash = sha256(activeText);
  const baseActiveEngineHash =
    metadata.base_active_engine_hash ?? metadata.active_engine_hash_at_import;
  if (
    baseActiveEngineHash
    && baseActiveEngineHash !== currentHash
  ) {
    throw errorWithStatus(
      "active_engine.md changed since candidate import; reparse before activation.",
      409,
    );
  }
  const neuralEvidence = await verifyCandidateNeuralEvidence(metadata);
  const activatedAt = new Date().toISOString();
  const activationLogId = createActivationLogId();
  const [snapshotId, archiveId] = await Promise.all([
    uniqueSnapshotId(roots),
    uniqueArchiveId(roots),
  ]);
  const snapshot = snapshotPaths(snapshotId, roots);
  const archive = archivePaths(archiveId, roots);
  const candidateHash = sha256(candidateText.trimEnd());
  if (metadata.candidate_hash && metadata.candidate_hash !== candidateHash) {
    throw errorWithStatus("candidate_engine.md hash does not match metadata.", 409);
  }
  const activeAfterHash = sha256(candidateText);
  const snapshotMetadata = {
    snapshot_id: snapshotId,
    snapshot_kind: "pre_engine_activation",
    created_at: activatedAt,
    reason: "before_pending_candidate_activation",
    candidate_id: candidateId,
    pending_engine_candidate_id: candidateId,
    approval_item_id: approvalItemId,
    source_chapter: metadata.source_chapter,
    active_engine_hash: currentHash,
    previous_active_engine_hash: currentHash,
    active_engine_path: normalizeProjectPath(roots.activeEngine),
    snapshot_path: normalizeProjectPath(snapshot.engine),
    rollback_available: true,
    rollback_requires_approval: true,
  };
  const archiveMetadata = {
    archive_id: archiveId,
    archived_at: activatedAt,
    canon_status: "archived",
    source_chapter: metadata.source_chapter,
    superseded_by_candidate_id: candidateId,
    active_engine_hash: currentHash,
    rollback_available: true,
    retention: riskReport.risk_level === "high" ? "high_risk" : "normal",
    risk_level: riskReport.risk_level,
  };
  const activationRecord = {
    activation_log_id: activationLogId,
    log_kind: "engine_activation_confirmation",
    event: "activate_pending_engine_candidate",
    candidate_id: candidateId,
    pending_engine_candidate_id: candidateId,
    approval_item_id: approvalItemId,
    activation_source: activationSource,
    source_chapter: metadata.source_chapter,
    settlement_report_id: metadata.settlement_report_id ?? null,
    settlement_context_id: metadata.settlement_context_id ?? null,
    adopted_chapter_id: metadata.adopted_chapter_id ?? null,
    activated_at: activatedAt,
    approved_by: String(approvedBy || "local_user").slice(0, 200),
    activated_by_user_confirmation: true,
    snapshot_id: snapshotId,
    snapshot_path: normalizeProjectPath(snapshot.engine),
    archive_id: archiveId,
    active_engine_path: normalizeProjectPath(roots.activeEngine),
    active_engine_before_hash: currentHash,
    active_engine_after_hash: activeAfterHash,
    previous_active_engine_hash: currentHash,
    new_active_engine_hash: activeAfterHash,
    candidate_hash: candidateHash,
    risk_level: riskReport.risk_level,
    requires_second_confirmation: riskReport.requires_second_confirmation === true,
    rollback_available: true,
    rollback_requires_approval: true,
    neural_evidence: neuralEvidence,
  };
  const nextMetadata = {
    ...metadata,
    activated: true,
    activated_at: activatedAt,
    activated_by: String(approvedBy || "local_user").slice(0, 200),
    activation_source: activationSource,
    activation_approval_item_id: approvalItemId ?? metadata.activation_approval_item_id ?? null,
    activation_log_id: activationLogId,
    snapshot_id: snapshotId,
    archive_id: archiveId,
    previous_active_engine_hash: currentHash,
    new_active_engine_hash: activeAfterHash,
    active_engine_modified: true,
    review_status: "activated",
    activation_request_status: "resolved",
    rollback_available: true,
    rollback_requires_approval: true,
  };
  const nextStatus = {
    ...status,
    status: "activated",
    can_activate: false,
    blocked_reason: null,
    requires_second_confirmation: riskReport.requires_second_confirmation === true,
    eligible_for_phase_3_activation: false,
    activated_at: activatedAt,
    activated: true,
    activation_approval_item_id: approvalItemId ?? status.activation_approval_item_id ?? null,
    activation_log_id: activationLogId,
    snapshot_id: snapshotId,
    archive_id: archiveId,
    previous_active_engine_hash: currentHash,
    new_active_engine_hash: activeAfterHash,
    active_engine_modified: true,
    review_status: "activated",
    activation_request_status: "resolved",
    rollback_available: true,
    rollback_requires_approval: true,
    rejected_at: null,
    phase: "phase_3_activated",
  };
  const rollbackIndex = await readRollbackIndex(roots.rollbackIndex);
  const nextRollbackIndex = {
    ...rollbackIndex,
    updated_at: activatedAt,
    activations: [...rollbackIndex.activations, {
      candidate_id: candidateId,
      snapshot_id: snapshotId,
      archive_id: archiveId,
      activated_at: activatedAt,
      active_engine_before_hash: currentHash,
      active_engine_after_hash: activeAfterHash,
    }],
  };
  let transaction;
  try {
    transaction = await commitFileTransaction("activate-engine-candidate", [
      { filePath: snapshot.engine, content: activeText },
      { filePath: snapshot.metadata, content: json(snapshotMetadata) },
      { filePath: archive.engine, content: activeText },
      { filePath: archive.metadata, content: json(archiveMetadata) },
      { filePath: roots.activeEngine, content: candidateText },
      { type: "append", filePath: roots.activationLog, content: `${JSON.stringify(activationRecord)}\n` },
      { filePath: paths.metadata, content: json(nextMetadata) },
      { filePath: paths.status, content: json(nextStatus) },
      { filePath: roots.rollbackIndex, content: json(nextRollbackIndex) },
    ], {
      candidate_id: candidateId,
      snapshot_id: snapshotId,
      archive_id: archiveId,
      phase: "phase_3_activation",
      test_fail_after_commits: options.testFailAfterCommits,
    });
  } catch (error) {
    await Promise.all([
      rm(snapshot.directory, { recursive: true, force: true }),
      rm(archive.directory, { recursive: true, force: true }),
    ]);
    throw error;
  }
  const activeAfter = await readFile(roots.activeEngine, "utf8");
  if (sha256(activeAfter) !== activeAfterHash) {
    throw new Error("Safety violation: active_engine.md hash mismatch after activation.");
  }
  return {
    ok: true,
    candidate_id: candidateId,
    pending_engine_candidate_id: candidateId,
    approval_item_id: approvalItemId,
    activation_log_id: activationLogId,
    snapshot_id: snapshotId,
    snapshot_path: normalizeProjectPath(snapshot.engine),
    archive_id: archiveId,
    activated_at: activatedAt,
    active_engine_before_hash: currentHash,
    active_engine_after_hash: activeAfterHash,
    previous_active_engine_hash: currentHash,
    new_active_engine_hash: activeAfterHash,
    active_engine_modified: true,
    rollback_available: true,
    rollback_requires_approval: true,
    transaction_id: transaction.transaction_id,
    status: nextStatus,
    neural_evidence: neuralEvidence,
  };
}

export async function listSnapshots(options = {}) {
  const roots = phase3PathsFor(options);
  await mkdir(roots.engineSnapshots, { recursive: true });
  const entries = await readdir(roots.engineSnapshots, { withFileTypes: true });
  const snapshots = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSnapshotId(entry.name)) continue;
    try {
      const paths = snapshotPaths(entry.name, roots);
      const metadata = await readJson(paths.metadata);
      snapshots.push(metadata);
    } catch {
      // Ignore incomplete snapshot directories.
    }
  }
  return snapshots.sort((left, right) => (
    String(right.created_at).localeCompare(String(left.created_at))
  ));
}

export async function listActivationLogs(options = {}) {
  const roots = phase3PathsFor(options);
  const text = await readOptionalText(roots.activationLog);
  return text.split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .sort((left, right) => (
      String(right.activated_at ?? right.rollback_at)
        .localeCompare(String(left.activated_at ?? left.rollback_at))
    ));
}

export async function rollbackActiveEngine(
  snapshotId,
  {
    confirm = false,
    approvedBy = "local_user",
  } = {},
  options = {},
) {
  assertSnapshotId(snapshotId);
  if (confirm !== true) throw errorWithStatus("Rollback confirmation is required.", 409);
  const roots = phase3PathsFor(options);
  const target = snapshotPaths(snapshotId, roots);
  const [targetText, targetMetadata, activeText] = await Promise.all([
    readFile(target.engine, "utf8"),
    readJson(target.metadata),
    readFile(roots.activeEngine, "utf8"),
  ]);
  if (targetMetadata.rollback_available !== true) {
    throw errorWithStatus("Snapshot is not available for rollback.", 409);
  }
  if (!targetText.trim()) throw errorWithStatus("Snapshot engine content is empty.", 409);
  const rolledBackAt = new Date().toISOString();
  const safetySnapshotId = await uniqueSnapshotId(roots);
  const safety = snapshotPaths(safetySnapshotId, roots);
  const activeBeforeHash = sha256(activeText);
  const activeAfterHash = sha256(targetText);
  const safetyMetadata = {
    snapshot_id: safetySnapshotId,
    created_at: rolledBackAt,
    reason: "before_active_engine_rollback",
    candidate_id: "",
    source_chapter: targetMetadata.source_chapter ?? "",
    active_engine_hash: activeBeforeHash,
    active_engine_path: normalizeProjectPath(roots.activeEngine),
    rollback_available: true,
  };
  const rollbackRecord = {
    event: "rollback_active_engine",
    rollback_at: rolledBackAt,
    approved_by: String(approvedBy || "local_user").slice(0, 200),
    target_snapshot_id: snapshotId,
    safety_snapshot_id: safetySnapshotId,
    active_engine_before_hash: activeBeforeHash,
    active_engine_after_hash: activeAfterHash,
  };
  const rollbackIndex = await readRollbackIndex(roots.rollbackIndex);
  const nextRollbackIndex = {
    ...rollbackIndex,
    updated_at: rolledBackAt,
    rollbacks: [...rollbackIndex.rollbacks, rollbackRecord],
  };
  let transaction;
  try {
    transaction = await commitFileTransaction("rollback-active-engine", [
      { filePath: safety.engine, content: activeText },
      { filePath: safety.metadata, content: json(safetyMetadata) },
      { filePath: roots.activeEngine, content: targetText },
      { type: "append", filePath: roots.activationLog, content: `${JSON.stringify(rollbackRecord)}\n` },
      { filePath: roots.rollbackIndex, content: json(nextRollbackIndex) },
    ], {
      target_snapshot_id: snapshotId,
      safety_snapshot_id: safetySnapshotId,
      phase: "phase_3_rollback",
      test_fail_after_commits: options.testFailAfterCommits,
    });
  } catch (error) {
    await rm(safety.directory, { recursive: true, force: true });
    throw error;
  }
  const activeAfter = await readFile(roots.activeEngine, "utf8");
  if (sha256(activeAfter) !== activeAfterHash) {
    throw new Error("Safety violation: active_engine.md hash mismatch after rollback.");
  }
  return {
    ok: true,
    target_snapshot_id: snapshotId,
    safety_snapshot_id: safetySnapshotId,
    rollback_at: rolledBackAt,
    active_engine_before_hash: activeBeforeHash,
    active_engine_after_hash: activeAfterHash,
    transaction_id: transaction.transaction_id,
  };
}
