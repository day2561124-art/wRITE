import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42M";
const CURRENT_PHASE_SLUG = "phase42m-production-candidate-store-promotion-gate-production-write-execution-denial-smoke";
const PREVIOUS_PHASE = "Phase42L";
const PREVIOUS_PHASE_SLUG = "phase42l-production-candidate-store-promotion-gate-production-write-preflight-boundary-smoke";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE = "Full run-all remains separately pending due to prior Backup export service timeout.";

const PROTECTED_FALSE_FIELDS = [
  "approval_request_created",
  "approval_request_creation_authorized",
  "pending_engine_candidate_created",
  "pending_engine_candidate_creation_authorized",
  "production_candidate_store_mutated",
  "production_candidate_store_write_executed",
  "production_candidate_store_promotion_executed",
  "production_promotion_gate_opened",
  "guard_token_consumed",
  "adoption_executed",
  "settlement_executed",
  "canon_updated",
  "active_engine_updated",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "full_run_all_passed_claimed"
];

const DENIAL_TRUE_FIELDS = [
  "phase42m_production_write_execution_denial_generated",
  "phase42l_production_write_preflight_accepted",
  "explicit_production_write_execution_request_detected",
  "production_write_execution_denied",
  "production_write_execution_not_authorized",
  "production_write_remains_not_executed",
  "production_candidate_store_remains_not_mutated",
  "denial_preview_only",
  "pending_engine_candidate_remains_not_created",
  "approval_request_remains_not_created",
  "guard_token_remains_unconsumed",
  "denial_blocks_production_promotion",
  "denial_blocks_gate_open",
  "adoption_blocked",
  "settlement_blocked",
  "canon_update_blocked",
  "active_engine_update_blocked",
  "audit_receipt_blocked",
  "backup_snapshot_blocked",
  "rollback_restore_blocked",
  "full_run_all_pending_status_preserved"
];

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value, Object.keys(value).sort())).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeBaselineState(overrides = {}) {
  return Object.freeze({
    phase42m_production_write_execution_denial_generated: false,
    phase42m_production_write_execution_denial_persisted: false,
    phase42l_production_write_preflight_accepted: false,
    explicit_production_write_execution_request_detected: false,
    production_write_execution_denied: false,
    production_write_execution_not_authorized: false,
    production_write_remains_not_executed: false,
    production_candidate_store_remains_not_mutated: false,
    denial_preview_only: false,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    approval_request_remains_not_created: false,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    pending_engine_candidate_remains_not_created: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    guard_token_remains_unconsumed: false,
    denial_blocks_production_promotion: false,
    denial_blocks_gate_open: false,
    adoption_blocked: false,
    settlement_blocked: false,
    canon_update_blocked: false,
    active_engine_update_blocked: false,
    audit_receipt_blocked: false,
    backup_snapshot_blocked: false,
    rollback_restore_blocked: false,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    ...overrides
  });
}

function makeApprovalRequestCandidate(overrides = {}) {
  return Object.freeze({
    kind: "approval_request_candidate",
    candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    preview_only: true,
    creation_allowed: false,
    created: false,
    grants_pending_engine_candidate: false,
    grants_production_write: false,
    grants_production_promotion: false,
    grants_gate_open: false,
    ...overrides
  });
}

function makePendingEngineCandidate(overrides = {}) {
  return Object.freeze({
    kind: "pending_engine_candidate_candidate",
    pending_engine_candidate_id: "phase42-pending-engine-candidate-preview",
    pending_engine_candidate_hash: "sha256:phase42pendingengine000000000000000000000000000000000000000000000000000",
    source_candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    source_candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "pending_engine_candidate_store",
    production_target_scope: "production_candidate_store",
    approval_request_required: true,
    approval_request_created: false,
    preview_only: true,
    creation_allowed: false,
    created: false,
    grants_production_write: false,
    grants_production_promotion: false,
    grants_gate_open: false,
    grants_adoption: false,
    grants_settlement: false,
    grants_canon_update: false,
    grants_active_engine_update: false,
    ...overrides
  });
}

function makeProductionWriteCandidate(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_write_candidate",
    production_write_id: "phase42-production-candidate-store-write-preview",
    production_write_hash: "sha256:phase42productionwrite00000000000000000000000000000000000000000000000000",
    source_candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    source_candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    write_mode: "preflight_only",
    preview_only: true,
    execution_allowed: false,
    executed: false,
    mutates_store: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    guard_token_consumed: false,
    production_gate_opened: false,
    grants_production_promotion: false,
    grants_gate_open: false,
    grants_adoption: false,
    grants_settlement: false,
    grants_canon_update: false,
    grants_active_engine_update: false,
    ...overrides
  });
}

function makePhase42LProductionWritePreflight(overrides = {}) {
  const approvalRequestCandidate = makeApprovalRequestCandidate(overrides.approval_request_candidate ?? {});
  const pendingEngineCandidate = makePendingEngineCandidate(overrides.pending_engine_candidate_candidate ?? {});
  const productionWriteCandidate = makeProductionWriteCandidate(overrides.production_write_candidate ?? {});
  const scopeHash = stableHash({
    production_write_id: productionWriteCandidate.production_write_id,
    source_candidate_id: productionWriteCandidate.source_candidate_id,
    request_scope: productionWriteCandidate.request_scope,
    source_store_scope: productionWriteCandidate.source_store_scope,
    target_store_scope: productionWriteCandidate.target_store_scope,
    write_mode: productionWriteCandidate.write_mode
  });

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    source_phase: "Phase42K",
    source_phase_slug: "phase42k-production-candidate-store-promotion-gate-pending-engine-candidate-creation-denial-smoke",
    accepted: true,
    reason: "production_write_preflight_boundary_preview_only",
    mode: "production_write_preflight_boundary_smoke",
    preview_only: true,
    persisted: false,
    phase42l_production_write_preflight_generated: true,
    phase42l_production_write_preflight_persisted: false,
    phase42k_pending_engine_candidate_creation_denial_accepted: true,
    explicit_production_write_preflight_detected: true,
    production_write_candidate_shape_verified: true,
    production_write_source_scope_verified: true,
    production_write_target_scope_verified: true,
    production_write_remains_not_executed: true,
    production_candidate_store_remains_not_mutated: true,
    production_write_preflight_preview_only: true,
    approval_request_candidate: approvalRequestCandidate,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    approval_request_remains_not_created: true,
    pending_engine_candidate_candidate: pendingEngineCandidate,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    pending_engine_candidate_remains_not_created: true,
    production_write_candidate: productionWriteCandidate,
    production_write_scope_hash: scopeHash,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    guard_token_remains_unconsumed: true,
    preflight_blocks_production_promotion: true,
    preflight_blocks_gate_open: true,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    preflight_packet: {
      kind: "production_candidate_store_write_preflight_boundary_packet",
      previewed_action: "preflight_production_write",
      preview_only: true,
      verifies_candidate_shape: true,
      verifies_source_scope: true,
      verifies_target_scope: true,
      executes_production_write: false,
      mutates_production_candidate_store: false,
      creates_pending_engine_candidate: false,
      creates_approval_request: false,
      promotes_production: false,
      opens_gate: false,
      consumes_guard_token: false,
      executes_adoption: false,
      executes_settlement: false,
      updates_canon: false,
      updates_active_engine: false,
      creates_audit_receipt: false,
      creates_backup_snapshot: false,
      executes_rollback_restore: false
    },
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true,
    ...overrides,
    approval_request_candidate: approvalRequestCandidate,
    pending_engine_candidate_candidate: pendingEngineCandidate,
    production_write_candidate: productionWriteCandidate
  });
}

function makeProductionWriteExecutionRequest(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_write_execution_request",
    explicit: true,
    text: [
      "Execute the production write for the production candidate store promotion gate.",
      "This is an explicit production write execution request.",
      "The request must be denied and must not mutate the production candidate store.",
      "Do not create approval request or pending engine candidate.",
      "Do not promote production or open production gate.",
      "Do not consume guard token.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create audit receipt, create backup snapshot, or execute rollback.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "execute_production_write",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      guard_token_consumed: false,
      production_gate_opened: false,
      production_write_execution_allowed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    production_write_preflight: /\bpreflight\b[\s\S]*\bproduction write\b/i.test(text) || /\bproduction write\b[\s\S]*\bpreflight\b/i.test(text),
    production_write_execute: /\b(execute|perform|commit)\b[\s\S]*\bproduction write\b/i.test(text) || /\bproduction write\b[\s\S]*\b(execute|perform|commit)\b/i.test(text),
    pending_engine_candidate_create: /\b(create|make|open)\b[\s\S]*\bpending engine candidate\b/i.test(text) || /\bpending engine candidate\b[\s\S]*\b(create|make|open)\b/i.test(text),
    approval_request_create: /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text) || /\bapproval request\b[\s\S]*\b(create|make|open)\b/i.test(text),
    production_promotion: /\bproduction promotion\b/i.test(text) || /\bpromote\b[\s\S]*\bproduction\b/i.test(text),
    gate_open: /\bopen\b[\s\S]*\bproduction gate\b/i.test(text) || /\bgate open\b/i.test(text),
    guard_token_consume: /\bconsume\b[\s\S]*\bguard token\b/i.test(text),
    adoption: /\badoption\b|\badopt\b/i.test(text),
    settlement: /\bsettlement\b|\bsettle\b/i.test(text),
    canon_update: /\bupdate\b[\s\S]*\bCanon\b/i.test(text) || /\bCanon\b[\s\S]*\bupdate\b/i.test(text),
    active_engine_update: /\bupdate\b[\s\S]*\bactive_engine\b/i.test(text) || /\bactive_engine\b[\s\S]*\bupdate\b/i.test(text),
    audit_receipt_create: /\bcreate\b[\s\S]*\baudit receipt\b/i.test(text),
    backup_snapshot_create: /\bcreate\b[\s\S]*\bbackup snapshot\b/i.test(text),
    rollback_restore_execute: /\bexecute\b[\s\S]*\brollback\b/i.test(text) || /\brollback\b[\s\S]*\brestore\b/i.test(text),
    full_run_all_passed_claim: /\bfull run-all passed\b/i.test(text) || /\bfull_run_all_passed\b/i.test(text)
  });
}

function assertProtectedFalse(target, label) {
  for (const field of PROTECTED_FALSE_FIELDS) {
    assert.equal(target[field], false, `${label}.${field} must remain false`);
  }
}

function validateApprovalRequestCandidate(candidate) {
  assert.equal(candidate.kind, "approval_request_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "sandbox_candidate_store");
  assert.equal(candidate.target_store_scope, "production_candidate_store");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.grants_production_write, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.match(candidate.candidate_hash, /^sha256:/);
}

function validatePendingEngineCandidate(candidate) {
  assert.equal(candidate.kind, "pending_engine_candidate_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "sandbox_candidate_store");
  assert.equal(candidate.target_store_scope, "pending_engine_candidate_store");
  assert.equal(candidate.production_target_scope, "production_candidate_store");
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.grants_production_write, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.equal(candidate.grants_canon_update, false);
  assert.equal(candidate.grants_active_engine_update, false);
  assert.match(candidate.pending_engine_candidate_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
}

function validateProductionWriteCandidate(candidate) {
  assert.equal(candidate.kind, "production_candidate_store_write_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "sandbox_candidate_store");
  assert.equal(candidate.target_store_scope, "production_candidate_store");
  assert.equal(candidate.write_mode, "preflight_only");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.execution_allowed, false);
  assert.equal(candidate.executed, false);
  assert.equal(candidate.mutates_store, false);
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.pending_engine_candidate_created, false);
  assert.equal(candidate.guard_token_consumed, false);
  assert.equal(candidate.production_gate_opened, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.equal(candidate.grants_adoption, false);
  assert.equal(candidate.grants_settlement, false);
  assert.equal(candidate.grants_canon_update, false);
  assert.equal(candidate.grants_active_engine_update, false);
  assert.match(candidate.production_write_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
}

function validatePhase42LPreflight(preflight) {
  assert.equal(preflight.phase, PREVIOUS_PHASE);
  assert.equal(preflight.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(preflight.accepted, true);
  assert.equal(preflight.reason, "production_write_preflight_boundary_preview_only");
  assert.equal(preflight.mode, "production_write_preflight_boundary_smoke");
  assert.equal(preflight.preview_only, true);
  assert.equal(preflight.persisted, false);
  assert.equal(preflight.phase42l_production_write_preflight_generated, true);
  assert.equal(preflight.phase42l_production_write_preflight_persisted, false);
  assert.equal(preflight.phase42k_pending_engine_candidate_creation_denial_accepted, true);
  assert.equal(preflight.explicit_production_write_preflight_detected, true);
  assert.equal(preflight.production_write_candidate_shape_verified, true);
  assert.equal(preflight.production_write_source_scope_verified, true);
  assert.equal(preflight.production_write_target_scope_verified, true);
  assert.equal(preflight.production_write_remains_not_executed, true);
  assert.equal(preflight.production_candidate_store_remains_not_mutated, true);
  assert.equal(preflight.production_write_preflight_preview_only, true);
  assert.equal(preflight.pending_engine_candidate_remains_not_created, true);
  assert.equal(preflight.approval_request_remains_not_created, true);
  assert.equal(preflight.guard_token_remains_unconsumed, true);
  validateApprovalRequestCandidate(preflight.approval_request_candidate);
  validatePendingEngineCandidate(preflight.pending_engine_candidate_candidate);
  validateProductionWriteCandidate(preflight.production_write_candidate);

  const expectedScopeHash = stableHash({
    production_write_id: preflight.production_write_candidate.production_write_id,
    source_candidate_id: preflight.production_write_candidate.source_candidate_id,
    request_scope: preflight.production_write_candidate.request_scope,
    source_store_scope: preflight.production_write_candidate.source_store_scope,
    target_store_scope: preflight.production_write_candidate.target_store_scope,
    write_mode: preflight.production_write_candidate.write_mode
  });
  assert.equal(preflight.production_write_scope_hash, expectedScopeHash);

  for (const field of [
    "executes_production_write",
    "mutates_production_candidate_store",
    "creates_pending_engine_candidate",
    "creates_approval_request",
    "promotes_production",
    "opens_gate",
    "consumes_guard_token",
    "executes_adoption",
    "executes_settlement",
    "updates_canon",
    "updates_active_engine",
    "creates_audit_receipt",
    "creates_backup_snapshot",
    "executes_rollback_restore"
  ]) {
    assert.equal(preflight.preflight_packet[field], false, `phase42lPreflight.preflight_packet.${field} must remain false`);
  }

  assert.equal(preflight.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(preflight.full_run_all_passed_claimed, false);
  assert.equal(preflight.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assertProtectedFalse(preflight, "phase42lPreflight");
}

function validateExecutionRequest(request) {
  assert.equal(request.kind, "production_candidate_store_write_execution_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "execute_production_write");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.production_write_execute, true, "explicit production write execution request must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.pending_engine_candidate_created, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.production_write_execution_allowed, false);
  return intent;
}

function buildProductionWriteExecutionDenial({
  preflight,
  request,
  state = makeBaselineState()
} = {}) {
  validatePhase42LPreflight(preflight);
  const intent = validateExecutionRequest(request);

  const denial = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "production_write_execution_denied_preview_only",
    mode: "production_write_execution_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42m_production_write_execution_denial_generated: true,
    phase42m_production_write_execution_denial_persisted: false,
    phase42l_production_write_preflight_accepted: true,
    explicit_production_write_execution_request_detected: intent.production_write_execute,
    production_write_execution_denied: true,
    production_write_execution_not_authorized: true,
    production_write_remains_not_executed: true,
    production_candidate_store_remains_not_mutated: true,
    denial_preview_only: true,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    approval_request_remains_not_created: true,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    pending_engine_candidate_remains_not_created: true,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    guard_token_remains_unconsumed: true,
    denial_blocks_production_promotion: true,
    denial_blocks_gate_open: true,
    adoption_blocked: true,
    settlement_blocked: true,
    canon_update_blocked: true,
    active_engine_update_blocked: true,
    audit_receipt_blocked: true,
    backup_snapshot_blocked: true,
    rollback_restore_blocked: true,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    request_intent: intent,
    production_write_candidate: preflight.production_write_candidate,
    production_write_scope_hash: preflight.production_write_scope_hash,
    denial_packet: {
      kind: "production_candidate_store_write_execution_denial_packet",
      denied_action: "execute_production_write",
      preview_only: true,
      production_write_execution_denied: true,
      production_write_execution_authorized: false,
      executes_production_write: false,
      mutates_production_candidate_store: false,
      creates_pending_engine_candidate: false,
      creates_approval_request: false,
      promotes_production: false,
      opens_gate: false,
      consumes_guard_token: false,
      executes_adoption: false,
      executes_settlement: false,
      updates_canon: false,
      updates_active_engine: false,
      creates_audit_receipt: false,
      creates_backup_snapshot: false,
      executes_rollback_restore: false
    },
    state_before: clone(state),
    state_after: clone(state),
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true
  };

  for (const field of DENIAL_TRUE_FIELDS) {
    assert.equal(denial[field], true, `${field} must be true in production write execution denial`);
  }

  assertProtectedFalse(denial, "denial");
  assertProtectedFalse(denial.state_before, "state_before");
  assertProtectedFalse(denial.state_after, "state_after");

  for (const field of [
    "production_write_execution_authorized",
    "executes_production_write",
    "mutates_production_candidate_store",
    "creates_pending_engine_candidate",
    "creates_approval_request",
    "promotes_production",
    "opens_gate",
    "consumes_guard_token",
    "executes_adoption",
    "executes_settlement",
    "updates_canon",
    "updates_active_engine",
    "creates_audit_receipt",
    "creates_backup_snapshot",
    "executes_rollback_restore"
  ]) {
    assert.equal(denial.denial_packet[field], false, `denial_packet.${field} must remain false`);
  }

  assert.deepEqual(denial.state_after, denial.state_before, "state snapshots must be value-equal");
  return Object.freeze(denial);
}

function assertThrowsWithMessage(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

{
  const result = buildProductionWriteExecutionDenial({
    preflight: makePhase42LProductionWritePreflight(),
    request: makeProductionWriteExecutionRequest()
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_write_execution_denied_preview_only");
  assert.equal(result.production_write_execution_denied, true);
  assert.equal(result.production_write_execution_not_authorized, true);
  assert.equal(result.production_candidate_store_write_executed, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
}

for (const previousOverride of [
  { accepted: false },
  { phase42l_production_write_preflight_generated: false },
  { explicit_production_write_preflight_detected: false },
  { production_write_candidate_shape_verified: false },
  { production_write_source_scope_verified: false },
  { production_write_target_scope_verified: false },
  { production_write_remains_not_executed: false },
  { production_candidate_store_remains_not_mutated: false },
  { pending_engine_candidate_remains_not_created: false },
  { approval_request_remains_not_created: false },
  { guard_token_remains_unconsumed: false }
]) {
  assertThrowsWithMessage(
    () => buildProductionWriteExecutionDenial({
      preflight: makePhase42LProductionWritePreflight(previousOverride),
      request: makeProductionWriteExecutionRequest()
    }),
    /Expected values to be strictly equal/
  );
}

for (const protectedOverride of [
  { pending_engine_candidate_created: true },
  { approval_request_created: true },
  { production_candidate_store_mutated: true },
  { production_candidate_store_write_executed: true },
  { production_candidate_store_promotion_executed: true },
  { production_promotion_gate_opened: true },
  { guard_token_consumed: true },
  { adoption_executed: true },
  { settlement_executed: true },
  { canon_updated: true },
  { active_engine_updated: true },
  { audit_receipt_created: true },
  { backup_snapshot_created: true },
  { rollback_restore_executed: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionWriteExecutionDenial({
      preflight: makePhase42LProductionWritePreflight(protectedOverride),
      request: makeProductionWriteExecutionRequest()
    }),
    /must remain false/
  );
}

assertThrowsWithMessage(
  () => buildProductionWriteExecutionDenial({
    preflight: makePhase42LProductionWritePreflight({
      full_run_all_status: "passed",
      full_run_all_passed_claimed: true
    }),
    request: makeProductionWriteExecutionRequest()
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionWriteExecutionDenial({
    preflight: makePhase42LProductionWritePreflight(),
    request: makeProductionWriteExecutionRequest({ explicit: false })
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionWriteExecutionDenial({
    preflight: makePhase42LProductionWritePreflight(),
    request: makeProductionWriteExecutionRequest({
      text: "Only inspect the production write preflight packet without requesting execution."
    })
  }),
  /explicit production write execution request must be detectable/
);

for (const authorizationOverride of [
  { operator_confirmed: false },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { guard_token_consumed: true },
  { production_gate_opened: true },
  { production_write_execution_allowed: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionWriteExecutionDenial({
      preflight: makePhase42LProductionWritePreflight(),
      request: makeProductionWriteExecutionRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          pending_engine_candidate_created: false,
          guard_token_consumed: false,
          production_gate_opened: false,
          production_write_execution_allowed: false,
          ...authorizationOverride
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

for (const candidateOverride of [
  { preview_only: false },
  { execution_allowed: true },
  { executed: true },
  { mutates_store: true },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { guard_token_consumed: true },
  { production_gate_opened: true },
  { source_store_scope: "pending_engine_candidate_store" },
  { target_store_scope: "active_engine" },
  { write_mode: "execute" },
  { grants_production_promotion: true },
  { grants_gate_open: true },
  { grants_adoption: true },
  { grants_settlement: true },
  { grants_canon_update: true },
  { grants_active_engine_update: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionWriteExecutionDenial({
      preflight: makePhase42LProductionWritePreflight({
        production_write_candidate: candidateOverride
      }),
      request: makeProductionWriteExecutionRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  const riskyText = [
    "Execute production write now.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Production promotion should follow.",
    "Open production gate.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create audit receipt, create backup snapshot, execute rollback.",
    "Claim full run-all passed."
  ].join(" ");

  const result = buildProductionWriteExecutionDenial({
    preflight: makePhase42LProductionWritePreflight(),
    request: makeProductionWriteExecutionRequest({ text: riskyText })
  });

  for (const field of [
    "production_write_execute",
    "pending_engine_candidate_create",
    "approval_request_create",
    "production_promotion",
    "gate_open",
    "guard_token_consume",
    "adoption",
    "settlement",
    "canon_update",
    "active_engine_update",
    "audit_receipt_create",
    "backup_snapshot_create",
    "rollback_restore_execute",
    "full_run_all_passed_claim"
  ]) {
    assert.equal(result.request_intent[field], true, `request_intent.${field} must be detected`);
  }

  assertProtectedFalse(result, "riskyResult");
}

console.log("Phase42M production candidate store promotion gate production write execution denial smoke tests passed.");
