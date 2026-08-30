import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  attestDeterministicNeuralAdapter,
  attestModelBackedNeuralAdapter,
  getNeuralAdapterProvenance,
  neuralAdapterExecutionKinds,
  neuralAdapterProvenanceVersion,
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
  `phase62a-r2-step4-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const character = "伊萊亞斯・諾爾";

function cognitionInput() {
  return {
    character,
    character_state: {
      known: ["現在人在第三實習室"],
      current_goal: "完成測試",
    },
    perception: {
      observed: ["牆上的時鐘"],
    },
  };
}

function cognitionOutput() {
  return {
    subjective_inferences: ["下一項測試可能延後"],
    deliberative_pressures: ["時間"],
  };
}

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const historicalWorld = classifyNeuralUsageEvidence({
    run: {
      task_type: "world_simulation",
      mode: "chatgpt_owned_world_simulation",
    },
    traces: [{
      trace_id: "historical-world-success-without-attestation",
      module_name: "world_scene_causal_analyzer",
      status: "success",
      input_summary: {},
      output_summary: {},
    }],
  });
  assert.equal(historicalWorld.world_simulation_run, true);
  assert.equal(historicalWorld.used_neural_network, false);
  assert.equal(historicalWorld.unclassified_world_success_count, 1);
  assert.equal(
    historicalWorld.evidence_policy,
    "strict_server_attested_model_backed_execution",
  );

  const rawCallable = async () => cognitionOutput();
  const rawProvenance = getNeuralAdapterProvenance(rawCallable);
  assert.equal(
    rawProvenance.execution_kind,
    neuralAdapterExecutionKinds.UNATTESTED_CALLABLE,
  );
  assert.equal(rawProvenance.model_backed, false);

  const trustedSession = await beginWorldSimulationSession({
    simulation_label: "Step4 trusted-only world fixture",
    seed: "step4-trusted-world",
    rules: { world_first: true },
  }, options);
  await useWorldSimulationCapability(
    "world_memory_retriever",
    {
      world_simulation_session_id:
        trustedSession.world_simulation_session_id,
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
  const trustedUsage = await summarizeNeuralUsageForRun(
    trustedSession.world_simulation_session_id,
    options,
  );
  assert.equal(trustedUsage.used_neural_network, false);
  assert.equal(trustedUsage.trusted_programmatic_success_count, 1);

  const deterministicSession = await beginWorldSimulationSession({
    simulation_label: "Step4 deterministic world adapter fixture",
    seed: "step4-deterministic-world",
    rules: { world_first: true },
  }, options);
  const deterministicAdapter = attestDeterministicNeuralAdapter(
    async () => cognitionOutput(),
    {
      source: "phase62a-r2-step4-deterministic-world-fixture",
    },
  );
  const deterministicExecution = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id:
        deterministicSession.world_simulation_session_id,
      capability_input: cognitionInput(),
    },
    {
      ...options,
      adapter: deterministicAdapter,
    },
  );
  assert.equal(
    deterministicExecution.output.r1_runtime.neural_extension_accepted,
    true,
  );
  assert.equal(
    deterministicExecution.trace.input_summary.neural_adapter_execution_kind,
    neuralAdapterExecutionKinds.DETERMINISTIC_PROGRAMMATIC,
  );
  const deterministicUsage = await summarizeNeuralUsageForRun(
    deterministicSession.world_simulation_session_id,
    options,
  );
  assert.equal(deterministicUsage.used_neural_network, false);
  assert.equal(deterministicUsage.deterministic_adapter_invocation_count, 1);
  assert.equal(deterministicUsage.accepted_world_neural_extension_count, 1);

  const unattestedSession = await beginWorldSimulationSession({
    simulation_label: "Step4 unattested world adapter fixture",
    seed: "step4-unattested-world",
    rules: { world_first: true },
  }, options);
  const unattestedExecution = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id:
        unattestedSession.world_simulation_session_id,
      capability_input: cognitionInput(),
    },
    {
      ...options,
      adapter: async () => cognitionOutput(),
    },
  );
  assert.equal(
    unattestedExecution.output.r1_runtime.neural_extension_accepted,
    true,
  );
  const unattestedUsage = await summarizeNeuralUsageForRun(
    unattestedSession.world_simulation_session_id,
    options,
  );
  assert.equal(unattestedUsage.used_neural_network, false);
  assert.equal(unattestedUsage.unattested_adapter_invocation_count, 1);
  assert.equal(unattestedUsage.accepted_world_neural_extension_count, 1);

  const attestedSession = await beginWorldSimulationSession({
    simulation_label: "Step4 attested model world adapter fixture",
    seed: "step4-attested-world",
    rules: { world_first: true },
  }, options);
  const attestedAdapter = attestModelBackedNeuralAdapter(
    async () => cognitionOutput(),
    {
      source: "phase62a-r2-step4-world-model-fixture",
      provider_id: "step4-world-provider",
      model_name: "step4-world-model",
      model_version: "v1",
    },
  );
  const attestedExecution = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id:
        attestedSession.world_simulation_session_id,
      capability_input: cognitionInput(),
    },
    {
      ...options,
      adapter: attestedAdapter,
    },
  );
  assert.equal(
    attestedExecution.output.r1_runtime.neural_extension_accepted,
    true,
  );
  assert.equal(
    attestedExecution.trace.input_summary.neural_adapter_provenance_version,
    neuralAdapterProvenanceVersion,
  );
  assert.equal(
    attestedExecution.trace.input_summary.model_backed_execution_evidenced,
    true,
  );
  const attestedUsage = await summarizeNeuralUsageForRun(
    attestedSession.world_simulation_session_id,
    options,
  );
  assert.equal(
    attestedUsage.neural_usage_evidence_version,
    neuralUsageEvidenceVersion,
  );
  assert.equal(attestedUsage.used_neural_network, true);
  assert.equal(attestedUsage.model_backed_execution_evidence_count, 1);
  assert.equal(attestedUsage.accepted_world_neural_extension_count, 1);

  const rejectedSession = await beginWorldSimulationSession({
    simulation_label: "Step4 model ran but world output rejected fixture",
    seed: "step4-rejected-world",
    rules: { world_first: true },
  }, options);
  const rejectedAdapter = attestModelBackedNeuralAdapter(
    async () => ({ selected_action: "wait" }),
    {
      source: "phase62a-r2-step4-rejected-world-model-fixture",
      provider_id: "step4-world-provider",
      model_name: "step4-world-model",
      model_version: "v1",
    },
  );
  const rejectedExecution = await runWorldSimulationNativeCapability(
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
      run_id: rejectedSession.world_simulation_session_id,
      adapter: rejectedAdapter,
    },
  );
  assert.equal(
    rejectedExecution.output.r1_runtime.fallback_to_trusted_base,
    true,
  );
  assert.equal(
    rejectedExecution.output.r1_runtime.neural_extension_accepted,
    false,
  );
  assert.equal(
    rejectedExecution.trace.input_summary.adapter_completed,
    true,
  );
  assert.equal(
    rejectedExecution.trace.input_summary.model_backed_execution_evidenced,
    true,
  );
  assert.equal(
    rejectedExecution.trace.output_summary.adapter_output_accepted,
    false,
  );

  const rejectedUsage = await summarizeNeuralUsageForRun(
    rejectedSession.world_simulation_session_id,
    options,
  );
  assert.equal(rejectedUsage.used_neural_network, true);
  assert.equal(rejectedUsage.neural_fallback_success_count, 1);
  assert.equal(rejectedUsage.accepted_world_neural_extension_count, 0);

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

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R2 Step 4",
    neural_adapter_provenance_version:
      neuralAdapterProvenanceVersion,
    neural_usage_evidence_version:
      neuralUsageEvidenceVersion,
    historical_trace_fail_closed:
      historicalWorld.used_neural_network === false,
    deterministic_adapter_is_not_model:
      deterministicUsage.used_neural_network === false,
    unattested_adapter_is_not_model:
      unattestedUsage.used_neural_network === false,
    attested_model_execution_evidenced:
      attestedUsage.used_neural_network === true,
    rejected_world_model_execution_still_evidenced:
      rejectedUsage.used_neural_network === true,
    trusted_programmatic_path_preserved:
      trustedUsage.trusted_programmatic_success_count === 1,
    legacy_writing_fixture_required: false,
    memory_contract_truth_closed: true,
  }));
  console.log(
    "Phase62A-R2 world-only neural execution provenance closure test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
