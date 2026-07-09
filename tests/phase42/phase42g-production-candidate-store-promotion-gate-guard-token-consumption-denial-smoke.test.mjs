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
  phase42g_guard_token_consumption_denial_generated: false,
  phase42g_guard_token_consumption_denial_persisted: false,
  phase42f_preconsumption_readiness_verified: false,
  explicit_guard_token_consumption_request_detected: false,
  guard_token_candidate_shape_verified: false,
  guard_token_scope_verified: false,
  guard_token_consumption_denial_accepted: false,
  guard_token_consumption_denied: false,
  guard_token_consumption_authorized: false,
  guard_token_consumed: false,
  operator_confirmation_granted: false,
  production_promotion_gate_opened: false,
  production_candidate_saved: false,
  production_write_performed: false,
  production_promotion_performed: false,
  production_candidate_store_mutated: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
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
  "guard_token_consume",
  "guard_token_consumption_authorize",
  "operator_confirmation_grant",
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
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
  "phase42g_guard_token_consumption_denial_persisted",
  "guard_token_consumption_authorized",
  "guard_token_consumed",
  "operator_confirmation_granted",
  "production_promotion_gate_opened",
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "production_candidate_store_mutated",
  "approval_request_created",
  "pending_engine_candidate_created",
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
  "phase42f_preconsumption_readiness_required",
  "explicit_phase42g_guard_token_consumption_request_required",
  "guard_token_consumption_denial_preview_only",
  "guard_token_consumption_denial_must_not_persist",
  "guard_token_consumption_request_must_be_detected",
  "guard_token_consumption_request_must_be_denied",
  "guard_token_candidate_shape_required",
  "guard_token_scope_required",
  "guard_token_must_remain_unconsumed",
  "denial_must_not_authorize_guard_token_consumption",
  "denial_must_not_grant_operator_confirmation",
  "denial_must_not_open_gate",
  "denial_must_not_write_production",
  "denial_must_not_promote_production",
  "denial_must_not_create_approval_request",
  "denial_must_not_create_pending_engine_candidate",
  "denial_must_not_trigger_adoption",
  "denial_must_not_trigger_settlement",
  "denial_must_not_update_canon",
  "denial_must_not_update_active_engine",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_must_not_execute",
  "full_run_all_must_remain_pending_until_explicit_rerun",
];

const ALLOWED_PHASE42F_NEXT_PHASES = [
  "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke",
  "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-boundary-smoke",
];

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withOverrides(base, overrides = {}) {
  return { ...deepClone(base), ...overrides };
}

function assertFalseFields(value, fields) {
  for (const field of fields) assert.equal(value[field], false, `${field} must remain false`);
}

function makeCandidateIdentity() {
  const sourceText = "Phase42 production candidate store promotion gate smoke candidate";
  const sourceHash = sha256Text(sourceText);
  const candidateId = `candidate_${sourceHash.slice(0, 16)}`;
  const candidateHash = sha256Text(`${candidateId}|${sourceHash}|production-candidate-store-promotion-gate`);
  return {
    candidate_id: candidateId,
    candidate_hash: candidateHash,
    source_text_hash: sourceHash,
    source_route: "explicit_candidate_preview_route",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
  };
}

function makeGuardTokenScope(identity = makeCandidateIdentity()) {
  return {
    target_gate: "production_candidate_store_promotion_gate",
    candidate_id: identity.candidate_id,
    candidate_hash: identity.candidate_hash,
    source_text_hash: identity.source_text_hash,
    source_route: identity.source_route,
    source_store_scope: identity.source_store_scope,
    target_store_scope: identity.target_store_scope,
    mutation_allowed: false,
  };
}

function makeGuardTokenCandidate(identity = makeCandidateIdentity()) {
  const scope = makeGuardTokenScope(identity);
  const scopeHash = sha256Text(JSON.stringify(scope));
  const tokenValue = `phase42f_guard_${sha256Text(`Phase42F|${scopeHash}`).slice(0, 24)}`;
  return {
    kind: "guard_token_preconsumption_candidate",
    source_phase: "Phase42E",
    target_phase: "Phase42F",
    target_gate: scope.target_gate,
    mode: "guard_token_preconsumption_boundary_preview_only",
    ready: true,
    preview_only: true,
    persisted: false,
    accepted: false,
    consumption_allowed: false,
    scope,
    scope_hash: scopeHash,
    token: {
      value: tokenValue,
      shape: "phase42f_guard_<24hex>",
      source_phase: "Phase42F",
      scope_hash: scopeHash,
      preview_only: true,
      consumed: false,
      grants: null,
    },
  };
}

function makePhase42FPreconsumptionReadinessPreview(overrides = {}) {
  const identity = makeCandidateIdentity();
  const guardTokenCandidate = makeGuardTokenCandidate(identity);
  const sourceChain = [...PHASE41_CHAIN, "phase42a-production-candidate-store-promotion-gate-readiness-index", "phase42b-production-candidate-store-promotion-gate-audit-rollback-readiness-smoke", "phase42c-production-candidate-store-promotion-gate-preflight-contract-smoke", "phase42d-production-candidate-store-promotion-gate-operator-confirmation-boundary-smoke", "phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke"];
  const base = {
    accepted: true,
    phase: "Phase42F",
    reason: "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_preview_only",
    source_chain_closed: true,
    source_chain: sourceChain,
    target_gate: "production_candidate_store_promotion_gate",
    candidate_identity: identity,
    candidate_identity_verified: true,
    guard_token_preconsumption_boundary_generated: true,
    guard_token_preconsumption_boundary_persisted: false,
    phase42f_guard_token_preconsumption_boundary_generated: true,
    phase42f_guard_token_preconsumption_boundary_persisted: false,
    phase42e_final_readiness_verified: true,
    guard_token_candidate_shape_verified: true,
    guard_token_scope_verified: true,
    guard_token_preconsumption_readiness_accepted: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    operator_confirmation_granted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
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
    guard_token_preconsumption_candidate: guardTokenCandidate,
    next_allowed_phase: "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke",
  };
  return withOverrides(base, overrides);
}

function makeGuardTokenConsumptionDenialContract(overrides = {}) {
  const base = {
    kind: "production_candidate_store_promotion_gate_guard_token_consumption_denial_contract",
    mode: "guard_token_consumption_denial_preview_only",
    source_phase: "Phase42F",
    target_phase: "Phase42G",
    target_gate: "production_candidate_store_promotion_gate",
    guard_token_consumption_allowed: false,
    guard_token_consumption_authorization_allowed: false,
    operator_confirmation_grant_allowed: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    adoption_allowed: false,
    settlement_allowed: false,
    canon_update_allowed: false,
    active_engine_update_allowed: false,
    phase42f_preconsumption_readiness_required: true,
    explicit_phase42g_guard_token_consumption_request_required: true,
    guard_token_consumption_denial_preview_only: true,
    guard_token_consumption_denial_must_not_persist: true,
    guard_token_consumption_request_must_be_detected: true,
    guard_token_consumption_request_must_be_denied: true,
    guard_token_candidate_shape_required: true,
    guard_token_scope_required: true,
    guard_token_must_remain_unconsumed: true,
    denial_must_not_authorize_guard_token_consumption: true,
    denial_must_not_grant_operator_confirmation: true,
    denial_must_not_open_gate: true,
    denial_must_not_write_production: true,
    denial_must_not_promote_production: true,
    denial_must_not_create_approval_request: true,
    denial_must_not_create_pending_engine_candidate: true,
    denial_must_not_trigger_adoption: true,
    denial_must_not_trigger_settlement: true,
    denial_must_not_update_canon: true,
    denial_must_not_update_active_engine: true,
    audit_receipt_must_not_be_created: true,
    backup_snapshot_must_not_be_created: true,
    rollback_restore_must_not_execute: true,
    full_run_all_must_remain_pending_until_explicit_rerun: true,
  };
  return withOverrides(base, overrides);
}

function classifyIntent(userRequest) {
  const normalized = String(userRequest || "").toLowerCase();
  return {
    explicit: /phase42g/.test(normalized) && /guard token/.test(normalized) && /consumption|consume|denial|deny|denied/.test(normalized),
    guard_token_consumption_request: /consume guard token|guard token consumption|mark guard token consumed|use guard token|spend guard token/.test(normalized),
    production_write: /production write|write production|production candidate store write|save production/.test(normalized),
    production_promotion: /production promotion|promote production|production candidate store promotion/.test(normalized),
    gate_open: /open gate|gate open|production gate open/.test(normalized),
    operator_confirmation_grant: /grant operator confirmation|operator confirmation grant/.test(normalized),
    audit_receipt: /audit receipt|create audit/.test(normalized),
    backup_snapshot: /backup snapshot|create backup/.test(normalized),
    rollback_restore: /rollback restore|execute rollback|restore rollback/.test(normalized),
    approval: /approval request|create approval/.test(normalized),
    pending_engine: /pending engine candidate|create pending engine/.test(normalized),
    adoption: /adoption|adopt/.test(normalized),
    settlement: /settlement|settle/.test(normalized),
    canon: /canon/.test(normalized),
    active_engine: /active_engine|active engine/.test(normalized),
    full_run_all_passed: /full run-all passed|full run all passed|run-all passed|run all passed/.test(normalized),
  };
}

function validatePhase42FPreconsumptionReadiness(readiness) {
  if (!readiness || readiness.accepted !== true) return "phase42f_preconsumption_readiness_not_accepted";
  if (readiness.phase !== "Phase42F") return "phase42f_preconsumption_readiness_phase_invalid";
  if (readiness.reason !== "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_preview_only") return "phase42f_preconsumption_readiness_reason_invalid";
  if (readiness.source_chain_closed !== true) return "phase42f_source_chain_not_closed";
  if (!PHASE41_CHAIN.every((phase) => readiness.source_chain?.includes(phase))) return "phase41_chain_missing";
  if (readiness.target_gate !== "production_candidate_store_promotion_gate") return "phase42f_target_gate_invalid";
  if (readiness.candidate_identity_verified !== true) return "phase42f_candidate_identity_not_verified";
  if (readiness.phase42f_guard_token_preconsumption_boundary_generated !== true) return "phase42f_preconsumption_boundary_not_generated";
  if (readiness.phase42f_guard_token_preconsumption_boundary_persisted !== false) return "phase42f_preconsumption_boundary_persisted";
  if (readiness.phase42e_final_readiness_verified !== true) return "phase42e_final_readiness_not_verified";
  if (readiness.guard_token_candidate_shape_verified !== true) return "phase42f_guard_token_shape_not_verified";
  if (readiness.guard_token_scope_verified !== true) return "phase42f_guard_token_scope_not_verified";
  if (readiness.guard_token_preconsumption_readiness_accepted !== true) return "phase42f_preconsumption_readiness_not_marked_accepted";
  if (readiness.guard_token_consumption_authorized !== false) return "phase42f_authorizes_guard_token_consumption";
  if (readiness.guard_token_consumed !== false) return "phase42f_guard_token_already_consumed";
  if (readiness.operator_confirmation_granted !== false) return "phase42f_operator_confirmation_granted";
  if (readiness.production_write_allowed !== false) return "phase42f_allows_production_write";
  if (readiness.production_promotion_allowed !== false) return "phase42f_allows_production_promotion";
  if (readiness.production_gate_open_allowed !== false) return "phase42f_allows_gate_open";
  if (readiness.production_promotion_gate_opened !== false) return "phase42f_gate_opened";
  if (readiness.production_candidate_store_mutated !== false) return "phase42f_mutated_candidate_store";
  if (readiness.production_write_performed !== false) return "phase42f_production_write_performed";
  if (readiness.production_promotion_performed !== false) return "phase42f_production_promotion_performed";
  if (readiness.audit_receipt_created !== false) return "phase42f_audit_receipt_created";
  if (readiness.backup_snapshot_created !== false) return "phase42f_backup_snapshot_created";
  if (readiness.rollback_restore_executed !== false) return "phase42f_rollback_restore_executed";
  if (readiness.approval_request_created !== false) return "phase42f_approval_request_created";
  if (readiness.pending_engine_candidate_created !== false) return "phase42f_pending_engine_candidate_created";
  if (readiness.adoption_performed !== false) return "phase42f_adoption_performed";
  if (readiness.settlement_performed !== false) return "phase42f_settlement_performed";
  if (readiness.canon_update_performed !== false) return "phase42f_canon_update_performed";
  if (readiness.active_engine_update_performed !== false) return "phase42f_active_engine_update_performed";
  if (readiness.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42f_full_run_all_status_invalid";
  if (readiness.full_run_all_passed_claimed !== false) return "phase42f_full_run_all_passed_claimed";
  if (!ALLOWED_PHASE42F_NEXT_PHASES.includes(readiness.next_allowed_phase)) return "phase42f_next_allowed_phase_invalid";
  return null;
}

function validateGuardTokenCandidate(readiness) {
  const packet = readiness.guard_token_preconsumption_candidate;
  if (packet?.kind !== "guard_token_preconsumption_candidate") return "guard_token_preconsumption_candidate_missing";
  if (packet.source_phase !== "Phase42E" || packet.target_phase !== "Phase42F") return "guard_token_candidate_phase_link_invalid";
  if (packet.mode !== "guard_token_preconsumption_boundary_preview_only" || packet.ready !== true || packet.preview_only !== true) return "guard_token_candidate_mode_invalid";
  if (packet.accepted !== false || packet.persisted !== false) return "guard_token_candidate_already_accepted_or_persisted";
  if (packet.consumption_allowed !== false) return "guard_token_candidate_allows_consumption";
  const scope = packet.scope;
  if (!scope || scope.target_gate !== readiness.target_gate) return "guard_token_scope_target_gate_invalid";
  if (scope.candidate_id !== readiness.candidate_identity?.candidate_id) return "guard_token_scope_candidate_id_mismatch";
  if (scope.candidate_hash !== readiness.candidate_identity?.candidate_hash) return "guard_token_scope_candidate_hash_mismatch";
  if (scope.source_text_hash !== readiness.candidate_identity?.source_text_hash) return "guard_token_scope_source_hash_mismatch";
  if (scope.source_store_scope !== "sandbox_candidate_store") return "guard_token_scope_source_store_invalid";
  if (scope.target_store_scope !== "production_candidate_store") return "guard_token_scope_target_store_invalid";
  if (scope.mutation_allowed !== false) return "guard_token_scope_allows_mutation";
  const expectedScopeHash = sha256Text(JSON.stringify(scope));
  if (packet.scope_hash !== expectedScopeHash) return "guard_token_scope_hash_invalid";
  const token = packet.token;
  if (!token || token.shape !== "phase42f_guard_<24hex>" || !/^phase42f_guard_[a-f0-9]{24}$/.test(token.value || "")) return "guard_token_candidate_shape_invalid";
  if (token.source_phase !== "Phase42F") return "guard_token_source_phase_invalid";
  if (token.scope_hash !== expectedScopeHash) return "guard_token_scope_hash_mismatch";
  if (token.preview_only !== true || token.consumed !== false || token.grants !== null) return "guard_token_state_invalid";
  return null;
}

function validateDenialContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_guard_token_consumption_denial_contract") return "guard_token_consumption_denial_contract_missing";
  if (contract.mode !== "guard_token_consumption_denial_preview_only") return "guard_token_consumption_denial_contract_mode_invalid";
  if (contract.source_phase !== "Phase42F" || contract.target_phase !== "Phase42G") return "guard_token_consumption_denial_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "guard_token_consumption_denial_contract_target_gate_invalid";
  if (contract.guard_token_consumption_allowed !== false) return "guard_token_consumption_denial_contract_allows_guard_token_consume";
  if (contract.guard_token_consumption_authorization_allowed !== false) return "guard_token_consumption_denial_contract_allows_guard_token_authorize";
  if (contract.operator_confirmation_grant_allowed !== false) return "guard_token_consumption_denial_contract_allows_operator_confirmation_grant";
  if (contract.production_write_allowed !== false) return "guard_token_consumption_denial_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "guard_token_consumption_denial_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "guard_token_consumption_denial_contract_allows_gate_open";
  if (contract.audit_receipt_creation_allowed !== false) return "guard_token_consumption_denial_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "guard_token_consumption_denial_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "guard_token_consumption_denial_contract_allows_rollback_restore";
  if (contract.approval_request_creation_allowed !== false) return "guard_token_consumption_denial_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "guard_token_consumption_denial_contract_allows_pending_engine_candidate";
  if (contract.adoption_allowed !== false) return "guard_token_consumption_denial_contract_allows_adoption";
  if (contract.settlement_allowed !== false) return "guard_token_consumption_denial_contract_allows_settlement";
  if (contract.canon_update_allowed !== false) return "guard_token_consumption_denial_contract_allows_canon_update";
  if (contract.active_engine_update_allowed !== false) return "guard_token_consumption_denial_contract_allows_active_engine_update";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "guard_token_consumption_denial_contract_required_field_invalid";
  return null;
}

function buildRejection(reason, state = BASELINE_STATE, extra = {}) {
  return {
    accepted: false,
    reason,
    ...deepClone(BASELINE_STATE),
    state_after: deepClone(state),
    blocked_direct_actions: BLOCKED_ACTIONS,
    ...extra,
  };
}

function buildGuardTokenConsumptionDenialPreview({ readiness, contract, userRequest }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = { ...intent };
  const state = {
    ...deepClone(BASELINE_STATE),
    phase42g_guard_token_consumption_denial_generated: false,
    phase42g_guard_token_consumption_denial_persisted: false,
  };

  if (!intent.explicit) return buildRejection("missing_explicit_phase42g_guard_token_consumption_denial_request", state, { direct_requests_detected: directRequestsDetected });
  if (!intent.guard_token_consumption_request) return buildRejection("missing_explicit_guard_token_consumption_request_to_deny", state, { direct_requests_detected: directRequestsDetected });
  const readinessError = validatePhase42FPreconsumptionReadiness(readiness);
  if (readinessError) return buildRejection(readinessError, state, { direct_requests_detected: directRequestsDetected });
  const tokenError = validateGuardTokenCandidate(readiness);
  if (tokenError) return buildRejection(tokenError, state, { direct_requests_detected: directRequestsDetected });
  const contractError = validateDenialContract(contract);
  if (contractError) return buildRejection(contractError, state, { direct_requests_detected: directRequestsDetected });

  const token = readiness.guard_token_preconsumption_candidate.token;
  const denialHash = sha256Text(JSON.stringify({
    phase: "Phase42G",
    token_value: token.value,
    request: userRequest,
    contract_kind: contract.kind,
    full_run_all_status: readiness.full_run_all_status,
  }));
  const preview = {
    id: `phase42g_guard_token_consumption_denial_${denialHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_guard_token_consumption_denial_preview",
    phase: "Phase42G",
    source_phase: "Phase42F",
    target_gate: readiness.target_gate,
    mode: "guard_token_consumption_denial_preview_only",
    preview_only: true,
    persisted: false,
    phase42f_preconsumption_readiness_verified: true,
    explicit_guard_token_consumption_request_detected: true,
    guard_token_candidate_shape_verified: true,
    guard_token_scope_verified: true,
    guard_token_consumption_denial_accepted: true,
    guard_token_consumption_denied: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    operator_confirmation_granted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
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

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_guard_token_consumption_denial_preview_only",
    phase42g_guard_token_consumption_denial_generated: true,
    phase42g_guard_token_consumption_denial_persisted: false,
    phase42f_preconsumption_readiness_verified: true,
    explicit_guard_token_consumption_request_detected: true,
    guard_token_candidate_shape_verified: true,
    guard_token_scope_verified: true,
    guard_token_consumption_denial_accepted: true,
    guard_token_consumption_denied: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    operator_confirmation_granted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
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
    guard_token_consumption_denial_preview: preview,
    state_after: deepClone(BASELINE_STATE),
    blocked_direct_actions: BLOCKED_ACTIONS,
    direct_requests_detected: directRequestsDetected,
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42g_guard_token_consumption_denial_generated, false);
  assert.equal(result.phase42g_guard_token_consumption_denial_persisted, false);
  assert.equal(result.guard_token_consumption_authorized, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

for (const [name, readiness, reason] of [
  ["readiness not accepted", makePhase42FPreconsumptionReadinessPreview({ accepted: false }), "phase42f_preconsumption_readiness_not_accepted"],
  ["wrong readiness phase", makePhase42FPreconsumptionReadinessPreview({ phase: "Phase42E" }), "phase42f_preconsumption_readiness_phase_invalid"],
  ["boundary persisted", makePhase42FPreconsumptionReadinessPreview({ phase42f_guard_token_preconsumption_boundary_persisted: true }), "phase42f_preconsumption_boundary_persisted"],
  ["preconsumption not accepted", makePhase42FPreconsumptionReadinessPreview({ guard_token_preconsumption_readiness_accepted: false }), "phase42f_preconsumption_readiness_not_marked_accepted"],
  ["consumption authorized", makePhase42FPreconsumptionReadinessPreview({ guard_token_consumption_authorized: true }), "phase42f_authorizes_guard_token_consumption"],
  ["token consumed", makePhase42FPreconsumptionReadinessPreview({ guard_token_consumed: true }), "phase42f_guard_token_already_consumed"],
  ["gate opened", makePhase42FPreconsumptionReadinessPreview({ production_promotion_gate_opened: true }), "phase42f_gate_opened"],
  ["full run all claimed", makePhase42FPreconsumptionReadinessPreview({ full_run_all_status: "passed", full_run_all_passed_claimed: true }), "phase42f_full_run_all_status_invalid"],
  ["next phase invalid", makePhase42FPreconsumptionReadinessPreview({ next_allowed_phase: "phase42h-skip-ahead" }), "phase42f_next_allowed_phase_invalid"],
]) {
  assert.equal(typeof name, "string");
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness,
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G guard token consumption denial smoke. Detect consume guard token request and deny it.",
  });
  assertRejected(result, reason);
}

for (const [field, value, reason] of [
  ["mode", "production_write_mode", "guard_token_consumption_denial_contract_mode_invalid"],
  ["guard_token_consumption_allowed", true, "guard_token_consumption_denial_contract_allows_guard_token_consume"],
  ["guard_token_consumption_authorization_allowed", true, "guard_token_consumption_denial_contract_allows_guard_token_authorize"],
  ["operator_confirmation_grant_allowed", true, "guard_token_consumption_denial_contract_allows_operator_confirmation_grant"],
  ["production_write_allowed", true, "guard_token_consumption_denial_contract_allows_production_write"],
  ["production_promotion_allowed", true, "guard_token_consumption_denial_contract_allows_production_promotion"],
  ["production_gate_open_allowed", true, "guard_token_consumption_denial_contract_allows_gate_open"],
  ["audit_receipt_creation_allowed", true, "guard_token_consumption_denial_contract_allows_audit_receipt"],
  ["backup_snapshot_creation_allowed", true, "guard_token_consumption_denial_contract_allows_backup_snapshot"],
  ["rollback_restore_execution_allowed", true, "guard_token_consumption_denial_contract_allows_rollback_restore"],
  ["approval_request_creation_allowed", true, "guard_token_consumption_denial_contract_allows_approval_request"],
  ["pending_engine_candidate_creation_allowed", true, "guard_token_consumption_denial_contract_allows_pending_engine_candidate"],
  ["adoption_allowed", true, "guard_token_consumption_denial_contract_allows_adoption"],
  ["settlement_allowed", true, "guard_token_consumption_denial_contract_allows_settlement"],
  ["canon_update_allowed", true, "guard_token_consumption_denial_contract_allows_canon_update"],
  ["active_engine_update_allowed", true, "guard_token_consumption_denial_contract_allows_active_engine_update"],
  ["guard_token_consumption_request_must_be_denied", false, "guard_token_consumption_denial_contract_required_field_invalid"],
]) {
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness: makePhase42FPreconsumptionReadinessPreview(),
    contract: makeGuardTokenConsumptionDenialContract({ [field]: value }),
    userRequest: "Phase42G guard token consumption denial smoke. Detect consume guard token request and deny it.",
  });
  assertRejected(result, reason);
}

{
  const readiness = makePhase42FPreconsumptionReadinessPreview();
  readiness.guard_token_preconsumption_candidate.token.value = "bad-token";
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness,
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G guard token consumption denial smoke. Detect consume guard token request and deny it.",
  });
  assertRejected(result, "guard_token_candidate_shape_invalid");
}

{
  const readiness = makePhase42FPreconsumptionReadinessPreview();
  readiness.guard_token_preconsumption_candidate.scope.mutation_allowed = true;
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness,
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G guard token consumption denial smoke. Detect consume guard token request and deny it.",
  });
  assertRejected(result, "guard_token_scope_allows_mutation");
}

{
  const readiness = makePhase42FPreconsumptionReadinessPreview();
  readiness.guard_token_preconsumption_candidate.token.consumed = true;
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness,
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G guard token consumption denial smoke. Detect consume guard token request and deny it.",
  });
  assertRejected(result, "guard_token_state_invalid");
}

{
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness: makePhase42FPreconsumptionReadinessPreview(),
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Build future guard token notes without naming Phase42G.",
  });
  assertRejected(result, "missing_explicit_phase42g_guard_token_consumption_denial_request");
}

{
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness: makePhase42FPreconsumptionReadinessPreview(),
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G guard token denial smoke. Keep everything preview-only.",
  });
  assertRejected(result, "missing_explicit_guard_token_consumption_request_to_deny");
}

{
  const result = buildGuardTokenConsumptionDenialPreview({
    readiness: makePhase42FPreconsumptionReadinessPreview(),
    contract: makeGuardTokenConsumptionDenialContract(),
    userRequest: "Phase42G production candidate store promotion gate guard token consumption denial smoke. Detect consume guard token request and deny it. Do not consume guard token, do not authorize guard token consumption, do not grant operator confirmation, do not open gate, do not write production, do not promote production, do not create audit receipt, do not create backup snapshot, do not execute rollback, do not create approval request, do not create pending engine candidate, do not adopt, do not settle, do not update Canon, do not update active_engine, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_guard_token_consumption_denial_preview_only");
  assert.equal(result.phase42g_guard_token_consumption_denial_generated, true);
  assert.equal(result.phase42g_guard_token_consumption_denial_persisted, false);
  assert.equal(result.phase42f_preconsumption_readiness_verified, true);
  assert.equal(result.explicit_guard_token_consumption_request_detected, true);
  assert.equal(result.guard_token_candidate_shape_verified, true);
  assert.equal(result.guard_token_scope_verified, true);
  assert.equal(result.guard_token_consumption_denial_accepted, true);
  assert.equal(result.guard_token_consumption_denied, true);
  assert.equal(result.guard_token_consumption_authorized, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.operator_confirmation_granted, false);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_gate_open_allowed, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
  assertFalseFields(result.guard_token_consumption_denial_preview, MUTATION_FIELDS.filter((field) => field in result.guard_token_consumption_denial_preview));
  assert.equal(result.guard_token_consumption_denial_preview.phase42f_preconsumption_readiness_verified, true);
  assert.equal(result.guard_token_consumption_denial_preview.explicit_guard_token_consumption_request_detected, true);
  assert.equal(result.guard_token_consumption_denial_preview.guard_token_consumption_denial_accepted, true);
  assert.equal(result.guard_token_consumption_denial_preview.guard_token_consumption_denied, true);
  assert.equal(result.guard_token_consumption_denial_preview.guard_token_consumption_authorized, false);
  assert.equal(result.guard_token_consumption_denial_preview.guard_token_consumed, false);
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.guard_token_consumption_request, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.operator_confirmation_grant, true);
  assert.equal(result.direct_requests_detected.audit_receipt, true);
  assert.equal(result.direct_requests_detected.backup_snapshot, true);
  assert.equal(result.direct_requests_detected.rollback_restore, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

console.log("Phase42G production candidate store promotion gate guard token consumption denial smoke tests passed.");

