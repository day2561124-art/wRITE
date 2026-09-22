// VA-6: exact-candidate verification evidence. This is a trace of actual
// execution, not a new authority or an alternative to Journal provenance.
export const VERIFICATION_MANIFEST_VERSION = "verification-manifest-v1";
const shaPattern = /^[a-f0-9]{40}$/u;

function exactSha(value, field) {
  if (typeof value !== "string" || !shaPattern.test(value)) {
    throw new Error(`Invalid exact commit for ${field}.`);
  }
  return value;
}

export function buildIntegrationVerificationManifest({
  candidate, plan, suiteResults, diffCheck, postTestWorktreeClean, completedAt,
} = {}) {
  const commit = exactSha(candidate?.integration_commit, "integration_commit");
  const sourceHead = exactSha(candidate?.source_head, "source_head");
  const targetHead = exactSha(candidate?.target_head, "target_head");
  if (
    !plan || !Array.isArray(plan.required_suites) || plan.required_suites.length === 0
    || !Array.isArray(plan.changed_paths) || !Array.isArray(suiteResults)
  ) throw new Error("Exact change plan and actual suite results are required.");
  const expected = [...new Set(plan.required_suites)];
  if (expected.length !== plan.required_suites.length) throw new Error("Duplicate required suites.");
  const results = suiteResults.map((result) => ({
    suite: String(result.suite ?? ""),
    operation_id: typeof result.operation_id === "string" ? result.operation_id : null,
    execution_ok: result.execution_ok === true,
    passed: result.passed === true,
    timed_out: result.timed_out === true,
    exit_code: Number.isInteger(result.exit_code) ? result.exit_code : null,
    duration_ms: Number.isFinite(result.duration_ms) && result.duration_ms >= 0 ? result.duration_ms : null,
  }));
  const observed = results.map((result) => result.suite);
  const missingRequiredSuites = expected.filter((suite) => !observed.includes(suite));
  const duplicateResults = observed.length !== new Set(observed).size;
  const passed = missingRequiredSuites.length === 0
    && !duplicateResults && results.length > 0
    && results.every((result) => result.execution_ok && result.passed && !result.timed_out)
    && diffCheck?.passed === true && postTestWorktreeClean === true;
  const legacySuites = ["mcp", "mcp_tunnel"];
  const skipped = legacySuites
    .filter((suite) => !observed.includes(suite) && !expected.includes(suite))
    .map((suite) => ({
      suite,
      reason: plan.focused === true ? "RISK_ROUTED_NOT_REQUIRED" : "NOT_IN_REQUIRED_PLAN",
    }));
  const totalDuration = results.every((result) => result.duration_ms !== null)
    ? results.reduce((sum, result) => sum + result.duration_ms, 0) : null;
  const timestamp = typeof completedAt === "string" && Number.isFinite(Date.parse(completedAt))
    ? completedAt : null;
  return Object.freeze({
    schema_version: VERIFICATION_MANIFEST_VERSION,
    gate: "integration",
    commit,
    source_head: sourceHead,
    target_head: targetHead,
    integration_candidate_id: candidate.integration_candidate_id,
    workspace: candidate.workspace_id,
    workstream: candidate.workstream_id,
    changed_files: [...plan.changed_paths],
    risk_class: plan.risk_class ?? "unknown_escalated",
    affected_components: plan.risk_class === "unknown_escalated" ? [] : [plan.risk_class],
    focused: plan.focused === true,
    fallback_reason: plan.fallback_reason ?? null,
    // The runner reports suite-level evidence, not individual test-file results.
    tests_selected: expected,
    test_selection_granularity: "suite",
    tests_skipped: skipped,
    skip_reason: skipped.length ? skipped[0].reason : null,
    suite_results: results,
    missing_required_suites: missingRequiredSuites,
    passed,
    failed: !passed && results.some((result) => !result.passed || !result.execution_ok),
    timed_out: results.some((result) => result.timed_out),
    duration_ms: totalDuration,
    required_gate: "exact_candidate_integration",
    gate_result: passed ? "passed" : "failed",
    certification_required: expected.includes("all"),
    reliability_required: expected.includes("mcp_reliability"),
    diff_check_passed: diffCheck?.passed === true,
    post_test_worktree_clean: postTestWorktreeClean === true,
    completed_at: timestamp,
  });
}
