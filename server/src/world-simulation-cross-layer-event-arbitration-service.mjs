import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationCrossLayerEventArbitrationVersion = "phase62t-cross-layer-event-arbitration-v1";

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

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function forbiddenPaths(value, prefix = [], output = []) {
  if (!value || typeof value !== "object") return output;
  const forbidden = new Set([
    "world_state",
    "next_world_state",
    "preview_world_state",
    "projected_world_state",
    "mutation_proposals",
    "state_transitions",
  ]);
  for (const [key, child] of Object.entries(value)) {
    const path = [...prefix, key];
    if (forbidden.has(key)) output.push(path.join("."));
    forbiddenPaths(child, path, output);
  }
  return output;
}

function normalizedCandidate(raw) {
  const candidate = cloneJson(object(raw));
  const observation = cloneJson(object(candidate.observation));
  const timeMs = finiteNumber(candidate.time_ms ?? observation.time_ms);
  if (timeMs === null || timeMs < 0) {
    const error = new Error("Cross-layer event arbitration candidates require a non-negative finite event time.");
    error.code = "WORLD_SIMULATION_CROSS_LAYER_EVENT_CANDIDATE_INVALID";
    throw error;
  }
  const forbidden = forbiddenPaths(candidate);
  if (forbidden.length) {
    const error = new Error(`Cross-layer event candidate contains forbidden state-changing fields: ${forbidden.join(", ")}.`);
    error.code = "WORLD_SIMULATION_CROSS_LAYER_EVENT_ARBITRATION_INPUT_FORBIDDEN";
    error.forbidden_fields = forbidden;
    throw error;
  }
  const sourceLayer = String(candidate.source_layer ?? observation.source_layer ?? "unknown").trim() || "unknown";
  const role = String(candidate.role ?? "event").trim() || "event";
  const kind = String(candidate.kind ?? observation.kind ?? "event").trim() || "event";
  const subjectId = String(
    candidate.subject_id
      ?? observation.actor
      ?? observation.target
      ?? observation.projectile_id
      ?? observation.field_id
      ?? "",
  ).trim();
  const actionId = String(candidate.action_id ?? observation.action_id ?? "").trim();
  const candidateId = String(
    candidate.candidate_id
      ?? `${sourceLayer}:${role}:${kind}:${subjectId || actionId || "anonymous"}:${timeMs}`,
  ).trim();
  return {
    ...candidate,
    candidate_id: candidateId,
    source_layer: sourceLayer,
    role,
    kind,
    subject_id: subjectId || null,
    action_id: actionId || null,
    time_ms: timeMs,
    observation,
  };
}

function compareCandidates(left, right) {
  return (
    left.time_ms - right.time_ms
    || String(left.source_layer ?? "").localeCompare(String(right.source_layer ?? ""))
    || String(left.role ?? "").localeCompare(String(right.role ?? ""))
    || String(left.kind ?? "").localeCompare(String(right.kind ?? ""))
    || String(left.subject_id ?? "").localeCompare(String(right.subject_id ?? ""), "zh-Hant-TW")
    || String(left.action_id ?? "").localeCompare(String(right.action_id ?? ""))
    || String(left.candidate_id ?? "").localeCompare(String(right.candidate_id ?? ""))
    || hashAgentRunValue(left).localeCompare(hashAgentRunValue(right))
  );
}

function canonicalCandidates(values) {
  return array(values).map(normalizedCandidate).sort(compareCandidates);
}

function computeBatches(candidates, toleranceMs) {
  const batches = [];
  for (const candidate of candidates) {
    const last = batches.at(-1);
    if (!last || Math.abs(candidate.time_ms - last.time_ms) > toleranceMs) {
      batches.push({
        batch_index: batches.length,
        time_ms: candidate.time_ms,
        exact_timestamp_batch: true,
        members: [cloneJson(candidate)],
      });
    } else {
      last.members.push(cloneJson(candidate));
    }
  }
  for (const batch of batches) {
    batch.member_count = batch.members.length;
    batch.source_layers = [...new Set(batch.members.map((item) => item.source_layer))].sort();
    batch.roles = [...new Set(batch.members.map((item) => item.role))].sort();
    batch.cross_layer = batch.source_layers.length > 1;
  }
  return {
    ok: true,
    candidate_count: candidates.length,
    batch_count: batches.length,
    cross_layer_batch_count: batches.filter((batch) => batch.cross_layer).length,
    earliest_time_ms: batches[0]?.time_ms ?? null,
    exact_timestamp_batches: true,
    batches,
  };
}

export function arbitrateWorldSimulationCrossLayerEventCandidates(input = {}) {
  const toleranceMs = Math.max(0, finiteNumber(input.simultaneous_tolerance_ms, 1e-6));
  const candidates = canonicalCandidates(input.candidates);
  const frozenCandidates = deepFreeze(cloneJson(candidates));
  const inputHashBefore = hashAgentRunValue(frozenCandidates);
  const runOnce = () => computeBatches(frozenCandidates, toleranceMs);
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Cross-layer event arbitration produced non-deterministic batches for identical candidate observations.");
    error.code = "WORLD_SIMULATION_CROSS_LAYER_EVENT_ARBITRATION_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (inputHashBefore !== hashAgentRunValue(frozenCandidates)) {
    const error = new Error("Cross-layer event arbitration mutated candidate observations.");
    error.code = "WORLD_SIMULATION_CROSS_LAYER_EVENT_ARBITRATION_INPUT_MUTATION";
    throw error;
  }
  const forbidden = forbiddenPaths(first);
  if (forbidden.length) {
    const error = new Error(`Cross-layer event arbitration returned forbidden state-changing fields: ${forbidden.join(", ")}.`);
    error.code = "WORLD_SIMULATION_CROSS_LAYER_EVENT_ARBITRATION_OUTPUT_FORBIDDEN";
    error.forbidden_fields = forbidden;
    throw error;
  }
  const sourceLayers = [...new Set(candidates.map((item) => item.source_layer))].sort();
  const audit = {
    version: worldSimulationCrossLayerEventArbitrationVersion,
    arbitration: "canonical_cross_layer_exact_time_batches",
    input_candidate_set_hash: inputHashBefore,
    output_batches_hash: firstHash,
    candidate_count: first.candidate_count,
    batch_count: first.batch_count,
    cross_layer_batch_count: first.cross_layer_batch_count,
    source_layers: sourceLayers,
    simultaneous_tolerance_ms: toleranceMs,
    input_candidates_immutable: true,
    candidate_order_invariant: true,
    exact_timestamp_batches_preserved: true,
    stable_member_order_is_replay_only: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    output_contains_world_state: false,
    output_contains_mutation_proposals: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    arbitration_version: worldSimulationCrossLayerEventArbitrationVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationCrossLayerEventArbitrationContract() {
  return {
    version: worldSimulationCrossLayerEventArbitrationVersion,
    owner: "deterministic_cross_layer_event_arbitrator",
    candidate_scope: [
      "combat_scheduled_point_events",
      "continuous_physics_scheduled_point_events",
      "resolved_incapacitation_observations",
    ],
    candidate_contract: {
      observations_only: true,
      receives_canonical_frozen_clones: true,
      input_order_has_no_semantic_effect: true,
      source_layer_is_explicit: true,
    },
    batch_contract: {
      groups_all_candidates_into_exact_time_batches: true,
      same_timestamp_cross_layer_members_are_simultaneous: true,
      stable_member_order_is_replay_only_not_causal_precedence: true,
      strict_earlier_batch_may_preempt_later_execution: true,
      same_batch_incapacitation_does_not_retroactively_preempt_peer_execution: true,
    },
    may_return_world_state: false,
    may_return_mutation_proposals: false,
    deterministic_replay_verified: true,
    character_brain_may_decide_cross_layer_precedence: false,
    known_boundary: "Phase62T moves cross-layer scheduled point events plus resolved incapacitation observations into immutable canonical exact-time batches used by global preemption analysis. Global fixed-point recomputation and subsystem resolution execution remain programmatic orchestration.",
  };
}
