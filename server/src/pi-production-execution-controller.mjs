import {AsyncLocalStorage} from "node:async_hooks";
import {traceSpan} from "./mcp-request-tracing.mjs";
import {admitPiLightweightRead} from "./pi-execution-policy.mjs";
import {createExecutionIntent} from "./pi-execution-contract.mjs";
import {createPiReliableExecutionStore} from "./pi-reliable-execution-store.mjs";
import {createPiReliableExecutionEngine} from "./pi-reliable-execution-engine.mjs";
import {createPiReliableMcpAdapter} from "./pi-mcp-reliable-adapter.mjs";
import {validatePiExecutionHistory} from "./pi-execution-state-store.mjs";
import {createPiProductionRouteStore,validatePiProductionRouteHistory} from "./pi-production-execution-route.mjs";
import {readDevExecutionProjections,appendDevExecutionProjection,recoverDevExecutionPublication} from "./mcp-development-journal-tools.mjs";
import {reliableFailure,stableJson} from "./pi-reliable-execution-state.mjs";
const managed=new AsyncLocalStorage();
export const isPiManagedMcpCall=()=>managed.getStore()===true;
export const runPiManagedMcpCall=(callback)=>managed.run(true,callback);
export async function guardPiDirectExecution({route,tool,mutation=false,params={},auditFallback,resolveWorkspace}){
 if(managed.getStore()===true||(await route.inspect()).revision===0)return;
 if(await admitPiLightweightRead({tool,mutation,params,resolveWorkspace}))return;
 const p=params._meta?.pi_fallback;
 if(!p||Object.keys(p).sort().join(",")!=="decision_id,purpose,reason"||!["diagnostic","emergency"].includes(p.purpose)
  ||typeof p.reason!=="string"||!p.reason.trim()||p.reason.length>256||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(p.decision_id))reliableFailure("PI_EXECUTION_INTENT_REQUIRED");
 if(mutation&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(params._meta?.reconciliation_key??""))reliableFailure("FALLBACK_IDEMPOTENCY_REQUIRED");
 if(typeof auditFallback!=="function")reliableFailure("FALLBACK_AUDIT_REQUIRED");
 await auditFallback({tool,decision_owner:"GPT",...p});
}
const defaultJournal={readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,recoverExecutionPublication:recoverDevExecutionPublication};
export function createPiProductionExecutionController({journal=defaultJournal,route=createPiProductionRouteStore(),transport,retryPolicy,executionHook}={}){
 const boundJournal=journal;
 journal={...boundJournal,
  readExecutionProjections:(...args)=>traceSpan("journal.projection_read",()=>boundJournal.readExecutionProjections(...args)),
  appendExecutionProjection:(...args)=>traceSpan("journal.projection_append",()=>boundJournal.appendExecutionProjection(...args))};
 if(!transport||typeof transport.callTool!=="function"||typeof transport.resolveWorkspace!=="function")reliableFailure("INVALID_PRODUCTION_HOST_BINDING");
 async function prepare(source,{readJournal=journal,events:inspectionEvents,routeEvents:inspectionRoutes}={}){
  const intent=createExecutionIntent(source);if(intent.context.project_id!=="writer_workbench")reliableFailure("PERMISSION_DENIED");
  const events=inspectionEvents??await createPiReliableExecutionStore({journal}).readHistory();
  if(inspectionEvents===undefined)validatePiExecutionHistory(events);
  const created=events.find(e=>e.execution_projection.intent.intent_id===intent.intent_id&&e.execution_projection.revision===1);
  const active=inspectionRoutes?validatePiProductionRouteHistory(inspectionRoutes):await traceSpan("journal.route_read",()=>route.inspect());
  if(created&&!created.execution_projection.command?.production_binding)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
  if(!created&&active.mode!=="pi_default")reliableFailure("PRODUCTION_ROUTE_DISABLED");
  const binding=created?.execution_projection.command.production_binding??{route_revision:active.revision,route_hash:active.route_hash};
  if(created){const admissionRoute=[...(inspectionRoutes??await route.history())].reverse().find(e=>e.sequence<created.sequence);
   const proof=admissionRoute?JSON.parse(admissionRoute.result.route_record):null;
   if(!proof||proof.mode!=="pi_default"||proof.revision!==binding.route_revision||proof.route_hash!==binding.route_hash)reliableFailure("CORRUPT_ROUTE_STATE");}
  const admissionGuard=async({history,existing,allEvents})=>{
   if(existing){const first=history.find(e=>e.execution_projection.state.operation_id===existing.execution_projection.state.operation_id&&e.execution_projection.revision===1);
    if(stableJson(first?.execution_projection.command.production_binding)!==stableJson(binding))reliableFailure("PRODUCTION_ENROLLMENT_CONFLICT");return;}
   const current=validatePiProductionRouteHistory(allEvents.filter(e=>e.operation_type==="pi_production_route"&&e.stage==="operation_completed"));
   if(current.mode!=="pi_default"||current.revision!==binding.route_revision||current.route_hash!==binding.route_hash)reliableFailure("PRODUCTION_ROUTE_DISABLED");
  };
  const store=createPiReliableExecutionStore({journal:readJournal,productionBinding:binding,admissionGuard});
  const adapter=createPiReliableMcpAdapter({...transport,callTool:async params=>{
   if((await route.inspect()).mode!=="pi_default")reliableFailure("PERMISSION_DENIED");
   return runPiManagedMcpCall(()=>transport.callTool(params));
  }});
  return {intent,store,engine:createPiReliableExecutionEngine({store,adapter,...(retryPolicy?{retryPolicy}:{}),executionHook})};
 }
 function output(r){return {...r,result:{...r.result,phase:"F",mode:"production_default",production_default_changed:true,legacy_migration:false,engineering_review_required:true}};}
 async function inspectOperation(args,includeRoute=false){
  // Reuse only this request's fully validated snapshot. Mutation/admission uses
  // fresh reads and append-lock CAS; no historical prefix or cross-call cache.
  const history=await createPiReliableExecutionStore({journal}).readHistory();
  const operation_id=args.operation_id??[...history].reverse().find(e=>e.execution_projection.intent.intent_id===args.intent_id)?.execution_projection.state.operation_id;
  if(!operation_id)reliableFailure("UNKNOWN_PI_OPERATION");
  const readJournal={...journal,readExecutionProjections:async()=>history};
  const r=await createPiReliableExecutionStore({journal:readJournal}).inspect({...args,operation_id});
  const routeEvents=await traceSpan("journal.route_read",()=>route.history());
  await prepare(r.intent,{readJournal,events:history,routeEvents});
  const operation=output(r);
  return includeRoute?{route:validatePiProductionRouteHistory(routeEvents),operation}:operation;
 }
 return Object.freeze({
  status:async()=>{await createPiReliableExecutionStore({journal}).readHistory();return route.inspect();},
  admit:async source=>{const {intent,store}=await prepare(source);return output(await store.admit(intent,...(retryPolicy?[{retry_policy:retryPolicy}]:[])));},
  execute:async source=>{const {intent,engine}=await traceSpan("pi.prepare",()=>prepare(source));return output(await engine.execute(intent));},
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
