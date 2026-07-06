import "./mcp-stdio-guard.mjs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  assertExactPath,
  assertPathInside,
  projectPaths,
  resolveCandidateMarkdownPath,
  resolveGeneratedMarkdownPath,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  atomicWriteFile,
  commitFileTransaction,
} from "./file-transactions.mjs";
import {
  get_creative_task_status,
  list_creative_task_types,
  run_creative_task,
} from "./mcp-creative-task-tools.mjs";
import {
  build_gpt_writing_context,
  get_gpt_writing_context_bundle,
  list_gpt_writing_context_bundles,
} from "./mcp-gpt-writing-context-tools.mjs";
import {
  get_writing_candidate_detail,
  list_writing_candidates,
  save_chat_output_as_writing_candidate,
} from "./mcp-chat-output-candidate-tools.mjs";
import {
  build_candidate_proofing_context,
  get_candidate_proofing_context,
  get_proof_report_detail,
  list_candidate_proofing_contexts,
  list_proof_reports,
  save_chat_output_as_proof_report,
} from "./mcp-candidate-proofing-tools.mjs";
import {
  get_writing_candidate_adoption_request,
  list_writing_candidate_adoption_requests,
  request_writing_candidate_adoption,
} from "./mcp-candidate-adoption-request-tools.mjs";
import {
  get_adopted_writing_detail,
  list_adopted_writings,
} from "./mcp-adopted-writing-tools.mjs";
import {
  build_adopted_writing_settlement_context,
  build_pending_engine_candidate_from_settlement_report,
  get_adopted_writing_settlement_context,
  get_foreshadowing_settlement_surface,
  get_settlement_report_detail,
  list_adopted_writing_settlement_contexts,
  list_settlement_reports,
  save_chat_output_as_settlement_report,
} from "./mcp-adopted-writing-settlement-tools.mjs";
import {
  build_pending_engine_candidate_review,
  get_pending_engine_candidate_review,
  list_pending_engine_candidate_reviews,
  request_pending_engine_candidate_activation,
} from "./mcp-pending-engine-candidate-review-tools.mjs";
import {
  chatgpt_bridge_build_proofing_context,
  chatgpt_bridge_build_settlement_context,
  chatgpt_bridge_build_writing_context,
  chatgpt_bridge_build_full_neural_writing_handoff,
  chatgpt_bridge_get_entity_registry_summary,
  chatgpt_bridge_search_canon_entities,
  chatgpt_bridge_get_canon_entity_detail,
  chatgpt_bridge_get_entity_conflicts,
  chatgpt_bridge_get_entity_registry_provenance,
  chatgpt_bridge_get_current_inputs,
  chatgpt_bridge_get_foreshadowing_settlement_surface,
  chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface,
  chatgpt_bridge_get_workbench_status,
  chatgpt_bridge_request_adoption,
  chatgpt_bridge_run_full_neural_writing_pipeline,
  chatgpt_bridge_save_candidate,
  chatgpt_bridge_save_proof_report,
  chatgpt_bridge_visual_library_ui_import_flow_preview,
  chatgpt_bridge_save_settlement_report,
} from "./mcp-chatgpt-bridge-tools.mjs";
import {
  approval_queue_bridge_readiness_report,
} from "./mcp-approval-queue-readiness-tools.mjs";
import { readonlyTools } from "./mcp-readonly-tools.mjs";
import { getEngineComponentsStatus } from "./engine-component-registry.mjs";
import { sourceFilePath } from "./source-registry.mjs";

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
const mcpAuditIntentDir = path.join(rootDir, "data", "outputs", "logs", "mcp_audit_intents");

const dataPaths = {
  activeEngine: sourceFilePath("active_engine"),
  activeWritingCard: sourceFilePath("active_writing_card"),
  activeProofingCard: sourceFilePath("active_proofing_card"),
  activeLongline: sourceFilePath("active_longline"),
  compressedRules: sourceFilePath("compressed_error_rules"),
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

async function auditedToolCall(tool, args, actor) {
  const before = await auditSnapshotMap();
  const calledAt = new Date();
  const auditId = `MCP-AUDIT-${calledAt.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "")}-${hashText(`${tool.name}:${JSON.stringify(args)}:${calledAt.toISOString()}`).slice(0, 8).toUpperCase()}`;
  const auditIntentPath = path.join(mcpAuditIntentDir, `${auditId}.json`);
  let result;
  let effectiveArgs = args;

  await atomicWriteFile(auditIntentPath, `${JSON.stringify({
    audit_id: auditId,
    created_at: calledAt.toISOString(),
    status: "started",
    tool_name: tool.name,
    risk: tool.risk,
    actor,
    input_summary: summarizeToolArguments(args),
  }, null, 2)}\n`, {
    tool: "mcp-audit-intent",
    audit_id: auditId,
  });

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
  const auditRecord = {
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
  };
  await commitFileTransaction("mcp-audit-complete", [
    {
      type: "append",
      filePath: mcpAuditLogPath,
      content: `${JSON.stringify(auditRecord)}\n`,
    },
    { type: "delete", filePath: auditIntentPath },
  ], { audit_id: auditId, tool_name: tool.name });

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
  chatOutputMaxLength: 300000,
  proofReportMaxLength: 200000,
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
  if (field === "chatOutputText") {
    return defaultInputLimits.chatOutputMaxLength;
  }
  if (field === "proofReportText") {
    return defaultInputLimits.proofReportMaxLength;
  }
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
      schema.type === "object"
      && (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      throw new Error(`${field} must be an object.`);
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
  validateToolPathArguments(tool.name, normalized);
  return normalized;
}

function validateOptionalProjectPath(value, field) {
  if (typeof value === "string" && value.trim()) {
    resolveProjectPath(value, field);
  }
}

function validateOptionalOutputPath(value, field) {
  if (typeof value === "string" && value.trim()) {
    resolveGeneratedMarkdownPath(value, field);
  }
}

function validateToolPathArguments(toolName, args) {
  if (toolName === "validate_jsonl") {
    for (const file of args.files ?? []) resolveProjectPath(file, "files");
    return;
  }
  if (toolName === "search_context") {
    validateOptionalOutputPath(args.output, "output");
    return;
  }
  if (toolName === "build_task_prompt") {
    if (args.retrieval) assertPathInside(args.retrieval, projectPaths.outputs, "retrieval");
    validateOptionalOutputPath(args.output, "output");
    return;
  }
  if (toolName === "run_pipeline") {
    validateOptionalOutputPath(args.retrievalOutput, "retrievalOutput");
    validateOptionalOutputPath(args.taskOutput, "taskOutput");
    return;
  }
  if (toolName === "add_feedback_raw") {
    if (args.draftFile) assertPathInside(args.draftFile, projectPaths.outputs, "draftFile");
    return;
  }
  if (toolName === "save_draft" || toolName === "save_proof_report") {
    if (args.taskPrompt) assertPathInside(args.taskPrompt, projectPaths.outputs, "taskPrompt");
    if (args.sourceFile) assertPathInside(args.sourceFile, projectPaths.outputs, "sourceFile");
    return;
  }
  if (toolName === "commit_error_report") {
    if (args.pending) {
      const pendingPath = resolveProjectPath(args.pending, "pending");
      if (path.extname(pendingPath).toLowerCase() !== ".jsonl") {
        throw new Error("pending must be a JSONL file inside the project.");
      }
      if (!args.dryRun && !args.list) {
        assertExactPath(pendingPath, projectPaths.pendingErrorReports, "pending");
      }
    }
    return;
  }
  if (toolName === "compress_error_rules") {
    if (args.candidateOutput) {
      resolveCandidateMarkdownPath(args.candidateOutput, "candidateOutput");
    }
    return;
  }
  if (toolName === "create_settlement_proposal") {
    if (args.sourceFile) assertPathInside(args.sourceFile, projectPaths.outputs, "sourceFile");
    if (args.taskPrompt) assertPathInside(args.taskPrompt, projectPaths.outputs, "taskPrompt");
    return;
  }
  if (toolName === "activate_engine_version") {
    if (args.active) assertExactPath(args.active, projectPaths.activeEngine, "active");
    if (args.candidate) {
      const candidate = resolveProjectPath(args.candidate, "candidate");
      const inVersions = (() => {
        try {
          assertPathInside(candidate, projectPaths.engineVersions, "candidate");
          return true;
        } catch {
          return false;
        }
      })();
      const inOutputs = (() => {
        try {
          assertPathInside(candidate, projectPaths.outputs, "candidate");
          return true;
        } catch {
          return false;
        }
      })();
      if (!inVersions && !inOutputs) {
        throw new Error("candidate must be under data/canon_db/versions or data/outputs.");
      }
    }
    return;
  }
  if (toolName !== "import_policy_file" && toolName !== "query_mcp_audit") {
    validateOptionalProjectPath(args.source, "source");
  }
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
    name: "get_engine_components_status",
    description: "Read the integrated creative engine registry and validate required component availability.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({}),
    handler: async () => jsonContent(await getEngineComponentsStatus()),
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
  {
    name: "run_creative_task",
    description: "Run a Phase 8A creative workflow task without approving or activating protected state.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      taskType: { type: "string", enum: [
        "generate_writing_candidate",
        "proofread_writing_candidate",
        "request_adopt_writing_candidate",
        "build_settlement_candidate",
        "request_engine_activation",
        "query_approval_queue",
        "save_chat_output_candidate",
        "build_candidate_proofing_context",
        "save_candidate_proof_report",
        "build_adopted_writing_settlement_context",
        "save_adopted_writing_settlement_report",
        "build_pending_engine_candidate_from_settlement_report",
        "build_pending_engine_candidate_review",
        "request_pending_engine_candidate_activation",
      ] },
      taskPrompt: { type: "string" },
      generationContext: { type: "object" },
      retrievalContext: { type: "object" },
      candidateId: { type: "string" },
      adoptedChapterId: { type: "string" },
      settlementContextId: { type: "string" },
      settlementReportId: { type: "string" },
      settlementReportText: { type: "string" },
      settlementMode: {
        type: "string",
        enum: ["full", "facts_only", "minimal"],
      },
      pendingEngineCandidateId: { type: "string" },
      reviewId: { type: "string" },
      reviewMode: {
        type: "string",
        enum: ["full", "diff_only", "summary_only"],
      },
      approvalId: { type: "string" },
      dryRun: { type: "boolean", default: false },
      reason: { type: "string" },
      status: { type: "string" },
      riskLevel: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      sourceBundleId: { type: "string" },
      chatOutputText: { type: "string" },
      rawDraftText: { type: "string" },
      raw_draft_text: { type: "string" },
      title: { type: "string" },
      chapterLabel: { type: "string" },
      notes: { type: "string" },
      source: { type: "string", enum: ["chatgpt", "gpt", "manual_paste"] },
      proofingContextId: { type: "string" },
      proofingMode: {
        type: "string",
        enum: ["full", "canon_only", "style_only", "continuity_only"],
      },
      includeCandidateContent: { type: "boolean" },
      includeAdoptedContent: { type: "boolean" },
      includeCandidateEngine: { type: "boolean" },
      includeDiff: { type: "boolean" },
      includeSettlementReport: { type: "boolean" },
      includeSourceAdoptedWriting: { type: "boolean" },
      includeActiveEngine: { type: "boolean" },
      includeWritingCard: { type: "boolean" },
      includeProofingCard: { type: "boolean" },
      includeLongline: { type: "boolean" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000 },
      proofReportText: { type: "string" },
      proofReportId: { type: "string" },
      verdict: { type: "string", enum: ["pass", "needs_revision", "blocked"] },
      severity: { type: "string", enum: ["P0", "P1", "P2", "P3", "none"] },
      requestedBy: { type: "string" },
      allowWithoutProof: { type: "boolean", default: false },
      allowBaseHashMismatch: { type: "boolean", default: false },
      baseActiveEngineHash: { type: "string" },
    }, ["taskType"]),
    handler: async (args) => jsonContent(await run_creative_task(args)),
  },
  {
    name: "get_creative_task_status",
    description: "Read a persisted Phase 8A creative task result.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      taskId: { type: "string" },
    }, ["taskId"]),
    handler: async (args) => jsonContent(await get_creative_task_status(args)),
  },
  {
    name: "list_creative_task_types",
    description: "List the supported Phase 8A creative task types.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({}),
    handler: async () => jsonContent(await list_creative_task_types()),
  },
  {
    name: "chatgpt_bridge_get_workbench_status",
    description: "Read bounded Writer Workbench workflow counts and protected-file hashes for ChatGPT.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({}),
    handler: async () => jsonContent(await chatgpt_bridge_get_workbench_status()),
  },
  {
    name: "chatgpt_bridge_get_entity_registry_summary",
    description: "Read-only structured entity registry summary for ChatGPT/MCP.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      include_counts_by_status: { type: "boolean", default: true },
      include_counts_by_type: { type: "boolean", default: true },
      include_conflict_summary: { type: "boolean", default: true },
      include_provenance: { type: "boolean", default: true },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_entity_registry_summary(args)),
  },
  {
    name: "chatgpt_bridge_search_canon_entities",
    description: "Search structured entity registry by q/type/status/risk/chapter/character.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      q: { type: "string", maxLength: 120 },
      type: { type: "string", enum: ["character","ability","weapon","timeline_event","world_rule","organization","location","chapter_event","relationship","status_effect"] },
      status: { type: "string", enum: ["canon","candidate","pending","deprecated","conflict","unknown"] },
      risk_level: { type: "string" },
      related_chapter: { type: "string" },
      related_character: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      include_excerpt: { type: "boolean", default: true },
      include_related_entities: { type: "boolean", default: false },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_search_canon_entities(args)),
  },
  {
    name: "chatgpt_bridge_get_canon_entity_detail",
    description: "Get a single entity detail from structured entity registry.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      entity_id: { type: "string" },
      include_related_entities: { type: "boolean", default: true },
      include_source_excerpt: { type: "boolean", default: true },
      include_provenance: { type: "boolean", default: true },
    }, ["entity_id"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_canon_entity_detail(args)),
  },
  {
    name: "chatgpt_bridge_get_entity_conflicts",
    description: "Read conflict report for the structured entity registry.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      severity: { type: "string", enum: ["P0","P1","P2"] },
      conflict_type: { type: "string" },
      entity_id: { type: "string" },
      requires_human_review: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      include_evidence: { type: "boolean", default: true },
      include_recommended_action: { type: "boolean", default: true },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_entity_conflicts(args)),
  },
  {
    name: "chatgpt_bridge_get_entity_registry_provenance",
    description: "Get provenance and build report summary for structured entity registry.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      include_source_files: { type: "boolean", default: true },
      include_build_report: { type: "boolean", default: true },
      include_warnings: { type: "boolean", default: true },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_entity_registry_provenance(args)),
  },
  {
    name: "approval_queue_bridge_readiness_report",
    description: "Build a read-only operator readiness report for a ChatGPT Bridge adoption request.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      requestId: { type: "string" },
      includeLineagePreview: { type: "boolean", default: false },
      maxPreviewChars: { type: "integer", minimum: 1, maximum: 20000, default: 4000 },
    }, ["requestId"]),
    handler: async (args) => jsonContent(
      await approval_queue_bridge_readiness_report(args),
    ),
  },
  {
    name: "chatgpt_bridge_get_current_inputs",
    description: "Read bounded task, generation, and retrieval inputs without active-engine text by default.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      includeText: { type: "boolean", default: true },
      includeActiveEngineMetadata: { type: "boolean", default: true },
      includeActiveEngineText: { type: "boolean", default: false },
      maxChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_current_inputs(args)),
  },
  {
    name: "chatgpt_bridge_visual_library_ui_import_flow_preview",
    description: "Read-only preview of the Visual Library UI import flow for ChatGPT/MCP",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      source_dir: { type: "string" },
      include_pipeline_summary: { type: "boolean" },
      include_ui_review_model: { type: "boolean" },
      include_bridge_readiness: { type: "boolean" },
      include_final_acceptance_summary: { type: "boolean" },
      output_mode: { type: "string", enum: ["summary", "full"] },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_visual_library_ui_import_flow_preview(args)),
  },
  {
    name: "chatgpt_bridge_build_writing_context",
    description: "[low-risk-write] Context-only Writer Workbench writing context builder. Do not use this tool to produce final story, chapter, or scene text. For 正式續寫, 下一章, 只輸出正文, 從章名開始, write, continue, draft, or generate requests where ChatGPT is the prose generator, use chatgpt_bridge_build_full_neural_writing_handoff instead.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      run_neural_traces: {
        type: "boolean",
        default: false,
        description: "Optional, default false. When true, request neural trace materialization through a legal adapter; if no adapter is available, record skipped/warning status and never fake trace success.",
      },
      runNeuralTraces: {
        type: "boolean",
        default: false,
        description: "Alias for run_neural_traces with the same safety behavior: default false, legal-adapter only, skipped/warning when unavailable, never fake trace success.",
      },
      taskPrompt: { type: "string" },
      useCurrentInputs: { type: "boolean", default: true },
      generationContext: { type: "object" },
      retrievalContext: { type: "object" },
      chapterMode: {
        type: "string",
        enum: ["next_chapter", "specific_scene", "rewrite_candidate"],
        default: "next_chapter",
      },
      outputMode: {
        type: "string",
        enum: ["chat_only", "candidate_save_later"],
        default: "chat_only",
      },
      includeActiveEngine: { type: "boolean", default: false },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      includeEntityRegistry: { type: "boolean", default: false },
      entityQuery: { type: "string", maxLength: 120 },
      entityIds: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 20 },
      entityCategories: { type: "array", items: { type: "string", enum: ["character","ability","weapon","organization","location","timeline_event","world_rule","chapter_event","status_effect"] } },
      entityLimit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      includeEntityEvidence: { type: "boolean", default: true },
      includeEntityProvenance: { type: "boolean", default: false },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }),
    handler: async (args) => jsonContent(await chatgpt_bridge_build_writing_context(args)),
  },
  {
    name: "chatgpt_bridge_save_candidate",
    description: "Save ChatGPT output as a candidate-only writing artifact.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      sourceBundleId: { type: "string" },
      chatOutputText: { type: "string" },
      rawDraftText: { type: "string" },
      raw_draft_text: { type: "string" },
      title: { type: "string" },
      chapter: { type: "string" },
      taskPrompt: { type: "string" },
      notes: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["chatOutputText"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_save_candidate(args)),
  },
  {
    name: "chatgpt_bridge_build_full_neural_writing_handoff",
    description: "[low-risk-write] ChatGPT-native full neural writing handoff entry. Use this tool when the user asks Writer Workbench / ChatGPT MCP to formally continue, write, draft, generate, or output a story chapter/scene with ChatGPT itself as the prose generator. This tool builds the full neural writing context and final_chatgpt_writing_instruction, does not call or require a backend generation provider, does not save a candidate, does not update Canon, and does not update active_engine. After this tool returns, ChatGPT should write the story text directly from the handoff.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      task_prompt: { type: "string", maxLength: 12000 },
      generation_context: { type: "object" },
      retrieval_context: { type: "object" },
      chapter_mode: { type: "string", maxLength: 120 },
      max_context_chars: { type: "integer", minimum: 4000, maximum: 120000, default: 48000 },
      enable_character_voice_guard: { type: "boolean", default: true },
      output_mode: { type: "string", enum: ["chatgpt_native_handoff"], default: "chatgpt_native_handoff" },
    }, ["task_prompt"]),
    handler: async (args) => jsonContent(
      await chatgpt_bridge_build_full_neural_writing_handoff(args),
    ),
  },
  {
    name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    description: "[low-risk-write] Optional fallback full neural story writing pipeline entry for backend/local generation-provider workflows. Do not use as the primary route when ChatGPT itself should write the prose. For 正式續寫, 下一章, 只輸出正文, 從章名開始, write, continue, draft, or generate requests where ChatGPT is the prose generator, use chatgpt_bridge_build_full_neural_writing_handoff instead. This provider pipeline may require provider_type and can emit extracted_chatgpt_final_output.output_text on success, but it is not the ChatGPT-native mainline.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      task_prompt: { type: "string", maxLength: 12000 },
      generation_context: { type: "object" },
      retrieval_context: { type: "object" },
      provider_type: {
        type: "string",
        enum: ["disabled", "deterministic_test", "local_http", "remote_http"],
      },
      provider_id: { type: "string", maxLength: 160 },
      model_name: { type: "string", maxLength: 240 },
      save_candidate: { type: "boolean", default: false },
      max_revision_rounds: { type: "integer", minimum: 1, maximum: 8, default: 2 },
      enable_character_voice_guard: { type: "boolean", default: true },
      output_mode: { type: "string", enum: ["chat_text"], default: "chat_text" },
    }, ["task_prompt"]),
    handler: async (args) => jsonContent(
      await chatgpt_bridge_run_full_neural_writing_pipeline(args),
    ),
  },
  {
    name: "chatgpt_bridge_build_proofing_context",
    description: "Build a ChatGPT-facing candidate proofing context without generation or canon changes.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofingMode: {
        type: "string",
        enum: ["full", "canon_only", "style_only", "continuity_only"],
        default: "full",
      },
      includeCandidateContent: { type: "boolean", default: true },
      includeActiveEngine: { type: "boolean", default: false },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      includeEntityRegistry: { type: "boolean", default: false },
      entityQuery: { type: "string", maxLength: 120 },
      entityIds: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 20 },
      entityCategories: { type: "array", items: { type: "string", enum: ["character","ability","weapon","organization","location","timeline_event","world_rule","chapter_event","status_effect"] } },
      entityLimit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      includeEntityEvidence: { type: "boolean", default: true },
      includeEntityProvenance: { type: "boolean", default: false },
      retrievalContext: { type: "object" },
      generationContext: { type: "object" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["candidateId"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_build_proofing_context(args)),
  },
  {
    name: "chatgpt_bridge_save_proof_report",
    description: "Save ChatGPT proof output while keeping the writing artifact candidate-only.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofingContextId: { type: "string" },
      proofReportText: { type: "string" },
      verdict: {
        type: "string",
        enum: ["pass", "needs_revision", "blocked"],
        default: "needs_revision",
      },
      severity: {
        type: "string",
        enum: ["P0", "P1", "P2", "P3", "none"],
        default: "none",
      },
      summary: { type: "string" },
      notes: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["candidateId", "proofReportText"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_save_proof_report(args)),
  },
  {
    name: "chatgpt_bridge_request_adoption",
    description: "Create an approval request; adoption still requires explicit Writer Workbench UI confirmation.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofReportId: { type: "string" },
      reason: { type: "string" },
      requestedBy: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      allowWithoutProof: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
    }, ["candidateId"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_request_adoption(args)),
  },
  {
    name: "chatgpt_bridge_build_settlement_context",
    description: "Build a ChatGPT-facing settlement context for an already adopted writing.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      settlementMode: {
        type: "string",
        enum: ["full", "facts_only", "minimal"],
        default: "full",
      },
      includeAdoptedContent: { type: "boolean", default: true },
      includeActiveEngine: { type: "boolean", default: false },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      retrievalContext: { type: "object" },
      generationContext: { type: "object" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["adoptedChapterId"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_build_settlement_context(args)),
  },
  {
    name: "chatgpt_bridge_get_foreshadowing_settlement_surface",
    description: "Read a compact Phase 27G foreshadowing settlement surface for ChatGPT from a settlement context.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      id: { type: "string" },
    }, ["id"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_get_foreshadowing_settlement_surface(args)),
  },
  {
    name: "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
    description: "Read-only Phase 27P ChatGPT/MCP bridge surface for the foreshadowing settlement operator decision ledger UI payload.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      id: { type: "string" },
      settlement_context_id: { type: "string" },
      settlementContextId: { type: "string" },
      include_raw: { type: "boolean", default: false },
      include_markdown: { type: "boolean", default: true },
      max_rows: { type: "integer", minimum: 1, maximum: 100, default: 50 },
    }, [], [{
      type: "exactlyOne",
      fields: ["id", "settlement_context_id", "settlementContextId"],
      message: "Provide exactly one settlement context id: id, settlement_context_id, or settlementContextId.",
    }]),
    handler: async (args) => jsonContent(
      await chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface(args),
    ),
  },
  {
    name: "chatgpt_bridge_save_settlement_report",
    description: "Save a settlement report without creating a pending engine candidate.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      settlementContextId: { type: "string" },
      settlementReportText: { type: "string" },
      summary: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["adoptedChapterId", "settlementReportText"]),
    handler: async (args) => jsonContent(await chatgpt_bridge_save_settlement_report(args)),
  },
  {
    name: "build_gpt_writing_context",
    description: "Build a GPT-facing writing context bundle for chat output without local generation or canon writes. Optional: set run_neural_traces (boolean, default: false) to request neural trace materialization; when no legal adapter is available, the context records skipped/warning trace status instead of faking success.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      run_neural_traces: {
        type: "boolean",
        default: false,
        description: "Optional, default false. When true, request neural trace materialization through a legal adapter; if no adapter is available, record skipped/warning status and never fake trace success.",
      },
      runNeuralTraces: {
        type: "boolean",
        default: false,
        description: "Alias for run_neural_traces with the same safety behavior: default false, legal-adapter only, skipped/warning when unavailable, never fake trace success.",
      },
      taskPrompt: { type: "string" },
      generationContext: { type: "object" },
      retrievalContext: { type: "object" },
      chapterMode: {
        type: "string",
        enum: ["next_chapter", "specific_scene", "rewrite_candidate"],
        default: "next_chapter",
      },
      outputMode: {
        type: "string",
        enum: ["chat_only", "candidate_save_later"],
        default: "chat_only",
      },
      includeActiveEngine: { type: "boolean", default: true },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["taskPrompt"]),
    handler: async (args) => jsonContent(await build_gpt_writing_context(args)),
  },
  {
    name: "get_gpt_writing_context_bundle",
    description: "Read a GPT writing context bundle and its context_for_chat.md content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      bundleId: { type: "string" },
    }, ["bundleId"]),
    handler: async (args) => jsonContent(await get_gpt_writing_context_bundle(args)),
  },
  {
    name: "list_gpt_writing_context_bundles",
    description: "List GPT writing context bundle summaries without dumping source content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_gpt_writing_context_bundles(args)),
  },
  {
    name: "save_chat_output_as_writing_candidate",
    description: "Save pasted GPT/chat output as a candidate-only writing artifact.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      sourceBundleId: { type: "string" },
      chatOutputText: { type: "string" },
      rawDraftText: { type: "string" },
      raw_draft_text: { type: "string" },
      title: { type: "string" },
      chapterLabel: { type: "string" },
      taskPrompt: { type: "string" },
      notes: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["chatOutputText"]),
    handler: async (args) => jsonContent(await save_chat_output_as_writing_candidate(args)),
  },
  {
    name: "get_writing_candidate_detail",
    description: "Read candidate-only metadata and optionally bounded candidate content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      includeContent: { type: "boolean", default: false },
      maxContentChars: { type: "integer", minimum: 1, maximum: 50000, default: 12000 },
    }, ["candidateId"]),
    handler: async (args) => jsonContent(await get_writing_candidate_detail(args)),
  },
  {
    name: "list_writing_candidates",
    description: "List candidate-only writing artifact summaries without dumping content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      sourceBundleId: { type: "string" },
      canonStatus: { type: "string" },
    }),
    handler: async (args) => jsonContent(await list_writing_candidates(args)),
  },
  {
    name: "build_candidate_proofing_context",
    description: "Build a chat-facing proofing bundle for a candidate without local generation or canon writes.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofingMode: {
        type: "string",
        enum: ["full", "canon_only", "style_only", "continuity_only"],
        default: "full",
      },
      includeCandidateContent: { type: "boolean", default: true },
      includeActiveEngine: { type: "boolean", default: true },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      retrievalContext: { type: "object" },
      generationContext: { type: "object" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["candidateId"]),
    handler: async (args) => jsonContent(await build_candidate_proofing_context(args)),
  },
  {
    name: "get_candidate_proofing_context",
    description: "Read a candidate proofing context and its proofing_for_chat.md content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      proofingContextId: { type: "string" },
    }, ["proofingContextId"]),
    handler: async (args) => jsonContent(await get_candidate_proofing_context(args)),
  },
  {
    name: "list_candidate_proofing_contexts",
    description: "List candidate proofing context summaries.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofingMode: {
        type: "string",
        enum: ["full", "canon_only", "style_only", "continuity_only"],
      },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_candidate_proofing_contexts(args)),
  },
  {
    name: "save_chat_output_as_proof_report",
    description: "Save pasted GPT/chat proofing output and mark its candidate as proofed.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofingContextId: { type: "string" },
      proofReportText: { type: "string" },
      verdict: {
        type: "string",
        enum: ["pass", "needs_revision", "blocked"],
        default: "needs_revision",
      },
      severity: {
        type: "string",
        enum: ["P0", "P1", "P2", "P3", "none"],
        default: "none",
      },
      summary: { type: "string" },
      notes: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["candidateId", "proofReportText"]),
    handler: async (args) => jsonContent(await save_chat_output_as_proof_report(args)),
  },
  {
    name: "get_proof_report_detail",
    description: "Read a candidate proof report and its metadata.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      proofReportId: { type: "string" },
    }, ["proofReportId"]),
    handler: async (args) => jsonContent(await get_proof_report_detail(args)),
  },
  {
    name: "list_proof_reports",
    description: "List candidate proof report summaries.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      verdict: { type: "string", enum: ["pass", "needs_revision", "blocked"] },
      severity: { type: "string", enum: ["P0", "P1", "P2", "P3", "none"] },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_proof_reports(args)),
  },
  {
    name: "request_writing_candidate_adoption",
    description: "Create an approval-queue request for a candidate without adopting it directly.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      proofReportId: { type: "string" },
      reason: { type: "string" },
      requestedBy: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      allowWithoutProof: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
    }, ["candidateId"]),
    handler: async (args) => jsonContent(await request_writing_candidate_adoption(args)),
  },
  {
    name: "get_writing_candidate_adoption_request",
    description: "Read one writing candidate adoption request from the approval queue.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      requestId: { type: "string" },
    }, ["requestId"]),
    handler: async (args) => jsonContent(await get_writing_candidate_adoption_request(args)),
  },
  {
    name: "list_writing_candidate_adoption_requests",
    description: "List writing candidate adoption request summaries.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      status: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_writing_candidate_adoption_requests(args)),
  },
  {
    name: "get_adopted_writing_detail",
    description: "Read one confirmed adopted writing record and its chapter content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
    }, ["adoptedChapterId"]),
    handler: async (args) => jsonContent(await get_adopted_writing_detail(args)),
  },
  {
    name: "list_adopted_writings",
    description: "List confirmed adopted writing summaries without creating settlement state.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      candidateId: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_adopted_writings(args)),
  },
  {
    name: "build_adopted_writing_settlement_context",
    description: "Build a GPT-facing settlement context for an adopted writing without local generation or canon changes.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      settlementMode: {
        type: "string",
        enum: ["full", "facts_only", "minimal"],
        default: "full",
      },
      includeAdoptedContent: { type: "boolean", default: true },
      includeActiveEngine: { type: "boolean", default: true },
      includeWritingCard: { type: "boolean", default: true },
      includeProofingCard: { type: "boolean", default: true },
      includeLongline: { type: "boolean", default: true },
      retrievalContext: { type: "object" },
      generationContext: { type: "object" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["adoptedChapterId"]),
    handler: async (args) => jsonContent(await build_adopted_writing_settlement_context(args)),
  },
  {
    name: "get_adopted_writing_settlement_context",
    description: "Read an adopted-writing settlement context and its chat-facing Markdown.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      id: { type: "string" },
    }, ["id"]),
    handler: async (args) => jsonContent(await get_adopted_writing_settlement_context(args)),
  },
  {
    name: "get_foreshadowing_settlement_surface",
    description: "Read a compact Phase 27G foreshadowing settlement surface from an adopted-writing settlement context.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      id: { type: "string" },
    }, ["id"]),
    handler: async (args) => jsonContent(await get_foreshadowing_settlement_surface(args)),
  },
  {
    name: "list_adopted_writing_settlement_contexts",
    description: "List adopted-writing settlement context summaries.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_adopted_writing_settlement_contexts(args)),
  },
  {
    name: "save_chat_output_as_settlement_report",
    description: "Save pasted GPT/chat settlement output without creating or activating an engine candidate.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      settlementContextId: { type: "string" },
      settlementReportText: { type: "string" },
      summary: { type: "string" },
      source: {
        type: "string",
        enum: ["chatgpt", "gpt", "manual_paste"],
        default: "chatgpt",
      },
      dryRun: { type: "boolean", default: false },
    }, ["adoptedChapterId", "settlementReportText"]),
    handler: async (args) => jsonContent(await save_chat_output_as_settlement_report(args)),
  },
  {
    name: "get_settlement_report_detail",
    description: "Read an adopted-writing settlement report with optional bounded content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      id: { type: "string" },
      includeContent: { type: "boolean", default: false },
      maxContentChars: { type: "integer", minimum: 1, maximum: 50000, default: 12000 },
    }, ["id"]),
    handler: async (args) => jsonContent(await get_settlement_report_detail(args)),
  },
  {
    name: "list_settlement_reports",
    description: "List adopted-writing settlement report summaries.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      adoptedChapterId: { type: "string" },
      status: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_settlement_reports(args)),
  },
  {
    name: "build_pending_engine_candidate_from_settlement_report",
    description: "Create a pending-review engine candidate from a saved settlement report without activation or approval creation.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      settlementReportId: { type: "string" },
      adoptedChapterId: { type: "string" },
      baseActiveEngineHash: { type: "string" },
      reason: { type: "string" },
      dryRun: { type: "boolean", default: false },
    }, ["settlementReportId"]),
    handler: async (args) => jsonContent(
      await build_pending_engine_candidate_from_settlement_report(args),
    ),
  },
  {
    name: "build_pending_engine_candidate_review",
    description: "Build a review bundle and diff for a pending engine candidate without requesting or performing activation.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      pendingEngineCandidateId: { type: "string" },
      reviewMode: {
        type: "string",
        enum: ["full", "diff_only", "summary_only"],
        default: "full",
      },
      includeActiveEngine: { type: "boolean" },
      includeCandidateEngine: { type: "boolean" },
      includeDiff: { type: "boolean" },
      includeSettlementReport: { type: "boolean" },
      includeSourceAdoptedWriting: { type: "boolean" },
      maxContextChars: { type: "integer", minimum: 1, maximum: 250000, default: 120000 },
    }, ["pendingEngineCandidateId"]),
    handler: async (args) => jsonContent(await build_pending_engine_candidate_review(args)),
  },
  {
    name: "get_pending_engine_candidate_review",
    description: "Read a pending engine candidate review with optional bounded Markdown content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      reviewId: { type: "string" },
      includeContent: { type: "boolean", default: false },
      maxContentChars: { type: "integer", minimum: 1, maximum: 50000, default: 12000 },
    }, ["reviewId"]),
    handler: async (args) => jsonContent(await get_pending_engine_candidate_review(args)),
  },
  {
    name: "list_pending_engine_candidate_reviews",
    description: "List pending engine candidate review summaries without large content.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      pendingEngineCandidateId: { type: "string" },
      status: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    }),
    handler: async (args) => jsonContent(await list_pending_engine_candidate_reviews(args)),
  },
  {
    name: "request_pending_engine_candidate_activation",
    description: "Create an approval-queue activation request after candidate review without approving or activating it.",
    risk: "low-risk-write",
    inputSchema: baseSchema({
      pendingEngineCandidateId: { type: "string" },
      reviewId: { type: "string" },
      reason: { type: "string" },
      requestedBy: { type: "string" },
      riskLevel: {
        type: "string",
        enum: ["medium", "high"],
        default: "medium",
      },
      allowBaseHashMismatch: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
    }, ["pendingEngineCandidateId"]),
    handler: async (args) => jsonContent(await request_pending_engine_candidate_activation(args)),
  },
  {
    name: "preview_visual_reference_consumer_output_guard",
    description: "Read-only ChatGPT public profile preview of the visual reference consumer output guard readiness packet.",
    risk: "read",
    annotations: { readOnlyHint: true },
    inputSchema: baseSchema({
      outputText: {
        type: "string",
        maxLength: 300000,
        description: "Final ChatGPT output text to check against the visual-only reference consumer contract.",
      },
      consumerContract: {
        type: "object",
        description: "chatgpt_native_consumer_contract from the native writing handoff.",
      },
      packetId: {
        type: "string",
        description: "Optional preview packet id for UI/operator correlation.",
      },
      maxExcerptChars: {
        type: "integer",
        minimum: 1,
        maximum: 100000,
        default: 600,
      },
    }, ["outputText", "consumerContract"]),
    handler: async (args) => {
      assertObject(args);
      return jsonContent(await readonlyTools.preview_visual_reference_consumer_output_guard({
        outputText: args.outputText,
        consumerContract: args.consumerContract,
        packetId: args.packetId,
        maxExcerptChars: args.maxExcerptChars,
      }));
    },
  },
];

const toolRegistry = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

const chatgptPublicToolNames = new Set([
  "get_engine_components_status",
  "chatgpt_bridge_get_workbench_status",
  "chatgpt_bridge_get_current_inputs",
  "chatgpt_bridge_build_writing_context",
  "chatgpt_bridge_save_candidate",
  "chatgpt_bridge_build_full_neural_writing_handoff",
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "chatgpt_bridge_build_proofing_context",
  "chatgpt_bridge_save_proof_report",
  "chatgpt_bridge_request_adoption",
  "chatgpt_bridge_build_settlement_context",
  "chatgpt_bridge_get_foreshadowing_settlement_surface",
  "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
  "chatgpt_bridge_save_settlement_report",
  "approval_queue_bridge_readiness_report",
  "preview_visual_reference_consumer_output_guard",
]);

const toolProfiles = new Map([
  ["full", null],
  ["chatgpt_public", chatgptPublicToolNames],
]);

const activeToolProfileName = process.env.MCP_TOOL_PROFILE?.trim() || "full";
const activeToolProfile = toolProfiles.get(activeToolProfileName);

if (!toolProfiles.has(activeToolProfileName)) {
  throw new Error(`Unknown MCP tool profile: ${activeToolProfileName}`);
}

function isToolAllowed(toolName) {
  return activeToolProfile === null || activeToolProfile.has(toolName);
}

const permissionSources = {
  get_current_project_state: ["repository"],
  get_active_engine: ["canon_db"],
  get_engine_components_status: ["engine_component_registry", "registered_engine_components"],
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
  run_creative_task: ["registered_project_sources", "user_input", "workflow_records"],
  get_creative_task_status: ["creative_task_records"],
  list_creative_task_types: ["creative_task_registry"],
  build_gpt_writing_context: ["registered_project_sources", "user_input"],
  get_gpt_writing_context_bundle: ["gpt_writing_context_records"],
  list_gpt_writing_context_bundles: ["gpt_writing_context_records"],
  save_chat_output_as_writing_candidate: ["user_input", "gpt_writing_context_records"],
  get_writing_candidate_detail: ["writing_candidate_records"],
  list_writing_candidates: ["writing_candidate_records"],
  build_candidate_proofing_context: ["writing_candidate_records", "registered_project_sources", "user_input"],
  get_candidate_proofing_context: ["candidate_proofing_context_records"],
  list_candidate_proofing_contexts: ["candidate_proofing_context_records"],
  save_chat_output_as_proof_report: ["user_input", "writing_candidate_records", "candidate_proofing_context_records"],
  get_proof_report_detail: ["candidate_proof_report_records"],
  list_proof_reports: ["candidate_proof_report_records"],
  request_writing_candidate_adoption: ["writing_candidate_records", "candidate_proof_report_records", "user_input"],
  get_writing_candidate_adoption_request: ["approval_queue"],
  list_writing_candidate_adoption_requests: ["approval_queue"],
  get_adopted_writing_detail: ["adopted_writing_records"],
  list_adopted_writings: ["adopted_writing_records"],
  build_adopted_writing_settlement_context: ["adopted_writing_records", "registered_project_sources", "user_input"],
  get_adopted_writing_settlement_context: ["adopted_writing_settlement_context_records"],
  get_foreshadowing_settlement_surface: ["adopted_writing_settlement_context_records", "foreshadowing_settlement_proposal_bridge"],
  list_adopted_writing_settlement_contexts: ["adopted_writing_settlement_context_records"],
  save_chat_output_as_settlement_report: ["user_input", "adopted_writing_records", "adopted_writing_settlement_context_records"],
  get_settlement_report_detail: ["adopted_writing_settlement_report_records"],
  list_settlement_reports: ["adopted_writing_settlement_report_records"],
  build_pending_engine_candidate_from_settlement_report: ["adopted_writing_settlement_report_records", "active_engine"],
  build_pending_engine_candidate_review: ["pending_engine_candidate_records", "active_engine", "adopted_writing_settlement_report_records"],
  get_pending_engine_candidate_review: ["pending_engine_candidate_review_records"],
  list_pending_engine_candidate_reviews: ["pending_engine_candidate_review_records"],
  request_pending_engine_candidate_activation: ["pending_engine_candidate_records", "pending_engine_candidate_review_records", "user_input"],
  chatgpt_bridge_get_workbench_status: ["workflow_records", "active_engine", "compressed_rules"],
  chatgpt_bridge_get_current_inputs: ["generated_context", "retrieval_context", "task_prompt"],
  chatgpt_bridge_get_entity_registry_summary: ["entity_registry", "registered_project_sources"],
  chatgpt_bridge_search_canon_entities: ["entity_registry", "registered_project_sources"],
  chatgpt_bridge_get_canon_entity_detail: ["entity_registry", "registered_project_sources"],
  chatgpt_bridge_get_entity_conflicts: ["entity_registry", "registered_project_sources"],
  chatgpt_bridge_get_entity_registry_provenance: ["entity_registry", "registered_project_sources"],
  chatgpt_bridge_build_writing_context: ["generated_context", "retrieval_context", "task_prompt", "registered_project_sources", "user_input"],
  chatgpt_bridge_save_candidate: ["user_input", "gpt_writing_context_records"],
  chatgpt_bridge_build_full_neural_writing_handoff: [
    "user_input",
    "registered_project_sources",
    "gpt_writing_context_records",
  ],

  chatgpt_bridge_run_full_neural_writing_pipeline: [
    "user_input",
    "registered_project_sources",
    "generation_provider",
    "gpt_writing_context_records",
  ],
  chatgpt_bridge_build_proofing_context: ["writing_candidate_records", "registered_project_sources", "user_input"],
  chatgpt_bridge_save_proof_report: ["user_input", "writing_candidate_records", "candidate_proofing_context_records"],
  chatgpt_bridge_request_adoption: ["writing_candidate_records", "candidate_proof_report_records", "user_input"],
  chatgpt_bridge_build_settlement_context: ["adopted_writing_records", "registered_project_sources", "user_input"],
  chatgpt_bridge_get_foreshadowing_settlement_surface: ["adopted_writing_settlement_context_records", "foreshadowing_settlement_proposal_bridge"],
  chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface: [
    "adopted_writing_settlement_context_records",
    "foreshadowing_settlement_operator_decision_ledger",
    "foreshadowing_settlement_operator_ledger_ui",
  ],
  chatgpt_bridge_save_settlement_report: ["user_input", "adopted_writing_records", "adopted_writing_settlement_context_records"],
  approval_queue_bridge_readiness_report: [
    "approval_queue",
    "writing_candidate_records",
    "candidate_proof_report_records",
    "candidate_proofing_context_records",
    "gpt_writing_context_records",
    "active_engine",
    "compressed_rules",
  ],
  preview_visual_reference_consumer_output_guard: [
    "visual_reference_consumer_guard",
    "mcp_readonly_preview",
    "user_input",
  ],
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

  let text;
  try {
    text = await readFile(resource.filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    text = resource.mimeType === "application/json"
      ? `${JSON.stringify({ status: "empty", placeholder: true, generated: false }, null, 2)}\n`
      : "# Placeholder\n\nStatus: not yet generated. This is not canon data.\n";
  }
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
  if (!isToolAllowed(name)) {
    throw new Error(
      `Tool not allowed by MCP tool profile ${activeToolProfileName}: ${name}`,
    );
  }

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
      tools: toolDefinitions
        .filter((tool) => isToolAllowed(tool.name))
        .map(publicToolDefinition),
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
  console.error(usage());
  process.exit(0);
}

process.stdin.on("data", (chunk) => {
  acceptInputChunk(chunk);
});
process.stdin.on("end", () => {
  inputEnded = true;
  maybeFinalizeEndOfInput();
});
