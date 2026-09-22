import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyVerificationFailure,
  VERIFICATION_FAILURE_CLASSES,
  VERIFICATION_FAILURE_CLASSIFICATION_VERSION,
} from "../../server/src/mcp-verification-failure-classifier.mjs";

const failed = { suite: "mcp", execution_ok: true, passed: false, timed_out: false, exit_code: 1 };

test("VA-7 exports exactly the bounded classification vocabulary", () => {
  assert.deepEqual(VERIFICATION_FAILURE_CLASSES, [
    "PASS_STABLE", "REGRESSION", "FLAKY", "INFRA_FAILURE",
    "ENVIRONMENT_FAILURE", "TIMEOUT", "LOCK_CONTENTION", "UNKNOWN",
  ]);
  assert.equal(classifyVerificationFailure().schema_version, VERIFICATION_FAILURE_CLASSIFICATION_VERSION);
});

test("VA-7 original clean PASS is classified without modifying gate outcome", () => {
  const result = classifyVerificationFailure({ gatePassed: true, suiteResults: [{...failed, passed: true, exit_code: 0}] });
  assert.equal(result.classification, "PASS_STABLE");
  assert.equal(result.original_gate_result, "passed");
  assert.equal(result.changes_gate_result, false);
});

test("VA-7 observed timeout takes priority over a generic failure", () => {
  const result = classifyVerificationFailure({ suiteResults: [failed, { ...failed, suite: "mcp_tunnel", timed_out: true }] });
  assert.equal(result.classification, "TIMEOUT");
  assert.equal(result.suite, "mcp_tunnel");
  assert.equal(result.original_gate_result, "failed");
});

test("VA-7 uses only typed lock, environment and infrastructure evidence", () => {
  assert.equal(classifyVerificationFailure({ suiteResults: [{ ...failed, failure_code: "TEST_RUN_LOCK_BUSY" }] }).classification, "LOCK_CONTENTION");
  assert.equal(classifyVerificationFailure({ suiteResults: [{ ...failed, error_code: "DEPENDENCY_BRIDGE_SETUP_FAILED" }] }).classification, "ENVIRONMENT_FAILURE");
  assert.equal(classifyVerificationFailure({ suiteResults: [{ ...failed, failure_code: "TEST_PROCESS_SPAWN_FAILED" }] }).classification, "INFRA_FAILURE");
  assert.equal(classifyVerificationFailure({ suiteResults: [{ ...failed, stderr: "TEST_RUN_LOCK_BUSY" }] }).classification, "UNKNOWN");
});

test("VA-7 cannot infer regression or flakiness from a lone FAIL or an unverified retry", () => {
  assert.equal(classifyVerificationFailure({ suiteResults: [failed] }).classification, "UNKNOWN");
  assert.equal(classifyVerificationFailure({ suiteResults: [failed], comparison: {
    original_passed: false, diagnostic_passed: true,
  } }).classification, "UNKNOWN");
  assert.equal(classifyVerificationFailure({ suiteResults: [failed], comparison: {
    baseline_passed: true, candidate_passed: false,
  } }).classification, "UNKNOWN");
});

test("VA-7 verified same-snapshot mixed outcome is diagnostic FLAKY, original FAIL remains", () => {
  const result = classifyVerificationFailure({ suiteResults: [failed], comparison: {
    verified_same_snapshot: true, verified_same_suite: true,
    original_passed: false, diagnostic_passed: true, suite: "mcp",
  } });
  assert.equal(result.classification, "FLAKY");
  assert.equal(result.original_gate_result, "failed");
  assert.equal(result.changes_gate_result, false);
});

test("VA-7 regression requires controlled verified baseline comparison and excluded confounds", () => {
  const comparison = {
    verified_baseline_equivalence: true, verified_suite_identity: true,
    baseline_passed: true, candidate_passed: false, suite: "mcp",
  };
  assert.equal(classifyVerificationFailure({ suiteResults: [failed], comparison }).classification, "UNKNOWN");
  const result = classifyVerificationFailure({ suiteResults: [failed], comparison: {
    ...comparison, non_code_confounds_excluded: true,
  } });
  assert.equal(result.classification, "REGRESSION");
  assert.equal(result.original_gate_result, "failed");
});

test("VA-7 diff or worktree failure remains a failed UNKNOWN gate with exact reason", () => {
  const result = classifyVerificationFailure({
    suiteResults: [{ ...failed, passed: true, exit_code: 0 }],
    diffCheckPassed: false,
  });
  assert.equal(result.classification, "UNKNOWN");
  assert.equal(result.reason, "INTEGRATION_WORKTREE_OR_DIFF_GATE_FAILED");
  assert.equal(result.original_gate_result, "failed");
});
