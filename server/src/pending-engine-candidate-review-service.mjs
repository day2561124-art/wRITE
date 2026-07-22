import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createApprovalItem } from "./approval-queue-service.mjs";
import {
  assertEngineCandidateId,
  generateEngineDiff,
  getPendingCandidate,
} from "./engine-candidate-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const reviewIdPattern = /^engine_review_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const reviewModes = new Set(["full", "diff_only", "summary_only"]);
const riskLevels = new Set(["medium", "high"]);
const defaultMaxContextChars = 120_000;
const maximumContextChars = 250_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createReviewId() {
  return `engine_review_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength = 5_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function optionalInteger(value, fallback, label, maximum) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function rootsFor(options = {}) {
  const engineCandidateReviews = options.engineCandidateReviews
    ? assertPathInside(
      options.engineCandidateReviews,
      projectPaths.outputs,
      "engine candidate reviews test root",
    )
    : projectPaths.engineCandidateReviews;
  const pendingEngineCandidates = options.pendingEngineCandidates
    ? assertPathInside(
      options.pendingEngineCandidates,
      projectPaths.canonDb,
      "pending engine candidates test root",
    )
    : projectPaths.pendingEngineCandidates;
  const activeEngine = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  return { engineCandidateReviews, pendingEngineCandidates, activeEngine };
}

function candidatePaths(candidateId, roots) {
  assertEngineCandidateId(candidateId);
  const directory = path.join(roots.pendingEngineCandidates, candidateId);
  return {
    directory,
    candidate: path.join(directory, "candidate_engine.md"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
  };
}

function reviewPaths(reviewId, roots) {
  if (!reviewIdPattern.test(String(reviewId ?? ""))) {
    throw new Error("Invalid review_id.");
  }
  const directory = path.join(roots.engineCandidateReviews, reviewId);
  return {
    directory,
    review: path.join(directory, "review.json"),
    ui: path.join(directory, "review_for_ui.md"),
    diff: path.join(directory, "diff.md"),
  };
}

function assertReviewable(candidate) {
  if (candidate.status.status === "activated") {
    throw new Error("Activated candidate cannot be reviewed.");
  }
  if (candidate.status.status !== "candidate") {
    throw new Error(
      `Pending engine candidate is not reviewable: ${candidate.status.blocked_reason || candidate.status.status}`,
    );
  }
  const reviewStatus = candidate.metadata.review_status
    ?? candidate.status.review_status
    ?? candidate.status.settlement_status;
  if (reviewStatus && reviewStatus !== "pending_review") {
    throw new Error(`Pending engine candidate review status is ${reviewStatus}.`);
  }
  if (!candidate.metadata.base_active_engine_hash) {
    throw new Error("Pending engine candidate has no base_active_engine_hash.");
  }
}

function diffSummary(diff) {
  return [
    `${diff.summary.added_count} added`,
    `${diff.summary.deleted_count} deleted`,
    `${diff.summary.modified_count} modified`,
  ].join(", ");
}

function allocate(text, maxChars, reference) {
  if (text.length <= maxChars) return { text, truncated: false };
  const suffix = `\n\n[truncated; source=${reference}]`;
  return {
    text: `${text.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`,
    truncated: true,
  };
}

function reviewMarkdown(review, content) {
  return [
    "# Pending Engine Candidate Review",
    "",
    "## Candidate",
    `- pending_engine_candidate_id: ${review.pending_engine_candidate_id}`,
    `- source settlement_report_id: ${review.settlement_report_id ?? ""}`,
    `- source adopted_chapter_id: ${review.adopted_chapter_id ?? ""}`,
    `- status: ${review.candidate_status}`,
    "",
    "## Hash Check",
    `- base_active_engine_hash: ${review.base_active_engine_hash}`,
    `- current_active_engine_hash: ${review.current_active_engine_hash}`,
    `- base_hash_mismatch: ${review.base_hash_mismatch}`,
    `- candidate_engine_hash_sha256: ${review.candidate_engine_hash_sha256}`,
    `- metadata_candidate_hash: ${review.metadata_candidate_hash}`,
    `- candidate_hash_match: ${review.candidate_hash_match}`,
    "",
    "## Lineage",
    `- lineage_mode: ${review.lineage?.lineage_mode ?? ""}`,
    `- lineage_complete: ${review.lineage?.lineage_complete === true}`,
    `- adopted workflow applicable: ${review.lineage?.legacy_adopted_writing_workflow_applicable !== false}`,
    "",
    "## Activation Write Manifest",
    ...((review.activation_write_manifest?.will_modify ?? []).map((item) => `- modify: ${item}`)),
    ...((review.activation_write_manifest?.will_create ?? []).map((item) => `- create: ${item}`)),
    `- rollback_available: ${review.activation_write_manifest?.rollback_available === true}`,
    "",
    "## Summary",
    review.summary,
    "",
    "## Active Engine vs Candidate",
    content.diff || "[diff omitted]",
    "",
    "## Active Engine",
    content.active_engine || "[active engine omitted]",
    "",
    "## Pending Candidate Engine",
    content.candidate_engine || "[candidate engine omitted]",
    "",
    "## Settlement Report",
    content.settlement_report || "[settlement report omitted]",
    "",
    "## Source Adopted Writing",
    content.source_adopted_writing || "[adopted writing omitted]",
    "",
    "## Safety",
    "- This review does not modify active_engine.",
    "- This review does not activate the candidate.",
    "- Activation requires approval queue / UI confirmation.",
    "",
    "## Next Action",
    "The user may explicitly create an engine activation approval request.",
    "Do not directly activate active_engine.",
    "",
  ].join("\n");
}

function diffMarkdown(review, diff) {
  return [
    "# Active Engine vs Pending Engine Candidate Diff",
    "",
    "## Active Engine Hash",
    review.current_active_engine_hash,
    "",
    "## Pending Candidate Base Hash",
    review.base_active_engine_hash,
    "",
    "## Pending Candidate Content Hash",
    review.candidate_engine_hash_sha256,
    "",
    "## Candidate Proposed Changes",
    `- Added lines: ${diff.summary.added_count}`,
    `- Deleted lines: ${diff.summary.deleted_count}`,
    `- Modified lines: ${diff.summary.modified_count}`,
    "",
    "## Diff Summary",
    "```diff",
    diff.raw_unified_diff.trimEnd(),
    "```",
    "",
    "## Risk Notes",
    `- Candidate risk level: ${review.risk_level}`,
    `- Base hash mismatch: ${review.base_hash_mismatch}`,
    ...review.warnings.map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

async function optionalSource(filePath, included) {
  if (!included || !filePath) return "";
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export async function buildPendingEngineCandidateReview(rawInput, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const reviewMode = optionalText(
    rawInput.review_mode ?? rawInput.reviewMode,
    "review_mode",
    100,
  ) || "full";
  if (!reviewModes.has(reviewMode)) throw new Error(`Unknown review_mode: ${reviewMode}`);
  const input = {
    candidateId: requiredText(
      rawInput.pending_engine_candidate_id ?? rawInput.pendingEngineCandidateId,
      "pending_engine_candidate_id",
    ),
    includeActiveEngine: optionalBoolean(
      rawInput.include_active_engine ?? rawInput.includeActiveEngine,
      reviewMode === "full",
      "include_active_engine",
    ),
    includeCandidateEngine: optionalBoolean(
      rawInput.include_candidate_engine ?? rawInput.includeCandidateEngine,
      reviewMode === "full",
      "include_candidate_engine",
    ),
    includeDiff: optionalBoolean(
      rawInput.include_diff ?? rawInput.includeDiff,
      reviewMode !== "summary_only",
      "include_diff",
    ),
    includeSettlementReport: optionalBoolean(
      rawInput.include_settlement_report ?? rawInput.includeSettlementReport,
      reviewMode === "full",
      "include_settlement_report",
    ),
    includeSourceAdoptedWriting: optionalBoolean(
      rawInput.include_source_adopted_writing ?? rawInput.includeSourceAdoptedWriting,
      reviewMode === "full",
      "include_source_adopted_writing",
    ),
    reviewMode,
    maxContextChars: optionalInteger(
      rawInput.max_context_chars ?? rawInput.maxContextChars,
      defaultMaxContextChars,
      "max_context_chars",
      maximumContextChars,
    ),
  };
  const roots = rootsFor(options);
  const candidate = await getPendingCandidate(input.candidateId, options);
  assertReviewable(candidate);
  const paths = candidatePaths(input.candidateId, roots);
  const [activeText, candidateText] = await Promise.all([
    readFile(roots.activeEngine, "utf8"),
    readFile(paths.candidate, "utf8"),
  ]);
  const currentHash = sha256(activeText);
  const baseHash = candidate.metadata.base_active_engine_hash;
  const baseHashMismatch = currentHash !== baseHash;
  const candidateEngineHash = sha256(candidateText.trimEnd());
  const metadataCandidateHash = candidate.metadata.candidate_engine_hash_sha256
    ?? candidate.metadata.candidate_hash
    ?? null;
  const candidateHashMatch = metadataCandidateHash
    ? metadataCandidateHash === candidateEngineHash
    : null;
  const diff = generateEngineDiff(activeText, candidateText);
  const warnings = [];
  if (baseHashMismatch) {
    warnings.push("Current active_engine hash differs from the candidate base hash.");
  }
  if (candidate.risk_report.risk_level === "high") {
    warnings.push("Candidate risk assessment is high.");
  }
  if (candidateHashMatch === false) {
    warnings.push("candidate_engine.md hash differs from candidate metadata.");
  }
  const settlementReportPath = candidate.metadata.settlement_report_id
    ? path.join(
      options.settlementReports ?? projectPaths.adoptedWritingSettlementReports,
      candidate.metadata.settlement_report_id,
      "settlement_report.md",
    )
    : "";
  const adoptedWritingPath = candidate.metadata.adopted_chapter_id
    ? path.join(
      options.adoptedWritings ?? projectPaths.adoptedWritings,
      candidate.metadata.adopted_chapter_id,
      "chapter.md",
    )
    : "";
  const [settlementReport, adoptedWriting] = await Promise.all([
    optionalSource(settlementReportPath, input.includeSettlementReport),
    optionalSource(adoptedWritingPath, input.includeSourceAdoptedWriting),
  ]);
  const fullContent = {
    active_engine: input.includeActiveEngine ? activeText : "",
    candidate_engine: input.includeCandidateEngine ? candidateText : "",
    diff: input.includeDiff ? diff.raw_unified_diff : "",
    settlement_report: settlementReport,
    source_adopted_writing: adoptedWriting,
  };
  let remaining = input.maxContextChars;
  const content = {};
  const truncatedSections = [];
  for (const [key, text] of Object.entries(fullContent)) {
    const allocated = allocate(String(text), remaining, key);
    content[key] = allocated.text;
    if (allocated.truncated) truncatedSections.push(key);
    remaining = Math.max(0, remaining - content[key].length);
  }
  if (truncatedSections.length) {
    warnings.push(`Review content truncated: ${truncatedSections.join(", ")}`);
  }
  const reviewId = createReviewId();
  const reviewPathsForId = reviewPaths(reviewId, roots);
  const review = {
    review_id: reviewId,
    review_kind: "pending_engine_candidate_review",
    created_at: new Date().toISOString(),
    source: "pending_engine_candidate_review_service",
    pending_engine_candidate_id: input.candidateId,
    settlement_report_id: candidate.metadata.settlement_report_id ?? null,
    settlement_context_id: candidate.metadata.settlement_context_id ?? null,
    adopted_chapter_id: candidate.metadata.adopted_chapter_id ?? null,
    base_active_engine_hash: baseHash,
    current_active_engine_hash: currentHash,
    base_hash_mismatch: baseHashMismatch,
    candidate_engine_hash_sha256: candidateEngineHash,
    metadata_candidate_hash: metadataCandidateHash,
    candidate_hash_match: candidateHashMatch,
    candidate_title: candidate.metadata.candidate_title
      ?? candidateText.split(/\r?\n/u).find((line) => line.trim())?.trim()
      ?? null,
    target_engine_version: candidate.metadata.target_engine_version
      ?? candidateText.match(/v\d+(?:\.\d+){1,3}/u)?.[0]
      ?? null,
    chapter: candidate.metadata.chapter ?? null,
    chapter_number: candidate.metadata.chapter_number ?? null,
    heading: candidate.metadata.heading ?? null,
    continuity_head: candidate.metadata.continuity_head ?? null,
    lineage: candidate.metadata.source_lineage ?? {
      lineage_mode: candidate.metadata.lineage_mode ?? null,
      lineage_complete: candidate.metadata.lineage_complete === true,
      settlement_report_id: candidate.metadata.settlement_report_id ?? null,
      settlement_context_id: candidate.metadata.settlement_context_id ?? null,
      adopted_chapter_id: candidate.metadata.adopted_chapter_id ?? null,
    },
    activation_write_manifest: candidate.metadata.activation_write_manifest ?? {
      will_modify: [
        "data/canon_db/active_engine.md",
        ...(candidate.metadata.current_input_refresh ? [
          "data/outputs/task_prompt.md",
          "data/outputs/generation_context.md",
          "data/outputs/retrieval_context.md",
        ] : []),
        ...(candidate.metadata.settlement_report_metadata_path
          ? [candidate.metadata.settlement_report_metadata_path]
          : []),
      ],
      will_create: ["snapshot", "archive", "activation_log"],
      rollback_available: true,
      requires_user_confirmation: true,
      requires_second_confirmation:
        candidate.risk_report.requires_second_confirmation === true,
    },
    current_input_refresh_manifest: candidate.metadata.current_input_refresh ?? null,
    settlement_status_transition: candidate.metadata.settlement_report_metadata_path
      ? {
        metadata_path: candidate.metadata.settlement_report_metadata_path,
        from: "pending_review",
        to: "formal_canon_activated",
        occurs_only_after_explicit_activation: true,
      }
      : null,
    candidate_status: candidate.metadata.review_status ?? "pending_review",
    engine_candidate_status: candidate.status.status,
    risk_level: candidate.risk_report.risk_level,
    summary: diffSummary(diff),
    diff_summary: diff.summary,
    active_engine_modified: false,
    engine_activation_requested: false,
    activation_approval_item_id: null,
    can_activate_directly: false,
    requires_user_confirmation_for_activation: true,
    review_mode: input.reviewMode,
    paths: {
      review_for_ui: normalizeProjectPath(reviewPathsForId.ui),
      diff: normalizeProjectPath(reviewPathsForId.diff),
    },
    content_included: {
      active_engine: input.includeActiveEngine,
      candidate_engine: input.includeCandidateEngine,
      diff: input.includeDiff,
      settlement_report: input.includeSettlementReport,
      source_adopted_writing: input.includeSourceAdoptedWriting,
    },
    context_chars_used: input.maxContextChars - remaining,
    max_context_chars: input.maxContextChars,
    truncated_sections: truncatedSections,
    warnings,
    safety: {
      active_engine_modified: false,
      activation_performed: false,
      approval_item_created: false,
    },
  };
  const nextMetadata = {
    ...candidate.metadata,
    latest_review_id: reviewId,
    review_ids: [...new Set([...(candidate.metadata.review_ids ?? []), reviewId])],
    review_status: "pending_review",
    active_engine_modified: false,
    activation_requested: candidate.metadata.activation_requested === true,
  };
  await mkdir(roots.engineCandidateReviews, { recursive: true });
  await commitFileTransaction("build-pending-engine-candidate-review", [
    { filePath: reviewPathsForId.review, content: `${JSON.stringify(review, null, 2)}\n` },
    { filePath: reviewPathsForId.ui, content: reviewMarkdown(review, content) },
    { filePath: reviewPathsForId.diff, content: diffMarkdown(review, diff) },
    { filePath: paths.metadata, content: `${JSON.stringify(nextMetadata, null, 2)}\n` },
  ], {
    review_id: reviewId,
    pending_engine_candidate_id: input.candidateId,
    phase: "phase_8h_pending_engine_candidate_review",
  });
  if (sha256(await readFile(roots.activeEngine, "utf8")) !== currentHash) {
    throw new Error("Safety violation: active_engine.md changed while building review.");
  }
  return {
    review,
    review_path: normalizeProjectPath(reviewPathsForId.review),
    review_for_ui_path: normalizeProjectPath(reviewPathsForId.ui),
    diff_path: normalizeProjectPath(reviewPathsForId.diff),
  };
}

export async function getPendingEngineCandidateReview(reviewId, options = {}) {
  const roots = rootsFor(options);
  const paths = reviewPaths(reviewId, roots);
  const review = await readFile(paths.review, "utf8").then(JSON.parse);
  const includeContent = options.includeContent === true || options.include_content === true;
  const maxContentChars = optionalInteger(
    options.maxContentChars ?? options.max_content_chars,
    12_000,
    "max_content_chars",
    50_000,
  );
  let reviewForUi = null;
  let diff = null;
  let contentTruncated = false;
  if (includeContent) {
    const combined = [
      await readFile(paths.ui, "utf8"),
      await readFile(paths.diff, "utf8"),
    ];
    const allocatedUi = allocate(combined[0], maxContentChars, review.paths.review_for_ui);
    const remaining = Math.max(0, maxContentChars - allocatedUi.text.length);
    const allocatedDiff = allocate(combined[1], remaining, review.paths.diff);
    reviewForUi = allocatedUi.text;
    diff = allocatedDiff.text;
    contentTruncated = allocatedUi.truncated || allocatedDiff.truncated;
  }
  return {
    review,
    review_for_ui: reviewForUi,
    diff,
    content_included: includeContent,
    content_truncated: contentTruncated,
    review_path: normalizeProjectPath(paths.review),
    review_for_ui_path: normalizeProjectPath(paths.ui),
    diff_path: normalizeProjectPath(paths.diff),
  };
}

export async function listPendingEngineCandidateReviews(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const candidateId = optionalText(
    input.pending_engine_candidate_id ?? input.pendingEngineCandidateId,
    "pending_engine_candidate_id",
    200,
  );
  const status = optionalText(input.status, "status", 100);
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const roots = rootsFor(options);
  await mkdir(roots.engineCandidateReviews, { recursive: true });
  const entries = await readdir(roots.engineCandidateReviews, { withFileTypes: true });
  const reviews = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !reviewIdPattern.test(entry.name)) continue;
    try {
      const detail = await getPendingEngineCandidateReview(entry.name, options);
      const review = detail.review;
      if (candidateId && review.pending_engine_candidate_id !== candidateId) continue;
      if (status && review.candidate_status !== status) continue;
      reviews.push(review);
    } catch {
      // Ignore incomplete review records.
    }
  }
  return reviews
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}

export async function requestPendingEngineCandidateActivation(rawInput, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const riskLevel = optionalText(
    rawInput.risk_level ?? rawInput.riskLevel,
    "risk_level",
    100,
  ) || "medium";
  if (!riskLevels.has(riskLevel)) throw new Error(`Unknown risk_level: ${riskLevel}`);
  const input = {
    candidateId: requiredText(
      rawInput.pending_engine_candidate_id ?? rawInput.pendingEngineCandidateId,
      "pending_engine_candidate_id",
    ),
    reviewId: optionalText(rawInput.review_id ?? rawInput.reviewId, "review_id", 200),
    reason: optionalText(rawInput.reason, "reason", 5_000),
    requestedBy: optionalText(
      rawInput.requested_by ?? rawInput.requestedBy,
      "requested_by",
      200,
    ) || "local_user",
    riskLevel,
    allowBaseHashMismatch:
      rawInput.allow_base_hash_mismatch === true || rawInput.allowBaseHashMismatch === true,
    dryRun: rawInput.dry_run === true || rawInput.dryRun === true,
  };
  const roots = rootsFor(options);
  const candidate = await getPendingCandidate(input.candidateId, options);
  assertReviewable(candidate);
  const reviewDetail = input.reviewId
    ? await getPendingEngineCandidateReview(input.reviewId, options)
    : await buildPendingEngineCandidateReview({
      pendingEngineCandidateId: input.candidateId,
      reviewMode: "summary_only",
    }, options);
  const review = reviewDetail.review;
  if (review.pending_engine_candidate_id !== input.candidateId) {
    throw new Error("review_id does not belong to pending_engine_candidate_id.");
  }
  const currentActiveHash = sha256(await readFile(roots.activeEngine, "utf8"));
  const candidateFileText = await readFile(
    candidatePaths(input.candidateId, roots).candidate,
    "utf8",
  );
  const currentCandidateHash = sha256(candidateFileText.trimEnd());
  const expectedCandidateHash = candidate.metadata.candidate_engine_hash_sha256
    ?? candidate.metadata.candidate_hash
    ?? null;
  if (!expectedCandidateHash || currentCandidateHash !== expectedCandidateHash) {
    throw new Error("candidate_engine.md hash mismatch; activation request is blocked.");
  }
  const baseHashMismatch = currentActiveHash !== candidate.metadata.base_active_engine_hash;
  if (baseHashMismatch && !input.allowBaseHashMismatch) {
    throw new Error("active_engine base hash mismatch; activation request is blocked.");
  }
  const effectiveRisk = baseHashMismatch
    || candidate.risk_report.risk_level === "high"
    ? "high"
    : input.riskLevel;
  if (baseHashMismatch && effectiveRisk !== "high") {
    throw new Error("Base hash mismatch requires high risk.");
  }
  if (input.dryRun) {
    return {
      dry_run: true,
      approval_item_created: false,
      pending_engine_candidate_id: input.candidateId,
      review_id: review.review_id,
      risk_level: effectiveRisk,
      base_hash_mismatch: baseHashMismatch,
      active_engine_modified: false,
      activation_performed: false,
    };
  }
  const item = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "activate_engine_candidate",
    targetType: "pending_engine_candidate",
    targetId: input.candidateId,
    workflowRunId: candidate.metadata.workflow_run_id
      ?? candidate.metadata.run_id
      ?? candidate.metadata.source_lineage?.workflow_run_id
      ?? null,
    sourceHash: currentCandidateHash,
    sourceRevision: currentCandidateHash,
    sourcePhase: "phase_8h_pending_engine_candidate_review",
    sourceKind: candidate.metadata.source_kind ?? candidate.metadata.candidate_kind ?? null,
    environment: candidate.metadata.environment ?? "production",
    testFixture: candidate.metadata.test_fixture === true,
    sourceChapter: candidate.metadata.source_chapter,
    title: "Pending engine candidate activation request",
    summary: input.reason || "User requested activation review through Phase 8H.",
    reason: input.reason,
    riskLevel: effectiveRisk,
    requiresSecondConfirmation:
      effectiveRisk === "high"
      || candidate.risk_report.requires_second_confirmation === true,
    requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
    neuralStatus: "not_checked_by_phase_8h_request",
    requiresUserConfirmation: true,
    canExecuteWithoutUserConfirmation: false,
    createdBy: "pending_engine_candidate_review_service",
    safety: {
      activation_performed: false,
      active_engine_modified: false,
      approval_only: true,
    },
    impact: candidate.metadata.activation_write_manifest ?? {
      will_modify: [
        "data/canon_db/active_engine.md",
        ...(candidate.metadata.current_input_refresh ? [
          "data/outputs/task_prompt.md",
          "data/outputs/generation_context.md",
          "data/outputs/retrieval_context.md",
        ] : []),
        ...(candidate.metadata.settlement_report_metadata_path
          ? [candidate.metadata.settlement_report_metadata_path]
          : []),
      ],
      will_create: ["snapshot", "archive", "activation_log"],
      rollback_available: true,
    },
    links: {
      candidate_id: input.candidateId,
      adopted_chapter_id: candidate.metadata.adopted_chapter_id ?? null,
    },
    details: {
      requested_by: input.requestedBy,
      review_id: review.review_id,
      settlement_report_id: candidate.metadata.settlement_report_id ?? null,
      settlement_context_id: candidate.metadata.settlement_context_id ?? null,
      adopted_chapter_id: candidate.metadata.adopted_chapter_id ?? null,
      base_active_engine_hash: review.base_active_engine_hash,
      current_active_engine_hash: currentActiveHash,
      base_hash_mismatch: baseHashMismatch,
      candidate_engine_hash_sha256: currentCandidateHash,
      candidate_hash_match: true,
      lineage: candidate.metadata.source_lineage ?? null,
      activation_write_manifest: candidate.metadata.activation_write_manifest ?? null,
      candidate_status: candidate.status.status,
      review_status: candidate.metadata.review_status ?? "pending_review",
      diff_summary: review.diff_summary,
      candidate_hash: currentCandidateHash,
    },
  }, options);
  if (!item.approval_item_id) {
    return {
      approval_item_created: false,
      approval_item_id: null,
      approval_status: item.status?.status ?? "archived",
      diagnostic: item.diagnostic ?? "approval request was not persisted",
      pending_engine_candidate_id: input.candidateId,
      review_id: review.review_id,
      active_engine_modified: false,
      activation_performed: false,
    };
  }
  const paths = candidatePaths(input.candidateId, roots);
  const nextMetadata = {
    ...candidate.metadata,
    activation_requested: true,
    activation_approval_item_id: item.approval_item_id,
    latest_activation_approval_item_id: item.approval_item_id,
    activation_approval_item_ids: [
      ...new Set([
        ...(candidate.metadata.activation_approval_item_ids ?? []),
        item.approval_item_id,
      ]),
    ],
    activation_request_status: item.status.status,
    latest_review_id: review.review_id,
    review_status: "pending_review",
    active_engine_modified: false,
    activated: false,
  };
  const nextStatus = {
    ...candidate.status,
    activation_requested: true,
    activation_approval_item_id: item.approval_item_id,
    activation_request_status: item.status.status,
    review_status: "pending_review",
    active_engine_modified: false,
    activated: false,
  };
  await commitFileTransaction("link-pending-engine-activation-request", [
    { filePath: paths.metadata, content: `${JSON.stringify(nextMetadata, null, 2)}\n` },
    { filePath: paths.status, content: `${JSON.stringify(nextStatus, null, 2)}\n` },
  ], {
    approval_item_id: item.approval_item_id,
    review_id: review.review_id,
    pending_engine_candidate_id: input.candidateId,
    phase: "phase_8h_pending_engine_candidate_review",
  });
  if (sha256(await readFile(roots.activeEngine, "utf8")) !== currentActiveHash) {
    throw new Error("Safety violation: active_engine.md changed while requesting activation.");
  }
  return {
    approval_item_created: true,
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    approval_status: item.status.status,
    pending_engine_candidate_id: input.candidateId,
    review_id: review.review_id,
    settlement_report_id: candidate.metadata.settlement_report_id ?? null,
    adopted_chapter_id: candidate.metadata.adopted_chapter_id ?? null,
    base_active_engine_hash: review.base_active_engine_hash,
    current_active_engine_hash: currentActiveHash,
    base_hash_mismatch: baseHashMismatch,
    risk_level: effectiveRisk,
    requires_user_confirmation: true,
    can_execute_without_user_confirmation: false,
    active_engine_modified: false,
    activation_performed: false,
  };
}
