import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const draftsDir = path.join(rootDir, "data", "outputs", "drafts");
const indexPath = path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl");
const defaultTaskPromptPath = path.join(rootDir, "data", "outputs", "task_prompt.md");

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/save-draft.mjs --title <text> (--text <text> | --source-file <path>) [options]",
    "",
    "Options:",
    "  --chapter <text>          Chapter label",
    "  --task-type <text>        Default: chapter_draft",
    "  --task-prompt <path>      Default: data/outputs/task_prompt.md",
    "  --status <text>           Default: candidate",
    "  --dry-run                Print save plan without writing",
    "",
    "Examples:",
    "  node server/src/tools/save-draft.mjs --title \"第二十章候選稿A\" --chapter \"第二十章\" --text \"正文內容\" --dry-run",
    "  node server/src/tools/save-draft.mjs --title \"第二十章候選稿A\" --source-file data/outputs/tmp_draft.md",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseArgs(argv) {
  const options = {
    title: "",
    chapter: "",
    taskType: "chapter_draft",
    taskPromptPath: defaultTaskPromptPath,
    status: "candidate",
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

    if (arg === "--task-type") {
      options.taskType = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--task-prompt") {
      options.taskPromptPath = resolvePath(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--status") {
      options.status = argv[index + 1] ?? "";
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

  return ascii || "draft";
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

function buildDraftText({ options, createdAt, content }) {
  return [
    "---",
    `title: ${JSON.stringify(options.title)}`,
    `chapter: ${JSON.stringify(options.chapter)}`,
    `task_type: ${JSON.stringify(options.taskType)}`,
    `status: ${JSON.stringify(options.status)}`,
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
  const draftBody = buildDraftText({ options, createdAt, content });
  const draftSha256 = hashText(draftBody);
  const draftId = `DRAFT-${timestampForFile(createdAt)}-${draftSha256.slice(0, 8).toUpperCase()}`;
  const outputPath = path.join(draftsDir, `${timestampForFile(createdAt)}_${slugify(options.title)}.md`);
  const taskPrompt = await fileMetadata(options.taskPromptPath);

  const record = {
    draft_id: draftId,
    created_at: createdAt.toISOString(),
    source: "save-draft",
    task_type: options.taskType,
    chapter: options.chapter,
    title: options.title,
    status: options.status,
    path: normalizePath(outputPath),
    bytes: Buffer.byteLength(draftBody, "utf8"),
    sha256: draftSha256,
    task_prompt: taskPrompt,
    source_file: content.source,
  };

  console.log("Draft save plan:");
  console.log(JSON.stringify(record, null, 2));

  if (options.dryRun) {
    console.log("");
    console.log("Dry run: no files written.");
    return;
  }

  await mkdir(draftsDir, { recursive: true });
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(outputPath, draftBody, "utf8");
  await writeFile(indexPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  });

  console.log("");
  console.log("Draft saved.");
  console.log(`- Wrote ${normalizePath(outputPath)}`);
  console.log(`- Indexed ${normalizePath(indexPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
