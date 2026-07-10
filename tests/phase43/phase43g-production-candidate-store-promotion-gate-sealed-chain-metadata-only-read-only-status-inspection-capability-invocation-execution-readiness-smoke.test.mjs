import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43G";
const CURRENT_PHASE_SLUG =
  "phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke";
const PREVIOUS_PHASE = "Phase43F";
const PHASE43F_COMMIT = "f09e058ccb26d5f81b1bd24cc312926f961cf5d2";
const PHASE43F_CONTRACT_DIGEST =
  "sha256:407be8462f2c8cd14459c242466c359a283320af3109725a330692e63a3c048c";
const PHASE43F_AUTHORIZATION_DIGEST =
  "sha256:fdd95088ef78c57fce785b4e3e7c8788d0c8f353e420ed23fc1be75f9f7fa223";
const PHASE43F_RESULT_DIGEST =
  "sha256:d457c7aaca7d65fedf992e50703e65025efb25a0ea141b4138f47e433df4ff9f";
const PHASE43E_COMMIT = "a19dde94d3d2b2cd7b79f538b34f9f0b8affe369";
const PHASE43E_CONTRACT_DIGEST =
  "sha256:51fa22efa536f4a398f444a413eb21298879476a8ab905af267d1eff4f60f0fc";
const PHASE43E_READINESS_DIGEST =
  "sha256:b74d429b385e40af0653cd98d98760b3d9504addc4bd20d35614fa3f06dd2037";
const PHASE43E_RESULT_DIGEST =
  "sha256:f52d21af7daf5b95af9101cd0c6b98adc989c7a1d7b2e6237bcf57e2e4695707";
const PHASE43D_COMMIT = "eb0f90db388e28d81ca112f19435e5f3e3204379";
const PHASE43D_CONTRACT_DIGEST =
  "sha256:e71c4919fad2c7f667ee22894f798219cc781f4ec55684280376e88eea27f748";
const PHASE43D_IMPLEMENTATION_DIGEST =
  "sha256:4df652edf9610e35d437077ec36ece0bafdbc3a96603e7df30238b5d6d057f2c";
const PHASE43D_RESULT_DIGEST =
  "sha256:dd94fed4c18cb1990338bc8576bb89d5ac8c6689e63b6fe99a46aa17972b385f";
const FULL_RUN_ALL_PENDING_STATUS =
  "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE =
  "Full run-all remains separately pending due to prior Backup export service timeout.";

const METADATA_ALLOWLIST = Object.freeze([
  "source_chain",
  "source_chain_closed",
  "source_handoff_phase",
  "source_handoff_seal_digest",
  "explicit_scope_phase",
  "explicit_scope_id",
  "explicit_scope_acceptance_digest",
  "capability_contract_phase",
  "capability_contract_digest",
  "capability_contract_preview_digest",
  "capability_id",
  "capability_kind",
  "capability_scope",
  "capability_contract_status",
  "implementation_readiness_status",
  "full_run_all_status"
]);

const FORBIDDEN_DATA_CLASSES = Object.freeze([
  "production_candidate_payload",
  "production_candidate_content",
  "candidate_store_record_body",
  "production_candidate_record",
  "production_candidate_record_list",
  "production_candidate_index",
  "production_candidate_query_result",
  "candidate_store_storage_bytes",
  "candidate_store_connection_details",
  "approval_request_payload",
  "pending_engine_candidate_payload",
  "audit_receipt_payload",
  "backup_snapshot_payload",
  "rollback_restore_payload",
  "canon_document_body",
  "active_engine_document_body",
  "secret_or_credential_material"
]);

const PROTECTED_FALSE_FIELDS = Object.freeze([
  "implementation_authorized",
  "execution_authorized",
  "invocation_performed",
  "metadata_inspection_performed",
  "status_report_generated",
  "production_candidate_store_contents_read",
  "production_candidate_records_enumerated",
  "production_query_executed",
  "production_candidate_store_mutated",
  "production_candidate_store_write_executed",
  "production_candidate_store_promotion_executed",
  "production_promotion_gate_opened",
  "guard_token_consumed",
  "approval_request_created",
  "pending_engine_candidate_created",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "adoption_executed",
  "settlement_executed",
  "canon_updated",
  "active_engine_updated",
  "phase42_chain_reopened",
  "source_authority_inherited",
  "authority_transferred"
]);

const invocationExecutionReadinessContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  previous_phase: PREVIOUS_PHASE,
  kind: "sealed_chain_metadata_only_read_only_status_inspection_capability_invocation_execution_readiness",
  mode: "invocation_execution_ready_no_execution_authorization_no_invocation_no_inspection",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_handoff_phase: "Phase42V",
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  capability_contract_phase: "Phase43B",
  implementation_readiness_phase: "Phase43C",
  minimal_implementation_phase: "Phase43D",
  minimal_implementation_source_commit: PHASE43D_COMMIT,
  minimal_implementation_contract_digest: PHASE43D_CONTRACT_DIGEST,
  minimal_implementation_digest: PHASE43D_IMPLEMENTATION_DIGEST,
  minimal_implementation_result_digest: PHASE43D_RESULT_DIGEST,
  invocation_readiness_phase: "Phase43E",
  invocation_readiness_source_commit: PHASE43E_COMMIT,
  invocation_readiness_contract_digest: PHASE43E_CONTRACT_DIGEST,
  invocation_readiness_digest: PHASE43E_READINESS_DIGEST,
  invocation_readiness_result_digest: PHASE43E_RESULT_DIGEST,
  invocation_authorization_phase: PREVIOUS_PHASE,
  invocation_authorization_source_commit: PHASE43F_COMMIT,
  invocation_authorization_contract_digest: PHASE43F_CONTRACT_DIGEST,
  invocation_authorization_digest: PHASE43F_AUTHORIZATION_DIGEST,
  invocation_authorization_result_digest: PHASE43F_RESULT_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  execution_input_boundary: "validated_caller_supplied_allowlisted_metadata_object_only",
  execution_readiness_preconditions: Object.freeze([
    "phase43f_invocation_authorization_verified",
    "capability_identity_exact_match_required",
    "implementation_present_verified",
    "invocation_ready_verified",
    "invocation_authorized_verified",
    "input_validation_required_before_future_execution",
    "forbidden_data_classes_absent_required",
    "production_store_independence_required",
    "separate_execution_authorization_phase_required"
  ]),
  rejection_rules: Object.freeze({
    reject_capability_identity_mismatch: true,
    reject_non_object_input: true,
    reject_array_input: true,
    reject_non_allowlisted_input_keys: true,
    reject_forbidden_data_classes: true,
    reject_production_store_access_request: true,
    reject_record_enumeration_request: true,
    reject_production_query_request: true
  }),
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  invocation_execution_ready: true,
  no_production_store_dependency: true,
  no_invocation_boundary: true,
  no_new_production_authority: true,
  no_new_governance_authority: true,
  no_new_canon_authority: true,
  no_new_active_engine_authority: true,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  ...Object.fromEntries(PROTECTED_FALSE_FIELDS.map((field) => [field, false]))
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function stableHash(value) {
  return "sha256:" + crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

const readinessDigest = stableHash({
  phase: CURRENT_PHASE,
  capability_id: invocationExecutionReadinessContract.capability_id,
  capability_kind: invocationExecutionReadinessContract.capability_kind,
  capability_scope: invocationExecutionReadinessContract.capability_scope,
  execution_input_boundary: invocationExecutionReadinessContract.execution_input_boundary,
  execution_readiness_preconditions:
    invocationExecutionReadinessContract.execution_readiness_preconditions,
  rejection_rules: invocationExecutionReadinessContract.rejection_rules,
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: false,
  invocation_performed: false
});
const contractDigest = stableHash(invocationExecutionReadinessContract);
const nextPhaseGuidance = Object.freeze({
  status: "invocation_execution_ready_not_execution_authorized_not_invoked",
  current_phase_preserves_invocation_authorization: true,
  current_phase_authorizes_execution: false,
  current_phase_invokes_capability: false,
  current_phase_inspects_metadata: false,
  invocation_execution_authorization_requires_separate_explicit_phase: true,
  recommended_next_step:
    "Define Phase43H invocation execution authorization for the execution-ready metadata-only read-only status inspection capability without invoking it, inspecting metadata, reading production candidate store contents, enumerating records, executing a production query, generating a status report, or granting mutation, governance, Canon, or active_engine authority."
});
const resultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43f_commit: PHASE43F_COMMIT,
  phase43f_contract_digest: PHASE43F_CONTRACT_DIGEST,
  phase43f_authorization_digest: PHASE43F_AUTHORIZATION_DIGEST,
  phase43f_result_digest: PHASE43F_RESULT_DIGEST,
  contract_digest: contractDigest,
  readiness_digest: readinessDigest,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: false,
  invocation_performed: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  next_phase_guidance: nextPhaseGuidance
});

assert.equal(contractDigest, "sha256:7f0db2abb42e72b8e118779ac0031a66b5e3c26577b1bddfd53c4a6b0d9218ef");
assert.equal(readinessDigest, "sha256:1a7326df065a06338ea51a00dbbc211a5e2330ed1eae51f050d015d3cf44e0bb");
assert.equal(resultDigest, "sha256:9ed3066968f3f91cda6cb6cb8de2e44bffb24fb111e47685a75fe991272ca6ea");
assert.equal(invocationExecutionReadinessContract.implementation_present, true);
assert.equal(invocationExecutionReadinessContract.invocation_ready, true);
assert.equal(invocationExecutionReadinessContract.invocation_authorized, true);
assert.equal(invocationExecutionReadinessContract.invocation_execution_ready, true);
assert.equal(invocationExecutionReadinessContract.full_run_all_passed_claimed, false);
assert.deepEqual(invocationExecutionReadinessContract.metadata_allowlist, METADATA_ALLOWLIST);
assert.deepEqual(invocationExecutionReadinessContract.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(invocationExecutionReadinessContract[field], false, `${field} must remain false`);
}
for (const rejectionRule of Object.values(invocationExecutionReadinessContract.rejection_rules)) {
  assert.equal(rejectionRule, true);
}
assert.equal(nextPhaseGuidance.current_phase_preserves_invocation_authorization, true);
assert.equal(nextPhaseGuidance.current_phase_authorizes_execution, false);
assert.equal(nextPhaseGuidance.current_phase_invokes_capability, false);
assert.equal(nextPhaseGuidance.invocation_execution_authorization_requires_separate_explicit_phase, true);

const phase43FSource = readRepoFile(
  "tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs"
);
for (const marker of [
  PHASE43F_CONTRACT_DIGEST,
  PHASE43F_AUTHORIZATION_DIGEST,
  PHASE43F_RESULT_DIGEST,
  PHASE43E_COMMIT,
  PHASE43E_CONTRACT_DIGEST,
  PHASE43E_READINESS_DIGEST,
  PHASE43E_RESULT_DIGEST,
  PHASE43D_COMMIT,
  PHASE43D_CONTRACT_DIGEST,
  PHASE43D_IMPLEMENTATION_DIGEST,
  PHASE43D_RESULT_DIGEST,
  'capability_id: "inspect_sealed_chain_closure_metadata"',
  "invocation_authorized: true",
  "execution_authorized: false",
  "invocation_performed: false",
  "Define Phase43G invocation execution readiness",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(phase43FSource.includes(marker), true, `Phase43F marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs";
const phase43FRegistration =
  '  ["Phase 43F production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation authorization smoke", ["tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs"]],';
const phase43GRegistration =
  '  ["Phase 43G production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution readiness smoke", ["tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assert.equal(
  runAllText.includes(`${phase43FRegistration}\n${phase43GRegistration}`),
  true,
  "Phase43G registration must be immediately after Phase43F"
);

const currentSource = readRepoFile(currentTestPath);
for (const pattern of [
  /\.project\s*\(/,
  /\bcreateApprovalRequest\s*\(/,
  /\bcreatePendingEngineCandidate\s*\(/,
  /\bwriteProductionCandidateStore\s*\(/,
  /\bpromoteProductionCandidate\s*\(/,
  /\bopenProductionGate\s*\(/,
  /\bconsumeGuardToken\s*\(/,
  /\bcreateAuditReceipt\s*\(/,
  /\bcreateBackupSnapshot\s*\(/,
  /\bexecuteRollbackRestore\s*\(/,
  /\bexecuteAdoption\s*\(/,
  /\bexecuteSettlement\s*\(/,
  /\bupdateCanon\s*\(/,
  /\bupdateActiveEngine\s*\(/,
  /\breadProductionCandidateContents\s*\(/,
  /\benumerateProductionCandidateRecords\s*\(/,
  /\bqueryProductionCandidateStore\s*\(/,
  /\bwriteFileSync\s*\(/,
  /\bappendFileSync\s*\(/,
  /\brenameSync\s*\(/,
  /\bunlinkSync\s*\(/,
  /\brmSync\s*\(/
]) {
  assert.equal(pattern.test(currentSource), false, `Forbidden executable call pattern ${pattern}`);
}

console.log(`Phase43G metadata-only read-only status inspection capability invocation execution readiness contract digest: ${contractDigest}`);
console.log(`Phase43G metadata-only read-only status inspection capability invocation execution readiness digest: ${readinessDigest}`);
console.log(`Phase43G metadata-only read-only status inspection capability invocation execution readiness result digest: ${resultDigest}`);
console.log("Phase43G metadata-only read-only status inspection capability invocation execution readiness smoke tests passed.");
