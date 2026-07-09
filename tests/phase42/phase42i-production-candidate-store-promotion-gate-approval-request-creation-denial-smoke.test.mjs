import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42I";
const CURRENT_PHASE_SLUG = "phase42i-production-candidate-store-promotion-gate-approval-request-creation-denial-smoke";
const PREVIOUS_PHASE = "Phase42H";
const PREVIOUS_PHASE_SLUG = "phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE = "Full run-all remains separately pending due to prior Backup export service timeout.";

const PROTECTED_FALSE_FIELDS = [
  "approval_request_created",
  "approval_request_creation_authorized",
  "pending_engine_candidate_created",
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
  "phase42i_approval_request_creation_denial_generated",
  "phase42h_approval_request_preflight_accepted",
  "explicit_approval_request_creation_request_detected",
  "approval_request_creation_denied",
  "approval_request_creation_not_authorized",
  "approval_request_remains_not_created",
  "denial_preview_only",
  "denial_blocks_pending_engine_candidate",
  "denial_blocks_production_write",
  "denial_blocks_production_promotion",
  "denial_blocks_gate_open",
  "guard_token_remains_unconsumed",
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
    phase42i_approval_request_creation_denial_generated: false,
    phase42i_approval_request_creation_denial_persisted: false,
    phase42h_approval_request_preflight_accepted: false,
    explicit_approval_request_creation_request_detected: false,
    approval_request_creation_denied: false,
    approval_request_creation_not_authorized: false,
    approval_request_remains_not_created: false,
    denial_preview_only: false,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    pending_engine_candidate_created: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    denial_blocks_pending_engine_candidate: false,
    denial_blocks_production_write: false,
    denial_blocks_production_promotion: false,
    denial_blocks_gate_open: false,
    guard_token_remains_unconsumed: false,
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
  const base = {
    kind: "approval_request_candidate",
    candidate_id: "phase42-production-candidate-store-promotion-gate-candidate",
    candidate_hash: "sha256:phase42candidate000000000000000000000000000000000000000000000000000000",
    request_scope: "production_candidate_store_promotion_gate",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    approval_route: "operator_review_queue",
    approval_reason: "production candidate store promotion gate review",
    preview_only: true,
    creation_allowed: false,
    created: false,
    grants_pending_engine_candidate: false,
    grants_production_write: false,
    grants_production_promotion: false,
    grants_gate_open: false
  };

  return Object.freeze({ ...base, ...overrides });
}

function makePhase42HApprovalPreflightPreview(overrides = {}) {
  const approvalRequestCandidate = makeApprovalRequestCandidate(overrides.approval_request_candidate ?? {});
  const scopeHash = stableHash({
    request_scope: approvalRequestCandidate.request_scope,
    candidate_id: approvalRequestCandidate.candidate_id,
    target_store_scope: approvalRequestCandidate.target_store_scope
  });

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    mode: "approval_request_preflight_boundary_preview_only",
    preview_only: true,
    persisted: false,
    phase42h_approval_request_preflight_generated: true,
    explicit_approval_request_preflight_detected: true,
    approval_request_candidate_shape_verified: true,
    approval_request_scope_verified: true,
    approval_request_still_not_created: true,
    approval_request_candidate: approvalRequestCandidate,
    approval_request_scope_hash: scopeHash,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    pending_engine_candidate_created: false,
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
    ...overrides,
    approval_request_candidate: approvalRequestCandidate
  });
}

function makeApprovalRequestCreationRequest(overrides = {}) {
  return Object.freeze({
    kind: "approval_request_creation_request",
    explicit: true,
    text: [
      "Create the approval request for the production candidate store promotion gate.",
      "Do not create pending engine candidate.",
      "Do not write production.",
      "Do not promote production.",
      "Do not open production gate.",
      "Do not consume guard token.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create audit receipt, create backup snapshot, or execute rollback.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "create_approval_request",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      guard_token_consumed: false,
      production_gate_opened: false,
      approval_request_creation_allowed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    approval_request_create: /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text) || /\bapproval request\b[\s\S]*\b(create|make|open)\b/i.test(text),
    pending_engine_candidate_create: /\b(create|make)\b[\s\S]*\bpending engine candidate\b/i.test(text),
    production_write: /\bproduction write\b/i.test(text) || /\bwrite\b[\s\S]*\bproduction\b/i.test(text),
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
  assert.equal(candidate.approval_route, "operator_review_queue");
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.grants_pending_engine_candidate, false);
  assert.equal(candidate.grants_production_write, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.match(candidate.candidate_hash, /^sha256:/);
}

function validatePhase42HPreflight(preflight) {
  assert.equal(preflight.phase, PREVIOUS_PHASE);
  assert.equal(preflight.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(preflight.accepted, true);
  assert.equal(preflight.mode, "approval_request_preflight_boundary_preview_only");
  assert.equal(preflight.preview_only, true);
  assert.equal(preflight.persisted, false);
  assert.equal(preflight.phase42h_approval_request_preflight_generated, true);
  assert.equal(preflight.explicit_approval_request_preflight_detected, true);
  assert.equal(preflight.approval_request_candidate_shape_verified, true);
  assert.equal(preflight.approval_request_scope_verified, true);
  assert.equal(preflight.approval_request_still_not_created, true);
  validateApprovalRequestCandidate(preflight.approval_request_candidate);

  const expectedScopeHash = stableHash({
    request_scope: preflight.approval_request_candidate.request_scope,
    candidate_id: preflight.approval_request_candidate.candidate_id,
    target_store_scope: preflight.approval_request_candidate.target_store_scope
  });
  assert.equal(preflight.approval_request_scope_hash, expectedScopeHash);
  assert.equal(preflight.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(preflight.full_run_all_passed_claimed, false);
  assert.equal(preflight.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assertProtectedFalse(preflight, "phase42hPreflight");
}

function validateCreationRequest(request) {
  assert.equal(request.kind, "approval_request_creation_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "create_approval_request");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.approval_request_create, true, "explicit approval request creation request must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.approval_request_creation_allowed, false);
  return intent;
}

function buildApprovalRequestCreationDenialPreview({ preflight, request, state = makeBaselineState() } = {}) {
  validatePhase42HPreflight(preflight);
  const intent = validateCreationRequest(request);

  const denial = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "approval_request_creation_denied_preview_only",
    mode: "approval_request_creation_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42i_approval_request_creation_denial_generated: true,
    phase42i_approval_request_creation_denial_persisted: false,
    phase42h_approval_request_preflight_accepted: true,
    explicit_approval_request_creation_request_detected: intent.approval_request_create,
    approval_request_creation_denied: true,
    approval_request_creation_not_authorized: true,
    approval_request_remains_not_created: true,
    denial_preview_only: true,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    pending_engine_candidate_created: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    denial_blocks_pending_engine_candidate: true,
    denial_blocks_production_write: true,
    denial_blocks_production_promotion: true,
    denial_blocks_gate_open: true,
    guard_token_remains_unconsumed: true,
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
    denial_packet: {
      kind: "approval_request_creation_denial_packet",
      denied_action: "create_approval_request",
      denial_reason: "approval request creation remains blocked in Phase42I",
      preview_only: true,
      creates_approval_request: false,
      creates_pending_engine_candidate: false,
      writes_production: false,
      promotes_production: false,
      opens_gate: false,
      consumes_guard_token: false
    },
    state_before: clone(state),
    state_after: clone(state),
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_passed_claimed: false,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_pending_status_preserved: true
  };

  for (const field of DENIAL_TRUE_FIELDS) {
    assert.equal(denial[field], true, `${field} must be true in denial preview`);
  }

  assertProtectedFalse(denial, "denial");
  assertProtectedFalse(denial.state_before, "state_before");
  assertProtectedFalse(denial.state_after, "state_after");
  assert.equal(denial.denial_packet.creates_approval_request, false);
  assert.equal(denial.denial_packet.creates_pending_engine_candidate, false);
  assert.equal(denial.denial_packet.writes_production, false);
  assert.equal(denial.denial_packet.promotes_production, false);
  assert.equal(denial.denial_packet.opens_gate, false);
  assert.equal(denial.denial_packet.consumes_guard_token, false);
  return Object.freeze(denial);
}

function assertThrowsWithMessage(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

{
  const result = buildApprovalRequestCreationDenialPreview({
    preflight: makePhase42HApprovalPreflightPreview(),
    request: makeApprovalRequestCreationRequest()
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "approval_request_creation_denied_preview_only");
  assert.equal(result.approval_request_creation_denied, true);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview({ accepted: false }),
      request: makeApprovalRequestCreationRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview({ approval_request_still_not_created: false }),
      request: makeApprovalRequestCreationRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview({ approval_request_candidate: { creation_allowed: true } }),
      request: makeApprovalRequestCreationRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview(),
      request: makeApprovalRequestCreationRequest({ explicit: false })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview(),
      request: makeApprovalRequestCreationRequest({ text: "Only inspect the current preview packet without asking to make any approval object." })
    }),
    /explicit approval request creation request must be detectable/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview(),
      request: makeApprovalRequestCreationRequest({
        authorization: {
          operator_confirmed: true,
          guard_token_consumed: true,
          production_gate_opened: false,
          approval_request_creation_allowed: false
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview(),
      request: makeApprovalRequestCreationRequest({
        authorization: {
          operator_confirmed: true,
          guard_token_consumed: false,
          production_gate_opened: true,
          approval_request_creation_allowed: false
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview(),
      request: makeApprovalRequestCreationRequest({
        authorization: {
          operator_confirmed: true,
          guard_token_consumed: false,
          production_gate_opened: false,
          approval_request_creation_allowed: true
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildApprovalRequestCreationDenialPreview({
      preflight: makePhase42HApprovalPreflightPreview({
        full_run_all_status: "passed",
        full_run_all_passed_claimed: true
      }),
      request: makeApprovalRequestCreationRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  const riskyText = [
    "Create the approval request now.",
    "Create pending engine candidate.",
    "Production write and production promotion.",
    "Open production gate.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create audit receipt, create backup snapshot, execute rollback.",
    "Claim full run-all passed."
  ].join(" ");
  const result = buildApprovalRequestCreationDenialPreview({
    preflight: makePhase42HApprovalPreflightPreview(),
    request: makeApprovalRequestCreationRequest({ text: riskyText })
  });
  assert.equal(result.request_intent.approval_request_create, true);
  assert.equal(result.request_intent.pending_engine_candidate_create, true);
  assert.equal(result.request_intent.production_write, true);
  assert.equal(result.request_intent.production_promotion, true);
  assert.equal(result.request_intent.gate_open, true);
  assert.equal(result.request_intent.guard_token_consume, true);
  assert.equal(result.request_intent.adoption, true);
  assert.equal(result.request_intent.settlement, true);
  assert.equal(result.request_intent.canon_update, true);
  assert.equal(result.request_intent.active_engine_update, true);
  assert.equal(result.request_intent.audit_receipt_create, true);
  assert.equal(result.request_intent.backup_snapshot_create, true);
  assert.equal(result.request_intent.rollback_restore_execute, true);
  assert.equal(result.request_intent.full_run_all_passed_claim, true);
  assertProtectedFalse(result, "riskyResult");
}

console.log("Phase42I production candidate store promotion gate approval request creation denial smoke tests passed.");