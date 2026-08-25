import {
  neuralAdapterExecutionKinds,
  neuralAdapterProvenanceVersion,
} from "./neural-adapter-provenance-service.mjs";
import {
  normalizeNeuralModuleKey,
} from "./neural-module-utils.mjs";

export const neuralUsageEvidenceVersion =
  "phase62a-r2-neural-usage-evidence-v2";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedModuleNames(traces) {
  return [...new Set(
    traces
      .map((trace) => normalizeNeuralModuleKey(trace?.module_name))
      .filter(Boolean),
  )];
}

export function isWorldSimulationNeuralUsageRun(run = {}) {
  return run.session_mode === "world_simulation"
    || run.task_type === "world_simulation"
    || run.mode === "chatgpt_owned_world_simulation";
}

function hasCurrentProvenance(summary) {
  return summary.neural_adapter_provenance_version
    === neuralAdapterProvenanceVersion;
}

function modelBackedExecutionTrace(trace) {
  const inputSummary = object(trace?.input_summary);
  return hasCurrentProvenance(inputSummary)
    && inputSummary.neural_adapter_execution_kind
      === neuralAdapterExecutionKinds.MODEL_BACKED_ATTESTED
    && inputSummary.neural_adapter_attested === true
    && inputSummary.neural_adapter_model_backed === true
    && inputSummary.adapter_invoked === true
    && inputSummary.adapter_completed === true
    && inputSummary.model_backed_execution_evidenced === true;
}

function worldAcceptedExtensionTrace(trace) {
  const outputSummary = object(trace?.output_summary);
  return trace?.status === "success"
    && outputSummary.neural_extension_accepted === true
    && outputSummary.trusted_base_fallback_used !== true;
}

function worldTrustedProgrammaticSuccessTrace(trace) {
  const inputSummary = object(trace?.input_summary);
  return trace?.status === "success"
    && inputSummary.trusted_programmatic_base_used === true
    && inputSummary.adapter_invoked !== true;
}

function worldFallbackSuccessTrace(trace) {
  const inputSummary = object(trace?.input_summary);
  const outputSummary = object(trace?.output_summary);
  return trace?.status === "success"
    && inputSummary.adapter_invoked === true
    && (
      outputSummary.trusted_base_fallback_used === true
      || outputSummary.neural_extension_accepted !== true
    );
}

function adapterInvocationTrace(trace) {
  return object(trace?.input_summary).adapter_invoked === true;
}

function adapterCompletionTrace(trace) {
  return object(trace?.input_summary).adapter_completed === true;
}

function adapterKindTrace(trace, executionKind) {
  const inputSummary = object(trace?.input_summary);
  return hasCurrentProvenance(inputSummary)
    && inputSummary.adapter_invoked === true
    && inputSummary.neural_adapter_execution_kind === executionKind;
}

export function classifyNeuralUsageEvidence({
  run = {},
  traces = [],
} = {}) {
  const traceList = array(traces);
  const successTraces = traceList.filter(
    (trace) => trace?.status === "success",
  );
  const successfulWrapperModules =
    normalizedModuleNames(successTraces);
  const worldSimulation =
    isWorldSimulationNeuralUsageRun(run);

  // A wrapper success, an adapter invocation, and accepted adapter output are
  // not proof that a neural model executed. Only server-side attestation bound
  // to the function identity plus an adapter return can establish that fact.
  const neuralEvidenceTraces =
    traceList.filter(modelBackedExecutionTrace);
  const neuralExecutionModules =
    normalizedModuleNames(neuralEvidenceTraces);

  const trustedProgrammaticSuccessTraces = worldSimulation
    ? successTraces.filter(worldTrustedProgrammaticSuccessTrace)
    : [];
  const fallbackSuccessTraces = worldSimulation
    ? successTraces.filter(worldFallbackSuccessTrace)
    : [];
  const acceptedWorldExtensionTraces = worldSimulation
    ? successTraces.filter(worldAcceptedExtensionTrace)
    : [];

  const provenanceClassifiedSuccessTraces = successTraces.filter(
    (trace) => hasCurrentProvenance(object(trace?.input_summary)),
  );
  const unclassifiedSuccessCount = successTraces.length
    - provenanceClassifiedSuccessTraces.length;

  const adapterInvocationTraces =
    traceList.filter(adapterInvocationTrace);
  const adapterCompletionTraces =
    traceList.filter(adapterCompletionTrace);
  const unattestedAdapterInvocationTraces = traceList.filter(
    (trace) => adapterKindTrace(
      trace,
      neuralAdapterExecutionKinds.UNATTESTED_CALLABLE,
    ),
  );
  const deterministicAdapterInvocationTraces = traceList.filter(
    (trace) => adapterKindTrace(
      trace,
      neuralAdapterExecutionKinds.DETERMINISTIC_PROGRAMMATIC,
    ),
  );
  const modelBackedAdapterInvocationTraces = traceList.filter(
    (trace) => adapterKindTrace(
      trace,
      neuralAdapterExecutionKinds.MODEL_BACKED_ATTESTED,
    ),
  );
  const modelBackedAdapterCompletionTraces =
    modelBackedAdapterInvocationTraces.filter(adapterCompletionTrace);

  const requiredModules =
    Array.isArray(run.required_neural_modules)
      ? run.required_neural_modules
      : [];
  const missingRequiredModules = run.requires_neural_modules
    ? requiredModules.filter(
      (moduleName) => !successfulWrapperModules.includes(moduleName),
    )
    : [];

  return {
    neural_usage_evidence_version:
      neuralUsageEvidenceVersion,
    neural_adapter_provenance_version:
      neuralAdapterProvenanceVersion,
    evidence_policy:
      "strict_server_attested_model_backed_execution",
    wrapper_completion_policy:
      "successful_wrapper_trace_compatibility",
    world_simulation_run: worldSimulation,
    trace_count: traceList.length,
    success_count: successTraces.length,
    failed_count: traceList.filter(
      (trace) => trace?.status === "failed",
    ).length,
    skipped_count: traceList.filter(
      (trace) => trace?.status === "skipped",
    ).length,
    capability_success_count:
      worldSimulation ? successTraces.length : null,
    successful_wrapper_modules:
      successfulWrapperModules,
    successful_wrapper_modules_semantics:
      "successful_wrapper_or_capability_traces",
    neural_execution_modules:
      neuralExecutionModules,
    neural_execution_evidence_count:
      neuralEvidenceTraces.length,
    model_backed_execution_modules:
      neuralExecutionModules,
    model_backed_execution_evidence_count:
      neuralEvidenceTraces.length,
    used_neural_network:
      neuralExecutionModules.length > 0,
    neural_adapter_metrics_applicable:
      true,
    neural_adapter_invocation_count:
      adapterInvocationTraces.length,
    neural_adapter_completion_count:
      adapterCompletionTraces.length,
    neural_adapter_success_evidence_count:
      neuralEvidenceTraces.filter(
        (trace) => trace?.status === "success",
      ).length,
    unattested_adapter_invocation_count:
      unattestedAdapterInvocationTraces.length,
    deterministic_adapter_invocation_count:
      deterministicAdapterInvocationTraces.length,
    model_backed_adapter_invocation_count:
      modelBackedAdapterInvocationTraces.length,
    model_backed_adapter_completion_count:
      modelBackedAdapterCompletionTraces.length,
    trusted_programmatic_success_count:
      trustedProgrammaticSuccessTraces.length,
    neural_fallback_success_count:
      fallbackSuccessTraces.length,
    accepted_world_neural_extension_count:
      acceptedWorldExtensionTraces.length,
    unclassified_success_count:
      unclassifiedSuccessCount,
    unclassified_world_success_count:
      worldSimulation ? unclassifiedSuccessCount : 0,
    required_neural_modules:
      requiredModules,
    missing_required_neural_modules:
      missingRequiredModules,
    warning:
      missingRequiredModules.length > 0,
  };
}
