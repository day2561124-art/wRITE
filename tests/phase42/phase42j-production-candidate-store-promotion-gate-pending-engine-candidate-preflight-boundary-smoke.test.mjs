import assert from "node:assert/strict";
import crypto from "node:crypto";

const CURRENT_PHASE = "Phase42J";
const CURRENT_PHASE_SLUG = "phase42j-production-candidate-store-promotion-gate-pending-engine-candidate-preflight-boundary-smoke";
const PREVIOUS_PHASE = "Phase42I";
const PREVIOUS_PHASE_SLUG = "phase42i-production-candidate-store-promotion-gate-approval-request-creation-denial-smoke";
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
  "phase42j_pending_engine_candidate_preflight_generated",
  "phase42i_approval_request_creation_denial_accepted",
  "explicit_pending_engine_candidate_preflight_detected",
  "pending_engine_candidate_shape_verified",
  "pending_engine_candidate_scope_verified",
  "pending_engine_candidate_remains_not_created",
  "pending_engine_candidate_preflight_preview_only",
  "preflight_blocks_production_write",
  "preflight_blocks_production_promotion",
  "preflight_blocks_gate_open",
  "approval_request_remains_not_created",
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
    phase42j_pending_engine_candidate_preflight_generated: false,
    phase42j_pending_engine_candidate_preflight_persisted: false,
    phase42i_approval_request_creation_denial_accepted: false,
    explicit_pending_engine_candidate_preflight_detected: false,
    pending_engine_candidate_shape_verified: false,
    pending_engine_candidate_scope_verified: false,
    pending_engine_candidate_remains_not_created: false,
    pending_engine_candidate_preflight_preview_only: false,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    approval_request_remains_not_created: false,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    preflight_blocks_production_write: false,
    preflight_blocks_production_promotion: false,
    preflight_blocks_gate_open: false,
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

function makePhase42IApprovalCreationDenialPreview(overrides = {}) {
  const approvalRequestCandidate = makeApprovalRequestCandidate(overrides.approval_request_candidate ?? {});

  return Object.freeze({
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "approval_request_creation_denied_preview_only",
    mode: "approval_request_creation_denial_smoke",
    preview_only: true,
    persisted: false,
    phase42i_approval_request_creation_denial_generated: true,
    explicit_approval_request_creation_request_detected: true,
    approval_request_creation_denied: true,
    approval_request_creation_not_authorized: true,
    approval_request_remains_not_created: true,
    approval_request_candidate: approvalRequestCandidate,
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
    ...overrides,
    approval_request_candidate: approvalRequestCandidate
  });
}

function makePendingEngineCandidate(overrides = {}) {
  const base = {
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
    grants_active_engine_update: false
  };

  return Object.freeze({ ...base, ...overrides });
}

function makePendingEngineCandidatePreflightRequest(overrides = {}) {
  return Object.freeze({
    kind: "pending_engine_candidate_preflight_request",
    explicit: true,
    text: [
      "Preflight the pending engine candidate for the production candidate store promotion gate.",
      "Verify pending engine candidate shape and scope only.",
      "Do not create pending engine candidate.",
      "Do not create approval request.",
      "Do not write production.",
      "Do not promote production.",
      "Do not open production gate.",
      "Do not consume guard token.",
      "Do not adopt or settle.",
      "Do not update Canon or active_engine.",
      "Do not create audit receipt, create backup snapshot, or execute rollback.",
      "Do not claim full run-all passed."
    ].join(" "),
    requested_action: "preflight_pending_engine_candidate",
    target_phase: CURRENT_PHASE,
    source_phase: PREVIOUS_PHASE,
    preview_only: true,
    authorization: {
      operator_confirmed: true,
      approval_request_created: false,
      guard_token_consumed: false,
      production_gate_opened: false,
      pending_engine_candidate_creation_allowed: false
    },
    ...overrides
  });
}

function classifyIntent(text) {
  return Object.freeze({
    pending_engine_candidate_preflight: /\bpreflight\b[\s\S]*\bpending engine candidate\b/i.test(text) || /\bpending engine candidate\b[\s\S]*\bpreflight\b/i.test(text),
    pending_engine_candidate_create: /\b(create|make|open)\b[\s\S]*\bpending engine candidate\b/i.test(text) || /\bpending engine candidate\b[\s\S]*\b(create|make|open)\b/i.test(text),
    approval_request_create: /\b(create|make|open)\b[\s\S]*\bapproval request\b/i.test(text) || /\bapproval request\b[\s\S]*\b(create|make|open)\b/i.test(text),
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
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.grants_pending_engine_candidate, false);
  assert.equal(candidate.grants_production_write, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.match(candidate.candidate_hash, /^sha256:/);
}

function validatePhase42IDenial(denial) {
  assert.equal(denial.phase, PREVIOUS_PHASE);
  assert.equal(denial.phase_slug, PREVIOUS_PHASE_SLUG);
  assert.equal(denial.accepted, true);
  assert.equal(denial.reason, "approval_request_creation_denied_preview_only");
  assert.equal(denial.mode, "approval_request_creation_denial_smoke");
  assert.equal(denial.preview_only, true);
  assert.equal(denial.persisted, false);
  assert.equal(denial.phase42i_approval_request_creation_denial_generated, true);
  assert.equal(denial.explicit_approval_request_creation_request_detected, true);
  assert.equal(denial.approval_request_creation_denied, true);
  assert.equal(denial.approval_request_creation_not_authorized, true);
  assert.equal(denial.approval_request_remains_not_created, true);
  validateApprovalRequestCandidate(denial.approval_request_candidate);
  assert.equal(denial.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
  assert.equal(denial.full_run_all_passed_claimed, false);
  assert.equal(denial.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
  assertProtectedFalse(denial, "phase42iDenial");
}

function validatePendingEngineCandidate(candidate) {
  assert.equal(candidate.kind, "pending_engine_candidate_candidate");
  assert.equal(candidate.request_scope, "production_candidate_store_promotion_gate");
  assert.equal(candidate.source_store_scope, "sandbox_candidate_store");
  assert.equal(candidate.target_store_scope, "pending_engine_candidate_store");
  assert.equal(candidate.production_target_scope, "production_candidate_store");
  assert.equal(candidate.approval_request_required, true);
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.creation_allowed, false);
  assert.equal(candidate.created, false);
  assert.equal(candidate.grants_production_write, false);
  assert.equal(candidate.grants_production_promotion, false);
  assert.equal(candidate.grants_gate_open, false);
  assert.equal(candidate.grants_adoption, false);
  assert.equal(candidate.grants_settlement, false);
  assert.equal(candidate.grants_canon_update, false);
  assert.equal(candidate.grants_active_engine_update, false);
  assert.match(candidate.pending_engine_candidate_hash, /^sha256:/);
  assert.match(candidate.source_candidate_hash, /^sha256:/);
}

function validatePreflightRequest(request) {
  assert.equal(request.kind, "pending_engine_candidate_preflight_request");
  assert.equal(request.explicit, true);
  assert.equal(request.requested_action, "preflight_pending_engine_candidate");
  assert.equal(request.target_phase, CURRENT_PHASE);
  assert.equal(request.source_phase, PREVIOUS_PHASE);
  assert.equal(request.preview_only, true);

  const intent = classifyIntent(request.text);
  assert.equal(intent.pending_engine_candidate_preflight, true, "explicit pending engine candidate preflight must be detectable");
  assert.equal(request.authorization.operator_confirmed, true);
  assert.equal(request.authorization.approval_request_created, false);
  assert.equal(request.authorization.guard_token_consumed, false);
  assert.equal(request.authorization.production_gate_opened, false);
  assert.equal(request.authorization.pending_engine_candidate_creation_allowed, false);
  return intent;
}

function buildPendingEngineCandidatePreflightBoundaryPreview({ previous, request, candidate = makePendingEngineCandidate(), state = makeBaselineState() } = {}) {
  validatePhase42IDenial(previous);
  const intent = validatePreflightRequest(request);
  validatePendingEngineCandidate(candidate);

  const scopeHash = stableHash({
    pending_engine_candidate_id: candidate.pending_engine_candidate_id,
    source_candidate_id: candidate.source_candidate_id,
    request_scope: candidate.request_scope,
    target_store_scope: candidate.target_store_scope,
    production_target_scope: candidate.production_target_scope
  });

  const preflight = {
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    accepted: true,
    reason: "pending_engine_candidate_preflight_boundary_preview_only",
    mode: "pending_engine_candidate_preflight_boundary_smoke",
    preview_only: true,
    persisted: false,
    phase42j_pending_engine_candidate_preflight_generated: true,
    phase42j_pending_engine_candidate_preflight_persisted: false,
    phase42i_approval_request_creation_denial_accepted: true,
    explicit_pending_engine_candidate_preflight_detected: intent.pending_engine_candidate_preflight,
    pending_engine_candidate_shape_verified: true,
    pending_engine_candidate_scope_verified: true,
    pending_engine_candidate_remains_not_created: true,
    pending_engine_candidate_preflight_preview_only: true,
    approval_request_created: false,
    approval_request_creation_authorized: false,
    approval_request_remains_not_created: true,
    pending_engine_candidate_created: false,
    pending_engine_candidate_creation_authorized: false,
    production_candidate_store_mutated: false,
    production_candidate_store_write_executed: false,
    production_candidate_store_promotion_executed: false,
    production_promotion_gate_opened: false,
    guard_token_consumed: false,
    preflight_blocks_production_write: true,
    preflight_blocks_production_promotion: true,
    preflight_blocks_gate_open: true,
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
    pending_engine_candidate_candidate: candidate,
    pending_engine_candidate_scope_hash: scopeHash,
    preflight_packet: {
      kind: "pending_engine_candidate_preflight_boundary_packet",
      previewed_action: "preflight_pending_engine_candidate",
      preview_only: true,
      verifies_shape: true,
      verifies_scope: true,
      creates_pending_engine_candidate: false,
      creates_approval_request: false,
      writes_production: false,
      promotes_production: false,
      opens_gate: false,
      consumes_guard_token: false,
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

  for (const field of PREFLIGHT_TRUE_FIELDS) {
    assert.equal(preflight[field], true, `${field} must be true in preflight boundary preview`);
  }

  assertProtectedFalse(preflight, "preflight");
  assertProtectedFalse(preflight.state_before, "state_before");
  assertProtectedFalse(preflight.state_after, "state_after");
  assert.equal(preflight.preflight_packet.creates_pending_engine_candidate, false);
  assert.equal(preflight.preflight_packet.creates_approval_request, false);
  assert.equal(preflight.preflight_packet.writes_production, false);
  assert.equal(preflight.preflight_packet.promotes_production, false);
  assert.equal(preflight.preflight_packet.opens_gate, false);
  assert.equal(preflight.preflight_packet.consumes_guard_token, false);
  assert.equal(preflight.preflight_packet.updates_canon, false);
  assert.equal(preflight.preflight_packet.updates_active_engine, false);
  return Object.freeze(preflight);
}

function assertThrowsWithMessage(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

{
  const result = buildPendingEngineCandidatePreflightBoundaryPreview({
    previous: makePhase42IApprovalCreationDenialPreview(),
    request: makePendingEngineCandidatePreflightRequest()
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "pending_engine_candidate_preflight_boundary_preview_only");
  assert.equal(result.pending_engine_candidate_shape_verified, true);
  assert.equal(result.pending_engine_candidate_scope_verified, true);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.guard_token_consumed, false);
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview({ accepted: false }),
      request: makePendingEngineCandidatePreflightRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview({ approval_request_remains_not_created: false }),
      request: makePendingEngineCandidatePreflightRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview({ approval_request_created: true }),
      request: makePendingEngineCandidatePreflightRequest()
    }),
    /phase42iDenial\.approval_request_created must remain false/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
      request: makePendingEngineCandidatePreflightRequest()
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({ explicit: false })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({ text: "Only inspect the current preview packet without requesting the next candidate boundary." })
    }),
    /explicit pending engine candidate preflight must be detectable/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: true,
          guard_token_consumed: false,
          production_gate_opened: false,
          pending_engine_candidate_creation_allowed: false
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          guard_token_consumed: true,
          production_gate_opened: false,
          pending_engine_candidate_creation_allowed: false
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          guard_token_consumed: false,
          production_gate_opened: true,
          pending_engine_candidate_creation_allowed: false
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest({
        authorization: {
          operator_confirmed: true,
          approval_request_created: false,
          guard_token_consumed: false,
          production_gate_opened: false,
          pending_engine_candidate_creation_allowed: true
        }
      })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest(),
      candidate: makePendingEngineCandidate({ preview_only: false })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest(),
      candidate: makePendingEngineCandidate({ creation_allowed: true })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest(),
      candidate: makePendingEngineCandidate({ created: true })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest(),
      candidate: makePendingEngineCandidate({ approval_request_created: true })
    }),
    /Expected values to be strictly equal/
  );
}

{
  assertThrowsWithMessage(
    () => buildPendingEngineCandidatePreflightBoundaryPreview({
      previous: makePhase42IApprovalCreationDenialPreview(),
      request: makePendingEngineCandidatePreflightRequest(),
      candidate: makePendingEngineCandidate({ grants_production_write: true })
    }),
    /Expected values to be strictly equal/
  );
}

{
  const riskyText = [
    "Preflight the pending engine candidate now.",
    "Create pending engine candidate.",
    "Create approval request.",
    "Production write and production promotion.",
    "Open production gate.",
    "Consume guard token.",
    "Adoption and settlement should follow.",
    "Update Canon and update active_engine.",
    "Create audit receipt, create backup snapshot, execute rollback.",
    "Claim full run-all passed."
  ].join(" ");
  const result = buildPendingEngineCandidatePreflightBoundaryPreview({
    previous: makePhase42IApprovalCreationDenialPreview(),
    request: makePendingEngineCandidatePreflightRequest({ text: riskyText })
  });
  assert.equal(result.request_intent.pending_engine_candidate_preflight, true);
  assert.equal(result.request_intent.pending_engine_candidate_create, true);
  assert.equal(result.request_intent.approval_request_create, true);
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

console.log("Phase42J production candidate store promotion gate pending engine candidate preflight boundary smoke tests passed.");
