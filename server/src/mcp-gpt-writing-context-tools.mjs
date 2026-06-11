import {
  buildGptWritingContext,
  getGptWritingContextBundle,
  listGptWritingContextBundles,
} from "./gpt-writing-context-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: toolName === "build_gpt_writing_context" ? "creative_task" : "read_only",
    result: null,
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

export async function build_gpt_writing_context(input = {}, options = {}) {
  try {
    const context = await buildGptWritingContext(input, options);
    return {
      ok: true,
      tool_name: "build_gpt_writing_context",
      permission: "creative_task",
      result: context,
      created: [{
        label: "gpt_writing_context",
        target_id: context.bundle.bundle_id,
        source_path: context.context_for_chat_path,
        canon_status: "working_context",
      }],
      warnings: context.bundle.warnings,
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("build_gpt_writing_context", error);
  }
}

export async function get_gpt_writing_context_bundle(input = {}, options = {}) {
  try {
    return {
      ok: true,
      tool_name: "get_gpt_writing_context_bundle",
      permission: "read_only",
      result: await getGptWritingContextBundle(input.bundle_id ?? input.bundleId, options),
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("get_gpt_writing_context_bundle", error);
  }
}

export async function list_gpt_writing_context_bundles(input = {}, options = {}) {
  try {
    const bundles = await listGptWritingContextBundles(input, options);
    return {
      ok: true,
      tool_name: "list_gpt_writing_context_bundles",
      permission: "read_only",
      result: { count: bundles.length, bundles },
      warnings: [],
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("list_gpt_writing_context_bundles", error);
  }
}

export const gptWritingContextTools = {
  build_gpt_writing_context,
  get_gpt_writing_context_bundle,
  list_gpt_writing_context_bundles,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  requires_user_confirmation: false,
};

export const gptWritingContextToolMetadata = {
  build_gpt_writing_context: {
    permission: "creative_task",
    writes_files: true,
    writes_only_to: [normalizeProjectPath(projectPaths.gptWritingContexts)],
    ...deniedCapabilities,
  },
  get_gpt_writing_context_bundle: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
  list_gpt_writing_context_bundles: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
  },
};
