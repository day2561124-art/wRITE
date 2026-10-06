import { createHash, randomUUID } from "node:crypto";
import {normalizePiWorkstreamBootstrap} from "./pi-workstream-bootstrap.mjs";

export const REQUIRED_DECISION_BOUNDARIES = Object.freeze([
  "implementation_failure", "architecture_conflict", "test_expectation_conflict",
  "scope_expansion", "multiple_implementation_choices", "unexpected_semantic_behavior",
  "requirement_ambiguity", "git_semantic_conflict", "validation_failure",
  "unsafe_ambiguous_mutation",
]);
export const PERMISSIONS = Object.freeze(["read", "workspace_create", "write", "tests", "commit", "integrate", "push"]);
const suites = ["mcp", "mcp_core", "mcp_pi_postseal", "mcp_infrastructure", "mcp_reliability", "mcp_tunnel",
  "communication", "world_simulation", "cognition", "memory_retrieval"];
function descriptor(capability, tool, permission, effect, required, optional = [], scope = "workspace") {
  return Object.freeze({ capability, tool, permission, effect, required: Object.freeze(required),
    optional: Object.freeze(optional), scope });
}
export const CAPABILITY_DEFINITIONS = Object.freeze([
  descriptor("filesystem.read", "dev_read_file", "read", false, ["path"], ["maxBytes"]),
  descriptor("filesystem.list", "dev_list_directory", "read", false, [], ["path", "maxEntries"]),
  descriptor("filesystem.write", "dev_create_file", "write", true, ["path", "content"]),
  descriptor("filesystem.patch", "dev_apply_patch", "write", true, ["path", "oldText", "newText", "expectedSha256"]),
  descriptor("workspace.begin_workstream", "dev_workspace_begin_workstream", "workspace_create", true, ["label"], ["purpose", "parent_workstream_id", "depends_on", "declared_scope"], "bootstrap"),
  descriptor("workspace.create", "dev_workspace_create_isolated", "workspace_create", true,
    ["workstream_id", "expected_workstream_revision"], [], "workstream"),
  descriptor("workspace.create_isolated", "dev_workspace_create_isolated", "workspace_create", true,
    ["workstream_id", "expected_workstream_revision"], [], "workstream"),
  descriptor("workspace.inspect", "dev_workspace_get_workspace", "read", false, []),
  descriptor("workspace.get_workstream", "dev_workspace_get_workstream", "read", false,
    ["workstream_id"], [], "workstream"),
  descriptor("workspace.update_workstream", "dev_workspace_update_workstream", "write", true,
    ["workstream_id", "expected_revision", "state"], ["blocker_resolution_operation_id", "declared_scope", "metadata"], "workstream_update"),
  descriptor("workspace.end_workstream", "dev_workspace_end_workstream", "write", true,
    ["workstream_id","expected_revision","outcome"], [], "workstream_end"),
  descriptor("workspace.get_checkpoint", "dev_workspace_get_checkpoint", "read", false,
    ["checkpoint_id"], [], "checkpoint"),
  descriptor("workspace.get_operation", "dev_workspace_get_operation", "read", false,
    ["operation_id"], [], "operation"),
  descriptor("workspace.list_operations", "dev_workspace_list_operations", "read", false,
    [], ["limit", "after_sequence", "outcome", "operation_type"], "operation_list"),
  descriptor("workspace.get_provenance", "dev_workspace_get_provenance", "read", false,
    ["path"], ["limit"], "provenance"),
  descriptor("workspace.create_checkpoint", "dev_workspace_create_checkpoint", "write", true,
    [], ["label"]),
  descriptor("verification.focused", "dev_run_tests", "tests", true, ["suite"]),
  descriptor("verification.affected", "dev_run_tests", "tests", true, ["suite"]),
  descriptor("verification.full", "dev_run_tests", "tests", true, ["suite"]),
  descriptor("git.status", "dev_git_status", "read", false, [], ["includeUntracked"]),
  descriptor("git.commit", "dev_git_commit", "commit", true, ["message", "paths", "expectedHead"]),
  descriptor("git.integrate", "dev_workspace_integrate", "integrate", true,
    ["integration_candidate_id", "expected_revision"], [], "candidate"),
  descriptor("git.push", "dev_git_push", "push", true, ["expectedHead"], [], "main"),
  descriptor("capability.schema.read", "dev_capability_get_schema", "read", false, ["capability_name"], ["expected_schema_version"], "capability"),
  descriptor("capability.list", "dev_capability_list", "read", false, [], ["capability_names", "offset", "limit"], "capability"),
  descriptor("execution.query", "dev_workspace_get_operation", "read", false, ["operation_id"], [], "operation"),
]);
const capabilityMap = new Map(CAPABILITY_DEFINITIONS.map(x => [x.capability, x]));
const workspacePattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const checkpointPattern = /^dev_checkpoint_[a-f0-9]{32}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sha1Pattern = /^[a-f0-9]{40}$/u;

function fail(code) { const e = new Error(code); e.code = code; throw e; }
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function fields(value, required, optional = []) {
  if (!object(value) || Object.keys(value).some(k => ![...required, ...optional].includes(k))
    || required.some(k => !Object.hasOwn(value, k))) fail("INVALID_CONTRACT_FIELDS");
}
function string(value, maximum = 2048) {
  if (typeof value !== "string" || !value.trim() || value.includes("\u0000")
    || Buffer.byteLength(value, "utf8") > maximum) fail("INVALID_CONTRACT_STRING");
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail("INVALID_CONTRACT_INTEGER");
}
function strings(value, maximum = 100) {
  if (!Array.isArray(value) || value.length > maximum) fail("INVALID_CONTRACT_LIST");
  value.forEach(x => string(x));
}
function relativePath(value) {
  string(value, 1024);
  if (/^(?:[\\/]|[a-z]:)/iu.test(value) || value.split(/[\\/]/u).includes("..")) fail("INVALID_RELATIVE_PATH");
}
function jsonCopy(value) {
  let nodes = 0;
  const visit = (item, depth = 0) => {
    if (++nodes > 20000 || depth > 32) fail("CONTRACT_COMPLEXITY_LIMIT");
    if (item === null || typeof item === "boolean" || typeof item === "string") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) fail("INVALID_JSON");
      return "[" + item.map(x => visit(x, depth + 1)).join(",") + "]";
    }
    if (object(item)) {
      return "{" + Object.keys(item).sort().map(k => {
        const property = Object.getOwnPropertyDescriptor(item, k);
        if (!property || !("value" in property)) fail("INVALID_JSON");
        return JSON.stringify(k) + ":" + visit(property.value, depth + 1);
      }).join(",") + "}";
    }
    fail("INVALID_JSON");
  };
  const serialized = visit(value);
  if (Buffer.byteLength(serialized, "utf8") > 512 * 1024) fail("CONTRACT_SIZE_LIMIT");
  return { value: JSON.parse(serialized), serialized };
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function hashExecutionInput(input) {
  return createHash("sha256").update(jsonCopy(input).serialized, "utf8").digest("hex");
}
export function capabilityDefinition(capability) {
  const result = capabilityMap.get(capability);
  if (!result) fail("UNKNOWN_CAPABILITY");
  return result;
}
export function assertCapabilityPermission(permissions, capability) {
  const definition = capabilityDefinition(capability);
  if (permissions[definition.permission] !== true) fail("PERMISSION_DENIED");
  return definition;
}
function validateInput(action, context, bootstrap = false) {
  const definition = capabilityDefinition(action.capability);
  const dynamicIsolation=bootstrap && action.capability==="workspace.create_isolated";
  fields(action.input, dynamicIsolation?[]:definition.required, dynamicIsolation?[]:definition.optional);
  if(action.capability==="workspace.begin_workstream") {
    if(!bootstrap) fail("BOOTSTRAP_INTENT_REQUIRED");
    normalizePiWorkstreamBootstrap({bootstrap_id:action.idempotency_key,...action.input});
  }
  const input = action.input;
  if ("path" in input) relativePath(input.path);
  if ("maxBytes" in input) integer(input.maxBytes, 1, 8192);
  if ("maxEntries" in input) integer(input.maxEntries, 1, 50);
  if ("limit" in input) integer(input.limit, 1, 50);
  if ("after_sequence" in input) integer(input.after_sequence, 0, Number.MAX_SAFE_INTEGER);
  if ("outcome" in input && !["completed", "failed", "recovered", "dangling"].includes(input.outcome)) fail("INVALID_OPERATION_OUTCOME");
  if ("outcome" in input && !["completed","abandoned"].includes(input.outcome)) fail("INVALID_WORKSTREAM_OUTCOME");
  if ("state" in input && !["active", "paused", "blocked"].includes(input.state)) fail("INVALID_WORKSTREAM_STATE");
  if ("operation_type" in input) string(input.operation_type, 160);
  if ("label" in input) string(input.label, 160);
  if ("blocker_resolution_operation_id" in input && !/^dev_operation_[a-f0-9]{32}$/u.test(input.blocker_resolution_operation_id)) fail("INVALID_OPERATION");
  if ("capability_name" in input && (typeof input.capability_name !== "string" || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,5}$/u.test(input.capability_name))) fail("INVALID_CAPABILITY_NAME");
  if ("expected_schema_version" in input) string(input.expected_schema_version, 16);
  if ("capability_names" in input) { strings(input.capability_names, 64); if(new Set(input.capability_names).size!==input.capability_names.length) fail("INVALID_CAPABILITY_QUERY"); }
  if ("offset" in input) integer(input.offset, 0, 128);
  if ("checkpoint_id" in input && !checkpointPattern.test(input.checkpoint_id)) fail("INVALID_CHECKPOINT");
  if ("includeUntracked" in input && typeof input.includeUntracked !== "boolean") fail("INVALID_BOOLEAN");
  if ("content" in input && (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > 256 * 1024)) fail("INVALID_MUTATION_CONTENT");
  for (const key of ["oldText", "newText"]) {
    if (key in input && (typeof input[key] !== "string" || Buffer.byteLength(input[key], "utf8") > 256 * 1024)) fail("INVALID_MUTATION_CONTENT");
  }
  if ("oldText" in input && !input.oldText) fail("EMPTY_PATCH_MATCH");
  if ("expectedSha256" in input && !sha256Pattern.test(input.expectedSha256)) fail("INVALID_SHA256");
  if ("expectedHead" in input && !sha1Pattern.test(input.expectedHead)) fail("INVALID_GIT_HEAD");
  if ("message" in input) string(input.message, 4096);
  if ("paths" in input) {
    strings(input.paths);
    if (!input.paths.length || new Set(input.paths).size !== input.paths.length) fail("INVALID_MUTATION_PATHS");
    input.paths.forEach(relativePath);
  }
  if ("expected_workstream_revision" in input) integer(input.expected_workstream_revision, 1, Number.MAX_SAFE_INTEGER);
  if ("workstream_id" in input && input.workstream_id !== context.workstream_id) fail("WORKSTREAM_MISMATCH");
  if ("expected_revision" in input) integer(input.expected_revision, 1, Number.MAX_SAFE_INTEGER);
  if ("integration_candidate_id" in input && !/^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u.test(input.integration_candidate_id)) fail("INVALID_CANDIDATE");
  if ("operation_id" in input && !/^dev_operation_[a-f0-9]{32}$/u.test(input.operation_id)) fail("INVALID_OPERATION");
  if ("suite" in input) {
    const allowed = action.capability === "verification.full" ? ["all"]
      : action.capability === "verification.affected" ? ["affected"] : suites;
    if (!allowed.includes(input.suite)) fail("VERIFICATION_CAPABILITY_MISMATCH");
  }
}
export function createExecutionIntent(input) {
  const intent = jsonCopy(input).value;
  fields(intent, ["schema_version", "intent_id", "goal", "context", "constraints", "requested_actions",
    "mutation_plan", "verification", "completion_conditions", "permissions", "decision_boundaries"], ["bootstrap"]);
  if (intent.schema_version !== 1) fail("UNSUPPORTED_INTENT_VERSION");
  string(intent.intent_id, 128); string(intent.goal, 4096);
  fields(intent.context, ["project_id", "workstream_id", "workspace_id"]);
  if(intent.bootstrap!==undefined && intent.bootstrap!==true) fail("INVALID_BOOTSTRAP_INTENT");
  const bootstrap=intent.bootstrap===true;
  if(bootstrap && (intent.context.workstream_id!==null || intent.context.workspace_id!=="dev_workspace_shared_repository_v1")) fail("INVALID_BOOTSTRAP_CONTEXT");
  if (intent.context.project_id !== "writer_workbench" || (!bootstrap && !workstreamPattern.test(intent.context.workstream_id))
    || !workspacePattern.test(intent.context.workspace_id)) fail("INVALID_EXECUTION_CONTEXT");
  strings(intent.constraints); strings(intent.completion_conditions); strings(intent.decision_boundaries);
  if (!intent.completion_conditions.length || REQUIRED_DECISION_BOUNDARIES.some(x => !intent.decision_boundaries.includes(x))) fail("MISSING_DECISION_BOUNDARY");
  fields(intent.permissions, PERMISSIONS);
  if (PERMISSIONS.some(x => typeof intent.permissions[x] !== "boolean")) fail("INVALID_PERMISSION_MODEL");
  if (!Array.isArray(intent.requested_actions) || !intent.requested_actions.length || intent.requested_actions.length > 100) fail("INVALID_ACTIONS");
  if (!Array.isArray(intent.mutation_plan) || intent.mutation_plan.length > 100) fail("INVALID_MUTATION_PLAN");
  const plans = new Map();
  for (const plan of intent.mutation_plan) {
    fields(plan, ["step_id", "target", "expected_change", "input_sha256"]);
    string(plan.step_id, 128); string(plan.target, 1024); string(plan.expected_change, 4096);
    if (!sha256Pattern.test(plan.input_sha256) || plans.has(plan.step_id)) fail("INVALID_MUTATION_PLAN");
    plans.set(plan.step_id, plan);
  }
  const steps = new Map(); const keys = new Set();
  for (const action of intent.requested_actions) {
    fields(action, ["step_id", "capability", "input"], ["depends_on", "idempotency_key", "expected_capability_version", "expected_schema_hash"]);
    string(action.step_id, 128);
    if (action.expected_capability_version !== undefined && (typeof action.expected_capability_version !== "string" || !/^[1-9][0-9]{0,2}(?:\.[0-9]{1,3}){0,2}$/u.test(action.expected_capability_version))) fail("INVALID_CAPABILITY_VERSION");
    if (action.expected_schema_hash !== undefined && !sha256Pattern.test(action.expected_schema_hash)) fail("INVALID_CAPABILITY_SCHEMA_HASH");
    if ((action.expected_capability_version === undefined) !== (action.expected_schema_hash === undefined)) fail("CAPABILITY_EXPECTATION_REQUIRED");
    if (steps.has(action.step_id)) fail("DUPLICATE_STEP");
    const dependencies = action.depends_on ?? [];
    strings(dependencies);
    if (new Set(dependencies).size !== dependencies.length || dependencies.some(x => !steps.has(x))) fail("INVALID_DEPENDENCY_ORDER");
    action.depends_on = dependencies;
    const definition = assertCapabilityPermission(intent.permissions, action.capability);
    validateInput(action, intent.context, bootstrap);
    const plan = plans.get(action.step_id);
    if (definition.effect) {
      if (action.capability === "workspace.create_checkpoint"
        && !bootstrap && intent.context.workspace_id === "dev_workspace_shared_repository_v1") fail("ISOLATED_WORKSPACE_REQUIRED");
      if (typeof action.idempotency_key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(action.idempotency_key)
        || keys.has(action.idempotency_key)) fail("INVALID_IDEMPOTENCY_KEY");
      keys.add(action.idempotency_key);
      if (!plan || plan.input_sha256 !== hashExecutionInput(action.input)) fail("MUTATION_CONTENT_MISMATCH");
      if (action.capability.startsWith("filesystem.") && plan.target !== action.input.path) fail("MUTATION_TARGET_MISMATCH");
      if (action.capability === "workspace.create_checkpoint" && plan.target !== (bootstrap?"bootstrap_workspace":intent.context.workspace_id)) fail("MUTATION_TARGET_MISMATCH");
      // workspace.create is the pre-Phase F alias; historical intents may use descriptive mutation targets.
      // Its actual workstream_id remains context-bound by validateInput above.
      if (["workspace.create_isolated", "workspace.update_workstream", "workspace.end_workstream"].includes(action.capability)
        && plan.target !== (bootstrap?"bootstrap_workstream":intent.context.workstream_id)) fail("MUTATION_TARGET_MISMATCH");
      if(action.capability==="workspace.begin_workstream" && plan.target!=="bootstrap_workstream") fail("MUTATION_TARGET_MISMATCH");
      plans.delete(action.step_id);
    } else if (plan || action.idempotency_key !== undefined) fail("UNEXPECTED_MUTATION_PLAN");
    steps.set(action.step_id, action);
  }
  if(bootstrap && (intent.requested_actions[0]?.capability!=="workspace.begin_workstream"
    || intent.requested_actions[1]?.capability!=="workspace.create_isolated"
    || !intent.requested_actions[1].depends_on.includes(intent.requested_actions[0].step_id)
    || intent.requested_actions.filter(a=>["workspace.begin_workstream","workspace.create","workspace.create_isolated"].includes(a.capability)).length!==2)) fail("INVALID_BOOTSTRAP_PLAN");
  if (plans.size) fail("UNREQUESTED_MUTATION");
  fields(intent.verification, ["focused", "affected", "full"]);
  const verificationIds = new Set();
  for (const level of ["focused", "affected", "full"]) {
    strings(intent.verification[level]);
    for (const stepId of intent.verification[level]) {
      if (verificationIds.has(stepId) || steps.get(stepId)?.capability !== "verification." + level) fail("INVALID_VERIFICATION_PLAN");
      verificationIds.add(stepId);
    }
  }
  for (const action of steps.values()) {
    if (action.capability.startsWith("verification.") && !verificationIds.has(action.step_id)) fail("UNDECLARED_VERIFICATION");
  }
  return freeze(intent);
}

const normalNext = Object.freeze({ CREATED: "ADMITTED", ADMITTED: "PREPARING", PREPARING: "EXECUTING",
  EXECUTING: "VERIFYING", VERIFYING: "COMMITTING", COMMITTING: "COMPLETED" });
export const OPERATION_STATUSES = Object.freeze([...Object.keys(normalNext), "COMPLETED",
  "WAITING_RETRY", "RECONCILING", "DECISION_REQUIRED", "BLOCKED", "FAILED", "CANCELLED"]);
const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const recoverablePhases = new Set(["PREPARING", "EXECUTING", "VERIFYING", "COMMITTING"]);
function timestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("INVALID_TIMESTAMP");
  return value;
}
export function createOperationState(input, options = {}) {
  const intent = createExecutionIntent(input);
  const now = timestamp(options.timestamp ?? new Date().toISOString());
  const operationId = options.operation_id ?? "pi_operation_" + randomUUID().replaceAll("-", "");
  if (!/^pi_operation_[a-f0-9]{32}$/u.test(operationId)) fail("INVALID_PI_OPERATION");
  const parent = options.parent_operation_id ?? null;
  if (parent !== null && !/^(?:pi|dev)_operation_[a-f0-9]{32}$/u.test(parent)) fail("INVALID_PARENT_OPERATION");
  return freeze({
    schema_version: 1, operation_id: operationId, intent_id: intent.intent_id, intent_hash: hashExecutionInput(intent),
    parent_operation_id: parent, ...intent.context, ...(intent.bootstrap?{bootstrap:true}:{}), status: "CREATED", current_phase: "CREATED", current_step: null,
    completed_steps: [], pending_steps: intent.requested_actions.map(x => x.step_id), tool_calls: [], tool_results: [],
    retry_count: 0, last_error: null, checkpoint: null, resume_point: null,
    idempotency_keys: Object.fromEntries(intent.requested_actions.filter(x => x.idempotency_key).map(x => [x.step_id, x.idempotency_key])),
    verification_state: { focused: "pending", affected: "pending", full: "pending" },
    created_at: now, updated_at: now, completed_at: null,
  });
}
export function validateOperationState(input) {
  const state = jsonCopy(input).value;
  fields(state, ["schema_version", "operation_id", "intent_id", "intent_hash", "parent_operation_id",
    "project_id", "workstream_id", "workspace_id", "status", "current_phase", "current_step",
    "completed_steps", "pending_steps", "tool_calls", "tool_results", "retry_count", "last_error",
    "checkpoint", "resume_point", "idempotency_keys", "verification_state", "created_at", "updated_at", "completed_at"], ["bootstrap"]);
  if (state.schema_version !== 1 || !/^pi_operation_[a-f0-9]{32}$/u.test(state.operation_id)
    || !sha256Pattern.test(state.intent_hash) || state.project_id !== "writer_workbench"
    || (state.bootstrap!==true && !workstreamPattern.test(state.workstream_id)) || !workspacePattern.test(state.workspace_id)
    || (state.bootstrap!==undefined && (state.bootstrap!==true || state.workstream_id!==null || state.workspace_id!=="dev_workspace_shared_repository_v1"))
    || !OPERATION_STATUSES.includes(state.status) || state.current_phase !== state.status) fail("CORRUPT_STATE");
  string(state.intent_id, 128);
  if (state.parent_operation_id !== null && !/^(?:pi|dev)_operation_[a-f0-9]{32}$/u.test(state.parent_operation_id)) fail("CORRUPT_STATE");
  strings(state.completed_steps); strings(state.pending_steps);
  const steps = [...state.completed_steps, ...state.pending_steps];
  if (new Set(steps).size !== steps.length || (state.current_step !== null && !state.pending_steps.includes(state.current_step))) fail("CORRUPT_STATE");
  if (!Array.isArray(state.tool_calls) || !Array.isArray(state.tool_results)
    || state.tool_calls.length > 1000 || state.tool_results.length > 1000) fail("CORRUPT_STATE");
  integer(state.retry_count, 0, Number.MAX_SAFE_INTEGER);
  if (!object(state.idempotency_keys)) fail("CORRUPT_STATE");
  for (const [step, key] of Object.entries(state.idempotency_keys)) {
    if (!steps.includes(step) || typeof key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(key)) fail("CORRUPT_STATE");
  }
  if (state.resume_point !== null) {
    fields(state.resume_point, ["phase", "step_id"]);
    if (!recoverablePhases.has(state.resume_point.phase)
      || (state.resume_point.step_id !== null && !steps.includes(state.resume_point.step_id))) fail("CORRUPT_STATE");
  }
  fields(state.verification_state, ["focused", "affected", "full"]);
  if (Object.values(state.verification_state).some(x => !["pending", "passed", "failed", "not_requested"].includes(x))) fail("CORRUPT_STATE");
  timestamp(state.created_at); timestamp(state.updated_at);
  if (Date.parse(state.updated_at) < Date.parse(state.created_at)) fail("CORRUPT_STATE");
  if (terminal.has(state.status)) {
    timestamp(state.completed_at);
    if (state.completed_at !== state.updated_at) fail("CORRUPT_STATE");
  } else if (state.completed_at !== null) fail("CORRUPT_STATE");
  if (state.status === "COMPLETED" && (state.pending_steps.length || state.current_step !== null
    || Object.values(state.verification_state).some(x => !["passed", "not_requested"].includes(x)))) fail("INCOMPLETE_EXECUTION");
  return freeze(state);
}
export function transitionOperation(input, next, now = new Date().toISOString()) {
  const state = jsonCopy(validateOperationState(input)).value;
  if (!OPERATION_STATUSES.includes(state.status) || !OPERATION_STATUSES.includes(next)
    || terminal.has(state.status)) fail("INVALID_STATE_TRANSITION");
  timestamp(now);
  if (Date.parse(now) < Date.parse(state.updated_at)) fail("NON_MONOTONIC_STATE_TIME");
  let allowed = normalNext[state.status] === next || next === "FAILED" || next === "CANCELLED";
  if (recoverablePhases.has(state.status) && ["WAITING_RETRY", "RECONCILING", "DECISION_REQUIRED", "BLOCKED"].includes(next)) {
    allowed = true;
    state.resume_point = { phase: state.status, step_id: state.current_step };
  }
  if (["WAITING_RETRY", "RECONCILING"].includes(state.status)) {
    allowed ||= next === state.resume_point?.phase || next === "DECISION_REQUIRED" || next === "RECONCILING";
  }
  if (!allowed) fail("INVALID_STATE_TRANSITION");
  return validateOperationState({ ...state, status: next, current_phase: next, updated_at: now, completed_at: terminal.has(next) ? now : null });
}
export function classifyExecutionFailure({ code, mutation = false, execution_state = "unknown" } = {}) {
  if (code === "ALREADY_COMPLETED") return Object.freeze({ action: "return_stored_result", reason: code });
  if (code === "CORRUPT_STATE") return Object.freeze({ action: "fail_safe", reason: code });
  if (code === "PERMISSION_DENIED") return Object.freeze({ action: "stop", reason: code });
  if (["TRANSPORT_ERROR", "TEMPORARY_UNAVAILABLE", "TIMEOUT"].includes(code)) {
    return Object.freeze({ action: mutation && execution_state !== "not_started" ? "reconcile" : "retry", reason: code });
  }
  return Object.freeze({ action: "decision_required", reason: typeof code === "string" ? code.slice(0, 80) : "UNCLASSIFIED_FAILURE" });
}
export function reconcileExecutionObservation({ state = "unknown", evidence_verified = false } = {}) {
  const observed = ["completed", "not_started", "partial", "unknown"].includes(state) ? state : "unknown";
  if (evidence_verified === true && observed === "not_started") {
    return Object.freeze({ state: observed, safe_to_retry: true, action: "retry_same_key" });
  }
  if (evidence_verified === true && observed === "completed") {
    return Object.freeze({ state: observed, safe_to_retry: false, action: "return_stored_result" });
  }
  return Object.freeze({ state: evidence_verified === true ? observed : "unknown", safe_to_retry: false, action: "decision_required" });
}
