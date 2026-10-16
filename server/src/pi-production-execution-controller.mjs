import {AsyncLocalStorage} from "node:async_hooks";
import {traceSpan} from "./mcp-request-tracing.mjs";
import {admitPiLightweightRead} from "./pi-execution-policy.mjs";
import {createExecutionIntent} from "./pi-execution-contract.mjs";
import {createPiReliableExecutionStore} from "./pi-reliable-execution-store.mjs";
import {createPiReliableExecutionEngine} from "./pi-reliable-execution-engine.mjs";
import {createPiReliableMcpAdapter} from "./pi-mcp-reliable-adapter.mjs";
import {validatePiExecutionHistory} from "./pi-execution-state-store.mjs";
import {createPiProductionRouteStore,validatePiProductionRouteHistory} from "./pi-production-execution-route.mjs";
import {readDevExecutionProjections,appendDevExecutionProjection,recoverDevExecutionPublication,verifyDevJournal} from "./mcp-development-journal-tools.mjs";
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
export async function guardPiDirectExecution({route,tool,mutation=false,params={},auditFallback,resolveWorkspace}){
 const authorizeDispatch=managed.getStore();
 if(typeof authorizeDispatch==="function"){await authorizeDispatch();return;}
 if((await route.inspect()).revision===0)return;
 if(await admitPiLightweightRead({tool,mutation,params,resolveWorkspace}))return;
 const p=params._meta?.pi_fallback;
 if(!p||Object.keys(p).sort().join(",")!=="decision_id,purpose,reason"||!["diagnostic","emergency"].includes(p.purpose)
  ||typeof p.reason!=="string"||!p.reason.trim()||p.reason.length>256||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(p.decision_id))reliableFailure("PI_EXECUTION_INTENT_REQUIRED");
 if(mutation&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(params._meta?.reconciliation_key??""))reliableFailure("FALLBACK_IDEMPOTENCY_REQUIRED");
 if(typeof auditFallback!=="function")reliableFailure("FALLBACK_AUDIT_REQUIRED");
 await auditFallback({tool,decision_owner:"GPT",...p});
}
const defaultJournal={readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,recoverExecutionPublication:recoverDevExecutionPublication};
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
 return {projections,routes,route};
}
export function createPiProductionExecutionController({journal=defaultJournal,route=null,transport,retryPolicy,executionHook,pendingLimit=128}={}){
  if(!Number.isSafeInteger(pendingLimit)||pendingLimit<1||pendingLimit>128)reliableFailure('INVALID_PENDING_LIMIT');
  const boundJournal=journal;
  // Avoid substituting the global Journal route for a test/client-supplied
  // route store. Only the default Journal + default route pair is unified.
  const unifiedDefault=boundJournal===defaultJournal&&route===null;
  route??=createPiProductionRouteStore();
  journal={...boundJournal,
  readExecutionProjections:(...args)=>traceSpan("journal.projection_read",()=>boundJournal.readExecutionProjections(...args)),
  appendExecutionProjection:(...args)=>traceSpan("journal.projection_append",()=>boundJournal.appendExecutionProjection(...args))};
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
 async function prepare(source,{readJournal=journal,events:inspectionEvents,routeEvents:inspectionRoutes,durable=false}={}){
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
   if(!existing&&durable&&[...latest.values()].filter(e=>enrolled.has(e.execution_projection.state.operation_id))
    .filter(e=>!['COMPLETED','FAILED','CANCELLED','DECISION_REQUIRED','BLOCKED'].includes(e.execution_projection.state.status)).length>=pendingLimit)
     reliableFailure('PI_DURABLE_QUEUE_FULL');
   if(existing){const first=history.find(e=>e.execution_projection.state.operation_id===existing.execution_projection.state.operation_id&&e.execution_projection.revision===1);
    if(stableJson(first?.execution_projection.command.production_binding)!==stableJson(binding))reliableFailure("PRODUCTION_ENROLLMENT_CONFLICT");return;}
   const current=validatePiProductionRouteHistory(allEvents.filter(e=>e.operation_type==="pi_production_route"&&e.stage==="operation_completed"));
   if(current.mode!=="pi_default"||current.revision!==binding.route_revision||current.route_hash!==binding.route_hash)reliableFailure("PRODUCTION_ROUTE_DISABLED");
  };
  const store=createPiReliableExecutionStore({journal:readJournal,productionBinding:binding,admissionGuard});
  const adapter=createPiReliableMcpAdapter({...transport,callTool:async (params,{authorizeDispatch}={})=>{
   if((await route.inspect()).mode!=="pi_default")reliableFailure("PERMISSION_DENIED");
   if(typeof authorizeDispatch!=="function")reliableFailure("DISPATCH_AUTHORITY_REQUIRED");
   await authorizeDispatch();
   return runPiManagedMcpCall(()=>transport.callTool(params),authorizeDispatch);
  }});
  return {intent,store,engine:createPiReliableExecutionEngine({store,adapter,...(retryPolicy?{retryPolicy}:{}),executionHook})};
 }
 const stopped=r=>r.runtime.isolation||['COMPLETED','FAILED','CANCELLED','DECISION_REQUIRED','BLOCKED'].includes(r.state.status);
 async function submit(source){
  const {intent,store}=await traceSpan('pi.prepare',()=>prepare(source,{durable:true}));
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
  return [...latest.values()].filter(r=>r.schema_version===2&&enrolled.has(r.state.operation_id)&&!stopped(r)).slice(0,limit);
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
  const operation=output(r);
  return includeRoute?{route:combined?.route??validatePiProductionRouteHistory(routeEvents),operation}:operation;
 }
 return Object.freeze({
  submit,discover,
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
