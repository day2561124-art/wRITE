import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitFileTransaction,
  createTransactionId,
} from "../file-transactions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const feedbackTargets = {
  accepted: path.join(rootDir, "data", "feedback_db", "accepted_drafts.jsonl"),
  rejected: path.join(rootDir, "data", "feedback_db", "rejected_drafts.jsonl"),
  revision: path.join(rootDir, "data", "feedback_db", "revision_pairs.jsonl"),
  preference: path.join(rootDir, "data", "feedback_db", "preference_pairs.jsonl"),
};

const pendingErrorPath = path.join(rootDir, "data", "feedback_db", "pending_error_reports.jsonl");

const categorySpecs = [
  {
    category: "正史承接錯誤",
    prefix: "E-CANON",
    action: "stop_or_structure_rewrite",
    patterns: [/正史/, /承接/, /未採用/, /硬錯/, /正式設定/, /Canon/i],
  },
  {
    category: "角色工具人錯誤",
    prefix: "E-CHARACTER",
    action: "character_rewrite",
    patterns: [/工具人/, /角色/, /能動性/, /排隊發言/, /聲線/, /目的/],
  },
  {
    category: "對話 AI 腔錯誤",
    prefix: "E-DIALOGUE",
    action: "dialogue_rewrite",
    patterns: [/對話/, /AI 腔/i, /台詞/, /語感/, /直白說明/, /說教/],
  },
  {
    category: "章節流程化",
    prefix: "E-PACING",
    action: "structure_rewrite",
    patterns: [/流程/, /公告/, /等待/, /入場/, /空轉/, /主戲/, /結構/, /支付/, /承重/],
  },
  {
    category: "戰鬥過度安全",
    prefix: "E-BATTLE",
    action: "battle_rewrite",
    patterns: [/戰鬥/, /過度安全/, /傷勢/, /勝負/, /醫療後座/, /攻防/, /武裝/],
  },
  {
    category: "使用者偏好",
    prefix: "E-PREFERENCE",
    action: "preference_adjustment",
    patterns: [/偏好/, /喜歡/, /不喜歡/, /下次/, /希望/, /不要/],
  },
];

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/add-feedback.mjs --type rejected|accepted|revision|preference --feedback <text> [options]",
    "",
    "Options:",
    "  --task-type <text>          Default: chapter_draft",
    "  --chapter <text>            Chapter or draft label",
    "  --draft-file <path>         Optional draft/proof file to hash and reference",
    "  --characters <list>         Comma/space separated characters",
    "  --scene-type <list>         Comma/space separated scene tags",
    "  --severity P0..P4           Optional; inferred when omitted",
    "  --category <text>           Optional; inferred when omitted",
    "  --bad-pattern <text>        Candidate error bad pattern",
    "  --why-bad <text>            Candidate error reason",
    "  --fix-rule <text>           Candidate error fix rule",
    "  --action <text>             Candidate action",
    "  --no-candidate             Do not create pending error candidate for rejected feedback",
    "  --dry-run                  Print records without writing JSONL",
    "",
    "Examples:",
    "  node server/src/tools/add-feedback.mjs --type rejected --chapter \"第二十章候選稿\" --feedback \"整章只有公告和等待，沒有角色選擇造成的支付。\" --characters \"朝日奈千夜,九逃\" --scene-type \"正式選拔,醫療後座\" --dry-run",
    "  node server/src/tools/add-feedback.mjs --type accepted --chapter \"第二十章\" --feedback \"採用此版，醫療後座與短期摩擦成立。\"",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseList(value) {
  return String(value ?? "")
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    type: "rejected",
    feedback: "",
    taskType: "chapter_draft",
    chapter: "",
    draftFile: "",
    characters: [],
    sceneType: [],
    severity: "",
    category: "",
    badPattern: "",
    whyBad: "",
    fixRule: "",
    action: "",
    makeCandidate: true,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--type") {
      options.type = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--feedback") {
      options.feedback = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--task-type") {
      options.taskType = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--chapter") {
      options.chapter = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--draft-file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--draft-file requires a path.");
      }
      options.draftFile = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--characters") {
      options.characters = parseList(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--scene-type") {
      options.sceneType = parseList(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--severity") {
      options.severity = String(argv[index + 1] ?? "").toUpperCase();
      index += 1;
      continue;
    }

    if (arg === "--category") {
      options.category = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--bad-pattern") {
      options.badPattern = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--why-bad") {
      options.whyBad = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--fix-rule") {
      options.fixRule = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--action") {
      options.action = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--no-candidate") {
      options.makeCandidate = false;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!feedbackTargets[options.type]) {
    throw new Error("--type must be one of: rejected, accepted, revision, preference.");
  }

  if (!options.feedback.trim()) {
    throw new Error("--feedback is required.");
  }

  if (options.severity && !/^P[0-4]$/.test(options.severity)) {
    throw new Error("--severity must be P0, P1, P2, P3 or P4.");
  }

  if (options.type !== "rejected") {
    options.makeCandidate = false;
  }

  return options;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function draftMetadata(filePath) {
  if (!filePath) {
    return null;
  }

  const [text, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
  return {
    path: path.relative(rootDir, filePath).replaceAll(path.sep, "/"),
    bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
    sha256: hashText(text),
  };
}

function timestampId(prefix, now, seed) {
  const stamp = now.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
  const shortHash = hashText(`${prefix}:${now}:${seed}`).slice(0, 8).toUpperCase();
  return `${prefix}-${stamp}-${shortHash}`;
}

function inferCategory(feedback) {
  const scored = categorySpecs
    .map((spec) => {
      const score = spec.patterns.reduce((total, pattern) => total + (pattern.test(feedback) ? 1 : 0), 0);
      return { spec, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored[0].spec;
  }

  return categorySpecs.find((spec) => spec.category === "使用者偏好");
}

function inferSeverity(feedback, category, type) {
  if (type === "accepted") {
    return "P4";
  }

  if (/P[0-4]/.test(feedback)) {
    return feedback.match(/P[0-4]/)[0];
  }

  if (/正史硬錯|硬錯|承接未正式採用|未採用.*正史|死亡|正式名額|代表資格|正式編組/.test(feedback)) {
    return "P0";
  }

  if (category === "章節流程化") {
    return "P2";
  }

  if (category === "對話 AI 腔錯誤") {
    return "P3";
  }

  if (category === "使用者偏好") {
    return "P4";
  }

  if (/角色|能力|主戲|重大|突破|工具人/.test(feedback)) {
    return "P1";
  }

  if (/章節|結構|流程|公告|等待|空轉|支付|承重/.test(feedback)) {
    return "P2";
  }

  if (/對話|語感|AI 腔|修句|台詞/.test(feedback)) {
    return "P3";
  }

  return "P2";
}

function buildFeedbackRecord({ options, now, feedbackId, draft }) {
  const categorySpec = options.category
    ? { category: options.category, prefix: "E-CUSTOM", action: "manual_review" }
    : inferCategory(options.feedback);
  const severity = options.severity || inferSeverity(options.feedback, categorySpec.category, options.type);

  return {
    feedback_id: feedbackId,
    created_at: now,
    source: "user_feedback",
    type: options.type,
    task_type: options.taskType,
    chapter: options.chapter,
    severity,
    category: categorySpec.category,
    scene_type: options.sceneType,
    characters: options.characters,
    feedback: options.feedback,
    draft,
    status: "raw",
  };
}

function buildPendingErrorCandidate({ options, now, feedbackRecord }) {
  const categorySpec = options.category
    ? { category: options.category, prefix: "E-CUSTOM", action: "manual_review" }
    : inferCategory(options.feedback);
  const severity = feedbackRecord.severity;

  return {
    error_id: timestampId(categorySpec.prefix, now, feedbackRecord.feedback_id),
    created_at: now,
    source: "user_feedback_candidate",
    feedback_id: feedbackRecord.feedback_id,
    task_type: options.taskType,
    chapter: options.chapter,
    severity,
    category: categorySpec.category,
    scene_type: options.sceneType,
    characters: options.characters,
    bad_pattern: options.badPattern || options.feedback,
    why_bad: options.whyBad || "由使用者回饋產生，尚未經正式確認。",
    fix_rule: options.fixRule || "下次生成前檢查此模式並避免重犯；正式規則需等待使用者確認後才能寫入 Error Report DB。",
    example_bad: "",
    example_fix: "",
    action: options.action || categorySpec.action,
    status: "pending_review",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const now = new Date().toISOString();
  const transactionId = createTransactionId();
  const draft = await draftMetadata(options.draftFile);
  const feedbackId = timestampId("FB", now, options.feedback);
  const feedbackRecord = buildFeedbackRecord({ options, now, feedbackId, draft });
  feedbackRecord.transaction_id = transactionId;
  const pendingCandidate = options.makeCandidate
    ? buildPendingErrorCandidate({ options, now, feedbackRecord })
    : null;
  if (pendingCandidate) pendingCandidate.transaction_id = transactionId;

  console.log("Feedback record:");
  console.log(JSON.stringify(feedbackRecord, null, 2));
  if (pendingCandidate) {
    console.log("");
    console.log("Pending error candidate:");
    console.log(JSON.stringify(pendingCandidate, null, 2));
  }

  if (options.dryRun) {
    console.log("");
    console.log("Dry run: no files written.");
    return;
  }

  const operations = [{
    type: "append",
    filePath: feedbackTargets[options.type],
    content: `${JSON.stringify(feedbackRecord)}\n`,
  }];
  if (pendingCandidate) {
    operations.push({
      type: "append",
      filePath: pendingErrorPath,
      content: `${JSON.stringify(pendingCandidate)}\n`,
    });
  }
  await commitFileTransaction("add-feedback", operations, {
    transaction_id: transactionId,
    feedback_id: feedbackId,
  });

  console.log("");
  console.log("Write complete.");
  console.log(`- Feedback: ${path.relative(rootDir, feedbackTargets[options.type]).replaceAll(path.sep, "/")}`);
  if (pendingCandidate) {
    console.log(`- Pending candidate: ${path.relative(rootDir, pendingErrorPath).replaceAll(path.sep, "/")}`);
  }
  console.log(`- Transaction: ${transactionId}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
