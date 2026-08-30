import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  attestModelBackedNeuralAdapter,
} from "../../server/src/neural-adapter-provenance-service.mjs";
import {
  classifyNeuralUsageEvidence,
  neuralUsageEvidenceVersion,
} from "../../server/src/neural-usage-evidence-service.mjs";
import {
  summarizeNeuralUsageForRun,
} from "../../server/src/neural-trace-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  buildWorldSimulationCapabilityContract,
  runWorldSimulationNativeCapability,
} from "../../server/src/world-simulation-neural-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r2-step3-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const character = "伊萊亞斯・諾爾";

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const historicalTaskOnlyUnknown = classifyNeuralUsageEvidence({
    run: {
      task_type: "world_simulation",
    },
    traces: [{
      trace_id: "legacy-task-only-world-trace",
      module_name: "world_scene_causal_analyzer",
      status: "success",
      input_summary: {},
      output_summary: {},
    }],
  });
  assert.equal(historicalTaskOnlyUnknown.world_simulation_run, true);
  assert.equal(historicalTaskOnlyUnknown.used_neural_network, false);
  assert.equal(
    historicalTaskOnlyUnknown.unclassified_world_success_count,
    1,
  );

  const historicalUnknown = classifyNeuralUsageEvidence({
    run: {
      task_type: "world_simulation",
      mode: "chatgpt_owned_world_simulation",
    },
    traces: [{
      trace_id: "legacy-world-trace-without-evidence-marker",
      module_name: "world_perception_filter",
      status: "success",
      input_summary: {},
      output_summary: {},
    }],
  });
  assert.equal(historicalUnknown.used_neural_network, false);
  assert.equal(historicalUnknown.unclassified_world_success_count, 1);
  assert.deepEqual(
    historicalUnknown.successful_wrapper_modules,
    ["world_perception_filter"],
  );
  assert.deepEqual(historicalUnknown.neural_execution_modules, []);

  const trustedSession = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R2 Step 3 trusted-only telemetry fixture",
    seed: "phase62a-r2-step3-trusted",
    rules: { world_first: true },
  }, options);
  const trustedSessionId =
    trustedSession.world_simulation_session_id;

  await useWorldSimulationCapability(
    "world_memory_retriever",
    {
      world_simulation_session_id: trustedSessionId,
      capability_input: {
        character,
        memory_records: [{
          memory_id: "step3-memory",
          content: "昨天看過第三實習室的白色標線。",
          accessible: true,
        }],
      },
    },
    options,
  );

  const trustedUsage = await summarizeNeuralUsageForRun(
    trustedSessionId,
    options,
  );
  assert.equal(
    trustedUsage.neural_usage_evidence_version,
    neuralUsageEvidenceVersion,
  );
  assert.equal(trustedUsage.success_count, 1);
  assert.equal(trustedUsage.capability_success_count, 1);
  assert.equal(trustedUsage.used_neural_network, false);
  assert.deepEqual(
    trustedUsage.neural_modules_used,
    ["world_memory_retriever"],
    "Legacy successful-wrapper bookkeeping must remain compatible.",
  );
  assert.deepEqual(
    trustedUsage.successful_wrapper_modules,
    ["world_memory_retriever"],
  );
  assert.deepEqual(trustedUsage.neural_execution_modules, []);
  assert.equal(
    trustedUsage.trusted_programmatic_success_count,
    1,
  );
  assert.equal(trustedUsage.neural_execution_evidence_count, 0);
  assert.equal(trustedUsage.neural_adapter_metrics_applicable, true);
  assert.equal(
    trustedUsage.neural_adapter_invocation_count,
    0,
  );
  assert.equal(
    trustedUsage.neural_adapter_success_evidence_count,
    0,
  );

  await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id: trustedSessionId,
      capability_input: {
        character,
        character_state: {
          known: ["現在人在第三實習室"],
          current_goal: "完成測試",
        },
        perception: {
          observed: ["牆上的時鐘"],
        },
      },
    },
    {
      ...options,
      adapter: attestModelBackedNeuralAdapter(
        async () => ({
          subjective_inferences: ["下一項測試可能延後"],
          deliberative_pressures: ["時間"],
        }),
        {
          source: "phase62a-r2-step3-world-fixture",
          provider_id: "phase62a-r2-step3-fixture",
          model_name: "world-character-cognition-fixture",
          model_version: "v1",
        },
      ),
    },
  );

  const acceptedUsage = await summarizeNeuralUsageForRun(
    trustedSessionId,
    options,
  );
  assert.equal(acceptedUsage.used_neural_network, true);
  assert.equal(acceptedUsage.neural_execution_evidence_count, 1);
  assert.equal(
    acceptedUsage.neural_adapter_invocation_count,
    1,
  );
  assert.equal(
    acceptedUsage.neural_adapter_success_evidence_count,
    1,
  );
  assert.deepEqual(
    acceptedUsage.neural_execution_modules,
    ["world_character_cognition"],
  );
  assert.equal(
    acceptedUsage.trusted_programmatic_success_count,
    1,
  );
  assert.deepEqual(
    new Set(acceptedUsage.neural_modules_used),
    new Set([
      "world_memory_retriever",
      "world_character_cognition",
    ]),
  );

  const fallbackSession = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R2 Step 3 native fallback telemetry fixture",
    seed: "phase62a-r2-step3-fallback",
    rules: { world_first: true },
  }, options);
  const fallbackSessionId =
    fallbackSession.world_simulation_session_id;

  const fallbackExecution =
    await runWorldSimulationNativeCapability(
      "world_action_proposer",
      {
        character,
        available_actions: [{
          action_id: "wait",
          intent: "留在原地等待",
        }],
      },
      {
        ...options,
        run_id: fallbackSessionId,
        adapter: async () => ({
          selected_action: "wait",
        }),
      },
    );
  assert.equal(
    fallbackExecution.output.r1_runtime.fallback_to_trusted_base,
    true,
  );
  assert.equal(
    fallbackExecution.output.r1_runtime.neural_extension_accepted,
    false,
  );

  const fallbackUsage = await summarizeNeuralUsageForRun(
    fallbackSessionId,
    options,
  );
  assert.equal(fallbackUsage.success_count, 1);
  assert.equal(fallbackUsage.used_neural_network, false);
  assert.equal(fallbackUsage.neural_execution_evidence_count, 0);
  assert.equal(
    fallbackUsage.neural_adapter_invocation_count,
    1,
  );
  assert.equal(
    fallbackUsage.neural_adapter_success_evidence_count,
    0,
  );
  assert.equal(
    fallbackUsage.neural_fallback_success_count,
    1,
  );
  assert.deepEqual(
    fallbackUsage.neural_execution_modules,
    [],
  );
  assert.deepEqual(
    fallbackUsage.neural_modules_used,
    ["world_action_proposer"],
    "Fallback wrapper success must remain visible in legacy bookkeeping.",
  );

  const consistencyContract =
    buildWorldSimulationCapabilityContract(
      "world_consistency_critic",
    );
  assert(
    consistencyContract.returns.includes("hard_conflict_count"),
    "Consistency contract must declare the trusted commit-gate count it actually returns.",
  );

  const readonlySource = await readFile(
    path.join(
      projectRoot,
      "server",
      "src",
      "mcp-readonly-tools.mjs",
    ),
    "utf8",
  );
  assert.match(
    readonlySource,
    /classifyNeuralUsageEvidence/u,
    "Readonly MCP must share the canonical neural-evidence classifier.",
  );
  assert.equal(
    /used_neural_network:\s*successfulModules\.length\s*>\s*0/u
      .test(readonlySource),
    false,
    "Readonly MCP must not retain the legacy success-trace heuristic.",
  );

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R2 Step 3",
    neural_usage_evidence_version:
      neuralUsageEvidenceVersion,
    trusted_only_world_used_neural_network:
      trustedUsage.used_neural_network,
    accepted_world_adapter_used_neural_network:
      acceptedUsage.used_neural_network,
    native_fallback_used_neural_network:
      fallbackUsage.used_neural_network,
    world_only_evidence_contract_verified: true,
    consistency_contract_declares_hard_conflict_count:
      true,
    readonly_uses_shared_classifier:
      true,
  }));
  console.log(
    "Phase62A-R2 neural evidence / contract truth test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
