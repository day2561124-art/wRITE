import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  buildProofingContextBundle,
  getCandidateDraft,
  getProofReport,
} from "./writing-workflow-service.mjs";
import { buildSettlementContext } from "./settlement-workflow-service.mjs";
import {
  createApprovalItem,
  listApprovalItems,
} from "./approval-queue-service.mjs";
import { getPendingCandidate } from "./engine-candidate-service.mjs";
import { buildGptWritingContext } from "./gpt-writing-context-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

export const CREATIVE_TASK_TYPES = Object.freeze({
  GENERATE_WRITING_CANDIDATE: "generate_writing_candidate",
  PROOFREAD_WRITING_CANDIDATE: "proofread_writing_candidate",
  REQUEST_ADOPT_WRITING_CANDIDATE: "request_adopt_writing_candidate",
  BUILD_SETTLEMENT_CANDIDATE: "build_settlement_candidate",
  REQUEST_ENGINE_ACTIVATION: "request_engine_activation",
  QUERY_APPROVAL_QUEUE: "query_approval_queue",
});

const taskTypes = Object.freeze(Object.values(CREATIVE_TASK_TYPES));
const taskTypeSet = new Set(taskTypes);
const taskIdPattern = /^creative_task_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const safety = Object.freeze({
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  canon_update_allowed: false,
});

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createTaskId() {
  return `creative_task_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function optionalText(value, label, maxLength = 100_000) {
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

function optionalLimit(value) {
  if (value === undefined || value === null) return 20;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
  return value;
}

function normalizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  return {
    taskType: optionalText(input.task_type ?? input.taskType, "task_type", 100),
    taskPrompt: optionalText(input.task_prompt ?? input.taskPrompt, "task_prompt"),
    generationContext: optionalObject(
      input.generation_context ?? input.generationContext,
      "generation_context",
    ),
    retrievalContext: optionalObject(
      input.retrieval_context ?? input.retrievalContext,
      "retrieval_context",
    ),
    candidateId: optionalText(input.candidate_id ?? input.candidateId, "candidate_id", 200),
    adoptedChapterId: optionalText(
      input.adopted_chapter_id ?? input.adoptedChapterId,
      "adopted_chapter_id",
      200,
    ),
    settlementContextId: optionalText(
      input.settlement_context_id ?? input.settlementContextId,
      "settlement_context_id",
      200,
    ),
    pendingEngineCandidateId: optionalText(
      input.pending_engine_candidate_id ?? input.pendingEngineCandidateId,
      "pending_engine_candidate_id",
      200,
    ),
    approvalId: optionalText(input.approval_id ?? input.approvalId, "approval_id", 200),
    dryRun: input.dry_run === true || input.dryRun === true,
    reason: optionalText(input.reason, "reason", 5_000),
    status: optionalText(input.status, "status", 100),
    riskLevel: optionalText(input.risk_level ?? input.riskLevel, "risk_level", 100),
    limit: optionalLimit(input.limit),
  };
}

function rootsFor(options = {}) {
  const creativeTasks = options.creativeTasks
    ? assertPathInside(options.creativeTasks, projectPaths.outputs, "creative tasks test root")
    : projectPaths.creativeTasks;
  const creativeTaskLog = options.creativeTaskLog
    ? assertPathInside(options.creativeTaskLog, projectPaths.outputLogs, "creative task log")
    : projectPaths.creativeTaskLog;
  return { creativeTasks, creativeTaskLog };
}

function taskPaths(taskId, roots) {
  if (!taskIdPattern.test(taskId)) throw new Error("Invalid task_id.");
  const directory = path.join(roots.creativeTasks, taskId);
  return {
    directory,
    task: path.join(directory, "task.json"),
    bundle: path.join(directory, "task_bundle.json"),
  };
}

function workflowOptions(options = {}) {
  return {
    ...(options.writingWorkflow ? { writingWorkflow: options.writingWorkflow } : {}),
    ...(options.activeEnginePath ? { activeEnginePath: options.activeEnginePath } : {}),
    ...(options.pendingEngineCandidates
      ? { pendingEngineCandidates: options.pendingEngineCandidates }
      : {}),
  };
}

function approvalOptions(options = {}) {
  return {
    ...workflowOptions(options),
    ...(options.approvalQueue ? { approvalQueue: options.approvalQueue } : {}),
  };
}

async function sourceSnapshot(label, filePath, canonStatus) {
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: true,
      modified_at: fileStat.mtime.toISOString(),
      canon_status: canonStatus,
      content,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: false,
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
}

async function writingTaskBundle(input, taskId, options = {}) {
  const activeEngine = options.activeEnginePath ?? projectPaths.activeEngine;
  const sources = await Promise.all([
    sourceSnapshot("active_engine", activeEngine, "active"),
    sourceSnapshot(
      "active_writing_card",
      path.join(projectRoot, "data", "writing_policy_db", "active_writing_card.md"),
      "policy",
    ),
    sourceSnapshot(
      "active_longline",
      path.join(projectRoot, "data", "longline_db", "active_longline.md"),
      "reference",
    ),
  ]);
  const missing = sources.filter((source) => !source.exists).map((source) => source.label);
  return {
    task_id: taskId,
    task_type: input.taskType,
    created_at: new Date().toISOString(),
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    sources,
    output_target: normalizeProjectPath(path.join(
      rootsFor(options).creativeTasks,
      taskId,
      "task_result.json",
    )),
    canon_update_allowed: false,
    active_engine_update_allowed: false,
    warnings: missing.map((label) => `Missing source: ${label}`),
  };
}

function resultBase(taskId, taskType, status) {
  return {
    ok: true,
    task_id: taskId,
    task_type: taskType,
    status,
    permission: "creative_task",
    result: {},
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
    safety: { ...safety },
  };
}

function blockedResult(taskId, taskType, reason) {
  return {
    ...resultBase(taskId, taskType, "blocked"),
    ok: false,
    blocked: true,
    blocked_reason: reason,
  };
}

async function generateWritingCandidate(input, taskId, options) {
  const response = resultBase(taskId, input.taskType, input.dryRun ? "dry_run" : "pending");
  const context = await buildGptWritingContext({
    taskPrompt: input.taskPrompt,
    generationContext: input.generationContext,
    retrievalContext: input.retrievalContext,
    chapterMode: "next_chapter",
    outputMode: "chat_only",
  }, options);
  const bundle = {
    ...(await writingTaskBundle(input, taskId, options)),
    gpt_writing_context: context.bundle,
  };
  response.result = {
    execution: "not_executed",
    bundle_id: context.bundle.bundle_id,
    context_bundle_path: context.context_bundle_path,
    context_for_chat_path: context.context_for_chat_path,
    next_action:
      "ChatGPT / GPT may consume context_for_chat.md via MCP and output the writing candidate in chat.",
    local_generation_allowed: false,
    candidate_created: false,
  };
  response.warnings.push(
    "Phase 8B does not call an OpenAI or other LLM API and does not create a candidate draft.",
    ...context.bundle.warnings,
  );
  response.created.push({
    label: "gpt_writing_context",
    target_id: context.bundle.bundle_id,
    source_path: context.context_for_chat_path,
    canon_status: "working_context",
  });
  return { response, bundle };
}

async function proofreadWritingCandidate(input, taskId, options) {
  if (!input.candidateId) throw new Error("candidate_id is required.");
  const workflow = workflowOptions(options);
  const draft = await getCandidateDraft(input.candidateId, workflow);
  const context = input.dryRun
    ? null
    : await buildProofingContextBundle(input.candidateId, {}, workflow);
  const response = resultBase(taskId, input.taskType, input.dryRun ? "dry_run" : "pending");
  response.result = {
    execution: "not_executed",
    candidate_id: input.candidateId,
    draft_status: draft.status.status,
    proofing_context_bundle_id: context?.context_bundle?.context_bundle_id ?? null,
    next_action: "external proofreader may produce a proof report",
  };
  response.warnings.push(
    "Phase 8A prepares proofing context but does not synthesize or save a proof report.",
  );
  if (context) {
    response.created.push({
      label: "proofing_context_bundle",
      target_id: context.context_bundle.context_bundle_id,
      canon_status: "working_context",
    });
  }
  return { response, bundle: { draft: { metadata: draft.metadata, status: draft.status }, context } };
}

async function requestAdoptWritingCandidate(input, taskId, options) {
  if (!input.candidateId) throw new Error("candidate_id is required.");
  const workflow = workflowOptions(options);
  const draft = await getCandidateDraft(input.candidateId, workflow);
  const proof = draft.status.proof_report_id
    ? await getProofReport(draft.status.proof_report_id, workflow)
    : null;
  if (input.dryRun) {
    const response = resultBase(taskId, input.taskType, "dry_run");
    response.result = {
      candidate_id: input.candidateId,
      proof_report_id: proof?.metadata?.proof_id ?? null,
      would_create_approval_request: true,
    };
    return { response, bundle: { draft: draft.metadata, proof: proof?.issue_summary ?? null } };
  }
  const blockedReason = proof ? null : "candidate has no proof report";
  const item = await createApprovalItem({
    actionType: "adopt_p0_p1_draft",
    targetType: "candidate_draft",
    targetId: input.candidateId,
    sourceChapter: draft.metadata.source_chapter,
    title: "Creative task adoption request",
    summary: input.reason || "Creative task requested review before adopting a writing candidate.",
    riskLevel: "high",
    requiresSecondConfirmation: true,
    neuralStatus: "not_required",
    blockedReason,
    status: blockedReason ? "blocked" : "pending",
    impact: {
      will_modify: [],
      will_create: ["adopted_chapter"],
      rollback_available: false,
    },
    links: {
      draft_id: input.candidateId,
      proof_report_id: proof?.metadata?.proof_id ?? null,
    },
    details: {
      requested_by: "creative_task_orchestrator",
      issue_summary: proof?.issue_summary ?? null,
    },
  }, approvalOptions(options));
  const response = resultBase(taskId, input.taskType, item.status.status);
  response.result = {
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    status: item.status.status,
    risk_level: item.risk_level,
    target_id: item.target_id,
  };
  response.created.push({
    label: "approval_item",
    target_id: item.approval_item_id,
    canon_status: "approval_required",
  });
  if (blockedReason) {
    response.ok = false;
    response.status = "blocked";
    response.blocked = true;
    response.blocked_reason = blockedReason;
  }
  return { response, bundle: { draft: draft.metadata, proof: proof?.issue_summary ?? null } };
}

async function buildSettlementCandidate(input, taskId, options) {
  if (!input.adoptedChapterId) throw new Error("adopted_chapter_id is required.");
  if (input.dryRun) {
    const response = resultBase(taskId, input.taskType, "dry_run");
    response.result = {
      adopted_chapter_id: input.adoptedChapterId,
      would_build_settlement_context: true,
    };
    return { response, bundle: response.result };
  }
  const context = await buildSettlementContext(
    input.adoptedChapterId,
    { note: input.reason },
    workflowOptions(options),
  );
  const response = resultBase(
    taskId,
    input.taskType,
    context.status.status === "blocked" ? "blocked" : "pending",
  );
  response.result = {
    adopted_chapter_id: input.adoptedChapterId,
    settlement_context_id: context.metadata.settlement_context_id,
    context_status: context.status.status,
    pending_engine_candidate_id: null,
    next_action: "external settlement model may produce a settlement report",
  };
  response.created.push({
    label: "settlement_context",
    target_id: context.metadata.settlement_context_id,
    canon_status: "settlement_context",
  });
  response.warnings.push(
    "Phase 8A does not synthesize a settlement report or activate active_engine.md.",
  );
  if (context.status.status === "blocked") {
    response.ok = false;
    response.status = "blocked";
    response.blocked = true;
    response.blocked_reason = context.status.blocked_reason;
  }
  return { response, bundle: context };
}

async function requestEngineActivation(input, taskId, options) {
  if (!input.pendingEngineCandidateId) {
    throw new Error("pending_engine_candidate_id is required.");
  }
  const candidate = await getPendingCandidate(
    input.pendingEngineCandidateId,
    workflowOptions(options),
  );
  if (input.dryRun) {
    const response = resultBase(taskId, input.taskType, "dry_run");
    response.result = {
      pending_engine_candidate_id: input.pendingEngineCandidateId,
      candidate_status: candidate.status.status,
      would_create_approval_request: true,
    };
    return { response, bundle: response.result };
  }
  const blockedReason = candidate.status.status !== "candidate"
    ? candidate.status.blocked_reason || `candidate status: ${candidate.status.status}`
    : candidate.risk_report.risk_level === "critical"
      ? "critical candidate requires non-MCP review"
      : null;
  const item = await createApprovalItem({
    actionType: "activate_engine_candidate",
    targetType: "pending_engine_candidate",
    targetId: input.pendingEngineCandidateId,
    sourceChapter: candidate.metadata.source_chapter,
    title: "Creative task engine activation request",
    summary: input.reason || "Creative task requested engine candidate activation review.",
    riskLevel: candidate.risk_report.risk_level,
    requiresSecondConfirmation: candidate.risk_report.requires_second_confirmation === true,
    requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
    neuralStatus: "not_checked_by_creative_task",
    blockedReason,
    status: blockedReason ? "blocked" : "pending",
    impact: {
      will_modify: ["data/canon_db/active_engine.md"],
      will_create: ["snapshot", "archive", "activation_log"],
      rollback_available: true,
    },
    links: { candidate_id: input.pendingEngineCandidateId },
    details: {
      requested_by: "creative_task_orchestrator",
      candidate_status: candidate.status.status,
      diff: candidate.diff,
    },
  }, approvalOptions(options));
  const response = resultBase(taskId, input.taskType, item.status.status);
  response.result = {
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    status: item.status.status,
    risk_level: item.risk_level,
    target_id: item.target_id,
  };
  response.created.push({
    label: "approval_item",
    target_id: item.approval_item_id,
    canon_status: "approval_required",
  });
  if (blockedReason) {
    response.ok = false;
    response.status = "blocked";
    response.blocked = true;
    response.blocked_reason = blockedReason;
  }
  return { response, bundle: { candidate: candidate.metadata, risk_report: candidate.risk_report } };
}

async function queryApprovalQueue(input, taskId, options) {
  const items = (await listApprovalItems(approvalOptions(options)))
    .filter((item) => !input.status || item.status.status === input.status)
    .filter((item) => !input.riskLevel || item.risk_level === input.riskLevel)
    .filter((item) => !input.approvalId || item.approval_item_id === input.approvalId)
    .slice(0, input.limit);
  const response = resultBase(taskId, input.taskType, input.dryRun ? "dry_run" : "completed");
  response.result = {
    count: items.length,
    items: items.map((item) => ({
      approval_item_id: item.approval_item_id,
      action_type: item.action_type,
      target_id: item.target_id,
      status: item.status.status,
      risk_level: item.risk_level,
      blocked_reason: item.blocked_reason,
    })),
  };
  return { response, bundle: response.result };
}

async function executeTask(input, taskId, options) {
  switch (input.taskType) {
    case CREATIVE_TASK_TYPES.GENERATE_WRITING_CANDIDATE:
      return generateWritingCandidate(input, taskId, options);
    case CREATIVE_TASK_TYPES.PROOFREAD_WRITING_CANDIDATE:
      return proofreadWritingCandidate(input, taskId, options);
    case CREATIVE_TASK_TYPES.REQUEST_ADOPT_WRITING_CANDIDATE:
      return requestAdoptWritingCandidate(input, taskId, options);
    case CREATIVE_TASK_TYPES.BUILD_SETTLEMENT_CANDIDATE:
      return buildSettlementCandidate(input, taskId, options);
    case CREATIVE_TASK_TYPES.REQUEST_ENGINE_ACTIVATION:
      return requestEngineActivation(input, taskId, options);
    case CREATIVE_TASK_TYPES.QUERY_APPROVAL_QUEUE:
      return queryApprovalQueue(input, taskId, options);
    default:
      throw new Error(`Unknown task_type: ${input.taskType || "(empty)"}`);
  }
}

async function persistTask(response, bundle, options = {}) {
  const roots = rootsFor(options);
  await Promise.all([
    mkdir(roots.creativeTasks, { recursive: true }),
    mkdir(path.dirname(roots.creativeTaskLog), { recursive: true }),
  ]);
  const paths = taskPaths(response.task_id, roots);
  const log = {
    task_id: response.task_id,
    task_type: response.task_type,
    status: response.status,
    created_at: new Date().toISOString(),
    source: "creative_task_orchestrator",
    dry_run: response.status === "dry_run",
    target_ids: response.created.map((item) => item.target_id).filter(Boolean),
    result_summary: response.result,
    blocked_reason: response.blocked_reason,
  };
  await commitFileTransaction("persist-creative-task", [
    { filePath: paths.task, content: `${JSON.stringify(response, null, 2)}\n` },
    { filePath: paths.bundle, content: `${JSON.stringify(bundle, null, 2)}\n` },
    { type: "append", filePath: roots.creativeTaskLog, content: `${JSON.stringify(log)}\n` },
  ], { task_id: response.task_id, phase: "phase_8a_creative_task_orchestrator" });
  return response;
}

export function listCreativeTaskTypes() {
  return [...taskTypes];
}

export async function runCreativeTask(rawInput, options = {}) {
  const taskId = createTaskId();
  let input;
  try {
    input = normalizeInput(rawInput);
    if (!taskTypeSet.has(input.taskType)) {
      throw new Error(`Unknown task_type: ${input.taskType || "(empty)"}`);
    }
    const { response, bundle } = await executeTask(input, taskId, options);
    return persistTask(response, bundle, options);
  } catch (error) {
    const response = blockedResult(taskId, input?.taskType ?? "", error.message);
    return persistTask(response, { input: rawInput ?? null, error: error.message }, options);
  }
}

export async function getCreativeTaskStatus(taskId, options = {}) {
  if (!taskIdPattern.test(String(taskId ?? ""))) throw new Error("Invalid task_id.");
  const roots = rootsFor(options);
  const paths = taskPaths(taskId, roots);
  return JSON.parse(await readFile(paths.task, "utf8"));
}
