export const worldSimulationCapabilityRoleRegistryVersion =
  "phase62a-r2-capability-role-registry-v1";

export const worldSimulationCapabilityRoleAxes = Object.freeze({
  semantic_family: Object.freeze([
    "scene_causality",
    "perception",
    "memory_context",
    "character_cognition",
    "action_candidates",
    "agency_governance",
    "consistency",
  ]),
  r1_mediation_group: Object.freeze([
    "character_facing",
    "engine_integrity",
  ]),
  adapter_audience_class: Object.freeze([
    "character_scoped",
    "engine_only",
    "diagnostic_scoped",
  ]),
  native_loop_stage: Object.freeze([
    "prepare",
    "resolve",
    "not_invoked",
  ]),
  native_loop_scope: Object.freeze([
    "per_character",
    "per_turn",
    "not_applicable",
  ]),
  compatibility_status: Object.freeze([
    "current",
    "legacy_direct_debug_compatibility",
  ]),
  capability_identity_status: Object.freeze([
    "current",
    "legacy_name_retained",
  ]),
});

function freezeRole(entry) {
  return Object.freeze({
    ...entry,
    native_loop: Object.freeze({ ...entry.native_loop }),
    authority: Object.freeze({ ...entry.authority }),
  });
}

const noNeuralFormalAuthority = Object.freeze({
  neural_extension_enters_causal_adjudication: false,
  neural_extension_enters_character_brain: false,
  neural_extension_controls_commit_gate: false,
  neural_extension_is_security_policy: false,
});

const roles = Object.freeze({
  world_scene_causal_analyzer: freezeRole({
    semantic_family: "scene_causality",
    trusted_runtime_role: "scene_causal_input_normalization",
    neural_extension_role: "scene_interpretive_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "engine_only",
    shared_neural_routing_family: "scene_analysis",
    native_loop: {
      invoked: true,
      stage: "prepare",
      scope: "per_turn",
      trusted_output_effect: "causal_adjudication_input",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: true,
      trusted_output_enters_character_brain: false,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),

  world_perception_filter: freezeRole({
    semantic_family: "perception",
    trusted_runtime_role: "bounded_perception_construction",
    neural_extension_role: "perception_attention_annotation",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "perception",
    native_loop: {
      invoked: true,
      stage: "prepare",
      scope: "per_character",
      trusted_output_effect: "character_brain_perception_context",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: true,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),

  world_memory_retriever: freezeRole({
    semantic_family: "memory_context",
    trusted_runtime_role: "legacy_memory_context_projection",
    neural_extension_role: "memory_projection_selection_ordering",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "memory_retrieval",
    native_loop: {
      invoked: true,
      stage: "prepare",
      scope: "per_character",
      trusted_output_effect: "engine_only_compatibility_sidecar",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: false,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: true,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "legacy_direct_debug_compatibility",
    capability_identity_status: "legacy_name_retained",
    individual_mcp_transport: "full_debug_only",
  }),

  world_character_cognition: freezeRole({
    semantic_family: "character_cognition",
    trusted_runtime_role: "bounded_cognition_assembly",
    neural_extension_role: "subjective_cognition_extension",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "character_cognition",
    native_loop: {
      invoked: true,
      stage: "prepare",
      scope: "per_character",
      trusted_output_effect: "character_brain_cognition_context",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: true,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),

  world_action_proposer: freezeRole({
    semantic_family: "action_candidates",
    trusted_runtime_role: "action_candidate_catalog_construction",
    neural_extension_role: "action_candidate_consideration_ordering",
    r1_mediation_group: "character_facing",
    adapter_audience_class: "character_scoped",
    shared_neural_routing_family: "action_proposal",
    native_loop: {
      invoked: true,
      stage: "prepare",
      scope: "per_character",
      trusted_output_effect: "character_brain_candidate_catalog",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: true,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),

  world_agency_guard: freezeRole({
    semantic_family: "agency_governance",
    trusted_runtime_role: "narrative_control_signal_detection",
    neural_extension_role: "agency_signal_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "diagnostic_scoped",
    shared_neural_routing_family: "agency_governance",
    native_loop: {
      invoked: false,
      stage: "not_invoked",
      scope: "not_applicable",
      trusted_output_effect: "not_invoked_by_formal_loop",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: false,
      trusted_output_controls_commit_gate: false,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),

  world_consistency_critic: freezeRole({
    semantic_family: "consistency",
    trusted_runtime_role: "hard_consistency_gate_evaluation",
    neural_extension_role: "consistency_review_advisory",
    r1_mediation_group: "engine_integrity",
    adapter_audience_class: "engine_only",
    shared_neural_routing_family: "consistency_critique",
    native_loop: {
      invoked: true,
      stage: "resolve",
      scope: "per_turn",
      trusted_output_effect: "commit_gate",
      formal_mainline_neural_extension_effect: false,
    },
    authority: {
      trusted_output_enters_causal_adjudication: false,
      trusted_output_enters_character_brain: false,
      trusted_output_controls_commit_gate: true,
      trusted_output_is_compatibility_only: false,
      ...noNeuralFormalAuthority,
    },
    compatibility_status: "current",
    capability_identity_status: "current",
    individual_mcp_transport: "full_debug_only",
  }),
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export const worldSimulationCapabilityRoleNames = Object.freeze(
  Object.keys(roles),
);

export function isWorldSimulationCapabilityRoleRegistered(capabilityName) {
  return Object.hasOwn(roles, String(capabilityName ?? "").trim());
}

export function getWorldSimulationCapabilityRole(capabilityName) {
  const name = String(capabilityName ?? "").trim();
  if (!isWorldSimulationCapabilityRoleRegistered(name)) {
    const error = new Error(
      `No Phase62A-R2 capability role is registered for ${name || "<missing>"}.`,
    );
    error.code = "WORLD_SIMULATION_CAPABILITY_ROLE_NOT_FOUND";
    throw error;
  }
  return cloneJson({
    capability_name: name,
    ...roles[name],
  });
}

export function buildWorldSimulationCapabilityRoleRegistry() {
  return cloneJson({
    registry_version: worldSimulationCapabilityRoleRegistryVersion,
    role_axes: worldSimulationCapabilityRoleAxes,
    capabilities: roles,
    invariants: {
      registry_grants_runtime_permission: false,
      security_boundaries_are_derived_from_role_registry: false,
      shared_neural_routing_family_is_authority_role: false,
      formal_public_exposes_individual_capability_tools: false,
      formal_native_loop_accepts_neural_adapter: false,
      formal_native_loop_neural_extension_has_authority: false,
      capability_identity_renamed_by_r2: false,
      r1_security_semantics_changed_by_r2: false,
    },
  });
}
