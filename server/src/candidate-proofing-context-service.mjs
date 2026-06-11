import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  resolveWritingCandidatePaths,
} from "./chat-output-candidate-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

const contextIdPattern = /^proofctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const proofingModes = new Set(["full", "canon_only", "style_only", "continuity_only"]);
const defaultMaxContextChars = 120_000;
const maximumContextChars = 250_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createContextId() {
  return `proofctx_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength = 200) {
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

function normalizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const proofingMode = optionalText(
    input.proofing_mode ?? input.proofingMode,
    "proofing_mode",
    100,
  ) || "full";
  if (!proofingModes.has(proofingMode)) {
    throw new Error(`Unknown proofing_mode: ${proofingMode}`);
  }
  return {
    candidateId: requiredText(input.candidate_id ?? input.candidateId, "candidate_id"),
    proofingMode,
    includeCandidateContent: optionalBoolean(
      input.include_candidate_content ?? input.includeCandidateContent,
      true,
      "include_candidate_content",
    ),
    includeActiveEngine: optionalBoolean(
      input.include_active_engine ?? input.includeActiveEngine,
      true,
      "include_active_engine",
    ),
    includeWritingCard: optionalBoolean(
      input.include_writing_card ?? input.includeWritingCard,
      true,
      "include_writing_card",
    ),
    includeProofingCard: optionalBoolean(
      input.include_proofing_card ?? input.includeProofingCard,
      true,
      "include_proofing_card",
    ),
    includeLongline: optionalBoolean(
      input.include_longline ?? input.includeLongline,
      true,
      "include_longline",
    ),
    retrievalContext: optionalObject(
      input.retrieval_context ?? input.retrievalContext,
      "retrieval_context",
    ),
    generationContext: optionalObject(
      input.generation_context ?? input.generationContext,
      "generation_context",
    ),
    maxContextChars: optionalInteger(
      input.max_context_chars ?? input.maxContextChars,
      defaultMaxContextChars,
      "max_context_chars",
      maximumContextChars,
    ),
  };
}

function rootsFor(options = {}) {
  const proofingContexts = options.proofingContexts
    ? assertPathInside(
      options.proofingContexts,
      projectPaths.outputs,
      "proofing contexts test root",
    )
    : projectPaths.proofingContexts;
  return { proofingContexts };
}

function contextPaths(contextId, roots) {
  if (!contextIdPattern.test(String(contextId ?? ""))) {
    throw new Error("Invalid proofing_context_id.");
  }
  const directory = path.join(roots.proofingContexts, contextId);
  return {
    directory,
    context: path.join(directory, "proofing_context.json"),
    chat: path.join(directory, "proofing_for_chat.md"),
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

function proofingMarkdown(context) {
  const sourceLines = Object.values(context.sources).map((source) => (
    `- ${source.label}: included=${source.included}, exists=${source.exists}, hash=${source.hash ?? "none"}, path=${source.path}`
  ));
  return [
    "# Writing Candidate Proofing Context",
    "",
    `- Candidate ID: ${context.candidate_id}`,
    `- Proofing mode: ${context.proofing_mode}`,
    "",
    "## Candidate Metadata",
    "",
    "```json",
    JSON.stringify(context.candidate_metadata, null, 2),
    "```",
    "",
    "## Candidate Content",
    "",
    context.content.candidate_content || "[not included]",
    "",
    "## Sources",
    "",
    ...sourceLines,
    "",
    "## Active Engine",
    "",
    context.content.active_engine || "[not included or missing]",
    "",
    "## Writing Card",
    "",
    context.content.writing_card || "[not included or missing]",
    "",
    "## Proofing Card",
    "",
    context.content.proofing_card || "[not included or missing]",
    "",
    "## Longline",
    "",
    context.content.longline || "[not included or missing]",
    "",
    "## Retrieval Context",
    "",
    context.content.retrieval_context,
    "",
    "## Generation Context",
    "",
    context.content.generation_context,
    "",
    "## Proofing Output Rules",
    "",
    "- Return a proof report in chat; do not rewrite or adopt the candidate automatically.",
    "- Identify verdict, highest severity, summary, and actionable findings.",
    "- Do not call a local generation adapter or external model API.",
    "- Do not create approval items, adopt, settle, activate, rollback, or clean up.",
    "- Do not modify active_engine.md, canon sources, or the candidate content.",
    "",
  ].join("\n");
}

export async function buildCandidateProofingContext(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const roots = rootsFor(options);
  const candidate = await getWritingCandidateDetail(input.candidateId, options);
  const candidatePaths = resolveWritingCandidatePaths(input.candidateId, options);
  const candidateContent = input.includeCandidateContent
    ? await readFile(candidatePaths.content, "utf8")
    : "";
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  const sourceList = await Promise.all([
    sourceSnapshot("active_engine", activeEnginePath, input.includeActiveEngine, "active"),
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
  const sourcesByLabel = Object.fromEntries(sourceList.map((source) => [source.label, source]));
  const allocated = allocateContent([
    {
      key: "candidate_content",
      text: candidateContent,
      reference: candidate.metadata.content_path,
    },
    {
      key: "active_engine",
      text: sourcesByLabel.active_engine.content,
      reference: sourcesByLabel.active_engine.path,
    },
    {
      key: "writing_card",
      text: sourcesByLabel.active_writing_card.content,
      reference: sourcesByLabel.active_writing_card.path,
    },
    {
      key: "proofing_card",
      text: sourcesByLabel.active_proofing_card.content,
      reference: sourcesByLabel.active_proofing_card.path,
    },
    {
      key: "longline",
      text: sourcesByLabel.active_longline.content,
      reference: sourcesByLabel.active_longline.path,
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
  const contextId = createContextId();
  const paths = contextPaths(contextId, roots);
  const publicSources = Object.fromEntries(sourceList.map(({ content, ...source }) => [
    source.label,
    source,
  ]));
  const context = {
    proofing_context_id: contextId,
    context_kind: "writing_candidate_proofing_context",
    created_at: new Date().toISOString(),
    candidate_id: input.candidateId,
    proofing_mode: input.proofingMode,
    for_chat_output: true,
    local_generation_used: false,
    local_generation_allowed: false,
    proof_report_generated_locally: false,
    canon_update_allowed: false,
    active_engine_update_allowed: false,
    adoption_allowed: false,
    settlement_allowed: false,
    approval_item_creation_allowed: false,
    candidate_metadata: candidate.metadata,
    inputs: {
      retrieval_context: input.retrievalContext,
      generation_context: input.generationContext,
    },
    sources: publicSources,
    content: allocated.content,
    context_chars_used: allocated.context_chars_used,
    max_context_chars: input.maxContextChars,
    truncated_sections: allocated.truncated_sections,
    warnings,
  };
  await mkdir(roots.proofingContexts, { recursive: true });
  await commitFileTransaction("build-candidate-proofing-context", [
    { filePath: paths.context, content: `${JSON.stringify(context, null, 2)}\n` },
    { filePath: paths.chat, content: proofingMarkdown(context) },
  ], {
    proofing_context_id: contextId,
    candidate_id: input.candidateId,
    phase: "phase_8d_writing_candidate_proofing",
  });
  return {
    context,
    proofing_context_path: normalizeProjectPath(paths.context),
    proofing_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function getCandidateProofingContext(contextId, options = {}) {
  const roots = rootsFor(options);
  const paths = contextPaths(contextId, roots);
  const [context, proofingForChat] = await Promise.all([
    readFile(paths.context, "utf8").then(JSON.parse),
    readFile(paths.chat, "utf8"),
  ]);
  return {
    context,
    proofing_for_chat: proofingForChat,
    proofing_context_path: normalizeProjectPath(paths.context),
    proofing_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function listCandidateProofingContexts(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const candidateId = optionalText(
    input.candidate_id ?? input.candidateId,
    "candidate_id",
    200,
  );
  const proofingMode = optionalText(
    input.proofing_mode ?? input.proofingMode,
    "proofing_mode",
    100,
  );
  if (proofingMode && !proofingModes.has(proofingMode)) {
    throw new Error(`Unknown proofing_mode: ${proofingMode}`);
  }
  const roots = rootsFor(options);
  await mkdir(roots.proofingContexts, { recursive: true });
  const entries = await readdir(roots.proofingContexts, { withFileTypes: true });
  const contexts = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !contextIdPattern.test(entry.name)) continue;
    try {
      const record = await getCandidateProofingContext(entry.name, options);
      if (candidateId && record.context.candidate_id !== candidateId) continue;
      if (proofingMode && record.context.proofing_mode !== proofingMode) continue;
      contexts.push({
        proofing_context_id: entry.name,
        created_at: record.context.created_at,
        candidate_id: record.context.candidate_id,
        proofing_mode: record.context.proofing_mode,
        proofing_for_chat_path: record.proofing_for_chat_path,
        warnings: record.context.warnings,
      });
    } catch {
      // Ignore incomplete context records.
    }
  }
  return contexts
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}
