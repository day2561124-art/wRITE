import {AsyncLocalStorage} from "node:async_hooks";
import {traceSpan} from "./mcp-request-tracing.mjs";
import {admitPiLightweightRead} from "./pi-execution-policy.mjs";
import {createPiTaskPolicy} from "./pi-task-authorization.mjs";
import {createExecutionIntent,hashExecutionInput} from "./pi-execution-contract.mjs";
import {createPiReliableExecutionStore} from "./pi-reliable-execution-store.mjs";
import {createPiReliableExecutionEngine} from "./pi-reliable-execution-engine.mjs";
import {createPiReliableMcpAdapter} from "./pi-mcp-reliable-adapter.mjs";
import {validatePiExecutionHistory} from "./pi-execution-state-store.mjs";
import {createPiProductionRouteStore,validatePiProductionRouteHistory} from "./pi-production-execution-route.mjs";
import {readDevExecutionProjections,appendDevExecutionProjection,transitionDevExecutionProjection,recoverDevExecutionPublication,verifyDevJournal,
 beginDevJournalOperation,completeDevJournalOperation} from "./mcp-development-journal-tools.mjs";
import {reliableFailure,stableJson} from "./pi-reliable-execution-state.mjs";
const managed=new AsyncLocalStorage();
export const isPiManagedMcpCall=()=>typeof managed.getStore()==="function";
export const assertPiManagedMcpCall=async()=>{
 const authorizeDispatch=managed.getStore();
 if(typeof authorizeDispatch==="function")await authorizeDispatch();
};
export const runPiManagedMcpCall=async(callback,authorizeDispatch)=>{
 if(typeof authorizeDispatch!=="function")reliableFailure("DISPATCH_AUTHORITY_REQUIRED");
 await authorizeDispatch();
 return managed.run(authorizeDispatch,callback);
};
export async function guardPiDirectExecution({route,tool,mutation=false,params={},auditFallback,resolveWorkspace,
 requireTaskAuthorization=process.env.NEXA_PI_REQUIRE_TASK_AUTHORIZATION==='1'}){
 const authorizeDispatch=managed.getStore();
 if(typeof authorizeDispatch==="function"){await authorizeDispatch();return;}
 if(mutation&&requireTaskAuthorization)reliableFailure("PI_EXECUTION_INTENT_REQUIRED");
 const p=params._meta?.pi_fallback;
 if(p===undefined){
  try {if(await admitPiLightweightRead({tool,mutation,params,resolveWorkspace}))return;}
  catch(error){if((await route.inspect().catch(()=>null))?.revision===0)return;throw error;}
 }
 if((await route.inspect()).revision===0)return;
 if(!p||Object.keys(p).sort().join(",")!=="decision_id,purpose,reason"||!["diagnostic","emergency"].includes(p.purpose)
  ||typeof p.reason!=="string"||!p.reason.trim()||p.reason.length>256||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(p.decision_id))reliableFailure("PI_EXECUTION_INTENT_REQUIRED");
 if(mutation&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(params._meta?.reconciliation_key??""))reliableFailure("FALLBACK_IDEMPOTENCY_REQUIRED");
 if(typeof auditFallback!=="function")reliableFailure("FALLBACK_AUDIT_REQUIRED");
 await auditFallback({tool,decision_owner:"GPT",...p});
}
const defaultJournal={readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,
 transitionExecutionProjection:transitionDevExecutionProjection,
 recoverExecutionPublication:recoverDevExecutionPublication,verify:verifyDevJournal,begin:beginDevJournalOperation,complete:completeDevJournalOperation};
const workerFaultType = "pi_worker_deferral";
const workerRetryLimit = 3;

function workerProgress(record) {
 return hashExecutionInput({status:record.state.status,completed:record.state.completed_steps,next:record.state.pending_steps[0]??null});
}

function workerDeferrals(events) {
 const deferrals=new Map();
 for(const event of events){
  // Admission durably records the deferral. A late terminal publication
  // cannot replace a newer attempt's scheduling decision.
  if(event.operation_type!==workerFaultType||event.tool_name!=="pi.worker.defer"||event.stage!=="operation_started")continue;
  const fact=event.result;
  if(!/^pi_operation_[a-f0-9]{32}$/u.test(fact?.logical_operation_id??"")
    ||!/^[a-f0-9]{64}$/u.test(fact.progress_sha256??"")||!Number.isSafeInteger(fact.attempt)||fact.attempt<1||fact.attempt>workerRetryLimit
    ||!/^[A-Z][A-Z0-9_]{0,63}$/u.test(fact.code??"")
    ||(fact.retry_after_ms===null)!==(fact.attempt===workerRetryLimit)
    ||(fact.retry_after_ms!==null&&(!Number.isSafeInteger(fact.retry_after_ms)||fact.retry_after_ms<0)))reliableFailure("CORRUPT_WORKER_DEFERRAL");
  deferrals.set(fact.logical_operation_id,{...fact,workspace_id:event.workspace_id,workstream_id:event.workstream_id});
 }
 return deferrals;
}

function matchingWorkerDeferral(deferrals, record) {
 const fault=deferrals.get(record.state.operation_id);
 return fault&&fault.progress_sha256===workerProgress(record)&&fault.workspace_id===record.state.workspace_id
  &&fault.workstream_id===record.state.workstream_id?fault:null;
}
// This helper accepts already VERIFIED Journal events. It is not a hash-chain
// validator, a reusable authorization token, or a cross-request cache.
export function projectVerifiedPiJournalHistory(events){
 if(!Array.isArray(events))reliableFailure("CORRUPT_STATE");
 const projections=[],routes=[];
 for(const event of events){
  if(event.operation_type==="pi_execution_projection"&&event.stage==="operation_completed"
   &&event.execution_projection===undefined)reliableFailure("CORRUPT_STATE");
  if(event.execution_projection!==undefined)projections.push(event);
  if(event.operation_type==="pi_production_route"&&event.stage==="operation_completed")routes.push(event);
 }
 validatePiExecutionHistory(projections);
 const route=validatePiProductionRouteHistory(routes);
 return {projections,routes,route,workerDeferrals:workerDeferrals(events)};
}
export function createPiProductionExecutionController({journal=defaultJournal,route=null,transport,retryPolicy,executionHook,pendingLimit=128,
 workerClock=Date.now,authorizeTask=createPiTaskPolicy()}={}){
  if(!Number.isSafeInteger(pendingLimit)||pendingLimit<1||pendingLimit>128)reliableFailure('INVALID_PENDING_LIMIT');
  const boundJournal=journal;
  // Avoid substituting the global Journal route for a test/client-supplied
  // route store. Only the default Journal + default route pair is unified.
  const unifiedDefault=boundJournal===defaultJournal&&route===null;
  route??=createPiProductionRouteStore();
  journal={...boundJournal,
  readExecutionProjections:(...args)=>traceSpan("journal.projection_read",()=>boundJournal.readExecutionProjections(...args)),
  appendExecutionProjection:(...args)=>traceSpan("journal.projection_append",()=>boundJournal.appendExecutionProjection(...args)),
  ...(typeof boundJournal.transitionExecutionProjection==="function"?{
   transitionExecutionProjection:(...args)=>traceSpan("journal.projection_append",()=>boundJournal.transitionExecutionProjection(...args))}:{})};
 if(!transport||typeof transport.callTool!=="function"||typeof transport.resolveWorkspace!=="function")reliableFailure("INVALID_PRODUCTION_HOST_BINDING");
 async function unifiedSnapshot({recoverOnReadFailure=false}={}){
  let verified;
  try {verified=await traceSpan("journal.projection_read",()=>verifyDevJournal());}
  catch(error){
   if(!recoverOnReadFailure)throw error;
   // Preserve the existing explicit writer recovery authority. The store only
   // recovers PROVABLE publication tails; it does not invent a tool receipt.
   await createPiReliableExecutionStore({journal}).readHistory();
   verified=await traceSpan("journal.projection_read",()=>verifyDevJournal());
  }
  return projectVerifiedPiJournalHistory(verified.events);
 }
 async function prepare(source,{readJournal=journal,events:inspectionEvents,routeEvents:inspectionRoutes,durable=false,standingAdmissionPrincipal}={}){
  const intent=createExecutionIntent(source);if(intent.context.project_id!=="writer_workbench")reliableFailure("PERMISSION_DENIED");
  const combined=unifiedDefault&&inspectionEvents===undefined&&inspectionRoutes===undefined
   ?await unifiedSnapshot({recoverOnReadFailure:true}):null;
  const events=inspectionEvents??combined?.projections??await createPiReliableExecutionStore({journal}).readHistory();
  // Both unifiedSnapshot() and readHistory() fully validate Pi semantics.
  const routeEvents=inspectionRoutes??combined?.routes;
  const created=events.find(e=>e.execution_projection.intent.intent_id===intent.intent_id&&e.execution_projection.revision===1);
  const active=routeEvents?validatePiProductionRouteHistory(routeEvents):await traceSpan("journal.route_read",()=>route.inspect());
  if(created&&!created.execution_projection.command?.production_binding)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
  if(!created&&active.mode!=="pi_default")reliableFailure("PRODUCTION_ROUTE_DISABLED");
  const binding=created?.execution_projection.command.production_binding??{route_revision:active.revision,route_hash:active.route_hash,...(durable?{worker_protocol:'writer-workbench/pi-durable-worker/v1'}:{})};
  if(created){const admissionRoute=[...(routeEvents??await route.history())].reverse().find(e=>e.sequence<created.sequence);
   const proof=admissionRoute?JSON.parse(admissionRoute.result.route_record):null;
   if(!proof||proof.mode!=="pi_default"||proof.revision!==binding.route_revision||proof.route_hash!==binding.route_hash)reliableFailure("CORRUPT_ROUTE_STATE");}
  const admissionGuard=async({history,latest,existing,allEvents})=>{
   const enrolled=new Set(history.filter(e=>e.execution_projection.command?.production_binding?.worker_protocol
     ||e.execution_projection.runtime?.durable_worker).map(e=>e.execution_projection.state.operation_id));
   const deferrals=durable&&!existing?workerDeferrals(allEvents):null;
   if(!existing&&durable&&[...latest.values()].filter(e=>enrolled.has(e.execution_projection.state.operation_id))
    .filter(e=>!['COMPLETED','FAILED','CANCELLED','DECISION_REQUIRED','BLOCKED'].includes(e.execution_projection.state.status)
      &&matchingWorkerDeferral(deferrals,e.execution_projection)?.retry_after_ms!==null).length>=pendingLimit)
     reliableFailure('PI_DURABLE_QUEUE_FULL');
   if(existing){const first=history.find(e=>e.execution_projection.state.operation_id===existing.execution_projection.state.operation_id&&e.execution_projection.revision===1);
    if(stableJson(first?.execution_projection.command.production_binding)!==stableJson(binding))reliableFailure("PRODUCTION_ENROLLMENT_CONFLICT");return;}
   if(intent.standing_authorization!==undefined
     && standingAdmissionPrincipal!==intent.standing_authorization.principal)reliableFailure("PERMISSION_DENIED");
   await authorizeTask(intent);
   const current=validatePiProductionRouteHistory(allEvents.filter(e=>e.operation_type==="pi_production_route"&&e.stage==="operation_completed"));
   if(current.mode!=="pi_default"||current.revision!==binding.route_revision||current.route_hash!==binding.route_hash)reliableFailure("PRODUCTION_ROUTE_DISABLED");
  };
  const store=createPiReliableExecutionStore({journal:readJournal,productionBinding:binding,admissionGuard});
  const adapter=createPiReliableMcpAdapter({...transport,callTool:async (params,{authorizeDispatch,action}={})=>{
   if((await route.inspect()).mode!=="pi_default")reliableFailure("PERMISSION_DENIED");
   if(typeof authorizeDispatch!=="function")reliableFailure("DISPATCH_AUTHORITY_REQUIRED");
   await authorizeDispatch();
   if(intent.standing_authorization===undefined)return runPiManagedMcpCall(async()=>{
    await authorizeTask(intent,[action]);
    return transport.callTool(params);
   },authorizeDispatch);
   const authorizeBoundDispatch=async()=>{
    await authorizeDispatch();
    // Revalidate policy on every managed-call gate as well as initial
    // dispatch. Durable workers use the original pinned intent evidence.
    await authorizeTask(intent,[action]);
   };
   return runPiManagedMcpCall(()=>transport.callTool(params),authorizeBoundDispatch);
  }});
  return {intent,store,engine:createPiReliableExecutionEngine({store,adapter,...(retryPolicy?{retryPolicy}:{}),executionHook})};
 }
 const stopped=r=>r.runtime.isolation||['COMPLETED','FAILED','CANCELLED','DECISION_REQUIRED','BLOCKED'].includes(r.state.status);
 async function submit(source,{authentication}={}){
  const standingAdmissionPrincipal=authentication?.ok===true&&authentication.local===false
    ?authentication.principal:undefined;
  if(source?.standing_authorization!==undefined
    && (typeof standingAdmissionPrincipal!=="string"
      || standingAdmissionPrincipal!==source.standing_authorization.principal))reliableFailure("PERMISSION_DENIED");
  const {intent,store}=await traceSpan('pi.prepare',()=>prepare(source,{durable:true,standingAdmissionPrincipal}));
  let record=await traceSpan('pi.admission',()=>store.admit(intent,...(retryPolicy?[{retry_policy:retryPolicy}]:[])));
  if(!stopped(record)&&record.command?.production_binding?.worker_protocol!=='writer-workbench/pi-durable-worker/v1'){
   // The current command changes after every transition. Enrollment is also
   // discoverable in the validated first projection, not only the latest command.
   const history=await store.readHistory();
   const first=history.find(e=>e.execution_projection.state.operation_id===record.state.operation_id&&e.execution_projection.revision===1);
   if(first.execution_projection.command.production_binding?.worker_protocol!=='writer-workbench/pi-durable-worker/v1'&&!record.runtime.durable_worker){
    if(record.state.status!=='CREATED'||record.runtime.owner!==null)reliableFailure('LEGACY_OPERATION_REQUIRES_RECONCILIATION');
    try{record=await store.command({operation_id:record.state.operation_id,context:intent.context,expected_revision:record.revision,command:{type:'worker_enrolled'}});}
    catch(error){if(error.code!=='STATE_REVISION_CONFLICT')throw error;record=await store.inspect({operation_id:record.state.operation_id,context:intent.context});
     if(!record.runtime.durable_worker&&!stopped(record))throw error;}
   }
  }
  return output(record);
 }
 async function discover({limit=16}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>128)reliableFailure('INVALID_WORKER_LIMIT');
  const combined=unifiedDefault?await unifiedSnapshot():null;
  const history=combined?.projections??await createPiReliableExecutionStore({journal,recoverOnReadFailure:false}).readHistory();
  const latest=new Map(),enrolled=new Set();
  for(const event of history){const r=event.execution_projection;latest.set(r.state.operation_id,r);
   if(r.command?.production_binding?.worker_protocol==='writer-workbench/pi-durable-worker/v1'||r.runtime?.durable_worker)enrolled.add(r.state.operation_id);}
  const deferrals=combined?.workerDeferrals??(journal.verify?workerDeferrals((await journal.verify()).events):new Map());
  return [...latest.values()].filter(r=>{
   if(r.schema_version!==2||!enrolled.has(r.state.operation_id)||stopped(r))return false;
   const fault=matchingWorkerDeferral(deferrals,r);
   return !fault||fault.retry_after_ms!==null&&fault.retry_after_ms<=workerClock();
  }).slice(0,limit);
 }
 async function deferExecutionFailure(args,error){
  if(!journal.verify||!journal.begin||!journal.complete)throw error;
  const operation=await inspectOperation(args,false,{recoverOnReadFailure:false});
  if(stopped(operation))return null;
  // Exit the owning process if it abandoned a claim. Another worker can
  // then reconcile the actual physical effect before dispatching again.
  if(operation.runtime.owner||operation.runtime.active_call)throw error;
  const snapshot=await journal.verify();
  const prior=matchingWorkerDeferral(workerDeferrals(snapshot.events),operation);
  const now=workerClock();
  if(prior&&(prior.retry_after_ms===null||prior.retry_after_ms>now))return prior;
  const attempt=(prior?.attempt??0)+1;
  const fault={logical_operation_id:operation.state.operation_id,progress_sha256:workerProgress(operation),
   code:/^[A-Z][A-Z0-9_]{0,63}$/u.test(error?.code??"")?error.code:"WORKER_OPERATION_FAILED",
   attempt,retry_after_ms:attempt<workerRetryLimit?now+1000*2**(attempt-1):null};
  const fingerprint=hashExecutionInput({operation_id:fault.logical_operation_id,progress:fault.progress_sha256,attempt});
  let started;
  try {
   started=await journal.begin({operation_type:workerFaultType,tool_name:"pi.worker.defer",
    workspace_id:operation.state.workspace_id,workstream_id:operation.state.workstream_id,result:fault,
    reconciliation_key:`pi-worker-deferral-${fingerprint}`,request_fingerprint_sha256:fingerprint});
  } catch (admissionError) {
   if(admissionError?.code!=="RECONCILIATION_EXISTING_OPERATION")throw admissionError;
   return matchingWorkerDeferral(workerDeferrals((await journal.verify()).events),operation);
  }
  await journal.complete(started.operation_id,{result:fault});
  return fault;
 }
 function output(r){return {...r,result:{...r.result,phase:"F",mode:"production_default",production_default_changed:true,legacy_migration:false,engineering_review_required:true}};}
 async function inspectOperation(args,includeRoute=false,{recoverOnReadFailure=false}={}){
  // Reuse only this request's fully validated snapshot. Mutation/admission uses
  // fresh reads and append-lock CAS; no historical prefix or cross-call cache.
  const combined=unifiedDefault?await unifiedSnapshot({recoverOnReadFailure}):null;
  const history=combined?.projections??await createPiReliableExecutionStore({journal,recoverOnReadFailure}).readHistory();
  const operation_id=args.operation_id??[...history].reverse().find(e=>e.execution_projection.intent.intent_id===args.intent_id)?.execution_projection.state.operation_id;
  if(!operation_id)reliableFailure("UNKNOWN_PI_OPERATION");
  const operationHistory=history.filter(e=>e.execution_projection.state.operation_id===operation_id);
  const readJournal={...journal,readExecutionProjections:async()=>operationHistory};
  const r=await createPiReliableExecutionStore({journal:readJournal,recoverOnReadFailure}).inspect({...args,operation_id});
  const routeEvents=combined?.routes??await traceSpan("journal.route_read",()=>route.history());
  await prepare(r.intent,{readJournal,events:history,routeEvents});
  const deferrals=combined?.workerDeferrals??(journal.verify?workerDeferrals((await journal.verify()).events):new Map());
  const fault=matchingWorkerDeferral(deferrals,r);
  const operation=output(fault?{...r,worker_deferral:fault}:r);
  return includeRoute?{route:combined?.route??validatePiProductionRouteHistory(routeEvents),operation}:operation;
 }
 async function listOperations({context,limit=10,before_sequence=Number.MAX_SAFE_INTEGER}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>25||!Number.isSafeInteger(before_sequence)||before_sequence<1)
   reliableFailure("INVALID_PI_HISTORY_PAGE");
  const combined=unifiedDefault?await unifiedSnapshot():null;
  const history=combined?.projections??await createPiReliableExecutionStore({journal,recoverOnReadFailure:false}).readHistory();
  const deferrals=combined?.workerDeferrals??(journal.verify?workerDeferrals((await journal.verify()).events):new Map());
  const operations=new Map();
  const contextKey=stableJson(context);
  for(const {sequence,execution_projection:record} of history){
   if(stableJson(record.intent.context)!==contextKey)continue;
   const started_sequence=operations.get(record.state.operation_id)?.started_sequence??sequence;
   if(started_sequence<before_sequence)operations.set(record.state.operation_id,{started_sequence,record});
  }
  const page=[...operations.values()].reverse().slice(0,limit);
  return {
   operations:page.map(({started_sequence,record})=>{
    const fault=matchingWorkerDeferral(deferrals,record);
    return {
    started_sequence,operation_id:record.state.operation_id,intent_id:record.intent.intent_id,
    task_authorization_id:record.intent.task_authorization_id??null, goal:record.intent.goal,
    status:record.state.status,completed_steps:record.state.completed_steps,
    ...(record.state.recovery ? { recovery: record.state.recovery } : {}),
    next_step:record.state.pending_steps[0]??null,last_error:record.state.last_error,
    ...(fault?{worker_deferral:fault}:{}),
    };
   }),
   next_before_sequence:operations.size>limit?page.at(-1).started_sequence:null,
  };
 }
 return Object.freeze({
  submit,discover,listOperations,deferExecutionFailure,
  status:async()=>{if(unifiedDefault)return (await unifiedSnapshot()).route;
   await createPiReliableExecutionStore({journal,recoverOnReadFailure:false}).readHistory();return route.inspect();},
  admit:async source=>{const {intent,store}=await prepare(source);return output(await store.admit(intent,...(retryPolicy?[{retry_policy:retryPolicy}]:[])));},
  execute:async source=>{const {intent,engine}=await traceSpan("pi.prepare",()=>prepare(source));return output(await engine.execute(intent));},
  reconcileOnly:async args=>{
   const original=await inspectOperation(args,false,{recoverOnReadFailure:true});
   const {engine}=await prepare(original.intent);
   return output(await engine.reconcileOnly(args));
  },
  inspect:args=>inspectOperation(args),
  inspectStatus:args=>inspectOperation(args,true)
 });
}

export async function guardPiParentIntegration(params) {
 const route=createPiProductionRouteStore();
 await guardPiDirectExecution({route,tool:"dev_workspace_integrate",mutation:true,params,auditFallback:async record=>{
  const {beginDevJournalOperation,completeDevJournalOperation}=await import("./mcp-development-journal-tools.mjs");
  const started=await beginDevJournalOperation({operation_type:"pi_diagnostic_fallback",tool_name:"pi.fallback.admit",result:record});
  await completeDevJournalOperation(started.operation_id,{result:record});
 }});
}
