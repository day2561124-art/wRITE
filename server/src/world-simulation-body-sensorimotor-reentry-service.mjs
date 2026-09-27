import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodySensorimotorReentryVersion =
  "body-1a-committed-motor-visual-reentry-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function list(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function safeInteger(value) { return Number.isSafeInteger(value) && value >= 0; }

// The visual query in an action turn precedes its causal mutation. A later
// sample is eligible only when its source revision is the committed action's
// destination revision; neither an intent nor an outcome alone changes sight.
function visualSample(turn, actor) {
  const query = list(turn.directional_height_visibility_queries)
    .find((entry) => entry?.result?.observer === actor);
  const observations = query?.result?.perception_visual_observations;
  return Array.isArray(observations)
    ? { count: observations.length, query_version: query.version ?? null }
    : null;
}

export function projectWorldSimulationBodySensorimotorReentry({
  world_history, character, max_pairs = 32,
} = {}) {
  const actor = typeof character === "string" ? character.trim() : "";
  if (!actor) fail("BODY1A_CHARACTER_REQUIRED");
  if (!Number.isSafeInteger(max_pairs) || max_pairs < 1 || max_pairs > 128)
    fail("BODY1A_LIMIT_INVALID");
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
      const actionId = candidate.action_id;
      if (typeof actionId !== "string" || !actionId) continue;
      const outcome = list(turn.action_outcomes).find((item) =>
        item?.actor === actor && item.action_id === actionId);
      const movement = list(turn.state_transitions).some((item) =>
        item?.entity === actor && item.field === "position");
      const linkedNext = next.revision_from === turn.revision_to
        && next.previous_state_hash === turn.next_state_hash;
      const before = visualSample(turn, actor);
      const after = linkedNext ? visualSample(next, actor) : null;
      pairs.push({
        action_turn_id: turn.turn_id ?? null,
        action_id: actionId,
        world_revision_after_action: turn.revision_to,
        world_outcome: typeof outcome?.result === "string" ? outcome.result : null,
        actual_position_changed: movement,
        pre_action_visual_observation_count: before?.count ?? null,
        next_visual_sample: after ? {
          turn_id: next.turn_id ?? null,
          source_world_revision: next.revision_from,
          observation_count: after.count,
          observation_count_changed: before ? after.count !== before.count : null,
        } : null,
        feedback_status: after ? "later_committed_sample_available"
          : "no_later_committed_sample",
      });
    }
  }
  return {
    version: worldSimulationBodySensorimotorReentryVersion,
    authority: "derived_committed_world_history",
    character: actor,
    pairs: pairs.slice(-max_pairs),
    boundaries: {
      movement_intention_is_not_executed_movement: true,
      outcome_is_not_sensory_sample: true,
      sample_must_follow_world_commit: true,
      visual_count_change_does_not_prove_movement_caused_change: true,
      engine_target_ids_exposed: false,
    },
  };
}

export async function readCommittedWorldSimulationBodySensorimotorReentry({
  session_id, character, max_pairs, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && expected_revision !== first.revision)
    fail("BODY1A_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && expected_state_hash !== first.state_hash)
    fail("BODY1A_STATE_HASH_CHANGED");
  if (!Object.hasOwn(object(first.state?.characters), String(character ?? "").trim()))
    fail("BODY1A_CHARACTER_NOT_IN_COMMITTED_WORLD");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1A_COMMITTED_SNAPSHOT_CHANGED");
  const last = list(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1A_HISTORY_STATE_MISMATCH");
  return {
    ...projectWorldSimulationBodySensorimotorReentry({
      world_history: history, character, max_pairs,
    }),
    world_state_revision: first.revision,
    world_state_hash: first.state_hash,
  };
}

export function buildWorldSimulationBodySensorimotorReentryContract() {
  return {
    version: worldSimulationBodySensorimotorReentryVersion,
    source: "committed_world_history",
    read_only: true,
    movement_feedback_requires_world_transition: true,
    later_visual_sample_requires_committed_revision_link: true,
    head_touch_olfaction_and_motor_effectors_deferred: true,
  };
}
