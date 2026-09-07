import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationChronologicalMutationQueueVersion = "phase62j-chronological-mutation-queue-v1";
export const worldSimulationMutationExecutorVersion = "phase62k-authoritative-mutation-executor-v1";

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

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
}

function canonicalTime(value) {
  return Math.round(nonNegativeNumber(value, 0) * 1e6) / 1e6;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function transitionSourceLayer(transition) {
  const explicit = String(transition?.source_layer ?? "").trim();
  if (explicit) return explicit;
  const adjudication = String(transition?.adjudication ?? "");
  if (adjudication.includes("continuous_actor_state")) return "continuous_actor_state";
  if (adjudication.includes("continuous_physics")) return "continuous_physics";
  if (adjudication.includes("combat_causal")) return "combat";
  if (adjudication.includes("global_causal_timeline")) return "global_timeline";
  if (adjudication.includes("causal_rule_engine")) return "spatial_rules";
  return "causal_resolution";
}

function inferredTransitionTime(transition, input) {
  const exact = finiteNumber(transition?.time_ms);
  if (exact !== null && exact >= 0) {
    return { time_ms: canonicalTime(exact), precision: "exact" };
  }

  const timeline = object(input.causal_timeline);
  const actor = String(transition?.entity ?? "");
  const field = String(transition?.field ?? "");
  if (field === "position" && actor) {
    const trajectory = object(object(timeline.actor_trajectories)[actor]);
    const interrupted = finiteNumber(trajectory.interrupted_at_ms);
    const completion = finiteNumber(trajectory.completion_time_ms);
    if (interrupted !== null) {
      return { time_ms: canonicalTime(interrupted), precision: "trajectory_inferred" };
    }
    if (completion !== null) {
      return { time_ms: canonicalTime(completion), precision: "trajectory_inferred" };
    }
  }

  if (String(transition?.entity ?? "") === "world" && field === "simulation_time") {
    return { time_ms: canonicalTime(input.elapsed_ms), precision: "turn_end_inferred" };
  }

  return { time_ms: canonicalTime(input.elapsed_ms), precision: "turn_end_inferred" };
}

function mutationPath(transition) {
  const entity = String(transition?.entity ?? "<unknown>");
  const field = String(transition?.field ?? "<unknown>");
  const sceneId = String(transition?.scene_id ?? "");
  return `${sceneId ? `scene:${sceneId}:` : ""}${entity}.${field}`;
}

function sourcePriority(layer) {
  const priorities = new Map([
    ["continuous_physics", 10],
    ["combat", 20],
    ["continuous_actor_state", 30],
    ["spatial_rules", 40],
    ["global_timeline", 50],
    ["causal_resolution", 90],
  ]);
  return priorities.get(layer) ?? 99;
}

function normalizeMutation(transition, index, input) {
  const timing = inferredTransitionTime(transition, input);
  const sourceLayer = transitionSourceLayer(transition);
  const normalized = {
    mutation_id: null,
    transition_index: index,
    time_ms: timing.time_ms,
    time_precision: timing.precision,
    source_layer: sourceLayer,
    entity: transition?.entity ?? null,
    field: transition?.field ?? null,
    mutation_path: mutationPath(transition),
    from: cloneJson(transition?.from),
    to: cloneJson(transition?.to),
    cause: transition?.cause ?? null,
    actor: transition?.actor ?? null,
    action_id: transition?.action_id ?? null,
    scene_id: transition?.scene_id ?? null,
    adjudication: transition?.adjudication ?? null,
  };
  normalized.mutation_id = `mutation_${hashAgentRunValue({
    version: worldSimulationChronologicalMutationQueueVersion,
    turn_id: input.turn_id ?? null,
    transition_index: index,
    time_ms: normalized.time_ms,
    source_layer: sourceLayer,
    entity: normalized.entity,
    field: normalized.field,
    from: normalized.from,
    to: normalized.to,
    cause: normalized.cause,
  }).slice(0, 24)}`;
  return normalized;
}


function mutationWritePriority(mutation) {
  const field = String(mutation?.field ?? "");
  if (field === "ability_field_state" || field === "projectile_state") return 90;
  return 10;
}

function stableSortMutations(mutations) {
  return [...mutations].sort((left, right) => (
    left.time_ms - right.time_ms
    || sourcePriority(left.source_layer) - sourcePriority(right.source_layer)
    || mutationWritePriority(left) - mutationWritePriority(right)
    || String(left.mutation_path ?? "").localeCompare(String(right.mutation_path ?? ""), "zh-Hant-TW")
    || left.transition_index - right.transition_index
  ));
}

function pointEventsForBatch(timelineEntries, timeMs) {
  return array(timelineEntries)
    .filter((entry) => Math.abs(nonNegativeNumber(entry?.time_ms, 0) - timeMs) <= 1e-6)
    .map((entry) => ({
      kind: entry?.kind ?? null,
      actor: entry?.actor ?? null,
      action_id: entry?.action_id ?? null,
      target: entry?.target ?? null,
      projectile_id: entry?.projectile_id ?? null,
      field_id: entry?.field_id ?? null,
      result: entry?.result ?? null,
    }));
}

function buildBatches(mutations, input) {
  const grouped = [];
  for (const mutation of mutations) {
    const last = grouped[grouped.length - 1];
    if (!last || Math.abs(last.time_ms - mutation.time_ms) > 1e-6) {
      grouped.push({ time_ms: mutation.time_ms, mutations: [mutation] });
    } else {
      last.mutations.push(mutation);
    }
  }

  const projection = new Map();
  const continuityWarnings = [];
  let chainHash = hashAgentRunValue({
    version: worldSimulationChronologicalMutationQueueVersion,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    seed: "chronological-mutation-queue",
  });

  return {
    batches: grouped.map((group, batchIndex) => {
      const beforeHash = chainHash;
      const samePathCounts = new Map();
      for (const mutation of group.mutations) {
        const path = mutation.mutation_path;
        samePathCounts.set(path, (samePathCounts.get(path) ?? 0) + 1);
        if (projection.has(path) && !sameValue(projection.get(path), mutation.from)) {
          continuityWarnings.push({
            mutation_id: mutation.mutation_id,
            mutation_path: path,
            time_ms: mutation.time_ms,
            expected_from: cloneJson(projection.get(path)),
            declared_from: cloneJson(mutation.from),
            reason: "declared_from_does_not_match_prior_queued_to",
          });
        }
        projection.set(path, cloneJson(mutation.to));
      }
      const samePathReductions = [...samePathCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([path, count]) => ({ mutation_path: path, mutation_count: count }));
      chainHash = hashAgentRunValue({
        previous_hash: beforeHash,
        batch_index: batchIndex,
        time_ms: group.time_ms,
        mutations: group.mutations,
      });
      return {
        batch_id: `mutation_batch_${batchIndex.toString().padStart(4, "0")}`,
        batch_index: batchIndex,
        time_ms: group.time_ms,
        mutation_revision_from: batchIndex,
        mutation_revision_to: batchIndex + 1,
        read_semantics: "causal_subsystems_resolve_same_timestamp_inputs_before_execution; executor_checks_declared_from_to_continuity",
        commit_semantics: "same_timestamp_batch_commits_atomically",
        deterministic_write_order_does_not_create_world_time_precedence: true,
        same_timestamp_does_not_create_preemption: true,
        point_events: pointEventsForBatch(object(input.causal_timeline).entries, group.time_ms),
        same_path_reductions: samePathReductions,
        mutations: group.mutations,
        chain_hash_before: beforeHash,
        chain_hash_after: chainHash,
      };
    }),
    continuityWarnings,
    finalProjection: Object.fromEntries([...projection.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-Hant-TW"))),
    finalChainHash: chainHash,
  };
}


function splitFieldPath(field) {
  return String(field ?? "").split(".").filter(Boolean);
}

function sceneContainerPath(worldState, sceneId) {
  if (sceneId && isObject(worldState?.scenes) && Object.hasOwn(worldState.scenes, sceneId)) {
    return ["scenes", sceneId];
  }
  return ["scene_state"];
}

function obstacleIndex(worldState, sceneId, obstacleId) {
  const base = sceneContainerPath(worldState, sceneId);
  let scene = worldState;
  for (const key of base) scene = object(scene?.[key]);
  return array(scene.obstacles).findIndex((item) => String(item?.id ?? item?.obstacle_id ?? "") === String(obstacleId ?? ""));
}

function mutationWorldPath(mutation, worldState, previewWorldState, defaultSceneId = null) {
  const entity = String(mutation?.entity ?? "");
  const field = String(mutation?.field ?? "");
  const sceneId = String(mutation?.scene_id ?? defaultSceneId ?? "") || null;
  const characterExists = Object.hasOwn(object(worldState?.characters), entity)
    || Object.hasOwn(object(previewWorldState?.characters), entity);
  const objectExists = Object.hasOwn(object(worldState?.objects), entity)
    || Object.hasOwn(object(previewWorldState?.objects), entity);
  const fieldExists = Object.hasOwn(object(worldState?.ability_fields), entity)
    || Object.hasOwn(object(previewWorldState?.ability_fields), entity);

  if (entity === "world") return splitFieldPath(field);
  if (sceneId && entity === sceneId && field === "simulation_time") return [...sceneContainerPath(worldState, sceneId), "simulation_time"];
  if (field === "position" && objectExists) return ["objects", entity, "position"];
  if (field === "position" && characterExists) return [...sceneContainerPath(worldState, sceneId), "entity_positions", entity];
  if (field === "open") return [...sceneContainerPath(worldState, sceneId), "doors", entity, "open"];
  if (field === "projectile" || field === "projectile_state") return ["projectiles", entity];
  if (field === "ability_field" || field === "ability_field_state") return ["ability_fields", entity];
  if (characterExists) return ["characters", entity, ...splitFieldPath(field)];
  if (objectExists) return ["objects", entity, ...splitFieldPath(field)];
  if (fieldExists) return ["ability_fields", entity, ...splitFieldPath(field)];

  const obstacle = obstacleIndex(previewWorldState ?? worldState, sceneId, entity);
  if (obstacle >= 0) return [...sceneContainerPath(previewWorldState ?? worldState, sceneId), "obstacles", obstacle, ...splitFieldPath(field)];
  return null;
}
function getAtPath(root, pathParts) {
  let value = root;
  for (const key of pathParts) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}

const phase63cRetrievalHistoryProtectedFields = new Set([
  "retrieval_history",
  "retrieval_history_legacy_baseline",
]);

function phase63cMemoryId(record) {
  return String(record?.memory_id ?? record?.id ?? "").trim();
}

function assertRetrievalHistoryPrefix(oldHistory, newHistory, memoryId) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      `Retrieval history for ${memoryId} is append-only.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        `Retrieval history for ${memoryId} changed an existing entry or order.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function assertPhase63CRetrievalPersistenceMutation(
  worldState,
  worldPath,
  mutation,
) {
  if (worldPath[0] === "retrieval_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "RetrievalEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId = String(worldPath[1] ?? "");
    const existing = getAtPath(worldState, worldPath);

    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `RetrievalEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next = mutation?.to;

    if (
      !isObject(next)
      || next.immutable !== true
      || String(next.retrieval_event_id ?? "") !== eventId
      || !String(next.retrieval_event_hash ?? "").trim()
    ) {
      const error = new Error(
        `RetrievalEvent ${eventId} creation payload is not a valid immutable event.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    return;
  }

  if (worldPath[0] !== "memories") return;

  if (
    worldPath.length > 2
    && worldPath.some((part) =>
      phase63cRetrievalHistoryProtectedFields.has(String(part))
    )
  ) {
    const error = new Error(
      "Retrieval history and legacy baselines may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  if (worldPath.length !== 2) return;

  const beforeRecords = array(getAtPath(worldState, worldPath));
  const afterRecords = array(mutation?.to);
  const afterById = new Map(
    afterRecords
      .map((record) => [phase63cMemoryId(record), record])
      .filter(([memoryId]) => memoryId),
  );

  for (const beforeRecord of beforeRecords) {
    const memoryId = phase63cMemoryId(beforeRecord);
    if (!memoryId) continue;

    const oldHistory = array(beforeRecord?.retrieval_history);
    const oldBaseline =
      beforeRecord?.retrieval_history_legacy_baseline;

    const hasProtectedHistory =
      oldHistory.length > 0
      || oldBaseline !== undefined;

    const afterRecord = afterById.get(memoryId);

    if (!afterRecord) {
      if (hasProtectedHistory) {
        const error = new Error(
          `Memory ${memoryId} with persisted retrieval history cannot be removed by a generic memory-array mutation.`,
        );
        error.code =
          "WORLD_SIMULATION_RETRIEVAL_HISTORY_APPEND_ONLY_VIOLATION";
        throw error;
      }
      continue;
    }

    assertRetrievalHistoryPrefix(
      oldHistory,
      afterRecord?.retrieval_history,
      memoryId,
    );

    if (
      oldBaseline !== undefined
      && !sameValue(
        oldBaseline,
        afterRecord?.retrieval_history_legacy_baseline,
      )
    ) {
      const error = new Error(
        `Retrieval legacy baseline for ${memoryId} is immutable.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_HISTORY_LEGACY_BASELINE_IMMUTABILITY_VIOLATION";
      throw error;
    }
  }
}

const phase64aMemoryPlasticityHistoryReferenceSchema =
  "phase64a-memory-plasticity-history-ref-v1";

function phase64aPlasticityHistoryReferenceIdentity(reference) {
  return JSON.stringify([
    reference?.plasticity_event_id
    ?? null,
    reference?.plasticity_effect_id
    ?? null,
  ]);
}

function assertPhase64APlasticityHistoryPrefix(
  oldHistory,
  newHistory,
) {
  const oldValues =
    array(oldHistory);
  const newValues =
    array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      "Memory plasticity history is append-only.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (
    let index = 0;
    index < oldValues.length;
    index += 1
  ) {
    if (
      !sameValue(
        oldValues[index],
        newValues[index],
      )
    ) {
      const error = new Error(
        "Memory plasticity history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function assertPhase64AMemoryPlasticityMutation(
  worldState,
  worldPath,
  mutation,
) {
  if (
    worldPath[0]
      === "memory_plasticity_events"
  ) {
    if (worldPath.length !== 2) {
      const error = new Error(
        "MemoryPlasticityEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId =
      String(worldPath[1] ?? "");

    const existing =
      getAtPath(
        worldState,
        worldPath,
      );

    if (
      existing !== undefined
      && existing !== null
    ) {
      const error = new Error(
        `MemoryPlasticityEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next =
      mutation?.to;

    if (
      !isObject(next)
      || next.immutable !== true
      || String(
        next.plasticity_event_id
        ?? "",
      ) !== eventId
      || !String(
        next.plasticity_event_hash
        ?? "",
      ).trim()
      || !String(
        next.source_retrieval_event_id
        ?? "",
      ).trim()
      || !String(
        next.source_retrieval_event_hash
        ?? "",
      ).trim()
    ) {
      const error = new Error(
        `MemoryPlasticityEvent ${eventId} creation payload is not a valid immutable event.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const hashBody =
      cloneJson(next);
    delete hashBody.plasticity_event_hash;

    if (
      hashAgentRunValue(hashBody)
      !== next.plasticity_event_hash
    ) {
      const error = new Error(
        `MemoryPlasticityEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_HASH_MISMATCH";
      throw error;
    }

    const sourceRetrievalEvent =
      object(
        object(worldState?.retrieval_events)[
          next.source_retrieval_event_id
        ],
      );

    if (!Object.keys(sourceRetrievalEvent).length) {
      const error = new Error(
        `MemoryPlasticityEvent ${eventId} cannot resolve source RetrievalEvent ${next.source_retrieval_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_SOURCE_RETRIEVAL_EVENT_UNRESOLVED";
      throw error;
    }

    if (
      String(
        sourceRetrievalEvent.retrieval_event_hash
        ?? "",
      )
      !== next.source_retrieval_event_hash
    ) {
      const error = new Error(
        `MemoryPlasticityEvent ${eventId} source RetrievalEvent hash does not match.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_SOURCE_RETRIEVAL_EVENT_HASH_MISMATCH";
      throw error;
    }

    const seenEffectIds =
      new Set();

    for (const effect of array(next.effects)) {
      const effectId =
        String(
          effect?.plasticity_effect_id
          ?? "",
        ).trim();

      if (
        !effectId
        || seenEffectIds.has(effectId)
        || !String(
          effect?.source_memory_ref
          ?? "",
        ).trim()
        || effect?.retrieval_practice_registered
          !== true
      ) {
        const error = new Error(
          `MemoryPlasticityEvent ${eventId} contains an invalid or duplicate practice effect.`,
        );
        error.code =
          "WORLD_SIMULATION_MEMORY_PLASTICITY_EVENT_EFFECT_INVALID";
        throw error;
      }

      seenEffectIds.add(effectId);
    }

    return;
  }

  if (
    worldPath[0]
      !== "memory_plasticity_history"
  ) {
    return;
  }

  if (worldPath.length !== 1) {
    const error = new Error(
      "Memory plasticity history may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory =
    array(
      getAtPath(
        worldState,
        worldPath,
      ),
    );

  const newHistory =
    array(mutation?.to);

  assertPhase64APlasticityHistoryPrefix(
    oldHistory,
    newHistory,
  );

  const seen =
    new Set(
      oldHistory.map(
        phase64aPlasticityHistoryReferenceIdentity,
      ),
    );

  for (
    let index = oldHistory.length;
    index < newHistory.length;
    index += 1
  ) {
    const reference =
      newHistory[index];

    const identity =
      phase64aPlasticityHistoryReferenceIdentity(
        reference,
      );

    if (
      !isObject(reference)
      || reference.schema_version
        !== phase64aMemoryPlasticityHistoryReferenceSchema
      || reference.derived_index !== true
      || reference.role
        !== "retrieval_practice_registered"
      || !String(
        reference.plasticity_event_id
        ?? "",
      ).trim()
      || !String(
        reference.plasticity_event_hash
        ?? "",
      ).trim()
      || !String(
        reference.plasticity_effect_id
        ?? "",
      ).trim()
      || !String(
        reference.character
        ?? "",
      ).trim()
      || !String(
        reference.source_memory_ref
        ?? "",
      ).trim()
    ) {
      const error = new Error(
        `Memory plasticity history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(identity)) {
      const error = new Error(
        `Memory plasticity history contains duplicate reference ${identity}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(identity);

    const event =
      object(
        object(
          worldState
            ?.memory_plasticity_events,
        )[
          reference.plasticity_event_id
        ],
      );

    if (!Object.keys(event).length) {
      const error = new Error(
        `Memory plasticity history cannot resolve MemoryPlasticityEvent ${reference.plasticity_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    if (
      String(
        event.plasticity_event_hash
        ?? "",
      )
      !== reference.plasticity_event_hash
    ) {
      const error = new Error(
        `Memory plasticity history hash mismatch for ${reference.plasticity_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_HASH_MISMATCH";
      throw error;
    }

    const effect =
      array(event.effects)
        .find(
          (candidate) =>
            String(
              candidate?.plasticity_effect_id
              ?? "",
            )
            === reference.plasticity_effect_id,
        );

    if (
      !effect
      || String(
        event.character
        ?? "",
      ) !== reference.character
      || String(
        effect.source_memory_ref
        ?? "",
      ) !== reference.source_memory_ref
    ) {
      const error = new Error(
        `Memory plasticity history reference ${identity} does not match its canonical effect.`,
      );
      error.code =
        "WORLD_SIMULATION_MEMORY_PLASTICITY_HISTORY_REFERENCE_EFFECT_MISMATCH";
      throw error;
    }
  }
}

const phase65aSubjectiveClaimProjectionVersion =
  "phase65a-evidence-backed-subjective-claim-projection-v1";

const phase65aSubjectiveClaimEventSchema =
  "phase65a-subjective-claim-event-v1";

const phase65aSubjectiveClaimHistoryReferenceSchema =
  "phase65a-subjective-claim-history-ref-v1";

const phase65bSubjectiveClaimConflictRevisionProjectionVersion =
  "phase65b-subjective-claim-conflict-revision-projection-v1";

const phase65bSubjectiveClaimRelationEventSchema =
  "phase65b-subjective-claim-relation-event-v1";

const phase65bSubjectiveClaimRelationHistoryReferenceSchema =
  "phase65b-subjective-claim-relation-history-ref-v1";

const phase65dSubjectiveBeliefResolutionVersion =
  "phase65d-evidence-grounded-subjective-belief-resolution-v1";

const phase65dSubjectiveBeliefResolutionDecisionSchema =
  "phase65d-subjective-belief-resolution-decision-v1";

const phase66aSubjectiveBeliefRevisionVersion =
  "phase66a-append-only-subjective-belief-revision-v1";

const phase66aSubjectiveBeliefRevisionEventSchema =
  "phase66a-subjective-belief-revision-event-v1";

const phase66aSubjectiveBeliefRevisionHistoryReferenceSchema =
  "phase66a-subjective-belief-revision-history-ref-v1";

const phase67aSubjectiveEpisodeSegmentationVersion =
  "phase67a-subjective-episode-segmentation-v1";

const phase67aSubjectiveEpisodeSegmentationEventSchema =
  "phase67a-subjective-episode-segmentation-event-v1";

const phase67aSubjectiveEpisodeSegmentationHistoryReferenceSchema =
  "phase67a-subjective-episode-segmentation-history-ref-v1";

const phase67bAutobiographicalLifeEventVersion =
  "phase67b-autobiographical-life-event-v1";

const phase67bAutobiographicalLifeEventOrganizationEventSchema =
  "phase67b-autobiographical-life-event-organization-event-v1";

const phase67bAutobiographicalLifeEventOrganizationHistoryReferenceSchema =
  "phase67b-autobiographical-life-event-organization-history-ref-v1";

const phase67cPersonalSemanticMemoryVersion =
  "phase67c-personal-semantic-memory-v1";

const phase67cPersonalSemanticDerivationEventSchema =
  "phase67c-personal-semantic-derivation-event-v1";

const phase67cPersonalSemanticDerivationHistoryReferenceSchema =
  "phase67c-personal-semantic-derivation-history-ref-v1";

const phase67dAutobiographicalLifePeriodVersion =
  "phase67d-autobiographical-life-period-v1";

const phase67dAutobiographicalLifePeriodOrganizationEventSchema =
  "phase67d-autobiographical-life-period-organization-event-v1";

const phase67dAutobiographicalLifePeriodOrganizationHistoryReferenceSchema =
  "phase67d-autobiographical-life-period-organization-history-ref-v1";

function phase65aCharacterMemories(worldState, character) {
  const direct =
    worldState?.memories?.[character];

  if (Array.isArray(direct)) return direct;

  const normalized =
    String(character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");

  const entry =
    Object.entries(
      object(worldState?.memories),
    ).find(
      ([key]) =>
        String(key ?? "")
          .trim()
          .toLocaleLowerCase("zh-Hant-TW")
        === normalized,
    );

  return Array.isArray(entry?.[1])
    ? entry[1]
    : [];
}

function phase65aMemoryId(record) {
  return String(
    record?.memory_id
    ?? record?.id
    ?? "",
  ).trim();
}

function assertPhase65AClaimHistoryPrefix(
  oldHistory,
  newHistory,
) {
  const oldValues =
    array(oldHistory);
  const newValues =
    array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      "Subjective claim history is append-only.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (
    let index = 0;
    index < oldValues.length;
    index += 1
  ) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        "Subjective claim history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function assertPhase65ASubjectiveClaimMutation(
  worldState,
  worldPath,
  mutation,
) {
  if (worldPath[0] === "subjective_claim_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "SubjectiveClaimEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId =
      String(worldPath[1] ?? "");
    const existing =
      getAtPath(worldState, worldPath);

    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next =
      mutation?.to;

    if (
      !isObject(next)
      || next.schema_version
        !== phase65aSubjectiveClaimEventSchema
      || next.immutable !== true
      || String(next.claim_event_id ?? "")
        !== eventId
      || !String(next.claim_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !String(next.proposition ?? "").trim()
      || !String(next.proposition_hash ?? "").trim()
      || next.status !== "candidate_subjective_claim"
      || !Array.isArray(next.evidence)
      || next.evidence.length === 0
    ) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} creation payload is not a valid immutable Phase65A event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const hashBody =
      cloneJson(next);
    delete hashBody.claim_event_hash;

    if (
      hashAgentRunValue(hashBody)
      !== next.claim_event_hash
    ) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_HASH_MISMATCH";
      throw error;
    }

    const derivation =
      object(next.derivation);
    const expectedEventId =
      `subjective_claim_event_${hashAgentRunValue({
        version:
          phase65aSubjectiveClaimProjectionVersion,
        source_turn_id:
          next.source_turn_id,
        character:
          next.character,
        proposition_hash:
          next.proposition_hash,
        evidence:
          next.evidence,
        proposal_ref:
          derivation.proposal_ref,
      }).slice(0, 24)}`;

    if (
      eventId !== expectedEventId
      || derivation.mode
        !== "explicit_current_turn_evidence_projection_v1"
      || derivation.current_turn_new_subjective_memories_only
        !== true
      || derivation.hidden_semantic_graph_traversal_used
        !== false
    ) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} failed deterministic identity or derivation-boundary verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IDENTITY_MISMATCH";
      throw error;
    }

    const propositionHash =
      hashAgentRunValue({
        character:
          next.character,
        proposition:
          next.proposition,
      });

    if (propositionHash !== next.proposition_hash) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} proposition hash does not match its proposition.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSITION_HASH_MISMATCH";
      throw error;
    }

    const seenMemoryRefs =
      new Set();
    let supportingEvidenceCount = 0;

    for (const evidence of next.evidence) {
      const sourceMemoryRef =
        String(
          evidence?.source_memory_ref
          ?? "",
        ).trim();
      const sourceMemoryHash =
        String(
          evidence?.source_memory_hash
          ?? "",
        ).trim();
      const relation =
        String(
          evidence?.relation
          ?? "",
        ).trim();

      if (
        !sourceMemoryRef
        || !sourceMemoryHash
        || !["supports", "conflicts"].includes(relation)
        || seenMemoryRefs.has(sourceMemoryRef)
      ) {
        const error = new Error(
          `SubjectiveClaimEvent ${eventId} contains invalid or duplicate evidence.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_INVALID";
        throw error;
      }

      seenMemoryRefs.add(sourceMemoryRef);
      if (relation === "supports") supportingEvidenceCount += 1;

      const sourceMemory =
        phase65aCharacterMemories(
          worldState,
          next.character,
        ).find(
          (candidate) =>
            phase65aMemoryId(candidate)
            === sourceMemoryRef,
        );

      if (!sourceMemory) {
        const error = new Error(
          `SubjectiveClaimEvent ${eventId} cannot resolve evidence memory ${sourceMemoryRef}.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_MEMORY_UNRESOLVED";
        throw error;
      }

      if (
        hashAgentRunValue(sourceMemory)
        !== sourceMemoryHash
      ) {
        const error = new Error(
          `SubjectiveClaimEvent ${eventId} evidence memory ${sourceMemoryRef} failed hash verification.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_MEMORY_HASH_MISMATCH";
        throw error;
      }

      if (
        String(
          sourceMemory?.internal_provenance?.turn_id
          ?? "",
        ) !== next.source_turn_id
      ) {
        const error = new Error(
          `SubjectiveClaimEvent ${eventId} evidence memory ${sourceMemoryRef} is not from the event source turn.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_SOURCE_TURN_MISMATCH";
        throw error;
      }
    }

    if (supportingEvidenceCount === 0) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} requires supporting evidence.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SUPPORTING_EVIDENCE_REQUIRED";
      throw error;
    }

    const semantic =
      object(next.semantic_state);
    const audit =
      object(next.engine_audit);

    if (
      semantic.world_truth_verified !== false
      || semantic.confidence !== null
      || semantic.probability !== null
      || semantic.conflict_resolution_applied !== false
      || semantic.belief_revision_applied !== false
      || audit.retrieval_frequency_used_as_evidence !== false
      || audit.accessibility_strength_used_as_evidence !== false
      || audit.plasticity_strength_used_as_truth_support !== false
      || audit.world_truth_authority_claimed !== false
      || audit.character_brain_mutation_authority !== false
      || audit.same_turn_character_brain_feedback_allowed !== false
    ) {
      const error = new Error(
        `SubjectiveClaimEvent ${eventId} violates the Phase65A non-authoritative semantic boundary.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_AUTHORITY_BOUNDARY_VIOLATION";
      throw error;
    }

    return;
  }

  if (worldPath[0] !== "subjective_claim_history") {
    return;
  }

  if (worldPath.length !== 1) {
    const error = new Error(
      "Subjective claim history may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory =
    array(
      getAtPath(
        worldState,
        worldPath,
      ),
    );
  const newHistory =
    array(mutation?.to);

  assertPhase65AClaimHistoryPrefix(
    oldHistory,
    newHistory,
  );

  const seen =
    new Set(
      oldHistory.map(
        (reference) =>
          String(
            reference?.claim_event_id
            ?? "",
          ),
      ),
    );

  for (
    let index = oldHistory.length;
    index < newHistory.length;
    index += 1
  ) {
    const reference =
      newHistory[index];
    const eventId =
      String(
        reference?.claim_event_id
        ?? "",
      ).trim();

    if (
      !isObject(reference)
      || reference.schema_version
        !== phase65aSubjectiveClaimHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.claim_event_hash ?? "").trim()
      || !String(reference.character ?? "").trim()
      || !String(reference.source_turn_id ?? "").trim()
      || !String(reference.proposition_hash ?? "").trim()
      || reference.status !== "candidate_subjective_claim"
      || !Number.isInteger(reference.evidence_count)
      || reference.evidence_count < 1
    ) {
      const error = new Error(
        `Subjective claim history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `Subjective claim history contains duplicate reference ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(eventId);

    const event =
      object(
        object(
          worldState?.subjective_claim_events,
        )[eventId],
      );

    if (!Object.keys(event).length) {
      const error = new Error(
        `Subjective claim history cannot resolve SubjectiveClaimEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    if (
      event.claim_event_hash
        !== reference.claim_event_hash
      || event.character
        !== reference.character
      || event.source_turn_id
        !== reference.source_turn_id
      || event.proposition_hash
        !== reference.proposition_hash
      || event.status
        !== reference.status
      || array(event.evidence).length
        !== reference.evidence_count
    ) {
      const error = new Error(
        `Subjective claim history reference ${eventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
  }
}

function assertPhase65BClaimRelationHistoryPrefix(
  oldHistory,
  newHistory,
) {
  const oldValues =
    array(oldHistory);
  const newValues =
    array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      "Subjective claim relation history is append-only.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (
    let index = 0;
    index < oldValues.length;
    index += 1
  ) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        "Subjective claim relation history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function phase65bCanonicalClaim(
  worldState,
  claimEventId,
) {
  const claim =
    object(
      object(
        worldState?.subjective_claim_events,
      )[claimEventId],
    );

  if (
    !Object.keys(claim).length
    || claim.schema_version
      !== phase65aSubjectiveClaimEventSchema
    || claim.immutable !== true
    || String(claim.claim_event_id ?? "")
      !== claimEventId
    || !String(claim.claim_event_hash ?? "").trim()
    || !String(claim.character ?? "").trim()
    || !String(claim.source_turn_id ?? "").trim()
    || !String(claim.proposition_hash ?? "").trim()
    || claim.status !== "candidate_subjective_claim"
  ) {
    const error = new Error(
      `Phase65B cannot resolve canonical SubjectiveClaimEvent ${claimEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_UNRESOLVED";
    throw error;
  }

  const hashBody =
    cloneJson(claim);
  delete hashBody.claim_event_hash;

  if (
    hashAgentRunValue(hashBody)
    !== claim.claim_event_hash
  ) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} failed Phase65B hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  if (
    hashAgentRunValue({
      character:
        claim.character,
      proposition:
        claim.proposition,
    }) !== claim.proposition_hash
  ) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} proposition hash is invalid for Phase65B.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_PROPOSITION_HASH_MISMATCH";
    throw error;
  }

  return claim;
}

function assertPhase65BSubjectiveClaimRelationMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "subjective_claim_relation_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "SubjectiveClaimRelationEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId =
      String(worldPath[1] ?? "");
    const existing =
      getAtPath(worldState, worldPath);

    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next =
      mutation?.to;

    if (
      !isObject(next)
      || next.schema_version
        !== phase65bSubjectiveClaimRelationEventSchema
      || next.immutable !== true
      || String(next.relation_event_id ?? "")
        !== eventId
      || !String(next.relation_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !String(next.source_claim_event_id ?? "").trim()
      || !String(next.source_claim_event_hash ?? "").trim()
      || !String(next.source_claim_proposition_hash ?? "").trim()
      || !String(next.target_claim_event_id ?? "").trim()
      || !String(next.target_claim_event_hash ?? "").trim()
      || !String(next.target_claim_proposition_hash ?? "").trim()
      || !String(next.target_source_turn_id ?? "").trim()
      || !["challenges", "supersedes"].includes(next.relation)
      || next.status !== "candidate_subjective_claim_relation"
      || !Array.isArray(next.evidence_basis)
      || next.evidence_basis.length === 0
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} creation payload is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const hashBody =
      cloneJson(next);
    delete hashBody.relation_event_hash;

    if (
      hashAgentRunValue(hashBody)
      !== next.relation_event_hash
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_HASH_MISMATCH";
      throw error;
    }

    const derivation =
      object(next.derivation);
    const expectedEventId =
      `subjective_claim_relation_event_${hashAgentRunValue({
        version:
          phase65bSubjectiveClaimConflictRevisionProjectionVersion,
        source_turn_id:
          next.source_turn_id,
        character:
          next.character,
        source_claim_event_id:
          next.source_claim_event_id,
        source_claim_event_hash:
          next.source_claim_event_hash,
        target_claim_event_id:
          next.target_claim_event_id,
        target_claim_event_hash:
          next.target_claim_event_hash,
        relation:
          next.relation,
        proposal_ref:
          derivation.proposal_ref,
      }).slice(0, 24)}`;

    if (
      eventId !== expectedEventId
      || derivation.mode
        !== "explicit_claim_to_claim_relation_projection_v1"
      || derivation.current_turn_source_claim_required
        !== true
      || derivation.source_claim_evidence_pinned
        !== true
      || derivation.hidden_semantic_graph_traversal_used
        !== false
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} failed deterministic identity or derivation-boundary verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IDENTITY_MISMATCH";
      throw error;
    }

    const expectedQueueTurnId =
      `${next.source_turn_id}:subjective_claim_relation`;

    if (String(queueTurnId ?? "") !== expectedQueueTurnId) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} must be executed by its exact source-turn relation queue.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_QUEUE_TURN_MISMATCH";
      error.expected_queue_turn_id =
        expectedQueueTurnId;
      error.actual_queue_turn_id =
        queueTurnId ?? null;
      throw error;
    }

    if (next.source_claim_event_id === next.target_claim_event_id) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} may not relate a claim to itself.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SELF_REFERENCE";
      throw error;
    }

    const sourceClaim =
      phase65bCanonicalClaim(
        worldState,
        next.source_claim_event_id,
      );
    const targetClaim =
      phase65bCanonicalClaim(
        worldState,
        next.target_claim_event_id,
      );

    const normalizedCharacter =
      String(next.character)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW");
    const sourceCharacter =
      String(sourceClaim.character)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW");
    const targetCharacter =
      String(targetClaim.character)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW");

    if (
      sourceCharacter !== normalizedCharacter
      || targetCharacter !== normalizedCharacter
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} crosses character ownership boundaries.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CHARACTER_MISMATCH";
      throw error;
    }

    if (
      sourceClaim.claim_event_hash
        !== next.source_claim_event_hash
      || sourceClaim.proposition_hash
        !== next.source_claim_proposition_hash
      || targetClaim.claim_event_hash
        !== next.target_claim_event_hash
      || targetClaim.proposition_hash
        !== next.target_claim_proposition_hash
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} does not pin the exact canonical claim images.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HASH_MISMATCH";
      throw error;
    }

    if (
      sourceClaim.source_turn_id
        !== next.source_turn_id
      || targetClaim.source_turn_id
        !== next.target_source_turn_id
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} source-turn provenance does not match its claims.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_TURN_PROVENANCE_MISMATCH";
      throw error;
    }

    if (
      next.relation === "supersedes"
      && targetClaim.source_turn_id
        === sourceClaim.source_turn_id
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} cannot model same-turn supersession as causal precedence.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SUPERSESSION_TARGET_NOT_PRIOR_TURN";
      throw error;
    }

    const expectedEvidenceBasis =
      array(sourceClaim.evidence)
        .filter(
          (evidence) =>
            evidence?.relation === "supports",
        )
        .map(
          (evidence) => ({
            source_memory_ref:
              evidence.source_memory_ref,
            source_memory_hash:
              evidence.source_memory_hash,
            relation:
              evidence.relation,
          }),
        );

    if (
      !expectedEvidenceBasis.length
      || !sameValue(
        expectedEvidenceBasis,
        next.evidence_basis,
      )
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} evidence basis must exactly pin the source claim's supporting evidence.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVIDENCE_BASIS_MISMATCH";
      throw error;
    }

    const semantic =
      object(next.semantic_state);
    const audit =
      object(next.engine_audit);

    if (
      semantic.world_truth_verified !== false
      || semantic.confidence !== null
      || semantic.probability !== null
      || semantic.conflict_resolution_applied !== false
      || semantic.belief_revision_applied !== false
      || semantic.target_claim_invalidated !== false
      || semantic.target_claim_deleted !== false
      || semantic.target_claim_rewritten !== false
      || semantic.supersession_is_candidate_relation_only !== true
      || audit.source_claim_hash_verified !== true
      || audit.target_claim_hash_verified !== true
      || audit.source_claim_current_turn_verified !== true
      || audit.source_claim_supporting_evidence_pinned !== true
      || audit.same_character_relation_verified !== true
      || audit.same_turn_supersession_allowed !== false
      || audit.retrieval_frequency_used_as_credibility !== false
      || audit.accessibility_strength_used_as_credibility !== false
      || audit.plasticity_strength_used_as_truth_support !== false
      || audit.world_truth_authority_claimed !== false
      || audit.character_brain_mutation_authority !== false
      || audit.same_turn_character_brain_feedback_allowed !== false
      || audit.semantic_graph_traversal_used !== false
      || audit.last_write_wins_applied !== false
      || audit.historical_claim_mutation_applied !== false
      || audit.confidence_probability_modeled !== false
    ) {
      const error = new Error(
        `SubjectiveClaimRelationEvent ${eventId} violates the Phase65B non-authoritative revision boundary.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_AUTHORITY_BOUNDARY_VIOLATION";
      throw error;
    }

    return;
  }

  if (worldPath[0] !== "subjective_claim_relation_history") {
    return;
  }

  if (worldPath.length !== 1) {
    const error = new Error(
      "Subjective claim relation history may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory =
    array(
      getAtPath(
        worldState,
        worldPath,
      ),
    );
  const newHistory =
    array(mutation?.to);

  assertPhase65BClaimRelationHistoryPrefix(
    oldHistory,
    newHistory,
  );

  const seen =
    new Set(
      oldHistory.map(
        (reference) =>
          String(
            reference?.relation_event_id
            ?? "",
          ),
      ),
    );

  for (
    let index = oldHistory.length;
    index < newHistory.length;
    index += 1
  ) {
    const reference =
      newHistory[index];
    const eventId =
      String(
        reference?.relation_event_id
        ?? "",
      ).trim();

    if (
      !isObject(reference)
      || reference.schema_version
        !== phase65bSubjectiveClaimRelationHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.relation_event_hash ?? "").trim()
      || !String(reference.character ?? "").trim()
      || !String(reference.source_turn_id ?? "").trim()
      || !String(reference.source_claim_event_id ?? "").trim()
      || !String(reference.target_claim_event_id ?? "").trim()
      || !["challenges", "supersedes"].includes(reference.relation)
      || reference.status !== "candidate_subjective_claim_relation"
      || !Number.isInteger(reference.evidence_basis_count)
      || reference.evidence_basis_count < 1
    ) {
      const error = new Error(
        `Subjective claim relation history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `Subjective claim relation history contains duplicate reference ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(eventId);

    const event =
      object(
        object(
          worldState?.subjective_claim_relation_events,
        )[eventId],
      );

    if (!Object.keys(event).length) {
      const error = new Error(
        `Subjective claim relation history cannot resolve SubjectiveClaimRelationEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    const eventHashBody =
      cloneJson(event);
    delete eventHashBody.relation_event_hash;

    if (
      hashAgentRunValue(eventHashBody)
        !== event.relation_event_hash
      || event.relation_event_hash
        !== reference.relation_event_hash
      || event.character
        !== reference.character
      || event.source_turn_id
        !== reference.source_turn_id
      || event.source_claim_event_id
        !== reference.source_claim_event_id
      || event.target_claim_event_id
        !== reference.target_claim_event_id
      || event.relation
        !== reference.relation
      || event.status
        !== reference.status
      || array(event.evidence_basis).length
        !== reference.evidence_basis_count
    ) {
      const error = new Error(
        `Subjective claim relation history reference ${eventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
  }
}

const phase66aCommitmentByAction = Object.freeze({
  adopt: "active",
  supersede: "superseded",
});

function assertPhase66ARevisionHistoryPrefix(oldHistory, newHistory) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      "Subjective belief revision history is append-only.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        "Subjective belief revision history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function phase66aCanonicalRelation(worldState, relationEventId, character) {
  const relation = object(
    object(worldState?.subjective_claim_relation_events)[relationEventId],
  );

  if (
    !Object.keys(relation).length
    || relation.schema_version
      !== phase65bSubjectiveClaimRelationEventSchema
    || relation.immutable !== true
    || String(relation.relation_event_id ?? "") !== relationEventId
    || !String(relation.relation_event_hash ?? "").trim()
    || !String(relation.character ?? "").trim()
    || !String(relation.source_claim_event_id ?? "").trim()
    || !String(relation.target_claim_event_id ?? "").trim()
    || !["challenges", "supersedes"].includes(relation.relation)
    || relation.status !== "candidate_subjective_claim_relation"
  ) {
    const error = new Error(
      `Phase66A cannot resolve SubjectiveClaimRelationEvent ${relationEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_UNRESOLVED";
    throw error;
  }

  const body = cloneJson(relation);
  delete body.relation_event_hash;
  if (hashAgentRunValue(body) !== relation.relation_event_hash) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} failed Phase66A hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_HASH_MISMATCH";
    throw error;
  }

  const normalized = String(character ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW");
  if (
    String(relation.character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW")
    !== normalized
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} crosses the Phase66A character boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CHARACTER_MISMATCH";
    throw error;
  }

  const sourceClaim = phase65bCanonicalClaim(
    worldState,
    relation.source_claim_event_id,
  );
  const targetClaim = phase65bCanonicalClaim(
    worldState,
    relation.target_claim_event_id,
  );

  if (
    String(sourceClaim.character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW") !== normalized
    || String(targetClaim.character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW") !== normalized
    || relation.source_claim_event_hash !== sourceClaim.claim_event_hash
    || relation.target_claim_event_hash !== targetClaim.claim_event_hash
    || relation.source_claim_proposition_hash !== sourceClaim.proposition_hash
    || relation.target_claim_proposition_hash !== targetClaim.proposition_hash
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} does not pin same-character canonical claims.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  return relation;
}

function assertPhase66ASourceResolutionDecision(decision, worldState) {
  if (
    !isObject(decision)
    || decision.schema_version
      !== phase65dSubjectiveBeliefResolutionDecisionSchema
    || !String(decision.decision_id ?? "").trim()
    || !String(decision.decision_hash ?? "").trim()
    || !String(decision.character ?? "").trim()
    || !String(decision.source_turn_id ?? "").trim()
    || !["adopt", "supersede"].includes(decision.action)
    || phase66aCommitmentByAction[decision.action]
      !== decision.commitment
    || !Array.isArray(decision.claim_event_ids)
    || !Array.isArray(decision.relation_event_ids)
    || !String(decision.reason ?? "").trim()
    || decision.subjective_not_world_truth !== true
    || decision.confidence !== null
    || decision.probability !== null
  ) {
    const error = new Error(
      "SubjectiveBeliefRevisionEvent must embed one actionable canonical Phase65D decision.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_INVALID";
    throw error;
  }

  const decisionBody = cloneJson(decision);
  delete decisionBody.decision_hash;
  if (hashAgentRunValue(decisionBody) !== decision.decision_hash) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} failed embedded hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_HASH_MISMATCH";
    throw error;
  }

  const claimIds = [...new Set(
    decision.claim_event_ids.map((value) => String(value ?? "").trim()),
  )].filter(Boolean).sort((a, b) => a.localeCompare(b, "en"));
  const relationIds = [...new Set(
    decision.relation_event_ids.map((value) => String(value ?? "").trim()),
  )].filter(Boolean).sort((a, b) => a.localeCompare(b, "en"));

  if (
    !sameValue(claimIds, decision.claim_event_ids)
    || !sameValue(relationIds, decision.relation_event_ids)
  ) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} has invalid reference ordering.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_REFERENCE_ORDER_INVALID";
    throw error;
  }

  const expectedDecisionId =
    `subjective_belief_resolution_${hashAgentRunValue({
      version: phase65dSubjectiveBeliefResolutionVersion,
      character: decision.character,
      source_turn_id: decision.source_turn_id,
      action: decision.action,
      commitment: decision.commitment,
      claim_event_ids: claimIds,
      relation_event_ids: relationIds,
      reason: decision.reason,
    }).slice(0, 24)}`;

  if (expectedDecisionId !== decision.decision_id) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} failed deterministic identity verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_IDENTITY_MISMATCH";
    throw error;
  }

  const derivation = object(decision.derivation);
  const audit = object(decision.engine_audit);
  if (
    derivation.mode !== "explicit_local_claim_relation_resolution_v1"
    || derivation.hidden_semantic_graph_traversal_used !== false
    || derivation.deterministic_sort_used_as_epistemic_precedence !== false
    || audit.claim_hashes_verified !== true
    || audit.relation_hashes_verified !== true
    || audit.relation_claim_hash_pinning_verified !== true
    || audit.same_character_scope_verified !== true
    || audit.historical_claim_mutation_applied !== false
    || audit.historical_relation_mutation_applied !== false
    || audit.world_state_mutation_applied !== false
    || audit.world_truth_authority_claimed !== false
    || audit.retrieval_frequency_used_as_credibility !== false
    || audit.accessibility_strength_used_as_credibility !== false
    || audit.plasticity_strength_used_as_truth_support !== false
    || audit.confidence_probability_modeled !== false
    || audit.last_write_wins_applied !== false
    || audit.same_turn_character_brain_feedback_allowed !== false
  ) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} violates the Phase66A authority boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_AUTHORITY_BOUNDARY_VIOLATION";
    throw error;
  }

  const claims = claimIds.map((claimEventId) => {
    const claim = phase65bCanonicalClaim(worldState, claimEventId);
    if (
      String(claim.character ?? "")
        .trim()
        .toLocaleLowerCase("zh-Hant-TW")
      !== String(decision.character)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW")
    ) {
      const error = new Error(
        `Phase65D decision ${decision.decision_id} crosses claim ownership.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CHARACTER_MISMATCH";
      throw error;
    }
    return claim;
  });
  const relations = relationIds.map(
    (relationEventId) => phase66aCanonicalRelation(
      worldState,
      relationEventId,
      decision.character,
    ),
  );

  if (decision.action === "adopt" && claimIds.length !== 1) {
    const error = new Error(
      `Phase66A adopt decision ${decision.decision_id} must identify exactly one claim.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_ADOPT_CLAIM_COUNT_INVALID";
    throw error;
  }

  if (decision.action === "adopt") {
    for (const relation of relations) {
      if (
        relation.relation !== "supersedes"
        || relation.source_claim_event_id !== claimIds[0]
      ) {
        const error = new Error(
          `Phase66A adopt decision ${decision.decision_id} contains an invalid relation basis.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_ADOPT_RELATION_INVALID";
        throw error;
      }
    }
  }

  if (
    decision.action === "supersede"
    && (
      relations.length !== 1
      || relations[0].relation !== "supersedes"
      || !claimIds.includes(relations[0].target_claim_event_id)
    )
  ) {
    const error = new Error(
      `Phase66A supersede decision ${decision.decision_id} has an invalid target relation.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SUPERSESSION_RELATION_INVALID";
    throw error;
  }

  return { claims, relations };
}

function assertPhase67ASegmentationHistoryPrefix(oldHistory, newHistory) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);

  if (newValues.length < oldValues.length) {
    const error = new Error(
      "Subjective episode segmentation history is append-only.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }

  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        "Subjective episode segmentation history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function phase67aCharacterKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW");
}

function phase67aEventHash(event) {
  const body = cloneJson(event);
  delete body.segmentation_event_hash;
  return hashAgentRunValue(body);
}

function assertPhase67ASubjectiveEpisodeSegmentationMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "subjective_episode_segmentation_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "SubjectiveEpisodeSegmentationEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId = String(worldPath[1] ?? "");
    const existing = getAtPath(worldState, worldPath);
    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next = mutation?.to;
    if (
      !isObject(next)
      || next.schema_version !== phase67aSubjectiveEpisodeSegmentationEventSchema
      || next.version !== phase67aSubjectiveEpisodeSegmentationVersion
      || next.immutable !== true
      || String(next.segmentation_event_id ?? "") !== eventId
      || !String(next.segmentation_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !String(next.subjective_episode_id ?? "").trim()
      || !Array.isArray(next.source_memory_refs)
      || next.source_memory_refs.length < 1
      || ![
        "start_new_episode",
        "continue_episode",
        "preserve_explicit_binding",
      ].includes(next.resolution)
      || next.status !== "subjective_episode_segmentation_recorded"
      || next.subjective_not_world_truth !== true
      || next.world_truth_verified !== false
      || next.confidence !== null
      || next.probability !== null
      || next.memory_content_copied !== false
      || next.world_event_identity_promoted !== false
      || next.world_turn_identity_promoted !== false
      || next.scene_identity_promoted !== false
      || next.character_brain_direct_write !== false
    ) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} creation payload is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    if (phase67aEventHash(next) !== next.segmentation_event_hash) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_HASH_MISMATCH";
      throw error;
    }

    const expectedQueueTurnId =
      `${next.source_turn_id}:subjective_episode_segmentation`;
    if (String(queueTurnId ?? "") !== expectedQueueTurnId) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} must be executed by its exact source-turn segmentation queue.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_QUEUE_TURN_MISMATCH";
      throw error;
    }

    const memoryIds = [];
    let explicitEpisodeId = null;
    for (const reference of next.source_memory_refs) {
      const memoryId = String(reference?.memory_id ?? "").trim();
      const memoryHash = String(reference?.memory_hash ?? "").trim();
      if (!memoryId || !memoryHash || memoryIds.includes(memoryId)) {
        const error = new Error(
          `SubjectiveEpisodeSegmentationEvent ${eventId} has invalid or duplicate source memory references.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_SOURCE_INVALID";
        throw error;
      }

      const memory = phase65aCharacterMemories(worldState, next.character)
        .find((record) => phase65aMemoryId(record) === memoryId);
      if (
        !isObject(memory)
        || hashAgentRunValue(memory) !== memoryHash
        || memory.subjective_memory_not_world_truth !== true
        || String(memory?.internal_provenance?.turn_id ?? "")
          !== String(next.source_turn_id)
      ) {
        const error = new Error(
          `SubjectiveEpisodeSegmentationEvent ${eventId} does not pin canonical current-turn subjective memory ${memoryId}.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_MISMATCH";
        throw error;
      }

      const boundEpisode = String(
        memory?.episodic_binding?.subjective_episode_id
        ?? memory?.retrieval_cues?.subjective_episode_id
        ?? "",
      ).trim();
      if (boundEpisode) {
        if (explicitEpisodeId && explicitEpisodeId !== boundEpisode) {
          const error = new Error(
            `SubjectiveEpisodeSegmentationEvent ${eventId} mixes distinct explicit Phase63 episode bindings.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EXPLICIT_BINDING_MISMATCH";
          throw error;
        }
        explicitEpisodeId = boundEpisode;
      }
      memoryIds.push(memoryId);
    }

    const sortedMemoryIds = [...memoryIds].sort((a, b) => a.localeCompare(b, "en"));
    if (!sameValue(sortedMemoryIds, memoryIds)) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} source memory references must use deterministic ordering.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_SOURCE_INVALID";
      throw error;
    }

    if (
      explicitEpisodeId
      && (
        next.resolution !== "preserve_explicit_binding"
        || next.subjective_episode_id !== explicitEpisodeId
      )
    ) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} failed to preserve a canonical Phase63 explicit episode binding.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EXPLICIT_BINDING_REWRITE_FORBIDDEN";
      throw error;
    }

    const sourceSemantics = object(next.source_semantics);
    const evidence = object(next.segmentation_evidence);
    if (
      sourceSemantics.phase63_memory_records_are_authoritative_episode_evidence !== true
      || sourceSemantics.memory_content_copied !== false
      || sourceSemantics.world_event_identity_promoted !== false
      || sourceSemantics.world_turn_identity_promoted !== false
      || sourceSemantics.scene_identity_promoted !== false
      || evidence.scene_change_is_universal_psychological_boundary !== false
      || evidence.numeric_prediction_error_threshold_used !== false
      || evidence.hidden_world_state_used !== false
    ) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} violates the Phase67A cognition boundary.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_BOUNDARY_VIOLATION";
      throw error;
    }

    const expectedEventId =
      `subjective_episode_segmentation_event_${hashAgentRunValue({
        version: phase67aSubjectiveEpisodeSegmentationVersion,
        character: phase67aCharacterKey(next.character),
        source_turn_id: next.source_turn_id,
        source_memory_refs: next.source_memory_refs,
        subjective_episode_id: next.subjective_episode_id,
        resolution: next.resolution,
        previous_segmentation_event_hash:
          next.previous_segmentation_event_hash ?? null,
      }).slice(0, 24)}`;
    if (eventId !== expectedEventId) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} failed deterministic identity verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IDENTITY_MISMATCH";
      throw error;
    }
    return;
  }

  if (worldPath[0] !== "subjective_episode_segmentation_history") return;

  if (worldPath.length !== 1) {
    const error = new Error(
      "Subjective episode segmentation history may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory = array(getAtPath(worldState, worldPath));
  const newHistory = array(mutation?.to);
  assertPhase67ASegmentationHistoryPrefix(oldHistory, newHistory);

  const seenEventIds = new Set();
  const seenMemoryKeys = new Set();
  const latestByCharacter = new Map();

  for (const reference of oldHistory) {
    const eventId = String(reference?.segmentation_event_id ?? "").trim();
    const character = String(reference?.character ?? "").trim();
    if (eventId) seenEventIds.add(eventId);
    for (const memoryId of array(reference?.source_memory_ids)) {
      seenMemoryKeys.add(
        `${phase67aCharacterKey(character)}:${String(memoryId ?? "").trim()}`,
      );
    }
    if (eventId && character) {
      const event = object(
        object(worldState?.subjective_episode_segmentation_events)[eventId],
      );
      if (Object.keys(event).length) {
        latestByCharacter.set(phase67aCharacterKey(character), event);
      }
    }
  }

  for (let index = oldHistory.length; index < newHistory.length; index += 1) {
    const reference = newHistory[index];
    const eventId = String(reference?.segmentation_event_id ?? "").trim();
    const character = String(reference?.character ?? "").trim();
    const sourceMemoryIds = array(reference?.source_memory_ids)
      .map((value) => String(value ?? "").trim());

    if (
      !isObject(reference)
      || reference.schema_version
        !== phase67aSubjectiveEpisodeSegmentationHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.segmentation_event_hash ?? "").trim()
      || !character
      || !String(reference.source_turn_id ?? "").trim()
      || !String(reference.subjective_episode_id ?? "").trim()
      || sourceMemoryIds.length < 1
      || sourceMemoryIds.some((value) => !value)
      || ![
        "start_new_episode",
        "continue_episode",
        "preserve_explicit_binding",
      ].includes(reference.resolution)
      || reference.status !== "subjective_episode_segmentation_recorded"
    ) {
      const error = new Error(
        `Subjective episode segmentation history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seenEventIds.has(eventId)) {
      const error = new Error(
        `Subjective episode segmentation history contains duplicate event ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    for (const memoryId of sourceMemoryIds) {
      const memoryKey = `${phase67aCharacterKey(character)}:${memoryId}`;
      if (seenMemoryKeys.has(memoryKey)) {
        const error = new Error(
          `Subjective episode segmentation history duplicates source memory ${memoryId} for ${character}.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_MEMORY_DUPLICATE";
        throw error;
      }
      seenMemoryKeys.add(memoryKey);
    }

    const event = object(
      object(worldState?.subjective_episode_segmentation_events)[eventId],
    );
    if (!Object.keys(event).length) {
      const error = new Error(
        `Subjective episode segmentation history cannot resolve SubjectiveEpisodeSegmentationEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    if (phase67aEventHash(event) !== event.segmentation_event_hash) {
      const error = new Error(
        `SubjectiveEpisodeSegmentationEvent ${eventId} failed history-time hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_HASH_MISMATCH";
      throw error;
    }

    const key = phase67aCharacterKey(character);
    const previous = latestByCharacter.get(key) ?? null;
    const eventMemoryIds = event.source_memory_refs.map((item) => item.memory_id);
    if (
      reference.segmentation_event_hash !== event.segmentation_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.subjective_episode_id !== event.subjective_episode_id
      || reference.resolution !== event.resolution
      || !sameValue(sourceMemoryIds, eventMemoryIds)
      || reference.previous_segmentation_event_id
        !== event.previous_segmentation_event_id
      || reference.previous_segmentation_event_hash
        !== event.previous_segmentation_event_hash
      || event.previous_segmentation_event_id
        !== (previous?.segmentation_event_id ?? null)
      || event.previous_segmentation_event_hash
        !== (previous?.segmentation_event_hash ?? null)
    ) {
      const error = new Error(
        `Subjective episode segmentation history reference ${eventId} does not match its canonical per-character chain.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    seenEventIds.add(eventId);
    latestByCharacter.set(key, event);
  }
}

function assertPhase67BLifeEventHistoryPrefix(oldHistory, newHistory) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);
  if (newValues.length < oldValues.length) {
    const error = new Error("Autobiographical LifeEvent organization history is append-only.");
    error.code =
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }
  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error(
        "Autobiographical LifeEvent organization history changed an existing reference or order.",
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function phase67bOrganizationEventHash(event) {
  const body = cloneJson(event);
  delete body.organization_event_hash;
  return hashAgentRunValue(body);
}

function phase67bSegmentationEventHash(event) {
  const body = cloneJson(event);
  delete body.segmentation_event_hash;
  return hashAgentRunValue(body);
}

function phase67bEffectiveEpisodeRecord(worldState, character, subjectiveEpisodeId) {
  const characterNormalized = phase67aCharacterKey(character);
  let projectedCharacter = null;
  let firstSourceTurnId = null;
  let latestSourceTurnId = null;
  let latestSegmentationEventId = null;
  let explicitBindingPresent = false;
  const sourceMemoryIds = new Set();
  const segmentationEventIds = [];

  for (const reference of array(worldState?.subjective_episode_segmentation_history)) {
    if (
      phase67aCharacterKey(reference?.character) !== characterNormalized
      || String(reference?.subjective_episode_id ?? "") !== String(subjectiveEpisodeId)
    ) {
      continue;
    }
    const eventId = String(reference?.segmentation_event_id ?? "").trim();
    const event = object(
      object(worldState?.subjective_episode_segmentation_events)[eventId],
    );
    if (!Object.keys(event).length) continue;
    projectedCharacter ??= event.character;
    firstSourceTurnId ??= event.source_turn_id;
    latestSourceTurnId = event.source_turn_id;
    latestSegmentationEventId = event.segmentation_event_id;
    explicitBindingPresent =
      explicitBindingPresent
      || event.resolution === "preserve_explicit_binding";
    segmentationEventIds.push(event.segmentation_event_id);
    for (const item of array(event.source_memory_refs)) {
      const memoryId = String(item?.memory_id ?? "").trim();
      if (memoryId) sourceMemoryIds.add(memoryId);
    }
  }

  if (!projectedCharacter || !segmentationEventIds.length) return null;
  return {
    subjective_episode_id: subjectiveEpisodeId,
    character: projectedCharacter,
    source_memory_ids: [...sourceMemoryIds]
      .sort((left, right) => left.localeCompare(right, "en")),
    segmentation_event_ids: segmentationEventIds,
    first_source_turn_id: firstSourceTurnId,
    latest_source_turn_id: latestSourceTurnId,
    latest_segmentation_event_id: latestSegmentationEventId,
    explicit_binding_present: explicitBindingPresent,
    subjective_not_world_truth: true,
  };
}

function phase67bValidateEvidenceRefs(value) {
  const supported = new Set([
    "explicit_programmatic_binding",
  ]);
  const strong = new Set([
    "explicit_programmatic_binding",
  ]);
  const refs = array(value);
  const normalized = refs.map((item) => ({
    kind: String(item?.kind ?? "").trim(),
    source_ref: String(item?.source_ref ?? "").trim(),
    source_hash: String(item?.source_hash ?? "").trim(),
  }));
  if (
    normalized.some((item) =>
      !supported.has(item.kind)
      || !item.source_ref
      || !item.source_hash)
  ) {
    const error = new Error("Autobiographical LifeEvent evidence references are invalid.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_INVALID";
    throw error;
  }
  const sorted = [...normalized].sort((left, right) => {
    const kind = left.kind.localeCompare(right.kind, "en");
    if (kind !== 0) return kind;
    const ref = left.source_ref.localeCompare(right.source_ref, "en");
    if (ref !== 0) return ref;
    return left.source_hash.localeCompare(right.source_hash, "en");
  });
  if (!sameValue(normalized, sorted)) {
    const error = new Error("Autobiographical LifeEvent evidence references must use deterministic ordering.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_ORDER_INVALID";
    throw error;
  }
  const keys = normalized.map((item) =>
    `${item.kind}\u0000${item.source_ref}\u0000${item.source_hash}`,
  );
  if (new Set(keys).size !== keys.length) {
    const error = new Error("Autobiographical LifeEvent evidence references contain duplicates.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_DUPLICATE";
    throw error;
  }
  return {
    refs: normalized,
    strong_count: normalized.filter((item) => strong.has(item.kind)).length,
  };
}

function assertPhase67BAutobiographicalLifeEventMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "autobiographical_life_event_organization_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "AutobiographicalLifeEventOrganizationEvent fields are immutable after creation.",
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId = String(worldPath[1] ?? "");
    const existing = getAtPath(worldState, worldPath);
    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next = mutation?.to;
    if (
      !isObject(next)
      || next.schema_version
        !== phase67bAutobiographicalLifeEventOrganizationEventSchema
      || next.version !== phase67bAutobiographicalLifeEventVersion
      || next.immutable !== true
      || String(next.organization_event_id ?? "") !== eventId
      || !String(next.organization_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !String(next.source_segmentation_event_id ?? "").trim()
      || !String(next.source_segmentation_event_hash ?? "").trim()
      || !String(next.subjective_episode_id ?? "").trim()
      || !String(next.source_episode_hash ?? "").trim()
      || !String(next.life_event_id ?? "").trim()
      || !["start_new_life_event", "attach_to_open_life_event"].includes(next.resolution)
      || next.status !== "autobiographical_life_event_organization_recorded"
      || next.subjective_not_world_truth !== true
      || next.world_truth_verified !== false
      || next.confidence !== null
      || next.probability !== null
      || next.memory_content_copied !== false
      || next.episode_content_copied !== false
      || next.world_event_identity_promoted !== false
      || next.world_turn_identity_promoted !== false
      || next.subjective_episode_identity_promoted !== false
      || next.character_brain_direct_write !== false
    ) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} creation payload is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    if (phase67bOrganizationEventHash(next) !== next.organization_event_hash) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_HASH_MISMATCH";
      throw error;
    }

    const expectedQueueTurnId =
      `${next.source_turn_id}:autobiographical_life_event`;
    if (String(queueTurnId ?? "") !== expectedQueueTurnId) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} must use its exact source-turn queue.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_QUEUE_TURN_MISMATCH";
      throw error;
    }

    const sourceEvent = object(
      object(worldState?.subjective_episode_segmentation_events)[
        next.source_segmentation_event_id
      ],
    );
    if (
      !Object.keys(sourceEvent).length
      || sourceEvent.schema_version
        !== phase67aSubjectiveEpisodeSegmentationEventSchema
      || sourceEvent.version !== phase67aSubjectiveEpisodeSegmentationVersion
      || phase67bSegmentationEventHash(sourceEvent)
        !== sourceEvent.segmentation_event_hash
      || sourceEvent.segmentation_event_hash
        !== next.source_segmentation_event_hash
      || sourceEvent.source_turn_id !== next.source_turn_id
      || phase67aCharacterKey(sourceEvent.character)
        !== phase67aCharacterKey(next.character)
      || sourceEvent.subjective_episode_id !== next.subjective_episode_id
    ) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} does not pin a canonical Phase67A source event.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_SEGMENTATION_MISMATCH";
      throw error;
    }

    const sourceEpisode = phase67bEffectiveEpisodeRecord(
      worldState,
      next.character,
      next.subjective_episode_id,
    );
    if (
      !sourceEpisode
      || hashAgentRunValue(sourceEpisode) !== next.source_episode_hash
    ) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} does not pin the canonical effective subjective episode.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_EPISODE_HASH_MISMATCH";
      throw error;
    }

    let previousEvent = null;
    if (next.previous_organization_event_id || next.previous_organization_event_hash) {
      previousEvent = object(
        object(worldState?.autobiographical_life_event_organization_events)[
          next.previous_organization_event_id
        ],
      );
      if (
        !Object.keys(previousEvent).length
        || previousEvent.organization_event_hash
          !== next.previous_organization_event_hash
        || phase67bOrganizationEventHash(previousEvent)
          !== previousEvent.organization_event_hash
        || phase67aCharacterKey(previousEvent.character)
          !== phase67aCharacterKey(next.character)
      ) {
        const error = new Error(
          `AutobiographicalLifeEventOrganizationEvent ${eventId} has an invalid previous-event hash chain.`,
        );
        error.code =
          "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_PREVIOUS_EVENT_MISMATCH";
        throw error;
      }
    } else if (
      next.previous_organization_event_id !== null
      || next.previous_organization_event_hash !== null
    ) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} has a partial previous-event reference.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_PREVIOUS_EVENT_MISMATCH";
      throw error;
    }

    const expectedPreviousOpen =
      previousEvent?.resulting_open_life_event_id ?? null;
    if (next.previous_open_life_event_id !== expectedPreviousOpen) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} does not preserve the previous open LifeEvent.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_OPEN_EVENT_MISMATCH";
      throw error;
    }

    const evidence = object(next.organization_evidence);
    const evidenceValidation = phase67bValidateEvidenceRefs(evidence.evidence_refs);
    const semantics = object(next.source_semantics);
    if (
      evidence.temporal_contiguity_alone_is_sufficient !== false
      || evidence.spatial_contiguity_alone_is_sufficient !== false
      || evidence.hidden_world_state_used !== false
      || evidence.numeric_similarity_threshold_used !== false
      || evidence.llm_freeform_semantic_merge_used !== false
      || semantics.phase67a_effective_subjective_episode_is_authoritative_source !== true
      || semantics.episode_content_copied !== false
      || semantics.memory_content_copied !== false
      || semantics.repeated_event_category_modeled !== false
      || semantics.personal_semantic_memory_modeled !== false
      || semantics.one_primary_life_event_parent_per_episode !== true
      || semantics.world_event_identity_promoted !== false
      || semantics.world_turn_identity_promoted !== false
      || semantics.subjective_episode_identity_promoted !== false
    ) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} violates the Phase67B cognition boundary.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_BOUNDARY_VIOLATION";
      throw error;
    }

    if (next.resolution === "attach_to_open_life_event") {
      const resolverViewHash = String(evidence.resolver_view_hash ?? "").trim();
      const expectedEvidence = resolverViewHash
        ? [{
          kind: "explicit_programmatic_binding",
          source_ref: `phase67b_resolver_view:${resolverViewHash}`,
          source_hash: resolverViewHash,
        }]
        : [];
      if (
        !expectedPreviousOpen
        || next.life_event_id !== expectedPreviousOpen
        || next.closes_previous_life_event_id !== null
        || next.resulting_open_life_event_id !== expectedPreviousOpen
        || evidenceValidation.strong_count !== 1
        || !resolverViewHash
        || !sameValue(evidenceValidation.refs, expectedEvidence)
      ) {
        const error = new Error(
          `AutobiographicalLifeEventOrganizationEvent ${eventId} lacks verified explicit programmatic binding provenance for cross-episode attachment.`,
        );
        error.code =
          "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_PROVENANCE_MISMATCH";
        throw error;
      }
    } else {
      const expectedLifeEventId =
        `autobiographical_life_event_${hashAgentRunValue({
          version: phase67bAutobiographicalLifeEventVersion,
          character: phase67aCharacterKey(next.character),
          first_subjective_episode_id: next.subjective_episode_id,
          previous_organization_event_hash:
            next.previous_organization_event_hash ?? null,
          identity_source: "phase67b_subjective_episode_lineage",
        }).slice(0, 24)}`;
      if (
        next.life_event_id !== expectedLifeEventId
        || next.closes_previous_life_event_id !== expectedPreviousOpen
        || next.resulting_open_life_event_id !== next.life_event_id
      ) {
        const error = new Error(
          `AutobiographicalLifeEventOrganizationEvent ${eventId} failed deterministic LifeEvent identity verification.`,
        );
        error.code =
          "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_IDENTITY_MISMATCH";
        throw error;
      }
    }

    const expectedEventId =
      `autobiographical_life_event_organization_event_${hashAgentRunValue({
        version: phase67bAutobiographicalLifeEventVersion,
        character: phase67aCharacterKey(next.character),
        source_turn_id: next.source_turn_id,
        source_segmentation_event_id: next.source_segmentation_event_id,
        source_segmentation_event_hash: next.source_segmentation_event_hash,
        subjective_episode_id: next.subjective_episode_id,
        source_episode_hash: next.source_episode_hash,
        resolution: next.resolution,
        life_event_id: next.life_event_id,
        previous_organization_event_hash:
          next.previous_organization_event_hash ?? null,
      }).slice(0, 24)}`;
    if (eventId !== expectedEventId) {
      const error = new Error(
        `AutobiographicalLifeEventOrganizationEvent ${eventId} failed deterministic event identity verification.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IDENTITY_MISMATCH";
      throw error;
    }
    return;
  }

  if (worldPath[0] !== "autobiographical_life_event_organization_history") return;
  if (worldPath.length !== 1) {
    const error = new Error(
      "Autobiographical LifeEvent organization history may not be mutated through nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory = array(getAtPath(worldState, worldPath));
  const newHistory = array(mutation?.to);
  assertPhase67BLifeEventHistoryPrefix(oldHistory, newHistory);
  const seenEventIds = new Set();
  const seenEpisodeKeys = new Set();
  const latestByCharacter = new Map();
  const openByCharacter = new Map();

  for (const reference of oldHistory) {
    const eventId = String(reference?.organization_event_id ?? "").trim();
    const character = String(reference?.character ?? "").trim();
    const episodeId = String(reference?.subjective_episode_id ?? "").trim();
    if (eventId) seenEventIds.add(eventId);
    if (character && episodeId) {
      seenEpisodeKeys.add(`${phase67aCharacterKey(character)}:${episodeId}`);
    }
    if (eventId && character) {
      const event = object(
        object(worldState?.autobiographical_life_event_organization_events)[eventId],
      );
      if (Object.keys(event).length) {
        const key = phase67aCharacterKey(character);
        latestByCharacter.set(key, event);
        openByCharacter.set(key, event.resulting_open_life_event_id);
      }
    }
  }

  for (let index = oldHistory.length; index < newHistory.length; index += 1) {
    const reference = newHistory[index];
    const eventId = String(reference?.organization_event_id ?? "").trim();
    const character = String(reference?.character ?? "").trim();
    const episodeId = String(reference?.subjective_episode_id ?? "").trim();
    const lifeEventId = String(reference?.life_event_id ?? "").trim();
    if (
      !isObject(reference)
      || reference.schema_version
        !== phase67bAutobiographicalLifeEventOrganizationHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.organization_event_hash ?? "").trim()
      || !character
      || !String(reference.source_turn_id ?? "").trim()
      || !String(reference.source_segmentation_event_id ?? "").trim()
      || !String(reference.source_segmentation_event_hash ?? "").trim()
      || !episodeId
      || !String(reference.source_episode_hash ?? "").trim()
      || !lifeEventId
      || !["start_new_life_event", "attach_to_open_life_event"].includes(reference.resolution)
      || reference.status !== "autobiographical_life_event_organization_recorded"
    ) {
      const error = new Error(
        `Autobiographical LifeEvent history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const episodeKey = `${phase67aCharacterKey(character)}:${episodeId}`;
    if (seenEventIds.has(eventId) || seenEpisodeKeys.has(episodeKey)) {
      const error = new Error(
        `Autobiographical LifeEvent history duplicates an event or primary episode parent at index ${index}.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EPISODE_MULTI_PARENT_FORBIDDEN";
      throw error;
    }
    const event = object(
      object(worldState?.autobiographical_life_event_organization_events)[eventId],
    );
    if (
      !Object.keys(event).length
      || phase67bOrganizationEventHash(event) !== event.organization_event_hash
    ) {
      const error = new Error(
        `Autobiographical LifeEvent history cannot resolve canonical event ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }
    const key = phase67aCharacterKey(character);
    const previous = latestByCharacter.get(key) ?? null;
    const expectedOpen = openByCharacter.get(key) ?? null;
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.source_segmentation_event_id !== event.source_segmentation_event_id
      || reference.source_segmentation_event_hash !== event.source_segmentation_event_hash
      || reference.subjective_episode_id !== event.subjective_episode_id
      || reference.source_episode_hash !== event.source_episode_hash
      || reference.life_event_id !== event.life_event_id
      || reference.resolution !== event.resolution
      || reference.previous_organization_event_id !== event.previous_organization_event_id
      || reference.previous_organization_event_hash !== event.previous_organization_event_hash
      || event.previous_organization_event_id
        !== (previous?.organization_event_id ?? null)
      || event.previous_organization_event_hash
        !== (previous?.organization_event_hash ?? null)
      || event.previous_open_life_event_id !== expectedOpen
      || event.resulting_open_life_event_id !== event.life_event_id
      || (
        event.resolution === "attach_to_open_life_event"
        && event.life_event_id !== expectedOpen
      )
      || (
        event.resolution === "start_new_life_event"
        && event.closes_previous_life_event_id !== expectedOpen
      )
    ) {
      const error = new Error(
        `Autobiographical LifeEvent history reference ${eventId} breaks its canonical per-character chain.`,
      );
      error.code =
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seenEventIds.add(eventId);
    seenEpisodeKeys.add(episodeKey);
    latestByCharacter.set(key, event);
    openByCharacter.set(key, event.life_event_id);
  }
}

function phase67cDerivationEventHash(event) {
  const body = cloneJson(event);
  delete body.derivation_event_hash;
  return hashAgentRunValue(body);
}

function phase67cSemanticDescriptor(value) {
  const descriptor = object(value);
  const qualifiers = array(descriptor.qualifiers);
  if (
    descriptor.subject_scope !== "self_autobiographical_experience"
    || !String(descriptor.predicate ?? "").trim()
    || !String(descriptor.object_ref ?? "").trim()
    || String(descriptor.predicate).length > 160
    || String(descriptor.object_ref).length > 320
    || qualifiers.length > 16
    || qualifiers.some((item) => !String(item ?? "").trim() || String(item).length > 160)
  ) {
    const error = new Error("Personal semantic descriptor is invalid.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
    throw error;
  }
  const normalized = {
    subject_scope: "self_autobiographical_experience",
    predicate: String(descriptor.predicate).trim(),
    object_ref: String(descriptor.object_ref).trim(),
    qualifiers: qualifiers.map((item) => String(item).trim())
      .sort((left, right) => left.localeCompare(right, "en")),
  };
  if (
    new Set(normalized.qualifiers).size !== normalized.qualifiers.length
    || !sameValue(normalized, descriptor)
  ) {
    const error = new Error("Personal semantic descriptor is not canonical.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_INVALID";
    throw error;
  }
  return normalized;
}

function phase67cValidateSourceRefs(worldState, value, character) {
  const normalizedCharacter = phase67aCharacterKey(character);
  const refs = array(value).map((item) => ({
    life_event_id: String(item?.life_event_id ?? "").trim(),
    organization_event_id: String(item?.organization_event_id ?? "").trim(),
    organization_event_hash: String(item?.organization_event_hash ?? "").trim(),
  }));
  if (!refs.length) {
    const error = new Error("Personal semantic derivation requires LifeEvent evidence.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REQUIRED";
    throw error;
  }
  for (const ref of refs) {
    const event = object(
      object(worldState?.autobiographical_life_event_organization_events)[ref.organization_event_id],
    );
    if (
      !ref.life_event_id
      || !ref.organization_event_id
      || !ref.organization_event_hash
      || !Object.keys(event).length
      || event.schema_version !== phase67bAutobiographicalLifeEventOrganizationEventSchema
      || event.version !== phase67bAutobiographicalLifeEventVersion
      || phase67bOrganizationEventHash(event) !== event.organization_event_hash
      || event.organization_event_hash !== ref.organization_event_hash
      || event.life_event_id !== ref.life_event_id
      || phase67aCharacterKey(event.character) !== normalizedCharacter
    ) {
      const error = new Error("Personal semantic derivation does not pin canonical same-character Phase67B evidence.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_MISMATCH";
      throw error;
    }
  }
  const sorted = [...refs].sort((left, right) => {
    const life = left.life_event_id.localeCompare(right.life_event_id, "en");
    if (life !== 0) return life;
    return left.organization_event_id.localeCompare(right.organization_event_id, "en");
  });
  const keys = refs.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  );
  if (!sameValue(refs, sorted) || new Set(keys).size !== keys.length) {
    const error = new Error("Personal semantic LifeEvent evidence must be unique and deterministically ordered.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_SOURCE_REF_INVALID";
    throw error;
  }
  return refs;
}

function phase67cHistoryPrefix(oldHistory, newHistory) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);
  if (newValues.length < oldValues.length) {
    const error = new Error("Personal semantic derivation history is append-only.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }
  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error("Personal semantic derivation history changed an existing reference or order.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function assertPhase67CPersonalSemanticMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "personal_semantic_derivation_events") {
    if (worldPath.length !== 2) {
      const error = new Error("PersonalSemanticDerivationEvent fields are immutable after creation.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    const eventId = String(worldPath[1] ?? "");
    if (getAtPath(worldState, worldPath) !== undefined && getAtPath(worldState, worldPath) !== null) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} is immutable and cannot be overwritten.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    const next = mutation?.to;
    if (
      !isObject(next)
      || next.schema_version !== phase67cPersonalSemanticDerivationEventSchema
      || next.version !== phase67cPersonalSemanticMemoryVersion
      || next.immutable !== true
      || next.derivation_event_id !== eventId
      || !String(next.derivation_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !["form", "support", "counterevidence"].includes(next.operation)
      || !["recurring_event_pattern", "autobiographical_fact"].includes(next.semantic_category)
      || !String(next.semantic_memory_id ?? "").trim()
      || !String(next.semantic_key ?? "").trim()
      || !String(next.semantic_descriptor_hash ?? "").trim()
      || !String(next.resolver_view_hash ?? "").trim()
      || next.status !== "personal_semantic_derivation_recorded"
      || next.subjective_not_world_truth !== true
      || next.world_truth_verified !== false
      || next.epistemic_acceptance_decided !== false
      || next.belief_engine_used !== false
      || next.confidence !== null
      || next.probability !== null
      || next.memory_content_copied !== false
      || next.episode_content_copied !== false
      || next.life_event_content_copied !== false
      || next.character_brain_direct_write !== false
    ) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} creation payload is invalid.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    if (phase67cDerivationEventHash(next) !== next.derivation_event_hash) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} failed hash verification.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_HASH_MISMATCH";
      throw error;
    }
    if (String(queueTurnId ?? "") !== `${next.source_turn_id}:personal_semantic_memory`) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} must use its exact source-turn queue.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_QUEUE_TURN_MISMATCH";
      throw error;
    }
    const descriptor = phase67cSemanticDescriptor(next.semantic_descriptor);
    if (hashAgentRunValue(descriptor) !== next.semantic_descriptor_hash) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} descriptor hash mismatch.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_DESCRIPTOR_HASH_MISMATCH";
      throw error;
    }
    const refs = phase67cValidateSourceRefs(worldState, next.source_life_event_refs, next.character);
    const currentTurnTriggerPresent = refs.some((item) => {
      const sourceEvent = object(
        object(worldState?.autobiographical_life_event_organization_events)[
          item.organization_event_id
        ],
      );
      return sourceEvent.source_turn_id === next.source_turn_id;
    });
    if (!currentTurnTriggerPresent) {
      const error = new Error(
        `PersonalSemanticDerivationEvent ${eventId} is not anchored in a current-turn Phase67B LifeEvent update.`,
      );
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_CURRENT_TURN_TRIGGER_REQUIRED";
      throw error;
    }
    if (
      next.operation === "form"
      && next.semantic_category === "recurring_event_pattern"
      && new Set(refs.map((item) => item.life_event_id)).size < 2
    ) {
      const error = new Error("Recurring personal semantic pattern requires at least two distinct LifeEvents and is never auto-promoted by count alone.");
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_RECURRING_PATTERN_DISTINCT_EVENTS_REQUIRED";
      throw error;
    }
    const expectedSemanticId = `personal_semantic_memory_${hashAgentRunValue({
      version: phase67cPersonalSemanticMemoryVersion,
      character: phase67aCharacterKey(next.character),
      semantic_category: next.semantic_category,
      semantic_key: next.semantic_key,
      semantic_descriptor_hash: next.semantic_descriptor_hash,
    }).slice(0, 24)}`;
    if (expectedSemanticId !== next.semantic_memory_id) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} failed semantic identity verification.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_MISMATCH";
      throw error;
    }
    let latestCharacterEvent = null;
    let latestSemanticEvent = null;
    for (const reference of array(worldState?.personal_semantic_derivation_history)) {
      const prior = object(
        object(worldState?.personal_semantic_derivation_events)[reference?.derivation_event_id],
      );
      if (!Object.keys(prior).length) continue;
      if (phase67aCharacterKey(prior.character) === phase67aCharacterKey(next.character)) {
        latestCharacterEvent = prior;
      }
      if (prior.semantic_memory_id === next.semantic_memory_id) latestSemanticEvent = prior;
    }
    if (
      next.previous_derivation_event_id !== (latestCharacterEvent?.derivation_event_id ?? null)
      || next.previous_derivation_event_hash !== (latestCharacterEvent?.derivation_event_hash ?? null)
      || next.previous_semantic_event_id !== (latestSemanticEvent?.derivation_event_id ?? null)
      || next.previous_semantic_event_hash !== (latestSemanticEvent?.derivation_event_hash ?? null)
      || (next.operation === "form" && latestSemanticEvent !== null)
      || (next.operation !== "form" && latestSemanticEvent === null)
    ) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} breaks its append-only event chain.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_PREVIOUS_EVENT_MISMATCH";
      throw error;
    }
    if (
      latestSemanticEvent
      && (
        latestSemanticEvent.semantic_category !== next.semantic_category
        || latestSemanticEvent.semantic_key !== next.semantic_key
        || latestSemanticEvent.semantic_descriptor_hash !== next.semantic_descriptor_hash
        || !sameValue(latestSemanticEvent.semantic_descriptor, next.semantic_descriptor)
      )
    ) {
      const error = new Error(`Personal semantic memory ${next.semantic_memory_id} identity cannot be rewritten.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
    const evidence = object(next.derivation_evidence);
    const semantics = object(next.source_semantics);
    if (
      evidence.decision_source !== "programmatic_personal_semantic_memory_resolver"
      || evidence.resolver_view_ref !== `phase67c_resolver_view:${next.resolver_view_hash}`
      || evidence.eager_semanticization_used !== false
      || evidence.recurrence_count_auto_promoted !== false
      || evidence.numeric_confidence_threshold_used !== false
      || evidence.freeform_llm_reflection_authority_used !== false
      || evidence.same_character_life_event_evidence_only !== true
      || evidence.current_turn_life_event_trigger_required !== true
      || semantics.phase67b_life_event_evidence_is_authoritative_source !== true
      || semantics.experience_near_personal_semantics_only !== true
      || semantics.traits_modeled !== false
      || semantics.role_identity_modeled !== false
      || semantics.values_modeled !== false
      || semantics.preferences_modeled !== false
      || semantics.self_model_modeled !== false
      || semantics.belief_revision_modeled !== false
      || semantics.memory_content_copied !== false
      || semantics.episode_content_copied !== false
      || semantics.life_event_content_copied !== false
    ) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} violates the Phase67C cognition boundary.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_BOUNDARY_VIOLATION";
      throw error;
    }
    const expectedEventId = `personal_semantic_derivation_event_${hashAgentRunValue({
      version: phase67cPersonalSemanticMemoryVersion,
      character: phase67aCharacterKey(next.character),
      source_turn_id: next.source_turn_id,
      operation: next.operation,
      semantic_memory_id: next.semantic_memory_id,
      semantic_descriptor_hash: next.semantic_descriptor_hash,
      source_life_event_refs: next.source_life_event_refs,
      previous_derivation_event_hash: next.previous_derivation_event_hash,
      previous_semantic_event_hash: next.previous_semantic_event_hash,
    }).slice(0, 24)}`;
    if (expectedEventId !== eventId) {
      const error = new Error(`PersonalSemanticDerivationEvent ${eventId} failed deterministic event identity verification.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IDENTITY_MISMATCH";
      throw error;
    }
    return;
  }

  if (worldPath[0] !== "personal_semantic_derivation_history") return;
  if (worldPath.length !== 1) {
    const error = new Error("Personal semantic derivation history may not be mutated through nested paths.");
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }
  const oldHistory = array(getAtPath(worldState, worldPath));
  const newHistory = array(mutation?.to);
  phase67cHistoryPrefix(oldHistory, newHistory);
  const seenEventIds = new Set();
  const latestByCharacter = new Map();
  const latestBySemantic = new Map();
  for (const reference of oldHistory) {
    const eventId = String(reference?.derivation_event_id ?? "").trim();
    const event = object(object(worldState?.personal_semantic_derivation_events)[eventId]);
    if (!eventId || !Object.keys(event).length) continue;
    seenEventIds.add(eventId);
    latestByCharacter.set(phase67aCharacterKey(event.character), event);
    latestBySemantic.set(event.semantic_memory_id, event);
  }
  for (let index = oldHistory.length; index < newHistory.length; index += 1) {
    const reference = newHistory[index];
    const eventId = String(reference?.derivation_event_id ?? "").trim();
    if (
      !isObject(reference)
      || reference.schema_version !== phase67cPersonalSemanticDerivationHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.derivation_event_hash ?? "").trim()
      || !String(reference.character ?? "").trim()
      || !String(reference.source_turn_id ?? "").trim()
      || !["form", "support", "counterevidence"].includes(reference.operation)
      || !String(reference.semantic_memory_id ?? "").trim()
      || reference.status !== "personal_semantic_derivation_recorded"
      || seenEventIds.has(eventId)
    ) {
      const error = new Error(`Personal semantic derivation history reference at index ${index} is invalid.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const event = object(object(worldState?.personal_semantic_derivation_events)[eventId]);
    if (!Object.keys(event).length || phase67cDerivationEventHash(event) !== event.derivation_event_hash) {
      const error = new Error(`Personal semantic history cannot resolve canonical event ${eventId}.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }
    const character = phase67aCharacterKey(event.character);
    const previousCharacter = latestByCharacter.get(character) ?? null;
    const previousSemantic = latestBySemantic.get(event.semantic_memory_id) ?? null;
    if (
      reference.derivation_event_hash !== event.derivation_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.operation !== event.operation
      || reference.semantic_memory_id !== event.semantic_memory_id
      || reference.previous_derivation_event_id !== event.previous_derivation_event_id
      || reference.previous_derivation_event_hash !== event.previous_derivation_event_hash
      || reference.previous_semantic_event_id !== event.previous_semantic_event_id
      || reference.previous_semantic_event_hash !== event.previous_semantic_event_hash
      || event.previous_derivation_event_id !== (previousCharacter?.derivation_event_id ?? null)
      || event.previous_derivation_event_hash !== (previousCharacter?.derivation_event_hash ?? null)
      || event.previous_semantic_event_id !== (previousSemantic?.derivation_event_id ?? null)
      || event.previous_semantic_event_hash !== (previousSemantic?.derivation_event_hash ?? null)
      || (event.operation === "form" && previousSemantic !== null)
      || (event.operation !== "form" && previousSemantic === null)
    ) {
      const error = new Error(`Personal semantic history reference ${eventId} breaks its canonical chain.`);
      error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seenEventIds.add(eventId);
    latestByCharacter.set(character, event);
    latestBySemantic.set(event.semantic_memory_id, event);
  }
}

function phase67dOrganizationEventHash(event) {
  const body = cloneJson(event);
  delete body.organization_event_hash;
  return hashAgentRunValue(body);
}

function phase67dPeriodDescriptor(value) {
  const descriptor = object(value);
  const qualifiers = array(descriptor.qualifiers);
  if (
    descriptor.subject_scope !== "self_autobiographical_life"
    || !String(descriptor.period_key ?? "").trim()
    || String(descriptor.period_key).length > 240
    || qualifiers.length > 16
    || qualifiers.some((item) => !String(item ?? "").trim() || String(item).length > 160)
  ) {
    const error = new Error("Autobiographical LifePeriod descriptor is invalid.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
    throw error;
  }
  const normalized = {
    subject_scope: "self_autobiographical_life",
    period_key: String(descriptor.period_key).trim(),
    qualifiers: qualifiers.map((item) => String(item).trim())
      .sort((left, right) => left.localeCompare(right, "en")),
  };
  if (
    new Set(normalized.qualifiers).size !== normalized.qualifiers.length
    || !sameValue(normalized, descriptor)
  ) {
    const error = new Error("Autobiographical LifePeriod descriptor is not canonical.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_INVALID";
    throw error;
  }
  return normalized;
}

function phase67dValidateLifeEventRefs(worldState, value, character) {
  const normalizedCharacter = phase67aCharacterKey(character);
  const refs = array(value).map((item) => ({
    life_event_id: String(item?.life_event_id ?? "").trim(),
    organization_event_id: String(item?.organization_event_id ?? "").trim(),
    organization_event_hash: String(item?.organization_event_hash ?? "").trim(),
  }));
  for (const ref of refs) {
    const event = object(
      object(worldState?.autobiographical_life_event_organization_events)[ref.organization_event_id],
    );
    if (
      !ref.life_event_id
      || !ref.organization_event_id
      || !ref.organization_event_hash
      || !Object.keys(event).length
      || event.schema_version !== phase67bAutobiographicalLifeEventOrganizationEventSchema
      || event.version !== phase67bAutobiographicalLifeEventVersion
      || phase67bOrganizationEventHash(event) !== event.organization_event_hash
      || event.organization_event_hash !== ref.organization_event_hash
      || event.life_event_id !== ref.life_event_id
      || phase67aCharacterKey(event.character) !== normalizedCharacter
    ) {
      const error = new Error("LifePeriod organization does not pin canonical same-character Phase67B evidence.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_MISMATCH";
      throw error;
    }
  }
  const sorted = [...refs].sort((left, right) => {
    const life = left.life_event_id.localeCompare(right.life_event_id, "en");
    return life !== 0
      ? life
      : left.organization_event_id.localeCompare(right.organization_event_id, "en");
  });
  const keys = refs.map((item) =>
    `${item.life_event_id}\u0000${item.organization_event_id}\u0000${item.organization_event_hash}`,
  );
  if (!sameValue(refs, sorted) || new Set(keys).size !== keys.length) {
    const error = new Error("LifePeriod LifeEvent evidence must be unique and deterministically ordered.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SOURCE_REF_INVALID";
    throw error;
  }
  return refs;
}

function phase67dValidateSemanticRefs(worldState, value, character) {
  const normalizedCharacter = phase67aCharacterKey(character);
  const refs = array(value).map((item) => ({
    semantic_memory_id: String(item?.semantic_memory_id ?? "").trim(),
    derivation_event_id: String(item?.derivation_event_id ?? "").trim(),
    derivation_event_hash: String(item?.derivation_event_hash ?? "").trim(),
  }));
  for (const ref of refs) {
    const event = object(
      object(worldState?.personal_semantic_derivation_events)[ref.derivation_event_id],
    );
    if (
      !ref.semantic_memory_id
      || !ref.derivation_event_id
      || !ref.derivation_event_hash
      || !Object.keys(event).length
      || event.schema_version !== phase67cPersonalSemanticDerivationEventSchema
      || event.version !== phase67cPersonalSemanticMemoryVersion
      || phase67cDerivationEventHash(event) !== event.derivation_event_hash
      || event.derivation_event_hash !== ref.derivation_event_hash
      || event.semantic_memory_id !== ref.semantic_memory_id
      || phase67aCharacterKey(event.character) !== normalizedCharacter
    ) {
      const error = new Error("LifePeriod organization does not pin canonical same-character Phase67C evidence.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_MISMATCH";
      throw error;
    }
  }
  const sorted = [...refs].sort((left, right) => {
    const semantic = left.semantic_memory_id.localeCompare(right.semantic_memory_id, "en");
    return semantic !== 0
      ? semantic
      : left.derivation_event_id.localeCompare(right.derivation_event_id, "en");
  });
  const keys = refs.map((item) =>
    `${item.semantic_memory_id}\u0000${item.derivation_event_id}\u0000${item.derivation_event_hash}`,
  );
  if (!sameValue(refs, sorted) || new Set(keys).size !== keys.length) {
    const error = new Error("LifePeriod Personal Semantic evidence must be unique and deterministically ordered.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_REF_INVALID";
    throw error;
  }
  return refs;
}

function phase67dHistoryPrefix(oldHistory, newHistory) {
  const oldValues = array(oldHistory);
  const newValues = array(newHistory);
  if (newValues.length < oldValues.length) {
    const error = new Error("Autobiographical LifePeriod organization history is append-only.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_APPEND_ONLY_VIOLATION";
    throw error;
  }
  for (let index = 0; index < oldValues.length; index += 1) {
    if (!sameValue(oldValues[index], newValues[index])) {
      const error = new Error("Autobiographical LifePeriod organization history changed an existing reference or order.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_APPEND_ONLY_VIOLATION";
      throw error;
    }
  }
}

function assertPhase67DAutobiographicalLifePeriodMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "autobiographical_life_period_organization_events") {
    if (worldPath.length !== 2) {
      const error = new Error("AutobiographicalLifePeriodOrganizationEvent fields are immutable after creation.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    const eventId = String(worldPath[1] ?? "");
    if (getAtPath(worldState, worldPath) !== undefined && getAtPath(worldState, worldPath) !== null) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} is immutable and cannot be overwritten.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    const next = mutation?.to;
    if (
      !isObject(next)
      || next.schema_version !== phase67dAutobiographicalLifePeriodOrganizationEventSchema
      || next.version !== phase67dAutobiographicalLifePeriodVersion
      || next.immutable !== true
      || next.organization_event_id !== eventId
      || !String(next.organization_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !["start_period", "attach_life_event", "close_period"].includes(next.operation)
      || !["explicit_programmatic_binding", "personal_semantic_support"].includes(next.evidence_kind)
      || !String(next.life_period_id ?? "").trim()
      || !String(next.period_descriptor_hash ?? "").trim()
      || !String(next.resolver_view_hash ?? "").trim()
      || next.status !== "autobiographical_life_period_organization_recorded"
      || next.subjective_not_world_truth !== true
      || next.world_truth_verified !== false
      || next.confidence !== null
      || next.probability !== null
      || next.life_event_content_copied !== false
      || next.personal_semantic_content_copied !== false
      || next.memory_content_copied !== false
      || next.character_brain_direct_write !== false
    ) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} creation payload is invalid.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    if (phase67dOrganizationEventHash(next) !== next.organization_event_hash) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} failed hash verification.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_HASH_MISMATCH";
      throw error;
    }
    if (String(queueTurnId ?? "") !== `${next.source_turn_id}:autobiographical_life_period`) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} must use its exact source-turn queue.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_QUEUE_TURN_MISMATCH";
      throw error;
    }
    const descriptor = phase67dPeriodDescriptor(next.period_descriptor);
    if (hashAgentRunValue(descriptor) !== next.period_descriptor_hash) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} descriptor hash mismatch.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_HASH_MISMATCH";
      throw error;
    }
    const lifeRefs = phase67dValidateLifeEventRefs(worldState, next.source_life_event_refs, next.character);
    const semanticRefs = phase67dValidateSemanticRefs(worldState, next.source_personal_semantic_refs, next.character);
    const currentTurnTrigger = lifeRefs.some((item) => {
      const event = object(
        object(worldState?.autobiographical_life_event_organization_events)[item.organization_event_id],
      );
      return event.source_turn_id === next.source_turn_id;
    }) || semanticRefs.some((item) => {
      const event = object(
        object(worldState?.personal_semantic_derivation_events)[item.derivation_event_id],
      );
      return event.source_turn_id === next.source_turn_id;
    });
    if (!currentTurnTrigger) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} lacks a current-turn autobiographical trigger.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CURRENT_TURN_TRIGGER_REQUIRED";
      throw error;
    }
    if (
      ["start_period", "attach_life_event"].includes(next.operation)
      && !lifeRefs.length
    ) {
      const error = new Error(`${next.operation} requires at least one LifeEvent membership source.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_MEMBERSHIP_SOURCE_REQUIRED";
      throw error;
    }
    if (next.evidence_kind === "personal_semantic_support" && !semanticRefs.length) {
      const error = new Error("personal_semantic_support requires canonical Phase67C evidence.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_SEMANTIC_SUPPORT_REQUIRED";
      throw error;
    }
    const previousCharacter = next.previous_organization_event_id
      ? object(
        object(worldState?.autobiographical_life_period_organization_events)[
          next.previous_organization_event_id
        ],
      )
      : null;
    const previousPeriod = next.previous_period_event_id
      ? object(
        object(worldState?.autobiographical_life_period_organization_events)[
          next.previous_period_event_id
        ],
      )
      : null;
    if (
      (next.previous_organization_event_id === null) !== (next.previous_organization_event_hash === null)
      || (next.previous_period_event_id === null) !== (next.previous_period_event_hash === null)
      || (previousCharacter && Object.keys(previousCharacter).length > 0 && (
        previousCharacter.organization_event_hash !== next.previous_organization_event_hash
        || phase67aCharacterKey(previousCharacter.character) !== phase67aCharacterKey(next.character)
      ))
      || (previousPeriod && Object.keys(previousPeriod).length > 0 && (
        previousPeriod.organization_event_hash !== next.previous_period_event_hash
        || previousPeriod.life_period_id !== next.life_period_id
      ))
      // Same-timestamp LifePeriod events are committed atomically. A chained
      // predecessor may sort later within the deterministic batch, so event
      // creation cannot require it to have been written already. The history
      // mutation runs after event-path writes and validates the complete
      // per-character/per-period chain against all materialized events.
      || (next.operation === "start_period" && next.previous_period_event_id !== null)
      || (next.operation !== "start_period" && next.previous_period_event_id === null)
      || previousPeriod?.operation === "close_period"
    ) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} breaks its append-only chain.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_PREVIOUS_EVENT_MISMATCH";
      throw error;
    }
    if (
      previousPeriod
      && (
        previousPeriod.period_descriptor_hash !== next.period_descriptor_hash
        || !sameValue(previousPeriod.period_descriptor, next.period_descriptor)
      )
    ) {
      const error = new Error(`LifePeriod ${next.life_period_id} identity cannot be rewritten.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
    if (next.operation === "start_period") {
      const expectedPeriodId = `autobiographical_life_period_${hashAgentRunValue({
        version: phase67dAutobiographicalLifePeriodVersion,
        character: phase67aCharacterKey(next.character),
        source_turn_id: next.source_turn_id,
        period_descriptor_hash: next.period_descriptor_hash,
        source_life_event_refs: next.source_life_event_refs,
        source_personal_semantic_refs: next.source_personal_semantic_refs,
      }).slice(0, 24)}`;
      if (expectedPeriodId !== next.life_period_id) {
        const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} failed period identity verification.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_MISMATCH";
        throw error;
      }
    }
    const evidence = object(next.organization_evidence);
    const semantics = object(next.source_semantics);
    if (
      evidence.decision_source !== "programmatic_autobiographical_life_period_organization_resolver"
      || evidence.resolver_view_ref !== `phase67d_resolver_view:${next.resolver_view_hash}`
      || evidence.temporal_adjacency_alone_used !== false
      || evidence.calendar_bucket_used !== false
      || evidence.fixed_duration_threshold_used !== false
      || evidence.freeform_llm_period_authority_used !== false
      || evidence.current_turn_autobiographical_trigger_required !== true
      || evidence.overlapping_periods_allowed !== true
      || evidence.many_to_many_life_event_membership !== true
      || semantics.phase67b_life_event_evidence_allowed !== true
      || semantics.phase67c_personal_semantic_evidence_allowed !== true
      || semantics.temporal_proximity_is_supporting_only !== true
      || semantics.calendar_bucket_is_membership_authority !== false
      || semantics.cultural_life_script_assumption_used !== false
      || semantics.one_primary_period_parent_per_life_event !== false
      || semantics.life_event_content_copied !== false
      || semantics.personal_semantic_content_copied !== false
      || semantics.memory_content_copied !== false
      || semantics.self_model_modeled !== false
      || semantics.belief_revision_modeled !== false
    ) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} violates the Phase67D cognition boundary.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_BOUNDARY_VIOLATION";
      throw error;
    }
    if (
      next.evidence_kind === "explicit_programmatic_binding"
      && (
        evidence.binding_source_ref !== `phase67d_resolver_view:${next.resolver_view_hash}`
        || evidence.binding_source_hash !== next.resolver_view_hash
      )
    ) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} has invalid explicit binding provenance.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_BINDING_PROVENANCE_INVALID";
      throw error;
    }
    const expectedEventId = `autobiographical_life_period_organization_event_${hashAgentRunValue({
      version: phase67dAutobiographicalLifePeriodVersion,
      character: phase67aCharacterKey(next.character),
      source_turn_id: next.source_turn_id,
      operation: next.operation,
      life_period_id: next.life_period_id,
      period_descriptor_hash: next.period_descriptor_hash,
      source_life_event_refs: next.source_life_event_refs,
      source_personal_semantic_refs: next.source_personal_semantic_refs,
      previous_organization_event_hash: next.previous_organization_event_hash,
      previous_period_event_hash: next.previous_period_event_hash,
    }).slice(0, 24)}`;
    if (expectedEventId !== eventId) {
      const error = new Error(`AutobiographicalLifePeriodOrganizationEvent ${eventId} failed deterministic event identity verification.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IDENTITY_MISMATCH";
      throw error;
    }
    return;
  }

  if (worldPath[0] !== "autobiographical_life_period_organization_history") return;
  if (worldPath.length !== 1) {
    const error = new Error("Autobiographical LifePeriod history may not be mutated through nested paths.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }
  const oldHistory = array(getAtPath(worldState, worldPath));
  const newHistory = array(mutation?.to);
  phase67dHistoryPrefix(oldHistory, newHistory);
  const seenEventIds = new Set();
  const latestByCharacter = new Map();
  const latestByPeriod = new Map();
  for (const reference of oldHistory) {
    const eventId = String(reference?.organization_event_id ?? "").trim();
    const event = object(
      object(worldState?.autobiographical_life_period_organization_events)[eventId],
    );
    if (!eventId || !Object.keys(event).length) continue;
    seenEventIds.add(eventId);
    latestByCharacter.set(phase67aCharacterKey(event.character), event);
    latestByPeriod.set(event.life_period_id, event);
  }
  for (let index = oldHistory.length; index < newHistory.length; index += 1) {
    const reference = newHistory[index];
    const eventId = String(reference?.organization_event_id ?? "").trim();
    if (
      !isObject(reference)
      || reference.schema_version !== phase67dAutobiographicalLifePeriodOrganizationHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.organization_event_hash ?? "").trim()
      || !String(reference.character ?? "").trim()
      || !String(reference.source_turn_id ?? "").trim()
      || !["start_period", "attach_life_event", "close_period"].includes(reference.operation)
      || !String(reference.life_period_id ?? "").trim()
      || reference.status !== "autobiographical_life_period_organization_recorded"
      || seenEventIds.has(eventId)
    ) {
      const error = new Error(`Autobiographical LifePeriod history reference at index ${index} is invalid.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const event = object(
      object(worldState?.autobiographical_life_period_organization_events)[eventId],
    );
    if (!Object.keys(event).length || phase67dOrganizationEventHash(event) !== event.organization_event_hash) {
      const error = new Error(`Autobiographical LifePeriod history cannot resolve canonical event ${eventId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }
    const character = phase67aCharacterKey(event.character);
    const previousCharacter = latestByCharacter.get(character) ?? null;
    const previousPeriod = latestByPeriod.get(event.life_period_id) ?? null;
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.operation !== event.operation
      || reference.life_period_id !== event.life_period_id
      || reference.previous_organization_event_id !== event.previous_organization_event_id
      || reference.previous_organization_event_hash !== event.previous_organization_event_hash
      || reference.previous_period_event_id !== event.previous_period_event_id
      || reference.previous_period_event_hash !== event.previous_period_event_hash
      || event.previous_organization_event_id !== (previousCharacter?.organization_event_id ?? null)
      || event.previous_organization_event_hash !== (previousCharacter?.organization_event_hash ?? null)
      || event.previous_period_event_id !== (previousPeriod?.organization_event_id ?? null)
      || event.previous_period_event_hash !== (previousPeriod?.organization_event_hash ?? null)
      || (event.operation === "start_period" && previousPeriod !== null)
      || (event.operation !== "start_period" && previousPeriod === null)
      || previousPeriod?.operation === "close_period"
    ) {
      const error = new Error(`Autobiographical LifePeriod history reference ${eventId} breaks its canonical chain.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (
      previousPeriod
      && (
        previousPeriod.period_descriptor_hash !== event.period_descriptor_hash
        || !sameValue(previousPeriod.period_descriptor, event.period_descriptor)
      )
    ) {
      const error = new Error(`LifePeriod ${event.life_period_id} identity was rewritten.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_IDENTITY_REWRITE_FORBIDDEN";
      throw error;
    }
    seenEventIds.add(eventId);
    latestByCharacter.set(character, event);
    latestByPeriod.set(event.life_period_id, event);
  }
}

function assertPhase66ASubjectiveBeliefRevisionMutation(
  worldState,
  worldPath,
  mutation,
  queueTurnId = null,
) {
  if (worldPath[0] === "subjective_belief_revision_events") {
    if (worldPath.length !== 2) {
      const error = new Error(
        "SubjectiveBeliefRevisionEvent fields are immutable after creation; only direct write-once event creation is allowed.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventId = String(worldPath[1] ?? "");
    const existing = getAtPath(worldState, worldPath);
    if (existing !== undefined && existing !== null) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} is immutable and cannot be overwritten.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const next = mutation?.to;
    if (
      !isObject(next)
      || next.schema_version !== phase66aSubjectiveBeliefRevisionEventSchema
      || next.immutable !== true
      || String(next.belief_revision_event_id ?? "") !== eventId
      || !String(next.belief_revision_event_hash ?? "").trim()
      || !String(next.character ?? "").trim()
      || !String(next.source_turn_id ?? "").trim()
      || !String(next.source_resolution_decision_id ?? "").trim()
      || !String(next.source_resolution_decision_hash ?? "").trim()
      || !["adopt", "supersede"].includes(next.resolution_action)
      || next.from_commitment !== null
      || phase66aCommitmentByAction[next.resolution_action]
        !== next.to_commitment
      || !Array.isArray(next.claim_references)
      || !Array.isArray(next.relation_references)
      || next.status !== "subjective_belief_revision_recorded"
    ) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} creation payload is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }

    const eventBody = cloneJson(next);
    delete eventBody.belief_revision_event_hash;
    if (hashAgentRunValue(eventBody) !== next.belief_revision_event_hash) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} failed immutable hash verification.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_HASH_MISMATCH";
      throw error;
    }

    const expectedQueueTurnId =
      `${next.source_turn_id}:subjective_belief_revision`;
    if (String(queueTurnId ?? "") !== expectedQueueTurnId) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} must be executed by its exact source-turn revision queue.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_QUEUE_TURN_MISMATCH";
      throw error;
    }

    const validated = assertPhase66ASourceResolutionDecision(
      next.source_resolution_decision,
      worldState,
    );
    const decision = next.source_resolution_decision;

    if (
      decision.decision_id !== next.source_resolution_decision_id
      || decision.decision_hash !== next.source_resolution_decision_hash
      || decision.character !== next.character
      || decision.source_turn_id !== next.source_turn_id
      || decision.action !== next.resolution_action
      || decision.commitment !== next.to_commitment
    ) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} does not match its embedded Phase65D decision.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SOURCE_DECISION_MISMATCH";
      throw error;
    }

    const expectedClaimRefs = validated.claims
      .map((claim) => ({
        claim_event_id: claim.claim_event_id,
        claim_event_hash: claim.claim_event_hash,
        proposition_hash: claim.proposition_hash,
        source_turn_id: claim.source_turn_id,
      }))
      .sort((a, b) => a.claim_event_id.localeCompare(b.claim_event_id, "en"));
    const expectedRelationRefs = validated.relations
      .map((relation) => ({
        relation_event_id: relation.relation_event_id,
        relation_event_hash: relation.relation_event_hash,
        relation: relation.relation,
        source_claim_event_id: relation.source_claim_event_id,
        target_claim_event_id: relation.target_claim_event_id,
      }))
      .sort((a, b) => a.relation_event_id.localeCompare(b.relation_event_id, "en"));
    const expectedAdopted = decision.action === "adopt"
      ? [...decision.claim_event_ids]
      : [];
    const expectedSuperseded = decision.action === "supersede"
      ? [...new Set(
        validated.relations.map((relation) => relation.target_claim_event_id),
      )].sort((a, b) => a.localeCompare(b, "en"))
      : [];

    if (
      !sameValue(next.claim_references, expectedClaimRefs)
      || !sameValue(next.relation_references, expectedRelationRefs)
      || !sameValue(next.adopted_claim_event_ids, expectedAdopted)
      || !sameValue(next.superseded_claim_event_ids, expectedSuperseded)
      || !sameValue(next.suspended_claim_event_ids, [])
      || !sameValue(next.withdrawn_claim_event_ids, [])
    ) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} does not preserve its exact source basis.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SOURCE_BASIS_MISMATCH";
      throw error;
    }

    const expectedEventId =
      `subjective_belief_revision_event_${hashAgentRunValue({
        version: phase66aSubjectiveBeliefRevisionVersion,
        source_turn_id: next.source_turn_id,
        character: next.character,
        source_resolution_decision_id: next.source_resolution_decision_id,
        source_resolution_decision_hash: next.source_resolution_decision_hash,
        resolution_action: next.resolution_action,
        previous_belief_revision_event_hash:
          next.previous_belief_revision_event_hash ?? null,
      }).slice(0, 24)}`;

    const semantic = object(next.semantic_state);
    const derivation = object(next.derivation);
    const audit = object(next.engine_audit);
    if (
      eventId !== expectedEventId
      || semantic.subjective_not_world_truth !== true
      || semantic.world_truth_verified !== false
      || semantic.confidence !== null
      || semantic.probability !== null
      || semantic.effective_belief_projection_applied !== false
      || derivation.mode
        !== "phase65d_resolution_to_append_only_revision_event_v1"
      || derivation.source_resolution_decision_hash_pinned !== true
      || derivation.source_claim_hashes_pinned !== true
      || derivation.source_relation_hashes_pinned !== true
      || derivation.deterministic_sort_used_as_epistemic_precedence !== false
      || derivation.hidden_semantic_graph_traversal_used !== false
      || audit.source_resolution_decision_hash_verified !== true
      || audit.source_claim_hashes_verified !== true
      || audit.source_relation_hashes_verified !== true
      || audit.same_character_scope_verified !== true
      || audit.unresolved_decision_persisted !== false
      || audit.historical_claim_mutation_applied !== false
      || audit.historical_relation_mutation_applied !== false
      || audit.historical_revision_mutation_applied !== false
      || audit.effective_belief_projection_applied !== false
      || audit.world_truth_authority_claimed !== false
      || audit.confidence_probability_modeled !== false
      || audit.retrieval_frequency_used_as_credibility !== false
      || audit.accessibility_strength_used_as_credibility !== false
      || audit.plasticity_strength_used_as_truth_support !== false
      || audit.last_write_wins_applied !== false
      || audit.same_turn_character_brain_feedback_allowed !== false
    ) {
      const error = new Error(
        `SubjectiveBeliefRevisionEvent ${eventId} violates the Phase66A event boundary.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_BOUNDARY_VIOLATION";
      throw error;
    }

    return;
  }

  if (worldPath[0] !== "subjective_belief_revision_history") return;

  if (worldPath.length !== 1) {
    const error = new Error(
      "Subjective belief revision history may not be mutated through direct nested paths.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_DIRECT_MUTATION_FORBIDDEN";
    throw error;
  }

  const oldHistory = array(getAtPath(worldState, worldPath));
  const newHistory = array(mutation?.to);
  assertPhase66ARevisionHistoryPrefix(oldHistory, newHistory);

  const seenEventIds = new Set();
  const seenDecisionIds = new Set();
  const latestByCharacter = new Map();

  for (const reference of oldHistory) {
    const eventId = String(reference?.belief_revision_event_id ?? "").trim();
    const decisionId = String(reference?.source_resolution_decision_id ?? "").trim();
    if (eventId) seenEventIds.add(eventId);
    if (decisionId) seenDecisionIds.add(decisionId);
    if (eventId && String(reference?.character ?? "").trim()) {
      const event = object(
        object(worldState?.subjective_belief_revision_events)[eventId],
      );
      if (Object.keys(event).length) {
        latestByCharacter.set(
          String(reference.character)
            .trim()
            .toLocaleLowerCase("zh-Hant-TW"),
          event,
        );
      }
    }
  }

  for (let index = oldHistory.length; index < newHistory.length; index += 1) {
    const reference = newHistory[index];
    const eventId = String(reference?.belief_revision_event_id ?? "").trim();
    const decisionId = String(reference?.source_resolution_decision_id ?? "").trim();

    if (
      !isObject(reference)
      || reference.schema_version
        !== phase66aSubjectiveBeliefRevisionHistoryReferenceSchema
      || reference.derived_index !== true
      || !eventId
      || !String(reference.belief_revision_event_hash ?? "").trim()
      || !String(reference.character ?? "").trim()
      || !String(reference.source_turn_id ?? "").trim()
      || !decisionId
      || !String(reference.source_resolution_decision_hash ?? "").trim()
      || !["adopt", "supersede"].includes(reference.resolution_action)
      || phase66aCommitmentByAction[reference.resolution_action]
        !== reference.to_commitment
      || reference.status !== "subjective_belief_revision_recorded"
    ) {
      const error = new Error(
        `Subjective belief revision history reference at index ${index} is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seenEventIds.has(eventId) || seenDecisionIds.has(decisionId)) {
      const error = new Error(
        `Subjective belief revision history contains duplicate event or source decision at index ${index}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    const event = object(
      object(worldState?.subjective_belief_revision_events)[eventId],
    );
    if (!Object.keys(event).length) {
      const error = new Error(
        `Subjective belief revision history cannot resolve SubjectiveBeliefRevisionEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    const eventBody = cloneJson(event);
    delete eventBody.belief_revision_event_hash;
    const characterKey = String(reference.character)
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
    const previous = latestByCharacter.get(characterKey) ?? null;
    const expectedPreviousId = previous?.belief_revision_event_id ?? null;
    const expectedPreviousHash = previous?.belief_revision_event_hash ?? null;

    if (
      hashAgentRunValue(eventBody) !== event.belief_revision_event_hash
      || event.belief_revision_event_hash
        !== reference.belief_revision_event_hash
      || event.character !== reference.character
      || event.source_turn_id !== reference.source_turn_id
      || event.source_resolution_decision_id
        !== reference.source_resolution_decision_id
      || event.source_resolution_decision_hash
        !== reference.source_resolution_decision_hash
      || event.resolution_action !== reference.resolution_action
      || event.to_commitment !== reference.to_commitment
      || event.previous_belief_revision_event_id
        !== reference.previous_belief_revision_event_id
      || event.previous_belief_revision_event_hash
        !== reference.previous_belief_revision_event_hash
      || event.previous_belief_revision_event_id !== expectedPreviousId
      || event.previous_belief_revision_event_hash !== expectedPreviousHash
      || event.status !== reference.status
    ) {
      const error = new Error(
        `Subjective belief revision history reference ${eventId} does not match its canonical event chain.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    seenEventIds.add(eventId);
    seenDecisionIds.add(decisionId);
    latestByCharacter.set(characterKey, event);
  }
}

function effectiveMutationBefore(root, worldPath, mutation) {
  const actual = getAtPath(root, worldPath);
  if (actual !== undefined) return actual;
  const field = String(mutation?.field ?? "");
  if (["physical_state.movement_multiplier", "physical_state.combat_multiplier"].includes(field)) return 1;
  if (["physical_state.incapacitated", "physical_state.immobilized", "destroyed", "passable"].includes(field)) return false;
  if (field === "collision_enabled") return true;
  if (field === "physical_state.injuries") return [];
  if (field === "simulation_time" && worldPath[0] === "scenes") return root.simulation_time ?? null;
  if (["holder", "scene_id", "position"].includes(field)) return null;
  return actual;
}

function setAtPath(root, pathParts, value) {
  if (!pathParts.length) throw new Error("Authoritative mutation path must not be empty.");
  let current = root;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    const nextKey = pathParts[index + 1];
    if (current[key] === null || current[key] === undefined || typeof current[key] !== "object") {
      current[key] = Number.isInteger(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[pathParts[pathParts.length - 1]] = cloneJson(value);
}

function changedLeafPaths(left, right, prefix = [], output = []) {
  if (sameValue(left, right)) return output;
  const leftObj = left && typeof left === "object";
  const rightObj = right && typeof right === "object";
  if (!leftObj || !rightObj || Array.isArray(left) !== Array.isArray(right)) {
    output.push(prefix.join("."));
    return output;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      output.push(prefix.join("."));
      return output;
    }
    for (let i = 0; i < left.length; i += 1) changedLeafPaths(left[i], right[i], [...prefix, i], output);
    return output;
  }
  const keys = new Set([...Object.keys(object(left)), ...Object.keys(object(right))]);
  for (const key of keys) changedLeafPaths(left?.[key], right?.[key], [...prefix, key], output);
  return output;
}


export function projectWorldSimulationChronologicalMutationQueue(input = {}) {
  const queue = object(input.queue);
  const executed = cloneJson(object(input.world_state));
  const applied = [];
  for (const batch of array(queue.batches)) {
    for (const mutation of array(batch?.mutations)) {
      const worldPath = mutationWorldPath(mutation, executed, executed, input.scene_id ?? null);
      if (!worldPath) {
        const error = new Error(`Mutation projection cannot resolve world path for ${mutation?.mutation_path ?? mutation?.mutation_id ?? "<unknown>"}.`);
        error.code = "WORLD_SIMULATION_MUTATION_PATH_UNRESOLVED";
        throw error;
      }
      const before = effectiveMutationBefore(executed, worldPath, mutation);
      if (!sameValue(before, mutation.from)) {
        const error = new Error(`Mutation projection precondition mismatch at ${worldPath.join(".")}.`);
        error.code = "WORLD_SIMULATION_MUTATION_PRECONDITION_MISMATCH";
        error.world_path = worldPath.join(".");
        error.expected_from = cloneJson(mutation.from);
        error.actual_from = cloneJson(before);
        throw error;
      }
      assertPhase63CRetrievalPersistenceMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase64AMemoryPlasticityMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase65ASubjectiveClaimMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase65BSubjectiveClaimRelationMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase66ASubjectiveBeliefRevisionMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67ASubjectiveEpisodeSegmentationMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67BAutobiographicalLifeEventMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67CPersonalSemanticMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67DAutobiographicalLifePeriodMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      setAtPath(executed, worldPath, mutation.to);
      applied.push({
        mutation_id: mutation.mutation_id,
        batch_id: batch.batch_id,
        time_ms: batch.time_ms,
        world_path: worldPath.join("."),
      });
    }
  }
  const projection = {
    version: worldSimulationMutationExecutorVersion,
    queue_hash: queue.queue_hash ?? null,
    applied_mutation_count: applied.length,
    applied_batch_count: array(queue.batches).length,
    projection_only: true,
    final_world_state_commit_authority: false,
    mutation_preconditions_checked_at_apply_time: true,
    applied,
  };
  projection.projection_hash = hashAgentRunValue({
    version: projection.version,
    queue_hash: projection.queue_hash,
    applied,
    projected_world_state: executed,
  });
  return { projected_world_state: executed, projection };
}

export function executeWorldSimulationChronologicalMutationQueue(input = {}) {
  const queue = object(input.queue);
  const preview = cloneJson(object(input.preview_world_state));
  const executed = cloneJson(object(input.world_state));
  const applied = [];
  for (const batch of array(queue.batches)) {
    for (const mutation of array(batch?.mutations)) {
      const worldPath = mutationWorldPath(mutation, executed, preview, input.scene_id ?? null);
      if (!worldPath) {
        const error = new Error(`Authoritative mutation queue cannot resolve world path for ${mutation?.mutation_path ?? mutation?.mutation_id ?? "<unknown>"}.`);
        error.code = "WORLD_SIMULATION_MUTATION_PATH_UNRESOLVED";
        throw error;
      }
      const before = effectiveMutationBefore(executed, worldPath, mutation);
      if (!sameValue(before, mutation.from)) {
        const error = new Error(`Authoritative mutation precondition mismatch at ${worldPath.join(".")}.`);
        error.code = "WORLD_SIMULATION_MUTATION_PRECONDITION_MISMATCH";
        error.world_path = worldPath.join(".");
        error.expected_from = cloneJson(mutation.from);
        error.actual_from = cloneJson(before);
        throw error;
      }
      assertPhase63CRetrievalPersistenceMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase64AMemoryPlasticityMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase65ASubjectiveClaimMutation(
        executed,
        worldPath,
        mutation,
      );
      assertPhase65BSubjectiveClaimRelationMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase66ASubjectiveBeliefRevisionMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67ASubjectiveEpisodeSegmentationMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67BAutobiographicalLifeEventMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67CPersonalSemanticMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      assertPhase67DAutobiographicalLifePeriodMutation(
        executed,
        worldPath,
        mutation,
        queue.turn_id,
      );
      setAtPath(executed, worldPath, mutation.to);
      applied.push({
        mutation_id: mutation.mutation_id,
        batch_id: batch.batch_id,
        time_ms: batch.time_ms,
        world_path: worldPath.join("."),
      });
    }
  }
  for (const key of ["projectiles", "ability_fields"]) {
    if (executed[key] === undefined && isObject(preview[key]) && Object.keys(preview[key]).length === 0) executed[key] = {};
  }
  for (const [characterId, previewCharacter] of Object.entries(object(preview.characters))) {
    const previewPhysical = object(previewCharacter?.physical_state);
    if (!Object.keys(previewPhysical).length) continue;
    executed.characters = object(executed.characters);
    const executedCharacter = object(executed.characters[characterId]);
    executedCharacter.physical_state = object(executedCharacter.physical_state);
    const physical = executedCharacter.physical_state;
    if (physical.movement_multiplier === undefined && previewPhysical.movement_multiplier === 1) physical.movement_multiplier = 1;
    if (physical.combat_multiplier === undefined && previewPhysical.combat_multiplier === 1) physical.combat_multiplier = 1;
    if (physical.incapacitated === undefined && previewPhysical.incapacitated === false) physical.incapacitated = false;
    if (physical.immobilized === undefined && previewPhysical.immobilized === false) physical.immobilized = false;
    if (physical.injuries === undefined && Array.isArray(previewPhysical.injuries) && previewPhysical.injuries.length === 0) physical.injuries = [];
    executed.characters[characterId] = executedCharacter;
  }
  const uncovered = changedLeafPaths(executed, preview).filter(Boolean);
  if (uncovered.length) {
    const error = new Error(`Subsystem preview contains ${uncovered.length} state changes not reproduced by the authoritative mutation queue.`);
    error.code = "WORLD_SIMULATION_UNQUEUED_STATE_MUTATION";
    error.uncovered_paths = uncovered.slice(0, 64);
    throw error;
  }
  const execution = {
    version: worldSimulationMutationExecutorVersion,
    queue_hash: queue.queue_hash ?? null,
    applied_mutation_count: applied.length,
    applied_batch_count: array(queue.batches).length,
    sole_final_world_state_writer: true,
    subsystem_world_state_mutations_are_ephemeral_preview_only: true,
    all_preview_changes_reproduced_by_queue: true,
    applied,
  };
  execution.execution_hash = hashAgentRunValue({
    version: execution.version,
    queue_hash: execution.queue_hash,
    applied,
    final_world_state: executed,
  });
  return { next_world_state: executed, execution };
}

export function buildWorldSimulationChronologicalMutationQueueContract() {
  return {
    version: worldSimulationChronologicalMutationQueueVersion,
    owner: "programmatic_authoritative_mutation_executor",
    ordering: {
      timestamp_ordered: true,
      exact_same_timestamp_batched: true,
      earlier_batch_commits_before_later_batch_reads: true,
      same_timestamp_batch_does_not_create_retroactive_preemption: true,
      deterministic_same_batch_reduction_does_not_imply_causal_precedence: true,
      deterministic_replay_hash_chain: true,
    },
    coverage: {
      all_causal_state_transitions_normalized_into_queue: true,
      exact_transition_timestamps_preferred: true,
      missing_transition_timestamps_fall_back_to_turn_end: true,
      actor_position_time_may_be_inferred_from_piecewise_trajectory: true,
    },
    persistence: "world_history_turn.chronological_mutation_queue",
    character_brain_may_create_or_reorder_mutations: false,
    execution: {
      sole_final_world_state_writer: true,
      subsystem_mutations_are_ephemeral_preview_only: true,
      unqueued_preview_state_changes_rejected: true,
      mutation_preconditions_checked_at_apply_time: true,
      phase63c_retrieval_event_write_once_enforced: true,
      phase63c_retrieval_history_append_only_enforced: true,
      phase63c_retrieval_history_legacy_baseline_immutable: true,
      direct_nested_retrieval_history_mutation_rejected: true,
      phase65a_subjective_claim_event_write_once_enforced: true,
      phase65a_subjective_claim_event_content_address_verified: true,
      phase65a_subjective_claim_evidence_memory_hash_verified: true,
      phase65a_subjective_claim_history_append_only_enforced: true,
      direct_nested_subjective_claim_history_mutation_rejected: true,
      phase65b_subjective_claim_relation_event_write_once_enforced: true,
      phase65b_subjective_claim_relation_event_content_address_verified: true,
      phase65b_subjective_claim_relation_claim_hash_pinning_enforced: true,
      phase65b_subjective_claim_relation_history_append_only_enforced: true,
      direct_nested_subjective_claim_relation_history_mutation_rejected: true,
      phase65b_historical_claim_rewrite_rejected: true,
      phase66a_subjective_belief_revision_event_write_once_enforced: true,
      phase66a_subjective_belief_revision_event_content_address_verified: true,
      phase66a_source_resolution_decision_hash_verified: true,
      phase66a_source_claim_relation_hash_pinning_enforced: true,
      phase66a_subjective_belief_revision_history_append_only_enforced: true,
      phase66a_per_character_revision_hash_chain_enforced: true,
      direct_nested_subjective_belief_revision_history_mutation_rejected: true,
      phase66a_historical_revision_rewrite_rejected: true,
      phase67a_subjective_episode_segmentation_event_write_once_enforced: true,
      phase67a_subjective_episode_segmentation_event_content_address_verified: true,
      phase67a_source_subjective_memory_hash_pinning_enforced: true,
      phase67a_explicit_phase63_episode_binding_preserved: true,
      phase67a_subjective_episode_segmentation_history_append_only_enforced: true,
      phase67a_per_character_segmentation_hash_chain_enforced: true,
      direct_nested_subjective_episode_segmentation_history_mutation_rejected: true,
      phase67a_historical_segmentation_rewrite_rejected: true,
      phase67b_autobiographical_life_event_event_write_once_enforced: true,
      phase67b_autobiographical_life_event_event_content_address_verified: true,
      phase67b_source_segmentation_event_hash_pinning_enforced: true,
      phase67b_source_effective_episode_hash_pinning_enforced: true,
      phase67b_cross_episode_attach_strong_evidence_required: true,
      phase67b_explicit_programmatic_binding_provenance_verified: true,
      phase67b_unverifiable_goal_task_project_relationship_evidence_rejected: true,
      phase67b_one_primary_life_event_parent_per_episode_enforced: true,
      phase67b_autobiographical_life_event_history_append_only_enforced: true,
      phase67b_per_character_life_event_hash_chain_enforced: true,
      direct_nested_autobiographical_life_event_history_mutation_rejected: true,
      phase67b_historical_life_event_organization_rewrite_rejected: true,
      phase67c_personal_semantic_derivation_event_write_once_enforced: true,
      phase67c_personal_semantic_derivation_event_content_address_verified: true,
      phase67c_source_life_event_hash_pinning_enforced: true,
      phase67c_current_turn_life_event_trigger_enforced: true,
      phase67c_same_character_life_event_evidence_enforced: true,
      phase67c_recurring_pattern_distinct_life_events_required: true,
      phase67c_recurring_pattern_count_auto_promotion_rejected: true,
      phase67c_personal_semantic_history_append_only_enforced: true,
      phase67c_per_character_derivation_hash_chain_enforced: true,
      phase67c_per_semantic_memory_hash_chain_enforced: true,
      phase67c_semantic_identity_rewrite_rejected: true,
      phase67c_counterevidence_preserved_without_belief_resolution: true,
      direct_nested_personal_semantic_history_mutation_rejected: true,
      phase67c_historical_personal_semantic_rewrite_rejected: true,
      phase67d_autobiographical_life_period_event_write_once_enforced: true,
      phase67d_autobiographical_life_period_event_content_address_verified: true,
      phase67d_source_life_event_hash_pinning_enforced: true,
      phase67d_source_personal_semantic_hash_pinning_enforced: true,
      phase67d_current_turn_autobiographical_trigger_enforced: true,
      phase67d_same_character_evidence_enforced: true,
      phase67d_overlapping_periods_allowed: true,
      phase67d_many_to_many_life_event_membership_enforced: true,
      phase67d_temporal_adjacency_alone_rejected: true,
      phase67d_calendar_bucket_membership_rejected: true,
      phase67d_personal_semantic_support_provenance_verified: true,
      phase67d_explicit_programmatic_binding_provenance_verified: true,
      phase67d_life_period_history_append_only_enforced: true,
      phase67d_per_character_life_period_hash_chain_enforced: true,
      phase67d_per_period_hash_chain_enforced: true,
      phase67d_closed_period_mutation_rejected: true,
      phase67d_period_identity_rewrite_rejected: true,
      direct_nested_autobiographical_life_period_history_mutation_rejected: true,
      phase67d_historical_life_period_organization_rewrite_rejected: true,
    },
    known_boundary: "Phase62K makes the chronological queue the sole writer of the final turn world state. Subsystems may mutate isolated preview drafts to compute causal proposals, but every committed change must be reproduced by queued mutations.",
  };
}

export function buildWorldSimulationChronologicalMutationQueue(input = {}) {
  const normalized = stableSortMutations(
    array(input.state_transitions).map((transition, index) => normalizeMutation(transition, index, input)),
  );
  const built = buildBatches(normalized, input);
  const exactCount = normalized.filter((item) => item.time_precision === "exact").length;
  const inferredCount = normalized.length - exactCount;
  const queue = {
    version: worldSimulationChronologicalMutationQueueVersion,
    turn_id: input.turn_id ?? null,
    mutation_count: normalized.length,
    batch_count: built.batches.length,
    exact_timestamp_mutation_count: exactCount,
    inferred_timestamp_mutation_count: inferredCount,
    continuity_warning_count: built.continuityWarnings.length,
    continuity_warnings: built.continuityWarnings,
    all_mutations_timed: normalized.every((item) => Number.isFinite(item.time_ms) && item.time_ms >= 0),
    batches: built.batches,
    final_projection: built.finalProjection,
    terminal_chain_hash: built.finalChainHash,
  };
  queue.queue_hash = hashAgentRunValue({
    version: queue.version,
    turn_id: queue.turn_id,
    mutation_count: queue.mutation_count,
    batch_count: queue.batch_count,
    terminal_chain_hash: queue.terminal_chain_hash,
    batches: queue.batches,
  });
  return queue;
}
