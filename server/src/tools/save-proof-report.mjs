import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const reportsDir = path.join(rootDir, "data", "outputs", "proof_reports");
const indexPath = path.join(rootDir, "data", "outputs", "logs", "proof_report_index.jsonl");
const defaultTaskPromptPath = path.join(rootDir, "data", "outputs", "task_prompt.md");

const verdictValues = new Set(["pass", "needs_rewrite", "reject", "stop"]);
const severityValues = new Set(["P0", "P1", "P2", "P3", "P4"]);

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/save-proof-report.mjs --title <text> (--text <text> | --source-file <path>) [options]",
    "",
    "Options:",
    "  --chapter <text>          Chapter or draft label",
    "  --draft-id <id>           Related draft_id",
    "  --verdict <value>         pass|needs_rewrite|reject|stop. Default: needs_rewrite",
    "  --severity P0..P4         Default: P2",
    "  --task-prompt <path>      Default: data/outputs/task_prompt.md",
    "  --dry-run                Print save plan without writing",
    "",
    "Examples:",
    "  node server/src/tools/save-proof-report.mjs --title \"第二十章候選稿A驗稿\" --draft-id DRAFT-... --verdict needs_rewrite --severity P2 --text \"驗稿報告\" --dry-run",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseArgs(argv) {
  const options = {
    title: "",
    chapter: "",
    draftId: "",
    verdict: "needs_rewrite",
    severity: "P2",
    taskPromptPath: defaultTaskPromptPath,
    text: "",
    sourceFile: "",
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--title") {
      options.title = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--chapter") {
      options.chapter = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--draft-id") {
      options.draftId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--verdict") {
      options.verdict = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--severity") {
      options.severity = String(argv[index + 1] ?? "").toUpperCase();
      index += 1;
      continue;
    }

    if (arg === "--task-prompt") {
      options.taskPromptPath = resolvePath(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--text") {
      options.text = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--source-file") {
      options.sourceFile = resolvePath(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.title.trim()) {
    throw new Error("--title is required.");
  }

  const contentSourceCount = [options.text.trim(), options.sourceFile].filter(Boolean).length;
  if (contentSourceCount !== 1) {
    throw new Error("Provide exactly one content source: --text or --source-file.");
  }

  if (!verdictValues.has(options.verdict)) {
    throw new Error("--verdict must be one of: pass, needs_rewrite, reject, stop.");
  }

  if (!severityValues.has(options.severity)) {
    throw new Error("--severity must be P0, P1, P2, P3 or P4.");
  }

  return options;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function slugify(value) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return ascii || "proof-report";
}

function timestampForFile(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
}

async function readContent(options) {
  if (options.sourceFile) {
    const [text, stats] = await Promise.all([readFile(options.sourceFile, "utf8"), stat(options.sourceFile)]);
    return {
      text,
      source: {
        path: normalizePath(options.sourceFile),
        bytes: stats.size,
        modified_at: stats.mtime.toISOString(),
        sha256: hashText(text),
      },
    };
  }

  return {
    text: options.text,
    source: null,
  };
}

async function fileMetadata(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    const stats = await stat(filePath);
    return {
      path: normalizePath(filePath),
      bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
      sha256: hashText(text),
    };
  } catch {
    return null;
  }
}

function buildReportText({ options, createdAt, content }) {
  return [
    "---",
    `title: ${JSON.stringify(options.title)}`,
    `chapter: ${JSON.stringify(options.chapter)}`,
    `draft_id: ${JSON.stringify(options.draftId)}`,
    `verdict: ${JSON.stringify(options.verdict)}`,
    `severity: ${JSON.stringify(options.severity)}`,
    `created_at: ${JSON.stringify(createdAt.toISOString())}`,
    "---",
    "",
    content.text.trimEnd(),
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const createdAt = new Date();
  const content = await readContent(options);
  const reportBody = buildReportText({ options, createdAt, content });
  const reportSha256 = hashText(reportBody);
  const reportId = `PROOF-${timestampForFile(createdAt)}-${reportSha256.slice(0, 8).toUpperCase()}`;
  const outputPath = path.join(reportsDir, `${timestampForFile(createdAt)}_${slugify(options.title)}.md`);
  const taskPrompt = await fileMetadata(options.taskPromptPath);

  const record = {
    proof_report_id: reportId,
    created_at: createdAt.toISOString(),
    source: "save-proof-report",
    chapter: options.chapter,
    title: options.title,
    draft_id: options.draftId,
    verdict: options.verdict,
    severity: options.severity,
    status: "recorded",
    path: normalizePath(outputPath),
    bytes: Buffer.byteLength(reportBody, "utf8"),
    sha256: reportSha256,
    task_prompt: taskPrompt,
    source_file: content.source,
  };

  console.log("Proof report save plan:");
  console.log(JSON.stringify(record, null, 2));

  if (options.dryRun) {
    console.log("");
    console.log("Dry run: no files written.");
    return;
  }

  await mkdir(reportsDir, { recursive: true });
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(outputPath, reportBody, "utf8");
  await writeFile(indexPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  });

  console.log("");
  console.log("Proof report saved.");
  console.log(`- Wrote ${normalizePath(outputPath)}`);
  console.log(`- Indexed ${normalizePath(indexPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
