import { classifyVerificationFailure } from "./mcp-verification-failure-classifier.mjs";

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
    failure_classification: classifyVerificationFailure({
      gatePassed: passed,
      suiteResults,
      diffCheckPassed: diffCheck?.passed === true,
      postTestWorktreeClean,
    }),
    certification_required: expected.includes("all"),
    reliability_required: expected.includes("mcp_reliability"),
    diff_check_passed: diffCheck?.passed === true,
    post_test_worktree_clean: postTestWorktreeClean === true,
    completed_at: timestamp,
  });
}

const workspaceSnapshotPattern = /^[a-f0-9]{64}$/u;

// A development receipt is bound to an immutable working-tree snapshot, not
// an exact candidate commit. Never substitute HEAD for a validated tree.
export function buildDevelopmentVerificationManifest({
  workspaceSnapshot, workspaceContext, suiteResult, operationId, completedAt,
} = {}) {
  const snapshotId = workspaceSnapshot?.workspace_snapshot_id;
  if (typeof snapshotId !== "string" || !workspaceSnapshotPattern.test(snapshotId)) {
    throw new Error("Exact workspace snapshot identity is required.");
  }
  const head = exactSha(workspaceSnapshot.head, "workspace_head");
  if (!Array.isArray(workspaceSnapshot.manifest)
      || workspaceSnapshot.changed_artifact_count !== workspaceSnapshot.manifest.length) {
    throw new Error("Complete workspace snapshot manifest is required.");
  }
  if (!workspaceContext?.workspace_id || typeof suiteResult?.suite !== "string"
      || !suiteResult.suite || typeof operationId !== "string" || !operationId) {
    throw new Error("Workspace, test suite and Journal operation identity are required.");
  }
  const changedFiles = workspaceSnapshot.manifest.map((item) => {
    if (typeof item?.path !== "string" || !item.path) {
      throw new Error("Workspace snapshot contains an invalid changed path.");
    }
    return item.path;
  });
  const result = {
    suite: suiteResult.suite,
    operation_id: operationId,
    execution_ok: suiteResult.execution_ok === true,
    passed: suiteResult.passed === true,
    timed_out: suiteResult.timed_out === true,
    exit_code: Number.isInteger(suiteResult.exit_code) ? suiteResult.exit_code : null,
    duration_ms: Number.isFinite(suiteResult.duration_ms) && suiteResult.duration_ms >= 0
      ? suiteResult.duration_ms : null,
  };
  const passed = result.execution_ok && result.passed && !result.timed_out
    && result.exit_code === 0;
  const timestamp = typeof completedAt === "string" && Number.isFinite(Date.parse(completedAt))
    ? completedAt : null;
  return Object.freeze({
    schema_version: VERIFICATION_MANIFEST_VERSION,
    gate: "development",
    evidence_identity: "workspace_snapshot",
    commit: null,
    head,
    workspace_snapshot_id: snapshotId,
    workspace: workspaceContext.workspace_id,
    workstream: workspaceContext.workstream_id ?? null,
    changed_files: [...new Set(changedFiles)].sort(),
    changed_artifact_count: workspaceSnapshot.changed_artifact_count,
    risk_class: "not_evaluated_standalone",
    affected_components: [],
    focused: suiteResult.suite === "affected",
    fallback_reason: null,
    tests_selected: [result.suite],
    test_selection_granularity: "suite",
    tests_skipped: [],
    skip_reason: null,
    suite_results: [result],
    passed,
    failed: !passed,
    timed_out: result.timed_out,
    duration_ms: result.duration_ms,
    required_gate: "standalone_development",
    gate_result: passed ? "passed" : "failed",
    failure_classification: classifyVerificationFailure({
      gatePassed: passed,
      suiteResults: [suiteResult],
    }),
    certification_required: false,
    reliability_required: result.suite === "mcp_reliability",
    completed_at: timestamp,
  });
}
