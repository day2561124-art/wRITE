import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  compileWorldSimulationCapabilityEnvelope,
  materializeWorldSimulationCapabilitySourceRefs,
  resolveWorldSimulationCapabilityNeuralExtension,
  worldSimulationCapabilityAssuranceModes,
  worldSimulationCapabilityEnvelopeVersion,
  worldSimulationCapabilityPolicyVersion,
} from "./world-simulation-capability-envelope-service.mjs";

export const worldSimulationCharacterFacingRuntimeVersion =
  "phase62a-r1-character-facing-runtime-v1";

export const worldSimulationCharacterFacingAssuranceModes =
  worldSimulationCapabilityAssuranceModes;

const characterFacingCapabilities = Object.freeze([
  "world_perception_filter",
  "world_memory_retriever",
  "world_character_cognition",
  "world_action_proposer",
]);

const characterFacingCapabilitySet = new Set(characterFacingCapabilities);

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

function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function characterFrom(input, trustedBase) {
  return text(
    trustedBase?.character
      ?? input?.character
      ?? input?.character_name,
  );
}

function sourceRef(prefix, index, payload) {
  return `${prefix}_${index}_${hashAgentRunValue(payload).slice(0, 16)}`;
}

function characterAudience(character) {
  return ["engine", `character:${character}`];
}

function observationSources(character, trustedBase) {
  const sources = [];
  for (const [channel, values] of [
    ["visual_observation", array(trustedBase.observed)],
    ["auditory_observation", array(trustedBase.audible)],
    ["other_sense_observation", array(trustedBase.other_senses)],
  ]) {
    values.forEach((payload, index) => {
      sources.push({
        source_ref: sourceRef(channel, index, payload),
        channel,
        claim_domain: "perception",
        assurance_origin: "programmatic_derived",
        audience: characterAudience(character),
        payload: cloneJson(payload),
        producer: "trusted_world_perception_builder",
      });
    });
  }
  return sources;
}

function memorySources(character, trustedBase) {
  return array(trustedBase.projected_memories).map((memory, index) => ({
    source_ref: sourceRef("projected_memory", index, memory),
    channel: "projected_memory",
    claim_domain: "memory_projection",
    assurance_origin: "programmatic_derived",
    audience: characterAudience(character),
    payload: cloneJson(memory),
    producer: "trusted_legacy_memory_projector",
  }));
}

function actionSources(character, trustedBase) {
  return array(trustedBase.candidate_action_intents).map((candidate, index) => ({
    source_ref: sourceRef("action_candidate", index, candidate),
    channel: "action_candidate",
    claim_domain: "action_candidate",
    assurance_origin: "programmatic_derived",
    audience: characterAudience(character),
    payload: cloneJson(candidate),
    producer: "trusted_world_action_candidate_builder",
  }));
}

function boundedCognitionContext(cognition) {
  const value = object(cognition);
  return cloneJson({
    character: value.character ?? null,
    perception: value.perception ?? {},
    recovered_memories: value.recovered_memories ?? [],
    retrieval_experience: value.retrieval_experience ?? null,
    known: value.known ?? [],
    uncertain: value.uncertain ?? [],
    needs: value.needs ?? {},
    emotion: value.emotion ?? null,
    attention: value.attention ?? null,
    goals: value.goals ?? [],
    values: value.values ?? {},
    relationship_cognition: value.relationship_cognition ?? {},
    current_action: value.current_action ?? null,
    decision_pressures: value.decision_pressures ?? [],
    neural_extension: value.neural_extension ?? null,
  });
}

function adapterProtectedBase(capabilityName, input, trustedBase) {
  switch (capabilityName) {
    case "world_perception_filter":
      return cloneJson({
        character: trustedBase.character ?? null,
        observed: trustedBase.observed ?? [],
        audible: trustedBase.audible ?? [],
        other_senses: trustedBase.other_senses ?? [],
        information_boundary: trustedBase.information_boundary ?? {},
      });
    case "world_memory_retriever":
      return cloneJson({
        character: trustedBase.character ?? null,
        query: trustedBase.query ?? null,
        projection_max_items: trustedBase.projection_max_items ?? null,
        projected_memories: trustedBase.projected_memories ?? [],
        retrieved_memories: trustedBase.retrieved_memories ?? [],
        memory_boundary: trustedBase.memory_boundary ?? {},
      });
    case "world_character_cognition":
      return cloneJson({
        ...trustedBase,
        retrieval_experience:
          input.retrieval_experience
          ?? trustedBase.retrieval_experience
          ?? null,
      });
    case "world_action_proposer":
      return cloneJson({
        character: trustedBase.character ?? null,
        candidate_action_intents: trustedBase.candidate_action_intents ?? [],
        selection_boundary: trustedBase.selection_boundary ?? null,
        outcome_boundary: trustedBase.outcome_boundary ?? null,
        cognition_context: boundedCognitionContext(input.cognition),
        current_action: cloneJson(input.current_action ?? null),
      });
    default:
      throw new Error(`Unsupported character-facing capability: ${capabilityName}`);
  }
}

function sourceChannels(capabilityName, character, trustedBase) {
  switch (capabilityName) {
    case "world_perception_filter":
      return observationSources(character, trustedBase);
    case "world_memory_retriever":
      return memorySources(character, trustedBase);
    case "world_action_proposer":
      return actionSources(character, trustedBase);
    case "world_character_cognition":
      return [];
    default:
      return [];
  }
}

function materializedPayloads(prepared, refs) {
  return materializeWorldSimulationCapabilitySourceRefs({
    envelope: prepared.adapter_envelope,
    trusted_materialization_context:
      prepared.trusted_materialization_context,
    source_refs: refs,
  }).map((entry) => cloneJson(entry.payload));
}

function idsFromMaterialized(entries, field) {
  return entries
    .map((entry) => text(object(entry)[field]))
    .filter(Boolean);
}

function materializeExtension(prepared, validatedExtension) {
  if (!validatedExtension) return null;
  const extension = object(validatedExtension.extension);
  switch (prepared.capability_name) {
    case "world_perception_filter":
      return {
        attended_observations: materializedPayloads(
          prepared,
          extension.attended_observation_refs,
        ),
        salience_annotations: cloneJson(extension.salience_annotations ?? []),
        ambiguity_annotations: cloneJson(extension.ambiguity_annotations ?? []),
      };
    case "world_memory_retriever": {
      const selected = materializedPayloads(
        prepared,
        extension.selected_memory_refs,
      );
      const ordered = materializedPayloads(
        prepared,
        extension.ordered_memory_refs,
      );
      return {
        selected_memory_ids: idsFromMaterialized(selected, "memory_id"),
        ordered_memory_ids: idsFromMaterialized(ordered, "memory_id"),
      };
    }
    case "world_action_proposer": {
      const considered = materializedPayloads(
        prepared,
        extension.considered_action_refs,
      );
      const ordered = materializedPayloads(
        prepared,
        extension.ordered_action_refs,
      );
      const deprioritized = materializedPayloads(
        prepared,
        extension.deprioritized_action_refs,
      );
      return {
        considered_action_ids: idsFromMaterialized(considered, "action_id"),
        ordered_action_ids: idsFromMaterialized(ordered, "action_id"),
        deprioritized_action_ids: idsFromMaterialized(
          deprioritized,
          "action_id",
        ),
      };
    }
    case "world_character_cognition":
      return cloneJson(extension);
    default:
      return null;
  }
}

function perceptionCharacterView(trustedBase, neuralExtension) {
  return cloneJson({
    character: trustedBase.character ?? null,
    observed: trustedBase.observed ?? [],
    audible: trustedBase.audible ?? [],
    other_senses: trustedBase.other_senses ?? [],
    information_boundary: trustedBase.information_boundary ?? {},
    ...(neuralExtension ? { neural_extension: neuralExtension } : {}),
  });
}

function cognitionCharacterView(trustedBase, input, neuralExtension) {
  return cloneJson({
    character: trustedBase.character ?? null,
    perception: trustedBase.perception ?? {},
    recovered_memories: trustedBase.recovered_memories ?? [],
    retrieval_experience:
      input.retrieval_experience
      ?? trustedBase.retrieval_experience
      ?? null,
    known: trustedBase.known ?? [],
    uncertain: trustedBase.uncertain ?? [],
    needs: trustedBase.needs ?? {},
    emotion: trustedBase.emotion ?? null,
    attention: trustedBase.attention ?? null,
    goals: trustedBase.goals ?? [],
    values: trustedBase.values ?? {},
    relationship_cognition: trustedBase.relationship_cognition ?? {},
    current_action: trustedBase.current_action ?? null,
    decision_pressures: trustedBase.decision_pressures ?? [],
    cognition_boundary: trustedBase.cognition_boundary ?? {},
    ...(neuralExtension ? { neural_extension: neuralExtension } : {}),
  });
}

function actionCharacterView(trustedBase, neuralExtension) {
  return cloneJson({
    character: trustedBase.character ?? null,
    candidate_action_intents: trustedBase.candidate_action_intents ?? [],
    selection_boundary: trustedBase.selection_boundary ?? null,
    outcome_boundary: trustedBase.outcome_boundary ?? null,
    ...(neuralExtension
      ? { neural_consideration: neuralExtension }
      : {}),
  });
}

export function isWorldSimulationCharacterFacingCapability(capabilityName) {
  return characterFacingCapabilitySet.has(String(capabilityName ?? "").trim());
}

export function buildWorldSimulationCharacterFacingRuntimeContract() {
  return {
    version: worldSimulationCharacterFacingRuntimeVersion,
    envelope_version: worldSimulationCapabilityEnvelopeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    capabilities: [...characterFacingCapabilities],
    trusted_builder_executes_before_neural_adapter: true,
    neural_adapter_receives_raw_world_input: false,
    neural_adapter_returns_extension_only: true,
    character_perception_view_excludes_engine_simulation_time: true,
    character_perception_view_excludes_engine_scene_id: true,
    cognition_adapter_receives_full_character_state: false,
    action_neural_ranking_changes_candidate_universe: false,
    legacy_memory_adapter_changes_phase63c_recovery: false,
    native_invalid_extension_falls_back_to_trusted_base: true,
    direct_invalid_extension_throws: true,
  };
}

export function prepareWorldSimulationCharacterFacingCapabilityRuntime({
  capability_name: capabilityName,
  input = {},
  trusted_base: trustedBase = {},
  assurance_mode: assuranceMode,
  invocation_id: invocationId,
} = {}) {
  if (!isWorldSimulationCharacterFacingCapability(capabilityName)) {
    throw new Error(`Capability ${capabilityName} is not character-facing.`);
  }
  const character = characterFrom(input, trustedBase);
  const compiled = compileWorldSimulationCapabilityEnvelope({
    capability_name: capabilityName,
    invocation_id: invocationId,
    subject: { character },
    protected_base: adapterProtectedBase(capabilityName, input, trustedBase),
    source_channels: sourceChannels(capabilityName, character, trustedBase),
  }, {
    assurance_mode: assuranceMode,
  });
  return {
    version: worldSimulationCharacterFacingRuntimeVersion,
    capability_name: capabilityName,
    character,
    assurance_mode: assuranceMode,
    raw_input: cloneJson(input),
    trusted_base: cloneJson(trustedBase),
    adapter_envelope: compiled.adapter_envelope,
    trusted_materialization_context:
      compiled.trusted_materialization_context,
  };
}

export function finalizeWorldSimulationCharacterFacingCapabilityRuntime({
  prepared,
  neural_extension: neuralExtension,
  adapter_invoked: adapterInvoked = false,
  adapter_failure: adapterFailure = null,
  failure_mode: failureMode = "direct_explicit",
} = {}) {
  if (!isObject(prepared)
    || !isWorldSimulationCharacterFacingCapability(prepared.capability_name)) {
    throw new Error("Prepared character-facing capability runtime is invalid.");
  }

  let resolution = {
    accepted: false,
    fallback_to_trusted_base: false,
    validation: null,
    violation: null,
  };

  if (adapterFailure) {
    if (failureMode !== "native_optional") {
      const error = new Error(
        adapterFailure.message ?? "Character-facing neural adapter failed.",
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

  const materializedNeural = resolution.accepted
    ? materializeExtension(prepared, resolution.validation)
    : null;
  const trustedBase = cloneJson(prepared.trusted_base);
  const input = cloneJson(prepared.raw_input);

  const output = {
    ...trustedBase,
    ...(prepared.capability_name === "world_character_cognition"
      ? {
        retrieval_experience:
          input.retrieval_experience
          ?? trustedBase.retrieval_experience
          ?? null,
      }
      : {}),
  };

  if (prepared.capability_name === "world_perception_filter") {
    output.character_view = perceptionCharacterView(
      trustedBase,
      materializedNeural,
    );
  } else if (prepared.capability_name === "world_character_cognition") {
    output.character_view = cognitionCharacterView(
      trustedBase,
      input,
      materializedNeural,
    );
  } else if (prepared.capability_name === "world_action_proposer") {
    output.character_view = actionCharacterView(
      trustedBase,
      materializedNeural,
    );
  } else if (prepared.capability_name === "world_memory_retriever") {
    if (materializedNeural) {
      output.legacy_projection_consideration = materializedNeural;
    }
  }

  if (prepared.capability_name === "world_character_cognition"
    && materializedNeural) {
    output.neural_extension = materializedNeural;
  }
  if (prepared.capability_name === "world_perception_filter"
    && materializedNeural) {
    output.neural_extension = materializedNeural;
  }
  if (prepared.capability_name === "world_action_proposer"
    && materializedNeural) {
    output.neural_consideration = materializedNeural;
  }

  output.r1_runtime = {
    version: worldSimulationCharacterFacingRuntimeVersion,
    policy_version: worldSimulationCapabilityPolicyVersion,
    envelope_version: worldSimulationCapabilityEnvelopeVersion,
    envelope_id: prepared.adapter_envelope.envelope_id,
    envelope_hash: prepared.adapter_envelope.envelope_hash,
    assurance_mode: prepared.assurance_mode,
    adapter_invoked: adapterInvoked,
    neural_extension_accepted: resolution.accepted,
    fallback_to_trusted_base: resolution.fallback_to_trusted_base,
    violation: cloneJson(resolution.violation),
    raw_world_state_exposed_to_adapter: false,
    raw_scene_state_exposed_to_adapter: false,
    full_character_state_exposed_to_adapter: false,
    engine_provenance_exposed_to_adapter: false,
  };

  return {
    output,
    audit: cloneJson(output.r1_runtime),
  };
}
