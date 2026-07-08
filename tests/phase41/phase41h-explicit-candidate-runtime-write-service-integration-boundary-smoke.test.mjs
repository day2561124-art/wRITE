import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  sandbox_candidate_saved: false,
  service_write_performed: false,
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
  assert.equal(snapshot.approval_request_created, false);
  assert.equal(snapshot.pending_engine_candidate_created, false);
  assert.equal(snapshot.adoption_performed, false);
  assert.equal(snapshot.settlement_performed, false);
  assert.equal(snapshot.canon_update_performed, false);
  assert.equal(snapshot.active_engine_update_performed, false);
}

function assertNoWriteMutation(snapshot) {
  assertNoProductionMutation(snapshot);
  assert.equal(snapshot.sandbox_candidate_saved, false);
  assert.equal(snapshot.service_write_performed, false);
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

function createServiceContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_service_integration_contract",
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    mode: "service_integration_boundary",
    allowed_store_scope: "sandbox_candidate_store",
    production_store_scope_allowed: false,
    write_strategy: "append_only_jsonl",
    deterministic_candidate_id_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    source_route_link_required: true,
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

function validateReadiness(readinessResult) {
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

function validateServiceContract(contract) {
  if (
    !contract ||
    contract.kind !== "candidate_runtime_write_service_integration_contract"
  ) {
    return "service_contract_missing";
  }

  if (contract.service_api !== "CandidateRuntimeWriteService.writeCandidate") {
    return "service_contract_api_invalid";
  }

  if (contract.mode !== "service_integration_boundary") {
    return "service_contract_mode_invalid";
  }

  if (contract.allowed_store_scope !== "sandbox_candidate_store") {
    return "service_contract_store_scope_invalid";
  }

  if (contract.production_store_scope_allowed !== false) {
    return "service_contract_production_scope_not_blocked";
  }

  if (contract.write_strategy !== "append_only_jsonl") {
    return "service_contract_write_strategy_invalid";
  }

  const requiredTrueFields = [
    "deterministic_candidate_id_required",
    "candidate_content_hash_required",
    "source_text_hash_required",
    "source_route_link_required",
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
      return "service_contract_required_field_invalid";
    }
  }

  return null;
}

function classifyServiceWriteIntent(userText) {
  const normalized = String(userText || "").trim().toLowerCase();

  const explicitPatterns = [
    /\bcall\b.*\bcandidate runtime write service\b/,
    /\binvoke\b.*\bcandidate runtime write service\b/,
    /\bservice\b.*\bruntime candidate write\b/,
    /\bwrite\b.*\bcandidate\b.*\bservice\b/,
    /\bservice integration\b.*\bcandidate write\b/,
    /\bcandidate runtime write service\b/,
  ];

  return {
    explicit: explicitPatterns.some((pattern) => pattern.test(normalized)),
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

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  return text.split("\n").map((line) => JSON.parse(line));
}

function createCandidateRecord({
  nativeChatOutput,
  userRequest,
  serviceContract,
}) {
  const sourceTextHash = sha256Text(nativeChatOutput.text);
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
        serviceContract.service_api,
        nativeChatOutput.kind,
        nativeChatOutput.route,
        sourceTextHash,
        candidateContentHash,
        userRequest,
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
    status: "candidate_saved_to_sandbox_service_store",
    persisted_to_production: false,
    service_api: serviceContract.service_api,
    store_scope: "sandbox_candidate_store",
    write_strategy: serviceContract.write_strategy,
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
  };
}

function appendJsonlWithTransaction({
  storePath,
  record,
  simulateFailureAfterPrepare = false,
}) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });

  const before = fs.existsSync(storePath)
    ? fs.readFileSync(storePath, "utf8")
    : "";

  const transactionPath = storePath + ".txn";
  const next = before + JSON.stringify(record) + "\n";

  fs.writeFileSync(transactionPath, next, "utf8");

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

class CandidateRuntimeWriteService {
  constructor({
    storeRoot,
    storeScope,
    serviceContract = createServiceContract(),
    state = BASELINE_STATE,
  }) {
    this.storeRoot = storeRoot;
    this.storeScope = storeScope;
    this.serviceContract = serviceContract;
    this.state = state;
  }

  writeCandidate({
    readinessResult,
    nativeChatOutput,
    userRequest,
    simulateFailureAfterPrepare = false,
  }) {
    const before = clone(this.state);
    const contractError = validateServiceContract(this.serviceContract);
    const readinessError = validateReadiness(readinessResult);
    const intent = classifyServiceWriteIntent(userRequest);

    if (contractError) {
      return {
        accepted: false,
        reason: contractError,
        service_write_performed: false,
        state_after: before,
      };
    }

    if (this.storeScope !== "sandbox_candidate_store") {
      return {
        accepted: false,
        reason: "service_store_scope_not_allowed",
        store_scope: this.storeScope,
        service_write_performed: false,
        state_after: before,
      };
    }

    if (readinessError) {
      return {
        accepted: false,
        reason: readinessError,
        service_write_performed: false,
        state_after: before,
      };
    }

    if (!nativeChatOutput || nativeChatOutput.kind !== "chat_output") {
      return {
        accepted: false,
        reason: "service_source_is_not_native_chat_output",
        service_write_performed: false,
        state_after: before,
      };
    }

    if (!intent.explicit) {
      return {
        accepted: false,
        reason: "missing_explicit_service_write_request",
        service_write_performed: false,
        state_after: before,
      };
    }

    const storePath = path.join(
      this.storeRoot,
      this.storeScope,
      "candidate_store.jsonl"
    );

    const candidateRecord = createCandidateRecord({
      nativeChatOutput,
      userRequest,
      serviceContract: this.serviceContract,
    });

    const tx = appendJsonlWithTransaction({
      storePath,
      record: candidateRecord,
      simulateFailureAfterPrepare,
    });

    const directRequestsDetected = {
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
    };

    const common = {
      service_api: this.serviceContract.service_api,
      store_scope: this.storeScope,
      store_path: storePath,
      candidate_record: candidateRecord,
      production_candidate_saved: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adoption_performed: false,
      settlement_performed: false,
      canon_update_performed: false,
      active_engine_update_performed: false,
      direct_requests_detected: directRequestsDetected,
      blocked_direct_actions: [
        "production_candidate_store_write",
        "approval_request_create",
        "pending_engine_candidate_create",
        "adoption",
        "settlement",
        "canon_update",
        "active_engine_update",
      ],
      state_after: before,
    };

    if (simulateFailureAfterPrepare) {
      return {
        accepted: false,
        reason: "service_transaction_rolled_back",
        service_write_performed: false,
        candidate_runtime_write_performed: false,
        sandbox_candidate_saved: false,
        candidate_id_created: true,
        candidate_hash_created: true,
        source_text_hash_created: true,
        append_only_write_performed: false,
        transaction_started: tx.transaction_started,
        transaction_committed: tx.transaction_committed,
        rollback_performed: tx.rollback_performed,
        ...common,
      };
    }

    return {
      accepted: true,
      reason: "candidate_runtime_write_service_integration_sandbox_append_only",
      service_write_performed: true,
      candidate_runtime_write_performed: true,
      sandbox_candidate_saved: true,
      candidate_id_created: true,
      candidate_hash_created: true,
      source_text_hash_created: true,
      append_only_write_performed: tx.append_only_write_performed,
      transaction_started: tx.transaction_started,
      transaction_committed: tx.transaction_committed,
      rollback_performed: tx.rollback_performed,
      next_allowed_phase:
        "phase41i_or_later_explicit_candidate_runtime_write_production_guard",
      ...common,
    };
  }
}

function withTempRoot(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase41h-service-store-"));

  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: null,
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "implementation_readiness_not_accepted");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "production_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "service_store_scope_not_allowed");
    assert.equal(result.store_scope, "production_candidate_store");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
      serviceContract: createServiceContract({
        production_store_scope_allowed: true,
      }),
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "service_contract_production_scope_not_blocked");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
      serviceContract: createServiceContract({
        write_strategy: "overwrite",
      }),
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "service_contract_write_strategy_invalid");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "looks good, continue",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "missing_explicit_service_write_request");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: {
        kind: "candidate",
        route: "manual_candidate_route",
        text: "Not a native chat output.",
      },
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "service_source_is_not_native_chat_output");
    assert.equal(result.service_write_performed, false);
    assertNoWriteMutation(result.state_after);
  });
}

{
  withTempRoot((root) => {
    const output = createNativeChatOutput();
    const request = "call candidate runtime write service";

    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
    });

    assert.equal(result.accepted, true);
    assert.equal(
      result.reason,
      "candidate_runtime_write_service_integration_sandbox_append_only"
    );
    assert.equal(result.service_api, "CandidateRuntimeWriteService.writeCandidate");
    assert.equal(result.store_scope, "sandbox_candidate_store");
    assert.equal(result.service_write_performed, true);
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
    assert.equal(result.candidate_record.service_api, result.service_api);
    assert.equal(result.candidate_record.store_scope, "sandbox_candidate_store");
    assert.equal(result.candidate_record.write_strategy, "append_only_jsonl");
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
  withTempRoot((root) => {
    const output = createNativeChatOutput();
    const request = "call candidate runtime write service";

    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const first = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
    });

    const second = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: output,
      userRequest: request,
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
  withTempRoot((root) => {
    const storePath = path.join(
      root,
      "sandbox_candidate_store",
      "candidate_store.jsonl"
    );
    fs.mkdirSync(path.dirname(storePath), { recursive: true });

    const seed = {
      id: "seed_candidate",
      kind: "candidate",
      text: "seed",
    };

    fs.writeFileSync(storePath, JSON.stringify(seed) + "\n", "utf8");

    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
    });

    assert.equal(result.accepted, true);

    const records = readJsonl(storePath);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], seed);
    assert.deepEqual(records[1], result.candidate_record);
  });
}

{
  withTempRoot((root) => {
    const storePath = path.join(
      root,
      "sandbox_candidate_store",
      "candidate_store.jsonl"
    );
    fs.mkdirSync(path.dirname(storePath), { recursive: true });

    const seed = {
      id: "seed_candidate",
      kind: "candidate",
      text: "seed",
    };

    fs.writeFileSync(storePath, JSON.stringify(seed) + "\n", "utf8");

    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
      readinessResult: createAcceptedImplementationReadiness(),
      nativeChatOutput: createNativeChatOutput(),
      userRequest: "call candidate runtime write service",
      simulateFailureAfterPrepare: true,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "service_transaction_rolled_back");
    assert.equal(result.service_write_performed, false);
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
  withTempRoot((root) => {
    const service = new CandidateRuntimeWriteService({
      storeRoot: root,
      storeScope: "sandbox_candidate_store",
    });

    const result = service.writeCandidate({
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
        "call candidate runtime write service, approve it, create pending engine, adopt, settle into canon, and update active_engine",
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
  "Phase41H explicit candidate runtime write service integration boundary smoke tests passed."
);
