import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43E";
const CURRENT_PHASE_SLUG =
  "phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke";
const PREVIOUS_PHASE = "Phase43D";
const PHASE43D_COMMIT = "eb0f90db388e28d81ca112f19435e5f3e3204379";
const PHASE43D_CONTRACT_DIGEST =
  "sha256:e71c4919fad2c7f667ee22894f798219cc781f4ec55684280376e88eea27f748";
const PHASE43D_IMPLEMENTATION_DIGEST =
  "sha256:4df652edf9610e35d437077ec36ece0bafdbc3a96603e7df30238b5d6d057f2c";
const PHASE43D_RESULT_DIGEST =
  "sha256:dd94fed4c18cb1990338bc8576bb89d5ac8c6689e63b6fe99a46aa17972b385f";
const PHASE43C_CONTRACT_DIGEST =
  "sha256:d9fa9a31d075a8f0637ed69af77cd006d1765540c2be4c9aeea2e8aff9a103aa";
const PHASE43C_PREVIEW_DIGEST =
  "sha256:a41eeee63fd1e1921e09353d3709ee6b5b81dc44759fa0f7bf787a9a2a87705c";
const PHASE43B_CONTRACT_DIGEST =
  "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8";
const PHASE43B_PREVIEW_DIGEST =
  "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6";
const PHASE43A_CONTRACT_DIGEST =
  "sha256:148aff92b3b932359457ad0fd88c1a5569384b0756ca5a7ff47a2fe51f7f2806";
const PHASE43A_ACCEPTANCE_DIGEST =
  "sha256:abc7271b70588e04e415e4bdbdcae43b1e8743bd194f16d28debc3e54f8a93f3";
const PHASE42V_CONTRACT_DIGEST =
  "sha256:59f268f8d02ffacbed577e44fc4b97f9142d4a37d40c3a9f2ae88a7ef0f3f7bf";
const PHASE42V_SEAL_DIGEST =
  "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94";
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
  "invocation_authorized",
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

const invocationReadinessContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  previous_phase: PREVIOUS_PHASE,
  kind: "sealed_chain_metadata_only_read_only_status_inspection_capability_invocation_readiness",
  mode: "invocation_ready_no_authorization_no_execution_no_invocation",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_handoff_phase: "Phase42V",
  source_handoff_contract_digest: PHASE42V_CONTRACT_DIGEST,
  source_handoff_seal_digest: PHASE42V_SEAL_DIGEST,
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  explicit_scope_contract_digest: PHASE43A_CONTRACT_DIGEST,
  explicit_scope_acceptance_digest: PHASE43A_ACCEPTANCE_DIGEST,
  capability_contract_phase: "Phase43B",
  capability_contract_digest: PHASE43B_CONTRACT_DIGEST,
  capability_contract_preview_digest: PHASE43B_PREVIEW_DIGEST,
  implementation_readiness_phase: "Phase43C",
  implementation_readiness_contract_digest: PHASE43C_CONTRACT_DIGEST,
  implementation_readiness_preview_digest: PHASE43C_PREVIEW_DIGEST,
  minimal_implementation_phase: PREVIOUS_PHASE,
  minimal_implementation_source_commit: PHASE43D_COMMIT,
  minimal_implementation_contract_digest: PHASE43D_CONTRACT_DIGEST,
  minimal_implementation_digest: PHASE43D_IMPLEMENTATION_DIGEST,
  minimal_implementation_result_digest: PHASE43D_RESULT_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  invocation_input_boundary: "caller_supplied_allowlisted_metadata_object_only",
  invocation_preconditions: Object.freeze([
    "minimal_implementation_present",
    "input_is_non_array_object",
    "input_keys_subset_of_metadata_allowlist",
    "forbidden_data_classes_absent",
    "no_production_store_dependency",
    "separate_invocation_authorization_required"
  ]),
  rejection_rules: Object.freeze({
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

const phase43DImplementationManifest = Object.freeze({
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  input_mode: "caller_supplied_metadata_only",
  output_mode: "allowlisted_metadata_projection_only",
  metadata_allowlist: METADATA_ALLOWLIST,
  production_store_dependency: false,
  side_effect_free: true,
  implementation_present: true,
  invocation_performed: false
});

const readinessDigest = stableHash({
  phase: CURRENT_PHASE,
  capability_id: invocationReadinessContract.capability_id,
  capability_kind: invocationReadinessContract.capability_kind,
  capability_scope: invocationReadinessContract.capability_scope,
  invocation_input_boundary: invocationReadinessContract.invocation_input_boundary,
  invocation_preconditions: invocationReadinessContract.invocation_preconditions,
  rejection_rules: invocationReadinessContract.rejection_rules,
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: false,
  invocation_performed: false
});
const contractDigest = stableHash(invocationReadinessContract);
const nextPhaseGuidance = Object.freeze({
  status: "invocation_ready_not_authorized_not_invoked",
  current_phase_authorizes_implementation: false,
  current_phase_authorizes_execution: false,
  current_phase_authorizes_invocation: false,
  current_phase_invokes_capability: false,
  invocation_authorization_requires_separate_explicit_phase: true,
  recommended_next_step:
    "Define Phase43F invocation authorization for the metadata-only read-only status inspection capability without invoking it, inspecting metadata, reading production candidate store contents, enumerating records, executing a production query, generating a status report, or granting mutation, governance, Canon, or active_engine authority."
});
const resultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43d_commit: PHASE43D_COMMIT,
  phase43d_contract_digest: PHASE43D_CONTRACT_DIGEST,
  phase43d_implementation_digest: PHASE43D_IMPLEMENTATION_DIGEST,
  phase43d_result_digest: PHASE43D_RESULT_DIGEST,
  contract_digest: contractDigest,
  readiness_digest: readinessDigest,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: false,
  invocation_performed: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  next_phase_guidance: nextPhaseGuidance
});

assert.equal(contractDigest, "sha256:51fa22efa536f4a398f444a413eb21298879476a8ab905af267d1eff4f60f0fc");
assert.equal(readinessDigest, "sha256:b74d429b385e40af0653cd98d98760b3d9504addc4bd20d35614fa3f06dd2037");
assert.equal(resultDigest, "sha256:f52d21af7daf5b95af9101cd0c6b98adc989c7a1d7b2e6237bcf57e2e4695707");
assert.equal(stableHash(phase43DImplementationManifest), PHASE43D_IMPLEMENTATION_DIGEST);
assert.equal(invocationReadinessContract.implementation_present, true);
assert.equal(invocationReadinessContract.invocation_ready, true);
assert.equal(invocationReadinessContract.full_run_all_passed_claimed, false);
assert.deepEqual(invocationReadinessContract.metadata_allowlist, METADATA_ALLOWLIST);
assert.deepEqual(invocationReadinessContract.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(invocationReadinessContract[field], false, `${field} must remain false`);
}
for (const rejectionRule of Object.values(invocationReadinessContract.rejection_rules)) {
  assert.equal(rejectionRule, true);
}
assert.equal(nextPhaseGuidance.current_phase_authorizes_invocation, false);
assert.equal(nextPhaseGuidance.current_phase_invokes_capability, false);
assert.equal(nextPhaseGuidance.invocation_authorization_requires_separate_explicit_phase, true);

const chainFiles = Object.freeze([
  [
    "tests/phase42/phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal.test.mjs",
    [PHASE42V_CONTRACT_DIGEST, "seal_digest: sealDigest", "final closure operator handoff seal digest"]
  ],
  [
    "tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs",
    [PHASE42V_CONTRACT_DIGEST, PHASE42V_SEAL_DIGEST, PHASE43A_CONTRACT_DIGEST]
  ],
  [
    "tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs",
    [PHASE43A_CONTRACT_DIGEST, PHASE43A_ACCEPTANCE_DIGEST, PHASE43B_CONTRACT_DIGEST, PHASE43B_PREVIEW_DIGEST]
  ],
  [
    "tests/phase43/phase43c-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-implementation-readiness-smoke.test.mjs",
    [PHASE43B_CONTRACT_DIGEST, PHASE43B_PREVIEW_DIGEST, PHASE43C_CONTRACT_DIGEST, PHASE43C_PREVIEW_DIGEST]
  ],
  [
    "tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs",
    [
      PHASE43C_CONTRACT_DIGEST,
      PHASE43C_PREVIEW_DIGEST,
      PHASE43D_CONTRACT_DIGEST,
      PHASE43D_RESULT_DIGEST,
      'capability_id: "inspect_sealed_chain_closure_metadata"',
      "implementation_present: true",
      "invocation_performed: false",
      "Define Phase43E invocation readiness"
    ]
  ]
]);
for (const [relativePath, markers] of chainFiles) {
  const source = readRepoFile(relativePath);
  for (const marker of markers) {
    assert.equal(source.includes(marker), true, `${relativePath} marker missing: ${marker}`);
  }
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs";
const phase43DRegistration =
  '  ["Phase 43D production candidate store promotion gate sealed chain metadata-only read-only status inspection capability minimal implementation smoke", ["tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs"]],';
const phase43ERegistration =
  '  ["Phase 43E production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation readiness smoke", ["tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assert.equal(
  runAllText.includes(`${phase43DRegistration}\n${phase43ERegistration}`),
  true,
  "Phase43E registration must be immediately after Phase43D"
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

console.log(`Phase43E metadata-only read-only status inspection capability invocation readiness contract digest: ${contractDigest}`);
console.log(`Phase43E metadata-only read-only status inspection capability invocation readiness digest: ${readinessDigest}`);
console.log(`Phase43E metadata-only read-only status inspection capability invocation readiness result digest: ${resultDigest}`);
console.log("Phase43E metadata-only read-only status inspection capability invocation readiness smoke tests passed.");
