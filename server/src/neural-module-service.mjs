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
import {
  buildExternalBrainGenerationSurface,
} from "./external-brain-generation-surface-service.mjs";
import {
  buildPostDraftNeuralCritique,
  buildPostDraftStyleDriftReport,
} from "./post-draft-line-diagnostic-service.mjs";

const moduleSpecs = {
  scene_planner: {
    model_name: "local-scene-planner",
    model_version: "v1.0.0",
    result_type: "scene_plan",
  },
  character_simulator: {
    model_name: "local-character-simulator",
    model_version: "v1.1.0-phase50b-single-turn",
    result_type: "character_simulation",
  },
  neural_critic: {
    model_name: "local-neural-critic",
    model_version: "v1.1.0-phase50c-exact-line",
    result_type: "neural_critique",
  },
  style_drift_detector: {
    model_name: "local-style-drift-detector",
    model_version: "v1.1.0-phase50c-exact-line",
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
    model_version: "v1.1.0-phase50d-minimal-intervention",
    result_type: "final_polisher_report",
  },
};

function inputText(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

export const commonNeuralModulePermissions = Object.freeze({
  generate_final_prose: false,
  decide_story_direction: false,
  choose_cast: false,
  create_or_reject_story_direction: false,
  remove_original_entities: false,
  replace_original_entities: false,
  force_reuse_of_existing_canon_entities: false,
  require_prior_canon_registration: false,
  persist_original_entities_without_explicit_request: false,
  convert_original_candidate_to_canon: false,
  assign_theme: false,
  assign_symbolism: false,
  modify_canon: false,
  modify_active_engine: false,
  create_candidate: false,
  adopt_or_settle: false,
});

const commonPermissionReference = Object.freeze({
  inherits: "common_neural_module_permissions",
});

export const neuralModuleContracts = Object.freeze({
  scene_planner: Object.freeze({
    module: "scene_planner",
    purpose: "Report current event, scene pressure, consequences, unresolved items, and available scene material.",
    activation: Object.freeze({ phase: "pre_generation" }),
    required_inputs: Object.freeze(["writing_context"]),
    optional_inputs: Object.freeze(["capability_input"]),
    returns: Object.freeze([
      "current_event",
      "scene_pressure",
      "practical_consequences",
      "unresolved_items",
      "available_scene_material",
    ]),
    permissions: commonPermissionReference,
  }),
  character_simulator: Object.freeze({
    module: "character_simulator",
    purpose: "Report character knowledge, wants, boundaries, pressure, plausible next reactions, and uncertainty.",
    activation: Object.freeze({ phase: "pre_generation" }),
    required_inputs: Object.freeze(["writing_context", "character"]),
    optional_inputs: Object.freeze(["capability_input"]),
    returns: Object.freeze([
      "known_information",
      "wants",
      "boundaries",
      "current_pressure",
      "plausible_next_reactions",
      "uncertainty",
    ]),
    permissions: commonPermissionReference,
  }),
  over_governance_detector: Object.freeze({
    module: "over_governance_detector",
    purpose: "Report whether governance rules are deciding story events.",
    activation: Object.freeze({ phase: "pre_generation" }),
    required_inputs: Object.freeze(["writing_context"]),
    optional_inputs: Object.freeze(["capability_input"]),
    returns: Object.freeze(["governance_interference_risks"]),
    permissions: commonPermissionReference,
  }),
  writing_card_director: Object.freeze({
    module: "writing_card_director",
    purpose: "Integrate and prioritize hard facts, events, character state, and module results.",
    activation: Object.freeze({
      phase: "pre_generation",
      requires_prior_module_results: true,
    }),
    required_inputs: Object.freeze([
      "writing_context",
      "prior_module_results",
    ]),
    optional_inputs: Object.freeze(["capability_input"]),
    returns: Object.freeze(["prioritized_material", "hard_constraints", "uncertainties"]),
    permissions: commonPermissionReference,
  }),
  neural_critic: Object.freeze({
    module: "neural_critic",
    purpose: "Report exact-line evidence for hard Canon, timeline, knowledge, ability, location, injury, or causality conflicts.",
    activation: Object.freeze({
      requires: "draft_text",
      without_draft: "inactive",
    }),
    required_inputs: Object.freeze(["draft_text"]),
    optional_inputs: Object.freeze([
      "relevant_canon",
      "draft_entity_audit",
      "scene_compatibility",
      "structured_hard_conflict_candidates",
    ]),
    returns: Object.freeze(["exact_line_evidence", "hard_conflicts"]),
    permissions: commonPermissionReference,
  }),
  style_drift_detector: Object.freeze({
    module: "style_drift_detector",
    purpose: "Report clear style drift as advisory exact-line evidence.",
    activation: Object.freeze({
      requires: "draft_text",
      without_draft: "inactive",
    }),
    required_inputs: Object.freeze(["draft_text"]),
    optional_inputs: Object.freeze(["writing_context", "capability_input"]),
    returns: Object.freeze(["advisory_exact_line_evidence"]),
    permissions: commonPermissionReference,
  }),
  final_polisher: Object.freeze({
    module: "final_polisher",
    purpose: "Preserve draft identity unless an explicitly allowed hard-error correction is supplied.",
    activation: Object.freeze({
      requires: "draft_text",
      without_draft: "skipped",
    }),
    required_inputs: Object.freeze(["draft_text"]),
    optional_inputs: Object.freeze(["explicit_allowed_hard_errors"]),
    returns: Object.freeze([
      "status",
      "text_identity_preserved",
      "input_hash_sha256",
      "output_hash_sha256",
    ]),
    permissions: commonPermissionReference,
  }),
});



function outputText(value) {
  return serializeCognitionCapabilityOutput(value ?? null);
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function diagnosticCapabilityInput(input = {}) {
  const nested = objectValue(input?.capability_input);
  if (
    typeof nested.draft_text === "string"
    || typeof nested.raw_draft_text === "string"
  ) {
    return nested;
  }
  return objectValue(input);
}

function preAdapterPhaseBoundaryOutput(moduleName, input = {}) {
  if (moduleName === "neural_critic") {
    const capabilityInput = diagnosticCapabilityInput(input);
    const hasDraft = Boolean(
      String(
        capabilityInput.draft_text
          ?? capabilityInput.raw_draft_text
          ?? "",
      ).trim(),
    );
    if (!hasDraft) {
      return {
        status: "inactive",
        ...buildPostDraftNeuralCritique({
          taskPrompt: input.task_prompt ?? "",
          capabilityInput,
        }),
      };
    }
  }
  if (moduleName === "style_drift_detector") {
    const capabilityInput = diagnosticCapabilityInput(input);
    const hasDraft = Boolean(
      String(
        capabilityInput.draft_text
          ?? capabilityInput.raw_draft_text
          ?? "",
      ).trim(),
    );
    if (!hasDraft) {
      return {
        status: "inactive",
        ...buildPostDraftStyleDriftReport({
          taskPrompt: input.task_prompt ?? "",
          capabilityInput,
        }),
      };
    }
  }
  if (moduleName === "final_polisher") {
    const sourceText = String(
      input.raw_story_text
        ?? input.rawStoryText
        ?? input.candidate_text
        ?? input.candidateText
        ?? "",
    ).trim();
    if (!sourceText) {
      return {
        result_type: "final_polisher_report",
        analysis_phase: "pre_generation_compatibility",
        status: "skipped",
        reason: "final_polisher_requires_existing_draft_text",
        findings: [],
        must_fix: [],
        replacement_prose: null,
        minimal_intervention: true,
      };
    }
  }
  return null;
}

export function buildStoryMaterialCognitionContract(moduleName, input = {}) {
  void input;
  const contract = neuralModuleContracts[moduleName];
  if (!contract) return null;
  return JSON.parse(JSON.stringify(contract));
}

export function buildNeuralModuleContractRegistry() {
  return {
    common_neural_module_permissions: { ...commonNeuralModulePermissions },
    modules: Object.fromEntries(
      Object.keys(neuralModuleContracts).map((moduleName) => [
        moduleName,
        buildStoryMaterialCognitionContract(moduleName),
      ]),
    ),
  };
}

function attachModuleContract(moduleName, input, output, options) {
  if (
    options.story_material_cognition_output !== true
    || !output
    || typeof output !== "object"
    || Array.isArray(output)
  ) {
    return output;
  }
  return {
    ...output,
    module_contract:
      buildStoryMaterialCognitionContract(moduleName, input),
  };
}

async function runModule(moduleName, input, options = {}) {
  const spec = moduleSpecs[moduleName];
  if (!spec) throw new Error(`Unknown neural module: ${moduleName}`);
  const runId = options.run_id;
  const agentRunOptions = options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {};
  const run = await getAgentRun(runId, agentRunOptions);
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
  let persistedOutput = null;
  let outputHash = null;
  let generationSurfaceHash = null;
  let generationSurfaceCompacted = false;
  let errorMessage = null;
  let warnings = [];

  const phaseBoundaryOutput =
    preAdapterPhaseBoundaryOutput(moduleName, input);
  if (phaseBoundaryOutput) {
    persistedOutput = phaseBoundaryOutput;
    outputHash = hashNeuralValue(outputText(persistedOutput));
    if (options.generation_surface_output === true) {
      output = buildExternalBrainGenerationSurface(
        moduleName,
        persistedOutput,
      );
      generationSurfaceCompacted =
        outputText(output) !== outputText(persistedOutput);
    } else {
      output = persistedOutput;
    }
    generationSurfaceHash = hashNeuralValue(outputText(output));
    status = "success";
  } else if (typeof options.adapter !== "function") {
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
      persistedOutput = attachModuleContract(
        moduleName,
        input,
        output,
        options,
      );
      const serializedPersistedOutput = outputText(persistedOutput);
      outputHash = hashNeuralValue(serializedPersistedOutput);
      if (options.generation_surface_output === true) {
        output = buildExternalBrainGenerationSurface(
          moduleName,
          persistedOutput,
        );
        generationSurfaceCompacted =
          serializeCognitionCapabilityOutput(output)
          !== serializedPersistedOutput;
      } else {
        output = persistedOutput;
      }
      generationSurfaceHash = hashNeuralValue(outputText(output));
      status = "success";
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const trace = await recordNeuralWrapperTrace({
    run_id: runId,
    ...(options.writing_context_bundle_id ? {
      writing_context_bundle_id: options.writing_context_bundle_id,
    } : {}),
    ...(input && typeof input === "object" && input.raw_story_handoff_id ? {
      raw_story_handoff_id: input.raw_story_handoff_id,
    } : {}),
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
      chars: persistedOutput === null ? 0 : outputText(persistedOutput).length,
      generation_surface_chars: output === null ? 0 : outputText(output).length,
      generation_surface_hash: generationSurfaceHash,
      generation_surface_compacted: generationSurfaceCompacted,
      result_type: spec.result_type,
    },
  }, agentRunOptions);
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
      capability_output: persistedOutput,
    }, agentRunOptions);
  }
  return {
    output,
    trace,
    control_plane: {
      persisted_output_hash: outputHash,
      generation_surface_hash: generationSurfaceHash,
      generation_surface_compacted: generationSurfaceCompacted,
    },
  };
}

export function run_scene_planner(input, options) {
  return runModule("scene_planner", input, options);
}

export function run_character_simulator(input, options) {
  return runModule("character_simulator", input, options);
}

export function runEphemeralNeuralCritic(input = {}) {
  const capabilityInput = diagnosticCapabilityInput(input);
  const draft = String(
    capabilityInput.draft_text
      ?? capabilityInput.raw_draft_text
      ?? "",
  ).trim();
  if (!draft) {
    throw new Error(
      "draft_text is required for ephemeral neural_critic execution.",
    );
  }
  return {
    module_name: "neural_critic",
    model_name: moduleSpecs.neural_critic.model_name,
    model_version: moduleSpecs.neural_critic.model_version,
    status: "completed",
    execution_mode: "ephemeral_read_only",
    session_required: false,
    trace_persisted: false,
    output: buildPostDraftNeuralCritique({
      taskPrompt: input.task_prompt ?? "",
      capabilityInput,
    }),
  };
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
