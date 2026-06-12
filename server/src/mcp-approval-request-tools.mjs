import path from "node:path";
import {
  assertEngineCandidateId,
  getPendingCandidate,
  assertSnapshotId,
  listSnapshots,
} from "./engine-candidate-service.mjs";
import {
  assertCleanupProposalId,
  getCleanupProposal,
} from "./cleanup-proposal-service.mjs";
import {
  createApprovalItem,
  getApprovalItem,
} from "./approval-queue-service.mjs";
import { projectPaths, assertPathInside, normalizeProjectPath } from "./project-paths.mjs";
import { get_approval_queue_status as getApprovalQueueStatusReadonly } from "./mcp-readonly-tools.mjs";

function baseOk(toolName) {
  return {
    ok: true,
    tool_name: toolName,
    permission: "approval_request",
    result: {},
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
  };
}

function blocked(toolName, reason) {
  return {
    ok: false,
    tool_name: toolName,
    permission: "approval_request",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: reason,
  };
}

function normalizeCandidateInput(input) {
  return {
    candidateId: input.candidate_id || input.candidateId || input.candidateId,
    reason: input.reason || input.request_reason || "",
    riskReason: input.risk_reason || input.riskReason || "",
    snapshotId: input.snapshot_id || input.snapshotId || input.snapshotId,
    proposalId: input.proposal_id || input.proposalId || input.proposalId,
  };
}

export async function request_engine_candidate_activation(input = {}, options = {}) {
  const tool = baseOk("request_engine_candidate_activation");
  try {
    const { candidateId, reason } = normalizeCandidateInput(input);
    assertEngineCandidateId(candidateId);
    const candidate = await getPendingCandidate(candidateId, options);
    const blockedReason = candidate.status.status !== "candidate"
      ? candidate.status.blocked_reason || `candidate status: ${candidate.status.status}`
      : candidate.risk_report.risk_level === "critical"
        ? "critical candidate requires non-MCP review"
        : null;
    const status = blockedReason ? "blocked" : "pending";
    const item = await createApprovalItem({
      actionType: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: candidateId,
      sourceChapter: candidate.metadata.source_chapter,
      title: "MCP request：啟用新版完整創作引擎",
      summary: reason || "MCP 建立啟用請求；等待使用者於 approval queue 人工確認。",
      riskLevel: candidate.risk_report.risk_level,
      requiresSecondConfirmation: candidate.risk_report.requires_second_confirmation === true,
      requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
      neuralStatus: "not_checked_by_mcp_request",
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      blockedReason,
      status,
      impact: {
        will_modify: ["data/canon_db/active_engine.md"],
        will_create: ["snapshot", "archive", "activation_log"],
        rollback_available: true,
      },
      links: { candidate_id: candidateId },
      details: {
        requested_by: "mcp",
        request_reason: reason || "",
        candidate_status: candidate.status.status,
        diff: candidate.diff,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        candidate_hash: candidate.metadata.candidate_hash,
      },
    }, options);
    tool.result = {
      approval_item_id: item.approval_item_id,
      action_type: item.action_type,
      target_type: item.target_type,
      target_id: item.target_id,
      status: item.status.status,
      risk_level: item.risk_level,
    };
    tool.created.push({
      label: "approval_item",
      source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
      canon_status: "approval_required",
    });
    return tool;
  } catch (error) {
    return blocked("request_engine_candidate_activation", error.message);
  }
}

export async function request_high_risk_engine_candidate_activation(input = {}, options = {}) {
  const tool = baseOk("request_high_risk_engine_candidate_activation");
  try {
    const { candidateId, riskReason, reason } = normalizeCandidateInput(input);
    if (!riskReason || !String(riskReason).trim()) {
      return blocked("request_high_risk_engine_candidate_activation", "risk_reason is required");
    }
    assertEngineCandidateId(candidateId);
    const candidate = await getPendingCandidate(candidateId, options);
    const isHigh = ["high", "critical"].includes(candidate.risk_report.risk_level)
      || candidate.risk_report.requires_second_confirmation === true;
    if (!isHigh) {
      return blocked("request_high_risk_engine_candidate_activation", "candidate is not high risk");
    }
    if (candidate.risk_report.risk_level === "critical") {
      const blockedReason = "critical candidate requires non-MCP review";
      const item = await createApprovalItem({
        actionType: "activate_engine_candidate",
        targetType: "pending_engine_candidate",
        targetId: candidateId,
        sourceChapter: candidate.metadata.source_chapter,
        title: "MCP request：高風險啟用新版完整創作引擎",
        summary: reason || "MCP 建立高風險啟用請求；等待使用者於 approval queue 人工確認。",
        riskLevel: candidate.risk_report.risk_level,
        requiresSecondConfirmation: true,
        requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
        neuralStatus: "not_checked_by_mcp_request",
        requiresUserConfirmation: true,
        canExecuteWithoutUserConfirmation: false,
        blockedReason,
        status: "blocked",
        impact: {
          will_modify: ["data/canon_db/active_engine.md"],
          will_create: ["snapshot", "archive", "activation_log"],
          rollback_available: true,
        },
        links: { candidate_id: candidateId },
        details: {
          requested_by: "mcp",
          risk_reason: riskReason,
          request_reason: reason || "",
          candidate_status: candidate.status.status,
          candidate_hash: candidate.metadata.candidate_hash,
          active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
          diff: candidate.diff,
        },
      }, options);
      tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
      tool.created.push({
        label: "approval_item",
        source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
        canon_status: "approval_required",
      });
      return tool;
    }
    // normal high-risk (non-critical)
    const item = await createApprovalItem({
      actionType: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: candidateId,
      sourceChapter: candidate.metadata.source_chapter,
      title: "MCP request：高風險啟用新版完整創作引擎",
      summary: reason || "MCP 建立高風險啟用請求；等待使用者於 approval queue 人工確認。",
      riskLevel: candidate.risk_report.risk_level,
      requiresSecondConfirmation: true,
      requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
      neuralStatus: "not_checked_by_mcp_request",
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      blockedReason: null,
      status: "pending",
      impact: {
        will_modify: ["data/canon_db/active_engine.md"],
        will_create: ["snapshot", "archive", "activation_log"],
        rollback_available: true,
      },
      links: { candidate_id: candidateId },
      details: {
        requested_by: "mcp",
        risk_reason: riskReason,
        request_reason: reason || "",
        candidate_status: candidate.status.status,
        candidate_hash: candidate.metadata.candidate_hash,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        diff: candidate.diff,
      },
    }, options);
    tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
    tool.created.push({
      label: "approval_item",
      source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
      canon_status: "approval_required",
    });
    return tool;
  } catch (error) {
    return blocked("request_high_risk_engine_candidate_activation", error.message);
  }
}

export async function request_rollback_active_engine(input = {}, options = {}) {
  const tool = baseOk("request_rollback_active_engine");
  try {
    const { snapshotId, reason } = normalizeCandidateInput(input);
    if (!reason || !String(reason).trim()) return blocked("request_rollback_active_engine", "reason is required");
    assertSnapshotId(snapshotId);
    const snapshot = (await listSnapshots()).find((s) => s.snapshot_id === snapshotId);
    if (!snapshot) return blocked("request_rollback_active_engine", "snapshot not found");
    if (snapshot.rollback_available !== true) return blocked("request_rollback_active_engine", "snapshot not available for rollback");
    const item = await createApprovalItem({
      actionType: "rollback_active_engine",
      targetType: "engine_snapshot",
      targetId: snapshotId,
      sourceChapter: snapshot.source_chapter,
      title: "回滾 Active Engine",
      summary: reason,
      riskLevel: "high",
      requiresSecondConfirmation: false,
      neuralStatus: "not_required",
      blockedReason: null,
      status: "pending",
      impact: {
        will_modify: ["data/canon_db/active_engine.md"],
        will_create: ["safety_snapshot", "activation_log"],
        rollback_available: true,
      },
      links: { snapshot_id: snapshotId },
      details: { request_reason: reason, active_engine_hash: snapshot.active_engine_hash },
    }, options);
    tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
    tool.created.push({
      label: "approval_item",
      source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
      canon_status: "approval_required",
    });
    return tool;
  } catch (error) {
    return blocked("request_rollback_active_engine", error.message);
  }
}

export async function request_cleanup_proposal_approval(input = {}, options = {}) {
  const tool = baseOk("request_cleanup_proposal_approval");
  try {
    const { proposalId, reason } = normalizeCandidateInput(input);
    assertCleanupProposalId(proposalId);
    const proposal = await getCleanupProposal(proposalId, options);
    const item = await createApprovalItem({
      actionType: "approve_cleanup_proposal",
      targetType: "cleanup_proposal",
      targetId: proposalId,
      sourceChapter: proposal.metadata.source_chapter,
      title: "批准 cleanup proposal",
      summary: reason || "MCP 建立 cleanup proposal 批准請求；等待使用者於 approval queue 人工確認。",
      riskLevel: "medium_high",
      requiresSecondConfirmation: false,
      neuralStatus: "not_required",
      blockedReason: null,
      status: "pending",
      impact: {
        will_modify: ["data/cleanup/proposals//status.json"],
        will_create: ["cleanup_log"],
        rollback_available: false,
      },
      links: {},
      details: {
        request_reason: reason || "",
        proposal_status: proposal.status,
        risk_summary: proposal.risk_summary ?? null,
        eligible_item_count: Array.isArray(proposal.eligible_items) ? proposal.eligible_items.length : 0,
      },
    }, options);
    tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
    tool.created.push({
      label: "approval_item",
      source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
      canon_status: "approval_required",
    });
    return tool;
  } catch (error) {
    return blocked("request_cleanup_proposal_approval", error.message);
  }
}

export async function request_cleanup_execution(input = {}, options = {}) {
  const tool = baseOk("request_cleanup_execution");
  try {
    const { proposalId, reason } = normalizeCandidateInput(input);
    assertCleanupProposalId(proposalId);
    const proposal = await getCleanupProposal(proposalId, options);
    // If not approved or not executable, create blocked item
    if (proposal.status.status !== "approved" || proposal.status.can_execute !== true) {
      const item = await createApprovalItem({
        actionType: "execute_cleanup_proposal",
        targetType: "cleanup_proposal",
        targetId: proposalId,
        sourceChapter: proposal.metadata.source_chapter,
        title: "執行 cleanup proposal",
        summary: reason || "MCP 建立 cleanup execution 請求；若尚未批准則為 blocked。",
        riskLevel: "high",
        requiresSecondConfirmation: true,
        neuralStatus: "not_required",
        blockedReason: "proposal not approved or not executable",
        status: "blocked",
        impact: {
          will_modify: ["data/cleanup/proposals//status.json"],
          will_create: ["cleanup_trash", "cleanup_tombstones", "cleanup_log"],
          rollback_available: false,
        },
        links: {},
        details: {
          request_reason: reason || "",
          proposal_status: proposal.status,
          risk_summary: proposal.risk_summary ?? null,
        },
      }, options);
      tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
      tool.created.push({
        label: "approval_item",
        source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
        canon_status: "approval_required",
      });
      return tool;
    }
    // approved and executable
    const item = await createApprovalItem({
      actionType: "execute_cleanup_proposal",
      targetType: "cleanup_proposal",
      targetId: proposalId,
      sourceChapter: proposal.metadata.source_chapter,
      title: "執行 cleanup proposal",
      summary: reason || "MCP 建立 cleanup execution 請求；等待使用者於 approval queue 人工確認。",
      riskLevel: "high",
      requiresSecondConfirmation: true,
      neuralStatus: "not_required",
      blockedReason: null,
      status: "pending",
      impact: {
        will_modify: ["data/cleanup/proposals//status.json"],
        will_create: ["cleanup_trash", "cleanup_tombstones", "cleanup_log"],
        rollback_available: false,
      },
      links: {},
      details: {
        request_reason: reason || "",
        proposal_status: proposal.status,
        risk_summary: proposal.risk_summary ?? null,
      },
    }, options);
    tool.result = { approval_item_id: item.approval_item_id, status: item.status.status };
    tool.created.push({
      label: "approval_item",
      source_path: normalizeProjectPath(path.join(projectPaths.approvalItems, item.approval_item_id)),
      canon_status: "approval_required",
    });
    return tool;
  } catch (error) {
    return blocked("request_cleanup_execution", error.message);
  }
}

export async function get_approval_item_detail(input = {}, options = {}) {
  const approvalId = input.approval_id || input.approvalItemId || input.approvalItem || input.approval_item_id;
  if (!approvalId) return blocked("get_approval_item_detail", "approval_id is required");
  try {
    const item = await getApprovalItem(approvalId, options);
    return {
      ok: true,
      tool_name: "get_approval_item_detail",
      permission: "read_only",
      data: item,
      sources: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_approval_item_detail", error.message);
  }
}

export async function get_approval_queue_status(input = {}, options = {}) {
  // delegate to readonly implementation to respect filters and limits.
  return getApprovalQueueStatusReadonly(input, options);
}

export const approvalRequestTools = {
  request_engine_candidate_activation,
  request_high_risk_engine_candidate_activation,
  request_rollback_active_engine,
  request_cleanup_execution,
  request_cleanup_proposal_approval,
  get_approval_item_detail,
  get_approval_queue_status,
};

export const approvalRequestToolMetadata = Object.fromEntries(Object.keys(approvalRequestTools).map((name) => [name, {
  permission: name.startsWith("get_") ? "read_only" : "approval_request",
  writes_files: !name.startsWith("get_"),
  writes_only_to: name.startsWith("get_") ? [] : [normalizeProjectPath(projectPaths.approvalQueue)],
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_rollback: false,
  can_execute_cleanup: false,
  requires_user_confirmation: !name.startsWith("get_"),
}]));
