import {
  verifyWorldSimulationCapabilityAdapterEnvelope,
} from "./world-simulation-capability-envelope-service.mjs";

export const sharedNeuralCoreVersion = "phase62b-shared-neural-core-v1";

export const neuralSessionModes = Object.freeze({
  WRITING: "writing",
  WORLD_SIMULATION: "world_simulation",
});

export const neuralSessionModeValues = Object.freeze([
  neuralSessionModes.WRITING,
  neuralSessionModes.WORLD_SIMULATION,
]);

const modeRunContracts = Object.freeze({
  [neuralSessionModes.WRITING]: Object.freeze({
    task_type: "draft_generation",
    run_mode: "chatgpt_owned_external_brain",
    entry: "chatgpt_bridge_begin_external_brain_writing_session",
  }),
  [neuralSessionModes.WORLD_SIMULATION]: Object.freeze({
    task_type: "world_simulation",
    run_mode: "chatgpt_owned_world_simulation",
    entry: "chatgpt_bridge_begin_world_simulation_session",
  }),
});

const capabilityFamilies = Object.freeze({
  [neuralSessionModes.WRITING]: Object.freeze({
    scene_planner: "scene_analysis",
    character_simulator: "character_cognition",
    neural_critic: "consistency_critique",
    style_drift_detector: "style_diagnostic",
    over_governance_detector: "agency_governance",
    writing_card_director: "decision_context",
    final_polisher: "editorial_polish",
  }),
  [neuralSessionModes.WORLD_SIMULATION]: Object.freeze({
    world_scene_causal_analyzer: "scene_analysis",
    world_perception_filter: "perception",
    world_memory_retriever: "memory_retrieval",
    world_character_cognition: "character_cognition",
    world_action_proposer: "action_proposal",
    world_agency_guard: "agency_governance",
    world_consistency_critic: "consistency_critique",
  }),
});

const alwaysForbiddenWorldInputKeys = new Set([
  "task_prompt",
  "writing_context",
  "writing_context_bundle_id",
  "chapter_mode",
  "draft_text",
  "raw_draft_text",
  "raw_story_text",
  "candidate_text",
  "final_prose",
  "prose_target",
]);

const decisionForbiddenWorldInputKeys = new Set([
  "plot_goal",
  "plot_goals",
  "plot_objective",
  "plot_objectives",
  "story_goal",
  "story_goals",
  "story_direction",
  "narrative_goal",
  "narrative_goals",
  "narrative_objective",
  "narrative_objectives",
  "dramatic_priority",
  "camera_priority",
  "desired_romance_progress",
  "desired_plot_progress",
  "desired_scene_outcome",
  "foreshadowing_target",
  "payoff_target",
]);

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizedCapabilityName(value) {
  const name = String(value ?? "").trim();
  return name.startsWith("run_") ? name.slice(4) : name;
}

export function assertNeuralSessionMode(value, label = "session_mode") {
  const mode = String(value ?? "").trim();
  if (!neuralSessionModeValues.includes(mode)) {
    throw errorWithCode(
      `${label} must be one of: ${neuralSessionModeValues.join(", ")}.`,
      "NEURAL_SESSION_MODE_INVALID",
    );
  }
  return mode;
}

export function inferNeuralSessionModeFromRun(run = {}) {
  if (run.session_mode !== undefined && run.session_mode !== null) {
    return assertNeuralSessionMode(run.session_mode, "run.session_mode");
  }
  if (
    run.task_type === modeRunContracts[neuralSessionModes.WRITING].task_type
    && run.mode === modeRunContracts[neuralSessionModes.WRITING].run_mode
  ) {
    return neuralSessionModes.WRITING;
  }
  if (
    run.task_type === modeRunContracts[neuralSessionModes.WORLD_SIMULATION].task_type
    && run.mode === modeRunContracts[neuralSessionModes.WORLD_SIMULATION].run_mode
  ) {
    return neuralSessionModes.WORLD_SIMULATION;
  }
  return null;
}

export function assertNeuralSessionRunShape(run = {}, expectedMode) {
  const expected = assertNeuralSessionMode(expectedMode, "expected session mode");
  const actual = inferNeuralSessionModeFromRun(run);
  if (actual !== expected) {
    throw errorWithCode(
      `Neural session mode mismatch: expected ${expected}, received ${actual ?? "unscoped"}.`,
      "NEURAL_SESSION_MODE_MISMATCH",
    );
  }
  const contract = modeRunContracts[expected];
  if (run.task_type !== contract.task_type || run.mode !== contract.run_mode) {
    throw errorWithCode(
      `Neural session lineage is invalid for ${expected}: task_type and run mode must remain bound to the entry mode.`,
      "NEURAL_SESSION_LINEAGE_MISMATCH",
    );
  }
  return {
    session_mode: expected,
    task_type: contract.task_type,
    run_mode: contract.run_mode,
    entry: contract.entry,
    explicit_mode_recorded: run.session_mode === expected,
  };
}

export function assertNeuralSessionCreationShape({ session_mode, task_type, mode } = {}) {
  if (session_mode === undefined || session_mode === null) return null;
  const normalized = assertNeuralSessionMode(session_mode);
  const contract = modeRunContracts[normalized];
  if (task_type !== contract.task_type || mode !== contract.run_mode) {
    throw errorWithCode(
      `session_mode=${normalized} requires task_type=${contract.task_type} and mode=${contract.run_mode}.`,
      "NEURAL_SESSION_CREATION_MODE_MISMATCH",
    );
  }
  return normalized;
}

export function sharedNeuralCapabilityFamily(sessionMode, capabilityName) {
  const mode = assertNeuralSessionMode(sessionMode);
  const normalized = normalizedCapabilityName(capabilityName);
  return capabilityFamilies[mode][normalized] ?? null;
}

export function assertSharedNeuralCapabilityForMode(sessionMode, capabilityName) {
  const mode = assertNeuralSessionMode(sessionMode);
  const normalized = normalizedCapabilityName(capabilityName);
  const family = sharedNeuralCapabilityFamily(mode, normalized);
  if (!family) {
    throw errorWithCode(
      `Capability ${normalized || "<missing>"} is not available in neural session mode ${mode}.`,
      "NEURAL_CAPABILITY_MODE_MISMATCH",
    );
  }
  return {
    capability_name: normalized,
    capability_family: family,
  };
}

function collectForbiddenKeys(value, forbidden, path = [], matches = [], seen = new Set()) {
  if (!value || typeof value !== "object") return matches;
  if (seen.has(value)) return matches;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(
      item,
      forbidden,
      [...path, String(index)],
      matches,
      seen,
    ));
    return matches;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = String(key).trim().toLocaleLowerCase("en-US");
    if (forbidden.has(normalized)) {
      matches.push([...path, key].join("."));
    }
    collectForbiddenKeys(item, forbidden, [...path, key], matches, seen);
  }
  return matches;
}

export function assertWorldSimulationInputBoundary(capabilityName, input = {}) {
  const normalized = normalizedCapabilityName(capabilityName);
  const forbidden = new Set(alwaysForbiddenWorldInputKeys);
  if (normalized !== "world_agency_guard") {
    for (const key of decisionForbiddenWorldInputKeys) forbidden.add(key);
  }
  const matches = collectForbiddenKeys(input, forbidden);
  if (matches.length) {
    throw errorWithCode(
      `World simulation neural input contains writing/narrative control fields: ${matches.slice(0, 8).join(", ")}.`,
      "WORLD_SIMULATION_NARRATIVE_CONTROL_FORBIDDEN",
    );
  }
  return {
    diagnostic_narrative_signal_inspection:
      normalized === "world_agency_guard",
    forbidden_field_count: 0,
  };
}

export function assertWorldSimulationOutputBoundary(capabilityName, output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw errorWithCode(
      "World simulation shared neural core output must be an object.",
      "WORLD_SIMULATION_OUTPUT_INVALID",
    );
  }
  const normalized = normalizedCapabilityName(capabilityName);
  const forbiddenTopLevel = new Set([
    "world_state_update",
    "character_state_update",
    "state_mutation",
    "mutated_world_state",
  ]);
  if (normalized === "world_action_proposer") {
    for (const key of [
      "selected_action",
      "selected_action_id",
      "chosen_action",
      "final_action",
      "action_result",
      "outcome",
      "result",
    ]) {
      forbiddenTopLevel.add(key);
    }
  }
  const found = collectForbiddenKeys(output, forbiddenTopLevel);
  if (found.length) {
    throw errorWithCode(
      `World simulation neural output crossed the causal boundary: ${found.slice(0, 8).join(", ")}.`,
      "WORLD_SIMULATION_OUTCOME_AUTHORITY_FORBIDDEN",
    );
  }
  return true;
}

export function buildSharedNeuralCoreDescriptor(sessionMode, capabilityName, run = {}) {
  const mode = assertNeuralSessionMode(sessionMode);
  const capability = assertSharedNeuralCapabilityForMode(mode, capabilityName);
  const lineage = assertNeuralSessionRunShape(run, mode);
  return {
    core_version: sharedNeuralCoreVersion,
    session_mode: mode,
    capability_name: capability.capability_name,
    capability_family: capability.capability_family,
    entry: lineage.entry,
    mode_locked: true,
    cross_mode_capability_use_allowed: false,
  };
}

export async function invokeSharedNeuralCoreAdapter({
  run,
  session_mode,
  capability_name,
  input,
  adapter,
  adapter_context = {},
  world_capability_canonical_envelope = null,
} = {}) {
  if (typeof adapter !== "function") {
    throw new TypeError("shared neural core adapter must be a function.");
  }
  const descriptor = buildSharedNeuralCoreDescriptor(
    session_mode,
    capability_name,
    run,
  );
  if (descriptor.session_mode === neuralSessionModes.WORLD_SIMULATION) {
    assertWorldSimulationInputBoundary(descriptor.capability_name, input);
    if (!world_capability_canonical_envelope) {
      throw errorWithCode(
        "World-simulation neural invocation requires the compiler-minted canonical Phase62A-R1 envelope.",
        "WORLD_SIMULATION_CAPABILITY_ENVELOPE_REQUIRED",
      );
    }
    const canonical = verifyWorldSimulationCapabilityAdapterEnvelope(
      world_capability_canonical_envelope,
      {
        capability_name: descriptor.capability_name,
        require_compiler_attestation: true,
      },
    );
    if (input === world_capability_canonical_envelope) {
      throw errorWithCode(
        "World-simulation neural adapters must receive a detached envelope copy, never the engine-owned canonical object.",
        "WORLD_SIMULATION_CAPABILITY_ADAPTER_COPY_REQUIRED",
      );
    }
    const detached = verifyWorldSimulationCapabilityAdapterEnvelope(
      input,
      {
        capability_name: descriptor.capability_name,
        require_compiler_attestation: false,
      },
    );
    if (detached.envelope_id !== canonical.envelope_id
      || detached.envelope_hash !== canonical.envelope_hash
    ) {
      throw errorWithCode(
        "Detached world capability envelope does not match the compiler-minted canonical envelope.",
        "WORLD_SIMULATION_CAPABILITY_ENVELOPE_BINDING_INVALID",
      );
    }
  }
  const output = await adapter(input, {
    ...adapter_context,
    shared_neural_core_version: sharedNeuralCoreVersion,
    neural_session_mode: descriptor.session_mode,
    shared_capability_family: descriptor.capability_family,
  });
  if (descriptor.session_mode === neuralSessionModes.WORLD_SIMULATION) {
    assertWorldSimulationOutputBoundary(descriptor.capability_name, output);
  }
  return { output, descriptor };
}

export function buildSharedNeuralCoreRegistry() {
  return {
    core_version: sharedNeuralCoreVersion,
    modes: Object.fromEntries(neuralSessionModeValues.map((mode) => [
      mode,
      {
        ...modeRunContracts[mode],
        capabilities: { ...capabilityFamilies[mode] },
      },
    ])),
    shared_families: [
      "scene_analysis",
      "character_cognition",
      "agency_governance",
      "consistency_critique",
    ],
    mode_lock: {
      immutable_through_session_lineage: true,
      cross_mode_capability_use_allowed: false,
    },
  };
}
