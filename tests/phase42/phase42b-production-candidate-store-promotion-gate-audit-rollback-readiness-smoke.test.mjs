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
  phase42b_audit_rollback_readiness_generated: false,
  phase42b_audit_rollback_readiness_persisted: false,
  audit_trail_ready: false,
  audit_receipt_created: false,
  backup_snapshot_ready: false,
  backup_snapshot_created: false,
  rollback_restore_ready: false,
  rollback_restore_executed: false,
  operator_confirmation_packet_ready: false,
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
  full_run_all_passed_claimed: false,
});

const BLOCKED_ACTIONS = [
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
  "guard_token_consume",
  "operator_confirmation_grant",
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
  "phase42b_audit_rollback_readiness_persisted",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
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
  "full_run_all_passed_claimed",
];

const READINESS_TRUE_FIELDS = [
  "phase42a_readiness_index_required",
  "explicit_phase42b_audit_rollback_readiness_request_required",
  "readiness_preview_only",
  "readiness_must_not_persist",
  "audit_trail_plan_required",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_plan_required",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_plan_required",
  "rollback_restore_must_not_execute",
  "operator_confirmation_packet_required",
  "operator_confirmation_must_not_be_granted",
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

function makePhase42AIndex(overrides = {}) {
  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_readiness_index_preview_only",
    phase: "Phase42A",
    kind: "production_candidate_store_promotion_gate_readiness_index",
    source_phase: "Phase41M",
    source_chain: [...PHASE41_CHAIN],
    source_chain_complete: true,
    phase41_closed: true,
    target_gate: "production_candidate_store_promotion_gate",
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
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42b-production-candidate-store-promotion-gate-audit-rollback-readiness-smoke",
    ...overrides,
  };
}

function makeReadinessContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_audit_rollback_readiness_contract",
    mode: "audit_rollback_readiness_preview_only",
    source_phase: "Phase42A",
    target_phase: "Phase42B",
    target_gate: "production_candidate_store_promotion_gate",
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    operator_confirmation_grant_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase42a_readiness_index_required: true,
    explicit_phase42b_audit_rollback_readiness_request_required: true,
    readiness_preview_only: true,
    readiness_must_not_persist: true,
    audit_trail_plan_required: true,
    audit_receipt_must_not_be_created: true,
    backup_snapshot_plan_required: true,
    backup_snapshot_must_not_be_created: true,
    rollback_restore_plan_required: true,
    rollback_restore_must_not_execute: true,
    operator_confirmation_packet_required: true,
    operator_confirmation_must_not_be_granted: true,
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
    full_run_all_must_remain_pending_until_explicitly_rerun: true,
    ...overrides,
  };
}

function makeAuditTrailPlan(overrides = {}) {
  return {
    kind: "promotion_audit_trail_plan",
    target_store_scope: "production_candidate_store",
    target_gate: "production_candidate_store_promotion_gate",
    planned: true,
    ready: true,
    receipt_created: false,
    persisted: false,
    append_only: true,
    operator_identity_required: true,
    before_after_hash_required: true,
    causal_source_link_required: true,
    receipt_id: null,
    ...overrides,
  };
}

function makeBackupSnapshotPlan(overrides = {}) {
  return {
    kind: "backup_snapshot_readiness_plan",
    target_store_scope: "production_candidate_store",
    planned: true,
    ready: true,
    created: false,
    persisted: false,
    snapshot_id: null,
    manifest_hash_required: true,
    restore_pointer_required: true,
    required_before_future_promotion: true,
    ...overrides,
  };
}

function makeRollbackRestorePlan(overrides = {}) {
  return {
    kind: "rollback_restore_readiness_plan",
    target_store_scope: "production_candidate_store",
    planned: true,
    ready: true,
    executed: false,
    persisted: false,
    restore_id: null,
    dry_run_restore_check_required: true,
    restore_pointer_required: true,
    required_before_future_promotion: true,
    ...overrides,
  };
}

function makeOperatorConfirmationPacket(overrides = {}) {
  return {
    kind: "two_step_operator_confirmation_packet",
    target_gate: "production_candidate_store_promotion_gate",
    ready: true,
    granted: false,
    consumed: false,
    first_confirmation_required: true,
    second_confirmation_required: true,
    explicit_production_write_phrase_required: true,
    explicit_canonical_scope_ack_required: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /phase42b/.test(normalized) && (/audit/.test(normalized) || /rollback/.test(normalized)) && /readiness/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    gate_open: /\bopen\b.*\bgate\b|\bgate\b.*\bopen\b/.test(normalized),
    guard_token: /\bconsume\b.*\bguard token\b|\bguard token\b.*\bconsume\b/.test(normalized),
    audit_receipt: /\bcreate\b.*\baudit receipt\b|\baudit receipt\b.*\bcreate\b/.test(normalized),
    backup_snapshot: /\bcreate\b.*\bbackup\b|\bbackup snapshot\b.*\bcreate\b/.test(normalized),
    rollback_restore: /\bexecute\b.*\brollback\b|\brollback\b.*\bexecute\b/.test(normalized),
    operator_confirmation: /\bgrant\b.*\boperator confirmation\b|\boperator confirmation\b.*\bgrant\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
    full_run_all_passed: /full run-all passed|full run all passed|full_run_all_passed/.test(normalized),
  };
}

function validatePhase42AIndex(index) {
  if (!index?.accepted) return "phase42a_readiness_index_not_accepted";
  if (index.phase !== "Phase42A" || index.kind !== "production_candidate_store_promotion_gate_readiness_index") return "phase42a_readiness_index_kind_invalid";
  if (index.source_phase !== "Phase41M" || index.target_gate !== "production_candidate_store_promotion_gate") return "phase42a_readiness_index_link_invalid";
  if (index.mode !== "readiness_index_preview_only" || index.generated !== true || index.persisted !== false) return "phase42a_readiness_index_mode_invalid";
  if (index.source_chain_complete !== true || index.phase41_closed !== true) return "phase42a_readiness_index_phase41_closure_invalid";
  for (const phase of PHASE41_CHAIN) if (!index.source_chain?.includes(phase)) return "phase42a_readiness_index_chain_incomplete";
  if (index.production_write_allowed !== false || index.production_promotion_allowed !== false) return "phase42a_readiness_index_write_policy_invalid";
  if (index.production_gate_opened !== false || index.production_write_performed !== false || index.production_promotion_performed !== false || index.production_candidate_store_mutated !== false) return "phase42a_readiness_index_already_mutated_production";
  for (const field of ["guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "backup_snapshot_created", "rollback_restore_executed", "audit_receipt_created", "full_run_all_passed_claimed"]) if (index[field] !== false) return "phase42a_readiness_index_forbidden_action_detected";
  if (index.backup_snapshot_plan_ready !== true || index.rollback_restore_plan_ready !== true || index.audit_receipt_plan_ready !== true || index.two_step_operator_confirmation_required !== true) return "phase42a_readiness_index_plan_readiness_invalid";
  if (index.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42a_full_run_all_status_invalid";
  return null;
}

function validateReadinessContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_audit_rollback_readiness_contract") return "audit_rollback_readiness_contract_missing";
  if (contract.mode !== "audit_rollback_readiness_preview_only") return "audit_rollback_readiness_contract_mode_invalid";
  if (contract.source_phase !== "Phase42A" || contract.target_phase !== "Phase42B") return "audit_rollback_readiness_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "audit_rollback_readiness_contract_target_gate_invalid";
  if (contract.production_write_allowed !== false) return "audit_rollback_readiness_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "audit_rollback_readiness_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "audit_rollback_readiness_contract_allows_gate_open";
  if (contract.audit_receipt_creation_allowed !== false) return "audit_rollback_readiness_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "audit_rollback_readiness_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "audit_rollback_readiness_contract_allows_rollback_restore";
  if (contract.operator_confirmation_grant_allowed !== false) return "audit_rollback_readiness_contract_allows_operator_confirmation";
  if (contract.approval_request_creation_allowed !== false) return "audit_rollback_readiness_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "audit_rollback_readiness_contract_allows_pending_engine_candidate";
  for (const field of READINESS_TRUE_FIELDS) if (contract[field] !== true) return "audit_rollback_readiness_contract_required_field_invalid";
  return null;
}

function validateAuditTrailPlan(plan) {
  if (plan?.kind !== "promotion_audit_trail_plan") return "audit_trail_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store" || plan.target_gate !== "production_candidate_store_promotion_gate") return "audit_trail_plan_scope_invalid";
  if (plan.planned !== true || plan.ready !== true || plan.append_only !== true) return "audit_trail_plan_not_ready";
  if (plan.operator_identity_required !== true || plan.before_after_hash_required !== true || plan.causal_source_link_required !== true) return "audit_trail_plan_required_field_invalid";
  if (plan.receipt_created !== false || plan.persisted !== false || plan.receipt_id !== null) return "audit_trail_plan_already_performed";
  return null;
}

function validateBackupSnapshotPlan(plan) {
  if (plan?.kind !== "backup_snapshot_readiness_plan") return "backup_snapshot_readiness_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store") return "backup_snapshot_readiness_plan_scope_invalid";
  if (plan.planned !== true || plan.ready !== true || plan.required_before_future_promotion !== true) return "backup_snapshot_readiness_plan_not_ready";
  if (plan.manifest_hash_required !== true || plan.restore_pointer_required !== true) return "backup_snapshot_readiness_plan_required_field_invalid";
  if (plan.created !== false || plan.persisted !== false || plan.snapshot_id !== null) return "backup_snapshot_readiness_plan_already_performed";
  return null;
}

function validateRollbackRestorePlan(plan) {
  if (plan?.kind !== "rollback_restore_readiness_plan") return "rollback_restore_readiness_plan_missing";
  if (plan.target_store_scope !== "production_candidate_store") return "rollback_restore_readiness_plan_scope_invalid";
  if (plan.planned !== true || plan.ready !== true || plan.required_before_future_promotion !== true) return "rollback_restore_readiness_plan_not_ready";
  if (plan.dry_run_restore_check_required !== true || plan.restore_pointer_required !== true) return "rollback_restore_readiness_plan_required_field_invalid";
  if (plan.executed !== false || plan.persisted !== false || plan.restore_id !== null) return "rollback_restore_readiness_plan_already_performed";
  return null;
}

function validateOperatorConfirmationPacket(packet) {
  if (packet?.kind !== "two_step_operator_confirmation_packet") return "operator_confirmation_packet_missing";
  if (packet.target_gate !== "production_candidate_store_promotion_gate") return "operator_confirmation_packet_target_gate_invalid";
  if (packet.ready !== true || packet.first_confirmation_required !== true || packet.second_confirmation_required !== true) return "operator_confirmation_packet_not_ready";
  if (packet.explicit_production_write_phrase_required !== true || packet.explicit_canonical_scope_ack_required !== true) return "operator_confirmation_packet_required_field_invalid";
  if (packet.granted !== false || packet.consumed !== false) return "operator_confirmation_packet_already_granted";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42b_audit_rollback_readiness_generated: false,
    phase42b_audit_rollback_readiness_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildAuditRollbackReadiness({ phase42aIndex, contract, auditTrailPlan, backupSnapshotPlan, rollbackRestorePlan, operatorConfirmationPacket, userRequest, state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = {
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    gate_open: intent.gate_open,
    guard_token: intent.guard_token,
    audit_receipt: intent.audit_receipt,
    backup_snapshot: intent.backup_snapshot,
    rollback_restore: intent.rollback_restore,
    operator_confirmation: intent.operator_confirmation,
    approval: intent.approval,
    pending_engine: intent.pending_engine,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon: intent.canon,
    active_engine: intent.active_engine,
    full_run_all_passed: intent.full_run_all_passed,
  };

  for (const error of [
    validatePhase42AIndex(phase42aIndex),
    validateReadinessContract(contract),
    validateAuditTrailPlan(auditTrailPlan),
    validateBackupSnapshotPlan(backupSnapshotPlan),
    validateRollbackRestorePlan(rollbackRestorePlan),
    validateOperatorConfirmationPacket(operatorConfirmationPacket),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42b_audit_rollback_readiness_request", state, { direct_requests_detected: directRequestsDetected });

  const readinessSource = JSON.stringify({
    phase: "Phase42B",
    sourcePhase: phase42aIndex.phase,
    sourceGate: phase42aIndex.target_gate,
    contract: contract.kind,
    audit: auditTrailPlan.kind,
    backup: backupSnapshotPlan.kind,
    rollback: rollbackRestorePlan.kind,
    operator: operatorConfirmationPacket.kind,
    fullRunAllStatus: phase42aIndex.full_run_all_status,
  });
  const readinessHash = sha256Text(readinessSource);

  const readinessPreview = {
    id: `phase42b_audit_rollback_readiness_${readinessHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_audit_rollback_readiness_preview",
    phase: "Phase42B",
    source_phase: "Phase42A",
    source_gate: phase42aIndex.target_gate,
    mode: "audit_rollback_readiness_preview_only",
    generated: true,
    persisted: false,
    audit_trail_ready: true,
    audit_receipt_created: false,
    backup_snapshot_ready: true,
    backup_snapshot_created: false,
    rollback_restore_ready: true,
    rollback_restore_executed: false,
    operator_confirmation_packet_ready: true,
    operator_confirmation_granted: false,
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
    full_run_all_status: phase42aIndex.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42c-production-candidate-store-promotion-operator-confirmation-gate-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_audit_rollback_readiness_preview_only",
    phase42b_audit_rollback_readiness_generated: true,
    phase42b_audit_rollback_readiness_persisted: false,
    audit_trail_ready: true,
    audit_receipt_created: false,
    backup_snapshot_ready: true,
    backup_snapshot_created: false,
    rollback_restore_ready: true,
    rollback_restore_executed: false,
    operator_confirmation_packet_ready: true,
    operator_confirmation_granted: false,
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
    full_run_all_status: phase42aIndex.full_run_all_status,
    full_run_all_passed_claimed: false,
    readiness_preview: readinessPreview,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42b_audit_rollback_readiness_generated, false);
  assert.equal(result.phase42b_audit_rollback_readiness_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex({ accepted: false }),
    contract: makeReadinessContract(),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Phase42B audit rollback readiness",
  });
  assertRejected(result, "phase42a_readiness_index_not_accepted");
}

{
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex({ source_chain: PHASE41_CHAIN.filter((phase) => !phase.includes("phase41m")) }),
    contract: makeReadinessContract(),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Phase42B audit rollback readiness",
  });
  assertRejected(result, "phase42a_readiness_index_chain_incomplete");
}

{
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    contract: makeReadinessContract(),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Phase42B audit rollback readiness",
  });
  assertRejected(result, "phase42a_readiness_index_forbidden_action_detected");
}

for (const [override, reason] of [
  [{ mode: "audit_rollback_execute" }, "audit_rollback_readiness_contract_mode_invalid"],
  [{ production_write_allowed: true }, "audit_rollback_readiness_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "audit_rollback_readiness_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "audit_rollback_readiness_contract_allows_gate_open"],
  [{ audit_receipt_creation_allowed: true }, "audit_rollback_readiness_contract_allows_audit_receipt"],
  [{ backup_snapshot_creation_allowed: true }, "audit_rollback_readiness_contract_allows_backup_snapshot"],
  [{ rollback_restore_execution_allowed: true }, "audit_rollback_readiness_contract_allows_rollback_restore"],
  [{ operator_confirmation_grant_allowed: true }, "audit_rollback_readiness_contract_allows_operator_confirmation"],
  [{ approval_request_creation_allowed: true }, "audit_rollback_readiness_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "audit_rollback_readiness_contract_allows_pending_engine_candidate"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "audit_rollback_readiness_contract_required_field_invalid"],
]) {
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex(),
    contract: makeReadinessContract(override),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Phase42B audit rollback readiness",
  });
  assertRejected(result, reason);
}

for (const [parts, reason] of [
  [{ auditTrailPlan: makeAuditTrailPlan({ receipt_created: true }) }, "audit_trail_plan_already_performed"],
  [{ auditTrailPlan: makeAuditTrailPlan({ persisted: true }) }, "audit_trail_plan_already_performed"],
  [{ auditTrailPlan: makeAuditTrailPlan({ append_only: false }) }, "audit_trail_plan_not_ready"],
  [{ auditTrailPlan: makeAuditTrailPlan({ before_after_hash_required: false }) }, "audit_trail_plan_required_field_invalid"],
  [{ backupSnapshotPlan: makeBackupSnapshotPlan({ created: true }) }, "backup_snapshot_readiness_plan_already_performed"],
  [{ backupSnapshotPlan: makeBackupSnapshotPlan({ target_store_scope: "sandbox_candidate_store" }) }, "backup_snapshot_readiness_plan_scope_invalid"],
  [{ backupSnapshotPlan: makeBackupSnapshotPlan({ manifest_hash_required: false }) }, "backup_snapshot_readiness_plan_required_field_invalid"],
  [{ rollbackRestorePlan: makeRollbackRestorePlan({ executed: true }) }, "rollback_restore_readiness_plan_already_performed"],
  [{ rollbackRestorePlan: makeRollbackRestorePlan({ dry_run_restore_check_required: false }) }, "rollback_restore_readiness_plan_required_field_invalid"],
  [{ operatorConfirmationPacket: makeOperatorConfirmationPacket({ granted: true }) }, "operator_confirmation_packet_already_granted"],
  [{ operatorConfirmationPacket: makeOperatorConfirmationPacket({ second_confirmation_required: false }) }, "operator_confirmation_packet_not_ready"],
  [{ operatorConfirmationPacket: makeOperatorConfirmationPacket({ explicit_canonical_scope_ack_required: false }) }, "operator_confirmation_packet_required_field_invalid"],
]) {
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex(),
    contract: makeReadinessContract(),
    auditTrailPlan: parts.auditTrailPlan || makeAuditTrailPlan(),
    backupSnapshotPlan: parts.backupSnapshotPlan || makeBackupSnapshotPlan(),
    rollbackRestorePlan: parts.rollbackRestorePlan || makeRollbackRestorePlan(),
    operatorConfirmationPacket: parts.operatorConfirmationPacket || makeOperatorConfirmationPacket(),
    userRequest: "Phase42B audit rollback readiness",
  });
  assertRejected(result, reason);
}

{
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex(),
    contract: makeReadinessContract(),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Prepare future gate documents",
  });
  assertRejected(result, "missing_explicit_phase42b_audit_rollback_readiness_request");
}

{
  const result = buildAuditRollbackReadiness({
    phase42aIndex: makePhase42AIndex(),
    contract: makeReadinessContract(),
    auditTrailPlan: makeAuditTrailPlan(),
    backupSnapshotPlan: makeBackupSnapshotPlan(),
    rollbackRestorePlan: makeRollbackRestorePlan(),
    operatorConfirmationPacket: makeOperatorConfirmationPacket(),
    userRequest: "Phase42B production candidate store promotion gate audit rollback readiness. Do not open gate, do not write production, do not create backup, do not execute rollback, do not create audit receipt, do not grant operator confirmation, do not create approval, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_audit_rollback_readiness_preview_only");
  assert.equal(result.phase42b_audit_rollback_readiness_generated, true);
  assert.equal(result.phase42b_audit_rollback_readiness_persisted, false);
  assert.equal(result.audit_trail_ready, true);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.backup_snapshot_ready, true);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_ready, true);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.operator_confirmation_packet_ready, true);
  assert.equal(result.operator_confirmation_granted, false);
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
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
  assertFalseFields(result.readiness_preview, MUTATION_FIELDS.filter((field) => field in result.readiness_preview));
  assert.equal(result.readiness_preview.audit_trail_ready, true);
  assert.equal(result.readiness_preview.backup_snapshot_ready, true);
  assert.equal(result.readiness_preview.rollback_restore_ready, true);
  assert.equal(result.readiness_preview.operator_confirmation_packet_ready, true);
  assert.equal(result.readiness_preview.next_allowed_phase, "phase42c-production-candidate-store-promotion-operator-confirmation-gate-smoke");
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.audit_receipt, true);
  assert.equal(result.direct_requests_detected.backup_snapshot, true);
  assert.equal(result.direct_requests_detected.rollback_restore, true);
  assert.equal(result.direct_requests_detected.operator_confirmation, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

console.log("Phase42B production candidate store promotion gate audit rollback readiness smoke tests passed.");
