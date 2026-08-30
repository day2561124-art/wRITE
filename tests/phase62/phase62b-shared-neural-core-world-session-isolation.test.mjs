import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  getAgentRun,
  updateAgentRunStatus,
} from "../../server/src/agent-run-service.mjs";
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

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const coreRegistry = buildSharedNeuralCoreRegistry();
  assert.equal(coreRegistry.core_version, sharedNeuralCoreVersion);
  assert.equal(
    Object.hasOwn(coreRegistry.modes, neuralSessionModes.WORLD_SIMULATION),
    true,
  );
  assert.equal(
    coreRegistry.modes.world_simulation.capabilities.world_character_cognition,
    "character_cognition",
  );
  assert.equal(coreRegistry.mode_lock.immutable_through_session_lineage, true);
  assert.equal(coreRegistry.mode_lock.cross_mode_capability_use_allowed, false);

  const worldSession = await beginWorldSimulationSession({
    simulation_label: "Phase62B world-session isolation fixture",
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
    sharedNeuralCoreVersion,
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
    () => updateAgentRunStatus(
      worldRun.run_id,
      "running",
      { session_mode: "retired_writing_mode" },
      options,
    ),
    /session_mode is immutable/u,
  );
  assert.equal(
    (await getAgentRun(worldRun.run_id, options)).session_mode,
    neuralSessionModes.WORLD_SIMULATION,
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
    world_session_mode: worldRun.session_mode,
    character_cognition_family: worldCharacter.shared_neural_core.capability_family,
    session_mode_immutable: true,
    narrative_control_rejected: true,
    action_outcome_authority_rejected: true,
    legacy_writing_fixture_required: false,
  }));
  console.log("Phase62B shared neural core world-session isolation test passed.");

} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
