import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  buildSharedNeuralCoreRegistry,
  sharedNeuralCoreVersion,
} from "../../server/src/shared-neural-core-service.mjs";
import {
  worldSimulationCapabilityRoleRegistryVersion,
} from "../../server/src/world-simulation-capability-role-service.mjs";
import {
  getNeuralTrace,
} from "../../server/src/neural-trace-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r2-step2-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const character = "伊萊亞斯・諾爾";

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const registry = buildSharedNeuralCoreRegistry();

  assert.equal(
    sharedNeuralCoreVersion,
    "phase62b-shared-neural-core-v1",
    "R2 world-role metadata must not churn the unchanged Phase62B routing contract version.",
  );
  assert.equal(
    registry.modes.world_simulation.world_capability_role_registry_version,
    worldSimulationCapabilityRoleRegistryVersion,
  );
  assert.equal(
    registry.modes.world_simulation.capabilities.world_memory_retriever,
    "memory_retrieval",
    "Existing Shared Core routing family remains a compatibility semantic family.",
  );
  assert.equal(
    registry.modes.world_simulation.capabilities.world_action_proposer,
    "action_proposal",
    "R2 must not rename the existing Shared Core routing family.",
  );
  assert.equal(
    registry.modes.world_simulation
      .world_capability_roles
      .world_memory_retriever
      .trusted_runtime_role,
    "legacy_memory_context_projection",
  );
  assert.equal(
    registry.modes.world_simulation
      .world_capability_roles
      .world_action_proposer
      .neural_extension_role,
    "action_candidate_consideration_ordering",
  );

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R2 Step 2 role-aware descriptor trace fixture",
    seed: "phase62a-r2-step2",
    rules: { world_first: true },
  }, options);
  const sessionId = session.world_simulation_session_id;

  const memory = await useWorldSimulationCapability(
    "world_memory_retriever",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character,
        memory_records: [{
          memory_id: "r2-step2-memory-1",
          content: "昨天看過第三實習室中央的白色標線。",
          accessible: true,
        }],
      },
    },
    options,
  );

  assert.equal(
    memory.shared_neural_core.core_version,
    sharedNeuralCoreVersion,
  );
  assert.equal(
    memory.shared_neural_core.capability_family,
    "memory_retrieval",
  );
  assert.equal(
    memory.shared_neural_core.world_capability_role_registry_version,
    worldSimulationCapabilityRoleRegistryVersion,
  );
  assert.equal(
    memory.shared_neural_core.world_capability_role.trusted_runtime_role,
    "legacy_memory_context_projection",
  );
  assert.equal(
    memory.shared_neural_core.world_capability_role.neural_extension_role,
    "memory_projection_selection_ordering",
  );
  assert.equal(
    memory.shared_neural_core
      .world_capability_role
      .authority
      .trusted_output_is_compatibility_only,
    true,
  );

  const memoryTrace = await getNeuralTrace(
    memory.trace.trace_id,
    options,
  );
  assert.equal(memoryTrace.input_summary.adapter_invoked, false);
  assert.equal(
    memoryTrace.input_summary.world_capability_role_registry_version,
    worldSimulationCapabilityRoleRegistryVersion,
  );
  assert.equal(
    memoryTrace.input_summary.world_capability_semantic_family,
    "memory_context",
  );
  assert.equal(
    memoryTrace.input_summary.world_trusted_runtime_role,
    "legacy_memory_context_projection",
  );
  assert.equal(
    memoryTrace.input_summary.world_neural_extension_role,
    "memory_projection_selection_ordering",
  );
  assert.equal(
    memoryTrace.input_summary.world_trusted_output_effect,
    "engine_only_compatibility_sidecar",
  );
  assert.equal(
    memoryTrace.input_summary
      .world_formal_mainline_neural_extension_effect,
    false,
  );
  assert.equal(
    memoryTrace.output_summary.world_trusted_runtime_role,
    "legacy_memory_context_projection",
  );

  let actionAdapterContext = null;
  const action = await useWorldSimulationCapability(
    "world_action_proposer",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character,
        available_actions: [
          { action_id: "wait", intent: "留在原地等待" },
          { action_id: "look_clock", intent: "看牆上的時鐘" },
        ],
      },
    },
    {
      ...options,
      adapter: async (envelope, context) => {
        actionAdapterContext = structuredClone(context);
        const refs = [...envelope.authorized_source_refs];
        return {
          considered_action_refs: refs,
          ordered_action_refs: [...refs].reverse(),
          deprioritized_action_refs: [],
        };
      },
    },
  );

  assert(actionAdapterContext);
  assert.equal(
    actionAdapterContext.shared_capability_family,
    "action_proposal",
  );
  assert.equal(
    actionAdapterContext.world_capability_role_registry_version,
    worldSimulationCapabilityRoleRegistryVersion,
  );
  assert.equal(
    actionAdapterContext.world_trusted_runtime_role,
    "action_candidate_catalog_construction",
  );
  assert.equal(
    actionAdapterContext.world_neural_extension_role,
    "action_candidate_consideration_ordering",
  );
  assert.equal(
    actionAdapterContext.world_formal_mainline_neural_extension_effect,
    false,
  );
  assert.equal(
    actionAdapterContext.world_role_registry_grants_runtime_permission,
    false,
  );
  assert.equal(
    Object.hasOwn(actionAdapterContext, "world_capability_role"),
    false,
    "Adapter context must receive detached scalar role facts, not the descriptor's mutable role object.",
  );
  assert.equal(
    action.output.candidate_action_intents.length,
    2,
    "Neural consideration must not alter the trusted candidate universe.",
  );
  assert.equal(
    action.shared_neural_core
      .world_capability_role
      .neural_extension_role,
    "action_candidate_consideration_ordering",
  );

  const actionTrace = await getNeuralTrace(
    action.trace.trace_id,
    options,
  );
  assert.equal(actionTrace.input_summary.adapter_invoked, true);
  assert.equal(
    actionTrace.input_summary.world_trusted_runtime_role,
    "action_candidate_catalog_construction",
  );
  assert.equal(
    actionTrace.input_summary.world_neural_extension_role,
    "action_candidate_consideration_ordering",
  );
  assert.equal(
    actionTrace.input_summary
      .world_trusted_output_enters_character_brain,
    true,
  );
  assert.equal(
    actionTrace.output_summary
      .world_formal_mainline_neural_extension_effect,
    false,
  );

  const consistency = await useWorldSimulationCapability(
    "world_consistency_critic",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        state_transitions: [],
      },
    },
    options,
  );
  const consistencyTrace = await getNeuralTrace(
    consistency.trace.trace_id,
    options,
  );
  assert.equal(
    consistencyTrace.input_summary.world_trusted_runtime_role,
    "hard_consistency_gate_evaluation",
  );
  assert.equal(
    consistencyTrace.input_summary
      .world_trusted_output_controls_commit_gate,
    true,
  );
  assert.equal(
    consistencyTrace.output_summary
      .world_trusted_output_controls_commit_gate,
    true,
  );
  assert.equal(
    consistencyTrace.input_summary
      .world_formal_mainline_neural_extension_effect,
    false,
  );

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R2 Step 2",
    shared_neural_core_version: sharedNeuralCoreVersion,
    role_registry_version:
      worldSimulationCapabilityRoleRegistryVersion,
    legacy_writing_fixture_required: false,
    memory_shared_family_preserved: true,
    memory_trusted_role_normalized: true,
    action_shared_family_preserved: true,
    action_neural_role_normalized: true,
    adapter_context_role_object_shared: false,
    consistency_trusted_commit_authority_traced: true,
    formal_mainline_neural_extension_effect: false,
  }));
  console.log(
    "Phase62A-R2 role-aware descriptor/trace adoption test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
