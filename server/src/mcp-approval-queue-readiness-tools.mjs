import {
  buildApprovalQueueReadinessReport,
} from "./approval-queue-readiness-service.mjs";

const safety = {
  can_approve: false,
  can_confirm_adoption: false,
  can_modify_active_engine: false,
  can_modify_compressed_rules: false,
  can_activate_engine: false,
  can_restore: false,
  can_rollback: false,
};

export async function approval_queue_bridge_readiness_report(input = {}, options = {}) {
  try {
    const report = await buildApprovalQueueReadinessReport(
      input.request_id ?? input.requestId,
      {
        ...options,
        includeLineagePreview:
          input.include_lineage_preview ?? input.includeLineagePreview,
        maxPreviewChars: input.max_preview_chars ?? input.maxPreviewChars,
      },
    );
    return {
      ok: report.ok,
      tool: "approval_queue_bridge_readiness_report",
      tool_name: "approval_queue_bridge_readiness_report",
      permission: "read",
      ...safety,
      report,
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      tool: "approval_queue_bridge_readiness_report",
      tool_name: "approval_queue_bridge_readiness_report",
      permission: "read",
      ...safety,
      report: null,
      blocked: true,
      blocked_reason: error.message,
    };
  }
}

export const approvalQueueReadinessTools = {
  approval_queue_bridge_readiness_report,
};

export const approvalQueueReadinessToolMetadata = {
  approval_queue_bridge_readiness_report: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...safety,
  },
};
