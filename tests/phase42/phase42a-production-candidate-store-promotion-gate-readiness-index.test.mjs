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
  phase42a_gate_readiness_index_generated: false,
  phase42a_gate_readiness_index_persisted: false,
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
  backup_snapshot_created: false,
  rollback_restore_executed: false,
  audit_receipt_created: false,
  full_run_all_passed_claimed: false,
});

const BLOCKED_ACTIONS = [
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
  "guard_token_consume",
  "approval_request_create",
  "pending_engine_candidate_create",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "audit_receipt_create",
  "full_run_all_passed_claim",
];

const MUTATION_FIELDS = [
  "phase42a_gate_readiness_index_persisted",
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
  "backup_snapshot_created",
  "rollback_restore_executed",
  "audit_receipt_created",
  "full_run_all_passed_claimed",
];

const CONTRACT_TRUE_FIELDS = [
  "phase41_final_closure_required",
  "explicit_phase42a_readiness_index_request_required",
  "index_preview_only",
  "index_must_not_persist",
  "production_gate_must_remain_closed",
  "production_write_must_remain_blocked",
  "production_promotion_must_remain_blocked",
  "production_candidate_store_must_not_mutate",
  "guard_token_must_remain_unconsumed",
  "approval_request_must_not_be_created",
  "pending_engine_candidate_must_not_be_created",
  "adoption_must_not_run",
  "settlement_must_not_run",
  "canon_must_not_update",
  "active_engine_must_not_update",
  "backup_snapshot_plan_required",
  "rollback_restore_plan_required",
  "audit_receipt_plan_required",
  "two_step_operator_confirmation_required",
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

function makePhase41Closure(overrides = {}) {
  return {
    accepted: true,
    phase: "Phase41M",
    kind: "promotion_boundary_final_closure_operator_handoff_seal",
    chain: [...PHASE41_CHAIN],
    phase41_closed: true,
    closure_scope: "dry_run_boundary_only",
    operator_handoff_ready: true,
    promotion_boundary_final_closure_sealed: true,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    focused_regression_passed: ["Phase41M", "Phase41L", "Phase41K", "Phase41J", "Phase41I", "Phase41H", "Phase41G"],
    ...overrides,
  };
}

function makeGateContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_readiness_index_contract",
    mode: "readiness_index_preview_only",
    source_phase: "Phase41M",
    target_phase: "Phase42A",
    target_gate: "production_candidate_store_promotion_gate",
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase41_final_closure_required: true,
    explicit_phase42a_readiness_index_request_required: true,
    index_preview_only: true,
    index_must_not_persist: true,
    production_gate_must_remain_closed: true,
    production_write_must_remain_blocked: true,
    production_promotion_must_remain_blocked: true,
    production_candidate_store_must_not_mutate: true,
    guard_token_must_remain_unconsumed: true,
    approval_request_must_not_be_created: true,
    pending_engine_candidate_must_not_be_created: true,
    adoption_must_not_run: true,
    settlement_must_not_run: true,
    canon_must_not_update: true,
    active_engine_must_not_update: true,
    backup_snapshot_plan_required: true,
    rollback_restore_plan_required: true,
    audit_receipt_plan_required: true,
    two_step_operator_confirmation_required: true,
    full_run_all_must_remain_pending_until_explicitly_rerun: true,
    ...overrides,
  };
}

function makeBackupPlan(overrides = {}) {
  return {
    kind: "backup_snapshot_plan",
    target_store_scope: "production_candidate_store",
    planned: true,
    executed: false,
    persisted: false,
    snapshot_id: null,
    required_before_future_promotion: true,
    ...overrides,
  };
}

function makeRollbackPlan(overrides = {}) {
  return {
    kind: "rollback_restore_plan",
    target_store_scope: "production_candidate_store",
    planned: true,
    executed: false,
    persisted: false,
    restore_id: null,
    required_before_future_promotion: true,
    ...overrides,
  };
}

function makeAuditPlan(overrides = {}) {
  return {
    kind: "promotion_audit_receipt_plan",
    target_store_scope: "production_candidate_store",
    planned: true,
    receipt_created: false,
    persisted: false,
    receipt_id: null,
    required_before_future_promotion: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /phase42a/.test(normalized) && /readiness index|gate readiness|promotion gate/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    gate_open: /\bopen\b.*\bgate\b|\bgate\b.*\bopen\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
    full_run_all_passed: /full run-all passed|full run all passed|full_run_all_passed/.test(normalized),
  };
}

function validatePhase41Closure(closure) {
  if (!closure?.accepted) return "phase41_final_closure_not_accepted";
  if (closure.phase !== "Phase41M" || closure.kind !== "promotion_boundary_final_closure_operator_handoff_seal") return "phase41_final_closure_kind_invalid";
  if (closure.phase41_closed !== true || closure.operator_handoff_ready !== true || closure.promotion_boundary_final_closure_sealed !== true) return "phase41_final_closure_not_sealed";
  for (const phase of PHASE41_CHAIN) if (!closure.chain?.includes(phase)) return "phase41_chain_incomplete";
  if (closure.closure_scope !== "dry_run_boundary_only") return "phase41_closure_scope_invalid";
  if (closure.production_write_allowed !== false || closure.production_promotion_allowed !== false) return "phase41_closure_write_policy_invalid";
  if (closure.production_write_performed !== false || closure.production_promotion_performed !== false || closure.production_candidate_store_mutated !== false) return "phase41_closure_already_mutated_production";
  for (const field of ["guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "full_run_all_passed_claimed"]) if (closure[field] !== false) return "phase41_closure_forbidden_action_detected";
  if (closure.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase41_full_run_all_status_invalid";
  return null;
}

function validateGateContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_readiness_index_contract") return "gate_readiness_contract_missing";
  if (contract.mode !== "readiness_index_preview_only") return "gate_readiness_contract_mode_invalid";
  if (contract.source_phase !== "Phase41M" || contract.target_phase !== "Phase42A") return "gate_readiness_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "gate_readiness_contract_target_gate_invalid";
  if (contract.production_write_allowed !== false) return "gate_readiness_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "gate_readiness_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "gate_readiness_contract_allows_gate_open";
  if (contract.approval_request_creation_allowed !== false) return "gate_readiness_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "gate_readiness_contract_allows_pending_engine_candidate";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "gate_readiness_contract_required_field_invalid";
  return null;
}

function validateBackupPlan(plan) {
  if (plan?.kind !== "backup_snapshot_plan") return "backup_snapshot_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store") return "backup_snapshot_plan_scope_invalid";
  if (plan.planned !== true || plan.required_before_future_promotion !== true) return "backup_snapshot_plan_not_ready";
  if (plan.executed !== false || plan.persisted !== false || plan.snapshot_id !== null) return "backup_snapshot_plan_already_performed";
  return null;
}

function validateRollbackPlan(plan) {
  if (plan?.kind !== "rollback_restore_plan") return "rollback_restore_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store") return "rollback_restore_plan_scope_invalid";
  if (plan.planned !== true || plan.required_before_future_promotion !== true) return "rollback_restore_plan_not_ready";
  if (plan.executed !== false || plan.persisted !== false || plan.restore_id !== null) return "rollback_restore_plan_already_performed";
  return null;
}

function validateAuditPlan(plan) {
  if (plan?.kind !== "promotion_audit_receipt_plan") return "promotion_audit_receipt_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store") return "promotion_audit_receipt_plan_scope_invalid";
  if (plan.planned !== true || plan.required_before_future_promotion !== true) return "promotion_audit_receipt_plan_not_ready";
  if (plan.receipt_created !== false || plan.persisted !== false || plan.receipt_id !== null) return "promotion_audit_receipt_plan_already_performed";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42a_gate_readiness_index_generated: false,
    phase42a_gate_readiness_index_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildGateReadinessIndex({ closure, contract, backupPlan, rollbackPlan, auditPlan, userRequest, state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = {
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    gate_open: intent.gate_open,
    approval: intent.approval,
    pending_engine: intent.pending_engine,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon: intent.canon,
    active_engine: intent.active_engine,
    full_run_all_passed: intent.full_run_all_passed,
  };

  for (const error of [
    validatePhase41Closure(closure),
    validateGateContract(contract),
    validateBackupPlan(backupPlan),
    validateRollbackPlan(rollbackPlan),
    validateAuditPlan(auditPlan),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42a_gate_readiness_index_request", state, { direct_requests_detected: directRequestsDetected });

  const indexSource = JSON.stringify({
    phase: "Phase42A",
    closurePhase: closure.phase,
    chain: closure.chain,
    contract: contract.kind,
    backupPlan: backupPlan.kind,
    rollbackPlan: rollbackPlan.kind,
    auditPlan: auditPlan.kind,
    fullRunAllStatus: closure.full_run_all_status,
  });
  const indexHash = sha256Text(indexSource);

  const index = {
    id: `phase42a_gate_readiness_index_${indexHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_readiness_index",
    phase: "Phase42A",
    source_phase: "Phase41M",
    source_closure_kind: closure.kind,
    source_chain_complete: true,
    phase41_closed: true,
    target_gate: contract.target_gate,
    mode: "readiness_index_preview_only",
    generated: true,
    persisted: false,
    production_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    backup_snapshot_plan_ready: true,
    backup_snapshot_created: false,
    rollback_restore_plan_ready: true,
    rollback_restore_executed: false,
    audit_receipt_plan_ready: true,
    audit_receipt_created: false,
    two_step_operator_confirmation_required: true,
    full_run_all_status: closure.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42b-production-candidate-store-promotion-gate-preflight-contract-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_readiness_index_preview_only",
    phase42a_gate_readiness_index_generated: true,
    phase42a_gate_readiness_index_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    audit_receipt_created: false,
    full_run_all_status: closure.full_run_all_status,
    full_run_all_passed_claimed: false,
    readiness_index_preview: index,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42a_gate_readiness_index_generated, false);
  assert.equal(result.phase42a_gate_readiness_index_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure({ accepted: false }),
    contract: makeGateContract(),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Phase42A promotion gate readiness index",
  });
  assertRejected(result, "phase41_final_closure_not_accepted");
}

{
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure({ chain: PHASE41_CHAIN.filter((phase) => !phase.includes("phase41m")) }),
    contract: makeGateContract(),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Phase42A production candidate store promotion gate readiness index",
  });
  assertRejected(result, "phase41_chain_incomplete");
}

{
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    contract: makeGateContract(),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Phase42A production candidate store promotion gate readiness index",
  });
  assertRejected(result, "phase41_closure_forbidden_action_detected");
}

for (const [override, reason] of [
  [{ mode: "gate_open" }, "gate_readiness_contract_mode_invalid"],
  [{ production_write_allowed: true }, "gate_readiness_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "gate_readiness_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "gate_readiness_contract_allows_gate_open"],
  [{ approval_request_creation_allowed: true }, "gate_readiness_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "gate_readiness_contract_allows_pending_engine_candidate"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "gate_readiness_contract_required_field_invalid"],
]) {
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure(),
    contract: makeGateContract(override),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Phase42A production candidate store promotion gate readiness index",
  });
  assertRejected(result, reason);
}

for (const [plans, reason] of [
  [{ backupPlan: makeBackupPlan({ executed: true }) }, "backup_snapshot_plan_already_performed"],
  [{ backupPlan: makeBackupPlan({ target_store_scope: "sandbox_candidate_store" }) }, "backup_snapshot_plan_scope_invalid"],
  [{ rollbackPlan: makeRollbackPlan({ executed: true }) }, "rollback_restore_plan_already_performed"],
  [{ rollbackPlan: makeRollbackPlan({ persisted: true }) }, "rollback_restore_plan_already_performed"],
  [{ auditPlan: makeAuditPlan({ receipt_created: true }) }, "promotion_audit_receipt_plan_already_performed"],
  [{ auditPlan: makeAuditPlan({ persisted: true }) }, "promotion_audit_receipt_plan_already_performed"],
]) {
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure(),
    contract: makeGateContract(),
    backupPlan: plans.backupPlan || makeBackupPlan(),
    rollbackPlan: plans.rollbackPlan || makeRollbackPlan(),
    auditPlan: plans.auditPlan || makeAuditPlan(),
    userRequest: "Phase42A production candidate store promotion gate readiness index",
  });
  assertRejected(result, reason);
}

{
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure(),
    contract: makeGateContract(),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Build some future promotion notes",
  });
  assertRejected(result, "missing_explicit_phase42a_gate_readiness_index_request");
}

{
  const result = buildGateReadinessIndex({
    closure: makePhase41Closure(),
    contract: makeGateContract(),
    backupPlan: makeBackupPlan(),
    rollbackPlan: makeRollbackPlan(),
    auditPlan: makeAuditPlan(),
    userRequest: "Phase42A production candidate store promotion gate readiness index. Do not open gate, do not write production, do not create approval, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_readiness_index_preview_only");
  assert.equal(result.phase42a_gate_readiness_index_generated, true);
  assert.equal(result.phase42a_gate_readiness_index_persisted, false);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_gate_open_allowed, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
  assertFalseFields(result.readiness_index_preview, MUTATION_FIELDS.filter((field) => field in result.readiness_index_preview));
  assert.equal(result.readiness_index_preview.source_chain_complete, true);
  assert.equal(result.readiness_index_preview.phase41_closed, true);
  assert.equal(result.readiness_index_preview.backup_snapshot_plan_ready, true);
  assert.equal(result.readiness_index_preview.rollback_restore_plan_ready, true);
  assert.equal(result.readiness_index_preview.audit_receipt_plan_ready, true);
  assert.equal(result.readiness_index_preview.two_step_operator_confirmation_required, true);
  assert.equal(result.readiness_index_preview.next_allowed_phase, "phase42b-production-candidate-store-promotion-gate-preflight-contract-smoke");
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

console.log("Phase42A production candidate store promotion gate readiness index tests passed.");
