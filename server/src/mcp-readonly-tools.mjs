import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertAgentRunId,
} from "./agent-run-service.mjs";
import {
  getPendingCandidate,
  isSafeCandidateId,
  activeEngineStatus,
  listActivationLogs,
} from "./engine-candidate-service.mjs";
import {
  getAdoptedChapter,
  getCandidateDraft,
  getProofReport,
  isSafeAdoptedChapterId,
  isSafeDraftId,
  isSafeProofId,
} from "./writing-workflow-service.mjs";
import {
  getSettlementContext,
  getSettlementReport,
  isSafeSettlementContextId,
  isSafeSettlementReportId,
} from "./settlement-workflow-service.mjs";
import {
  getApprovalItem,
  isSafeApprovalItemId,
} from "./approval-queue-service.mjs";
import {
  getCleanupProposal,
  isSafeCleanupProposalId,
} from "./cleanup-proposal-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import { sourceFilePath } from "./source-registry.mjs";
import {
  buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness,
} from "./chatgpt-native-neural-writing-handoff-service.mjs";

const readonlyNames = [
  "get_project_status",
  "get_active_engine",
  "get_active_writing_card",
  "get_active_proofing_card",
  "get_active_longline",
  "get_generation_context",
  "get_retrieval_context",
  "get_task_prompt",
  "get_latest_candidate_draft",
  "get_latest_proof_report",
  "get_latest_adopted_chapter",
  "get_latest_settlement_context",
  "get_latest_settlement_report",
  "get_pending_engine_candidates",
  "get_approval_queue_status",
  "get_neural_usage_for_run",
  "get_cleanup_proposals",
  "preview_visual_reference_consumer_output_guard",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function baseResult(toolName, data, sources = [], warnings = [], canonStatus = "read_only") {
  return {
    ok: true,
    tool_name: toolName,
    canon_status: canonStatus,
    blocked: false,
    blocked_reason: null,
    data,
    sources,
    warnings,
  };
}

function blockedResult(toolName, reason, sources = [], warnings = []) {
  return {
    ok: false,
    tool_name: toolName,
    canon_status: "blocked",
    blocked: true,
    blocked_reason: reason,
    data: null,
    sources,
    warnings,
  };
}

function optionsRoots(options = {}) {
  const writingWorkflow = options.writingWorkflow
    ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow root")
    : projectPaths.writingWorkflow;
  const canonDb = options.canonDb
    ? assertPathInside(options.canonDb, projectPaths.canonDb, "canon root")
    : projectPaths.canonDb;
  const approvalQueue = options.approvalQueue
    ? assertPathInside(options.approvalQueue, projectPaths.approvalQueue, "approval queue root")
    : projectPaths.approvalQueue;
  const cleanupRoot = options.cleanupRoot
    ? assertPathInside(options.cleanupRoot, projectPaths.cleanupRoot, "cleanup root")
    : projectPaths.cleanupRoot;
  return {
    activeEngine: options.activeEnginePath
      ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine")
      : projectPaths.activeEngine,
    writingWorkflow,
    candidateDrafts: path.join(writingWorkflow, "candidate_drafts"),
    proofReports: path.join(writingWorkflow, "proof_reports"),
    adoptedChapters: path.join(writingWorkflow, "adopted_chapters"),
    settlementContexts: path.join(writingWorkflow, "settlements", "contexts"),
    settlementReports: path.join(writingWorkflow, "settlements", "reports"),
    canonDb,
    pendingEngineCandidates: options.pendingEngineCandidates
      ? assertPathInside(options.pendingEngineCandidates, projectPaths.canonDb, "pending candidates")
      : path.join(canonDb, "pending_engine_candidates"),
    activationLog: options.activationLog
      ? assertPathInside(options.activationLog, projectPaths.canonDb, "activation log")
      : path.join(canonDb, "activation_logs", "activation_log.jsonl"),
    approvalQueue,
    approvalItems: path.join(approvalQueue, "items"),
    cleanupRoot,
    cleanupProposals: path.join(cleanupRoot, "proposals"),
    agentRuns: projectPaths.agentRuns,
    neuralTraces: projectPaths.neuralTraces,
  };
}

async function safeReadDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function latestDirectoryId(directory, isSafeId, sortKey = "created_at") {
  const entries = await safeReadDirectory(directory);
  const ids = entries.filter((entry) => entry.isDirectory() && isSafeId(entry.name))
    .map((entry) => entry.name);
  if (sortKey === "id") return ids.sort((a, b) => b.localeCompare(a))[0] ?? "";
  return ids[0] ?? "";
}

async function sourceForPath(label, filePath, canonStatus) {
  return describeSourceFile(label, filePath, canonStatus);
}

export async function describeSourceFile(label, filePath, canonStatus) {
  const resolved = assertPathInside(filePath, projectRoot, `${label} source`);
  try {
    const [content, stats] = await Promise.all([readFile(resolved), stat(resolved)]);
    return {
      label,
      source_path: normalizeProjectPath(resolved),
      exists: true,
      modified_at: stats.mtime.toISOString(),
      hash: sha256(content),
      size: stats.size,
      canon_status: canonStatus,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      source_path: normalizeProjectPath(resolved),
      exists: false,
      modified_at: null,
      hash: null,
      size: 0,
      canon_status: "missing",
    };
  }
}

async function readTextTool(toolName, label, filePath, canonStatus, blockedWhenMissing = false) {
  const source = await sourceForPath(label, filePath, canonStatus);
  if (!source.exists && blockedWhenMissing) return blockedResult(toolName, `${label}_missing`, [source]);
  const warnings = source.exists ? [] : [`${label}_missing`];
  const content = source.exists ? await readFile(filePath, "utf8") : "";
  return baseResult(toolName, {
    content,
    hash: source.hash,
    canon_status: source.canon_status,
  }, [source], warnings, source.exists ? canonStatus : "missing");
}

export async function get_active_engine(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return readTextTool(
    "get_active_engine",
    "active_engine",
    roots.activeEngine,
    "active",
    true,
  );
}

export async function get_active_writing_card() {
  return readTextTool(
    "get_active_writing_card",
    "active_writing_card",
    sourceFilePath("active_writing_card"),
    "policy",
  );
}

export async function get_active_proofing_card() {
  return readTextTool(
    "get_active_proofing_card",
    "active_proofing_card",
    sourceFilePath("active_proofing_card"),
    "policy",
  );
}

export async function get_active_longline() {
  return readTextTool(
    "get_active_longline",
    "active_longline",
    sourceFilePath("active_longline"),
    "policy",
  );
}

export async function get_generation_context() {
  return readTextTool(
    "get_generation_context",
    "generation_context",
    path.join(projectPaths.outputs, "generation_context.md"),
    "working",
  );
}

export async function get_retrieval_context() {
  return readTextTool(
    "get_retrieval_context",
    "retrieval_context",
    path.join(projectPaths.outputs, "retrieval_context.md"),
    "working",
  );
}

export async function get_task_prompt() {
  return readTextTool(
    "get_task_prompt",
    "task_prompt",
    path.join(projectPaths.outputs, "task_prompt.md"),
    "working",
  );
}

function inactiveStatus(status) {
  return ["rejected", "archived", "blocked", "unknown", "quarantined"].includes(status);
}

async function latestRecord(toolName, directory, isSafeId, getter, options, mapper, sourceLabel) {
  const ids = (await safeReadDirectory(directory))
    .filter((entry) => entry.isDirectory() && isSafeId(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  const warnings = [];
  for (const id of ids) {
    try {
      const record = await getter(id, options);
      const mapped = mapper(record, id);
      return baseResult(toolName, mapped.data, mapped.sources, mapped.warnings ?? warnings, mapped.canonStatus);
    } catch (error) {
      warnings.push(`${id}: ${error.message}`);
    }
  }
  return baseResult(toolName, null, [], warnings.length ? warnings : [`${sourceLabel}_not_found`], "missing");
}

export async function get_latest_candidate_draft(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return latestRecord(
    "get_latest_candidate_draft",
    roots.candidateDrafts,
    isSafeDraftId,
    getCandidateDraft,
    options,
    (draft, id) => {
      const status = draft.status.status;
      return {
        canonStatus: inactiveStatus(status) ? "inactive_candidate" : "candidate",
        data: {
          draft_id: id,
          draft_text: draft.draft_text,
          metadata: draft.metadata,
          status: draft.status,
          neural_usage: draft.neural_usage,
          active_canon: false,
        },
        sources: [{
          label: "candidate_draft",
          source_path: normalizeProjectPath(path.join(roots.candidateDrafts, id)),
          exists: true,
          modified_at: draft.metadata.created_at ?? null,
          hash: draft.metadata.draft_hash ?? null,
          size: draft.draft_text.length,
          canon_status: inactiveStatus(status) ? "inactive_candidate" : "candidate",
        }],
      };
    },
    "candidate_draft",
  );
}

export async function get_latest_proof_report(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return latestRecord(
    "get_latest_proof_report",
    roots.proofReports,
    isSafeProofId,
    getProofReport,
    options,
    (proof, id) => ({
      canonStatus: "proof_report",
      data: {
        proof_id: id,
        proof_text: proof.proof_text,
        metadata: proof.metadata,
        status: proof.status,
        issue_summary: proof.issue_summary,
        neural_usage: proof.neural_usage,
        active_canon: false,
      },
      sources: [{
        label: "proof_report",
        source_path: normalizeProjectPath(path.join(roots.proofReports, id)),
        exists: true,
        modified_at: proof.metadata.created_at ?? null,
        hash: proof.metadata.proof_hash ?? null,
        size: proof.proof_text.length,
        canon_status: "proof_report",
      }],
    }),
    "proof_report",
  );
}

export async function get_latest_adopted_chapter(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return latestRecord(
    "get_latest_adopted_chapter",
    roots.adoptedChapters,
    isSafeAdoptedChapterId,
    getAdoptedChapter,
    options,
    (chapter, id) => ({
      canonStatus: "adopted_pending_settlement",
      data: {
        adopted_chapter_id: id,
        chapter_text: chapter.chapter_text,
        metadata: chapter.metadata,
        status: chapter.status,
        active_canon: false,
      },
      sources: [{
        label: "adopted_chapter",
        source_path: normalizeProjectPath(path.join(roots.adoptedChapters, id)),
        exists: true,
        modified_at: chapter.metadata.adopted_at ?? null,
        hash: chapter.metadata.chapter_hash ?? null,
        size: chapter.chapter_text.length,
        canon_status: "adopted_pending_settlement",
      }],
    }),
    "adopted_chapter",
  );
}

export async function get_latest_settlement_context(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return latestRecord(
    "get_latest_settlement_context",
    roots.settlementContexts,
    isSafeSettlementContextId,
    getSettlementContext,
    options,
    (context, id) => ({
      canonStatus: "settlement_context",
      data: { settlement_context_id: id, ...context, active_canon: false },
      sources: context.source_manifest?.sources ?? [{
        label: "settlement_context",
        source_path: normalizeProjectPath(path.join(roots.settlementContexts, id)),
        exists: true,
        modified_at: context.metadata.created_at ?? null,
        hash: context.metadata.context_hash ?? null,
        size: context.settlement_context_text.length,
        canon_status: "settlement_context",
      }],
    }),
    "settlement_context",
  );
}

export async function get_latest_settlement_report(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  return latestRecord(
    "get_latest_settlement_report",
    roots.settlementReports,
    isSafeSettlementReportId,
    getSettlementReport,
    options,
    (report, id) => ({
      canonStatus: "settlement_report",
      data: { settlement_report_id: id, ...report, active_canon: false },
      sources: [{
        label: "settlement_report",
        source_path: normalizeProjectPath(path.join(roots.settlementReports, id)),
        exists: true,
        modified_at: report.metadata.created_at ?? null,
        hash: report.metadata.settlement_hash ?? null,
        size: report.settlement_text.length,
        canon_status: "settlement_report",
      }],
    }),
    "settlement_report",
  );
}

export async function get_pending_engine_candidates(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  const entries = await safeReadDirectory(roots.pendingEngineCandidates);
  const candidates = [];
  const warnings = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeCandidateId(entry.name)) continue;
    try {
      const candidate = await getPendingCandidate(entry.name, options);
      const status = candidate.status.status;
      candidates.push({
        candidate_id: entry.name,
        source_chapter: candidate.metadata.source_chapter,
        status,
        risk_level: candidate.risk_report.risk_level,
        active_canon: false,
        blocked: status === "blocked" || candidate.risk_report.risk_level === "critical",
        metadata: candidate.metadata,
        diff: candidate.diff,
        risk_report: candidate.risk_report,
      });
    } catch (error) {
      warnings.push(`${entry.name}: ${error.message}`);
    }
  }
  return baseResult("get_pending_engine_candidates", {
    count: candidates.length,
    candidates,
  }, [{
    label: "pending_engine_candidates",
    source_path: normalizeProjectPath(roots.pendingEngineCandidates),
    exists: entries.length > 0,
    modified_at: null,
    hash: null,
    size: candidates.length,
    canon_status: "pending_only",
  }], warnings, "pending_only");
}

export async function get_approval_queue_status(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  const entries = await safeReadDirectory(roots.approvalItems);
  const counts = { pending: 0, blocked: 0, deferred: 0, rejected: 0, resolved: 0, confirmed: 0 };
  const items = [];
  const warnings = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeApprovalItemId(entry.name)) continue;
    try {
      const item = await getApprovalItem(entry.name, options);
      const status = item.status.status;
      counts[status] = (counts[status] ?? 0) + 1;
      items.push({
        approval_item_id: entry.name,
        action_type: item.action_type,
        target_type: item.target_type,
        target_id: item.target_id,
        status,
        risk_level: item.risk_level,
        blocked_reason: item.blocked_reason,
      });
    } catch (error) {
      warnings.push(`${entry.name}: ${error.message}`);
    }
  }
  return baseResult("get_approval_queue_status", { counts, items }, [], warnings, "approval_queue");
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function get_neural_usage_for_run(input = {}) {
  const runId = assertAgentRunId(input.run_id ?? input.runId);
  const runPath = path.join(projectPaths.agentRuns, runId, "run.json");
  const modulesPath = path.join(projectPaths.agentRuns, runId, "neural_modules_used.json");
  const run = await readJsonIfExists(runPath, null);
  if (!run) return blockedResult("get_neural_usage_for_run", "agent_run_missing");
  const modules = await readJsonIfExists(modulesPath, { neural_modules_used: [] });
  const traceEntries = await safeReadDirectory(projectPaths.neuralTraces);
  const traces = [];
  for (const entry of traceEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const trace = await readJsonIfExists(path.join(projectPaths.neuralTraces, entry.name), null);
    if (trace?.run_id === runId) traces.push(trace);
  }
  const successfulModules = [...new Set(
    traces.filter((trace) => trace.status === "success").map((trace) => trace.module_name),
  )];
  const missing = run.requires_neural_modules
    ? run.required_neural_modules.filter((moduleName) => !successfulModules.includes(moduleName))
    : [];
  return baseResult("get_neural_usage_for_run", {
    run,
    neural_modules_used: modules.neural_modules_used ?? [],
    traces,
    trace_count: traces.length,
    success_count: traces.filter((trace) => trace.status === "success").length,
    failed_count: traces.filter((trace) => trace.status === "failed").length,
    skipped_count: traces.filter((trace) => trace.status === "skipped").length,
    used_neural_network: successfulModules.length > 0,
    required_neural_modules: run.required_neural_modules,
    missing_required_neural_modules: missing,
    warning: missing.length > 0,
  }, [
    await describeSourceFile("agent_run", runPath, "agent_run"),
    await describeSourceFile("neural_modules_used", modulesPath, "neural_usage"),
  ], missing.length ? ["neural_trace_missing"] : [], "neural_usage");
}

export async function get_cleanup_proposals(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  const entries = await safeReadDirectory(roots.cleanupProposals);
  const proposals = [];
  const warnings = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeCleanupProposalId(entry.name)) continue;
    try {
      const proposal = await getCleanupProposal(entry.name, options);
      proposals.push({
        cleanup_proposal_id: entry.name,
        title: proposal.title,
        status: proposal.status.status,
        risk_summary: proposal.risk_summary,
        can_execute: proposal.status.can_execute,
      });
    } catch (error) {
      warnings.push(`${entry.name}: ${error.message}`);
    }
  }
  return baseResult("get_cleanup_proposals", {
    count: proposals.length,
    proposals,
  }, [], warnings, "cleanup_proposal");
}

export async function preview_visual_reference_consumer_output_guard(input = {}) {
  const outputText = input.output_text ?? input.outputText ?? "";
  const consumerContract = input.consumer_contract ?? input.consumerContract ?? {};
  const packetId = input.packet_id ?? input.packetId ?? "mcp-preview-visual-reference-consumer-output-guard";
  const maxExcerptChars = input.max_excerpt_chars ?? input.maxExcerptChars ?? 600;
  const readiness = buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness(
    outputText,
    consumerContract,
    {
      packet_id: packetId,
      tool_name: "chatgpt_bridge_preview_visual_reference_consumer_output_guard",
      max_excerpt_chars: maxExcerptChars,
    },
  );

  return baseResult(
    "preview_visual_reference_consumer_output_guard",
    {
      ...readiness,
      active_canon: false,
      mcp_tool_registered: true,
      mcp_tool_permission: "read_only",
      mcp_tool_writes_files: false,
      mcp_tool_can_modify_active_engine: false,
      mcp_tool_requires_user_confirmation: false,
    },
    [],
    [],
    "readonly_preview",
  );
}
async function countDirectories(directory, predicate = () => true) {
  return (await safeReadDirectory(directory))
    .filter((entry) => entry.isDirectory() && predicate(entry.name)).length;
}

export async function get_project_status(_input = {}, options = {}) {
  const roots = optionsRoots(options);
  const active = await activeEngineStatus({ activeEnginePath: roots.activeEngine });
  const latestActivation = await listActivationLogs({
    activeEnginePath: roots.activeEngine,
    activationLog: roots.activationLog,
  }).then((logs) => logs[0] ?? null).catch(() => null);
  const approval = await get_approval_queue_status({}, options);
  const cleanup = await get_cleanup_proposals({}, options);
  return baseResult("get_project_status", {
    active_engine: active,
    counts: {
      candidate_drafts: await countDirectories(roots.candidateDrafts, isSafeDraftId),
      proof_reports: await countDirectories(roots.proofReports, isSafeProofId),
      adopted_chapters: await countDirectories(roots.adoptedChapters, isSafeAdoptedChapterId),
      settlement_contexts: await countDirectories(roots.settlementContexts, isSafeSettlementContextId),
      settlement_reports: await countDirectories(roots.settlementReports, isSafeSettlementReportId),
      pending_engine_candidates: await countDirectories(roots.pendingEngineCandidates, isSafeCandidateId),
      approval_queue_pending: approval.data.counts.pending ?? 0,
      cleanup_proposals: cleanup.data.count,
    },
    latest_activation_log: latestActivation,
    full_workflow_smoke: {
      status: "available_in_tests",
      test_path: "tests/e2e/full-workflow-smoke.test.mjs",
    },
  }, [await describeSourceFile("active_engine", roots.activeEngine, active.active_engine_exists ? "active" : "missing")], [], "project_status");
}

export const readonlyTools = {
  get_project_status,
  get_active_engine,
  get_active_writing_card,
  get_active_proofing_card,
  get_active_longline,
  get_generation_context,
  get_retrieval_context,
  get_task_prompt,
  get_latest_candidate_draft,
  get_latest_proof_report,
  get_latest_adopted_chapter,
  get_latest_settlement_context,
  get_latest_settlement_report,
  get_pending_engine_candidates,
  get_approval_queue_status,
  get_neural_usage_for_run,
  get_cleanup_proposals,
  preview_visual_reference_consumer_output_guard,
};

export const readonlyToolMetadata = Object.fromEntries(readonlyNames.map((name) => [name, {
  permission: "read_only",
  writes_files: false,
  can_modify_active_engine: false,
  requires_user_confirmation: false,
}]));
