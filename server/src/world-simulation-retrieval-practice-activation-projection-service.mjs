import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  memoryPlasticityEventSchemaVersion,
  memoryPlasticityHistoryReferenceSchemaVersion,
  worldSimulationMemoryPlasticityVersion,
} from "./world-simulation-memory-plasticity-service.mjs";

export const worldSimulationRetrievalPracticeActivationProjectionVersion =
  "phase64a-retrieval-practice-activation-projection-v1";

export const retrievalPracticeActivationProjectionModelProfileSchemaVersion =
  "phase64a-retrieval-practice-activation-model-profile-v1";

const activationDecayExponent = 0.5;
const minimumTraceAgeSeconds = 1;
const scoreTieEpsilon = 1e-12;

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
  code = "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_INVALID",
) {
  const text = optionalString(value);

  if (text) return text;

  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
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

function memoryIdFor(record, index) {
  if (!isObject(record)) {
    const error = new Error(
      `memory_records[${index}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_MEMORY_INVALID";
    throw error;
  }

  return requiredString(
    record.memory_id
      ?? record.id,
    `memory_records[${index}].memory_id`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_MEMORY_ID_REQUIRED",
  );
}

const activationModelProfile =
  deepFreeze({
    schema_version:
      retrievalPracticeActivationProjectionModelProfileSchemaVersion,

    model_mode:
      "retrieval_practice_recency_frequency_activation_v1",

    source_memory_plasticity_version:
      worldSimulationMemoryPlasticityVersion,

    source_event_schema_version:
      memoryPlasticityEventSchemaVersion,

    source_history_reference_schema_version:
      memoryPlasticityHistoryReferenceSchemaVersion,

    activation_equation:
      "ln(sum(max(age_seconds,1)^-0.5))",

    decay_exponent:
      activationDecayExponent,

    minimum_trace_age_seconds:
      minimumTraceAgeSeconds,

    successful_retrieval_practice_only:
      true,

    partial_and_whole_recovery_weighted_equally:
      true,

    target_and_non_target_recovery_weighted_equally:
      true,

    recovery_occurrence_count_used_as_practice_count:
      false,

    contacted_only_candidate_is_practice:
      false,

    failed_target_attempt_is_practice:
      false,

    same_source_turn_feedback_allowed:
      false,

    candidate_membership_change_allowed:
      false,

    cue_scope_expansion_allowed:
      false,

    semantic_similarity_expansion_allowed:
      false,

    stored_memory_content_rewrite_allowed:
      false,

    persistent_memory_order_rewrite_allowed:
      false,

    storage_strength_mutation_allowed:
      false,

    retrieval_strength_mutation_allowed:
      false,

    activation_probability_claimed:
      false,

    activation_score_is_simulator_priority_signal:
      true,
  });

export const retrievalPracticeActivationProjectionModelProfileHash =
  hashAgentRunValue(
    activationModelProfile,
  );

function validateMemorySnapshot(records) {
  const byId = new Map();
  const snapshot = array(records)
    .map((record, index) => {
      const memoryId = memoryIdFor(record, index);

      if (byId.has(memoryId)) {
        const error = new Error(
          `Duplicate memory_id in retrieval-practice activation snapshot: ${memoryId}.`,
        );
        error.code =
          "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_MEMORY_DUPLICATE";
        throw error;
      }

      const entry = {
        memory_id: memoryId,
        original_index: index,
        record: cloneJson(record),
      };

      byId.set(memoryId, entry);
      return entry;
    });

  return {
    snapshot,
    by_id: byId,
  };
}

function validatePlasticityEvent(event, eventId, expectedHash) {
  if (
    !isObject(event)
    || event.schema_version
      !== memoryPlasticityEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.plasticity_event_id)
      !== eventId
  ) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} is not a valid immutable Phase64A-R1 event.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EVENT_INVALID";
    throw error;
  }

  const storedHash = requiredString(
    event.plasticity_event_hash,
    `memory_plasticity_events.${eventId}.plasticity_event_hash`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EVENT_HASH_REQUIRED",
  );

  if (
    expectedHash
    && expectedHash !== storedHash
  ) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} does not match its history reference hash.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_EVENT_HASH_MISMATCH";
    throw error;
  }

  const hashBody = cloneJson(event);
  delete hashBody.plasticity_event_hash;

  const actualHash = hashAgentRunValue(hashBody);

  if (actualHash !== storedHash) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EVENT_HASH_MISMATCH";
    error.expected_hash = storedHash;
    error.actual_hash = actualHash;
    throw error;
  }

  return event;
}

function validatePracticeReference(
  reference,
  index,
  context,
) {
  if (!isObject(reference)) {
    const error = new Error(
      `memory_plasticity_history[${index}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID";
    throw error;
  }

  if (
    reference.schema_version
    !== memoryPlasticityHistoryReferenceSchemaVersion
  ) {
    return {
      status: "unsupported_history_reference_schema",
    };
  }

  if (
    optionalString(reference.character)
    !== context.character
  ) {
    return {
      status: "other_character",
    };
  }

  if (
    optionalString(reference.role)
    !== "retrieval_practice_registered"
    || reference.derived_index !== true
  ) {
    const error = new Error(
      `memory_plasticity_history[${index}] is not a canonical retrieval-practice reference.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID";
    throw error;
  }

  const memoryId = requiredString(
    reference.source_memory_ref,
    `memory_plasticity_history[${index}].source_memory_ref`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID",
  );

  if (!context.memory_by_id.has(memoryId)) {
    return {
      status: "memory_outside_current_snapshot",
      memory_id: memoryId,
    };
  }

  const eventId = requiredString(
    reference.plasticity_event_id,
    `memory_plasticity_history[${index}].plasticity_event_id`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID",
  );

  const effectId = requiredString(
    reference.plasticity_effect_id,
    `memory_plasticity_history[${index}].plasticity_effect_id`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID",
  );

  const referenceIdentity =
    `${eventId}:${effectId}`;

  if (context.seen_reference_ids.has(referenceIdentity)) {
    const error = new Error(
      `Duplicate retrieval-practice history reference: ${referenceIdentity}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_DUPLICATE_REFERENCE";
    throw error;
  }

  context.seen_reference_ids.add(referenceIdentity);

  const eventHash = requiredString(
    reference.plasticity_event_hash,
    `memory_plasticity_history[${index}].plasticity_event_hash`,
    "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID",
  );

  const event = validatePlasticityEvent(
    object(context.events[eventId]),
    eventId,
    eventHash,
  );

  if (
    optionalString(event.character)
    !== context.character
  ) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} character does not match its history reference.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EVENT_CHARACTER_MISMATCH";
    throw error;
  }

  const effect = array(event.effects)
    .find(
      (candidate) =>
        optionalString(candidate?.plasticity_effect_id)
        === effectId,
    );

  if (
    !isObject(effect)
    || optionalString(effect.source_memory_ref)
      !== memoryId
    || effect.retrieval_practice_registered !== true
    || effect.source_memory_reactivation_occurred !== true
  ) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} does not contain the referenced retrieval-practice effect ${effectId}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EFFECT_INVALID";
    throw error;
  }

  if (
    optionalString(event.source_turn_id)
    === context.current_turn_id
  ) {
    return {
      status: "same_source_turn_excluded",
      memory_id: memoryId,
      plasticity_event_id: eventId,
      plasticity_effect_id: effectId,
    };
  }

  const occurredAtMs = timestampMs(event.occurred_at);

  if (occurredAtMs === null) {
    return {
      status: "event_time_unavailable",
      memory_id: memoryId,
      plasticity_event_id: eventId,
      plasticity_effect_id: effectId,
    };
  }

  if (occurredAtMs > context.as_of_ms) {
    const error = new Error(
      `MemoryPlasticityEvent ${eventId} occurs after the activation projection time.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_FUTURE_EVENT";
    throw error;
  }

  const ageSeconds = Math.max(
    minimumTraceAgeSeconds,
    (context.as_of_ms - occurredAtMs) / 1000,
  );

  const activationContribution =
    ageSeconds ** (-activationDecayExponent);

  return {
    status: "qualifying_prior_practice",
    memory_id: memoryId,
    plasticity_event_id: eventId,
    plasticity_effect_id: effectId,
    source_retrieval_event_id:
      event.source_retrieval_event_id
      ?? null,
    source_turn_id:
      event.source_turn_id
      ?? null,
    occurred_at:
      event.occurred_at,
    age_seconds:
      ageSeconds,
    activation_contribution:
      activationContribution,
    target_relation:
      effect.target_relation
      ?? null,
    recovery_extent:
      effect.recovery_extent
      ?? null,
  };
}

function activationEvidenceFor(snapshot, tracesByMemory, exclusionsByMemory) {
  return snapshot.map((entry) => {
    const traces = tracesByMemory.get(entry.memory_id)
      ?? [];
    const exclusions = exclusionsByMemory.get(entry.memory_id)
      ?? [];

    const activationMass = traces.reduce(
      (sum, trace) =>
        sum + trace.activation_contribution,
      0,
    );

    const activationScore =
      activationMass > 0
        ? Math.log(activationMass)
        : null;

    let latestPractice = null;
    let latestPracticeMs = null;

    for (const trace of traces) {
      const candidateMs = timestampMs(trace.occurred_at);

      if (
        candidateMs !== null
        && (
          latestPracticeMs === null
          || candidateMs > latestPracticeMs
        )
      ) {
        latestPracticeMs = candidateMs;
        latestPractice = trace.occurred_at;
      }
    }

    return {
      memory_id:
        entry.memory_id,

      original_index:
        entry.original_index,

      qualifying_prior_practice_count:
        traces.length,

      latest_qualifying_practice_at:
        latestPractice,

      activation_mass:
        activationMass,

      activation_score:
        activationScore,

      activation_score_origin:
        traces.length
          ? "phase64a_r1_prior_practice_history"
          : "no_prior_practice_signal",

      scalar_activation_is_literal_human_probability:
        false,

      retrieval_success_forced:
        false,

      same_source_turn_reference_count_excluded:
        exclusions.filter(
          (item) =>
            item.status
            === "same_source_turn_excluded",
        ).length,

      untimed_reference_count_excluded:
        exclusions.filter(
          (item) =>
            item.status
            === "event_time_unavailable",
        ).length,

      practice_traces:
        cloneJson(traces),
    };
  });
}

function rankEvidence(evidence) {
  return [...evidence]
    .sort((left, right) => {
      const leftScore = left.activation_score;
      const rightScore = right.activation_score;
      const leftFinite = Number.isFinite(leftScore);
      const rightFinite = Number.isFinite(rightScore);

      if (
        leftFinite
        && rightFinite
        && Math.abs(leftScore - rightScore)
          > scoreTieEpsilon
      ) {
        return rightScore - leftScore;
      }

      if (leftFinite && !rightFinite) return -1;
      if (!leftFinite && rightFinite) return 1;

      return left.original_index - right.original_index;
    })
    .map(
      (entry, projectedIndex) => ({
        ...entry,
        projected_index:
          projectedIndex,
        projected_rank:
          projectedIndex + 1,
      }),
    );
}

export function buildWorldSimulationRetrievalPracticeActivationProjectionContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,

    model_profile_schema_version:
      retrievalPracticeActivationProjectionModelProfileSchemaVersion,

    model_profile_hash:
      retrievalPracticeActivationProjectionModelProfileHash,

    source_memory_plasticity_version:
      worldSimulationMemoryPlasticityVersion,

    source_is_phase64a_r1_immutable_history:
      true,

    future_accessibility_projection_installed:
      true,

    projection_occurs_before_phase63b_candidate_freeze:
      true,

    phase63b_candidate_membership_authority_preserved:
      true,

    phase63c_dynamic_frontier_reuses_projected_snapshot_order:
      true,

    projection_changes_ephemeral_memory_search_order_only:
      true,

    persistent_world_memory_order_mutated:
      false,

    source_memory_content_mutated:
      false,

    storage_strength_mutated:
      false,

    retrieval_strength_mutated:
      false,

    cue_scope_expanded:
      false,

    semantic_similarity_used:
      false,

    same_source_turn_feedback_allowed:
      false,

    recovery_occurrence_count_is_practice_count:
      false,

    partial_recovery_receives_fractional_weight:
      false,

    non_target_recovery_is_real_practice:
      true,

    contacted_only_candidate_is_practice:
      false,

    failed_target_attempt_is_practice:
      false,

    activation_score_is_simulator_priority_signal:
      true,

    activation_score_is_literal_human_retrieval_probability:
      false,

    retrieval_success_forced_by_projection:
      false,

    projection_persisted_as_new_memory_strength:
      false,

    world_loop_adoption_required:
      true,
  });
}

export function projectWorldSimulationRetrievalPracticeActivation(
  input = {},
) {
  const worldState = object(input.world_state);
  const character = requiredString(
    input.character,
    "character",
  );
  const currentTurnId = requiredString(
    input.current_turn_id
      ?? input.turn_id,
    "current_turn_id",
  );

  const asOf =
    input.as_of
    ?? input.simulation_time
    ?? worldState.simulation_time
    ?? null;

  const asOfMs = timestampMs(asOf);

  if (asOfMs === null) {
    const error = new Error(
      "Phase64A-R2 requires an explicit current simulation time for recency projection.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_TIME_REQUIRED";
    throw error;
  }

  const {
    snapshot,
    by_id: memoryById,
  } = validateMemorySnapshot(
    input.memory_records,
  );

  const events = object(
    worldState.memory_plasticity_events,
  );
  const history = array(
    worldState.memory_plasticity_history,
  );

  const tracesByMemory = new Map();
  const exclusionsByMemory = new Map();
  const seenReferenceIds = new Set();

  let unsupportedHistoryReferenceCount = 0;
  let otherCharacterReferenceCount = 0;
  let outOfSnapshotReferenceCount = 0;
  let sameSourceTurnReferenceCountExcluded = 0;
  let untimedReferenceCountExcluded = 0;
  let qualifyingPriorPracticeReferenceCount = 0;

  const context = {
    character,
    current_turn_id:
      currentTurnId,
    as_of_ms:
      asOfMs,
    memory_by_id:
      memoryById,
    events,
    seen_reference_ids:
      seenReferenceIds,
  };

  for (
    let index = 0;
    index < history.length;
    index += 1
  ) {
    const resolved =
      validatePracticeReference(
        history[index],
        index,
        context,
      );

    if (
      resolved.status
      === "unsupported_history_reference_schema"
    ) {
      unsupportedHistoryReferenceCount += 1;
      continue;
    }

    if (resolved.status === "other_character") {
      otherCharacterReferenceCount += 1;
      continue;
    }

    if (
      resolved.status
      === "memory_outside_current_snapshot"
    ) {
      outOfSnapshotReferenceCount += 1;
      continue;
    }

    if (
      resolved.status
      === "same_source_turn_excluded"
      || resolved.status
      === "event_time_unavailable"
    ) {
      if (!exclusionsByMemory.has(resolved.memory_id)) {
        exclusionsByMemory.set(
          resolved.memory_id,
          [],
        );
      }

      exclusionsByMemory
        .get(resolved.memory_id)
        .push(resolved);

      if (
        resolved.status
        === "same_source_turn_excluded"
      ) {
        sameSourceTurnReferenceCountExcluded += 1;
      } else {
        untimedReferenceCountExcluded += 1;
      }

      continue;
    }

    if (
      resolved.status
      !== "qualifying_prior_practice"
    ) {
      continue;
    }

    if (!tracesByMemory.has(resolved.memory_id)) {
      tracesByMemory.set(
        resolved.memory_id,
        [],
      );
    }

    tracesByMemory
      .get(resolved.memory_id)
      .push(resolved);

    qualifyingPriorPracticeReferenceCount += 1;
  }

  const evidence =
    activationEvidenceFor(
      snapshot,
      tracesByMemory,
      exclusionsByMemory,
    );

  const rankedEvidence =
    rankEvidence(evidence);

  const snapshotById =
    new Map(
      snapshot.map(
        (entry) => [
          entry.memory_id,
          entry,
        ]),
    );

  const projectedMemoryRecords =
    rankedEvidence.map(
      (entry) =>
        cloneJson(
          snapshotById.get(
            entry.memory_id,
          ).record,
        ),
    );

  const inputMemoryIds =
    snapshot.map(
      (entry) =>
        entry.memory_id,
    );

  const projectedMemoryIds =
    rankedEvidence.map(
      (entry) =>
        entry.memory_id,
    );

  const projectionId =
    `retrieval_practice_activation_projection_${hashAgentRunValue({
      version:
        worldSimulationRetrievalPracticeActivationProjectionVersion,
      model_profile_hash:
        retrievalPracticeActivationProjectionModelProfileHash,
      character,
      current_turn_id:
        currentTurnId,
      as_of:
        asOf,
      input_memory_ids:
        inputMemoryIds,
      projected_memory_ids:
        projectedMemoryIds,
      qualifying_prior_practice_reference_count:
        qualifyingPriorPracticeReferenceCount,
    }).slice(0, 24)}`;

  return deepFreeze({
    version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,

    projection_id:
      projectionId,

    character,

    current_turn_id:
      currentTurnId,

    as_of:
      cloneJson(asOf),

    model_profile_schema_version:
      retrievalPracticeActivationProjectionModelProfileSchemaVersion,

    model_profile_hash:
      retrievalPracticeActivationProjectionModelProfileHash,

    input_memory_ids:
      inputMemoryIds,

    projected_memory_ids:
      projectedMemoryIds,

    projected_memory_records:
      projectedMemoryRecords,

    activation_evidence:
      rankedEvidence,

    audit: {
      projection_applied:
        true,

      activation_equation:
        activationModelProfile
          .activation_equation,

      decay_exponent:
        activationDecayExponent,

      minimum_trace_age_seconds:
        minimumTraceAgeSeconds,

      input_memory_count:
        snapshot.length,

      projected_memory_count:
        projectedMemoryRecords.length,

      memory_membership_preserved:
        inputMemoryIds.length
        === projectedMemoryIds.length
        && inputMemoryIds.every(
          (memoryId) =>
            projectedMemoryIds.includes(memoryId),
        ),

      source_world_state_mutated:
        false,

      stored_memory_content_rewritten:
        false,

      persistent_memory_order_rewritten:
        false,

      storage_strength_mutated:
        false,

      retrieval_strength_mutated:
        false,

      candidate_pool_expanded:
        false,

      cue_scope_expanded:
        false,

      semantic_similarity_used:
        false,

      retrieval_success_forced:
        false,

      activation_score_used_as_literal_human_probability:
        false,

      qualifying_prior_practice_reference_count:
        qualifyingPriorPracticeReferenceCount,

      same_source_turn_reference_count_excluded:
        sameSourceTurnReferenceCountExcluded,

      untimed_reference_count_excluded:
        untimedReferenceCountExcluded,

      unsupported_history_reference_count:
        unsupportedHistoryReferenceCount,

      other_character_reference_count:
        otherCharacterReferenceCount,

      out_of_snapshot_reference_count:
        outOfSnapshotReferenceCount,

      current_turn_id:
        currentTurnId,
    },
  });
}
