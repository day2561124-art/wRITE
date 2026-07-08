import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  production_write_performed: false,
  production_guard_opened: false,
  production_promotion_performed: false,
  sandbox_candidate_saved: false,
  candidate_runtime_write_performed: false,
  guard_token_consumed: false,
  backup_created: false,
  rollback_executed: false,
  dry_run_proof_persisted: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  adoption_performed: false,
  settlement_performed: false,
  canon_update_performed: false,
  active_engine_update_performed: false,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function assertNoProductionMutation(snapshot) {
  assert.equal(snapshot.production_candidate_saved, false);
  assert.equal(snapshot.production_write_performed, false);
  assert.equal(snapshot.production_promotion_performed, false);
  assert.equal(snapshot.guard_token_consumed, false);
  assert.equal(snapshot.backup_created, false);
  assert.equal(snapshot.rollback_executed, false);
  assert.equal(snapshot.dry_run_proof_persisted, false);
  assert.equal(snapshot.approval_request_created, false);
  assert.equal(snapshot.pending_engine_candidate_created, false);
  assert.equal(snapshot.adoption_performed, false);
  assert.equal(snapshot.settlement_performed, false);
  assert.equal(snapshot.canon_update_performed, false);
  assert.equal(snapshot.active_engine_update_performed, false);
}

function assertNoStateMutation(snapshot) {
  assertNoProductionMutation(snapshot);
  assert.equal(snapshot.production_guard_opened, false);
  assert.equal(snapshot.sandbox_candidate_saved, false);
  assert.equal(snapshot.candidate_runtime_write_performed, false);
}

function createSandboxServiceWriteResult(overrides = {}) {
  const text = "Chapter title\n\nA safe story-like native chat output body.";
  const sourceTextHash = sha256Text(text);
  const candidateContentHash = sha256Text(
    JSON.stringify({
      kind: "chat_output",
      route: "chatgpt_native_full_neural_writing_handoff",
      text,
    })
  );

  const candidateRecord = {
    id:
      "candidate_" +
      sha256Text(
        [
          "CandidateRuntimeWriteService.writeCandidate",
          "chat_output",
          "chatgpt_native_full_neural_writing_handoff",
          sourceTextHash,
          candidateContentHash,
          "call candidate runtime write service",
        ].join("|")
      ).slice(0, 24),
    kind: "candidate",
    source_kind: "chat_output",
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_text_hash: sourceTextHash,
    candidate_content_hash: candidateContentHash,
    text,
    status: "candidate_saved_to_sandbox_service_store",
    persisted_to_production: false,
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    write_strategy: "append_only_jsonl",
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
  };

  return {
    accepted: true,
    reason: "candidate_runtime_write_service_integration_sandbox_append_only",
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    service_write_performed: true,
    candidate_runtime_write_performed: true,
    production_candidate_saved: false,
    sandbox_candidate_saved: true,
    candidate_id_created: true,
    candidate_hash_created: true,
    source_text_hash_created: true,
    append_only_write_performed: true,
    transaction_started: true,
    transaction_committed: true,
    rollback_performed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    candidate_record: candidateRecord,
    direct_requests_detected: {
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
    },
    blocked_direct_actions: [
      "production_candidate_store_write",
      "approval_request_create",
      "pending_engine_candidate_create",
      "adoption",
      "settlement",
      "canon_update",
      "active_engine_update",
    ],
    state_after: clone(BASELINE_STATE),
    ...overrides,
  };
}

function createProductionGuardContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_production_guard_contract",
    mode: "production_guard_boundary",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope_required: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    production_write_blocked_by_default: true,
    explicit_production_guard_request_required: true,
    explicit_future_promotion_request_required: true,
    source_sandbox_service_write_required: true,
    guard_token_required: true,
    backup_readiness_required: true,
    rollback_readiness_required: true,
    dry_run_proof_required: true,
    deterministic_candidate_id_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    source_route_link_required: true,
    append_only_required: true,
    no_approval_request: true,
    no_pending_engine_candidate: true,
    no_adoption: true,
    no_settlement: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ...overrides,
  };
}

function createValidGuardToken(overrides = {}) {
  return {
    kind: "candidate_runtime_write_guard_token",
    scope: "production_candidate_store_guard",
    target_store_scope: "production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    token_id: "guard_token_test_only",
    consumed: false,
    test_only: true,
    ...overrides,
  };
}

function createBackupReadiness(overrides = {}) {
  return {
    kind: "production_candidate_store_backup_readiness",
    backup_strategy: "test_only_snapshot_before_promotion",
    backup_available: true,
    test_only: true,
    ...overrides,
  };
}

function createRollbackReadiness(overrides = {}) {
  return {
    kind: "production_candidate_store_rollback_readiness",
    rollback_strategy: "test_only_restore_from_snapshot",
    rollback_available: true,
    test_only: true,
    ...overrides,
  };
}

function createDryRunProof(overrides = {}) {
  return {
    kind: "production_candidate_store_promotion_dry_run_proof",
    dry_run_completed: true,
    production_write_performed: false,
    candidate_id_verified: true,
    candidate_content_hash_verified: true,
    source_text_hash_verified: true,
    source_route_link_verified: true,
    append_only_verified: true,
    no_approval_request_verified: true,
    no_pending_engine_candidate_verified: true,
    no_adoption_verified: true,
    no_settlement_verified: true,
    no_canon_update_verified: true,
    no_active_engine_update_verified: true,
    test_only: true,
    ...overrides,
  };
}

function classifyProductionGuardIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitPatterns = [
    /\bcheck\b.*\bproduction guard\b/,
    /\bopen\b.*\bproduction guard\b/,
    /\bverify\b.*\bproduction guard\b/,
    /\bproduction guard\b.*\bboundary\b/,
    /\bsandbox\b.*\bproduction\b.*\bpromotion boundary\b/,
    /\bproduction candidate store guard\b/,
  ];

  return {
    explicit: explicitPatterns.some((pattern) => pattern.test(normalized)),
    direct_production_write_requested:
      /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    direct_approval_requested: /\bapproval\b|\bapprove\b/.test(normalized),
    direct_pending_engine_requested:
      /\bpending engine\b|\bpending_engine\b/.test(normalized),
    direct_adoption_requested: /\badopt\b/.test(normalized),
    direct_settlement_requested: /\bsettle\b/.test(normalized),
    direct_canon_requested: /\bcanon\b/.test(normalized),
    direct_active_engine_requested: /\bactive_engine\b|\bactive engine\b/.test(
      normalized
    ),
  };
}

function validateSandboxServiceWrite(serviceWriteResult) {
  if (!serviceWriteResult || serviceWriteResult.accepted !== true) {
    return "sandbox_service_write_not_accepted";
  }

  if (
    serviceWriteResult.service_api !==
      "CandidateRuntimeWriteService.writeCandidate" ||
    serviceWriteResult.store_scope !== "sandbox_candidate_store" ||
    serviceWriteResult.service_write_performed !== true ||
    serviceWriteResult.candidate_runtime_write_performed !== true ||
    serviceWriteResult.sandbox_candidate_saved !== true ||
    serviceWriteResult.production_candidate_saved !== false
  ) {
    return "sandbox_service_write_contract_invalid";
  }

  const record = serviceWriteResult.candidate_record;

  if (!record || record.kind !== "candidate") {
    return "sandbox_candidate_record_missing";
  }

  if (record.store_scope !== "sandbox_candidate_store") {
    return "sandbox_candidate_record_scope_invalid";
  }

  if (record.persisted_to_production !== false) {
    return "sandbox_candidate_already_persisted_to_production";
  }

  if (record.source_kind !== "chat_output") {
    return "sandbox_candidate_source_is_not_native_chat_output";
  }

  if (record.source_route !== "chatgpt_native_full_neural_writing_handoff") {
    return "sandbox_candidate_source_route_invalid";
  }

  const requiredNullFields = [
    "approval_request_id",
    "pending_engine_candidate_id",
    "adoption_id",
    "settlement_id",
    "canon_update_id",
    "active_engine_update_id",
  ];

  for (const field of requiredNullFields) {
    if (record[field] !== null) {
      return "sandbox_candidate_direct_action_id_not_null";
    }
  }

  return null;
}

function validateProductionGuardContract(contract) {
  if (!contract || contract.kind !== "candidate_runtime_write_production_guard_contract") {
    return "production_guard_contract_missing";
  }

  if (contract.mode !== "production_guard_boundary") {
    return "production_guard_contract_mode_invalid";
  }

  if (contract.promotion_route !== "sandbox_candidate_store_to_production_candidate_store") {
    return "production_guard_contract_route_invalid";
  }

  if (contract.source_store_scope_required !== "sandbox_candidate_store") {
    return "production_guard_source_scope_invalid";
  }

  if (contract.target_store_scope !== "production_candidate_store") {
    return "production_guard_target_scope_invalid";
  }

  const requiredTrueFields = [
    "production_write_blocked_by_default",
    "explicit_production_guard_request_required",
    "explicit_future_promotion_request_required",
    "source_sandbox_service_write_required",
    "guard_token_required",
    "backup_readiness_required",
    "rollback_readiness_required",
    "dry_run_proof_required",
    "deterministic_candidate_id_required",
    "candidate_content_hash_required",
    "source_text_hash_required",
    "source_route_link_required",
    "append_only_required",
    "no_approval_request",
    "no_pending_engine_candidate",
    "no_adoption",
    "no_settlement",
    "no_canon_update",
    "no_active_engine_update",
  ];

  for (const field of requiredTrueFields) {
    if (contract[field] !== true) {
      return "production_guard_contract_required_field_invalid";
    }
  }

  return null;
}

function validateGuardToken(token) {
  if (!token || token.kind !== "candidate_runtime_write_guard_token") {
    return "production_guard_token_missing";
  }

  if (token.scope !== "production_candidate_store_guard") {
    return "production_guard_token_scope_invalid";
  }

  if (token.target_store_scope !== "production_candidate_store") {
    return "production_guard_token_target_scope_invalid";
  }

  if (token.source_store_scope !== "sandbox_candidate_store") {
    return "production_guard_token_source_scope_invalid";
  }

  if (token.consumed !== false) {
    return "production_guard_token_already_consumed";
  }

  if (token.test_only !== true) {
    return "production_guard_token_not_test_only";
  }

  return null;
}

function validateBackupReadiness(backup) {
  if (!backup || backup.kind !== "production_candidate_store_backup_readiness") {
    return "production_backup_readiness_missing";
  }

  if (backup.backup_available !== true) {
    return "production_backup_not_available";
  }

  if (backup.test_only !== true) {
    return "production_backup_not_test_only";
  }

  return null;
}

function validateRollbackReadiness(rollback) {
  if (!rollback || rollback.kind !== "production_candidate_store_rollback_readiness") {
    return "production_rollback_readiness_missing";
  }

  if (rollback.rollback_available !== true) {
    return "production_rollback_not_available";
  }

  if (rollback.test_only !== true) {
    return "production_rollback_not_test_only";
  }

  return null;
}

function validateDryRunProof(proof) {
  if (!proof || proof.kind !== "production_candidate_store_promotion_dry_run_proof") {
    return "production_dry_run_proof_missing";
  }

  if (proof.dry_run_completed !== true) {
    return "production_dry_run_not_completed";
  }

  if (proof.production_write_performed !== false) {
    return "production_dry_run_performed_write";
  }

  const requiredTrueFields = [
    "candidate_id_verified",
    "candidate_content_hash_verified",
    "source_text_hash_verified",
    "source_route_link_verified",
    "append_only_verified",
    "no_approval_request_verified",
    "no_pending_engine_candidate_verified",
    "no_adoption_verified",
    "no_settlement_verified",
    "no_canon_update_verified",
    "no_active_engine_update_verified",
    "test_only",
  ];

  for (const field of requiredTrueFields) {
    if (proof[field] !== true) {
      return "production_dry_run_required_field_invalid";
    }
  }

  return null;
}

function previewProductionCandidateStoreGuard({
  serviceWriteResult,
  userRequest,
  productionGuardContract = createProductionGuardContract(),
  guardToken = createValidGuardToken(),
  backupReadiness = createBackupReadiness(),
  rollbackReadiness = createRollbackReadiness(),
  dryRunProof = createDryRunProof(),
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const intent = classifyProductionGuardIntent(userRequest);

  const serviceError = validateSandboxServiceWrite(serviceWriteResult);
  if (serviceError) {
    return {
      accepted: false,
      reason: serviceError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  if (!intent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_production_guard_request",
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  const contractError = validateProductionGuardContract(productionGuardContract);
  if (contractError) {
    return {
      accepted: false,
      reason: contractError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  const tokenError = validateGuardToken(guardToken);
  if (tokenError) {
    return {
      accepted: false,
      reason: tokenError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  const backupError = validateBackupReadiness(backupReadiness);
  if (backupError) {
    return {
      accepted: false,
      reason: backupError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  const rollbackError = validateRollbackReadiness(rollbackReadiness);
  if (rollbackError) {
    return {
      accepted: false,
      reason: rollbackError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  const dryRunError = validateDryRunProof(dryRunProof);
  if (dryRunError) {
    return {
      accepted: false,
      reason: dryRunError,
      production_guard_opened: false,
      production_write_allowed: false,
      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "production_candidate_store_guard_preview_only",
    production_guard_opened: true,
    guard_mode: "test_only_preview",
    promotion_route: productionGuardContract.promotion_route,
    source_store_scope: serviceWriteResult.store_scope,
    target_store_scope: productionGuardContract.target_store_scope,
    source_candidate_id: serviceWriteResult.candidate_record.id,
    source_text_hash: serviceWriteResult.candidate_record.source_text_hash,
    candidate_content_hash:
      serviceWriteResult.candidate_record.candidate_content_hash,
    source_route: serviceWriteResult.candidate_record.source_route,

    production_write_allowed: false,
    production_write_blocked_by_default: true,
    future_promotion_required: true,
    explicit_future_promotion_request_required: true,

    production_candidate_saved: false,
    production_write_performed: false,
    production_promotion_performed: false,
    sandbox_candidate_saved: false,
    candidate_runtime_write_performed: false,
    guard_token_consumed: false,
    backup_created: false,
    rollback_executed: false,
    dry_run_proof_persisted: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    guard_preview: {
      kind: "production_candidate_store_guard_preview",
      persisted: false,
      id: null,
      token_id: guardToken.token_id,
      token_consumed: false,
      backup_readiness_kind: backupReadiness.kind,
      rollback_readiness_kind: rollbackReadiness.kind,
      dry_run_proof_kind: dryRunProof.kind,
      production_write_performed: false,
      requires_future_explicit_promotion_phase: true,
    },

    direct_requests_detected: {
      production_write: intent.direct_production_write_requested,
      approval:
        serviceWriteResult.direct_requests_detected.approval ||
        intent.direct_approval_requested,
      pending_engine:
        serviceWriteResult.direct_requests_detected.pending_engine ||
        intent.direct_pending_engine_requested,
      adoption:
        serviceWriteResult.direct_requests_detected.adoption ||
        intent.direct_adoption_requested,
      settlement:
        serviceWriteResult.direct_requests_detected.settlement ||
        intent.direct_settlement_requested,
      canon:
        serviceWriteResult.direct_requests_detected.canon ||
        intent.direct_canon_requested,
      active_engine:
        serviceWriteResult.direct_requests_detected.active_engine ||
        intent.direct_active_engine_requested,
    },

    blocked_direct_actions: [
      "production_candidate_store_write",
      "production_candidate_store_promotion",
      "guard_token_consume",
      "backup_create",
      "rollback_execute",
      "dry_run_proof_persist",
      "approval_request_create",
      "pending_engine_candidate_create",
      "adoption",
      "settlement",
      "canon_update",
      "active_engine_update",
    ],

    next_allowed_phase:
      "phase41j_or_later_explicit_candidate_runtime_write_promotion_dry_run",
    state_after: before,
  };
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: null,
    userRequest: "check production guard boundary",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "sandbox_service_write_not_accepted");
  assert.equal(result.production_guard_opened, false);
  assert.equal(result.production_write_allowed, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "looks good, continue",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "missing_explicit_production_guard_request");
  assert.equal(result.production_guard_opened, false);
  assert.equal(result.production_write_allowed, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult({
      store_scope: "production_candidate_store",
    }),
    userRequest: "check production guard boundary",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "sandbox_service_write_contract_invalid");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult({
      candidate_record: {
        ...createSandboxServiceWriteResult().candidate_record,
        persisted_to_production: true,
      },
    }),
    userRequest: "check production guard boundary",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "sandbox_candidate_already_persisted_to_production");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    productionGuardContract: createProductionGuardContract({
      production_write_blocked_by_default: false,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_guard_contract_required_field_invalid");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    productionGuardContract: createProductionGuardContract({
      target_store_scope: "sandbox_candidate_store",
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_guard_target_scope_invalid");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    guardToken: null,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_guard_token_missing");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    guardToken: createValidGuardToken({
      consumed: true,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_guard_token_already_consumed");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    backupReadiness: createBackupReadiness({
      backup_available: false,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_backup_not_available");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    rollbackReadiness: createRollbackReadiness({
      rollback_available: false,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_rollback_not_available");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    dryRunProof: createDryRunProof({
      dry_run_completed: false,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_dry_run_not_completed");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: createSandboxServiceWriteResult(),
    userRequest: "check production guard boundary",
    dryRunProof: createDryRunProof({
      production_write_performed: true,
    }),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "production_dry_run_performed_write");
  assert.equal(result.production_guard_opened, false);
  assertNoStateMutation(result.state_after);
}

{
  const serviceWrite = createSandboxServiceWriteResult();
  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: serviceWrite,
    userRequest: "check production guard boundary",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_guard_preview_only");
  assert.equal(result.production_guard_opened, true);
  assert.equal(result.guard_mode, "test_only_preview");
  assert.equal(
    result.promotion_route,
    "sandbox_candidate_store_to_production_candidate_store"
  );
  assert.equal(result.source_store_scope, "sandbox_candidate_store");
  assert.equal(result.target_store_scope, "production_candidate_store");
  assert.equal(result.source_candidate_id, serviceWrite.candidate_record.id);
  assert.equal(result.source_text_hash, serviceWrite.candidate_record.source_text_hash);
  assert.equal(
    result.candidate_content_hash,
    serviceWrite.candidate_record.candidate_content_hash
  );
  assert.equal(
    result.source_route,
    "chatgpt_native_full_neural_writing_handoff"
  );

  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_write_blocked_by_default, true);
  assert.equal(result.future_promotion_required, true);
  assert.equal(result.explicit_future_promotion_request_required, true);

  assert.equal(result.production_candidate_saved, false);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.sandbox_candidate_saved, false);
  assert.equal(result.candidate_runtime_write_performed, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.backup_created, false);
  assert.equal(result.rollback_executed, false);
  assert.equal(result.dry_run_proof_persisted, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assert.equal(result.guard_preview.kind, "production_candidate_store_guard_preview");
  assert.equal(result.guard_preview.persisted, false);
  assert.equal(result.guard_preview.id, null);
  assert.equal(result.guard_preview.token_consumed, false);
  assert.equal(result.guard_preview.production_write_performed, false);
  assert.equal(
    result.guard_preview.requires_future_explicit_promotion_phase,
    true
  );

  assertNoProductionMutation(result);
  assertNoStateMutation(result.state_after);
}

{
  const serviceWrite = createSandboxServiceWriteResult({
    direct_requests_detected: {
      approval: true,
      pending_engine: true,
      adoption: true,
      settlement: true,
      canon: true,
      active_engine: true,
    },
  });

  const result = previewProductionCandidateStoreGuard({
    serviceWriteResult: serviceWrite,
    userRequest:
      "check production guard boundary, write production, approve it, create pending engine, adopt, settle into canon, and update active_engine",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);

  assert.ok(result.blocked_direct_actions.includes("production_candidate_store_write"));
  assert.ok(
    result.blocked_direct_actions.includes("production_candidate_store_promotion")
  );
  assert.ok(result.blocked_direct_actions.includes("guard_token_consume"));
  assert.ok(result.blocked_direct_actions.includes("backup_create"));
  assert.ok(result.blocked_direct_actions.includes("rollback_execute"));
  assert.ok(result.blocked_direct_actions.includes("dry_run_proof_persist"));
  assert.ok(result.blocked_direct_actions.includes("approval_request_create"));
  assert.ok(result.blocked_direct_actions.includes("pending_engine_candidate_create"));
  assert.ok(result.blocked_direct_actions.includes("adoption"));
  assert.ok(result.blocked_direct_actions.includes("settlement"));
  assert.ok(result.blocked_direct_actions.includes("canon_update"));
  assert.ok(result.blocked_direct_actions.includes("active_engine_update"));

  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assertNoProductionMutation(result);
  assertNoStateMutation(result.state_after);
}

console.log(
  "Phase41I explicit candidate runtime write production guard smoke tests passed."
);
