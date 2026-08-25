import assert from "node:assert/strict";

import {
  buildSharedNeuralCoreRegistry,
  neuralSessionModes,
} from "../../server/src/shared-neural-core-service.mjs";
import {
  buildWorldSimulationCapabilityPolicyRegistry,
} from "../../server/src/world-simulation-capability-envelope-service.mjs";
import {
  buildWorldSimulationCharacterFacingRuntimeContract,
  isWorldSimulationCharacterFacingCapability,
} from "../../server/src/world-simulation-character-facing-capability-runtime-service.mjs";
import {
  buildWorldSimulationEngineIntegrityRuntimeContract,
  isWorldSimulationEngineIntegrityCapability,
} from "../../server/src/world-simulation-engine-integrity-capability-runtime-service.mjs";
import {
  buildWorldSimulationCapabilityRegistry,
  worldSimulationCapabilityNames,
} from "../../server/src/world-simulation-neural-service.mjs";
import {
  worldSimulationFormalPublicBlockedTools,
  worldSimulationLegacyCapabilityToolNames,
} from "../../server/src/world-simulation-mcp-boundary-service.mjs";
import {
  buildWorldSimulationCapabilityRoleRegistry,
  getWorldSimulationCapabilityRole,
  isWorldSimulationCapabilityRoleRegistered,
  worldSimulationCapabilityRoleNames,
  worldSimulationCapabilityRoleRegistryVersion,
} from "../../server/src/world-simulation-capability-role-service.mjs";

const expectedRoles = Object.freeze({
  world_scene_causal_analyzer: Object.freeze({
    semantic_family: "scene_causality",
    trusted_runtime_role: "scene_causal_input_normalization",
    neural_extension_role: "scene_interpretive_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "engine_only",
    shared_neural_routing_family: "scene_analysis",
    native_stage: "prepare",
    native_scope: "per_turn",
    trusted_output_effect: "causal_adjudication_input",
  }),
  world_perception_filter: Object.freeze({
    semantic_family: "perception",
    trusted_runtime_role: "bounded_perception_construction",
    neural_extension_role: "perception_attention_annotation",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "perception",
    native_stage: "prepare",
    native_scope: "per_character",
    trusted_output_effect: "character_brain_perception_context",
  }),
  world_memory_retriever: Object.freeze({
    semantic_family: "memory_context",
    trusted_runtime_role: "legacy_memory_context_projection",
    neural_extension_role: "memory_projection_selection_ordering",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "memory_retrieval",
    native_stage: "prepare",
    native_scope: "per_character",
    trusted_output_effect: "engine_only_compatibility_sidecar",
  }),
  world_character_cognition: Object.freeze({
    semantic_family: "character_cognition",
    trusted_runtime_role: "bounded_cognition_assembly",
    neural_extension_role: "subjective_cognition_extension",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "character_cognition",
    native_stage: "prepare",
    native_scope: "per_character",
    trusted_output_effect: "character_brain_cognition_context",
  }),
  world_action_proposer: Object.freeze({
    semantic_family: "action_candidates",
    trusted_runtime_role: "action_candidate_catalog_construction",
    neural_extension_role: "action_candidate_consideration_ordering",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "action_proposal",
    native_stage: "prepare",
    native_scope: "per_character",
    trusted_output_effect: "character_brain_candidate_catalog",
  }),
  world_agency_guard: Object.freeze({
    semantic_family: "agency_governance",
    trusted_runtime_role: "narrative_control_signal_detection",
    neural_extension_role: "agency_signal_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "diagnostic_scoped",
    shared_neural_routing_family: "agency_governance",
    native_stage: "not_invoked",
    native_scope: "not_applicable",
    trusted_output_effect: "not_invoked_by_formal_loop",
  }),
  world_consistency_critic: Object.freeze({
    semantic_family: "consistency",
    trusted_runtime_role: "hard_consistency_gate_evaluation",
    neural_extension_role: "consistency_review_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "engine_only",
    shared_neural_routing_family: "consistency_critique",
    native_stage: "resolve",
    native_scope: "per_turn",
    trusted_output_effect: "commit_gate",
  }),
});

const roleRegistry = buildWorldSimulationCapabilityRoleRegistry();
const policyRegistry = buildWorldSimulationCapabilityPolicyRegistry();
const characterRuntime = buildWorldSimulationCharacterFacingRuntimeContract();
const engineRuntime = buildWorldSimulationEngineIntegrityRuntimeContract();
const sharedCore = buildSharedNeuralCoreRegistry();
const capabilityRegistry = buildWorldSimulationCapabilityRegistry();

assert.equal(
  roleRegistry.registry_version,
  worldSimulationCapabilityRoleRegistryVersion,
);
assert.deepEqual(worldSimulationCapabilityRoleNames, worldSimulationCapabilityNames);
assert.deepEqual(
  Object.keys(roleRegistry.capabilities),
  worldSimulationCapabilityNames,
);
assert.deepEqual(
  Object.keys(policyRegistry.capabilities),
  worldSimulationCapabilityNames,
);
assert.deepEqual(
  Object.keys(capabilityRegistry.capabilities),
  worldSimulationCapabilityNames,
);

assert.equal(roleRegistry.invariants.registry_grants_runtime_permission, false);
assert.equal(
  roleRegistry.invariants.security_boundaries_are_derived_from_role_registry,
  false,
);
assert.equal(
  roleRegistry.invariants.shared_neural_routing_family_is_authority_role,
  false,
);
assert.equal(
  roleRegistry.invariants.formal_native_loop_accepts_neural_adapter,
  false,
);
assert.equal(
  roleRegistry.invariants.formal_native_loop_neural_extension_has_authority,
  false,
);

const runtimeUnion = new Set([
  ...characterRuntime.capabilities,
  ...engineRuntime.capabilities,
]);
assert.equal(runtimeUnion.size, worldSimulationCapabilityNames.length);
for (const capabilityName of worldSimulationCapabilityNames) {
  assert(runtimeUnion.has(capabilityName));
  assert.equal(isWorldSimulationCapabilityRoleRegistered(capabilityName), true);

  const role = getWorldSimulationCapabilityRole(capabilityName);
  const expected = expectedRoles[capabilityName];
  assert(expected, `Missing expected role fixture for ${capabilityName}`);

  for (const field of [
    "semantic_family",
    "trusted_runtime_role",
    "neural_extension_role",
    "r1_mediation_group",
    "adapter_audience_class",
    "shared_neural_routing_family",
  ]) {
    assert.equal(role[field], expected[field], `${capabilityName}.${field}`);
  }
  assert.equal(role.native_loop.stage, expected.native_stage);
  assert.equal(role.native_loop.scope, expected.native_scope);
  assert.equal(
    role.native_loop.trusted_output_effect,
    expected.trusted_output_effect,
  );
  assert.equal(
    role.native_loop.formal_mainline_neural_extension_effect,
    false,
  );

  assert.equal(
    role.authority.neural_extension_enters_causal_adjudication,
    false,
  );
  assert.equal(
    role.authority.neural_extension_enters_character_brain,
    false,
  );
  assert.equal(role.authority.neural_extension_controls_commit_gate, false);
  assert.equal(role.authority.neural_extension_is_security_policy, false);

  const policy = policyRegistry.capabilities[capabilityName];
  const sharedFamily =
    sharedCore.modes[neuralSessionModes.WORLD_SIMULATION]
      .capabilities[capabilityName];
  assert.equal(sharedFamily, role.shared_neural_routing_family);

  if (role.r1_mediation_group === "character_facing") {
    assert.equal(isWorldSimulationCharacterFacingCapability(capabilityName), true);
    assert.equal(isWorldSimulationEngineIntegrityCapability(capabilityName), false);
    assert(characterRuntime.capabilities.includes(capabilityName));
    assert.equal(policy.trust_domain, "character_facing");
  } else {
    assert.equal(isWorldSimulationEngineIntegrityCapability(capabilityName), true);
    assert.equal(isWorldSimulationCharacterFacingCapability(capabilityName), false);
    assert(engineRuntime.capabilities.includes(capabilityName));
    assert.notEqual(policy.trust_domain, "character_facing");
  }

  const legacyToolName = `chatgpt_bridge_use_${capabilityName}`;
  assert(worldSimulationLegacyCapabilityToolNames.includes(legacyToolName));
  assert(worldSimulationFormalPublicBlockedTools.includes(legacyToolName));
  assert.equal(role.individual_mcp_transport, "full_debug_only");
}

const scene = getWorldSimulationCapabilityRole("world_scene_causal_analyzer");
assert.equal(scene.authority.trusted_output_enters_causal_adjudication, true);
assert.equal(scene.authority.trusted_output_controls_commit_gate, false);

const memory = getWorldSimulationCapabilityRole("world_memory_retriever");
assert.equal(memory.compatibility_status, "legacy_direct_debug_compatibility");
assert.equal(memory.capability_identity_status, "legacy_name_retained");
assert.equal(memory.authority.trusted_output_enters_character_brain, false);
assert.equal(memory.authority.trusted_output_is_compatibility_only, true);

const action = getWorldSimulationCapabilityRole("world_action_proposer");
assert.equal(
  action.neural_extension_role,
  "action_candidate_consideration_ordering",
);
assert.equal(action.authority.trusted_output_enters_character_brain, true);

const agency = getWorldSimulationCapabilityRole("world_agency_guard");
assert.equal(agency.native_loop.invoked, false);
assert.equal(agency.authority.neural_extension_is_security_policy, false);

const consistency = getWorldSimulationCapabilityRole("world_consistency_critic");
assert.equal(consistency.authority.trusted_output_controls_commit_gate, true);
assert.equal(consistency.authority.neural_extension_controls_commit_gate, false);

assert.throws(
  () => getWorldSimulationCapabilityRole("world_nonexistent_capability"),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_ROLE_NOT_FOUND",
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase62A-R2 Step 1",
  role_registry_version: worldSimulationCapabilityRoleRegistryVersion,
  capability_count: worldSimulationCapabilityRoleNames.length,
  role_registry_grants_runtime_permission: false,
  security_lists_remain_independent: true,
  formal_native_loop_accepts_neural_adapter: false,
  capability_identities_renamed: false,
}));
console.log("Phase62A-R2 capability role normalization test passed.");
