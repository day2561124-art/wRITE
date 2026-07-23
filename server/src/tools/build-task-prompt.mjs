import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPathInside,
  projectPaths,
  resolveGeneratedMarkdownPath,
} from "../project-paths.mjs";
import { atomicWriteFile } from "../file-transactions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultGenerationContextPath = path.join(rootDir, "data", "outputs", "generation_context.md");
const defaultRetrievalContextPath = path.join(rootDir, "data", "outputs", "retrieval_context.md");
const defaultOutputPath = path.join(rootDir, "data", "outputs", "task_prompt.md");

const taskModes = {
  "next-chapter": {
    label: "下一章正文候選",
    purpose: "生成完整正文候選，但不更新正史。",
    output: "輸出完整正文候選；若任務資訊不足，先列出缺口與不可越界項。",
    forbidden: [
      "不得承接未正式採用內容。",
      "不得把未支付方向寫成正史。",
      "不得自行定案代表資格、正式名額、正式編組、重大能力突破、長期失能、死亡或重大關係翻轉。",
      "不得更新 Canon DB、Memory、Error Report 或任何正式資料。",
    ],
  },
  proofread: {
    label: "正式採用前驗稿精修",
    purpose: "檢查候選正文是否可修、不可修或存在正式衝突。",
    output: "若可修，輸出完整重寫正文；若不可修，輸出退稿原因；若正式衝突，輸出停止原因。",
    forbidden: [
      "不得把驗稿修正寫入正史。",
      "不得用局部修句硬過 P0 正史錯誤。",
      "不得新增未成立事件補洞。",
    ],
  },
  settle: {
    label: "正式章節結算",
    purpose: "只根據使用者明確採用的完整正文抽取正式成立事項。",
    output: "輸出檢核結果、必要提醒、完成狀態與新版引擎候選。",
    forbidden: [
      "不得續寫。",
      "不得補戲。",
      "不得推定未成立結果。",
      "不得把未支付方向寫成正史。",
      "不得在未確認前啟用新版 active_engine。",
    ],
  },
  debug: {
    label: "設定除錯",
    purpose: "檢查設定、正史、寫作規則、錯誤報告與任務要求之間的衝突。",
    output: "輸出問題清單、衝突原因、建議修正與可直接執行的下一步。",
    forbidden: [
      "不得直接覆蓋正式設定。",
      "不得讓低權限資料反向修改 Canon DB。",
      "不得把猜測當作正式除錯結論。",
    ],
  },
};

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/build-task-prompt.mjs [--mode next-chapter|proofread|settle|debug] [--task <text>] [--retrieval <path>] [--output <path>]",
    "",
    "Examples:",
    "  node server/src/tools/build-task-prompt.mjs --task \"下一章正文候選：承接第十九章醫療後座\"",
    "  node server/src/tools/build-task-prompt.mjs --mode proofread --task \"檢查候選稿是否違反第十九章正式結算\"",
  ].join("\n");
}

function resolvePath(value) {
  return assertPathInside(value, projectPaths.outputs, "context path");
}

function parseArgs(argv) {
  const options = {
    mode: "next-chapter",
    task: "",
    generationContextPath: defaultGenerationContextPath,
    retrievalContextPath: defaultRetrievalContextPath,
    outputPath: defaultOutputPath,
    help: false,
  };

  const taskParts = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!taskModes[value]) {
        throw new Error(`Unknown --mode: ${value}`);
      }
      options.mode = value;
      index += 1;
      continue;
    }

    if (arg === "--task") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--task requires text.");
      }
      options.task = value;
      index += 1;
      continue;
    }

    if (arg === "--generation") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--generation requires a path.");
      }
      options.generationContextPath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--retrieval") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--retrieval requires a path.");
      }
      options.retrievalContextPath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a path.");
      }
      options.outputPath = resolveGeneratedMarkdownPath(value, "--output");
      index += 1;
      continue;
    }

    taskParts.push(arg);
  }

  if (!options.task && taskParts.length > 0) {
    options.task = taskParts.join(" ");
  }

  if (!options.task) {
    options.task = "下一章正文候選：請先依 generation_context 與 retrieval_context 檢查可承接範圍，列出本次起稿不可越界事項，再生成正文候選。";
  }

  return options;
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readTextFile(filePath) {
  const [text, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
  return {
    path: filePath,
    text,
    bytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    sha256: hashText(text),
  };
}

function manifestRow(source) {
  return `| ${normalizePath(source.path)} | ${source.bytes} | ${source.modifiedAt} | ${source.sha256.slice(0, 16)} |`;
}

function modeInstructions(mode) {
  const modeSpec = taskModes[mode];
  return [
    `Mode: ${modeSpec.label}`,
    "",
    `Purpose: ${modeSpec.purpose}`,
    "",
    `Expected output: ${modeSpec.output}`,
    "",
    "Forbidden:",
    ...modeSpec.forbidden.map((item) => `- ${item}`),
  ].join("\n");
}

function canonGuardChecklist() {
  return [
    "- 是否承接未正式採用稿。",
    "- 是否把候選內容當成正史。",
    "- 是否提前支付長線骨架。",
    "- 是否把未支付技能方向寫成已掌握能力。",
    "- 是否自行新增角色關係、能力突破、正式名額、正式編組、長期傷勢、死亡或重大關係翻轉。",
    "- 是否讓正文寫作卡覆蓋創作引擎。",
    "- 是否讓錯誤報告反向修改正式設定。",
    "- 是否讓 Feedback Memory 把退稿內容當成正式事件。",
  ].join("\n");
}

function currentInputMetadata(...sources) {
  const text = sources.map((source) => source.text ?? "").join("\n");
  const value = (key) => (
    text.match(new RegExp(`^- ${key}:\\s*(.+)$`, "mu"))?.[1]?.trim()
    ?? "unknown"
  );
  return {
    effectiveCanonHead: value("effective_canon_head"),
    continuityHead: value("continuity_head"),
    settlementReportId: value("settlement_report_id"),
    continuityRollback: value("continuity_rollback"),
  };
}

function buildTaskPrompt({ options, generationContext, retrievalContext, generatedAt }) {
  const metadata = currentInputMetadata(
    generationContext,
    retrievalContext,
  );
  const mode = taskModes[options.mode];
  return [
    "# Task Prompt",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## 正式承接點",
    "",
    `- effective_canon_head: ${metadata.effectiveCanonHead}`,
    `- continuity_head: ${metadata.continuityHead}`,
    `- settlement_report_id: ${metadata.settlementReportId}`,
    `- continuity_rollback: ${metadata.continuityRollback}`,
    "",
    "## 本次任務",
    "",
    options.task,
    `模式：${mode.label}。${mode.purpose}`,
    "",
    "## 必要硬性要求",
    "",
    `- ${mode.forbidden[0] ?? "不得更新正式資料。"}`,
    "- 不得把候選內容、檢索結果或未支付方向升格為正史。",
    "- 不得自動採用、結算、核准或啟用任何 Canon 狀態。",
    "",
    "## Context References",
    "",
    `- generation_context: ${normalizePath(generationContext.path)} (sha256=${generationContext.sha256})`,
    `- retrieval_context: ${normalizePath(retrievalContext.path)} (sha256=${retrievalContext.sha256})`,
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const generatedAt = new Date().toISOString();
  const [generationContext, retrievalContext] = await Promise.all([
    readTextFile(options.generationContextPath),
    readTextFile(options.retrievalContextPath),
  ]);

  const taskPrompt = buildTaskPrompt({
    options,
    generationContext,
    retrievalContext,
    generatedAt,
  });

  await atomicWriteFile(options.outputPath, `${taskPrompt}\n`, {
    tool: "build-task-prompt",
    mode: options.mode,
  });

  console.log(`Wrote ${normalizePath(options.outputPath)}`);
  console.log(`Mode: ${taskModes[options.mode].label}`);
  console.log(`Generation context: ${normalizePath(options.generationContextPath)}`);
  console.log(`Retrieval context: ${normalizePath(options.retrievalContextPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
