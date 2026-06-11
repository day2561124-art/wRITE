import {
  getAdoptedWritingDetail,
  listAdoptedWritings,
} from "./writing-candidate-adoption-service.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: "read_only",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

export async function get_adopted_writing_detail(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_adopted_writing_detail",
      permission: "read_only",
      result: await getAdoptedWritingDetail(
        input.adopted_chapter_id ?? input.adoptedChapterId,
        options,
      ),
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_adopted_writing_detail", error);
  }
}

export async function list_adopted_writings(input = {}, options = {}) {
  try {
    const adoptedWritings = await listAdoptedWritings(input, options);
    return {
      ok: true,
      tool_name: "list_adopted_writings",
      permission: "read_only",
      result: { count: adoptedWritings.length, adopted_writings: adoptedWritings },
      created: [],
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_adopted_writings", error);
  }
}

export const adoptedWritingTools = {
  get_adopted_writing_detail,
  list_adopted_writings,
};

const metadata = {
  permission: "read_only",
  writes_files: false,
  writes_only_to: [],
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_adopt_candidate_directly: false,
  can_settle_candidate: false,
  requires_user_confirmation: false,
};

export const adoptedWritingToolMetadata = {
  get_adopted_writing_detail: { ...metadata },
  list_adopted_writings: { ...metadata },
};
