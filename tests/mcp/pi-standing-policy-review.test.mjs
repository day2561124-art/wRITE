import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_DEFINITIONS } from "../../server/src/pi-execution-contract.mjs";
import { reviewEngineeringCapability, reviewEngineeringCoverage,
  reviewProposedStandingPolicy, reviewStandingPolicyScope } from "../../server/src/pi-standing-policy-review.mjs";

const workspace = { workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + "b".repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active",
  workstream_state: "active", healthy: true, mutation_allowed: true };
const policy = { schema_version: 1, policy_id: "pi_standing_" + "c".repeat(32),
  project_id: "writer_workbench", principal: "verified-test-principal", enabled: true,
  issued_at_ms: 100, expires_at_ms: 200, workspace_ids: [workspace.workspace_id],
  capabilities: ["filesystem.read", "filesystem.write", "verification.focused", "git.commit"] };
const request = { policy, principal: policy.principal, workspace, now: 150,
  revoked: false, capabilities: ["filesystem.write", "verification.focused"] };

test("every strict execution capability has an explicit review category", () => {
  const report = reviewEngineeringCoverage();
  assert.equal(report.complete, true);
  assert.deepEqual(report.unclassified, []);
  assert.deepEqual(report.obsolete, []);
  assert.equal(report.capabilities.length, CAPABILITY_DEFINITIONS.length);
  for (const definition of CAPABILITY_DEFINITIONS) {
    assert.notEqual(reviewEngineeringCapability(definition.capability), "unclassified");
  }
  assert.equal(reviewEngineeringCapability("future.unknown"), "unclassified");
});

test("standing scope is not execution authority even for an entirely matching request", () => {
  assert.deepEqual(reviewProposedStandingPolicy(policy), { valid: true, code: "REVIEW_ONLY" });
  assert.deepEqual(reviewStandingPolicyScope(request), {
    code: "SCOPE_MATCH_REVIEW_ONLY", scope_matches: true, execution_authorized: false,
  });
  const second = reviewStandingPolicyScope({ ...request, capabilities: ["git.commit"] });
  assert.equal(second.scope_matches, true);
  assert.equal(second.execution_authorized, false);
});

test("proposed policy cannot include independent lifecycle, shell or protected capabilities", () => {
  for (const { capability } of CAPABILITY_DEFINITIONS) {
    if (reviewEngineeringCapability(capability) === "standing_scope_candidate") continue;
    assert.equal(reviewProposedStandingPolicy({ ...policy, capabilities: [capability] }).valid, false, capability);
  }
  for (const capability of ["future.unknown", "*"]) {
    assert.equal(reviewProposedStandingPolicy({ ...policy, capabilities: [capability] }).valid, false);
  }
});

test("invalid policy documents are rejected, including forged extra fields and broad workspace selectors", () => {
  for (const change of [
    { schema_version: 2 }, { project_id: "other" }, { policy_id: "invalid" },
    { principal: "" }, { enabled: "true" }, { expires_at_ms: 100 },
    { workspace_ids: ["*"] }, { workspace_ids: ["dev_workspace_shared_repository_v1"] },
    { workspace_ids: [workspace.workspace_id, workspace.workspace_id] },
    { capabilities: [] }, { capabilities: ["git.commit", "git.commit"] },
    { task_authorization_id: "fake" }, { permission_level: "administrator" },
  ]) {
    assert.equal(reviewProposedStandingPolicy({ ...policy, ...change }).valid, false);
  }
});

test("principal, time, revoked status, inactive scope and mixed capabilities all fail closed", () => {
  for (const change of [
    { principal: "other" }, { principal: undefined }, { now: 99 }, { now: 200 },
    { now: undefined }, { revoked: true }, { revoked: undefined },
    { policy: { ...policy, enabled: false } },
    { workspace: { ...workspace, workspace_id: "dev_workspace_" + "d".repeat(24) } },
    { workspace: { ...workspace, workstream_state: "paused" } },
    { workspace: { ...workspace, healthy: false } },
    { workspace: { ...workspace, mutation_allowed: false } },
    { workspace: { ...workspace, lifecycle_state: "verifying" } },
    { workspace: { ...workspace, workstream_id: "invalid" } },
    { capabilities: ["filesystem.write", "windows.service.ensure_running"] },
    { capabilities: ["filesystem.write", "git.push"] },
    { capabilities: ["filesystem.patch"] },
    { capabilities: [] },
  ]) {
    const result = reviewStandingPolicyScope({ ...request, ...change });
    assert.equal(result.scope_matches, false, JSON.stringify(change));
    assert.equal(result.execution_authorized, false);
  }
});
