import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIntegrationVerificationManifest,
  buildDevelopmentVerificationManifest,
  VERIFICATION_MANIFEST_VERSION,
} from "../../server/src/mcp-verification-manifest.mjs";

const sha = (digit) => digit.repeat(40);
const candidate = {
  integration_candidate_id: "dev_integration_20260922-030000_aaaaaaaaaaaa",
  integration_commit: sha("a"),
  target_head: sha("b"),
  source_head: sha("c"),
  workspace_id: "dev_workspace_aaaaaaaaaaaaaaaaaaaaaaaa",
  workstream_id: "dev_workstream_20260922-030000_aaaaaaaaaaaa",
};
const plan = {
  required_suites: ["communication"],
  changed_paths: ["server/src/character-communication-foundation-service.mjs"],
  risk_class: "communication",
  focused: true,
  fallback_reason: null,
};
const passed = {
  suite: "communication",
  operation_id: "dev_operation_" + "e".repeat(32),
  execution_ok: true,
  passed: true,
  timed_out: false,
  exit_code: 0,
  duration_ms: 15,
};
function manifest(overrides = {}) {
  return buildIntegrationVerificationManifest({
    candidate, plan, suiteResults: [passed],
    diffCheck: { passed: true }, postTestWorktreeClean: true,
    completedAt: "2026-09-22T03:00:00.000Z",
    ...overrides,
  });
}

test("VA-6 records exact source/target/candidate identities and truthful skipped legacy suites", () => {
  const result = manifest();
  assert.equal(result.schema_version, VERIFICATION_MANIFEST_VERSION);
  assert.equal(result.commit, candidate.integration_commit);
  assert.equal(result.source_head, candidate.source_head);
  assert.equal(result.target_head, candidate.target_head);
  assert.equal(result.workstream, candidate.workstream_id);
  assert.deepEqual(result.changed_files, plan.changed_paths);
  assert.deepEqual(result.tests_selected, ["communication"]);
  assert.equal(result.test_selection_granularity, "suite");
  assert.deepEqual(result.tests_skipped.map(item => item.suite), ["mcp", "mcp_tunnel"]);
  assert.equal(result.suite_results[0].operation_id, passed.operation_id);
  assert.equal(result.duration_ms, 15);
  assert.equal(result.gate_result, "passed");
  assert.equal(result.failure_classification.classification, "PASS_STABLE");
  assert.equal(result.failure_classification.original_gate_result, "passed");
  assert.equal(result.reliability_required, false);
  assert.equal(result.certification_required, false);
});

test("VA-6 does not green-light missing, duplicate, timed-out, failed, or dirty results", () => {
  assert.equal(manifest({ suiteResults: [] }).gate_result, "failed");
  assert.deepEqual(manifest({ suiteResults: [] }).missing_required_suites, ["communication"]);
  assert.equal(manifest({ suiteResults: [passed, passed] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, timed_out: true }] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, passed: false }] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, execution_ok: false }] }).gate_result, "failed");
  assert.equal(manifest({ diffCheck: { passed: false } }).gate_result, "failed");
  assert.equal(manifest({ postTestWorktreeClean: false }).gate_result, "failed");
});

test("VA-7 integration receipt classifies observed timeout and typed infrastructure without washing FAIL", () => {
  const timeout = manifest({ suiteResults: [{ ...passed, passed: false, timed_out: true }] });
  assert.equal(timeout.gate_result, "failed");
  assert.equal(timeout.failure_classification.classification, "TIMEOUT");
  assert.equal(timeout.failure_classification.original_gate_result, "failed");
  assert.equal(timeout.failure_classification.changes_gate_result, false);

  const infra = manifest({ suiteResults: [{
    ...passed, passed: false, execution_ok: false, failure_code: "TEST_PROCESS_SPAWN_FAILED",
  }] });
  assert.equal(infra.gate_result, "failed");
  assert.equal(infra.failure_classification.classification, "INFRA_FAILURE");

  const ambiguous = manifest({ suiteResults: [{ ...passed, passed: false, stderr: "TEST_PROCESS_SPAWN_FAILED" }] });
  assert.equal(ambiguous.failure_classification.classification, "UNKNOWN");
});

test("VA-8 diagnostic evidence is SHA-manifest-bound but never replaces the original FAIL", () => {
  const original = {
    ...passed, passed: false, exit_code: 1,
    head: candidate.integration_commit, workspace_snapshot_id: "d".repeat(64),
  };
  const diagnostic = {
    schema_version: "controlled-diagnostic-retry-v1",
    status: "executed",
    reason: "ONE_ISOLATED_DIAGNOSTIC_ATTEMPT",
    exact_commit: candidate.integration_commit,
    suite: original.suite,
    original_operation_id: original.operation_id,
    diagnostic_operation_id: "dev_operation_" + "f".repeat(32),
    original_workspace_snapshot_id: original.workspace_snapshot_id,
    diagnostic_workspace_snapshot_id: original.workspace_snapshot_id,
    attempts_executed: 1,
    verified_same_suite_snapshot_commit: true,
    original_gate_result: "failed",
    diagnostic_passed: true,
    outcome: "flaky_or_infra_unstable",
    changes_gate_result: false,
  };
  const result = manifest({
    suiteResults: [original],
    diagnosticRetries: [diagnostic],
  });
  assert.equal(result.gate_result, "failed");
  assert.equal(result.passed, false);
  assert.equal(result.suite_results[0].passed, false);
  assert.equal(result.diagnostic_attempt_count, 1);
  assert.equal(result.diagnostic_retries[0].outcome, "flaky_or_infra_unstable");
  assert.equal(result.diagnostic_retries[0].changes_gate_result, false);
  const repeated = manifest({
    suiteResults: [original],
    diagnosticRetries: [{ ...diagnostic, diagnostic_passed: false, outcome: "stable_failure_observed_twice" }],
  });
  assert.equal(repeated.gate_result, "failed");
  assert.equal(repeated.diagnostic_retries[0].outcome, "stable_failure_observed_twice");
  assert.throws(() => manifest({
    suiteResults: [passed], diagnosticRetries: [diagnostic],
  }), /original failed suite/u);
  assert.throws(() => manifest({
    suiteResults: [original],
    diagnosticRetries: [{ ...diagnostic, exact_commit: "d".repeat(40) }],
  }), /does not bind/u);
  assert.throws(() => manifest({
    suiteResults: [original],
    diagnosticRetries: [{ ...diagnostic, diagnostic_workspace_snapshot_id: "e".repeat(64) }],
  }), /does not bind/u);
  assert.throws(() => manifest({
    suiteResults: [original],
    diagnosticRetries: [diagnostic, diagnostic],
  }), /bounded array/u);
});

test("VA-6 preserves unknown risk escalation and never marks required MCP gates skipped", () => {
  const fallback = manifest({
    plan: {
      required_suites: ["mcp", "mcp_tunnel"],
      changed_paths: ["unknown.file"],
      risk_class: "unknown_escalated",
      fallback_reason: "UNREVIEWED_CHANGE:unknown.file",
      focused: false,
    },
    suiteResults: [
      { ...passed, suite: "mcp" },
      { ...passed, suite: "mcp_tunnel" },
    ],
  });
  assert.equal(fallback.gate_result, "passed");
  assert.deepEqual(fallback.tests_skipped, []);
  assert.equal(fallback.fallback_reason, "UNREVIEWED_CHANGE:unknown.file");
  assert.deepEqual(fallback.affected_components, []);
});

test("VA-6 carries certification/reliability requirements and rejects invented commit identity", () => {
  const reliability = manifest({
    plan: { ...plan, required_suites: ["mcp_reliability"] },
    suiteResults: [{ ...passed, suite: "mcp_reliability" }],
  });
  assert.equal(reliability.reliability_required, true);
  const certification = manifest({
    plan: { ...plan, required_suites: ["all"] },
    suiteResults: [{ ...passed, suite: "all" }],
  });
  assert.equal(certification.certification_required, true);
  assert.throws(() => manifest({
    candidate: { ...candidate, integration_commit: "main" },
  }), /Invalid exact commit/u);
});

const developmentSnapshot = {
  workspace_snapshot_id: "d".repeat(64),
  head: sha("a"),
  changed_artifact_count: 2,
  manifest: [{ path: "server/src/sample.mjs" }, { path: "tests/sample.test.mjs" }],
};
const developmentContext = { workspace_id: candidate.workspace_id, workstream_id: candidate.workstream_id };
function developmentReceipt(suiteResult = passed, overrides = {}) {
  return buildDevelopmentVerificationManifest({
    workspaceSnapshot: developmentSnapshot,
    workspaceContext: developmentContext,
    suiteResult,
    operationId: passed.operation_id,
    completedAt: "2026-09-22T04:00:00.000Z",
    ...overrides,
  });
}

test("VA-6 development gate binds snapshot identity without claiming exact-commit verification", () => {
  const receipt = developmentReceipt();
  assert.equal(receipt.gate, "development");
  assert.equal(receipt.evidence_identity, "workspace_snapshot");
  assert.equal(receipt.commit, null);
  assert.equal(receipt.head, developmentSnapshot.head);
  assert.equal(receipt.workspace_snapshot_id, developmentSnapshot.workspace_snapshot_id);
  assert.deepEqual(receipt.changed_files, ["server/src/sample.mjs", "tests/sample.test.mjs"]);
  assert.equal(receipt.changed_artifact_count, 2);
  assert.deepEqual(receipt.tests_selected, ["communication"]);
  assert.equal(receipt.test_selection_granularity, "suite");
  assert.deepEqual(receipt.tests_skipped, []);
  assert.equal(receipt.suite_results[0].operation_id, passed.operation_id);
  assert.equal(receipt.gate_result, "passed");
  assert.equal(receipt.failure_classification.classification, "PASS_STABLE");
  assert.equal(receipt.reliability_required, false);
});

test("VA-7 development receipt retains original failure when classifying lock or timeout", () => {
  const lock = developmentReceipt({
    ...passed, passed: false, execution_ok: false, failure_code: "TEST_RUN_LOCK_BUSY",
  });
  assert.equal(lock.gate_result, "failed");
  assert.equal(lock.failure_classification.classification, "LOCK_CONTENTION");
  assert.equal(lock.failure_classification.original_gate_result, "failed");
  assert.equal(lock.failure_classification.changes_gate_result, false);

  const timeout = developmentReceipt({ ...passed, passed: false, timed_out: true });
  assert.equal(timeout.gate_result, "failed");
  assert.equal(timeout.failure_classification.classification, "TIMEOUT");
  assert.equal(timeout.failure_classification.original_gate_result, "failed");
});

test("VA-6 development gate fails closed and does not wash timeout or missing evidence", () => {
  assert.equal(developmentReceipt({ ...passed, passed: false }).gate_result, "failed");
  assert.equal(developmentReceipt({ ...passed, timed_out: true }).gate_result, "failed");
  assert.equal(developmentReceipt({ ...passed, execution_ok: false }).gate_result, "failed");
  assert.equal(developmentReceipt({ ...passed, exit_code: 1 }).gate_result, "failed");
  assert.equal(developmentReceipt({ ...passed, suite: "mcp_reliability" }).reliability_required, true);
  assert.throws(() => developmentReceipt(passed, { workspaceSnapshot: {
    ...developmentSnapshot, workspace_snapshot_id: "missing",
  } }), /snapshot identity/u);
  assert.throws(() => developmentReceipt(passed, { workspaceSnapshot: {
    ...developmentSnapshot, changed_artifact_count: 3,
  } }), /Complete workspace snapshot/u);
  assert.throws(() => developmentReceipt(passed, { operationId: null }), /Journal operation identity/u);
});
