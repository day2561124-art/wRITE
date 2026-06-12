import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  resolveWritingCandidatePaths,
} from "./chat-output-candidate-service.mjs";
import { importSettlementResult } from "./engine-candidate-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import { getAdoptedWritingDetail } from "./writing-candidate-adoption-service.mjs";

const contextIdPattern = /^settlement_ctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const reportIdPattern = /^settlement_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const settlementModes = new Set(["full", "facts_only", "minimal"]);
const allowedSources = new Set(["chatgpt", "gpt", "manual_paste"]);
const defaultMaxContextChars = 120_000;
const maximumContextChars = 250_000;
const maximumReportChars = 250_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength = 10_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
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
  const settlementContexts = options.settlementContexts
    ? assertPathInside(
      options.settlementContexts,
      projectPaths.outputs,
      "settlement contexts test root",
    )
    : projectPaths.adoptedWritingSettlementContexts;
  const settlementReports = options.settlementReports
    ? assertPathInside(
      options.settlementReports,
      projectPaths.outputs,
      "settlement reports test root",
    )
    : projectPaths.adoptedWritingSettlementReports;
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
  return { settlementContexts, settlementReports, pendingEngineCandidates, activeEngine };
}

function contextPaths(contextId, roots) {
  if (!contextIdPattern.test(String(contextId ?? ""))) {
    throw new Error("Invalid settlement_context_id.");
  }
  const directory = path.join(roots.settlementContexts, contextId);
  return {
    directory,
    context: path.join(directory, "settlement_context.json"),
    chat: path.join(directory, "settlement_for_chat.md"),
  };
}

function reportPaths(reportId, roots) {
  if (!reportIdPattern.test(String(reportId ?? ""))) {
    throw new Error("Invalid settlement_report_id.");
  }
  const directory = path.join(roots.settlementReports, reportId);
  return {
    directory,
    report: path.join(directory, "settlement_report.md"),
    metadata: path.join(directory, "settlement_report.json"),
  };
}

function adoptedPaths(adoptedChapterId, options = {}) {
  const adoptedRoot = options.adoptedWritings
    ? assertPathInside(options.adoptedWritings, projectPaths.outputs, "adopted writings test root")
    : projectPaths.adoptedWritings;
  return {
    chapter: path.join(adoptedRoot, adoptedChapterId, "chapter.md"),
    adoption: path.join(adoptedRoot, adoptedChapterId, "adoption.json"),
  };
}

async function sourceSnapshot(label, filePath, included, canonStatus) {
  const sourcePath = normalizeProjectPath(filePath);
  if (!included) {
    return {
      label,
      path: sourcePath,
      included: false,
      exists: null,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      label,
      path: sourcePath,
      included: true,
      exists: true,
      hash: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      canon_status: canonStatus,
      content,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      path: sourcePath,
      included: true,
      exists: false,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
}

function allocateContent(sections, maxChars) {
  let remaining = maxChars;
  const content = {};
  const truncatedSections = [];
  for (const section of sections) {
    const text = String(section.text ?? "");
    if (!text) {
      content[section.key] = "";
      continue;
    }
    if (remaining <= 0) {
      content[section.key] = `[omitted: context budget exhausted; source=${section.reference}]`;
      truncatedSections.push(section.key);
      continue;
    }
    if (text.length <= remaining) {
      content[section.key] = text;
      remaining -= text.length;
      continue;
    }
    const suffix = `\n\n[truncated; source=${section.reference}]`;
    const allowed = Math.max(0, remaining - suffix.length);
    content[section.key] = `${text.slice(0, allowed)}${suffix}`;
    truncatedSections.push(section.key);
    remaining = 0;
  }
  return {
    content,
    context_chars_used: maxChars - remaining,
    truncated_sections: truncatedSections,
  };
}

function settlementMarkdown(context) {
  const sourceLines = Object.values(context.sources).map((source) => (
    `- ${source.label}: included=${source.included}, exists=${source.exists}, hash=${source.hash ?? "none"}, path=${source.path}`
  ));
  return [
    "# GPT Adopted Writing Settlement Context",
    "",
    "## Adopted Writing",
    `- adopted_chapter_id: ${context.adopted_chapter_id}`,
    `- candidate_id: ${context.candidate_id}`,
    `- proof_report_id: ${context.proof_report_id ?? ""}`,
    `- adoption_approval_item_id: ${context.approval_item_id}`,
    `- adopted_content_hash: ${context.adopted_content_hash}`,
    "- settled: false",
    "",
    "## Adopted Chapter Content",
    context.content.adopted_content || "[not included]",
    "",
    "## Active Engine / Current Canon",
    context.content.active_engine || "[not included or missing]",
    "",
    "## Writing Card",
    context.content.writing_card || "[not included or missing]",
    "",
    "## Proofing Card",
    context.content.proofing_card || "[not included or missing]",
    "",
    "## Longline / Current Arc",
    context.content.longline || "[not included or missing]",
    "",
    "## Retrieval Context",
    context.content.retrieval_context,
    "",
    "## Generation Context",
    context.content.generation_context,
    "",
    "## Sources",
    ...sourceLines,
    "",
    "## Settlement Instructions",
    "- Create the adopted chapter settlement report in chat.",
    "- Include a proposed complete engine candidate inside a `pending_engine_candidate` Markdown section.",
    "- Treat the report and proposed engine as pending review only.",
    "- Do not update or activate active_engine.md.",
    "- Do not create or approve an activation request.",
    "- Do not treat a pending candidate as active canon.",
    "- Do not call a local or external LLM API.",
    "",
    "## Suggested Settlement Report Format",
    "# Settlement Report",
    "",
    "## Chapter Facts",
    "## Character / Relationship Updates",
    "## Setting / Timeline / Conflict Updates",
    "## Continuity Risks",
    "## Rules To Preserve",
    "## pending_engine_candidate",
    "",
    "```md",
    "# Proposed Active Engine",
    "...complete proposed engine markdown...",
    "```",
    "",
  ].join("\n");
}

function publicContext(context, paths) {
  return {
    context,
    settlement_context_path: normalizeProjectPath(paths.context),
    settlement_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function buildAdoptedWritingSettlementContext(rawInput, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const settlementMode = optionalText(
    rawInput.settlement_mode ?? rawInput.settlementMode,
    "settlement_mode",
    100,
  ) || "full";
  if (!settlementModes.has(settlementMode)) {
    throw new Error(`Unknown settlement_mode: ${settlementMode}`);
  }
  const input = {
    adoptedChapterId: requiredText(
      rawInput.adopted_chapter_id ?? rawInput.adoptedChapterId,
      "adopted_chapter_id",
    ),
    includeAdoptedContent: optionalBoolean(
      rawInput.include_adopted_content ?? rawInput.includeAdoptedContent,
      true,
      "include_adopted_content",
    ),
    includeActiveEngine: optionalBoolean(
      rawInput.include_active_engine ?? rawInput.includeActiveEngine,
      true,
      "include_active_engine",
    ),
    includeWritingCard: optionalBoolean(
      rawInput.include_writing_card ?? rawInput.includeWritingCard,
      true,
      "include_writing_card",
    ),
    includeProofingCard: optionalBoolean(
      rawInput.include_proofing_card ?? rawInput.includeProofingCard,
      true,
      "include_proofing_card",
    ),
    includeLongline: optionalBoolean(
      rawInput.include_longline ?? rawInput.includeLongline,
      true,
      "include_longline",
    ),
    retrievalContext: optionalObject(
      rawInput.retrieval_context ?? rawInput.retrievalContext,
      "retrieval_context",
    ),
    generationContext: optionalObject(
      rawInput.generation_context ?? rawInput.generationContext,
      "generation_context",
    ),
    settlementMode,
    maxContextChars: optionalInteger(
      rawInput.max_context_chars ?? rawInput.maxContextChars,
      defaultMaxContextChars,
      "max_context_chars",
      maximumContextChars,
    ),
  };
  const adopted = await getAdoptedWritingDetail(input.adoptedChapterId, options);
  if (adopted.adoption.canon_status !== "adopted_chapter") {
    throw new Error("Adopted writing is not an adopted_chapter.");
  }
  if (adopted.adoption.settled === true) {
    throw new Error("Adopted writing is already settled; create a new version before settling again.");
  }
  const roots = rootsFor(options);
  const sourceList = await Promise.all([
    sourceSnapshot("active_engine", roots.activeEngine, input.includeActiveEngine, "active"),
    sourceSnapshot(
      "active_writing_card",
      path.join(projectRoot, "data", "writing_policy_db", "active_writing_card.md"),
      input.includeWritingCard,
      "policy",
    ),
    sourceSnapshot(
      "active_proofing_card",
      path.join(projectRoot, "data", "proofing_policy_db", "active_proofing_card.md"),
      input.includeProofingCard,
      "policy",
    ),
    sourceSnapshot(
      "active_longline",
      path.join(projectRoot, "data", "longline_db", "active_longline.md"),
      input.includeLongline,
      "reference",
    ),
  ]);
  const byLabel = Object.fromEntries(sourceList.map((source) => [source.label, source]));
  const allocated = allocateContent([
    {
      key: "adopted_content",
      text: input.includeAdoptedContent ? adopted.chapter_text : "",
      reference: adopted.content_path,
    },
    {
      key: "active_engine",
      text: byLabel.active_engine.content,
      reference: byLabel.active_engine.path,
    },
    {
      key: "writing_card",
      text: byLabel.active_writing_card.content,
      reference: byLabel.active_writing_card.path,
    },
    {
      key: "proofing_card",
      text: byLabel.active_proofing_card.content,
      reference: byLabel.active_proofing_card.path,
    },
    {
      key: "longline",
      text: byLabel.active_longline.content,
      reference: byLabel.active_longline.path,
    },
    {
      key: "retrieval_context",
      text: JSON.stringify(input.retrievalContext, null, 2),
      reference: "input.retrieval_context",
    },
    {
      key: "generation_context",
      text: JSON.stringify(input.generationContext, null, 2),
      reference: "input.generation_context",
    },
  ], input.maxContextChars);
  const warnings = sourceList
    .filter((source) => source.included && source.exists === false)
    .map((source) => `Missing source: ${source.label}`);
  if (allocated.truncated_sections.length) {
    warnings.push(`Context truncated: ${allocated.truncated_sections.join(", ")}`);
  }
  if (adopted.adoption.latest_pending_engine_candidate_id) {
    warnings.push("Adopted writing already has a pending settlement candidate.");
  }
  const contextId = createId("settlement_ctx");
  const paths = contextPaths(contextId, roots);
  const publicSources = Object.fromEntries(sourceList.map(({ content, ...source }) => [
    source.label,
    source,
  ]));
  const context = {
    settlement_context_id: contextId,
    context_kind: "adopted_writing_settlement_context",
    created_at: new Date().toISOString(),
    source: "adopted_writing_settlement_service",
    adopted_chapter_id: input.adoptedChapterId,
    adopted_content_hash: sha256(adopted.chapter_text),
    candidate_id: adopted.adoption.candidate_id,
    proof_report_id: adopted.adoption.proof_report_id,
    approval_item_id: adopted.adoption.approval_item_id,
    settlement_mode: input.settlementMode,
    for_chat_output: true,
    local_generation_allowed: false,
    settlement_report_generated_locally: false,
    pending_engine_candidate_created: false,
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_required_for_engine_activation: true,
    settled: false,
    sources: publicSources,
    content: allocated.content,
    inputs: {
      retrieval_context: input.retrievalContext,
      generation_context: input.generationContext,
    },
    context_chars_used: allocated.context_chars_used,
    max_context_chars: input.maxContextChars,
    truncated_sections: allocated.truncated_sections,
    warnings,
    chat_instructions: {
      role: "GPT creates the chapter settlement report in chat",
      must_output_in_chat: true,
      do_not_update_active_engine: true,
      do_not_activate_engine: true,
      do_not_create_approval_item: true,
      do_not_treat_pending_candidate_as_active: true,
    },
  };
  const adoption = {
    ...adopted.adoption,
    latest_settlement_context_id: contextId,
    settlement_context_ids: [
      ...new Set([...(adopted.adoption.settlement_context_ids ?? []), contextId]),
    ],
    settlement_status: "settlement_context_created",
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
  };
  await mkdir(roots.settlementContexts, { recursive: true });
  await commitFileTransaction("build-adopted-writing-settlement-context", [
    { filePath: paths.context, content: `${JSON.stringify(context, null, 2)}\n` },
    { filePath: paths.chat, content: settlementMarkdown(context) },
    { filePath: adoptedPaths(input.adoptedChapterId, options).adoption, content: `${JSON.stringify(adoption, null, 2)}\n` },
  ], {
    settlement_context_id: contextId,
    adopted_chapter_id: input.adoptedChapterId,
    phase: "phase_8g_adopted_writing_settlement_candidate",
  });
  return publicContext(context, paths);
}

export async function getAdoptedWritingSettlementContext(contextId, options = {}) {
  const roots = rootsFor(options);
  const paths = contextPaths(contextId, roots);
  const [context, settlementForChat] = await Promise.all([
    readFile(paths.context, "utf8").then(JSON.parse),
    readFile(paths.chat, "utf8"),
  ]);
  return {
    context,
    settlement_for_chat: settlementForChat,
    settlement_context_path: normalizeProjectPath(paths.context),
    settlement_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function listAdoptedWritingSettlementContexts(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const adoptedChapterId = optionalText(
    input.adopted_chapter_id ?? input.adoptedChapterId,
    "adopted_chapter_id",
    200,
  );
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const roots = rootsFor(options);
  await mkdir(roots.settlementContexts, { recursive: true });
  const entries = await readdir(roots.settlementContexts, { withFileTypes: true });
  const contexts = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !contextIdPattern.test(entry.name)) continue;
    try {
      const detail = await getAdoptedWritingSettlementContext(entry.name, options);
      if (adoptedChapterId && detail.context.adopted_chapter_id !== adoptedChapterId) continue;
      contexts.push({
        settlement_context_id: entry.name,
        created_at: detail.context.created_at,
        adopted_chapter_id: detail.context.adopted_chapter_id,
        candidate_id: detail.context.candidate_id,
        settlement_mode: detail.context.settlement_mode,
        settlement_for_chat_path: detail.settlement_for_chat_path,
        warnings: detail.context.warnings,
      });
    } catch {
      // Ignore incomplete context records.
    }
  }
  return contexts
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}

export async function saveChatOutputAsSettlementReport(rawInput, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const source = optionalText(rawInput.source, "source", 100) || "chatgpt";
  if (!allowedSources.has(source)) throw new Error(`Unknown source: ${source}`);
  const input = {
    adoptedChapterId: requiredText(
      rawInput.adopted_chapter_id ?? rawInput.adoptedChapterId,
      "adopted_chapter_id",
    ),
    settlementContextId: optionalText(
      rawInput.settlement_context_id ?? rawInput.settlementContextId,
      "settlement_context_id",
      200,
    ),
    settlementReportText: requiredText(
      rawInput.settlement_report_text ?? rawInput.settlementReportText,
      "settlement_report_text",
      maximumReportChars,
    ),
    summary: optionalText(rawInput.summary, "summary", 10_000),
    source,
    dryRun: rawInput.dry_run === true || rawInput.dryRun === true,
  };
  const adopted = await getAdoptedWritingDetail(input.adoptedChapterId, options);
  if (adopted.adoption.canon_status !== "adopted_chapter" || adopted.adoption.settled === true) {
    throw new Error("Settlement reports require an adopted, unsettled writing.");
  }
  let context = null;
  if (input.settlementContextId) {
    context = await getAdoptedWritingSettlementContext(input.settlementContextId, options);
    if (context.context.adopted_chapter_id !== input.adoptedChapterId) {
      throw new Error("settlement_context_id does not belong to adopted_chapter_id.");
    }
  }
  const reportHash = sha256(input.settlementReportText);
  if (input.dryRun) {
    return {
      dry_run: true,
      settlement_report_created: false,
      adopted_chapter_id: input.adoptedChapterId,
      settlement_context_id: input.settlementContextId || null,
      settlement_report_hash: reportHash,
      active_engine_modified: false,
      pending_engine_candidate_created: false,
    };
  }
  const roots = rootsFor(options);
  const reportId = createId("settlement_report");
  const paths = reportPaths(reportId, roots);
  const metadata = {
    settlement_report_id: reportId,
    report_kind: "chat_output_adopted_writing_settlement_report",
    created_at: new Date().toISOString(),
    source: input.source,
    adopted_chapter_id: input.adoptedChapterId,
    candidate_id: adopted.adoption.candidate_id,
    proof_report_id: adopted.adoption.proof_report_id,
    settlement_context_id: input.settlementContextId || null,
    settlement_report_hash: reportHash,
    summary: input.summary,
    canon_status: "settlement_report_only",
    pending_engine_candidate_created: false,
    pending_engine_candidate_id: null,
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_item_created: false,
    content_path: normalizeProjectPath(paths.report),
    metadata_path: normalizeProjectPath(paths.metadata),
  };
  const adoption = {
    ...adopted.adoption,
    latest_settlement_report_id: reportId,
    settlement_report_ids: [
      ...new Set([...(adopted.adoption.settlement_report_ids ?? []), reportId]),
    ],
    settlement_status: "settlement_report_saved",
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
  };
  await mkdir(roots.settlementReports, { recursive: true });
  await commitFileTransaction("save-chat-output-settlement-report", [
    { filePath: paths.report, content: `${input.settlementReportText}\n` },
    { filePath: paths.metadata, content: `${JSON.stringify(metadata, null, 2)}\n` },
    { filePath: adoptedPaths(input.adoptedChapterId, options).adoption, content: `${JSON.stringify(adoption, null, 2)}\n` },
  ], {
    settlement_report_id: reportId,
    settlement_context_id: input.settlementContextId || "",
    adopted_chapter_id: input.adoptedChapterId,
    phase: "phase_8g_adopted_writing_settlement_candidate",
  });
  return {
    settlement_report_created: true,
    settlement_report_id: reportId,
    adopted_chapter_id: input.adoptedChapterId,
    settlement_context_id: input.settlementContextId || null,
    settlement_report_hash: reportHash,
    settlement_report_path: metadata.content_path,
    settlement_report_meta_path: metadata.metadata_path,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
  };
}

export async function getSettlementReportDetail(reportId, options = {}) {
  const roots = rootsFor(options);
  const paths = reportPaths(reportId, roots);
  const [metadata, reportText] = await Promise.all([
    readFile(paths.metadata, "utf8").then(JSON.parse),
    readFile(paths.report, "utf8"),
  ]);
  const includeContent = options.includeContent === true || options.include_content === true;
  const maxContentChars = optionalInteger(
    options.maxContentChars ?? options.max_content_chars,
    12_000,
    "max_content_chars",
    50_000,
  );
  const contentTruncated = includeContent && reportText.length > maxContentChars;
  return {
    metadata,
    content: includeContent
      ? contentTruncated
        ? `${reportText.slice(0, maxContentChars)}\n\n[content truncated]`
        : reportText
      : null,
    content_included: includeContent,
    content_truncated: contentTruncated,
  };
}

export async function listSettlementReports(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const adoptedChapterId = optionalText(
    input.adopted_chapter_id ?? input.adoptedChapterId,
    "adopted_chapter_id",
    200,
  );
  const status = optionalText(input.status, "status", 100);
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const roots = rootsFor(options);
  await mkdir(roots.settlementReports, { recursive: true });
  const entries = await readdir(roots.settlementReports, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !reportIdPattern.test(entry.name)) continue;
    try {
      const detail = await getSettlementReportDetail(entry.name, options);
      const metadata = detail.metadata;
      if (adoptedChapterId && metadata.adopted_chapter_id !== adoptedChapterId) continue;
      if (status && metadata.canon_status !== status) continue;
      reports.push(metadata);
    } catch {
      // Ignore incomplete report records.
    }
  }
  return reports
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}

export async function buildPendingEngineCandidateFromSettlementReport(rawInput, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const input = {
    settlementReportId: requiredText(
      rawInput.settlement_report_id ?? rawInput.settlementReportId,
      "settlement_report_id",
    ),
    adoptedChapterId: optionalText(
      rawInput.adopted_chapter_id ?? rawInput.adoptedChapterId,
      "adopted_chapter_id",
      200,
    ),
    baseActiveEngineHash: optionalText(
      rawInput.base_active_engine_hash ?? rawInput.baseActiveEngineHash,
      "base_active_engine_hash",
      128,
    ),
    reason: optionalText(rawInput.reason, "reason", 5_000),
    dryRun: rawInput.dry_run === true || rawInput.dryRun === true,
  };
  const report = await getSettlementReportDetail(input.settlementReportId, options);
  const adoptedChapterId = input.adoptedChapterId || report.metadata.adopted_chapter_id;
  if (report.metadata.adopted_chapter_id !== adoptedChapterId) {
    throw new Error("settlement_report_id does not belong to adopted_chapter_id.");
  }
  if (report.metadata.pending_engine_candidate_created === true) {
    throw new Error("Settlement report already created a pending engine candidate.");
  }
  const adopted = await getAdoptedWritingDetail(adoptedChapterId, options);
  if (adopted.adoption.settled === true) throw new Error("Adopted writing is already settled.");
  const roots = rootsFor(options);
  const activeText = await readFile(roots.activeEngine, "utf8");
  const activeHash = sha256(activeText);
  const contextBaseHash = report.metadata.settlement_context_id
    ? (await getAdoptedWritingSettlementContext(
      report.metadata.settlement_context_id,
      options,
    )).context.sources.active_engine.hash
    : null;
  const expectedBaseHash = input.baseActiveEngineHash || contextBaseHash || activeHash;
  if (expectedBaseHash && expectedBaseHash !== activeHash) {
    throw new Error("active_engine.md changed since settlement context creation.");
  }
  if (input.dryRun) {
    return {
      dry_run: true,
      pending_engine_candidate_created: false,
      settlement_report_id: input.settlementReportId,
      adopted_chapter_id: adoptedChapterId,
      base_active_engine_hash: activeHash,
      active_engine_modified: false,
      activation_requested: false,
      approval_item_created: false,
    };
  }
  const reportText = await readFile(
    reportPaths(input.settlementReportId, rootsFor(options)).report,
    "utf8",
  );
  const candidate = await importSettlementResult({
    rawText: reportText,
    sourceChapter: adoptedChapterId,
    note: input.reason || `Settlement report ${input.settlementReportId}`,
  }, {
    ...options,
    pendingEngineCandidates: roots.pendingEngineCandidates,
    activeEnginePath: roots.activeEngine,
  });
  const candidateId = candidate.metadata.candidate_id;
  const candidateDirectory = path.join(roots.pendingEngineCandidates, candidateId);
  const candidateMetadataPath = path.join(candidateDirectory, "metadata.json");
  const candidateStatusPath = path.join(candidateDirectory, "status.json");
  const [candidateMetadata, candidateStatus] = await Promise.all([
    readFile(candidateMetadataPath, "utf8").then(JSON.parse),
    readFile(candidateStatusPath, "utf8").then(JSON.parse),
  ]);
  const nextCandidateMetadata = {
    ...candidateMetadata,
    pending_engine_candidate_id: candidateId,
    candidate_kind: "settlement_pending_engine_candidate",
    source: "adopted_writing_settlement_service",
    settlement_report_id: input.settlementReportId,
    settlement_context_id: report.metadata.settlement_context_id,
    adopted_chapter_id: adoptedChapterId,
    base_active_engine_hash: activeHash,
    active_engine_modified: false,
    activation_requested: false,
    activation_approval_item_id: null,
    requires_user_confirmation_for_activation: true,
    review_status: "pending_review",
  };
  const nextCandidateStatus = {
    ...candidateStatus,
    status: candidateStatus.status === "candidate" ? "candidate" : candidateStatus.status,
    settlement_status: "pending_review",
    review_status: "pending_review",
    active_engine_modified: false,
    activation_requested: false,
    activation_approval_item_id: null,
    requires_user_confirmation_for_activation: true,
  };
  const reportPathsForId = reportPaths(input.settlementReportId, roots);
  const nextReportMetadata = {
    ...report.metadata,
    pending_engine_candidate_created: true,
    pending_engine_candidate_id: candidateId,
    active_engine_modified: false,
    engine_activation_requested: false,
    approval_item_created: false,
  };
  const nextAdoption = {
    ...adopted.adoption,
    latest_pending_engine_candidate_id: candidateId,
    pending_engine_candidate_ids: [
      ...new Set([...(adopted.adoption.pending_engine_candidate_ids ?? []), candidateId]),
    ],
    settlement_status: "pending_engine_candidate",
    settlement_candidate_created: true,
    settled: false,
    active_engine_settled: false,
    active_engine_update_allowed: false,
    active_engine_modified: false,
    engine_activation_requested: false,
  };
  const writingCandidate = await getWritingCandidateDetail(adopted.adoption.candidate_id, options);
  const writingCandidatePaths = resolveWritingCandidatePaths(adopted.adoption.candidate_id, options);
  const nextWritingCandidate = {
    ...writingCandidate.metadata,
    latest_settlement_context_id: report.metadata.settlement_context_id,
    latest_settlement_report_id: input.settlementReportId,
    latest_pending_engine_candidate_id: candidateId,
    settlement_status: "pending_engine_candidate",
    settlement_candidate_created: true,
    settled: false,
    active_engine_update_allowed: false,
  };
  await commitFileTransaction("link-adopted-writing-pending-engine-candidate", [
    { filePath: candidateMetadataPath, content: `${JSON.stringify(nextCandidateMetadata, null, 2)}\n` },
    { filePath: candidateStatusPath, content: `${JSON.stringify(nextCandidateStatus, null, 2)}\n` },
    { filePath: reportPathsForId.metadata, content: `${JSON.stringify(nextReportMetadata, null, 2)}\n` },
    { filePath: adoptedPaths(adoptedChapterId, options).adoption, content: `${JSON.stringify(nextAdoption, null, 2)}\n` },
    { filePath: writingCandidatePaths.metadata, content: `${JSON.stringify(nextWritingCandidate, null, 2)}\n` },
  ], {
    pending_engine_candidate_id: candidateId,
    settlement_report_id: input.settlementReportId,
    adopted_chapter_id: adoptedChapterId,
    phase: "phase_8g_adopted_writing_settlement_candidate",
  });
  const activeAfterHash = sha256(await readFile(roots.activeEngine, "utf8"));
  if (activeAfterHash !== activeHash) {
    throw new Error("Safety violation: active_engine.md changed while building pending candidate.");
  }
  return {
    pending_engine_candidate_created: true,
    pending_engine_candidate_id: candidateId,
    candidate_status: nextCandidateStatus.status,
    settlement_status: nextCandidateStatus.settlement_status,
    settlement_report_id: input.settlementReportId,
    settlement_context_id: report.metadata.settlement_context_id,
    adopted_chapter_id: adoptedChapterId,
    base_active_engine_hash: activeHash,
    active_engine_modified: false,
    activation_requested: false,
    activation_approval_item_id: null,
    approval_item_created: false,
    requires_user_confirmation_for_activation: true,
  };
}
