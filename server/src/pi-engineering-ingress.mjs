import { hashExecutionInput, PI_TASK_AUTHORIZATION_ID } from "./pi-execution-contract.mjs";
import { adaptAuthorizedPiRequest } from "./pi-execution-policy.mjs";
import { requiresPiTaskGrant } from "./pi-task-authorization.mjs";

function denied() {
  throw Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
}

// Host-only adapter. The caller submits an engineering request, never an
// authorization reference. An independently trusted host must supply an
// already-approved reference and the existing grant verifier. This adapter
// cannot issue grants, relax their scope, dispatch tools, or elevate privileges.
export async function adaptHostAuthorizedEngineeringRequest(source, {
  resolveWorkspace, approvedGrantId, authorizeTask,
} = {}) {
  hashExecutionInput(source);
  if (!["autonomous_engineering", "authorized_engineering"].includes(source?.request_kind)
    || Object.hasOwn(source, "task_authorization_id")) denied();
  if (typeof approvedGrantId !== "string" || !PI_TASK_AUTHORIZATION_ID.test(approvedGrantId)
    || typeof authorizeTask !== "function") denied();
  const snapshot = JSON.parse(JSON.stringify(source));
  // The legacy short command form selects its shell route by grant presence.
  // Never let binding a grant silently change a host command into a sandbox command.
  // On this ingress, shell scope must be an explicit requested action.
  if (Object.hasOwn(snapshot, "command")) {
    throw Object.assign(new Error("EXPLICIT_ENGINEERING_ACTION_REQUIRED"), {
      code: "EXPLICIT_ENGINEERING_ACTION_REQUIRED",
    });
  }
  const intent = await adaptAuthorizedPiRequest({
    ...snapshot,
    task_authorization_id: approvedGrantId,
  }, { resolveWorkspace });
  // The production controller must still revalidate this grant at admission
  // and dispatch. Passing this adapter is not an execution authorization.
  await authorizeTask(intent);
  return intent;
}

// Only the authenticated transport decision, never request metadata, supplies
// identity. Explicit host requests and mandatory-grant automatic binding
// both require an already approved grant.
export async function adaptPiEngineeringIngress(source, {
  authentication, resolveWorkspace, approvalSource,
  requireTaskAuthorization = false,
} = {}) {
  // When task grants are mandatory, an explicit-action autonomous request
  // may reuse an independently published host binding. Never select or issue
  // new authority, silently convert a command, or fall back after denial.
  const explicitHostRequest = source?.request_kind === "host_approved_engineering";
  const automaticHostBinding = requireTaskAuthorization === true
    && source?.request_kind === "autonomous_engineering"
    && !Object.hasOwn(source, "task_authorization_id")
    && !Object.hasOwn(source, "command")
    && Array.isArray(source.requested_actions)
    && source.requested_actions.some(action =>
      typeof action?.capability === "string" && requiresPiTaskGrant(action.capability));
  if (!explicitHostRequest && !automaticHostBinding) {
    return adaptAuthorizedPiRequest(source, { resolveWorkspace });
  }
  if (authentication?.ok !== true || authentication.local !== false
    || typeof authentication.principal !== "string" || !authentication.principal.trim()
    || typeof approvalSource !== "function") denied();
  hashExecutionInput(source);
  if (Object.hasOwn(source, "task_authorization_id")) denied();
  const request = JSON.parse(JSON.stringify(source));
  request.request_kind = "autonomous_engineering";
  return approvalSource(request, { authenticatedPrincipal: authentication.principal });
}
