import { randomUUID } from "node:crypto";
import {traceSpan} from "./mcp-request-tracing.mjs";
import { hostname } from "node:os";
import { reliableTerminal, reliableFailure, stableJson, reduceReliableProjection } from "./pi-reliable-execution-state.mjs";
import { reliableErrorCode } from "./pi-mcp-reliable-adapter.mjs";
const phases=["EXECUTING","VERIFYING","COMMITTING"];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createPiReliableExecutionEngine({store,adapter,retryPolicy={max_attempts:3,base_delay_ms:250,max_delay_ms:5000},
  sleep=delay,clock=()=>new Date().toISOString(),executionHook}={}) {
  if(!store||!adapter||typeof sleep!=="function"||typeof clock!=="function")reliableFailure("HOST_ENGINE_UNBOUND");
  async function execute(source) {
    let record=await traceSpan("pi.admission",()=>store.admit(source,{retry_policy:retryPolicy}));
    const stopped=()=>record.runtime.isolation||reliableTerminal(record.state.status)||["DECISION_REQUIRED","BLOCKED"].includes(record.state.status);
    if(stopped())return record;
    const worker={worker_id:"pi_worker_"+randomUUID().replaceAll("-",""),pid:process.pid,hostname:hostname()};
    const binding=()=>({binding:record.runtime.lifecycle_binding??null});
    const args=()=>({operation_id:record.state.operation_id,context:record.intent.context,expected_revision:record.revision});
    const inspect=()=>store.inspect({operation_id:record.state.operation_id,context:record.intent.context});
    async function send(command) {record=await traceSpan("pi.state_transition",()=>store.command({...args(),command}));return record;}
    const own=command=>send({...command,worker_id:worker.worker_id});
    async function stop(code,status="DECISION_REQUIRED",receipt=null) {
      return own({type:"decision_requested",code,status,receipt});
    }
    const owner=record.runtime.owner;
    if(owner) {
      const alive=await store.isOwnerAlive(owner);
      if(alive!==false)return {...record,result:{...record.result,dispatch_paused:true,
        pause_reason:alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN"}};
    }
    try {await send({type:"owner_acquired",owner:worker,replaced_worker_id:owner?.worker_id??null});}
    catch(e){if(["STATE_REVISION_CONFLICT","OWNER_ACTIVE","OWNER_LIVENESS_UNCERTAIN"].includes(e.code))return inspect();throw e;}
    async function scheduleRetry(code,proof=null) {
      const call=record.runtime.active_call;
      if(call.attempt>=record.runtime.retry_policy.max_attempts)return stop("RETRY_EXHAUSTED");
      await own({type:"retry_scheduled",call_id:call.call_id,code,not_started_receipt:proof});
      await executionHook?.("retry_scheduled",record);return record;
    }
    async function reconcile() {
      const call=record.runtime.active_call;
      if(record.runtime.retry_at!==null) {
        await sleep(Math.max(0,Date.parse(record.runtime.retry_at)-Date.parse(clock())));
        await own({type:"reconciliation_poll_resumed",call_id:call.call_id});
      }
      if(call.reconciliation_attempt>=record.runtime.retry_policy.max_attempts)return stop("RECONCILIATION_RETRY_EXHAUSTED");
      await own({type:"reconciliation_started",call_id:call.call_id});
      let observed;
      try {observed=await traceSpan("pi.reconciliation",()=>adapter.reconcile(record.intent,call.step_id,binding()));}
      catch(error) {
        const code=reliableErrorCode(error);
        if(["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT"].includes(code)
          &&record.runtime.active_call.reconciliation_attempt<record.runtime.retry_policy.max_attempts) {
          if(adapter.reconnect) {
            await own({type:"connection_reconnect_requested",call_id:call.call_id,code});
            try {await adapter.reconnect();}catch {return stop("RECONNECT_UNAVAILABLE");}
            await own({type:"connection_reconnected",call_id:call.call_id,code});
          }
          return own({type:"reconciliation_read_retry_scheduled",call_id:call.call_id,code});
        }
        return stop("RECONCILIATION_UNAVAILABLE");
      }
      if(observed.verdict==="completed") {
        await own({type:"reconciliation_completed",call_id:call.call_id,receipt:observed.receipt});
        return;
      }
      if(observed.verdict==="not_started")return scheduleRetry("WORKER_INTERRUPTED",observed.receipt);
      if(observed.verdict==="active") {
        if(record.runtime.active_call.reconciliation_attempt>=record.runtime.retry_policy.max_attempts)
          return stop("RECONCILIATION_RETRY_EXHAUSTED");
        return own({type:"reconciliation_poll_scheduled",call_id:call.call_id,receipt:observed.receipt});
      }
      return stop(observed.code??"UNSAFE_AMBIGUOUS_MUTATION");
    }
    while(!stopped()) {
      const state=record.state;
      if(["CREATED","ADMITTED","PREPARING"].includes(state.status)) {
        await own({type:"phase_changed",status:{CREATED:"ADMITTED",ADMITTED:"PREPARING",PREPARING:"EXECUTING"}[state.status]});
        continue;
      }
      if(record.runtime.active_call) {
        // This durable claim predates the current worker. Never infer that a send had no effect.
        if(record.runtime.active_call.mutation)await reconcile();else await scheduleRetry("WORKER_INTERRUPTED");
        continue;
      }
      if(state.status==="WAITING_RETRY") {
        const wait=Math.max(0,Date.parse(record.runtime.retry_at)-Date.parse(clock()));
        await sleep(wait);
        await own({type:"retry_resumed"});continue;
      }
      if(!state.pending_steps.length) {
        const next={EXECUTING:"VERIFYING",VERIFYING:"COMMITTING",COMMITTING:"COMPLETED"}[state.status];
        if(!next){await stop("UNEXPECTED_EXECUTION_PHASE");continue;}
        await own({type:"phase_changed",status:next});continue;
      }
      const stepId=state.pending_steps[0],step=adapter.describe(record.intent,stepId,binding());
      const required=step.capability.startsWith("git.")&&step.effect?"COMMITTING"
        :step.capability.startsWith("verification.")?"VERIFYING":"EXECUTING";
      const currentIndex=phases.indexOf(state.status),requiredIndex=phases.indexOf(required);
      if(currentIndex<0||(step.effect&&currentIndex>requiredIndex)) {
        await stop("PHASE_ORDER_CONFLICT");continue;
      }
      if(currentIndex<requiredIndex) {await own({type:"phase_changed",status:phases[currentIndex+1]});continue;}
      const callId="pi_call_"+randomUUID().replaceAll("-","");
      await own({type:"tool_call_started",call_id:callId,step_id:stepId});
      await executionHook?.("after_claim",record);
      let response;
      try {
        await executionHook?.("before_dispatch",record);
        const fence={...args(),expected_projection_hash:record.projection_hash,worker_id:worker.worker_id,call_id:callId};
        const authorizeDispatch=()=>store.assertDispatchAuthorized(fence);
        await authorizeDispatch();
        response=await traceSpan("pi.capability_dispatch",()=>adapter.execute(record.intent,stepId,{...binding(),authorizeDispatch}));
        await executionHook?.("after_dispatch",record);
      } catch(error) {
        if(["OPERATION_ISOLATED","STATE_REVISION_CONFLICT","STATE_PROJECTION_CONFLICT","OWNER_CONFLICT","STALE_TOOL_RESPONSE"].includes(error.code))return inspect();
        const code=reliableErrorCode(error);
        const classification=adapter.classify({code,mutation:step.effect,execution_state:"unknown"});
        if(["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT"].includes(code)&&adapter.reconnect) {
          await own({type:"connection_reconnect_requested",call_id:callId,code});
          try {await adapter.reconnect();}
          catch {await stop("RECONNECT_UNAVAILABLE");continue;}
          await own({type:"connection_reconnected",call_id:callId,code});
        }
        if(classification.action==="stop")await stop(code,"BLOCKED");
        else if(classification.action==="fail_safe")await stop(code,"FAILED");
        else if(step.effect&&["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT","UNCLASSIFIED_FAILURE"].includes(code))await reconcile();
        else if(classification.action==="retry")await scheduleRetry(code);
        else await stop(code);
        continue;
      }
      if(response.failed){await stop(response.error_code,"DECISION_REQUIRED",response.receipt);continue;}
      await own({type:"tool_call_completed",call_id:callId,receipt:response.receipt});
      await executionHook?.("after_receipt",record);
    }
    return record;
  }
  // Reconcile one existing claim only. No admission, dispatch, retry or next step.
  async function reconcileOnly(args) {
    if(!args||Object.keys(args).sort().join(",")!=="context,expected_owner,expected_revision,operation_id"
      ||!Number.isSafeInteger(args.expected_revision)||args.expected_revision<1)reliableFailure("INVALID_RECONCILIATION_REQUEST");
    let record=await store.inspect(args);
    if(!record.runtime.owner||stableJson(record.runtime.owner)!==stableJson(args.expected_owner))reliableFailure("OWNER_CONFLICT");
    const paused=code=>({...record,result:{...record.result,reconciliation_only:true,dispatch_paused:true,pause_reason:code}});
    if(record.runtime.isolation)return paused("OPERATION_ISOLATED");
    const call=record.runtime.active_call;
    if(!call?.mutation||!["EXECUTING","VERIFYING","COMMITTING","RECONCILING"].includes(record.state.status)
      ||record.runtime.retry_at!==null||call.reconciliation_attempt>=record.runtime.retry_policy.max_attempts)
      return paused("RECONCILIATION_NOT_READY");
    const alive=await store.isOwnerAlive(record.runtime.owner);
    if(alive!==false)return paused(alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN");
    let observed;
    try {observed=await adapter.reconcile(record.intent,call.step_id,{binding:record.runtime.lifecycle_binding??null});}
    catch {return paused("RECONCILIATION_UNAVAILABLE");}
    // Even a proven not-admitted call stays fenced: this entry never schedules replay.
    if(observed.verdict!=="completed")return paused(observed.code??"COMPLETED_RECEIPT_REQUIRED");
    const worker={worker_id:"pi_worker_"+randomUUID().replaceAll("-",""),pid:process.pid,hostname:hostname()};
    const commands=[{type:"owner_acquired",owner:worker,replaced_worker_id:record.runtime.owner.worker_id},
      {type:"reconciliation_started",worker_id:worker.worker_id,call_id:call.call_id},
      {type:"reconciliation_completed",worker_id:worker.worker_id,call_id:call.call_id,receipt:observed.receipt},
      {type:"owner_released",worker_id:worker.worker_id}];
    // Validate the full receipt/binding before changing ownership. Actual writes
    // still use fresh store reads, append-lock revision CAS and liveness fencing.
    commands.reduce((prior,command)=>reduceReliableProjection(prior,command,prior.state.updated_at),record);
    for(const command of commands)record=await store.command({operation_id:args.operation_id,context:args.context,
      expected_revision:record.revision,command});
    return {...record,result:{...record.result,reconciliation_only:true,dispatch_paused:true,pause_reason:"GPT_CONTINUATION_REQUIRED"}};
  }
  return Object.freeze({execute,reconcileOnly});
}
