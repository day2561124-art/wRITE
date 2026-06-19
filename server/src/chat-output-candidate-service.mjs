import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import { buildEnginePipelineMetadata } from "./engine-pipeline-metadata.mjs";
import { getGptWritingContextBundle } from "./gpt-writing-context-service.mjs";
import { evaluateCandidateAgainstAnchor } from "./chapter-anchor-guard.mjs";
import { formatGuardReportForDisplay } from "./guard-report-display.mjs";
import { runFinalPolisherEditorialBrain } from "./final-polisher-editorial-service.mjs";
import { buildFullNeuralWritingOrchestration } from "./full-neural-writing-orchestrator-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";
import { normalizeNeuralModuleKey } from "./neural-module-utils.mjs";

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
  const rawDraftText = optionalText(
    input.raw_draft_text ?? input.rawDraftText,
    "raw_draft_text",
    chatOutputMaxLength,
  );
  const suppliedChatOutput = input.chat_output_text ?? input.chatOutputText;
  const chatOutputText = suppliedChatOutput === undefined || suppliedChatOutput === null
    ? ""
    : requiredText(suppliedChatOutput, "chat_output_text", chatOutputMaxLength);
  if (!chatOutputText && !rawDraftText) throw new Error("chat_output_text is required.");
  return {
    sourceBundleId: optionalText(
      input.source_bundle_id ?? input.sourceBundleId,
      "source_bundle_id",
      200,
    ),
    chatOutputText,
    rawDraftText,
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

export function resolveWritingCandidatePaths(candidateId, options = {}) {
  return candidatePaths(candidateId, rootsFor(options));
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
      bundle: null,
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
    bundle: source.bundle,
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
    guard_report_display: formatGuardReportForDisplay(metadata.guard_report ?? []),
  };
}

function finalPolisherResultFromOrchestration(orchestrationResult) {
  return {
    status: orchestrationResult.post_generation.status,
    polished_text: orchestrationResult.candidate_output.final_candidate_text,
    revision_report: orchestrationResult.post_generation.final_polisher_revision_report,
    needs_structural_revision: orchestrationResult.post_generation.needs_structural_revision,
    suggested_return_stage: orchestrationResult.post_generation.suggested_return_stage,
    warnings: orchestrationResult.orchestration_report.warnings ?? [],
    orchestration_report: orchestrationResult.orchestration_report,
  };
}

async function resolveCandidateOutputText(input, trace, options) {
  if (!input.rawDraftText) {
    return {
      candidateText: input.chatOutputText,
      finalPolisherResult: null,
      orchestrationResult: null,
      warnings: [],
    };
  }

  if (trace.bundle) {
    const orchestrationResult = await buildFullNeuralWritingOrchestration({
      task_prompt: input.taskPrompt || trace.bundle.task_prompt || "Save ChatGPT raw draft as writing candidate.",
      generation_context: trace.bundle.inputs?.generation_context ?? {},
      retrieval_context: trace.bundle.inputs?.retrieval_context ?? {},
      raw_draft_text: input.rawDraftText,
      chapter_mode: trace.bundle.chapter_mode ?? "next_chapter",
      output_mode: "candidate_save_later",
      include_writing_card_director: true,
    }, {
      ...options,
      existingContextResult: {
        bundle: trace.bundle,
        context_bundle_path: trace.source_bundle_path,
        context_for_chat_path: trace.context_for_chat_path,
      },
      finalPolisherEditorialAdapter: options.finalPolisherEditorialAdapter,
    });

    const finalPolisherResult = finalPolisherResultFromOrchestration(orchestrationResult);
    if (!orchestrationResult.candidate_output.ready) {
      return {
        candidateText: "",
        finalPolisherResult,
        orchestrationResult,
        warnings: [
          "full_neural_orchestrator_did_not_produce_candidate",
          ...(orchestrationResult.orchestration_report.warnings ?? []),
        ],
      };
    }

    return {
      candidateText: orchestrationResult.candidate_output.final_candidate_text,
      finalPolisherResult,
      orchestrationResult,
      warnings: orchestrationResult.orchestration_report.warnings ?? [],
    };
  }

  const result = runFinalPolisherEditorialBrain({
    raw_draft_text: input.rawDraftText,
    writing_card_director_context: trace.bundle?.content?.writing_card_director_context ?? null,
    generation_context: trace.bundle?.inputs?.generation_context ?? {},
    retrieval_context: trace.bundle?.inputs?.retrieval_context ?? {},
  }, {
    editorialAdapter: options.finalPolisherEditorialAdapter,
  });
  if (result.status !== "completed" || !result.polished_text) {
    return {
      candidateText: "",
      finalPolisherResult: result,
      orchestrationResult: null,
      warnings: [
        "final_polisher_did_not_complete",
        ...(result.warnings ?? []),
      ],
    };
  }
  return {
    candidateText: result.polished_text,
    finalPolisherResult: result,
    orchestrationResult: null,
    warnings: result.warnings ?? [],
  };
}

export async function saveChatOutputAsWritingCandidate(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const roots = rootsFor(options);
  const trace = await bundleTrace(input.sourceBundleId, options);
  const {
    candidateText,
    finalPolisherResult,
    warnings: finalPolisherWarnings,
    orchestrationResult,
  } = await resolveCandidateOutputText(input, trace, options);
  if (input.rawDraftText && (!candidateText || finalPolisherResult?.status !== "completed")) {
    return {
      candidate_created: false,
      canon_status: "blocked",
      adopted: false,
      settled: false,
      proofed: false,
      source_bundle_id: trace.source_bundle_id,
      final_polisher_result: finalPolisherResult,
      full_neural_orchestration_report: orchestrationResult?.orchestration_report ?? null,
      needs_structural_revision: finalPolisherResult?.needs_structural_revision === true,
      suggested_return_stage: finalPolisherResult?.suggested_return_stage ?? null,
      warnings: finalPolisherWarnings,
    };
  }
  const candidateHash = sha256(candidateText);
  // Attempt to inherit any neural trace / neural modules used info from the
  // source context bundle so candidate metadata reflects actual traces when
  // present. We normalize module names to the base module name (without the
  // `run_` wrapper prefix) because pipeline metadata matching strips the
  // wrapper prefix when comparing.
  const extractNeuralUsageFromBundle = (bundle) => {
    if (!bundle || typeof bundle !== "object") return {};
    // direct list of used modules (could be 'run_scene_planner' or 'scene_planner')
    const candidates = bundle.neural_modules_used ?? bundle.neuralModulesUsed ?? null;
    if (Array.isArray(candidates) && candidates.length) {
      return {
        neural_modules_used: candidates.map((n) => normalizeNeuralModuleKey(n)).filter(Boolean),
      };
    }
    // some bundles may include a neural_trace structure listing module entries
    const traceObj = bundle.neural_trace ?? bundle.neuralTrace ?? bundle.content?.neural_trace ?? null;
    if (Array.isArray(traceObj) && traceObj.length) {
      const used = traceObj.map((entry) => {
        if (!entry) return null;
        if (typeof entry === "string") return entry;
        return entry.module || entry.name || entry.wrapper || null;
      }).filter(Boolean).map((n) => normalizeNeuralModuleKey(n));
      if (used.length) return { neural_modules_used: used };
    }
    return {};
  };

  const neuralUsage = extractNeuralUsageFromBundle(trace.bundle);
  const pipelineMetadata = buildEnginePipelineMetadata(trace.bundle, neuralUsage);
  const warnings = [
    ...(trace.warning ? [trace.warning] : []),
    ...pipelineMetadata.warnings,
    ...finalPolisherWarnings,
  ];
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
      final_polisher_result: finalPolisherResult,
      full_neural_orchestration_report: orchestrationResult?.orchestration_report ?? null,
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
    raw_draft_hash: input.rawDraftText ? sha256(input.rawDraftText) : null,
    polished_text_hash: finalPolisherResult ? sha256(candidateText) : null,
    final_polisher_status: finalPolisherResult?.status ?? null,
    final_polisher_revision_report: finalPolisherResult?.revision_report ?? null,
    full_neural_orchestrator_version:
      orchestrationResult?.orchestration_report?.orchestration_version ?? null,
    full_neural_pipeline_stage: orchestrationResult?.pipeline_stage ?? null,
    full_neural_orchestration_report: orchestrationResult?.orchestration_report ?? null,
    candidate_hash: candidateHash,
    candidate_chars: candidateText.length,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    proofed: false,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    adoption_allowed_without_approval: false,
    settlement_allowed_without_adoption: false,
    local_generation_used: false,
    ...pipelineMetadata,
    // Inherit writing_card_director context if present in source bundle
    writing_card_director_context: trace.bundle?.content?.writing_card_director_context ?? null,
    content_path: normalizeProjectPath(paths.content),
    metadata_path: normalizeProjectPath(paths.metadata),
    warnings,
  };

  // Run Wrong-Cast guard evaluation if we have bundle context
  try {
    if (trace.bundle && typeof evaluateCandidateAgainstAnchor === "function") {
      const evalResult = evaluateCandidateAgainstAnchor(trace.bundle, candidateText);
      if (process.env.DEBUG_BRIDGE === "1" || process.env.BRIDGE_VERBOSE === "1") {
        console.error("DEBUG_BRIDGE: evaluateCandidateAgainstAnchor result:", JSON.stringify(evalResult, null, 2));
        console.error("DEBUG_BRIDGE: extracted chapter_anchor:", JSON.stringify(trace.bundle.content?.chapter_anchor ?? {}, null, 2));
        console.error("DEBUG_BRIDGE: candidate text preview:", candidateText.slice(0, 200));
      }
      metadata.guard_report = evalResult.guard_report || [];
      metadata.guard_report_display = formatGuardReportForDisplay(metadata.guard_report);
      if (evalResult.blocked) {
        metadata.canon_status = "blocked";
        metadata.adoption_allowed_without_approval = false;
        metadata.warnings = metadata.warnings.concat(["candidate_blocked_by_guard"]);
      }
    }
  } catch (err) {
    metadata.warnings.push(`guard_evaluation_failed: ${err.message}`);
  }
  await commitFileTransaction("save-chat-output-writing-candidate", [
    { filePath: paths.content, content: `${candidateText}\n` },
    { filePath: paths.metadata, content: `${JSON.stringify(metadata, null, 2)}\n` },
  ], { candidate_id: candidateId, phase: "phase_22v_orchestrator_candidate_save_bridge" });
  return {
    ...publicResult(metadata),
    candidate_created: true,
    final_polisher_result: finalPolisherResult,
    full_neural_orchestration_report: orchestrationResult?.orchestration_report ?? null,
    warnings,
    // NOTE: do not set top-level `blocked` here — saving a candidate should succeed and
    // record guard_report in metadata so readiness/adoption gates can block later.
    guard_report: metadata.guard_report ?? [],
    guard_report_display: formatGuardReportForDisplay(metadata.guard_report ?? []),
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
    guard_report_display: formatGuardReportForDisplay(metadata.guard_report ?? []),
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
