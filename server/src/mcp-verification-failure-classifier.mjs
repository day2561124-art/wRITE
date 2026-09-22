// VA-7: explain observed verification outcomes without changing their authority.
// A diagnostic classification is not a retry and never converts the original gate to PASS.
export const VERIFICATION_FAILURE_CLASSIFICATION_VERSION = "verification-failure-classification-v1";
export const VERIFICATION_FAILURE_CLASSES = Object.freeze([
  "PASS_STABLE", "REGRESSION", "FLAKY", "INFRA_FAILURE",
  "ENVIRONMENT_FAILURE", "TIMEOUT", "LOCK_CONTENTION", "UNKNOWN",
]);

const lockCodes = new Set(["TEST_RUN_LOCK_BUSY", "LOCK_CONTENTION"]);
const environmentCodes = new Set(["DEPENDENCY_BRIDGE_SETUP_FAILED", "MISSING_TEST_DEPENDENCY", "ENVIRONMENT_UNAVAILABLE"]);
const infrastructureCodes = new Set(["TEST_PROCESS_SPAWN_FAILED", "TEST_PORT_CLEANUP_FAILED", "RUNNER_UNAVAILABLE", "JOURNAL_UNAVAILABLE", "SNAPSHOT_CAPTURE_FAILED"]);

function observedCode(result) {
  const code = result?.failure_code ?? result?.error_code;
  return typeof code === "string" ? code : null;
}

export function classifyVerificationFailure({
  gatePassed = false, suiteResults, diffCheckPassed = true,
  postTestWorktreeClean = true, comparison = null,
} = {}) {
  const results = Array.isArray(suiteResults) ? suiteResults : [];
  const originalGateResult = gatePassed === true ? "passed" : "failed";
  // Never substitute a clean retry for the original verdict.
  const evidence = (classification, reason, suite = null) => Object.freeze({
    schema_version: VERIFICATION_FAILURE_CLASSIFICATION_VERSION,
    classification, reason, suite,
    original_gate_result: originalGateResult,
    changes_gate_result: false,
  });
  if (gatePassed === true) {
    return evidence("PASS_STABLE", "ORIGINAL_GATE_PASSED");
  }
  const timeout = results.find((result) => result?.timed_out === true);
  if (timeout) return evidence("TIMEOUT", "OBSERVED_TEST_TIMEOUT", timeout.suite ?? null);

  const lock = results.find((result) => lockCodes.has(observedCode(result)));
  if (lock) return evidence("LOCK_CONTENTION", observedCode(lock), lock.suite ?? null);
  const environment = results.find((result) => environmentCodes.has(observedCode(result)));
  if (environment) return evidence("ENVIRONMENT_FAILURE", observedCode(environment), environment.suite ?? null);
  const infrastructure = results.find((result) => infrastructureCodes.has(observedCode(result)));
  if (infrastructure) return evidence("INFRA_FAILURE", observedCode(infrastructure), infrastructure.suite ?? null);

  // Comparative classifications require explicit, verified identities. A lone
  // failed run, log substring, or changed HEAD is never proof of regression/flakiness.
  if (comparison?.verified_same_snapshot === true
      && comparison.verified_same_suite === true
      && comparison.original_passed === false
      && comparison.diagnostic_passed === true) {
    return evidence("FLAKY", "VERIFIED_SAME_SNAPSHOT_MIXED_OUTCOMES", comparison.suite ?? null);
  }
  if (comparison?.verified_baseline_equivalence === true
      && comparison.verified_suite_identity === true
      && comparison.baseline_passed === true
      && comparison.candidate_passed === false
      && comparison.non_code_confounds_excluded === true) {
    return evidence("REGRESSION", "VERIFIED_BASELINE_CANDIDATE_DIFFERENCE", comparison.suite ?? null);
  }
  if (!diffCheckPassed || !postTestWorktreeClean) {
    return evidence("UNKNOWN", "INTEGRATION_WORKTREE_OR_DIFF_GATE_FAILED");
  }
  return evidence("UNKNOWN", results.length ? "INSUFFICIENT_FAILURE_EVIDENCE" : "MISSING_SUITE_EVIDENCE");
}
