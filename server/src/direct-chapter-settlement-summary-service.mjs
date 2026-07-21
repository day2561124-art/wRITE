import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createDirectSettlementPromotionCandidate,
  deriveDirectSettlementChapterIdentity,
} from "./direct-chapter-settlement-promotion-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const reportIdPattern =
  /^settlement_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const allowedSources = new Set([
  "chatgpt",
  "gpt",
  "manual_paste",
]);

const maximumSummaryChars = 3_800;

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

function stamp(date = new Date()) {
  const compact = date
    .toISOString()
    .replace(/\D/gu, "")
    .slice(0, 14);

  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maximumLength) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  const text = value.trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (text.length > maximumLength) {
    throw new Error(
      `${label} exceeds ${maximumLength} characters.`,
    );
  }

  return text;
}

function optionalText(value, label, maximumLength) {
  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  if (value.length > maximumLength) {
    throw new Error(
      `${label} exceeds ${maximumLength} characters.`,
    );
  }

  return value.trim();
}

function optionalBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new Error("Boolean option must be true or false.");
  }
  return value;
}

function identityMetadata(identity = {}) {
  return {
    chapter: identity.chapter ?? null,
    chapter_number: identity.chapter_number ?? null,
    heading: identity.heading ?? null,
    continuity_head: identity.continuity_head ?? null,
    chapter_identity_complete: identity.complete === true,
  };
}

function rootsFor(options = {}) {
  const settlementReports = options.settlementReports
    ? assertPathInside(
      options.settlementReports,
      projectPaths.outputs,
      "direct chapter settlement summary reports test root",
    )
    : projectPaths.adoptedWritingSettlementReports;

  return { settlementReports };
}

function reportPaths(reportId, roots) {
  if (!reportIdPattern.test(String(reportId ?? ""))) {
    throw new Error("Invalid settlement_report_id.");
  }

  const directory = path.join(
    roots.settlementReports,
    reportId,
  );

  return {
    directory,
    report: path.join(
      directory,
      "settlement_report.md",
    ),
    metadata: path.join(
      directory,
      "settlement_report.json",
    ),
  };
}

function validateContinuitySummary(summaryText) {
  const requiredSections = [
    /^##[ \t]*已發生[ \t]*$/imu,
    /^##[ \t]*角色狀態[ \t]*$/imu,
    /^##[ \t]*關係(?:與立場)?變化[ \t]*$/imu,
    /^##[ \t]*(?:待承接|未收事項)[ \t]*$/imu,
    /^##[ \t]*下一章(?:銜接|轉場)?判斷[ \t]*$/imu,
  ];

  const matchedSectionCount = requiredSections
    .filter((pattern) => pattern.test(summaryText))
    .length;

  if (matchedSectionCount < 4) {
    throw new Error(
      "Chapter settlement summary must contain at least four continuity "
      + "sections: 已發生、角色狀態、關係變化、待承接／未收事項、"
      + "下一章銜接判斷。",
    );
  }

  if (/^[「『].*[」』]$/mu.test(summaryText)) {
    throw new Error(
      "Chapter settlement must be a continuity summary, not pasted prose.",
    );
  }
}

async function findExistingSummary(reportHash, options = {}) {
  const roots = rootsFor(options);

  await mkdir(roots.settlementReports, {
    recursive: true,
  });

  const entries = await readdir(
    roots.settlementReports,
    { withFileTypes: true },
  );

  for (const entry of entries) {
    if (
      !entry.isDirectory()
      || !reportIdPattern.test(entry.name)
    ) {
      continue;
    }

    const paths = reportPaths(entry.name, roots);

    try {
      const metadata = JSON.parse(
        await readFile(paths.metadata, "utf8"),
      );

      if (
        metadata.report_kind
          === "direct_chapter_continuity_handoff"
        && metadata.settlement_report_hash === reportHash
      ) {
        return {
          metadata,
          paths,
        };
      }
    } catch {
      // Ignore incomplete or unrelated report records.
    }
  }

  return null;
}

export async function saveDirectChapterSettlementSummary(
  rawInput = {},
  options = {},
) {
  if (
    !rawInput
    || typeof rawInput !== "object"
    || Array.isArray(rawInput)
  ) {
    throw new Error("input must be an object.");
  }

  const summaryText = requiredText(
    rawInput.settlement_summary_text
      ?? rawInput.settlementSummaryText
      ?? rawInput.settlement_report_text
      ?? rawInput.settlementReportText,
    "settlement_summary_text",
    maximumSummaryChars,
  );

  validateContinuitySummary(summaryText);

  const source = optionalText(
    rawInput.source,
    "source",
    100,
  ) || "chatgpt";

  if (!allowedSources.has(source)) {
    throw new Error(`Unknown source: ${source}`);
  }

  const summary = optionalText(
    rawInput.summary,
    "summary",
    1_000,
  );
  const explicitChapter = optionalText(
    rawInput.chapter ?? rawInput.chapter_id ?? rawInput.chapterId,
    "chapter",
    100,
  );
  const explicitHeading = optionalText(
    rawInput.heading ?? rawInput.chapter_heading ?? rawInput.chapterHeading,
    "heading",
    300,
  );
  const createPendingEngineCandidate = optionalBoolean(
    rawInput.create_pending_engine_candidate
      ?? rawInput.createPendingEngineCandidate,
    false,
  );
  const identity = deriveDirectSettlementChapterIdentity({
    summaryText,
    explicitChapter,
    explicitHeading,
    metadata: { summary },
  });

  const reportHash = sha256(summaryText);
  const dryRun =
    rawInput.dry_run === true
    || rawInput.dryRun === true;

  if (dryRun) {
    return {
      dry_run: true,
      settlement_report_created: false,
      settlement_report_reused: false,
      settlement_report_hash: reportHash,
      report_kind:
        "direct_chapter_continuity_handoff",
      continuity_handoff_saved: false,
      full_chapter_persisted: false,
      adopted_chapter_created: false,
      writing_candidate_created: false,
      proof_report_created: false,
      adoption_requested: false,
      pending_engine_candidate_supported: true,
      pending_engine_candidate_created: false,
      chapter: identity.chapter,
      chapter_number: identity.chapter_number,
      heading: identity.heading,
      continuity_head: identity.continuity_head,
      active_engine_modified: false,
      engine_activation_requested: false,
    };
  }

  const existing = await findExistingSummary(
    reportHash,
    options,
  );

  if (existing) {
    const enrichedIdentity = deriveDirectSettlementChapterIdentity({
      summaryText,
      explicitChapter,
      explicitHeading,
      metadata: existing.metadata,
    });
    let metadata = {
      ...existing.metadata,
      ...identityMetadata(enrichedIdentity),
      pending_engine_candidate_supported: true,
    };
    let promotion = null;

    if (
      createPendingEngineCandidate
      && metadata.pending_engine_candidate_created !== true
    ) {
      promotion = await createDirectSettlementPromotionCandidate({
        settlementReportId: metadata.settlement_report_id,
        settlementSummary: summaryText,
        metadata,
        explicitChapter,
        explicitHeading,
      }, options);
      metadata = {
        ...metadata,
        canon_status: "settlement_candidate_pending_review",
        settlement_status: "pending_engine_candidate",
        pending_engine_candidate_created: true,
        pending_engine_candidate_id:
          promotion.pending_engine_candidate_id,
        pending_engine_candidate_path:
          promotion.pending_engine_candidate_path,
        current_input_refresh_prepared:
          promotion.current_input_refresh_prepared === true,
        active_engine_update_allowed: false,
        active_engine_modified: false,
        engine_activation_requested: false,
        approval_item_created: false,
      };
    }

    if (
      JSON.stringify(metadata)
      !== JSON.stringify(existing.metadata)
    ) {
      await commitFileTransaction(
        "enrich-direct-chapter-continuity-handoff",
        [{
          filePath: existing.paths.metadata,
          content: `${JSON.stringify(metadata, null, 2)}\n`,
        }],
        {
          settlement_report_id: metadata.settlement_report_id,
          pending_engine_candidate_id:
            metadata.pending_engine_candidate_id ?? null,
          phase: "phase_52a_direct_settlement_promotion",
        },
      );
    }

    return {
      settlement_report_created: false,
      settlement_report_reused: true,
      settlement_report_id:
        metadata.settlement_report_id,
      settlement_report_hash: reportHash,
      settlement_report_path:
        metadata.content_path,
      settlement_report_meta_path:
        metadata.metadata_path,
      report_kind:
        metadata.report_kind,
      continuity_handoff_saved: true,
      ...identityMetadata(enrichedIdentity),
      full_chapter_persisted: false,
      adopted_chapter_created: false,
      writing_candidate_created: false,
      proof_report_created: false,
      adoption_requested: false,
      pending_engine_candidate_supported: true,
      pending_engine_candidate_created:
        metadata.pending_engine_candidate_created === true,
      pending_engine_candidate_id:
        metadata.pending_engine_candidate_id ?? null,
      pending_engine_candidate_path:
        metadata.pending_engine_candidate_path ?? null,
      current_input_refresh_prepared:
        metadata.current_input_refresh_prepared === true,
      active_engine_modified: false,
      engine_activation_requested: false,
      approval_item_created: false,
      next_action: metadata.pending_engine_candidate_created === true
        ? "Review the pending engine candidate, request activation, and explicitly confirm it. active_engine remains unchanged until approval."
        : "The next writing-context build will load this as the latest settled continuity overlay. No formal engine candidate was requested.",
    };
  }

  const roots = rootsFor(options);
  const reportId = createId("settlement_report");
  const paths = reportPaths(reportId, roots);
  const createdAt = new Date().toISOString();

  const metadata = {
    settlement_report_id: reportId,
    report_kind:
      "direct_chapter_continuity_handoff",
    created_at: createdAt,
    source,
    adopted_chapter_id: null,
    candidate_id: null,
    proof_report_id: null,
    settlement_context_id: null,
    settlement_report_hash: reportHash,
    summary,
    ...identityMetadata(identity),
    canon_status: "settlement_report_only",
    settlement_status:
      "continuity_handoff_saved",
    continuity_handoff: true,
    continuity_source:
      "user_completed_chapter_read_in_chat",
    full_chapter_persisted: false,
    adopted_chapter_created: false,
    writing_candidate_created: false,
    proof_report_created: false,
    adoption_requested: false,
    pending_engine_candidate_supported: true,
    pending_engine_candidate_created: false,
    pending_engine_candidate_id: null,
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_item_created: false,
    content_path: normalizeProjectPath(paths.report),
    metadata_path: normalizeProjectPath(paths.metadata),
  };

  await mkdir(roots.settlementReports, {
    recursive: true,
  });

  await commitFileTransaction(
    "save-direct-chapter-continuity-handoff",
    [
      {
        filePath: paths.report,
        content: `${summaryText}\n`,
      },
      {
        filePath: paths.metadata,
        content:
          `${JSON.stringify(metadata, null, 2)}\n`,
      },
    ],
    {
      settlement_report_id: reportId,
      report_kind:
        "direct_chapter_continuity_handoff",
      phase:
        "phase_49a_settlement_summary_contract",
    },
  );

  let finalMetadata = metadata;
  if (createPendingEngineCandidate) {
    const promotion = await createDirectSettlementPromotionCandidate({
      settlementReportId: reportId,
      settlementSummary: summaryText,
      metadata,
      explicitChapter,
      explicitHeading,
    }, options);
    finalMetadata = {
      ...metadata,
      canon_status: "settlement_candidate_pending_review",
      settlement_status: "pending_engine_candidate",
      pending_engine_candidate_created: true,
      pending_engine_candidate_id:
        promotion.pending_engine_candidate_id,
      pending_engine_candidate_path:
        promotion.pending_engine_candidate_path,
      current_input_refresh_prepared:
        promotion.current_input_refresh_prepared === true,
      active_engine_update_allowed: false,
      active_engine_modified: false,
      engine_activation_requested: false,
      approval_item_created: false,
    };
    await commitFileTransaction(
      "link-direct-chapter-settlement-promotion",
      [{
        filePath: paths.metadata,
        content: `${JSON.stringify(finalMetadata, null, 2)}\n`,
      }],
      {
        settlement_report_id: reportId,
        pending_engine_candidate_id:
          promotion.pending_engine_candidate_id,
        phase: "phase_52a_direct_settlement_promotion",
      },
    );
  }

  return {
    settlement_report_created: true,
    settlement_report_reused: false,
    settlement_report_id: reportId,
    settlement_report_hash: reportHash,
    settlement_report_path: metadata.content_path,
    settlement_report_meta_path:
      metadata.metadata_path,
    report_kind: finalMetadata.report_kind,
    continuity_handoff_saved: true,
    ...identityMetadata(identity),
    full_chapter_persisted: false,
    adopted_chapter_created: false,
    writing_candidate_created: false,
    proof_report_created: false,
    adoption_requested: false,
    pending_engine_candidate_supported: true,
    pending_engine_candidate_created:
      finalMetadata.pending_engine_candidate_created === true,
    pending_engine_candidate_id:
      finalMetadata.pending_engine_candidate_id ?? null,
    pending_engine_candidate_path:
      finalMetadata.pending_engine_candidate_path ?? null,
    current_input_refresh_prepared:
      finalMetadata.current_input_refresh_prepared === true,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_item_created: false,
    next_action: finalMetadata.pending_engine_candidate_created === true
      ? "Review the pending engine candidate, request activation, and explicitly confirm it. active_engine remains unchanged until approval."
      : "The next writing-context build will load this as the latest settled continuity overlay. No formal engine candidate was requested.",
  };
}