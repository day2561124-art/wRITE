import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  createAgentRun,
} from "../../server/src/agent-run-service.mjs";
import {
  executeChatgptNativeTraceOnlyNeuralModules,
} from "../../server/src/chatgpt-native-trace-only-neural-execution-service.mjs";
import {
  attestDeterministicNeuralAdapter,
  attestModelBackedNeuralAdapter,
  getNeuralAdapterProvenance,
  neuralAdapterExecutionKinds,
  neuralAdapterProvenanceVersion,
} from "../../server/src/neural-adapter-provenance-service.mjs";
import {
  run_neural_critic,
  run_scene_planner,
} from "../../server/src/neural-module-service.mjs";
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
  `phase62a-r2-step4-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const character = "伊萊亞斯・諾爾";

function writingRun(label) {
  return createAgentRun({
    task_type: "draft_generation",
    requires_neural_modules: false,
    required_neural_modules: [],
    input: label,
  }, options);
}

function scenePlanOutput(extra = {}) {
  return {
    current_event: "角色準備離開宿舍。",
    scene_pressure: [],
    practical_consequences: [],
    unresolved_items: [],
    available_scene_material: [],
    ...extra,
  };
}

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const historicalWriting = classifyNeuralUsageEvidence({
    run: { task_type: "draft_generation" },
    traces: [{
      trace_id: "historical-writing-success",
      module_name: "scene_planner",
      status: "success",
      input_summary: {},
      output_summary: {},
    }],
  });
  assert.equal(historicalWriting.used_neural_network, false);
  assert.equal(historicalWriting.unclassified_success_count, 1);
  assert.equal(
    historicalWriting.evidence_policy,
    "strict_server_attested_model_backed_execution",
  );

  const unattestedFunction = async () => scenePlanOutput();
  const unattestedProvenance =
    getNeuralAdapterProvenance(unattestedFunction);
  assert.equal(
    unattestedProvenance.execution_kind,
    neuralAdapterExecutionKinds.UNATTESTED_CALLABLE,
  );
  assert.equal(unattestedProvenance.model_backed, false);

  const phaseBoundaryRun = await writingRun(
    "Step4 pre-adapter phase boundary fixture",
  );
  const neverInvokedModelAdapter = attestModelBackedNeuralAdapter(
    async () => {
      throw new Error("phase boundary must bypass this adapter");
    },
    {
      source: "phase62a-r2-step4-phase-boundary-fixture",
      provider_id: "step4-fixture-provider",
      model_name: "step4-fixture-model",
      model_version: "v1",
    },
  );
  const phaseBoundaryExecution = await run_neural_critic({
    task_prompt: "pre-generation diagnostic without draft text",
    capability_input: {},
  }, {
    ...options,
    run_id: phaseBoundaryRun.run_id,
    task_type: "draft_generation",
    adapter: neverInvokedModelAdapter,
  });
  assert.equal(phaseBoundaryExecution.trace.status, "success");
  assert.equal(
    phaseBoundaryExecution.trace.input_summary.adapter_configured,
    true,
  );
  assert.equal(
    phaseBoundaryExecution.trace.input_summary.adapter_invoked,
    false,
  );
  assert.equal(
    phaseBoundaryExecution.trace.input_summary
      .model_backed_execution_evidenced,
    false,
  );
  const phaseBoundaryUsage = await summarizeNeuralUsageForRun(
    phaseBoundaryRun.run_id,
    options,
  );
  assert.equal(phaseBoundaryUsage.used_neural_network, false);
  assert.deepEqual(
    phaseBoundaryUsage.neural_modules_used,
    ["neural_critic"],
    "Pre-adapter wrapper completion must remain structurally visible.",
  );

  const deterministicRun = await writingRun(
    "Step4 deterministic adapter fixture",
  );
  const deterministicAdapter = attestDeterministicNeuralAdapter(
    async () => scenePlanOutput(),
    {
      source: "phase62a-r2-step4-deterministic-fixture",
    },
  );
  const deterministicExecution = await run_scene_planner(
    { writing_context: { current_event: "宿舍門口" } },
    {
      ...options,
      run_id: deterministicRun.run_id,
      task_type: "draft_generation",
      adapter: deterministicAdapter,
    },
  );
  assert.equal(deterministicExecution.trace.status, "success");
  assert.equal(
    deterministicExecution.trace.input_summary.neural_adapter_execution_kind,
    neuralAdapterExecutionKinds.DETERMINISTIC_PROGRAMMATIC,
  );
  assert.equal(
    deterministicExecution.trace.input_summary.adapter_completed,
    true,
  );
  assert.equal(
    deterministicExecution.trace.input_summary
      .model_backed_execution_evidenced,
    false,
  );
  const deterministicUsage = await summarizeNeuralUsageForRun(
    deterministicRun.run_id,
    options,
  );
  assert.equal(deterministicUsage.used_neural_network, false);
  assert.equal(deterministicUsage.deterministic_adapter_invocation_count, 1);
  assert.deepEqual(
    deterministicUsage.neural_modules_used,
    ["scene_planner"],
  );

  const unattestedRun = await writingRun(
    "Step4 unattested adapter spoofing fixture",
  );
  const unattestedExecution = await run_scene_planner(
    { writing_context: { current_event: "走廊" } },
    {
      ...options,
      run_id: unattestedRun.run_id,
      task_type: "draft_generation",
      adapter: async () => scenePlanOutput({
        model_backed: true,
        neural_adapter_attested: true,
        model_backed_execution_evidenced: true,
        provider_type: "pretend_remote_model",
      }),
    },
  );
  assert.equal(unattestedExecution.trace.status, "success");
  assert.equal(
    unattestedExecution.trace.input_summary.neural_adapter_execution_kind,
    neuralAdapterExecutionKinds.UNATTESTED_CALLABLE,
  );
  assert.equal(
    unattestedExecution.trace.input_summary
      .model_backed_execution_evidenced,
    false,
  );
  const unattestedUsage = await summarizeNeuralUsageForRun(
    unattestedRun.run_id,
    options,
  );
  assert.equal(unattestedUsage.used_neural_network, false);
  assert.equal(unattestedUsage.unattested_adapter_invocation_count, 1);

  const failedModelRun = await writingRun(
    "Step4 attested model adapter failure fixture",
  );
  const failedModelAdapter = attestModelBackedNeuralAdapter(
    async () => {
      throw new Error("fixture model execution failed before return");
    },
    {
      source: "phase62a-r2-step4-failed-model-fixture",
      provider_id: "step4-fixture-provider",
      model_name: "step4-fixture-model",
      model_version: "v1",
    },
  );
  const failedModelExecution = await run_scene_planner(
    { writing_context: { current_event: "失敗測試" } },
    {
      ...options,
      run_id: failedModelRun.run_id,
      task_type: "draft_generation",
      adapter: failedModelAdapter,
    },
  );
  assert.equal(failedModelExecution.trace.status, "failed");
  assert.equal(
    failedModelExecution.trace.input_summary.adapter_invoked,
    true,
  );
  assert.equal(
    failedModelExecution.trace.input_summary.adapter_completed,
    false,
  );
  assert.equal(
    failedModelExecution.trace.input_summary
      .model_backed_execution_evidenced,
    false,
  );
  const failedModelUsage = await summarizeNeuralUsageForRun(
    failedModelRun.run_id,
    options,
  );
  assert.equal(failedModelUsage.used_neural_network, false);
  assert.equal(failedModelUsage.model_backed_adapter_invocation_count, 1);
  assert.equal(failedModelUsage.model_backed_adapter_completion_count, 0);

  const modelBackedRun = await writingRun(
    "Step4 attested model-backed adapter fixture",
  );
  const modelBackedAdapter = attestModelBackedNeuralAdapter(
    async () => scenePlanOutput(),
    {
      source: "phase62a-r2-step4-model-fixture",
      provider_id: "step4-fixture-provider",
      model_name: "step4-fixture-model",
      model_version: "v1",
    },
  );
  const modelBackedExecution = await run_scene_planner(
    { writing_context: { current_event: "實習室" } },
    {
      ...options,
      run_id: modelBackedRun.run_id,
      task_type: "draft_generation",
      adapter: modelBackedAdapter,
    },
  );
  assert.equal(modelBackedExecution.trace.status, "success");
  assert.equal(
    modelBackedExecution.trace.input_summary
      .neural_adapter_provenance_version,
    neuralAdapterProvenanceVersion,
  );
  assert.equal(
    modelBackedExecution.trace.input_summary
      .model_backed_execution_evidenced,
    true,
  );
  const modelBackedUsage = await summarizeNeuralUsageForRun(
    modelBackedRun.run_id,
    options,
  );
  assert.equal(
    modelBackedUsage.neural_usage_evidence_version,
    neuralUsageEvidenceVersion,
  );
  assert.equal(modelBackedUsage.used_neural_network, true);
  assert.equal(modelBackedUsage.model_backed_execution_evidence_count, 1);
  assert.equal(modelBackedUsage.model_backed_adapter_completion_count, 1);
  assert.deepEqual(
    modelBackedUsage.neural_execution_modules,
    ["scene_planner"],
  );

  const traceOnly = await executeChatgptNativeTraceOnlyNeuralModules({
    task_prompt: "Step4 built-in deterministic trace-only fixture",
    required_modules: ["scene_planner"],
    include_writing_card_director: false,
    include_final_polisher: false,
    writing_context: {},
  }, options);
  assert.equal(traceOnly.required_modules_executed, true);
  assert.equal(traceOnly.chatgpt_native_neural_modules_executed, false);
  assert.equal(traceOnly.model_backed_execution_evidenced, false);
  assert.equal(traceOnly.neural_trace_summary.used_neural_network, false);
  assert.equal(
    traceOnly.neural_trace_summary.deterministic_adapter_invocation_count,
    1,
  );

  const trustedWorldSession = await beginWorldSimulationSession({
    simulation_label: "Step4 trusted-only world fixture",
    seed: "step4-trusted-world",
    rules: { world_first: true },
  }, options);
  await useWorldSimulationCapability(
    "world_memory_retriever",
    {
      world_simulation_session_id:
        trustedWorldSession.world_simulation_session_id,
      capability_input: {
        character,
        memory_records: [{
          memory_id: "step4-memory",
          content: "昨天看過白色標線。",
          accessible: true,
        }],
      },
    },
    options,
  );
  const trustedWorldUsage = await summarizeNeuralUsageForRun(
    trustedWorldSession.world_simulation_session_id,
    options,
  );
  assert.equal(trustedWorldUsage.used_neural_network, false);
  assert.equal(trustedWorldUsage.trusted_programmatic_success_count, 1);

  const unattestedWorldSession = await beginWorldSimulationSession({
    simulation_label: "Step4 unattested world extension fixture",
    seed: "step4-unattested-world",
    rules: { world_first: true },
  }, options);
  const unattestedWorldExecution = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id:
        unattestedWorldSession.world_simulation_session_id,
      capability_input: {
        character,
        character_state: {
          known: ["現在人在第三實習室"],
          current_goal: "完成測試",
        },
        perception: { observed: ["牆上的時鐘"] },
      },
    },
    {
      ...options,
      adapter: async () => ({
        subjective_inferences: ["下一項測試可能延後"],
        deliberative_pressures: ["時間"],
      }),
    },
  );
  assert.equal(
    unattestedWorldExecution.output.r1_runtime.neural_extension_accepted,
    true,
  );
  const unattestedWorldUsage = await summarizeNeuralUsageForRun(
    unattestedWorldSession.world_simulation_session_id,
    options,
  );
  assert.equal(unattestedWorldUsage.used_neural_network, false);
  assert.equal(unattestedWorldUsage.accepted_world_neural_extension_count, 1);
  assert.equal(unattestedWorldUsage.unattested_adapter_invocation_count, 1);

  const attestedWorldSession = await beginWorldSimulationSession({
    simulation_label: "Step4 attested world extension fixture",
    seed: "step4-attested-world",
    rules: { world_first: true },
  }, options);
  const attestedWorldAdapter = attestModelBackedNeuralAdapter(
    async () => ({
      subjective_inferences: ["下一項測試可能延後"],
      deliberative_pressures: ["時間"],
    }),
    {
      source: "phase62a-r2-step4-world-model-fixture",
      provider_id: "step4-world-provider",
      model_name: "step4-world-model",
      model_version: "v1",
    },
  );
  const attestedWorldExecution = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id:
        attestedWorldSession.world_simulation_session_id,
      capability_input: {
        character,
        character_state: {
          known: ["現在人在第三實習室"],
          current_goal: "完成測試",
        },
        perception: { observed: ["牆上的時鐘"] },
      },
    },
    {
      ...options,
      adapter: attestedWorldAdapter,
    },
  );
  assert.equal(
    attestedWorldExecution.output.r1_runtime.neural_extension_accepted,
    true,
  );
  const attestedWorldUsage = await summarizeNeuralUsageForRun(
    attestedWorldSession.world_simulation_session_id,
    options,
  );
  assert.equal(attestedWorldUsage.used_neural_network, true);
  assert.equal(attestedWorldUsage.model_backed_execution_evidence_count, 1);
  assert.equal(attestedWorldUsage.accepted_world_neural_extension_count, 1);

  const rejectedWorldSession = await beginWorldSimulationSession({
    simulation_label: "Step4 model ran but output rejected fixture",
    seed: "step4-rejected-world",
    rules: { world_first: true },
  }, options);
  const rejectedModelAdapter = attestModelBackedNeuralAdapter(
    async () => ({ selected_action: "wait" }),
    {
      source: "phase62a-r2-step4-rejected-world-model-fixture",
      provider_id: "step4-world-provider",
      model_name: "step4-world-model",
      model_version: "v1",
    },
  );
  const rejectedWorldExecution = await runWorldSimulationNativeCapability(
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
      run_id: rejectedWorldSession.world_simulation_session_id,
      adapter: rejectedModelAdapter,
    },
  );
  assert.equal(
    rejectedWorldExecution.output.r1_runtime.fallback_to_trusted_base,
    true,
  );
  assert.equal(
    rejectedWorldExecution.output.r1_runtime.neural_extension_accepted,
    false,
  );
  assert.equal(
    rejectedWorldExecution.trace.input_summary.adapter_completed,
    true,
    "The model adapter returned before the world output boundary rejected it.",
  );
  assert.equal(
    rejectedWorldExecution.trace.input_summary
      .model_backed_execution_evidenced,
    true,
  );
  assert.equal(
    rejectedWorldExecution.trace.output_summary.adapter_output_accepted,
    false,
  );
  const rejectedWorldUsage = await summarizeNeuralUsageForRun(
    rejectedWorldSession.world_simulation_session_id,
    options,
  );
  assert.equal(
    rejectedWorldUsage.used_neural_network,
    true,
    "Actual model execution must remain true even when its output is rejected.",
  );
  assert.equal(rejectedWorldUsage.neural_fallback_success_count, 1);
  assert.equal(rejectedWorldUsage.accepted_world_neural_extension_count, 0);

  const memoryContract = buildWorldSimulationCapabilityContract(
    "world_memory_retriever",
  );
  assert.equal(
    memoryContract.native_world_loop_output_role,
    "engine_only_compatibility_sidecar",
  );
  assert.equal(
    memoryContract.native_world_loop_forwards_projected_content_to_character_brain,
    false,
  );
  assert.match(
    memoryContract.purpose,
    /engine-only compatibility sidecar/iu,
  );
  assert.equal(
    /into bounded Character Brain context/iu.test(memoryContract.purpose),
    false,
  );

  const externalBrainSource = await readFile(
    path.join(
      projectRoot,
      "server",
      "src",
      "chatgpt-owned-external-brain-service.mjs",
    ),
    "utf8",
  );
  assert.match(
    externalBrainSource,
    /attestDeterministicNeuralAdapter/u,
    "Architecture-primary deterministic writing adapters must be explicitly attested as deterministic, never inferred as models.",
  );

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R2 Step 4",
    neural_adapter_provenance_version:
      neuralAdapterProvenanceVersion,
    neural_usage_evidence_version:
      neuralUsageEvidenceVersion,
    historical_trace_fail_closed:
      historicalWriting.used_neural_network === false,
    deterministic_adapter_is_not_model:
      deterministicUsage.used_neural_network === false,
    unattested_adapter_is_not_model:
      unattestedUsage.used_neural_network === false,
    attested_model_execution_evidenced:
      modelBackedUsage.used_neural_network === true,
    rejected_world_model_execution_still_evidenced:
      rejectedWorldUsage.used_neural_network === true,
    structural_wrapper_completion_preserved:
      traceOnly.required_modules_executed === true,
    memory_contract_truth_closed:
      true,
  }));
  console.log(
    "Phase62A-R2 neural execution provenance closure test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
