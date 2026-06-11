import {
  getWritingCandidateAdoptionRequest,
  listWritingCandidateAdoptionRequests,
  requestWritingCandidateAdoption,
} from "./candidate-adoption-request-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: toolName === "request_writing_candidate_adoption"
      ? "approval_request"
      : "read_only",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

export async function request_writing_candidate_adoption(input = {}, options = {}) {
  try {
    const result = await requestWritingCandidateAdoption(input, options);
    return {
      ok: result.ok,
      tool_name: "request_writing_candidate_adoption",
      permission: "approval_request",
      result,
      created: result.approval_item_created ? [{
        label: "approval_item",
        target_id: result.approval_item_id,
        canon_status: "approval_required",
      }] : [],
      warnings: result.warnings ?? [],
      blocked: result.blocked,
      blocked_reason: result.blocked_reason,
    };
  } catch (error) {
    return blocked("request_writing_candidate_adoption", error);
  }
}

export async function get_writing_candidate_adoption_request(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_writing_candidate_adoption_request",
      permission: "read_only",
      result: await getWritingCandidateAdoptionRequest(
        input.request_id ?? input.requestId,
        options,
      ),
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_writing_candidate_adoption_request", error);
  }
}

export async function list_writing_candidate_adoption_requests(input = {}, options = {}) {
  try {
    const requests = await listWritingCandidateAdoptionRequests(input, options);
    return {
      ok: true,
      tool_name: "list_writing_candidate_adoption_requests",
      permission: "read_only",
      result: { count: requests.length, requests },
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_writing_candidate_adoption_requests", error);
  }
}

export const candidateAdoptionRequestTools = {
  request_writing_candidate_adoption,
  get_writing_candidate_adoption_request,
  list_writing_candidate_adoption_requests,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  can_adopt_candidate_directly: false,
  can_settle_candidate: false,
};

export const candidateAdoptionRequestToolMetadata = {
  request_writing_candidate_adoption: {
    permission: "approval_request",
    writes_files: true,
    writes_only_to: [
      normalizeProjectPath(projectPaths.approvalQueue),
      normalizeProjectPath(projectPaths.writingCandidates),
      normalizeProjectPath(projectPaths.outputs),
    ],
    ...deniedCapabilities,
    creates_approval_item: true,
    requires_user_confirmation: true,
  },
  get_writing_candidate_adoption_request: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
    creates_approval_item: false,
    requires_user_confirmation: false,
  },
  list_writing_candidate_adoption_requests: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
    creates_approval_item: false,
    requires_user_confirmation: false,
  },
};
