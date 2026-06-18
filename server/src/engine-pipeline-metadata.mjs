import { normalizeNeuralModuleKey } from "./neural-module-utils.mjs";

export function engineComponentsSnapshot(status = {}) {
  const components = status.components ?? {};
  return {
    canon_data: {
      path: components.canon_data?.path ?? "",
      actual_sha256_lf: components.canon_data?.actual_sha256_lf ?? null,
      valid: components.canon_data?.hash_matches === true,
    },
    writing_method: {
      path: components.writing_method?.path ?? "",
      version_label: components.writing_method?.version ?? null,
      valid: components.writing_method?.status === "available",
    },
    proofing_method: {
      path: components.proofing_method?.path ?? "",
      version_label: components.proofing_method?.version ?? null,
      valid: components.proofing_method?.status === "available",
    },
    neural_pipeline: {
      required: components.neural_pipeline?.required === true,
      required_modules: (components.neural_pipeline?.modules ?? [])
        .filter((module) => module.required_status === "available")
        .map((module) => module.name),
    },
    governance_policy: {
      required: components.governance_policy?.required === true,
      valid: components.governance_policy?.status === "available",
    },
  };
}

export function buildEnginePipelineMetadata(context = null, neuralUsage = {}) {
  const engineFirst = context?.engine_first === true;
  const status = context?.engine_components_status ?? {};
  const snapshot = engineComponentsSnapshot(status);
    const requiredModulesRaw = engineFirst
      ? [...(context.required_neural_modules ?? snapshot.neural_pipeline.required_modules)]
      : [];
    // Normalize required module names to canonical keys (strip any wrapper prefix)
    const requiredModules = requiredModulesRaw.map((name) => normalizeNeuralModuleKey(name)).filter(Boolean);
    const successfulTraceModules = new Set(neuralUsage.neural_modules_used ?? []);
    // Produce canonical lists for used and missing modules
    const usedModules = requiredModules.filter((moduleName) => successfulTraceModules.has(moduleName));
    const missingModules = requiredModules.filter((moduleName) => !successfulTraceModules.has(moduleName));
  const neuralRequired = engineFirst && (
    context.neural_pipeline_required === true
    || snapshot.neural_pipeline.required === true
  );
  // Split required modules into pre- and post-generation concerns.
  const preGenerationRequired = [
    "scene_planner",
    "character_simulator",
    "neural_critic",
    "style_drift_detector",
    "over_governance_detector",
    "writing_card_director",
  ];
  const postGenerationRequired = ["final_polisher"];
  const successful = new Set(neuralUsage.neural_modules_used ?? []);
  const pre_used = preGenerationRequired.filter((m) => successful.has(m));
  const pre_missing = preGenerationRequired.filter((m) => !successful.has(m));
  const pre_complete = pre_missing.length === 0;
  const post_used = postGenerationRequired.filter((m) => successful.has(m));
  const post_missing = postGenerationRequired.filter((m) => !successful.has(m));
  const post_complete = post_missing.length === 0;
  const engineComponentsValid = engineFirst && context.engine_components_valid === true;
  const warnings = [];
  if (!engineFirst) warnings.push("missing_engine_first_context");
  if (engineFirst && !engineComponentsValid) warnings.push("invalid_engine_components");
  if (neuralRequired && missingModules.length) {
    warnings.push("missing_required_neural_modules");
  }
  return {
    engine_first: engineFirst,
    engine_state_id: engineFirst ? context.engine_id ?? null : null,
    context_snapshot_id: context?.bundle_id ?? context?.context_bundle_id ?? null,
    context_bundle_id: context?.bundle_id ?? context?.context_bundle_id ?? null,
    engine_components_snapshot: snapshot,
    engine_components_valid: engineComponentsValid,
    engine_component_validation_errors: [
      ...(context?.engine_component_validation_errors ?? []),
    ],
    canon_data_actual_sha256_lf: snapshot.canon_data.actual_sha256_lf,
    writing_method_component_label: snapshot.writing_method.version_label,
    proofing_method_component_label: snapshot.proofing_method.version_label,
    neural_pipeline_required: neuralRequired,
    required_neural_modules: requiredModules,
    neural_modules_used: usedModules,
    missing_required_neural_modules: neuralRequired ? missingModules : [],
    // New fields splitting pre/post generation status for Phase22S
    pre_generation_neural_trace_complete: pre_complete,
    pre_generation_modules_used: pre_used,
    post_generation_neural_trace_complete: post_complete,
    post_generation_modules_used: post_used,
    // writing pipeline considered complete only when pre/post traces present
    // (structural revisions decision will be evaluated elsewhere)
    writing_pipeline_complete: engineComponentsValid && pre_complete && post_complete,
    neural_trace_complete: engineFirst && (!neuralRequired || missingModules.length === 0),
    pipeline_status: (
      engineComponentsValid && (!neuralRequired || missingModules.length === 0)
        ? "complete_engine_pipeline"
        : "incomplete_engine_pipeline"
    ),
    canon_update_allowed: false,
    approval_required_for_canon_change: true,
    warnings,
  };
}
