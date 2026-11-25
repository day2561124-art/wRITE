import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { PI_TASK_AUTHORIZATION_ID, hashExecutionInput } from "./pi-execution-contract.mjs";
import { adaptHostAuthorizedEngineeringRequest } from "./pi-engineering-ingress.mjs";

const workspacePattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const fields = ["principal", "workspace_id", "workstream_id", "goal", "task_authorization_id"];

function denied() {
  throw Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
}
function boundedString(value, limit) {
  return typeof value === "string" && value.trim().length > 0
    && value.length <= limit && !value.includes("\u0000");
}
function activeWorkspace(context, workspaceId) {
  return context?.workspace_id === workspaceId
    && context.workspace_type === "isolated_worktree"
    && context.lifecycle_state === "active" && context.workstream_state === "active"
    && context.healthy === true && context.mutation_allowed === true
    && typeof context.workstream_id === "string" && workstreamPattern.test(context.workstream_id);
}
function validBinding(record) {
  return record && typeof record === "object" && !Array.isArray(record)
    && Object.keys(record).length === fields.length
    && fields.every(key => Object.hasOwn(record, key))
    && boundedString(record.principal, 512)
    && typeof record.workspace_id === "string" && workspacePattern.test(record.workspace_id)
    && typeof record.workstream_id === "string" && workstreamPattern.test(record.workstream_id)
    && boundedString(record.goal, 4096)
    && typeof record.task_authorization_id === "string"
    && PI_TASK_AUTHORIZATION_ID.test(record.task_authorization_id);
}

// Shared structural validation for the reader and the separate operator
// publication workflow. Successful validation never grants execution rights.
export function validatePiEngineeringBindingSnapshot(raw) {
  try {
    hashExecutionInput(raw);
    const bindings = JSON.parse(JSON.stringify(raw));
    if (!Array.isArray(bindings) || bindings.length > 128 || !bindings.every(validBinding)) denied();
    // Apply the same uniqueness rules at publication and at runtime.
    // A damaged or independently edited host manifest must not bind one
    // grant to multiple principals, even if a single lookup would match.
    const scopes = new Set();
    const principalsByGrant = new Map();
    for (const binding of bindings) {
      const scope = JSON.stringify([binding.principal, binding.workspace_id, binding.workstream_id, binding.goal]);
      if (scopes.has(scope)) throw Object.assign(new Error("AMBIGUOUS_BINDING"), { code: "AMBIGUOUS_BINDING" });
      scopes.add(scope);
      const existing = principalsByGrant.get(binding.task_authorization_id);
      if (existing !== undefined && existing !== binding.principal) {
        throw Object.assign(new Error("AMBIGUOUS_GRANT_PRINCIPAL"), { code: "AMBIGUOUS_GRANT_PRINCIPAL" });
      }
      principalsByGrant.set(binding.task_authorization_id, binding.principal);
    }
    return bindings;
  } catch {
    denied();
  }
}

// Host-owned binding provider. These dependencies MUST originate in the
// authenticated host composition root, not MCP request arguments. This does
// not create grants, expose a listing API, or replace the grant verifier.
// Each request reads a fresh binding snapshot, permitting operator removal.
export function createPiEngineeringApprovalSource({ loadBindings, resolveWorkspace, authorizeTask } = {}) {
  if (typeof loadBindings !== "function" || typeof resolveWorkspace !== "function"
    || typeof authorizeTask !== "function") denied();

  return async function adaptBoundEngineeringRequest(source, { authenticatedPrincipal } = {}) {
    if (!boundedString(authenticatedPrincipal, 512)) denied();
    hashExecutionInput(source);
    if (!["autonomous_engineering", "authorized_engineering"].includes(source?.request_kind)
      || Object.hasOwn(source, "task_authorization_id")) denied();
    const snapshot = JSON.parse(JSON.stringify(source));
    if (typeof snapshot.workspace_id !== "string" || !workspacePattern.test(snapshot.workspace_id)
      || !boundedString(snapshot.goal, 4096)) denied();

    // Resolve authoritative workspace context, not an identity supplied by the caller.
    const context = await resolveWorkspace({ workspace_id: snapshot.workspace_id }, { mutation: false });
    if (!activeWorkspace(context, snapshot.workspace_id)) denied();
    const workstreamId = context.workstream_id;

    let bindings;
    try {
      bindings = validatePiEngineeringBindingSnapshot(await loadBindings());
    } catch {
      denied();
    }
    const matches = bindings.filter(record => record.principal === authenticatedPrincipal
      && record.workspace_id === context.workspace_id
      && record.workstream_id === workstreamId
      && record.goal === snapshot.goal);
    if (matches.length !== 1) denied();

    return adaptHostAuthorizedEngineeringRequest(snapshot, {
      approvedGrantId: matches[0].task_authorization_id,
      authorizeTask,
      resolveWorkspace: async (request, options) => {
        const current = await resolveWorkspace(request, options);
        if (!activeWorkspace(current, snapshot.workspace_id)
          || current.workstream_id !== workstreamId) denied();
        return current;
      },
    });
  };
}

// The installation's existing task-authorization directory is operator-owned.
// This loader is read-only; it neither publishes grants nor accepts a path
// from the MCP request. Missing or malformed data fails closed.
export async function loadPiEngineeringApprovalBindings(root) {
  try {
    if (typeof root !== "string" || !path.isAbsolute(root)) denied();
    const directory = await lstat(root);
    if (!directory.isDirectory() || directory.isSymbolicLink()) denied();
    const file = path.join(root, "engineering-bindings.json");
    const record = await lstat(file);
    if (!record.isFile() || record.isSymbolicLink() || record.size > 256 * 1024) denied();
    const bytes = await readFile(file);
    if (bytes.length > 256 * 1024) denied();
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    denied();
  }
}
