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
  "host.powershell", "workspace.powershell_isolated", "workspace.create_checkpoint", "windows.service.ensure_running",
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
  const supplied = params?.arguments?.workspace_id;
  if (supplied === undefined && tool === "dev_pi_execute_readonly") return false;
  const workspace_id = supplied === undefined ? "dev_workspace_shared_repository_v1" : supplied;
  if (typeof workspace_id !== "string" || !workspacePattern.test(workspace_id)) return false;
  const context = await resolveWorkspace({ workspace_id }, { mutation: false });
  if (context?.workspace_id !== workspace_id) fail("WORKSPACE_IDENTITY_MISMATCH");
  return true;
}

// GPT supplies scope, exact actions and permissions. Only mechanical fields are
// derived here; Pi receives the unchanged strict ExecutionIntent contract.
export async function adaptAuthorizedPiRequest(source, { resolveWorkspace } = {}) {
  // Short-form autonomous mode is mechanically lowered into the same durable
  // Pi intent; no direct dispatch, elevation, or permission bypass is added.
  if (source?.request_kind === "autonomous_engineering") {
    hashExecutionInput(source);
    exact(source, ["request_kind", "intent_id", "goal", "workspace_id"],
      ["schema_version", "constraints", "completion_conditions", "permissions",
        "requested_actions", "command", "cwd", "timeoutMs", "task_authorization_id", "sandbox_paths", "sandbox_directories",
        "output_paths", "toolchain"]);
    if (source.schema_version !== undefined && source.schema_version !== 1) fail("UNSUPPORTED_INTENT_VERSION");
    const usesCommand = source.command !== undefined;
    const isolatedCommand = usesCommand && source.task_authorization_id !== undefined;
    if (usesCommand === (source.requested_actions !== undefined)
      || (!usesCommand && (source.timeoutMs !== undefined || source.cwd !== undefined))) fail("INVALID_AUTONOMOUS_ACTIONS");
    if (!isolatedCommand && (source.sandbox_paths !== undefined || source.sandbox_directories !== undefined
      || source.output_paths !== undefined || source.toolchain !== undefined)) fail("ISOLATED_TASK_AUTHORIZATION_REQUIRED");
    if (source.cwd !== undefined
      && (typeof source.cwd !== "string" || !source.cwd.trim() || source.cwd.length > 4096))
      fail("INVALID_HOST_CWD");
    const requested_actions = usesCommand
      ? [{ step_id: "run", capability: isolatedCommand ? "workspace.powershell_isolated" : "host.powershell",
        input: { command: source.command,
          ...(source.cwd === undefined ? {} : { cwd: source.cwd }),
          ...(source.timeoutMs === undefined ? {} : { timeoutMs: source.timeoutMs }),
          ...(source.sandbox_paths === undefined ? {} : { sandbox_paths: source.sandbox_paths }),
          ...(source.sandbox_directories === undefined ? {} : { sandbox_directories: source.sandbox_directories }),
          ...(source.output_paths === undefined ? {} : { output_paths: source.output_paths }),
          ...(source.toolchain === undefined ? {} : { toolchain: source.toolchain }) } }]
      : source.requested_actions;
    if (!Array.isArray(requested_actions) || !requested_actions.length
      || requested_actions.length > 100) fail("INVALID_ACTIONS");
    const inferred = { read: false, write: false, tests: false, commit: false };
    for (const action of requested_actions) {
      if (!ordinaryCapabilities.has(action?.capability)) fail("STRICT_EXECUTION_INTENT_REQUIRED");
      inferred[capabilityDefinition(action.capability).permission] = true;
    }
    if (source.permissions !== undefined) {
      exact(source.permissions, [], Object.keys(inferred));
      if (Object.entries(source.permissions).some(([name, value]) =>
        typeof value !== "boolean" || (inferred[name] && value === false))) fail("PERMISSION_DENIED");
    }
    return adaptAuthorizedPiRequest({
      schema_version: 1, request_kind: "authorized_engineering",
      intent_id: source.intent_id, goal: source.goal, workspace_id: source.workspace_id,
      ...(source.task_authorization_id === undefined ? {} : { task_authorization_id: source.task_authorization_id }),
      constraints: source.constraints ?? [],
      requested_actions, permissions: inferred,
      completion_conditions: source.completion_conditions ?? [
        "Report exact step outcomes, exit codes and any pending review."],
    }, { resolveWorkspace });
  }
  if (source?.request_kind !== "authorized_engineering") return createExecutionIntent(source);
  hashExecutionInput(source); // Existing bounded, accessor-free JSON validation.
  exact(source, ["schema_version", "request_kind", "intent_id", "goal", "workspace_id",
    "constraints", "requested_actions", "permissions", "completion_conditions"], ["decision_boundaries", "task_authorization_id"]);
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
      "expected_capability_version", "expected_schema_hash", "on_failure"]);
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
    ...(source.task_authorization_id === undefined ? {} : { task_authorization_id: source.task_authorization_id }),
    context: { project_id: "writer_workbench", workspace_id: context.workspace_id, workstream_id: context.workstream_id },
    constraints: source.constraints, requested_actions: actions, permissions,
    mutation_plan: actions.filter(action => capabilityDefinition(action.capability).effect).map(action => ({
      step_id: action.step_id,
      target: action.capability.startsWith("filesystem.") ? action.input.path
        : action.capability === "host.powershell" ? "dev_workspace_shared_repository_v1"
        : action.capability === "windows.service.ensure_running" && typeof action.input.service_name === "string"
          ? `windows_service:${action.input.service_name.toLowerCase()}` : context.workspace_id,
      expected_change: "Execute the exact GPT-authorized " + action.capability + " input",
      input_sha256: hashExecutionInput(action.input),
    })),
    verification: Object.fromEntries(["focused", "affected", "full"].map(level =>
      [level, actions.filter(action => action.capability === "verification." + level).map(action => action.step_id)])),
    completion_conditions: source.completion_conditions,
    decision_boundaries: source.decision_boundaries === undefined ? [...REQUIRED_DECISION_BOUNDARIES] : source.decision_boundaries,
  });
}
