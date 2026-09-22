// VA-8: one diagnostic rerun, never another opportunity to pass the original gate.
// The caller supplies server-owned test receipts and verifies the isolated worktree
// snapshot before invoking a fresh, already allowlisted test-runner child process.
export const CONTROLLED_DIAGNOSTIC_RETRY_VERSION = "controlled-diagnostic-retry-v1";
const operationPattern = /^dev_operation_[a-f0-9]{32}$/u;
const snapshotPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;

function validOriginal(original, exactCommit) {
  return original?.passed === false
    && typeof original.suite === "string" && original.suite.length > 0
    && operationPattern.test(original.operation_id ?? "")
    && snapshotPattern.test(original.workspace_snapshot_id ?? "")
    && shaPattern.test(exactCommit ?? "")
    && original.head === exactCommit;
}

function summary(original, exactCommit, status, reason, diagnostic = null) {
  const sameIdentity = diagnostic !== null
    && original.suite === diagnostic.suite
    && original.workspace_snapshot_id === diagnostic.workspace_snapshot_id
    && original.head === diagnostic.head
    && original.operation_id !== diagnostic.operation_id
    && operationPattern.test(diagnostic.operation_id ?? "");
  const retryPassed = diagnostic?.execution_ok === true
    && diagnostic?.passed === true && diagnostic?.timed_out !== true
    && diagnostic?.exit_code === 0;
  // A second timeout, spawn failure, lock collision, or missing exit status
  // is not evidence that the same test assertion failed twice.
  const diagnosticFailed = diagnostic?.execution_ok === true
    && diagnostic?.passed === false && diagnostic?.timed_out !== true
    && Number.isInteger(diagnostic?.exit_code) && diagnostic.exit_code !== 0;
  const outcome = status !== "executed" || !sameIdentity
    ? "inconclusive"
    : retryPassed ? "flaky_or_infra_unstable"
      : diagnosticFailed ? "stable_failure_observed_twice" : "inconclusive";
  return Object.freeze({
    schema_version: CONTROLLED_DIAGNOSTIC_RETRY_VERSION,
    status,
    reason,
    max_diagnostic_attempts: 1,
    attempts_executed: diagnostic === null ? 0 : 1,
    exact_commit: exactCommit ?? null,
    suite: original?.suite ?? null,
    original_operation_id: original?.operation_id ?? null,
    diagnostic_operation_id: diagnostic?.operation_id ?? null,
    original_workspace_snapshot_id: original?.workspace_snapshot_id ?? null,
    diagnostic_workspace_snapshot_id: diagnostic?.workspace_snapshot_id ?? null,
    verified_same_suite_snapshot_commit: sameIdentity,
    original_gate_result: "failed",
    diagnostic_passed: diagnostic === null ? null : retryPassed,
    diagnostic_execution_ok: diagnostic?.execution_ok === true,
    diagnostic_timed_out: diagnostic?.timed_out === true,
    diagnostic_exit_code: Number.isInteger(diagnostic?.exit_code) ? diagnostic.exit_code : null,
    outcome,
    changes_gate_result: false,
  });
}

// A policy decision cannot bypass a missing Journal receipt, changed source
// snapshot, failed isolation check, or a previously green first attempt.
export function selectControlledRetryPolicy({ originalResult, exactCommit } = {}) {
  if (originalResult?.passed === true) {
    return Object.freeze({ allowed: false, reason: "ORIGINAL_PASSED", max_attempts: 0 });
  }
  if (!validOriginal(originalResult, exactCommit)) {
    return Object.freeze({ allowed: false, reason: "ORIGINAL_FAILURE_PROVENANCE_UNAVAILABLE", max_attempts: 0 });
  }
  return Object.freeze({ allowed: true, reason: "VERIFIED_FIRST_FAILURE", max_attempts: 1 });
}

export async function runControlledDiagnosticRetry({
  originalResult, exactCommit, verifyIsolation, runOnce,
} = {}) {
  const policy = selectControlledRetryPolicy({ originalResult, exactCommit });
  if (!policy.allowed) {
    return summary(originalResult, exactCommit, "skipped", policy.reason);
  }
  if (typeof verifyIsolation !== "function" || typeof runOnce !== "function") {
    return summary(originalResult, exactCommit, "skipped", "ISOLATION_OR_RUNNER_UNAVAILABLE");
  }
  let isolation;
  try {
    isolation = await verifyIsolation();
  } catch {
    return summary(originalResult, exactCommit, "skipped", "ISOLATION_CHECK_FAILED");
  }
  if (isolation?.workspace_snapshot_id !== originalResult.workspace_snapshot_id
      || isolation?.head !== exactCommit
      || isolation?.changed_artifact_count !== 0) {
    return summary(originalResult, exactCommit, "skipped", "WORKSPACE_SNAPSHOT_NOT_IDENTICAL_AND_CLEAN");
  }

  let diagnostic;
  try {
    diagnostic = await runOnce(originalResult.suite);
  } catch {
    return summary(originalResult, exactCommit, "executed", "DIAGNOSTIC_RUNNER_ERROR", {
      suite: originalResult.suite, passed: false,
    });
  }
  const receipt = summary(originalResult, exactCommit, "executed",
    "ONE_ISOLATED_DIAGNOSTIC_ATTEMPT", diagnostic);
  if (!receipt.verified_same_suite_snapshot_commit) {
    return Object.freeze({ ...receipt, reason: "DIAGNOSTIC_IDENTITY_NOT_VERIFIED" });
  }
  return receipt;
}
