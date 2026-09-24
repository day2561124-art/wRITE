import { hashAgentRunValue } from "./agent-run-service.mjs";
import { characterCommunicationTurnProjectionVersion } from "./character-communication-turn-projection-service.mjs";

export const characterCommunicationTurnSelectionCueVersion =
  "cc7o-observer-suspected-selection-cue-v1";
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const copy = (x) => JSON.parse(JSON.stringify(x ?? null));
function fail(message) {
  const e = new Error(message);
  e.code = "CC7O_SELECTION_CUE_INVALID";
  throw e;
}
function bounded(x, name) {
  if (typeof x !== "string" || !x.trim() || [...x.trim()].length > 240)
    fail(`${name} must be bounded nonblank text.`);
  return x.trim();
}
function exact(x, keys, name) {
  if (!record(x) || Object.keys(x).some((key) => !keys.includes(key)))
    fail(`${name} contains non-contract fields.`);
}
const projectionKeys = [
  "schema_version", "projection_id", "observer", "perceived_speaker",
  "source_signal_ref", "source_increment_ref", "heard_surface_fragment",
  "signal_phase", "perceived_cue_refs", "turn_end_projection",
  "response_preparation", "lineage", "boundaries",
];
const stateKeys = [
  "schema_version", "selection_cue_id", "observer", "perceived_speaker",
  "source_signal_ref", "source_increment_ref", "source_projection_id",
  "source_meaning_interpretation_id", "status", "basis_refs",
  "prior_selection_cue_id", "revises_prior_selection_cue", "subjective_only",
  "actual_speaker_intent_claimed", "addressee_established",
  "floor_awarded", "world_signal_emitted", "world_action_replanned",
];

export function buildCharacterCommunicationTurnSelectionCueContract() {
  return {
    version: characterCommunicationTurnSelectionCueVersion,
    observer_authored_current_release_only: true,
    nonlexical_or_listener_interpreted_evidence_supported: true,
    speaker_hidden_intent_available: false,
    real_speaker_identity_available: false,
    actual_addressee_established: false,
    selected_me_is_subjective_hypothesis_only: true,
    other_observer_private_state_available: false,
    actual_floor_awarded: false,
    backchannel_signal_emitted: false,
    interruption_judged: false,
    world_action_replanned: false,
    fixed_gap_threshold_used: false,
  };
}

/**
 * CC-7O is a *listener's guess* about a perceived speaker's possible
 * selection of a next recipient. The resolver sees only its own current
 * heard cue and (if present) its own CC-7K meaning interpretation.
 * A suspected selection is never an actual speaker act or floor allocation.
 */
export function projectCharacterCommunicationTurnSelectionCue({
  observer,
  turn_projection,
  meaning_interpretation = null,
  selection_decision,
  prior_state = null,
} = {}) {
  const listener = bounded(observer, "observer");
  exact(turn_projection, projectionKeys, "turn_projection");
  if (turn_projection.schema_version !== characterCommunicationTurnProjectionVersion
      || turn_projection.observer !== listener
      || bounded(turn_projection.perceived_speaker, "perceived speaker") === listener
      || !record(turn_projection.turn_end_projection)
      || turn_projection.turn_end_projection.subjective_only !== true
      || turn_projection.turn_end_projection.world_turn_end_claimed !== false
      || !record(turn_projection.boundaries)
      || turn_projection.boundaries.floor_claimed !== false
      || turn_projection.boundaries.speaker_hidden_intent_exposed !== false
      || !record(turn_projection.lineage)
      || !Array.isArray(turn_projection.perceived_cue_refs))
    fail("CC-7O requires a same-observer noncommittal CC-7A projection.");
  const signal = bounded(turn_projection.source_signal_ref, "signal");
  const increment = bounded(turn_projection.source_increment_ref, "increment");
  const projectionId = bounded(turn_projection.projection_id, "projection_id");
  let meaningRef = null;
  if (meaning_interpretation !== null) {
    exact(meaning_interpretation, [
      "interpretation_id", "interpretation_status", "interpreted_content",
      "interpreted_interaction_function", "understanding_attested",
      "prior_interpretation_id", "revises_prior_interpretation", "subjective_only",
      "grounding_claimed", "belief_updated",
    ], "meaning_interpretation");
    if (meaning_interpretation.subjective_only !== true
        || meaning_interpretation.grounding_claimed !== false
        || meaning_interpretation.belief_updated !== false)
      fail("CC-7K interpretation must remain listener-subjective.");
    meaningRef = bounded(meaning_interpretation.interpretation_id, "interpretation_id");
  }
  exact(selection_decision, ["status", "basis_refs"], "selection_decision");
  const status = bounded(selection_decision.status, "status");
  if (!["selected_me", "selected_other", "uncertain", "no_selection_evidence"]
    .includes(status)) fail("Unsupported subjective selection status.");
  if (!Array.isArray(selection_decision.basis_refs)
      || selection_decision.basis_refs.length > 16)
    fail("selection_decision.basis_refs must be bounded.");
  const refs = selection_decision.basis_refs.map((r) => bounded(r, "basis_ref"));
  if (new Set(refs).size !== refs.length)
    fail("selection_decision.basis_refs must be distinct.");
  const allowed = new Set([
    increment, ...turn_projection.perceived_cue_refs,
    ...(meaningRef ? [meaningRef] : []),
  ]);
  if (refs.some((ref) => !allowed.has(ref)))
    fail("Selection basis must come from this observer's current release.");
  if (["selected_me", "selected_other"].includes(status) && refs.length === 0)
    fail("A selection hypothesis requires observer-perceived evidence.");
  if (prior_state !== null) {
    exact(prior_state, stateKeys, "prior_state");
    if (prior_state.schema_version !== characterCommunicationTurnSelectionCueVersion
        || prior_state.observer !== listener
        || prior_state.perceived_speaker !== turn_projection.perceived_speaker
        || prior_state.source_signal_ref !== signal
        || prior_state.source_projection_id !== turn_projection.lineage.prior_projection_id
        || prior_state.subjective_only !== true
        || prior_state.actual_speaker_intent_claimed !== false
        || prior_state.addressee_established !== false
        || prior_state.floor_awarded !== false
        || prior_state.world_signal_emitted !== false
        || prior_state.world_action_replanned !== false)
      fail("Prior selection cue must follow this observer's projection lineage.");
  }
  const priorId = prior_state?.selection_cue_id ?? null;
  if (priorId !== null) bounded(priorId, "prior selection cue id");
  const identity = {
    version: characterCommunicationTurnSelectionCueVersion,
    observer: listener,
    speaker: turn_projection.perceived_speaker,
    signal_ref: signal,
    increment_ref: increment,
    projection_id: projectionId,
    meaning_ref: meaningRef,
    status, basis_refs: refs, prior_selection_cue_id: priorId,
  };
  return copy({
    schema_version: characterCommunicationTurnSelectionCueVersion,
    selection_cue_id:
      `cc7_selection_cue_${hashAgentRunValue(identity).slice(0, 24)}`,
    observer: listener,
    perceived_speaker: turn_projection.perceived_speaker,
    source_signal_ref: signal,
    source_increment_ref: increment,
    source_projection_id: projectionId,
    source_meaning_interpretation_id: meaningRef,
    status, basis_refs: refs,
    prior_selection_cue_id: priorId,
    revises_prior_selection_cue: prior_state !== null,
    subjective_only: true,
    actual_speaker_intent_claimed: false,
    addressee_established: false,
    floor_awarded: false,
    world_signal_emitted: false,
    world_action_replanned: false,
  });
}

export default projectCharacterCommunicationTurnSelectionCue;
