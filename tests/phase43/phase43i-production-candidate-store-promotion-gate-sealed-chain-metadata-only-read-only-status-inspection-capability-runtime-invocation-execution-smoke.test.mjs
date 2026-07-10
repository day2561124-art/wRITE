import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSealedChainClosureMetadata } from "../../server/src/inspect-sealed-chain-closure-metadata-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const CURRENT_PHASE = "Phase43I";
const PREVIOUS_PHASE = "Phase43H";
const PHASE43H_COMMIT = "7845412277c1bde5e9c88353c3d6a17bf42a478b";
const PHASE43H_CONTRACT_DIGEST =
  "sha256:662d26e3c8116b96151b0684fe149d484439897ee6e0c23efe6acc5a3040f9df";
const PHASE43H_AUTHORIZATION_DIGEST =
  "sha256:81889f62bc21af2054e035a615a04408fd62559401546647cf3b1d8b814b4829";
const PHASE43H_RESULT_DIGEST =
  "sha256:8e5151835ef01292c6bd3f9704becc1cb8b62e6b451ebb2b2df99dbdb6ce1ef8";
const PHASE43G_CONTRACT_DIGEST =
  "sha256:7f0db2abb42e72b8e118779ac0031a66b5e3c26577b1bddfd53c4a6b0d9218ef";
const PHASE43G_READINESS_DIGEST =
  "sha256:1a7326df065a06338ea51a00dbbc211a5e2330ed1eae51f050d015d3cf44e0bb";
const PHASE43G_RESULT_DIGEST =
  "sha256:9ed3066968f3f91cda6cb6cb8de2e44bffb24fb111e47685a75fe991272ca6ea";
const PHASE43F_CONTRACT_DIGEST =
  "sha256:407be8462f2c8cd14459c242466c359a283320af3109725a330692e63a3c048c";
const PHASE43F_AUTHORIZATION_DIGEST =
  "sha256:fdd95088ef78c57fce785b4e3e7c8788d0c8f353e420ed23fc1be75f9f7fa223";
const PHASE43F_RESULT_DIGEST =
  "sha256:d457c7aaca7d65fedf992e50703e65025efb25a0ea141b4138f47e433df4ff9f";
const PHASE43E_CONTRACT_DIGEST =
  "sha256:51fa22efa536f4a398f444a413eb21298879476a8ab905af267d1eff4f60f0fc";
const PHASE43E_READINESS_DIGEST =
  "sha256:b74d429b385e40af0653cd98d98760b3d9504addc4bd20d35614fa3f06dd2037";
const PHASE43E_RESULT_DIGEST =
  "sha256:f52d21af7daf5b95af9101cd0c6b98adc989c7a1d7b2e6237bcf57e2e4695707";
const PHASE43D_CONTRACT_DIGEST =
  "sha256:e71c4919fad2c7f667ee22894f798219cc781f4ec55684280376e88eea27f748";
const PHASE43D_IMPLEMENTATION_DIGEST =
  "sha256:4df652edf9610e35d437077ec36ece0bafdbc3a96603e7df30238b5d6d057f2c";
const PHASE43D_RESULT_DIGEST =
  "sha256:dd94fed4c18cb1990338bc8576bb89d5ac8c6689e63b6fe99a46aa17972b385f";
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

function sourceHash(source) {
  return "sha256:" + crypto.createHash("sha256")
    .update(source.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8")
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

const runtimeSource = readRepoFile(RUNTIME_PATH);
const runtimeManifest = Object.freeze({
  capability_id: REQUIRED_IDENTITIES.capability_id,
  capability_kind: REQUIRED_IDENTITIES.capability_kind,
  capability_scope: REQUIRED_IDENTITIES.capability_scope,
  module_path: RUNTIME_PATH,
  export_name: "inspectSealedChainClosureMetadata",
  input_mode: "caller_supplied_allowlisted_metadata_only",
  output_mode: "canonical_frozen_projection_only",
  metadata_allowlist: METADATA_ALLOWLIST,
  production_store_dependency: false,
  side_effect_free: true,
  source_sha256: sourceHash(runtimeSource)
});

const executionContract = Object.freeze({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43h_source_commit: PHASE43H_COMMIT,
  phase43h_contract_digest: PHASE43H_CONTRACT_DIGEST,
  phase43h_authorization_digest: PHASE43H_AUTHORIZATION_DIGEST,
  phase43h_result_digest: PHASE43H_RESULT_DIGEST,
  capability_id: REQUIRED_IDENTITIES.capability_id,
  capability_kind: REQUIRED_IDENTITIES.capability_kind,
  capability_scope: REQUIRED_IDENTITIES.capability_scope,
  metadata_allowlist: METADATA_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  implementation_present: true,
  invocation_ready: true,
  invocation_authorized: true,
  invocation_execution_ready: true,
  execution_authorized: true,
  invocation_performed: true,
  metadata_inspection_performed: true,
  no_production_store_dependency: true,
  no_mutation_boundary: true,
  no_persistence_boundary: true,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  ...Object.fromEntries(PROTECTED_FALSE_FIELDS.map((field) => [field, false]))
});

assert.equal(typeof inspectSealedChainClosureMetadata, "function");
assert.equal(inspectSealedChainClosureMetadata.name, "inspectSealedChainClosureMetadata");

const fixture = {
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  capability_scope: REQUIRED_IDENTITIES.capability_scope,
  capability_id: REQUIRED_IDENTITIES.capability_id,
  source_chain_closed: true,
  source_chain: "Phase42A-Phase42V",
  source_handoff_phase: "Phase42V",
  source_handoff_seal_digest: "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94",
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  explicit_scope_acceptance_digest: "sha256:abc7271b70588e04e415e4bdbdcae43b1e8743bd194f16d28debc3e54f8a93f3",
  capability_contract_phase: "Phase43B",
  capability_contract_digest: "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8",
  capability_contract_preview_digest: "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6",
  capability_kind: REQUIRED_IDENTITIES.capability_kind,
  capability_contract_status: "accepted",
  implementation_readiness_status: "accepted"
};
const fixtureSnapshot = structuredClone(fixture);
const result = inspectSealedChainClosureMetadata(fixture);
const repeatedResult = inspectSealedChainClosureMetadata(fixture);
assert.notEqual(result, fixture);
assert.deepEqual(result, Object.fromEntries(METADATA_ALLOWLIST.map((key) => [key, fixture[key]])));
assert.deepEqual(Object.keys(result), METADATA_ALLOWLIST);
assert.equal(Object.isFrozen(result), true);
assert.deepEqual(fixture, fixtureSnapshot);
assert.deepEqual(repeatedResult, result);
assert.notEqual(repeatedResult, result);

const identityOnly = { ...REQUIRED_IDENTITIES };
assert.deepEqual(inspectSealedChainClosureMetadata(identityOnly), identityOnly);
const nullPrototypeInput = Object.assign(Object.create(null), REQUIRED_IDENTITIES);
assert.deepEqual(inspectSealedChainClosureMetadata(nullPrototypeInput), identityOnly);

for (const input of [null, undefined, true, 1, "metadata", 1n, Symbol("metadata"), () => {}]) {
  expectError(input, "metadata_plain_object_required");
}
expectError([], "metadata_plain_object_required");
expectError(new Date(), "metadata_plain_object_required");
class Metadata {}
expectError(Object.assign(new Metadata(), REQUIRED_IDENTITIES), "metadata_plain_object_required");

for (const key of Object.keys(REQUIRED_IDENTITIES)) {
  const missing = { ...REQUIRED_IDENTITIES };
  delete missing[key];
  expectError(missing, `metadata_identity_required:${key}`);
  expectError({ ...REQUIRED_IDENTITIES, [key]: "mismatch" }, `metadata_identity_mismatch:${key}`);
}

expectError({ ...REQUIRED_IDENTITIES, unexpected: "value" }, "metadata_key_not_allowed:unexpected");
for (const key of ["production_store_access", "production_query", "record_body", "connection_details", "secret", "credential"]) {
  expectError({ ...REQUIRED_IDENTITIES, [key]: "blocked" }, `metadata_key_not_allowed:${key}`);
}
for (const key of ["prototype", "constructor"]) {
  expectError({ ...REQUIRED_IDENTITIES, [key]: "blocked" }, `metadata_key_not_allowed:${key}`);
}
const protoPollutionInput = { ...REQUIRED_IDENTITIES };
Object.defineProperty(protoPollutionInput, "__proto__", { value: "blocked", enumerable: true });
expectError(protoPollutionInput, "metadata_key_not_allowed:__proto__");
const symbolKeyInput = { ...REQUIRED_IDENTITIES, [Symbol("payload")]: "blocked" };
expectError(symbolKeyInput, "metadata_key_not_allowed:Symbol(payload)");
for (const key of FORBIDDEN_DATA_CLASSES) {
  expectError({ ...REQUIRED_IDENTITIES, [key]: "blocked" }, `metadata_key_not_allowed:${key}`);
}

for (const value of [{ payload: "nested" }, ["nested"], () => {}, Symbol("nested"), 1n]) {
  expectError(
    { ...REQUIRED_IDENTITIES, capability_contract_status: value },
    "metadata_value_type_invalid:capability_contract_status"
  );
}
expectError({ ...REQUIRED_IDENTITIES, source_chain_closed: "true" }, "metadata_value_type_invalid:source_chain_closed");
expectError({ ...REQUIRED_IDENTITIES, source_chain: false }, "metadata_value_type_invalid:source_chain");
const accessorInput = { ...REQUIRED_IDENTITIES };
Object.defineProperty(accessorInput, "source_chain", { get() { return "forbidden"; }, enumerable: true });
expectError(accessorInput, "metadata_value_type_invalid:source_chain");

for (const pattern of [
  /^\s*import\s/m,
  /\brequire\s*\(/,
  /\bprocess\s*\./,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\b(child_process|node:fs|node:net|node:http|node:https|node:dgram|node:dns|node:tls)\b/,
  /\b(readFile|writeFile|appendFile|rename|unlink|rm|exec|spawn|fork|connect|query)\s*\(/,
  /\b(createApprovalRequest|createPendingEngineCandidate|openProductionGate|consumeGuardToken)\s*\(/,
  /\b(updateCanon|updateActiveEngine|executeAdoption|executeSettlement|executeRollbackRestore)\s*\(/
]) {
  assert.equal(pattern.test(runtimeSource), false, `Forbidden runtime dependency or call: ${pattern}`);
}
for (const field of PROTECTED_FALSE_FIELDS) {
  assert.equal(executionContract[field], false, `${field} must remain false`);
}
for (const field of [
  "implementation_present",
  "invocation_ready",
  "invocation_authorized",
  "invocation_execution_ready",
  "execution_authorized",
  "invocation_performed",
  "metadata_inspection_performed"
]) {
  assert.equal(executionContract[field], true, `${field} must be true`);
}

const chainFiles = Object.freeze([
  ["tests/phase43/phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke.test.mjs", [PHASE43H_CONTRACT_DIGEST, PHASE43H_AUTHORIZATION_DIGEST, PHASE43H_RESULT_DIGEST, "execution_authorized: true"]],
  ["tests/phase43/phase43g-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-readiness-smoke.test.mjs", [PHASE43G_CONTRACT_DIGEST, PHASE43G_READINESS_DIGEST, PHASE43G_RESULT_DIGEST]],
  ["tests/phase43/phase43f-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-authorization-smoke.test.mjs", [PHASE43F_CONTRACT_DIGEST, PHASE43F_AUTHORIZATION_DIGEST, PHASE43F_RESULT_DIGEST]],
  ["tests/phase43/phase43e-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-readiness-smoke.test.mjs", [PHASE43E_CONTRACT_DIGEST, PHASE43E_READINESS_DIGEST, PHASE43E_RESULT_DIGEST, PHASE43D_IMPLEMENTATION_DIGEST]],
  ["tests/phase43/phase43d-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-minimal-implementation-smoke.test.mjs", [PHASE43D_CONTRACT_DIGEST, PHASE43D_RESULT_DIGEST]]
]);
for (const [relativePath, markers] of chainFiles) {
  const source = readRepoFile(relativePath);
  for (const marker of markers) assert.equal(source.includes(marker), true, `${relativePath} marker missing: ${marker}`);
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43i-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-runtime-invocation-execution-smoke.test.mjs";
const phase43HRegistration =
  '  ["Phase 43H production candidate store promotion gate sealed chain metadata-only read-only status inspection capability invocation execution authorization smoke", ["tests/phase43/phase43h-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-invocation-execution-authorization-smoke.test.mjs"]],';
const phase43IRegistration =
  '  ["Phase 43I production candidate store promotion gate sealed chain metadata-only read-only status inspection capability runtime invocation execution smoke", ["tests/phase43/phase43i-production-candidate-store-promotion-gate-sealed-chain-metadata-only-read-only-status-inspection-capability-runtime-invocation-execution-smoke.test.mjs"]],';
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assert.equal(countOccurrences(runAllText, phase43IRegistration), 1);
assert.equal(runAllText.includes(`${phase43HRegistration}\n${phase43IRegistration}`), true);

const nextPhaseGuidance = Object.freeze({
  status: "runtime_invocation_execution_completed",
  recommended_next_step:
    "Define Phase43J final acceptance and closure for the same metadata-only read-only status inspection runtime invocation without adding another implementation or extending Phase43 beyond closure."
});
const contractDigest = stableHash(executionContract);
const runtimeDigest = stableHash(runtimeManifest);
const invocationResultDigest = stableHash({
  phase: CURRENT_PHASE,
  previous_phase: PREVIOUS_PHASE,
  phase43h_commit: PHASE43H_COMMIT,
  contract_digest: contractDigest,
  runtime_digest: runtimeDigest,
  invocation_output: result,
  invocation_performed: true,
  metadata_inspection_performed: true,
  protected_false_fields: Object.fromEntries(PROTECTED_FALSE_FIELDS.map((field) => [field, false])),
  next_phase_guidance: nextPhaseGuidance
});

console.log(`Phase43I metadata-only read-only status inspection capability runtime invocation execution contract digest: ${contractDigest}`);
console.log(`Phase43I metadata-only read-only status inspection capability runtime implementation digest: ${runtimeDigest}`);
console.log(`Phase43I metadata-only read-only status inspection capability invocation result digest: ${invocationResultDigest}`);
assert.equal(contractDigest, "sha256:c9b18e7287dc81b94c058ce77caf7f47e43094c3fb234a721c9535d1d28f9998");
assert.equal(runtimeDigest, "sha256:a07881bcec16a8d497195ab2d7cb72c3cda4e0433d9f1fd97065616638875758");
assert.equal(invocationResultDigest, "sha256:133bcb015f1454c944c49806a067532c0a6e7fe11829bb547a8d3c84deefec73");
console.log("Phase43I metadata-only read-only status inspection capability runtime invocation execution smoke tests passed.");
