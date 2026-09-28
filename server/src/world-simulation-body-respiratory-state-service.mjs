import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyRespiratoryStateVersion =
  "body-1o-committed-respiratory-activity-interface-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }

// This interface observes a world-owned respiratory activity fact only when
// present. It does not generate physiology from energy, speech, actions, or
// elapsed turns. A matching committed transition supports one bounded cue.
export function projectWorldSimulationBodyRespiratoryState({
  world_state, world_history, world_state_revision, character,
} = {}) {
  const actor = typeof character === "string" ? character.trim() : "";
  if (!actor) fail("BODY1O_CHARACTER_REQUIRED");
  const characters = record(record(world_state).characters);
  if (!Object.hasOwn(characters, actor)) fail("BODY1O_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1O_REVISION_REQUIRED");
  const activity = record(record(characters[actor]).physical_state)
    .respiratory_activity;
  const available = typeof activity === "boolean";
  const turns = items(record(world_history).turns);
  const latest = record(turns.at(-1));
  if (world_state_revision > 0 && latest.revision_to !== world_state_revision)
    fail("BODY1O_HISTORY_REVISION_MISMATCH");
  const feedback = [];
  if (available && latest.revision_to === world_state_revision) {
    for (const transition of items(latest.state_transitions)) {
      if (transition?.entity !== actor
          || transition.field !== "physical_state.respiratory_activity"
          || typeof transition.from !== "boolean"
          || typeof transition.to !== "boolean"
          || transition.from === transition.to
          || transition.to !== activity) continue;
      feedback.push(Object.freeze({
        modality: "respiratory_interoception",
        signal: "respiratory_activity_transition_detected",
        source_world_revision: world_state_revision,
      }));
      break;
    }
  }
  return Object.freeze({
    version: worldSimulationBodyRespiratoryStateVersion,
    authority: "committed_world_body_state_and_history",
    character: actor,
    source_world_revision: world_state_revision,
    respiratory_activity_sense: Object.freeze({
      status: available ? "respiratory_activity_signal_available" : "unavailable",
    }),
    respiratory_feedback: Object.freeze(feedback),
    boundaries: Object.freeze({
      respiratory_activity_requires_world_owned_state: true,
      transition_requires_committed_history_and_current_state_match: true,
      selected_action_or_speech_is_not_respiratory_evidence: true,
      raw_respiratory_activity_exposed: false,
      respiratory_rate_or_oxygenation_inferred: false,
      respiratory_capacity_inferred: false,
      subjective_breathlessness_asserted: false,
    }),
  });
}

export async function readCommittedWorldSimulationBodyRespiratoryState({
  session_id, character, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1O_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1O_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1O_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1O_HISTORY_STATE_MISMATCH");
  return Object.freeze({
    ...projectWorldSimulationBodyRespiratoryState({
      world_state: first.state, world_history: history,
      world_state_revision: first.revision, character,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodyRespiratoryStateContract() {
  return Object.freeze({
    version: worldSimulationBodyRespiratoryStateVersion,
    source: "committed_world_body_state_and_history",
    read_only: true,
    absent_world_owned_state_yields_unavailable: true,
    transition_requires_committed_history_and_current_state_match: true,
    action_or_speech_infers_respiratory_activity: false,
    raw_respiratory_activity_exposed: false,
    respiratory_rate_or_oxygenation_inferred: false,
    subjective_breathlessness_asserted: false,
  });
}
