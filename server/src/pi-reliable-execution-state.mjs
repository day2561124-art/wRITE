import { createHash } from "node:crypto";
import { createExecutionIntent, createOperationState, validateOperationState, transitionOperation,
  hashExecutionInput, capabilityDefinition } from "./pi-execution-contract.mjs";
import {createMcpCapabilityAdapter} from "./pi-mcp-adapter.mjs";
import {piBootstrapBinding} from "./pi-workstream-bootstrap.mjs";
export function reliableFailure(code) { const e=new Error(code);e.code=code;throw e; }
export function reliableJson(value) {
  // Reuse the contract's accessor, depth and JSON checks before serialization.
  hashExecutionInput(value);return JSON.parse(JSON.stringify(value));
}
export function stableJson(value) {
  if(Array.isArray(value))return "["+value.map(stableJson).join(",")+"]";
  if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stableJson(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
export function projectionHash(value) { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function exact(v,keys) {
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==keys.length
    ||keys.some(k=>!Object.hasOwn(v,k)))reliableFailure("CORRUPT_STATE");
}
export function validateCanaryPolicy(source) {
  const p=reliableJson(source);
  if(!p||Array.isArray(p)||Object.keys(p).sort().join(",")!=="authorized_intents,cohort_id,max_operations,schema_version"
    ||p.schema_version!==1||!/^canary-[A-Za-z0-9_-]{1,96}$/u.test(p.cohort_id)
    ||!Number.isSafeInteger(p.max_operations)||p.max_operations<1||p.max_operations>10
    ||!Array.isArray(p.authorized_intents)||!p.authorized_intents.length||p.authorized_intents.length>10
    ||new Set(p.authorized_intents.map(x=>x?.intent_id)).size!==p.authorized_intents.length
    ||p.authorized_intents.some(x=>!x||Array.isArray(x)||Object.keys(x).sort().join(",")!=="intent_hash,intent_id"
      ||typeof x.intent_id!=="string"||!x.intent_id.length||x.intent_id.length>128||!/^[a-f0-9]{64}$/u.test(x.intent_hash)))
    reliableFailure("INVALID_CANARY_POLICY");
  return p;
}
export function validateCanaryBinding(value,intent) {
  exact(value,["cohort_id","policy_hash","policy"]);
  const policy=validateCanaryPolicy(value.policy);
  if(value.cohort_id!==policy.cohort_id||value.policy_hash!==hashExecutionInput(policy)
    ||(intent&&!policy.authorized_intents.some(x=>x.intent_id===intent.intent_id&&x.intent_hash===hashExecutionInput(intent))))
    reliableFailure("CORRUPT_STATE");
  return {...value,policy};
}
export function validateProductionBinding(value) {
 exact(value,["route_revision","route_hash"]);
 if(!Number.isSafeInteger(value.route_revision)||value.route_revision<1||!/^[a-f0-9]{64}$/u.test(value.route_hash))reliableFailure("CORRUPT_STATE");
 return {...value};
}
export const reliableTerminal=s=>["COMPLETED","FAILED","CANCELLED"].includes(s);
export function initialReliableState(intent,options) {
  return validateOperationState({...createOperationState(intent,options),verification_state:Object.fromEntries(
    Object.entries(intent.verification).map(([k,v])=>[k,v.length?"pending":"not_requested"]))});
}
export function validateRetryPolicy(p) {
  exact(p,["max_attempts","base_delay_ms","max_delay_ms"]);
  if(!Number.isSafeInteger(p.max_attempts)||p.max_attempts<1||p.max_attempts>10
    ||!Number.isSafeInteger(p.base_delay_ms)||p.base_delay_ms<1||p.base_delay_ms>60000
    ||!Number.isSafeInteger(p.max_delay_ms)||p.max_delay_ms<p.base_delay_ms||p.max_delay_ms>300000)reliableFailure("INVALID_RETRY_POLICY");
  return {...p};
}
function validateOwner(o) {
  exact(o,["worker_id","pid","hostname"]);
  if(!/^pi_worker_[a-f0-9]{32}$/u.test(o.worker_id)||!Number.isSafeInteger(o.pid)||o.pid<1
    ||typeof o.hostname!=="string"||!o.hostname.length||o.hostname.length>255)reliableFailure("CORRUPT_STATE");
}
export function receiptOf(step,evidence,kind="tool_response") {
  const data=reliableJson(evidence);
  if(Buffer.byteLength(JSON.stringify(data))>64*1024)reliableFailure("RESULT_LIMIT");
  return {step_id:step.step_id,input_hash:hashExecutionInput(step.input),
    result_hash:hashExecutionInput(data),kind,original_response_available:kind==="tool_response",evidence:data};
}
function receipt(value,action) {
  exact(value,["step_id","input_hash","result_hash","kind","original_response_available","evidence"]);
  if(value.step_id!==action.step_id||value.input_hash!==hashExecutionInput(action.input)
    ||value.result_hash!==hashExecutionInput(value.evidence)||!["tool_response","reconciled_facts"].includes(value.kind)
    ||value.original_response_available!==(value.kind==="tool_response")
    ||Buffer.byteLength(JSON.stringify(value.evidence))>64*1024)reliableFailure("CORRUPT_STATE");
}
function factualObjects(evidence) {
  const values=[evidence];
  if(evidence?.structuredContent)values.push(evidence.structuredContent);
  for(const item of evidence?.content??[])if(item.type==="text") {
    try {const v=JSON.parse(item.text);if(v&&typeof v==="object")values.push(v);}catch {}
  }
  return values;
}
function reconciliationBinding(action,context,evidence,binding=null) {
  const definition=capabilityDefinition(action.capability);
  const effective=binding??context;
  const args={...action.input,...(definition.scope==="workspace"?{workspace_id:effective.workspace_id}:{})};
  if(binding && action.capability==="workspace.create_isolated") {args.workstream_id=binding.workstream_id;args.expected_workstream_revision=binding.workstream_revision;}
  return evidence.reconciliation_key===action.idempotency_key
    &&evidence.request_fingerprint_sha256===hashExecutionInput({tool_name:definition.tool,arguments:args});
}
export function makeReliableProjection(body) {
  const record={...body,projection_hash:projectionHash(body)};
  if(Buffer.byteLength(stableJson(record))>768*1024)reliableFailure("EXECUTION_PROJECTION_SIZE_LIMIT");
  return record;
}
// A deterministic reducer: the only state changes admitted by the durable history validator.
export function reduceReliableProjection(prior,command,now) {
  if(reliableTerminal(prior.state.status))reliableFailure("TERMINAL_OPERATION");
  if(!Number.isFinite(Date.parse(now))||new Date(now).toISOString()!==now
    ||Date.parse(now)<Date.parse(prior.state.updated_at))reliableFailure("NON_MONOTONIC_STATE_TIME");
  const state=reliableJson(prior.state),runtime=reliableJson(prior.runtime);
  const action=prior.intent.requested_actions.find(x=>x.step_id===state.current_step);
  const active=runtime.active_call;
  const own=()=>{if(!runtime.owner||command.worker_id!==runtime.owner.worker_id)reliableFailure("OWNER_CONFLICT");};
  const noCall=()=>{if(runtime.active_call)reliableFailure("IN_FLIGHT_CALL");};
  const currentCall=()=>{own();if(!active||command.call_id!==active.call_id||!action)reliableFailure("STALE_TOOL_RESPONSE");};
  const checkpoint=step=>{state.checkpoint={schema_version:2,operation_id:state.operation_id,intent_hash:state.intent_hash,
    workspace_id:state.workspace_id,at_revision:prior.revision+1,phase:active?.phase??state.status,step_id:step};};
  const finish=(r)=>{
    receipt(r,action);
    if(r.kind==="tool_response") {
      const facts=factualObjects(r.evidence);
      if(facts.some(x=>x?.isError===true||x?.ok===false||x?.execution_ok===false||x?.passed===false)
        ||(action.capability.startsWith("verification.")&&!facts.some(x=>x?.passed===true)))
        reliableFailure("INVALID_SUCCESS_RECEIPT");
    } else if(!reconciliationBinding(action,prior.intent.context,r.evidence,prior.runtime.lifecycle_binding??null)
      ||!/^dev_operation_[a-f0-9]{32}$/u.test(r.evidence.operation_id)
      ||(action.capability.startsWith("verification.")&&r.evidence.original_result?.passed!==true))
      reliableFailure("INVALID_RECONCILIATION");
    if(prior.intent.bootstrap && ["workspace.begin_workstream","workspace.create_isolated"].includes(action.capability)) {
      const fact=r.kind==="reconciled_facts"?r.evidence.original_result:factualObjects(r.evidence).find(v=>v?.workstream_id&&v?.workspace_id);
      runtime.lifecycle_binding=piBootstrapBinding(runtime.lifecycle_binding,action.capability,fact);
    }
    state.tool_results.push({call_id:active.call_id,step_id:action.step_id,
      input_hash:r.input_hash,result_hash:r.result_hash,receipt_hash:hashExecutionInput(r)});
    state.completed_steps.push(action.step_id);state.pending_steps=state.pending_steps.filter(x=>x!==action.step_id);
    for(const [level,steps] of Object.entries(prior.intent.verification)) {
      if(steps.length&&steps.every(x=>state.completed_steps.includes(x)))state.verification_state[level]="passed";
    }
    checkpoint(action.step_id);state.current_step=null;runtime.active_call=null;runtime.retry_at=null;state.last_error=null;
  };
  switch(command.type) {
    case "owner_acquired":
      exact(command,["type","owner","replaced_worker_id"]);validateOwner(command.owner);
      if(command.replaced_worker_id!==(runtime.owner?.worker_id??null))reliableFailure("OWNER_CONFLICT");
      runtime.owner=command.owner;break;
    case "owner_released":
      exact(command,["type","worker_id"]);own();noCall();runtime.owner=null;break;
    case "phase_changed":
      exact(command,["type","worker_id","status"]);own();noCall();
      if(!["CREATED","ADMITTED","PREPARING","EXECUTING","VERIFYING","COMMITTING"].includes(state.status)
        ||!["ADMITTED","PREPARING","EXECUTING","VERIFYING","COMMITTING","COMPLETED"].includes(command.status))reliableFailure("INVALID_PHASE_COMMAND");
      Object.assign(state,transitionOperation(state,command.status,now));break;
    case "tool_call_started": {
      exact(command,["type","worker_id","call_id","step_id"]);own();noCall();
      if(!/^pi_call_[a-f0-9]{32}$/u.test(command.call_id)||state.pending_steps[0]!==command.step_id
        ||!["EXECUTING","VERIFYING","COMMITTING"].includes(state.status))reliableFailure("INVALID_STEP_CLAIM");
      const step=prior.intent.requested_actions.find(x=>x.step_id===command.step_id);
      if((step.depends_on??[]).some(x=>!state.completed_steps.includes(x)))reliableFailure("STEP_DEPENDENCY_UNSATISFIED");
      const attempt=state.tool_calls.filter(x=>x.step_id===step.step_id).length+1;
      if(attempt>runtime.retry_policy.max_attempts)reliableFailure("RETRY_EXHAUSTED");
      if(state.tool_calls.some(x=>x.call_id===command.call_id))reliableFailure("DUPLICATE_CALL_ID");
      const definition=capabilityDefinition(step.capability);
      const required=step.capability.startsWith("git.")&&definition.effect?"COMMITTING"
        :step.capability.startsWith("verification.")?"VERIFYING":"EXECUTING";
      if(["EXECUTING","VERIFYING","COMMITTING"].indexOf(state.status)<["EXECUTING","VERIFYING","COMMITTING"].indexOf(required)
        ||(definition.effect&&required!==state.status))reliableFailure("PHASE_ORDER_CONFLICT");
      runtime.active_call={call_id:command.call_id,step_id:step.step_id,attempt,input_hash:hashExecutionInput(step.input),
        idempotency_key:step.idempotency_key??null,mutation:definition.effect,phase:state.status,reconciliation_attempt:0};
      state.tool_calls.push({...runtime.active_call,started_at:now});state.current_step=step.step_id;
      checkpoint(step.step_id);break;
    }
    case "tool_call_completed":
      exact(command,["type","worker_id","call_id","receipt"]);currentCall();
      if(!["EXECUTING","VERIFYING","COMMITTING"].includes(state.status))reliableFailure("INVALID_COMPLETION_PHASE");
      finish(command.receipt);break;
    case "reconciliation_started":
      exact(command,["type","worker_id","call_id"]);currentCall();
      if(!active.mutation||active.reconciliation_attempt>=runtime.retry_policy.max_attempts||runtime.retry_at!==null)
        reliableFailure("INVALID_RECONCILIATION");
      active.reconciliation_attempt++;
      if(state.status!=="RECONCILING")Object.assign(state,transitionOperation(state,"RECONCILING",now));break;
    case "reconciliation_poll_scheduled":
      exact(command,["type","worker_id","call_id","receipt"]);currentCall();
      receipt(command.receipt,action);
      if(state.status!=="RECONCILING"||command.receipt.kind!=="reconciled_facts"
        ||command.receipt.evidence.reconciliation_state!=="active"
        ||!reconciliationBinding(action,prior.intent.context,command.receipt.evidence,prior.runtime.lifecycle_binding??null))reliableFailure("INVALID_RECONCILIATION");
      runtime.retry_at=new Date(Date.parse(now)+Math.min(runtime.retry_policy.max_delay_ms,
        runtime.retry_policy.base_delay_ms*2**(active.reconciliation_attempt-1))).toISOString();state.retry_count++;break;
    case "reconciliation_read_retry_scheduled":
      exact(command,["type","worker_id","call_id","code"]);currentCall();
      if(state.status!=="RECONCILING"||!["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT"].includes(command.code))
        reliableFailure("INVALID_RECONCILIATION");
      runtime.retry_at=new Date(Date.parse(now)+Math.min(runtime.retry_policy.max_delay_ms,
        runtime.retry_policy.base_delay_ms*2**(active.reconciliation_attempt-1))).toISOString();
      state.retry_count++;state.last_error={code:command.code,step_id:action.step_id};break;
    case "reconciliation_poll_resumed":
      exact(command,["type","worker_id","call_id"]);currentCall();
      if(state.status!=="RECONCILING"||runtime.retry_at===null||Date.parse(now)<Date.parse(runtime.retry_at))
        reliableFailure("RETRY_NOT_DUE");
      runtime.retry_at=null;break;
    case "connection_reconnect_requested":
    case "connection_reconnected":
      exact(command,["type","worker_id","call_id","code"]);currentCall();
      if(!["TIMEOUT","TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE"].includes(command.code))reliableFailure("INVALID_RECONNECT");
      if(command.type==="connection_reconnected"&&prior.command.type!=="connection_reconnect_requested")
        reliableFailure("INVALID_RECONNECT");
      break;
    case "reconciliation_completed":
      exact(command,["type","worker_id","call_id","receipt"]);currentCall();
      if(state.status!=="RECONCILING"||!active.mutation||command.receipt.kind!=="reconciled_facts"
        ||command.receipt.evidence.reconciliation_state!=="completed")reliableFailure("INVALID_RECONCILIATION");
      finish(command.receipt);Object.assign(state,transitionOperation(state,active.phase,now));state.resume_point=null;break;
    case "retry_scheduled": {
      exact(command,["type","worker_id","call_id","code","not_started_receipt"]);currentCall();
      if(!["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT","WORKER_INTERRUPTED"].includes(command.code)
        ||active.attempt>=runtime.retry_policy.max_attempts)reliableFailure("UNSAFE_RETRY");
      if(active.mutation) {
        if(state.status!=="RECONCILING"||!command.not_started_receipt)reliableFailure("UNSAFE_RETRY");
        receipt(command.not_started_receipt,action);
        const e=command.not_started_receipt.evidence;
        if(e.reconciliation_state!=="not_admitted"||e.safe_same_key_retry!==true||!reconciliationBinding(action,prior.intent.context,e,prior.runtime.lifecycle_binding??null))
          reliableFailure("UNSAFE_RETRY");
        Object.assign(state,transitionOperation(state,active.phase,now));
      } else if(command.not_started_receipt!==null)reliableFailure("UNSAFE_RETRY");
      Object.assign(state,transitionOperation(state,"WAITING_RETRY",now));
      runtime.retry_at=new Date(Date.parse(now)+Math.min(runtime.retry_policy.max_delay_ms,
        runtime.retry_policy.base_delay_ms*2**(active.attempt-1))).toISOString();
      runtime.active_call=null;state.current_step=null;state.retry_count++;state.last_error={code:command.code,step_id:action.step_id};break;
    }
    case "retry_resumed":
      exact(command,["type","worker_id"]);own();noCall();
      if(state.status!=="WAITING_RETRY"||Date.parse(now)<Date.parse(runtime.retry_at))reliableFailure("RETRY_NOT_DUE");
      Object.assign(state,transitionOperation(state,state.resume_point.phase,now));state.resume_point=null;runtime.retry_at=null;break;
    case "decision_requested":
      exact(command,["type","worker_id","code","status","receipt"]);own();
      if(!/^[A-Z][A-Z0-9_]{0,63}$/u.test(command.code)||!["DECISION_REQUIRED","BLOCKED","FAILED"].includes(command.status))
        reliableFailure("INVALID_FAILURE");
      if(command.receipt!==null){if(!action)reliableFailure("CORRUPT_STATE");receipt(command.receipt,action);}
      state.last_error={code:command.code,step_id:state.current_step};
      if(action)for(const [level,steps] of Object.entries(prior.intent.verification))
        if(steps.includes(action.step_id))state.verification_state[level]="failed";
      Object.assign(state,transitionOperation(state,command.status,now));runtime.active_call=null;runtime.retry_at=null;runtime.owner=null;break;
    default:reliableFailure("INVALID_RELIABILITY_COMMAND");
  }
  state.updated_at=now;if(reliableTerminal(state.status))runtime.owner=null;
  return makeReliableProjection({schema_version:2,revision:prior.revision+1,
    previous_projection_hash:prior.projection_hash,action_type:command.type,intent:prior.intent,
    state:validateOperationState(state),runtime,command:reliableJson(command)});
}
export function validateReliableProjection(value,prior) {
  try {
    exact(value,["schema_version","revision","previous_projection_hash","projection_hash","action_type","intent","state","runtime","command"]);
    const {projection_hash,...body}=value;
    if(value.schema_version!==2||projection_hash!==projectionHash(body)
      ||Buffer.byteLength(stableJson(value))>768*1024)reliableFailure("CORRUPT_STATE");
    const intent=createExecutionIntent(value.intent);const state=validateOperationState(value.state);
    exact(value.runtime,intent.bootstrap?["retry_policy","owner","active_call","retry_at","lifecycle_binding"]:["retry_policy","owner","active_call","retry_at"]);
    validateRetryPolicy(value.runtime.retry_policy);
    if(value.runtime.owner!==null)validateOwner(value.runtime.owner);
    if(!prior) {
      exact(value.command,Object.hasOwn(value.command,"production_binding")?["type","production_binding"]:Object.hasOwn(value.command,"canary_binding")?["type","canary_binding"]:["type"]);
      if(Object.hasOwn(value.command,"canary_binding"))validateCanaryBinding(value.command.canary_binding,intent);
      if(Object.hasOwn(value.command,"production_binding"))validateProductionBinding(value.command.production_binding);
      if(value.command.type!=="operation_created"||value.action_type!=="operation_created"||value.revision!==1
        ||value.previous_projection_hash!==null||value.runtime.owner!==null||value.runtime.active_call!==null
        ||value.runtime.retry_at!==null||(intent.bootstrap && value.runtime.lifecycle_binding!==null)||stableJson(state)!==stableJson(initialReliableState(intent,{
          operation_id:state.operation_id,parent_operation_id:state.parent_operation_id,timestamp:state.created_at})))reliableFailure("CORRUPT_STATE");
    } else {
      if(prior.schema_version!==2||value.revision!==prior.revision+1||value.previous_projection_hash!==prior.projection_hash
        ||stableJson(intent)!==stableJson(prior.intent)||value.action_type!==value.command.type
        ||stableJson(value)!==stableJson(reduceReliableProjection(prior,value.command,state.updated_at)))reliableFailure("CORRUPT_STATE");
    }
    return value;
  } catch {reliableFailure("CORRUPT_STATE");}
}
