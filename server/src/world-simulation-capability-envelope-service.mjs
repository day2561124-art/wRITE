import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationCapabilityPolicyVersion =
  "phase62a-r1-capability-policy-v1";

export const worldSimulationCapabilityEnvelopeVersion =
  "phase62a-r1-capability-envelope-v1";

export const worldSimulationCapabilityAssuranceModes = Object.freeze({
  NATIVE_ENGINE_VERIFIED: "native_engine_verified",
  DIRECT_CALLER_ASSERTED: "direct_caller_asserted",
});

export const worldSimulationCapabilityClaimDomains = Object.freeze([
  "engine_metadata",
  "world_state",
  "perception",
  "character_subjective_state",
  "memory_recovery",
  "memory_projection",
  "action_candidate",
  "narrative_control",
  "diagnostic",
  "neural_subjective",
  "neural_advisory",
]);

export const worldSimulationCapabilityAssuranceOrigins = Object.freeze([
  "engine_persisted",
  "programmatic_derived",
  "caller_asserted",
  "neural_derived",
]);

const assuranceModeValues = Object.freeze(
  Object.values(worldSimulationCapabilityAssuranceModes),
);

const claimDomainValues = new Set(worldSimulationCapabilityClaimDomains);
const assuranceOriginValues = new Set(worldSimulationCapabilityAssuranceOrigins);

const characterFacingForbiddenInputKeys = new Set([
  "world_state",
  "raw_world_state",
  "scene_state",
  "raw_scene_state",
  "character_state",
  "full_character_state",
  "simulation_time",
  "scene_id",
  "engine_metadata",
  "all_characters",
  "all_memories",
  "unaccessed_memories",
]);

const neuralGovernanceForbiddenKeys = new Set([
  "audience",
  "intended_audience",
  "assurance_mode",
  "assurance_origin",
  "claim_domain",
  "provenance",
  "provenance_manifest",
  "policy_version",
  "trust_domain",
  "protected_base",
  "protected_result",
  "engine_metadata",
  "world_state",
  "raw_world_state",
  "scene_state",
  "raw_scene_state",
]);

const policies = Object.freeze({
  world_scene_causal_analyzer: Object.freeze({
    trust_domain: "engine_facing",
    subject_rule: "none",
    purpose: "engine_scene_interpretation",
    output_pattern: "protected_base_plus_advisory_extension",
    allowed_claim_domains: Object.freeze([
      "engine_metadata",
      "world_state",
      "diagnostic",
    ]),
    protected_result_channels: Object.freeze([
      "scene_identity",
      "spatial_state",
      "interaction_constraints",
      "simultaneous_actions",
      "adjudication_inputs",
      "outcome_boundary",
    ]),
    neural_extension_fields: Object.freeze([
      "advisory_findings",
      "interpretive_annotations",
    ]),
    reference_fields: Object.freeze([]),
  }),

  world_perception_filter: Object.freeze({
    trust_domain: "character_facing",
    subject_rule: "required_character",
    purpose: "current_turn_subjective_perception",
    output_pattern: "authorized_source_refs_plus_annotations",
    allowed_claim_domains: Object.freeze([
      "perception",
      "character_subjective_state",
    ]),
    protected_result_channels: Object.freeze([
      "observed",
      "audible",
      "other_senses",
    ]),
    neural_extension_fields: Object.freeze([
      "attended_observation_refs",
      "salience_annotations",
      "ambiguity_annotations",
    ]),
    reference_fields: Object.freeze([
      "attended_observation_refs",
    ]),
  }),

  world_memory_retriever: Object.freeze({
    trust_domain: "character_facing",
    subject_rule: "required_character",
    purpose: "legacy_memory_projection_compatibility",
    output_pattern: "authorized_source_ref_selection",
    allowed_claim_domains: Object.freeze([
      "memory_projection",
      "character_subjective_state",
    ]),
    protected_result_channels: Object.freeze([
      "projected_memories",
      "retrieved_memories",
      "memory_boundary",
    ]),
    neural_extension_fields: Object.freeze([
      "selected_memory_refs",
      "ordered_memory_refs",
    ]),
    reference_fields: Object.freeze([
      "selected_memory_refs",
      "ordered_memory_refs",
    ]),
  }),

  world_character_cognition: Object.freeze({
    trust_domain: "character_facing",
    subject_rule: "required_character",
    purpose: "current_turn_character_cognition",
    output_pattern: "protected_base_plus_subjective_extension",
    allowed_claim_domains: Object.freeze([
      "perception",
      "character_subjective_state",
      "memory_recovery",
      "action_candidate",
    ]),
    protected_result_channels: Object.freeze([
      "character",
      "perception",
      "recovered_memories",
      "retrieval_experience",
      "known",
      "uncertain",
      "needs",
      "emotion",
      "attention",
      "goals",
      "values",
      "relationship_cognition",
      "current_action",
    ]),
    neural_extension_fields: Object.freeze([
      "subjective_inferences",
      "salience",
      "deliberative_pressures",
      "proposed_attention_shift",
    ]),
    reference_fields: Object.freeze([]),
  }),

  world_action_proposer: Object.freeze({
    trust_domain: "character_facing",
    subject_rule: "required_character",
    purpose: "current_turn_action_candidate_consideration",
    output_pattern: "protected_action_catalog_plus_ref_ordering",
    allowed_claim_domains: Object.freeze([
      "action_candidate",
      "character_subjective_state",
    ]),
    protected_result_channels: Object.freeze([
      "candidate_action_intents",
      "selection_boundary",
      "outcome_boundary",
    ]),
    neural_extension_fields: Object.freeze([
      "considered_action_refs",
      "ordered_action_refs",
      "deprioritized_action_refs",
    ]),
    reference_fields: Object.freeze([
      "considered_action_refs",
      "ordered_action_refs",
      "deprioritized_action_refs",
    ]),
  }),

  world_agency_guard: Object.freeze({
    trust_domain: "diagnostic",
    subject_rule: "optional_character",
    purpose: "narrative_control_signal_diagnosis",
    output_pattern: "programmatic_findings_plus_advisory_extension",
    allowed_claim_domains: Object.freeze([
      "narrative_control",
      "diagnostic",
    ]),
    protected_result_channels: Object.freeze([
      "findings",
      "agency_boundary",
    ]),
    neural_extension_fields: Object.freeze([
      "advisory_findings",
    ]),
    reference_fields: Object.freeze([]),
  }),

  world_consistency_critic: Object.freeze({
    trust_domain: "engine_facing_diagnostic",
    subject_rule: "none",
    purpose: "world_consistency_review",
    output_pattern: "programmatic_hard_findings_plus_advisory_extension",
    allowed_claim_domains: Object.freeze([
      "world_state",
      "engine_metadata",
      "diagnostic",
    ]),
    protected_result_channels: Object.freeze([
      "findings",
      "hard_conflict_count",
      "consistency_boundary",
    ]),
    neural_extension_fields: Object.freeze([
      "advisory_findings",
    ]),
    reference_fields: Object.freeze([]),
  }),
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function errorWithCode(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, cloneJson(details));
  return error;
}

function assertPolicy(capabilityName) {
  const name = nonEmptyString(capabilityName);
  const policy = name ? policies[name] : null;
  if (!policy) {
    throw errorWithCode(
      `No Phase62A-R1 capability policy is registered for ${name ?? "<missing>"}.`,
      "WORLD_SIMULATION_CAPABILITY_POLICY_NOT_FOUND",
      { capability_name: name },
    );
  }
  return { name, policy };
}

function assertAssuranceMode(value) {
  const mode = nonEmptyString(value);
  if (!assuranceModeValues.includes(mode)) {
    throw errorWithCode(
      `Capability assurance mode must be one of: ${assuranceModeValues.join(", ")}.`,
      "WORLD_SIMULATION_CAPABILITY_POLICY_VERSION_MISMATCH",
      { assurance_mode: mode },
    );
  }
  return mode;
}

function assertSubject(policy, subject) {
  const character = nonEmptyString(object(subject).character ?? subject);
  if (policy.subject_rule === "required_character" && !character) {
    throw errorWithCode(
      "This character-facing capability requires one explicit character subject.",
      "WORLD_SIMULATION_CAPABILITY_SUBJECT_REQUIRED",
    );
  }
  return character;
}

function intendedAudience(policy, character) {
  if (policy.trust_domain === "character_facing") {
    return Object.freeze(["engine", `character:${character}`]);
  }
  if (policy.trust_domain === "diagnostic") {
    return Object.freeze(["engine", "diagnostic:agency_guard"]);
  }
  return Object.freeze(["engine"]);
}

function collectForbiddenKeys(
  value,
  forbidden,
  path = [],
  output = [],
  seen = new Set(),
) {
  if (!value || typeof value !== "object") return output;
  if (seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(
      item,
      forbidden,
      [...path, String(index)],
      output,
      seen,
    ));
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = String(key).trim();
    if (forbidden.has(normalized)) output.push([...path, key].join("."));
    collectForbiddenKeys(item, forbidden, [...path, key], output, seen);
  }
  return output;
}

function assertCharacterFacingDisclosure(policy, protectedBase, sourceChannels) {
  if (policy.trust_domain !== "character_facing") return;
  const protectedMatches = collectForbiddenKeys(
    protectedBase,
    characterFacingForbiddenInputKeys,
  );
  const sourceMatches = sourceChannels.flatMap((source, index) => (
    collectForbiddenKeys(
      source.payload,
      characterFacingForbiddenInputKeys,
    ).map((path) => `source_channels.${index}.payload.${path}`)
  ));
  const matches = [...protectedMatches, ...sourceMatches];
  if (matches.length) {
    throw errorWithCode(
      `Character-facing capability envelope contains engine-only fields: ${matches.slice(0, 8).join(", ")}.`,
      "WORLD_SIMULATION_CAPABILITY_SOURCE_DISCLOSURE_FORBIDDEN",
      { forbidden_paths: matches },
    );
  }
}

function normalizeSourceChannel(raw, index, policy, character, assuranceMode) {
  if (!isObject(raw)) {
    throw errorWithCode(
      `source_channels[${index}] must be an object.`,
      "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
    );
  }
  const sourceRef = nonEmptyString(raw.source_ref ?? raw.ref);
  if (!sourceRef) {
    throw errorWithCode(
      `source_channels[${index}].source_ref is required.`,
      "WORLD_SIMULATION_CAPABILITY_MATERIALIZATION_FAILED",
    );
  }
  const channel = nonEmptyString(raw.channel) ?? "authorized_source";
  const claimDomain = nonEmptyString(raw.claim_domain);
  if (!claimDomainValues.has(claimDomain)) {
    throw errorWithCode(
      `source_channels[${index}].claim_domain is invalid.`,
      "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
      { claim_domain: claimDomain },
    );
  }
  if (!policy.allowed_claim_domains.includes(claimDomain)) {
    throw errorWithCode(
      `Source ${sourceRef} claim domain ${claimDomain} is not permitted for this capability.`,
      "WORLD_SIMULATION_CAPABILITY_SOURCE_DISCLOSURE_FORBIDDEN",
      { source_ref: sourceRef, claim_domain: claimDomain },
    );
  }

  const claimedOrigin = nonEmptyString(raw.assurance_origin) ?? "caller_asserted";
  if (!assuranceOriginValues.has(claimedOrigin)) {
    throw errorWithCode(
      `source_channels[${index}].assurance_origin is invalid.`,
      "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
      { assurance_origin: claimedOrigin },
    );
  }
  const effectiveOrigin = assuranceMode
    === worldSimulationCapabilityAssuranceModes.DIRECT_CALLER_ASSERTED
    ? "caller_asserted"
    : claimedOrigin;

  const sourceAudience = [...new Set(
    array(raw.audience)
      .map(nonEmptyString)
      .filter(Boolean),
  )];
  const requiredAudience = policy.trust_domain === "character_facing"
    ? `character:${character}`
    : policy.trust_domain === "diagnostic"
      ? "diagnostic:agency_guard"
      : "engine";
  const disclosed = sourceAudience.includes(requiredAudience)
    || sourceAudience.includes("shared_public")
    || (policy.trust_domain !== "character_facing" && sourceAudience.includes("engine"));
  if (!disclosed) {
    throw errorWithCode(
      `Source ${sourceRef} is not authorized for ${requiredAudience}.`,
      "WORLD_SIMULATION_CAPABILITY_SOURCE_DISCLOSURE_FORBIDDEN",
      {
        source_ref: sourceRef,
        source_audience: sourceAudience,
        required_audience: requiredAudience,
      },
    );
  }

  return {
    source_ref: sourceRef,
    channel,
    claim_domain: claimDomain,
    assurance_origin: effectiveOrigin,
    claimed_assurance_origin: claimedOrigin,
    audience: sourceAudience,
    payload: cloneJson(raw.payload),
    producer: nonEmptyString(raw.producer),
  };
}

function normalizedSourceChannels(rawSources, policy, character, assuranceMode) {
  const sources = array(rawSources).map((raw, index) => (
    normalizeSourceChannel(raw, index, policy, character, assuranceMode)
  ));
  const refs = new Set();
  for (const source of sources) {
    if (refs.has(source.source_ref)) {
      throw errorWithCode(
        `Duplicate source_ref ${source.source_ref} in one capability envelope.`,
        "WORLD_SIMULATION_CAPABILITY_MATERIALIZATION_FAILED",
        { source_ref: source.source_ref },
      );
    }
    refs.add(source.source_ref);
  }
  return sources;
}

function buildEnvelopeIdentity({
  capabilityName,
  invocationId,
  assuranceMode,
  character,
  protectedBase,
  sources,
}) {
  const identityHash = hashAgentRunValue({
    version: worldSimulationCapabilityEnvelopeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    capability_name: capabilityName,
    invocation_id: invocationId,
    assurance_mode: assuranceMode,
    character,
    protected_base: protectedBase,
    sources: sources.map((source) => ({
      source_ref: source.source_ref,
      channel: source.channel,
      claim_domain: source.claim_domain,
      assurance_origin: source.assurance_origin,
      audience: source.audience,
      payload: source.payload,
      producer: source.producer,
    })),
  });
  return `capenv_${identityHash.slice(0, 28)}`;
}

function scopedAdapterRef(envelopeId, sourceRef) {
  return `envsrc_${hashAgentRunValue({
    version: worldSimulationCapabilityEnvelopeVersion,
    envelope_id: envelopeId,
    source_ref: sourceRef,
  }).slice(0, 28)}`;
}

function adapterSources(envelopeId, sources) {
  return sources.map((source) => ({
    source_ref: scopedAdapterRef(envelopeId, source.source_ref),
    channel: source.channel,
    content: cloneJson(source.payload),
  }));
}

function materializationCatalog(envelopeId, sources) {
  return Object.fromEntries(sources.map((source) => {
    const adapterRef = scopedAdapterRef(envelopeId, source.source_ref);
    return [adapterRef, {
      adapter_source_ref: adapterRef,
      source_ref: source.source_ref,
      channel: source.channel,
      claim_domain: source.claim_domain,
      assurance_origin: source.assurance_origin,
      audience: cloneJson(source.audience),
      payload: cloneJson(source.payload),
      producer: source.producer,
    }];
  }));
}

export function buildWorldSimulationCapabilityPolicyRegistry() {
  return cloneJson({
    registry_version: worldSimulationCapabilityPolicyVersion,
    envelope_version: worldSimulationCapabilityEnvelopeVersion,
    assurance_modes: assuranceModeValues,
    claim_domains: worldSimulationCapabilityClaimDomains,
    assurance_origins: worldSimulationCapabilityAssuranceOrigins,
    capabilities: policies,
    invariants: {
      neural_model_decides_disclosure: false,
      payload_may_self_promote_assurance: false,
      neural_may_expand_audience: false,
      neural_may_raise_assurance: false,
      neural_may_modify_protected_base: false,
      engine_provenance_exposed_to_adapter: false,
      source_refs_are_invocation_scoped: true,
    },
  });
}

export function buildWorldSimulationCapabilityEnvelopeContract() {
  return {
    version: worldSimulationCapabilityEnvelopeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    architecture: "trusted_preparer_to_least_privilege_adapter_envelope_to_validated_neural_extension_to_trusted_materializer",
    disclosure_and_authority_are_separate: true,
    adapter_can_read_protected_base_but_cannot_rewrite_it: true,
    character_facing_raw_world_state_exposed: false,
    character_facing_raw_scene_state_exposed: false,
    character_facing_full_character_state_exposed: false,
    engine_exact_simulation_time_is_not_character_knowledge: true,
    engine_scene_id_is_not_character_knowledge: true,
    direct_caller_assertion_is_not_engine_verification: true,
    engine_provenance_is_not_subjective_source_attribution: true,
    source_grounded_materialization_requires_envelope_scoped_ref: true,
  };
}

export function compileWorldSimulationCapabilityEnvelope(
  input = {},
  execution = {},
) {
  if (Object.hasOwn(object(input), "assurance_mode")) {
    throw errorWithCode(
      "Capability payload may not self-declare its assurance mode.",
      "WORLD_SIMULATION_CAPABILITY_ASSURANCE_ESCALATION_FORBIDDEN",
    );
  }
  const { name: capabilityName, policy } = assertPolicy(input.capability_name);
  const assuranceMode = assertAssuranceMode(execution.assurance_mode);
  const invocationId = nonEmptyString(input.invocation_id);
  if (!invocationId) {
    throw errorWithCode(
      "Capability invocation_id is required for deterministic envelope scoping.",
      "WORLD_SIMULATION_CAPABILITY_MATERIALIZATION_FAILED",
    );
  }
  const character = assertSubject(policy, input.subject);
  const protectedBase = cloneJson(object(input.protected_base));
  const sources = normalizedSourceChannels(
    input.source_channels,
    policy,
    character,
    assuranceMode,
  );
  assertCharacterFacingDisclosure(policy, protectedBase, sources);

  const envelopeId = buildEnvelopeIdentity({
    capabilityName,
    invocationId,
    assuranceMode,
    character,
    protectedBase,
    sources,
  });
  const intended = intendedAudience(policy, character);
  const exposedSources = adapterSources(envelopeId, sources);
  const sourceRefs = exposedSources.map((source) => source.source_ref);

  const adapterEnvelopeBase = {
    schema_version: worldSimulationCapabilityEnvelopeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    envelope_id: envelopeId,
    capability_name: capabilityName,
    invocation_id: invocationId,
    trust_domain: policy.trust_domain,
    purpose: policy.purpose,
    subject: character ? { character } : null,
    intended_audience: intended,
    authorized_inputs: {
      protected_base: protectedBase,
      sources: exposedSources,
    },
    authorized_source_refs: sourceRefs,
    neural_extension_contract: {
      allowed_fields: [...policy.neural_extension_fields],
      reference_fields: [...policy.reference_fields],
      neural_may_modify_protected_base: false,
      neural_may_expand_audience: false,
      neural_may_raise_assurance: false,
      unknown_fields_rejected: true,
    },
  };
  const envelopeHash = hashAgentRunValue(adapterEnvelopeBase);
  const adapterEnvelope = {
    ...adapterEnvelopeBase,
    envelope_hash: envelopeHash,
  };

  const provenanceManifest = sources.map((source) => {
    const adapterRef = scopedAdapterRef(envelopeId, source.source_ref);
    return {
      adapter_source_ref: adapterRef,
      source_ref: source.source_ref,
      channel: source.channel,
      claim_domain: source.claim_domain,
      assurance_origin: source.assurance_origin,
      claimed_assurance_origin: source.claimed_assurance_origin,
      audience: cloneJson(source.audience),
      producer: source.producer,
    };
  });

  const trustedMaterializationContext = {
    schema_version: `${worldSimulationCapabilityEnvelopeVersion}-materialization-context`,
    policy_version: worldSimulationCapabilityPolicyVersion,
    envelope_id: envelopeId,
    envelope_hash: envelopeHash,
    assurance_mode: assuranceMode,
    intended_audience: cloneJson(intended),
    protected_base_result: protectedBase,
    provenance_manifest: provenanceManifest,
    source_catalog: materializationCatalog(envelopeId, sources),
    engine_only: true,
  };

  return {
    adapter_envelope: adapterEnvelope,
    trusted_materialization_context: trustedMaterializationContext,
  };
}

function assertEnvelopeShape(envelope) {
  if (!isObject(envelope)
    || envelope.schema_version !== worldSimulationCapabilityEnvelopeVersion
    || envelope.policy_version !== worldSimulationCapabilityPolicyVersion
    || !nonEmptyString(envelope.envelope_id)
    || !nonEmptyString(envelope.envelope_hash)
  ) {
    throw errorWithCode(
      "Capability envelope version or shape is invalid.",
      "WORLD_SIMULATION_CAPABILITY_POLICY_VERSION_MISMATCH",
    );
  }
  const { policy } = assertPolicy(envelope.capability_name);
  return policy;
}

function assertNoNeuralGovernanceFields(extension) {
  const matches = collectForbiddenKeys(
    extension,
    neuralGovernanceForbiddenKeys,
  );
  if (matches.length) {
    throw errorWithCode(
      `Neural extension attempted to author policy/authority fields: ${matches.slice(0, 8).join(", ")}.`,
      "WORLD_SIMULATION_CAPABILITY_ASSURANCE_ESCALATION_FORBIDDEN",
      { forbidden_paths: matches },
    );
  }
}

function assertProtectedFieldsNotOverridden(policy, extension) {
  const protectedSet = new Set(policy.protected_result_channels);
  const overridden = Object.keys(object(extension)).filter((key) => protectedSet.has(key));
  if (overridden.length) {
    throw errorWithCode(
      `Neural extension attempted to override protected result fields: ${overridden.join(", ")}.`,
      "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN",
      { protected_fields: overridden },
    );
  }
}

function assertAllowedExtensionFields(policy, extension) {
  const allowed = new Set(policy.neural_extension_fields);
  const unknown = Object.keys(extension).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw errorWithCode(
      `Neural extension contains unregistered fields: ${unknown.join(", ")}.`,
      "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
      { unknown_fields: unknown },
    );
  }
}

function assertReferenceFields(policy, envelope, extension) {
  const allowedRefs = new Set(array(envelope.authorized_source_refs));
  for (const field of policy.reference_fields) {
    if (!Object.hasOwn(extension, field)) continue;
    if (!Array.isArray(extension[field])) {
      throw errorWithCode(
        `${field} must be an array of envelope-scoped source refs.`,
        "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
        { field },
      );
    }
    for (const rawRef of extension[field]) {
      const ref = nonEmptyString(rawRef);
      if (!ref) {
        throw errorWithCode(
          `${field} contains an invalid source ref.`,
          "WORLD_SIMULATION_CAPABILITY_SOURCE_REF_UNKNOWN",
          { field, source_ref: rawRef ?? null },
        );
      }
      if (!allowedRefs.has(ref)) {
        const crossEnvelope = ref.startsWith("envsrc_");
        throw errorWithCode(
          crossEnvelope
            ? `Source ref ${ref} belongs to another or unavailable capability envelope.`
            : `Source ref ${ref} is unknown to this capability envelope.`,
          crossEnvelope
            ? "WORLD_SIMULATION_CAPABILITY_CROSS_ENVELOPE_REF_FORBIDDEN"
            : "WORLD_SIMULATION_CAPABILITY_SOURCE_REF_UNKNOWN",
          { field, source_ref: ref },
        );
      }
    }
  }
}

export function validateWorldSimulationCapabilityNeuralExtension(
  envelope,
  extension,
) {
  const policy = assertEnvelopeShape(envelope);
  if (!isObject(extension)) {
    throw errorWithCode(
      "Neural capability extension must be an object.",
      "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
    );
  }
  assertNoNeuralGovernanceFields(extension);
  assertProtectedFieldsNotOverridden(policy, extension);
  assertAllowedExtensionFields(policy, extension);
  assertReferenceFields(policy, envelope, extension);
  const normalized = cloneJson(extension);
  return {
    ok: true,
    envelope_id: envelope.envelope_id,
    capability_name: envelope.capability_name,
    extension: normalized,
    extension_hash: hashAgentRunValue({
      envelope_id: envelope.envelope_id,
      extension: normalized,
    }),
    assurance_origin: "neural_derived",
    intended_audience: cloneJson(envelope.intended_audience),
  };
}

export function resolveWorldSimulationCapabilityNeuralExtension({
  envelope,
  extension,
  failure_mode = "direct_explicit",
} = {}) {
  try {
    return {
      accepted: true,
      fallback_to_trusted_base: false,
      validation: validateWorldSimulationCapabilityNeuralExtension(
        envelope,
        extension,
      ),
      violation: null,
    };
  } catch (error) {
    if (failure_mode !== "native_optional") throw error;
    return {
      accepted: false,
      fallback_to_trusted_base: true,
      validation: null,
      violation: {
        code: error?.code ?? "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function materializeWorldSimulationCapabilitySourceRefs({
  envelope,
  trusted_materialization_context: context,
  source_refs: requestedRefs,
} = {}) {
  assertEnvelopeShape(envelope);
  if (!isObject(context)
    || context.engine_only !== true
    || context.policy_version !== worldSimulationCapabilityPolicyVersion
    || context.envelope_id !== envelope.envelope_id
    || context.envelope_hash !== envelope.envelope_hash
  ) {
    throw errorWithCode(
      "Trusted materialization context does not belong to this capability envelope.",
      "WORLD_SIMULATION_CAPABILITY_MATERIALIZATION_FAILED",
    );
  }
  const catalog = object(context.source_catalog);
  return array(requestedRefs).map((rawRef) => {
    const ref = nonEmptyString(rawRef);
    if (!ref || !Object.hasOwn(catalog, ref)) {
      const crossEnvelope = Boolean(ref?.startsWith("envsrc_"));
      throw errorWithCode(
        crossEnvelope
          ? `Source ref ${ref} cannot be materialized outside its capability envelope.`
          : `Unknown source ref ${ref ?? "<missing>"}.`,
        crossEnvelope
          ? "WORLD_SIMULATION_CAPABILITY_CROSS_ENVELOPE_REF_FORBIDDEN"
          : "WORLD_SIMULATION_CAPABILITY_SOURCE_REF_UNKNOWN",
        { source_ref: ref },
      );
    }
    return cloneJson(catalog[ref]);
  });
}
