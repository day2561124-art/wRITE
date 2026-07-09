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
  phase42h_approval_request_preflight_generated: false,
  phase42h_approval_request_preflight_persisted: false,
  phase42g_denial_verified: false,
  explicit_approval_request_preflight_detected: false,
  approval_request_candidate_shape_verified: false,
  approval_request_scope_verified: false,
  approval_request_preflight_accepted: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  guard_token_consumed: false,
  operator_confirmation_granted: false,
  production_promotion_gate_opened: false,
  production_candidate_saved: false,
  production_write_performed: false,
  production_promotion_performed: false,
  production_candidate_store_mutated: false,
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
  "approval_request_create",
  "pending_engine_candidate_create",
  "guard_token_consume",
  "operator_confirmation_grant",
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "full_run_all_passed_claim",
];

const MUTATION_FIELDS = [
  "phase42h_approval_request_preflight_persisted",
  "approval_request_created",
  "pending_engine_candidate_created",
  "guard_token_consumed",
  "operator_confirmation_granted",
  "production_promotion_gate_opened",
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "production_candidate_store_mutated",
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
  "phase42g_denial_required",
  "explicit_phase42h_approval_request_preflight_required",
  "approval_request_preflight_preview_only",
  "approval_request_preflight_must_not_persist",
  "approval_request_candidate_shape_required",
  "approval_request_scope_required",
  "approval_request_must_not_be_created",
  "approval_request_preflight_must_not_create_pending_engine_candidate",
  "approval_request_preflight_must_not_consume_guard_token",
  "approval_request_preflight_must_not_open_gate",
  "approval_request_preflight_must_not_write_production",
  "approval_request_preflight_must_not_promote_production",
  "approval_request_preflight_must_not_mutate_production_candidate_store",
  "approval_request_preflight_must_not_trigger_adoption",
  "approval_request_preflight_must_not_trigger_settlement",
  "approval_request_preflight_must_not_update_canon",
  "approval_request_preflight_must_not_update_active_engine",
  "approval_request_preflight_must_not_execute_audit_backup_rollback",
  "full_run_all_must_remain_pending_until_explicitly_rerun",
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeCandidateSnapshot() {
  const content = {
    candidate_id: "phase42-production-candidate-store-promotion-candidate",
    source_route: "chatgpt_native_full_neural_writing_handoff_preview",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    content_hash: "sha256:phase42-preview-candidate-content-hash",
    preview_only: true,
  };

  return {
    ...content,
    identity_hash: `sha256:${digest(content)}`,
  };
}

function makeGuardToken(candidate) {
  const scope = {
    candidate_id: candidate.candidate_id,
    candidate_identity_hash: candidate.identity_hash,
    target_store_scope: candidate.target_store_scope,
    operation: "production_candidate_store_promotion_gate",
    mutation_allowed: false,
  };

  const scope_hash = `sha256:${digest(scope)}`;

  return {
    value: `phase42_guard_${digest({ scope_hash }).slice(0, 24)}`,
    shape: "phase42_guard_<24hex>",
    scope,
    scope_hash,
    preview_only: true,
    consumed: false,
    consumption_authorized: false,
    grants: null,
  };
}

function makePhase42GConsumptionDenial() {
  const candidate = makeCandidateSnapshot();
  const guard_token = makeGuardToken(candidate);

  return {
    accepted: true,
    kind: "phase42g_guard_token_consumption_denial_preview",
    phase: "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke",
    mode: "guard_token_consumption_denial_preview_only",
    source_phase: "phase42f-production-candidate-store-promotion-gate-guard-token-pre-consumption-boundary-smoke",
    source_chain: [...PHASE41_CHAIN, "phase42a", "phase42b", "phase42c", "phase42d", "phase42e", "phase42f"],
    candidate,
    guard_token,
    explicit_guard_token_consumption_request_detected: true,
    guard_token_consumption_denied: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    production_promotion_gate_opened: false,
    production_write_performed: false,
    production_promotion_performed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
  };
}

function makeApprovalRequestCandidate(previous) {
  const scope = {
    candidate_id: previous.candidate.candidate_id,
    candidate_identity_hash: previous.candidate.identity_hash,
    guard_token_scope_hash: previous.guard_token.scope_hash,
    source_phase: previous.phase,
    source_denial_kind: previous.kind,
    source_store_scope: previous.candidate.source_store_scope,
    target_store_scope: previous.candidate.target_store_scope,
    requested_operation: "production_candidate_store_promotion_approval_request_preflight",
    mutation_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
  };

  const payload = {
    kind: "approval_request_candidate",
    phase: "phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke",
    source_phase: previous.phase,
    preview_only: true,
    scope,
    scope_hash: `sha256:${digest(scope)}`,
    requested_by: "operator_preview_boundary_smoke",
    requested_reason: "preflight_shape_and_scope_verification_only",
    approval_request_created: false,
    pending_engine_candidate_created: false,
  };

  return {
    ...payload,
    candidate_hash: `sha256:${digest(payload)}`,
  };
}

function makeApprovalRequestPreflightContract(overrides = {}) {
  return {
    kind: "phase42h_approval_request_preflight_boundary_contract",
    mode: "approval_request_preflight_preview_only",
    required_previous_phase: "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke",
    blocked_actions: [...BLOCKED_ACTIONS],
    phase42g_denial_required: true,
    explicit_phase42h_approval_request_preflight_required: true,
    approval_request_preflight_preview_only: true,
    approval_request_preflight_must_not_persist: true,
    approval_request_candidate_shape_required: true,
    approval_request_scope_required: true,
    approval_request_must_not_be_created: true,
    approval_request_preflight_must_not_create_pending_engine_candidate: true,
    approval_request_preflight_must_not_consume_guard_token: true,
    approval_request_preflight_must_not_open_gate: true,
    approval_request_preflight_must_not_write_production: true,
    approval_request_preflight_must_not_promote_production: true,
    approval_request_preflight_must_not_mutate_production_candidate_store: true,
    approval_request_preflight_must_not_trigger_adoption: true,
    approval_request_preflight_must_not_trigger_settlement: true,
    approval_request_preflight_must_not_update_canon: true,
    approval_request_preflight_must_not_update_active_engine: true,
    approval_request_preflight_must_not_execute_audit_backup_rollback: true,
    full_run_all_must_remain_pending_until_explicitly_rerun: true,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    guard_token_consumption_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = text.toLowerCase();
  return {
    phase42h_approval_preflight:
      normalized.includes("phase42h") &&
      normalized.includes("approval request") &&
      normalized.includes("preflight"),
    approval_request_create:
      normalized.includes("create approval request") || normalized.includes("approval request created"),
    pending_engine: normalized.includes("pending engine candidate"),
    guard_token_consume:
      normalized.includes("consume guard token") || normalized.includes("guard token consumed"),
    gate_open: normalized.includes("open production gate") || normalized.includes("gate open"),
    production_write: normalized.includes("production write") || normalized.includes("write production"),
    production_promotion: normalized.includes("production promotion") || normalized.includes("promote production"),
    adoption: normalized.includes("adoption") || normalized.includes("adopt"),
    settlement: normalized.includes("settlement") || normalized.includes("settle"),
    canon: normalized.includes("canon"),
    active_engine: normalized.includes("active_engine") || normalized.includes("active engine"),
    audit_receipt: normalized.includes("audit receipt"),
    backup_snapshot: normalized.includes("backup snapshot"),
    rollback_restore: normalized.includes("rollback"),
    full_run_all_passed: normalized.includes("full run-all passed"),
  };
}

function validatePhase42GDenial(previous) {
  assert.equal(previous.accepted, true);
  assert.equal(previous.kind, "phase42g_guard_token_consumption_denial_preview");
  assert.equal(previous.mode, "guard_token_consumption_denial_preview_only");
  assert.equal(previous.explicit_guard_token_consumption_request_detected, true);
  assert.equal(previous.guard_token_consumption_denied, true);
  assert.equal(previous.guard_token_consumption_authorized, false);
  assert.equal(previous.guard_token_consumed, false);
  assert.equal(previous.guard_token.consumed, false);
  assert.equal(previous.guard_token.consumption_authorized, false);
  assert.equal(previous.production_promotion_gate_opened, false);
  assert.equal(previous.production_write_performed, false);
  assert.equal(previous.production_promotion_performed, false);
  assert.equal(previous.approval_request_created, false);
  assert.equal(previous.pending_engine_candidate_created, false);
  assert.equal(previous.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(previous.full_run_all_passed_claimed, false);
}

function validateApprovalRequestCandidate(candidate, previous) {
  assert.equal(candidate.kind, "approval_request_candidate");
  assert.equal(candidate.phase, "phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke");
  assert.equal(candidate.source_phase, previous.phase);
  assert.equal(candidate.preview_only, true);
  assert.equal(candidate.scope.candidate_id, previous.candidate.candidate_id);
  assert.equal(candidate.scope.candidate_identity_hash, previous.candidate.identity_hash);
  assert.equal(candidate.scope.guard_token_scope_hash, previous.guard_token.scope_hash);
  assert.equal(candidate.scope.source_denial_kind, previous.kind);
  assert.equal(candidate.scope.requested_operation, "production_candidate_store_promotion_approval_request_preflight");
  assert.equal(candidate.scope.mutation_allowed, false);
  assert.equal(candidate.scope.approval_request_creation_allowed, false);
  assert.equal(candidate.scope.pending_engine_candidate_creation_allowed, false);
  assert.equal(candidate.scope_hash, `sha256:${digest(candidate.scope)}`);
  assert.match(candidate.candidate_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(candidate.approval_request_created, false);
  assert.equal(candidate.pending_engine_candidate_created, false);
}

function validatePreflightContract(contract) {
  assert.equal(contract.kind, "phase42h_approval_request_preflight_boundary_contract");
  assert.equal(contract.mode, "approval_request_preflight_preview_only");
  assert.equal(contract.required_previous_phase, "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke");

  for (const field of CONTRACT_TRUE_FIELDS) {
    assert.equal(contract[field], true, `Expected ${field} to be true`);
  }

  assert.equal(contract.production_write_allowed, false);
  assert.equal(contract.production_promotion_allowed, false);
  assert.equal(contract.production_gate_open_allowed, false);
  assert.equal(contract.approval_request_creation_allowed, false);
  assert.equal(contract.pending_engine_candidate_creation_allowed, false);
  assert.equal(contract.guard_token_consumption_allowed, false);
  assert.equal(contract.audit_receipt_creation_allowed, false);
  assert.equal(contract.backup_snapshot_creation_allowed, false);
  assert.equal(contract.rollback_restore_execution_allowed, false);

  for (const action of BLOCKED_ACTIONS) {
    assert.ok(contract.blocked_actions.includes(action), `Missing blocked action: ${action}`);
  }
}

function assertNoMutation(result) {
  for (const field of MUTATION_FIELDS) {
    assert.equal(result[field], false, `Expected result.${field} to remain false`);
    assert.equal(result.state_after[field], false, `Expected state_after.${field} to remain false`);
  }
}

function buildApprovalRequestPreflightPreview({ request_text, previous, contract, approval_candidate }) {
  const intent = classifyIntent(request_text);

  assert.equal(intent.phase42h_approval_preflight, true, "Phase42H approval request preflight intent is required");
  validatePhase42GDenial(previous);
  validatePreflightContract(contract);
  validateApprovalRequestCandidate(approval_candidate, previous);

  const state_after = {
    ...clone(BASELINE_STATE),
    phase42h_approval_request_preflight_generated: true,
    phase42g_denial_verified: true,
    explicit_approval_request_preflight_detected: true,
    approval_request_candidate_shape_verified: true,
    approval_request_scope_verified: true,
    approval_request_preflight_accepted: true,
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_approval_request_preflight_boundary_preview_only",
    phase: "phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke",
    previous_phase: previous.phase,
    contract,
    approval_request_candidate: approval_candidate,
    phase42h_approval_request_preflight_generated: true,
    phase42h_approval_request_preflight_persisted: false,
    phase42g_denial_verified: true,
    explicit_approval_request_preflight_detected: true,
    approval_request_candidate_shape_verified: true,
    approval_request_scope_verified: true,
    approval_request_preflight_accepted: true,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    guard_token_consumed: false,
    operator_confirmation_granted: false,
    production_promotion_gate_opened: false,
    production_candidate_saved: false,
    production_write_performed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    direct_requests_detected: intent,
    state_after,
  };
}

const previous = makePhase42GConsumptionDenial();
const contract = makeApprovalRequestPreflightContract();
const approval_candidate = makeApprovalRequestCandidate(previous);

{
  const result = buildApprovalRequestPreflightPreview({
    request_text:
      "Start Phase42H approval request preflight boundary smoke. Detect explicit approval request preflight. Verify approval request candidate shape and scope. Do not create approval request. Do not create pending engine candidate. Do not consume guard token. Do not open production gate. Do not write production. Do not promote production. Do not adopt. Do not settle. Do not update Canon. Do not update active_engine. Do not create audit receipt. Do not create backup snapshot. Do not execute rollback. Do not claim full run-all passed.",
    previous,
    contract,
    approval_candidate,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.phase42h_approval_request_preflight_generated, true);
  assert.equal(result.phase42h_approval_request_preflight_persisted, false);
  assert.equal(result.phase42g_denial_verified, true);
  assert.equal(result.explicit_approval_request_preflight_detected, true);
  assert.equal(result.approval_request_candidate_shape_verified, true);
  assert.equal(result.approval_request_scope_verified, true);
  assert.equal(result.approval_request_preflight_accepted, true);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assertNoMutation(result);
  assert.equal(result.direct_requests_detected.approval_request_create, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.guard_token_consume, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  assert.equal(result.direct_requests_detected.audit_receipt, true);
  assert.equal(result.direct_requests_detected.backup_snapshot, true);
  assert.equal(result.direct_requests_detected.rollback_restore, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

for (const badPrevious of [
  { ...previous, accepted: false },
  { ...previous, guard_token_consumption_denied: false },
  { ...previous, guard_token_consumed: true },
  { ...previous, approval_request_created: true },
  { ...previous, full_run_all_status: "passed", full_run_all_passed_claimed: true },
]) {
  assert.throws(() =>
    buildApprovalRequestPreflightPreview({
      request_text: "Start Phase42H approval request preflight boundary smoke.",
      previous: badPrevious,
      contract,
      approval_candidate: makeApprovalRequestCandidate(previous),
    }),
  );
}

for (const badContract of [
  makeApprovalRequestPreflightContract({ mode: "approval_request_creation" }),
  makeApprovalRequestPreflightContract({ approval_request_creation_allowed: true }),
  makeApprovalRequestPreflightContract({ pending_engine_candidate_creation_allowed: true }),
  makeApprovalRequestPreflightContract({ guard_token_consumption_allowed: true }),
  makeApprovalRequestPreflightContract({ production_gate_open_allowed: true }),
  makeApprovalRequestPreflightContract({ production_write_allowed: true }),
  makeApprovalRequestPreflightContract({ production_promotion_allowed: true }),
  makeApprovalRequestPreflightContract({ audit_receipt_creation_allowed: true }),
  makeApprovalRequestPreflightContract({ backup_snapshot_creation_allowed: true }),
  makeApprovalRequestPreflightContract({ rollback_restore_execution_allowed: true }),
  makeApprovalRequestPreflightContract({ approval_request_must_not_be_created: false }),
]) {
  assert.throws(() =>
    buildApprovalRequestPreflightPreview({
      request_text: "Start Phase42H approval request preflight boundary smoke.",
      previous,
      contract: badContract,
      approval_candidate,
    }),
  );
}

for (const badCandidate of [
  { ...approval_candidate, kind: "approval_request" },
  { ...approval_candidate, preview_only: false },
  { ...approval_candidate, scope: { ...approval_candidate.scope, candidate_id: "wrong" } },
  { ...approval_candidate, scope: { ...approval_candidate.scope, mutation_allowed: true } },
  { ...approval_candidate, scope: { ...approval_candidate.scope, approval_request_creation_allowed: true } },
  { ...approval_candidate, scope: { ...approval_candidate.scope, pending_engine_candidate_creation_allowed: true } },
  { ...approval_candidate, approval_request_created: true },
  { ...approval_candidate, pending_engine_candidate_created: true },
  { ...approval_candidate, scope_hash: "sha256:wrong" },
]) {
  assert.throws(() =>
    buildApprovalRequestPreflightPreview({
      request_text: "Start Phase42H approval request preflight boundary smoke.",
      previous,
      contract,
      approval_candidate: badCandidate,
    }),
  );
}

assert.throws(() =>
  buildApprovalRequestPreflightPreview({
    request_text: "Start approval work without required boundary wording.",
    previous,
    contract,
    approval_candidate,
  }),
);

console.log("Phase42H production candidate store promotion gate approval request preflight boundary smoke tests passed.");
