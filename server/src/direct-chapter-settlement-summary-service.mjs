import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
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
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      engine_activation_requested: false,
    };
  }

  const existing = await findExistingSummary(
    reportHash,
    options,
  );

  if (existing) {
    return {
      settlement_report_created: false,
      settlement_report_reused: true,
      settlement_report_id:
        existing.metadata.settlement_report_id,
      settlement_report_hash: reportHash,
      settlement_report_path:
        existing.metadata.content_path,
      settlement_report_meta_path:
        existing.metadata.metadata_path,
      report_kind:
        existing.metadata.report_kind,
      continuity_handoff_saved: true,
      full_chapter_persisted: false,
      adopted_chapter_created: false,
      writing_candidate_created: false,
      proof_report_created: false,
      adoption_requested: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      engine_activation_requested: false,
      next_action:
        "Use this settlement summary as the latest continuity handoff "
        + "when deciding whether the next chapter should continue directly, "
        + "jump in time, switch viewpoint, or open a new scene.",
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
    pending_engine_candidate_supported: false,
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

  return {
    settlement_report_created: true,
    settlement_report_reused: false,
    settlement_report_id: reportId,
    settlement_report_hash: reportHash,
    settlement_report_path: metadata.content_path,
    settlement_report_meta_path:
      metadata.metadata_path,
    report_kind: metadata.report_kind,
    continuity_handoff_saved: true,
    full_chapter_persisted: false,
    adopted_chapter_created: false,
    writing_candidate_created: false,
    proof_report_created: false,
    adoption_requested: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    engine_activation_requested: false,
    next_action:
      "Use this settlement summary as the latest continuity handoff "
      + "when deciding whether the next chapter should continue directly, "
      + "jump in time, switch viewpoint, or open a new scene.",
  };
}