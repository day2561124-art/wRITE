import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const toolsDir = path.join(rootDir, "server", "src", "tools");

const serverInfo = {
  name: "armed-academy-fiction-engine",
  version: "0.1.0",
};

const defaultProtocolVersion = "2024-11-05";
const maxChildOutputBytes = 20 * 1024 * 1024;
const defaultTimeoutMs = 120_000;
const mcpAuditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");

const dataPaths = {
  activeEngine: path.join(rootDir, "data", "canon_db", "active_engine.md"),
  activeWritingCard: path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  activeProofingCard: path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  activeLongline: path.join(rootDir, "data", "longline_db", "active_longline.md"),
  compressedRules: path.join(rootDir, "data", "error_report_db", "compressed_rules.md"),
};

const jsonlStatePaths = [
  path.join(rootDir, "data", "error_report_db", "canon_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "character_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "dialogue_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "pacing_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "battle_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "preference_errors.jsonl"),
  path.join(rootDir, "data", "feedback_db", "pending_error_reports.jsonl"),
  path.join(rootDir, "data", "feedback_db", "accepted_drafts.jsonl"),
  path.join(rootDir, "data", "feedback_db", "rejected_drafts.jsonl"),
  path.join(rootDir, "data", "feedback_db", "revision_pairs.jsonl"),
  path.join(rootDir, "data", "feedback_db", "preference_pairs.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "proof_report_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "settlement_proposal_index.jsonl"),
  mcpAuditLogPath,
];

const auditWatchedPaths = [
  ...Object.values(dataPaths),
  path.join(rootDir, "data", "error_report_db", "canon_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "character_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "dialogue_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "pacing_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "battle_errors.jsonl"),
  path.join(rootDir, "data", "error_report_db", "preference_errors.jsonl"),
  path.join(rootDir, "data", "feedback_db", "pending_error_reports.jsonl"),
  path.join(rootDir, "data", "feedback_db", "accepted_drafts.jsonl"),
  path.join(rootDir, "data", "feedback_db", "rejected_drafts.jsonl"),
  path.join(rootDir, "data", "feedback_db", "revision_pairs.jsonl"),
  path.join(rootDir, "data", "feedback_db", "preference_pairs.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "proof_report_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "settlement_proposal_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "policy_imports.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "error_report_commits.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "compressed_rule_candidate_index.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "compressed_rule_updates.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "engine_activations.jsonl"),
];

const resourceDefinitions = [
  {
    uri: "armed-academy://project/readme",
    name: "README.md",
    description: "Project operating manual and local tool workflow.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "README.md"),
  },
  {
    uri: "armed-academy://project/skill",
    name: "SKILL.md",
    description: "Fiction-agent system specification.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "SKILL.md"),
  },
  {
    uri: "armed-academy://canon/active_engine",
    name: "Canon DB active engine",
    description: "Highest-authority active canon engine.",
    mimeType: "text/markdown",
    filePath: dataPaths.activeEngine,
  },
  {
    uri: "armed-academy://writing-policy/active_writing_card",
    name: "Writing Policy active card",
    description: "Active prose-writing policy card.",
    mimeType: "text/markdown",
    filePath: dataPaths.activeWritingCard,
  },
  {
    uri: "armed-academy://proofing-policy/active_proofing_card",
    name: "Proofing Policy active card",
    description: "Active proofing policy or missing-source guard.",
    mimeType: "text/markdown",
    filePath: dataPaths.activeProofingCard,
  },
  {
    uri: "armed-academy://longline/active_longline",
    name: "Longline active index",
    description: "Active longline boundary index.",
    mimeType: "text/markdown",
    filePath: dataPaths.activeLongline,
  },
  {
    uri: "armed-academy://error-report/compressed_rules",
    name: "Compressed error rules",
    description: "Compressed Error Report DB rules used by prompt builder.",
    mimeType: "text/markdown",
    filePath: dataPaths.compressedRules,
  },
  {
    uri: "armed-academy://outputs/current_prompt",
    name: "Current prompt",
    description: "Full current prompt bundle output.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "data", "outputs", "current_prompt.md"),
  },
  {
    uri: "armed-academy://outputs/generation_context",
    name: "Generation context",
    description: "Compact generation context output.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "data", "outputs", "generation_context.md"),
  },
  {
    uri: "armed-academy://outputs/retrieval_context",
    name: "Retrieval context",
    description: "Latest retrieval context output.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "data", "outputs", "retrieval_context.md"),
  },
  {
    uri: "armed-academy://outputs/task_prompt",
    name: "Task prompt",
    description: "Latest task prompt output.",
    mimeType: "text/markdown",
    filePath: path.join(rootDir, "data", "outputs", "task_prompt.md"),
  },
  {
    uri: "armed-academy://memory/canon",
    name: "Canon memory",
    description: "Canon memory cache.",
    mimeType: "application/json",
    filePath: path.join(rootDir, "data", "memory_store", "canon_memory.json"),
  },
  {
    uri: "armed-academy://memory/preference",
    name: "Preference memory",
    description: "Preference memory cache.",
    mimeType: "application/json",
    filePath: path.join(rootDir, "data", "memory_store", "preference_memory.json"),
  },
  {
    uri: "armed-academy://memory/working",
    name: "Working memory",
    description: "Working memory cache.",
    mimeType: "application/json",
    filePath: path.join(rootDir, "data", "memory_store", "working_memory.json"),
  },
  ...jsonlStatePaths.map((filePath) => ({
    uri: `armed-academy://jsonl/${normalizePath(filePath).replaceAll("/", ":")}`,
    name: normalizePath(filePath),
    description: "Tracked JSONL database or output log.",
    mimeType: "application/jsonl",
    filePath,
  })),
];

const resourceRegistry = new Map(resourceDefinitions.map((resource) => [resource.uri, resource]));

const promptDefinitions = [
  {
    name: "generate_chapter",
    description: "Generate the next chapter candidate without updating canon.",
    filePath: path.join(rootDir, "prompts", "generate_chapter.md"),
    arguments: [
      {
        name: "task",
        description: "Specific chapter-generation task or user request.",
        required: false,
      },
      {
        name: "query",
        description: "Suggested retrieval keywords for context search.",
        required: false,
      },
    ],
  },
  {
    name: "proofread_draft",
    description: "Proofread a candidate draft before formal adoption.",
    filePath: path.join(rootDir, "prompts", "proofread_draft.md"),
    arguments: [
      {
        name: "draft_id",
        description: "Optional saved draft ID or draft label.",
        required: false,
      },
    ],
  },
  {
    name: "settle_chapter",
    description: "Prepare settlement suggestions from explicitly adopted chapter text.",
    filePath: path.join(rootDir, "prompts", "settle_chapter.md"),
    arguments: [
      {
        name: "chapter",
        description: "Chapter label being settled.",
        required: false,
      },
    ],
  },
  {
    name: "compress_errors",
    description: "Compress formal error reports into stable high-frequency rules.",
    filePath: path.join(rootDir, "prompts", "compress_errors.md"),
    arguments: [
      {
        name: "source_scope",
        description: "Optional formal error-report source range to compress.",
        required: false,
      },
    ],
  },
  {
    name: "rewrite_by_errors",
    description: "Rewrite a candidate draft using Canon Guard and relevant error reports.",
    filePath: path.join(rootDir, "prompts", "rewrite_by_errors.md"),
    arguments: [
      {
        name: "draft_id",
        description: "Optional saved draft ID or draft label.",
        required: false,
      },
      {
        name: "error_focus",
        description: "Optional error category or rule focus.",
        required: false,
      },
    ],
  },
];

const promptRegistry = new Map(promptDefinitions.map((prompt) => [prompt.name, prompt]));

function usage() {
  return [
    "Usage:",
    "  node server/src/mcp-server.mjs",
    "",
    "Transport:",
    "  JSON-RPC 2.0 over stdio. Supports newline-delimited JSON and Content-Length framing.",
    "  Maximum message body: 16 MiB. Maximum Content-Length header: 8 KiB.",
    "  Maximum messages awaiting dispatch: 256.",
    "  Maximum responses awaiting stdout: 256; input resumes at 128.",
    "",
    "Supported MCP methods:",
    "  initialize",
    "  tools/list",
    "  tools/call",
    "  ping",
    "  resources/list",
    "  resources/read",
    "  prompts/list",
    "  prompts/get",
    "",
    "Example smoke test:",
    "  Send initialize, notifications/initialized, tools/list, then tools/call over stdin.",
  ].join("\n");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textContent(text) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function jsonContent(value) {
  return textContent(JSON.stringify(value, null, 2));
}

function assertObject(value, name = "arguments") {
  if (!isObject(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function optionalString(value, field) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  return value;
}

function requiredString(args, field) {
  const value = optionalString(args[field], field).trim();
  if (!value) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

function optionalBoolean(value, field) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }
  return value;
}

function optionalInteger(value, field, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function pushValue(argv, flag, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  argv.push(flag, String(value));
}

function pushFlag(argv, flag, value) {
  if (value) {
    argv.push(flag);
  }
}

function pushRepeated(argv, flag, values, field) {
  if (values === undefined || values === null) {
    return;
  }

  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }

  const list = values;
  for (const value of list) {
    if (value.trim()) {
      argv.push(flag, value);
    }
  }
}

async function runNodeTool(scriptName, argv, timeoutMs = defaultTimeoutMs) {
  const scriptPath = path.join(toolsDir, scriptName);
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...argv], {
      cwd: rootDir,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: maxChildOutputBytes,
    });

    return [
      stdout.trimEnd(),
      stderr.trimEnd() ? `\n[stderr]\n${stderr.trimEnd()}` : "",
    ].filter(Boolean).join("\n");
  } catch (error) {
    const stdout = String(error.stdout ?? "").trimEnd();
    const stderr = String(error.stderr ?? "").trimEnd();
    const details = [
      `Tool failed: ${scriptName}`,
      `Exit code: ${error.code ?? "unknown"}`,
      stdout ? `\n[stdout]\n${stdout}` : "",
      stderr ? `\n[stderr]\n${stderr}` : "",
      error.message ? `\n[message]\n${error.message}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(details);
  }
}

async function fileSnapshot(filePath, includeText = false) {
  try {
    const [text, stats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    const snapshot = {
      path: normalizePath(filePath),
      exists: true,
      bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
      sha256: hashText(text),
    };
    if (includeText) {
      snapshot.text = text;
    }
    return snapshot;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        path: normalizePath(filePath),
        exists: false,
        bytes: 0,
        modified_at: null,
        sha256: null,
      };
    }
    throw error;
  }
}

async function jsonlSnapshot(filePath) {
  try {
    const [text, stats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    const lines = text.split(/\r?\n/).filter((line) => line.trim()).length;
    return {
      path: normalizePath(filePath),
      exists: true,
      records: lines,
      bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
      sha256: hashText(text),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        path: normalizePath(filePath),
        exists: false,
        records: 0,
        bytes: 0,
        modified_at: null,
        sha256: null,
      };
    }
    throw error;
  }
}

async function auditSnapshot(filePath) {
  try {
    const [text, stats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    return {
      path: normalizePath(filePath),
      exists: true,
      bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
      sha256: hashText(text),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        path: normalizePath(filePath),
        exists: false,
        bytes: 0,
        modified_at: null,
        sha256: null,
      };
    }
    throw error;
  }
}

async function auditSnapshotMap() {
  const snapshots = await Promise.all(auditWatchedPaths.map((filePath) => auditSnapshot(filePath)));
  return new Map(snapshots.map((snapshot) => [snapshot.path, snapshot]));
}

function diffAuditSnapshots(before, after) {
  const changed = [];
  const allPaths = new Set([...before.keys(), ...after.keys()]);

  for (const filePath of allPaths) {
    const previous = before.get(filePath) ?? { exists: false, bytes: 0, sha256: null };
    const current = after.get(filePath) ?? { exists: false, bytes: 0, sha256: null };
    if (previous.exists !== current.exists || previous.sha256 !== current.sha256 || previous.bytes !== current.bytes) {
      changed.push({
        path: filePath,
        previous: {
          exists: previous.exists,
          bytes: previous.bytes,
          sha256: previous.sha256,
        },
        current: {
          exists: current.exists,
          bytes: current.bytes,
          sha256: current.sha256,
        },
      });
    }
  }

  return changed;
}

function truncateText(value, limit = 160) {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}... [truncated ${text.length - limit} chars]`;
}

function summarizeInputValue(value) {
  if (typeof value === "string") {
    return {
      type: "string",
      length: value.length,
      sha256: hashText(value),
      preview: truncateText(value),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => summarizeInputValue(item));
  }

  if (isObject(value)) {
    const summary = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      summary[key] = summarizeInputValue(nestedValue);
    }
    return summary;
  }

  return value ?? null;
}

function summarizeToolArguments(args) {
  const summary = {};
  for (const [key, value] of Object.entries(args)) {
    summary[key] = summarizeInputValue(value);
  }
  return summary;
}

function confirmationId(args) {
  if (typeof args.confirm === "string" && args.confirm.trim()) {
    return args.confirm.trim();
  }
  if (args.confirmAdopted === true) {
    return "confirmAdopted=true";
  }
  return null;
}

function confirmationGuardError(tool, args) {
  const metadata = tool.inputSchema?.["x-confirmation"];
  if (!metadata) {
    return "";
  }

  const whenMatches = Object.entries(metadata.when ?? {})
    .every(([field, value]) => args[field] === value);
  const unlessMatches = Object.entries(metadata.unless ?? {})
    .every(([field, value]) => args[field] === value);

  if (!whenMatches || (Object.keys(metadata.unless ?? {}).length > 0 && unlessMatches)) {
    return "";
  }

  return args[metadata.field] === metadata.requiredValue ? "" : metadata.message;
}

function auditOutputSummary(result) {
  const text = Array.isArray(result?.content)
    ? result.content.map((item) => item?.text ?? "").join("\n")
    : "";
  return {
    is_error: result?.isError === true,
    text_sha256: text ? hashText(text) : null,
    text_preview: text ? truncateText(text, 400) : "",
  };
}

async function appendAuditLog(entry) {
  await mkdir(path.dirname(mcpAuditLogPath), { recursive: true });
  await writeFile(mcpAuditLogPath, `${JSON.stringify(entry)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

async function auditedToolCall(tool, args, actor) {
  const before = await auditSnapshotMap();
  const calledAt = new Date();
  const auditId = `MCP-AUDIT-${calledAt.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "")}-${hashText(`${tool.name}:${JSON.stringify(args)}:${calledAt.toISOString()}`).slice(0, 8).toUpperCase()}`;
  let result;
  let effectiveArgs = args;

  try {
    effectiveArgs = prepareToolArguments(tool, args);
    const guardError = confirmationGuardError(tool, effectiveArgs);
    if (guardError) {
      throw new Error(guardError);
    }
    result = await tool.handler(effectiveArgs);
  } catch (error) {
    result = {
      isError: true,
      content: [
        {
          type: "text",
          text: error.message,
        },
      ],
    };
  }

  const after = await auditSnapshotMap();
  const changed = diffAuditSnapshots(before, after);
  await appendAuditLog({
    audit_id: auditId,
    created_at: calledAt.toISOString(),
    status: result?.isError === true ? "tool_error" : "completed",
    tool_name: tool.name,
    risk: tool.risk,
    actor,
    input_summary: summarizeToolArguments(effectiveArgs),
    affected_paths: changed.map((item) => item.path),
    previous_version: Object.fromEntries(changed.map((item) => [item.path, item.previous])),
    new_version: Object.fromEntries(changed.map((item) => [item.path, item.current])),
    confirmation_id: confirmationId(effectiveArgs),
    result: auditOutputSummary(result),
  });

  return result;
}

async function directoryCount(dirPath) {
  try {
    const entries = await readdir(dirPath);
    return entries.length;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function getCurrentProjectState(args) {
  assertObject(args);
  const includeHashes = args.includeHashes !== false;
  const files = {};
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const snapshot = await fileSnapshot(filePath, false);
    if (!includeHashes) {
      delete snapshot.sha256;
    }
    files[key] = snapshot;
  }

  const jsonl = await Promise.all(jsonlStatePaths.map((filePath) => jsonlSnapshot(filePath)));
  if (!includeHashes) {
    for (const snapshot of jsonl) {
      delete snapshot.sha256;
    }
  }

  return {
    project: "武裝學院的二三事",
    root: normalizePath(rootDir) || ".",
    server: serverInfo,
    files,
    jsonl,
    output_counts: {
      drafts: await directoryCount(path.join(rootDir, "data", "outputs", "drafts")),
      proof_reports: await directoryCount(path.join(rootDir, "data", "outputs", "proof_reports")),
      settlement_proposals: await directoryCount(path.join(rootDir, "data", "outputs", "settlement_proposals")),
      compressed_rule_candidates: await directoryCount(path.join(rootDir, "data", "outputs", "compressed_rule_candidates")),
    },
  };
}

const defaultNullNormalization = Object.freeze({
  required: "reject",
  optionalWithDefault: "applyDefault",
  optionalWithoutDefault: "preserveNull",
});

const defaultEmptyStringNormalization = Object.freeze({
  required: "rejectBlank",
  optionalWithDefault: "applyDefault",
  optionalWithoutDefault: "omit",
  crossFieldPresence: "trimmedNonEmpty",
});

const defaultStringArrayNormalization = Object.freeze({
  blankItems: "rejectBlank",
  nonBlankItems: "preserve",
});

const defaultInputLimits = Object.freeze({
  stringMaxLength: 4096,
  queryMaxLength: 8192,
  contentMaxLength: 65536,
  textMaxLength: 1000000,
  arrayMaxItems: 100,
  fileArrayMaxItems: 256,
  arrayItemMaxLength: 16384,
  fileItemMaxLength: 4096,
});

const contentStringFields = new Set([
  "task",
  "feedback",
  "badPattern",
  "whyBad",
  "fixRule",
]);

function stringMaxLengthFor(field) {
  if (field === "text") {
    return defaultInputLimits.textMaxLength;
  }
  if (field === "query") {
    return defaultInputLimits.queryMaxLength;
  }
  if (contentStringFields.has(field)) {
    return defaultInputLimits.contentMaxLength;
  }
  return defaultInputLimits.stringMaxLength;
}

function applySchemaInputLimits(properties) {
  return Object.fromEntries(
    Object.entries(properties).map(([field, schema]) => {
      if (schema.type === "string") {
        return [field, {
          ...schema,
          maxLength: schema.maxLength ?? stringMaxLengthFor(field),
        }];
      }
      if (schema.type === "array" && schema.items?.type === "string") {
        return [field, {
          ...schema,
          maxItems: schema.maxItems
            ?? (field === "files"
              ? defaultInputLimits.fileArrayMaxItems
              : defaultInputLimits.arrayMaxItems),
          items: {
            ...schema.items,
            maxLength: schema.items.maxLength
              ?? (field === "files"
                ? defaultInputLimits.fileItemMaxLength
                : defaultInputLimits.arrayItemMaxLength),
          },
        }];
      }
      return [field, schema];
    }),
  );
}

function baseSchema(
  properties = {},
  required = [],
  crossFieldConstraints = [],
  confirmation = null,
) {
  const limitedProperties = applySchemaInputLimits(properties);
  return {
    type: "object",
    properties: limitedProperties,
    required,
    additionalProperties: false,
    "x-null-normalization": defaultNullNormalization,
    "x-empty-string-normalization": defaultEmptyStringNormalization,
    "x-string-array-normalization": defaultStringArrayNormalization,
    ...(crossFieldConstraints.length > 0
      ? { "x-cross-field-constraints": crossFieldConstraints }
      : {}),
    ...(confirmation ? { "x-confirmation": confirmation } : {}),
  };
}

function isPresentArgument(value, emptyStringNormalization) {
  if (typeof value === "string") {
    if (emptyStringNormalization.crossFieldPresence !== "trimmedNonEmpty") {
      throw new Error("Unsupported cross-field empty-string presence policy.");
    }
    return value.trim().length > 0;
  }
  return value === true;
}

function getNullNormalization(tool) {
  const metadata = tool.inputSchema?.["x-null-normalization"];
  if (
    metadata?.required !== defaultNullNormalization.required
    || metadata?.optionalWithDefault !== defaultNullNormalization.optionalWithDefault
    || metadata?.optionalWithoutDefault !== defaultNullNormalization.optionalWithoutDefault
  ) {
    throw new Error(`${tool.name} exposes unsupported x-null-normalization metadata.`);
  }
  return metadata;
}

function getEmptyStringNormalization(tool) {
  const metadata = tool.inputSchema?.["x-empty-string-normalization"];
  if (
    metadata?.required !== defaultEmptyStringNormalization.required
    || metadata?.optionalWithDefault !== defaultEmptyStringNormalization.optionalWithDefault
    || metadata?.optionalWithoutDefault !== defaultEmptyStringNormalization.optionalWithoutDefault
    || metadata?.crossFieldPresence !== defaultEmptyStringNormalization.crossFieldPresence
  ) {
    throw new Error(`${tool.name} exposes unsupported x-empty-string-normalization metadata.`);
  }
  return metadata;
}

function getStringArrayNormalization(tool) {
  const metadata = tool.inputSchema?.["x-string-array-normalization"];
  if (
    metadata?.blankItems !== defaultStringArrayNormalization.blankItems
    || metadata?.nonBlankItems !== defaultStringArrayNormalization.nonBlankItems
  ) {
    throw new Error(`${tool.name} exposes unsupported x-string-array-normalization metadata.`);
  }
  return metadata;
}

function validateCrossFieldArguments(tool, args) {
  const constraints = tool.inputSchema?.["x-cross-field-constraints"] ?? [];
  const emptyStringNormalization = getEmptyStringNormalization(tool);

  for (const constraint of constraints) {
    if (constraint.type === "exactlyOne") {
      const count = constraint.fields
        .filter((field) => isPresentArgument(args[field], emptyStringNormalization))
        .length;
      if (count !== 1) {
        throw new Error(constraint.message);
      }
      continue;
    }

    if (constraint.type === "selectorOrList") {
      const listEnabled = args[constraint.listField] === true;
      const selectorCount = constraint.selectorFields
        .filter((field) => isPresentArgument(args[field], emptyStringNormalization))
        .length;
      if ((listEnabled && selectorCount !== 0) || (!listEnabled && selectorCount !== 1)) {
        throw new Error(constraint.message);
      }
    }
  }
}

function validateToolArguments(tool, args) {
  const properties = tool.inputSchema?.properties ?? {};
  const nullNormalization = getNullNormalization(tool);
  const emptyStringNormalization = getEmptyStringNormalization(tool);
  const stringArrayNormalization = getStringArrayNormalization(tool);
  const allowed = new Set(Object.keys(properties));
  const unknown = Object.keys(args)
    .filter((key) => !allowed.has(key))
    .sort();

  if (unknown.length > 0) {
    const noun = unknown.length === 1 ? "argument" : "arguments";
    throw new Error(`Unknown ${noun} for ${tool.name}: ${unknown.join(", ")}.`);
  }

  for (const field of tool.inputSchema?.required ?? []) {
    const value = args[field];
    if (
      value === undefined
      || (
        typeof value === "string"
        && value.trim() === ""
        && emptyStringNormalization.required === "rejectBlank"
      )
      || (value === null && nullNormalization.required === "reject")
    ) {
      throw new Error(`${field} is required.`);
    }
  }

  for (const [field, schema] of Object.entries(properties)) {
    const value = args[field];
    if (value === undefined || value === null) {
      continue;
    }

    if (schema.type === "string" && typeof value !== "string") {
      throw new Error(`${field} must be a string.`);
    }

    if (
      schema.type === "string"
      && typeof value === "string"
      && Array.from(value).length > schema.maxLength
    ) {
      throw new Error(`${field} must be at most ${schema.maxLength} characters.`);
    }

    if (schema.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`${field} must be a boolean.`);
    }

    if (
      schema.type === "integer"
      && (!Number.isInteger(value) || (schema.minimum !== undefined && value < schema.minimum))
    ) {
      if (schema.minimum === 1) {
        throw new Error(`${field} must be a positive integer.`);
      }
      throw new Error(`${field} must be an integer greater than or equal to ${schema.minimum}.`);
    }

    if (
      schema.type === "integer"
      && schema.maximum !== undefined
      && value > schema.maximum
    ) {
      throw new Error(`${field} must be an integer less than or equal to ${schema.maximum}.`);
    }

    if (schema.type === "array") {
      if (!Array.isArray(value)) {
        throw new Error(`${field} must be an array.`);
      }
      if (value.length > schema.maxItems) {
        throw new Error(`${field} must contain at most ${schema.maxItems} items.`);
      }
      if (
        schema.items?.type === "string"
        && value.some((item) => typeof item !== "string")
      ) {
        throw new Error(`${field} must be an array of strings.`);
      }
      if (
        schema.items?.type === "string"
        && value.some((item) => Array.from(item).length > schema.items.maxLength)
      ) {
        throw new Error(`${field} items must be at most ${schema.items.maxLength} characters.`);
      }
      if (
        schema.items?.type === "string"
        && stringArrayNormalization.blankItems === "rejectBlank"
        && value.some((item) => item.trim() === "")
      ) {
        throw new Error(`${field} must not contain blank strings.`);
      }
    }

    if (
      Array.isArray(schema.enum)
      && !(typeof value === "string" && value.trim() === "")
      && !schema.enum.includes(value)
    ) {
      throw new Error(`${field} must be one of: ${schema.enum.join(", ")}.`);
    }
  }

}

function applyEmptyStringNormalization(tool, args) {
  const normalized = { ...args };
  const properties = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const emptyStringNormalization = getEmptyStringNormalization(tool);

  for (const [field, schema] of Object.entries(properties)) {
    if (
      schema.type !== "string"
      || required.has(field)
      || typeof normalized[field] !== "string"
      || normalized[field].trim() !== ""
    ) {
      continue;
    }

    if (
      Object.hasOwn(schema, "default")
      && emptyStringNormalization.optionalWithDefault === "applyDefault"
    ) {
      normalized[field] = schema.default;
      continue;
    }

    if (
      !Object.hasOwn(schema, "default")
      && emptyStringNormalization.optionalWithoutDefault === "omit"
    ) {
      delete normalized[field];
    }
  }

  return normalized;
}

function applyToolDefaults(tool, args) {
  const normalized = { ...args };
  const properties = tool.inputSchema?.properties ?? {};
  const nullNormalization = getNullNormalization(tool);

  for (const [field, schema] of Object.entries(properties)) {
    if (
      normalized[field] === null
      && !Object.hasOwn(schema, "default")
      && nullNormalization.optionalWithoutDefault === "preserveNull"
    ) {
      continue;
    }
    if (
      (
        normalized[field] === undefined
        || (
          normalized[field] === null
          && nullNormalization.optionalWithDefault === "applyDefault"
        )
      )
      && Object.hasOwn(schema, "default")
    ) {
      normalized[field] = schema.default;
    }
  }

  return normalized;
}

function prepareToolArguments(tool, args) {
  validateToolArguments(tool, args);
  const emptyStringNormalized = applyEmptyStringNormalization(tool, args);
  const normalized = applyToolDefaults(tool, emptyStringNormalized);
  validateCrossFieldArguments(tool, normalized);
  return normalized;
}

const toolDefinitions = [
  {
    name: "get_current_project_state",
    description: "Read-only project state summary: active source files, JSONL counts, output counts, and hashes.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      includeHashes: { type: "boolean", default: true },
    }),
    handler: async (args) => jsonContent(await getCurrentProjectState(args)),
  },
  {
    name: "get_active_engine",
    description: "Read Canon DB active_engine.md metadata, optionally including full text.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      includeText: { type: "boolean", default: false },
    }),
    handler: async (args) => {
      assertObject(args);
      return jsonContent(await fileSnapshot(dataPaths.activeEngine, optionalBoolean(args.includeText, "includeText")));
    },
  },
  {
    name: "get_active_writing_card",
    description: "Read Writing Policy active_writing_card.md metadata, optionally including full text.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      includeText: { type: "boolean", default: false },
    }),
    handler: async (args) => {
      assertObject(args);
      return jsonContent(await fileSnapshot(dataPaths.activeWritingCard, optionalBoolean(args.includeText, "includeText")));
    },
  },
  {
    name: "validate_jsonl",
    description: "Validate known feedback and error-report JSONL files, or specific files.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      all: { type: "boolean" },
      files: { type: "array", items: { type: "string" } },
      schema: { type: "string", enum: ["error_report", "feedback", "generic_pair"] },
      strict: { type: "boolean", default: false },
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [];
      const files = Array.isArray(args.files) ? args.files : [];
      if (files.length === 0 || args.all === true) {
        argv.push("--all");
      }
      for (const file of files) {
        argv.push("--file", String(file));
      }
      pushValue(argv, "--schema", optionalString(args.schema, "schema"));
      pushFlag(argv, "--strict", optionalBoolean(args.strict, "strict"));
      return textContent(await runNodeTool("validate-jsonl.mjs", argv));
    },
  },
  {
    name: "query_mcp_audit",
    description: "Read-only query over data/outputs/logs/mcp_tool_audit.jsonl.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      tool: { type: "string" },
      risk: { type: "string" },
      status: { type: "string" },
      actor: { type: "string" },
      confirmationId: { type: "string" },
      affectedPath: { type: "string" },
      query: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 1000, default: 20 },
      oldest: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      showJson: { type: "boolean", default: false },
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--limit",
        String(optionalInteger(args.limit, "limit", 20)),
      ];
      pushValue(argv, "--tool", optionalString(args.tool, "tool"));
      pushValue(argv, "--risk", optionalString(args.risk, "risk"));
      pushValue(argv, "--status", optionalString(args.status, "status"));
      pushValue(argv, "--actor", optionalString(args.actor, "actor"));
      pushValue(argv, "--confirmation-id", optionalString(args.confirmationId, "confirmationId"));
      pushValue(argv, "--affected-path", optionalString(args.affectedPath, "affectedPath"));
      pushValue(argv, "--query", optionalString(args.query, "query"));
      pushFlag(argv, "--oldest", optionalBoolean(args.oldest, "oldest"));
      pushFlag(argv, "--json", optionalBoolean(args.json, "json"));
      pushFlag(argv, "--show-json", optionalBoolean(args.showJson, "showJson"));
      return textContent(await runNodeTool("query-mcp-audit.mjs", argv));
    },
  },
  {
    name: "build_generation_context",
    description: "Build current_prompt.md and compact generation_context.md from active project sources.",
    risk: "generated-output",
    inputSchema: baseSchema({}),
    handler: async () => textContent(await runNodeTool("build-current-prompt.mjs", [])),
  },
  {
    name: "search_context",
    description: "Search canon, writing policy, proofing policy, longline, error reports, feedback, and memory.",
    risk: "generated-output",
    inputSchema: baseSchema({
      query: { type: "string" },
      top: { type: "integer", minimum: 1, maximum: 100, default: 8 },
      output: { type: "string" },
    }, ["query"]),
    handler: async (args) => {
      assertObject(args);
      const argv = [requiredString(args, "query")];
      const top = optionalInteger(args.top, "top", 8);
      argv.push("--top", String(top));
      pushValue(argv, "--output", optionalString(args.output, "output"));
      return textContent(await runNodeTool("search-context.mjs", argv));
    },
  },
  {
    name: "build_task_prompt",
    description: "Combine generation_context.md and retrieval_context.md into task_prompt.md.",
    risk: "generated-output",
    inputSchema: baseSchema({
      mode: { type: "string", enum: ["next-chapter", "proofread", "settle", "debug"], default: "next-chapter" },
      task: { type: "string" },
      retrieval: { type: "string" },
      output: { type: "string" },
    }, ["task"]),
    handler: async (args) => {
      assertObject(args);
      const argv = ["--task", requiredString(args, "task")];
      pushValue(argv, "--mode", optionalString(args.mode, "mode") || "next-chapter");
      pushValue(argv, "--retrieval", optionalString(args.retrieval, "retrieval"));
      pushValue(argv, "--output", optionalString(args.output, "output"));
      return textContent(await runNodeTool("build-task-prompt.mjs", argv));
    },
  },
  {
    name: "run_pipeline",
    description: "Run build_generation_context, search_context, and build_task_prompt in sequence.",
    risk: "generated-output",
    inputSchema: baseSchema({
      query: { type: "string" },
      task: { type: "string" },
      mode: { type: "string", enum: ["next-chapter", "proofread", "settle", "debug"], default: "next-chapter" },
      top: { type: "integer", minimum: 1, maximum: 100, default: 12 },
      retrievalOutput: { type: "string" },
      taskOutput: { type: "string" },
    }, ["query", "task"]),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--query",
        requiredString(args, "query"),
        "--task",
        requiredString(args, "task"),
        "--top",
        String(optionalInteger(args.top, "top", 12)),
      ];
      pushValue(argv, "--mode", optionalString(args.mode, "mode") || "next-chapter");
      pushValue(argv, "--retrieval-output", optionalString(args.retrievalOutput, "retrievalOutput"));
      pushValue(argv, "--task-output", optionalString(args.taskOutput, "taskOutput"));
      return textContent(await runNodeTool("run-pipeline.mjs", argv, 180_000));
    },
  },
  {
    name: "add_feedback_raw",
    description: "Write raw accepted/rejected/revision/preference feedback and optionally pending error candidates.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      type: { type: "string", enum: ["accepted", "rejected", "revision", "preference"], default: "rejected" },
      feedback: { type: "string" },
      taskType: { type: "string" },
      chapter: { type: "string" },
      draftFile: { type: "string" },
      characters: { type: "string" },
      sceneType: { type: "string" },
      severity: { type: "string", enum: ["P0", "P1", "P2", "P3", "P4"] },
      category: { type: "string" },
      badPattern: { type: "string" },
      whyBad: { type: "string" },
      fixRule: { type: "string" },
      action: { type: "string" },
      noCandidate: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
    }, ["feedback"]),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--type",
        optionalString(args.type, "type") || "rejected",
        "--feedback",
        requiredString(args, "feedback"),
      ];
      pushValue(argv, "--task-type", optionalString(args.taskType, "taskType"));
      pushValue(argv, "--chapter", optionalString(args.chapter, "chapter"));
      pushValue(argv, "--draft-file", optionalString(args.draftFile, "draftFile"));
      pushValue(argv, "--characters", optionalString(args.characters, "characters"));
      pushValue(argv, "--scene-type", optionalString(args.sceneType, "sceneType"));
      pushValue(argv, "--severity", optionalString(args.severity, "severity"));
      pushValue(argv, "--category", optionalString(args.category, "category"));
      pushValue(argv, "--bad-pattern", optionalString(args.badPattern, "badPattern"));
      pushValue(argv, "--why-bad", optionalString(args.whyBad, "whyBad"));
      pushValue(argv, "--fix-rule", optionalString(args.fixRule, "fixRule"));
      pushValue(argv, "--action", optionalString(args.action, "action"));
      pushFlag(argv, "--no-candidate", optionalBoolean(args.noCandidate, "noCandidate"));
      pushFlag(argv, "--dry-run", optionalBoolean(args.dryRun, "dryRun"));
      return textContent(await runNodeTool("add-feedback.mjs", argv));
    },
  },
  {
    name: "save_draft",
    description: "Save a candidate draft under data/outputs/drafts and append draft_index.jsonl.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      title: { type: "string" },
      chapter: { type: "string" },
      taskType: { type: "string" },
      taskPrompt: { type: "string" },
      status: { type: "string" },
      text: { type: "string" },
      sourceFile: { type: "string" },
      dryRun: { type: "boolean", default: false },
    }, ["title"]),
    handler: async (args) => {
      assertObject(args);
      const argv = ["--title", requiredString(args, "title")];
      pushValue(argv, "--chapter", optionalString(args.chapter, "chapter"));
      pushValue(argv, "--task-type", optionalString(args.taskType, "taskType"));
      pushValue(argv, "--task-prompt", optionalString(args.taskPrompt, "taskPrompt"));
      pushValue(argv, "--status", optionalString(args.status, "status"));
      pushValue(argv, "--text", optionalString(args.text, "text"));
      pushValue(argv, "--source-file", optionalString(args.sourceFile, "sourceFile"));
      pushFlag(argv, "--dry-run", optionalBoolean(args.dryRun, "dryRun"));
      return textContent(await runNodeTool("save-draft.mjs", argv));
    },
  },
  {
    name: "save_proof_report",
    description: "Save a proof report under data/outputs/proof_reports and append proof_report_index.jsonl.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      title: { type: "string" },
      chapter: { type: "string" },
      draftId: { type: "string" },
      verdict: { type: "string", enum: ["pass", "needs_rewrite", "reject", "stop"], default: "needs_rewrite" },
      severity: { type: "string", enum: ["P0", "P1", "P2", "P3", "P4"], default: "P2" },
      taskPrompt: { type: "string" },
      text: { type: "string" },
      sourceFile: { type: "string" },
      dryRun: { type: "boolean", default: false },
    }, ["title"]),
    handler: async (args) => {
      assertObject(args);
      const argv = ["--title", requiredString(args, "title")];
      pushValue(argv, "--chapter", optionalString(args.chapter, "chapter"));
      pushValue(argv, "--draft-id", optionalString(args.draftId, "draftId"));
      pushValue(argv, "--verdict", optionalString(args.verdict, "verdict"));
      pushValue(argv, "--severity", optionalString(args.severity, "severity"));
      pushValue(argv, "--task-prompt", optionalString(args.taskPrompt, "taskPrompt"));
      pushValue(argv, "--text", optionalString(args.text, "text"));
      pushValue(argv, "--source-file", optionalString(args.sourceFile, "sourceFile"));
      pushFlag(argv, "--dry-run", optionalBoolean(args.dryRun, "dryRun"));
      return textContent(await runNodeTool("save-proof-report.mjs", argv));
    },
  },
  {
    name: "import_policy_file",
    description: "High-risk write: import a policy source into an active file and version copy. Requires confirm=IMPORT_POLICY for real write.",
    risk: "high-risk-write",
    inputSchema: baseSchema({
      kind: { type: "string", enum: ["engine", "writing", "proofing", "longline"] },
      source: { type: "string" },
      version: { type: "string" },
      force: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: true },
      confirm: { type: "string" },
    }, ["kind", "source"], [], {
      field: "confirm",
      requiredValue: "IMPORT_POLICY",
      when: { dryRun: false },
      message: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--kind",
        requiredString(args, "kind"),
        "--source",
        requiredString(args, "source"),
      ];
      pushValue(argv, "--version", optionalString(args.version, "version"));
      pushFlag(argv, "--force", optionalBoolean(args.force, "force"));
      pushFlag(argv, "--dry-run", args.dryRun !== false);
      pushValue(argv, "--confirm", optionalString(args.confirm, "confirm"));
      return textContent(await runNodeTool("import-policy-file.mjs", argv));
    },
  },
  {
    name: "commit_error_report",
    description: "High-risk write: commit a pending error candidate into formal Error Report DB. Requires confirm=COMMIT for real write.",
    risk: "high-risk-write",
    inputSchema: baseSchema({
      pending: { type: "string" },
      errorId: { type: "string" },
      feedbackId: { type: "string" },
      latest: { type: "boolean", default: false },
      target: { type: "string", enum: ["canon", "character", "dialogue", "pacing", "battle", "preference"] },
      list: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
      confirm: { type: "string" },
    }, [], [{
      type: "selectorOrList",
      listField: "list",
      selectorFields: ["errorId", "feedbackId", "latest"],
      message: "Use --list without selectors, or choose exactly one selector: --error-id, --feedback-id or --latest.",
    }], {
      field: "confirm",
      requiredValue: "COMMIT",
      when: { dryRun: false },
      unless: { list: true },
      message: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [];
      pushValue(argv, "--pending", optionalString(args.pending, "pending"));
      pushValue(argv, "--error-id", optionalString(args.errorId, "errorId"));
      pushValue(argv, "--feedback-id", optionalString(args.feedbackId, "feedbackId"));
      pushFlag(argv, "--latest", optionalBoolean(args.latest, "latest"));
      pushValue(argv, "--target", optionalString(args.target, "target"));
      pushFlag(argv, "--list", optionalBoolean(args.list, "list"));
      pushFlag(argv, "--dry-run", optionalBoolean(args.dryRun, "dryRun"));
      pushValue(argv, "--confirm", optionalString(args.confirm, "confirm"));
      return textContent(await runNodeTool("commit-error-report.mjs", argv));
    },
  },
  {
    name: "compress_error_rules",
    description: "Compress formal active Error Report DB entries into candidate or active compressed_rules.md. Active update requires confirm=UPDATE_RULES.",
    risk: "high-risk-write",
    inputSchema: baseSchema({
      top: { type: "integer", minimum: 1, maximum: 1000, default: 24 },
      minCount: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
      includeArchived: { type: "boolean", default: false },
      candidateOutput: { type: "string" },
      writeCandidate: { type: "boolean", default: false },
      updateActive: { type: "boolean", default: false },
      confirm: { type: "string" },
      allowEmpty: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: true },
    }, [], [], {
      field: "confirm",
      requiredValue: "UPDATE_RULES",
      when: { dryRun: false, updateActive: true },
      message: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--top",
        String(optionalInteger(args.top, "top", 24)),
        "--min-count",
        String(optionalInteger(args.minCount, "minCount", 1)),
      ];
      pushFlag(argv, "--include-archived", optionalBoolean(args.includeArchived, "includeArchived"));
      pushValue(argv, "--candidate-output", optionalString(args.candidateOutput, "candidateOutput"));
      pushFlag(argv, "--write-candidate", optionalBoolean(args.writeCandidate, "writeCandidate"));
      pushFlag(argv, "--update-active", optionalBoolean(args.updateActive, "updateActive"));
      pushValue(argv, "--confirm", optionalString(args.confirm, "confirm"));
      pushFlag(argv, "--allow-empty", optionalBoolean(args.allowEmpty, "allowEmpty"));
      pushFlag(argv, "--dry-run", args.dryRun !== false);
      return textContent(await runNodeTool("compress-error-rules.mjs", argv));
    },
  },
  {
    name: "create_settlement_proposal",
    description: "High-risk workflow artifact: create a formal settlement proposal from adopted text. Requires confirmAdopted=true for real write.",
    risk: "high-risk-write",
    inputSchema: baseSchema({
      chapter: { type: "string" },
      title: { type: "string" },
      draftId: { type: "string" },
      sourceFile: { type: "string" },
      text: { type: "string" },
      taskPrompt: { type: "string" },
      established: { type: "array", items: { type: "string" } },
      unsettled: { type: "array", items: { type: "string" } },
      reminders: { type: "array", items: { type: "string" } },
      notes: { type: "array", items: { type: "string" } },
      confirmAdopted: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
    }, ["chapter", "title"], [{
      type: "exactlyOne",
      fields: ["draftId", "sourceFile", "text"],
      message: "Provide exactly one input source: --draft-id, --source-file or --text.",
    }], {
      field: "confirmAdopted",
      requiredValue: true,
      when: { dryRun: false },
      message: "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.",
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [
        "--chapter",
        requiredString(args, "chapter"),
        "--title",
        requiredString(args, "title"),
      ];
      pushValue(argv, "--draft-id", optionalString(args.draftId, "draftId"));
      pushValue(argv, "--source-file", optionalString(args.sourceFile, "sourceFile"));
      pushValue(argv, "--text", optionalString(args.text, "text"));
      pushValue(argv, "--task-prompt", optionalString(args.taskPrompt, "taskPrompt"));
      pushRepeated(argv, "--established", args.established, "established");
      pushRepeated(argv, "--unsettled", args.unsettled, "unsettled");
      pushRepeated(argv, "--reminder", args.reminders, "reminders");
      pushRepeated(argv, "--note", args.notes, "notes");
      pushFlag(argv, "--confirm-adopted", optionalBoolean(args.confirmAdopted, "confirmAdopted"));
      pushFlag(argv, "--dry-run", optionalBoolean(args.dryRun, "dryRun"));
      return textContent(await runNodeTool("create-settlement-proposal.mjs", argv));
    },
  },
  {
    name: "activate_engine_version",
    description: "High-risk write: activate a versioned engine file as active_engine.md. Requires confirm=ACTIVATE for real write.",
    risk: "high-risk-write",
    inputSchema: baseSchema({
      version: { type: "string" },
      candidate: { type: "string" },
      active: { type: "string" },
      requiredCurrentSha: { type: "string" },
      reason: { type: "string" },
      dryRun: { type: "boolean", default: true },
      confirm: { type: "string" },
    }, [], [{
      type: "exactlyOne",
      fields: ["version", "candidate"],
      message: "Provide exactly one candidate source: --version or --candidate.",
    }], {
      field: "confirm",
      requiredValue: "ACTIVATE",
      when: { dryRun: false },
      message: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
    }),
    handler: async (args) => {
      assertObject(args);
      const argv = [];
      pushValue(argv, "--version", optionalString(args.version, "version"));
      pushValue(argv, "--candidate", optionalString(args.candidate, "candidate"));
      pushValue(argv, "--active", optionalString(args.active, "active"));
      pushValue(argv, "--required-current-sha", optionalString(args.requiredCurrentSha, "requiredCurrentSha"));
      pushValue(argv, "--reason", optionalString(args.reason, "reason"));
      pushFlag(argv, "--dry-run", args.dryRun !== false);
      pushValue(argv, "--confirm", optionalString(args.confirm, "confirm"));
      return textContent(await runNodeTool("activate-engine-version.mjs", argv));
    },
  },
];

const toolRegistry = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

const permissionSources = {
  get_current_project_state: ["repository"],
  get_active_engine: ["canon_db"],
  get_active_writing_card: ["writing_policy_db"],
  validate_jsonl: ["feedback_db", "error_report_db"],
  query_mcp_audit: ["mcp_audit_log"],
  build_generation_context: ["source_trust_catalog", "registered_project_sources"],
  search_context: ["source_trust_catalog", "registered_project_sources"],
  build_task_prompt: ["generated_context", "retrieval_context", "user_input"],
  run_pipeline: ["source_trust_catalog", "registered_project_sources", "user_input"],
  add_feedback_raw: ["user_input", "candidate_draft"],
  save_draft: ["user_input", "candidate_source"],
  save_proof_report: ["user_input", "candidate_draft"],
  import_policy_file: ["user_confirmed_external_file", "repository_version_file"],
  commit_error_report: ["pending_error_reports"],
  compress_error_rules: ["formal_error_report_db"],
  create_settlement_proposal: ["adopted_candidate_draft", "user_input"],
  activate_engine_version: ["canon_version_file", "reviewed_candidate_file"],
};

const backupRequiredTools = new Set([
  "import_policy_file",
  "compress_error_rules",
  "activate_engine_version",
]);

function permissionMetadata(tool) {
  const isRead = tool.risk === "read";
  const isHighRisk = tool.risk === "high-risk-write";
  const canModifyActiveEngine = [
    "import_policy_file",
    "activate_engine_version",
  ].includes(tool.name);

  return {
    tool_name: tool.name,
    permission_level: isRead
      ? "read_only"
      : isHighRisk
        ? "write_high_risk"
        : "write_low_risk",
    read_or_write: isRead ? "read" : "write",
    risk_level: tool.risk,
    requires_user_confirmation: isHighRisk,
    requires_backup_before_write: backupRequiredTools.has(tool.name),
    allowed_sources: permissionSources[tool.name] ?? [],
    forbidden_sources: ["unregistered_external_source", "rejected_or_deprecated_source"],
    can_modify_canon: canModifyActiveEngine,
    can_modify_active_engine: canModifyActiveEngine,
    can_modify_story_graph: false,
    can_modify_memory: false,
    can_commit_error_report: tool.name === "commit_error_report",
    log_required: !isRead,
  };
}

function publicToolDefinition(tool) {
  return {
    name: tool.name,
    description: `[${tool.risk}] ${tool.description}`,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    _meta: {
      "armed-academy/permission": permissionMetadata(tool),
    },
  };
}

async function publicResourceDefinition(resource) {
  const snapshot = await auditSnapshot(resource.filePath);
  return {
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
    metadata: {
      path: normalizePath(resource.filePath),
      exists: snapshot.exists,
      bytes: snapshot.bytes,
      modified_at: snapshot.modified_at,
      sha256: snapshot.sha256,
    },
  };
}

async function listResources() {
  return {
    resources: await Promise.all(resourceDefinitions.map((resource) => publicResourceDefinition(resource))),
  };
}

async function readResource(params) {
  if (!isObject(params)) {
    throw new Error("resources/read params must be an object.");
  }

  const uri = requiredString(params, "uri");
  const resource = resourceRegistry.get(uri);
  if (!resource) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  const text = await readFile(resource.filePath, "utf8");
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text,
      },
    ],
  };
}

async function publicPromptDefinition(prompt) {
  const snapshot = await auditSnapshot(prompt.filePath);
  return {
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments,
    metadata: {
      path: normalizePath(prompt.filePath),
      exists: snapshot.exists,
      bytes: snapshot.bytes,
      modified_at: snapshot.modified_at,
      sha256: snapshot.sha256,
    },
  };
}

async function listPrompts() {
  return {
    prompts: await Promise.all(promptDefinitions.map((prompt) => publicPromptDefinition(prompt))),
  };
}

function renderPromptArguments(args) {
  if (!isObject(args) || Object.keys(args).length === 0) {
    return "";
  }

  return [
    "",
    "## Runtime Arguments",
    "",
    "```json",
    JSON.stringify(args, null, 2),
    "```",
    "",
  ].join("\n");
}

async function getPrompt(params) {
  if (!isObject(params)) {
    throw new Error("prompts/get params must be an object.");
  }

  const name = requiredString(params, "name");
  const prompt = promptRegistry.get(name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  const args = isObject(params.arguments) ? params.arguments : {};
  const template = await readFile(prompt.filePath, "utf8");
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `${template.trimEnd()}${renderPromptArguments(args)}`,
        },
      },
    ],
  };
}

function makeError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return {
    jsonrpc: "2.0",
    id,
    error,
  };
}

function makeResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

const maxPendingResponseMessages = 256;
const responseResumeLowWaterMark = 128;
let pendingResponseMessages = 0;
let responseWriteChain = Promise.resolve();
let inputPausedForResponseBackpressure = false;
let inputEnded = false;
let inputEndFinalized = false;

function encodeMessage(message, framing) {
  const json = JSON.stringify(message);
  if (framing === "header") {
    return (
      `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`
    );
  }
  return `${json}\n`;
}

function writeStdoutFrame(frame) {
  return new Promise((resolve, reject) => {
    let callbackComplete = false;
    let drainComplete = true;

    const finish = () => {
      if (callbackComplete && drainComplete) {
        resolve();
      }
    };
    const accepted = process.stdout.write(frame, (error) => {
      if (error) {
        reject(error);
        return;
      }
      callbackComplete = true;
      finish();
    });
    if (!accepted) {
      drainComplete = false;
      process.stdout.once("drain", () => {
        drainComplete = true;
        finish();
      });
    }
  });
}

function pauseInputForResponseBackpressure() {
  if (inputPausedForResponseBackpressure) {
    return;
  }
  inputPausedForResponseBackpressure = true;
  process.stdin.pause();
}

function resumeInputAfterResponseBackpressure() {
  if (
    !inputPausedForResponseBackpressure
    || pendingResponseMessages > responseResumeLowWaterMark
  ) {
    return;
  }
  inputPausedForResponseBackpressure = false;
  queueMicrotask(() => {
    processInputBuffer();
    if (inputEnded) {
      maybeFinalizeEndOfInput();
    } else if (!inputPausedForResponseBackpressure) {
      process.stdin.resume();
    }
  });
}

function writeMessage(message, framing = "line") {
  const frame = encodeMessage(message, framing);
  pendingResponseMessages += 1;
  if (pendingResponseMessages >= maxPendingResponseMessages) {
    pauseInputForResponseBackpressure();
  }

  responseWriteChain = responseWriteChain
    .then(() => writeStdoutFrame(frame))
    .catch((error) => {
      process.exitCode = 1;
      console.error(`MCP stdout write failed: ${error.message}`);
    })
    .finally(() => {
      pendingResponseMessages -= 1;
      resumeInputAfterResponseBackpressure();
    });
  return responseWriteChain;
}

async function callTool(params) {
  if (!isObject(params)) {
    throw new Error("tools/call params must be an object.");
  }

  const name = requiredString(params, "name");
  const tool = toolRegistry.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const args = isObject(params.arguments) ? params.arguments : {};
  const actor = isObject(params._meta) && typeof params._meta.actor === "string"
    ? params._meta.actor
    : "mcp-client";

  if (tool.risk !== "read") {
    return auditedToolCall(tool, args, actor);
  }

  try {
    const effectiveArgs = prepareToolArguments(tool, args);
    return await tool.handler(effectiveArgs);
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error.message,
        },
      ],
    };
  }
}

async function dispatch(message) {
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return makeError(message?.id ?? null, -32600, "Invalid Request");
  }

  if (!("id" in message)) {
    if (message.method === "notifications/initialized" || message.method.startsWith("notifications/")) {
      return null;
    }
    return null;
  }

  if (message.method === "initialize") {
    const requestedVersion = isObject(message.params) ? optionalString(message.params.protocolVersion, "protocolVersion") : "";
    return makeResult(message.id, {
      protocolVersion: requestedVersion || defaultProtocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: {},
        prompts: {
          listChanged: false,
        },
      },
      serverInfo,
      instructions: "Use tools/list and tools/call. High-risk write tools require their explicit confirmation tokens.",
    });
  }

  if (message.method === "ping") {
    return makeResult(message.id, {});
  }

  if (message.method === "tools/list") {
    return makeResult(message.id, {
      tools: toolDefinitions.map(publicToolDefinition),
    });
  }

  if (message.method === "tools/call") {
    try {
      return makeResult(message.id, await callTool(message.params));
    } catch (error) {
      return makeError(message.id, -32602, error.message);
    }
  }

  if (message.method === "resources/list") {
    return makeResult(message.id, await listResources());
  }

  if (message.method === "resources/read") {
    try {
      return makeResult(message.id, await readResource(message.params));
    } catch (error) {
      return makeError(message.id, -32602, error.message);
    }
  }

  if (message.method === "prompts/list") {
    return makeResult(message.id, await listPrompts());
  }

  if (message.method === "prompts/get") {
    try {
      return makeResult(message.id, await getPrompt(message.params));
    } catch (error) {
      return makeError(message.id, -32602, error.message);
    }
  }

  return makeError(message.id, -32601, `Method not found: ${message.method}`);
}

const maxPendingDispatchMessages = 256;
const dispatchQueueOverloadMessage = (
  `Server overloaded: dispatch queue limit of ${maxPendingDispatchMessages} messages reached.`
);

let pending = Promise.resolve();
let pendingDispatchMessages = 0;

function enqueueMessage(message, framing) {
  if (pendingDispatchMessages >= maxPendingDispatchMessages) {
    if (isObject(message) && Object.hasOwn(message, "id")) {
      writeMessage(
        makeError(message.id ?? null, -32000, dispatchQueueOverloadMessage),
        framing,
      );
    }
    return false;
  }

  pendingDispatchMessages += 1;
  pending = pending
    .then(async () => {
      const response = await dispatch(message);
      if (response) {
        await writeMessage(response, framing);
      }
    })
    .catch(async (error) => {
      await writeMessage(
        makeError(message?.id ?? null, -32603, error.message),
        framing,
      );
    })
    .finally(() => {
      pendingDispatchMessages -= 1;
    });
  return true;
}

const maxJsonRpcMessageBytes = 16 * 1024 * 1024;
const maxContentLengthHeaderBytes = 8 * 1024;
const headerSeparator = Buffer.from("\r\n\r\n");
const messageTooLargeError = (
  `Parse error: JSON-RPC message exceeds ${maxJsonRpcMessageBytes} bytes.`
);
const headerTooLargeError = (
  `Parse error: Content-Length header exceeds ${maxContentLengthHeaderBytes} bytes.`
);

let inputBuffer = Buffer.alloc(0);
let oversizedBodyBytesRemaining = 0;
let discardingOversizedLine = false;
let discardingOversizedHeader = false;
let oversizedHeaderDiscardTail = Buffer.alloc(0);
let oversizedHeaderDeclaredBodyBytes = null;

function parseDeclaredContentLengthPrefix(buffer) {
  const prefix = buffer.subarray(0, Math.min(buffer.length, 256)).toString("ascii");
  const firstLineEnd = prefix.indexOf("\r\n");
  const firstLine = firstLineEnd === -1 ? prefix : prefix.slice(0, firstLineEnd);
  const match = firstLine.match(/^Content-Length:\s*(\d+)\s*$/i);
  if (!match) {
    return null;
  }
  const length = Number(match[1]);
  return Number.isSafeInteger(length) ? length : null;
}

function parseContentLengthHeader(header) {
  const contentLengthValues = header
    .split("\r\n")
    .filter((line) => /^Content-Length:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim());

  if (contentLengthValues.length === 0) {
    return { error: "Parse error: missing Content-Length" };
  }

  if (contentLengthValues.length > 1) {
    const uniqueValues = new Set(contentLengthValues);
    return {
      error: uniqueValues.size === 1
        ? "Parse error: duplicate Content-Length headers are not allowed."
        : "Parse error: conflicting Content-Length headers are not allowed.",
    };
  }

  const [rawValue] = contentLengthValues;
  if (/^\d+$/.test(rawValue)) {
    const length = Number(rawValue);
    if (!Number.isSafeInteger(length)) {
      return {
        error: "Parse error: Content-Length exceeds JavaScript safe integer range.",
      };
    }
    return { length };
  }
  if (/^-\d+$/.test(rawValue)) {
    return { error: "Parse error: Content-Length must not be negative." };
  }
  if (/^\d/.test(rawValue)) {
    return { error: "Parse error: Content-Length must contain decimal digits only." };
  }
  return { error: "Parse error: missing Content-Length" };
}

function processInputBuffer() {
  while (
    inputBuffer.length > 0
    && pendingResponseMessages < maxPendingResponseMessages
  ) {
    const prefix = inputBuffer.subarray(0, 32).toString("ascii");
    if (/^Content-Length:/i.test(prefix)) {
      const headerEnd = inputBuffer.indexOf(headerSeparator);
      if (headerEnd === -1) {
        if (inputBuffer.length > maxContentLengthHeaderBytes) {
          writeMessage(makeError(null, -32700, headerTooLargeError), "header");
          oversizedHeaderDeclaredBodyBytes = parseDeclaredContentLengthPrefix(inputBuffer);
          oversizedHeaderDiscardTail = Buffer.from(
            inputBuffer.subarray(Math.max(0, inputBuffer.length - headerSeparator.length + 1)),
          );
          inputBuffer = Buffer.alloc(0);
          discardingOversizedHeader = true;
        }
        return;
      }

      if (headerEnd > maxContentLengthHeaderBytes) {
        writeMessage(makeError(null, -32700, headerTooLargeError), "header");
        const declaredBodyBytes = parseDeclaredContentLengthPrefix(inputBuffer);
        inputBuffer = inputBuffer.subarray(headerEnd + headerSeparator.length);
        if (declaredBodyBytes !== null) {
          const discardedBodyBytes = Math.min(declaredBodyBytes, inputBuffer.length);
          inputBuffer = inputBuffer.subarray(discardedBodyBytes);
          oversizedBodyBytesRemaining = declaredBodyBytes - discardedBodyBytes;
          if (oversizedBodyBytesRemaining > 0) {
            return;
          }
        }
        continue;
      }

      const header = inputBuffer.subarray(0, headerEnd).toString("ascii");
      const parsedHeader = parseContentLengthHeader(header);
      if (parsedHeader.error) {
        writeMessage(makeError(null, -32700, parsedHeader.error), "header");
        inputBuffer = inputBuffer.subarray(headerEnd + headerSeparator.length);
        continue;
      }

      const { length } = parsedHeader;
      const bodyStart = headerEnd + headerSeparator.length;
      if (length > maxJsonRpcMessageBytes) {
        writeMessage(makeError(null, -32700, messageTooLargeError), "header");
        const availableBodyBytes = inputBuffer.length - bodyStart;
        const discardedBodyBytes = Math.min(length, availableBodyBytes);
        inputBuffer = inputBuffer.subarray(bodyStart + discardedBodyBytes);
        oversizedBodyBytesRemaining = length - discardedBodyBytes;
        if (oversizedBodyBytesRemaining > 0) {
          return;
        }
        continue;
      }

      if (inputBuffer.length < bodyStart + length) {
        return;
      }

      const body = inputBuffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      inputBuffer = inputBuffer.subarray(bodyStart + length);
      try {
        enqueueMessage(JSON.parse(body), "header");
      } catch (error) {
        writeMessage(makeError(null, -32700, `Parse error: ${error.message}`), "header");
      }
      continue;
    }

    const newlineIndex = inputBuffer.indexOf(0x0a);
    if (newlineIndex === -1) {
      if (inputBuffer.length > maxJsonRpcMessageBytes) {
        writeMessage(makeError(null, -32700, messageTooLargeError), "line");
        inputBuffer = Buffer.alloc(0);
        discardingOversizedLine = true;
      }
      return;
    }

    const lineEnd = newlineIndex > 0 && inputBuffer[newlineIndex - 1] === 0x0d
      ? newlineIndex - 1
      : newlineIndex;
    if (lineEnd > maxJsonRpcMessageBytes) {
      writeMessage(makeError(null, -32700, messageTooLargeError), "line");
      inputBuffer = inputBuffer.subarray(newlineIndex + 1);
      continue;
    }

    const line = inputBuffer.subarray(0, lineEnd).toString("utf8").trim();
    inputBuffer = inputBuffer.subarray(newlineIndex + 1);
    if (!line) {
      continue;
    }

    try {
      enqueueMessage(JSON.parse(line), "line");
    } catch (error) {
      writeMessage(makeError(null, -32700, `Parse error: ${error.message}`), "line");
    }
  }
}

function acceptInputChunk(chunk) {
  let incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");

  while (incoming.length > 0) {
    if (oversizedBodyBytesRemaining > 0) {
      const discardedBytes = Math.min(oversizedBodyBytesRemaining, incoming.length);
      oversizedBodyBytesRemaining -= discardedBytes;
      incoming = incoming.subarray(discardedBytes);
      continue;
    }

    if (discardingOversizedLine) {
      const newlineIndex = incoming.indexOf(0x0a);
      if (newlineIndex === -1) {
        return;
      }
      discardingOversizedLine = false;
      incoming = incoming.subarray(newlineIndex + 1);
      continue;
    }

    if (discardingOversizedHeader) {
      const combined = oversizedHeaderDiscardTail.length > 0
        ? Buffer.concat([oversizedHeaderDiscardTail, incoming])
        : incoming;
      const headerEnd = combined.indexOf(headerSeparator);
      if (headerEnd === -1) {
        oversizedHeaderDiscardTail = Buffer.from(
          combined.subarray(Math.max(0, combined.length - headerSeparator.length + 1)),
        );
        return;
      }
      discardingOversizedHeader = false;
      oversizedHeaderDiscardTail = Buffer.alloc(0);
      incoming = combined.subarray(headerEnd + headerSeparator.length);
      if (oversizedHeaderDeclaredBodyBytes !== null) {
        const discardedBodyBytes = Math.min(
          oversizedHeaderDeclaredBodyBytes,
          incoming.length,
        );
        oversizedBodyBytesRemaining = (
          oversizedHeaderDeclaredBodyBytes - discardedBodyBytes
        );
        oversizedHeaderDeclaredBodyBytes = null;
        incoming = incoming.subarray(discardedBodyBytes);
      }
      continue;
    }

    inputBuffer = Buffer.concat([inputBuffer, incoming]);
    processInputBuffer();
    return;
  }
}

function getEndOfInputParseError() {
  if (
    oversizedBodyBytesRemaining > 0
    || discardingOversizedLine
    || discardingOversizedHeader
  ) {
    return null;
  }

  if (inputBuffer.length === 0 || inputBuffer.toString("utf8").trim() === "") {
    return null;
  }

  const prefix = inputBuffer.subarray(0, 32).toString("ascii");
  if (/^Content-Length:/i.test(prefix)) {
    const headerEnd = inputBuffer.indexOf(headerSeparator);
    if (headerEnd === -1) {
      return {
        framing: "header",
        message: "Parse error: incomplete Content-Length header at end of input.",
      };
    }

    const header = inputBuffer.subarray(0, headerEnd).toString("ascii");
    const parsedHeader = parseContentLengthHeader(header);
    if (parsedHeader.length !== undefined) {
      const expectedBytes = parsedHeader.length;
      const receivedBytes = inputBuffer.length - headerEnd - headerSeparator.length;
      if (receivedBytes < expectedBytes) {
        return {
          framing: "header",
          message: (
            "Parse error: incomplete Content-Length body at end of input: "
            + `expected ${expectedBytes} bytes, received ${receivedBytes}.`
          ),
        };
      }
    }
  }

  return {
    framing: "line",
    message: "Parse error: incomplete newline-delimited JSON at end of input.",
  };
}

function maybeFinalizeEndOfInput() {
  if (
    !inputEnded
    || inputEndFinalized
    || inputPausedForResponseBackpressure
    || pendingResponseMessages >= maxPendingResponseMessages
  ) {
    return;
  }

  processInputBuffer();
  if (
    inputPausedForResponseBackpressure
    || pendingResponseMessages >= maxPendingResponseMessages
  ) {
    return;
  }

  inputEndFinalized = true;
  const parseError = getEndOfInputParseError();
  if (parseError) {
    pending = pending.then(async () => {
      await writeMessage(
        makeError(null, -32700, parseError.message),
        parseError.framing,
      );
    });
  }
  pending.catch(() => {});
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(usage());
  process.exit(0);
}

process.stdin.on("data", (chunk) => {
  acceptInputChunk(chunk);
});
process.stdin.on("end", () => {
  inputEnded = true;
  maybeFinalizeEndOfInput();
});
