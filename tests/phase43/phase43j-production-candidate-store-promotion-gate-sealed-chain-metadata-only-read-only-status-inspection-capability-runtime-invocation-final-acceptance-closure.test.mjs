import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSealedChainClosureMetadata } from "../../server/src/inspect-sealed-chain-closure-metadata-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43J";
const PREVIOUS_PHASE = "Phase43I";
const PHASE43I_COMMIT = "0591d95a898e3e512ac720b3c3ed322e545b3d0e";
const PHASE43I_CONTRACT_DIGEST =
  "sha256:c9b18e7287dc81b94c058ce77caf7f47e43094c3fb234a721c9535d1d28f9998";
const PHASE43I_RUNTIME_DIGEST =
  "sha256:a07881bcec16a8d497195ab2d7cb72c3cda4e0433d9f1fd97065616638875758";
const PHASE43I_INVOCATION_RESULT_DIGEST =
  "sha256:133bcb015f1454c944c49806a067532c0a6e7fe11829bb547a8d3c84deefec73";
const PHASE43H_CONTRACT_DIGEST =
  "sha256:662d26e3c8116b96151b0684fe149d484439897ee6e0c23efe6acc5a3040f9df";
const PHASE43H_AUTHORIZATION_DIGEST =
  "sha256:81889f62bc21af2054e035a615a04408fd62559401546647cf3b1d8b814b4829";
const PHASE43H_RESULT_DIGEST =
  "sha256:8e5151835ef01292c6bd3f9704becc1cb8b62e6b451ebb2b2df99dbdb6ce1ef8";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE =
  "Full run-all remains separately pending due to prior Backup export service timeout.";
const RUNTIME_PATH = "server/src/inspect-sealed-chain-closure-metadata-service.mjs";

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

const REQUIRED_IDENTITIES = Object.freeze({
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only"
});

const PROTECTED_FALSE_FIELDS = Object.freeze([
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableHash(value) {
  return "sha256:" + crypto.createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function expectError(input, message) {
  assert.throws(() => inspectSealedChainClosureMetadata(input), {
    name: "TypeError",
    message
  });
}

assert.equal(typeof inspectSealedChainClosureMetadata, "function");
assert.equal(inspectSealedChainClosureMetadata.name, "inspectSealedChainClosureMetadata");

const acceptanceInput = {
  implementation_readiness_status: "accepted",
  capability_contract_status: "accepted",
  capability_scope: REQUIRED_IDENTITIES.capability_scope,
  capability_kind: REQUIRED_IDENTITIES.capability_kind,
  capability_id: REQUIRED_IDENTITIES.capability_id,
  capability_contract_preview_digest: "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6",
  capability_contract_digest: "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8",
  capability_contract_phase: "Phase43B",
  explicit_scope_acceptance_digest: "sha256:abc7271b70588e04e415e4bdbdcae43b1e8743bd194f16d28debc3e54f8a93f3",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  explicit_scope_phase: "Phase43A",
  source_handoff_seal_digest: "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94",
  source_handoff_phase: "Phase42V",
  source_chain_closed: true,
  source_chain: "Phase42A-Phase42V",
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS
};
const inputSnapshot = structuredClone(acceptanceInput);
const acceptanceOutput = inspectSealedChainClosureMetadata(acceptanceInput);
assert.deepEqual(
  acceptanceOutput,
  Object.fromEntries(METADATA_ALLOWLIST.map((key) => [key, acceptanceInput[key]]))
);
assert.deepEqual(Object.keys(acceptanceOutput), METADATA_ALLOWLIST);
assert.equal(Object.isFrozen(acceptanceOutput), true);
assert.notEqual(acceptanceOutput, acceptanceInput);
assert.deepEqual(acceptanceInput, inputSnapshot);

expectError({ ...REQUIRED_IDENTITIES, unknown_payload: "blocked" }, "metadata_key_not_allowed:unknown_payload");
expectError({ ...REQUIRED_IDENTITIES, capability_contract_status: { body: "blocked" } }, "metadata_value_type_invalid:capability_contract_status");
expectError({ ...REQUIRED_IDENTITIES, capability_contract_status: ["blocked"] }, "metadata_value_type_invalid:capability_contract_status");
expectError({ ...REQUIRED_IDENTITIES, capability_id: "other_capability" }, "metadata_identity_mismatch:capability_id");
expectError({ ...REQUIRED_IDENTITIES, capability_kind: "write" }, "metadata_identity_mismatch:capability_kind");
expectError({ ...REQUIRED_IDENTITIES, capability_scope: "production_store" }, "metadata_identity_mismatch:capability_scope");
for (const key of [
  "production_store_access",
  "production_candidate_payload",
  "production_candidate_query_result",
  "candidate_store_record_body",
  "candidate_store_connection_details",
  "secret_or_credential_material",
  "execute",
  "write"
]) {
  expectError({ ...REQUIRED_IDENTITIES, [key]: "blocked" }, `metadata_key_not_allowed:${key}`);
}
expectError(null, "metadata_plain_object_required");
expectError([], "metadata_plain_object_required");
expectError(new Date(), "metadata_plain_object_required");

const runtimeSource = readRepoFile(RUNTIME_PATH);
for (const pattern of [
  /^\s*import\s/m,
  /\brequire\s*\(/,
  /\bprocess\s*\./,
  /\bfetch\s*\(/,
  /\b(child_process|node:fs|node:net|node:http|node:https|node:dgram|node:dns|node:tls)\b/,
  /\b(readFile|writeFile|appendFile|rename|unlink|rm|exec|spawn|fork|connect|query)\s*\(/,
  /\b(createApprovalRequest|createPendingEngineCandidate|createAuditReceipt|createBackupSnapshot)\s*\(/,
  /\b(openProductionGate|consumeGuardToken|updateCanon|updateActiveEngine)\s*\(/,
  /\b(executeAdoption|executeSettlement|executeRollbackRestore)\s*\(/
]) {
  assert.equal(pattern.test(runtimeSource), false, `Forbidden runtime dependency or call: ${pattern}`);
}

const phase43ISource = readRepoFile(
  "tests/phase43/phase43i-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-runtime-invocation-execution-smoke.test.mjs"
);
for (const marker of [
  PHASE43I_CONTRACT_DIGEST,
  PHASE43I_RUNTIME_DIGEST,
  PHASE43I_INVOCATION_RESULT_DIGEST,
  PHASE43H_CONTRACT_DIGEST,
  PHASE43H_AUTHORIZATION_DIGEST,
  PHASE43H_RESULT_DIGEST,
  "invocation_performed: true",
  "metadata_inspection_performed: true",
  "Phase43J final acceptance and closure"
]) {
  assert.equal(phase43ISource.includes(marker), true, `Phase43I marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const registrations = Object.freeze([
  ["A", "Phase 43A production candidate store promotion gate sealed chain explicit scope acceptance smoke", "tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs"],
  ["B", "Phase 43B production candidate store promotion gate sealed chain read-only status inspection capability contract smoke", "tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs"],
  ["C", "Phase 43C production candidate store promotion gate sealed chain metadata-only read-only status inspection capability implementation readiness smoke", "tests/phase43/phase43c-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-implementation-readiness-smoke.test.mjs"],
  ["D", "Phase 43D production candidate store promotion gate sealed chain metadata-only read-only status inspection capability minimal implementation smoke", "tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs"],
  ["E", "Phase 43E production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation readiness smoke", "tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs"],
  ["F", "Phase 43F production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation authorization smoke", "tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs"],
  ["G", "Phase 43G production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution readiness smoke", "tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs"],
  ["H", "Phase 43H production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution authorization smoke", "tests/phase43/phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke.test.mjs"],
  ["I", "Phase 43I production candidate store promotion gate sealed chain metadata-only read-only status inspection capability runtime invocation execution smoke", "tests/phase43/phase43i-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-runtime-invocation-execution-smoke.test.mjs"],
  ["J", "Phase 43J production candidate store promotion gate sealed chain metadata-only read-only status inspection capability runtime invocation final acceptance closure", "tests/phase43/phase43j-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-runtime-invocation-final-acceptance-closure.test.mjs"]
]);
let previousIndex = -1;
for (const [letter, name, testPath] of registrations) {
  const registration = `  ["${name}", ["${testPath}"]],`;
  assert.equal(countOccurrences(runAllText, registration), 1, `Phase43${letter} registration must appear once`);
  const currentIndex = runAllText.indexOf(registration);
  assert.equal(currentIndex > previousIndex, true, `Phase43${letter} registration order invalid`);
  previousIndex = currentIndex;
}
assert.equal(/Phase 43K|phase43k/i.test(runAllText), false);
const phase43KTests = fs.readdirSync(path.join(repoRoot, "tests", "phase43"))
  .filter((name) => /^phase43k/i.test(name));
assert.deepEqual(phase43KTests, []);

const acceptanceState = Object.freeze({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43i_source_commit: PHASE43I_COMMIT,
  phase43i_contract_digest: PHASE43I_CONTRACT_DIGEST,
  phase43i_runtime_digest: PHASE43I_RUNTIME_DIGEST,
  phase43i_invocation_result_digest: PHASE43I_INVOCATION_RESULT_DIGEST,
  phase43h_contract_digest: PHASE43H_CONTRACT_DIGEST,
  phase43h_authorization_digest: PHASE43H_AUTHORIZATION_DIGEST,
  phase43h_result_digest: PHASE43H_RESULT_DIGEST,
  runtime_implementation_accepted: true,
  runtime_invocation_accepted: true,
  negative_boundaries_accepted: true,
  phase43_closed: true,
  phase43_final_acceptance_passed: true,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  next_phase_required: false,
  phase43k_authorized: false,
  phase43k_planned: false,
  ...Object.fromEntries(PROTECTED_FALSE_FIELDS.map((field) => [field, false]))
});
for (const field of [
  "runtime_implementation_accepted",
  "runtime_invocation_accepted",
  "negative_boundaries_accepted",
  "phase43_closed",
  "phase43_final_acceptance_passed"
]) {
  assert.equal(acceptanceState[field], true, `${field} must be true`);
}
for (const field of ["full_run_all_passed_claimed", "next_phase_required", "phase43k_authorized", "phase43k_planned", ...PROTECTED_FALSE_FIELDS]) {
  assert.equal(acceptanceState[field], false, `${field} must be false`);
}

const nextGuidance = Object.freeze({
  status: "Phase43 closed",
  next_phase_required: false,
  phase43k_required: false,
  guidance:
    "Phase43 is closed. Phase43K is not needed. Only a new actual usage requirement may create a new independent scope; Phase43 must not be extended automatically."
});
const finalAcceptanceDigest = stableHash({
  acceptance_state: acceptanceState,
  canonical_projection: acceptanceOutput,
  canonical_field_order: Object.keys(acceptanceOutput),
  output_frozen: Object.isFrozen(acceptanceOutput),
  input_unchanged: true,
  representative_negative_boundaries_passed: true,
  phase43_registration_order: registrations.map(([letter]) => `Phase43${letter}`)
});
const closureDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  final_acceptance_digest: finalAcceptanceDigest,
  phase43_closed: true,
  next_phase_required: false,
  phase43k_authorized: false,
  phase43k_planned: false,
  next_guidance: nextGuidance,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS
});

console.log(`Phase43J metadata-only read-only status inspection runtime invocation final acceptance digest: ${finalAcceptanceDigest}`);
console.log(`Phase43J metadata-only read-only status inspection runtime invocation closure digest: ${closureDigest}`);
assert.equal(finalAcceptanceDigest, "sha256:125d969053f1cd4448791b9091669d58df7ec762dbeee95f5fef333790ca1881");
assert.equal(closureDigest, "sha256:5789fcf46bad5e0c94c1c86519e4e1dced628954f6891307f9f2c388c01ce3c6");
console.log("Phase43J metadata-only read-only status inspection runtime invocation final acceptance closure tests passed.");
