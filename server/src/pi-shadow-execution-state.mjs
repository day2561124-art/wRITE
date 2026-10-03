import { createHash } from "node:crypto";
import { createExecutionIntent, validateOperationState, transitionOperation, hashExecutionInput } from "./pi-execution-contract.mjs";
import { createMcpCapabilityAdapter } from "./pi-mcp-adapter.mjs";
import { initialReliableState, reliableFailure as fail, reliableJson, stableJson } from "./pi-reliable-execution-state.mjs";

function exact(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) fail("CORRUPT_STATE");
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function shadowSteps(intent) {
  const adapter = createMcpCapabilityAdapter();
  let phaseIndex=0;
  return intent.requested_actions.map(action => {
    const step=adapter.describe(intent,action.step_id);
    const required=step.capability.startsWith("git.")&&step.effect?2:step.capability.startsWith("verification.")?1:0;
    const phase_conflict=step.effect&&required<phaseIndex;
    phaseIndex=Math.max(phaseIndex,required);
    return {...step,expected_phase:["EXECUTING","VERIFYING","COMMITTING"][phaseIndex],phase_conflict};
  });
}
function initialState(intent, options) {
  let state = initialReliableState(intent, options);
  state = transitionOperation(state, "ADMITTED", state.created_at);
  return transitionOperation(state, "PREPARING", state.created_at);
}
export function makeShadowProjection(body) {
  const serialized = stableJson(body);
  const record = { ...JSON.parse(serialized), projection_hash: createHash("sha256").update(serialized).digest("hex") };
  if (Buffer.byteLength(stableJson(record)) > 768 * 1024) fail("EXECUTION_PROJECTION_SIZE_LIMIT");
  return freeze(record);
}
export function createShadowProjection(source, options) {
  const intent = createExecutionIntent(source);
  return makeShadowProjection({ schema_version:3, revision:1, previous_projection_hash:null,
    action_type:"shadow_planned", intent, state:initialState(intent, options),
    shadow:{status:shadowSteps(intent).some(step=>step.phase_conflict)?"DECISION_REQUIRED":"OBSERVING",closed_at:null,observations:[],coverage_errors:[]}, command:{type:"shadow_planned"} });
}
function observationId(value) {
  if (!/^pi_shadow_call_[a-f0-9]{32}$/u.test(value)) fail("INVALID_OBSERVATION_ID");
}
function boundedString(value, maximum) {
  if (typeof value !== "string" || !value.length || value.length > maximum || value.includes("\u0000")) fail("INVALID_OBSERVATION");
}
export function shadowStartCommand({observation_id, step_id, params}) {
  observationId(observation_id); boundedString(step_id,128);
  const copy = reliableJson(params);
  if (!copy || typeof copy !== "object" || Array.isArray(copy)
    || !copy.arguments || typeof copy.arguments !== "object" || Array.isArray(copy.arguments)) fail("INVALID_OBSERVATION");
  boundedString(copy.name,160);
  const key = copy._meta?.reconciliation_key ?? null;
  if (key !== null) boundedString(key,128);
  const workspace = copy.arguments.workspace_id ?? null;
  if (workspace !== null) boundedString(workspace,128);
  return {type:"legacy_call_started",observation_id,step_id,tool:copy.name,
    input_hash:hashExecutionInput(copy.arguments),
    request_fingerprint_sha256:hashExecutionInput({tool_name:copy.name,arguments:copy.arguments}),
    idempotency_key:key,workspace_id:workspace};
}
function payloadOf(response) {
  if (response?.structuredContent && typeof response.structuredContent === "object") return response.structuredContent;
  const text = response?.content?.find?.(item => item.type === "text")?.text;
  if (typeof text === "string") { try { return JSON.parse(text); } catch {} }
  return response;
}
export function shadowCompleteCommand({observation_id,response,error}) {
  observationId(observation_id);
  if (error !== undefined && response !== undefined) fail("INVALID_OBSERVATION");
  if (error !== undefined) {
    const code = typeof error?.code === "string" && /^[A-Z0-9_:-]{1,80}$/u.test(error.code) ? error.code : "UNCLASSIFIED_FAILURE";
    return {type:"legacy_call_completed",observation_id,result_hash:hashExecutionInput({code}),
      outcome:"thrown",passed:null,legacy_operation_id:null,result_workspace_id:null,result_workstream_id:null,result_idempotency_key:null};
  }
  const value = reliableJson(response);
  if (Buffer.byteLength(JSON.stringify(value)) > 64 * 1024) fail("RESULT_LIMIT");
  const payload = payloadOf(value);
  const failed = value?.isError === true || value?.ok === false || value?.execution_ok === false || value?.passed === false
    || payload?.isError === true || payload?.ok === false || payload?.execution_ok === false || payload?.passed === false;
  const operationId = value?._meta?.operation_id ?? payload?.operation_id ?? null;
  return {type:"legacy_call_completed",observation_id,result_hash:hashExecutionInput(value),
    outcome:failed ? "tool_failure" : "completed",passed:payload?.passed === true ? true : payload?.passed === false ? false : null,
    legacy_operation_id:/^dev_operation_[a-f0-9]{32}$/u.test(operationId) ? operationId : null,
    result_workspace_id:payload?.workspace_context?.workspace_id??null,
    result_workstream_id:payload?.workspace_context?.workstream_id??null,
    result_idempotency_key:value?._meta?.reconciliation_key??payload?.reconciliation_key??null};
}
function differences(record) {
  const result = record.shadow.coverage_errors.map(() => ({observation_id:null,step_id:null,reason:"OBSERVATION_GAP"}));
  result.push(...shadowSteps(record.intent).filter(step=>step.phase_conflict).map(step=>
    ({observation_id:null,step_id:step.step_id,reason:"PHASE_ORDER_CONFLICT"})));
  result.push(...record.shadow.observations.flatMap(row => row.reasons.map(reason =>
    ({observation_id:row.observation_id,step_id:row.step_id,reason}))));
  if (record.shadow.closed_at !== null) {
    for (const row of record.shadow.observations.filter(row => row.completed_at === null)) {
      result.push({observation_id:row.observation_id,step_id:row.step_id,reason:"INCOMPLETE_CALL"});
    }
    for (const step of shadowSteps(record.intent)) {
      if (!record.shadow.observations.some(row => row.step_id === step.step_id && row.completed_at !== null && row.outcome === "completed")) {
        result.push({observation_id:null,step_id:step.step_id,reason:"MISSING_STEP"});
      }
    }
  }
  return result;
}
export function shadowComparison(record) {
  const steps = shadowSteps(record.intent);
  const diff = differences(record);
  const complete = record.shadow.closed_at !== null && record.shadow.observations.every(row => row.completed_at !== null);
  const completed = steps.filter(step => record.shadow.observations.some(row => row.step_id === step.step_id
    && row.completed_at !== null && row.outcome === "completed")).map(step => step.step_id);
  return {schema_version:3,phase:"D",mode:"passive_shadow",operation_id:record.state.operation_id,
    intent_id:record.intent.intent_id,revision:record.revision,status:record.shadow.status,
    planned_schedule:steps.map(step=>({step_id:step.step_id,capability:step.capability,tool:step.tool,
      expected_phase:step.expected_phase,permission:step.permission,effect:step.effect,scope:step.scope,
      depends_on:step.depends_on,idempotency_key:step.idempotency_key,input_hash:hashExecutionInput(step.arguments)})),
    differences:diff,observation_complete:complete,schedule_matched:record.shadow.status === "MATCHED",
    legacy_completed_steps:completed,remaining:steps.filter(step => !completed.includes(step.step_id)).map(step => step.step_id),
    verification_evidence:Object.fromEntries(Object.entries(record.intent.verification).map(([level,ids]) =>
      [level,ids.length ? ids.every(id => record.shadow.observations.some(row => row.step_id === id
        && row.outcome === "completed" && row.passed === true)) ? "passed" : "unconfirmed" : "not_requested"])),
    decision_required:diff.length > 0,engineering_review_required:true,state_is_observation_only:true,
    persistence_enabled:true,execution_enabled:false,resume_dispatch_enabled:false,mutation_dispatch_count:0,
    production_default_changed:false,model_requests:0,decision_owner:"GPT",execution_owner:"Pi",tool_owner:"MCP"};
}
export function reduceShadowProjection(previous, sourceCommand, timestamp) {
  const command = reliableJson(sourceCommand);
  const next = JSON.parse(stableJson(previous));
  if (previous.shadow.closed_at !== null) fail("SHADOW_CLOSED");
  const rows = next.shadow.observations;
  if (command.type === "legacy_call_started") {
    exact(command,["type","observation_id","step_id","tool","input_hash","request_fingerprint_sha256","idempotency_key","workspace_id"]);
    observationId(command.observation_id); boundedString(command.step_id,128); boundedString(command.tool,160);
    if (!/^[a-f0-9]{64}$/u.test(command.input_hash) || !/^[a-f0-9]{64}$/u.test(command.request_fingerprint_sha256)) fail("CORRUPT_STATE");
    if (command.idempotency_key !== null) boundedString(command.idempotency_key,128);
    if (command.workspace_id !== null) boundedString(command.workspace_id,128);
    if (rows.some(row => row.observation_id === command.observation_id)) fail("OBSERVATION_ID_CONFLICT");
    if (rows.length >= 200) fail("OBSERVATION_LIMIT");
    const steps = shadowSteps(previous.intent), step = steps.find(item => item.step_id === command.step_id);
    const reasons = [];
    if (!step) reasons.push("UNREQUESTED_STEP");
    if (rows.some(row => row.step_id === command.step_id)) reasons.push("DUPLICATE_STEP");
    if (rows.some(row => row.completed_at === null)) reasons.push("OVERLAPPING_CALL");
    if (steps[rows.length]?.step_id !== command.step_id) reasons.push("ORDER_MISMATCH");
    if (step) {
      if (step.tool !== command.tool) reasons.push("TOOL_MISMATCH");
      if (hashExecutionInput(step.arguments) !== command.input_hash
        || hashExecutionInput({tool_name:step.tool,arguments:step.arguments}) !== command.request_fingerprint_sha256) reasons.push("INPUT_MISMATCH");
      if (step.scope === "workspace" && command.workspace_id !== previous.intent.context.workspace_id) reasons.push("WORKSPACE_MISMATCH");
      if (step.idempotency_key !== command.idempotency_key) reasons.push("IDEMPOTENCY_KEY_MISMATCH");
      if (step.depends_on.some(id => !rows.some(row => row.step_id === id && row.completed_at !== null && row.outcome === "completed"))) {
        reasons.push("DEPENDENCY_NOT_COMPLETED");
      }
    }
    rows.push({...command,started_at:timestamp,completed_at:null,result_hash:null,outcome:null,
      passed:null,legacy_operation_id:null,result_workspace_id:null,result_workstream_id:null,result_idempotency_key:null,reasons});
    delete rows.at(-1).type;
  } else if (command.type === "legacy_call_completed") {
    exact(command,["type","observation_id","result_hash","outcome","passed","legacy_operation_id",
      "result_workspace_id","result_workstream_id","result_idempotency_key"]);
    observationId(command.observation_id);
    if (!/^[a-f0-9]{64}$/u.test(command.result_hash) || !["completed","tool_failure","thrown"].includes(command.outcome)
      || ![true,false,null].includes(command.passed)
      || (command.legacy_operation_id !== null && !/^dev_operation_[a-f0-9]{32}$/u.test(command.legacy_operation_id))) fail("CORRUPT_STATE");
    for(const key of ["result_workspace_id","result_workstream_id","result_idempotency_key"]) {
      if(command[key]!==null)boundedString(command[key],128);
    }
    const row = rows.find(row => row.observation_id === command.observation_id);
    if (!row || row.completed_at !== null) fail("OBSERVATION_ID_CONFLICT");
    Object.assign(row,{completed_at:timestamp,result_hash:command.result_hash,outcome:command.outcome,
      passed:command.passed,legacy_operation_id:command.legacy_operation_id,
      result_workspace_id:command.result_workspace_id,result_workstream_id:command.result_workstream_id,
      result_idempotency_key:command.result_idempotency_key});
    if (command.outcome !== "completed") row.reasons.push("LEGACY_FAILURE");
    const step = shadowSteps(previous.intent).find(step => step.step_id === row.step_id);
    if(step?.scope==="workspace"&&command.result_workspace_id!==null&&command.result_workspace_id!==previous.intent.context.workspace_id) {
      row.reasons.push("RESULT_WORKSPACE_MISMATCH");
    }
    if(command.result_workstream_id!==null&&command.result_workstream_id!==previous.intent.context.workstream_id)row.reasons.push("RESULT_WORKSTREAM_MISMATCH");
    if(command.result_idempotency_key!==null&&command.result_idempotency_key!==row.idempotency_key)row.reasons.push("RESULT_IDEMPOTENCY_KEY_MISMATCH");
    if (step?.capability.startsWith("verification.") && command.passed !== true) row.reasons.push("MISSING_VERIFICATION_PASS");
  } else if (command.type === "observation_gap") {
    exact(command,["type","error_count","codes"]);
    if (!Number.isSafeInteger(command.error_count) || command.error_count < 1 || !Array.isArray(command.codes)
      || command.codes.length > 100 || command.codes.some(code => typeof code !== "string" || !/^[A-Z0-9_:-]{1,80}$/u.test(code))) fail("CORRUPT_STATE");
    if (next.shadow.coverage_errors.length >= 200) fail("OBSERVATION_LIMIT");
    next.shadow.coverage_errors.push({error_count:command.error_count,codes:command.codes,timestamp});
  } else if (command.type === "shadow_closed") {
    exact(command,["type"]); next.shadow.closed_at = timestamp;
  } else fail("INVALID_SHADOW_COMMAND");
  if (Date.parse(timestamp) < Date.parse(previous.state.updated_at)) fail("NON_MONOTONIC_STATE_TIME");
  next.state = validateOperationState({...previous.state,updated_at:timestamp});
  const diff = differences(next);
  next.shadow.status = diff.length ? "DECISION_REQUIRED" : next.shadow.closed_at !== null ? "MATCHED" : "OBSERVING";
  if (diff.length && next.state.status === "PREPARING") next.state = transitionOperation(next.state,"DECISION_REQUIRED",timestamp);
  next.revision++; next.previous_projection_hash = previous.projection_hash; next.action_type = command.type; next.command = command;
  delete next.projection_hash;
  return makeShadowProjection(next);
}
export function validateShadowProjection(raw, prior) {
  try {
    exact(raw,["schema_version","revision","previous_projection_hash","projection_hash","action_type","intent","state","shadow","command"]);
    if (raw.schema_version !== 3 || !Number.isSafeInteger(raw.revision) || raw.revision < 1) fail("CORRUPT_STATE");
    createExecutionIntent(raw.intent); validateOperationState(raw.state);
    const {projection_hash,...body} = raw;
    if (projection_hash !== makeShadowProjection(body).projection_hash) fail("CORRUPT_STATE");
    let expected;
    if (!prior) {
      expected = createShadowProjection(raw.intent,{operation_id:raw.state.operation_id,
        parent_operation_id:raw.state.parent_operation_id,timestamp:raw.state.created_at});
    } else {
      if (prior.schema_version !== 3 || stableJson(raw.intent) !== stableJson(prior.intent)) fail("CORRUPT_STATE");
      expected = reduceShadowProjection(prior,raw.command,raw.state.updated_at);
    }
    if (stableJson(raw) !== stableJson(expected)) fail("CORRUPT_STATE");
    return expected;
  } catch { fail("CORRUPT_STATE"); }
}
