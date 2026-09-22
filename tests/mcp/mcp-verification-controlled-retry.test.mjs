import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROLLED_DIAGNOSTIC_RETRY_VERSION,
  selectControlledRetryPolicy,
  runControlledDiagnosticRetry,
} from "../../server/src/mcp-verification-controlled-retry.mjs";

const exactCommit = "a".repeat(40);
const original = {
  suite: "mcp",
  operation_id: "dev_operation_" + "b".repeat(32),
  workspace_snapshot_id: "c".repeat(64),
  head: exactCommit,
  passed: false, execution_ok: true, timed_out: false, exit_code: 1,
};
const isolation = {
  workspace_snapshot_id: original.workspace_snapshot_id,
  head: exactCommit, changed_artifact_count: 0,
};
const second = {
  ...original, operation_id: "dev_operation_" + "d".repeat(32),
  execution_ok: true, passed: true, timed_out: false, exit_code: 0,
};
const args = (overrides = {}) => ({
  originalResult: original, exactCommit,
  verifyIsolation: async () => isolation,
  runOnce: async () => second,
  ...overrides,
});

test("VA-8 first PASS never retries and original FAIL requires a Journal-bound snapshot", async () => {
  assert.deepEqual(selectControlledRetryPolicy({
    originalResult: { ...original, passed: true }, exactCommit,
  }), { allowed: false, reason: "ORIGINAL_PASSED", max_attempts: 0 });
  assert.equal(selectControlledRetryPolicy({
    originalResult: { ...original, operation_id: null }, exactCommit,
  }).allowed, false);
  assert.equal(selectControlledRetryPolicy({
    originalResult: { ...original, head: "e".repeat(40) }, exactCommit,
  }).allowed, false);
  let calls = 0;
  const report = await runControlledDiagnosticRetry(args({
    originalResult: { ...original, passed: true },
    runOnce: async () => { calls += 1; return second; },
  }));
  assert.equal(calls, 0);
  assert.equal(report.status, "skipped");
  assert.equal(report.attempts_executed, 0);
});

test("VA-8 only reruns after the exact clean isolated snapshot has been reverified", async () => {
  for (const observed of [
    { ...isolation, head: "d".repeat(40) },
    { ...isolation, workspace_snapshot_id: "e".repeat(64) },
    { ...isolation, changed_artifact_count: 1 },
  ]) {
    let calls = 0;
    const receipt = await runControlledDiagnosticRetry(args({
      verifyIsolation: async () => observed,
      runOnce: async () => { calls += 1; return second; },
    }));
    assert.equal(receipt.status, "skipped");
    assert.equal(receipt.reason, "WORKSPACE_SNAPSHOT_NOT_IDENTICAL_AND_CLEAN");
    assert.equal(receipt.attempts_executed, 0);
    assert.equal(calls, 0);
  }
});

test("VA-8 FAIL then PASS produces independent flaky/infra diagnostic, never PASS gate", async () => {
  let calls = 0;
  const receipt = await runControlledDiagnosticRetry(args({
    runOnce: async (suite) => {
      calls += 1;
      assert.equal(suite, "mcp");
      return second;
    },
  }));
  assert.equal(receipt.schema_version, CONTROLLED_DIAGNOSTIC_RETRY_VERSION);
  assert.equal(calls, 1);
  assert.equal(receipt.attempts_executed, 1);
  assert.equal(receipt.verified_same_suite_snapshot_commit, true);
  assert.equal(receipt.outcome, "flaky_or_infra_unstable");
  assert.equal(receipt.diagnostic_passed, true);
  assert.equal(receipt.original_operation_id, original.operation_id);
  assert.equal(receipt.diagnostic_operation_id, second.operation_id);
  assert.equal(receipt.original_gate_result, "failed");
  assert.equal(receipt.changes_gate_result, false);
});

test("VA-8 FAIL then FAIL records observed repeated failure, original receipt unchanged", async () => {
  const secondFailure = { ...second, passed: false, exit_code: 1 };
  const originalBefore = structuredClone(original);
  const receipt = await runControlledDiagnosticRetry(args({ runOnce: async () => secondFailure }));
  assert.equal(receipt.outcome, "stable_failure_observed_twice");
  assert.equal(receipt.diagnostic_passed, false);
  assert.equal(receipt.original_gate_result, "failed");
  assert.deepEqual(original, originalBefore);
});

test("VA-8 second timeout or infrastructure failure remains inconclusive, not stable assertion failure", async () => {
  for (const observed of [
    { ...second, passed: false, timed_out: true, exit_code: 1 },
    { ...second, passed: false, execution_ok: false, exit_code: null },
  ]) {
    const receipt = await runControlledDiagnosticRetry(args({ runOnce: async () => observed }));
    assert.equal(receipt.outcome, "inconclusive");
    assert.equal(receipt.original_gate_result, "failed");
    assert.equal(receipt.changes_gate_result, false);
  }
});

test("VA-8 different suite, snapshot, HEAD or reused operation never proves same run", async () => {
  const variants = [
    { ...second, suite: "mcp_tunnel" },
    { ...second, workspace_snapshot_id: "e".repeat(64) },
    { ...second, head: "e".repeat(40) },
    { ...second, operation_id: original.operation_id },
  ];
  for (const observed of variants) {
    const receipt = await runControlledDiagnosticRetry(args({ runOnce: async () => observed }));
    assert.equal(receipt.status, "executed");
    assert.equal(receipt.attempts_executed, 1);
    assert.equal(receipt.outcome, "inconclusive");
    assert.equal(receipt.reason, "DIAGNOSTIC_IDENTITY_NOT_VERIFIED");
    assert.equal(receipt.original_gate_result, "failed");
  }
});

test("VA-8 failed isolation, missing callback or diagnostic runner error fail closed", async () => {
  const missing = await runControlledDiagnosticRetry(args({ runOnce: null }));
  assert.equal(missing.status, "skipped");
  assert.equal(missing.attempts_executed, 0);
  const isolationError = await runControlledDiagnosticRetry(args({
    verifyIsolation: async () => { throw new Error("fixture diagnostic"); },
  }));
  assert.equal(isolationError.reason, "ISOLATION_CHECK_FAILED");
  const runError = await runControlledDiagnosticRetry(args({
    runOnce: async () => { throw new Error("fixture diagnostic"); },
  }));
  assert.equal(runError.attempts_executed, 1);
  assert.equal(runError.outcome, "inconclusive");
  assert.equal(runError.original_gate_result, "failed");
});
