import { performance } from "node:perf_hooks";
import { getAgentRun } from "./agent-run-service.mjs";
import {
  hashNeuralValue,
  recordNeuralWrapperTrace,
} from "./neural-trace-service.mjs";
import {
  persistExternalBrainCognitionOutput,
  priorAuthorshipCognitionModules,
  serializeCognitionCapabilityOutput,
} from "./external-brain-cognition-output-service.mjs";

const moduleSpecs = {
  scene_planner: {
    model_name: "local-scene-planner",
    model_version: "v1.0.0",
    result_type: "scene_plan",
  },
  character_simulator: {
    model_name: "local-character-simulator",
    model_version: "v1.0.0",
    result_type: "character_simulation",
  },
  neural_critic: {
    model_name: "local-neural-critic",
    model_version: "v1.0.0",
    result_type: "neural_critique",
  },
  style_drift_detector: {
    model_name: "local-style-drift-detector",
    model_version: "v1.0.0",
    result_type: "style_drift_report",
  },
  over_governance_detector: {
    model_name: "local-over-governance-detector",
    model_version: "v1.0.0",
    result_type: "over_governance_report",
  },
  writing_card_director: {
    model_name: "local-writing-card-director",
    model_version: "v1.0.0",
    result_type: "writing_card_director_context",
  },
  final_polisher: {
    model_name: "local-final-polisher",
    model_version: "v1.0.0",
    result_type: "final_polisher_report",
  },
};

function inputText(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

function outputText(value) {
  return serializeCognitionCapabilityOutput(value ?? null);
}

async function runModule(moduleName, input, options = {}) {
  const spec = moduleSpecs[moduleName];
  if (!spec) throw new Error(`Unknown neural module: ${moduleName}`);
  const runId = options.run_id;
  const run = await getAgentRun(runId);
  const taskType = options.task_type ?? run.task_type;
  if (taskType !== run.task_type) throw new Error("task_type must match the agent run.");
  const source = options.source ?? "local_ui";
  const calledAt = new Date().toISOString();
  const startedAt = performance.now();
  const inputValue = inputText(input);
  const inputHash = hashNeuralValue(inputValue);
  const modelName = options.model_name ?? spec.model_name;
  const modelVersion = options.model_version ?? spec.model_version;
  let status = "skipped";
  let output = null;
  let outputHash = null;
  let errorMessage = null;
  let warnings = [];

  if (typeof options.adapter !== "function") {
    warnings = ["Local neural model adapter is not configured."];
  } else {
    try {
      output = await options.adapter(input, {
        run_id: runId,
        task_type: taskType,
        module_name: moduleName,
        model_name: modelName,
        model_version: modelVersion,
      });
      const serializedOutput = outputText(output);
      outputHash = hashNeuralValue(serializedOutput);
      status = "success";
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const trace = await recordNeuralWrapperTrace({
    run_id: runId,
    task_type: taskType,
    module_name: moduleName,
    model_name: modelName,
    model_version: modelVersion,
    called_at: calledAt,
    input_hash: inputHash,
    output_hash: outputHash,
    status,
    latency_ms: latencyMs,
    warnings,
    error_message: errorMessage,
    input_summary: {
      chars: inputValue.length,
      source,
    },
    output_summary: {
      chars: output === null ? 0 : outputText(output).length,
      result_type: spec.result_type,
    },
  });
  if (
    status === "success"
    && options.external_brain_cognition_output === true
    && priorAuthorshipCognitionModules.includes(moduleName)
  ) {
    await persistExternalBrainCognitionOutput({
      run_id: runId,
      writing_context_bundle_id: options.writing_context_bundle_id,
      capability_name: `run_${moduleName}`,
      module_name: moduleName,
      result_type: spec.result_type,
      trace,
      capability_output: output,
    });
  }
  return { output, trace };
}

export function run_scene_planner(input, options) {
  return runModule("scene_planner", input, options);
}

export function run_character_simulator(input, options) {
  return runModule("character_simulator", input, options);
}

export function run_neural_critic(input, options) {
  return runModule("neural_critic", input, options);
}

export function run_style_drift_detector(input, options) {
  return runModule("style_drift_detector", input, options);
}

export function run_over_governance_detector(input, options) {
  return runModule("over_governance_detector", input, options);
}

export function run_writing_card_director(input, options) {
  return runModule("writing_card_director", input, options);
}

export function run_final_polisher(input, options) {
  return runModule("final_polisher", input, options);
}
