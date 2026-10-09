import { hostname } from "node:os";
import { createExecutionIntent } from "./pi-execution-contract.mjs";
import { appendDevExecutionProjection, readDevExecutionProjections, recoverDevExecutionPublication } from "./mcp-development-journal-tools.mjs";
import { validatePiExecutionHistory } from "./pi-execution-state-store.mjs";
import { reliableFailure, reliableJson, stableJson, initialReliableState, validateRetryPolicy,
  makeReliableProjection, reduceReliableProjection } from "./pi-reliable-execution-state.mjs";

export function localOwnerAlive(owner) {
  if(owner.hostname!==hostname())return null;
  try {process.kill(owner.pid,0);return true;} catch(e) {return e.code==="ESRCH"?false:e.code==="EPERM"?true:null;}
}
function contextCheck(record,context) {
  if(stableJson(context)!==stableJson(record.intent.context))reliableFailure("WORKSPACE_CONTEXT_MISMATCH");
}
function freeze(value) {
  if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
function output(event,events) {
  const record=event.execution_projection;
  if(record.schema_version!==2)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
  const receipts=events.filter(e=>e.execution_projection.state.operation_id===record.state.operation_id)
    .map(e=>e.execution_projection.command?.receipt).filter(Boolean);
  return freeze(JSON.parse(JSON.stringify({...record,receipts,journal_receipt:{
    operation_id:event.operation_id,event_id:event.journal_event_id,sequence:event.sequence,event_hash:event.event_hash},
    result:{schema_version:2,phase:"C",mode:"explicit_reliable",operation_id:record.state.operation_id,
      intent_id:record.intent.intent_id,revision:record.revision,status:record.state.status,
      completed:record.state.completed_steps,remaining:record.state.pending_steps,verification:record.state.verification_state,
      checkpoint:record.state.checkpoint,resume_point:record.state.resume_point,decision_required:record.state.status==="DECISION_REQUIRED",
      retry_at:record.runtime.retry_at,persistence_enabled:true,execution_enabled:!record.runtime.isolation,resume_dispatch_enabled:!record.runtime.isolation,
      ...(record.runtime.isolation?{dispatch_paused:true,pause_reason:"OPERATION_ISOLATED"}:{}),
      ...(record.intent.bootstrap?{execution_context:record.runtime.lifecycle_binding}:{}),
      engineering_review_required:true,production_default_changed:false,model_requests:0,
      decision_owner:"GPT",execution_owner:"Pi",tool_owner:"MCP"}})));
}
// Host-only, opt-in. Reuses the existing journal and append-lock CAS.
export function createPiReliableExecutionStore({journal={
  readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,
  recoverExecutionPublication:recoverDevExecutionPublication},
  clock=()=>new Date().toISOString(),isOwnerAlive=localOwnerAlive,admissionBinding,productionBinding,admissionGuard,isolationAuthority}={}) {
  if(typeof journal.readExecutionProjections!=="function"||typeof journal.appendExecutionProjection!=="function"
    ||typeof clock!=="function"||typeof isOwnerAlive!=="function")reliableFailure("INVALID_STATE_STORE_BINDING");
  async function history() {
    let events;
    try {events=await journal.readExecutionProjections();} catch(e) {
      if(["JOURNAL_APPEND_BUSY","JOURNAL_LOCK_CONTENDED","JOURNAL_LOCK_RELEASE_FAILED","JOURNAL_SNAPSHOT_UNSTABLE"].includes(e.code))throw e;
      if(typeof journal.recoverExecutionPublication!=="function")reliableFailure("CORRUPT_STATE");
      try {
        await journal.recoverExecutionPublication({validateHistory:validatePiExecutionHistory});
        events=await journal.readExecutionProjections();
      } catch {reliableFailure("CORRUPT_STATE");}
    }
    return {events,latest:validatePiExecutionHistory(events)};
  }
  async function publish(record,revision) {
    const event=await journal.appendExecutionProjection(record,{expected_revision:revision,validateHistory:validatePiExecutionHistory,
      ...(revision===0?{admissionGuard}:{})});
    return output(event,(await history()).events);
  }
  async function admit(source,{retry_policy={max_attempts:3,base_delay_ms:250,max_delay_ms:5000},...options}={}) {
    const intent=createExecutionIntent(source),policy=validateRetryPolicy(retry_policy);
    const {latest,events}=await history();
    const created=events.find(e=>e.execution_projection.intent.intent_id===intent.intent_id&&e.execution_projection.revision===1);
    if(created?.execution_projection.command?.production_binding&&typeof admissionGuard!=="function")reliableFailure("PRODUCTION_AUTHORITY_REQUIRED");
    if(created?.execution_projection.command?.canary_binding&&typeof admissionGuard!=="function")
      reliableFailure("CANARY_AUTHORITY_REQUIRED");
    const existing=[...latest.values()].find(e=>e.execution_projection.intent.intent_id===intent.intent_id);
    if(existing?.execution_projection.schema_version===1)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
    const state=initialReliableState(intent,{...options,timestamp:clock()});
    return publish(makeReliableProjection({schema_version:2,revision:1,previous_projection_hash:null,
      action_type:"operation_created",intent,state,runtime:{retry_policy:policy,owner:null,active_call:null,retry_at:null,...(intent.bootstrap?{lifecycle_binding:null}:{})},
      command:{type:"operation_created",...(admissionBinding?{canary_binding:admissionBinding}:{}),...(productionBinding?{production_binding:productionBinding}:{})}}),0);
  }
  async function current(args) {
    const h=await history(),event=h.latest.get(args.operation_id);
    if(!event)reliableFailure("UNKNOWN_PI_OPERATION");
    contextCheck(event.execution_projection,args.context);
    if(event.execution_projection.schema_version!==2)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
    if(args.expected_revision!==undefined&&event.execution_projection.revision!==args.expected_revision)
      reliableFailure("STATE_REVISION_CONFLICT");
    return {event,...h};
  }
  async function command(args) {
    const {event,events}=await current(args),prior=event.execution_projection;
    if(args.command.type==="execution_isolated")reliableFailure("ISOLATION_AUTHORITY_REQUIRED");
    if(prior.runtime.isolation)reliableFailure("OPERATION_ISOLATED");
    const created=events.find(e=>e.execution_projection.state.operation_id===prior.state.operation_id&&e.execution_projection.revision===1);
    if(created?.execution_projection.command?.production_binding&&typeof admissionGuard!=="function")reliableFailure("PRODUCTION_AUTHORITY_REQUIRED");
    if(created?.execution_projection.command?.canary_binding&&typeof admissionGuard!=="function")
      reliableFailure("CANARY_AUTHORITY_REQUIRED");
    if(!Number.isSafeInteger(args.expected_revision)||args.expected_revision<1)reliableFailure("STATE_REVISION_REQUIRED");
    if(args.command.type==="owner_acquired"&&prior.runtime.owner) {
      const alive=await isOwnerAlive(prior.runtime.owner);
      if(alive!==false)reliableFailure(alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN");
    }
    return publish(reduceReliableProjection(prior,args.command,clock()),prior.revision);
  }
  // Host-only authority: not an intent action, worker command or MCP metadata.
  // The caller must independently authorize revocation and prove quiescence.
  // No outcome is inferred from owner liveness. Publication uses the same CAS.
  async function isolate(args) {
    if(typeof isolationAuthority!=="function")reliableFailure("ISOLATION_AUTHORITY_REQUIRED");
    if(!args||Object.keys(args).sort().join(",")!=="context,decision_id,expected_owner,expected_projection_hash,expected_revision,operation_id,reason"
      ||!Number.isSafeInteger(args.expected_revision)||args.expected_revision<1)reliableFailure("INVALID_ISOLATION_REQUEST");
    const {event}=await current(args),prior=event.execution_projection;
    if(prior.projection_hash!==args.expected_projection_hash)reliableFailure("STATE_PROJECTION_CONFLICT");
    if(stableJson(prior.runtime.owner)!==stableJson(args.expected_owner))reliableFailure("OWNER_CONFLICT");
    const command={type:"execution_isolated",decision_id:args.decision_id,reason:args.reason,
      expected_projection_hash:args.expected_projection_hash,expected_owner:args.expected_owner};
    const next=reduceReliableProjection(prior,command,clock());
    const alive=await isOwnerAlive(prior.runtime.owner);
    if(alive!==false)reliableFailure(alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN");
    if(await isolationAuthority({record:freeze(reliableJson(prior)),request:freeze(reliableJson(args))})!==true)
      reliableFailure("ISOLATION_AUTHORITY_REQUIRED");
    return publish(next,prior.revision);
  }
  async function assertDispatchAuthorized(args) {
    const {event}=await current(args),record=event.execution_projection;
    if(record.runtime.isolation)reliableFailure("OPERATION_ISOLATED");
    if(!Number.isSafeInteger(args.expected_revision)||args.expected_revision<1)reliableFailure("STATE_REVISION_REQUIRED");
    if(record.projection_hash!==args.expected_projection_hash)reliableFailure("STATE_PROJECTION_CONFLICT");
    if(record.runtime.owner?.worker_id!==args.worker_id)reliableFailure("OWNER_CONFLICT");
    if(!record.runtime.active_call||record.runtime.active_call.call_id!==args.call_id)reliableFailure("STALE_TOOL_RESPONSE");
    return true;
  }
  async function assertMutationAuthorized(reconciliation_key) {
    const {latest}=await history();
    if([...latest.values()].some(({execution_projection:r})=>r.runtime?.isolation
      &&r.intent.requested_actions.some(a=>a.idempotency_key===reconciliation_key)))reliableFailure("OPERATION_ISOLATED");
    return true;
  }
  return Object.freeze({admit,command,isolate,assertDispatchAuthorized,assertMutationAuthorized,isOwnerAlive,readHistory:async()=>freeze((await history()).events),
    inspect:async args=>{const {event,events}=await current(args);return output(event,events);}});
}
