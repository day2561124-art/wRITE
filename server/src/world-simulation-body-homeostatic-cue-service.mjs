import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyHomeostaticCueVersion =
  "body-1q-committed-homeostatic-cue-v1";

const CHANNELS = Object.freeze(["hunger", "fullness", "fatigue"]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function actorName(value) { return typeof value === "string" ? value.trim() : ""; }

function currentCueState(physical) {
  const source = record(physical.homeostatic_cues);
  const values = {};
  for (const channel of CHANNELS) {
    if (typeof source[channel] === "boolean") values[channel] = source[channel];
  }
  return values;
}

// BODY-1Q exposes only explicit world-owned homeostatic receptor/cue state.
// It never derives hunger/fullness/fatigue from energy, food history, elapsed
// time, movement, or other proxy variables, and never asserts a subjective
// feeling or belief on behalf of Character Brain.
export function projectWorldSimulationBodyHomeostaticCues({
  world_state,
  world_history,
  world_state_revision,
  character,
} = {}) {
  const actor = actorName(character);
  if (!actor) fail("BODY1Q_CHARACTER_REQUIRED");
  const state = record(world_state);
  const characters = record(state.characters);
  if (!Object.hasOwn(characters, actor)) fail("BODY1Q_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1Q_REVISION_REQUIRED");

  const physical = record(record(characters[actor]).physical_state);
  const current = currentCueState(physical);
  const turn = record(items(record(world_history).turns).at(-1));
  if (world_state_revision > 0 && turn.revision_to !== world_state_revision)
    fail("BODY1Q_HISTORY_REVISION_MISMATCH");

  const senses = {};
  for (const channel of CHANNELS) {
    senses[channel] = Object.freeze({
      status: Object.hasOwn(current, channel)
        ? (current[channel] ? "cue_active" : "cue_inactive")
        : "unavailable",
    });
  }

  const feedback = [];
  if (turn.revision_to === world_state_revision) {
    for (const transition of items(turn.state_transitions)) {
      if (transition?.entity !== actor) continue;
      for (const channel of CHANNELS) {
        if (transition.field !== `physical_state.homeostatic_cues.${channel}`
            || typeof transition.from !== "boolean"
            || typeof transition.to !== "boolean"
            || transition.from === transition.to
            || !Object.hasOwn(current, channel)
            || transition.to !== current[channel]) continue;
        feedback.push(Object.freeze({
          modality: "interoception",
          channel,
          signal: current[channel]
            ? "homeostatic_cue_activated"
            : "homeostatic_cue_deactivated",
          source_world_revision: world_state_revision,
        }));
      }
    }
  }

  return Object.freeze({
    version: worldSimulationBodyHomeostaticCueVersion,
    authority: "committed_world_body_state_and_history",
    character: actor,
    source_world_revision: world_state_revision,
    cue_sense: Object.freeze(senses),
    cue_feedback: Object.freeze(feedback),
    boundaries: Object.freeze({
      explicit_world_owned_cue_required: true,
      transition_requires_committed_history_and_current_state_match: true,
      energy_state_does_not_imply_hunger_or_fatigue: true,
      food_history_does_not_imply_hunger_or_fullness: true,
      elapsed_time_does_not_imply_homeostatic_state: true,
      raw_proxy_values_exposed: false,
      cue_is_subjective_feeling: false,
      cue_is_character_belief: false,
      full_metabolic_and_fatigue_physiology_deferred: true,
    }),
  });
}

export async function readCommittedWorldSimulationBodyHomeostaticCues({
  session_id,
  character,
  expected_revision,
  expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1Q_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1Q_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1Q_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1Q_HISTORY_STATE_MISMATCH");

  return Object.freeze({
    ...projectWorldSimulationBodyHomeostaticCues({
      world_state: first.state,
      world_history: history,
      world_state_revision: first.revision,
      character,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodyHomeostaticCueContract() {
  return Object.freeze({
    version: worldSimulationBodyHomeostaticCueVersion,
    source: "committed_world_body_state_and_history",
    read_only: true,
    channels: CHANNELS,
    explicit_world_owned_boolean_cue_required: true,
    energy_or_food_history_inference_allowed: false,
    subjective_feeling_asserted: false,
    character_belief_asserted: false,
    full_metabolic_and_fatigue_physiology_deferred: true,
  });
}
