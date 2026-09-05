import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

import {
  memoryRetrievalEventSchemaVersion,
} from "./world-simulation-memory-retrieval-persistence-service.mjs";

export const worldSimulationMemoryPlasticityVersion =
  "phase64a-retrieval-practice-consequence-v1";

export const memoryPlasticityEventSchemaVersion =
  "phase64a-memory-plasticity-event-v1";

export const memoryPlasticityHistoryReferenceSchemaVersion =
  "phase64a-memory-plasticity-history-ref-v1";

export const memoryPlasticityModelProfileSchemaVersion =
  "phase64a-retrieval-practice-model-profile-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function object(value) {
  return isObject(value)
    ? value
    : {};
}

function array(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function cloneJson(value) {
  return JSON.parse(
    JSON.stringify(
      value ?? null,
    ),
  );
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
  return typeof value === "string"
    && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_MEMORY_PLASTICITY_INVALID",
) {
  const text =
    optionalString(value);

  if (text) return text;

  const error =
    new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null)
    === JSON.stringify(right ?? null);
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];

  for (const raw of array(values)) {
    const value = optionalString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function timestampMs(value) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function compareRetrievalEvents(left, right) {
  const leftMs =
    timestampMs(left?.occurred_at);
  const rightMs =
    timestampMs(right?.occurred_at);

  if (
    leftMs !== null
    && rightMs !== null
    && leftMs !== rightMs
  ) {
    return leftMs - rightMs;
  }

  if (leftMs !== null && rightMs === null) {
    return -1;
  }

  if (leftMs === null && rightMs !== null) {
    return 1;
  }

  const turnOrder =
    String(left?.turn_id ?? "")
      .localeCompare(
        String(right?.turn_id ?? ""),
        "zh-Hant-TW",
      );

  if (turnOrder !== 0) {
    return turnOrder;
  }

  return String(
    left?.retrieval_event_id
    ?? "",
  ).localeCompare(
    String(
      right?.retrieval_event_id
      ?? "",
    ),
    "zh-Hant-TW",
  );
}

const memoryPlasticityModelProfile =
  deepFreeze({
    schema_version:
      memoryPlasticityModelProfileSchemaVersion,

    model_mode:
      "retrieval_practice_event_registration_v1",

    quantitative_strength_delta_modeled:
      false,

    retrieval_difficulty_inferred:
      false,

    future_accessibility_projection_installed:
      false,

    same_source_turn_feedback_allowed:
      false,

    recovery_occurrence_count_is_practice_count:
      false,

    contacted_only_candidate_is_practice:
      false,

    failed_target_attempt_is_successful_practice:
      false,
  });

export const memoryPlasticityModelProfileHash =
  hashAgentRunValue(
    memoryPlasticityModelProfile,
  );

function sourceRetrievalEvent(
  worldState,
  retrievalEventId,
) {
  const event =
    object(
      object(worldState?.retrieval_events)[
        retrievalEventId
      ],
    );

  if (!Object.keys(event).length) {
    const error = new Error(
      `Phase64A cannot resolve canonical RetrievalEvent ${retrievalEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_UNRESOLVED";
    throw error;
  }

  if (
    event.schema_version
      !== memoryRetrievalEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.retrieval_event_id)
      !== retrievalEventId
  ) {
    const error = new Error(
      `RetrievalEvent ${retrievalEventId} is not a valid immutable Phase63C event.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_INVALID";
    throw error;
  }

  const storedHash =
    requiredString(
      event.retrieval_event_hash,
      `retrieval_events.${retrievalEventId}.retrieval_event_hash`,
      "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_HASH_REQUIRED",
    );

  const hashBody =
    cloneJson(event);
  delete hashBody.retrieval_event_hash;

  const recomputedHash =
    hashAgentRunValue(hashBody);

  if (recomputedHash !== storedHash) {
    const error = new Error(
      `RetrievalEvent ${retrievalEventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_RETRIEVAL_EVENT_HASH_MISMATCH";
    error.retrieval_event_id =
      retrievalEventId;
    error.expected_hash =
      storedHash;
    error.actual_hash =
      recomputedHash;
    throw error;
  }

  return event;
}

function normalizeMemoryRecovery(
  recovery,
  index,
) {
  if (!isObject(recovery)) {
    const error = new Error(
      `memory_recoveries[${index}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_MEMORY_RECOVERY_INVALID";
    throw error;
  }

  const memoryRecoveryId =
    requiredString(
      recovery.memory_recovery_id,
      `memory_recoveries[${index}].memory_recovery_id`,
      "WORLD_SIMULATION_MEMORY_PLASTICITY_MEMORY_RECOVERY_INVALID",
    );

  const sourceMemoryRef =
    requiredString(
      recovery.source_memory_ref,
      `memory_recoveries[${index}].source_memory_ref`,
      "WORLD_SIMULATION_MEMORY_PLASTICITY_MEMORY_RECOVERY_INVALID",
    );

  const recoveryExtent =
    optionalString(
      recovery.recovery_extent,
    );

  if (
    ![
      "whole_content",
      "partial_content",
    ].includes(recoveryExtent)
  ) {
    const error = new Error(
      `memory_recoveries[${index}].recovery_extent must be whole_content or partial_content.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_MEMORY_RECOVERY_INVALID";
    throw error;
  }

  const targetRelation =
    optionalString(
      recovery.target_relation,
    )
    ?? "unresolved";

  return {
    memory_recovery_id:
      memoryRecoveryId,
    source_memory_ref:
      sourceMemoryRef,
    recovered_fragment_ids:
      uniqueStrings(
        recovery.recovered_fragment_ids,
      ),
    recovery_occurrence_ids:
      uniqueStrings(
        recovery.recovery_occurrence_ids,
      ),
    recovery_extent:
      recoveryExtent,
    target_relation:
      targetRelation,
  };
}

function buildPlasticityEffects(
  retrievalEvent,
  plasticityEventId,
) {
  const seenMemoryIds =
    new Set();

  return array(
    retrievalEvent.memory_recoveries,
  ).map(
    (rawRecovery, index) => {
      const recovery =
        normalizeMemoryRecovery(
          rawRecovery,
          index,
        );

      if (
        seenMemoryIds.has(
          recovery.source_memory_ref,
        )
      ) {
        const error = new Error(
          `RetrievalEvent ${retrievalEvent.retrieval_event_id} contains duplicate per-memory recovery records for ${recovery.source_memory_ref}.`,
        );
        error.code =
          "WORLD_SIMULATION_MEMORY_PLASTICITY_DUPLICATE_MEMORY_RECOVERY";
        throw error;
      }

      seenMemoryIds.add(
        recovery.source_memory_ref,
      );

      const effectId =
        `memory_plasticity_effect_${hashAgentRunValue({
          plasticity_event_id:
            plasticityEventId,
          source_memory_ref:
            recovery.source_memory_ref,
          memory_recovery_id:
            recovery.memory_recovery_id,
        }).slice(0, 24)}`;

      return {
        plasticity_effect_id:
          effectId,

        source_memory_ref:
          recovery.source_memory_ref,

        memory_recovery_id:
          recovery.memory_recovery_id,

        target_relation:
          recovery.target_relation,

        recovery_extent:
          recovery.recovery_extent,

        recovered_fragment_ids:
          recovery.recovered_fragment_ids,

        recovery_occurrence_ids:
          recovery.recovery_occurrence_ids,

        retrieval_practice_registered:
          true,

        source_memory_reactivation_occurred:
          true,

        whole_content_recovered:
          recovery.recovery_extent
            === "whole_content",

        partial_content_recovered:
          recovery.recovery_extent
            === "partial_content",

        recovery_occurrence_count_used_as_practice_count:
          false,

        quantitative_strength_delta:
          null,
      };
    },
  );
}

function plasticityEventFor(
  retrievalEvent,
) {
  const eventSeed = {
    plasticity_version:
      worldSimulationMemoryPlasticityVersion,

    source_retrieval_event_id:
      retrievalEvent.retrieval_event_id,

    source_retrieval_event_hash:
      retrievalEvent.retrieval_event_hash,

    model_profile_hash:
      memoryPlasticityModelProfileHash,
  };

  const plasticityEventId =
    `memory_plasticity_event_${hashAgentRunValue(
      eventSeed,
    ).slice(0, 24)}`;

  const effects =
    buildPlasticityEffects(
      retrievalEvent,
      plasticityEventId,
    );

  const wholeCount =
    effects.filter(
      (effect) =>
        effect.whole_content_recovered,
    ).length;

  const partialCount =
    effects.filter(
      (effect) =>
        effect.partial_content_recovered,
    ).length;

  const targetCount =
    effects.filter(
      (effect) =>
        effect.target_relation === "target",
    ).length;

  const nonTargetCount =
    effects.filter(
      (effect) =>
        effect.target_relation === "non_target",
    ).length;

  const eventBody = {
    schema_version:
      memoryPlasticityEventSchemaVersion,

    plasticity_event_id:
      plasticityEventId,

    source_retrieval_event_id:
      retrievalEvent.retrieval_event_id,

    source_retrieval_event_hash:
      retrievalEvent.retrieval_event_hash,

    character:
      requiredString(
        retrievalEvent.character,
        "RetrievalEvent.character",
      ),

    source_turn_id:
      retrievalEvent.turn_id
      ?? null,

    occurred_at:
      retrievalEvent.occurred_at
      ?? null,

    model_mode:
      memoryPlasticityModelProfile
        .model_mode,

    model_profile_schema_version:
      memoryPlasticityModelProfileSchemaVersion,

    model_profile_hash:
      memoryPlasticityModelProfileHash,

    effects,

    outcome_summary: {
      retrieval_practice_effect_count:
        effects.length,

      whole_content_effect_count:
        wholeCount,

      partial_content_effect_count:
        partialCount,

      target_effect_count:
        targetCount,

      non_target_effect_count:
        nonTargetCount,

      processed_with_zero_effects:
        effects.length === 0,

      source_target_outcome:
        retrievalEvent.target_outcome
        ?? null,
    },

    engine_audit: {
      source_retrieval_event_verified:
        true,

      source_retrieval_event_hash_verified:
        true,

      same_source_turn_feedback_allowed:
        false,

      changes_current_retrieval_process:
        false,

      future_accessibility_projection_applied:
        false,

      retrieval_difficulty_inferred:
        false,

      storage_strength_delta_modeled:
        false,

      retrieval_strength_delta_modeled:
        false,

      contacted_only_candidates_reinforced:
        false,

      failed_target_attempt_reinforced:
        false,

      recovery_occurrence_count_used_as_practice_count:
        false,

      competitor_weakening_applied:
        false,

      memory_content_rewritten:
        false,

      perceptual_certainty_rewritten:
        false,

      perceptual_clarity_rewritten:
        false,

      memory_source_rewritten:
        false,

      consolidation_applied:
        false,

      reconsolidation_applied:
        false,
    },

    immutable:
      true,
  };

  return {
    ...eventBody,

    plasticity_event_hash:
      hashAgentRunValue(
        eventBody,
      ),
  };
}

function historyReferenceFor(
  event,
  effect,
) {
  return {
    schema_version:
      memoryPlasticityHistoryReferenceSchemaVersion,

    plasticity_event_id:
      event.plasticity_event_id,

    plasticity_event_hash:
      event.plasticity_event_hash,

    plasticity_effect_id:
      effect.plasticity_effect_id,

    source_retrieval_event_id:
      event.source_retrieval_event_id,

    source_retrieval_event_hash:
      event.source_retrieval_event_hash,

    character:
      event.character,

    source_memory_ref:
      effect.source_memory_ref,

    role:
      "retrieval_practice_registered",

    derived_index:
      true,
  };
}

function historyReferenceIdentity(
  reference,
) {
  return JSON.stringify([
    reference?.plasticity_event_id
    ?? null,
    reference?.plasticity_effect_id
    ?? null,
  ]);
}

function assertPersistedPlasticityEvent(
  event,
  eventId,
) {
  if (
    !isObject(event)
    || event.schema_version
      !== memoryPlasticityEventSchemaVersion
    || event.immutable !== true
    || optionalString(
      event.plasticity_event_id,
    ) !== eventId
    || !optionalString(
      event.plasticity_event_hash,
    )
  ) {
    const error = new Error(
      `Persisted MemoryPlasticityEvent ${eventId} is invalid.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_INVALID";
    throw error;
  }

  const hashBody =
    cloneJson(event);
  delete hashBody.plasticity_event_hash;

  if (
    hashAgentRunValue(hashBody)
    !== event.plasticity_event_hash
  ) {
    const error = new Error(
      `Persisted MemoryPlasticityEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_HASH_MISMATCH";
    throw error;
  }
}

function validateExistingPlasticityHistory(
  worldState,
  existingEvents,
) {
  if (
    Object.hasOwn(
      worldState,
      "memory_plasticity_events",
    )
    && !isObject(
      worldState.memory_plasticity_events,
    )
  ) {
    const error = new Error(
      "memory_plasticity_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(
      worldState,
      "memory_plasticity_history",
    )
    && !Array.isArray(
      worldState.memory_plasticity_history,
    )
  ) {
    const error = new Error(
      "memory_plasticity_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_INVALID";
    throw error;
  }

  const seen =
    new Set();

  for (
    const [index, reference]
    of array(
      worldState.memory_plasticity_history,
    ).entries()
  ) {
    const identity =
      historyReferenceIdentity(
        reference,
      );

    if (
      !isObject(reference)
      || reference.schema_version
        !== memoryPlasticityHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || reference.role
        !== "retrieval_practice_registered"
      || !optionalString(
        reference.plasticity_event_id,
      )
      || !optionalString(
        reference.plasticity_event_hash,
      )
      || !optionalString(
        reference.plasticity_effect_id,
      )
      || !optionalString(
        reference.character,
      )
      || !optionalString(
        reference.source_memory_ref,
      )
    ) {
      const error = new Error(
        `memory_plasticity_history[${index}] is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(identity)) {
      const error = new Error(
        `memory_plasticity_history contains duplicate reference ${identity}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(identity);

    const event =
      existingEvents[
        reference.plasticity_event_id
      ];

    if (!isObject(event)) {
      const error = new Error(
        `memory_plasticity_history cannot resolve MemoryPlasticityEvent ${reference.plasticity_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    assertPersistedPlasticityEvent(
      event,
      reference.plasticity_event_id,
    );

    if (
      optionalString(
        event.plasticity_event_hash,
      ) !== reference.plasticity_event_hash
    ) {
      const error = new Error(
        `memory_plasticity_history hash mismatch for ${reference.plasticity_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_HASH_MISMATCH";
      throw error;
    }

    const effect =
      array(event.effects)
        .find(
          (candidate) =>
            optionalString(
              candidate?.plasticity_effect_id,
            )
            === reference.plasticity_effect_id,
        );

    if (
      !effect
      || optionalString(event.character)
        !== reference.character
      || optionalString(
        effect.source_memory_ref,
      ) !== reference.source_memory_ref
    ) {
      const error = new Error(
        `memory_plasticity_history reference ${identity} does not match its canonical effect.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_EFFECT_MISMATCH";
      throw error;
    }
  }
}

function appendMissingHistoryReferences(
  baseHistory,
  references,
) {
  const output =
    array(baseHistory)
      .map(cloneJson);

  const seen =
    new Set(
      output.map(
        historyReferenceIdentity,
      ),
    );

  const appended = [];

  for (const reference of references) {
    const identity =
      historyReferenceIdentity(
        reference,
      );

    if (seen.has(identity)) continue;

    seen.add(identity);
    output.push(
      cloneJson(reference),
    );
    appended.push(
      cloneJson(reference),
    );
  }

  return {
    history:
      output,
    appended,
  };
}

export function buildWorldSimulationMemoryPlasticityContract() {
  return deepFreeze({
    version:
      worldSimulationMemoryPlasticityVersion,

    phase:
      "Phase64A-R1",

    status:
      "canonical_retrieval_practice_consequence_substrate_installed",

    plasticity_event_schema_version:
      memoryPlasticityEventSchemaVersion,

    plasticity_history_reference_schema_version:
      memoryPlasticityHistoryReferenceSchemaVersion,

    model_profile_schema_version:
      memoryPlasticityModelProfileSchemaVersion,

    model_profile_hash:
      memoryPlasticityModelProfileHash,

    source_retrieval_event_required:
      true,

    source_retrieval_event_hash_verified:
      true,

    one_plasticity_event_per_retrieval_event:
      true,

    zero_effect_event_persisted_for_processed_retrieval_event:
      true,

    per_memory_recovery_is_single_practice_effect:
      true,

    retrieval_event_batch_order:
      "occurred_at_then_turn_id_then_retrieval_event_id",

    deterministic_batch_order_is_not_same_timestamp_causal_precedence:
      true,

    recovery_occurrence_count_is_practice_count:
      false,

    partial_recovery_scope_preserved:
      true,

    non_target_recovery_registers_practice:
      true,

    contacted_only_candidate_registers_practice:
      false,

    failed_target_attempt_registers_successful_practice:
      false,

    plasticity_event_write_once_required:
      true,

    plasticity_history_append_only_required:
      true,

    plasticity_history_reference_stream_rebuildable:
      true,

    same_source_turn_feedback_allowed:
      false,

    future_accessibility_projection_installed:
      false,

    retrieval_difficulty_modeled:
      false,

    storage_strength_delta_modeled:
      false,

    retrieval_strength_delta_modeled:
      false,

    memory_content_rewrite_allowed:
      false,

    perceptual_certainty_rewrite_allowed:
      false,

    perceptual_clarity_rewrite_allowed:
      false,

    memory_source_rewrite_allowed:
      false,

    consolidation_modeled:
      false,

    reconsolidation_modeled:
      false,

    retrieval_induced_forgetting_modeled:
      false,

    native_world_loop_adoption_installed:
      true,

    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
  });
}

export function buildWorldSimulationMemoryPlasticity(
  input = {},
) {
  const worldState =
    cloneJson(
      object(input.world_state),
    );

  const requestedRetrievalEventIds =
    uniqueStrings(
      input.retrieval_event_ids,
    );

  if (!requestedRetrievalEventIds.length) {
    return deepFreeze({
      ok: true,
      version:
        worldSimulationMemoryPlasticityVersion,
      result: {
        processed_retrieval_event_ids: [],
        plasticity_events_created: [],
        already_persisted_plasticity_event_ids: [],
        history_references_appended: [],
        history_updates: [],
        state_transitions: [],
        preview_world_state:
          worldState,
        audit: {
          no_input_retrieval_events:
            true,
          synthetic_empty_containers_created:
            false,
          future_accessibility_projection_applied:
            false,
        },
      },
    });
  }

  const existingEvents =
    object(
      worldState.memory_plasticity_events,
    );

  validateExistingPlasticityHistory(
    worldState,
    existingEvents,
  );

  const sourceEvents =
    requestedRetrievalEventIds
      .map(
        (retrievalEventId) =>
          sourceRetrievalEvent(
            worldState,
            retrievalEventId,
          ),
      )
      .sort(compareRetrievalEvents);

  const retrievalEventIds =
    sourceEvents.map(
      (event) =>
        event.retrieval_event_id,
    );

  const sourceEventById =
    new Map(
      sourceEvents.map(
        (event) => [
          event.retrieval_event_id,
          event,
        ],
      ),
    );

  const preview =
    cloneJson(worldState);

  const createdEvents = [];
  const alreadyPersisted = [];
  const eventTransitions = [];
  const allReferences = [];

  for (const retrievalEventId of retrievalEventIds) {
    const retrievalEvent =
      sourceEventById.get(
        retrievalEventId,
      );

    const candidateEvent =
      plasticityEventFor(
        retrievalEvent,
      );

    const existing =
      existingEvents[
        candidateEvent.plasticity_event_id
      ];

    let authoritativeEvent;

    if (isObject(existing)) {
      assertPersistedPlasticityEvent(
        existing,
        candidateEvent.plasticity_event_id,
      );

      if (
        optionalString(
          existing.plasticity_event_hash,
        )
          !== candidateEvent.plasticity_event_hash
        || !sameValue(
          existing,
          candidateEvent,
        )
      ) {
        const error = new Error(
          `MemoryPlasticityEvent ${candidateEvent.plasticity_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }

      alreadyPersisted.push(
        candidateEvent.plasticity_event_id,
      );

      authoritativeEvent =
        existing;
    } else {
      createdEvents.push(
        candidateEvent,
      );

      preview.memory_plasticity_events =
        object(
          preview.memory_plasticity_events,
        );

      preview.memory_plasticity_events[
        candidateEvent.plasticity_event_id
      ] =
        cloneJson(candidateEvent);

      eventTransitions.push({
        entity:
          "world",

        field:
          `memory_plasticity_events.${candidateEvent.plasticity_event_id}`,

        from:
          null,

        to:
          cloneJson(candidateEvent),

        cause:
          `persist immutable MemoryPlasticityEvent ${candidateEvent.plasticity_event_id}`,

        source_layer:
          "memory_plasticity_history",
      });

      authoritativeEvent =
        candidateEvent;
    }

    for (
      const effect
      of array(
        authoritativeEvent.effects,
      )
    ) {
      allReferences.push(
        historyReferenceFor(
          authoritativeEvent,
          effect,
        ),
      );
    }
  }

  const historyBefore =
    array(
      worldState.memory_plasticity_history,
    );

  const historyAppend =
    appendMissingHistoryReferences(
      historyBefore,
      allReferences,
    );

  const historyTransitions = [];
  const historyUpdates = [];

  if (historyAppend.appended.length) {
    preview.memory_plasticity_history =
      cloneJson(
        historyAppend.history,
      );

    historyTransitions.push({
      entity:
        "world",

      field:
        "memory_plasticity_history",

      from:
        cloneJson(
          worldState.memory_plasticity_history
          ?? null,
        ),

      to:
        cloneJson(
          historyAppend.history,
        ),

      cause:
        `append ${historyAppend.appended.length} Phase64A memory plasticity history reference(s)`,

      source_layer:
        "memory_plasticity_history",
    });

    const byMemory =
      new Map();

    for (const reference of historyAppend.appended) {
      const key =
        JSON.stringify([
          reference.character,
          reference.source_memory_ref,
        ]);

      if (!byMemory.has(key)) {
        byMemory.set(
          key,
          {
            character:
              reference.character,
            memory_id:
              reference.source_memory_ref,
            appended_reference_count:
              0,
            plasticity_event_ids: [],
          },
        );
      }

      const update =
        byMemory.get(key);

      update.appended_reference_count += 1;
      update.plasticity_event_ids.push(
        reference.plasticity_event_id,
      );
    }

    historyUpdates.push(
      ...byMemory.values(),
    );
  }

  const stateTransitions = [
    ...eventTransitions,
    ...historyTransitions,
  ];

  return deepFreeze({
    ok: true,
    version:
      worldSimulationMemoryPlasticityVersion,
    result: {
      processed_retrieval_event_ids:
        retrievalEventIds,

      plasticity_events_created:
        createdEvents,

      already_persisted_plasticity_event_ids:
        alreadyPersisted,

      history_references_appended:
        historyAppend.appended,

      history_updates:
        historyUpdates,

      state_transitions:
        stateTransitions,

      preview_world_state:
        preview,

      audit: {
        source_retrieval_event_count:
          retrievalEventIds.length,

        created_plasticity_event_count:
          createdEvents.length,

        already_persisted_plasticity_event_count:
          alreadyPersisted.length,

        appended_history_reference_count:
          historyAppend.appended.length,

        same_source_turn_feedback_used:
          false,

        future_accessibility_projection_applied:
          false,

        memory_content_rewritten:
          false,

        quantitative_strength_delta_modeled:
          false,
      },
    },
  });
}
