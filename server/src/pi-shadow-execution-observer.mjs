import { randomUUID } from "node:crypto";
import { createExecutionIntent, hashExecutionInput } from "./pi-execution-contract.mjs";
import { appendDevExecutionProjection, readDevExecutionProjections, recoverDevExecutionPublication } from "./mcp-development-journal-tools.mjs";
import { validatePiExecutionHistory } from "./pi-execution-state-store.mjs";
import { reliableFailure as fail, stableJson } from "./pi-reliable-execution-state.mjs";
import { createShadowProjection, reduceShadowProjection, shadowStartCommand, shadowCompleteCommand,
  shadowComparison } from "./pi-shadow-execution-state.mjs";

function freeze(value) {
  if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
function output(event) {
  const record=event.execution_projection;
  if(record.schema_version!==3)fail("LEGACY_OPERATION_NOT_MIGRATED");
  return freeze(JSON.parse(JSON.stringify({...record,journal_receipt:{operation_id:event.operation_id,
    event_id:event.journal_event_id,sequence:event.sequence,event_hash:event.event_hash},
    result:shadowComparison(record)})));
}
// Trusted-host opt-in observation. No dispatcher, model or route selection binding.
export function createPiShadowExecutionObserver({journal={
  readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,
  recoverExecutionPublication:recoverDevExecutionPublication},
  clock=()=>new Date().toISOString()}={}) {
  if(typeof journal.readExecutionProjections!=="function"||typeof journal.appendExecutionProjection!=="function"
    ||typeof clock!=="function")fail("INVALID_SHADOW_BINDING");
  let tail=Promise.resolve();
  function serialized(work) {
    const pending=tail.then(work);tail=pending.catch(()=>{});return pending;
  }
  async function history() {
    let events;
    try {events=await journal.readExecutionProjections();}
    catch(e) {
      if(["JOURNAL_APPEND_BUSY","JOURNAL_SNAPSHOT_UNSTABLE"].includes(e.code))throw e;
      if(typeof journal.recoverExecutionPublication!=="function")fail("CORRUPT_STATE");
      try {
        await journal.recoverExecutionPublication({validateHistory:validatePiExecutionHistory});
        events=await journal.readExecutionProjections();
      } catch {fail("CORRUPT_STATE");}
    }
    return validatePiExecutionHistory(events);
  }
  async function current({operation_id,context}) {
    const event=(await history()).get(operation_id);
    if(!event)fail("UNKNOWN_PI_OPERATION");
    if(stableJson(context)!==stableJson(event.execution_projection.intent.context))fail("WORKSPACE_CONTEXT_MISMATCH");
    if(event.execution_projection.schema_version!==3)fail("LEGACY_OPERATION_NOT_MIGRATED");
    return event;
  }
  async function publish(record,revision) {
    return output(await journal.appendExecutionProjection(record,{expected_revision:revision,validateHistory:validatePiExecutionHistory}));
  }
  async function apply(args,command) {
    const event=await current(args),prior=event.execution_projection;
    if(args.expected_revision!==undefined&&args.expected_revision!==prior.revision)fail("STATE_REVISION_CONFLICT");
    const row=prior.shadow.observations.find(row=>row.observation_id===command.observation_id);
    if(row&&command.type==="legacy_call_started") {
      const keys=Object.keys(command).filter(key=>key!=="type");
      if(keys.some(key=>stableJson(row[key])!==stableJson(command[key])))fail("OBSERVATION_ID_CONFLICT");
      return output(event);
    }
    if(row?.completed_at!==null&&row&&command.type==="legacy_call_completed") {
      const keys=["result_hash","outcome","passed","legacy_operation_id","result_workspace_id","result_workstream_id","result_idempotency_key"];
      if(keys.some(key=>stableJson(row[key])!==stableJson(command[key])))fail("OBSERVATION_ID_CONFLICT");
      return output(event);
    }
    if(command.type==="shadow_closed"&&prior.shadow.closed_at!==null)return output(event);
    return publish(reduceShadowProjection(prior,command,clock()),prior.revision);
  }
  return Object.freeze({
    admit:(source,options={})=>serialized(async()=>{
      const intent=createExecutionIntent(source);
      const existing=[...(await history()).values()].find(event=>event.execution_projection.intent.intent_id===intent.intent_id);
      if(existing&&existing.execution_projection.schema_version!==3)fail("LEGACY_OPERATION_NOT_MIGRATED");
      return publish(createShadowProjection(intent,{...options,timestamp:clock()}),0);
    }),
    started:args=>serialized(()=>apply(args,shadowStartCommand(args))),
    completed:args=>serialized(()=>apply(args,shadowCompleteCommand(args))),
    gap:args=>serialized(()=>apply(args,{type:"observation_gap",error_count:args.error_count,codes:args.codes})),
    close:args=>serialized(()=>apply(args,{type:"shadow_closed"})),
    inspect:async args=>output(await current(args)),
  });
}
// The host supplies the unchanged legacy dispatcher. Observation failure is visible
// in diagnostics, but cannot suppress, retry, reroute or replace its result/error.
export function createPiShadowLegacyBridge({observer,operation_id,context,callLegacyTool,onObservationError,
  observerTimeoutMs=30000}={}) {
  if(!observer||["started","completed","close"].some(key=>typeof observer[key]!=="function")
    ||typeof callLegacyTool!=="function"||!Number.isSafeInteger(observerTimeoutMs)||observerTimeoutMs<1
    ||observerTimeoutMs>120000)fail("INVALID_SHADOW_BRIDGE_BINDING");
  const binding={operation_id,context},errors=[];let errorCount=0,activeCalls=0;
  function noteError(kind,code,observation_id) {
    const diagnostic=Object.freeze({kind,code,observation_id});
    errorCount++;errors.push(diagnostic);if(errors.length>100)errors.shift();
    try {Promise.resolve(onObservationError?.(diagnostic)).catch(()=>{});}catch{}
  }
  function fingerprint(params) {try{return hashExecutionInput(params);}catch{return null;}}
  async function observe(kind,args) {
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(()=>observer[kind](args)),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error("SHADOW_OBSERVER_TIMEOUT"),
          {code:"SHADOW_OBSERVER_TIMEOUT"})),observerTimeoutMs);})]);
    } catch(error) {
      const code=typeof error?.code==="string"&&/^[A-Z0-9_:-]{1,80}$/u.test(error.code)?error.code:"SHADOW_OBSERVATION_FAILED";
      // Diagnostics are notification-only; they cannot change execution.
      noteError(kind,code,args.observation_id??null);
      return null;
    } finally {clearTimeout(timer);}
  }
  function diagnostics() {return Object.freeze({coverage_healthy:errorCount===0&&activeCalls===0,
    error_count:errorCount,active_legacy_calls:activeCalls,errors:Object.freeze([...errors]),mutation_dispatch_count:0});}
  return Object.freeze({
    async call(step_id,params) {
      const observation_id="pi_shadow_call_"+randomUUID().replaceAll("-","");
      const entryHash=fingerprint(params);
      activeCalls++;
      try {
        const started=await observe("started",{...binding,observation_id,step_id,params});
        if(entryHash!==null&&fingerprint(params)!==entryHash)noteError("dispatch","SHADOW_INPUT_CHANGED",observation_id);
        let response;
        try {response=await callLegacyTool(params);}
        catch(error) {
          if(started)await observe("completed",{...binding,observation_id,error});
          throw error;
        }
        if(entryHash!==null&&fingerprint(params)!==entryHash)noteError("response","SHADOW_INPUT_CHANGED",observation_id);
        if(started)await observe("completed",{...binding,observation_id,response});
        return response;
      } finally {activeCalls--;}
    },
    async finish() {
      if(errorCount&&typeof observer.gap==="function")await observe("gap",{...binding,error_count:errorCount,codes:errors.map(error=>error.code)});
      const record=await observe("close",binding);
      return Object.freeze({...record,...diagnostics(),
        ...(errorCount||activeCalls?{decision_required:true,schedule_matched:false}:{} )});
    },
    diagnostics,
  });
}
