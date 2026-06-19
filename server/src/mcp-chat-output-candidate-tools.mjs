import {
  getWritingCandidateDetail,
  listWritingCandidates,
  saveChatOutputAsWritingCandidate,
} from "./chat-output-candidate-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: toolName === "save_chat_output_as_writing_candidate"
      ? "write_low_risk"
      : "read_only",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

export async function save_chat_output_as_writing_candidate(input = {}, options = {}) {
  try {
    const result = await saveChatOutputAsWritingCandidate(input, options);
    const fullNeuralReport = result.full_neural_orchestration_report ?? null;
    const fullNeuralSummary = fullNeuralReport ? {
      used: true,
      orchestrator_version: fullNeuralReport.orchestration_version ?? null,
      pipeline_stage: fullNeuralReport.pipeline_stage ?? null,
      context_bundle_id: fullNeuralReport.context_bundle_id ?? result.source_bundle_id ?? null,
      writing_pipeline_complete: fullNeuralReport.writing_pipeline_complete ?? null,
      candidate_only: fullNeuralReport.candidate_only ?? true,
      active_engine_update_allowed: fullNeuralReport.active_engine_update_allowed ?? false,
      canon_update_allowed: fullNeuralReport.canon_update_allowed ?? false,
    } : null;

    return {
      ok: true,
      tool_name: "save_chat_output_as_writing_candidate",
      permission: "write_low_risk",
      result,
      created: result.candidate_created ? [{
        label: "chat_output_writing_candidate",
        target_id: result.candidate_id,
        source_path: result.candidate_path,
        canon_status: "candidate_only",
        full_neural_orchestrator_used: fullNeuralSummary?.used === true,
        full_neural_orchestrator_version: fullNeuralSummary?.orchestrator_version ?? null,
        full_neural_pipeline_stage: fullNeuralSummary?.pipeline_stage ?? null,
      }] : [],
      warnings: result.warnings,
      blocked: false,
      blocked_reason: null,
      full_neural_orchestrator_used: fullNeuralSummary?.used === true,
      full_neural_orchestration_summary: fullNeuralSummary,
    };
  } catch (error) {
    return blocked("save_chat_output_as_writing_candidate", error);
  }
}

export async function get_writing_candidate_detail(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_writing_candidate_detail",
      permission: "read_only",
      result: await getWritingCandidateDetail(
        input.candidate_id ?? input.candidateId,
        {
          ...options,
          includeContent: input.include_content ?? input.includeContent,
          maxContentChars: input.max_content_chars ?? input.maxContentChars,
        },
      ),
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_writing_candidate_detail", error);
  }
}

export async function list_writing_candidates(input = {}, options = {}) {
  try {
    const candidates = await listWritingCandidates(input, options);
    return {
      ok: true,
      tool_name: "list_writing_candidates",
      permission: "read_only",
      result: { count: candidates.length, candidates },
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_writing_candidates", error);
  }
}

export const chatOutputCandidateTools = {
  save_chat_output_as_writing_candidate,
  get_writing_candidate_detail,
  list_writing_candidates,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  can_adopt_candidate: false,
  can_settle_candidate: false,
  requires_user_confirmation: false,
};

export const chatOutputCandidateToolMetadata = {
  save_chat_output_as_writing_candidate: {
    permission: "write_low_risk",
    writes_files: true,
    writes_only_to: [normalizeProjectPath(projectPaths.writingCandidates)],
    ...deniedCapabilities,
  },
  get_writing_candidate_detail: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
  list_writing_candidates: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
};
