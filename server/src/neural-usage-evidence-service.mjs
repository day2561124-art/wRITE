import {
  normalizeNeuralModuleKey,
} from "./neural-module-utils.mjs";

export const neuralUsageEvidenceVersion =
  "phase62a-r2-neural-usage-evidence-v1";

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

function worldAcceptedNeuralTrace(trace) {
  const inputSummary = object(trace?.input_summary);
  const outputSummary = object(trace?.output_summary);
  return trace?.status === "success"
    && inputSummary.adapter_invoked === true
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

  const neuralEvidenceTraces = worldSimulation
    ? successTraces.filter(worldAcceptedNeuralTrace)
    : successTraces;
  const neuralExecutionModules =
    normalizedModuleNames(neuralEvidenceTraces);

  const trustedProgrammaticSuccessTraces = worldSimulation
    ? successTraces.filter(worldTrustedProgrammaticSuccessTrace)
    : [];
  const fallbackSuccessTraces = worldSimulation
    ? successTraces.filter(worldFallbackSuccessTrace)
    : [];

  const classifiedWorldTraceIds = new Set([
    ...neuralEvidenceTraces,
    ...trustedProgrammaticSuccessTraces,
    ...fallbackSuccessTraces,
  ].map((trace) => trace?.trace_id).filter(Boolean));

  const unclassifiedWorldSuccessCount = worldSimulation
    ? successTraces.filter((trace) => (
      !trace?.trace_id
      || !classifiedWorldTraceIds.has(trace.trace_id)
    )).length
    : 0;

  const neuralAdapterInvocationCount = worldSimulation
    ? traceList.filter(
      (trace) => object(trace?.input_summary).adapter_invoked === true,
    ).length
    : null;

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
    evidence_policy: worldSimulation
      ? "world_adapter_invoked_and_extension_accepted"
      : "legacy_successful_wrapper_trace_compatibility",
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
    used_neural_network:
      neuralExecutionModules.length > 0,
    neural_adapter_metrics_applicable:
      worldSimulation,
    neural_adapter_invocation_count:
      neuralAdapterInvocationCount,
    neural_adapter_success_evidence_count:
      worldSimulation ? neuralEvidenceTraces.length : null,
    trusted_programmatic_success_count:
      trustedProgrammaticSuccessTraces.length,
    neural_fallback_success_count:
      fallbackSuccessTraces.length,
    unclassified_world_success_count:
      unclassifiedWorldSuccessCount,
    required_neural_modules:
      requiredModules,
    missing_required_neural_modules:
      missingRequiredModules,
    warning:
      missingRequiredModules.length > 0,
  };
}
