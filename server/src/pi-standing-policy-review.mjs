import { CAPABILITY_DEFINITIONS, hashExecutionInput } from "./pi-execution-contract.mjs";

// Review-only inventory for #106. Neither a matching result nor this module
// provides admission, grant issuance, dispatch, elevation, or a fallback.
const classes = Object.freeze({
  standing_scope_candidate: Object.freeze([
    "filesystem.read", "filesystem.list", "filesystem.write", "filesystem.patch",
    "workspace.create_checkpoint", "verification.focused", "verification.affected",
    "git.status", "git.commit",
  ]),
  existing_read_boundary: Object.freeze([
    "workspace.inspect", "workspace.get_workstream", "workspace.get_checkpoint",
    "workspace.get_operation", "workspace.list_operations", "workspace.get_provenance",
    "capability.schema.read", "capability.list", "execution.query",
  ]),
  independent_lifecycle_boundary: Object.freeze([
    "workspace.begin_workstream", "workspace.create", "workspace.create_isolated",
    "workspace.update_workstream", "workspace.end_workstream", "verification.full",
    "git.integration_preflight", "git.integration_validate", "git.integrate", "git.push",
  ]),
  independent_sandbox_boundary: Object.freeze(["workspace.powershell_isolated"]),
  independent_protected_boundary: Object.freeze([
    "windows.service.ensure_running", "windows.powershell.run_approved",
  ]),
  unconfined_shell_boundary: Object.freeze(["host.powershell", "workspace.powershell"]),
});
const classByCapability = new Map();
for (const [category, capabilities] of Object.entries(classes)) {
  for (const capability of capabilities) {
    if (classByCapability.has(capability)) throw new Error("DUPLICATE_POLICY_REVIEW_CAPABILITY");
    classByCapability.set(capability, category);
  }
}
export function reviewEngineeringCapability(capability) {
  return classByCapability.get(capability) ?? "unclassified";
}
export function reviewEngineeringCoverage() {
  const contract = new Set(CAPABILITY_DEFINITIONS.map(definition => definition.capability));
  const unclassified = [...contract].filter(capability => !classByCapability.has(capability));
  const obsolete = [...classByCapability.keys()].filter(capability => !contract.has(capability));
  return { complete: unclassified.length === 0 && obsolete.length === 0, unclassified, obsolete,
    capabilities: CAPABILITY_DEFINITIONS.map(({ capability, permission, scope, effect }) =>
      ({ capability, permission, scope, effect, review_category: reviewEngineeringCapability(capability) })) };
}

const workspacePattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const idPattern = /^pi_standing_[a-f0-9]{32}$/u;
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const bounded = (value, limit) => typeof value === "string" && value.trim().length > 0
  && value.length <= limit && !value.includes("\u0000");
const unique = (items, max, valid) => Array.isArray(items) && items.length > 0
  && items.length <= max && items.every(valid) && new Set(items).size === items.length;

// A proposed policy is intentionally scoped to explicitly named existing
// isolated workspaces. This is a schema and scope review, not a trusted policy
// loader. The independently approved policy source, durable evidence and
// revocation protocol must be implemented and reviewed before any live use.
export function reviewProposedStandingPolicy(policy) {
  try { hashExecutionInput(policy); } catch { return { valid: false, code: "INVALID_POLICY_DOCUMENT" }; }
  const keys = ["schema_version", "policy_id", "project_id", "principal", "enabled",
    "issued_at_ms", "expires_at_ms", "workspace_ids", "capabilities"];
  if (!exactKeys(policy, keys) || policy.schema_version !== 1
    || typeof policy.policy_id !== "string" || !idPattern.test(policy.policy_id)
    || policy.project_id !== "writer_workbench" || !bounded(policy.principal, 512)
    || typeof policy.enabled !== "boolean"
    || !Number.isSafeInteger(policy.issued_at_ms) || policy.issued_at_ms < 0
    || !Number.isSafeInteger(policy.expires_at_ms) || policy.expires_at_ms <= policy.issued_at_ms
    || !unique(policy.workspace_ids, 64, value => typeof value === "string" && workspacePattern.test(value))
    || !unique(policy.capabilities, 32, value => reviewEngineeringCapability(value) === "standing_scope_candidate")) {
    return { valid: false, code: "INVALID_POLICY_SCOPE" };
  }
  return { valid: true, code: "REVIEW_ONLY" };
}

// Input is supplied by a test or a trusted reviewing host. Do not interpret
// a matched scope as authorization: it says only that the proposed policy
// describes this request. It is never called by the production controller.
export function reviewStandingPolicyScope({ policy, principal, workspace, capabilities, now, revoked } = {}) {
  const result = (code, scope_matches = false) => ({ code, scope_matches, execution_authorized: false });
  if (!reviewEngineeringCoverage().complete) return result("CONTRACT_REVIEW_REQUIRED");
  const reviewed = reviewProposedStandingPolicy(policy);
  if (!reviewed.valid) return result(reviewed.code);
  if (policy.enabled !== true || revoked !== false) return result("DISABLED_OR_REVOCATION_UNKNOWN");
  if (!Number.isSafeInteger(now) || now < policy.issued_at_ms || now >= policy.expires_at_ms) return result("OUTSIDE_POLICY_PERIOD");
  if (!bounded(principal, 512) || principal !== policy.principal) return result("PRINCIPAL_MISMATCH");
  if (typeof workspace?.workspace_id !== "string" || !workspacePattern.test(workspace.workspace_id)
    || !policy.workspace_ids.includes(workspace.workspace_id)
    || typeof workspace.workstream_id !== "string" || !workstreamPattern.test(workspace.workstream_id)
    || workspace.workspace_type !== "isolated_worktree" || workspace.lifecycle_state !== "active"
    || workspace.workstream_state !== "active" || workspace.healthy !== true
    || workspace.mutation_allowed !== true) return result("WORKSPACE_SCOPE_MISMATCH");
  if (!unique(capabilities, 32, capability => typeof capability === "string"
    && policy.capabilities.includes(capability))) return result("CAPABILITY_SCOPE_MISMATCH");
  return result("SCOPE_MATCH_REVIEW_ONLY", true);
}
