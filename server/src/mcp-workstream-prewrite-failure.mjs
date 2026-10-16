import {hostname} from 'node:os';
import {getMcpOperationReconciliationContext} from './mcp-operation-reconciliation-context.mjs';

// Process-local execution facts only. JSON, error strings/codes and caller
// metadata cannot mint this proof. It expires at serialization/process exit.
const proofs=new WeakMap();
const isolationProofs=new WeakMap();
export function markIsolationBeforeDispatch(error){
 const c=getMcpOperationReconciliationContext();
 if(error instanceof Error&&c?.tool_name==='dev_workspace_create_isolated'&&c.operation_id)
  isolationProofs.set(error,Object.freeze({protocol:'writer-workbench/isolation-before-handler/v1',operation_id:c.operation_id,
   reconciliation_key:c.reconciliation_key,request_fingerprint_sha256:c.request_fingerprint_sha256,pid:process.pid,hostname:hostname()}));
 return error;
}
export function readIsolationBeforeDispatchProof(error){
 const proof=error&&typeof error==='object'?isolationProofs.get(error):null,c=getMcpOperationReconciliationContext();
 return proof&&c?.operation_id===proof.operation_id&&c.reconciliation_key===proof.reconciliation_key
  &&c.request_fingerprint_sha256===proof.request_fingerprint_sha256?proof:null;
}
const tool='dev_workspace_update_workstream';
export function markWorkstreamStaleBeforeWrite(error,{expected_revision,current_revision}) {
  const context=getMcpOperationReconciliationContext();
  if(!(error instanceof Error)||error.code!=='WORKSTREAM_STALE_REVISION'
    ||context?.tool_name!==tool||!context.operation_id
    ||!Number.isSafeInteger(expected_revision)||expected_revision<1
    ||!Number.isSafeInteger(current_revision)||current_revision<1
    ||expected_revision===current_revision)return error;
  proofs.set(error,Object.freeze({tool_name:tool,operation_id:context.operation_id,
    reconciliation_key:context.reconciliation_key,request_fingerprint_sha256:context.request_fingerprint_sha256}));
  return error;
}
export function preserveWorkstreamPrewriteFailure(error,response) {
  const proof=proofs.get(error);
  if(proof&&response&&typeof response==='object'&&response.isError===true)proofs.set(response,proof);
  return response;
}
export function isWorkstreamPrewriteFailure(value,{tool_name,operation_id}) {
  const proof=value&&typeof value==='object'?proofs.get(value):null;
  const context=getMcpOperationReconciliationContext();
  return !!proof&&tool_name===tool&&proof.tool_name===tool_name
    &&proof.operation_id===operation_id&&context?.operation_id===operation_id
    &&proof.reconciliation_key===context.reconciliation_key
    &&proof.request_fingerprint_sha256===context.request_fingerprint_sha256;
}
