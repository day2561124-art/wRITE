import assert from "node:assert/strict";
import crypto from "node:crypto";

const PHASE41_CHAIN = [
  "phase41a-chatgpt-native-writing-output-adoption-settlement-boundary-final-smoke",
  "phase41b-explicit-candidate-workflow-intake-boundary-smoke",
  "phase41c-explicit-candidate-write-preview-boundary-smoke",
  "phase41d-explicit-candidate-persist-boundary-smoke",
  "phase41e-explicit-candidate-runtime-write-gate-smoke",
  "phase41f-explicit-candidate-runtime-write-implementation-readiness-smoke",
  "phase41g-explicit-candidate-runtime-write-minimal-implementation-smoke",
  "phase41h-explicit-candidate-runtime-write-service-integration-boundary-smoke",
  "phase41i-explicit-candidate-runtime-write-production-guard-smoke",
  "phase41j-explicit-candidate-runtime-write-promotion-dry-run-smoke",
  "phase41k-explicit-candidate-runtime-write-promotion-persistence-readiness-smoke",
  "phase41l-explicit-candidate-runtime-write-promotion-dry-run-proof-seal-smoke",
  "phase41m-explicit-candidate-runtime-write-promotion-boundary-final-closure-operator-handoff-seal",
];

const BASELINE_STATE = Object.freeze({
  phase42e_operator_confirmation_final_readiness_generated: false,
  phase42e_operator_confirmation_final_readiness_persisted: false,
  phase42d_boundary_accepted_verified: false,
  operator_confirmation_acceptance_verified: false,
  operator_confirmation_final_readiness_verified: false,
  operator_confirmation_accepted: false,
  operator_confirmation_granted: false,
  production_promotion_gate_opened: false,
  production_candidate_saved: false,
  production_write_performed: false,
  production_promotion_performed: false,
  production_candidate_store_mutated: false,
  guard_token_consumed: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  adoption_performed: false,
  settlement_performed: false,
  canon_update_performed: false,
  active_engine_update_performed: false,
  audit_receipt_created: false,
  backup_snapshot_created: false,
  rollback_restore_executed: false,
  full_run_all_passed_claimed: false,
});

const BLOCKED_ACTIONS = [
  "operator_confirmation_final_readiness_persist",
  "operator_confirmation_grant",
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
  "guard_token_consume",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "approval_request_create",
  "pending_engine_candidate_create",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "full_run_all_passed_claim",
];

const MUTATION_FIELDS = [
  "phase42e_operator_confirmation_final_readiness_persisted",
  "operator_confirmation_granted",
  "production_promotion_gate_opened",
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "production_candidate_store_mutated",
  "guard_token_consumed",
  "approval_request_created",
  "pending_engine_candidate_created",
  "adoption_performed",
  "settlement_performed",
  "canon_update_performed",
  "active_engine_update_performed",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "full_run_all_passed_claimed",
];

const CONTRACT_TRUE_FIELDS = [
  "phase42d_operator_confirmation_boundary_required",
  "explicit_phase42e_operator_confirmation_final_readiness_request_required",
  "operator_confirmation_final_readiness_preview_only",
  "operator_confirmation_final_readiness_must_not_persist",
  "phase42d_accepted_boundary_required",
  "confirmation_acceptance_required",
  "confirmation_grant_must_not_be_inferred",
  "confirmation_final_readiness_must_not_open_gate",
  "confirmation_final_readiness_must_not_write_production",
  "confirmation_final_readiness_must_not_promote_production",
  "confirmation_final_readiness_must_not_create_approval_request",
  "confirmation_final_readiness_must_not_create_pending_engine_candidate",
  "guard_token_must_remain_unconsumed",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_must_not_execute",
  "adoption_must_not_run",
  "settlement_must_not_run",
  "canon_must_not_update",
  "active_engine_must_not_update",
  "full_run_all_must_remain_pending_until_explicitly_rerun",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function assertFalseFields(snapshot, fields) {
  for (const field of fields) assert.equal(snapshot[field], false, `${field} must remain false`);
}

function makePhase42DBoundaryPreview(overrides = {}) {
  const candidateId = "candidate_6a9cb9021f27e75af0b94a31";
  const preflightContractId = "phase42c_preflight_contract_d2b5e22b9a31061f49e7f718";
  const scope = {
    target_gate: "production_candidate_store_promotion_gate",
    candidate_id: candidateId,
    candidate_content_hash: sha256Text("candidate_content_hash_fixture"),
    source_text_hash: sha256Text("source_text_hash_fixture"),
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    mutation_allowed: false,
  };
  const scopeHash = sha256Text(JSON.stringify(scope));
  const tokenValue = `phase42d_confirm_${sha256Text(`Phase42D|${scopeHash}`).slice(0, 24)}`;

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview_only",
    id: "phase42d_operator_confirmation_boundary_6bfac19e9fb227cfecbd70aa",
    kind: "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview",
    phase: "Phase42D",
    source_phase: "Phase42C",
    source_chain: [...PHASE41_CHAIN],
    phase41_closed: true,
    source_chain_complete: true,
    target_gate: "production_candidate_store_promotion_gate",
    mode: "operator_confirmation_boundary_preview_only",
    generated: true,
    persisted: false,
    preflight_contract_id: preflightContractId,
    candidate_id: candidateId,
    confirmation_scope_hash: scopeHash,
    confirmation_token_shape: "phase42d_confirm_<24hex>",
    confirmation_token_value: tokenValue,
    explicit_operator_confirmation_request_verified: true,
    confirmation_text_verified: true,
    confirmation_phrase_verified: true,
    confirmation_scope_verified: true,
    confirmation_token_shape_verified: true,
    operator_confirmation_accepted: true,
    operator_confirmation_granted: false,
    confirmation_still_preview_only: true,
    production_gate_opened: false,
    production_promotion_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke",
    ...overrides,
  };
}

function makeFinalReadinessContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_contract",
    mode: "operator_confirmation_final_readiness_preview_only",
    source_phase: "Phase42D",
    target_phase: "Phase42E",
    target_gate: "production_candidate_store_promotion_gate",
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    operator_confirmation_grant_allowed: false,
    guard_token_consumption_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase42d_operator_confirmation_boundary_required: true,
    explicit_phase42e_operator_confirmation_final_readiness_request_required: true,
    operator_confirmation_final_readiness_preview_only: true,
    operator_confirmation_final_readiness_must_not_persist: true,
    phase42d_accepted_boundary_required: true,
    confirmation_acceptance_required: true,
    confirmation_grant_must_not_be_inferred: true,
    confirmation_final_readiness_must_not_open_gate: true,
    confirmation_final_readiness_must_not_write_production: true,
    confirmation_final_readiness_must_not_promote_production: true,
    confirmation_final_readiness_must_not_create_approval_request: true,
    confirmation_final_readiness_must_not_create_pending_engine_candidate: true,
    guard_token_must_remain_unconsumed: true,
    audit_receipt_must_not_be_created: true,
    backup_snapshot_must_not_be_created: true,
    rollback_restore_must_not_execute: true,
    adoption_must_not_run: true,
    settlement_must_not_run: true,
    canon_must_not_update: true,
    active_engine_must_not_update: true,
    full_run_all_must_remain_pending_until_explicitly_rerun: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /phase42e/.test(normalized) && /operator confirmation/.test(normalized) && /final readiness|readiness/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    gate_open: /\bopen\b.*\bgate\b|\bgate\b.*\bopen\b/.test(normalized),
    operator_confirmation_grant: /\bgrant\b.*\boperator confirmation\b|\boperator confirmation\b.*\bgrant\b/.test(normalized),
    guard_token: /\bconsume\b.*\bguard token\b|\bguard token\b.*\bconsume\b/.test(normalized),
    audit_receipt: /\bcreate\b.*\baudit receipt\b|\baudit receipt\b.*\bcreate\b/.test(normalized),
    backup_snapshot: /\bcreate\b.*\bbackup\b|\bbackup snapshot\b.*\bcreate\b/.test(normalized),
    rollback_restore: /\bexecute\b.*\brollback\b|\brollback\b.*\bexecute\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
    full_run_all_passed: /full run-all passed|full run all passed|full_run_all_passed/.test(normalized),
  };
}

function validatePhase42DBoundaryPreview(boundaryPreview) {
  if (!boundaryPreview?.accepted) return "phase42d_operator_confirmation_boundary_not_accepted";
  if (boundaryPreview.phase !== "Phase42D" || boundaryPreview.kind !== "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview") return "phase42d_operator_confirmation_boundary_kind_invalid";
  if (boundaryPreview.source_phase !== "Phase42C" || boundaryPreview.target_gate !== "production_candidate_store_promotion_gate") return "phase42d_operator_confirmation_boundary_link_invalid";
  if (boundaryPreview.mode !== "operator_confirmation_boundary_preview_only" || boundaryPreview.generated !== true || boundaryPreview.persisted !== false) return "phase42d_operator_confirmation_boundary_mode_invalid";
  if (boundaryPreview.next_allowed_phase !== "phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke") return "phase42d_next_phase_link_invalid";
  if (boundaryPreview.source_chain_complete !== true || boundaryPreview.phase41_closed !== true) return "phase42d_source_chain_not_closed";
  for (const phase of PHASE41_CHAIN) if (!boundaryPreview.source_chain?.includes(phase)) return "phase42d_source_chain_incomplete";
  for (const field of ["explicit_operator_confirmation_request_verified", "confirmation_text_verified", "confirmation_phrase_verified", "confirmation_scope_verified", "confirmation_token_shape_verified"]) if (boundaryPreview[field] !== true) return "phase42d_operator_confirmation_verification_missing";
  if (boundaryPreview.operator_confirmation_accepted !== true) return "phase42d_operator_confirmation_not_accepted";
  if (boundaryPreview.confirmation_still_preview_only !== true) return "phase42d_operator_confirmation_not_preview_only";
  if (!boundaryPreview.preflight_contract_id || !boundaryPreview.candidate_id || !boundaryPreview.confirmation_scope_hash || !boundaryPreview.confirmation_token_value) return "phase42d_operator_confirmation_identity_missing";
  if (boundaryPreview.confirmation_token_shape !== "phase42d_confirm_<24hex>" || !/^phase42d_confirm_[a-f0-9]{24}$/.test(boundaryPreview.confirmation_token_value)) return "phase42d_operator_confirmation_token_shape_invalid";
  if (boundaryPreview.production_write_allowed !== false || boundaryPreview.production_promotion_allowed !== false || boundaryPreview.production_gate_opened !== false || boundaryPreview.production_promotion_gate_opened !== false) return "phase42d_operator_confirmation_write_policy_invalid";
  if (boundaryPreview.production_write_performed !== false || boundaryPreview.production_promotion_performed !== false || boundaryPreview.production_candidate_store_mutated !== false) return "phase42d_operator_confirmation_already_mutated_production";
  for (const field of ["operator_confirmation_granted", "guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "audit_receipt_created", "backup_snapshot_created", "rollback_restore_executed", "full_run_all_passed_claimed"]) if (boundaryPreview[field] !== false) return "phase42d_operator_confirmation_forbidden_action_detected";
  if (boundaryPreview.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42d_full_run_all_status_invalid";
  return null;
}

function validateFinalReadinessContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_contract") return "operator_confirmation_final_readiness_contract_missing";
  if (contract.mode !== "operator_confirmation_final_readiness_preview_only") return "operator_confirmation_final_readiness_contract_mode_invalid";
  if (contract.source_phase !== "Phase42D" || contract.target_phase !== "Phase42E") return "operator_confirmation_final_readiness_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "operator_confirmation_final_readiness_contract_target_gate_invalid";
  if (contract.production_write_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_gate_open";
  if (contract.operator_confirmation_grant_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_operator_confirmation_grant";
  if (contract.guard_token_consumption_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_guard_token_consume";
  if (contract.audit_receipt_creation_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_rollback_restore";
  if (contract.approval_request_creation_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "operator_confirmation_final_readiness_contract_allows_pending_engine_candidate";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "operator_confirmation_final_readiness_contract_required_field_invalid";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42e_operator_confirmation_final_readiness_generated: false,
    phase42e_operator_confirmation_final_readiness_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildOperatorConfirmationFinalReadinessPreview({ boundaryPreview, contract, userRequest, state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = {
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    gate_open: intent.gate_open,
    operator_confirmation_grant: intent.operator_confirmation_grant,
    guard_token: intent.guard_token,
    audit_receipt: intent.audit_receipt,
    backup_snapshot: intent.backup_snapshot,
    rollback_restore: intent.rollback_restore,
    approval: intent.approval,
    pending_engine: intent.pending_engine,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon: intent.canon,
    active_engine: intent.active_engine,
    full_run_all_passed: intent.full_run_all_passed,
  };

  for (const error of [
    validatePhase42DBoundaryPreview(boundaryPreview),
    validateFinalReadinessContract(contract),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42e_operator_confirmation_final_readiness_request", state, { direct_requests_detected: directRequestsDetected });

  const readinessSource = JSON.stringify({
    phase: "Phase42E",
    boundaryId: boundaryPreview.id,
    preflightContractId: boundaryPreview.preflight_contract_id,
    candidateId: boundaryPreview.candidate_id,
    confirmationScopeHash: boundaryPreview.confirmation_scope_hash,
    confirmationTokenShape: boundaryPreview.confirmation_token_shape,
    fullRunAllStatus: boundaryPreview.full_run_all_status,
  });
  const readinessHash = sha256Text(readinessSource);

  const readinessPreview = {
    id: `phase42e_operator_confirmation_final_readiness_${readinessHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview",
    phase: "Phase42E",
    source_phase: "Phase42D",
    target_gate: boundaryPreview.target_gate,
    mode: "operator_confirmation_final_readiness_preview_only",
    generated: true,
    persisted: false,
    phase42d_boundary_id: boundaryPreview.id,
    preflight_contract_id: boundaryPreview.preflight_contract_id,
    candidate_id: boundaryPreview.candidate_id,
    phase42d_boundary_accepted_verified: true,
    operator_confirmation_acceptance_verified: true,
    operator_confirmation_final_readiness_verified: true,
    operator_confirmation_accepted: true,
    operator_confirmation_granted: false,
    production_gate_opened: false,
    production_promotion_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: boundaryPreview.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42f-production-candidate-store-promotion-gate-final-hard-stop-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview_only",
    phase42e_operator_confirmation_final_readiness_generated: true,
    phase42e_operator_confirmation_final_readiness_persisted: false,
    phase42d_boundary_accepted_verified: true,
    operator_confirmation_acceptance_verified: true,
    operator_confirmation_final_readiness_verified: true,
    operator_confirmation_accepted: true,
    operator_confirmation_granted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
    production_write_performed: false,
    production_promotion_performed: false,
    guard_token_consumed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: boundaryPreview.full_run_all_status,
    full_run_all_passed_claimed: false,
    operator_confirmation_final_readiness_preview: readinessPreview,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42e_operator_confirmation_final_readiness_generated, false);
  assert.equal(result.phase42e_operator_confirmation_final_readiness_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ accepted: false }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_boundary_not_accepted");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ persisted: true }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_boundary_mode_invalid");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ operator_confirmation_accepted: false }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_not_accepted");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ operator_confirmation_granted: true }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_forbidden_action_detected");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ production_promotion_gate_opened: true }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_write_policy_invalid");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, "phase42d_operator_confirmation_forbidden_action_detected");
}

for (const [contractOverride, reason] of [
  [{ mode: "operator_confirmation_grant" }, "operator_confirmation_final_readiness_contract_mode_invalid"],
  [{ production_write_allowed: true }, "operator_confirmation_final_readiness_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "operator_confirmation_final_readiness_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "operator_confirmation_final_readiness_contract_allows_gate_open"],
  [{ operator_confirmation_grant_allowed: true }, "operator_confirmation_final_readiness_contract_allows_operator_confirmation_grant"],
  [{ guard_token_consumption_allowed: true }, "operator_confirmation_final_readiness_contract_allows_guard_token_consume"],
  [{ audit_receipt_creation_allowed: true }, "operator_confirmation_final_readiness_contract_allows_audit_receipt"],
  [{ backup_snapshot_creation_allowed: true }, "operator_confirmation_final_readiness_contract_allows_backup_snapshot"],
  [{ rollback_restore_execution_allowed: true }, "operator_confirmation_final_readiness_contract_allows_rollback_restore"],
  [{ approval_request_creation_allowed: true }, "operator_confirmation_final_readiness_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "operator_confirmation_final_readiness_contract_allows_pending_engine_candidate"],
  [{ confirmation_grant_must_not_be_inferred: false }, "operator_confirmation_final_readiness_contract_required_field_invalid"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "operator_confirmation_final_readiness_contract_required_field_invalid"],
]) {
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview(),
    contract: makeFinalReadinessContract(contractOverride),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness",
  });
  assertRejected(result, reason);
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview(),
    contract: makeFinalReadinessContract(),
    userRequest: "Build future readiness notes without naming Phase42E",
  });
  assertRejected(result, "missing_explicit_phase42e_operator_confirmation_final_readiness_request");
}

{
  const result = buildOperatorConfirmationFinalReadinessPreview({
    boundaryPreview: makePhase42DBoundaryPreview(),
    contract: makeFinalReadinessContract(),
    userRequest: "Phase42E production candidate store promotion gate operator confirmation final readiness. Verify accepted confirmation as final readiness preview only. Do not grant operator confirmation, do not open gate, do not write production, do not promote production, do not consume guard token, do not create audit receipt, do not create backup snapshot, do not execute rollback, do not create approval request, do not create pending engine candidate, do not adopt, do not settle, do not update Canon, do not update active_engine, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview_only");
  assert.equal(result.phase42e_operator_confirmation_final_readiness_generated, true);
  assert.equal(result.phase42e_operator_confirmation_final_readiness_persisted, false);
  assert.equal(result.phase42d_boundary_accepted_verified, true);
  assert.equal(result.operator_confirmation_acceptance_verified, true);
  assert.equal(result.operator_confirmation_final_readiness_verified, true);
  assert.equal(result.operator_confirmation_accepted, true);
  assert.equal(result.operator_confirmation_granted, false);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_gate_open_allowed, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
  assertFalseFields(result.operator_confirmation_final_readiness_preview, MUTATION_FIELDS.filter((field) => field in result.operator_confirmation_final_readiness_preview));
  assert.equal(result.operator_confirmation_final_readiness_preview.phase42d_boundary_accepted_verified, true);
  assert.equal(result.operator_confirmation_final_readiness_preview.operator_confirmation_acceptance_verified, true);
  assert.equal(result.operator_confirmation_final_readiness_preview.operator_confirmation_final_readiness_verified, true);
  assert.equal(result.operator_confirmation_final_readiness_preview.operator_confirmation_accepted, true);
  assert.equal(result.operator_confirmation_final_readiness_preview.operator_confirmation_granted, false);
  assert.equal(result.operator_confirmation_final_readiness_preview.next_allowed_phase, "phase42f-production-candidate-store-promotion-gate-final-hard-stop-smoke");
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.operator_confirmation_grant, true);
  assert.equal(result.direct_requests_detected.guard_token, true);
  assert.equal(result.direct_requests_detected.audit_receipt, true);
  assert.equal(result.direct_requests_detected.backup_snapshot, true);
  assert.equal(result.direct_requests_detected.rollback_restore, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

console.log("Phase42E production candidate store promotion gate operator confirmation final readiness smoke tests passed.");
