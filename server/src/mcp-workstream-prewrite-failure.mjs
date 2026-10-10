import {getMcpOperationReconciliationContext} from './mcp-operation-reconciliation-context.mjs';

// Process-local execution facts only. JSON, error strings/codes and caller
// metadata cannot mint this proof. It expires at serialization/process exit.
const proofs=new WeakMap();
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
