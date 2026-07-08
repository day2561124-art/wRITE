import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  production_write_performed: false,
  production_promotion_performed: false,
  promotion_dry_run_plan_persisted: false,
  promotion_dry_run_proof_persisted: false,
  promotion_persistence_readiness_persisted: false,
  dry_run_proof_seal_generated: false,
  dry_run_proof_seal_persisted: false,
  proof_seal_audit_receipt_created: false,
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
  "dry_run_proof_seal_persisted",
  "proof_seal_audit_receipt_created",
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

const BLOCKED_ACTIONS = [
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "promotion_dry_run_plan_persist",
  "promotion_persistence_readiness_persist",
  "dry_run_proof_persist",
  "dry_run_proof_seal_persist",
  "proof_seal_audit_receipt_create",
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
  "source_persistence_readiness_required",
  "explicit_dry_run_proof_seal_request_required",
  "proof_preview_required",
  "proof_preview_must_already_be_unpersisted",
  "dry_run_plan_must_already_be_unpersisted",
  "deterministic_seal_id_required",
  "seal_payload_hash_required",
  "candidate_identity_match_required",
  "candidate_content_hash_match_required",
  "source_text_hash_match_required",
  "source_route_link_match_required",
  "guard_token_must_remain_unconsumed",
  "backup_snapshot_plan_must_remain_unexecuted",
  "rollback_restore_plan_must_remain_unexecuted",
  "seal_preview_only",
  "seal_must_not_persist",
  "no_production_write",
  "no_production_promotion",
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

function assertFalseFields(snapshot, fields = MUTATION_FIELDS) {
  for (const field of fields) {
    assert.equal(snapshot[field], false, `${field} must remain false`);
  }
}

function makeSourceRecord() {
  const text = "Chapter title\n\nA safe story-like native chat output body.";
  const sourceTextHash = sha256Text(text);
  const candidateContentHash = sha256Text(
    JSON.stringify({
      kind: "chat_output",
      route: "chatgpt_native_full_neural_writing_handoff",
      text,
    })
  );

  return {
    id:
      "candidate_" +
      sha256Text(
        [
          "CandidateRuntimeWriteService.writeCandidate",
          "chat_output",
          "chatgpt_native_full_neural_writing_handoff",
          sourceTextHash,
          candidateContentHash,
        ].join("|")
      ).slice(0, 24),
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_text_hash: sourceTextHash,
    candidate_content_hash: candidateContentHash,
  };
}

function makePersistenceReadiness(overrides = {}) {
  const record = makeSourceRecord();

  const readiness = {
    accepted: true,
    reason:
      "production_candidate_store_promotion_persistence_readiness_preview_only",
    readiness_mode: "test_only_persistence_readiness_preview",
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
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_saved: false,
    promotion_dry_run_plan_persisted: false,
    promotion_dry_run_proof_persisted: false,
    promotion_persistence_readiness_persisted: false,
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
      opened: true,
      persisted: false,
      dry_run_proof_can_be_sealed: true,
      dry_run_proof_can_be_persisted: false,
      production_write_allowed: false,
      production_promotion_allowed: false,
      requires_future_explicit_proof_persistence_phase: true,
      requires_future_explicit_production_write_phase: true,
    },
    dry_run_proof_preview: {
      kind: "production_candidate_store_promotion_dry_run_proof_preview",
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
    append_only_production_write_plan: {
      operation: "append_only_jsonl_append",
      planned: true,
      write_performed: false,
      persisted: false,
      overwrite_existing_record: false,
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
  };

  return {
    ...readiness,
    ...overrides,
  };
}

function makeSealContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_promotion_dry_run_proof_seal_contract",
    mode: "dry_run_proof_seal_preview_only",
    source_persistence_readiness_required: true,
    explicit_dry_run_proof_seal_request_required: true,
    proof_preview_required: true,
    proof_preview_must_already_be_unpersisted: true,
    dry_run_plan_must_already_be_unpersisted: true,
    deterministic_seal_id_required: true,
    seal_payload_hash_required: true,
    candidate_identity_match_required: true,
    candidate_content_hash_match_required: true,
    source_text_hash_match_required: true,
    source_route_link_match_required: true,
    guard_token_must_remain_unconsumed: true,
    backup_snapshot_plan_must_remain_unexecuted: true,
    rollback_restore_plan_must_remain_unexecuted: true,
    seal_preview_only: true,
    seal_must_not_persist: true,
    no_production_write: true,
    no_production_promotion: true,
    no_approval_request: true,
    no_pending_engine_candidate: true,
    no_adoption: true,
    no_settlement: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ...overrides,
  };
}

function classifySealIntent(text) {
  const normalized = String(text || "").toLowerCase();

  return {
    explicit:
      /\bdry[- ]run proof seal\b/.test(normalized) ||
      /\bseal\b.*\bdry[- ]run proof\b/.test(normalized) ||
      /\bproof seal\b.*\bpromotion\b/.test(normalized) ||
      /\bpromotion\b.*\bproof seal\b/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(
      normalized
    ),
    production_promotion:
      /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(
        normalized
      ),
    proof_persistence:
      /\bpersist\b.*\bproof\b|\bproof\b.*\bpersist\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
  };
}

function validateReadiness(readiness) {
  if (!readiness || readiness.accepted !== true) {
    return "promotion_persistence_readiness_not_accepted";
  }
  if (
    readiness.reason !==
    "production_candidate_store_promotion_persistence_readiness_preview_only"
  ) {
    return "promotion_persistence_readiness_reason_invalid";
  }
  if (readiness.readiness_mode !== "test_only_persistence_readiness_preview") {
    return "promotion_persistence_readiness_mode_invalid";
  }
  if (
    readiness.promotion_route !==
      "sandbox_candidate_store_to_production_candidate_store" ||
    readiness.source_store_scope !== "sandbox_candidate_store" ||
    readiness.target_store_scope !== "production_candidate_store"
  ) {
    return "promotion_persistence_readiness_route_or_scope_invalid";
  }
  if (
    readiness.production_write_allowed !== false ||
    readiness.production_write_blocked_by_default !== true ||
    readiness.production_promotion_allowed !== false
  ) {
    return "promotion_persistence_readiness_write_policy_invalid";
  }

  const falseChecks = [
    ["production_write_performed", "promotion_persistence_readiness_performed_write"],
    [
      "production_promotion_performed",
      "promotion_persistence_readiness_performed_promotion",
    ],
    ["production_candidate_saved", "promotion_persistence_readiness_saved_production_candidate"],
    ["promotion_dry_run_plan_persisted", "promotion_dry_run_plan_already_persisted"],
    ["promotion_dry_run_proof_persisted", "promotion_dry_run_proof_already_persisted"],
    [
      "promotion_persistence_readiness_persisted",
      "promotion_persistence_readiness_already_persisted",
    ],
    ["guard_token_consumed", "promotion_persistence_guard_token_consumed"],
    ["backup_snapshot_created", "promotion_persistence_backup_snapshot_created"],
    ["rollback_executed", "promotion_persistence_rollback_executed"],
  ];

  for (const [field, reason] of falseChecks) {
    if (readiness[field] !== false) return reason;
  }

  if (readiness.persistence_readiness_preview?.persisted !== false) {
    return "promotion_persistence_readiness_preview_persisted";
  }
  if (readiness.persistence_readiness_preview?.dry_run_proof_can_be_sealed !== true) {
    return "promotion_persistence_proof_seal_not_ready";
  }
  if (
    readiness.persistence_readiness_preview?.dry_run_proof_can_be_persisted !==
    false
  ) {
    return "promotion_persistence_proof_persistence_allowed";
  }
  if (readiness.dry_run_proof_preview?.generated !== true) {
    return "promotion_dry_run_proof_preview_missing";
  }
  if (readiness.dry_run_proof_preview?.persisted !== false) {
    return "promotion_dry_run_proof_preview_already_persisted";
  }
  if (readiness.append_only_production_write_plan?.write_performed !== false) {
    return "promotion_persistence_append_only_plan_performed_write";
  }
  if (readiness.append_only_production_write_plan?.persisted !== false) {
    return "promotion_persistence_append_only_plan_persisted";
  }
  if (readiness.backup_snapshot_plan?.executed !== false) {
    return "promotion_persistence_backup_plan_executed";
  }
  if (readiness.rollback_restore_plan?.executed !== false) {
    return "promotion_persistence_rollback_plan_executed";
  }

  return null;
}

function validateSealContract(contract) {
  if (
    !contract ||
    contract.kind !== "candidate_runtime_write_promotion_dry_run_proof_seal_contract"
  ) {
    return "dry_run_proof_seal_contract_missing";
  }
  if (contract.mode !== "dry_run_proof_seal_preview_only") {
    return "dry_run_proof_seal_contract_mode_invalid";
  }
  for (const field of CONTRACT_TRUE_FIELDS) {
    if (contract[field] !== true) {
      return "dry_run_proof_seal_contract_required_field_invalid";
    }
  }
  return null;
}

function validateLinkage(readiness) {
  if (readiness.source_candidate_id !== readiness.planned_production_candidate_id) {
    return "dry_run_proof_seal_candidate_id_mismatch";
  }
  if (readiness.candidate_content_hash !== readiness.planned_candidate_content_hash) {
    return "dry_run_proof_seal_candidate_content_hash_mismatch";
  }
  if (readiness.source_text_hash !== readiness.planned_source_text_hash) {
    return "dry_run_proof_seal_source_text_hash_mismatch";
  }
  if (readiness.source_route !== readiness.planned_source_route) {
    return "dry_run_proof_seal_source_route_mismatch";
  }
  if (
    readiness.candidate_id_verified !== true ||
    readiness.candidate_content_hash_verified !== true ||
    readiness.source_text_hash_verified !== true ||
    readiness.source_route_link_verified !== true
  ) {
    return "dry_run_proof_seal_linkage_verification_missing";
  }
  return null;
}

function reject(reason, state) {
  return {
    accepted: false,
    reason,
    dry_run_proof_seal_generated: false,
    dry_run_proof_seal_persisted: false,
    production_write_allowed: false,
    production_promotion_allowed: false,
    state_after: clone(state),
  };
}

function buildSealPayload(readiness) {
  return {
    kind: "production_candidate_store_promotion_dry_run_proof_seal_payload",
    source_candidate_id: readiness.source_candidate_id,
    planned_production_candidate_id: readiness.planned_production_candidate_id,
    candidate_content_hash: readiness.candidate_content_hash,
    planned_candidate_content_hash: readiness.planned_candidate_content_hash,
    source_text_hash: readiness.source_text_hash,
    planned_source_text_hash: readiness.planned_source_text_hash,
    source_route: readiness.source_route,
    planned_source_route: readiness.planned_source_route,
    append_only_plan_verified: true,
    backup_snapshot_plan_verified: true,
    rollback_restore_plan_verified: true,
    guard_token_unconsumed_verified: true,
    proof_unpersisted_verified: true,
    production_write_absent_verified: true,
    production_promotion_absent_verified: true,
  };
}

function previewDryRunProofSeal({
  readiness,
  userRequest,
  contract = makeSealContract(),
  state = BASELINE_STATE,
}) {
  const intent = classifySealIntent(userRequest);

  const readinessError = validateReadiness(readiness);
  if (readinessError) return reject(readinessError, state);
  if (!intent.explicit) return reject("missing_explicit_dry_run_proof_seal_request", state);

  const contractError = validateSealContract(contract);
  if (contractError) return reject(contractError, state);

  const linkageError = validateLinkage(readiness);
  if (linkageError) return reject(linkageError, state);

  const sealPayload = buildSealPayload(readiness);
  const sealPayloadHash = sha256Text(JSON.stringify(sealPayload));
  const sealId =
    "dry_run_proof_seal_" +
    sha256Text(
      [
        readiness.source_candidate_id,
        readiness.candidate_content_hash,
        readiness.source_text_hash,
        readiness.source_route,
        sealPayloadHash,
      ].join("|")
    ).slice(0, 24);

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_dry_run_proof_seal_preview_only",
    seal_mode: "test_only_proof_seal_preview",
    promotion_route: readiness.promotion_route,
    source_store_scope: readiness.source_store_scope,
    target_store_scope: readiness.target_store_scope,
    source_candidate_id: readiness.source_candidate_id,
    planned_production_candidate_id: readiness.planned_production_candidate_id,
    candidate_id_verified: true,
    candidate_content_hash: readiness.candidate_content_hash,
    planned_candidate_content_hash: readiness.planned_candidate_content_hash,
    candidate_content_hash_verified: true,
    source_text_hash: readiness.source_text_hash,
    planned_source_text_hash: readiness.planned_source_text_hash,
    source_text_hash_verified: true,
    source_route: readiness.source_route,
    planned_source_route: readiness.planned_source_route,
    source_route_link_verified: true,

    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_saved: false,
    promotion_dry_run_plan_persisted: false,
    promotion_dry_run_proof_persisted: false,
    promotion_persistence_readiness_persisted: false,
    dry_run_proof_seal_generated: true,
    dry_run_proof_seal_persisted: false,
    proof_seal_audit_receipt_created: false,
    guard_token_consumed: false,
    backup_snapshot_created: false,
    rollback_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    dry_run_proof_seal_preview: {
      kind: "production_candidate_store_promotion_dry_run_proof_seal_preview",
      id: sealId,
      payload_hash: sealPayloadHash,
      payload: sealPayload,
      generated: true,
      persisted: false,
      seal_only: true,
      production_write_performed: false,
      production_promotion_performed: false,
      dry_run_plan_persisted: false,
      dry_run_proof_persisted: false,
      proof_seal_audit_receipt_created: false,
      guard_token_consumed: false,
      requires_future_explicit_proof_persistence_phase: true,
      requires_future_explicit_production_write_phase: true,
    },

    sealed_contract_summary: {
      kind: "dry_run_proof_seal_contract_summary",
      persisted: false,
      source_readiness_reason: readiness.reason,
      source_readiness_mode: readiness.readiness_mode,
      candidate_identity_match: true,
      candidate_content_hash_match: true,
      source_text_hash_match: true,
      source_route_link_match: true,
      no_production_write: true,
      no_production_promotion: true,
      no_proof_persistence: true,
      no_approval_request: true,
      no_pending_engine_candidate: true,
      no_adoption: true,
      no_settlement: true,
      no_canon_update: true,
      no_active_engine_update: true,
    },

    direct_requests_detected: {
      production_write:
        readiness.direct_requests_detected.production_write || intent.production_write,
      production_promotion:
        readiness.direct_requests_detected.production_promotion ||
        intent.production_promotion,
      proof_persistence: intent.proof_persistence,
      approval: readiness.direct_requests_detected.approval || intent.approval,
      pending_engine:
        readiness.direct_requests_detected.pending_engine || intent.pending_engine,
      adoption: readiness.direct_requests_detected.adoption || intent.adoption,
      settlement: readiness.direct_requests_detected.settlement || intent.settlement,
      canon: readiness.direct_requests_detected.canon || intent.canon,
      active_engine:
        readiness.direct_requests_detected.active_engine || intent.active_engine,
    },

    blocked_direct_actions: BLOCKED_ACTIONS,
    next_allowed_phase:
      "phase41m_or_later_explicit_candidate_runtime_write_promotion_boundary_final_closure",
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.dry_run_proof_seal_generated, false);
  assert.equal(result.dry_run_proof_seal_persisted, false);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assertFalseFields(result.state_after);
}

{
  assertRejected(
    previewDryRunProofSeal({
      readiness: null,
      userRequest: "seal dry-run proof",
    }),
    "promotion_persistence_readiness_not_accepted"
  );
}

{
  assertRejected(
    previewDryRunProofSeal({
      readiness: makePersistenceReadiness(),
      userRequest: "looks good, continue",
    }),
    "missing_explicit_dry_run_proof_seal_request"
  );
}

for (const [override, reason] of [
  [{ reason: "other_reason" }, "promotion_persistence_readiness_reason_invalid"],
  [{ readiness_mode: "production_persistence" }, "promotion_persistence_readiness_mode_invalid"],
  [{ target_store_scope: "sandbox_candidate_store" }, "promotion_persistence_readiness_route_or_scope_invalid"],
  [{ production_write_allowed: true }, "promotion_persistence_readiness_write_policy_invalid"],
  [{ production_write_performed: true }, "promotion_persistence_readiness_performed_write"],
  [{ production_promotion_performed: true }, "promotion_persistence_readiness_performed_promotion"],
  [{ production_candidate_saved: true }, "promotion_persistence_readiness_saved_production_candidate"],
  [{ promotion_dry_run_plan_persisted: true }, "promotion_dry_run_plan_already_persisted"],
  [{ promotion_dry_run_proof_persisted: true }, "promotion_dry_run_proof_already_persisted"],
  [{ promotion_persistence_readiness_persisted: true }, "promotion_persistence_readiness_already_persisted"],
  [{ guard_token_consumed: true }, "promotion_persistence_guard_token_consumed"],
  [{ backup_snapshot_created: true }, "promotion_persistence_backup_snapshot_created"],
  [{ rollback_executed: true }, "promotion_persistence_rollback_executed"],
  [
    {
      persistence_readiness_preview: {
        ...makePersistenceReadiness().persistence_readiness_preview,
        persisted: true,
      },
    },
    "promotion_persistence_readiness_preview_persisted",
  ],
  [
    {
      persistence_readiness_preview: {
        ...makePersistenceReadiness().persistence_readiness_preview,
        dry_run_proof_can_be_sealed: false,
      },
    },
    "promotion_persistence_proof_seal_not_ready",
  ],
  [
    {
      persistence_readiness_preview: {
        ...makePersistenceReadiness().persistence_readiness_preview,
        dry_run_proof_can_be_persisted: true,
      },
    },
    "promotion_persistence_proof_persistence_allowed",
  ],
  [
    {
      dry_run_proof_preview: {
        ...makePersistenceReadiness().dry_run_proof_preview,
        persisted: true,
      },
    },
    "promotion_dry_run_proof_preview_already_persisted",
  ],
  [
    {
      append_only_production_write_plan: {
        ...makePersistenceReadiness().append_only_production_write_plan,
        write_performed: true,
      },
    },
    "promotion_persistence_append_only_plan_performed_write",
  ],
  [
    {
      backup_snapshot_plan: {
        ...makePersistenceReadiness().backup_snapshot_plan,
        executed: true,
      },
    },
    "promotion_persistence_backup_plan_executed",
  ],
  [
    {
      rollback_restore_plan: {
        ...makePersistenceReadiness().rollback_restore_plan,
        executed: true,
      },
    },
    "promotion_persistence_rollback_plan_executed",
  ],
]) {
  assertRejected(
    previewDryRunProofSeal({
      readiness: makePersistenceReadiness(override),
      userRequest: "seal dry-run proof",
    }),
    reason
  );
}

for (const [override, reason] of [
  [{ mode: "dry_run_proof_persist" }, "dry_run_proof_seal_contract_mode_invalid"],
  [{ source_persistence_readiness_required: false }, "dry_run_proof_seal_contract_required_field_invalid"],
  [{ seal_must_not_persist: false }, "dry_run_proof_seal_contract_required_field_invalid"],
  [{ no_production_write: false }, "dry_run_proof_seal_contract_required_field_invalid"],
  [{ no_active_engine_update: false }, "dry_run_proof_seal_contract_required_field_invalid"],
]) {
  assertRejected(
    previewDryRunProofSeal({
      readiness: makePersistenceReadiness(),
      userRequest: "seal dry-run proof",
      contract: makeSealContract(override),
    }),
    reason
  );
}

for (const [override, reason] of [
  [{ planned_production_candidate_id: "candidate_mismatch" }, "dry_run_proof_seal_candidate_id_mismatch"],
  [{ planned_candidate_content_hash: "content_hash_mismatch" }, "dry_run_proof_seal_candidate_content_hash_mismatch"],
  [{ planned_source_text_hash: "source_hash_mismatch" }, "dry_run_proof_seal_source_text_hash_mismatch"],
  [{ planned_source_route: "other_route" }, "dry_run_proof_seal_source_route_mismatch"],
  [{ source_route_link_verified: false }, "dry_run_proof_seal_linkage_verification_missing"],
]) {
  assertRejected(
    previewDryRunProofSeal({
      readiness: makePersistenceReadiness(override),
      userRequest: "seal dry-run proof",
    }),
    reason
  );
}

{
  const readiness = makePersistenceReadiness();
  const result = previewDryRunProofSeal({
    readiness,
    userRequest: "seal dry-run proof",
  });

  assert.equal(result.accepted, true);
  assert.equal(
    result.reason,
    "production_candidate_store_promotion_dry_run_proof_seal_preview_only"
  );
  assert.equal(result.seal_mode, "test_only_proof_seal_preview");
  assert.equal(result.source_candidate_id, readiness.source_candidate_id);
  assert.equal(
    result.planned_production_candidate_id,
    readiness.planned_production_candidate_id
  );
  assert.equal(result.candidate_id_verified, true);
  assert.equal(result.candidate_content_hash_verified, true);
  assert.equal(result.source_text_hash_verified, true);
  assert.equal(result.source_route_link_verified, true);

  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_write_blocked_by_default, true);
  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.production_candidate_saved, false);

  assert.equal(result.promotion_dry_run_plan_persisted, false);
  assert.equal(result.promotion_dry_run_proof_persisted, false);
  assert.equal(result.promotion_persistence_readiness_persisted, false);
  assert.equal(result.dry_run_proof_seal_generated, true);
  assert.equal(result.dry_run_proof_seal_persisted, false);
  assert.equal(result.proof_seal_audit_receipt_created, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.backup_snapshot_created, false);
  assert.equal(result.rollback_executed, false);

  assert.equal(
    result.dry_run_proof_seal_preview.kind,
    "production_candidate_store_promotion_dry_run_proof_seal_preview"
  );
  assert.ok(result.dry_run_proof_seal_preview.id.startsWith("dry_run_proof_seal_"));
  assert.equal(result.dry_run_proof_seal_preview.generated, true);
  assert.equal(result.dry_run_proof_seal_preview.persisted, false);
  assert.equal(result.dry_run_proof_seal_preview.seal_only, true);
  assert.equal(result.dry_run_proof_seal_preview.production_write_performed, false);
  assert.equal(result.dry_run_proof_seal_preview.production_promotion_performed, false);
  assert.equal(result.dry_run_proof_seal_preview.dry_run_plan_persisted, false);
  assert.equal(result.dry_run_proof_seal_preview.dry_run_proof_persisted, false);
  assert.equal(
    result.dry_run_proof_seal_preview.proof_seal_audit_receipt_created,
    false
  );
  assert.equal(result.dry_run_proof_seal_preview.guard_token_consumed, false);
  assert.equal(
    result.dry_run_proof_seal_preview.requires_future_explicit_proof_persistence_phase,
    true
  );
  assert.equal(
    result.dry_run_proof_seal_preview.requires_future_explicit_production_write_phase,
    true
  );

  assert.equal(
    result.dry_run_proof_seal_preview.payload.source_candidate_id,
    readiness.source_candidate_id
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.planned_production_candidate_id,
    readiness.planned_production_candidate_id
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.candidate_content_hash,
    readiness.candidate_content_hash
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.planned_candidate_content_hash,
    readiness.planned_candidate_content_hash
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.source_text_hash,
    readiness.source_text_hash
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.planned_source_text_hash,
    readiness.planned_source_text_hash
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.source_route,
    readiness.source_route
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.planned_source_route,
    readiness.planned_source_route
  );
  assert.equal(result.dry_run_proof_seal_preview.payload.append_only_plan_verified, true);
  assert.equal(
    result.dry_run_proof_seal_preview.payload.backup_snapshot_plan_verified,
    true
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.rollback_restore_plan_verified,
    true
  );
  assert.equal(
    result.dry_run_proof_seal_preview.payload.guard_token_unconsumed_verified,
    true
  );
  assert.equal(result.dry_run_proof_seal_preview.payload.proof_unpersisted_verified, true);

  assert.equal(result.sealed_contract_summary.persisted, false);
  assert.equal(result.sealed_contract_summary.candidate_identity_match, true);
  assert.equal(result.sealed_contract_summary.candidate_content_hash_match, true);
  assert.equal(result.sealed_contract_summary.source_text_hash_match, true);
  assert.equal(result.sealed_contract_summary.source_route_link_match, true);
  assert.equal(result.sealed_contract_summary.no_production_write, true);
  assert.equal(result.sealed_contract_summary.no_production_promotion, true);
  assert.equal(result.sealed_contract_summary.no_proof_persistence, true);
  assert.equal(result.sealed_contract_summary.no_approval_request, true);
  assert.equal(result.sealed_contract_summary.no_pending_engine_candidate, true);
  assert.equal(result.sealed_contract_summary.no_adoption, true);
  assert.equal(result.sealed_contract_summary.no_settlement, true);
  assert.equal(result.sealed_contract_summary.no_canon_update, true);
  assert.equal(result.sealed_contract_summary.no_active_engine_update, true);

  assertFalseFields(result);
  assertFalseFields(result.state_after);
}

{
  const readiness = makePersistenceReadiness({
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

  const result = previewDryRunProofSeal({
    readiness,
    userRequest:
      "seal dry-run proof, persist proof, write production, promote to production, approve it, create pending engine, adopt, settle into canon, and update active_engine",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.proof_persistence, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);

  for (const action of BLOCKED_ACTIONS) {
    assert.ok(result.blocked_direct_actions.includes(action), `${action} must be blocked`);
  }

  assert.equal(result.production_write_performed, false);
  assert.equal(result.production_promotion_performed, false);
  assert.equal(result.promotion_dry_run_proof_persisted, false);
  assert.equal(result.dry_run_proof_seal_persisted, false);
  assert.equal(result.proof_seal_audit_receipt_created, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assertFalseFields(result);
  assertFalseFields(result.state_after);
}

console.log(
  "Phase41L explicit candidate runtime write promotion dry-run proof seal smoke tests passed."
);
