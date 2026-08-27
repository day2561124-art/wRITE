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
