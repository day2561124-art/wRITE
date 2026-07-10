import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42N";
const CURRENT_PHASE_SLUG = "phase42n-production-candidate-store-promotion-gate-production-promotion-preflight-boundary-smoke";
const PREVIOUS_PHASE = "Phase42M";
const PREVIOUS_PHASE_SLUG = "phase42m-production-candidate-store-promotion-gate-production-write-execution-denial-smoke";
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

const PREFLIGHT_TRUE_FIELDS = [
  "phase42n_production_promotion_preflight_generated",
  "phase42m_production_write_execution_denial_accepted",
  "explicit_production_promotion_preflight_detected",
  "production_promotion_candidate_shape_verified",
  "production_promotion_source_scope_verified",
  "production_promotion_target_scope_verified",
  "production_promotion_prerequisite_write_denial_verified",
  "production_promotion_remains_not_executed",
  "production_write_remains_not_executed",
  "production_candidate_store_remains_not_mutated",
  "production_promotion_preflight_preview_only",
  "pending_engine_candidate_remains_not_created",
  "approval_request_remains_not_created",
  "guard_token_remains_unconsumed",
  "preflight_blocks_gate_open",
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

function makePhase42MDenial(overrides = {}) {
  const productionWriteCandidate = makeProductionWriteCandidate(overrides.production_write_candidate ?? {});
  const productionWriteScopeHash = stableHash({
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
    source_phase: "Phase42L",
    source_phase_slug: "phase42l-production-candidate-store-promotion-gate-production-write-preflight-boundary-smoke",
    accepted: true,
    reason: "production_write_execution_denied_preview_only",
    mode: "production_write_execution_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42m_production_write_execution_denial_generated: true,
    phase42m_production_write_execution_denial_persisted: false,
    phase42l_production_write_preflight_accepted: true,
    explicit_production_write_execution_request_detected: true,
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
    production_write_candidate: productionWriteCandidate,
    production_write_scope_hash: productionWriteScopeHash,
    denial_packet: {
      kind: "production_candidate_store_write_execution_denial_packet",
      denied_action: "execute_production_write",
      preview_only: true,
      production_write_execution_denied: true,
      production_write_execution_authorized: false,
      executes_production_write: false,
      mutates_production_candidate_store: false,
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
    production_write_candidate: productionWriteCandidate
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

function makeProductionPromotionPreflightRequest(overrides = {}) {
  return Object.freeze({
    kind: "production_candidate_store_promotion_preflight_request",
    explicit: true,
    text: [
      "Preflight the production promotion for the production candidate store promotion gate.",
      "Verify the production promotion candidate shape, source scope, target scope, and prior production write denial only.",
      "Keep production promotion and production write unexecuted.",
      "Keep the production candidate store unchanged.",
      "Do not create approval request or pending engine candidate.",
      "Do not open production gate or consume guard token.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create audit receipt, create backup snapshot, or execute rollback.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "preflight_production_promotion",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      production_write_executed: false,
      guard_token_consumed: false,
      production_gate_opened: false,
      production_promotion_allowed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    production_promotion_preflight: /\bpreflight\b[\s\S]*\bproduction promotion\b/i.test(text) || /\bproduction promotion\b[\s\S]*\bpreflight\b/i.test(text),
    production_promotion_execute: /\b(execute|perform|commit|promote)\b[\s\S]*\bproduction promotion\b/i.test(text) || /\bproduction promotion\b[\s\S]*\b(execute|perform|commit|promote)\b/i.test(text),
    production_write_execute: /\b(execute|perform|commit)\b[\s\S]*\bproduction write\b/i.test(text) || /\bproduction write\b[\s\S]*\b(execute|perform|commit)\b/i.test(text),
    pending_engine_candidate_create: /\b(create|make|open)\b[\s\S]*\bpending engine candidate\b/i.test(text),
    approval_request_create: /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text),
    gate_open: /\bopen\b[\s\S]*\bproduction gate\b/i.test(text) || /\bgate open\b/i.test(text),
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
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.match(candidate.production_write_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
}

function validatePhase42MDenial(denial) {
  assert.equal(denial.phase, PREVIOUS_PHASE);
  assert.equal(denial.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(denial.accepted, true);
  assert.equal(denial.reason, "production_write_execution_denied_preview_only");
  assert.equal(denial.mode, "production_write_execution_denial_smoke");
  assert.equal(denial.preview_only, true);
  assert.equal(denial.persisted, false);
  assert.equal(denial.phase42m_production_write_execution_denial_generated, true);
  assert.equal(denial.phase42m_production_write_execution_denial_persisted, false);
  assert.equal(denial.phase42l_production_write_preflight_accepted, true);
  assert.equal(denial.explicit_production_write_execution_request_detected, true);
  assert.equal(denial.production_write_execution_denied, true);
  assert.equal(denial.production_write_execution_not_authorized, true);
  assert.equal(denial.production_write_remains_not_executed, true);
  assert.equal(denial.production_candidate_store_remains_not_mutated, true);
  assert.equal(denial.denial_blocks_production_promotion, true);
  assert.equal(denial.denial_blocks_gate_open, true);
  assert.equal(denial.pending_engine_candidate_remains_not_created, true);
  assert.equal(denial.approval_request_remains_not_created, true);
  assert.equal(denial.guard_token_remains_unconsumed, true);
  validateProductionWriteCandidate(denial.production_write_candidate);

  const expectedScopeHash = stableHash({
    production_write_id: denial.production_write_candidate.production_write_id,
    source_candidate_id: denial.production_write_candidate.source_candidate_id,
    request_scope: denial.production_write_candidate.request_scope,
    source_store_scope: denial.production_write_candidate.source_store_scope,
    target_store_scope: denial.production_write_candidate.target_store_scope,
    write_mode: denial.production_write_candidate.write_mode
  });
  assert.equal(denial.production_write_scope_hash, expectedScopeHash);
  assert.equal(denial.denial_packet.production_write_execution_denied, true);
  assert.equal(denial.denial_packet.production_write_execution_authorized, false);
  assert.equal(denial.denial_packet.executes_production_write, false);
  assert.equal(denial.denial_packet.mutates_production_candidate_store, false);
  assert.equal(denial.denial_packet.promotes_production, false);
  assert.equal(denial.denial_packet.opens_gate, false);
  assert.equal(denial.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(denial.full_run_all_passed_claimed, false);
  assert.equal(denial.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assertProtectedFalse(denial, "phase42mDenial");
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

function validatePreflightRequest(request) {
  assert.equal(request.kind, "production_candidate_store_promotion_preflight_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "preflight_production_promotion");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.production_promotion_preflight, true, "explicit production promotion preflight must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.pending_engine_candidate_created, false);
  assert.equal(request.authorization.production_write_executed, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.production_promotion_allowed, false);
  return intent;
}

function buildProductionPromotionPreflightBoundaryPreview({
  previous,
  request,
  candidate = makeProductionPromotionCandidate(),
  state = makeBaselineState()
} = {}) {
  validatePhase42MDenial(previous);
  const intent = validatePreflightRequest(request);
  validateProductionPromotionCandidate(candidate);

  assert.equal(candidate.source_write_id, previous.production_write_candidate.production_write_id);
  assert.equal(candidate.source_write_hash, previous.production_write_candidate.production_write_hash);
  assert.equal(candidate.source_candidate_id, previous.production_write_candidate.source_candidate_id);
  assert.equal(candidate.source_candidate_hash, previous.production_write_candidate.source_candidate_hash);

  const scopeHash = stableHash({
    production_promotion_id: candidate.production_promotion_id,
    source_candidate_id: candidate.source_candidate_id,
    source_write_id: candidate.source_write_id,
    request_scope: candidate.request_scope,
    source_store_scope: candidate.source_store_scope,
    target_store_scope: candidate.target_store_scope,
    promotion_mode: candidate.promotion_mode,
    prerequisite_write_executed: candidate.prerequisite_write_executed,
    prerequisite_write_denial_accepted: candidate.prerequisite_write_denial_accepted
  });

  const preflight = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "production_promotion_preflight_boundary_preview_only",
    mode: "production_promotion_preflight_boundary_smoke",
    preview_only: true,
    persisted: false,
    phase42n_production_promotion_preflight_generated: true,
    phase42n_production_promotion_preflight_persisted: false,
    phase42m_production_write_execution_denial_accepted: true,
    explicit_production_promotion_preflight_detected: intent.production_promotion_preflight,
    production_promotion_candidate_shape_verified: true,
    production_promotion_source_scope_verified: true,
    production_promotion_target_scope_verified: true,
    production_promotion_prerequisite_write_denial_verified: true,
    production_promotion_remains_not_executed: true,
    production_write_remains_not_executed: true,
    production_candidate_store_remains_not_mutated: true,
    production_promotion_preflight_preview_only: true,
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
    preflight_blocks_gate_open: true,
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
    production_write_candidate: previous.production_write_candidate,
    production_write_scope_hash: previous.production_write_scope_hash,
    production_promotion_candidate: candidate,
    production_promotion_scope_hash: scopeHash,
    preflight_packet: {
      kind: "production_candidate_store_promotion_preflight_boundary_packet",
      previewed_action: "preflight_production_promotion",
      preview_only: true,
      verifies_candidate_shape: true,
      verifies_source_scope: true,
      verifies_target_scope: true,
      verifies_prerequisite_write_denial: true,
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

  for (const field of PREFLIGHT_TRUE_FIELDS) {
    assert.equal(preflight[field], true, `${field} must be true in production promotion preflight boundary preview`);
  }

  assertProtectedFalse(preflight, "preflight");
  assertProtectedFalse(preflight.state_before, "state_before");
  assertProtectedFalse(preflight.state_after, "state_after");

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
    assert.equal(preflight.preflight_packet[field], false, `preflight_packet.${field} must remain false`);
  }

  assert.deepEqual(preflight.state_after, preflight.state_before, "state snapshots must be value-equal");
  return Object.freeze(preflight);
}

function assertThrowsWithMessage(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

{
  const result = buildProductionPromotionPreflightBoundaryPreview({
    previous: makePhase42MDenial(),
    request: makeProductionPromotionPreflightRequest()
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_promotion_preflight_boundary_preview_only");
  assert.equal(result.production_promotion_candidate_shape_verified, true);
  assert.equal(result.production_promotion_prerequisite_write_denial_verified, true);
  assert.equal(result.production_candidate_store_promotion_executed, false);
  assert.equal(result.production_candidate_store_write_executed, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
}

for (const previousOverride of [
  { accepted: false },
  { phase42m_production_write_execution_denial_generated: false },
  { explicit_production_write_execution_request_detected: false },
  { production_write_execution_denied: false },
  { production_write_execution_not_authorized: false },
  { production_write_remains_not_executed: false },
  { production_candidate_store_remains_not_mutated: false },
  { denial_blocks_production_promotion: false },
  { pending_engine_candidate_remains_not_created: false },
  { approval_request_remains_not_created: false },
  { guard_token_remains_unconsumed: false }
]) {
  assertThrowsWithMessage(
    () => buildProductionPromotionPreflightBoundaryPreview({
      previous: makePhase42MDenial(previousOverride),
      request: makeProductionPromotionPreflightRequest()
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
    () => buildProductionPromotionPreflightBoundaryPreview({
      previous: makePhase42MDenial(protectedOverride),
      request: makeProductionPromotionPreflightRequest()
    }),
    /must remain false/
  );
}

assertThrowsWithMessage(
  () => buildProductionPromotionPreflightBoundaryPreview({
    previous: makePhase42MDenial({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    request: makeProductionPromotionPreflightRequest()
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionPromotionPreflightBoundaryPreview({
    previous: makePhase42MDenial(),
    request: makeProductionPromotionPreflightRequest({ explicit: false })
  }),
  /Expected values to be strictly equal/
);

assertThrowsWithMessage(
  () => buildProductionPromotionPreflightBoundaryPreview({
    previous: makePhase42MDenial(),
    request: makeProductionPromotionPreflightRequest({ text: "Only inspect the current denial packet." })
  }),
  /explicit production promotion preflight must be detectable/
);

for (const authorizationOverride of [
  { operator_confirmed: false },
  { approval_request_created: true },
  { pending_engine_candidate_created: true },
  { production_write_executed: true },
  { guard_token_consumed: true },
  { production_gate_opened: true },
  { production_promotion_allowed: true }
]) {
  assertThrowsWithMessage(
    () => buildProductionPromotionPreflightBoundaryPreview({
      previous: makePhase42MDenial(),
      request: makeProductionPromotionPreflightRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          pending_engine_candidate_created: false,
          production_write_executed: false,
          guard_token_consumed: false,
          production_gate_opened: false,
          production_promotion_allowed: false,
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
  { promotion_mode: "execute" },
  { prerequisite_write_required: false },
  { prerequisite_write_executed: true },
  { prerequisite_write_denial_accepted: false },
  { grants_gate_open: true },
  { grants_adoption: true },
  { grants_settlement: true },
  { grants_canon_update: true },
  { grants_active_engine_update: true },
  { source_write_id: "different-write-id" },
  { source_write_hash: "sha256:different-write-hash" },
  { source_candidate_id: "different-candidate-id" },
  { source_candidate_hash: "sha256:different-candidate-hash" }
]) {
  assertThrowsWithMessage(
    () => buildProductionPromotionPreflightBoundaryPreview({
      previous: makePhase42MDenial(),
      request: makeProductionPromotionPreflightRequest(),
      candidate: makeProductionPromotionCandidate(candidateOverride)
    }),
    /Expected values to be strictly equal/
  );
}

{
  const riskyText = [
    "Preflight the production promotion now.",
    "Execute production promotion.",
    "Execute production write.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Open production gate.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create audit receipt, create backup snapshot, execute rollback.",
    "Claim full run-all passed."
  ].join(" ");

  const result = buildProductionPromotionPreflightBoundaryPreview({
    previous: makePhase42MDenial(),
    request: makeProductionPromotionPreflightRequest({ text: riskyText })
  });

  for (const field of [
    "production_promotion_preflight",
    "production_promotion_execute",
    "production_write_execute",
    "pending_engine_candidate_create",
    "approval_request_create",
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

console.log("Phase42N production candidate store promotion gate production promotion preflight boundary smoke tests passed.");
