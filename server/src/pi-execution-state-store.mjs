import { createHash } from "node:crypto";
import { validateReliableProjection } from "./pi-reliable-execution-state.mjs";
import { validateShadowProjection } from "./pi-shadow-execution-state.mjs";
import { createExecutionIntent, createOperationState, validateOperationState,
  transitionOperation, hashExecutionInput } from "./pi-execution-contract.mjs";
import { canonicalJson, appendDevExecutionProjection, readDevExecutionProjections } from "./mcp-development-journal-tools.mjs";

export const PI_EXECUTION_PROJECTION_MAX_BYTES = 768 * 1024;
const actions = new Set(["operation_created", "operation_admitted", "phase_changed",
  "checkpoint_saved", "decision_requested", "operation_failed", "operation_cancelled"]);
const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function exact(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail("CORRUPT_STATE");
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function verification(intent) {
  return Object.fromEntries(Object.entries(intent.verification).map(([level, steps]) =>
    [level, steps.length ? "pending" : "not_requested"]));
}
function initialState(intent, options) {
  return validateOperationState({ ...createOperationState(intent, options), verification_state: verification(intent) });
}
function requireContext(state, context) {
  if (!context || canonicalJson(context) !== canonicalJson({
    project_id: state.project_id, workstream_id: state.workstream_id, workspace_id: state.workspace_id,
  })) fail("WORKSPACE_CONTEXT_MISMATCH");
}
function checkpointValue(value, state, revision) {
  exact(value, ["schema_version", "operation_id", "intent_hash", "workspace_id", "at_revision",
    "phase", "step_id", "workspace_checkpoint_id", "workspace_snapshot_id", "git_head"]);
  if (value.schema_version !== 1 || value.operation_id !== state.operation_id || value.intent_hash !== state.intent_hash
    || value.workspace_id !== state.workspace_id || !Number.isSafeInteger(value.at_revision)
    || value.at_revision < 1 || value.at_revision >= revision
    || !["CREATED", "ADMITTED", "PREPARING", "EXECUTING", "VERIFYING", "COMMITTING",
      "WAITING_RETRY", "RECONCILING", "DECISION_REQUIRED", "BLOCKED"].includes(value.phase)
    || value.step_id !== null) fail("CORRUPT_STATE");
  if (value.workspace_checkpoint_id === null) {
    if (value.workspace_snapshot_id !== null || value.git_head !== null) fail("CORRUPT_STATE");
  } else if (!/^dev_checkpoint_[a-f0-9]{32}$/u.test(value.workspace_checkpoint_id)
    || !/^[a-f0-9]{64}$/u.test(value.workspace_snapshot_id) || !/^[a-f0-9]{40}$/u.test(value.git_head)) fail("CORRUPT_STATE");
  return value;
}
function projection(body) {
  const encoded = canonicalJson(body);
  const record = { ...JSON.parse(encoded), projection_hash: createHash("sha256").update(encoded, "utf8").digest("hex") };
  if (Buffer.byteLength(canonicalJson(record), "utf8") > PI_EXECUTION_PROJECTION_MAX_BYTES) fail("EXECUTION_PROJECTION_SIZE_LIMIT");
  return freeze(record);
}
function validatedProjection(value) {
  try {
    exact(value, ["schema_version", "revision", "previous_projection_hash", "projection_hash", "action_type", "intent", "state"]);
    const { projection_hash: hash, ...body } = value;
    if (value.schema_version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
      || !actions.has(value.action_type) || hash !== createHash("sha256").update(canonicalJson(body), "utf8").digest("hex")
      || Buffer.byteLength(canonicalJson(value), "utf8") > PI_EXECUTION_PROJECTION_MAX_BYTES) fail("CORRUPT_STATE");
    const intent = createExecutionIntent(value.intent);
    const state = validateOperationState(value.state);
    if (state.intent_id !== intent.intent_id || state.intent_hash !== hashExecutionInput(intent)
      || state.project_id !== intent.context.project_id || state.workstream_id !== intent.context.workstream_id
      || state.workspace_id !== intent.context.workspace_id
      || canonicalJson(state.pending_steps) !== canonicalJson(intent.requested_actions.map(x => x.step_id))
      || state.completed_steps.length || state.current_step !== null || state.tool_calls.length || state.tool_results.length
      || state.retry_count !== 0 || state.last_error !== null
      || canonicalJson(state.verification_state) !== canonicalJson(verification(intent))
      || canonicalJson(state.idempotency_keys) !== canonicalJson(Object.fromEntries(intent.requested_actions
        .filter(x => x.idempotency_key).map(x => [x.step_id, x.idempotency_key])))) fail("CORRUPT_STATE");
    if (state.checkpoint !== null) checkpointValue(state.checkpoint, state, value.revision);
    return freeze(JSON.parse(canonicalJson(value)));
  } catch { fail("CORRUPT_STATE"); }
}
function transitionAction(status) {
  return { ADMITTED: "operation_admitted", DECISION_REQUIRED: "decision_requested",
    FAILED: "operation_failed", CANCELLED: "operation_cancelled" }[status] ?? "phase_changed";
}
export function validatePiExecutionHistory(events) {
  const byOperation = new Map();
  const byIntent = new Map();
  const keys = new Map();
  function bindKeys(record) {
    for (const action of record.intent.requested_actions.filter(x => x.idempotency_key)) {
      const binding = hashExecutionInput({ intent_id: record.intent.intent_id, context: record.intent.context, action });
      const previous = keys.get(action.idempotency_key);
      if (previous && previous !== binding) fail("IDEMPOTENCY_KEY_CONFLICT");
      keys.set(action.idempotency_key, binding);
    }
  }
  for (const event of events) {
    if ([2, 3].includes(event.execution_projection?.schema_version)) {
      const raw = event.execution_projection;
      const prior = byOperation.get(raw.state?.operation_id)?.execution_projection;
      const record = raw.schema_version === 3 ? validateShadowProjection(raw, prior) : validateReliableProjection(raw, prior);
      const state = record.state;
      if (event.stage !== "operation_completed" || event.operation_type !== "pi_execution_projection"
        || event.workspace_id !== state.workspace_id || event.workstream_id !== state.workstream_id
        || event.result?.logical_operation_id !== state.operation_id || event.result?.projection_hash !== record.projection_hash
        || event.result?.state_revision !== record.revision || event.result?.action_type !== record.action_type
        || event.result?.execution_schema_version !== record.schema_version
        || event.result?.state_after !== state.status || event.result?.input_hash !== state.intent_hash
        || event.result?.result_hash !== hashExecutionInput(state)) fail("CORRUPT_STATE");
      if (!prior) {
        if (byIntent.has(record.intent.intent_id)) fail("CORRUPT_STATE");
        byIntent.set(record.intent.intent_id, state.operation_id); bindKeys(record);
      }
      byOperation.set(state.operation_id, event);
      continue;
    }
    const record = validatedProjection(event.execution_projection);
    const state = record.state;
    if (event.stage !== "operation_completed" || event.operation_type !== "pi_execution_projection"
      || event.workspace_id !== state.workspace_id || event.workstream_id !== state.workstream_id
      || event.result?.logical_operation_id !== state.operation_id
      || event.result?.projection_hash !== record.projection_hash
      || event.result?.state_revision !== record.revision
      || event.result?.action_type !== record.action_type || event.result?.state_after !== state.status
      || event.result?.input_hash !== state.intent_hash || event.result?.result_hash !== hashExecutionInput(state)) fail("CORRUPT_STATE");
    const prior = byOperation.get(state.operation_id)?.execution_projection;
    if (!prior) {
      if (record.revision !== 1 || record.previous_projection_hash !== null || record.action_type !== "operation_created"
        || canonicalJson(state) !== canonicalJson(initialState(record.intent, {
          operation_id: state.operation_id, parent_operation_id: state.parent_operation_id, timestamp: state.created_at,
        }))) fail("CORRUPT_STATE");
      // The global intent identity is fixed; a workspace change requires a new intent_id.
      if (byIntent.has(record.intent.intent_id)) fail("CORRUPT_STATE");
      byIntent.set(record.intent.intent_id, state.operation_id);
      bindKeys(record);
    } else {
      if (Date.parse(state.updated_at) < Date.parse(prior.state.updated_at)) fail("CORRUPT_STATE");
      if (record.revision !== prior.revision + 1 || record.previous_projection_hash !== prior.projection_hash
        || canonicalJson(record.intent) !== canonicalJson(prior.intent)) fail("CORRUPT_STATE");
      let expected;
      try {
        if (record.action_type === "checkpoint_saved") {
          if (terminal.has(prior.state.status) || state.checkpoint?.at_revision !== prior.revision
            || state.checkpoint?.phase !== prior.state.status || state.checkpoint?.step_id !== prior.state.current_step) fail("CORRUPT_STATE");
          expected = validateOperationState({ ...prior.state, checkpoint: state.checkpoint, updated_at: state.updated_at });
        } else {
          if (record.action_type !== transitionAction(state.status)) fail("CORRUPT_STATE");
          expected = transitionOperation(prior.state, state.status, state.updated_at);
        }
      } catch { fail("CORRUPT_STATE"); }
      if (canonicalJson(state) !== canonicalJson(expected)) fail("CORRUPT_STATE");
    }
    byOperation.set(state.operation_id, event);
  }
  return byOperation;
}
function resultOf(event) {
  const record = validatedProjection(event.execution_projection);
  const state = record.state;
  return freeze({ ...record, journal_receipt: {
    operation_id: event.operation_id, event_id: event.journal_event_id, sequence: event.sequence, event_hash: event.event_hash,
  }, result: {
    schema_version: 1, phase: "B", mode: "shadow", operation_id: state.operation_id, intent_id: state.intent_id,
    revision: record.revision, status: state.status, completed: state.completed_steps, remaining: state.pending_steps,
    verification: state.verification_state, checkpoint: state.checkpoint, resume_point: state.resume_point,
    decision_required: state.status === "DECISION_REQUIRED", persistence_enabled: true,
    execution_enabled: false, resume_dispatch_enabled: false, production_default_changed: false, model_requests: 0,
    decision_owner: "GPT", execution_owner: "Pi", tool_owner: "MCP",
  } });
}

// Trusted host API only. No caller storage path, model, dispatcher or production route is accepted.
export function createPiExecutionStateStore({ journal = {
  readExecutionProjections: readDevExecutionProjections, appendExecutionProjection: appendDevExecutionProjection,
}, clock = () => new Date().toISOString(), resolveCheckpoint } = {}) {
  if (typeof journal.readExecutionProjections !== "function" || typeof journal.appendExecutionProjection !== "function"
    || typeof clock !== "function") fail("INVALID_STATE_STORE_BINDING");
  async function history() {
    let events;
    try { events = await journal.readExecutionProjections(); } catch (error) {
      if (["JOURNAL_APPEND_BUSY", "JOURNAL_SNAPSHOT_UNSTABLE"].includes(error.code)) throw error;
      fail("CORRUPT_STATE");
    }
    return validatePiExecutionHistory(events);
  }
  async function current({ operation_id, context, expected_revision }) {
    const event = (await history()).get(operation_id);
    if (!event) fail("UNKNOWN_PI_OPERATION");
    requireContext(event.execution_projection.state, context);
    if (expected_revision !== undefined && expected_revision !== event.execution_projection.revision) fail("STATE_REVISION_CONFLICT");
    return event;
  }
  async function publish(record, expected_revision) {
    const event = await journal.appendExecutionProjection(record, { expected_revision,
      validateHistory: validatePiExecutionHistory });
    return resultOf(event);
  }
  async function admit(source, options = {}) {
    const intent = createExecutionIntent(source);
    await history(); // Normalize integrity failures before any admission or publication.
    const state = initialState(intent, options);
    const record = projection({ schema_version: 1, revision: 1, previous_projection_hash: null,
      action_type: "operation_created", intent, state });
    return publish(record, 0);
  }
  async function advance(args) {
    const event = await current(args);
    const prior = event.execution_projection;
    if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 1) fail("STATE_REVISION_REQUIRED");
    const state = transitionOperation(prior.state, args.status, clock());
    return publish(projection({ schema_version: 1, revision: prior.revision + 1,
      previous_projection_hash: prior.projection_hash, action_type: transitionAction(state.status),
      intent: prior.intent, state }), prior.revision);
  }
  async function checkpoint(args) {
    const event = await current(args);
    const prior = event.execution_projection;
    if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 1) fail("STATE_REVISION_REQUIRED");
    if (terminal.has(prior.state.status)) fail("TERMINAL_OPERATION");
    let reference = { workspace_checkpoint_id: null, workspace_snapshot_id: null, git_head: null };
    if (args.workspace_checkpoint_id !== undefined) {
      if (typeof resolveCheckpoint !== "function") fail("CHECKPOINT_VERIFICATION_REQUIRED");
      if (!/^dev_checkpoint_[a-f0-9]{32}$/u.test(args.workspace_checkpoint_id)) fail("CHECKPOINT_CONTEXT_MISMATCH");
      const evidence = await resolveCheckpoint({ checkpoint_id: args.workspace_checkpoint_id, ...args.context });
      if (!evidence || evidence.checkpoint_id !== args.workspace_checkpoint_id
        || evidence.workspace_id !== prior.state.workspace_id || evidence.workstream_id !== prior.state.workstream_id
        || !/^[a-f0-9]{64}$/u.test(evidence.workspace_snapshot_id) || !/^[a-f0-9]{40}$/u.test(evidence.git_head)) fail("CHECKPOINT_CONTEXT_MISMATCH");
      reference = { workspace_checkpoint_id: evidence.checkpoint_id,
        workspace_snapshot_id: evidence.workspace_snapshot_id, git_head: evidence.git_head };
    }
    const now = clock();
    if (Date.parse(now) < Date.parse(prior.state.updated_at)) fail("NON_MONOTONIC_STATE_TIME");
    const state = validateOperationState({ ...prior.state, updated_at: now, checkpoint: {
      schema_version: 1, operation_id: prior.state.operation_id, intent_hash: prior.state.intent_hash,
      workspace_id: prior.state.workspace_id, at_revision: prior.revision, phase: prior.state.status,
      step_id: prior.state.current_step, ...reference,
    } });
    return publish(projection({ schema_version: 1, revision: prior.revision + 1,
      previous_projection_hash: prior.projection_hash, action_type: "checkpoint_saved",
      intent: prior.intent, state }), prior.revision);
  }
  return Object.freeze({ admit, advance, checkpoint, inspect: async args => resultOf(await current(args)) });
}
