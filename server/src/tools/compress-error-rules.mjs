import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCandidateMarkdownPath } from "../project-paths.mjs";
import {
  commitFileTransaction,
  createTransactionId,
} from "../file-transactions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const errorSources = [
  {
    key: "canon",
    label: "正史承接錯誤",
    filePath: path.join(rootDir, "data", "error_report_db", "canon_errors.jsonl"),
  },
  {
    key: "character",
    label: "角色工具人錯誤",
    filePath: path.join(rootDir, "data", "error_report_db", "character_errors.jsonl"),
  },
  {
    key: "dialogue",
    label: "對話 AI 腔錯誤",
    filePath: path.join(rootDir, "data", "error_report_db", "dialogue_errors.jsonl"),
  },
  {
    key: "pacing",
    label: "章節流程化",
    filePath: path.join(rootDir, "data", "error_report_db", "pacing_errors.jsonl"),
  },
  {
    key: "battle",
    label: "戰鬥過度安全",
    filePath: path.join(rootDir, "data", "error_report_db", "battle_errors.jsonl"),
  },
  {
    key: "preference",
    label: "使用者偏好",
    filePath: path.join(rootDir, "data", "error_report_db", "preference_errors.jsonl"),
  },
];

const activeCompressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const candidateDir = path.join(rootDir, "data", "outputs", "compressed_rule_candidates");
const candidateIndexPath = path.join(rootDir, "data", "outputs", "logs", "compressed_rule_candidate_index.jsonl");
const updateLogPath = path.join(rootDir, "data", "outputs", "logs", "compressed_rule_updates.jsonl");
const backupDir = path.join(rootDir, "data", "outputs", "logs", "compressed_rule_backups");

const severityWeight = new Map([
  ["P0", 5],
  ["P1", 4],
  ["P2", 3],
  ["P3", 2],
  ["P4", 1],
]);

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/compress-error-rules.mjs [options]",
    "",
    "Options:",
    "  --top <n>                    Maximum compressed rules to include. Default: 24",
    "  --min-count <n>              Minimum grouped record count. Default: 1",
    "  --include-archived           Include archived formal error reports; default only status=active",
    "  --candidate-output <path>    Candidate markdown path. Default: data/outputs/compressed_rule_candidates/<timestamp>_compressed_rules_candidate.md",
    "  --write-candidate            Write candidate markdown and index log. Does not affect prompt input.",
    "  --update-active              Replace data/error_report_db/compressed_rules.md after confirmation",
    "  --confirm UPDATE_RULES       Required with --update-active",
    "  --allow-empty                Allow writing an empty/no-active-errors compressed rules file",
    "  --dry-run                    Print the plan without writing",
    "",
    "Examples:",
    "  node server/src/tools/compress-error-rules.mjs --dry-run",
    "  node server/src/tools/compress-error-rules.mjs --write-candidate",
    "  node server/src/tools/compress-error-rules.mjs --update-active --confirm UPDATE_RULES",
    "",
    "Safety:",
    "  - The tool reads only formal Error Report DB files under data/error_report_db/.",
    "  - Candidate output under data/outputs/ is review material, not an active prompt rule.",
    "  - Active compressed_rules.md is updated only with --update-active --confirm UPDATE_RULES.",
    "  - Compressed rules may constrain future generation, but must never modify Canon DB.",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    top: 24,
    minCount: 1,
    includeArchived: false,
    candidateOutputPath: "",
    writeCandidate: false,
    updateActive: false,
    confirm: "",
    allowEmpty: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--top") {
      options.top = parsePositiveInteger(argv[index + 1] ?? "", "--top");
      index += 1;
      continue;
    }

    if (arg === "--min-count") {
      options.minCount = parsePositiveInteger(argv[index + 1] ?? "", "--min-count");
      index += 1;
      continue;
    }

    if (arg === "--include-archived") {
      options.includeArchived = true;
      continue;
    }

    if (arg === "--candidate-output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--candidate-output requires a path.");
      }
      options.candidateOutputPath = resolveCandidateMarkdownPath(value, "--candidate-output");
      index += 1;
      continue;
    }

    if (arg === "--write-candidate") {
      options.writeCandidate = true;
      continue;
    }

    if (arg === "--update-active") {
      options.updateActive = true;
      continue;
    }

    if (arg === "--confirm") {
      options.confirm = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--allow-empty") {
      options.allowEmpty = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
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

function timestampForFile(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
}

function defaultCandidatePath(date) {
  return path.join(candidateDir, `${timestampForFile(date)}_compressed_rules_candidate.md`);
}

function safeString(value) {
  return String(value ?? "").trim();
}

function normalizeRuleText(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeCell(value) {
  return safeString(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function addSetValues(targetSet, values) {
  if (Array.isArray(values)) {
    for (const value of values) {
      const text = safeString(value);
      if (text) {
        targetSet.add(text);
      }
    }
    return;
  }

  const text = safeString(values);
  if (text) {
    targetSet.add(text);
  }
}

function incrementText(map, value) {
  const text = safeString(value);
  if (!text) {
    return;
  }
  map.set(text, (map.get(text) ?? 0) + 1);
}

function mostFrequentText(map, fallback = "") {
  const entries = [...map.entries()].sort((left, right) => {
    const countDiff = right[1] - left[1];
    if (countDiff !== 0) {
      return countDiff;
    }
    return right[0].length - left[0].length;
  });

  return entries[0]?.[0] ?? fallback;
}

function highestSeverity(left, right) {
  return (severityWeight.get(right) ?? 0) > (severityWeight.get(left) ?? 0) ? right : left;
}

function latestIso(left, right) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return Date.parse(right) > Date.parse(left) ? right : left;
}

async function readJsonlSource(source) {
  let text = "";
  let stats = { size: 0, mtime: new Date(0) };

  try {
    text = await readFile(source.filePath, "utf8");
    stats = await stat(source.filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const records = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    try {
      records.push({
        source,
        lineNumber: index + 1,
        record: JSON.parse(line),
      });
    } catch (error) {
      throw new Error(`Invalid JSONL at ${normalizePath(source.filePath)}:${index + 1}: ${error.message}`);
    }
  }

  return {
    ...source,
    text,
    bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
    sha256: hashText(text),
    records,
  };
}

function isIncludedRecord(record, options) {
  const status = safeString(record.status);
  if (status === "active") {
    return true;
  }
  if (options.includeArchived && status === "archived") {
    return true;
  }
  return false;
}

function groupRecords(records) {
  const groups = new Map();

  for (const entry of records) {
    const record = entry.record;
    const category = safeString(record.category) || entry.source.label;
    const fixRule = safeString(record.fix_rule);
    const badPattern = safeString(record.bad_pattern);
    const keyBasis = normalizeRuleText(fixRule || badPattern || safeString(record.why_bad) || safeString(record.error_id));
    const key = `${category}::${keyBasis}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        category,
        count: 0,
        highestSeverity: safeString(record.severity) || "P4",
        latest_at: "",
        sources: new Set(),
        errorIds: new Set(),
        chapters: new Set(),
        characters: new Set(),
        sceneTypes: new Set(),
        badPatterns: new Map(),
        whyBad: new Map(),
        fixRules: new Map(),
        actions: new Map(),
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.highestSeverity = highestSeverity(group.highestSeverity, safeString(record.severity) || "P4");
    group.latest_at = latestIso(group.latest_at, safeString(record.committed_at) || safeString(record.created_at));
    group.sources.add(entry.source.key);
    group.errorIds.add(safeString(record.error_id));
    addSetValues(group.chapters, record.chapter);
    addSetValues(group.characters, record.characters);
    addSetValues(group.sceneTypes, record.scene_type);
    incrementText(group.badPatterns, record.bad_pattern);
    incrementText(group.whyBad, record.why_bad);
    incrementText(group.fixRules, record.fix_rule);
    incrementText(group.actions, record.action);
  }

  return [...groups.values()];
}

function scoreGroup(group) {
  const severityScore = severityWeight.get(group.highestSeverity) ?? 0;
  const recencyScore = group.latest_at ? Math.min(Date.parse(group.latest_at) / 1000000000000, 2) : 0;
  return severityScore * 100 + group.count * 12 + recencyScore;
}

function sortGroups(groups) {
  return groups.sort((left, right) => {
    const scoreDiff = scoreGroup(right) - scoreGroup(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.category.localeCompare(right.category, "zh-Hant");
  });
}

function limitList(values, limit = 8) {
  const list = [...values].filter(Boolean);
  if (list.length <= limit) {
    return list.join("、") || "未標記";
  }
  return `${list.slice(0, limit).join("、")}，另 ${list.length - limit} 項`;
}

function sourceTable(sourceSummaries) {
  const rows = [
    "| Source | Path | Records | Included | SHA-256 |",
    "| --- | --- | ---: | ---: | --- |",
  ];

  for (const source of sourceSummaries) {
    rows.push(`| ${escapeCell(source.key)} | \`${escapeCell(normalizePath(source.filePath))}\` | ${source.records.length} | ${source.included_records} | \`${source.sha256}\` |`);
  }

  return rows.join("\n");
}

function categorySummary(groups) {
  const byCategory = new Map();
  for (const group of groups) {
    if (!byCategory.has(group.category)) {
      byCategory.set(group.category, {
        category: group.category,
        rules: 0,
        records: 0,
        highestSeverity: group.highestSeverity,
      });
    }
    const summary = byCategory.get(group.category);
    summary.rules += 1;
    summary.records += group.count;
    summary.highestSeverity = highestSeverity(summary.highestSeverity, group.highestSeverity);
  }

  const rows = [
    "| Category | Rules | Records | Highest Severity |",
    "| --- | ---: | ---: | --- |",
  ];

  for (const summary of sortGroups([...byCategory.values()].map((item) => ({
    ...item,
    count: item.records,
    latest_at: "",
  })))) {
    rows.push(`| ${escapeCell(summary.category)} | ${summary.rules} | ${summary.records} | ${summary.highestSeverity} |`);
  }

  return rows.join("\n");
}

function renderRule(group, index) {
  const badPattern = mostFrequentText(group.badPatterns, "未記錄具體錯誤模式");
  const whyBad = mostFrequentText(group.whyBad, "未記錄錯誤原因");
  const fixRule = mostFrequentText(group.fixRules, "未記錄修正規則");
  const action = mostFrequentText(group.actions, "生成與驗稿時必須主動檢查並避免重犯。");

  return [
    `### R${String(index + 1).padStart(2, "0")}｜${group.category}｜${group.highestSeverity}｜${group.count} 筆`,
    "",
    `- Source IDs：${limitList(group.errorIds)}`,
    `- Source files：${limitList(group.sources)}`,
    `- Scope：章節 ${limitList(group.chapters)}；角色 ${limitList(group.characters)}；場景 ${limitList(group.sceneTypes)}`,
    `- Bad pattern：${badPattern}`,
    `- Why bad：${whyBad}`,
    `- Required fix：${fixRule}`,
    `- Action：${action}`,
    "",
  ].join("\n");
}

function renderMarkdown({ sourceSummaries, includedRecords, selectedGroups, allGroups, options }) {
  const statusLine = includedRecords.length > 0
    ? `已從正式 Error Report DB 壓縮 ${includedRecords.length} 筆紀錄，形成 ${selectedGroups.length} 條候選規則。`
    : "目前沒有 status=active 的正式錯誤報告；本候選不建立新增規則。";

  const noRecordsSection = [
    "## 目前狀態",
    "",
    statusLine,
    "",
    "在正式錯誤報告累積前，AI 只能依 `SKILL.md`、`active_engine.md`、`active_writing_card.md`、本輪任務指令與直接檢索結果避錯，不得自行創造高權重錯誤規則。",
    "",
  ].join("\n");

  const rulesSection = selectedGroups.length > 0
    ? [
      "## 高優先避錯規則",
      "",
      ...selectedGroups.map((group, index) => renderRule(group, index)),
    ].join("\n")
    : noRecordsSection;

  return [
    "# 錯誤壓縮規則｜候選稿",
    "",
    "Generated from the source manifest below. Runtime timestamps are kept in output filenames and audit logs.",
    `Source policy: formal Error Report DB only; status filter: ${options.includeArchived ? "active + archived" : "active only"}.`,
    `Top limit: ${options.top}; min grouped count: ${options.minCount}.`,
    "",
    "## 使用邊界",
    "",
    "- 本檔只用於避錯、驗稿與重寫提醒，不得反向修改 Canon DB。",
    "- 本檔不得把退稿內容、候選正文或未採用方向升格為正史。",
    "- 與 Canon DB、正式結算資料或 Writing Policy DB 衝突時，依權限順序讓位。",
    "- 每條規則必須能追溯到正式 Error Report DB 的 `error_id`。",
    "",
    "## Source Summary",
    "",
    sourceTable(sourceSummaries),
    "",
    "## Compression Summary",
    "",
    `- Included records：${includedRecords.length}`,
    `- All grouped rules：${allGroups.length}`,
    `- Selected rules：${selectedGroups.length}`,
    `- Empty source state：${includedRecords.length === 0 ? "yes" : "no"}`,
    "",
    selectedGroups.length > 0 ? "## 分類摘要\n\n" + categorySummary(selectedGroups) + "\n" : "",
    rulesSection,
  ].join("\n");
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const now = new Date();
  const candidateOutputPath = options.candidateOutputPath || defaultCandidatePath(now);
  const sourceSummaries = await Promise.all(errorSources.map((source) => readJsonlSource(source)));
  const includedRecords = sourceSummaries.flatMap((source) => {
    const included = source.records.filter((entry) => isIncludedRecord(entry.record, options));
    source.included_records = included.length;
    return included;
  });

  const allGroups = sortGroups(groupRecords(includedRecords));
  const selectedGroups = allGroups
    .filter((group) => group.count >= options.minCount)
    .slice(0, options.top);
  const markdown = renderMarkdown({
    sourceSummaries,
    includedRecords,
    selectedGroups,
    allGroups,
    options,
    now,
  });
  const markdownSha256 = hashText(markdown);
  const runId = `RULE-COMPRESS-${timestampForFile(now)}-${markdownSha256.slice(0, 8).toUpperCase()}`;

  console.log("Compressed error rules plan:");
  console.log(`- Run ID: ${runId}`);
  console.log(`- Source files: ${sourceSummaries.length}`);
  console.log(`- Included records: ${includedRecords.length}`);
  console.log(`- All grouped rules: ${allGroups.length}`);
  console.log(`- Selected rules: ${selectedGroups.length}`);
  console.log(`- Candidate output: ${normalizePath(candidateOutputPath)}`);
  console.log(`- Active output: ${normalizePath(activeCompressedRulesPath)}`);
  console.log(`- Markdown SHA-256: ${markdownSha256}`);
  console.log(`- Write candidate: ${options.writeCandidate ? "yes" : "no"}`);
  console.log(`- Update active: ${options.updateActive ? "yes" : "no"}`);
  console.log(`- Dry run: ${options.dryRun ? "yes" : "no"}`);

  if (includedRecords.length === 0) {
    console.log("");
    console.log("No active formal error reports found. The generated markdown keeps the no-rules guard.");
  }

  if (options.dryRun || (!options.writeCandidate && !options.updateActive)) {
    console.log("");
    console.log("No files written.");
    return;
  }

  if (options.writeCandidate) {
    const candidateTransactionId = createTransactionId();
    const candidateRecord = {
      run_id: runId,
      transaction_id: candidateTransactionId,
      created_at: now.toISOString(),
      status: "candidate",
      path: normalizePath(candidateOutputPath),
      sha256: markdownSha256,
      included_records: includedRecords.length,
      selected_rules: selectedGroups.length,
      active_updated: false,
    };
    await commitFileTransaction("compress-error-rules-candidate", [
      { type: "write", filePath: candidateOutputPath, content: markdown },
      {
        type: "append",
        filePath: candidateIndexPath,
        content: `${JSON.stringify(candidateRecord)}\n`,
      },
    ], { transaction_id: candidateTransactionId, run_id: runId });

    console.log("");
    console.log(`Wrote candidate: ${normalizePath(candidateOutputPath)}`);
    console.log(`Appended candidate index: ${normalizePath(candidateIndexPath)}`);
    console.log(`Candidate transaction: ${candidateTransactionId}`);
  }

  if (!options.updateActive) {
    return;
  }

  if (options.confirm !== "UPDATE_RULES") {
    console.log("");
    console.log("Active compressed rules were not updated. Add --confirm UPDATE_RULES after review.");
    return;
  }

  if (includedRecords.length === 0 && !options.allowEmpty) {
    console.log("");
    console.log("Active compressed rules were not updated because no active formal errors exist. Add --allow-empty only if you explicitly want to refresh the no-rules guard.");
    return;
  }

  const currentActiveText = await readTextIfExists(activeCompressedRulesPath);
  const currentActiveSha256 = hashText(currentActiveText);
  if (currentActiveSha256 === markdownSha256) {
    console.log("");
    console.log("Active compressed rules already match generated markdown. No active write needed.");
    return;
  }

  const backupPath = path.join(backupDir, `${timestampForFile(now)}_compressed_rules_before_update.md`);
  const activeTransactionId = createTransactionId();
  const updateRecord = {
    run_id: runId,
    transaction_id: activeTransactionId,
    updated_at: now.toISOString(),
    status: "active_updated",
    active_path: normalizePath(activeCompressedRulesPath),
    backup_path: normalizePath(backupPath),
    previous_sha256: currentActiveSha256,
    new_sha256: markdownSha256,
    included_records: includedRecords.length,
    selected_rules: selectedGroups.length,
  };
  await commitFileTransaction("compress-error-rules-active", [
    { type: "write", filePath: backupPath, content: currentActiveText },
    { type: "write", filePath: activeCompressedRulesPath, content: markdown },
    {
      type: "append",
      filePath: updateLogPath,
      content: `${JSON.stringify(updateRecord)}\n`,
    },
  ], { transaction_id: activeTransactionId, run_id: runId });

  console.log("");
  console.log("Active compressed rules updated.");
  console.log(`- Backup: ${normalizePath(backupPath)}`);
  console.log(`- Active: ${normalizePath(activeCompressedRulesPath)}`);
  console.log(`- Update log: ${normalizePath(updateLogPath)}`);
  console.log(`- Transaction: ${activeTransactionId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
