import { getPiRuntimeStatus } from "./pi-agent-execution-service.mjs";
import { executePiReadOnly, PI_READ_ONLY_LIMITS } from "./pi-codemode-bridge.mjs";
import { resolveDevWorkspaceExecutionContext } from "./mcp-development-workstream-tools.mjs";
import { workspaceExecutionProvenance } from "./mcp-development-readonly-tools.mjs";

export async function dev_pi_runtime_status() {
  return getPiRuntimeStatus();
}

// Dependency overrides are for trusted host tests, never MCP request fields.
export function createPiReadOnlyEntry({
  resolveWorkspace = resolveDevWorkspaceExecutionContext,
  execute = executePiReadOnly,
} = {}) {
  return async function piReadOnlyEntry(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some((key) => !["code", "workspace_id"].includes(key))
      || typeof input.code !== "string" || !input.code.trim()
      || Buffer.byteLength(input.code, "utf8") > PI_READ_ONLY_LIMITS.codeBytes
      || typeof input.workspace_id !== "string" || !input.workspace_id.trim()
      || input.workspace_id.length > 256) {
      return { ok: false, reason: "invalid_request" };
    }
    let context;
    try {
      context = await resolveWorkspace(
        { workspace_id: input.workspace_id },
        { mutation: false },
      );
      if (typeof context?.workspace_id !== "string" || !context.workspace_id.trim()
        || context.workspace_id.length > 256) throw new Error("workspace_required");
    } catch {
      return { ok: false, reason: "workspace_unavailable" };
    }
    let result;
    try {
      result = await execute({ code: input.code }, { workspaceId: context.workspace_id });
    } catch {
      result = { ok: false, reason: "execution_failed", model_requests: 0 };
    }
    return { ...result, workspace_context: workspaceExecutionProvenance(context) };
  };
}

// The MCP server registers this handler only in developer-capable profiles.
export const dev_pi_execute_readonly = createPiReadOnlyEntry();
