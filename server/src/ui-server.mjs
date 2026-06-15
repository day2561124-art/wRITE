import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  sourceTrustFor,
  validateSourceTrustMetadata,
} from "./source-trust.mjs";
import { terminateProcessTree } from "./process-control.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  projectPaths,
  projectRoot,
  resolveProjectPath as resolveSafeProjectPath,
} from "./project-paths.mjs";
import { sourceSpecsFor } from "./source-registry.mjs";
import {
  assertAgentRunId,
  createAgentRun,
  ensureAgentRunDirectories,
  getAgentRun,
  listAgentRuns,
} from "./agent-run-service.mjs";
import {
  assertNeuralTraceId,
  getNeuralTrace,
  listNeuralTraces,
  summarizeNeuralUsageForRun,
} from "./neural-trace-service.mjs";
import {
  run_character_simulator,
  run_neural_critic,
  run_over_governance_detector,
  run_scene_planner,
  run_style_drift_detector,
} from "./neural-module-service.mjs";
import {
  activeEngineStatus,
  assertEngineCandidateId,
  assertSnapshotId,
  ensureEngineCandidateDirectories,
  getPendingCandidate,
  importSettlementResult,
  listActivationLogs,
  listPendingCandidates,
  listSnapshots,
  rejectPendingCandidate,
  reparsePendingCandidate,
  rollbackActiveEngine,
} from "./engine-candidate-service.mjs";
import {
  allowedVisualImageExtensions,
  validateVisualRecord,
  visualCategoryAssetDirectories,
  visualCategoryLabels,
  visualCategorySpecs,
} from "./visual-db.mjs";
import {
  adoptCandidateDraft,
  archiveCandidateDraft,
  assertAdoptedChapterId,
  assertDraftId,
  assertProofId,
  buildDraftContextBundle,
  buildProofingContextBundle,
  createDraftTask,
  ensureWritingWorkflowDirectories,
  getAdoptedChapter,
  getCandidateDraft,
  getProofReport,
  listAdoptedChapters,
  listCandidateDrafts,
  listProofReports,
  rejectCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
  sendDraftToProofing,
} from "./writing-workflow-service.mjs";
import {
  assertSettlementContextId,
  assertSettlementReportId,
  buildSettlementContext,
  createPendingCandidateFromSettlementReport,
  ensureSettlementWorkflowDirectories,
  getSettlementContext,
  getSettlementReport,
  listSettlementContexts,
  listSettlementReports,
  saveSettlementReport,
} from "./settlement-workflow-service.mjs";
import {
  assertApprovalItemId,
  confirmApprovalItem,
  createRollbackApprovalItem,
  deferApprovalItem,
  ensureApprovalQueueDirectories,
  getApprovalItem,
  listApprovalItems,
  listApprovalLogs,
  refreshApprovalItem,
  rejectApprovalItem,
  scanApprovalQueue,
} from "./approval-queue-service.mjs";
import {
  approveCleanupProposal,
  assertCleanupProposalId,
  createCleanupProposal,
  deferCleanupProposal,
  ensureCleanupDirectories,
  executeCleanupProposal,
  getCleanupProposal,
  listCleanupLogs,
  listCleanupProposals,
  rejectCleanupProposal,
  scanCleanupCandidates,
} from "./cleanup-proposal-service.mjs";
import {
  buildGptWritingContext,
  listGptWritingContextBundles,
} from "./gpt-writing-context-service.mjs";
import {
  saveChatOutputAsWritingCandidate,
  listWritingCandidates,
  getWritingCandidateDetail,
} from "./chat-output-candidate-service.mjs";
import { buildCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "./candidate-proof-report-service.mjs";
import { requestWritingCandidateAdoption } from "./candidate-adoption-request-service.mjs";
import {
  buildAdoptedWritingSettlementContext,
  saveChatOutputAsSettlementReport,
  buildPendingEngineCandidateFromSettlementReport,
} from "./adopted-writing-settlement-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "./pending-engine-candidate-review-service.mjs";
import {
  listCompressedRuleUpdateProposals,
  listFeedbackDigests,
  listFeedbackItems,
  listRuleCandidates,
} from "./feedback-learning-service.mjs";
import {
  listCompressedRuleApplications,
} from "./compressed-rule-update-confirm-service.mjs";
import { buildWriterWorkbenchState } from "./writer-workbench-state-service.mjs";
import { buildCanonSettingsCatalog } from "./canon-settings-service.mjs";
import {
  createSettingChangeProposal,
  getSettingChangeProposal,
  listSettingChangeProposals,
} from "./setting-change-proposal-service.mjs";

const rootDir = projectRoot;
const uiDir = path.join(rootDir, "server", "ui");
const toolsDir = path.join(rootDir, "server", "src", "tools");
const defaultHost = "127.0.0.1";
const defaultPort = 4173;
const maxJsonBodyBytes = 2 * 1024 * 1024;
const maxVisualUploadBodyBytes = 12 * 1024 * 1024;
const maxToolOutputBytes = 4 * 1024 * 1024;
const maxVisualImageBytes = 8 * 1024 * 1024;
const activeChildren = new Set();
const visualAssetsDir = projectPaths.visualAssets;
const visualIndexPath = projectPaths.visualIndex;
let visualWriteQueue = Promise.resolve();

const sourceSpecs = sourceSpecsFor("ui").map((entry) => ({
  key: entry.source_id,
  label: entry.ui_label,
  path: entry.source_path,
}));

const outputSpecs = [
  ["current_prompt", "完整上下文", "data/outputs/current_prompt.md"],
  ["generation_context", "生成上下文", "data/outputs/generation_context.md"],
  ["retrieval_context", "檢索結果", "data/outputs/retrieval_context.md"],
  ["task_prompt", "任務提示", "data/outputs/task_prompt.md"],
];

const countSpecs = [
  ["正式錯誤", "data/error_report_db/canon_errors.jsonl"],
  ["角色錯誤", "data/error_report_db/character_errors.jsonl"],
  ["對話錯誤", "data/error_report_db/dialogue_errors.jsonl"],
  ["節奏錯誤", "data/error_report_db/pacing_errors.jsonl"],
  ["戰鬥錯誤", "data/error_report_db/battle_errors.jsonl"],
  ["偏好錯誤", "data/error_report_db/preference_errors.jsonl"],
  ["待審錯誤", "data/feedback_db/pending_error_reports.jsonl"],
  ["採用回饋", "data/feedback_db/accepted_drafts.jsonl"],
  ["退稿回饋", "data/feedback_db/rejected_drafts.jsonl"],
  ["修訂回饋", "data/feedback_db/revision_pairs.jsonl"],
  ["偏好回饋", "data/feedback_db/preference_pairs.jsonl"],
  ["候選稿", "data/outputs/logs/draft_index.jsonl"],
];

const readableExactPaths = new Set([
  ...sourceSpecs.map((source) => source.path),
  ...outputSpecs.map(([, , filePath]) => filePath),
  "data/visual_db/README.md",
  "data/visual_db/visual_index.jsonl",
]);

const readableDirectoryPaths = [
  "data/outputs/drafts",
  "data/outputs/proof_reports",
  "data/outputs/settlement_proposals",
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const visualUploadMimeTypes = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const neuralApiModules = {
  "scene-planner": run_scene_planner,
  "character-simulator": run_character_simulator,
  "neural-critic": run_neural_critic,
  "style-drift-detector": run_style_drift_detector,
  "over-governance-detector": run_over_governance_detector,
};

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function resolveProjectPath(value, label = "path") {
  return resolveSafeProjectPath(value, label);
}

function canonicalProjectPath(value) {
  if (typeof value !== "string" || !value) {
    throw new Error("A project path is required.");
  }
  return normalizePath(resolveProjectPath(value, "project path"));
}

function parseArgs(argv) {
  const options = {
    host: defaultHost,
    port: Number.parseInt(process.env.UI_PORT ?? "", 10) || defaultPort,
    open: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") {
      options.host = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--port") {
      options.port = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (arg === "--open") {
      options.open = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.host) throw new Error("--host requires a value.");
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("--port must be an integer from 1 to 65535.");
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node server/src/ui-server.mjs [--host 127.0.0.1] [--port 4173] [--open]",
  ].join("\n");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function fileMetadata(projectPath) {
  const filePath = resolveProjectPath(projectPath);
  try {
    const stats = await stat(filePath);
    return {
      path: projectPath,
      exists: true,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { path: projectPath, exists: false, bytes: 0, modifiedAt: "" };
    }
    throw error;
  }
}

async function sourceState(spec) {
  const filePath = resolveProjectPath(spec.path);
  try {
    const [text, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    const version = text.slice(0, 2000).match(/v\d+(?:\.\d+)+/iu)?.[0] ?? "active";
    const trust = sourceTrustFor(spec.key, text, {
      sourceVersion: version,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      exists: true,
    });
    const errors = validateSourceTrustMetadata(trust);
    return {
      ...spec,
      exists: true,
      version,
      trust: trust.source_trust_level,
      canonStatus: trust.canon_status,
      warning: trust.forbidden_reason,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: hashText(text),
      errors,
    };
  } catch (error) {
    const trust = sourceTrustFor(spec.key, "", {
      sourceVersion: "missing",
      exists: false,
    });
    return {
      ...spec,
      exists: false,
      version: "missing",
      trust: trust.source_trust_level,
      canonStatus: trust.canon_status,
      warning: trust.forbidden_reason,
      bytes: 0,
      modifiedAt: "",
      sha256: "",
      errors: [error.message],
    };
  }
}

async function readJsonl(projectPath, limit = 100) {
  if (limit <= 0) {
    const filePath = resolveProjectPath(projectPath);
    let count = 0;
    try {
      const input = createReadStream(filePath, { encoding: "utf8" });
      const lines = createInterface({ input, crlfDelay: Infinity });
      for await (const line of lines) {
        if (line.trim()) count += 1;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return { count, records: [] };
  }
  const text = await readOptionalText(resolveProjectPath(projectPath));
  const lines = text.split(/\r?\n/u).filter((line) => line.trim());
  const records = [];
  for (const line of lines.slice(-limit)) {
    try {
      records.push(JSON.parse(line));
    } catch {
      records.push({ invalid: true, raw: line });
    }
  }
  return { count: lines.length, records: records.reverse() };
}

function visualAssetUrl(projectPath) {
  return `/api/visual-db/asset?path=${encodeURIComponent(projectPath)}`;
}

async function visualAssetState(record) {
  const validation = validateVisualRecord(record);
  const result = {
    ...record,
    categoryLabel: visualCategoryLabels[record.category] ?? record.category ?? "未分類",
    assetUrl: "",
    exists: false,
    bytes: 0,
    modifiedAt: "",
    errors: [...validation.errors],
    warnings: [...validation.warnings],
  };
  if (validation.errors.length > 0) return result;

  let filePath;
  try {
    filePath = assertPathInside(record.path, visualAssetsDir, "visual asset");
  } catch (error) {
    result.errors.push(error.message);
    return result;
  }
  if (!allowedVisualImageExtensions.has(path.extname(filePath).toLowerCase())) {
    result.errors.push("image extension is not allowed.");
    return result;
  }

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      result.errors.push("path is not a file.");
      return result;
    }
    result.exists = true;
    result.bytes = stats.size;
    result.modifiedAt = stats.mtime.toISOString();
    result.assetUrl = visualAssetUrl(record.path);
  } catch (error) {
    if (error.code === "ENOENT") {
      result.warnings.push("image file is missing.");
      return result;
    }
    throw error;
  }

  return result;
}

async function countPngAssets(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
  let count = 0;
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await countPngAssets(entryPath);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") {
      count += 1;
    }
  }
  return count;
}

async function visualPayload() {
  const [text, pngFiles, gitignoreText] = await Promise.all([
    readOptionalText(visualIndexPath),
    countPngAssets(visualAssetsDir),
    readOptionalText(".gitignore"),
  ]);
  const lines = text.split(/\r?\n/u);
  const itemTasks = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      itemTasks.push((async () => ({
        lineNumber: index + 1,
        ...await visualAssetState(record),
      }))());
    } catch (error) {
      itemTasks.push(Promise.resolve({
        lineNumber: index + 1,
        visual_id: `INVALID-L${index + 1}`,
        character: "",
        category: "invalid",
        categoryLabel: "Invalid",
        title: `Invalid JSON line ${index + 1}`,
        canon_status: "invalid",
        trust_level: "",
        source: "",
        path: "",
        tags: [],
        notes: "",
        description: "",
        assetUrl: "",
        exists: false,
        bytes: 0,
        modifiedAt: "",
        errors: [`invalid JSON: ${error.message}`],
        warnings: [],
      }));
    }
  }
  const items = await Promise.all(itemTasks);
  const characters = [...new Set(items.map((item) => item.character).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-Hant"),
  );
  return {
    indexPath: "data/visual_db/visual_index.jsonl",
    assetsPath: "data/visual_db/assets",
    items,
    count: items.length,
    characters,
    categories: visualCategorySpecs.map(([key, label]) => ({ key, label })),
    errorCount: items.reduce((total, item) => total + item.errors.length, 0),
    warningCount: items.reduce((total, item) => total + item.warnings.length, 0),
    diagnostics: {
      indexRecords: items.length,
      pngFiles,
      gitIgnored: gitignoreText
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .includes("data/visual_db/assets/"),
    },
  };
}

async function statePayload() {
  const [sources, outputs, counts, drafts, proofReports, settlements, visuals] = await Promise.all([
    Promise.all(sourceSpecs.map(sourceState)),
    Promise.all(outputSpecs.map(async ([key, label, filePath]) => ({
      key,
      label,
      ...await fileMetadata(filePath),
    }))),
    Promise.all(countSpecs.map(async ([label, filePath]) => ({
      label,
      path: filePath,
      count: (await readJsonl(filePath, 0)).count,
    }))),
    readJsonl("data/outputs/logs/draft_index.jsonl", 100),
    readJsonl("data/outputs/logs/proof_report_index.jsonl", 100),
    readJsonl("data/outputs/logs/settlement_proposal_index.jsonl", 100),
    visualPayload(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    sources,
    outputs,
    counts,
    drafts: drafts.records,
    proofReports: proofReports.records,
    settlements: settlements.records,
    visuals,
  };
}

function requireString(value, field, maxLength = 200_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalString(value, field, maxLength = 20_000) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  if (value.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters.`);
  return value.trim();
}

function optionalBoolean(value, field, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${field} must be boolean.`);
  return value;
}

function optionalInteger(value, field, fallback, minimum, maximum) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function enumValue(value, field, values, fallback) {
  const normalized = value ?? fallback;
  if (!values.includes(normalized)) {
    throw new Error(`${field} must be one of: ${values.join(", ")}.`);
  }
  return normalized;
}

function optionalStringArray(value, field, maxItems = 20, maxLength = 80) {
  if (value === undefined || value === null || value === "") return [];
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,，、\n]/u)
      : null;
  if (!rawItems) throw new Error(`${field} must be a string or an array of strings.`);
  if (rawItems.length > maxItems) throw new Error(`${field} must contain at most ${maxItems} items.`);
  const items = rawItems
    .map((item) => {
      if (typeof item !== "string") throw new Error(`${field} must contain only strings.`);
      return item.trim();
    })
    .filter(Boolean);
  if (items.some((item) => item.length > maxLength)) {
    throw new Error(`${field} items must be at most ${maxLength} characters.`);
  }
  return [...new Set(items)];
}

function safeFileStem(...values) {
  const stem = values
    .join(" ")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
  return stem || "visual";
}

function decodeBase64Image(value) {
  const raw = requireString(value, "dataBase64", Math.ceil(maxVisualImageBytes * 1.4) + 128);
  const dataUrlMatch = raw.match(/^data:([^;,]+);base64,(.+)$/isu);
  const mimeFromDataUrl = dataUrlMatch?.[1]?.toLowerCase() ?? "";
  const base64 = (dataUrlMatch?.[2] ?? raw).replace(/\s+/gu, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(base64) || base64.length % 4 === 1) {
    throw new Error("dataBase64 must contain valid base64 image data.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("image file is empty.");
  if (buffer.length > maxVisualImageBytes) {
    throw new Error(`image file exceeds ${Math.round(maxVisualImageBytes / (1024 * 1024))} MB.`);
  }
  return { buffer, mimeFromDataUrl };
}

function detectImageExtension(buffer) {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return ".png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (
    buffer.length >= 6
    && (buffer.subarray(0, 6).toString("ascii") === "GIF87a"
      || buffer.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return ".gif";
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  return "";
}

function extensionsMatch(requested, detected) {
  if (requested === detected) return true;
  return detected === ".jpg" && requested === ".jpeg";
}

function enqueueVisualWrite(task) {
  const next = visualWriteQueue.then(task, task);
  visualWriteQueue = next.catch(() => {});
  return next;
}

function buildVisualUpload(input) {
  const now = new Date().toISOString();
  const title = requireString(input.title, "title", 200);
  const character = requireString(input.character, "character", 120);
  const category = enumValue(
    input.category,
    "category",
    Object.keys(visualCategoryAssetDirectories),
    "character_design",
  );
  const canonStatus = enumValue(input.canonStatus, "canonStatus", ["reference", "candidate"], "reference");
  const originalFilename = requireString(input.filename, "filename", 255);
  const requestedExtension = path.extname(path.basename(originalFilename)).toLowerCase();
  if (!allowedVisualImageExtensions.has(requestedExtension)) {
    throw new Error("filename must use an allowed image extension: png, jpg, jpeg, webp, gif.");
  }

  const mimeType = optionalString(input.mimeType, "mimeType", 100).toLowerCase();
  if (mimeType && mimeType !== visualUploadMimeTypes[requestedExtension]) {
    throw new Error("mimeType does not match the filename extension.");
  }

  const { buffer, mimeFromDataUrl } = decodeBase64Image(input.dataBase64);
  if (mimeFromDataUrl && mimeFromDataUrl !== visualUploadMimeTypes[requestedExtension]) {
    throw new Error("data URL mime type does not match the filename extension.");
  }
  const detectedExtension = detectImageExtension(buffer);
  if (!detectedExtension || !extensionsMatch(requestedExtension, detectedExtension)) {
    throw new Error("image bytes do not match the filename extension.");
  }

  const directoryName = visualCategoryAssetDirectories[category];
  const token = `${now.replace(/\D/gu, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const fileStem = safeFileStem(character, title, path.basename(originalFilename, requestedExtension));
  const projectPath = `data/visual_db/assets/${directoryName}/${fileStem}-${token}${requestedExtension}`;
  const notes = optionalString(input.notes, "notes", 4_000)
    || "Uploaded visual reference only; does not establish canon facts, ability mechanics, relationships, ranks, or timeline events.";
  const record = {
    visual_id: `VIS-UPLOAD-${token.toUpperCase()}`,
    created_at: now,
    character,
    category,
    title,
    canon_status: canonStatus,
    trust_level: "T7",
    source: "user_imported",
    path: projectPath,
    notes,
    description: optionalString(input.description, "description", 4_000),
    ability_state: optionalString(input.abilityState, "abilityState", 200) || "visual_only",
    tags: optionalStringArray(input.tags, "tags"),
  };
  const validation = validateVisualRecord(record);
  if (validation.errors.length > 0) {
    throw new Error(`Visual upload record is invalid: ${validation.errors.join("; ")}`);
  }

  return {
    buffer,
    filePath: resolveProjectPath(projectPath, "visual upload path"),
    record,
    warnings: validation.warnings,
  };
}

async function saveVisualUpload(input) {
  const dryRun = optionalBoolean(input.dryRun, "dryRun", false);
  const upload = buildVisualUpload(input);
  if (dryRun) {
    return {
      dryRun: true,
      record: upload.record,
      warnings: upload.warnings,
    };
  }

  const manifest = await enqueueVisualWrite(async () => {
    const existingIndex = await readOptionalText(visualIndexPath);
    const separator = existingIndex && !existingIndex.endsWith("\n") ? "\n" : "";
    return commitFileTransaction("visual-upload", [
      { type: "write", filePath: upload.filePath, content: upload.buffer },
      { type: "append", filePath: visualIndexPath, content: `${separator}${JSON.stringify(upload.record)}\n` },
    ], {
      visual_id: upload.record.visual_id,
      asset_path: upload.record.path,
    });
  });

  return {
    dryRun: false,
    record: upload.record,
    warnings: upload.warnings,
    transactionId: manifest.transaction_id,
  };
}

function visualIndexLines(text) {
  return text
    .split(/\r?\n/u)
    .map((raw) => raw.trim())
    .filter(Boolean);
}

function resolveDeletableVisualAsset(record) {
  const validation = validateVisualRecord(record);
  if (validation.errors.length > 0) {
    return { filePath: "", skipped: `record is invalid: ${validation.errors.join("; ")}` };
  }
  const extension = path.extname(record.path).toLowerCase();
  if (!allowedVisualImageExtensions.has(extension)) {
    return { filePath: "", skipped: "asset extension is not allowed." };
  }
  try {
    return {
      filePath: assertPathInside(record.path, visualAssetsDir, "visual delete asset"),
      skipped: "",
    };
  } catch (error) {
    return { filePath: "", skipped: error.message };
  }
}

async function deleteVisualReference(input) {
  const visualId = requireString(input.visualId, "visualId", 200);
  const confirmDelete = optionalBoolean(input.confirmDelete, "confirmDelete", false);
  if (!confirmDelete) {
    throw new Error("confirmDelete must be true to delete a visual reference.");
  }
  const deleteAsset = optionalBoolean(input.deleteAsset, "deleteAsset", true);

  return enqueueVisualWrite(async () => {
    const text = await readOptionalText(visualIndexPath);
    const keptLines = [];
    const matches = [];

    for (const [index, line] of visualIndexLines(text).entries()) {
      try {
        const record = JSON.parse(line);
        if (record?.visual_id === visualId) {
          matches.push({ lineNumber: index + 1, line, record });
          continue;
        }
      } catch {
        // Preserve invalid lines; the user can repair or remove them manually.
      }
      keptLines.push(line);
    }

    if (matches.length === 0) {
      const error = new Error(`Visual reference not found: ${visualId}`);
      error.statusCode = 404;
      throw error;
    }
    if (matches.length > 1) {
      throw new Error(`Visual reference id is duplicated and was not deleted: ${visualId}`);
    }

    const [match] = matches;
    const nextIndex = keptLines.length ? `${keptLines.join("\n")}\n` : "";
    const operations = [
      { type: "write", filePath: visualIndexPath, content: nextIndex },
    ];

    let assetDeleted = false;
    let assetDeleteSkipped = "";
    if (deleteAsset) {
      const asset = resolveDeletableVisualAsset(match.record);
      if (asset.filePath) {
        try {
          const assetStats = await stat(asset.filePath);
          if (assetStats.isFile()) {
            operations.push({ type: "delete", filePath: asset.filePath });
            assetDeleted = true;
          } else {
            assetDeleteSkipped = "asset path is not a file.";
          }
        } catch (error) {
          if (error.code === "ENOENT") {
            assetDeleteSkipped = "asset file is already missing.";
          } else {
            throw error;
          }
        }
      } else {
        assetDeleteSkipped = asset.skipped;
      }
    }

    const manifest = await commitFileTransaction("visual-delete", operations, {
      visual_id: visualId,
      asset_path: match.record.path,
      delete_asset: deleteAsset,
    });

    return {
      visualId,
      record: match.record,
      deletedLineNumber: match.lineNumber,
      assetDeleted,
      assetDeleteSkipped,
      transactionId: manifest.transaction_id,
    };
  });
}

function pushValue(argv, flag, value) {
  if (value) argv.push(flag, value);
}

function pushFlag(argv, flag, enabled) {
  if (enabled) argv.push(flag);
}

const actionBuilders = {
  buildContext: () => ({
    tool: "build-current-prompt.mjs",
    argv: [],
    timeout: 180_000,
  }),
  pipeline: (input) => {
    const query = requireString(input.query, "query", 10_000);
    const task = requireString(input.task, "task", 100_000);
    const mode = enumValue(
      input.mode,
      "mode",
      ["next-chapter", "proofread", "settle", "debug"],
      "next-chapter",
    );
    const top = optionalInteger(input.top, "top", 12, 1, 100);
    return {
      tool: "run-pipeline.mjs",
      argv: ["--query", query, "--task", task, "--mode", mode, "--top", String(top)],
      timeout: 240_000,
    };
  },
  search: (input) => {
    const query = requireString(input.query, "query", 10_000);
    const top = optionalInteger(input.top, "top", 12, 1, 100);
    return {
      tool: "search-context.mjs",
      argv: [query, "--top", String(top)],
      timeout: 120_000,
    };
  },
  buildTask: (input) => {
    const task = requireString(input.task, "task", 100_000);
    const mode = enumValue(
      input.mode,
      "mode",
      ["next-chapter", "proofread", "settle", "debug"],
      "next-chapter",
    );
    return {
      tool: "build-task-prompt.mjs",
      argv: ["--mode", mode, "--task", task],
      timeout: 120_000,
    };
  },
  saveDraft: (input) => {
    const title = requireString(input.title, "title", 500);
    const text = requireString(input.text, "text", 1_000_000);
    const argv = ["--title", title, "--text", text];
    pushValue(argv, "--chapter", optionalString(input.chapter, "chapter", 500));
    pushValue(argv, "--task-type", optionalString(input.taskType, "taskType", 200));
    pushFlag(argv, "--dry-run", optionalBoolean(input.dryRun, "dryRun", true));
    return { tool: "save-draft.mjs", argv, timeout: 120_000 };
  },
  saveProof: (input) => {
    const title = requireString(input.title, "title", 500);
    const text = requireString(input.text, "text", 1_000_000);
    const verdict = enumValue(
      input.verdict,
      "verdict",
      ["pass", "needs_rewrite", "reject", "stop"],
      "needs_rewrite",
    );
    const severity = enumValue(
      input.severity,
      "severity",
      ["P0", "P1", "P2", "P3", "P4"],
      "P2",
    );
    const argv = [
      "--title",
      title,
      "--text",
      text,
      "--verdict",
      verdict,
      "--severity",
      severity,
    ];
    pushValue(argv, "--chapter", optionalString(input.chapter, "chapter", 500));
    pushValue(argv, "--draft-id", optionalString(input.draftId, "draftId", 500));
    pushFlag(argv, "--dry-run", optionalBoolean(input.dryRun, "dryRun", true));
    return { tool: "save-proof-report.mjs", argv, timeout: 120_000 };
  },
  addFeedback: (input) => {
    const type = enumValue(
      input.type,
      "type",
      ["accepted", "rejected", "revision", "preference"],
      "rejected",
    );
    const feedback = requireString(input.feedback, "feedback", 100_000);
    const argv = ["--type", type, "--feedback", feedback];
    pushValue(argv, "--chapter", optionalString(input.chapter, "chapter", 500));
    pushValue(argv, "--characters", optionalString(input.characters, "characters", 2_000));
    pushValue(argv, "--scene-type", optionalString(input.sceneType, "sceneType", 2_000));
    pushValue(argv, "--severity", optionalString(input.severity, "severity", 10));
    pushValue(argv, "--category", optionalString(input.category, "category", 500));
    pushFlag(argv, "--no-candidate", optionalBoolean(input.noCandidate, "noCandidate"));
    pushFlag(argv, "--dry-run", optionalBoolean(input.dryRun, "dryRun", true));
    return { tool: "add-feedback.mjs", argv, timeout: 120_000 };
  },
  sourceTrust: () => ({
    tool: "source-trust-checker.mjs",
    argv: ["--json"],
    timeout: 60_000,
  }),
  validate: () => ({
    file: path.join(rootDir, "tests", "run-all.mjs"),
    argv: [],
    timeout: 600_000,
  }),
};

function runNode({ tool, file, argv, timeout }) {
  const target = file ?? path.join(toolsDir, tool);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [target, ...argv], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    activeChildren.add(child);
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`Action timed out after ${Math.round(timeout / 1000)} seconds.`));
    }, timeout);

    const capture = (targetName, chunk) => {
      if (settled) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maxToolOutputBytes) {
        settled = true;
        clearTimeout(timer);
        terminateProcessTree(child);
        reject(new Error("Tool output exceeded the UI capture limit."));
        return;
      }
      if (targetName === "stdout") stdout += chunk;
      else stderr += chunk;
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => capture("stdout", chunk));
    child.stderr.on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      activeChildren.delete(child);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
      });
    });
  });
}

async function parseBody(request, maxBytes = maxJsonBodyBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON body must be an object.");
  }
  return value;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendError(response, statusCode, error) {
  sendJson(response, statusCode, {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

function assertSameOrigin(request, message = "Cross-origin requests are not allowed.") {
  const origin = request.headers.origin;
  if (origin && new URL(origin).host !== request.headers.host) {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
}

function decodeApiId(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${label} is not valid URL encoding.`);
  }
}

async function agentRunDetails(runId) {
  const run = await getAgentRun(runId);
  const usage = await summarizeNeuralUsageForRun(runId);
  return { ...run, neural_usage: usage };
}

function isReadableProjectPath(projectPath) {
  if (readableExactPaths.has(projectPath)) return true;
  return readableDirectoryPaths.some(
    (directory) => projectPath === directory || projectPath.startsWith(`${directory}/`),
  );
}

async function serveProjectFile(response, projectPath) {
  let canonicalPath;
  try {
    canonicalPath = canonicalProjectPath(projectPath);
  } catch (error) {
    sendError(response, 403, error);
    return;
  }
  if (!isReadableProjectPath(canonicalPath)) {
    sendError(response, 403, new Error("File is outside the UI read allowlist."));
    return;
  }
  const filePath = resolveProjectPath(canonicalPath);
  const text = await readFile(filePath, "utf8");
  sendJson(response, 200, {
    ok: true,
    file: {
      path: canonicalPath,
      text,
      bytes: Buffer.byteLength(text),
    },
  });
}

function decodeAssetPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Visual asset path is not valid URL encoding.");
  }
}

const servedVisualImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function serveVisualAsset(response, projectPath) {
  let canonicalPath;
  try {
    canonicalPath = canonicalProjectPath(projectPath);
  } catch (error) {
    sendError(response, 403, error);
    return;
  }
  if (!canonicalPath.startsWith("data/visual_db/assets/")) {
    sendError(response, 403, new Error("Visual asset must stay under data/visual_db/assets/."));
    return;
  }
  let filePath;
  try {
    filePath = assertPathInside(
      canonicalPath,
      visualAssetsDir,
      "visual asset",
    );
  } catch (error) {
    sendError(response, 403, error);
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (!servedVisualImageExtensions.has(extension)) {
    sendError(response, 403, new Error("Visual asset type is not allowed."));
    return;
  }

  let stats;
  try {
    stats = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendError(response, 404, new Error("Visual asset not found."));
      return;
    }
    throw error;
  }
  if (!stats.isFile()) {
    sendError(response, 404, new Error("Visual asset not found."));
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(uiDir, relative);
  const pathInsideUi = path.relative(uiDir, filePath);
  if (pathInsideUi.startsWith("..") || path.isAbsolute(pathInsideUi)) {
    sendError(response, 403, new Error("Invalid static path."));
    return;
  }
  const stats = await stat(filePath);
  if (!stats.isFile()) throw new Error("Static path is not a file.");
  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  createReadStream(filePath).pipe(response);
}

async function handleRequest(request, response) {
  const rawPathname = (request.url ?? "/").split(/[?#]/u)[0];
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      name: "armed-academy-workbench",
      time: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, { ok: true, state: await statePayload() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/writer-workbench/state") {
    try {
      sendJson(response, 200, { ok: true, state: await buildWriterWorkbenchState() });
      return;
      const active = await activeEngineStatus();
      const [bundles, candidates, proofs, adopted, settlements, pending, approvals] = await Promise.all([
        listGptWritingContextBundles({ limit: 1 }),
        listWritingCandidates({ limit: 1 }),
        listProofReports({ limit: 1 }),
        listAdoptedChapters(),
        listSettlementReports({ limit: 1 }),
        listPendingCandidates(),
        listApprovalItems(),
      ]);
      // Build a workflow status mapper according to Phase 9B rules. This is read-only.
      function step(key, label, status, extras = {}) {
        return { key, label, status, entity_id: extras.entity_id ?? null, summary: extras.summary ?? null, blocked_reason: extras.blocked_reason ?? null, next_action: extras.next_action ?? null, requires_approval: !!extras.requires_approval, risk_level: extras.risk_level ?? "low", modifies_active_engine: !!extras.modifies_active_engine };
      }

      const latest = {
        writing_context_bundle: bundles[0] ?? null,
        writing_candidate: candidates[0] ?? null,
        proof_report: proofs[0] ?? null,
        adoption_request: approvals.find((a) => a.action_type === 'adopt_writing_candidate') ?? null,
        adopted_writing: adopted[0] ?? null,
        settlement_report: settlements[0] ?? null,
        pending_engine_candidate: pending[0] ?? null,
        engine_candidate_review: null,
        activation_request: approvals.find((a) => a.action_type === 'activate_engine_candidate') ?? null,
      };
      const approvalStatus = (item) => item?.status?.status ?? item?.status ?? null;

      // Derive statuses for each workflow step
      const steps = [];

      // writing_context
      if (!latest.writing_context_bundle) {
        steps.push(step("writing_context", "Writing Context", "missing", { next_action: "build_writing_context", safety_note: "Does not generate text or modify active_engine." }));
      } else {
        steps.push(step("writing_context", "Writing Context", "completed", { entity_id: latest.writing_context_bundle.bundle_id ?? null }));
      }

      // chat_output_candidate
      if (!latest.writing_candidate) {
        steps.push(step("chat_output_candidate", "Chat Output Candidate", "missing", { next_action: "save_chat_output_candidate" }));
      } else {
        steps.push(step("chat_output_candidate", "Chat Output Candidate", "completed", { entity_id: latest.writing_candidate.candidate_id ?? null }));
      }

      // proof_report
      if (!latest.writing_candidate) {
        steps.push(step("proof_report", "Proof Report", "blocked", { blocked_reason: "尚未保存正文候選，請先保存候選稿。", resolution_hint: "先貼上 GPT 聊天欄正文並保存候選稿。" }));
      } else if (!latest.proof_report) {
        steps.push(step("proof_report", "Proof Report", "missing", { next_action: "save_proof_report" }));
      } else if (latest.proof_report.status === "blocked") {
        steps.push(step("proof_report", "Proof Report", "blocked", { blocked_reason: "驗稿報告為 blocked。", resolution_hint: "請修正驗稿內容並保存新的 proof report。" }));
      } else {
        steps.push(step("proof_report", "Proof Report", "completed", { entity_id: latest.proof_report.proof_id ?? null }));
      }

      // adoption_request
      const adoptionApproval = latest.adoption_request;
      if (!latest.proof_report) {
        steps.push(step("adoption_request", "Adoption Request", "blocked", { blocked_reason: "候選稿尚未驗稿，請先建立 proof report。" }));
      } else if (!adoptionApproval) {
        steps.push(step("adoption_request", "Adoption Request", "ready", { next_action: "request_adoption", requires_approval: true }));
      } else if (approvalStatus(adoptionApproval) === "pending") {
        steps.push(step("adoption_request", "Adoption Request", "pending_approval", { entity_id: adoptionApproval.item_id ?? null }));
      } else if (approvalStatus(adoptionApproval) === "confirmed") {
        steps.push(step("adoption_request", "Adoption Request", "confirmed", { entity_id: adoptionApproval.item_id ?? null }));
      } else if (approvalStatus(adoptionApproval) === "rejected") {
        steps.push(step("adoption_request", "Adoption Request", "rejected", { entity_id: adoptionApproval.item_id ?? null }));
      } else {
        steps.push(step("adoption_request", "Adoption Request", "deferred", { entity_id: adoptionApproval.item_id ?? null }));
      }

      // adopted_writing
      if (!latest.adopted_writing) {
        // If adoption request not confirmed, blocked
        if (!adoptionApproval || approvalStatus(adoptionApproval) !== "confirmed") {
          steps.push(step("adopted_writing", "Adopted Writing", "blocked", { blocked_reason: "採用尚未確認，請在 Approval Queue 完成採用。" }));
        } else {
          steps.push(step("adopted_writing", "Adopted Writing", "blocked", { blocked_reason: "採用已確認，但尚未建立 adopted writing。" }));
        }
      } else {
        steps.push(step("adopted_writing", "Adopted Writing", "completed", { entity_id: latest.adopted_writing.chapter_id ?? null }));
      }

      // settlement_context
      if (!latest.adopted_writing) {
        steps.push(step("settlement_context", "Settlement Context", "blocked", { blocked_reason: "尚未建立 adopted writing，無法建立章節結算。" }));
      } else if (!latest.settlement_report) {
        steps.push(step("settlement_context", "Settlement Context", "ready", { next_action: "build_settlement_context" }));
      } else {
        steps.push(step("settlement_context", "Settlement Context", "completed", { entity_id: latest.settlement_report.settlement_id ?? null }));
      }

      // settlement_report
      if (!latest.adopted_writing) {
        steps.push(step("settlement_report", "Settlement Report", "blocked", { blocked_reason: "章節結算尚未開始。" }));
      } else if (!latest.settlement_report) {
        steps.push(step("settlement_report", "Settlement Report", "ready", { next_action: "save_settlement_report" }));
      } else {
        steps.push(step("settlement_report", "Settlement Report", "completed", { entity_id: latest.settlement_report.report_id ?? null }));
      }

      // pending_engine_candidate
      if (!latest.settlement_report) {
        steps.push(step("pending_engine_candidate", "Pending Engine Candidate", "blocked", { blocked_reason: "尚未保存 settlement report，無法建立 pending engine candidate。" }));
      } else if (!latest.pending_engine_candidate) {
        steps.push(step("pending_engine_candidate", "Pending Engine Candidate", "ready", { next_action: "create_pending_engine_candidate" }));
      } else if (latest.pending_engine_candidate.status === "pending_review") {
        steps.push(step("pending_engine_candidate", "Pending Engine Candidate", "completed", { entity_id: latest.pending_engine_candidate.candidate_id ?? null }));
      } else if (latest.pending_engine_candidate.status === "activated") {
        steps.push(step("pending_engine_candidate", "Pending Engine Candidate", "completed", { entity_id: latest.pending_engine_candidate.candidate_id ?? null }));
      } else {
        steps.push(step("pending_engine_candidate", "Pending Engine Candidate", "ready", { entity_id: latest.pending_engine_candidate.candidate_id ?? null }));
      }

      // engine_candidate_review
      // For now engine_candidate_review is not constructed by services; we inspect pending candidate
      if (!latest.pending_engine_candidate) {
        steps.push(step("engine_candidate_review", "Engine Candidate Review", "blocked", { blocked_reason: "尚未建立 pending engine candidate。" }));
      } else {
        // check base_hash_mismatch if available on pending candidate
        const baseHashMismatch = !!latest.pending_engine_candidate.base_hash_mismatch;
        if (baseHashMismatch) {
          steps.push(step("engine_candidate_review", "Engine Candidate Review", "blocked", { blocked_reason: "pending engine candidate 的 base hash 與 active_engine 不一致。", resolution_hint: "請重新 review 或人工處理。", risk_level: "high" }));
        } else {
          steps.push(step("engine_candidate_review", "Engine Candidate Review", "completed", { entity_id: latest.pending_engine_candidate.candidate_id ?? null }));
        }
      }

      // activation_request
      const activationApproval = latest.activation_request;
      if (!latest.pending_engine_candidate) {
        steps.push(step("activation_request", "Activation Request", "blocked", { blocked_reason: "尚未建立 pending engine candidate。" }));
      } else if (activationApproval && approvalStatus(activationApproval) === "pending") {
        steps.push(step("activation_request", "Activation Request", "pending_approval", { entity_id: activationApproval.item_id ?? null, requires_approval: true }));
      } else if (activationApproval && approvalStatus(activationApproval) === "confirmed") {
        steps.push(step("activation_request", "Activation Request", "confirmed", { entity_id: activationApproval.item_id ?? null }));
      } else if (activationApproval && approvalStatus(activationApproval) === "rejected") {
        steps.push(step("activation_request", "Activation Request", "rejected", { entity_id: activationApproval.item_id ?? null }));
      } else {
        steps.push(step("activation_request", "Activation Request", "ready", { next_action: "request_activation", requires_approval: true }));
      }

      // activation_confirm
      const activationLogs = await listActivationLogs();
      if (activationLogs.length > 0) {
        steps.push(step("activation_confirm", "Activation Confirm", "completed", { entity_id: activationLogs[0].log_id ?? null }));
      } else if (activationApproval && approvalStatus(activationApproval) === "pending") {
        steps.push(step("activation_confirm", "Activation Confirm", "pending_approval", { blocked_reason: "Activation request pending approval." }));
      } else {
        steps.push(step("activation_confirm", "Activation Confirm", "blocked", { blocked_reason: "尚未有 activation request confirmed。" }));
      }

      // top-level blocked summary
      const blockedEntry = steps.find((s) => s.status === "blocked");
      const isBlocked = !!blockedEntry;

      // next_actions suggested list
      const next_actions = [
        { key: "build_writing_context", label: "Build GPT Writing Context", enabled: !latest.writing_context_bundle, requires_approval: false, risk_level: "low", endpoint: "/api/writer-workbench/build-writing-context" },
        { key: "save_chat_output_candidate", label: "Save Chat Output Candidate", enabled: !!latest.writing_candidate === false, requires_approval: false, risk_level: "low", endpoint: "/api/writer-workbench/save-chat-output-candidate" },
        { key: "save_proof_report", label: "Save Proof Report", enabled: !!latest.writing_candidate && !latest.proof_report, requires_approval: false, risk_level: "low", endpoint: "/api/writer-workbench/save-proof-report" },
        { key: "request_adoption", label: "Request Adoption", enabled: !!latest.proof_report && !adoptionApproval, requires_approval: true, risk_level: "medium", endpoint: "/api/writer-workbench/request-adoption" },
        { key: "go_to_approval_queue", label: "Go to Approval Queue", enabled: approvals.length > 0, requires_approval: false, risk_level: "low", endpoint: "#approval" },
      ];

      // risk summary
      const risk = {
        base_hash_mismatch: !!(latest.pending_engine_candidate && latest.pending_engine_candidate.base_hash_mismatch),
        pending_engine_candidate_risk: latest.pending_engine_candidate?.risk_level ?? null,
        activation_requires_approval: true,
        direct_activation_allowed: false,
      };

      sendJson(response, 200, {
        ok: true,
        state: {
          active_engine: active,
          workflow: {
            current_step: steps.find((s) => s.status === "in_progress")?.key ?? steps.find((s) => s.status === "missing")?.key ?? "writing_context",
            overall_status: isBlocked ? "blocked" : "idle",
            steps,
          },
          blocked: {
            is_blocked: isBlocked,
            blocked_step: blockedEntry?.key ?? null,
            reason: blockedEntry?.blocked_reason ?? null,
            resolution_hint: blockedEntry?.resolution_hint ?? null,
          },
          next_actions,
          risk,
          approval_queue: {
            pending_count: approvals.length,
            items: approvals,
          },
          safety: {
            local_generation_allowed: false,
            direct_activation_allowed: false,
            approval_required_for_adoption: true,
            approval_required_for_activation: true,
            rollback_requires_approval: true,
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      sendError(response, 500, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/canon-settings") {
    try {
      sendJson(response, 200, { ok: true, catalog: await buildCanonSettingsCatalog() });
    } catch (error) {
      sendError(response, error.statusCode ?? 500, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/setting-change-proposals") {
    try {
      sendJson(response, 200, {
        ok: true,
        proposals: await listSettingChangeProposals({
          setting_type: url.searchParams.get("setting_type") ?? "",
        }),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 500, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/setting-change-proposals") {
    try {
      assertSameOrigin(request, "Cross-origin setting proposals are not allowed.");
      const result = await createSettingChangeProposal(await parseBody(request));
      sendJson(response, 201, { ok: true, ...result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const settingProposalMatch = rawPathname.match(
    /^\/api\/setting-change-proposals\/([^/]+)$/u,
  );
  if (request.method === "GET" && settingProposalMatch) {
    try {
      sendJson(response, 200, {
        ok: true,
        proposal: await getSettingChangeProposal(
          decodeApiId(settingProposalMatch[1], "proposal_id"),
        ),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 404, error);
    }
    return;
  }

  if (
    request.method === "GET"
    && url.pathname === "/api/writer-workbench/feedback-learning-state"
  ) {
    try {
      const [
        items,
        digests,
        ruleCandidates,
        proposals,
        applications,
        approvals,
      ] = await Promise.all([
        listFeedbackItems({ limit: 10 }),
        listFeedbackDigests({ limit: 10 }),
        listRuleCandidates({ limit: 10 }),
        listCompressedRuleUpdateProposals({ limit: 10 }),
        listCompressedRuleApplications({ limit: 10 }),
        listApprovalItems(),
      ]);
      const pendingApprovals = approvals.filter((item) => (
        item.action_type === "compressed_rule_update"
        && ["pending", "deferred", "blocked"].includes(item.status?.status)
      ));
      const blocked = pendingApprovals
        .filter((item) => item.status?.status === "blocked" || item.blocked_reason)
        .map((item) => ({
          approval_id: item.approval_item_id,
          reason: item.blocked_reason ?? item.status?.reason ?? "Approval is blocked.",
        }));
      const nextActions = pendingApprovals.length
        ? [{
          key: "go_to_approval_queue",
          label: "Review pending compressed rule updates in Approval Queue",
          target: "#approval",
          pending_count: pendingApprovals.length,
        }]
        : [{
          key: "no_pending_compressed_rule_updates",
          label: "No pending compressed rule update approvals",
          target: null,
          pending_count: 0,
        }];
      sendJson(response, 200, {
        ok: true,
        feedback_learning: {
          items,
          digests,
          rule_candidates: ruleCandidates,
          compressed_rule_proposals: proposals,
          compressed_rule_applications: applications,
          pending_approvals: pendingApprovals,
          blocked,
          next_actions: nextActions,
          risk: {
            can_apply_from_this_panel: false,
            requires_approval_queue: true,
            modifies_active_engine: false,
            modifies_compressed_rules_from_ui: false,
          },
        },
      });
    } catch {
      sendJson(response, 500, {
        ok: false,
        error: "Unable to read feedback learning state.",
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/cleanup/scan") {
    try {
      assertSameOrigin(request, "Cross-origin cleanup scans are not allowed.");
      const input = await parseBody(request);
      const scan = await scanCleanupCandidates({
        retentionPolicy: input.retentionPolicy ?? input.retention_policy,
        actor: input.actor ?? "local_user",
      });
      sendJson(response, 200, { ok: true, scan });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/cleanup/proposals") {
    try {
      assertSameOrigin(request, "Cross-origin cleanup proposal creation is not allowed.");
      const input = await parseBody(request);
      const proposal = await createCleanupProposal({
        title: input.title,
        summary: input.summary,
        createdBy: input.createdBy ?? input.created_by ?? "local_ui",
        retentionPolicy: input.retentionPolicy ?? input.retention_policy,
      });
      sendJson(response, 201, { ok: true, proposal });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cleanup/proposals") {
    sendJson(response, 200, { ok: true, proposals: await listCleanupProposals() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cleanup/logs") {
    sendJson(response, 200, { ok: true, logs: await listCleanupLogs() });
    return;
  }

  const cleanupActionMatch = rawPathname.match(
    /^\/api\/cleanup\/proposals\/([^/]+)\/(approve|reject|defer|execute)$/u,
  );
  if (request.method === "POST" && cleanupActionMatch) {
    try {
      assertSameOrigin(request, "Cross-origin cleanup actions are not allowed.");
      const cleanupProposalId = assertCleanupProposalId(
        decodeApiId(cleanupActionMatch[1], "cleanup_proposal_id"),
      );
      const action = cleanupActionMatch[2];
      const input = await parseBody(request);
      let result;
      if (action === "approve") {
        result = await approveCleanupProposal(cleanupProposalId, {
          confirm: input.confirm === true,
          approvedBy: input.approvedBy ?? input.approved_by ?? "local_user",
        });
      } else if (action === "execute") {
        result = await executeCleanupProposal(cleanupProposalId, {
          confirm: input.confirm === true,
          approvedBy: input.approvedBy ?? input.approved_by ?? "local_user",
        });
      } else if (action === "reject") {
        result = await rejectCleanupProposal(cleanupProposalId, {
          reason: input.reason ?? "",
        });
      } else {
        result = await deferCleanupProposal(cleanupProposalId, {
          reason: input.reason ?? "",
        });
      }
      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const cleanupDetailMatch = rawPathname.match(/^\/api\/cleanup\/proposals\/([^/]+)$/u);
  if (request.method === "GET" && cleanupDetailMatch) {
    try {
      const cleanupProposalId = assertCleanupProposalId(
        decodeApiId(cleanupDetailMatch[1], "cleanup_proposal_id"),
      );
      sendJson(response, 200, {
        ok: true,
        proposal: await getCleanupProposal(cleanupProposalId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/approval-queue/scan") {
    try {
      assertSameOrigin(request, "Cross-origin approval queue scans are not allowed.");
      const input = await parseBody(request);
      const scan = await scanApprovalQueue();
      let rollbackItem = null;
      const snapshotId = input.snapshotId ?? input.snapshot_id ?? "";
      if (snapshotId) rollbackItem = await createRollbackApprovalItem(snapshotId);
      sendJson(response, 200, { ok: true, scan, rollback_item: rollbackItem });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/approval-queue/rollback-request") {
    try {
      assertSameOrigin(request, "Cross-origin rollback requests are not allowed.");
      const input = await parseBody(request);
      const snapshotId = assertSnapshotId(input.snapshotId ?? input.snapshot_id);
      const item = await createRollbackApprovalItem(snapshotId);
      sendJson(response, 201, { ok: true, approval_item: item });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/approval-queue/items") {
    sendJson(response, 200, { ok: true, items: await listApprovalItems() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/approval-queue/logs") {
    sendJson(response, 200, { ok: true, logs: await listApprovalLogs() });
    return;
  }

  const approvalActionMatch = rawPathname.match(
    /^\/api\/approval-queue\/items\/([^/]+)\/(confirm|reject|defer|refresh)$/u,
  );
  if (request.method === "POST" && approvalActionMatch) {
    try {
      assertSameOrigin(request, "Cross-origin approval actions are not allowed.");
      const approvalItemId = assertApprovalItemId(
        decodeApiId(approvalActionMatch[1], "approval_item_id"),
      );
      const action = approvalActionMatch[2];
      const input = await parseBody(request);
      let result;
      if (action === "confirm") {
        result = await confirmApprovalItem(approvalItemId, {
          confirm: input.confirm === true,
          secondConfirm: input.secondConfirm === true || input.second_confirm === true,
          approvalText: input.approvalText ?? input.approval_text ?? "",
          approvedBy: input.approvedBy ?? input.approved_by ?? "local_user",
        });
      } else if (action === "reject") {
        result = await rejectApprovalItem(approvalItemId, { reason: input.reason ?? "" });
      } else if (action === "defer") {
        result = await deferApprovalItem(approvalItemId, { reason: input.reason ?? "" });
      } else {
        result = await refreshApprovalItem(approvalItemId);
      }
      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const approvalDetailMatch = rawPathname.match(
    /^\/api\/approval-queue\/items\/([^/]+)$/u,
  );
  if (request.method === "GET" && approvalDetailMatch) {
    try {
      const approvalItemId = assertApprovalItemId(
        decodeApiId(approvalDetailMatch[1], "approval_item_id"),
      );
      sendJson(response, 200, {
        ok: true,
        item: await getApprovalItem(approvalItemId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/draft-tasks") {
    try {
      assertSameOrigin(request, "Cross-origin draft task creation is not allowed.");
      const input = await parseBody(request);
      const result = await createDraftTask({
        sourceChapter: input.sourceChapter ?? input.source_chapter,
        task: input.task,
        requiresNeuralModules: input.requiresNeuralModules ?? input.requires_neural_modules,
        requiredNeuralModules: input.requiredNeuralModules ?? input.required_neural_modules,
      });
      sendJson(response, 201, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/context-bundles/draft") {
    try {
      assertSameOrigin(request, "Cross-origin context bundle creation is not allowed.");
      const input = await parseBody(request);
      const result = await buildDraftContextBundle({
        sourceChapter: input.sourceChapter ?? input.source_chapter,
        task: input.task,
      });
      sendJson(response, 201, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/context-bundles/proofing") {
    try {
      assertSameOrigin(request, "Cross-origin proofing context creation is not allowed.");
      const input = await parseBody(request);
      const draftId = assertDraftId(input.draftId ?? input.draft_id);
      const result = await buildProofingContextBundle(draftId, input);
      sendJson(response, 201, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/workflow/candidate-drafts") {
    sendJson(response, 200, { ok: true, drafts: await listCandidateDrafts() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/candidate-drafts") {
    try {
      assertSameOrigin(request, "Cross-origin candidate draft creation is not allowed.");
      const input = await parseBody(request);
      const draft = await saveCandidateDraft({
        draftText: input.draftText ?? input.draft_text,
        sourceChapter: input.sourceChapter ?? input.source_chapter,
        note: input.note,
        runId: input.runId ?? input.run_id,
        contextBundleId: input.contextBundleId ?? input.context_bundle_id,
        neuralModulesUsedPath: input.neuralModulesUsedPath ?? input.neural_modules_used_path,
      });
      sendJson(response, 201, { ok: true, draft });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const draftActionMatch = rawPathname.match(
    /^\/api\/workflow\/candidate-drafts\/([^/]+)\/(send-to-proofing|adopt|reject|archive)$/u,
  );
  if (request.method === "POST" && draftActionMatch) {
    try {
      assertSameOrigin(request, "Cross-origin draft actions are not allowed.");
      const draftId = assertDraftId(decodeApiId(draftActionMatch[1], "draft_id"));
      const action = draftActionMatch[2];
      const input = await parseBody(request);
      let result;
      if (action === "send-to-proofing") {
        result = await sendDraftToProofing(draftId, {
          requiresNeuralModules: input.requiresNeuralModules ?? input.requires_neural_modules,
          requiredNeuralModules: input.requiredNeuralModules ?? input.required_neural_modules,
        });
      } else if (action === "adopt") {
        result = await adoptCandidateDraft(draftId, {
          confirm: input.confirm === true,
          adoptedBy: input.adoptedBy ?? input.adopted_by ?? "local_user",
          note: input.note ?? "",
        });
      } else if (action === "reject") {
        result = await rejectCandidateDraft(draftId, { reason: input.reason ?? "" });
      } else {
        result = await archiveCandidateDraft(draftId, { reason: input.reason ?? "" });
      }
      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const draftDetailMatch = rawPathname.match(/^\/api\/workflow\/candidate-drafts\/([^/]+)$/u);
  if (request.method === "GET" && draftDetailMatch) {
    try {
      const draftId = assertDraftId(decodeApiId(draftDetailMatch[1], "draft_id"));
      sendJson(response, 200, { ok: true, draft: await getCandidateDraft(draftId) });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/workflow/proof-reports") {
    sendJson(response, 200, { ok: true, proof_reports: await listProofReports() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/proof-reports") {
    try {
      assertSameOrigin(request, "Cross-origin proof report creation is not allowed.");
      const input = await parseBody(request);
      const proofReport = await saveProofReport({
        draftId: input.draftId ?? input.draft_id,
        proofText: input.proofText ?? input.proof_text,
        runId: input.runId ?? input.run_id,
        contextBundleId: input.contextBundleId ?? input.context_bundle_id,
        neuralModulesUsedPath: input.neuralModulesUsedPath ?? input.neural_modules_used_path,
      });
      sendJson(response, 201, { ok: true, proof_report: proofReport });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const proofDetailMatch = rawPathname.match(/^\/api\/workflow\/proof-reports\/([^/]+)$/u);
  if (request.method === "GET" && proofDetailMatch) {
    try {
      const proofId = assertProofId(decodeApiId(proofDetailMatch[1], "proof_id"));
      sendJson(response, 200, { ok: true, proof_report: await getProofReport(proofId) });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/workflow/adopted-chapters") {
    sendJson(response, 200, { ok: true, adopted_chapters: await listAdoptedChapters() });
    return;
  }

  const settlementContextCreateMatch = rawPathname.match(
    /^\/api\/workflow\/adopted-chapters\/([^/]+)\/settlement-context$/u,
  );
  if (request.method === "POST" && settlementContextCreateMatch) {
    try {
      assertSameOrigin(request, "Cross-origin settlement context creation is not allowed.");
      const adoptedChapterId = assertAdoptedChapterId(
        decodeApiId(settlementContextCreateMatch[1], "adopted_chapter_id"),
      );
      const input = await parseBody(request);
      const settlementContext = await buildSettlementContext(adoptedChapterId, {
        runId: input.runId ?? input.run_id ?? "",
        note: input.note ?? "",
      });
      sendJson(response, 201, { ok: true, settlement_context: settlementContext });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/workflow/settlement-contexts") {
    sendJson(response, 200, {
      ok: true,
      settlement_contexts: await listSettlementContexts(),
    });
    return;
  }

  const settlementContextDetailMatch = rawPathname.match(
    /^\/api\/workflow\/settlement-contexts\/([^/]+)$/u,
  );
  if (request.method === "GET" && settlementContextDetailMatch) {
    try {
      const settlementContextId = assertSettlementContextId(
        decodeApiId(settlementContextDetailMatch[1], "settlement_context_id"),
      );
      sendJson(response, 200, {
        ok: true,
        settlement_context: await getSettlementContext(settlementContextId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/workflow/settlement-reports") {
    sendJson(response, 200, {
      ok: true,
      settlement_reports: await listSettlementReports(),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/workflow/settlement-reports") {
    try {
      assertSameOrigin(request, "Cross-origin settlement report creation is not allowed.");
      const input = await parseBody(request);
      const settlementReport = await saveSettlementReport({
        settlementContextId: input.settlementContextId ?? input.settlement_context_id,
        settlementText: input.settlementText ?? input.settlement_text,
        sourceChapter: input.sourceChapter ?? input.source_chapter,
        runId: input.runId ?? input.run_id,
        neuralModulesUsedPath: input.neuralModulesUsedPath ?? input.neural_modules_used_path,
        note: input.note,
      });
      sendJson(response, 201, { ok: true, settlement_report: settlementReport });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/build-writing-context") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const bundle = await buildGptWritingContext({
        taskPrompt: input.taskPrompt ?? input.task_prompt,
        includeActiveEngine: input.includeActiveEngine ?? input.include_active_engine ?? false,
        includeWritingCard: input.includeWritingCard ?? input.include_writing_card ?? false,
        includeProofingCard: input.includeProofingCard ?? input.include_proofing_card ?? false,
        includeLongline: input.includeLongline ?? input.include_longline ?? false,
      });
      sendJson(response, 201, { ok: true, bundle });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/save-chat-output-candidate") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const candidate = await saveChatOutputAsWritingCandidate({
        sourceBundleId: input.sourceBundleId ?? input.source_bundle_id,
        chatOutputText: input.chatOutputText ?? input.chat_output_text,
        title: input.title,
        chapterLabel: input.chapterLabel ?? input.chapter_label,
      });
      sendJson(response, 201, { ok: true, candidate });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/build-proofing-context") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const context = await buildCandidateProofingContext({
        candidateId: input.candidateId ?? input.candidate_id,
      });
      sendJson(response, 201, { ok: true, context });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/save-proof-report") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const report = await saveChatOutputAsProofReport({
        candidateId: input.candidateId ?? input.candidate_id,
        proofingContextId: input.proofingContextId ?? input.proofing_context_id,
        proofReportText: input.proofReportText ?? input.proof_report_text,
        verdict: input.verdict,
        severity: input.severity,
      });
      sendJson(response, 201, { ok: true, report });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/request-adoption") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const requestItem = await requestWritingCandidateAdoption({
        candidateId: input.candidateId ?? input.candidate_id,
        proofReportId: input.proofReportId ?? input.proof_report_id,
        reason: input.reason ?? input.note ?? "writer workbench",
      });
      sendJson(response, 201, { ok: true, request: requestItem });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/build-settlement-context") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const context = await buildAdoptedWritingSettlementContext({
        adopted_chapter_id: input.adoptedChapterId ?? input.adopted_chapter_id,
      });
      sendJson(response, 201, { ok: true, context });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/save-settlement-report") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const report = await saveChatOutputAsSettlementReport({
        adopted_chapter_id: input.adoptedChapterId ?? input.adopted_chapter_id,
        settlement_context_id: input.settlementContextId ?? input.settlement_context_id,
        settlement_report_text: input.settlementReportText ?? input.settlement_report_text,
      });
      // attempt to build pending candidate
      let pending = null;
      try {
        pending = await buildPendingEngineCandidateFromSettlementReport({
          settlement_report_id: report.settlement_report_id,
        });
      } catch (e) {
        // ignore; caller can query later
      }
      sendJson(response, 201, { ok: true, report, pending });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/build-engine-candidate-review") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const review = await buildPendingEngineCandidateReview({
        pendingEngineCandidateId: input.pendingEngineCandidateId ?? input.pending_engine_candidate_id,
        reviewMode: input.reviewMode ?? input.review_mode ?? "summary_only",
      });
      sendJson(response, 201, { ok: true, review });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/writer-workbench/request-activation") {
    try {
      assertSameOrigin(request, "Cross-origin writer workbench actions are not allowed.");
      const input = await parseBody(request);
      const requestItem = await requestPendingEngineCandidateActivation({
        pendingEngineCandidateId: input.pendingEngineCandidateId ?? input.pending_engine_candidate_id,
        reviewId: input.reviewId ?? input.review_id,
        reason: input.reason ?? "writer workbench activation",
      });
      sendJson(response, 201, { ok: true, request: requestItem });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const settlementReportActionMatch = rawPathname.match(
    /^\/api\/workflow\/settlement-reports\/([^/]+)\/create-pending-candidate$/u,
  );
  if (request.method === "POST" && settlementReportActionMatch) {
    try {
      assertSameOrigin(request, "Cross-origin pending candidate creation is not allowed.");
      const settlementReportId = assertSettlementReportId(
        decodeApiId(settlementReportActionMatch[1], "settlement_report_id"),
      );
      const input = await parseBody(request);
      const result = await createPendingCandidateFromSettlementReport(
        settlementReportId,
        {
          sourceChapter: input.sourceChapter ?? input.source_chapter ?? "",
          note: input.note ?? "",
        },
      );
      sendJson(response, 201, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const settlementReportDetailMatch = rawPathname.match(
    /^\/api\/workflow\/settlement-reports\/([^/]+)$/u,
  );
  if (request.method === "GET" && settlementReportDetailMatch) {
    try {
      const settlementReportId = assertSettlementReportId(
        decodeApiId(settlementReportDetailMatch[1], "settlement_report_id"),
      );
      sendJson(response, 200, {
        ok: true,
        settlement_report: await getSettlementReport(settlementReportId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const adoptedDetailMatch = rawPathname.match(/^\/api\/workflow\/adopted-chapters\/([^/]+)$/u);
  if (request.method === "GET" && adoptedDetailMatch) {
    try {
      const adoptedChapterId = assertAdoptedChapterId(
        decodeApiId(adoptedDetailMatch[1], "adopted_chapter_id"),
      );
      sendJson(response, 200, {
        ok: true,
        adopted_chapter: await getAdoptedChapter(adoptedChapterId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/canon/active-engine/status") {
    sendJson(response, 200, { ok: true, active_engine: await activeEngineStatus() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/canon/settlement/import") {
    try {
      assertSameOrigin(request, "Cross-origin settlement imports are not allowed.");
      const input = await parseBody(request);
      const candidate = await importSettlementResult({
        rawText: input.rawText ?? input.raw_text,
        sourceChapter: input.sourceChapter ?? input.source_chapter,
        note: input.note,
        runId: input.runId ?? input.run_id,
        requiresNeuralModules: input.requiresNeuralModules ?? input.requires_neural_modules,
        neuralModulesUsedPath: input.neuralModulesUsedPath ?? input.neural_modules_used_path,
      });
      sendJson(response, 201, { ok: true, candidate });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/canon/pending-candidates") {
    sendJson(response, 200, {
      ok: true,
      candidates: await listPendingCandidates(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/canon/snapshots") {
    sendJson(response, 200, { ok: true, snapshots: await listSnapshots() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/canon/activation-logs") {
    sendJson(response, 200, { ok: true, logs: await listActivationLogs() });
    return;
  }

  const rollbackMatch = rawPathname.match(/^\/api\/canon\/rollback\/([^/]+)$/u);
  if (request.method === "POST" && rollbackMatch) {
    try {
      assertSameOrigin(request, "Cross-origin rollbacks are not allowed.");
      const snapshotId = assertSnapshotId(decodeApiId(rollbackMatch[1], "snapshot_id"));
      const input = await parseBody(request);
      const result = await rollbackActiveEngine(snapshotId, {
        confirm: input.confirm === true,
        approvedBy: input.approvedBy ?? input.approved_by ?? "local_user",
      });
      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const candidateActionMatch = rawPathname.match(
    /^\/api\/canon\/pending-candidates\/([^/]+)\/(reparse|reject|activate)$/u,
  );
  if (request.method === "POST" && candidateActionMatch) {
    try {
      assertSameOrigin(request, "Cross-origin candidate actions are not allowed.");
      const candidateId = assertEngineCandidateId(
        decodeApiId(candidateActionMatch[1], "candidate_id"),
      );
      const action = candidateActionMatch[2];
      const input = await parseBody(request);
      if (action === "activate") {
        const error = new Error(
          "Direct engine activation is disabled; confirm an approval queue item.",
        );
        error.statusCode = 409;
        throw error;
      }
      const candidate = action === "reparse"
        ? await reparsePendingCandidate(candidateId)
        : await rejectPendingCandidate(candidateId, { reason: input.reason ?? "" });
      sendJson(response, 200, { ok: true, candidate });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const pendingCandidateMatch = rawPathname.match(
    /^\/api\/canon\/pending-candidates\/([^/]+)$/u,
  );
  if (request.method === "GET" && pendingCandidateMatch) {
    try {
      const candidateId = assertEngineCandidateId(
        decodeApiId(pendingCandidateMatch[1], "candidate_id"),
      );
      sendJson(response, 200, {
        ok: true,
        candidate: await getPendingCandidate(candidateId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/agent/runs") {
    sendJson(response, 200, { ok: true, runs: await listAgentRuns() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/agent/runs") {
    try {
      assertSameOrigin(request, "Cross-origin agent run creation is not allowed.");
      const input = await parseBody(request);
      const run = await createAgentRun(input);
      sendJson(response, 201, { ok: true, run });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const neuralUsageMatch = rawPathname.match(/^\/api\/agent\/runs\/([^/]+)\/neural-usage$/u);
  if (request.method === "GET" && neuralUsageMatch) {
    try {
      const runId = assertAgentRunId(decodeApiId(neuralUsageMatch[1], "run_id"));
      sendJson(response, 200, {
        ok: true,
        usage: await summarizeNeuralUsageForRun(runId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const agentRunMatch = rawPathname.match(/^\/api\/agent\/runs\/([^/]+)$/u);
  if (request.method === "GET" && agentRunMatch) {
    try {
      const runId = assertAgentRunId(decodeApiId(agentRunMatch[1], "run_id"));
      sendJson(response, 200, {
        ok: true,
        run: await agentRunDetails(runId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/neural/traces") {
    try {
      const runId = url.searchParams.get("run_id") ?? "";
      if (runId) assertAgentRunId(runId);
      sendJson(response, 200, {
        ok: true,
        traces: await listNeuralTraces(runId ? { run_id: runId } : {}),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const neuralTraceMatch = rawPathname.match(/^\/api\/neural\/traces\/([^/]+)$/u);
  if (request.method === "GET" && neuralTraceMatch) {
    try {
      const traceId = assertNeuralTraceId(decodeApiId(neuralTraceMatch[1], "trace_id"));
      sendJson(response, 200, {
        ok: true,
        trace: await getNeuralTrace(traceId),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  const neuralModuleMatch = rawPathname.match(/^\/api\/neural\/([^/]+)$/u);
  if (request.method === "POST" && neuralModuleMatch) {
    const moduleKey = decodeApiId(neuralModuleMatch[1], "neural module");
    const wrapper = neuralApiModules[moduleKey];
    if (!wrapper) {
      sendError(response, 404, new Error(`Unknown neural module: ${moduleKey}`));
      return;
    }
    try {
      assertSameOrigin(request, "Cross-origin neural module calls are not allowed.");
      const input = await parseBody(request);
      const runId = assertAgentRunId(requireString(input.run_id, "run_id", 100));
      const run = await getAgentRun(runId);
      const taskType = optionalString(input.task_type, "task_type", 100) || run.task_type;
      const result = await wrapper(input.input ?? "", {
        run_id: runId,
        task_type: taskType,
        source: "local_ui",
      });
      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/visuals") {
    sendJson(response, 200, { ok: true, visuals: await visualPayload() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/file") {
    const projectPath = url.searchParams.get("path") ?? "";
    await serveProjectFile(response, projectPath);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/visual-db/asset") {
    await serveVisualAsset(response, url.searchParams.get("path") ?? "");
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/visuals/upload") {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) {
      sendError(response, 403, new Error("Cross-origin visual uploads are not allowed."));
      return;
    }
    let input;
    try {
      input = await parseBody(request, maxVisualUploadBodyBytes);
    } catch (error) {
      sendError(response, 400, error);
      return;
    }
    try {
      const upload = await saveVisualUpload(input);
      sendJson(response, 200, {
        ok: true,
        upload,
        visuals: await visualPayload(),
      });
    } catch (error) {
      sendError(response, 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/visuals/delete") {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) {
      sendError(response, 403, new Error("Cross-origin visual deletes are not allowed."));
      return;
    }
    let input;
    try {
      input = await parseBody(request);
    } catch (error) {
      sendError(response, 400, error);
      return;
    }
    try {
      const deleted = await deleteVisualReference(input);
      sendJson(response, 200, {
        ok: true,
        deleted,
        visuals: await visualPayload(),
      });
    } catch (error) {
      sendError(response, error.statusCode ?? 400, error);
    }
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/actions/")) {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) {
      sendError(response, 403, new Error("Cross-origin actions are not allowed."));
      return;
    }
    const actionName = url.pathname.slice("/api/actions/".length);
    const buildAction = actionBuilders[actionName];
    if (!buildAction) {
      sendError(response, 404, new Error(`Unknown action: ${actionName}`));
      return;
    }
    const input = await parseBody(request);
    let action;
    try {
      action = buildAction(input);
    } catch (error) {
      sendError(response, 400, error);
      return;
    }
    const result = await runNode(action);
    sendJson(response, result.ok ? 200 : 422, {
      ok: result.ok,
      action: actionName,
      result,
    });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(response, url.pathname);
    return;
  }

  sendError(response, 405, new Error("Method not allowed."));
}

function openBrowser(url) {
  const command = process.platform === "win32"
    ? { file: "explorer.exe", args: [url] }
    : process.platform === "darwin"
      ? { file: "open", args: [url] }
      : { file: "xdg-open", args: [url] };
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  await ensureAgentRunDirectories();
  await ensureEngineCandidateDirectories();
  await ensureWritingWorkflowDirectories();
  await ensureSettlementWorkflowDirectories();
  await ensureApprovalQueueDirectories();
  await ensureCleanupDirectories();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      if (error.code === "ENOENT") {
        sendError(response, 404, new Error("Not found."));
        return;
      }
      if (error instanceof SyntaxError) {
        sendError(response, 400, new Error("Request body is not valid JSON."));
        return;
      }
      sendError(response, 500, error);
    });
  });

  const shutdown = () => {
    for (const child of activeChildren) terminateProcessTree(child);
    server.close(() => {
      process.exitCode = 0;
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  server.listen(options.port, options.host, () => {
    const url = `http://${options.host}:${options.port}`;
    console.log(`Armed Academy Workbench: ${url}`);
    console.log("Press Ctrl+C to stop.");
    if (options.open) openBrowser(url);
  });
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
