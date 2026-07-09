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
  phase42c_preflight_contract_generated: false,
  phase42c_preflight_contract_persisted: false,
  candidate_identity_verified: false,
  candidate_content_hash_verified: false,
  source_text_hash_verified: false,
  source_route_link_verified: false,
  source_scope_verified: false,
  target_scope_verified: false,
  audit_trail_verified: false,
  backup_snapshot_verified: false,
  rollback_restore_verified: false,
  operator_confirmation_packet_verified: false,
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
  "preflight_contract_persist",
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
  "phase42c_preflight_contract_persisted",
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
  "phase42b_audit_rollback_readiness_required",
  "explicit_phase42c_preflight_contract_request_required",
  "preflight_contract_preview_only",
  "preflight_contract_must_not_persist",
  "candidate_identity_required",
  "candidate_content_hash_required",
  "source_text_hash_required",
  "source_route_link_required",
  "source_scope_required",
  "target_scope_required",
  "audit_trail_ready_required",
  "audit_receipt_must_not_be_created",
  "backup_snapshot_ready_required",
  "backup_snapshot_must_not_be_created",
  "rollback_restore_ready_required",
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

function makePhase42BReadiness(overrides = {}) {
  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_audit_rollback_readiness_preview_only",
    phase: "Phase42B",
    kind: "production_candidate_store_promotion_gate_audit_rollback_readiness",
    source_phase: "Phase42A",
    source_chain: [...PHASE41_CHAIN],
    source_chain_complete: true,
    phase41_closed: true,
    target_gate: "production_candidate_store_promotion_gate",
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
    full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42c-production-candidate-store-promotion-gate-preflight-contract-smoke",
    ...overrides,
  };
}

function makeCandidatePackage(overrides = {}) {
  const text = "Chapter title\n\nA safe story-like native chat output body.";
  const sourceTextHash = sha256Text(text);
  const candidateContentHash = sha256Text(JSON.stringify({
    kind: "chat_output",
    route: "chatgpt_native_full_neural_writing_handoff",
    text,
  }));
  const id = `candidate_${sha256Text([
    "CandidateRuntimeWriteService.writeCandidate",
    "chat_output",
    "chatgpt_native_full_neural_writing_handoff",
    sourceTextHash,
    candidateContentHash,
  ].join("|")).slice(0, 24)}`;

  return {
    kind: "promotion_candidate_package",
    candidate_record: {
      id,
      kind: "candidate",
      source_kind: "chat_output",
      source_route: "chatgpt_native_full_neural_writing_handoff",
      source_text_hash: sourceTextHash,
      candidate_content_hash: candidateContentHash,
      text,
      source_store_scope: "sandbox_candidate_store",
      target_store_scope: "production_candidate_store",
      persisted_to_production: false,
      production_candidate_saved: false,
      approval_request_id: null,
      pending_engine_candidate_id: null,
      adoption_id: null,
      settlement_id: null,
      canon_update_id: null,
      active_engine_update_id: null,
    },
    planned_candidate_identity: {
      id,
      source_text_hash: sourceTextHash,
      candidate_content_hash: candidateContentHash,
      source_route: "chatgpt_native_full_neural_writing_handoff",
      source_store_scope: "sandbox_candidate_store",
      target_store_scope: "production_candidate_store",
    },
    ...overrides,
  };
}

function makePreflightContract(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_gate_preflight_contract",
    mode: "preflight_contract_preview_only",
    source_phase: "Phase42B",
    target_phase: "Phase42C",
    target_gate: "production_candidate_store_promotion_gate",
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    preflight_contract_persist_allowed: false,
    audit_receipt_creation_allowed: false,
    backup_snapshot_creation_allowed: false,
    rollback_restore_execution_allowed: false,
    operator_confirmation_grant_allowed: false,
    guard_token_consumption_allowed: false,
    approval_request_creation_allowed: false,
    pending_engine_candidate_creation_allowed: false,
    phase42b_audit_rollback_readiness_required: true,
    explicit_phase42c_preflight_contract_request_required: true,
    preflight_contract_preview_only: true,
    preflight_contract_must_not_persist: true,
    candidate_identity_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    source_route_link_required: true,
    source_scope_required: true,
    target_scope_required: true,
    audit_trail_ready_required: true,
    audit_receipt_must_not_be_created: true,
    backup_snapshot_ready_required: true,
    backup_snapshot_must_not_be_created: true,
    rollback_restore_ready_required: true,
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

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /phase42c/.test(normalized) && /preflight contract|promotion gate preflight|gate preflight/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    gate_open: /\bopen\b.*\bgate\b|\bgate\b.*\bopen\b/.test(normalized),
    operator_confirmation: /\bgrant\b.*\boperator confirmation\b|\boperator confirmation\b.*\bgrant\b|\bconfirm\b.*\boperator\b/.test(normalized),
    audit_receipt: /\bcreate\b.*\baudit receipt\b|\baudit receipt\b.*\bcreate\b/.test(normalized),
    backup_snapshot: /\bcreate\b.*\bbackup\b|\bbackup\b.*\bcreate\b/.test(normalized),
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

function validatePhase42BReadiness(readiness) {
  if (!readiness?.accepted) return "phase42b_readiness_not_accepted";
  if (readiness.phase !== "Phase42B" || readiness.kind !== "production_candidate_store_promotion_gate_audit_rollback_readiness") return "phase42b_readiness_kind_invalid";
  if (readiness.source_phase !== "Phase42A" || readiness.target_gate !== "production_candidate_store_promotion_gate") return "phase42b_readiness_link_invalid";
  if (readiness.mode !== "audit_rollback_readiness_preview_only") return "phase42b_readiness_mode_invalid";
  if (readiness.generated !== true) return "phase42b_readiness_not_generated";
  if (readiness.persisted !== false) return "phase42b_readiness_already_persisted";
  if (readiness.source_chain_complete !== true || readiness.phase41_closed !== true) return "phase42b_source_chain_not_closed";
  for (const phase of PHASE41_CHAIN) if (!readiness.source_chain?.includes(phase)) return "phase42b_source_chain_incomplete";
  if (readiness.audit_trail_ready !== true || readiness.backup_snapshot_ready !== true || readiness.rollback_restore_ready !== true || readiness.operator_confirmation_packet_ready !== true) return "phase42b_required_readiness_missing";
  if (readiness.audit_receipt_created !== false || readiness.backup_snapshot_created !== false || readiness.rollback_restore_executed !== false || readiness.operator_confirmation_granted !== false) return "phase42b_readiness_already_performed_protected_action";
  if (readiness.production_gate_opened !== false || readiness.production_write_allowed !== false || readiness.production_promotion_allowed !== false) return "phase42b_readiness_write_policy_invalid";
  if (readiness.production_write_performed !== false || readiness.production_promotion_performed !== false || readiness.production_candidate_store_mutated !== false) return "phase42b_readiness_already_mutated_production";
  for (const field of ["guard_token_consumed", "approval_request_created", "pending_engine_candidate_created", "adoption_performed", "settlement_performed", "canon_update_performed", "active_engine_update_performed", "full_run_all_passed_claimed"]) if (readiness[field] !== false) return "phase42b_readiness_forbidden_action_detected";
  if (readiness.full_run_all_status !== "pending_due_to_prior_backup_export_service_timeout") return "phase42b_full_run_all_status_invalid";
  return null;
}

function validateCandidatePackage(candidatePackage) {
  if (candidatePackage?.kind !== "promotion_candidate_package") return "candidate_package_missing";
  const record = candidatePackage.candidate_record;
  const planned = candidatePackage.planned_candidate_identity;
  if (record?.kind !== "candidate") return "candidate_record_missing";
  if (!record.id || !record.source_text_hash || !record.candidate_content_hash || !record.source_route) return "candidate_identity_incomplete";
  if (record.source_store_scope !== "sandbox_candidate_store") return "candidate_source_scope_invalid";
  if (record.target_store_scope !== "production_candidate_store") return "candidate_target_scope_invalid";
  if (record.persisted_to_production !== false || record.production_candidate_saved !== false) return "candidate_already_persisted_to_production";
  if (record.source_route !== "chatgpt_native_full_neural_writing_handoff") return "candidate_source_route_invalid";
  for (const field of ["approval_request_id", "pending_engine_candidate_id", "adoption_id", "settlement_id", "canon_update_id", "active_engine_update_id"]) if (record[field] !== null) return "candidate_direct_action_id_not_null";
  if (planned?.id !== record.id) return "candidate_identity_mismatch";
  if (planned.source_text_hash !== record.source_text_hash) return "candidate_source_text_hash_mismatch";
  if (planned.candidate_content_hash !== record.candidate_content_hash) return "candidate_content_hash_mismatch";
  if (planned.source_route !== record.source_route) return "candidate_source_route_mismatch";
  if (planned.source_store_scope !== record.source_store_scope) return "candidate_planned_source_scope_mismatch";
  if (planned.target_store_scope !== record.target_store_scope) return "candidate_planned_target_scope_mismatch";
  return null;
}

function validatePreflightContract(contract) {
  if (contract?.kind !== "production_candidate_store_promotion_gate_preflight_contract") return "preflight_contract_missing";
  if (contract.mode !== "preflight_contract_preview_only") return "preflight_contract_mode_invalid";
  if (contract.source_phase !== "Phase42B" || contract.target_phase !== "Phase42C") return "preflight_contract_phase_link_invalid";
  if (contract.target_gate !== "production_candidate_store_promotion_gate") return "preflight_contract_target_gate_invalid";
  if (contract.production_write_allowed !== false) return "preflight_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "preflight_contract_allows_production_promotion";
  if (contract.production_gate_open_allowed !== false) return "preflight_contract_allows_gate_open";
  if (contract.preflight_contract_persist_allowed !== false) return "preflight_contract_allows_persist";
  if (contract.audit_receipt_creation_allowed !== false) return "preflight_contract_allows_audit_receipt";
  if (contract.backup_snapshot_creation_allowed !== false) return "preflight_contract_allows_backup_snapshot";
  if (contract.rollback_restore_execution_allowed !== false) return "preflight_contract_allows_rollback_restore";
  if (contract.operator_confirmation_grant_allowed !== false) return "preflight_contract_allows_operator_confirmation";
  if (contract.guard_token_consumption_allowed !== false) return "preflight_contract_allows_guard_token_consume";
  if (contract.approval_request_creation_allowed !== false) return "preflight_contract_allows_approval_request";
  if (contract.pending_engine_candidate_creation_allowed !== false) return "preflight_contract_allows_pending_engine_candidate";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "preflight_contract_required_field_invalid";
  return null;
}

function reject(reason, state, extra = {}) {
  return {
    accepted: false,
    reason,
    phase42c_preflight_contract_generated: false,
    phase42c_preflight_contract_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    production_gate_open_allowed: false,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
    ...extra,
  };
}

function buildPreflightContractPreview({ readiness, candidatePackage, contract, userRequest, state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  const directRequestsDetected = {
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    gate_open: intent.gate_open,
    operator_confirmation: intent.operator_confirmation,
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
    validatePhase42BReadiness(readiness),
    validateCandidatePackage(candidatePackage),
    validatePreflightContract(contract),
  ]) {
    if (error) return reject(error, state, { direct_requests_detected: directRequestsDetected });
  }

  if (!intent.explicit) return reject("missing_explicit_phase42c_preflight_contract_request", state, { direct_requests_detected: directRequestsDetected });

  const record = candidatePackage.candidate_record;
  const preflightSource = JSON.stringify({
    phase: "Phase42C",
    readinessPhase: readiness.phase,
    candidateId: record.id,
    candidateContentHash: record.candidate_content_hash,
    sourceTextHash: record.source_text_hash,
    sourceRoute: record.source_route,
    sourceScope: record.source_store_scope,
    targetScope: record.target_store_scope,
    contract: contract.kind,
    fullRunAllStatus: readiness.full_run_all_status,
  });
  const preflightHash = sha256Text(preflightSource);

  const preview = {
    id: `phase42c_preflight_contract_${preflightHash.slice(0, 24)}`,
    kind: "production_candidate_store_promotion_gate_preflight_contract_preview",
    phase: "Phase42C",
    source_phase: "Phase42B",
    target_gate: contract.target_gate,
    mode: "preflight_contract_preview_only",
    generated: true,
    persisted: false,
    candidate_id: record.id,
    candidate_identity_verified: true,
    candidate_content_hash: record.candidate_content_hash,
    candidate_content_hash_verified: true,
    source_text_hash: record.source_text_hash,
    source_text_hash_verified: true,
    source_route: record.source_route,
    source_route_link_verified: true,
    source_store_scope: record.source_store_scope,
    source_scope_verified: true,
    target_store_scope: record.target_store_scope,
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
    full_run_all_status: readiness.full_run_all_status,
    full_run_all_passed_claimed: false,
    next_allowed_phase: "phase42d-production-candidate-store-promotion-gate-operator-confirmation-preflight-smoke",
  };

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_gate_preflight_contract_preview_only",
    phase42c_preflight_contract_generated: true,
    phase42c_preflight_contract_persisted: false,
    candidate_identity_verified: true,
    candidate_content_hash_verified: true,
    source_text_hash_verified: true,
    source_route_link_verified: true,
    source_scope_verified: true,
    target_scope_verified: true,
    audit_trail_verified: true,
    backup_snapshot_verified: true,
    rollback_restore_verified: true,
    operator_confirmation_packet_verified: true,
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
    audit_receipt_created: false,
    backup_snapshot_created: false,
    rollback_restore_executed: false,
    full_run_all_status: readiness.full_run_all_status,
    full_run_all_passed_claimed: false,
    preflight_contract_preview: preview,
    direct_requests_detected: directRequestsDetected,
    blocked_direct_actions: BLOCKED_ACTIONS,
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.phase42c_preflight_contract_generated, false);
  assert.equal(result.phase42c_preflight_contract_persisted, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness({ accepted: false }),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Phase42C promotion gate preflight contract",
  });
  assertRejected(result, "phase42b_readiness_not_accepted");
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness({ persisted: true }),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Phase42C production candidate store promotion gate preflight contract",
  });
  assertRejected(result, "phase42b_readiness_already_persisted");
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness({ audit_trail_ready: false }),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Phase42C production candidate store promotion gate preflight contract",
  });
  assertRejected(result, "phase42b_required_readiness_missing");
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness({ full_run_all_status: "passed", full_run_all_passed_claimed: true }),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Phase42C production candidate store promotion gate preflight contract",
  });
  assertRejected(result, "phase42b_readiness_forbidden_action_detected");
}

for (const [candidateOverride, reason] of [
  [{ candidate_record: { ...makeCandidatePackage().candidate_record, source_store_scope: "production_candidate_store" } }, "candidate_source_scope_invalid"],
  [{ candidate_record: { ...makeCandidatePackage().candidate_record, persisted_to_production: true } }, "candidate_already_persisted_to_production"],
  [{ candidate_record: { ...makeCandidatePackage().candidate_record, source_route: "manual_import" } }, "candidate_source_route_invalid"],
  [{ planned_candidate_identity: { ...makeCandidatePackage().planned_candidate_identity, id: "candidate_mismatch" } }, "candidate_identity_mismatch"],
  [{ planned_candidate_identity: { ...makeCandidatePackage().planned_candidate_identity, candidate_content_hash: "bad_hash" } }, "candidate_content_hash_mismatch"],
  [{ planned_candidate_identity: { ...makeCandidatePackage().planned_candidate_identity, source_text_hash: "bad_hash" } }, "candidate_source_text_hash_mismatch"],
]) {
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness(),
    candidatePackage: makeCandidatePackage(candidateOverride),
    contract: makePreflightContract(),
    userRequest: "Phase42C production candidate store promotion gate preflight contract",
  });
  assertRejected(result, reason);
}

for (const [contractOverride, reason] of [
  [{ mode: "gate_open" }, "preflight_contract_mode_invalid"],
  [{ production_write_allowed: true }, "preflight_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "preflight_contract_allows_production_promotion"],
  [{ production_gate_open_allowed: true }, "preflight_contract_allows_gate_open"],
  [{ preflight_contract_persist_allowed: true }, "preflight_contract_allows_persist"],
  [{ audit_receipt_creation_allowed: true }, "preflight_contract_allows_audit_receipt"],
  [{ backup_snapshot_creation_allowed: true }, "preflight_contract_allows_backup_snapshot"],
  [{ rollback_restore_execution_allowed: true }, "preflight_contract_allows_rollback_restore"],
  [{ operator_confirmation_grant_allowed: true }, "preflight_contract_allows_operator_confirmation"],
  [{ guard_token_consumption_allowed: true }, "preflight_contract_allows_guard_token_consume"],
  [{ approval_request_creation_allowed: true }, "preflight_contract_allows_approval_request"],
  [{ pending_engine_candidate_creation_allowed: true }, "preflight_contract_allows_pending_engine_candidate"],
  [{ candidate_identity_required: false }, "preflight_contract_required_field_invalid"],
  [{ full_run_all_must_remain_pending_until_explicitly_rerun: false }, "preflight_contract_required_field_invalid"],
]) {
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness(),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(contractOverride),
    userRequest: "Phase42C production candidate store promotion gate preflight contract",
  });
  assertRejected(result, reason);
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness(),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Build future promotion notes without naming Phase42C",
  });
  assertRejected(result, "missing_explicit_phase42c_preflight_contract_request");
}

{
  const result = buildPreflightContractPreview({
    readiness: makePhase42BReadiness(),
    candidatePackage: makeCandidatePackage(),
    contract: makePreflightContract(),
    userRequest: "Phase42C production candidate store promotion gate preflight contract. Do not open gate, do not write production, do not promote production, do not grant operator confirmation, do not create audit receipt, do not create backup, do not execute rollback, do not create approval, do not claim full run-all passed.",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_gate_preflight_contract_preview_only");
  assert.equal(result.phase42c_preflight_contract_generated, true);
  assert.equal(result.phase42c_preflight_contract_persisted, false);
  assert.equal(result.candidate_identity_verified, true);
  assert.equal(result.candidate_content_hash_verified, true);
  assert.equal(result.source_text_hash_verified, true);
  assert.equal(result.source_route_link_verified, true);
  assert.equal(result.source_scope_verified, true);
  assert.equal(result.target_scope_verified, true);
  assert.equal(result.audit_trail_verified, true);
  assert.equal(result.backup_snapshot_verified, true);
  assert.equal(result.rollback_restore_verified, true);
  assert.equal(result.operator_confirmation_packet_verified, true);
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
  assert.equal(result.audit_receipt_created, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_restore_executed, false);
  assert.equal(result.full_run_all_status, "pending_due_to_prior_backup_export_service_timeout");
  assert.equal(result.full_run_all_passed_claimed, false);
  assertFalseFields(result.state_after, Object.keys(BASELINE_STATE));
  assertFalseFields(result.preflight_contract_preview, MUTATION_FIELDS.filter((field) => field in result.preflight_contract_preview));
  assert.equal(result.preflight_contract_preview.candidate_identity_verified, true);
  assert.equal(result.preflight_contract_preview.candidate_content_hash_verified, true);
  assert.equal(result.preflight_contract_preview.source_text_hash_verified, true);
  assert.equal(result.preflight_contract_preview.source_route_link_verified, true);
  assert.equal(result.preflight_contract_preview.source_scope_verified, true);
  assert.equal(result.preflight_contract_preview.target_scope_verified, true);
  assert.equal(result.preflight_contract_preview.audit_trail_ready, true);
  assert.equal(result.preflight_contract_preview.backup_snapshot_ready, true);
  assert.equal(result.preflight_contract_preview.rollback_restore_ready, true);
  assert.equal(result.preflight_contract_preview.operator_confirmation_packet_ready, true);
  assert.equal(result.preflight_contract_preview.next_allowed_phase, "phase42d-production-candidate-store-promotion-gate-operator-confirmation-preflight-smoke");
  assert.deepEqual(result.blocked_direct_actions, BLOCKED_ACTIONS);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.gate_open, true);
  assert.equal(result.direct_requests_detected.operator_confirmation, true);
  assert.equal(result.direct_requests_detected.audit_receipt, true);
  assert.equal(result.direct_requests_detected.backup_snapshot, true);
  assert.equal(result.direct_requests_detected.rollback_restore, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.full_run_all_passed, true);
}

console.log("Phase42C production candidate store promotion gate preflight contract smoke tests passed.");
