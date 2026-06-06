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

function pushRepeated(argv, flag, values) {
  if (values === undefined || values === null || values === "") {
    return;
  }

  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    if (value !== undefined && value !== null && String(value).trim()) {
      argv.push(flag, String(value));
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
  if (tool.name === "import_policy_file" && args.dryRun === false && args.confirm !== "IMPORT_POLICY") {
    return "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.";
  }

  if (
    tool.name === "commit_error_report"
    && args.dryRun === false
    && args.list !== true
    && args.confirm !== "COMMIT"
  ) {
    return "Confirmation required: commit_error_report real writes require confirm=COMMIT.";
  }

  if (
    tool.name === "compress_error_rules"
    && args.dryRun === false
    && args.updateActive === true
    && args.confirm !== "UPDATE_RULES"
  ) {
    return "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.";
  }

  if (
    tool.name === "create_settlement_proposal"
    && args.dryRun === false
    && args.confirmAdopted !== true
  ) {
    return "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.";
  }

  if (
    tool.name === "activate_engine_version"
    && args.dryRun === false
    && args.confirm !== "ACTIVATE"
  ) {
    return "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.";
  }

  return "";
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

  try {
    const guardError = confirmationGuardError(tool, args);
    if (guardError) {
      throw new Error(guardError);
    }
    result = await tool.handler(args);
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
    input_summary: summarizeToolArguments(args),
    affected_paths: changed.map((item) => item.path),
    previous_version: Object.fromEntries(changed.map((item) => [item.path, item.previous])),
    new_version: Object.fromEntries(changed.map((item) => [item.path, item.current])),
    confirmation_id: confirmationId(args),
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

function baseSchema(properties = {}, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
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
      all: { type: "boolean", default: true },
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
      limit: { type: "integer", minimum: 1, default: 20 },
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
      top: { type: "integer", minimum: 1, default: 8 },
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
      top: { type: "integer", minimum: 1, default: 12 },
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
    }, ["kind", "source"]),
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
      top: { type: "integer", minimum: 1, default: 24 },
      minCount: { type: "integer", minimum: 1, default: 1 },
      includeArchived: { type: "boolean", default: false },
      candidateOutput: { type: "string" },
      writeCandidate: { type: "boolean", default: false },
      updateActive: { type: "boolean", default: false },
      confirm: { type: "string" },
      allowEmpty: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: true },
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
    }, ["chapter", "title"]),
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
      pushRepeated(argv, "--established", args.established);
      pushRepeated(argv, "--unsettled", args.unsettled);
      pushRepeated(argv, "--reminder", args.reminders);
      pushRepeated(argv, "--note", args.notes);
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

function publicToolDefinition(tool) {
  return {
    name: tool.name,
    description: `[${tool.risk}] ${tool.description}`,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
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

function writeMessage(message, framing = "line") {
  const json = JSON.stringify(message);
  if (framing === "header") {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
    return;
  }
  process.stdout.write(`${json}\n`);
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
    return await tool.handler(args);
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

let pending = Promise.resolve();

function enqueueMessage(message, framing) {
  pending = pending
    .then(async () => {
      const response = await dispatch(message);
      if (response) {
        writeMessage(response, framing);
      }
    })
    .catch((error) => {
      writeMessage(makeError(message?.id ?? null, -32603, error.message), framing);
    });
}

let inputBuffer = Buffer.alloc(0);

function processInputBuffer() {
  while (inputBuffer.length > 0) {
    const prefix = inputBuffer.subarray(0, 32).toString("ascii");
    if (/^Content-Length:/i.test(prefix)) {
      const headerEnd = inputBuffer.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEnd === -1) {
        return;
      }

      const header = inputBuffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        writeMessage(makeError(null, -32700, "Parse error: missing Content-Length"), "header");
        inputBuffer = inputBuffer.subarray(headerEnd + 4);
        continue;
      }

      const length = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
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
      return;
    }

    const line = inputBuffer.subarray(0, newlineIndex).toString("utf8").trim();
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

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(usage());
  process.exit(0);
}

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([
    inputBuffer,
    Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"),
  ]);
  processInputBuffer();
});
process.stdin.on("end", () => {
  pending.catch(() => {});
});
