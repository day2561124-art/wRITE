import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42Q";
const CURRENT_PHASE_SLUG = "phase42q-production-candidate-store-promotion-gate-production-gate-open-execution-denial-smoke";
const PREVIOUS_PHASE = "Phase42P";
const PREVIOUS_PHASE_SLUG = "phase42p-production-candidate-store-promotion-gate-production-gate-open-preflight-boundary-smoke";
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
  "phase42q_production_gate_open_execution_denial_generated",
  "phase42p_production_gate_open_preflight_accepted",
  "explicit_production_gate_open_execution_request_detected",
  "production_gate_open_execution_denied",
  "production_gate_open_execution_not_authorized",
  "production_gate_remains_closed",
  "production_promotion_remains_not_executed",
  "production_write_remains_not_executed",
  "production_candidate_store_remains_not_mutated",
  "denial_preview_only",
  "pending_engine_candidate_remains_not_created",
  "approval_request_remains_not_created",
  "guard_token_remains_unconsumed",
  "denial_blocks_adoption",
  "denial_blocks_settlement",
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
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
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

function makeProductionPromotionCandidate(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_candidate",
    production_promotion_id: "phase42-production-candidate-store-promotion-preview",
    production_promotion_hash: "sha256:phase42productionpromotion000000000000000000000000000000000000000000000000",
    source_candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    source_candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    source_write_id: "phase42-production-candidate-store-write-preview",
    source_write_hash: "sha256:phase42productionwrite00000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    promotion_mode: "preflight_only",
    prerequisite_write_required: true,
    prerequisite_write_executed: false,
    prerequisite_write_denial_accepted: true,
    preview_only: true,
    execution_allowed: false,
    executed: false,
    mutates_store: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    guard_token_consumed: false,
    production_gate_opened: false,
    grants_gate_open: false,
    grants_adoption: false,
    grants_settlement: false,
    grants_canon_update: false,
    grants_active_engine_update: false,
    ...overrides
  });
}

function makeProductionGateOpenCandidate(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_open_candidate",
    gate_open_id: "phase42-production-candidate-store-promotion-gate-open-preview",
    gate_open_hash: "sha256:phase42productiongateopen000000000000000000000000000000000000000000000000000",
    source_candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    source_candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    source_write_id: "phase42-production-candidate-store-write-preview",
    source_write_hash: "sha256:phase42productionwrite00000000000000000000000000000000000000000000000000",
    source_promotion_id: "phase42-production-candidate-store-promotion-preview",
    source_promotion_hash: "sha256:phase42productionpromotion000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "production_candidate_store",
    target_gate_scope: "production_candidate_store_promotion_gate",
    gate_mode: "preflight_only",
    prerequisite_write_required: true,
    prerequisite_write_executed: false,
    prerequisite_write_denial_accepted: true,
    prerequisite_promotion_required: true,
    prerequisite_promotion_executed: false,
    prerequisite_promotion_denial_accepted: true,
    approval_request_required: true,
    approval_request_created: false,
    pending_engine_candidate_required: true,
    pending_engine_candidate_created: false,
    guard_token_required: true,
    guard_token_consumed: false,
    preview_only: true,
    open_allowed: false,
    opened: false,
    mutates_store: false,
    grants_adoption: false,
    grants_settlement: false,
    grants_canon_update: false,
    grants_active_engine_update: false,
    ...overrides
  });
}

function makePhase42PProductionGateOpenPreflight(overrides = {}) {
  const productionWriteCandidate = makeProductionWriteCandidate(overrides.production_write_candidate ?? {});
  const productionPromotionCandidate = makeProductionPromotionCandidate(overrides.production_promotion_candidate ?? {});
  const productionGateOpenCandidate = makeProductionGateOpenCandidate(overrides.production_gate_open_candidate ?? {});

  const writeScopeHash = stableHash({
    production_write_id: productionWriteCandidate.production_write_id,
    source_candidate_id: productionWriteCandidate.source_candidate_id,
    request_scope: productionWriteCandidate.request_scope,
    source_store_scope: productionWriteCandidate.source_store_scope,
    target_store_scope: productionWriteCandidate.target_store_scope,
    write_mode: productionWriteCandidate.write_mode
  });

  const promotionScopeHash = stableHash({
    production_promotion_id: productionPromotionCandidate.production_promotion_id,
    source_candidate_id: productionPromotionCandidate.source_candidate_id,
    source_write_id: productionPromotionCandidate.source_write_id,
    request_scope: productionPromotionCandidate.request_scope,
    source_store_scope: productionPromotionCandidate.source_store_scope,
    target_store_scope: productionPromotionCandidate.target_store_scope,
    promotion_mode: productionPromotionCandidate.promotion_mode,
    prerequisite_write_executed: productionPromotionCandidate.prerequisite_write_executed,
    prerequisite_write_denial_accepted: productionPromotionCandidate.prerequisite_write_denial_accepted
  });

  const gateOpenScopeHash = stableHash({
    gate_open_id: productionGateOpenCandidate.gate_open_id,
    source_candidate_id: productionGateOpenCandidate.source_candidate_id,
    source_write_id: productionGateOpenCandidate.source_write_id,
    source_promotion_id: productionGateOpenCandidate.source_promotion_id,
    request_scope: productionGateOpenCandidate.request_scope,
    source_store_scope: productionGateOpenCandidate.source_store_scope,
    target_gate_scope: productionGateOpenCandidate.target_gate_scope,
    gate_mode: productionGateOpenCandidate.gate_mode,
    prerequisite_write_executed: productionGateOpenCandidate.prerequisite_write_executed,
    prerequisite_write_denial_accepted: productionGateOpenCandidate.prerequisite_write_denial_accepted,
    prerequisite_promotion_executed: productionGateOpenCandidate.prerequisite_promotion_executed,
    prerequisite_promotion_denial_accepted: productionGateOpenCandidate.prerequisite_promotion_denial_accepted,
    guard_token_consumed: productionGateOpenCandidate.guard_token_consumed
  });

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    source_phase: "Phase42O",
    source_phase_slug: "phase42o-production-candidate-store-promotion-gate-production-promotion-execution-denial-smoke",
    accepted: true,
    reason: "production_gate_open_preflight_boundary_preview_only",
    mode: "production_gate_open_preflight_boundary_smoke",
    preview_only: true,
    persisted: false,
    phase42p_production_gate_open_preflight_generated: true,
    phase42p_production_gate_open_preflight_persisted: false,
    phase42o_production_promotion_execution_denial_accepted: true,
    explicit_production_gate_open_preflight_detected: true,
    production_gate_open_candidate_shape_verified: true,
    production_gate_open_source_scope_verified: true,
    production_gate_open_target_scope_verified: true,
    production_gate_open_prerequisite_promotion_denial_verified: true,
    production_gate_open_prerequisite_write_denial_verified: true,
    production_gate_remains_closed: true,
    production_promotion_remains_not_executed: true,
    production_write_remains_not_executed: true,
    production_candidate_store_remains_not_mutated: true,
    production_gate_open_preflight_preview_only: true,
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
    preflight_blocks_adoption: true,
    preflight_blocks_settlement: true,
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
    production_write_candidate: productionWriteCandidate,
    production_write_scope_hash: writeScopeHash,
    production_promotion_candidate: productionPromotionCandidate,
    production_promotion_scope_hash: promotionScopeHash,
    production_gate_open_candidate: productionGateOpenCandidate,
    production_gate_open_scope_hash: gateOpenScopeHash,
    preflight_packet: {
      kind: "production_candidate_store_promotion_gate_open_preflight_boundary_packet",
      previewed_action: "preflight_production_gate_open",
      preview_only: true,
      verifies_candidate_shape: true,
      verifies_source_scope: true,
      verifies_target_gate_scope: true,
      verifies_prerequisite_promotion_denial: true,
      verifies_prerequisite_write_denial: true,
      verifies_gate_remains_closed: true,
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
      executes_rollback_restore: false
    },
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true,
    ...overrides,
    production_write_candidate: productionWriteCandidate,
    production_promotion_candidate: productionPromotionCandidate,
    production_gate_open_candidate: productionGateOpenCandidate
  });
}

function makeProductionGateOpenExecutionRequest(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_gate_open_execution_request",
    explicit: true,
    text: [
      "Open the production gate for the production candidate store promotion gate.",
      "This is an explicit production gate open execution request.",
      "The request must be denied and the production gate must remain closed.",
      "Keep production promotion and production write unexecuted.",
      "Keep the production candidate store unchanged.",
      "Do not create approval request or pending engine candidate.",
      "Do not consume guard token.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create audit receipt, create backup snapshot, or execute rollback.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "execute_production_gate_open",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      production_write_executed: false,
      production_promotion_executed: false,
      guard_token_consumed: false,
      production_gate_open_execution_allowed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    gate_open_preflight: /\bpreflight\b[\s\S]*\b(open|opening)\b[\s\S]*\bproduction gate\b/i.test(text) ||
      /\bproduction gate\b[\s\S]*\bpreflight\b/i.test(text),
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

function validateProductionPromotionCandidate(candidate) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "sandbox_candidate_store");
  assert.equal(candidate.target_store_scope, "production_candidate_store");
  assert.equal(candidate.promotion_mode, "preflight_only");
  assert.equal(candidate.prerequisite_write_required, true);
  assert.equal(candidate.prerequisite_write_executed, false);
  assert.equal(candidate.prerequisite_write_denial_accepted, true);
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.execution_allowed, false);
  assert.equal(candidate.executed, false);
  assert.equal(candidate.mutates_store, false);
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.pending_engine_candidate_created, false);
  assert.equal(candidate.guard_token_consumed, false);
  assert.equal(candidate.production_gate_opened, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.equal(candidate.grants_adoption, false);
  assert.equal(candidate.grants_settlement, false);
  assert.equal(candidate.grants_canon_update, false);
  assert.equal(candidate.grants_active_engine_update, false);
  assert.match(candidate.production_promotion_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
  assert.match(candidate.source_write_hash, /^sha256:/);
}

function validateProductionGateOpenCandidate(candidate) {
  assert.equal(candidate.kind, "production_candidate_store_promotion_gate_open_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "production_candidate_store");
  assert.equal(candidate.target_gate_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.gate_mode, "preflight_only");
  assert.equal(candidate.prerequisite_write_required, true);
  assert.equal(candidate.prerequisite_write_executed, false);
  assert.equal(candidate.prerequisite_write_denial_accepted, true);
  assert.equal(candidate.prerequisite_promotion_required, true);
  assert.equal(candidate.prerequisite_promotion_executed, false);
  assert.equal(candidate.prerequisite_promotion_denial_accepted, true);
  assert.equal(candidate.approval_request_required, true);
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.pending_engine_candidate_required, true);
  assert.equal(candidate.pending_engine_candidate_created, false);
  assert.equal(candidate.guard_token_required, true);
  assert.equal(candidate.guard_token_consumed, false);
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.open_allowed, false);
  assert.equal(candidate.opened, false);
  assert.equal(candidate.mutates_store, false);
  assert.equal(candidate.grants_adoption, false);
  assert.equal(candidate.grants_settlement, false);
  assert.equal(candidate.grants_canon_update, false);
  assert.equal(candidate.grants_active_engine_update, false);
  assert.match(candidate.gate_open_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
  assert.match(candidate.source_write_hash, /^sha256:/);
  assert.match(candidate.source_promotion_hash, /^sha256:/);
}

function validatePhase42PPreflight(preflight) {
  assert.equal(preflight.phase, PREVIOUS_PHASE);
  assert.equal(preflight.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(preflight.accepted, true);
  assert.equal(preflight.reason, "production_gate_open_preflight_boundary_preview_only");
  assert.equal(preflight.mode, "production_gate_open_preflight_boundary_smoke");
  assert.equal(preflight.preview_only, true);
  assert.equal(preflight.persisted, false);
  assert.equal(preflight.phase42p_production_gate_open_preflight_generated, true);
  assert.equal(preflight.phase42p_production_gate_open_preflight_persisted, false);
  assert.equal(preflight.phase42o_production_promotion_execution_denial_accepted, true);
  assert.equal(preflight.explicit_production_gate_open_preflight_detected, true);
  assert.equal(preflight.production_gate_open_candidate_shape_verified, true);
  assert.equal(preflight.production_gate_open_source_scope_verified, true);
  assert.equal(preflight.production_gate_open_target_scope_verified, true);
  assert.equal(preflight.production_gate_open_prerequisite_promotion_denial_verified, true);
  assert.equal(preflight.production_gate_open_prerequisite_write_denial_verified, true);
  assert.equal(preflight.production_gate_remains_closed, true);
  assert.equal(preflight.production_promotion_remains_not_executed, true);
  assert.equal(preflight.production_write_remains_not_executed, true);
  assert.equal(preflight.production_candidate_store_remains_not_mutated, true);
  assert.equal(preflight.production_gate_open_preflight_preview_only, true);
  assert.equal(preflight.pending_engine_candidate_remains_not_created, true);
  assert.equal(preflight.approval_request_remains_not_created, true);
  assert.equal(preflight.guard_token_remains_unconsumed, true);
  assert.equal(preflight.preflight_blocks_adoption, true);
  assert.equal(preflight.preflight_blocks_settlement, true);

  validateProductionWriteCandidate(preflight.production_write_candidate);
  validateProductionPromotionCandidate(preflight.production_promotion_candidate);
  validateProductionGateOpenCandidate(preflight.production_gate_open_candidate);

  assert.equal(preflight.production_promotion_candidate.source_write_id, preflight.production_write_candidate.production_write_id);
  assert.equal(preflight.production_promotion_candidate.source_write_hash, preflight.production_write_candidate.production_write_hash);
  assert.equal(preflight.production_gate_open_candidate.source_candidate_id, preflight.production_promotion_candidate.source_candidate_id);
  assert.equal(preflight.production_gate_open_candidate.source_candidate_hash, preflight.production_promotion_candidate.source_candidate_hash);
  assert.equal(preflight.production_gate_open_candidate.source_write_id, preflight.production_write_candidate.production_write_id);
  assert.equal(preflight.production_gate_open_candidate.source_write_hash, preflight.production_write_candidate.production_write_hash);
  assert.equal(preflight.production_gate_open_candidate.source_promotion_id, preflight.production_promotion_candidate.production_promotion_id);
  assert.equal(preflight.production_gate_open_candidate.source_promotion_hash, preflight.production_promotion_candidate.production_promotion_hash);

  const expectedWriteScopeHash = stableHash({
    production_write_id: preflight.production_write_candidate.production_write_id,
    source_candidate_id: preflight.production_write_candidate.source_candidate_id,
    request_scope: preflight.production_write_candidate.request_scope,
    source_store_scope: preflight.production_write_candidate.source_store_scope,
    target_store_scope: preflight.production_write_candidate.target_store_scope,
    write_mode: preflight.production_write_candidate.write_mode
  });
  assert.equal(preflight.production_write_scope_hash, expectedWriteScopeHash);

  const expectedPromotionScopeHash = stableHash({
    production_promotion_id: preflight.production_promotion_candidate.production_promotion_id,
    source_candidate_id: preflight.production_promotion_candidate.source_candidate_id,
    source_write_id: preflight.production_promotion_candidate.source_write_id,
    request_scope: preflight.production_promotion_candidate.request_scope,
    source_store_scope: preflight.production_promotion_candidate.source_store_scope,
    target_store_scope: preflight.production_promotion_candidate.target_store_scope,
    promotion_mode: preflight.production_promotion_candidate.promotion_mode,
    prerequisite_write_executed: preflight.production_promotion_candidate.prerequisite_write_executed,
    prerequisite_write_denial_accepted: preflight.production_promotion_candidate.prerequisite_write_denial_accepted
  });
  assert.equal(preflight.production_promotion_scope_hash, expectedPromotionScopeHash);

  const expectedGateOpenScopeHash = stableHash({
    gate_open_id: preflight.production_gate_open_candidate.gate_open_id,
    source_candidate_id: preflight.production_gate_open_candidate.source_candidate_id,
    source_write_id: preflight.production_gate_open_candidate.source_write_id,
    source_promotion_id: preflight.production_gate_open_candidate.source_promotion_id,
    request_scope: preflight.production_gate_open_candidate.request_scope,
    source_store_scope: preflight.production_gate_open_candidate.source_store_scope,
    target_gate_scope: preflight.production_gate_open_candidate.target_gate_scope,
    gate_mode: preflight.production_gate_open_candidate.gate_mode,
    prerequisite_write_executed: preflight.production_gate_open_candidate.prerequisite_write_executed,
    prerequisite_write_denial_accepted: preflight.production_gate_open_candidate.prerequisite_write_denial_accepted,
    prerequisite_promotion_executed: preflight.production_gate_open_candidate.prerequisite_promotion_executed,
    prerequisite_promotion_denial_accepted: preflight.production_gate_open_candidate.prerequisite_promotion_denial_accepted,
    guard_token_consumed: preflight.production_gate_open_candidate.guard_token_consumed
  });
  assert.equal(preflight.production_gate_open_scope_hash, expectedGateOpenScopeHash);

  assert.equal(preflight.preflight_packet.verifies_candidate_shape, true);
  assert.equal(preflight.preflight_packet.verifies_source_scope, true);
  assert.equal(preflight.preflight_packet.verifies_target_gate_scope, true);
  assert.equal(preflight.preflight_packet.verifies_prerequisite_promotion_denial, true);
  assert.equal(preflight.preflight_packet.verifies_prerequisite_write_denial, true);
  assert.equal(preflight.preflight_packet.verifies_gate_remains_closed, true);

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
    assert.equal(preflight.preflight_packet[field], false, `phase42pPreflight.preflight_packet.${field} must remain false`);
  }

  assert.equal(preflight.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(preflight.full_run_all_passed_claimed, false);
  assert.equal(preflight.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assertProtectedFalse(preflight, "phase42pPreflight");
}

function validateExecutionRequest(request) {
  assert.equal(request.kind, "production_candidate_store_promotion_gate_open_execution_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "execute_production_gate_open");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.gate_open_execute, true, "explicit production gate open execution request must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.pending_engine_candidate_created, false);
  assert.equal(request.authorization.production_write_executed, false);
  assert.equal(request.authorization.production_promotion_executed, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.production_gate_open_execution_allowed, false);
  return intent;
}

function buildProductionGateOpenExecutionDenial({
  preflight,
  request,
  state = makeBaselineState()
} = {}) {
  validatePhase42PPreflight(preflight);
  const intent = validateExecutionRequest(request);

  const denial = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "production_gate_open_execution_denied_preview_only",
    mode: "production_gate_open_execution_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42q_production_gate_open_execution_denial_generated: true,
    phase42q_production_gate_open_execution_denial_persisted: false,
    phase42p_production_gate_open_preflight_accepted: true,
    explicit_production_gate_open_execution_request_detected: intent.gate_open_execute,
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
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    request_intent: intent,
    production_write_candidate: preflight.production_write_candidate,
    production_write_scope_hash: preflight.production_write_scope_hash,
    production_promotion_candidate: preflight.production_promotion_candidate,
    production_promotion_scope_hash: preflight.production_promotion_scope_hash,
    production_gate_open_candidate: preflight.production_gate_open_candidate,
    production_gate_open_scope_hash: preflight.production_gate_open_scope_hash,
    denial_packet: {
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
    assert.equal(denial[field], true, `${field} must be true in production gate open execution denial`);
  }

  assertProtectedFalse(denial, "denial");
  assertProtectedFalse(denial.state_before, "state_before");
  assertProtectedFalse(denial.state_after, "state_after");

  for (const field of [
    "production_gate_open_execution_authorized",
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
    assert.equal(denial.denial_packet[field], false, `denial_packet.${field} must remain false`);
  }

  for (const field of [
    "verifies_prior_preflight",
    "verifies_prerequisite_promotion_denial",
    "verifies_prerequisite_write_denial",
    "verifies_approval_request_absent",
    "verifies_pending_engine_candidate_absent",
    "verifies_guard_token_unconsumed"
  ]) {
    assert.equal(denial.denial_packet[field], true, `denial_packet.${field} must be true`);
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
  const result = buildProductionGateOpenExecutionDenial({
    preflight: makePhase42PProductionGateOpenPreflight(),
    request: makeProductionGateOpenExecutionRequest()
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_gate_open_execution_denied_preview_only");
  assert.equal(result.production_gate_open_execution_denied, true);
  assert.equal(result.production_gate_open_execution_not_authorized, true);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_promotion_executed, false);
  assert.equal(result.production_candidate_store_write_executed, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.guard_token_consumed, false);
}

for (const previousOverride of [
  { accepted: false },
  { phase42p_production_gate_open_preflight_generated: false },
  { explicit_production_gate_open_preflight_detected: false },
  { production_gate_open_candidate_shape_verified: false },
  { production_gate_open_source_scope_verified: false },
  { production_gate_open_target_scope_verified: false },
  { production_gate_open_prerequisite_promotion_denial_verified: false },
  { production_gate_open_prerequisite_write_denial_verified: false },
  { production_gate_remains_closed: false },
  { production_promotion_remains_not_executed: false },
  { production_write_remains_not_executed: false },
  { production_candidate_store_remains_not_mutated: false },
  { pending_engine_candidate_remains_not_created: false },
  { approval_request_remains_not_created: false },
  { guard_token_remains_unconsumed: false },
  { preflight_blocks_adoption: false },
  { preflight_blocks_settlement: false }
]) {
  assertThrowsWithMessage(
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight(previousOverride),
      request: makeProductionGateOpenExecutionRequest()
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
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight(protectedOverride),
      request: makeProductionGateOpenExecutionRequest()
    }),
    /must remain false/
  );
}

assertThrowsWithMessage(
  () => buildProductionGateOpenExecutionDenial({
    preflight: makePhase42PProductionGateOpenPreflight({
      full_run_all_status: "passed",
      full_run_all_passed_claimed: true
    }),
    request: makeProductionGateOpenExecutionRequest()
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionGateOpenExecutionDenial({
    preflight: makePhase42PProductionGateOpenPreflight(),
    request: makeProductionGateOpenExecutionRequest({ explicit: false })
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionGateOpenExecutionDenial({
    preflight: makePhase42PProductionGateOpenPreflight(),
    request: makeProductionGateOpenExecutionRequest({
      text: "Only inspect the current Phase42P packet without requesting the next action."
    })
  }),
  /explicit production gate open execution request must be detectable/
);

for (const authorizationOverride of [
  { operator_confirmed: false },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { production_write_executed: true },
  { production_promotion_executed: true },
  { guard_token_consumed: true },
  { production_gate_open_execution_allowed: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight(),
      request: makeProductionGateOpenExecutionRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          pending_engine_candidate_created: false,
          production_write_executed: false,
          production_promotion_executed: false,
          guard_token_consumed: false,
          production_gate_open_execution_allowed: false,
          ...authorizationOverride
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

for (const candidateOverride of [
  { preview_only: false },
  { open_allowed: true },
  { opened: true },
  { mutates_store: true },
  { approval_request_required: false },
  { approval_request_created: true },
  { pending_engine_candidate_required: false },
  { pending_engine_candidate_created: true },
  { guard_token_required: false },
  { guard_token_consumed: true },
  { source_store_scope: "sandbox_candidate_store" },
  { target_gate_scope: "active_engine" },
  { gate_mode: "open" },
  { prerequisite_write_required: false },
  { prerequisite_write_executed: true },
  { prerequisite_write_denial_accepted: false },
  { prerequisite_promotion_required: false },
  { prerequisite_promotion_executed: true },
  { prerequisite_promotion_denial_accepted: false },
  { grants_adoption: true },
  { grants_settlement: true },
  { grants_canon_update: true },
  { grants_active_engine_update: true },
  { source_candidate_id: "different-candidate-id" },
  { source_candidate_hash: "sha256:different-candidate-hash" },
  { source_write_id: "different-write-id" },
  { source_write_hash: "sha256:different-write-hash" },
  { source_promotion_id: "different-promotion-id" },
  { source_promotion_hash: "sha256:different-promotion-hash" }
]) {
  assertThrowsWithMessage(
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight({
        production_gate_open_candidate: candidateOverride
      }),
      request: makeProductionGateOpenExecutionRequest()
    }),
    /Expected values to be strictly equal/
  );
}

for (const promotionCandidateOverride of [
  { executed: true },
  { execution_allowed: true },
  { mutates_store: true },
  { promotion_mode: "execute" },
  { prerequisite_write_executed: true },
  { prerequisite_write_denial_accepted: false },
  { production_gate_opened: true },
  { guard_token_consumed: true },
  { grants_gate_open: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight({
        production_promotion_candidate: promotionCandidateOverride
      }),
      request: makeProductionGateOpenExecutionRequest()
    }),
    /Expected values to be strictly equal/
  );
}

for (const writeCandidateOverride of [
  { executed: true },
  { execution_allowed: true },
  { mutates_store: true },
  { write_mode: "execute" },
  { target_store_scope: "active_engine" },
  { production_gate_opened: true },
  { guard_token_consumed: true },
  { grants_production_promotion: true },
  { grants_gate_open: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionGateOpenExecutionDenial({
      preflight: makePhase42PProductionGateOpenPreflight({
        production_write_candidate: writeCandidateOverride
      }),
      request: makeProductionGateOpenExecutionRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  const riskyText = [
    "Open production gate now.",
    "Execute production promotion.",
    "Execute production write.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create audit receipt, create backup snapshot, execute rollback.",
    "Claim full run-all passed."
  ].join(" ");

  const result = buildProductionGateOpenExecutionDenial({
    preflight: makePhase42PProductionGateOpenPreflight(),
    request: makeProductionGateOpenExecutionRequest({ text: riskyText })
  });

  for (const field of [
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
    "audit_receipt_create",
    "backup_snapshot_create",
    "rollback_restore_execute",
    "full_run_all_passed_claim"
  ]) {
    assert.equal(result.request_intent[field], true, `request_intent.${field} must be detected`);
  }

  assertProtectedFalse(result, "riskyResult");
}

console.log("Phase42Q production candidate store promotion gate production gate open execution denial smoke tests passed.");
