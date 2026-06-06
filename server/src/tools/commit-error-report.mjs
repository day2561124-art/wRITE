import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultPendingPath = path.join(rootDir, "data", "feedback_db", "pending_error_reports.jsonl");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "error_report_commits.jsonl");

const targetFiles = {
  canon: path.join(rootDir, "data", "error_report_db", "canon_errors.jsonl"),
  character: path.join(rootDir, "data", "error_report_db", "character_errors.jsonl"),
  dialogue: path.join(rootDir, "data", "error_report_db", "dialogue_errors.jsonl"),
  pacing: path.join(rootDir, "data", "error_report_db", "pacing_errors.jsonl"),
  battle: path.join(rootDir, "data", "error_report_db", "battle_errors.jsonl"),
  preference: path.join(rootDir, "data", "error_report_db", "preference_errors.jsonl"),
};

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/commit-error-report.mjs --list",
    "  node server/src/tools/commit-error-report.mjs --error-id <id> [--dry-run]",
    "  node server/src/tools/commit-error-report.mjs --error-id <id> --confirm COMMIT",
    "",
    "Options:",
    "  --pending <path>          Pending JSONL path. Default: data/feedback_db/pending_error_reports.jsonl",
    "  --error-id <id>           Commit candidate by error_id",
    "  --feedback-id <id>        Commit candidate by feedback_id",
    "  --latest                  Select latest pending_review candidate",
    "  --target <name>           Override target: canon|character|dialogue|pacing|battle|preference",
    "  --list                    List candidates without writing",
    "  --dry-run                 Show commit plan without writing",
    "  --confirm COMMIT          Required for real write",
    "",
    "Examples:",
    "  node server/src/tools/commit-error-report.mjs --list",
    "  node server/src/tools/commit-error-report.mjs --latest --dry-run",
    "  node server/src/tools/commit-error-report.mjs --error-id E-PACING-20260605-154542981-CFB73822 --confirm COMMIT",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseArgs(argv) {
  const options = {
    pendingPath: defaultPendingPath,
    errorId: "",
    feedbackId: "",
    target: "",
    list: false,
    latest: false,
    dryRun: false,
    confirm: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--pending") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--pending requires a path.");
      }
      options.pendingPath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--error-id") {
      options.errorId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--feedback-id") {
      options.feedbackId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--target") {
      options.target = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--list") {
      options.list = true;
      continue;
    }

    if (arg === "--latest") {
      options.latest = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--confirm") {
      options.confirm = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.target && !targetFiles[options.target]) {
    throw new Error("--target must be one of: canon, character, dialogue, pacing, battle, preference.");
  }

  const selectorCount = [options.errorId, options.feedbackId, options.latest].filter(Boolean).length;
  if (!options.list && selectorCount !== 1) {
    throw new Error("Choose exactly one selector: --error-id, --feedback-id or --latest.");
  }

  return options;
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readJsonl(filePath) {
  let text = "";
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return { text: "", records: [] };
    }
    throw error;
  }

  const records = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter((entry) => entry.line.trim().length > 0)
    .map((entry) => {
      try {
        return {
          ...entry,
          record: JSON.parse(entry.line),
        };
      } catch (error) {
        throw new Error(`Invalid JSONL at ${normalizePath(filePath)}:${entry.lineNumber}: ${error.message}`);
      }
    });

  return { text, records };
}

function routeTarget(record, overrideTarget) {
  if (overrideTarget) {
    return overrideTarget;
  }

  const category = String(record.category ?? "");
  const errorId = String(record.error_id ?? "");
  const combined = `${category} ${errorId}`;

  if (/正史|Canon|E-CANON/i.test(combined)) {
    return "canon";
  }
  if (/角色|工具人|E-CHARACTER/i.test(combined)) {
    return "character";
  }
  if (/對話|AI 腔|E-DIALOGUE/i.test(combined)) {
    return "dialogue";
  }
  if (/章節|流程|節奏|PACING|E-PACING/i.test(combined)) {
    return "pacing";
  }
  if (/戰鬥|BATTLE|E-BATTLE/i.test(combined)) {
    return "battle";
  }
  if (/偏好|PREFERENCE|E-PREFERENCE/i.test(combined)) {
    return "preference";
  }

  throw new Error(`Cannot infer target for category "${category}". Provide --target.`);
}

function listCandidates(records) {
  if (records.length === 0) {
    console.log("No pending error candidates found.");
    return;
  }

  console.log("| Line | Status | Severity | Category | Error ID | Feedback ID | Chapter |");
  console.log("| ---: | --- | --- | --- | --- | --- | --- |");
  for (const entry of records) {
    const record = entry.record;
    console.log(
      [
        entry.lineNumber,
        record.status ?? "",
        record.severity ?? "",
        record.category ?? "",
        record.error_id ?? "",
        record.feedback_id ?? "",
        record.chapter ?? "",
      ]
        .map((value) => String(value).replaceAll("|", "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
}

function selectCandidate(records, options) {
  let matches = records;

  if (options.errorId) {
    matches = records.filter((entry) => entry.record.error_id === options.errorId);
  } else if (options.feedbackId) {
    matches = records.filter((entry) => entry.record.feedback_id === options.feedbackId);
  } else if (options.latest) {
    matches = records
      .filter((entry) => (entry.record.status ?? "pending_review") === "pending_review")
      .slice(-1);
  }

  if (matches.length === 0) {
    throw new Error("No matching pending error candidate found.");
  }

  if (matches.length > 1) {
    throw new Error("Multiple matching candidates found. Use --error-id for an exact selection.");
  }

  return matches[0];
}

function buildFormalRecord(record, committedAt) {
  return {
    error_id: record.error_id,
    created_at: record.created_at,
    committed_at: committedAt,
    source: record.source ?? "user_feedback_candidate",
    feedback_id: record.feedback_id,
    task_type: record.task_type ?? "chapter_draft",
    chapter: record.chapter ?? "",
    severity: record.severity ?? "P2",
    category: record.category ?? "",
    scene_type: Array.isArray(record.scene_type) ? record.scene_type : [],
    characters: Array.isArray(record.characters) ? record.characters : [],
    bad_pattern: record.bad_pattern ?? "",
    why_bad: record.why_bad ?? "",
    fix_rule: record.fix_rule ?? "",
    example_bad: record.example_bad ?? "",
    example_fix: record.example_fix ?? "",
    action: record.action ?? "manual_review",
    status: "active",
  };
}

function updatePendingRecord(records, selected, committedAt, targetKey) {
  return records.map((entry) => {
    if (entry.lineNumber !== selected.lineNumber) {
      return entry.record;
    }

    return {
      ...entry.record,
      status: "committed",
      committed_at: committedAt,
      committed_to: normalizePath(targetFiles[targetKey]),
    };
  });
}

function writeJsonlRecords(records) {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length > 0 ? "\n" : "");
}

async function appendJsonl(filePath, record) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const pending = await readJsonl(options.pendingPath);

  if (options.list) {
    listCandidates(pending.records);
    return;
  }

  const selected = selectCandidate(pending.records, options);
  const targetKey = routeTarget(selected.record, options.target);
  const targetPath = targetFiles[targetKey];
  const committedAt = new Date().toISOString();
  const formalRecord = buildFormalRecord(selected.record, committedAt);
  const pendingAfter = updatePendingRecord(pending.records, selected, committedAt, targetKey);
  const pendingAfterText = writeJsonlRecords(pendingAfter);
  const auditRecord = {
    committed_at: committedAt,
    error_id: formalRecord.error_id,
    feedback_id: formalRecord.feedback_id,
    severity: formalRecord.severity,
    category: formalRecord.category,
    source_pending: normalizePath(options.pendingPath),
    target: normalizePath(targetPath),
    pending_before_sha256: hashText(pending.text),
    pending_after_sha256: hashText(pendingAfterText),
  };

  console.log("Commit plan:");
  console.log(`- Error ID: ${formalRecord.error_id}`);
  console.log(`- Feedback ID: ${formalRecord.feedback_id ?? ""}`);
  console.log(`- Severity: ${formalRecord.severity}`);
  console.log(`- Category: ${formalRecord.category}`);
  console.log(`- Target: ${normalizePath(targetPath)}`);
  console.log(`- Pending line: ${selected.lineNumber}`);
  console.log("");
  console.log("Formal error record:");
  console.log(JSON.stringify(formalRecord, null, 2));

  if (options.dryRun || options.confirm !== "COMMIT") {
    console.log("");
    if (options.dryRun) {
      console.log("Dry run: no files written.");
    } else {
      console.log("No files written. Add --confirm COMMIT to perform this high-risk write.");
    }
    return;
  }

  await appendJsonl(targetPath, formalRecord);
  await writeFile(options.pendingPath, pendingAfterText, "utf8");
  await appendJsonl(auditLogPath, auditRecord);

  console.log("");
  console.log("Commit complete.");
  console.log(`- Appended ${normalizePath(targetPath)}`);
  console.log(`- Updated ${normalizePath(options.pendingPath)}`);
  console.log(`- Logged ${normalizePath(auditLogPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
