import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const proposalsDir = path.join(rootDir, "data", "outputs", "settlement_proposals");
const indexPath = path.join(rootDir, "data", "outputs", "logs", "settlement_proposal_index.jsonl");
const draftIndexPath = path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const defaultTaskPromptPath = path.join(rootDir, "data", "outputs", "task_prompt.md");

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/create-settlement-proposal.mjs --chapter <text> --title <text> (--draft-id <id> | --source-file <path> | --text <text>) [options]",
    "",
    "Options:",
    "  --confirm-adopted            Required for real write; confirms the input is user-adopted complete text",
    "  --task-prompt <path>          Default: data/outputs/task_prompt.md",
    "  --established <text>          Repeatable proposed formally established item",
    "  --unsettled <text>            Repeatable boundary item that must remain unsettled",
    "  --reminder <text>             Repeatable settlement reminder/warning",
    "  --note <text>                 Repeatable extra note",
    "  --dry-run                    Print save plan without writing",
    "",
    "Examples:",
    "  node server/src/tools/create-settlement-proposal.mjs --chapter \"第二十章\" --title \"第二十章結算提案\" --draft-id DRAFT-... --confirm-adopted",
    "  node server/src/tools/create-settlement-proposal.mjs --chapter \"第二十章\" --title \"第二十章結算提案\" --source-file data/outputs/adopted.md --established \"九逃完成換藥\" --dry-run",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseArgs(argv) {
  const options = {
    chapter: "",
    title: "",
    draftId: "",
    sourceFile: "",
    text: "",
    taskPromptPath: defaultTaskPromptPath,
    established: [],
    unsettled: [],
    reminders: [],
    notes: [],
    confirmAdopted: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--chapter") {
      options.chapter = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--title") {
      options.title = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--draft-id") {
      options.draftId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--source-file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--source-file requires a path.");
      }
      options.sourceFile = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--text") {
      options.text = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--task-prompt") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--task-prompt requires a path.");
      }
      options.taskPromptPath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--established") {
      options.established.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--unsettled") {
      options.unsettled.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--reminder") {
      options.reminders.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--note") {
      options.notes.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--confirm-adopted") {
      options.confirmAdopted = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.chapter.trim()) {
    throw new Error("--chapter is required.");
  }

  if (!options.title.trim()) {
    throw new Error("--title is required.");
  }

  const inputCount = [options.draftId, options.sourceFile, options.text.trim()].filter(Boolean).length;
  if (inputCount !== 1) {
    throw new Error("Provide exactly one input source: --draft-id, --source-file or --text.");
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
    .slice(0, 56);

  return ascii || "settlement-proposal";
}

function timestampForFile(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
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

async function readJsonl(filePath) {
  let text = "";
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function findDraftById(draftId) {
  const records = await readJsonl(draftIndexPath);
  return records.find((record) => record.draft_id === draftId) ?? null;
}

async function readAdoptedText(options) {
  if (options.draftId) {
    const draftRecord = await findDraftById(options.draftId);
    if (!draftRecord) {
      throw new Error(`Draft ID not found in ${normalizePath(draftIndexPath)}: ${options.draftId}`);
    }

    const draftPath = resolvePath(draftRecord.path);
    const text = await readFile(draftPath, "utf8");
    const stats = await stat(draftPath);
    return {
      text,
      source: {
        type: "draft_id",
        draft_id: options.draftId,
        path: normalizePath(draftPath),
        bytes: stats.size,
        modified_at: stats.mtime.toISOString(),
        sha256: hashText(text),
        draft_index_record: draftRecord,
      },
    };
  }

  if (options.sourceFile) {
    const text = await readFile(options.sourceFile, "utf8");
    const stats = await stat(options.sourceFile);
    return {
      text,
      source: {
        type: "source_file",
        path: normalizePath(options.sourceFile),
        bytes: stats.size,
        modified_at: stats.mtime.toISOString(),
        sha256: hashText(text),
      },
    };
  }

  return {
    text: options.text,
    source: {
      type: "inline_text",
      bytes: Buffer.byteLength(options.text, "utf8"),
      sha256: hashText(options.text),
    },
  };
}

function listOrPlaceholder(items, placeholder) {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) {
    return `- ${placeholder}`;
  }

  return clean.map((item) => `- ${item}`).join("\n");
}

function buildProposalText({ options, createdAt, proposalId, adopted, activeEngine, taskPrompt }) {
  return [
    "---",
    `title: ${JSON.stringify(options.title)}`,
    `chapter: ${JSON.stringify(options.chapter)}`,
    `proposal_id: ${JSON.stringify(proposalId)}`,
    `status: "proposal"`,
    `adoption_confirmed: ${options.confirmAdopted ? "true" : "false"}`,
    `created_at: ${JSON.stringify(createdAt.toISOString())}`,
    "---",
    "",
    `# ${options.title}`,
    "",
    "> 本檔是正式章節結算提案，不是新版 Canon DB。未經使用者確認與後續啟用工具處理前，不得更新 `active_engine.md`。",
    "",
    "## Source Summary",
    "",
    `- Proposal ID: \`${proposalId}\``,
    `- Chapter: ${options.chapter}`,
    `- Adoption confirmed: ${options.confirmAdopted ? "yes" : "no"}`,
    `- Adopted text SHA-256: \`${adopted.source.sha256}\``,
    `- Active engine: ${activeEngine ? `\`${activeEngine.path}\` / \`${activeEngine.sha256}\`` : "not found"}`,
    `- Task prompt: ${taskPrompt ? `\`${taskPrompt.path}\` / \`${taskPrompt.sha256}\`` : "not found"}`,
    "",
    "## Settlement Guard",
    "",
    "- 不得續寫。",
    "- 不得補戲。",
    "- 不得推定未成立結果。",
    "- 不得把未支付方向寫成正史。",
    "- 不得自行定案代表資格、正式名額、正式編組、長期失能、死亡、重大能力突破或重大關係翻轉。",
    "- 本提案只可根據使用者明確採用的完整正文抽取正式成立事項。",
    "",
    "## Proposed Established Items",
    "",
    listOrPlaceholder(options.established, "待依採用正文逐條抽取正式成立事項。"),
    "",
    "## Proposed Unsettled Boundaries",
    "",
    listOrPlaceholder(options.unsettled, "待列出仍不得成立、不得推定、不得提前支付的事項。"),
    "",
    "## Required Reminders",
    "",
    listOrPlaceholder(options.reminders, "待列出正式結算前必須提醒使用者確認的風險。"),
    "",
    "## Notes",
    "",
    listOrPlaceholder(options.notes, "無。"),
    "",
    "## Next Required Human Action",
    "",
    "1. 人工或 AI 依採用正文補齊 `Proposed Established Items` 與 `Proposed Unsettled Boundaries`。",
    "2. 使用者確認提案內容。",
    "3. 另行建立新版 engine 候選。",
    "4. 只有經使用者確認後，才可啟用新版 `active_engine.md`。",
    "",
    "## Adopted Text",
    "",
    "<ADOPTED_TEXT>",
    adopted.text.trimEnd(),
    "</ADOPTED_TEXT>",
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
  const adopted = await readAdoptedText(options);
  const [activeEngine, taskPrompt] = await Promise.all([
    fileMetadata(activeEnginePath),
    fileMetadata(options.taskPromptPath),
  ]);
  const seed = `${createdAt.toISOString()}:${options.chapter}:${options.title}:${adopted.source.sha256}`;
  const proposalId = `SETTLE-${timestampForFile(createdAt)}-${hashText(seed).slice(0, 8).toUpperCase()}`;
  const proposalText = buildProposalText({ options, createdAt, proposalId, adopted, activeEngine, taskPrompt });
  const proposalSha256 = hashText(proposalText);
  const outputPath = path.join(proposalsDir, `${timestampForFile(createdAt)}_${slugify(options.title)}.md`);
  const record = {
    settlement_proposal_id: proposalId,
    created_at: createdAt.toISOString(),
    source: "create-settlement-proposal",
    chapter: options.chapter,
    title: options.title,
    status: "proposal",
    adoption_confirmed: options.confirmAdopted,
    path: normalizePath(outputPath),
    bytes: Buffer.byteLength(proposalText, "utf8"),
    sha256: proposalSha256,
    adopted_text: adopted.source,
    active_engine: activeEngine,
    task_prompt: taskPrompt,
    established_count: options.established.filter((item) => item.trim()).length,
    unsettled_count: options.unsettled.filter((item) => item.trim()).length,
  };

  console.log("Settlement proposal plan:");
  console.log(JSON.stringify(record, null, 2));

  if (options.dryRun) {
    console.log("");
    console.log("Dry run: no files written.");
    return;
  }

  if (!options.confirmAdopted) {
    console.log("");
    console.log("No files written. Add --confirm-adopted to confirm the input is user-adopted complete text.");
    return;
  }

  await mkdir(proposalsDir, { recursive: true });
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(outputPath, proposalText, "utf8");
  await writeFile(indexPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  });

  console.log("");
  console.log("Settlement proposal saved.");
  console.log(`- Wrote ${normalizePath(outputPath)}`);
  console.log(`- Indexed ${normalizePath(indexPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
