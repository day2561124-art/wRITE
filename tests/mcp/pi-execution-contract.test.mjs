import assert from "node:assert/strict";
import test from "node:test";
import {
  createExecutionIntent, createOperationState, transitionOperation,
  classifyExecutionFailure, reconcileExecutionObservation, hashExecutionInput,
  REQUIRED_DECISION_BOUNDARIES,
} from "../../server/src/pi-execution-contract.mjs";

export function fixture(overrides = {}) {
  return {
    schema_version: 1, intent_id: "intent-foundation-001",
    goal: "Inspect the explicitly selected workspace",
    context: { project_id: "writer_workbench", workstream_id: "dev_workstream_20261003-073214_3867df627fa2",
      workspace_id: "dev_workspace_5cdbb0f1d7044d71abd73592" },
    constraints: ["Do not change production routing"],
    requested_actions: [{ step_id: "read-package", capability: "filesystem.read",
      input: { path: "package.json", maxBytes: 4096 }, depends_on: [] }],
    mutation_plan: [],
    verification: { focused: [], affected: [], full: [] },
    completion_conditions: ["GPT reviews the package identity"],
    permissions: { read: true, workspace_create: false, write: false, tests: false,
      commit: false, integrate: false, push: false },
    decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES],
    ...overrides,
  };
}

test("restart projections reject corrupt identities and retry resumes only its captured phase", () => {
  let state = createOperationState(createExecutionIntent(fixture()));
  state = transitionOperation(state, "ADMITTED");
  state = transitionOperation(state, "PREPARING");
  state = transitionOperation(state, "EXECUTING");
  const waiting = transitionOperation(state, "WAITING_RETRY");
  assert.equal(waiting.resume_point.phase, "EXECUTING");
  assert.throws(() => transitionOperation(waiting, "COMMITTING"));
  assert.equal(transitionOperation(waiting, "EXECUTING").status, "EXECUTING");
  assert.throws(() => transitionOperation({ ...state, intent_hash: "corrupt" }, "VERIFYING"), /CORRUPT_STATE/);
  const escalated = transitionOperation(state, "DECISION_REQUIRED");
  assert.throws(() => transitionOperation(escalated, "EXECUTING"));
});

test("same idempotency key cannot designate multiple logical mutations", () => {
  const input = { path: "server/a.mjs", content: "" };
  const other = { path: "server/b.mjs", content: "" };
  const actions = [input, other].map((args, i) => ({
    step_id: "write-" + i, capability: "filesystem.write", input: args, depends_on: [],
    idempotency_key: "intent-foundation-001:shared",
  }));
  const plans = actions.map(x => ({ step_id: x.step_id, target: x.input.path,
    expected_change: "Create supplied bytes", input_sha256: hashExecutionInput(x.input) }));
  assert.throws(() => createExecutionIntent(fixture({ requested_actions: actions, mutation_plan: plans,
    permissions: { ...fixture().permissions, write: true } })), /INVALID_IDEMPOTENCY_KEY/);
});

test("verification levels cannot silently substitute a different suite or omit a declared gate", () => {
  const action = { step_id: "verify", capability: "verification.full", input: { suite: "mcp" }, depends_on: [],
    idempotency_key: "intent-foundation-001:verify" };
  const plan = { step_id: "verify", target: "verification:full", expected_change: "Run the selected suite",
    input_sha256: hashExecutionInput(action.input) };
  const request = fixture({ requested_actions: [action], mutation_plan: [plan],
    permissions: { ...fixture().permissions, tests: true },
    verification: { focused: [], affected: [], full: ["verify"] } });
  assert.throws(() => createExecutionIntent(request), /VERIFICATION_CAPABILITY_MISMATCH/);
  const full = { ...action, input: { suite: "all" } };
  const valid = { ...request, requested_actions: [full],
    mutation_plan: [{ ...plan, input_sha256: hashExecutionInput(full.input) }] };
  assert.equal(createExecutionIntent(valid).requested_actions[0].input.suite, "all");
  assert.throws(() => createExecutionIntent({ ...valid, verification: { focused: [], affected: [], full: [] } }), /UNDECLARED_VERIFICATION/);
});

test("intent size and nesting are bounded before scheduling", () => {
  assert.throws(() => createExecutionIntent(fixture({ goal: "x".repeat(600000) })), /CONTRACT_SIZE_LIMIT/);
  let nested = {};
  for (let i = 0; i < 40; i++) nested = { child: nested };
  assert.throws(() => createExecutionIntent(fixture({ constraints: [nested] })), /CONTRACT_COMPLEXITY_LIMIT/);
});

test("intent is an immutable JSON execution contract; input changes cannot expand admitted scope", () => {
  const input = fixture();
  const intent = createExecutionIntent(input);
  input.requested_actions[0].input.path = "other.txt";
  assert.equal(intent.requested_actions[0].input.path, "package.json");
  assert.ok(Object.isFrozen(intent.requested_actions[0].input));
  assert.throws(() => { intent.permissions.push = true; }, TypeError);
  assert.equal(hashExecutionInput({ a: 1, b: 2 }), hashExecutionInput({ b: 2, a: 1 }));
});

test("rejects missing authority, incomplete contract, extra routing fields and non-JSON values", () => {
  for (const change of [
    { permissions: { read: true } }, { requested_actions: [] }, { goal: "" },
    { decision_boundaries: [] }, { tool_name: "fix_everything" },
    { context: { project_id: "writer_workbench", workspace_id: "../main" } },
    { requested_actions: [{ step_id: "x", capability: "filesystem.read", input: { path: "a", maxBytes: NaN } }] },
  ]) assert.throws(() => createExecutionIntent(fixture(change)));
  const cyclic = fixture(); cyclic.constraints.push(cyclic);
  assert.throws(() => createExecutionIntent(cyclic));
});

test("scheduler cannot invent dependencies, capabilities, execution content or verification actions", () => {
  const base = fixture().requested_actions[0];
  for (const actions of [
    [base, base],
    [{ ...base, depends_on: ["future"] }],
    [{ ...base, capability: "fix_everything" }],
    [{ ...base, input: { path: "a", command: "anything" } }],
    [{ ...base, input: { path: "a", workspace_id: "dev_workspace_shared_repository_v1" } }],
    [{ ...base, input: { path: "../secret" } }],
    [{ ...base, input: { path: "C:\\outside" } }],
  ]) assert.throws(() => createExecutionIntent(fixture({ requested_actions: actions })));
  assert.throws(() => createExecutionIntent(fixture({ verification: { focused: ["read-package"], affected: [], full: [] } })));
});

test("all mutation requires an explicit permission, stable unique key and exact GPT content binding", () => {
  const input = { path: "server/new.mjs", content: "export const value = 1;\n" };
  const write = { step_id: "create-file", capability: "filesystem.write", input,
    depends_on: [], idempotency_key: "intent-foundation-001:create-file" };
  const plan = { step_id: "create-file", target: "server/new.mjs",
    expected_change: "Create the exact supplied source", input_sha256: hashExecutionInput(input) };
  const request = fixture({ requested_actions: [write], mutation_plan: [plan],
    permissions: { ...fixture().permissions, write: true } });
  assert.equal(createExecutionIntent(request).requested_actions[0].input.content, input.content);
  assert.throws(() => createExecutionIntent({ ...request, mutation_plan: [{ ...plan, input_sha256: "0".repeat(64) }] }));
  assert.throws(() => createExecutionIntent({ ...request, permissions: fixture().permissions }));
  assert.throws(() => createExecutionIntent({ ...request, requested_actions: [{ ...write, idempotency_key: undefined }] }));
  assert.throws(() => createExecutionIntent({ ...request, mutation_plan: [{ ...plan, target: "server/other.mjs" }] }));
  assert.throws(() => createExecutionIntent({ ...request, mutation_plan: [plan, plan] }));
});

test("state machine fails closed on phase skipping and cannot reopen terminal operations", () => {
  let state = createOperationState(createExecutionIntent(fixture()), { operation_id: "pi_operation_" + "a".repeat(32),
    timestamp: "2026-10-03T07:40:00.000Z" });
  assert.equal(state.status, "CREATED");
  assert.equal(state.pending_steps.length, 1);
  assert.equal(state.project_id, "writer_workbench");
  assert.throws(() => transitionOperation(state, "COMPLETED"));
  for (const next of ["ADMITTED", "PREPARING", "EXECUTING", "VERIFYING", "COMMITTING"]) {
    state = transitionOperation(state, next, "2026-10-03T07:40:01.000Z");
  }
  assert.throws(() => transitionOperation(state, "COMPLETED", state.updated_at), /INCOMPLETE_EXECUTION/);
  // Trusted executor supplies actual step receipts and verification results in Phase B.
  state = { ...state, pending_steps: [], completed_steps: ["read-package"],
    verification_state: { focused: "not_requested", affected: "not_requested", full: "not_requested" } };
  state = transitionOperation(state, "COMPLETED", state.updated_at);
  assert.equal(state.completed_at, "2026-10-03T07:40:01.000Z");
  assert.throws(() => transitionOperation(state, "EXECUTING"));
  assert.throws(() => transitionOperation({ ...state, status: "BOGUS" }, "CREATED"));
});

test("transient transport and timeout never authorize blind replay of uncertain mutation", () => {
  for (const code of ["TRANSPORT_ERROR", "TEMPORARY_UNAVAILABLE", "TIMEOUT"]) {
    assert.equal(classifyExecutionFailure({ code, mutation: false }).action, "retry");
    assert.equal(classifyExecutionFailure({ code, mutation: true, execution_state: "not_started" }).action, "retry");
    for (const execution_state of ["unknown", "partial", undefined]) {
      assert.equal(classifyExecutionFailure({ code, mutation: true, execution_state }).action, "reconcile");
    }
  }
  assert.equal(classifyExecutionFailure({ code: "ALREADY_COMPLETED", mutation: true }).action, "return_stored_result");
});

test("semantic errors require GPT decisions; permission and corrupt state stop execution", () => {
  for (const code of ["VALIDATION_FAILURE", "TEST_FAILURE", "GIT_SEMANTIC_CONFLICT",
    "ARCHITECTURE_CONFLICT", "IMPLEMENTATION_FAILURE", "SCOPE_EXPANSION",
    "REQUIREMENT_AMBIGUITY", "UNEXPECTED_SEMANTIC_BEHAVIOR"]) {
    assert.equal(classifyExecutionFailure({ code, mutation: true }).action, "decision_required");
  }
  assert.equal(classifyExecutionFailure({ code: "PERMISSION_DENIED" }).action, "stop");
  assert.equal(classifyExecutionFailure({ code: "CORRUPT_STATE" }).action, "fail_safe");
  assert.equal(classifyExecutionFailure({ code: "unexpected_raw_error" }).action, "decision_required");
});

test("reconciliation requires attributable physical evidence, not absence of a success response", () => {
  assert.deepEqual(reconcileExecutionObservation({ state: "not_started", evidence_verified: true }),
    { state: "not_started", safe_to_retry: true, action: "retry_same_key" });
  assert.equal(reconcileExecutionObservation({ state: "completed", evidence_verified: true }).action, "return_stored_result");
  for (const state of ["partial", "unknown", "not_started", "completed"]) {
    assert.equal(reconcileExecutionObservation({ state, evidence_verified: false }).action, "decision_required");
  }
  for (const state of ["partial", "unknown"]) {
    assert.equal(reconcileExecutionObservation({ state, evidence_verified: true }).safe_to_retry, false);
  }
});
