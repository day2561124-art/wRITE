import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const toolsDir = path.join(rootDir, "server", "src", "tools");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");
const expectedMaxJsonRpcMessageBytes = 16 * 1024 * 1024;
const expectedMaxContentLengthHeaderBytes = 8 * 1024;
const expectedMaxPendingDispatchMessages = 256;
const expectedMaxPendingResponseMessages = 256;
const expectedResponseResumeLowWaterMark = 128;
const transportLimitChunkBytes = 64 * 1024;
const expectedDispatchQueueOverloadMessage = (
  `Server overloaded: dispatch queue limit of ${expectedMaxPendingDispatchMessages} messages reached.`
);
const truncatedContentLengthBody = Buffer.from(
  "{\"jsonrpc\":\"2.0\",\"id\":901,\"method\":\"ping\"",
  "utf8",
);
const truncatedContentLengthExpectedBytes = truncatedContentLengthBody.length + 64;
const eofTruncationFixtures = [
  {
    label: "incomplete newline-delimited JSON",
    chunks: [
      Buffer.from("{\"jsonrpc\":\"2.0\",", "utf8"),
      Buffer.from("\"id\":899,\"method\":\"ping\"", "utf8"),
    ],
    expectedFraming: "line",
    expectedMessage: "Parse error: incomplete newline-delimited JSON at end of input.",
  },
  {
    label: "incomplete Content-Length header",
    chunks: [
      Buffer.from("Content-Length: 128\r\n", "ascii"),
      Buffer.from("Content-Type: application/json\r\n", "ascii"),
    ],
    expectedFraming: "header",
    expectedMessage: "Parse error: incomplete Content-Length header at end of input.",
  },
  {
    label: "incomplete Content-Length body",
    chunks: [
      Buffer.from(
        `Content-Length: ${truncatedContentLengthExpectedBytes}\r\n\r\n`,
        "ascii",
      ),
      truncatedContentLengthBody.subarray(0, 17),
      truncatedContentLengthBody.subarray(17),
    ],
    expectedFraming: "header",
    expectedMessage: (
      "Parse error: incomplete Content-Length body at end of input: "
      + `expected ${truncatedContentLengthExpectedBytes} bytes, `
      + `received ${truncatedContentLengthBody.length}.`
    ),
  },
];
const invalidContentLengthHeaderFixtures = [
  {
    label: "duplicate Content-Length",
    header: "Content-Length: 0\r\nContent-Length: 0",
    expectedMessage: "Parse error: duplicate Content-Length headers are not allowed.",
  },
  {
    label: "conflicting Content-Length",
    header: "Content-Length: 0\r\nContent-Length: 1",
    expectedMessage: "Parse error: conflicting Content-Length headers are not allowed.",
  },
  {
    label: "Content-Length with trailing garbage",
    header: "Content-Length: 0oops",
    expectedMessage: "Parse error: Content-Length must contain decimal digits only.",
  },
  {
    label: "negative Content-Length",
    header: "Content-Length: -1",
    expectedMessage: "Parse error: Content-Length must not be negative.",
  },
  {
    label: "unsafe Content-Length",
    header: "Content-Length: 9007199254740992",
    expectedMessage: "Parse error: Content-Length exceeds JavaScript safe integer range.",
  },
];

const watchedFiles = [
  path.join(rootDir, "data", "canon_db", "active_engine.md"),
  path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(rootDir, "data", "longline_db", "active_longline.md"),
  path.join(rootDir, "data", "error_report_db", "compressed_rules.md"),
];

const protectedRuntimePaths = [
  path.join(rootDir, "data", "outputs", "logs", "policy_import_backups"),
  path.join(rootDir, "data", "outputs", "logs", "policy_imports.jsonl"),
];
const transactionRuntimePath = path.join(
  rootDir,
  "data",
  "outputs",
  "logs",
  "transactions",
);
const auditIntentRuntimePath = path.join(
  rootDir,
  "data",
  "outputs",
  "logs",
  "mcp_audit_intents",
);

const forbiddenCreatedPaths = [
  path.join(rootDir, "server", "src", "tools", "activate_engine_version.mjs"),
  path.join(rootDir, "server", "src", "tools", "build-generation-context.mjs"),
  path.join(rootDir, "outputs", "current_prompt.md"),
  path.join(rootDir, "outputs", "retrieval_debug_report.json"),
  path.join(rootDir, "data", "proofing_policy_db", "versions", "proofing_card_v999.999.md"),
  path.join(rootDir, "data", "outputs", "logs", "engine_activation_backups"),
  path.join(rootDir, "data", "outputs", "logs", "engine_activations.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "compressed_rule_updates.jsonl"),
];

const expectedToolScripts = [
  "activate-engine-version.mjs",
  "add-feedback.mjs",
  "build-current-prompt.mjs",
  "build-task-prompt.mjs",
  "commit-error-report.mjs",
  "compress-error-rules.mjs",
  "create-settlement-proposal.mjs",
  "import-policy-file.mjs",
  "query-mcp-audit.mjs",
  "run-pipeline.mjs",
  "save-draft.mjs",
  "save-proof-report.mjs",
  "search-context.mjs",
  "source-trust-checker.mjs",
  "validate-json-codeblocks.mjs",
  "validate-jsonl.mjs",
];

const expectedTools = [
  "get_current_project_state",
  "get_active_engine",
  "get_active_writing_card",
  "validate_jsonl",
  "query_mcp_audit",
  "build_generation_context",
  "search_context",
  "build_task_prompt",
  "run_pipeline",
  "add_feedback_raw",
  "save_draft",
  "save_proof_report",
  "import_policy_file",
  "commit_error_report",
  "compress_error_rules",
  "create_settlement_proposal",
  "activate_engine_version",
  "run_creative_task",
  "get_creative_task_status",
  "list_creative_task_types",
  "build_gpt_writing_context",
  "get_gpt_writing_context_bundle",
  "list_gpt_writing_context_bundles",
  "save_chat_output_as_writing_candidate",
  "get_writing_candidate_detail",
  "list_writing_candidates",
  "build_candidate_proofing_context",
  "get_candidate_proofing_context",
  "list_candidate_proofing_contexts",
  "save_chat_output_as_proof_report",
  "get_proof_report_detail",
  "list_proof_reports",
];

const readOnlyTools = new Set([
  "get_current_project_state",
  "get_active_engine",
  "get_active_writing_card",
  "validate_jsonl",
  "query_mcp_audit",
  "get_creative_task_status",
  "list_creative_task_types",
  "get_gpt_writing_context_bundle",
  "list_gpt_writing_context_bundles",
  "get_writing_candidate_detail",
  "list_writing_candidates",
  "get_candidate_proofing_context",
  "list_candidate_proofing_contexts",
  "get_proof_report_detail",
  "list_proof_reports",
]);

const backupRequiredTools = new Set([
  "import_policy_file",
  "compress_error_rules",
  "activate_engine_version",
]);

const activeEngineModifierTools = new Set([
  "import_policy_file",
  "activate_engine_version",
]);

const highRiskTools = new Set([
  "import_policy_file",
  "commit_error_report",
  "compress_error_rules",
  "create_settlement_proposal",
  "activate_engine_version",
]);

const permissionMetadataFields = [
  "tool_name",
  "permission_level",
  "read_or_write",
  "risk_level",
  "requires_user_confirmation",
  "requires_backup_before_write",
  "allowed_sources",
  "forbidden_sources",
  "can_modify_canon",
  "can_modify_active_engine",
  "can_modify_story_graph",
  "can_modify_memory",
  "can_commit_error_report",
  "log_required",
];

const unknownArgumentFixtures = expectedTools.map((name) => ({
  name,
  arguments: {
    __unknown_smoke__: true,
  },
  expectedMessage: `Unknown argument for ${name}: __unknown_smoke__.`,
}));

const enumConstraintFixtures = [
  {
    label: "run_creative_task invalid source",
    name: "run_creative_task",
    field: "source",
    arguments: {
      taskType: "save_chat_output_candidate",
      chatOutputText: "Enum constraint fixture.",
      source: "invalid-source",
    },
    expectedMessage: "source must be one of: chatgpt, gpt, manual_paste.",
  },
  {
    label: "save_chat_output_as_writing_candidate invalid source",
    name: "save_chat_output_as_writing_candidate",
    field: "source",
    arguments: {
      chatOutputText: "Enum constraint fixture.",
      source: "invalid-source",
    },
    expectedMessage: "source must be one of: chatgpt, gpt, manual_paste.",
  },
  {
    label: "build_gpt_writing_context invalid chapterMode",
    name: "build_gpt_writing_context",
    field: "chapterMode",
    arguments: {
      taskPrompt: "Enum constraint fixture.",
      chapterMode: "invalid-mode",
    },
    expectedMessage: "chapterMode must be one of: next_chapter, specific_scene, rewrite_candidate.",
  },
  {
    label: "build_gpt_writing_context invalid outputMode",
    name: "build_gpt_writing_context",
    field: "outputMode",
    arguments: {
      taskPrompt: "Enum constraint fixture.",
      outputMode: "invalid-mode",
    },
    expectedMessage: "outputMode must be one of: chat_only, candidate_save_later.",
  },
  {
    label: "run_creative_task invalid taskType",
    name: "run_creative_task",
    field: "taskType",
    arguments: {
      taskType: "invalid-task",
    },
    expectedMessage: "taskType must be one of: generate_writing_candidate, proofread_writing_candidate, request_adopt_writing_candidate, build_settlement_candidate, request_engine_activation, query_approval_queue, save_chat_output_candidate, build_candidate_proofing_context, save_candidate_proof_report.",
  },
  ...[
    ["run_creative_task", "proofingMode", {
      taskType: "build_candidate_proofing_context",
      candidateId: "writing_candidate_20260612-000000-00000000",
    }, "full, canon_only, style_only, continuity_only"],
    ["build_candidate_proofing_context", "proofingMode", {
      candidateId: "writing_candidate_20260612-000000-00000000",
    }, "full, canon_only, style_only, continuity_only"],
    ["list_candidate_proofing_contexts", "proofingMode", {}, "full, canon_only, style_only, continuity_only"],
    ["run_creative_task", "verdict", {
      taskType: "save_candidate_proof_report",
      candidateId: "writing_candidate_20260612-000000-00000000",
      proofReportText: "fixture",
    }, "pass, needs_revision, blocked"],
    ["save_chat_output_as_proof_report", "verdict", {
      candidateId: "writing_candidate_20260612-000000-00000000",
      proofReportText: "fixture",
    }, "pass, needs_revision, blocked"],
    ["list_proof_reports", "verdict", {}, "pass, needs_revision, blocked"],
    ["run_creative_task", "severity", {
      taskType: "save_candidate_proof_report",
      candidateId: "writing_candidate_20260612-000000-00000000",
      proofReportText: "fixture",
    }, "P0, P1, P2, P3, none"],
    ["save_chat_output_as_proof_report", "severity", {
      candidateId: "writing_candidate_20260612-000000-00000000",
      proofReportText: "fixture",
    }, "P0, P1, P2, P3, none"],
    ["list_proof_reports", "severity", {}, "P0, P1, P2, P3, none"],
    ["save_chat_output_as_proof_report", "source", {
      candidateId: "writing_candidate_20260612-000000-00000000",
      proofReportText: "fixture",
    }, "chatgpt, gpt, manual_paste"],
  ].map(([name, field, baseArguments, values]) => ({
    label: `${name} invalid ${field}`,
    name,
    field,
    arguments: { ...baseArguments, [field]: "invalid-value" },
    expectedMessage: `${field} must be one of: ${values}.`,
  })),
  {
    label: "validate_jsonl invalid schema",
    name: "validate_jsonl",
    field: "schema",
    arguments: {
      schema: "invalid-schema",
    },
    expectedMessage: "schema must be one of: error_report, feedback, generic_pair.",
  },
  {
    label: "build_task_prompt invalid mode",
    name: "build_task_prompt",
    field: "mode",
    arguments: {
      mode: "invalid-mode",
      task: "Enum constraint fixture.",
    },
    expectedMessage: "mode must be one of: next-chapter, proofread, settle, debug.",
  },
  {
    label: "run_pipeline invalid mode",
    name: "run_pipeline",
    field: "mode",
    arguments: {
      mode: "invalid-mode",
      query: "enum constraint fixture",
      task: "Enum constraint fixture.",
    },
    expectedMessage: "mode must be one of: next-chapter, proofread, settle, debug.",
  },
  {
    label: "add_feedback_raw invalid type",
    name: "add_feedback_raw",
    field: "type",
    arguments: {
      type: "invalid-type",
      feedback: "Enum constraint fixture.",
    },
    expectedMessage: "type must be one of: accepted, rejected, revision, preference.",
  },
  {
    label: "add_feedback_raw invalid severity",
    name: "add_feedback_raw",
    field: "severity",
    arguments: {
      severity: "PX",
      feedback: "Enum constraint fixture.",
    },
    expectedMessage: "severity must be one of: P0, P1, P2, P3, P4.",
  },
  {
    label: "save_proof_report invalid verdict",
    name: "save_proof_report",
    field: "verdict",
    arguments: {
      verdict: "invalid-verdict",
      title: "Enum constraint fixture",
    },
    expectedMessage: "verdict must be one of: pass, needs_rewrite, reject, stop.",
  },
  {
    label: "save_proof_report invalid severity",
    name: "save_proof_report",
    field: "severity",
    arguments: {
      severity: "PX",
      title: "Enum constraint fixture",
    },
    expectedMessage: "severity must be one of: P0, P1, P2, P3, P4.",
  },
  {
    label: "import_policy_file invalid kind",
    name: "import_policy_file",
    field: "kind",
    arguments: {
      kind: "invalid-kind",
      source: "README.md",
      dryRun: true,
    },
    expectedMessage: "kind must be one of: engine, writing, proofing, longline.",
  },
  {
    label: "commit_error_report invalid target",
    name: "commit_error_report",
    field: "target",
    arguments: {
      target: "invalid-target",
      dryRun: true,
    },
    expectedMessage: "target must be one of: canon, character, dialogue, pacing, battle, preference.",
  },
];

const schemaTypeFixtures = [
  {
    label: "get_active_engine non-boolean includeText",
    name: "get_active_engine",
    field: "includeText",
    expectedType: "boolean",
    arguments: {
      includeText: "yes",
    },
    expectedMessage: "includeText must be a boolean.",
  },
  {
    label: "validate_jsonl non-array files",
    name: "validate_jsonl",
    field: "files",
    expectedType: "array",
    expectedItemType: "string",
    arguments: {
      files: "data/feedback_db/pending_error_reports.jsonl",
    },
    expectedMessage: "files must be an array.",
  },
  {
    label: "validate_jsonl non-string file item",
    name: "validate_jsonl",
    field: "files",
    expectedType: "array",
    expectedItemType: "string",
    arguments: {
      files: [123],
    },
    expectedMessage: "files must be an array of strings.",
  },
  {
    label: "search_context non-integer top",
    name: "search_context",
    field: "top",
    expectedType: "integer",
    expectedMinimum: 1,
    arguments: {
      query: "schema type fixture",
      top: "8",
    },
    expectedMessage: "top must be a positive integer.",
  },
  {
    label: "add_feedback_raw non-string feedback",
    name: "add_feedback_raw",
    field: "feedback",
    expectedType: "string",
    arguments: {
      feedback: 123,
    },
    expectedMessage: "feedback must be a string.",
  },
  {
    label: "save_draft non-boolean dryRun",
    name: "save_draft",
    field: "dryRun",
    expectedType: "boolean",
    arguments: {
      title: "Schema type fixture",
      dryRun: "yes",
    },
    expectedMessage: "dryRun must be a boolean.",
  },
  {
    label: "settlement non-array reminders",
    name: "create_settlement_proposal",
    field: "reminders",
    expectedType: "array",
    expectedItemType: "string",
    arguments: {
      chapter: "SMOKE",
      title: "Schema type fixture",
      text: "Schema type fixture.",
      reminders: "one reminder",
      dryRun: true,
    },
    expectedMessage: "reminders must be an array.",
  },
  {
    label: "settlement non-string reminder item",
    name: "create_settlement_proposal",
    field: "reminders",
    expectedType: "array",
    expectedItemType: "string",
    arguments: {
      chapter: "SMOKE",
      title: "Schema type fixture",
      text: "Schema type fixture.",
      reminders: [123],
      dryRun: true,
    },
    expectedMessage: "reminders must be an array of strings.",
  },
];

const integerMaximumFixtures = [
  {
    label: "run_creative_task maxContextChars over maximum",
    name: "run_creative_task",
    field: "maxContextChars",
    expectedMaximum: 250000,
    arguments: {
      taskType: "build_candidate_proofing_context",
      candidateId: "writing_candidate_20260612-000000-00000000",
      maxContextChars: 250001,
    },
    expectedMessage: "maxContextChars must be an integer less than or equal to 250000.",
  },
  {
    label: "build_candidate_proofing_context maxContextChars over maximum",
    name: "build_candidate_proofing_context",
    field: "maxContextChars",
    expectedMaximum: 250000,
    arguments: {
      candidateId: "writing_candidate_20260612-000000-00000000",
      maxContextChars: 250001,
    },
    expectedMessage: "maxContextChars must be an integer less than or equal to 250000.",
  },
  ...["list_candidate_proofing_contexts", "list_proof_reports"].map((name) => ({
    label: `${name} limit over maximum`,
    name,
    field: "limit",
    expectedMaximum: 100,
    arguments: { limit: 101 },
    expectedMessage: "limit must be an integer less than or equal to 100.",
  })),
  {
    label: "get_writing_candidate_detail maxContentChars over maximum",
    name: "get_writing_candidate_detail",
    field: "maxContentChars",
    expectedMaximum: 50000,
    arguments: {
      candidateId: "writing_candidate_20260612-000000-00000000",
      maxContentChars: 50001,
    },
    expectedMessage: "maxContentChars must be an integer less than or equal to 50000.",
  },
  {
    label: "list_writing_candidates limit over maximum",
    name: "list_writing_candidates",
    field: "limit",
    expectedMaximum: 100,
    arguments: {
      limit: 101,
    },
    expectedMessage: "limit must be an integer less than or equal to 100.",
  },
  {
    label: "build_gpt_writing_context maxContextChars over maximum",
    name: "build_gpt_writing_context",
    field: "maxContextChars",
    expectedMaximum: 250000,
    arguments: {
      taskPrompt: "Integer maximum fixture.",
      maxContextChars: 250001,
    },
    expectedMessage: "maxContextChars must be an integer less than or equal to 250000.",
  },
  {
    label: "list_gpt_writing_context_bundles limit over maximum",
    name: "list_gpt_writing_context_bundles",
    field: "limit",
    expectedMaximum: 100,
    arguments: {
      limit: 101,
    },
    expectedMessage: "limit must be an integer less than or equal to 100.",
  },
  {
    label: "run_creative_task limit over maximum",
    name: "run_creative_task",
    field: "limit",
    expectedMaximum: 100,
    arguments: {
      taskType: "query_approval_queue",
      limit: 101,
    },
    expectedMessage: "limit must be an integer less than or equal to 100.",
  },
  {
    label: "query_mcp_audit limit over maximum",
    name: "query_mcp_audit",
    field: "limit",
    expectedMaximum: 1000,
    arguments: {
      limit: 1001,
    },
    expectedMessage: "limit must be an integer less than or equal to 1000.",
  },
  {
    label: "search_context top over maximum",
    name: "search_context",
    field: "top",
    expectedMaximum: 100,
    arguments: {
      query: "integer maximum fixture",
      top: 101,
    },
    expectedMessage: "top must be an integer less than or equal to 100.",
  },
  {
    label: "run_pipeline top over maximum",
    name: "run_pipeline",
    field: "top",
    expectedMaximum: 100,
    arguments: {
      query: "integer maximum fixture",
      task: "Integer maximum fixture.",
      top: 101,
    },
    expectedMessage: "top must be an integer less than or equal to 100.",
  },
  {
    label: "compress_error_rules top over maximum",
    name: "compress_error_rules",
    field: "top",
    expectedMaximum: 1000,
    arguments: {
      top: 1001,
      dryRun: true,
    },
    expectedMessage: "top must be an integer less than or equal to 1000.",
  },
  {
    label: "compress_error_rules minCount over maximum",
    name: "compress_error_rules",
    field: "minCount",
    expectedMaximum: 1000,
    arguments: {
      minCount: 1001,
      dryRun: true,
    },
    expectedMessage: "minCount must be an integer less than or equal to 1000.",
  },
];

const sizeConstraintFixtures = [
  {
    label: "search_context query over maxLength",
    name: "search_context",
    field: "query",
    constraint: "maxLength",
    expectedLimit: 8192,
    arguments: {
      query: "q".repeat(8193),
    },
    expectedMessage: "query must be at most 8192 characters.",
  },
  {
    label: "add_feedback_raw feedback over maxLength",
    name: "add_feedback_raw",
    field: "feedback",
    constraint: "maxLength",
    expectedLimit: 65536,
    arguments: {
      feedback: "f".repeat(65537),
      noCandidate: true,
      dryRun: true,
    },
    expectedMessage: "feedback must be at most 65536 characters.",
  },
  {
    label: "save_draft text over maxLength",
    name: "save_draft",
    field: "text",
    constraint: "maxLength",
    expectedLimit: 1000000,
    arguments: {
      title: "Size constraint fixture",
      text: "t".repeat(1000001),
      dryRun: true,
    },
    expectedMessage: "text must be at most 1000000 characters.",
  },
  {
    label: "activate_engine_version reason over maxLength",
    name: "activate_engine_version",
    field: "reason",
    constraint: "maxLength",
    expectedLimit: 4096,
    arguments: {
      version: "v5.0.12",
      reason: "r".repeat(4097),
      dryRun: true,
    },
    expectedMessage: "reason must be at most 4096 characters.",
  },
  {
    label: "validate_jsonl files over maxItems",
    name: "validate_jsonl",
    field: "files",
    constraint: "maxItems",
    expectedLimit: 256,
    arguments: {
      files: Array.from({ length: 257 }, (_, index) => `file-${index}.jsonl`),
    },
    expectedMessage: "files must contain at most 256 items.",
  },
  {
    label: "validate_jsonl file item over maxLength",
    name: "validate_jsonl",
    field: "files",
    constraint: "itemMaxLength",
    expectedLimit: 4096,
    arguments: {
      files: ["p".repeat(4097)],
    },
    expectedMessage: "files items must be at most 4096 characters.",
  },
  {
    label: "settlement reminders over maxItems",
    name: "create_settlement_proposal",
    field: "reminders",
    constraint: "maxItems",
    expectedLimit: 100,
    arguments: {
      chapter: "SMOKE",
      title: "Size constraint fixture",
      text: "This fixture must fail before the settlement tool runs.",
      reminders: Array.from({ length: 101 }, (_, index) => `reminder-${index}`),
      dryRun: true,
    },
    expectedMessage: "reminders must contain at most 100 items.",
  },
  {
    label: "settlement note item over maxLength",
    name: "create_settlement_proposal",
    field: "notes",
    constraint: "itemMaxLength",
    expectedLimit: 16384,
    arguments: {
      chapter: "SMOKE",
      title: "Size constraint fixture",
      text: "This fixture must fail before the settlement tool runs.",
      notes: ["n".repeat(16385)],
      dryRun: true,
    },
    expectedMessage: "notes items must be at most 16384 characters.",
  },
];

const stringArrayBlankFixtures = [
  {
    label: "validate_jsonl blank file item",
    name: "validate_jsonl",
    field: "files",
    arguments: {
      files: ["   "],
    },
    expectedMessage: "files must not contain blank strings.",
  },
  ...["established", "unsettled", "reminders", "notes"].map((field, index) => ({
    label: `settlement blank ${field} item`,
    name: "create_settlement_proposal",
    field,
    arguments: {
      chapter: "SMOKE",
      title: "String array blank fixture",
      text: "This fixture must fail before the settlement tool runs.",
      [field]: [index % 2 === 0 ? "" : "   "],
      dryRun: true,
    },
    expectedMessage: `${field} must not contain blank strings.`,
  })),
];

const requiredConstraintFixtures = [
  ...[
    ["build_candidate_proofing_context", "candidateId", {}],
    ["get_candidate_proofing_context", "proofingContextId", {}],
    ["save_chat_output_as_proof_report", "candidateId", { proofReportText: "fixture" }],
    ["save_chat_output_as_proof_report", "proofReportText", {
      candidateId: "writing_candidate_20260612-000000-00000000",
    }],
    ["get_proof_report_detail", "proofReportId", {}],
  ].map(([name, field, argumentsValue]) => ({
    label: `${name} missing ${field}`,
    name,
    field,
    arguments: argumentsValue,
    expectedMessage: `${field} is required.`,
  })),
  {
    label: "save_chat_output_as_writing_candidate missing chatOutputText",
    name: "save_chat_output_as_writing_candidate",
    field: "chatOutputText",
    arguments: {},
    expectedMessage: "chatOutputText is required.",
  },
  {
    label: "get_writing_candidate_detail missing candidateId",
    name: "get_writing_candidate_detail",
    field: "candidateId",
    arguments: {},
    expectedMessage: "candidateId is required.",
  },
  {
    label: "build_gpt_writing_context missing taskPrompt",
    name: "build_gpt_writing_context",
    field: "taskPrompt",
    arguments: {},
    expectedMessage: "taskPrompt is required.",
  },
  {
    label: "get_gpt_writing_context_bundle missing bundleId",
    name: "get_gpt_writing_context_bundle",
    field: "bundleId",
    arguments: {},
    expectedMessage: "bundleId is required.",
  },
  {
    label: "run_creative_task missing taskType",
    name: "run_creative_task",
    field: "taskType",
    arguments: {},
    expectedMessage: "taskType is required.",
  },
  {
    label: "get_creative_task_status missing taskId",
    name: "get_creative_task_status",
    field: "taskId",
    arguments: {},
    expectedMessage: "taskId is required.",
  },
  {
    label: "search_context null query",
    name: "search_context",
    field: "query",
    arguments: {
      query: null,
    },
    expectedMessage: "query is required.",
  },
  {
    label: "search_context blank query",
    name: "search_context",
    field: "query",
    arguments: {
      query: "   ",
    },
    expectedMessage: "query is required.",
  },
  {
    label: "search_context missing query",
    name: "search_context",
    field: "query",
    arguments: {},
    expectedMessage: "query is required.",
  },
  {
    label: "build_task_prompt missing task",
    name: "build_task_prompt",
    field: "task",
    arguments: {},
    expectedMessage: "task is required.",
  },
  {
    label: "run_pipeline missing query",
    name: "run_pipeline",
    field: "query",
    arguments: {
      task: "Required constraint fixture.",
    },
    expectedMessage: "query is required.",
  },
  {
    label: "run_pipeline missing task",
    name: "run_pipeline",
    field: "task",
    arguments: {
      query: "required constraint fixture",
    },
    expectedMessage: "task is required.",
  },
  {
    label: "add_feedback_raw missing feedback",
    name: "add_feedback_raw",
    field: "feedback",
    arguments: {},
    expectedMessage: "feedback is required.",
  },
  {
    label: "save_draft missing title",
    name: "save_draft",
    field: "title",
    arguments: {},
    expectedMessage: "title is required.",
  },
  {
    label: "save_proof_report missing title",
    name: "save_proof_report",
    field: "title",
    arguments: {},
    expectedMessage: "title is required.",
  },
  {
    label: "import_policy_file missing kind",
    name: "import_policy_file",
    field: "kind",
    arguments: {
      source: "README.md",
      dryRun: true,
    },
    expectedMessage: "kind is required.",
  },
  {
    label: "import_policy_file missing source",
    name: "import_policy_file",
    field: "source",
    arguments: {
      kind: "proofing",
      dryRun: true,
    },
    expectedMessage: "source is required.",
  },
  {
    label: "create_settlement_proposal missing chapter",
    name: "create_settlement_proposal",
    field: "chapter",
    arguments: {
      title: "Required constraint fixture",
      text: "Required constraint fixture.",
      dryRun: true,
    },
    expectedMessage: "chapter is required.",
  },
  {
    label: "create_settlement_proposal missing title",
    name: "create_settlement_proposal",
    field: "title",
    arguments: {
      chapter: "SMOKE",
      text: "Required constraint fixture.",
      dryRun: true,
    },
    expectedMessage: "title is required.",
  },
];

const crossFieldConstraintFixtures = [
  {
    label: "activation blank candidate source",
    name: "activate_engine_version",
    arguments: {
      version: "   ",
      dryRun: true,
    },
    expectedMessage: "Provide exactly one candidate source: --version or --candidate.",
  },
  {
    label: "activation missing candidate source",
    name: "activate_engine_version",
    arguments: {
      dryRun: true,
    },
    expectedMessage: "Provide exactly one candidate source: --version or --candidate.",
  },
  {
    label: "activation multiple candidate sources",
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
      candidate: "data/canon_db/versions/engine_v5.0.12.md",
      dryRun: true,
    },
    expectedMessage: "Provide exactly one candidate source: --version or --candidate.",
  },
  {
    label: "settlement missing input source",
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Cross-field fixture",
      dryRun: true,
    },
    expectedMessage: "Provide exactly one input source: --draft-id, --source-file or --text.",
  },
  {
    label: "settlement multiple input sources",
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Cross-field fixture",
      sourceFile: "README.md",
      text: "Cross-field fixture.",
      dryRun: true,
    },
    expectedMessage: "Provide exactly one input source: --draft-id, --source-file or --text.",
  },
  {
    label: "commit missing selector",
    name: "commit_error_report",
    arguments: {
      dryRun: true,
    },
    expectedMessage: "Use --list without selectors, or choose exactly one selector: --error-id, --feedback-id or --latest.",
  },
  {
    label: "commit multiple selectors",
    name: "commit_error_report",
    arguments: {
      errorId: "E-PACING-MCP-SMOKE-001",
      latest: true,
      dryRun: true,
    },
    expectedMessage: "Use --list without selectors, or choose exactly one selector: --error-id, --feedback-id or --latest.",
  },
  {
    label: "commit list with selector",
    name: "commit_error_report",
    arguments: {
      list: true,
      latest: true,
    },
    expectedMessage: "Use --list without selectors, or choose exactly one selector: --error-id, --feedback-id or --latest.",
  },
];

const expectedCrossFieldMetadata = new Map([
  [
    "commit_error_report",
    [{
      type: "selectorOrList",
      listField: "list",
      selectorFields: ["errorId", "feedbackId", "latest"],
      message: "Use --list without selectors, or choose exactly one selector: --error-id, --feedback-id or --latest.",
    }],
  ],
  [
    "create_settlement_proposal",
    [{
      type: "exactlyOne",
      fields: ["draftId", "sourceFile", "text"],
      message: "Provide exactly one input source: --draft-id, --source-file or --text.",
    }],
  ],
  [
    "activate_engine_version",
    [{
      type: "exactlyOne",
      fields: ["version", "candidate"],
      message: "Provide exactly one candidate source: --version or --candidate.",
    }],
  ],
]);

const expectedConfirmationMetadata = new Map([
  [
    "import_policy_file",
    {
      field: "confirm",
      requiredValue: "IMPORT_POLICY",
      when: { dryRun: false },
      message: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
    },
  ],
  [
    "commit_error_report",
    {
      field: "confirm",
      requiredValue: "COMMIT",
      when: { dryRun: false },
      unless: { list: true },
      message: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
    },
  ],
  [
    "compress_error_rules",
    {
      field: "confirm",
      requiredValue: "UPDATE_RULES",
      when: { dryRun: false, updateActive: true },
      message: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
    },
  ],
  [
    "create_settlement_proposal",
    {
      field: "confirmAdopted",
      requiredValue: true,
      when: { dryRun: false },
      message: "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.",
    },
  ],
  [
    "activate_engine_version",
    {
      field: "confirm",
      requiredValue: "ACTIVATE",
      when: { dryRun: false },
      message: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
    },
  ],
]);

const expectedDefaultMetadata = new Map([
  ["get_current_project_state", { includeHashes: true }],
  ["get_active_engine", { includeText: false }],
  ["get_active_writing_card", { includeText: false }],
  ["validate_jsonl", { strict: false }],
  ["query_mcp_audit", {
    limit: 20,
    oldest: false,
    json: false,
    showJson: false,
  }],
  ["search_context", { top: 8 }],
  ["build_task_prompt", { mode: "next-chapter" }],
  ["run_pipeline", {
    mode: "next-chapter",
    top: 12,
  }],
  ["add_feedback_raw", {
    type: "rejected",
    noCandidate: false,
    dryRun: false,
  }],
  ["save_draft", { dryRun: false }],
  ["save_proof_report", {
    verdict: "needs_rewrite",
    severity: "P2",
    dryRun: false,
  }],
  ["import_policy_file", {
    force: false,
    dryRun: true,
  }],
  ["commit_error_report", {
    latest: false,
    list: false,
    dryRun: false,
  }],
  ["compress_error_rules", {
    top: 24,
    minCount: 1,
    includeArchived: false,
    writeCandidate: false,
    updateActive: false,
    allowEmpty: false,
    dryRun: true,
  }],
  ["create_settlement_proposal", {
    confirmAdopted: false,
    dryRun: false,
  }],
  ["activate_engine_version", { dryRun: true }],
  ["run_creative_task", {
    dryRun: false,
    limit: 20,
  }],
  ["build_gpt_writing_context", {
    chapterMode: "next_chapter",
    outputMode: "chat_only",
    includeActiveEngine: true,
    includeWritingCard: true,
    includeProofingCard: true,
    includeLongline: true,
    maxContextChars: 120000,
  }],
  ["list_gpt_writing_context_bundles", { limit: 20 }],
  ["save_chat_output_as_writing_candidate", {
    source: "chatgpt",
    dryRun: false,
  }],
  ["get_writing_candidate_detail", {
    includeContent: false,
    maxContentChars: 12000,
  }],
  ["list_writing_candidates", { limit: 20 }],
  ["build_candidate_proofing_context", {
    proofingMode: "full",
    includeCandidateContent: true,
    includeActiveEngine: true,
    includeWritingCard: true,
    includeProofingCard: true,
    includeLongline: true,
    maxContextChars: 120000,
  }],
  ["list_candidate_proofing_contexts", { limit: 20 }],
  ["save_chat_output_as_proof_report", {
    verdict: "needs_revision",
    severity: "none",
    source: "chatgpt",
    dryRun: false,
  }],
  ["list_proof_reports", { limit: 20 }],
]);

const expectedIntegerMaximumMetadata = new Map([
  ["query_mcp_audit:limit", 1000],
  ["search_context:top", 100],
  ["run_pipeline:top", 100],
  ["compress_error_rules:top", 1000],
  ["compress_error_rules:minCount", 1000],
  ["run_creative_task:limit", 100],
  ["run_creative_task:maxContextChars", 250000],
  ["build_gpt_writing_context:maxContextChars", 250000],
  ["list_gpt_writing_context_bundles:limit", 100],
  ["get_writing_candidate_detail:maxContentChars", 50000],
  ["list_writing_candidates:limit", 100],
  ["build_candidate_proofing_context:maxContextChars", 250000],
  ["list_candidate_proofing_contexts:limit", 100],
  ["list_proof_reports:limit", 100],
]);

const expectedNullNormalizationMetadata = {
  required: "reject",
  optionalWithDefault: "applyDefault",
  optionalWithoutDefault: "preserveNull",
};

const expectedEmptyStringNormalizationMetadata = {
  required: "rejectBlank",
  optionalWithDefault: "applyDefault",
  optionalWithoutDefault: "omit",
  crossFieldPresence: "trimmedNonEmpty",
};

const expectedStringArrayNormalizationMetadata = {
  blankItems: "rejectBlank",
  nonBlankItems: "preserve",
};

const expectedInputLimits = {
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
};

const expectedContentStringFields = new Set([
  "task",
  "feedback",
  "badPattern",
  "whyBad",
  "fixRule",
]);

function expectedStringMaxLength(field) {
  if (field === "chatOutputText") {
    return expectedInputLimits.chatOutputMaxLength;
  }
  if (field === "proofReportText") {
    return expectedInputLimits.proofReportMaxLength;
  }
  if (field === "text") {
    return expectedInputLimits.textMaxLength;
  }
  if (field === "query") {
    return expectedInputLimits.queryMaxLength;
  }
  if (expectedContentStringFields.has(field)) {
    return expectedInputLimits.contentMaxLength;
  }
  return expectedInputLimits.stringMaxLength;
}

const invalidToolFixtures = [
  {
    label: "unknown tool name",
    params: {
      name: "not_a_real_tool",
    },
    expectedMessage: "Unknown tool: not_a_real_tool",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "tools/call params must be an object.",
  },
  {
    label: "missing tool name",
    params: {},
    expectedMessage: "name is required.",
  },
];

const toolLevelErrorFixtures = [
  {
    label: "non-positive audit limit",
    params: {
      name: "query_mcp_audit",
      arguments: {
        limit: 0,
      },
    },
    expectedMessage: "limit must be a positive integer.",
  },
  {
    label: "non-string audit tool filter",
    params: {
      name: "query_mcp_audit",
      arguments: {
        tool: 123,
      },
    },
    expectedMessage: "tool must be a string.",
  },
  {
    label: "non-boolean audit ordering",
    params: {
      name: "query_mcp_audit",
      arguments: {
        oldest: "yes",
      },
    },
    expectedMessage: "oldest must be a boolean.",
  },
];

const highRiskArgumentErrorFixtures = [
  {
    label: "import missing source",
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      dryRun: true,
    },
    expectedMessage: "source is required.",
  },
  {
    label: "import non-string kind",
    name: "import_policy_file",
    arguments: {
      kind: 123,
      source: "README.md",
      dryRun: true,
    },
    expectedMessage: "kind must be a string.",
  },
  {
    label: "commit non-boolean latest",
    name: "commit_error_report",
    arguments: {
      latest: "yes",
      dryRun: true,
    },
    expectedMessage: "latest must be a boolean.",
  },
  {
    label: "commit non-string pending path",
    name: "commit_error_report",
    arguments: {
      pending: 123,
      dryRun: true,
    },
    expectedMessage: "pending must be a string.",
  },
  {
    label: "compress non-positive top",
    name: "compress_error_rules",
    arguments: {
      top: 0,
      dryRun: true,
    },
    expectedMessage: "top must be a positive integer.",
  },
  {
    label: "compress non-boolean updateActive",
    name: "compress_error_rules",
    arguments: {
      updateActive: "yes",
      dryRun: true,
    },
    expectedMessage: "updateActive must be a boolean.",
  },
  {
    label: "settlement missing title",
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      text: "Validation fixture.",
      dryRun: true,
    },
    expectedMessage: "title is required.",
  },
  {
    label: "settlement non-string reminder item",
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Validation fixture",
      text: "Validation fixture.",
      reminders: [123],
      dryRun: true,
    },
    expectedMessage: "reminders must be an array of strings.",
  },
  {
    label: "activation non-string version",
    name: "activate_engine_version",
    arguments: {
      version: 123,
      dryRun: true,
    },
    expectedMessage: "version must be a string.",
  },
  {
    label: "activation missing candidate source",
    name: "activate_engine_version",
    arguments: {
      dryRun: true,
    },
    expectedMessage: "Provide exactly one candidate source: --version or --candidate.",
    wrappedToolError: true,
  },
];

const optionalNullDefaultFixtures = [
  {
    name: "get_current_project_state",
    arguments: {
      includeHashes: null,
    },
    expectedFragments: [
      "\"project\": \"武裝學院的二三事\"",
      "\"sha256\":",
    ],
  },
  {
    name: "validate_jsonl",
    arguments: {
      files: ["data/feedback_db/pending_error_reports.jsonl"],
      all: null,
      strict: null,
    },
    expectedFragments: [
      "Validated 1 files",
      "0 errors",
    ],
  },
  {
    name: "commit_error_report",
    arguments: {
      list: true,
      latest: null,
      target: null,
      dryRun: null,
    },
    expectedAppliedDefaults: {
      latest: false,
      dryRun: false,
    },
    expectedPreservedNulls: ["target"],
  },
  {
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Optional null semantics smoke",
      text: "This fixture must be stopped by the confirmation guard.",
      taskPrompt: null,
      confirmAdopted: null,
      dryRun: null,
    },
    expectedAppliedDefaults: {
      confirmAdopted: false,
      dryRun: false,
    },
    expectedPreservedNulls: ["taskPrompt"],
    expectedError: "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.",
  },
  {
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
      reason: null,
      dryRun: null,
    },
    expectedAppliedDefaults: {
      dryRun: true,
    },
    expectedPreservedNulls: ["reason"],
    expectedFragments: [
      "Dry run: yes",
      "Dry run complete. No files written.",
    ],
  },
  {
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      force: null,
      dryRun: null,
      confirm: null,
    },
    expectedAppliedDefaults: {
      force: false,
      dryRun: true,
    },
    expectedPreservedNulls: ["confirm"],
    expectedFragments: [
      "Dry run: yes",
      "Dry run complete. No files written.",
    ],
  },
];

const optionalBlankStringFixtures = [
  {
    name: "add_feedback_raw",
    arguments: {
      type: "   ",
      feedback: "Optional blank string default fixture.",
      noCandidate: true,
      dryRun: true,
    },
    expectedAppliedDefaults: {
      type: "rejected",
    },
  },
  {
    name: "commit_error_report",
    arguments: {
      list: true,
      target: "",
      dryRun: true,
    },
    expectedOmittedFields: ["target"],
  },
  {
    name: "save_draft",
    arguments: {
      title: "Save draft execution smoke",
      text: "This dry-run fixture verifies the save-draft subprocess can execute.",
      status: "   ",
      dryRun: true,
    },
    expectedOmittedFields: ["status"],
    expectedFragments: [
      "Draft save plan:",
      "\"status\": \"candidate\"",
      "Dry run: no files written.",
    ],
  },
];

const highRiskConfirmationFixtures = [
  {
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      dryRun: false,
    },
    expectedMessage: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
  },
  {
    name: "commit_error_report",
    arguments: {
      latest: true,
    },
    expectedAppliedDefaults: {
      list: false,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
  },
  {
    name: "compress_error_rules",
    arguments: {
      updateActive: true,
      allowEmpty: true,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
  },
  {
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Confirmation guard smoke",
      text: "This text must never be written.",
    },
    expectedAppliedDefaults: {
      confirmAdopted: false,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.",
  },
  {
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
      dryRun: false,
    },
    expectedMessage: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
  },
];

const wrongConfirmationFixtures = [
  {
    name: "import_policy_file",
    token: "WRONG_IMPORT_TOKEN",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      dryRun: false,
      confirm: "WRONG_IMPORT_TOKEN",
    },
    expectedMessage: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
  },
  {
    name: "commit_error_report",
    token: "WRONG_COMMIT_TOKEN",
    arguments: {
      latest: true,
      dryRun: false,
      confirm: "WRONG_COMMIT_TOKEN",
    },
    expectedMessage: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
  },
  {
    name: "compress_error_rules",
    token: "WRONG_RULES_TOKEN",
    arguments: {
      updateActive: true,
      allowEmpty: true,
      dryRun: false,
      confirm: "WRONG_RULES_TOKEN",
    },
    expectedMessage: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
  },
  {
    name: "activate_engine_version",
    token: "WRONG_ACTIVATE_TOKEN",
    arguments: {
      version: "v5.0.12",
      dryRun: false,
      confirm: "WRONG_ACTIVATE_TOKEN",
    },
    expectedMessage: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
  },
];

const confirmedDryRunFixtures = [
  {
    name: "import_policy_file",
    token: "IMPORT_POLICY",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      dryRun: true,
      confirm: "IMPORT_POLICY",
    },
    expectedFragments: [
      "Import plan:",
      "Dry run: yes",
      "Confirm token: IMPORT_POLICY",
      "Dry run complete. No files written.",
    ],
  },
  {
    name: "commit_error_report",
    token: "COMMIT",
    arguments: {
      pending: "server/fixtures/mcp-smoke-pending-error-report.jsonl",
      errorId: "E-PACING-MCP-SMOKE-001",
      dryRun: true,
      confirm: "COMMIT",
    },
    expectedFragments: [
      "Commit plan:",
      "E-PACING-MCP-SMOKE-001",
      "Dry run: no files written.",
    ],
  },
  {
    name: "compress_error_rules",
    token: "UPDATE_RULES",
    arguments: {
      updateActive: true,
      allowEmpty: true,
      dryRun: true,
      confirm: "UPDATE_RULES",
    },
    expectedFragments: [
      "Compressed error rules plan:",
      "Update active: yes",
      "Dry run: yes",
      "No files written.",
    ],
  },
  {
    name: "create_settlement_proposal",
    token: "confirmAdopted=true",
    arguments: {
      chapter: "SMOKE",
      title: "Confirmed dry-run smoke",
      text: "This adopted-text fixture must only produce a settlement plan.",
      confirmAdopted: true,
      dryRun: true,
    },
    expectedFragments: [
      "Settlement proposal plan:",
      "\"chapter\": \"SMOKE\"",
      "Dry run: no files written.",
    ],
  },
  {
    name: "activate_engine_version",
    token: "ACTIVATE",
    arguments: {
      version: "v5.0.12",
      dryRun: true,
      confirm: "ACTIVATE",
    },
    expectedFragments: [
      "Engine activation plan:",
      "Dry run: yes",
      "Confirm token: ACTIVATE",
      "Dry run complete. No files written.",
    ],
  },
];

const confirmedNoOpFixtures = [
  {
    name: "import_policy_file",
    token: "IMPORT_POLICY",
    arguments: {
      kind: "engine",
      source: "data/canon_db/active_engine.md",
      version: "v5.0.12",
      dryRun: false,
      confirm: "IMPORT_POLICY",
    },
    expectedFragments: [
      "Import plan:",
      "Active needs write: no",
      "Version needs write: no",
      "Dry run: no",
      "Confirm token: IMPORT_POLICY",
      "No files written because active and version already match the source.",
    ],
  },
  {
    name: "activate_engine_version",
    token: "ACTIVATE",
    arguments: {
      version: "v5.0.12",
      dryRun: false,
      confirm: "ACTIVATE",
    },
    expectedFragments: [
      "Engine activation plan:",
      "Candidate content is identical to the current active engine.",
      "Dry run: no",
      "Confirm token: ACTIVATE",
      "No files written because the candidate already matches active_engine.md.",
    ],
  },
];

const concurrencyFailureFixtures = [
  {
    name: "activate_engine_version",
    token: "ACTIVATE",
    arguments: {
      version: "v5.0.12",
      requiredCurrentSha: "0000000000000000000000000000000000000000000000000000000000000000",
      dryRun: false,
      confirm: "ACTIVATE",
    },
    expectedMessageFragment: "Current active SHA mismatch. Expected 0000000000000000000000000000000000000000000000000000000000000000, got ",
  },
];

const expectedResources = [
  "armed-academy://canon/active_engine",
  "armed-academy://outputs/task_prompt",
  "armed-academy://jsonl/data:outputs:logs:mcp_tool_audit.jsonl",
];

const invalidResourceFixtures = [
  {
    label: "unknown resource URI",
    params: {
      uri: "armed-academy://not-a-real-resource",
    },
    expectedMessage: "Unknown resource URI: armed-academy://not-a-real-resource",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "resources/read params must be an object.",
  },
  {
    label: "missing resource URI",
    params: {},
    expectedMessage: "uri is required.",
  },
];

const promptFixtures = [
  {
    name: "generate_chapter",
    arguments: {
      task: "smoke test generate",
      query: "朝日奈千夜 九逃",
    },
    expectedFragments: [
      "# 下一章正文候選 Prompt｜正式模板",
      "## 正文輸出格式",
    ],
  },
  {
    name: "proofread_draft",
    arguments: {
      draft_id: "SMOKE-DRAFT-001",
    },
    expectedFragments: [
      "# 正式採用前驗稿精修 Prompt｜正式模板",
      "## Canon Guard",
    ],
  },
  {
    name: "settle_chapter",
    arguments: {
      chapter: "第二十章",
    },
    expectedFragments: [
      "# 章節正式結算模板",
      "## 正式成立事項",
    ],
  },
  {
    name: "compress_errors",
    arguments: {
      source_scope: "formal error reports",
    },
    expectedFragments: [
      "# 錯誤報告壓縮模板",
      "## 壓縮後正式規則",
    ],
  },
  {
    name: "rewrite_by_errors",
    arguments: {
      draft_id: "SMOKE-DRAFT-001",
      error_focus: "Canon Guard",
    },
    expectedFragments: [
      "# 依錯誤報告重寫模板",
      "## Canon Guard 自查",
    ],
  },
];

const expectedPrompts = promptFixtures.map((fixture) => fixture.name);

const invalidPromptFixtures = [
  {
    label: "unknown prompt name",
    params: {
      name: "not_a_real_prompt",
    },
    expectedMessage: "Unknown prompt: not_a_real_prompt",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "prompts/get params must be an object.",
  },
  {
    label: "missing prompt name",
    params: {},
    expectedMessage: "name is required.",
  },
];

const invalidJsonRpcFixtures = [
  {
    label: "unknown method",
    message: {
      jsonrpc: "2.0",
      method: "not/a/real/method",
      params: {},
    },
    expectedCode: -32601,
    expectedMessage: "Method not found: not/a/real/method",
  },
  {
    label: "invalid request",
    message: {
      jsonrpc: "2.0",
      params: {},
    },
    expectedCode: -32600,
    expectedMessage: "Invalid Request",
  },
];

function usage() {
  return [
    "Usage:",
    "  node server/src/mcp-smoke-test.mjs [--verbose]",
    "",
    "What it checks:",
    "  - Starts server/src/mcp-server.mjs over stdio.",
    "  - Runs initialize, tools/list, and safe tools/call requests.",
    "  - Verifies expected tool names are exposed.",
    "  - Verifies invalid tools/call requests return JSON-RPC -32602 errors.",
    "  - Verifies known read-tool argument errors return result.isError instead of protocol errors.",
    "  - Verifies high-risk real-write requests fail without explicit confirmation.",
    "  - Verifies incorrect confirmation tokens are rejected and preserved in audit records.",
    "  - Verifies resources/list and resources/read expose readable project data.",
    "  - Verifies invalid resources/read requests return JSON-RPC -32602 errors.",
    "  - Verifies prompts/list and prompts/get expose all prompt fixtures and runtime arguments.",
    "  - Verifies invalid prompts/get requests return JSON-RPC -32602 errors.",
    "  - Verifies JSON-RPC method, request, and parse errors return -32601, -32600, and -32700.",
    "  - Verifies Content-Length and newline framing can coexist on one connection.",
    "  - Verifies Content-Length headers and multibyte UTF-8 bodies survive chunked writes.",
    "  - Verifies two Content-Length frames can be consumed from one write.",
    "  - Verifies one Content-Length frame and one newline frame can share one write.",
    "  - Verifies one newline frame followed by one Content-Length frame can share one write.",
    "  - Verifies malformed Content-Length headers return header-framed -32700 and recover.",
    "  - Verifies duplicate, conflicting, trailing-garbage, negative, and unsafe Content-Length values are rejected.",
    "  - Verifies invalid JSON bodies with valid Content-Length return header-framed -32700 and recover.",
    "  - Verifies Content-Length and newline message bodies over 16 MiB return -32700 and recover.",
    "  - Verifies Content-Length headers over 8 KiB return header-framed -32700 and recover.",
    "  - Verifies stdin EOF during newline, header, or Content-Length body frames returns -32700.",
    "  - Verifies the 256-message dispatch queue rejects overload and recovers after draining.",
    "  - Verifies stdout backpressure preserves 1,024 queued errors and a recovery response.",
    "  - Verifies EOF during stdout backpressure drains complete frames before truncation checks.",
    "  - Verifies import_policy_file, activate_engine_version, and compress_error_rules stay dry-run by default.",
    "  - Verifies MCP write audit records, then restores the audit log byte-for-byte.",
    "  - Verifies active policy files and compressed_rules.md hashes are unchanged.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    verbose: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

async function hashFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return hashText(text);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function snapshotFile(filePath) {
  try {
    return {
      exists: true,
      bytes: await readFile(filePath),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        bytes: Buffer.alloc(0),
      };
    }
    throw error;
  }
}

async function restoreFileSnapshot(filePath, snapshot) {
  if (!snapshot.exists) {
    await rm(filePath, { force: true });
    assert(!(await pathExists(filePath)), `${normalizePath(filePath)} was not removed after smoke.`);
    return;
  }

  await writeFile(filePath, snapshot.bytes);
  const restored = await readFile(filePath);
  assert(
    restored.equals(snapshot.bytes),
    `${normalizePath(filePath)} was not restored byte-for-byte after smoke.`,
  );
}

async function snapshotDirectoryEntries(dirPath) {
  try {
    return {
      exists: true,
      names: new Set(await readdir(dirPath)),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        names: new Set(),
      };
    }
    throw error;
  }
}

async function restoreDirectoryEntries(dirPath, snapshot) {
  let currentNames = [];
  try {
    currentNames = await readdir(dirPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const name of currentNames) {
    if (!snapshot.names.has(name)) {
      await rm(path.join(dirPath, name), { recursive: true, force: true });
    }
  }
  if (!snapshot.exists) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

async function countJsonlRecords(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function readJsonlRecords(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function snapshotWatchedFiles() {
  const entries = await Promise.all(
    watchedFiles.map(async (filePath) => [normalizePath(filePath), await hashFile(filePath)]),
  );
  return new Map(entries);
}

async function snapshotPathTree(targetPath) {
  try {
    const stats = await stat(targetPath);
    if (stats.isFile()) {
      const bytes = await readFile(targetPath);
      return [{
        path: normalizePath(targetPath),
        kind: "file",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }];
    }

    const entries = await readdir(targetPath, { withFileTypes: true });
    const children = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      children.push(...await snapshotPathTree(path.join(targetPath, entry.name)));
    }
    return [{
      path: normalizePath(targetPath),
      kind: "directory",
    }, ...children];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [{
        path: normalizePath(targetPath),
        kind: "missing",
      }];
    }
    throw error;
  }
}

async function snapshotProtectedRuntimePaths() {
  const snapshots = await Promise.all(protectedRuntimePaths.map(snapshotPathTree));
  return snapshots.flat();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkNodeSyntax(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", filePath], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Syntax check timed out: ${normalizePath(filePath)}`));
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        `Syntax check failed for ${normalizePath(filePath)}: ${output.trim() || `exit ${code}`}`,
      ));
    });
  });
}

async function checkToolScripts() {
  const actualScripts = (await readdir(toolsDir))
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  assert(
    JSON.stringify(actualScripts) === JSON.stringify(expectedToolScripts),
    `Tool script inventory drifted: ${JSON.stringify({
      expected: expectedToolScripts,
      actual: actualScripts,
    })}`,
  );
  await Promise.all(
    actualScripts.map((name) => checkNodeSyntax(path.join(toolsDir, name))),
  );
  return actualScripts;
}

function assertAuditSummaryValue(record, field, expected, label) {
  const actual = record.input_summary?.[field];
  if (typeof expected === "string") {
    assert(
      actual?.type === "string"
        && actual.length === expected.length
        && actual.preview === expected,
      `${label} audit summary ${field} did not equal ${JSON.stringify(expected)}.`,
    );
    return;
  }
  assert(
    actual === expected,
    `${label} audit summary ${field} was ${actual}, expected ${expected}.`,
  );
}

function makeRequest(id, method, params) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

function makeNotification(method, params = {}) {
  return {
    jsonrpc: "2.0",
    method,
    params,
  };
}

function sendMessage(child, message, verbose) {
  const line = JSON.stringify(message);
  if (verbose) {
    console.log(`--> ${line}`);
  }
  child.stdin.write(`${line}\n`);
}

function sendRawLine(child, line, verbose) {
  if (verbose) {
    console.log(`--> [raw] ${line}`);
  }
  child.stdin.write(`${line}\n`);
}

function encodeHeaderFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  return {
    body,
    header,
    frame: Buffer.concat([header, body]),
  };
}

function sendHeaderMessage(child, message, verbose) {
  const { frame } = encodeHeaderFrame(message);
  if (verbose) {
    console.log(`--> [header] ${frame.toString("utf8")}`);
  }
  child.stdin.write(frame);
}

function writeChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function waitForChunkBoundary() {
  return new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

async function sendChunkedHeaderMessage(child, message, marker, verbose) {
  const { body, header, frame } = encodeHeaderFrame(message);
  const markerOffset = body.indexOf(Buffer.from(marker, "utf8"));
  assert(markerOffset >= 0, `Chunk marker not found in header-framed body: ${marker}`);

  const splitOffsets = [
    8,
    header.length - 1,
    header.length,
    header.length + markerOffset + 1,
    frame.length,
  ];

  let start = 0;
  for (const [index, end] of splitOffsets.entries()) {
    const chunk = frame.subarray(start, end);
    if (verbose) {
      console.log(`--> [header chunk ${index + 1}/${splitOffsets.length}] ${chunk.toString("hex")}`);
    }
    await writeChunk(child.stdin, chunk);
    start = end;
    if (index < splitOffsets.length - 1) {
      await waitForChunkBoundary();
    }
  }

  return splitOffsets.length;
}

async function sendBackToBackHeaderMessages(child, messages, verbose) {
  const frames = messages.map((message) => encodeHeaderFrame(message).frame);
  const payload = Buffer.concat(frames);
  if (verbose) {
    console.log(`--> [header batch ${frames.length} frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: frames.length,
    writes: 1,
  };
}

async function sendMixedBatchMessages(child, headerMessage, lineMessage, verbose) {
  const headerFrame = encodeHeaderFrame(headerMessage).frame;
  const lineFrame = Buffer.from(`${JSON.stringify(lineMessage)}\n`, "utf8");
  const payload = Buffer.concat([headerFrame, lineFrame]);
  if (verbose) {
    console.log(`--> [mixed batch 2 frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: 2,
    writes: 1,
  };
}

async function sendReverseMixedBatchMessages(child, lineMessage, headerMessage, verbose) {
  const lineFrame = Buffer.from(`${JSON.stringify(lineMessage)}\n`, "utf8");
  const headerFrame = encodeHeaderFrame(headerMessage).frame;
  const payload = Buffer.concat([lineFrame, headerFrame]);
  if (verbose) {
    console.log(`--> [reverse mixed batch 2 frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: 2,
    writes: 1,
  };
}

async function sendMalformedHeaderWithRecovery(child, recoveryMessage, verbose) {
  const malformedHeader = Buffer.from("Content-Length: not-a-number\r\n\r\n", "ascii");
  const recoveryFrame = Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8");
  const payload = Buffer.concat([malformedHeader, recoveryFrame]);
  if (verbose) {
    console.log(`--> [malformed header + recovery / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    errors: 1,
    recovery_frames: 1,
    writes: 1,
  };
}

async function sendInvalidContentLengthHeaderWithRecovery(
  child,
  fixture,
  recoveryMessage,
  verbose,
) {
  const invalidHeader = Buffer.from(`${fixture.header}\r\n\r\n`, "ascii");
  const recoveryFrame = Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8");
  const payload = Buffer.concat([invalidHeader, recoveryFrame]);
  if (verbose) {
    console.log(`--> [${fixture.label} + recovery / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    errors: 1,
    recovery_frames: 1,
    writes: 1,
  };
}

async function sendMalformedBodyWithRecovery(child, recoveryMessage, verbose) {
  const malformedBody = Buffer.from("{\"jsonrpc\":\"2.0\",invalid-body", "utf8");
  const header = Buffer.from(`Content-Length: ${malformedBody.length}\r\n\r\n`, "ascii");
  const recoveryFrame = Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8");
  const payload = Buffer.concat([header, malformedBody, recoveryFrame]);
  if (verbose) {
    console.log(`--> [malformed body + recovery / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    errors: 1,
    recovery_frames: 1,
    writes: 1,
  };
}

async function writeRepeatedByte(stream, byte, totalBytes) {
  const fullChunk = Buffer.alloc(transportLimitChunkBytes, byte);
  let remaining = totalBytes;
  let writes = 0;
  while (remaining > 0) {
    const chunkLength = Math.min(remaining, fullChunk.length);
    await writeChunk(stream, fullChunk.subarray(0, chunkLength));
    remaining -= chunkLength;
    writes += 1;
  }
  return writes;
}

async function sendOversizedHeaderBodyWithRecovery(child, recoveryMessage, verbose) {
  const bodyLength = expectedMaxJsonRpcMessageBytes + 1;
  const header = Buffer.from(`Content-Length: ${bodyLength}\r\n\r\n`, "ascii");
  if (verbose) {
    console.log(`--> [oversized header body] ${bodyLength} bytes`);
  }
  await writeChunk(child.stdin, header);
  const bodyWrites = await writeRepeatedByte(child.stdin, 0x78, bodyLength);
  await writeChunk(
    child.stdin,
    Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8"),
  );
  return {
    errors: 1,
    recovery_frames: 1,
    streamed_bytes: bodyLength,
    writes: bodyWrites + 2,
  };
}

async function sendOversizedLineWithRecovery(child, recoveryMessage, verbose) {
  const lineLength = expectedMaxJsonRpcMessageBytes + 1;
  if (verbose) {
    console.log(`--> [oversized newline body] ${lineLength} bytes`);
  }
  const bodyWrites = await writeRepeatedByte(
    child.stdin,
    0x78,
    expectedMaxJsonRpcMessageBytes,
  );
  await writeChunk(child.stdin, Buffer.from("x", "ascii"));
  await waitForChunkBoundary();
  await writeChunk(
    child.stdin,
    Buffer.from(`\n${JSON.stringify(recoveryMessage)}\n`, "utf8"),
  );
  return {
    errors: 1,
    recovery_frames: 1,
    streamed_bytes: lineLength,
    writes: bodyWrites + 2,
  };
}

async function sendOversizedHeaderWithRecovery(child, recoveryMessage, verbose) {
  const declaredBody = Buffer.from("1234567", "ascii");
  const prefix = Buffer.from(
    `Content-Length: ${declaredBody.length}\r\nX-Padding: `,
    "ascii",
  );
  const paddingLength = expectedMaxContentLengthHeaderBytes + 1 - prefix.length;
  if (verbose) {
    console.log(
      `--> [oversized Content-Length header] ${expectedMaxContentLengthHeaderBytes + 1} bytes`,
    );
  }
  await writeChunk(child.stdin, prefix);
  const paddingWrites = await writeRepeatedByte(child.stdin, 0x78, paddingLength);
  await waitForChunkBoundary();
  await writeChunk(child.stdin, Buffer.from("\r\n", "ascii"));
  await writeChunk(
    child.stdin,
    Buffer.concat([
      Buffer.from("\r\n", "ascii"),
      declaredBody,
      Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8"),
    ]),
  );
  return {
    errors: 1,
    recovery_frames: 1,
    streamed_bytes: expectedMaxContentLengthHeaderBytes + 1,
    writes: paddingWrites + 3,
  };
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}\n${line}`);
  }
}

function parseSingleFramedResponse(output) {
  const prefix = output.subarray(0, 32).toString("ascii");
  if (/^Content-Length:/i.test(prefix)) {
    const headerEnd = output.indexOf(Buffer.from("\r\n\r\n"));
    assert(headerEnd >= 0, "EOF fixture response did not contain a complete header.");
    const header = output.subarray(0, headerEnd).toString("ascii");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    assert(match, `EOF fixture response had an invalid Content-Length header: ${header}`);
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    assert(
      output.length === bodyStart + length,
      `EOF fixture response length was ${output.length}, expected ${bodyStart + length}.`,
    );
    return {
      framing: "header",
      message: parseJsonLine(output.subarray(bodyStart).toString("utf8")),
    };
  }

  const text = output.toString("utf8");
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  assert(lines.length === 1, `EOF fixture returned ${lines.length} line responses.`);
  return {
    framing: "line",
    message: parseJsonLine(lines[0].trim()),
  };
}

async function runEofTruncationFixture(fixture, verbose) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdoutChunks = [];
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"));
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const closed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${fixture.label} server did not exit after stdin EOF.`));
    }, 10_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  for (const [index, chunk] of fixture.chunks.entries()) {
    if (verbose) {
      console.log(`--> [EOF ${fixture.label} chunk ${index + 1}] ${chunk.toString("hex")}`);
    }
    await writeChunk(child.stdin, chunk);
  }
  child.stdin.end();

  const { code, signal } = await closed;
  assert(
    code === 0 && signal === null,
    `${fixture.label} server exited with code=${code}, signal=${signal}.`,
  );
  assert(stderr.trim() === "", `${fixture.label} wrote unexpected stderr: ${stderr.trim()}`);

  const output = Buffer.concat(stdoutChunks);
  if (verbose) {
    console.log(`<-- [EOF ${fixture.label}] ${output.toString("utf8")}`);
  }
  const { framing, message } = parseSingleFramedResponse(output);
  assert(
    framing === fixture.expectedFraming,
    `${fixture.label} response framing was ${framing}, expected ${fixture.expectedFraming}.`,
  );
  assert(
    message.id === null && message.error?.code === -32700,
    `${fixture.label} returned unexpected response: ${JSON.stringify(message)}`,
  );
  assert(
    message.error?.message === fixture.expectedMessage,
    `${fixture.label} returned unexpected message: ${message.error?.message}`,
  );
  return {
    framing,
    writes: fixture.chunks.length,
  };
}

async function runDispatchQueueLimitFixture(verbose) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdoutBuffer = "";
  let stderr = "";
  const responses = [];
  const countWaiters = [];

  function resolveCountWaiters() {
    for (let index = countWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = countWaiters[index];
      if (responses.length >= waiter.count) {
        countWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve();
      }
    }
  }

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        responses.push(parseJsonLine(line));
      }
    }
    resolveCountWaiters();
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  function waitForResponseCount(count, timeoutMs) {
    if (responses.length >= count) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for ${count} queue fixture responses; got ${responses.length}.`,
          ),
        );
      }, timeoutMs);
      countWaiters.push({ count, resolve, reject, timeout });
    });
  }

  const closed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Dispatch queue fixture server did not exit after stdin EOF."));
    }, 15_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  const acceptedMessages = [
    makeRequest(1, "tools/call", {
      name: "validate_jsonl",
      arguments: {
        files: ["data/feedback_db/pending_error_reports.jsonl"],
      },
    }),
    ...Array.from(
      { length: expectedMaxPendingDispatchMessages - 1 },
      (_, index) => makeRequest(index + 2, "ping", {}),
    ),
  ];
  const overloadRequestIds = [
    expectedMaxPendingDispatchMessages + 1,
    expectedMaxPendingDispatchMessages + 2,
  ];
  const saturationPayload = [
    ...acceptedMessages,
    makeNotification("notifications/queue-overload"),
    ...overloadRequestIds.map((id) => makeRequest(id, "ping", {})),
  ].map((message) => JSON.stringify(message)).join("\n") + "\n";
  if (verbose) {
    console.log(
      `--> [dispatch queue saturation] ${acceptedMessages.length} accepted, `
      + `1 notification dropped, ${overloadRequestIds.length} requests rejected`,
    );
  }
  await writeChunk(child.stdin, Buffer.from(saturationPayload, "utf8"));
  await waitForResponseCount(
    acceptedMessages.length + overloadRequestIds.length,
    15_000,
  );

  const responseMap = new Map(responses.map((response) => [response.id, response]));
  for (let id = 1; id <= expectedMaxPendingDispatchMessages; id += 1) {
    const response = responseMap.get(id);
    assert(response && !response.error, `Accepted queue request ${id} failed.`);
  }
  for (const id of overloadRequestIds) {
    const response = responseMap.get(id);
    assert(
      response?.error?.code === -32000,
      `Overloaded queue request ${id} returned unexpected error: ${JSON.stringify(response)}`,
    );
    assert(
      response.error.message === expectedDispatchQueueOverloadMessage,
      `Overloaded queue request ${id} returned unexpected message: ${response.error.message}`,
    );
  }
  assert(
    !responses.some((response) => response.id === null),
    "Overloaded notification unexpectedly produced a response.",
  );

  const recoveryRequestId = expectedMaxPendingDispatchMessages + 3;
  sendMessage(child, makeRequest(recoveryRequestId, "ping", {}), verbose);
  await waitForResponseCount(
    acceptedMessages.length + overloadRequestIds.length + 1,
    10_000,
  );
  const recoveryResponse = responses.find((response) => response.id === recoveryRequestId);
  assert(
    recoveryResponse && !recoveryResponse.error,
    `Dispatch queue recovery ping failed: ${JSON.stringify(recoveryResponse)}`,
  );

  child.stdin.end();
  const { code, signal } = await closed;
  assert(
    code === 0 && signal === null,
    `Dispatch queue fixture server exited with code=${code}, signal=${signal}.`,
  );
  assert(stderr.trim() === "", `Dispatch queue fixture wrote unexpected stderr: ${stderr.trim()}`);
  assert(stdoutBuffer.trim() === "", "Dispatch queue fixture left a partial response.");
  assert(
    responses.length === acceptedMessages.length + overloadRequestIds.length + 1,
    `Dispatch queue fixture returned ${responses.length} responses.`,
  );

  return {
    limit: expectedMaxPendingDispatchMessages,
    accepted_requests: acceptedMessages.length,
    rejected_requests: overloadRequestIds.length,
    dropped_notifications: 1,
    recovery_requests: 1,
    writes: 2,
  };
}

async function runStdoutBackpressureFixture(verbose) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const parseErrorCount = 1024;
  const recoveryRequestId = 1;
  const expectedResponseCount = parseErrorCount + 1;
  let stdoutBuffer = "";
  let stderr = "";
  const responses = [];
  let resolveResponses;
  let rejectResponses;
  const allResponses = new Promise((resolve, reject) => {
    resolveResponses = resolve;
    rejectResponses = reject;
  });
  const responseTimeout = setTimeout(() => {
    rejectResponses(
      new Error(
        `Timed out waiting for ${expectedResponseCount} stdout backpressure responses; `
        + `got ${responses.length}.`,
      ),
    );
  }, 15_000);

  child.stdout.setEncoding("utf8");
  child.stdout.pause();
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        responses.push(parseJsonLine(line));
      }
    }
    if (responses.length >= expectedResponseCount) {
      clearTimeout(responseTimeout);
      resolveResponses();
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const closed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Stdout backpressure fixture server did not exit after stdin EOF."));
    }, 20_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  const payload = (
    `${"{\n".repeat(parseErrorCount)}`
    + `${JSON.stringify(makeRequest(recoveryRequestId, "ping", {}))}\n`
  );
  if (verbose) {
    console.log(
      `--> [stdout backpressure] ${parseErrorCount} parse errors + 1 recovery ping`,
    );
  }
  await writeChunk(child.stdin, Buffer.from(payload, "utf8"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  child.stdout.resume();
  await allResponses;

  const parseErrors = responses.filter(
    (response) => response.id === null && response.error?.code === -32700,
  );
  assert(
    parseErrors.length === parseErrorCount,
    `Expected ${parseErrorCount} backpressure parse errors, got ${parseErrors.length}.`,
  );
  const recoveryResponse = responses.find(
    (response) => response.id === recoveryRequestId,
  );
  assert(
    recoveryResponse && !recoveryResponse.error,
    `Stdout backpressure recovery ping failed: ${JSON.stringify(recoveryResponse)}`,
  );
  assert(
    responses.length === expectedResponseCount,
    `Stdout backpressure fixture returned ${responses.length} responses.`,
  );

  child.stdin.end();
  const { code, signal } = await closed;
  assert(
    code === 0 && signal === null,
    `Stdout backpressure fixture server exited with code=${code}, signal=${signal}.`,
  );
  assert(
    stderr.trim() === "",
    `Stdout backpressure fixture wrote unexpected stderr: ${stderr.trim()}`,
  );
  assert(stdoutBuffer.trim() === "", "Stdout backpressure fixture left a partial response.");

  return {
    queue_limit: expectedMaxPendingResponseMessages,
    resume_low_water_mark: expectedResponseResumeLowWaterMark,
    parse_errors: parseErrorCount,
    recovery_requests: 1,
    delayed_read_ms: 100,
    writes: 1,
  };
}

async function runBackpressureEofCase({
  label,
  tail,
  expectedResponseCount,
  expectedRecoveryId = null,
  expectedFinalError = null,
}, verbose) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const parseErrorCount = 1024;
  let stdoutBuffer = "";
  let stderr = "";
  const responses = [];
  child.stdout.setEncoding("utf8");
  child.stdout.pause();
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        responses.push(parseJsonLine(line));
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const closed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${label} server did not exit after backpressure EOF.`));
    }, 20_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  const payload = `${"{\n".repeat(parseErrorCount)}${tail}`;
  if (verbose) {
    console.log(`--> [${label}] ${parseErrorCount} parse errors + EOF tail`);
  }
  await writeChunk(child.stdin, Buffer.from(payload, "utf8"));
  child.stdin.end();
  await new Promise((resolve) => setTimeout(resolve, 100));
  child.stdout.resume();

  const { code, signal } = await closed;
  assert(
    code === 0 && signal === null,
    `${label} server exited with code=${code}, signal=${signal}.`,
  );
  assert(stderr.trim() === "", `${label} wrote unexpected stderr: ${stderr.trim()}`);
  assert(stdoutBuffer.trim() === "", `${label} left a partial response.`);
  assert(
    responses.length === expectedResponseCount,
    `${label} returned ${responses.length} responses, expected ${expectedResponseCount}.`,
  );

  const baseParseErrors = responses.filter(
    (response) => (
      response.id === null
      && response.error?.code === -32700
      && response.error?.message !== expectedFinalError
    ),
  );
  assert(
    baseParseErrors.length === parseErrorCount,
    `${label} returned ${baseParseErrors.length} base parse errors.`,
  );
  if (expectedRecoveryId !== null) {
    const recoveryResponse = responses.find(
      (response) => response.id === expectedRecoveryId,
    );
    assert(
      recoveryResponse && !recoveryResponse.error,
      `${label} recovery response failed: ${JSON.stringify(recoveryResponse)}`,
    );
  }
  if (expectedFinalError !== null) {
    const finalResponse = responses.at(-1);
    assert(
      finalResponse?.id === null
        && finalResponse.error?.code === -32700
        && finalResponse.error?.message === expectedFinalError,
      `${label} did not emit the EOF error last: ${JSON.stringify(finalResponse)}`,
    );
  } else {
    assert(
      !responses.some(
        (response) => (
          response.error?.message
          === "Parse error: incomplete newline-delimited JSON at end of input."
        ),
      ),
      `${label} falsely reported an EOF truncation.`,
    );
  }

  return {
    parse_errors: parseErrorCount,
    eof_errors: expectedFinalError === null ? 0 : 1,
    recovery_requests: expectedRecoveryId === null ? 0 : 1,
    delayed_read_ms: 100,
    writes: 1,
  };
}

async function runBackpressureEofFixtures(verbose) {
  const recoveryRequestId = 1;
  const complete = await runBackpressureEofCase({
    label: "backpressure EOF with complete buffered frames",
    tail: `${JSON.stringify(makeRequest(recoveryRequestId, "ping", {}))}\n`,
    expectedResponseCount: 1025,
    expectedRecoveryId: recoveryRequestId,
  }, verbose);
  const truncated = await runBackpressureEofCase({
    label: "backpressure EOF with truncated buffered frame",
    tail: "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"ping\"",
    expectedResponseCount: 1025,
    expectedFinalError: (
      "Parse error: incomplete newline-delimited JSON at end of input."
    ),
  }, verbose);
  return { complete, truncated };
}

function waitForResponse(responses, id, timeoutMs) {
  const queued = responses.queued.get(id);
  if (queued?.length) {
    const message = queued.shift();
    if (queued.length === 0) {
      responses.queued.delete(id);
    }
    return Promise.resolve(message);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for response id ${id}.`));
    }, timeoutMs);

    const waiters = responses.waiters.get(id) ?? [];
    waiters.push({
      resolve: (message) => {
        clearTimeout(timeout);
        resolve(message);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    responses.waiters.set(id, waiters);
  });
}

function recordResponse(responses, message) {
  const waiters = responses.waiters.get(message.id);
  if (waiters?.length) {
    const waiter = waiters.shift();
    if (waiters.length === 0) {
      responses.waiters.delete(message.id);
    }
    waiter.resolve(message);
    return;
  }

  const queued = responses.queued.get(message.id) ?? [];
  queued.push(message);
  responses.queued.set(message.id, queued);
}

async function runSmokeTest(options) {
  const checkedToolScripts = await checkToolScripts();
  const before = await snapshotWatchedFiles();
  const protectedRuntimeBefore = await snapshotProtectedRuntimePaths();
  const auditCountBefore = await countJsonlRecords(auditLogPath);
  const eofTruncationResults = [];
  for (const fixture of eofTruncationFixtures) {
    eofTruncationResults.push(await runEofTruncationFixture(fixture, options.verbose));
  }
  const dispatchQueueResult = await runDispatchQueueLimitFixture(options.verbose);
  const stdoutBackpressureResult = await runStdoutBackpressureFixture(options.verbose);
  const backpressureEofResults = await runBackpressureEofFixtures(options.verbose);
  const expectedAuditRecordsAdded = (
    3
    + unknownArgumentFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + enumConstraintFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + schemaTypeFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + integerMaximumFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + sizeConstraintFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + stringArrayBlankFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + requiredConstraintFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + crossFieldConstraintFixtures.length
    + highRiskArgumentErrorFixtures.length
    + optionalNullDefaultFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + optionalBlankStringFixtures.filter((fixture) => !readOnlyTools.has(fixture.name)).length
    + highRiskConfirmationFixtures.length
    + wrongConfirmationFixtures.length
    + confirmedDryRunFixtures.length
    + confirmedNoOpFixtures.length
    + concurrencyFailureFixtures.length
  );
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdoutBuffer = Buffer.alloc(0);
  let stderrBuffer = "";
  const responses = {
    queued: new Map(),
    waiters: new Map(),
  };
  const responseFramings = new WeakMap();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer = Buffer.concat([
      stdoutBuffer,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"),
    ]);

    while (stdoutBuffer.length > 0) {
      const prefix = stdoutBuffer.subarray(0, 32).toString("ascii");
      if (/^Content-Length:/i.test(prefix)) {
        const headerEnd = stdoutBuffer.indexOf(Buffer.from("\r\n\r\n"));
        if (headerEnd === -1) {
          return;
        }

        const header = stdoutBuffer.subarray(0, headerEnd).toString("ascii");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          throw new Error(`Invalid Content-Length response header: ${header}`);
        }

        const length = Number.parseInt(match[1], 10);
        const bodyStart = headerEnd + 4;
        if (stdoutBuffer.length < bodyStart + length) {
          return;
        }

        const body = stdoutBuffer.subarray(bodyStart, bodyStart + length).toString("utf8");
        stdoutBuffer = stdoutBuffer.subarray(bodyStart + length);
        if (options.verbose) {
          console.log(`<-- [header] ${body}`);
        }
        const message = parseJsonLine(body);
        responseFramings.set(message, "header");
        recordResponse(responses, message);
        continue;
      }

      const newlineIndex = stdoutBuffer.indexOf(0x0a);
      if (newlineIndex === -1) {
        return;
      }

      const line = stdoutBuffer.subarray(0, newlineIndex).toString("utf8").trim();
      stdoutBuffer = stdoutBuffer.subarray(newlineIndex + 1);
      if (!line) {
        continue;
      }
      if (options.verbose) {
        console.log(`<-- [line] ${line}`);
      }
      const message = parseJsonLine(line);
      responseFramings.set(message, "line");
      recordResponse(responses, message);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
  });

  child.on("error", (error) => {
    for (const waiters of responses.waiters.values()) {
      for (const waiter of waiters) {
        waiter.reject(error);
      }
    }
    responses.waiters.clear();
  });

  sendMessage(child, makeRequest(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "mcp-smoke-test",
      version: "0.1.0",
    },
  }), options.verbose);
  sendMessage(child, makeNotification("notifications/initialized"), options.verbose);
  sendMessage(child, makeRequest(2, "tools/list", {}), options.verbose);
  sendMessage(child, makeRequest(3, "tools/call", {
    name: "get_current_project_state",
    arguments: {
      includeHashes: false,
    },
  }), options.verbose);
  sendMessage(child, makeRequest(4, "tools/call", {
    name: "validate_jsonl",
    arguments: {
      files: ["data/feedback_db/pending_error_reports.jsonl"],
    },
  }), options.verbose);
  sendMessage(child, makeRequest(5, "tools/call", {
    name: "compress_error_rules",
    arguments: {},
  }), options.verbose);
  sendMessage(child, makeRequest(6, "tools/call", {
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
    },
  }), options.verbose);
  sendMessage(child, makeRequest(7, "tools/call", {
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
    },
  }), options.verbose);
  sendMessage(child, makeRequest(8, "tools/call", {
    name: "query_mcp_audit",
    arguments: {
      tool: "import_policy_file",
      confirmationId: "none",
      limit: 2,
      json: true,
    },
  }), options.verbose);
  sendMessage(child, makeRequest(9, "resources/list", {}), options.verbose);
  sendMessage(child, makeRequest(10, "resources/read", {
    uri: "armed-academy://error-report/compressed_rules",
  }), options.verbose);
  sendMessage(child, makeRequest(11, "prompts/list", {}), options.verbose);
  const firstPromptRequestId = 12;
  for (const [index, fixture] of promptFixtures.entries()) {
    sendMessage(child, makeRequest(firstPromptRequestId + index, "prompts/get", {
      name: fixture.name,
      arguments: fixture.arguments,
    }), options.verbose);
  }
  const firstInvalidPromptRequestId = firstPromptRequestId + promptFixtures.length;
  for (const [index, fixture] of invalidPromptFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidPromptRequestId + index, "prompts/get", fixture.params),
      options.verbose,
    );
  }
  const postInvalidPingRequestId = firstInvalidPromptRequestId + invalidPromptFixtures.length;
  sendMessage(child, makeRequest(postInvalidPingRequestId, "ping", {}), options.verbose);
  const firstInvalidResourceRequestId = postInvalidPingRequestId + 1;
  for (const [index, fixture] of invalidResourceFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidResourceRequestId + index, "resources/read", fixture.params),
      options.verbose,
    );
  }
  const postInvalidResourcePingRequestId = (
    firstInvalidResourceRequestId + invalidResourceFixtures.length
  );
  sendMessage(child, makeRequest(postInvalidResourcePingRequestId, "ping", {}), options.verbose);
  const firstInvalidToolRequestId = postInvalidResourcePingRequestId + 1;
  for (const [index, fixture] of invalidToolFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidToolRequestId + index, "tools/call", fixture.params),
      options.verbose,
    );
  }
  const postInvalidToolPingRequestId = firstInvalidToolRequestId + invalidToolFixtures.length;
  sendMessage(child, makeRequest(postInvalidToolPingRequestId, "ping", {}), options.verbose);
  const firstToolLevelErrorRequestId = postInvalidToolPingRequestId + 1;
  for (const [index, fixture] of toolLevelErrorFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstToolLevelErrorRequestId + index, "tools/call", fixture.params),
      options.verbose,
    );
  }
  const postToolLevelErrorPingRequestId = (
    firstToolLevelErrorRequestId + toolLevelErrorFixtures.length
  );
  sendMessage(child, makeRequest(postToolLevelErrorPingRequestId, "ping", {}), options.verbose);
  const firstUnknownArgumentRequestId = postToolLevelErrorPingRequestId + 1;
  for (const [index, fixture] of unknownArgumentFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstUnknownArgumentRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-unknown-argument",
        },
      }),
      options.verbose,
    );
  }
  const postUnknownArgumentPingRequestId = (
    firstUnknownArgumentRequestId + unknownArgumentFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postUnknownArgumentPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstEnumConstraintRequestId = postUnknownArgumentPingRequestId + 1;
  for (const [index, fixture] of enumConstraintFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstEnumConstraintRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-enum-constraint",
        },
      }),
      options.verbose,
    );
  }
  const postEnumConstraintPingRequestId = (
    firstEnumConstraintRequestId + enumConstraintFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postEnumConstraintPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstSchemaTypeRequestId = postEnumConstraintPingRequestId + 1;
  for (const [index, fixture] of schemaTypeFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstSchemaTypeRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-schema-type",
        },
      }),
      options.verbose,
    );
  }
  const postSchemaTypePingRequestId = firstSchemaTypeRequestId + schemaTypeFixtures.length;
  sendMessage(
    child,
    makeRequest(postSchemaTypePingRequestId, "ping", {}),
    options.verbose,
  );
  const firstIntegerMaximumRequestId = postSchemaTypePingRequestId + 1;
  for (const [index, fixture] of integerMaximumFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstIntegerMaximumRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-integer-maximum",
        },
      }),
      options.verbose,
    );
  }
  const postIntegerMaximumPingRequestId = (
    firstIntegerMaximumRequestId + integerMaximumFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postIntegerMaximumPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstSizeConstraintRequestId = postIntegerMaximumPingRequestId + 1;
  for (const [index, fixture] of sizeConstraintFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstSizeConstraintRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-size-constraint",
        },
      }),
      options.verbose,
    );
  }
  const postSizeConstraintPingRequestId = (
    firstSizeConstraintRequestId + sizeConstraintFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postSizeConstraintPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstStringArrayBlankRequestId = postSizeConstraintPingRequestId + 1;
  for (const [index, fixture] of stringArrayBlankFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstStringArrayBlankRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-string-array-blank",
        },
      }),
      options.verbose,
    );
  }
  const postStringArrayBlankPingRequestId = (
    firstStringArrayBlankRequestId + stringArrayBlankFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postStringArrayBlankPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstRequiredConstraintRequestId = postStringArrayBlankPingRequestId + 1;
  for (const [index, fixture] of requiredConstraintFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstRequiredConstraintRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-required-constraint",
        },
      }),
      options.verbose,
    );
  }
  const postRequiredConstraintPingRequestId = (
    firstRequiredConstraintRequestId + requiredConstraintFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postRequiredConstraintPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstCrossFieldConstraintRequestId = postRequiredConstraintPingRequestId + 1;
  for (const [index, fixture] of crossFieldConstraintFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstCrossFieldConstraintRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-cross-field-constraint",
        },
      }),
      options.verbose,
    );
  }
  const postCrossFieldConstraintPingRequestId = (
    firstCrossFieldConstraintRequestId + crossFieldConstraintFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postCrossFieldConstraintPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstHighRiskArgumentErrorRequestId = postCrossFieldConstraintPingRequestId + 1;
  for (const [index, fixture] of highRiskArgumentErrorFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstHighRiskArgumentErrorRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-high-risk-arguments",
        },
      }),
      options.verbose,
    );
  }
  const postHighRiskArgumentErrorPingRequestId = (
    firstHighRiskArgumentErrorRequestId + highRiskArgumentErrorFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postHighRiskArgumentErrorPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstOptionalNullDefaultRequestId = postHighRiskArgumentErrorPingRequestId + 1;
  for (const [index, fixture] of optionalNullDefaultFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstOptionalNullDefaultRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-optional-null",
        },
      }),
      options.verbose,
    );
  }
  const postOptionalNullDefaultPingRequestId = (
    firstOptionalNullDefaultRequestId + optionalNullDefaultFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postOptionalNullDefaultPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstOptionalBlankStringRequestId = postOptionalNullDefaultPingRequestId + 1;
  for (const [index, fixture] of optionalBlankStringFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstOptionalBlankStringRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-optional-blank",
        },
      }),
      options.verbose,
    );
  }
  const postOptionalBlankStringPingRequestId = (
    firstOptionalBlankStringRequestId + optionalBlankStringFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postOptionalBlankStringPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstHighRiskConfirmationRequestId = postOptionalBlankStringPingRequestId + 1;
  for (const [index, fixture] of highRiskConfirmationFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstHighRiskConfirmationRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-confirmation",
        },
      }),
      options.verbose,
    );
  }
  const postHighRiskConfirmationPingRequestId = (
    firstHighRiskConfirmationRequestId + highRiskConfirmationFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postHighRiskConfirmationPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstWrongConfirmationRequestId = postHighRiskConfirmationPingRequestId + 1;
  for (const [index, fixture] of wrongConfirmationFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstWrongConfirmationRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-wrong-confirmation",
        },
      }),
      options.verbose,
    );
  }
  const postWrongConfirmationPingRequestId = (
    firstWrongConfirmationRequestId + wrongConfirmationFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postWrongConfirmationPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstConfirmedDryRunRequestId = postWrongConfirmationPingRequestId + 1;
  for (const [index, fixture] of confirmedDryRunFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstConfirmedDryRunRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-confirmed-dry-run",
        },
      }),
      options.verbose,
    );
  }
  const postConfirmedDryRunPingRequestId = (
    firstConfirmedDryRunRequestId + confirmedDryRunFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postConfirmedDryRunPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstConfirmedNoOpRequestId = postConfirmedDryRunPingRequestId + 1;
  for (const [index, fixture] of confirmedNoOpFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstConfirmedNoOpRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-confirmed-no-op",
        },
      }),
      options.verbose,
    );
  }
  const postConfirmedNoOpPingRequestId = (
    firstConfirmedNoOpRequestId + confirmedNoOpFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postConfirmedNoOpPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstConcurrencyFailureRequestId = postConfirmedNoOpPingRequestId + 1;
  for (const [index, fixture] of concurrencyFailureFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstConcurrencyFailureRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-concurrency-failure",
        },
      }),
      options.verbose,
    );
  }
  const postConcurrencyFailurePingRequestId = (
    firstConcurrencyFailureRequestId + concurrencyFailureFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postConcurrencyFailurePingRequestId, "ping", {}),
    options.verbose,
  );
  const firstInvalidJsonRpcRequestId = postConcurrencyFailurePingRequestId + 1;
  for (const [index, fixture] of invalidJsonRpcFixtures.entries()) {
    sendMessage(
      child,
      {
        ...fixture.message,
        id: firstInvalidJsonRpcRequestId + index,
      },
      options.verbose,
    );
  }
  sendRawLine(child, "{\"jsonrpc\":\"2.0\",invalid-json", options.verbose);
  const postParseErrorPingRequestId = firstInvalidJsonRpcRequestId + invalidJsonRpcFixtures.length;
  sendMessage(child, makeRequest(postParseErrorPingRequestId, "ping", {}), options.verbose);
  const headerPingRequestId = postParseErrorPingRequestId + 1;
  sendHeaderMessage(child, makeRequest(headerPingRequestId, "ping", {
    marker: "武裝學院 framing smoke",
  }), options.verbose);
  const postHeaderLinePingRequestId = headerPingRequestId + 1;
  sendMessage(child, makeRequest(postHeaderLinePingRequestId, "ping", {}), options.verbose);
  const chunkedHeaderPingRequestId = postHeaderLinePingRequestId + 1;
  const chunkedHeaderWriteCount = await sendChunkedHeaderMessage(
    child,
    makeRequest(chunkedHeaderPingRequestId, "ping", {
      marker: "分片測試",
    }),
    "分片測試",
    options.verbose,
  );
  const postChunkedLinePingRequestId = chunkedHeaderPingRequestId + 1;
  sendMessage(child, makeRequest(postChunkedLinePingRequestId, "ping", {}), options.verbose);
  const firstBackToBackPingRequestId = postChunkedLinePingRequestId + 1;
  const backToBackWriteResult = await sendBackToBackHeaderMessages(
    child,
    [
      makeRequest(firstBackToBackPingRequestId, "ping", {
        marker: "連續第一幀",
      }),
      makeRequest(firstBackToBackPingRequestId + 1, "ping", {
        marker: "連續第二幀",
      }),
    ],
    options.verbose,
  );
  const postBackToBackLinePingRequestId = firstBackToBackPingRequestId + 2;
  sendMessage(child, makeRequest(postBackToBackLinePingRequestId, "ping", {}), options.verbose);
  const mixedBatchHeaderPingRequestId = postBackToBackLinePingRequestId + 1;
  const mixedBatchLinePingRequestId = mixedBatchHeaderPingRequestId + 1;
  const mixedBatchWriteResult = await sendMixedBatchMessages(
    child,
    makeRequest(mixedBatchHeaderPingRequestId, "ping", {
      marker: "混合批次標頭幀",
    }),
    makeRequest(mixedBatchLinePingRequestId, "ping", {
      marker: "混合批次換行幀",
    }),
    options.verbose,
  );
  const postMixedBatchPingRequestId = mixedBatchLinePingRequestId + 1;
  sendMessage(child, makeRequest(postMixedBatchPingRequestId, "ping", {}), options.verbose);
  const reverseMixedBatchLinePingRequestId = postMixedBatchPingRequestId + 1;
  const reverseMixedBatchHeaderPingRequestId = reverseMixedBatchLinePingRequestId + 1;
  const reverseMixedBatchWriteResult = await sendReverseMixedBatchMessages(
    child,
    makeRequest(reverseMixedBatchLinePingRequestId, "ping", {
      marker: "反向混合換行幀",
    }),
    makeRequest(reverseMixedBatchHeaderPingRequestId, "ping", {
      marker: "反向混合標頭幀",
    }),
    options.verbose,
  );
  const postReverseMixedBatchPingRequestId = reverseMixedBatchHeaderPingRequestId + 1;
  sendMessage(
    child,
    makeRequest(postReverseMixedBatchPingRequestId, "ping", {}),
    options.verbose,
  );
  const malformedHeaderRecoveryPingRequestId = postReverseMixedBatchPingRequestId + 1;
  const malformedHeaderWriteResult = await sendMalformedHeaderWithRecovery(
    child,
    makeRequest(malformedHeaderRecoveryPingRequestId, "ping", {
      marker: "壞標頭後恢復",
    }),
    options.verbose,
  );
  const firstInvalidContentLengthRecoveryPingRequestId = (
    malformedHeaderRecoveryPingRequestId + 1
  );
  const invalidContentLengthWriteResults = [];
  for (const [index, fixture] of invalidContentLengthHeaderFixtures.entries()) {
    invalidContentLengthWriteResults.push(
      await sendInvalidContentLengthHeaderWithRecovery(
        child,
        fixture,
        makeRequest(firstInvalidContentLengthRecoveryPingRequestId + index, "ping", {
          marker: `invalid Content-Length recovery ${index + 1}`,
        }),
        options.verbose,
      ),
    );
  }
  const malformedBodyRecoveryPingRequestId = (
    firstInvalidContentLengthRecoveryPingRequestId
    + invalidContentLengthHeaderFixtures.length
  );
  const malformedBodyWriteResult = await sendMalformedBodyWithRecovery(
    child,
    makeRequest(malformedBodyRecoveryPingRequestId, "ping", {
      marker: "壞內容後恢復",
    }),
    options.verbose,
  );
  const oversizedHeaderBodyRecoveryPingRequestId = malformedBodyRecoveryPingRequestId + 1;
  const oversizedHeaderBodyWriteResult = await sendOversizedHeaderBodyWithRecovery(
    child,
    makeRequest(oversizedHeaderBodyRecoveryPingRequestId, "ping", {
      marker: "超大標頭內容後恢復",
    }),
    options.verbose,
  );
  const oversizedLineRecoveryPingRequestId = oversizedHeaderBodyRecoveryPingRequestId + 1;
  const oversizedLineWriteResult = await sendOversizedLineWithRecovery(
    child,
    makeRequest(oversizedLineRecoveryPingRequestId, "ping", {
      marker: "超大換行內容後恢復",
    }),
    options.verbose,
  );
  const oversizedHeaderRecoveryPingRequestId = oversizedLineRecoveryPingRequestId + 1;
  const oversizedHeaderWriteResult = await sendOversizedHeaderWithRecovery(
    child,
    makeRequest(oversizedHeaderRecoveryPingRequestId, "ping", {
      marker: "超大標頭後恢復",
    }),
    options.verbose,
  );

  const initialize = await waitForResponse(responses, 1, 10_000);
  const toolsList = await waitForResponse(responses, 2, 10_000);
  const projectState = await waitForResponse(responses, 3, 10_000);
  const validateJsonl = await waitForResponse(responses, 4, 10_000);
  const compressRules = await waitForResponse(responses, 5, 10_000);
  const activateEngine = await waitForResponse(responses, 6, 10_000);
  const importPolicy = await waitForResponse(responses, 7, 10_000);
  const queryAudit = await waitForResponse(responses, 8, 10_000);
  const resourcesList = await waitForResponse(responses, 9, 10_000);
  const resourceRead = await waitForResponse(responses, 10, 10_000);
  const promptsList = await waitForResponse(responses, 11, 10_000);
  const promptGets = await Promise.all(
    promptFixtures.map((_, index) => waitForResponse(responses, firstPromptRequestId + index, 10_000)),
  );
  const invalidPromptGets = await Promise.all(
    invalidPromptFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidPromptRequestId + index, 10_000)
    )),
  );
  const postInvalidPing = await waitForResponse(responses, postInvalidPingRequestId, 10_000);
  const invalidResourceReads = await Promise.all(
    invalidResourceFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidResourceRequestId + index, 10_000)
    )),
  );
  const postInvalidResourcePing = await waitForResponse(
    responses,
    postInvalidResourcePingRequestId,
    10_000,
  );
  const invalidToolCalls = await Promise.all(
    invalidToolFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidToolRequestId + index, 10_000)
    )),
  );
  const postInvalidToolPing = await waitForResponse(
    responses,
    postInvalidToolPingRequestId,
    10_000,
  );
  const toolLevelErrorCalls = await Promise.all(
    toolLevelErrorFixtures.map((_, index) => (
      waitForResponse(responses, firstToolLevelErrorRequestId + index, 10_000)
    )),
  );
  const postToolLevelErrorPing = await waitForResponse(
    responses,
    postToolLevelErrorPingRequestId,
    10_000,
  );
  const unknownArgumentCalls = await Promise.all(
    unknownArgumentFixtures.map((_, index) => (
      waitForResponse(responses, firstUnknownArgumentRequestId + index, 10_000)
    )),
  );
  const postUnknownArgumentPing = await waitForResponse(
    responses,
    postUnknownArgumentPingRequestId,
    10_000,
  );
  const enumConstraintCalls = await Promise.all(
    enumConstraintFixtures.map((_, index) => (
      waitForResponse(responses, firstEnumConstraintRequestId + index, 10_000)
    )),
  );
  const postEnumConstraintPing = await waitForResponse(
    responses,
    postEnumConstraintPingRequestId,
    10_000,
  );
  const schemaTypeCalls = await Promise.all(
    schemaTypeFixtures.map((_, index) => (
      waitForResponse(responses, firstSchemaTypeRequestId + index, 10_000)
    )),
  );
  const postSchemaTypePing = await waitForResponse(
    responses,
    postSchemaTypePingRequestId,
    10_000,
  );
  const integerMaximumCalls = await Promise.all(
    integerMaximumFixtures.map((_, index) => (
      waitForResponse(responses, firstIntegerMaximumRequestId + index, 10_000)
    )),
  );
  const postIntegerMaximumPing = await waitForResponse(
    responses,
    postIntegerMaximumPingRequestId,
    10_000,
  );
  const sizeConstraintCalls = await Promise.all(
    sizeConstraintFixtures.map((_, index) => (
      waitForResponse(responses, firstSizeConstraintRequestId + index, 10_000)
    )),
  );
  const postSizeConstraintPing = await waitForResponse(
    responses,
    postSizeConstraintPingRequestId,
    10_000,
  );
  const stringArrayBlankCalls = await Promise.all(
    stringArrayBlankFixtures.map((_, index) => (
      waitForResponse(responses, firstStringArrayBlankRequestId + index, 10_000)
    )),
  );
  const postStringArrayBlankPing = await waitForResponse(
    responses,
    postStringArrayBlankPingRequestId,
    10_000,
  );
  const requiredConstraintCalls = await Promise.all(
    requiredConstraintFixtures.map((_, index) => (
      waitForResponse(responses, firstRequiredConstraintRequestId + index, 10_000)
    )),
  );
  const postRequiredConstraintPing = await waitForResponse(
    responses,
    postRequiredConstraintPingRequestId,
    10_000,
  );
  const crossFieldConstraintCalls = await Promise.all(
    crossFieldConstraintFixtures.map((_, index) => (
      waitForResponse(responses, firstCrossFieldConstraintRequestId + index, 10_000)
    )),
  );
  const postCrossFieldConstraintPing = await waitForResponse(
    responses,
    postCrossFieldConstraintPingRequestId,
    10_000,
  );
  const highRiskArgumentErrorCalls = await Promise.all(
    highRiskArgumentErrorFixtures.map((_, index) => (
      waitForResponse(responses, firstHighRiskArgumentErrorRequestId + index, 10_000)
    )),
  );
  const postHighRiskArgumentErrorPing = await waitForResponse(
    responses,
    postHighRiskArgumentErrorPingRequestId,
    10_000,
  );
  const optionalNullDefaultCalls = await Promise.all(
    optionalNullDefaultFixtures.map((_, index) => (
      waitForResponse(responses, firstOptionalNullDefaultRequestId + index, 10_000)
    )),
  );
  const postOptionalNullDefaultPing = await waitForResponse(
    responses,
    postOptionalNullDefaultPingRequestId,
    10_000,
  );
  const optionalBlankStringCalls = await Promise.all(
    optionalBlankStringFixtures.map((_, index) => (
      waitForResponse(responses, firstOptionalBlankStringRequestId + index, 10_000)
    )),
  );
  const postOptionalBlankStringPing = await waitForResponse(
    responses,
    postOptionalBlankStringPingRequestId,
    10_000,
  );
  const highRiskConfirmationCalls = await Promise.all(
    highRiskConfirmationFixtures.map((_, index) => (
      waitForResponse(responses, firstHighRiskConfirmationRequestId + index, 10_000)
    )),
  );
  const postHighRiskConfirmationPing = await waitForResponse(
    responses,
    postHighRiskConfirmationPingRequestId,
    10_000,
  );
  const wrongConfirmationCalls = await Promise.all(
    wrongConfirmationFixtures.map((_, index) => (
      waitForResponse(responses, firstWrongConfirmationRequestId + index, 10_000)
    )),
  );
  const postWrongConfirmationPing = await waitForResponse(
    responses,
    postWrongConfirmationPingRequestId,
    10_000,
  );
  const confirmedDryRunCalls = await Promise.all(
    confirmedDryRunFixtures.map((_, index) => (
      waitForResponse(responses, firstConfirmedDryRunRequestId + index, 10_000)
    )),
  );
  const postConfirmedDryRunPing = await waitForResponse(
    responses,
    postConfirmedDryRunPingRequestId,
    10_000,
  );
  const confirmedNoOpCalls = await Promise.all(
    confirmedNoOpFixtures.map((_, index) => (
      waitForResponse(responses, firstConfirmedNoOpRequestId + index, 10_000)
    )),
  );
  const postConfirmedNoOpPing = await waitForResponse(
    responses,
    postConfirmedNoOpPingRequestId,
    10_000,
  );
  const concurrencyFailureCalls = await Promise.all(
    concurrencyFailureFixtures.map((_, index) => (
      waitForResponse(responses, firstConcurrencyFailureRequestId + index, 10_000)
    )),
  );
  const postConcurrencyFailurePing = await waitForResponse(
    responses,
    postConcurrencyFailurePingRequestId,
    10_000,
  );
  const invalidJsonRpcResponses = await Promise.all(
    invalidJsonRpcFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidJsonRpcRequestId + index, 10_000)
    )),
  );
  const parseErrorResponse = await waitForResponse(responses, null, 10_000);
  const postParseErrorPing = await waitForResponse(
    responses,
    postParseErrorPingRequestId,
    10_000,
  );
  const headerPing = await waitForResponse(responses, headerPingRequestId, 10_000);
  const postHeaderLinePing = await waitForResponse(
    responses,
    postHeaderLinePingRequestId,
    10_000,
  );
  const chunkedHeaderPing = await waitForResponse(
    responses,
    chunkedHeaderPingRequestId,
    10_000,
  );
  const postChunkedLinePing = await waitForResponse(
    responses,
    postChunkedLinePingRequestId,
    10_000,
  );
  const backToBackPings = await Promise.all([
    waitForResponse(responses, firstBackToBackPingRequestId, 10_000),
    waitForResponse(responses, firstBackToBackPingRequestId + 1, 10_000),
  ]);
  const postBackToBackLinePing = await waitForResponse(
    responses,
    postBackToBackLinePingRequestId,
    10_000,
  );
  const mixedBatchHeaderPing = await waitForResponse(
    responses,
    mixedBatchHeaderPingRequestId,
    10_000,
  );
  const mixedBatchLinePing = await waitForResponse(
    responses,
    mixedBatchLinePingRequestId,
    10_000,
  );
  const postMixedBatchPing = await waitForResponse(
    responses,
    postMixedBatchPingRequestId,
    10_000,
  );
  const reverseMixedBatchLinePing = await waitForResponse(
    responses,
    reverseMixedBatchLinePingRequestId,
    10_000,
  );
  const reverseMixedBatchHeaderPing = await waitForResponse(
    responses,
    reverseMixedBatchHeaderPingRequestId,
    10_000,
  );
  const postReverseMixedBatchPing = await waitForResponse(
    responses,
    postReverseMixedBatchPingRequestId,
    10_000,
  );
  const malformedHeaderError = await waitForResponse(responses, null, 10_000);
  const malformedHeaderRecoveryPing = await waitForResponse(
    responses,
    malformedHeaderRecoveryPingRequestId,
    10_000,
  );
  const invalidContentLengthErrors = [];
  const invalidContentLengthRecoveryPings = [];
  for (const [index] of invalidContentLengthHeaderFixtures.entries()) {
    invalidContentLengthErrors.push(await waitForResponse(responses, null, 10_000));
    invalidContentLengthRecoveryPings.push(await waitForResponse(
      responses,
      firstInvalidContentLengthRecoveryPingRequestId + index,
      10_000,
    ));
  }
  const malformedBodyError = await waitForResponse(responses, null, 10_000);
  const malformedBodyRecoveryPing = await waitForResponse(
    responses,
    malformedBodyRecoveryPingRequestId,
    10_000,
  );
  const oversizedHeaderBodyError = await waitForResponse(responses, null, 10_000);
  const oversizedHeaderBodyRecoveryPing = await waitForResponse(
    responses,
    oversizedHeaderBodyRecoveryPingRequestId,
    10_000,
  );
  const oversizedLineError = await waitForResponse(responses, null, 10_000);
  const oversizedLineRecoveryPing = await waitForResponse(
    responses,
    oversizedLineRecoveryPingRequestId,
    10_000,
  );
  const oversizedHeaderError = await waitForResponse(responses, null, 10_000);
  const oversizedHeaderRecoveryPing = await waitForResponse(
    responses,
    oversizedHeaderRecoveryPingRequestId,
    10_000,
  );

  child.stdin.end();
  child.kill();

  assert(!initialize.error, `initialize failed: ${JSON.stringify(initialize.error)}`);
  assert(initialize.result?.serverInfo?.name === "armed-academy-fiction-engine", "initialize returned unexpected serverInfo.");

  assert(!toolsList.error, `tools/list failed: ${JSON.stringify(toolsList.error)}`);
  const publicTools = toolsList.result?.tools ?? [];
  const toolNames = new Set(publicTools.map((tool) => tool.name));
  const publicToolMap = new Map(publicTools.map((tool) => [tool.name, tool]));
  for (const expectedTool of expectedTools) {
    assert(toolNames.has(expectedTool), `tools/list missing expected tool: ${expectedTool}`);
  }

  const enumMetadataKeys = new Set();
  const requiredMetadataKeys = new Set();
  const stringArrayMetadataKeys = new Set();
  const integerMaximumMetadataKeys = new Set();
  let schemaPropertyCount = 0;
  let defaultMetadataCount = 0;
  let stringMaxLengthMetadataCount = 0;
  let arrayMaxItemsMetadataCount = 0;
  let arrayItemMaxLengthMetadataCount = 0;
  let nullNormalizationMetadataCount = 0;
  let emptyStringNormalizationMetadataCount = 0;
  let stringArrayNormalizationMetadataCount = 0;
  let crossFieldMetadataCount = 0;
  let confirmationMetadataCount = 0;
  let permissionMetadataCount = 0;

  for (const expectedTool of expectedTools) {
    const tool = publicToolMap.get(expectedTool);
    const permission = tool?._meta?.["armed-academy/permission"];
    assert(
      permission && typeof permission === "object" && !Array.isArray(permission),
      `${expectedTool} did not expose armed-academy permission metadata.`,
    );
    for (const field of permissionMetadataFields) {
      assert(field in permission, `${expectedTool} permission metadata is missing ${field}.`);
    }
    const expectedRisk = readOnlyTools.has(expectedTool)
      ? "read"
      : highRiskTools.has(expectedTool)
        ? "high-risk-write"
        : tool.description.startsWith("[generated-output]")
          ? "generated-output"
          : "low-risk-write";
    const expectedPermissionLevel = readOnlyTools.has(expectedTool)
      ? "read_only"
      : highRiskTools.has(expectedTool)
        ? "write_high_risk"
        : "write_low_risk";
    assert(permission.tool_name === expectedTool, `${expectedTool} permission tool_name drifted.`);
    assert(
      permission.permission_level === expectedPermissionLevel,
      `${expectedTool} permission_level was ${permission.permission_level}.`,
    );
    assert(
      permission.read_or_write === (readOnlyTools.has(expectedTool) ? "read" : "write"),
      `${expectedTool} read_or_write drifted.`,
    );
    assert(permission.risk_level === expectedRisk, `${expectedTool} risk_level drifted.`);
    assert(
      permission.requires_user_confirmation === highRiskTools.has(expectedTool),
      `${expectedTool} confirmation permission drifted.`,
    );
    assert(
      permission.requires_backup_before_write === backupRequiredTools.has(expectedTool),
      `${expectedTool} backup permission drifted.`,
    );
    assert(
      Array.isArray(permission.allowed_sources) && permission.allowed_sources.length > 0,
      `${expectedTool} allowed_sources must be a non-empty array.`,
    );
    assert(
      Array.isArray(permission.forbidden_sources) && permission.forbidden_sources.length > 0,
      `${expectedTool} forbidden_sources must be a non-empty array.`,
    );
    assert(
      permission.can_modify_canon === activeEngineModifierTools.has(expectedTool),
      `${expectedTool} can_modify_canon drifted.`,
    );
    assert(
      permission.can_modify_active_engine === activeEngineModifierTools.has(expectedTool),
      `${expectedTool} can_modify_active_engine drifted.`,
    );
    assert(permission.can_modify_story_graph === false, `${expectedTool} can_modify_story_graph drifted.`);
    assert(permission.can_modify_memory === false, `${expectedTool} can_modify_memory drifted.`);
    assert(
      permission.can_commit_error_report === (expectedTool === "commit_error_report"),
      `${expectedTool} can_commit_error_report drifted.`,
    );
    assert(
      permission.log_required === !readOnlyTools.has(expectedTool),
      `${expectedTool} log_required drifted.`,
    );
    permissionMetadataCount += 1;

    const schema = tool?.inputSchema;
    assert(schema?.type === "object", `${expectedTool} inputSchema type was not object.`);
    assert(
      schema?.additionalProperties === false,
      `${expectedTool} inputSchema did not expose additionalProperties=false.`,
    );
    const exposedNullNormalization = schema?.["x-null-normalization"] ?? null;
    assert(
      JSON.stringify(exposedNullNormalization) === JSON.stringify(expectedNullNormalizationMetadata),
      `${expectedTool} exposed unexpected null normalization metadata: ${JSON.stringify(exposedNullNormalization)}`,
    );
    nullNormalizationMetadataCount += 1;
    const exposedEmptyStringNormalization = schema?.["x-empty-string-normalization"] ?? null;
    assert(
      JSON.stringify(exposedEmptyStringNormalization)
        === JSON.stringify(expectedEmptyStringNormalizationMetadata),
      `${expectedTool} exposed unexpected empty-string normalization metadata: ${JSON.stringify(exposedEmptyStringNormalization)}`,
    );
    emptyStringNormalizationMetadataCount += 1;
    const exposedStringArrayNormalization = schema?.["x-string-array-normalization"] ?? null;
    assert(
      JSON.stringify(exposedStringArrayNormalization)
        === JSON.stringify(expectedStringArrayNormalizationMetadata),
      `${expectedTool} exposed unexpected string-array normalization metadata: ${JSON.stringify(exposedStringArrayNormalization)}`,
    );
    stringArrayNormalizationMetadataCount += 1;

    const properties = schema?.properties ?? {};
    for (const [field, fieldSchema] of Object.entries(properties)) {
      schemaPropertyCount += 1;
      assert(
        ["string", "boolean", "integer", "array", "object"].includes(fieldSchema.type),
        `${expectedTool}.${field} used unsupported schema type ${fieldSchema.type}.`,
      );
      if (fieldSchema.type === "string") {
        const expectedMaxLength = expectedStringMaxLength(field);
        assert(
          fieldSchema.maxLength === expectedMaxLength,
          `${expectedTool}.${field} maxLength was ${fieldSchema.maxLength}, expected ${expectedMaxLength}.`,
        );
        stringMaxLengthMetadataCount += 1;
      }
      if (fieldSchema.type === "array") {
        assert(
          fieldSchema.items?.type === "string",
          `${expectedTool}.${field} did not expose string array items.`,
        );
        const expectedMaxItems = field === "files"
          ? expectedInputLimits.fileArrayMaxItems
          : expectedInputLimits.arrayMaxItems;
        const expectedItemMaxLength = field === "files"
          ? expectedInputLimits.fileItemMaxLength
          : expectedInputLimits.arrayItemMaxLength;
        assert(
          fieldSchema.maxItems === expectedMaxItems,
          `${expectedTool}.${field} maxItems was ${fieldSchema.maxItems}, expected ${expectedMaxItems}.`,
        );
        assert(
          fieldSchema.items.maxLength === expectedItemMaxLength,
          `${expectedTool}.${field} item maxLength was ${fieldSchema.items.maxLength}, expected ${expectedItemMaxLength}.`,
        );
        arrayMaxItemsMetadataCount += 1;
        arrayItemMaxLengthMetadataCount += 1;
        stringArrayMetadataKeys.add(`${expectedTool}:${field}`);
      }
      if (fieldSchema.type === "integer") {
        const key = `${expectedTool}:${field}`;
        const expectedMaximum = expectedIntegerMaximumMetadata.get(key);
        assert(
          fieldSchema.minimum === 1,
          `${expectedTool}.${field} did not expose minimum=1.`,
        );
        assert(
          expectedMaximum !== undefined,
          `${expectedTool}.${field} did not have an expected integer maximum.`,
        );
        assert(
          fieldSchema.maximum === expectedMaximum,
          `${expectedTool}.${field} maximum was ${fieldSchema.maximum}, expected ${expectedMaximum}.`,
        );
        integerMaximumMetadataKeys.add(key);
      }
      if (Array.isArray(fieldSchema.enum)) {
        enumMetadataKeys.add(`${expectedTool}:${field}`);
      }
      if (Object.hasOwn(fieldSchema, "default")) {
        defaultMetadataCount += 1;
        const defaultType = Array.isArray(fieldSchema.default)
          ? "array"
          : typeof fieldSchema.default;
        const expectedDefaultType = fieldSchema.type === "integer"
          ? "number"
          : fieldSchema.type;
        assert(
          defaultType === expectedDefaultType,
          `${expectedTool}.${field} default type was ${defaultType}, expected ${expectedDefaultType}.`,
        );
        if (Array.isArray(fieldSchema.enum)) {
          assert(
            fieldSchema.enum.includes(fieldSchema.default),
            `${expectedTool}.${field} default was outside its enum.`,
          );
        }
        if (fieldSchema.type === "string") {
          assert(
            Array.from(fieldSchema.default).length <= fieldSchema.maxLength,
            `${expectedTool}.${field} default exceeded maxLength=${fieldSchema.maxLength}.`,
          );
        }
        if (fieldSchema.type === "integer") {
          assert(
            fieldSchema.default >= fieldSchema.minimum,
            `${expectedTool}.${field} default was below minimum=${fieldSchema.minimum}.`,
          );
          assert(
            fieldSchema.default <= fieldSchema.maximum,
            `${expectedTool}.${field} default exceeded maximum=${fieldSchema.maximum}.`,
          );
        }
      }
    }

    const exposedDefaults = Object.fromEntries(
      Object.entries(properties)
        .filter(([, fieldSchema]) => Object.hasOwn(fieldSchema, "default"))
        .map(([field, fieldSchema]) => [field, fieldSchema.default]),
    );
    const expectedDefaults = expectedDefaultMetadata.get(expectedTool) ?? {};
    assert(
      JSON.stringify(exposedDefaults) === JSON.stringify(expectedDefaults),
      `${expectedTool} exposed unexpected defaults: ${JSON.stringify(exposedDefaults)}`,
    );

    for (const field of schema?.required ?? []) {
      requiredMetadataKeys.add(`${expectedTool}:${field}`);
      assert(
        Object.hasOwn(properties, field),
        `${expectedTool} required field ${field} was missing from properties.`,
      );
    }

    const exposedCrossField = schema?.["x-cross-field-constraints"] ?? [];
    const expectedCrossField = expectedCrossFieldMetadata.get(expectedTool) ?? [];
    crossFieldMetadataCount += exposedCrossField.length;
    assert(
      JSON.stringify(exposedCrossField) === JSON.stringify(expectedCrossField),
      `${expectedTool} exposed unexpected cross-field metadata: ${JSON.stringify(exposedCrossField)}`,
    );

    const exposedConfirmation = schema?.["x-confirmation"] ?? null;
    const expectedConfirmation = expectedConfirmationMetadata.get(expectedTool) ?? null;
    if (exposedConfirmation) {
      confirmationMetadataCount += 1;
    }
    assert(
      JSON.stringify(exposedConfirmation) === JSON.stringify(expectedConfirmation),
      `${expectedTool} exposed unexpected confirmation metadata: ${JSON.stringify(exposedConfirmation)}`,
    );
  }

  const enumFixtureKeys = new Set(
    enumConstraintFixtures.map((fixture) => `${fixture.name}:${fixture.field}`),
  );
  assert(
    enumFixtureKeys.size === enumMetadataKeys.size
      && [...enumMetadataKeys].every((key) => enumFixtureKeys.has(key)),
    `Enum fixture coverage did not match tools/list metadata: ${JSON.stringify({
      metadata: [...enumMetadataKeys].sort(),
      fixtures: [...enumFixtureKeys].sort(),
    })}`,
  );

  const requiredFixtureKeys = new Set(
    requiredConstraintFixtures.map((fixture) => `${fixture.name}:${fixture.field}`),
  );
  assert(
    requiredFixtureKeys.size === requiredMetadataKeys.size
      && [...requiredMetadataKeys].every((key) => requiredFixtureKeys.has(key)),
    `Required fixture coverage did not match tools/list metadata: ${JSON.stringify({
      metadata: [...requiredMetadataKeys].sort(),
      fixtures: [...requiredFixtureKeys].sort(),
    })}`,
  );

  const stringArrayFixtureKeys = new Set(
    stringArrayBlankFixtures.map((fixture) => `${fixture.name}:${fixture.field}`),
  );
  assert(
    stringArrayFixtureKeys.size === stringArrayMetadataKeys.size
      && [...stringArrayMetadataKeys].every((key) => stringArrayFixtureKeys.has(key)),
    `String-array blank fixture coverage did not match tools/list metadata: ${JSON.stringify({
      metadata: [...stringArrayMetadataKeys].sort(),
      fixtures: [...stringArrayFixtureKeys].sort(),
    })}`,
  );

  const integerMaximumFixtureKeys = new Set(
    integerMaximumFixtures.map((fixture) => `${fixture.name}:${fixture.field}`),
  );
  assert(
    integerMaximumFixtureKeys.size === integerMaximumMetadataKeys.size
      && [...integerMaximumMetadataKeys].every((key) => integerMaximumFixtureKeys.has(key)),
    `Integer maximum fixture coverage did not match tools/list metadata: ${JSON.stringify({
      metadata: [...integerMaximumMetadataKeys].sort(),
      fixtures: [...integerMaximumFixtureKeys].sort(),
    })}`,
  );
  assert(
    integerMaximumMetadataKeys.size === expectedIntegerMaximumMetadata.size
      && [...expectedIntegerMaximumMetadata.keys()]
        .every((key) => integerMaximumMetadataKeys.has(key)),
    `Integer maximum metadata did not match the expected field set: ${JSON.stringify({
      expected: [...expectedIntegerMaximumMetadata.keys()].sort(),
      exposed: [...integerMaximumMetadataKeys].sort(),
    })}`,
  );
  for (const fixture of integerMaximumFixtures) {
    const fieldSchema = publicToolMap.get(fixture.name)?.inputSchema?.properties?.[fixture.field];
    assert(
      fieldSchema?.maximum === fixture.expectedMaximum,
      `${fixture.name}.${fixture.field} maximum was ${fieldSchema?.maximum}, expected ${fixture.expectedMaximum}.`,
    );
  }

  const coveredSizePolicies = new Set();
  for (const fixture of sizeConstraintFixtures) {
    const fieldSchema = publicToolMap.get(fixture.name)?.inputSchema?.properties?.[fixture.field];
    let exposedLimit;
    if (fixture.constraint === "maxLength") {
      exposedLimit = fieldSchema?.maxLength;
    } else if (fixture.constraint === "maxItems") {
      exposedLimit = fieldSchema?.maxItems;
    } else {
      exposedLimit = fieldSchema?.items?.maxLength;
    }
    assert(
      exposedLimit === fixture.expectedLimit,
      `${fixture.name}.${fixture.field} ${fixture.constraint} was ${exposedLimit}, expected ${fixture.expectedLimit}.`,
    );
    coveredSizePolicies.add(`${fixture.constraint}:${fixture.expectedLimit}`);
  }
  const expectedSizePolicies = new Set([
    "maxLength:4096",
    "maxLength:8192",
    "maxLength:65536",
    "maxLength:1000000",
    "maxItems:100",
    "maxItems:256",
    "itemMaxLength:4096",
    "itemMaxLength:16384",
  ]);
  assert(
    coveredSizePolicies.size === expectedSizePolicies.size
      && [...expectedSizePolicies].every((policy) => coveredSizePolicies.has(policy)),
    `Size constraint fixtures did not cover every limit tier: ${JSON.stringify({
      expected: [...expectedSizePolicies].sort(),
      covered: [...coveredSizePolicies].sort(),
    })}`,
  );
  assert(
    requiredConstraintFixtures.some(
      (fixture) => fixture.arguments[fixture.field] === null,
    ),
    "Required-null normalization did not have a behavior fixture.",
  );
  assert(
    optionalNullDefaultFixtures.some(
      (fixture) => Object.keys(fixture.expectedAppliedDefaults ?? {}).length > 0,
    ),
    "Optional null applyDefault normalization did not have a behavior fixture.",
  );
  assert(
    optionalNullDefaultFixtures.some(
      (fixture) => (fixture.expectedPreservedNulls ?? []).length > 0,
    ),
    "Optional null preserveNull normalization did not have a behavior fixture.",
  );
  assert(
    requiredConstraintFixtures.some(
      (fixture) => typeof fixture.arguments[fixture.field] === "string"
        && fixture.arguments[fixture.field].trim() === "",
    ),
    "Required blank-string normalization did not have a behavior fixture.",
  );
  assert(
    optionalBlankStringFixtures.some(
      (fixture) => Object.keys(fixture.expectedAppliedDefaults ?? {}).length > 0,
    ),
    "Optional blank-string applyDefault normalization did not have a behavior fixture.",
  );
  assert(
    optionalBlankStringFixtures.some(
      (fixture) => (fixture.expectedOmittedFields ?? []).length > 0,
    ),
    "Optional blank-string omit normalization did not have a behavior fixture.",
  );
  assert(
    crossFieldConstraintFixtures.some(
      (fixture) => Object.values(fixture.arguments)
        .some((value) => typeof value === "string" && value.trim() === ""),
    ),
    "Cross-field trimmedNonEmpty normalization did not have a behavior fixture.",
  );

  for (const fixture of schemaTypeFixtures) {
    const fieldSchema = publicToolMap.get(fixture.name)?.inputSchema?.properties?.[fixture.field];
    assert(
      fieldSchema?.type === fixture.expectedType,
      `${fixture.name}.${fixture.field} type was ${fieldSchema?.type}, expected ${fixture.expectedType}.`,
    );
    if (fixture.expectedItemType) {
      assert(
        fieldSchema.items?.type === fixture.expectedItemType,
        `${fixture.name}.${fixture.field} item type was ${fieldSchema.items?.type}, expected ${fixture.expectedItemType}.`,
      );
    }
    if (fixture.expectedMinimum !== undefined) {
      assert(
        fieldSchema.minimum === fixture.expectedMinimum,
        `${fixture.name}.${fixture.field} minimum was ${fieldSchema.minimum}, expected ${fixture.expectedMinimum}.`,
      );
    }
  }

  const crossFieldFixtureTools = new Set(
    crossFieldConstraintFixtures.map((fixture) => fixture.name),
  );
  assert(
    crossFieldFixtureTools.size === expectedCrossFieldMetadata.size
      && [...expectedCrossFieldMetadata.keys()].every((name) => crossFieldFixtureTools.has(name)),
    `Cross-field fixture coverage did not match metadata tools: ${JSON.stringify({
      metadata: [...expectedCrossFieldMetadata.keys()].sort(),
      fixtures: [...crossFieldFixtureTools].sort(),
    })}`,
  );

  const confirmationFixtureTools = new Set(
    highRiskConfirmationFixtures.map((fixture) => fixture.name),
  );
  assert(
    confirmationFixtureTools.size === expectedConfirmationMetadata.size
      && [...expectedConfirmationMetadata.keys()].every((name) => confirmationFixtureTools.has(name)),
    `Confirmation fixture coverage did not match metadata tools: ${JSON.stringify({
      metadata: [...expectedConfirmationMetadata.keys()].sort(),
      fixtures: [...confirmationFixtureTools].sort(),
    })}`,
  );
  for (const fixture of highRiskConfirmationFixtures) {
    const metadata = expectedConfirmationMetadata.get(fixture.name);
    const effectiveArguments = {
      ...(expectedDefaultMetadata.get(fixture.name) ?? {}),
      ...fixture.arguments,
    };
    assert(metadata?.message === fixture.expectedMessage, `${fixture.name} confirmation message drifted.`);
    assert(
      Object.entries(metadata.when ?? {}).every(([field, value]) => effectiveArguments[field] === value),
      `${fixture.name} confirmation fixture did not satisfy metadata.when.`,
    );
    assert(
      !Object.entries(metadata.unless ?? {}).every(([field, value]) => effectiveArguments[field] === value)
        || Object.keys(metadata.unless ?? {}).length === 0,
      `${fixture.name} confirmation fixture unexpectedly satisfied metadata.unless.`,
    );
    assert(
      effectiveArguments[metadata.field] !== metadata.requiredValue,
      `${fixture.name} missing-confirmation fixture unexpectedly carried the required confirmation.`,
    );
  }

  const projectText = projectState.result?.content?.[0]?.text ?? "";
  assert(projectText.includes("\"project\": \"武裝學院的二三事\""), "get_current_project_state returned unexpected content.");

  const validateText = validateJsonl.result?.content?.[0]?.text ?? "";
  assert(validateText.includes("Validated 1 files"), "validate_jsonl single-file call did not validate exactly one file.");
  assert(validateText.includes("0 errors"), "validate_jsonl reported errors.");

  const compressText = compressRules.result?.content?.[0]?.text ?? "";
  assert(compressText.includes("Dry run: yes"), "compress_error_rules did not default to dry-run.");
  assert(compressText.includes("No files written."), "compress_error_rules dry-run did not report no writes.");

  const activateText = activateEngine.result?.content?.[0]?.text ?? "";
  assert(activateText.includes("Dry run: yes"), "activate_engine_version did not default to dry-run.");
  assert(activateText.includes("Dry run complete. No files written."), "activate_engine_version dry-run did not report no writes.");

  const importText = importPolicy.result?.content?.[0]?.text ?? "";
  assert(importText.includes("Dry run: yes"), "import_policy_file did not default to dry-run.");
  assert(importText.includes("Dry run complete. No files written."), "import_policy_file dry-run did not report no writes.");

  const queryAuditText = queryAudit.result?.content?.[0]?.text ?? "";
  assert(queryAuditText.includes("\"matched_records\""), "query_mcp_audit did not return JSON summary.");
  assert(queryAuditText.includes("\"import_policy_file\""), "query_mcp_audit did not find import_policy_file audit records.");

  assert(!resourcesList.error, `resources/list failed: ${JSON.stringify(resourcesList.error)}`);
  const resourceUris = new Set((resourcesList.result?.resources ?? []).map((resource) => resource.uri));
  for (const expectedResource of expectedResources) {
    assert(resourceUris.has(expectedResource), `resources/list missing expected resource: ${expectedResource}`);
  }

  assert(!resourceRead.error, `resources/read failed: ${JSON.stringify(resourceRead.error)}`);
  const resourceText = resourceRead.result?.contents?.[0]?.text ?? "";
  assert(resourceText.includes("錯誤壓縮規則"), "resources/read did not return compressed_rules.md content.");

  assert(!promptsList.error, `prompts/list failed: ${JSON.stringify(promptsList.error)}`);
  const promptsByName = new Map(
    (promptsList.result?.prompts ?? []).map((prompt) => [prompt.name, prompt]),
  );
  const promptNames = new Set(promptsByName.keys());
  for (const expectedPrompt of expectedPrompts) {
    assert(promptNames.has(expectedPrompt), `prompts/list missing expected prompt: ${expectedPrompt}`);
  }

  for (const [index, fixture] of promptFixtures.entries()) {
    const publicPrompt = promptsByName.get(fixture.name);
    const declaredArguments = new Set(
      (publicPrompt?.arguments ?? []).map((argument) => argument.name),
    );
    for (const argumentName of Object.keys(fixture.arguments)) {
      assert(
        declaredArguments.has(argumentName),
        `prompts/list ${fixture.name} missing fixture argument: ${argumentName}`,
      );
    }

    const promptGet = promptGets[index];
    assert(
      !promptGet.error,
      `prompts/get ${fixture.name} failed: ${JSON.stringify(promptGet.error)}`,
    );
    const promptText = promptGet.result?.messages?.[0]?.content?.text ?? "";
    for (const fragment of fixture.expectedFragments) {
      assert(
        promptText.includes(fragment),
        `prompts/get ${fixture.name} missing expected fragment: ${fragment}`,
      );
    }
    assert(
      promptText.includes("## Runtime Arguments"),
      `prompts/get ${fixture.name} did not include runtime arguments.`,
    );
    assert(
      promptText.includes(JSON.stringify(fixture.arguments, null, 2)),
      `prompts/get ${fixture.name} did not preserve fixture arguments.`,
    );
  }

  for (const [index, fixture] of invalidPromptFixtures.entries()) {
    const promptGet = invalidPromptGets[index];
    assert(
      promptGet.error?.code === -32602,
      `prompts/get ${fixture.label} returned unexpected error: ${JSON.stringify(promptGet.error)}`,
    );
    assert(
      promptGet.error?.message === fixture.expectedMessage,
      `prompts/get ${fixture.label} returned unexpected message: ${promptGet.error?.message}`,
    );
  }
  assert(
    !postInvalidPing.error,
    `ping after invalid prompts/get requests failed: ${JSON.stringify(postInvalidPing.error)}`,
  );

  for (const [index, fixture] of invalidResourceFixtures.entries()) {
    const resourceReadError = invalidResourceReads[index];
    assert(
      resourceReadError.error?.code === -32602,
      `resources/read ${fixture.label} returned unexpected error: ${JSON.stringify(resourceReadError.error)}`,
    );
    assert(
      resourceReadError.error?.message === fixture.expectedMessage,
      `resources/read ${fixture.label} returned unexpected message: ${resourceReadError.error?.message}`,
    );
  }
  assert(
    !postInvalidResourcePing.error,
    `ping after invalid resources/read requests failed: ${JSON.stringify(postInvalidResourcePing.error)}`,
  );

  for (const [index, fixture] of invalidToolFixtures.entries()) {
    const toolCallError = invalidToolCalls[index];
    assert(
      toolCallError.error?.code === -32602,
      `tools/call ${fixture.label} returned unexpected error: ${JSON.stringify(toolCallError.error)}`,
    );
    assert(
      toolCallError.error?.message === fixture.expectedMessage,
      `tools/call ${fixture.label} returned unexpected message: ${toolCallError.error?.message}`,
    );
  }
  assert(
    !postInvalidToolPing.error,
    `ping after invalid tools/call requests failed: ${JSON.stringify(postInvalidToolPing.error)}`,
  );

  for (const [index, fixture] of toolLevelErrorFixtures.entries()) {
    const response = toolLevelErrorCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `tool-level ${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `tool-level ${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `tool-level ${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postToolLevelErrorPing.error,
    `ping after tool-level errors failed: ${JSON.stringify(postToolLevelErrorPing.error)}`,
  );

  for (const [index, fixture] of unknownArgumentFixtures.entries()) {
    const response = unknownArgumentCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} unknown argument unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} unknown argument did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.name} unknown argument returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postUnknownArgumentPing.error,
    `ping after unknown argument errors failed: ${JSON.stringify(postUnknownArgumentPing.error)}`,
  );

  for (const [index, fixture] of enumConstraintFixtures.entries()) {
    const response = enumConstraintCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postEnumConstraintPing.error,
    `ping after enum constraint errors failed: ${JSON.stringify(postEnumConstraintPing.error)}`,
  );

  for (const [index, fixture] of schemaTypeFixtures.entries()) {
    const response = schemaTypeCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postSchemaTypePing.error,
    `ping after schema type errors failed: ${JSON.stringify(postSchemaTypePing.error)}`,
  );

  for (const [index, fixture] of integerMaximumFixtures.entries()) {
    const response = integerMaximumCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postIntegerMaximumPing.error,
    `ping after integer maximum errors failed: ${JSON.stringify(postIntegerMaximumPing.error)}`,
  );

  for (const [index, fixture] of sizeConstraintFixtures.entries()) {
    const response = sizeConstraintCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postSizeConstraintPing.error,
    `ping after size constraint errors failed: ${JSON.stringify(postSizeConstraintPing.error)}`,
  );

  for (const [index, fixture] of stringArrayBlankFixtures.entries()) {
    const response = stringArrayBlankCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postStringArrayBlankPing.error,
    `ping after string-array blank errors failed: ${JSON.stringify(postStringArrayBlankPing.error)}`,
  );

  for (const [index, fixture] of requiredConstraintFixtures.entries()) {
    const response = requiredConstraintCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postRequiredConstraintPing.error,
    `ping after required constraint errors failed: ${JSON.stringify(postRequiredConstraintPing.error)}`,
  );

  for (const [index, fixture] of crossFieldConstraintFixtures.entries()) {
    const response = crossFieldConstraintCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postCrossFieldConstraintPing.error,
    `ping after cross-field constraint errors failed: ${JSON.stringify(postCrossFieldConstraintPing.error)}`,
  );

  for (const [index, fixture] of highRiskArgumentErrorFixtures.entries()) {
    const response = highRiskArgumentErrorCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      fixture.wrappedToolError
        ? errorText.includes(fixture.expectedMessage)
        : errorText === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postHighRiskArgumentErrorPing.error,
    `ping after high-risk argument errors failed: ${JSON.stringify(postHighRiskArgumentErrorPing.error)}`,
  );

  for (const [index, fixture] of optionalNullDefaultFixtures.entries()) {
    const response = optionalNullDefaultCalls[index];
    const outputText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} optional null fixture returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      Boolean(response.result?.isError) === Boolean(fixture.expectedError),
      `${fixture.name} optional null fixture returned unexpected isError: ${JSON.stringify(response.result)}`,
    );
    if (fixture.expectedError) {
      assert(
        outputText === fixture.expectedError,
        `${fixture.name} optional null fixture returned unexpected error: ${outputText}`,
      );
    }
    for (const fragment of fixture.expectedFragments ?? []) {
      assert(
        outputText.includes(fragment),
        `${fixture.name} optional null fixture output missed ${JSON.stringify(fragment)}.`,
      );
    }
  }
  assert(
    !postOptionalNullDefaultPing.error,
    `ping after optional null fixtures failed: ${JSON.stringify(postOptionalNullDefaultPing.error)}`,
  );

  for (const [index, fixture] of optionalBlankStringFixtures.entries()) {
    const response = optionalBlankStringCalls[index];
    const outputText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} optional blank fixture returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError !== true,
      `${fixture.name} optional blank fixture returned an error: ${outputText}`,
    );
    for (const fragment of fixture.expectedFragments ?? []) {
      assert(
        outputText.includes(fragment),
        `${fixture.name} optional blank fixture output missed ${JSON.stringify(fragment)}.`,
      );
    }
  }
  assert(
    !postOptionalBlankStringPing.error,
    `ping after optional blank fixtures failed: ${JSON.stringify(postOptionalBlankStringPing.error)}`,
  );

  for (const [index, fixture] of highRiskConfirmationFixtures.entries()) {
    const response = highRiskConfirmationCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} confirmation guard unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} confirmation guard did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.name} confirmation guard returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postHighRiskConfirmationPing.error,
    `ping after high-risk confirmation errors failed: ${JSON.stringify(postHighRiskConfirmationPing.error)}`,
  );

  for (const [index, fixture] of wrongConfirmationFixtures.entries()) {
    const response = wrongConfirmationCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} wrong confirmation unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} wrong confirmation did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.name} wrong confirmation returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postWrongConfirmationPing.error,
    `ping after wrong confirmation errors failed: ${JSON.stringify(postWrongConfirmationPing.error)}`,
  );

  for (const [index, fixture] of confirmedDryRunFixtures.entries()) {
    const response = confirmedDryRunCalls[index];
    const outputText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} confirmed dry-run returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError !== true,
      `${fixture.name} confirmed dry-run returned result.isError: ${JSON.stringify(response.result)}`,
    );
    for (const fragment of fixture.expectedFragments) {
      assert(
        outputText.includes(fragment),
        `${fixture.name} confirmed dry-run output missing ${JSON.stringify(fragment)}.`,
      );
    }
  }
  assert(
    !postConfirmedDryRunPing.error,
    `ping after confirmed dry-runs failed: ${JSON.stringify(postConfirmedDryRunPing.error)}`,
  );

  for (const [index, fixture] of confirmedNoOpFixtures.entries()) {
    const response = confirmedNoOpCalls[index];
    const outputText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} confirmed no-op returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError !== true,
      `${fixture.name} confirmed no-op returned result.isError: ${JSON.stringify(response.result)}`,
    );
    for (const fragment of fixture.expectedFragments) {
      assert(
        outputText.includes(fragment),
        `${fixture.name} confirmed no-op output missing ${JSON.stringify(fragment)}.`,
      );
    }
  }
  assert(
    !postConfirmedNoOpPing.error,
    `ping after confirmed no-ops failed: ${JSON.stringify(postConfirmedNoOpPing.error)}`,
  );

  for (const [index, fixture] of concurrencyFailureFixtures.entries()) {
    const response = concurrencyFailureCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} concurrency failure returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} concurrency failure did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText.includes(fixture.expectedMessageFragment),
      `${fixture.name} concurrency failure returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postConcurrencyFailurePing.error,
    `ping after concurrency failures failed: ${JSON.stringify(postConcurrencyFailurePing.error)}`,
  );

  for (const [index, fixture] of invalidJsonRpcFixtures.entries()) {
    const response = invalidJsonRpcResponses[index];
    assert(
      response.error?.code === fixture.expectedCode,
      `${fixture.label} returned unexpected error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.error?.message === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${response.error?.message}`,
    );
  }
  assert(
    parseErrorResponse.error?.code === -32700,
    `parse error returned unexpected error: ${JSON.stringify(parseErrorResponse.error)}`,
  );
  assert(
    parseErrorResponse.error?.message?.startsWith("Parse error:"),
    `parse error returned unexpected message: ${parseErrorResponse.error?.message}`,
  );
  assert(
    !postParseErrorPing.error,
    `ping after parse error failed: ${JSON.stringify(postParseErrorPing.error)}`,
  );
  assert(
    !headerPing.error && responseFramings.get(headerPing) === "header",
    `Content-Length ping did not return a header-framed response: ${JSON.stringify(headerPing)}`,
  );
  assert(
    !postHeaderLinePing.error && responseFramings.get(postHeaderLinePing) === "line",
    `newline ping after Content-Length request did not return a line-framed response: ${JSON.stringify(postHeaderLinePing)}`,
  );
  assert(
    !chunkedHeaderPing.error && responseFramings.get(chunkedHeaderPing) === "header",
    `chunked Content-Length ping did not return a header-framed response: ${JSON.stringify(chunkedHeaderPing)}`,
  );
  assert(
    !postChunkedLinePing.error && responseFramings.get(postChunkedLinePing) === "line",
    `newline ping after chunked Content-Length request did not return a line-framed response: ${JSON.stringify(postChunkedLinePing)}`,
  );
  for (const [index, response] of backToBackPings.entries()) {
    const requestId = firstBackToBackPingRequestId + index;
    assert(
      !response.error && responseFramings.get(response) === "header",
      `back-to-back Content-Length frame ${index + 1} did not return a header-framed response: ${JSON.stringify(response)}`,
    );
  }
  assert(
    !postBackToBackLinePing.error
      && responseFramings.get(postBackToBackLinePing) === "line",
    `newline ping after back-to-back frames did not return a line-framed response: ${JSON.stringify(postBackToBackLinePing)}`,
  );
  assert(
    !mixedBatchHeaderPing.error
      && responseFramings.get(mixedBatchHeaderPing) === "header",
    `mixed-batch Content-Length frame did not return a header-framed response: ${JSON.stringify(mixedBatchHeaderPing)}`,
  );
  assert(
    !mixedBatchLinePing.error
      && responseFramings.get(mixedBatchLinePing) === "line",
    `mixed-batch newline frame did not return a line-framed response: ${JSON.stringify(mixedBatchLinePing)}`,
  );
  assert(
    !postMixedBatchPing.error && responseFramings.get(postMixedBatchPing) === "line",
    `newline ping after mixed-batch frames failed: ${JSON.stringify(postMixedBatchPing)}`,
  );
  assert(
    !reverseMixedBatchLinePing.error
      && responseFramings.get(reverseMixedBatchLinePing) === "line",
    `reverse mixed-batch newline frame did not return a line-framed response: ${JSON.stringify(reverseMixedBatchLinePing)}`,
  );
  assert(
    !reverseMixedBatchHeaderPing.error
      && responseFramings.get(reverseMixedBatchHeaderPing) === "header",
    `reverse mixed-batch Content-Length frame did not return a header-framed response: ${JSON.stringify(reverseMixedBatchHeaderPing)}`,
  );
  assert(
    !postReverseMixedBatchPing.error
      && responseFramings.get(postReverseMixedBatchPing) === "line",
    `newline ping after reverse mixed-batch frames failed: ${JSON.stringify(postReverseMixedBatchPing)}`,
  );
  assert(
    malformedHeaderError.error?.code === -32700,
    `malformed Content-Length returned unexpected error: ${JSON.stringify(malformedHeaderError.error)}`,
  );
  assert(
    malformedHeaderError.error?.message === "Parse error: missing Content-Length",
    `malformed Content-Length returned unexpected message: ${malformedHeaderError.error?.message}`,
  );
  assert(
    responseFramings.get(malformedHeaderError) === "header",
    `malformed Content-Length error was not header-framed: ${JSON.stringify(malformedHeaderError)}`,
  );
  assert(
    !malformedHeaderRecoveryPing.error
      && responseFramings.get(malformedHeaderRecoveryPing) === "line",
    `newline recovery request after malformed Content-Length failed: ${JSON.stringify(malformedHeaderRecoveryPing)}`,
  );
  for (const [index, fixture] of invalidContentLengthHeaderFixtures.entries()) {
    const errorResponse = invalidContentLengthErrors[index];
    const recoveryResponse = invalidContentLengthRecoveryPings[index];
    assert(
      errorResponse.error?.code === -32700,
      `${fixture.label} returned unexpected error: ${JSON.stringify(errorResponse.error)}`,
    );
    assert(
      errorResponse.error?.message === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${errorResponse.error?.message}`,
    );
    assert(
      responseFramings.get(errorResponse) === "header",
      `${fixture.label} error was not header-framed: ${JSON.stringify(errorResponse)}`,
    );
    assert(
      !recoveryResponse.error && responseFramings.get(recoveryResponse) === "line",
      `${fixture.label} recovery ping failed: ${JSON.stringify(recoveryResponse)}`,
    );
  }
  assert(
    malformedBodyError.error?.code === -32700,
    `malformed header body returned unexpected error: ${JSON.stringify(malformedBodyError.error)}`,
  );
  assert(
    malformedBodyError.error?.message?.startsWith("Parse error:"),
    `malformed header body returned unexpected message: ${malformedBodyError.error?.message}`,
  );
  assert(
    responseFramings.get(malformedBodyError) === "header",
    `malformed header body error was not header-framed: ${JSON.stringify(malformedBodyError)}`,
  );
  assert(
    !malformedBodyRecoveryPing.error
      && responseFramings.get(malformedBodyRecoveryPing) === "line",
    `newline recovery request after malformed header body failed: ${JSON.stringify(malformedBodyRecoveryPing)}`,
  );
  const expectedMessageTooLargeError = (
    `Parse error: JSON-RPC message exceeds ${expectedMaxJsonRpcMessageBytes} bytes.`
  );
  assert(
    oversizedHeaderBodyError.error?.code === -32700,
    `oversized Content-Length body returned unexpected error: ${JSON.stringify(oversizedHeaderBodyError.error)}`,
  );
  assert(
    oversizedHeaderBodyError.error?.message === expectedMessageTooLargeError,
    `oversized Content-Length body returned unexpected message: ${oversizedHeaderBodyError.error?.message}`,
  );
  assert(
    responseFramings.get(oversizedHeaderBodyError) === "header",
    `oversized Content-Length body error was not header-framed: ${JSON.stringify(oversizedHeaderBodyError)}`,
  );
  assert(
    !oversizedHeaderBodyRecoveryPing.error
      && responseFramings.get(oversizedHeaderBodyRecoveryPing) === "line",
    `newline recovery after oversized Content-Length body failed: ${JSON.stringify(oversizedHeaderBodyRecoveryPing)}`,
  );
  assert(
    oversizedLineError.error?.code === -32700,
    `oversized newline body returned unexpected error: ${JSON.stringify(oversizedLineError.error)}`,
  );
  assert(
    oversizedLineError.error?.message === expectedMessageTooLargeError,
    `oversized newline body returned unexpected message: ${oversizedLineError.error?.message}`,
  );
  assert(
    responseFramings.get(oversizedLineError) === "line",
    `oversized newline body error was not line-framed: ${JSON.stringify(oversizedLineError)}`,
  );
  assert(
    !oversizedLineRecoveryPing.error
      && responseFramings.get(oversizedLineRecoveryPing) === "line",
    `newline recovery after oversized newline body failed: ${JSON.stringify(oversizedLineRecoveryPing)}`,
  );
  assert(
    oversizedHeaderError.error?.code === -32700,
    `oversized Content-Length header returned unexpected error: ${JSON.stringify(oversizedHeaderError.error)}`,
  );
  assert(
    oversizedHeaderError.error?.message
      === `Parse error: Content-Length header exceeds ${expectedMaxContentLengthHeaderBytes} bytes.`,
    `oversized Content-Length header returned unexpected message: ${oversizedHeaderError.error?.message}`,
  );
  assert(
    responseFramings.get(oversizedHeaderError) === "header",
    `oversized Content-Length header error was not header-framed: ${JSON.stringify(oversizedHeaderError)}`,
  );
  assert(
    !oversizedHeaderRecoveryPing.error
      && responseFramings.get(oversizedHeaderRecoveryPing) === "line",
    `newline recovery after oversized Content-Length header failed: ${JSON.stringify(oversizedHeaderRecoveryPing)}`,
  );
  assert(
    oversizedHeaderBodyWriteResult.streamed_bytes === expectedMaxJsonRpcMessageBytes + 1
      && oversizedLineWriteResult.streamed_bytes === expectedMaxJsonRpcMessageBytes + 1
      && oversizedHeaderWriteResult.streamed_bytes
        === expectedMaxContentLengthHeaderBytes + 1,
    "Transport limit fixtures did not cross the configured byte thresholds exactly once.",
  );

  const after = await snapshotWatchedFiles();
  for (const [filePath, beforeHash] of before.entries()) {
    const afterHash = after.get(filePath);
    assert(afterHash === beforeHash, `${filePath} hash changed: ${beforeHash} -> ${afterHash}`);
  }

  const protectedRuntimeAfter = await snapshotProtectedRuntimePaths();
  assert(
    JSON.stringify(protectedRuntimeAfter) === JSON.stringify(protectedRuntimeBefore),
    `Protected runtime paths changed: ${JSON.stringify({
      before: protectedRuntimeBefore,
      after: protectedRuntimeAfter,
    })}`,
  );

  for (const filePath of forbiddenCreatedPaths) {
    assert(!(await pathExists(filePath)), `${normalizePath(filePath)} was unexpectedly created.`);
  }

  const auditRecordsAfter = await readJsonlRecords(auditLogPath);
  const auditCountAfter = auditRecordsAfter.length;
  const auditRecordsAdded = auditCountAfter - auditCountBefore;
  assert(
    auditRecordsAdded === expectedAuditRecordsAdded,
    `Expected exactly ${expectedAuditRecordsAdded} new MCP audit records, got ${auditRecordsAdded}.`,
  );

  const newAuditRecords = auditRecordsAfter.slice(auditCountBefore);
  const initialDefaultAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-client",
  );
  const expectedInitialDefaults = new Map([
    ["compress_error_rules", {
      top: 24,
      minCount: 1,
      includeArchived: false,
      writeCandidate: false,
      updateActive: false,
      allowEmpty: false,
      dryRun: true,
    }],
    ["activate_engine_version", { dryRun: true }],
    ["import_policy_file", {
      force: false,
      dryRun: true,
    }],
  ]);
  assert(
    initialDefaultAudits.length === expectedInitialDefaults.size,
    `Expected ${expectedInitialDefaults.size} initial default audits, got ${initialDefaultAudits.length}.`,
  );
  for (const record of initialDefaultAudits) {
    const expectedDefaults = expectedInitialDefaults.get(record.tool_name);
    assert(expectedDefaults, `Unexpected initial default audit tool: ${record.tool_name}`);
    expectedInitialDefaults.delete(record.tool_name);
    assert(record.status === "completed", `${record.tool_name} default audit status was ${record.status}.`);
    for (const [field, value] of Object.entries(expectedDefaults)) {
      assert(
        record.input_summary?.[field] === value,
        `${record.tool_name} audit default ${field} was ${record.input_summary?.[field]}, expected ${value}.`,
      );
    }
  }
  assert(
    expectedInitialDefaults.size === 0,
    `Missing initial default audits: ${[...expectedInitialDefaults.keys()].join(", ")}`,
  );

  const optionalNullAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-optional-null",
  );
  const auditedOptionalNullFixtures = optionalNullDefaultFixtures.filter(
    (fixture) => !readOnlyTools.has(fixture.name),
  );
  const optionalNullFixturesByTool = new Map(
    auditedOptionalNullFixtures.map((fixture) => [fixture.name, fixture]),
  );
  assert(
    optionalNullAudits.length === auditedOptionalNullFixtures.length,
    `Expected ${auditedOptionalNullFixtures.length} optional null audits, got ${optionalNullAudits.length}.`,
  );
  for (const record of optionalNullAudits) {
    const fixture = optionalNullFixturesByTool.get(record.tool_name);
    assert(fixture, `Unexpected optional null audit tool: ${record.tool_name}`);
    optionalNullFixturesByTool.delete(record.tool_name);
    const expectedStatus = fixture.expectedError ? "tool_error" : "completed";
    assert(
      record.status === expectedStatus,
      `${record.tool_name} optional null audit status was ${record.status}, expected ${expectedStatus}.`,
    );
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} optional null fixture affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(
      record.result?.is_error === Boolean(fixture.expectedError),
      `${record.tool_name} optional null audit recorded unexpected is_error.`,
    );
    for (const [field, value] of Object.entries(fixture.expectedAppliedDefaults ?? {})) {
      assert(
        record.input_summary?.[field] === value,
        `${record.tool_name} null default ${field} was ${record.input_summary?.[field]}, expected ${value}.`,
      );
    }
    for (const field of fixture.expectedPreservedNulls ?? []) {
      assert(
        Object.hasOwn(record.input_summary ?? {}, field)
          && record.input_summary[field] === null,
        `${record.tool_name} did not preserve ${field}=null in the effective audit arguments.`,
      );
    }
  }
  assert(
    optionalNullFixturesByTool.size === 0,
    `Missing optional null audits: ${[...optionalNullFixturesByTool.keys()].join(", ")}`,
  );

  const optionalBlankAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-optional-blank",
  );
  const optionalBlankFixturesByTool = new Map(
    optionalBlankStringFixtures.map((fixture) => [fixture.name, fixture]),
  );
  assert(
    optionalBlankAudits.length === optionalBlankStringFixtures.length,
    `Expected ${optionalBlankStringFixtures.length} optional blank audits, got ${optionalBlankAudits.length}.`,
  );
  for (const record of optionalBlankAudits) {
    const fixture = optionalBlankFixturesByTool.get(record.tool_name);
    assert(fixture, `Unexpected optional blank audit tool: ${record.tool_name}`);
    optionalBlankFixturesByTool.delete(record.tool_name);
    assert(record.status === "completed", `${record.tool_name} optional blank audit status was ${record.status}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} optional blank fixture affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === false, `${record.tool_name} optional blank audit recorded an error.`);
    for (const [field, value] of Object.entries(fixture.expectedAppliedDefaults ?? {})) {
      assertAuditSummaryValue(record, field, value, record.tool_name);
    }
    for (const field of fixture.expectedOmittedFields ?? []) {
      assert(
        !Object.hasOwn(record.input_summary ?? {}, field),
        `${record.tool_name} did not omit blank field ${field} from effective audit arguments.`,
      );
    }
  }
  assert(
    optionalBlankFixturesByTool.size === 0,
    `Missing optional blank audits: ${[...optionalBlankFixturesByTool.keys()].join(", ")}`,
  );

  const unknownArgumentAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-unknown-argument",
  );
  const expectedAuditedUnknownArgumentTools = new Set(
    unknownArgumentFixtures
      .filter((fixture) => !readOnlyTools.has(fixture.name))
      .map((fixture) => fixture.name),
  );
  assert(
    unknownArgumentAudits.length === expectedAuditedUnknownArgumentTools.size,
    `Expected ${expectedAuditedUnknownArgumentTools.size} unknown argument audits, got ${unknownArgumentAudits.length}.`,
  );
  for (const record of unknownArgumentAudits) {
    assert(
      expectedAuditedUnknownArgumentTools.delete(record.tool_name),
      `Unexpected or duplicate unknown argument audit tool: ${record.tool_name}`,
    );
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk !== "read", `${record.tool_name} unexpectedly audited as read.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    expectedAuditedUnknownArgumentTools.size === 0,
    `Missing unknown argument audits: ${[...expectedAuditedUnknownArgumentTools].join(", ")}`,
  );

  const enumConstraintAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-enum-constraint",
  );
  const expectedEnumConstraintCounts = new Map();
  for (const fixture of enumConstraintFixtures.filter(
    (item) => !readOnlyTools.has(item.name),
  )) {
    expectedEnumConstraintCounts.set(
      fixture.name,
      (expectedEnumConstraintCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  const expectedEnumConstraintAuditCount = [...expectedEnumConstraintCounts.values()]
    .reduce((sum, count) => sum + count, 0);
  assert(
    enumConstraintAudits.length === expectedEnumConstraintAuditCount,
    `Expected ${expectedEnumConstraintAuditCount} enum constraint audits, got ${enumConstraintAudits.length}.`,
  );
  for (const record of enumConstraintAudits) {
    const remaining = expectedEnumConstraintCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected enum constraint audit tool: ${record.tool_name}`);
    expectedEnumConstraintCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk !== "read", `${record.tool_name} unexpectedly audited as read.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedEnumConstraintCounts.values()].every((count) => count === 0),
    `Missing enum constraint audits: ${JSON.stringify(Object.fromEntries(expectedEnumConstraintCounts))}`,
  );

  const schemaTypeAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-schema-type",
  );
  const expectedSchemaTypeCounts = new Map();
  for (const fixture of schemaTypeFixtures.filter(
    (item) => !readOnlyTools.has(item.name),
  )) {
    expectedSchemaTypeCounts.set(
      fixture.name,
      (expectedSchemaTypeCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  const expectedSchemaTypeAuditCount = [...expectedSchemaTypeCounts.values()]
    .reduce((sum, count) => sum + count, 0);
  assert(
    schemaTypeAudits.length === expectedSchemaTypeAuditCount,
    `Expected ${expectedSchemaTypeAuditCount} schema type audits, got ${schemaTypeAudits.length}.`,
  );
  for (const record of schemaTypeAudits) {
    const remaining = expectedSchemaTypeCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected schema type audit tool: ${record.tool_name}`);
    expectedSchemaTypeCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk !== "read", `${record.tool_name} unexpectedly audited as read.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedSchemaTypeCounts.values()].every((count) => count === 0),
    `Missing schema type audits: ${JSON.stringify(Object.fromEntries(expectedSchemaTypeCounts))}`,
  );

  const integerMaximumAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-integer-maximum",
  );
  const auditedIntegerMaximumFixtures = integerMaximumFixtures.filter(
    (fixture) => !readOnlyTools.has(fixture.name),
  );
  assert(
    integerMaximumAudits.length === auditedIntegerMaximumFixtures.length,
    `Expected ${auditedIntegerMaximumFixtures.length} integer maximum audits, got ${integerMaximumAudits.length}.`,
  );
  const expectedIntegerMaximumCounts = new Map();
  for (const fixture of auditedIntegerMaximumFixtures) {
    expectedIntegerMaximumCounts.set(
      fixture.name,
      (expectedIntegerMaximumCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  for (const record of integerMaximumAudits) {
    const remaining = expectedIntegerMaximumCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected integer maximum audit tool: ${record.tool_name}`);
    expectedIntegerMaximumCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedIntegerMaximumCounts.values()].every((count) => count === 0),
    `Missing integer maximum audits: ${JSON.stringify(Object.fromEntries(expectedIntegerMaximumCounts))}`,
  );

  const sizeConstraintAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-size-constraint",
  );
  const auditedSizeConstraintFixtures = sizeConstraintFixtures.filter(
    (fixture) => !readOnlyTools.has(fixture.name),
  );
  assert(
    sizeConstraintAudits.length === auditedSizeConstraintFixtures.length,
    `Expected ${auditedSizeConstraintFixtures.length} size constraint audits, got ${sizeConstraintAudits.length}.`,
  );
  const expectedSizeConstraintCounts = new Map();
  for (const fixture of auditedSizeConstraintFixtures) {
    expectedSizeConstraintCounts.set(
      fixture.name,
      (expectedSizeConstraintCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  for (const record of sizeConstraintAudits) {
    const remaining = expectedSizeConstraintCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected size constraint audit tool: ${record.tool_name}`);
    expectedSizeConstraintCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedSizeConstraintCounts.values()].every((count) => count === 0),
    `Missing size constraint audits: ${JSON.stringify(Object.fromEntries(expectedSizeConstraintCounts))}`,
  );

  const stringArrayBlankAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-string-array-blank",
  );
  const auditedStringArrayBlankFixtures = stringArrayBlankFixtures.filter(
    (fixture) => !readOnlyTools.has(fixture.name),
  );
  assert(
    stringArrayBlankAudits.length === auditedStringArrayBlankFixtures.length,
    `Expected ${auditedStringArrayBlankFixtures.length} string-array blank audits, got ${stringArrayBlankAudits.length}.`,
  );
  const expectedStringArrayBlankCounts = new Map();
  for (const fixture of auditedStringArrayBlankFixtures) {
    expectedStringArrayBlankCounts.set(
      fixture.name,
      (expectedStringArrayBlankCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  for (const record of stringArrayBlankAudits) {
    const remaining = expectedStringArrayBlankCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected string-array blank audit tool: ${record.tool_name}`);
    expectedStringArrayBlankCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedStringArrayBlankCounts.values()].every((count) => count === 0),
    `Missing string-array blank audits: ${JSON.stringify(Object.fromEntries(expectedStringArrayBlankCounts))}`,
  );

  const requiredConstraintAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-required-constraint",
  );
  const expectedRequiredConstraintCounts = new Map();
  for (const fixture of requiredConstraintFixtures.filter(
    (item) => !readOnlyTools.has(item.name),
  )) {
    expectedRequiredConstraintCounts.set(
      fixture.name,
      (expectedRequiredConstraintCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  const expectedRequiredConstraintAuditCount = [...expectedRequiredConstraintCounts.values()]
    .reduce((sum, count) => sum + count, 0);
  assert(
    requiredConstraintAudits.length === expectedRequiredConstraintAuditCount,
    `Expected ${expectedRequiredConstraintAuditCount} required constraint audits, got ${requiredConstraintAudits.length}.`,
  );
  for (const record of requiredConstraintAudits) {
    const remaining = expectedRequiredConstraintCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected required constraint audit tool: ${record.tool_name}`);
    expectedRequiredConstraintCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk !== "read", `${record.tool_name} unexpectedly audited as read.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedRequiredConstraintCounts.values()].every((count) => count === 0),
    `Missing required constraint audits: ${JSON.stringify(Object.fromEntries(expectedRequiredConstraintCounts))}`,
  );

  const crossFieldConstraintAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-cross-field-constraint",
  );
  assert(
    crossFieldConstraintAudits.length === crossFieldConstraintFixtures.length,
    `Expected ${crossFieldConstraintFixtures.length} cross-field constraint audits, got ${crossFieldConstraintAudits.length}.`,
  );
  const expectedCrossFieldConstraintCounts = new Map();
  for (const fixture of crossFieldConstraintFixtures) {
    expectedCrossFieldConstraintCounts.set(
      fixture.name,
      (expectedCrossFieldConstraintCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  for (const record of crossFieldConstraintAudits) {
    const remaining = expectedCrossFieldConstraintCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected cross-field constraint audit tool: ${record.tool_name}`);
    expectedCrossFieldConstraintCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedCrossFieldConstraintCounts.values()].every((count) => count === 0),
    `Missing cross-field constraint audits: ${JSON.stringify(Object.fromEntries(expectedCrossFieldConstraintCounts))}`,
  );

  const highRiskArgumentErrorAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-high-risk-arguments",
  );
  assert(
    highRiskArgumentErrorAudits.length === highRiskArgumentErrorFixtures.length,
    `Expected ${highRiskArgumentErrorFixtures.length} high-risk argument error audits, got ${highRiskArgumentErrorAudits.length}.`,
  );
  const expectedHighRiskArgumentCounts = new Map();
  for (const fixture of highRiskArgumentErrorFixtures) {
    expectedHighRiskArgumentCounts.set(
      fixture.name,
      (expectedHighRiskArgumentCounts.get(fixture.name) ?? 0) + 1,
    );
  }
  for (const record of highRiskArgumentErrorAudits) {
    const remaining = expectedHighRiskArgumentCounts.get(record.tool_name) ?? 0;
    assert(remaining > 0, `Unexpected high-risk argument audit tool: ${record.tool_name}`);
    expectedHighRiskArgumentCounts.set(record.tool_name, remaining - 1);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    [...expectedHighRiskArgumentCounts.values()].every((count) => count === 0),
    `Missing high-risk argument audits: ${JSON.stringify(Object.fromEntries(expectedHighRiskArgumentCounts))}`,
  );

  const confirmationAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-confirmation",
  );
  assert(
    confirmationAudits.length === highRiskConfirmationFixtures.length,
    `Expected ${highRiskConfirmationFixtures.length} confirmation guard audits, got ${confirmationAudits.length}.`,
  );
  const expectedConfirmationTools = new Set(
    highRiskConfirmationFixtures.map((fixture) => fixture.name),
  );
  const confirmationFixturesByTool = new Map(
    highRiskConfirmationFixtures.map((fixture) => [fixture.name, fixture]),
  );
  for (const record of confirmationAudits) {
    const fixture = confirmationFixturesByTool.get(record.tool_name);
    assert(
      expectedConfirmationTools.delete(record.tool_name),
      `Unexpected or duplicate confirmation guard audit tool: ${record.tool_name}`,
    );
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
    for (const [field, value] of Object.entries(fixture?.expectedAppliedDefaults ?? {})) {
      assert(
        record.input_summary?.[field] === value,
        `${record.tool_name} audit default ${field} was ${record.input_summary?.[field]}, expected ${value}.`,
      );
    }
  }
  assert(
    expectedConfirmationTools.size === 0,
    `Missing confirmation guard audits: ${[...expectedConfirmationTools].join(", ")}`,
  );

  const wrongConfirmationAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-wrong-confirmation",
  );
  assert(
    wrongConfirmationAudits.length === wrongConfirmationFixtures.length,
    `Expected ${wrongConfirmationFixtures.length} wrong-confirmation audits, got ${wrongConfirmationAudits.length}.`,
  );
  const expectedWrongConfirmationTools = new Map(
    wrongConfirmationFixtures.map((fixture) => [fixture.name, fixture.token]),
  );
  for (const record of wrongConfirmationAudits) {
    const expectedToken = expectedWrongConfirmationTools.get(record.tool_name);
    assert(expectedToken, `Unexpected wrong-confirmation audit tool: ${record.tool_name}`);
    expectedWrongConfirmationTools.delete(record.tool_name);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(
      record.confirmation_id === expectedToken,
      `${record.tool_name} audit confirmation was ${record.confirmation_id}, expected ${expectedToken}.`,
    );
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    expectedWrongConfirmationTools.size === 0,
    `Missing wrong-confirmation audits: ${[...expectedWrongConfirmationTools.keys()].join(", ")}`,
  );

  const confirmedDryRunAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-confirmed-dry-run",
  );
  assert(
    confirmedDryRunAudits.length === confirmedDryRunFixtures.length,
    `Expected ${confirmedDryRunFixtures.length} confirmed dry-run audits, got ${confirmedDryRunAudits.length}.`,
  );
  const expectedConfirmedDryRunTools = new Map(
    confirmedDryRunFixtures.map((fixture) => [fixture.name, fixture.token]),
  );
  for (const record of confirmedDryRunAudits) {
    const expectedToken = expectedConfirmedDryRunTools.get(record.tool_name);
    assert(expectedToken, `Unexpected confirmed dry-run audit tool: ${record.tool_name}`);
    expectedConfirmedDryRunTools.delete(record.tool_name);
    assert(record.status === "completed", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(
      record.confirmation_id === expectedToken,
      `${record.tool_name} audit confirmation was ${record.confirmation_id}, expected ${expectedToken}.`,
    );
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === false, `${record.tool_name} audit did not record is_error=false.`);
  }
  assert(
    expectedConfirmedDryRunTools.size === 0,
    `Missing confirmed dry-run audits: ${[...expectedConfirmedDryRunTools.keys()].join(", ")}`,
  );

  const confirmedNoOpAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-confirmed-no-op",
  );
  assert(
    confirmedNoOpAudits.length === confirmedNoOpFixtures.length,
    `Expected ${confirmedNoOpFixtures.length} confirmed no-op audits, got ${confirmedNoOpAudits.length}.`,
  );
  const expectedConfirmedNoOpTools = new Map(
    confirmedNoOpFixtures.map((fixture) => [fixture.name, fixture.token]),
  );
  for (const record of confirmedNoOpAudits) {
    const expectedToken = expectedConfirmedNoOpTools.get(record.tool_name);
    assert(expectedToken, `Unexpected confirmed no-op audit tool: ${record.tool_name}`);
    expectedConfirmedNoOpTools.delete(record.tool_name);
    assert(record.status === "completed", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(
      record.confirmation_id === expectedToken,
      `${record.tool_name} audit confirmation was ${record.confirmation_id}, expected ${expectedToken}.`,
    );
    assert(
      record.input_summary?.dryRun === false,
      `${record.tool_name} audit did not preserve dryRun=false.`,
    );
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === false, `${record.tool_name} audit did not record is_error=false.`);
  }
  assert(
    expectedConfirmedNoOpTools.size === 0,
    `Missing confirmed no-op audits: ${[...expectedConfirmedNoOpTools.keys()].join(", ")}`,
  );

  const concurrencyFailureAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-concurrency-failure",
  );
  assert(
    concurrencyFailureAudits.length === concurrencyFailureFixtures.length,
    `Expected ${concurrencyFailureFixtures.length} concurrency failure audits, got ${concurrencyFailureAudits.length}.`,
  );
  const expectedConcurrencyFailureTools = new Map(
    concurrencyFailureFixtures.map((fixture) => [fixture.name, fixture.token]),
  );
  for (const record of concurrencyFailureAudits) {
    const expectedToken = expectedConcurrencyFailureTools.get(record.tool_name);
    assert(expectedToken, `Unexpected concurrency failure audit tool: ${record.tool_name}`);
    expectedConcurrencyFailureTools.delete(record.tool_name);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(
      record.confirmation_id === expectedToken,
      `${record.tool_name} audit confirmation was ${record.confirmation_id}, expected ${expectedToken}.`,
    );
    assert(
      record.input_summary?.dryRun === false,
      `${record.tool_name} audit did not preserve dryRun=false.`,
    );
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    expectedConcurrencyFailureTools.size === 0,
    `Missing concurrency failure audits: ${[...expectedConcurrencyFailureTools.keys()].join(", ")}`,
  );

  if (stderrBuffer.trim()) {
    console.log("[stderr]");
    console.log(stderrBuffer.trimEnd());
  }

  return {
    tool_scripts_syntax_checked: checkedToolScripts.length,
    tools: toolNames.size,
    checked_tools: expectedTools.length,
    permission_metadata_tools: permissionMetadataCount,
    schema_metadata_tools: publicToolMap.size,
    schema_metadata_properties: schemaPropertyCount,
    schema_metadata_enum_fields: enumMetadataKeys.size,
    schema_metadata_required_fields: requiredMetadataKeys.size,
    schema_metadata_defaults: defaultMetadataCount,
    schema_metadata_string_max_lengths: stringMaxLengthMetadataCount,
    schema_metadata_array_max_items: arrayMaxItemsMetadataCount,
    schema_metadata_array_item_max_lengths: arrayItemMaxLengthMetadataCount,
    schema_metadata_integer_maximums: integerMaximumMetadataKeys.size,
    schema_metadata_null_normalization: nullNormalizationMetadataCount,
    schema_metadata_empty_string_normalization: emptyStringNormalizationMetadataCount,
    schema_metadata_string_array_normalization: stringArrayNormalizationMetadataCount,
    schema_metadata_cross_field_constraints: crossFieldMetadataCount,
    schema_metadata_confirmations: confirmationMetadataCount,
    default_application_audits: initialDefaultAudits.length
      + highRiskConfirmationFixtures.filter((fixture) => fixture.expectedAppliedDefaults).length,
    optional_null_fixtures: optionalNullDefaultFixtures.length,
    optional_null_audits: optionalNullAudits.length,
    optional_blank_fixtures: optionalBlankStringFixtures.length,
    optional_blank_audits: optionalBlankAudits.length,
    invalid_tool_fixtures: invalidToolFixtures.length,
    tool_level_error_fixtures: toolLevelErrorFixtures.length,
    unknown_argument_fixtures: unknownArgumentFixtures.length,
    unknown_argument_audits: unknownArgumentAudits.length,
    enum_constraint_fixtures: enumConstraintFixtures.length,
    enum_constraint_audits: enumConstraintAudits.length,
    schema_type_fixtures: schemaTypeFixtures.length,
    schema_type_audits: schemaTypeAudits.length,
    integer_maximum_fixtures: integerMaximumFixtures.length,
    integer_maximum_audits: integerMaximumAudits.length,
    size_constraint_fixtures: sizeConstraintFixtures.length,
    size_constraint_audits: sizeConstraintAudits.length,
    string_array_blank_fixtures: stringArrayBlankFixtures.length,
    string_array_blank_audits: stringArrayBlankAudits.length,
    required_constraint_fixtures: requiredConstraintFixtures.length,
    required_constraint_audits: requiredConstraintAudits.length,
    cross_field_constraint_fixtures: crossFieldConstraintFixtures.length,
    cross_field_constraint_audits: crossFieldConstraintAudits.length,
    high_risk_argument_error_fixtures: highRiskArgumentErrorFixtures.length,
    high_risk_argument_error_audits: highRiskArgumentErrorAudits.length,
    high_risk_confirmation_fixtures: highRiskConfirmationFixtures.length,
    confirmation_guard_audits: confirmationAudits.length,
    wrong_confirmation_fixtures: wrongConfirmationFixtures.length,
    wrong_confirmation_audits: wrongConfirmationAudits.length,
    confirmed_dry_run_fixtures: confirmedDryRunFixtures.length,
    confirmed_dry_run_audits: confirmedDryRunAudits.length,
    confirmed_no_op_fixtures: confirmedNoOpFixtures.length,
    confirmed_no_op_audits: confirmedNoOpAudits.length,
    concurrency_failure_fixtures: concurrencyFailureFixtures.length,
    concurrency_failure_audits: concurrencyFailureAudits.length,
    resources: resourceUris.size,
    checked_resources: expectedResources.length,
    invalid_resource_fixtures: invalidResourceFixtures.length,
    prompts: promptNames.size,
    checked_prompts: expectedPrompts.length,
    prompt_fixtures: promptFixtures.length,
    invalid_prompt_fixtures: invalidPromptFixtures.length,
    invalid_json_rpc_fixtures: invalidJsonRpcFixtures.length + 1,
    framing_fixtures: 2,
    chunked_framing_fixtures: 1,
    chunked_header_writes: chunkedHeaderWriteCount,
    back_to_back_framing_fixtures: backToBackWriteResult.frames,
    back_to_back_header_writes: backToBackWriteResult.writes,
    mixed_batch_framing_fixtures: mixedBatchWriteResult.frames,
    mixed_batch_writes: mixedBatchWriteResult.writes,
    reverse_mixed_batch_framing_fixtures: reverseMixedBatchWriteResult.frames,
    reverse_mixed_batch_writes: reverseMixedBatchWriteResult.writes,
    malformed_header_errors: malformedHeaderWriteResult.errors,
    malformed_header_recovery_frames: malformedHeaderWriteResult.recovery_frames,
    malformed_header_writes: malformedHeaderWriteResult.writes,
    invalid_content_length_fixtures: invalidContentLengthHeaderFixtures.length,
    invalid_content_length_errors: invalidContentLengthWriteResults
      .reduce((sum, result) => sum + result.errors, 0),
    invalid_content_length_recovery_frames: invalidContentLengthWriteResults
      .reduce((sum, result) => sum + result.recovery_frames, 0),
    invalid_content_length_writes: invalidContentLengthWriteResults
      .reduce((sum, result) => sum + result.writes, 0),
    malformed_body_errors: malformedBodyWriteResult.errors,
    malformed_body_recovery_frames: malformedBodyWriteResult.recovery_frames,
    malformed_body_writes: malformedBodyWriteResult.writes,
    transport_message_limit_bytes: expectedMaxJsonRpcMessageBytes,
    transport_header_limit_bytes: expectedMaxContentLengthHeaderBytes,
    oversized_message_errors: (
      oversizedHeaderBodyWriteResult.errors + oversizedLineWriteResult.errors
    ),
    oversized_message_recovery_frames: (
      oversizedHeaderBodyWriteResult.recovery_frames
      + oversizedLineWriteResult.recovery_frames
    ),
    oversized_message_writes: (
      oversizedHeaderBodyWriteResult.writes + oversizedLineWriteResult.writes
    ),
    oversized_header_errors: oversizedHeaderWriteResult.errors,
    oversized_header_recovery_frames: oversizedHeaderWriteResult.recovery_frames,
    oversized_header_writes: oversizedHeaderWriteResult.writes,
    eof_truncation_fixtures: eofTruncationFixtures.length,
    eof_truncation_header_errors: eofTruncationResults
      .filter((result) => result.framing === "header").length,
    eof_truncation_line_errors: eofTruncationResults
      .filter((result) => result.framing === "line").length,
    eof_truncation_writes: eofTruncationResults
      .reduce((sum, result) => sum + result.writes, 0),
    dispatch_queue_limit: dispatchQueueResult.limit,
    dispatch_queue_accepted_requests: dispatchQueueResult.accepted_requests,
    dispatch_queue_rejected_requests: dispatchQueueResult.rejected_requests,
    dispatch_queue_dropped_notifications: dispatchQueueResult.dropped_notifications,
    dispatch_queue_recovery_requests: dispatchQueueResult.recovery_requests,
    dispatch_queue_writes: dispatchQueueResult.writes,
    stdout_response_queue_limit: stdoutBackpressureResult.queue_limit,
    stdout_response_resume_low_water_mark: (
      stdoutBackpressureResult.resume_low_water_mark
    ),
    stdout_backpressure_parse_errors: stdoutBackpressureResult.parse_errors,
    stdout_backpressure_recovery_requests: stdoutBackpressureResult.recovery_requests,
    stdout_backpressure_delayed_read_ms: stdoutBackpressureResult.delayed_read_ms,
    stdout_backpressure_writes: stdoutBackpressureResult.writes,
    backpressure_eof_complete_parse_errors: (
      backpressureEofResults.complete.parse_errors
    ),
    backpressure_eof_complete_recovery_requests: (
      backpressureEofResults.complete.recovery_requests
    ),
    backpressure_eof_false_truncation_errors: backpressureEofResults.complete.eof_errors,
    backpressure_eof_truncated_parse_errors: (
      backpressureEofResults.truncated.parse_errors
    ),
    backpressure_eof_truncation_errors: backpressureEofResults.truncated.eof_errors,
    backpressure_eof_delayed_read_ms: backpressureEofResults.complete.delayed_read_ms,
    backpressure_eof_writes: (
      backpressureEofResults.complete.writes
      + backpressureEofResults.truncated.writes
    ),
    watched_files: [...before.keys()],
    protected_runtime_paths: protectedRuntimePaths.map(normalizePath),
    forbidden_paths: forbiddenCreatedPaths.map(normalizePath),
    audit_records_added: auditRecordsAdded,
    audit_log: normalizePath(auditLogPath),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const auditSnapshot = await snapshotFile(auditLogPath);
  const transactionSnapshot = await snapshotDirectoryEntries(transactionRuntimePath);
  const auditIntentSnapshot = await snapshotDirectoryEntries(auditIntentRuntimePath);
  let result;
  try {
    result = await runSmokeTest(options);
  } finally {
    await restoreFileSnapshot(auditLogPath, auditSnapshot);
    await restoreDirectoryEntries(transactionRuntimePath, transactionSnapshot);
    await restoreDirectoryEntries(auditIntentRuntimePath, auditIntentSnapshot);
  }
  console.log("MCP smoke test passed.");
  console.log(`- Tool scripts syntax checked: ${result.tool_scripts_syntax_checked}`);
  console.log(`- Tools exposed: ${result.tools}`);
  console.log(`- Expected tools checked: ${result.checked_tools}`);
  console.log(`- Schema metadata tools checked: ${result.schema_metadata_tools}`);
  console.log(`- Schema metadata properties checked: ${result.schema_metadata_properties}`);
  console.log(`- Schema metadata enum fields checked: ${result.schema_metadata_enum_fields}`);
  console.log(`- Schema metadata required fields checked: ${result.schema_metadata_required_fields}`);
  console.log(`- Schema metadata defaults checked: ${result.schema_metadata_defaults}`);
  console.log(`- Schema metadata string maxLength fields checked: ${result.schema_metadata_string_max_lengths}`);
  console.log(`- Permission metadata contracts checked: ${result.permission_metadata_tools}`);
  console.log(`- Schema metadata array maxItems fields checked: ${result.schema_metadata_array_max_items}`);
  console.log(`- Schema metadata array item maxLength fields checked: ${result.schema_metadata_array_item_max_lengths}`);
  console.log(`- Schema metadata integer maximum fields checked: ${result.schema_metadata_integer_maximums}`);
  console.log(`- Schema metadata null normalization checked: ${result.schema_metadata_null_normalization}`);
  console.log(`- Schema metadata empty-string normalization checked: ${result.schema_metadata_empty_string_normalization}`);
  console.log(`- Schema metadata string-array normalization checked: ${result.schema_metadata_string_array_normalization}`);
  console.log(`- Schema metadata cross-field constraints checked: ${result.schema_metadata_cross_field_constraints}`);
  console.log(`- Schema metadata confirmations checked: ${result.schema_metadata_confirmations}`);
  console.log(`- Default application audits checked: ${result.default_application_audits}`);
  console.log(`- Optional null fixtures checked: ${result.optional_null_fixtures}`);
  console.log(`- Optional null audits checked: ${result.optional_null_audits}`);
  console.log(`- Optional blank fixtures checked: ${result.optional_blank_fixtures}`);
  console.log(`- Optional blank audits checked: ${result.optional_blank_audits}`);
  console.log(`- Invalid tool fixtures checked for -32602: ${result.invalid_tool_fixtures}`);
  console.log(`- Tool-level result.isError fixtures checked: ${result.tool_level_error_fixtures}`);
  console.log(`- Unknown argument fixtures checked: ${result.unknown_argument_fixtures}`);
  console.log(`- Unknown argument audits checked: ${result.unknown_argument_audits}`);
  console.log(`- Enum constraint fixtures checked: ${result.enum_constraint_fixtures}`);
  console.log(`- Enum constraint audits checked: ${result.enum_constraint_audits}`);
  console.log(`- Schema type fixtures checked: ${result.schema_type_fixtures}`);
  console.log(`- Schema type audits checked: ${result.schema_type_audits}`);
  console.log(`- Integer maximum fixtures checked: ${result.integer_maximum_fixtures}`);
  console.log(`- Integer maximum audits checked: ${result.integer_maximum_audits}`);
  console.log(`- Size constraint fixtures checked: ${result.size_constraint_fixtures}`);
  console.log(`- Size constraint audits checked: ${result.size_constraint_audits}`);
  console.log(`- String-array blank fixtures checked: ${result.string_array_blank_fixtures}`);
  console.log(`- String-array blank audits checked: ${result.string_array_blank_audits}`);
  console.log(`- Required constraint fixtures checked: ${result.required_constraint_fixtures}`);
  console.log(`- Required constraint audits checked: ${result.required_constraint_audits}`);
  console.log(`- Cross-field constraint fixtures checked: ${result.cross_field_constraint_fixtures}`);
  console.log(`- Cross-field constraint audits checked: ${result.cross_field_constraint_audits}`);
  console.log(`- High-risk argument error fixtures checked: ${result.high_risk_argument_error_fixtures}`);
  console.log(`- High-risk argument error audits checked: ${result.high_risk_argument_error_audits}`);
  console.log(`- High-risk confirmation fixtures checked: ${result.high_risk_confirmation_fixtures}`);
  console.log(`- Confirmation guard audits checked: ${result.confirmation_guard_audits}`);
  console.log(`- Wrong-confirmation fixtures checked: ${result.wrong_confirmation_fixtures}`);
  console.log(`- Wrong-confirmation audits checked: ${result.wrong_confirmation_audits}`);
  console.log(`- Confirmed dry-run fixtures checked: ${result.confirmed_dry_run_fixtures}`);
  console.log(`- Confirmed dry-run audits checked: ${result.confirmed_dry_run_audits}`);
  console.log(`- Confirmed no-op fixtures checked: ${result.confirmed_no_op_fixtures}`);
  console.log(`- Confirmed no-op audits checked: ${result.confirmed_no_op_audits}`);
  console.log(`- Concurrency failure fixtures checked: ${result.concurrency_failure_fixtures}`);
  console.log(`- Concurrency failure audits checked: ${result.concurrency_failure_audits}`);
  console.log(`- Resources exposed: ${result.resources}`);
  console.log(`- Expected resources checked: ${result.checked_resources}`);
  console.log(`- Invalid resource fixtures checked for -32602: ${result.invalid_resource_fixtures}`);
  console.log(`- Prompts exposed: ${result.prompts}`);
  console.log(`- Expected prompts checked: ${result.checked_prompts}`);
  console.log(`- Prompt fixtures checked through prompts/get: ${result.prompt_fixtures}`);
  console.log(`- Invalid prompt fixtures checked for -32602: ${result.invalid_prompt_fixtures}`);
  console.log(`- JSON-RPC shell error fixtures checked: ${result.invalid_json_rpc_fixtures}`);
  console.log(`- Mixed framing fixtures checked: ${result.framing_fixtures}`);
  console.log(`- Chunked framing fixtures checked: ${result.chunked_framing_fixtures}`);
  console.log(`- Writes used for chunked header fixture: ${result.chunked_header_writes}`);
  console.log(`- Back-to-back framing fixtures checked: ${result.back_to_back_framing_fixtures}`);
  console.log(`- Writes used for back-to-back frames: ${result.back_to_back_header_writes}`);
  console.log(`- Mixed-batch framing fixtures checked: ${result.mixed_batch_framing_fixtures}`);
  console.log(`- Writes used for mixed-batch frames: ${result.mixed_batch_writes}`);
  console.log(`- Reverse mixed-batch fixtures checked: ${result.reverse_mixed_batch_framing_fixtures}`);
  console.log(`- Writes used for reverse mixed-batch frames: ${result.reverse_mixed_batch_writes}`);
  console.log(`- Malformed header errors checked: ${result.malformed_header_errors}`);
  console.log(`- Recovery frames checked after malformed header: ${result.malformed_header_recovery_frames}`);
  console.log(`- Writes used for malformed header fixture: ${result.malformed_header_writes}`);
  console.log(`- Invalid Content-Length fixtures checked: ${result.invalid_content_length_fixtures}`);
  console.log(`- Invalid Content-Length errors checked: ${result.invalid_content_length_errors}`);
  console.log(`- Recovery frames checked after invalid Content-Length: ${result.invalid_content_length_recovery_frames}`);
  console.log(`- Writes used for invalid Content-Length fixtures: ${result.invalid_content_length_writes}`);
  console.log(`- Malformed body errors checked: ${result.malformed_body_errors}`);
  console.log(`- Recovery frames checked after malformed body: ${result.malformed_body_recovery_frames}`);
  console.log(`- Writes used for malformed body fixture: ${result.malformed_body_writes}`);
  console.log(`- Transport message byte limit checked: ${result.transport_message_limit_bytes}`);
  console.log(`- Transport header byte limit checked: ${result.transport_header_limit_bytes}`);
  console.log(`- Oversized message errors checked: ${result.oversized_message_errors}`);
  console.log(`- Recovery frames checked after oversized messages: ${result.oversized_message_recovery_frames}`);
  console.log(`- Writes used for oversized message fixtures: ${result.oversized_message_writes}`);
  console.log(`- Oversized header errors checked: ${result.oversized_header_errors}`);
  console.log(`- Recovery frames checked after oversized headers: ${result.oversized_header_recovery_frames}`);
  console.log(`- Writes used for oversized header fixture: ${result.oversized_header_writes}`);
  console.log(`- EOF truncation fixtures checked: ${result.eof_truncation_fixtures}`);
  console.log(`- Header-framed EOF errors checked: ${result.eof_truncation_header_errors}`);
  console.log(`- Line-framed EOF errors checked: ${result.eof_truncation_line_errors}`);
  console.log(`- Writes used for EOF truncation fixtures: ${result.eof_truncation_writes}`);
  console.log(`- Dispatch queue limit checked: ${result.dispatch_queue_limit}`);
  console.log(`- Dispatch queue accepted requests checked: ${result.dispatch_queue_accepted_requests}`);
  console.log(`- Dispatch queue rejected requests checked: ${result.dispatch_queue_rejected_requests}`);
  console.log(`- Dispatch queue dropped notifications checked: ${result.dispatch_queue_dropped_notifications}`);
  console.log(`- Dispatch queue recovery requests checked: ${result.dispatch_queue_recovery_requests}`);
  console.log(`- Writes used for dispatch queue fixture: ${result.dispatch_queue_writes}`);
  console.log(`- Stdout response queue limit checked: ${result.stdout_response_queue_limit}`);
  console.log(`- Stdout response resume low-water mark checked: ${result.stdout_response_resume_low_water_mark}`);
  console.log(`- Stdout backpressure parse errors checked: ${result.stdout_backpressure_parse_errors}`);
  console.log(`- Stdout backpressure recovery requests checked: ${result.stdout_backpressure_recovery_requests}`);
  console.log(`- Delayed stdout read checked (ms): ${result.stdout_backpressure_delayed_read_ms}`);
  console.log(`- Writes used for stdout backpressure fixture: ${result.stdout_backpressure_writes}`);
  console.log(`- Complete-frame backpressure EOF parse errors checked: ${result.backpressure_eof_complete_parse_errors}`);
  console.log(`- Complete-frame backpressure EOF recovery requests checked: ${result.backpressure_eof_complete_recovery_requests}`);
  console.log(`- False backpressure EOF truncation errors: ${result.backpressure_eof_false_truncation_errors}`);
  console.log(`- Truncated-frame backpressure EOF parse errors checked: ${result.backpressure_eof_truncated_parse_errors}`);
  console.log(`- Backpressure EOF truncation errors checked: ${result.backpressure_eof_truncation_errors}`);
  console.log(`- Delayed backpressure EOF read checked (ms): ${result.backpressure_eof_delayed_read_ms}`);
  console.log(`- Writes used for backpressure EOF fixtures: ${result.backpressure_eof_writes}`);
  console.log(`- Watched files unchanged: ${result.watched_files.join(", ")}`);
  console.log(`- Protected runtime paths unchanged: ${result.protected_runtime_paths.join(", ")}`);
  console.log(`- Forbidden paths absent: ${result.forbidden_paths.join(", ")}`);
  console.log(`- MCP audit records exercised: ${result.audit_records_added} (${result.audit_log})`);
  console.log("- MCP audit log restored byte-for-byte: yes");
}

main().catch((error) => {
  console.error(`MCP smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
