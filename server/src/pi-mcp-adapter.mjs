import {
  CAPABILITY_DEFINITIONS, capabilityDefinition, createExecutionIntent,
  classifyExecutionFailure, hashExecutionInput,
} from "./pi-execution-contract.mjs";
import {piBootstrapContext} from "./pi-workstream-bootstrap.mjs";

// Caller intents can select a stable capability, never a tool name or endpoint.
export function createCapabilityRegistry() {
  return Object.freeze({
    resolve: capabilityDefinition,
    list: () => CAPABILITY_DEFINITIONS.map(x => x),
  });
}
function failure(code) { const e = new Error(code); e.code = code; throw e; }
const maximumResultBytes = 64 * 1024;
const recognizedErrorCodes = new Set(["TRANSPORT_ERROR", "TEMPORARY_UNAVAILABLE", "TIMEOUT",
  "PERMISSION_DENIED", "CORRUPT_STATE", "VALIDATION_FAILURE", "TEST_FAILURE",
  "GIT_SEMANTIC_CONFLICT", "ARCHITECTURE_CONFLICT", "IMPLEMENTATION_FAILURE"]);

export function createMcpCapabilityAdapter({ callTool, resolveWorkspace } = {}) {
  // These bindings are host-only dependencies. They never appear in the intent contract.
  const registry = createCapabilityRegistry();
  const describe = (source, stepId, {binding=null}={}) => {
    const intent = createExecutionIntent(source);
    const action = intent.requested_actions.find(x => x.step_id === stepId);
    if (!action) failure("UNREQUESTED_STEP");
    const definition = registry.resolve(action.capability);
    if(binding && intent.bootstrap!==true) failure("UNEXPECTED_BOOTSTRAP_BINDING");
    const context=piBootstrapContext(binding,intent.context);
    const args = { ...action.input };
    if(intent.bootstrap && action.capability==="workspace.create_isolated") {
      if(!binding || binding.workspace_id!=="dev_workspace_shared_repository_v1") failure("BOOTSTRAP_BINDING_REQUIRED");
      args.workstream_id=binding.workstream_id;args.expected_workstream_revision=binding.workstream_revision;
    }
    if (definition.scope === "workspace") args.workspace_id = context.workspace_id;
    if (definition.scope === "host_maintenance") args.workspace_id = "dev_workspace_shared_repository_v1";
    if (definition.scope === "operation_list") {
      args.workspace_id = context.workspace_id;
      args.workstream_id = context.workstream_id;
    }
    if (definition.scope === "provenance") args.workspace_id = context.workspace_id;
    return Object.freeze({
      step_id: stepId, capability: action.capability, tool: definition.tool,
      ...(intent.bootstrap?{execution_context:context}:{}),
      effect: definition.effect, permission: definition.permission,
      scope: definition.scope, depends_on: action.depends_on,
      idempotency_key: action.idempotency_key ?? null,
      input_hash: hashExecutionInput(action.input),
      // No endpoint, executable, environment, shell or model configuration.
      arguments: Object.freeze(args),
    });
  };
  return Object.freeze({
    registry,
    describe,
    async execute(source, stepId, { mode = "shadow" } = {}) {
      const intent = createExecutionIntent(source);
      const step = describe(intent, stepId);
      if (!["shadow", "read_only"].includes(mode)) failure("ROUTE_NOT_ENABLED");
      if (mode === "shadow") return Object.freeze({ status: "PLANNED", step, model_requests: 0 });
      if (step.effect) failure("MUTATION_NOT_ENABLED");
      // Cross-operation observations need journal identity binding in Phase B.
      if (step.scope !== "workspace") failure("CAPABILITY_READ_NOT_ENABLED");
      if (typeof callTool !== "function" || typeof resolveWorkspace !== "function") failure("HOST_ADAPTER_UNBOUND");
      const context = await resolveWorkspace({ workspace_id: intent.context.workspace_id }, { mutation: false });
      if (!context || context.workspace_id !== intent.context.workspace_id
        || context.workstream_id !== intent.context.workstream_id) failure("WORKSPACE_IDENTITY_MISMATCH");
      try {
        const evidence = await callTool(step.tool, step.arguments);
        const serialized = JSON.stringify(evidence);
        if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > maximumResultBytes) failure("RESULT_LIMIT");
        const observed = JSON.parse(serialized);
        const resultHash = hashExecutionInput(observed);
        // Do not infer engineering success from content. GPT evaluates the tool's facts.
        const toolError = observed?.isError === true || observed?.ok === false || observed?.execution_ok === false;
        return Object.freeze({
          status: toolError ? "DECISION_REQUIRED" : "OBSERVED",
          step_id: stepId, tool: step.tool, workspace_id: context.workspace_id,
          input_hash: step.input_hash, result_hash: resultHash,
          evidence: observed, model_requests: 0,
          ...(toolError ? { decision: classifyExecutionFailure({ code: "TOOL_REPORTED_FAILURE" }) } : {}),
        });
      } catch (error) {
        const code = recognizedErrorCodes.has(error?.code) ? error.code : "UNCLASSIFIED_FAILURE";
        const decision = classifyExecutionFailure({ code, mutation: false });
        return Object.freeze({
          status: decision.action === "retry" ? "WAITING_RETRY"
            : decision.action === "fail_safe" ? "FAILED"
            : decision.action === "stop" ? "BLOCKED" : "DECISION_REQUIRED",
          step_id: stepId, tool: step.tool, input_hash: step.input_hash,
          error: Object.freeze({ code }), decision, model_requests: 0,
        });
      }
    },
  });
}
