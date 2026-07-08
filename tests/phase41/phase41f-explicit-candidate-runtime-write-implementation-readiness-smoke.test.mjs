import assert from "node:assert/strict";

const BASELINE_STATE = Object.freeze({
  candidate_saved: false,
  candidate_runtime_write_gate_opened: false,
  candidate_runtime_write_implementation_ready: false,
  candidate_runtime_write_performed: false,
  candidate_id_created: false,
  candidate_hash_created: false,
  append_only_write_performed: false,
  transaction_started: false,
  transaction_committed: false,
  rollback_performed: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  adoption_performed: false,
  settlement_performed: false,
  canon_updated: false,
  active_engine_updated: false,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoMutationSnapshot(snapshot) {
  assert.equal(snapshot.candidate_saved, false);
  assert.equal(snapshot.candidate_runtime_write_gate_opened, false);
  assert.equal(snapshot.candidate_runtime_write_implementation_ready, false);
  assert.equal(snapshot.candidate_runtime_write_performed, false);
  assert.equal(snapshot.candidate_id_created, false);
  assert.equal(snapshot.candidate_hash_created, false);
  assert.equal(snapshot.append_only_write_performed, false);
  assert.equal(snapshot.transaction_started, false);
  assert.equal(snapshot.transaction_committed, false);
  assert.equal(snapshot.rollback_performed, false);
  assert.equal(snapshot.approval_request_created, false);
  assert.equal(snapshot.pending_engine_candidate_created, false);
  assert.equal(snapshot.adoption_performed, false);
  assert.equal(snapshot.settlement_performed, false);
  assert.equal(snapshot.canon_updated, false);
  assert.equal(snapshot.active_engine_updated, false);
}

function classifyImplementationReadinessIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitReadinessPatterns = [
    /\bcheck\b.*\bruntime write implementation readiness\b/,
    /\bprepare\b.*\bruntime write implementation\b/,
    /\bverify\b.*\bruntime write implementation\b/,
    /\bvalidate\b.*\bruntime write implementation\b/,
    /\bopen\b.*\bimplementation readiness\b/,
    /\bimplementation readiness\b/,
  ];

  return {
    explicit: explicitReadinessPatterns.some((pattern) =>
      pattern.test(normalized)
    ),
    direct_approval_requested: /\bapproval\b|\bapprove\b/.test(normalized),
    direct_pending_engine_requested:
      /\bpending engine\b|\bpending_engine\b/.test(normalized),
    direct_adoption_requested: /\badopt\b/.test(normalized),
    direct_settlement_requested: /\bsettle\b/.test(normalized),
    direct_canon_requested: /\bcanon\b/.test(normalized),
    direct_active_engine_requested: /\bactive_engine\b|\bactive engine\b/.test(
      normalized
    ),
    direct_candidate_write_requested:
      /\bwrite\b.*\bcandidate\b|\bcandidate write\b/.test(normalized),
  };
}

function createAcceptedRuntimeWriteGate(overrides = {}) {
  return {
    accepted: true,
    reason: "explicit_candidate_runtime_write_gate_preview_only",
    candidate_runtime_write_gate_opened: true,
    gate_mode: "test_only_preview",
    would_perform_runtime_candidate_write: true,

    candidate_saved: false,
    candidate_runtime_write_performed: false,
    candidate_id_created: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    runtime_write_gate_preview: {
      kind: "candidate_runtime_write_gate_preview",
      persisted: false,
      id: null,
      source_persist_preview_kind: "candidate_persist_preview",
      source_kind: "chat_output",
      source_route: "chatgpt_native_full_neural_writing_handoff",
      source_text_hash_placeholder: "test-only-no-real-hash",
      requires_future_runtime_write_implementation: true,
    },

    direct_requests_detected: {
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
    },

    blocked_direct_actions: [
      "candidate_runtime_write",
      "candidate_persist",
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

function createValidImplementationContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_implementation_contract",
    mode: "readiness_only",
    target_store: "candidate_store",
    write_strategy: "append_only",
    explicit_user_request_required: true,
    source_runtime_write_gate_required: true,
    deterministic_candidate_id_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    transaction_required: true,
    rollback_required: true,
    no_approval_request: true,
    no_pending_engine_candidate: true,
    no_adoption: true,
    no_settlement: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ...overrides,
  };
}

function validateImplementationContract(contract) {
  if (!contract || contract.kind !== "candidate_runtime_write_implementation_contract") {
    return "implementation_contract_missing";
  }

  if (contract.mode !== "readiness_only") {
    return "implementation_contract_mode_invalid";
  }

  if (contract.target_store !== "candidate_store") {
    return "implementation_contract_target_store_invalid";
  }

  if (contract.write_strategy !== "append_only") {
    return "implementation_contract_write_strategy_invalid";
  }

  const requiredTrueFields = [
    "explicit_user_request_required",
    "source_runtime_write_gate_required",
    "deterministic_candidate_id_required",
    "candidate_content_hash_required",
    "source_text_hash_required",
    "transaction_required",
    "rollback_required",
    "no_approval_request",
    "no_pending_engine_candidate",
    "no_adoption",
    "no_settlement",
    "no_canon_update",
    "no_active_engine_update",
  ];

  for (const field of requiredTrueFields) {
    if (contract[field] !== true) {
      return "implementation_contract_required_field_invalid";
    }
  }

  return null;
}

function previewCandidateRuntimeWriteImplementationReadiness({
  runtimeWriteGateResult,
  userRequest,
  implementationContract = createValidImplementationContract(),
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const intent = classifyImplementationReadinessIntent(userRequest);

  if (!runtimeWriteGateResult || runtimeWriteGateResult.accepted !== true) {
    return {
      accepted: false,
      reason: "runtime_write_gate_not_accepted",
      implementation_readiness_opened: false,
      state_after: before,
    };
  }

  if (
    runtimeWriteGateResult.candidate_runtime_write_gate_opened !== true ||
    runtimeWriteGateResult.gate_mode !== "test_only_preview" ||
    !runtimeWriteGateResult.runtime_write_gate_preview ||
    runtimeWriteGateResult.runtime_write_gate_preview.kind !==
      "candidate_runtime_write_gate_preview" ||
    runtimeWriteGateResult.runtime_write_gate_preview.persisted !== false ||
    runtimeWriteGateResult.runtime_write_gate_preview.id !== null
  ) {
    return {
      accepted: false,
      reason: "runtime_write_gate_contract_invalid",
      implementation_readiness_opened: false,
      state_after: before,
    };
  }

  if (!intent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_implementation_readiness_request",
      implementation_readiness_opened: false,
      state_after: before,
    };
  }

  const contractError = validateImplementationContract(implementationContract);
  if (contractError) {
    return {
      accepted: false,
      reason: contractError,
      implementation_readiness_opened: false,
      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "candidate_runtime_write_implementation_readiness_preview_only",
    implementation_readiness_opened: true,
    readiness_mode: "test_only_preview",
    would_enable_future_runtime_candidate_write_implementation: true,

    candidate_saved: false,
    candidate_runtime_write_implementation_ready: false,
    candidate_runtime_write_performed: false,
    candidate_id_created: false,
    candidate_hash_created: false,
    append_only_write_performed: false,
    transaction_started: false,
    transaction_committed: false,
    rollback_performed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    implementation_readiness_preview: {
      kind: "candidate_runtime_write_implementation_readiness_preview",
      persisted: false,
      id: null,
      source_runtime_write_gate_kind:
        runtimeWriteGateResult.runtime_write_gate_preview.kind,
      source_kind: runtimeWriteGateResult.runtime_write_gate_preview.source_kind,
      source_route: runtimeWriteGateResult.runtime_write_gate_preview.source_route,
      implementation_contract_kind: implementationContract.kind,
      write_strategy: implementationContract.write_strategy,
      transaction_required: implementationContract.transaction_required,
      rollback_required: implementationContract.rollback_required,
      deterministic_candidate_id_required:
        implementationContract.deterministic_candidate_id_required,
      candidate_content_hash_required:
        implementationContract.candidate_content_hash_required,
      requires_future_runtime_write_implementation: true,
    },

    direct_requests_detected: {
      approval:
        runtimeWriteGateResult.direct_requests_detected.approval ||
        intent.direct_approval_requested,
      pending_engine:
        runtimeWriteGateResult.direct_requests_detected.pending_engine ||
        intent.direct_pending_engine_requested,
      adoption:
        runtimeWriteGateResult.direct_requests_detected.adoption ||
        intent.direct_adoption_requested,
      settlement:
        runtimeWriteGateResult.direct_requests_detected.settlement ||
        intent.direct_settlement_requested,
      canon:
        runtimeWriteGateResult.direct_requests_detected.canon ||
        intent.direct_canon_requested,
      active_engine:
        runtimeWriteGateResult.direct_requests_detected.active_engine ||
        intent.direct_active_engine_requested,
      candidate_write: intent.direct_candidate_write_requested,
    },

    blocked_direct_actions: [
      "candidate_runtime_write",
      "candidate_persist",
      "candidate_store_append",
      "transaction_start",
      "transaction_commit",
      "approval_request_create",
      "pending_engine_candidate_create",
      "adoption",
      "settlement",
      "canon_update",
      "active_engine_update",
    ],

    next_allowed_phase:
      "phase41g_or_later_explicit_candidate_runtime_write_minimal_implementation",
    state_after: before,
  };
}

{
  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: null,
    userRequest: "check runtime write implementation readiness",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "runtime_write_gate_not_accepted");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "looks good, continue",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "missing_explicit_implementation_readiness_request");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
  });

  assert.equal(result.accepted, true);
  assert.equal(
    result.reason,
    "candidate_runtime_write_implementation_readiness_preview_only"
  );
  assert.equal(result.implementation_readiness_opened, true);
  assert.equal(result.readiness_mode, "test_only_preview");
  assert.equal(
    result.would_enable_future_runtime_candidate_write_implementation,
    true
  );

  assert.equal(result.candidate_saved, false);
  assert.equal(result.candidate_runtime_write_implementation_ready, false);
  assert.equal(result.candidate_runtime_write_performed, false);
  assert.equal(result.candidate_id_created, false);
  assert.equal(result.candidate_hash_created, false);
  assert.equal(result.append_only_write_performed, false);
  assert.equal(result.transaction_started, false);
  assert.equal(result.transaction_committed, false);
  assert.equal(result.rollback_performed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assert.equal(
    result.implementation_readiness_preview.kind,
    "candidate_runtime_write_implementation_readiness_preview"
  );
  assert.equal(result.implementation_readiness_preview.persisted, false);
  assert.equal(result.implementation_readiness_preview.id, null);
  assert.equal(
    result.implementation_readiness_preview.source_runtime_write_gate_kind,
    "candidate_runtime_write_gate_preview"
  );
  assert.equal(
    result.implementation_readiness_preview.write_strategy,
    "append_only"
  );
  assert.equal(
    result.implementation_readiness_preview.transaction_required,
    true
  );
  assert.equal(result.implementation_readiness_preview.rollback_required, true);
  assert.equal(
    result.implementation_readiness_preview
      .deterministic_candidate_id_required,
    true
  );
  assert.equal(
    result.implementation_readiness_preview.candidate_content_hash_required,
    true
  );

  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate({
    direct_requests_detected: {
      approval: true,
      pending_engine: true,
      adoption: true,
      settlement: true,
      canon: true,
      active_engine: true,
    },
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest:
      "check runtime write implementation readiness, write candidate, approve it, create pending engine, adopt, settle into canon, and update active_engine",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  assert.equal(result.direct_requests_detected.candidate_write, true);

  assert.ok(result.blocked_direct_actions.includes("candidate_runtime_write"));
  assert.ok(result.blocked_direct_actions.includes("candidate_persist"));
  assert.ok(result.blocked_direct_actions.includes("candidate_store_append"));
  assert.ok(result.blocked_direct_actions.includes("transaction_start"));
  assert.ok(result.blocked_direct_actions.includes("transaction_commit"));
  assert.ok(result.blocked_direct_actions.includes("approval_request_create"));
  assert.ok(
    result.blocked_direct_actions.includes("pending_engine_candidate_create")
  );
  assert.ok(result.blocked_direct_actions.includes("adoption"));
  assert.ok(result.blocked_direct_actions.includes("settlement"));
  assert.ok(result.blocked_direct_actions.includes("canon_update"));
  assert.ok(result.blocked_direct_actions.includes("active_engine_update"));

  assert.equal(result.candidate_runtime_write_performed, false);
  assert.equal(result.append_only_write_performed, false);
  assert.equal(result.transaction_started, false);
  assert.equal(result.transaction_committed, false);
  assert.equal(result.approval_request_created, false);
  assert.equal(result.pending_engine_candidate_created, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate({
    gate_mode: "runtime_write_performed",
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "runtime_write_gate_contract_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate({
    runtime_write_gate_preview: {
      kind: "candidate_runtime_write_gate_preview",
      persisted: true,
      id: "candidate-runtime-write-gate-001",
      source_kind: "chat_output",
      source_route: "chatgpt_native_full_neural_writing_handoff",
    },
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "runtime_write_gate_contract_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const contract = createValidImplementationContract({
    write_strategy: "overwrite",
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
    implementationContract: contract,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "implementation_contract_write_strategy_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const contract = createValidImplementationContract({
    transaction_required: false,
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
    implementationContract: contract,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "implementation_contract_required_field_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const contract = createValidImplementationContract({
    rollback_required: false,
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
    implementationContract: contract,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "implementation_contract_required_field_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const gate = createAcceptedRuntimeWriteGate();
  const contract = createValidImplementationContract({
    no_canon_update: false,
  });

  const result = previewCandidateRuntimeWriteImplementationReadiness({
    runtimeWriteGateResult: gate,
    userRequest: "check runtime write implementation readiness",
    implementationContract: contract,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "implementation_contract_required_field_invalid");
  assert.equal(result.implementation_readiness_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

console.log(
  "Phase41F explicit candidate runtime write implementation readiness smoke tests passed."
);
