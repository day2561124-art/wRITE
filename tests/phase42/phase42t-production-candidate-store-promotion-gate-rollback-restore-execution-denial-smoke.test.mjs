import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42T";
const CURRENT_PHASE_SLUG = "phase42t-production-candidate-store-promotion-gate-rollback-restore-execution-denial-smoke";
const PREVIOUS_PHASE = "Phase42S";
const PREVIOUS_PHASE_SLUG = "phase42s-production-candidate-store-promotion-gate-backup-snapshot-creation-denial-smoke";
const AUDIT_PHASE = "Phase42R";
const AUDIT_PHASE_SLUG = "phase42r-production-candidate-store-promotion-gate-audit-receipt-creation-denial-smoke";
const GATE_DENIAL_PHASE = "Phase42Q";
const GATE_DENIAL_PHASE_SLUG = "phase42q-production-candidate-store-promotion-gate-production-gate-open-execution-denial-smoke";
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
  "backup_snapshot_creation_authorized",
  "rollback_restore_executed",
  "rollback_restore_execution_authorized",
  "full_run_all_passed_claimed"
];

const DENIAL_TRUE_FIELDS = [
  "phase42t_rollback_restore_execution_denial_generated",
  "phase42s_backup_snapshot_creation_denial_accepted",
  "explicit_rollback_restore_execution_request_detected",
  "rollback_restore_execution_denied",
  "rollback_restore_execution_not_authorized",
  "rollback_restore_remains_not_executed",
  "backup_snapshot_remains_not_created",
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
    backup_snapshot_creation_authorized: false,
    rollback_restore_executed: false,
    rollback_restore_execution_authorized: false,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    ...overrides
  });
}

function makePhase42RAuditReceiptCandidate(overrides = {}) {
  const sourceContractHash = stableHash({
    phase: GATE_DENIAL_PHASE,
    phase_slug: GATE_DENIAL_PHASE_SLUG,
    reason: "production_gate_open_execution_denied_preview_only",
    mode: "production_gate_open_execution_denial_smoke",
    production_gate_open_execution_denied: true,
    production_gate_remains_closed: true,
    guard_token_remains_unconsumed: true,
    production_candidate_store_remains_not_mutated: true
  });

  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_audit_receipt_candidate",
    audit_receipt_id: "phase42r-production-candidate-store-promotion-gate-audit-receipt-preview",
    source_phase: GATE_DENIAL_PHASE,
    source_phase_slug: GATE_DENIAL_PHASE_SLUG,
    source_denial_reason: "production_gate_open_execution_denied_preview_only",
    source_denial_mode: "production_gate_open_execution_denial_smoke",
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

function makePhase42SBackupSnapshotCandidate(overrides = {}) {
  const sourceContractHash = stableHash({
    phase: AUDIT_PHASE,
    phase_slug: AUDIT_PHASE_SLUG,
    reason: "audit_receipt_creation_denied_preview_only",
    mode: "audit_receipt_creation_denial_smoke",
    audit_receipt_creation_denied: true,
    audit_receipt_remains_not_created: true,
    production_gate_remains_closed: true,
    guard_token_remains_unconsumed: true,
    production_candidate_store_remains_not_mutated: true
  });

  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_backup_snapshot_candidate",
    backup_snapshot_id: "phase42s-production-candidate-store-promotion-gate-backup-snapshot-preview",
    source_phase: AUDIT_PHASE,
    source_phase_slug: AUDIT_PHASE_SLUG,
    source_denial_reason: "audit_receipt_creation_denied_preview_only",
    source_denial_mode: "audit_receipt_creation_denial_smoke",
    source_contract_hash: sourceContractHash,
    request_scope: "production_candidate_store_promotion_gate",
    backup_scope: "audit_receipt_creation_denial",
    snapshot_mode: "denial_preview_only",
    preview_only: true,
    creation_allowed: false,
    created: false,
    persisted: false,
    captures_state: false,
    writes_backup_storage: false,
    includes_audit_receipt: false,
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
    creates_audit_receipt: false,
    executes_rollback_restore: false,
    ...overrides
  });
}

function makePhase42SBackupSnapshotCreationDenial(overrides = {}) {
  const sourceState = makeBaselineState(overrides.state_before ?? {});
  const stateAfter = clone(overrides.state_after ?? sourceState);
  const auditReceiptCandidate = makePhase42RAuditReceiptCandidate(
    overrides.audit_receipt_candidate ?? {}
  );
  const backupSnapshotCandidate = makePhase42SBackupSnapshotCandidate(
    overrides.backup_snapshot_candidate ?? {}
  );

  const denialPacket = {
    kind: "production_candidate_store_promotion_gate_backup_snapshot_creation_denial_packet",
    denied_action: "create_backup_snapshot",
    preview_only: true,
    backup_snapshot_creation_denied: true,
    backup_snapshot_creation_authorized: false,
    verifies_phase42r_audit_receipt_creation_denial: true,
    verifies_audit_receipt_absent: true,
    verifies_production_gate_closed: true,
    verifies_guard_token_unconsumed: true,
    verifies_production_store_unchanged: true,
    verifies_approval_request_absent: true,
    verifies_pending_engine_candidate_absent: true,
    creates_backup_snapshot: false,
    persists_backup_snapshot: false,
    captures_state: false,
    writes_backup_storage: false,
    creates_audit_receipt: false,
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
    executes_rollback_restore: false,
    ...(overrides.denial_packet ?? {})
  };

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    source_phase: AUDIT_PHASE,
    source_phase_slug: AUDIT_PHASE_SLUG,
    accepted: true,
    reason: "backup_snapshot_creation_denied_preview_only",
    mode: "backup_snapshot_creation_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42s_backup_snapshot_creation_denial_generated: true,
    phase42s_backup_snapshot_creation_denial_persisted: false,
    phase42r_audit_receipt_creation_denial_accepted: true,
    explicit_backup_snapshot_creation_request_detected: true,
    backup_snapshot_creation_denied: true,
    backup_snapshot_creation_not_authorized: true,
    backup_snapshot_remains_not_created: true,
    backup_snapshot_created: false,
    backup_snapshot_creation_authorized: false,
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
    rollback_restore_blocked: true,
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    rollback_restore_executed: false,
    rollback_restore_execution_authorized: false,
    audit_receipt_candidate: auditReceiptCandidate,
    backup_snapshot_candidate: backupSnapshotCandidate,
    backup_snapshot_scope_hash: stableHash({
      backup_snapshot_id: backupSnapshotCandidate.backup_snapshot_id,
      source_phase: backupSnapshotCandidate.source_phase,
      source_phase_slug: backupSnapshotCandidate.source_phase_slug,
      source_contract_hash: backupSnapshotCandidate.source_contract_hash,
      request_scope: backupSnapshotCandidate.request_scope,
      backup_scope: backupSnapshotCandidate.backup_scope,
      snapshot_mode: backupSnapshotCandidate.snapshot_mode,
      creation_allowed: backupSnapshotCandidate.creation_allowed,
      created: backupSnapshotCandidate.created,
      persisted: backupSnapshotCandidate.persisted
    }),
    denial_packet: denialPacket,
    state_before: clone(sourceState),
    state_after: stateAfter,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true,
    ...overrides,
    audit_receipt_candidate: auditReceiptCandidate,
    backup_snapshot_candidate: backupSnapshotCandidate,
    denial_packet: denialPacket,
    state_before: clone(sourceState),
    state_after: stateAfter
  });
}

function makeRollbackRestoreCandidate(sourceDenial, overrides = {}) {
  const sourceContractHash = stableHash({
    phase: sourceDenial.phase,
    phase_slug: sourceDenial.phase_slug,
    reason: sourceDenial.reason,
    mode: sourceDenial.mode,
    backup_snapshot_creation_denied: sourceDenial.backup_snapshot_creation_denied,
    backup_snapshot_remains_not_created: sourceDenial.backup_snapshot_remains_not_created,
    audit_receipt_remains_not_created: sourceDenial.audit_receipt_remains_not_created,
    production_gate_remains_closed: sourceDenial.production_gate_remains_closed,
    guard_token_remains_unconsumed: sourceDenial.guard_token_remains_unconsumed,
    production_candidate_store_remains_not_mutated: sourceDenial.production_candidate_store_remains_not_mutated
  });

  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_rollback_restore_candidate",
    rollback_restore_id: "phase42t-production-candidate-store-promotion-gate-rollback-restore-preview",
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    source_denial_reason: sourceDenial.reason,
    source_denial_mode: sourceDenial.mode,
    source_contract_hash: sourceContractHash,
    source_backup_snapshot_id: sourceDenial.backup_snapshot_candidate.backup_snapshot_id,
    source_backup_snapshot_scope_hash: sourceDenial.backup_snapshot_scope_hash,
    request_scope: "production_candidate_store_promotion_gate",
    rollback_scope: "backup_snapshot_creation_denial",
    restore_mode: "execution_denial_preview_only",
    preview_only: true,
    execution_allowed: false,
    executed: false,
    persisted: false,
    backup_snapshot_required: true,
    backup_snapshot_present: false,
    reads_backup_snapshot: false,
    verifies_backup_snapshot: false,
    restores_state: false,
    writes_restore_state: false,
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
    creates_audit_receipt: false,
    creates_backup_snapshot: false,
    ...overrides
  });
}

function makeRollbackRestoreExecutionRequest(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_rollback_restore_execution_request",
    explicit: true,
    text: [
      "Execute rollback restore for the Phase42S backup snapshot creation denial.",
      "This is an explicit rollback restore execution request.",
      "The rollback restore execution request must be denied and rollback restore must remain unexecuted.",
      "No backup snapshot exists and no backup storage may be read.",
      "Keep the backup snapshot and audit receipt absent.",
      "Keep the production gate closed and the guard token unconsumed.",
      "Keep production promotion and production write unexecuted.",
      "Keep the production candidate store unchanged.",
      "Do not create approval request or pending engine candidate.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "execute_rollback_restore",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      phase42s_denial_accepted: true,
      rollback_restore_execution_allowed: false,
      backup_snapshot_created: false,
      audit_receipt_created: false,
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
    rollback_restore_execute:
      /\b(execute|perform|run|apply|restore)\b[\s\S]*\brollback(?: restore)?\b/i.test(text) ||
      /\brollback restore\b[\s\S]*\b(execute|perform|run|apply)\b/i.test(text),
    backup_snapshot_create:
      /\b(create|make|persist|capture|write)\b[\s\S]*\bbackup snapshot\b/i.test(text) ||
      /\bbackup snapshot\b[\s\S]*\b(create|make|persist|capture|write)\b/i.test(text),
    audit_receipt_create:
      /\b(create|make|issue|persist|record)\b[\s\S]*\baudit receipt\b/i.test(text) ||
      /\baudit receipt\b[\s\S]*\b(create|make|issue|persist|record)\b/i.test(text),
    gate_open_execute:
      /\b(open|execute|perform|commit)\b[\s\S]*\bproduction gate\b/i.test(text) ||
      /\bproduction gate\b[\s\S]*\b(open|execute|perform|commit)\b/i.test(text),
    production_promotion_execute:
      /\b(execute|perform|commit|promote)\b[\s\S]*\bproduction promotion\b/i.test(text) ||
      /\bproduction promotion\b[\s\S]*\b(execute|perform|commit|promote)\b/i.test(text),
    production_write_execute:
      /\b(execute|perform|commit)\b[\s\S]*\bproduction write\b/i.test(text) ||
      /\bproduction write\b[\s\S]*\b(execute|perform|commit)\b/i.test(text),
    pending_engine_candidate_create:
      /\b(create|make|open)\b[\s\S]*\bpending engine candidate\b/i.test(text),
    approval_request_create:
      /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text),
    guard_token_consume:
      /\bconsume\b[\s\S]*\bguard token\b/i.test(text),
    adoption:
      /\badoption\b|\badopt\b/i.test(text),
    settlement:
      /\bsettlement\b|\bsettle\b/i.test(text),
    canon_update:
      /\bupdate\b[\s\S]*\bCanon\b/i.test(text),
    active_engine_update:
      /\bupdate\b[\s\S]*\bactive_engine\b/i.test(text),
    full_run_all_passed_claim:
      /\bfull run-all passed\b/i.test(text) || /\bfull_run_all_passed\b/i.test(text)
  });
}

function assertProtectedFalse(target, label) {
  for (const field of PROTECTED_FALSE_FIELDS) {
    assert.equal(target[field], false, `${label}.${field} must remain false`);
  }
}

function validatePhase42RAuditReceiptCandidate(candidate) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_gate_audit_receipt_candidate");
  assert.equal(candidate.source_phase, GATE_DENIAL_PHASE);
  assert.equal(candidate.source_phase_slug, GATE_DENIAL_PHASE_SLUG);
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
    assert.equal(candidate[field], false, `source audit receipt candidate.${field} must remain false`);
  }

  const expectedSourceContractHash = stableHash({
    phase: GATE_DENIAL_PHASE,
    phase_slug: GATE_DENIAL_PHASE_SLUG,
    reason: "production_gate_open_execution_denied_preview_only",
    mode: "production_gate_open_execution_denial_smoke",
    production_gate_open_execution_denied: true,
    production_gate_remains_closed: true,
    guard_token_remains_unconsumed: true,
    production_candidate_store_remains_not_mutated: true
  });
  assert.equal(candidate.source_contract_hash, expectedSourceContractHash);
}

function validatePhase42SBackupSnapshotCandidate(candidate) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_gate_backup_snapshot_candidate");
  assert.equal(candidate.source_phase, AUDIT_PHASE);
  assert.equal(candidate.source_phase_slug, AUDIT_PHASE_SLUG);
  assert.equal(candidate.source_denial_reason, "audit_receipt_creation_denied_preview_only");
  assert.equal(candidate.source_denial_mode, "audit_receipt_creation_denial_smoke");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.backup_scope, "audit_receipt_creation_denial");
  assert.equal(candidate.snapshot_mode, "denial_preview_only");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.persisted, false);
  assert.equal(candidate.captures_state, false);
  assert.equal(candidate.writes_backup_storage, false);
  assert.equal(candidate.includes_audit_receipt, false);
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
    "creates_audit_receipt",
    "executes_rollback_restore"
  ]) {
    assert.equal(candidate[field], false, `source backup snapshot candidate.${field} must remain false`);
  }

  const expectedSourceContractHash = stableHash({
    phase: AUDIT_PHASE,
    phase_slug: AUDIT_PHASE_SLUG,
    reason: "audit_receipt_creation_denied_preview_only",
    mode: "audit_receipt_creation_denial_smoke",
    audit_receipt_creation_denied: true,
    audit_receipt_remains_not_created: true,
    production_gate_remains_closed: true,
    guard_token_remains_unconsumed: true,
    production_candidate_store_remains_not_mutated: true
  });
  assert.equal(candidate.source_contract_hash, expectedSourceContractHash);
}

function validatePhase42SDenial(sourceDenial) {
  assert.equal(sourceDenial.phase, PREVIOUS_PHASE);
  assert.equal(sourceDenial.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(sourceDenial.source_phase, AUDIT_PHASE);
  assert.equal(sourceDenial.source_phase_slug, AUDIT_PHASE_SLUG);
  assert.equal(sourceDenial.accepted, true);
  assert.equal(sourceDenial.reason, "backup_snapshot_creation_denied_preview_only");
  assert.equal(sourceDenial.mode, "backup_snapshot_creation_denial_smoke");
  assert.equal(sourceDenial.preview_only, true);
  assert.equal(sourceDenial.persisted, false);
  assert.equal(sourceDenial.phase42s_backup_snapshot_creation_denial_generated, true);
  assert.equal(sourceDenial.phase42s_backup_snapshot_creation_denial_persisted, false);
  assert.equal(sourceDenial.phase42r_audit_receipt_creation_denial_accepted, true);
  assert.equal(sourceDenial.explicit_backup_snapshot_creation_request_detected, true);
  assert.equal(sourceDenial.backup_snapshot_creation_denied, true);
  assert.equal(sourceDenial.backup_snapshot_creation_not_authorized, true);
  assert.equal(sourceDenial.backup_snapshot_remains_not_created, true);
  assert.equal(sourceDenial.audit_receipt_remains_not_created, true);
  assert.equal(sourceDenial.production_gate_remains_closed, true);
  assert.equal(sourceDenial.production_promotion_remains_not_executed, true);
  assert.equal(sourceDenial.production_write_remains_not_executed, true);
  assert.equal(sourceDenial.production_candidate_store_remains_not_mutated, true);
  assert.equal(sourceDenial.approval_request_remains_not_created, true);
  assert.equal(sourceDenial.pending_engine_candidate_remains_not_created, true);
  assert.equal(sourceDenial.guard_token_remains_unconsumed, true);
  assert.equal(sourceDenial.denial_preview_only, true);
  assert.equal(sourceDenial.denial_blocks_adoption, true);
  assert.equal(sourceDenial.denial_blocks_settlement, true);
  assert.equal(sourceDenial.canon_update_blocked, true);
  assert.equal(sourceDenial.active_engine_update_blocked, true);
  assert.equal(sourceDenial.rollback_restore_blocked, true);
  assert.equal(sourceDenial.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(sourceDenial.full_run_all_passed_claimed, false);
  assert.equal(sourceDenial.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assert.equal(sourceDenial.full_run_all_pending_status_preserved, true);

  validatePhase42RAuditReceiptCandidate(sourceDenial.audit_receipt_candidate);
  validatePhase42SBackupSnapshotCandidate(sourceDenial.backup_snapshot_candidate);

  const expectedBackupSnapshotScopeHash = stableHash({
    backup_snapshot_id: sourceDenial.backup_snapshot_candidate.backup_snapshot_id,
    source_phase: sourceDenial.backup_snapshot_candidate.source_phase,
    source_phase_slug: sourceDenial.backup_snapshot_candidate.source_phase_slug,
    source_contract_hash: sourceDenial.backup_snapshot_candidate.source_contract_hash,
    request_scope: sourceDenial.backup_snapshot_candidate.request_scope,
    backup_scope: sourceDenial.backup_snapshot_candidate.backup_scope,
    snapshot_mode: sourceDenial.backup_snapshot_candidate.snapshot_mode,
    creation_allowed: sourceDenial.backup_snapshot_candidate.creation_allowed,
    created: sourceDenial.backup_snapshot_candidate.created,
    persisted: sourceDenial.backup_snapshot_candidate.persisted
  });
  assert.equal(sourceDenial.backup_snapshot_scope_hash, expectedBackupSnapshotScopeHash);

  assert.equal(
    sourceDenial.denial_packet.kind,
    "production_candidate_store_promotion_gate_backup_snapshot_creation_denial_packet"
  );
  assert.equal(sourceDenial.denial_packet.denied_action, "create_backup_snapshot");
  assert.equal(sourceDenial.denial_packet.preview_only, true);
  assert.equal(sourceDenial.denial_packet.backup_snapshot_creation_denied, true);
  assert.equal(sourceDenial.denial_packet.backup_snapshot_creation_authorized, false);

  for (const field of [
    "verifies_phase42r_audit_receipt_creation_denial",
    "verifies_audit_receipt_absent",
    "verifies_production_gate_closed",
    "verifies_guard_token_unconsumed",
    "verifies_production_store_unchanged",
    "verifies_approval_request_absent",
    "verifies_pending_engine_candidate_absent"
  ]) {
    assert.equal(sourceDenial.denial_packet[field], true, `sourceDenial.denial_packet.${field} must be true`);
  }

  for (const field of [
    "creates_backup_snapshot",
    "persists_backup_snapshot",
    "captures_state",
    "writes_backup_storage",
    "creates_audit_receipt",
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
    "executes_rollback_restore"
  ]) {
    assert.equal(sourceDenial.denial_packet[field], false, `sourceDenial.denial_packet.${field} must remain false`);
  }

  assertProtectedFalse(sourceDenial, "sourceDenial");
  assertProtectedFalse(sourceDenial.state_before, "sourceDenial.state_before");
  assertProtectedFalse(sourceDenial.state_after, "sourceDenial.state_after");
  assert.deepEqual(sourceDenial.state_after, sourceDenial.state_before, "Phase42S state snapshots must be value-equal");
}

function validateRollbackRestoreCandidate(candidate, sourceDenial) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_gate_rollback_restore_candidate");
  assert.equal(candidate.source_phase, PREVIOUS_PHASE);
  assert.equal(candidate.source_phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(candidate.source_denial_reason, sourceDenial.reason);
  assert.equal(candidate.source_denial_mode, sourceDenial.mode);
  assert.equal(candidate.source_backup_snapshot_id, sourceDenial.backup_snapshot_candidate.backup_snapshot_id);
  assert.equal(candidate.source_backup_snapshot_scope_hash, sourceDenial.backup_snapshot_scope_hash);
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.rollback_scope, "backup_snapshot_creation_denial");
  assert.equal(candidate.restore_mode, "execution_denial_preview_only");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.execution_allowed, false);
  assert.equal(candidate.executed, false);
  assert.equal(candidate.persisted, false);
  assert.equal(candidate.backup_snapshot_required, true);
  assert.equal(candidate.backup_snapshot_present, false);
  assert.equal(candidate.reads_backup_snapshot, false);
  assert.equal(candidate.verifies_backup_snapshot, false);
  assert.equal(candidate.restores_state, false);
  assert.equal(candidate.writes_restore_state, false);
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
    "creates_audit_receipt",
    "creates_backup_snapshot"
  ]) {
    assert.equal(candidate[field], false, `candidate.${field} must remain false`);
  }

  const expectedSourceContractHash = stableHash({
    phase: sourceDenial.phase,
    phase_slug: sourceDenial.phase_slug,
    reason: sourceDenial.reason,
    mode: sourceDenial.mode,
    backup_snapshot_creation_denied: sourceDenial.backup_snapshot_creation_denied,
    backup_snapshot_remains_not_created: sourceDenial.backup_snapshot_remains_not_created,
    audit_receipt_remains_not_created: sourceDenial.audit_receipt_remains_not_created,
    production_gate_remains_closed: sourceDenial.production_gate_remains_closed,
    guard_token_remains_unconsumed: sourceDenial.guard_token_remains_unconsumed,
    production_candidate_store_remains_not_mutated: sourceDenial.production_candidate_store_remains_not_mutated
  });
  assert.equal(candidate.source_contract_hash, expectedSourceContractHash);
}

function validateRollbackRestoreExecutionRequest(request) {
  assert.equal(
    request.kind,
    "production_candidate_store_promotion_gate_rollback_restore_execution_request"
  );
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "execute_rollback_restore");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.rollback_restore_execute, true, "explicit rollback restore execution request must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.phase42s_denial_accepted, true);
  assert.equal(request.authorization.rollback_restore_execution_allowed, false);
  assert.equal(request.authorization.backup_snapshot_created, false);
  assert.equal(request.authorization.audit_receipt_created, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.pending_engine_candidate_created, false);
  assert.equal(request.authorization.production_write_executed, false);
  assert.equal(request.authorization.production_promotion_executed, false);
  return intent;
}

function buildRollbackRestoreExecutionDenial({
  sourceDenial,
  request,
  state = makeBaselineState(),
  rollbackRestoreCandidateOverrides = {}
} = {}) {
  validatePhase42SDenial(sourceDenial);
  const intent = validateRollbackRestoreExecutionRequest(request);
  assertProtectedFalse(state, "state");
  assert.equal(state.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(state.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);

  const rollbackRestoreCandidate = makeRollbackRestoreCandidate(
    sourceDenial,
    rollbackRestoreCandidateOverrides
  );
  validateRollbackRestoreCandidate(rollbackRestoreCandidate, sourceDenial);

  const rollbackRestoreScopeHash = stableHash({
    rollback_restore_id: rollbackRestoreCandidate.rollback_restore_id,
    source_phase: rollbackRestoreCandidate.source_phase,
    source_phase_slug: rollbackRestoreCandidate.source_phase_slug,
    source_contract_hash: rollbackRestoreCandidate.source_contract_hash,
    source_backup_snapshot_id: rollbackRestoreCandidate.source_backup_snapshot_id,
    source_backup_snapshot_scope_hash: rollbackRestoreCandidate.source_backup_snapshot_scope_hash,
    request_scope: rollbackRestoreCandidate.request_scope,
    rollback_scope: rollbackRestoreCandidate.rollback_scope,
    restore_mode: rollbackRestoreCandidate.restore_mode,
    execution_allowed: rollbackRestoreCandidate.execution_allowed,
    executed: rollbackRestoreCandidate.executed,
    backup_snapshot_present: rollbackRestoreCandidate.backup_snapshot_present
  });

  const denial = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "rollback_restore_execution_denied_preview_only",
    mode: "rollback_restore_execution_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42t_rollback_restore_execution_denial_generated: true,
    phase42t_rollback_restore_execution_denial_persisted: false,
    phase42s_backup_snapshot_creation_denial_accepted: true,
    explicit_rollback_restore_execution_request_detected: intent.rollback_restore_execute,
    rollback_restore_execution_denied: true,
    rollback_restore_execution_not_authorized: true,
    rollback_restore_remains_not_executed: true,
    rollback_restore_executed: false,
    rollback_restore_execution_authorized: false,
    backup_snapshot_remains_not_created: true,
    backup_snapshot_created: false,
    backup_snapshot_creation_authorized: false,
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
    adoption_executed: false,
    settlement_executed: false,
    canon_updated: false,
    active_engine_updated: false,
    request_intent: intent,
    rollback_restore_candidate: rollbackRestoreCandidate,
    rollback_restore_scope_hash: rollbackRestoreScopeHash,
    denial_packet: {
      kind: "production_candidate_store_promotion_gate_rollback_restore_execution_denial_packet",
      denied_action: "execute_rollback_restore",
      preview_only: true,
      rollback_restore_execution_denied: true,
      rollback_restore_execution_authorized: false,
      verifies_phase42s_backup_snapshot_creation_denial: true,
      verifies_backup_snapshot_absent: true,
      verifies_audit_receipt_absent: true,
      verifies_production_gate_closed: true,
      verifies_guard_token_unconsumed: true,
      verifies_production_store_unchanged: true,
      verifies_approval_request_absent: true,
      verifies_pending_engine_candidate_absent: true,
      executes_rollback_restore: false,
      reads_backup_snapshot: false,
      verifies_backup_snapshot: false,
      restores_state: false,
      writes_restore_state: false,
      creates_backup_snapshot: false,
      persists_backup_snapshot: false,
      creates_audit_receipt: false,
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
      updates_active_engine: false
    },
    state_before: clone(state),
    state_after: clone(state),
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true
  };

  for (const field of DENIAL_TRUE_FIELDS) {
    assert.equal(denial[field], true, `${field} must be true in rollback restore execution denial`);
  }

  assertProtectedFalse(denial, "denial");
  assertProtectedFalse(denial.state_before, "denial.state_before");
  assertProtectedFalse(denial.state_after, "denial.state_after");

  for (const field of [
    "verifies_phase42s_backup_snapshot_creation_denial",
    "verifies_backup_snapshot_absent",
    "verifies_audit_receipt_absent",
    "verifies_production_gate_closed",
    "verifies_guard_token_unconsumed",
    "verifies_production_store_unchanged",
    "verifies_approval_request_absent",
    "verifies_pending_engine_candidate_absent"
  ]) {
    assert.equal(denial.denial_packet[field], true, `denial.denial_packet.${field} must be true`);
  }

  for (const field of [
    "rollback_restore_execution_authorized",
    "executes_rollback_restore",
    "reads_backup_snapshot",
    "verifies_backup_snapshot",
    "restores_state",
    "writes_restore_state",
    "creates_backup_snapshot",
    "persists_backup_snapshot",
    "creates_audit_receipt",
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
    "updates_active_engine"
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
  const result = buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
    request: makeRollbackRestoreExecutionRequest()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "rollback_restore_execution_denied_preview_only");
  assert.equal(result.rollback_restore_execution_denied, true);
  assert.equal(result.rollback_restore_execution_not_authorized, true);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.production_candidate_store_promotion_executed, false);
  assert.equal(result.production_candidate_store_write_executed, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.approval_request_created, false);
}

for (const previousOverride of [
  { accepted: false },
  { phase42s_backup_snapshot_creation_denial_generated: false },
  { phase42s_backup_snapshot_creation_denial_persisted: true },
  { phase42r_audit_receipt_creation_denial_accepted: false },
  { explicit_backup_snapshot_creation_request_detected: false },
  { backup_snapshot_creation_denied: false },
  { backup_snapshot_creation_not_authorized: false },
  { backup_snapshot_remains_not_created: false },
  { audit_receipt_remains_not_created: false },
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
  { rollback_restore_blocked: false },
  { full_run_all_pending_status_preserved: false }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial(previousOverride),
      request: makeRollbackRestoreExecutionRequest()
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
  { backup_snapshot_creation_authorized: true },
  { rollback_restore_executed: true },
  { rollback_restore_execution_authorized: true }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial(protectedOverride),
      request: makeRollbackRestoreExecutionRequest()
    }),
    /must remain false/
  );
}

for (const packetOverride of [
  { backup_snapshot_creation_authorized: true },
  { verifies_phase42r_audit_receipt_creation_denial: false },
  { verifies_audit_receipt_absent: false },
  { verifies_production_gate_closed: false },
  { verifies_guard_token_unconsumed: false },
  { verifies_production_store_unchanged: false },
  { verifies_approval_request_absent: false },
  { verifies_pending_engine_candidate_absent: false },
  { creates_backup_snapshot: true },
  { persists_backup_snapshot: true },
  { captures_state: true },
  { writes_backup_storage: true },
  { creates_audit_receipt: true },
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
  { executes_rollback_restore: true }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial({ denial_packet: packetOverride }),
      request: makeRollbackRestoreExecutionRequest()
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

for (const sourceBackupCandidateOverride of [
  { preview_only: false },
  { creation_allowed: true },
  { created: true },
  { persisted: true },
  { captures_state: true },
  { writes_backup_storage: true },
  { includes_audit_receipt: true },
  { mutates_store: true },
  { snapshot_mode: "persist" },
  { request_scope: "active_engine" },
  { backup_scope: "settlement" },
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
  { creates_audit_receipt: true },
  { executes_rollback_restore: true },
  { source_phase: "Phase42Q" },
  { source_phase_slug: "wrong-source" },
  { source_denial_reason: "wrong-reason" },
  { source_denial_mode: "wrong-mode" },
  { source_contract_hash: "tampered" }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial({
        backup_snapshot_candidate: sourceBackupCandidateOverride
      }),
      request: makeRollbackRestoreExecutionRequest()
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

assertThrowsWithMessage(
  () => buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial({
      state_after: { ...makeBaselineState(), rollback_restore_executed: true }
    }),
    request: makeRollbackRestoreExecutionRequest()
  }),
  /must remain false/
);

assertThrowsWithMessage(
  () => buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial({
      state_after: { ...makeBaselineState(), full_run_all_pending_message: "changed" }
    }),
    request: makeRollbackRestoreExecutionRequest()
  }),
  /value-equal/
);

assertThrowsWithMessage(
  () => buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial({
      full_run_all_status: "passed",
      full_run_all_passed_claimed: true
    }),
    request: makeRollbackRestoreExecutionRequest()
  }),
  /Expected values to be strictly equal|must be true|must remain false/
);

assertThrowsWithMessage(
  () => buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
    request: makeRollbackRestoreExecutionRequest({ explicit: false })
  }),
  /Expected values to be strictly equal|must be true|must remain false/
);

assertThrowsWithMessage(
  () => buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
    request: makeRollbackRestoreExecutionRequest({
      text: "Only inspect the Phase42S denial packet without requesting any restore action."
    })
  }),
  /explicit rollback restore execution request must be detectable/
);

for (const authorizationOverride of [
  { operator_confirmed: false },
  { phase42s_denial_accepted: false },
  { rollback_restore_execution_allowed: true },
  { backup_snapshot_created: true },
  { audit_receipt_created: true },
  { production_gate_opened: true },
  { guard_token_consumed: true },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { production_write_executed: true },
  { production_promotion_executed: true }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
      request: makeRollbackRestoreExecutionRequest({
        authorization: {
          operator_confirmed: true,
          phase42s_denial_accepted: true,
          rollback_restore_execution_allowed: false,
          backup_snapshot_created: false,
          audit_receipt_created: false,
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
  { execution_allowed: true },
  { executed: true },
  { persisted: true },
  { backup_snapshot_required: false },
  { backup_snapshot_present: true },
  { reads_backup_snapshot: true },
  { verifies_backup_snapshot: true },
  { restores_state: true },
  { writes_restore_state: true },
  { mutates_store: true },
  { restore_mode: "execute" },
  { request_scope: "active_engine" },
  { rollback_scope: "settlement" },
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
  { creates_audit_receipt: true },
  { creates_backup_snapshot: true },
  { source_phase: "Phase42R" },
  { source_phase_slug: "wrong-source" },
  { source_denial_reason: "wrong-reason" },
  { source_denial_mode: "wrong-mode" },
  { source_contract_hash: "tampered" },
  { source_backup_snapshot_id: "different-backup-snapshot" },
  { source_backup_snapshot_scope_hash: "tampered" }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
      request: makeRollbackRestoreExecutionRequest(),
      rollbackRestoreCandidateOverrides: candidateOverride
    }),
    /Expected values to be strictly equal|must be true|must remain false/
  );
}

for (const stateOverride of [
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
  { backup_snapshot_creation_authorized: true },
  { rollback_restore_executed: true },
  { rollback_restore_execution_authorized: true },
  { full_run_all_passed_claimed: true }
]) {
  assertThrowsWithMessage(
    () => buildRollbackRestoreExecutionDenial({
      sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
      request: makeRollbackRestoreExecutionRequest(),
      state: makeBaselineState(stateOverride)
    }),
    /must remain false/
  );
}

{
  const riskyText = [
    "Execute rollback restore now.",
    "Create backup snapshot.",
    "Create audit receipt.",
    "Open production gate.",
    "Execute production promotion.",
    "Execute production write.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Claim full run-all passed."
  ].join(" ");

  const result = buildRollbackRestoreExecutionDenial({
    sourceDenial: makePhase42SBackupSnapshotCreationDenial(),
    request: makeRollbackRestoreExecutionRequest({ text: riskyText })
  });

  for (const field of [
    "rollback_restore_execute",
    "backup_snapshot_create",
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
    "full_run_all_passed_claim"
  ]) {
    assert.equal(result.request_intent[field], true, `request_intent.${field} must be detected`);
  }

  assertProtectedFalse(result, "riskyResult");
  assert.equal(result.rollback_restore_remains_not_executed, true);
  assert.equal(result.backup_snapshot_remains_not_created, true);
  assert.equal(result.audit_receipt_remains_not_created, true);
  assert.equal(result.production_gate_remains_closed, true);
  assert.equal(result.guard_token_remains_unconsumed, true);
  assert.deepEqual(result.state_after, result.state_before);
}

console.log("Phase42T production candidate store promotion gate rollback restore execution denial smoke tests passed.");