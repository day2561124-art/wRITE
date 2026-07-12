import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertImmediateRegistrationAdjacency } from "../helpers/registration-adjacency-assertion.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43F";
const CURRENT_PHASE_SLUG =
  "phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke";
const PREVIOUS_PHASE = "Phase43E";
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

const invocationAuthorizationContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  previous_phase: PREVIOUS_PHASE,
  kind: "sealed_chain_metadata_only_read_only_status_inspection_capability_invocation_authorization",
  mode: "invocation_authorized_no_execution_no_invocation_no_inspection",
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
  invocation_readiness_phase: PREVIOUS_PHASE,
  invocation_readiness_source_commit: PHASE43E_COMMIT,
  invocation_readiness_contract_digest: PHASE43E_CONTRACT_DIGEST,
  invocation_readiness_digest: PHASE43E_READINESS_DIGEST,
  invocation_readiness_result_digest: PHASE43E_RESULT_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  authorization_scope: "single_capability_allowlisted_caller_supplied_metadata_only",
  authorization_conditions: Object.freeze([
    "phase43e_invocation_readiness_verified",
    "capability_identity_exact_match_required",
    "caller_supplied_metadata_object_required",
    "input_keys_subset_of_metadata_allowlist_required",
    "forbidden_data_classes_absent_required",
    "production_store_access_forbidden",
    "separate_execution_readiness_phase_required"
  ]),
  authorization_constraints: Object.freeze({
    non_transferable: true,
    no_authority_inheritance: true,
    no_production_store_access: true,
    no_record_enumeration: true,
    no_production_query: true,
    no_status_report_generation: true,
    no_mutation: true,
    no_persistence: true,
    no_governance_expansion: true
  }),
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  authorization_persisted: false,
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

const authorizationDigest = stableHash({
  phase: CURRENT_PHASE,
  capability_id: invocationAuthorizationContract.capability_id,
  capability_kind: invocationAuthorizationContract.capability_kind,
  capability_scope: invocationAuthorizationContract.capability_scope,
  authorization_scope: invocationAuthorizationContract.authorization_scope,
  authorization_conditions: invocationAuthorizationContract.authorization_conditions,
  authorization_constraints: invocationAuthorizationContract.authorization_constraints,
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  execution_authorized: false,
  invocation_performed: false
});
const contractDigest = stableHash(invocationAuthorizationContract);
const nextPhaseGuidance = Object.freeze({
  status: "invocation_authorized_not_execution_ready_not_invoked",
  current_phase_authorizes_invocation: true,
  current_phase_authorizes_execution: false,
  current_phase_invokes_capability: false,
  current_phase_inspects_metadata: false,
  invocation_execution_readiness_requires_separate_explicit_phase: true,
  recommended_next_step:
    "Define Phase43G invocation execution readiness for the authorized metadata-only read-only status inspection capability without invoking it, inspecting metadata, reading production candidate store contents, enumerating records, executing a production query, generating a status report, or granting mutation, governance, Canon, or active_engine authority."
});
const resultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43e_commit: PHASE43E_COMMIT,
  phase43e_contract_digest: PHASE43E_CONTRACT_DIGEST,
  phase43e_readiness_digest: PHASE43E_READINESS_DIGEST,
  phase43e_result_digest: PHASE43E_RESULT_DIGEST,
  contract_digest: contractDigest,
  authorization_digest: authorizationDigest,
  invocation_authorized: true,
  execution_authorized: false,
  invocation_performed: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  next_phase_guidance: nextPhaseGuidance
});

assert.equal(contractDigest, "sha256:407be8462f2c8cd14459c242466c359a283320af3109725a330692e63a3c048c");
assert.equal(authorizationDigest, "sha256:fdd95088ef78c57fce785b4e3e7c8788d0c8f353e420ed23fc1be75f9f7fa223");
assert.equal(resultDigest, "sha256:d457c7aaca7d65fedf992e50703e65025efb25a0ea141b4138f47e433df4ff9f");
assert.equal(invocationAuthorizationContract.implementation_present, true);
assert.equal(invocationAuthorizationContract.invocation_ready, true);
assert.equal(invocationAuthorizationContract.invocation_authorized, true);
assert.equal(invocationAuthorizationContract.authorization_persisted, false);
assert.equal(invocationAuthorizationContract.full_run_all_passed_claimed, false);
assert.deepEqual(invocationAuthorizationContract.metadata_allowlist, METADATA_ALLOWLIST);
assert.deepEqual(invocationAuthorizationContract.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(invocationAuthorizationContract[field], false, `${field} must remain false`);
}
for (const constraint of Object.values(invocationAuthorizationContract.authorization_constraints)) {
  assert.equal(constraint, true);
}
assert.equal(nextPhaseGuidance.current_phase_authorizes_invocation, true);
assert.equal(nextPhaseGuidance.current_phase_authorizes_execution, false);
assert.equal(nextPhaseGuidance.current_phase_invokes_capability, false);
assert.equal(nextPhaseGuidance.invocation_execution_readiness_requires_separate_explicit_phase, true);

const phase43ESource = readRepoFile(
  "tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs"
);
for (const marker of [
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
  "invocation_authorized: false",
  "Define Phase43F invocation authorization",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(phase43ESource.includes(marker), true, `Phase43E marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs";
const phase43ERegistration =
  '  ["Phase 43E production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation readiness smoke", ["tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs"]],';
const phase43FRegistration =
  '  ["Phase 43F production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation authorization smoke", ["tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assertImmediateRegistrationAdjacency({
  sourceText: runAllText,
  previousRegistration: phase43ERegistration,
  currentRegistration: phase43FRegistration,
  message: "Phase43F registration must be immediately after Phase43E",
});

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

console.log(`Phase43F metadata-only read-only status inspection capability invocation authorization contract digest: ${contractDigest}`);
console.log(`Phase43F metadata-only read-only status inspection capability invocation authorization digest: ${authorizationDigest}`);
console.log(`Phase43F metadata-only read-only status inspection capability invocation authorization result digest: ${resultDigest}`);
console.log("Phase43F metadata-only read-only status inspection capability invocation authorization smoke tests passed.");
