import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43D";
const CURRENT_PHASE_SLUG =
  "phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke";
const PREVIOUS_PHASE = "Phase43C";
const PHASE43C_CONTRACT_DIGEST =
  "sha256:d9fa9a31d075a8f0637ed69af77cd006d1765540c2be4c9aeea2e8aff9a103aa";
const PHASE43C_PREVIEW_DIGEST =
  "sha256:a41eeee63fd1e1921e09353d3709ee6b5b81dc44759fa0f7bf787a9a2a87705c";
const PHASE43B_CONTRACT_DIGEST =
  "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8";
const PHASE43B_PREVIEW_DIGEST =
  "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6";
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

const BASELINE_STATE = Object.freeze(Object.fromEntries(
  PROTECTED_FALSE_FIELDS.map((field) => [field, false])
));

const minimalImplementationContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  previous_phase: PREVIOUS_PHASE,
  kind: "sealed_chain_metadata_only_read_only_status_inspection_capability_minimal_implementation",
  mode: "minimal_implementation_present_no_authorization_no_execution_no_invocation",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_handoff_phase: "Phase42V",
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  capability_contract_phase: "Phase43B",
  phase43b_contract_digest: PHASE43B_CONTRACT_DIGEST,
  phase43b_preview_digest: PHASE43B_PREVIEW_DIGEST,
  implementation_readiness_phase: PREVIOUS_PHASE,
  phase43c_contract_digest: PHASE43C_CONTRACT_DIGEST,
  phase43c_preview_digest: PHASE43C_PREVIEW_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_allowed: false,
  status_report_generation_allowed: false,
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
  ...BASELINE_STATE
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

// Complete minimal implementation: a pure projector over caller-supplied metadata.
// Phase43D verifies its presence but deliberately never invokes it.
const inspectSealedChainClosureMetadataImplementation = Object.freeze({
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  input_mode: "caller_supplied_metadata_only",
  output_mode: "allowlisted_metadata_projection_only",
  metadata_allowlist: METADATA_ALLOWLIST,
  production_store_dependency: false,
  side_effect_free: true,
  project(metadata) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new TypeError("metadata_object_required");
    }
    return Object.freeze(Object.fromEntries(
      METADATA_ALLOWLIST
        .filter((field) => Object.hasOwn(metadata, field))
        .map((field) => [field, metadata[field]])
    ));
  }
});

const implementationManifest = Object.freeze({
  capability_id: inspectSealedChainClosureMetadataImplementation.capability_id,
  capability_kind: inspectSealedChainClosureMetadataImplementation.capability_kind,
  capability_scope: inspectSealedChainClosureMetadataImplementation.capability_scope,
  input_mode: inspectSealedChainClosureMetadataImplementation.input_mode,
  output_mode: inspectSealedChainClosureMetadataImplementation.output_mode,
  metadata_allowlist: inspectSealedChainClosureMetadataImplementation.metadata_allowlist,
  production_store_dependency:
    inspectSealedChainClosureMetadataImplementation.production_store_dependency,
  side_effect_free: inspectSealedChainClosureMetadataImplementation.side_effect_free,
  implementation_present: true,
  invocation_performed: false
});

const contractDigest = stableHash(minimalImplementationContract);
const implementationDigest = stableHash(implementationManifest);
const nextPhaseGuidance = Object.freeze({
  status: "minimal_implementation_present_not_authorized_not_invoked",
  current_phase_authorizes_implementation: false,
  current_phase_authorizes_execution: false,
  current_phase_invokes_capability: false,
  invocation_readiness_requires_separate_explicit_phase: true,
  recommended_next_step:
    "Define Phase43E invocation readiness for the metadata-only read-only status inspection capability without invoking it, reading production candidate store contents, enumerating records, executing a production query, generating a status report, or granting new authority."
});

const resultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43c_contract_digest: PHASE43C_CONTRACT_DIGEST,
  phase43c_preview_digest: PHASE43C_PREVIEW_DIGEST,
  phase43b_contract_digest: PHASE43B_CONTRACT_DIGEST,
  phase43b_preview_digest: PHASE43B_PREVIEW_DIGEST,
  contract_digest: contractDigest,
  implementation_digest: implementationDigest,
  implementation_present: true,
  implementation_authorized: false,
  execution_authorized: false,
  invocation_performed: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  next_phase_guidance: nextPhaseGuidance
});

assert.equal(contractDigest, "sha256:e71c4919fad2c7f667ee22894f798219cc781f4ec55684280376e88eea27f748");
assert.equal(resultDigest, "sha256:dd94fed4c18cb1990338bc8576bb89d5ac8c6689e63b6fe99a46aa17972b385f");

assert.equal(nextPhaseGuidance.current_phase_invokes_capability, false);
assert.equal(nextPhaseGuidance.invocation_readiness_requires_separate_explicit_phase, true);
assert.equal(minimalImplementationContract.implementation_present, true);
assert.equal(minimalImplementationContract.no_production_store_dependency, true);
assert.equal(minimalImplementationContract.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
assert.equal(minimalImplementationContract.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
assert.equal(minimalImplementationContract.full_run_all_passed_claimed, false);
assert.deepEqual(minimalImplementationContract.metadata_allowlist, METADATA_ALLOWLIST);
assert.deepEqual(minimalImplementationContract.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(minimalImplementationContract[field], false, `${field} must remain false`);
}

assert.equal(implementationManifest.implementation_present, true);
assert.equal(implementationManifest.invocation_performed, false);
assert.equal(implementationManifest.production_store_dependency, false);
assert.equal(implementationManifest.side_effect_free, true);
assert.deepEqual(implementationManifest.metadata_allowlist, METADATA_ALLOWLIST);
assert.equal(typeof inspectSealedChainClosureMetadataImplementation.project, "function");

const phase43CPath =
  "tests/phase43/phase43c-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-implementation-readiness-smoke.test.mjs";
const phase43CSource = readRepoFile(phase43CPath);
for (const marker of [
  PHASE43C_CONTRACT_DIGEST,
  PHASE43C_PREVIEW_DIGEST,
  PHASE43B_CONTRACT_DIGEST,
  PHASE43B_PREVIEW_DIGEST,
  'capability_id: "inspect_sealed_chain_closure_metadata"',
  'capability_kind: "read_only_status_inspection"',
  'capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only"',
  "implementation_ready: true",
  "implementation_present: false",
  "minimal_implementation_requires_separate_explicit_phase: true",
  "Define Phase43D minimal implementation for the metadata-only read-only status inspection capability.",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(phase43CSource.includes(marker), true, `Phase43C marker missing: ${marker}`);
}

const phase43BSource = readRepoFile(
  "tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs"
);
for (const marker of [
  PHASE43B_CONTRACT_DIGEST,
  PHASE43B_PREVIEW_DIGEST,
  'capability_id: "inspect_sealed_chain_closure_metadata"',
  "capability_implementation_present: false",
  "capability_invocation_performed: false",
  "production_candidate_store_contents_read: false",
  "production_candidate_records_enumerated: false"
]) {
  assert.equal(phase43BSource.includes(marker), true, `Phase43B marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs";
const phase43CRegistration =
  '  ["Phase 43C production candidate store promotion gate sealed chain metadata-only read-only status inspection capability implementation readiness smoke", ["tests/phase43/phase43c-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-implementation-readiness-smoke.test.mjs"]],';
const phase43DRegistration =
  '  ["Phase 43D production candidate store promotion gate sealed chain metadata-only read-only status inspection capability minimal implementation smoke", ["tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assert.equal(
  runAllText.includes(`${phase43CRegistration}\n${phase43DRegistration}`),
  true,
  "Phase43D registration must be immediately after Phase43C"
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

console.log(`Phase43D metadata-only read-only status inspection capability minimal implementation contract digest: ${contractDigest}`);
console.log(`Phase43D metadata-only read-only status inspection capability minimal implementation digest: ${implementationDigest}`);
console.log(`Phase43D metadata-only read-only status inspection capability minimal implementation result digest: ${resultDigest}`);
console.log("Phase43D metadata-only read-only status inspection capability minimal implementation smoke tests passed.");
