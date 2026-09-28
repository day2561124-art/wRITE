import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyVestibularFeedbackVersion =
  "body-1m-committed-head-rotation-feedback-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function facing(value) {
  return typeof value === "number" && Number.isFinite(value)
    && value >= 0 && value < 360 ? value : null;
}

// A committed head-facing transition supports a bounded rotation signal.
// One facing snapshot cannot establish rotation, angular speed, acceleration,
// balance success, or the character's subjective sense of direction.
export function projectWorldSimulationBodyVestibularFeedback({
  world_state, world_history, world_state_revision, character,
} = {}) {
  const actor = typeof character === "string" ? character.trim() : "";
  if (!actor) fail("BODY1M_CHARACTER_REQUIRED");
  const state = record(world_state);
  const characters = record(state.characters);
  if (!Object.hasOwn(characters, actor)) fail("BODY1M_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1M_REVISION_REQUIRED");
  const currentFacing = facing(record(characters[actor]).facing_degrees);
  const turns = items(record(world_history).turns);
  const latest = record(turns.at(-1));
  if (world_state_revision > 0 && latest.revision_to !== world_state_revision)
    fail("BODY1M_HISTORY_REVISION_MISMATCH");
  const rotationSignals = [];
  if (currentFacing !== null && latest.revision_to === world_state_revision) {
    for (const transition of items(latest.state_transitions)) {
      if (transition?.entity !== actor || transition.field !== "facing_degrees") continue;
      const before = facing(transition.from);
      const after = facing(transition.to);
      if (before === null || after === null || before === after
          || after !== currentFacing) continue;
      rotationSignals.push(Object.freeze({
        modality: "vestibular",
        signal: "head_rotation_detected",
        source_world_revision: world_state_revision,
      }));
    }
  }
  return Object.freeze({
    version: worldSimulationBodyVestibularFeedbackVersion,
    authority: "committed_world_body_state_and_history",
    character: actor,
    source_world_revision: world_state_revision,
    head_orientation_sense: Object.freeze({
      status: currentFacing === null ? "unavailable" : "head_orientation_signal_available",
    }),
    head_rotation_feedback: Object.freeze(rotationSignals),
    boundaries: Object.freeze({
      motor_intention_is_not_rotation_feedback: true,
      action_outcome_alone_is_not_rotation_feedback: true,
      rotation_requires_committed_facing_transition_and_current_state_match: true,
      exact_world_angle_exposed: false,
      angular_velocity_or_acceleration_inferred: false,
      subjective_orientation_belief_asserted: false,
    }),
  });
}

export async function readCommittedWorldSimulationBodyVestibularFeedback({
  session_id, character, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1M_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1M_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1M_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1M_HISTORY_STATE_MISMATCH");
  return Object.freeze({
    ...projectWorldSimulationBodyVestibularFeedback({
      world_state: first.state, world_history: history,
      world_state_revision: first.revision, character,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodyVestibularFeedbackContract() {
  return Object.freeze({
    version: worldSimulationBodyVestibularFeedbackVersion,
    source: "committed_world_body_state_and_history",
    read_only: true,
    rotation_requires_committed_facing_transition_and_current_state_match: true,
    motor_intention_or_outcome_alone_is_not_rotation_feedback: true,
    exact_world_angle_exposed: false,
    angular_velocity_or_acceleration_inferred: false,
    subjective_orientation_belief_asserted: false,
  });
}
