const sharedWorkspace = "dev_workspace_shared_repository_v1";
const powerShellTools = new Set(["powershell_run", "powershell_admin_run"]);
const fileMutationTools = new Set(["dev_apply_patch", "dev_create_file", "dev_create_directory", "dev_delete_file"]);
const admissionFailures = new WeakSet();

export function journalIsolationError(incident) {
  const error = Object.assign(new Error("JOURNAL_SCOPE_ISOLATED: an unresolved operation overlaps the requested effect."),
    { code: "JOURNAL_SCOPE_ISOLATED", isolation: incident });
  admissionFailures.add(error);
  return error;
}

export function isJournalIsolationFailure(value) {
  return admissionFailures.has(value);
}

export function preserveJournalIsolationFailure(error, response) {
  if (isJournalIsolationFailure(error)) admissionFailures.add(response);
}

export function journalMutationDetails(tool, args, piManaged) {
  if (fileMutationTools.has(tool)) return { targets: [{ path: args.path }] };
  if (tool === "dev_move_path") return { targets: [{ path: args.sourcePath }, { path: args.destinationPath }] };
  if (piManaged && tool === "powershell_run" && args.sandbox === true) return { result: { isolation_mode: "appcontainer" } };
  if (piManaged && tool === "powershell_admin_run" && args.service_authorization) {
    return { result: { service_name: args.service_authorization.service_name } };
  }
  return {};
}

function pathKey(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/+$/u, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function journalOperationScope(operation) {
  const { operation_type, tool_name, workstream_id, result } = operation;
  const workspace_id = operation.workspace_id ?? sharedWorkspace;
  if (["pi_execution_projection", "pi_production_route", "pi_worker_deferral"].includes(operation_type)) {
    return { level: "operation", resource: result?.logical_operation_id ?? tool_name };
  }
  if (operation_type === "journal_recovery_observation") {
    return { level: "operation", resource: result?.logical_operation_id ?? tool_name };
  }
  if (powerShellTools.has(tool_name)) {
    if (result?.isolation_mode === "appcontainer") return { level: "operation", resource: "appcontainer" };
    if (tool_name === "powershell_admin_run" && typeof result?.service_name === "string") {
      return { level: "resource", resource: `windows.service:${result.service_name.toLowerCase()}`, tool_name };
    }
    return { level: "tool", tool_name };
  }
  const paths = operation_type.startsWith("filesystem_") || operation_type === "mcp_mutation"
    ? [...new Set((operation.targets ?? []).map(target => pathKey(target.path)))] : [];
  if (paths.length) return { level: "resource", workspace_id, workstream_id, paths };
  if (workspace_id !== sharedWorkspace) return { level: "workspace", workspace_id, workstream_id };
  if (workstream_id) return { level: "workstream", workstream_id };
  return { level: "tool", tool_name };
}

function overlapsPath(left, right) {
  return !left || !right || left === right || left.startsWith(right + "/") || right.startsWith(left + "/");
}

export function journalIsolationOverlaps(incident, incoming) {
  if (incident.level === "operation" || incoming.level === "operation") {
    return incident.level === "operation" && incoming.level === "operation"
      && incident.resource !== "appcontainer" && incident.resource === incoming.resource;
  }
  if (incident.resource || incoming.resource) {
    if (incident.resource && incoming.resource) return incident.resource === incoming.resource;
    return incident.tool_name === incoming.tool_name;
  }
  if (incident.level === "tool" || incoming.level === "tool") {
    return incident.tool_name !== undefined && incident.tool_name === incoming.tool_name;
  }
  if (incident.level === "workstream" || incoming.level === "workstream") {
    return incident.workstream_id !== undefined && incident.workstream_id === incoming.workstream_id;
  }
  if (incident.workspace_id !== incoming.workspace_id) return false;
  if (incident.level === "workspace" || incoming.level === "workspace") return true;
  return incident.paths.some(left => incoming.paths.some(right => overlapsPath(left, right)));
}

export function journalIncident(started, terminal, relatedStarts = []) {
  const scopeStart = started.operation_type === "mcp_mutation" && relatedStarts.length === 1
    && relatedStarts[0].tool_name === started.tool_name && relatedStarts[0].workspace_id === started.workspace_id
    ? relatedStarts[0] : started;
  return {
    operation_id: started.operation_id,
    operation_type: started.operation_type,
    tool_name: started.tool_name,
    workspace_id: started.workspace_id,
    workstream_id: started.workstream_id,
    scope: journalOperationScope(scopeStart),
    health: "isolated",
    code: terminal ? "AMBIGUOUS_TERMINAL" : "DANGLING_OPERATION",
    event_id: (terminal ?? started).journal_event_id,
    event_sequence: (terminal ?? started).sequence,
  };
}
