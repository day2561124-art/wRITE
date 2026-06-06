import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const fileSpecs = [
  ["error_report", "data/error_report_db/canon_errors.jsonl"],
  ["error_report", "data/error_report_db/character_errors.jsonl"],
  ["error_report", "data/error_report_db/dialogue_errors.jsonl"],
  ["error_report", "data/error_report_db/pacing_errors.jsonl"],
  ["error_report", "data/error_report_db/battle_errors.jsonl"],
  ["error_report", "data/error_report_db/preference_errors.jsonl"],
  ["error_report", "data/feedback_db/pending_error_reports.jsonl"],
  ["feedback", "data/feedback_db/accepted_drafts.jsonl"],
  ["feedback", "data/feedback_db/rejected_drafts.jsonl"],
  ["generic_pair", "data/feedback_db/revision_pairs.jsonl"],
  ["generic_pair", "data/feedback_db/preference_pairs.jsonl"],
  ["generic_pair", "data/outputs/logs/draft_index.jsonl"],
  ["generic_pair", "data/outputs/logs/proof_report_index.jsonl"],
  ["generic_pair", "data/outputs/logs/settlement_proposal_index.jsonl"],
  ["generic_pair", "data/outputs/logs/mcp_tool_audit.jsonl"],
];

const schemaByPath = new Map(fileSpecs.map(([schema, filePath]) => [normalizePath(resolvePath(filePath)), schema]));

const severityValues = new Set(["P0", "P1", "P2", "P3", "P4"]);
const errorStatusValues = new Set(["pending_review", "active", "archived", "committed"]);
const feedbackStatusValues = new Set(["raw", "archived"]);
const feedbackTypeValues = new Set(["accepted", "rejected", "revision", "preference"]);

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/validate-jsonl.mjs [--all] [--file <path> ...] [--strict]",
    "",
    "Options:",
    "  --all            Validate all known feedback and error-report JSONL files. Default when no --file is provided.",
    "  --file <path>    Validate one JSONL file. Can be repeated.",
    "  --schema <name>  Override schema for --file: error_report|feedback|generic_pair.",
    "  --strict         Treat generic_pair records without created_at/status as errors instead of warnings.",
    "",
    "Examples:",
    "  node server/src/tools/validate-jsonl.mjs --all",
    "  node server/src/tools/validate-jsonl.mjs --file data/feedback_db/pending_error_reports.jsonl",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function parseArgs(argv) {
  const options = {
    files: [],
    schemaOverride: "",
    all: false,
    strict: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--all") {
      options.all = true;
      continue;
    }

    if (arg === "--file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--file requires a path.");
      }
      options.files.push(resolvePath(value));
      index += 1;
      continue;
    }

    if (arg === "--schema") {
      const value = argv[index + 1];
      if (!["error_report", "feedback", "generic_pair"].includes(value)) {
        throw new Error("--schema must be one of: error_report, feedback, generic_pair.");
      }
      options.schemaOverride = value;
      index += 1;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.files.length === 0) {
    options.all = true;
  }

  if (options.schemaOverride && options.files.length === 0) {
    throw new Error("--schema can only be used with --file.");
  }

  return options;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function requireString(errors, record, field) {
  if (typeof record[field] !== "string") {
    errors.push(`${field} must be a string.`);
  }
}

function requireArray(errors, record, field) {
  if (!Array.isArray(record[field])) {
    errors.push(`${field} must be an array.`);
  }
}

function requireSeverity(errors, record) {
  if (!severityValues.has(record.severity)) {
    errors.push("severity must be one of P0, P1, P2, P3, P4.");
  }
}

function requireStatus(errors, record, allowedValues, field = "status") {
  if (!allowedValues.has(record[field])) {
    errors.push(`${field} must be one of: ${[...allowedValues].join(", ")}.`);
  }
}

function validateErrorReport(record) {
  const errors = [];
  const warnings = [];

  for (const field of ["error_id", "created_at", "source", "task_type", "chapter", "severity", "category", "bad_pattern", "why_bad", "fix_rule", "action", "status"]) {
    if (!(field in record)) {
      errors.push(`missing required field: ${field}.`);
    }
  }

  for (const field of ["error_id", "created_at", "source", "task_type", "chapter", "severity", "category", "bad_pattern", "why_bad", "fix_rule", "example_bad", "example_fix", "action", "status"]) {
    if (field in record) {
      requireString(errors, record, field);
    }
  }

  for (const field of ["scene_type", "characters"]) {
    if (!(field in record)) {
      errors.push(`missing required field: ${field}.`);
    } else {
      requireArray(errors, record, field);
    }
  }

  if ("created_at" in record && !isIsoDate(record.created_at)) {
    errors.push("created_at must be a valid ISO date string.");
  }

  if ("committed_at" in record && !isIsoDate(record.committed_at)) {
    errors.push("committed_at must be a valid ISO date string.");
  }

  if ("severity" in record) {
    requireSeverity(errors, record);
  }

  if ("status" in record) {
    requireStatus(errors, record, errorStatusValues);
  }

  if (!String(record.error_id ?? "").startsWith("E-")) {
    warnings.push("error_id should start with E-.");
  }

  if (!String(record.fix_rule ?? "").trim()) {
    warnings.push("fix_rule is empty; future generation may not learn a usable rule.");
  }

  return { errors, warnings };
}

function validateFeedback(record) {
  const errors = [];
  const warnings = [];

  for (const field of ["feedback_id", "created_at", "source", "type", "task_type", "chapter", "severity", "category", "feedback", "status"]) {
    if (!(field in record)) {
      errors.push(`missing required field: ${field}.`);
    }
  }

  for (const field of ["feedback_id", "created_at", "source", "type", "task_type", "chapter", "severity", "category", "feedback", "status"]) {
    if (field in record) {
      requireString(errors, record, field);
    }
  }

  for (const field of ["scene_type", "characters"]) {
    if (!(field in record)) {
      errors.push(`missing required field: ${field}.`);
    } else {
      requireArray(errors, record, field);
    }
  }

  if ("created_at" in record && !isIsoDate(record.created_at)) {
    errors.push("created_at must be a valid ISO date string.");
  }

  if ("type" in record && !feedbackTypeValues.has(record.type)) {
    errors.push(`type must be one of: ${[...feedbackTypeValues].join(", ")}.`);
  }

  if ("severity" in record) {
    requireSeverity(errors, record);
  }

  if ("status" in record) {
    requireStatus(errors, record, feedbackStatusValues);
  }

  if (!String(record.feedback_id ?? "").startsWith("FB-")) {
    warnings.push("feedback_id should start with FB-.");
  }

  if (!String(record.feedback ?? "").trim()) {
    warnings.push("feedback is empty.");
  }

  if ("draft" in record && record.draft !== null && !isObject(record.draft)) {
    errors.push("draft must be an object or null.");
  }

  return { errors, warnings };
}

function validateGenericPair(record, strict) {
  const errors = [];
  const warnings = [];

  if ("created_at" in record && !isIsoDate(record.created_at)) {
    errors.push("created_at must be a valid ISO date string.");
  } else if (!("created_at" in record)) {
    (strict ? errors : warnings).push("created_at is recommended.");
  }

  if ("status" in record && typeof record.status !== "string") {
    errors.push("status must be a string.");
  } else if (!("status" in record)) {
    (strict ? errors : warnings).push("status is recommended.");
  }

  return { errors, warnings };
}

function validateBySchema(schema, record, strict) {
  if (!isObject(record)) {
    return {
      errors: ["record must be a JSON object."],
      warnings: [],
    };
  }

  if (schema === "error_report") {
    return validateErrorReport(record);
  }

  if (schema === "feedback") {
    return validateFeedback(record);
  }

  return validateGenericPair(record, strict);
}

async function readJsonl(filePath) {
  let text = "";
  let stats = { size: 0 };

  try {
    [text, stats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        text: "",
        bytes: 0,
        records: [],
        parseErrors: [],
      };
    }
    throw error;
  }

  const lines = text.split(/\r?\n/);
  const records = [];
  const parseErrors = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      continue;
    }

    try {
      records.push({
        lineNumber: index + 1,
        record: JSON.parse(line),
      });
    } catch (error) {
      parseErrors.push({
        lineNumber: index + 1,
        message: error.message,
      });
    }
  }

  return {
    text,
    bytes: stats.size,
    records,
    parseErrors,
  };
}

async function validateFile(filePath, schema, strict) {
  const result = {
    path: normalizePath(filePath),
    schema,
    bytes: 0,
    records: 0,
    errors: [],
    warnings: [],
  };

  let jsonl;
  try {
    jsonl = await readJsonl(filePath);
  } catch (error) {
    result.errors.push(`cannot read file: ${error.message}`);
    return result;
  }

  result.bytes = jsonl.bytes;
  result.records = jsonl.records.length;

  for (const parseError of jsonl.parseErrors) {
    result.errors.push(`L${parseError.lineNumber}: invalid JSON: ${parseError.message}`);
  }

  for (const entry of jsonl.records) {
    const validation = validateBySchema(schema, entry.record, strict);
    for (const error of validation.errors) {
      result.errors.push(`L${entry.lineNumber}: ${error}`);
    }
    for (const warning of validation.warnings) {
      result.warnings.push(`L${entry.lineNumber}: ${warning}`);
    }
  }

  return result;
}

function schemaForFile(filePath, override) {
  if (override) {
    return override;
  }

  const normalized = normalizePath(filePath);
  return schemaByPath.get(normalized) ?? "generic_pair";
}

function printResult(result) {
  const status = result.errors.length > 0 ? "FAIL" : "OK";
  console.log(`${status} ${result.path} (${result.schema}, ${result.records} records, ${result.bytes} bytes)`);

  for (const warning of result.warnings) {
    console.log(`  WARN ${warning}`);
  }

  for (const error of result.errors) {
    console.log(`  ERROR ${error}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const files = options.all
    ? fileSpecs.map(([, filePath]) => resolvePath(filePath))
    : options.files;

  const results = [];
  for (const filePath of files) {
    results.push(await validateFile(filePath, schemaForFile(filePath, options.schemaOverride), options.strict));
  }

  for (const result of results) {
    printResult(result);
  }

  const errorCount = results.reduce((total, result) => total + result.errors.length, 0);
  const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
  const recordCount = results.reduce((total, result) => total + result.records, 0);

  console.log("");
  console.log(`Validated ${results.length} files, ${recordCount} records, ${errorCount} errors, ${warningCount} warnings.`);

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
