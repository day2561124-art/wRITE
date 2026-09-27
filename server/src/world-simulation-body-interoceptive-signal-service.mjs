import { getWorldSimulationHistory, getWorldSimulationState } from "./world-simulation-state-service.mjs";

export const worldSimulationBodyInteroceptiveSignalVersion =
  "body-1h-basic-interoceptive-signal-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function finite(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function name(value) { return typeof value === "string" ? value.trim() : ""; }

// BODY-1H exposes only bounded evidence that a committed internal body resource
// changed. It never exposes the engine value, labels the signal as fatigue or
// hunger, or turns the body signal directly into a Character belief/feeling.
export function projectWorldSimulationBodyInteroceptiveSignals({
  world_state,
  world_history,
  world_state_revision,
  character,
} = {}) {
  const actor = name(character);
  if (!actor) fail("BODY1H_CHARACTER_REQUIRED");
  const state = record(world_state);
  const characterState = record(record(state.characters)[actor]);
  if (!Object.keys(characterState).length) fail("BODY1H_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1H_REVISION_REQUIRED");

  const physical = record(characterState.physical_state);
  const currentEnergy = finite(physical.energy_current);
  const turn = record(items(record(world_history).turns).at(-1));
  if (world_state_revision > 0 && turn.revision_to !== world_state_revision)
    fail("BODY1H_HISTORY_REVISION_MISMATCH");

  const signals = [];
  if (currentEnergy !== null && turn.revision_to === world_state_revision) {
    for (const transition of items(turn.state_transitions)) {
      if (transition?.entity !== actor
          || transition.field !== "physical_state.energy_current") continue;
      const from = finite(transition.from);
      const to = finite(transition.to);
      if (from === null || to === null || from === to || to !== currentEnergy) continue;
      signals.push(Object.freeze({
        modality: "interoception",
        channel: "internal_energy_state",
        signal: "internal_energy_change_detected",
        direction: to < from ? "decrease" : "increase",
        source_world_revision: world_state_revision,
        objective_energy_value_exposed: false,
        change_magnitude_exposed: false,
        subjective_fatigue_asserted: false,
        subjective_hunger_asserted: false,
        subjective_feeling_asserted: false,
        character_belief_asserted: false,
      }));
    }
  }

  return Object.freeze({
    version: worldSimulationBodyInteroceptiveSignalVersion,
    authority: "committed_internal_body_state_change",
    character: actor,
    source_world_revision: world_state_revision,
    channel_status: currentEnergy === null ? "unavailable" : "available",
    signals: Object.freeze(signals),
    boundaries: Object.freeze({
      committed_world_state_required: true,
      latest_committed_transition_required_for_change_signal: true,
      objective_energy_value_exposed: false,
      physiological_fatigue_inferred: false,
      hunger_inferred: false,
      subjective_feeling_inferred: false,
      character_belief_inferred: false,
      full_respiratory_and_homeostatic_physiology_deferred: true,
    }),
  });
}

export async function readCommittedWorldSimulationBodyInteroceptiveSignals({
  session_id,
  character,
  expected_revision,
  expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1H_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1H_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1H_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1H_HISTORY_STATE_MISMATCH");
  return Object.freeze({
    ...projectWorldSimulationBodyInteroceptiveSignals({
      world_state: first.state,
      world_history: history,
      world_state_revision: first.revision,
      character,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodyInteroceptiveSignalContract() {
  return Object.freeze({
    version: worldSimulationBodyInteroceptiveSignalVersion,
    source: "committed_internal_body_state_change",
    read_only: true,
    numeric_internal_state_exposed: false,
    change_signal_is_subjective_feeling: false,
    change_signal_is_character_belief: false,
    fatigue_or_hunger_inferred: false,
    full_respiratory_and_homeostatic_physiology_deferred: true,
  });
}
