import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const CURRENT_PHASE = "Phase43A";
const CURRENT_PHASE_SLUG =
  "phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke";
const PREVIOUS_PHASE = "Phase42V";
const PREVIOUS_PHASE_SLUG =
  "phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal";
const PHASE42V_CONTRACT_DIGEST =
  "sha256:59f268f8d02ffacbed577e44fc4b97f9142d4a37d40c3a9f2ae88a7ef0f3f7bf";
const PHASE42V_SEAL_DIGEST =
  "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94";
const PHASE42U_DIGEST =
  "sha256:6656d8f2ca2e9f5359871ac0e53fa2904864bd413f8a97e1dc72258e47adb036";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE =
  "Full run-all remains separately pending due to prior Backup export service timeout.";

const MUTATION_FALSE_FIELDS = Object.freeze([
  "approval_request_created",
  "pending_engine_candidate_created",
  "production_candidate_store_mutated",
  "production_candidate_store_write_executed",
  "production_candidate_store_promotion_executed",
  "production_promotion_gate_opened",
  "guard_token_consumed",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "adoption_executed",
  "settlement_executed",
  "canon_updated",
  "active_engine_updated",
  "phase42_chain_reopened",
  "source_authority_inherited",
  "authority_transferred",
  "scope_execution_authorized",
  "acceptance_preview_persisted",
  "scope_contract_persisted",
  "full_run_all_passed_claimed"
]);

const BLOCKED_ACTIONS = Object.freeze([
  "reopen_phase42_chain",
  "inherit_phase42_authority",
  "transfer_operator_authority",
  "authorize_scope_execution",
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_gate_open",
  "guard_token_consume",
  "approval_request_create",
  "pending_engine_candidate_create",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "persist_scope_acceptance_preview",
  "persist_scope_contract",
  "claim_full_run_all_passed"
]);

const BASELINE_STATE = Object.freeze(Object.fromEntries(
  MUTATION_FALSE_FIELDS.map((field) => [field, false])
));

const REQUIRED_TRUE_CONTRACT_FIELDS = Object.freeze([
  "source_chain_closed",
  "new_scope_distinct_from_phase42",
  "acceptance_preview_only",
  "explicit_scope_request_required",
  "no_implicit_continuation"
]);

const REQUIRED_FALSE_CONTRACT_FIELDS = Object.freeze([
  "source_chain_reopen_allowed",
  "source_authority_inheritance_allowed",
  "authority_transfer_allowed",
  "new_scope_execution_authorized",
  "new_scope_persistence_allowed",
  "acceptance_preview_persistence_allowed",
  "production_write_authorized",
  "production_promotion_authorized",
  "production_gate_open_authorized",
  "guard_token_consumption_authorized",
  "approval_request_creation_authorized",
  "pending_engine_candidate_creation_authorized",
  "audit_receipt_creation_authorized",
  "backup_snapshot_creation_authorized",
  "rollback_restore_authorized",
  "adoption_authorized",
  "settlement_authorized",
  "canon_update_authorized",
  "active_engine_update_authorized",
  "full_run_all_passed_claimed"
]);

const explicitScopeAcceptanceContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  expected_base: "765e6fc",
  previous_phase: PREVIOUS_PHASE,
  previous_phase_slug: PREVIOUS_PHASE_SLUG,
  kind: "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_acceptance_contract",
  mode: "explicit_new_scope_acceptance_preview_only",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_chain_reopen_allowed: false,
  source_authority_inheritance_allowed: false,
  authority_transfer_allowed: false,
  new_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  new_scope_distinct_from_phase42: true,
  new_scope_execution_authorized: false,
  new_scope_persistence_allowed: false,
  acceptance_preview_only: true,
  acceptance_preview_persistence_allowed: false,
  explicit_scope_request_required: true,
  no_implicit_continuation: true,
  phase42v_contract_digest: PHASE42V_CONTRACT_DIGEST,
  phase42v_seal_digest: PHASE42V_SEAL_DIGEST,
  phase42u_digest: PHASE42U_DIGEST,
  production_write_authorized: false,
  production_promotion_authorized: false,
  production_gate_open_authorized: false,
  guard_token_consumption_authorized: false,
  approval_request_creation_authorized: false,
  pending_engine_candidate_creation_authorized: false,
  audit_receipt_creation_authorized: false,
  backup_snapshot_creation_authorized: false,
  rollback_restore_authorized: false,
  adoption_authorized: false,
  settlement_authorized: false,
  canon_update_authorized: false,
  active_engine_update_authorized: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  blocked_actions: BLOCKED_ACTIONS
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function allFalseError(target, label) {
  if (!target || typeof target !== "object") return `${label}_missing`;
  for (const field of MUTATION_FALSE_FIELDS) {
    if (target[field] !== false) return `${label}_${field}_must_remain_false`;
  }
  return null;
}

function assertAllFalse(target, label) {
  const error = allFalseError(target, label);
  assert.equal(error, null, error ?? `${label} must contain only protected false values`);
}

function makePhase42VSealEvidence(overrides = {}) {
  return Object.freeze({
    accepted: true,
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    reason:
      "production_candidate_store_promotion_gate_final_closure_operator_handoff_seal_preview_only",
    seal_mode: "final_closure_operator_handoff_seal_preview_only",
    source_chain: "Phase42A-Phase42U",
    source_chain_closed: true,
    phase42_closed_by: PREVIOUS_PHASE,
    phase42_chain_verified: true,
    phase42_chain_length: 21,
    phase42u_final_closure_index_verified: true,
    phase42u_digest_verified: true,
    phase42u_digest: PHASE42U_DIGEST,
    contract_digest: PHASE42V_CONTRACT_DIGEST,
    seal_digest: PHASE42V_SEAL_DIGEST,
    operator_handoff_seal_generated: true,
    operator_handoff_seal_persisted: false,
    operator_handoff_packet_generated: true,
    operator_handoff_packet_persisted: false,
    seal_status: "sealed_preview_only",
    authority_transferred: false,
    production_execution_authorized: false,
    no_implicit_continuation: true,
    new_explicit_scope_required_for_future_work: true,
    recommended_next_container: "new_explicitly_scoped_phase_after_phase42",
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    blocked_direct_actions: [...BLOCKED_ACTIONS],
    final_state: clone(BASELINE_STATE),
    ...overrides
  });
}

function makeScopeContract(overrides = {}) {
  return Object.freeze({
    ...explicitScopeAcceptanceContract,
    ...overrides
  });
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return Object.freeze({
    explicit_scope_acceptance:
      /phase43a/.test(normalized) ||
      /sealed chain explicit scope acceptance/.test(normalized) ||
      /new explicit scope acceptance/.test(normalized) ||
      /explicit post-closure scope/.test(normalized),
    reopen_phase42:
      /\breopen\b[\s\S]*\bphase42\b|\bcontinue\b[\s\S]*\bphase42\b/.test(normalized),
    inherit_phase42_authority:
      /\binherit\b[\s\S]*\bphase42\b[\s\S]*\bauthority\b/.test(normalized),
    transfer_authority:
      /\btransfer\b[\s\S]*\bauthority\b/.test(normalized),
    authorize_scope_execution:
      /\bauthorize\b[\s\S]*\bscope execution\b|\bexecute\b[\s\S]*\bnew scope\b/.test(normalized),
    production_write:
      /\bproduction write\b|\bwrite\b[\s\S]*\bproduction candidate store\b/.test(normalized),
    production_promotion:
      /\bproduction promotion\b|\bpromote\b[\s\S]*\bproduction candidate\b/.test(normalized),
    production_gate_open:
      /\bopen\b[\s\S]*\bproduction gate\b|\bproduction gate\b[\s\S]*\bopen\b/.test(normalized),
    guard_token_consume:
      /\bconsume\b[\s\S]*\bguard token\b/.test(normalized),
    approval_request_create:
      /\bcreate\b[\s\S]*\bapproval request\b/.test(normalized),
    pending_engine_candidate_create:
      /\bcreate\b[\s\S]*\bpending engine candidate\b/.test(normalized),
    audit_receipt_create:
      /\bcreate\b[\s\S]*\baudit receipt\b/.test(normalized),
    backup_snapshot_create:
      /\bcreate\b[\s\S]*\bbackup snapshot\b/.test(normalized),
    rollback_restore_execute:
      /\bexecute\b[\s\S]*\brollback restore\b|\brollback restore\b[\s\S]*\bexecute\b/.test(normalized),
    adoption:
      /\badopt\b|\badoption\b/.test(normalized),
    settlement:
      /\bsettle\b|\bsettlement\b/.test(normalized),
    canon_update:
      /\bupdate\b[\s\S]*\bcanon\b/.test(normalized),
    active_engine_update:
      /\bupdate\b[\s\S]*\bactive_engine\b|\bupdate\b[\s\S]*\bactive engine\b/.test(normalized),
    persist_acceptance:
      /\bpersist\b[\s\S]*\bacceptance\b|\bsave\b[\s\S]*\bscope contract\b/.test(normalized),
    full_run_all_passed_claim:
      /\bfull run-all passed\b|\bfull_run_all_passed\b/.test(normalized)
  });
}

function reject(reason, state = BASELINE_STATE) {
  return Object.freeze({
    accepted: false,
    reason,
    phase43a_explicit_scope_acceptance_generated: false,
    phase43a_explicit_scope_acceptance_persisted: false,
    scope_contract_generated: false,
    scope_contract_persisted: false,
    source_chain_reopened: false,
    source_authority_inherited: false,
    authority_transferred: false,
    scope_execution_authorized: false,
    state_after: clone(state)
  });
}

function validatePhase42VSealEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return "phase42v_handoff_seal_evidence_missing";
  if (evidence.accepted !== true) return "phase42v_handoff_seal_not_accepted";
  if (evidence.phase !== PREVIOUS_PHASE) return "phase42v_handoff_seal_phase_invalid";
  if (evidence.phase_slug !== PREVIOUS_PHASE_SLUG) return "phase42v_handoff_seal_phase_slug_invalid";
  if (
    evidence.reason !==
    "production_candidate_store_promotion_gate_final_closure_operator_handoff_seal_preview_only"
  ) return "phase42v_handoff_seal_reason_invalid";
  if (evidence.seal_mode !== "final_closure_operator_handoff_seal_preview_only") {
    return "phase42v_handoff_seal_mode_invalid";
  }
  if (evidence.source_chain !== "Phase42A-Phase42U") return "phase42v_source_chain_invalid";
  if (evidence.source_chain_closed !== true) return "phase42v_source_chain_not_closed";
  if (evidence.phase42_closed_by !== PREVIOUS_PHASE) return "phase42v_closed_by_invalid";
  if (evidence.phase42_chain_verified !== true) return "phase42v_chain_not_verified";
  if (evidence.phase42_chain_length !== 21) return "phase42v_chain_length_invalid";
  if (evidence.phase42u_final_closure_index_verified !== true) {
    return "phase42u_final_closure_index_not_verified";
  }
  if (evidence.phase42u_digest_verified !== true) return "phase42u_digest_not_verified";
  if (evidence.phase42u_digest !== PHASE42U_DIGEST) return "phase42u_digest_invalid";
  if (evidence.contract_digest !== PHASE42V_CONTRACT_DIGEST) return "phase42v_contract_digest_invalid";
  if (evidence.seal_digest !== PHASE42V_SEAL_DIGEST) return "phase42v_seal_digest_invalid";
  if (evidence.operator_handoff_seal_generated !== true) return "phase42v_handoff_seal_not_generated";
  if (evidence.operator_handoff_seal_persisted !== false) return "phase42v_handoff_seal_persisted";
  if (evidence.operator_handoff_packet_generated !== true) return "phase42v_handoff_packet_not_generated";
  if (evidence.operator_handoff_packet_persisted !== false) return "phase42v_handoff_packet_persisted";
  if (evidence.seal_status !== "sealed_preview_only") return "phase42v_seal_status_invalid";
  if (evidence.authority_transferred !== false) return "phase42v_authority_transferred";
  if (evidence.production_execution_authorized !== false) return "phase42v_production_execution_authorized";
  if (evidence.no_implicit_continuation !== true) return "phase42v_no_implicit_continuation_missing";
  if (evidence.new_explicit_scope_required_for_future_work !== true) {
    return "phase42v_new_explicit_scope_requirement_missing";
  }
  if (evidence.recommended_next_container !== "new_explicitly_scoped_phase_after_phase42") {
    return "phase42v_next_container_invalid";
  }
  if (evidence.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) {
    return "full_run_all_status_must_remain_pending";
  }
  if (evidence.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) {
    return "full_run_all_pending_message_changed";
  }
  if (evidence.full_run_all_passed_claimed !== false) return "full_run_all_passed_claim_forbidden";
  if (stableHash(evidence.blocked_direct_actions) !== stableHash(BLOCKED_ACTIONS)) {
    return "phase42v_blocked_actions_invalid";
  }
  return allFalseError(evidence.final_state, "phase42v_final_state");
}

function validateScopeContract(contract) {
  if (!contract || typeof contract !== "object") return "scope_contract_missing";
  if (contract.phase !== CURRENT_PHASE) return "scope_contract_phase_invalid";
  if (contract.phase_slug !== CURRENT_PHASE_SLUG) return "scope_contract_phase_slug_invalid";
  if (contract.expected_base !== "765e6fc") return "scope_contract_expected_base_invalid";
  if (contract.previous_phase !== PREVIOUS_PHASE) return "scope_contract_previous_phase_invalid";
  if (contract.previous_phase_slug !== PREVIOUS_PHASE_SLUG) {
    return "scope_contract_previous_phase_slug_invalid";
  }
  if (
    contract.kind !==
    "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_acceptance_contract"
  ) return "scope_contract_kind_invalid";
  if (contract.mode !== "explicit_new_scope_acceptance_preview_only") return "scope_contract_mode_invalid";
  if (contract.source_chain !== "Phase42A-Phase42V") return "scope_contract_source_chain_invalid";
  if (
    contract.new_scope_id !==
    "phase43-production-candidate-store-post-closure-explicit-scope"
  ) return "scope_contract_new_scope_id_invalid";
  if (contract.phase42v_contract_digest !== PHASE42V_CONTRACT_DIGEST) {
    return "scope_contract_phase42v_contract_digest_invalid";
  }
  if (contract.phase42v_seal_digest !== PHASE42V_SEAL_DIGEST) {
    return "scope_contract_phase42v_seal_digest_invalid";
  }
  if (contract.phase42u_digest !== PHASE42U_DIGEST) return "scope_contract_phase42u_digest_invalid";

  for (const field of REQUIRED_TRUE_CONTRACT_FIELDS) {
    if (contract[field] !== true) return `scope_contract_${field}_must_be_true`;
  }
  for (const field of REQUIRED_FALSE_CONTRACT_FIELDS) {
    if (contract[field] !== false) return "scope_contract_authorization_or_persistence_detected";
  }

  if (contract.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) {
    return "scope_contract_full_run_all_status_invalid";
  }
  if (contract.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) {
    return "scope_contract_full_run_all_message_invalid";
  }
  if (stableHash(contract.blocked_actions) !== stableHash(BLOCKED_ACTIONS)) {
    return "scope_contract_blocked_actions_invalid";
  }
  return null;
}

function buildAcceptanceDigest(sealEvidence, contract) {
  return stableHash({
    phase: CURRENT_PHASE,
    source_phase: sealEvidence.phase,
    source_phase_slug: sealEvidence.phase_slug,
    source_contract_digest: sealEvidence.contract_digest,
    source_seal_digest: sealEvidence.seal_digest,
    source_chain_closed: sealEvidence.source_chain_closed,
    new_scope_id: contract.new_scope_id,
    mode: contract.mode,
    blocked_actions: contract.blocked_actions,
    full_run_all_status: contract.full_run_all_status
  });
}

function previewPhase43AExplicitScopeAcceptance({
  userRequest,
  sealEvidence = makePhase42VSealEvidence(),
  contract = makeScopeContract(),
  state = BASELINE_STATE
} = {}) {
  const intent = classifyIntent(userRequest);
  if (!intent.explicit_scope_acceptance) {
    return reject("missing_explicit_phase43a_scope_acceptance_request", state);
  }

  const stateError = allFalseError(state, "input_state");
  if (stateError) return reject("input_state_mutation_detected", BASELINE_STATE);

  for (const error of [
    validatePhase42VSealEvidence(sealEvidence),
    validateScopeContract(contract)
  ]) {
    if (error) return reject(error, state);
  }

  const acceptanceDigest = buildAcceptanceDigest(sealEvidence, contract);
  const acceptanceId =
    `phase43a_scope_acceptance_${acceptanceDigest.slice("sha256:".length, "sha256:".length + 24)}`;

  const directRequestsDetected = Object.freeze({
    reopen_phase42: intent.reopen_phase42,
    inherit_phase42_authority: intent.inherit_phase42_authority,
    transfer_authority: intent.transfer_authority,
    authorize_scope_execution: intent.authorize_scope_execution,
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    production_gate_open: intent.production_gate_open,
    guard_token_consume: intent.guard_token_consume,
    approval_request_create: intent.approval_request_create,
    pending_engine_candidate_create: intent.pending_engine_candidate_create,
    audit_receipt_create: intent.audit_receipt_create,
    backup_snapshot_create: intent.backup_snapshot_create,
    rollback_restore_execute: intent.rollback_restore_execute,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon_update: intent.canon_update,
    active_engine_update: intent.active_engine_update,
    persist_acceptance: intent.persist_acceptance,
    full_run_all_passed_claim: intent.full_run_all_passed_claim
  });

  return Object.freeze({
    ...BASELINE_STATE,
    accepted: true,
    reason:
      "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_accepted_preview_only",
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    source_chain: "Phase42A-Phase42V",
    source_chain_closed: true,
    source_chain_reopened: false,
    phase42v_handoff_seal_verified: true,
    phase42v_contract_digest_verified: true,
    phase42v_seal_digest_verified: true,
    phase42u_digest_verified: true,
    new_scope_id: contract.new_scope_id,
    new_scope_distinct_from_phase42: true,
    explicit_new_scope_detected: true,
    no_implicit_continuation: true,
    no_authority_inheritance: true,
    source_authority_inherited: false,
    authority_transferred: false,
    scope_execution_authorized: false,
    phase43a_explicit_scope_acceptance_generated: true,
    phase43a_explicit_scope_acceptance_persisted: false,
    scope_contract_generated: true,
    scope_contract_persisted: false,
    acceptance_mode: contract.mode,
    acceptance_id: acceptanceId,
    acceptance_digest: acceptanceDigest,
    contract_digest: stableHash(contract),
    blocked_direct_actions: [...BLOCKED_ACTIONS],
    direct_requests_detected: directRequestsDetected,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    acceptance_preview: Object.freeze({
      acceptance_id: acceptanceId,
      generated: true,
      persisted: false,
      preview_only: true,
      source_chain: "Phase42A-Phase42V",
      source_chain_closed: true,
      source_chain_reopened: false,
      source_handoff_seal_digest: PHASE42V_SEAL_DIGEST,
      new_scope_id: contract.new_scope_id,
      new_scope_distinct_from_phase42: true,
      scope_execution_authorized: false,
      authority_transferred: false,
      no_implicit_continuation: true,
      blocked_actions: [...BLOCKED_ACTIONS],
      full_run_all_status: FULL_RUN_ALL_PENDING_STATUS
    }),
    next_phase_guidance: Object.freeze({
      status: "explicit_scope_accepted_preview_only",
      current_scope_grants_execution_authority: false,
      further_work_requires_separate_explicit_phase: true,
      recommended_next_step:
        "Define a separate Phase43B contract for one narrowly scoped post-closure capability. Do not reopen Phase42 or inherit its authority.",
      forbidden_inference:
        "Phase43A acceptance does not authorize production writes, promotion, gate opening, guard token consumption, approval creation, backup, rollback, adoption, settlement, Canon changes, or active_engine changes."
    }),
    state_after: clone(state)
  });
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase43a_explicit_scope_acceptance_generated, false);
  assert.equal(result.phase43a_explicit_scope_acceptance_persisted, false);
  assert.equal(result.scope_contract_generated, false);
  assert.equal(result.scope_contract_persisted, false);
  assert.equal(result.source_chain_reopened, false);
  assert.equal(result.source_authority_inherited, false);
  assert.equal(result.authority_transferred, false);
  assert.equal(result.scope_execution_authorized, false);
  assert.deepEqual(result.state_after, BASELINE_STATE);
}

function assertNoExecutableMutationCalls() {
  const source = readRepoFile(
    "tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs"
  );
  const forbiddenCallPatterns = [
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
    /\bwriteFileSync\s*\(/,
    /\bappendFileSync\s*\(/,
    /\brenameSync\s*\(/,
    /\bunlinkSync\s*\(/,
    /\brmSync\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase43A explicit scope acceptance must not contain executable mutation call pattern ${pattern}`
    );
  }
}

const scopeContractDigest = stableHash(explicitScopeAcceptanceContract);
assert.equal(
  scopeContractDigest,
  "sha256:148aff92b3b932359457ad0fd88c1a5569384b0756ca5a7ff47a2fe51f7f2806",
  "Phase43A explicit scope acceptance contract deterministic digest changed unexpectedly"
);

const phase42VPath =
  "tests/phase42/phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal.test.mjs";
const phase42VSource = readRepoFile(phase42VPath);

for (const marker of [
  'const CURRENT_PHASE = "Phase42V";',
  'const PREVIOUS_PHASE = "Phase42U";',
  PHASE42V_CONTRACT_DIGEST,
  PHASE42U_DIGEST,
  'phase42_completed_range: "Phase42A-Phase42U"',
  "operator_handoff_seal_generated: true",
  "operator_handoff_seal_persisted: false",
  "operator_handoff_packet_generated: true",
  "operator_handoff_packet_persisted: false",
  "authority_transferred: false",
  "production_execution_authorized: false",
  "no_implicit_continuation: true",
  "new_explicit_scope_required_for_future_work: true",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(
    phase42VSource.includes(marker),
    true,
    `Phase42V source contract marker missing: ${marker}`
  );
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs";

assert.equal(
  countOccurrences(runAllText, phase42VPath),
  1,
  "tests/run-all.mjs must register Phase42V exactly once"
);
assert.equal(
  countOccurrences(runAllText, currentTestPath),
  1,
  "tests/run-all.mjs must register Phase43A exactly once"
);
assert.equal(
  runAllText.indexOf(currentTestPath) > runAllText.indexOf(phase42VPath),
  true,
  "Phase43A must be registered after Phase42V"
);

const phase42VRegistration =
  '  ["Phase 42V production candidate store promotion gate final closure operator handoff seal", ["tests/phase42/phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal.test.mjs"]],';
const phase43ARegistration =
  '  ["Phase 43A production candidate store promotion gate sealed chain explicit scope acceptance smoke", ["tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs"]],';
assert.equal(
  runAllText.includes(`${phase42VRegistration}\n${phase43ARegistration}`),
  true,
  "Phase43A registration must be immediately after Phase42V"
);

assertRejected(
  previewPhase43AExplicitScopeAcceptance({
    userRequest: "Continue ordinary work."
  }),
  "missing_explicit_phase43a_scope_acceptance_request"
);

assertRejected(
  previewPhase43AExplicitScopeAcceptance({
    userRequest: "Phase43A new explicit scope acceptance",
    sealEvidence: null
  }),
  "phase42v_handoff_seal_evidence_missing"
);

for (const [override, reason] of [
  [{ accepted: false }, "phase42v_handoff_seal_not_accepted"],
  [{ phase: "Phase42U" }, "phase42v_handoff_seal_phase_invalid"],
  [{ source_chain_closed: false }, "phase42v_source_chain_not_closed"],
  [{ contract_digest: "sha256:tampered" }, "phase42v_contract_digest_invalid"],
  [{ seal_digest: "sha256:tampered" }, "phase42v_seal_digest_invalid"],
  [{ operator_handoff_seal_persisted: true }, "phase42v_handoff_seal_persisted"],
  [{ operator_handoff_packet_persisted: true }, "phase42v_handoff_packet_persisted"],
  [{ authority_transferred: true }, "phase42v_authority_transferred"],
  [{ production_execution_authorized: true }, "phase42v_production_execution_authorized"],
  [{ no_implicit_continuation: false }, "phase42v_no_implicit_continuation_missing"],
  [{ full_run_all_status: "passed" }, "full_run_all_status_must_remain_pending"],
  [{ full_run_all_passed_claimed: true }, "full_run_all_passed_claim_forbidden"]
]) {
  assertRejected(
    previewPhase43AExplicitScopeAcceptance({
      userRequest: "Phase43A new explicit scope acceptance",
      sealEvidence: makePhase42VSealEvidence(override)
    }),
    reason
  );
}

assertRejected(
  previewPhase43AExplicitScopeAcceptance({
    userRequest: "Phase43A new explicit scope acceptance",
    sealEvidence: makePhase42VSealEvidence({
      final_state: {
        ...BASELINE_STATE,
        production_candidate_store_mutated: true
      }
    })
  }),
  "phase42v_final_state_production_candidate_store_mutated_must_remain_false"
);

for (const [override, reason] of [
  [{ mode: "execute_scope" }, "scope_contract_mode_invalid"],
  [{ source_chain_closed: false }, "scope_contract_source_chain_closed_must_be_true"],
  [{ source_chain_reopen_allowed: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ source_authority_inheritance_allowed: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ authority_transfer_allowed: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ new_scope_execution_authorized: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ acceptance_preview_only: false }, "scope_contract_acceptance_preview_only_must_be_true"],
  [{ acceptance_preview_persistence_allowed: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ production_write_authorized: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ rollback_restore_authorized: true }, "scope_contract_authorization_or_persistence_detected"],
  [{ no_implicit_continuation: false }, "scope_contract_no_implicit_continuation_must_be_true"],
  [{ phase42v_seal_digest: "sha256:tampered" }, "scope_contract_phase42v_seal_digest_invalid"],
  [{ full_run_all_status: "passed" }, "scope_contract_full_run_all_status_invalid"]
]) {
  assertRejected(
    previewPhase43AExplicitScopeAcceptance({
      userRequest: "Phase43A new explicit scope acceptance",
      contract: makeScopeContract(override)
    }),
    reason
  );
}

assertRejected(
  previewPhase43AExplicitScopeAcceptance({
    userRequest: "Phase43A new explicit scope acceptance",
    state: {
      ...BASELINE_STATE,
      active_engine_updated: true
    }
  }),
  "input_state_mutation_detected"
);

const success = previewPhase43AExplicitScopeAcceptance({
  userRequest:
    "Phase43A sealed chain explicit scope acceptance. Accept a distinct preview-only post-closure scope without reopening Phase42 or inheriting authority."
});

assert.equal(success.accepted, true);
assert.equal(
  success.reason,
  "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_accepted_preview_only"
);
assert.equal(success.phase, CURRENT_PHASE);
assert.equal(success.phase_slug, CURRENT_PHASE_SLUG);
assert.equal(success.source_phase, PREVIOUS_PHASE);
assert.equal(success.source_phase_slug, PREVIOUS_PHASE_SLUG);
assert.equal(success.source_chain, "Phase42A-Phase42V");
assert.equal(success.source_chain_closed, true);
assert.equal(success.source_chain_reopened, false);
assert.equal(success.phase42v_handoff_seal_verified, true);
assert.equal(success.phase42v_contract_digest_verified, true);
assert.equal(success.phase42v_seal_digest_verified, true);
assert.equal(success.phase42u_digest_verified, true);
assert.equal(
  success.new_scope_id,
  "phase43-production-candidate-store-post-closure-explicit-scope"
);
assert.equal(success.new_scope_distinct_from_phase42, true);
assert.equal(success.explicit_new_scope_detected, true);
assert.equal(success.no_implicit_continuation, true);
assert.equal(success.no_authority_inheritance, true);
assert.equal(success.source_authority_inherited, false);
assert.equal(success.authority_transferred, false);
assert.equal(success.scope_execution_authorized, false);
assert.equal(success.phase43a_explicit_scope_acceptance_generated, true);
assert.equal(success.phase43a_explicit_scope_acceptance_persisted, false);
assert.equal(success.scope_contract_generated, true);
assert.equal(success.scope_contract_persisted, false);
assert.equal(success.acceptance_mode, "explicit_new_scope_acceptance_preview_only");
assert.equal(success.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
assert.equal(success.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
assert.equal(success.full_run_all_passed_claimed, false);
assert.deepEqual(success.blocked_direct_actions, BLOCKED_ACTIONS);
assert.equal(success.acceptance_preview.persisted, false);
assert.equal(success.acceptance_preview.preview_only, true);
assert.equal(success.acceptance_preview.source_chain_closed, true);
assert.equal(success.acceptance_preview.source_chain_reopened, false);
assert.equal(success.acceptance_preview.scope_execution_authorized, false);
assert.equal(success.acceptance_preview.authority_transferred, false);
assert.equal(success.next_phase_guidance.current_scope_grants_execution_authority, false);
assert.equal(success.next_phase_guidance.further_work_requires_separate_explicit_phase, true);
assertAllFalse(success, "success");
assert.deepEqual(success.state_after, BASELINE_STATE);

const riskyRequest = previewPhase43AExplicitScopeAcceptance({
  userRequest: [
    "Phase43A new explicit scope acceptance.",
    "Reopen Phase42 and inherit Phase42 authority.",
    "Transfer authority and authorize scope execution.",
    "Write the production candidate store and execute production promotion.",
    "Open the production gate and consume the guard token.",
    "Create approval request and pending engine candidate.",
    "Create audit receipt and backup snapshot.",
    "Execute rollback restore.",
    "Adopt and settle.",
    "Update Canon and update active_engine.",
    "Persist the acceptance and save the scope contract.",
    "Claim full run-all passed."
  ].join(" ")
});

assert.equal(riskyRequest.accepted, true);
for (const field of [
  "reopen_phase42",
  "inherit_phase42_authority",
  "transfer_authority",
  "authorize_scope_execution",
  "production_write",
  "production_promotion",
  "production_gate_open",
  "guard_token_consume",
  "approval_request_create",
  "pending_engine_candidate_create",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "persist_acceptance",
  "full_run_all_passed_claim"
]) {
  assert.equal(
    riskyRequest.direct_requests_detected[field],
    true,
    `direct_requests_detected.${field} must be true`
  );
}
assert.equal(riskyRequest.source_chain_reopened, false);
assert.equal(riskyRequest.source_authority_inherited, false);
assert.equal(riskyRequest.authority_transferred, false);
assert.equal(riskyRequest.scope_execution_authorized, false);
assert.equal(riskyRequest.phase43a_explicit_scope_acceptance_persisted, false);
assert.equal(riskyRequest.scope_contract_persisted, false);
assertAllFalse(riskyRequest, "riskyRequest");
assert.deepEqual(riskyRequest.state_after, BASELINE_STATE);

assertNoExecutableMutationCalls();

console.log(
  `Phase43A production candidate store promotion gate sealed chain explicit scope acceptance contract digest: ${scopeContractDigest}`
);
console.log(
  `Phase43A production candidate store promotion gate sealed chain explicit scope acceptance digest: ${success.acceptance_digest}`
);
console.log(
  "Phase43A production candidate store promotion gate sealed chain explicit scope acceptance smoke tests passed."
);