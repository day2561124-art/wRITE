import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertEngineCandidateId,
  assertSnapshotId,
  getPendingCandidate,
  listPendingCandidates,
  listSnapshots,
  rollbackActiveEngine,
} from "./engine-candidate-service.mjs";
import { activateEngineCandidateAfterApproval } from "./engine-activation-confirm-service.mjs";
import {
  approveCleanupProposal,
  executeCleanupProposal,
  assertCleanupProposalId,
} from "./cleanup-proposal-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { getAgentRun } from "./agent-run-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";
import {
  assertPathInside,
  projectPaths,
} from "./project-paths.mjs";
import {
  adoptCandidateDraft,
  assertDraftId,
  getCandidateDraft,
  listProofReports,
} from "./writing-workflow-service.mjs";
import { adoptWritingCandidateAfterApproval } from "./writing-candidate-adoption-service.mjs";

export const approvalItemIdPattern =
  /^approval_item_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const allowedStatuses = new Set([
  "pending",
  "confirmed",
  "rejected",
  "deferred",
  "blocked",
  "resolved",
]);

const allowedActions = new Set([
  "activate_engine_candidate",
  "rollback_active_engine",
  "adopt_p0_p1_draft",
  "adopt_writing_candidate",
  "neural_trace_missing",
  "approve_cleanup_proposal",
  "execute_cleanup_proposal",
  "restore_from_backup",
  "compressed_rule_update",
  "setting_change_proposal",
]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createId() {
  const compact = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const timestamp = `${compact.slice(0, 8)}-${compact.slice(8)}`;
  return `approval_item_${timestamp}-${randomBytes(4).toString("hex")}`;
}

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function optionalText(value, maxLength = 5_000) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw errorWithStatus(`Text exceeds ${maxLength} characters.`);
  return text;
}

function rootsFor(options = {}) {
  const approvalQueue = options.approvalQueue
    ? assertPathInside(options.approvalQueue, projectPaths.approvalQueue, "approval queue test root")
    : projectPaths.approvalQueue;
  return {
    approvalQueue,
    approvalItems: path.join(approvalQueue, "items"),
    approvalLogs: path.join(approvalQueue, "logs"),
    approvalLog: path.join(approvalQueue, "logs", "approval_log.jsonl"),
  };
}

function targetOptions(options = {}) {
  return {
    ...(options.writingWorkflow ? { writingWorkflow: options.writingWorkflow } : {}),
    ...(options.writingCandidates ? { writingCandidates: options.writingCandidates } : {}),
    ...(options.proofReports ? { proofReports: options.proofReports } : {}),
    ...(options.adoptedWritings ? { adoptedWritings: options.adoptedWritings } : {}),
    ...(options.approvalQueue ? { approvalQueue: options.approvalQueue } : {}),
    ...(options.activeEnginePath ? { activeEnginePath: options.activeEnginePath } : {}),
    ...(options.pendingEngineCandidates
      ? { pendingEngineCandidates: options.pendingEngineCandidates }
      : {}),
    ...(options.engineSnapshots ? { engineSnapshots: options.engineSnapshots } : {}),
    ...(options.engineArchive ? { engineArchive: options.engineArchive } : {}),
    ...(options.activationLog ? { activationLog: options.activationLog } : {}),
    ...(options.rollbackIndex ? { rollbackIndex: options.rollbackIndex } : {}),
  };
}

function cleanupTargetOptions(options = {}) {
  return {
    ...(options.cleanupRoot ? { cleanupRoot: options.cleanupRoot } : {}),
    ...(options.engineArchive ? { engineArchive: options.engineArchive } : {}),
    ...(options.rejectedEngineCandidates ? { rejectedEngineCandidates: options.rejectedEngineCandidates } : {}),
    ...(options.pendingEngineCandidates ? { pendingEngineCandidates: options.pendingEngineCandidates } : {}),
    ...(options.engineSnapshots ? { engineSnapshots: options.engineSnapshots } : {}),
    ...(options.rollbackIndex ? { rollbackIndex: options.rollbackIndex } : {}),
    ...(options.candidateDrafts ? { candidateDrafts: options.candidateDrafts } : {}),
    ...(options.proofReports ? { proofReports: options.proofReports } : {}),
    ...(options.adoptedChapters ? { adoptedChapters: options.adoptedChapters } : {}),
    ...(options.contextBundles ? { contextBundles: options.contextBundles } : {}),
    ...(options.settlementContexts ? { settlementContexts: options.settlementContexts } : {}),
    ...(options.settlementReports ? { settlementReports: options.settlementReports } : {}),
    ...(options.approvalItems ? { approvalItems: options.approvalItems } : {}),
  };
}

function itemPaths(approvalItemId, roots) {
  assertApprovalItemId(approvalItemId);
  const directory = path.join(roots.approvalItems, approvalItemId);
  return {
    directory,
    item: path.join(directory, "item.json"),
    status: path.join(directory, "status.json"),
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function keyFor(item) {
  return `${item.target_type}:${item.target_id}:${item.action_type}`;
}

function baseStatus(status = "pending", reason = null) {
  if (!allowedStatuses.has(status)) throw errorWithStatus("Invalid approval status.");
  return {
    status,
    confirmed_at: null,
    rejected_at: null,
    deferred_at: null,
    resolved_at: null,
    reason,
  };
}

function activationImpact() {
  return {
    will_modify: ["data/canon_db/active_engine.md"],
    will_create: ["snapshot", "archive", "activation_log"],
    rollback_available: true,
  };
}

async function neuralCandidateState(metadata) {
  if (metadata.requires_neural_modules !== true) {
    return { required: false, ok: true, status: "not_required", blocked_reason: null };
  }
  try {
    const run = await getAgentRun(metadata.run_id);
    const usage = await summarizeNeuralUsageForRun(run.run_id);
    if (usage.missing_required_neural_modules.length) {
      return {
        required: true,
        ok: false,
        status: "missing",
        blocked_reason:
          `neural_trace_missing: ${usage.missing_required_neural_modules.join(", ")}`,
      };
    }
    return { required: true, ok: true, status: "success", blocked_reason: null };
  } catch (error) {
    return {
      required: true,
      ok: false,
      status: "missing",
      blocked_reason: `neural_trace_missing: ${error.message}`,
    };
  }
}

export function isSafeApprovalItemId(id) {
  return typeof id === "string" && approvalItemIdPattern.test(id);
}

export function assertApprovalItemId(id) {
  if (!isSafeApprovalItemId(id)) throw errorWithStatus("Invalid approval_item_id.");
  return id;
}

export async function ensureApprovalQueueDirectories(options = {}) {
  const roots = rootsFor(options);
  await Promise.all([
    mkdir(roots.approvalItems, { recursive: true }),
    mkdir(roots.approvalLogs, { recursive: true }),
  ]);
  return roots;
}

export async function appendApprovalLog(event, item, details = {}, options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  const record = {
    event,
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    target_type: item.target_type,
    target_id: item.target_id,
    created_at: new Date().toISOString(),
    approved_by: optionalText(details.approvedBy ?? details.approved_by, 200) || null,
    result: details.result ?? "success",
    error_message: details.errorMessage ?? details.error_message ?? null,
    reason: optionalText(details.reason, 5_000) || null,
  };
  await commitFileTransaction("append-approval-log", [
    { type: "append", filePath: roots.approvalLog, content: `${JSON.stringify(record)}\n` },
  ], {
    approval_item_id: item.approval_item_id,
    event,
    phase: "phase_5a_approval_queue",
  });
  return record;
}

export async function listApprovalLogs(options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  if (!await exists(roots.approvalLog)) return [];
  return (await readFile(roots.approvalLog, "utf8"))
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function createApprovalItem(input = {}, options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  const actionType = optionalText(input.actionType ?? input.action_type, 100);
  if (!allowedActions.has(actionType)) throw errorWithStatus("Invalid approval action_type.");
  const targetType = optionalText(input.targetType ?? input.target_type, 100);
  const targetId = optionalText(input.targetId ?? input.target_id, 200);
  if (!targetType || !targetId) throw errorWithStatus("target_type and target_id are required.");
  const existing = (await listApprovalItems(options)).find(
    (item) => keyFor(item) === `${targetType}:${targetId}:${actionType}`
      && !["rejected", "resolved"].includes(item.status.status),
  );
  if (existing) return existing;

  const approvalItemId = createId();
  const now = new Date().toISOString();
  const item = {
    approval_item_id: approvalItemId,
    created_at: now,
    updated_at: now,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    source_chapter: optionalText(input.sourceChapter ?? input.source_chapter, 500),
    title: optionalText(input.title, 500),
    summary: optionalText(input.summary, 5_000),
    risk_level: optionalText(input.riskLevel ?? input.risk_level, 50) || "unknown",
    requires_second_confirmation:
      input.requiresSecondConfirmation === true || input.requires_second_confirmation === true,
    requires_neural_success:
      input.requiresNeuralSuccess === true || input.requires_neural_success === true,
    neural_status: optionalText(input.neuralStatus ?? input.neural_status, 100) || "not_required",
    blocked_reason: optionalText(input.blockedReason ?? input.blocked_reason, 5_000) || null,
    candidate_id: input.candidateId ?? input.candidate_id ?? null,
    candidate_hash: input.candidateHash ?? input.candidate_hash ?? null,
    candidate_path: input.candidatePath ?? input.candidate_path ?? null,
    candidate_meta_path: input.candidateMetaPath ?? input.candidate_meta_path ?? null,
    proof_report_id: input.proofReportId ?? input.proof_report_id ?? null,
    proof_report_hash: input.proofReportHash ?? input.proof_report_hash ?? null,
    proof_verdict: input.proofVerdict ?? input.proof_verdict ?? null,
    proof_severity: input.proofSeverity ?? input.proof_severity ?? null,
    reason: optionalText(input.reason, 5_000),
    requires_user_confirmation:
      input.requiresUserConfirmation === true || input.requires_user_confirmation === true,
    can_execute_without_user_confirmation:
      input.canExecuteWithoutUserConfirmation === true
      || input.can_execute_without_user_confirmation === true,
    created_by: optionalText(input.createdBy ?? input.created_by, 200),
    request_kind: optionalText(input.requestKind ?? input.request_kind, 100) || null,
    source: optionalText(input.source, 100) || null,
    source_phase: optionalText(input.sourcePhase ?? input.source_phase, 100) || null,
    verified_by: optionalText(input.verifiedBy ?? input.verified_by, 200) || null,
    bridge_capabilities: input.bridgeCapabilities ?? input.bridge_capabilities ?? null,
    lineage: input.lineage ?? null,
    safety_snapshot: input.safetySnapshot ?? input.safety_snapshot ?? null,
    operator_readiness: input.operatorReadiness ?? input.operator_readiness ?? null,
    safety: input.safety ?? null,
    impact: input.impact ?? { will_modify: [], will_create: [], rollback_available: false },
    links: {
      candidate_id: input.links?.candidate_id ?? null,
      snapshot_id: input.links?.snapshot_id ?? null,
      proof_report_id: input.links?.proof_report_id ?? null,
      adopted_chapter_id: input.links?.adopted_chapter_id ?? null,
      draft_id: input.links?.draft_id ?? null,
      proposal_id: input.links?.proposal_id ?? null,
    },
    details: input.details ?? {},
  };
  const status = baseStatus(
    input.status === "blocked" || item.blocked_reason ? "blocked" : "pending",
    item.blocked_reason,
  );
  const paths = itemPaths(approvalItemId, roots);
  await commitFileTransaction("create-approval-item", [
    { filePath: paths.item, content: json(item) },
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.approvalLog,
      content: `${JSON.stringify({
        event: status.status === "blocked" ? "approval_blocked" : "approval_created",
        approval_item_id: approvalItemId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        created_at: now,
        approved_by: null,
        result: "success",
        error_message: null,
      })}\n`,
    },
  ], {
    approval_item_id: approvalItemId,
    phase: "phase_5a_approval_queue",
  });
  return getApprovalItem(approvalItemId, options);
}

export async function listApprovalItems(options = {}) {
  const roots = rootsFor(options);
  let entries;
  try {
    entries = await readdir(roots.approvalItems, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeApprovalItemId(entry.name)) continue;
    try {
      const paths = itemPaths(entry.name, roots);
      const [item, status] = await Promise.all([
        readJson(paths.item),
        readJson(paths.status),
      ]);
      items.push({ ...item, status });
    } catch {
      // Ignore incomplete approval records.
    }
  }
  return items.sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
}

export async function getApprovalItem(approvalItemId, options = {}) {
  assertApprovalItemId(approvalItemId);
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Approval item not found.", 404);
  const [item, status] = await Promise.all([
    readJson(paths.item),
    readJson(paths.status),
  ]);
  return { ...item, status };
}

export async function refreshApprovalItem(approvalItemId, options = {}) {
  const current = await getApprovalItem(approvalItemId, options);
  if (current.action_type === "activate_engine_candidate"
    || current.action_type === "neural_trace_missing") {
    const candidate = await getPendingCandidate(current.target_id, targetOptions(options));
    const neural = await neuralCandidateState(candidate.metadata);
    const blockedReason = candidate.status.status !== "candidate"
      ? candidate.status.blocked_reason || `candidate status: ${candidate.status.status}`
      : neural.ok ? null : neural.blocked_reason;
    const next = {
      ...current,
      updated_at: new Date().toISOString(),
      risk_level: candidate.risk_report.risk_level,
      requires_second_confirmation:
        candidate.risk_report.requires_second_confirmation === true,
      neural_status: neural.status,
      blocked_reason: blockedReason,
      details: {
        ...current.details,
        candidate_status: candidate.status.status,
        diff: candidate.diff,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        candidate_hash: candidate.metadata.candidate_hash,
      },
    };
    const status = blockedReason
      ? { ...current.status, status: "blocked", reason: blockedReason }
      : current.status.status === "blocked"
        ? baseStatus("pending")
        : current.status;
    const roots = rootsFor(options);
    const paths = itemPaths(approvalItemId, roots);
    await commitFileTransaction("refresh-approval-item", [
      { filePath: paths.item, content: json({ ...next, status: undefined }) },
      { filePath: paths.status, content: json(status) },
    ], {
      approval_item_id: approvalItemId,
      phase: "phase_5a_approval_queue",
    });
  }
  return getApprovalItem(approvalItemId, options);
}

export async function scanApprovalQueue(options = {}) {
  await ensureApprovalQueueDirectories(options);
  const scanned = [];
  for (const summary of await listPendingCandidates(targetOptions(options))) {
    const candidate = await getPendingCandidate(summary.candidate_id, targetOptions(options));
    if (["rejected", "activated"].includes(candidate.status.status)) continue;
    const neural = await neuralCandidateState(candidate.metadata);
    const candidateBlocked = candidate.status.status !== "candidate"
      || candidate.risk_report.risk_level === "critical";
    if (!neural.ok) {
      scanned.push(await createApprovalItem({
        actionType: "neural_trace_missing",
        targetType: "pending_engine_candidate",
        targetId: summary.candidate_id,
        sourceChapter: candidate.metadata.source_chapter,
        title: "缺少必要 Neural Success Trace",
        summary: "此候選不可強制確認，只能延後或拒絕。",
        riskLevel: candidate.risk_report.risk_level,
        requiresNeuralSuccess: true,
        neuralStatus: neural.status,
        blockedReason: neural.blocked_reason,
        status: "blocked",
        impact: activationImpact(),
        links: { candidate_id: summary.candidate_id },
        details: { diff: candidate.diff, candidate_status: candidate.status.status },
      }, options));
      continue;
    }
    scanned.push(await createApprovalItem({
      actionType: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: summary.candidate_id,
      sourceChapter: candidate.metadata.source_chapter,
      title: "啟用新版完整創作引擎",
      summary: "Pending candidate 等待 Phase 3 人工確認。",
      riskLevel: candidate.risk_report.risk_level,
      requiresSecondConfirmation:
        candidate.risk_report.requires_second_confirmation === true,
      requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
      neuralStatus: neural.status,
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      blockedReason: candidateBlocked
        ? candidate.status.blocked_reason
          || `${candidate.status.status} / ${candidate.risk_report.risk_level}`
        : null,
      status: candidateBlocked ? "blocked" : "pending",
      impact: activationImpact(),
      links: { candidate_id: summary.candidate_id },
      details: {
        candidate_status: candidate.status.status,
        diff: candidate.diff,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        candidate_hash: candidate.metadata.candidate_hash,
      },
    }, options));
  }

  for (const proof of await listProofReports(targetOptions(options))) {
    if ((proof.issue_summary?.p0_count ?? 0) === 0
      && (proof.issue_summary?.p1_count ?? 0) === 0) continue;
    const draft = await getCandidateDraft(proof.draft_id, targetOptions(options));
    if (draft.status.can_adopt !== true || draft.status.status === "accepted_pending_settlement") {
      continue;
    }
    scanned.push(await createApprovalItem({
      actionType: "adopt_p0_p1_draft",
      targetType: "candidate_draft",
      targetId: proof.draft_id,
      sourceChapter: draft.metadata.source_chapter,
      title: "確認採用含 P0 / P1 的正文",
      summary: "驗稿含重大警告，採用前必須再次人工確認。",
      riskLevel: "high",
      requiresSecondConfirmation: true,
      neuralStatus: "not_required",
      impact: {
        will_modify: [],
        will_create: ["adopted_chapter"],
        rollback_available: false,
      },
      links: {
        proof_report_id: proof.proof_id,
        draft_id: proof.draft_id,
      },
      details: { issue_summary: proof.issue_summary },
    }, options));
  }
  return {
    scanned_count: scanned.length,
    items: await listApprovalItems(options),
  };
}

export async function createRollbackApprovalItem(snapshotId, options = {}) {
  assertSnapshotId(snapshotId);
  const snapshot = (await listSnapshots(targetOptions(options)))
    .find((item) => item.snapshot_id === snapshotId);
  if (!snapshot) throw errorWithStatus("Snapshot not found.", 404);
  if (snapshot.rollback_available !== true) {
    throw errorWithStatus("Snapshot is not available for rollback.", 409);
  }
  return createApprovalItem({
    actionType: "rollback_active_engine",
    targetType: "engine_snapshot",
    targetId: snapshotId,
    sourceChapter: snapshot.source_chapter,
    title: "回滾 Active Engine",
    summary: "Phase 3 將先建立 safety snapshot，再回滾至指定版本。",
    riskLevel: "P0",
    requiresSecondConfirmation: true,
    neuralStatus: "not_required",
    impact: {
      will_modify: ["data/canon_db/active_engine.md"],
      will_create: ["safety_snapshot", "activation_log"],
      rollback_available: true,
    },
    links: { snapshot_id: snapshotId },
    details: { active_engine_hash: snapshot.active_engine_hash },
  }, options);
}

async function updateDecision(approvalItemId, decision, reason, options = {}) {
  const item = await getApprovalItem(approvalItemId, options);
  if (["resolved", "confirmed"].includes(item.status.status)) {
    throw errorWithStatus(`Approval item is already ${item.status.status}.`, 409);
  }
  const now = new Date().toISOString();
  const status = {
    ...item.status,
    status: decision,
    reason: optionalText(reason, 5_000) || null,
    rejected_at: decision === "rejected" ? now : item.status.rejected_at,
    deferred_at: decision === "deferred" ? now : item.status.deferred_at,
  };
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  const event = decision === "rejected" ? "approval_rejected" : "approval_deferred";
  await commitFileTransaction(`approval-${decision}`, [
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.approvalLog,
      content: `${JSON.stringify({
        event,
        approval_item_id: approvalItemId,
        action_type: item.action_type,
        target_type: item.target_type,
        target_id: item.target_id,
        created_at: now,
        approved_by: null,
        result: "success",
        error_message: null,
        reason: status.reason,
      })}\n`,
    },
  ], {
    approval_item_id: approvalItemId,
    phase: "phase_5a_approval_queue",
  });
  return getApprovalItem(approvalItemId, options);
}

export async function rejectApprovalItem(approvalItemId, { reason = "" } = {}, options = {}) {
  assertApprovalItemId(approvalItemId);
  return updateDecision(approvalItemId, "rejected", reason, options);
}

export async function deferApprovalItem(approvalItemId, { reason = "" } = {}, options = {}) {
  assertApprovalItemId(approvalItemId);
  return updateDecision(approvalItemId, "deferred", reason, options);
}

export async function confirmApprovalItem(
  approvalItemId,
  {
    confirm = false,
    secondConfirm = false,
    approvalText = "",
    approvedBy = "local_user",
  } = {},
  options = {},
) {
  assertApprovalItemId(approvalItemId);
  const item = await getApprovalItem(approvalItemId, options);
  try {
    if (confirm !== true) throw errorWithStatus("User confirmation is required.", 409);
    if (item.status.status === "blocked" || item.blocked_reason) {
      throw errorWithStatus(`Blocked approval item cannot be confirmed: ${item.blocked_reason}`, 409);
    }
    if (item.action_type === "neural_trace_missing") {
      throw errorWithStatus("neural_trace_missing cannot be force-confirmed.", 409);
    }
    if (!["pending", "deferred"].includes(item.status.status)) {
      throw errorWithStatus(`Approval item cannot be confirmed: ${item.status.status}`, 409);
    }
    if (item.requires_second_confirmation === true && secondConfirm !== true) {
      throw errorWithStatus("This approval requires second confirmation.", 409);
    }
    if (
      item.action_type === "activate_engine_candidate"
      && item.requires_second_confirmation === true
      && approvalText !== "確認啟用"
    ) {
      throw errorWithStatus("High-risk approval requires checkbox and exact confirmation text.", 409);
    }
    if (
      item.action_type === "setting_change_proposal"
      && item.requires_second_confirmation === true
      && approvalText !== "確認設定修改"
    ) {
      throw errorWithStatus(
        "P0 setting proposal approval requires exact confirmation text.",
        409,
      );
    }
    let result;
    if (item.action_type === "activate_engine_candidate") {
      assertEngineCandidateId(item.target_id);
      result = await activateEngineCandidateAfterApproval({
        approvalItemId,
        pendingEngineCandidateId: item.target_id,
        confirmedBy: approvedBy,
        secondConfirm,
      }, {
        ...targetOptions(options),
        approvalConfirmed: true,
        approvalItem: item,
      });
    } else if (item.action_type === "rollback_active_engine") {
      assertSnapshotId(item.target_id);
      result = await rollbackActiveEngine(item.target_id, {
        confirm: true,
        approvedBy,
      }, targetOptions(options));
    } else if (item.action_type === "adopt_p0_p1_draft") {
      assertDraftId(item.target_id);
      if (secondConfirm !== true) {
        throw errorWithStatus("P0/P1 adoption requires second confirmation.", 409);
      }
      result = await adoptCandidateDraft(item.target_id, {
        confirm: true,
        adoptedBy: approvedBy,
        note: "Approved through Phase 5A approval queue.",
      }, targetOptions(options));
    } else if (item.action_type === "adopt_writing_candidate") {
      result = await adoptWritingCandidateAfterApproval({
        approvalItemId,
        candidateId: item.target_id,
        proofReportId: item.proof_report_id || item.links?.proof_report_id,
        confirmedBy: approvedBy,
        reason: item.reason,
      }, { ...targetOptions(options), approvalConfirmed: true });
    } else if (item.action_type === "approve_cleanup_proposal") {
      assertCleanupProposalId(item.target_id);
      result = await approveCleanupProposal(item.target_id, {
        confirm: true,
        approvedBy,
      }, cleanupTargetOptions(options));
    } else if (item.action_type === "execute_cleanup_proposal") {
      assertCleanupProposalId(item.target_id);
      result = await executeCleanupProposal(item.target_id, {
        confirm: true,
        approvedBy,
      }, cleanupTargetOptions(options));
    } else if (item.action_type === "compressed_rule_update") {
      // Approval confirmed for compressed rule update — do not auto-apply here.
      // Execution is handled by a dedicated service to ensure safety and explicit application.
      result = null;
    } else if (item.action_type === "setting_change_proposal") {
      result = {
        proposal_id: item.details?.proposal_id ?? item.links?.proposal_id ?? null,
        proposal_approved: true,
        applied_to_canon: false,
        active_engine_modified: false,
        canon_db_modified: false,
        compressed_rules_modified: false,
      };
    } else {
      throw errorWithStatus(`Unsupported confirm action: ${item.action_type}`, 409);
    }
    const now = new Date().toISOString();
    const roots = rootsFor(options);
    const paths = itemPaths(approvalItemId, roots);
    const status = {
      ...item.status,
      status: "resolved",
      confirmed_at: now,
      resolved_at: now,
      reason: null,
      execution_result: result?.activation_log_id ? {
        activation_log_id: result.activation_log_id,
        pending_engine_candidate_id: result.pending_engine_candidate_id,
        snapshot_id: result.snapshot_id,
        previous_active_engine_hash: result.previous_active_engine_hash,
        new_active_engine_hash: result.new_active_engine_hash,
        rollback_requires_approval: result.rollback_requires_approval,
      } : result?.adopted_chapter_id ? {
        adopted_chapter_id: result.adopted_chapter_id,
        candidate_id: result.candidate_id,
        proof_report_id: result.proof_report_id,
      } : null,
    };
    const logs = ["approval_confirmed", "approval_resolved"].map((event) => ({
      event,
      approval_item_id: approvalItemId,
      action_type: item.action_type,
      target_type: item.target_type,
      target_id: item.target_id,
      created_at: now,
      approved_by: optionalText(approvedBy, 200) || "local_user",
      result: "success",
      error_message: null,
    }));
    await commitFileTransaction("resolve-approval-item", [
      { filePath: paths.status, content: json(status) },
      {
        type: "append",
        filePath: roots.approvalLog,
        content: logs.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      },
    ], {
      approval_item_id: approvalItemId,
      phase: "phase_5a_approval_queue",
    });
    return {
      approval_item: await getApprovalItem(approvalItemId, options),
      result,
    };
  } catch (error) {
    await appendApprovalLog("approval_failed", item, {
      approvedBy,
      result: "failed",
      errorMessage: error.message,
    }, options);
    throw error;
  }
}
