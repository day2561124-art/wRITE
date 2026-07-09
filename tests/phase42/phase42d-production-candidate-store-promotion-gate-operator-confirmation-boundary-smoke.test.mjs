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
  phase42d_operator_confirmation_boundary_generated: false,
  phase42d_operator_confirmation_boundary_persisted: false,
  explicit_operator_confirmation_request_verified: false,
  confirmation_text_verified: false,
  confirmation_phrase_verified: false,
  confirmation_scope_verified: false,
  confirmation_token_shape_verified: false,
  operator_confirmation_accepted: false,
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
  audit_receipt_created: false,
  backup_snapshot_created: false,
  rollback_restore_executed: false,
  full_run_all_passed_claimed: false,
});

const BLOCKED_ACTIONS = [
  "operator_confirmation_grant",
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_candidate_store_mutation",
  "production_promotion_gate_open",
  "guard_token_consume",
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
  "phase42d_operator_confirmation_boundary_persisted",
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
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "full_run_all_passed_claimed",
];

const CONTRACT_TRUE_FIELDS = [
  "phase42c_preflight_contract_required",
  "explicit_phase42d_operator_confirmation_request_required",
  "operator_confirmation_boundary_preview_only",
  "operator_confirmation_boundary_must_not_persist",
  "confirmation_text_required",
  "confirmation_phrase_required",
  "confirmation_scope_required",
  "confirmation_token_shape_required",
  "confirmation_accepted_must_not_grant_operator_confirmation",
  "confirmation_accepted_must_not_open_gate",
  "confirmation_accepted_must_not_write_production",
  "confirmation_accepted_must_not_promote_production",
  "confirmation_accepted_must_not_create_approval_request",
  "confirmation_accepted_must_not_create_pending_engine_candidate",
  "guard_token_must_remain_unconsumed",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_must_not_execute",
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

function makePhase42CPreflightPreview(overrides = {}) {
  const sourceTextHash = sha256Text("Chapter title\n\nA safe story-like native chat output body.");
  const candidateContentHash = sha256Text(JSON.stringify({
    kind: "chat_output",
    route: "chatgpt_native_full_neural_writing_handoff",
    text: "Chapter title\n\nA safe story-like native chat output body.",
  }));

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_preflight_contract_preview_only",
    id: "phase42c_preflight_contract_d2b5e22b9a31061f49e7f718",
    kind: "production_candidate_store_promotion_gate_preflight_contract_preview",
    phase: "Phase42C",
    source_phase: "Phase42B",
    source_chain: [...PHASE41_CHAIN],
    phase41_closed: true,
    source_chain_complete: true,
    target_gate: "production_candidate_store_promotion_gate",
    mode: "preflight_contract_preview_only",
    generated: true,
    persisted: false,
    candidate_id: "candidate_6a9cb9021f27e75af0b94a31",
    candidate_identity_verified: true,
    candidate_content_hash: candidateContentHash,
    candidate_content_hash_verified: true,
    source_text_hash: sourceTextHash,
    source_text_hash_verified: true,
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_route_link_verified: true,
    source_store_scope: "sandbox_candidate_store",
    source_scope_verified: true,
    target_store_scope: "production_candidate_store",
    target_scope_verified: true,
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
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42d-production-candidate-store-promotion-gate-operator-confirmation-boundary-smoke",
    ...overrides,
  };
}

function makeConfirmationScope(preflightPreview = makePhase42CPreflightPreview(), overrides = {}) {
  return {
    target_gate: preflightPreview.target_gate,
    candidate_id: preflightPreview.candidate_id,
    candidate_content_hash: preflightPreview.candidate_content_hash,
    source_text_hash: preflightPreview.source_text_hash,
    source_route: preflightPreview.source_route,
    source_store_scope: preflightPreview.source_store_scope,
    target_store_scope: preflightPreview.target_store_scope,
    mutation_allowed: false,
    ...overrides,
  };
}

function makeOperatorConfirmationPacket(overrides = {}) {
  const preflightPreview = overrides.preflightPreview || makePhase42CPreflightPreview();
  const scope = overrides.confirmation_scope || makeConfirmationScope(preflightPreview);
  const scopeHash = sha256Text(JSON.stringify(scope));
  const tokenValue = `phase42d_confirm_${sha256Text(`Phase42D|${scopeHash}`).slice(0, 24)}`;

  const packet = {
    kind: "operator_confirmation_request_packet",
    source_phase: "Phase42C",
    target_phase: "Phase42D",
    target_gate: preflightPreview.target_gate,
    mode: "operator_confirmation_boundary_preview_only",
    ready: true,
    preview_only: true,
    confirmation_text: "Phase42D operator confirmation boundary accepted for preview only.",
    required_confirmation_phrase: "PREVIEW ONLY - DO NOT OPEN PRODUCTION GATE",
    provided_confirmation_phrase: "PREVIEW ONLY - DO NOT OPEN PRODUCTION GATE",
    confirmation_scope: scope,
    confirmation_token: {
      value: tokenValue,
      shape: "phase42d_confirm_<24hex>",
      scope_hash: scopeHash,
      preview_only: true,
      consumed: false,
      grants: null,
    },
    accepted: false,
    granted: false,
  };

  delete overrides.preflightPreview;
  return { ...packet, ...overrides };
}

function makeOperatorConfirmationBoundaryContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_operator_confirmation_boundary_contract",
    mode: "operator_confirmation_boundary_preview_only",
    source_phase: "Phase42C",
    target_phase: "Phase42D",
    target_gate: "production_candidate_store_promotion_gate",
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    operator_confirmation_grant_allowed: false,
    guard_token_consumption_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase42c_preflight_contract_required: true,
    explicit_phase42d_operator_confirmation_request_required: true,
    operator_confirmation_boundary_preview_only: true,
    operator_confirmation_boundary_must_not_persist: true,
    confirmation_text_required: true,
    confirmation_phrase_required: true,
    confirmation_scope_required: true,
    confirmation_token_shape_required: true,
    confirmation_accepted_must_not_grant_operator_confirmation: true,
    confirmation_accepted_must_not_open_gate: true,
    confirmation_accepted_must_not_write_production: true,
    confirmation_accepted_must_not_promote_production: true,
    confirmation_accepted_must_not_create_approval_request: true,
    confirmation_accepted_must_not_create_pending_engine_candidate: true,
    guard_token_must_remain_unconsumed: true,
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
    explicit: /phase42d/.test(normalized) && /operator confirmation/.test(normalized) && /boundary|preflight|confirmation/.test(normalized),
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

function validatePhase42CPreflightPreview(preflightPreview) {
  if (!preflightPreview?.accepted) return "phase42c_preflight_contract_not_accepted";
  if (preflightPreview.phase !== "Phase42C" || preflightPreview.kind !== "production_candidate_store_promotion_gate_preflight_contract_preview") return "phase42c_preflight_contract_kind_invalid";
  if (preflightPreview.source_phase !== "Phase42B" || preflightPreview.target_gate !== "production_candidate_store_promotion_gate") return "phase42c_preflight_contract_link_invalid";
  if (preflightPreview.mode !== "preflight_contract_preview_only" || preflightPreview.generated !== true || preflightPreview.persisted !== false) return "phase42c_preflight_contract_mode_invalid";
  if (preflightPreview.source_chain_complete !== true || preflightPreview.phase41_closed !== true) return "phase42c_source_chain_not_closed";
  for (const phase of PHASE41_CHAIN) if (!preflightPreview.source_chain?.includes(phase)) return "phase42c_source_chain_incomplete";
  for (const field of ["candidate_identity_verified", "candidate_content_hash_verified", "source_text_hash_verified", "source_route_link_verified", "source_scope_verified", "target_scope_verified"]) if (preflightPreview[field] !== true) return "phase42c_preflight_identity_or_scope_not_verified";
  if (!preflightPreview.candidate_id || !preflightPreview.candidate_content_hash || !preflightPreview.source_text_hash || !preflightPreview.source_route) return "phase42c_preflight_identity_missing";
  if (preflightPreview.source_store_scope !== "sandbox_candidate_store" || preflightPreview.target_store_scope !== "production_candidate_store") return "phase42c_preflight_scope_invalid";
  if (preflightPreview.audit_trail_ready !== true || preflightPreview.backup_snapshot_ready !== true || preflightPreview.rollback_restore_ready !== true || preflightPreview.operator_confirmation_packet_ready !== true) return "phase42c_required_readiness_missing";
  if (preflightPreview.production_write_allowed !== false || preflightPreview.production_promotion_allowed !== false || preflightPreview.production_gate_opened !== false) return "phase42c_preflight_write_policy_invalid";
  if (preflightPreview.production_write_performed !== false || preflightPreview.production_promotion_performed !== false || preflightPreview.production_candidate_store_mutated !== false) return "phase42c_preflight_already_mutated_production";
  for (const field of ["operator_confirmation_granted", "guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "audit_receipt_created", "backup_snapshot_created", "rollback_restore_executed", "full_run_all_passed_claimed"]) if (preflightPreview[field] !== false) return "phase42c_preflight_forbidden_action_detected";
  if (preflightPreview.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42c_full_run_all_status_invalid";
  return null;
}

function validateBoundaryContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_operator_confirmation_boundary_contract") return "operator_confirmation_boundary_contract_missing";
  if (contract.mode !== "operator_confirmation_boundary_preview_only") return "operator_confirmation_boundary_contract_mode_invalid";
  if (contract.source_phase !== "Phase42C" || contract.target_phase !== "Phase42D") return "operator_confirmation_boundary_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "operator_confirmation_boundary_contract_target_gate_invalid";
  if (contract.production_write_allowed !== false) return "operator_confirmation_boundary_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "operator_confirmation_boundary_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "operator_confirmation_boundary_contract_allows_gate_open";
  if (contract.operator_confirmation_grant_allowed !== false) return "operator_confirmation_boundary_contract_allows_operator_confirmation_grant";
  if (contract.guard_token_consumption_allowed !== false) return "operator_confirmation_boundary_contract_allows_guard_token_consume";
  if (contract.audit_receipt_creation_allowed !== false) return "operator_confirmation_boundary_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "operator_confirmation_boundary_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "operator_confirmation_boundary_contract_allows_rollback_restore";
  if (contract.approval_request_creation_allowed !== false) return "operator_confirmation_boundary_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "operator_confirmation_boundary_contract_allows_pending_engine_candidate";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "operator_confirmation_boundary_contract_required_field_invalid";
  return null;
}

function validateOperatorConfirmationPacket(packet, preflightPreview) {
  if (packet?.kind !== "operator_confirmation_request_packet") return "operator_confirmation_packet_missing";
  if (packet.source_phase !== "Phase42C" || packet.target_phase !== "Phase42D") return "operator_confirmation_packet_phase_link_invalid";
  if (packet.target_gate !== preflightPreview.target_gate) return "operator_confirmation_packet_target_gate_mismatch";
  if (packet.mode !== "operator_confirmation_boundary_preview_only" || packet.ready !== true || packet.preview_only !== true) return "operator_confirmation_packet_mode_invalid";
  if (!packet.confirmation_text || typeof packet.confirmation_text !== "string") return "operator_confirmation_text_missing";
  if (packet.required_confirmation_phrase !== "PREVIEW ONLY - DO NOT OPEN PRODUCTION GATE") return "operator_confirmation_required_phrase_invalid";
  if (packet.provided_confirmation_phrase !== packet.required_confirmation_phrase) return "operator_confirmation_phrase_mismatch";
  const scope = packet.confirmation_scope;
  if (!scope || scope.target_gate !== preflightPreview.target_gate) return "operator_confirmation_scope_target_gate_mismatch";
  if (scope.candidate_id !== preflightPreview.candidate_id) return "operator_confirmation_scope_candidate_mismatch";
  if (scope.candidate_content_hash !== preflightPreview.candidate_content_hash) return "operator_confirmation_scope_candidate_hash_mismatch";
  if (scope.source_text_hash !== preflightPreview.source_text_hash) return "operator_confirmation_scope_source_hash_mismatch";
  if (scope.source_route !== preflightPreview.source_route) return "operator_confirmation_scope_source_route_mismatch";
  if (scope.source_store_scope !== "sandbox_candidate_store" || scope.target_store_scope !== "production_candidate_store") return "operator_confirmation_scope_store_mismatch";
  if (scope.mutation_allowed !== false) return "operator_confirmation_scope_allows_mutation";
  const token = packet.confirmation_token;
  if (!token || token.shape !== "phase42d_confirm_<24hex>" || !/^phase42d_confirm_[a-f0-9]{24}$/.test(token.value || "")) return "operator_confirmation_token_shape_invalid";
  if (token.scope_hash !== sha256Text(JSON.stringify(scope))) return "operator_confirmation_token_scope_hash_mismatch";
  if (token.preview_only !== true || token.consumed !== false || token.grants !== null) return "operator_confirmation_token_policy_invalid";
  if (packet.accepted !== false || packet.granted !== false) return "operator_confirmation_packet_already_accepted_or_granted";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42d_operator_confirmation_boundary_generated: false,
    phase42d_operator_confirmation_boundary_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildOperatorConfirmationBoundaryPreview({ preflightPreview, confirmationPacket, contract, userRequest, state = BASELINE_STATE }) {
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
    validatePhase42CPreflightPreview(preflightPreview),
    validateBoundaryContract(contract),
    validateOperatorConfirmationPacket(confirmationPacket, preflightPreview || {}),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42d_operator_confirmation_boundary_request", state, { direct_requests_detected: directRequestsDetected });

  const previewSource = JSON.stringify({
    phase: "Phase42D",
    preflightId: preflightPreview.id,
    candidateId: preflightPreview.candidate_id,
    confirmationPhrase: confirmationPacket.provided_confirmation_phrase,
    confirmationScopeHash: confirmationPacket.confirmation_token.scope_hash,
    confirmationTokenShape: confirmationPacket.confirmation_token.shape,
    fullRunAllStatus: preflightPreview.full_run_all_status,
  });
  const boundaryHash = sha256Text(previewSource);

  const boundaryPreview = {
    id: `phase42d_operator_confirmation_boundary_${boundaryHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview",
    phase: "Phase42D",
    source_phase: "Phase42C",
    target_gate: preflightPreview.target_gate,
    mode: "operator_confirmation_boundary_preview_only",
    generated: true,
    persisted: false,
    preflight_contract_id: preflightPreview.id,
    candidate_id: preflightPreview.candidate_id,
    explicit_operator_confirmation_request_verified: true,
    confirmation_text_verified: true,
    confirmation_phrase_verified: true,
    confirmation_scope_verified: true,
    confirmation_token_shape_verified: true,
    operator_confirmation_accepted: true,
    operator_confirmation_granted: false,
    confirmation_still_preview_only: true,
    production_gate_opened: false,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_store_mutated: false,
    guard_token_consumed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: preflightPreview.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview_only",
    phase42d_operator_confirmation_boundary_generated: true,
    phase42d_operator_confirmation_boundary_persisted: false,
    explicit_operator_confirmation_request_verified: true,
    confirmation_text_verified: true,
    confirmation_phrase_verified: true,
    confirmation_scope_verified: true,
    confirmation_token_shape_verified: true,
    operator_confirmation_accepted: true,
    operator_confirmation_granted: false,
    confirmation_still_preview_only: true,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    production_promotion_gate_opened: false,
    production_candidate_store_mutated: false,
    production_write_performed: false,
    production_promotion_performed: false,
    guard_token_consumed: false,
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: preflightPreview.full_run_all_status,
    full_run_all_passed_claimed: false,
    operator_confirmation_boundary_preview: boundaryPreview,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42d_operator_confirmation_boundary_generated, false);
  assert.equal(result.phase42d_operator_confirmation_boundary_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ accepted: false }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_preflight_contract_not_accepted");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ persisted: true }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_preflight_contract_mode_invalid");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ candidate_identity_verified: false }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_preflight_identity_or_scope_not_verified");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ backup_snapshot_ready: false }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_required_readiness_missing");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ guard_token_consumed: true }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_preflight_forbidden_action_detected");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, "phase42c_preflight_forbidden_action_detected");
}

for (const [contractOverride, reason] of [
  [{ mode: "operator_confirmation_grant" }, "operator_confirmation_boundary_contract_mode_invalid"],
  [{ production_write_allowed: true }, "operator_confirmation_boundary_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "operator_confirmation_boundary_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "operator_confirmation_boundary_contract_allows_gate_open"],
  [{ operator_confirmation_grant_allowed: true }, "operator_confirmation_boundary_contract_allows_operator_confirmation_grant"],
  [{ guard_token_consumption_allowed: true }, "operator_confirmation_boundary_contract_allows_guard_token_consume"],
  [{ audit_receipt_creation_allowed: true }, "operator_confirmation_boundary_contract_allows_audit_receipt"],
  [{ backup_snapshot_creation_allowed: true }, "operator_confirmation_boundary_contract_allows_backup_snapshot"],
  [{ rollback_restore_execution_allowed: true }, "operator_confirmation_boundary_contract_allows_rollback_restore"],
  [{ approval_request_creation_allowed: true }, "operator_confirmation_boundary_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "operator_confirmation_boundary_contract_allows_pending_engine_candidate"],
  [{ confirmation_token_shape_required: false }, "operator_confirmation_boundary_contract_required_field_invalid"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "operator_confirmation_boundary_contract_required_field_invalid"],
]) {
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview(),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(contractOverride),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, reason);
}

for (const [packetOverride, reason] of [
  [{ ready: false }, "operator_confirmation_packet_mode_invalid"],
  [{ provided_confirmation_phrase: "OPEN PRODUCTION GATE" }, "operator_confirmation_phrase_mismatch"],
  [{ confirmation_scope: makeConfirmationScope(makePhase42CPreflightPreview(), { candidate_id: "candidate_mismatch" }) }, "operator_confirmation_scope_candidate_mismatch"],
  [{ confirmation_scope: makeConfirmationScope(makePhase42CPreflightPreview(), { mutation_allowed: true }) }, "operator_confirmation_scope_allows_mutation"],
  [{ confirmation_token: { ...makeOperatorConfirmationPacket().confirmation_token, value: "bad_token" } }, "operator_confirmation_token_shape_invalid"],
  [{ confirmation_token: { ...makeOperatorConfirmationPacket().confirmation_token, consumed: true } }, "operator_confirmation_token_policy_invalid"],
  [{ accepted: true }, "operator_confirmation_packet_already_accepted_or_granted"],
  [{ granted: true }, "operator_confirmation_packet_already_accepted_or_granted"],
]) {
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview(),
    confirmationPacket: makeOperatorConfirmationPacket(packetOverride),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary",
  });
  assertRejected(result, reason);
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview(),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Build future confirmation notes without naming Phase42D",
  });
  assertRejected(result, "missing_explicit_phase42d_operator_confirmation_boundary_request");
}

{
  const result = buildOperatorConfirmationBoundaryPreview({
    preflightPreview: makePhase42CPreflightPreview(),
    confirmationPacket: makeOperatorConfirmationPacket(),
    contract: makeOperatorConfirmationBoundaryContract(),
    userRequest: "Phase42D production candidate store promotion gate operator confirmation boundary. Accept confirmation phrase and token shape only as preview. Do not grant operator confirmation, do not open gate, do not write production, do not promote production, do not consume guard token, do not create audit receipt, do not create backup snapshot, do not execute rollback, do not create approval request, do not create pending engine candidate, do not adopt, do not settle, do not update Canon, do not update active_engine, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_operator_confirmation_boundary_preview_only");
  assert.equal(result.phase42d_operator_confirmation_boundary_generated, true);
  assert.equal(result.phase42d_operator_confirmation_boundary_persisted, false);
  assert.equal(result.explicit_operator_confirmation_request_verified, true);
  assert.equal(result.confirmation_text_verified, true);
  assert.equal(result.confirmation_phrase_verified, true);
  assert.equal(result.confirmation_scope_verified, true);
  assert.equal(result.confirmation_token_shape_verified, true);
  assert.equal(result.operator_confirmation_accepted, true);
  assert.equal(result.operator_confirmation_granted, false);
  assert.equal(result.confirmation_still_preview_only, true);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_gate_open_allowed, false);
  assert.equal(result.production_promotion_gate_opened, false);
  assert.equal(result.production_candidate_store_mutated, false);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.guard_token_consumed, false);
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
  assertFalseFields(result.operator_confirmation_boundary_preview, MUTATION_FIELDS.filter((field) => field in result.operator_confirmation_boundary_preview));
  assert.equal(result.operator_confirmation_boundary_preview.explicit_operator_confirmation_request_verified, true);
  assert.equal(result.operator_confirmation_boundary_preview.confirmation_text_verified, true);
  assert.equal(result.operator_confirmation_boundary_preview.confirmation_phrase_verified, true);
  assert.equal(result.operator_confirmation_boundary_preview.confirmation_scope_verified, true);
  assert.equal(result.operator_confirmation_boundary_preview.confirmation_token_shape_verified, true);
  assert.equal(result.operator_confirmation_boundary_preview.operator_confirmation_accepted, true);
  assert.equal(result.operator_confirmation_boundary_preview.operator_confirmation_granted, false);
  assert.equal(result.operator_confirmation_boundary_preview.confirmation_still_preview_only, true);
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

console.log("Phase42D production candidate store promotion gate operator confirmation boundary smoke tests passed.");
