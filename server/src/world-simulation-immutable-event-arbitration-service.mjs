import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationImmutableEventArbitrationVersion = "phase62s-immutable-event-arbitration-v1";

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
  const event = object(candidate.event);
  const timeMs = finiteNumber(candidate.time_ms ?? event.time_ms ?? event.timeMs);
  if (timeMs === null || timeMs < 0) {
    const error = new Error("Immutable event arbitration candidates require a non-negative finite event time.");
    error.code = "WORLD_SIMULATION_EVENT_ARBITRATION_CANDIDATE_INVALID";
    throw error;
  }
  const forbidden = forbiddenPaths(candidate);
  if (forbidden.length) {
    const error = new Error(`Immutable event arbitration candidate contains forbidden state-changing fields: ${forbidden.join(", ")}.`);
    error.code = "WORLD_SIMULATION_IMMUTABLE_EVENT_ARBITRATION_INPUT_FORBIDDEN";
    error.forbidden_fields = forbidden;
    throw error;
  }
  const source = String(candidate.source ?? candidate.source_layer ?? "event_query").trim() || "event_query";
  const subjectId = String(candidate.subject_id ?? candidate.projectile_id ?? candidate.field_id ?? candidate.actor ?? "").trim();
  const eventKind = String(event.kind ?? candidate.kind ?? "event").trim() || "event";
  const candidateId = String(candidate.candidate_id ?? `${source}:${subjectId}:${eventKind}:${timeMs}`).trim();
  return {
    ...candidate,
    candidate_id: candidateId,
    source,
    subject_id: subjectId || null,
    time_ms: timeMs,
    event: cloneJson(event),
  };
}

function compareCandidates(left, right) {
  return (
    left.time_ms - right.time_ms
    || String(left.source ?? "").localeCompare(String(right.source ?? ""))
    || String(left.subject_id ?? "").localeCompare(String(right.subject_id ?? ""), "zh-Hant-TW")
    || String(left.candidate_id ?? "").localeCompare(String(right.candidate_id ?? ""))
    || String(left.event?.kind ?? "").localeCompare(String(right.event?.kind ?? ""))
    || hashAgentRunValue(left).localeCompare(hashAgentRunValue(right))
  );
}

function canonicalCandidates(values) {
  return array(values).map(normalizedCandidate).sort(compareCandidates);
}

function computeArbitration(candidates, toleranceMs) {
  if (!candidates.length) {
    return {
      ok: true,
      candidate_count: 0,
      selected_count: 0,
      deferred_count: 0,
      earliest_time_ms: null,
      exact_timestamp_batch: true,
      selected_batch: [],
      requery_policy: "all_unresolved_candidates_after_batch_application",
    };
  }
  const earliestTimeMs = candidates[0].time_ms;
  const selectedBatch = candidates.filter((candidate) => Math.abs(candidate.time_ms - earliestTimeMs) <= toleranceMs);
  return {
    ok: true,
    candidate_count: candidates.length,
    selected_count: selectedBatch.length,
    deferred_count: candidates.length - selectedBatch.length,
    earliest_time_ms: earliestTimeMs,
    exact_timestamp_batch: true,
    selected_batch: cloneJson(selectedBatch),
    requery_policy: "all_unresolved_candidates_after_batch_application",
  };
}

export function arbitrateWorldSimulationEventCandidates(input = {}) {
  const toleranceMs = Math.max(0, finiteNumber(input.simultaneous_tolerance_ms, 1e-6));
  const candidates = canonicalCandidates(input.candidates);
  const frozenCandidates = deepFreeze(cloneJson(candidates));
  const inputHashBefore = hashAgentRunValue(frozenCandidates);

  const runOnce = () => computeArbitration(frozenCandidates, toleranceMs);
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Immutable event arbitration produced non-deterministic output for identical candidate observations.");
    error.code = "WORLD_SIMULATION_EVENT_ARBITRATION_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  const inputHashAfter = hashAgentRunValue(frozenCandidates);
  if (inputHashBefore !== inputHashAfter) {
    const error = new Error("Immutable event arbitration mutated its candidate observations.");
    error.code = "WORLD_SIMULATION_EVENT_ARBITRATION_INPUT_MUTATION";
    throw error;
  }
  const forbidden = forbiddenPaths(first);
  if (forbidden.length) {
    const error = new Error(`Immutable event arbitration returned forbidden state-changing fields: ${forbidden.join(", ")}.`);
    error.code = "WORLD_SIMULATION_IMMUTABLE_EVENT_ARBITRATION_OUTPUT_FORBIDDEN";
    error.forbidden_fields = forbidden;
    throw error;
  }

  const audit = {
    version: worldSimulationImmutableEventArbitrationVersion,
    arbitration: "earliest_exact_time_event_batch",
    input_candidate_set_hash: inputHashBefore,
    output_batch_hash: firstHash,
    candidate_count: first.candidate_count,
    selected_count: first.selected_count,
    earliest_time_ms: first.earliest_time_ms,
    simultaneous_tolerance_ms: toleranceMs,
    input_candidates_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    output_contains_world_state: false,
    output_contains_mutation_proposals: false,
    candidate_order_invariant: true,
    exact_timestamp_batch_preserved: true,
    selected_batch_internal_order_is_replay_only: true,
    requery_required_after_batch_application: true,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    arbitration_version: worldSimulationImmutableEventArbitrationVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationImmutableEventArbitrationContract() {
  return {
    version: worldSimulationImmutableEventArbitrationVersion,
    owner: "deterministic_read_only_event_arbitrator",
    arbitration_scope: "queried_event_candidates",
    candidate_contract: {
      observations_only: true,
      receives_canonical_frozen_clones: true,
      requires_non_negative_finite_event_time: true,
      candidate_input_order_has_no_semantic_effect: true,
    },
    selection_contract: {
      earliest_time_batch_only: true,
      exact_timestamp_ties_are_simultaneous: true,
      stable_member_order_is_replay_only_not_causal_precedence: true,
      all_unresolved_candidates_are_requeried_after_batch_application: true,
    },
    may_return_world_state: false,
    may_return_mutation_proposals: false,
    deterministic_replay_verified: true,
    character_brain_may_decide_event_precedence: false,
    known_boundary: "Phase62S moves queried projectile-candidate batch selection behind an immutable deterministic arbitration boundary. Cross-layer global timeline fixed-point arbitration remains in the existing global causal timeline service.",
  };
}
