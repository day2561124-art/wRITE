import {
  capabilityDefinition, createExecutionIntent, hashExecutionInput,
  PERMISSIONS, REQUIRED_DECISION_BOUNDARIES,
} from "./pi-execution-contract.mjs";

const workspacePattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const lightweightReads = new Set([
  "dev_read_file", "dev_read_file_range", "dev_list_directory", "dev_search_files",
  "dev_get_file_info", "dev_git_status", "dev_git_diff", "dev_git_diff_check",
  "dev_pi_execute_readonly",
]);
const ordinaryCapabilities = new Set([
  "filesystem.read", "filesystem.list", "filesystem.write", "filesystem.patch",
  "git.status", "git.commit", "verification.focused", "verification.affected",
  "host.powershell",
]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function exact(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => ![...required, ...optional].includes(key))) fail("INVALID_AUTHORIZED_REQUEST");
}

// A finite host-owned route list, never an annotation or caller assertion of safety.
// The existing handler still owns path, symlink, secret, size and sandbox checks.
export async function admitPiLightweightRead({ tool, mutation, params, resolveWorkspace }) {
  if (mutation !== false || !lightweightReads.has(tool) || typeof resolveWorkspace !== "function") return false;
  const workspace_id = params?.arguments?.workspace_id;
  if (typeof workspace_id !== "string" || !workspacePattern.test(workspace_id)) return false;
  const context = await resolveWorkspace({ workspace_id }, { mutation: false });
  if (context?.workspace_id !== workspace_id) fail("WORKSPACE_IDENTITY_MISMATCH");
  return true;
}

// GPT supplies scope, exact actions and permissions. Only mechanical fields are
// derived here; Pi receives the unchanged strict ExecutionIntent contract.
export async function adaptAuthorizedPiRequest(source, { resolveWorkspace } = {}) {
  if (source?.request_kind !== "authorized_engineering") return createExecutionIntent(source);
  hashExecutionInput(source); // Existing bounded, accessor-free JSON validation.
  exact(source, ["schema_version", "request_kind", "intent_id", "goal", "workspace_id",
    "constraints", "requested_actions", "permissions", "completion_conditions"], ["decision_boundaries"]);
  if (source.schema_version !== 1 || typeof source.workspace_id !== "string"
    || !workspacePattern.test(source.workspace_id)
    || source.workspace_id === "dev_workspace_shared_repository_v1") fail("ISOLATED_WORKSPACE_REQUIRED");
  if (typeof resolveWorkspace !== "function") fail("HOST_ADAPTER_UNBOUND");
  exact(source.permissions, [], ["read", "write", "tests", "commit"]);
  if (Object.values(source.permissions).some(value => typeof value !== "boolean")) fail("INVALID_PERMISSION_MODEL");
  const permissions = Object.fromEntries(PERMISSIONS.map(key => [key, source.permissions[key] === true]));
  if (!Array.isArray(source.requested_actions) || !source.requested_actions.length
    || source.requested_actions.length > 100) fail("INVALID_ACTIONS");
  const actions = source.requested_actions.map(action => {
    exact(action, ["step_id", "capability", "input"], ["depends_on", "idempotency_key",
      "expected_capability_version", "expected_schema_hash"]);
    if (!ordinaryCapabilities.has(action.capability)) fail("STRICT_EXECUTION_INTENT_REQUIRED");
    const definition = capabilityDefinition(action.capability);
    if (permissions[definition.permission] !== true) fail("PERMISSION_DENIED");
    return { ...action, depends_on: action.depends_on === undefined ? [] : action.depends_on,
      ...(definition.effect && action.idempotency_key === undefined
        ? { idempotency_key: "pi-authorized-" + hashExecutionInput({ intent_id: source.intent_id, step_id: action.step_id }) }
        : {}) };
  });
  const mutation = actions.some(action => capabilityDefinition(action.capability).effect);
  const context = await resolveWorkspace({ workspace_id: source.workspace_id }, { mutation });
  if (context?.workspace_id !== source.workspace_id || context.workspace_type !== "isolated_worktree"
    || context.lifecycle_state !== "active" || context.healthy !== true
    || (mutation && context.mutation_allowed !== true)) fail("WORKSPACE_IDENTITY_MISMATCH");
  return createExecutionIntent({
    schema_version: 1, intent_id: source.intent_id, goal: source.goal,
    context: { project_id: "writer_workbench", workspace_id: context.workspace_id, workstream_id: context.workstream_id },
    constraints: source.constraints, requested_actions: actions, permissions,
    mutation_plan: actions.filter(action => capabilityDefinition(action.capability).effect).map(action => ({
      step_id: action.step_id,
      target: action.capability.startsWith("filesystem.") ? action.input.path
        : action.capability === "host.powershell" ? "dev_workspace_shared_repository_v1" : context.workspace_id,
      expected_change: "Execute the exact GPT-authorized " + action.capability + " input",
      input_sha256: hashExecutionInput(action.input),
    })),
    verification: Object.fromEntries(["focused", "affected", "full"].map(level =>
      [level, actions.filter(action => action.capability === "verification." + level).map(action => action.step_id)])),
    completion_conditions: source.completion_conditions,
    decision_boundaries: source.decision_boundaries === undefined ? [...REQUIRED_DECISION_BOUNDARIES] : source.decision_boundaries,
  });
}
