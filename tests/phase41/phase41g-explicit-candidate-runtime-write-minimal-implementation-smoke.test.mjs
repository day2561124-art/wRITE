import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  sandbox_candidate_saved: false,
  candidate_runtime_write_performed: false,
  candidate_id_created: false,
  candidate_hash_created: false,
  source_text_hash_created: false,
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

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function mutationFlag(snapshot, legacyField, performedField) {
  if (Object.prototype.hasOwnProperty.call(snapshot, legacyField)) {
    return snapshot[legacyField];
  }

  if (Object.prototype.hasOwnProperty.call(snapshot, performedField)) {
    return snapshot[performedField];
  }

  return undefined;
}

function assertNoProductionMutation(snapshot) {
  assert.equal(snapshot.production_candidate_saved, false);
  assert.equal(snapshot.approval_request_created, false);
  assert.equal(snapshot.pending_engine_candidate_created, false);
  assert.equal(snapshot.adoption_performed, false);
  assert.equal(snapshot.settlement_performed, false);
  assert.equal(
    mutationFlag(snapshot, "canon_updated", "canon_update_performed"),
    false
  );
  assert.equal(
    mutationFlag(
      snapshot,
      "active_engine_updated",
      "active_engine_update_performed"
    ),
    false
  );
}

function assertNoWriteMutation(snapshot) {
  assertNoProductionMutation(snapshot);
  assert.equal(snapshot.sandbox_candidate_saved, false);
  assert.equal(snapshot.candidate_runtime_write_performed, false);
  assert.equal(snapshot.candidate_id_created, false);
  assert.equal(snapshot.candidate_hash_created, false);
  assert.equal(snapshot.source_text_hash_created, false);
  assert.equal(snapshot.append_only_write_performed, false);
  assert.equal(snapshot.transaction_started, false);
  assert.equal(snapshot.transaction_committed, false);
  assert.equal(snapshot.rollback_performed, false);
}

function createNativeChatOutput(overrides = {}) {
  return {
    kind: "chat_output",
    route: "chatgpt_native_full_neural_writing_handoff",
    text: "Chapter title\n\nA safe story-like native chat output body.",
    ...overrides,
  };
}

function createAcceptedImplementationReadiness(overrides = {}) {
  return {
    accepted: true,
    reason: "candidate_runtime_write_implementation_readiness_preview_only",
    implementation_readiness_opened: true,
    readiness_mode: "test_only_preview",
    would_enable_future_runtime_candidate_write_implementation: true,

    implementation_readiness_preview: {
      kind: "candidate_runtime_write_implementation_readiness_preview",
      persisted: false,
      id: null,
      source_runtime_write_gate_kind: "candidate_runtime_write_gate_preview",
      source_kind: "chat_output",
      source_route: "chatgpt_native_full_neural_writing_handoff",
      implementation_contract_kind:
        "candidate_runtime_write_implementation_contract",
      write_strategy: "append_only",
      transaction_required: true,
      rollback_required: true,
      deterministic_candidate_id_required: true,
      candidate_content_hash_required: true,
      source_text_hash_required: true,
      requires_future_runtime_write_implementation: true,
    },

    direct_requests_detected: {
      approval: false,
      pending_engine: false,
      adoption: false,
      settlement: false,
      canon: false,
      active_engine: false,
      candidate_write: false,
    },

    blocked_direct_actions: [
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

function classifyRuntimeCandidateWriteIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitWritePatterns = [
    /\bperform\b.*\bruntime candidate write\b/,
    /\bexecute\b.*\bruntime candidate write\b/,
    /\bwrite\b.*\bcandidate\b.*\bsandbox\b/,
    /\bappend\b.*\bcandidate\b.*\bstore\b/,
    /\bminimal\b.*\bruntime candidate write\b/,
    /\bruntime candidate write\b/,
  ];

  return {
    explicit: explicitWritePatterns.some((pattern) => pattern.test(normalized)),
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

function validateImplementationReadiness(readinessResult) {
  if (!readinessResult || readinessResult.accepted !== true) {
    return "implementation_readiness_not_accepted";
  }

  if (
    readinessResult.implementation_readiness_opened !== true ||
    readinessResult.readiness_mode !== "test_only_preview" ||
    !readinessResult.implementation_readiness_preview ||
    readinessResult.implementation_readiness_preview.kind !==
      "candidate_runtime_write_implementation_readiness_preview" ||
    readinessResult.implementation_readiness_preview.persisted !== false ||
    readinessResult.implementation_readiness_preview.id !== null
  ) {
    return "implementation_readiness_contract_invalid";
  }

  const preview = readinessResult.implementation_readiness_preview;

  if (preview.write_strategy !== "append_only") {
    return "implementation_readiness_write_strategy_invalid";
  }

  if (preview.transaction_required !== true) {
    return "implementation_readiness_transaction_missing";
  }

  if (preview.rollback_required !== true) {
    return "implementation_readiness_rollback_missing";
  }

  if (preview.deterministic_candidate_id_required !== true) {
    return "implementation_readiness_candidate_id_missing";
  }

  if (preview.candidate_content_hash_required !== true) {
    return "implementation_readiness_candidate_hash_missing";
  }

  if (preview.source_text_hash_required !== true) {
    return "implementation_readiness_source_hash_missing";
  }

  return null;
}

function createDeterministicCandidateRecord({ nativeChatOutput, requestText }) {
  const sourceText = nativeChatOutput.text;
  const sourceTextHash = sha256Text(sourceText);
  const candidateContentHash = sha256Text(
    JSON.stringify({
      kind: nativeChatOutput.kind,
      route: nativeChatOutput.route,
      text: nativeChatOutput.text,
    })
  );

  const candidateId =
    "candidate_" +
    sha256Text(
      [
        nativeChatOutput.kind,
        nativeChatOutput.route,
        sourceTextHash,
        candidateContentHash,
        requestText,
      ].join("|")
    ).slice(0, 24);

  return {
    id: candidateId,
    kind: "candidate",
    source_kind: nativeChatOutput.kind,
    source_route: nativeChatOutput.route,
    source_text_hash: sourceTextHash,
    candidate_content_hash: candidateContentHash,
    text: nativeChatOutput.text,
    status: "candidate_saved_to_sandbox_store",
    persisted_to_production: false,
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
  };
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  return text.split("\n").map((line) => JSON.parse(line));
}

function writeAtomicAppendOnlyJsonl({
  storePath,
  record,
  simulateFailureAfterPrepare = false,
}) {
  const dir = path.dirname(storePath);
  fs.mkdirSync(dir, { recursive: true });

  const before = fs.existsSync(storePath)
    ? fs.readFileSync(storePath, "utf8")
    : "";

  const transactionPath = storePath + ".txn";
  const after = before + JSON.stringify(record) + "\n";

  fs.writeFileSync(transactionPath, after, "utf8");

  if (simulateFailureAfterPrepare) {
    fs.unlinkSync(transactionPath);
    return {
      transaction_started: true,
      transaction_committed: false,
      rollback_performed: true,
      append_only_write_performed: false,
    };
  }

  fs.renameSync(transactionPath, storePath);

  return {
    transaction_started: true,
    transaction_committed: true,
    rollback_performed: false,
    append_only_write_performed: true,
  };
}

function performMinimalRuntimeCandidateWrite({
  readinessResult,
  nativeChatOutput,
  userRequest,
  sandboxStoreDir,
  simulateFailureAfterPrepare = false,
  state = BASELINE_STATE,
}) {
  const before = clone(state);
  const intent = classifyRuntimeCandidateWriteIntent(userRequest);
  const readinessError = validateImplementationReadiness(readinessResult);

  if (readinessError) {
    return {
      accepted: false,
      reason: readinessError,
      candidate_runtime_write_performed: false,
      state_after: before,
    };
  }

  if (!nativeChatOutput || nativeChatOutput.kind !== "chat_output") {
    return {
      accepted: false,
      reason: "runtime_write_source_is_not_native_chat_output",
      candidate_runtime_write_performed: false,
      state_after: before,
    };
  }

  if (!intent.explicit) {
    return {
      accepted: false,
      reason: "missing_explicit_runtime_candidate_write_request",
      candidate_runtime_write_performed: false,
      state_after: before,
    };
  }

  const storePath = path.join(sandboxStoreDir, "candidate_store.jsonl");
  const record = createDeterministicCandidateRecord({
    nativeChatOutput,
    requestText: userRequest,
  });

  const tx = writeAtomicAppendOnlyJsonl({
    storePath,
    record,
    simulateFailureAfterPrepare,
  });

  if (simulateFailureAfterPrepare) {
    return {
      accepted: false,
      reason: "runtime_candidate_write_transaction_rolled_back",
      store_scope: "sandbox_candidate_store",
      store_path: storePath,
      candidate_runtime_write_performed: false,
      candidate_record: record,

      production_candidate_saved: false,
      sandbox_candidate_saved: false,
      candidate_id_created: true,
      candidate_hash_created: true,
      source_text_hash_created: true,
      append_only_write_performed: false,
      transaction_started: tx.transaction_started,
      transaction_committed: tx.transaction_committed,
      rollback_performed: tx.rollback_performed,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adoption_performed: false,
      settlement_performed: false,
      canon_update_performed: false,
      active_engine_update_performed: false,

      state_after: before,
    };
  }

  return {
    accepted: true,
    reason: "runtime_candidate_write_minimal_sandbox_append_only",
    store_scope: "sandbox_candidate_store",
    store_path: storePath,
    candidate_runtime_write_performed: true,
    candidate_record: record,

    production_candidate_saved: false,
    sandbox_candidate_saved: true,
    candidate_id_created: true,
    candidate_hash_created: true,
    source_text_hash_created: true,
    append_only_write_performed: tx.append_only_write_performed,
    transaction_started: tx.transaction_started,
    transaction_committed: tx.transaction_committed,
    rollback_performed: tx.rollback_performed,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,

    direct_requests_detected: {
      approval:
        readinessResult.direct_requests_detected.approval ||
        intent.direct_approval_requested,
      pending_engine:
        readinessResult.direct_requests_detected.pending_engine ||
        intent.direct_pending_engine_requested,
      adoption:
        readinessResult.direct_requests_detected.adoption ||
        intent.direct_adoption_requested,
      settlement:
        readinessResult.direct_requests_detected.settlement ||
        intent.direct_settlement_requested,
      canon:
        readinessResult.direct_requests_detected.canon ||
        intent.direct_canon_requested,
      active_engine:
        readinessResult.direct_requests_detected.active_engine ||
        intent.direct_active_engine_requested,
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

    next_allowed_phase:
      "phase41h_or_later_explicit_candidate_runtime_write_service_integration",
    state_after: before,
  };
}

function withTempStore(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase41g-candidate-store-"));

  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

{
  withTempStore((dir) => {
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: null,
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "perform runtime candidate write",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "implementation_readiness_not_accepted");
    assert.equal(result.candidate_runtime_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "looks good, continue",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "missing_explicit_runtime_candidate_write_request");
    assert.equal(result.candidate_runtime_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness({
        readiness_mode: "runtime_write_performed",
      }),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "perform runtime candidate write",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "implementation_readiness_contract_invalid");
    assert.equal(result.candidate_runtime_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness({
        implementation_readiness_preview: {
          kind: "candidate_runtime_write_implementation_readiness_preview",
          persisted: false,
          id: null,
          write_strategy: "overwrite",
          transaction_required: true,
          rollback_required: true,
          deterministic_candidate_id_required: true,
          candidate_content_hash_required: true,
          source_text_hash_required: true,
        },
      }),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "perform runtime candidate write",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "implementation_readiness_write_strategy_invalid");
    assert.equal(result.candidate_runtime_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const output = createNativeChatOutput();
    const request = "perform runtime candidate write";
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.reason, "runtime_candidate_write_minimal_sandbox_append_only");
    assert.equal(result.store_scope, "sandbox_candidate_store");
    assert.equal(result.candidate_runtime_write_performed, true);

    assert.equal(result.production_candidate_saved, false);
    assert.equal(result.sandbox_candidate_saved, true);
    assert.equal(result.candidate_id_created, true);
    assert.equal(result.candidate_hash_created, true);
    assert.equal(result.source_text_hash_created, true);
    assert.equal(result.append_only_write_performed, true);
    assert.equal(result.transaction_started, true);
    assert.equal(result.transaction_committed, true);
    assert.equal(result.rollback_performed, false);

    assert.equal(result.approval_request_created, false);
    assert.equal(result.pending_engine_candidate_created, false);
    assert.equal(result.adoption_performed, false);
    assert.equal(result.settlement_performed, false);
    assert.equal(result.canon_update_performed, false);
    assert.equal(result.active_engine_update_performed, false);

    assert.equal(result.candidate_record.kind, "candidate");
    assert.equal(result.candidate_record.source_kind, "chat_output");
    assert.equal(
      result.candidate_record.source_route,
      "chatgpt_native_full_neural_writing_handoff"
    );
    assert.equal(result.candidate_record.persisted_to_production, false);
    assert.equal(result.candidate_record.approval_request_id, null);
    assert.equal(result.candidate_record.pending_engine_candidate_id, null);
    assert.equal(result.candidate_record.adoption_id, null);
    assert.equal(result.candidate_record.settlement_id, null);
    assert.equal(result.candidate_record.canon_update_id, null);
    assert.equal(result.candidate_record.active_engine_update_id, null);

    assert.equal(result.candidate_record.source_text_hash, sha256Text(output.text));
    assert.equal(
      result.candidate_record.candidate_content_hash,
      sha256Text(
        JSON.stringify({
          kind: output.kind,
          route: output.route,
          text: output.text,
        })
      )
    );

    const records = readJsonl(result.store_path);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], result.candidate_record);

    assertNoProductionMutation(result);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const output = createNativeChatOutput();
    const request = "perform runtime candidate write";

    const first = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
      sandboxStoreDir: dir,
    });

    const second = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
      sandboxStoreDir: dir,
    });

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, true);
    assert.equal(first.candidate_record.id, second.candidate_record.id);
    assert.equal(
      first.candidate_record.candidate_content_hash,
      second.candidate_record.candidate_content_hash
    );

    const records = readJsonl(first.store_path);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], first.candidate_record);
    assert.deepEqual(records[1], second.candidate_record);
  });
}

{
  withTempStore((dir) => {
    const storePath = path.join(dir, "candidate_store.jsonl");
    const seed = {
      id: "seed_candidate",
      kind: "candidate",
      text: "seed",
    };
    fs.writeFileSync(storePath, JSON.stringify(seed) + "\n", "utf8");

    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "perform runtime candidate write",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, true);

    const records = readJsonl(storePath);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], seed);
    assert.deepEqual(records[1], result.candidate_record);
  });
}

{
  withTempStore((dir) => {
    const storePath = path.join(dir, "candidate_store.jsonl");
    const seed = {
      id: "seed_candidate",
      kind: "candidate",
      text: "seed",
    };
    fs.writeFileSync(storePath, JSON.stringify(seed) + "\n", "utf8");

    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "perform runtime candidate write",
      sandboxStoreDir: dir,
      simulateFailureAfterPrepare: true,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "runtime_candidate_write_transaction_rolled_back");
    assert.equal(result.candidate_runtime_write_performed, false);
    assert.equal(result.production_candidate_saved, false);
    assert.equal(result.sandbox_candidate_saved, false);
    assert.equal(result.append_only_write_performed, false);
    assert.equal(result.transaction_started, true);
    assert.equal(result.transaction_committed, false);
    assert.equal(result.rollback_performed, true);

    const records = readJsonl(storePath);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], seed);
    assert.equal(fs.existsSync(storePath + ".txn"), false);

    assertNoProductionMutation(result);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempStore((dir) => {
    const result = performMinimalRuntimeCandidateWrite({
      readinessResult: createAcceptedImplementationReadiness({
        direct_requests_detected: {
          approval: true,
          pending_engine: true,
          adoption: true,
          settlement: true,
          canon: true,
          active_engine: true,
          candidate_write: true,
        },
      }),
      nativeChatOutput: createNativeChatOutput(),
      userRequest:
        "perform runtime candidate write, approve it, create pending engine, adopt, settle into canon, and update active_engine",
      sandboxStoreDir: dir,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.direct_requests_detected.approval, true);
    assert.equal(result.direct_requests_detected.pending_engine, true);
    assert.equal(result.direct_requests_detected.adoption, true);
    assert.equal(result.direct_requests_detected.settlement, true);
    assert.equal(result.direct_requests_detected.canon, true);
    assert.equal(result.direct_requests_detected.active_engine, true);

    assert.ok(result.blocked_direct_actions.includes("production_candidate_store_write"));
    assert.ok(result.blocked_direct_actions.includes("approval_request_create"));
    assert.ok(
      result.blocked_direct_actions.includes("pending_engine_candidate_create")
    );
    assert.ok(result.blocked_direct_actions.includes("adoption"));
    assert.ok(result.blocked_direct_actions.includes("settlement"));
    assert.ok(result.blocked_direct_actions.includes("canon_update"));
    assert.ok(result.blocked_direct_actions.includes("active_engine_update"));

    assert.equal(result.approval_request_created, false);
    assert.equal(result.pending_engine_candidate_created, false);
    assert.equal(result.adoption_performed, false);
    assert.equal(result.settlement_performed, false);
    assert.equal(result.canon_update_performed, false);
    assert.equal(result.active_engine_update_performed, false);

    assertNoProductionMutation(result);
    assertNoWriteMutation(result.state_after);
  });
}

console.log(
  "Phase41G explicit candidate runtime write minimal implementation smoke tests passed."
);
