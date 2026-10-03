import { createExecutionIntent, hashExecutionInput, classifyExecutionFailure } from "./pi-execution-contract.mjs";
import { createMcpCapabilityAdapter } from "./pi-mcp-adapter.mjs";
import { reliableFailure, reliableJson, receiptOf } from "./pi-reliable-execution-state.mjs";
const known=new Set(["TRANSPORT_ERROR","TEMPORARY_UNAVAILABLE","TIMEOUT","PERMISSION_DENIED","CORRUPT_STATE",
  "VALIDATION_FAILURE","TEST_FAILURE","GIT_SEMANTIC_CONFLICT","ARCHITECTURE_CONFLICT","IMPLEMENTATION_FAILURE"]);
export function reliableErrorCode(error) {return known.has(error?.code)?error.code:"UNCLASSIFIED_FAILURE";}
function observations(evidence) {
  const facts=[evidence];
  if(evidence?.structuredContent&&typeof evidence.structuredContent==="object")facts.push(evidence.structuredContent);
  for(const c of evidence?.content??[])if(c.type==="text") {
    try {const value=JSON.parse(c.text);if(value&&typeof value==="object")facts.push(value);} catch {}
  }
  return facts;
}
function timedRequest(callback,timeoutMs) {
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
    const error=new Error("TIMEOUT");error.code="TIMEOUT";reject(error);
  },timeoutMs);});
  return Promise.race([Promise.resolve().then(callback),timeout]).finally(()=>clearTimeout(timer));
}
export function createPiReliableMcpAdapter({callTool,queryOperation,resolveWorkspace,verifyScope,reconnect,
  requestTimeoutMs=120000,queryTimeoutMs=30000}={}) {
  if(!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>1800000
    ||!Number.isSafeInteger(queryTimeoutMs)||queryTimeoutMs<1||queryTimeoutMs>300000
    ||(reconnect!==undefined&&typeof reconnect!=="function"))reliableFailure("INVALID_TRANSPORT_BINDING");
  if(typeof callTool!=="function"||typeof queryOperation!=="function"||typeof resolveWorkspace!=="function")
    reliableFailure("HOST_ADAPTER_UNBOUND");
  const planner=createMcpCapabilityAdapter();
  function describe(source,stepId) {
    const intent=createExecutionIntent(source),step=planner.describe(intent,stepId);
    return {...step,request_fingerprint_sha256:hashExecutionInput({tool_name:step.tool,arguments:step.arguments})};
  }
  async function guard(intent,step) {
    if(intent.permissions[step.permission]!==true)reliableFailure("PERMISSION_DENIED");
    if(step.scope==="workspace") {
      const workspace=await timedRequest(()=>resolveWorkspace({workspace_id:intent.context.workspace_id},{mutation:step.effect}),queryTimeoutMs);
      if(!workspace||workspace.workspace_id!==intent.context.workspace_id||workspace.workstream_id!==intent.context.workstream_id)
        reliableFailure("PERMISSION_DENIED");
      if(step.effect&&(workspace.workspace_type!=="isolated_worktree"||workspace.state!=="active"))
        reliableFailure("PERMISSION_DENIED");
    } else {
      // Candidate/main/workstream operations require a server-owned scope authority.
      if(typeof verifyScope!=="function"||await timedRequest(()=>verifyScope({context:intent.context,step}),queryTimeoutMs)!==true)
        reliableFailure("PERMISSION_DENIED");
    }
  }
  async function execute(source,stepId) {
    const intent=createExecutionIntent(source),step=describe(intent,stepId);
    await guard(intent,step);
    const evidence=reliableJson(await timedRequest(()=>callTool({name:step.tool,arguments:step.arguments,
      ...(step.effect?{_meta:{reconciliation_key:step.idempotency_key}}:{})}),requestTimeoutMs));
    const action=intent.requested_actions.find(x=>x.step_id===stepId);
    const facts=observations(evidence);
    const deduped=facts.find(x=>x?.reconciled===true);
    if(deduped&&(deduped.reconciliation_key!==step.idempotency_key
      ||deduped.request_fingerprint_sha256!==step.request_fingerprint_sha256))reliableFailure("CORRUPT_STATE");
    const r=receiptOf(action,deduped??evidence,deduped?"reconciled_facts":"tool_response");
    const failed=facts.some(x=>x?.isError===true||x?.ok===false||x?.execution_ok===false||x?.passed===false);
    const verification=step.capability.startsWith("verification.");
    return {receipt:r,failed:failed||(deduped&&deduped.reconciliation_state!=="completed")
      ||(verification&&!(deduped?deduped.original_result?.passed===true:facts.some(x=>x?.passed===true))),
      error_code:failed?"TOOL_REPORTED_FAILURE":"VALIDATION_EVIDENCE_REQUIRED"};
  }
  async function reconcile(source,stepId) {
    const intent=createExecutionIntent(source),step=describe(intent,stepId);
    if(!step.effect)reliableFailure("INVALID_RECONCILIATION");
    // Lookup is read-only; no mutation guards or patch generation are performed here.
    const params={reconciliation_key:step.idempotency_key,request_fingerprint_sha256:step.request_fingerprint_sha256};
    const response=reliableJson(await timedRequest(()=>queryOperation(params),queryTimeoutMs));
    const facts=observations(response),raw=facts.find(x=>typeof x?.reconciliation_state==="string");
    if(!raw||response?.isError===true||raw.reconciliation_key!==params.reconciliation_key)
      return {verdict:"unknown",code:"UNSAFE_AMBIGUOUS_MUTATION"};
    const notStarted=raw.reconciliation_state==="not_admitted"&&
      (raw.safe_same_key_retry===true||(raw.safe_to_reinitiate===true&&raw.reinitiate_requires_same_key===true));
    if(raw.request_fingerprint_sha256!==undefined&&raw.request_fingerprint_sha256!==params.request_fingerprint_sha256)
      return {verdict:"unknown",code:"RECONCILIATION_KEY_CONFLICT"};
    if(notStarted) {
      const evidence={...raw,request_fingerprint_sha256:params.request_fingerprint_sha256,safe_same_key_retry:true};
      return {verdict:"not_started",receipt:receiptOf(intent.requested_actions.find(x=>x.step_id===stepId),evidence,"reconciled_facts")};
    }
    if(raw.reconciliation_state==="active"&&raw.request_fingerprint_sha256===params.request_fingerprint_sha256)
      return {verdict:"active",receipt:receiptOf(intent.requested_actions.find(x=>x.step_id===stepId),raw,"reconciled_facts")};
    if(raw.reconciliation_state==="completed"&&raw.request_fingerprint_sha256===params.request_fingerprint_sha256
      &&/^dev_operation_[a-f0-9]{32}$/u.test(raw.operation_id)) {
      if(step.capability.startsWith("verification.")&&raw.original_result?.passed!==true)
        return {verdict:"unknown",code:"VALIDATION_EVIDENCE_REQUIRED"};
      return {verdict:"completed",receipt:receiptOf(intent.requested_actions.find(x=>x.step_id===stepId),raw,"reconciled_facts")};
    }
    return {verdict:"unknown",code:raw.reinitiate_requires_new_key===true?"NEW_IDEMPOTENCY_KEY_REQUIRED":"UNSAFE_AMBIGUOUS_MUTATION"};
  }
  return Object.freeze({describe,execute,reconcile,classify:classifyExecutionFailure,
    reconnect:reconnect?()=>timedRequest(reconnect,queryTimeoutMs):null});
}
