import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  getAdoptedWritingSettlementContext,
  getSettlementReportDetail,
  listAdoptedWritingSettlementContexts,
  listSettlementReports,
  saveChatOutputAsSettlementReport,
} from "./adopted-writing-settlement-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: toolName.startsWith("get_") || toolName.startsWith("list_")
      ? "read_only"
      : "write_low_risk",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

function success(toolName, result, created = [], warnings = []) {
  return {
    ok: true,
    tool_name: toolName,
    permission: toolName.startsWith("get_") || toolName.startsWith("list_")
      ? "read_only"
      : "write_low_risk",
    result,
    created,
    warnings,
    blocked: false,
    blocked_reason: null,
  };
}

export async function build_adopted_writing_settlement_context(input = {}, options = {}) {
  try {
    const result = await buildAdoptedWritingSettlementContext(input, options);
    return success("build_adopted_writing_settlement_context", result, [{
      label: "adopted_writing_settlement_context",
      target_id: result.context.settlement_context_id,
      source_path: result.settlement_for_chat_path,
      canon_status: "working_context",
    }], result.context.warnings);
  } catch (error) {
    return blocked("build_adopted_writing_settlement_context", error);
  }
}

export async function get_adopted_writing_settlement_context(input = {}, options = {}) {
  try {
    return success(
      "get_adopted_writing_settlement_context",
      await getAdoptedWritingSettlementContext(
        input.id ?? input.settlement_context_id ?? input.settlementContextId,
        options,
      ),
    );
  } catch (error) {
    return blocked("get_adopted_writing_settlement_context", error);
  }
}

export async function list_adopted_writing_settlement_contexts(input = {}, options = {}) {
  try {
    const contexts = await listAdoptedWritingSettlementContexts(input, options);
    return success("list_adopted_writing_settlement_contexts", {
      count: contexts.length,
      settlement_contexts: contexts,
    });
  } catch (error) {
    return blocked("list_adopted_writing_settlement_contexts", error);
  }
}

export async function save_chat_output_as_settlement_report(input = {}, options = {}) {
  try {
    const result = await saveChatOutputAsSettlementReport(input, options);
    return success("save_chat_output_as_settlement_report", result, result.dry_run ? [] : [{
      label: "adopted_writing_settlement_report",
      target_id: result.settlement_report_id,
      source_path: result.settlement_report_path,
      canon_status: "settlement_report_only",
    }]);
  } catch (error) {
    return blocked("save_chat_output_as_settlement_report", error);
  }
}

export async function get_settlement_report_detail(input = {}, options = {}) {
  try {
    return success(
      "get_settlement_report_detail",
      await getSettlementReportDetail(
        input.id ?? input.settlement_report_id ?? input.settlementReportId,
        {
          ...options,
          includeContent: input.include_content ?? input.includeContent,
          maxContentChars: input.max_content_chars ?? input.maxContentChars,
        },
      ),
    );
  } catch (error) {
    return blocked("get_settlement_report_detail", error);
  }
}

export async function list_settlement_reports(input = {}, options = {}) {
  try {
    const reports = await listSettlementReports(input, options);
    return success("list_settlement_reports", { count: reports.length, settlement_reports: reports });
  } catch (error) {
    return blocked("list_settlement_reports", error);
  }
}

export async function build_pending_engine_candidate_from_settlement_report(
  input = {},
  options = {},
) {
  try {
    const result = await buildPendingEngineCandidateFromSettlementReport(input, options);
    return success(
      "build_pending_engine_candidate_from_settlement_report",
      result,
      result.dry_run ? [] : [{
        label: "pending_engine_candidate",
        target_id: result.pending_engine_candidate_id,
        canon_status: "pending_review",
      }],
    );
  } catch (error) {
    return blocked("build_pending_engine_candidate_from_settlement_report", error);
  }
}

export const adoptedWritingSettlementTools = {
  build_adopted_writing_settlement_context,
  get_adopted_writing_settlement_context,
  list_adopted_writing_settlement_contexts,
  save_chat_output_as_settlement_report,
  get_settlement_report_detail,
  list_settlement_reports,
  build_pending_engine_candidate_from_settlement_report,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  can_create_activation_request: false,
};

const writeMetadata = {
  permission: "write_low_risk",
  writes_files: true,
  writes_only_to: [
    normalizeProjectPath(projectPaths.adoptedWritingSettlementContexts),
    normalizeProjectPath(projectPaths.adoptedWritingSettlementReports),
    normalizeProjectPath(projectPaths.pendingEngineCandidates),
    normalizeProjectPath(projectPaths.outputs),
    normalizeProjectPath(projectPaths.adoptedWritings),
  ],
  ...deniedCapabilities,
  creates_pending_engine_candidate: true,
  requires_user_confirmation_for_activation: true,
};

const readMetadata = {
  permission: "read_only",
  writes_files: false,
  writes_only_to: [],
  ...deniedCapabilities,
  creates_pending_engine_candidate: false,
  requires_user_confirmation_for_activation: true,
};

export const adoptedWritingSettlementToolMetadata = {
  build_adopted_writing_settlement_context: { ...writeMetadata },
  get_adopted_writing_settlement_context: { ...readMetadata },
  list_adopted_writing_settlement_contexts: { ...readMetadata },
  save_chat_output_as_settlement_report: { ...writeMetadata },
  get_settlement_report_detail: { ...readMetadata },
  list_settlement_reports: { ...readMetadata },
  build_pending_engine_candidate_from_settlement_report: { ...writeMetadata },
};
