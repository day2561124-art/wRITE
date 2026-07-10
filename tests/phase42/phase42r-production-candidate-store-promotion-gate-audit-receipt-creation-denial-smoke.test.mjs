import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42R";
const CURRENT_PHASE_SLUG = "phase42r-production-candidate-store-promotion-gate-audit-receipt-creation-denial-smoke";
const PREVIOUS_PHASE = "Phase42Q";
const PREVIOUS_PHASE_SLUG = "phase42q-production-candidate-store-promotion-gate-production-gate-open-execution-denial-smoke";
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
  "audit_receipt_creation_authorized",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "full_run_all_passed_claimed"
];

const DENIAL_TRUE_FIELDS = [
  "phase42r_audit_receipt_creation_denial_generated",
  "phase42q_production_gate_open_execution_denial_accepted",
  "explicit_audit_receipt_creation_request_detected",
  "audit_receipt_creation_denied",
  "audit_receipt_creation_not_authorized",
  "audit_receipt_remains_not_created",
  "production_gate_remains_closed",
  "guard_token_remains_unconsumed",
  "production_promotion_remains_not_executed",
  "production_write_remains_not_executed",
  "production_candidate_store_remains_not_mutated",
  "approval_request_remains_not_created",
  "pending_engine_candidate_remains_not_created",
  "denial_preview_only",
  "denial_blocks_adoption",
  "denial_blocks_settlement",
  "canon_update_blocked",
  "active_engine_update_blocked",
  "backup_snapshot_blocked",
  "rollback_restore_blocked",
  "full_run_all_pending_status_preserved"
];

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
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeBaselineState(overrides = {}) {
  return Object.freeze({
    approval_request_created: false,
    approval_request_creation_authorized: false,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    audit_receipt_created: false,
    audit_receipt_creation_authorized: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    ...overrides
  });
}

function makePhase42QGateOpenExecutionDenial(overrides = {}) {
  const sourceState = makeBaselineState(overrides.state_before ?? {});
  const stateAfter = clone(overrides.state_after ?? sourceState);

  const denialPacket = {
    kind: "production_candidate_store_promotion_gate_open_execution_denial_packet",
    denied_action: "execute_production_gate_open",
    preview_only: true,
    production_gate_open_execution_denied: true,
    production_gate_open_execution_authorized: false,
    verifies_prior_preflight: true,
    verifies_prerequisite_promotion_denial: true,
    verifies_prerequisite_write_denial: true,
    verifies_approval_request_absent: true,
    verifies_pending_engine_candidate_absent: true,
    verifies_guard_token_unconsumed: true,
    executes_production_write: false,
    executes_production_promotion: false,
    mutates_production_candidate_store: false,
    creates_pending_engine_candidate: false,
    creates_approval_request: false,
    opens_gate: false,
    consumes_guard_token: false,
    executes_adoption: false,
    executes_settlement: false,
    updates_canon: false,
    updates_active_engine: false,
    creates_audit_receipt: false,
    creates_backup_snapshot: false,
    executes_rollback_restore: false,
    ...(overrides.denial_packet ?? {})
  };

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    source_phase: "Phase42P",
    source_phase_slug: "phase42p-production-candidate-store-promotion-gate-production-gate-open-preflight-boundary-smoke",
    accepted: true,
    reason: "production_gate_open_execution_denied_preview_only",
    mode: "production_gate_open_execution_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42q_production_gate_open_execution_denial_generated: true,
    phase42q_production_gate_open_execution_denial_persisted: false,
    phase42p_production_gate_open_preflight_accepted: true,
    explicit_production_gate_open_execution_request_detected: true,
    production_gate_open_execution_denied: true,
    production_gate_open_execution_not_authorized: true,
    production_gate_remains_closed: true,
    production_promotion_remains_not_executed: true,
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
    denial_blocks_adoption: true,
    denial_blocks_settlement: true,
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
    audit_receipt_creation_authorized: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    denial_packet: denialPacket,
    state_before: clone(sourceState),
    state_after: stateAfter,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true,
    ...overrides,
    denial_packet: denialPacket,
    state_before: clone(sourceState),
    state_after: stateAfter
  });
}

function makeAuditReceiptCandidate(sourceDenial, overrides = {}) {
  const sourceContractHash = stableHash({
    phase: sourceDenial.phase,
    phase_slug: sourceDenial.phase_slug,
    reason: sourceDenial.reason,
    mode: sourceDenial.mode,
    production_gate_open_execution_denied: sourceDenial.production_gate_open_execution_denied,
    production_gate_remains_closed: sourceDenial.production_gate_remains_closed,
    guard_token_remains_unconsumed: sourceDenial.guard_token_remains_unconsumed,
    production_candidate_store_remains_not_mutated: sourceDenial.production_candidate_store_remains_not_mutated
  });

  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_audit_receipt_candidate",
    audit_receipt_id: "phase42r-production-candidate-store-promotion-gate-audit-receipt-preview",
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    source_denial_reason: sourceDenial.reason,
    source_denial_mode: sourceDenial.mode,
    source_contract_hash: sourceContractHash,
    request_scope: "production_candidate_store_promotion_gate",
    audit_scope: "production_gate_open_execution_denial",
    receipt_mode: "denial_preview_only",
    preview_only: true,
    creation_allowed: false,
    created: false,
    persisted: false,
    records_audit_event: false,
    mutates_store: false,
    opens_gate: false,
    consumes_guard_token: false,
    creates_approval_request: false,
    creates_pending_engine_candidate: false,
    executes_production_write: false,
    executes_production_promotion: false,
    executes_adoption: false,
    executes_settlement: false,
    updates_canon: false,
    updates_active_engine: false,
    creates_backup_snapshot: false,
    executes_rollback_restore: false,
    ...overrides
  });
}

function makeAuditReceiptCreationRequest(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_audit_receipt_creation_request",
    explicit: true,
    text: [
      "Create the audit receipt for the Phase42Q production gate open execution denial.",
      "This is an explicit audit receipt creation request.",
      "The audit receipt creation request must be denied and no audit receipt may be created.",
      "Keep the production gate closed and the guard token unconsumed.",
      "Keep production promotion and production write unexecuted.",
      "Keep the production candidate store unchanged.",
      "Do not create approval request or pending engine candidate.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create backup snapshot or execute rollback restore.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "create_audit_receipt",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      phase42q_denial_accepted: true,
      audit_receipt_creation_allowed: false,
      production_gate_opened: false,
      guard_token_consumed: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      production_write_executed: false,
      production_promotion_executed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    audit_receipt_create: /\b(create|make|issue|persist|record)\b[\s\S]*\baudit receipt\b/i.test(text) ||
      /\baudit receipt\b[\s\S]*\b(create|make|issue|persist|record)\b/i.test(text),
    gate_open_execute: /\b(open|execute|perform|commit)\b[\s\S]*\bproduction gate\b/i.test(text) ||
      /\bproduction gate\b[\s\S]*\b(open|execute|perform|commit)\b/i.test(text),
    production_promotion_execute: /\b(execute|perform|commit|promote)\b[\s\S]*\bproduction promotion\b/i.test(text) ||
      /\bproduction promotion\b[\s\S]*\b(execute|perform|commit|promote)\b/i.test(text),
    production_write_execute: /\b(execute|perform|commit)\b[\s\S]*\bproduction write\b/i.test(text) ||
      /\bproduction write\b[\s\S]*\b(execute|perform|commit)\b/i.test(text),
    pending_engine_candidate_create: /\b(create|make|open)\b[\s\S]*\bpending engine candidate\b/i.test(text),
    approval_request_create: /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text),
    guard_token_consume: /\bconsume\b[\s\S]*\bguard token\b/i.test(text),
    adoption: /\badoption\b|\badopt\b/i.test(text),
    settlement: /\bsettlement\b|\bsettle\b/i.test(text),
    canon_update: /\bupdate\b[\s\S]*\bCanon\b/i.test(text),
    active_engine_update: /\bupdate\b[\s\S]*\bactive_engine\b/i.test(text),
    backup_snapshot_create: /\b(create|make)\b[\s\S]*\bbackup snapshot\b/i.test(text),
    rollback_restore_execute: /\bexecute\b[\s\S]*\brollback\b/i.test(text) ||
      /\brollback\b[\s\S]*\brestore\b/i.test(text),
    full_run_all_passed_claim: /\bfull run-all passed\b/i.test(text) || /\bfull_run_all_passed\b/i.test(text)
  });
}

function assertProtectedFalse(target, label) {
  for (const field of PROTECTED_FALSE_FIELDS) {
    assert.equal(target[field], false, `${label}.${field} must remain false`);
  }
}

function validatePhase42QDenial(sourceDenial) {
  assert.equal(sourceDenial.phase, PREVIOUS_PHASE);
  assert.equal(sourceDenial.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(sourceDenial.accepted, true);
  assert.equal(sourceDenial.reason, "production_gate_open_execution_denied_preview_only");
  assert.equal(sourceDenial.mode, "production_gate_open_execution_denial_smoke");
  assert.equal(sourceDenial.preview_only, true);
  assert.equal(sourceDenial.persisted, false);
  assert.equal(sourceDenial.phase42q_production_gate_open_execution_denial_generated, true);
  assert.equal(sourceDenial.phase42q_production_gate_open_execution_denial_persisted, false);
  assert.equal(sourceDenial.phase42p_production_gate_open_preflight_accepted, true);
  assert.equal(sourceDenial.explicit_production_gate_open_execution_request_detected, true);
  assert.equal(sourceDenial.production_gate_open_execution_denied, true);
  assert.equal(sourceDenial.production_gate_open_execution_not_authorized, true);
  assert.equal(sourceDenial.production_gate_remains_closed, true);
  assert.equal(sourceDenial.production_promotion_remains_not_executed, true);
  assert.equal(sourceDenial.production_write_remains_not_executed, true);
  assert.equal(sourceDenial.production_candidate_store_remains_not_mutated, true);
  assert.equal(sourceDenial.denial_preview_only, true);
  assert.equal(sourceDenial.approval_request_remains_not_created, true);
  assert.equal(sourceDenial.pending_engine_candidate_remains_not_created, true);
  assert.equal(sourceDenial.guard_token_remains_unconsumed, true);
  assert.equal(sourceDenial.denial_blocks_adoption, true);
  assert.equal(sourceDenial.denial_blocks_settlement, true);
  assert.equal(sourceDenial.canon_update_blocked, true);
  assert.equal(sourceDenial.active_engine_update_blocked, true);
  assert.equal(sourceDenial.audit_receipt_blocked, true);
  assert.equal(sourceDenial.backup_snapshot_blocked, true);
  assert.equal(sourceDenial.rollback_restore_blocked, true);
  assert.equal(sourceDenial.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(sourceDenial.full_run_all_passed_claimed, false);
  assert.equal(sourceDenial.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assert.equal(sourceDenial.full_run_all_pending_status_preserved, true);

  assert.equal(sourceDenial.denial_packet.kind, "production_candidate_store_promotion_gate_open_execution_denial_packet");
  assert.equal(sourceDenial.denial_packet.denied_action, "execute_production_gate_open");
  assert.equal(sourceDenial.denial_packet.preview_only, true);
  assert.equal(sourceDenial.denial_packet.production_gate_open_execution_denied, true);
  assert.equal(sourceDenial.denial_packet.production_gate_open_execution_authorized, false);

  for (const field of [
    "verifies_prior_preflight",
    "verifies_prerequisite_promotion_denial",
    "verifies_prerequisite_write_denial",
    "verifies_approval_request_absent",
    "verifies_pending_engine_candidate_absent",
    "verifies_guard_token_unconsumed"
  ]) {
    assert.equal(sourceDenial.denial_packet[field], true, `sourceDenial.denial_packet.${field} must be true`);
  }

  for (const field of [
    "executes_production_write",
    "executes_production_promotion",
    "mutates_production_candidate_store",
    "creates_pending_engine_candidate",
    "creates_approval_request",
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
    assert.equal(sourceDenial.denial_packet[field], false, `sourceDenial.denial_packet.${field} must remain false`);
  }

  assertProtectedFalse(sourceDenial, "sourceDenial");
  assertProtectedFalse(sourceDenial.state_before, "sourceDenial.state_before");
  assertProtectedFalse(sourceDenial.state_after, "sourceDenial.state_after");
  assert.deepEqual(sourceDenial.state_after, sourceDenial.state_before, "Phase42Q state snapshots must be value-equal");
}

function validateAuditReceiptCandidate(candidate, sourceDenial) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_gate_audit_receipt_candidate");
  assert.equal(candidate.source_phase, PREVIOUS_PHASE);
  assert.equal(candidate.source_phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(candidate.source_denial_reason, sourceDenial.reason);
  assert.equal(candidate.source_denial_mode, sourceDenial.mode);
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.audit_scope, "production_gate_open_execution_denial");
  assert.equal(candidate.receipt_mode, "denial_preview_only");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.persisted, false);
  assert.equal(candidate.records_audit_event, false);
  assert.equal(candidate.mutates_store, false);

  for (const field of [
    "opens_gate",
    "consumes_guard_token",
    "creates_approval_request",
    "creates_pending_engine_candidate",
    "executes_production_write",
    "executes_production_promotion",
    "executes_adoption",
    "executes_settlement",
    "updates_canon",
    "updates_active_engine",
    "creates_backup_snapshot",
    "executes_rollback_restore"
  ]) {
    assert.equal(candidate[field], false, `candidate.${field} must remain false`);
  }

  const expectedSourceContractHash = stableHash({
    phase: sourceDenial.phase,
    phase_slug: sourceDenial.phase_slug,
    reason: sourceDenial.reason,
    mode: sourceDenial.mode,
    production_gate_open_execution_denied: sourceDenial.production_gate_open_execution_denied,
    production_gate_remains_closed: sourceDenial.production_gate_remains_closed,
    guard_token_remains_unconsumed: sourceDenial.guard_token_remains_unconsumed,
    production_candidate_store_remains_not_mutated: sourceDenial.production_candidate_store_remains_not_mutated
  });
  assert.equal(candidate.source_contract_hash, expectedSourceContractHash);
}

function validateAuditReceiptCreationRequest(request) {
  assert.equal(request.kind, "production_candidate_store_promotion_gate_audit_receipt_creation_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "create_audit_receipt");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.audit_receipt_create, true, "explicit audit receipt creation request must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.phase42q_denial_accepted, true);
  assert.equal(request.authorization.audit_receipt_creation_allowed, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.pending_engine_candidate_created, false);
  assert.equal(request.authorization.production_write_executed, false);
  assert.equal(request.authorization.production_promotion_executed, false);
  return intent;
}

function buildAuditReceiptCreationDenial({
  sourceDenial,
  request,
  state = makeBaselineState(),
  auditReceiptCandidateOverrides = {}
} = {}) {
  validatePhase42QDenial(sourceDenial);
  const intent = validateAuditReceiptCreationRequest(request);
  assertProtectedFalse(state, "state");
  assert.equal(state.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(state.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);

  const auditReceiptCandidate = makeAuditReceiptCandidate(sourceDenial, auditReceiptCandidateOverrides);
  validateAuditReceiptCandidate(auditReceiptCandidate, sourceDenial);

  const auditReceiptScopeHash = stableHash({
    audit_receipt_id: auditReceiptCandidate.audit_receipt_id,
    source_phase: auditReceiptCandidate.source_phase,
    source_phase_slug: auditReceiptCandidate.source_phase_slug,
    source_contract_hash: auditReceiptCandidate.source_contract_hash,
    request_scope: auditReceiptCandidate.request_scope,
    audit_scope: auditReceiptCandidate.audit_scope,
    receipt_mode: auditReceiptCandidate.receipt_mode,
    creation_allowed: auditReceiptCandidate.creation_allowed,
    created: auditReceiptCandidate.created,
    persisted: auditReceiptCandidate.persisted
  });

  const denial = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "audit_receipt_creation_denied_preview_only",
    mode: "audit_receipt_creation_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42r_audit_receipt_creation_denial_generated: true,
    phase42r_audit_receipt_creation_denial_persisted: false,
    phase42q_production_gate_open_execution_denial_accepted: true,
    explicit_audit_receipt_creation_request_detected: intent.audit_receipt_create,
    audit_receipt_creation_denied: true,
    audit_receipt_creation_not_authorized: true,
    audit_receipt_remains_not_created: true,
    audit_receipt_created: false,
    audit_receipt_creation_authorized: false,
    production_gate_remains_closed: true,
    production_promotion_remains_not_executed: true,
    production_write_remains_not_executed: true,
    production_candidate_store_remains_not_mutated: true,
    approval_request_remains_not_created: true,
    pending_engine_candidate_remains_not_created: true,
    guard_token_remains_unconsumed: true,
    denial_preview_only: true,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    denial_blocks_adoption: true,
    denial_blocks_settlement: true,
    canon_update_blocked: true,
    active_engine_update_blocked: true,
    backup_snapshot_blocked: true,
    rollback_restore_blocked: true,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    request_intent: intent,
    audit_receipt_candidate: auditReceiptCandidate,
    audit_receipt_scope_hash: auditReceiptScopeHash,
    denial_packet: {
      kind: "production_candidate_store_promotion_gate_audit_receipt_creation_denial_packet",
      denied_action: "create_audit_receipt",
      preview_only: true,
      audit_receipt_creation_denied: true,
      audit_receipt_creation_authorized: false,
      verifies_phase42q_gate_open_execution_denial: true,
      verifies_production_gate_closed: true,
      verifies_guard_token_unconsumed: true,
      verifies_production_store_unchanged: true,
      verifies_approval_request_absent: true,
      verifies_pending_engine_candidate_absent: true,
      creates_audit_receipt: false,
      persists_audit_receipt: false,
      records_audit_event: false,
      executes_production_write: false,
      executes_production_promotion: false,
      mutates_production_candidate_store: false,
      creates_pending_engine_candidate: false,
      creates_approval_request: false,
      opens_gate: false,
      consumes_guard_token: false,
      executes_adoption: false,
      executes_settlement: false,
      updates_canon: false,
      updates_active_engine: false,
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
    assert.equal(denial[field], true, `${field} must be true in audit receipt creation denial`);
  }

  assertProtectedFalse(denial, "denial");
  assertProtectedFalse(denial.state_before, "denial.state_before");
  assertProtectedFalse(denial.state_after, "denial.state_after");

  for (const field of [
    "verifies_phase42q_gate_open_execution_denial",
    "verifies_production_gate_closed",
    "verifies_guard_token_unconsumed",
    "verifies_production_store_unchanged",
    "verifies_approval_request_absent",
    "verifies_pending_engine_candidate_absent"
  ]) {
    assert.equal(denial.denial_packet[field], true, `denial.denial_packet.${field} must be true`);
  }

  for (const field of [
    "audit_receipt_creation_authorized",
    "creates_audit_receipt",
    "persists_audit_receipt",
    "records_audit_event",
    "executes_production_write",
    "executes_production_promotion",
    "mutates_production_candidate_store",
    "creates_pending_engine_candidate",
    "creates_approval_request",
    "opens_gate",
    "consumes_guard_token",
    "executes_adoption",
    "executes_settlement",
    "updates_canon",
    "updates_active_engine",
    "creates_backup_snapshot",
    "executes_rollback_restore"
  ]) {
    assert.equal(denial.denial_packet[field], false, `denial.denial_packet.${field} must remain false`);
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
  const result = buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial(),
    request: makeAuditReceiptCreationRequest()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "audit_receipt_creation_denied_preview_only");
  assert.equal(result.audit_receipt_creation_denied, true);
  assert.equal(result.audit_receipt_creation_not_authorized, true);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.production_candidate_store_promotion_executed, false);
  assert.equal(result.production_candidate_store_write_executed, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_executed, false);
}

for (const previousOverride of [
  { accepted: false },
  { phase42q_production_gate_open_execution_denial_generated: false },
  { phase42q_production_gate_open_execution_denial_persisted: true },
  { phase42p_production_gate_open_preflight_accepted: false },
  { explicit_production_gate_open_execution_request_detected: false },
  { production_gate_open_execution_denied: false },
  { production_gate_open_execution_not_authorized: false },
  { production_gate_remains_closed: false },
  { production_promotion_remains_not_executed: false },
  { production_write_remains_not_executed: false },
  { production_candidate_store_remains_not_mutated: false },
  { approval_request_remains_not_created: false },
  { pending_engine_candidate_remains_not_created: false },
  { guard_token_remains_unconsumed: false },
  { denial_blocks_adoption: false },
  { denial_blocks_settlement: false },
  { canon_update_blocked: false },
  { active_engine_update_blocked: false },
  { audit_receipt_blocked: false },
  { backup_snapshot_blocked: false },
  { rollback_restore_blocked: false },
  { full_run_all_pending_status_preserved: false }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial(previousOverride),
      request: makeAuditReceiptCreationRequest()
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

for (const protectedOverride of [
  { approval_request_created: true },
  { approval_request_creation_authorized: true },
  { pending_engine_candidate_created: true },
  { pending_engine_candidate_creation_authorized: true },
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
  { audit_receipt_creation_authorized: true },
  { backup_snapshot_created: true },
  { rollback_restore_executed: true }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial(protectedOverride),
      request: makeAuditReceiptCreationRequest()
    }),
    /must remain false/
  );
}

for (const packetOverride of [
  { production_gate_open_execution_authorized: true },
  { verifies_prior_preflight: false },
  { verifies_prerequisite_promotion_denial: false },
  { verifies_prerequisite_write_denial: false },
  { verifies_approval_request_absent: false },
  { verifies_pending_engine_candidate_absent: false },
  { verifies_guard_token_unconsumed: false },
  { executes_production_write: true },
  { executes_production_promotion: true },
  { mutates_production_candidate_store: true },
  { creates_pending_engine_candidate: true },
  { creates_approval_request: true },
  { opens_gate: true },
  { consumes_guard_token: true },
  { executes_adoption: true },
  { executes_settlement: true },
  { updates_canon: true },
  { updates_active_engine: true },
  { creates_audit_receipt: true },
  { creates_backup_snapshot: true },
  { executes_rollback_restore: true }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial({ denial_packet: packetOverride }),
      request: makeAuditReceiptCreationRequest()
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

assertThrowsWithMessage(
  () => buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial({
      state_after: { ...makeBaselineState(), audit_receipt_created: true }
    }),
    request: makeAuditReceiptCreationRequest()
  }),
  /must remain false/
);

assertThrowsWithMessage(
  () => buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial({
      state_after: { ...makeBaselineState(), full_run_all_pending_message: "changed" }
    }),
    request: makeAuditReceiptCreationRequest()
  }),
  /value-equal/
);

assertThrowsWithMessage(
  () => buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial({
      full_run_all_status: "passed",
      full_run_all_passed_claimed: true
    }),
    request: makeAuditReceiptCreationRequest()
  }),
  /Expected values to be strictly equal|must be true|must remain false/
);

assertThrowsWithMessage(
  () => buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial(),
    request: makeAuditReceiptCreationRequest({ explicit: false })
  }),
  /Expected values to be strictly equal|must be true|must remain false/
);

assertThrowsWithMessage(
  () => buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial(),
    request: makeAuditReceiptCreationRequest({
      text: "Only inspect the Phase42Q denial packet without requesting any audit action."
    })
  }),
  /explicit audit receipt creation request must be detectable/
);

for (const authorizationOverride of [
  { operator_confirmed: false },
  { phase42q_denial_accepted: false },
  { audit_receipt_creation_allowed: true },
  { production_gate_opened: true },
  { guard_token_consumed: true },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { production_write_executed: true },
  { production_promotion_executed: true }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial(),
      request: makeAuditReceiptCreationRequest({
        authorization: {
          operator_confirmed: true,
          phase42q_denial_accepted: true,
          audit_receipt_creation_allowed: false,
          production_gate_opened: false,
          guard_token_consumed: false,
          approval_request_created: false,
          pending_engine_candidate_created: false,
          production_write_executed: false,
          production_promotion_executed: false,
          ...authorizationOverride
        }
      })
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

for (const candidateOverride of [
  { preview_only: false },
  { creation_allowed: true },
  { created: true },
  { persisted: true },
  { records_audit_event: true },
  { mutates_store: true },
  { receipt_mode: "persist" },
  { request_scope: "active_engine" },
  { audit_scope: "settlement" },
  { opens_gate: true },
  { consumes_guard_token: true },
  { creates_approval_request: true },
  { creates_pending_engine_candidate: true },
  { executes_production_write: true },
  { executes_production_promotion: true },
  { executes_adoption: true },
  { executes_settlement: true },
  { updates_canon: true },
  { updates_active_engine: true },
  { creates_backup_snapshot: true },
  { executes_rollback_restore: true },
  { source_phase: "Phase42P" },
  { source_phase_slug: "wrong-source" },
  { source_denial_reason: "wrong-reason" },
  { source_denial_mode: "wrong-mode" },
  { source_contract_hash: "tampered" }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial(),
      request: makeAuditReceiptCreationRequest(),
      auditReceiptCandidateOverrides: candidateOverride
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

for (const stateOverride of [
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
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
  { audit_receipt_creation_authorized: true },
  { backup_snapshot_created: true },
  { rollback_restore_executed: true },
  { full_run_all_passed_claimed: true }
]) {
  assertThrowsWithMessage(
    () => buildAuditReceiptCreationDenial({
      sourceDenial: makePhase42QGateOpenExecutionDenial(),
      request: makeAuditReceiptCreationRequest(),
      state: makeBaselineState(stateOverride)
    }),
    /must remain false/
  );
}

{
  const riskyText = [
    "Create audit receipt now.",
    "Open production gate.",
    "Execute production promotion.",
    "Execute production write.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create backup snapshot and execute rollback restore.",
    "Claim full run-all passed."
  ].join(" ");

  const result = buildAuditReceiptCreationDenial({
    sourceDenial: makePhase42QGateOpenExecutionDenial(),
    request: makeAuditReceiptCreationRequest({ text: riskyText })
  });

  for (const field of [
    "audit_receipt_create",
    "gate_open_execute",
    "production_promotion_execute",
    "production_write_execute",
    "pending_engine_candidate_create",
    "approval_request_create",
    "guard_token_consume",
    "adoption",
    "settlement",
    "canon_update",
    "active_engine_update",
    "backup_snapshot_create",
    "rollback_restore_execute",
    "full_run_all_passed_claim"
  ]) {
    assert.equal(result.request_intent[field], true, `request_intent.${field} must be detected`);
  }

  assertProtectedFalse(result, "riskyResult");
  assert.equal(result.audit_receipt_remains_not_created, true);
  assert.equal(result.production_gate_remains_closed, true);
  assert.equal(result.guard_token_remains_unconsumed, true);
  assert.deepEqual(result.state_after, result.state_before);
}

console.log("Phase42R production candidate store promotion gate audit receipt creation denial smoke tests passed.");
