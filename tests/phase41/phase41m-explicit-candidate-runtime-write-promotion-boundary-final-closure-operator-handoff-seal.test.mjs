import assert from "node:assert/strict";
import crypto from "node:crypto";

const PHASE_CHAIN = Object.freeze([
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
]);

const BLOCKED_ACTIONS = Object.freeze([
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "promotion_dry_run_plan_persist",
  "promotion_dry_run_proof_persist",
  "operator_handoff_direct_write",
  "operator_handoff_direct_promotion",
  "guard_token_consume",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "approval_request_create",
  "pending_engine_candidate_create",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
]);

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  production_write_performed: false,
  production_promotion_performed: false,
  production_guard_opened: false,
  promotion_dry_run_plan_generated: false,
  promotion_dry_run_plan_persisted: false,
  promotion_dry_run_proof_generated: false,
  promotion_dry_run_proof_persisted: false,
  proof_seal_generated: false,
  proof_seal_persisted: false,
  final_closure_index_generated: false,
  final_closure_index_persisted: false,
  operator_handoff_packet_generated: false,
  operator_handoff_packet_persisted: false,
  guard_token_consumed: false,
  backup_snapshot_created: false,
  rollback_executed: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  adoption_performed: false,
  settlement_performed: false,
  canon_update_performed: false,
  active_engine_update_performed: false,
});

const MUTATION_FIELDS = Object.freeze([
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "promotion_dry_run_plan_persisted",
  "promotion_dry_run_proof_persisted",
  "proof_seal_persisted",
  "final_closure_index_persisted",
  "operator_handoff_packet_persisted",
  "guard_token_consumed",
  "backup_snapshot_created",
  "rollback_executed",
  "approval_request_created",
  "pending_engine_candidate_created",
  "adoption_performed",
  "settlement_performed",
  "canon_update_performed",
  "active_engine_update_performed",
]);

const CONTRACT_TRUE_FIELDS = Object.freeze([
  "phase41_chain_closure_required",
  "phase41l_proof_seal_required",
  "operator_handoff_required",
  "operator_handoff_preview_only",
  "final_closure_index_required",
  "final_closure_index_preview_only",
  "explicit_phase42_or_later_required_for_any_write",
  "production_write_must_remain_blocked",
  "production_promotion_must_remain_blocked",
  "guard_token_must_remain_unconsumed",
  "dry_run_proof_must_not_persist",
  "operator_handoff_must_not_authorize_direct_write",
  "operator_handoff_must_not_authorize_direct_promotion",
  "no_approval_request",
  "no_pending_engine_candidate",
  "no_adoption",
  "no_settlement",
  "no_canon_update",
  "no_active_engine_update",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertAllFalse(snapshot, fields) {
  for (const field of fields) assert.equal(snapshot[field], false, `${field} must remain false`);
}

function makePhaseEvidence(overrides = {}) {
  return {
    phase_chain: PHASE_CHAIN.map((phase, index) => ({
      phase,
      order: index + 1,
      focused_regression_passed: true,
      run_all_registered: true,
      production_write_performed: false,
      production_promotion_performed: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adoption_performed: false,
      settlement_performed: false,
      canon_update_performed: false,
      active_engine_update_performed: false,
    })),
    latest_completed_phase: "phase41l-explicit-candidate-runtime-write-promotion-dry-run-proof-seal-smoke",
    full_run_all_status: "separately_pending_due_to_prior_backup_export_service_timeout",
    ...overrides,
  };
}

function makePhase41LProofSeal(overrides = {}) {
  return {
    accepted: true,
    phase: "phase41l-explicit-candidate-runtime-write-promotion-dry-run-proof-seal-smoke",
    reason: "promotion_dry_run_proof_seal_preview_only",
    seal_mode: "proof_seal_preview_only",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    proof_seal_generated: true,
    proof_seal_persisted: false,
    promotion_dry_run_proof_generated: true,
    promotion_dry_run_proof_persisted: false,
    final_write_authorized: false,
    production_candidate_saved: false,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    guard_token_consumed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    proof_digest: `sha256:${sha256(PHASE_CHAIN.join("|"))}`,
    ...overrides,
  };
}

function makeClosureContract(overrides = {}) {
  return {
    kind: "phase41_promotion_boundary_final_closure_operator_handoff_contract",
    phase: "phase41m-explicit-candidate-runtime-write-promotion-boundary-final-closure-operator-handoff-seal",
    mode: "final_closure_operator_handoff_seal_only",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    production_write_allowed: false,
    production_promotion_allowed: false,
    final_closure_persistence_allowed: false,
    operator_handoff_persistence_allowed: false,
    phase41_chain_closure_required: true,
    phase41l_proof_seal_required: true,
    operator_handoff_required: true,
    operator_handoff_preview_only: true,
    final_closure_index_required: true,
    final_closure_index_preview_only: true,
    explicit_phase42_or_later_required_for_any_write: true,
    production_write_must_remain_blocked: true,
    production_promotion_must_remain_blocked: true,
    guard_token_must_remain_unconsumed: true,
    dry_run_proof_must_not_persist: true,
    operator_handoff_must_not_authorize_direct_write: true,
    operator_handoff_must_not_authorize_direct_promotion: true,
    no_approval_request: true,
    no_pending_engine_candidate: true,
    no_adoption: true,
    no_settlement: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit:
      /phase41m/.test(normalized) ||
      /final closure/.test(normalized) ||
      /operator handoff/.test(normalized) ||
      /handoff seal/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b|\bsettlement\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
  };
}

function reject(reason, state = BASELINE_STATE) {
  return {
    accepted: false,
    reason,
    final_closure_index_generated: false,
    operator_handoff_packet_generated: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    state_after: clone(state),
  };
}

function validatePhaseEvidence(evidence) {
  if (!evidence || !Array.isArray(evidence.phase_chain)) return "phase41_chain_evidence_missing";
  if (evidence.phase_chain.length !== PHASE_CHAIN.length) return "phase41_chain_length_invalid";
  for (let index = 0; index < PHASE_CHAIN.length; index += 1) {
    const expected = PHASE_CHAIN[index];
    const actual = evidence.phase_chain[index];
    if (actual?.phase !== expected || actual.order !== index + 1) return "phase41_chain_order_invalid";
    if (actual.focused_regression_passed !== true) return "phase41_chain_focused_regression_missing";
    if (actual.run_all_registered !== true) return "phase41_chain_run_all_registration_missing";
    for (const field of [
      "production_write_performed",
      "production_promotion_performed",
      "approval_request_created",
      "pending_engine_candidate_created",
      "adoption_performed",
      "settlement_performed",
      "canon_update_performed",
      "active_engine_update_performed",
    ]) {
      if (actual[field] !== false) return "phase41_chain_mutation_detected";
    }
  }
  if (evidence.latest_completed_phase !== PHASE_CHAIN.at(-1)) return "phase41_latest_phase_invalid";
  if (evidence.full_run_all_status !== "separately_pending_due_to_prior_backup_export_service_timeout") return "full_run_all_status_must_remain_pending";
  return null;
}

function validatePhase41LProofSeal(proofSeal) {
  if (!proofSeal?.accepted) return "phase41l_proof_seal_not_accepted";
  if (proofSeal.phase !== "phase41l-explicit-candidate-runtime-write-promotion-dry-run-proof-seal-smoke") return "phase41l_proof_seal_phase_invalid";
  if (proofSeal.reason !== "promotion_dry_run_proof_seal_preview_only") return "phase41l_proof_seal_reason_invalid";
  if (proofSeal.seal_mode !== "proof_seal_preview_only") return "phase41l_proof_seal_mode_invalid";
  if (proofSeal.promotion_route !== "sandbox_candidate_store_to_production_candidate_store") return "phase41l_proof_seal_route_invalid";
  if (proofSeal.source_store_scope !== "sandbox_candidate_store" || proofSeal.target_store_scope !== "production_candidate_store") return "phase41l_proof_seal_scope_invalid";
  if (proofSeal.proof_seal_generated !== true) return "phase41l_proof_seal_generation_missing";
  if (proofSeal.proof_seal_persisted !== false) return "phase41l_proof_seal_persisted";
  if (proofSeal.promotion_dry_run_proof_generated !== true) return "phase41l_dry_run_proof_generation_missing";
  if (proofSeal.promotion_dry_run_proof_persisted !== false) return "phase41l_dry_run_proof_persisted";
  if (proofSeal.final_write_authorized !== false) return "phase41l_final_write_authorized";
  if (proofSeal.production_write_allowed !== false || proofSeal.production_write_blocked_by_default !== true) return "phase41l_production_write_policy_invalid";
  if (proofSeal.production_write_performed !== false) return "phase41l_production_write_performed";
  if (proofSeal.production_promotion_allowed !== false) return "phase41l_production_promotion_allowed";
  if (proofSeal.production_promotion_performed !== false) return "phase41l_production_promotion_performed";
  for (const field of [
    "guard_token_consumed",
    "approval_request_created",
    "pending_engine_candidate_created",
    "adoption_performed",
    "settlement_performed",
    "canon_update_performed",
    "active_engine_update_performed",
  ]) {
    if (proofSeal[field] !== false) return "phase41l_blocked_mutation_detected";
  }
  return null;
}

function validateClosureContract(contract) {
  if (contract?.kind !== "phase41_promotion_boundary_final_closure_operator_handoff_contract") return "closure_contract_missing";
  if (contract.phase !== "phase41m-explicit-candidate-runtime-write-promotion-boundary-final-closure-operator-handoff-seal") return "closure_contract_phase_invalid";
  if (contract.mode !== "final_closure_operator_handoff_seal_only") return "closure_contract_mode_invalid";
  if (contract.promotion_route !== "sandbox_candidate_store_to_production_candidate_store") return "closure_contract_route_invalid";
  if (contract.source_store_scope !== "sandbox_candidate_store" || contract.target_store_scope !== "production_candidate_store") return "closure_contract_scope_invalid";
  if (contract.production_write_allowed !== false) return "closure_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "closure_contract_allows_production_promotion";
  if (contract.final_closure_persistence_allowed !== false) return "closure_contract_allows_final_closure_persist";
  if (contract.operator_handoff_persistence_allowed !== false) return "closure_contract_allows_operator_handoff_persist";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "closure_contract_required_field_invalid";
  return null;
}

function buildClosureDigest(evidence, proofSeal, contract) {
  return sha256(JSON.stringify({
    chain: evidence.phase_chain.map((entry) => entry.phase),
    latest: evidence.latest_completed_phase,
    proof: proofSeal.proof_digest,
    route: contract.promotion_route,
    mode: contract.mode,
  }));
}

function previewPhase41MFinalClosure({
  userRequest,
  phaseEvidence = makePhaseEvidence(),
  proofSeal = makePhase41LProofSeal(),
  contract = makeClosureContract(),
  state = BASELINE_STATE,
} = {}) {
  const intent = classifyIntent(userRequest);
  if (!intent.explicit) return reject("missing_explicit_final_closure_operator_handoff_request", state);

  for (const error of [
    validatePhaseEvidence(phaseEvidence),
    validatePhase41LProofSeal(proofSeal),
    validateClosureContract(contract),
  ]) {
    if (error) return reject(error, state);
  }

  const closureDigest = buildClosureDigest(phaseEvidence, proofSeal, contract);
  const closureId = `phase41m_closure_${closureDigest.slice(0, 24)}`;

  return {
    ...BASELINE_STATE,
    accepted: true,
    reason: "phase41_promotion_boundary_final_closure_operator_handoff_seal_preview_only",
    phase: contract.phase,
    closure_id: closureId,
    closure_digest: `sha256:${closureDigest}`,
    closure_mode: "final_closure_operator_handoff_seal_only",
    promotion_route: contract.promotion_route,
    source_store_scope: contract.source_store_scope,
    target_store_scope: contract.target_store_scope,
    phase41_completed_range: "Phase41A-Phase41L",
    phase41_closed_by: "Phase41M",
    phase41_chain_verified: true,
    phase41_chain_length: PHASE_CHAIN.length,
    phase41_latest_phase_verified: true,
    phase41l_proof_seal_verified: true,
    production_candidate_saved: false,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    final_closure_index_generated: true,
    final_closure_index_persisted: false,
    operator_handoff_packet_generated: true,
    operator_handoff_packet_persisted: false,
    proof_seal_generated: true,
    proof_seal_persisted: false,
    promotion_dry_run_proof_generated: true,
    promotion_dry_run_proof_persisted: false,
    guard_token_consumed: false,
    backup_snapshot_created: false,
    rollback_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    full_run_all_status: phaseEvidence.full_run_all_status,
    final_closure_index_preview: {
      closure_id: closureId,
      generated: true,
      persisted: false,
      preview_only: true,
      phase_chain: phaseEvidence.phase_chain.map(({ phase, order }) => ({ phase, order })),
      blocked_actions: [...BLOCKED_ACTIONS],
      production_write_performed: false,
      production_promotion_performed: false,
      full_run_all_status: phaseEvidence.full_run_all_status,
    },
    operator_handoff_packet_preview: {
      generated: true,
      persisted: false,
      preview_only: true,
      recommended_next_container: "phase42_or_later_explicit_production_promotion_gate",
      next_phase_must_be_explicit: true,
      direct_production_write_authorized: false,
      direct_production_promotion_authorized: false,
      allowed_next_work: [
        "create_explicit_phase42_gate_contract",
        "require_operator_confirmed_production_write_intent",
        "require_backup_and_rollback_artifact_verification",
        "require_audit_receipt_plan_before_any_production_write",
      ],
      blocked_direct_actions: [...BLOCKED_ACTIONS],
    },
    direct_requests_detected: {
      production_write: intent.production_write,
      production_promotion: intent.production_promotion,
      approval: intent.approval,
      pending_engine: intent.pending_engine,
      adoption: intent.adoption,
      settlement: intent.settlement,
      canon: intent.canon,
      active_engine: intent.active_engine,
    },
    blocked_direct_actions: [...BLOCKED_ACTIONS],
    next_allowed_phase: "phase42_or_later_explicit_production_promotion_gate",
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.final_closure_index_generated, false);
  assert.equal(result.operator_handoff_packet_generated, false);
  assert.deepEqual(result.state_after, BASELINE_STATE);
}

assertRejected(
  previewPhase41MFinalClosure({ userRequest: "continue normal candidate work" }),
  "missing_explicit_final_closure_operator_handoff_request"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    phaseEvidence: null,
  }),
  "phase41_chain_evidence_missing"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ phase_chain: PHASE_CHAIN.slice(0, -1).map((phase, index) => ({ phase, order: index + 1, focused_regression_passed: true, run_all_registered: true })) }),
  }),
  "phase41_chain_length_invalid"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.map((entry, index) => index === 10 ? { ...entry, phase: PHASE_CHAIN[11] } : entry),
    }),
  }),
  "phase41_chain_order_invalid"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.map((entry, index) => index === 7 ? { ...entry, focused_regression_passed: false } : entry),
    }),
  }),
  "phase41_chain_focused_regression_missing"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ full_run_all_status: "passed" }),
  }),
  "full_run_all_status_must_remain_pending"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    proofSeal: makePhase41LProofSeal({ accepted: false }),
  }),
  "phase41l_proof_seal_not_accepted"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    proofSeal: makePhase41LProofSeal({ proof_seal_persisted: true }),
  }),
  "phase41l_proof_seal_persisted"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    proofSeal: makePhase41LProofSeal({ production_write_performed: true }),
  }),
  "phase41l_production_write_performed"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    proofSeal: makePhase41LProofSeal({ production_promotion_performed: true }),
  }),
  "phase41l_production_promotion_performed"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    proofSeal: makePhase41LProofSeal({ guard_token_consumed: true }),
  }),
  "phase41l_blocked_mutation_detected"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    contract: makeClosureContract({ mode: "production_write" }),
  }),
  "closure_contract_mode_invalid"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    contract: makeClosureContract({ production_write_allowed: true }),
  }),
  "closure_contract_allows_production_write"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    contract: makeClosureContract({ production_promotion_allowed: true }),
  }),
  "closure_contract_allows_production_promotion"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    contract: makeClosureContract({ final_closure_persistence_allowed: true }),
  }),
  "closure_contract_allows_final_closure_persist"
);

assertRejected(
  previewPhase41MFinalClosure({
    userRequest: "Phase41M final closure operator handoff seal",
    contract: makeClosureContract({ operator_handoff_must_not_authorize_direct_write: false }),
  }),
  "closure_contract_required_field_invalid"
);

const success = previewPhase41MFinalClosure({
  userRequest: "Phase41M final closure operator handoff seal for the promotion boundary; do not write production.",
});

assert.equal(success.accepted, true);
assert.equal(success.reason, "phase41_promotion_boundary_final_closure_operator_handoff_seal_preview_only");
assert.equal(success.phase41_completed_range, "Phase41A-Phase41L");
assert.equal(success.phase41_closed_by, "Phase41M");
assert.equal(success.phase41_chain_verified, true);
assert.equal(success.phase41_chain_length, PHASE_CHAIN.length);
assert.equal(success.phase41l_proof_seal_verified, true);
assert.equal(success.production_write_allowed, false);
assert.equal(success.production_write_blocked_by_default, true);
assert.equal(success.production_write_performed, false);
assert.equal(success.production_promotion_allowed, false);
assert.equal(success.production_promotion_performed, false);
assert.equal(success.final_closure_index_generated, true);
assert.equal(success.final_closure_index_persisted, false);
assert.equal(success.operator_handoff_packet_generated, true);
assert.equal(success.operator_handoff_packet_persisted, false);
assert.equal(success.full_run_all_status, "separately_pending_due_to_prior_backup_export_service_timeout");
assert.equal(success.final_closure_index_preview.persisted, false);
assert.equal(success.final_closure_index_preview.preview_only, true);
assert.equal(success.final_closure_index_preview.phase_chain.length, PHASE_CHAIN.length);
assert.equal(success.operator_handoff_packet_preview.recommended_next_container, "phase42_or_later_explicit_production_promotion_gate");
assert.equal(success.operator_handoff_packet_preview.direct_production_write_authorized, false);
assert.equal(success.operator_handoff_packet_preview.direct_production_promotion_authorized, false);
assert.equal(success.next_allowed_phase, "phase42_or_later_explicit_production_promotion_gate");
assertAllFalse(success, MUTATION_FIELDS);
assert.deepEqual(success.state_after, BASELINE_STATE);

const directRequest = previewPhase41MFinalClosure({
  userRequest:
    "Phase41M final closure operator handoff seal and also write production, promote production, approve pending engine, adopt, settle, update Canon and active_engine.",
});

assert.equal(directRequest.accepted, true);
assert.equal(directRequest.production_write_performed, false);
assert.equal(directRequest.production_promotion_performed, false);
assert.equal(directRequest.approval_request_created, false);
assert.equal(directRequest.pending_engine_candidate_created, false);
assert.equal(directRequest.adoption_performed, false);
assert.equal(directRequest.settlement_performed, false);
assert.equal(directRequest.canon_update_performed, false);
assert.equal(directRequest.active_engine_update_performed, false);
assert.deepEqual(directRequest.direct_requests_detected, {
  production_write: true,
  production_promotion: true,
  approval: true,
  pending_engine: true,
  adoption: true,
  settlement: true,
  canon: true,
  active_engine: true,
});
assert.deepEqual(directRequest.blocked_direct_actions, BLOCKED_ACTIONS);
assert.deepEqual(directRequest.state_after, BASELINE_STATE);

console.log(
  "Phase41M explicit candidate runtime write promotion boundary final closure operator handoff seal smoke tests passed."
);
