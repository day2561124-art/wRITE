import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  production_write_performed: false,
  production_guard_opened: false,
  production_promotion_performed: false,
  promotion_dry_run_plan_generated: false,
  promotion_dry_run_plan_persisted: false,
  promotion_dry_run_proof_generated: false,
  promotion_dry_run_proof_persisted: false,
  promotion_persistence_readiness_generated: false,
  promotion_persistence_readiness_persisted: false,
  sandbox_candidate_saved: false,
  candidate_runtime_write_performed: false,
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

const MUTATION_FIELDS = [
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "promotion_dry_run_plan_persisted",
  "promotion_dry_run_proof_persisted",
  "promotion_persistence_readiness_persisted",
  "guard_token_consumed",
  "backup_snapshot_created",
  "rollback_executed",
  "approval_request_created",
  "pending_engine_candidate_created",
  "adoption_performed",
  "settlement_performed",
  "canon_update_performed",
  "active_engine_update_performed",
];

const RUNTIME_MUTATION_FIELDS = [
  ...MUTATION_FIELDS,
  "production_guard_opened",
  "sandbox_candidate_saved",
  "candidate_runtime_write_performed",
  "promotion_dry_run_plan_generated",
  "promotion_dry_run_proof_generated",
  "promotion_persistence_readiness_generated",
];

const BLOCKED_ACTIONS = [
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "promotion_dry_run_plan_persist",
  "promotion_dry_run_proof_persist",
  "promotion_persistence_readiness_persist",
  "guard_token_consume",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "approval_request_create",
  "pending_engine_candidate_create",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
];

const CONTRACT_TRUE_FIELDS = [
  "source_sandbox_service_write_required",
  "source_guard_preview_required",
  "source_promotion_dry_run_plan_required",
  "explicit_persistence_readiness_request_required",
  "append_only_plan_required",
  "backup_snapshot_plan_required",
  "rollback_restore_plan_required",
  "dry_run_proof_preview_required",
  "guard_token_must_remain_unconsumed",
  "persistence_readiness_preview_only",
  "persistence_readiness_must_not_persist",
  "deterministic_candidate_id_required",
  "candidate_content_hash_required",
  "source_text_hash_required",
  "source_route_link_required",
  "candidate_identity_match_required",
  "no_approval_request",
  "no_pending_engine_candidate",
  "no_adoption",
  "no_settlement",
  "no_canon_update",
  "no_active_engine_update",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function assertFalseFields(snapshot, fields) {
  for (const field of fields) {
    assert.equal(snapshot[field], false, `${field} must remain false`);
  }
}

function makeServiceWrite(overrides = {}) {
  const text = "Chapter title\n\nA safe story-like native chat output body.";
  const sourceTextHash = sha256Text(text);
  const candidateContentHash = sha256Text(
    JSON.stringify({
      kind: "chat_output",
      route: "chatgpt_native_full_neural_writing_handoff",
      text,
    })
  );
  const record = {
    id: `candidate_${sha256Text(
      [
        "CandidateRuntimeWriteService.writeCandidate",
        "chat_output",
        "chatgpt_native_full_neural_writing_handoff",
        sourceTextHash,
        candidateContentHash,
      ].join("|")
    ).slice(0, 24)}`,
    kind: "candidate",
    source_kind: "chat_output",
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_text_hash: sourceTextHash,
    candidate_content_hash: candidateContentHash,
    text,
    persisted_to_production: false,
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
  };

  return {
    accepted: true,
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    service_write_performed: true,
    candidate_runtime_write_performed: true,
    sandbox_candidate_saved: true,
    production_candidate_saved: false,
    candidate_record: record,
    direct_requests_detected: {
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
    },
    ...overrides,
  };
}

function makeGuardPreview(serviceWrite, overrides = {}) {
  const record = serviceWrite.candidate_record;
  return {
    accepted: true,
    reason: "production_candidate_store_guard_preview_only",
    production_guard_opened: true,
    guard_mode: "test_only_preview",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    source_candidate_id: record.id,
    source_text_hash: record.source_text_hash,
    candidate_content_hash: record.candidate_content_hash,
    source_route: record.source_route,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    future_promotion_required: true,
    explicit_future_promotion_request_required: true,
    production_write_performed: false,
    production_promotion_performed: false,
    guard_token_consumed: false,
    guard_preview: {
      persisted: false,
      token_consumed: false,
      production_write_performed: false,
    },
    direct_requests_detected: {
      production_write: false,
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
    },
    ...overrides,
  };
}

function makePromotionDryRun(serviceWrite, overrides = {}) {
  const record = serviceWrite.candidate_record;
  const planId = `promotion_dry_run_plan_${sha256Text(
    [record.id, record.candidate_content_hash, record.source_text_hash, record.source_route].join("|")
  ).slice(0, 24)}`;

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_dry_run_plan_preview_only",
    dry_run_mode: "test_only_promotion_plan_preview",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    source_candidate_id: record.id,
    planned_production_candidate_id: record.id,
    candidate_id_verified: true,
    candidate_content_hash: record.candidate_content_hash,
    planned_candidate_content_hash: record.candidate_content_hash,
    candidate_content_hash_verified: true,
    source_text_hash: record.source_text_hash,
    planned_source_text_hash: record.source_text_hash,
    source_text_hash_verified: true,
    source_route: record.source_route,
    planned_source_route: record.source_route,
    source_route_link_verified: true,
    production_write_allowed: false,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_saved: false,
    promotion_dry_run_plan_generated: true,
    promotion_dry_run_plan_persisted: false,
    promotion_dry_run_proof_generated: true,
    promotion_dry_run_proof_persisted: false,
    guard_token_consumed: false,
    backup_snapshot_created: false,
    rollback_executed: false,
    promotion_dry_run_plan_preview: {
      id: planId,
      persisted: false,
      plan_only: true,
      candidate_id_match: true,
      candidate_content_hash_match: true,
      source_text_hash_match: true,
      source_route_link_match: true,
      production_write_performed: false,
      production_promotion_performed: false,
    },
    append_only_production_write_plan: {
      planned: true,
      write_performed: false,
      persisted: false,
      overwrite_existing_record: false,
      candidate_record_preview: {
        id: record.id,
        source_route: record.source_route,
        source_text_hash: record.source_text_hash,
        candidate_content_hash: record.candidate_content_hash,
        persisted_to_production: false,
        planned_only: true,
      },
    },
    backup_snapshot_plan: {
      planned: true,
      executed: false,
      persisted: false,
    },
    rollback_restore_plan: {
      planned: true,
      executed: false,
      persisted: false,
    },
    dry_run_proof_preview: {
      generated: true,
      persisted: false,
      production_write_performed: false,
      production_promotion_performed: false,
      guard_token_consumed: false,
      candidate_id_verified: true,
      candidate_content_hash_verified: true,
      source_text_hash_verified: true,
      source_route_link_verified: true,
      append_only_plan_verified: true,
      backup_snapshot_plan_verified: true,
      rollback_restore_plan_verified: true,
    },
    direct_requests_detected: {
      production_write: false,
      production_promotion: false,
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
    },
    ...overrides,
  };
}

function makeContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_promotion_persistence_readiness_contract",
    mode: "persistence_readiness_only",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope_required: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_promotion_allowed: false,
    source_sandbox_service_write_required: true,
    source_guard_preview_required: true,
    source_promotion_dry_run_plan_required: true,
    explicit_persistence_readiness_request_required: true,
    append_only_plan_required: true,
    backup_snapshot_plan_required: true,
    rollback_restore_plan_required: true,
    dry_run_proof_preview_required: true,
    guard_token_must_remain_unconsumed: true,
    persistence_readiness_preview_only: true,
    persistence_readiness_must_not_persist: true,
    deterministic_candidate_id_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    source_route_link_required: true,
    candidate_identity_match_required: true,
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
      /\bpersistence readiness\b/.test(normalized) ||
      /\bpromotion persistence readiness\b/.test(normalized) ||
      /\breadiness\b.*\bpersist/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    persist: /\bpersist\b|\bpersistence\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
  };
}

function validateServiceWrite(serviceWrite) {
  if (!serviceWrite?.accepted) return "sandbox_service_write_not_accepted";
  if (serviceWrite.service_api !== "CandidateRuntimeWriteService.writeCandidate") {
    return "sandbox_service_write_contract_invalid";
  }
  if (serviceWrite.store_scope !== "sandbox_candidate_store") {
    return "sandbox_service_write_contract_invalid";
  }
  if (serviceWrite.sandbox_candidate_saved !== true) return "sandbox_service_write_contract_invalid";
  if (serviceWrite.production_candidate_saved !== false) return "sandbox_service_write_contract_invalid";

  const record = serviceWrite.candidate_record;
  if (record?.kind !== "candidate") return "sandbox_candidate_record_missing";
  if (record.store_scope !== "sandbox_candidate_store") return "sandbox_candidate_record_scope_invalid";
  if (record.persisted_to_production !== false) return "sandbox_candidate_already_persisted_to_production";
  if (record.source_route !== "chatgpt_native_full_neural_writing_handoff") {
    return "sandbox_candidate_source_route_invalid";
  }
  for (const field of [
    "approval_request_id",
    "pending_engine_candidate_id",
    "adoption_id",
    "settlement_id",
    "canon_update_id",
    "active_engine_update_id",
  ]) {
    if (record[field] !== null) return "sandbox_candidate_direct_action_id_not_null";
  }
  return null;
}

function validateGuardPreview(guardPreview, serviceWrite) {
  if (!guardPreview?.accepted) return "source_production_guard_preview_not_accepted";
  if (guardPreview.reason !== "production_candidate_store_guard_preview_only") {
    return "source_production_guard_preview_reason_invalid";
  }
  if (guardPreview.production_guard_opened !== true) return "source_production_guard_preview_contract_invalid";
  if (guardPreview.guard_mode !== "test_only_preview") return "source_production_guard_preview_contract_invalid";
  if (guardPreview.source_store_scope !== "sandbox_candidate_store") {
    return "source_production_guard_preview_contract_invalid";
  }
  if (guardPreview.target_store_scope !== "production_candidate_store") {
    return "source_production_guard_preview_contract_invalid";
  }
  if (guardPreview.production_write_allowed !== false) {
    return "source_production_guard_preview_write_policy_invalid";
  }
  if (guardPreview.production_write_performed !== false) {
    return "source_production_guard_preview_performed_write";
  }
  if (guardPreview.production_promotion_performed !== false) {
    return "source_production_guard_preview_performed_promotion";
  }
  if (guardPreview.guard_token_consumed !== false) return "source_production_guard_token_consumed";
  if (guardPreview.guard_preview?.persisted !== false) return "source_production_guard_preview_persisted";

  const record = serviceWrite.candidate_record;
  if (guardPreview.source_candidate_id !== record.id) return "source_guard_candidate_id_mismatch";
  if (guardPreview.candidate_content_hash !== record.candidate_content_hash) {
    return "source_guard_candidate_content_hash_mismatch";
  }
  if (guardPreview.source_text_hash !== record.source_text_hash) {
    return "source_guard_source_text_hash_mismatch";
  }
  if (guardPreview.source_route !== record.source_route) return "source_guard_source_route_mismatch";
  return null;
}

function validateDryRunPlan(dryRun, serviceWrite, guardPreview) {
  if (!dryRun?.accepted) return "source_promotion_dry_run_not_accepted";
  if (dryRun.reason !== "production_candidate_store_promotion_dry_run_plan_preview_only") {
    return "source_promotion_dry_run_reason_invalid";
  }
  if (dryRun.dry_run_mode !== "test_only_promotion_plan_preview") {
    return "source_promotion_dry_run_mode_invalid";
  }
  if (dryRun.source_store_scope !== "sandbox_candidate_store") return "source_promotion_dry_run_scope_invalid";
  if (dryRun.target_store_scope !== "production_candidate_store") return "source_promotion_dry_run_scope_invalid";
  if (dryRun.production_write_allowed !== false) return "source_promotion_dry_run_allows_write";
  if (dryRun.production_write_performed !== false) return "source_promotion_dry_run_performed_write";
  if (dryRun.production_promotion_allowed !== false) return "source_promotion_dry_run_allows_promotion";
  if (dryRun.production_promotion_performed !== false) return "source_promotion_dry_run_performed_promotion";
  if (dryRun.production_candidate_saved !== false) return "source_promotion_dry_run_saved_candidate";
  if (dryRun.promotion_dry_run_plan_generated !== true) return "source_promotion_dry_run_plan_not_generated";
  if (dryRun.promotion_dry_run_plan_persisted !== false) return "source_promotion_dry_run_plan_persisted";
  if (dryRun.promotion_dry_run_proof_generated !== true) return "source_promotion_dry_run_proof_not_generated";
  if (dryRun.promotion_dry_run_proof_persisted !== false) return "source_promotion_dry_run_proof_persisted";
  if (dryRun.guard_token_consumed !== false) return "source_promotion_dry_run_guard_token_consumed";
  if (dryRun.backup_snapshot_created !== false) return "source_promotion_dry_run_backup_created";
  if (dryRun.rollback_executed !== false) return "source_promotion_dry_run_rollback_executed";

  const record = serviceWrite.candidate_record;
  const identityChecks = [
    [dryRun.source_candidate_id, record.id, "source_promotion_dry_run_candidate_id_mismatch"],
    [dryRun.planned_production_candidate_id, record.id, "source_promotion_dry_run_planned_candidate_id_mismatch"],
    [dryRun.candidate_content_hash, record.candidate_content_hash, "source_promotion_dry_run_candidate_hash_mismatch"],
    [dryRun.planned_candidate_content_hash, record.candidate_content_hash, "source_promotion_dry_run_planned_candidate_hash_mismatch"],
    [dryRun.source_text_hash, record.source_text_hash, "source_promotion_dry_run_source_hash_mismatch"],
    [dryRun.planned_source_text_hash, record.source_text_hash, "source_promotion_dry_run_planned_source_hash_mismatch"],
    [dryRun.source_route, record.source_route, "source_promotion_dry_run_route_mismatch"],
    [dryRun.planned_source_route, record.source_route, "source_promotion_dry_run_planned_route_mismatch"],
    [dryRun.source_candidate_id, guardPreview.source_candidate_id, "source_promotion_dry_run_guard_candidate_id_mismatch"],
  ];
  for (const [actual, expected, reason] of identityChecks) {
    if (actual !== expected) return reason;
  }

  for (const field of [
    "candidate_id_verified",
    "candidate_content_hash_verified",
    "source_text_hash_verified",
    "source_route_link_verified",
  ]) {
    if (dryRun[field] !== true) return "source_promotion_dry_run_verification_missing";
  }

  if (dryRun.promotion_dry_run_plan_preview?.persisted !== false) {
    return "source_promotion_dry_run_plan_preview_persisted";
  }
  if (dryRun.promotion_dry_run_plan_preview?.plan_only !== true) {
    return "source_promotion_dry_run_plan_preview_not_plan_only";
  }
  if (dryRun.append_only_production_write_plan?.planned !== true) {
    return "source_promotion_append_only_plan_missing";
  }
  if (dryRun.append_only_production_write_plan?.write_performed !== false) {
    return "source_promotion_append_only_plan_performed_write";
  }
  if (dryRun.append_only_production_write_plan?.persisted !== false) {
    return "source_promotion_append_only_plan_persisted";
  }
  if (dryRun.append_only_production_write_plan?.overwrite_existing_record !== false) {
    return "source_promotion_append_only_plan_allows_overwrite";
  }
  if (dryRun.backup_snapshot_plan?.planned !== true) return "source_promotion_backup_plan_missing";
  if (dryRun.backup_snapshot_plan?.executed !== false) return "source_promotion_backup_plan_executed";
  if (dryRun.rollback_restore_plan?.planned !== true) return "source_promotion_rollback_plan_missing";
  if (dryRun.rollback_restore_plan?.executed !== false) return "source_promotion_rollback_plan_executed";
  if (dryRun.dry_run_proof_preview?.generated !== true) return "source_promotion_dry_run_proof_missing";
  if (dryRun.dry_run_proof_preview?.persisted !== false) return "source_promotion_dry_run_proof_preview_persisted";
  return null;
}

function validateContract(contract) {
  if (contract?.kind !== "candidate_runtime_write_promotion_persistence_readiness_contract") {
    return "persistence_readiness_contract_missing";
  }
  if (contract.mode !== "persistence_readiness_only") return "persistence_readiness_contract_mode_invalid";
  if (contract.promotion_route !== "sandbox_candidate_store_to_production_candidate_store") {
    return "persistence_readiness_contract_route_invalid";
  }
  if (contract.source_store_scope_required !== "sandbox_candidate_store") {
    return "persistence_readiness_source_scope_invalid";
  }
  if (contract.target_store_scope !== "production_candidate_store") {
    return "persistence_readiness_target_scope_invalid";
  }
  if (contract.production_write_allowed !== false) return "persistence_readiness_contract_allows_write";
  if (contract.production_promotion_allowed !== false) {
    return "persistence_readiness_contract_allows_promotion";
  }
  for (const field of CONTRACT_TRUE_FIELDS) {
    if (contract[field] !== true) return "persistence_readiness_contract_required_field_invalid";
  }
  return null;
}

function reject(reason, state) {
  return {
    accepted: false,
    reason,
    promotion_persistence_readiness_generated: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    state_after: clone(state),
  };
}

function previewPromotionPersistenceReadiness({
  serviceWrite,
  guardPreview,
  promotionDryRun,
  userRequest,
  contract = makeContract(),
  state = BASELINE_STATE,
}) {
  const intent = classifyIntent(userRequest);
  for (const error of [
    validateServiceWrite(serviceWrite),
    validateGuardPreview(guardPreview, serviceWrite),
    validateDryRunPlan(promotionDryRun, serviceWrite, guardPreview),
  ]) {
    if (error) return reject(error, state);
  }
  if (!intent.explicit) return reject("missing_explicit_persistence_readiness_request", state);

  const contractError = validateContract(contract);
  if (contractError) return reject(contractError, state);

  const record = serviceWrite.candidate_record;
  const readinessId = `promotion_persistence_readiness_${sha256Text(
    [record.id, record.candidate_content_hash, record.source_text_hash, promotionDryRun.promotion_dry_run_plan_preview.id].join("|")
  ).slice(0, 24)}`;

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_persistence_readiness_preview_only",
    readiness_mode: "test_only_persistence_readiness_preview",
    promotion_route: contract.promotion_route,
    source_store_scope: serviceWrite.store_scope,
    target_store_scope: contract.target_store_scope,
    source_candidate_id: record.id,
    planned_production_candidate_id: record.id,
    candidate_id_verified: true,
    candidate_content_hash: record.candidate_content_hash,
    planned_candidate_content_hash: record.candidate_content_hash,
    candidate_content_hash_verified: true,
    source_text_hash: record.source_text_hash,
    planned_source_text_hash: record.source_text_hash,
    source_text_hash_verified: true,
    source_route: record.source_route,
    planned_source_route: record.source_route,
    source_route_link_verified: true,
    source_dry_run_plan_id: promotionDryRun.promotion_dry_run_plan_preview.id,
    source_dry_run_plan_persisted: false,
    source_dry_run_proof_persisted: false,
    append_only_plan_verified: true,
    backup_snapshot_plan_verified: true,
    rollback_restore_plan_verified: true,
    dry_run_proof_preview_verified: true,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_saved: false,
    promotion_persistence_readiness_generated: true,
    promotion_persistence_readiness_persisted: false,
    promotion_dry_run_plan_persisted: false,
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
    persistence_readiness_preview: {
      kind: "production_candidate_store_promotion_persistence_readiness_preview",
      id: readinessId,
      persisted: false,
      readiness_only: true,
      source_dry_run_plan_id: promotionDryRun.promotion_dry_run_plan_preview.id,
      candidate_id_match: true,
      candidate_content_hash_match: true,
      source_text_hash_match: true,
      source_route_link_match: true,
      append_only_plan_verified: true,
      backup_snapshot_plan_verified: true,
      rollback_restore_plan_verified: true,
      dry_run_proof_preview_verified: true,
      guard_token_consumed: false,
      production_write_performed: false,
      production_promotion_performed: false,
    },
    future_persistence_requirements: {
      explicit_future_persistence_request_required: true,
      explicit_future_production_write_request_required: true,
      fresh_guard_token_required: true,
      fresh_backup_snapshot_required: true,
      rollback_restore_plan_required: true,
      final_operator_confirmation_required: true,
    },
    direct_requests_detected: {
      production_write:
        guardPreview.direct_requests_detected.production_write ||
        promotionDryRun.direct_requests_detected.production_write ||
        intent.production_write,
      production_promotion:
        promotionDryRun.direct_requests_detected.production_promotion || intent.production_promotion,
      persist: intent.persist,
      approval:
        guardPreview.direct_requests_detected.approval ||
        serviceWrite.direct_requests_detected.approval ||
        promotionDryRun.direct_requests_detected.approval ||
        intent.approval,
      pending_engine:
        guardPreview.direct_requests_detected.pending_engine ||
        serviceWrite.direct_requests_detected.pending_engine ||
        promotionDryRun.direct_requests_detected.pending_engine ||
        intent.pending_engine,
      adoption:
        guardPreview.direct_requests_detected.adoption ||
        serviceWrite.direct_requests_detected.adoption ||
        promotionDryRun.direct_requests_detected.adoption ||
        intent.adoption,
      settlement:
        guardPreview.direct_requests_detected.settlement ||
        serviceWrite.direct_requests_detected.settlement ||
        promotionDryRun.direct_requests_detected.settlement ||
        intent.settlement,
      canon:
        guardPreview.direct_requests_detected.canon ||
        serviceWrite.direct_requests_detected.canon ||
        promotionDryRun.direct_requests_detected.canon ||
        intent.canon,
      active_engine:
        guardPreview.direct_requests_detected.active_engine ||
        serviceWrite.direct_requests_detected.active_engine ||
        promotionDryRun.direct_requests_detected.active_engine ||
        intent.active_engine,
    },
    blocked_direct_actions: BLOCKED_ACTIONS,
    next_allowed_phase: "phase41l_or_later_explicit_candidate_runtime_write_production_persistence_dry_run",
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.promotion_persistence_readiness_generated, false);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

{
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  assertRejected(
    previewPromotionPersistenceReadiness({
      serviceWrite,
      guardPreview,
      promotionDryRun: null,
      userRequest: "check promotion persistence readiness",
    }),
    "source_promotion_dry_run_not_accepted"
  );
}

{
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  const promotionDryRun = makePromotionDryRun(serviceWrite);
  assertRejected(
    previewPromotionPersistenceReadiness({
      serviceWrite,
      guardPreview,
      promotionDryRun,
      userRequest: "looks good, continue",
    }),
    "missing_explicit_persistence_readiness_request"
  );
}

for (const [override, reason] of [
  [{ production_write_performed: true }, "source_promotion_dry_run_performed_write"],
  [{ production_promotion_performed: true }, "source_promotion_dry_run_performed_promotion"],
  [{ promotion_dry_run_plan_persisted: true }, "source_promotion_dry_run_plan_persisted"],
  [{ promotion_dry_run_proof_persisted: true }, "source_promotion_dry_run_proof_persisted"],
  [{ guard_token_consumed: true }, "source_promotion_dry_run_guard_token_consumed"],
  [{ backup_snapshot_created: true }, "source_promotion_dry_run_backup_created"],
  [{ rollback_executed: true }, "source_promotion_dry_run_rollback_executed"],
]) {
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  assertRejected(
    previewPromotionPersistenceReadiness({
      serviceWrite,
      guardPreview,
      promotionDryRun: makePromotionDryRun(serviceWrite, override),
      userRequest: "check promotion persistence readiness",
    }),
    reason
  );
}

for (const [override, reason] of [
  [{ planned_production_candidate_id: "candidate_mismatch" }, "source_promotion_dry_run_planned_candidate_id_mismatch"],
  [{ planned_candidate_content_hash: "hash_mismatch" }, "source_promotion_dry_run_planned_candidate_hash_mismatch"],
  [{ planned_source_text_hash: "source_hash_mismatch" }, "source_promotion_dry_run_planned_source_hash_mismatch"],
  [{ planned_source_route: "other_route" }, "source_promotion_dry_run_planned_route_mismatch"],
  [{ append_only_production_write_plan: { ...makePromotionDryRun(makeServiceWrite()).append_only_production_write_plan, write_performed: true } }, "source_promotion_append_only_plan_performed_write"],
  [{ backup_snapshot_plan: { planned: true, executed: true, persisted: false } }, "source_promotion_backup_plan_executed"],
  [{ rollback_restore_plan: { planned: true, executed: true, persisted: false } }, "source_promotion_rollback_plan_executed"],
  [{ dry_run_proof_preview: { ...makePromotionDryRun(makeServiceWrite()).dry_run_proof_preview, persisted: true } }, "source_promotion_dry_run_proof_preview_persisted"],
]) {
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  assertRejected(
    previewPromotionPersistenceReadiness({
      serviceWrite,
      guardPreview,
      promotionDryRun: makePromotionDryRun(serviceWrite, override),
      userRequest: "check promotion persistence readiness",
    }),
    reason
  );
}

for (const [override, reason] of [
  [{ mode: "persistence_write" }, "persistence_readiness_contract_mode_invalid"],
  [{ target_store_scope: "sandbox_candidate_store" }, "persistence_readiness_target_scope_invalid"],
  [{ production_write_allowed: true }, "persistence_readiness_contract_allows_write"],
  [{ production_promotion_allowed: true }, "persistence_readiness_contract_allows_promotion"],
  [{ persistence_readiness_must_not_persist: false }, "persistence_readiness_contract_required_field_invalid"],
]) {
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  const promotionDryRun = makePromotionDryRun(serviceWrite);
  assertRejected(
    previewPromotionPersistenceReadiness({
      serviceWrite,
      guardPreview,
      promotionDryRun,
      userRequest: "check promotion persistence readiness",
      contract: makeContract(override),
    }),
    reason
  );
}

{
  const serviceWrite = makeServiceWrite();
  const guardPreview = makeGuardPreview(serviceWrite);
  const promotionDryRun = makePromotionDryRun(serviceWrite);
  const result = previewPromotionPersistenceReadiness({
    serviceWrite,
    guardPreview,
    promotionDryRun,
    userRequest: "check promotion persistence readiness",
  });

  assert.equal(result.accepted, true);
  assert.equal(
    result.reason,
    "production_candidate_store_promotion_persistence_readiness_preview_only"
  );
  assert.equal(result.readiness_mode, "test_only_persistence_readiness_preview");
  assert.equal(result.source_candidate_id, serviceWrite.candidate_record.id);
  assert.equal(result.planned_production_candidate_id, serviceWrite.candidate_record.id);
  assert.equal(result.candidate_id_verified, true);
  assert.equal(result.candidate_content_hash_verified, true);
  assert.equal(result.source_text_hash_verified, true);
  assert.equal(result.source_route_link_verified, true);
  assert.equal(result.source_dry_run_plan_id, promotionDryRun.promotion_dry_run_plan_preview.id);
  assert.equal(result.source_dry_run_plan_persisted, false);
  assert.equal(result.source_dry_run_proof_persisted, false);
  assert.equal(result.append_only_plan_verified, true);
  assert.equal(result.backup_snapshot_plan_verified, true);
  assert.equal(result.rollback_restore_plan_verified, true);
  assert.equal(result.dry_run_proof_preview_verified, true);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_write_blocked_by_default, true);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.production_candidate_saved, false);
  assert.equal(result.promotion_persistence_readiness_generated, true);
  assert.equal(result.promotion_persistence_readiness_persisted, false);
  assert.equal(result.promotion_dry_run_plan_persisted, false);
  assert.equal(result.promotion_dry_run_proof_persisted, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_executed, false);
  assert.equal(result.persistence_readiness_preview.persisted, false);
  assert.equal(result.persistence_readiness_preview.readiness_only, true);
  assert.equal(result.persistence_readiness_preview.candidate_id_match, true);
  assert.equal(result.persistence_readiness_preview.candidate_content_hash_match, true);
  assert.equal(result.persistence_readiness_preview.source_text_hash_match, true);
  assert.equal(result.persistence_readiness_preview.source_route_link_match, true);
  assert.equal(result.persistence_readiness_preview.append_only_plan_verified, true);
  assert.equal(result.persistence_readiness_preview.backup_snapshot_plan_verified, true);
  assert.equal(result.persistence_readiness_preview.rollback_restore_plan_verified, true);
  assert.equal(result.persistence_readiness_preview.dry_run_proof_preview_verified, true);
  assert.equal(result.future_persistence_requirements.explicit_future_persistence_request_required, true);
  assert.equal(result.future_persistence_requirements.explicit_future_production_write_request_required, true);
  assert.equal(result.future_persistence_requirements.fresh_guard_token_required, true);
  assert.equal(result.future_persistence_requirements.final_operator_confirmation_required, true);
  assertFalseFields(result, MUTATION_FIELDS);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

{
  const serviceWrite = makeServiceWrite({
    direct_requests_detected: {
      approval: true,
      pending_engine: true,
      adoption: true,
      settlement: true,
      canon: true,
      active_engine: true,
    },
  });
  const guardPreview = makeGuardPreview(serviceWrite, {
    direct_requests_detected: {
      production_write: true,
      approval: true,
      pending_engine: true,
      adoption: true,
      settlement: true,
      canon: true,
      active_engine: true,
    },
  });
  const promotionDryRun = makePromotionDryRun(serviceWrite, {
    direct_requests_detected: {
      production_write: true,
      production_promotion: true,
      approval: true,
      pending_engine: true,
      adoption: true,
      settlement: true,
      canon: true,
      active_engine: true,
    },
  });
  const result = previewPromotionPersistenceReadiness({
    serviceWrite,
    guardPreview,
    promotionDryRun,
    userRequest:
      "check promotion persistence readiness, write production, promote to production, persist it, approve it, create pending engine, adopt, settle into canon, and update active_engine",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.persist, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  for (const action of BLOCKED_ACTIONS) {
    assert.ok(result.blocked_direct_actions.includes(action), `${action} must be blocked`);
  }
  assertFalseFields(result, MUTATION_FIELDS);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

console.log(
  "Phase41K explicit candidate runtime write promotion persistence readiness smoke tests passed."
);
