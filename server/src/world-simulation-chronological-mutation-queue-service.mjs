import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationChronologicalMutationQueueVersion = "phase62j-chronological-mutation-queue-v1";

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

function stableSortMutations(mutations) {
  return [...mutations].sort((left, right) => (
    left.time_ms - right.time_ms
    || sourcePriority(left.source_layer) - sourcePriority(right.source_layer)
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
        read_semantics: "all_mutations_read_pre_batch_world_state",
        commit_semantics: "same_timestamp_batch_commits_atomically",
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

export function buildWorldSimulationChronologicalMutationQueueContract() {
  return {
    version: worldSimulationChronologicalMutationQueueVersion,
    owner: "programmatic_chronological_mutation_queue",
    ordering: {
      timestamp_ordered: true,
      exact_same_timestamp_batched: true,
      earlier_batch_commits_before_later_batch_reads: true,
      same_timestamp_batch_does_not_create_retroactive_preemption: true,
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
    known_boundary: "Phase62J v1 centralizes resolved state mutations into one timestamped, batched, replay-hashed queue. Existing subsystem adjudicators still compute mutation contents; a later phase may make the queue the sole mutation executor.",
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
