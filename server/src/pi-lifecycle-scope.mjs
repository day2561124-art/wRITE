const sha1Pattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const operationPattern = /^dev_operation_[a-f0-9]{32}$/u;

function failure(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function identity(workstream, context) {
  return workstream && workstream.workstream_id === context.workstream_id
    && workstream.workspace_id === context.workspace_id;
}
export async function verifyPiBlockerResolution({workstream, context, resolution_operation_id, getOperation}) {
  const blockerId=workstream?.metadata?.blocker_operation_id;
  if(!operationPattern.test(blockerId??"") || !operationPattern.test(resolution_operation_id??"")) return false;
  const proof=await getOperation({operation_id:resolution_operation_id});
  if(proof?.workspace_id!==context.workspace_id || proof.workstream_id!==context.workstream_id || proof.terminal!==true) return false;
  if(proof.operation_id===blockerId) return proof.reconciliation_state==="no_effect" && !!proof.resolution_event_id;
  const blocker=await getOperation({operation_id:blockerId});
  return blocker?.workspace_id===context.workspace_id && blocker.workstream_id===context.workstream_id
    && blocker.tool_name==="dev_run_tests" && proof.tool_name==="dev_run_tests"
    && proof.reconciliation_state==="completed" && proof.original_result?.passed===true
    && typeof proof.original_result?.suite==="string" && proof.original_result.suite===blocker.original_result?.suite
    && (proof.events?.at(-1)?.sequence??0)>(blocker.events?.at(-1)?.sequence??Infinity);
}
export function createPiLifecycleScopeVerifier({ getWorkstream, getCheckpoint, getOperation } = {}) {
  if (typeof getWorkstream !== "function" || typeof getCheckpoint !== "function"
    || typeof getOperation !== "function") {
    failure("HOST_LIFECYCLE_SCOPE_UNBOUND");
  }
  return async ({ context, step } = {}) => {
    if (!context || !step || typeof step !== "object" || !step.arguments) return false;
    if (step.scope === "workstream") {
      if (step.tool !== "dev_workspace_get_workstream") return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      return identity(workstream, context) && step.arguments.workstream_id === context.workstream_id;
    }
    if (step.scope === "workstream_update") {
      if (step.tool !== "dev_workspace_update_workstream") return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      if(workstream?.state==="blocked" && step.arguments.state==="active" && !await verifyPiBlockerResolution({workstream,context,resolution_operation_id:step.arguments.blocker_resolution_operation_id,getOperation})) return false;
      return identity(workstream, context)
        && !["completed", "abandoned"].includes(workstream.state)
        && step.arguments.workstream_id === context.workstream_id
        && step.arguments.expected_revision === workstream.revision
        && ["active", "paused", "blocked"].includes(step.arguments.state);
    }
    if(step.scope==="workstream_end") {
      if(step.tool!=="dev_workspace_end_workstream")return false;
      const workstream=await getWorkstream({workstream_id:context.workstream_id});
      return identity(workstream,context) && !["completed","abandoned"].includes(workstream.state)
        && step.arguments.workstream_id===context.workstream_id && step.arguments.expected_revision===workstream.revision
        && ["completed","abandoned"].includes(step.arguments.outcome);
    }
    if (step.scope === "checkpoint") {
      if (step.tool !== "dev_workspace_get_checkpoint") return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      const checkpoint = await getCheckpoint({ checkpoint_id: step.arguments.checkpoint_id });
      return identity(workstream, context)
        && checkpoint?.checkpoint_id === step.arguments.checkpoint_id
        && checkpoint.workstream_id === context.workstream_id
        && checkpoint.workspace_id === context.workspace_id
        && checkpoint.workstream_base_head === workstream.base_head
        && checkpoint.state === "active" && checkpoint.health === "healthy"
        && sha1Pattern.test(checkpoint.git_head ?? "")
        && sha256Pattern.test(checkpoint.workspace_snapshot_id ?? "");
    }
    if (step.scope === "operation") {
      if (step.tool !== "dev_workspace_get_operation" || !operationPattern.test(step.arguments.operation_id ?? "")) return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      const operation = await getOperation({ operation_id: step.arguments.operation_id });
      return identity(workstream, context)
        && operation?.operation_id === step.arguments.operation_id
        && operation.workstream_id === context.workstream_id
        && operation.workspace_id === context.workspace_id;
    }
    if (step.scope === "operation_list") {
      if (step.tool !== "dev_workspace_list_operations") return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      return identity(workstream, context)
        && step.arguments.workstream_id === context.workstream_id
        && step.arguments.workspace_id === context.workspace_id;
    }
    if (step.scope === "provenance") {
      if (step.tool !== "dev_workspace_get_provenance") return false;
      const workstream = await getWorkstream({ workstream_id: context.workstream_id });
      return identity(workstream, context) && step.arguments.workspace_id === context.workspace_id;
    }
    return false;
  };
}
