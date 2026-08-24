import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  createAgentRun,
  getAgentRun,
  updateAgentRunStatus,
} from "../../server/src/agent-run-service.mjs";
import {
  createChatgptOwnedWritingSessionRun,
  useChatgptOwnedExternalBrainCapability,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  buildNeuralModuleContractRegistry,
  run_character_simulator,
} from "../../server/src/neural-module-service.mjs";
import {
  getNeuralTrace,
} from "../../server/src/neural-trace-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  buildSharedNeuralCoreRegistry,
  neuralSessionModes,
  sharedNeuralCoreVersion,
} from "../../server/src/shared-neural-core-service.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62b-shared-neural-core-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const writingBundleId = "gptctx_20260824-000000-62b0a001";
const otherWritingBundleId = "gptctx_20260824-000001-62b0a002";

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const coreRegistry = buildSharedNeuralCoreRegistry();
  assert.equal(coreRegistry.core_version, sharedNeuralCoreVersion);
  assert.deepEqual(
    Object.keys(coreRegistry.modes),
    [neuralSessionModes.WRITING, neuralSessionModes.WORLD_SIMULATION],
  );
  assert.equal(
    coreRegistry.modes.writing.capabilities.character_simulator,
    "character_cognition",
  );
  assert.equal(
    coreRegistry.modes.world_simulation.capabilities.world_character_cognition,
    "character_cognition",
  );
  assert.equal(coreRegistry.mode_lock.immutable_through_session_lineage, true);
  assert.equal(coreRegistry.mode_lock.cross_mode_capability_use_allowed, false);

  const writingContracts = buildNeuralModuleContractRegistry();
  assert.equal(
    Object.keys(writingContracts.modules).length,
    7,
    "Phase62B must not change the legacy seven-module writing registry.",
  );

  const writingRun = await createChatgptOwnedWritingSessionRun({
    writing_context_bundle_id: writingBundleId,
    task_prompt: "Phase62B source-only writing-session fixture.",
  }, options);
  assert.equal(writingRun.session_mode, neuralSessionModes.WRITING);
  assert.equal(writingRun.task_type, "draft_generation");
  assert.equal(writingRun.mode, "chatgpt_owned_external_brain");
  assert.equal(writingRun.writing_context_bundle_id, writingBundleId);

  let writingAdapterContext = null;
  const writingCharacter = await run_character_simulator(
    {
      character: "伊萊亞斯・諾爾",
      current_dialogue: "現在幾點？",
    },
    {
      ...options,
      run_id: writingRun.run_id,
      task_type: "draft_generation",
      session_mode: neuralSessionModes.WRITING,
      writing_context_bundle_id: writingBundleId,
      adapter: async (_input, context) => {
        writingAdapterContext = context;
        return {
          result_type: "character_simulation",
          character: "伊萊亞斯・諾爾",
          turn_scope: "single_next_turn_only",
          known_information: ["現在人在第三實習室"],
          guessed_information: [],
          speakable_intent: "確認時間",
        };
      },
    },
  );
  assert.equal(writingCharacter.trace.status, "success");
  assert.equal(
    writingCharacter.control_plane.shared_neural_core.capability_family,
    "character_cognition",
  );
  assert.equal(
    writingCharacter.control_plane.shared_neural_core.core_version,
    sharedNeuralCoreVersion,
  );
  assert.equal(
    writingAdapterContext.neural_session_mode,
    neuralSessionModes.WRITING,
  );
  assert.equal(
    writingAdapterContext.shared_capability_family,
    "character_cognition",
  );

  const writingTrace = await getNeuralTrace(
    writingCharacter.trace.trace_id,
    options,
  );
  assert.equal(
    writingTrace.input_summary.shared_neural_core_version,
    sharedNeuralCoreVersion,
  );
  assert.equal(
    writingTrace.input_summary.shared_capability_family,
    "character_cognition",
  );

  const worldSession = await beginWorldSimulationSession({
    simulation_label: "Phase62B dual-mode fixture",
    seed: "phase62b",
    rules: { world_first: true },
  }, options);
  assert.equal(worldSession.ok, true);
  assert.equal(
    worldSession.session_mode,
    neuralSessionModes.WORLD_SIMULATION,
  );
  assert.equal(
    worldSession.shared_neural_core.character_cognition_family,
    "character_cognition",
  );

  const worldRun = await getAgentRun(
    worldSession.world_simulation_session_id,
    options,
  );
  assert.equal(worldRun.session_mode, neuralSessionModes.WORLD_SIMULATION);
  assert.equal(worldRun.task_type, "world_simulation");
  assert.equal(worldRun.mode, "chatgpt_owned_world_simulation");

  let worldAdapterContext = null;
  let worldAdapterEnvelope = null;
  const worldCharacter = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id: worldSession.world_simulation_session_id,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        character_state: {
          known: ["現在人在第三實習室"],
          guessed: ["下一項測試可能延後"],
          current_goal: "完成當前測試",
        },
        perception: {
          observed: ["牆上的時鐘"],
        },
      },
    },
    {
      ...options,
      adapter: async (envelope, context) => {
        worldAdapterContext = context;
        worldAdapterEnvelope = envelope;
        return {
          subjective_inferences: ["下一項測試可能延後"],
          deliberative_pressures: ["時間"],
        };
      },
    },
  );
  assert.equal(worldCharacter.ok, true);
  assert.equal(
    worldCharacter.session_mode,
    neuralSessionModes.WORLD_SIMULATION,
  );
  assert.equal(
    worldCharacter.shared_neural_core.capability_family,
    "character_cognition",
  );
  assert.equal(
    worldCharacter.shared_neural_core.core_version,
    writingCharacter.control_plane.shared_neural_core.core_version,
  );
  assert.equal(
    worldAdapterContext.neural_session_mode,
    neuralSessionModes.WORLD_SIMULATION,
  );
  assert.equal(
    worldAdapterContext.shared_capability_family,
    "character_cognition",
  );
  assert.equal(
    worldAdapterContext.adapter_contract,
    "neural_extension_only",
  );
  assert.equal(
    worldAdapterEnvelope.capability_name,
    "world_character_cognition",
  );
  assert.equal(
    Object.hasOwn(
      worldAdapterEnvelope.authorized_inputs.protected_base,
      "character_state",
    ),
    false,
  );
  assert.deepEqual(
    worldCharacter.output.known,
    ["現在人在第三實習室"],
  );
  assert.deepEqual(
    worldCharacter.output.neural_extension.subjective_inferences,
    ["下一項測試可能延後"],
  );

  const worldTrace = await getNeuralTrace(
    worldCharacter.trace.trace_id,
    options,
  );
  assert.equal(
    worldTrace.input_summary.shared_neural_core_version,
    sharedNeuralCoreVersion,
  );
  assert.equal(
    worldTrace.input_summary.shared_capability_family,
    "character_cognition",
  );

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_character_cognition",
      {
        world_simulation_session_id: writingRun.run_id,
        capability_input: {
          character: "伊萊亞斯・諾爾",
          character_state: {},
        },
      },
      options,
    ),
    (error) => (
      error?.code === "NEURAL_SESSION_MODE_MISMATCH"
      || /Neural session mode mismatch/u.test(error?.message ?? "")
    ),
    "A writing session must not enter a world capability.",
  );

  await assert.rejects(
    () => useChatgptOwnedExternalBrainCapability(
      "run_character_simulator",
      {
        external_brain_session_id: worldRun.run_id,
        writing_context_bundle_id: writingBundleId,
        capability_input: {},
      },
      options,
    ),
    (error) => (
      error?.code === "NEURAL_SESSION_MODE_MISMATCH"
      || /Neural session mode mismatch/u.test(error?.message ?? "")
    ),
    "A world session must not enter a writing capability.",
  );

  await assert.rejects(
    () => useChatgptOwnedExternalBrainCapability(
      "run_character_simulator",
      {
        external_brain_session_id: writingRun.run_id,
        writing_context_bundle_id: otherWritingBundleId,
        capability_input: {},
      },
      options,
    ),
    /does not belong to the supplied writing session/u,
    "A writing capability must not mix context lineage across sessions.",
  );

  await assert.rejects(
    () => updateAgentRunStatus(
      writingRun.run_id,
      "running",
      { session_mode: neuralSessionModes.WORLD_SIMULATION },
      options,
    ),
    /session_mode is immutable/u,
  );
  assert.equal(
    (await getAgentRun(writingRun.run_id, options)).session_mode,
    neuralSessionModes.WRITING,
  );

  await assert.rejects(
    () => createAgentRun({
      task_type: "draft_generation",
      mode: "chatgpt_owned_world_simulation",
      session_mode: neuralSessionModes.WRITING,
      input: "invalid dual-mode lineage fixture",
    }, options),
    /requires task_type=draft_generation and mode=chatgpt_owned_external_brain/u,
    "A neural session mode must be bound to its entry task and run mode at creation.",
  );

  await assert.rejects(
    () => run_character_simulator(
      { character: "伊萊亞斯・諾爾" },
      {
        ...options,
        run_id: worldRun.run_id,
        task_type: "world_simulation",
        adapter: async () => ({
          result_type: "character_simulation",
          character: "伊萊亞斯・諾爾",
        }),
      },
    ),
    (error) => (
      error?.code === "NEURAL_CAPABILITY_MODE_MISMATCH"
      || /not available in neural session mode world_simulation/u.test(error?.message ?? "")
    ),
    "Direct low-level writing-module use must still infer the world session lock and reject cross-mode capability use.",
  );

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_character_cognition",
      {
        world_simulation_session_id: worldRun.run_id,
        capability_input: {
          character: "伊萊亞斯・諾爾",
          character_state: { current_goal: "完成測試" },
          decision_context: {
            narrative_goal: "強迫角色在這一幕發展戀愛線",
          },
        },
      },
      options,
    ),
    /writing\/narrative control fields/u,
    "World cognition must not consume narrative objectives.",
  );

  const agencyGuard = await useWorldSimulationCapability(
    "world_agency_guard",
    {
      world_simulation_session_id: worldRun.run_id,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        decision_request: {
          dramatic_priority: "讓場面更刺激",
          camera_priority: "強迫角色走進鏡頭中心",
          desired_romance_progress: true,
        },
      },
    },
    options,
  );
  assert.equal(agencyGuard.ok, true);
  assert.equal(agencyGuard.output.findings.length, 3);

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_action_proposer",
      {
        world_simulation_session_id: worldRun.run_id,
        capability_input: {
          character: "伊萊亞斯・諾爾",
          available_actions: [{ id: "wait", intent: "等待" }],
        },
      },
      {
        ...options,
        adapter: async () => ({
          result_type: "world_action_candidates",
          selected_action: "wait",
        }),
      },
    ),
    /crossed the causal boundary/u,
    "World neural output must not select the final action.",
  );

  console.log(JSON.stringify({
    shared_neural_core_version: sharedNeuralCoreVersion,
    writing_session_mode: writingRun.session_mode,
    world_session_mode: worldRun.session_mode,
    shared_character_family:
      writingCharacter.control_plane.shared_neural_core.capability_family,
    writing_module_count: Object.keys(writingContracts.modules).length,
  }));
  console.log("Phase62B shared neural core dual-mode isolation test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
