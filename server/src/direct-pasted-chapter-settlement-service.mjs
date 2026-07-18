import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  saveChatOutputAsSettlementReport,
} from "./adopted-writing-settlement-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const adoptedChapterIdPattern = /^adopted_chapter_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const allowedModes = new Set(["prepare", "finalize"]);
const maximumChapterChars = 500_000;
const maximumReportChars = 500_000;

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maximum) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > maximum) {
    throw new Error(`${label} exceeds ${maximum} characters.`);
  }
  return value;
}

function optionalText(value, label, maximum = 20_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  if (value.length > maximum) throw new Error(`${label} exceeds ${maximum} characters.`);
  return value;
}

function optionalObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function canonicalChapterText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .trim()
    .concat("\n");
}

function inferChapterIdentity(chapterText, rawInput = {}) {
  const firstLine = chapterText.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const chapterLabel = optionalText(
    rawInput.chapter_label ?? rawInput.chapterLabel,
    "chapter_label",
    500,
  ).trim() || firstLine || "貼上正文";
  const explicitTitle = optionalText(
    rawInput.chapter_title ?? rawInput.chapterTitle,
    "chapter_title",
    500,
  ).trim();
  const titleMatch = firstLine.match(/^第[^　\s]+章[　\s]+(.+)$/u);
  return {
    chapter_label: chapterLabel,
    chapter_title: explicitTitle || titleMatch?.[1]?.trim() || firstLine || chapterLabel,
    first_line: firstLine,
  };
}

function rootsFor(options = {}) {
  const adoptedWritings = options.adoptedWritings
    ? assertPathInside(options.adoptedWritings, projectPaths.outputs, "adopted writings test root")
    : projectPaths.adoptedWritings;
  return { adoptedWritings };
}

function adoptedPaths(adoptedChapterId, roots) {
  if (!adoptedChapterIdPattern.test(String(adoptedChapterId ?? ""))) {
    throw new Error("Invalid adopted_chapter_id.");
  }
  const directory = path.join(roots.adoptedWritings, adoptedChapterId);
  return {
    directory,
    chapter: path.join(directory, "chapter.md"),
    adoption: path.join(directory, "adoption.json"),
  };
}

async function readJson(filePath) {
  return readFile(filePath, "utf8").then(JSON.parse);
}

async function findAdoptedChapterByCanonicalHash(canonicalHash, options = {}) {
  const roots = rootsFor(options);
  await mkdir(roots.adoptedWritings, { recursive: true });
  const entries = await readdir(roots.adoptedWritings, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !adoptedChapterIdPattern.test(entry.name)) continue;
    const paths = adoptedPaths(entry.name, roots);
    try {
      const [chapterText, adoption] = await Promise.all([
        readFile(paths.chapter, "utf8"),
        readJson(paths.adoption),
      ]);
      if (sha256(canonicalChapterText(chapterText)) !== canonicalHash) continue;
      return {
        adopted_chapter_id: entry.name,
        chapter_text: chapterText,
        adoption,
        paths,
      };
    } catch {
      // Ignore incomplete or unrelated records.
    }
  }
  return null;
}

async function createDirectAdoptedChapter(chapterText, identity, source, options = {}) {
  const roots = rootsFor(options);
  const adoptedChapterId = createId("adopted_chapter");
  const paths = adoptedPaths(adoptedChapterId, roots);
  const now = new Date().toISOString();
  const contentHash = sha256(canonicalChapterText(chapterText));
  const directLineageId = createId("direct_settlement");
  const adoption = {
    adopted_chapter_id: adoptedChapterId,
    record_kind: "adopted_writing",
    adoption_kind: "explicit_pasted_chapter_settlement",
    created_at: now,
    adopted_at: now,
    source,
    source_phase: "phase_42a_direct_pasted_chapter_settlement",
    candidate_id: `${directLineageId}_candidate`,
    proof_report_id: null,
    approval_item_id: `${directLineageId}_explicit_user_confirmation`,
    chapter_label: identity.chapter_label,
    chapter_title: identity.chapter_title,
    chapter_first_line: identity.first_line,
    canon_status: "adopted_chapter",
    status: "accepted_pending_settlement",
    adoption_status: "accepted_pending_settlement",
    adopted: true,
    adopted_confirmed: true,
    accepted_pending_settlement: true,
    settled: false,
    settlement_status: "accepted_pending_settlement",
    adopted_content_hash: contentHash,
    content_hash: contentHash,
    content_path: normalizeProjectPath(paths.chapter),
    adoption_path: normalizeProjectPath(paths.adoption),
    direct_settlement_authorized: true,
    explicit_user_confirmation: "chapter_settlement_command",
    candidate_workflow_bypass_reason:
      "The user pasted the complete chapter and explicitly requested chapter settlement and persistence.",
    latest_settlement_context_id: null,
    settlement_context_ids: [],
    latest_settlement_report_id: null,
    settlement_report_ids: [],
    latest_pending_engine_candidate_id: null,
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
  };

  await mkdir(roots.adoptedWritings, { recursive: true });
  await commitFileTransaction("create-direct-pasted-adopted-chapter", [
    { filePath: paths.chapter, content: canonicalChapterText(chapterText) },
    { filePath: paths.adoption, content: `${JSON.stringify(adoption, null, 2)}\n` },
  ], {
    adopted_chapter_id: adoptedChapterId,
    chapter_hash: contentHash,
    phase: "phase_42a_direct_pasted_chapter_settlement",
  });

  return {
    adopted_chapter_id: adoptedChapterId,
    chapter_text: canonicalChapterText(chapterText),
    adoption,
    paths,
    adopted_reused: false,
  };
}

export async function ensurePastedChapterAdopted(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  if (
    rawInput.user_confirmed_chapter_settlement !== true
    && rawInput.userConfirmedChapterSettlement !== true
  ) {
    throw new Error(
      "user_confirmed_chapter_settlement must be true. "
      + "Direct adoption is allowed only when the user explicitly requests chapter settlement.",
    );
  }

  const chapterText = canonicalChapterText(requiredText(
    rawInput.chapter_text ?? rawInput.chapterText,
    "chapter_text",
    maximumChapterChars,
  ));
  const identity = inferChapterIdentity(chapterText, rawInput);
  const canonicalHash = sha256(chapterText);
  const existing = await findAdoptedChapterByCanonicalHash(canonicalHash, options);
  if (existing) {
    return {
      ...existing,
      adopted_reused: true,
      identity,
      chapter_hash: canonicalHash,
    };
  }

  const source = optionalText(rawInput.source, "source", 100).trim() || "chatgpt";
  const created = await createDirectAdoptedChapter(
    chapterText,
    identity,
    source,
    options,
  );
  return {
    ...created,
    identity,
    chapter_hash: canonicalHash,
  };
}

async function latestAdoption(adoptedChapterId, options = {}) {
  const paths = adoptedPaths(adoptedChapterId, rootsFor(options));
  return readJson(paths.adoption);
}

function publicAdoptionSummary(ensured, adoption) {
  return {
    adopted_chapter_id: ensured.adopted_chapter_id,
    adopted_reused: ensured.adopted_reused === true,
    chapter_hash: ensured.chapter_hash,
    chapter_label: adoption.chapter_label ?? ensured.identity?.chapter_label ?? null,
    chapter_title: adoption.chapter_title ?? ensured.identity?.chapter_title ?? null,
    canon_status: adoption.canon_status ?? null,
    settlement_status: adoption.settlement_status ?? null,
    latest_settlement_context_id: adoption.latest_settlement_context_id ?? null,
    latest_settlement_report_id: adoption.latest_settlement_report_id ?? null,
    latest_pending_engine_candidate_id: adoption.latest_pending_engine_candidate_id ?? null,
  };
}

export async function settlePastedChapter(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }

  const requestedMode = optionalText(rawInput.mode, "mode", 30).trim();
  const inferredMode = rawInput.settlement_report_text || rawInput.settlementReportText
    ? "finalize"
    : "prepare";
  const mode = requestedMode || inferredMode;
  if (!allowedModes.has(mode)) throw new Error(`Unknown mode: ${mode}`);

  if (rawInput.dry_run === true || rawInput.dryRun === true) {
    const chapterText = canonicalChapterText(requiredText(
      rawInput.chapter_text ?? rawInput.chapterText,
      "chapter_text",
      maximumChapterChars,
    ));
    return {
      dry_run: true,
      mode,
      chapter_hash: sha256(chapterText),
      identity: inferChapterIdentity(chapterText, rawInput),
      adopted_chapter_created: false,
      settlement_context_created: false,
      settlement_report_created: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      engine_activation_requested: false,
    };
  }

  const ensured = await ensurePastedChapterAdopted(rawInput, options);
  let adoption = await latestAdoption(ensured.adopted_chapter_id, options);

  if (mode === "prepare") {
    if (adoption.latest_pending_engine_candidate_id) {
      return {
        mode,
        already_prepared: true,
        ...publicAdoptionSummary(ensured, adoption),
        settlement_context_created: false,
        settlement_report_created: false,
        pending_engine_candidate_created: true,
        active_engine_modified: false,
        engine_activation_requested: false,
      };
    }

    const contextResult = await buildAdoptedWritingSettlementContext({
      adopted_chapter_id: ensured.adopted_chapter_id,
      include_adopted_content: true,
      include_active_engine:
        rawInput.include_active_engine ?? rawInput.includeActiveEngine ?? true,
      include_writing_card:
        rawInput.include_writing_card ?? rawInput.includeWritingCard ?? true,
      include_proofing_card:
        rawInput.include_proofing_card ?? rawInput.includeProofingCard ?? true,
      include_longline:
        rawInput.include_longline ?? rawInput.includeLongline ?? true,
      retrieval_context: optionalObject(
        rawInput.retrieval_context ?? rawInput.retrievalContext,
        "retrieval_context",
      ),
      generation_context: optionalObject(
        rawInput.generation_context ?? rawInput.generationContext,
        "generation_context",
      ),
      include_foreshadowing_settlement_proposal_bridge:
        rawInput.include_foreshadowing_settlement_proposal_bridge
        ?? rawInput.includeForeshadowingSettlementProposalBridge
        ?? true,
      settlement_mode: "full",
    }, options);

    adoption = await latestAdoption(ensured.adopted_chapter_id, options);
    return {
      mode,
      ...publicAdoptionSummary(ensured, adoption),
      settlement_context_created: true,
      settlement_context_id: contextResult.context?.settlement_context_id ?? null,
      settlement_context: contextResult.context,
      settlement_context_path: contextResult.settlement_context_path,
      settlement_for_chat_path: contextResult.settlement_for_chat_path,
      settlement_report_created: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      engine_activation_requested: false,
      next_action:
        "Create the complete settlement report from settlement_context, "
        + "including a complete pending_engine_candidate Markdown section, "
        + "then call this tool again with mode=finalize and settlement_report_text.",
    };
  }

  const settlementReportText = requiredText(
    rawInput.settlement_report_text ?? rawInput.settlementReportText,
    "settlement_report_text",
    maximumReportChars,
  );
  if (!/##\s*pending_engine_candidate\b/iu.test(settlementReportText)) {
    throw new Error(
      "settlement_report_text must include a ## pending_engine_candidate section.",
    );
  }

  if (adoption.latest_pending_engine_candidate_id) {
    return {
      mode,
      idempotent_reuse: true,
      ...publicAdoptionSummary(ensured, adoption),
      settlement_context_created: false,
      settlement_report_created: Boolean(adoption.latest_settlement_report_id),
      pending_engine_candidate_created: true,
      active_engine_modified: false,
      engine_activation_requested: false,
    };
  }

  let settlementContextId = optionalText(
    rawInput.settlement_context_id ?? rawInput.settlementContextId,
    "settlement_context_id",
    300,
  ).trim() || adoption.latest_settlement_context_id || "";

  if (!settlementContextId) {
    const contextResult = await buildAdoptedWritingSettlementContext({
      adopted_chapter_id: ensured.adopted_chapter_id,
      include_adopted_content: true,
      include_active_engine: true,
      include_writing_card: true,
      include_proofing_card: true,
      include_longline: true,
      include_foreshadowing_settlement_proposal_bridge: true,
      settlement_mode: "full",
    }, options);
    settlementContextId = contextResult.context.settlement_context_id;
  }

  const reportResult = await saveChatOutputAsSettlementReport({
    adopted_chapter_id: ensured.adopted_chapter_id,
    settlement_context_id: settlementContextId,
    settlement_report_text: settlementReportText,
    summary: optionalText(rawInput.summary, "summary", 20_000),
    source: optionalText(rawInput.source, "source", 100).trim() || "chatgpt",
  }, options);

  const pendingResult = await buildPendingEngineCandidateFromSettlementReport({
    settlement_report_id: reportResult.settlement_report_id,
    adopted_chapter_id: ensured.adopted_chapter_id,
    reason:
      optionalText(rawInput.reason, "reason", 10_000).trim()
      || "Direct pasted chapter settlement explicitly requested by the user.",
  }, options);

  adoption = await latestAdoption(ensured.adopted_chapter_id, options);
  return {
    mode,
    ...publicAdoptionSummary(ensured, adoption),
    settlement_context_id: settlementContextId,
    settlement_report_created: reportResult.settlement_report_created === true,
    settlement_report_id: reportResult.settlement_report_id,
    settlement_report_path: reportResult.settlement_report_path,
    pending_engine_candidate_created:
      pendingResult.pending_engine_candidate_created === true,
    pending_engine_candidate_id:
      pendingResult.pending_engine_candidate_id
      ?? adoption.latest_pending_engine_candidate_id
      ?? null,
    pending_engine_candidate_path:
      pendingResult.pending_engine_candidate_path ?? null,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_required_for_engine_activation: true,
    next_action:
      "Review the pending engine candidate in Writer Workbench. "
      + "The active engine has not been modified or activated.",
  };
}

export async function finalizePreparedPastedChapter(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }

  const adoptedChapterId = requiredText(
    rawInput.adopted_chapter_id ?? rawInput.adoptedChapterId,
    "adopted_chapter_id",
    300,
  ).trim();
  const paths = adoptedPaths(adoptedChapterId, rootsFor(options));
  const chapterText = await readFile(paths.chapter, "utf8");

  return settlePastedChapter({
    ...rawInput,
    mode: "finalize",
    chapter_text: chapterText,
    user_confirmed_chapter_settlement: true,
  }, options);
}
