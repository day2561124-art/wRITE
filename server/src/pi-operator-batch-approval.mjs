import { hashExecutionInput } from "./pi-execution-contract.mjs";
import { loadPiEngineeringApprovalBindings, validatePiEngineeringBindingSnapshot } from "./pi-engineering-approval-source.mjs";
import { reviewEngineeringCapability } from "./pi-standing-policy-review.mjs";

const workspacePattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const maximumDurationMs = 30 * 24 * 60 * 60 * 1000;
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const bounded = (value, max) => typeof value === "string" && value.trim().length > 0
  && value.length <= max && !value.includes("\u0000");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const scopeKey = value => JSON.stringify([value.principal, value.workspace_id, value.workstream_id, value.goal]);

// Operator-only batch provisioning. The existing OS-protected grant store
// remains the authority; no part of this module is exposed through MCP.
// The batch is a finite list of exact scopes, not an open-ended standing
// policy, and it cannot mint shell, elevated or lifecycle permissions.
export function createPiOperatorBatchApproval({ root, publisher, store, resolveWorkspace, clock = Date.now } = {}) {
  if (typeof publisher?.inspect !== "function" || typeof publisher?.publish !== "function"
    || typeof store?.issue !== "function" || typeof store?.revoke !== "function"
    || typeof store?.authorize !== "function" || typeof resolveWorkspace !== "function"
    || typeof clock !== "function") fail("INVALID_OPERATOR_BATCH_DEPENDENCIES");

  async function prepare(input) {
    // Clone only after bounded JSON validation. Do not allow caller-supplied
    // authority fields, paths, project IDs or wildcard scope expansion.
    hashExecutionInput(input);
    const plan = JSON.parse(JSON.stringify(input));
    if (!exact(plan, ["schema_version", "principal", "expected_current_sha256", "expires_at_ms", "scopes"])
      || plan.schema_version !== 1 || !bounded(plan.principal, 512)
      || !(plan.expected_current_sha256 === null || (typeof plan.expected_current_sha256 === "string"
        && digestPattern.test(plan.expected_current_sha256)))
      || !Array.isArray(plan.scopes) || plan.scopes.length < 1 || plan.scopes.length > 64
      || !Number.isSafeInteger(plan.expires_at_ms)) fail("INVALID_OPERATOR_BATCH");
    const now = clock();
    if (!Number.isSafeInteger(now) || plan.expires_at_ms <= now
      || plan.expires_at_ms - now > maximumDurationMs) fail("INVALID_OPERATOR_BATCH_EXPIRY");
    const scopeKeys = new Set();
    for (const scope of plan.scopes) {
      if (!exact(scope, ["workspace_id", "workstream_id", "goal", "capabilities"])
        || typeof scope.workspace_id !== "string" || !workspacePattern.test(scope.workspace_id)
        || typeof scope.workstream_id !== "string" || !workstreamPattern.test(scope.workstream_id)
        || !bounded(scope.goal, 4096)
        || !Array.isArray(scope.capabilities) || scope.capabilities.length < 1
        || scope.capabilities.length > 9 || new Set(scope.capabilities).size !== scope.capabilities.length
        || scope.capabilities.some(capability => typeof capability !== "string"
          || reviewEngineeringCapability(capability) !== "standing_scope_candidate")) fail("INVALID_OPERATOR_BATCH_SCOPE");
      const key = scopeKey({ ...scope, principal: plan.principal });
      if (scopeKeys.has(key)) fail("AMBIGUOUS_BINDING");
      scopeKeys.add(key);
    }
    const current = await publisher.inspect();
    if (current.sha256 !== plan.expected_current_sha256) fail("BINDING_MANIFEST_CHANGED");
    const existing = current.sha256 === null ? [] :
      validatePiEngineeringBindingSnapshot(await loadPiEngineeringApprovalBindings(root));
    if (current.sha256 !== null && hashExecutionInput(existing) !== current.sha256) fail("BINDING_MANIFEST_CHANGED");
    if (existing.length + plan.scopes.length > 128) fail("BINDING_MANIFEST_TOO_LARGE");
    for (const binding of existing) {
      if (scopeKeys.has(scopeKey(binding))) fail("AMBIGUOUS_BINDING");
      await store.authorize({ task_authorization_id: binding.task_authorization_id,
        context: { project_id: "writer_workbench", workspace_id: binding.workspace_id,
          workstream_id: binding.workstream_id }, goal: binding.goal, requested_actions: [] });
    }
    for (const scope of plan.scopes) {
      const context = await resolveWorkspace({ workspace_id: scope.workspace_id }, { mutation: true });
      if (context?.workspace_id !== scope.workspace_id || context.workstream_id !== scope.workstream_id
        || context.workspace_type !== "isolated_worktree" || context.lifecycle_state !== "active"
        || context.workstream_state !== "active" || context.healthy !== true
        || context.mutation_allowed !== true) fail("BINDING_WORKSPACE_UNAVAILABLE");
    }
    return { plan, existing, sha256: hashExecutionInput(plan) };
  }

  async function preview(input) {
    const { plan, existing, sha256 } = await prepare(input);
    return { plan_sha256: sha256, new_grant_count: plan.scopes.length,
      preserved_binding_count: existing.length, expires_at_ms: plan.expires_at_ms,
      approved_scopes: plan.scopes, principal: plan.principal, publication_performed: false };
  }

  async function apply(input, approvedPlanSha256) {
    const { plan, existing, sha256 } = await prepare(input);
    if (sha256 !== approvedPlanSha256) fail("OPERATOR_BATCH_APPROVAL_MISMATCH");
    const issued = [];
    try {
      for (const scope of plan.scopes) {
        const grant = await store.issue({ ...scope, expires_at_ms: plan.expires_at_ms });
        issued.push({ principal: plan.principal, workspace_id: scope.workspace_id,
          workstream_id: scope.workstream_id, goal: scope.goal,
          task_authorization_id: grant.task_authorization_id });
      }
      const result = await publisher.publish({ expected_current_sha256: plan.expected_current_sha256,
        bindings: [...existing, ...issued] });
      return { plan_sha256: sha256, new_grant_count: issued.length, ...result, publication_performed: true };
    } catch (error) {
      // The manifest publisher uses compare-and-swap. If any step fails,
      // revoke only newly created grants, never pre-existing authority.
      // A late publication/cleanup error may leave revoked manifest entries;
      // do not claim rollback succeeded or overwrite a concurrent manifest.
      const unrevoked = [];
      for (const record of issued) {
        try { await store.revoke(record.task_authorization_id); }
        catch { unrevoked.push(record.task_authorization_id); }
      }
      const failure = Object.assign(new Error("OPERATOR_BATCH_FAILED_RECONCILE"), {
        code: "OPERATOR_BATCH_FAILED_RECONCILE", cause: error,
        new_grant_count: issued.length, unrevoked_grant_ids: unrevoked,
      });
      throw failure;
    }
  }

  return Object.freeze({ preview, apply });
}
