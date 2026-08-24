import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationSubjectiveMemoryFormationVersion = "phase63a-subjective-memory-formation-v2";

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

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteUnit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = String(character ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) return value;
  }
  return undefined;
}

const strippedObservationKeys = new Set([
  "world_state",
  "source_position",
  "target_position",
  "exact_source_position",
  "exact_target_position",
  "relative_position",
  "target_illumination_lux",
  "received_level_db",
  "reference_level_db",
  "reference_distance_m",
  "minimum_audible_db",
  "observer_thresholds_lux",
  "distance_m",
  "confidence",
  "perceptual_confidence",
  "perceptual_certainty_at_encoding",
  "certainty",
  "clarity",
  "perceptual_clarity",
  "perceptual_clarity_at_encoding",
  "memory_clarity",
  "relevance",
  "possibly_incorrect",
]);

function keyIsEngineIdentifier(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || strippedObservationKeys.has(normalized);
}

function sanitizePerceivedValue(value) {
  if (Array.isArray(value)) return value.map(sanitizePerceivedValue);
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsEngineIdentifier(key)) continue;
    clean[key] = sanitizePerceivedValue(child);
  }
  return clean;
}

function encodingProfileFor(worldState, character) {
  const state = object(characterMapValue(object(worldState).characters, character));
  return object(state.memory_encoding_profile ?? state.memory_profile);
}

function metricAliases(metric) {
  if (metric === "perceptual_certainty_at_encoding") {
    return [
      "perceptual_certainty_at_encoding",
      "perceptual_confidence",
      "confidence",
      "certainty",
    ];
  }

  return [
    "perceptual_clarity_at_encoding",
    "perceptual_clarity",
    "clarity",
    "memory_clarity",
  ];
}

function firstMetricValue(value, metric) {
  const source = object(value);

  for (const key of metricAliases(metric)) {
    const numeric = finiteUnit(source[key]);
    if (numeric !== null) return numeric;
  }

  return null;
}

function profileMetric(profile, sense, metric) {
  const direct = object(profile.direct_perception);
  const senses = object(profile.senses);

  const candidates = [
    object(direct[sense]),
    object(senses[sense]),
    object(profile[sense]),
    direct,
    profile,
  ];

  for (const candidate of candidates) {
    const numeric = firstMetricValue(candidate, metric);
    if (numeric !== null) return numeric;
  }

  return null;
}

function metricFromObservation(observation, metric) {
  if (!isObject(observation)) return null;
  return firstMetricValue(observation, metric);
}

function metricWithOrigin(observation, profile, sense, metric) {
  const direct = metricFromObservation(observation, metric);

  if (direct !== null) {
    return {
      value: direct,
      origin: "perception_observation",
    };
  }

  const configured = profileMetric(profile, sense, metric);

  if (configured !== null) {
    return {
      value: configured,
      origin: "character_memory_encoding_profile",
    };
  }

  return {
    value: null,
    origin: "unspecified",
  };
}

function observationEntries(perception) {
  const entries = [];

  const push = (sense, values) => {
    array(values).forEach((value, senseIndex) => {
      entries.push({
        sense,
        sense_index: senseIndex,
        observation: value,
      });
    });
  };

  push("visual", perception?.observed);
  push("auditory", perception?.audible);
  push("other", perception?.other_senses);

  return entries;
}

const allowedEncodingDecisions = new Set([
  "encode",
  "do_not_encode",
  "unspecified",
]);

function encodingDecisionKey(
  character,
  sense,
  senseIndex,
) {
  return [
    String(character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW"),
    sense,
    senseIndex,
  ].join(":");
}

function normalizeEncodingDecision(raw, index) {
  const value = object(raw);

  const character =
    nonEmptyString(value.character);

  const sense =
    nonEmptyString(value.sense)?.toLowerCase()
    ?? null;

  const senseIndex =
    nonNegativeInteger(value.sense_index);

  const decision =
    nonEmptyString(value.decision)?.toLowerCase()
    ?? null;

  if (!character) {
    const error = new Error(
      `encoding_decisions[${index}].character is required.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_INVALID";
    throw error;
  }

  if (
    !["visual", "auditory", "other"].includes(sense)
  ) {
    const error = new Error(
      `encoding_decisions[${index}].sense must be visual, auditory, or other.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_INVALID";
    throw error;
  }

  if (senseIndex === null) {
    const error = new Error(
      `encoding_decisions[${index}].sense_index must be a non-negative integer.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_INVALID";
    throw error;
  }

  if (!allowedEncodingDecisions.has(decision)) {
    const error = new Error(
      `encoding_decisions[${index}].decision must be encode, do_not_encode, or unspecified.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_INVALID";
    throw error;
  }

  return {
    character,
    sense,
    sense_index: senseIndex,
    decision,
    reason:
      nonEmptyString(value.reason),
    source:
      nonEmptyString(value.source)
      ?? "explicit_programmatic_encoding_decider",
  };
}

function buildEncodingDecisionIndex(values) {
  const normalized =
    array(values).map(normalizeEncodingDecision);

  const byKey = new Map();

  for (const decision of normalized) {
    const key = encodingDecisionKey(
      decision.character,
      decision.sense,
      decision.sense_index,
    );

    if (byKey.has(key)) {
      const error = new Error(
        `Duplicate memory encoding decision for ${key}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_DUPLICATE";
      throw error;
    }

    byKey.set(key, decision);
  }

  return {
    normalized,
    by_key: byKey,
  };
}

function normalizeEpisodeBinding(raw, index) {
  const value = object(raw);

  const character =
    nonEmptyString(value.character);

  const sense =
    nonEmptyString(value.sense)?.toLowerCase()
    ?? null;

  const senseIndex =
    nonNegativeInteger(value.sense_index);

  const subjectiveEpisodeId =
    nonEmptyString(
      value.subjective_episode_id,
    );

  if (!character) {
    const error = new Error(
      `episode_bindings[${index}].character is required.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_INVALID";

    throw error;
  }

  if (
    !["visual", "auditory", "other"].includes(sense)
  ) {
    const error = new Error(
      `episode_bindings[${index}].sense must be visual, auditory, or other.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_INVALID";

    throw error;
  }

  if (senseIndex === null) {
    const error = new Error(
      `episode_bindings[${index}].sense_index must be a non-negative integer.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_INVALID";

    throw error;
  }

  if (!subjectiveEpisodeId) {
    const error = new Error(
      `episode_bindings[${index}].subjective_episode_id is required.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_INVALID";

    throw error;
  }

  return {
    character,
    sense,
    sense_index:
      senseIndex,

    subjective_episode_id:
      subjectiveEpisodeId,

    source:
      nonEmptyString(value.source)
      ?? "explicit_programmatic_episode_binder",
  };
}

function buildEpisodeBindingIndex(values) {
  const normalized =
    array(values).map(normalizeEpisodeBinding);

  const byKey =
    new Map();

  for (const binding of normalized) {
    const key =
      encodingDecisionKey(
        binding.character,
        binding.sense,
        binding.sense_index,
      );

    if (byKey.has(key)) {
      const error = new Error(
        `Duplicate subjective episode binding for ${key}.`,
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_DUPLICATE";

      throw error;
    }

    byKey.set(
      key,
      binding,
    );
  }

  return {
    normalized,
    by_key:
      byKey,
  };
}

function memoryRecordFor({
  character,
  observation,
  sense,
  profile,
  turnId,
  eventId,
  sceneId,
  encodedAt,
  observationIndex,
}) {
  const sanitized = sanitizePerceivedValue(observation);

  if (sanitized === null || sanitized === undefined) return null;
  if (isObject(sanitized) && !Object.keys(sanitized).length) return null;

  const memoryType = "episodic_direct_perception";
  const contentHash = hashAgentRunValue({
    sense,
    content: sanitized,
  });

  const perceptualCertainty = metricWithOrigin(
    observation,
    profile,
    sense,
    "perceptual_certainty_at_encoding",
  );

  const perceptualClarity = metricWithOrigin(
    observation,
    profile,
    sense,
    "perceptual_clarity_at_encoding",
  );

  const memoryId = `memory_${hashAgentRunValue({
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: turnId,
    character,
    sense,
    observation_index: observationIndex,
    content_hash: contentHash,
  }).slice(0, 24)}`;

  return {
    memory_id: memoryId,
    memory_type: memoryType,

    content: sanitized,

    // Subjectively meaningful source features only.
    // Engine lineage belongs in internal_provenance below.
    source: {
      kind: "direct_perception",
      sense,
    },

    internal_provenance: {
      event_id: eventId,
      scene_id: sceneId,
      turn_id: turnId,
      observation_hash: contentHash,
      formation_version:
        worldSimulationSubjectiveMemoryFormationVersion,
    },

    // Machine-readable retrieval cues may be consumed by Phase63B,
    // but are not forwarded into the Character Brain memory view.
    retrieval_cues: {
      scene_id: sceneId,
      sense,
      observation_kind:
        isObject(sanitized)
          ? nonEmptyString(sanitized.kind)
          : null,
      memory_type: memoryType,
    },

    perceptual_certainty_at_encoding:
      perceptualCertainty.value,

    perceptual_certainty_origin:
      perceptualCertainty.origin,

    perceptual_clarity_at_encoding:
      perceptualClarity.value,

    perceptual_clarity_origin:
      perceptualClarity.origin,

    encoded_at: encodedAt,

    // Engine persistence means this trace survives turns.
    // It does NOT assert that psychological consolidation is complete.
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,

    last_recalled_at: null,

    relevance:
      isObject(observation)
        ? cloneJson(observation.relevance ?? null)
        : null,

    accessible: true,
    suppressed: false,

    possibly_incorrect:
      isObject(observation)
      && observation.possibly_incorrect === true,

    source_confused: false,

    subjective_memory_not_world_truth: true,
  };
}

function solveSubjectiveMemoryFormation(context) {
  const worldState = object(context.world_state);
  const turnId = nonEmptyString(context.turn_id);
  const event = object(context.event);
  const eventId = nonEmptyString(event.event_id ?? event.id);
  const sceneId = nonEmptyString(event.scene_id ?? event.location_id);

  const encodingDecisionIndex =
    buildEncodingDecisionIndex(
      context.encoding_decisions,
    );

  const episodeBindingIndex =
    buildEpisodeBindingIndex(
      context.episode_bindings,
    );

  const consumedEncodingDecisionKeys =
    new Set();

  const consumedEpisodeBindingKeys =
    new Set();

  const encodingDecisionResults = [];
  const episodeBindingResults = [];

  const updates = [];
  const transitions = [];

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const packet of array(context.decision_packets)) {
    const character = nonEmptyString(packet?.character);
    if (!character) continue;
    const perception = object(packet?.perception);
    const encodedAt = perception.simulation_time ?? worldState.simulation_time ?? event.simulation_time ?? null;
    const profile = encodingProfileFor(worldState, character);
    const existingRaw = characterMapValue(worldState.memories, character);
    const existing = Array.isArray(existingRaw) ? cloneJson(existingRaw) : [];
    const existingIds = new Set(existing.map((item) => String(item?.memory_id ?? item?.id ?? "")).filter(Boolean));
    const seenContent = new Set();
    const created = [];

    let skippedObservationCount = 0;
    let explicitDecisionCount = 0;

    const entries =
      observationEntries(perception);

    entries.forEach(
      (
        {
          sense,
          sense_index: senseIndex,
          observation,
        },
        observationIndex,
      ) => {
        const decisionKey =
          encodingDecisionKey(
            character,
            sense,
            senseIndex,
          );

        const explicitDecision =
          encodingDecisionIndex
            .by_key
            .get(decisionKey)
          ?? null;

        const explicitEpisodeBinding =
          episodeBindingIndex
            .by_key
            .get(decisionKey)
          ?? null;

        if (explicitEpisodeBinding) {
          consumedEpisodeBindingKeys.add(
            decisionKey,
          );
        }

        if (explicitDecision) {
          explicitDecisionCount += 1;

          consumedEncodingDecisionKeys.add(
            decisionKey,
          );

          encodingDecisionResults.push({
            character,
            sense,
            sense_index: senseIndex,
            decision:
              explicitDecision.decision,
            reason:
              explicitDecision.reason,
            source:
              explicitDecision.source,
          });
        }

        if (
          explicitDecision?.decision
          === "do_not_encode"
        ) {
          if (explicitEpisodeBinding) {
            episodeBindingResults.push({
              character,
              sense,
              sense_index:
                senseIndex,

              subjective_episode_id:
                explicitEpisodeBinding
                  .subjective_episode_id,

              source:
                explicitEpisodeBinding.source,

              applied:
                false,

              reason:
                "encoding_suppressed",
            });
          }

          skippedObservationCount += 1;
          totalSkipped += 1;
          return;
        }

        // "encode", "unspecified", or no explicit
        // decision all preserve normal formation.
        const record = memoryRecordFor({
          character,
          observation,
          sense,
          profile,
          turnId,
          eventId,
          sceneId:
            perception.scene_id
            ?? sceneId,
          encodedAt,
          observationIndex,
        });

        if (!record) {
          if (explicitEpisodeBinding) {
            episodeBindingResults.push({
              character,
              sense,
              sense_index:
                senseIndex,

              subjective_episode_id:
                explicitEpisodeBinding
                  .subjective_episode_id,

              source:
                explicitEpisodeBinding.source,

              applied:
                false,

              reason:
                "observation_not_encodable",
            });
          }

          return;
        }

        if (existingIds.has(record.memory_id)) {
          if (explicitEpisodeBinding) {
            episodeBindingResults.push({
              character,
              sense,
              sense_index:
                senseIndex,

              subjective_episode_id:
                explicitEpisodeBinding
                  .subjective_episode_id,

              source:
                explicitEpisodeBinding.source,

              applied:
                false,

              reason:
                "memory_already_exists",
            });
          }

          return;
        }

        const dedupe =
          `${sense}:${record.internal_provenance.observation_hash}`;

        if (seenContent.has(dedupe)) {
          if (explicitEpisodeBinding) {
            episodeBindingResults.push({
              character,
              sense,
              sense_index:
                senseIndex,

              subjective_episode_id:
                explicitEpisodeBinding
                  .subjective_episode_id,

              source:
                explicitEpisodeBinding.source,

              applied:
                false,

              reason:
                "same_turn_duplicate",
            });
          }

          return;
        }

        if (explicitEpisodeBinding) {
          record.episodic_binding = {
            subjective_episode_id:
              explicitEpisodeBinding
                .subjective_episode_id,

            source:
              explicitEpisodeBinding.source,
          };

          record.retrieval_cues = {
            ...object(record.retrieval_cues),

            subjective_episode_id:
              explicitEpisodeBinding
                .subjective_episode_id,
          };

          episodeBindingResults.push({
            character,
            sense,
            sense_index:
              senseIndex,

            subjective_episode_id:
              explicitEpisodeBinding
                .subjective_episode_id,

            source:
              explicitEpisodeBinding.source,

            applied:
              true,

            reason:
              null,
          });
        }

        seenContent.add(dedupe);
        created.push(record);
      },
    );

    if (!created.length) {
      updates.push({
        character,
        created_memory_count: 0,
        skipped_observation_count:
          skippedObservationCount,
        explicit_encoding_decision_count:
          explicitDecisionCount,
        memory_records: [],
        before_memory_count: existing.length,
        after_memory_count: existing.length,
      });
      continue;
    }

    const after = [...existing, ...created];
    totalCreated += created.length;
    updates.push({
      character,
      created_memory_count:
        created.length,
      skipped_observation_count:
        skippedObservationCount,
      explicit_encoding_decision_count:
        explicitDecisionCount,
      memory_records:
        cloneJson(created),
      before_memory_count:
        existing.length,
      after_memory_count:
        after.length,
    });
    transitions.push({
      entity: "world",
      field: `memories.${character}`,
      from: existingRaw === undefined ? null : existing,
      to: after,
      cause: `encoded ${created.length} bounded direct-perception memories for ${character}`,
      time_ms: 0,
      source_layer: "subjective_memory",
      adjudication: worldSimulationSubjectiveMemoryFormationVersion,
    });
  }

  const unmatchedEpisodeBindings =
    episodeBindingIndex
      .normalized
      .filter((binding) => {
        const key =
          encodingDecisionKey(
            binding.character,
            binding.sense,
            binding.sense_index,
          );

        return !consumedEpisodeBindingKeys.has(
          key,
        );
      });

  if (unmatchedEpisodeBindings.length) {
    const error = new Error(
      "One or more explicit subjective episode bindings did not match a bounded perception observation.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_UNMATCHED";

    error.unmatched_episode_bindings =
      cloneJson(
        unmatchedEpisodeBindings,
      );

    throw error;
  }

  const unmatchedEncodingDecisions =
    encodingDecisionIndex
      .normalized
      .filter((decision) => {
        const key =
          encodingDecisionKey(
            decision.character,
            decision.sense,
            decision.sense_index,
          );

        return !consumedEncodingDecisionKeys.has(
          key,
        );
      });

  if (unmatchedEncodingDecisions.length) {
    const error = new Error(
      "One or more explicit memory encoding decisions did not match a bounded perception observation.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_UNMATCHED";

    error.unmatched_encoding_decisions =
      cloneJson(unmatchedEncodingDecisions);

    throw error;
  }

  return {
    status: "subjective_memory_formation_resolved",
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: turnId,
    event_id: eventId,
    created_memory_count: totalCreated,
    skipped_observation_count: totalSkipped,
    explicit_encoding_decision_count:
      encodingDecisionIndex.normalized.length,

    encoding_decision_results:
      cloneJson(encodingDecisionResults),

    explicit_episode_binding_count:
      episodeBindingIndex.normalized.length,

    episode_binding_results:
      cloneJson(episodeBindingResults),

    character_updates: updates,
    memory_transitions: transitions,
    formation_boundary: {
      source_is_character_bounded_perception_only: true,
      raw_world_state_facts_are_not_memory_content_sources: true,
      objective_knowledge_is_not_promoted_from_memory: true,
      engine_target_or_sound_source_ids_are_stripped_from_memory_content: true,
      internal_engine_provenance_is_preserved: true,
      internal_engine_provenance_is_separate_from_subjective_source: true,
      internal_engine_provenance_is_not_character_memory_content: true,

      encoding_metadata_is_not_remembered_content: true,

      perceptual_certainty_requires_explicit_observation_or_character_profile: true,
      perceptual_clarity_requires_explicit_observation_or_character_profile: true,

      hidden_encoding_metric_defaults_allowed: false,

      perceptual_certainty_is_not_retrieval_confidence: true,
      perceptual_clarity_is_not_truth_probability: true,
      perceptual_clarity_is_not_storage_strength: true,

      persisted_trace_is_fully_consolidated_memory: false,

      universal_encoding_probability_assumed: false,
      binary_attention_memory_gate_assumed: false,

      explicit_programmatic_encoding_decisions_supported: true,
      missing_encoding_decision_preserves_legacy_encoding: true,
      character_brain_direct_encoding_control_allowed: false,
      hidden_probabilistic_encoding_gate_allowed: false,

      subjective_episode_binding_modeled: true,

      explicit_subjective_episode_binding_supported: true,

      automatic_subjective_episode_segmentation_modeled: false,

      world_event_id_auto_promoted_to_subjective_episode_id: false,
      world_turn_id_auto_promoted_to_subjective_episode_id: false,
      scene_id_auto_promoted_to_subjective_episode_id: false,

      subjective_episode_id_exposed_to_character_brain: false,

      schema_distortion_modeled: false,
      memories_become_retrievable_on_later_turns_not_retroactively_in_same_decision: true,
      active_memory_decay_modeled: false,
      consolidation_reconsolidation_modeled: false,
      post_outcome_perception_capture_modeled: false,
    },
  };
}

export function formWorldSimulationSubjectiveMemories(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    turn_id: input.turn_id ?? null,
    event: object(input.event),
    decision_packets: array(input.decision_packets),

    encoding_decisions:
      array(input.encoding_decisions),

    episode_bindings:
      array(input.episode_bindings),
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveSubjectiveMemoryFormation(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Subjective memory formation produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEMORY_FORMATION_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Subjective memory formation mutated its input context.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEMORY_FORMATION_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationSubjectiveMemoryFormationVersion,
    turn_id: input.turn_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    formation_output_contains_world_state: false,
    formation_output_contains_memory_transitions_only: true,
    memory_content_derived_only_from_bounded_perception: true,
    character_brain_creates_or_edits_persisted_memory: false,
    memory_is_not_objective_world_truth: true,

    engine_provenance_separated_from_subjective_source: true,

    encoding_metadata_is_not_memory_content: true,

    encoding_metrics_are_not_retrieval_confidence_or_truth: true,

    persisted_trace_is_not_claimed_fully_consolidated: true,

    explicit_programmatic_encoding_decisions_supported: true,
    character_brain_encoding_directives_consumed: false,
    missing_encoding_decision_preserves_legacy_encoding: true,

    explicit_subjective_episode_binding_supported: true,

    implicit_subjective_episode_inference_used: false,

    world_event_identity_used_as_subjective_episode_identity:
      false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    subjective_memory_formation_version: worldSimulationSubjectiveMemoryFormationVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationSubjectiveMemoryFormationContract() {
  return {
    version: worldSimulationSubjectiveMemoryFormationVersion,
    owner: "programmatic_subjective_memory_layer",
    input_source: "bounded_character_perception_packets",
    deterministic_replay_required: true,
    immutable_input_context: true,
    persisted_memory_is_subjective_not_world_truth: true,

    internal_engine_provenance_preserved: true,
    internal_engine_provenance_separate_from_subjective_source: true,
    internal_engine_provenance_exposed_to_character_brain: false,

    encoding_metadata_is_memory_content: false,

    explicit_observation_or_profile_required_for_perceptual_certainty: true,
    explicit_observation_or_profile_required_for_perceptual_clarity: true,

    perceptual_certainty_is_not_retrieval_confidence: true,
    perceptual_clarity_is_not_truth_probability: true,

    hidden_cognitive_defaults_allowed: false,

    universal_encoding_probability_assumed: false,
    binary_attention_memory_gate_assumed: false,

    explicit_programmatic_encoding_decision_hook_supported: true,
    missing_encoding_decision_preserves_legacy_encoding: true,
    character_brain_direct_encoding_control_allowed: false,
    hidden_probabilistic_encoding_gate_allowed: false,

    subjective_episode_binding_modeled: true,

    explicit_subjective_episode_binding_hook_supported: true,

    automatic_subjective_episode_segmentation_modeled: false,

    world_event_id_auto_promoted_to_subjective_episode_id: false,
    world_turn_id_auto_promoted_to_subjective_episode_id: false,
    scene_id_auto_promoted_to_subjective_episode_id: false,

    subjective_episode_id_exposed_to_character_brain: false,

    persisted_trace_is_fully_consolidated_memory: false,

    schema_distortion_modeled: false,
    engine_target_ids_in_memory_content_allowed: false,
    objective_known_facts_auto_promotion_allowed: false,
    same_turn_retroactive_memory_use_allowed: false,
    final_memory_state_written_through_authoritative_mutation_executor: true,
    active_memory_decay_modeled: false,
    consolidation_reconsolidation_modeled: false,
    post_outcome_perception_capture_modeled: false,
    neural_module_direct_memory_mutation_allowed: false,
  };
}
