import assert from "node:assert/strict";

const BASELINE_STATE = Object.freeze({
  candidate_saved: false,
  candidate_write_preview_created: false,
  candidate_persist_preview_created: false,
  candidate_runtime_write_gate_opened: false,
  candidate_runtime_write_performed: false,
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

function createNativeChatOutput(overrides = {}) {
  return {
    kind: "chat_output",
    route: "chatgpt_native_full_neural_writing_handoff",
    text: "Chapter title\n\nA safe story-like native chat output body.",
    candidate_id: null,
    candidate_preview_id: null,
    candidate_persist_preview_id: null,
    candidate_runtime_write_gate_id: null,
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
    ...overrides,
  };
}

function assertNoMutationSnapshot(snapshot) {
  assert.equal(snapshot.candidate_saved, false);
  assert.equal(snapshot.candidate_write_preview_created, false);
  assert.equal(snapshot.candidate_persist_preview_created, false);
  assert.equal(snapshot.candidate_runtime_write_gate_opened, false);
  assert.equal(snapshot.candidate_runtime_write_performed, false);
  assert.equal(snapshot.approval_request_created, false);
  assert.equal(snapshot.pending_engine_candidate_created, false);
  assert.equal(snapshot.adoption_performed, false);
  assert.equal(snapshot.settlement_performed, false);
  assert.equal(snapshot.canon_updated, false);
  assert.equal(snapshot.active_engine_updated, false);
}

function classifyCandidateWorkflowIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitCandidatePatterns = [
    /\bsave\b.*\b(candidate|draft|chat output|native output|chapter output)\b/,
    /\bstore\b.*\b(candidate|draft|chat output|native output|chapter output)\b/,
    /\bpersist\b.*\b(candidate|draft|chat output|native output|chapter output)\b/,
    /\bput\b.*\b(candidate workflow|candidate queue|candidate intake)\b/,
    /\benter\b.*\b(candidate workflow|candidate queue|candidate intake)\b/,
    /\bmove\b.*\b(candidate workflow|candidate queue|candidate intake)\b/,
    /\bcreate\b.*\bcandidate\b/,
    /\bmake\b.*\bcandidate\b/,
    /\bturn\b.*\b(candidate|candidate workflow)\b/,
    /\badopt\b/,
    /\baccept\b.*\b(candidate|this output|chapter output|native output)\b/,
    /\bsettle\b/,
  ];

  const explicit = explicitCandidatePatterns.some((pattern) =>
    pattern.test(normalized)
  );

  return {
    explicit,
    direct_adoption_requested: /\badopt\b/.test(normalized),
    direct_settlement_requested: /\bsettle\b/.test(normalized),
    direct_canon_requested: /\bcanon\b/.test(normalized),
    direct_active_engine_requested: /\bactive_engine\b|\bactive engine\b/.test(
      normalized
    ),
    direct_approval_requested: /\bapproval\b|\bapprove\b/.test(normalized),
    direct_pending_engine_requested:
      /\bpending engine\b|\bpending_engine\b/.test(normalized),
  };
}

function classifyCandidatePersistIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitPersistPatterns = [
    /\bpersist\b.*\b(candidate|candidate record|candidate preview)\b/,
    /\bsave\b.*\b(candidate|candidate record|candidate preview)\b/,
    /\bwrite\b.*\b(candidate|candidate record|candidate preview)\b/,
    /\bstore\b.*\b(candidate|candidate record|candidate preview)\b/,
    /\bcommit\b.*\b(candidate|candidate record|candidate preview)\b/,
    /\bcreate\b.*\bcandidate record\b/,
  ];

  return {
    explicit: explicitPersistPatterns.some((pattern) => pattern.test(normalized)),
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

function classifyRuntimeWriteIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitRuntimeWritePatterns = [
    /\bopen\b.*\bcandidate runtime write gate\b/,
    /\bopen\b.*\bruntime write gate\b/,
    /\bruntime\b.*\bwrite\b.*\bcandidate\b/,
    /\bwrite\b.*\bcandidate\b.*\bruntime\b/,
    /\bperform\b.*\bcandidate write\b/,
    /\bexecute\b.*\bcandidate write\b/,
    /\bstart\b.*\bruntime candidate write\b/,
  ];

  return {
    explicit: explicitRuntimeWritePatterns.some((pattern) =>
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
  };
}

function mergeDirectRequests(...items) {
  return {
    approval: items.some((item) => item?.approval),
    pending_engine: items.some((item) => item?.pending_engine),
    adoption: items.some((item) => item?.adoption),
    settlement: items.some((item) => item?.settlement),
    canon: items.some((item) => item?.canon),
    active_engine: items.some((item) => item?.active_engine),
  };
}

function previewExplicitCandidateWorkflowIntake({
  nativeChatOutput,
  userRequest,
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const intent = classifyCandidateWorkflowIntent(userRequest);

  if (!nativeChatOutput || nativeChatOutput.kind !== "chat_output") {
    return {
      accepted: false,
      reason: "input_is_not_native_chat_output",
      intake_opened: false,
      state_after: before,
    };
  }

  if (!intent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_candidate_workflow_request",
      intake_opened: false,
      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "explicit_candidate_workflow_intake_preview_only",
    intake_opened: true,
    intake_mode: "test_only_preview",
    source_kind: nativeChatOutput.kind,
    source_route: nativeChatOutput.route,
    source_text_hash_placeholder: "test-only-no-real-hash",
    direct_requests_detected: {
      approval: intent.direct_approval_requested,
      pending_engine: intent.direct_pending_engine_requested,
      adoption: intent.direct_adoption_requested,
      settlement: intent.direct_settlement_requested,
      canon: intent.direct_canon_requested,
      active_engine: intent.direct_active_engine_requested,
    },
    state_after: before,
  };
}

function previewExplicitCandidateWriteBoundary({
  intakeResult,
  state = BASELINE_STATE,
}) {
  const before = clone(state);

  if (!intakeResult || intakeResult.accepted !== true) {
    return {
      accepted: false,
      reason: "candidate_intake_not_accepted",
      candidate_write_preview_opened: false,
      state_after: before,
    };
  }

  if (
    intakeResult.intake_opened !== true ||
    intakeResult.intake_mode !== "test_only_preview"
  ) {
    return {
      accepted: false,
      reason: "candidate_intake_contract_invalid",
      candidate_write_preview_opened: false,
      state_after: before,
    };
  }

  if (intakeResult.source_kind !== "chat_output") {
    return {
      accepted: false,
      reason: "candidate_write_source_is_not_native_chat_output",
      candidate_write_preview_opened: false,
      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "explicit_candidate_write_preview_boundary_only",
    candidate_write_preview_opened: true,
    write_mode: "test_only_preview",
    would_create_candidate_record: true,

    candidate_saved: false,
    candidate_write_performed: false,
    candidate_id_created: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    candidate_record_preview: {
      kind: "candidate_preview",
      persisted: false,
      id: null,
      source_kind: intakeResult.source_kind,
      source_route: intakeResult.source_route,
      source_text_hash_placeholder: intakeResult.source_text_hash_placeholder,
      requires_future_explicit_persist_phase: true,
    },

    direct_requests_detected: intakeResult.direct_requests_detected,
    state_after: before,
  };
}

function previewExplicitCandidatePersistBoundary({
  writePreviewResult,
  userRequest,
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const persistIntent = classifyCandidatePersistIntent(userRequest);

  if (!writePreviewResult || writePreviewResult.accepted !== true) {
    return {
      accepted: false,
      reason: "candidate_write_preview_not_accepted",
      candidate_persist_preview_opened: false,
      state_after: before,
    };
  }

  if (
    writePreviewResult.candidate_write_preview_opened !== true ||
    writePreviewResult.write_mode !== "test_only_preview" ||
    !writePreviewResult.candidate_record_preview ||
    writePreviewResult.candidate_record_preview.kind !== "candidate_preview" ||
    writePreviewResult.candidate_record_preview.persisted !== false ||
    writePreviewResult.candidate_record_preview.id !== null
  ) {
    return {
      accepted: false,
      reason: "candidate_write_preview_contract_invalid",
      candidate_persist_preview_opened: false,
      state_after: before,
    };
  }

  if (!persistIntent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_candidate_persist_request",
      candidate_persist_preview_opened: false,
      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "explicit_candidate_persist_boundary_preview_only",
    candidate_persist_preview_opened: true,
    persist_mode: "test_only_preview",
    would_persist_candidate_record: true,

    candidate_saved: false,
    candidate_persist_performed: false,
    candidate_id_created: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    candidate_persist_preview: {
      kind: "candidate_persist_preview",
      persisted: false,
      id: null,
      source_candidate_preview_kind:
        writePreviewResult.candidate_record_preview.kind,
      source_kind: writePreviewResult.candidate_record_preview.source_kind,
      source_route: writePreviewResult.candidate_record_preview.source_route,
      requires_future_runtime_write_gate: true,
    },

    direct_requests_detected: {
      approval:
        writePreviewResult.direct_requests_detected.approval ||
        persistIntent.direct_approval_requested,
      pending_engine:
        writePreviewResult.direct_requests_detected.pending_engine ||
        persistIntent.direct_pending_engine_requested,
      adoption:
        writePreviewResult.direct_requests_detected.adoption ||
        persistIntent.direct_adoption_requested,
      settlement:
        writePreviewResult.direct_requests_detected.settlement ||
        persistIntent.direct_settlement_requested,
      canon:
        writePreviewResult.direct_requests_detected.canon ||
        persistIntent.direct_canon_requested,
      active_engine:
        writePreviewResult.direct_requests_detected.active_engine ||
        persistIntent.direct_active_engine_requested,
    },

    state_after: before,
  };
}

function previewExplicitCandidateRuntimeWriteGate({
  persistPreviewResult,
  userRequest,
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const runtimeWriteIntent = classifyRuntimeWriteIntent(userRequest);

  if (!persistPreviewResult || persistPreviewResult.accepted !== true) {
    return {
      accepted: false,
      reason: "candidate_persist_preview_not_accepted",
      candidate_runtime_write_gate_opened: false,
      state_after: before,
    };
  }

  if (
    persistPreviewResult.candidate_persist_preview_opened !== true ||
    persistPreviewResult.persist_mode !== "test_only_preview" ||
    !persistPreviewResult.candidate_persist_preview ||
    persistPreviewResult.candidate_persist_preview.kind !==
      "candidate_persist_preview" ||
    persistPreviewResult.candidate_persist_preview.persisted !== false ||
    persistPreviewResult.candidate_persist_preview.id !== null
  ) {
    return {
      accepted: false,
      reason: "candidate_persist_preview_contract_invalid",
      candidate_runtime_write_gate_opened: false,
      state_after: before,
    };
  }

  if (!runtimeWriteIntent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_candidate_runtime_write_request",
      candidate_runtime_write_gate_opened: false,
      state_after: before,
    };
  }

  const directRuntimeRequests = {
    approval: runtimeWriteIntent.direct_approval_requested,
    pending_engine: runtimeWriteIntent.direct_pending_engine_requested,
    adoption: runtimeWriteIntent.direct_adoption_requested,
    settlement: runtimeWriteIntent.direct_settlement_requested,
    canon: runtimeWriteIntent.direct_canon_requested,
    active_engine: runtimeWriteIntent.direct_active_engine_requested,
  };

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
      source_persist_preview_kind:
        persistPreviewResult.candidate_persist_preview.kind,
      source_kind: persistPreviewResult.candidate_persist_preview.source_kind,
      source_route: persistPreviewResult.candidate_persist_preview.source_route,
      requires_future_runtime_write_implementation: true,
    },

    direct_requests_detected: mergeDirectRequests(
      persistPreviewResult.direct_requests_detected,
      directRuntimeRequests
    ),

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

    next_allowed_phase: "phase41f_or_later_explicit_candidate_write_implementation",
    state_after: before,
  };
}

{
  const output = createNativeChatOutput();

  assert.equal(output.kind, "chat_output");
  assert.equal(output.candidate_id, null);
  assert.equal(output.candidate_preview_id, null);
  assert.equal(output.candidate_persist_preview_id, null);
  assert.equal(output.candidate_runtime_write_gate_id, null);
  assert.equal(output.approval_request_id, null);
  assert.equal(output.pending_engine_candidate_id, null);
  assert.equal(output.adoption_id, null);
  assert.equal(output.settlement_id, null);
  assert.equal(output.canon_update_id, null);
  assert.equal(output.active_engine_update_id, null);
}

{
  const result = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: null,
    userRequest: "open candidate runtime write gate",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "candidate_persist_preview_not_accepted");
  assert.equal(result.candidate_runtime_write_gate_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const output = createNativeChatOutput();
  const intake = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest: "save this native output as a candidate for review",
  });
  const writePreview = previewExplicitCandidateWriteBoundary({
    intakeResult: intake,
  });
  const persistPreview = previewExplicitCandidatePersistBoundary({
    writePreviewResult: writePreview,
    userRequest: "looks good, continue",
  });
  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: persistPreview,
    userRequest: "open candidate runtime write gate",
  });

  assert.equal(intake.accepted, true);
  assert.equal(writePreview.accepted, true);
  assert.equal(persistPreview.accepted, false);
  assert.equal(gate.accepted, false);
  assert.equal(gate.reason, "candidate_persist_preview_not_accepted");
  assert.equal(gate.candidate_runtime_write_gate_opened, false);
  assertNoMutationSnapshot(gate.state_after);
}

{
  const output = createNativeChatOutput();
  const intake = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest: "save this native output as a candidate for review",
  });
  const writePreview = previewExplicitCandidateWriteBoundary({
    intakeResult: intake,
  });
  const persistPreview = previewExplicitCandidatePersistBoundary({
    writePreviewResult: writePreview,
    userRequest: "persist this candidate preview as a candidate record",
  });
  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: persistPreview,
    userRequest: "looks good, continue",
  });

  assert.equal(intake.accepted, true);
  assert.equal(writePreview.accepted, true);
  assert.equal(persistPreview.accepted, true);
  assert.equal(gate.accepted, false);
  assert.equal(gate.reason, "missing_explicit_candidate_runtime_write_request");
  assert.equal(gate.candidate_runtime_write_gate_opened, false);
  assertNoMutationSnapshot(gate.state_after);
}

{
  const output = createNativeChatOutput();
  const intake = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest: "save this native output as a candidate for review",
  });
  const writePreview = previewExplicitCandidateWriteBoundary({
    intakeResult: intake,
  });
  const persistPreview = previewExplicitCandidatePersistBoundary({
    writePreviewResult: writePreview,
    userRequest: "persist this candidate preview as a candidate record",
  });
  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: persistPreview,
    userRequest: "open candidate runtime write gate",
  });

  assert.equal(intake.accepted, true);
  assert.equal(writePreview.accepted, true);
  assert.equal(persistPreview.accepted, true);
  assert.equal(gate.accepted, true);
  assert.equal(gate.reason, "explicit_candidate_runtime_write_gate_preview_only");
  assert.equal(gate.candidate_runtime_write_gate_opened, true);
  assert.equal(gate.gate_mode, "test_only_preview");
  assert.equal(gate.would_perform_runtime_candidate_write, true);

  assert.equal(gate.candidate_saved, false);
  assert.equal(gate.candidate_runtime_write_performed, false);
  assert.equal(gate.candidate_id_created, false);
  assert.equal(gate.approval_request_created, false);
  assert.equal(gate.pending_engine_candidate_created, false);
  assert.equal(gate.adoption_performed, false);
  assert.equal(gate.settlement_performed, false);
  assert.equal(gate.canon_update_performed, false);
  assert.equal(gate.active_engine_update_performed, false);

  assert.equal(
    gate.runtime_write_gate_preview.kind,
    "candidate_runtime_write_gate_preview"
  );
  assert.equal(gate.runtime_write_gate_preview.persisted, false);
  assert.equal(gate.runtime_write_gate_preview.id, null);
  assert.equal(
    gate.runtime_write_gate_preview.source_persist_preview_kind,
    "candidate_persist_preview"
  );
  assert.equal(
    gate.runtime_write_gate_preview.requires_future_runtime_write_implementation,
    true
  );

  assertNoMutationSnapshot(gate.state_after);
}

{
  const output = createNativeChatOutput();
  const intake = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest:
      "save this as candidate, create approval, create pending engine, adopt, settle into canon, and update active_engine",
  });
  const writePreview = previewExplicitCandidateWriteBoundary({
    intakeResult: intake,
  });
  const persistPreview = previewExplicitCandidatePersistBoundary({
    writePreviewResult: writePreview,
    userRequest:
      "persist this candidate preview, approve it, create pending engine, adopt it, settle it into canon, and update active_engine",
  });
  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: persistPreview,
    userRequest:
      "open candidate runtime write gate, approve it, create pending engine, adopt, settle into canon, and update active_engine",
  });

  assert.equal(gate.accepted, true);
  assert.equal(gate.direct_requests_detected.approval, true);
  assert.equal(gate.direct_requests_detected.pending_engine, true);
  assert.equal(gate.direct_requests_detected.adoption, true);
  assert.equal(gate.direct_requests_detected.settlement, true);
  assert.equal(gate.direct_requests_detected.canon, true);
  assert.equal(gate.direct_requests_detected.active_engine, true);

  assert.ok(gate.blocked_direct_actions.includes("candidate_runtime_write"));
  assert.ok(gate.blocked_direct_actions.includes("candidate_persist"));
  assert.ok(gate.blocked_direct_actions.includes("approval_request_create"));
  assert.ok(
    gate.blocked_direct_actions.includes("pending_engine_candidate_create")
  );
  assert.ok(gate.blocked_direct_actions.includes("adoption"));
  assert.ok(gate.blocked_direct_actions.includes("settlement"));
  assert.ok(gate.blocked_direct_actions.includes("canon_update"));
  assert.ok(gate.blocked_direct_actions.includes("active_engine_update"));

  assert.equal(gate.candidate_runtime_write_performed, false);
  assert.equal(gate.approval_request_created, false);
  assert.equal(gate.pending_engine_candidate_created, false);
  assert.equal(gate.adoption_performed, false);
  assert.equal(gate.settlement_performed, false);
  assert.equal(gate.canon_update_performed, false);
  assert.equal(gate.active_engine_update_performed, false);

  assertNoMutationSnapshot(gate.state_after);
}

{
  const tamperedPersistPreview = {
    accepted: true,
    candidate_persist_preview_opened: true,
    persist_mode: "persisted",
    candidate_persist_preview: {
      kind: "candidate_persist_preview",
      persisted: false,
      id: null,
    },
    direct_requests_detected: {},
  };

  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: tamperedPersistPreview,
    userRequest: "open candidate runtime write gate",
  });

  assert.equal(gate.accepted, false);
  assert.equal(gate.reason, "candidate_persist_preview_contract_invalid");
  assert.equal(gate.candidate_runtime_write_gate_opened, false);
  assertNoMutationSnapshot(gate.state_after);
}

{
  const tamperedPersistPreview = {
    accepted: true,
    candidate_persist_preview_opened: true,
    persist_mode: "test_only_preview",
    candidate_persist_preview: {
      kind: "candidate_persist_preview",
      persisted: true,
      id: "candidate-001",
    },
    direct_requests_detected: {},
  };

  const gate = previewExplicitCandidateRuntimeWriteGate({
    persistPreviewResult: tamperedPersistPreview,
    userRequest: "open candidate runtime write gate",
  });

  assert.equal(gate.accepted, false);
  assert.equal(gate.reason, "candidate_persist_preview_contract_invalid");
  assert.equal(gate.candidate_runtime_write_gate_opened, false);
  assertNoMutationSnapshot(gate.state_after);
}

console.log(
  "Phase41E explicit candidate runtime write gate smoke tests passed."
);
