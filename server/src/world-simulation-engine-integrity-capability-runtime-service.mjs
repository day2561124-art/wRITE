import {
  compileWorldSimulationCapabilityEnvelope,
  resolveWorldSimulationCapabilityNeuralExtension,
  verifyWorldSimulationCapabilityAdapterEnvelope,
  worldSimulationCapabilityAssuranceModes,
  worldSimulationCapabilityEnvelopeVersion,
  worldSimulationCapabilityPolicyVersion,
} from "./world-simulation-capability-envelope-service.mjs";

export const worldSimulationEngineIntegrityRuntimeVersion =
  "phase62a-r1-engine-integrity-runtime-v1";

export const worldSimulationEngineIntegrityAssuranceModes =
  worldSimulationCapabilityAssuranceModes;

const engineIntegrityCapabilities = Object.freeze([
  "world_scene_causal_analyzer",
  "world_agency_guard",
  "world_consistency_critic",
]);

const engineIntegrityCapabilitySet = new Set(engineIntegrityCapabilities);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function subjectFor(capabilityName, input, trustedBase) {
  if (capabilityName !== "world_agency_guard") return null;
  const character = text(
    trustedBase?.character
      ?? input?.character
      ?? input?.character_name,
  );
  return character ? { character } : null;
}

function protectedBaseFor(capabilityName, input, trustedBase) {
  switch (capabilityName) {
    case "world_scene_causal_analyzer":
      return cloneJson({
        scene_identity: trustedBase.scene_identity ?? {},
        spatial_state: trustedBase.spatial_state ?? {},
        interaction_constraints: trustedBase.interaction_constraints ?? [],
        simultaneous_actions: trustedBase.simultaneous_actions ?? [],
        adjudication_inputs: trustedBase.adjudication_inputs ?? [],
        outcome_boundary: trustedBase.outcome_boundary ?? null,
      });

    case "world_agency_guard":
      return cloneJson({
        character: trustedBase.character ?? null,
        decision_request: object(input.decision_request ?? input),
        camera_context: object(input.camera_context),
        programmatic_findings: trustedBase.findings ?? [],
        agency_boundary: trustedBase.agency_boundary ?? {},
      });

    case "world_consistency_critic":
      return cloneJson({
        review_input: {
          state_transitions: input.state_transitions ?? [],
          object_holders: input.object_holders ?? [],
          knowledge_transitions: input.knowledge_transitions ?? [],
          action_outcomes: input.action_outcomes ?? [],
        },
        programmatic_findings: trustedBase.findings ?? [],
        hard_conflict_count: trustedBase.hard_conflict_count ?? 0,
        consistency_boundary: trustedBase.consistency_boundary ?? {},
      });

    default:
      throw new Error(
        `Unsupported engine-integrity capability: ${capabilityName}`,
      );
  }
}

function trustedExecutionView(capabilityName, trustedBase) {
  if (capabilityName !== "world_scene_causal_analyzer") return null;
  return cloneJson({
    result_type: trustedBase.result_type ?? "world_scene_causal_analysis",
    analysis_status: trustedBase.analysis_status ?? null,
    simulation_time: trustedBase.simulation_time ?? null,
    scene_identity: trustedBase.scene_identity ?? {},
    spatial_state: trustedBase.spatial_state ?? {},
    interaction_constraints: trustedBase.interaction_constraints ?? [],
    simultaneous_actions: trustedBase.simultaneous_actions ?? [],
    adjudication_inputs: trustedBase.adjudication_inputs ?? [],
    outcome_boundary: trustedBase.outcome_boundary ?? null,
  });
}

function commitGateView(capabilityName, trustedBase) {
  if (capabilityName !== "world_consistency_critic") return null;
  return cloneJson({
    findings: trustedBase.findings ?? [],
    hard_conflict_count: trustedBase.hard_conflict_count ?? 0,
    consistency_boundary: trustedBase.consistency_boundary ?? {},
  });
}

function policyDiagnosticView(capabilityName, trustedBase) {
  if (capabilityName !== "world_agency_guard") return null;
  return cloneJson({
    character: trustedBase.character ?? null,
    findings: trustedBase.findings ?? [],
    agency_boundary: trustedBase.agency_boundary ?? {},
  });
}

export function isWorldSimulationEngineIntegrityCapability(capabilityName) {
  return engineIntegrityCapabilitySet.has(
    String(capabilityName ?? "").trim(),
  );
}

export function buildWorldSimulationEngineIntegrityRuntimeContract() {
  return {
    version: worldSimulationEngineIntegrityRuntimeVersion,
    envelope_version: worldSimulationCapabilityEnvelopeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    capabilities: [...engineIntegrityCapabilities],
    trusted_builder_executes_before_neural_adapter: true,
    neural_adapter_returns_advisory_extension_only: true,
    scene_neural_advisory_is_causal_input: false,
    consistency_neural_advisory_is_commit_gate: false,
    consistency_neural_advisory_can_unblock_programmatic_conflict: false,
    consistency_neural_advisory_can_create_hard_block: false,
    agency_neural_advisory_is_security_policy: false,
    canonical_envelope_verified_before_adapter: true,
    adapter_receives_detached_envelope_copy: true,
    native_invalid_extension_falls_back_to_trusted_base: true,
    direct_invalid_extension_throws: true,
  };
}

export function prepareWorldSimulationEngineIntegrityCapabilityRuntime({
  capability_name: capabilityName,
  input = {},
  trusted_base: trustedBase = {},
  assurance_mode: assuranceMode,
  invocation_id: invocationId,
} = {}) {
  if (!isWorldSimulationEngineIntegrityCapability(capabilityName)) {
    throw new Error(
      `Capability ${capabilityName} is not an engine-integrity capability.`,
    );
  }

  const compiled = compileWorldSimulationCapabilityEnvelope({
    capability_name: capabilityName,
    invocation_id: invocationId,
    subject: subjectFor(capabilityName, input, trustedBase),
    protected_base: protectedBaseFor(capabilityName, input, trustedBase),
    source_channels: [],
  }, {
    assurance_mode: assuranceMode,
  });

  verifyWorldSimulationCapabilityAdapterEnvelope(
    compiled.adapter_envelope,
    {
      capability_name: capabilityName,
      require_compiler_attestation: true,
    },
  );

  return {
    version: worldSimulationEngineIntegrityRuntimeVersion,
    capability_name: capabilityName,
    assurance_mode: assuranceMode,
    raw_input: cloneJson(input),
    trusted_base: cloneJson(trustedBase),
    adapter_envelope: compiled.adapter_envelope,
    trusted_materialization_context:
      compiled.trusted_materialization_context,
  };
}

export function finalizeWorldSimulationEngineIntegrityCapabilityRuntime({
  prepared,
  neural_extension: neuralExtension,
  adapter_invoked: adapterInvoked = false,
  adapter_failure: adapterFailure = null,
  failure_mode: failureMode = "direct_explicit",
} = {}) {
  if (!isObject(prepared)
    || !isWorldSimulationEngineIntegrityCapability(
      prepared.capability_name,
    )) {
    throw new Error(
      "Prepared engine-integrity capability runtime is invalid.",
    );
  }

  verifyWorldSimulationCapabilityAdapterEnvelope(
    prepared.adapter_envelope,
    {
      capability_name: prepared.capability_name,
      require_compiler_attestation: true,
    },
  );

  let resolution = {
    accepted: false,
    fallback_to_trusted_base: false,
    validation: null,
    violation: null,
  };

  if (adapterFailure) {
    if (failureMode !== "native_optional") {
      const error = new Error(
        adapterFailure.message
          ?? "Engine-integrity neural adapter failed.",
      );
      if (adapterFailure.code) error.code = adapterFailure.code;
      throw error;
    }
    resolution = {
      accepted: false,
      fallback_to_trusted_base: true,
      validation: null,
      violation: cloneJson(adapterFailure),
    };
  } else if (adapterInvoked) {
    resolution = resolveWorldSimulationCapabilityNeuralExtension({
      envelope: prepared.adapter_envelope,
      extension: neuralExtension,
      failure_mode: failureMode,
    });
  }

  const trustedBase = cloneJson(prepared.trusted_base);
  const output = {
    ...trustedBase,
  };

  if (resolution.accepted) {
    output.neural_advisory =
      cloneJson(resolution.validation.extension);
  }

  const executionView =
    trustedExecutionView(prepared.capability_name, trustedBase);
  if (executionView) {
    output.trusted_execution_view = executionView;
  }

  const gateView =
    commitGateView(prepared.capability_name, trustedBase);
  if (gateView) {
    output.commit_gate_view = gateView;
  }

  const diagnosticView =
    policyDiagnosticView(prepared.capability_name, trustedBase);
  if (diagnosticView) {
    output.policy_diagnostic_view = diagnosticView;
  }

  output.r1_engine_integrity = {
    version: worldSimulationEngineIntegrityRuntimeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    envelope_version: worldSimulationCapabilityEnvelopeVersion,
    envelope_id: prepared.adapter_envelope.envelope_id,
    envelope_hash: prepared.adapter_envelope.envelope_hash,
    assurance_mode: prepared.assurance_mode,
    adapter_invoked: adapterInvoked,
    neural_extension_accepted: resolution.accepted,
    fallback_to_trusted_base: resolution.fallback_to_trusted_base,
    violation: cloneJson(resolution.violation),
    trusted_base_is_authoritative: true,
    neural_advisory_is_authoritative: false,
    scene_neural_advisory_is_causal_input: false,
    consistency_neural_advisory_is_commit_gate: false,
    agency_neural_advisory_is_security_policy: false,
  };

  return {
    output,
    audit: {
      adapter_invoked: adapterInvoked,
      neural_extension_accepted: resolution.accepted,
      fallback_to_trusted_base: resolution.fallback_to_trusted_base,
      violation: cloneJson(resolution.violation),
    },
  };
}
