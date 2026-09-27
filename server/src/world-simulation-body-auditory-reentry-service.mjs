import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyAuditoryReentryVersion =
  "body-1e-committed-movement-auditory-reentry-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function list(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function safeInteger(value) { return Number.isSafeInteger(value) && value >= 0; }

function stableAuditoryObservationSignature(observations) {
  return JSON.stringify(list(observations).map((item) => ({
    sense: item?.sense ?? null,
    kind: item?.kind ?? null,
    perceptual_label: item?.perceptual_label ?? null,
    relative_direction_sector: item?.relative_direction_sector ?? null,
    localization_is_coarse: item?.localization_is_coarse === true,
  })));
}

// Audibility is sampled before a turn's causal mutation. A later auditory
// sample belongs to a committed movement only when the next turn starts from
// the movement turn's exact committed revision/hash lineage. Engine sound IDs,
// source coordinates and dB values never enter this BODY-1 evidence surface.
function auditorySample(turn, actor) {
  const query = list(turn.audibility_queries)
    .find((entry) => entry?.result?.observer === actor);
  const observations = query?.result?.perception_auditory_observations;
  return Array.isArray(observations)
    ? {
      count: observations.length,
      signature: stableAuditoryObservationSignature(observations),
      query_version: query.version ?? query.audibility_query_version ?? null,
    }
    : null;
}

export function projectWorldSimulationBodyAuditoryReentry({
  world_history, character, max_pairs = 32,
} = {}) {
  const actor = typeof character === "string" ? character.trim() : "";
  if (!actor) fail("BODY1E_CHARACTER_REQUIRED");
  if (!Number.isSafeInteger(max_pairs) || max_pairs < 1 || max_pairs > 128)
    fail("BODY1E_LIMIT_INVALID");

  const turns = list(object(world_history).turns);
  const pairs = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = object(turns[index]);
    const next = object(turns[index + 1]);
    if (!safeInteger(turn.revision_to)) continue;

    for (const selected of list(turn.selected_action_intents)) {
      if (selected?.character !== actor || selected.selection === "reject_all") continue;
      const candidate = object(selected.candidate);
      if (candidate.kind !== "movement" && !Object.keys(object(candidate.movement)).length)
        continue;
      const actionId = typeof candidate.action_id === "string"
        ? candidate.action_id.trim() : "";
      if (!actionId || selected.action_id !== actionId) continue;

      const outcome = list(turn.action_outcomes).find((item) =>
        item?.actor === actor && item.action_id === actionId);
      const positionTransition = list(turn.state_transitions).some((item) => {
        if (item?.entity !== actor || item.field !== "position") return false;
        const from = object(item.from);
        const to = object(item.to);
        return from.x !== to.x || from.y !== to.y;
      });
      const linkedNext = next.revision_from === turn.revision_to
        && next.previous_state_hash === turn.next_state_hash;
      const before = auditorySample(turn, actor);
      const after = linkedNext && positionTransition
        ? auditorySample(next, actor)
        : null;

      pairs.push({
        action_turn_id: turn.turn_id ?? null,
        action_id: actionId,
        world_revision_after_action: turn.revision_to,
        world_outcome: typeof outcome?.result === "string" ? outcome.result : null,
        actual_position_changed: positionTransition,
        pre_action_auditory_observation_count: before?.count ?? null,
        next_auditory_sample: after ? {
          turn_id: next.turn_id ?? null,
          source_world_revision: next.revision_from,
          observation_count: after.count,
          observation_count_changed: before ? after.count !== before.count : null,
          bounded_observation_set_changed:
            before ? after.signature !== before.signature : null,
        } : null,
        feedback_status: after
          ? "later_committed_auditory_sample_available"
          : "no_later_committed_auditory_sample",
      });
    }
  }

  return {
    version: worldSimulationBodyAuditoryReentryVersion,
    authority: "derived_committed_world_history",
    character: actor,
    pairs: pairs.slice(-max_pairs),
    boundaries: {
      movement_intention_is_not_executed_movement: true,
      action_outcome_alone_is_not_auditory_feedback: true,
      position_transition_required_for_movement_feedback: true,
      auditory_sample_must_follow_world_commit: true,
      exact_sound_source_ids_exposed: false,
      exact_sound_source_coordinates_exposed: false,
      exact_received_db_exposed: false,
      auditory_change_does_not_prove_movement_caused_change: true,
    },
  };
}

export async function readCommittedWorldSimulationBodyAuditoryReentry({
  session_id, character, max_pairs, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && expected_revision !== first.revision)
    fail("BODY1E_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && expected_state_hash !== first.state_hash)
    fail("BODY1E_STATE_HASH_CHANGED");
  if (!Object.hasOwn(object(first.state?.characters), String(character ?? "").trim()))
    fail("BODY1E_CHARACTER_NOT_IN_COMMITTED_WORLD");

  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1E_COMMITTED_SNAPSHOT_CHANGED");
  const last = list(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1E_HISTORY_STATE_MISMATCH");

  return {
    ...projectWorldSimulationBodyAuditoryReentry({
      world_history: history,
      character,
      max_pairs,
    }),
    world_state_revision: first.revision,
    world_state_hash: first.state_hash,
  };
}

export function buildWorldSimulationBodyAuditoryReentryContract() {
  return {
    version: worldSimulationBodyAuditoryReentryVersion,
    source: "committed_world_history_and_programmatic_audibility",
    read_only: true,
    movement_feedback_requires_committed_position_transition: true,
    later_auditory_sample_requires_committed_revision_hash_link: true,
    engine_sound_source_ids_exposed: false,
    exact_sound_coordinates_exposed: false,
    exact_received_db_exposed: false,
  };
}
