import assert from "node:assert/strict";

const BASELINE_STATE = Object.freeze({
  candidate_saved: false,
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

  const directAdoptionRequested = /\badopt\b/.test(normalized);
  const directSettlementRequested = /\bsettle\b/.test(normalized);
  const directCanonRequested = /\bcanon\b/.test(normalized);
  const directActiveEngineRequested = /\bactive_engine\b|\bactive engine\b/.test(
    normalized
  );

  return {
    explicit,
    direct_adoption_requested: directAdoptionRequested,
    direct_settlement_requested: directSettlementRequested,
    direct_canon_requested: directCanonRequested,
    direct_active_engine_requested: directActiveEngineRequested,
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
    would_open_candidate_workflow: true,

    candidate_write_performed: false,
    approval_request_write_performed: false,
    pending_engine_candidate_write_performed: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    direct_requests_detected: {
      adoption: intent.direct_adoption_requested,
      settlement: intent.direct_settlement_requested,
      canon: intent.direct_canon_requested,
      active_engine: intent.direct_active_engine_requested,
    },

    blocked_direct_actions: [
      "candidate_write",
      "approval_request_write",
      "pending_engine_candidate_write",
      "adoption",
      "settlement",
      "canon_update",
      "active_engine_update",
    ],

    next_allowed_phase: "phase41c_or_later_explicit_candidate_write_boundary",
    state_after: before,
  };
}

{
  const output = createNativeChatOutput();

  assert.equal(output.kind, "chat_output");
  assert.equal(output.candidate_id, null);
  assert.equal(output.approval_request_id, null);
  assert.equal(output.pending_engine_candidate_id, null);
  assert.equal(output.adoption_id, null);
  assert.equal(output.settlement_id, null);
  assert.equal(output.canon_update_id, null);
  assert.equal(output.active_engine_update_id, null);
}

{
  const output = createNativeChatOutput();
  const result = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest: "looks good, continue",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "missing_explicit_candidate_workflow_request");
  assert.equal(result.intake_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

{
  const output = createNativeChatOutput();
  const result = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest: "save this native output as a candidate for review",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.intake_opened, true);
  assert.equal(result.intake_mode, "test_only_preview");
  assert.equal(result.would_open_candidate_workflow, true);

  assert.equal(result.candidate_write_performed, false);
  assert.equal(result.approval_request_write_performed, false);
  assert.equal(result.pending_engine_candidate_write_performed, false);
  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assertNoMutationSnapshot(result.state_after);
}

{
  const output = createNativeChatOutput();
  const result = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: output,
    userRequest:
      "adopt this output, settle it into canon, and update active_engine now",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.intake_opened, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);

  assert.ok(result.blocked_direct_actions.includes("adoption"));
  assert.ok(result.blocked_direct_actions.includes("settlement"));
  assert.ok(result.blocked_direct_actions.includes("canon_update"));
  assert.ok(result.blocked_direct_actions.includes("active_engine_update"));

  assert.equal(result.adoption_performed, false);
  assert.equal(result.settlement_performed, false);
  assert.equal(result.canon_update_performed, false);
  assert.equal(result.active_engine_update_performed, false);

  assertNoMutationSnapshot(result.state_after);
}

{
  const invalidInput = {
    kind: "candidate",
    text: "This is already a candidate-like object.",
  };

  const result = previewExplicitCandidateWorkflowIntake({
    nativeChatOutput: invalidInput,
    userRequest: "save this as a candidate",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "input_is_not_native_chat_output");
  assert.equal(result.intake_opened, false);
  assertNoMutationSnapshot(result.state_after);
}

console.log(
  "Phase41B explicit candidate workflow intake boundary smoke tests passed."
);
