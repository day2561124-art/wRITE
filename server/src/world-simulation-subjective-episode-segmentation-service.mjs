import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationSubjectiveEpisodeSegmentationVersion =
  "phase67a-subjective-episode-segmentation-v1";

export const subjectiveEpisodeSegmentationEventSchemaVersion =
  "phase67a-subjective-episode-segmentation-event-v1";

export const subjectiveEpisodeSegmentationHistoryReferenceSchemaVersion =
  "phase67a-subjective-episode-segmentation-history-ref-v1";

export const effectiveSubjectiveEpisodeProjectionVersion =
  "phase67a-effective-subjective-episode-projection-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
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
  if (
    !value
    || typeof value !== "object"
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function compareText(left, right) {
  return String(left ?? "")
    .localeCompare(String(right ?? ""), "en");
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))]
    .sort(compareText);
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function characterKey(value) {
  return requiredString(value, "character")
    .toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function characterMemories(worldState, character) {
  const memories = object(worldState.memories);
  const direct = memories[character];
  if (Array.isArray(direct)) return direct;

  const wanted = characterKey(character);
  for (const [name, records] of Object.entries(memories)) {
    if (
      characterKey(name) === wanted
      && Array.isArray(records)
    ) {
      return records;
    }
  }
  return [];
}

function memoryIdentity(record) {
  return optionalString(record?.memory_id ?? record?.id);
}

function canonicalSourceMemory(worldState, source, expectedTurnId) {
  if (!isObject(source) || !isObject(source.memory_record)) {
    const error = new Error(
      "Phase67A source_memory_records must contain { character, memory_record } objects.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_INVALID";
    throw error;
  }

  const character = requiredString(source.character, "source_memory_records.character");
  const memoryId = requiredString(
    memoryIdentity(source.memory_record),
    "source_memory_records.memory_record.memory_id",
  );

  const canonical = characterMemories(worldState, character)
    .find((record) => memoryIdentity(record) === memoryId);

  if (!isObject(canonical)) {
    const error = new Error(
      `Phase67A cannot resolve source subjective memory ${memoryId} for ${character}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_UNRESOLVED";
    throw error;
  }

  if (!sameValue(canonical, source.memory_record)) {
    const error = new Error(
      `Phase67A source subjective memory ${memoryId} does not match the canonical persisted record.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_MISMATCH";
    throw error;
  }

  if (canonical.subjective_memory_not_world_truth !== true) {
    const error = new Error(
      `Phase67A source subjective memory ${memoryId} does not preserve the subjective-memory boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_BOUNDARY_VIOLATION";
    throw error;
  }

  const sourceTurnId = optionalString(canonical?.internal_provenance?.turn_id);
  if (sourceTurnId !== expectedTurnId) {
    const error = new Error(
      `Phase67A source subjective memory ${memoryId} is not from current turn ${expectedTurnId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_TURN_MISMATCH";
    throw error;
  }

  const explicitEpisodeId = optionalString(
    canonical?.episodic_binding?.subjective_episode_id,
  );
  const retrievalEpisodeId = optionalString(
    canonical?.retrieval_cues?.subjective_episode_id,
  );

  if (
    explicitEpisodeId
    && retrievalEpisodeId
    && explicitEpisodeId !== retrievalEpisodeId
  ) {
    const error = new Error(
      `Phase67A source subjective memory ${memoryId} contains inconsistent explicit episode binding evidence.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EXPLICIT_BINDING_MISMATCH";
    throw error;
  }

  return {
    character,
    memory_id: memoryId,
    memory_hash: hashAgentRunValue(canonical),
    source_turn_id: sourceTurnId,
    scene_id: optionalString(
      canonical?.retrieval_cues?.scene_id
      ?? canonical?.internal_provenance?.scene_id,
    ),
    encoded_at: canonical?.encoded_at ?? null,
    explicit_subjective_episode_id:
      explicitEpisodeId ?? retrievalEpisodeId ?? null,
  };
}

function segmentationEventHash(event) {
  const body = cloneJson(event);
  delete body.segmentation_event_hash;
  return hashAgentRunValue(body);
}

function assertPersistedSegmentationEvent(event, eventId) {
  if (
    !isObject(event)
    || event.schema_version !== subjectiveEpisodeSegmentationEventSchemaVersion
    || event.version !== worldSimulationSubjectiveEpisodeSegmentationVersion
    || event.immutable !== true
    || event.segmentation_event_id !== eventId
    || !optionalString(event.segmentation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.subjective_episode_id)
    || !Array.isArray(event.source_memory_refs)
    || event.source_memory_refs.length < 1
    || ![
      "start_new_episode",
      "continue_episode",
      "preserve_explicit_binding",
    ].includes(event.resolution)
    || event.status !== "subjective_episode_segmentation_recorded"
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.confidence !== null
    || event.probability !== null
    || event.memory_content_copied !== false
    || event.world_event_identity_promoted !== false
    || event.world_turn_identity_promoted !== false
    || event.scene_identity_promoted !== false
    || event.character_brain_direct_write !== false
  ) {
    const error = new Error(
      `SubjectiveEpisodeSegmentationEvent ${eventId} is invalid.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_INVALID";
    throw error;
  }

  if (segmentationEventHash(event) !== event.segmentation_event_hash) {
    const error = new Error(
      `SubjectiveEpisodeSegmentationEvent ${eventId} failed hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_HASH_MISMATCH";
    throw error;
  }

  const memoryIds = event.source_memory_refs
    .map((reference) => optionalString(reference?.memory_id));
  const memoryHashes = event.source_memory_refs
    .map((reference) => optionalString(reference?.memory_hash));

  if (
    memoryIds.some((value) => !value)
    || memoryHashes.some((value) => !value)
    || uniqueSorted(memoryIds).length !== memoryIds.length
    || !sameValue([...memoryIds].sort(compareText), memoryIds)
  ) {
    const error = new Error(
      `SubjectiveEpisodeSegmentationEvent ${eventId} has invalid source memory references.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_SOURCE_INVALID";
    throw error;
  }

  return event;
}

function validateExistingSegmentationHistory(worldState) {
  if (
    Object.hasOwn(worldState, "subjective_episode_segmentation_events")
    && !isObject(worldState.subjective_episode_segmentation_events)
  ) {
    const error = new Error(
      "subjective_episode_segmentation_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_episode_segmentation_history")
    && !Array.isArray(worldState.subjective_episode_segmentation_history)
  ) {
    const error = new Error(
      "subjective_episode_segmentation_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.subjective_episode_segmentation_events);
  const history = array(worldState.subjective_episode_segmentation_history);
  const seenEventIds = new Set();
  const seenMemoryIds = new Set();
  const latestByCharacter = new Map();
  const eventByMemoryId = new Map();

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.segmentation_event_id);
    const eventHash = optionalString(reference?.segmentation_event_hash);
    const character = optionalString(reference?.character);

    if (
      !isObject(reference)
      || reference.schema_version !== subjectiveEpisodeSegmentationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !eventHash
      || !character
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.subjective_episode_id)
      || !Array.isArray(reference.source_memory_ids)
      || reference.source_memory_ids.length < 1
      || ![
        "start_new_episode",
        "continue_episode",
        "preserve_explicit_binding",
      ].includes(reference.resolution)
      || reference.status !== "subjective_episode_segmentation_recorded"
    ) {
      const error = new Error(
        `subjective_episode_segmentation_history[${index}] is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seenEventIds.has(eventId)) {
      const error = new Error(
        `subjective_episode_segmentation_history contains duplicate event ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    const event = events[eventId];
    assertPersistedSegmentationEvent(event, eventId);

    const key = characterKey(character);
    const previous = latestByCharacter.get(key) ?? null;
    const expectedPreviousId = previous?.segmentation_event_id ?? null;
    const expectedPreviousHash = previous?.segmentation_event_hash ?? null;
    const eventMemoryIds = event.source_memory_refs.map((item) => item.memory_id);

    if (
      reference.segmentation_event_hash !== event.segmentation_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.subjective_episode_id !== event.subjective_episode_id
      || reference.resolution !== event.resolution
      || reference.previous_segmentation_event_id !== event.previous_segmentation_event_id
      || reference.previous_segmentation_event_hash !== event.previous_segmentation_event_hash
      || !sameValue(reference.source_memory_ids, eventMemoryIds)
      || event.previous_segmentation_event_id !== expectedPreviousId
      || event.previous_segmentation_event_hash !== expectedPreviousHash
    ) {
      const error = new Error(
        `subjective_episode_segmentation_history reference ${eventId} does not match its canonical per-character chain.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    for (const memoryId of eventMemoryIds) {
      if (seenMemoryIds.has(`${key}:${memoryId}`)) {
        const error = new Error(
          `Subjective memory ${memoryId} appears in more than one Phase67A segmentation event for ${character}.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_MEMORY_DUPLICATE";
        throw error;
      }
      seenMemoryIds.add(`${key}:${memoryId}`);
      eventByMemoryId.set(`${key}:${memoryId}`, event);
    }

    seenEventIds.add(eventId);
    latestByCharacter.set(key, event);
  }

  return {
    events,
    history,
    latestByCharacter,
    eventByMemoryId,
  };
}

function groupCurrentSources(sources) {
  const groups = new Map();

  for (const source of sources) {
    const key = characterKey(source.character);
    const bindingKey = source.explicit_subjective_episode_id
      ? `explicit:${source.explicit_subjective_episode_id}`
      : `automatic:${source.scene_id ?? "unknown"}`;
    const groupKey = `${key}\u0000${bindingKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        character: source.character,
        character_key: key,
        explicit_subjective_episode_id:
          source.explicit_subjective_episode_id,
        source_memory_refs: [],
        scene_ids: [],
        encoded_at_values: [],
      });
    }

    const group = groups.get(groupKey);
    group.source_memory_refs.push({
      memory_id: source.memory_id,
      memory_hash: source.memory_hash,
    });
    if (source.scene_id) group.scene_ids.push(source.scene_id);
    if (source.encoded_at !== null && source.encoded_at !== undefined) {
      group.encoded_at_values.push(source.encoded_at);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      source_memory_refs: [...group.source_memory_refs]
        .sort((left, right) => compareText(left.memory_id, right.memory_id)),
      scene_ids: uniqueSorted(group.scene_ids),
      encoded_at_values: [...group.encoded_at_values]
        .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right))),
    }))
    .sort((left, right) => {
      const characterOrder = compareText(left.character_key, right.character_key);
      if (characterOrder !== 0) return characterOrder;
      const leftKey = left.explicit_subjective_episode_id
        ? `0:${left.explicit_subjective_episode_id}`
        : `1:${left.scene_ids.join("|")}`;
      const rightKey = right.explicit_subjective_episode_id
        ? `0:${right.explicit_subjective_episode_id}`
        : `1:${right.scene_ids.join("|")}`;
      return compareText(leftKey, rightKey);
    });
}

function previousSceneIds(event) {
  return uniqueSorted(array(event?.segmentation_evidence?.current_scene_ids));
}

function automaticResolution(group, previousEvent) {
  if (!previousEvent) {
    return {
      resolution: "start_new_episode",
      reason: "first_automatic_episode_for_character",
      boundary_evidence: ["no_prior_subjective_episode_organization"],
      continuity_evidence: [],
      insufficient_evidence: false,
    };
  }

  const currentScenes = group.scene_ids;
  const priorScenes = previousSceneIds(previousEvent);

  if (currentScenes.length && priorScenes.length) {
    const prior = new Set(priorScenes);
    const overlaps = currentScenes.some((sceneId) => prior.has(sceneId));

    if (overlaps) {
      return {
        resolution: "continue_episode",
        reason: "materialized_spatial_context_continuity",
        boundary_evidence: [],
        continuity_evidence: ["spatial_context_overlap"],
        insufficient_evidence: false,
      };
    }

    return {
      resolution: "start_new_episode",
      reason: "materialized_spatial_context_change",
      boundary_evidence: ["spatial_context_changed"],
      continuity_evidence: [],
      insufficient_evidence: false,
    };
  }

  return {
    resolution: "continue_episode",
    reason: "insufficient_boundary_evidence_preserves_open_episode",
    boundary_evidence: [],
    continuity_evidence: [],
    insufficient_evidence: true,
  };
}

function newEpisodeId(group, previousEvent) {
  return `subjective_episode_${hashAgentRunValue({
    version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    character: group.character_key,
    source_memory_refs: group.source_memory_refs,
    previous_segmentation_event_hash:
      previousEvent?.segmentation_event_hash ?? null,
    identity_source: "phase67a_subjective_source_lineage",
  }).slice(0, 24)}`;
}

function segmentationEventFor(group, previousEvent, sourceTurnId) {
  const explicitEpisodeId = group.explicit_subjective_episode_id;
  const resolutionEvidence = explicitEpisodeId
    ? {
      resolution: "preserve_explicit_binding",
      reason: "phase63_explicit_subjective_episode_binding_preserved",
      boundary_evidence: ["explicit_subjective_episode_binding"],
      continuity_evidence: [],
      insufficient_evidence: false,
    }
    : automaticResolution(group, previousEvent);

  const subjectiveEpisodeId = explicitEpisodeId
    ?? (resolutionEvidence.resolution === "continue_episode"
      ? previousEvent?.subjective_episode_id
      : null)
    ?? newEpisodeId(group, previousEvent);

  const base = {
    schema_version: subjectiveEpisodeSegmentationEventSchemaVersion,
    version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    immutable: true,
    character: group.character,
    source_turn_id: sourceTurnId,
    source_memory_refs: cloneJson(group.source_memory_refs),
    resolution: resolutionEvidence.resolution,
    subjective_episode_id: subjectiveEpisodeId,
    previous_segmentation_event_id:
      previousEvent?.segmentation_event_id ?? null,
    previous_segmentation_event_hash:
      previousEvent?.segmentation_event_hash ?? null,
    previous_subjective_episode_id:
      previousEvent?.subjective_episode_id ?? null,
    segmentation_evidence: {
      current_scene_ids: cloneJson(group.scene_ids),
      previous_scene_ids: previousSceneIds(previousEvent),
      encoded_at_values: cloneJson(group.encoded_at_values),
      boundary_evidence: resolutionEvidence.boundary_evidence,
      continuity_evidence: resolutionEvidence.continuity_evidence,
      insufficient_evidence: resolutionEvidence.insufficient_evidence,
      resolution_reason: resolutionEvidence.reason,
      scene_change_is_universal_psychological_boundary: false,
      numeric_prediction_error_threshold_used: false,
      hidden_world_state_used: false,
    },
    source_semantics: {
      phase63_memory_records_are_authoritative_episode_evidence: true,
      explicit_phase63_binding_preserved: Boolean(explicitEpisodeId),
      memory_content_copied: false,
      world_event_identity_promoted: false,
      world_turn_identity_promoted: false,
      scene_identity_promoted: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    confidence: null,
    probability: null,
    memory_content_copied: false,
    world_event_identity_promoted: false,
    world_turn_identity_promoted: false,
    scene_identity_promoted: false,
    character_brain_direct_write: false,
    status: "subjective_episode_segmentation_recorded",
  };

  const eventId = `subjective_episode_segmentation_event_${hashAgentRunValue({
    version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    character: group.character_key,
    source_turn_id: sourceTurnId,
    source_memory_refs: group.source_memory_refs,
    subjective_episode_id: subjectiveEpisodeId,
    resolution: resolutionEvidence.resolution,
    previous_segmentation_event_hash:
      previousEvent?.segmentation_event_hash ?? null,
  }).slice(0, 24)}`;

  const event = {
    ...base,
    segmentation_event_id: eventId,
  };
  event.segmentation_event_hash = segmentationEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: subjectiveEpisodeSegmentationHistoryReferenceSchemaVersion,
    derived_index: true,
    segmentation_event_id: event.segmentation_event_id,
    segmentation_event_hash: event.segmentation_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    source_memory_ids: event.source_memory_refs.map((item) => item.memory_id),
    subjective_episode_id: event.subjective_episode_id,
    resolution: event.resolution,
    previous_segmentation_event_id:
      event.previous_segmentation_event_id,
    previous_segmentation_event_hash:
      event.previous_segmentation_event_hash,
    status: event.status,
  });
}

export function projectWorldSimulationEffectiveSubjectiveEpisodes(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateExistingSegmentationHistory(worldState);
  const episodesByCharacter = {};

  for (const reference of existing.history) {
    const event = existing.events[reference.segmentation_event_id];
    const key = event.character;
    if (!isObject(episodesByCharacter[key])) {
      episodesByCharacter[key] = {};
    }

    const episodes = episodesByCharacter[key];
    const episodeId = event.subjective_episode_id;
    const prior = object(episodes[episodeId]);
    const memoryIds = uniqueSorted([
      ...array(prior.source_memory_ids),
      ...event.source_memory_refs.map((item) => item.memory_id),
    ]);
    const eventIds = [
      ...array(prior.segmentation_event_ids),
      event.segmentation_event_id,
    ];

    episodes[episodeId] = {
      subjective_episode_id: episodeId,
      character: event.character,
      source_memory_ids: memoryIds,
      segmentation_event_ids: eventIds,
      first_source_turn_id:
        prior.first_source_turn_id ?? event.source_turn_id,
      latest_source_turn_id: event.source_turn_id,
      latest_segmentation_event_id: event.segmentation_event_id,
      explicit_binding_present:
        prior.explicit_binding_present === true
        || event.resolution === "preserve_explicit_binding",
      subjective_not_world_truth: true,
    };
  }

  const projection = {
    version: effectiveSubjectiveEpisodeProjectionVersion,
    source_version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    episodes_by_character: episodesByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    memory_content_duplicated: false,
    world_truth_authority_claimed: false,
    character_brain_exposure_installed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

export function buildWorldSimulationSubjectiveEpisodeSegmentationContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    phase: "Phase67A",
    status: "automatic_subjective_episode_segmentation_installed",
    source_scope: "current_turn_new_committed_subjective_memory_traces_only",
    source_memory_owner: "Phase63A",
    explicit_episode_binding_owner: "Phase63A",
    immutable_segmentation_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    effective_episode_projection_replayable: true,
    effective_episode_projection_version:
      effectiveSubjectiveEpisodeProjectionVersion,
    phase63_memory_content_rewritten: false,
    phase63_memory_content_copied_into_episode_nodes: false,
    world_event_id_auto_promoted_to_subjective_episode_id: false,
    world_turn_id_auto_promoted_to_subjective_episode_id: false,
    scene_id_auto_promoted_to_subjective_episode_id: false,
    scene_change_is_universal_psychological_boundary: false,
    numeric_prediction_error_threshold_modeled: false,
    explicit_phase63_episode_binding_preserved: true,
    hidden_world_state_allowed: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    last_write_wins_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    separate_retrieval_engine_installed: false,
    phase63_phase64_retrieval_substrate_reused: true,
    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationSubjectiveEpisodeSegmentations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const rawSources = array(input.source_memory_records);
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: rawSources,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateExistingSegmentationHistory(worldState);

  const canonicalSources = rawSources
    .map((source) => canonicalSourceMemory(worldState, source, turnId));
  const currentKeys = new Set();
  for (const source of canonicalSources) {
    const key = `${characterKey(source.character)}:${source.memory_id}`;
    if (currentKeys.has(key)) {
      const error = new Error(
        `Phase67A received duplicate source subjective memory ${source.memory_id} for ${source.character}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_DUPLICATE";
      throw error;
    }
    currentKeys.add(key);
  }

  const newSources = [];
  const alreadyPersistedEventIds = new Set();
  for (const source of canonicalSources) {
    const key = `${characterKey(source.character)}:${source.memory_id}`;
    const priorEvent = existing.eventByMemoryId.get(key) ?? null;
    if (priorEvent) {
      const ref = priorEvent.source_memory_refs
        .find((item) => item.memory_id === source.memory_id);
      if (!ref || ref.memory_hash !== source.memory_hash) {
        const error = new Error(
          `Phase67A source subjective memory ${source.memory_id} was already segmented with different immutable source content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersistedEventIds.add(priorEvent.segmentation_event_id);
      continue;
    }
    newSources.push(source);
  }

  if (!newSources.length) {
    const projection = projectWorldSimulationEffectiveSubjectiveEpisodes({
      world_state: worldState,
    });
    return deepFreeze({
      ok: true,
      version: worldSimulationSubjectiveEpisodeSegmentationVersion,
      result: {
        processed_source_memory_count: canonicalSources.length,
        new_source_memory_count: 0,
        segmentation_events_created: [],
        already_persisted_segmentation_event_ids:
          [...alreadyPersistedEventIds].sort(compareText),
        history_references_appended: [],
        state_transitions: [],
        preview_world_state: worldState,
        effective_episode_projection: projection,
        audit: {
          input_context_hash: inputHash,
          source_memories_verified_against_world_state: true,
          current_turn_source_scope_verified: true,
          no_new_sources: true,
          synthetic_empty_containers_created: false,
          phase63_memory_records_rewritten: false,
          memory_content_copied: false,
          world_truth_authority_claimed: false,
          character_brain_direct_write_used: false,
          same_turn_character_brain_feedback_allowed: false,
        },
      },
    });
  }

  const preview = cloneJson(worldState);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  const latestByCharacter = new Map(existing.latestByCharacter);
  const groups = groupCurrentSources(newSources);

  for (const group of groups) {
    const previous = latestByCharacter.get(group.character_key) ?? null;
    const event = segmentationEventFor(group, previous, turnId);
    const collision = object(
      object(existing.events)[event.segmentation_event_id],
    );

    if (Object.keys(collision).length) {
      assertPersistedSegmentationEvent(collision, event.segmentation_event_id);
      if (!sameValue(collision, event)) {
        const error = new Error(
          `SubjectiveEpisodeSegmentationEvent ${event.segmentation_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersistedEventIds.add(event.segmentation_event_id);
      latestByCharacter.set(group.character_key, collision);
      continue;
    }

    preview.subjective_episode_segmentation_events = object(
      preview.subjective_episode_segmentation_events,
    );
    preview.subjective_episode_segmentation_events[event.segmentation_event_id] =
      cloneJson(event);
    createdEvents.push(event);
    const reference = historyReferenceFor(event);
    appendedReferences.push(reference);
    latestByCharacter.set(group.character_key, event);

    stateTransitions.push({
      entity: "world",
      field:
        `subjective_episode_segmentation_events.${event.segmentation_event_id}`,
      from: null,
      to: cloneJson(event),
      cause:
        `persist immutable SubjectiveEpisodeSegmentationEvent ${event.segmentation_event_id}`,
      source_layer: "subjective_episode_segmentation",
    });
  }

  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.subjective_episode_segmentation_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "subjective_episode_segmentation_history",
      from: cloneJson(worldState.subjective_episode_segmentation_history ?? null),
      to: cloneJson(nextHistory),
      cause:
        `append ${appendedReferences.length} Phase67A subjective episode segmentation history reference(s)`,
      source_layer: "subjective_episode_segmentation",
    });
  }

  const effectiveProjection = projectWorldSimulationEffectiveSubjectiveEpisodes({
    world_state: preview,
  });

  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error(
      "Phase67A subjective episode segmentation mutated its input snapshot.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationSubjectiveEpisodeSegmentationVersion,
    result: {
      processed_source_memory_count: canonicalSources.length,
      new_source_memory_count: newSources.length,
      segmentation_events_created: createdEvents,
      already_persisted_segmentation_event_ids:
        [...alreadyPersistedEventIds].sort(compareText),
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      effective_episode_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        source_memories_verified_against_world_state: true,
        current_turn_source_scope_verified: true,
        source_memory_content_copied_into_events: false,
        phase63_memory_records_rewritten: false,
        explicit_phase63_episode_binding_preserved: true,
        per_character_previous_event_hash_chain_preserved: true,
        deterministic_group_order_used: true,
        world_event_identity_promoted: false,
        world_turn_identity_promoted: false,
        scene_identity_promoted: false,
        scene_change_claimed_as_universal_psychological_boundary: false,
        numeric_prediction_error_threshold_used: false,
        hidden_world_state_used: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        last_write_wins_applied: false,
        separate_retrieval_engine_installed: false,
        character_brain_direct_write_used: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}
