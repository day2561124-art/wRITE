import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43H";
const CURRENT_PHASE_SLUG =
  "phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke";
const PREVIOUS_PHASE = "Phase43G";
const PHASE43G_COMMIT = "e930480d83d566cc85244cd29e0c99cd1f435377";
const PHASE43G_CONTRACT_DIGEST =
  "sha256:7f0db2abb42e72b8e118779ac0031a66b5e3c26577b1bddfd53c4a6b0d9218ef";
const PHASE43G_READINESS_DIGEST =
  "sha256:1a7326df065a06338ea51a00dbbc211a5e2330ed1eae51f050d015d3cf44e0bb";
const PHASE43G_RESULT_DIGEST =
  "sha256:9ed3066968f3f91cda6cb6cb8de2e44bffb24fb111e47685a75fe991272ca6ea";
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
  "execution_authorization_persisted",
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

const invocationExecutionAuthorizationContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  previous_phase: PREVIOUS_PHASE,
  kind: "sealed_chain_metadata_only_read_only_status_inspection_capability_invocation_execution_authorization",
  mode: "execution_authorized_no_invocation_no_inspection_no_persistence",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_handoff_phase: "Phase42V",
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  capability_contract_phase: "Phase43B",
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
  invocation_authorization_phase: "Phase43F",
  invocation_authorization_source_commit: PHASE43F_COMMIT,
  invocation_authorization_contract_digest: PHASE43F_CONTRACT_DIGEST,
  invocation_authorization_digest: PHASE43F_AUTHORIZATION_DIGEST,
  invocation_authorization_result_digest: PHASE43F_RESULT_DIGEST,
  invocation_execution_readiness_phase: PREVIOUS_PHASE,
  invocation_execution_readiness_source_commit: PHASE43G_COMMIT,
  invocation_execution_readiness_contract_digest: PHASE43G_CONTRACT_DIGEST,
  invocation_execution_readiness_digest: PHASE43G_READINESS_DIGEST,
  invocation_execution_readiness_result_digest: PHASE43G_RESULT_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  execution_authorization_scope:
    "single_capability_allowlisted_caller_supplied_metadata_projection_only",
  authorization_conditions: Object.freeze([
    "phase43g_invocation_execution_readiness_verified",
    "phase43f_invocation_authorization_preserved",
    "capability_identity_exact_match_required",
    "caller_supplied_metadata_object_required",
    "input_keys_subset_of_metadata_allowlist_required",
    "forbidden_data_classes_absent_required",
    "production_store_independence_required",
    "separate_invocation_execution_phase_required"
  ]),
  authorization_constraints: Object.freeze({
    non_transferable: true,
    no_authority_inheritance: true,
    no_production_store_access: true,
    no_record_enumeration: true,
    no_production_query: true,
    no_metadata_inspection_in_current_phase: true,
    no_status_report_generation: true,
    no_invocation_in_current_phase: true,
    no_mutation: true,
    no_persistence: true,
    no_governance_expansion: true
  }),
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: true,
  authorization_persisted: false,
  no_production_store_dependency: true,
  no_mutation_boundary: true,
  no_persistence_boundary: true,
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

const authorizationDigest = stableHash({
  phase: CURRENT_PHASE,
  capability_id: invocationExecutionAuthorizationContract.capability_id,
  capability_kind: invocationExecutionAuthorizationContract.capability_kind,
  capability_scope: invocationExecutionAuthorizationContract.capability_scope,
  execution_authorization_scope:
    invocationExecutionAuthorizationContract.execution_authorization_scope,
  authorization_conditions:
    invocationExecutionAuthorizationContract.authorization_conditions,
  authorization_constraints:
    invocationExecutionAuthorizationContract.authorization_constraints,
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: true,
  execution_authorization_persisted: false,
  invocation_performed: false
});
const contractDigest = stableHash(invocationExecutionAuthorizationContract);
const nextPhaseGuidance = Object.freeze({
  status: "invocation_execution_authorized_not_invoked",
  current_phase_preserves_invocation_authorization: true,
  current_phase_authorizes_execution: true,
  current_phase_invokes_capability: false,
  current_phase_inspects_metadata: false,
  invocation_execution_requires_separate_explicit_phase: true,
  recommended_next_step:
    "In a later separate explicit invocation execution phase, invoke the authorized metadata-only read-only status inspection capability only with validated caller-supplied allowlisted metadata, without reading production candidate store contents, enumerating records, executing a production query, mutating or persisting production state, or granting governance, Canon, or active_engine authority."
});
const resultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43g_commit: PHASE43G_COMMIT,
  phase43g_contract_digest: PHASE43G_CONTRACT_DIGEST,
  phase43g_readiness_digest: PHASE43G_READINESS_DIGEST,
  phase43g_result_digest: PHASE43G_RESULT_DIGEST,
  contract_digest: contractDigest,
  authorization_digest: authorizationDigest,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: true,
  execution_authorization_persisted: false,
  invocation_performed: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  next_phase_guidance: nextPhaseGuidance
});

assert.equal(contractDigest, "sha256:662d26e3c8116b96151b0684fe149d484439897ee6e0c23efe6acc5a3040f9df");
assert.equal(authorizationDigest, "sha256:81889f62bc21af2054e035a615a04408fd62559401546647cf3b1d8b814b4829");
assert.equal(resultDigest, "sha256:8e5151835ef01292c6bd3f9704becc1cb8b62e6b451ebb2b2df99dbdb6ce1ef8");
assert.equal(invocationExecutionAuthorizationContract.implementation_present, true);
assert.equal(invocationExecutionAuthorizationContract.invocation_ready, true);
assert.equal(invocationExecutionAuthorizationContract.invocation_authorized, true);
assert.equal(invocationExecutionAuthorizationContract.invocation_execution_ready, true);
assert.equal(invocationExecutionAuthorizationContract.execution_authorized, true);
assert.equal(invocationExecutionAuthorizationContract.full_run_all_passed_claimed, false);
assert.deepEqual(invocationExecutionAuthorizationContract.metadata_allowlist, METADATA_ALLOWLIST);
assert.deepEqual(invocationExecutionAuthorizationContract.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(invocationExecutionAuthorizationContract[field], false, `${field} must remain false`);
}
for (const constraint of Object.values(invocationExecutionAuthorizationContract.authorization_constraints)) {
  assert.equal(constraint, true);
}
assert.equal(nextPhaseGuidance.current_phase_authorizes_execution, true);
assert.equal(nextPhaseGuidance.current_phase_invokes_capability, false);
assert.equal(nextPhaseGuidance.current_phase_inspects_metadata, false);
assert.equal(nextPhaseGuidance.invocation_execution_requires_separate_explicit_phase, true);

const phase43GSource = readRepoFile(
  "tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs"
);
for (const marker of [
  PHASE43G_CONTRACT_DIGEST,
  PHASE43G_READINESS_DIGEST,
  PHASE43G_RESULT_DIGEST,
  PHASE43F_COMMIT,
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
  "implementation_present: true",
  "invocation_ready: true",
  "invocation_authorized: true",
  "invocation_execution_ready: true",
  "execution_authorized: false",
  "invocation_performed: false",
  "Define Phase43H invocation execution authorization",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(phase43GSource.includes(marker), true, `Phase43G marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke.test.mjs";
const phase43GRegistration =
  '  ["Phase 43G production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution readiness smoke", ["tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs"]],';
const phase43HRegistration =
  '  ["Phase 43H production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution authorization smoke", ["tests/phase43/phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assert.equal(countOccurrences(runAllText, phase43HRegistration), 1);
assert.equal(
  runAllText.includes(`${phase43GRegistration}\n${phase43HRegistration}`),
  true,
  "Phase43H registration must be immediately after Phase43G"
);

const currentSource = readRepoFile(currentTestPath);
for (const pattern of [
  /\.project\s*\(/,
  /\binspect_sealed_chain_closure_metadata\s*\(/,
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

console.log(`Phase43H metadata-only read-only status inspection capability invocation execution authorization contract digest: ${contractDigest}`);
console.log(`Phase43H metadata-only read-only status inspection capability invocation execution authorization digest: ${authorizationDigest}`);
console.log(`Phase43H metadata-only read-only status inspection capability invocation execution authorization result digest: ${resultDigest}`);
console.log("Phase43H metadata-only read-only status inspection capability invocation execution authorization smoke tests passed.");
