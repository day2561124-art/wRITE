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
  phase42f_guard_token_preconsumption_boundary_generated: false,
  phase42f_guard_token_preconsumption_boundary_persisted: false,
  phase42e_final_readiness_verified: false,
  guard_token_candidate_shape_verified: false,
  guard_token_scope_verified: false,
  guard_token_preconsumption_readiness_accepted: false,
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
  "phase42f_guard_token_preconsumption_boundary_persisted",
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
  "phase42e_final_readiness_required",
  "explicit_phase42f_guard_token_preconsumption_request_required",
  "guard_token_preconsumption_preview_only",
  "guard_token_preconsumption_must_not_persist",
  "guard_token_candidate_shape_required",
  "guard_token_scope_required",
  "guard_token_must_remain_unconsumed",
  "preconsumption_readiness_must_not_authorize_guard_token_consumption",
  "preconsumption_readiness_must_not_grant_operator_confirmation",
  "preconsumption_readiness_must_not_open_gate",
  "preconsumption_readiness_must_not_write_production",
  "preconsumption_readiness_must_not_promote_production",
  "preconsumption_readiness_must_not_create_approval_request",
  "preconsumption_readiness_must_not_create_pending_engine_candidate",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_must_not_execute",
  "adoption_must_not_run",
  "settlement_must_not_run",
  "canon_must_not_update",
  "active_engine_must_not_update",
  "full_run_all_must_remain_pending_until_explicitly_rerun",
];

const ALLOWED_PHASE42E_NEXT_PHASES = [
  "phase42f-production-candidate-store-promotion-gate-guard-token-pre-consumption-boundary-smoke",
  "phase42f-production-candidate-store-promotion-gate-guard-token-preconsumption-boundary-smoke",
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

function makePhase42EFinalReadinessPreview(overrides = {}) {
  const candidateId = "candidate_6a9cb9021f27e75af0b94a31";
  const sourceTextHash = sha256Text("Chapter title\n\nA safe story-like native chat output body.");
  const candidateContentHash = sha256Text(JSON.stringify({
    kind: "chat_output",
    route: "chatgpt_native_full_neural_writing_handoff",
    text: "Chapter title\n\nA safe story-like native chat output body.",
  }));

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview_only",
    id: "phase42e_operator_confirmation_final_readiness_7f0c1e0d2b3a4c5d6e7f8091",
    kind: "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview",
    phase: "Phase42E",
    source_phase: "Phase42D",
    source_chain: [...PHASE41_CHAIN],
    phase41_closed: true,
    source_chain_complete: true,
    target_gate: "production_candidate_store_promotion_gate",
    mode: "operator_confirmation_final_readiness_preview_only",
    generated: true,
    persisted: false,
    candidate_id: candidateId,
    candidate_content_hash: candidateContentHash,
    source_text_hash: sourceTextHash,
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    phase42d_operator_confirmation_boundary_accepted: true,
    operator_confirmation_accepted: true,
    operator_confirmation_final_readiness_verified: true,
    operator_confirmation_granted: false,
    confirmation_still_preview_only: true,
    guard_token_preconsumption_packet_ready: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    production_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
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
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42f-production-candidate-store-promotion-gate-guard-token-pre-consumption-boundary-smoke",
    ...overrides,
  };
}

function makeGuardTokenScope(readiness = makePhase42EFinalReadinessPreview(), overrides = {}) {
  return {
    target_gate: readiness.target_gate,
    candidate_id: readiness.candidate_id,
    candidate_content_hash: readiness.candidate_content_hash,
    source_text_hash: readiness.source_text_hash,
    source_route: readiness.source_route,
    source_store_scope: readiness.source_store_scope,
    target_store_scope: readiness.target_store_scope,
    final_readiness_id: readiness.id,
    mutation_allowed: false,
    ...overrides,
  };
}

function makeGuardTokenPreconsumptionCandidate(overrides = {}) {
  const readiness = overrides.readiness || makePhase42EFinalReadinessPreview();
  const scope = makeGuardTokenScope(readiness, overrides.guard_token_scope || {});
  const scopeHash = sha256Text(JSON.stringify(scope));
  const tokenValue = `phase42f_guard_${sha256Text(`Phase42F|${scopeHash}`).slice(0, 24)}`;

  const packet = {
    kind: "guard_token_preconsumption_candidate",
    source_phase: "Phase42E",
    target_phase: "Phase42F",
    target_gate: readiness.target_gate,
    mode: "guard_token_preconsumption_boundary_preview_only",
    ready: true,
    preview_only: true,
    guard_token: {
      value: tokenValue,
      shape: "phase42f_guard_<24hex>",
      scope_hash: scopeHash,
      preview_only: true,
      consumed: false,
      consumption_authorized: false,
      grants: null,
    },
    guard_token_scope: scope,
    accepted: false,
    persisted: false,
    consumption_allowed: false,
  };

  delete overrides.readiness;
  delete overrides.guard_token_scope;

  return {
    ...packet,
    ...overrides,
  };
}

function makeGuardTokenPreconsumptionBoundaryContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_contract",
    mode: "guard_token_preconsumption_boundary_preview_only",
    source_phase: "Phase42E",
    target_phase: "Phase42F",
    target_gate: "production_candidate_store_promotion_gate",
    guard_token_consumption_allowed: false,
    operator_confirmation_grant_allowed: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase42e_final_readiness_required: true,
    explicit_phase42f_guard_token_preconsumption_request_required: true,
    guard_token_preconsumption_preview_only: true,
    guard_token_preconsumption_must_not_persist: true,
    guard_token_candidate_shape_required: true,
    guard_token_scope_required: true,
    guard_token_must_remain_unconsumed: true,
    preconsumption_readiness_must_not_authorize_guard_token_consumption: true,
    preconsumption_readiness_must_not_grant_operator_confirmation: true,
    preconsumption_readiness_must_not_open_gate: true,
    preconsumption_readiness_must_not_write_production: true,
    preconsumption_readiness_must_not_promote_production: true,
    preconsumption_readiness_must_not_create_approval_request: true,
    preconsumption_readiness_must_not_create_pending_engine_candidate: true,
    audit_receipt_must_not_be_created: true,
    backup_snapshot_must_not_be_created: true,
    rollback_restore_must_not_execute: true,
    adoption_must_not_run: true,
    settlement_must_not_run: true,
    canon_must_not_update: true,
    active_engine_must_not_update: true,
    full_run_all_must_remain_pending_until_explicitly_rerun: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /phase42f/.test(normalized) && /guard token/.test(normalized) && /pre-consumption|preconsumption|boundary/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    gate_open: /\bopen\b.*\bgate\b|\bgate\b.*\bopen\b/.test(normalized),
    operator_confirmation_grant: /\bgrant\b.*\boperator confirmation\b|\boperator confirmation\b.*\bgrant\b/.test(normalized),
    guard_token: /\bconsume\b.*\bguard token\b|\bguard token\b.*\bconsume\b/.test(normalized),
    audit_receipt: /\bcreate\b.*\baudit receipt\b|\baudit receipt\b.*\bcreate\b/.test(normalized),
    backup_snapshot: /\bcreate\b.*\bbackup\b|\bbackup snapshot\b.*\bcreate\b/.test(normalized),
    rollback_restore: /\bexecute\b.*\brollback\b|\brollback\b.*\bexecute\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
    full_run_all_passed: /full run-all passed|full run all passed|full_run_all_passed/.test(normalized),
  };
}

function validatePhase42EFinalReadiness(readiness) {
  if (!readiness?.accepted) return "phase42e_final_readiness_not_accepted";
  if (readiness.phase !== "Phase42E" || readiness.kind !== "production_candidate_store_promotion_gate_operator_confirmation_final_readiness_preview") return "phase42e_final_readiness_kind_invalid";
  if (readiness.source_phase !== "Phase42D" || readiness.target_gate !== "production_candidate_store_promotion_gate") return "phase42e_final_readiness_link_invalid";
  if (readiness.mode !== "operator_confirmation_final_readiness_preview_only" || readiness.generated !== true || readiness.persisted !== false) return "phase42e_final_readiness_mode_invalid";
  if (!ALLOWED_PHASE42E_NEXT_PHASES.includes(readiness.next_allowed_phase)) return "phase42e_next_phase_link_invalid";
  if (readiness.source_chain_complete !== true || readiness.phase41_closed !== true) return "phase42e_source_chain_not_closed";
  for (const phase of PHASE41_CHAIN) if (!readiness.source_chain?.includes(phase)) return "phase42e_source_chain_incomplete";
  if (!readiness.candidate_id || !readiness.candidate_content_hash || !readiness.source_text_hash || !readiness.source_route) return "phase42e_candidate_identity_missing";
  if (readiness.source_store_scope !== "sandbox_candidate_store" || readiness.target_store_scope !== "production_candidate_store") return "phase42e_store_scope_invalid";
  if (readiness.phase42d_operator_confirmation_boundary_accepted !== true || readiness.operator_confirmation_accepted !== true || readiness.operator_confirmation_final_readiness_verified !== true) return "phase42e_operator_confirmation_readiness_missing";
  if (readiness.guard_token_preconsumption_packet_ready !== true) return "phase42e_guard_token_preconsumption_packet_not_ready";
  if (readiness.production_write_allowed !== false || readiness.production_promotion_allowed !== false || readiness.production_gate_opened !== false) return "phase42e_write_policy_invalid";
  if (readiness.production_write_performed !== false || readiness.production_promotion_performed !== false || readiness.production_candidate_store_mutated !== false) return "phase42e_already_mutated_production";
  for (const field of ["operator_confirmation_granted", "guard_token_consumption_authorized", "guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "audit_receipt_created", "backup_snapshot_created", "rollback_restore_executed", "full_run_all_passed_claimed"]) if (readiness[field] !== false) return "phase42e_forbidden_action_detected";
  if (readiness.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42e_full_run_all_status_invalid";
  return null;
}

function validateBoundaryContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_contract") return "guard_token_preconsumption_contract_missing";
  if (contract.mode !== "guard_token_preconsumption_boundary_preview_only") return "guard_token_preconsumption_contract_mode_invalid";
  if (contract.source_phase !== "Phase42E" || contract.target_phase !== "Phase42F") return "guard_token_preconsumption_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "guard_token_preconsumption_contract_target_gate_invalid";
  if (contract.guard_token_consumption_allowed !== false) return "guard_token_preconsumption_contract_allows_guard_token_consume";
  if (contract.operator_confirmation_grant_allowed !== false) return "guard_token_preconsumption_contract_allows_operator_confirmation_grant";
  if (contract.production_write_allowed !== false) return "guard_token_preconsumption_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "guard_token_preconsumption_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "guard_token_preconsumption_contract_allows_gate_open";
  if (contract.audit_receipt_creation_allowed !== false) return "guard_token_preconsumption_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "guard_token_preconsumption_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "guard_token_preconsumption_contract_allows_rollback_restore";
  if (contract.approval_request_creation_allowed !== false) return "guard_token_preconsumption_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "guard_token_preconsumption_contract_allows_pending_engine_candidate";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "guard_token_preconsumption_contract_required_field_invalid";
  return null;
}

function validateGuardTokenPreconsumptionCandidate(packet, readiness) {
  if (packet?.kind !== "guard_token_preconsumption_candidate") return "guard_token_preconsumption_candidate_missing";
  if (packet.source_phase !== "Phase42E" || packet.target_phase !== "Phase42F") return "guard_token_preconsumption_candidate_phase_link_invalid";
  if (packet.target_gate !== readiness.target_gate) return "guard_token_preconsumption_candidate_target_gate_mismatch";
  if (packet.mode !== "guard_token_preconsumption_boundary_preview_only" || packet.ready !== true || packet.preview_only !== true) return "guard_token_preconsumption_candidate_mode_invalid";
  if (packet.accepted !== false || packet.persisted !== false) return "guard_token_preconsumption_candidate_already_accepted_or_persisted";
  if (packet.consumption_allowed !== false) return "guard_token_preconsumption_candidate_allows_consumption";
  const scope = packet.guard_token_scope;
  if (!scope || scope.target_gate !== readiness.target_gate) return "guard_token_scope_target_gate_mismatch";
  if (scope.candidate_id !== readiness.candidate_id) return "guard_token_scope_candidate_mismatch";
  if (scope.candidate_content_hash !== readiness.candidate_content_hash) return "guard_token_scope_candidate_hash_mismatch";
  if (scope.source_text_hash !== readiness.source_text_hash) return "guard_token_scope_source_hash_mismatch";
  if (scope.source_route !== readiness.source_route) return "guard_token_scope_source_route_mismatch";
  if (scope.source_store_scope !== "sandbox_candidate_store" || scope.target_store_scope !== "production_candidate_store") return "guard_token_scope_store_mismatch";
  if (scope.final_readiness_id !== readiness.id) return "guard_token_scope_final_readiness_mismatch";
  if (scope.mutation_allowed !== false) return "guard_token_scope_allows_mutation";
  const token = packet.guard_token;
  if (!token || token.shape !== "phase42f_guard_<24hex>" || !/^phase42f_guard_[a-f0-9]{24}$/.test(token.value || "")) return "guard_token_candidate_shape_invalid";
  if (token.scope_hash !== sha256Text(JSON.stringify(scope))) return "guard_token_scope_hash_mismatch";
  if (token.preview_only !== true || token.consumed !== false || token.consumption_authorized !== false || token.grants !== null) return "guard_token_policy_invalid";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42f_guard_token_preconsumption_boundary_generated: false,
    phase42f_guard_token_preconsumption_boundary_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildGuardTokenPreconsumptionBoundaryPreview({ readiness, guardTokenCandidate, contract, userRequest, state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = {
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    gate_open: intent.gate_open,
    operator_confirmation_grant: intent.operator_confirmation_grant,
    guard_token: intent.guard_token,
    audit_receipt: intent.audit_receipt,
    backup_snapshot: intent.backup_snapshot,
    rollback_restore: intent.rollback_restore,
    approval: intent.approval,
    pending_engine: intent.pending_engine,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon: intent.canon,
    active_engine: intent.active_engine,
    full_run_all_passed: intent.full_run_all_passed,
  };

  for (const error of [
    validatePhase42EFinalReadiness(readiness),
    validateBoundaryContract(contract),
    validateGuardTokenPreconsumptionCandidate(guardTokenCandidate, readiness || {}),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42f_guard_token_preconsumption_boundary_request", state, { direct_requests_detected: directRequestsDetected });

  const previewSource = JSON.stringify({
    phase: "Phase42F",
    readinessId: readiness.id,
    candidateId: readiness.candidate_id,
    guardTokenShape: guardTokenCandidate.guard_token.shape,
    guardTokenScopeHash: guardTokenCandidate.guard_token.scope_hash,
    fullRunAllStatus: readiness.full_run_all_status,
  });
  const boundaryHash = sha256Text(previewSource);

  const boundaryPreview = {
    id: `phase42f_guard_token_preconsumption_boundary_${boundaryHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_preview",
    phase: "Phase42F",
    source_phase: "Phase42E",
    target_gate: readiness.target_gate,
    mode: "guard_token_preconsumption_boundary_preview_only",
    generated: true,
    persisted: false,
    phase42e_final_readiness_id: readiness.id,
    phase42e_final_readiness_verified: true,
    candidate_id: readiness.candidate_id,
    guard_token_candidate_shape_verified: true,
    guard_token_scope_verified: true,
    guard_token_preconsumption_readiness_accepted: true,
    guard_token_consumption_authorized: false,
    guard_token_consumed: false,
    operator_confirmation_granted: false,
    production_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: readiness.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42g-production-candidate-store-promotion-gate-guard-token-consumption-final-readiness-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_preview_only",
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
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: readiness.full_run_all_status,
    full_run_all_passed_claimed: false,
    guard_token_preconsumption_boundary_preview: boundaryPreview,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42f_guard_token_preconsumption_boundary_generated, false);
  assert.equal(result.phase42f_guard_token_preconsumption_boundary_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ accepted: false }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_final_readiness_not_accepted");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ persisted: true }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_final_readiness_mode_invalid");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ operator_confirmation_accepted: false }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_operator_confirmation_readiness_missing");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ guard_token_preconsumption_packet_ready: false }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_guard_token_preconsumption_packet_not_ready");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ guard_token_consumed: true }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_forbidden_action_detected");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, "phase42e_forbidden_action_detected");
}

for (const [contractOverride, reason] of [
  [{ mode: "guard_token_consume" }, "guard_token_preconsumption_contract_mode_invalid"],
  [{ guard_token_consumption_allowed: true }, "guard_token_preconsumption_contract_allows_guard_token_consume"],
  [{ operator_confirmation_grant_allowed: true }, "guard_token_preconsumption_contract_allows_operator_confirmation_grant"],
  [{ production_write_allowed: true }, "guard_token_preconsumption_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "guard_token_preconsumption_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "guard_token_preconsumption_contract_allows_gate_open"],
  [{ audit_receipt_creation_allowed: true }, "guard_token_preconsumption_contract_allows_audit_receipt"],
  [{ backup_snapshot_creation_allowed: true }, "guard_token_preconsumption_contract_allows_backup_snapshot"],
  [{ rollback_restore_execution_allowed: true }, "guard_token_preconsumption_contract_allows_rollback_restore"],
  [{ approval_request_creation_allowed: true }, "guard_token_preconsumption_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "guard_token_preconsumption_contract_allows_pending_engine_candidate"],
  [{ guard_token_candidate_shape_required: false }, "guard_token_preconsumption_contract_required_field_invalid"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "guard_token_preconsumption_contract_required_field_invalid"],
]) {
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview(),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(contractOverride),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, reason);
}

for (const [candidateOverride, reason] of [
  [{ ready: false }, "guard_token_preconsumption_candidate_mode_invalid"],
  [{ accepted: true }, "guard_token_preconsumption_candidate_already_accepted_or_persisted"],
  [{ persisted: true }, "guard_token_preconsumption_candidate_already_accepted_or_persisted"],
  [{ consumption_allowed: true }, "guard_token_preconsumption_candidate_allows_consumption"],
  [{ guard_token_scope: makeGuardTokenScope(makePhase42EFinalReadinessPreview(), { candidate_id: "candidate_mismatch" }) }, "guard_token_scope_candidate_mismatch"],
  [{ guard_token_scope: makeGuardTokenScope(makePhase42EFinalReadinessPreview(), { mutation_allowed: true }) }, "guard_token_scope_allows_mutation"],
  [{ guard_token: { ...makeGuardTokenPreconsumptionCandidate().guard_token, value: "bad_token" } }, "guard_token_candidate_shape_invalid"],
  [{ guard_token: { ...makeGuardTokenPreconsumptionCandidate().guard_token, consumed: true } }, "guard_token_policy_invalid"],
  [{ guard_token: { ...makeGuardTokenPreconsumptionCandidate().guard_token, consumption_authorized: true } }, "guard_token_policy_invalid"],
  [{ guard_token: { ...makeGuardTokenPreconsumptionCandidate().guard_token, grants: { open_gate: true } } }, "guard_token_policy_invalid"],
]) {
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview(),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(candidateOverride),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary",
  });
  assertRejected(result, reason);
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview(),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Build future guard notes without naming Phase42F",
  });
  assertRejected(result, "missing_explicit_phase42f_guard_token_preconsumption_boundary_request");
}

{
  const result = buildGuardTokenPreconsumptionBoundaryPreview({
    readiness: makePhase42EFinalReadinessPreview(),
    guardTokenCandidate: makeGuardTokenPreconsumptionCandidate(),
    contract: makeGuardTokenPreconsumptionBoundaryContract(),
    userRequest: "Phase42F production candidate store promotion gate guard token pre-consumption boundary. Verify token shape and scope only as preview. Do not consume guard token, do not grant operator confirmation, do not open gate, do not write production, do not promote production, do not create audit receipt, do not create backup snapshot, do not execute rollback, do not create approval request, do not create pending engine candidate, do not adopt, do not settle, do not update Canon, do not update active_engine, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_guard_token_preconsumption_boundary_preview_only");
  assert.equal(result.phase42f_guard_token_preconsumption_boundary_generated, true);
  assert.equal(result.phase42f_guard_token_preconsumption_boundary_persisted, false);
  assert.equal(result.phase42e_final_readiness_verified, true);
  assert.equal(result.guard_token_candidate_shape_verified, true);
  assert.equal(result.guard_token_scope_verified, true);
  assert.equal(result.guard_token_preconsumption_readiness_accepted, true);
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
  assertFalseFields(result.guard_token_preconsumption_boundary_preview, MUTATION_FIELDS.filter((field) => field in result.guard_token_preconsumption_boundary_preview));
  assert.equal(result.guard_token_preconsumption_boundary_preview.phase42e_final_readiness_verified, true);
  assert.equal(result.guard_token_preconsumption_boundary_preview.guard_token_candidate_shape_verified, true);
  assert.equal(result.guard_token_preconsumption_boundary_preview.guard_token_scope_verified, true);
  assert.equal(result.guard_token_preconsumption_boundary_preview.guard_token_preconsumption_readiness_accepted, true);
  assert.equal(result.guard_token_preconsumption_boundary_preview.guard_token_consumption_authorized, false);
  assert.equal(result.guard_token_preconsumption_boundary_preview.guard_token_consumed, false);
  assert.equal(result.guard_token_preconsumption_boundary_preview.operator_confirmation_granted, false);
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.operator_confirmation_grant, true);
  assert.equal(result.direct_requests_detected.guard_token, true);
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

console.log("Phase42F production candidate store promotion gate guard token pre-consumption boundary smoke tests passed.");

