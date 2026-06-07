import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  sourceTrustFor,
  validateSourceTrustMetadata,
} from "./source-trust.mjs";
import { terminateProcessTree } from "./process-control.mjs";
import { projectPaths } from "./project-paths.mjs";
import { sourceSpecsFor } from "./source-registry.mjs";
import {
  allowedVisualImageExtensions,
  validateVisualRecord,
  visualCategoryLabels,
  visualCategorySpecs,
} from "./visual-db.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const uiDir = path.join(rootDir, "server", "ui");
const toolsDir = path.join(rootDir, "server", "src", "tools");
const defaultHost = "127.0.0.1";
const defaultPort = 4173;
const maxBodyBytes = 2 * 1024 * 1024;
const maxToolOutputBytes = 4 * 1024 * 1024;
const activeChildren = new Set();
const visualAssetsDir = projectPaths.visualAssets;
const visualIndexPath = projectPaths.visualIndex;

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

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function resolveProjectPath(value) {
  const resolved = path.resolve(rootDir, value);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path must stay inside the project.");
  }
  return resolved;
}

function canonicalProjectPath(value) {
  if (typeof value !== "string" || !value) {
    throw new Error("A project path is required.");
  }
  return normalizePath(resolveProjectPath(value));
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
  const filePath = resolveProjectPath(projectPath);
  const relative = path.relative(visualAssetsDir, filePath).replaceAll(path.sep, "/");
  return `/visual-assets/${relative.split("/").map(encodeURIComponent).join("/")}`;
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

  const filePath = resolveProjectPath(record.path);
  const relative = path.relative(visualAssetsDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    result.errors.push("path must stay under data/visual_db/assets/.");
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

async function visualPayload() {
  const text = await readOptionalText(visualIndexPath);
  const lines = text.split(/\r?\n/u);
  const items = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      items.push({
        lineNumber: index + 1,
        ...await visualAssetState(record),
      });
    } catch (error) {
      items.push({
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
      });
    }
  }
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

async function parseBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new Error("Request body is too large.");
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

function isReadableProjectPath(projectPath) {
  if (readableExactPaths.has(projectPath)) return true;
  return readableDirectoryPaths.some(
    (directory) => projectPath === directory || projectPath.startsWith(`${directory}/`),
  );
}

async function serveProjectFile(response, projectPath) {
  const canonicalPath = canonicalProjectPath(projectPath);
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

async function serveVisualAsset(response, relativePath) {
  const decoded = decodeAssetPath(relativePath);
  const filePath = path.resolve(visualAssetsDir, decoded);
  const relative = path.relative(visualAssetsDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    sendError(response, 403, new Error("Visual asset path must stay inside the visual asset library."));
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (!allowedVisualImageExtensions.has(extension)) {
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

  if (request.method === "GET" && url.pathname === "/api/visuals") {
    sendJson(response, 200, { ok: true, visuals: await visualPayload() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/file") {
    const projectPath = url.searchParams.get("path") ?? "";
    await serveProjectFile(response, projectPath);
    return;
  }

  if (request.method === "GET" && rawPathname.startsWith("/visual-assets/")) {
    await serveVisualAsset(response, rawPathname.slice("/visual-assets/".length));
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
