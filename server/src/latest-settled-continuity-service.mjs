import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import {
  deriveDirectSettlementChapterIdentity,
} from "./direct-chapter-settlement-promotion-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const reportIdPattern =
  /^settlement_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const currentInputFiles = Object.freeze({
  task_prompt: "task_prompt.md",
  generation_context: "generation_context.md",
  retrieval_context: "retrieval_context.md",
});

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

function settlementReportsRoot(options = {}) {
  if (options.settlementReports) {
    return assertPathInside(
      options.settlementReports,
      projectPaths.outputs,
      "latest settled continuity reports test root",
    );
  }

  return projectPaths.adoptedWritingSettlementReports;
}

function currentInputsRoot(options = {}) {
  if (options.outputs) {
    return assertPathInside(
      options.outputs,
      projectPaths.outputs,
      "latest settled continuity current inputs test root",
    );
  }

  return projectPaths.outputs;
}

function reportPaths(root, reportId) {
  const directory = path.join(root, reportId);

  return {
    directory,
    report: path.join(directory, "settlement_report.md"),
    metadata: path.join(directory, "settlement_report.json"),
  };
}

function timestamp(value) {
  const result = Date.parse(String(value ?? ""));
  return Number.isFinite(result) ? result : null;
}

async function loadCandidate(root, entryName) {
  if (!reportIdPattern.test(entryName)) return null;

  const paths = reportPaths(root, entryName);

  try {
    const [metadataText, summaryText, reportStat] = await Promise.all([
      readFile(paths.metadata, "utf8"),
      readFile(paths.report, "utf8"),
      stat(paths.report),
    ]);
    const metadata = JSON.parse(metadataText);

    if (
      metadata.report_kind
        !== "direct_chapter_continuity_handoff"
      || metadata.continuity_handoff !== true
      || metadata.full_chapter_persisted === true
    ) {
      return null;
    }

    const normalizedSummary = summaryText.trim();
    if (!normalizedSummary) return null;

    const contentHash = sha256(normalizedSummary);
    const recordedHash = String(
      metadata.settlement_report_hash ?? "",
    ).trim();

    if (!recordedHash || contentHash !== recordedHash) {
      return {
        valid: false,
        report_id: entryName,
        warning:
          `Ignored settlement report with hash mismatch: ${entryName}`,
      };
    }

    const createdAt = metadata.created_at
      ?? reportStat.mtime.toISOString();
    const createdTimestamp = timestamp(createdAt)
      ?? reportStat.mtimeMs;
    const identity = deriveDirectSettlementChapterIdentity({
      summaryText: normalizedSummary,
      metadata,
    });

    return {
      valid: true,
      report_id: entryName,
      created_at: new Date(createdTimestamp).toISOString(),
      created_timestamp: createdTimestamp,
      settlement_report_hash: contentHash,
      summary_text: normalizedSummary,
      chapter: identity.chapter,
      chapter_number: identity.chapter_number,
      heading: identity.heading,
      display_heading: identity.display,
      continuity_head: identity.continuity_head,
      source: metadata.source ?? null,
      report_kind: metadata.report_kind,
      canon_status: metadata.canon_status
        ?? "settlement_report_only",
      settlement_status: metadata.settlement_status
        ?? "continuity_handoff_saved",
      continuity_handoff: true,
      full_chapter_persisted: false,
      content_path: normalizeProjectPath(paths.report),
      metadata_path: normalizeProjectPath(paths.metadata),
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;

    return {
      valid: false,
      report_id: entryName,
      warning:
        `Ignored unreadable settlement report ${entryName}: ${error.message}`,
    };
  }
}

export async function getLatestSettledContinuityOverlay(
  options = {},
) {
  const root = settlementReportsRoot(options);
  let entries = [];

  try {
    entries = await readdir(root, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;

    return {
      loaded: false,
      report_kind:
        "direct_chapter_continuity_handoff",
      warnings: [],
    };
  }

  const candidates = [];
  const warnings = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const candidate = await loadCandidate(
      root,
      entry.name,
    );

    if (!candidate) continue;
    if (candidate.valid !== true) {
      if (candidate.warning) warnings.push(candidate.warning);
      continue;
    }

    candidates.push(candidate);
  }

  candidates.sort((left, right) => (
    right.created_timestamp - left.created_timestamp
    || String(right.report_id)
      .localeCompare(String(left.report_id))
  ));

  const latest = candidates[0];

  if (!latest) {
    return {
      loaded: false,
      report_kind:
        "direct_chapter_continuity_handoff",
      warnings,
    };
  }

  const {
    valid,
    created_timestamp,
    ...publicLatest
  } = latest;

  return {
    loaded: true,
    ...publicLatest,
    authority:
      "latest_settled_continuity_overlay",
    precedence: [
      "current_user_instruction",
      "latest_settled_continuity_overlay",
      "active_engine_hard_canon",
      "older_generated_working_inputs",
    ],
    overrides_older_chapter_progress: true,
    does_not_modify_active_engine: true,
    warnings,
  };
}

async function inputFreshness(label, filePath, latestTimestamp) {
  try {
    const fileStat = await stat(filePath);
    const modifiedTimestamp = fileStat.mtimeMs;

    return {
      label,
      path: normalizeProjectPath(filePath),
      exists: true,
      modified_at: fileStat.mtime.toISOString(),
      stale_due_to_newer_settlement:
        modifiedTimestamp < latestTimestamp,
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;

    return {
      label,
      path: normalizeProjectPath(filePath),
      exists: false,
      modified_at: null,
      stale_due_to_newer_settlement: false,
    };
  }
}

export async function inspectCurrentInputSettlementFreshness(
  latestContinuity,
  options = {},
) {
  if (latestContinuity?.loaded !== true) {
    return {
      checked: false,
      newest_settlement_report_id: null,
      newest_settlement_created_at: null,
      stale_due_to_newer_settlement: false,
      inputs: {},
    };
  }

  const latestTimestamp = timestamp(
    latestContinuity.created_at,
  );

  if (latestTimestamp === null) {
    return {
      checked: false,
      newest_settlement_report_id:
        latestContinuity.report_id ?? null,
      newest_settlement_created_at:
        latestContinuity.created_at ?? null,
      stale_due_to_newer_settlement: false,
      inputs: {},
      warning:
        "Latest settlement created_at could not be parsed.",
    };
  }

  const root = currentInputsRoot(options);
  const records = await Promise.all(
    Object.entries(currentInputFiles)
      .map(([label, fileName]) => inputFreshness(
        label,
        path.join(root, fileName),
        latestTimestamp,
      )),
  );
  const inputs = Object.fromEntries(
    records.map((record) => [record.label, record]),
  );

  return {
    checked: true,
    newest_settlement_report_id:
      latestContinuity.report_id,
    newest_settlement_created_at:
      latestContinuity.created_at,
    stale_due_to_newer_settlement:
      records.some(
        (record) =>
          record.stale_due_to_newer_settlement === true,
      ),
    inputs,
  };
}

export function withLatestSettledContinuity(
  context,
  latestContinuity,
) {
  const sourceContext = (
    context
    && typeof context === "object"
    && !Array.isArray(context)
  )
    ? context
    : {};
  const {
    latest_settled_continuity: ignoredOlderContinuity,
    ...remainingContext
  } = sourceContext;
  void ignoredOlderContinuity;

  if (latestContinuity?.loaded !== true) {
    return { ...remainingContext };
  }

  return {
    latest_settled_continuity: {
      report_id: latestContinuity.report_id,
      created_at: latestContinuity.created_at,
      report_hash:
        latestContinuity.settlement_report_hash,
      chapter: latestContinuity.chapter,
      heading: latestContinuity.heading,
      display_heading: latestContinuity.display_heading,
      continuity_head: latestContinuity.continuity_head,
      authority: latestContinuity.authority,
      precedence: latestContinuity.precedence,
      overrides_older_chapter_progress: true,
      does_not_modify_active_engine: true,
      summary_text: latestContinuity.summary_text,
    },
    ...remainingContext,
  };
}

export function buildLatestSettledContinuityTaskGuard(
  latestContinuity,
  currentInputFreshness,
) {
  if (latestContinuity?.loaded !== true) return "";

  const staleLabels = Object.values(
    currentInputFreshness?.inputs ?? {},
  )
    .filter(
      (record) =>
        record.stale_due_to_newer_settlement === true,
    )
    .map((record) => record.label);
  const staleNotice = staleLabels.length
    ? ` Older generated inputs marked stale: ${staleLabels.join(", ")}.`
    : "";

  return [
    "[[LATEST_SETTLED_CONTINUITY_OVERRIDE]]",
    "The latest settled continuity in generation_context and retrieval_context overrides older chapter-progress wording in generated task/retrieval/context files.",
    `Latest settlement: ${latestContinuity.display_heading ?? latestContinuity.heading ?? latestContinuity.chapter ?? latestContinuity.report_id}.`,
    `Report id: ${latestContinuity.report_id}.${staleNotice}`,
    "Keep active_engine hard setting boundaries, but do not roll chapter continuity back behind this settlement.",
  ].join("\n");
}

export function serializeLatestSettledContinuityFixedGuard(
  latestContinuity,
  currentInputFreshness,
) {
  if (latestContinuity?.loaded !== true) return "";

  const freshnessLines = Object.values(
    currentInputFreshness?.inputs ?? {},
  ).map((record) => (
    `- ${record.label}: exists=${record.exists}, stale_due_to_newer_settlement=${record.stale_due_to_newer_settlement}, modified_at=${record.modified_at ?? "none"}`
  ));

  return [
    "## 【P0｜最新章節結算承接鎖】",
    "",
    `- settlement report: ${latestContinuity.report_id}`,
    `- latest chapter: ${latestContinuity.display_heading ?? latestContinuity.heading ?? latestContinuity.chapter ?? "unknown"}`,
    `- created at: ${latestContinuity.created_at}`,
    "- authority: latest settled continuity overlay",
    "- precedence: current user instruction > latest settled continuity > active_engine hard canon > older generated working inputs",
    "- active_engine mutation: forbidden by this overlay",
    "- continuity rollback: forbidden",
    ...(freshnessLines.length
      ? ["- generated input freshness:", ...freshnessLines]
      : []),
    "",
    latestContinuity.summary_text,
  ].join("\n");
}
