import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import { getGptWritingContextBundle } from "./gpt-writing-context-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const candidateIdPattern = /^writing_candidate_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const allowedSources = new Set(["chatgpt", "gpt", "manual_paste"]);
const chatOutputMaxLength = 300_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createCandidateId() {
  return `writing_candidate_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
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
  const source = optionalText(input.source, "source", 100) || "chatgpt";
  if (!allowedSources.has(source)) throw new Error(`Unknown source: ${source}`);
  return {
    sourceBundleId: optionalText(
      input.source_bundle_id ?? input.sourceBundleId,
      "source_bundle_id",
      200,
    ),
    chatOutputText: requiredText(
      input.chat_output_text ?? input.chatOutputText,
      "chat_output_text",
      chatOutputMaxLength,
    ),
    title: optionalText(input.title, "title", 500),
    chapterLabel: optionalText(
      input.chapter_label ?? input.chapterLabel,
      "chapter_label",
      500,
    ),
    taskPrompt: optionalText(input.task_prompt ?? input.taskPrompt, "task_prompt", 12_000),
    notes: optionalText(input.notes, "notes", 10_000),
    source,
    dryRun: input.dry_run === true || input.dryRun === true,
  };
}

function rootsFor(options = {}) {
  const writingCandidates = options.writingCandidates
    ? assertPathInside(
      options.writingCandidates,
      projectPaths.outputs,
      "writing candidates test root",
    )
    : projectPaths.writingCandidates;
  return { writingCandidates };
}

function candidatePaths(candidateId, roots) {
  if (!candidateIdPattern.test(String(candidateId ?? ""))) {
    throw new Error("Invalid candidate_id.");
  }
  const directory = path.join(roots.writingCandidates, candidateId);
  return {
    directory,
    content: path.join(directory, "candidate.md"),
    metadata: path.join(directory, "candidate.json"),
  };
}

async function bundleTrace(sourceBundleId, options) {
  if (!sourceBundleId) {
    return {
      source_bundle_id: "",
      source_bundle_path: "",
      context_for_chat_path: "",
      source_bundle_created_at: null,
      source_active_engine_hash: null,
      warning:
        "source_bundle_id missing; candidate cannot be traced to a GPT writing context bundle.",
    };
  }
  const source = await getGptWritingContextBundle(sourceBundleId, options);
  return {
    source_bundle_id: sourceBundleId,
    source_bundle_path: source.context_bundle_path,
    context_for_chat_path: source.context_for_chat_path,
    source_bundle_created_at: source.bundle.created_at,
    source_active_engine_hash: source.bundle.sources?.active_engine?.hash ?? null,
    warning: null,
  };
}

function publicResult(metadata) {
  return {
    candidate_id: metadata.candidate_id,
    candidate_path: metadata.content_path,
    candidate_meta_path: metadata.metadata_path,
    candidate_hash: metadata.candidate_hash,
    source_bundle_id: metadata.source_bundle_id,
    canon_status: metadata.canon_status,
    adopted: metadata.adopted,
    settled: metadata.settled,
    proofed: metadata.proofed,
  };
}

export async function saveChatOutputAsWritingCandidate(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const roots = rootsFor(options);
  const trace = await bundleTrace(input.sourceBundleId, options);
  const candidateHash = sha256(input.chatOutputText);
  const warnings = trace.warning ? [trace.warning] : [];
  if (input.dryRun) {
    return {
      dry_run: true,
      candidate_created: false,
      candidate_hash: candidateHash,
      source_bundle_id: trace.source_bundle_id,
      canon_status: "candidate_only",
      adopted: false,
      settled: false,
      proofed: false,
      warnings,
    };
  }

  await mkdir(roots.writingCandidates, { recursive: true });
  const candidateId = createCandidateId();
  const paths = candidatePaths(candidateId, roots);
  const metadata = {
    candidate_id: candidateId,
    candidate_kind: "chat_output_writing_candidate",
    created_at: new Date().toISOString(),
    source: input.source,
    source_bundle_id: trace.source_bundle_id,
    source_bundle_path: trace.source_bundle_path,
    context_for_chat_path: trace.context_for_chat_path,
    source_bundle_created_at: trace.source_bundle_created_at,
    source_active_engine_hash: trace.source_active_engine_hash,
    title: input.title,
    chapter_label: input.chapterLabel,
    task_prompt: input.taskPrompt,
    notes: input.notes,
    candidate_hash: candidateHash,
    candidate_chars: input.chatOutputText.length,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    proofed: false,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    adoption_allowed_without_approval: false,
    settlement_allowed_without_adoption: false,
    local_generation_used: false,
    content_path: normalizeProjectPath(paths.content),
    metadata_path: normalizeProjectPath(paths.metadata),
    warnings,
  };
  await commitFileTransaction("save-chat-output-writing-candidate", [
    { filePath: paths.content, content: `${input.chatOutputText}\n` },
    { filePath: paths.metadata, content: `${JSON.stringify(metadata, null, 2)}\n` },
  ], { candidate_id: candidateId, phase: "phase_8c_chat_output_candidate" });
  return {
    ...publicResult(metadata),
    candidate_created: true,
    warnings,
  };
}

export async function getWritingCandidateDetail(candidateId, options = {}) {
  const roots = rootsFor(options);
  const paths = candidatePaths(candidateId, roots);
  const metadata = JSON.parse(await readFile(paths.metadata, "utf8"));
  const includeContent = options.includeContent === true || options.include_content === true;
  const maxContentChars = optionalInteger(
    options.maxContentChars ?? options.max_content_chars,
    12_000,
    "max_content_chars",
    50_000,
  );
  let content = null;
  let contentTruncated = false;
  if (includeContent) {
    const fullContent = await readFile(paths.content, "utf8");
    contentTruncated = fullContent.length > maxContentChars;
    content = contentTruncated
      ? `${fullContent.slice(0, maxContentChars)}\n\n[content truncated]`
      : fullContent;
  }
  return {
    metadata,
    content,
    content_included: includeContent,
    content_truncated: contentTruncated,
  };
}

export async function listWritingCandidates(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const sourceBundleId = optionalText(
    input.source_bundle_id ?? input.sourceBundleId,
    "source_bundle_id",
    200,
  );
  const canonStatus = optionalText(
    input.canon_status ?? input.canonStatus,
    "canon_status",
    100,
  );
  const roots = rootsFor(options);
  await mkdir(roots.writingCandidates, { recursive: true });
  const entries = await readdir(roots.writingCandidates, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !candidateIdPattern.test(entry.name)) continue;
    try {
      const detail = await getWritingCandidateDetail(entry.name, options);
      const metadata = detail.metadata;
      if (sourceBundleId && metadata.source_bundle_id !== sourceBundleId) continue;
      if (canonStatus && metadata.canon_status !== canonStatus) continue;
      candidates.push({
        candidate_id: metadata.candidate_id,
        created_at: metadata.created_at,
        source: metadata.source,
        source_bundle_id: metadata.source_bundle_id,
        title: metadata.title,
        chapter_label: metadata.chapter_label,
        candidate_hash: metadata.candidate_hash,
        candidate_chars: metadata.candidate_chars,
        canon_status: metadata.canon_status,
        adopted: metadata.adopted,
        settled: metadata.settled,
        proofed: metadata.proofed,
        content_path: metadata.content_path,
        warnings: metadata.warnings,
      });
    } catch {
      // Ignore incomplete candidate records.
    }
  }
  return candidates
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}
