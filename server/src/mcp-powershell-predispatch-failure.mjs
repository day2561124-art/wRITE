import { getMcpOperationReconciliationContext } from "./mcp-operation-reconciliation-context.mjs";

const tools = new Set(["powershell_run", "powershell_admin_run"]);
const proofs = new WeakMap();

// Only call this at a boundary that has not invoked the PowerShell executor.
// The witness stays in this process and is bound to the exact outer admission.
export function markPowerShellPreDispatchFailure(error, toolName) {
  const context = getMcpOperationReconciliationContext();
  if (error instanceof Error && tools.has(toolName)
    && context?.tool_name === toolName && context.operation_id && context.reconciliation_key) {
    proofs.set(error, {
      toolName, operationId: context.operation_id,
      key: context.reconciliation_key, fingerprint: context.request_fingerprint_sha256,
    });
  }
  return error;
}

export function preservePowerShellPreDispatchFailure(error, response) {
  const proof = proofs.get(error);
  if (proof && response?.isError === true) proofs.set(response, proof);
}

export function isPowerShellPreDispatchFailure(value, admission) {
  const proof = proofs.get(value);
  const context = getMcpOperationReconciliationContext();
  return !!proof && proof.toolName === context?.tool_name
    && proof.operationId === admission.operation_id && proof.operationId === context.operation_id
    && proof.key === context.reconciliation_key
    && proof.fingerprint === context.request_fingerprint_sha256;
}
