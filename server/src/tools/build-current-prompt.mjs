import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sourceTrustFor,
  validateSourceTrustMetadata,
} from "../source-trust.mjs";
import {
  commitFileTransaction,
  createTransactionId,
} from "../file-transactions.mjs";
import { resolveGeneratedMarkdownPath } from "../project-paths.mjs";
import {
  sourceFilePath,
  sourceSpecsFor,
} from "../source-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultFullOutputPath = path.join(rootDir, "data", "outputs", "current_prompt.md");
const defaultCompactOutputPath = path.join(rootDir, "data", "outputs", "generation_context.md");

const sourceSpecs = sourceSpecsFor("stable").map((entry) => ({
  key: entry.source_id,
  title: entry.title,
  required: entry.required_in_generation,
  authority: entry.authority,
  filePath: sourceFilePath(entry),
}));

const jsonlSpecs = sourceSpecsFor("jsonl").map((entry) => [
  entry.source_id,
  sourceFilePath(entry),
]);

const memorySpecs = sourceSpecsFor("memory").map((entry) => [
  entry.source_id,
  sourceFilePath(entry),
]);

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/build-current-prompt.mjs",
    "",
    "Builds:",
    "  data/outputs/current_prompt.md",
    "  data/outputs/generation_context.md",
    "",
    "Options:",
    "  --full-output <path>       Override current_prompt.md under data/outputs/",
    "  --compact-output <path>    Override generation_context.md under data/outputs/",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    fullOutputPath: defaultFullOutputPath,
    compactOutputPath: defaultCompactOutputPath,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }
    if (arg === "--full-output") {
      options.fullOutputPath = resolveGeneratedMarkdownPath(
        argv[index + 1] ?? "",
        "--full-output",
      );
      index += 1;
      continue;
    }
    if (arg === "--compact-output") {
      options.compactOutputPath = resolveGeneratedMarkdownPath(
        argv[index + 1] ?? "",
        "--compact-output",
      );
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

async function readSource(spec) {
  try {
    const [text, stats] = await Promise.all([readFile(spec.filePath, "utf8"), stat(spec.filePath)]);
    const versionMatch = text.slice(0, 1200).match(/v\d+(?:\.\d+)+/i) ?? spec.filePath.match(/v\d+(?:\.\d+)+/i);
    const version = versionMatch ? versionMatch[0] : "active";
    const trust = sourceTrustFor(spec.key, text, {
      sourceVersion: version,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      exists: true,
    });
    const trustErrors = validateSourceTrustMetadata(trust);
    if (trustErrors.length > 0) {
      throw new Error(`${spec.key} source trust metadata is invalid: ${trustErrors.join("; ")}`);
    }
    return {
      ...spec,
      exists: true,
      text,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: hashText(text),
      empty: text.trim().length === 0,
      version,
      trust,
    };
  } catch (error) {
    const trust = sourceTrustFor(spec.key, "", {
      sourceVersion: "missing",
      exists: false,
    });
    return {
      ...spec,
      exists: false,
      text: "",
      bytes: 0,
      modifiedAt: "",
      sha256: "",
      empty: true,
      version: "missing",
      trust,
      error: error.message,
    };
  }
}

async function readJsonl([key, filePath]) {
  const source = await readSource({
    key,
    title: `JSONL｜${key}`,
    required: false,
    authority: "Error or feedback retrieval",
    filePath,
  });

  const lines = source.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    ...source,
    lines,
    count: lines.length,
  };
}

function manifestTable(sources) {
  const rows = [
    "| Key | Path | Version | Trust | Canon Status | Required | Status | Bytes | Modified | SHA-256 |",
    "| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |",
  ];

  for (const source of sources) {
    const status = source.exists ? (source.empty ? "empty" : "ready") : "missing";
    rows.push(
      [
        source.key,
        normalizePath(source.filePath),
        source.version,
        source.trust.source_trust_level,
        source.trust.canon_status,
        source.required ? "yes" : "no",
        status,
        source.bytes,
        source.modifiedAt,
        source.sha256 ? source.sha256.slice(0, 16) : "",
      ]
        .map(escapeCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  return rows.join("\n");
}

function riskSummary(sources, jsonlSources) {
  const warnings = [];

  for (const source of sources) {
    if (!source.exists && source.required) {
      warnings.push(`- 缺少必要檔案：\`${normalizePath(source.filePath)}\``);
    } else if (!source.exists) {
      warnings.push(`- 尚未建立可選檔案：\`${normalizePath(source.filePath)}\``);
    } else if (source.trust.source_trust_level === "T8" && source.trust.forbidden_reason) {
      warnings.push(
        `- Source trust downgraded to T8: \`${normalizePath(source.filePath)}\` `
          + `(${source.trust.forbidden_reason}).`,
      );
    } else if (source.empty) {
      warnings.push(`- 檔案目前為空：\`${normalizePath(source.filePath)}\``);
    }
  }

  const emptyErrorFiles = jsonlSources.filter((source) => source.exists && source.count === 0);
  if (emptyErrorFiles.length > 0) {
    warnings.push(`- 目前沒有正式錯誤報告：${emptyErrorFiles.map((source) => `\`${source.key}\``).join("、")}`);
  }

  return warnings.length > 0 ? warnings.join("\n") : "- 無缺檔或空檔警告。";
}

function hardRules() {
  return [
    "1. 候選正文永遠不能直接進正史。",
    "2. 寫作卡不能覆蓋創作引擎。",
    "3. 錯誤報告不能反向改寫正式設定。",
    "4. Feedback Memory 不能把未採用內容當正史。",
    "5. RAG 找到的資料必須保留來源與版本。",
    "6. CAG 只放壓縮後的穩定核心，不放大量未整理資料。",
    "7. 正史更新必須經正式章節結算與使用者確認。",
    "8. MCP 寫入工具必須分權限。",
    "9. active_engine 只能由正式章節結算流程更新。",
    "10. active_writing_card 只能由寫作卡升級流程更新。",
    "11. 未支付技能方向只能作為防越界索引，不得當作已掌握能力。",
    "12. 使用者未正式採用的候選正文不得進入 Canon DB。",
    "13. overwrite_active_engine 不得由 AI 自動執行。",
  ].join("\n");
}

function numberedLines(text) {
  return text.split(/\r?\n/).map((line, index) => ({
    number: index + 1,
    text: line,
  }));
}

function firstNonEmptyLines(text, limit = 12) {
  return numberedLines(text)
    .filter((line) => line.text.trim().length > 0)
    .slice(0, limit)
    .map((line) => `L${line.number}: ${line.text}`)
    .join("\n");
}

function headingOutline(text, { maxHeadings = 80, maxLevel = 3 } = {}) {
  const headingPattern = new RegExp(`^#{1,${maxLevel}}\\s+`);
  const headings = numberedLines(text)
    .filter((line) => headingPattern.test(line.text))
    .slice(0, maxHeadings)
    .map((line) => `- L${line.number}: ${line.text}`);

  return headings.length > 0 ? headings.join("\n") : "- 無 Markdown 標題。";
}

function keyRuleLines(text, { maxLines = 50 } = {}) {
  const patterns = [
    /本版定位/,
    /本版更新/,
    /現行正式狀態/,
    /正史止於/,
    /不得/,
    /禁止/,
    /必須/,
    /候選正文/,
    /未支付/,
    /承接/,
    /支付/,
    /工具人/,
    /AI 腔/,
    /過度安全/,
    /醫療後座/,
    /關係後座/,
    /勝負後座/,
  ];

  const matches = numberedLines(text)
    .filter((line) => patterns.some((pattern) => pattern.test(line.text)))
    .slice(0, maxLines)
    .map((line) => `- L${line.number}: ${line.text}`);

  return matches.length > 0 ? matches.join("\n") : "- 未命中關鍵規則行。";
}

function compactSourceSection(source, options = {}) {
  if (!source.exists) {
    return [
      `## ${source.title}`,
      "",
      `> Missing source: \`${normalizePath(source.filePath)}\``,
      "",
    ].join("\n");
  }

  if (source.bytes <= 1200) {
    return [
      `## ${source.title}`,
      "",
      `Source: \`${normalizePath(source.filePath)}\``,
      `Authority: ${source.authority}`,
      `SHA-256: \`${source.sha256}\``,
      "",
      source.text.trimEnd() || "目前無內容。",
      "",
    ].join("\n");
  }

  return [
    `## ${source.title}`,
    "",
    `Source: \`${normalizePath(source.filePath)}\``,
    `Authority: ${source.authority}`,
    `SHA-256: \`${source.sha256}\``,
    "",
    "### Opening Excerpt",
    "",
    firstNonEmptyLines(source.text, options.openingLines ?? 12),
    "",
    "### Heading Outline",
    "",
    headingOutline(source.text, {
      maxHeadings: options.maxHeadings ?? 80,
      maxLevel: options.maxLevel ?? 3,
    }),
    "",
    "### Key Rule Hits",
    "",
    keyRuleLines(source.text, { maxLines: options.maxRuleLines ?? 50 }),
    "",
  ].join("\n");
}

function compactJsonlSummary(jsonlSources) {
  const rows = [
    "| Key | Path | Records | Status |",
    "| --- | --- | ---: | --- |",
  ];

  for (const source of jsonlSources) {
    rows.push(
      [
        source.key,
        normalizePath(source.filePath),
        source.count,
        source.count > 0 ? "has records" : "empty",
      ]
        .map(escapeCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  const records = jsonlSources
    .filter((source) => source.count > 0)
    .flatMap((source) => [
      `### ${source.key}`,
      "",
      "```jsonl",
      source.lines.join("\n"),
      "```",
      "",
    ]);

  return [
    "## Error Report Summary",
    "",
    rows.join("\n"),
    "",
    records.length > 0 ? records.join("\n") : "目前沒有正式錯誤報告或 pending error report。",
    "",
  ].join("\n");
}

function compactMemorySummary(memorySources) {
  return [
    "## Memory Summary",
    "",
    ...memorySources.flatMap((source) => [
      `### ${source.key}`,
      "",
      `Source: \`${normalizePath(source.filePath)}\``,
      "",
      "```json",
      source.exists ? source.text.trim() || "{}" : "{}",
      "```",
      "",
    ]),
  ].join("\n");
}

function sourceSection(source) {
  if (!source.exists) {
    return [
      `## ${source.title}`,
      "",
      `> Missing source: \`${normalizePath(source.filePath)}\``,
      "",
    ].join("\n");
  }

  return [
    `## ${source.title}`,
    "",
    `Source: \`${normalizePath(source.filePath)}\``,
    `Authority: ${source.authority}`,
    `SHA-256: \`${source.sha256}\``,
    "",
    `<!-- BEGIN SOURCE: ${source.key} -->`,
    source.text.trimEnd(),
    `<!-- END SOURCE: ${source.key} -->`,
    "",
  ].join("\n");
}

function jsonlSection(source) {
  if (!source.exists) {
    return [
      `### ${source.key}`,
      "",
      `Missing source: \`${normalizePath(source.filePath)}\``,
      "",
    ].join("\n");
  }

  if (source.count === 0) {
    return [
      `### ${source.key}`,
      "",
      `Source: \`${normalizePath(source.filePath)}\``,
      "",
      "目前無記錄。",
      "",
    ].join("\n");
  }

  return [
    `### ${source.key}`,
    "",
    `Source: \`${normalizePath(source.filePath)}\``,
    `Records: ${source.count}`,
    "",
    "```jsonl",
    source.lines.join("\n"),
    "```",
    "",
  ].join("\n");
}

function memorySection(source) {
  if (!source.exists) {
    return [
      `### ${source.key}`,
      "",
      `Missing source: \`${normalizePath(source.filePath)}\``,
      "",
    ].join("\n");
  }

  return [
    `### ${source.key}`,
    "",
    `Source: \`${normalizePath(source.filePath)}\``,
    "",
    "```json",
    source.text.trim() || "{}",
    "```",
    "",
  ].join("\n");
}

function buildPrompt({ sources, jsonlSources, memorySources, generatedAt }) {
  return [
    "# Current Generation Prompt",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "This file is generated by `server/src/tools/build-current-prompt.mjs` for local Phase 1 prompt building.",
    "",
    "## Task Mode",
    "",
    "預設任務模式：下一章正文候選。",
    "",
    "輸出正文候選時，禁止更新正史、禁止承接未正式採用內容、禁止把未支付方向寫成已成立結果。",
    "",
    "## Authority Order",
    "",
    "Canon DB > 正式結算資料 > Writing Policy DB > Error Report DB > Feedback DB > Preference Memory > Working Memory。",
    "",
    "若資料互相衝突，以較高權限資料為準；若 Canon DB 資訊不足，必須標記不確定，不得自行補成正史。",
    "",
    "## Source Manifest",
    "",
    manifestTable([...sources, ...jsonlSources, ...memorySources]),
    "",
    "## Current Warnings",
    "",
    riskSummary(sources, jsonlSources),
    "",
    "## Hard Rules",
    "",
    hardRules(),
    "",
    "## CAG Stable Core",
    "",
    "- 正史止於 `data/canon_db/active_engine.md` 所記錄之正式章節。",
    "- 不得承接未正式採用稿。",
    "- 不得把未支付方向寫成正史。",
    "- 候選正文未正式採用與結算前不成正史。",
    "- 每章必須有承諾、推進與支付。",
    "- Error Report 只能作為避錯與修正規則，不能改寫正式設定。",
    "",
    "## Error Reports",
    "",
    ...jsonlSources.map(jsonlSection),
    "## Memory Store",
    "",
    ...memorySources.map(memorySection),
    ...sources.map(sourceSection),
  ].join("\n");
}

function latestFormalContinuityMaterial(source) {
  const text = String(source?.text ?? "");
  const block = text.match(
    /<!-- LATEST_DIRECT_SETTLED_CANON:BEGIN -->([\s\S]*?)<!-- LATEST_DIRECT_SETTLED_CANON:END -->/u,
  )?.[1]?.trim();
  if (!block) {
    return {
      metadata: [
        "- effective_canon_head: unknown",
        "- continuity_head: unknown",
        "- settlement_report_id: unknown",
      ],
      summary: "No latest formal continuity block was found in active_engine metadata.",
    };
  }
  const value = (label) => (
    block.match(new RegExp(`^- ${label}：(.+)$`, "mu"))?.[1]?.trim()
    ?? "unknown"
  );
  const summary = block
    .split(/^### 正式章節結算摘要\s*$/mu)[1]
    ?.trim()
    ?? "No formal settlement summary was recorded.";
  return {
    metadata: [
      `- effective_canon_head: ${value("正式 Canon head")}`,
      `- continuity_head: ${value("下一章承接點")}`,
      `- settlement_report_id: ${value("結算報告")}`,
    ],
    summary,
  };
}

function buildGenerationContext({ sources, jsonlSources, memorySources, generatedAt }) {
  const sourceByKey = new Map(sources.map((source) => [source.key, source]));
  const continuity = latestFormalContinuityMaterial(
    sourceByKey.get("active_engine"),
  );
  void jsonlSources;
  void memorySources;

  return [
    "# Generation Context",
    "",
    `Generated at: ${generatedAt}`,
    "",
    ...continuity.metadata,
    "",
    "## Continuity Summary",
    "",
    continuity.summary,
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const generatedAt = new Date().toISOString();
  const [sources, jsonlSources, memorySources] = await Promise.all([
    Promise.all(sourceSpecs.map(readSource)),
    Promise.all(jsonlSpecs.map(readJsonl)),
    Promise.all(
      memorySpecs.map(([key, filePath]) =>
        readSource({
          key,
          title: `Memory｜${key}`,
          required: false,
          authority: "Memory cache, cannot override canon",
          filePath,
        }),
      ),
    ),
  ]);

  const prompt = buildPrompt({ sources, jsonlSources, memorySources, generatedAt });
  const generationContext = buildGenerationContext({ sources, jsonlSources, memorySources, generatedAt });
  const missingRequired = sources.filter((source) => source.required && !source.exists);
  if (missingRequired.length > 0) {
    throw new Error(`Missing required sources: ${missingRequired.map((source) => normalizePath(source.filePath)).join(", ")}`);
  }
  const transactionId = createTransactionId();
  await commitFileTransaction("build-current-prompt", [
    { type: "write", filePath: options.fullOutputPath, content: `${prompt}\n` },
    { type: "write", filePath: options.compactOutputPath, content: `${generationContext}\n` },
  ], { transaction_id: transactionId, generated_at: generatedAt });

  console.log(`Wrote ${normalizePath(options.fullOutputPath)}`);
  console.log(`Wrote ${normalizePath(options.compactOutputPath)}`);
  console.log(`Sources: ${sources.length}, JSONL: ${jsonlSources.length}, memory: ${memorySources.length}`);
  console.log(`Transaction: ${transactionId}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
