import { randomUUID } from "node:crypto";
import { createExecutionIntent, hashExecutionInput } from "./pi-execution-contract.mjs";
import { createPiReliableExecutionStore } from "./pi-reliable-execution-store.mjs";
import { createPiReliableExecutionEngine } from "./pi-reliable-execution-engine.mjs";
import { createPiReliableMcpAdapter } from "./pi-mcp-reliable-adapter.mjs";
import { validatePiExecutionHistory } from "./pi-execution-state-store.mjs";
import { readDevExecutionProjections, appendDevExecutionProjection, recoverDevExecutionPublication } from "./mcp-development-journal-tools.mjs";
import { reliableFailure, reliableJson, stableJson, validateCanaryPolicy } from "./pi-reliable-execution-state.mjs";
function freeze(v) {if(v&&typeof v==="object"){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
// Trusted host supplies an exact GPT-approved cohort and concrete MCP transport.
// No model, patch generation, legacy fallback or default-route selection exists.
export function createPiCanaryExecutionController({policy:source,journal={
 readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,
 recoverExecutionPublication:recoverDevExecutionPublication},transport,isEnabled=async()=>false,retryPolicy,executionHook}={}) {
 const policy=freeze(validateCanaryPolicy(source)),binding=freeze({cohort_id:policy.cohort_id,policy_hash:hashExecutionInput(policy),policy});
 if(typeof isEnabled!=="function"||!transport||typeof transport.callTool!=="function"||typeof transport.resolveWorkspace!=="function")reliableFailure("INVALID_CANARY_HOST_BINDING");
 function authorize(source) {
  const intent=createExecutionIntent(source);
  if(!policy.authorized_intents.some(x=>x.intent_id===intent.intent_id&&x.intent_hash===hashExecutionInput(intent)))
   reliableFailure("CANARY_INTENT_NOT_AUTHORIZED");
  if(!/^dev_workspace_[a-f0-9]{24}$/u.test(intent.context.workspace_id))reliableFailure("CANARY_WORKSPACE_REQUIRED");
  if(intent.permissions.integrate||intent.permissions.push||intent.permissions.workspace_create
   ||intent.requested_actions.some(x=>!["filesystem.read","filesystem.list","filesystem.write","filesystem.patch",
    "workspace.inspect","verification.focused","verification.affected","verification.full","git.status","git.commit"].includes(x.capability)))
   reliableFailure("CANARY_SCOPE_NOT_ALLOWED");
  return intent;
 }
 async function enabled() {
  let timer;
  try {return await Promise.race([Promise.resolve().then(isEnabled),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),1000);})])===true;}
  catch{return false;}finally{clearTimeout(timer);}
 }
 function first(history,id) {return history.find(e=>e.execution_projection.state.operation_id===id&&e.execution_projection.revision===1);}
 function enrolled(history,id) {
  const e=first(history,id),b=e?.execution_projection.command?.canary_binding;
  if(!b)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
  if(stableJson(b)!==stableJson(binding))reliableFailure("CANARY_ENROLLMENT_CONFLICT");
  return e;
 }
 const admissionGuard=async({history,existing,record})=>{
  authorize(record.intent);
  if(existing){enrolled(history,existing.execution_projection.state.operation_id);return;}
  if(!await enabled())reliableFailure("CANARY_DISABLED");
  const cohort=history.filter(e=>e.execution_projection.revision===1
   &&e.execution_projection.command?.canary_binding?.cohort_id===binding.cohort_id);
  if(cohort.some(e=>e.execution_projection.command.canary_binding.policy_hash!==binding.policy_hash))
   reliableFailure("CANARY_ENROLLMENT_CONFLICT");
  if(cohort.length>=policy.max_operations)reliableFailure("CANARY_CAPACITY_EXCEEDED");
 };
 const store=createPiReliableExecutionStore({journal,admissionBinding:binding,admissionGuard});
 const adapter=createPiReliableMcpAdapter({...transport,resolveWorkspace:async (...args)=>{
  const workspace=await transport.resolveWorkspace(...args);
  if(workspace?.workspace_type!=="isolated_worktree"||workspace.state!=="active")reliableFailure("PERMISSION_DENIED");
  return workspace;
 },callTool:async params=>{
  // Check at the last dispatch boundary, including retries. Reconciliation remains observational.
  if(!await enabled())reliableFailure("PERMISSION_DENIED");
  return transport.callTool(params);
 }});
 const engine=createPiReliableExecutionEngine({store,adapter,...(retryPolicy?{retryPolicy}:{}),executionHook});
 function output(record) {return freeze({...record,result:{...record.result,phase:"E",mode:"new_operation_canary",
  canary_enrolled:true,cohort_id:binding.cohort_id,policy_hash:binding.policy_hash,legacy_migration:false,
  production_default_changed:false,engineering_review_required:true}});}
 return Object.freeze({
  admit:async source=>output(await store.admit(authorize(source),...(retryPolicy?[{retry_policy:retryPolicy}]:[]))),
  execute:async source=>output(await engine.execute(authorize(source))),
  inspect:async args=>{
   const record=await store.inspect(args),history=await journal.readExecutionProjections();
   validatePiExecutionHistory(history);enrolled(history,record.state.operation_id);authorize(record.intent);return output(record);
  },
 });
}

export function createPiCanaryStdioTransport(session) {
 if(!session||typeof session.call!=="function")reliableFailure("INVALID_CANARY_HOST_BINDING");
 const sessionId=randomUUID();let sequence=0;
 const callTool=params=>new Promise((resolve,reject)=>{
  session.call({jsonrpc:"2.0",id:"pi-canary-"+sessionId+"-"+(++sequence),method:"tools/call",params},(error,response)=>{
   if(error){const mapped=["CHILD_HUNG","CHILD_CALL_TIMEOUT"].includes(error.code)?"TIMEOUT":"TRANSPORT_ERROR";
    reject(Object.assign(new Error(mapped),{code:mapped}));return;}
   if(response?.error){reject(Object.assign(new Error("IMPLEMENTATION_FAILURE"),{code:"IMPLEMENTATION_FAILURE"}));return;}
   if(!response?.result){reject(Object.assign(new Error("CORRUPT_STATE"),{code:"CORRUPT_STATE"}));return;}
   resolve(response.result);
  });
 });
 async function facts(params) {
  const result=await callTool(params);
  if(result.isError)reliableFailure("PERMISSION_DENIED");
  if(result.structuredContent&&typeof result.structuredContent==="object")return result.structuredContent;
  try {return JSON.parse(result.content.find(x=>x.type==="text").text);}catch{reliableFailure("CORRUPT_STATE");}
 }
 return Object.freeze({callTool,
  queryOperation:args=>facts({name:"dev_workspace_get_operation",arguments:args}),
  resolveWorkspace:async args=>{
   const result=await facts({name:"dev_workspace_get_workspace",arguments:args});
   return result.workspace??result;
  },
 });
}

export async function readPiCanaryEnrollment(args,{journal={
 readExecutionProjections:readDevExecutionProjections,appendExecutionProjection:appendDevExecutionProjection,
 recoverExecutionPublication:recoverDevExecutionPublication}}={}) {
 const record=await createPiReliableExecutionStore({journal}).inspect(args);
 const history=await journal.readExecutionProjections();validatePiExecutionHistory(history);
 const first=history.find(e=>e.execution_projection.state.operation_id===record.state.operation_id&&e.execution_projection.revision===1);
 const binding=first?.execution_projection.command?.canary_binding;
 if(!binding)reliableFailure("LEGACY_OPERATION_NOT_MIGRATED");
 return freeze({policy:reliableJson(binding.policy),intent:record.intent,state:record.state,
  admission_receipt:{operation_id:first.operation_id,event_id:first.journal_event_id,event_hash:first.event_hash,sequence:first.sequence},
  production_default_changed:false,execution_enabled:false});
}
