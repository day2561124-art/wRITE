import {
  buildCandidateProofingContext,
  getCandidateProofingContext,
  listCandidateProofingContexts,
} from "./candidate-proofing-context-service.mjs";
import {
  getProofReportDetail,
  listProofReports,
  saveChatOutputAsProofReport,
} from "./candidate-proof-report-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

const writeTools = new Set([
  "build_candidate_proofing_context",
  "save_chat_output_as_proof_report",
]);

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: writeTools.has(toolName) ? "write_low_risk" : "read_only",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

export async function build_candidate_proofing_context(input = {}, options = {}) {
  try {
    const result = await buildCandidateProofingContext(input, options);
    return {
      ok: true,
      tool_name: "build_candidate_proofing_context",
      permission: "write_low_risk",
      result,
      created: [{
        label: "candidate_proofing_context",
        target_id: result.context.proofing_context_id,
        source_path: result.proofing_for_chat_path,
        canon_status: "working_context",
      }],
      warnings: result.context.warnings,
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("build_candidate_proofing_context", error);
  }
}

export async function get_candidate_proofing_context(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_candidate_proofing_context",
      permission: "read_only",
      result: await getCandidateProofingContext(
        input.proofing_context_id ?? input.proofingContextId,
        options,
      ),
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_candidate_proofing_context", error);
  }
}

export async function list_candidate_proofing_contexts(input = {}, options = {}) {
  try {
    const contexts = await listCandidateProofingContexts(input, options);
    return {
      ok: true,
      tool_name: "list_candidate_proofing_contexts",
      permission: "read_only",
      result: { count: contexts.length, contexts },
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_candidate_proofing_contexts", error);
  }
}

export async function save_chat_output_as_proof_report(input = {}, options = {}) {
  try {
    const result = await saveChatOutputAsProofReport(input, options);
    return {
      ok: true,
      tool_name: "save_chat_output_as_proof_report",
      permission: "write_low_risk",
      result,
      created: result.proof_report_created ? [{
        label: "candidate_proof_report",
        target_id: result.proof_report_id,
        source_path: result.proof_report_path,
        canon_status: "candidate_only",
      }] : [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("save_chat_output_as_proof_report", error);
  }
}

export async function get_proof_report_detail(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_proof_report_detail",
      permission: "read_only",
      result: await getProofReportDetail(
        input.proof_report_id ?? input.proofReportId,
        options,
      ),
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_proof_report_detail", error);
  }
}

export async function list_proof_reports(input = {}, options = {}) {
  try {
    const reports = await listProofReports(input, options);
    return {
      ok: true,
      tool_name: "list_proof_reports",
      permission: "read_only",
      result: { count: reports.length, reports },
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_proof_reports", error);
  }
}

export const candidateProofingTools = {
  build_candidate_proofing_context,
  get_candidate_proofing_context,
  list_candidate_proofing_contexts,
  save_chat_output_as_proof_report,
  get_proof_report_detail,
  list_proof_reports,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_create_approval_item: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  can_adopt_candidate: false,
  can_settle_candidate: false,
  requires_user_confirmation: false,
};

export const candidateProofingToolMetadata = {
  build_candidate_proofing_context: {
    permission: "write_low_risk",
    writes_files: true,
    writes_only_to: [normalizeProjectPath(projectPaths.proofingContexts)],
    ...deniedCapabilities,
  },
  get_candidate_proofing_context: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
  list_candidate_proofing_contexts: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
  save_chat_output_as_proof_report: {
    permission: "write_low_risk",
    writes_files: true,
    writes_only_to: [
      normalizeProjectPath(projectPaths.proofReports),
      normalizeProjectPath(projectPaths.writingCandidates),
    ],
    ...deniedCapabilities,
  },
  get_proof_report_detail: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
  list_proof_reports: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
};
