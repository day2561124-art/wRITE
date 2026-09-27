import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyProprioceptiveFeedbackVersion =
  "body-1d-committed-proprioceptive-feedback-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function actorName(value) { return typeof value === "string" ? value.trim() : ""; }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function point(value) {
  const candidate = record(value);
  return finite(candidate.x) && finite(candidate.y)
    ? { x: candidate.x, y: candidate.y }
    : null;
}
function samePoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y);
}

function currentScenePosition(state, actor, sceneId) {
  const scenes = record(state.scenes);
  if (sceneId !== undefined && sceneId !== null) {
    const id = actorName(sceneId);
    if (!id || !Object.hasOwn(scenes, id)) return null;
    return point(record(scenes[id]).entity_positions?.[actor]);
  }
  for (const scene of Object.values(scenes)) {
    const current = point(record(scene).entity_positions?.[actor]);
    if (current) return current;
  }
  return null;
}

// BODY-1D exposes bounded proprioceptive evidence derived only from committed
// body/world state. Exact engine coordinates and world-axis direction stay
// private; a motor intention or outcome string alone never becomes a body
// movement signal.
export function projectWorldSimulationBodyProprioceptiveFeedback({
  world_state, world_history, world_state_revision, character, scene_id,
} = {}) {
  const actor = actorName(character);
  if (!actor) fail("BODY1D_CHARACTER_REQUIRED");
  const state = record(world_state);
  if (!Object.hasOwn(record(state.characters), actor))
    fail("BODY1D_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1D_REVISION_REQUIRED");

  const currentPosition = currentScenePosition(state, actor, scene_id);
  const turns = items(record(world_history).turns);
  const latestTurn = record(turns.at(-1));
  if (world_state_revision > 0 && latestTurn.revision_to !== world_state_revision)
    fail("BODY1D_HISTORY_REVISION_MISMATCH");

  const movementSignals = [];
  if (currentPosition && latestTurn.revision_to === world_state_revision) {
    for (const transition of items(latestTurn.state_transitions)) {
      if (transition?.entity !== actor || transition.field !== "position") continue;
      const from = point(transition.from);
      const to = point(transition.to);
      if (!from || !to || samePoint(from, to) || !samePoint(to, currentPosition)) continue;
      movementSignals.push(Object.freeze({
        modality: "proprioception",
        signal: "whole_body_translation_detected",
        source_world_revision: world_state_revision,
        exact_world_position_exposed: false,
        exact_displacement_exposed: false,
        world_axis_direction_exposed: false,
        subjective_movement_belief_asserted: false,
      }));
    }
  }

  return Object.freeze({
    version: worldSimulationBodyProprioceptiveFeedbackVersion,
    authority: "committed_world_body_state_and_history",
    character: actor,
    source_world_revision: world_state_revision,
    position_sense: Object.freeze({
      status: currentPosition
        ? "whole_body_position_signal_available"
        : "unavailable",
      exact_world_position_exposed: false,
    }),
    movement_feedback: Object.freeze(movementSignals),
    boundaries: Object.freeze({
      motor_intention_is_not_movement_feedback: true,
      action_outcome_alone_is_not_movement_feedback: true,
      movement_feedback_requires_committed_position_transition: true,
      movement_feedback_requires_current_state_match: true,
      objective_world_coordinates_exposed: false,
      world_axis_direction_exposed: false,
      subjective_body_belief_asserted: false,
    }),
  });
}

export async function readCommittedWorldSimulationBodyProprioceptiveFeedback({
  session_id, character, scene_id, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1D_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1D_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1D_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1D_HISTORY_STATE_MISMATCH");

  return Object.freeze({
    ...projectWorldSimulationBodyProprioceptiveFeedback({
      world_state: first.state,
      world_history: history,
      world_state_revision: first.revision,
      character,
      scene_id,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodyProprioceptiveFeedbackContract() {
  return Object.freeze({
    version: worldSimulationBodyProprioceptiveFeedbackVersion,
    source: "committed_world_body_state_and_history",
    read_only: true,
    current_position_signal_without_engine_coordinates: true,
    movement_feedback_requires_committed_position_transition: true,
    movement_intention_is_not_movement_feedback: true,
    action_outcome_alone_is_not_movement_feedback: true,
    subjective_body_belief_asserted: false,
  });
}
