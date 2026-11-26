import { createExecutionIntent, hashExecutionInput, PI_TASK_AUTHORIZATION_ID } from "./pi-execution-contract.mjs";
import { adaptAuthorizedPiRequest } from "./pi-execution-policy.mjs";
import { requiresPiTaskGrant } from "./pi-task-authorization.mjs";

// Deliberately finite and narrower than the explicit host-approved route.
// Shell, elevated maintenance and lifecycle operations keep their existing
// explicit authorization route, even if an ordinary action is also present.
const automaticBindingCapabilities = new Set([
  "filesystem.read", "filesystem.list", "filesystem.write", "filesystem.patch",
  "workspace.create_checkpoint", "verification.focused", "verification.affected",
  "git.status", "git.commit",
]);

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
  authentication, resolveWorkspace, approvalSource, standingApprovalSource, automaticStandingApprovalSource,
  requireTaskAuthorization = false,
} = {}) {
  // Evidence is host-derived. Neither a full raw intent nor an ordinary
  // compact envelope may supply a standing authorization claim.
  if (source && Object.hasOwn(source, "standing_authorization")) denied();
  if (source?.request_kind === "standing_engineering") {
    if (authentication?.ok !== true || authentication.local !== false
      || typeof authentication.principal !== "string" || !authentication.principal.trim()
      || typeof standingApprovalSource !== "function"
      || Object.hasOwn(source, "task_authorization_id") || Object.hasOwn(source, "command")
      || !Array.isArray(source.requested_actions) || source.requested_actions.length === 0
      || !source.requested_actions.every(action => automaticBindingCapabilities.has(action?.capability))
      || source.requested_actions.some(action => action?.on_failure !== undefined)) denied();
    hashExecutionInput(source);
    const request = JSON.parse(JSON.stringify(source));
    request.request_kind = "autonomous_engineering";
    const intent = await adaptAuthorizedPiRequest(request, { resolveWorkspace });
    return createExecutionIntent(await standingApprovalSource(intent, {
      authenticatedPrincipal: authentication.principal,
    }));
  }
  // When task grants are mandatory, an explicit-action autonomous request
  // may reuse an independently published host binding. Never select or issue
  // new authority, silently convert a command, or fall back after denial.
  const explicitHostRequest = source?.request_kind === "host_approved_engineering";
  const automaticHostBinding = requireTaskAuthorization === true
    && source?.request_kind === "autonomous_engineering"
    && !Object.hasOwn(source, "task_authorization_id")
    && !Object.hasOwn(source, "command")
    && Array.isArray(source.requested_actions)
    && source.requested_actions.every(action => automaticBindingCapabilities.has(action?.capability))
    && source.requested_actions.some(action =>
      typeof action?.capability === "string" && requiresPiTaskGrant(action.capability));
  if (!explicitHostRequest && !automaticHostBinding) {
    return adaptAuthorizedPiRequest(source, { resolveWorkspace });
  }
  if (authentication?.ok !== true || authentication.local !== false
    || typeof authentication.principal !== "string" || !authentication.principal.trim()) denied();
  hashExecutionInput(source);
  if (Object.hasOwn(source, "task_authorization_id")) denied();
  const request = JSON.parse(JSON.stringify(source));
  request.request_kind = "autonomous_engineering";
  const identity = { authenticatedPrincipal: authentication.principal };
  // An implicit ordinary request may select a pre-existing standing policy.
  // Only the trusted reader's explicit null (no matching policy history)
  // permits independent legacy binding. Never catch a denial and retry.
  if (automaticHostBinding && typeof automaticStandingApprovalSource === "function") {
    const intent = await adaptAuthorizedPiRequest(request, { resolveWorkspace });
    const bound = await automaticStandingApprovalSource(intent, identity);
    if (bound !== null) {
      if (!bound?.standing_authorization) denied();
      return createExecutionIntent(bound);
    }
  }
  if (typeof approvalSource !== "function") denied();
  return approvalSource(request, identity);
}
