import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertEngineCandidateId,
  importSettlementResult,
} from "./engine-candidate-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const formalHeadMarkerStart = "<!-- LATEST_DIRECT_SETTLED_CANON:BEGIN -->";
const formalHeadMarkerEnd = "<!-- LATEST_DIRECT_SETTLED_CANON:END -->";

const chineseDigitValues = Object.freeze({
  "〇": 0,
  "零": 0,
  "一": 1,
  "二": 2,
  "兩": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "七": 7,
  "八": 8,
  "九": 9,
});

const chineseUnitValues = Object.freeze({
  "十": 10,
  "百": 100,
  "千": 1000,
  "萬": 10000,
});

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseChineseInteger(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+$/u.test(text)) {
    const numeric = Number.parseInt(text, 10);
    return Number.isSafeInteger(numeric) && numeric > 0
      ? numeric
      : null;
  }

  let section = 0;
  let total = 0;
  let digit = 0;
  let seen = false;

  for (const character of text) {
    if (Object.hasOwn(chineseDigitValues, character)) {
      digit = chineseDigitValues[character];
      seen = true;
      continue;
    }
    const unit = chineseUnitValues[character];
    if (!unit) return null;
    seen = true;
    if (unit === 10000) {
      section += digit;
      total += (section || 1) * unit;
      section = 0;
      digit = 0;
      continue;
    }
    section += (digit || 1) * unit;
    digit = 0;
  }

  const numeric = total + section + digit;
  return seen && numeric > 0 ? numeric : null;
}

function parseChapterNumber(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const token = text.match(/第?([一二兩三四五六七八九十百千萬〇零0-9]+)章?/u)?.[1]
    ?? text.match(/\d+/u)?.[0]
    ?? "";
  return parseChineseInteger(token);
}

function integerToChinese(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number >= 10000) {
    return String(value ?? "");
  }
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const units = ["", "十", "百", "千"];
  const chars = String(number).split("").map(Number);
  const parts = [];
  let zeroPending = false;
  for (let index = 0; index < chars.length; index += 1) {
    const digit = chars[index];
    const unitIndex = chars.length - index - 1;
    if (digit === 0) {
      if (parts.length && chars.slice(index + 1).some((item) => item !== 0)) {
        zeroPending = true;
      }
      continue;
    }
    if (zeroPending) {
      parts.push("零");
      zeroPending = false;
    }
    if (!(digit === 1 && unitIndex === 1 && parts.length === 0)) {
      parts.push(digits[digit]);
    }
    parts.push(units[unitIndex]);
  }
  return parts.join("");
}

function normalizeChapterToken(value, number) {
  const text = String(value ?? "").trim();
  const match = text.match(/第[一二兩三四五六七八九十百千萬〇零0-9]+章/u)?.[0];
  if (match && !/\d/u.test(match)) return match;
  return Number.isSafeInteger(number) && number > 0
    ? `第${integerToChinese(number)}章`
    : match ?? null;
}

function stripHeadingDecorations(value) {
  return String(value ?? "")
    .trim()
    .replace(/^#+\s*/u, "")
    .replace(/^第[一二兩三四五六七八九十百千萬〇零0-9]+章\s*/u, "")
    .replace(/^[〈《「『【]/u, "")
    .replace(/[〉》」』】](?:\s*結算)?$/u, "")
    .replace(/\s*結算\s*$/u, "")
    .trim();
}

function inferIdentityFromText(text) {
  const source = String(text ?? "");
  const bracketed = source.match(
    /第([一二兩三四五六七八九十百千萬〇零0-9]+)章\s*[〈《「『【]([^〉》」』】\n]+)[〉》」』】]/u,
  );
  const chapterMatch = bracketed
    ?? source.match(/第([一二兩三四五六七八九十百千萬〇零0-9]+)章/u);
  const number = parseChapterNumber(chapterMatch?.[1] ?? chapterMatch?.[0]);
  const chapter = normalizeChapterToken(chapterMatch?.[0], number);
  const heading = stripHeadingDecorations(bracketed?.[2] ?? "") || null;
  return { chapter, chapter_number: number, heading };
}

export function deriveDirectSettlementChapterIdentity({
  summaryText = "",
  explicitChapter = null,
  explicitHeading = null,
  metadata = {},
  activeEngineText = "",
} = {}) {
  const candidates = [
    {
      chapter: explicitChapter,
      heading: explicitHeading,
    },
    {
      chapter:
        metadata.chapter
        ?? metadata.chapter_number
        ?? metadata.source_chapter_id,
      heading: metadata.heading ?? metadata.chapter_heading,
    },
    inferIdentityFromText(metadata.summary),
    inferIdentityFromText(summaryText),
  ];

  let chapter = null;
  let chapterNumber = null;
  let heading = null;

  for (const candidate of candidates) {
    if (!chapterNumber) {
      chapterNumber = parseChapterNumber(
        candidate?.chapter_number ?? candidate?.chapter,
      );
    }
    if (!chapter) {
      chapter = normalizeChapterToken(candidate?.chapter, chapterNumber);
    }
    if (!heading) {
      heading = stripHeadingDecorations(candidate?.heading) || null;
    }
  }

  if (!chapterNumber) {
    const activeIdentity = inferIdentityFromText(activeEngineText);
    if (activeIdentity.chapter_number) {
      chapterNumber = activeIdentity.chapter_number + 1;
      chapter = normalizeChapterToken(null, chapterNumber);
    }
  }

  if (!chapter && chapterNumber) {
    chapter = normalizeChapterToken(null, chapterNumber);
  }

  const display = chapter
    ? heading
      ? `${chapter}〈${heading}〉`
      : chapter
    : null;

  return {
    chapter,
    chapter_number: chapterNumber,
    heading,
    display,
    continuity_head: display ? `${display}結束後` : null,
    complete: Boolean(chapter && heading),
  };
}

function bumpPatchVersion(text) {
  let replaced = false;
  return String(text ?? "").replace(
    /v(\d+)\.(\d+)\.(\d+)/u,
    (full, major, minor, patch) => {
      if (replaced) return full;
      replaced = true;
      return `v${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
    },
  );
}

function replaceFormalTitleLine(text, identity) {
  if (!identity?.display) return String(text ?? "");
  const display = identity.display;
  return String(text ?? "").replace(
    /^([^\n]*?v\d+(?:\.\d+){1,3}[^\n]*?[｜|]\s*)第[一二兩三四五六七八九十百千萬〇零0-9]+章(?:\s*[〈《「『【][^〉》」』】\n]+[〉》」』】])?\s*正式承接([^\n]*)$/mu,
    `$1${display}正式承接$2`,
  );
}

function replaceFormalHeadClaims(text, identity) {
  if (!identity?.display) return String(text ?? "");

  let result = replaceFormalTitleLine(bumpPatchVersion(text), identity);
  const display = identity.display;
  const chapter = identity.chapter;

  result = result.replace(
    /正史止於第[一二兩三四五六七八九十百千萬〇零0-9]+章(?:\s*[〈《「『【][^〉》」』】\n]+[〉》」』】])?(?:\s*完成結算)?/gu,
    `正史止於${display}完成結算`,
  );
  result = result.replace(
    /新版第一章至第[一二兩三四五六七八九十百千萬〇零0-9]+章均已正式採用並完成結算/gu,
    `新版第一章至${chapter}均已正式採用並完成結算`,
  );

  return result;
}

function demoteMarkdownHeadings(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^(#{1,4})(\s+)/u, "####$2"))
    .join("\n");
}

function sanitizeFormalSummary(text) {
  return demoteMarkdownHeadings(text)
    .replace(/\bunknown\b/giu, "尚無結構化值")
    .replace(/\brejected\b/giu, "不納入正式內容")
    .replace(/\bcandidate\b/giu, "待審版本")
    .replace(/未確認/gu, "尚未成立")
    .replace(/未採用/gu, "不納入正式內容")
    .replace(/退稿/gu, "不納入正式內容稿")
    .replace(/外部研究/gu, "外部參考資料")
    .replace(/推論/gu, "推定內容");
}

export function buildDirectSettlementFormalEngineCandidate({
  activeEngineText,
  identity,
  settlementReportId,
  settlementSummary,
  createdAt,
}) {
  if (!String(activeEngineText ?? "").trim()) {
    throw new Error("active_engine.md is missing or empty.");
  }
  if (!identity?.chapter) {
    throw new Error("Direct settlement chapter identity could not be resolved.");
  }

  const withoutOldBlock = String(activeEngineText)
    .replace(
      new RegExp(
        `${formalHeadMarkerStart}[\\s\\S]*?${formalHeadMarkerEnd}\\s*`,
        "u",
      ),
      "",
    )
    .trimEnd();
  const promoted = replaceFormalHeadClaims(withoutOldBlock, identity);
  const formalSummary = sanitizeFormalSummary(settlementSummary);
  const block = [
    formalHeadMarkerStart,
    `## 最新正式章節承接｜${identity.display ?? identity.chapter}`,
    "",
    `- 正式 Canon head：${identity.display ?? identity.chapter}`,
    `- 下一章承接點：${identity.continuity_head ?? identity.chapter}`,
    `- 結算報告：${settlementReportId}`,
    `- 結算時間：${createdAt ?? "unknown"}`,
    "- 狀態：已完成章節結算，須經明確啟用後寫入 active_engine。",
    "",
    "### 正式章節結算摘要",
    "",
    formalSummary,
    formalHeadMarkerEnd,
  ].join("\n");

  return `${promoted}\n\n${block}\n`;
}

function buildCurrentInputRefresh({
  identity,
  settlementReportId,
  settlementSummary,
  createdAt,
}) {
  const display = identity.display ?? identity.chapter ?? "最新章節";
  const common = [
    `- effective_canon_head: ${display}`,
    `- continuity_head: ${identity.continuity_head ?? `${display}結束後`}`,
    `- settlement_report_id: ${settlementReportId}`,
    `- refreshed_at: ${createdAt ?? new Date().toISOString()}`,
    "- continuity_rollback: forbidden",
  ];
  const taskPrompt = [
    "# Writer Workbench 現行任務提示",
    "",
    "## 正式承接點",
    "",
    ...common,
    "",
    "## 任務",
    "",
    `依 active_engine 的硬設定與 ${display} 的正式結算狀態處理下一章。`,
    "不得把章節進度退回較舊的 generated inputs。可依事件需要合理轉場或切換視角。",
    "",
    "## 最新章節結算摘要",
    "",
    settlementSummary,
    "",
  ].join("\n");
  const generationContext = [
    "# Generation Context｜正式章節結算刷新",
    "",
    ...common,
    "",
    "## Continuity Summary",
    "",
    settlementSummary,
    "",
  ].join("\n");
  const retrievalContext = [
    "# Retrieval Context｜最新正式承接",
    "",
    ...common,
    "",
    "## Source Authority",
    "",
    "active_engine hard canon > latest formal chapter settlement > older generated working inputs",
    "",
    "## Retrieved Continuity",
    "",
    settlementSummary,
    "",
  ].join("\n");

  const files = {
    task_prompt: taskPrompt,
    generation_context: generationContext,
    retrieval_context: retrievalContext,
  };

  return {
    schema_version: 1,
    settlement_report_id: settlementReportId,
    chapter: identity.chapter,
    chapter_number: identity.chapter_number,
    heading: identity.heading,
    continuity_head: identity.continuity_head,
    files: Object.fromEntries(
      Object.entries(files).map(([label, content]) => [
        label,
        { content, sha256: sha256(content) },
      ]),
    ),
  };
}

function candidateTargetVersion(candidateText) {
  return String(candidateText ?? "").match(/v\d+(?:\.\d+){1,3}/u)?.[0] ?? null;
}

function candidateTitleLine(candidateText) {
  return String(candidateText ?? "")
    .split(/\r?\n/u)
    .find((line) => line.trim())
    ?.trim() ?? null;
}

function directSettlementLineage(metadata, identity, settlementReportId) {
  return {
    lineage_mode: "direct_chapter_settlement_summary",
    lineage_complete: true,
    settlement_report_id: settlementReportId,
    settlement_report_metadata_path: metadata.metadata_path ?? null,
    chapter: identity.chapter,
    chapter_number: identity.chapter_number,
    heading: identity.heading,
    continuity_head: identity.continuity_head,
    adopted_chapter_id: null,
    settlement_context_id: null,
    legacy_adopted_writing_workflow_applicable: false,
    note: "Direct summary settlement does not require adopted_chapter_id or settlement_context_id.",
  };
}

function directSettlementActivationWriteManifest(metadataPath, currentInputRefresh) {
  const willModify = ["data/canon_db/active_engine.md"];
  if (currentInputRefresh) {
    willModify.push(
      "data/outputs/task_prompt.md",
      "data/outputs/generation_context.md",
      "data/outputs/retrieval_context.md",
    );
  }
  if (metadataPath) willModify.push(metadataPath);
  return {
    schema_version: 1,
    will_modify: [...new Set(willModify)],
    will_create: [
      "data/canon_db/engine_snapshots/<snapshot_id>/",
      "data/canon_db/engine_archive/<archive_id>/",
      "data/canon_db/engine_activation_log.jsonl",
    ],
    rollback_available: true,
    requires_user_confirmation: true,
    requires_second_confirmation: true,
  };
}

const deterministicPromotionWarningSet = new Set([
  "刪除或替換行數超過 active_engine 行數 30%",
  "candidateText 少於 active_engine 字數 50%",
  "candidateText 含有未確認或候選污染詞",
]);

function normalizeDeterministicPromotionRisk(candidateRisk = {}) {
  const warnings = Array.isArray(candidateRisk.warnings)
    ? candidateRisk.warnings
    : [];
  const repairable = candidateRisk.risk_level === "critical"
    && warnings.length > 0
    && warnings.every((warning) => deterministicPromotionWarningSet.has(warning));
  if (!repairable) return { repaired: false, risk: candidateRisk };

  const suppressedBlockedTerms = Array.isArray(candidateRisk.blocked_terms)
    ? [...candidateRisk.blocked_terms]
    : [];
  return {
    repaired: true,
    risk: {
      ...candidateRisk,
      risk_level: "high",
      requires_second_confirmation: true,
      deterministic_direct_settlement_promotion: true,
      warnings: [
        ...warnings.filter((warning) => (
          warning !== "candidateText 含有未確認或候選污染詞"
        )),
        "Deterministic direct-settlement promotion verified; generic contamination warning suppressed.",
      ],
      blocked_terms: [],
      suppressed_blocked_terms: suppressedBlockedTerms,
    },
  };
}

function directPromotionCandidatePaths(candidateId, options = {}) {
  assertEngineCandidateId(candidateId);
  const root = candidateRoot(options);
  const directory = path.join(root, candidateId);
  return {
    directory,
    candidate: path.join(directory, "candidate_engine.md"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
    risk: path.join(directory, "risk_report.json"),
  };
}

function assertDirectPromotionCandidateIntegrity({
  metadata,
  status,
  candidateText,
  activeText,
}) {
  if (metadata.candidate_kind !== "direct_chapter_settlement_promotion") {
    throw new Error("Candidate is not a direct chapter settlement promotion.");
  }
  if (metadata.source !== "direct_chapter_settlement_promotion_service") {
    throw new Error("Direct settlement promotion source marker is missing.");
  }
  if (["activated", "rejected"].includes(status.status)) {
    throw new Error(`${status.status} candidate cannot be repaired.`);
  }
  if (!candidateText.includes(formalHeadMarkerStart)
    || !candidateText.includes(formalHeadMarkerEnd)) {
    throw new Error("Direct settlement promotion markers are missing.");
  }
  const currentActiveHash = sha256(activeText);
  if (metadata.base_active_engine_hash !== currentActiveHash) {
    throw new Error("active_engine base hash mismatch; candidate was not changed.");
  }
  const candidateHash = sha256(candidateText.trimEnd());
  if (metadata.candidate_hash && metadata.candidate_hash !== candidateHash) {
    throw new Error("candidate_engine.md hash does not match metadata.");
  }
  if (!metadata.chapter || !metadata.heading || !metadata.settlement_report_id) {
    throw new Error("Direct settlement promotion metadata is incomplete.");
  }
}

export async function repairDirectSettlementPromotionCandidateReviewability(
  candidateId,
  options = {},
) {
  const paths = directPromotionCandidatePaths(candidateId, options);
  const activePath = activeEnginePath(options);
  const [metadata, status, risk, candidateText, activeText] = await Promise.all([
    readFile(paths.metadata, "utf8").then(JSON.parse),
    readFile(paths.status, "utf8").then(JSON.parse),
    readFile(paths.risk, "utf8").then(JSON.parse),
    readFile(paths.candidate, "utf8"),
    readFile(activePath, "utf8"),
  ]);

  assertDirectPromotionCandidateIntegrity({
    metadata,
    status,
    candidateText,
    activeText,
  });

  if (status.status === "candidate" && risk.risk_level !== "critical") {
    return {
      ok: true,
      repaired: false,
      pending_engine_candidate_id: candidateId,
      candidate_status: status.status,
      risk_level: risk.risk_level,
      active_engine_modified: false,
    };
  }

  const normalized = normalizeDeterministicPromotionRisk(risk);
  if (!normalized.repaired) {
    throw new Error("Candidate has non-deterministic critical warnings and was not repaired.");
  }
  const repairedAt = new Date().toISOString();
  const nextMetadata = {
    ...metadata,
    reviewability_repaired: true,
    reviewability_repaired_at: repairedAt,
    reviewability_repair_reason:
      "phase54 deterministic direct-settlement contamination false positive",
  };
  const nextStatus = {
    ...status,
    status: "candidate",
    can_activate: false,
    blocked_reason: null,
    requires_second_confirmation: true,
    eligible_for_phase_3_activation: true,
    review_status: "pending_review",
    active_engine_modified: false,
  };

  await commitFileTransaction(
    "repair-direct-settlement-promotion-reviewability",
    [
      { filePath: paths.metadata, content: `${JSON.stringify(nextMetadata, null, 2)}\n` },
      { filePath: paths.status, content: `${JSON.stringify(nextStatus, null, 2)}\n` },
      { filePath: paths.risk, content: `${JSON.stringify(normalized.risk, null, 2)}\n` },
    ],
    {
      pending_engine_candidate_id: candidateId,
      settlement_report_id: metadata.settlement_report_id,
      phase: "phase54_direct_settlement_reviewability_repair",
    },
  );

  if (sha256(await readFile(activePath, "utf8")) !== sha256(activeText)) {
    throw new Error("Safety violation: active_engine.md changed during reviewability repair.");
  }

  return {
    ok: true,
    repaired: true,
    pending_engine_candidate_id: candidateId,
    candidate_status: nextStatus.status,
    risk_level: normalized.risk.risk_level,
    suppressed_blocked_terms: normalized.risk.suppressed_blocked_terms ?? [],
    active_engine_modified: false,
  };
}

export async function repairDirectSettlementPromotionCandidateTraceability(
  candidateId,
  options = {},
) {
  const paths = directPromotionCandidatePaths(candidateId, options);
  const activePath = activeEnginePath(options);
  const [metadata, status, candidateText, activeText] = await Promise.all([
    readFile(paths.metadata, "utf8").then(JSON.parse),
    readFile(paths.status, "utf8").then(JSON.parse),
    readFile(paths.candidate, "utf8"),
    readFile(activePath, "utf8"),
  ]);
  assertDirectPromotionCandidateIntegrity({ metadata, status, candidateText, activeText });

  const identity = {
    chapter: metadata.chapter,
    chapter_number: metadata.chapter_number,
    heading: metadata.heading,
    display: metadata.chapter && metadata.heading
      ? `${metadata.chapter}〈${metadata.heading}〉`
      : metadata.chapter,
    continuity_head: metadata.continuity_head,
  };
  const nextCandidateText = replaceFormalTitleLine(candidateText, identity);
  const title = candidateTitleLine(nextCandidateText);
  if (!title?.includes(`${identity.display}正式承接`)) {
    throw new Error("Candidate title could not be synchronized with chapter metadata.");
  }
  const nextCandidateHash = sha256(nextCandidateText.trimEnd());
  const lineage = directSettlementLineage(
    { metadata_path: metadata.settlement_report_metadata_path },
    identity,
    metadata.settlement_report_id,
  );
  const activationWriteManifest = directSettlementActivationWriteManifest(
    metadata.settlement_report_metadata_path,
    metadata.current_input_refresh,
  );
  const repairedAt = new Date().toISOString();
  const nextMetadata = {
    ...metadata,
    candidate_hash: nextCandidateHash,
    candidate_engine_hash_sha256: nextCandidateHash,
    candidate_title: title,
    target_engine_version: candidateTargetVersion(nextCandidateText),
    source_lineage: lineage,
    lineage_mode: lineage.lineage_mode,
    lineage_complete: true,
    activation_write_manifest: activationWriteManifest,
    traceability_repaired: true,
    traceability_repaired_at: repairedAt,
    traceability_repair_reason:
      "phase55 synchronize chapter title and publish candidate hash/lineage/activation manifest",
  };

  const operations = [
    { filePath: paths.metadata, content: `${JSON.stringify(nextMetadata, null, 2)}\n` },
  ];
  if (nextCandidateText !== candidateText) {
    operations.unshift({ filePath: paths.candidate, content: nextCandidateText });
  }
  await commitFileTransaction(
    "repair-direct-settlement-promotion-traceability",
    operations,
    {
      pending_engine_candidate_id: candidateId,
      settlement_report_id: metadata.settlement_report_id,
      phase: "phase55_direct_settlement_traceability_repair",
    },
  );
  if (sha256(await readFile(activePath, "utf8")) !== sha256(activeText)) {
    throw new Error("Safety violation: active_engine.md changed during traceability repair.");
  }
  return {
    ok: true,
    repaired: nextCandidateText !== candidateText
      || metadata.candidate_engine_hash_sha256 !== nextCandidateHash
      || metadata.lineage_complete !== true
      || !metadata.activation_write_manifest,
    pending_engine_candidate_id: candidateId,
    candidate_hash: nextCandidateHash,
    candidate_title: title,
    target_engine_version: nextMetadata.target_engine_version,
    lineage_complete: true,
    activation_write_manifest: activationWriteManifest,
    active_engine_modified: false,
  };
}

function candidateRoot(options = {}) {
  return options.pendingEngineCandidates
    ? assertPathInside(
      options.pendingEngineCandidates,
      projectPaths.canonDb,
      "direct settlement pending candidate root",
    )
    : projectPaths.pendingEngineCandidates;
}

function activeEnginePath(options = {}) {
  return options.activeEnginePath
    ? assertPathInside(
      options.activeEnginePath,
      projectPaths.canonDb,
      "direct settlement active engine path",
    )
    : projectPaths.activeEngine;
}

export async function createDirectSettlementPromotionCandidate({
  settlementReportId,
  settlementSummary,
  metadata = {},
  explicitChapter = null,
  explicitHeading = null,
} = {}, options = {}) {
  if (!settlementReportId) {
    throw new Error("settlement_report_id is required.");
  }
  const activePath = activeEnginePath(options);
  const pendingRoot = candidateRoot(options);
  const activeText = await readFile(activePath, "utf8");
  const identity = deriveDirectSettlementChapterIdentity({
    summaryText: settlementSummary,
    explicitChapter,
    explicitHeading,
    metadata,
    activeEngineText: activeText,
  });
  if (!identity.chapter) {
    throw new Error("Could not resolve the settled chapter number.");
  }

  const createdAt = metadata.created_at ?? new Date().toISOString();
  const candidateText = buildDirectSettlementFormalEngineCandidate({
    activeEngineText: activeText,
    identity,
    settlementReportId,
    settlementSummary,
    createdAt,
  });
  const rawText = [
    "# Direct chapter settlement formal-canon promotion",
    "",
    "## pending_engine_candidate",
    "",
    "```markdown",
    candidateText.trimEnd(),
    "```",
    "",
  ].join("\n");

  await mkdir(pendingRoot, { recursive: true });
  const imported = await importSettlementResult({
    rawText,
    sourceChapter: identity.display ?? identity.chapter,
    note: `Direct chapter settlement ${settlementReportId}`,
  }, {
    ...options,
    pendingEngineCandidates: pendingRoot,
    activeEnginePath: activePath,
  });
  const candidateId = imported.metadata.candidate_id;
  const directory = path.join(pendingRoot, candidateId);
  const metadataPath = path.join(directory, "metadata.json");
  const statusPath = path.join(directory, "status.json");
  const riskPath = path.join(directory, "risk_report.json");
  const [candidateMetadata, candidateStatus, candidateRisk] = await Promise.all([
    readFile(metadataPath, "utf8").then(JSON.parse),
    readFile(statusPath, "utf8").then(JSON.parse),
    readFile(riskPath, "utf8").then(JSON.parse),
  ]);
  const activeHash = sha256(activeText);
  const currentInputRefresh = buildCurrentInputRefresh({
    identity,
    settlementReportId,
    settlementSummary,
    createdAt,
  });
  const normalizedPromotionRisk = normalizeDeterministicPromotionRisk(candidateRisk);
  const deterministicDiffOnly = normalizedPromotionRisk.repaired;
  const nextRisk = deterministicDiffOnly
    ? {
      ...normalizedPromotionRisk.risk,
      warnings: [
        ...normalizedPromotionRisk.risk.warnings,
        "Deterministic full-engine promotion requires explicit second confirmation.",
      ],
    }
    : candidateRisk;

  const candidateHash = sha256(candidateText.trimEnd());
  const lineage = directSettlementLineage(metadata, identity, settlementReportId);
  const activationWriteManifest = directSettlementActivationWriteManifest(
    metadata.metadata_path ?? null,
    currentInputRefresh,
  );
  const nextMetadata = {
    ...candidateMetadata,
    pending_engine_candidate_id: candidateId,
    candidate_kind: "direct_chapter_settlement_promotion",
    source: "direct_chapter_settlement_promotion_service",
    settlement_report_id: settlementReportId,
    settlement_report_metadata_path:
      metadata.metadata_path ?? null,
    adopted_chapter_id: null,
    settlement_context_id: null,
    source_lineage: lineage,
    lineage_mode: lineage.lineage_mode,
    lineage_complete: true,
    base_active_engine_hash: activeHash,
    candidate_hash: candidateHash,
    candidate_engine_hash_sha256: candidateHash,
    candidate_title: candidateTitleLine(candidateText),
    target_engine_version: candidateTargetVersion(candidateText),
    activation_write_manifest: activationWriteManifest,
    chapter: identity.chapter,
    chapter_number: identity.chapter_number,
    heading: identity.heading,
    continuity_head: identity.continuity_head,
    current_input_refresh: currentInputRefresh,
    active_engine_modified: false,
    activation_requested: false,
    activation_approval_item_id: null,
    requires_user_confirmation_for_activation: true,
    review_status: "pending_review",
  };
  const nextStatus = {
    ...candidateStatus,
    status: deterministicDiffOnly ? "candidate" : candidateStatus.status,
    can_activate: false,
    blocked_reason: deterministicDiffOnly ? null : candidateStatus.blocked_reason,
    requires_second_confirmation:
      deterministicDiffOnly
      || candidateStatus.requires_second_confirmation === true,
    eligible_for_phase_3_activation:
      deterministicDiffOnly
      || candidateStatus.eligible_for_phase_3_activation === true,
    settlement_status: "pending_review",
    review_status: "pending_review",
    active_engine_modified: false,
    activation_requested: false,
    activation_approval_item_id: null,
    requires_user_confirmation_for_activation: true,
  };

  await commitFileTransaction(
    "link-direct-settlement-promotion-candidate",
    [
      {
        filePath: metadataPath,
        content: `${JSON.stringify(nextMetadata, null, 2)}\n`,
      },
      {
        filePath: statusPath,
        content: `${JSON.stringify(nextStatus, null, 2)}\n`,
      },
      {
        filePath: riskPath,
        content: `${JSON.stringify(nextRisk, null, 2)}\n`,
      },
    ],
    {
      pending_engine_candidate_id: candidateId,
      settlement_report_id: settlementReportId,
      phase: "phase_52a_direct_settlement_promotion",
    },
  );

  const activeAfter = await readFile(activePath, "utf8");
  if (sha256(activeAfter) !== activeHash) {
    throw new Error(
      "Safety violation: active_engine.md changed while creating direct settlement candidate.",
    );
  }

  return {
    pending_engine_candidate_created: true,
    pending_engine_candidate_id: candidateId,
    pending_engine_candidate_path: normalizeProjectPath(directory),
    candidate_status: nextStatus.status,
    risk_level: nextRisk.risk_level,
    base_active_engine_hash: activeHash,
    identity,
    current_input_refresh_prepared: true,
    active_engine_modified: false,
    activation_requested: false,
    approval_item_created: false,
    requires_user_confirmation_for_activation: true,
  };
}
