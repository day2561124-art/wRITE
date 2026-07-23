import { createHash } from "node:crypto";
import {
  createAgentRun,
  finalizeAgentRun,
} from "./agent-run-service.mjs";
import {
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
  run_writing_card_director,
  run_final_polisher,
  buildStoryMaterialCognitionContract,
} from "./neural-module-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";

const DEFAULT_MODULE_ORDER = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
  "final_polisher",
];

const WRAPPER_BY_MODULE = {
  scene_planner: run_scene_planner,
  character_simulator: run_character_simulator,
  neural_critic: run_neural_critic,
  style_drift_detector: run_style_drift_detector,
  over_governance_detector: run_over_governance_detector,
  writing_card_director: run_writing_card_director,
  final_polisher: run_final_polisher,
};

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function text(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toPlainJson(value, maxChars = 12000) {
  try {
    const raw = JSON.stringify(value ?? null, null, 2);
    return raw.length <= maxChars
      ? raw
      : raw.slice(0, maxChars) + "\n...[truncated:" + (raw.length - maxChars) + "]";
  } catch {
    return String(value ?? "");
  }
}

function resultExcerpt(value, maxChars = 1600) {
  const raw = toPlainJson(value, maxChars);
  return raw.length <= maxChars
    ? raw
    : raw.slice(0, maxChars) + "\n...[truncated:" + (raw.length - maxChars) + "]";
}

function normalizeModuleName(name) {
  const raw = text(name);
  return raw.startsWith("run_") ? raw.slice(4) : raw;
}

function wrapperName(moduleName) {
  return moduleName.startsWith("run_") ? moduleName : "run_" + moduleName;
}

function unique(values) {
  return [...new Set(values.map(normalizeModuleName).filter(Boolean))];
}

function normalizeExecutionModules(input = {}) {
  const required = unique(input.required_modules ?? input.requiredModules ?? []);
  const modules = required.filter((moduleName) => Object.hasOwn(WRAPPER_BY_MODULE, moduleName));

  if (input.include_writing_card_director !== false && !modules.includes("writing_card_director")) {
    modules.push("writing_card_director");
  }

  if (input.include_final_polisher !== false && !modules.includes("final_polisher")) {
    modules.push("final_polisher");
  }

  return DEFAULT_MODULE_ORDER.filter((moduleName) => modules.includes(moduleName));
}

function compactWritingContext(writingContext = {}) {
  return {
    context_kind: writingContext.context_kind ?? "formal_writing_context",
    user_request: writingContext.user_request ?? "",
    creative_authority: writingContext.creative_authority ?? {},
    external_research: writingContext.external_research ?? {},
    active_engine_metadata: writingContext.active_engine_metadata ?? {},
    materials: writingContext.materials ?? {},
  };
}

function moduleInput(moduleName, input = {}) {
  return {
    module_name: wrapperName(moduleName),
    task_prompt: input.task_prompt,
    chapter_mode: input.chapter_mode ?? "next_chapter",
    generation_context: input.generation_context ?? {},
    retrieval_context: input.retrieval_context ?? {},
    writing_context: compactWritingContext(input.writing_context ?? {}),
    bundle_metadata: {
      bundle_id: input.bundle?.bundle_id ?? null,
      engine_id: input.bundle?.engine_id ?? null,
      neural_pipeline_required: input.bundle?.neural_pipeline_required === true,
      required_neural_modules: input.bundle?.required_neural_modules ?? [],
      character_voice_registry_loaded: input.bundle?.character_voice_registry_loaded === true,
      guard_severity: input.bundle?.guard_severity ?? null,
    },
    execution_mode: "chatgpt_native_trace_only_pre_handoff",
  };
}

function defaultModuleAdapter(moduleName) {
  return async (input, meta = {}) => {
    const base = {
      module_name: wrapperName(moduleName),
      canonical_module_name: moduleName,
      adapter_source: "chatgpt_native_trace_only_builtin_adapter",
      execution_mode: "trace_only_neural_execution_for_chatgpt_native_handoff",
      task_type: meta.task_type ?? "draft_generation",
      input_digest: sha256(toPlainJson(input)).slice(0, 16),
    };
    return {
      ...base,
      result_summary: buildStoryMaterialCognitionContract(moduleName)?.purpose
        ?? moduleName,
      module_contract: buildStoryMaterialCognitionContract(moduleName),
    };
  };
}

function adapterFor(moduleName, options = {}) {
  const adapters = options.chatgptNativeNeuralAdapters
    ?? options.neuralAdapters
    ?? options.neural_adapters
    ?? null;
  const globalAdapter = options.chatgptNativeNeuralAdapter
    ?? options.neuralAdapter
    ?? options.neural_adapter
    ?? null;

  if (adapters && typeof adapters[moduleName] === "function") return adapters[moduleName];
  if (adapters && typeof adapters[wrapperName(moduleName)] === "function") return adapters[wrapperName(moduleName)];
  if (typeof globalAdapter === "function") return globalAdapter;

  if (options.disable_chatgpt_native_default_neural_adapter === true) return null;
  return defaultModuleAdapter(moduleName);
}

function summarizeOutput(output) {
  if (output && typeof output === "object") {
    for (const key of ["result_summary", "summary", "guidance", "note"]) {
      if (typeof output[key] === "string" && output[key].trim()) return output[key].trim();
    }
  }
  if (typeof output === "string" && output.trim()) return output.trim().slice(0, 500);
  return resultExcerpt(output, 500);
}

export async function executeChatgptNativeTraceOnlyNeuralModules(rawInput = {}, options = {}) {
  const modules = normalizeExecutionModules(rawInput);
  const agentRunOptions = options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
  if (modules.length === 0) {
    return {
      status: "skipped",
      run_id: null,
      required_modules_executed: false,
      chatgpt_native_neural_modules_executed: false,
      module_results_attached_to_handoff: false,
      neural_trace_created: false,
      neural_module_execution_results: [],
      neural_trace_summary: {
        run_id: null,
        trace_count: 0,
        success_count: 0,
        failed_count: 0,
        skipped_count: 0,
        required_neural_modules: [],
        missing_required_neural_modules: [],
        used_neural_network: false,
        traces: [],
      },
      warnings: ["no_supported_neural_modules_to_execute"],
    };
  }

  const agentRun = await createAgentRun({
    task_type: "draft_generation",
    mode: "chatgpt_native_trace_only",
    created_by: "chatgpt_native_neural_writing_handoff_service",
    requires_neural_modules: true,
    required_neural_modules: modules,
    input: toPlainJson({
      task_prompt: rawInput.task_prompt,
      chapter_mode: rawInput.chapter_mode,
      modules,
      bundle_id: rawInput.bundle?.bundle_id ?? null,
    }),
  }, agentRunOptions);

  const runId = agentRun.run_id;
  const results = [];
  const warnings = [];

  for (const moduleName of modules) {
    const wrapper = WRAPPER_BY_MODULE[moduleName];
    const adapter = adapterFor(moduleName, options);
    const input = moduleInput(moduleName, rawInput);

    try {
      const execution = await wrapper(input, {
        run_id: runId,
        task_type: "draft_generation",
        source: "chatgpt_native_trace_only_handoff",
        adapter,
        ...agentRunOptions,
      });

      const trace = execution.trace ?? {};
      results.push({
        module_name: wrapperName(moduleName),
        canonical_module_name: moduleName,
        status: trace.status ?? "unknown",
        input_hash: trace.input_hash ?? null,
        output_hash: trace.output_hash ?? null,
        trace_id: trace.trace_id ?? null,
        called_at: trace.called_at ?? null,
        latency_ms: trace.latency_ms ?? 0,
        warnings: trace.warnings ?? [],
        error_message: trace.error_message ?? null,
        result_summary: summarizeOutput(execution.output),
        result_excerpt: resultExcerpt(execution.output),
      });
    } catch (error) {
      warnings.push("module_execution_failed:" + moduleName + ":" + error.message);
      results.push({
        module_name: wrapperName(moduleName),
        canonical_module_name: moduleName,
        status: "failed",
        input_hash: sha256(toPlainJson(input)),
        output_hash: null,
        trace_id: null,
        called_at: new Date().toISOString(),
        latency_ms: 0,
        warnings: [],
        error_message: error.message,
        result_summary: "Module execution failed before wrapper trace could be returned.",
        result_excerpt: error.message,
      });
    }
  }

  await finalizeAgentRun(runId, {
    output: toPlainJson({
      module_results: results.map((item) => ({
        module_name: item.module_name,
        status: item.status,
        output_hash: item.output_hash,
        trace_id: item.trace_id,
      })),
    }),
    ...agentRunOptions,
  });

  const usage = await summarizeNeuralUsageForRun(
    runId,
    agentRunOptions,
  );
  const compactTraces = (usage.traces ?? []).map((trace) => ({
    trace_id: trace.trace_id,
    module_name: wrapperName(trace.module_name),
    canonical_module_name: trace.module_name,
    status: trace.status,
    called_at: trace.called_at,
    input_hash: trace.input_hash,
    output_hash: trace.output_hash,
    latency_ms: trace.latency_ms,
    warnings: trace.warnings ?? [],
    error_message: trace.error_message ?? null,
  }));

  const allSucceeded = results.length > 0 && results.every((item) => item.status === "success");
  const traceCreated = compactTraces.length >= results.length && compactTraces.length > 0;

  return {
    status: allSucceeded ? "success" : "warning",
    run_id: runId,
    required_modules_executed: allSucceeded,
    chatgpt_native_neural_modules_executed: allSucceeded,
    module_results_attached_to_handoff:
      results.length > 0 && results.every((item) => typeof item.trace_id === "string" && item.trace_id.length > 0),
    neural_trace_created: traceCreated,
    neural_module_execution_results: results,
    neural_trace_summary: {
      run_id: runId,
      trace_count: usage.trace_count ?? compactTraces.length,
      success_count: usage.success_count ?? results.filter((item) => item.status === "success").length,
      failed_count: usage.failed_count ?? results.filter((item) => item.status === "failed").length,
      skipped_count: usage.skipped_count ?? results.filter((item) => item.status === "skipped").length,
      used_neural_network: usage.used_neural_network === true,
      required_neural_modules: modules.map(wrapperName),
      missing_required_neural_modules:
        (usage.missing_required_neural_modules ?? []).map(wrapperName),
      neural_modules_used:
        (usage.neural_modules_used ?? []).map(wrapperName),
      traces: compactTraces,
      warnings,
    },
    warnings,
  };
}

export default executeChatgptNativeTraceOnlyNeuralModules;
