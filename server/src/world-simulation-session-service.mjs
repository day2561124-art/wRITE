import {
  createAgentRun,
  getAgentRun,
} from "./agent-run-service.mjs";
import {
  runWorldSimulationCapability,
  worldSimulationCapabilityNames,
  worldSimulationCommonPermissions,
} from "./world-simulation-neural-service.mjs";
import {
  assertNeuralSessionRunShape,
  buildSharedNeuralCoreRegistry,
  neuralSessionModes,
  sharedNeuralCoreVersion,
} from "./shared-neural-core-service.mjs";

export const worldSimulationSessionVersion = "phase62b-world-simulation-session-v2";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function compactBootstrapInput(input = {}) {
  return {
    simulation_label: input.simulation_label ?? null,
    seed: input.seed ?? null,
    rules: object(input.rules),
    initial_world_state_summary: object(input.initial_world_state_summary),
    metadata: object(input.metadata),
  };
}

export async function beginWorldSimulationSession(input = {}, options = {}) {
  const agentRunOptions = options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
  const run = await createAgentRun({
    task_type: "world_simulation",
    mode: "chatgpt_owned_world_simulation",
    session_mode: neuralSessionModes.WORLD_SIMULATION,
    created_by: "chatgpt_world_simulation_bridge",
    requires_neural_modules: false,
    required_neural_modules: [],
    input: compactBootstrapInput(input),
  }, agentRunOptions);
  return {
    ok: true,
    architecture_route: "chatgpt_owned_world_simulation",
    session_version: worldSimulationSessionVersion,
    session_mode: neuralSessionModes.WORLD_SIMULATION,
    shared_neural_core: {
      core_version: sharedNeuralCoreVersion,
      mode_locked: true,
      character_cognition_family:
        buildSharedNeuralCoreRegistry().modes.world_simulation
          .capabilities.world_character_cognition,
    },
    world_simulation_session_id: run.run_id,
    orchestration_owner: "ChatGPT",
    world_state_owner: "programmatic_world_simulator",
    capability_provider: "writer_workbench",
    capability_names: [...worldSimulationCapabilityNames],
    mutation_guards: { ...worldSimulationCommonPermissions },
  };
}

export async function assertWorldSimulationSession(sessionId, options = {}) {
  const agentRunOptions = options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
  const run = await getAgentRun(sessionId, agentRunOptions);
  assertNeuralSessionRunShape(
    run,
    neuralSessionModes.WORLD_SIMULATION,
  );
  return run;
}

export async function useWorldSimulationCapability(
  capabilityName,
  input = {},
  options = {},
) {
  const sessionId = input.world_simulation_session_id;
  await assertWorldSimulationSession(sessionId, options);
  const capabilityInput = object(input.capability_input);
  const execution = await runWorldSimulationCapability(
    capabilityName,
    capabilityInput,
    {
      ...options,
      run_id: sessionId,
      source: options.source ?? "chatgpt_world_simulation_bridge",
    },
  );
  return {
    ok: true,
    architecture_route: "chatgpt_owned_world_simulation",
    world_simulation_session_id: sessionId,
    capability_name: capabilityName,
    session_mode: neuralSessionModes.WORLD_SIMULATION,
    shared_neural_core: execution.shared_neural_core,
    output: execution.output,
    trace: execution.trace,
    mutation_guards: execution.mutation_guards,
  };
}
