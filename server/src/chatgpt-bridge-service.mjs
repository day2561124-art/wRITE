import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  saveChatOutputAsSettlementReport,
} from "./adopted-writing-settlement-service.mjs";
import { requestWritingCandidateAdoption } from "./candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "./candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "./chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "./gpt-writing-context-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const defaultMaxChars = 120_000;
const maximumMaxChars = 250_000;

export const chatgptBridgeSafety = Object.freeze({
  bridge_phase: "phase_14a_lite",
  can_generate_locally: false,
  can_call_external_llm: false,
  can_modify_active_engine: false,
  can_modify_compressed_rules: false,
  can_apply_compressed_rules: false,
  can_activate_engine: false,
  can_approve: false,
  can_confirm_adoption: false,
  can_restore: false,
  can_rollback: false,
  can_execute_cleanup: false,
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function optionalInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximumMaxChars) {
    throw new Error(`${label} must be an integer between 1 and ${maximumMaxChars}.`);
  }
  return value;
}

function rootOption(options, key, fallback, allowedRoot = projectPaths.outputs) {
  return options[key]
    ? assertPathInside(options[key], allowedRoot, `${key} test root`)
    : fallback;
}

function bridgeRoots(options = {}) {
  return {
    gptWritingContexts: rootOption(
      options,
      "gptWritingContexts",
      projectPaths.gptWritingContexts,
    ),
    writingCandidates: rootOption(
      options,
      "writingCandidates",
      projectPaths.writingCandidates,
    ),
    proofingContexts: rootOption(
      options,
      "proofingContexts",
      projectPaths.proofingContexts,
    ),
    proofReports: rootOption(options, "proofReports", projectPaths.proofReports),
    approvalQueue: rootOption(
      options,
      "approvalQueue",
      projectPaths.approvalQueue,
      projectPaths.approvalQueue,
    ),
    adoptedWritings: rootOption(
      options,
      "adoptedWritings",
      projectPaths.adoptedWritings,
    ),
    settlementContexts: rootOption(
      options,
      "settlementContexts",
      projectPaths.adoptedWritingSettlementContexts,
    ),
    settlementReports: rootOption(
      options,
      "settlementReports",
      projectPaths.adoptedWritingSettlementReports,
    ),
  };
}

async function fileSnapshot(filePath, includeText, maxChars) {
  try {
    const [content, fileStat] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    const truncated = content.length > maxChars;
    return {
      path: normalizeProjectPath(filePath),
      exists: true,
      chars: content.length,
      sha256: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      text: includeText ? content.slice(0, maxChars) : undefined,
      truncated: includeText && truncated,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      path: normalizeProjectPath(filePath),
      exists: false,
      chars: 0,
      sha256: null,
      modified_at: null,
      text: includeText ? "" : undefined,
      truncated: false,
    };
  }
}

async function countEntries(directory, pattern = null) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => (
      (entry.isDirectory() || entry.isFile()) && (!pattern || pattern.test(entry.name))
    )).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export async function getChatgptBridgeWorkbenchStatus(options = {}) {
  const roots = bridgeRoots(options);
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  const compressedRulesPath = options.compressedRulesPath
    ? assertPathInside(
      options.compressedRulesPath,
      projectPaths.errorReportDb,
      "compressed rules test path",
    )
    : projectPaths.compressedRules;
  const [activeEngine, compressedRules, counts] = await Promise.all([
    fileSnapshot(activeEnginePath, false, 1),
    fileSnapshot(compressedRulesPath, false, 1),
    Promise.all([
      countEntries(roots.gptWritingContexts, /^gptctx_/u),
      countEntries(roots.writingCandidates, /^writing_candidate_/u),
      countEntries(roots.proofingContexts, /^proofctx_/u),
      countEntries(roots.proofReports, /^proof_report_/u),
      countEntries(roots.approvalQueue, /\.json$/u),
      countEntries(roots.adoptedWritings, /^adopted_chapter_/u),
      countEntries(roots.settlementContexts, /^settlement_ctx_/u),
      countEntries(roots.settlementReports, /^settlement_report_/u),
    ]),
  ]);
  return {
    bridge_phase: chatgptBridgeSafety.bridge_phase,
    active_engine: activeEngine,
    compressed_rules: compressedRules,
    records: {
      writing_contexts: counts[0],
      writing_candidates: counts[1],
      proofing_contexts: counts[2],
      proof_reports: counts[3],
      approval_items: counts[4],
      adopted_writings: counts[5],
      settlement_contexts: counts[6],
      settlement_reports: counts[7],
    },
    active_engine_modified: false,
    compressed_rules_modified: false,
    safety: chatgptBridgeSafety,
  };
}

export async function getChatgptBridgeCurrentInputs(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const includeText = optionalBoolean(
    rawInput.include_text ?? rawInput.includeText,
    true,
    "include_text",
  );
  const includeActiveEngineMetadata = optionalBoolean(
    rawInput.include_active_engine_metadata ?? rawInput.includeActiveEngineMetadata,
    true,
    "include_active_engine_metadata",
  );
  const includeActiveEngineText = optionalBoolean(
    rawInput.include_active_engine_text ?? rawInput.includeActiveEngineText,
    false,
    "include_active_engine_text",
  );
  const maxChars = optionalInteger(
    rawInput.max_chars ?? rawInput.maxChars,
    defaultMaxChars,
    "max_chars",
  );
  const outputRoot = options.outputs
    ? assertPathInside(options.outputs, projectPaths.outputs, "outputs test root")
    : projectPaths.outputs;
  const inputs = await Promise.all([
    ["task_prompt", path.join(outputRoot, "task_prompt.md")],
    ["generation_context", path.join(outputRoot, "generation_context.md")],
    ["retrieval_context", path.join(outputRoot, "retrieval_context.md")],
  ].map(async ([label, filePath]) => [
    label,
    await fileSnapshot(filePath, includeText, maxChars),
  ]));
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  return {
    inputs: Object.fromEntries(inputs),
    active_engine: includeActiveEngineMetadata
      ? await fileSnapshot(activeEnginePath, includeActiveEngineText, maxChars)
      : null,
    max_chars: maxChars,
    safety: chatgptBridgeSafety,
  };
}

function textToContext(snapshot) {
  if (!snapshot?.exists || typeof snapshot.text !== "string" || !snapshot.text) return {};
  return {
    source_path: snapshot.path,
    source_sha256: snapshot.sha256,
    content: snapshot.text,
    truncated: snapshot.truncated,
  };
}

export async function buildChatgptBridgeWritingContext(rawInput = {}, options = {}) {
  const useCurrentInputs = optionalBoolean(
    rawInput.use_current_inputs ?? rawInput.useCurrentInputs,
    true,
    "use_current_inputs",
  );
  let current = null;
  if (useCurrentInputs) {
    current = await getChatgptBridgeCurrentInputs({
      includeText: true,
      includeActiveEngineMetadata: false,
      maxChars: rawInput.max_context_chars ?? rawInput.maxContextChars,
    }, options);
  }
  const taskPrompt = rawInput.task_prompt
    ?? rawInput.taskPrompt
    ?? current?.inputs.task_prompt.text
    ?? "";
  const result = await buildGptWritingContext({
    ...rawInput,
    taskPrompt,
    generationContext: rawInput.generation_context
      ?? rawInput.generationContext
      ?? textToContext(current?.inputs.generation_context),
    retrievalContext: rawInput.retrieval_context
      ?? rawInput.retrievalContext
      ?? textToContext(current?.inputs.retrieval_context),
    includeActiveEngine: rawInput.include_active_engine
      ?? rawInput.includeActiveEngine
      ?? false,
  }, options);
  return { ...result, generated_locally: false, safety: chatgptBridgeSafety };
}

export async function saveChatgptBridgeCandidate(input = {}, options = {}) {
  const result = await saveChatOutputAsWritingCandidate({
    ...input,
    source: input.source ?? "chatgpt",
    chapterLabel: input.chapter ?? input.chapter_label ?? input.chapterLabel,
  }, options);
  return { ...result, candidate_only: true, safety: chatgptBridgeSafety };
}

export async function buildChatgptBridgeProofingContext(input = {}, options = {}) {
  const result = await buildCandidateProofingContext({
    ...input,
    includeActiveEngine: input.include_active_engine
      ?? input.includeActiveEngine
      ?? false,
  }, options);
  return { ...result, generated_locally: false, safety: chatgptBridgeSafety };
}

export async function saveChatgptBridgeProofReport(input = {}, options = {}) {
  const result = await saveChatOutputAsProofReport({
    ...input,
    source: input.source ?? "chatgpt",
  }, options);
  return { ...result, candidate_only: true, safety: chatgptBridgeSafety };
}

export async function requestChatgptBridgeAdoption(input = {}, options = {}) {
  const result = await requestWritingCandidateAdoption({
    ...input,
    requestSource: "chatgpt_bridge",
    sourcePhase: "phase_14a_lite",
    verifiedBy: "phase_14b_e2e_dry_run",
  }, options);
  return {
    ...result,
    adopted: false,
    next_action:
      "Open the Writer Workbench approval queue and explicitly confirm this adoption request.",
    safety: chatgptBridgeSafety,
  };
}

export async function buildChatgptBridgeSettlementContext(input = {}, options = {}) {
  const result = await buildAdoptedWritingSettlementContext({
    ...input,
    includeActiveEngine: input.include_active_engine
      ?? input.includeActiveEngine
      ?? false,
  }, options);
  return { ...result, generated_locally: false, safety: chatgptBridgeSafety };
}

export async function saveChatgptBridgeSettlementReport(input = {}, options = {}) {
  const result = await saveChatOutputAsSettlementReport({
    ...input,
    source: input.source ?? "chatgpt",
  }, options);
  return {
    ...result,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    safety: chatgptBridgeSafety,
  };
}
