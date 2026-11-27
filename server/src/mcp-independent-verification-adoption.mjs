import { createHash } from "node:crypto";

// Distinct evidence schema. Signed remote suite facts are never relabelled
// as local dev_run_tests operations or local workspace snapshots.
export const INDEPENDENT_INTEGRATION_EVIDENCE = "independent_signed";
const digest = /^[a-f0-9]{64}$/u;
const operation = /^dev_operation_[a-f0-9]{32}$/u;
const positive = n => Number.isSafeInteger(n) && n > 0;
const refKeys = ["candidate_revision", "receipt_sha256", "policy_sha256"];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
function validReference(ref) {
  return ref && typeof ref === "object" && Object.keys(ref).length === refKeys.length
    && refKeys.every(key => Object.hasOwn(ref, key))
    && positive(ref.candidate_revision) && digest.test(ref.receipt_sha256 ?? "") && digest.test(ref.policy_sha256 ?? "");
}
function exactReference(a, b) {
  return validReference(a) && validReference(b) && refKeys.every(k => a[k] === b[k]);
}
function candidateBound(proof, candidate, plan, nowMs, reference) {
  return proof?.verified === true && proof.execution_authorized === false
    && proof.evidence_source === INDEPENDENT_INTEGRATION_EVIDENCE
    && proof.integration_candidate_id === candidate.integration_candidate_id
    && proof.integration_commit === candidate.integration_commit
    && proof.candidate_revision === reference.candidate_revision
    && proof.receipt_sha256 === reference.receipt_sha256
    && proof.policy_sha256 === reference.policy_sha256
    && exactReference(proof.evidence_reference, reference)
    && positive(nowMs) && positive(proof.expires_at_ms) && proof.expires_at_ms > nowMs
    && Array.isArray(plan?.required_suites) && plan.required_suites.length > 0
    && JSON.stringify(proof.required_suites) === JSON.stringify(plan.required_suites)
    && Array.isArray(proof.verified_results) && proof.verified_results.length === proof.suite_count
    && proof.verified_results.length > 0 && proof.verified_results.length <= 64
    && new Set(proof.verified_results.map(row => row.suite + ":" + row.platform)).size === proof.verified_results.length
    && plan.required_suites.every(suite => proof.verified_results.some(row => row.suite === suite))
    && proof.verified_results.every(row => row.commit === candidate.integration_commit
      && typeof row.suite === "string" && ["windows", "linux"].includes(row.platform)
      && digest.test(row.workflow_sha256 ?? "") && positive(row.run_id) && positive(row.job_id)
      && positive(row.run_attempt) && positive(row.completed_at_ms) && row.completed_at_ms <= nowMs
      && row.execution_ok === true && row.passed === true && row.timed_out === false
      && row.skipped === false && row.exit_code === 0);
}

export function requireIndependentValidationProof(proof, candidate, plan, nowMs) {
  const ref = proof?.evidence_reference;
  if (!validReference(ref) || ref.candidate_revision !== candidate.revision
    || !candidateBound(proof, candidate, plan, nowMs, ref)) fail("INDEPENDENT_VALIDATION_EVIDENCE_REQUIRED");
  return structuredClone(proof);
}

export function buildIndependentValidationReport({ candidate, plan, proof, originalRevision, operationId,
  diffCheck, postTestWorktreeClean, cleanupCompleted, freshnessVerified, completedAt } = {}) {
  const now = Date.parse(completedAt);
  const ref = proof?.evidence_reference;
  if (!validReference(ref) || ref.candidate_revision !== originalRevision || !operation.test(operationId ?? "")
    || !candidateBound(proof, candidate, plan, now, ref)) fail("INDEPENDENT_VALIDATION_EVIDENCE_REQUIRED");
  const passed = diffCheck?.passed === true && postTestWorktreeClean === true
    && cleanupCompleted === true && freshnessVerified === true;
  const manifest = {
    schema_version: "independent-integration-verification-v1", gate: "integration",
    evidence_source: INDEPENDENT_INTEGRATION_EVIDENCE, integration_candidate_id: candidate.integration_candidate_id,
    workspace: candidate.workspace_id, workstream: candidate.workstream_id, commit: candidate.integration_commit,
    source_head: candidate.source_head, target_head: candidate.target_head,
    changed_files: [...plan.changed_paths], risk_class: plan.risk_class, focused: plan.focused === true,
    tests_selected: [...plan.required_suites], evidence_reference: structuredClone(ref),
    independent_results: structuredClone(proof.verified_results), issuer: proof.issuer,
    expires_at_ms: proof.expires_at_ms, diff_check_passed: diffCheck?.passed === true,
    post_test_worktree_clean: postTestWorktreeClean === true, cleanup_completed: cleanupCompleted === true,
    freshness_verified: freshnessVerified === true, passed, gate_result: passed ? "passed" : "failed",
    completed_at: completedAt,
  };
  return {
    status: passed ? "passed" : "failed", evidence_source: INDEPENDENT_INTEGRATION_EVIDENCE,
    integration_commit: candidate.integration_commit, source_head: candidate.source_head, target_head: candidate.target_head,
    independent_validation_operation_id: operationId, evidence_reference: structuredClone(ref),
    verification_manifest: manifest, verification_manifest_sha256: hash(manifest),
    // Do not claim any local test suite executions.
    suites: [], diagnostic_retries: [], execution_ok: true, passed, timed_out: false,
    diff_check: structuredClone(diffCheck), post_test_worktree_clean: postTestWorktreeClean === true, completed_at: completedAt,
  };
}

export function requireIndependentApplyEvidence({ candidate, plan, proof, events, nowMs } = {}) {
  const report = candidate?.validation_report;
  const manifest = report?.verification_manifest;
  const ref = report?.evidence_reference;
  if (report?.evidence_source !== INDEPENDENT_INTEGRATION_EVIDENCE
    || report.status !== "passed" || report.passed !== true || report.execution_ok !== true || report.timed_out !== false
    || report.diff_check?.passed !== true || report.post_test_worktree_clean !== true
    || candidate.integration_workspace?.state !== "removed" || candidate.integration_workspace?.cleanup_pending !== false
    || !validReference(ref) || ref.candidate_revision >= candidate.revision
    || !candidateBound(proof, candidate, plan, nowMs, ref)
    || !operation.test(report.independent_validation_operation_id ?? "")
    || manifest?.schema_version !== "independent-integration-verification-v1"
    || manifest.evidence_source !== INDEPENDENT_INTEGRATION_EVIDENCE
    || manifest.passed !== true || manifest.gate_result !== "passed" || manifest.cleanup_completed !== true
    || manifest.diff_check_passed !== true || manifest.post_test_worktree_clean !== true || manifest.freshness_verified !== true
    || manifest.integration_candidate_id !== candidate.integration_candidate_id
    || manifest.workspace !== candidate.workspace_id || manifest.workstream !== candidate.workstream_id
    || manifest.commit !== candidate.integration_commit
    || [manifest, report].some(v => v.source_head !== candidate.source_head || v.target_head !== candidate.target_head)
    || report.integration_commit !== candidate.integration_commit
    || !exactReference(manifest.evidence_reference, ref)
    || JSON.stringify(manifest.tests_selected) !== JSON.stringify(plan.required_suites)
    || JSON.stringify(manifest.changed_files) !== JSON.stringify(plan.changed_paths)
    || JSON.stringify(manifest.independent_results) !== JSON.stringify(proof.verified_results)
    || manifest.expires_at_ms !== proof.expires_at_ms || manifest.issuer !== proof.issuer
    || hash(manifest) !== report.verification_manifest_sha256
    || !Array.isArray(events)) fail("INDEPENDENT_APPLY_EVIDENCE_REQUIRED");
  const own = events.filter(e => e.operation_id === report.independent_validation_operation_id);
  const start = own.find(e => e.stage === "operation_started");
  const done = own.find(e => e.stage === "operation_completed");
  if (own.length !== 2 || !start || !done || done.sequence <= start.sequence
    || own.some(e => e.operation_type !== "integration_validation" || e.tool_name !== "dev_workspace_validate_integration"
      || e.workspace_id !== candidate.workspace_id || e.workstream_id !== candidate.workstream_id
      || e.result?.integration_candidate_id !== candidate.integration_candidate_id
      || e.result?.integration_commit !== candidate.integration_commit
      || e.result?.source_head !== candidate.source_head || e.result?.target_head !== candidate.target_head
      || e.result?.evidence_source !== INDEPENDENT_INTEGRATION_EVIDENCE
      || e.result?.receipt_sha256 !== ref.receipt_sha256 || e.result?.policy_sha256 !== ref.policy_sha256
      || e.result?.candidate_revision !== ref.candidate_revision)
    || done.result.passed !== true || done.result.execution_ok !== true || done.result.cleanup_completed !== true
    || done.result.verification_manifest_sha256 !== report.verification_manifest_sha256)
    fail("INDEPENDENT_APPLY_JOURNAL_EVIDENCE_REQUIRED");
  return true;
}
